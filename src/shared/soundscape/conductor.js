// The conductor: decides what plays next, and nothing else. It knows nothing about audio. Ask it for the events up to a
// moment (`advance(until)`) and it answers with plain objects; the engine turns them into sound, a test turns them into
// numbers. Time is seconds on the audio clock.
//
// Where the variety comes from (the idea is the same as in generative.fm's "Eno Machine" and "Drones", MIT, Alex Bainter):
//  - every voice repeats on its own random period, so the voices drift in and out of phase and a combination never returns;
//  - the chords follow a random walk over a small graph, with a random length each;
//  - now and then the key moves by a fifth or a fourth and, a little later, back;
//  - the generator is seeded from Math.random() on every start.
// What keeps it pleasant is the other half: only chord tones and the key's pentatonic notes ever sound.

import { MODES } from './modes.js';
import { between, pick, weighted, clamp } from './theory.js';

/**
 * @typedef {{ t:number, type:'chord', notes:number[], dur:number, overlap:number, name:string }
 *   | { t:number, type:'note', midi:number, dur:number, vel:number, pan:number }
 *   | { t:number, type:'pulse', midi:number, vel:number }} SoundEvent
 */

const DRIFT_EVERY_S = 360; // the key may move at most this often

export function createConductor({ mode = 'focus', rng = Math.random, start = 0, intensity = 0.8 } = {}) {
  let m = MODES[mode] || MODES.focus;
  let level = clamp(intensity, 0, 1);
  let shift = 0;                 // key offset in semitones, kept within ±7
  let lastDrift = start - DRIFT_EVERY_S / 2;
  let chordIdx = -1, chord = null, chordAt = start, chordEnd = start;
  let slots = [];
  let lastMidi = -1;
  let beat = { at: start, n: 0, bpm: m.pulse ? between(rng, ...m.pulse.bpm) : 60 };
  let pending = false;           // the mood changed: the next chord is taken from the new mood

  const density = () => 0.55 + 0.9 * level;

  function makeSlots(t0) {
    slots = [];
    for (let i = 0; i < m.slots; i++) slots.push({ period: between(rng, m.period[0], m.period[1]), at: t0 + between(rng, 1, m.period[0]), last: -1 });
  }

  function nextChord(t) {
    const cur = pending || chordIdx < 0 ? null : m.chords[chordIdx];
    pending = false;
    chordIdx = cur ? weighted(rng, cur.next) : Math.floor(rng() * m.chords.length);
    if (t - lastDrift >= DRIFT_EVERY_S && rng() < 0.18) {
      let d = pick(rng, [5, 7, -5, -7]);
      if (Math.abs(shift + d) > 7) d = -d;
      shift += d; lastDrift = t;
    }
    const def = m.chords[chordIdx];
    const len = between(rng, m.chordLen[0], m.chordLen[1]);
    const overlap = Math.min(16, len * 0.28);
    chord = { name: def.name, notes: def.notes.map((n) => m.root + shift + n), pcs: new Set(def.notes.map((n) => ((n % 12) + 12) % 12)) }; // relative to the (shifted) key, like `rel` in choosePitch
    chordAt = t; chordEnd = t + len;
    // each chord, half the voices get a new period, so the pattern of the voices is never the same twice
    for (const s of slots) if (rng() < 0.5) s.period = between(rng, m.period[0], m.period[1]);
    return /** @type {SoundEvent} */ ({ t, type: 'chord', notes: chord.notes, dur: len + overlap, overlap, name: def.name });
  }

  /** One pitch for a voice: chord tones are three times as likely as the other notes of the key's pentatonic scale. */
  function choosePitch(slot) {
    const lo = m.root + shift + m.range[0], hi = m.root + shift + m.range[1];
    const pool = [];
    for (let x = lo; x <= hi; x++) {
      const rel = (((x - m.root - shift) % 12) + 12) % 12;
      const inChord = chord.pcs.has(rel);
      if (!inChord && !m.color.includes(rel)) continue;
      if (x === lastMidi || x === slot.last) continue; // no immediate repeats
      pool.push([x, inChord ? 3 : 1]);
    }
    return pool.length ? weighted(rng, pool) : chord.notes[chord.notes.length - 1];
  }

  /** @returns {SoundEvent[]} */
  function advance(until) {
    const out = [];
    if (!chord) { makeSlots(chordAt); out.push(nextChord(chordAt)); }
    for (let guard = 0; guard < 5000; guard++) {
      // the earliest thing that is due
      let kind = 'chord', at = chordEnd;
      let which = -1;
      slots.forEach((s, i) => { if (s.at < at) { kind = 'slot'; at = s.at; which = i; } });
      if (m.pulse && beat.at < at) { kind = 'pulse'; at = beat.at; }
      if (at >= until) break;
      if (kind === 'chord') out.push(nextChord(at));
      else if (kind === 'slot') {
        const s = slots[which];
        const midi = choosePitch(s);
        const dur = between(rng, m.noteLen[0], m.noteLen[1]);
        const vel = between(rng, m.vel[0], m.vel[1]) * (0.7 + 0.3 * level);
        out.push({ t: at, type: 'note', midi, dur, vel, pan: between(rng, -0.65, 0.65) });
        s.last = midi; lastMidi = midi;
        s.at = at + (s.period / density()) * between(rng, 0.85, 1.2);
      } else {
        // a soft pulse on the low root of the chord, a little uneven and with gaps, never a drum machine
        const spb = 60 / beat.bpm;
        if (level > 0.35 && rng() < m.pulse.p) out.push({ t: at, type: 'pulse', midi: chord.notes[0] + 12, vel: (beat.n % 4 === 0 ? 1 : 0.55) * (0.6 + 0.4 * level) });
        beat.n++;
        beat.bpm = clamp(beat.bpm + between(rng, -0.6, 0.6), m.pulse.bpm[0], m.pulse.bpm[1]);
        beat.at = at + spb * between(rng, 0.985, 1.015);
      }
    }
    out.sort((a, b) => a.t - b.t);
    return out;
  }

  return {
    advance,
    /** 0..1: more notes and a brighter sound when higher. */
    setIntensity(x) { level = clamp(x, 0, 1); },
    /** Switch mood. The chord that sounds now finishes; the next one is chosen in the new mood. */
    setMode(id, now = 0) {
      const next = MODES[id]; if (!next || next === m) return;
      m = next; pending = true; shift = 0;
      if (m.pulse) beat = { at: Math.max(beat.at, now), n: 0, bpm: between(rng, ...m.pulse.bpm) };
      for (const s of slots) s.period = between(rng, m.period[0], m.period[1]);
      while (slots.length < m.slots) slots.push({ period: between(rng, m.period[0], m.period[1]), at: now + between(rng, 1, m.period[0]), last: -1 });
      slots.length = m.slots;
      chordEnd = Math.min(chordEnd, now + 6); // the old chord has had its time
    },
    mood: () => m,
    state: () => ({ mode: m.id, chord: chord && chord.name, shift, intensity: level }),
  };
}
