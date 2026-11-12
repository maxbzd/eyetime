// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('../..', import.meta.url).pathname;

test('Trusted Types: the policy lets through the extension\'s own scripts and nothing else', async () => {
  const made = [];
  globalThis.chrome = { runtime: { getURL: (p) => 'chrome-extension://abc/' + p } };
  globalThis.trustedTypes = { createPolicy: (name, rules) => { made.push(name); return { createScriptURL: (u) => rules.createScriptURL(u) }; } };
  const { ownScriptUrl } = await import('../../src/shared/trusted.js?fresh');
  assert.deepEqual(made, ['eyetime'], 'one policy, the one the manifest names');
  assert.equal(ownScriptUrl('chrome-extension://abc/src/newtab/ml/depth-worker.js'), 'chrome-extension://abc/src/newtab/ml/depth-worker.js');
  for (const bad of ['https://evil.test/w.js', 'data:text/javascript,alert(1)', 'blob:chrome-extension://abc/1', 'chrome-extension://other/x.js']) assert.throws(() => ownScriptUrl(bad), TypeError, bad);
  delete globalThis.trustedTypes; delete globalThis.chrome;
});

test('Trusted Types: without them (a test, an older browser) a string is accepted as before', async () => {
  delete globalThis.trustedTypes;
  const { ownScriptUrl } = await import('../../src/shared/trusted.js?plain');
  assert.equal(ownScriptUrl('anything'), 'anything');
});

test('Trusted Types: the manifest turns them on, names the one policy, and every worker is started through it', () => {
  const man = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const csp = man.content_security_policy.extension_pages;
  assert.match(csp, /require-trusted-types-for 'script'/); assert.match(csp, /trusted-types eyetime(;|$)/);
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []));
  for (const f of walk(path.join(root, 'src')).filter((x) => !x.includes('/ml/') && !x.includes('/locales/'))) {
    const text = fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''); // the code, not the comments about it
    for (const m of text.matchAll(/new (?:window\.)?(?:Shared)?Worker\(([^)]*)/g)) assert.match(m[1], /ownScriptUrl\(/, `${path.relative(root, f)}: a worker must be started through ownScriptUrl()`);
    assert.ok(!/\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML|document\.write\(|\beval\(|new Function\(/.test(text), `${path.relative(root, f)}: a sink that Trusted Types would refuse`);
  }
});
