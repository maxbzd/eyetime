import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIcs, nextEvent } from '../../src/shared/ics.js';

const from = new Date(2026, 9, 21, 8, 0); // Wed 21 Oct 2026, local
const wrap = (...ev) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...ev.flatMap((e) => ['BEGIN:VEVENT', ...e, 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n');

test('floating, UTC and zoned times become local wall-clock events', () => {
  const ics = wrap(
    ['UID:a', 'DTSTART:20261021T140000', 'DTEND:20261021T150000', 'SUMMARY:Team sync'],
    ['UID:b', 'DTSTART:20261022T090000Z', 'DTEND:20261022T093000Z', 'SUMMARY:UTC call'],
    ['UID:c', 'DTSTART;TZID=America/New_York:20261023T100000', 'DTEND;TZID=America/New_York:20261023T110000', 'SUMMARY:NY call'],
  );
  const ev = parseIcs(ics, { from });
  assert.deepEqual(ev[0], { id: 'a@2026-10-21', title: 'Team sync', day: '2026-10-21', start: '14:00', end: '15:00' });
  const utc = ev.find((e) => e.title === 'UTC call'); const ref = new Date(Date.UTC(2026, 9, 22, 9, 0));
  assert.equal(utc.start, `${String(ref.getHours()).padStart(2, '0')}:${String(ref.getMinutes()).padStart(2, '0')}`);
  const ny = ev.find((e) => e.title === 'NY call'); const nyRef = new Date(Date.UTC(2026, 9, 23, 14, 0)); // EDT = UTC-4 in late October
  assert.equal(ny.start, `${String(nyRef.getHours()).padStart(2, '0')}:${String(nyRef.getMinutes()).padStart(2, '0')}`);
});

test('all-day events are skipped; text escapes and folded lines are handled', () => {
  const ics = wrap(['UID:d', 'DTSTART;VALUE=DATE:20261021', 'SUMMARY:Holiday'], ['UID:e', 'DTSTART:20261021T100000', 'DTEND:20261021T103000', 'SUMMARY:Plan\\, review', ' \; part two']);
  const ev = parseIcs(ics, { from });
  assert.equal(ev.length, 1); assert.equal(ev[0].title, 'Plan, review; part two');
});

test('weekly recurrence with BYDAY, COUNT, UNTIL and EXDATE', () => {
  const ics = wrap(['UID:w', 'DTSTART:20261019T093000', 'DTEND:20261019T100000', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=5', 'EXDATE:20261026T093000', 'SUMMARY:Standup']);
  const days = parseIcs(ics, { from, days: 21 }).map((e) => e.day);
  // series: Mon19, Wed21, Mon26 (excluded), Wed28, Mon Nov 2 → count 5 includes the excluded one
  assert.deepEqual(days, ['2026-10-21', '2026-10-28', '2026-11-02']);
  const until = wrap(['UID:u', 'DTSTART:20261021T100000', 'DTEND:20261021T104500', 'RRULE:FREQ=DAILY;UNTIL=20261023T235959Z', 'SUMMARY:Daily']);
  assert.equal(parseIcs(until, { from, days: 14 }).length, 3);
  const biweekly = wrap(['UID:b2', 'DTSTART:20261021T100000', 'DTEND:20261021T110000', 'RRULE:FREQ=WEEKLY;INTERVAL=2', 'SUMMARY:Biweekly']);
  assert.deepEqual(parseIcs(biweekly, { from, days: 30 }).map((e) => e.day), ['2026-10-21', '2026-11-04', '2026-11-18']);
});

test('nextEvent finds the next or ongoing event today', () => {
  const ev = [{ id: '1', title: 'A', day: '2026-10-21', start: '09:00', end: '10:00' }, { id: '2', title: 'B', day: '2026-10-21', start: '14:00', end: '15:00' }, { id: '3', title: 'C', day: '2026-10-22', start: '08:00', end: '09:00' }];
  assert.equal(nextEvent(ev, '2026-10-21', 9 * 60 + 30).ongoing, true);
  const n = nextEvent(ev, '2026-10-21', 10 * 60 + 15); assert.equal(n.title, 'B'); assert.equal(n.inMin, 225);
  assert.equal(nextEvent(ev, '2026-10-21', 16 * 60), null);
});

test('long-running series, reminders, moved and cancelled occurrences', () => {
  const ics = wrap(
    ['UID:old', 'DTSTART:20240108T100000', 'DTEND:20240108T103000', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE', 'SUMMARY:Standup', 'BEGIN:VALARM', 'ACTION:EMAIL', 'SUMMARY:Alarm notification', 'END:VALARM'],
    ['UID:day', 'DTSTART:20261001T100000', 'DTEND:20261001T103000', 'RRULE:FREQ=DAILY', 'SUMMARY:Daily'],
    ['UID:day', 'RECURRENCE-ID:20261022T100000', 'DTSTART:20261022T150000', 'DTEND:20261022T153000', 'SUMMARY:Daily (moved)'],
    ['UID:day', 'RECURRENCE-ID:20261023T100000', 'DTSTART:20261023T100000', 'STATUS:CANCELLED', 'SUMMARY:Daily'],
    ['UID:x', 'DTSTART:20261021T120000', 'DTEND:20261021T130000', 'STATUS:CANCELLED', 'SUMMARY:Cancelled'],
  );
  const ev = parseIcs(ics, { from });
  assert.ok(ev.some((e) => e.title === 'Standup' && e.day === '2026-10-21'), 'a series from 2024 still appears');
  assert.ok(!ev.some((e) => e.title === 'Alarm notification'), 'a VALARM summary is not the title');
  assert.ok(!ev.some((e) => e.title === 'Cancelled'));
  const d22 = ev.filter((e) => e.day === '2026-10-22' && /Daily/.test(e.title));
  assert.deepEqual(d22.map((e) => [e.title, e.start]), [['Daily (moved)', '15:00']]);
  assert.ok(!ev.some((e) => e.day === '2026-10-23' && /Daily/.test(e.title)), 'a cancelled occurrence is gone');
  assert.ok(ev.some((e) => e.day === '2026-10-24' && e.title === 'Daily'));
});

test('MONTHLY 3rd Tuesday, bi-weekly BYDAY, date-only UNTIL / EXDATE, escapes', () => {
  const ics = wrap(
    ['UID:m', 'DTSTART:20260915T090000', 'DTEND:20260915T093000', 'RRULE:FREQ=MONTHLY;BYDAY=3TU', 'SUMMARY:Monthly'],
    ['UID:w', 'DTSTART:20261021T090000', 'DTEND:20261021T093000', 'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE', 'SUMMARY:Biweekly'],
    ['UID:u', 'DTSTART:20261019T080000', 'DTEND:20261019T083000', 'RRULE:FREQ=DAILY;UNTIL=20261022', 'EXDATE;VALUE=DATE:20261020', 'SUMMARY:Until'],
    ['UID:p', 'DTSTART:20261021T180000', 'DTEND:20261021T183000', 'SUMMARY:C:\\\\new'],
  );
  const ev = parseIcs(ics, { from, days: 30 });
  assert.deepEqual(ev.filter((e) => e.title === 'Monthly').map((e) => e.day), ['2026-11-17']);
  assert.deepEqual(ev.filter((e) => e.title === 'Biweekly').map((e) => e.day).slice(0, 4), ['2026-10-21', '2026-11-02', '2026-11-04', '2026-11-16']);
  assert.deepEqual(ev.filter((e) => e.title === 'Until').map((e) => e.day), ['2026-10-21', '2026-10-22']);
  assert.equal(ev.find((e) => e.id.startsWith('p@')).title, 'C:\\new');
});

test('a UTC series keeps its instant across clock changes', () => {
  const ics = wrap(['UID:z', 'DTSTART:20260715T130000Z', 'DTEND:20260715T133000Z', 'RRULE:FREQ=WEEKLY', 'SUMMARY:Utc weekly']);
  const ev = parseIcs(ics, { from: new Date(2026, 9, 26, 0, 0), days: 14 });
  for (const e of ev) { const [y, m, d] = e.day.split('-').map(Number); const local = new Date(y, m - 1, d, +e.start.slice(0, 2), +e.start.slice(3)); assert.equal(local.getUTCHours(), 13); }
  assert.ok(ev.length >= 2);
});
