// Mono — three black-and-white themes drawn with the scene language, in the spirit of the Frames: a white page with one word, a carbon surface with a thin clock, torn paper.
// They have no photo; everything is shapes, gradients and lines. The widgets are small and quiet, like the Frames'.

import { text, rect, group, full, grad, radial, customWidget } from './kit.js';

const MODULES_OFF = { focus: false, today: false, tasks: false, habits: false, notes: false, links: false };
const toggle = { on: { click: { do: 'focus.toggle' } } };
const LEFT = '{focus ? pad(floor((paused ? focusLeft : max(0, focusEnd - nowS)) / 60), 2) + ":" + pad(mod(paused ? focusLeft : max(0, focusEnd - nowS), 60), 2) : "FOCUS"}';

/** A row of thin bars that breathe, like a sound wave; they swell while a session runs. */
const wave = (n, h, w, ink, seed = 0) => customWidget({ name: 'Wave', size: [n * 10, h + 10], root: Array.from({ length: n }, (_, i) =>
  rect(i * 10, '=' + (h / 2 + 5) + ' - (' + (h * 0.14) + ' + ' + (h * 0.36) + ' * noise(' + (i * 0.55 + seed) + ' + t * ' + '(0.6 + focus * 1.6)' + ')) * (0.55 + 0.45 * noise(' + (i * 0.2) + ')) ', w, '=2 * (' + (h * 0.14) + ' + ' + (h * 0.36) + ' * noise(' + (i * 0.55 + seed) + ' + t * ' + '(0.6 + focus * 1.6)' + ')) * (0.55 + 0.45 * noise(' + (i * 0.2) + '))', ink, { r: 1, op: 0.9 })) });

/** "FOCUS" in tall letters; it becomes the time left while a session runs. Click starts or stops. */
const focusLabel = (size, ink, ls = 14) => customWidget({ name: 'Focus', size: [400, size + 30], root: [
  text(200, size + 6, size, '{' + LEFT.slice(1, -1) + '}', { align: 'middle', font: 'condensed', weight: 600, ls, fill: ink, ...toggle }),
] });

const base = (id, scene, o) => ({
  id, appearance: {}, // the app's own look and scheme stay as the person chose them
  home: {
    background: 'scene', scene, clock24: true, clockStyle: 'thin', layout: 'center', greeting: false, dna: { s: 'bare' }, modules: { ...MODULES_OFF },
    type: { clock: { font: o.font || 'antonio', weight: o.weight ?? 300, tracking: o.tracking ?? 0.02, fill: 'solid', color: o.color || null, glow: 0, shadow: o.shadow ?? 0, opacity: o.opacity ?? 1 }, text: { font: 'inter', weight: 500, tracking: 0.12, upper: true } },
    widgets: o.widgets, canvas: { on: true, items: o.items },
  },
});

/* ---------- Paper: a white page, a soft shadow shelf under a tall black clock, one word ---------- */
const paperScene = {
  name: 'White page',
  states: { focus: { when: 'focus > 0.5', ease: 1.6 } },
  layers: [
    full(grad(180, [0, "=mixc('#ffffff', '#101010', dark)"], [1, "=mixc('#ececec', '#050505', dark)"])),
    // the shelf: a dark soft wedge hanging under the clock, the way a ledge throws a shadow
    { t: 'path', x: '=W * 0.5', y: '=H * 0.5', d: 'M-290 0L290 0L420 330L-420 330Z', fill: grad(180, [0, "=alpha(mixc('#000000', '#ffffff', dark), mix(0.36, 0.14, dark))"], [1, "=alpha(mixc('#000000', '#ffffff', dark), 0)"]), blur: 6 },
    { t: 'rect', x: '=W * 0.5 - 290', y: '=H * 0.5 - 2', w: 580, h: 3, fill: "=alpha(mixc('#000000', '#ffffff', dark), 0.18)", blur: 1 },
    { t: 'noise', x: 0, y: 0, w: '=W', h: '=H', op: 0.035, freq: 1.1, blend: 'multiply' },
  ],
};
const paperWord = focusLabel(46, 'token:text', 16), paperWave = wave(9, 46, 3, 'token:text', 1);
const paper = base('paper', paperScene, {
  weight: 480, tracking: 0.0, widgets: [paperWord, paperWave],
  items: { clock: { x: 50, y: 28, s: 3.6, sx: 2.3 }, greeting: { x: 50, y: 7, s: 1 }, [paperWord.id]: { x: 50, y: 67, w: 400 }, [paperWave.id]: { x: 50, y: 89, w: 90 } },
});

/* ---------- Carbon: a woven black surface with soft light and a thin clock ---------- */
const carbonScene = {
  name: 'Carbon',
  states: { focus: { when: 'focus > 0.5', ease: 1.6 } },
  layers: [
    full(grad(180, [0, '#232325'], [1, '#0a0a0b'])),
    { t: 'lines', x: 0, y: 0, w: '=W', h: '=H', gap: 6, sw: 2, dir: 'diag', stroke: "=alpha('#ffffff', 0.07)" },
    { t: 'lines', x: 0, y: 0, w: '=W', h: '=H', gap: 6, sw: 2, dir: 'h', stroke: "=alpha('#000000', 0.22)" },
    // soft curtains of light falling from the top
    { t: 'rect', x: '=W * 0.18 + (mouseX - 0.5) * -24', y: -40, w: 160, h: '=H + 80', fill: grad(180, [0, 'rgba(255,255,255,0.16)'], [1, 'rgba(255,255,255,0)']), blur: 22, op: '=0.8 + state.focus * 0.2' },
    { t: 'rect', x: '=W * 0.55 + (mouseX - 0.5) * -34', y: -40, w: 220, h: '=H + 80', fill: grad(180, [0, 'rgba(255,255,255,0.12)'], [1, 'rgba(255,255,255,0)']), blur: 26 },
    { t: 'rect', x: '=W * 0.82 + (mouseX - 0.5) * -18', y: -40, w: 120, h: '=H + 80', fill: grad(180, [0, 'rgba(255,255,255,0.10)'], [1, 'rgba(255,255,255,0)']), blur: 20 },
    full(radial(0.5, 0.4, 0.75, [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.55)'])),
  ],
};
const carbonMark = customWidget({ name: 'Mark', size: [200, 90], root: [
  text(100, 14, 12, '+ hello, focus', { align: 'middle', font: 'body', weight: 500, ls: 1, fill: 'rgba(255,255,255,0.7)' }),
  text(100, 56, 34, 'EYETIME', { align: 'middle', font: 'condensed', weight: 700, ls: 4, fill: '#ffffff' }),
  text(100, 82, 22, 'focus', { align: 'middle', font: 'condensed', weight: 200, ls: 10, fill: 'rgba(255,255,255,0.7)', upper: true }),
] });
const carbonWave = wave(7, 40, 3, '#ffffff', 3);
const carbon = base('carbon', carbonScene, {
  font: 'inter', weight: 100, tracking: 0.0, color: '#ffffff', widgets: [carbonMark, carbonWave],
  items: { clock: { x: 50, y: 24, s: 2.8, sx: 2.3 }, greeting: { x: 50, y: 10, s: 1 }, [carbonWave.id]: { x: 50, y: 55, w: 70 }, [carbonMark.id]: { x: 50, y: 75, w: 200 } },
});

/* ---------- Torn: black paper above, white below, a ragged edge with a shadow ---------- */
const TEAR = 'M0 640L0 379L18 378L36 382L54 368L71 365L89 362L107 349L125 351L143 349L161 347L179 326L196 325L214 314L232 323L250 314L268 292L286 306L304 298L321 283L339 275L357 257L375 247L393 250L411 233L429 228L446 222L464 211L482 214L500 207L518 210L536 197L554 194L571 186L589 185L607 176L625 168L643 180L661 176L679 168L696 162L714 149L732 143L750 141L768 132L786 143L804 130L821 136L839 120L857 128L875 120L893 95L911 93L929 102L946 86L964 90L982 70L1000 56L1000 640Z';
const EDGE = 'M0 379L18 378L36 382L54 368L71 365L89 362L107 349L125 351L143 349L161 347L179 326L196 325L214 314L232 323L250 314L268 292L286 306L304 298L321 283L339 275L357 257L375 247L393 250L411 233L429 228L446 222L464 211L482 214L500 207L518 210L536 197L554 194L571 186L589 185L607 176L625 168L643 180L661 176L679 168L696 162L714 149L732 143L750 141L768 132L786 143L804 130L821 136L839 120L857 128L875 120L893 95L911 93L929 102L946 86L964 90L982 70L1000 56';
const tornScene = {
  name: 'Torn paper',
  states: { focus: { when: 'focus > 0.5', ease: 1.6 } },
  layers: [
    full("=mixc('#0a0a0a', '#000000', dark)"),
    { t: 'noise', x: 0, y: 0, w: '=W', h: '=H', op: 0.05, freq: 1.4, blend: 'screen' },
    group([
      { t: 'path', x: 4, y: 10, d: TEAR, fill: 'rgba(0,0,0,0.9)', blur: 7 },
      { t: 'path', x: 0, y: 0, d: TEAR, fill: grad(180, [0, '#f4f4f4'], [1, '#ffffff']) },
      { t: 'path', x: 0, y: 0, d: EDGE, stroke: 'rgba(120,120,120,0.55)', sw: 2.4, fill: 'none', blur: 0.8 },
      { t: 'path', x: 0, y: -1, d: EDGE, stroke: 'rgba(255,255,255,0.95)', sw: 1.6, fill: 'none' },
    ], { x: 0, y: '=H - 520' }),
  ],
};
const tornSig = customWidget({ name: 'Signature', size: [300, 100], root: [text(0, 70, 76, 'focus', { font: 'script', fill: '#141414', weight: 400 })] });
const tornWave = wave(26, 36, 3, '#f5f5f5', 5);
const tornFocus = focusLabel(26, '#f5f5f5', 10);
const torn = base('torn', tornScene, {
  weight: 300, color: '#ffffff', widgets: [tornSig, tornWave, tornFocus],
  items: { clock: { x: 27, y: 22, s: 2.3, sx: 1.8 }, greeting: { x: 27, y: 9, s: 1 }, [tornWave.id]: { x: 22, y: 48, w: 260 }, [tornFocus.id]: { x: 26, y: 60, w: 400 }, [tornSig.id]: { x: 74, y: 84, w: 300 } },
});

export const MONO_PACKS = [paper, carbon, torn];
