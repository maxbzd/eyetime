// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The usage CSV: a header, a row per site or app per day, formulas made text, a day only once, an empty day skipped.
import test from 'node:test';
import assert from 'node:assert/strict';
import { usageCsv, CSV_BOM } from '../../src/shared/usagecsv.js';

const cls = (h) => (h.endsWith('github.com') ? 'productive' : 'neutral');

test('usageCsv: header, one row per site and app, the class of a site', () => {
  const out = usageCsv([['2026-11-01', { d: { 'github.com': 120, 'a.org': 5 }, a: { 'Code.exe': 60 } }]], cls).trim().split('\n');
  assert.deepEqual(out, ['date,domain,seconds,class', '2026-11-01,github.com,120,productive', '2026-11-01,a.org,5,neutral', '2026-11-01,Code.exe,60,app']);
});

test('usageCsv: a cell that would be a formula is made text, a comma or a quote is quoted', () => {
  const out = usageCsv([['2026-11-01', { d: {}, a: { '=HYPERLINK("http://x","y")': 9, '+cmd|calc': 1, 'My, "App"': 2, '@SUM(1)': 3 } }]], cls);
  assert.ok(out.includes(`"'=HYPERLINK(""http://x"",""y"")"`), out);
  assert.ok(out.includes("'+cmd|calc"), out);
  assert.ok(out.includes('"My, ""App"""'), out);
  assert.ok(out.includes("'@SUM(1)"), out);
  for (const line of out.trim().split('\n').slice(1)) assert.ok(!/^[^,]*,[=+\-@]/.test(line), 'no cell starts as a formula: ' + line);
});

test('usageCsv: an overlapping day counts once (the first wins), an empty day is skipped, bad numbers become 0', () => {
  const out = usageCsv([['2026-11-01', { d: { 'a.org': 1 } }], ['2026-11-01', { d: { 'a.org': 99 } }], ['2026-11-02', null], ['2026-11-03', { d: { 'b.org': 'x' } }]], cls).trim().split('\n');
  assert.deepEqual(out, ['date,domain,seconds,class', '2026-11-01,a.org,1,neutral', '2026-11-03,b.org,0,neutral']);
  assert.equal(usageCsv([], cls), 'date,domain,seconds,class\n');
});

test('the byte order mark is the one a spreadsheet needs', () => { assert.equal(CSV_BOM, '﻿'); });
