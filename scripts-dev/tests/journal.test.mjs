import test from 'node:test';
import assert from 'node:assert/strict';
import { setLocale } from '../../src/shared/i18n.js';
import { buildJournal } from '../../src/shared/journal.js';

setLocale('en');
const t = (h, m) => new Date(2026, 9, 20, h, m).getTime();

test('journal lists days newest first with sessions and wins, no hosts', () => {
  const md = buildJournal([
    ['2026-10-19', { d: { 'a.com': 600 }, fs: 0 }],
    ['2026-10-20', { d: { 'github.com': 3000, 'reddit.com': 1000 }, fs: 3000, b: 2, w: 'Shipped it', ss: [{ id: 's', t: t(9, 5), m: 50, c: 1, r: 3, g: 'Write report' }, { id: 'u', t: t(14, 0), m: 25, c: 0 }] }],
    ['2026-10-18', null],
  ], { classify: (h) => (h === 'reddit.com' ? 'distracting' : 'productive'), clock24: true });
  assert.ok(md.indexOf('Tuesday, October 20') < md.indexOf('Monday, October 19'));
  assert.match(md, /Focus: 50m \(2 sessions\)/); assert.match(md, /Distraction share: 25%/);
  assert.match(md, /09:05 · 50m · Write report — Deep focus/); assert.match(md, /14:00 · 25m \(ended early\)/); assert.match(md, /Went well: Shipped it/);
  assert.doesNotMatch(md, /github\.com|reddit\.com/);
});

test('empty journal says so', () => { assert.match(buildJournal([]), /No activity recorded yet/); });
