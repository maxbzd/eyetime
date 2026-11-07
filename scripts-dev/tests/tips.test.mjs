// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The quiet tips: when one is shown, and above all when none is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIP_IDS, normalizeTips, tipUsed, tipPlan, recordTip } from '../../src/shared/tips.js';
import { DEFAULT_SETTINGS } from '../../src/shared/defaults.js';

const DAY = 86_400_000, NOW = Date.UTC(2026, 10, 7, 12);
const settings = () => JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
const base = () => ({ st: normalizeTips(null), now: NOW, installedAt: NOW - 20 * DAY, activeDays: 9, running: false, settings: settings(), connected: false });

test('a stored value that is not a state becomes an empty one', () => {
  for (const v of [null, undefined, 3, 'x', [], { seen: 5 }, { off: 'yes', last: -4, seen: { limits: 7, nope: { at: 1 } } }]) {
    const s = normalizeTips(v);
    assert.equal(s.off, false); assert.equal(s.last, 0); assert.deepEqual(s.seen, {});
  }
  const ok = normalizeTips({ off: true, last: 5, seen: { night: { at: 9, n: 99, done: true }, bogus: { at: 1, n: 1 } } });
  assert.equal(ok.off, true); assert.equal(ok.seen.night.n, 9); assert.equal(ok.seen.bogus, undefined);
});

test('the first tip is offered when the person has been around a while', () => {
  assert.equal(tipPlan(base()), TIP_IDS[0]);
});

test('never in the first week, never before four active days', () => {
  assert.equal(tipPlan({ ...base(), installedAt: NOW - 6 * DAY }), null);
  assert.equal(tipPlan({ ...base(), installedAt: NOW - 8 * DAY }), TIP_IDS[0]);
  assert.equal(tipPlan({ ...base(), activeDays: 3 }), null);
  assert.equal(tipPlan({ ...base(), installedAt: 0 }), null, 'an unknown install date is not a reason to talk');
});

test('never during a session, never when something else is asking', () => {
  assert.equal(tipPlan({ ...base(), running: true }), null);
  assert.equal(tipPlan({ ...base(), busy: true }), null);
});

test('one tip a week, and "No more tips" is for good', () => {
  let st = recordTip(normalizeTips(null), 'limits', 'shown', NOW);
  assert.equal(tipPlan({ ...base(), st }), null, 'the same day');
  assert.equal(tipPlan({ ...base(), st, now: NOW + 6 * DAY }), null, 'six days later');
  assert.equal(tipPlan({ ...base(), st, now: NOW + 7 * DAY }), 'rhythm', 'a week later: the next tip, not the same one');
  st = recordTip(st, 'limits', 'off');
  assert.equal(tipPlan({ ...base(), st, now: NOW + 400 * DAY }), null);
});

test('a tip about something already in use is skipped', () => {
  const s = settings(); s.blocking.budget.enabled = true; s.focus.ambient = 'rain'; s.standby.on = true;
  assert.equal(tipPlan({ ...base(), settings: s }), 'home');
  s.newtab.widgets = [{ id: 'wabcd', kind: 'clock', cfg: {} }];
  assert.equal(tipPlan({ ...base(), settings: s }), 'tools');
  assert.equal(tipPlan({ ...base(), settings: s, connected: true }), null, 'everything is in use: nothing left to say');
  assert.equal(tipUsed('limits', { blocking: { limits: { 'x.com': 10 } } }), true);
  assert.equal(tipUsed('tools', { blocking: { instant: true } }), true);
  assert.equal(tipUsed('home', { newtab: { canvas: { on: true } } }), true);
  assert.equal(tipUsed('unknown', settings()), true, 'an unknown tip is never shown');
});

test('"Not now" brings a tip back once, after 45 days; "Show me" never', () => {
  const only = (id) => { const s = settings(); for (const other of TIP_IDS.filter((x) => x !== id)) { if (other === 'limits') s.blocking.budget.enabled = true; if (other === 'rhythm') s.focus.ambient = 'rain'; if (other === 'home') s.newtab.widgets = [{ id: 'wabcd', kind: 'clock', cfg: {} }]; if (other === 'night') s.standby.on = true; if (other === 'tools') s.dock.enabled = true; } return s; };
  let st = recordTip(normalizeTips(null), 'night', 'shown', NOW);
  st = recordTip(st, 'night', 'later');
  const at = (d) => tipPlan({ ...base(), settings: only('night'), st, now: NOW + d * DAY });
  assert.equal(at(44), null); assert.equal(at(45), 'night');
  st = recordTip(st, 'night', 'shown', NOW + 45 * DAY); st = recordTip(st, 'night', 'later');
  assert.equal(at(400), null, 'twice is enough');
  const done = recordTip(recordTip(normalizeTips(null), 'night', 'shown', NOW), 'night', 'show');
  assert.equal(tipPlan({ ...base(), settings: only('night'), st: done, now: NOW + 400 * DAY }), null);
});

test('recordTip does not change what it was given', () => {
  const a = normalizeTips(null); const before = JSON.stringify(a);
  recordTip(a, 'limits', 'shown', NOW); recordTip(a, 'limits', 'off');
  assert.equal(JSON.stringify(a), before);
  assert.deepEqual(recordTip(a, 'not-a-tip', 'shown', NOW), a);
});
