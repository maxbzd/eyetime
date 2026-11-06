// Every module of src/shared loads on its own in Node (they are plain logic, with no browser in them), and each one is therefore counted by the coverage
// report: without this the report only lists the files that some test happens to import, and the percentage says more than it should.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/shared');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(root).filter((f) => f.endsWith('.js') && !f.includes(`${path.sep}locales${path.sep}`) && !f.includes(`${path.sep}parked${path.sep}`));

test(`every module of src/shared loads in Node (${files.length} files)`, async () => {
  assert.ok(files.length > 60);
  for (const f of files) {
    try { await import(pathToFileURL(f).href); } catch (e) { assert.fail(`${path.relative(root, f)} does not load without a browser: ${e && e.message}`); }
  }
});
