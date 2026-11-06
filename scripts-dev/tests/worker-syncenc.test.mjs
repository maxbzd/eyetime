// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Two browsers that share one cloud (chrome.storage.sync) and a passphrase: what the cloud can see, what each device does without the key, after a restart, when the passphrase
// changes, when encryption is switched off, and when someone with write access to the cloud changes or rolls back a copy.
import test, { mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeChrome } from './helpers/fake-chrome.mjs';

const chrome = installFakeChrome();
const { syncNow } = await import('../../src/background/sync.js');
const { syncTasksNow } = await import('../../src/background/tasksync.js');
const { getRaw, setRaw, setCollection, getCollection } = await import('../../src/shared/storage.js');
const V = await import('../../src/shared/syncvault.js');
const { WrongPassphraseError } = await import('../../src/shared/vault.js');

const PASS = 'correct horse battery', PASS2 = 'another long passphrase';
const SECRET_SITE = 'secret-site.example', SECRET_TASK = 'Call the lawyer about the divorce';
const settle = (ms = 120) => new Promise((r) => setTimeout(r, ms)); // lets the runs the storage events start (they are not awaited by anyone) finish

// two devices: each has its own local and session storage; the cloud is shared
const devices = { A: { local: {}, session: {} }, B: { local: {}, session: {} } };
let current = 'A';
const swap = (area, obj) => { const d = chrome.storage[area]._all(); for (const k of Object.keys(d)) delete d[k]; Object.assign(d, structuredClone(obj)); };
async function on(name) {
  if (name === current) return;
  await settle(150); // runs that the other device's storage events started must finish before its storage is put away
  devices[current] = { local: structuredClone(chrome.storage.local._all()), session: structuredClone(chrome.storage.session._all()) };
  swap('local', devices[name].local); swap('session', devices[name].session); current = name;
}
const cloud = () => chrome.storage.sync._all();
const dump = () => JSON.stringify(cloud());
const both = async () => { await syncNow(); await syncTasksNow(); };
const status = async () => (await getRaw(['syncStatus', 'tasksSyncStatus']));

async function deviceReady(name, { settings, tasks = [] }) {
  await on(name);
  const d = chrome.storage.local._all(); for (const k of Object.keys(d)) delete d[k];
  await setRaw({ settings: { onboarded: true, language: 'en', blocking: { custom: [] }, ...settings }, settingsUpdatedAt: 1000, syncSettings: true, syncTasks: true });
  await setCollection('tasks', tasks);
  await settle();
}

/** a device that has just been told about the encryption in the cloud: it asks for the passphrase, then has it */
async function joinWith(passphrase) {
  await both();
  const { syncNeeds } = await getRaw('syncNeeds');
  await V.unlockSyncEncryption(syncNeeds, passphrase);
  await both();
}

beforeEach(async () => {
  await settle(250);
  mock.timers.reset(); mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 4, 10).getTime() });
  await on('A');
  for (const k of Object.keys(cloud())) delete cloud()[k];
  devices.A = { local: {}, session: {} }; devices.B = { local: {}, session: {} };
  for (const area of ['local', 'session']) swap(area, {});
  await chrome.alarms.clearAll();
  await settle(250);
});

const SETTINGS = { language: 'ru', blocking: { custom: [SECRET_SITE] }, newtab: { name: 'Алиса' } };
const TASKS = [{ id: 't1', text: SECRET_TASK, done: false, createdAt: 1 }];

test('without a passphrase nothing changes: the cloud holds plain copies (the old behaviour)', async () => {
  await deviceReady('A', { settings: SETTINGS, tasks: TASKS });
  await both();
  assert.ok(dump().includes(SECRET_SITE) && dump().includes(SECRET_TASK));
  assert.equal(cloud()['sync:meta'].v, 1); assert.equal(cloud()['st:meta'].v, 1);
});

test('with a passphrase the cloud holds only ciphertext, a salt and a time', async () => {
  await deviceReady('A', { settings: SETTINGS, tasks: TASKS });
  await both();                                   // plain copies are up
  await V.enableSyncEncryption(PASS);
  await both();                                   // and are replaced by sealed ones
  assert.equal(cloud()['sync:meta'].v, 2); assert.equal(cloud()['st:meta'].v, 2);
  for (const secret of [SECRET_SITE, SECRET_TASK, 'Алиса', 'lawyer', 'divorce']) assert.ok(!dump().includes(secret), `"${secret}" is readable in the cloud`);
  assert.ok(!Object.keys(cloud()).some((k) => k === 'sync:1' && typeof cloud()[k] !== 'string'));
  assert.equal((await status()).syncStatus.ok, true); assert.equal((await status()).tasksSyncStatus.ok, true);
});

test('a second device: asks for the passphrase, uploads nothing, then takes over everything', async () => {
  await deviceReady('A', { settings: SETTINGS, tasks: TASKS });
  await V.enableSyncEncryption(PASS); await both();
  const before = dump();

  await deviceReady('B', { settings: { language: 'en', blocking: { custom: ['mine.example'] } }, tasks: [{ id: 'b1', text: 'Only on B', done: false, createdAt: 2 }] });
  await both();
  assert.equal(dump(), before, 'the cloud is untouched: B had no key and uploaded nothing');
  assert.equal((await status()).syncStatus.error, 'locked'); assert.equal((await status()).tasksSyncStatus.error, 'locked');
  const { syncNeeds, settings } = await getRaw(['syncNeeds', 'settings']);
  assert.ok(syncNeeds && syncNeeds.meta.salt, 'it knows which encryption to ask about');
  assert.deepEqual(settings.blocking.custom, ['mine.example'], 'and its own settings are as they were');

  await assert.rejects(V.unlockSyncEncryption(syncNeeds, 'the wrong passphrase'), WrongPassphraseError);
  await V.unlockSyncEncryption(syncNeeds, PASS);
  await both();
  assert.equal((await status()).syncStatus.ok, true);
  assert.deepEqual((await getRaw('settings')).settings.blocking.custom, [SECRET_SITE], 'the first sync on a device adopts the cloud copy (as it always did)');
  assert.ok((await getCollection('tasks', [])).some((t) => t.text === SECRET_TASK), 'the tasks of A arrived');
  assert.ok(!dump().includes(SECRET_TASK) && !dump().includes('Only on B'));
});

test('a browser restart forgets the key: the sync waits, nothing is uploaded in the clear, nothing is lost', async () => {
  await deviceReady('A', { settings: SETTINGS, tasks: TASKS });
  await V.enableSyncEncryption(PASS); await both();
  await chrome.storage.session.clear();           // the browser was closed
  await setCollection('tasks', [...TASKS, { id: 't2', text: 'Written after the restart', done: false, createdAt: 3 }]);
  const before = dump();
  await both();
  assert.equal(dump(), before); assert.equal((await status()).syncStatus.error, 'locked');
  await V.unlockLocal(PASS);
  await both();
  assert.equal((await status()).syncStatus.ok, true);
  assert.ok(!dump().includes('Written after the restart'));
  await deviceReady('B', { settings: {} }); await joinWith(PASS);
  assert.ok((await getCollection('tasks', [])).some((t) => t.text === 'Written after the restart'));
});

test('a new passphrase: the other device must ask again, the old passphrase no longer opens the new copy', async () => {
  await deviceReady('A', { settings: SETTINGS, tasks: TASKS });
  await V.enableSyncEncryption(PASS); await both();
  await deviceReady('B', { settings: {} }); await joinWith(PASS);
  assert.equal((await status()).syncStatus.ok, true);

  await on('A');
  mock.timers.setTime(Date.now() + 5000);
  await assert.rejects(V.changeSyncPassphrase('not the passphrase', PASS2), WrongPassphraseError);
  await V.changeSyncPassphrase(PASS, PASS2); await both();
  assert.equal((await status()).syncStatus.ok, true);

  await on('B'); mock.timers.setTime(Date.now() + 60_000);
  await chrome.storage.session.clear(); // B is also asked again after a restart, but even with its key it cannot read the new copy
  await V.unlockLocal(PASS); await both();
  assert.equal((await status()).syncStatus.error, 'locked', 'the old passphrase does not make the new copy readable');
  const { syncNeeds } = await getRaw('syncNeeds');
  await assert.rejects(V.unlockSyncEncryption(syncNeeds, PASS), WrongPassphraseError);
  await V.unlockSyncEncryption(syncNeeds, PASS2); await both();
  assert.equal((await status()).syncStatus.ok, true);
});

test('switching encryption off: plain copies again, and the other device follows instead of sealing them again', async () => {
  await deviceReady('A', { settings: SETTINGS, tasks: TASKS });
  await V.enableSyncEncryption(PASS); await both();
  await deviceReady('B', { settings: {} }); await joinWith(PASS);

  await on('A'); mock.timers.setTime(Date.now() + 60_000);
  await V.disableSyncEncryption(); await both();
  assert.equal(cloud()['sync:meta'].v, 1); assert.equal(cloud()['st:meta'].v, 1);
  assert.ok(cloud()['sync:meta'].off > 0 && cloud()['st:meta'].off > 0, 'the plain copies say which encryption they replace');
  assert.ok(dump().includes(SECRET_TASK));

  await on('B'); mock.timers.setTime(Date.now() + 60_000);
  await both();
  assert.equal((await getRaw('syncEnc')).syncEnc, null, 'B forgot the encryption that was switched off');
  assert.equal(cloud()['sync:meta'].v, 1, 'and did not seal the copies again');
  assert.equal((await status()).syncStatus.ok, true);
});

test('somebody who can write to the cloud changes a copy, or puts an old one back with a new time: nothing is read, nothing is overwritten', async () => {
  await deviceReady('A', { settings: SETTINGS, tasks: TASKS });
  await V.enableSyncEncryption(PASS); await both();
  const good = structuredClone(cloud());

  // one character of a chunk changed
  cloud()['sync:0'] = cloud()['sync:0'].slice(0, 20) + (cloud()['sync:0'][20] === 'A' ? 'B' : 'A') + cloud()['sync:0'].slice(21);
  const tampered = dump();
  await setRaw({ settingsUpdatedAt: Date.now() + 1 }); // A has something newer to upload
  await syncNow();
  assert.equal((await status()).syncStatus.error, 'tampered');
  assert.equal(dump(), tampered, 'the changed copy is not overwritten blindly');
  assert.equal((await getRaw('settings')).settings.blocking.custom[0], SECRET_SITE, 'and the local settings are untouched');

  // an older copy put back with a newer time
  for (const k of Object.keys(cloud())) delete cloud()[k]; Object.assign(cloud(), structuredClone(good));
  cloud()['sync:meta'] = { ...cloud()['sync:meta'], ts: cloud()['sync:meta'].ts + 100_000 };
  await syncNow();
  assert.equal((await status()).syncStatus.error, 'tampered');
});

test('an older EyeTime would stop at the sealed copy: the version says so', async () => {
  await deviceReady('A', { settings: SETTINGS, tasks: TASKS });
  await V.enableSyncEncryption(PASS); await both();
  const { remoteVersion } = await import('../../src/shared/syncpack.js'), { remoteTasksVersion } = await import('../../src/shared/tasksync.js');
  assert.equal(remoteVersion(cloud()), 2); assert.equal(remoteTasksVersion(cloud()), 2);
});

test('sealed copies fit the limits of the browser sync storage (8 KB an item) for a lot of tasks and a big settings object', async () => {
  const many = Array.from({ length: 300 }, (_, i) => ({ id: 't' + i, text: `Task number ${i} with some words in it ${'ж'.repeat(i % 40)}`, done: false, createdAt: i }));
  await deviceReady('A', { settings: { ...SETTINGS, note: 'z'.repeat(60_000) }, tasks: many });
  await V.enableSyncEncryption(PASS); await both();
  assert.equal((await status()).syncStatus.ok, true, JSON.stringify(await status()));
  assert.equal((await status()).tasksSyncStatus.ok, true, JSON.stringify(await status()));
});
