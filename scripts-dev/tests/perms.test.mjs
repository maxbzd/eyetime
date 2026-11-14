// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// "Every permission is explained": the manifest and the table in Settings → Data and privacy must say the same thing.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../../', import.meta.url).pathname;

test('every permission in the manifest has a row (and a text in every language) in the permissions table of Settings', async () => {
  const man = JSON.parse(fs.readFileSync(root + 'manifest.json', 'utf8'));
  const table = fs.readFileSync(root + 'src/options/sections-data.js', 'utf8').match(/const PERMS = \[([\s\S]*?)\];/)[1];
  for (const p of man.permissions) assert.ok(table.includes(`'${p}'`), `${p} is in the manifest but not in the table of Settings`);
  const keys = [...table.matchAll(/'(perm\.[A-Za-z]+)'/g)].map((m) => m[1]);
  for (const lang of ['en', 'ru', 'es', 'de', 'fr', 'it', 'pt', 'pl', 'uk', 'zh', 'ja']) {
    const text = fs.readFileSync(root + `src/shared/locales/${lang}.js`, 'utf8');
    for (const k of keys) assert.ok(text.includes(`'${k}'`) || text.includes(`"${k}"`), `${lang} lacks ${k}`);
  }
});
