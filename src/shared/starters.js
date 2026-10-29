// Ready-made Home themes ("starters") and "Surprise me": a whole look in one tap — appearance, background, clock type, card skin, widgets and where they sit.
// Pure data and functions (no DOM). Everything goes through sanitizeHome, so a starter can never put an invalid value into the settings.
// Only the ten long-standing looks are used, never one that is still being tried out.

import { sanitizeHome } from './themefile.js';
import { sanitizeAppearance } from './looks.js';
import { HOME_KEYS } from './layouts.js';
import { WIDGET_KINDS, defaultCfg } from './widgets.js';

const MODULES_OFF = { focus: false, today: false, tasks: false, habits: false, notes: false, links: false };
let n = 0;
const W = (kind, cfg = {}, skin) => ({ id: 'wst' + String(++n).padStart(3, '0'), kind, cfg: { ...defaultCfg(kind), ...cfg }, ...(skin ? { skin } : {}) });

/** Build the widget list and canvas of a starter from rows of [kind, cfg, x, y, size 0|1|2]. */
function scene(rows, /** @type {{ clock?: any, greeting?: any, quote?: any, focus?: any }} */ { clock, greeting, quote, focus } = {}) {
  const widgets = [], items = {};
  for (const [kind, cfg, x, y, size = 1] of rows) { const w = W(kind, cfg); widgets.push(w); items[w.id] = { x, y, w: WIDGET_KINDS[kind].sizes[size] }; }
  if (clock) items.clock = clock;
  if (greeting) items.greeting = greeting;
  if (quote) items.quote = quote;
  if (focus) items.focus = focus;
  return { widgets, canvas: { on: true, items } };
}

const base = (extra) => ({ layout: 'center', greeting: true, modules: { ...MODULES_OFF }, ...extra });
const clockType = (c) => ({ clock: c, text: {} });

n = 0;
const dawn = scene([['date', { style: 'plain' }, 14, 30, 1], ['todo', { n: 4 }, 86, 32, 1], ['quote', { ctx: 'day', look: 'serif' }, 50, 80, 2], ['breath', { pattern: 'calm' }, 14, 72, 0]], { clock: { x: 50, y: 38, s: 1.15 }, greeting: { x: 50, y: 56, s: 1 } });
const night = scene([['focusnow', {}, 14, 30, 1], ['goal', {}, 86, 30, 1], ['streak', {}, 14, 72, 1], ['heat', { weeks: 16 }, 86, 72, 1]], { clock: { x: 50, y: 44, s: 0.95 }, greeting: { x: 50, y: 62, s: 0.9 } });
const planner = scene([['month', {}, 14, 40, 1], ['todo', { n: 5 }, 86, 38, 1], ['habit', {}, 86, 76, 1], ['label', { text: 'Today', font: 'serif', weight: 400, align: 'center' }, 50, 20, 1]], { clock: { x: 50, y: 46, s: 1.1 }, greeting: { x: 50, y: 64, s: 1 } });
const terminal = scene([['sessions', {}, 14, 34, 1], ['topsites', { n: 5 }, 86, 34, 1], ['compare', {}, 14, 76, 1], ['counter', { title: 'Commits' }, 86, 76, 0]], { clock: { x: 50, y: 40, s: 1.2 }, greeting: { x: 50, y: 58, s: 0.9 } });
const zen = scene([['moon', {}, 14, 36, 1], ['water', {}, 86, 70, 1], ['quote', { ctx: 'rest', look: 'serif' }, 50, 80, 1], ['breath', { pattern: 'relax' }, 86, 30, 1]], { clock: { x: 50, y: 40, s: 1.3 }, greeting: { x: 50, y: 58, s: 1 } });
const glass = scene([['orb', { palette: 'aurora' }, 14, 36, 1], ['clock', { view: 'analog', face: 'minimal' }, 86, 34, 0], ['goal', {}, 14, 74, 1], ['month', {}, 86, 74, 0]], { clock: { x: 50, y: 40, s: 1.2 }, greeting: { x: 50, y: 58, s: 1 } });
const sakura = scene([['mood', {}, 14, 34, 1], ['habit', {}, 86, 34, 1], ['date', { style: 'leaf' }, 14, 74, 1], ['water', {}, 86, 72, 1]], { clock: { x: 50, y: 42, s: 1.1 }, greeting: { x: 50, y: 60, s: 1 } });
const mono = scene([['label', { text: 'Focus.', font: 'display', weight: 700, align: 'center' }, 50, 80, 2]], { clock: { x: 50, y: 40, s: 1.5 }, greeting: { x: 50, y: 60, s: 0.8 } });

/** @type {Array<{ id: string, appearance: any, home: any }>} */
export const STARTERS = [
  { id: 'dawn', appearance: { look: 'calm', mode: 'light', accent: 'look' }, home: base({ ...dawn, background: 'dawn', clockStyle: 'thin', dna: { s: 'glass' }, type: clockType({ font: 'look', weight: 200 }) }) },
  { id: 'night', appearance: { look: 'midnight', mode: 'dark', accent: 'look' }, home: base({ ...night, background: 'stars', clockStyle: 'bold', dna: { s: 'neon' }, type: clockType({ font: 'orbitron', weight: 500, glow: 0.45, tracking: 0.04 }) }) },
  { id: 'planner', appearance: { look: 'paper', mode: 'light', accent: 'look' }, home: base({ ...planner, background: 'grain', clockStyle: 'serif', dna: { s: 'paper' }, type: clockType({ font: 'fraunces', weight: 300 }) }) },
  { id: 'terminal', appearance: { look: 'terminal', mode: 'dark', accent: 'look' }, home: base({ ...terminal, background: 'grid', clockStyle: 'mono', dna: { s: 'outline' }, type: clockType({ font: 'mono', weight: 300, glow: 0.3 }) }) },
  { id: 'zen', appearance: { look: 'forest', mode: 'dark', accent: 'look' }, home: base({ ...zen, background: 'forest', clockStyle: 'thin', dna: { s: 'liquid' }, type: clockType({ font: 'instrument', weight: 400 }) }) },
  { id: 'glass', appearance: { look: 'aurora', mode: 'dark', accent: 'look' }, home: base({ ...glass, background: 'aurora', clockStyle: 'bold', dna: { s: 'liquid' }, type: clockType({ font: 'manrope', weight: 300, fill: 'gradient', color: '#9be7ff', color2: '#c9a7ff' }) }) },
  { id: 'sakura', appearance: { look: 'sakura', mode: 'light', accent: 'look' }, home: base({ ...sakura, background: 'dusk', clockStyle: 'bold', dna: { s: 'tint' }, type: clockType({ font: 'nunito', weight: 300 }) }) },
  { id: 'mono', appearance: { look: 'mono', mode: 'dark', accent: 'look' }, home: base({ ...mono, background: 'plain', clockStyle: 'thin', dna: { s: 'bare' }, type: clockType({ font: 'inter', weight: 100, tracking: -0.05 }) }) },
];
export const STARTER_IDS = STARTERS.map((s) => s.id);

/** The starter as the settings should take it: appearance validated, Home validated. */
export function starterData(starter) {
  return { appearance: sanitizeAppearance(starter.appearance), home: sanitizeHome(starter.home) };
}

/**
 * Put a starter (or any { appearance, home }) into a settings object: appearance merged, the Home keys of `target` (the Home in use) replaced.
 * Returns what was there before, so the person can take it back.
 * @param {any} s the settings (changed in place) @param {any} target the Home settings in use (`s.newtab`, or a layout's data) @param {{ appearance: any, home: any }} data
 */
export function applyStarter(s, target, data) {
  const before = { appearance: { ...s.appearance }, home: Object.fromEntries(HOME_KEYS.filter((k) => k in target).map((k) => [k, JSON.parse(JSON.stringify(target[k]))])) };
  Object.assign(s.appearance, data.appearance); // in place: `s` may be a shallow copy of the settings
  for (const k of HOME_KEYS) if (k in data.home) target[k] = JSON.parse(JSON.stringify(data.home[k]));
  return before;
}
/** Take an applied starter back. */
export function restoreHome(s, target, before) {
  for (const k of Object.keys(s.appearance)) delete s.appearance[k];
  Object.assign(s.appearance, before.appearance);
  for (const k of HOME_KEYS) if (k in before.home) target[k] = before.home[k];
}

/* ---------- Surprise me ---------- */

/** Moods that hang together: a look, a scheme, backgrounds that suit it, type and card styles. */
const MOODS = [
  { look: 'calm', mode: 'light', bg: ['dawn', 'sand', 'mesh'], clock: ['thin', 'bold', 'serif'], fonts: ['look', 'manrope', 'fraunces'], skins: ['glass', 'solid', 'tint'] },
  { look: 'midnight', mode: 'dark', bg: ['stars', 'aurora', 'mesh'], clock: ['bold', 'thin', 'mono'], fonts: ['orbitron', 'spacegrotesk', 'manrope'], skins: ['neon', 'glass', 'liquid'] },
  { look: 'paper', mode: 'light', bg: ['grain', 'sand', 'plain'], clock: ['serif', 'thin', 'compact'], fonts: ['fraunces', 'playfair', 'serif'], skins: ['paper', 'solid', 'outline'] },
  { look: 'terminal', mode: 'dark', bg: ['grid', 'dots', 'plain'], clock: ['mono', 'compact', 'bold'], fonts: ['mono', 'spacegrotesk'], skins: ['outline', 'neon', 'bare'] },
  { look: 'forest', mode: 'dark', bg: ['forest', 'peaks', 'living'], clock: ['thin', 'serif', 'bold'], fonts: ['instrument', 'manrope', 'nunito'], skins: ['liquid', 'glass', 'bare'] },
  { look: 'aurora', mode: 'dark', bg: ['aurora', 'waves', 'living'], clock: ['bold', 'thin', 'compact'], fonts: ['manrope', 'unbounded', 'inter'], skins: ['liquid', 'glass', 'tint'] },
  { look: 'sakura', mode: 'light', bg: ['dusk', 'dawn', 'mesh'], clock: ['bold', 'thin', 'compact'], fonts: ['nunito', 'rubik', 'caveat'], skins: ['tint', 'solid', 'glass'] },
  { look: 'ocean', mode: 'dark', bg: ['ocean', 'waves', 'slate'], clock: ['thin', 'bold', 'compact'], fonts: ['montserrat', 'inter', 'manrope'], skins: ['glass', 'liquid', 'outline'] },
  { look: 'sunset', mode: 'dark', bg: ['dusk', 'mesh', 'dawn'], clock: ['bold', 'thin', 'serif'], fonts: ['unbounded', 'manrope', 'playfair'], skins: ['liquid', 'tint', 'glass'] },
  { look: 'nord', mode: 'dark', bg: ['slate', 'peaks', 'plain'], clock: ['thin', 'mono', 'compact'], fonts: ['inter', 'spacegrotesk', 'mono'], skins: ['solid', 'outline', 'glass'] },
];
/** Kinds that show something at once, with no set-up, grouped so a surprise mixes them. */
const POOLS = [
  ['clock', 'date', 'moon', 'year', 'timer'],
  ['goal', 'streak', 'heat', 'hours', 'sessions', 'compare', 'topsites', 'focusnow'],
  ['todo', 'habit', 'counter', 'month', 'weekstrip'],
  ['breath', 'water', 'mood', 'quote', 'orb'],
];
/** How tall each is (px) at S and M, measured in the catalogue test; a surprise only puts a widget where it fits. */
const HEIGHT = { clock: [166, 291], date: [144, 175], moon: [215, 245], year: [191, 260], timer: [227, 374], focusnow: [219, 138], goal: [217, 288], streak: [133, 157], heat: [172, 244], hours: [165, 200], sessions: [133, 133], compare: [185, 173], topsites: [188, 188], todo: [192, 197], habit: [159, 196], counter: [141, 166], month: [219, 290], weekstrip: [81, 142], breath: [175, 265], water: [148, 164], mood: [105, 127], quote: [129, 142], orb: [158, 256] };
/** Corners: four slots 40% of the window height apart. Bottom: three slots under the greeting. `budget`: the tallest a widget may be (px) at the usual 900px height. */
const PATTERNS = [
  { slots: [[14, 30], [86, 30], [14, 70], [86, 70]], budget: 270, clock: [37, 60], maxW: 330 },
  { slots: [[22, 80], [50, 82], [78, 80]], budget: 190, clock: [34, 52], maxW: 330 },
];
/** 0 = use S, 1 = use M, -1 = does not fit. */
const sizeFor = (kind, budget, maxW) => {
  const [s, m] = HEIGHT[kind], sizes = WIDGET_KINDS[kind].sizes;
  return m <= budget && sizes[1] <= maxW ? 1 : s <= budget && sizes[0] <= maxW ? 0 : -1;
};

/** A random theme that hangs together. `rand` returns [0, 1) (inject it to test). */
export function surprise(rand = Math.random) {
  const pick = (a) => a[Math.floor(rand() * a.length) % a.length];
  const mood = pick(MOODS), pat = PATTERNS[rand() < 0.75 ? 0 : 1];
  const slots = [...pat.slots].sort(() => rand() - 0.5).slice(0, Math.min(pat.slots.length, 3 + Math.floor(rand() * 2)));
  const order = [...POOLS].sort(() => rand() - 0.5), picked = [];
  for (let i = 0; i < slots.length; i++) {
    const pool = order[i % order.length].filter((k) => !picked.some((p) => p.kind === k) && sizeFor(k, pat.budget, pat.maxW) >= 0);
    if (pool.length) { const kind = pick(pool); picked.push({ kind, size: sizeFor(kind, pat.budget, pat.maxW) }); }
  }
  n = 100 + Math.floor(rand() * 800);
  const widgets = [], items = {};
  picked.forEach(({ kind, size }, i) => { const w = W(kind); widgets.push(w); items[w.id] = { x: slots[i][0], y: slots[i][1], w: WIDGET_KINDS[kind].sizes[size] }; });
  items.clock = { x: 50, y: pat.clock[0], s: 1 + Math.floor(rand() * 2) / 10 };
  items.greeting = { x: 50, y: pat.clock[1], s: 1 };
  const font = pick(mood.fonts);
  const fill = rand() < 0.25 ? 'gradient' : 'solid';
  const home = base({
    widgets, canvas: { on: true, items }, background: pick(mood.bg), clockStyle: pick(mood.clock), dna: { s: pick(mood.skins) },
    type: clockType({ font, weight: pick([100, 200, 300, 400]), fill, ...(fill === 'gradient' ? { color: pick(['#9be7ff', '#ffb38a', '#ffd27a']), color2: pick(['#c9a7ff', '#ff8fb4', '#7ad7c0']) } : {}), glow: rand() < 0.3 ? 0.35 : 0 }),
  });
  return { id: 'surprise', appearance: { look: mood.look, mode: mood.mode, accent: 'look' }, home };
}
