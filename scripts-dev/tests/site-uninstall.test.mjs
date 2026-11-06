// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The page shown after removal: the same seven reasons the collector accepts, nothing stored, nothing external, and it sends only where the build says.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { UNINSTALL_REASONS } from '../../src/shared/usage-schema.js';
import { USAGE_ENDPOINT } from '../../src/shared/usage-config.js';
import { collectorUninstallUrl } from '../site-collector.mjs';

const page = fs.readFileSync(new URL('../../site/uninstall.html', import.meta.url), 'utf8');

test('the buttons are exactly the reasons the collector accepts', () => {
  const ids = [...page.matchAll(/data-reason="([a-z_]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, UNINSTALL_REASONS);
});

test('the page stores nothing and loads nothing from elsewhere', () => {
  assert.doesNotMatch(page, /localStorage|sessionStorage|document\.cookie|indexedDB/);
  const urls = [...page.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(urls, []);
  assert.doesNotMatch(page, /<script[^>]+src=/);
  assert.match(page, /credentials: 'omit'/);
  assert.match(page, /referrerPolicy: 'no-referrer'/);
  assert.match(page, /JSON\.stringify\(\{ reason: /); // the whole body is the one reason
});

test('without a collector the page asks nothing', () => {
  assert.equal(USAGE_ENDPOINT, '');
  assert.match(page, /data-collector=""/); // the repository build has none; the Pages build fills it in
});

test('the address of the answer comes from the collector endpoint, https only', () => {
  assert.equal(collectorUninstallUrl('https://eyetime.example.workers.dev/v1/usage'), 'https://eyetime.example.workers.dev/v1/uninstall');
  assert.equal(collectorUninstallUrl(''), '');
  assert.equal(collectorUninstallUrl('http://example.com/v1/usage'), '');
  assert.equal(collectorUninstallUrl('https://user:pw@example.com/v1/usage'), '');
  assert.equal(collectorUninstallUrl('not a url'), '');
});
