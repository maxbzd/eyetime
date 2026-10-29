// The widgets beyond the first fifteen (pure): what exists, its categories and sizes, and how each one's settings are validated.
// Every widget has three sizes (S, M, L). `w` = [min, max, default] width in px on the 1440 px window and `sizes` = [S, M, L]; the widget itself adapts with container queries.

export const WIDGET_CATS = ['time', 'focus', 'stats', 'tasks', 'calendar', 'body', 'style'];

/** `icon`: a Lucide name (literals, so the icon builder finds them). */
export const MORE_KINDS = {
  clock:       { cat: 'time',     icon: 'clock',          w: [140, 640, 280], sizes: [160, 280, 460] },
  date:        { cat: 'time',     icon: 'calendar-days',  w: [130, 520, 220], sizes: [140, 220, 380] },
  moon:        { cat: 'time',     icon: 'moon',           w: [130, 460, 220], sizes: [140, 220, 340] },
  sun:         { cat: 'time',     icon: 'sun',            w: [200, 600, 320], sizes: [220, 320, 500] },
  year:        { cat: 'time',     icon: 'calendar-range', w: [180, 640, 340], sizes: [200, 340, 540] },
  timer:       { cat: 'time',     icon: 'alarm-clock',    w: [150, 480, 250], sizes: [160, 250, 380] },
  focusnow:    { cat: 'focus',    icon: 'play',           w: [180, 560, 300], sizes: [190, 300, 460] },
  goal:        { cat: 'focus',    icon: 'trophy',         w: [140, 500, 240], sizes: [150, 240, 400] },
  streak:      { cat: 'focus',    icon: 'flame',          w: [140, 520, 260], sizes: [150, 260, 420] },
  heat:        { cat: 'focus',    icon: 'layout-grid',    w: [200, 700, 380], sizes: [220, 380, 600] },
  hours:       { cat: 'focus',    icon: 'sun-moon',       w: [200, 620, 340], sizes: [220, 340, 520] },
  sessions:    { cat: 'focus',    icon: 'table-2',        w: [200, 560, 300], sizes: [220, 300, 460] },
  screen:      { cat: 'stats',    icon: 'monitor',        w: [150, 520, 270], sizes: [160, 270, 420] },
  topsites:    { cat: 'stats',    icon: 'globe',          w: [200, 560, 300], sizes: [220, 300, 460] },
  distraction: { cat: 'stats',    icon: 'shield',         w: [150, 480, 250], sizes: [160, 250, 380] },
  compare:     { cat: 'stats',    icon: 'trending-up',    w: [140, 480, 240], sizes: [150, 240, 380] },
  todo:        { cat: 'tasks',    icon: 'square-check-big', w: [200, 620, 320], sizes: [220, 320, 500] },
  habit:       { cat: 'tasks',    icon: 'sprout',         w: [180, 560, 290], sizes: [200, 290, 460] },
  counter:     { cat: 'tasks',    icon: 'circle-plus',    w: [140, 480, 230], sizes: [150, 230, 380] },
  month:       { cat: 'calendar', icon: 'calendar',       w: [200, 640, 320], sizes: [230, 320, 520] },
  agenda:      { cat: 'calendar', icon: 'list-todo',      w: [200, 560, 310], sizes: [220, 310, 470] },
  weekstrip:   { cat: 'calendar', icon: 'calendar-check', w: [220, 700, 380], sizes: [240, 380, 600] },
  breath:      { cat: 'body',     icon: 'wind',           w: [150, 520, 260], sizes: [160, 260, 420] },
  water:       { cat: 'body',     icon: 'droplet',        w: [140, 480, 240], sizes: [150, 240, 380] },
  mood:        { cat: 'body',     icon: 'smile',          w: [180, 520, 280], sizes: [200, 280, 440] },
  sound:       { cat: 'body',     icon: 'volume-2',       w: [160, 520, 280], sizes: [170, 280, 420] },
  quote:       { cat: 'style',    icon: 'quote',          w: [200, 760, 400], sizes: [220, 400, 620] },
  label:       { cat: 'style',    icon: 'type',           w: [100, 900, 360], sizes: [160, 360, 640] },
  photo:       { cat: 'style',    icon: 'image',          w: [130, 560, 260], sizes: [150, 260, 440] },
  orb:         { cat: 'style',    icon: 'sparkles',       w: [100, 700, 260], sizes: [140, 260, 460] },
  links:       { cat: 'style',    icon: 'link',           w: [160, 640, 320], sizes: [180, 320, 520] },
};

/** Categories of the first fifteen widgets. */
export const OLD_CATS = { mainfocus: 'focus', rings: 'focus', recap: 'focus', plan: 'tasks', sticky: 'tasks', countdown: 'time', worldclock: 'time', percent: 'time', weather: 'time', nextevent: 'calendar', week: 'stats', bignumber: 'stats', eyebreak: 'body', mantra: 'style', stack: 'style' };

export const CLOCK_VIEWS = ['analog', 'flip', 'digital'];
export const CLOCK_FACES = ['minimal', 'ticks', 'bold', 'dots'];
export const DATE_STYLES = ['leaf', 'plain', 'bar'];
export const YEAR_VIEWS = ['dots', 'weeks', 'ring'];
export const LABEL_FONTS = ['sans', 'serif', 'mono', 'display'];
export const QUOTE_CTX = ['day', 'start', 'pause', 'rest'];
export const BREATH_PATTERNS = ['box', 'calm', 'relax'];
export const PHOTO_STYLES = ['polaroid', 'frame', 'round'];
export const ORB_PALETTES = ['aurora', 'sunset', 'ocean', 'ember', 'mono', 'candy'];
export const HEAT_WEEKS = [8, 12, 16, 26];

const str = (v, max, fallback = '') => (typeof v === 'string' ? v.slice(0, max) : fallback);
const pick = (v, list, fallback) => (list.includes(v) ? v : fallback);
const int = (v, lo, hi, fallback) => (Number.isInteger(v) ? Math.min(hi, Math.max(lo, v)) : fallback);
const dateStr = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00')) ? v : '');
const zone = (v) => { if (typeof v !== 'string' || !v || v.length > 40) return ''; try { new Intl.DateTimeFormat('en', { timeZone: v }); return v; } catch { return ''; } };

/** Defaults of a new widget's settings (kinds without any settings return {}). */
export function moreDefaultCfg(kind) {
  switch (kind) {
    case 'clock': return { view: 'analog', face: 'minimal', seconds: false, zone: '' };
    case 'date': return { style: 'leaf' };
    case 'year': return { view: 'dots' };
    case 'timer': return { minutes: 25, endsAt: 0, left: 0, title: '' };
    case 'heat': return { weeks: 16 };
    case 'topsites': return { n: 5 };
    case 'todo': return { n: 5 };
    case 'habit': return { id: '' };
    case 'counter': return { title: '', count: 0, target: 0, step: 1 };
    case 'quote': return { ctx: 'day', look: 'serif' };
    case 'month': return { weekStart: 'auto' };
    case 'agenda': return { n: 4 };
    case 'links': return { n: 8 };
    case 'label': return { text: '', font: 'sans', weight: 600, align: 'center' };
    case 'breath': return { pattern: 'box' };
    case 'water': return { day: '', n: 0, goal: 8 };
    case 'mood': return { log: {} };
    case 'photo': return { text: '', style: 'polaroid' };
    case 'orb': return { palette: 'aurora', speed: 'calm' };
    default: return {};
  }
}

/** Validate one of these widgets' settings; anything odd falls back to the default. */
export function moreNormalizeCfg(kind, cfg) {
  const c = cfg && typeof cfg === 'object' ? cfg : {}, d = moreDefaultCfg(kind);
  switch (kind) {
    case 'clock': return { view: pick(c.view, CLOCK_VIEWS, d.view), face: pick(c.face, CLOCK_FACES, d.face), seconds: c.seconds === true, zone: zone(c.zone) };
    case 'date': return { style: pick(c.style, DATE_STYLES, d.style) };
    case 'year': return { view: pick(c.view, YEAR_VIEWS, d.view) };
    case 'timer': {
      const endsAt = Number.isFinite(c.endsAt) && c.endsAt > 0 ? Math.round(c.endsAt) : 0, left = !endsAt && Number.isFinite(c.left) && c.left > 0 ? Math.round(c.left) : 0;
      return { minutes: int(c.minutes, 1, 180, d.minutes), endsAt, left, title: str(c.title, 40) };
    }
    case 'heat': return { weeks: pick(c.weeks, HEAT_WEEKS, d.weeks) };
    case 'topsites': return { n: int(c.n, 3, 8, d.n) };
    case 'todo': return { n: int(c.n, 3, 8, d.n) };
    case 'habit': return { id: str(c.id, 40) };
    case 'counter': { const target = int(c.target, 0, 99999, 0); return { title: str(c.title, 40), count: int(c.count, 0, 99999, 0), target, step: int(c.step, 1, 1000, 1) }; }
    case 'quote': return { ctx: pick(c.ctx, QUOTE_CTX, d.ctx), look: pick(c.look, ['serif', 'sans', 'mono'], d.look) };
    case 'month': return { weekStart: pick(c.weekStart, ['auto', 'mon', 'sun'], d.weekStart) };
    case 'agenda': return { n: int(c.n, 2, 6, d.n) };
    case 'links': return { n: int(c.n, 4, 12, d.n) };
    case 'label': return { text: str(c.text, 80), font: pick(c.font, LABEL_FONTS, d.font), weight: int(c.weight, 300, 800, d.weight), align: pick(c.align, ['left', 'center', 'right'], d.align) };
    case 'breath': return { pattern: pick(c.pattern, BREATH_PATTERNS, d.pattern) };
    case 'water': return { day: dateStr(c.day), n: int(c.n, 0, 40, 0), goal: int(c.goal, 1, 30, d.goal) };
    case 'mood': {
      const log = {};
      if (c.log && typeof c.log === 'object') for (const [k, v] of Object.entries(c.log).sort().slice(-30)) if (dateStr(k) && Number.isInteger(v) && v >= 1 && v <= 5) log[k] = v;
      return { log };
    }
    case 'photo': return { text: str(c.text, 60), style: pick(c.style, PHOTO_STYLES, d.style) };
    case 'orb': return { palette: pick(c.palette, ORB_PALETTES, d.palette), speed: pick(c.speed, ['calm', 'lively'], d.speed) };
    default: return {};
  }
}
