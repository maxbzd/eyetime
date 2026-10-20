import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuickAdd, estimateAccuracy } from '../../src/shared/quickadd.js';
import { fuzzyScore, rank } from '../../src/shared/fuzzy.js';

const NOW = new Date(2026, 9, 20, 10, 0);

test('quick add: time, estimate, priority, tags', () => {
  let r = parseQuickAdd('Write the report 14:30 45m !', NOW);
  assert.deepEqual([r.text, r.at, r.est, r.priority], ['Write the report', '14:30', 45, true]);
  assert.equal(r.atDay, '2026-10-20');
  r = parseQuickAdd('Call Sam @9:15 #work #calls 1.5h', NOW);
  assert.deepEqual([r.text, r.at, r.est, r.tags], ['Call Sam', '09:15', 90, ['work', 'calls']]);
  assert.equal(r.atDay, '2026-10-21'); // 09:15 already passed → tomorrow
  r = parseQuickAdd('Gym at 6pm', NOW); assert.deepEqual([r.text, r.at], ['Gym', '18:00']);
  r = parseQuickAdd('Лекция в 15:00 90 мин', NOW); assert.deepEqual([r.text, r.at, r.est], ['Лекция', '15:00', 90]);
  r = parseQuickAdd('Отчёт 2ч !', NOW); assert.deepEqual([r.text, r.est, r.priority], ['Отчёт', 120, true]);
});

test('quick add stays conservative', () => {
  for (const s of ['Buy 3 apples', 'Read chapter 12', 'Meeting room 204', 'Fix bug #123 in parser', 'Call 555.1234', 'Ship v2.1 tomorrow']) {
    const r = parseQuickAdd(s, NOW);
    assert.equal(r.at, null, s); assert.equal(r.est, null, s); assert.equal(r.priority, false, s);
  }
  assert.equal(parseQuickAdd('Buy 3 apples', NOW).text, 'Buy 3 apples');
  assert.equal(parseQuickAdd('Fix bug #123 in parser', NOW).tags[0], '123');
  assert.equal(parseQuickAdd('25m', NOW).text, '25m');             // nothing left → keep the original, never an empty task
  assert.equal(parseQuickAdd('  ', NOW).text, '');
  assert.equal(parseQuickAdd('Wait 25:99 here', NOW).at, null);    // invalid time
  assert.equal(parseQuickAdd('Do it 999m', NOW).est, null);        // implausible estimate
});

test('estimate accuracy (planning fallacy)', () => {
  const t = (est, min) => ({ id: String(Math.random()), text: 'x', done: true, est, focusSec: min * 60 });
  assert.equal(estimateAccuracy([t(25, 30), t(25, 60)]), null);                       // too few
  const a = estimateAccuracy([t(25, 50), t(30, 60), t(20, 35), t(45, 40)]);
  assert.equal(a.verdict, 'under'); assert.ok(a.median > 1.15 && a.n === 4);
  assert.equal(estimateAccuracy([t(25, 24), t(30, 31), t(20, 19)]).verdict, 'good');
  assert.equal(estimateAccuracy([t(60, 30), t(60, 35), t(50, 25)]).verdict, 'over');
  assert.equal(estimateAccuracy([{ done: false, est: 25, focusSec: 3000 }, t(25, 2), t(25, 2), t(25, 2)]), null); // open and tiny tasks are ignored
});

test('fuzzy: substring beats subsequence, word starts rank higher, no match = 0', () => {
  assert.ok(fuzzyScore('focus', 'Start focus 25 min') > fuzzyScore('fcs', 'Start focus 25 min'));
  assert.equal(fuzzyScore('xyz', 'Start focus'), 0);
  assert.ok(fuzzyScore('so', 'Settings: Sound') > fuzzyScore('so', 'Close the day'));
  assert.equal(fuzzyScore('', 'anything'), 1);
  const items = [{ label: 'Open Insights' }, { label: 'Open Settings' }, { label: 'Start focus' }];
  assert.deepEqual(rank('set', items).map((x) => x.label), ['Open Settings']);
  assert.deepEqual(rank('op', items).map((x) => x.label), ['Open Insights', 'Open Settings']);
  assert.equal(rank('zzz', items).length, 0);
});
