// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The production build of the extension: what is shipped is not the source tree but a smaller, faster copy of it.
//   node scripts-dev/build.mjs <dir>     (npm run build calls it for each package; <dir> already holds a copy of src/, _locales/, icons/)
//
// The source stays what it is (plain ES modules, no build step, "open any file and read it"); this is a derived artifact:
//   * each page's script becomes one bundle, and what several pages share becomes a shared chunk (140 requests for the new tab become a handful);
//   * the scripts and the style sheets are minified (the code is not obfuscated: names of exports and strings are kept, and the source is public);
//   * the modules that were bundled are not shipped a second time; everything that is loaded by its path at run time (the workers and the engine of the on-device models,
//     the content scripts, the pages, the data files) stays where it is.
// Deterministic: the same source gives the same files (esbuild has no clock or randomness in its output).
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

/** the scripts that pages and the browser load by path; each is a root of a bundle */
const MODULE_ENTRIES = [
  'src/popup/popup.js', 'src/newtab/newtab.js', 'src/options/options.js', 'src/insights/insights.js', 'src/onboarding/onboarding.js', 'src/blocked/blocked.js',
  'src/break/break.js', 'src/dock/dock.js', 'src/ui/wall.js', 'src/background/index.js', 'src/background/offscreen.js',
];
/** classic scripts (no imports, one file each, wrapped so that they leak no names) */
const CLASSIC_ENTRIES = ['src/content/dock.js', 'src/content/feed.js', 'src/ui/theme-init.js'];

const cssFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? cssFiles(path.join(dir, e.name)) : e.name.endsWith('.css') ? [path.join(dir, e.name)] : []));

/** @param {{ stage: string, root: string, target?: string[], minify?: boolean }} o `stage`: the folder that holds the copy of src/ to be rebuilt in place */
export async function buildInto({ stage, root, target = ['chrome120', 'firefox142'], minify = true }) {
  const abs = (p) => path.join(root, p);
  const common = { absWorkingDir: root, target, minify, charset: 'utf8', legalComments: 'eof', logLevel: 'warning', metafile: true, sourcemap: false };

  // 1) the pages and the worker: ES modules with shared chunks
  const mod = await esbuild.build({ ...common, entryPoints: MODULE_ENTRIES.map(abs), bundle: true, splitting: false, format: 'esm', outdir: stage, outbase: root, write: true,
    external: ['*.mjs'] }); // the engine of the models is shipped as it is
  // 2) classic scripts
  const classic = await Promise.all(CLASSIC_ENTRIES.map((e) => esbuild.build({ ...common, entryPoints: [abs(e)], bundle: true, format: 'iife', outfile: path.join(stage, e), write: true })));
  // 3) style sheets, one for one (no bundling: the pages still link each of them)
  await esbuild.build({ ...common, entryPoints: cssFiles(abs('src')), bundle: false, outdir: stage, outbase: root, write: true, loader: { '.css': 'css' } });

  // 4) the source modules that went into a bundle are not shipped a second time
  const entries = new Set([...MODULE_ENTRIES, ...CLASSIC_ENTRIES].map((e) => path.normalize(e)));
  const inputs = new Set();
  for (const r of [mod, ...classic]) for (const k of Object.keys(r.metafile.inputs)) inputs.add(path.normalize(k));
  let removed = 0;
  for (const rel of inputs) {
    if (!rel.startsWith('src' + path.sep) || entries.has(rel) || !rel.endsWith('.js')) continue;
    const f = path.join(stage, rel);
    if (fs.existsSync(f)) { fs.rmSync(f); removed++; }
  }
  // folders that are empty now
  (function prune(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) if (e.isDirectory()) { prune(path.join(d, e.name)); if (!fs.readdirSync(path.join(d, e.name)).length) fs.rmdirSync(path.join(d, e.name)); } })(path.join(stage, 'src'));
  return { bundled: removed, entries: MODULE_ENTRIES.length + CLASSIC_ENTRIES.length, outputs: Object.keys(mod.metafile.outputs).length };
}
