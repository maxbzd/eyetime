import test from 'node:test';
import assert from 'node:assert/strict';
import { createConductor } from '../../src/shared/soundscape/conductor.js';
import { MODES, MODE_IDS } from '../../src/shared/soundscape/modes.js';
import { sessionIntensity, modeFor } from '../../src/shared/soundscape/session.js';
import { seeded, mtof } from '../../src/shared/soundscape/theory.js';

const run = (mode, seed, seconds, intensity = 0.8) => { const c = createConductor({ mode, rng: seeded(seed), intensity }); return { c, ev: c.advance(seconds) }; };

test('the same seed plays the same music; another seed plays other music', () => {
  const a = run('focus', 7, 600).ev, b = run('focus', 7, 600).ev, c = run('focus', 8, 600).ev;
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.filter((e) => e.type === 'note').map((e) => e.midi), c.filter((e) => e.type === 'note').map((e) => e.midi));
});

test('events come out in time order, and asking in pieces gives the same as asking at once', () => {
  const whole = run('calm', 3, 900).ev;
  assert.ok(whole.every((e, i) => i === 0 || e.t >= whole[i - 1].t));
  const c = createConductor({ mode: 'calm', rng: seeded(3), intensity: 0.8 });
  const parts = []; for (let t = 5; t <= 900; t += 5) parts.push(...c.advance(t));
  assert.deepEqual(parts.map((e) => [e.type, +e.t.toFixed(6)]), whole.map((e) => [e.type, +e.t.toFixed(6)]));
});

test('every note is a tone of the current chord or of the key\'s pentatonic scale (nothing can be wrong)', () => {
  for (const id of MODE_IDS) for (const seed of [1, 2, 3]) {
    const m = MODES[id], { c, ev } = run(id, seed, 3600);
    let chord = null, shift = 0; void c;
    for (const e of ev) {
      if (e.type === 'chord') { chord = e; shift = (e.notes[0] - m.root - m.chords.find((x) => x.name === e.name).notes[0]); continue; }
      if (e.type !== 'note') continue;
      const rel = (((e.midi - m.root - shift) % 12) + 12) % 12;
      const def = m.chords.find((x) => x.name === chord.name);
      const chordPcs = def.notes.map((n) => ((n % 12) + 12) % 12);
      assert.ok(chordPcs.includes(rel) || m.color.includes(rel), `${id}: ${e.midi} (${rel}) over ${chord.name}`);
      assert.ok(e.midi >= m.root + shift + m.range[0] && e.midi <= m.root + shift + m.range[1]);
    }
  }
});

test('chords follow the allowed graph, last their set length and the key stays within a fifth of home', () => {
  for (const id of MODE_IDS) {
    const m = MODES[id], chords = run(id, 11, 4 * 3600).ev.filter((e) => e.type === 'chord');
    assert.ok(chords.length > 50);
    let shiftSeen = 0;
    chords.forEach((e, i) => {
      const idx = m.chords.findIndex((x) => x.name === e.name), def = m.chords[idx];
      shiftSeen = Math.max(shiftSeen, Math.abs(e.notes[0] - m.root - def.notes[0]));
      if (i) { const prev = m.chords.findIndex((x) => x.name === chords[i - 1].name); assert.ok(m.chords[prev].next.some(([k]) => k === idx), `${id}: ${m.chords[prev].name} -> ${e.name}`); }
      if (i) { const len = e.t - chords[i - 1].t; assert.ok(len >= m.chordLen[0] - 1e-6 && len <= m.chordLen[1] + 1e-6, `length ${len}`); }
    });
    assert.ok(shiftSeen <= 7);
  }
});

test('the key does drift now and then over a long listen', () => {
  const m = MODES.focus, chords = run('focus', 5, 6 * 3600).ev.filter((e) => e.type === 'chord');
  const shifts = new Set(chords.map((e) => e.notes[0] - m.root - m.chords.find((x) => x.name === e.name).notes[0]));
  assert.ok(shifts.size > 1);
});

test('there is never a long silence between notes (the chord pad plays all the time besides)', () => {
  for (const id of MODE_IDS) for (const [x, limit] of [[0.8, 90], [0, 240]]) {
    const notes = run(id, 4, 2 * 3600, x).ev.filter((e) => e.type === 'note');
    let worst = 0; for (let i = 1; i < notes.length; i++) worst = Math.max(worst, notes[i].t - notes[i - 1].t);
    assert.ok(worst < limit, `${id} at ${x}: ${worst}`);
  }
});

test('more intensity means more notes; sleep is sparser than focus', () => {
  const count = (mode, x) => run(mode, 9, 1800, x).ev.filter((e) => e.type === 'note').length;
  assert.ok(count('focus', 1) > count('focus', 0.1) * 1.4);
  assert.ok(count('sleep', 0.8) < count('focus', 0.8) / 1.3);
});

test('the pulse exists only in Focus, only when it is lively enough, and is soft and uneven', () => {
  const pulses = (mode, x) => run(mode, 2, 300, x).ev.filter((e) => e.type === 'pulse');
  assert.ok(pulses('focus', 0.9).length > 150 && pulses('focus', 0.9).length < 300);
  assert.equal(pulses('focus', 0.2).length, 0);
  assert.equal(pulses('calm', 0.9).length, 0);
  assert.equal(pulses('sleep', 0.9).length, 0);
});

test('changing the mood mid-way: the next chord is of the new mood, and nothing from the old one comes back', () => {
  const c = createConductor({ mode: 'focus', rng: seeded(6), intensity: 0.8 });
  c.advance(120); c.setMode('sleep', 120);
  const after = c.advance(900).filter((e) => e.t > 130);
  const names = new Set(MODES.sleep.chords.map((x) => x.name));
  assert.ok(after.filter((e) => e.type === 'chord').every((e) => names.has(e.name)));
  assert.equal(after.filter((e) => e.type === 'pulse').length, 0);
  assert.equal(c.state().mode, 'sleep');
});

test('a session: settles in, stays, thins out at the end; with no session it stays steady', () => {
  const T = 1500;
  assert.ok(sessionIntensity(0, T) < 0.45);
  assert.ok(sessionIntensity(T / 2, T) > 0.8);
  assert.ok(sessionIntensity(T - 5, T) < 0.5);
  for (let t = 0; t < T; t += 7) { const x = sessionIntensity(t, T); assert.ok(x >= 0 && x <= 1); }
  const open = [0, 300, 900, 4000].map((t) => sessionIntensity(t, 0));
  assert.ok(Math.max(...open) - Math.min(...open) < 0.1);
  assert.ok(sessionIntensity(10, 60) >= 0); // a very short session does not break the ramps
});

test('moods for the moment', () => {
  assert.equal(modeFor({ focusing: true, hour: 23 }), 'focus');
  assert.equal(modeFor({ resting: true, hour: 10 }), 'calm');
  assert.equal(modeFor({ hour: 23 }), 'sleep');
  assert.equal(modeFor({ hour: 3 }), 'sleep');
  assert.equal(modeFor({ hour: 14 }), 'calm');
});

test('pitch maths', () => { assert.equal(mtof(69), 440); assert.ok(Math.abs(mtof(60) - 261.6256) < 1e-3); });
