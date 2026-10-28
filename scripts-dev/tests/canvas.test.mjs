import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCanvas, clampCenter, snapRect, nudge, resizeStep, itemFromRect, seedItems, canvasScale, CANVAS_BLOCKS } from '../../src/shared/canvas.js';

test('normalizeCanvas: garbage in, a safe canvas out', () => {
  assert.deepEqual(normalizeCanvas(undefined), { on: false, items: {} });
  assert.deepEqual(normalizeCanvas('x'), { on: false, items: {} });
  const c = normalizeCanvas({ on: true, items: { clock: { x: 50, y: 30, s: 99 }, bogus: { x: 1, y: 1 }, focus: { x: 'a', y: 2 }, tasks: { x: 120, y: -5, w: 5000 } } });
  assert.equal(c.on, true);
  assert.deepEqual(Object.keys(c.items).sort(), ['clock', 'tasks']);
  assert.equal(c.items.clock.s, CANVAS_BLOCKS.clock.max);
  assert.equal(c.items.tasks.x, 100); assert.equal(c.items.tasks.y, 0); assert.equal(c.items.tasks.w, CANVAS_BLOCKS.tasks.max);
});

test('normalizeCanvas: only the "on" flag true turns it on, and the result is stable', () => {
  assert.equal(normalizeCanvas({ on: 'yes', items: {} }).on, false);
  const once = normalizeCanvas({ on: true, items: { clock: { x: 50.123456, y: 20, s: 1.5 } } });
  assert.deepEqual(normalizeCanvas(once), once);
  assert.equal(once.items.clock.x, 50.12);
});

test('clampCenter keeps a block fully on screen and centres one that is larger than the window', () => {
  const view = { w: 1000, h: 800 };
  assert.deepEqual(clampCenter({ x: 0, y: 0 }, { w: 200, h: 100 }, view, 10), { x: 11, y: 7.5 });
  assert.deepEqual(clampCenter({ x: 100, y: 100 }, { w: 200, h: 100 }, view, 10), { x: 89, y: 92.5 });
  assert.deepEqual(clampCenter({ x: 10, y: 10 }, { w: 1200, h: 900 }, view, 10), { x: 50, y: 50 });
  assert.deepEqual(clampCenter({ x: 40, y: 40 }, { w: 200, h: 100 }, view, 10), { x: 40, y: 40 });
});

test('snapRect snaps to the window centre and to other blocks, and says where the guides are', () => {
  const view = { w: 1000, h: 800 };
  const near = snapRect({ x: 395, y: 100, w: 200, h: 100 }, [], view); // its centre is at 495, the window centre is 500
  assert.equal(near.dx, 5); assert.equal(near.dy, 0);
  assert.deepEqual(near.guides, [{ axis: 'x', at: 500 }]);
  const edge = snapRect({ x: 103, y: 300, w: 200, h: 100 }, [{ x: 100, y: 0, w: 50, h: 50 }], view);
  assert.equal(edge.dx, -3);
  const far = snapRect({ x: 300, y: 320, w: 100, h: 100 }, [], view);
  assert.deepEqual(far, { dx: 0, dy: 0, guides: [] });
});

test('nudge and resizeStep stay inside their limits', () => {
  assert.deepEqual(nudge({ x: 0.5, y: 99.5 }, 'left'), { x: 0, y: 99.5 });
  assert.deepEqual(nudge({ x: 50, y: 99.5 }, 'down', true), { x: 50, y: 100 });
  assert.deepEqual(nudge({ x: 50, y: 50 }, 'up', true), { x: 50, y: 45 });
  assert.equal(resizeStep('clock', { x: 1, y: 1, s: 3 }, 1).s, 3);
  assert.equal(resizeStep('clock', { x: 1, y: 1, s: 1 }, -1).s, 0.95);
  assert.equal(resizeStep('tasks', { x: 1, y: 1, w: 480 }, 1, true).w, 560);
  assert.equal(resizeStep('tasks', { x: 1, y: 1, w: 300 }, -1).w, 300);
});

test('itemFromRect turns a measured block into a saved one', () => {
  const view = { w: 1000, h: 800 };
  assert.deepEqual(itemFromRect('tasks', { x: 100, y: 200, w: 480, h: 300 }, view), { x: 34, y: 43.75, w: 480 });
  assert.deepEqual(itemFromRect('clock', { x: 300, y: 100, w: 400, h: 120 }, view, 1.25), { x: 50, y: 20, s: 1.25 });
});

test('seedItems gives only the blocks that exist, all valid; canvasScale stays in range', () => {
  assert.deepEqual(Object.keys(seedItems(['clock', 'focus', 'links'])), ['clock', 'focus']);
  const all = seedItems(null);
  assert.deepEqual(normalizeCanvas({ on: true, items: all }).items, all);
  assert.equal(canvasScale(1440), 1); assert.equal(canvasScale(300), 0.8); assert.equal(canvasScale(5000), 1.35);
});

test('widget blocks are accepted as cards, other ids are not', () => {
  const c = normalizeCanvas({ on: true, items: { w3k9x0a: { x: 10, y: 20, w: 5000 }, 'bad id': { x: 1, y: 1 }, wx: { x: 1, y: 1 } } });
  assert.deepEqual(Object.keys(c.items), ['w3k9x0a']);
  assert.equal(c.items.w3k9x0a.w, 900);
  assert.equal(resizeStep('w3k9x0a', { x: 1, y: 1, w: 300 }, 1).w, 320);
});
