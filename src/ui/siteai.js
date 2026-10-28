// Understanding sites that are in no list, with the model that Chrome runs on this computer (the Prompt API, Gemini Nano). Opt-in and experimental.
// It is asked about the address and the title of an open tab, never the page; the answer only shapes reports (see shared/siteguess.js).
// Chrome decides whether the model exists on this computer; a download (a couple of GB) starts only when the person presses the button in Settings.

import { getDays, getSettings } from '../shared/storage.js';
import { loadGuess, saveGuess } from '../shared/guessstore.js';
import { rangeKeys } from '../shared/time.js';
import { hostFromUrl } from '../shared/domains.js';
import { makeClassifier } from '../shared/classify.js';
import { GUESS_SYSTEM, buildPrompt, parseVerdict, verdictCode, pickUnknown, GUESS_PER_RUN } from '../shared/siteguess.js';

const OPTS = { expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] };
const lm = () => /** @type {any} */ (globalThis).LanguageModel;

/** 'none' (this browser has no such model), 'unavailable' (this computer cannot run it), 'downloadable', 'downloading' or 'available'. */
export async function modelState() {
  const M = lm();
  if (!M || typeof M.availability !== 'function') return 'none';
  try { return String(await M.availability(OPTS)); } catch { try { return String(await M.availability()); } catch { return 'none'; } }
}

/** Download / load the model (call from a click). `onProgress` gets 0..1. */
/** @param {(fraction: number) => void} [onProgress] */
export async function prepareModel(onProgress = () => {}) {
  const s = await lm().create({ ...OPTS, initialPrompts: [{ role: 'system', content: GUESS_SYSTEM }], monitor: (/** @type {any} */ m) => m.addEventListener('downloadprogress', (e) => onProgress(Number(e.loaded) || 0)) });
  s.destroy?.();
}

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

/**
 * Ask about some hosts, one at a time. `titleOf(host)` gives a title or ''.
 * @returns {Promise<Record<string, { c: 'd' | 'p' | 'n', at: number }>>} only the hosts that got a clear answer
 */
/** @param {string[]} hosts @param {(host: string) => string} [titleOf] */
export async function askModel(hosts, titleOf = () => '') {
  const out = /** @type {Record<string, any>} */ ({});
  if (!hosts.length) return out;
  const base = /** @type {any} */ (await lm().create({ ...OPTS, initialPrompts: [{ role: 'system', content: GUESS_SYSTEM }] }));
  try {
    for (const host of hosts) {
      const s = /** @type {any} */ (await base.clone());
      try {
        const answer = await withTimeout(s.prompt(buildPrompt(host, titleOf(host)), { responseConstraint: { type: 'string', enum: ['distracting', 'productive', 'neutral'] }, omitResponseValueFromContext: true }), 30_000);
        const v = parseVerdict(answer);
        if (v) out[host] = { c: verdictCode(v), at: Date.now() };
      } catch { /* this one failed or timed out: it is asked again another time */ } finally { s.destroy?.(); }
    }
  } finally { base.destroy?.(); }
  return out;
}

/** On the Home page: if the person turned it on and the model is ready, learn about the few most used unknown sites of the last two days. Returns how many were learned. */
export async function autoGuess() {
  const settings = await getSettings();
  if (!settings.smartSites || !settings.smartSites.on || (await modelState()) !== 'available') return 0;
  const guess = await loadGuess(), { known } = makeClassifier(settings, guess);
  const usage = new Map();
  for (const [, day] of await getDays(rangeKeys(2))) for (const [h, sec] of Object.entries((day && day.d) || {})) usage.set(h, (usage.get(h) || 0) + sec);
  const hosts = pickUnknown([...usage], known, guess, GUESS_PER_RUN);
  if (!hosts.length) return 0;
  const titles = new Map();
  try { for (const tab of await chrome.tabs.query({})) { const h = hostFromUrl(tab.url || ''); if (h && tab.title && !titles.has(h)) titles.set(h, tab.title); } } catch { /* no tabs permission: addresses only */ }
  const got = await askModel(hosts, (h) => titles.get(h) || '');
  if (Object.keys(got).length) await saveGuess(got);
  return Object.keys(got).length;
}
