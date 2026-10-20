import test from 'node:test';
import assert from 'node:assert/strict';
import { taskFromInput } from '../../src/shared/tasks.js';

const now = new Date(2026, 9, 20, 10, 0);

test('taskFromInput keeps plain text plain', () => {
  const { task } = taskFromInput('Buy milk', [], now);
  assert.equal(task.text, 'Buy milk'); assert.equal(task.est, undefined); assert.equal(task.starred, false);
});

test('taskFromInput takes time, estimate, priority and tags', () => {
  const { task } = taskFromInput('Write report 14:30 45m ! #work', [], now);
  assert.equal(task.text, 'Write report'); assert.equal(task.est, 45); assert.equal(task.at, '14:30'); assert.equal(task.atDay, '2026-10-20'); assert.equal(task.starred, true); assert.deepEqual(task.tags, ['work']);
});

test('priority is dropped (and reported) when all slots are taken', () => {
  const full = [1, 2, 3].map((i) => ({ id: 'x' + i, starred: true, done: false }));
  const { task, prioDenied } = taskFromInput('Another ! thing', full, now);
  assert.equal(task.starred, false); assert.equal(prioDenied, true);
});
