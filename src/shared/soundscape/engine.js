// The sound itself: turns the conductor's events into Web Audio. No files, no libraries: everything is synthesised, so
// the package stays small and there is nothing to license. It works on a live AudioContext (the offscreen document) and on
// an OfflineAudioContext (the preview renderer and the tests), the same way.
//
//   pad      slow chords: two detuned saws and a triangle per note through a low-pass that breathes
//   notes    soft struck tones (additive partials) that ring out into a long room
//   pulse    a very quiet low pluck on the beat, in Focus only
//   air      brown noise through a band-pass that wanders
//   room     a generated reverb and a dark echo shared by everything

import { createConductor } from './conductor.js';
import { mtof, between, lerp, clamp } from './theory.js';

const LOOKAHEAD_S = 5;      // events are scheduled this far ahead of the audio clock
const TICK_MS = 1000;
const TIMBRES = {
  // [partial ratio, level, decay share]
  felt: { att: 0.02, inharm: 0.0004, partials: [[1, 1, 1], [2, 0.38, 0.6], [3, 0.14, 0.4], [4, 0.07, 0.3], [5, 0.03, 0.2]], bright: 3200 },
  glass: { att: 0.006, inharm: 0, partials: [[1, 1, 1], [2.76, 0.26, 0.55], [5.4, 0.11, 0.3], [8.93, 0.04, 0.2]], bright: 6000 },
};

/** A room: a decaying stereo noise that gets darker as it fades, like air absorbing the highs. */
function makeRoom(ctx, rng, seconds = 6) {
  const rate = ctx.sampleRate, len = Math.floor(rate * seconds), buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const k = lerp(0.9, 0.08, Math.sqrt(t)); // one-pole low-pass, closing over time
      lp += k * ((rng() * 2 - 1) - lp);
      d[i] = lp * (1 - t) ** 3.4 * (i < rate * 0.02 ? i / (rate * 0.02) : 1);
    }
  }
  return buf;
}

function brownNoise(ctx, rng, seconds = 10) {
  const len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(2, len, ctx.sampleRate), fade = 3000;
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (rng() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    for (let i = 0; i < fade; i++) { const k = i / fade; d[i] = d[i] * k + d[len - fade + i] * (1 - k); } // an inaudible seam
  }
  return buf;
}

/**
 * @param {BaseAudioContext} ctx
 * @param {{ mode?:string, rng?:()=>number, destination?:AudioNode, volume?:number, intensity?:number, onEvent?:(e:object)=>void }} [opts] `onEvent` is told of every event as it is scheduled (a screen can draw it at e.t)
 */
export function createEngine(ctx, opts = {}) {
  const rng = opts.rng || Math.random;
  const conductor = createConductor({ mode: opts.mode || 'focus', rng, start: ctx.currentTime + 0.3, intensity: opts.intensity ?? 0.8 });
  let volume = clamp(opts.volume ?? 0.7, 0, 1), level = clamp(opts.intensity ?? 0.8, 0, 1);
  let timer = null, stopped = false, scheduledTo = ctx.currentTime;
  let pads = []; // the chord voices that sound now: { gain, end }
  const live = new Set(); // nodes to disconnect when the engine stops

  const node = (n) => { live.add(n); return n; };
  const gain = (v = 1) => { const g = node(ctx.createGain()); g.gain.value = v; return g; };

  // ---- the shared graph: master -> compressor -> out; busses for dry, room and echo ----
  const master = gain(0);
  const comp = node(ctx.createDynamicsCompressor());
  comp.threshold.value = -20; comp.knee.value = 24; comp.ratio.value = 3; comp.attack.value = 0.02; comp.release.value = 0.4;
  master.connect(comp); comp.connect(opts.destination || ctx.destination);

  const room = node(ctx.createConvolver()); room.buffer = makeRoom(ctx, rng);
  const roomIn = gain(1), roomOut = gain(0);
  roomIn.connect(room); room.connect(roomOut); roomOut.connect(master);

  const echo = node(ctx.createDelay(2)); echo.delayTime.value = 0.62;
  const echoTone = node(ctx.createBiquadFilter()); echoTone.type = 'lowpass'; echoTone.frequency.value = 1700;
  const echoFeed = gain(0.36), echoOut = gain(0);
  echo.connect(echoTone); echoTone.connect(echoFeed); echoFeed.connect(echo); echoTone.connect(echoOut); echoOut.connect(master); echoOut.connect(roomIn);

  /** An input that mixes into dry, room and echo by the given amounts. */
  function bus(dry, wet, ech) {
    const input = gain(1), d = gain(dry), w = gain(wet), e = gain(ech);
    input.connect(d); d.connect(master); input.connect(w); w.connect(roomIn); if (ech) { input.connect(e); e.connect(echo); }
    return input;
  }
  const padBus = bus(0.8, 0.55, 0);
  const noteBus = bus(0.7, 0.8, 0.4);
  const pulseBus = bus(0.8, 0.3, 0);

  // ---- slow movers: two LFOs for the pad filters, one for the air ----
  const lfoA = node(ctx.createOscillator()), lfoB = node(ctx.createOscillator());
  lfoA.frequency.value = 0.043; lfoB.frequency.value = 0.067; lfoA.start(); lfoB.start();

  // ---- the air ----
  const airSrc = node(ctx.createBufferSource()); airSrc.buffer = brownNoise(ctx, rng); airSrc.loop = true;
  const airBand = node(ctx.createBiquadFilter()); airBand.type = 'bandpass'; airBand.frequency.value = 480; airBand.Q.value = 0.4;
  const airLfo = node(ctx.createOscillator()), airDepth = gain(240); airLfo.frequency.value = 0.021;
  const airGain = gain(0);
  airLfo.connect(airDepth); airDepth.connect(airBand.frequency);
  airSrc.connect(airBand); airBand.connect(airGain); airGain.connect(master);
  airSrc.start(); airLfo.start();

  function applyMood(at, ramp) {
    const m = conductor.mood();
    for (const [param, v] of [[roomOut.gain, m.wet], [echoOut.gain, m.echo], [airGain.gain, m.texture * (0.6 + 0.4 * level)]]) {
      param.cancelScheduledValues(at); param.setTargetAtTime(v, at, ramp);
    }
  }
  function applyLevel(at) {
    master.gain.cancelScheduledValues(at);
    master.gain.setTargetAtTime(volume * (0.62 + 0.38 * level), at, 4);
  }

  function cutoff() { const m = conductor.mood(); return lerp(m.cutoff[0], m.cutoff[1], level); }

  // ---- voices ----
  function chordVoices(e) {
    const m = conductor.mood(), t = Math.max(e.t, ctx.currentTime), n = e.notes.length;
    const att = Math.max(1, e.overlap), end = t + e.dur;
    const group = { end, gains: [] };
    e.notes.forEach((midi, i) => {
      const hz = mtof(midi), pan = ctx.createStereoPanner ? node(ctx.createStereoPanner()) : null;
      if (pan) pan.pan.value = clamp((i / Math.max(1, n - 1) - 0.5) * 1.3 + between(rng, -0.15, 0.15), -0.9, 0.9);
      const lp = node(ctx.createBiquadFilter()); lp.type = 'lowpass'; lp.Q.value = 0.5;
      const f0 = Math.max(hz * 1.6, cutoff() * (hz < 160 ? 0.8 : 1));
      lp.frequency.value = f0;
      const depth = gain(f0 * 0.3); (i % 2 ? lfoA : lfoB).connect(depth); depth.connect(lp.frequency);
      const env = gain(0), peak = (0.1 / Math.sqrt(n)) * m.padLevel * (i === 0 ? 1.1 : 1);
      env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(peak, t + att); env.gain.setValueAtTime(peak, Math.max(t + att, end - att)); env.gain.linearRampToValueAtTime(0.0001, end);
      for (const [type, cents, lv, mul] of [['sawtooth', -6, 0.26, 1], ['sawtooth', 7, 0.26, 1], ['triangle', 0, 0.5, 1], ['sine', 0, i === 0 ? 0.4 : 0, 0.5]]) {
        if (!lv) continue;
        const o = node(ctx.createOscillator()), g = gain(lv);
        o.type = type; o.frequency.value = hz * mul; o.detune.value = cents + between(rng, -2, 2);
        o.connect(g); g.connect(lp); o.start(t); o.stop(end + 0.1);
        o.onended = () => { live.delete(o); try { o.disconnect(); g.disconnect(); } catch { /* gone */ } };
      }
      lp.connect(env); env.connect(pan || padBus); if (pan) pan.connect(padBus);
      group.gains.push(env);
    });
    pads = pads.filter((p) => p.end > t); pads.push(group);
  }

  function struck(e) {
    const m = conductor.mood(), tim = TIMBRES[m.timbre] || TIMBRES.felt, t = Math.max(e.t, ctx.currentTime), hz = mtof(e.midi);
    const pan = ctx.createStereoPanner ? node(ctx.createStereoPanner()) : null; if (pan) { pan.pan.value = e.pan; pan.connect(noteBus); }
    const tone = node(ctx.createBiquadFilter()); tone.type = 'lowpass'; tone.frequency.value = Math.min(tim.bright, hz * 7) * (0.6 + 0.4 * level); tone.Q.value = 0.3;
    tone.connect(pan || noteBus);
    for (const [ratio, lv, share] of tim.partials) {
      const f = hz * ratio * (1 + tim.inharm * ratio * ratio); if (f > 12000) continue;
      const o = node(ctx.createOscillator()), g = gain(0.0001), len = e.dur * share, top = Math.max(0.0002, lv * e.vel * 0.16);
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(top, t + tim.att); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g); g.connect(tone); o.start(t); o.stop(t + len + 0.1);
      o.onended = () => { live.delete(o); try { o.disconnect(); g.disconnect(); } catch { /* gone */ } };
    }
  }

  function pulse(e) {
    const t = Math.max(e.t, ctx.currentTime), o = node(ctx.createOscillator()), g = gain(0.0001), lp = node(ctx.createBiquadFilter());
    o.type = 'sine'; o.frequency.value = mtof(e.midi); lp.type = 'lowpass'; lp.frequency.value = 520;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, e.vel * 0.15), t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(lp); lp.connect(g); g.connect(pulseBus); o.start(t); o.stop(t + 1);
    o.onended = () => { live.delete(o); try { o.disconnect(); lp.disconnect(); g.disconnect(); } catch { /* gone */ } };
  }

  /** Schedule everything the conductor has up to `until` (audio-clock seconds). The live engine calls this on a timer; an offline render calls it itself. */
  function scheduleTo(until) {
    if (stopped) return;
    for (const e of conductor.advance(until)) {
      if (e.type === 'chord') chordVoices(e); else if (e.type === 'note') struck(e); else pulse(e);
      try { opts.onEvent?.(e); } catch { /* a screen must not stop the sound */ }
    }
    scheduledTo = until;
  }

  applyMood(ctx.currentTime, 0.01); applyLevel(ctx.currentTime);
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.gain.setTargetAtTime(volume * (0.62 + 0.38 * level), ctx.currentTime + 0.1, 3); // a slow fade in

  if (!(ctx instanceof (globalThis.OfflineAudioContext || class {}))) {
    scheduleTo(ctx.currentTime + LOOKAHEAD_S);
    timer = setInterval(() => scheduleTo(ctx.currentTime + LOOKAHEAD_S), TICK_MS);
  }

  return {
    scheduleTo,
    setIntensity(x) { level = clamp(x, 0, 1); conductor.setIntensity(level); applyLevel(ctx.currentTime); applyMood(ctx.currentTime, 6); },
    setVolume(v) { volume = clamp(v, 0, 1); applyLevel(ctx.currentTime); },
    /** Change mood: the chord that sounds now fades over a few seconds and the next one is in the new mood. */
    setMode(id) {
      const now = ctx.currentTime;
      conductor.setMode(id, now);
      for (const p of pads) for (const g of p.gains) { try { g.gain.cancelAndHoldAtTime?.(now); g.gain.setTargetAtTime(0.0001, now, 2.2); } catch { /* ignore */ } }
      pads = []; applyMood(now, 4);
    },
    state: () => ({ ...conductor.state(), scheduledTo, volume }),
    /** Fade out and release everything. Resolves when the sound is gone. */
    stop(fadeS = 3) {
      if (stopped) return Promise.resolve(); stopped = true;
      if (timer) clearInterval(timer);
      const now = ctx.currentTime; master.gain.cancelScheduledValues(now); master.gain.setTargetAtTime(0, now, fadeS / 4);
      return new Promise((resolve) => setTimeout(() => {
        for (const n of live) { try { n.stop?.(); } catch { /* not a source, or stopped */ } try { n.disconnect(); } catch { /* gone */ } }
        live.clear(); resolve();
      }, fadeS * 1000 + 200));
    },
  };
}
