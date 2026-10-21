// Plays the two soft sounds (session start / end, synthesised) and the ambient focus sound. Lives in an offscreen document
// because service workers have no Web Audio.

let ctx;
const audio = () => { ctx ||= new AudioContext(); if (ctx.state === 'suspended') ctx.resume?.(); return ctx; }; // a page-hosted context (Firefox) may start suspended

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

/* ---------- ambient sound: brown noise is synthesised; rain, river and forest are real recordings (CC0, see src/audio/CREDITS.md) ---------- */

const FILES = { rain: 'rain', river: 'river', forest: 'forest' };
const buffers = new Map(); // decoded once per context: ~22 MB each, loops gaplessly (the files are pre-crossfaded)
let ambient = null; // { kind, nodes[] }
let want = ''; // the sound that should be playing (guards against a slow decode finishing after a switch)

async function load(kind) {
  if (buffers.has(kind)) return buffers.get(kind);
  const res = await fetch(chrome.runtime.getURL(`src/audio/${FILES[kind]}.ogg`));
  const buf = await audio().decodeAudioData(await res.arrayBuffer());
  buffers.set(kind, buf);
  return buf;
}

function brownBuffer(c) {
  const len = c.sampleRate * 8, buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    const fade = 2000; // crossfade the seam so the loop is inaudible
    for (let i = 0; i < fade; i++) { const k = i / fade; d[i] = d[i] * k + d[len - fade + i] * (1 - k); }
  }
  return buf;
}

async function startAmbient(kind) {
  if (ambient && ambient.kind === kind) return;
  stopAmbient();
  want = kind; // after stopAmbient(), which clears it
  const c = audio(); c.resume?.();
  let buf;
  if (kind === 'brown') buf = brownBuffer(c);
  else if (FILES[kind]) { try { buf = await load(kind); } catch { return; } } else return;
  if (want !== kind) return; // switched or stopped while decoding
  const out = c.createGain(); out.gain.value = 0; out.connect(c.destination);
  out.gain.linearRampToValueAtTime(kind === 'brown' ? 0.28 : 0.9, c.currentTime + 2.5);
  const src = c.createBufferSource(); src.buffer = buf; src.loop = true; src.start();
  const nodes = [out, src];
  if (kind === 'brown') { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; src.connect(lp); lp.connect(out); nodes.push(lp); }
  else src.connect(out);
  ambient = { kind, nodes };
}

function stopAmbient() {
  want = '';
  if (!ambient) return;
  const { nodes } = ambient; ambient = null;
  const out = nodes[0];
  try { out.gain.cancelScheduledValues(0); out.gain.setTargetAtTime(0, audio().currentTime, 0.4); } catch { /* ignore */ }
  setTimeout(() => nodes.forEach((n) => { try { n.stop?.(); n.disconnect?.(); } catch { /* already stopped */ } }), 2000);
}

/** For tests: what is playing and how long the decoded loop is. */
export function ambientState() { return { kind: ambient ? ambient.kind : '', seconds: ambient ? Math.round(ambient.nodes[1].buffer.duration) : 0 }; }

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
