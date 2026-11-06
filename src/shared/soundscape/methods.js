// A third family: very different ways of making a calm, steady sound for work. Where `engine.js` plays sparse notes and
// `rhythm.js` plays a soft pulse, each method here is a different idea of what the sound is made of:
//   noise      noise carved into chords by narrow filters that breathe
//   strings    plucked strings from a physical model (Karplus-Strong), not oscillators
//   choir      a vowel-like pad: saw stacks through formant filters, with a slow vibrato
//   tape       a few short phrases on loops of different lengths (the tape-loop idea of Brian Eno), with wow and flutter
//   shimmer    reversed swells and an octave-up halo
//   masking    only a steady, even band of noise (the way office sound masking works); no music at all
// All of it is synthesised here; nothing is recorded. Time is audio-clock seconds; `scheduleTo(until)` drives it on a live or offline context.

import { mtof, between, pick, weighted, clamp } from './theory.js';
import { CHORDS, makeRoom, brown } from './rhythm.js';

export const METHODS = [
  { id: 'noise', name: 'Шумовые аккорды', note: 'Нет нот: шум, из которого узкие фильтры вырезают тихий аккорд. Он медленно дышит' },
  { id: 'strings', name: 'Струны', note: 'Арпеджио щипковыми струнами (физическая модель), медленно, под тёмным пэдом' },
  { id: 'choir', name: 'Хор', note: 'Гласный «у-о» без слов: хоровой пэд с лёгким вибрато и медленным переходом гласных' },
  { id: 'tape', name: 'Петли', note: 'Пять коротких фраз на петлях разной длины, как у Ино: они расходятся и каждый раз складываются иначе' },
  { id: 'shimmer', name: 'Волны', note: 'Обратные «вдохи»: ноты, которые нарастают и растворяются, с мерцающим эхом на октаву выше' },
  { id: 'masking', name: 'Ровный шум', note: 'Никакой музыки: ровная полоса шума, как в офисных системах маскировки, и едва слышный бас' },
];

/** The shared plumbing: a master, a room, a clock, and a way to release everything. */
function base(ctx, rng, opts, { wet = 0.5, room = 7 } = {}) {
  const live = new Set();
  const node = (n) => { live.add(n); return n; };
  const gain = (x = 1) => { const g = node(ctx.createGain()); g.gain.value = x; return g; };
  const done = (o, ...ns) => { o.onended = () => { live.delete(o); try { o.disconnect(); ns.forEach((n) => n.disconnect()); } catch { /* gone */ } }; };
  const master = gain(0), comp = node(ctx.createDynamicsCompressor());
  comp.threshold.value = -22; comp.knee.value = 20; comp.ratio.value = 2.5; comp.attack.value = 0.03; comp.release.value = 0.5;
  master.connect(comp); comp.connect(opts.destination || ctx.destination);
  const conv = node(ctx.createConvolver()); conv.buffer = makeRoom(ctx, rng, room);
  const roomIn = gain(1), roomOut = gain(wet); roomIn.connect(conv); conv.connect(roomOut); roomOut.connect(master);
  /** A bus that goes to the master and, by `send`, to the room. */
  const bus = (send = 0.4, dry = 1) => { const i = gain(1), d = gain(dry), s = gain(send); i.connect(d); d.connect(master); i.connect(s); s.connect(roomIn); return i; };
  const T0 = ctx.currentTime + 0.4;
  let volume = clamp(opts.volume ?? 0.7, 0, 1);
  master.gain.setValueAtTime(0, ctx.currentTime); master.gain.setTargetAtTime(volume, ctx.currentTime + 0.2, 2.5);
  return { ctx, rng, node, gain, done, master, roomIn, bus, T0, live, setVolume(x) { volume = clamp(x, 0, 1); master.gain.setTargetAtTime(volume, ctx.currentTime, 0.2); } };
}

/** The harmony: C major, a chord that stays minutes. `onChord(name, def, t, len)` is called at each change. */
function harmony(b, onChord, [lo, hi] = [90, 160]) {
  let name = pick(b.rng, ['Cadd9', 'Fmaj9']), at = b.T0, end = b.T0, started = false;
  return (until) => {
    if (!started) { started = true; const len = between(b.rng, lo, hi); end = at + len; onChord(name, CHORDS[name], at, len); }
    while (end < until) { name = weighted(b.rng, CHORDS[name].next); at = end; const len = between(b.rng, lo, hi); end = at + len; onChord(name, CHORDS[name], at, len); }
  };
}

/** A quiet continuous pad under some of the methods: two sines and a triangle per note. */
function padVoices(b, out, def, t, len, level) {
  const over = Math.min(14, len * 0.2), end = t + len + over;
  def.pad.forEach((midi, i) => {
    const hz = mtof(midi);
    for (const side of [-1, 1]) {
      const o = b.node(b.ctx.createOscillator()), o2 = b.node(b.ctx.createOscillator()), g = b.gain(0), lp = b.node(b.ctx.createBiquadFilter()), pan = b.node(b.ctx.createStereoPanner());
      o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = hz; o2.frequency.value = hz; o.detune.value = side * between(b.rng, 3, 7); o2.detune.value = -side * 3;
      lp.type = 'lowpass'; lp.frequency.value = Math.max(hz * 1.4, 620); pan.pan.value = side * between(b.rng, 0.5, 0.9);
      const peak = level / Math.sqrt(def.pad.length) * (i === 0 ? 1.15 : 1);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + Math.max(2, over)); g.gain.setValueAtTime(peak, Math.max(t + over, end - over)); g.gain.linearRampToValueAtTime(0.0001, end);
      o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(pan); pan.connect(out); o.start(t); o2.start(t); o.stop(end + 0.1); o2.stop(end + 0.1); b.done(o, lp, g, pan); b.done(o2);
    }
  });
}

/* ---------------- noise: narrow filters on stereo brown noise ---------------- */
function noise(b) {
  const { ctx, rng } = b;
  const src = b.node(ctx.createBufferSource()); src.buffer = brown(ctx, rng, 16); src.loop = true; src.start(b.T0);
  const out = b.bus(0.55, 0.95), voices = [];
  for (let i = 0; i < 6; i++) {
    const bp = b.node(ctx.createBiquadFilter()), g = b.gain(0), lfo = b.node(ctx.createOscillator()), depth = b.gain(0.5);
    bp.type = 'bandpass'; bp.Q.value = 26; bp.frequency.value = 130;
    g.gain.value = 0.55; lfo.frequency.value = 1 / between(rng, 7, 19); lfo.connect(depth); depth.connect(g.gain); lfo.start(b.T0);
    src.connect(bp); bp.connect(g); g.connect(out); voices.push(bp);
  }
  return harmony(b, (name, def, t) => {
    const notes = [def.pad[0], def.pad[1], def.pad[2], def.pad[3], def.pad[4], def.pad[1] + 12];
    voices.forEach((bp, i) => { const f = mtof(notes[i]); bp.frequency.setTargetAtTime(f, t, i === 0 && t === b.T0 ? 0.001 : 5); bp.gain?.setTargetAtTime?.(1, t, 1); });
  }, [100, 170]);
}

/* ---------------- strings: Karplus-Strong ---------------- */
function ksBuffer(ctx, rng, hz, seconds = 4.5) {
  const sr = ctx.sampleRate, n = Math.max(2, Math.round(sr / hz - 0.5)), len = Math.floor(sr * seconds), buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0), ring = new Float32Array(n);
  let prev = 0; for (let i = 0; i < n; i++) { const w = rng() * 2 - 1; ring[i] = (w + prev) / 2; prev = w; } // a soft pluck
  for (let i = 0; i < len; i++) { const j = i % n, k = (j + 1) % n; d[i] = ring[j]; ring[j] = 0.9972 * 0.5 * (ring[j] + ring[k]); }
  return buf;
}
function strings(b) {
  const { ctx, rng } = b, pad = b.bus(0.5, 0.9), pl = b.bus(0.7, 0.8), cache = new Map(); let def = CHORDS.Cadd9, stepAt = b.T0, n = 0, motif = [];
  const beat = 60 / 66, step = beat / 2;
  const newMotif = () => Array.from({ length: 8 }, () => (rng() < 0.3 ? null : pick(rng, def.arp)));
  const ch = harmony(b, (name, d, t, len) => { def = d; padVoices(b, pad, d, t, len, 0.07); motif = newMotif(); }, [110, 180]);
  return (until) => {
    ch(until);
    while (stepAt < until) {
      const m = motif[n % motif.length]; if (n % 8 === 7 && rng() < 0.5) motif = motif.map((x) => (rng() < 0.12 ? pick(rng, def.arp) : x));
      if (m != null) {
        if (!cache.has(m)) cache.set(m, ksBuffer(ctx, rng, mtof(m)));
        const s = b.node(ctx.createBufferSource()), g = b.gain(0.5 + 0.3 * (n % 2 === 0 ? 1 : 0.5)), pan = b.node(ctx.createStereoPanner()), lp = b.node(ctx.createBiquadFilter());
        s.buffer = cache.get(m); lp.type = 'lowpass'; lp.frequency.value = 1600; pan.pan.value = (n % 2 ? 1 : -1) * between(rng, 0.3, 0.8);
        s.connect(lp); lp.connect(g); g.connect(pan); pan.connect(pl); s.start(stepAt); b.done(s, lp, g, pan);
      }
      n++; stepAt += step * between(rng, 0.998, 1.002);
    }
  };
}

/* ---------------- choir: formants ---------------- */
function choir(b) {
  const { ctx, rng } = b, out = b.bus(0.65, 0.9);
  // two vowel formant sets and a slow morph between them: "oo" (300, 870) and "oh" (450, 800)
  const vib = b.node(ctx.createOscillator()); vib.frequency.value = 4.6; vib.start(b.T0);
  const morph = b.node(ctx.createOscillator()); morph.frequency.value = 0.04; morph.start(b.T0);
  return harmony(b, (name, def, t, len) => {
    const over = Math.min(12, len * 0.2), end = t + len + over;
    def.pad.slice(0, 4).forEach((midi, i) => {
      const hz = mtof(midi), mix = b.gain(0), pan = b.node(ctx.createStereoPanner()); pan.pan.value = (i % 2 ? 1 : -1) * between(rng, 0.2, 0.7);
      mix.gain.setValueAtTime(0.0001, t); mix.gain.linearRampToValueAtTime(0.08, t + Math.max(3, over)); mix.gain.setValueAtTime(0.08, Math.max(t + over, end - over)); mix.gain.linearRampToValueAtTime(0.0001, end);
      const form = [[330, 1, 5], [880, 0.28, 8], [2300, 0.04, 10]].map(([f, lv, q]) => { const bp = b.node(ctx.createBiquadFilter()), g = b.gain(lv * 3); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; bp.connect(g); g.connect(mix); return bp; });
      const md = b.gain(70); morph.connect(md); md.connect(form[0].frequency); const vd = b.gain(hz * 0.006); vib.connect(vd);
      for (const cents of [-9, 0, 8]) {
        const o = b.node(ctx.createOscillator()); o.type = 'sawtooth'; o.frequency.value = hz; o.detune.value = cents + between(rng, -2, 2); vd.connect(o.frequency);
        const pre = b.gain(0.5); o.connect(pre); form.forEach((bp) => pre.connect(bp)); o.start(t); o.stop(end + 0.1); b.done(o, pre);
      }
      mix.connect(pan); pan.connect(out);
    });
  }, [70, 120]);
}

/* ---------------- tape: loops of different lengths ---------------- */
function swellBuffer(ctx, hz, seconds) {
  const sr = ctx.sampleRate, len = Math.floor(sr * seconds), buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch), det = ch ? 1.0025 : 0.9975;
    for (let i = 0; i < len; i++) {
      const t = i / sr, env = Math.min(1, t / 2.2) * Math.exp(-Math.max(0, t - 2.2) / 1.9);
      d[i] = env * (Math.sin(2 * Math.PI * hz * det * t) + 0.22 * Math.sin(2 * Math.PI * hz * 2 * det * t) + 0.06 * Math.sin(2 * Math.PI * hz * 3 * det * t));
    }
  }
  return buf;
}
function tape(b) {
  const { ctx, rng } = b, out = b.bus(0.6, 0.9);
  // tape: a short modulated delay (wow and flutter), a gentle roll-off and a little saturation
  const dly = b.node(ctx.createDelay(0.1)); dly.delayTime.value = 0.02;
  const wow = b.node(ctx.createOscillator()), wd = b.gain(0.0025), fl = b.node(ctx.createOscillator()), fd = b.gain(0.0004); wow.frequency.value = 0.45; fl.frequency.value = 5.8; wow.connect(wd); wd.connect(dly.delayTime); fl.connect(fd); fd.connect(dly.delayTime); wow.start(b.T0); fl.start(b.T0);
  const lp = b.node(ctx.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 2200; const sat = b.node(ctx.createWaveShaper()); const c = new Float32Array(257); for (let i = 0; i < 257; i++) { const x = i / 128 - 1; c[i] = Math.tanh(1.6 * x) / Math.tanh(1.6); } sat.curve = c;
  dly.connect(sat); sat.connect(lp); lp.connect(out);
  const pool = [60, 64, 67, 69, 62, 72, 55].map((m) => m + 0);
  const loops = [13.7, 17.3, 19.1, 23.9, 29.3].map((L, i) => { const midi = pool[Math.floor(rng() * pool.length)]; return { L, at: b.T0 + between(rng, 0, L), buf: swellBuffer(ctx, mtof(midi), Math.min(L - 1, 9)), gain: 0.22 }; });
  const pad = b.bus(0.5, 0.9), ch = harmony(b, (name, def, t, len) => padVoices(b, pad, def, t, len, 0.05), [110, 180]);
  return (until) => { ch(until); for (const l of loops) while (l.at < until) { const s = b.node(ctx.createBufferSource()), g = b.gain(l.gain); s.buffer = l.buf; s.connect(g); g.connect(dly); s.start(l.at); b.done(s, g); l.at += l.L; } };
}

/* ---------------- shimmer: reversed swells and an octave up ---------------- */
function shimmer(b) {
  const { ctx, rng } = b, out = b.bus(0.85, 0.7), pad = b.bus(0.5, 0.9), cache = new Map(); let def = CHORDS.Cadd9, at = b.T0 + 3;
  const ch = harmony(b, (name, d, t, len) => { def = d; padVoices(b, pad, d, t, len, 0.06); }, [110, 170]);
  const rev = (midi) => { // a plucked tone, reversed: it grows and ends in its attack
    if (cache.has(midi)) return cache.get(midi);
    const sr = ctx.sampleRate, len = Math.floor(sr * 5), buf = ctx.createBuffer(2, len, sr), hz = mtof(midi);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c), det = c ? 1.003 : 0.997; for (let i = 0; i < len; i++) { const t = (len - 1 - i) / sr; d[i] = Math.exp(-t / 1.1) * (Math.sin(2 * Math.PI * hz * det * t) + 0.3 * Math.sin(2 * Math.PI * hz * 2 * det * t) + 0.08 * Math.sin(2 * Math.PI * hz * 3 * t)); } }
    cache.set(midi, buf); return buf;
  };
  return (until) => {
    ch(until);
    while (at < until) {
      const midi = pick(rng, def.arp.filter((m) => m >= 55)), buf = rev(midi), pan = between(rng, -0.6, 0.6);
      for (const [rate, lv] of [[1, 0.22], [2, 0.07]]) { // the second copy an octave up, much quieter: the halo
        const s = b.node(ctx.createBufferSource()), g = b.gain(lv), p = b.node(ctx.createStereoPanner()); s.buffer = buf; s.playbackRate.value = rate; p.pan.value = pan * (rate === 2 ? -1 : 1);
        s.connect(g); g.connect(p); p.connect(out); s.start(at); b.done(s, g, p);
      }
      at += between(rng, 6, 15);
    }
  };
}

/* ---------------- masking: only an even band of noise ---------------- */
function masking(b) {
  const { ctx, rng } = b, out = b.bus(0.15, 1);
  const src = b.node(ctx.createBufferSource()), white = ctx.createBuffer(2, ctx.sampleRate * 12, ctx.sampleRate), br = brown(ctx, rng, 12);
  for (let c = 0; c < 2; c++) { const d = white.getChannelData(c), s = br.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = s[i] * 0.6 + (rng() * 2 - 1) * 0.12; } // tilted: more low than high
  src.buffer = white; src.loop = true;
  const hp = b.node(ctx.createBiquadFilter()), lp = b.node(ctx.createBiquadFilter()), g = b.gain(0.5), lfo = b.node(ctx.createOscillator()), d = b.gain(0.08);
  hp.type = 'highpass'; hp.frequency.value = 140; lp.type = 'lowpass'; lp.frequency.value = 3200; lfo.frequency.value = 0.05; lfo.connect(d); d.connect(g.gain);
  src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(out); src.start(b.T0); lfo.start(b.T0);
  const sub = b.node(ctx.createOscillator()), sg = b.gain(0.035); sub.type = 'sine'; sub.frequency.value = mtof(36); sub.connect(sg); sg.connect(out); sub.start(b.T0);
  return () => {};
}

const BUILD = { noise, strings, choir, tape, shimmer, masking };
const ROOMS = { noise: { wet: 0.5 }, strings: { wet: 0.55, room: 7.5 }, choir: { wet: 0.6, room: 8 }, tape: { wet: 0.5 }, shimmer: { wet: 0.7, room: 9 }, masking: { wet: 0.1, room: 2 } };

/**
 * @param {BaseAudioContext} ctx
 * @param {string} id one of METHODS
 * @param {{ rng?:()=>number, destination?:AudioNode, volume?:number }} [opts]
 */
export function createMethod(ctx, id, opts = {}) {
  const rng = opts.rng || Math.random, b = base(ctx, rng, opts, ROOMS[id] || {});
  const run = (BUILD[id] || noise)(b);
  let stopped = false, timer = null;
  const scheduleTo = (until) => { if (!stopped) run(until); };
  if (!(ctx instanceof (globalThis.OfflineAudioContext || class {}))) { scheduleTo(ctx.currentTime + 5); timer = setInterval(() => scheduleTo(ctx.currentTime + 5), 1000); }
  return {
    scheduleTo, setVolume: b.setVolume,
    stop(fadeS = 2) {
      if (stopped) return Promise.resolve(); stopped = true; if (timer) clearInterval(timer);
      b.master.gain.cancelScheduledValues(ctx.currentTime); b.master.gain.setTargetAtTime(0, ctx.currentTime, fadeS / 4);
      return new Promise((resolve) => setTimeout(() => { for (const n of b.live) { try { n.stop?.(); } catch { /* not a source */ } try { n.disconnect(); } catch { /* gone */ } } b.live.clear(); resolve(); }, fadeS * 1000 + 200));
    },
  };
}
