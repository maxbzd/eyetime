// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
import test from 'node:test';
import assert from 'node:assert/strict';
import { safeHref, cleanLinks, cleanOutsideSettings, listOfObjects } from '../../src/shared/settings-clean.js';
import { sanitizeCustomCss } from '../../src/shared/looks.js';
import { deepMerge, DEFAULT_SETTINGS } from '../../src/shared/defaults.js';
import { tasksToCsv } from '../../src/shared/taskio.js';

test('only http(s) addresses are links: a file cannot bring a javascript: link onto the page', () => {
  assert.equal(safeHref('https://example.com/a?b=1'), 'https://example.com/a?b=1');
  for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'data:text/html,<b>', 'chrome-extension://x/y', 'file:///etc/passwd', 'ftp://x', '', null, 5]) assert.equal(safeHref(bad), '', String(bad));
  const out = cleanLinks([{ url: 'javascript:alert(1)', title: 'x' }, { url: 'https://a.test', title: 'A' }, 'junk', null, { url: 'http://b.test' }]);
  assert.deepEqual(out.map((l) => l.url), ['https://a.test/', 'http://b.test/']);
  assert.equal(out[1].title, 'b.test', 'a link without a title shows its host');
  assert.equal(cleanLinks(Array.from({ length: 200 }, (_, i) => ({ url: `https://s${i}.test`, title: 't' }))).length, 80);
});

test('settings from outside are cleaned and the input is not changed', () => {
  const input = { newtab: { links: [{ url: 'javascript:alert(1)', title: 'x' }], other: 1 }, keep: true };
  const out = cleanOutsideSettings(input);
  assert.deepEqual(out.newtab.links, []); assert.equal(out.newtab.other, 1); assert.equal(out.keep, true);
  assert.equal(input.newtab.links.length, 1, 'the input stays as it was');
  assert.equal(cleanOutsideSettings(null), null);
});

test('a list of objects is a list of objects', () => {
  assert.deepEqual(listOfObjects([{ a: 1 }, 'x', null, [1], 5, { b: 2 }]), [{ a: 1 }, { b: 2 }]);
  for (const bad of ['x', 5, {}, null, undefined]) assert.deepEqual(listOfObjects(bad), []);
});

test('custom CSS: escapes cannot hide an import or a remote address', () => {
  for (const bad of ['@\\69mport "x";', '@\\000069mport "x";', '.a{background:u\\72l(https://e.test/x)}', '.a{background:url(//e.test/x)}', '.a{background:url(ftp://e.test/x)}', '.a{background:url(chrome-extension://x/y.png)}',
    '.a{background:image-set("https://e.test/x" 1x)}', '.a{background:-webkit-image-set(url(data:image/png;base64,AA) 1x, "https://e.test/y" 2x)}', '.a{content:src("https://e.test")}', '@namespace url(http://e.test);'])
    assert.equal(sanitizeCustomCss(bad).ok, false, bad);
  for (const good of ['.card { border-radius: 2px }', '.a{background:url(data:image/png;base64,AAA)}', '.a{filter:url(#blur)}', '/* @import is only a word here */ .a{color:red}'])
    assert.equal(sanitizeCustomCss(good).ok, true, good);
});

test('a "__proto__" key in settings from a file does not reach the prototype', () => {
  const evil = JSON.parse('{"__proto__": {"polluted": true}, "constructor": {"x": 1}, "newtab": {"__proto__": {"p2": true}}}');
  const out = deepMerge(DEFAULT_SETTINGS, evil);
  assert.equal(out.polluted, undefined); assert.equal(Object.getPrototypeOf(out), Object.prototype); assert.equal(out.newtab.p2, undefined);
  assert.equal({}.polluted, undefined);
});

test('a task that starts like a formula is exported as text', () => {
  const csv = tasksToCsv([{ id: '1', text: '=HYPERLINK("http://e.test","x")', done: false }, { id: '2', text: '+1 call', done: false }, { id: '3', text: '@SUM(A1)', done: false }, { id: '4', text: 'plain', done: false }]);
  const lines = csv.split('\n');
  assert.ok(lines[1].startsWith('"\'=HYPERLINK'), lines[1]); assert.ok(lines[2].startsWith("'+1 call"), lines[2]); assert.ok(lines[3].startsWith("'@SUM"), lines[3]); assert.ok(lines[4].startsWith('plain'), lines[4]);
});

test('Enter that confirms a character in an input method is not an Enter that submits', async () => {
  const { isEnter } = await import('../../src/ui/dom.js');
  assert.equal(isEnter({ key: 'Enter', isComposing: false, keyCode: 13 }), true);
  assert.equal(isEnter({ key: 'Enter', isComposing: true, keyCode: 229 }), false, 'Chrome and Firefox: still composing');
  assert.equal(isEnter({ key: 'Enter', isComposing: false, keyCode: 229 }), false, 'Safari: the composition has already ended, the key code still says so');
  assert.equal(isEnter({ key: 'a', isComposing: false, keyCode: 65 }), false);
});
