// Dependency-free unit tests: node scripts-dev/test.js
const assert = require('assert');
const B = require('../assets/blocking.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('✓ ' + name); };
const at = (day, h, m) => new Date(2026, 0, 4 + day, h, m); // 2026-01-04 is a Sunday → day 0

t('defaults block previous hard-coded distraction sites', () => {
  ['youtube.com', 'm.youtube.com', 'reddit.com', 'x.com', 'vk.com', 'tiktok.com', 'instagram.com', 'twitch.tv'].forEach(d => assert(B.isDistraction(d, {}), d));
  assert(!B.isDistraction('github.com', {}));
});
t('presets toggle and custom domains', () => {
  const s = { blocking: { presets: { news: true }, customDistractions: ['example.org'] } };
  assert(B.isDistraction('bbc.com', s)); assert(B.isDistraction('sub.example.org', s)); assert(!B.isDistraction('youtube.com', s));
});
t('allow-list wins over presets', () => {
  const s = { blocking: { presets: { video: true }, allowedDomains: ['youtube.com'] } };
  assert(!B.isDistraction('youtube.com', s)); assert(B.isDistraction('twitch.tv', s));
});
t('schedule: disabled by default', () => assert(!B.isScheduleActive({}, at(1, 10, 0))));
const sch = (o) => ({ blocking: { schedule: Object.assign({ enabled: true }, o) } });
t('schedule: weekday work hours', () => {
  const s = sch({});
  assert(B.isScheduleActive(s, at(1, 9, 0))); assert(B.isScheduleActive(s, at(5, 17, 59)));
  assert(!B.isScheduleActive(s, at(1, 8, 59))); assert(!B.isScheduleActive(s, at(1, 18, 0)));
  assert(!B.isScheduleActive(s, at(0, 12, 0))); assert(!B.isScheduleActive(s, at(6, 12, 0)));
});
t('schedule: overnight range', () => {
  const s = sch({ start: '22:00', end: '06:00', days: [1] }); // started Monday night
  assert(B.isScheduleActive(s, at(1, 23, 0))); assert(B.isScheduleActive(s, at(2, 5, 0)));
  assert(!B.isScheduleActive(s, at(1, 5, 0))); assert(!B.isScheduleActive(s, at(2, 23, 0)));
});
const R = require('../assets/report.js');
t('weekly report: compares last completed week with the previous one', () => {
  // now = Wed 2026-01-14 → last week = Mon 01-05..Sun 01-11, previous = 12-29..01-04
  const day = (k, total, domains, extra) => ({ [k]: Object.assign({ totalSeconds: total, domains }, extra || {}) });
  const stats = Object.assign({}, day('2026-01-05', 7200, { 'github.com': 3600, 'youtube.com': 3600 }, { focusSessions: 2, breaksCompleted: 3 }),
    day('2026-01-07', 3600, { 'github.com': 3600 }), day('2025-12-30', 7200, { 'github.com': 7200 }), day('2026-01-13', 9999, { 'x.com': 9999 }));
  const r = R.computeWeeklyReport(stats, d => d === 'youtube.com', new Date(2026, 0, 14));
  assert.strictEqual(r.weekKey, '2026-01-05'); assert.strictEqual(r.total, 10800); assert.strictEqual(r.deltaPct, 50);
  assert.strictEqual(r.distraction, 3600); assert.deepStrictEqual(r.topSites, ['github.com', 'youtube.com']);
  assert.strictEqual(r.focusSessions, 2); assert.strictEqual(r.breaks, 3);
});
t('weekly report: no previous data → no delta', () => {
  const r = R.computeWeeklyReport({ '2026-01-05': { totalSeconds: 60, domains: {} } }, null, new Date(2026, 0, 14));
  assert.strictEqual(r.deltaPct, null);
});
const P = require('../newtab/pack.js');
t('layout packing: complete rows keep their sizes', () => assert.deepStrictEqual(P.packRows([4, 4, 4, 6, 6], true), [4, 4, 4, 6, 6]));
t('layout packing: incomplete rows stretch to the full width', () => {
  assert.deepStrictEqual(P.packRows([4, 4, 6, 6], true), [6, 6, 6, 6]);
  assert.deepStrictEqual(P.packRows([8, 6, 6], true), [12, 6, 6]);
  assert.deepStrictEqual(P.packRows([3, 4, 4, 12], true), [4, 4, 4, 12]);
  assert.deepStrictEqual(P.packRows([5, 5, 5, 5], true).map((x, i, a) => a.slice(0, 2).concat(a.slice(2)).length && x), [6, 6, 6, 6]);
});
t('layout packing: a lone widget on the last row keeps its size; exact mode never stretches', () => {
  assert.deepStrictEqual(P.packRows([6, 6, 4], true), [6, 6, 4]);
  assert.deepStrictEqual(P.packRows([4, 4, 6, 6], false), [4, 4, 6, 6]);
});
t('layout packing: every row sums to 12 (random)', () => {
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let k = 0; k < 300; k++) {
    const base = Array.from({ length: 1 + Math.floor(rnd() * 14) }, () => 3 + Math.floor(rnd() * 10));
    const spans = P.packRows(base, true);
    let sum = 0, rows = [], cur = 0;
    spans.forEach((s, i) => { if (cur + s > 12) { rows.push(cur); cur = 0; } cur += s; });
    rows.push(cur);
    rows.slice(0, -1).forEach(r => assert.strictEqual(r, 12));
    assert(spans.every((s, i) => s >= base[i] && s <= 12));
  }
});
console.log(`\n${n} tests passed`);
