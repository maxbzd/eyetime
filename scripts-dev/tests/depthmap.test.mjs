import test from 'node:test';
import assert from 'node:assert/strict';
import { depthInputSize, toDepthTensor, depthToGray, depthUsable, DEPTH_MODEL_SIDE } from '../../src/shared/depthmap.js';

test('depthInputSize: the long side is 518, both sides are multiples of 14, the shape is kept', () => {
  assert.deepEqual(depthInputSize(3000, 2000), { w: 518, h: 350 });
  assert.deepEqual(depthInputSize(2000, 3000), { w: 350, h: 518 });
  assert.deepEqual(depthInputSize(1000, 1000), { w: 518, h: 518 });
  assert.deepEqual(depthInputSize(100, 100), { w: 518, h: 518 }); // small pictures are enlarged to the size the model likes
  for (const [w, h] of [[1920, 1080], [4000, 1000], [1000, 4000], [7, 5]]) {
    const s = depthInputSize(w, h);
    assert.ok(s.w % 14 === 0 && s.h % 14 === 0 && s.w >= 14 && s.h >= 14 && Math.max(s.w, s.h) <= DEPTH_MODEL_SIDE + 7, `${w}x${h} -> ${s.w}x${s.h}`);
  }
  assert.deepEqual(depthInputSize(0, 0), { w: 518, h: 518 }); // never a zero or NaN size
});

test('toDepthTensor: channel planes, ImageNet normalisation', () => {
  const t = toDepthTensor(new Uint8ClampedArray([255, 0, 128, 255, 0, 255, 0, 255]), 2, 1);
  assert.equal(t.length, 6);
  assert.ok(Math.abs(t[0] - (1 - 0.485) / 0.229) < 1e-5);            // R of pixel 0
  assert.ok(Math.abs(t[1] - (0 - 0.485) / 0.229) < 1e-5);            // R of pixel 1
  assert.ok(Math.abs(t[2] - (0 - 0.456) / 0.224) < 1e-5);            // G of pixel 0
  assert.ok(Math.abs(t[4] - (128 / 255 - 0.406) / 0.225) < 1e-5);    // B of pixel 0
});

test('depthToGray: stretched over the middle of the range, bright = near, stray pixels do not flatten it', () => {
  const raw = Float32Array.from({ length: 1000 }, (_, i) => i / 10); // 0 .. 99.9
  raw[3] = 5000; // a stray value
  const g = depthToGray(raw);
  assert.equal(g[0], 0); assert.ok(g[500] > 100 && g[500] < 160, 'the middle stays in the middle: ' + g[500]); assert.ok(g[999] >= 250);
  assert.ok(g[900] > g[500] && g[500] > g[100], 'the order is kept');
});

test('depthToGray: flat, empty and broken answers give an all-zero picture (and are not usable)', () => {
  assert.deepEqual([...depthToGray(new Float32Array(10).fill(3))], new Array(10).fill(0));
  assert.equal(depthToGray(new Float32Array(0)).length, 0);
  const bad = depthToGray(Float32Array.from([1, 2, NaN, 4]));
  assert.deepEqual([...bad], [0, 0, 0, 0]);
  assert.equal(depthUsable(depthToGray(new Float32Array(100).fill(1))), false);
  assert.equal(depthUsable(new Uint8ClampedArray(0)), false);
});

test('depthUsable: a real range passes, a nearly flat one does not', () => {
  assert.equal(depthUsable(Uint8ClampedArray.from({ length: 100 }, (_, i) => i * 2.5)), true);
  assert.equal(depthUsable(Uint8ClampedArray.from({ length: 100 }, (_, i) => 120 + (i % 5))), false);
});
