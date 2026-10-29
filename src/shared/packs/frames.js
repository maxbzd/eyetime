// Frames — minimal themes built on real photographs: a huge narrow clock that sits between the photo and its foreground, the date, a signature and one quiet focus control.
// Each pack is data (see packs/kit.js); the photos are in src/newtab/frames and listed in shared/frames.js.

import { text, rect, customWidget } from './kit.js';

const MODULES_OFF = { focus: false, today: false, tasks: false, habits: false, notes: false, links: false };

/** A handwritten word, small, anywhere on the photo. */
const signature = (word, size = 74, ink = 'token:hero-fg') => customWidget({ name: 'Signature', size: [300, 96], root: [text(0, 66, size, word, { font: 'script', fill: ink, weight: 400, op: 0.92 })] });

/** The focus control: one word that starts a session and becomes the time left while it runs; a thin line under it is the goal of the day. */
const focusWord = (ink = 'token:hero-fg') => customWidget({ name: 'Focus', size: [280, 70], root: [
  text(140, 34, 26, '{focus ? pad(floor((paused ? focusLeft : max(0, focusEnd - nowS)) / 60), 2) + ":" + pad(mod(paused ? focusLeft : max(0, focusEnd - nowS), 60), 2) : "FOCUS"}', { align: 'middle', font: 'condensed', weight: 500, ls: 10, fill: ink, on: { click: { do: 'focus.toggle' } } }),
  rect(70, 54, 140, 2, ink, { op: 0.25 }),
  rect(70, 54, '=140 * goal', 2, ink),
] });

/** The pieces every frame theme shares; `o` says how this one differs. */
function frame(id, frameId, o) {
  const sig = signature(o.word, o.wordSize, o.ink), foc = focusWord(o.ink);
  return {
    id,
    appearance: {}, // the app's own look and scheme stay as the person chose them
    home: {
      background: 'photo', frame: frameId, clock24: true, photoText: 'auto', clockStyle: 'thin', layout: 'center', greeting: false, dna: { s: 'bare' }, modules: { ...MODULES_OFF },
      depth: { on: true, parallax: true, strength: 55 },
      type: { clock: { font: o.font || 'inter', weight: o.weight ?? 700, tracking: o.tracking ?? 0.02, fill: o.fill || 'glass', ...(o.color ? { color: o.color } : {}), glow: 0, shadow: o.shadow ?? 0, opacity: o.opacity ?? 1 }, text: { font: 'inter', weight: 500, tracking: 0.12, upper: true } },
      widgets: [sig, foc],
      canvas: { on: true, items: { clock: o.clock, greeting: o.date, [sig.id]: o.sig, [foc.id]: o.foc } },
    },
  };
}


// Apple-like: big, slightly stretched digits of frosted glass (clear on a dark photo, smoked on a light one) between the photo and its foreground.
const BIG = { s: 4.2, sx: 3.1 };
export const FRAME_PACKS = [
  frame('summit', 'peak', { word: 'stillness', clock: { x: 50, y: 48, ...BIG }, date: { x: 50, y: 19, s: 1 }, sig: { x: 20, y: 88, w: 300 }, foc: { x: 80, y: 90, w: 280 } }),
  frame('pinefog', 'pines', { word: 'breathe', ink: '#f0f0f0', clock: { x: 50, y: 57, s: 3.6, sx: 2.7 }, date: { x: 50, y: 34, s: 1 }, sig: { x: 18, y: 92, w: 300 }, foc: { x: 80, y: 90, w: 280 } }),
  frame('mirror', 'mirror', { word: 'be still', clock: { x: 50, y: 60, s: 3.4, sx: 2.6 }, date: { x: 50, y: 37, s: 1 }, sig: { x: 18, y: 91, w: 300 }, foc: { x: 82, y: 92, w: 280 } }),
  frame('longroad', 'road', { word: 'onward', clock: { x: 50, y: 38, ...BIG }, date: { x: 50, y: 12, s: 1 }, sig: { x: 20, y: 88, w: 300 }, foc: { x: 80, y: 90, w: 280 } }),
  frame('lonetree', 'solo', { color: '#0e0e0e', word: 'alone, not lonely', wordSize: 60, clock: { x: 50, y: 42, s: 4.4, sx: 3.2 }, date: { x: 50, y: 11, s: 1 }, sig: { x: 18, y: 89, w: 320 }, foc: { x: 82, y: 91, w: 280 } }),
  frame('blackshore', 'shore', { ink: '#f2f2f2', word: 'tide', clock: { x: 37, y: 26, s: 3.4, sx: 2.6 }, date: { x: 37, y: 8, s: 1 }, sig: { x: 16, y: 88, w: 300 }, foc: { x: 82, y: 91, w: 280 } }),
  frame('alpenglow', 'alpen', { color: '#0c1226', word: 'alpenglow', clock: { x: 50, y: 46, ...BIG }, date: { x: 50, y: 17, s: 1 }, sig: { x: 20, y: 88, w: 300 }, foc: { x: 80, y: 90, w: 280 } }),
  frame('haze', 'haze', { ink: '#e9e9e9', word: 'quiet', clock: { x: 50, y: 44, ...BIG }, date: { x: 50, y: 12, s: 1 }, sig: { x: 20, y: 88, w: 300 }, foc: { x: 80, y: 90, w: 280 } }),
];
