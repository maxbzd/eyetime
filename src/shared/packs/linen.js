// Linen — a study desk in the morning light. Paper, ink and a terracotta stamp; a window of sun that crosses the desk during the day.

import { text, rect, group, full, grad, radial, customWidget } from './kit.js';

const scene = {
  name: 'Study desk',
  params: { dust: { type: 'number', min: 0, max: 1, def: 0.7, label: 'Dust in the light' } },
  states: { focus: { when: 'focus > 0.5', ease: 2.4 } },
  layers: [
    full('token:bg'),
    // the window: a soft band of sun that slides across the desk with the day
    { t: 'rect', x: '=mix(-380, 520, dayFrac)', y: -160, w: 520, h: 1100, rot: -24, fill: grad(90, [0, 'rgba(255,236,200,0)'], [0.5, 'rgba(255,238,205,0.9)'], [1, 'rgba(255,236,200,0)']), op: '=smooth(0.08, 0.5, daylight) * 0.5', blur: 26 },
    { t: 'rect', x: '=mix(-300, 600, dayFrac)', y: -160, w: 300, h: 1100, rot: -24, fill: grad(90, [0, 'rgba(255,225,170,0)'], [0.5, 'rgba(255,225,170,0.8)'], [1, 'rgba(255,225,170,0)']), op: '=smooth(0.08, 0.5, daylight) * 0.32', blend: 'overlay', blur: 18 },
    { t: 'particles', x: 0, y: 0, w: '=W', h: '=H', n: 46, size: [0.9, 2.6], speed: [3, 9], dir: 'up', colors: ['#fff6df', '#f3d9a4', '#ffffff'], op: '=daylight * p.dust * 0.8', seed: 4, twinkle: true },
    // a plant in the corner throws a leafy shadow that sways
    group([
      { t: 'path', d: 'M0 0 C 30 -90 80 -150 150 -190 C 120 -120 90 -60 60 0 Z', fill: 'rgba(60,40,20,0.14)', blur: 5 },
      { t: 'path', d: 'M20 0 C 70 -60 140 -80 220 -70 C 160 -40 100 -20 50 0 Z', fill: 'rgba(60,40,20,0.11)', blur: 5 },
      { t: 'path', d: 'M-20 0 C -40 -70 -20 -140 20 -200 C 30 -130 20 -60 10 0 Z', fill: 'rgba(60,40,20,0.12)', blur: 5 },
    ], { x: '=W - 220 + (mouseX - 0.5) * -14', y: '=H + 10', rot: '=sin(t * 0.35) * 1.6 - 4', op: '=smooth(0.1, 0.45, daylight)' }),
    { t: 'noise', x: 0, y: 0, w: '=W', h: '=H', op: 0.07, freq: 0.9, blend: 'multiply' },
    full(radial(0.5, 0.45, 0.8, [0.55, 'rgba(70,40,20,0)'], [1, 'rgba(70,40,20,0.2)'])),
    full('#000000', { op: '=state.focus * 0.18' }),
  ],
};

// A rubber stamp: the day's goal as an ink ring, a little crooked, like it was pressed by hand.
const stamp = customWidget({ name: 'Goal stamp', size: [300, 300], root: [
  group([
    { t: 'ring', x: 0, y: 0, r: 136, sw: 5, val: 1, fill: 'token:accent', track: 'rgba(0,0,0,0)', op: 0.9 },
    { t: 'ring', x: 0, y: 0, r: 122, sw: 2, val: 1, fill: 'token:accent', track: 'rgba(0,0,0,0)', op: 0.9 },
    { t: 'ring', x: 0, y: 0, r: 104, sw: 18, val: '=goal', fill: 'token:accent', track: "=alpha('#b0431d', 0.16)", cap: 'butt' },
    text(0, 28, 76, '{fmt(goal * 100, 0)}', { align: 'middle', weight: 600, fill: 'token:accent', font: 'display' }),
    text(0, -34, 13, 'DAILY GOAL', { align: 'middle', weight: 700, ls: 5, fill: 'token:accent' }),
    text(0, 58, 15, '{focusToday} MIN', { align: 'middle', weight: 700, ls: 4, fill: 'token:accent' }),
  ], { x: 150, y: 150, rot: '=-9 + sin(t * 0.4) * 0.6' }),
] });

// A ruled page: today's tasks as a notebook list; tick one to finish it.
const ledger = customWidget({ name: 'Notebook page', size: [380, 340], root: [
  text(48, 44, 34, 'Today', { font: 'display', weight: 500, italic: true, fill: 'token:text' }),
  text(380, 44, 16, '{tasksDone} done · {tasksOpen} to go', { align: 'end', fill: 'token:text-3' }),
  ...[0, 1, 2, 3, 4, 5].map((i) => ({ t: 'line', x1: 0, y1: 84 + i * 44, x2: 380, y2: 84 + i * 44, stroke: 'token:border', sw: 1.5 })),
  { t: 'line', x1: 34, y1: 0, x2: 34, y2: 340, stroke: "=alpha('#b0431d', 0.4)", sw: 2 },
  { t: 'list', x: 0, y: 74, w: 380, of: 'tasks', max: 6, rowh: 44, on: { click: { do: 'task.toggle' } }, item: group([
    { t: 'ellipse', x: 12, y: 10, w: 18, h: 18, stroke: 'token:text-3', sw: 2 },
    text(54, 26, 21, '{item.text}', { fill: 'token:text', font: 'body' }),
    text(360, 26, 20, '★', { align: 'end', fill: 'token:accent', show: '=item.starred' }),
  ]) },
  text(48, 330, 14, '{len(tasks) == 0 ? "Nothing left. Lovely." : ""}', { fill: 'token:text-3', italic: true, font: 'display' }),
] });

// The week as pencil tallies.
const week = customWidget({ name: 'Week tallies', size: [380, 170], root: [
  text(0, 28, 20, 'This week', { font: 'display', italic: true, fill: 'token:text-2' }),
  text(380, 28, 20, '{sum(week)} min', { align: 'end', weight: 600, fill: 'token:accent-text' }),
  { t: 'spark', x: 0, y: 50, w: 380, h: 80, of: 'week', kind: 'bars', gap: 22, fill: 'token:accent' },
  ...['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => text(27 + i * 54.3, 154, 14, d, { align: 'middle', fill: 'token:text-3' })),
] });

export default {
  id: 'linen', appearance: { look: 'linen', mode: 'light', accent: 'look' },
  home: {
    background: 'scene', scene, clockStyle: 'serif', layout: 'center', greeting: true, dna: { s: 'paper' },
    modules: { focus: false, today: false, tasks: false, habits: false, notes: false, links: false },
    type: { clock: { font: 'literata', weight: 300, tracking: -0.03 }, text: {} },
    widgets: [stamp, ledger, week],
    canvas: { on: true, items: { clock: { x: 33, y: 38, s: 1.15 }, greeting: { x: 33, y: 56, s: 1 }, [stamp.id]: { x: 20, y: 76, w: 230 }, [ledger.id]: { x: 80, y: 46, w: 400 }, [week.id]: { x: 50, y: 80, w: 400 } } },
  },
};
void rect;
