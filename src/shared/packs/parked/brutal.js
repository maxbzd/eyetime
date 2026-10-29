// Brutal — a sticker board. Graph paper, loud shapes with hard shadows, numbers you cannot miss.

import { text, rect, ellipse, group, full, customWidget } from '../kit.js';

const shadowed = (children, o) => group(children, o);
const scene = {
  name: 'Sticker board',
  states: { focus: { when: 'focus > 0.5', ease: 1 } },
  layers: [
    full('token:bg'),
    { t: 'lines', x: 0, y: 0, w: '=W', h: '=H', gap: 40, sw: 1.5, dir: 'h', stroke: "=alpha('#111111', 0.08 + dark * 0.12)" },
    { t: 'lines', x: 0, y: 0, w: '=W', h: '=H', gap: 40, sw: 1.5, dir: 'v', stroke: "=alpha('#111111', 0.08 + dark * 0.12)" },
    shadowed([
      ellipse(14, 14, 190, 190, '#111111'), ellipse(0, 0, 190, 190, '#ffe600', { stroke: '#111111', sw: 6 }),
      { t: 'path', d: 'M42 100 Q 95 160 148 100', stroke: '#111111', sw: 7, fill: 'none' },
      ellipse(55, 55, 16, 26, '#111111'), ellipse(120, 55, 16, 26, '#111111'),
    ], { x: '=W - 280 + sin(t * 0.5) * 10', y: '=70 + cos(t * 0.4) * 8', rot: '=sin(t * 0.3) * 4' }),
    shadowed([
      { t: 'path', d: 'M20 20 L170 20 L95 150 Z', fill: '#111111' }, { t: 'path', d: 'M5 5 L155 5 L80 135 Z', fill: '#4cc9f0', stroke: '#111111', sw: 6 },
    ], { x: 70, y: '=H - 220 + sin(t * 0.45) * 8', rot: '=-12 + sin(t * 0.35) * 5' }),
    shadowed([
      { t: 'path', d: 'M10 40 Q 40 0 70 40 T 130 40 T 190 40 T 250 40', stroke: '#111111', sw: 22, fill: 'none', cap: 'butt' }, { t: 'path', d: 'M0 30 Q 30 -10 60 30 T 120 30 T 180 30 T 240 30', stroke: '#ff3d81', sw: 16, fill: 'none', cap: 'butt' },
    ], { x: '=W - 420 + sin(t * 0.3) * 14', y: '=H - 150', rot: 6 }),
    full('#000000', { op: '=state.focus * 0.25' }),
  ],
};

const stamp = (x, y, w, h, fill, o = {}) => group([rect(8, 8, w, h, '#111111'), rect(0, 0, w, h, fill, { stroke: '#111111', sw: 5 })], { x, y, ...o });
const big = customWidget({ name: 'Big number', size: [340, 250], root: [
  stamp(0, 0, 320, 230, 'token:surface'),
  rect(0, 0, 320, 46, 'token:accent', { stroke: '#111111', sw: 5 }),
  text(16, 33, 24, 'TODAY\'S GOAL', { weight: 800, fill: 'token:accent-fg', ls: 1 }),
  text(160, 168, 130, '{fmt(goal * 100, 0)}%', { align: 'middle', weight: 800, fill: 'token:text', ls: -6 }),
  rect(16, 188, 288, 24, 'rgba(128,128,128,0.25)', { stroke: '#111111', sw: 4 }),
  { t: 'bar', x: 16, y: 188, w: 288, h: 24, r: 0, val: '=goal', fill: 'token:accent', track: 'rgba(0,0,0,0)' },
] });
const tasks = customWidget({ name: 'Sticky tasks', size: [380, 330], root: [
  stamp(0, 0, 360, 310, '#ffe600'),
  text(18, 44, 30, 'DO THIS', { weight: 800, fill: '#111111', ls: -1 }),
  text(342, 44, 20, '{tasksOpen}', { align: 'end', weight: 800, fill: '#111111' }),
  { t: 'line', x1: 18, y1: 62, x2: 342, y2: 62, stroke: '#111111', sw: 5 },
  { t: 'list', x: 0, y: 72, w: 360, of: 'tasks', max: 5, rowh: 46, on: { click: { do: 'task.toggle' } }, item: group([
    rect(18, 6, 26, 26, '#ffffff', { stroke: '#111111', sw: 4 }),
    text(58, 28, 19, '{item.text}', { weight: 800, fill: '#111111', upper: true, font: 'body' }),
  ]) },
] });
const streak = customWidget({ name: 'Streak', size: [300, 220], root: [
  stamp(0, 0, 280, 200, '#4cc9f0'),
  text(140, 130, 110, '{streak}', { align: 'middle', weight: 800, fill: '#111111', ls: -4 }),
  text(140, 168, 26, 'DAYS IN A ROW', { align: 'middle', weight: 800, fill: '#111111', ls: 1 }),
  { t: 'path', d: 'M0 0 L20 -22 L40 0 L60 -22 L80 0', x: 100, y: 36, stroke: '#111111', sw: 6, fill: 'none', cap: 'butt' },
] });

export default {
  id: 'brutal', appearance: { look: 'brutal', mode: 'light', accent: 'look' },
  home: {
    background: 'scene', scene, clockStyle: 'bold', layout: 'center', greeting: true, dna: { s: 'bare' },
    modules: { focus: false, today: false, tasks: false, habits: false, notes: false, links: false },
    type: { clock: { font: 'rubik', weight: 800, tracking: -0.05 }, text: { font: 'rubik', weight: 800 } },
    widgets: [big, tasks, streak],
    canvas: { on: true, items: { clock: { x: 30, y: 30, s: 1.2 }, greeting: { x: 30, y: 46, s: 1 }, [big.id]: { x: 20, y: 74, w: 300 }, [streak.id]: { x: 44, y: 78, w: 260 }, [tasks.id]: { x: 78, y: 66, w: 340 } } },
  },
};
