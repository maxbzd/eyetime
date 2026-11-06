// A fourth family, made after listening: no constant pad, no loop, no periodic swell.
//   - Separate voices come and go by themselves (a wordless choir, a cello section, harp and piano notes), each with its own length,
//     pitch, place in the room and vowel. There is always something, but never the same chord held on and on.
//   - The music moves through scenes of one to two minutes (which instruments, how high, how busy, how bright, how much air), chosen
//     at random, so it keeps changing and a minute of it never repeats.
//   - Nothing modulates on a sine. The level of the air, the room and the brightness take slow random steps instead.
//   - The notes are drawn from C major (no B) and the chord of the moment, so it stays gentle however the dice fall.
// The voices are synthesised (formant choir) or taken from a few short CC0 samples (cello, harp, piano; see CREDITS.txt).

import { mtof, between, pick, weighted, clamp } from './theory.js';
import { CHORDS, makeRoom, brown } from './rhythm.js';

// vowels as formants: [centre Hz, level, Q]
const VOWELS = {
  oo: [[300, 1, 6], [870, 0.3, 8], [2240, 0.05, 10]],
  oh: [[450, 1, 6], [800, 0.35, 8], [2830, 0.06, 10]],
  uh: [[520, 1, 6], [1190, 0.3, 8], [2390, 0.05, 10]],
  ah: [[700, 1, 6], [1150, 0.3, 8], [2600, 0.05, 10]],
};

// loudness of each source relative to the others, measured so that a scene of any one of them sounds equally loud
export const SRC_GAIN = { choir: 0.37, cello: 2.0, harp: 0.39, piano: 0.38 };

const S = (name, len, rate, mix, reg, extra = {}) => ({ name, len, rate, mix, reg, vowels: ['oo', 'oh'], pluckReg: [60, 79], bright: 0.5, air: 0.6, wet: 0.55, echo: 0.2, pulse: 0, ...extra });

/** @type {{ id:string, name:string, note:string, sampled?:boolean, trim:number, scenes:ReturnType<typeof S>[] }[]} */
export const PRESETS = [
  { id: 'voices', name: 'Хор, который меняется', note: 'То, что вам понравилось (хор), но он сам меняет звучание каждую-две минуты: гласные, высоту, плотность', trim: 1, scenes: [
    S('мягкий', [60, 110], 5, { choir: 1 }, [50, 72], { bright: 0.4 }),
    S('высокий', [50, 90], 4, { choir: 1 }, [64, 84], { vowels: ['oo', 'ah'], bright: 0.65, wet: 0.65 }),
    S('низкий', [60, 100], 3.5, { choir: 1 }, [38, 58], { vowels: ['oo', 'oh', 'uh'], bright: 0.3, air: 0.7 }),
    S('воздух', [30, 60], 1.5, { choir: 1 }, [55, 79], { bright: 0.45, air: 1, wet: 0.7 }),
    S('плотный', [40, 80], 8, { choir: 1 }, [48, 76], { vowels: ['oh', 'ah', 'uh'], bright: 0.55 }),
  ] },
  { id: 'cello', name: 'Виолончели и хор', note: 'Живые виолончели (сэмплы) и хор: то одни, то другие, то вместе', sampled: true, trim: 1, scenes: [
    S('струнные', [60, 110], 4, { cello: 1, choir: 0.15 }, [40, 67], { bright: 0.45 }),
    S('вместе', [60, 100], 5, { cello: 0.7, choir: 0.7 }, [46, 72], { bright: 0.5 }),
    S('хор', [40, 80], 4, { choir: 1, cello: 0.1 }, [55, 79], { bright: 0.55 }),
    S('глубокие', [50, 90], 3, { cello: 1 }, [38, 55], { bright: 0.3, air: 0.8 }),
  ] },
  { id: 'harp', name: 'Арфа и голоса', note: 'Редкие фразы арфы (сэмплы) над хором, каждый раз другие и без повторов', sampled: true, trim: 1, scenes: [
    S('капли', [50, 100], 5, { harp: 1, choir: 0.5 }, [50, 72], { bright: 0.55, wet: 0.65 }),
    S('арфа соло', [40, 70], 7, { harp: 1 }, [55, 76], { bright: 0.6, air: 0.5, echo: 0.35 }),
    S('хор', [50, 90], 4, { choir: 1, harp: 0.2 }, [48, 74], { bright: 0.45 }),
    S('тихо', [30, 60], 2, { choir: 0.6, harp: 0.6 }, [55, 79], { bright: 0.4, air: 0.9 }),
  ] },
  { id: 'piano', name: 'Пианино и хор', note: 'Настоящее пианино играет короткие несвязные фразы, хор и виолончели его держат', sampled: true, trim: 1, scenes: [
    S('пианино', [50, 100], 5, { piano: 1, cello: 0.4 }, [43, 70], { pluckReg: [55, 76], bright: 0.5 }),
    S('хор', [50, 90], 4, { choir: 1, piano: 0.3 }, [50, 76], { bright: 0.5 }),
    S('виолончели', [50, 90], 3.5, { cello: 1, piano: 0.25 }, [40, 62], { bright: 0.4 }),
    S('пауза', [25, 50], 1.2, { choir: 0.6, cello: 0.5 }, [48, 72], { air: 1, wet: 0.7 }),
  ] },
  { id: 'night', name: 'Ночь, живая', note: 'Как «Ночь» по записи (низкий пульс 60), но пульс приходит и уходит, а под ним всё время что-то новое', sampled: true, trim: 1, scenes: [
    S('пульс и хор', [50, 90], 3.5, { choir: 1, cello: 0.4 }, [46, 74], { pulse: 60, bright: 0.45 }),
    S('пульс и арфа', [40, 80], 5, { harp: 0.9, choir: 0.5 }, [50, 72], { pulse: 60, bright: 0.5 }),
    S('без пульса', [40, 80], 3, { cello: 0.8, choir: 0.6 }, [40, 70], { bright: 0.4, air: 0.8 }),
    S('пульс и струнные', [50, 90], 4, { cello: 1, piano: 0.3 }, [40, 67], { pulse: 62, bright: 0.45 }),
  ] },
  { id: 'dark', name: 'Тёмный', note: 'Низкий регистр: басовые голоса и виолончели, редкие ноты, много воздуха', sampled: true, trim: 1, scenes: [
    S('низ', [60, 110], 3, { choir: 1, cello: 0.7 }, [36, 55], { vowels: ['oo', 'oh', 'uh'], bright: 0.25, air: 0.8, wet: 0.65 }),
    S('почти тишина', [30, 60], 1.2, { choir: 1 }, [40, 64], { bright: 0.3, air: 1 }),
    S('глубокие струны', [50, 90], 3, { cello: 1 }, [36, 52], { bright: 0.25, air: 0.7 }),
  ] },
  { id: 'all', name: 'Всё вместе', note: 'Самое разнообразное: все инструменты и больше сцен, звучание заметно меняется через каждые полторы минуты', sampled: true, trim: 1, scenes: [
    S('хор', [40, 80], 5, { choir: 1 }, [50, 76], { bright: 0.45 }),
    S('арфа', [40, 80], 6, { harp: 1, choir: 0.3 }, [50, 74], { bright: 0.55, wet: 0.65 }),
    S('пианино', [40, 80], 5, { piano: 1, cello: 0.3 }, [43, 70], { pluckReg: [55, 76], bright: 0.5 }),
    S('струнные', [40, 80], 4, { cello: 1, choir: 0.3 }, [38, 67], { bright: 0.4 }),
    S('пульс', [40, 70], 4, { choir: 0.7, cello: 0.7 }, [46, 72], { pulse: 60, bright: 0.45 }),
    S('воздух', [25, 50], 1.5, { choir: 1 }, [55, 79], { air: 1, wet: 0.7 }),
    S('высокий', [40, 70], 4, { choir: 0.8, harp: 0.6 }, [64, 84], { vowels: ['oo', 'ah'], bright: 0.65 }),
  ] },
  // calibration: one source alone, used by the loudness measurement only
  { id: 'cal-choir', name: 'cal', note: '', trim: 1, scenes: [S('c', [999, 999], 5, { choir: 1 }, [50, 72])] },
  { id: 'cal-cello', name: 'cal', note: '', trim: 1, scenes: [S('c', [999, 999], 5, { cello: 1 }, [40, 67])] },
  { id: 'cal-harp', name: 'cal', note: '', trim: 1, scenes: [S('c', [999, 999], 5, { harp: 1 }, [50, 72])] },
  { id: 'cal-piano', name: 'cal', note: '', trim: 1, scenes: [S('c', [999, 999], 5, { piano: 1 }, [43, 70], { pluckReg: [55, 76] })] },
];

/**
 * @param {BaseAudioContext} ctx
 * @param {{ preset?:string, samples?:Record<string,{midi:number,buffer:AudioBuffer}[]>, rng?:()=>number, destination?:AudioNode, volume?:number, onEvent?:(e:object)=>void }} [opts]
 */
export function createEvolvingEngine(ctx, opts = {}) {
  const P = PRESETS.find((x) => x.id === opts.preset) || PRESETS[0];
  const rng = opts.rng || Math.random, samples = opts.samples || {};
  let volume = clamp(opts.volume ?? 0.7, 0, 1), stopped = false, timer = null;
  const live = new Set(), node = (n) => { live.add(n); return n; };
  const gain = (x = 1) => { const g = node(ctx.createGain()); g.gain.value = x; return g; };
  const done = (o, ...ns) => { o.onended = () => { live.delete(o); try { o.disconnect(); ns.forEach((n) => n.disconnect()); } catch { /* gone */ } }; };
  const T0 = ctx.currentTime + 0.4;

  // ---- graph: voices -> (dry, room, echo) -> tone -> master ----
  const master = gain(0), tone = node(ctx.createBiquadFilter());
  tone.type = 'lowpass'; tone.frequency.value = 3200; tone.Q.value = 0.3;
  // only a limiter for safety: the level is kept even by the way the voices are laid out (lanes) and by matching the sources, not by squashing it
  const makeup = gain(0.9), limiter = node(ctx.createDynamicsCompressor()); limiter.threshold.value = -4; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.003; limiter.release.value = 0.2;
  master.connect(tone); tone.connect(makeup); makeup.connect(limiter); limiter.connect(opts.destination || ctx.destination);
  const conv = node(ctx.createConvolver()); conv.buffer = makeRoom(ctx, rng, 8);
  const roomIn = gain(1), roomOut = gain(0.55); roomIn.connect(conv); conv.connect(roomOut); roomOut.connect(master);
  const dl = node(ctx.createDelay(3)), dr = node(ctx.createDelay(3)), dtone = node(ctx.createBiquadFilter()), merger = node(ctx.createChannelMerger(2));
  dl.delayTime.value = 0.71; dr.delayTime.value = 1.07; dtone.type = 'lowpass'; dtone.frequency.value = 1500;
  const echoIn = gain(1), fb1 = gain(0.3), fb2 = gain(0.3), echoOut = gain(0.2);
  echoIn.connect(dtone); dtone.connect(dl); dl.connect(fb1); fb1.connect(dr); dr.connect(fb2); fb2.connect(dl); dl.connect(merger, 0, 0); dr.connect(merger, 0, 1); merger.connect(echoOut); echoOut.connect(master); echoOut.connect(roomIn);
  const bus = (dry, wet, ech) => { const i = gain(1), d = gain(dry), w = gain(wet), e = gain(ech); i.connect(d); d.connect(master); i.connect(w); w.connect(roomIn); if (ech) { i.connect(e); e.connect(echoIn); } return i; };
  const voiceBus = bus(0.85, 0.7, 0.15), pluckBus = bus(0.75, 0.7, 0.55), pulseBus = bus(0.9, 0.15, 0);

  // air: brown noise, low-passed
  const airSrc = node(ctx.createBufferSource()); airSrc.buffer = brown(ctx, rng, 14); airSrc.loop = true;
  const airLp = node(ctx.createBiquadFilter()), airGain = gain(0.04); airLp.type = 'lowpass'; airLp.frequency.value = 600; airSrc.connect(airLp); airLp.connect(airGain); airGain.connect(master); airSrc.start(T0);
  // a noise source for the choir's breath
  const white = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate); { const d = white.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rng() * 2 - 1; }

  master.gain.setValueAtTime(0, ctx.currentTime); master.gain.setTargetAtTime(volume * P.trim, ctx.currentTime + 0.2, 5);

  // ---- state ----
  let lg = 1, scene = null, sceneEnd = T0, chordName = pick(rng, ['Cadd9', 'Fmaj9', 'Am7']), chordEnd = T0 + between(rng, 70, 150), pluckAt = T0 + 4, pluckable = [], lanes = [], pulseAt = T0, pulseN = 0, wanderAt = T0, started = false;
  const chord = () => CHORDS[chordName];

  function pitchIn(reg, source) {
    const [lo, hi] = reg, c = chord(), base = source === 'pluck' ? c.arp : c.pad, pool = [];
    for (const n of base) for (let o = -24; o <= 24; o += 12) { const m = n + o; if (m >= lo && m <= hi) pool.push([m, n === c.pad[0] ? 1.5 : 1]); }
    // and a few notes of the key between the chord tones, so it is not only the chord
    for (let m = lo; m <= hi; m++) if ([0, 2, 4, 7, 9].includes(m % 12) && !pool.some(([x]) => x === m)) pool.push([m, 0.3]);
    return pool.length ? weighted(rng, pool) : lo;
  }

  function choirVoice(t, midi, dur) {
    const hz = mtof(midi), att = between(rng, 2.5, 5), rel = between(rng, 3, 6), end = t + dur + rel, peak = 0.28 * SRC_GAIN.choir * lg * (midi < 48 ? 0.8 : midi > 76 ? 0.7 : 1);
    const env = gain(0), pan = node(ctx.createStereoPanner()), sum = gain(1), breath = node(ctx.createBufferSource()), bg = gain(0.5);
    pan.pan.value = between(rng, -0.8, 0.8);
    env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(peak, t + att); env.gain.setValueAtTime(peak, t + dur); env.gain.linearRampToValueAtTime(0.0001, end);
    const vib = node(ctx.createOscillator()), vd = gain(0); vib.frequency.value = between(rng, 4.2, 5.4); vd.gain.setValueAtTime(0, t); vd.gain.linearRampToValueAtTime(hz * 0.0045, t + att + 1.2); vib.connect(vd); vib.start(t); vib.stop(end + 0.1);
    for (const cents of [-9, 0, 8]) { const o = node(ctx.createOscillator()); o.type = 'sawtooth'; o.frequency.value = hz; o.detune.value = cents + between(rng, -3, 3); vd.connect(o.frequency); o.connect(sum); o.start(t); o.stop(end + 0.1); done(o); }
    breath.buffer = white; breath.loop = true; breath.connect(bg); breath.start(t); breath.stop(end + 0.1);
    const [va, vb] = [pick(rng, scene.vowels), pick(rng, scene.vowels)], A = VOWELS[va], B = VOWELS[vb];
    A.forEach(([f, l, q], i) => {
      const bp = node(ctx.createBiquadFilter()), g = gain(l * 3); bp.type = 'bandpass'; bp.Q.value = q; bp.frequency.value = f; bp.frequency.setTargetAtTime(B[i][0], t + dur * between(rng, 0.2, 0.6), 1.8);
      sum.connect(bp); bg.connect(bp); bp.connect(g); g.connect(env);
    });
    env.connect(pan); pan.connect(voiceBus); done(vib, vd, env, pan);
    opts.onEvent?.({ t, type: 'note', midi, vel: 0.5, pan: pan.pan.value, dur: dur + rel, who: 'choir' });
    return dur + rel;
  }

  function celloVoice(t, midi) {
    const set = samples.cello; if (!set) return choirVoice(t, midi, between(rng, 8, 14));
    let best = set[0]; for (const x of set) if (Math.abs(x.midi - midi) < Math.abs(best.midi - midi)) best = x;
    const s = node(ctx.createBufferSource()), g = gain(0.0001), pan = node(ctx.createStereoPanner());
    s.buffer = best.buffer; s.playbackRate.value = 2 ** ((midi - best.midi) / 12); pan.pan.value = between(rng, -0.7, 0.7);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5 * SRC_GAIN.cello * lg, t + between(rng, 1.8, 3)); s.connect(g); g.connect(pan); pan.connect(voiceBus); s.start(t, 0.25); done(s, g, pan);
    opts.onEvent?.({ t, type: 'note', midi, vel: 0.5, pan: pan.pan.value, dur: 8, who: 'cello' });
    return (best.buffer.duration - 0.25) / s.playbackRate.value;
  }

  function pluckPhrase(t, who) {
    const set = samples[who]; if (!set) return choirVoice(t, pitchIn(scene.reg, 'pad'), between(rng, 8, 14));
    const n = 1 + Math.floor(rng() * 4), dir = pick(rng, [1, -1, 0]); let m = pitchIn(scene.pluckReg, 'pluck'), at = t;
    for (let i = 0; i < n; i++) {
      let best = set[0]; for (const x of set) if (Math.abs(x.midi - m) < Math.abs(best.midi - m)) best = x;
      const s = node(ctx.createBufferSource()), g = gain((who === 'harp' ? 0.5 : 0.55 - i * 0.05) * SRC_GAIN[who]), pan = node(ctx.createStereoPanner());
      s.buffer = best.buffer; s.playbackRate.value = 2 ** ((m - best.midi) / 12); pan.pan.value = between(rng, -0.6, 0.6);
      s.connect(g); g.connect(pan); pan.connect(pluckBus); s.start(at); done(s, g, pan);
      opts.onEvent?.({ t: at, type: 'note', midi: m, vel: 0.5, pan: pan.pan.value, dur: 3, who });
      at += between(rng, 0.35, 1.3); const nextPitch = pitchIn(scene.pluckReg, 'pluck'); m = dir === 0 ? nextPitch : clamp(m + dir * pick(rng, [2, 3, 4, 5]), scene.pluckReg[0], scene.pluckReg[1]);
    }
  }

  function pulse(t, strong) {
    const pc = chord().pad[0] % 12, hz = mtof(33 + ((pc - 9 + 12) % 12)), g = gain(0.0001), lp = node(ctx.createBiquadFilter());
    lp.type = 'lowpass'; lp.frequency.value = 300; lp.connect(g); g.connect(pulseBus);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(strong ? 0.4 : 0.27, t + 0.09); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.44);
    for (const [mul, lv] of [[1, 1], [2, 0.3]]) { const o = node(ctx.createOscillator()), og = gain(lv); o.type = 'sine'; o.frequency.value = hz * mul; o.connect(og); og.connect(lp); o.start(t); o.stop(t + 0.5); done(o, og); }
    opts.onEvent?.({ t, type: 'pulse', vel: 1 });
  }

  /** A slow random step of one parameter: new target now, reached over most of the time until the next step. */
  function step(param, center, spread, t, tc) { param.cancelScheduledValues(t); param.setTargetAtTime(Math.max(0.0001, center + between(rng, -spread, spread)), t, tc); }

  function enterScene(t) {
    const prev = scene; let tries = 0;
    do { scene = pick(rng, P.scenes); } while (scene === prev && P.scenes.length > 1 && ++tries < 9);
    sceneEnd = t + between(rng, scene.len[0], scene.len[1]);
    pulseAt = Math.max(pulseAt, t + 1);
    // the sustained voices live in lanes: each lane plays one voice after another, overlapping a little, so the number sounding at once stays steady
    const n = clamp(Math.round(scene.rate * 0.6), 2, 5); while (lanes.length < n) lanes.push({ at: t + between(rng, 0, 8) }); lanes.length = n; lg = (3 / n) ** 0.8; // fewer voices sounding: each one a little louder
    pluckable = Object.keys(scene.mix).filter((k) => (k === 'harp' || k === 'piano') && samples[k]);
    tone.frequency.cancelScheduledValues(t); tone.frequency.setTargetAtTime(1400 + scene.bright * 4600, t, 9);
    roomOut.gain.cancelScheduledValues(t); roomOut.gain.setTargetAtTime(scene.wet, t, 8);
    echoOut.gain.cancelScheduledValues(t); echoOut.gain.setTargetAtTime(scene.echo, t, 8);
    airGain.gain.cancelScheduledValues(t); airGain.gain.setTargetAtTime(0.012 + 0.075 * scene.air, t, 10);
    opts.onEvent?.({ t, type: 'scene', name: scene.name });
  }

  function scheduleTo(until) {
    if (stopped) return;
    if (!started) { started = true; enterScene(T0); }
    for (let guard = 0; guard < 3000; guard++) {
      let laneI = 0; lanes.forEach((l, i) => { if (l.at < lanes[laneI].at) laneI = i; });
      const laneAt = lanes.length ? lanes[laneI].at : Infinity;
      const next = Math.min(sceneEnd, chordEnd, laneAt, pluckAt, wanderAt, scene.pulse ? pulseAt : Infinity);
      if (next >= until) break;
      if (next === sceneEnd) enterScene(sceneEnd);
      else if (next === chordEnd) { chordName = weighted(rng, chord().next); chordEnd += between(rng, 70, 160); }
      else if (next === wanderAt) { // brightness, air and room take slow random steps: nothing here repeats
        const tc = between(rng, 3, 7); step(tone.frequency, 1400 + scene.bright * 4600, 700, wanderAt, tc); step(airGain.gain, 0.012 + 0.075 * scene.air, 0.012, wanderAt, tc); step(roomOut.gain, scene.wet, 0.06, wanderAt, tc);
        wanderAt += between(rng, 7, 20);
      } else if (next === pulseAt) { pulse(pulseAt, pulseN % 2 === 0); pulseN++; pulseAt += (30 / scene.pulse) * between(rng, 0.99, 1.01) * (rng() < 0.04 ? 2 : 1); }
      else if (next === laneAt) {
        const pool = Object.entries(scene.mix).filter(([k]) => k === 'choir' || (k === 'cello' && samples.cello)); if (!pool.length) pool.push(['choir', 1]);
        const who = weighted(rng, pool), midi = pitchIn(scene.reg, 'pad'), len = who === 'cello' ? celloVoice(laneAt, midi) : choirVoice(laneAt, midi, between(rng, 7, 16));
        lanes[laneI].at += Math.max(3, len - between(rng, 1.5, 4));
      } else { // pluckAt: a short phrase of harp or piano, now and then
        if (pluckable.length) pluckPhrase(pluckAt, weighted(rng, pluckable.map((k) => [k, scene.mix[k]])));
        pluckAt += clamp(-Math.log(1 - rng()) * (60 / (scene.rate * 0.8)), 2.5, 45);
      }
    }
  }

  if (!(ctx instanceof (globalThis.OfflineAudioContext || class {}))) { scheduleTo(ctx.currentTime + 5); timer = setInterval(() => scheduleTo(ctx.currentTime + 5), 1000); }

  return {
    scheduleTo, preset: P,
    setVolume(x) { volume = clamp(x, 0, 1); master.gain.setTargetAtTime(volume * P.trim, ctx.currentTime, 0.2); },
    stop(fadeS = 2) {
      if (stopped) return Promise.resolve(); stopped = true; if (timer) clearInterval(timer);
      master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(0, ctx.currentTime, fadeS / 4);
      return new Promise((resolve) => setTimeout(() => { for (const n of live) { try { n.stop?.(); } catch { /* not a source */ } try { n.disconnect(); } catch { /* gone */ } } live.clear(); resolve(); }, fadeS * 1000 + 200));
    },
  };
}
