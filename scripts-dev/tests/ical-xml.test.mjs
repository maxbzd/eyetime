import test from 'node:test';
import assert from 'node:assert/strict';
import { parseXml, find, findAll, textOf, escapeXml } from '../../src/shared/sync/xml.js';
import { parseVtodo, buildVtodo, patchVtodo, buildVevent, parseOurEvent, localTime, component, fold, unfold, escapeText, unescapeText, utcStamp } from '../../src/shared/sync/ical.js';

test('xml: a WebDAV multistatus is read, whatever the prefixes', () => {
  const x = parseXml(`<?xml version="1.0"?><!-- c --><D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav"><D:response><D:href>/cal/a&amp;b.ics</D:href><D:propstat><D:prop><D:getetag>"e1"</D:getetag><C:calendar-data><![CDATA[BEGIN:VCALENDAR
SUMMARY:x < y
END:VCALENDAR]]></C:calendar-data></D:prop></D:propstat></D:response><d:response><d:href>/cal/c.ics</d:href><d:status>HTTP/1.1 404 Not Found</d:status></d:response></D:multistatus>`);
  assert.equal(x.name, 'multistatus');
  const rs = findAll(x, 'response');
  assert.equal(rs.length, 2); assert.equal(textOf(find(rs[0], 'href')), '/cal/a&b.ics'); assert.equal(textOf(find(rs[0], 'getetag')), '"e1"');
  assert.match(textOf(find(rs[0], 'calendar-data')), /SUMMARY:x < y/);
  assert.match(textOf(find(rs[1], 'status')), /404/);
  assert.equal(parseXml('<a x="1" y=\'2\'><b/><c>t</c></a>').attrs.y, '2');
  assert.throws(() => parseXml('not xml'));
  assert.equal(escapeXml(`a<b>&"'`), 'a&lt;b&gt;&amp;&quot;&apos;');
});

test('ical: text escaping and folding round-trip', () => {
  const t = 'Buy milk, eggs; bread\nand a \\ slash';
  assert.equal(unescapeText(escapeText(t)), t);
  const long = 'SUMMARY:' + 'x'.repeat(200);
  assert.equal(unfold(fold(long)).join(''), long);
  assert.ok(fold(long).split('\r\n').every((l) => l.length <= 75));
});

test('ical: a to-do from another app is read (folded lines, a date, a priority, completed)', () => {
  const raw = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VTODO', 'UID:abc-1', 'SUMMARY:Pay the \\, invoice', ' with a long continuation', 'DUE;VALUE=DATE:20261201', 'PRIORITY:1', 'STATUS:NEEDS-ACTION', 'LAST-MODIFIED:20261101T101500Z', 'BEGIN:VALARM', 'TRIGGER:-PT15M', 'END:VALARM', 'END:VTODO', 'END:VCALENDAR'].join('\r\n');
  assert.deepEqual(parseVtodo(raw), { text: 'Pay the , invoicewith a long continuation', uid: 'abc-1', done: false, due: '2026-12-01', starred: true, recurring: false, updatedAt: Date.UTC(2026, 10, 1, 10, 15, 0) });
  assert.equal(parseVtodo(raw.replace('NEEDS-ACTION', 'COMPLETED')).done, true);
  assert.equal(parseVtodo(raw.replace('PRIORITY:1', 'PRIORITY:9')).starred, false);
  assert.equal(parseVtodo(raw.replace('STATUS:NEEDS-ACTION', 'RRULE:FREQ=DAILY')).recurring, true);
  assert.equal(parseVtodo('BEGIN:VCALENDAR\r\nEND:VCALENDAR'), null);
});

test('ical: changing a to-do changes only what changed; alarms and the other app\'s properties stay', () => {
  const raw = ['BEGIN:VCALENDAR', 'BEGIN:VTODO', 'UID:abc-1', 'SUMMARY:Old title', 'DUE;VALUE=DATE:20261201', 'PRIORITY:1', 'STATUS:NEEDS-ACTION', 'X-APPLE-SORT-ORDER:12345', 'SEQUENCE:2', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT15M', 'END:VALARM', 'END:VTODO', 'END:VCALENDAR', ''].join('\r\n');
  const now = Date.UTC(2026, 10, 4, 12, 0, 0);
  const out = patchVtodo(raw, { text: 'New, title', due: null, starred: false, done: true }, now);
  const p = parseVtodo(out);
  assert.deepEqual([p.text, p.due, p.starred, p.done], ['New, title', null, false, true]);
  assert.match(out, /X-APPLE-SORT-ORDER:12345/); assert.match(out, /BEGIN:VALARM[\s\S]*TRIGGER:-PT15M[\s\S]*END:VALARM/); assert.match(out, /SEQUENCE:3/); assert.match(out, /COMPLETED:20261104T120000Z/);
  const back = parseVtodo(patchVtodo(out, { done: false }, now));
  assert.equal(back.done, false); assert.ok(!/COMPLETED:/.test(patchVtodo(out, { done: false }, now)));
  const made = parseVtodo(buildVtodo({ uid: 'u1', text: 'Fresh; task', done: false, due: '2026-12-24', starred: true }, now));
  assert.deepEqual([made.text, made.due, made.starred, made.uid], ['Fresh; task', '2026-12-24', true, 'u1']);
});

test('ical: times are read as UTC, floating, or in a named zone, and the blocks EyeTime makes survive a round trip', () => {
  const at = (v, params = {}) => localTime({ name: 'DTSTART', params, value: v, i: 0 });
  assert.deepEqual(at('20261104'), { day: '2026-11-04', min: null });
  assert.deepEqual(at('20261104T093000'), { day: '2026-11-04', min: 570 }, 'floating is local');
  const utc = at('20261104T093000Z'), asDate = new Date(Date.UTC(2026, 10, 4, 9, 30));
  assert.deepEqual(utc, { day: `${asDate.getFullYear()}-${String(asDate.getMonth() + 1).padStart(2, '0')}-${String(asDate.getDate()).padStart(2, '0')}`, min: asDate.getHours() * 60 + asDate.getMinutes() });
  const berlin = at('20261104T100000', { TZID: 'Europe/Berlin' }), same = at('20261104T090000Z');
  assert.deepEqual(berlin, same, '10:00 in Berlin (UTC+1 in November) is 09:00 UTC');
  assert.equal(at('garbage'), null); assert.equal(localTime(undefined), null);
  const ics = buildVevent({ uid: 'eyetime-a-1@eyetime', taskId: 'a', title: 'Write, the report', day: '2026-11-04', start: 600, end: 645 }, Date.UTC(2026, 10, 4), 2);
  assert.deepEqual(parseOurEvent(ics), { uid: 'eyetime-a-1@eyetime', taskId: 'a', title: 'Write, the report', day: '2026-11-04', start: 600, end: 645, updatedAt: Date.UTC(2026, 10, 4), seq: 2 });
  assert.equal(parseOurEvent(ics.replace('eyetime-a-1', 'someone-else')), null, 'an event that is not ours is never read as one');
  assert.equal(parseOurEvent(ics.replace(/DTEND:.*\r\n/, 'DTEND;VALUE=DATE:20261105\r\n')), null, 'turned into an all-day event: no longer a block');
  assert.equal(component(ics, 'VEVENT').found, true);
  assert.match(utcStamp('2026-11-04', 600), /^20261104T\d{4}00Z$|^20261103T\d{4}00Z$|^20261105T\d{4}00Z$/);
});
