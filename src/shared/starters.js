// Ready-made Home themes ("starters") and "Surprise me": a whole look in one tap — appearance, background, clock type, card skin, widgets and where they sit.
// Pure data and functions (no DOM). Everything goes through sanitizeHome, so a starter can never put an invalid value into the settings.
// The themes are the packs in ./packs: Frames (a real photograph, a tall clock between it and its foreground) and Mono (scenes drawn with the scene language).

import { sanitizeHome } from './themefile.js';
import { sanitizeAppearance } from './looks.js';
import { HOME_KEYS } from './layouts.js';
import { WIDGET_KINDS, defaultCfg } from './widgets.js';
import { FRAME_PACKS } from './packs/frames.js';
import { MONO_PACKS } from './packs/mono.js';

const MODULES_OFF = { focus: false, today: false, tasks: false, habits: false, notes: false, links: false };
let n = 0;
const W = (kind, cfg = {}, skin) => ({ id: 'wst' + String(++n).padStart(3, '0'), kind, cfg: { ...defaultCfg(kind), ...cfg }, ...(skin ? { skin } : {}) });

const base = (extra) => ({ layout: 'center', greeting: true, modules: { ...MODULES_OFF }, ...extra });

/** The collection: Frames (real photographs) and Mono (black-and-white scenes). Earlier experiments are parked in packs/parked and not offered. */
export const PACKS = [...FRAME_PACKS, ...MONO_PACKS];
/** @type {Array<{ id: string, appearance: any, home: any }>} */
export const STARTERS = [...PACKS];
export const STARTER_IDS = STARTERS.map((s) => s.id);

/** The starter as the settings should take it: appearance validated, Home validated. */
export function starterData(starter) {
  const ap = starter.appearance || {}, full = sanitizeAppearance(ap), appearance = {};
  for (const k of Object.keys(ap)) if (k in full) appearance[k] = full[k]; // only what the starter names: a theme that leaves the look alone leaves it alone
  return { appearance, home: sanitizeHome(starter.home) };
}

/**
 * Put a starter (or any { appearance, home }) into a settings object: appearance merged, the Home keys of `target` (the Home in use) replaced.
 * Returns what was there before, so the person can take it back.
 * @param {any} s the settings (changed in place) @param {any} target the Home settings in use (`s.newtab`, or a layout's data) @param {{ appearance: any, home: any }} data
 */
export function applyStarter(s, target, data) {
  const before = { appearance: { ...s.appearance }, home: Object.fromEntries(HOME_KEYS.filter((k) => k in target).map((k) => [k, JSON.parse(JSON.stringify(target[k]))])), clock24: s.newtab.clock24 };
  Object.assign(s.appearance, data.appearance); // in place: `s` may be a shallow copy of the settings
  for (const k of HOME_KEYS) if (k in data.home) target[k] = JSON.parse(JSON.stringify(data.home[k]));
  if ('clock24' in data.home) s.newtab.clock24 = data.home.clock24; // the 12 / 24 hour choice is shared by every layout
  return before;
}
/** Take an applied starter back. */
export function restoreHome(s, target, before) {
  for (const k of Object.keys(s.appearance)) delete s.appearance[k];
  Object.assign(s.appearance, before.appearance);
  for (const k of HOME_KEYS) if (k in before.home) target[k] = before.home[k];
  if ('clock24' in before) s.newtab.clock24 = before.clock24;
}

/* ---------- Surprise me ---------- */

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
  { slots: [[14, 30], [86, 30], [14, 70], [86, 70]], budget: 270, clock: [38, 58], maxW: 330 },
  { slots: [[22, 80], [50, 82], [78, 80]], budget: 190, clock: [37, 60], maxW: 330 },
];
/** 0 = use S, 1 = use M, -1 = does not fit. */
const sizeFor = (kind, budget, maxW) => {
  const [s, m] = HEIGHT[kind], sizes = WIDGET_KINDS[kind].sizes;
  return m <= budget && sizes[1] <= maxW ? 1 : s <= budget && sizes[0] <= maxW ? 0 : -1;
};

/**
 * A random theme that hangs together: one of the packs' background (photo or scene) and clock type, in a random scheme, with a few ordinary widgets (skinned by the pack's card style)
 * in a layout that cannot overlap. `rand` returns [0, 1) (inject it to test).
 */
export function surprise(rand = Math.random) {
  const pick = (a) => a[Math.floor(rand() * a.length) % a.length];
  const pack = pick(PACKS), pat = PATTERNS[rand() < 0.75 ? 0 : 1];
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
  const { scene, frame, background, type, dna, clockStyle, clock24 } = pack.home;
  const home = base({ widgets, canvas: { on: true, items }, background, ...(scene ? { scene } : {}), ...(frame ? { frame } : {}), ...(clock24 === undefined ? {} : { clock24 }), clockStyle, dna, type });
  return { id: 'surprise', appearance: { mode: rand() < 0.5 ? 'light' : 'dark' }, home, from: pack.id };
}
