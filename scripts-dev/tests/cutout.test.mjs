import test from 'node:test';
import assert from 'node:assert/strict';
import { toTensor, normalizeMask, smoothstep, maskCoverage, maskSize, MODEL_SIZE } from '../../src/shared/cutout.js';

test('toTensor: NCHW, scaled by the brightest value and normalised', () => {
  const size = 2, rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);
  const t = toTensor(rgba, size);
  assert.equal(t.length, 12);
  const r0 = (1 - 0.485) / 0.229, rOff = (0 - 0.485) / 0.229;
  assert.ok(Math.abs(t[0] - r0) < 1e-6);            // red channel of pixel 0 (plane R, index 0)
  assert.ok(Math.abs(t[1] - rOff) < 1e-6);          // red channel of pixel 1
  assert.ok(Math.abs(t[4 + 1] - (1 - 0.456) / 0.224) < 1e-6); // green plane, pixel 1
  assert.equal(toTensor(new Uint8ClampedArray(MODEL_SIZE * MODEL_SIZE * 4)).length, 3 * MODEL_SIZE * MODEL_SIZE);
});

test('normalizeMask stretches to 0..1 and survives a flat output', () => {
  const n = normalizeMask(new Float32Array([2, 4, 6]));
  assert.deepEqual([...n], [0, 0.5, 1]);
  assert.deepEqual([...normalizeMask(new Float32Array([3, 3, 3]))], [0, 0, 0]);
  assert.equal(normalizeMask(new Float32Array(0)).length, 0);
});

test('smoothstep is 0, an S-curve, then 1', () => {
  assert.equal(smoothstep(0.1), 0); assert.equal(smoothstep(0.9), 1); assert.ok(Math.abs(smoothstep(0.5) - 0.5) < 1e-9);
  assert.ok(smoothstep(0.4) < 0.4 * 1.0 && smoothstep(0.4) > 0 && smoothstep(0.6) > 0.5);
});

test('maskCoverage rejects empty and full masks', () => {
  const mk = (share, n = 1000) => Uint8ClampedArray.from({ length: n }, (_, i) => (i < n * share ? 255 : 0));
  assert.equal(maskCoverage(mk(0.3)).usable, true);
  assert.equal(maskCoverage(mk(0)).usable, false); assert.equal(maskCoverage(mk(0.005)).usable, false); assert.equal(maskCoverage(mk(0.95)).usable, false);
  assert.equal(maskCoverage(new Uint8ClampedArray(0)).share, 0);
});

test('maskSize keeps the aspect and never upsizes', () => {
  assert.deepEqual(maskSize(1920, 1080), { w: 960, h: 540 });
  assert.deepEqual(maskSize(640, 480), { w: 640, h: 480 });
  assert.deepEqual(maskSize(5000, 10), { w: 960, h: 2 });
});
