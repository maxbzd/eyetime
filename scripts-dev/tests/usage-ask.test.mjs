// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The rhythm of the question about anonymous numbers: when it may be asked, when it is a good moment, what "Not now" and "No, thanks" do, and that a consent is for what it was given for.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let mem = {};
const pick = (keys) => (keys == null ? { ...mem } : Object.fromEntries([].concat(keys).filter((k) => k in mem).map((k) => [k, structuredClone(mem[k])])));
globalThis.chrome = { storage: { local: { get: async (k) => pick(k), set: async (o) => { Object.assign(mem, structuredClone(o)); }, clear: async () => { mem = {}; }, remove: async (k) => { for (const x of [].concat(k)) delete mem[x]; } }, onChanged: { addListener() {}, removeListener() {} } }, runtime: { getManifest: () => ({ version: '3.8.1' }) } };

const { shouldAsk, goodMoment, reportDue, consentCurrent, CONSENT_VERSION, ASK_TIMING, emptyUsage, record } = await import('../../src/shared/usage.js');
const { getShare, enableSharing, declineAsk, deferAsk, wantsToAsk } = await import('../../src/shared/usage-store.js');
const { EXPERIMENTS, validateReport } = await import('../../src/shared/usage-schema.js');

const DAY = 86_400_000, T0 = new Date(2026, 10, 2, 10).getTime();
const qualified = () => { const u = emptyUsage(T0); record(u, 'focus_done', T0); record(u, 'newtab_view', T0 + DAY); return u; };

test('ask: only to someone who finished a session and came back, and only with a collector', () => {
  const u = emptyUsage(T0);
  assert.equal(shouldAsk(u, null, true, T0), false);
  assert.equal(shouldAsk(qualified(), null, false, T0 + DAY), false, 'no collector, no question');
  assert.equal(shouldAsk(qualified(), null, true, T0 + DAY), true);
  assert.equal(shouldAsk(qualified(), { on: false, askedAt: T0 }, true, T0 + 90 * DAY), false, 'a "no" is final');
});

test('ask: "Maybe later" waits three weeks and the question comes back twice, never a fourth time', async () => {
  const u = qualified(), d = T0 + DAY;
  assert.equal(shouldAsk(u, { on: false, deferredAt: d }, true, d + 20 * DAY), false);
  assert.equal(shouldAsk(u, { on: false, deferredAt: d }, true, d + 22 * DAY), true);
  mem = {}; await deferAsk(d); let s = await getShare();
  assert.deepEqual([s.deferrals, s.deferredAt, s.askedAt], [1, d, null], 'a first "maybe later" is not an answer');
  await deferAsk(d + 22 * DAY); s = await getShare();
  assert.deepEqual([s.deferrals, s.askedAt], [2, null], 'nor is a second: three asks in all');
  assert.equal(ASK_TIMING.maxDeferrals, 2);
  await deferAsk(d + 44 * DAY); s = await getShare();
  assert.ok(s.askedAt > 0, 'a third "later" cannot happen (the third ask has no such button); if it did it would be a "no"');
});

test('ask: a good moment is right after a finished session, or after a week of waiting', () => {
  assert.equal(goodMoment({ eligibleAt: T0 }, T0 + 2 * DAY, false), false, 'not yet');
  assert.equal(goodMoment({ eligibleAt: T0 }, T0 + 2 * DAY, true), true, 'just finished a session');
  assert.equal(goodMoment({ eligibleAt: T0 }, T0 + 8 * DAY, false), true, 'it has waited long enough');
  assert.equal(goodMoment({}, T0, false), false); assert.equal(goodMoment(null, T0, false), false);
});

test('consent: a "yes" is for what it was given for, so a changed scope asks again and nothing is sent meanwhile', async () => {
  mem = { meta: { installedAt: T0 - 5 * DAY, schemaVersion: 3 } };
  await enableSharing(T0); const s = await getShare();
  assert.deepEqual([s.on, s.consentV, s.askedAt > 0], [true, CONSENT_VERSION, true]);
  assert.equal(consentCurrent(s), true);
  assert.equal(reportDue({ ...s, id: s.id }, T0 + 2 * DAY, true), true);
  const old = { ...s, consentV: CONSENT_VERSION - 1 };
  assert.equal(consentCurrent(old), false);
  assert.equal(reportDue(old, T0 + 30 * DAY, true), false, 'reports stop until the person agrees again');
  assert.equal(shouldAsk(qualified(), old, true, T0 + DAY), true, 'and the question comes back (it is a new question)');
  assert.equal(shouldAsk(qualified(), s, true, T0 + DAY), false, 'a current consent is not asked about');
  const id = s.id; await chrome.storage.local.set({ usageShare: { ...s, consentV: CONSENT_VERSION - 1 } });
  await enableSharing(T0 + 40 * DAY); const again = await getShare();
  assert.equal(again.id, id, 'the same person agreeing to the changed scope keeps the same random id'); assert.equal(again.consentV, CONSENT_VERSION);
});

test('ask: the wording is an experiment that is measured by who agreed, and it is listed where the collector can see it', async () => {
  const e = EXPERIMENTS.find((x) => x.id === 'ask-copy');
  assert.ok(e && e.measures === 'consent' && e.arms[0] === 'personal' && e.arms.includes('practical'), JSON.stringify(EXPERIMENTS));
  const rep = { v: 1, id: 'a'.repeat(32), app: '3.8.1', br: 'chrome', os: 'win', lang: 'en', look: 'calm', layout: 'today', mode: 'auto', age: 5, act: [0], first: {}, ft: {}, x: ['ask-copy:practical'] };
  assert.deepEqual(validateReport(rep), { ok: true });
  assert.equal(validateReport({ ...rep, x: ['ask-copy:other'] }).ok, false);
  mem = {}; assert.equal(await wantsToAsk(T0), false, 'no collector in this build');
});

test('the card: every way of saying no is a visible button, and nothing is pre-ticked or timed', () => {
  const src = readFileSync(new URL('../../src/newtab/home/usage-ask.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../../src/newtab/newtab.css', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /checked|setInterval|countdown|spots? left|only today|hurry/i, 'no pre-ticked box, no timer, no pressure');
  assert.match(src, /us\.askNo/); assert.match(src, /us\.askLater/); assert.match(src, /us\.askNever/); assert.match(src, /us\.askPolicy/);
  assert.match(src, /us\.askAgain/, 'a "maybe later" says that it will be asked again');
  const refuse = /\.ask-refuse \.btn \{([^}]*)\}/.exec(css)[1];
  assert.match(refuse, /height: 44px/); assert.match(refuse, /border-color: var\(--border-strong\)/); assert.match(refuse, /color: var\(--text\)/);
  assert.doesNotMatch(refuse, /opacity|display: none|visibility|font-size: (?:[0-9]|10|11)px/, 'a refusal is never faded, hidden or tiny');
});
