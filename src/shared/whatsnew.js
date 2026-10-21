// "What's new" card: shown once after an update that changes the minor (or major) version — never after a patch fix, never on first install.

const parts = (v) => { const [a, b] = String(v || '').split('.').map((x) => parseInt(x, 10)); return [a || 0, b || 0]; };

/** True when `cur` is a newer minor/major release than `prev` (2.8.0 → 2.9.0 / 3.0.0 yes; 2.8.0 → 2.8.1 no). */
export function isMinorUpdate(prev, cur) {
  if (!prev) return false;
  const [pa, pb] = parts(prev), [ca, cb] = parts(cur);
  return ca > pa || (ca === pa && cb > pb);
}

export const WN_ITEMS = ['wn.i1', 'wn.i2', 'wn.i3'];
export const RELEASES_URL = 'https://github.com/maxbzd/eyetime/releases';
