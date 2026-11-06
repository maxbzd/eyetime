// A software bill of materials (CycloneDX 1.5, JSON) for what the extension package ships: the extension itself and every third-party thing inside it, with its licence,
// and the SHA-256 of the packages. Released next to them (release.yml) so that anyone can see what is in the zip without unpacking it.
//   node scripts-dev/sbom.mjs [dist-folder]      writes <dist>/eyetime-sbom.cdx.json
// The extension has no runtime dependencies (no npm packages in what runs); what is third-party is files: an engine, two models, icons, fonts, sounds, photographs.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.resolve(process.argv[2] || path.join(root, 'dist'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

const lic = (id) => ({ license: { id } });
const components = [
  { type: 'library', name: 'onnxruntime-web', version: (read('src/newtab/ml/ort.wasm.min.mjs').match(/ONNX Runtime Web v([\d.]+)/) || [])[1] || 'unknown', supplier: { name: 'Microsoft' }, licenses: [lic('MIT')], description: 'WebAssembly engine that runs the two on-device models (src/newtab/ml/ort*)', purl: 'pkg:npm/onnxruntime-web' },
  { type: 'machine-learning-model', name: 'Depth Anything V2 Small (8-bit ONNX export)', supplier: { name: 'Depth Anything team; ONNX export by onnx-community' }, licenses: [lic('Apache-2.0')], description: 'depth map of the person\'s own photo, on the device (src/newtab/ml/depth-anything-v2-small-q8.onnx)' },
  { type: 'machine-learning-model', name: 'U2-Netp', supplier: { name: 'Xuebin Qin et al.' }, licenses: [lic('Apache-2.0')], description: 'cut-out of the subject of the person\'s own photo, on the device (src/newtab/ml/u2netp.onnx)' },
  { type: 'library', name: 'Lucide icons', supplier: { name: 'Lucide Contributors' }, licenses: [lic('ISC')], description: 'the icons (src/ui/icons.js, generated from the ones the code uses)', purl: 'pkg:npm/lucide-static' },
];
// fonts: one component per licence file; the licence is read from the file, not assumed
for (const f of fs.readdirSync(path.join(root, 'src/ui/fonts')).filter((n) => /^LICENSE-/.test(n)).sort()) {
  const text = read('src/ui/fonts/' + f), name = f.replace(/^LICENSE-/, '').replace(/\.txt$/, '');
  components.push({ type: 'data', name: 'font ' + name, licenses: [/SIL OPEN FONT LICENSE/i.test(text) ? lic('OFL-1.1') : { license: { name: 'see src/ui/fonts/' + f } }], description: 'src/ui/fonts' });
}
components.push(
  { type: 'data', name: 'ambient sounds (rain, river, forest)', licenses: [lic('CC0-1.0')], description: 'src/audio, credits in src/audio/CREDITS.txt' },
  { type: 'data', name: 'photographs of the Frames themes', licenses: [{ license: { name: 'Unsplash License' } }], description: 'src/newtab/frames, credits in docs/PHOTO-CREDITS.md' },
  { type: 'data', name: 'colour wallpapers of Home', licenses: [lic('CC0-1.0')], description: 'src/newtab/frames, credits in docs/PHOTO-CREDITS.md' },
);
// the packages that were built, by hash
const packages = [];
for (const z of ['eyetime-chrome.zip', 'eyetime-firefox.zip']) { const f = path.join(dist, z); if (fs.existsSync(f)) packages.push({ type: 'file', name: z, version: manifest.version, hashes: [{ alg: 'SHA-256', content: sha(f) }], description: 'a package of this release' }); }

const bom = {
  bomFormat: 'CycloneDX', specVersion: '1.5', version: 1,
  metadata: { component: { type: 'application', name: 'EyeTime', version: manifest.version, licenses: [lic('MIT')], supplier: { name: 'EyeTime contributors', url: ['https://github.com/maxbzd/eyetime'] } },
    properties: [{ name: 'runtime-dependencies', value: 'none: everything that runs is code in this repository plus the third-party files below' }, { name: 'build-tools', value: 'esbuild (bundles and minifies); fixed versions in package-lock.json' }] },
  components: [...components, ...packages],
};
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'eyetime-sbom.cdx.json'), JSON.stringify(bom, null, 2) + '\n');
console.log(`✓ ${path.relative(root, path.join(dist, 'eyetime-sbom.cdx.json'))} (${bom.components.length} components, ${packages.length} package hashes)`);
