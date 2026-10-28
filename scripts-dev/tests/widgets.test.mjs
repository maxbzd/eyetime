import test from 'node:test';
import assert from 'node:assert/strict';
import { WIDGET_KINDS, WORLD_ZONES, normalizeWidgets, normalizeCfg, defaultCfg, newWidgetId, countdownLeft, periodProgress, zoneCity, zoneClock, MAX_WIDGETS } from '../../src/shared/widgets.js';

const NOW = new Date(2026, 9, 28, 12, 0, 0); // 28 Oct 2026, noon, local time

test('normalizeWidgets keeps valid widgets only, with safe settings', () => {
  const list = normalizeWidgets([
    { id: 'wabc123', kind: 'countdown', cfg: { title: 'x'.repeat(200), date: 'nope', time: '25:99' } },
    { id: 'wabc123', kind: 'sticky', cfg: {} },          // duplicate id
    { id: 'bad id', kind: 'sticky' },                    // malformed id
    { id: 'wzzzzz1', kind: 'nope' },                     // unknown kind
    { id: 'wzzzzz2', kind: 'worldclock', cfg: { zones: ['Mars/Base', 'Asia/Tokyo', 'Asia/Tokyo'] } },
    null, 'x',
  ], NOW);
  assert.deepEqual(list.map((w) => w.id), ['wabc123', 'wzzzzz2']);
  assert.equal(list[0].cfg.title.length, 60); assert.equal(list[0].cfg.date, '2027-01-01'); assert.equal(list[0].cfg.time, '');
  assert.deepEqual(list[1].cfg.zones, ['Asia/Tokyo']);
  assert.deepEqual(normalizeWidgets(list, NOW), list);
  assert.deepEqual(normalizeWidgets('x'), []);
  assert.equal(normalizeWidgets(Array.from({ length: 80 }, (_, i) => ({ id: 'w' + String(i).padStart(5, '0'), kind: 'sticky' }))).length, MAX_WIDGETS);
});

test('every kind has defaults that validate to themselves', () => {
  for (const kind of Object.keys(WIDGET_KINDS)) { const d = defaultCfg(kind, NOW); assert.deepEqual(normalizeCfg(kind, d, NOW), d, kind); assert.ok(WIDGET_KINDS[kind].w[0] <= WIDGET_KINDS[kind].w[2] && WIDGET_KINDS[kind].w[2] <= WIDGET_KINDS[kind].w[1], kind); }
  assert.deepEqual(normalizeCfg('percent', { periods: ['year', 'bogus', 'day'] }), { periods: ['day', 'year'] });
  assert.deepEqual(normalizeCfg('bignumber', { metric: 'x' }), { metric: 'focusToday' });
  assert.deepEqual(normalizeCfg('mainfocus', { text: 'a', day: '2026-10-28', done: 1 }), { text: 'a', day: '2026-10-28', done: false });
});

test('every world zone is a real time zone', () => {
  for (const z of WORLD_ZONES) assert.doesNotThrow(() => new Intl.DateTimeFormat('en', { timeZone: z }), z);
  assert.equal(zoneCity('America/Argentina/Buenos_Aires'), 'Buenos Aires'); assert.equal(zoneCity('UTC'), 'UTC');
});

test('newWidgetId never repeats an id in use', () => {
  const used = [{ id: 'w000000' }];
  const id = newWidgetId(used, (() => { let n = 0; return () => (n++ === 0 ? 0 : 0.5); })());
  assert.notEqual(id, 'w000000'); assert.match(id, /^w[0-9a-z]{6}$/);
});

test('countdownLeft counts whole days, hours and minutes, and knows the past', () => {
  const a = countdownLeft('2026-11-01', '', NOW);
  assert.equal(a.past, false); assert.equal(a.calDays, 4); assert.equal(a.days, 3); assert.equal(a.hours, 12);
  const b = countdownLeft('2026-10-28', '18:30', NOW);
  assert.deepEqual([b.days, b.hours, b.minutes, b.sameDay], [0, 6, 30, true]);
  const c = countdownLeft('2026-10-25', '', NOW);
  assert.equal(c.past, true); assert.equal(c.calDays, -3);
});

test('periodProgress: day, Monday-first week, month, year', () => {
  assert.equal(periodProgress('day', NOW), 0.5);
  const wk = periodProgress('week', NOW); // Wednesday noon = 2.5 of 7 days
  assert.ok(Math.abs(wk - 2.5 / 7) < 1e-9, String(wk));
  assert.ok(Math.abs(periodProgress('month', NOW) - 27.5 / 31) < 1e-9);
  assert.ok(periodProgress('year', NOW) > 0.8 && periodProgress('year', NOW) < 0.85);
  assert.equal(periodProgress('day', new Date(2026, 0, 1, 0, 0, 0)), 0);
});

test('zoneClock formats a time and the day shift', () => {
  const z = zoneClock('Asia/Tokyo', new Date('2026-10-28T20:00:00Z'), 'en', true);
  assert.equal(z.time, '05:00'); assert.ok([0, 1].includes(z.dayShift));
  const u = zoneClock('UTC', new Date('2026-10-28T20:00:00Z'), 'en', false);
  assert.match(u.time, /8:00\s?PM/);
});

test('a stack keeps only real members, caps them, and puts the right one on top for the hour', async () => {
  const { normalizeCfg, defaultStack, stackIndex, partOfDay, STACKABLE, MAX_STACK, WIDGET_KINDS } = await import('../../src/shared/widgets.js');
  assert.ok(WIDGET_KINDS.stack && WIDGET_KINDS.plan && WIDGET_KINDS.recap);
  assert.ok(!STACKABLE.includes('stack'), 'a stack does not hold a stack');
  const n = normalizeCfg('stack', { items: [{ kind: 'stack' }, { kind: 'plan', when: 'weird' }, null, { kind: 'countdown', when: 'evening', cfg: { title: 'x'.repeat(200) } }, ...Array(10).fill({ kind: 'sticky' })], pick: 'manual', i: 99 });
  assert.equal(n.items.length, MAX_STACK); assert.deepEqual(n.items.slice(0, 2).map((x) => [x.kind, x.when]), [['plan', 'any'], ['countdown', 'evening']]);
  assert.equal(n.items[1].cfg.title.length, 60); assert.equal(n.pick, 'manual'); assert.equal(n.i, MAX_STACK - 1);
  assert.deepEqual(normalizeCfg('stack', { items: [] }), defaultStack()); assert.deepEqual(normalizeCfg('stack', 'x').items.map((x) => x.kind), ['plan', 'mainfocus', 'recap']);
  assert.deepEqual([4, 5, 11, 12, 17, 18, 22, 23, 0].map(partOfDay), ['night', 'morning', 'morning', 'day', 'day', 'evening', 'evening', 'night', 'night']);
  const st = defaultStack();
  assert.deepEqual([8, 14, 20, 2].map((h) => stackIndex(st, h)), [0, 1, 2, 0]); // at night nothing matches and nothing is "any": the first
  const any = { items: [{ when: 'any' }, { when: 'evening' }], pick: 'auto', i: 0 };
  assert.deepEqual([9, 19].map((h) => stackIndex(any, h)), [0, 1]); // "any" is the fallback
  assert.equal(stackIndex({ ...st, pick: 'manual', i: 1 }, 8), 1); // the person's choice wins
});
