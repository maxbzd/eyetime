// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The toolbar badge is set only when it changes: the tracker asks twice a minute, and every setting is a message to the browser.
import test, { mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeChrome } from './helpers/fake-chrome.mjs';

const chrome = installFakeChrome();
const { updateBadge } = await import('../../src/background/badge.js');
const { getSettings, setRaw } = await import('../../src/shared/storage.js');
const focus = await import('../../src/background/focus.js');

const start = new Date(2026, 10, 4, 10, 0, 0).getTime();
const calls = () => chrome._calls.filter(([n]) => String(n).startsWith('action.')).length;

beforeEach(async () => {
  mock.timers.reset(); mock.timers.enable({ apis: ['Date'], now: start });
  await chrome.storage.local.clear(); await chrome.storage.session.clear(); await chrome.alarms.clearAll();
  chrome._calls.length = 0;
});

test('the same badge twice is one set of calls; a change sets again', async () => {
  const s = await getSettings();
  await updateBadge(s); const first = calls();
  assert.ok(first >= 3, 'the first call sets the badge');
  await updateBadge(s); await updateBadge(s);
  assert.equal(calls(), first, 'nothing changed: nothing is sent');
  await setRaw({ ['d:2026-11-04']: { d: { 'a.com': 600 } } });
  await updateBadge(s);
  assert.ok(calls() > first, 'ten minutes on the day: the badge changes');
  const before = calls();
  await focus.startFocus({ minutes: 25 });
  await updateBadge(s);
  assert.ok(calls() > before, 'a session changes the badge to its countdown');
});
