// Builds one self-contained HTML page that plays the generative focus sound, from the same source files the extension uses:
//   node scripts-dev/build-soundscape-demo.mjs [out.html]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || path.join(root, 'soundscape-demo.html');
const parts = ['theory', 'modes', 'session', 'conductor', 'engine'].map((n) => {
  const src = fs.readFileSync(path.join(root, 'src/shared/soundscape', n + '.js'), 'utf8');
  // one script, no modules to load: drop the imports and the `export` keywords
  return `/* ---- ${n}.js ---- */\n` + src.replace(/^import [^;]*;\s*$/gm, '').replace(/^export (const|function|async function|class) /gm, '$1 ');
});
const page = fs.readFileSync(path.join(root, 'scripts-dev/soundscape-demo.html'), 'utf8').replace('/*ENGINE*/', () => parts.join('\n'));
fs.writeFileSync(out, page);
console.log(`${out}  ${(page.length / 1024).toFixed(0)} KB`);
