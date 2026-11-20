// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Every background Home offers has its drawing (a .bgx-<id> rule), a name in every language, and Today knows what to do with it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LANGUAGES } from '../../src/shared/locales/languages.js';

const read = (p) => fs.readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const ids = (read('src/newtab/home-controls.js').match(/export const BACKGROUNDS = \[([^\]]+)\]/) || [])[1].match(/'([a-z]+)'/g).map((s) => s.slice(1, -1));
const css = read('src/newtab/newtab.css') + read('src/ui/sphere.css');
const today = (read('src/newtab/home/background.js').match(/TODAY_BACKGROUNDS = \[([^\]]+)\]/) || [])[1].match(/'([a-z]+)'/g).map((s) => s.slice(1, -1));
const todayCss = read('src/newtab/today.css');

test('the list is read', () => assert.ok(ids.length >= 19 && ids.includes('sphere') && today.length >= 10));

test('every background is drawn, except "as in the look", which is the look\'s own', () => {
  for (const id of ids.filter((i) => i !== 'look')) assert.match(css, new RegExp(`\\.bgx-${id}\\b`), `${id} has no .bgx-${id} rule`);
});

test('every background has a name in every language', () => {
  for (const code of Object.keys(LANGUAGES)) {
    const src = read(`src/shared/locales/${code}.js`);
    for (const id of [...ids, 'photo']) assert.match(src, new RegExp(`["']bg\\.${id}["']\\s*:`), `${code}: no name for the background ${id}`);
  }
});

test('Today shows only the drawn backgrounds it paints dark; the rest become the wallpaper of the day', () => {
  for (const id of today) { assert.ok(ids.includes(id), `Today lists an unknown background ${id}`); assert.match(todayCss, new RegExp(`\\.bgx-${id}\\b`), `today.css does not paint ${id} dark`); }
  for (const id of ['look', 'photo', 'peaks']) assert.ok(!today.includes(id), `${id} must not be shown as it is in Today (white type needs a dark picture)`);
});
