// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Eye breaks and focus sessions in the service worker, against a pretend browser: the notifications, the alarms, what is stored.
import test, { mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeChrome } from './helpers/fake-chrome.mjs';

const chrome = installFakeChrome();
const breaks = await import('../../src/background/breaks.js');
const focus = await import('../../src/background/focus.js');
const { updateSettings, getSettings, getRaw } = await import('../../src/shared/storage.js');
const { onActiveTime } = breaks;

const start = new Date(2026, 10, 4, 10, 0, 0).getTime();
const day = () => chrome.storage.local._all()['d:2026-11-04'] || {};
const settle = (ms = 80) => new Promise((r) => setTimeout(r, ms)); // the alarm handlers of the worker start their work and do not return it
const notes = () => chrome._callsTo('notifications.create').map(([id]) => id);

beforeEach(async () => {
  mock.timers.reset(); mock.timers.enable({ apis: ['Date'], now: start });
  await chrome.storage.local.clear(); await chrome.storage.session.clear(); await chrome.alarms.clearAll();
  chrome._tabs().length = 0; chrome._calls.length = 0; chrome.windows._extra().length = 0; chrome.windows._refuse = null;
});

const eyeState = async () => (await chrome.storage.session.get('eye')).eye;
const wins = () => chrome._callsTo('windows.create').map(([p]) => p);
const browsing = (url = 'https://github.com/') => { chrome._tabs().length = 0; chrome._openTab(url); };

test('eye break: when the time is up it takes the whole screen by itself, once, in a window of its own; no notification is needed', async () => {
  await updateSettings((s) => { s.eye.enabled = true; s.eye.intervalMin = 20; });
  browsing();
  await onActiveTime(19 * 60, Date.now());
  assert.deepEqual(wins(), [], 'not yet');
  await onActiveTime(60, Date.now());
  assert.equal(wins().length, 1);
  assert.deepEqual({ type: wins()[0].type, state: wins()[0].state, focused: wins()[0].focused }, { type: 'popup', state: 'fullscreen', focused: true });
  assert.match(wins()[0].url, /\/src\/break\/break\.html\?auto=1$/);
  assert.deepEqual(notes(), [], 'the break itself is on the screen');
  await onActiveTime(30, Date.now()); await onActiveTime(30, Date.now());
  assert.equal(wins().length, 1, 'while it is on the screen it is not opened again');
  assert.equal((await eyeState()).due, true);
});

test('eye break: it waits while another program has the keyboard, a film is on the whole screen or a call is on, and comes as soon as that is over', async () => {
  await updateSettings((s) => { s.eye.enabled = true; s.eye.intervalMin = 20; });
  browsing();
  chrome._window.focused = false; await onActiveTime(20 * 60, Date.now());
  assert.deepEqual(wins(), []); assert.deepEqual(notes(), [], 'somebody working in another program is not interrupted, not even with a note');
  chrome._window.focused = true; chrome._window.state = 'fullscreen'; await onActiveTime(30, Date.now());
  assert.deepEqual(wins(), [], 'a film on the whole screen is not covered'); assert.deepEqual(notes(), ['eye-break'], 'a notification says it instead');
  await onActiveTime(30, Date.now()); assert.deepEqual(notes(), ['eye-break'], 'once');
  chrome._window.state = 'normal'; browsing('https://meet.google.com/abc-defg-hij'); await onActiveTime(30, Date.now());
  assert.deepEqual(wins(), [], 'nor a call');
  browsing(); await onActiveTime(30, Date.now());
  assert.equal(wins().length, 1, 'back on an ordinary page: now');
  chrome._window.state = 'normal';
});

test('eye break: closing its window without an answer is "in five minutes"; an answered break leaves nothing behind', async () => {
  await updateSettings((s) => { s.eye.enabled = true; s.eye.intervalMin = 20; });
  browsing(); await onActiveTime(20 * 60, Date.now());
  const id = (await eyeState()).win; assert.ok(id);
  chrome.windows._close(id); await settle();
  assert.deepEqual({ since: (await eyeState()).since, due: (await eyeState()).due, win: (await eyeState()).win }, { since: 15 * 60, due: false, win: 0 });
  browsing(); await onActiveTime(5 * 60, Date.now());
  assert.equal(wins().length, 2, 'five minutes of screen time later it is back');
  const second = (await eyeState()).win;
  await breaks.completeBreak();
  chrome.windows._close(second); await settle();
  assert.deepEqual({ since: (await eyeState()).since, due: (await eyeState()).due }, { since: 0, due: false }, 'the window that closes itself after the break changes nothing');
  assert.equal(day().b, 1);
});

test('eye break: a window the worker never heard closing does not keep the break "on the screen" for ever', async () => {
  await updateSettings((s) => { s.eye.enabled = true; s.eye.intervalMin = 20; });
  browsing(); await onActiveTime(20 * 60, Date.now());
  chrome.windows._extra().length = 0; // gone, and no event reached the worker
  browsing(); await onActiveTime(30, Date.now());
  assert.equal((await eyeState()).win, 0); assert.equal((await eyeState()).due, false);
  await onActiveTime(5 * 60, Date.now());
  assert.equal(wins().length, 2);
});

test('eye break: a browser that cannot open such a window gets a smaller one, then a tab, then at least the notification', async () => {
  await updateSettings((s) => { s.eye.enabled = true; s.eye.intervalMin = 20; });
  browsing(); chrome.windows._refuse = ['fullscreen'];
  await onActiveTime(20 * 60, Date.now());
  assert.deepEqual(wins().map((w) => [w.type, w.state]), [['popup', 'fullscreen'], ['popup', 'maximized']]); assert.ok((await eyeState()).win);
  await breaks.skipBreak(); chrome.windows._extra().length = 0; chrome._calls.length = 0;
  browsing(); chrome.windows._refuse = ['fullscreen', 'maximized']; // every kind of window refused
  await onActiveTime(20 * 60, Date.now());
  assert.match(chrome._callsTo('tabs.create')[0][0].url, /break\.html\?auto=1$/); assert.ok((await eyeState()).tab, 'a tab is remembered the same way');
  const tabId = (await eyeState()).tab; chrome.tabs.onRemoved.fire(tabId); await settle();
  assert.equal((await eyeState()).since, 15 * 60, 'and closing it is "in five minutes" too');
});

test('eye break, notification only: one when it comes due and one more for every further interval without a break, never a stream', async () => {
  await updateSettings((s) => { s.eye.enabled = true; s.eye.intervalMin = 20; s.eye.fullscreen = false; s.eye.notify = true; });
  browsing();
  await onActiveTime(19 * 60, Date.now());
  assert.deepEqual(notes(), [], 'not yet');
  await onActiveTime(60, Date.now());
  assert.deepEqual(notes(), ['eye-break']); assert.deepEqual(wins(), [], 'the screen is left alone');
  for (let i = 0; i < 19; i++) await onActiveTime(60, Date.now());
  assert.deepEqual(notes(), ['eye-break'], 'not nagged in between');
  await onActiveTime(60, Date.now());
  assert.deepEqual(notes(), ['eye-break', 'eye-break'], 'forty minutes without a break: said once more');
  assert.equal((await eyeState()).due, true);
});

test('eye break: a notification the browser refuses loses neither the count nor the next reminder (it used to freeze the countdown for good)', async () => {
  await updateSettings((s) => { s.eye.enabled = true; s.eye.intervalMin = 20; s.eye.fullscreen = false; s.eye.notify = true; });
  const create = chrome.notifications.create; chrome.notifications.create = async () => { throw new Error('Unable to download all specified images.'); };
  try {
    await onActiveTime(19 * 60 + 30, Date.now()); await onActiveTime(30, Date.now()); await onActiveTime(30, Date.now());
    assert.equal((await eyeState()).since, 20 * 60 + 30, 'every second is kept');
    assert.equal((await eyeState()).due, true);
  } finally { chrome.notifications.create = create; }
});

test('every notification of the worker carries an icon the browser can load from where the worker lives', async () => {
  const { notify, notifyIcon } = await import('../../src/background/notify.js');
  assert.equal(await notify('probe', { title: 'a', message: 'b' }), true);
  assert.match(notifyIcon(), /^chrome-extension:\/\/[^/]+\/icons\/icon128\.png$/);
  // the address the worker used to give: read against src/background/, where there is no such file, so Chrome refused the whole notification
  await assert.rejects(chrome.notifications.create('old', { type: 'basic', iconUrl: 'icons/icon128.png', title: 'a', message: 'b' }), /Unable to download/);
  assert.equal(await notify('probe2', { title: 'a', message: 'b', buttons: [{ title: 'x' }] }), true);
});

test('eye break: a film watched for twenty minutes without touching anything is not "five minutes away": the break stays due', async () => {
  await updateSettings((s) => { s.eye.enabled = true; s.eye.intervalMin = 20; s.eye.fullscreen = false; s.eye.notify = false; });
  chrome.idle.onStateChanged.fire('idle'); await settle();
  for (let i = 0; i < 20; i++) { mock.timers.tick(60_000); await onActiveTime(60, Date.now(), { watching: true }); }
  assert.equal((await eyeState()).due, true);
  chrome.idle.onStateChanged.fire('active'); await settle();
  assert.equal((await eyeState()).due, true, 'moving the mouse after the film does not wipe the break');
  assert.equal((await eyeState()).since, 20 * 60);
  // and somebody who really was away for five minutes has rested
  chrome.idle.onStateChanged.fire('idle'); await settle(); mock.timers.tick(5 * 60_000); chrome.idle.onStateChanged.fire('active'); await settle();
  assert.deepEqual({ since: (await eyeState()).since, due: (await eyeState()).due }, { since: 0, due: false });
});

test('eye break: taking it counts it and starts a fresh interval; skipping starts a fresh interval without counting', async () => {
  await updateSettings((s) => { s.eye.enabled = true; s.eye.intervalMin = 20; s.eye.fullscreen = false; });
  await onActiveTime(21 * 60, Date.now());
  await breaks.completeBreak();
  assert.equal(day().b, 1);
  assert.equal((await chrome.storage.session.get('eye')).eye.since, 0);
  await onActiveTime(21 * 60, Date.now()); await breaks.skipBreak();
  assert.equal(day().b, 1, 'a skipped break is not a break');
  assert.equal((await chrome.storage.session.get('eye')).eye.due, false);
});

test('eye break: switched off, nothing is counted and nothing is shown', async () => {
  await updateSettings((s) => { s.eye.enabled = false; });
  await onActiveTime(3 * 3600, Date.now());
  assert.deepEqual(notes(), []);
});

test('eye break: snooze brings the next reminder in about five minutes', async () => {
  await updateSettings((s) => { s.eye.enabled = true; s.eye.intervalMin = 20; });
  await onActiveTime(21 * 60, Date.now());
  await breaks.snoozeBreak();
  const { eye } = await chrome.storage.session.get('eye');
  assert.equal(eye.since, 15 * 60); assert.equal(eye.due, false);
});

test('a focus session: starts with an end alarm, ends by itself with a note, a log entry and a rest, and the day counts it', async () => {
  const s = await focus.startFocus({ minutes: 25, goal: 'Write the report' });
  assert.equal(s.minutes, 25);
  assert.equal((await getRaw('focus')).focus.goal, 'Write the report');
  const alarm = await chrome.alarms.get('focus-end');
  assert.equal(alarm.when, start + 25 * 60_000);
  mock.timers.tick(25 * 60_000);
  await chrome._fireAlarm('focus-end'); await settle(); // the alarm is what ends a session in the real worker
  assert.equal((await getRaw('focus')).focus, null);
  assert.equal(day().fs, 25 * 60); assert.equal(day().fc, 1);
  assert.equal(day().ss.length, 1); assert.equal(day().ss[0].g, 'Write the report');
  assert.ok(notes().includes('focus-done'));
  assert.ok(await chrome.alarms.get('rest-end'), 'a rest follows');
});

test('a focus session stopped early is credited for the time that passed, and one under the minimum is not', async () => {
  await focus.startFocus({ minutes: 25 });
  mock.timers.tick(10 * 60_000); await focus.stopFocus();
  assert.equal(day().fs, 600); assert.equal(day().fc, 0, 'it was not finished, so it is not a finished session');
  assert.equal(await chrome.alarms.get('focus-end'), undefined);
  await focus.startFocus({ minutes: 25 });
  mock.timers.tick(5_000); await focus.stopFocus();
  assert.equal(day().fs, 600, 'five seconds are not a session');
});

test('a second session cannot be started on top of the first, and extending is capped', async () => {
  await focus.startFocus({ minutes: 25 });
  const again = await focus.startFocus({ minutes: 10 });
  assert.equal(again.ok, false); assert.equal(again.error, 'active');
  assert.deepEqual(await focus.extendFocus(5), { ok: true });
  assert.equal((await getRaw('focus')).focus.minutes, 30);
  assert.equal((await focus.extendFocus(9999)).ok, true, 'one extension is at most an hour');
  const m = (await getRaw('focus')).focus.minutes;
  assert.ok(m <= 25 + 5 + 60);
});

test('pause stops the clock and the blocking; resume moves the end by the pause; a strict session cannot be paused', async () => {
  await focus.startFocus({ minutes: 25 });
  mock.timers.tick(5 * 60_000);
  assert.deepEqual(await focus.pauseFocus(), { ok: true });
  assert.ok(await chrome.alarms.get('focus-resume'), 'a pause that is forgotten ends by itself');
  mock.timers.tick(3 * 60_000);
  assert.deepEqual(await focus.resumeFocus(), { ok: true });
  const f = (await getRaw('focus')).focus;
  assert.equal(f.endsAt, start + 25 * 60_000 + 3 * 60_000, 'the end moved by the three minutes of the pause');
  await focus.stopFocus();
  await focus.startFocus({ minutes: 25, strict: true });
  assert.equal((await focus.pauseFocus()).error, 'strict');
});

test('the first session of the onboarding ends without a question beside its own dialog, stopped early or finished; any other session is asked about', async () => {
  await updateSettings((s) => { s.focus.review = true; });
  const first = await focus.startFocus({ minutes: 25, remember: false });
  assert.equal((await getRaw('focus')).focus.id, first.id, 'the session answers with its id');
  assert.equal((await getRaw('settings')).settings.focus.minutes, 25, 'and the first session did not change the usual length');
  await chrome.storage.local.set({ obFirst: { at: Date.now(), stage: 'run', sid: first.id, minutes: 5 } });
  mock.timers.tick(10 * 60_000); await focus.stopFocus();
  assert.equal((await getRaw('review')).review ?? null, null, 'stopped early after ten minutes: no "how did it go?"');
  await chrome.storage.local.set({ obFirst: { at: Date.now(), stage: 'run', sid: 'some-other-session', minutes: 5 } });
  await focus.startFocus({ minutes: 25 });
  mock.timers.tick(10 * 60_000); await focus.stopFocus();
  assert.ok((await getRaw('review')).review, 'a session that is not the first one is asked about, whatever the state of the onboarding');
});

test('the first session: stopped, the worker marks it before it clears the session (an open new tab cannot talk it out of the answer), and no question is put up', async () => {
  await updateSettings((s) => { s.focus.review = true; });
  const first = await focus.startFocus({ minutes: 25, remember: false });
  await chrome.storage.local.set({ obFirst: { at: Date.now(), stage: 'run', sid: first.id, minutes: 25 } });
  // the new tab: the moment `focus` is cleared it closes the matter (stage 'closed'), as the real page does
  let racing = true;
  chrome.storage.onChanged.addListener(async (changes) => {
    if (racing && 'focus' in changes && !changes.focus.newValue) { const { obFirst } = await getRaw('obFirst'); await chrome.storage.local.set({ obFirst: { ...obFirst, stage: 'closed' } }); }
  });
  mock.timers.tick(10 * 60_000); await focus.stopFocus(); await settle(120); racing = false;
  assert.equal((await getRaw('obFirst')).obFirst.stopped, true, 'marked as a stop');
  assert.equal((await getRaw('review')).review ?? null, null, 'no "how did it go?" for the first session, whatever the tab did meanwhile');
});

test('the first session, finished: the count of held pages is taken at its end; and a try of five minutes does not turn the usual length into five', async () => {
  const first = await focus.startFocus({ minutes: 5, remember: false });
  assert.equal((await getSettings()).focus.minutes, 25, 'five minutes asked without remembering: the usual twenty-five stays');
  await chrome.storage.local.set({ obFirst: { at: Date.now(), stage: 'run', sid: first.id, minutes: 5, blocks0: 0 }, usage: { v: 1, base: 1, days: [1], first: {}, total: { block_page: 3 }, period: {} } });
  mock.timers.tick(5 * 60_000 + 1000); await focus.finishFocus();
  assert.equal((await getRaw('obFirst')).obFirst.blocksEnd, 3, 'the count at the end of the session');
  await focus.startFocus({ minutes: 5 });
  assert.equal((await getSettings()).focus.minutes, 5, 'while a session the person chose, with remembering, does change it');
});

// Two things that can end a session arrive together: the alarm at its end, and the worker's own start-up (the alarm woke a sleeping worker, which looked at the clock too).
// Both read the same session and both ended it: two entries in the log, twice the minutes, a streak of two. Likewise for a double click on "Stop".
test('a session that is ended by two callers at once is counted once, and stopped twice is credited once', async () => {
  await focus.startFocus({ minutes: 25, goal: 'report' });
  mock.timers.tick(25 * 60_000 + 500);
  await Promise.all([focus.finishFocus(), focus.finishFocus()]);
  assert.equal(day().fc, 1, 'one finished session'); assert.equal(day().fs, 25 * 60, 'one session of minutes');
  assert.equal((day().ss || day().s || []).length || 1, 1);
  await chrome.storage.local.clear(); await chrome.alarms.clearAll();
  await focus.startFocus({ minutes: 25 });
  mock.timers.tick(10 * 60_000);
  await Promise.all([focus.stopFocus(), focus.stopFocus()]);
  assert.equal(day().fs, 10 * 60, 'ten minutes, once');
  assert.equal((await getRaw('focus')).focus, null);
});

test('the pause, the +5 and the end cannot run into one another either: a session extended at the moment it ends is either extended or over, never both', async () => {
  await focus.startFocus({ minutes: 25 });
  mock.timers.tick(25 * 60_000 - 200);
  const [ext, fin] = await Promise.all([focus.extendFocus(5), (async () => { mock.timers.tick(400); return focus.finishFocus(); })()]);
  const { focus: left } = await getRaw('focus');
  if (left) { assert.equal(ext.ok, true); assert.equal(day().fc || 0, 0, 'extended: not counted as finished'); }
  else { assert.equal(day().fc, 1, 'over: counted once'); }
  void fin;
});
