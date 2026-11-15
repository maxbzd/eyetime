// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The set-up script reads what wrangler prints; these are the shapes it expects.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDatabaseId, findDatabaseId, parseWorkerUrl, withDatabaseId } from '../../server/usage/setup.mjs';

const ID = '0a1b2c3d-1111-4222-8333-444455556666';
test('the database id is found in the block wrangler prints after create', () => {
  const out = `✅ Successfully created DB 'eyetime-usage'\n\n{\n  "d1_databases": [\n    {\n      "binding": "eyetime_usage",\n      "database_name": "eyetime-usage",\n      "database_id": "${ID}"\n    }\n  ]\n}\n`;
  assert.equal(parseDatabaseId(out), ID);
  assert.equal(parseDatabaseId('nothing here'), null);
});
test('an existing database is found in the JSON list', () => {
  assert.equal(findDatabaseId(JSON.stringify([{ uuid: 'x', name: 'other' }, { uuid: ID, name: 'eyetime-usage' }])), ID);
  assert.equal(findDatabaseId('[]'), null);
  assert.equal(findDatabaseId('not json'), null);
});
test('the worker address is taken from the deploy output', () => {
  assert.equal(parseWorkerUrl('Deployed eyetime-usage triggers\n  https://eyetime-usage.some-name.workers.dev\nCurrent Version ID: 1'), 'https://eyetime-usage.some-name.workers.dev');
  assert.equal(parseWorkerUrl('no url'), null);
});
test('the id replaces the placeholder and nothing else', () => {
  const toml = 'name = "x"\n[[d1_databases]]\nbinding = "DB"\ndatabase_name = "eyetime-usage"\ndatabase_id = "REPLACE-WITH-THE-ID"\n';
  const out = withDatabaseId(toml, ID);
  assert.ok(out.includes(`database_id = "${ID}"`) && out.includes('binding = "DB"') && !out.includes('REPLACE'));
  assert.equal(withDatabaseId(out, ID), out); // a second run leaves it as it is
});
