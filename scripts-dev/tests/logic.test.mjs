import test from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, rangeKeys, weekStart, addDays, toMinutes } from '../../src/shared/time.js';
import { normalizeHost, hostFromUrl, parseUserDomain, matches, bestMatch } from '../../src/shared/domains.js';
import { DEFAULT_SETTINGS, deepMerge } from '../../src/shared/defaults.js';
import { makeClassifier } from '../../src/shared/classify.js';
import { decide, isScheduleActive } from '../../src/shared/blocking.js';
import { summarize, delta, insights, focusStreak, heatLevel, emptyDay } from '../../src/shared/stats.js';
import { createSession, remainingMs, progress, clock } from '../../src/shared/focus.js';
import { migrate, needsMigration } from '../../src/shared/migrate.js';

const settings = (patch = {}) => deepMerge(DEFAULT_SETTINGS, patch);

test('time: local day keys and ranges', () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.deepEqual(rangeKeys(3, new Date(2026, 2, 1)), ['2026-02-27', '2026-02-28', '2026-03-01']);
  assert.equal(dayKey(weekStart(new Date(2026, 9, 21))), '2026-10-19'); // Wed -> Monday
  assert.equal(dayKey(weekStart(new Date(2026, 9, 25))), '2026-10-19'); // Sun -> Monday
  assert.equal(dayKey(addDays(new Date(2026, 0, 31), 1)), '2026-02-01');
  assert.equal(toMinutes('09:30'), 570);
});

test('domains: normalising and parsing user input', () => {
  assert.equal(normalizeHost('WWW.YouTube.com.'), 'youtube.com');
  assert.equal(hostFromUrl('https://m.facebook.com/x?y=1'), 'facebook.com');
  assert.equal(hostFromUrl('chrome://extensions'), null);
  assert.equal(hostFromUrl('chrome-extension://abc/page.html'), null);
  assert.equal(parseUserDomain(' https://www.Reddit.com/r/all?x '), 'reddit.com');
  assert.equal(parseUserDomain('localhost'), 'localhost');
  assert.equal(parseUserDomain('not a domain'), null);
  assert.equal(parseUserDomain('javascript:alert(1)'), null);
  assert.ok(matches('music.youtube.com', 'youtube.com'));
  assert.ok(!matches('notyoutube.com', 'youtube.com'));
  assert.equal(bestMatch('a.b.example.com', ['example.com', 'b.example.com']), 'b.example.com');
});

test('classify: presets, productive defaults, overrides, allow-list, most specific wins', () => {
  const c = makeClassifier(settings());
  assert.equal(c.classify('youtube.com'), 'distracting');
  assert.equal(c.classify('music.youtube.com'), 'distracting');
  assert.equal(c.classify('github.com'), 'productive');
  assert.equal(c.classify('news.ycombinator.com'), 'neutral'); // news preset is off by default
  assert.equal(c.classify('console.aws.amazon.com'), 'productive'); // beats the shopping preset's amazon.com when enabled
  const c2 = makeClassifier(settings({ blocking: { presets: { shopping: true } } }));
  assert.equal(c2.classify('amazon.com'), 'distracting');
  assert.equal(c2.classify('console.aws.amazon.com'), 'productive');
  const c3 = makeClassifier(settings({ sites: { 'youtube.com': 'productive' } }));
  assert.equal(c3.classify('youtube.com'), 'productive');
  const c4 = makeClassifier(settings({ blocking: { allow: ['reddit.com'] } }));
  assert.equal(c4.classify('reddit.com'), 'neutral');
  const c5 = makeClassifier(settings({ blocking: { custom: ['example.org'] } }));
  assert.equal(c5.classify('sub.example.org'), 'distracting');
});

test('schedule: weekday windows and overnight ranges', () => {
  const sch = { enabled: true, days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' };
  assert.ok(isScheduleActive(sch, new Date(2026, 9, 19, 10, 0)));   // Monday 10:00
  assert.ok(!isScheduleActive(sch, new Date(2026, 9, 19, 18, 0)));  // end is exclusive
  assert.ok(!isScheduleActive(sch, new Date(2026, 9, 18, 10, 0)));  // Sunday
  const night = { enabled: true, days: [5], start: '22:00', end: '06:00' };
  assert.ok(isScheduleActive(night, new Date(2026, 9, 23, 23, 0))); // Friday 23:00
  assert.ok(isScheduleActive(night, new Date(2026, 9, 24, 3, 0)));  // Saturday 03:00 belongs to Friday's range
  assert.ok(!isScheduleActive(night, new Date(2026, 9, 25, 3, 0))); // Sunday 03:00 does not
  assert.ok(!isScheduleActive({ ...sch, enabled: false }, new Date(2026, 9, 19, 10, 0)));
});

test('decide: friction, focus, strict, passes, schedule, limits, always, allow', () => {
  const s = settings();
  const base = { settings: s, classifier: makeClassifier(s), focus: null, passes: {}, usageOf: () => 0, now: new Date(2026, 9, 24, 12, 0).getTime() }; // Saturday
  assert.equal(decide('github.com', base).action, 'allow');
  assert.equal(decide('example.org', base).action, 'allow');
  assert.equal(decide('youtube.com', base).action, 'pause');
  assert.equal(decide('youtube.com', { ...base, passes: { 'youtube.com': base.now + 1000 } }).action, 'allow');
  assert.equal(decide('youtube.com', { ...base, passes: { 'youtube.com': base.now - 1 } }).action, 'pause'); // expired pass

  const focus = createSession({ minutes: 25, goal: 'x', now: base.now - 1000 });
  const f = decide('youtube.com', { ...base, focus });
  assert.deepEqual([f.action, f.reason, f.canPass], ['block', 'focus', true]);
  assert.equal(decide('github.com', { ...base, focus }).action, 'allow');
  const passed = decide('youtube.com', { ...base, focus, passes: { 'youtube.com': base.now + 1000 } });
  assert.equal(passed.action, 'allow'); // non-strict + pass
  const strict = { ...focus, strict: true };
  const st = decide('youtube.com', { ...base, focus: strict, passes: { 'youtube.com': base.now + 1000 } });
  assert.deepEqual([st.action, st.strict, st.canPass], ['block', true, false]); // strict ignores passes

  const sched = settings({ blocking: { schedule: { enabled: true, days: [6], start: '09:00', end: '18:00' } } });
  const sc = decide('youtube.com', { ...base, settings: sched, classifier: makeClassifier(sched) });
  assert.deepEqual([sc.action, sc.reason], ['block', 'schedule']);

  const lim = settings({ blocking: { limits: { 'example.org': 10 } } });
  const ctx = (used) => ({ ...base, settings: lim, classifier: makeClassifier(lim), usageOf: () => used });
  assert.equal(decide('example.org', ctx(599)).action, 'allow');
  assert.equal(decide('example.org', ctx(600)).reason, 'limit');

  const always = settings({ blocking: { always: ['example.org'] } });
  assert.equal(decide('www.example.org'.replace('www.', ''), { ...base, settings: always, classifier: makeClassifier(always) }).reason, 'always');
  const allow = settings({ blocking: { allow: ['youtube.com'], always: ['youtube.com'] } });
  assert.equal(decide('youtube.com', { ...base, settings: allow, classifier: makeClassifier(allow) }).action, 'allow'); // allow wins
  const nofr = settings({ blocking: { friction: { enabled: false } } });
  assert.equal(decide('youtube.com', { ...base, settings: nofr, classifier: makeClassifier(nofr) }).action, 'allow');
});

test('stats: summarize, delta, streak, heat levels, insights', () => {
  const c = makeClassifier(settings());
  const day = (d, fc = 0) => ({ ...emptyDay(), d, h: { 10: d }, fc, fs: fc * 1500, b: 2 });
  const entries = [
    ['2026-10-17', day({ 'github.com': 3600, 'youtube.com': 600 }, 1)],
    ['2026-10-18', day({ 'youtube.com': 4000, 'github.com': 600 }, 0)],
    ['2026-10-19', day({ 'github.com': 7200, 'youtube.com': 300 }, 2)],
  ];
  const s = summarize(entries, c.classify);
  assert.equal(s.total, 3600 + 600 + 4000 + 600 + 7200 + 300);
  assert.equal(s.productive, 11400); assert.equal(s.distracting, 4900);
  assert.equal(s.focusSessions, 3); assert.equal(s.breaks, 6); assert.equal(s.activeDays, 3);
  assert.equal(s.topSites[0].host, 'github.com');
  assert.equal(s.hourly[10].distracting, 4900);
  assert.equal(delta(150, 100), 50); assert.equal(delta(5, 0), null);
  assert.equal(focusStreak(entries), 1); // 18th has no session
  assert.equal(focusStreak([...entries.slice(0, 1), ['2026-10-18', day({}, 1)], ['2026-10-19', day({}, 0)]]), 2); // today may be empty
  assert.equal(heatLevel(0, 100), 0); assert.equal(heatLevel(10, 100), 1); assert.equal(heatLevel(100, 100), 4);
  const ins = insights(s, null).map((i) => i.id);
  assert.ok(ins.includes('worstDay') && ins.includes('distractionShare'));
  assert.deepEqual(insights(summarize([['2026-10-19', day({ 'github.com': 100 })]], c.classify), null), []); // too little data: say nothing
});

test('focus: sessions and clock', () => {
  const s = createSession({ minutes: 25, goal: '  write  ', strict: 1, now: 1000 });
  assert.equal(s.endsAt, 1000 + 25 * 60000); assert.equal(s.goal, 'write'); assert.equal(s.strict, true);
  assert.equal(remainingMs(s, 1000 + 60000), 24 * 60000);
  assert.equal(progress(s, 1000 + 12.5 * 60000), 0.5);
  assert.equal(createSession({ minutes: 99999 }).minutes, 720);
  assert.equal(clock(65_000), '01:05'); assert.equal(clock(3_725_000), '1:02:05');
});

test('deepMerge: defaults survive partial saved settings; arrays replaced', () => {
  const m = deepMerge(DEFAULT_SETTINGS, { focus: { minutes: 50 }, blocking: { custom: ['a.com'] } });
  assert.equal(m.focus.minutes, 50); assert.deepEqual(m.focus.presets, [15, 25, 50, 90]);
  assert.deepEqual(m.blocking.custom, ['a.com']); assert.equal(m.blocking.friction.seconds, 8);
  m.focus.presets.push(1); assert.equal(DEFAULT_SETTINGS.focus.presets.length, 4); // no shared references
});

test('migrate: a realistic 1.x profile keeps its data', () => {
  const raw = {
    settings: {
      language: 'ru', eyeRestIntervalMinutes: 25, notificationsEnabled: true, excludedDomains: ['localhost', 'intranet.local'],
      interceptor: { bedtime: '23:30', habits: { items: [{ id: 'move', name: 'Move' }], totalDays: 30, startDate: '2026-10-01', log: { '2026-10-18': ['move'] } }, parkedThoughts: [{ id: 1760000000000, text: 'Call mom', time: '10:00' }] },
      nuclearLock: { active: false, domains: ['youtube.com'] },
      blocking: { presets: { social: true, video: false, forums: true }, customDistractions: ['https://www.Example.com/x'], allowedDomains: ['vk.com'], schedule: { enabled: true, days: [1, 2], start: '08:00', end: '17:00', strict: true, passMinutes: 3 } },
      hardBlockedDomains: ['pornhub.com', 'bad domain'], customDomainLimits: { 'youtube.com': 45, 'x.com': 0 },
      youtubeCleaner: { hideShorts: true, hideRecommended: true }, domainProductivity: { 'github.com': 'productive', 'foo.com': 'weird' },
    },
    stats: { '2026-10-18': { totalSeconds: 100, domains: { 'github.com': 60.4 }, desktopApps: { Figma: 40 }, hourly: { 9: 100 }, breaksCompleted: 3, focusSessions: 2 }, 'junk': {} },
    dailyGoals: [{ id: 'a', text: 'Ship it', done: true, isStarred: true }, { text: '   ' }],
  };
  assert.ok(needsMigration(raw));
  const m = migrate(raw, 1_760_000_000_000);
  assert.equal(m.settings.language, 'ru'); assert.equal(m.settings.onboarded, true);
  assert.equal(m.settings.eye.intervalMin, 25); assert.deepEqual(m.settings.tracking.excluded, ['localhost', 'intranet.local']);
  assert.equal(m.settings.blocking.presets.video, false); assert.equal(m.settings.blocking.presets.news, false);
  assert.deepEqual(m.settings.blocking.custom, ['example.com']); assert.deepEqual(m.settings.blocking.always, ['pornhub.com']);
  assert.deepEqual(m.settings.blocking.limits, { 'youtube.com': 45 });
  assert.equal(m.settings.blocking.schedule.strict, true); assert.deepEqual(m.settings.blocking.schedule.days, [1, 2]);
  assert.equal(m.settings.blocking.feed.hideShorts, true); assert.equal(m.settings.blocking.feed.hideRecs, true);
  assert.deepEqual(m.settings.sites, { 'github.com': 'productive' });
  assert.equal(m.tasks.length, 1); assert.equal(m.tasks[0].starred, true);
  assert.deepEqual(m.habits.log, { '2026-10-18': ['move'] });
  assert.equal(m.captures[0].text, 'Call mom');
  assert.deepEqual(Object.keys(m.days), ['2026-10-18']);
  assert.deepEqual(m.days['2026-10-18'], { d: { 'github.com': 60 }, h: { 9: { '?': 100 } }, a: { Figma: 40 }, fs: 0, fc: 2, b: 3 });
  assert.ok(m.removeKeys.includes('stats'));
  assert.equal(needsMigration({ meta: m.meta }), false);
});

test('migrate: a fresh install gets defaults and is not marked onboarded', () => {
  const m = migrate({});
  assert.equal(m.settings.onboarded, false); assert.deepEqual(m.settings.focus.presets, [15, 25, 50, 90]); assert.deepEqual(m.days, {});
});

test('rest: created after a session, bounded, active only until it ends', async () => {
  const { createRest, isRestActive } = await import('../../src/shared/focus.js');
  const r = createRest({ minutes: 5, now: 1000 });
  assert.equal(r.endsAt, 1000 + 5 * 60000);
  assert.ok(isRestActive(r, 1000 + 60000)); assert.ok(!isRestActive(r, r.endsAt)); assert.ok(!isRestActive(null));
  assert.equal(createRest({ minutes: 999 }).minutes, 60); assert.equal(createRest({ minutes: 0 }).minutes, 1);
});

test('menu actions: classify, toggle always-block, ignore junk', async () => {
  const { applyMenuAction } = await import('../../src/shared/menu.js');
  const s = settings({ blocking: { always: ['a.com'] } });
  assert.deepEqual(applyMenuAction('cls:distracting', 'x.com', s), { changed: true, key: 'menu.marked', cls: 'distracting' });
  assert.equal(s.sites['x.com'], 'distracting');
  applyMenuAction('cls:productive', 'a.com', s); assert.deepEqual(s.blocking.always, []); // no longer distracting => unblocked
  assert.equal(applyMenuAction('block:always', 'b.com', s).key, 'menu.blocked'); assert.deepEqual(s.blocking.always, ['b.com']);
  assert.equal(applyMenuAction('block:always', 'b.com', s).key, 'menu.unblocked'); assert.deepEqual(s.blocking.always, []);
  assert.equal(applyMenuAction('cls:weird', 'x.com', s).changed, false); assert.equal(applyMenuAction('block:always', null, s).changed, false);
});

test('suggestLimit: caps the heaviest distracting site at ~60% of its daily average', async () => {
  const { suggestLimit } = await import('../../src/shared/stats.js');
  const sum = { activeDays: 5, topSites: [{ host: 'github.com', cls: 'productive', sec: 99999 }, { host: 'youtube.com', cls: 'distracting', sec: 5 * 50 * 60 }, { host: 'x.com', cls: 'distracting', sec: 5 * 20 * 60 }] };
  assert.deepEqual(suggestLimit(sum), { host: 'youtube.com', avgMin: 50, limitMin: 30 });
  assert.equal(suggestLimit(sum, { 'youtube.com': 45 }).host, 'x.com'); // already limited -> next one
  assert.equal(suggestLimit({ activeDays: 5, topSites: [{ host: 'x.com', cls: 'distracting', sec: 5 * 10 * 60 }] }), null); // small: nothing to suggest
  assert.equal(suggestLimit({ activeDays: 0, topSites: [] }), null);
});
