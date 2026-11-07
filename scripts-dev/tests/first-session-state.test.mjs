// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The state of the first session is patched, not replaced: parties acting at the same moment cannot wipe each other's fields.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeChrome } from './helpers/fake-chrome.mjs';

const chrome = installFakeChrome();
// a browser has navigator.locks (every context of the extension shares them); Node has none, so a queue with the same contract stands in
const queues = new Map();
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { request: (name, fn) => { const run = (queues.get(name) || Promise.resolve()).then(() => fn()); queues.set(name, run.catch(() => {})); return run; } } } });
const { patchObFirst } = await import('../../src/shared/first-session-state.js');
const get = async () => (await chrome.storage.local.get('obFirst')).obFirst;

test('a patch merges into what is stored, and nothing is created from nothing', async () => {
  await chrome.storage.local.clear();
  assert.equal(await patchObFirst({ stopped: true }), null);
  assert.equal(await get(), undefined, 'no first session: nothing written');
  await chrome.storage.local.set({ obFirst: { at: 5, stage: 'run', sid: 'a' } });
  await patchObFirst({ seen: true });
  assert.deepEqual(await get(), { at: 5, stage: 'run', sid: 'a', seen: true });
});

test('parties writing at once keep each other\'s fields (the page, the worker and another tab)', async () => {
  await chrome.storage.local.clear();
  await chrome.storage.local.set({ obFirst: { at: 5, stage: 'run', sid: 'a' } });
  await Promise.all([patchObFirst({ seen: true, endsAt: 99 }), patchObFirst({ stopped: true }), patchObFirst({ blocksEnd: 4 }), patchObFirst({ coachSeen: true })]);
  assert.deepEqual(await get(), { at: 5, stage: 'run', sid: 'a', seen: true, endsAt: 99, stopped: true, blocksEnd: 4, coachSeen: true });
});
