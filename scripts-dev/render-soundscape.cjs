// Renders the generative sound to audio files so it can be listened to without a browser extension:
//   node scripts-dev/render-soundscape.cjs [--engine mood|rhythm|method] [--modes focus,calm,sleep | triplet,pump,...] [--seconds 150] [--seed 1] [--intensity 0.8] [--out /tmp/dir]
// It runs the real engine (src/shared/soundscape/engine.js) in Chromium on an OfflineAudioContext, writes a WAV (and an MP3
// when ffmpeg is there) and prints the peak and the loudness per 10 s so clipping or dropouts show up as numbers.
const http = require('http'), fs = require('fs'), path = require('path'), cp = require('child_process');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const engineKind = arg('engine', 'mood');
const modes = arg('modes', 'focus,calm,sleep').split(',');
const seconds = +arg('seconds', 150), seed = +arg('seed', 1), intensity = +arg('intensity', 0.8);
const out = arg('out', path.join(process.cwd(), 'soundscape-preview'));
const root = path.resolve(__dirname, '..');
fs.mkdirSync(out, { recursive: true });

const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (req.url === '/') { res.setHeader('content-type', 'text/html'); return res.end('<!doctype html><title>render</title>'); }
  if (!p.startsWith(root) || !fs.existsSync(p)) { res.statusCode = 404; return res.end(); }
  res.setHeader('content-type', p.endsWith('.js') ? 'text/javascript' : 'application/octet-stream'); res.end(fs.readFileSync(p));
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(base + '/');
  for (const mode of modes) {
    const res = await page.evaluate(async ({ base, mode, seconds, seed, intensity, engineKind }) => {
      const { createEngine } = await import(base + '/src/shared/soundscape/engine.js');
      const { createRhythmEngine } = await import(base + '/src/shared/soundscape/rhythm.js');
      const methods = await import(base + '/src/shared/soundscape/methods.js').catch(() => null);
      const { seeded } = await import(base + '/src/shared/soundscape/theory.js');
      const { sessionIntensity } = await import(base + '/src/shared/soundscape/session.js');
      const rate = 44100, ctx = new OfflineAudioContext(2, rate * seconds, rate);
      const eng = engineKind === 'rhythm' ? createRhythmEngine(ctx, { variant: mode, rng: seeded(seed), volume: 0.8 })
        : engineKind === 'method' ? methods.createMethod(ctx, mode, { rng: seeded(seed), volume: 0.8 })
        : createEngine(ctx, { mode, rng: seeded(seed), intensity, volume: 0.8 });
      eng.scheduleTo(seconds + 1);
      const buf = await ctx.startRendering();
      const L = buf.getChannelData(0), R = buf.getChannelData(1);
      let peak = 0; const win = rate * 10, rms = [];
      for (let i = 0; i < L.length; i += win) { let s = 0, n = 0; for (let j = i; j < Math.min(L.length, i + win); j++) { s += L[j] * L[j] + R[j] * R[j]; n += 2; const a = Math.max(Math.abs(L[j]), Math.abs(R[j])); if (a > peak) peak = a; } rms.push(Math.sqrt(s / n)); }
      const pcm = new Int16Array(L.length * 2);
      for (let i = 0; i < L.length; i++) { pcm[2 * i] = Math.max(-1, Math.min(1, L[i])) * 32767; pcm[2 * i + 1] = Math.max(-1, Math.min(1, R[i])) * 32767; }
      const b = new Uint8Array(pcm.buffer); let bin = ''; for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
      return { b64: btoa(bin), peak, rms, rate };
    }, { base, mode, seconds, seed, intensity, engineKind });
    const raw = Buffer.from(res.b64, 'base64'), hdr = Buffer.alloc(44);
    hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + raw.length, 4); hdr.write('WAVEfmt ', 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
    hdr.writeUInt32LE(res.rate, 24); hdr.writeUInt32LE(res.rate * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(raw.length, 40);
    const wav = path.join(out, `${mode}.wav`); fs.writeFileSync(wav, Buffer.concat([hdr, raw]));
    try { cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-b:a', '128k', path.join(out, `${mode}.mp3`)]); fs.unlinkSync(wav); } catch { /* keep the wav */ }
    const db = (x) => (20 * Math.log10(Math.max(x, 1e-6))).toFixed(1);
    console.log(`${mode.padEnd(6)} ${seconds}s  peak ${db(res.peak)} dBFS${res.peak >= 0.999 ? '  CLIPS' : ''}  rms/10s: ${res.rms.map(db).join(' ')}`);
  }
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
