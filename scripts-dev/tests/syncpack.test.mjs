import test from 'node:test';
import assert from 'node:assert/strict';
import { pack, unpack, staleKeys, decide, CHUNK_CHARS, MAX_CHUNKS } from '../../src/shared/syncpack.js';

test('pack/unpack round-trips and splits into small chunks', () => {
  const settings = { language: 'ru', onboarded: true, appearance: { customCss: 'ж'.repeat(9000) }, focus: { minutes: 25 } };
  const p = pack(settings, 123);
  assert.ok(p.count >= 3);
  for (const [k, v] of Object.entries(p.items)) if (k !== 'sync:meta') assert.ok(v.length <= CHUNK_CHARS);
  const back = unpack(p.items);
  assert.equal(back.ts, 123); assert.equal(back.settings.appearance.customCss.length, 9000); assert.equal(back.settings.focus.minutes, 25);
  assert.equal(back.settings.onboarded, undefined); // device-specific
});

test('too large settings are refused, corrupt data is ignored', () => {
  assert.equal(pack({ x: 'a'.repeat(CHUNK_CHARS * MAX_CHUNKS) }, 1), null);
  const p = pack({ a: 'b'.repeat(8000) }, 1);
  delete p.items['sync:1'];
  assert.equal(unpack(p.items), null);
  assert.equal(unpack({}), null);
});

test('stale chunks and decisions', () => {
  assert.deepEqual(staleKeys({ 'sync:meta': {}, 'sync:0': 'a', 'sync:1': 'b', 'sync:2': 'c' }, 2), ['sync:2']);
  assert.equal(decide(1, 2), 'pull'); assert.equal(decide(3, 2), 'push'); assert.equal(decide(2, 2), 'none');
});

test('companion token never syncs; surrogate pairs survive chunk boundaries', async () => {
  const { forSync } = await import('../../src/shared/syncpack.js');
  assert.equal(forSync({ companion: { enabled: true, token: 'secret' }, a: 1 }).companion, undefined);
  for (let pad = 0; pad < 4; pad++) {
    const settings = { x: 'a'.repeat(CHUNK_CHARS - 12 + pad) + '😀'.repeat(10) };
    const back = unpack(pack(settings, 1).items);
    assert.equal(back.settings.x, settings.x);
  }
});
