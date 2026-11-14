// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// What each page and the worker load at start, counted from the code itself (no browser, so the numbers are the same on every machine): the
// modules reachable through static imports from the scripts of the page. A page that quietly starts to pull in a megabyte fails here, in seconds,
// instead of showing up as a slower new tab. Dynamic `import()` (loaded when needed) is not counted: that is how a heavy part is made lazy.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const KB = 1024;

function graph(entries) {
  const seen = new Map();
  const visit = (file) => {
    if (seen.has(file) || !fs.existsSync(file)) return;
    const text = fs.readFileSync(file, 'utf8');
    seen.set(file, text.length);
    // static imports and re-exports only (a dynamic import( ... ) has no `from` and no bare string right after `import`)
    for (const m of text.matchAll(/(?:^|[;\n}])\s*(?:import|export)\s*(?:[^'"`;()]*?\sfrom\s*)?['"]([^'"]+)['"]/g)) {
      if (m[1].startsWith('.')) visit(path.resolve(path.dirname(file), m[1]));
    }
  };
  entries.forEach(visit);
  return seen;
}
const scriptsOf = (html) => {
  const text = fs.readFileSync(html, 'utf8');
  return [...text.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => path.resolve(path.dirname(html), m[1]));
};
const total = (g) => [...g.values()].reduce((a, b) => a + b, 0);
const rel = (g) => [...g.keys()].map((f) => path.relative(root, f));

// bytes of JavaScript read at start, with room to grow a little (the new tab is at 950 KB since the 69 wallpaper names went into the English words; the other languages are read as data)
const PAGES = {
  'src/popup/popup.html': 450,
  'src/newtab/newtab.html': 960,
  'src/insights/insights.html': 450,
  'src/options/options.html': 760,
  'src/blocked/blocked.html': 400,
  'src/break/break.html': 400,
  'src/onboarding/onboarding.html': 450,
};

for (const [page, budget] of Object.entries(PAGES)) {
  test(`weight: ${page} starts within ${budget} KB of script, and loads one language only`, () => {
    const g = graph(scriptsOf(path.join(root, page)));
    const kb = total(g) / KB;
    assert.ok(g.size > 3, 'the page was read (found ' + g.size + ' modules)');
    assert.ok(kb <= budget, `${page}: ${kb.toFixed(0)} KB over ${g.size} modules, budget ${budget} KB`);
    const langs = rel(g).filter((f) => /shared\/locales\/(?!en\.js$|languages\.js$)[^/]+\.js$/.test(f));
    assert.deepEqual(langs, [], 'a page must not load translations as code: they are read as data, one language');
  });
}

test('weight: the service worker does not load translations as code either, and stays small', () => {
  const g = graph([path.join(root, 'src/background/index.js')]);
  const langs = rel(g).filter((f) => /shared\/locales\/(?!en\.js$|languages\.js$)[^/]+\.js$/.test(f));
  assert.deepEqual(langs, []);
  assert.ok(total(g) / KB <= 700, `the worker reads ${(total(g) / KB).toFixed(0)} KB at every wake-up (budget 700 KB)`);
});

test('weight: the graph reader sees what it should (a known page reaches a known module, English is in, other languages are not)', () => {
  const g = rel(graph(scriptsOf(path.join(root, 'src/popup/popup.html'))));
  assert.ok(g.includes('src/shared/i18n.js') && g.includes('src/shared/locales/en.js'));
  assert.ok(!g.includes('src/shared/locales/ru.js'));
});
