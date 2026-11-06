// A second family of engines: a steady, soft rhythm over a continuous dark pad. Measured from a reference focus track
// (general properties only: key, spectrum, pulse speed, stereo width, how the level breathes), not copied from it:
//   - one slow harmony (C major without B), a chord lasting minutes, not seconds
//   - a continuous pad with a slow swell (about 8 s) and almost nothing above 3 kHz
//   - a quiet low pulse at about 72 beats a minute, and a repeating arpeggio on a triplet grid over it
//   - very wide stereo (the two sides are almost unrelated)
// The variants differ in how much of each part there is and what it is made of. Everything is synthesised, the order of the
// notes is random every time (the motif is mutated as it repeats), so it never loops. Works on a live or an offline context.
// A variant may play real instruments instead of oscillators: the arpeggio (`inst`: piano or harp) and a sustained bed (`padInst`: cello
// section) come from a few short CC0 samples (src/audio/samples, see CREDITS.txt) that are stretched in pitch to any note; what is
// played and when is still generated, so the music is never a recording.

import { mtof, between, pick, weighted, clamp, lerp } from './theory.js';

/** Chords in C major (no B): MIDI notes of the pad, and the notes the arpeggio may use. */
export const CHORDS = {
  Cadd9: { pad: [48, 55, 62, 64, 67, 72, 76], arp: [48, 55, 60, 62, 64, 67, 72], next: [['Fmaj9', 3], ['Am7', 2], ['Dm7', 1]] },
  Fmaj9: { pad: [41, 53, 57, 60, 64, 69, 72], arp: [53, 57, 60, 64, 65, 67, 69], next: [['Cadd9', 3], ['Am7', 2], ['Dm7', 2]] },
  Am7: { pad: [45, 57, 60, 64, 67, 72, 76], arp: [48, 57, 60, 62, 64, 67, 69], next: [['Fmaj9', 3], ['Cadd9', 2], ['Dm7', 2]] },
  Dm7: { pad: [50, 53, 57, 60, 65, 69, 72], arp: [50, 53, 57, 60, 62, 65, 69], next: [['Cadd9', 3], ['Fmaj9', 2]] },
};

/**
 * @typedef {{ id:string, name:string, note:string, bpm:number, grid:number, motif:number, rest:number, mutate:number, pluck:'soft'|'marimba'|'glass'|'felt'|'none', pluckCut:number, pluckLevel:number, octave:number,
 *   pulse:number, duck:number, padLevel:number, padCut:number, swell:number, swellHz:number, air:number, wet:number, echo:number, chordSec:[number,number], shimmer:number, sparkle:number, lowPump?:number, start?:string, fadeIn?:number, trim?:number, inst?:'piano'|'harp', padInst?:'cello', padMix?:number, padSample?:number, sampled?:boolean }} Variant
 */

/** @type {Variant[]} */
export const VARIANTS = [
  { id: 'triplet', name: 'Триоли', note: 'Ближе всего к образцу: пэд, мягкий пульс 72 и тихое арпеджио триолями', bpm: 72, grid: 3, motif: 6, rest: 0.18, mutate: 0.12, pluck: 'soft', pluckCut: 2600, pluckLevel: 0.55, octave: 0, pulse: 1.1, duck: 0.2, padLevel: 1, padCut: 1500, swell: 0.12, swellHz: 0.12, air: 0.5, wet: 0.55, echo: 0.28, lowPump: 0.6, chordSec: [120, 200], shimmer: 0, sparkle: 0 },
  { id: 'eighth', name: 'Восьмые', note: 'То же, но арпеджио ровными восьмыми, ощущение чётче', bpm: 72, grid: 2, motif: 8, rest: 0.22, mutate: 0.1, pluck: 'marimba', pluckCut: 2800, pluckLevel: 0.5, octave: 0, pulse: 1.1, duck: 0.2, padLevel: 1, padCut: 1450, swell: 0.12, swellHz: 0.12, air: 0.45, wet: 0.5, echo: 0.25, lowPump: 0.6, chordSec: [100, 180], shimmer: 0, sparkle: 0 },
  { id: 'pump', name: 'Дыхание', note: 'Пэд сам «дышит» в такт пульсу, арпеджио тише', bpm: 72, grid: 3, motif: 6, rest: 0.4, mutate: 0.12, pluck: 'soft', pluckCut: 2000, pluckLevel: 0.4, octave: 0, pulse: 1.1, duck: 0.5, padLevel: 1.1, padCut: 1500, swell: 0.1, swellHz: 0.19, air: 0.55, wet: 0.5, echo: 0.2, lowPump: 0.7, chordSec: [140, 220], shimmer: 0, sparkle: 0 },
  { id: 'night', name: 'Ночь (по записи 2)', note: 'По второй записи: ровный пульс 60 в самом низу, редкое арпеджио, звук нарастает больше минуты', bpm: 60, grid: 2, motif: 8, rest: 0.55, mutate: 0.15, pluck: 'soft', pluckCut: 2400, pluckLevel: 0.5, octave: 0, pulse: 1.3, duck: 0.15, padLevel: 1, padCut: 1700, swell: 0.1, swellHz: 0.06, air: 0.4, wet: 0.5, echo: 0.25, lowPump: 0.5, start: 'Am7', fadeIn: 70, chordSec: [120, 220], shimmer: 0, sparkle: 0.3 },
  { id: 'drone', name: 'Медленный пэд', note: 'Без ритма: только пэд, воздух и медленные волны громкости', bpm: 72, grid: 3, motif: 6, rest: 1, mutate: 0, pluck: 'none', pluckCut: 1000, pluckLevel: 0, octave: 0, pulse: 0, duck: 0, padLevel: 1.15, padCut: 950, swell: 0.4, swellHz: 0.11, air: 0.8, wet: 0.6, echo: 0, chordSec: [150, 240], shimmer: 0.12, sparkle: 0 },
  { id: 'pulse', name: 'Пульс', note: 'Низкий мягкий пульс 72 под пэдом и шумом, без мелодии', bpm: 72, grid: 3, motif: 6, rest: 1, mutate: 0, pluck: 'none', pluckCut: 1000, pluckLevel: 0, octave: 0, pulse: 1, duck: 0.4, padLevel: 1, padCut: 1000, swell: 0.25, swellHz: 0.12, air: 0.8, wet: 0.5, echo: 0, lowPump: 0.5, chordSec: [150, 240], shimmer: 0, sparkle: 0 },
  { id: 'glass', name: 'Стекло', note: 'Редкие высокие стеклянные ноты над тёмным пэдом, медленнее', bpm: 60, grid: 2, motif: 8, rest: 0.55, mutate: 0.2, pluck: 'glass', pluckCut: 2400, pluckLevel: 0.55, octave: 12, pulse: 0.35, duck: 0.1, padLevel: 1, padCut: 900, swell: 0.3, swellHz: 0.1, air: 0.55, wet: 0.7, echo: 0.4, chordSec: [90, 160], shimmer: 0.2, sparkle: 0.5 },
  { id: 'felt', name: 'Мягкое пианино', note: 'Арпеджио войлочным тоном, как приглушённое пианино', bpm: 66, grid: 2, motif: 8, rest: 0.25, mutate: 0.15, pluck: 'felt', pluckCut: 2400, pluckLevel: 0.9, octave: 0, pulse: 0.5, duck: 0.12, padLevel: 0.9, padCut: 1050, swell: 0.2, swellHz: 0.12, air: 0.4, wet: 0.6, echo: 0.3, lowPump: 0.4, chordSec: [100, 170], shimmer: 0, sparkle: 0 },
  { id: 'deep', name: 'Глубокий', note: 'Самый тёмный: низкий пэд, пульс и очень мягкое арпеджио', bpm: 66, grid: 3, motif: 6, rest: 0.3, mutate: 0.1, pluck: 'soft', pluckCut: 800, pluckLevel: 0.7, octave: -12, pulse: 0.9, duck: 0.25, padLevel: 1.2, padCut: 450, swell: 0.25, swellHz: 0.13, air: 0.7, wet: 0.6, echo: 0.2, lowPump: 0.5, chordSec: [160, 260], shimmer: 0, sparkle: 0 },
  // ---- real instruments (CC0 samples of VS Chamber Orchestra: Community Edition), same generative structure ----
  { id: 'piano', name: 'Пианино и виолончели', note: 'Настоящее пианино играет мягкое арпеджио триолями, под ним живой смычковый пэд, внизу пульс', sampled: true, inst: 'piano', padInst: 'cello', padMix: 0.25, padSample: 1, bpm: 72, grid: 3, motif: 6, rest: 0.3, mutate: 0.12, pluck: 'none', pluckCut: 2600, pluckLevel: 1, octave: 0, pulse: 0.9, duck: 0.15, padLevel: 1, padCut: 1200, swell: 0.12, swellHz: 0.1, air: 0.4, wet: 0.55, echo: 0.22, lowPump: 0.4, chordSec: [120, 200], shimmer: 0, sparkle: 0 },
  { id: 'harp', name: 'Арфа и виолончели', note: 'Арфа восьмыми над смычковым пэдом, чуть светлее и воздушнее', sampled: true, inst: 'harp', padInst: 'cello', padMix: 0.25, padSample: 1, bpm: 66, grid: 2, motif: 8, rest: 0.35, mutate: 0.15, pluck: 'none', pluckCut: 3000, pluckLevel: 0.9, octave: 0, pulse: 0.7, duck: 0.12, padLevel: 1, padCut: 1300, swell: 0.12, swellHz: 0.1, air: 0.35, wet: 0.6, echo: 0.3, lowPump: 0.3, chordSec: [110, 190], shimmer: 0, sparkle: 0 },
  { id: 'strings', name: 'Только виолончели', note: 'Живой смычковый пэд, воздух и очень редкие ноты пианино. Почти без ритма', sampled: true, inst: 'piano', padInst: 'cello', padMix: 0.15, padSample: 1.3, bpm: 60, grid: 2, motif: 8, rest: 0.88, mutate: 0.2, pluck: 'none', pluckCut: 2000, pluckLevel: 0.8, octave: 0, pulse: 0.25, duck: 0, padLevel: 1, padCut: 1000, swell: 0.2, swellHz: 0.08, air: 0.5, wet: 0.65, echo: 0.2, lowPump: 0, chordSec: [130, 220], shimmer: 0, sparkle: 0 },
  { id: 'pianonight', name: 'Пианино, «Ночь»', note: 'Структура «Ночи» (пульс 60, звук нарастает больше минуты), но играет настоящее пианино', sampled: true, inst: 'piano', padInst: 'cello', padMix: 0.2, padSample: 1, bpm: 60, grid: 2, motif: 8, rest: 0.55, mutate: 0.15, pluck: 'none', pluckCut: 2400, pluckLevel: 0.9, octave: 0, pulse: 1.2, duck: 0.15, padLevel: 1, padCut: 1500, swell: 0.1, swellHz: 0.06, air: 0.35, wet: 0.5, echo: 0.25, lowPump: 0.5, start: 'Am7', fadeIn: 70, chordSec: [120, 220], shimmer: 0, sparkle: 0 },
  { id: 'harpglass', name: 'Арфа, высокая', note: 'Редкие высокие ноты арфы, как капли, над тёмным пэдом и виолончелями', sampled: true, inst: 'harp', padInst: 'cello', padMix: 0.2, padSample: 1.1, bpm: 60, grid: 2, motif: 8, rest: 0.6, mutate: 0.25, pluck: 'none', pluckCut: 3200, pluckLevel: 0.75, octave: 12, pulse: 0.3, duck: 0.08, padLevel: 1, padCut: 1000, swell: 0.2, swellHz: 0.09, air: 0.4, wet: 0.7, echo: 0.4, lowPump: 0.2, chordSec: [100, 170], shimmer: 0, sparkle: 0 },
];

const PLUCKS = {
  // [partial ratio, level, decay seconds], attack seconds
  soft: { att: 0.012, parts: [[1, 1, 0.9], [2, 0.55, 0.6], [3, 0.32, 0.4], [4, 0.16, 0.3], [5, 0.08, 0.2]] },
  marimba: { att: 0.004, parts: [[1, 1, 0.55], [4, 0.28, 0.16], [9.2, 0.06, 0.07]] },
  glass: { att: 0.01, parts: [[1, 1, 1.8], [2.76, 0.14, 1], [5.4, 0.04, 0.6]] },
  felt: { att: 0.018, parts: [[1, 1, 1.4], [2, 0.5, 0.8], [3, 0.24, 0.5], [4, 0.1, 0.3], [5, 0.05, 0.2]] },
};

export function makeRoom(ctx, rng, seconds) {
  const rate = ctx.sampleRate, len = Math.floor(rate * seconds), buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let lp = 0;
    for (let i = 0; i < len; i++) { const t = i / len; lp += lerp(0.5, 0.05, Math.sqrt(t)) * ((rng() * 2 - 1) - lp); d[i] = lp * (1 - t) ** 3 * (i < rate * 0.015 ? i / (rate * 0.015) : 1); }
  }
  return buf;
}
export function brown(ctx, rng, seconds = 12) {
  const len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(2, len, ctx.sampleRate), fade = 4000;
  for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (rng() * 2 - 1)) / 1.02; d[i] = last * 3.5; } for (let i = 0; i < fade; i++) { const k = i / fade; d[i] = d[i] * k + d[len - fade + i] * (1 - k); } }
  return buf;
}

/** Decode the instrument samples listed in `<base>manifest.json` into { piano: [{ midi, buffer }], harp: [...], cello: [...] }. */
export async function loadSamples(ctx, base) {
  const man = await (await fetch(base + 'manifest.json')).json(), out = {};
  for (const [id, list] of Object.entries(man)) out[id] = await Promise.all(list.map(async (e) => ({ midi: e.midi, buffer: await ctx.decodeAudioData(await (await fetch(base + e.file)).arrayBuffer()) })));
  return out;
}
const nearest = (set, midi) => { let best = set[0]; for (const x of set) if (Math.abs(x.midi - midi) < Math.abs(best.midi - midi)) best = x; return { buf: best.buffer, rate: 2 ** ((midi - best.midi) / 12) }; };

/**
 * @param {BaseAudioContext} ctx
 * @param {{ samples?:Record<string,{midi:number,buffer:AudioBuffer}[]>, variant?:string, rng?:()=>number, destination?:AudioNode, volume?:number, onEvent?:(e:object)=>void }} [opts]
 */
export function createRhythmEngine(ctx, opts = {}) {
  const v = VARIANTS.find((x) => x.id === opts.variant) || VARIANTS[0];
  const rng = opts.rng || Math.random;
  let volume = clamp(opts.volume ?? 0.7, 0, 1), stopped = false, timer = null;
  const live = new Set();
  const node = (n) => { live.add(n); return n; };
  const gain = (x = 1) => { const g = node(ctx.createGain()); g.gain.value = x; return g; };
  const beat = 60 / v.bpm, step = beat / v.grid;
  const T0 = ctx.currentTime + 0.4, samples = opts.samples || {};

  // ---- graph ----
  const master = gain(0);
  const comp = node(ctx.createDynamicsCompressor()); comp.threshold.value = -22; comp.knee.value = 20; comp.ratio.value = 2.5; comp.attack.value = 0.03; comp.release.value = 0.5;
  master.connect(comp); comp.connect(opts.destination || ctx.destination);
  const room = node(ctx.createConvolver()); room.buffer = makeRoom(ctx, rng, 7.5);
  const roomIn = gain(1), roomOut = gain(v.wet); roomIn.connect(room); room.connect(roomOut); roomOut.connect(master);
  // a wide echo: left and right delays of different lengths, each feeding the other
  const dl = node(ctx.createDelay(2)), dr = node(ctx.createDelay(2)); dl.delayTime.value = step * 3 * 1.0; dr.delayTime.value = step * 4.5;
  const dtone = node(ctx.createBiquadFilter()); dtone.type = 'lowpass'; dtone.frequency.value = 1400;
  const merger = node(ctx.createChannelMerger(2)), echoIn = gain(1), fb1 = gain(0.34), fb2 = gain(0.34), echoOut = gain(v.echo);
  echoIn.connect(dtone); dtone.connect(dl); dl.connect(fb1); fb1.connect(dr); dr.connect(fb2); fb2.connect(dl);
  dl.connect(merger, 0, 0); dr.connect(merger, 0, 1); merger.connect(echoOut); echoOut.connect(master); echoOut.connect(roomIn);

  const padDuck = gain(1), padSwell = gain(1 - v.swell / 2), lowDuck = gain(1);
  lowDuck.connect(padDuck);
  const padWet = gain(0.5), padDry = gain(0.9); padSwell.connect(padDuck); padDuck.connect(padDry); padDry.connect(master); padDuck.connect(padWet); padWet.connect(roomIn);
  const swellLfo = node(ctx.createOscillator()), swellDepth = gain(v.swell / 2); swellLfo.frequency.value = v.swellHz; swellLfo.connect(swellDepth); swellDepth.connect(padSwell.gain); swellLfo.start(T0);
  const pluckBus = gain(v.pluckLevel); const pDry = gain(0.8), pWet = gain(0.6), pEcho = gain(0.7); pluckBus.connect(pDry); pDry.connect(master); pluckBus.connect(pWet); pWet.connect(roomIn); pluckBus.connect(pEcho); pEcho.connect(echoIn);
  const pulseBus = gain(v.pulse * 0.9); const puDry = gain(0.9), puWet = gain(0.2); pulseBus.connect(puDry); puDry.connect(master); pulseBus.connect(puWet); puWet.connect(roomIn);

  // air: brown noise, low-passed, swelling slowly and independently of the pad
  const airSrc = node(ctx.createBufferSource()); airSrc.buffer = brown(ctx, rng); airSrc.loop = true;
  const airLp = node(ctx.createBiquadFilter()); airLp.type = 'lowpass'; airLp.frequency.value = 520; airLp.Q.value = 0.3;
  const airGain = gain(0.07 * v.air), airLfo = node(ctx.createOscillator()), airDepth = gain(0.035 * v.air); airLfo.frequency.value = 0.07;
  airSrc.connect(airLp); airLp.connect(airGain); airGain.connect(master); airLfo.connect(airDepth); airDepth.connect(airGain.gain); airSrc.start(T0); airLfo.start(T0);

  master.gain.setValueAtTime(0, ctx.currentTime); master.gain.setTargetAtTime(volume * (v.trim || 1), ctx.currentTime + 0.2, (v.fadeIn || 7) / 3);

  // ---- the music, as a state the scheduler walks through ----
  let chordName = v.start || pick(rng, ['Cadd9', 'Fmaj9']), chordEnd = T0, padGroup = null;
  let stepAt = T0, stepN = 0, motif = [], bar = 0, beatAt = T0, beatN = 0;
  const done = (o, ...ns) => { o.onended = () => { live.delete(o); try { o.disconnect(); ns.forEach((n) => n.disconnect()); } catch { /* gone */ } }; };

  function startChord(t) {
    const def = CHORDS[chordName], len = between(rng, v.chordSec[0], v.chordSec[1]), over = Math.min(14, len * 0.2), end = t + len + over;
    chordEnd = t + len;
    const group = [];
    def.pad.forEach((midi, i) => {
      const hz = mtof(midi);
      for (const side of [-1, 1]) { // one oscillator pair per side: the left and right are slightly different tones, which is what makes it wide
        const o = node(ctx.createOscillator()), o2 = node(ctx.createOscillator()), o3 = node(ctx.createOscillator()), o3g = gain(0.3), g = gain(0), lp = node(ctx.createBiquadFilter()), pan = node(ctx.createStereoPanner());
        o3.type = 'sawtooth'; o3.frequency.value = hz; o3.detune.value = side * between(rng, 5, 9); o3.connect(o3g); o3g.connect(lp); o3.start(t); o3.stop(end + 0.1); done(o3, o3g);
        o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = hz; o2.frequency.value = hz * (i === 0 ? 0.5 : 1); o.detune.value = side * between(rng, 5, 10); o2.detune.value = -side * between(rng, 3, 7);
        lp.type = 'lowpass'; lp.frequency.value = Math.max(hz * 1.4, v.padCut) * (hz < 100 ? 0.85 : 1); lp.Q.value = 0.4;
        pan.pan.value = side * between(rng, 0.55, 0.95);
        const peak = (0.1 / Math.sqrt(def.pad.length)) * v.padLevel * (v.padMix ?? 1) * (i === 0 ? 1.15 : 1);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + Math.max(2, over)); g.gain.setValueAtTime(peak, Math.max(t + over, end - over)); g.gain.linearRampToValueAtTime(0.0001, end);
        o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(pan); pan.connect(midi < 56 ? lowDuck : padSwell);
        o.start(t); o2.start(t); o.stop(end + 0.1); o2.stop(end + 0.1); done(o, lp, g, pan); done(o2);
        if (v.shimmer && i > 1) { // an octave above, very quiet, through the room: a faint halo
          const s = node(ctx.createOscillator()), sg = gain(0); s.type = 'sine'; s.frequency.value = hz * 2; s.detune.value = side * 5;
          sg.gain.setValueAtTime(0.0001, t); sg.gain.linearRampToValueAtTime(peak * v.shimmer, t + over); sg.gain.linearRampToValueAtTime(0.0001, end);
          s.connect(sg); sg.connect(pan); s.start(t); s.stop(end + 0.1); done(s, sg);
        }
      }
    });
    if (v.padInst && samples[v.padInst]) samplePad(t, len, def);
    padGroup = group; opts.onEvent?.({ t, type: 'chord', name: chordName, notes: def.pad, dur: len });
  }

  /** The sustained bed from real strings: each note re-bowed every few seconds, the repeats overlapping so that it never stops. */
  function samplePad(t, len, def) {
    const set = samples[v.padInst], over = Math.min(14, len * 0.2), end = t + len + over;
    def.pad.filter((m) => m >= 38 && m <= 67).slice(0, 4).forEach((midi, i) => {
      const { buf, rate } = nearest(set, midi), skip = 0.25, span = (buf.duration - skip) / rate, period = Math.max(3, span - 2.6), side = i % 2 ? 1 : -1;
      for (let at = t + i * 1.9; at < end; at += period) {
        const edge = clamp(Math.min((at - t) / over, (end - at) / over) + 0.15, 0.05, 1), peak = 0.42 * (v.padSample ?? 1) * edge;
        const s = node(ctx.createBufferSource()), g = gain(0.0001), pan = node(ctx.createStereoPanner());
        s.buffer = buf; s.playbackRate.value = rate; pan.pan.value = side * between(rng, 0.2, 0.7);
        g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(peak, at + 2.4);
        s.connect(g); g.connect(pan); pan.connect(midi < 56 ? lowDuck : padSwell); s.start(at, skip); done(s, g, pan);
      }
    });
  }

  function samplePluck(t, midi, accent) {
    const { buf, rate } = nearest(samples[v.inst], midi + v.octave), s = node(ctx.createBufferSource()), g = gain(0.35 + 0.4 * accent), pan = node(ctx.createStereoPanner());
    s.buffer = buf; s.playbackRate.value = rate; pan.pan.value = (stepN % 2 ? 1 : -1) * between(rng, 0.25, 0.7);
    s.connect(g); g.connect(pan); pan.connect(pluckBus); s.start(t); done(s, g, pan);
    opts.onEvent?.({ t, type: 'note', midi: midi + v.octave, vel: 0.4 + 0.4 * accent, pan: pan.pan.value, dur: 2 });
  }

  function newMotif() {
    const pool = CHORDS[chordName].arp, m = [];
    for (let i = 0; i < v.motif; i++) m.push(i === 0 && (v.pluck !== 'none' || v.inst) ? pool[0] : rng() < v.rest ? null : weighted(rng, pool.map((n) => [n, (n < 58 ? 5 : n % 12 === 0 || n % 12 === 7 || n % 12 === 4 ? 3 : 1)])));
    return m;
  }
  function mutate() { // the pattern repeats with small changes, so it feels like a pattern but never loops exactly
    const pool = CHORDS[chordName].arp;
    motif = motif.map((n) => (rng() < v.mutate ? (rng() < 0.35 ? null : pick(rng, pool)) : n));
  }

  function pluck(t, midi, accent) {
    if (v.inst && samples[v.inst]) return samplePluck(t, midi, accent);
    const def = PLUCKS[v.pluck]; if (!def) return;
    const hz = mtof(midi + v.octave), pan = node(ctx.createStereoPanner()), lp = node(ctx.createBiquadFilter());
    pan.pan.value = (stepN % 2 ? 1 : -1) * between(rng, 0.35, 0.8); lp.type = 'lowpass'; lp.frequency.value = v.pluckCut * (0.8 + 0.4 * accent); lp.Q.value = 0.4;
    lp.connect(pan); pan.connect(pluckBus);
    for (const [ratio, lv, dec] of def.parts) {
      const f = hz * ratio; if (f > 9000) continue;
      const o = node(ctx.createOscillator()), g = gain(0.0001), top = Math.max(0.0002, lv * (0.1 + 0.07 * accent));
      o.type = 'sine'; o.frequency.value = f; o.detune.value = between(rng, -3, 3);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(top, t + def.att); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g); g.connect(lp); o.start(t); o.stop(t + dec + 0.1); done(o, g);
    }
    done(node(ctx.createOscillator()), lp, pan); // (the filter and panner are released with their last partial, below)
    opts.onEvent?.({ t, type: 'note', midi: midi + v.octave, vel: 0.4 + 0.4 * accent, pan: pan.pan.value, dur: 1 });
  }

  function pulse(t, strong) {
    // a sub-bass note of the chord's root (A1 to G#2, 55 to 104 Hz) with a soft attack: the rhythm of the reference lives down here,
    // as a bump of about 8 dB in the lowest band every half second, and hardly shows above 200 Hz
    const pc = CHORDS[chordName].pad[0] % 12, hz = mtof(33 + ((pc - 9 + 12) % 12)), g = gain(0.0001), lp = node(ctx.createBiquadFilter());
    lp.type = 'lowpass'; lp.frequency.value = 320; lp.connect(g); g.connect(pulseBus);
    const peak = strong ? 0.5 : 0.34;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.09); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.44);
    for (const [mul, lv] of [[1, 1], [2, 0.3]]) { const o = node(ctx.createOscillator()), og = gain(lv); o.type = 'sine'; o.frequency.value = hz * mul; o.connect(og); og.connect(lp); o.start(t); o.stop(t + 0.5); done(o, og); }
    if (v.lowPump) { lowDuck.gain.setValueAtTime(1 - v.lowPump, t); lowDuck.gain.linearRampToValueAtTime(1, t + (beat / 2) * 0.9); }
    if (v.duck && strong) { padDuck.gain.setValueAtTime(1 - v.duck, t); padDuck.gain.linearRampToValueAtTime(1, t + beat * 0.85); }
    opts.onEvent?.({ t, type: 'pulse', vel: 1 });
  }

  function sparkle(t) { // a rare high note: the thing that makes the ear look up now and then
    const midi = pick(rng, [74, 76, 79, 81, 83].filter((n) => n % 12 !== 11)), hz = mtof(midi), o = node(ctx.createOscillator()), g = gain(0.0001), pan = node(ctx.createStereoPanner());
    o.type = 'sine'; o.frequency.value = hz; pan.pan.value = between(rng, -0.8, 0.8); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03 * v.sparkle, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 4);
    o.connect(g); g.connect(pan); pan.connect(pluckBus); o.start(t); o.stop(t + 4.2); done(o, g, pan); opts.onEvent?.({ t, type: 'note', midi, vel: 0.5, pan: pan.pan.value, dur: 4 });
  }

  function scheduleTo(until) {
    if (stopped) return;
    if (!padGroup) { startChord(T0); motif = newMotif(); }
    for (let guard = 0; guard < 4000; guard++) {
      const next = Math.min(chordEnd, stepAt, beatAt);
      if (next >= until) break;
      if (next === chordEnd) { chordName = weighted(rng, CHORDS[chordName].next); startChord(chordEnd); motif = newMotif(); }
      else if (next === beatAt) { if (v.pulse && rng() < 0.97) pulse(beatAt, beatN % 2 === 0); if (v.sparkle && rng() < 0.01 * v.sparkle * 4) sparkle(beatAt + between(rng, 0, beat)); beatN++; beatAt += (beat / 2) * between(rng, 0.998, 1.002); }
      else {
        const i = stepN % motif.length;
        if (i === 0 && stepN > 0) { bar++; mutate(); if (bar % 6 === 0) motif = newMotif(); }
        const midi = motif[i]; if (midi != null && (v.pluck !== 'none' || v.inst)) pluck(stepAt, midi, (stepN % v.grid === 0) ? 1 : 0.55);
        stepN++; stepAt += step * between(rng, 0.997, 1.003);
      }
    }
  }

  if (!(ctx instanceof (globalThis.OfflineAudioContext || class {}))) { scheduleTo(ctx.currentTime + 5); timer = setInterval(() => scheduleTo(ctx.currentTime + 5), 1000); }

  return {
    scheduleTo,
    variant: v,
    setVolume(x) { volume = clamp(x, 0, 1); master.gain.setTargetAtTime(volume * (v.trim || 1), ctx.currentTime, 0.2); },
    stop(fadeS = 2) {
      if (stopped) return Promise.resolve(); stopped = true; if (timer) clearInterval(timer);
      master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(0, ctx.currentTime, fadeS / 4);
      return new Promise((resolve) => setTimeout(() => { for (const n of live) { try { n.stop?.(); } catch { /* not a source */ } try { n.disconnect(); } catch { /* gone */ } } live.clear(); resolve(); }, fadeS * 1000 + 200));
    },
  };
}
