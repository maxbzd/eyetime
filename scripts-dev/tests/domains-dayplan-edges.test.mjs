// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The edges of the host helpers and of "Plan my day", found by mutation testing (domains.js 68 %, dayplan.js 65 % of changes noticed before these).
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHost, hostFromUrl, parseUserDomain, matches, matchesAny, bestMatch, faviconUrl } from '../../src/shared/domains.js';
import { planDay, blockMinutes, hhmm, toMin } from '../../src/shared/dayplan.js';

test('hosts: lower case, no trailing dot, no www / m / mobile at the front, and only those', () => {
  assert.equal(normalizeHost('WWW.Example.COM.'), 'example.com'); assert.equal(normalizeHost('m.example.com'), 'example.com'); assert.equal(normalizeHost('mobile.example.com'), 'example.com');
  assert.equal(normalizeHost('www2.example.com'), 'www2.example.com'); assert.equal(normalizeHost('xwww.example.com'), 'xwww.example.com'); assert.equal(normalizeHost('a.www.example.com'), 'a.www.example.com');
  assert.equal(normalizeHost(''), ''); assert.equal(normalizeHost(null), ''); assert.equal(normalizeHost(undefined), '');
});

test('hostFromUrl: only web pages have a host; nothing else, and nothing that does not parse', () => {
  assert.equal(hostFromUrl('https://www.GitHub.com/a?b#c'), 'github.com'); assert.equal(hostFromUrl('http://news.example:8080/'), 'news.example');
  for (const bad of ['', null, undefined, 'chrome://extensions', 'chrome-extension://abc/x.html', 'file:///tmp/a.html', 'about:blank', 'ftp://example.com/', 'not a url', 'javascript:alert(1)', 'data:text/html,x']) assert.equal(hostFromUrl(bad), null, String(bad));
  assert.equal(hostFromUrl('https://localhost/'), 'localhost'); assert.equal(hostFromUrl('http://192.168.0.1/'), '192.168.0.1');
});

test('parseUserDomain: what a person types becomes a domain, or null', () => {
  assert.equal(parseUserDomain('  https://www.YouTube.com/watch?v=1  '), 'youtube.com'); assert.equal(parseUserDomain('youtube.com/'), 'youtube.com'); assert.equal(parseUserDomain('reddit.com:443'), 'reddit.com');
  assert.equal(parseUserDomain('m.facebook.com#x'), 'facebook.com'); assert.equal(parseUserDomain('sub.domain.co.uk'), 'sub.domain.co.uk'); assert.equal(parseUserDomain('LOCALHOST'), 'localhost');
  assert.equal(parseUserDomain('xn--80ak6aa92e.com'), 'xn--80ak6aa92e.com'); assert.equal(parseUserDomain('a-b.com'), 'a-b.com');
  for (const bad of ['', '   ', null, 'nodot', '-a.com', 'a-.com', 'a..com', 'a b.com', 'a.c', '1.2.3.4', 'ftp://', 'http://', '.com', 'a_b.com', 'ex ample.com', `${'a'.repeat(64)}.com`, `${'a.'.repeat(130)}com`]) assert.equal(parseUserDomain(bad), null, JSON.stringify(bad));
  assert.equal(parseUserDomain('a.' + 'b'.repeat(63)), 'a.' + 'b'.repeat(63), 'a label of 63 letters is the longest allowed'); assert.equal(parseUserDomain('a.b'), null, 'a one-letter ending is not a domain');
  assert.equal(parseUserDomain(`${'a'.repeat(63)}.com`), `${'a'.repeat(63)}.com`);
});

test('matches: the host itself or a subdomain of it, never a site that merely ends in the same letters, never nothing', () => {
  assert.equal(matches('a.example.com', 'example.com'), true); assert.equal(matches('example.com', 'example.com'), true);
  assert.equal(matches('notexample.com', 'example.com'), false); assert.equal(matches('example.com', 'a.example.com'), false);
  assert.equal(matches('', 'example.com'), false); assert.equal(matches('example.com', ''), false); assert.equal(matches(null, 'x'), false); assert.equal(matches('x', undefined), false);
  assert.equal(matchesAny('a.example.com', ['other.org', 'example.com']), true); assert.equal(matchesAny('a.example.com', ['other.org']), false);
  assert.equal(matchesAny('a.example.com', []), false); assert.equal(matchesAny('a.example.com', null), false); assert.equal(matchesAny('', ['example.com']), false); assert.equal(matchesAny(null, ['example.com']), false);
});

test('bestMatch: the most specific rule wins, the first of two equal ones stays, nothing is null', () => {
  assert.equal(bestMatch('a.b.example.com', ['example.com', 'b.example.com', 'a.b.example.com']), 'a.b.example.com');
  assert.equal(bestMatch('a.b.example.com', ['a.b.example.com', 'example.com']), 'a.b.example.com'); assert.equal(bestMatch('x.com', ['y.com']), null); assert.equal(bestMatch('x.com', null), null); assert.equal(bestMatch('x.com', []), null);
  assert.equal(bestMatch('a.example.com', ['example.com', 'a.example.com', 'b.example.com']), 'a.example.com');
});

test('faviconUrl: the extension\'s own favicon address, null where there is no extension API', () => {
  assert.equal(faviconUrl('example.com'), null, 'no chrome here');
  globalThis.chrome = { runtime: { getURL: (p) => 'chrome-extension://id' + p } };
  try {
    assert.equal(faviconUrl('example.com'), 'chrome-extension://id/_favicon/?pageUrl=https%3A%2F%2Fexample.com&size=32');
    assert.equal(faviconUrl('a b.com', 16), 'chrome-extension://id/_favicon/?pageUrl=https%3A%2F%2Fa%20b.com&size=16');
    globalThis.chrome = { runtime: {} }; assert.equal(faviconUrl('example.com'), null);
    globalThis.chrome = { runtime: { getURL: () => { throw new Error('gone'); } } }; assert.equal(faviconUrl('example.com'), null);
  } finally { delete globalThis.chrome; }
});

test('time of day helpers', () => {
  assert.equal(hhmm(0), '00:00'); assert.equal(hhmm(605), '10:05'); assert.equal(hhmm(1439), '23:59'); assert.equal(toMin('10:05'), 605); assert.equal(toMin('7'), 420); assert.equal(toMin('00:00'), 0);
});

test('blockMinutes: the estimate in steps of five, clamped to 15–90 minutes, scaled only when the person is clearly off', () => {
  const m = (est, calibration) => blockMinutes({ est }, { calibration });
  assert.equal(m(undefined), 25); assert.equal(m(0), 25); assert.equal(m(-5), 25); assert.equal(m(10), 15); assert.equal(m(46), 50); assert.equal(m(45), 45); assert.equal(m(200), 90);
  assert.equal(m(40, 1.15), 40, 'a calibration of 1.15 exactly is not far enough off'); assert.equal(m(40, 1.16), 50); assert.equal(m(40, 0.85), 40); assert.equal(m(40, 0.84), 35); assert.equal(m(40, 5), 80, 'scaled by at most two'); assert.equal(m(40, 0.1), 20, 'and at least a half');
  assert.equal(m(40, null), 40); assert.equal(m(40, 0), 40, 'a zero calibration is no calibration');
  assert.equal(blockMinutes({}, { defaultMinutes: 40 }), 40);
});

const task = (id, o = {}) => ({ id, text: id, createdAt: 1, ...o });
const plan = (o) => planDay({ nowMin: 9 * 60, today: '2026-11-04', workEnd: '18:00', ...o });

test('planDay: the first block starts at the next five minutes, breaks of 10 and 15 minutes follow in turn, and the list is in time order', () => {
  const r = plan({ tasks: [task('a', { est: 30 }), task('b', { est: 30 }), task('c', { est: 30 })] });
  assert.deepEqual(r.blocks.map((b) => [b.taskId, b.start, b.minutes, b.fixed]), [['a', '09:05', 30, false], ['b', '09:45', 30, false], ['c', '10:30', 30, false]]);
  assert.equal(r.calibrated, false);
});

test('planDay: priority first (starred, then planned for today, then oldest), at most four blocks by default and fewer when asked', () => {
  const tasks = [task('old', { createdAt: 1 }), task('new', { createdAt: 9 }), task('star', { starred: true, createdAt: 5 }), task('today', { planFor: '2026-11-04', createdAt: 7 }), task('five', { createdAt: 3 }), task('six', { createdAt: 4 })];
  assert.deepEqual(plan({ tasks }).blocks.map((b) => b.taskId), ['star', 'today', 'old', 'five']);
  assert.equal(plan({ tasks, maxBlocks: 2 }).blocks.length, 2);
});

test('planDay: tasks with a time today are fixed and everything else goes round them (with five minutes of air); tasks for another day are not moved', () => {
  const tasks = [task('call', { at: '09:30', atDay: '2026-11-04', est: 30 }), task('a', { est: 30 }), task('later', { at: '10:00', atDay: '2026-11-05' }), task('due', { due: '2026-11-06' }), task('b', { est: 30 })];
  const r = plan({ tasks });
  assert.deepEqual(r.blocks.map((b) => [b.taskId, b.start, b.fixed]), [['call', '09:30', true], ['a', '10:05', false], ['b', '10:45', false]], 'a would have run into the call, so it starts five minutes after it');
  assert.equal(r.blocks.some((b) => b.taskId === 'later' || b.taskId === 'due'), false);
  assert.equal(plan({ tasks: [task('x', { at: '09:30', atDay: '2026-11-04' })], today: '2026-11-05' }).blocks[0].fixed, false, 'a time on another day is not fixed today');
});

test('planDay: calendar meetings are avoided; the best hour is used when it is still ahead and fits; nothing is planned past the end of the work day', () => {
  assert.equal(plan({ tasks: [task('a', { est: 30 })], busy: [{ start: 9 * 60 + 10, end: 10 * 60 }] }).blocks[0].start, '10:05', 'after the meeting and five minutes');
  assert.equal(plan({ tasks: [task('a', { est: 30 })], bestStart: 14 }).blocks[0].start, '14:00');
  assert.equal(plan({ tasks: [task('a', { est: 30 })], bestStart: 8 }).blocks[0].start, '09:05', 'a best hour that has passed is ignored');
  assert.equal(plan({ tasks: [task('a', { est: 30 })], bestStart: 17.5 }).blocks[0].start, '17:30', 'half an hour before the end is still room');
  assert.equal(plan({ tasks: [task('a', { est: 30 })], bestStart: 17.6 }).blocks[0].start, '09:05', 'less than half an hour before the end is not');
  assert.equal(plan({ tasks: [task('a', { est: 30 })], bestStart: 17 }).blocks[0].start, '17:00');
  assert.deepEqual(plan({ tasks: [task('a', { est: 30 })], nowMin: 17 * 60 + 40 }).blocks, [], '17:45 + 30 minutes is after 18:00');
  assert.equal(plan({ tasks: [task('a', { est: 30 })], nowMin: 17 * 60 + 25 }).blocks.length, 1, '17:30 + 30 minutes ends exactly at 18:00: allowed');
  assert.equal(plan({ tasks: [task('a', { est: 30 })], nowMin: 22 * 60, workEnd: '02:00' }).blocks.length, 1, 'an end such as 02:00 means until midnight');
});

test('planDay: stops when the daily goal is met (after one block at least), and says whether the times were calibrated', () => {
  const tasks = [task('a', { est: 60 }), task('b', { est: 60 }), task('c', { est: 60 })];
  assert.equal(plan({ tasks, goalMinutes: 60 }).blocks.length, 1); assert.equal(plan({ tasks, goalMinutes: 61 }).blocks.length, 2); assert.equal(plan({ tasks, goalMinutes: 0 }).blocks.length, 3);
  assert.equal(plan({ tasks, calibration: 1.5 }).calibrated, true); assert.equal(plan({ tasks, calibration: 0.7 }).calibrated, true); assert.equal(plan({ tasks, calibration: 1.0 }).calibrated, false); assert.equal(plan({ tasks, calibration: 1.15 }).calibrated, false); assert.equal(plan({ tasks, calibration: null }).calibrated, false);
});

test('planDay: a fixed task counts toward the goal and a day with nothing to plan is empty', () => {
  assert.deepEqual(plan({ tasks: [] }).blocks, []);
  const r = plan({ tasks: [task('call', { at: '09:30', atDay: '2026-11-04', est: 60 }), task('a', { est: 30 })], goalMinutes: 60 });
  assert.deepEqual(r.blocks.map((b) => b.taskId), ['call', 'a'], 'the call already makes the goal, but one block is always planned');
});
