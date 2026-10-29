// Synthwave — a neon horizon. A striped sun, mountains with a magenta rim, and a grid that rolls toward you; a pastel sunrise version in light looks.

import { text, rect, ellipse, group, full, grad, radial, customWidget } from './kit.js';

const HZ = 'H * 0.6';
const hline = (k) => ({ t: 'line', x1: 0, x2: '=W', y1: `=${HZ} + pow(mod(t * 0.3 + ${k} / 12, 1), 2.3) * (H - ${HZ})`, y2: `=${HZ} + pow(mod(t * 0.3 + ${k} / 12, 1), 2.3) * (H - ${HZ})`, stroke: "=mixc('#d54bc0', '#ff45f2', dark)", sw: 2.2, op: `=0.25 + 0.7 * mod(t * 0.3 + ${k} / 12, 1)` });
const vline = (i) => ({ t: 'line', x1: `=W / 2 + ${(i - 7) * 10}`, y1: `=${HZ}`, x2: `=W / 2 + ${(i - 7) * 170}`, y2: '=H', stroke: "=mixc('#d54bc0', '#ff45f2', dark)", sw: 2, op: 0.55 });

const scene = {
  name: 'Neon horizon',
  states: { focus: { when: 'focus > 0.5', ease: 1.6 } },
  layers: [
    full(grad(180, [0, "=mixc('#ffd9fb', '#06021a', dark)"], [0.45, "=mixc('#ffc2ea', '#2a0856', dark)"], [0.6, "=mixc('#ffe0b8', '#b10a9f', dark)"], [1, "=mixc('#ffd0ee', '#14052e', dark)"])),
    { t: 'particles', x: 0, y: 0, w: '=W', h: '=H * 0.5', n: 80, size: [0.6, 1.6], speed: [0, 0], twinkle: true, colors: ['#ffffff', '#ffc4ff', '#9ee7ff'], op: '=dark * 0.9', seed: 5 },
    group([
      ellipse(-260, -260, 520, 520, radial(0.5, 0.5, 0.5, [0, "=alpha('#ff45f2', 0.5)"], [1, 'rgba(255,69,242,0)']), { blend: 'screen', op: '=0.6 + state.focus * 0.3' }),
      ellipse(-170, -170, 340, 340, grad(180, [0, '#fff36b'], [0.5, '#ff7ad9'], [1, '#c22cff'])),
      ...[0, 1, 2, 3, 4, 5].map((k) => rect(-180, `=${10 + k * 26} + mod(t * 6, 26) * 0.0`, 360, 3 + k * 2.6, "=mixc('#ffb1e8', '#220848', dark)")),
    ], { x: '=W * 0.66 + (mouseX - 0.5) * -20', y: `=${HZ} - 110` }),
    { t: 'path', x: 0, y: `=${HZ} - 150`, d: 'M0 150 L0 60 L90 110 L170 20 L260 120 L330 70 L400 150 Z', fill: "=mixc('#c87bd8', '#150535', dark)", stroke: '#ff45f2', sw: 2 },
    { t: 'path', x: '=W - 420', y: `=${HZ} - 130`, d: 'M0 130 L70 50 L140 100 L230 10 L320 110 L420 40 L420 130 Z', fill: "=mixc('#c87bd8', '#150535', dark)", stroke: '#ff45f2', sw: 2 },
    rect(0, `=${HZ}`, '=W', '=H - H * 0.6', grad(180, [0, "=mixc('#f7c6f0', '#2a0a55', dark)"], [1, "=mixc('#f0b2e6', '#08021a', dark)"])),
    ellipse(-100, `=${HZ} - 34`, '=W + 200', 70, "=alpha('#ff45f2', 0.55)", { blur: 24, blend: 'screen', op: '=dark' }),
    { t: 'line', x1: 0, y1: `=${HZ}`, x2: '=W', y2: `=${HZ}`, stroke: '#ff9af7', sw: 2.4 },
    ...[...Array(12).keys()].map(hline), ...[...Array(15).keys()].map(vline),
    full('#10003a', { op: '=state.focus * 0.3' }),
  ],
};

const arcade = customWidget({ name: 'High score', size: [380, 240], root: [
  text(0, 28, 16, 'HI-SCORE', { font: 'display', ls: 6, fill: 'token:accent-text', weight: 600 }),
  text(0, 104, 76, '{pad(focusToday * 10, 5)}', { font: 'display', weight: 600, fill: grad(180, [0, "=mixc('#ff9a1f', '#fff36b', dark)"], [1, "=mixc('#c0188f', '#ff45f2', dark)"]), shadow: { x: 0, y: 0, blur: 12, color: 'rgba(255,69,242,0.7)' } }),
  { t: 'line', x1: 0, y1: 128, x2: 380, y2: 128, stroke: 'token:accent', sw: 2, op: 0.6 },
  text(0, 168, 20, 'STREAK  x{streak}', { font: 'display', fill: 'token:text', weight: 500, ls: 2 }),
  text(0, 204, 20, 'LEVEL   {sessionsToday}', { font: 'display', fill: 'token:text', weight: 500, ls: 2 }),
  text(380, 204, 16, '{fmt(goal * 100, 0)}% TO NEXT', { align: 'end', fill: 'token:accent-text', ls: 2 }),
  { t: 'bar', x: 0, y: 220, w: 380, h: 8, r: 0, val: '=goal', fill: grad(90, [0, '#ff45f2'], [1, '#6fe3ff']), track: "=alpha('#ff45f2', 0.2)" },
] });
const eq = customWidget({ name: 'Equalizer', size: [420, 220], root: [
  text(0, 26, 16, 'ENERGY / WEEK', { font: 'display', ls: 5, fill: 'token:accent-text', weight: 600 }),
  { t: 'spark', x: 0, y: 44, w: 420, h: 130, of: 'week', kind: 'bars', gap: 22, fill: grad(180, [0, '#ff45f2'], [1, '#6fe3ff']), blur: 5, op: 0.8 },
  { t: 'spark', x: 0, y: 44, w: 420, h: 130, of: 'week', kind: 'bars', gap: 22, fill: grad(180, [0, '#ffb3fb'], [1, '#9ee7ff']) },
  ...['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => text(30 + i * 60, 202, 14, d, { align: 'middle', fill: 'token:text-3', font: 'display' })),
] });
const playlist = customWidget({ name: 'Playlist', size: [380, 300], root: [
  text(0, 26, 16, 'NOW PLAYING', { font: 'display', ls: 5, fill: 'token:accent-text', weight: 600 }),
  { t: 'list', x: 0, y: 44, w: 380, of: 'tasks', max: 5, rowh: 48, on: { click: { do: 'task.toggle' } }, item: group([
    text(0, 30, 18, '{pad(item.i + 1, 2)}', { font: 'display', fill: 'token:accent-text', weight: 600 }),
    text(46, 30, 20, '{item.text}', { fill: 'token:text', font: 'body' }),
    { t: 'line', x1: 0, y1: 40, x2: 380, y2: 40, stroke: 'token:border', sw: 1 },
  ]) },
] });

export default {
  id: 'synthwave', appearance: { look: 'synthwave', mode: 'dark', accent: 'look' },
  home: {
    background: 'scene', scene, clockStyle: 'bold', layout: 'center', greeting: true, dna: { s: 'look' },
    modules: { focus: false, today: false, tasks: false, habits: false, notes: false, links: false },
    type: { clock: { font: 'unbounded', weight: 500, tracking: -0.03 }, text: {} },
    widgets: [arcade, eq, playlist],
    canvas: { on: true, items: { clock: { x: 27, y: 18, s: 1.05 }, greeting: { x: 27, y: 32, s: 0.9 }, [arcade.id]: { x: 18, y: 74, w: 340 }, [eq.id]: { x: 50, y: 78, w: 380 }, [playlist.id]: { x: 82, y: 70, w: 330 } } },
  },
};
