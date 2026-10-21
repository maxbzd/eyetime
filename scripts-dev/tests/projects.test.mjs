import test from 'node:test';
import assert from 'node:assert/strict';
import { tagFromGoal, sessionTag, projectTotals, projectRows } from '../../src/shared/projects.js';

const day = (...ss) => ({ ss: ss.map((s, i) => ({ id: 'x' + i + Math.random(), t: 1, m: 25, p: 25, g: '', k: '', c: 1, r: 0, ...s })) });

test('the project of a session: stored tag first, then #tag in the goal', () => {
  assert.equal(tagFromGoal('Write the report #Work'), 'work');
  assert.equal(tagFromGoal('issue #12345678901234567890123456'), '');
  assert.equal(tagFromGoal('C# basics'), '');
  assert.equal(sessionTag({ tg: 'study', g: '#work' }), 'study');
  assert.equal(sessionTag({ g: 'plan #deep-work' }), 'deep-work');
  assert.equal(sessionTag({ g: 'nothing' }), '');
});

test('totals per project and the change against the previous period', () => {
  const cur = [['2026-10-20', day({ tg: 'work', m: 50 }, { tg: 'study', m: 25 })], ['2026-10-21', day({ tg: 'work', m: 25 }, { g: 'no tag', m: 30 })]];
  const prev = [['2026-10-13', day({ tg: 'work', m: 50 })]];
  const t = projectTotals(cur);
  assert.deepEqual(t.map((r) => [r.tag, r.sec / 60, r.sessions]), [['work', 75, 2], ['', 30, 1], ['study', 25, 1]]);
  const { rows, untaggedSec, taggedSec } = projectRows(cur, prev);
  assert.deepEqual(rows.map((r) => r.tag), ['work', 'study']);
  assert.equal(rows[0].delta, 0.5);          // 75 vs 50 minutes
  assert.equal(rows[1].delta, null);         // nothing to compare with
  assert.equal(untaggedSec, 1800); assert.equal(taggedSec, 6000);
  assert.ok(Math.abs(rows[0].share - 0.75) < 1e-9);
});

test('no sessions, no crash', () => {
  assert.deepEqual(projectRows([], []), { rows: [], taggedSec: 0, untaggedSec: 0 });
  assert.deepEqual(projectTotals([['2026-10-20', null], ['2026-10-21', {}]]), []);
});
