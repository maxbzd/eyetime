import test from 'node:test';
import assert from 'node:assert/strict';
import { scrub, addEntry } from '../../src/shared/errorlog.js';
import { buildReport, issueUrl } from '../../src/shared/diagnostics.js';
import { DEFAULT_SETTINGS } from '../../src/shared/defaults.js';

test('scrub drops page URLs and keeps extension paths short', () => {
  const s = scrub('TypeError: x\n at https://reddit.com/r/secret?token=1 (chrome-extension://abcdef/src/a.js:1:2)\nmore\nmore\nmore\nmore');
  assert.doesNotMatch(s, /reddit|token|abcdef/); assert.match(s, /<url>/); assert.match(s, /ext:\/src\/a\.js/); assert.ok(s.split('\n').length <= 4);
});

test('error log merges repeats and caps its length', () => {
  let list = [];
  list = addEntry(list, { src: 'w', msg: 'boom', at: 1 }); list = addEntry(list, { src: 'w', msg: 'boom', at: 2 });
  assert.equal(list.length, 1); assert.equal(list[0].n, 2); assert.equal(list[0].at, 2);
  for (let i = 0; i < 40; i++) list = addEntry(list, { src: 'w', msg: 'e' + i, at: i });
  assert.equal(list.length, 20); assert.equal(list[0].msg, 'e39');
});

test('report has versions and counts but no names', () => {
  const settings = { ...DEFAULT_SETTINGS, blocking: { ...DEFAULT_SETTINGS.blocking, custom: ['secret-site.com'], always: ['x.com'] } };
  const r = buildReport({ version: '9.9.9', userAgent: 'Mozilla/5.0 Chrome/130', platform: 'Linux', language: 'ru', settings, counts: { days: 12, tasks: 3, notes: 1, habits: 0 }, bytes: 20480, errors: [{ src: 'worker', msg: 'oops', at: 0, n: 3 }], sync: false });
  assert.match(r, /EyeTime 9\.9\.9/); assert.match(r, /12 days · 3 tasks/); assert.match(r, /custom 1/); assert.match(r, /×3/); assert.match(r, /storage 20 KB/);
  assert.doesNotMatch(r, /secret-site|x\.com/);
  assert.ok(issueUrl(r).startsWith('https://github.com/maxbzd/eyetime/issues/new?'));
  assert.ok(issueUrl('a'.repeat(5000)).length < 4000);
});
