// Zen — an ink-wash garden. Layered mountains in mist, a vermilion sun like a seal, ripples on still water.

import { text, ellipse, full, customWidget } from '../kit.js';

const ripple = (k) => ({ t: 'ring', x: 520, y: '=H - 70', r: `=mod(t * 14 + ${k * 48}, 190)`, sw: 1.4, val: 1, fill: 'token:text-3', track: 'rgba(0,0,0,0)', op: `=(1 - mod(t * 14 + ${k * 48}, 190) / 190) * 0.6`, rot: 0, sc: 1 });
const mist = (k, y, w, h, speed) => ellipse(`=mod(t * ${speed} + ${k * 380}, W + 600) - 400`, y, w, h, "=alpha(mixc('#f6f1e5', '#0c0b09', dark), 0.55)", { blur: 30 });

const scene = {
  name: 'Ink wash',
  states: { focus: { when: 'focus > 0.5', ease: 3 } },
  layers: [
    full(grad2()),
    ellipse('=700 + dayFrac * 230 - 64', '=H * 0.3 - sin(rad(dayFrac * 180)) * H * 0.12 - 64', 128, 128, 'token:accent', { op: '=0.9 - state.focus * 0.3 - dark * 0.3', blur: 0.8 }),
    { t: 'path', x: '=-20 + (mouseX - 0.5) * -10', y: '=H - 330', d: 'M0 330 L0 200 C 80 120 140 200 230 90 C 300 10 360 120 440 70 C 520 20 600 130 700 80 C 800 30 880 130 1040 60 L1040 330 Z', fill: 'token:text', op: 0.07 },
    mist(0, '=H - 290', 560, 90, 3), mist(1, '=H - 260', 620, 100, 2),
    { t: 'path', x: '=-20 + (mouseX - 0.5) * -22', y: '=H - 250', d: 'M0 250 L0 160 C 100 70 170 150 270 110 C 370 70 430 160 540 120 C 660 80 740 160 860 100 C 940 60 1000 110 1040 90 L1040 250 Z', fill: 'token:text', op: 0.12 },
    mist(2, '=H - 210', 700, 110, 4),
    { t: 'path', x: '=-20 + (mouseX - 0.5) * -40', y: '=H - 170', d: 'M0 170 L0 110 C 120 60 200 130 320 100 C 440 70 520 150 660 110 C 780 80 900 140 1040 100 L1040 170 Z', fill: 'token:text', op: 0.2 },
    { t: 'rect', x: 0, y: '=H - 90', w: '=W', h: 90, fill: 'token:text', op: 0.05 },
    ripple(0), ripple(1), ripple(2), ripple(3),
    { t: 'group', x: 70, y: '=H', children: [
      { t: 'rect', x: 0, y: -330, w: 12, h: 330, fill: 'token:text', op: 0.22 }, { t: 'line', x1: -2, y1: -110, x2: 14, y2: -110, stroke: 'token:bg', sw: 3 }, { t: 'line', x1: -2, y1: -220, x2: 14, y2: -220, stroke: 'token:bg', sw: 3 },
      { t: 'rect', x: 40, y: -250, w: 9, h: 250, fill: 'token:text', op: 0.16 }, { t: 'line', x1: 38, y1: -90, x2: 51, y2: -90, stroke: 'token:bg', sw: 3 }, { t: 'line', x1: 38, y1: -170, x2: 51, y2: -170, stroke: 'token:bg', sw: 3 },
    ], rot: '=sin(t * 0.5) * 0.6' },
    { t: 'noise', x: 0, y: 0, w: '=W', h: '=H', op: 0.06, freq: 0.8, blend: 'multiply' },
    full('#000000', { op: '=state.focus * 0.18' }),
  ],
};
function grad2() { return { g: 'linear', a: 180, stops: [[0, "=mixc('#f2ecdc', '#15130f', dark)"], [1, "=mixc('#e3dcc8', '#0d0c0a', dark)"]] }; }

const enso = customWidget({ name: 'Enso', size: [300, 300], root: [
  { t: 'ring', x: 150, y: 150, r: 116, sw: 3, val: 1, fill: 'token:border', track: 'rgba(0,0,0,0)' },
  { t: 'ring', x: 150, y: 150, r: 116, sw: 22, val: '=goal * 0.92', fill: 'token:text', track: 'rgba(0,0,0,0)', start: -80, op: 0.9 },
  { t: 'ring', x: 150, y: 150, r: 116, sw: 9, val: '=goal * 0.92', fill: 'token:text', track: 'rgba(0,0,0,0)', start: -76, op: 0.5 },
  text(150, 165, 64, '{fmt(goal * 100, 0)}', { align: 'middle', font: 'display', weight: 300, fill: 'token:text' }),
  { t: 'rect', x: 128, y: 208, w: 44, h: 44, fill: 'token:accent', op: 0.92, r: 2 },
  text(150, 238, 22, '{focusToday}', { align: 'middle', font: 'display', fill: 'token:accent-fg', weight: 500 }),
] });
const stone = (k, w) => ellipse(`=150 - ${w / 2}`, 244 - k * 34, w, 30, 'token:text', { op: `=(tasksOpen > ${k}) * (0.8 - ${k} * 0.07)`, show: `=tasksOpen > ${k}` });
const cairn = customWidget({ name: 'Cairn', size: [300, 320], root: [
  text(150, 34, 22, 'Stones to go', { align: 'middle', font: 'display', fill: 'token:text-2' }),
  stone(0, 190), stone(1, 156), stone(2, 126), stone(3, 98), stone(4, 72), stone(5, 50),
  text(150, 316, 38, '{tasksOpen}', { align: 'middle', font: 'display', fill: 'token:text', weight: 300 }),
  { t: 'line', x1: 40, y1: 282, x2: 260, y2: 282, stroke: 'token:border-strong', sw: 1.5 },
] });
const reeds = customWidget({ name: 'Week reeds', size: [420, 200], root: [
  text(0, 28, 20, 'The week', { font: 'display', fill: 'token:text-2' }),
  { t: 'spark', x: 10, y: 44, w: 400, h: 110, of: 'week', kind: 'bars', gap: 40, fill: 'token:text' },
  { t: 'line', x1: 0, y1: 156, x2: 420, y2: 156, stroke: 'token:border-strong', sw: 1.5 },
  ...['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d, i) => text(30 + i * 60, 180, 14, d, { align: 'middle', fill: 'token:text-3', ls: 3, upper: true })),
] });

export default {
  id: 'zen', appearance: { look: 'zen', mode: 'light', accent: 'look' },
  home: {
    background: 'scene', scene, clockStyle: 'thin', layout: 'center', greeting: true, dna: { s: 'bare' },
    modules: { focus: false, today: false, tasks: false, habits: false, notes: false, links: false },
    type: { clock: { font: 'serif', weight: 300, tracking: 0.01 }, text: {} },
    widgets: [enso, cairn, reeds],
    canvas: { on: true, items: { clock: { x: 50, y: 24, s: 1.1 }, greeting: { x: 50, y: 38, s: 0.95 }, [enso.id]: { x: 20, y: 62, w: 240 }, [cairn.id]: { x: 80, y: 62, w: 220 }, [reeds.id]: { x: 50, y: 74, w: 360 } } },
  },
};
