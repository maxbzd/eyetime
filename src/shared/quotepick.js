// Choosing and writing a quote (pure). The data is in quotes.js: every language has its own version of each quote.

import { QUOTES, QUOTE_AUTHORS } from './quotes.js';

export const QUOTE_PLACES = { day: 'home', start: 'start', pause: 'pause', rest: 'rest' }; // quote context → the settings switch that allows it

/** How each language marks a quotation. */
const MARKS = { en: ['“', '”'], ru: ['«', '»'], es: ['«', '»'], de: ['„', '“'], fr: ['« ', ' »'], pt: ['«', '»'], it: ['«', '»'], pl: ['„', '”'], uk: ['«', '»'], zh: ['“', '”'], ja: ['「', '」'] };

/** A stable number from anything (day key, a random string …). */
export function hashSeed(s) {
  let h = 2166136261;
  for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * One quote for a place. The same `seed` always gives the same quote; `avoid` (the id shown last time) is skipped when there is another to show.
 * @param {'day' | 'start' | 'pause' | 'rest'} ctx
 * @param {{ seed?: string | number, avoid?: string, quotes?: typeof QUOTES }} [o]
 */
export function pickQuote(ctx, { seed = 0, avoid = '', quotes = QUOTES } = {}) {
  const pool = quotes.filter((q) => q.ctx.includes(ctx));
  if (!pool.length) return null;
  let i = hashSeed(seed) % pool.length;
  if (pool[i].id === avoid && pool.length > 1) i = (i + 1) % pool.length;
  return pool[i];
}

/** The quote as shown in `lang`: its text in quotation marks, and the author as that language writes the name (null for an EyeTime tip). */
export function renderQuote(q, lang) {
  const l = q.t[lang] ? lang : 'en';
  const [a, b] = MARKS[l] || MARKS.en;
  const by = q.by ? (QUOTE_AUTHORS[q.by] && (QUOTE_AUTHORS[q.by][l] || QUOTE_AUTHORS[q.by].en)) || null : null;
  return { id: q.id, text: q.by ? a + q.t[l] + b : q.t[l], author: by, tip: !q.by };
}

/** May this place show quotes? (`settings.quotes`: the main switch, a switch per place.) */
export const quotesAllowed = (quotes, ctx) => !!quotes && quotes.on !== false && quotes[QUOTE_PLACES[ctx]] === true;
