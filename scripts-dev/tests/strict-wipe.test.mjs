// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// A strict session has no early exit: restoring a backup or resetting everything wipes the storage the session lives in, so both wait until it is over.
import test, { mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeChrome } from './helpers/fake-chrome.mjs';

const chrome = installFakeChrome();
const focus = await import('../../src/background/focus.js');
const { importAll, resetAll, getRaw, strictSessionRunning } = await import('../../src/shared/storage.js');

const start = new Date(2026, 10, 4, 10, 0, 0).getTime();
const backup = { app: 'eyetime', version: 2, data: { settings: { focus: { minutes: 40 } }, meta: { schemaVersion: 3 }, tasks: [{ id: 'a', text: 'x' }] } };

beforeEach(async () => {
  mock.timers.reset(); mock.timers.enable({ apis: ['Date'], now: start });
  await chrome.storage.local.clear(); await chrome.storage.session.clear(); await chrome.alarms.clearAll();
});

test('during a strict session a restore and a reset are refused and the session stays', async () => {
  await focus.startFocus({ minutes: 25, strict: true });
  assert.equal(await strictSessionRunning(), true);
  await assert.rejects(() => importAll(backup), /strict/);
  await assert.rejects(() => resetAll(), /strict/);
  const { focus: f } = await getRaw('focus');
  assert.ok(f && f.strict && f.endsAt > Date.now(), 'the session is still there, with its lock');
  mock.timers.setTime(start + 26 * 60_000); // the session is over: both are allowed again
  assert.equal(await strictSessionRunning(), false);
  await importAll(backup);
  await resetAll();
});

test('an ordinary session does not hold the data hostage', async () => {
  await focus.startFocus({ minutes: 25, strict: false });
  assert.equal(await strictSessionRunning(), false);
  await importAll(backup);
  assert.equal((await getRaw('focus')).focus ?? null, null, 'the restore replaced everything, the session included');
});
