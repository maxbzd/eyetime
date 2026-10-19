// Key-based i18n. Strings live in locales/<lang>.js as flat { "area.key": "text" } maps.
//   t('focus.start')                       -> "Start focus"
//   t('time.minutes', { n: 5 })            -> plural-aware: value may be { one, few, many, other }
//   <span data-i18n="focus.start"></span>  <input data-i18n-attr="placeholder:search.ph;aria-label:search.label">
// Add a language: create locales/xx.js (copy en.js), register it in locales/index.js. Missing keys fall back to English.

import { LOCALES, LANGUAGES } from './locales/index.js';

let lang = 'en';
let dict = LOCALES.en;
let plural = new Intl.PluralRules('en');

export { LANGUAGES };

/** 'auto' | 'en' | 'ru' | … -> a supported language code. */
export function resolveLocale(pref, uiLang) {
  if (pref && pref !== 'auto' && LOCALES[pref]) return pref;
  let ui = uiLang || '';
  if (!ui) {
    try { ui = chrome.i18n.getUILanguage(); } catch { ui = (typeof navigator !== 'undefined' && navigator.language) || 'en'; }
  }
  const base = ui.toLowerCase().split('-')[0];
  if (LOCALES[base]) return base;
  if (['uk', 'be', 'kk'].includes(base) && LOCALES.ru) return 'ru';
  return 'en';
}

export function setLocale(code) {
  lang = LOCALES[code] ? code : 'en';
  dict = LOCALES[lang];
  plural = new Intl.PluralRules(lang);
  if (typeof document !== 'undefined' && document.documentElement) document.documentElement.lang = lang;
}

export const getLocale = () => lang;

function interpolate(str, params) {
  return params ? str.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m)) : str;
}

export function t(key, params) {
  let v = dict[key] ?? LOCALES.en[key];
  if (v === undefined) return key;
  if (typeof v === 'object') v = v[plural.select(params?.n ?? 0)] ?? v.other ?? '';
  return interpolate(v, params);
}

/** Translate every [data-i18n] / [data-i18n-attr] under `root`. */
export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
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
  if (h) return m ? `${h}${t('unit.h')} ${m}${t('unit.m')}` : `${h}${t('unit.h')}`;
  if (m) return seconds && s ? `${m}${t('unit.m')} ${s}${t('unit.s')}` : `${m}${t('unit.m')}`;
  return `${s}${t('unit.s')}`;
}

/** Compact for tight UI: "1:25" style hours:minutes. */
export const fmtHM = (sec) => { const m = Math.round(sec / 60); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };

export const fmtNumber = (n, opts) => new Intl.NumberFormat(lang, opts).format(n);
export const fmtPercent = (n) => `${Math.round(n)}%`;
export const fmtDate = (d, opts = { weekday: 'long', day: 'numeric', month: 'long' }) => new Intl.DateTimeFormat(lang, opts).format(d);
export function fmtTime(d, hour12) {
  return new Intl.DateTimeFormat(lang, { hour: 'numeric', minute: '2-digit', ...(hour12 === null || hour12 === undefined ? {} : { hour12 }) }).format(d);
}
export const weekdayName = (dayIndex, style = 'short') => new Intl.DateTimeFormat(lang, { weekday: style }).format(new Date(2024, 0, 7 + dayIndex)); // 2024-01-07 is a Sunday
export const monthName = (m, style = 'short') => new Intl.DateTimeFormat(lang, { month: style }).format(new Date(2024, m, 1));
