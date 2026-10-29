// Phosphor — a mainframe terminal that never sleeps. Scan lines, a slow beam, a little digital rain; a log that talks about your day.

import { text, rect, group, full, grad, radial, customWidget } from './kit.js';

const scene = {
  name: 'Mainframe',
  params: { rain: { type: 'number', min: 0, max: 1, def: 0.5, label: 'Digital rain' }, beam: { type: 'toggle', def: 1, label: 'Scan beam' } },
  states: { focus: { when: 'focus > 0.5', ease: 1.4 } },
  layers: [
    full('token:bg'),
    full(radial(0.5, 0.42, 0.75, [0, "=alpha('#3dff86', 0.10)"], [1, 'rgba(0,0,0,0)']), { blend: 'screen', op: '=dark * 1' }),
    { t: 'particles', x: 0, y: 0, w: '=W', h: '=H', n: 70, size: [0.9, 1.7], speed: [26, 90], dir: 'down', colors: ['#3dff86', '#9bffbd', '#1fb85a'], op: '=p.rain * 0.4 * dark', seed: 9, twinkle: true, blend: 'screen' },
    { t: 'lines', x: 0, y: 0, w: '=W', h: '=H', gap: 4, sw: 1.2, dir: 'h', stroke: 'rgba(0,0,0,0.30)', op: '=dark' },
    rect(0, '=mod(t * 70, H + 240) - 120', '=W', 120, grad(180, [0, 'rgba(61,255,134,0)'], [0.5, 'rgba(61,255,134,0.11)'], [1, 'rgba(61,255,134,0)']), { op: '=p.beam * dark', blend: 'screen' }),
    full('token:accent', { op: '=0.01 + 0.018 * noise(t * 14, 3) * dark' }),
    { t: 'lines', x: 0, y: 0, w: 38, h: '=H', gap: 30, sw: 0, dir: 'h', stroke: 'rgba(0,0,0,0)' },
    full(radial(0.5, 0.5, 0.78, [0.6, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.55)']), { op: '=dark' }),
    full('#000000', { op: '=state.focus * 0.3' }),
  ],
};

const bar = (y, label, val, valText) => group([
  text(0, 0, 17, label, { font: 'mono', fill: 'token:text-3' }),
  { t: 'bar', x: 120, y: -14, w: 190, h: 14, r: 0, val, fill: 'token:accent', track: "=alpha('#3dff86', 0.14)" },
  text(330, 0, 17, valText, { font: 'mono', fill: 'token:text', align: 'start' }),
], { x: 0, y });

// The log: what the machine says about today.
const log = customWidget({ name: 'Terminal log', size: [460, 330], root: [
  text(0, 24, 18, '$ eyetime --status', { font: 'mono', fill: 'token:accent-text', weight: 700 }),
  bar(62, 'focus', '=goal', '{fmt(goal * 100, 0)}%  {focusToday}m'),
  bar(92, 'streak', '=min(1, streak / 14)', '{streak} d'),
  bar(122, 'tasks', '=tasksDone / max(1, tasksDone + tasksOpen)', '{tasksDone}/{tasksDone + tasksOpen}'),
  text(0, 166, 17, '$ ls tasks/', { font: 'mono', fill: 'token:accent-text', weight: 700 }),
  { t: 'list', x: 0, y: 176, w: 460, of: 'tasks', max: 4, rowh: 30, on: { click: { do: 'task.toggle' } }, item: text(0, 20, 17, '[ ] {item.text}', { font: 'mono', fill: 'token:text' }) },
  text(0, 322, 18, '$', { font: 'mono', fill: 'token:accent-text', weight: 700 }),
  rect(16, 308, 11, 16, 'token:accent', { show: '=mod(floor(t * 1.8), 2) < 1' }),
] });

// The process monitor: seven days as a bar chart with a header, like top.
const monitor = customWidget({ name: 'Process monitor', size: [460, 190], root: [
  text(0, 22, 16, 'PID  WEEK     MIN', { font: 'mono', fill: 'token:text-3', weight: 700 }),
  { t: 'line', x1: 0, y1: 34, x2: 460, y2: 34, stroke: 'token:border-strong', sw: 1 },
  { t: 'spark', x: 0, y: 50, w: 460, h: 90, of: 'week', kind: 'bars', gap: 14, fill: 'token:accent' },
  ...['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d, i) => text(32.8 + i * 65.7, 164, 14, d, { font: 'mono', align: 'middle', fill: 'token:text-3' })),
  text(460, 22, 16, 'Σ {sum(week)}', { font: 'mono', align: 'end', fill: 'token:accent-text', weight: 700 }),
] });

export default {
  id: 'phosphor', appearance: { look: 'phosphor', mode: 'dark', accent: 'look' },
  home: {
    background: 'scene', scene, clockStyle: 'mono', layout: 'center', greeting: true, dna: { s: 'outline' },
    modules: { focus: false, today: false, tasks: false, habits: false, notes: false, links: false },
    type: { clock: { font: 'mono', weight: 400, glow: 0.35, tracking: -0.04 }, text: {} },
    widgets: [log, monitor],
    canvas: { on: true, items: { clock: { x: 30, y: 38, s: 1.1 }, greeting: { x: 30, y: 56, s: 0.95 }, [log.id]: { x: 76, y: 44, w: 470 }, [monitor.id]: { x: 30, y: 80, w: 470 } } },
  },
};
