// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// An update that takes a part away also takes away what that part left in the person's storage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeChrome } from './helpers/fake-chrome.mjs';

const chrome = installFakeChrome();
const { dropRetired } = await import('../../src/background/retired.js');
const { getSettings } = await import('../../src/shared/storage.js');

test('retired settings, keys, widgets and their places on Home are removed; the rest stays', async () => {
  await chrome.storage.local.clear();
  await chrome.storage.local.set({
    weatherCache: { at: 1 }, siteGuess: { 'a.com': 'productive' }, tasks: [{ id: 't', text: 'keep' }],
    settings: {
      weather: { on: true, place: { lat: 1, lon: 2 } }, smartSites: { on: true }, focus: { minutes: 40 },
      newtab: {
        widgets: [{ id: 'wmoon01', kind: 'moon', cfg: {} }, { id: 'wclock1', kind: 'clock', cfg: {} }, { id: 'wweath1', kind: 'weather', cfg: {} }, { id: 'wstack1', kind: 'stack', cfg: { items: [{ kind: 'water', when: 'any', cfg: {} }, { kind: 'plan', when: 'any', cfg: {} }], pick: 'auto', i: 0 } }],
        canvas: { on: true, items: { wmoon01: { x: 10, y: 10 }, wclock1: { x: 50, y: 50 }, wweath1: { x: 80, y: 20 }, clock: { x: 50, y: 40 } } },
      },
    },
  });
  await dropRetired();
  const raw = await chrome.storage.local.get(null), s = await getSettings();
  assert.equal('weatherCache' in raw, false); assert.equal('siteGuess' in raw, false);
  assert.deepEqual(raw.tasks, [{ id: 't', text: 'keep' }], 'a person\'s own data is not touched');
  assert.equal('weather' in s, false); assert.equal('smartSites' in s, false); assert.equal(s.focus.minutes, 40);
  assert.deepEqual(s.newtab.widgets.map((w) => w.kind).sort(), ['clock', 'stack']);
  const stack = s.newtab.widgets.find((w) => w.kind === 'stack');
  assert.deepEqual(stack.cfg.items.map((m) => m.kind), ['plan'], 'a retired kind inside a stack goes too');
  assert.deepEqual(Object.keys(s.newtab.canvas.items).sort(), ['clock', 'wclock1'], 'the places of the dropped widgets go; the blocks of Home stay');
  await dropRetired(); // again: nothing changes
  assert.deepEqual((await getSettings()).newtab.widgets.map((w) => w.kind).sort(), ['clock', 'stack']);
});

test('settings that were never touched are no problem', async () => {
  await chrome.storage.local.clear();
  await dropRetired();
  assert.equal((await getSettings()).newtab.widgets.length, 0);
});
