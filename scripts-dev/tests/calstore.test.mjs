import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateSubs, mergeSources, upcomingMeeting, inMeeting } from '../../src/shared/calstore.js';
import { parseIcsFull } from '../../src/shared/ics.js';

test('the single subscription of 3.0 becomes the first of up to three', () => {
  assert.deepEqual(migrateSubs({}), { subs: [], migrated: false });
  const m = migrateSubs({ calendarSub: { url: 'https://x.example/c.ics', host: 'x.example' } });
  assert.equal(m.migrated, true); assert.deepEqual([m.subs.length, m.subs[0].id, m.subs[0].host], [1, 'c1', 'x.example']);
  assert.equal(migrateSubs({ calendarSubs: [1, 2, 3, 4, 5] }).subs.length, 3);
});

test('sources are merged, sorted, with ids that cannot collide', () => {
  const ev = (id, day, start) => ({ id, day, start, end: '23:59', title: id });
  const r = mergeSources({ c1: { events: [ev('a', '2026-10-22', '10:00')], allDay: [{ id: 'd', day: '2026-10-22', title: 'Trip' }] }, file: { events: [ev('a', '2026-10-21', '09:00')], allDay: [] } });
  assert.deepEqual(r.events.map((e) => e.id), ['file:a', 'c1:a']);
  assert.deepEqual(r.allDay.map((e) => e.id), ['c1:d']);
  assert.deepEqual(mergeSources(undefined), { events: [], allDay: [] });
});

test('meeting warning and quiet: starts within N minutes / happening now', () => {
  const ev = [{ id: 'm', day: '2026-10-22', start: '10:00', end: '10:30', title: 'Sync' }];
  assert.equal(upcomingMeeting(ev, '2026-10-22', 9 * 60 + 58, 2).id, 'm');
  assert.equal(upcomingMeeting(ev, '2026-10-22', 9 * 60 + 50, 2), null);   // too early
  assert.equal(upcomingMeeting(ev, '2026-10-22', 10 * 60, 2), null);       // already started
  assert.equal(inMeeting(ev, '2026-10-22', 10 * 60 + 10).id, 'm');
  assert.equal(inMeeting(ev, '2026-10-22', 10 * 60 + 30), null);           // the end minute is free
  assert.equal(inMeeting(ev, '2026-10-23', 10 * 60 + 10), null);
});

test('all-day events: single, multi-day, recurring, cancelled; timed ones stay separate', () => {
  const wrap = (...ev) => ['BEGIN:VCALENDAR', ...ev.flatMap((e) => ['BEGIN:VEVENT', ...e, 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n');
  const ics = wrap(
    ['UID:a', 'DTSTART;VALUE=DATE:20261022', 'DTEND;VALUE=DATE:20261023', 'SUMMARY:Holiday'],
    ['UID:b', 'DTSTART;VALUE=DATE:20261023', 'DTEND;VALUE=DATE:20261026', 'SUMMARY:Conference'],
    ['UID:c', 'DTSTART;VALUE=DATE:20260101', 'RRULE:FREQ=YEARLY', 'SUMMARY:Never'],
    ['UID:d', 'DTSTART;VALUE=DATE:20261024', 'STATUS:CANCELLED', 'SUMMARY:Cancelled'],
    ['UID:e', 'DTSTART:20261022T100000', 'DTEND:20261022T103000', 'SUMMARY:Timed'],
  );
  const r = parseIcsFull(ics, { from: new Date(2026, 9, 21, 8, 0), days: 14 });
  assert.deepEqual(r.allDay.map((x) => [x.day, x.title]), [['2026-10-22', 'Holiday'], ['2026-10-23', 'Conference'], ['2026-10-24', 'Conference'], ['2026-10-25', 'Conference']]);
  assert.deepEqual(r.events.map((x) => x.title), ['Timed']);
});
