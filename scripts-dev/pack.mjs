// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Builds store packages in dist/:  eyetime-chrome.zip (Chrome + Edge, MV3)  and  eyetime-firefox.zip (Firefox AMO).
//   npm run build
// What is shipped is the production build of src/ (scripts/build.mjs: bundled and minified), not the source tree; EYETIME_BUILD=source ships the tree as it is (for a bug that
// only the shipped code shows, or for reading). The zips are deterministic (scripts-dev/zip.mjs): the same source gives the same bytes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildInto } from './build.mjs';
import { writeZip, filesUnder } from './zip.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = process.env.EYETIME_DIST ? path.resolve(process.env.EYETIME_DIST) : path.join(root, 'dist'); // EYETIME_DIST: build somewhere else (the tests, the verification of a release)
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const INCLUDE = ['src', '_locales', 'icons', 'LICENSE', 'NOTICE'];
const SKIP = /(\.md$|\.d\.ts$|icon512\.png$)/;
// the translations are read as data at run time (locales/data/*.json); only English (the fallback) and the list of names are code there, the other .js files are for the tools and the tests
// earlier experiments kept for reference (nothing imports them): they are not part of what is shipped
const PARKED = /[\\/]shared[\\/]packs[\\/]parked[\\/]/;
const LOCALE_CODE = /[\\/]shared[\\/]locales[\\/](?!en\.js$|languages\.js$)[^\\/]+\.js$/; // docs and store-only assets stay out of the package; the LICENSE-*.txt notices of fonts, icons and the cut-out model ship with them

fs.rmSync(dist, { recursive: true, force: true });

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) {
    const a = path.join(from, f), b = path.join(to, f);
    if (fs.statSync(a).isDirectory()) copyTree(a, b);
    else if (!SKIP.test(f) && !LOCALE_CODE.test(a) && !PARKED.test(a)) fs.copyFileSync(a, b);
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
  writeZip(out, filesUnder(dir));
  console.log(`✓ ${path.relative(root, out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
}

const SOURCE = process.env.EYETIME_BUILD === 'source';
async function build(stageDir, target) {
  if (SOURCE) return;
  const r = await buildInto({ stage: stageDir, root, target });
  console.log(`  production build: ${r.entries} entry points, ${r.outputs} script files shipped, ${r.bundled} source modules folded into them`);
}

const chrome = stage('chrome');
await build(chrome, ['chrome120']);
zip(chrome, path.join(dist, 'eyetime-chrome.zip'));

const firefox = stage('firefox', (m) => {
  delete m.minimum_chrome_version;
  m.content_security_policy = { extension_pages: m.content_security_policy.extension_pages.replace(/;\s*require-trusted-types-for[^;]*;\s*trusted-types[^;]*/, '') }; // Trusted Types are not in Firefox 142 (an unknown directive is only noise for the store's linter)
  m.permissions = m.permissions.filter((p) => !['offscreen', 'favicon', 'declarativeNetRequestWithHostAccess'].includes(p)); // Chrome-only (or, for instant blocking, not yet checked in Firefox) APIs; the code feature-detects them
  m.background = { scripts: ['src/background/index.js'], type: 'module' };
  m.browser_specific_settings = { gecko: { id: 'eyetime@maxbzd.github.io', strict_min_version: '142.0', data_collection_permissions: { required: ['none'], optional: ['technicalAndInteraction'] } } };
});
await build(firefox, ['firefox142']);
zip(firefox, path.join(dist, 'eyetime-firefox.zip'));
