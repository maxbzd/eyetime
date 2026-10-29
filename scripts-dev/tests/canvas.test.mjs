import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCanvas, clampCenter, snapRect, nudge, resizeStep, stretchStep, stretchDrag, itemFromRect, seedItems, canvasScale, reorder, alignItem, sizeValue, withSize, CANVAS_BLOCKS } from '../../src/shared/canvas.js';

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
  assert.equal(resizeStep('clock', { x: 1, y: 1, s: CANVAS_BLOCKS.clock.max }, 1).s, CANVAS_BLOCKS.clock.max);
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

test('a text block can be stretched: sx is kept only when it differs, and clamped', () => {
  const n = normalizeCanvas({ on: true, items: { clock: { x: 50, y: 50, s: 1, sx: 2.4 }, greeting: { x: 50, y: 70, s: 1, sx: 1 } } }).items;
  assert.equal(n.clock.sx, 2.4);
  assert.equal(n.greeting.sx, undefined);
  assert.equal(normalizeCanvas({ on: true, items: { clock: { x: 5, y: 5, s: 1, sx: 99 } } }).items.clock.sx, CANVAS_BLOCKS.clock.max * 2.5);
  assert.equal(normalizeCanvas({ on: true, items: { clock: { x: 5, y: 5, s: 1, sx: 'wide' } } }).items.clock.sx, undefined);
  assert.equal(normalizeCanvas({ on: true, items: { tasks: { x: 5, y: 5, w: 400, sx: 2 } } }).items.tasks.sx, undefined);
});

test('resizeStep keeps a stretched block in proportion; stretchStep changes one axis', () => {
  const r = resizeStep('clock', { x: 1, y: 1, s: 1, sx: 2 }, 1, true);
  assert.equal(r.s, 1.2); assert.equal(r.sx, 2.4);
  assert.deepEqual(stretchStep('clock', { x: 1, y: 1, s: 1 }, 'x', 1, true), { x: 1, y: 1, s: 1, sx: 1.2 });
  assert.deepEqual(stretchStep('clock', { x: 1, y: 1, s: 1 }, 'y', 1, true), { x: 1, y: 1, s: 1.2, sx: 1 });
  assert.deepEqual(stretchStep('clock', { x: 1, y: 1, s: 1, sx: 1.05 }, 'x', -1), { x: 1, y: 1, s: 1 });
});

test('stretchDrag pulls from a side or corner while the opposite one stays put', () => {
  const view = { w: 1440, h: 900 }, rect = { x: 400, y: 100, w: 400, h: 200 }, item = { x: 41.67, y: 22.22, s: 1 };
  // the right edge dragged 200 px out: twice... 1.5x wider, same height, left edge unchanged
  const a = stretchDrag('clock', item, { dx: 1, dy: 0 }, rect, 1, { x: 1000, y: 200 }, view);
  assert.equal(a.s, 1); assert.equal(a.sx, 1.5);
  assert.equal(Math.round(a.x / 100 * 1440 - 600 / 2), 400); // centre - half width = the fixed left edge
  // bottom-right corner free: both change; Shift keeps the proportions
  const b = stretchDrag('clock', item, { dx: 1, dy: 1 }, rect, 1, { x: 1200, y: 400 }, view);
  assert.equal(b.sx, 2); assert.equal(b.s, 1.5);
  const c = stretchDrag('clock', item, { dx: 1, dy: 1 }, rect, 1, { x: 1200, y: 400 }, view, true);
  assert.equal(c.s, 2); assert.equal(c.sx, undefined);
  // limits hold
  const d = stretchDrag('clock', item, { dx: 1, dy: 0 }, rect, 1, { x: 100000, y: 0 }, view);
  assert.equal(d.sx, CANVAS_BLOCKS.clock.max * 2.5);
  const e = stretchDrag('clock', item, { dx: -1, dy: 0 }, rect, 1, { x: 790, y: 0 }, view);
  assert.equal(e.sx, 0.16);
});

test('z keeps a block\'s place in the stack and is clamped; garbage is dropped', () => {
  const c = normalizeCanvas({ on: true, items: { clock: { x: 50, y: 30, s: 1, z: 7.4 }, tasks: { x: 20, y: 20, w: 400, z: 'top' }, today: { x: 80, y: 20, w: 300, z: 500 } } }).items;
  assert.equal(c.clock.z, 7); assert.equal('z' in c.tasks, false); assert.equal(c.today.z, 99);
});

test('reorder: front and back give every block an explicit place and keep the rest in order', () => {
  const items = { clock: { x: 50, y: 20, s: 1 }, tasks: { x: 20, y: 60, w: 400 }, today: { x: 80, y: 60, w: 300 } };
  const front = reorder(items, 'clock', 'front');
  assert.ok(front.clock.z > front.tasks.z && front.clock.z > front.today.z);
  assert.deepEqual(Object.keys(front).map((k) => front[k].z).sort(), [2, 3, 4]);
  const back = reorder(front, 'clock', 'back');
  assert.equal(back.clock.z, 2);
  assert.ok(back.tasks.z > back.clock.z && back.today.z > back.clock.z);
  assert.equal(back.tasks.x, 20); // nothing but z changes
  assert.equal(items.clock.z, undefined); // the input is untouched
  // blocks that have no place yet keep the order they have on the page
  const tied = reorder(items, 'today', 'front', ['today', 'clock', 'tasks']);
  assert.ok(tied.clock.z < tied.tasks.z && tied.tasks.z < tied.today.z);
});

test('alignItem: edges keep a margin, the centre is exact, a block never leaves the window', () => {
  const view = { w: 1000, h: 800 }, size = { w: 200, h: 100 }, it = { x: 33, y: 44, w: 300 };
  assert.equal(alignItem(it, 'left', size, view).x, 11.6); // (100 + 16) px of 1000
  assert.equal(alignItem(it, 'right', size, view).x, 88.4);
  assert.equal(alignItem(it, 'hcenter', size, view).x, 50);
  assert.equal(alignItem(it, 'top', size, view).y, 8.25); // (50 + 16) px of 800
  assert.equal(alignItem(it, 'bottom', size, view).y, 91.75);
  assert.equal(alignItem(it, 'vcenter', size, view).y, 50);
  assert.equal(alignItem(it, 'left', size, view).y, 44); // the other axis is untouched
  assert.deepEqual(alignItem(it, 'nope', size, view), it);
});

test('sizeValue / withSize: percent for text, px for cards, clamped, stretch kept', () => {
  assert.equal(sizeValue('clock', { x: 1, y: 1, s: 1.25 }), 125);
  assert.equal(sizeValue('tasks', { x: 1, y: 1, w: 480 }), 480);
  assert.equal(withSize('clock', { x: 1, y: 1, s: 1 }, 150).s, 1.5);
  assert.equal(withSize('clock', { x: 1, y: 1, s: 1 }, 9999).s, CANVAS_BLOCKS.clock.max);
  assert.equal(withSize('clock', { x: 1, y: 1, s: 1 }, 1).s, 0.4);
  assert.equal(withSize('clock', { x: 1, y: 1, s: 1, sx: 2 }, 200).sx, 4); // the stretch scales along
  assert.equal(withSize('tasks', { x: 1, y: 1, w: 480 }, 100).w, 300);
  assert.equal(withSize('tasks', { x: 1, y: 1, w: 480 }, 640).w, 640);
  assert.deepEqual(withSize('tasks', { x: 1, y: 1, w: 480 }, NaN), { x: 1, y: 1, w: 480 });
});
