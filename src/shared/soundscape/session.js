// How loud and how busy the sound should be at a given moment. Pure.

import { clamp, smooth, lerp } from './theory.js';

/**
 * 0..1 for a focus session: it settles in over the first minutes, stays, and thins out near the end so that the end
 * does not arrive as a surprise. With no session (open-ended listening) it is steady with a slow drift.
 * @param {number} elapsed seconds since the start
 * @param {number} total   seconds in the whole session; 0 or less for none
 */
export function sessionIntensity(elapsed, total, { rampIn = 180, rampOut = 150 } = {}) {
  const drift = 0.04 * Math.sin(elapsed / 540 * Math.PI * 2); // a very slow breath, about nine minutes
  if (!(total > 0)) return clamp(0.78 + drift, 0, 1);
  const inLen = Math.min(rampIn, total * 0.25), outLen = Math.min(rampOut, total * 0.2);
  const left = total - elapsed;
  let k = 0.9;
  if (elapsed < inLen) k = lerp(0.3, 0.9, smooth(elapsed / inLen));
  else if (left < outLen) k = lerp(0.4, 0.9, smooth(left / outLen));
  return clamp(k + drift, 0, 1);
}

/** Which mood fits the moment: a running session is Focus, a break is Calm, late at night with nothing running is Sleep. */
export function modeFor({ focusing = false, resting = false, hour = 12 } = {}) {
  if (focusing) return 'focus';
  if (resting) return 'calm';
  return hour >= 22 || hour < 5 ? 'sleep' : 'calm';
}
