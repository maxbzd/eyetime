// Writes src/shared/locales/data/<code>.json from the translations in src/shared/locales/<code>.js.
//   node scripts-dev/build-locales.mjs            write the files
//   node scripts-dev/build-locales.mjs --check    fail if a file is missing or out of date (npm run check does this)
//
// Why: a page needs one language, and the service worker cannot `import()` at all (the HTML standard forbids it there), so the language
// that is in use is read as data (`fetch` of a small JSON file) instead of every language being loaded as code on every page and on every
// wake-up of the worker. The .js files stay the place where translations are written (comments, one reviewable file per language);
// English is imported as code because it is the fallback for a missing key, so it needs no data file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'src/shared/locales');
const out = path.join(dir, 'data');
const { LOCALES } = await import(pathToFileURL(path.join(dir, 'index.js')).href);

const want = {};
for (const [code, dict] of Object.entries(LOCALES)) if (code !== 'en') want[code + '.json'] = JSON.stringify(dict) + '\n';

if (process.argv.includes('--check')) {
  let bad = 0;
  for (const [file, text] of Object.entries(want)) {
    const p = path.join(out, file);
    if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== text) { console.error(`✗ locales/data/${file} is missing or out of date: run  node scripts-dev/build-locales.mjs`); bad++; }
  }
  if (fs.existsSync(out)) for (const f of fs.readdirSync(out)) if (!(f in want)) { console.error(`✗ locales/data/${f} belongs to no language`); bad++; }
  process.exit(bad ? 1 : 0);
}

fs.mkdirSync(out, { recursive: true });
for (const f of fs.existsSync(out) ? fs.readdirSync(out) : []) if (!(f in want)) fs.rmSync(path.join(out, f));
for (const [file, text] of Object.entries(want)) fs.writeFileSync(path.join(out, file), text);
console.log(`✓ ${Object.keys(want).length} files in src/shared/locales/data (${(Object.values(want).reduce((a, s) => a + s.length, 0) / 1024).toFixed(0)} KB)`);
