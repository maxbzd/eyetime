// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// "Instant" blocking: the rules for the browser must never send a page to the block page when the blocker would let it through (soundness: otherwise the block page
// sends the person back to the site and the rule sends them to the block page again), and must say the same thing as the blocker for the sites that are in a list.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRules, nextChange, applyRules, domainRegex, DNR } from '../../src/shared/dnr.js';
import { decide, redirectGraceKey } from '../../src/shared/blocking.js';
import { makeClassifier } from '../../src/shared/classify.js';
import { DEFAULT_SETTINGS, clone } from '../../src/shared/defaults.js';
import { PRESET_IDS } from '../../src/shared/catalog.js';

const BASE = 'chrome-extension://abc/src/blocked/blocked.html';
/** @param {number} seed */
const rng = (seed) => { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 0x100000000; }; };
const pick = (rnd, a) => a[Math.floor(rnd() * a.length)];
const NOW = new Date(2026, 10, 4, 11, 30).getTime(); // a Wednesday, 11:30

function ctxOf(settings, over = {}) { return { settings, focus: null, passes: {}, now: NOW, ...over }; }
const urlOf = (host, path = '/watch?v=1&t=5') => `https://${host}${path}`;

test('the regular expression takes a domain, its subdomains and any port or path, and nothing that only looks like it', () => {
  const re = new RegExp(domainRegex('youtube.com'));
  for (const u of ['https://youtube.com/', 'http://www.youtube.com/watch?v=1&t=5#x', 'https://m.music.youtube.com:8443/a', 'https://youtube.com', 'https://youtube.com?x=1']) assert.ok(re.test(u), u);
  for (const u of ['https://notyoutube.com/', 'https://youtube.com.evil.example/', 'https://evil.example/youtube.com/', 'https://youtube.com@evil.example/', 'https://evil.example/?u=https://youtube.com/', 'ftp://youtube.com/']) assert.ok(!re.test(u), u);
  assert.equal('https://www.youtube.com/watch?v=1&t=5#x'.replace(re, '<$1>'), '<https://www.youtube.com/watch?v=1&t=5#x>');
});

test('a default setup: the sites of the presets get a rule that carries the address on to the block page', () => {
  const s = clone(DEFAULT_SETTINGS);
  const { dynamic, truncated } = buildRules(ctxOf(s), BASE);
  assert.equal(truncated, 0);
  const r = applyRules(dynamic, urlOf('www.youtube.com'));
  assert.ok(r && r.action.type === 'redirect', 'youtube.com gets the pause page');
  assert.match(r.action.redirect.regexSubstitution, /^chrome-extension:\/\/abc\/src\/blocked\/blocked\.html\?d=1&r=friction&a=pause&u=\\1$/);
  assert.equal(applyRules(dynamic, urlOf('github.com')), null, 'a site in no list is not touched');
  assert.equal(applyRules(dynamic, urlOf('docs.google.com')) === null || applyRules(dynamic, urlOf('docs.google.com')).action.type === 'allow', true);
});

test('with the pause switched off and nothing else running there are no rules at all', () => {
  const s = clone(DEFAULT_SETTINGS); s.blocking.friction.enabled = false;
  assert.deepEqual(buildRules(ctxOf(s), BASE).dynamic, []);
});

test('a focus session turns the pause into a block, and the end of the session is when the rules change next', () => {
  const s = clone(DEFAULT_SETTINGS);
  const focus = { startedAt: NOW, endsAt: NOW + 25 * 60_000, strict: false };
  const { dynamic } = buildRules(ctxOf(s, { focus }), BASE);
  assert.match(applyRules(dynamic, urlOf('youtube.com')).action.redirect.regexSubstitution, /r=focus&a=block/);
  assert.equal(nextChange(ctxOf(s, { focus })), focus.endsAt);
});

test('a "continue" pass takes the rule away until it runs out, and the pass is the next change', () => {
  const s = clone(DEFAULT_SETTINGS);
  const classifier = makeClassifier(s), rule = classifier.ruleDomain('www.youtube.com');
  const until = NOW + 10 * 60_000;
  const c = ctxOf(s, { passes: { [rule]: until } });
  assert.equal(applyRules(buildRules(c, BASE).dynamic, urlOf('www.youtube.com')), null);
  assert.equal(nextChange(c), until);
});

test('the 30 seconds after "continue" in one tab are a rule for that tab only', () => {
  const s = clone(DEFAULT_SETTINGS);
  const { session } = buildRules(ctxOf(s, { passes: { [redirectGraceKey(7)]: NOW + 30_000, [redirectGraceKey(8)]: NOW - 1 } }), BASE);
  assert.equal(session.length, 1);
  assert.deepEqual(session[0].condition.tabIds, [7]);
  assert.equal(session[0].id, DNR.GRACE_BASE_ID + 7);
  assert.equal(applyRules(session, urlOf('youtube.com'), 7).action.type, 'allow');
  assert.equal(applyRules(session, urlOf('youtube.com'), 9), null);
});

test('the work hours: the rules change at the minute the schedule begins and ends', () => {
  const s = clone(DEFAULT_SETTINGS); s.blocking.schedule = { enabled: true, days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00', strict: false, passMinutes: 5 };
  const next = nextChange(ctxOf(s));
  assert.equal(new Date(next).getHours() * 60 + new Date(next).getMinutes(), 18 * 60);
  const evening = new Date(2026, 10, 4, 19, 0).getTime();
  assert.equal(new Date(nextChange(ctxOf(s, { now: evening }))).getHours(), 9); // the next morning
  const sat = new Date(2026, 10, 7, 12, 0).getTime();
  assert.equal(new Date(nextChange(ctxOf(s, { now: sat }))).getDay(), 1); // Monday
  s.blocking.schedule.days = [];
  assert.equal(nextChange(ctxOf(s)), null);
});

test('the person\'s allow list beats a rule, and a more specific allowed site beats a blocked parent', () => {
  const s = clone(DEFAULT_SETTINGS); s.blocking.always = ['example.com']; s.blocking.allow = ['ok.example.com'];
  const { dynamic } = buildRules(ctxOf(s), BASE);
  assert.equal(applyRules(dynamic, urlOf('example.com')).action.type, 'redirect');
  assert.equal(applyRules(dynamic, urlOf('a.example.com')).action.type, 'redirect');
  assert.equal(applyRules(dynamic, urlOf('ok.example.com')).action.type, 'allow');
  assert.equal(applyRules(dynamic, urlOf('deep.ok.example.com')).action.type, 'allow');
  s.blocking.allow = ['example.com']; // an allow list entry on the blocked domain itself: nothing is blocked
  assert.equal(applyRules(buildRules(ctxOf(s), BASE).dynamic, urlOf('example.com')).action.type, 'allow');
});

test('more domains than the browser takes rules for: the rest is counted and left to the tab blocker', () => {
  const s = clone(DEFAULT_SETTINGS); s.blocking.custom = Array.from({ length: 1200 }, (_, i) => `site${i}.example.org`);
  const { dynamic, truncated } = buildRules(ctxOf(s), BASE);
  assert.equal(dynamic.filter((r) => r.condition.regexFilter).length, DNR.MAX_REGEX_RULES); // the budget is of rules with an expression; the one rule for frames has none
  assert.ok(truncated > 300);
});

test('SOUNDNESS: for random settings, sessions, passes and hosts a rule never redirects what the blocker would let through (and says the same reason)', () => {
  const DOMAINS = ['example.com', 'a.example.com', 'b.a.example.com', 'news.site', 'video.news.site', 'docs.news.site', 'tube.test', 'shop.test', 'x.shop.test', 'youtube.com', 'music.youtube.com', 'google.com', 'docs.google.com', 'github.com'];
  const HOSTS = [...DOMAINS, 'www.example.com', 'z.b.a.example.com', 'www.youtube.com', 'm.tube.test', 'other.test', 'q.docs.google.com', 'mail.google.com'];
  let checked = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const rnd = rng(seed * 7919);
    const s = clone(DEFAULT_SETTINGS);
    for (const id of PRESET_IDS) s.blocking.presets[id] = rnd() < 0.5;
    s.blocking.custom = DOMAINS.filter(() => rnd() < 0.25);
    s.blocking.always = DOMAINS.filter(() => rnd() < 0.1);
    s.blocking.allow = DOMAINS.filter(() => rnd() < 0.15);
    s.sites = Object.fromEntries(DOMAINS.filter(() => rnd() < 0.2).map((d) => [d, pick(rnd, ['productive', 'neutral', 'distracting'])]));
    s.blocking.friction.enabled = rnd() < 0.7;
    s.blocking.schedule = { enabled: rnd() < 0.5, days: [0, 1, 2, 3, 4, 5, 6].filter(() => rnd() < 0.6), start: pick(rnd, ['09:00', '22:00', '11:00']), end: pick(rnd, ['18:00', '06:00', '12:00']), strict: rnd() < 0.3, passMinutes: 5 };
    const now = NOW + Math.floor(rnd() * 3 * 86_400_000);
    const focus = rnd() < 0.4 ? { startedAt: now, endsAt: now + 3_600_000, strict: rnd() < 0.4, scope: pick(rnd, ['distracting', 'only-mine']), allow: DOMAINS.filter(() => rnd() < 0.2) } : null;
    const classifier = makeClassifier(s);
    const passes = {};
    for (const d of DOMAINS) if (rnd() < 0.2) passes[classifier.ruleDomain(d)] = now + (rnd() < 0.8 ? 600_000 : -1000);
    const ctx = { settings: s, focus, passes, now };
    const { dynamic } = buildRules(ctx, BASE);
    const base = { settings: s, classifier, focus, passes, now, usageOf: () => 0, distractingSec: 0 };
    for (const host of HOSTS) {
      const rule = applyRules(dynamic, urlOf(host));
      if (!rule || rule.action.type !== 'redirect') continue;
      checked++;
      const d = decide(host, base);
      assert.notEqual(d.action, 'allow', `seed ${seed}: ${host} is sent to the block page but the blocker lets it through (loop)`);
      const m = /r=([^&]*)&a=([^&]*)/.exec(rule.action.redirect.regexSubstitution);
      assert.equal(decodeURIComponent(m[1]), d.reason || '', `seed ${seed}: ${host} reason`);
      assert.equal(decodeURIComponent(m[2]), d.action, `seed ${seed}: ${host} action`);
    }
  }
  assert.ok(checked > 1500, `only ${checked} redirects were checked: the test would prove little`);
});

test('COMPLETENESS for the sites in a list: what the blocker stops by a list, a schedule or a session is also in the rules', () => {
  for (let seed = 1; seed <= 150; seed++) {
    const rnd = rng(seed * 104729);
    const s = clone(DEFAULT_SETTINGS);
    s.blocking.custom = ['c1.test', 'c2.test'].filter(() => rnd() < 0.7); s.blocking.always = rnd() < 0.5 ? ['al.test'] : [];
    const now = NOW, focus = rnd() < 0.5 ? { startedAt: now, endsAt: now + 3_600_000, strict: rnd() < 0.5, scope: 'distracting', allow: [] } : null;
    const classifier = makeClassifier(s);
    const { dynamic } = buildRules({ settings: s, focus, passes: {}, now }, BASE);
    const base = { settings: s, classifier, focus, passes: {}, now, usageOf: () => 0, distractingSec: 0 };
    for (const host of ['c1.test', 'www.c2.test', 'al.test', 'www.youtube.com']) {
      const d = decide(host, base);
      const rule = applyRules(dynamic, urlOf(host));
      assert.equal(!!rule && rule.action.type === 'redirect', d.action !== 'allow', `seed ${seed} ${host}`);
    }
  }
});

test('a blocked site in a frame of an allowed page is not loaded, and an exception still wins', () => {
  const s = clone(DEFAULT_SETTINGS); s.blocking.custom = ['tube.test']; s.blocking.always = ['tube.test']; s.blocking.allow = ['docs.tube.test'];
  const { dynamic } = buildRules(ctxOf(s), BASE);
  const frame = (u) => applyRules(dynamic, u, null, 'sub_frame');
  assert.equal(frame('https://tube.test/embed/1')?.action.type, 'block', 'the frame is stopped');
  assert.equal(frame('https://www.tube.test/embed/1')?.action.type, 'block', 'a subdomain too');
  assert.equal(frame('https://docs.tube.test/x')?.action.type, 'allow', 'the person\'s allow list beats it');
  assert.equal(frame('https://other.test/'), null, 'other sites are not touched');
});

test('when the browser takes fewer rules than there are domains, the exceptions are kept and the redirects give way', () => {
  const s = clone(DEFAULT_SETTINGS); s.blocking.custom = Array.from({ length: 1200 }, (_, i) => `site${i}.example.org`); s.blocking.allow = ['a.site1.example.org', 'b.site2.example.org'];
  const { dynamic } = buildRules(ctxOf(s), BASE);
  assert.ok(dynamic.some((r) => r.action.type === 'allow' && r.condition.regexFilter.includes('a\\.site1')), 'the exception under a blocked parent survived the cut');
});
