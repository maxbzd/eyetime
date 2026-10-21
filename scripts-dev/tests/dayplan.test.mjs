import test from 'node:test';
import assert from 'node:assert/strict';
import { planDay, blockMinutes, hhmm, toMin } from '../../src/shared/dayplan.js';

const today = '2026-10-21';
const T = (id, o = {}) => ({ id, text: id, createdAt: 1, ...o });

test('block length: estimate, calibration, clamps', () => {
  assert.equal(blockMinutes(T('a')), 25);
  assert.equal(blockMinutes(T('a', { est: 45 })), 45);
  assert.equal(blockMinutes(T('a', { est: 40 }), { calibration: 1.5 }), 60);   // takes you 1.5× longer
  assert.equal(blockMinutes(T('a', { est: 5 })), 15);                            // never below 15
  assert.equal(blockMinutes(T('a', { est: 200 })), 90);                          // never above 90
  assert.equal(blockMinutes(T('a', { est: 40 }), { calibration: 1.05 }), 40);   // close enough: no scaling
});

test('priorities first, best hour preferred, breaks between blocks, stops at work end', () => {
  const r = planDay({ tasks: [T('low', { createdAt: 1 }), T('star', { starred: true, est: 45, createdAt: 5 })], nowMin: 8 * 60, bestStart: 10, today });
  assert.equal(r.blocks[0].taskId, 'star'); assert.equal(r.blocks[0].start, '10:00'); assert.equal(r.blocks[0].minutes, 45);
  assert.equal(r.blocks[1].taskId, 'low'); assert.equal(r.blocks[1].start, '10:55'); // 10:00 + 45 + 10 break
  const late = planDay({ tasks: [T('a', { est: 60 })], nowMin: 17 * 60 + 30, today, workEnd: '18:00' });
  assert.equal(late.blocks.length, 0);
});

test('best hour already passed: start soon; goal caps the number of blocks', () => {
  const r = planDay({ tasks: [T('a', { est: 30 }), T('b', { est: 30 }), T('c', { est: 30 })], nowMin: 15 * 60 + 2, bestStart: 10, goalMinutes: 60, today });
  assert.equal(r.blocks[0].start, '15:10');
  assert.equal(r.blocks.length, 2); // 2 × 30 min reaches the 60 min goal
});

test('avoids busy intervals and keeps fixed tasks in the plan', () => {
  const r = planDay({ tasks: [T('fixed', { at: '11:00', atDay: today, est: 30 }), T('a', { est: 45 })], busy: [{ start: toMin('09:30'), end: toMin('10:30') }], nowMin: 9 * 60, bestStart: 9, today });
  const a = r.blocks.find((b) => b.taskId === 'a');
  assert.ok(toMin(a.start) >= toMin('10:35'), 'after the meeting: ' + a.start);
  assert.ok(toMin(a.start) + 45 <= toMin('10:55') || toMin(a.start) >= toMin('11:35'), 'not over the fixed 11:00 task: ' + a.start);
  assert.equal(r.blocks.find((b) => b.taskId === 'fixed').fixed, true);
  assert.equal(hhmm(125), '02:05');
});

test('tasks booked for another day are left alone; a late best hour or an overnight end does not empty the plan', () => {
  const tomorrow = '2026-10-22';
  const r = planDay({ tasks: [T('later', { at: '09:00', atDay: tomorrow, est: 30 }), T('a', { est: 30 })], nowMin: 10 * 60, today });
  assert.ok(!r.blocks.some((b) => b.taskId === 'later'), 'tomorrow\'s task is not pulled into today');
  assert.ok(r.blocks.some((b) => b.taskId === 'a'));
  assert.equal(planDay({ tasks: [T('a', { est: 30 })], nowMin: 9 * 60, bestStart: 20, workEnd: '18:00', today }).blocks.length, 1); // best hour 20:00 is after the work day: plan from now
  assert.equal(planDay({ tasks: [T('a', { est: 30 })], nowMin: 9 * 60, workEnd: '02:00', today }).blocks.length, 1); // overnight end = until midnight
});
