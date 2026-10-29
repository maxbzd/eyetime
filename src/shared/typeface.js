// The Home type designer's model (pure): which faces exist, how a saved style is validated, and which CSS declarations a style means.
// A style only holds what the user changed; anything left out (null / default) keeps the look's own typography.

import { normalizeHex } from './color.js';

const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const SERIF = '"Iowan Old Style", Georgia, "Times New Roman", serif';

/** `w`: the weight range the file really has; `cyr`: has Cyrillic (the greeting and date need it in Russian / Ukrainian); `def`: a sensible default weight. */
export const TYPEFACES = {
  inter:       { label: 'Inter',            stack: `"Inter", ${SANS}`,                  w: [100, 900], def: 300, cyr: true },
  manrope:     { label: 'Manrope',          stack: `"Manrope", "Inter", ${SANS}`,       w: [200, 800], def: 300, cyr: true },
  nunito:      { label: 'Nunito',           stack: `"Nunito", "Inter", ${SANS}`,        w: [200, 900], def: 300, cyr: true },
  rubik:       { label: 'Rubik',            stack: `"Rubik", "Inter", ${SANS}`,         w: [300, 900], def: 400, cyr: true },
  montserrat:  { label: 'Montserrat',       stack: `"Montserrat", "Inter", ${SANS}`,    w: [100, 900], def: 300, cyr: true },
  spacegrotesk:{ label: 'Space Grotesk',    stack: `"Space Grotesk", "Inter", ${SANS}`, w: [300, 700], def: 400, cyr: false },
  unbounded:   { label: 'Unbounded',        stack: `"Unbounded", "Inter", ${SANS}`,     w: [200, 900], def: 300, cyr: true },
  oswald:      { label: 'Oswald',           stack: `"Oswald", "Inter", ${SANS}`,        w: [200, 700], def: 300, cyr: true },
  orbitron:    { label: 'Orbitron',         stack: `"Orbitron", "Inter", ${SANS}`,      w: [400, 900], def: 500, cyr: false },
  mono:        { label: 'JetBrains Mono',   stack: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace', w: [100, 800], def: 300, cyr: true },
  serif:       { label: 'Source Serif',     stack: `"Source Serif 4", ${SERIF}`,        w: [200, 900], def: 300, cyr: true },
  playfair:    { label: 'Playfair Display', stack: `"Playfair Display", ${SERIF}`,      w: [400, 900], def: 400, cyr: true },
  fraunces:    { label: 'Fraunces',         stack: `"Fraunces", ${SERIF}`,              w: [100, 900], def: 300, cyr: false },
  instrument:  { label: 'Instrument Serif', stack: `"Instrument Serif", ${SERIF}`,      w: [400, 400], def: 400, cyr: false },
  caveat:      { label: 'Caveat',           stack: '"Caveat", "Comic Sans MS", cursive', w: [400, 700], def: 500, cyr: true },
  literata:    { label: 'Literata',         stack: `"Literata", ${SERIF}`,             w: [200, 900], def: 400, cyr: true },
  onest:       { label: 'Onest',            stack: `"Onest", "Inter", ${SANS}`,        w: [100, 900], def: 300, cyr: true },
  antonio:     { label: 'Antonio',          stack: `"Antonio", "Oswald", ${SANS}`,      w: [100, 700], def: 300, cyr: false },
  cormorant:   { label: 'Cormorant',        stack: `"Cormorant Garamond", ${SERIF}`,    w: [300, 700], def: 400, cyr: true },
  signature:   { label: 'Mrs Saint Delafield', stack: '"Mrs Saint Delafield", "Caveat", cursive', w: [400, 400], def: 400, cyr: false },
  system:      { label: 'System',           stack: SANS,                                w: [100, 900], def: 300, cyr: true },
};
export const TYPEFACE_IDS = Object.keys(TYPEFACES);
export const FILLS = ['solid', 'gradient', 'outline', 'glass', 'photo'];

/** What a style looks like when the user has not touched it. */
export const CLOCK_DEFAULT = { font: 'look', weight: null, tracking: null, fill: 'solid', color: null, color2: null, angle: 100, stroke: 2, glow: 0, shadow: 0, opacity: 1, seconds: false, tabular: true };
export const TEXT_DEFAULT = { font: 'look', weight: null, tracking: null, color: null, upper: false };

const num = (v, lo, hi, fallback) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);
const r3 = (n) => Math.round(n * 1000) / 1000;
const hex = (v) => normalizeHex(v) || null;

/** Validate a saved style (unknown fonts fall back to the look's font, numbers are clamped; nothing can break the page). */
export function normalizeType(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const c = r.clock && typeof r.clock === 'object' ? r.clock : {}, x = r.text && typeof r.text === 'object' ? r.text : {};
  const face = (v) => (v === 'look' || TYPEFACES[v] ? v : 'look');
  const wt = (font, v) => { if (typeof v !== 'number' || !Number.isFinite(v)) return null; const [lo, hi] = (TYPEFACES[font] || TYPEFACES.inter).w; return Math.round(Math.min(hi, Math.max(lo, v))); };
  const cf = face(c.font), tf = face(x.font);
  return {
    clock: {
      font: cf, weight: wt(cf, c.weight), tracking: typeof c.tracking === 'number' ? r3(num(c.tracking, -0.12, 0.3, 0)) : null,
      fill: FILLS.includes(c.fill) ? c.fill : 'solid', color: hex(c.color), color2: hex(c.color2),
      angle: Math.round(num(c.angle, 0, 360, CLOCK_DEFAULT.angle)), stroke: r3(num(c.stroke, 0.5, 6, CLOCK_DEFAULT.stroke)),
      glow: r3(num(c.glow, 0, 1, 0)), shadow: r3(num(c.shadow, 0, 1, 0)), opacity: r3(num(c.opacity, 0.15, 1, 1)), seconds: c.seconds === true, tabular: c.tabular !== false,
    },
    text: {
      font: tf, weight: wt(tf, x.weight), tracking: typeof x.tracking === 'number' ? r3(num(x.tracking, -0.05, 0.3, 0)) : null,
      color: hex(x.color), upper: x.upper === true,
    },
  };
}

/** Has the user changed anything of this style? */
export const isCustom = (style, base) => JSON.stringify(style) !== JSON.stringify(base);

const GRAD_A = '#ff8a5c', GRAD_B = '#8b5cf6';

/** The inline CSS declarations a clock style means (only for what was changed). */
export function clockDecls(s) {
  const d = {};
  const face = TYPEFACES[s.font];
  if (face) d['font-family'] = face.stack;
  if (s.weight !== null) d['font-weight'] = String(s.weight);
  if (s.tracking !== null) d['letter-spacing'] = s.tracking + 'em';
  if (!s.tabular) d['font-variant-numeric'] = 'proportional-nums';
  const base = s.color || null;
  if (s.fill === 'gradient') {
    const a = s.color || GRAD_A, b = s.color2 || GRAD_B;
    Object.assign(d, { 'background-image': `linear-gradient(${s.angle}deg, ${a}, ${b})`, '-webkit-background-clip': 'text', 'background-clip': 'text', '-webkit-text-fill-color': 'transparent', color: a, '-webkit-text-stroke': '0' });
  } else if (s.fill === 'glass') {
    // frosted glass: a soft copy of the photo shows through the digits under a light tint (the person's colour, else white — dark on a light photo), with a bright edge and a soft shadow;
    // the picture's size and place are set by the page (--clk-bgs / --clk-bgp)
    const tint = s.color || 'var(--glass-tint, #fff)';
    Object.assign(d, {
      'background-image': `linear-gradient(180deg, color-mix(in srgb, ${tint} 52%, transparent), color-mix(in srgb, ${tint} 16%, transparent) 62%, color-mix(in srgb, ${tint} 34%, transparent)), var(--photo-soft, none)`,
      'background-size': 'auto, var(--clk-bgs, cover)', 'background-position': '0 0, var(--clk-bgp, center)', 'background-repeat': 'no-repeat',
      '-webkit-background-clip': 'text', 'background-clip': 'text', '-webkit-text-fill-color': 'transparent', color: 'transparent',
      '-webkit-text-stroke': '0',
    });
  } else if (s.fill === 'photo') {
    // the digits are windows into the photo itself
    Object.assign(d, {
      'background-image': 'var(--photo, linear-gradient(#fff, #fff))',
      'background-size': 'var(--clk-bgs, cover)', 'background-position': 'var(--clk-bgp, center)', 'background-repeat': 'no-repeat',
      '-webkit-background-clip': 'text', 'background-clip': 'text', '-webkit-text-fill-color': 'transparent', color: 'transparent', '-webkit-text-stroke': '0',
    });
  } else if (s.fill === 'outline') {
    Object.assign(d, { 'background-image': 'none', '-webkit-text-fill-color': 'transparent', '-webkit-text-stroke': `${s.stroke}px ${base || 'currentColor'}` });
    if (base) d.color = base;
  } else if (base) {
    Object.assign(d, { color: base, '-webkit-text-fill-color': base, 'background-image': 'none', '-webkit-text-stroke': '0' });
  }
  const glowColor = s.fill === 'gradient' ? (s.color || GRAD_A) : base || 'currentColor';
  const parts = [];
  if (s.fill === 'glass') parts.push(`drop-shadow(0 0 1px color-mix(in srgb, ${s.color || 'var(--glass-tint, #fff)'} 80%, transparent))`, 'drop-shadow(0 14px 34px rgba(0, 0, 0, 0.28))'); // a fine bright rim (a stroke would show the overlapping contours of some fonts)
  if (s.fill === 'photo') parts.push('drop-shadow(0 10px 28px rgba(0, 0, 0, 0.3))');
  if (s.glow > 0) parts.push(`drop-shadow(0 0 ${Math.round(8 + s.glow * 48)}px color-mix(in srgb, ${glowColor} ${Math.round(40 + s.glow * 40)}%, transparent))`);
  if (s.shadow > 0) parts.push(`drop-shadow(0 ${Math.round(2 + s.shadow * 18)}px ${Math.round(6 + s.shadow * 34)}px rgba(0, 0, 0, ${r3(0.15 + s.shadow * 0.4)}))`);
  if (parts.length) d.filter = parts.join(' ');
  if (s.opacity < 1) d.opacity = String(s.opacity);
  return d;
}

/** The inline declarations for the greeting and date. */
export function textDecls(s) {
  const d = {};
  const face = TYPEFACES[s.font];
  if (face) d['font-family'] = face.stack;
  if (s.weight !== null) d['font-weight'] = String(s.weight);
  if (s.tracking !== null) d['letter-spacing'] = s.tracking + 'em';
  if (s.color) d.color = s.color;
  if (s.upper) d['text-transform'] = 'uppercase';
  return d;
}
