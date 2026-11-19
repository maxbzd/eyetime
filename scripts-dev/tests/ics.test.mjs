// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIcs, parseIcsFull, nextEvent, resolveZone } from '../../src/shared/ics.js';
import { WINDOWS_ZONES } from '../../src/shared/winzones.js';

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
  const until = wrap(['UID:u', 'DTSTART:20261021T100000', 'DTEND:20261021T104500', 'RRULE:FREQ=DAILY;UNTIL=20261023T235959', 'SUMMARY:Daily']);
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

test('all-day events: DURATION instead of DTEND, and a multi-day weekly event across a DST change', async () => {
  const { parseIcsFull } = await import('../../src/shared/ics.js');
  const mk = (body) => ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:x', ...body, 'SUMMARY:Trip', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const from = new Date(2026, 9, 21);
  const r = parseIcsFull(mk(['DTSTART;VALUE=DATE:20261022', 'DURATION:P3D']), { from, days: 14 });
  assert.deepEqual(r.allDay.map((d) => d.day), ['2026-10-22', '2026-10-23', '2026-10-24']);
  const w = parseIcsFull(mk(['DTSTART;VALUE=DATE:20261025', 'DTEND;VALUE=DATE:20261027', 'RRULE:FREQ=WEEKLY']), { from: new Date(2026, 10, 2), days: 7 });
  assert.ok(w.allDay.some((d) => d.day === '2026-11-02')); // the second day of the occurrence that started on Nov 1
});

// ---- time zones as Outlook, Exchange and old Mozilla calendars name them ----
const zoned = (tz, day = '20261120', t = '100000') => `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:z\r\nSUMMARY:Call\r\nDTSTART;TZID=${tz}:${day}T${t}\r\nDTEND;TZID=${tz}:${day}T${String(Number(t.slice(0, 2)) + 1).padStart(2, '0')}${t.slice(2)}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
const slot = (tz, day) => { const e = parseIcsFull(zoned(tz, day), { from: new Date(2026, 5, 1), days: 400 }).events[0]; return e && `${e.day} ${e.start}`; };

test('every Windows zone name means a zone this browser knows', () => {
  assert.ok(WINDOWS_ZONES.size > 100);
  for (const [name, iana] of WINDOWS_ZONES) { const z = resolveZone(name); assert.ok(z, name); if (!/^utc/.test(name)) assert.equal(z, iana, name); } // "UTC" the browser knows by itself
});

test('an event in "Russian Standard Time" is the same moment as in Europe/Moscow, winter and summer', () => {
  for (const [win, iana] of [['Russian Standard Time', 'Europe/Moscow'], ['Pacific Standard Time', 'America/Los_Angeles'], ['W. Europe Standard Time', 'Europe/Berlin'], ['Eastern Standard Time', 'America/New_York'], ['India Standard Time', 'Asia/Kolkata']]) {
    for (const day of ['20261120', '20260715']) assert.equal(slot(win, day), slot(iana, day), `${win} on ${day}`);
  }
  // and it is not read as local time (the zones above differ from each other)
  assert.notEqual(slot('Pacific Standard Time', '20261120'), slot('Eastern Standard Time', '20261120'));
});

test('older names with a path in front, quoted names and odd case are read; a zone nobody knows stays local', () => {
  assert.equal(resolveZone('/mozilla.org/20050126_1/Europe/Berlin'), 'Europe/Berlin');
  assert.equal(resolveZone('/softwarestudio.org/Tzfile/America/New_York'), 'America/New_York');
  assert.equal(resolveZone('"Europe/Paris"'), 'Europe/Paris');
  assert.equal(resolveZone('russian standard time'), 'Europe/Moscow');
  assert.equal(resolveZone('Customized Time Zone'), null); assert.equal(resolveZone(''), null); assert.equal(resolveZone(undefined), null);
  assert.equal(slot('Customized Time Zone', '20261120'), '2026-11-20 10:00', 'an unknown zone is local time, as before');
});

test('a long daily series with a zone is read quickly (one formatter per zone)', () => {
  const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:long\r\nSUMMARY:Standup\r\nDTSTART;TZID=W. Europe Standard Time:20220103T093000\r\nDTEND;TZID=W. Europe Standard Time:20220103T094500\r\nRRULE:FREQ=DAILY;COUNT=2000\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
  const t0 = performance.now();
  const r = parseIcsFull(ics, { from: new Date(2026, 10, 19), days: 3 });
  assert.equal(r.events.length, 3);
  assert.ok(performance.now() - t0 < 400, `took ${Math.round(performance.now() - t0)} ms`);
});

// ---- BYSETPOS and BYMONTH: "the last workday of the month", "the second Sunday of March" ----
const series = (rrule, dt) => `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:s\r\nSUMMARY:X\r\nDTSTART:${dt}\r\nDTEND:${dt.slice(0, 9)}110000\r\nRRULE:${rrule}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
const daysOf = (rrule, dt, fromDate, n) => parseIcsFull(series(rrule, dt), { from: fromDate, days: n }).events.map((e) => e.day);

test('BYSETPOS picks one day of the month, not every day that matches', () => {
  const WORKDAYS = 'FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR';
  assert.deepEqual(daysOf(`${WORKDAYS};BYSETPOS=-1`, '20260105T100000', new Date(2026, 10, 1), 90), ['2026-11-30', '2026-12-31', '2027-01-29'], 'the last workday');
  assert.deepEqual(daysOf(`${WORKDAYS};BYSETPOS=1`, '20260105T100000', new Date(2026, 10, 1), 55), ['2026-11-02', '2026-12-01'], 'the first workday');
  assert.deepEqual(daysOf(`${WORKDAYS};BYSETPOS=1,-1`, '20260105T100000', new Date(2026, 10, 1), 30), ['2026-11-02', '2026-11-30'], 'the first and the last');
  assert.deepEqual(daysOf('FREQ=MONTHLY;COUNT=2;BYDAY=FR;BYSETPOS=-1', '20261001T100000', new Date(2026, 9, 1), 120), ['2026-10-30', '2026-11-27'], 'COUNT counts the picked days');
});

test('a yearly rule with BYMONTH keeps its month and its weekday', () => {
  assert.deepEqual(daysOf('FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', '20260308T100000', new Date(2027, 2, 1), 40), ['2027-03-14'], 'the second Sunday of March');
  assert.deepEqual(daysOf('FREQ=YEARLY;BYMONTH=3,9;BYMONTHDAY=1', '20260301T100000', new Date(2026, 7, 25), 20), ['2026-09-01'], 'two months a year');
  assert.deepEqual(daysOf('FREQ=YEARLY', '20260315T100000', new Date(2028, 2, 1), 30), ['2028-03-15'], 'no BYMONTH: the month and day of the start');
  assert.deepEqual(daysOf('FREQ=YEARLY;INTERVAL=2', '20260315T100000', new Date(2027, 2, 1), 30), [], 'every second year skips 2027');
});
