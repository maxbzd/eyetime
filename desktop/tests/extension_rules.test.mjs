// The extension's decision logic, with plain Node: node --test desktop/tests/extension_rules.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { verdict, hostOf, sameOrUnder } from '../extension/rules.js';

const on = (o) => ({ domains: [], keywords: [], exceptions: [], allowOnly: false, allowDomains: [], ...o });

test('nothing is closed when nothing is active, or without an answer', () => {
  assert.equal(verdict(null, 'https://youtube.com/').blocked, false);
  assert.equal(verdict(on({}), 'https://youtube.com/').blocked, false);
});

test('a site is closed with its subdomains and www, and only whole labels count', () => {
  const d = on({ domains: ['x.com', 'youtube.com'] });
  for (const u of ['https://x.com/home', 'https://www.x.com/', 'https://api.x.com/v1', 'https://m.youtube.com/watch?v=1']) assert.equal(verdict(d, u).blocked, true, u);
  for (const u of ['https://max.com/', 'https://notx.com/', 'https://example.org/x.com']) assert.equal(verdict(d, u).blocked, false, u);
  assert.equal(verdict(d, 'https://x.com/').why, 'site');
});

test('browser pages, files and the extension itself are never closed', () => {
  const d = on({ domains: ['x.com'], allowOnly: true });
  for (const u of ['chrome://settings', 'edge://extensions', 'about:blank', 'file:///C:/a.html', 'chrome-extension://abc/blocked.html', 'not a url']) assert.equal(verdict(d, u).blocked, false, u);
});

test('exceptions: a whole site, or addresses that begin so', () => {
  const d = on({ domains: ['youtube.com', 'reddit.com'], exceptions: ['old.reddit.com', 'youtube.com/watch?v=abc'] });
  assert.equal(verdict(d, 'https://old.reddit.com/r/rust').blocked, false);
  assert.equal(verdict(d, 'https://www.reddit.com/r/rust').blocked, true);
  assert.equal(verdict(d, 'https://www.youtube.com/watch?v=abc&t=5').blocked, false);
  assert.equal(verdict(d, 'https://www.youtube.com/watch?v=zzz').blocked, true);
});

test('everything but the allowed list', () => {
  const d = on({ allowOnly: true, allowDomains: ['docs.google.com'], exceptions: ['wikipedia.org'] });
  assert.equal(verdict(d, 'https://docs.google.com/d/1').blocked, false);
  assert.equal(verdict(d, 'https://en.wikipedia.org/wiki/Rust').blocked, false);
  const v = verdict(d, 'https://news.ycombinator.com/');
  assert.deepEqual([v.blocked, v.why], [true, 'only']);
});

test('words close a page by its address or its title, whatever the site', () => {
  const d = on({ keywords: ['casino'], domains: [] });
  assert.equal(verdict(d, 'https://example.com/best-casino-bonus').blocked, true);
  assert.equal(verdict(d, 'https://example.com/a', 'Online CASINO').blocked, true);
  assert.equal(verdict(d, 'https://example.com/a', 'Cooking').blocked, false);
  assert.equal(verdict(d, 'https://example.com/%D0%BA%D0%B0%D0%B7%D0%B8%D0%BD%D0%BE').blocked, false);
  assert.deepEqual(verdict(on({ keywords: ['казино'] }), 'https://example.com/%D0%BA%D0%B0%D0%B7%D0%B8%D0%BD%D0%BE'), { blocked: true, why: 'keyword', word: 'казино' });
});

test('an exception frees a page from the words too', () => {
  const d = on({ keywords: ['casino'], exceptions: ['example.com/casino-history'] });
  assert.equal(verdict(d, 'https://example.com/casino-history/1').blocked, false);
});

test('helpers', () => {
  assert.equal(hostOf('https://WWW.Example.com:8080/a'), 'example.com');
  assert.equal(hostOf('ftp://example.com'), null);
  assert.equal(sameOrUnder('a.b.com', 'b.com'), true);
  assert.equal(sameOrUnder('ab.com', 'b.com'), false);
});
