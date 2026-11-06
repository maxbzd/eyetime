// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The passphrase for the sign-in details, in Settings → Data & privacy → Connected services: set it, see the details sealed, "restart the browser" (the key in memory is
// dropped), meet the locked state, fail and then succeed to unlock, change it, turn it off, and the forgotten-passphrase way out.
//   node scripts-dev/e2e/vault.cjs
const { launch } = require('./lib.cjs');

(async () => {
  const app = await launch({ viewport: { width: 1200, height: 1000 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const bad = [];
  const ok = (c, m) => { if (!c) bad.push(m); };
  const o = await app.ctx.newPage();
  await o.goto(ext('src/options/options.html#data')); await o.waitForTimeout(600);
  await o.evaluate(async () => {
    await chrome.storage.local.set({ conns: { c1: { id: 'c1', provider: 'todoist', label: 'Todoist', tasks: true, calendar: false, deletes: true, options: {}, status: {}, createdAt: 1 } }, connSecrets: { c1: { token: 'tok_secret_one' } } });
  });
  await o.reload(); await o.waitForSelector('#vaultSet', { timeout: 8000 });
  const dump = () => o.evaluate(async () => JSON.stringify(await chrome.storage.local.get(null)));
  const type = async (sel, v) => { await o.locator(sel).fill(v); };

  // 1. set a passphrase (too short, then not matching, then right)
  await o.click('#vaultSet'); await o.waitForSelector('dialog[open] #vault-pass');
  await type('#vault-pass', 'short'); await type('#vault-pass2', 'short'); await o.click('dialog[open] button[type=submit]');
  ok(/8/.test(await o.textContent('#vaultMsg')), 'a short passphrase is refused in place, naming the length: ' + await o.textContent('#vaultMsg'));
  await type('#vault-pass', 'correct horse battery'); await type('#vault-pass2', 'correct horse batterx'); await o.click('dialog[open] button[type=submit]');
  ok((await o.textContent('#vaultMsg')).length > 3, 'two different phrases are refused in place');
  await type('#vault-pass2', 'correct horse battery'); await o.click('dialog[open] button[type=submit]');
  await o.waitForSelector('#vaultLock', { timeout: 15000 });
  let all = await dump();
  ok(!all.includes('tok_secret_one'), 'the token is no longer in storage in the clear');
  ok(all.includes('"_vault":1'), 'it is stored sealed');
  ok(await o.locator('#vaultChange').count() === 1 && await o.locator('#vaultOff').count() === 1, 'the unlocked row offers change and turn off');

  // 2. "the browser was restarted": the key in memory is gone
  await o.evaluate(() => chrome.storage.session.remove('vaultKey'));
  await o.waitForSelector('#vaultUnlock', { timeout: 8000 });
  ok(/./.test(await o.locator('.list').first().innerText()), 'the locked state is shown');
  // the worker meets the lock without a failure: the connection waits
  await o.evaluate(async () => { await chrome.runtime.sendMessage({ type: 'conn:sync', id: 'c1' }); });
  await o.waitForTimeout(800);
  const st = await o.evaluate(async () => (await chrome.storage.local.get('conns')).conns.c1.status);
  ok(st.needsUnlock === true && st.error === 'locked', 'a sync while locked says "locked", not a failure of the service: ' + JSON.stringify(st));
  const errs = await o.evaluate(async () => ((await chrome.storage.local.get('errorLog')).errorLog || []).filter((e) => /connections/.test(e.src)));
  ok(errs.length === 0, 'and writes nothing to the error log: ' + JSON.stringify(errs));

  // 3. a wrong passphrase, then the right one
  await o.click('#vaultUnlock'); await o.waitForSelector('dialog[open] #vault-pass');
  await type('#vault-pass', 'not the passphrase'); await o.click('dialog[open] button[type=submit]');
  await o.waitForFunction(() => document.querySelector('#vaultMsg') && document.querySelector('#vaultMsg').textContent.length > 3);
  ok(await o.locator('dialog[open]').count() === 1, 'a wrong passphrase keeps the dialog open');
  await type('#vault-pass', 'correct horse battery'); await o.click('dialog[open] button[type=submit]');
  await o.waitForSelector('#vaultLock', { timeout: 15000 });
  ok(await o.evaluate(async () => !!(await chrome.storage.session.get('vaultKey')).vaultKey), 'unlocked: the key is in memory again');

  // 4. change the passphrase
  await o.click('#vaultChange'); await o.waitForSelector('dialog[open] #vault-old');
  await type('#vault-old', 'correct horse battery'); await type('#vault-pass', 'another long phrase'); await type('#vault-pass2', 'another long phrase'); await o.click('dialog[open] button[type=submit]');
  await o.waitForFunction(() => !document.querySelector('dialog[open]'), null, { timeout: 15000 });
  await o.evaluate(() => chrome.storage.session.remove('vaultKey')); await o.waitForSelector('#vaultUnlock');
  await o.click('#vaultUnlock'); await o.waitForSelector('dialog[open] #vault-pass'); await type('#vault-pass', 'correct horse battery'); await o.click('dialog[open] button[type=submit]');
  await o.waitForFunction(() => document.querySelector('#vaultMsg') && document.querySelector('#vaultMsg').textContent.length > 3);
  ok(true, 'the old passphrase no longer opens it');
  await type('#vault-pass', 'another long phrase'); await o.click('dialog[open] button[type=submit]'); await o.waitForSelector('#vaultLock', { timeout: 15000 });

  // 5. turn it off: the token is back as it was
  await o.click('#vaultOff'); await o.waitForSelector('dialog[open] #vault-pass'); await type('#vault-pass', 'another long phrase'); await o.click('dialog[open] button[type=submit]');
  await o.waitForSelector('#vaultSet', { timeout: 15000 });
  all = await dump(); ok(all.includes('tok_secret_one') && !all.includes('"_vault":1'), 'turned off: the details are stored as before');

  // 6. the forgotten-passphrase way out
  await o.click('#vaultSet'); await o.waitForSelector('dialog[open] #vault-pass'); await type('#vault-pass', 'one more long phrase'); await type('#vault-pass2', 'one more long phrase'); await o.click('dialog[open] button[type=submit]');
  await o.waitForSelector('#vaultLock', { timeout: 15000 });
  await o.evaluate(() => chrome.storage.session.remove('vaultKey')); await o.waitForSelector('#vaultForgot');
  await o.click('#vaultForgot'); await o.locator('dialog[open] button[value=yes]').click();
  await o.waitForSelector('#vaultSet', { timeout: 15000 });
  all = await dump();
  ok(!all.includes('"_vault":1') && !all.includes('tok_secret_one'), 'forgotten: the sealed details are deleted and nothing is left in the clear');
  ok((await o.evaluate(async () => (await chrome.storage.local.get('conns')).conns.c1.status.needsAuth)) === true, 'and the connection asks to sign in again');

  console.log(bad.length ? 'FAIL vault\n  ' + bad.join('\n  ') : 'PASS vault: set, sealed, locked, unlocked, changed, turned off, reset');
  await app.close();
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
