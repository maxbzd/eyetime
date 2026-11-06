// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The passphrase for the sign-in details, end to end through storage (against a pretend browser): what is written, what is readable when, what a backup holds.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeChrome } from './helpers/fake-chrome.mjs';

const chrome = installFakeChrome();
const c = await import('../../src/shared/connections.js');
const { exportAll, resetAll } = await import('../../src/shared/storage.js');

const conn = (id) => ({ id, provider: 'todoist', label: id, tasks: true, calendar: false, deletes: true, options: {}, status: {}, createdAt: 1 });
const stored = () => chrome.storage.local._all().connSecrets;
const raw = () => JSON.stringify(chrome.storage.local._all());
const PASS = 'correct horse battery';

beforeEach(async () => { await chrome.storage.local.clear(); await chrome.storage.session.clear(); });

test('vault: with no passphrase the details are stored as they are (nothing changes for people who do not use one)', async () => {
  await c.saveConnection(conn('c1'), { token: 'tok_one' });
  assert.deepEqual(stored().c1, { token: 'tok_one' }); assert.equal(await c.vaultState(), 'off');
  assert.deepEqual(await c.getSecrets('c1'), { token: 'tok_one' });
});

test('vault: setting a passphrase seals what is there in one write; nothing readable is left in storage; reading works while unlocked', async () => {
  await c.saveConnection(conn('c1'), { token: 'tok_one' }); await c.saveConnection(conn('c2'), { password: 'pw_two' });
  await c.enableVault(PASS);
  assert.equal(await c.vaultState(), 'unlocked');
  assert.ok(stored().c1._vault === 1 && stored().c2._vault === 1);
  assert.equal(/tok_one|pw_two/.test(raw()), false, 'no trace of the details anywhere in the stored data');
  assert.equal(JSON.stringify(await chrome.storage.session.get(null)).includes('tok_one'), false, 'only the key is in session memory');
  assert.deepEqual(await c.getSecrets('c1'), { token: 'tok_one' }); assert.deepEqual(await c.getSecrets('c2'), { password: 'pw_two' });
  await assert.rejects(c.enableVault(PASS), /already/);
});

test('vault: new and renewed details are sealed while unlocked, and nothing is written in the clear while locked', async () => {
  await c.enableVault(PASS);
  await c.saveConnection(conn('c3'), { token: 'tok_three' });
  assert.ok(stored().c3._vault === 1 && !raw().includes('tok_three'));
  await c.setSecrets('c3', { token: 'renewed' }); assert.equal(raw().includes('renewed'), false); assert.deepEqual(await c.getSecrets('c3'), { token: 'renewed' });
  await c.lockVault();
  await assert.rejects(c.setSecrets('c3', { token: 'leaked' }), c.VaultLockedError);
  await assert.rejects(c.saveConnection(conn('c4'), { token: 'leaked' }), c.VaultLockedError);
  assert.equal(raw().includes('leaked'), false, 'a refused write left nothing behind');
});

test('vault: after a browser start (memory gone) the vault is locked, reading is refused, the right passphrase opens it and a wrong one does not', async () => {
  await c.saveConnection(conn('c1'), { token: 'tok_one' }); await c.enableVault(PASS);
  await chrome.storage.session.clear();                                    // the browser was closed
  assert.equal(await c.vaultState(), 'locked');
  await assert.rejects(c.getSecrets('c1'), c.VaultLockedError);
  await assert.rejects(c.unlockWith('wrong passphrase!'), c.WrongPassphraseError);
  assert.equal(await c.vaultState(), 'locked');
  await c.unlockWith(PASS);
  assert.equal(await c.vaultState(), 'unlocked'); assert.deepEqual(await c.getSecrets('c1'), { token: 'tok_one' });
  await c.lockVault(); assert.equal(await c.vaultState(), 'locked');
});

test('vault: changing the passphrase needs the old one and keeps every detail; the old one stops working', async () => {
  await c.saveConnection(conn('c1'), { token: 'tok_one' }); await c.enableVault(PASS);
  await assert.rejects(c.changePassphrase('not the old one', 'a brand new phrase'), c.WrongPassphraseError);
  await assert.rejects(c.changePassphrase(PASS, 'short'), /passphrase: short/);
  await c.changePassphrase(PASS, 'a brand new phrase');
  assert.deepEqual(await c.getSecrets('c1'), { token: 'tok_one' });
  await chrome.storage.session.clear();
  await assert.rejects(c.unlockWith(PASS), c.WrongPassphraseError); await c.unlockWith('a brand new phrase');
  assert.deepEqual(await c.getSecrets('c1'), { token: 'tok_one' });
});

test('vault: turning it off needs the passphrase and returns the details as they were', async () => {
  await c.saveConnection(conn('c1'), { token: 'tok_one' }); await c.enableVault(PASS);
  await assert.rejects(c.disableVault('nope nope nope'), c.WrongPassphraseError);
  assert.equal(await c.vaultState(), 'unlocked', 'a wrong passphrase changed nothing');
  await c.disableVault(PASS);
  assert.equal(await c.vaultState(), 'off'); assert.deepEqual(stored().c1, { token: 'tok_one' });
  assert.equal(JSON.stringify(await chrome.storage.session.get(null)).includes('vaultKey'), false, 'and the key is forgotten');
});

test('vault: a forgotten passphrase: the sealed details are deleted, every connection asks to sign in again, tasks and settings stay', async () => {
  await c.saveConnection(conn('c1'), { token: 'tok_one' }); await c.enableVault(PASS);
  await chrome.storage.local.set({ tasks: [{ id: 't', text: 'keep me' }] });
  await chrome.storage.session.clear();
  await c.resetVault();
  assert.equal(await c.vaultState(), 'off'); assert.deepEqual(stored(), {});
  assert.equal((await c.listConnections()).c1.status.needsAuth, true);
  assert.equal(chrome.storage.local._all().tasks[0].text, 'keep me');
  assert.equal(await c.getSecrets('c1'), null);
});

test('vault: a backup holds neither the details nor the vault, and a wipe forgets the key', async () => {
  await c.saveConnection(conn('c1'), { token: 'tok_one' }); await c.enableVault(PASS);
  const backup = await exportAll();
  assert.equal('connSecrets' in backup.data || 'vault' in backup.data || 'conns' in backup.data, false);
  assert.equal(JSON.stringify(backup).includes('tok_one'), false);
  await resetAll();
  assert.equal(await c.vaultState(), 'off'); assert.equal(await (async () => (await chrome.storage.session.get('vaultKey')).vaultKey)(), undefined);
});

test('vault: details moved from one connection to another cannot be read there', async () => {
  await c.saveConnection(conn('c1'), { token: 'tok_one' }); await c.saveConnection(conn('c2'), { token: 'tok_two' }); await c.enableVault(PASS);
  const all = { ...stored() }; await chrome.storage.local.set({ connSecrets: { c1: all.c2, c2: all.c1 } });
  await assert.rejects(c.getSecrets('c1')); await assert.rejects(c.getSecrets('c2'));
});
