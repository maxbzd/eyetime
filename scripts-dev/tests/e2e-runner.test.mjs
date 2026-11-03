import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, matches, split, unregistered, loadConfig } from '../e2e/run.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

test('e2e runner: arguments', () => {
  assert.deepEqual(parseArgs(['--jobs', '3', '--shard', '2/4', '--only', 'a,b', '--retries', '1']), { jobs: 3, shard: [2, 4], only: ['a', 'b'], skip: [], retries: 1, list: false, timeout: 900 });
  assert.throws(() => parseArgs(['--shard', '5/4']), /shard/);
  assert.throws(() => parseArgs(['--nope']), /unknown/);
  assert.equal(parseArgs(['--jobs', '0']).jobs, 1);
});

test('e2e runner: a name selects a suite or the parts of one', () => {
  assert.ok(matches('a11y-2', ['a11y']) && matches('a11y', ['a11y']) && matches('visual-en', ['visual', 'x']));
  assert.ok(!matches('a11y-2', ['a11']) && !matches('starters', ['star']));
});

test('e2e runner: shards are balanced, complete and the same on every machine', () => {
  const cfg = loadConfig();
  for (const n of [1, 2, 3, 4, 6]) {
    const parts = split(cfg.suites, n);
    assert.equal(parts.length, n);
    assert.deepEqual(parts.flat().map((s) => s.id).sort(), cfg.suites.map((s) => s.id).sort(), 'every suite runs exactly once');
    assert.deepEqual(split([...cfg.suites].reverse(), n).map((p) => p.map((s) => s.id).sort()), parts.map((p) => p.map((s) => s.id).sort()), 'the order of the list does not matter');
    const w = parts.map((p) => p.reduce((a, s) => a + s.weight, 0)), biggest = Math.max(...cfg.suites.map((s) => s.weight));
    assert.ok(Math.max(...w) - Math.min(...w) <= biggest, `shards of ${n} are within one suite of each other: ${w}`);
  }
});

test('e2e runner: suites.json lists real files, unique ids, and no test script is left out', () => {
  const cfg = loadConfig();
  assert.equal(new Set(cfg.suites.map((s) => s.id)).size, cfg.suites.length, 'ids are unique');
  for (const s of cfg.suites) { assert.ok(existsSync(join(HERE, '../e2e', s.file)), s.file + ' exists'); assert.ok(s.weight > 0, s.id + ' has a weight'); }
  assert.deepEqual(unregistered(cfg), [], 'every *.cjs in scripts-dev/e2e is a suite or a declared tool');
});

test('e2e runner: CI runs the suites through the runner', async () => {
  const { readFileSync } = await import('node:fs');
  const ci = readFileSync(join(HERE, '../../.github/workflows/ci.yml'), 'utf8');
  assert.match(ci, /scripts-dev\/e2e\/run\.mjs/);
  assert.ok(!/node scripts-dev\/e2e\/[a-z0-9-]+\.cjs/.test(ci), 'no suite is run by hand: it would be missing from the shards');
});
