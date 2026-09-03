// EyeTime — Procedural Web Audio Sound Generator
// Authentic Tibetan Singing Bowl (Gong) for Deep Focus & Solfeggio Victory Chime

const EyeTimeAudio = (function () {
  let audioCtx = null;

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Deep resonant Tibetan singing bowl gong
  function playFocusGong() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Authentic acoustic Tibetan singing bowl partials (Fundamental ~196 Hz G3)
      const partials = [
        { freq: 196.0, gain: 0.55, decay: 4.8 },  // Fundamental
        { freq: 392.4, gain: 0.35, decay: 4.0 },  // 2nd harmonic
        { freq: 588.0, gain: 0.22, decay: 3.2 },  // 3rd harmonic
        { freq: 784.8, gain: 0.14, decay: 2.5 },  // 4th harmonic
        { freq: 1176.0, gain: 0.08, decay: 1.8 }, // 6th harmonic
        { freq: 98.0, gain: 0.40, decay: 4.2 }    // Sub-harmonic warmth
      ];

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.75, now);
      masterGain.connect(ctx.destination);

      partials.forEach(p => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(p.freq, now);

        // Subtle acoustic beating / shimmer (2.1 Hz)
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.setValueAtTime(2.1, now);
        lfoGain.gain.setValueAtTime(0.9, now);
        lfo.connect(osc.frequency);
        lfo.start(now);
        lfo.stop(now + p.decay);

        // Natural strike envelope
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(p.gain, now + 0.07);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(now);
        osc.stop(now + p.decay);
      });
    } catch (e) {
      console.warn('EyeTime Audio: Gong play error', e);
    }
  }

  // Gentle Solfeggio crystal victory chime (Focus session completed)
  function playCompletionChime() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Solfeggio 528 Hz (Transformation & Clarity) + Harmonious overtones
      const notes = [
        { freq: 528.0, delay: 0.00, decay: 3.5, gain: 0.45 },
        { freq: 660.0, delay: 0.20, decay: 3.8, gain: 0.40 },
        { freq: 1056.0, delay: 0.42, decay: 2.8, gain: 0.25 }
      ];

      notes.forEach(n => {
        const start = now + n.delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.freq, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(n.gain, start + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + n.decay);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + n.decay);
      });
    } catch (e) {
      console.warn('EyeTime Audio: Chime play error', e);
    }
  }

  return {
    playFocusGong,
    playCompletionChime
  };
})();

if (typeof window !== 'undefined') {
  window.EyeTimeAudio = EyeTimeAudio;
}
