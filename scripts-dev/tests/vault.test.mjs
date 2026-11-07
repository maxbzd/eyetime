// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
import test from 'node:test';
import assert from 'node:assert/strict';
import { createVault, unlockVault, sealSecrets, openSecrets, isSealed, passphraseProblem, WrongPassphraseError, KDF, MIN_PASSPHRASE } from '../../src/shared/vault.js';

const FAST = 2000; // rounds for the tests that are not about the cost (the real number is checked once)

test('vault: the passphrase opens its own vault and no other', async () => {
  const { meta, key } = await createVault('correct horse battery', FAST);
  assert.equal(meta.v, 1); assert.equal(meta.iter, FAST);
  assert.deepEqual(await unlockVault(meta, 'correct horse battery'), key);
  await assert.rejects(unlockVault(meta, 'correct horse batterx'), WrongPassphraseError);
  await assert.rejects(unlockVault(meta, ''), WrongPassphraseError);
  const other = await createVault('correct horse battery', FAST);
  assert.notDeepEqual(other.meta.salt, meta.salt, 'a new salt every time');
  assert.notDeepEqual(other.key, key, 'so the same passphrase gives another key');
});

test('vault: details are sealed with a fresh nonce each time and come back exactly', async () => {
  const { key } = await createVault('correct horse battery', FAST);
  const secrets = { token: 'tok_ü_日本_123', password: 'p@ss "quoted" \\ \n' };
  const a = await sealSecrets(key, 'c1', secrets), b = await sealSecrets(key, 'c1', secrets);
  assert.ok(isSealed(a) && isSealed(b));
  assert.notEqual(a.ct, b.ct, 'the same details do not give the same message');
  assert.notEqual(a.iv, b.iv);
  assert.equal(JSON.stringify(a).includes('tok_'), false, 'nothing readable in what is stored');
  assert.deepEqual(await openSecrets(key, 'c1', a), secrets);
});

test('vault: a message that was changed, moved to another connection or opened with another key is refused', async () => {
  const { key } = await createVault('correct horse battery', FAST);
  const other = await createVault('another passphrase!', FAST);
  const sealed = await sealSecrets(key, 'c1', { token: 'x' });
  await assert.rejects(openSecrets(key, 'c2', sealed), 'bound to its connection');
  await assert.rejects(openSecrets(other.key, 'c1', sealed), 'another key');
  const flipped = { ...sealed, ct: sealed.ct.slice(0, -4) + (sealed.ct.endsWith('AAAA') ? 'BBBB' : 'AAAA') };
  await assert.rejects(openSecrets(key, 'c1', flipped), 'one changed byte');
  await assert.rejects(openSecrets(key, 'c1', { ...sealed, iv: other.meta.check.iv }), 'another nonce');
  await assert.rejects(openSecrets(key, 'c1', { token: 'x' }), 'plain details are not a sealed message');
});

test('vault: the check blob cannot be taken for the details of a connection, whatever the connection is called', async () => {
  const { meta, key } = await createVault('correct horse battery', FAST);
  for (const id of ['check', '#check', '', 'c1']) {
    await assert.rejects(openSecrets(key, id, { _vault: 1, ...meta.check }), (e) => e.name === 'OperationError', `refused by the authentication itself for id ${JSON.stringify(id)}`);
  }
});

test('vault: passphrases: twelve characters at least (counted as people count them), never a non-string, and a vault this version cannot read is refused', async () => {
  assert.equal(passphraseProblem('short'), 'short'); assert.equal(passphraseProblem('1234567'), 'short'); assert.equal(passphraseProblem('football1234'.slice(0, 11)), 'short', 'eleven is still short');
  assert.equal(passphraseProblem('12345678'), 'short'); assert.equal(passphraseProblem('1234567890123'), 'weak', 'the passwords everyone tries first are refused'); assert.equal(passphraseProblem('aaaaaaaaaaaaaa'), 'weak'); assert.equal(passphraseProblem('abcabcabcabcabc'), 'weak', 'a short stem repeated'); assert.equal(passphraseProblem('qwertyuiopasdf'), 'weak', 'a walk along the keyboard'); assert.equal(passphraseProblem('Tr0ub4dor&3x'), ''); assert.equal(passphraseProblem('日本語日本語日本語春夏秋冬'), '');
  assert.equal(passphraseProblem('😀😀😀😀😀😀😀'), 'short', 'seven emoji are seven characters'); assert.equal(passphraseProblem('😀😁😂🤣😃😄😅😆😉😊😋😎'), '', 'twelve different emoji are twelve characters');
  assert.equal(passphraseProblem(null), 'type'); assert.equal(passphraseProblem('x'.repeat(300)), 'long');
  await assert.rejects(createVault('short', FAST), /passphrase: short/);
  const { meta } = await createVault('correct horse battery', FAST);
  for (const bad of [null, {}, { ...meta, v: 2 }, { ...meta, kdf: 'MD5' }, { ...meta, iter: 1 }, { ...meta, iter: 1e12 }]) await assert.rejects(unlockVault(bad, 'correct horse battery'), /not one this version can read/);
});

test('vault: composed and decomposed forms of the same text are the same passphrase', async () => {
  const { meta } = await createVault('passéword-xyzzy', FAST);       // é as one character
  await unlockVault(meta, 'passéword-xyzzy');                        // e + combining accent
});

test('vault: the real cost of one guess is the documented one (600 000 rounds), and takes a noticeable moment', async () => {
  assert.equal(KDF.iterations, 600_000); assert.equal(MIN_PASSPHRASE, 12);
  const t0 = performance.now();
  const { meta } = await createVault('correct horse battery');
  assert.equal(meta.iter, 600_000);
  assert.ok(performance.now() - t0 > 50, 'a guess must not be nearly free');
});
