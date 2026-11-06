import test from 'node:test';
import assert from 'node:assert/strict';
import { creditSeconds, splitAtMidnight } from '../../src/shared/time.js';

const span = (from, to) => [{ from, to }];

test('whole seconds are credited and the fraction is carried to the next span', () => {
  let r = creditSeconds(span(0, 1400));
  assert.deepEqual([r.credits.map((c) => c.sec), r.rem], [[1], 400]);
  r = creditSeconds(span(1400, 2900), r.rem); // 1500 ms + 400 carried = 1900
  assert.deepEqual([r.credits.map((c) => c.sec), r.rem], [[1], 900]);
  r = creditSeconds(span(2900, 3300), r.rem); // 400 + 900 = 1300
  assert.deepEqual([r.credits.map((c) => c.sec), r.rem], [[1], 300]);
});

test('flicking through tabs does not lose time: 100 spans of 400 ms are 40 s, not 0 s', () => {
  let rem = 0, total = 0, t = 0;
  for (let i = 0; i < 100; i++) { const r = creditSeconds(span(t, t + 400), rem); t += 400; rem = r.rem; total += r.credits.reduce((a, c) => a + c.sec, 0); }
  assert.equal(total, 40);
  assert.equal(rem, 0);
});

test('whatever the spans, the seconds credited plus what is carried is exactly the time that passed', () => {
  let x = 12345;
  const rnd = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let rem = 0, credited = 0, passed = 0, t = 1_000_000;
  for (let i = 0; i < 5000; i++) {
    const ms = Math.floor(rnd() * rnd() * 20_000); // many short spans, a few long ones
    const r = creditSeconds(span(t, t + ms), rem);
    t += ms; passed += ms; rem = r.rem; credited += r.credits.reduce((a, c) => a + c.sec, 0);
    assert.ok(rem >= 0 && rem < 1000);
  }
  assert.equal(credited * 1000 + rem, passed);
});

test('a span across midnight is credited to both days and the carry goes through both pieces', () => {
  const from = new Date(2026, 5, 10, 23, 59, 59, 600).getTime(), to = new Date(2026, 5, 11, 0, 0, 1, 100).getTime(); // 1500 ms: 400 before midnight, 1100 after
  const r = creditSeconds(splitAtMidnight(from, to));
  assert.deepEqual(r.credits.map((c) => c.sec), [1]); // 400 ms carried into the second piece: 1500 ms in all = 1 s
  assert.equal(r.rem, 500);
  assert.ok(r.credits[0].from >= new Date(2026, 5, 11).getTime() - 1, 'the whole second lands on the day where it was completed');
});

test('a carry that makes no sense is ignored', () => {
  for (const bad of [-5, 1000, 5000, NaN, undefined, Infinity, '7']) assert.equal(creditSeconds(span(0, 500), bad).credits.length, 0, String(bad));
  assert.equal(creditSeconds([], 300).rem, 300, 'no span, nothing changes');
  assert.deepEqual(creditSeconds([{ from: 5, to: 5 }], 0), { credits: [], rem: 0 });
});
