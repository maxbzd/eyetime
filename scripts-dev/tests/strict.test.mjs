// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// A strict session is a promise: while it runs the rules that close sites may get stricter, never looser. A plain session is not bound by this.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, deepMerge } from '../../src/shared/defaults.js';
import { makeClassifier } from '../../src/shared/classify.js';
import { decide } from '../../src/shared/blocking.js';
import { createSession } from '../../src/shared/focus.js';
import { lockOf, strictView, softens } from '../../src/shared/strict.js';

const NOW = 1_800_000_000_000;
const base = () => { const s = deepMerge(DEFAULT_SETTINGS, {}); s.blocking.presets = { ...s.blocking.presets, social: true }; s.blocking.custom = ['news.example.test']; return s; };
const session = (settings, strict) => { const f = createSession({ minutes: 25, strict, now: NOW }); if (strict) f.lock = lockOf(settings); return f; };
// what policy.loadContext does
const verdict = (host, settings, focus, now = NOW + 60_000) => {
  const v = strictView(settings, focus, now);
  const eff = v ? v.settings : settings;
  return decide(host, { settings: eff, classifier: v ? v.classifier : makeClassifier(eff), focus, now }).action;
};

test('strict: loosening after the start does not open the site; the same change in a plain session does', () => {
  const s = base();
  const strict = session(s, true), plain = session(s, false);
  assert.equal(verdict('reddit.com', s, strict), 'block');
  const looser = (mut) => { const c = structuredClone(s); mut(c); return c; };
  const edits = {
    'allow-list': (c) => { c.blocking.allow.push('reddit.com'); },
    'marked useful': (c) => { c.sites['reddit.com'] = 'productive'; },
    'marked neutral': (c) => { c.sites['reddit.com'] = 'neutral'; },
    'category off': (c) => { c.blocking.presets.social = false; },
    'own site deleted': (c) => { c.blocking.custom = []; },
  };
  for (const [name, mut] of Object.entries(edits)) {
    const c = looser(mut);
    const host = name === 'own site deleted' ? 'news.example.test' : 'reddit.com';
    assert.equal(verdict(host, c, strict), 'block', `strict: ${name}`);
    if (name !== 'category off') assert.notEqual(verdict(host, c, plain), 'block', `plain: ${name} opens it, as before`); // (a site can sit in several categories)
  }
});

test('strict: tightening counts at once, and taking a site off the allow-list does too', () => {
  const s = base(); s.blocking.allow = ['reddit.com'];
  const strict = session(s, true);
  assert.equal(verdict('reddit.com', s, strict), 'allow', 'allowed at the start stays allowed');
  const tighter = structuredClone(s); tighter.blocking.allow = []; tighter.blocking.custom.push('new.example.test'); tighter.sites['wiki.example.test'] = 'distracting';
  assert.equal(verdict('reddit.com', tighter, strict), 'block', 'off the allow-list: closed at once');
  assert.equal(verdict('new.example.test', tighter, strict), 'block');
  assert.equal(verdict('wiki.example.test', tighter, strict), 'block');
});

test('strict: it ends with the session, and a plain or ended session has no special view', () => {
  const s = base(), strict = session(s, true);
  assert.equal(strictView(s, session(s, false), NOW + 1), null);
  assert.equal(strictView(s, strict, strict.endsAt + 1), null, 'ended');
  assert.equal(strictView(s, { ...strict, lock: undefined }, NOW + 1), null, 'a session from before this existed');
  const looser = structuredClone(s); looser.blocking.allow.push('reddit.com');
  assert.notEqual(verdict('reddit.com', looser, strict, strict.endsAt + 1), 'block', 'after the end the new rule is the rule');
});

test('strict: the copy is a copy (later edits cannot reach into it)', () => {
  const s = base(), lock = lockOf(s);
  s.blocking.custom.push('x.example.test'); s.blocking.presets.social = false; s.sites.a = 'productive';
  assert.deepEqual(lock.custom, ['news.example.test']); assert.equal(lock.presets.social, true); assert.deepEqual(lock.sites, {});
});

test('softens: true only when the present settings would open something the session closed', () => {
  const s = base(), strict = session(s, true);
  assert.equal(softens(s, strict, NOW + 1), false);
  const c = (mut) => { const x = structuredClone(s); mut(x); return x; };
  assert.equal(softens(c((x) => x.blocking.allow.push('reddit.com')), strict, NOW + 1), true);
  assert.equal(softens(c((x) => { x.sites['reddit.com'] = 'productive'; }), strict, NOW + 1), true);
  assert.equal(softens(c((x) => { x.blocking.presets.social = false; }), strict, NOW + 1), true);
  assert.equal(softens(c((x) => { x.blocking.custom = []; }), strict, NOW + 1), true);
  assert.equal(softens(c((x) => { x.blocking.custom.push('new.example.test'); x.sites['a.example.test'] = 'distracting'; }), strict, NOW + 1), false, 'tightening is not loosening');
  assert.equal(softens(c((x) => x.blocking.allow.push('reddit.com')), session(s, false), NOW + 1), false, 'a plain session is not bound');
});
