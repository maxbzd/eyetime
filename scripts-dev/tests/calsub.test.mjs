import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCalendarUrl } from '../../src/shared/calsub.js';

test('calendar addresses: https and webcal accepted, one permission pattern per address', () => {
  const g = normalizeCalendarUrl('  https://calendar.google.com/calendar/ical/me%40x.com/private-abc123/basic.ics ');
  assert.deepEqual([g.ok, g.host, g.pattern], [true, 'calendar.google.com', 'https://calendar.google.com/*']);
  const w = normalizeCalendarUrl('webcal://p01-caldav.icloud.com/published/2/abc');
  assert.deepEqual([w.ok, w.url.startsWith('https://'), w.pattern], [true, true, 'https://p01-caldav.icloud.com/*']);
  assert.equal(normalizeCalendarUrl('webcals://example.org/c.ics#frag').url.includes('#'), false);
});

test('calendar addresses: refuses anything that is not a plain calendar link', () => {
  for (const bad of ['', '   ', 'not a url', 'ftp://example.org/c.ics', 'javascript:alert(1)', 'http://example.org/c.ics', 'chrome://extensions', 'https://user:pw@example.org/c.ics', 'file:///etc/passwd']) assert.equal(normalizeCalendarUrl(bad).ok, false, bad);
  assert.equal(normalizeCalendarUrl('x'.repeat(2100)).ok, false);
});

test('calendar addresses: plain http only for this machine and only when a test build allows it', () => {
  assert.equal(normalizeCalendarUrl('http://127.0.0.1:8080/cal.ics').ok, false);
  assert.equal(normalizeCalendarUrl('http://localhost/cal.ics').ok, false);
  const l = normalizeCalendarUrl('http://127.0.0.1:8080/cal.ics', { allowLocalHttp: true });
  assert.deepEqual([l.ok, l.pattern], [true, 'http://127.0.0.1:8080/*']);
  assert.equal(normalizeCalendarUrl('http://example.org/c.ics', { allowLocalHttp: true }).ok, false); // never for other hosts
});
