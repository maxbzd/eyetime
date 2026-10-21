// Builds store packages in dist/:  eyetime-chrome.zip (Chrome + Edge, MV3)  and  eyetime-firefox.zip (Firefox AMO).
//   npm run build
// Needs the `zip` CLI (or Python 3 as a fallback).
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const INCLUDE = ['src', '_locales', 'icons', 'LICENSE'];
const SKIP = /(\.md$|\.d\.ts$|icon512\.png$|LICENSE-.*\.txt$)/; // docs and store-only assets stay out of the package; font/icon licences ship in src/ui/

fs.rmSync(dist, { recursive: true, force: true });

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) {
    const a = path.join(from, f), b = path.join(to, f);
    if (fs.statSync(a).isDirectory()) copyTree(a, b);
    else if (!SKIP.test(f) || /LICENSE-(Inter|Lucide)\.txt$/.test(f)) fs.copyFileSync(a, b);
  }
}

function stage(name, transform) {
  const dir = path.join(dist, name);
  for (const item of INCLUDE) {
    const src = path.join(root, item);
    if (fs.statSync(src).isDirectory()) copyTree(src, path.join(dir, item)); else { fs.mkdirSync(dir, { recursive: true }); fs.copyFileSync(src, path.join(dir, item)); }
  }
  const m = JSON.parse(JSON.stringify(manifest));
  transform?.(m);
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(m, null, 2));
  return dir;
}

function zip(dir, out) {
  try { cp.execFileSync('zip', ['-qr', out, '.'], { cwd: dir }); }
  catch { cp.execFileSync('python3', ['-c', 'import shutil,sys; shutil.make_archive(sys.argv[1][:-4], "zip", sys.argv[2])', out, dir]); }
  console.log(`✓ ${path.relative(root, out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
}

const chrome = stage('chrome');
zip(chrome, path.join(dist, 'eyetime-chrome.zip'));

const firefox = stage('firefox', (m) => {
  delete m.minimum_chrome_version;
  m.permissions = m.permissions.filter((p) => !['offscreen', 'favicon'].includes(p)); // Chrome-only APIs; the code feature-detects them
  m.background = { scripts: ['src/background/index.js'], type: 'module' };
  m.browser_specific_settings = { gecko: { id: 'eyetime@maxbzd.github.io', strict_min_version: '142.0', data_collection_permissions: { required: ['none'] } } };
});
zip(firefox, path.join(dist, 'eyetime-firefox.zip'));
