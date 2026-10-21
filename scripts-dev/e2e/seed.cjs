// Realistic demo data for the store screenshots and the demo video (30 days of browsing, sessions, tasks, habits).
async function seed(page, { look, mode, background, clockStyle }) {
  await page.evaluate(async ([look, mode, background, clockStyle]) => {
    const st = await import('/src/shared/storage.js');
    const { rangeKeys } = await import('/src/shared/time.js');
    await st.updateSettings((s) => {
      s.onboarded = true; s.language = 'en'; s.focus.dailyGoal = 120; s.blocking.plans = [{ id: 'p', when: '', then: 'stand up and drink water' }];
      Object.assign(s.appearance, { look, mode }); Object.assign(s.newtab, { background, clockStyle });
    });
    const keys = rangeKeys(30);
    const hosts = ['github.com', 'docs.google.com', 'youtube.com', 'reddit.com', 'news.ycombinator.com'];
    let n = 7; const rnd = () => (n = (n * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < keys.length; i++) {
      await st.updateDay(keys[i], (d) => {
        d.d = {}; d.h = {}; d.ss = []; d.fs = 0; d.fc = 0;
        hosts.forEach((h, k) => { const sec = Math.round((k < 2 ? 0.5 + rnd() : rnd()) * 4800); d.d[h] = sec; const W = [0.5, 1.2, 1.5, 1.1, 0.7, 0.25, 0.8, 1.3, 1.2, 0.9, 0.6, 0.25]; for (let hr = 8; hr < 20; hr++) { (d.h[hr] ||= {})[h] = Math.round((sec / 12) * W[hr - 8] * (0.7 + rnd() * 0.6)); } });
        const c = 1 + Math.floor(rnd() * 3); d.fc = c;
        for (let k = 0; k < c; k++) { const t = new Date(); t.setDate(t.getDate() - (29 - i)); t.setHours(k === 0 ? 9 : k === 1 ? 10 : 15, 5); d.ss.push({ id: 's' + i + k, t: t.getTime(), m: 25 + k * 25, p: 25 + k * 25, g: ['Write the quarterly report', 'Plan the sprint', 'Review pull requests'][k % 3], k: '', c: 1, r: 1 + ((i + k) % 3) }); d.fs += (25 + k * 25) * 60; }
        d.b = 2; d.pr = { back: 2, work: 1, bored: 1 }; d.sw = 20 + Math.floor(rnd() * 30); d.fa = Math.floor(rnd() * 4); d.pa = { 'reddit.com': 1 + Math.floor(rnd() * 5), 'youtube.com': Math.floor(rnd() * 4) }; if (i % 3 === 0) d.w = ['Shipped the draft', 'Finished the review', 'Walked every break'][(i / 3 | 0) % 3];
      });
    }
    await st.setCollection('tasks', [
      { id: 'a', text: 'Write the quarterly report', done: false, starred: true, createdAt: 1, est: 90, focusSec: 4500, resume: 'Draft section 2, then the charts' },
      { id: 'b', text: 'Review pull requests', done: false, starred: true, createdAt: 2, focusSec: 1500 },
      { id: 'c', text: 'Book flights for the conference', done: false, starred: false, createdAt: 3 },
      { id: 'd', text: 'Send the invoice', done: true, starred: false, createdAt: 4, focusSec: 900 }]);
    await st.setCollection('habits', [{ id: 'h1', text: 'Move 20 minutes', createdAt: 1, log: Object.fromEntries(keys.slice(-5).map((k) => [k, true])) }]);
  }, [look, mode, background, clockStyle]);
}
module.exports = { seed };
