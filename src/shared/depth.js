// The depth effect of the Home scenes (pure): which scenes have layers that sit in front of the clock, and how a saved depth setting is validated.
// Back layers (the far ridges) are drawn by the scene's own CSS; the layers listed here are the ones in FRONT of the clock.
// `k` is how far (px at full strength) a layer slides against the pointer: the nearer the layer, the more it moves.

/** scene id -> the front layers, nearest last */
export const DEPTH_SCENES = {
  peaks: { front: [{ cls: 'dl-near', k: 34 }] },
  sea: { front: [{ cls: 'dl-mist', k: 16 }, { cls: 'dl-rocks', k: 30 }] },
  seaday: { front: [{ cls: 'dl-mist', k: 16 }, { cls: 'dl-rocks', k: 30 }] },
  onyx: { front: [{ cls: 'dl-limb', k: 20 }] },
  'photo-cut': { front: [{ cls: 'dl-photo', k: 16 }] }, // the user's own photo with its subject cut out (see cutout.js)
  'photo-3d': { front: [{ cls: 'dl-gl', k: 0 }] }, // the user's own photo as a depth map (see depth-make.js): the nearest part is drawn by WebGL in front of the clock (it moves itself, hence k 0)
};
export const DEPTH_DEFAULT = { on: true, parallax: true, strength: 60, volume: false, behind: false, cut: 72, sway: true };
/** How far the nearest part of a 3D photo slides at full pointer offset and full strength, as a share of the picture's width. */
export const GL_SHIFT_MAX = 0.09;
/** How far the clock itself slides (px at full strength). */
export const CLOCK_SHIFT = 9;

const num = (v, lo, hi, fallback) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : fallback);

/** Validate the saved setting. */
export function normalizeDepth(d) {
  const r = d && typeof d === 'object' ? d : {};
  return { on: r.on !== false, parallax: r.parallax !== false, strength: num(r.strength, 0, 100, DEPTH_DEFAULT.strength), volume: r.volume === true, behind: r.behind === true, cut: num(r.cut, 10, 95, DEPTH_DEFAULT.cut), sway: r.sway !== false };
}

/** The front layers of a scene, or [] when the scene has none or the effect is off. */
export function frontLayers(scene, depth) {
  const d = normalizeDepth(depth);
  if (!d.on || !DEPTH_SCENES[scene]) return [];
  return scene === 'photo-3d' && !d.behind ? [] : DEPTH_SCENES[scene].front; // a 3D photo has a layer in front of the clock only when the person wants the clock behind the nearest things
}

/** How far (share of the width) a 3D photo's nearest part slides at the current strength. */
export const glShift = (depth) => { const d = normalizeDepth(depth); return d.parallax ? d.strength / 100 * GL_SHIFT_MAX : 0; };

/** The CSS multiplier of the movement: 0 when parallax is off, otherwise 1 at the default strength. */
export const parallaxStrength = (depth) => { const d = normalizeDepth(depth); return d.parallax ? d.strength / DEPTH_DEFAULT.strength : 0; };
