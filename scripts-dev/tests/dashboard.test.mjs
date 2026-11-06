// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The dashboard page is one file that draws numbers from a server and so must stay inert (no HTML built from data, no outside requests) and complete (every label in both languages).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ADOPTION, GROUPS } from '../../server/usage/stats.js';
import { FLAGS } from '../../src/shared/usage-schema.js';

const html = readFileSync(new URL('../../server/usage/dashboard.html', import.meta.url), 'utf8');
const script = /<script>([\s\S]*)<\/script>/.exec(html)[1];
const texts = new Function(script.slice(0, script.indexOf('// ───────────────────────── small helpers')) + '; return L;')();

test('dashboard: nothing from the server is ever turned into HTML, nothing is run from a string', () => {
  for (const bad of [/\.innerHTML/, /\.outerHTML/, /insertAdjacentHTML/, /document\.write/, /\beval\s*\(/, /new Function/, /setTimeout\s*\(\s*['"`]/, /srcdoc/]) assert.ok(!bad.test(script), String(bad));
});

test('dashboard: it asks only its own origin, and loads nothing from outside', () => {
  const urls = [...script.matchAll(/https?:\/\/[^\s'"`)]+/g)].map((m) => m[0]);
  assert.deepEqual(urls, ['http://www.w3.org/2000/svg'], 'the only URL in the script is the SVG namespace');
  assert.ok(!/<(link|img|iframe|object|embed|script)\b[^>]*\b(src|href)=/i.test(html.replace(/<script>[\s\S]*<\/script>/, '')), 'no external resource in the markup');
  assert.ok(!/@import|url\(\s*['"]?https?:/i.test(html), 'no outside style');
  for (const m of script.matchAll(/'(\/v1\/[a-z-]+)'/g)) assert.match(m[1], /^\/v1\/(stats|public-stats|demo-stats)$/);
  assert.ok(/credentials: 'omit'/.test(script) && /referrerPolicy: 'no-referrer'/.test(script));
});

/** Every key of a language, with arrays and objects walked. */
const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, p + k + '.') : [p + k + (Array.isArray(v) ? `[${v.length}]` : '')]));

test('dashboard: Russian and English have exactly the same texts', () => {
  assert.deepEqual(keys(texts.ru).sort(), keys(texts.en).sort());
  for (const lang of ['ru', 'en']) for (const k of keys(texts[lang])) { const v = k.split('.').reduce((a, x) => a?.[x.replace(/\[\d+\]$/, '')], texts[lang]); assert.ok(v !== '' && v != null, lang + ' ' + k); }
  // the same placeholders in both
  const holes = (s) => (typeof s === 'string' ? [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join() : '');
  for (const k of keys(texts.ru).filter((x) => !x.includes('['))) { const get = (l) => k.split('.').reduce((a, x) => a?.[x], texts[l]); assert.equal(holes(get('ru')), holes(get('en')), k); }
  assert.equal(texts.ru.csv_cols.length, 7); assert.equal(texts.en.csv_cols.length, 7);
});

test('dashboard: every feature, flag and bucket the collector can send has a name in both languages', () => {
  const ids = {
    fn: ADOPTION, fg: FLAGS,
    f_: ['reported', 'newtab', 'started', 'finished', 'days3', 'days7'], len_: ['fl_u15', 'fl_u25', 'fl_u35', 'fl_u50', 'fl_u75', 'fl_75p'],
    br_: ['bp_always', 'bp_focus', 'bp_schedule', 'bp_limit', 'bp_budget', 'bp_friction'], sp_b_: ['nt_u100', 'nt_u250', 'nt_u500', 'nt_u1000', 'nt_slow'],
    he_: ['err_worker', 'err_page', 'err_blocker', 'err_sync', 'err_other'], g_: Object.keys(GROUPS),
  };
  for (const lang of ['ru', 'en']) for (const [prefix, list] of Object.entries(ids)) for (const id of list) {
    const v = prefix === 'fn' || prefix === 'fg' ? texts[lang][prefix][id] : texts[lang][prefix + id];
    assert.ok(typeof v === 'string' && v.length > 1, `${lang}: ${prefix}${prefix === 'fn' || prefix === 'fg' ? '.' : ''}${id}`);
  }
});

test('dashboard: the page asks for a period only in the words the collector understands', () => {
  assert.ok(/range=all/.test(script) && /days=\$\{r\.kind\}/.test(script) && /from=\$\{r\.from\}&to=\$\{r\.to\}/.test(script));
});
