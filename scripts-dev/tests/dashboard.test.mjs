// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The dashboard page is one file that draws numbers from a server and so must stay inert (no HTML built from data, no outside requests) and complete (every label in both languages).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ADOPTION, GROUPS, DIMS } from '../../server/usage/stats.js';
import { FLAGS } from '../../src/shared/usage-schema.js';

const html = readFileSync(new URL('../../server/usage/dashboard.html', import.meta.url), 'utf8');
const script = /<script>([\s\S]*)<\/script>/.exec(html)[1];
const PAGE_IDS = ['overview', 'growth', 'activation', 'retention', 'features', 'product', 'quality', 'audience', 'method'];
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

/** Every key of a language (the keys are flat: "fn.focus_start", "ins.weak"); a list counts with its length. */
const keys = (o) => Object.entries(o).map(([k, v]) => k + (Array.isArray(v) ? `[${v.length}]` : ''));

test('dashboard: Russian and English have exactly the same texts', () => {
  assert.deepEqual(keys(texts.ru).sort(), keys(texts.en).sort());
  for (const lang of ['ru', 'en']) for (const [k, v] of Object.entries(texts[lang])) assert.ok(Array.isArray(v) ? v.length > 0 && v.every((x) => String(x).trim()) : String(v).trim().length > 0, lang + ' ' + k);
  // the same placeholders in both
  const holes = (s) => (typeof s === 'string' ? [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join() : '');
  for (const k of Object.keys(texts.ru)) assert.equal(holes(texts.ru[k]), holes(texts.en[k]), k);
  assert.equal(texts.ru.csv_cols.length, 7); assert.equal(texts.en.csv_cols.length, 7);
  assert.ok(Number(texts.ru.gl_n) >= 15, 'the glossary explains every figure');
});

test('dashboard: every feature, flag, bucket, page and setting the collector can send has a name in both languages', () => {
  const ids = {
    'fn.': ADOPTION, 'fg.': FLAGS, f_: ['reported', 'newtab', 'started', 'finished', 'days3', 'days7'], len_: ['fl_u15', 'fl_u25', 'fl_u35', 'fl_u50', 'fl_u75', 'fl_75p'],
    br_: ['bp_always', 'bp_focus', 'bp_schedule', 'bp_limit', 'bp_budget', 'bp_friction'], sp_b_: ['nt_u100', 'nt_u250', 'nt_u500', 'nt_u1000', 'nt_slow'],
    he_: ['err_worker', 'err_page', 'err_blocker', 'err_sync', 'err_other'], g_: Object.keys(GROUPS), dp_: ['d1', 'd2', 'd4', 'd8', 'd15'], fs_: ['d0', 'd1', 'd2_3', 'd4_7', 'later', 'never'],
    d_: DIMS, pg_: PAGE_IDS, q_: PAGE_IDS,
  };
  for (const lang of ['ru', 'en']) for (const [prefix, list] of Object.entries(ids)) for (const id of list) assert.ok(typeof texts[lang][prefix + id] === 'string' && texts[lang][prefix + id].length > 1, `${lang}: ${prefix}${id}`);
  for (const v of ['auto', 'dark', 'light']) assert.ok(texts.ru['m_' + v] && texts.en['m_' + v]);
});

test('dashboard: every page has a builder, a name and a question', () => {
  const m = /const PAGE_FN = \{([^}]*)\}/.exec(script)[1], built = [...m.matchAll(/(\w+): page\w+/g)].map((x) => x[1]);
  assert.deepEqual(built.sort(), [...PAGE_IDS].sort());
});

test('dashboard: the page asks for a period only in the words the collector understands', () => {
  assert.ok(/range=all/.test(script) && /days=\$\{r\.kind\}/.test(script) && /from=\$\{r\.from\}/.test(script) && /to=\$\{r\.to\}/.test(script));
  const dimsInPage = /DIMS = \[([^\]]*)\]/.exec(script)[1].replace(/['\s]/g, '').split(',');
  assert.deepEqual(dimsInPage, DIMS, 'the page narrows by the same settings the collector knows');
});
