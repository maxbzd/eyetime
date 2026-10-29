// Ink — slow smoke and hairlines. Black and ivory with a thread of champagne; a chronograph and a page of roman numerals.

import { text, rect, ellipse, group, full, customWidget } from '../kit.js';

const smoke = (k, x, y, w, h, sp) => ellipse(`=${x} + sin(t * ${sp} + ${k}) * 140 - ${w / 2}`, `=${y} + cos(t * ${sp * 0.8} + ${k * 2}) * 90 - ${h / 2}`, w, h, "=alpha(mixc('#000000', '#f0ebe0', dark), 0.10)", { blur: 60, op: '=0.9 - state.focus * 0.4' });
const scene = {
  name: 'Smoke and hairlines',
  states: { focus: { when: 'focus > 0.5', ease: 2.5 } },
  layers: [
    full('token:bg'),
    smoke(0, 250, 200, 620, 360, 0.07), smoke(1, 760, 160, 560, 320, 0.05), smoke(2, 500, 480, 760, 300, 0.06), smoke(3, 880, 480, 500, 280, 0.08),
    { t: 'particles', x: 0, y: 0, w: '=W', h: '=H', n: 34, size: [0.6, 1.5], speed: [2, 6], dir: 'up', twinkle: true, colors: ['#dcc79d', '#f0e3c3'], op: '=0.5 * (0.4 + dark * 0.6)', seed: 2 },
    rect(22, 22, '=W - 44', '=H - 44', 'none', { stroke: 'token:accent', sw: 1, op: 0.55 }),
    rect(30, 30, '=W - 60', '=H - 60', 'none', { stroke: 'token:accent', sw: 0.6, op: 0.25 }),
    { t: 'noise', x: 0, y: 0, w: '=W', h: '=H', op: 0.06, freq: 0.9, blend: 'overlay' },
    full('#000000', { op: '=state.focus * 0.25' }),
  ],
};
const tick = (i) => ({ t: 'group', x: 0, y: 0, rot: i * 30, children: [{ t: 'line', x1: 0, y1: -126, x2: 0, y2: i % 3 === 0 ? -108 : -116, stroke: 'token:accent', sw: i % 3 === 0 ? 3 : 1.5 }] });
const dial = customWidget({ name: 'Chronograph', size: [300, 300], root: [
  { t: 'ring', x: 150, y: 150, r: 140, sw: 1.5, val: 1, fill: 'token:accent', track: 'rgba(0,0,0,0)', op: 0.7 },
  { t: 'ring', x: 150, y: 150, r: 132, sw: 0.8, val: 1, fill: 'token:accent', track: 'rgba(0,0,0,0)', op: 0.4 },
  group([...Array(12).keys()].map(tick), { x: 150, y: 150 }),
  group([{ t: 'ring', x: 0, y: 0, r: 26, sw: 1, val: 1, fill: 'token:border-strong', track: 'rgba(0,0,0,0)' }, { t: 'ring', x: 0, y: 0, r: 26, sw: 3, val: '=goal', fill: 'token:accent', track: 'rgba(0,0,0,0)', cap: 'butt' }, text(0, 5, 14, '{fmt(goal * 100, 0)}', { align: 'middle', fill: 'token:text', font: 'display' })], { x: 150, y: 212 }),
  text(150, 100, 12, 'EYETIME', { align: 'middle', ls: 7, fill: 'token:accent-text', weight: 500 }),
  group([{ t: 'line', x1: 0, y1: 8, x2: 0, y2: -70, stroke: 'token:text', sw: 5 }], { x: 150, y: 150, rot: '=(mod(hour, 12) + minute / 60) * 30' }),
  group([{ t: 'line', x1: 0, y1: 10, x2: 0, y2: -104, stroke: 'token:text', sw: 3 }], { x: 150, y: 150, rot: '=(minute + second / 60) * 6' }),
  group([{ t: 'line', x1: 0, y1: 22, x2: 0, y2: -112, stroke: 'token:accent', sw: 1.2 }, { t: 'ellipse', x: -4, y: -4, w: 8, h: 8, fill: 'token:accent' }], { x: 150, y: 150, rot: '=second * 6' }),
] });
const num = (i) => `item.i == ${i}`;
const roman = '{item.i == 0 ? "I" : item.i == 1 ? "II" : item.i == 2 ? "III" : item.i == 3 ? "IV" : "V"}';
const page = customWidget({ name: 'Roman list', size: [380, 320], root: [
  text(0, 34, 30, 'Today', { font: 'display', fill: 'token:text', weight: 400 }),
  text(380, 34, 13, '{tasksOpen} REMAIN', { align: 'end', ls: 5, fill: 'token:accent-text' }),
  { t: 'line', x1: 0, y1: 50, x2: 380, y2: 50, stroke: 'token:accent', sw: 1 },
  { t: 'list', x: 0, y: 56, w: 380, of: 'tasks', max: 5, rowh: 50, on: { click: { do: 'task.toggle' } }, item: group([
    text(0, 34, 18, roman, { font: 'display', italic: true, fill: 'token:accent-text' }),
    text(54, 33, 21, '{item.text}', { fill: 'token:text', font: 'display' }),
    { t: 'line', x1: 0, y1: 46, x2: 380, y2: 46, stroke: 'token:border', sw: 1 },
  ]) },
] });
void num;
const stats = customWidget({ name: 'Hairline stats', size: [440, 150], root: [
  ...[['{fmt(focusToday / 60, 1)}', 'HOURS'], ['{sessionsToday}', 'SESSIONS'], ['{streak}', 'DAYS']].map(([v, l], i) => group([
    text(0, 60, 62, v, { font: 'display', fill: 'token:text', weight: 400 }), text(0, 90, 11, l, { ls: 6, fill: 'token:accent-text' }), { t: 'line', x1: 0, y1: 106, x2: 120, y2: 106, stroke: 'token:accent', sw: 1, op: 0.7 }], { x: i * 160, y: 10 })),
] });

export default {
  id: 'ink', appearance: { look: 'ink', mode: 'dark', accent: 'look' },
  home: {
    background: 'scene', scene, clockStyle: 'serif', layout: 'center', greeting: true, dna: { s: 'bare' },
    modules: { focus: false, today: false, tasks: false, habits: false, notes: false, links: false },
    type: { clock: { font: 'playfair', weight: 400, tracking: -0.02 }, text: {} },
    widgets: [dial, page, stats],
    canvas: { on: true, items: { clock: { x: 30, y: 28, s: 1.2 }, greeting: { x: 30, y: 44, s: 1 }, [dial.id]: { x: 76, y: 36, w: 280 }, [page.id]: { x: 30, y: 74, w: 340 }, [stats.id]: { x: 74, y: 80, w: 400 } } },
  },
};
