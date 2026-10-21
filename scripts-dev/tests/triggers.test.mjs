import test from 'node:test';
import assert from 'node:assert/strict';
import { triggerInsights } from '../../src/shared/triggers.js';

const cls = (h) => (h === 'reddit.com' || h === 'youtube.com' ? 'distracting' : 'productive');
const day = (o) => ['2026-10-2' + Math.floor(Math.random() * 9), o];
const mk = (n, f) => Array.from({ length: n }, (_, i) => [`2026-10-${10 + i}`, f(i)]);

test('a site used mostly in one two-hour window is a "window" trigger', () => {
  const entries = mk(5, () => ({ d: { 'reddit.com': 2400, 'github.com': 9000 }, h: { 14: { 'reddit.com': 1200 }, 15: { 'reddit.com': 1000 }, 9: { 'reddit.com': 200 }, 10: { 'github.com': 9000 } }, pa: { 'reddit.com': 3 } }));
  const [r] = triggerInsights(entries, cls);
  assert.equal(r.host, 'reddit.com'); assert.equal(r.kind, 'window'); assert.equal(r.peak.from, 14); assert.equal(r.peak.to, 16); assert.ok(r.peak.share > 0.9);
  assert.equal(r.avgMin, 40); assert.equal(r.attempts, 15); assert.equal(r.limitMin, 25); // 60 % of 40 min, rounded to 5
});

test('spread-out heavy use suggests a limit; light use only watches; no hourly data means no time-of-day claim', () => {
  const spread = mk(4, () => ({ d: { 'youtube.com': 3000 }, h: Object.fromEntries(Array.from({ length: 10 }, (_, k) => [8 + k, { 'youtube.com': 300 }])) }));
  assert.equal(triggerInsights(spread, cls)[0].kind, 'limit');
  const light = mk(4, () => ({ d: { 'youtube.com': 400 }, h: { 12: { 'youtube.com': 400 } } }));
  assert.equal(triggerInsights(light, cls)[0].kind, 'window'); // concentrated even if small
  const noHours = mk(4, () => ({ d: { 'youtube.com': 1500 } }));
  const r = triggerInsights(noHours, cls)[0]; assert.equal(r.peak, null); assert.equal(r.kind, 'limit');
});

test('too little data or productive sites produce nothing', () => {
  assert.equal(triggerInsights(mk(2, () => ({ d: { 'reddit.com': 3000 } })), cls).length, 0); // < 3 days
  assert.equal(triggerInsights(mk(5, () => ({ d: { 'github.com': 9000 } })), cls).length, 0);
  assert.equal(triggerInsights([], cls).length, 0);
});
