import { DEFAULT_PRESETS_ON, PRESET_IDS } from './catalog.js';

export const SCHEMA_VERSION = 3;

const presets = Object.fromEntries(PRESET_IDS.map((id) => [id, DEFAULT_PRESETS_ON.includes(id)]));

export const DEFAULT_SETTINGS = {
  language: 'auto',            // auto | en | ru | es | de | fr | pt | it | pl | uk | zh | ja
  appearance: {
    look: 'calm',              // see src/shared/looks.js
    mode: 'system',            // system | light | dark | schedule
    schedule: { dark: '20:00', light: '07:00' },
    accent: 'look',            // 'look' | preset id | '#rrggbb'
    font: 'look',              // look | inter | manrope | nunito | serif | mono | system
    scale: 100,                // interface size in %: 90 | 100 | 110 | 125
    radius: 'look',            // look | sharp | soft | round | pill
    density: 'comfortable',    // compact | comfortable | spacious
    cards: 'look',             // look | solid | glass | outline | flat
    motion: 'system',          // system | reduced
    customCss: '',
  },

  focus: {
    minutes: 25,               // last used / default length
    presets: [15, 25, 50, 90],
    strict: false,             // last used: no early exit, no bypass on the block page
    openUrl: '',               // e.g. a music page, opened when a session starts
    sound: true,               // soft chime at start / end
    suggestBreak: true,        // after a session, suggest an eye break
    breakMinutes: 5,           // rest timer that starts when a session completes (0 = off)
    longBreak: { every: 4, minutes: 15 }, // a longer rest after every Nth session of the day (every: 0 = off)
    dailyGoal: 120,            // minutes of focus per day (0 = no goal)
    streakGrace: true,         // one missed goal day in any seven does not break the goal streak
    goalDays: [1, 2, 3, 4, 5], // weekdays the goal applies to (0 = Sunday); days off neither count nor break the streak
    ambient: 'off',            // ambient sound during a session: off | brown | rain | river | forest
    scope: 'distractions',     // what a session closes: 'distractions' (sites classed distracting) | 'only-mine' (everything except productive and allowed sites)
    review: true,              // after a session: "did you finish it? how did it go?"
    reminders: [],             // [{ id, time: 'HH:MM', days: [1..5], minutes }] – a nudge to start a session
    mode: 'sprint',            // last used focus mode id
    modes: [                   // focus modes: one tap sets length, scope, strictness, sound and extra allowed sites for a session
      { id: 'deep', icon: 'brain', minutes: 50, scope: 'only-mine', strict: false, ambient: 'off', allow: [] },
      { id: 'sprint', icon: 'zap', minutes: 25, scope: 'distractions', strict: false, ambient: 'off', allow: [] },
      { id: 'study', icon: 'book-open', minutes: 45, scope: 'distractions', strict: false, ambient: 'off', allow: ['youtube.com'] },
    ],
  },

  blocking: {
    presets,
    custom: [],                // extra distracting domains
    allow: [],                 // never blocked, never "distracting"
    always: [],                // always blocked
    limits: {},                // domain -> minutes per day
    budget: { enabled: false, minutes: 30 }, // a daily allowance for ALL distracting sites together; when it is used up they are closed (with a pass)
    plans: [],                 // if-then plans shown on the pause page: [{ id, when: 'domain' | '', then: 'text' }] – implementation intentions
    friction: { enabled: true, seconds: 8, passMinutes: 10 }, // breathing pause before distracting sites
    schedule: { enabled: false, days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00', strict: false, passMinutes: 5 },
    feed: { shortLimit: true, shortMinutes: 3, hideShorts: false, hideRecs: false, hideComments: false, hideHome: false },
  },

  eye: {
    enabled: true,
    intervalMin: 20,           // of active screen time
    breakSeconds: 20,
    notify: true,
    bedtime: { enabled: false, time: '23:00', leadMin: 30 },
  },

  tracking: {
    enabled: true,
    excluded: ['localhost', '127.0.0.1'],
    idleSeconds: 60,
    countAudible: true,        // keep counting while a tab plays sound, even without input
    incognito: false,          // incognito windows are not tracked unless switched on
    badge: true,               // today's time on the toolbar icon
  },

  sites: {},                   // user overrides: domain -> productive | neutral | distracting

  newtab: {
    enabled: true,
    modules: { focus: true, today: true, tasks: true, habits: true, notes: true, links: true },
    background: 'look',        // 'look' (the look's own scene: Calm = Dawn, others = their page colour) | gradient / pattern id | 'color' | 'photo'
    bgColor: '#e9e4ff',        // used by background 'color'
    clockStyle: 'thin',        // thin | bold | mono | serif | compact | stacked | none
    layout: 'center',          // center | split | minimal
    order: ['today', 'tasks', 'habits', 'notes', 'links'],
    links: [],
    clock24: null,             // null = follow locale
    greeting: true,
    layouts: [],               // other layouts of Home that switch on by themselves (see shared/layouts.js)
    layoutPin: null,           // a layout shown until unpinned, whatever the time or focus say
    depth: { on: true, parallax: true, strength: 60 }, // layers in front of the clock and the slide against the pointer (see shared/depth.js)
    widgets: [],               // widgets added on Home: [{ id, kind, cfg }] (see shared/widgets.js)
    type: {},                  // the clock / greeting type designer (see shared/typeface.js); empty = the look's own typography
    canvas: { on: false, items: {} }, // the free-form arrangement (see shared/canvas.js); off = the look's own layout
  },

  weeklyReport: true,
  dock: { enabled: false, side: 'right', y: 0.4, hidden: [], design: 2 }, // the edge tab on web pages (needs the optional access to websites)
  calendar: { warn: true, warnMin: 2, quiet: false }, // meeting warning during a focus session; silence eye-break notices and chimes while a meeting is on
  companion: { enabled: false, token: '' },
  onboarded: false,
};

export const DEFAULT_META = { schemaVersion: SCHEMA_VERSION, installedAt: 0 };

/** Deep-merge `patch` into a clone of `base`. Arrays and non-plain values are replaced, never merged. */
export function deepMerge(base, patch) {
  if (isPlain(base) && !isPlain(patch)) return clone(base); // a damaged value (a string, a number, a list) where settings should be: the defaults stand
  if (!isPlain(base) || !isPlain(patch)) return patch === undefined ? clone(base) : clone(patch);
  const out = {};
  for (const k of new Set([...Object.keys(base), ...Object.keys(patch)])) {
    out[k] = k in patch ? (isPlain(base[k]) ? deepMerge(base[k], patch[k]) : clone(patch[k])) : clone(base[k]);
  }
  return out;
}

export const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
export const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
