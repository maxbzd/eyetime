// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyUsage, normalizeUsage, record, buildReport, afterReport, reportDue, detectEnv, newId, dayNumber, ageOf, WEEK_MS } from '../../src/shared/usage.js';
import { validateReport, validateForget, FEATURES, REPORT_KEYS, LIMITS } from '../../src/shared/usage-schema.js';

const DAY = 86_400_000;
const T0 = new Date(2026, 10, 2, 9, 30).getTime();
const ctx = { id: 'f'.repeat(32), app: '3.5.0', br: 'chrome', os: 'linux', lang: 'en', look: 'calm', layout: 'today', mode: 'auto' };

test('usage: a day is a calendar day, whatever the time or the daylight-saving switch', () => {
  for (const [y, m, d] of [[2026, 2, 28], [2026, 2, 29], [2026, 9, 24], [2026, 9, 25], [2026, 10, 1]]) {
    const a = dayNumber(new Date(y, m, d, 0, 30).getTime()), b = dayNumber(new Date(y, m, d, 12).getTime()), c = dayNumber(new Date(y, m, d, 23, 59).getTime());
    assert.equal(a, b); assert.equal(b, c);
    assert.equal(dayNumber(new Date(y, m, d + 1, 0, 30).getTime()) - a, 1, `${y}-${m + 1}-${d}: the next day is one more`);
  }
});

test('usage: record counts a use, marks the day, keeps the first time, and ignores what is not on the list', () => {
  const u = emptyUsage(T0 - 3 * DAY);
  record(u, 'focus_start', T0); record(u, 'focus_start', T0 + 1000); record(u, 'focus_start', T0 + DAY); record(u, 'newtab_view', T0);
  record(u, 'github.com', T0); record(u, '__proto__', T0); record(u, 'constructor', T0);
  assert.deepEqual(u.days, [3, 4]);
  assert.equal(u.total.focus_start, 3); assert.equal(u.period.focus_start, 3);
  assert.equal(u.first.focus_start, 3); assert.equal(u.first.newtab_view, 3);
  assert.deepEqual(Object.keys(u.total).sort(), ['focus_start', 'newtab_view']);
  assert.equal(ageOf(u, T0), 3);
});

test('usage: the report is valid, small, and holds only numbers and names from the lists', () => {
  const u = emptyUsage(T0 - 200 * DAY);
  for (let d = 0; d < 200; d++) for (const f of FEATURES) record(u, f, T0 - (200 - d) * DAY); // the heaviest user there could be
  const r = buildReport(u, ctx, T0);
  assert.deepEqual(validateReport(r), { ok: true });
  assert.ok(JSON.stringify(r).length <= LIMITS.bytes, 'fits the limit: ' + JSON.stringify(r).length);
  assert.ok(Object.keys(r).every((k) => REPORT_KEYS.includes(k)));
  assert.ok(r.act.length <= LIMITS.days);
  // the only free-form strings are the four short names of the setup, and they are slugs
  const strings = [];
  (function walk(v) { if (typeof v === 'string') strings.push(v); else if (v && typeof v === 'object') Object.values(v).forEach(walk); })(r);
  for (const s of strings) assert.match(s, /^[a-z0-9.-]{1,32}$/, 'a string that could hold personal text: ' + s);
});

test('usage: the schema refuses what it does not know', () => {
  const ok = buildReport(emptyUsage(T0), ctx, T0);
  assert.equal(validateReport(ok).ok, true);
  for (const [name, bad] of [['extra key', { ...ok, domain: 'github.com' }], ['id', { ...ok, id: 'ABC' }], ['version', { ...ok, app: '3.5' }], ['lang', { ...ok, lang: 'xx' }], ['look with a space', { ...ok, look: 'my look' }],
    ['look too long', { ...ok, look: 'a'.repeat(25) }], ['feature name', { ...ok, ft: { 'github.com': 1 } }], ['float', { ...ok, age: 1.5 }], ['negative', { ...ok, ft: { focus_start: -1 } }], ['array', []], ['null', null],
    ['proto', JSON.parse('{"__proto__": 1}')], ['act as string', { ...ok, act: '1,2' }], ['too many days', { ...ok, act: Array.from({ length: 61 }, (_, i) => i) }]]) {
    assert.equal(validateReport(bad).ok, false, name);
  }
  assert.equal(validateForget({ v: 1, op: 'forget', id: ctx.id }), true);
  assert.equal(validateForget({ v: 1, op: 'forget', id: ctx.id, x: 1 }), false);
});

test('usage: the period starts again after a report, the history stays', () => {
  const u = emptyUsage(T0); record(u, 'focus_start', T0); record(u, 'focus_start', T0 + DAY);
  const before = buildReport(u, ctx, T0 + DAY); assert.equal(before.ft.focus_start, 2);
  afterReport(u);
  const after = buildReport(u, ctx, T0 + 2 * DAY);
  assert.deepEqual(after.ft, {}); assert.deepEqual(after.act, [0, 1]); assert.equal(after.first.focus_start, 0); assert.equal(u.total.focus_start, 2);
});

test('usage: a stored value that is damaged becomes a usable record', () => {
  for (const junk of [null, undefined, 5, 'x', [], {}, { v: 2 }, { v: 1, base: 'a' }]) assert.deepEqual(normalizeUsage(junk, T0).days, []);
  const n = normalizeUsage({ v: 1, base: 100, days: [5, 'a', -1, 3, 3, 1.5], first: { focus_start: 2, evil: 3, newtab_view: 'x' }, total: { focus_start: -4 }, period: [] }, T0);
  assert.deepEqual(n.days, [3, 5]); assert.deepEqual(n.first, { focus_start: 2 }); assert.deepEqual(n.total, {}); assert.deepEqual(n.period, {});
});

test('usage: when a report is due', () => {
  const on = { on: true, id: ctx.id, optInAt: T0 };
  assert.equal(reportDue(on, T0 + 3_600_000, true), false, 'not in the first hours');
  assert.equal(reportDue(on, T0 + 21 * 3_600_000, true), true, 'the day after turning it on');
  assert.equal(reportDue(on, T0 + 21 * 3_600_000, false), false, 'no collector configured');
  assert.equal(reportDue({ ...on, on: false }, T0 + 9 * DAY, true), false, 'switched off');
  assert.equal(reportDue({ ...on, id: undefined }, T0 + 9 * DAY, true), false, 'no id');
  const sent = { ...on, lastReportAt: T0 + DAY };
  assert.equal(reportDue(sent, T0 + 5 * DAY, true), false);
  assert.equal(reportDue(sent, T0 + DAY + WEEK_MS, true), true, 'a week after');
  assert.equal(reportDue({ ...sent, lastTryAt: T0 + DAY + WEEK_MS - 3_600_000 }, T0 + DAY + WEEK_MS, true), false, 'a failed try waits six hours');
  assert.equal(reportDue({ ...sent, lastTryAt: T0 + DAY + WEEK_MS - 7 * 3_600_000 }, T0 + DAY + WEEK_MS, true), true);
});

test('usage: the browser and the system are told apart coarsely, and nothing finer is kept', () => {
  assert.deepEqual(detectEnv('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', 'macOS'), { br: 'chrome', os: 'mac' });
  assert.deepEqual(detectEnv('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0', 'Windows'), { br: 'edge', os: 'win' });
  assert.deepEqual(detectEnv('Mozilla/5.0 (X11; Linux x86_64; rv:142.0) Gecko/20100101 Firefox/142.0', 'Linux'), { br: 'firefox', os: 'linux' });
  assert.deepEqual(detectEnv('Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', 'Chrome OS'), { br: 'chrome', os: 'cros' });
  assert.deepEqual(detectEnv('', ''), { br: 'other', os: 'other' });
});

test('usage: an id is 128 random bits and nothing else', () => {
  const a = newId(), b = newId();
  assert.match(a, /^[0-9a-f]{32}$/); assert.notEqual(a, b);
  assert.equal(newId((arr) => arr.fill(255)), 'f'.repeat(32));
});
