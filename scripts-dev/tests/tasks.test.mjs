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

import { updateEstLog, accuracyInput, EST_LOG_MAX } from '../../src/shared/tasks.js';

test('estimate log keeps finished estimated tasks and drops reopened ones', () => {
  let log = updateEstLog([], { id: 'a', text: 'A', est: 30, focusSec: 2000, done: true, doneAt: 5 });
  assert.equal(log.length, 1);
  assert.equal(updateEstLog(log, { id: 'b', text: 'B', done: true }).length, 1); // no estimate: not logged
  assert.equal(updateEstLog(log, { id: 'a', est: 30, done: false }).length, 0);   // reopened: removed
  for (let i = 0; i < EST_LOG_MAX + 10; i++) log = updateEstLog(log, { id: 'x' + i, text: 'T', est: 5, done: true });
  assert.equal(log.length, EST_LOG_MAX);
});

test('accuracyInput prefers live tasks over log entries', () => {
  const out = accuracyInput([{ id: 'a', est: 10, focusSec: 900, done: true }], [{ id: 'a', est: 10, focusSec: 1, text: 'old' }, { id: 'z', est: 20, focusSec: 1200, text: 'Z' }]);
  assert.equal(out.length, 2); assert.equal(out.find((x) => x.id === 'a').focusSec, 900); assert.equal(out.find((x) => x.id === 'z').done, true);
});
