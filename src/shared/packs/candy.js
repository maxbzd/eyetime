// Candy — a sticker party. Floating bubbles, spinning stars and sparkles; a smiley that cheers for your goal, lollipops for the week.

import { text, rect, ellipse, group, full, grad, radial, customWidget } from './kit.js';

const bubble = (k, x, y, d, c1, c2) => group([
  ellipse(0, 0, d, d, radial(0.4, 0.35, 0.7, [0, c1], [1, c2]), { op: 0.85 }), ellipse(d * 0.18, d * 0.14, d * 0.26, d * 0.16, 'rgba(255,255,255,0.8)', { blur: 1 }),
], { x: `=${x} + sin(t * 0.3 + ${k}) * 40 + (mouseX - 0.5) * ${-20 - k * 6}`, y: `=${y} + cos(t * 0.25 + ${k * 2}) * 30 + (mouseY - 0.5) * ${-14 - k * 4}` });
const starP = 'M0 -22 L6 -7 L22 -6 L10 4 L14 20 L0 11 L-14 20 L-10 4 L-22 -6 L-6 -7 Z';
const scene = {
  name: 'Sticker party',
  states: { focus: { when: 'focus > 0.5', ease: 1.4 } },
  layers: [
    full(grad(160, [0, "=mixc('#ffd1ec', '#1b0f2e', dark)"], [0.55, "=mixc('#ffe6f4', '#2c1850', dark)"], [1, "=mixc('#c8f3e4', '#3a1b66', dark)"])),
    { t: 'lines', x: 0, y: 0, w: '=W', h: '=H', gap: 36, sw: 14, dir: 'diag', stroke: "=alpha('#ffffff', 0.10 - dark * 0.05)" },
    bubble(0, 70, 90, 190, '#ffb3dc', '#ff6fb9'), bubble(1, 860, 120, 150, '#bff0ff', '#6fd0ff'), bubble(2, 820, 470, 210, '#fff0a6', '#ffd23f'), bubble(3, 140, 480, 130, '#c7ffd9', '#5fe3a8'), bubble(4, 500, 560, 110, '#e6c7ff', '#b784ff'),
    { t: 'path', d: starP, x: 700, y: 70, sc: '=1.2 + sin(t * 0.8) * 0.15', rot: '=t * 12', fill: '#ffe14d', stroke: '#ffffff', sw: 3 },
    { t: 'path', d: starP, x: 720, y: 300, sc: '=0.9 + sin(t * 0.7 + 1) * 0.12', rot: '=-t * 9', fill: '#ff8ac4', stroke: '#ffffff', sw: 3 },
    { t: 'path', d: starP, x: 960, y: 560, sc: '=1 + sin(t * 0.9 + 2) * 0.12', rot: '=t * 15', fill: '#7fe3ff', stroke: '#ffffff', sw: 3 },
    { t: 'particles', x: 0, y: 0, w: '=W', h: '=H', n: 50, size: [1.2, 3], speed: [0, 0], twinkle: true, colors: ['#ffffff', '#fff3a8', '#ffd0ee'], op: 0.9, seed: 12 },
    full('#2a0a4a', { op: '=state.focus * 0.22' }),
  ],
};
const face = customWidget({ name: 'Cheering smiley', size: [300, 340], root: [
  { t: 'ring', x: 150, y: 150, r: 134, sw: 14, val: '=goal', fill: grad(90, [0, '#ff6fb9'], [1, '#ffd23f']), track: "=alpha('#ff6fb9', 0.2)" },
  ellipse(40, 40, 220, 220, radial(0.4, 0.35, 0.8, [0, '#fff3a0'], [1, '#ffd23f']), { stroke: '#3b1237', sw: 5 }),
  group([ellipse(-12, -14, 24, 34, '#3b1237'), ellipse(-5, -10, 8, 10, '#ffffff')], { x: 112, y: 140 }),
  group([ellipse(-12, -14, 24, 34, '#3b1237'), ellipse(-5, -10, 8, 10, '#ffffff')], { x: 188, y: 140 }),
  ellipse(66, 168, 34, 22, 'rgba(255,111,185,0.55)', { blur: 3 }), ellipse(200, 168, 34, 22, 'rgba(255,111,185,0.55)', { blur: 3 }),
  { t: 'path', d: 'M-40 0 Q 0 46 40 0', x: 150, y: 188, stroke: '#3b1237', sw: 8, fill: 'none', show: '=goal >= 0.5' },
  { t: 'path', d: 'M-30 8 L30 8', x: 150, y: 192, stroke: '#3b1237', sw: 8, fill: 'none', show: '=goal < 0.5 && goal >= 0.2' },
  { t: 'path', d: 'M-34 14 Q 0 -22 34 14', x: 150, y: 190, stroke: '#3b1237', sw: 8, fill: 'none', show: '=goal < 0.2' },
  text(150, 330, 30, '{fmt(goal * 100, 0)}% yay!', { align: 'middle', font: 'display', weight: 800, fill: 'token:text' }),
] });
const colors = ['#ff6fb9', '#6fd0ff', '#ffd23f', '#5fe3a8', '#b784ff'];
const sweet = customWidget({ name: 'Sweet list', size: [380, 330], root: [
  text(0, 34, 26, 'Sweet tasks', { font: 'display', weight: 800, fill: 'token:text' }),
  text(380, 34, 16, '{tasksOpen}', { align: 'end', weight: 800, fill: 'token:accent-text' }),
  { t: 'list', x: 0, y: 52, w: 380, of: 'tasks', max: 5, rowh: 52, on: { click: { do: 'task.toggle' } }, item: group([
    rect(0, 4, 380, 42, "=alpha(mixc('#ff6fb9', '#6fd0ff', mod(item.i, 2)), 0.28)", { r: 21, stroke: "=mixc('#ff6fb9', '#6fd0ff', mod(item.i, 2))", sw: 2.5 }),
    ellipse(12, 12, 26, 26, 'none', { stroke: 'token:text', sw: 3 }),
    text(54, 33, 19, '{item.text}', { weight: 700, fill: 'token:text', font: 'body' }),
  ]) },
] });
const pop = (i) => group([
  { t: 'line', x1: 0, y1: 0, x2: 0, y2: 70, stroke: 'token:text-3', sw: 4 },
  ellipse(`=-(10 + 24 * at(week, ${i}) / max(1, maxa(week)))`, `=-(10 + 24 * at(week, ${i}) / max(1, maxa(week)))`, `=(10 + 24 * at(week, ${i}) / max(1, maxa(week))) * 2`, `=(10 + 24 * at(week, ${i}) / max(1, maxa(week))) * 2`, colors[i % 5], { stroke: '#ffffff', sw: 3 }),
], { x: 30 + i * 60, y: 90 });
const pops = customWidget({ name: 'Lollipops', size: [420, 200], root: [
  text(0, 28, 22, 'Lollipop week', { font: 'display', weight: 800, fill: 'token:text' }),
  text(420, 28, 16, '{sum(week)} min', { align: 'end', weight: 800, fill: 'token:accent-text' }),
  ...[0, 1, 2, 3, 4, 5, 6].map(pop),
  ...['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => text(30 + i * 60, 190, 14, d, { align: 'middle', weight: 800, fill: 'token:text-3' })),
] });

export default {
  id: 'candy', appearance: { look: 'candy', mode: 'light', accent: 'look' },
  home: {
    background: 'scene', scene, clockStyle: 'bold', layout: 'center', greeting: true, dna: { s: 'solid' },
    modules: { focus: false, today: false, tasks: false, habits: false, notes: false, links: false },
    type: { clock: { font: 'unbounded', weight: 600, tracking: -0.04 }, text: {} },
    widgets: [face, sweet, pops],
    canvas: { on: true, items: { clock: { x: 38, y: 24, s: 1.15 }, greeting: { x: 38, y: 38, s: 1 }, [face.id]: { x: 16, y: 72, w: 240 }, [pops.id]: { x: 46, y: 80, w: 380 }, [sweet.id]: { x: 80, y: 56, w: 360 } } },
  },
};
