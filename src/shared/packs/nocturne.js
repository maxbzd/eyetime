// Nocturne — a night sky over quiet hills. A moon with a halo, three layers of stars, a shooting star now and then; a pale day sky with clouds in light looks.

import { text, rect, ellipse, group, full, grad, radial, customWidget } from './kit.js';

const star = (x, y, i) => ({ t: 'group', x, y, children: [
  ellipse('=-(6 + 14 * at(week, ' + i + ') / max(1, maxa(week))) * 2', '=-(6 + 14 * at(week, ' + i + ') / max(1, maxa(week))) * 2', '=(6 + 14 * at(week, ' + i + ') / max(1, maxa(week))) * 4', '=(6 + 14 * at(week, ' + i + ') / max(1, maxa(week))) * 4', radial(0.5, 0.5, 0.5, [0, 'rgba(190,210,255,0.55)'], [1, 'rgba(190,210,255,0)']), { blend: 'screen' }),
  ellipse('=-(2.5 + 6 * at(week, ' + i + ') / max(1, maxa(week)))', '=-(2.5 + 6 * at(week, ' + i + ') / max(1, maxa(week)))', '=(2.5 + 6 * at(week, ' + i + ') / max(1, maxa(week))) * 2', '=(2.5 + 6 * at(week, ' + i + ') / max(1, maxa(week))) * 2', '#ffffff'),
] });

const scene = {
  name: 'Moonlit sky',
  states: { focus: { when: 'focus > 0.5', ease: 2.4 } },
  layers: [
    full(grad(180, [0, "=mixc('#bccaf0', '#03051a', dark)"], [0.6, "=mixc('#dbe3f7', '#0a1136', dark)"], [1, "=mixc('#eef1fa', '#16204c', dark)"])),
    { t: 'particles', x: 0, y: 0, w: '=W', h: '=H * 0.7', n: 90, size: [0.5, 1.2], speed: [0, 0], twinkle: true, colors: ['#ffffff', '#cfdcff'], op: '=dark * 0.8', seed: 3 },
    { t: 'particles', x: 0, y: 0, w: '=W', h: '=H * 0.7', n: 36, size: [1.2, 2.4], speed: [0, 0], twinkle: true, colors: ['#ffffff', '#ffe9c9', '#cfe0ff'], op: '=dark', seed: 8, blend: 'screen' },
    group([
      ellipse(-260, -260, 520, 520, radial(0.5, 0.5, 0.5, [0, 'rgba(190,210,255,0.5)'], [0.4, 'rgba(150,175,255,0.16)'], [1, 'rgba(150,175,255,0)']), { op: '=0.6 + state.focus * 0.4', blend: 'screen' }),
      ellipse(-62, -62, 124, 124, radial(0.4, 0.38, 0.65, [0, '#ffffff'], [1, '=mixc("#c8d2ee", "#aebbe0", dark)']), { op: 0.96 }),
      ellipse(-30, -22, 26, 26, 'rgba(120,135,180,0.28)'), ellipse(10, 14, 18, 18, 'rgba(120,135,180,0.22)'), ellipse(-8, 30, 12, 12, 'rgba(120,135,180,0.2)'),
    ], { x: '=W * 0.76 + (mouseX - 0.5) * -18', y: '=H * 0.26 + (mouseY - 0.5) * -10' }),
    { t: 'group', x: '=-120 + mod(t, 16) / 1.4 * 900', y: '=40 + mod(t, 16) / 1.4 * 330', show: '=mod(t, 16) < 1.4', children: [
      { t: 'line', x1: -110, y1: -48, x2: 0, y2: 0, stroke: grad(0, [0, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0.95)']), sw: 2.2, blur: 0.6 } ], op: '=dark * sin(mod(t, 16) / 1.4 * 3.14)' },
    ...[0, 1, 2, 3].map((k) => ellipse(`=mod(t * ${4 + k * 2} + ${k * 260}, W + 500) - 300`, `=H * ${0.12 + k * 0.1}`, 360 + k * 50, 70 + k * 10, 'rgba(255,255,255,0.8)', { blur: 22, op: '=(1 - dark) * 0.6' })),
    { t: 'path', x: -20, y: '=H - 190', d: 'M0 190 L0 120 C 100 60 170 110 260 70 S 420 20 540 90 S 740 50 860 100 S 1000 60 1040 90 L1040 190 Z', fill: "=mixc('#aab8dc', '#050918', dark)", op: 0.9 },
    { t: 'path', x: '=-20 + (mouseX - 0.5) * -24', y: '=H - 120', d: 'M0 120 L0 70 L30 70 L45 20 L60 70 L90 70 L105 0 L125 70 L170 70 L190 30 L210 70 L260 70 L280 40 L300 70 L1040 70 L1040 120 Z', fill: "=mixc('#8ea0cd', '#02040c', dark)" },
    full('#000010', { op: '=state.focus * 0.28' }),
  ],
};

const P = [[30, 175], [100, 120], [165, 150], [225, 85], [290, 120], [350, 70], [395, 105]];
const constellation = customWidget({ name: 'Constellation', size: [420, 250], root: [
  text(0, 30, 24, 'This week', { font: 'display', italic: true, fill: 'token:text' }),
  text(420, 30, 18, '{sum(week)} min', { align: 'end', fill: 'token:accent-text', weight: 600 }),
  ...P.slice(0, 6).map(([x, y], i) => ({ t: 'line', x1: x, y1: y, x2: P[i + 1][0], y2: P[i + 1][1], stroke: 'token:accent', sw: 1, op: 0.35 })),
  ...P.map(([x, y], i) => star(x, y, i)),
  ...['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => text(P[i][0], 232, 13, d, { align: 'middle', fill: 'token:text-3' })),
] });
const moonDial = customWidget({ name: 'Night goal', size: [300, 300], root: [
  { t: 'ring', x: 150, y: 150, r: 118, sw: 3, val: 1, fill: 'token:border-strong', track: 'rgba(0,0,0,0)' },
  { t: 'ring', x: 150, y: 150, r: 118, sw: 7, val: '=goal', fill: 'token:accent', track: 'rgba(0,0,0,0)', blur: 0.4 },
  ellipse(-100, 100, 200, 200, radial(0.5, 0.5, 0.5, [0, "=alpha('#a3b8ff', 0.20)"], [1, 'rgba(0,0,0,0)']), { x: 150, y: 150, blend: 'screen' }),
  text(150, 160, 78, '{fmt(goal * 100, 0)}', { align: 'middle', font: 'display', italic: true, weight: 500, fill: 'token:text' }),
  text(150, 198, 14, 'OF TODAY', { align: 'middle', ls: 6, fill: 'token:text-3' }),
  text(150, 234, 16, '{focusToday} min · {sessionsToday} sessions', { align: 'middle', fill: 'token:text-2' }),
] });
const nightList = customWidget({ name: 'Night list', size: [380, 300], root: [
  text(0, 32, 26, 'Tonight', { font: 'display', italic: true, fill: 'token:text' }),
  text(380, 32, 16, '{tasksOpen} to go', { align: 'end', fill: 'token:text-3' }),
  { t: 'list', x: 0, y: 56, w: 380, of: 'tasks', max: 5, rowh: 46, on: { click: { do: 'task.toggle' } }, item: group([
    ellipse(2, 14, 14, 14, radial(0.5, 0.5, 0.5, [0, 'rgba(190,210,255,0.9)'], [1, 'rgba(190,210,255,0)'])),
    ellipse(6, 18, 6, 6, '#ffffff'),
    text(32, 29, 20, '{item.text}', { fill: 'token:text', font: 'body' }),
  ]) },
  text(0, 290, 15, '{tasksOpen == 0 ? "A clear sky." : ""}', { font: 'display', italic: true, fill: 'token:text-3' }),
] });

export default {
  id: 'nocturne', appearance: { look: 'nocturne', mode: 'dark', accent: 'look' },
  home: {
    background: 'scene', scene, clockStyle: 'thin', layout: 'center', greeting: true, dna: { s: 'glass' },
    modules: { focus: false, today: false, tasks: false, habits: false, notes: false, links: false },
    type: { clock: { font: 'montserrat', weight: 200, tracking: -0.05, glow: 0.3 }, text: {} },
    widgets: [constellation, moonDial, nightList],
    canvas: { on: true, items: { clock: { x: 30, y: 32, s: 1.2 }, greeting: { x: 30, y: 48, s: 1 }, [moonDial.id]: { x: 16, y: 76, w: 240 }, [constellation.id]: { x: 44, y: 78, w: 400 }, [nightList.id]: { x: 78, y: 62, w: 360 } } },
  },
};
void rect;
