// Where the weight of the repository's history is, by group, and the biggest files ever committed.  Reads only; changes nothing.
//   node scripts-dev/repo-size.mjs
import cp from 'node:child_process';

const out = cp.execSync("git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectsize) %(rest)'", { encoding: 'utf8', maxBuffer: 1 << 28 });
const blobs = out.split('\n').map((l) => l.split(' ')).filter((p) => p[0] === 'blob').map((p) => ({ size: Number(p[1]), path: p.slice(2).join(' ') }));
const GROUPS = [['the on-device models and their engine', /newtab\/ml\//], ['pictures that the visual tests compare with', /visual-baseline/], ['store listing: screenshots, promo, the demo film', /^store\//],
  ['photographs and wallpapers', /frames|starters|prototype\/assets|installer\/ui|\.jpe?g$|\.webp$/], ['brand marks of the desktop app', /brands-all/], ['sounds', /\.ogg$/]];
const by = new Map();
for (const b of blobs) { const g = (GROUPS.find(([, re]) => re.test(b.path)) || ['everything else'])[0]; const e = by.get(g) || { size: 0, n: 0 }; e.size += b.size; e.n++; by.set(g, e); }
const MB = (n) => (n / 1048576).toFixed(1).padStart(6) + ' MB';
console.log(`${blobs.length} files in the history, ${MB(blobs.reduce((a, b) => a + b.size, 0))} before compression (the clone is smaller: git stores versions as deltas)\n`);
for (const [g, e] of [...by].sort((a, b) => b[1].size - a[1].size)) console.log(`${MB(e.size)}  ${String(e.n).padStart(5)} files  ${g}`);
console.log('\nthe biggest single versions:');
for (const blob of blobs.sort((a, b) => b.size - a.size).slice(0, 8)) console.log(`${MB(blob.size)}  ${blob.path}`);
