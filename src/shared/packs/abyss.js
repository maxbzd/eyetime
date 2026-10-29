// Abyss — deep water. Light that sways down from the surface, marine snow, a jellyfish drifting by; sunlit shallows in light looks.

import { text, rect, ellipse, group, full, grad, radial, customWidget } from './kit.js';

const beam = (x, w, a, ph) => ({ t: 'rect', x, y: -200, w, h: 1200, rot: `=${a} + sin(t * 0.18 + ${ph}) * 4`, fill: grad(90, [0, 'rgba(160,255,245,0)'], [0.5, 'rgba(160,255,245,0.8)'], [1, 'rgba(160,255,245,0)']), op: '=0.12 + (1 - dark) * 0.18 + state.focus * 0.1', blend: 'screen', blur: 14 });
const tentacle = (k) => ({ t: 'path', d: 'M0 0 C 8 30 -8 60 0 95 C 6 120 -4 140 2 160', x: -40 + k * 16, y: 36, stroke: "=alpha('#7ff7ea', 0.5)", sw: 3, fill: 'none', rot: `=sin(t * 0.9 + ${k}) * 8`, blur: 0.8 });
const kelp = (x, h, ph) => ({ t: 'path', d: `M0 0 C -14 ${-h * 0.3} 14 ${-h * 0.6} 0 ${-h}`, x, y: '=H', stroke: "=mixc('#2d8f80', '#05352f', dark)", sw: 9, fill: 'none', rot: `=sin(t * 0.5 + ${ph}) * 4`, op: 0.9 });
const scene = {
  name: 'Deep',
  states: { focus: { when: 'focus > 0.5', ease: 2.4 } },
  layers: [
    full(grad(180, [0, "=mixc('#e9fbfa', '#0b4254', dark)"], [0.55, "=mixc('#9fe3df', '#03212b', dark)"], [1, "=mixc('#4fb5b8', '#00080c', dark)"])),
    beam(40, 90, -18, 0), beam(260, 140, -18, 1.5), beam(520, 100, -18, 3), beam(760, 160, -18, 4.5),
    { t: 'particles', x: 0, y: 0, w: '=W', h: '=H', n: 70, size: [0.8, 2.2], speed: [4, 14], dir: 'up', colors: ['#ffffff', '#c9fff7'], op: '=0.35 + (1 - dark) * 0.25', seed: 21 },
    { t: 'particles', x: 0, y: '=H * 0.2', w: '=W', h: '=H * 0.8', n: 44, size: [1.2, 3], speed: [3, 10], dir: 'any', twinkle: true, colors: ['#35e2cb', '#7ff7ea', '#6fb7ff'], op: '=dark * 0.9', seed: 8, blend: 'screen' },
    group([
      ellipse(-110, -80, 220, 190, radial(0.5, 0.5, 0.5, [0, "=alpha('#7ff7ea', 0.34)"], [1, 'rgba(127,247,234,0)']), { blend: 'screen' }),
      ellipse(-60, -40, 120, 92, radial(0.5, 0.3, 0.7, [0, 'rgba(210,255,250,0.55)'], [1, 'rgba(53,226,203,0.12)']), { stroke: 'rgba(160,255,245,0.6)', sw: 1.5, blur: 0.6 }),
      ...[0, 1, 2, 3, 4, 5].map(tentacle),
    ], { x: '=W * 0.6 + sin(t * 0.2) * 50 + (mouseX - 0.5) * -22', y: '=H * 0.2 + sin(t * 0.55) * 22', rot: '=sin(t * 0.3) * 4', sc: '=1.1 + sin(t * 1.1) * 0.04', op: '=0.5 + dark * 0.5' }),
    { t: 'path', x: -10, y: '=H - 80', d: 'M0 80 L0 30 C 120 -10 240 40 380 20 C 520 0 640 50 780 24 C 900 6 980 40 1040 20 L1040 80 Z', fill: "=mixc('#2f8f8a', '#02161b', dark)" },
    kelp(70, 200, 0), kelp(110, 150, 1.5), kelp(880, 190, 3), kelp(930, 140, 4.5), kelp(980, 220, 2.2),
    full('#00060a', { op: '=state.focus * 0.3' }),
  ],
};
const gauge = customWidget({ name: 'Depth gauge', size: [220, 330], root: [
  text(0, 24, 13, 'DEPTH', { ls: 6, fill: 'token:accent-text', weight: 600 }),
  rect(30, 40, 8, 250, 'token:border-strong', { r: 4 }),
  ...[0, 1, 2, 3, 4].map((k) => ({ t: 'line', x1: 30, y1: 40 + k * 62.5, x2: 54, y2: 40 + k * 62.5, stroke: 'token:text-3', sw: 1.5 })),
  rect(30, '=40 + (1 - goal) * 250', 8, '=goal * 250', 'token:accent', { r: 4, blur: 0.6 }),
  ellipse('=24', '=40 + (1 - goal) * 250 - 8', 20, 20, 'token:accent', { blur: 0.4 }),
  text(70, 110, 70, '{focusToday}', { weight: 300, fill: 'token:text' }), text(70, 140, 16, 'metres of focus', { fill: 'token:text-2' }),
  text(70, 214, 40, '{fmt(goal * 100, 0)}%', { weight: 300, fill: 'token:accent-text' }), text(70, 238, 14, 'of the dive', { fill: 'token:text-3' }),
] });
const sonar = customWidget({ name: 'Sonar', size: [300, 300], root: [
  ...[40, 80, 120, 140].map((r) => ({ t: 'ring', x: 150, y: 150, r, sw: 1.2, val: 1, fill: 'token:accent', track: 'rgba(0,0,0,0)', op: 0.3 })),
  { t: 'line', x1: 10, y1: 150, x2: 290, y2: 150, stroke: 'token:accent', sw: 0.8, op: 0.25 }, { t: 'line', x1: 150, y1: 10, x2: 150, y2: 290, stroke: 'token:accent', sw: 0.8, op: 0.25 },
  group([{ t: 'path', d: 'M0 0 L0 -140 A140 140 0 0 1 99 -99 Z', fill: grad(90, [0, "=alpha('#35e2cb', 0.0)"], [1, "=alpha('#35e2cb', 0.5)"]) }, { t: 'line', x1: 0, y1: 0, x2: 0, y2: -140, stroke: 'token:accent', sw: 2 }], { x: 150, y: 150, rot: '=t * 60' }),
  ...[[210, 90], [90, 120], [200, 200], [110, 210], [170, 60], [240, 160]].map(([x, y], k) => ellipse(x - 6, y - 6, 12, 12, 'token:accent', { show: `=tasksOpen > ${k}`, op: `=0.5 + 0.5 * sin(t * 2 + ${k})`, blur: 0.5 })),
  text(150, 292, 14, '{tasksOpen} contacts', { align: 'middle', ls: 4, fill: 'token:text-2' }),
] });
const bubbles = customWidget({ name: 'Pressure list', size: [380, 300], root: [
  text(0, 30, 24, 'Surface at', { weight: 300, fill: 'token:text' }), text(380, 30, 14, '{tasksOpen} to go', { align: 'end', fill: 'token:text-3' }),
  { t: 'list', x: 0, y: 52, w: 380, of: 'tasks', max: 5, rowh: 46, on: { click: { do: 'task.toggle' } }, item: group([
    ellipse(2, 10, 22, 22, radial(0.35, 0.3, 0.7, [0, 'rgba(255,255,255,0.9)'], [1, "=alpha('#35e2cb', 0.45)"]), { stroke: 'token:accent', sw: 1.5 }),
    text(40, 28, 20, '{item.text}', { fill: 'token:text', font: 'body' }),
  ]) },
] });

export default {
  id: 'abyss', appearance: { look: 'abyss', mode: 'dark', accent: 'look' },
  home: {
    background: 'scene', scene, clockStyle: 'thin', layout: 'center', greeting: true, dna: { s: 'glass' },
    modules: { focus: false, today: false, tasks: false, habits: false, notes: false, links: false },
    type: { clock: { font: 'montserrat', weight: 200, tracking: -0.05, glow: 0.35 }, text: {} },
    widgets: [gauge, sonar, bubbles],
    canvas: { on: true, items: { clock: { x: 32, y: 30, s: 1.2 }, greeting: { x: 32, y: 46, s: 1 }, [gauge.id]: { x: 14, y: 76, w: 190 }, [sonar.id]: { x: 36, y: 74, w: 240 }, [bubbles.id]: { x: 80, y: 62, w: 340 } } },
  },
};
