// Builds one self-contained HTML page that plays the generative focus sounds, from the same source files the extension will use:
//   node scripts-dev/build-soundscape-demo.mjs [out.html]
// Each module is wrapped in its own function so that private names of one file never collide with another's.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || path.join(root, 'soundscape-demo.html');
const names = ['theory', 'modes', 'session', 'conductor', 'engine', 'rhythm', 'methods', 'evolve', 'skyline', 'gfm'];
const parts = names.map((n) => {
  let src = fs.readFileSync(path.join(root, 'src/shared/soundscape', n + '.js'), 'utf8');
  const exported = [];
  src = src.replace(/^import \{([^}]*)\} from '\.\/(\w+)\.js';\s*$/gm, (_, list, mod) => `const {${list}} = M_${mod};`);
  src = src.replace(/^export (const|function|async function|class) (\w+)/gm, (_, kind, name) => { exported.push(name); return `${kind} ${name}`; });
  return `const M_${n} = (() => {\n${src}\nreturn { ${exported.join(', ')} };\n})();`;
});
const page = fs.readFileSync(path.join(root, 'scripts-dev/soundscape-demo.html'), 'utf8').replace('/*ENGINE*/', () => parts.join('\n'));
fs.writeFileSync(out, page);
console.log(`${out}  ${(page.length / 1024).toFixed(0)} KB`);
