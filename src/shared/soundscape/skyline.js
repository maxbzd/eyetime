// A fifth family, made after hearing generative.fm's "Skyline" (Alex Bainter, MIT) and liking it. What it is, in one breath: a deep
// drone made of string samples played two octaves down through a very long reverb and a dark filter, a sine bass note now and
// then, and under it a very quiet, very sparse lo-fi groove (one kick and one snare in a bar several seconds long, barely audible
// hats) whose every bar is drawn from probabilities, so no bar is the same. This file is our own implementation of that idea
// (the drums are synthesised here; the strings are the CC0 samples in src/audio/samples), not a copy of generative.fm's code.
//
// Layers can be set one by one (`setLayers`): drone, bass, drums.

import { mtof, between, clamp } from './theory.js';
import { makeRoom } from './rhythm.js';

/** @type {{ id:string, name:string, note:string, sampled:boolean, root:number, unit:number, src:('violin'|'cello')[], drums:number, kickP:number, snare:boolean, extraEvery:number, drone:number, bass:number, cutoff:number }[]} */
export const SKYLINES = [
  { id: 'skyline', name: 'В духе Skyline', note: 'Глубокий струнный гул на две октавы ниже, огромное эхо, тихий случайный грув и бас. Самое близкое к тому, что вам понравилось', sampled: true, root: 36, unit: 0.54, src: ['violin'], drums: 1, kickP: 0.2, snare: true, extraEvery: 20, drone: 1, bass: 1, cutoff: 500 },
  { id: 'skyline-soft', name: 'Skyline, тише', note: 'То же, но барабаны совсем в глубине: слышно почти только гул и лёгкое шуршание', sampled: true, root: 36, unit: 0.54, src: ['violin'], drums: 0.4, kickP: 0.1, snare: false, extraEvery: 18, drone: 1, bass: 1, cutoff: 460 },
  { id: 'skyline-cello', name: 'Skyline, виолончели', note: 'Виолончели вместе со скрипками, ниже на тон (ля), темп чуть медленнее', sampled: true, root: 33, unit: 0.6, src: ['cello', 'violin'], drums: 0.8, kickP: 0.2, snare: true, extraEvery: 22, drone: 1, bass: 1, cutoff: 520 },
  { id: 'skyline-drone', name: 'Skyline, без барабанов', note: 'Только гул и бас, ноты меняются чаще. Для самого ровного фона', sampled: true, root: 36, unit: 0.54, src: ['violin', 'cello'], drums: 0, kickP: 0, snare: false, extraEvery: 11, drone: 1.1, bass: 1, cutoff: 560 },
  { id: 'skyline-slow', name: 'Skyline, медленный', note: 'Грув вдвое медленнее и мягче, гул в фа', sampled: true, root: 29 + 12, unit: 0.75, src: ['violin'], drums: 0.9, kickP: 0.25, snare: true, extraEvery: 24, drone: 1, bass: 0.9, cutoff: 480 },
];

/**
 * @param {BaseAudioContext} ctx
 * @param {{ preset?:string, samples?:Record<string,{midi:number,buffer:AudioBuffer}[]>, rng?:()=>number, destination?:AudioNode, volume?:number, layers?:{drone?:number,bass?:number,drums?:number} }} [opts]
 */
export function createSkylineEngine(ctx, opts = {}) {
  const P = SKYLINES.find((x) => x.id === opts.preset) || SKYLINES[0];
  const rng = opts.rng || Math.random, samples = opts.samples || {};
  const layers = { drone: 1, bass: 1, drums: 1, ...(opts.layers || {}) };
  let volume = clamp(opts.volume ?? 0.7, 0, 1), stopped = false, timer = null;
  const live = new Set(), node = (n) => { live.add(n); return n; };
  const gain = (x = 1) => { const g = node(ctx.createGain()); g.gain.value = x; return g; };
  const done = (o, ...ns) => { o.onended = () => { live.delete(o); try { o.disconnect(); ns.forEach((n) => n.disconnect()); } catch { /* gone */ } }; };
  const T0 = ctx.currentTime + 0.4;

  // ---- graph ----
  const master = gain(0), limiter = node(ctx.createDynamicsCompressor());
  limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.003; limiter.release.value = 0.2;
  master.connect(limiter); limiter.connect(opts.destination || ctx.destination);
  // the drone's room: very long and dark
  const longRoom = node(ctx.createConvolver()); longRoom.buffer = makeRoom(ctx, rng, 16);
  const droneIn = gain(1), droneDry = gain(0.62), droneWet = gain(0.62), droneLayer = gain(layers.drone);
  const lp = node(ctx.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = P.cutoff; lp.Q.value = 0.7;
  droneLayer.connect(lp); lp.connect(droneIn); droneIn.connect(droneDry); droneDry.connect(master); droneIn.connect(longRoom); longRoom.connect(droneWet); droneWet.connect(master);
  // the bass
  const bassLayer = gain(layers.bass), bassPan = node(ctx.createStereoPanner()); bassPan.connect(bassLayer); bassLayer.connect(master);
  // the drums: a filter that drifts very slowly, a short room, little of it
  const drumLayer = gain(layers.drums), dlp = node(ctx.createBiquadFilter()); dlp.type = 'lowpass'; dlp.frequency.value = 3500; dlp.Q.value = 0.5;
  const slow = node(ctx.createOscillator()), slowDepth = gain(2500); slow.frequency.value = between(rng, 0.002, 0.007); slow.connect(slowDepth); slowDepth.connect(dlp.frequency); slow.start(T0);
  const shortRoom = node(ctx.createConvolver()); shortRoom.buffer = makeRoom(ctx, rng, 6); const drumWet = gain(0.2), drumDry = gain(0.9);
  drumLayer.connect(dlp); dlp.connect(drumDry); drumDry.connect(master); dlp.connect(shortRoom); shortRoom.connect(drumWet); drumWet.connect(master);
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rng() * 2 - 1; }

  master.gain.setValueAtTime(0, ctx.currentTime); master.gain.setTargetAtTime(volume, ctx.currentTime + 0.2, 4);

  // ---- voices ----
  /** A drone note: a string sample two octaves down (a slowed sample is long, grainy and warm); a plain tone if there are no samples. */
  function droneNote(t, midi) {
    const set = P.src.map((k) => samples[k]).filter(Boolean).flat();
    if (!set.length) { // fallback: two soft tones
      for (const m of [0, 0.07]) { const o = node(ctx.createOscillator()), g = gain(0.0001); o.type = 'triangle'; o.frequency.value = mtof(midi) * (1 + m * 0.01); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.2, t + 4); g.gain.linearRampToValueAtTime(0.0001, t + 14); o.connect(g); g.connect(droneLayer); o.start(t); o.stop(t + 14.2); done(o, g); }
      return;
    }
    let best = set[0]; for (const x of set) if (Math.abs(x.midi - (midi + 24)) < Math.abs(best.midi - (midi + 24))) best = x;
    const s = node(ctx.createBufferSource()), g = gain(0.0001), rate = 2 ** ((midi - best.midi) / 12), pan = node(ctx.createStereoPanner());
    s.buffer = best.buffer; s.playbackRate.value = rate; pan.pan.value = between(rng, -0.5, 0.5);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.9, t + 1.5); s.connect(g); g.connect(pan); pan.connect(droneLayer); s.start(t); done(s, g, pan);
  }

  const env = (g, t, peak, a, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  function kick(t, v) { const o = node(ctx.createOscillator()), g = gain(0.0001); o.type = 'sine'; o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.12); env(g, t, v * 1.1, 0.004, 0.5); o.connect(g); g.connect(drumLayer); o.start(t); o.stop(t + 0.6); done(o, g); }
  function snare(t, v) {
    const n = node(ctx.createBufferSource()), bp = node(ctx.createBiquadFilter()), g = gain(0.0001), o = node(ctx.createOscillator()), og = gain(0.0001);
    n.buffer = noise; bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.8; env(g, t, v * 0.9, 0.003, 0.2); n.connect(bp); bp.connect(g); g.connect(drumLayer); n.start(t, rng() * 1.5); n.stop(t + 0.3);
    o.type = 'triangle'; o.frequency.value = 190; env(og, t, v * 0.5, 0.003, 0.12); o.connect(og); og.connect(drumLayer); o.start(t); o.stop(t + 0.2); done(n, bp, g); done(o, og);
  }
  function hat(t, v) { const n = node(ctx.createBufferSource()), hp = node(ctx.createBiquadFilter()), g = gain(0.0001); n.buffer = noise; hp.type = 'highpass'; hp.frequency.value = 7000; env(g, t, v, 0.002, 0.045); n.connect(hp); hp.connect(g); g.connect(drumLayer); n.start(t, rng() * 1.5); n.stop(t + 0.08); done(n, hp, g); }

  // ---- the bar ----
  const U = P.unit, BAR = U * 8, dv = P.drums;
  let barAt = T0, droneAt = T0, extraAt = T0 + 5, lastExtra = 'A';
  function bar(t) {
    // the bass: one sine note, panned somewhere new each bar
    const o = node(ctx.createOscillator()), g = gain(0.0001); o.type = 'sine'; o.frequency.value = mtof(P.root); bassPan.pan.setValueAtTime(bassPan.pan.value, t + 1); bassPan.pan.linearRampToValueAtTime(between(rng, -1, 1), t + 3);
    g.gain.setValueAtTime(0.0001, t + 1); g.gain.linearRampToValueAtTime(0.32, t + 1.01); g.gain.setValueAtTime(0.32, t + 2); g.gain.linearRampToValueAtTime(0.0001, t + 3); o.connect(g); g.connect(bassPan); o.start(t + 1); o.stop(t + 3.1); done(o, g);
    if (!dv) return;
    const a = t + 1;
    if (rng() < 0.95) for (let i = 0; i < 32; i++) if (i % 2 === 0 || rng() < 0.1) hat(a + i * U / 4, 0.06 * dv);
    kick(a, 0.3 * dv); if (rng() < P.kickP) kick(a + U, 0.3 * dv); if (rng() < P.kickP) kick(a + 7 * U, 0.3 * dv);
    if (!P.snare || rng() < 0.1) return;
    if (rng() < 0.33) snare(a + 3.25 * U, 0.22 * dv);
    snare(a + 4 * U, 0.22 * dv);
    if (rng() < 0.05) { snare(a + 7.5 * U, 0.2 * dv); snare(a + 7.75 * U, 0.2 * dv); }
  }

  function scheduleTo(until) {
    if (stopped) return;
    for (let guard = 0; guard < 2000; guard++) {
      const next = Math.min(barAt, droneAt, extraAt);
      if (next >= until) break;
      if (next === barAt) { bar(barAt); barAt += BAR; }
      else if (next === droneAt) { droneNote(droneAt, P.root); droneAt += between(rng, 1.5, 10); }
      else { // an extra note of the key (a fifth or a sixth), now and then, sometimes an octave above
        const m = P.root + (lastExtra === 'A' || rng() < 0.6 ? 7 : 9); lastExtra = m === P.root + 7 ? 'G' : 'A';
        droneNote(extraAt, rng() < 0.2 ? m + 12 : m); extraAt += P.extraEvery + between(rng, 0, 14);
      }
    }
  }
  if (!(ctx instanceof (globalThis.OfflineAudioContext || class {}))) { scheduleTo(ctx.currentTime + 5); timer = setInterval(() => scheduleTo(ctx.currentTime + 5), 1000); }

  return {
    scheduleTo, preset: P,
    /** Levels of the layers, 0..1.5: { drone, bass, drums }. */
    setLayers(l) { Object.assign(layers, l); const now = ctx.currentTime; droneLayer.gain.setTargetAtTime(layers.drone, now, 0.3); bassLayer.gain.setTargetAtTime(layers.bass, now, 0.3); drumLayer.gain.setTargetAtTime(layers.drums, now, 0.3); },
    layers: () => ({ ...layers }),
    setVolume(x) { volume = clamp(x, 0, 1); master.gain.setTargetAtTime(volume, ctx.currentTime, 0.2); },
    stop(fadeS = 2) {
      if (stopped) return Promise.resolve(); stopped = true; if (timer) clearInterval(timer);
      master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(0, ctx.currentTime, fadeS / 4);
      return new Promise((resolve) => setTimeout(() => { for (const n of live) { try { n.stop?.(); } catch { /* not a source */ } try { n.disconnect(); } catch { /* gone */ } } live.clear(); resolve(); }, fadeS * 1000 + 200));
    },
  };
}
