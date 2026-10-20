// Tiny fuzzy matcher for the command palette: subsequence match with bonuses for word starts and consecutive characters.

/** score > 0 when every query character appears in order in `text`; higher is better. 0 = no match. */
export function fuzzyScore(query, text) {
  const q = String(query || '').toLowerCase().trim(), s = String(text || '').toLowerCase();
  if (!q) return 1;
  const idx = s.indexOf(q);
  if (idx >= 0) return 100 + (idx === 0 ? 50 : /\s|[-_/]/.test(s[idx - 1]) ? 30 : 0) - Math.min(40, s.length - q.length);
  let score = 0, pos = 0, streak = 0;
  for (const ch of q) {
    if (ch === ' ') continue;
    const at = s.indexOf(ch, pos);
    if (at < 0) return 0;
    streak = at === pos ? streak + 1 : 0;
    score += 1 + streak * 2 + (at === 0 || /\s|[-_/]/.test(s[at - 1]) ? 4 : 0);
    pos = at + 1;
  }
  return score;
}

/** Rank items by their best-matching `keys(item)` string. Stable for equal scores. */
export function rank(query, items, keys = (x) => [x.label]) {
  return items
    .map((item, i) => ({ item, i, score: Math.max(0, ...keys(item).map((k) => fuzzyScore(query, k))) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((r) => r.item);
}
