// Liquid — colour that drifts, glass that bends it. Orbs that gather when you focus; a pebble that fills as the day's goal does.

import { text, rect, group, full, grad, radial, customWidget } from '../kit.js';

const orb = (k, cx, cy, size, col, phase) => ({ t: 'ellipse', x: `=mix(${cx}, W / 2, state.focus * 0.55) + sin(t * 0.11 * p.speed + ${phase}) * 190 + (mouseX - 0.5) * ${20 + k * 12} - ${size / 2}`, y: `=mix(${cy}, H / 2, state.focus * 0.55) + cos(t * 0.09 * p.speed + ${phase * 1.7}) * 130 + (mouseY - 0.5) * ${14 + k * 8} - ${size / 2}`, w: size, h: size, fill: radial(0.5, 0.5, 0.5, [0, col], [1, 'rgba(255,255,255,0)']), op: '=0.92 - state.focus * 0.25', blur: 34, blend: 'normal' });

const scene = {
  name: 'Orbit',
  params: { speed: { type: 'number', min: 0, max: 3, def: 1, label: 'Drift speed' } },
  states: { focus: { when: 'focus > 0.5', ease: 2.2 } },
  layers: [
    full(grad(160, [0, "=mixc('#eef2ff', '#0a0d24', dark)"], [1, "=mixc('#f9eefa', '#160c2e', dark)"])),
    orb(0, 220, 170, 560, "=mixc('rgba(255,150,180,0.8)', 'rgba(255,70,140,0.55)', dark)", 0),
    orb(1, 780, 140, 520, "=mixc('rgba(130,170,255,0.85)', 'rgba(70,110,255,0.6)', dark)", 2.1),
    orb(2, 700, 520, 600, "=mixc('rgba(150,235,210,0.8)', 'rgba(30,210,180,0.42)', dark)", 4.2),
    orb(3, 180, 540, 480, "=mixc('rgba(255,210,140,0.75)', 'rgba(170,90,255,0.46)', dark)", 5.9),
    { t: 'noise', x: 0, y: 0, w: '=W', h: '=H', op: 0.05, freq: 0.9, blend: 'overlay' },
    full('#000000', { op: '=state.focus * 0.16' }),
  ],
};

// A pebble of liquid: the level is the day's goal; a wave rolls along its surface.
const wavePath = 'M0 20 C 60 0 120 40 180 20 C 240 0 300 40 360 20 C 420 0 480 40 540 20 C 600 0 660 40 720 20 L720 400 L0 400 Z';
const pebble = customWidget({ name: 'Goal pebble', size: [300, 300], root: [
  group([
    { t: 'rect', x: 0, y: 0, w: 300, h: 300, fill: 'rgba(255,255,255,0.10)' },
    group([{ t: 'path', d: wavePath, fill: grad(180, [0, 'rgba(255,255,255,0.9)'], [0.18, "=alpha('#7c9bff', 0.85)"], [1, "=alpha('#3b63f5', 0.95)"]) }], { x: '=-mod(t * 34, 180) - 10', y: '=300 - goal * 270 - 14' }),
    group([{ t: 'path', d: wavePath, fill: "=alpha('#ffffff', 0.35)" }], { x: '=-180 + mod(t * 22, 180) - 40', y: '=300 - goal * 270 - 6' }),
  ], { x: 0, y: 0, w: 300, h: 300, clip: 'ellipse' }),
  { t: 'ellipse', x: 2, y: 2, w: 296, h: 296, stroke: 'rgba(255,255,255,0.75)', sw: 3 },
  text(150, 160, 64, '{fmt(goal * 100, 0)}', { align: 'middle', weight: 600, fill: "=mixc('#121530', '#ffffff', dark)", shadow: { x: 0, y: 4, blur: 14, color: 'rgba(20,30,100,0.25)' } }),
  text(150, 194, 18, 'of today\'s goal', { align: 'middle', fill: "=mixc('#2a2f5a', '#ffffff', dark)", weight: 500 }),
] });

// Three capsules: focus, tasks, streak.
const cap = (x, label, value, unit) => group([
  rect(0, 0, 150, 120, 'rgba(255,255,255,0.14)', { r: 36, stroke: 'rgba(255,255,255,0.45)', sw: 1.5 }),
  text(75, 58, 46, value, { align: 'middle', weight: 600, fill: 'token:text' }),
  text(75, 84, 15, unit, { align: 'middle', fill: 'token:text-2' }),
  text(75, 106, 13, label, { align: 'middle', fill: 'token:text-3', ls: 2, upper: true }),
], { x, y: 0 });
const capsules = customWidget({ name: 'Capsules', size: [480, 120], root: [
  cap(0, 'focus', '{fmt(focusToday / 60, 1)}', 'hours'), cap(165, 'tasks', '{tasksOpen}', 'open'), cap(330, 'streak', '{streak}', 'days'),
] });

export default {
  id: 'liquid', appearance: { look: 'liquid', mode: 'dark', accent: 'look' },
  home: {
    background: 'scene', scene, clockStyle: 'thin', layout: 'center', greeting: true, dna: { s: 'liquid' },
    modules: { focus: false, today: false, tasks: false, habits: false, notes: false, links: false },
    type: { clock: { font: 'onest', weight: 250, tracking: -0.055 }, text: {} },
    widgets: [pebble, capsules],
    canvas: { on: true, items: { clock: { x: 50, y: 34, s: 1.2 }, greeting: { x: 50, y: 50, s: 1 }, [pebble.id]: { x: 28, y: 76, w: 250 }, [capsules.id]: { x: 66, y: 77, w: 480 } } },
  },
};
