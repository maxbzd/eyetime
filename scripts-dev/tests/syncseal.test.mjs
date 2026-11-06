// End-to-end encryption of the synced settings and tasks: the format (what an older EyeTime, the cloud, or someone who can write to it can and cannot do) and the rules for
// when to seal, when to ask for the passphrase and when to follow another device.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sealText, openText, splitText, declaredEnc, declare, newEncryption, keyFor, chooseMode, sealContext, SEALED_CHUNK_CHARS } from '../../src/shared/syncseal.js';
import { pack, packSealed, unpack, unpackSealed, remoteVersion, cloudMeta, META_KEY, chunkKey, SYNC_VERSION } from '../../src/shared/syncpack.js';
import { packTasks, packTasksSealed, unpackTasks, unpackTasksSealed, remoteTasksVersion, T_META } from '../../src/shared/tasksync.js';
import { WrongPassphraseError } from '../../src/shared/vault.js';

const FAST = 2000; // PBKDF2 rounds in the tests; the product uses 600 000
const PASS = 'correct horse battery';
const settings = { language: 'ru', blocking: { custom: ['secret-site.example', 'другой-сайт.example'], always: [] }, newtab: { name: 'Алиса' }, note: 'x'.repeat(30_000) };
const tasks = [{ id: 'a', text: 'Call the lawyer about the divorce', done: false }, { id: 'b', text: 'Купить подарок', done: false }];
const flip = (s) => s.slice(0, 5) + (s[5] === 'A' ? 'B' : 'A') + s.slice(6);

test('sealed text opens with the key and the context it was sealed with, and with nothing else', async () => {
  const { key } = await newEncryption(PASS, 1, FAST), other = (await newEncryption(PASS, 2, FAST)).key;
  const sealed = await sealText(key, 'ctx', 'hello мир');
  assert.equal(await openText(key, 'ctx', sealed), 'hello мир');
  await assert.rejects(openText(key, 'ctx2', sealed), 'another context');
  await assert.rejects(openText(other, 'ctx', sealed), 'another key');
  await assert.rejects(openText(key, 'ctx', flip(sealed)), 'one changed character');
  await assert.rejects(openText(key, 'ctx', sealed + '.x'), 'extra part');
  await assert.rejects(openText(key, 'ctx', 'nonsense'), 'not a payload');
  assert.notEqual(sealed, await sealText(key, 'ctx', 'hello мир'), 'a fresh nonce each time');
});

test('compression keeps text well inside the quota, and a compression bomb is refused', async () => {
  const { key } = await newEncryption(PASS, 1, FAST);
  const text = JSON.stringify(settings);
  const sealed = await sealText(key, 'c', text);
  assert.ok(sealed.length < text.length / 4, `${sealed.length} for ${text.length}`);
  const bomb = await sealText(key, 'c', 'a'.repeat(5_000_000));
  await assert.rejects(openText(key, 'c', bomb), /too large/);
});

test('splitText: chunks fit an item and a payload that needs too many is refused', () => {
  const parts = splitText('x'.repeat(20_000), 8);
  assert.deepEqual(parts.map((p) => p.length), [7000, 7000, 6000]);
  assert.equal(splitText('x'.repeat(60_000), 8), null);
  assert.deepEqual(splitText('', 8), []);
});

test('settings: sealed, stored in items under the limit, no plain text anywhere, and back', async () => {
  const { info, key } = await newEncryption(PASS, 111, FAST);
  const p = await packSealed(settings, 1000, key, info);
  assert.ok(p && p.count >= 1);
  const all = p.items;
  assert.equal(all[META_KEY].v, 2); assert.equal(all[META_KEY].ts, 1000); assert.equal(declaredEnc(all[META_KEY]).rot, 111);
  for (const [k, v] of Object.entries(all)) assert.ok(k.length + JSON.stringify(v).length <= 8192, k + ' is over the item limit');
  const dump = JSON.stringify(all);
  for (const secret of ['secret-site', 'другой-сайт', 'Алиса', 'ru']) assert.ok(!dump.includes(secret === 'ru' ? '"language"' : secret), secret + ' is readable');
  const back = await unpackSealed(all, key);
  assert.deepEqual(back.settings.blocking.custom, settings.blocking.custom); assert.equal(back.ts, 1000);
});

test('an older EyeTime (which reads version 1 only) finds a sealed copy newer than it understands and a plain reader gets nothing from it', async () => {
  const { info, key } = await newEncryption(PASS, 111, FAST);
  const all = (await packSealed(settings, 1000, key, info)).items;
  assert.equal(remoteVersion(all), 2); assert.ok(remoteVersion(all) > 1, 'an older version stops at "written by a newer EyeTime"');
  assert.equal(unpack(all), null, 'and unpack, if it were asked, reads nothing');
  assert.equal(SYNC_VERSION, 2);
  const t = (await packTasksSealed(tasks, 1000, key, info)).items;
  assert.equal(remoteTasksVersion(t), 2); assert.equal(unpackTasks(t), null);
});

test('put back with another time (a rollback), moved to another payload, or changed: it does not open', async () => {
  const { info, key } = await newEncryption(PASS, 111, FAST);
  const old = (await packSealed(settings, 1000, key, info)).items;
  const rolled = { ...old, [META_KEY]: { ...old[META_KEY], ts: 5000 } };
  await assert.rejects(unpackSealed(rolled, key), 'an old copy with a new time');
  const t = (await packTasksSealed(tasks, 1000, key, info)).items;
  await assert.rejects(unpackTasksSealed({ ...t, [T_META]: { ...t[T_META], ts: 1001 } }, key));
  // the tasks sealed text is not accepted as the settings and the other way round
  await assert.rejects(unpackSealed({ [META_KEY]: t[T_META], [chunkKey(0)]: t['st:0'] }, key));
  const changed = { ...old, [chunkKey(0)]: flip(old[chunkKey(0)]) };
  await assert.rejects(unpackSealed(changed, key));
  const wrong = (await newEncryption(PASS, 111, FAST)).key;
  await assert.rejects(unpackSealed(old, wrong));
  // an incomplete copy is "absent", not an error
  assert.equal(await unpackSealed({ [META_KEY]: old[META_KEY] }, key), null);
});

test('tasks: sealed and back, no plain text in the cloud', async () => {
  const { info, key } = await newEncryption(PASS, 7, FAST);
  const p = await packTasksSealed(tasks, 2000, key, info, { z: 5 });
  const dump = JSON.stringify(p.items);
  assert.ok(!dump.includes('lawyer') && !dump.includes('подарок'));
  const back = await unpackTasksSealed(p.items, key);
  assert.deepEqual(back.tasks.map((x) => x.text), tasks.map((x) => x.text)); assert.deepEqual(back.del, { z: 5 });
});

test('the passphrase opens the encryption a payload declares, and a wrong one is a WrongPassphraseError', async () => {
  const { info, key } = await newEncryption(PASS, 9, FAST);
  const declared = declaredEnc({ v: 2, enc: declare(info) });
  assert.deepEqual(declared, info);
  assert.deepEqual(await keyFor(declared, PASS), key);
  await assert.rejects(keyFor(declared, 'another passphrase'), WrongPassphraseError);
  for (const bad of [null, {}, { v: 1, enc: declare(info) }, { v: 2 }, { v: 2, enc: { salt: 'x' } }, { v: 2, enc: { ...declare(info), rot: 0 } }]) assert.equal(declaredEnc(bad), null);
});

test('cloudMeta: the newest sealed payload speaks for both; plain ones pass on the newest "off"', async () => {
  const a = (await newEncryption(PASS, 100, FAST)), b = (await newEncryption(PASS, 200, FAST));
  const s = (await packSealed(settings, 1, a.key, a.info)).items[META_KEY], t = (await packTasksSealed(tasks, 1, b.key, b.info)).items[T_META];
  assert.equal(declaredEnc(cloudMeta({ [META_KEY]: s, [T_META]: t })).rot, 200);
  assert.equal(declaredEnc(cloudMeta({ [META_KEY]: s })).rot, 100);
  assert.equal(declaredEnc(cloudMeta({ [T_META]: t })).rot, 200, 'sealed tasks alone make a second device ask for the passphrase before it uploads settings');
  assert.deepEqual(cloudMeta({ [META_KEY]: { v: 1, off: 5 }, [T_META]: { v: 1, off: 9 } }), { v: 1, off: 9 });
  assert.equal(cloudMeta({}), undefined);
  assert.equal(pack({ a: 1 }, 5, 77).items[META_KEY].off, 77); assert.equal(unpack(pack({ a: 1 }, 5, 77).items).off, 77);
  assert.equal(packTasks(tasks, 5, {}, Date.now(), 88).items[T_META].off, 88);
});

test('chooseMode: when to seal, ask, follow or replace', async () => {
  const mine = (await newEncryption(PASS, 100, FAST)).info, newer = (await newEncryption(PASS, 300, FAST)).info, older = (await newEncryption(PASS, 50, FAST)).info;
  const sealedMeta = (info) => ({ v: 2, n: 1, ts: 1, enc: declare(info) });
  // no encryption anywhere
  assert.deepEqual(chooseMode({ enc: null, remoteMeta: undefined }), { mode: 'plain' });
  assert.deepEqual(chooseMode({ enc: null, remoteMeta: { v: 1 } }), { mode: 'plain' });
  // the cloud has one this device does not: ask for the passphrase, never upload plain
  assert.deepEqual(chooseMode({ enc: null, remoteMeta: sealedMeta(newer) }), { mode: 'unlock', info: newer });
  // this device switched exactly that one off: the sealed copy is replaced
  assert.deepEqual(chooseMode({ enc: null, off: 300, remoteMeta: sealedMeta(newer) }), { mode: 'plain', replaceSealed: true });
  assert.deepEqual(chooseMode({ enc: null, off: 299, remoteMeta: sealedMeta(newer) }), { mode: 'unlock', info: newer }, 'a newer one than the one switched off');
  // this device has one
  assert.deepEqual(chooseMode({ enc: mine, remoteMeta: undefined }), { mode: 'sealed', info: mine });
  assert.deepEqual(chooseMode({ enc: mine, remoteMeta: { v: 1 } }), { mode: 'sealed', info: mine }, 'a plain copy is replaced by a sealed one');
  assert.deepEqual(chooseMode({ enc: mine, remoteMeta: sealedMeta(mine) }), { mode: 'sealed', info: mine });
  assert.deepEqual(chooseMode({ enc: mine, remoteMeta: sealedMeta(older) }), { mode: 'sealed', info: mine }, 'ours is the newer: it replaces');
  assert.deepEqual(chooseMode({ enc: mine, remoteMeta: sealedMeta(newer) }), { mode: 'unlock', info: newer }, 'the passphrase was changed elsewhere');
  // switched off elsewhere: follow, but only when that off is about our encryption or a later one
  assert.deepEqual(chooseMode({ enc: mine, remoteMeta: { v: 1, off: 100 } }), { mode: 'plain', clearLocal: true });
  assert.deepEqual(chooseMode({ enc: mine, remoteMeta: { v: 1, off: 400 } }), { mode: 'plain', clearLocal: true });
  assert.deepEqual(chooseMode({ enc: mine, remoteMeta: { v: 1, off: 99 } }), { mode: 'sealed', info: mine }, 'an "off" for an older encryption does not undo this one');
  assert.equal(SEALED_CHUNK_CHARS, 7000); assert.equal(sealContext('tasks', 5), 'sync:tasks:5');
});
