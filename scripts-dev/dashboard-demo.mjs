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
  // side gutters that also clear a system bar, the sticky bits below the safe area, and a one-screen app sized by its frame (100%) instead of 100vh
  const gutter = 'padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px));';
  const sub = (re, to) => { if (!re.test(html)) throw new Error('dashboard.html changed, cannot find: ' + re); html = html.replace(re, to); };
  sub(/\.content \{ padding: 8px 16px 64px; /, `.content { padding-block: 8px 64px; ${gutter} `);
  sub(/\.content \{ padding: 12px 28px 72px; \}/, '.content { padding-block: 12px 72px; padding-inline: 28px; }');
  sub(/\.content \{ padding: 8px 12px 56px; \}/, `.content { padding-block: 8px 56px; ${gutter} }`);
  sub(/padding: 8px 16px; background: var\(--panel\); border-bottom/, `padding-block: 8px; ${gutter} background: var(--panel); border-bottom`);
  sub(/\.topbar \{ padding: 8px 12px; \}/, `.topbar { padding-block: 8px; ${gutter} }`);
  sub(/padding: 8px 12px 0; position: sticky; top: 0; z-index: 7;/, `padding-block: 8px 0; ${gutter} position: sticky; top: env(safe-area-inset-top, 0px); z-index: 7;`);
  html = html.replaceAll('100vh', '100%');
  sub(/html \{ background: var\(--bg\); \}/, 'html { background: var(--bg); }\nhtml, body { height: 100%; }\nbody::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--bg); }');
}
writeFileSync(out, html);
console.log(`${out}: ${(html.length / 1024).toFixed(0)} KB`);
