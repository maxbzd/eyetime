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
