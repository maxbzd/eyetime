// A theme file: the look of Home (and the appearance options) as one small JSON file to keep or share (pure).
// What goes in: the appearance options, the Home settings (arrangement, widgets, type, background, depth …), the other layouts, and — only if the
// person asks — their background photo and its cut-out. What never goes in: tasks, history, links, any data about the person.
// What comes out is never trusted: every part is validated again before it touches the settings.

import { LOOK_EXPORT_KEYS, sanitizeAppearance } from './looks.js';
import { HOME_KEYS, normalizeLayouts, copyHome, MAX_LAYOUTS } from './layouts.js';
import { normalizeCanvas } from './canvas.js';
import { normalizeWidgets } from './widgets.js';
import { normalizeType } from './typeface.js';
import { normalizeDepth } from './depth.js';
import { normalizeSkin } from './skins.js';
import { normalizeHex } from './color.js';
import { PHOTO_TEXT } from './phototone.js';

export const THEME_FORMAT = 'eyetime-theme';
export const THEME_VERSION = 1;
export const THEME_MAX_CHARS = 6_000_000;
const MEDIA_MAX = { bg: 3_500_000, fg: 1_200_000 };
const MODULES = ['today', 'tasks', 'habits', 'notes', 'links'];
const CLOCKS = ['thin', 'bold', 'mono', 'serif', 'compact', 'stacked', 'none'];
const LAYOUTS = ['center', 'split', 'minimal'];

const dataUrl = (v, max, kinds) => (typeof v === 'string' && v.length <= max && new RegExp(`^data:image/(${kinds});base64,[A-Za-z0-9+/=]+$`).test(v) ? v : null);

/** Validate Home settings from outside; returns only the keys that were present and valid. */
export function sanitizeHome(h) {
  const o = h && typeof h === 'object' ? h : {};
  const out = {};
  if ('canvas' in o) out.canvas = normalizeCanvas(o.canvas);
  if ('widgets' in o) out.widgets = normalizeWidgets(o.widgets);
  if ('type' in o) out.type = normalizeType(o.type);
  if ('depth' in o) out.depth = normalizeDepth(o.depth);
  if ('dna' in o) out.dna = normalizeSkin(o.dna) || { s: 'look' };
  if (typeof o.background === 'string' && /^[a-z]{3,12}$/.test(o.background)) out.background = o.background;
  if (PHOTO_TEXT.includes(o.photoText)) out.photoText = o.photoText;
  if ('bgColor' in o) { const c = normalizeHex(o.bgColor); if (c) out.bgColor = c; }
  if (LAYOUTS.includes(o.layout)) out.layout = o.layout;
  if (CLOCKS.includes(o.clockStyle)) out.clockStyle = o.clockStyle;
  if (typeof o.greeting === 'boolean') out.greeting = o.greeting;
  if (o.modules && typeof o.modules === 'object') out.modules = Object.fromEntries(['focus', ...MODULES].map((m) => [m, o.modules[m] !== false]));
  if (Array.isArray(o.order)) out.order = [...new Set(o.order.filter((m) => MODULES.includes(m)))];
  return out;
}

/** Build the file's content from the current settings. `media` ({ bg, fg } data URLs) is included only when given. */
export function buildTheme(settings, { name = '', media = null } = {}) {
  const ap = {};
  for (const k of LOOK_EXPORT_KEYS) if (settings.appearance && k in settings.appearance) ap[k] = settings.appearance[k];
  const theme = {
    format: THEME_FORMAT, v: THEME_VERSION, name: String(name || '').slice(0, 60),
    appearance: ap, home: copyHome(settings.newtab), layouts: normalizeLayouts(settings.newtab.layouts),
  };
  if (media && (media.bg || media.fg)) theme.media = { ...(media.bg ? { bg: media.bg } : {}), ...(media.fg ? { fg: media.fg } : {}) };
  return theme;
}

/** Read a theme file: { ok: true, theme } with every part validated, or { ok: false, error }. */
export function parseTheme(text) {
  if (typeof text !== 'string' || text.length > THEME_MAX_CHARS) return { ok: false, error: 'size' };
  let raw;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: 'json' }; }
  if (!raw || typeof raw !== 'object' || raw.format !== THEME_FORMAT) return { ok: false, error: 'format' };
  if (raw.v !== THEME_VERSION) return { ok: false, error: 'version' };
  const layouts = normalizeLayouts(raw.layouts).slice(0, MAX_LAYOUTS).map((l) => ({ ...l, data: sanitizeHome(l.data) }));
  const media = {};
  const m = raw.media && typeof raw.media === 'object' ? raw.media : {};
  const bg = dataUrl(m.bg, MEDIA_MAX.bg, 'jpeg|png|webp'), fg = dataUrl(m.fg, MEDIA_MAX.fg, 'png');
  if (bg) media.bg = bg; if (bg && fg) media.fg = fg; // a cut-out belongs to its photo
  return { ok: true, theme: { name: typeof raw.name === 'string' ? raw.name.slice(0, 60) : '', appearance: sanitizeAppearance(raw.appearance), home: sanitizeHome(raw.home), layouts, media } };
}

/** Put a parsed theme into (a copy of) the settings object: appearance merged, Home keys replaced, layouts replaced. */
export function applyTheme(s, theme) {
  s.appearance = { ...s.appearance, ...theme.appearance };
  for (const k of HOME_KEYS) if (k in theme.home) s.newtab[k] = theme.home[k];
  s.newtab.layouts = theme.layouts;
  s.newtab.layoutPin = null;
  if (theme.media && theme.media.bg) s.newtab.background = 'photo';
  return s;
}
