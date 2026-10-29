// Layouts of Home (pure): the default arrangement plus named variants that switch on by themselves — while a focus session runs, or at certain hours.
// A layout only holds the Home settings that differ (HOME_KEYS); everything it leaves out is read from the default.

export const HOME_KEYS = ['canvas', 'widgets', 'type', 'dna', 'scene', 'sceneParams', 'background', 'frame', 'photoText', 'bgColor', 'depth', 'layout', 'clockStyle', 'greeting', 'modules', 'order'];
const HOME_SET = new Set(HOME_KEYS);
export const MAX_LAYOUTS = 8;
export const WHEN_KINDS = ['manual', 'focus', 'time'];
export const DEFAULT_ID = 'default';
export const LAYOUT_ID_RE = /^l[0-9a-z]{4,10}$/;

const clone = (o) => JSON.parse(JSON.stringify(o));
const hhmm = (v, fallback) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fallback);
export const toMinutes = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));

/** Validate the saved list: well-formed unique ids, a known trigger, only Home settings in `data`. */
export function normalizeLayouts(list) {
  const out = [], seen = new Set();
  for (const l of Array.isArray(list) ? list : []) {
    if (!l || typeof l !== 'object' || typeof l.id !== 'string' || !LAYOUT_ID_RE.test(l.id) || seen.has(l.id)) continue;
    seen.add(l.id);
    const w = l.when && typeof l.when === 'object' ? l.when : {};
    const kind = WHEN_KINDS.includes(w.kind) ? w.kind : 'manual';
    const data = {};
    if (l.data && typeof l.data === 'object') for (const k of HOME_KEYS) if (k in l.data) data[k] = l.data[k];
    out.push({ id: l.id, name: (typeof l.name === 'string' ? l.name.trim() : '').slice(0, 30) || 'Layout', when: { kind, from: hhmm(w.from, '20:00'), to: hhmm(w.to, '06:00') }, data });
    if (out.length >= MAX_LAYOUTS) break;
  }
  return out;
}

export function newLayoutId(list, rand = Math.random) {
  const used = new Set((list || []).map((l) => l.id));
  for (;;) { const id = 'l' + Math.floor(rand() * 36 ** 6).toString(36).padStart(6, '0'); if (!used.has(id)) return id; }
}

/** Is `minutes` (since midnight) inside [from, to)? A range may wrap past midnight (20:00 → 06:00); from = to means the whole day. */
export function inRange(from, to, minutes) {
  const a = toMinutes(from), b = toMinutes(to);
  if (a === b) return true;
  return a < b ? minutes >= a && minutes < b : minutes >= a || minutes < b;
}

/**
 * Which layout is on now: the pinned one, else (while focusing) the first "during focus" layout, else the first whose hours contain the time, else the default.
 * @param {ReturnType<typeof normalizeLayouts>} layouts
 * @param {{ focus: boolean, minutes: number, pin?: string | null }} ctx
 */
export function pickLayout(layouts, { focus, minutes, pin }) {
  if (pin && layouts.some((l) => l.id === pin)) return pin;
  if (focus) { const f = layouts.find((l) => l.when.kind === 'focus'); if (f) return f.id; }
  const t = layouts.find((l) => l.when.kind === 'time' && inRange(l.when.from, l.when.to, minutes));
  return t ? t.id : DEFAULT_ID;
}

/** The Home settings as the page should see them: the default's, with the layout's own values on top. */
export function effectiveHome(newtab, layout) {
  if (!layout) return newtab;
  const out = { ...newtab };
  for (const k of HOME_KEYS) if (k in layout.data) out[k] = layout.data[k];
  return out;
}

/**
 * A write-through view of the Home settings of one layout, for code that edits `s.newtab.x = …` inside updateSettings:
 * reads fall back to the default (objects are copied into the layout the first time they are touched, so changing `modules.tasks` never leaks into the default),
 * writes of Home keys land in the layout's own data, writes of other keys (links, clock24 …) go to the shared settings.
 */
export function homeView(s, id) {
  if (!id || id === DEFAULT_ID) return s.newtab;
  const layout = (s.newtab.layouts || []).find((l) => l.id === id);
  if (!layout) return s.newtab;
  if (!layout.data || typeof layout.data !== 'object') layout.data = {};
  return new Proxy(layout.data, {
    get(t, k) {
      if (typeof k !== 'string') return t[k];
      if (!HOME_SET.has(k)) return s.newtab[k];
      if (k in t) return t[k];
      const v = s.newtab[k];
      if (v && typeof v === 'object') { t[k] = clone(v); return t[k]; }
      return v;
    },
    set(t, k, v) { if (typeof k === 'string' && !HOME_SET.has(k)) s.newtab[k] = v; else t[k] = v; return true; },
    has(t, k) { return typeof k === 'string' && (HOME_SET.has(k) ? true : k in s.newtab); },
  });
}

/** A new layout that starts as a copy of the Home settings now in effect (the layout being edited, or the default). */
export function copyHome(effective) {
  const data = {};
  for (const k of HOME_KEYS) if (effective[k] !== undefined) data[k] = clone(effective[k]);
  return data;
}
