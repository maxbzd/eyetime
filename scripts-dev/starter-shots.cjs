// Regenerates the preview pictures of the ready-made themes (src/newtab/starters/<id>.jpg): each starter applied to a profile with demo data at 1440x900, at a fixed morning time, shrunk to 480x300.
//   node scripts-dev/starter-shots.cjs        (run it after changing a starter in src/shared/starters.js)
const fs = require('fs');
const path = require('path');
const { launch } = require('./e2e/lib.cjs');

const OUT = path.join(__dirname, '..', 'src', 'newtab', 'starters');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const app = await launch({ viewport: { width: 1440, height: 900 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const sp = await app.ctx.newPage(); await sp.goto(ext('src/options/options.html')); await sp.waitForTimeout(600);
  const ids = await sp.evaluate(async () => {
    const st = await import('/src/shared/storage.js'), tm = await import('/src/shared/time.js');
    await st.setRaw({ gsDismissed: true });
    const keys = tm.rangeKeys(120); let n = 7; const rnd = () => (n = (n * 9301 + 49297) % 233280) / 233280;
    const hosts = ['github.com', 'docs.google.com', 'youtube.com', 'reddit.com', 'figma.com'];
    for (let i = 0; i < keys.length; i++) await st.updateDay(keys[i], (d) => { d.d = {}; d.h = {}; d.ss = []; d.fs = 0; d.fc = 0; hosts.forEach((h, k) => { d.d[h] = Math.round((k < 2 ? 0.5 + rnd() : rnd()) * 3600); }); const c = rnd() < 0.2 ? 0 : 1 + Math.floor(rnd() * 3); d.fc = c; for (let k = 0; k < c; k++) { const t = new Date(); t.setDate(t.getDate() - (119 - i)); t.setHours([9, 11, 15][Math.floor(rnd() * 3)], 5); const m = [25, 50, 90][Math.floor(rnd() * 3)]; d.ss.push({ id: 's' + i + k, t: t.getTime(), m, p: m, g: 'Work', k: '', c: 1, r: 2 }); d.fs += m * 60; } });
    const today = tm.dayKey(), tom = tm.dayKey(tm.addDays(new Date(), 1));
    await st.updateDay(today, (d) => { d.ss = [{ id: 'sx1', t: new Date().setHours(9, 5, 0, 0), m: 50, p: 50, g: 'Write', k: '', c: 1, r: 3 }]; d.fs = 3000; d.fc = 1; });
    await st.updateSettings((s) => { s.focus.dailyGoal = 120; s.onboarded = true; s.language = 'en'; s.newtab.links = [{ title: 'GitHub', url: 'https://github.com' }]; });
    await st.setCollection('tasks', [{ id: 'a', text: 'Write the launch post', done: false, starred: true, createdAt: 1, due: today }, { id: 'b', text: 'Review the pull requests', done: false, starred: true, createdAt: 2 }, { id: 'c', text: 'Plan next week', done: false, starred: false, createdAt: 3, due: tom }, { id: 'e', text: 'Book the dentist', done: false, starred: false, createdAt: 5 }]);
    const log = {}; for (let i = 0; i < 9; i++) log[tm.dayKey(tm.addDays(new Date(), -i))] = ['h1'];
    await st.setCollection('habits', { items: [{ id: 'h1', name: 'Read 20 pages' }], log });
    return (await import('/src/shared/starters.js')).STARTER_IDS;
  });
  const p = await app.ctx.newPage();
  p.on('pageerror', (e) => { console.error('page error', String(e)); process.exitCode = 1; });
  for (const id of ids) {
    await sp.evaluate(async (id) => {
      const st = await import('/src/shared/storage.js'), S = await import('/src/shared/starters.js');
      await st.updateSettings((s) => { s.newtab.layouts = []; S.applyStarter(s, s.newtab, S.starterData(S.STARTERS.find((x) => x.id === id))); });
    }, id);
    await p.clock.install({ time: new Date(2026, 9, 29, 10, 9, 0) });
    await p.goto(ext('src/newtab/newtab.html')); await p.waitForTimeout(1800);
    const png = (await p.screenshot()).toString('base64');
    const jpg = await sp.evaluate(async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = 480; c.height = 300; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, 480, 300);
      return c.toDataURL('image/jpeg', 0.8).split(',')[1];
    }, png);
    fs.writeFileSync(path.join(OUT, id + '.jpg'), Buffer.from(jpg, 'base64'));
    console.log(id, Math.round(Buffer.from(jpg, 'base64').length / 1024) + ' KB');
  }
  await app.close();
})();
