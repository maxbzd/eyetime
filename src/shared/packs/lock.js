// Lock — themes that borrow the calm of a phone lock screen: a photograph, a big clock of frosted glass between the photo and its foreground, and three round "complications"
// under it (the day's goal, tasks, and a Focus ring you tap to start or stop). The page's own buttons hide until the mouse moves.
// Everything is data (see packs/kit.js); the photos are listed in shared/frames.js.

import { text, ellipse, group, path, customWidget } from './kit.js';

const OFF = { focus: false, today: false, tasks: false, habits: false, notes: false, links: false };
const LEFT = '(paused ? focusLeft : max(0, focusEnd - nowS))';

/** One round complication: a glass disc, a ring and a value; `tap` makes it a button. */
const disc = (INK, cx, val, mid, cap, tap) => group([
  ellipse(-38, -38, 76, 76, `=alpha('${INK}', 0.12)`, { stroke: `=alpha('${INK}', 0.32)`, sw: 1.2 }),
  { t: 'ring', x: 0, y: 0, r: 30, sw: 4.5, val, fill: INK, track: `=alpha('${INK}', 0.24)`, cap: 'round' },
  mid,
  text(0, 66, 12, cap, { align: 'middle', font: 'body', weight: 700, ls: 3, fill: INK, op: 0.9 }),
  ...(tap ? [ellipse(-38, -38, 76, 76, 'rgba(0,0,0,0)', { on: { click: { do: 'focus.toggle' } } })] : []),
], { x: cx, y: 0 });

const complications = (INK) => customWidget({ name: 'Complications', size: [330, 124], root: [
  group([
    disc(INK, 0, '=goal', text(0, 7, 20, '{fmt(goal * 100, 0)}', { align: 'middle', font: 'body', weight: 650, fill: INK }), 'GOAL'),
    disc(INK, 110, '=tasksDone / max(1, tasksDone + tasksOpen)', text(0, 7, 20, '{tasksOpen}', { align: 'middle', font: 'body', weight: 650, fill: INK }), 'TASKS'),
    disc(INK, 220, '=focusFrac', group([
      text(0, 7, 18, '{focus ? pad(floor(' + LEFT + ' / 60), 2) : ""}', { align: 'middle', font: 'body', weight: 650, fill: INK, show: '=focus' }),
      path('M-7 -9 L-7 9 L10 0 Z', { fill: INK, show: '=!focus', x: 2 }),
    ]), 'FOCUS', true),
  ], { x: 55, y: 46 }),
] });

function lock(id, frame, o = {}) {
  const c = complications(o.ink || '#ffffff');
  return {
    id, appearance: {},
    home: {
      background: 'photo', frame, photoText: 'auto', clockStyle: 'thin', layout: 'center', greeting: false, clock24: true, quiet: true, dna: { s: 'bare' }, modules: { ...OFF },
      depth: { on: true, parallax: true, strength: 55 },
      type: { clock: { font: 'inter', weight: o.weight ?? 650, tracking: -0.035, fill: 'glass', ...(o.tint ? { color: o.tint } : {}), glow: 0, shadow: 0, opacity: 1 }, text: { font: 'inter', weight: 600, tracking: 0.01, upper: false } },
      widgets: [c],
      canvas: { on: true, items: { clock: o.clock || { x: 50, y: 40, s: 4.6, sx: 3.5 }, greeting: o.date || { x: 50, y: 12, s: 1.25 }, [c.id]: o.c || { x: 50, y: 85, w: 460 } } },
    },
  };
}

export const LOCK_PACKS = [
  lock('lock-peak', 'peak', { clock: { x: 50, y: 39, s: 4.6, sx: 3.5 } }),
  lock('lock-alpen', 'alpen', { tint: '#0c1226', clock: { x: 50, y: 39, s: 4.6, sx: 3.5 } }),
  lock('lock-solo', 'solo', { tint: '#101010', ink: '#141414', clock: { x: 50, y: 38, s: 4.6, sx: 3.5 }, c: { x: 78, y: 84, w: 460 } }),
  lock('lock-pines', 'pines', { clock: { x: 50, y: 42, s: 4.4, sx: 3.3 }, date: { x: 50, y: 20, s: 1.25 }, c: { x: 50, y: 88, w: 460 } }),
  lock('lock-mirror', 'mirror', { clock: { x: 50, y: 45, s: 4.0, sx: 3.1 }, date: { x: 50, y: 22, s: 1.25 }, c: { x: 50, y: 88, w: 460 } }),
  lock('lock-shore', 'shore', { tint: '#0c0c0c', clock: { x: 36, y: 30, s: 4.0, sx: 3.0 }, date: { x: 36, y: 10, s: 1.25 }, c: { x: 68, y: 82, w: 460 } }),
  lock('lock-haze', 'haze', { tint: '#101010', ink: '#161616', clock: { x: 50, y: 30, s: 3.8, sx: 2.9 }, c: { x: 50, y: 70, w: 460 } }),
];
