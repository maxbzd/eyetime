// Scenes and scene widgets as data (pure): what a theme author may write, and the validation that every file passes before anything is drawn.
// Nothing here is trusted: unknown node types and properties are dropped, numbers are clamped, formulas must parse and may only read the names the
// engine provides, and the size of everything is capped. A damaged or hostile file turns into a smaller, harmless scene — never into an error.

import { compile, compileTemplate, isFormula, LIMITS } from './expr.js';
import { normalizeHex } from '../color.js';

export const SCENE_FORMAT = 'eyetime-scene';
export const SCENE_VERSION = 1;
export const CAPS = { nodes: 300, widgetNodes: 100, states: 8, params: 8, stops: 8, particles: 300, listMax: 12, depth: 6, text: 200, path: 800, name: 60 };

/** Values the engine hands to formulas. `number` unless said otherwise. */
export const BINDINGS = {
  t: 'seconds since the scene started', dt: 'seconds since the last frame', W: 'width of the area in units (always 1000)', H: 'height of the area in the same units', aspect: 'width ÷ height',
  hour: '0–23', minute: '0–59', second: '0–59', dayFrac: 'the day so far, 0 at midnight → 1', weekday: '0 Sunday … 6', daylight: '0 at night → 1 at midday (from your city when set)', night: '1 when it is dark',
  mouseX: '0–1 across the window', mouseY: '0–1 down the window', reduced: '1 when reduced motion is on',
  focus: '1 while a focus session runs', focusFrac: 'how far the session is, 0–1', paused: '1 while paused', goal: 'daily goal, 0–1', goalMin: 'minutes of the goal', focusToday: 'focus minutes today', sessionsToday: 'sessions today',
  tasksOpen: 'open tasks', tasksDone: 'tasks done today', streak: 'days in a row', screenToday: 'screen minutes today',
  week: 'array: focus minutes of the last 7 days', days14: 'array: focus minutes of the last 14 days', tasks: 'array of open tasks (for a list)',
};
export const ARRAY_BINDINGS = new Set(['week', 'days14', 'tasks']);
export const ITEM_VARS = ['item.text', 'item.starred', 'item.i', 'item.n'];
export const NODE_TYPES = ['group', 'rect', 'ellipse', 'line', 'path', 'text', 'ring', 'bar', 'spark', 'list', 'particles', 'noise'];
export const BLENDS = ['normal', 'screen', 'multiply', 'overlay', 'lighten', 'plus-lighter', 'soft-light', 'color-dodge'];
export const TOKENS = ['bg', 'surface', 'text', 'text-2', 'text-3', 'accent', 'accent-text', 'accent-soft', 'border', 'border-strong', 'productive', 'distracting', 'neutral', 'success', 'warning'];
export const ACTIONS = ['focus.start', 'focus.stop', 'focus.pause', 'focus.resume', 'task.toggle', 'state.set'];

const NUM = { x: [-4000, 5000], y: [-4000, 5000], w: [0, 5000], h: [0, 5000], x1: [-4000, 5000], y1: [-4000, 5000], x2: [-4000, 5000], y2: [-4000, 5000], rot: [-3600, 3600], sc: [0, 20], op: [0, 1], sw: [0, 200], r: [0, 3000], blur: [0, 120], size: [0, 2000], ls: [-100, 400], val: [0, 1], gap: [0, 500], rowh: [1, 1000], weight: [100, 900] };
const NUM_DEFAULT = { op: 1, sc: 1, rot: 0, val: 0, weight: 400 };
const PER_TYPE = {
  group: ['x', 'y', 'rot', 'sc', 'op', 'blur', 'blend', 'show', 'on', 'children', 'w', 'h', 'clip'],
  rect: ['x', 'y', 'w', 'h', 'r', 'rot', 'sc', 'op', 'fill', 'stroke', 'sw', 'blur', 'blend', 'show', 'on', 'shadow'],
  ellipse: ['x', 'y', 'w', 'h', 'rot', 'sc', 'op', 'fill', 'stroke', 'sw', 'blur', 'blend', 'show', 'on', 'shadow'],
  line: ['x1', 'y1', 'x2', 'y2', 'op', 'stroke', 'sw', 'cap', 'dash', 'blur', 'blend', 'show'],
  path: ['x', 'y', 'rot', 'sc', 'op', 'fill', 'stroke', 'sw', 'd', 'blur', 'blend', 'show', 'on', 'cap'],
  text: ['x', 'y', 'rot', 'sc', 'op', 'fill', 'stroke', 'sw', 'text', 'size', 'weight', 'font', 'align', 'ls', 'upper', 'italic', 'blur', 'blend', 'show', 'on', 'shadow'],
  ring: ['x', 'y', 'r', 'sw', 'val', 'op', 'fill', 'track', 'cap', 'rot', 'blur', 'blend', 'show', 'on', 'start'],
  bar: ['x', 'y', 'w', 'h', 'r', 'val', 'op', 'fill', 'track', 'blur', 'blend', 'show', 'on'],
  spark: ['x', 'y', 'w', 'h', 'of', 'kind', 'op', 'fill', 'stroke', 'sw', 'blur', 'blend', 'show', 'gap'],
  list: ['x', 'y', 'w', 'of', 'max', 'rowh', 'op', 'item', 'show', 'on'],
  particles: ['x', 'y', 'w', 'h', 'n', 'size', 'speed', 'colors', 'twinkle', 'dir', 'op', 'blend', 'show', 'layer', 'seed'],
  noise: ['x', 'y', 'w', 'h', 'op', 'freq', 'blend', 'show', 'seed', 'tint'],
};
const ENUMS = { blend: BLENDS, font: ['display', 'body', 'mono'], align: ['start', 'middle', 'end'], kind: ['line', 'bars', 'dots', 'area'], cap: ['butt', 'round'], layer: ['back', 'front'], dir: ['up', 'down', 'left', 'right', 'any'] };
const COLOR_RE = /^(?:#[0-9a-fA-F]{3,8}|none|transparent|currentColor|rgba?\([\d\s.,%/]+\)|hsla?\([\d\s.,%/deg]+\))$/;
const PATH_RE = /^[MmLlHhVvCcSsQqTtAaZz0-9eE+\-., ]+$/;

/** Does a name belong to what the engine provides here? (`extra`: names a parent adds — list items, widget values.) */
export function nameAllowed(name, ctx) {
  if (Object.hasOwn(BINDINGS, name) || ctx.names.has(name)) return true;
  if (/^p\.[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return ctx.params.has(name.slice(2));
  if (/^state\.[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return ctx.states.has(name.slice(6));
  return false;
}

function formulaOk(src, ctx, template = false) {
  const c = template ? compileTemplate(src) : compile(src);
  if (!c.ok) { ctx.warn(`formula "${String(src).slice(0, 40)}": ${c.error}`); return false; }
  for (const v of c.vars) if (!nameAllowed(v, ctx)) { ctx.warn(`formula reads an unknown name "${v}"`); return false; }
  return true;
}

/** A number or a formula (`"=sin(t)"`). */
function numProp(v, key, ctx) {
  if (isFormula(v)) return formulaOk(v.slice(1), ctx) ? String(v).slice(0, LIMITS.chars + 1) : undefined;
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  const [lo, hi] = NUM[key] || [-1e6, 1e6];
  return Math.min(hi, Math.max(lo, Math.round(v * 1000) / 1000));
}

function colorValue(v, ctx) {
  if (isFormula(v)) return formulaOk(v.slice(1), ctx) ? String(v).slice(0, LIMITS.chars + 1) : undefined;
  if (typeof v !== 'string') return undefined;
  if (TOKENS.includes(v.replace(/^token:/, '')) && v.startsWith('token:')) return v; // the look's own colour, e.g. "token:accent"
  if (COLOR_RE.test(v.trim()) && v.length <= 60) return v.trim();
  const hex = normalizeHex(v); return hex || undefined;
}
function paint(v, ctx) {
  if (v && typeof v === 'object' && (v.g === 'linear' || v.g === 'radial') && Array.isArray(v.stops)) {
    const stops = [];
    for (const s of v.stops.slice(0, CAPS.stops)) {
      if (!Array.isArray(s) || typeof s[0] !== 'number') continue;
      const col = colorValue(s[1], ctx); if (col === undefined) continue;
      stops.push([Math.min(1, Math.max(0, Math.round(s[0] * 1000) / 1000)), col]);
    }
    if (stops.length < 2) return undefined;
    const g = { g: v.g, stops };
    if (v.g === 'linear') g.a = typeof v.a === 'number' ? Math.min(360, Math.max(-360, v.a)) : 90;
    else { for (const k of ['cx', 'cy', 'r']) g[k] = typeof v[k] === 'number' ? Math.min(2, Math.max(-1, v[k])) : k === 'r' ? 0.5 : 0.5; }
    return g;
  }
  return colorValue(v, ctx);
}

function action(a, ctx) {
  if (!a || typeof a !== 'object' || !ACTIONS.includes(a.do)) return undefined;
  const out = { do: a.do };
  if (a.do === 'focus.start') out.min = Math.min(240, Math.max(1, Math.round(Number(a.min) || 25)));
  if (a.do === 'state.set') { if (typeof a.name !== 'string' || !ctx.states.has(a.name)) return undefined; out.name = a.name; out.to = a.to === 0 ? 0 : 1; }
  return out;
}

function node(raw, ctx, depth) {
  if (!raw || typeof raw !== 'object' || !NODE_TYPES.includes(raw.t) || depth > CAPS.depth) return null;
  if (ctx.count >= ctx.max) { ctx.warn('too many nodes'); return null; }
  ctx.count++;
  const t = raw.t, allowed = PER_TYPE[t], out = { t };
  for (const key of allowed) {
    const v = raw[key];
    if (v === undefined) continue;
    if (key === 'children') {
      if (!Array.isArray(v)) continue;
      out.children = v.map((c) => node(c, ctx, depth + 1)).filter(Boolean);
    } else if (key === 'item') {
      const child = node(v, { ...ctx, names: new Set([...ctx.names, ...ITEM_VARS]) }, depth + 1); // list rows read item.*
      if (child) out.item = child;
    } else if (key === 'show') {
      if (typeof v === 'boolean') out.show = v; else if (isFormula(v) && formulaOk(v.slice(1), ctx)) out.show = v;
    } else if (key === 'fill' || key === 'stroke' || key === 'track' || key === 'tint') {
      const p = key === 'tint' ? colorValue(v, ctx) : paint(v, ctx); if (p !== undefined) out[key] = p;
    } else if (key === 'text') {
      if (typeof v === 'string' && v.length <= CAPS.text && formulaOk(v, ctx, true)) out.text = v;
    } else if (key === 'd') {
      if (typeof v === 'string' && v.length <= CAPS.path && PATH_RE.test(v)) out.d = v;
    } else if (key === 'of') {
      if (typeof v === 'string' && ARRAY_BINDINGS.has(v)) out.of = v;
    } else if (ENUMS[key]) {
      if (ENUMS[key].includes(v)) out[key] = v;
    } else if (key === 'on') {
      if (v && typeof v === 'object') { const a = action(v.click, ctx); if (a) out.on = { click: a }; }
    } else if (key === 'shadow') {
      if (v && typeof v === 'object') { const c = colorValue(v.color, ctx); if (c) out.shadow = { x: numProp(v.x, 'x', ctx) ?? 0, y: numProp(v.y, 'y', ctx) ?? 0, blur: Math.min(120, Math.max(0, Number(v.blur) || 0)), color: c }; }
    } else if (key === 'colors') {
      if (Array.isArray(v)) { const cs = v.slice(0, 6).map((c) => colorValue(c, ctx)).filter((c) => c !== undefined && !isFormula(c)); if (cs.length) out.colors = cs; }
    } else if (key === 'speed' || key === 'size' && t === 'particles') {
      if (Array.isArray(v)) { const r = v.slice(0, 2).map((x) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(2000, Math.max(-2000, x)) : 0)); if (r.length === 2) out[key] = r; } else if (typeof v === 'number') out[key] = [v, v];
    } else if (key === 'upper' || key === 'italic' || key === 'twinkle' || key === 'clip') {
      if (typeof v === 'boolean') out[key] = v;
    } else if (key === 'n' || key === 'max' || key === 'seed') {
      if (typeof v === 'number' && Number.isFinite(v)) out[key] = Math.round(Math.min(key === 'n' ? CAPS.particles : key === 'max' ? CAPS.listMax : 1e6, Math.max(key === 'seed' ? 0 : 1, v)));
    } else if (key === 'freq') {
      if (typeof v === 'number') out.freq = Math.min(4, Math.max(0.05, v));
    } else if (key === 'dash') {
      if (typeof v === 'string' && /^[\d.\s,]{1,24}$/.test(v)) out.dash = v;
    } else if (key === 'start') {
      if (typeof v === 'number') out.start = Math.min(360, Math.max(-360, v));
    } else {
      const n = numProp(v, key, ctx); if (n !== undefined) out[key] = n;
    }
  }
  for (const k of Object.keys(NUM_DEFAULT)) void k;
  if (t === 'list' && !out.of) out.of = 'tasks';
  if (t === 'list' && !out.item) return null;
  return out;
}

function params(raw, ctx) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, p] of Object.entries(raw).slice(0, CAPS.params)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,23}$/.test(k) || !p || typeof p !== 'object') continue;
    const label = typeof p.label === 'string' ? p.label.slice(0, 40) : k;
    if (p.type === 'color') { const c = normalizeHex(p.def); if (c) out[k] = { type: 'color', def: c, label }; }
    else if (p.type === 'number') { const lo = Number.isFinite(p.min) ? p.min : 0, hi = Number.isFinite(p.max) ? p.max : 1; out[k] = { type: 'number', min: lo, max: hi, def: Math.min(hi, Math.max(lo, Number.isFinite(p.def) ? p.def : lo)), label }; }
    else if (p.type === 'toggle') out[k] = { type: 'toggle', def: p.def ? 1 : 0, label };
  }
  void ctx;
  return out;
}

function states(raw, ctx) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, s] of Object.entries(raw).slice(0, CAPS.states)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,23}$/.test(k) || !s || typeof s !== 'object') continue;
    const st = { ease: Math.min(10, Math.max(0.05, Number(s.ease) || 0.6)) };
    if (typeof s.when === 'string') { if (formulaOk(s.when, { ...ctx, states: new Set() }) ) st.when = s.when; }
    out[k] = st;
  }
  return out;
}

function makeCtx(max, extraNames = []) {
  const warnings = [];
  return { count: 0, max, names: new Set(extraNames), params: new Set(), states: new Set(), warnings, warn: (m) => { if (warnings.length < 20) warnings.push(m); } };
}

/** Validate a scene (the world behind Home). Returns { scene, warnings }; `scene` is always safe to draw. */
export function sanitizeScene(raw) {
  const ctx = makeCtx(CAPS.nodes);
  const r = raw && typeof raw === 'object' ? raw : {};
  const ps = params(r.params, ctx); ctx.params = new Set(Object.keys(ps));
  const st = states(r.states, ctx); ctx.states = new Set(Object.keys(st));
  const layers = (Array.isArray(r.layers) ? r.layers : []).map((n) => node(n, ctx, 0)).filter(Boolean);
  const scene = { format: SCENE_FORMAT, v: SCENE_VERSION, params: ps, states: st, layers };
  if (typeof r.name === 'string') scene.name = r.name.replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, CAPS.name);
  if (r.tone === 'light' || r.tone === 'dark') scene.tone = r.tone; // the text colour that reads on it, when it is the same in every look
  const bg = r.bg !== undefined ? colorValue(r.bg, ctx) : undefined; if (bg && !isFormula(bg)) scene.bg = bg; // the colour under everything
  return { scene, warnings: ctx.warnings };
}

/** Validate a scene widget: { size: [w, h], root: [nodes] } — drawn in a box of that proportion. */
export function sanitizeUi(raw) {
  const ctx = makeCtx(CAPS.widgetNodes);
  const r = raw && typeof raw === 'object' ? raw : {};
  const ps = params(r.params, ctx); ctx.params = new Set(Object.keys(ps));
  const st = states(r.states, ctx); ctx.states = new Set(Object.keys(st));
  const size = Array.isArray(r.size) ? [Math.min(2000, Math.max(100, Number(r.size[0]) || 400)), Math.min(2000, Math.max(60, Number(r.size[1]) || 300))] : [400, 300];
  const root = (Array.isArray(r.root) ? r.root : []).map((n) => node(n, ctx, 0)).filter(Boolean);
  const ui = { size, params: ps, states: st, root };
  if (typeof r.name === 'string') ui.name = r.name.replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, CAPS.name);
  return { ui, warnings: ctx.warnings };
}

/** Values a person set for a scene's knobs: at most a few keys, each a finite number or a hex colour. */
export function sanitizeParamValues(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw).slice(0, CAPS.params)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,23}$/.test(k)) continue;
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.min(1e6, Math.max(-1e6, v));
    else { const c = normalizeHex(v); if (c) out[k] = c; }
  }
  return out;
}

/** The number of nodes in a tree (for the limits and tests). */
export const countNodes = (list) => (list || []).reduce((n, x) => n + 1 + countNodes(x.children) + (x.item ? countNodes([x.item]) : 0), 0);
