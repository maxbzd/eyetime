import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/audio/samples');

test('the sample manifest lists real files, in pitch order, and the pack stays small', () => {
  const man = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  assert.deepEqual(Object.keys(man).sort(), ['cello', 'harp', 'piano']);
  let total = 0;
  for (const [id, list] of Object.entries(man)) {
    assert.ok(list.length >= 6, id);
    list.forEach((e, i) => { const f = path.join(dir, e.file); assert.ok(fs.existsSync(f), e.file); total += fs.statSync(f).size; assert.ok(Number.isInteger(e.midi) && e.midi >= 24 && e.midi <= 100); if (i) assert.ok(e.midi > list[i - 1].midi, `${id} is sorted`); });
  }
  assert.ok(total < 2 * 1024 * 1024, `samples take ${total} bytes`);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ogg'));
  assert.equal(files.length, Object.values(man).flat().length, 'no file outside the manifest');
});

test('credits name the source and the license of the samples', () => {
  const t = fs.readFileSync(path.join(dir, '../CREDITS.txt'), 'utf8');
  assert.match(t, /VSCO-2-CE/); assert.match(t, /CC0/);
});
