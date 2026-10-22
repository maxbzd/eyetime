// Task sync end to end. The browser's storage.sync stands in for the cloud: this script plays "the other device" by writing the payload another browser would.
//   node scripts-dev/e2e/tasksync.cjs
const { launch } = require('./lib.cjs');

(async () => {
  const app = await launch({ viewport: { width: 1100, height: 900 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const page = await app.ctx.newPage(); await page.goto(ext('src/options/options.html#data')); await page.waitForTimeout(800);
  const bad = [];
  const T = (id, text, extra = {}) => ({ id, text, done: false, createdAt: 1, ...extra });
  const sync = () => page.evaluate(() => chrome.runtime.sendMessage({ type: 'sync:now' }));
  const local = () => page.evaluate(async () => (await chrome.storage.local.get('tasks')).tasks || []);
  const cloud = () => page.evaluate(async () => { const { unpackTasks } = await import('/src/shared/tasksync.js'); return unpackTasks(await chrome.storage.sync.get(null)); });
  const putCloud = (tasks) => page.evaluate(async (tasks) => { // what another browser would write
    const { packTasks, staleTaskKeys } = await import('/src/shared/tasksync.js');
    const all = await chrome.storage.sync.get(null); const p = packTasks(tasks, Date.now());
    await chrome.storage.sync.set(p.items); const stale = staleTaskKeys(all, p.count); if (stale.length) await chrome.storage.sync.remove(stale);
  }, tasks);
  const status = () => page.evaluate(async () => (await chrome.storage.local.get('tasksSyncStatus')).tasksSyncStatus);

  await page.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.onboarded = true; }); await chrome.storage.sync.clear(); });
  const hasSync = await page.evaluate(() => !!(chrome.storage && chrome.storage.sync));
  if (!hasSync) { console.log('SKIP tasksync: this browser build has no chrome.storage.sync'); await app.close(); return; }

  // off by default: nothing is uploaded
  await page.evaluate(async (t) => chrome.storage.local.set({ tasks: t }), [T('a', 'Write the report'), T('b', 'Call the bank')]);
  await sync();
  if (await cloud()) bad.push('tasks were uploaded although the switch is off');

  // switch on: they go up
  await page.evaluate(() => chrome.storage.local.set({ syncTasks: true })); await page.waitForTimeout(1200); await sync();
  let c = await cloud();
  if (!c || c.tasks.length !== 2) bad.push('first upload: ' + JSON.stringify(c && c.tasks.map((x) => x.id)));
  const st1 = await status(); if (!st1 || !st1.ok) bad.push('status not ok after upload: ' + JSON.stringify(st1));

  // the other browser adds a task and edits one; we pick both up
  await putCloud([T('a', 'Write the report (edited elsewhere)'), T('b', 'Call the bank'), T('c', 'Task from the other browser')]);
  await sync();
  let l = await local();
  if (!l.some((x) => x.id === 'c')) bad.push('a task from the other browser did not arrive');
  if (!l.some((x) => x.id === 'a' && /edited elsewhere/.test(x.text))) bad.push('an edit from the other browser did not arrive');

  // the other browser deletes b (unchanged here): it goes here too
  await putCloud([T('a', 'Write the report (edited elsewhere)'), T('c', 'Task from the other browser')]);
  await sync(); l = await local();
  if (l.some((x) => x.id === 'b')) bad.push('a task deleted in the other browser stayed here');

  // we add one: it goes up; ordering alone never makes a new upload
  await page.evaluate(async () => { const { tasks } = await chrome.storage.local.get('tasks'); await chrome.storage.local.set({ tasks: [{ id: 'd', text: 'Added here', done: false, createdAt: 2 }, ...tasks] }); });
  await page.waitForTimeout(500); await sync(); c = await cloud();
  if (!c.tasks.some((x) => x.id === 'd')) bad.push('a task added here did not go up');
  const ts1 = c.ts; await sync(); await sync(); const ts2 = (await cloud()).ts;
  if (ts1 !== ts2) bad.push('syncing with nothing new rewrote the cloud copy (would loop between devices)');

  // the cloud copy vanishes: nothing is deleted here, the list is uploaded again
  await page.evaluate(() => chrome.storage.sync.clear()); await sync();
  l = await local(); c = await cloud();
  if (l.length !== 3) bad.push('an empty cloud copy deleted local tasks: ' + l.length + ' left');
  if (!c || c.tasks.length !== 3) bad.push('the list was not uploaded again after the cloud copy vanished');

  // a newer EyeTime's payload is never overwritten
  await page.evaluate(() => chrome.storage.sync.set({ 'st:meta': { v: 99, n: 1, ts: 1 }, 'st:0': '[]' })); await sync();
  const st2 = await status(); const keep = await page.evaluate(async () => (await chrome.storage.sync.get('st:meta'))['st:meta'].v);
  if (keep !== 99) bad.push('a payload from a newer version was overwritten');
  if (!st2 || st2.ok || st2.error !== 'incompatible') bad.push('incompatible payload not reported: ' + JSON.stringify(st2));
  await page.evaluate(() => chrome.storage.sync.clear());

  // a backup never carries the sync bookkeeping
  const exported = await page.evaluate(async () => JSON.stringify(await (await import('/src/shared/storage.js')).exportAll()));
  if (/tasksBase|tasksSyncStatus/.test(exported)) bad.push('sync bookkeeping leaked into the backup');

  // the switch in Settings
  await page.evaluate(() => chrome.storage.local.set({ syncTasks: false })); await page.reload(); await page.waitForTimeout(900);
  const sw = page.locator('input[aria-label="Sync tasks too"]');
  if (!(await sw.count())) bad.push('Settings has no "Sync tasks too" switch');
  else {
    await sw.check({ force: true }); await page.waitForTimeout(800);
    if (!(await page.evaluate(async () => (await chrome.storage.local.get('syncTasks')).syncTasks))) bad.push('the switch did not turn task sync on');
  }
  console.log(bad.length ? 'FAIL task sync\n  ' + bad.join('\n  ') : 'PASS task sync (up, down, edits, deletions, empty cloud never wipes, newer version untouched, no rewrite loop)');
  await app.close(); process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
