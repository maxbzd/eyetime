// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The sound of the promo, made from nothing: no samples, no downloaded music, so there is nothing to license. Plain Node, no packages.
//   node scripts-dev/e2e/promo-sound.cjs cues.json out.wav        (demo-video.cjs --film promo calls it and joins the sound to the picture)
// cues.json is window.CUES of promo-video.html: the bar length and the moments on screen (a chip appears, the button comes in), so every sound sits under what it belongs to.
// The music: 141 BPM, C major. A clock ticks while the question is asked; on the first picture the groove drops in, and each idea adds a layer; the last bar resolves on one chord.
// Every random choice is seeded, so the same cues give the same file.
const fs = require('fs');

const [cuesPath, outPath] = process.argv.slice(2);
if (!cuesPath || !outPath) { console.error('usage: promo-sound.cjs cues.json out.wav'); process.exit(2); }
const { bar: BAR, total: TOTAL, scenes: T, cue: C } = JSON.parse(fs.readFileSync(cuesPath, 'utf8'));
const SR = 44100, N = Math.round(TOTAL * SR), BEAT = BAR / 4, Q = BAR / 8, S16 = BAR / 16;
const TAU = Math.PI * 2;

let seed = 20261113;
const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const noise = (n) => { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = rnd() * 2 - 1; return a; };
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// three buses: the music (ducked by the kick), the drums, and the effects
const bus = () => ({ l: new Float32Array(N), r: new Float32Array(N) });
const music = bus(), drums = bus(), fx = bus();
function put(b, t, x, gain = 1, pan = 0) {
  const at = Math.round(t * SR), gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < x.length; i++) { const k = at + i; if (k < 0 || k >= N) continue; b.l[k] += x[i] * gl; b.r[k] += x[i] * gr; }
}
const tone = (len, f) => { const n = Math.round(len * SR), a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = f(i / SR, i); return a; };

// a state-variable filter whose cutoff can move: type 'bp' | 'lp' | 'hp'
function svf(x, fc, damp, type) {
  const out = new Float32Array(x.length); let low = 0, band = 0;
  for (let i = 0; i < x.length; i++) {
    const f = 2 * Math.sin(Math.PI * Math.min(0.45 * SR, typeof fc === 'function' ? fc(i / x.length) : fc) / SR);
    low += f * band; const high = x[i] - low - damp * band; band += f * high;
    out[i] = type === 'lp' ? low : type === 'hp' ? high : band;
  }
  return out;
}

// ── instruments ─────────────────────────────────────────────────────────────
const kick = () => tone(0.42, (t) => { const f = 46 + 120 * Math.exp(-t / 0.022); kick.ph = (kick.ph || 0) + TAU * f / SR; return Math.sin(kick.ph) * Math.exp(-t / 0.15) * (1 - Math.exp(-t / 0.0015)); });
const kickShot = () => { kick.ph = 0; const k = kick(); const c = noise(160); for (let i = 0; i < 160; i++) k[i] += c[i] * 0.25 * Math.exp(-i / 40); return k; };
const clap = () => { const n = svf(noise(Math.round(0.22 * SR)), 1700, 1.1, 'bp'); for (let i = 0; i < n.length; i++) { const t = i / SR; n[i] *= (Math.exp(-((t) % 0.011) / 0.003) * (t < 0.033 ? 1 : 0) + 0.9 * Math.exp(-Math.max(0, t - 0.03) / 0.06)) * 1.6; } return n; };
const hat = (open) => { const n = svf(noise(Math.round((open ? 0.2 : 0.07) * SR)), 7800, 0.6, 'hp'); for (let i = 0; i < n.length; i++) n[i] *= Math.exp(-i / SR / (open ? 0.07 : 0.018)); return n; };
const tick = (low) => { const f = low ? 1500 : 2200, c = noise(400); return tone(0.09, (t, i) => (Math.sin(TAU * f * t) * 0.8 + (i < 400 ? c[i] * 0.4 : 0)) * Math.exp(-t / 0.011)); };
const bass = (f, dur) => tone(dur + 0.05, (t) => { const env = Math.min(1, t / 0.006) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.05) : 1) * (0.55 + 0.45 * Math.exp(-t / 0.18)); return (Math.sin(TAU * f * t) + 0.5 * Math.sin(TAU * 2 * f * t) + 0.22 * Math.sin(TAU * 3 * f * t) + 0.08 * Math.sin(TAU * 4 * f * t)) * env; });
const padVoice = (f, dur) => tone(dur + 0.6, (t) => { const env = Math.min(1, t / 0.4) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.6) : 1); return (Math.sin(TAU * f * 0.9977 * t) + Math.sin(TAU * f * 1.0023 * t) + 0.18 * Math.sin(TAU * 2 * f * t)) * env; });
const pluck = (f) => tone(0.8, (t) => (Math.sin(TAU * f * t) + 0.5 * Math.sin(TAU * 2 * f * t) * Math.exp(-t / 0.09) + 0.25 * Math.sin(TAU * 3 * f * t) * Math.exp(-t / 0.045)) * Math.min(1, t / 0.003) * Math.exp(-t / 0.2));
const pop = (f) => tone(0.3, (t) => (Math.sin(TAU * f * (0.88 + 0.12 * (1 - Math.exp(-t / 0.018))) * t) + 0.3 * Math.sin(TAU * 2 * f * t) * Math.exp(-t / 0.04)) * Math.min(1, t / 0.002) * Math.exp(-t / 0.075));
const bell = (f, len, tauS) => tone(len, (t) => (Math.sin(TAU * f * t) * Math.exp(-t / tauS) + 0.35 * Math.sin(TAU * 2.76 * f * t) * Math.exp(-t / (tauS * 0.5)) + 0.15 * Math.sin(TAU * 5.4 * f * t) * Math.exp(-t / (tauS * 0.25))) * Math.min(1, t / 0.002));
const boom = () => { boom.ph = 0; const b = tone(1.2, (t) => { boom.ph = (boom.ph || 0) + TAU * (36 + 40 * Math.exp(-t / 0.18)) / SR; return Math.sin(boom.ph) * Math.exp(-t / 0.42) * (1 - Math.exp(-t / 0.002)); }); return b; };
const crash = () => { const n = svf(noise(Math.round(1.1 * SR)), 5200, 0.7, 'hp'); for (let i = 0; i < n.length; i++) n[i] *= Math.exp(-i / SR / 0.32); return n; };
const riser = (dur) => { const n = svf(noise(Math.round(dur * SR)), (k) => 260 * Math.pow(26, k * k), 0.5, 'bp'); for (let i = 0; i < n.length; i++) { const k = i / n.length; n[i] *= k * k * (k > 0.97 ? (1 - k) / 0.03 : 1) * 2.2; } return n; };
const swell = (dur) => { const n = svf(noise(Math.round(dur * SR)), (k) => 500 * Math.pow(9, Math.sin(k * Math.PI)), 0.7, 'bp'); for (let i = 0; i < n.length; i++) { const k = i / n.length; n[i] *= Math.sin(k * Math.PI) * 1.6; } return n; };

// ── the score ────────────────────────────────────────────────────────────────
const CH = { Am: [57, 60, 64, 67], F: [57, 60, 64, 65], G: [59, 62, 64, 67], C: [60, 64, 67, 71], C9: [60, 64, 67, 71, 74] };
const ROOT = { Am: 33, F: 41, G: 43, C: 36, C9: 36 };
// one entry per bar: a name, or two names when the chord changes at the half bar
const PROG = [['Am'], ['F', 'G'], ['C'], ['Am'], ['F', 'G'], ['C'], ['Am'], ['F', 'G'], ['C'], ['Am'], ['F', 'G'], ['C'], ['F', 'G'], ['C9']];
const BARS = PROG.length;
const section = (b) => (b < 2 ? 'H' : b < 5 ? 'S1' : b < 8 ? 'S2' : b < 11 ? 'S3' : 'C');
const kicks = [];

for (let b = 0; b < BARS; b++) {
  const t0 = b * BAR, sec = section(b), groove = sec !== 'H' && b < BARS - 1, last = b === BARS - 1, halves = PROG[b];
  // pad: one chord under each half or whole bar
  halves.forEach((name, h) => { const dur = BAR / halves.length + (h === halves.length - 1 ? (last ? 2.5 : 0.25) : 0.12); CH[name].forEach((m, v) => put(music, t0 + h * BAR / halves.length, padVoice(hz(m), dur), last ? 0.075 : 0.05, (v - 2) * 0.18)); });

  if (sec === 'H') { for (let k = 0; k < 4; k++) if (!(b === 1 && k === 3)) put(fx, t0 + k * BEAT, tick(k % 2 === 1), 0.2, k % 2 ? 0.25 : -0.25); }
  if (!groove) continue;

  // drums
  for (let k = 0; k < 4; k++) { put(drums, t0 + k * BEAT, kickShot(), 0.72, 0); kicks.push(t0 + k * BEAT); }
  for (let k = 0; k < 8; k++) if (k % 2 === 1) put(drums, t0 + k * Q, hat(k === 3 || k === 7), 0.1, 0.3);
  const full = sec !== 'S1';
  if (full) for (const k of [1, 3]) put(drums, t0 + k * BEAT, clap(), 0.3, 0);
  if (sec === 'S2' || sec === 'S3' || sec === 'C') for (let k = 0; k < 16; k++) if (k % 2 === 0 && k % 4 !== 0) put(drums, t0 + k * S16, hat(false), 0.045, -0.35);
  const preBoundary = b === 4 || b === 7 || b === 10; // the bar before a new scene: a roll leads into it
  if (preBoundary) for (let k = 0; k < 4; k++) put(drums, t0 + 3 * BEAT + k * S16, clap(), 0.14 + 0.1 * k, 0);

  // bass: root on the one, a hop up on the "and of two"
  halves.forEach((name, h) => { const base = h * BAR / halves.length, root = hz(ROOT[name]);
    const pat = halves.length === 2 ? [[0, 2.3], [3, 0.8]] : [[0, 2.3], [3, 0.8], [4, 2.3], [7, 0.8]];
    for (const [i, len] of pat) put(music, t0 + base + i * Q, bass(i % 2 ? root * 2 : root, len * Q), 0.27, 0); });

  // arpeggio on the chord, in eighths, with a ping-pong echo; sixteenths in the last bar of the third idea
  const arp = (name, at, i16) => { const notes = CH[name], m = notes[i16 % notes.length] + 12 + (i16 % 8 >= 4 ? 12 : 0);
    for (let e = 0; e < 4; e++) put(music, at + e * 3 * S16, pluck(hz(m)), 0.13 * Math.pow(0.5, e), (e % 2 ? 1 : -1) * (0.15 + 0.12 * e)); };
  const order = [0, 2, 1, 3, 2, 3, 1, 2];
  halves.forEach((name, h) => { const n = 8 / halves.length; for (let k = 0; k < n; k++) { const i = h * n + k, at = t0 + i * Q; arp(name, at, order[i] + (sec === 'S1' ? 0 : 0)); } });
  if (b === 10) halves.forEach((name, h) => { for (let k = 0; k < 8 / halves.length; k++) { const i = h * (8 / halves.length) + k; put(music, t0 + i * Q + S16, pluck(hz(CH[name][(order[i] + 2) % 4] + 24)), 0.08, 0.4); } });
}

// the last bar: no drums, one wide chord, a root underneath, a fall of bells
{
  const t0 = (BARS - 1) * BAR, root = hz(ROOT.C9);
  put(music, t0, bass(root, 2.2), 0.3, 0); put(drums, t0, kickShot(), 0.7, 0); kicks.push(t0);
  [72, 76, 79, 83, 86].forEach((m, i) => put(music, t0 + i * S16 * 1.5, pluck(hz(m)), 0.1, (i - 2) * 0.3));
  [84, 88, 91, 95].forEach((m, i) => put(fx, t0 + 0.25 + i * 0.09, bell(hz(m), 1.4, 0.45), 0.05, (i - 1.5) * 0.4));
}

// the scene changes: a rising sweep, then a low hit and a crash on the one
for (const k of ['S1', 'S2', 'S3', 'C']) {
  const at = T[k][0];
  put(fx, at - 2 * BEAT, riser(2 * BEAT), 0.2, 0); put(fx, at - 2 * BEAT, riser(2 * BEAT), 0.12, 0.6);
  put(fx, at, boom(), 0.5, 0); put(fx, at, crash(), 0.13, 0);
}

// what happens on screen
put(fx, C.hookB, bell(hz(76), 1.2, 0.35), 0.1, -0.1); // "EyeTime shows you. Gently."
put(fx, C.chip1a, pop(hz(79)), 0.2, -0.3);
put(fx, C.chip1b, pop(hz(84)), 0.2, 0.3); put(fx, C.chip1b, bell(hz(96), 0.9, 0.3), 0.045, 0.3);
put(fx, C.chip2a, pop(hz(76)), 0.2, -0.3);
put(fx, C.win2b - 0.1, swell(0.7), 0.16, 0.2);
put(fx, C.chip2b, pop(hz(81)), 0.2, 0.3);
put(fx, C.chip3a, pop(hz(88)), 0.2, 0.3);
put(fx, C.chip3b, pop(hz(84)), 0.2, -0.3);
put(fx, C.brand, pop(hz(72)), 0.18, 0); put(fx, C.tag, pop(hz(76)), 0.18, 0);
put(fx, C.button, bell(hz(88), 1.6, 0.5), 0.14, 0); put(fx, C.button, bell(hz(95), 1.4, 0.4), 0.09, 0.2); // the call to action
[84, 88, 91, 95, 100].forEach((m, i) => put(fx, C.button + 0.12 + i * S16 * 0.8, bell(hz(m), 0.8, 0.22), 0.035, (i % 2 ? 0.5 : -0.5)));
put(fx, C.sub, pop(hz(79)), 0.1, -0.2); put(fx, C.url, pop(hz(84)), 0.12, 0.2);

// ── mix: the kick ducks the music, a soft ceiling, a fade at the end ─────────
const duck = new Float32Array(N).fill(1);
for (const t of kicks) { const at = Math.round(t * SR); for (let j = 0; j < 0.3 * SR && at + j < N; j++) duck[at + j] = Math.min(duck[at + j], 1 - 0.5 * Math.exp(-j / SR / 0.11)); }
const L = new Float32Array(N), R = new Float32Array(N), fade = 0.9 * SR;
for (let i = 0; i < N; i++) {
  const g = Math.min(1, i / (0.02 * SR)) * (i > N - fade ? Math.max(0, (N - i) / fade) : 1);
  L[i] = Math.tanh((music.l[i] * duck[i] + drums.l[i] + fx.l[i]) * 0.75) * g; R[i] = Math.tanh((music.r[i] * duck[i] + drums.r[i] + fx.r[i]) * 0.75) * g;
}

const wav = Buffer.alloc(44 + N * 4);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + N * 4, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22); wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4); wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4); }
fs.writeFileSync(outPath, wav);
console.log(`sound: ${outPath} (${TOTAL.toFixed(1)} s, ${kicks.length} kicks)`);
