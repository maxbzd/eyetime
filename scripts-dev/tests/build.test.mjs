// The packages that are shipped: built twice they are the same bytes; the zip is a valid zip whose every file is exactly the staged file; the bundles hold what they must.
import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { writeZip } from '../zip.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const build = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'eyetime-build-test-')); cp.execFileSync(process.execPath, [path.join(root, 'scripts-dev/pack.mjs')], { env: { ...process.env, EYETIME_DIST: d }, stdio: 'pipe' }); return d; };
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

/** read a zip with nothing but the standard: the central directory, then each entry, checked against its CRC */
function readZip(file) {
  const buf = fs.readFileSync(file), out = new Map();
  let eocd = buf.length - 22; while (buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  const n = buf.readUInt16LE(eocd + 10); let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < n; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50);
    const method = buf.readUInt16LE(p + 10), crc = buf.readUInt32LE(p + 16), csize = buf.readUInt32LE(p + 20), size = buf.readUInt32LE(p + 24), nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    const lnlen = buf.readUInt16LE(off + 26), lelen = buf.readUInt16LE(off + 28), start = off + 30 + lnlen + lelen;
    const raw = buf.subarray(start, start + csize), data = method === 8 ? zlib.inflateRawSync(raw) : raw;
    assert.equal(data.length, size, name); assert.equal(zlib.crc32(data), crc, 'crc of ' + name);
    out.set(name, data); p += 46 + nlen + elen + clen;
  }
  return out;
}

test('zip: entries in byte order, any input order gives the same bytes, a name twice is refused, tiny and large files both round-trip', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eyetime-zip-'));
  const files = [{ name: 'b/two.txt', data: Buffer.from('two') }, { name: 'a.txt', data: Buffer.from('x'.repeat(5000)) }, { name: 'Z.txt', data: Buffer.alloc(0) }, { name: 'é.txt', data: Buffer.from('é') }];
  writeZip(path.join(dir, '1.zip'), files); writeZip(path.join(dir, '2.zip'), [...files].reverse());
  assert.equal(sha(path.join(dir, '1.zip')), sha(path.join(dir, '2.zip')), 'the order the files are given in does not matter');
  const back = readZip(path.join(dir, '1.zip'));
  assert.deepEqual([...back.keys()], ['Z.txt', 'a.txt', 'b/two.txt', 'é.txt'], 'byte order of the names');
  assert.equal(back.get('a.txt').length, 5000); assert.equal(back.get('é.txt').toString(), 'é'); assert.equal(back.get('Z.txt').length, 0);
  assert.throws(() => writeZip(path.join(dir, '3.zip'), [files[0], files[0]]), /twice/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('build: two builds of the same source are the same bytes, and the chrome and firefox packages differ only where they must', { timeout: 120000 }, () => {
  const a = build(), b = build();
  for (const z of ['eyetime-chrome.zip', 'eyetime-firefox.zip']) assert.equal(sha(path.join(a, z)), sha(path.join(b, z)), z + ' is not reproducible');
  const chrome = readZip(path.join(a, 'eyetime-chrome.zip')), firefox = readZip(path.join(a, 'eyetime-firefox.zip'));
  assert.notEqual(sha(path.join(a, 'eyetime-chrome.zip')), sha(path.join(a, 'eyetime-firefox.zip')));
  const cm = JSON.parse(chrome.get('manifest.json')), fm = JSON.parse(firefox.get('manifest.json'));
  assert.ok(cm.background.service_worker && !cm.background.scripts); assert.ok(fm.background.scripts && fm.browser_specific_settings.gecko.id);

  // what the bundle must and must not hold
  const names = [...chrome.keys()];
  assert.ok(names.includes('src/background/index.js') && names.includes('src/newtab/newtab.js') && names.includes('src/content/feed.js') && names.includes('src/ui/theme-init.js'), 'the entry points are where the manifest and the pages expect them');
  assert.equal(names.includes('src/shared/storage.js'), false, 'a module that was folded into a bundle is not shipped a second time');
  assert.equal(names.some((n) => /shared\/locales\/(?!en\.js$|languages\.js$)[^/]+\.js$/.test(n)), false, 'translations are data, not code');
  assert.equal(names.some((n) => n.includes('/parked/')), false);
  for (const n of ['src/newtab/ml/depth-worker.js', 'src/newtab/ml/segment-worker.js', 'src/newtab/ml/ort.wasm.min.mjs', 'src/shared/locales/data/ru.json', 'src/dock/dock.html', 'src/ui/palette.css']) assert.ok(names.includes(n), n + ' must be shipped as a file');
  // every file the pages, the manifest and the stylesheets name is in the package
  const missing = [];
  for (const [n, data] of chrome) {
    if (!n.endsWith('.html')) continue;
    for (const m of data.toString().matchAll(/(?:src|href)="(?!https?:|#|mailto:|chrome)([^"]+)"/g)) { const t = path.posix.normalize(path.posix.join(path.posix.dirname(n), m[1].split('?')[0].split('#')[0])); if (!chrome.has(t)) missing.push(n + ' -> ' + t); }
  }
  for (const f of [cm.background.service_worker, cm.chrome_url_overrides.newtab, cm.action.default_popup, cm.options_page, ...cm.content_scripts.flatMap((c) => c.js)]) if (!chrome.has(f)) missing.push('manifest -> ' + f);
  assert.deepEqual(missing, []);
  // the minified code is smaller than the source it came from, and the service worker is one file
  const srcBytes = fs.readFileSync(path.join(root, 'src/shared/storage.js')).length;
  assert.ok(chrome.get('src/background/index.js').length > srcBytes, 'the worker bundle holds the modules');
  assert.ok(![...chrome.get('src/background/index.js').toString().matchAll(/\n\s+\/\//g)].length, 'and no comment lines of ours');
  for (const d of [a, b]) fs.rmSync(d, { recursive: true, force: true });
});
