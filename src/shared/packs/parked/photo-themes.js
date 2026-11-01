// Two families of themes on the bundled photographs (shared/frames.js):
//   Glass     — a big, slightly stretched clock of frosted glass, a row of glass cards under it (goal ring, streak, a Focus pill).
//   Editorial — a tall hairline clock with the small typography of a poster: today's tasks as numbered lines, a handwritten word, a mark and a Focus countdown.
// Everything is data; the cards are the theme's own card style (liquid glass / bare).

import { text, rect, group, customWidget } from '../kit.js';

const OFF = { focus: false, today: false, tasks: false, habits: false, notes: false, links: false };
const TIME_LEFT = '(paused ? focusLeft : max(0, focusEnd - nowS))';
const COUNT = '{focus ? pad(floor(' + TIME_LEFT + ' / 60), 2) + ":" + pad(mod(' + TIME_LEFT + ', 60), 2) : "%LABEL%"}';
const toggle = { on: { click: { do: 'focus.toggle' } } };

/* ---------- Glass ---------- */

/** A Focus pill: the card around it is the theme's glass; the word becomes the time left while a session runs. */
const pill = () => customWidget({ name: 'Focus', size: [200, 44], root: [
  text(100, 31, 22, COUNT.replace('%LABEL%', 'Focus'), { align: 'middle', font: 'body', weight: 650, ls: 1, fill: 'token:hero-fg', ...toggle }),
] });

const W = (id, kind, cfg = {}) => ({ id, kind, cfg });

function glass(id, frame, o) {
  const p = pill(), cx = o.cx ?? 50, ry = o.ry ?? 82; // cx: where the middle of the row of cards sits (% of the width)
  return {
    id, appearance: {},
    home: {
      background: 'photo', frame, photoText: 'auto', clockStyle: 'thin', layout: 'center', greeting: false, clock24: true, dna: { s: 'liquid' }, modules: { ...OFF },
      depth: { on: true, parallax: true, strength: 55 },
      type: { clock: { font: 'inter', weight: o.weight ?? 600, tracking: -0.03, fill: 'glass', ...(o.tint ? { color: o.tint } : {}), glow: 0, shadow: 0, opacity: 1 }, text: { font: 'inter', weight: 600, tracking: 0.02, upper: false } },
      widgets: [W('wgl' + id.slice(0, 3) + 'a', 'goal'), W('wgl' + id.slice(0, 3) + 'b', 'streak'), p],
      canvas: { on: true, items: { clock: o.clock || { x: 50, y: 38, s: 3.6, sx: 2.7 }, greeting: o.date || { x: 50, y: 15, s: 1 }, ['wgl' + id.slice(0, 3) + 'a']: { x: cx - 15, y: ry, w: 150 }, ['wgl' + id.slice(0, 3) + 'b']: { x: cx - 1, y: ry, w: 150 }, [p.id]: { x: cx + 12.5, y: ry + 2, w: 190 } } },
    },
  };
}

/* ---------- Editorial ---------- */

const agenda = (ink) => customWidget({ name: 'Agenda', size: [340, 150], root: [
  rect(0, 8, 24, 2, ink, { op: 0.9 }),
  text(40, 14, 11, 'TODAY  ·  {tasksOpen} OPEN', { font: 'body', weight: 600, ls: 3, fill: ink, op: 0.85 }),
  { t: 'list', x: 0, y: 34, w: 340, of: 'tasks', max: 3, rowh: 32, on: { click: { do: 'task.toggle' } }, item: group([
    text(0, 21, 15, '{pad(item.i + 1, 2)}', { font: 'condensed', weight: 500, ls: 2, fill: ink, op: 0.6 }),
    text(34, 21, 16, '{item.text}', { font: 'body', weight: 600, fill: ink }),
  ]) },
] });
const sign = (w, ink, size = 78) => customWidget({ name: 'Signature', size: [320, 100], root: [text(0, 70, size, w, { font: 'script', fill: ink })] });
const mark = (ink) => customWidget({ name: 'Mark', size: [300, 46], root: [
  text(0, 14, 11, '+ HELLO, FOCUS', { font: 'body', weight: 600, ls: 3, fill: ink, op: 0.8 }),
  text(0, 40, 22, 'EYETIME', { font: 'condensed', weight: 700, ls: 6, fill: ink }),
] });
const countdown = (ink) => customWidget({ name: 'Focus', size: [280, 70], root: [
  text(140, 34, 26, COUNT.replace('%LABEL%', 'FOCUS'), { align: 'middle', font: 'condensed', weight: 500, ls: 10, fill: ink, ...toggle }),
  rect(70, 54, 140, 2, ink, { op: 0.25 }), rect(70, 54, '=140 * goal', 2, ink),
] });

function editorial(id, frame, o) {
  const ink = o.ink || 'token:hero-fg', ag = agenda(ink), sg = sign(o.word, ink, o.wordSize), mk = mark(o.mkInk || ink), cd = countdown(ink);
  return {
    id, appearance: {},
    home: {
      background: 'photo', frame, photoText: 'auto', clockStyle: 'thin', layout: 'center', greeting: false, clock24: true, dna: { s: 'bare' }, modules: { ...OFF },
      depth: { on: true, parallax: true, strength: 55 },
      type: { clock: { font: 'antonio', weight: o.weight ?? 200, tracking: 0.02, fill: 'solid', color: o.color || '#ffffff', glow: 0, shadow: 0, opacity: o.opacity ?? 0.92 }, text: { font: 'inter', weight: 600, tracking: 0.14, upper: true } },
      widgets: [ag, sg, mk, cd],
      canvas: { on: true, items: { clock: o.clock, greeting: o.date, [ag.id]: o.ag || { x: 15, y: 81, w: 320 }, [sg.id]: o.sg || { x: 89, y: 60, w: 220 }, [mk.id]: o.mk || { x: 15, y: 10.5, w: 260 }, [cd.id]: o.cd || { x: 86, y: 91, w: 240 } } },
    },
  };
}

export const PHOTO_PACKS = [
  glass('glass-peak', 'peak', {}),
  glass('glass-alpen', 'alpen', { tint: '#0c1226' }),
  glass('glass-solo', 'solo', { tint: '#101010', cx: 72, clock: { x: 38, y: 38, s: 3.6, sx: 2.7 }, date: { x: 38, y: 15, s: 1 } }),
  glass('glass-pines', 'pines', { clock: { x: 50, y: 46, s: 3.4, sx: 2.6 }, date: { x: 50, y: 23, s: 1 } }),
  glass('glass-haze', 'haze', { tint: '#101010', ry: 70, clock: { x: 50, y: 30, s: 3.4, sx: 2.6 }, date: { x: 50, y: 10, s: 1 } }),
  editorial('ed-peak', 'peak', { word: 'stillness', clock: { x: 50, y: 38, s: 4.4, sx: 3.0 }, date: { x: 50, y: 14, s: 1 } }),
  editorial('ed-solo', 'solo', { word: 'alone', color: '#141414', ink: '#161616', clock: { x: 50, y: 40, s: 4.6, sx: 3.0 }, date: { x: 50, y: 12, s: 1 }, ag: { x: 85, y: 81, w: 320 }, mk: { x: 85, y: 10.5, w: 260 }, cd: { x: 14, y: 91, w: 240 }, sg: { x: 11, y: 66, w: 220 } }),
  editorial('ed-mirror', 'mirror', { word: 'be still', clock: { x: 50, y: 60, s: 3.8, sx: 2.7 }, date: { x: 50, y: 39, s: 1 } }),
  editorial('ed-shore', 'shore', { mkInk: '#111111', word: 'tide', color: '#0c0c0c', ink: '#f2f2f2', opacity: 0.96, weight: 260, clock: { x: 37, y: 30, s: 3.6, sx: 2.5 }, date: { x: 37, y: 9, s: 1 }, sg: { x: 88, y: 74, w: 220 }, ag: { x: 15, y: 81, w: 320 }, mk: { x: 85, y: 10.5, w: 260 } }),
  editorial('ed-road', 'road', { word: 'onward', clock: { x: 50, y: 38, s: 4.4, sx: 2.9 }, date: { x: 50, y: 11, s: 1 } }),
  editorial('ed-haze', 'haze', { mkInk: '#111111', word: 'quiet', color: '#101010', ink: '#e9e9e9', clock: { x: 50, y: 40, s: 4.8, sx: 3.0 }, date: { x: 50, y: 11, s: 1 }, ag: { x: 15, y: 83, w: 320 } }),
];
