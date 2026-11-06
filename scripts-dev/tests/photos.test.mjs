// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
import test from 'node:test';
import assert from 'node:assert/strict';
import { makePhotos, PHOTO_KINDS, REV_KEY } from '../../src/shared/photos.js';

const mapBackend = () => { const m = new Map(); return { m, get: async (k) => m.get(k), set: async (k, v) => { m.set(k, v); }, del: async (ks) => { ks.forEach((k) => m.delete(k)); }, clear: async () => m.clear() }; };
const fakeLocal = (data = {}) => ({ data, async get(keys) { return Object.fromEntries([].concat(keys).filter((k) => k in data).map((k) => [k, data[k]])); }, async set(o) { Object.assign(data, o); }, async remove(keys) { for (const k of [].concat(keys)) delete data[k]; } });

test('photos: a photo is stored and read back, one kind never shows another, and nothing is in chrome.storage', async () => {
  const be = mapBackend(), local = fakeLocal(), p = makePhotos(be, local);
  assert.equal(await p.getPhoto('bg'), null);
  await p.setPhoto('bg', 'data:image/jpeg;base64,AAAA'); await p.setPhoto('fg', 'data:image/png;base64,BBBB'); await p.setPhoto('depth', { key: 'k', png: 'data:image/png;base64,CCCC' });
  assert.equal(await p.getPhoto('bg'), 'data:image/jpeg;base64,AAAA'); assert.equal(await p.getPhoto('fg'), 'data:image/png;base64,BBBB'); assert.deepEqual(await p.getPhoto('depth'), { key: 'k', png: 'data:image/png;base64,CCCC' });
  assert.deepEqual(Object.keys(local.data), [REV_KEY], 'only the revision counter is in the storage that every page hears about');
  assert.deepEqual(await p.getPhotos(['bg', 'fg']), { bg: 'data:image/jpeg;base64,AAAA', fg: 'data:image/png;base64,BBBB' });
});

test('photos: every write bumps the revision that pages listen to', async () => {
  const local = fakeLocal(), p = makePhotos(mapBackend(), local);
  await p.setPhoto('bg', 'x'); const a = local.data[REV_KEY];
  await new Promise((r) => setTimeout(r, 5)); await p.removePhotos(['bg']); const b = local.data[REV_KEY];
  assert.ok(b > a, 'removing is a change too');
});

test('photos: a photo left in chrome.storage.local by an earlier version is moved the first time it is read, not copied, and not lost', async () => {
  const be = mapBackend(), local = fakeLocal({ newtabBg: 'old-bg', newtabFg: 'old-fg', newtabDepth: { key: 'k', png: 'p' }, settings: { keep: 1 } }), p = makePhotos(be, local);
  assert.equal(await p.getPhoto('bg'), 'old-bg');
  assert.equal('newtabBg' in local.data, false, 'the storage gets its room back'); assert.equal(be.m.get('bg'), 'old-bg');
  assert.equal(await p.getPhoto('bg'), 'old-bg', 'and it is still there on the next read');
  assert.deepEqual(await p.getPhotos(['fg', 'depth']), { fg: 'old-fg', depth: { key: 'k', png: 'p' } });
  assert.deepEqual(local.data.settings, { keep: 1 }, 'nothing else is touched');
});

test('photos: removing takes the photo from both places, and an unknown kind is an error, not a silent no-op', async () => {
  const be = mapBackend(), local = fakeLocal({ newtabFg: 'legacy' }), p = makePhotos(be, local);
  await p.setPhoto('fg', 'new'); await p.removePhotos(['fg']);
  assert.equal(await p.getPhoto('fg'), null); assert.equal('newtabFg' in local.data, false);
  await assert.rejects(p.getPhoto('nope'), /unknown photo kind/); await assert.rejects(p.setPhoto('newtabBg', 'x'), /unknown photo kind/); await assert.rejects(p.removePhotos(['bg', 'zzz']), /unknown photo kind/);
  assert.deepEqual(PHOTO_KINDS, ['bg', 'fg', 'depth']);
});

test('photos: clearing removes everything, the legacy keys too', async () => {
  const be = mapBackend(), local = fakeLocal({ newtabBg: 'a', newtabDepth: 'b' }), p = makePhotos(be, local);
  await p.setPhoto('fg', 'c'); await p.clearPhotos();
  assert.equal(be.m.size, 0); assert.equal('newtabBg' in local.data || 'newtabDepth' in local.data, false);
});
