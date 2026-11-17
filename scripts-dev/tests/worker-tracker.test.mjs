// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The screen-time tracker of the service worker, against a pretend browser: what is credited to which site, and when nothing is.
import test, { mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeChrome } from './helpers/fake-chrome.mjs';

const chrome = installFakeChrome();
const { sync } = await import('../../src/background/tracker.js');
const { updateSettings } = await import('../../src/shared/storage.js');

const start = new Date(2026, 10, 4, 10, 0, 0).getTime(); // a Wednesday, 10:00:00
const dayKey = (ms) => { const d = new Date(ms); return `d:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const today = () => chrome.storage.local._all()[dayKey(Date.now())] || { d: {}, h: {} };
const seconds = (host) => today().d[host] || 0;

beforeEach(async () => {
  mock.timers.reset();
  mock.timers.enable({ apis: ['Date'], now: start });
  await chrome.storage.local.clear(); await chrome.storage.session.clear(); await chrome.alarms.clearAll();
  chrome._tabs().length = 0; chrome._calls.length = 0; chrome.windows._extra().length = 0; chrome.windows._refuse = null;
  chrome.idle._state = 'active'; chrome.idle._still = Infinity; chrome._window.focused = true;
});

test('time on the site in front is credited when the tab changes or the tick comes', async () => {
  chrome._openTab('https://github.com/maxbzd/eyetime');
  await sync('init');
  mock.timers.tick(25_000); await sync('tick');
  assert.equal(seconds('github.com'), 25);
  mock.timers.tick(10_000); await sync('tick');
  assert.equal(seconds('github.com'), 35);
  assert.equal(today().h[10]['github.com'], 35, 'and to the hour it was spent in');
});

test('a switch to another site closes the first interval, opens the second and counts one switch', async () => {
  const a = chrome._openTab('https://github.com/');
  await sync('init');
  mock.timers.tick(20_000);
  chrome._openTab('https://news.ycombinator.com/');
  await sync('activated');
  mock.timers.tick(30_000); await sync('tick');
  assert.equal(seconds('github.com'), 20); assert.equal(seconds('news.ycombinator.com'), 30);
  assert.equal(today().sw, 1);
  assert.ok(a.id);
});

test('nothing is credited while the person is away, while another program has focus, or on a page that is not a site', async () => {
  chrome._openTab('https://github.com/'); await sync('init');
  chrome.idle._state = 'idle'; mock.timers.tick(30_000); await sync('idle:idle'); // the 30 s up to the moment idleness was noticed count, what follows does not
  const afterIdle = seconds('github.com');
  mock.timers.tick(60_000); await sync('tick');
  assert.equal(seconds('github.com'), afterIdle, 'idle time is not credited');
  chrome.idle._state = 'active'; chrome._window.focused = false; await sync('focus');
  mock.timers.tick(60_000); await sync('tick');
  assert.equal(seconds('github.com'), afterIdle, 'another program has the keyboard');
  chrome._window.focused = true; chrome._tabs().length = 0; chrome._openTab('chrome://extensions'); await sync('activated');
  mock.timers.tick(60_000); await sync('tick');
  assert.equal(seconds('github.com'), afterIdle); assert.deepEqual(Object.keys(today().d), ['github.com'], 'a browser page is not a site');
});

test('a gap of more than two minutes is a sleeping computer and is not credited', async () => {
  chrome._openTab('https://github.com/'); await sync('init');
  mock.timers.tick(3 * 60_000); await sync('tick');
  assert.equal(seconds('github.com'), 0);
  mock.timers.tick(15_000); await sync('tick');
  assert.equal(seconds('github.com'), 15, 'and counting goes on from the moment of waking');
});

test('fractions of a second are carried: fifty stays of 400 ms are twenty seconds, not nothing', async () => {
  chrome._openTab('https://github.com/'); await sync('init');
  for (let i = 0; i < 50; i++) { mock.timers.tick(400); await sync('updated'); }
  assert.equal(seconds('github.com'), 20);
});

test('an excluded site, a private window (unless allowed) and a pause are never counted', async () => {
  await updateSettings((s) => { s.tracking.excluded = ['bank.example']; });
  chrome._openTab('https://www.bank.example/account'); await sync('init');
  mock.timers.tick(30_000); await sync('tick');
  assert.deepEqual(today().d, {}, 'an excluded site (and its subdomains)');
  chrome._openTab('https://github.com/', { incognito: true }); await sync('activated');
  mock.timers.tick(30_000); await sync('tick');
  assert.deepEqual(today().d, {}, 'a private window');
  chrome._openTab('https://github.com/x'); await chrome.storage.local.set({ pausedUntil: Date.now() + 10 * 60_000 }); await sync('pause');
  mock.timers.tick(30_000); await sync('tick');
  assert.deepEqual(today().d, {}, 'a pause');
});

test('an audible tab counts while the person is idle, when the setting says so', async () => {
  chrome._openTab('https://music.example/', { audible: true }); chrome.idle._state = 'idle';
  await sync('init'); mock.timers.tick(30_000); await sync('tick');
  assert.equal(seconds('music.example'), 30);
});

test('an interval across midnight goes to both days', async () => {
  mock.timers.setTime(new Date(2026, 10, 4, 23, 59, 30).getTime());
  chrome._openTab('https://github.com/'); await sync('init');
  mock.timers.tick(60_000); await sync('tick');
  const all = chrome.storage.local._all();
  assert.equal(all['d:2026-11-04'].d['github.com'], 30); assert.equal(all['d:2026-11-05'].d['github.com'], 30);
});

test('the 30-second alarm exists while a site is counted and is not kept for nothing', async () => {
  const tick = () => chrome.alarms.get('tick');
  chrome._openTab('https://github.com/'); await sync('init');
  assert.ok(await tick(), 'a site is being counted: the alarm runs');
  chrome.idle._state = 'idle'; await sync('idle:idle');
  assert.equal(await tick(), undefined, 'nobody at the keyboard and nothing running: the worker is not woken twice a minute');
  chrome.idle._state = 'active'; await sync('idle:active');
  assert.ok(await tick(), 'back at the keyboard: it starts again');
  chrome._window.focused = false; await sync('focus');
  assert.equal(await tick(), undefined, 'another program has focus');
});

test('a running focus session or rest keeps the alarm (the badge counts the minutes down) even with nobody counted', async () => {
  chrome._window.focused = false;
  await chrome.storage.local.set({ focus: { id: 'f', startedAt: Date.now(), endsAt: Date.now() + 25 * 60_000, minutes: 25 } });
  await sync('init');
  assert.ok(await chrome.alarms.get('tick'), 'a session is running');
  await chrome.storage.local.set({ focus: null, rest: { startedAt: Date.now(), endsAt: Date.now() + 5 * 60_000, minutes: 5 } });
  await sync('x'); assert.ok(await chrome.alarms.get('tick'), 'a rest is running');
  await chrome.storage.local.set({ rest: null }); await sync('y');
  assert.equal(await chrome.alarms.get('tick'), undefined, 'both over: no alarm');
});

// the eye reminders count the time somebody is in front of the screen, whatever the page: tired eyes do not care. (The new tab froze the countdown at "1s" for good: it is not a site, so nothing was counted.)
const { getEyeState } = await import('../../src/background/breaks.js');
const eyeOn = (extra = () => {}) => updateSettings((s) => { s.eye.enabled = true; s.eye.intervalMin = 20; s.eye.notify = false; s.eye.fullscreen = false; extra(s); }); // these are about what is counted; how the break is shown is in worker-breaks-focus

test('eye reminders: the time on the new tab and on a browser page counts, and the break comes due; the site statistics stay empty', async () => {
  await eyeOn();
  chrome._openTab('chrome-extension://abc/src/newtab/newtab.html'); await sync('init');
  for (let i = 0; i < 19; i++) { mock.timers.tick(60_000); await sync('tick'); }
  assert.equal((await getEyeState()).since, 19 * 60); assert.equal((await getEyeState()).due, false);
  mock.timers.tick(60_000); await sync('tick');
  assert.equal((await getEyeState()).since, 20 * 60); assert.equal((await getEyeState()).due, true, 'the break is due after the interval, on any page');
  assert.deepEqual(today().d, {}, 'and nothing about the page is kept as a site');
  chrome._tabs().length = 0; chrome._openTab('chrome://settings'); await sync('activated'); mock.timers.tick(30_000); await sync('tick');
  assert.equal((await getEyeState()).since, 20 * 60 + 30, 'a browser page counts too');
});

test('eye reminders: nothing counts while the person is away or another program has the keyboard', async () => {
  await eyeOn();
  chrome._openTab('chrome-extension://abc/src/newtab/newtab.html'); await sync('init');
  chrome.idle._state = 'idle'; mock.timers.tick(60_000); await sync('idle:idle'); const away = (await getEyeState()).since;
  mock.timers.tick(5 * 60_000); await sync('tick');
  assert.equal((await getEyeState()).since, away, 'away');
  chrome.idle._state = 'active'; chrome._window.focused = false; await sync('focus'); mock.timers.tick(5 * 60_000); await sync('tick');
  assert.equal((await getEyeState()).since, away, 'another program');
});

test('eye reminders: an excluded site, a private window, a pause and tracking switched off still count for the eyes and never for the statistics', async () => {
  await eyeOn((s) => { s.tracking.excluded = ['bank.example']; });
  chrome._openTab('https://www.bank.example/account'); await sync('init'); mock.timers.tick(30_000); await sync('tick');
  chrome._openTab('https://github.com/', { incognito: true }); await sync('activated'); mock.timers.tick(30_000); await sync('tick');
  chrome._openTab('https://github.com/x'); await chrome.storage.local.set({ pausedUntil: Date.now() + 10 * 60_000 }); await sync('pause'); mock.timers.tick(30_000); await sync('tick');
  await chrome.storage.local.remove('pausedUntil'); await updateSettings((s) => { s.tracking.enabled = false; }); chrome._openTab('https://github.com/y'); await sync('settings'); mock.timers.tick(30_000); await sync('tick');
  assert.equal((await getEyeState()).since, 120, 'four stretches of half a minute');
  assert.deepEqual(today().d, {}, 'none of them is a site in the statistics');
});

test('eye reminders off and tracking off: nothing is counted and the alarm is not kept', async () => {
  await updateSettings((s) => { s.tracking.enabled = false; s.eye.enabled = false; });
  chrome._openTab('chrome-extension://abc/src/newtab/newtab.html'); await sync('init'); mock.timers.tick(60_000); await sync('tick');
  assert.equal((await getEyeState()).since, 0); assert.equal(await chrome.alarms.get('tick'), undefined);
});

test('eye reminders: reading without touching anything still counts for three minutes, for the eyes only; then it stops', async () => {
  await eyeOn();
  chrome._openTab('https://github.com/readme'); await sync('init');
  mock.timers.tick(60_000); chrome.idle._state = 'idle'; chrome.idle._still = 60; await sync('idle:idle'); // a minute with no key and no mouse: the browser says "idle"
  assert.equal((await getEyeState()).since, 60); assert.equal(seconds('github.com'), 60);
  mock.timers.tick(30_000); chrome.idle._still = 90; await sync('tick');
  mock.timers.tick(30_000); chrome.idle._still = 120; await sync('tick');
  assert.equal((await getEyeState()).since, 120, 'the eyes are still on the page');
  assert.equal(seconds('github.com'), 60, 'the statistics keep their own rule: nobody at the keyboard, nothing counted');
  mock.timers.tick(60_000); chrome.idle._still = 180; await sync('tick'); // three minutes: that is somebody who left
  const at = (await getEyeState()).since;
  assert.equal(at, 180);
  mock.timers.tick(30_000); chrome.idle._still = 210; await sync('tick');
  assert.equal((await getEyeState()).since, at, 'and nothing after that');
  assert.equal(await chrome.alarms.get('tick'), undefined, 'the worker is not woken for nobody');
});

test('eye reminders: a locked screen is never counted, and a film counts for the eyes even when the statistics do not count sound', async () => {
  await eyeOn((s) => { s.tracking.countAudible = false; });
  chrome._openTab('https://www.youtube.com/watch', { audible: true }); await sync('init');
  chrome.idle._state = 'idle'; chrome.idle._still = 600; await sync('idle:idle'); mock.timers.tick(60_000); await sync('tick');
  assert.equal((await getEyeState()).since, 60, 'watching is screen time');
  assert.equal(seconds('youtube.com'), 0, 'the statistics follow their own setting');
  chrome.idle._state = 'locked'; await sync('idle:locked'); const locked = (await getEyeState()).since; mock.timers.tick(60_000); await sync('tick');
  assert.equal((await getEyeState()).since, locked, 'locked');
});

// A decision about a site used to be made only when a page was opened. Whoever stayed on one page (an endless feed) was never stopped by a limit, a budget,
// the start of the work hours or the end of a "continue for N minutes".
const blocked = () => chrome._callsTo('tabs.update').map(([id, props]) => ({ id, to: new URL(props.url) })).filter((r) => r.to.pathname === '/src/blocked/blocked.html');

test('a daily limit stops the site while the person is still on it, not at the next page they open', async () => {
  await updateSettings((s) => { s.blocking.limits = { 'reddit.com': 2 }; s.blocking.friction.enabled = false; s.eye.enabled = false; });
  const tab = chrome._openTab('https://www.reddit.com/r/all'); await sync('activated');
  for (let i = 0; i < 3; i++) { mock.timers.tick(30_000); await sync('tick'); }
  assert.equal(blocked().length, 0, 'a minute and a half: under the limit');
  mock.timers.tick(30_000); await sync('tick');
  assert.equal(blocked().length, 1, 'two minutes: the limit');
  assert.equal(blocked()[0].id, tab.id); assert.equal(blocked()[0].to.searchParams.get('r'), 'limit'); assert.equal(blocked()[0].to.searchParams.get('u'), 'https://www.reddit.com/r/all');
});

test('the distraction budget and the start of the work hours do the same; a pause-style site that was already open is left alone', async () => {
  await updateSettings((s) => { s.blocking.budget = { enabled: true, minutes: 1 }; s.eye.enabled = false; });
  chrome._openTab('https://www.youtube.com/feed'); await sync('activated');
  mock.timers.tick(30_000); await sync('tick');
  assert.equal(blocked().length, 0, 'the pause page is for arriving, not for being pulled out');
  mock.timers.tick(30_000); await sync('tick');
  assert.equal(blocked().at(-1).to.searchParams.get('r'), 'budget');
  chrome._calls.length = 0; chrome._tabs().length = 0;
  await updateSettings((s) => { s.blocking.budget.enabled = false; s.blocking.schedule = { ...s.blocking.schedule, enabled: true, days: [0, 1, 2, 3, 4, 5, 6], start: '10:03', end: '18:00' }; });
  chrome._openTab('https://www.youtube.com/feed'); await sync('activated');
  mock.timers.tick(60_000); await sync('tick');
  assert.equal(blocked().length, 0, '10:02: before the work hours');
  mock.timers.tick(60_000); await sync('tick');
  assert.equal(blocked().at(-1).to.searchParams.get('r'), 'schedule', '10:03: they began');
});

test('"continue for five minutes" during a session means five minutes: the site closes again when they are over', async () => {
  const { startFocus } = await import('../../src/background/focus.js');
  const { grantPass } = await import('../../src/background/blocker.js');
  await updateSettings((s) => { s.eye.enabled = false; });
  await startFocus({ minutes: 50 });
  await grantPass('youtube.com', 5);
  chrome._openTab('https://www.youtube.com/watch?v=1'); await sync('activated'); chrome._calls.length = 0;
  for (let i = 0; i < 9; i++) { mock.timers.tick(30_000); await sync('tick'); }
  assert.equal(blocked().length, 0, 'four and a half minutes: the pass holds');
  mock.timers.tick(31_000); await sync('tick');
  assert.equal(blocked().length, 1); assert.equal(blocked()[0].to.searchParams.get('r'), 'focus');
});

test('a neutral site, a site with no rule and a page that is not counted are never touched by this', async () => {
  await updateSettings((s) => { s.blocking.limits = { 'reddit.com': 1 }; s.tracking.excluded = ['bank.example']; s.eye.enabled = false; });
  chrome._openTab('https://github.com/'); await sync('activated'); for (let i = 0; i < 6; i++) { mock.timers.tick(30_000); await sync('tick'); }
  chrome._openTab('https://www.bank.example/'); await sync('activated'); for (let i = 0; i < 6; i++) { mock.timers.tick(30_000); await sync('tick'); }
  assert.equal(chrome._callsTo('tabs.update').length, 0);
});
