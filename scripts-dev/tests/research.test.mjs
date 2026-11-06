// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCsv, sus, summarize } from '../research/summarize.mjs';

test('research: the SUS score follows the textbook', () => {
  assert.equal(sus([5, 1, 5, 1, 5, 1, 5, 1, 5, 1]), 100);
  assert.equal(sus([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]), 50);
  assert.equal(sus([1, 5, 1, 5, 1, 5, 1, 5, 1, 5]), 0);
  assert.equal(sus([4, 2, 4, 1, 4, 2, 5, 1, 4, 2]), 82.5);
  assert.equal(sus([4, 2, 4, 1]), null); assert.equal(sus([4, 2, 4, 1, 4, 2, 5, 1, 4, 9]), null); assert.equal(sus([null, 2, 4, 1, 4, 2, 5, 1, 4, 2]), null);
});

test('research: the sheet is read with quotes, commas and line breaks inside fields', () => {
  const rows = parseCsv('id,quotes,x\r\nP01,"he said ""wow"", twice",1\nP02,"two\nlines",2\n');
  assert.deepEqual(rows, [{ id: 'P01', quotes: 'he said "wow", twice', x: '1' }, { id: 'P02', quotes: 'two\nlines', x: '2' }]);
});

test('research: the template sheet has the columns the protocol and the summary use, and its example row is ignored', () => {
  const rows = parseCsv(readFileSync(new URL('../../docs/research/observation-sheet.csv', import.meta.url), 'utf8'));
  assert.equal(rows.length, 1);
  const protocol = readFileSync(new URL('../../docs/research/protocol.md', import.meta.url), 'utf8');
  for (const col of Object.keys(rows[0]).filter((c) => !['id', 'date', 'group', 'language', 'browser', 'screen_width', 'scheme', 'coder'].includes(c))) {
    if (/^sus_\d+$/.test(col)) continue;
    assert.ok(protocol.includes('`' + col + '`'), `the protocol says where to fill \`${col}\``);
  }
  assert.equal(summarize(rows).sessions, 0, 'the example row P00 is not a session');
});

test('research: the summary and its warnings', () => {
  const row = (o) => ({ id: 'P01', first_look_understood_s: '10', first_session_started: 'yes', first_session_unaided: 'yes', first_session_time_s: '40', found_theme_change: 'yes', changed_look_back_ok: 'yes', opened_settings: 'yes', settings_lost: '0', eye_break_understood: 'yes', would_keep_installed: 'yes', blockers: '0', ...Object.fromEntries([5, 1, 5, 1, 5, 1, 5, 1, 5, 1].map((v, i) => ['sus_' + (i + 1), String(v)])), ...o });
  const good = summarize(Array.from({ length: 15 }, (_, i) => row({ id: 'P' + String(i + 1).padStart(2, '0') })));
  assert.equal(good.sessions, 15); assert.equal(good.firstSessionUnaided.pct, 100); assert.equal(good.sus.mean, 100); assert.deepEqual(good.flags, []);
  const bad = summarize([row({ id: 'P01', first_session_unaided: 'no', hint_needed_at: '2', first_session_time_s: '120', changed_look_back_ok: 'no', settings_lost: '4', sus_1: '1', sus_2: '5', sus_3: '1', sus_4: '5', sus_5: '1', sus_6: '5', sus_7: '1', sus_8: '5', sus_9: '1', sus_10: '5' })]);
  assert.ok(bad.flags.some((f) => /unaided/.test(f)) && bad.flags.some((f) => /90 s/.test(f)) && bad.flags.some((f) => /put the look back/.test(f)) && bad.flags.some((f) => /Settings/.test(f)) && bad.flags.some((f) => /SUS/.test(f)) && bad.flags.some((f) => /only 1 sessions/.test(f)));
  assert.ok(summarize([row({ id: 'P01', sus_1: '' })]).flags.some((f) => /missing values: P01/.test(f)));
});
