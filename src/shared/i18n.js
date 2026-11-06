// Key-based i18n. Strings live in locales/<lang>.js as flat { "area.key": "text" } maps.
//   t('focus.start')                       -> "Start focus"
//   t('time.minutes', { n: 5 })            -> plural-aware: value may be { one, few, many, other }
//   <span data-i18n="focus.start"></span>  <input data-i18n-attr="placeholder:search.ph;aria-label:search.label">
// Add a language: create locales/xx.js (copy en.js), register it in locales/index.js and locales/languages.js, run `node scripts-dev/build-locales.mjs`.
// Missing keys fall back to English.
//
// Only the language in use is loaded: English is code (it is the fallback), every other language is a JSON file in locales/data/ that is
// read once (a page needs one language, and the service worker cannot `import()`, so data is the one way that works in all of them).
// `await setLocale(code)` before the first `t()` of a page or of a worker task.

import { en } from './locales/en.js';
import { LANGUAGES } from './locales/languages.js';

/** @type {Record<string, Record<string, any>>} */
const loaded = { en };
/** @type {Map<string, Promise<Record<string, any> | null>>} */
const loading = new Map();
let lang = 'en';
/** @type {Record<string, any>} */
let dict = en;
let plural = new Intl.PluralRules('en');

export { LANGUAGES };

const supported = (/** @type {any} */ code) => typeof code === 'string' && Object.hasOwn(LANGUAGES, code);

/** 'auto' | 'en' | 'ru' | … -> a supported language code. */
export function resolveLocale(pref, uiLang) {
  if (pref && pref !== 'auto' && supported(pref)) return pref;
  let ui = uiLang || '';
  if (!ui) {
    try { ui = chrome.i18n.getUILanguage(); } catch { ui = (typeof navigator !== 'undefined' && navigator.language) || 'en'; }
  }
  const base = ui.toLowerCase().split(/[-_]/)[0]; // zh-TW / zh-HK get Simplified Chinese too: closer to them than English
  if (supported(base)) return base;
  if (['be', 'kk'].includes(base) && supported('ru')) return 'ru';
  return 'en';
}

/** The words of one language, read once: from the extension's own file in a browser, from the module in Node (the tests). null if it cannot be read. */
async function readLocale(/** @type {string} */ code) {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
      const res = await fetch(chrome.runtime.getURL(`src/shared/locales/data/${code}.json`));
      return res.ok ? await res.json() : null;
    }
    return (await import('./locales/index.js')).LOCALES[code] || null;
  } catch { return null; }
}

/** Makes `code` the language of `t()` and the formatters. Resolves when its words are in; if they cannot be read, English stays. */
export async function setLocale(code) {
  let next = supported(code) ? code : 'en';
  if (!loaded[next]) {
    if (!loading.has(next)) loading.set(next, readLocale(next));
    const words = await loading.get(next);
    loading.delete(next);
    if (words) loaded[next] = words; else next = 'en';
  }
  lang = next;
  dict = loaded[next];
  plural = new Intl.PluralRules(lang);
  if (typeof document !== 'undefined' && document.documentElement) document.documentElement.lang = lang;
}

export const getLocale = () => lang;

function interpolate(str, params) {
  return params ? str.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m)) : str;
}

export function t(key, params) {
  let v = dict[key] ?? en[key];
  if (v === undefined) return key;
  if (typeof v === 'object') v = v[plural.select(params?.n ?? 0)] ?? v.other ?? '';
  return interpolate(v, params);
}

/** Translate every [data-i18n] / [data-i18n-attr] under `root`. */
export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(/** @type {HTMLElement} */ (el).dataset.i18n); });
  root.querySelectorAll('[data-i18n-attr]').forEach((/** @type {Element} */ node) => {
    const el = /** @type {HTMLElement} */ (node);
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    }
  });
  if (root === document && document.documentElement.dataset.i18nTitle) document.title = t(document.documentElement.dataset.i18nTitle);
}

/* ---------- formatting ---------- */

/** "1h 25m" / "45m" / "30s" — unit words come from the locale. */
export function fmtDuration(sec, { seconds = false } = {}) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h) return m ? `${h}${t('unit.h')}\u00a0${m}${t('unit.m')}` : `${h}${t('unit.h')}`;
  if (m) return seconds && s ? `${m}${t('unit.m')}\u00a0${s}${t('unit.s')}` : `${m}${t('unit.m')}`;
  return `${s}${t('unit.s')}`;
}

/** Compact for tight UI: "1:25" style hours:minutes. */
export const fmtHM = (sec) => { const m = Math.round(sec / 60); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };

export const fmtNumber = (n, opts) => new Intl.NumberFormat(lang, opts).format(n);
export const fmtPercent = (n) => `${Math.round(n)}%`;
/** @param {Date} d @param {Intl.DateTimeFormatOptions} [opts] */
export const fmtDate = (d, opts = { weekday: 'long', day: 'numeric', month: 'long' }) => new Intl.DateTimeFormat(lang, opts).format(d);
/** `clock24`: true = 24-hour, false = 12-hour, null/undefined = follow the language. */
export function fmtTime(d, clock24, seconds = false) {
  /** @type {Intl.DateTimeFormatOptions} */
  const pick = clock24 === null || clock24 === undefined ? {} : clock24 ? { hourCycle: 'h23' } : { hour12: true };
  return new Intl.DateTimeFormat(lang, { hour: 'numeric', minute: '2-digit', ...(seconds ? { second: '2-digit' } : {}), ...pick }).format(d);
}
/** @param {number} dayIndex 0 = Sunday @param {'long'|'short'|'narrow'} [style] */
export const weekdayName = (dayIndex, style = 'short') => new Intl.DateTimeFormat(lang, { weekday: style }).format(new Date(2024, 0, 7 + dayIndex)); // 2024-01-07 is a Sunday
/** @param {number} m 0-based month @param {'long'|'short'|'narrow'|'numeric'|'2-digit'} [style] */
export const monthName = (m, style = 'short') => new Intl.DateTimeFormat(lang, { month: style }).format(new Date(2024, m, 1));
