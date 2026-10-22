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

const WED = new Date(2026, 9, 21, 10, 0); // Wednesday 21 October 2026, 10:00
const due = (s) => { const r = parseQuickAdd(s, WED); return [r.text, r.due, r.atDay, r.at]; };

test('dates in words (English): tomorrow, weekdays, in N days, next week, ISO', () => {
  assert.deepEqual(due('Prepare the slides tomorrow'), ['Prepare the slides', '2026-10-22', null, null]);
  assert.deepEqual(due('Call mom today'), ['Call mom', '2026-10-21', null, null]);
  assert.deepEqual(due('Report on friday 45m'), ['Report', '2026-10-23', null, null]);
  assert.deepEqual(due('Report wednesday'), ['Report', '2026-10-28', null, null]);              // the same weekday as today means next week
  assert.deepEqual(due('Pay rent in 3 days'), ['Pay rent', '2026-10-24', null, null]);
  assert.deepEqual(due('Plan the quarter next week'), ['Plan the quarter', '2026-10-26', null, null]); // the coming Monday
  assert.deepEqual(due('Submit 2026-11-02'), ['Submit', '2026-11-02', null, null]);
  assert.deepEqual(due('Dentist tomorrow 9:30'), ['Dentist', null, '2026-10-22', '09:30']);       // a time pins the day on atDay
  assert.deepEqual(due('Ring Bob today 9:00'), ['Ring Bob', null, '2026-10-21', '09:00']);       // explicit "today" even if the time has passed
});

test('dates in words: Russian, Spanish, German, French, Portuguese', () => {
  const cases = [['Отчёт завтра', '2026-10-22', 'Отчёт'], ['Звонок в пятницу', '2026-10-23', 'Звонок'], ['Оплатить через 3 дня', '2026-10-24', 'Оплатить'], ['Врач послезавтра', '2026-10-23', 'Врач'],
    ['Informe mañana', '2026-10-22', 'Informe'], ['Llamar el lunes', '2026-10-26', 'Llamar'], ['Entrega pasado mañana', '2026-10-23', 'Entrega'], ['Pagar en 3 días', '2026-10-24', 'Pagar'],
    ['Bericht morgen', '2026-10-22', 'Bericht'], ['Anruf am Freitag', '2026-10-23', 'Anruf'], ['Miete in 3 Tagen', '2026-10-24', 'Miete'], ['Plan nächste Woche', '2026-10-26', 'Plan'],
    ['Rapport demain', '2026-10-22', 'Rapport'], ['Appeler vendredi', '2026-10-23', 'Appeler'], ['Payer dans 3 jours', '2026-10-24', 'Payer'], ['Réunion la semaine prochaine', '2026-10-26', 'Réunion'],
    ['Relatório amanhã', '2026-10-22', 'Relatório'], ['Ligar sexta-feira', '2026-10-23', 'Ligar'], ['Ligar na segunda', '2026-10-26', 'Ligar'], ['Pagar em 3 dias', '2026-10-24', 'Pagar']];
  for (const [input, day, text] of cases) assert.deepEqual(due(input).slice(0, 2), [text, day], input);
});

test('words that only look like dates stay in the title', () => {
  for (const s of ['Review the segunda parte', 'Read about Monday blues club', 'Sat on the sun', 'Pasado mañana tarde'.slice(0, 0) + 'Trabajo por la mañana', 'Check today’s PRs', 'Plan in 3 months', 'Зробити за тиждень']) {
    const r = parseQuickAdd(s, WED); assert.equal(r.due, s.startsWith('Read about Monday') ? '2026-10-26' : null, s);
  }
});

test('date words that are really ordinary words, repeats or past dates stay in the title', () => {
  const F = new Date(2026, 9, 23, 10, 0); // a Friday
  const on = (s, now = WED) => { const r = parseQuickAdd(s, now); return [r.text, r.due]; };
  assert.deepEqual(on('Настроить среду разработки'), ['Настроить среду разработки', null]);
  assert.deepEqual(on('Встреча в среду'), ['Встреча', '2026-10-28']);
  assert.deepEqual(on('Meditieren jeden Morgen'), ['Meditieren jeden Morgen', null]);
  assert.deepEqual(on('Stretch every monday'), ['Stretch every monday', null]);
  assert.deepEqual(on('Report this friday', F), ['Report', '2026-10-23']);   // "this friday" said on a Friday is today
  assert.deepEqual(on('Report friday', F), ['Report', '2026-10-30']);        // a bare weekday on its own day means next week
  assert.deepEqual(on('Report 2025-01-01'), ['Report 2025-01-01', null]);
  assert.deepEqual(on('Ligar no sábado'), ['Ligar', '2026-10-24']);
  assert.deepEqual(on('Ligar no domingo'), ['Ligar', '2026-10-25']);
});

test('dates in words: Italian, Polish, Ukrainian', () => {
  const cases = [['Relazione domani', '2026-10-22', 'Relazione'], ['Chiamare venerdì', '2026-10-23', 'Chiamare'], ['Pagare tra 3 giorni', '2026-10-24', 'Pagare'], ['Dentista dopodomani', '2026-10-23', 'Dentista'], ['Piano la settimana prossima', '2026-10-26', 'Piano'],
    ['Raport jutro', '2026-10-22', 'Raport'], ['Zadzwonić w piątek', '2026-10-23', 'Zadzwonić'], ['Zapłacić za 3 dni', '2026-10-24', 'Zapłacić'], ['Lekarz pojutrze', '2026-10-23', 'Lekarz'], ['Plan w przyszłym tygodniu', '2026-10-26', 'Plan'],
    ['Звіт завтра', '2026-10-22', 'Звіт'], ['Дзвінок у п’ятницю', '2026-10-23', 'Дзвінок'], ['Оплатити за 3 дні', '2026-10-24', 'Оплатити'], ['Лікар післязавтра', '2026-10-23', 'Лікар'], ['План наступного тижня', '2026-10-26', 'План']];
  for (const [input, day, text] of cases) assert.deepEqual(due(input).slice(0, 2), [text, day], input);
});

test('repeat phrases in Italian, Polish, Ukrainian', () => {
  const cases = [['Stretching ogni giorno', 'daily', 'Stretching'], ['Rozciąganie codziennie', 'daily', 'Rozciąganie'], ['Розтяжка щодня', 'daily', 'Розтяжка']];
  for (const [input, repeat, text] of cases) { const r = parseQuickAdd(input); assert.deepEqual([r.repeat, r.text], [repeat, text], input); }
});
