// The skin of a card on Home: how the card itself looks (glass, liquid glass, solid, outline, bare, neon, paper, tint), separate from what it shows.
// One skin for every card of Home (the theme's "DNA", newtab.dna) and an optional own skin per widget. Pure: a validated skin → the CSS variables to set.
// Cards already take their look from variables (--card-bg, --card-border, --card-shadow, --card-blur, --r-lg …), so a skin only has to set those (and the text tokens).

import { normalizeHex, hexToRgb, luminance } from './color.js';

export const SKIN_STYLES = ['look', 'glass', 'liquid', 'solid', 'outline', 'bare', 'neon', 'paper', 'tint'];
export const SKIN_INKS = ['auto', 'light', 'dark'];

/** Base values of every style: r radius, b blur, o background opacity (%), bw border width, sh shadow (0-100), and a forced ink where the style needs one. */
export const SKIN_PRESETS = {
  glass:   { r: 22, b: 26, o: 34, bw: 1, sh: 40 },
  liquid:  { r: 28, b: 10, o: 12, bw: 1, sh: 45 },
  solid:   { r: 18, b: 0,  o: 94, bw: 1, sh: 30 },
  outline: { r: 18, b: 0,  o: 0,  bw: 2, sh: 0 },
  bare:    { r: 0,  b: 0,  o: 0,  bw: 0, sh: 0 },
  neon:    { r: 16, b: 10, o: 62, bw: 2, sh: 70, ink: 'light' },
  paper:   { r: 5,  b: 0,  o: 100, bw: 1, sh: 45, ink: 'dark' },
  tint:    { r: 22, b: 22, o: 30, bw: 1, sh: 35 },
};
const RANGE = { r: [0, 44], b: [0, 44], o: [0, 100], bw: [0, 4], sh: [0, 100] };
const num = (v, [lo, hi]) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.min(hi, Math.max(lo, v))) : undefined);

/** A saved skin → a clean one ({ s, … } with only the keys that were set), or null when it is not one. 'look' = leave the card to the look. */
/** @returns {any} */
export function normalizeSkin(raw) {
  if (!raw || typeof raw !== 'object' || !SKIN_STYLES.includes(raw.s)) return null;
  /** @type {Record<string, any>} */ const out = { s: raw.s };
  for (const k of Object.keys(RANGE)) { const v = num(raw[k], RANGE[k]); if (v !== undefined) out[k] = v; }
  const a = normalizeHex(raw.a); if (a) out.a = a;
  if (SKIN_INKS.includes(raw.ink) && raw.ink !== 'auto') out.ink = raw.ink;
  return out;
}

/** The ink (text colour family) that reads on the scene: 'light' text on dark scenes, 'dark' text on light ones. */
export function autoInk({ tone = '', scheme = 'light' } = {}) {
  return tone === 'dark' ? 'light' : tone === 'light' ? 'dark' : scheme === 'dark' ? 'light' : 'dark';
}

const INK = {
  light: { '--text': '#ffffff', '--text-2': 'rgba(255,255,255,.82)', '--text-3': 'rgba(255,255,255,.60)', '--border': 'rgba(255,255,255,.20)', '--border-strong': 'rgba(255,255,255,.34)', '--surface': 'rgba(26,28,38,.92)', '--surface-2': 'rgba(255,255,255,.10)', '--surface-3': 'rgba(255,255,255,.17)' },
  dark:  { '--text': '#17140f', '--text-2': 'rgba(23,20,15,.76)', '--text-3': 'rgba(23,20,15,.56)', '--border': 'rgba(23,20,15,.14)', '--border-strong': 'rgba(23,20,15,.26)', '--surface': 'rgba(255,255,255,.94)', '--surface-2': 'rgba(23,20,15,.06)', '--surface-3': 'rgba(23,20,15,.10)' },
};
const rgb = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r}, ${g}, ${b}, ${a})`; };
const dim = (ink, a) => (ink === 'light' ? `rgba(20, 22, 32, ${a})` : `rgba(255, 255, 255, ${a})`);

/**
 * The CSS variables (and a few flags) of a skin.
 * @param {{ s: string } & Record<string, any>} skin a normalised skin
 * @param {{ ink: 'light' | 'dark', accent: string }} env the ink that reads on the scene, the look's accent colour
 * @returns {{ vars: Record<string, string>, liquid: boolean, bare: boolean }}
 */
export function skinTokens(skin, env) {
  const P = SKIN_PRESETS[skin.s];
  if (!P) return { vars: {}, liquid: false, bare: false };
  const ink = P.ink || skin.ink || env.ink, accent = skin.a || normalizeHex(env.accent) || '#cf450a';
  const r = skin.r ?? P.r, b = skin.b ?? P.b, o = skin.o ?? P.o, bw = skin.bw ?? P.bw, sh = skin.sh ?? P.sh, al = o / 100;
  const vars = { ...INK[ink], '--r-lg': r + 'px', '--r-md': Math.max(4, Math.round(r * .62)) + 'px', '--card-blur': b + 'px', '--border-w': bw + 'px' };
  let bg, border = dim(ink === 'light' ? 'dark' : 'light', 0), shadow = sh ? `0 ${Math.round(sh * .18)}px ${Math.round(sh * .6)}px rgba(0, 0, 0, ${(sh * .0034).toFixed(3)})` : 'none';
  switch (skin.s) {
    case 'glass': bg = dim(ink, al); border = 'rgba(255, 255, 255, .30)'; break;
    case 'liquid':
      bg = `linear-gradient(135deg, rgba(255, 255, 255, ${(.16 + al * .4).toFixed(3)}), rgba(255, 255, 255, ${(.02 + al * .15).toFixed(3)}) 55%, rgba(255, 255, 255, ${(.08 + al * .3).toFixed(3)})), ${dim(ink, .16 + al * .7)}`;
      border = 'rgba(255, 255, 255, .42)';
      shadow = `${shadow === 'none' ? '' : shadow + ', '}inset 0 1.5px 0 rgba(255, 255, 255, .62), inset 0 -1px 0 rgba(255, 255, 255, .18), inset 0 0 26px rgba(255, 255, 255, .10)`;
      break;
    case 'solid': bg = ink === 'light' ? `rgba(28, 30, 40, ${al})` : `rgba(255, 255, 255, ${al})`; border = ink === 'light' ? 'rgba(255, 255, 255, .12)' : 'rgba(23, 20, 15, .10)'; break;
    case 'outline': bg = 'transparent'; border = ink === 'light' ? 'rgba(255, 255, 255, .72)' : 'rgba(23, 20, 15, .62)'; break;
    case 'bare': bg = 'transparent'; border = 'transparent'; break;
    case 'neon': bg = `rgba(8, 10, 22, ${al})`; border = accent; shadow = `0 0 ${Math.round(sh * .34)}px ${rgb(accent, .55)}, inset 0 0 ${Math.round(sh * .2)}px ${rgb(accent, .28)}`; break;
    case 'paper': bg = '#f6f0e4'; border = '#ddd2bb'; shadow = `0 1px 0 #fff inset, 0 ${Math.round(sh * .06)}px ${Math.round(sh * .16)}px rgba(60, 40, 10, .22), 0 ${Math.round(sh * .26)}px ${Math.round(sh * .6)}px rgba(60, 40, 10, .16)`; break;
    case 'tint': bg = `color-mix(in srgb, ${accent} ${Math.round(18 + al * 40)}%, ${dim(ink, al * .5)})`; border = rgb(accent, .5); break;
    default: bg = 'transparent';
  }
  vars['--card-bg'] = bg; vars['--card-border'] = border; vars['--card-shadow'] = shadow;
  if (skin.a || skin.s === 'neon' || skin.s === 'tint') {
    vars['--accent'] = accent; vars['--accent-hover'] = accent; vars['--accent-text'] = accent;
    vars['--accent-soft'] = rgb(accent, .18); vars['--accent-ring'] = rgb(accent, .42); vars['--accent-fg'] = luminance(accent) > 0.45 ? '#1a1208' : '#ffffff';
  }
  return { vars, liquid: skin.s === 'liquid', bare: skin.s === 'bare' };
}

/** A handful of coherent starting points for each style, to pick without touching a slider (the panel shows these first). */
export const SKIN_SWATCHES = ['#ff7a3d', '#ff4d8d', '#a78bfa', '#4cc9f0', '#34d399', '#facc15', '#ffffff'];
