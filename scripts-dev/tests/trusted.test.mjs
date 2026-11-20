// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('../..', import.meta.url).pathname;

test('Trusted Types: the manifest turns them on; no script is a string made into code; no WebAssembly, no workers', () => {
  const man = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const csp = man.content_security_policy.extension_pages;
  assert.match(csp, /require-trusted-types-for 'script'/); assert.match(csp, /trusted-types eyetime(;|$)/);
  // nothing a theme can reach (an image, a font, a sound, a stylesheet) may be fetched from outside: the browser refuses it even if the CSS filter is ever got around
  for (const d of ['img-src', 'font-src', 'media-src', 'style-src']) {
    const m = csp.match(new RegExp(`(?:^|;)\\s*${d}\\s+([^;]*)`)); assert.ok(m, d + ' is set');
    assert.ok(!/(https?:|\*|\/\/)/.test(m[1]), `${d} lets something in from the network: ${m[1]}`);
  }
  assert.match(csp, /base-uri 'self'/); assert.ok(!/default-src|connect-src/.test(csp), 'connections (the services the person connects) are not limited here');
  assert.match(csp, /(?:^|;)\s*script-src 'self'(;|$)/, "only the package's own scripts; no 'wasm-unsafe-eval', since nothing needs WebAssembly");
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []));
  for (const f of walk(path.join(root, 'src')).filter((x) => !x.includes('/locales/'))) {
    const text = fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''); // the code, not the comments about it
    assert.ok(!/new (?:window\.)?(?:Shared)?Worker\(|WebAssembly\./.test(text), `${path.relative(root, f)}: the extension starts no workers and runs no WebAssembly`);
    assert.ok(!/\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML|document\.write\(|\beval\(|new Function\(/.test(text), `${path.relative(root, f)}: a sink that Trusted Types would refuse`);
  }
});
