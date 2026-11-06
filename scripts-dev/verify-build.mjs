// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Can this release be rebuilt from the source? Builds the packages twice, in two empty folders, and says whether the bytes are the same;
// with `--against <file.zip>` it also compares the build with a published package.
//   node scripts-dev/verify-build.mjs                                        the build is reproducible on this machine
//   node scripts-dev/verify-build.mjs --against eyetime-chrome.zip           ... and equals the file from the release page (same version of the source checked out, `npm ci` first)
import cp from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const build = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eyetime-verify-'));
  cp.execFileSync(process.execPath, [path.join(root, 'scripts-dev/pack.mjs')], { env: { ...process.env, EYETIME_DIST: dir }, stdio: 'pipe' });
  return dir;
};
const a = build(), b = build();
let bad = 0;
for (const zip of ['eyetime-chrome.zip', 'eyetime-firefox.zip']) {
  const x = sha(path.join(a, zip)), y = sha(path.join(b, zip));
  console.log(`${x === y ? '✓' : '✗'} ${zip}  ${x}${x === y ? '' : '  !=  ' + y}`);
  if (x !== y) bad++;
}
const i = process.argv.indexOf('--against');
if (i > 0) {
  const file = process.argv[i + 1], name = path.basename(file).includes('firefox') ? 'eyetime-firefox.zip' : 'eyetime-chrome.zip';
  const mine = sha(path.join(a, name)), theirs = sha(file);
  console.log(`${mine === theirs ? '✓' : '✗'} ${path.basename(file)} ${mine === theirs ? 'is exactly what this source builds' : 'differs from what this source builds'}\n   built     ${mine}\n   published ${theirs}`);
  if (mine !== theirs) bad++;
}
for (const d of [a, b]) fs.rmSync(d, { recursive: true, force: true });
process.exit(bad ? 1 : 0);
