// Shows a quote in a <figure class="quote"> (with <blockquote class="q-text"> and <figcaption class="q-by">), or hides the figure when quotes are off for that place.

import { getLocale } from '../shared/i18n.js';
import { dayKey } from '../shared/time.js';
import { pickQuote, renderQuote, quotesAllowed } from '../shared/quotepick.js';

const shownThisLoad = new Map(); // ctx → quote: a page that redraws keeps the quote it chose

/**
 * @param {HTMLElement | null} fig the figure
 * @param {'day' | 'start' | 'pause' | 'rest'} ctx
 * @param {{ quotes?: any }} settings
 * @returns {boolean} whether a quote is showing
 */
export function showQuote(fig, ctx, settings) {
  if (!fig) return false;
  if (!quotesAllowed(settings.quotes, ctx)) { fig.hidden = true; return false; }
  // Home and the start of a session follow "how often" (a new one each day, or each time the page opens); the pause and break pages always show a fresh one
  const daily = (ctx === 'day' || ctx === 'start') && (settings.quotes.every || 'day') === 'day';
  let q = shownThisLoad.get(ctx);
  if (!q) {
    let last = '';
    try { last = localStorage.getItem('et-quote-' + ctx) || ''; } catch { /* no storage */ }
    q = pickQuote(ctx, { seed: daily ? dayKey() + ctx : Math.random() + ':' + Date.now(), avoid: daily ? '' : last });
    if (q) shownThisLoad.set(ctx, q);
  }
  if (!q) { fig.hidden = true; return false; }
  const r = renderQuote(q, getLocale());
  fig.querySelector('.q-text').textContent = r.text;
  const by = /** @type {HTMLElement} */ (fig.querySelector('.q-by'));
  by.textContent = r.author ? '— ' + r.author : '';
  by.hidden = !r.author;
  fig.classList.toggle('is-tip', r.tip);
  fig.hidden = false;
  try { localStorage.setItem('et-quote-' + ctx, q.id); } catch { /* no storage */ }
  return true;
}
