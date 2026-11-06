import test from 'node:test';
import assert from 'node:assert/strict';
import { intIn, isPassKey, PASS_MINUTES, TRACKING_PAUSE_MINUTES } from '../../src/shared/validate.js';

test('intIn brings a number into its range and refuses what is not a number', () => {
  assert.equal(intIn(10, 1, 480, 10), 10);
  assert.equal(intIn(0, 1, 480, 10), 1);
  assert.equal(intIn(-5, 1, 480, 10), 1);
  assert.equal(intIn(1e9, 1, 480, 10), 480);
  assert.equal(intIn(7.6, 1, 480, 10), 8);
  assert.equal(intIn('15', 1, 480, 10), 15);
  for (const bad of [NaN, Infinity, -Infinity, undefined, 'abc', {}, '', '  '])  assert.equal(intIn(bad, 1, 480, 10), 10, String(bad));
  assert.equal(intIn(null, 1, 480, 10), 1, 'null is 0, which is below the range');
  assert.equal(intIn([], 1, 480, 10), 1, 'an empty array is 0, which is below the range');
});

test('the limits of a pass and of a tracking pause are sane', () => {
  assert.ok(PASS_MINUTES.max <= 24 * 60 && PASS_MINUTES.min >= 1 && PASS_MINUTES.fallback >= PASS_MINUTES.min && PASS_MINUTES.fallback <= PASS_MINUTES.max);
  assert.ok(TRACKING_PAUSE_MINUTES.max <= 24 * 60);
  assert.equal(intIn(60 * 24 * 365, TRACKING_PAUSE_MINUTES.min, TRACKING_PAUSE_MINUTES.max, 0), 24 * 60, 'a year of pause is a day');
});

test('a pass key is a plain string', () => {
  for (const ok of ['youtube.com', 'a.b.co.uk', '*redirect:12', 'xn--80ak6aa92e.com']) assert.ok(isPassKey(ok), ok);
  for (const bad of ['', ' ', 'a b', 'a\nb', 'a\u0000', 'x'.repeat(254), 5, null, undefined, {}, ['a.com']]) assert.equal(isPassKey(bad), false, String(bad));
});
