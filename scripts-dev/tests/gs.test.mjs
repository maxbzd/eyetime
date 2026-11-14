// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
import test from 'node:test';
import assert from 'node:assert/strict';
import { stepsState } from '../../src/newtab/getting-started.js';

test('getting-started steps tick from real state', () => {
  const empty = stepsState({ days: [['2026-10-20', null]], settings: { sites: {} }, tasks: [], paletteUsed: false });
  assert.deepEqual(empty, { focus: false, classify: false, task: false, palette: false });
  const some = stepsState({ days: [['2026-10-19', { fs: 300 }], ['2026-10-20', { ss: [{ id: 1 }] }]], settings: { sites: { 'a.com': 'productive' } }, tasks: [{ id: 'x' }], paletteUsed: true });
  assert.deepEqual(some, { focus: true, classify: true, task: true, palette: true });
});

test('getting-started: saying what distracts you on the first run counts as the "teach it" step', () => {
  const s = stepsState({ days: [], settings: { sites: {} }, tasks: [], paletteUsed: false, taught: true });
  assert.deepEqual(s, { focus: false, classify: true, task: false, palette: false });
});
