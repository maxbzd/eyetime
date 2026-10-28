// Sites that are in no list: what the on-device language model is asked, how its answer is read, and how the guesses are kept (pure, so it can be tested).
// Only the address (host) and the title of an open tab go to the model, which runs inside the browser (Chrome's built-in Gemini Nano); the page itself is never read.
// A guess is used for reports only (Insights, the day's totals): it never blocks anything and a person's own choice always wins.

export const GUESS_MAX = 400;
export const GUESS_TTL = 60 * 86_400_000;
export const GUESS_PER_RUN = 4;

export const GUESS_SYSTEM = 'You sort websites for a focus and screen-time app. For each message you get a website address and sometimes a page title. '
  + 'Answer with exactly one word: "distracting" if the site is mainly entertainment, social media, short videos, memes, games, gossip, shopping for fun or endless news feeds; '
  + '"productive" if it is mainly for work, study, writing, coding, documentation, research, design, email or learning; "neutral" if it is neither or you are not sure. Never explain.';

const clean = (s, max) => String(s || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/** The text sent to the model for one site: the address, and the title when there is one. */
export function buildPrompt(host, title) {
  const t = clean(title, 140);
  return `Website: ${clean(host, 100)}` + (t ? `\nPage title: ${t}` : '');
}

/** The model's answer → 'distracting' | 'productive' | 'neutral' | null (anything else, so a rambling or empty answer is dropped). */
export function parseVerdict(text) {
  const w = String(text || '').trim().toLowerCase().replace(/^["'`\s]+|["'`.\s]+$/g, '');
  return w === 'distracting' || w === 'productive' || w === 'neutral' ? w : null;
}

/** What is kept for a verdict: 'd' or 'p'. Neutral needs no entry (an unknown site is neutral anyway), but is remembered as 'n' so it is not asked again. */
export const verdictCode = (v) => (v === 'distracting' ? 'd' : v === 'productive' ? 'p' : 'n');

/** Validate the saved map { host: { c: 'd' | 'p' | 'n', at } }: bad entries and old ones go, the newest GUESS_MAX stay. */
export function normalizeGuess(raw, now = Date.now()) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  const rows = [];
  for (const [host, v] of Object.entries(raw)) {
    if (!host || host.length > 120 || !v || typeof v !== 'object' || !['d', 'p', 'n'].includes(v.c) || !Number.isFinite(v.at) || now - v.at > GUESS_TTL) continue;
    rows.push([host, { c: v.c, at: v.at }]);
  }
  rows.sort((a, b) => b[1].at - a[1].at);
  for (const [host, v] of rows.slice(0, GUESS_MAX)) out[host] = v;
  return out;
}

/** The classifier rules for the guesses (below every list and every personal choice). */
export const guessRules = (guess) => Object.entries(guess || {}).filter(([, v]) => v.c !== 'n').map(([domain, v]) => ({ domain, cls: v.c === 'd' ? 'distracting' : 'productive', prio: 0 }));

const SKIP = /^(localhost|\?|.*\.local|.*\.internal|chrome|about|newtab)$/;
/**
 * Which hosts to ask about: the ones used most, that no list knows and that have no guess yet; not addresses of this computer or numbers.
 * @param {Array<[string, number]>} usage host / seconds @param {(host: string) => boolean} known @param {Record<string, any>} guess
 */
export function pickUnknown(usage, known, guess, limit = GUESS_PER_RUN) {
  return usage.filter(([h, s]) => s >= 30 && h && !SKIP.test(h) && !/^[\d.:]+$/.test(h) && !h.includes('[') && !known(h) && !(guess && guess[h])).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([h]) => h);
}
