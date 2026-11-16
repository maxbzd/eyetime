// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The landing page speaks every language of the extension: site/lang/<code>.json holds one language each, keyed by data-t / data-ta in site/index.html.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LANGS } from '../../src/shared/usage-schema.js';

const root = new URL('../../site/', import.meta.url);
const page = fs.readFileSync(new URL('index.html', root), 'utf8');
const script = fs.readFileSync(new URL('landing.js', root), 'utf8');
const dict = (l) => JSON.parse(fs.readFileSync(new URL(`lang/${l}.json`, root), 'utf8'));
const en = dict('en');

// what the page itself says in English
const inPage = new Map();
for (const m of page.matchAll(/<span data-t="([a-z0-9-]+)">([\s\S]*?)<\/span>/g)) {
  if (inPage.has(m[1])) assert.equal(inPage.get(m[1]), m[2], `"${m[1]}" is said two ways in index.html`);
  inPage.set(m[1], m[2]);
}
const aria = new Map([...page.matchAll(/data-ta="([a-z-]+)" aria-label="([^"]*)"/g)].map((m) => [m[1], m[2]]));
const tags = (s) => [...s.matchAll(/<\/?(\w+)/g)].map((m) => m[0]).join(' ');
const digits = (s) => s.match(/\d+/g) || [];

test('every language of the extension has its file, and no other file is there', () => {
  const files = fs.readdirSync(new URL('lang/', root)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
  assert.deepEqual(files, [...LANGS].sort());
});

test('the English file is exactly what index.html says', () => {
  for (const [k, v] of inPage) assert.equal(en[k], v, `lang/en.json "${k}" differs from index.html`);
  for (const [k, v] of aria) assert.equal(en[k], v, `lang/en.json "${k}" differs from the aria-label in index.html`);
  assert.equal(en['task-value'], /id="fTask" value="([^"]*)"/.exec(page)[1]);
  assert.equal(en['meta-title'], /<title>([^<]*)<\/title>/.exec(page)[1]);
  assert.equal(en['meta-desc'], /<meta name="description" content="([^"]*)"/.exec(page)[1]);
  const extra = Object.keys(en).filter((k) => !inPage.has(k) && !aria.has(k) && !['task-value', 'meta-title', 'meta-desc'].includes(k));
  assert.deepEqual(extra, [], 'lang/en.json has keys that index.html never uses');
});

test('every key used by the script exists in the page', () => {
  for (const k of ['resume', 'pause', 'breathe-in', 'breathe-out', 'continue-in', 'continue-to-site', 'look-far-away', 'find-something-about-six-metres', 'well-done', 'eyes-thank-you', 'limit-set', 'set-limit', 'unit-min', 'greet-night', 'greet-morning', 'greet-afternoon', 'greet-evening']) {
    assert.ok(inPage.has(k), `index.html has no "${k}"`);
    assert.ok(script.includes(`'${k}'`) || k.startsWith('greet-') || k === 'unit-min' || k === 'set-limit' || k === 'pause', `landing.js does not use "${k}"`);
  }
});

for (const l of LANGS.filter((x) => x !== 'en')) {
  test(`${l}: the same keys as English, nothing empty, the same markup and numbers`, () => {
    const d = dict(l);
    assert.deepEqual(Object.keys(d), Object.keys(en), `${l}.json: keys or their order differ from en.json`);
    for (const [k, v] of Object.entries(d)) {
      assert.equal(typeof v, 'string', `${l}.json "${k}"`);
      assert.ok(v.trim().length > 0, `${l}.json "${k}" is empty`);
      assert.equal(tags(v), tags(en[k]), `${l}.json "${k}": different tags (only <em>, <br> and <a> are used, as in English)`);
      if (/<a /.test(v)) assert.match(v, /<a href=["']https:\/\/github\.com\/maxbzd\/eyetime\/[^"']*["']>/, `${l}.json "${k}": the link must stay a link to this project`);
      for (const n of digits(en[k])) assert.ok(digits(v).includes(n), `${l}.json "${k}": the number ${n} is missing`);
    }
    assert.ok(d['unit-h'] !== undefined && d['unit-m'] !== undefined);
  });
}

test('the page keeps its promises: nothing from another host, no way to select text, one cursor', () => {
  assert.doesNotMatch(page, /(?:src|href)="https?:\/\/(?!github\.com|chromewebstore\.google\.com|t\.me)/);
  assert.doesNotMatch(script, /fetch\('https?:/);
  const css = fs.readFileSync(new URL('landing.css', root), 'utf8');
  assert.match(css, /body \{[^}]*user-select: none/);
  assert.match(css, /html\.has-cur[^{]*\{ cursor: none !important/);
});
