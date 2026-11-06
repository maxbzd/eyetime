// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Eye breaks and focus sessions in the service worker, against a pretend browser: the notifications, the alarms, what is stored.
import test, { mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeChrome } from './helpers/fake-chrome.mjs';

const chrome = installFakeChrome();
const breaks = await import('../../src/background/breaks.js');
const focus = await import('../../src/background/focus.js');
const { updateSettings, getRaw } = await import('../../src/shared/storage.js');
const { onActiveTime } = breaks;

const start = new Date(2026, 10, 4, 10, 0, 0).getTime();
const day = () => chrome.storage.local._all()['d:2026-11-04'] || {};
const settle = (ms = 80) => new Promise((r) => setTimeout(r, ms)); // the alarm handlers of the worker start their work and do not return it
const notes = () => chrome._callsTo('notifications.create').map(([id]) => id);

beforeEach(async () => {
  mock.timers.reset(); mock.timers.enable({ apis: ['Date'], now: start });
  await chrome.storage.local.clear(); await chrome.storage.session.clear(); await chrome.alarms.clearAll();
  chrome._tabs().length = 0; chrome._calls.length = 0;
});

test('eye break: due after the interval of active time, one notification, and the person is not nagged again', async () => {
  await updateSettings((s) => { s.eye.enabled = true; s.eye.intervalMin = 20; s.eye.notify = true; });
  await onActiveTime(19 * 60, Date.now());
  assert.deepEqual(notes(), [], 'not yet');
  await onActiveTime(60, Date.now());
  assert.deepEqual(notes(), ['eye-break']);
  await onActiveTime(5 * 60, Date.now());
  assert.deepEqual(notes(), ['eye-break'], 'once until the break is taken or skipped');
  const state = (await chrome.storage.session.get('eye')).eye;
  assert.equal(state.due, true);
});

test('eye break: taking it counts it and starts a fresh interval; skipping starts a fresh interval without counting', async () => {
  await updateSettings((s) => { s.eye.enabled = true; s.eye.intervalMin = 20; });
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
