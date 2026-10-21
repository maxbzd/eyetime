import test from 'node:test';
import assert from 'node:assert/strict';
import { taskLine, tasksToMarkdown, tasksToCsv, parseCsv, parseTasksText } from '../../src/shared/taskio.js';

const NOW = new Date(2026, 9, 21, 10, 0);
const sample = [
  { id: 'a', text: 'Write the report', done: false, starred: true, est: 45, tags: ['work'], repeat: 'weekly', at: '14:30', atDay: '2026-10-22' },
  { id: 'b', text: 'Pay rent', done: false, starred: false, due: '2026-10-30' },
  { id: 'c', text: 'Send, the "invoice"', done: true, starred: false },
];

test('a task becomes a quick-add line and Markdown round-trips', () => {
  assert.equal(taskLine(sample[0]), 'Write the report 2026-10-22 14:30 45m ! #work every week');
  const md = tasksToMarkdown(sample);
  assert.match(md, /^# EyeTime tasks\n\n- \[ \] Write the report/);
  const back = parseTasksText(md, { now: NOW }).tasks;
  assert.equal(back.length, 3);
  const a = back.find((x) => x.text === 'Write the report');
  assert.deepEqual([a.est, a.starred, a.tags, a.repeat, a.at, a.atDay], [45, true, ['work'], 'weekly', '14:30', '2026-10-22']);
  assert.equal(back.find((x) => x.text === 'Pay rent').due, '2026-10-30');
  assert.equal(back.find((x) => x.text.startsWith('Send')).done, true);
});

test('CSV round-trips, including commas, quotes and line breaks in cells', () => {
  const csv = tasksToCsv(sample);
  const back = parseTasksText(csv, { now: NOW }).tasks;
  assert.deepEqual(back.map((x) => x.text), ['Write the report', 'Pay rent', 'Send, the "invoice"']);
  assert.equal(back[0].starred, true); assert.equal(back[2].done, true); assert.equal(back[1].due, '2026-10-30');
  assert.deepEqual(parseCsv('a;"b;c";"d\ne"\n1;2;3', ';'), [['a', 'b;c', 'd\ne'], ['1', '2', '3']]);
});

test('plain lists, numbering, headings; duplicates and the priority cap are respected', () => {
  const text = '# My list\n1. Call mom tomorrow\n- [x] Old thing\n* buy milk !\n\nbuy milk\n- Another ! \n- Third !\n- Fourth !\n';
  const r = parseTasksText(text, { now: NOW, existing: [{ text: 'Call mom', done: false }] });
  assert.deepEqual(r.tasks.map((x) => x.text), ['Old thing', 'buy milk', 'Another', 'Third', 'Fourth']);
  assert.equal(r.skipped, 2); // "Call mom" exists already, second "buy milk"
  assert.equal(r.tasks.filter((x) => x.starred).length, 3);
  assert.equal(r.tasks[0].done, true);
});

test('garbage in, nothing out', () => {
  assert.deepEqual(parseTasksText('', { now: NOW }), { tasks: [], skipped: 0 });
  assert.deepEqual(parseTasksText('```\n---\n# only a heading\n', { now: NOW }), { tasks: [], skipped: 0 });
});
