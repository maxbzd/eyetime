import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDepth, frontLayers, parallaxStrength, DEPTH_SCENES, DEPTH_DEFAULT } from '../../src/shared/depth.js';

test('normalizeDepth: on by default, clamped, never throws', () => {
  assert.deepEqual(normalizeDepth(undefined), DEPTH_DEFAULT);
  assert.deepEqual(normalizeDepth({ on: false, parallax: false, strength: 500 }), { on: false, parallax: false, strength: 100 });
  assert.deepEqual(normalizeDepth({ strength: 'x' }), DEPTH_DEFAULT);
  assert.equal(normalizeDepth({ strength: -5 }).strength, 0);
  assert.deepEqual(normalizeDepth(normalizeDepth({ strength: 33.4 })), { on: true, parallax: true, strength: 33 });
});

test('frontLayers: only for scenes that have them, and only while the effect is on', () => {
  assert.deepEqual(frontLayers('peaks', undefined).map((l) => l.cls), ['dl-near']);
  assert.deepEqual(frontLayers('peaks', { on: false }), []);
  assert.deepEqual(frontLayers('dawn', undefined), []);
  assert.deepEqual(frontLayers('photo-cut', undefined).map((l) => l.cls), ['dl-photo']);
  assert.deepEqual(frontLayers('photo', undefined), []);
  for (const [id, s] of Object.entries(DEPTH_SCENES)) for (const l of s.front) assert.ok(/^dl-[a-z]+$/.test(l.cls) && l.k > 0, id);
});

test('parallaxStrength: 1 at the default, 0 when off', () => {
  assert.equal(parallaxStrength(undefined), 1);
  assert.equal(parallaxStrength({ parallax: false }), 0);
  assert.equal(parallaxStrength({ strength: 0 }), 0);
  assert.equal(parallaxStrength({ strength: 100 }), 100 / 60);
});
