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

test('decimals and versions are not times', async () => {
  const { parseQuickAdd } = await import('../../src/shared/quickadd.js');
  const now = new Date(2026, 9, 20, 10, 0);
  for (const s of ['Pay 12.50 for rent', 'Read chapter 10.15', 'Version 1.10 release', 'Write report 9.30']) { const r = parseQuickAdd(s, now); assert.equal(r.at, null, s); assert.equal(r.text, s); }
  assert.equal(parseQuickAdd('Call Anna 9.30pm', now).at, '21:30');
  assert.equal(parseQuickAdd('Call Anna @9.30', now).at, '09:30');
  assert.equal(parseQuickAdd('Call Anna 16:45', now).at, '16:45');
});

test('repeat words inside a sentence stay in the task; clear phrases and a trailing keyword repeat it', () => {
  assert.deepEqual([parseQuickAdd('Prepare weekly report').text, parseQuickAdd('Prepare weekly report').repeat], ['Prepare weekly report', null]);
  assert.deepEqual([parseQuickAdd('Read the daily news 10m').text, parseQuickAdd('Read the daily news 10m').repeat], ['Read the daily news', null]);
  const a = parseQuickAdd('Stretch daily 10:30 5m'); assert.deepEqual([a.text, a.repeat, a.at, a.est], ['Stretch', 'daily', '10:30', 5]);
  assert.equal(parseQuickAdd('Plan the week every week').repeat, 'weekly');
  assert.equal(parseQuickAdd('Зарядка по будням').repeat, 'weekdays');
});

test('repeat phrases in Spanish, German, French and Portuguese', () => {
  const cases = [['Estirar cada día 10:30 5min', 'daily', 'Estirar'], ['Dehnen jeden Tag 10:30', 'daily', 'Dehnen'], ['Étirements chaque jour', 'daily', 'Étirements'], ['Alongar todo dia', 'daily', 'Alongar'],
    ['Informe semanal', 'weekly', 'Informe'], ['Bericht an Wochentagen', 'weekdays', 'Bericht'], ['Rapport en semaine', 'weekdays', 'Rapport'], ['Relatório dias úteis', 'weekdays', 'Relatório'], ['Revisar entre semana', 'weekdays', 'Revisar']];
  for (const [input, repeat, text] of cases) { const r = parseQuickAdd(input); assert.deepEqual([r.repeat, r.text], [repeat, text], input); }
  assert.equal(parseQuickAdd('Das tägliche Brot kaufen').repeat, null);
});
