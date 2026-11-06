// Packs the few instrument samples the generative sound uses into small .ogg files and writes a manifest.
//   node scripts-dev/build-samples.mjs /path/to/VSCO-2-CE [outDir]
// Source: VS Chamber Orchestra: Community Edition (Versilian Studios; recorded by Sam Gossner and Simon Dalzell; the upright
// piano by Simon Dalzell of Ivy Audio). CC0 1.0. See src/audio/CREDITS.txt. Needs ffmpeg with libvorbis.
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const src = process.argv[2];
const out = process.argv[3] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src/audio/samples');
if (!src) { console.error('usage: build-samples.mjs <VSCO-2-CE dir> [outDir]'); process.exit(1); }
fs.mkdirSync(out, { recursive: true });
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midi = (name) => { const m = /^([A-G])(#?)(\d)$/.exec(name); return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] ? 1 : 0); };

const SETS = {
  piano: { dir: 'Keys/Upright Nr1', pick: (f) => /^UR1_(C|G)\d_pp_RR1\.wav$/.test(f) && ['C2', 'G2', 'C3', 'G3', 'C4', 'G4', 'C5', 'G5'].includes(f.split('_')[1]), note: (f) => f.split('_')[1], secs: 6.5, fade: 1.8, ch: 1, q: 2 },
  harp: { dir: 'Strings/Harp', pick: (f) => ['A2', 'A4', 'B3', 'C3', 'C5', 'D4', 'D6', 'E3', 'E5', 'G3', 'G5', 'A6'].includes(f.split('_')[1]), note: (f) => f.split('_')[1], secs: 5, fade: 1.5, ch: 1, q: 2 },
  cello: { dir: 'Strings/Cello Section/susvib', pick: (f) => /^susvib_(A2|C3|D2|D4|E3|F2|G3)_v1_1\.wav$/.test(f), note: (f) => f.split('_')[1], secs: 8, fade: 2.2, ch: 2, q: 1 },
};
const manifest = {};
for (const [id, s] of Object.entries(SETS)) {
  const dir = path.join(src, s.dir); manifest[id] = [];
  for (const f of fs.readdirSync(dir).filter(s.pick).sort()) {
    const name = s.note(f), file = `${id}-${name}.ogg`;
    cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(dir, f), '-t', String(s.secs), '-af', `afade=t=out:st=${s.secs - s.fade}:d=${s.fade},loudnorm=I=-24:TP=-3:LRA=7`, '-ac', String(s.ch), '-ar', '32000', '-c:a', 'libvorbis', '-q:a', String(s.q), path.join(out, file)]);
    manifest[id].push({ note: name, midi: midi(name), file });
  }
  manifest[id].sort((a, b) => a.midi - b.midi);
}
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 1));
const total = fs.readdirSync(out).filter((f) => f.endsWith('.ogg')).reduce((n, f) => n + fs.statSync(path.join(out, f)).size, 0);
console.log(`${Object.values(manifest).flat().length} samples, ${(total / 1024).toFixed(0)} KB`);
