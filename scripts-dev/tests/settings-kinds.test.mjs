// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Damaged settings (a text where a list belongs, a null, a number as a word) never reach the blocking code as such: every load keeps the kind of each value.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSettings, deepMerge, DEFAULT_SETTINGS } from '../../src/shared/defaults.js';
import { makeClassifier } from '../../src/shared/classify.js';
import { decide } from '../../src/shared/blocking.js';

test('a value of the wrong kind leaves the default; the right kind is kept', () => {
  const s = mergeSettings({ blocking: { custom: null, always: 'youtube.com', allow: { a: 1 }, limits: [1, 2], schedule: { days: 'mon', start: 5 } }, tracking: { excluded: 'localhost', idleSeconds: 'x' }, eye: 5, focus: { modes: {}, minutes: NaN } });
  assert.deepEqual(s.blocking.custom, []); assert.deepEqual(s.blocking.always, []); assert.deepEqual(s.blocking.allow, []); assert.deepEqual(s.blocking.limits, {});
  assert.deepEqual(s.blocking.schedule.days, [1, 2, 3, 4, 5]); assert.equal(s.blocking.schedule.start, '09:00');
  assert.deepEqual(s.tracking.excluded, ['localhost', '127.0.0.1']); assert.equal(s.tracking.idleSeconds, 60);
  assert.deepEqual(s.eye, DEFAULT_SETTINGS.eye); assert.equal(s.focus.minutes, 25); assert.equal(s.focus.modes.length, 3);
  const ok = mergeSettings({ blocking: { custom: ['a.com'] }, tracking: { idleSeconds: 120 }, newtab: { clock24: true } });
  assert.deepEqual(ok.blocking.custom, ['a.com']); assert.equal(ok.tracking.idleSeconds, 120); assert.equal(ok.newtab.clock24, true, 'a default of null takes any value');
});

test('what is inside the lists is cleaned: words, weekdays, objects, limits, classes', () => {
  const s = mergeSettings({
    blocking: { custom: ['a.com', 5, null, '', { x: 1 }], limits: { 'a.com': 30, 'b.com': 'abc', 'c.com': -5, 'd.com': 0 }, schedule: { days: [1, 9, 'x', 3.5, 0] }, presets: { social: 'yes' } },
    sites: { 'a.com': 'productive', 'b.com': 'weird', 'c.com': 3 },
    focus: { goalDays: [1, 7, -1], presets: [25, 'x', 0, 50], modes: [{ id: 'm', allow: 'x.com' }, 'junk', null, { id: 'n', allow: ['y.com', 4] }] },
  });
  assert.deepEqual(s.blocking.custom, ['a.com']); assert.deepEqual(s.blocking.limits, { 'a.com': 30 }); assert.deepEqual(s.blocking.schedule.days, [1, 0]);
  assert.equal(typeof s.blocking.presets.social, 'boolean'); assert.deepEqual(s.sites, { 'a.com': 'productive' });
  assert.deepEqual(s.focus.goalDays, [1]); assert.deepEqual(s.focus.presets, [25, 50]);
  assert.deepEqual(s.focus.modes.map((m) => [m.id, m.allow]), [['m', []], ['n', ['y.com']]]);
});

test('the blocking code does not throw on any of it', () => {
  const s = mergeSettings({ blocking: { custom: null, always: 'x', allow: 5, limits: 'x', schedule: null, friction: 3, budget: [] }, sites: 'x', tracking: 7, focus: { modes: 'x' } });
  const c = makeClassifier(s);
  for (const host of ['youtube.com', 'www.x.com', 'localhost']) { c.classify(host); c.ruleDomain(host); decide(host, { settings: s, classifier: c, focus: null, passes: {}, usageOf: () => 99999 }); }
});

test('the prototype stays out of settings, and plain objects still merge deeply', () => {
  const s = mergeSettings(JSON.parse('{"__proto__":{"x":1},"blocking":{"constructor":{"y":1},"friction":{"seconds":3}}}'));
  assert.equal({}.x, undefined); assert.equal(s.blocking.friction.seconds, 3); assert.equal(s.blocking.friction.enabled, true);
  assert.deepEqual(deepMerge({ a: { b: 1, c: 2 } }, { a: { b: 5 } }), { a: { b: 5, c: 2 } });
});
