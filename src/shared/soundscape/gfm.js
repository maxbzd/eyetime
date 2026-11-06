// Pieces after generative.fm (Alex Bainter, MIT, github.com/generative-music/pieces-alex-bainter). Their pieces share one aesthetic: a few
// instrument samples, pitched down by one to three octaves, re-triggered at random intervals, through very long reverbs, slow filters
// and echoes, so that a handful of notes becomes a slow, endless, never-quite-repeating texture. This file is our own small
// implementation of that idea and of four of their pieces, described as data (what plays, how far down, how often, through what);
// the samples are the CC0 ones in src/audio/samples. It is not a copy of their code; credits are in src/audio/CREDITS.txt.
//
// A layer: { inst, notes, shift, every, start, reverse, gain, bus, fadeOut, chain }
//   inst   'violin' | 'cello' | 'piano' | 'harp'
//   notes  MIDI notes (the note it is "called"; it sounds `shift` semitones lower)
//   every  [a, b] seconds: after each note, wait a random time in this range
//   chain  true: one scheduler picks a random note from `notes` each time; false: every note runs on its own clock
//   bus    'main' (slow filter, room) | 'dry' | 'echo' (two long echoes, then the room)

import { between, pick, clamp } from './theory.js';
import { makeRoom } from './rhythm.js';

const OCT = (notes, octs) => octs.flatMap((o) => notes.map((n) => 12 * (o + 1) + n));
const CEGB = [0, 4, 7, 11];

/** @typedef {{ inst:string, notes:number[], shift:number, every:[number,number], start?:[number,number], chain?:boolean, reverse?:boolean, gain:number, bus?:string, fadeOut?:number }} Layer */
/** @type {{ id:string, name:string, note:string, credit:string, sampled:true, room:{sec:number,wet:number}, filter:{lo:number,hi:number,period:[number,number]}|null, echo?:{short:number,long:[number,number]}, layers:Layer[] }[]} */
export const PIECES = [
  { id: 'drones2', name: 'Drones 2', credit: 'drones-2', sampled: true,
    note: 'Скрипки на три октавы ниже, медленно «дышащий» фильтр и редкие обратные ноты. Ровный глубокий гул',
    room: { sec: 9, wet: 0.3 }, filter: { lo: 150, hi: 2400, period: [10, 100] }, layers: [
      { inst: 'violin', notes: [60, 67, 72, 79, 76], shift: -36, every: [40, 60], gain: 1.1 },
      { inst: 'violin', notes: [74], shift: -24, every: [45, 90], start: [15, 30], reverse: true, gain: 0.9 },
      { inst: 'violin', notes: [76], shift: -24, every: [45, 90], start: [30, 60], reverse: true, gain: 0.9 },
      { inst: 'violin', notes: [72], shift: -24, every: [45, 90], start: [60, 120], reverse: true, gain: 0.9 },
    ] },
  { id: 'homage', name: 'Homage', credit: 'homage', sampled: true,
    note: 'Две скрипки на две октавы ниже под огромным эхом и пианино, сыгранное так же глубоко. Фильтр открывается и закрывается за десять-тридцать минут',
    room: { sec: 18, wet: 0.65 }, filter: { lo: 100, hi: 2000, period: [670, 2000] }, layers: [
      { inst: 'violin', notes: [48, 60], shift: -24, every: [0, 10], gain: 0.8 },
      { inst: 'piano', notes: [72, 76, 79, 83, 84, 88, 91, 95, 96], shift: -24, every: [0, 10], chain: true, bus: 'dry', gain: 0.9 },
    ] },
  { id: 'apoapsis', name: 'Apoapsis', credit: 'apoapsis', sampled: true,
    note: 'Обратное пианино (звук нарастает и обрывается) через два длинных эха, 20–30 секунд, и редкие скрипки под большой комнатой. Очень медленно',
    room: { sec: 12, wet: 0.5 }, filter: null, echo: { short: 0.2, long: [20, 30] }, layers: [
      { inst: 'piano', notes: OCT(CEGB, [3, 4, 5]), shift: 0, every: [30, 60], reverse: true, bus: 'echo', gain: 1 },
      { inst: 'violin', notes: OCT(CEGB, [2, 3, 4]), shift: 0, every: [60, 180], start: [15, 30], fadeOut: 8, gain: 0.45 },
    ] },
  { id: 'nakaii', name: 'Nakaii', credit: 'nakaii', sampled: true,
    note: 'Короткие фразы пианино на две октавы ниже и скрипки на три октавы ниже, которые медленно набирают силу и уходят (период около 17 минут)',
    room: { sec: 8, wet: 0.35 }, filter: null, layers: [
      { inst: 'violin', notes: [60, 55, 72], shift: -36, every: [30, 60], gain: 1.1, bus: 'slowgain' },
      { inst: 'piano', notes: [], shift: -24, every: [0, 0], gain: 0.9, bus: 'dry', phrase: true },
    ] },
];

/**
 * @param {BaseAudioContext} ctx
 * @param {{ piece?:string, samples?:Record<string,{midi:number,buffer:AudioBuffer}[]>, rng?:()=>number, destination?:AudioNode, volume?:number }} [opts]
 */
export function createPieceEngine(ctx, opts = {}) {
  const P = PIECES.find((x) => x.id === opts.piece) || PIECES[0];
  const rng = opts.rng || Math.random, samples = opts.samples || {};
  let volume = clamp(opts.volume ?? 0.7, 0, 1), stopped = false, timer = null;
  const live = new Set(), node = (n) => { live.add(n); return n; };
  const gain = (x = 1) => { const g = node(ctx.createGain()); g.gain.value = x; return g; };
  const T0 = ctx.currentTime + 0.4;

  // ---- graph ----
  const master = gain(0), limiter = node(ctx.createDynamicsCompressor());
  limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.003; limiter.release.value = 0.2;
  master.connect(limiter); limiter.connect(opts.destination || ctx.destination);
  const room = node(ctx.createConvolver()); room.buffer = makeRoom(ctx, rng, P.room.sec);
  const roomIn = gain(1), roomOut = gain(P.room.wet); roomIn.connect(room); room.connect(roomOut); roomOut.connect(master);
  const lp = node(ctx.createBiquadFilter()); lp.type = 'lowpass'; lp.Q.value = 0.7; lp.frequency.value = P.filter ? P.filter.hi : 18000;
  const mainBus = gain(1), mainDry = gain(1 - P.room.wet * 0.5); mainBus.connect(lp); lp.connect(mainDry); mainDry.connect(master); lp.connect(roomIn);
  const dryBus = gain(1); dryBus.connect(master); dryBus.connect(roomIn);
  const slowBus = gain(1); slowBus.connect(mainBus);
  let echoBus = null;
  if (P.echo) { // two feedback echoes in a row (0.2 s, then 20 to 30 s), half wet each
    const d1 = node(ctx.createDelay(1)), d2 = node(ctx.createDelay(40)), f1 = gain(0.7), f2 = gain(0.6), w1 = gain(0.5), w2 = gain(0.5), mix1 = gain(1), mix2 = gain(1);
    d1.delayTime.value = P.echo.short; d2.delayTime.value = between(rng, ...P.echo.long); echoBus = gain(1);
    echoBus.connect(mix1); echoBus.connect(d1); d1.connect(f1); f1.connect(d1); d1.connect(w1); w1.connect(mix1); mix1.connect(mix2); mix1.connect(d2); d2.connect(f2); f2.connect(d2); d2.connect(w2); w2.connect(mix2); mix2.connect(master); mix2.connect(roomIn);
  }
  master.gain.setValueAtTime(0, ctx.currentTime); master.gain.setTargetAtTime(volume, ctx.currentTime + 0.2, 4);

  const busFor = (b) => (b === 'dry' ? dryBus : b === 'echo' ? echoBus : b === 'slowgain' ? slowBus : mainBus);
  const rev = new Map();
  const reversed = (buf) => { if (rev.has(buf)) return rev.get(buf); const r = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate); for (let c = 0; c < buf.numberOfChannels; c++) { const a = buf.getChannelData(c), b = r.getChannelData(c); for (let i = 0; i < a.length; i++) b[i] = a[a.length - 1 - i]; } rev.set(buf, r); return r; };

  function play(L, note, t) {
    const set = samples[L.inst]; if (!set || !set.length) return;
    let best = set[0]; for (const x of set) if (Math.abs(x.midi - note) < Math.abs(best.midi - note)) best = x;
    const s = node(ctx.createBufferSource()), g = gain(0.0001), pan = node(ctx.createStereoPanner()), rate = 2 ** ((note + L.shift - best.midi) / 12);
    s.buffer = L.reverse ? reversed(best.buffer) : best.buffer; s.playbackRate.value = rate; pan.pan.value = between(rng, -0.6, 0.6);
    const len = best.buffer.duration / rate, att = L.reverse ? 0.02 : Math.min(2, 0.02 + (L.shift <= -24 ? 1.2 : 0));
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(L.gain, t + att);
    if (L.fadeOut) { g.gain.setValueAtTime(L.gain, t + Math.max(att, len - L.fadeOut)); g.gain.linearRampToValueAtTime(0.0001, t + len); }
    s.connect(g); g.connect(pan); pan.connect(busFor(L.bus)); s.start(t);
    s.onended = () => { live.delete(s); try { s.disconnect(); g.disconnect(); pan.disconnect(); } catch { /* gone */ } };
  }

  // ---- the timeline: a list of things due at a time ----
  const due = [];
  const at = (t, fn) => due.push({ t, fn });
  const every = (L) => between(rng, L.every[0], L.every[1]);
  P.layers.forEach((L) => {
    if (L.phrase) { at(T0 + between(rng, 1, 3), function phrase() { // short phrases of a few notes, spaced unevenly, then a pause
      const set = [60, 62, 64, 67, 69, 72, 74, 76, 79], up = rng() < 0.5 ? 12 : 0, n = 7 + Math.floor(rng() * 2), m = between(rng, 1.75, 2.75), base = due.cur;
      let prev = -1;
      for (let i = 0; i < n; i++) {
        let note; do { note = pick(rng, set); } while (note === prev); prev = note;
        const off = 1 + between(rng, -0.05, 0.05) + (i <= 2 ? i * m : i <= 5 ? 3 * m + ((i - 3) * m) / 3 : 4.5 * m + ((i - 4.5) * m) / 2);
        if (i < n - 1 || rng() < 0.95) play({ ...L, shift: L.shift }, note + up, base + off);
      }
      at(base + between(rng, 0, 5) + m * n + 3, phrase);
    }); return; }
    if (L.chain) { const f = () => { play(L, pick(rng, L.notes), due.cur + 1); at(due.cur + every(L), f); }; at(T0 + between(rng, ...(L.start || [0, 2])), f); return; }
    L.notes.forEach((note) => { const f = () => { play(L, note, due.cur + 1); at(due.cur + every(L), f); }; at(T0 + (L.start ? between(rng, ...L.start) : between(rng, 0, every(L))), f); });
  });
  // the slow movers (a filter and a swell that take ten minutes or more) take a small step every few seconds
  const lfoPeriod = P.filter ? between(rng, ...P.filter.period) : 0, swellPeriod = 1000;
  at(T0, function slow() {
    const t = due.cur;
    if (P.filter) { const k = 0.5 + 0.5 * Math.cos(((t - T0) / lfoPeriod) * Math.PI * 2); lp.frequency.setTargetAtTime(P.filter.lo + (P.filter.hi - P.filter.lo) * (P.id === 'drones2' ? k * k : k), t, 4); }
    if (P.layers.some((l) => l.bus === 'slowgain')) slowBus.gain.setTargetAtTime(0.5 + 0.5 * Math.cos(((t - T0) / swellPeriod) * Math.PI * 2), t, 6);
    at(t + 6, slow);
  });

  function scheduleTo(until) {
    if (stopped) return;
    for (let guard = 0; guard < 5000; guard++) {
      let k = -1; for (let i = 0; i < due.length; i++) if (k < 0 || due[i].t < due[k].t) k = i;
      if (k < 0 || due[k].t >= until) break;
      const job = due.splice(k, 1)[0]; due.cur = job.t; job.fn();
    }
  }
  if (!(ctx instanceof (globalThis.OfflineAudioContext || class {}))) { scheduleTo(ctx.currentTime + 5); timer = setInterval(() => scheduleTo(ctx.currentTime + 5), 1000); }

  return {
    scheduleTo, piece: P,
    setVolume(x) { volume = clamp(x, 0, 1); master.gain.setTargetAtTime(volume, ctx.currentTime, 0.2); },
    stop(fadeS = 2) {
      if (stopped) return Promise.resolve(); stopped = true; if (timer) clearInterval(timer);
      master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(0, ctx.currentTime, fadeS / 4);
      return new Promise((resolve) => setTimeout(() => { for (const n of live) { try { n.stop?.(); } catch { /* not a source */ } try { n.disconnect(); } catch { /* gone */ } } live.clear(); resolve(); }, fadeS * 1000 + 200));
    },
  };
}

