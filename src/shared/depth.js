// The depth effect of the Home scenes (pure): which scenes have layers that sit in front of the clock, and how a saved depth setting is validated.
// Back layers (the far ridges) are drawn by the scene's own CSS; the layers listed here are the ones in FRONT of the clock.
// `k` is how far (px at full strength) a layer slides against the pointer: the nearer the layer, the more it moves.

/** scene id -> the front layers, nearest last */
export const DEPTH_SCENES = {
  peaks: { front: [{ cls: 'dl-near', k: 34 }] },
  sea: { front: [{ cls: 'dl-mist', k: 16 }, { cls: 'dl-rocks', k: 30 }] },
  seaday: { front: [{ cls: 'dl-mist', k: 16 }, { cls: 'dl-rocks', k: 30 }] },
  onyx: { front: [{ cls: 'dl-limb', k: 20 }] },
};
export const DEPTH_DEFAULT = { on: true, parallax: true, strength: 60 };
/** How far the clock itself slides (px at full strength). */
export const CLOCK_SHIFT = 9;

const num = (v, lo, hi, fallback) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : fallback);

/** Validate the saved setting. */
export function normalizeDepth(d) {
  const r = d && typeof d === 'object' ? d : {};
  return { on: r.on !== false, parallax: r.parallax !== false, strength: num(r.strength, 0, 100, DEPTH_DEFAULT.strength) };
}

/** The front layers of a scene, or [] when the scene has none or the effect is off. */
export const frontLayers = (scene, depth) => (normalizeDepth(depth).on && DEPTH_SCENES[scene] ? DEPTH_SCENES[scene].front : []);

/** The CSS multiplier of the movement: 0 when parallax is off, otherwise 1 at the default strength. */
export const parallaxStrength = (depth) => { const d = normalizeDepth(depth); return d.parallax ? d.strength / DEPTH_DEFAULT.strength : 0; };
