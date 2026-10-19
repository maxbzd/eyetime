// Plays the two soft sounds (session start / end). Lives in an offscreen document because
// service workers have no Web Audio. Everything is synthesised — there are no audio files.

let ctx;
const audio = () => (ctx ||= new AudioContext());

function bowl() {
  const c = audio(), now = c.currentTime;
  const master = c.createGain(); master.gain.value = 0.5; master.connect(c.destination);
  // singing-bowl partials around G3
  for (const [freq, gain, decay] of [[196, .55, 4.6], [392.4, .33, 3.8], [588, .2, 3], [784.8, .12, 2.4], [98, .38, 4]]) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.07);
    g.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    o.connect(g); g.connect(master); o.start(now); o.stop(now + decay);
  }
}

function chime() {
  const c = audio(), now = c.currentTime;
  const master = c.createGain(); master.gain.value = 0.45; master.connect(c.destination);
  for (const [freq, delay, decay, gain] of [[528, 0, 3.2, .45], [660, .2, 3.4, .4], [1056, .42, 2.6, .22]]) {
    const o = c.createOscillator(), g = c.createGain(), t = now + delay;
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + decay);
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.target !== 'offscreen') return;
  if (msg.kind === 'start') bowl();
  else if (msg.kind === 'end') chime();
});
