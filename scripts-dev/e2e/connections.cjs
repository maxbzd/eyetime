// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Connected services end to end, with Todoist answered by an in-memory mock (the same one the adapter's unit tests use): the group in Settings, the dialog
// (pick → token → choose → save), the first sync both ways, an edit on each side, an error that asks to sign in again, a backup that holds no secret, and disconnecting.
// The extension runs from a copy whose manifest already holds the host permission (a real person grants it in the browser's prompt).
//   node scripts-dev/e2e/connections.cjs
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const SRC = path.join(__dirname, '../..');
const EXT_COPY = '/tmp/eyetime-ext-connections';
fs.rmSync(EXT_COPY, { recursive: true, force: true });
fs.mkdirSync(EXT_COPY, { recursive: true });
for (const item of ['src', '_locales', 'icons']) cp.execFileSync('cp', ['-r', path.join(SRC, item), EXT_COPY]);
const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
manifest.host_permissions = ['https://api.todoist.com/*'];
fs.writeFileSync(path.join(EXT_COPY, 'manifest.json'), JSON.stringify(manifest));
process.env.EXT = EXT_COPY;
const { launch } = require('./lib.cjs');

(async () => {
  const { mockTodoist } = await import(path.join(SRC, 'scripts-dev/tests/helpers/mock-todoist.mjs'));
  const svc = mockTodoist({ token: 'tok-secret-123' });
  const app = await launch({ viewport: { width: 1280, height: 1000 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const bad = [];
  const ok = (c, m) => { if (!c) bad.push(m); };
  process.on('unhandledRejection', (e) => { console.log('FAIL (crashed)\n' + bad.join('\n') + '\n' + e); process.exit(1); });

  await app.ctx.route('https://api.todoist.com/**', async (route) => {
    const req = route.request(), cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const res = await svc.fetch(req.url(), { method: req.method(), headers: { authorization: req.headers().authorization }, body: req.postData() || undefined, credentials: 'omit' });
    return route.fulfill({ status: res.status, headers: { ...cors, 'content-type': 'application/json' }, body: await res.text() });
  });

  const o = await app.ctx.newPage(); await o.setViewportSize({ width: 1280, height: 1000 });
  o.on('pageerror', (e) => bad.push('pageerror: ' + e)); o.on('console', (m) => { if (m.type() === 'error' && !/status of 401/.test(m.text())) bad.push('console: ' + m.text()); }); // the two refused tokens are on purpose
  await o.goto(ext('src/options/options.html#data')); await o.waitForTimeout(800);
  await o.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.onboarded = true; s.language = 'en'; }); await st.setCollection('tasks', [{ id: 'l1', text: 'Write the report', done: false, createdAt: 1 }]); });
  await o.reload(); await o.waitForTimeout(1200);
  const tasks = () => o.evaluate(async () => (await chrome.storage.local.get('tasks')).tasks || []);
  const conn = () => o.evaluate(async () => Object.values((await chrome.storage.local.get('conns')).conns || {})[0] || null);
  const syncNow = () => o.evaluate(async () => { const { syncConnections } = await import('/src/background/connections.js'); await syncConnections({ force: true }); });

  // 1. the group is there, empty, and the services that work are offered (Google and Microsoft wait for their OAuth clients and are not shown)
  ok(await o.locator('h3.group-title', { hasText: 'Connected services' }).count() === 1, 'the Connected services group is in Data & privacy');
  await o.getByRole('button', { name: 'Connect a service', exact: true }).click(); await o.waitForTimeout(300);
  const dlg = o.locator('dialog[open]');
  ok(await dlg.locator('button[data-provider]').count() === 3, 'three services are offered: ' + await dlg.locator('button[data-provider]').count());
  ok(await dlg.locator('button[data-provider=google]').count() === 0 && await dlg.locator('button[data-provider=microsoft]').count() === 0, 'Google and Microsoft are not offered while there is no OAuth client in the build');
  ok(/Things/.test(await dlg.innerText()), 'Things is explained, not hidden');

  // 2. Todoist: a wrong token is told plainly; the right one leads to the choice
  await dlg.locator('button[data-provider=todoist]').click(); await o.waitForTimeout(200);
  await dlg.getByRole('button', { name: 'Connect', exact: true }).click(); await o.waitForTimeout(200);
  ok(/Fill in every field/.test(await dlg.innerText()), 'an empty token asks to fill the field');
  await dlg.locator('input[data-field=token]').fill('wrong');
  await dlg.getByRole('button', { name: 'Connect', exact: true }).click(); await o.waitForTimeout(900);
  ok(/Sign in again|Could not connect/.test(await dlg.innerText()) && !(await conn()), 'a wrong token connects nothing');
  await dlg.locator('input[data-field=token]').fill('tok-secret-123');
  await dlg.getByRole('button', { name: 'Connect', exact: true }).click(); await o.waitForTimeout(900);
  ok(/Tasks from/.test(await dlg.innerText()), 'the projects are offered after a good token: ' + (await dlg.innerText()).slice(0, 120));
  svc.add({ content: 'Call the bank', project_id: 'p1' });
  await dlg.getByRole('button', { name: 'Save and sync' }).click(); await o.waitForTimeout(2500);
  let c = await conn();
  ok(c && c.provider === 'todoist' && c.tasks === true && c.calendar === false, 'the connection is saved: ' + JSON.stringify(c && { p: c.provider, t: c.tasks }));
  ok(!(await dlg.count()), 'the dialog closed');

  // 3. the first sync goes both ways (the worker did it; "Sync now" does it again at once)
  await syncNow(); await o.waitForTimeout(500);
  let l = await tasks();
  ok(l.some((x) => x.text === 'Call the bank'), 'a task from Todoist arrived: ' + JSON.stringify(l.map((x) => x.text)));
  ok([...svc.state.tasks.values()].some((x) => x.content === 'Write the report'), 'a task from here went to Todoist');
  c = await conn();
  ok(c && c.status && c.status.ok === true && c.status.tasks, 'the status is ok after a sync: ' + JSON.stringify(c && c.status));
  const rowText = await o.locator('.conn').first().innerText();
  ok(/Synced/.test(rowText) && /Todoist/.test(rowText), 'the row says it synced: ' + rowText.replace(/\n/g, ' | ').slice(0, 160));

  // 4. an edit on each side, no duplicates
  const theirs = [...svc.state.tasks.values()].find((x) => x.content === 'Call the bank'); theirs.content = 'Call the bank today'; theirs.updated_at = new Date(Date.now() + 5000).toISOString();
  await o.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateCollection('tasks', [], (list) => list.map((x) => x.text === 'Write the report' ? { ...x, text: 'Write the report (final)', updatedAt: Date.now() + 10000 } : x)); });
  await syncNow(); await o.waitForTimeout(400); l = await tasks();
  ok(l.some((x) => x.text === 'Call the bank today'), 'an edit made in Todoist arrived');
  ok([...svc.state.tasks.values()].some((x) => x.content === 'Write the report (final)'), 'an edit made here went to Todoist');
  ok(l.length === 2 && svc.state.tasks.size === 2, 'no duplicates: ' + l.length + ' here, ' + svc.state.tasks.size + ' there');

  // 5. the screen shows the button for the deletion setting, and the backup holds no secret
  ok(await o.getByRole('checkbox', { name: /Delete in both places/ }).count() === 1, 'the "delete in both places" switch is there');
  const backup = await o.evaluate(async () => JSON.stringify(await (await import('/src/shared/storage.js')).exportAll()));
  ok(!/tok-secret-123/.test(backup) && !/"conns"|connSecrets|"cl:/.test(backup), 'the backup holds no token, no connection and no pairs');
  ok(/tok-secret-123/.test(await o.evaluate(async () => JSON.stringify((await chrome.storage.local.get('connSecrets')).connSecrets || {}))), 'the token is kept on the device (and only there)');

  // 6. the service refuses the sign-in: the row asks to sign in again and nothing is lost
  svc.state.failNext = 401; await syncNow(); await o.waitForTimeout(500);
  c = await conn();
  ok(c && c.status && c.status.needsAuth === true, 'a refused token pauses the connection: ' + JSON.stringify(c && c.status));
  ok(await o.getByRole('button', { name: 'Sign in again' }).count() === 1, 'and the row offers to sign in again');
  ok((await tasks()).length === 2, 'no task was lost');

  // 7. disconnecting forgets everything of it and touches nothing on either side
  await o.getByRole('button', { name: /^Disconnect/ }).first().click(); await o.waitForTimeout(300);
  await o.locator('dialog[open]').getByRole('button', { name: 'Disconnect' }).click(); for (let i = 0; i < 40; i++) { // until everything of the connection is gone (the page removes it in steps; polling here, not an async predicate in waitForFunction, which not every Playwright version waits for)
    const gone = await o.evaluate(async () => { const a = await chrome.storage.local.get(null); return !Object.keys(a.conns || {}).length && !Object.keys(a.connSecrets || {}).length && !Object.keys(a).some((k) => k.startsWith('cl:')); });
    if (gone) break; await o.waitForTimeout(250);
  }
  await o.waitForTimeout(500);
  const left = await o.evaluate(async () => { const a = await chrome.storage.local.get(null); return { conns: Object.keys(a.conns || {}).length, secrets: Object.keys(a.connSecrets || {}).length, links: Object.keys(a).filter((k) => k.startsWith('cl:')) }; });
  ok(left.conns === 0 && left.secrets === 0 && !left.links.length, 'nothing of the connection is left: ' + JSON.stringify(left));
  ok((await tasks()).length === 2 && svc.state.tasks.size === 2, 'tasks on both sides stay as they are');
  ok(await o.getByRole('button', { name: 'Connect a service', exact: true }).count() === 1, 'the group is empty again');

  await app.close();
  if (bad.length) { console.log('FAIL\n' + bad.join('\n')); process.exit(1); }
  console.log('OK connections: group, dialog, first sync, edits both ways, refused sign-in, backup without secrets, disconnect');
})();
