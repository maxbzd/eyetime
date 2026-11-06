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
  chrome._tabs().length = 0; chrome._calls.length = 0;
  chrome.idle._state = 'active'; chrome._window.focused = true;
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
