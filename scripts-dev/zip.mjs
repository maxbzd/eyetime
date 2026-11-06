// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// A zip writer that makes the same bytes from the same files, on every machine and every day: entries in a fixed order, a fixed time stamp, a fixed compression level,
// no extra fields (no owner, no local time zone, no access times). That is what lets anyone rebuild a release from the source and compare the hash with the published one.
//   writeZip('out.zip', [{ name: 'a/b.txt', data: Buffer }, ...])
import fs from 'node:fs';
import { Buffer } from 'node:buffer';
import zlib from 'node:zlib';

const DOS_TIME = 0, DOS_DATE = ((2020 - 1980) << 9) | (1 << 5) | 1; // 2020-01-01 00:00:00, whatever the clock says
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };

/** @param {string} out @param {{ name: string, data: Buffer }[]} files */
export function writeZip(out, files) {
  const sorted = [...files].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)); // byte order of the names, not of the file system
  const names = sorted.map((f) => f.name);
  if (new Set(names).size !== names.length) throw new Error('the same name twice in a zip');
  const parts = [], central = [];
  let offset = 0;
  for (const f of sorted) {
    const name = Buffer.from(f.name, 'utf8'), data = f.data;
    const stored = data.length < 64 ? data : zlib.deflateRawSync(data, { level: 9, memLevel: 9 }); // tiny files are not worth deflating
    const method = stored === data ? 0 : 8, crc = zlib.crc32(data);
    const local = Buffer.concat([u32(0x04034b50), u16(20), u16(0x0800), u16(method), u16(DOS_TIME), u16(DOS_DATE), u32(crc), u32(stored.length), u32(data.length), u16(name.length), u16(0), name]);
    parts.push(local, stored);
    central.push(Buffer.concat([u32(0x02014b50), u16(0x031e), u16(20), u16(0x0800), u16(method), u16(DOS_TIME), u16(DOS_DATE), u32(crc), u32(stored.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32((0o100644 << 16) >>> 0), u32(offset), name]));
    offset += local.length + stored.length;
  }
  const dir = Buffer.concat(central);
  parts.push(dir, Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(sorted.length), u16(sorted.length), u32(dir.length), u32(offset), u16(0)]));
  fs.writeFileSync(out, Buffer.concat(parts));
}

/** Every file under `dir` as zip entries (names with forward slashes, relative to `dir`). */
export function filesUnder(dir) {
  const out = [];
  (function walk(d, prefix) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = prefix + e.name;
      if (e.isDirectory()) walk(d + '/' + e.name, p + '/'); else out.push({ name: p, data: fs.readFileSync(d + '/' + e.name) });
    }
  })(dir, '');
  return out;
}
