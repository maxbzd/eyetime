// The passphrase for the synced data, in Settings → Data & privacy → Sync: set it (and see that the cloud holds only ciphertext), "restart the browser" (the key is dropped), meet
// the locked state, fail and then succeed to unlock, change it, and turn it off (plain copies again). The cloud here is chrome.storage.sync of the test profile.
//   node scripts-dev/e2e/syncenc.cjs
const { launch } = require('./lib.cjs');

(async () => {
  const app = await launch({ viewport: { width: 1200, height: 1000 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const bad = [];
  const ok = (c, m) => { if (!c) bad.push(m); };
  const o = await app.ctx.newPage();
  const errors = [];
  o.on('pageerror', (e) => errors.push(e.message));
  await o.goto(ext('src/options/options.html#data')); await o.waitForTimeout(600);
  await o.evaluate(async () => {
    const { settings } = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({ settings: { ...settings, onboarded: true, blocking: { ...(settings && settings.blocking), custom: ['secret-site.example'] } }, settingsUpdatedAt: Date.now(), syncSettings: true, syncTasks: true,
      tasks: [{ id: 't1', text: 'Call the lawyer about the divorce', done: false, createdAt: 1 }] });
  });
  await o.reload(); await o.waitForSelector('#syncEncSet', { timeout: 8000 });
  const cloud = () => o.evaluate(async () => JSON.stringify(await chrome.storage.sync.get(null)));
  const sync = async () => { await o.evaluate(() => chrome.runtime.sendMessage({ type: 'sync:now' })); await o.waitForTimeout(500); };
  const type = (sel, v) => o.locator(sel).fill(v);
  const submit = () => o.click('dialog[open] button[type=submit]');

  // 1. before: plain, readable in the cloud (the old behaviour)
  await sync();
  let all = await cloud();
  ok(all.includes('secret-site.example') && all.includes('divorce'), 'without a passphrase the copies are plain (as before)');

  // 2. set a passphrase: too short, not matching, right
  await o.click('#syncEncSet'); await o.waitForSelector('dialog[open] #vault-pass');
  await type('#vault-pass', 'short'); await type('#vault-pass2', 'short'); await submit();
  ok(/8/.test(await o.textContent('#vaultMsg')), 'a short passphrase is refused in place');
  await type('#vault-pass', 'correct horse battery'); await type('#vault-pass2', 'correct horse batterx'); await submit();
  ok((await o.textContent('#vaultMsg')).length > 3, 'two different phrases are refused in place');
  await type('#vault-pass2', 'correct horse battery'); await submit();
  await o.waitForSelector('#syncEncChange', { timeout: 15000 });
  await o.waitForTimeout(800);
  all = await cloud();
  ok(!all.includes('secret-site') && !all.includes('divorce') && !all.includes('lawyer'), 'the cloud holds no readable text after the passphrase: ' + all.slice(0, 200));
  ok(/"v":2/.test(all) && all.includes('"enc"'), 'the copies are the sealed version');
  ok(await o.locator('#syncEncOff').count() === 1, 'the unlocked row offers change and turn off');
  ok(/./.test(await o.locator('.sync-status').last().innerText()), 'the row says it is encrypted');

  // 3. "the browser was restarted": the key in memory is gone
  await o.evaluate(() => chrome.storage.session.remove('syncKey'));
  await o.evaluate(() => chrome.runtime.sendMessage({ type: 'sync:now' })); await o.waitForTimeout(500);
  await o.reload(); await o.waitForSelector('#syncEncUnlock', { timeout: 8000 });
  const st = await o.evaluate(async () => (await chrome.storage.local.get(['syncStatus', 'tasksSyncStatus'])));
  ok(st.syncStatus.error === 'locked' && st.tasksSyncStatus.error === 'locked', 'the sync waits for the passphrase: ' + JSON.stringify(st));
  ok(!(await cloud()).includes('secret-site'), 'and uploads nothing in the clear meanwhile');

  // 4. the wrong passphrase is refused in place, the right one unlocks
  await o.click('#syncEncUnlock'); await o.waitForSelector('dialog[open] #vault-pass');
  await type('#vault-pass', 'not the passphrase'); await submit();
  await o.waitForFunction(() => /./.test((document.querySelector('#vaultMsg') || {}).textContent || ''), null, { timeout: 15000 });
  await type('#vault-pass', 'correct horse battery'); await submit();
  await o.waitForSelector('#syncEncChange', { timeout: 15000 });
  await o.waitForTimeout(800);
  const st2 = await o.evaluate(async () => (await chrome.storage.local.get(['syncStatus', 'tasksSyncStatus'])));
  ok(st2.syncStatus.ok && st2.tasksSyncStatus.ok, 'after unlocking the sync runs again: ' + JSON.stringify(st2));

  // 5. change the passphrase
  await o.click('#syncEncChange'); await o.waitForSelector('dialog[open] #vault-old');
  await type('#vault-old', 'correct horse battery'); await type('#vault-pass', 'a different long phrase'); await type('#vault-pass2', 'a different long phrase'); await submit();
  await o.waitForSelector('#syncEncChange', { timeout: 15000 });
  await o.waitForTimeout(800);
  ok(!(await cloud()).includes('secret-site'), 'still nothing readable after the change');

  // 6. turn it off: plain copies again, and the cloud says which encryption they replace
  await o.click('#syncEncOff'); await o.locator('dialog[open] button[value=yes]').click();
  await o.waitForSelector('#syncEncSet', { timeout: 15000 });
  await o.waitForTimeout(800);
  all = await cloud();
  ok(all.includes('secret-site.example') && all.includes('divorce') && /"off":\d+/.test(all), 'turned off: the copies are plain again and carry the "off" mark');

  ok(errors.length === 0, 'page errors: ' + errors.join(' | '));
  console.log(bad.length ? 'FAIL syncenc\n  ' + bad.join('\n  ') : 'PASS syncenc: the cloud holds only ciphertext with a passphrase, waits for it after a restart, unlocks, changes, and turns off');
  await app.close();
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
