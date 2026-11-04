import test from 'node:test';
import assert from 'node:assert/strict';
import { phase, eveningMinutes, candidates, setPriorities, applyTimes, todaysThree, nextUp, closing, tomorrowPicks, rtOf } from '../../src/shared/ritual.js';
import { DEFAULT_SETTINGS } from '../../src/shared/defaults.js';

const at = (h, m = 0) => new Date(2026, 10, 4, h, m);
const S = (over = {}) => ({ ...structuredClone(DEFAULT_SETTINGS), ...over });
const T = (id, o = {}) => ({ id, text: 'task ' + id, done: false, starred: false, createdAt: 1, ...o });
const TODAY = '2026-11-04';

test('ritual: which part of the day it is', () => {
  const s = S();
  assert.equal(phase({ now: at(9), day: null, settings: s }), 'morning');
  assert.equal(phase({ now: at(4, 59), day: null, settings: s }), 'work', 'a new day at night is not a morning');
  assert.equal(phase({ now: at(5), day: null, settings: s }), 'morning');
  assert.equal(phase({ now: at(15, 59), day: null, settings: s }), 'morning', 'until two hours before the evening');
  assert.equal(phase({ now: at(16), day: null, settings: s }), 'work');
  assert.equal(phase({ now: at(18), day: null, settings: s }), 'evening');
  assert.equal(phase({ now: at(23, 59), day: { rt: { p: 1 } }, settings: s }), 'evening');
  assert.equal(phase({ now: at(9), day: { rt: { p: 1 } }, settings: s }), 'work', 'planned: work');
  assert.equal(phase({ now: at(9), day: { rt: { s: 1 } }, settings: s }), 'work', '"not today": work, and asked no more');
  assert.equal(phase({ now: at(9), day: { fs: 600 }, settings: s }), 'work', 'someone already working is not asked what to work on');
  assert.equal(phase({ now: at(9), day: { fc: 1 }, settings: s }), 'work');
  assert.equal(phase({ now: at(9), day: { rt: { c: 1 } }, settings: s }), 'closed');
  assert.equal(phase({ now: at(20), day: { rt: { c: 1, p: 1 } }, settings: s }), 'closed', 'closed wins over the evening');
  const off = S({ ritual: { on: false, eveningAt: '18:00' } });
  assert.equal(phase({ now: at(9), day: null, settings: off }), 'off');
  assert.equal(phase({ now: at(9), day: null, settings: {} }), 'off', 'no settings: nothing to show');
});

test('ritual: the evening is a setting, and a damaged one falls back to 18:00', () => {
  assert.equal(eveningMinutes(S({ ritual: { on: true, eveningAt: '20:30' } })), 20 * 60 + 30);
  assert.equal(phase({ now: at(19), day: null, settings: S({ ritual: { on: true, eveningAt: '20:30' } }) }), 'work');
  for (const bad of ['', '25:00', 'six', null, undefined, 1800]) assert.equal(eveningMinutes({ ritual: { eveningAt: bad } }), 18 * 60);
  assert.equal(eveningMinutes(null), 18 * 60);
});

test('ritual: the morning list — what matters first, three pre-selected, never done tasks', () => {
  const tasks = [T('a', { createdAt: 1 }), T('b', { createdAt: 9 }), T('c', { starred: true, createdAt: 2 }), T('d', { due: '2026-11-01', createdAt: 3 }), T('e', { due: TODAY, createdAt: 4 }),
    T('f', { planFor: TODAY, createdAt: 5 }), T('g', { done: true, starred: true }), T('h', { atDay: TODAY, at: '10:00', createdAt: 6 }), T('i', { due: '2026-12-01', createdAt: 8 })];
  const list = candidates(tasks, TODAY);
  assert.equal(list.length, 5);
  assert.deepEqual(list.map((c) => c.task.id), ['c', 'f', 'd', 'e', 'h']);
  assert.deepEqual(list.map((c) => c.why), ['priority', 'planned', 'overdue', 'due', 'scheduled']);
  assert.deepEqual(list.map((c) => c.pre), [true, true, true, false, false], 'up to three are pre-selected');
  assert.ok(!list.some((c) => c.task.done));
  assert.deepEqual(candidates([], TODAY), []);
  assert.deepEqual(candidates([T('x'), T('y', { createdAt: 5 })], TODAY).map((c) => [c.task.id, c.why, c.pre]), [['y', '', false], ['x', '', false]], 'nothing planned: newest first, nothing pre-selected');
});

test('ritual: choosing the three replaces the priorities and spends earlier plans', () => {
  const tasks = [T('a', { starred: true }), T('b'), T('c', { planFor: TODAY }), T('d', { done: true, starred: true }), T('e')];
  const out = setPriorities(tasks, ['b', 'c', 'e', 'a']);
  assert.deepEqual(out.map((x) => [x.id, x.starred]), [['a', false], ['b', true], ['c', true], ['d', true], ['e', true]], 'four asked, three taken; a done task is left alone');
  assert.ok(!('planFor' in out[2]));
  assert.equal(tasks[0].starred, true, 'the input is not changed');
});

test('ritual: suggested times become the tasks\' own times, but a time the person set stays', () => {
  const tasks = [T('a'), T('b', { at: '15:00', atDay: TODAY }), T('c', { est: 60 }), T('d', { done: true })];
  const blocks = [{ taskId: 'a', start: '09:30', minutes: 45, fixed: false }, { taskId: 'b', start: '09:30', minutes: 30, fixed: false }, { taskId: 'c', start: '11:00', minutes: 25, fixed: false }, { taskId: 'd', start: '12:00', minutes: 25, fixed: false }, { taskId: 'x', start: '13:00', minutes: 25, fixed: true }];
  const out = applyTimes(tasks, blocks, TODAY);
  assert.deepEqual([out[0].at, out[0].atDay, out[0].est], ['09:30', TODAY, 45]);
  assert.equal(out[1].at, '15:00'); assert.equal(out[2].est, 60, 'an estimate the person gave stays'); assert.equal(out[3].at, undefined);
});

test('ritual: today\'s three and what is next', () => {
  const tasks = [T('a', { done: true }), T('b'), T('c', { starred: true }), T('d')];
  const day = { rt: { top: ['a', 'b', 'x', 'c', 'd'] } };
  assert.deepEqual(todaysThree(tasks, day).map((x) => [x.task.id, x.done]), [['a', true], ['b', false], ['c', false]], 'the morning\'s choice, done ones kept, unknown ids dropped, at most three');
  assert.equal(nextUp(tasks, day).id, 'b');
  assert.equal(nextUp([T('a', { done: true })], { rt: { top: ['a'] } }), null, 'all done');
  assert.deepEqual(todaysThree(tasks, null).map((x) => x.task.id), ['c'], 'no morning: the open priorities');
  assert.deepEqual(todaysThree([], null), []);
});

test('ritual: the evening in numbers, and tomorrow\'s three', () => {
  const dk = (ms) => new Date(ms).toISOString().slice(0, 10);
  const noon = Date.parse(TODAY + 'T12:00:00Z');
  const tasks = [T('a', { done: true, doneAt: noon }), T('b', { done: true, doneAt: noon - 3 * 86_400_000 }), T('c'), T('d', { planFor: '2026-11-05' }), T('e', { planFor: '2026-11-05' }), T('f', { starred: true })];
  const c = closing({ day: { fs: 5400, fc: 2, fa: 4, w: 'shipped', ss: [{ sec: 2700, rating: 3 }, { sec: 2700, rating: 2 }] }, tasks, today: TODAY, dayKeyOf: dk });
  assert.equal(c.done, 1); assert.equal(c.held, 4); assert.equal(c.win, 'shipped'); assert.equal(c.open, 4);
  assert.equal(closing({ day: null, tasks: [], today: TODAY, dayKeyOf: dk }).minutes, 0);
  assert.deepEqual(tomorrowPicks(tasks, '2026-11-05').map((x) => x.id), ['d', 'e'], 'what was planned wins');
  assert.deepEqual(tomorrowPicks(tasks, '2026-11-06').map((x) => x.id), ['f'], 'else the open priorities');
  assert.deepEqual(rtOf(null), {}); assert.deepEqual(rtOf({ rt: 5 }), {});
});
