// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// One self-contained HTML file with the whole dashboard and a made-up population, no server needed: node scripts-dev/dashboard-demo.mjs out.html [--artifact]
// The page is the real one (server/usage/dashboard.html). The formulas (stats.js), the period parser and the demo data are bundled into it, and `fetch('/v1/demo-stats?…')` is
// answered in the browser by the same functions the collector runs, so the period bar, the comparison and the language and theme switches all work.
// --artifact: for a place that wraps the page in its own document (no <html>/<head>/<body>, side gutters, safe areas).
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2];
const artifact = process.argv.includes('--artifact');
if (!out) { console.error('usage: node scripts-dev/dashboard-demo.mjs out.html [--artifact]'); process.exit(2); }

const entry = `
import { computeStats } from ${JSON.stringify(join(ROOT, 'server/usage/stats.js'))};
import { makeDemoSnapshot } from ${JSON.stringify(join(ROOT, 'server/usage/demo-data.js'))};
import { parsePeriod } from ${JSON.stringify(join(ROOT, 'server/usage/handler.js'))};
window.fetch = async (url) => {
  const u = new URL(String(url), 'http://demo.invalid');
  if (u.pathname !== '/v1/demo-stats') return new Response(null, { status: 404 });
  const period = parsePeriod(u);
  if (!period) return new Response('bad period', { status: 400 });
  const now = Date.now();
  return new Response(JSON.stringify(computeStats(makeDemoSnapshot(now), now, period)), { status: 200, headers: { 'content-type': 'application/json' } });
};
`;
const bundle = await esbuild.build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'js' }, bundle: true, minify: true, format: 'iife', write: false, target: 'es2022', legalComments: 'none' });
const shim = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

let html = readFileSync(join(ROOT, 'server/usage/dashboard.html'), 'utf8');
const swap = (a, b) => { if (!html.includes(a)) throw new Error('dashboard.html changed, cannot find: ' + a.slice(0, 60)); html = html.replace(a, b); };
swap('const params = new URLSearchParams(location.search);', "const params = new URLSearchParams('demo');"); // always the demo, whatever the address
swap('Реальных людей за этими цифрами нет.', 'Реальных людей за этими цифрами нет. Здесь скачивание файлов отключено окружением; в настоящей панели выгрузка работает.');
swap('No real people stand behind these figures.', 'No real people stand behind these figures. File downloads are switched off in this view; in the real dashboard the export works.');
swap('<script>\n', `<script>${shim}</script>\n<script>\n`);
if (artifact) {
  html = html.replace(/<!doctype html>\s*/i, '').replace(/<html[^>]*>\s*/i, '').replace(/<\/html>\s*/i, '').replace(/<head>\s*/i, '').replace(/<\/head>\s*/i, '').replace(/<body>\s*/i, '').replace(/<\/body>\s*/i, '');
  html = html.replace(/<meta charset="utf-8">\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '').replace(/<meta name="robots"[^>]*>\s*/i, '').replace(/<meta name="color-scheme"[^>]*>\s*/i, '');
  html = html.replace(/<title>[^<]*<\/title>/, '<title>EyeTime Dashboard</title>\n<meta name="claude:viewport-fit-sides" content="cover">');
  const gutter = 'padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px));';
  swap('.wrap { max-width: 1240px; margin: 0 auto; padding: 0 16px 64px; }', `.wrap { max-width: 1240px; margin: 0 auto; padding-block: 0 64px; ${gutter} }`);
  swap('.top .in { max-width: 1240px; margin: 0 auto; padding: 10px 16px;', `.top .in { max-width: 1240px; margin: 0 auto; padding-block: 10px; ${gutter}`);
  swap('padding: 4px 16px; position: sticky; top: 52px; z-index: 5; background: var(--page); border-bottom: 1px solid var(--grid); margin: 0 -16px; }', 'padding: 4px 0; position: sticky; top: calc(52px + env(safe-area-inset-top, 0px)); z-index: 5; background: var(--page); border-bottom: 1px solid var(--grid); }');
  swap('header.top { position: sticky; top: 0; z-index: 6;', 'header.top { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 6;');
  swap('html { background: var(--page); }', 'html { background: var(--page); }\nbody::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--page); }');
  swap('body { margin: 0; background: var(--page);', 'body { margin: 0; min-height: 100vh; background: var(--page);');
}
writeFileSync(out, html);
console.log(`${out}: ${(html.length / 1024).toFixed(0)} KB`);
