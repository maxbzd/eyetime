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

/* ---------- ambient sound: noise synthesised from a looped buffer, gently shaped per scene ---------- */

let ambient = null; // { kind, nodes[] }

function noiseBuffer(c, type) {
  const len = c.sampleRate * 8, buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w * 0.5;
    }
    // crossfade the seam so the loop is inaudible
    const fade = 2000;
    for (let i = 0; i < fade; i++) { const k = i / fade; d[i] = d[i] * k + d[len - fade + i] * (1 - k); }
  }
  return buf;
}

function startAmbient(kind) {
  if (ambient && ambient.kind === kind) return;
  stopAmbient();
  const c = audio(); c.resume?.();
  const out = c.createGain(); out.gain.value = 0; out.connect(c.destination);
  out.gain.linearRampToValueAtTime(kind === 'rain' ? 0.32 : 0.28, c.currentTime + 2.5);
  const nodes = [out];
  const src = (type) => { const s = c.createBufferSource(); s.buffer = noiseBuffer(c, type); s.loop = true; s.start(); nodes.push(s); return s; };
  if (kind === 'brown') {
    const s = src('brown'), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    s.connect(lp); lp.connect(out); nodes.push(lp);
  } else if (kind === 'rain') {
    const s = src('white'), hp = c.createBiquadFilter(), lp = c.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 700; lp.type = 'lowpass'; lp.frequency.value = 7000;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.13; lg.gain.value = 0.06; lfo.connect(lg); lg.connect(out.gain); lfo.start(); nodes.push(lfo, lg, hp, lp);
    s.connect(hp); hp.connect(lp); lp.connect(out);
    const s2 = src('brown'), lp2 = c.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 500; const g2 = c.createGain(); g2.gain.value = 0.5; s2.connect(lp2); lp2.connect(g2); g2.connect(out); nodes.push(lp2, g2);
  } else if (kind === 'cafe') {
    // low room tone + a slowly shifting band of "voices"
    const room = src('brown'), rl = c.createBiquadFilter(); rl.type = 'lowpass'; rl.frequency.value = 600; room.connect(rl); rl.connect(out); nodes.push(rl);
    const talk = src('white'), bp = c.createBiquadFilter(), tg = c.createGain(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8; tg.gain.value = 0.16;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.21; lg.gain.value = 0.09; lfo.connect(lg); lg.connect(tg.gain); lfo.start();
    const lfo2 = c.createOscillator(), lg2 = c.createGain(); lfo2.frequency.value = 0.07; lg2.gain.value = 350; lfo2.connect(lg2); lg2.connect(bp.frequency); lfo2.start();
    talk.connect(bp); bp.connect(tg); tg.connect(out); nodes.push(bp, tg, lfo, lg, lfo2, lg2);
  } else return;
  ambient = { kind, nodes };
}

function stopAmbient() {
  if (!ambient) return;
  const { nodes } = ambient; ambient = null;
  const out = nodes[0];
  try { out.gain.cancelScheduledValues(0); out.gain.setTargetAtTime(0, audio().currentTime, 0.4); } catch { /* ignore */ }
  setTimeout(() => nodes.forEach((n) => { try { n.stop?.(); n.disconnect?.(); } catch { /* already stopped */ } }), 2000);
}

/** One entry point for both homes of this code: the Chrome offscreen document (via messages) and, where there is
 *  no offscreen API (Firefox: the background is an event *page* with Web Audio), a direct call from audio.js. */
export function handle(msg) {
  if (msg?.target !== 'offscreen') return;
  if (msg.kind === 'start') bowl();
  else if (msg.kind === 'end') chime();
  else if (msg.kind === 'ambient-start') startAmbient(msg.sound);
  else if (msg.kind === 'ambient-stop') stopAmbient();
}

if (typeof location !== 'undefined' && location.pathname.endsWith('offscreen.html')) chrome.runtime.onMessage.addListener((msg) => handle(msg));
