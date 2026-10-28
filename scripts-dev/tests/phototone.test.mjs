import test from 'node:test';
import assert from 'node:assert/strict';
import { relLuminance, contrastWith, pickTextTone, resolveTextTone, PHOTO_TEXT } from '../../src/shared/phototone.js';

test('relative luminance matches the WCAG endpoints', () => {
  assert.equal(relLuminance(0, 0, 0), 0);
  assert.ok(Math.abs(relLuminance(255, 255, 255) - 1) < 1e-9);
  assert.ok(Math.abs(contrastWith(1, 0) - 21) < 1e-9);
});

test('a dark photo gets light text, a bright one dark text, mixed ones lean on the brightness', () => {
  const dark = Array.from({ length: 100 }, (_, i) => 0.02 + (i % 5) * 0.01);
  const bright = Array.from({ length: 100 }, (_, i) => 0.7 + (i % 5) * 0.05);
  assert.equal(pickTextTone(dark), 'light');
  assert.equal(pickTextTone(bright), 'dark');
  assert.equal(pickTextTone([0.9, 0.9, 0.02, 0.02]), 'dark'); // an even split: the brightness of the whole decides
  assert.equal(pickTextTone([0.5, 0.02, 0.02, 0.02]), 'light');
  assert.equal(pickTextTone([0.9, 0.9, 0.8, 0.02]), 'dark');
  assert.equal(pickTextTone([]), 'light'); assert.equal(pickTextTone(null), 'light');
  // mid-grey: neither text colour is great, the brighter side gets dark text
  assert.equal(pickTextTone(Array(50).fill(0.18)), 'light'); assert.equal(pickTextTone(Array(50).fill(0.5)), 'dark');
});

test('the person can override the automatic choice', () => {
  assert.deepEqual(PHOTO_TEXT, ['auto', 'light', 'dark']);
  assert.equal(resolveTextTone('light', 'dark'), 'light');
  assert.equal(resolveTextTone('dark', 'light'), 'dark');
  assert.equal(resolveTextTone('auto', 'dark'), 'dark');
  assert.equal(resolveTextTone('auto', undefined), 'light');
  assert.equal(resolveTextTone('weird', 'dark'), 'dark'); // unknown values behave as auto
});
