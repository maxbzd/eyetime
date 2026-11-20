// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
import test from 'node:test';
import assert from 'node:assert/strict';
import { isMoveBreak, exerciseOf, MOVE_EXERCISES } from '../../src/shared/moves.js';

test('every third break is a movement break; 0 and 1 mean never; nonsense means never', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((n) => isMoveBreak(n, 3)), [false, false, true, false, false, true, false]);
  for (const every of [0, 1, -3, 2.5, NaN, undefined, null, '3']) assert.equal(isMoveBreak(5, every), false, String(every));
  for (const taken of [-1, 1.5, NaN, undefined]) assert.equal(isMoveBreak(taken, 3), false, String(taken));
  assert.equal(isMoveBreak(1, 2), true, 'every second');
});

test('the exercise changes with each movement break and cycles through all of them', () => {
  const seq = []; for (let n = 2; n < 2 + 3 * MOVE_EXERCISES; n += 3) seq.push(exerciseOf(n, 3));
  assert.deepEqual(seq, Array.from({ length: MOVE_EXERCISES }, (_, i) => i + 1));
  assert.equal(exerciseOf(2 + 3 * MOVE_EXERCISES, 3), 1, 'then it starts over');
  assert.ok([0, 7, 99, -4].every((n) => { const e = exerciseOf(n, 3); return e >= 1 && e <= MOVE_EXERCISES; }));
});
