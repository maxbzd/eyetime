// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// A damaged profile must not stop EyeTime from starting: `meta` and `settings` both unreadable is repaired to a working state, never thrown at the person.
import test from 'node:test';
import assert from 'node:assert/strict';

let mem = {};
const pick = (keys) => (keys == null ? { ...mem } : Object.fromEntries([].concat(keys).filter((k) => k in mem).map((k) => [k, structuredClone(mem[k])])));
globalThis.chrome = { storage: { local: { get: async (k) => pick(k), set: async (o) => { Object.assign(mem, structuredClone(o)); }, clear: async () => { mem = {}; }, remove: async (k) => { for (const x of [].concat(k)) delete mem[x]; } }, onChanged: { addListener() {}, removeListener() {} } }, runtime: { getManifest: () => ({ version: '3.8.1' }) } };
const { ensureSchema, getSettings } = await import('../../src/shared/storage.js');

for (const [name, data] of [['meta and settings are both garbage', { meta: 'x', settings: 42 }], ['meta is an array and settings is null', { meta: [], settings: null }], ['settings is a string, meta is missing', { settings: 'broken' }], ['only an old-style key is left', { tasks: [{ id: 'a', text: 'keep me', done: false }] }]]) {
  test(`schema: ${name} → EyeTime starts, with usable settings`, async () => {
    mem = structuredClone(data);
    await assert.doesNotReject(ensureSchema());
    const s = await getSettings();
    assert.ok(s && typeof s === 'object' && s.focus && s.blocking && s.appearance, 'settings have their parts');
    assert.ok(Number.isFinite(s.focus.minutes));
  });
}

test('schema: damaged data does not lose the tasks that can still be read', async () => {
  mem = { meta: 'x', settings: 42, tasks: [{ id: 'a', text: 'keep me', done: false }] };
  await ensureSchema();
  assert.ok(JSON.stringify(mem.tasks || []).includes('keep me'));
});
