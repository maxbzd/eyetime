// Swiss — a strict grid. Huge numerals, a red sun that crosses the page, the day as a bar along the bottom edge.

import { text, rect, ellipse, group, full, customWidget } from './kit.js';

const scene = {
  name: 'The grid',
  states: { focus: { when: 'focus > 0.5', ease: 1.2 } },
  layers: [
    full('token:bg'),
    text(-30, '=H - 20', 560, '{pad(hour, 2)}', { weight: 800, ls: -30, fill: 'token:text', op: '=0.05 + dark * 0.03' }),
    { t: 'lines', x: 0, y: 0, w: '=W', h: '=H', gap: 125, sw: 1.5, dir: 'v', stroke: "=alpha(mixc('#0a0a0a', '#f3f3f0', dark), 0.16)" },
    { t: 'lines', x: 0, y: 0, w: '=W', h: '=H', gap: 125, sw: 1.5, dir: 'h', stroke: "=alpha(mixc('#0a0a0a', '#f3f3f0', dark), 0.16)" },
    ellipse('=120 + dayFrac * 760 - 80', -50, 160, 160, 'token:accent', { op: '=1 - state.focus * 0.4' }),
    rect(0, '=H - 14', '=W * dayFrac', 14, 'token:text'),
    { t: 'lines', x: 0, y: '=H - 14', w: '=W', h: 14, gap: 41.66, sw: 2, dir: 'v', stroke: 'token:bg', op: 0.9 },
    rect(0, '=H - 14', '=W', 2, 'token:text'),
    full('#000000', { op: '=state.focus * 0.2' }),
  ],
};
const col = (x, big, label, sub) => group([
  { t: 'line', x1: 0, y1: 0, x2: 130, y2: 0, stroke: 'token:text', sw: 6 },
  text(0, 104, 100, big, { weight: 800, ls: -6, fill: 'token:text' }),
  text(0, 148, 16, label, { weight: 800, upper: true, ls: 1, fill: 'token:text' }),
  text(0, 170, 14, sub, { fill: 'token:text-3' }),
], { x, y: 10 });
const index = customWidget({ name: 'Index', size: [460, 190], root: [
  col(0, '{fmt(goal * 100, 0)}', 'Goal %', '{focusToday} min today'), col(190, '{tasksOpen}', 'Open', '{tasksDone} done'), col(340, '{streak}', 'Days', 'in a row'),
] });
const timetable = customWidget({ name: 'Timetable', size: [400, 330], root: [
  text(0, 30, 28, 'Today', { weight: 800, ls: -1, fill: 'token:text' }),
  text(400, 30, 14, '{pad(tasksOpen, 2)} OPEN', { align: 'end', weight: 800, fill: 'token:accent-text', ls: 1 }),
  { t: 'line', x1: 0, y1: 46, x2: 400, y2: 46, stroke: 'token:text', sw: 4 },
  { t: 'list', x: 0, y: 52, w: 400, of: 'tasks', max: 5, rowh: 52, on: { click: { do: 'task.toggle' } }, item: group([
    text(0, 34, 26, '{pad(item.i + 1, 2)}', { weight: 800, fill: 'token:accent-text' }),
    text(60, 33, 21, '{item.text}', { weight: 600, fill: 'token:text', font: 'body' }),
    { t: 'line', x1: 0, y1: 48, x2: 400, y2: 48, stroke: 'token:border', sw: 1.5 },
  ]) },
] });
const week = customWidget({ name: 'Week', size: [460, 190], root: [
  text(0, 26, 14, 'WEEK', { weight: 800, ls: 2, fill: 'token:text' }), text(460, 26, 14, '{sum(week)} MIN', { align: 'end', weight: 800, ls: 2, fill: 'token:accent-text' }),
  { t: 'line', x1: 0, y1: 38, x2: 460, y2: 38, stroke: 'token:text', sw: 4 },
  { t: 'spark', x: 0, y: 52, w: 460, h: 100, of: 'week', kind: 'bars', gap: 10, fill: 'token:text' },
  ...['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => text(33 + i * 65.7, 176, 14, d, { align: 'middle', weight: 800, fill: 'token:text' })),
] });

export default {
  id: 'swiss', appearance: { look: 'swiss', mode: 'light', accent: 'look' },
  home: {
    background: 'scene', scene, clockStyle: 'bold', layout: 'center', greeting: true, dna: { s: 'bare' },
    modules: { focus: false, today: false, tasks: false, habits: false, notes: false, links: false },
    type: { clock: { font: 'inter', weight: 800, tracking: -0.07 }, text: { font: 'inter', weight: 800 } },
    widgets: [index, timetable, week],
    canvas: { on: true, items: { clock: { x: 30, y: 38, s: 1.5 }, greeting: { x: 22, y: 56, s: 0.9 }, [index.id]: { x: 24, y: 76, w: 440 }, [week.id]: { x: 62, y: 80, w: 420 }, [timetable.id]: { x: 80, y: 40, w: 380 } } },
  },
};
