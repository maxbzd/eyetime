// The three moods. A mood is a key, a handful of chords that may follow each other, and how sparse, bright and wet the sound is.
// Chords are semitone offsets from `root` (a MIDI note). `next` lists which chord may come after which, with a weight, so the
// order is a random walk and never a loop. Every note the player hears is a chord tone or a tone of the pentatonic `color`, so
// nothing can sound wrong, whatever the dice say.

/** @typedef {{ id:string, root:number, color:number[], range:[number,number], chords:{ name:string, notes:number[], next:[number,number][] }[], slots:number, period:[number,number], noteLen:[number,number], vel:[number,number], chordLen:[number,number], cutoff:[number,number], padLevel:number, wet:number, echo:number, texture:number, timbre:string, pulse:null|{ bpm:[number,number], p:number } }} Mood */

/** @type {Record<string, Mood>} */
export const MODES = {
  // Focus: D, bright but still. A little motion (four voices, a soft pulse) so the mind has something to rest on.
  focus: {
    id: 'focus', root: 62, color: [0, 2, 4, 7, 9], range: [0, 24],
    chords: [
      { name: 'Dadd9', notes: [-12, 0, 7, 14, 16], next: [[1, 3], [2, 3], [3, 2]] },
      { name: 'Bm7add9', notes: [-15, -3, 0, 7, 14], next: [[2, 3], [3, 2], [0, 2]] },
      { name: 'Gmaj9', notes: [-7, 5, 9, 16, 19], next: [[0, 4], [1, 2], [3, 2]] },
      { name: 'Em9sus', notes: [-10, 2, 9, 12, 16], next: [[2, 3], [0, 3]] },
    ],
    slots: 4, period: [13, 36], noteLen: [7, 13], vel: [0.22, 0.5], chordLen: [38, 76],
    cutoff: [520, 1900], padLevel: 1, wet: 0.5, echo: 0.3, texture: 0.04, timbre: 'felt',
    pulse: { bpm: [52, 60], p: 0.78 },
  },
  // Calm: A, open and slow. No pulse, glassier notes, more room.
  calm: {
    id: 'calm', root: 57, color: [0, 2, 4, 7, 9], range: [3, 27],
    chords: [
      { name: 'Aadd9', notes: [-12, 0, 4, 7, 14], next: [[1, 3], [2, 3], [3, 2]] },
      { name: 'F#m7', notes: [-15, -3, 0, 4, 7], next: [[2, 3], [0, 3], [3, 1]] },
      { name: 'Dmaj7', notes: [-7, -3, 0, 4, 14], next: [[0, 3], [3, 3], [1, 2]] },
      { name: 'Esus', notes: [-5, 2, 7, 9, 12], next: [[0, 4], [2, 2]] },
    ],
    slots: 3, period: [20, 50], noteLen: [9, 16], vel: [0.2, 0.42], chordLen: [50, 96],
    cutoff: [420, 1400], padLevel: 1, wet: 0.6, echo: 0.4, texture: 0.06, timbre: 'glass',
    pulse: null,
  },
  // Sleep: F, low and dark, almost no notes. It only breathes.
  sleep: {
    id: 'sleep', root: 53, color: [0, 2, 4, 7, 9], range: [-5, 19],
    chords: [
      { name: 'Fmaj9', notes: [-12, 0, 4, 7, 11, 14], next: [[1, 3], [2, 2], [3, 3]] },
      { name: 'Dm9', notes: [-15, -3, 0, 4, 7, 11], next: [[0, 3], [2, 2], [3, 2]] },
      { name: 'Bbmaj7', notes: [-7, 5, 9, 12, 16], next: [[0, 4], [3, 2]] },
      { name: 'Csus2', notes: [-5, 2, 7, 9, 14], next: [[0, 3], [1, 2]] },
    ],
    slots: 2, period: [30, 70], noteLen: [11, 18], vel: [0.14, 0.3], chordLen: [70, 130],
    cutoff: [260, 800], padLevel: 1.1, wet: 0.65, echo: 0.35, texture: 0.1, timbre: 'felt',
    pulse: null,
  },
};

export const MODE_IDS = Object.keys(MODES);
