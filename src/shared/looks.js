// The theme engine (pure). A *look* is a small palette (bg / surface / text / accent per scheme) plus a character
// (fonts, corner radii, card style, shadow style). Every other token — borders, secondary text, tints, semantic
// colours — is DERIVED, and contrast is enforced in code (see color.js), so any look, any accent a user picks and any
// combination of options stays readable. `resolveVars()` returns the final CSS custom properties.

import { mix, rgba, ensureContrast, readableFill, normalizeHex, contrast } from './color.js';

export const FONTS = {
  inter: { label: 'Inter', stack: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
  manrope: { label: 'Manrope', stack: '"Manrope", "Inter", ui-sans-serif, system-ui, sans-serif' },
  nunito: { label: 'Nunito', stack: '"Nunito", "Inter", ui-rounded, ui-sans-serif, system-ui, sans-serif' },
  serif: { label: 'Source Serif', stack: '"Source Serif 4", "Iowan Old Style", Georgia, "Times New Roman", serif' },
  mono: { label: 'JetBrains Mono', stack: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace' },
  system: { label: 'System', stack: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
};

/** [light, dark] base fill per accent preset; `look` = the look's own accent. */
export const ACCENTS = {
  ember: ['#d9480f', '#ff7a3d'], amber: ['#d97706', '#fbbf24'], rose: ['#d6336c', '#ff7eb6'], red: ['#dc2626', '#ff6b6b'],
  violet: ['#7c3aed', '#a98bff'], indigo: ['#4f46e5', '#8b93ff'], blue: ['#2563eb', '#6ea0ff'], teal: ['#0b8a84', '#2cc4bd'], green: ['#2f8a3a', '#6fd16f'], slate: ['#475569', '#cbd5e1'],
};

export const RADII = { sharp: [3, 5, 8, 12], soft: [8, 12, 16, 24], round: [12, 16, 24, 32], pill: [16, 20, 28, 40] };
export const DENSITY = { compact: { d: 0.86, ctl: 32 }, comfortable: { d: 1, ctl: 36 }, spacious: { d: 1.18, ctl: 42 } };
export const CARD_STYLES = ['look', 'solid', 'glass', 'outline', 'flat'];
export const SCALES = [90, 100, 110, 125];

/* ---------- the looks ---------- */

const blobs = (a = 22, b = 14) => `radial-gradient(900px 560px at 8% -10%, color-mix(in srgb, var(--accent) ${a}%, transparent), transparent 62%), radial-gradient(800px 600px at 100% 0%, color-mix(in srgb, var(--productive) ${b}%, transparent), transparent 60%), radial-gradient(700px 500px at 50% 115%, color-mix(in srgb, var(--distracting) ${b - 4}%, transparent), transparent 62%)`;

export const LOOKS = {
  calm: {
    name: 'Calm', blurb: 'Warm, quiet, neutral. The default.', font: 'inter', display: 'inter', radii: 'soft', cards: 'solid', shadow: 'soft', borderW: 1, headingW: 650, headingLs: '-.015em', homeBg: 'dawn', homeScene: 'dawn',
    light: { bg: '#faf9f7', surface: '#ffffff', text: '#1c1917', accent: '#cf450a' },
    dark: { bg: '#0f0e0d', surface: '#181716', text: '#f5f3f0', accent: '#ff7a3d' },
  },
  paper: {
    name: 'Paper', blurb: 'Parchment and serif type, like a well-set book.', font: 'serif', display: 'serif', radii: [3, 5, 8, 12], cards: 'solid', shadow: 'soft', borderW: 1, headingW: 600, headingLs: '-.01em', homeBg: 'grain',
    light: { bg: '#f1e9d8', surface: '#faf5e8', text: '#2a2118', accent: '#9c3d1c', border: '#ddd1b8' },
    dark: { bg: '#16120d', surface: '#1f1912', text: '#ece2cf', accent: '#e3a56b' },
  },
  midnight: {
    name: 'Midnight', blurb: 'Deep indigo with a cool glow.', font: 'inter', display: 'manrope', radii: [8, 12, 18, 26], cards: 'solid', shadow: 'glow', borderW: 1, headingW: 700, headingLs: '-.02em', homeBg: 'aurora',
    light: { bg: '#eceffb', surface: '#ffffff', text: '#10153a', accent: '#4f46e5' },
    dark: { bg: '#070b1b', surface: '#0e1430', text: '#e6e9ff', accent: '#7dd3fc' },
    pageBg: { dark: blobs(16, 8), light: blobs(10, 6) },
  },
  terminal: {
    name: 'Terminal', blurb: 'Monospace, sharp corners, phosphor green.', font: 'mono', display: 'mono', radii: [2, 3, 4, 6], cards: 'outline', shadow: 'none', borderW: 1, headingW: 600, headingLs: '0', homeBg: 'grid',
    light: { bg: '#f1efe4', surface: '#f9f7ec', text: '#1b2615', accent: '#1d7a3a', border: '#cfd3bd' },
    dark: { bg: '#020a05', surface: '#05110a', text: '#b9f5c9', accent: '#3dff8a', border: '#14472b' },
  },
  sakura: {
    name: 'Sakura', blurb: 'Soft blush pink, rounded and friendly.', font: 'nunito', display: 'nunito', radii: [12, 18, 26, 36], cards: 'solid', shadow: 'soft', borderW: 1, headingW: 800, headingLs: '-.01em', homeBg: 'dusk',
    light: { bg: '#fff3f6', surface: '#ffffff', text: '#3b1d2a', accent: '#d6336c' },
    dark: { bg: '#1a1016', surface: '#241621', text: '#fde7ef', accent: '#ff8fb4' },
  },
  forest: {
    name: 'Forest', blurb: 'Mossy greens for a grounded, steady mood.', font: 'manrope', display: 'manrope', radii: [8, 12, 16, 22], cards: 'solid', shadow: 'soft', borderW: 1, headingW: 700, headingLs: '-.015em', homeBg: 'forest',
    light: { bg: '#edf3ea', surface: '#fafdf7', text: '#15261a', accent: '#2f7d4f' },
    dark: { bg: '#09120c', surface: '#0f1b13', text: '#e2f0e6', accent: '#6fd29a' },
  },
  aurora: {
    name: 'Aurora', blurb: 'Frosted glass over drifting colour.', font: 'inter', display: 'manrope', radii: [10, 14, 20, 28], cards: 'glass', shadow: 'glow', borderW: 1, headingW: 700, headingLs: '-.02em', homeBg: 'aurora',
    light: { bg: '#f2eeff', surface: '#ffffff', text: '#1f1a3a', accent: '#6d4aff' },
    dark: { bg: '#06060f', surface: '#12121f', text: '#f0eeff', accent: '#a994ff' },
    pageBg: { dark: blobs(26, 16), light: blobs(18, 10) },
  },
  mono: {
    name: 'Mono', blurb: 'Pure black and white. Maximum contrast, no decoration.', font: 'inter', display: 'inter', radii: [3, 4, 6, 8], cards: 'outline', shadow: 'hard', borderW: 2, headingW: 800, headingLs: '-.03em', homeBg: 'plain',
    light: { bg: '#ffffff', surface: '#ffffff', text: '#000000', accent: '#000000', border: '#000000', borderStrong: '#000000' },
    dark: { bg: '#000000', surface: '#000000', text: '#ffffff', accent: '#ffffff', border: '#ffffff', borderStrong: '#ffffff' },
  },
  obsidian: {
    name: 'Obsidian', blurb: 'True black glass with a warm ember glow.', font: 'inter', display: 'inter', radii: [10, 14, 20, 28], cards: 'glass', shadow: 'deep', borderW: 1, headingW: 650, headingLs: '-.03em',
    light: { bg: '#f3f1ee', surface: '#ffffff', text: '#141318', accent: '#e2491a' },
    dark: { bg: '#000000', surface: '#0e0e11', text: '#f5f5f7', accent: '#ff6a3d' },
    pageBg: { dark: 'radial-gradient(900px 520px at 88% -8%, rgba(255, 106, 61, .16), transparent 62%), radial-gradient(700px 480px at -6% 4%, rgba(255, 255, 255, .05), transparent 60%)', light: 'radial-gradient(900px 520px at 88% -8%, rgba(226, 73, 26, .13), transparent 62%), radial-gradient(700px 480px at -6% 4%, rgba(255, 255, 255, .9), transparent 60%)' },
  },
  void: {
    name: 'Void', blurb: 'Type and hairlines only. Nothing to look at but your work.', font: 'inter', display: 'inter', radii: [6, 10, 14, 20], cards: 'outline', shadow: 'none', borderW: 1, headingW: 500, headingLs: '-.025em',
    light: { bg: '#fcfcfb', surface: '#fcfcfb', text: '#0b0b0c', accent: '#18181b', border: '#e4e4e1', borderStrong: '#bdbdb8' },
    dark: { bg: '#050505', surface: '#050505', text: '#fafafa', accent: '#fafafa', border: '#222224', borderStrong: '#4a4a4e' },
  },
  noir: {
    name: 'Noir', blurb: 'Ivory serif on black, a watch-dial timer, champagne details.', font: 'inter', display: 'serif', radii: [2, 4, 6, 10], cards: 'outline', shadow: 'none', borderW: 1, headingW: 400, headingLs: '-.01em',
    light: { bg: '#f4efe4', surface: '#fbf8f0', text: '#1b1712', accent: '#8f6b2c', border: '#ddd4c1', borderStrong: '#b9ab8e' },
    dark: { bg: '#030302', surface: '#0c0b09', text: '#f2ede3', accent: '#d8c196', border: '#262219', borderStrong: '#4d4535' },
  },
  pearl: {
    name: 'Pearl', blurb: 'Airy frosted glass over soft pastel light.', font: 'manrope', display: 'manrope', radii: [14, 20, 28, 36], cards: 'glass', shadow: 'airy', borderW: 1, headingW: 700, headingLs: '-.02em',
    light: { bg: '#eceefb', surface: '#ffffff', text: '#1c1b3a', accent: '#5a54f0' },
    dark: { bg: '#0a0a18', surface: '#14142a', text: '#f1f0ff', accent: '#9d93ff' },
    pageBg: { light: 'radial-gradient(900px 620px at 6% -8%, rgba(255, 190, 170, .55), transparent 64%), radial-gradient(900px 640px at 100% 4%, rgba(174, 160, 255, .55), transparent 66%), radial-gradient(800px 560px at 50% 112%, rgba(150, 230, 215, .45), transparent 66%)', dark: 'radial-gradient(900px 620px at 6% -8%, rgba(255, 140, 120, .16), transparent 64%), radial-gradient(900px 640px at 100% 4%, rgba(130, 110, 255, .26), transparent 66%), radial-gradient(800px 560px at 50% 112%, rgba(70, 200, 190, .14), transparent 66%)' },
  },
  bento: {
    name: 'Bento', blurb: 'Soft colour tiles, rounded and friendly.', font: 'nunito', display: 'nunito', radii: [14, 20, 28, 36], cards: 'flat', shadow: 'soft', borderW: 1, headingW: 800, headingLs: '-.02em',
    light: { bg: '#f5f0e8', surface: '#ffffff', text: '#201a15', accent: '#0f8a63' },
    dark: { bg: '#0f120f', surface: '#181d18', text: '#eef3ec', accent: '#5fd6a2' },
  },
  spectrum: {
    name: 'Spectrum', blurb: 'Deep ink with a prism flare, hairline cards and one white pill.', font: 'inter', display: 'inter', radii: [10, 14, 20, 28], cards: 'flat', shadow: 'none', borderW: 1, headingW: 650, headingLs: '-.03em',
    light: { bg: '#f2f3f9', surface: '#ffffff', text: '#12132a', accent: '#0a7f99', border: '#dfe1ee' },
    dark: { bg: '#05060d', surface: '#0e1020', text: '#f4f5ff', accent: '#3ad6ee', border: '#1e2138' },
    pageBg: { dark: 'radial-gradient(60% 50% at 0% 100%, rgba(255, 70, 160, .20), transparent 70%), radial-gradient(55% 45% at 100% 95%, rgba(255, 150, 50, .22), transparent 70%), radial-gradient(70% 40% at 80% -10%, rgba(58, 214, 238, .16), transparent 70%)', light: 'radial-gradient(60% 50% at 0% 100%, rgba(255, 120, 190, .30), transparent 70%), radial-gradient(55% 45% at 100% 95%, rgba(255, 190, 110, .35), transparent 70%), radial-gradient(70% 40% at 80% -10%, rgba(90, 210, 235, .30), transparent 70%)' },
  },
  tide: {
    name: 'Tide', blurb: 'A dusk horizon behind frosted glass and a floating pill.', font: 'inter', display: 'inter', radii: [12, 16, 24, 32], cards: 'glass', shadow: 'airy', borderW: 1, headingW: 600, headingLs: '-.025em',
    light: { bg: '#e8edf4', surface: '#ffffff', text: '#16202e', accent: '#bd4f35' },
    dark: { bg: '#0b1220', surface: '#141d2e', text: '#eef2fa', accent: '#f2a68b' },
    pageBg: { dark: 'linear-gradient(180deg, #1a2540 0%, #2f2d4e 34%, #7d5663 50%, #e0a08a 53%, #1d2a44 56%, #0b1220 100%)', light: 'linear-gradient(180deg, #b9c6dd 0%, #d9cfe0 34%, #f3cdbd 50%, #f8dccb 53%, #cdd9e8 56%, #e8edf4 100%)' },
  },
  ledger: {
    name: 'Ledger', blurb: 'Calm navy, big numerals and smooth area charts.', font: 'inter', display: 'inter', radii: [10, 14, 18, 24], cards: 'solid', shadow: 'none', borderW: 1, headingW: 600, headingLs: '-.025em',
    light: { bg: '#eff3f8', surface: '#ffffff', text: '#0f1726', accent: '#0b7f62', border: '#dbe3ee' },
    dark: { bg: '#0a0e1a', surface: '#121829', text: '#e9edf7', accent: '#4cc2a0', border: '#1f2740' },
  },
  vital: {
    name: 'Vital', blurb: 'Charcoal and olive, thick rings, serif headlines.', font: 'inter', display: 'serif', radii: [12, 16, 22, 30], cards: 'solid', shadow: 'soft', borderW: 1, headingW: 400, headingLs: '-.015em',
    light: { bg: '#f3f2ea', surface: '#fbfaf4', text: '#1a1d14', accent: '#4b7a12', border: '#e1e0d2' },
    dark: { bg: '#0c0d0b', surface: '#171a15', text: '#eef0e8', accent: '#a3d45a', border: '#272b22' },
    pageBg: { dark: 'radial-gradient(70% 45% at 50% -10%, rgba(120, 140, 60, .20), transparent 70%)', light: 'radial-gradient(70% 45% at 50% -10%, rgba(150, 170, 80, .22), transparent 70%)' },
  },
  aura: {
    name: 'Aura', blurb: 'A soft rose-to-peach glow with serif numerals and glass pills.', font: 'manrope', display: 'serif', radii: [14, 20, 28, 40], cards: 'glass', shadow: 'airy', borderW: 1, headingW: 400, headingLs: '-.015em',
    light: { bg: '#fbeef1', surface: '#ffffff', text: '#2a1b2e', accent: '#c7336f' },
    dark: { bg: '#150d1c', surface: '#21152b', text: '#fbeff6', accent: '#ff8ab8' },
    pageBg: { light: 'radial-gradient(60% 55% at 15% 8%, rgba(255, 170, 190, .65), transparent 70%), radial-gradient(60% 55% at 90% 12%, rgba(190, 170, 255, .55), transparent 70%), radial-gradient(70% 50% at 55% 100%, rgba(255, 205, 160, .55), transparent 70%)', dark: 'radial-gradient(60% 55% at 15% 8%, rgba(255, 110, 160, .22), transparent 70%), radial-gradient(60% 55% at 90% 12%, rgba(140, 110, 255, .22), transparent 70%), radial-gradient(70% 50% at 55% 100%, rgba(255, 150, 110, .16), transparent 70%)' },
  },
  sunset: {
    name: 'Sunset', blurb: 'Peach, coral and a warm evening light.', font: 'manrope', display: 'manrope', radii: [10, 14, 20, 28], cards: 'solid', shadow: 'soft', borderW: 1, headingW: 750, headingLs: '-.02em', homeBg: 'mesh',
    light: { bg: '#fff1e6', surface: '#fffaf5', text: '#3a1710', accent: '#e0481f' },
    dark: { bg: '#180c11', surface: '#23121a', text: '#ffe8dc', accent: '#ff8f5a' },
    pageBg: { light: 'radial-gradient(900px 600px at 0% -10%, #ffd0b0aa, transparent 65%), radial-gradient(900px 600px at 100% 10%, #ffb3c4aa, transparent 60%)', dark: 'radial-gradient(900px 600px at 0% -10%, #ff7a3d22, transparent 65%), radial-gradient(900px 600px at 100% 10%, #ff4d8d1c, transparent 60%)' },
  },
  nord: {
    name: 'Nord', blurb: 'Cool arctic grays and a frosty blue.', font: 'inter', display: 'inter', radii: [6, 8, 12, 16], cards: 'solid', shadow: 'soft', borderW: 1, headingW: 650, headingLs: '-.01em', homeBg: 'slate',
    light: { bg: '#e9edf3', surface: '#ffffff', text: '#2e3440', accent: '#4c6f9a' },
    dark: { bg: '#232831', surface: '#2e3440', text: '#e5e9f0', accent: '#88c0d0' },
  },
  ocean: {
    name: 'Ocean', blurb: 'Clear aqua and deep teal.', font: 'manrope', display: 'manrope', radii: [10, 14, 20, 28], cards: 'solid', shadow: 'soft', borderW: 1, headingW: 700, headingLs: '-.02em', homeBg: 'ocean',
    light: { bg: '#e8f6f8', surface: '#ffffff', text: '#0c2a33', accent: '#0e7490' },
    dark: { bg: '#041217', surface: '#09202a', text: '#dff4f8', accent: '#38bdf8' },
  },
};
const FIRST = ['calm', 'obsidian', 'void', 'noir', 'pearl', 'bento', 'spectrum', 'tide', 'ledger', 'vital', 'aura']; // the gallery order: the default, then the newest
export const LOOK_IDS = [...FIRST, ...Object.keys(LOOKS).filter((id) => !FIRST.includes(id))];

/* ---------- derivation ---------- */

// Data colours are validated for colour-vision deficiency (docs/DESIGN.md) and shared by every look.
const SEMANTIC = {
  light: { productive: '#2d6cdf', neutral: '#9a948c', distracting: '#e0483f', success: '#1f9d6b', warning: '#d98a00' },
  dark: { productive: '#4a89ee', neutral: '#9a948c', distracting: '#e8584f', success: '#3ddc97', warning: '#f2b233' },
};

function shadows(style, scheme, t) {
  if (style === 'none') return ['none', 'none', '0 10px 40px rgba(0, 0, 0, .28)'];
  if (style === 'hard') return ['0 0 0 0 transparent', `3px 3px 0 ${t.borderStrong}`, `6px 6px 0 ${t.borderStrong}`];
  if (style === 'glow') return [`0 0 0 1px ${rgba(t.accent, 0.1)}`, `0 10px 40px ${rgba(t.accent, 0.18)}`, `0 20px 70px ${rgba(t.accent, 0.28)}`];
  if (style === 'deep') return scheme === 'dark'
    ? ['0 0 0 1px rgba(255, 255, 255, .04)', '0 10px 30px rgba(0, 0, 0, .65)', '0 24px 70px rgba(0, 0, 0, .8)']
    : ['0 1px 2px rgba(20, 19, 24, .06)', '0 1px 2px rgba(20, 19, 24, .05), 0 10px 30px rgba(20, 19, 24, .09)', '0 2px 4px rgba(20, 19, 24, .06), 0 24px 60px rgba(20, 19, 24, .18)'];
  if (style === 'airy') return scheme === 'dark'
    ? ['0 0 0 1px rgba(255, 255, 255, .05)', '0 12px 40px rgba(2, 2, 20, .5)', '0 28px 80px rgba(2, 2, 20, .65)']
    : ['0 1px 2px rgba(70, 70, 150, .06)', '0 12px 38px rgba(70, 70, 150, .13)', '0 28px 80px rgba(70, 70, 150, .22)'];
  return scheme === 'dark'
    ? ['0 0 0 1px rgba(255, 255, 255, .02)', '0 8px 24px rgba(0, 0, 0, .4)', '0 16px 48px rgba(0, 0, 0, .55)']
    : ['0 1px 2px rgba(28, 25, 23, .05)', '0 1px 2px rgba(28, 25, 23, .04), 0 8px 24px rgba(28, 25, 23, .08)', '0 2px 4px rgba(28, 25, 23, .06), 0 16px 48px rgba(28, 25, 23, .14)'];
}

/** Colour tokens for one scheme. `accentBase` may be a hex or null (= the look's accent). */
export function deriveColors(look, scheme, accentBase) {
  const b = look[scheme], dark = scheme === 'dark';
  const { bg, surface, text } = b;
  const surface2 = mix(surface, text, dark ? 0.06 : 0.04);
  const surface3 = mix(surface, text, dark ? 0.11 : 0.08);
  const border = b.border || mix(surface, text, dark ? 0.13 : 0.11);
  const borderStrong = b.borderStrong || mix(surface, text, dark ? 0.27 : 0.23);
  const grounds = [surface, bg, surface2];
  const text2 = ensureContrast(mix(text, surface, 0.2), grounds, 4.8);
  const text3 = ensureContrast(mix(text, surface, 0.4), grounds, 4.5);

  let { fill, fg } = readableFill(normalizeHex(accentBase) || b.accent);
  if (contrast(fill, surface) < 3) ({ fill, fg } = readableFill(ensureContrast(fill, [surface], 3))); // the accent must stay visible on the card (focus ring, switches)
  const accentSoft = mix(surface, fill, dark ? 0.17 : 0.11);
  const accentText = ensureContrast(fill, [surface, accentSoft], 4.5);
  const out = {
    bg, surface, 'surface-2': surface2, 'surface-3': surface3, border, 'border-strong': borderStrong, text, 'text-2': text2, 'text-3': text3,
    accent: fill, 'accent-hover': fg === '#ffffff' ? mix(fill, '#000000', 0.14) : mix(fill, '#000000', 0.12), 'accent-fg': fg, 'accent-text': accentText, 'accent-soft': accentSoft, 'accent-ring': rgba(fill, 0.38),
    overlay: dark ? 'rgba(0, 0, 0, .62)' : 'rgba(20, 16, 12, .45)', grid: mix(surface, text, dark ? 0.1 : 0.08), 'bar-empty': mix(surface, text, dark ? 0.1 : 0.07),
  };
  const sem = SEMANTIC[scheme];
  for (const k of ['productive', 'neutral', 'distracting', 'success', 'warning']) {
    const soft = mix(surface, sem[k], dark ? 0.17 : 0.12);
    out[k] = sem[k]; out[k + '-soft'] = soft; out[k + '-text'] = ensureContrast(sem[k], [surface, soft, bg], 4.5);
  }
  // a solid fill for destructive actions (readable text on it, visible on the card)
  let danger = readableFill(sem.distracting);
  if (contrast(danger.fill, surface) < 3) danger = readableFill(ensureContrast(danger.fill, [surface], 3));
  out.danger = danger.fill; out['danger-fg'] = danger.fg; out['danger-hover'] = mix(danger.fill, '#000000', 0.14);
  return out;
}

const radiiOf = (r) => (Array.isArray(r) ? r : RADII[r] || RADII.soft);

/**
 * All CSS custom properties for a given appearance + scheme.
 * ap: { look, accent, font, radius, density, cards } (see DEFAULT_SETTINGS.appearance)
 */
export function resolveVars(ap, scheme) {
  const look = LOOKS[ap.look] || LOOKS.calm;
  const accentBase = ap.accent === 'look' || !ap.accent ? null : ACCENTS[ap.accent] ? ACCENTS[ap.accent][scheme === 'dark' ? 1 : 0] : normalizeHex(ap.accent);
  const c = deriveColors(look, scheme, accentBase);
  const vars = {};
  for (const [k, v] of Object.entries(c)) vars['--' + k] = v;

  const [sm, md, lg, xl] = ap.radius && ap.radius !== 'look' ? RADII[ap.radius] || radiiOf(look.radii) : radiiOf(look.radii);
  Object.assign(vars, { '--r-sm': sm + 'px', '--r-md': md + 'px', '--r-lg': lg + 'px', '--r-xl': xl + 'px' });

  const body = FONTS[ap.font && ap.font !== 'look' ? ap.font : look.font] || FONTS.inter;
  const display = ap.font && ap.font !== 'look' ? body : FONTS[look.display] || body;
  Object.assign(vars, { '--font': body.stack, '--font-display': display.stack, '--fw-heading': String(look.headingW), '--ls-heading': look.headingLs, '--border-w': look.borderW + 'px' });

  const [s1, s2, s3] = shadows(look.shadow, scheme, { accent: c.accent, borderStrong: c['border-strong'] });
  Object.assign(vars, { '--shadow-1': s1, '--shadow-2': s2, '--shadow-3': s3 });

  const cards = ap.cards && ap.cards !== 'look' ? ap.cards : look.cards;
  const card = {
    solid: ['var(--surface)', 'var(--border)', 'var(--shadow-1)', '0px'],
    glass: ['color-mix(in srgb, var(--surface) 58%, transparent)', 'color-mix(in srgb, var(--text) 14%, transparent)', 'var(--shadow-2)', '18px'],
    outline: ['transparent', 'var(--border-strong)', 'none', '0px'],
    flat: ['var(--surface-2)', 'transparent', 'none', '0px'],
  }[cards] || [];
  Object.assign(vars, { '--card-bg': card[0], '--card-border': card[1], '--card-shadow': card[2], '--card-blur': card[3] });

  const dens = DENSITY[ap.density] || DENSITY.comfortable;
  vars['--d'] = String(dens.d); vars['--ctl-h'] = dens.ctl + 'px';
  vars['--page-bg'] = (look.pageBg && look.pageBg[scheme]) || 'none';
  vars['--ui-scale'] = String((ap.scale || 100) / 100);
  return vars;
}

/** Light or dark for the current moment, given the user's mode. */
export function pickScheme(ap, { prefersDark = false, now = new Date() } = {}) {
  if (ap.mode === 'light' || ap.mode === 'dark') return ap.mode;
  if (ap.mode === 'schedule') {
    const m = now.getHours() * 60 + now.getMinutes();
    const [dh, dm] = String(ap.schedule?.dark || '20:00').split(':').map(Number), [lh, lm] = String(ap.schedule?.light || '07:00').split(':').map(Number);
    const d = dh * 60 + dm, l = lh * 60 + lm;
    return d > l ? (m >= d || m < l ? 'dark' : 'light') : (m >= d && m < l ? 'dark' : 'light');
  }
  return prefersDark ? 'dark' : 'light';
}

const CSS_DENY = /@import|expression\s*\(|behavior\s*:|-moz-binding|url\(\s*['"]?\s*(?:https?:)?\/\//i;
/** Custom CSS is local-only: anything that could fetch a remote resource is rejected. Returns { ok, css, error }. */
export function sanitizeCustomCss(css) {
  const s = String(css || '').slice(0, 20000);
  if (CSS_DENY.test(s)) return { ok: false, css: '', error: 'remote' };
  return { ok: true, css: s };
}

/** What `theme-init.js` needs to paint the first frame without importing anything. Stored in localStorage. */
export function buildCache(ap) {
  const attrs = (scheme) => ({ 'data-look': ap.look, 'data-scheme': scheme, 'data-motion': ap.motion || 'system', 'data-density': ap.density || 'comfortable' });
  return {
    v: 1, mode: ap.mode, schedule: ap.schedule, scale: (ap.scale || 100) / 100,
    light: { vars: resolveVars(ap, 'light'), attrs: attrs('light') }, dark: { vars: resolveVars(ap, 'dark'), attrs: attrs('dark') },
    css: sanitizeCustomCss(ap.customCss).css,
  };
}

/** Exportable / shareable description of a look (only the appearance options, never data). */
export const LOOK_EXPORT_KEYS = ['look', 'mode', 'accent', 'font', 'scale', 'radius', 'density', 'cards', 'motion', 'customCss'];

/**
 * Validate an appearance object that came from outside (a shared look, a backup). Unknown keys and invalid values are
 * dropped, custom CSS is sanitised; the result is always safe to merge into settings.
 */
export function sanitizeAppearance(input) {
  const o = input && typeof input === 'object' ? input : {};
  const out = {};
  const oneOf = (v, list) => (list.includes(v) ? v : undefined);
  const set = (k, v) => { if (v !== undefined) out[k] = v; };
  set('look', oneOf(o.look, LOOK_IDS));
  set('mode', oneOf(o.mode, ['system', 'light', 'dark', 'schedule']));
  set('accent', o.accent === 'look' || ACCENTS[o.accent] ? o.accent : normalizeHex(o.accent) || undefined);
  set('font', oneOf(o.font, ['look', ...Object.keys(FONTS)]));
  set('scale', oneOf(Number(o.scale), SCALES));
  set('radius', oneOf(o.radius, ['look', ...Object.keys(RADII)]));
  set('density', oneOf(o.density, Object.keys(DENSITY)));
  set('cards', oneOf(o.cards, CARD_STYLES));
  set('motion', oneOf(o.motion, ['system', 'reduced']));
  if (typeof o.customCss === 'string') { const c = sanitizeCustomCss(o.customCss); if (c.ok) out.customCss = c.css; }
  if (o.schedule && /^\d{1,2}:\d{2}$/.test(o.schedule.dark) && /^\d{1,2}:\d{2}$/.test(o.schedule.light)) out.schedule = { dark: o.schedule.dark, light: o.schedule.light };
  return out;
}
