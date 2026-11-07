// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// What the new tab does about the first session: the odd moments (above all: the tab is open as the session ends).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstSessionPlan as plan, sessionSince, isFirstSession, GRACE_MS, SETTLE_MS } from '../../src/shared/first-session-plan.js';

const T0 = 1_000_000_000_000, END = T0 + 5 * 60_000;
const ob = (o = {}) => ({ stage: 'run', at: T0, seen: true, endsAt: END, ...o });
const ses = { t: T0 + 1000, c: 1, m: 5 };

test('nothing to do without a first session, or once it is closed', () => {
  assert.equal(plan({ obFirst: null, live: false, ses: null, now: END }), 'none');
  assert.equal(plan({ obFirst: ob({ stage: 'closed' }), live: false, ses, now: END }), 'none');
});

test('while it runs: the coach', () => {
  assert.equal(plan({ obFirst: ob({ seen: false, endsAt: undefined }), live: true, ses: null, now: T0 + 1000 }), 'coach');
});

test('the tab is open as the session ends: the record is not there yet, so wait; then celebrate (the bug of 3.9.0: it closed for good)', () => {
  assert.equal(plan({ obFirst: ob(), live: false, ses: null, now: END + 200 }), 'wait');
  assert.equal(plan({ obFirst: ob(), live: false, ses: null, now: END + SETTLE_MS - 1 }), 'wait');
  assert.equal(plan({ obFirst: ob(), live: false, ses, now: END + 400 }), 'celebrate');
});

test('a record that never comes closes the matter, after a while', () => {
  assert.equal(plan({ obFirst: ob(), live: false, ses: null, now: END + SETTLE_MS + 1 }), 'close');
});

test('stopped early: closed at once, no celebration for nothing', () => {
  assert.equal(plan({ obFirst: ob(), live: false, ses: null, now: T0 + 60_000 }), 'close');
});

test('a session that ended while the browser was closed is celebrated when the tab opens, if the record is there', () => {
  assert.equal(plan({ obFirst: ob(), live: false, ses, now: END + 3 * 3_600_000 }), 'celebrate');
  assert.equal(plan({ obFirst: ob(), live: false, ses: null, now: END + 3 * 3_600_000 }), 'close');
});

test('never seen running: the start may still be on its way, for a minute', () => {
  const o = ob({ seen: false, endsAt: undefined });
  assert.equal(plan({ obFirst: o, live: false, ses: null, now: T0 + 5_000 }), 'wait');
  assert.equal(plan({ obFirst: o, live: false, ses: null, now: T0 + GRACE_MS + 1 }), 'close');
});

test('"done" shows the dialog again until it is closed (a reload with the dialog open)', () => {
  assert.equal(plan({ obFirst: ob({ stage: 'done' }), live: false, ses: null, now: END + 99_999_999 }), 'celebrate');
});

test('sessionSince takes the first finished session, with a few seconds of slack, and not a stopped one', () => {
  const days = [['d:1', { ss: [{ t: T0 - 4000, c: 1, m: 5 }, { t: T0 + 10, c: 0, m: 2 }] }], ['d:2', { ss: [{ t: T0 - 60_000, c: 1 }] }]];
  assert.equal(sessionSince(days, T0).t, T0 - 4000);
  assert.equal(sessionSince([['d:1', { ss: [{ t: T0 + 10, c: 0 }] }]], T0), null);
});

test('a second session is not taken for the first', () => {
  const o = ob({ sid: 'one' });
  assert.equal(plan({ obFirst: o, live: true, ses: null, now: T0 + 1000, focusId: 'one' }), 'coach', 'its own session: the coach');
  assert.equal(plan({ obFirst: o, live: true, ses: null, now: END + 5_000, focusId: 'two' }), 'close', 'another one is running: the matter is closed, no coach of the first during the second');
  assert.equal(plan({ obFirst: ob({ sid: 'one', stage: 'done' }), live: true, ses: null, now: END + 5_000, focusId: 'two' }), 'close', 'an open dialog is not brought back in the middle of the second session');
  assert.equal(plan({ obFirst: ob({ stage: 'run' }), live: true, ses: null, now: T0 + 1000, focusId: 'two' }), 'coach', 'without a stored id (a state made before ids) any session counts');
  const days = [['d:1', { ss: [{ id: 'one', t: T0 + 10, c: 1, m: 5 }, { id: 'two', t: T0 + 400_000, c: 1, m: 25 }] }]];
  assert.equal(sessionSince(days, T0, 'two').m, 25, 'with the id, that session and no other');
  assert.equal(sessionSince(days, T0, 'one').m, 5);
  assert.equal(sessionSince(days, T0, '').m, 5, 'without it, the first that finished');
  assert.equal(sessionSince(days, T0, 'nope'), null);
  assert.equal(isFirstSession(ob({ sid: 'one' }), { id: 'one' }), true); assert.equal(isFirstSession(ob({ sid: 'one' }), { id: 'two' }), false);
  assert.equal(isFirstSession(ob({ stage: 'closed', sid: 'one' }), { id: 'one' }), false); assert.equal(isFirstSession(null, { id: 'one' }), false);
});
