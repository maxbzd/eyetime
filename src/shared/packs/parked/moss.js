// Moss — a forest floor. Contour lines that breathe, light through leaves, fireflies after dark; a little plant that grows with your day.

import { text, ellipse, group, full, grad, radial, customWidget } from '../kit.js';

const CONTOUR = 'M-300 0 C-300 -150 -100 -250 100 -220 C 300 -190 330 -40 290 80 C 250 200 60 260 -90 230 C -240 200 -300 120 -300 0 Z';
const contour = (k, s) => group([{ t: 'path', d: CONTOUR, stroke: 'token:accent', sw: 1.6, fill: 'none', op: `=${0.28 - k * 0.04}` }], { x: '=W * 0.66 + (mouseX - 0.5) * -14', y: '=H * 0.52', sc: `=${s} + sin(t * 0.3 + ${k}) * 0.018`, rot: `=${k * 7} + sin(t * 0.2 + ${k}) * 1.5` });
const ray = (x, w, a) => ({ t: 'rect', x, y: -160, w, h: 1100, rot: a, fill: grad(90, [0, 'rgba(255,255,220,0)'], [0.5, 'rgba(255,255,225,0.85)'], [1, 'rgba(255,255,220,0)']), op: '=(1 - dark) * 0.28 + smooth(0.1, 0.5, daylight) * dark * 0.0', blend: 'screen', blur: 16 });

const scene = {
  name: 'Forest floor',
  states: { focus: { when: 'focus > 0.5', ease: 2.2 } },
  layers: [
    full(grad(180, [0, "=mixc('#cfe3c2', '#050c07', dark)"], [1, "=mixc('#e9f3df', '#0d1a10', dark)"])),
    { t: 'group', children: [ray(60, 140, -16), ray(300, 100, -16), ray(560, 180, -16), ray(820, 120, -16)], x: '=sin(t * 0.15) * 16', y: 0 },
    contour(0, 0.55), contour(1, 0.75), contour(2, 0.95), contour(3, 1.15), contour(4, 1.35),
    ellipse(-300, '=H - 260', '=W + 600', 380, radial(0.5, 0.9, 0.7, [0, "=alpha(mixc('#7aa86a', '#1e4a2a', dark), 0.5)"], [1, 'rgba(0,0,0,0)']), { blur: 20 }),
    { t: 'particles', x: 0, y: '=H * 0.3', w: '=W', h: '=H * 0.7', n: 38, size: [1.4, 3], speed: [3, 9], dir: 'any', twinkle: true, colors: ['#d9ff7a', '#f4ffb0'], op: '=dark * 0.9', seed: 6, blend: 'screen' },
    { t: 'particles', x: 0, y: -20, w: '=W', h: '=H', n: 16, size: [3, 5], speed: [10, 22], dir: 'down', colors: ['#6aa05a', '#8fbf6f', '#b9d88f'], op: '=(1 - dark) * 0.55 + dark * 0.15', seed: 14 },
    { t: 'noise', x: 0, y: 0, w: '=W', h: '=H', op: 0.05, freq: 0.9, blend: 'overlay' },
    full('#000000', { op: '=state.focus * 0.22' }),
  ],
};

const leaf = (x, y, rot, show) => ({ t: 'path', d: 'M0 0 C 30 -30 60 -20 80 0 C 60 20 30 30 0 0 Z', x, y, rot, fill: 'token:accent', op: 0.9, show });
const sprout = customWidget({ name: 'Sprout', size: [300, 340], root: [
  group([
    { t: 'path', d: 'M-50 0 L50 0 L40 60 L-40 60 Z', fill: "=mixc('#b4673d', '#7a4527', dark)", y: 0 },
    group([
      { t: 'path', d: 'M0 0 C 4 -60 -4 -120 0 -190', stroke: 'token:accent', sw: 7, fill: 'none' },
      leaf(2, -50, -20, '=goal > 0.15'), leaf(-2, -90, -160, '=goal > 0.35'), leaf(2, -130, -25, '=goal > 0.55'), leaf(-2, -165, -155, '=goal > 0.75'),
      ellipse(-16, -216, 32, 32, '#ffd54a', { show: '=goal > 0.95' }), ellipse(-7, -207, 14, 14, '#c9741a', { show: '=goal > 0.95' }),
    ], { x: 0, y: 0, sc: '=0.35 + min(1, goal) * 0.65' }),
  ], { x: 150, y: 232 }),
  text(150, 326, 26, '{fmt(goal * 100, 0)}% grown', { align: 'middle', font: 'display', italic: true, fill: 'token:text' }),
] });
const growth = customWidget({ name: 'Growth', size: [420, 190], root: [
  text(0, 28, 22, 'Growth this week', { font: 'display', italic: true, fill: 'token:text' }),
  text(420, 28, 18, '{sum(week)} min', { align: 'end', fill: 'token:accent-text', weight: 700 }),
  { t: 'spark', x: 0, y: 50, w: 420, h: 100, of: 'week', kind: 'area', fill: "=alpha('#3b7a37', 0.35)", stroke: 'token:accent', sw: 3 },
  ...['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => text(i * 70, 178, 14, d, { fill: 'token:text-3' })),
] });
const leaves = customWidget({ name: 'Leaf list', size: [380, 300], root: [
  text(0, 30, 26, 'To tend', { font: 'display', italic: true, fill: 'token:text' }),
  text(380, 30, 16, '{tasksOpen} left', { align: 'end', fill: 'token:text-3' }),
  { t: 'list', x: 0, y: 52, w: 380, of: 'tasks', max: 5, rowh: 46, on: { click: { do: 'task.toggle' } }, item: group([
    { t: 'path', d: 'M0 0 C 10 -12 22 -10 28 0 C 22 10 10 12 0 0 Z', x: 4, y: 26, fill: 'token:accent' },
    text(44, 32, 20, '{item.text}', { fill: 'token:text', font: 'body' }),
  ]) },
] });

export default {
  id: 'moss', appearance: { look: 'moss', mode: 'dark', accent: 'look' },
  home: {
    background: 'scene', scene, clockStyle: 'serif', layout: 'center', greeting: true, dna: { s: 'solid' },
    modules: { focus: false, today: false, tasks: false, habits: false, notes: false, links: false },
    type: { clock: { font: 'playfair', weight: 500, tracking: -0.02 }, text: {} },
    widgets: [sprout, growth, leaves],
    canvas: { on: true, items: { clock: { x: 28, y: 30, s: 1.15 }, greeting: { x: 28, y: 46, s: 1 }, [sprout.id]: { x: 16, y: 74, w: 220 }, [growth.id]: { x: 44, y: 80, w: 380 }, [leaves.id]: { x: 80, y: 50, w: 340 } } },
  },
};
