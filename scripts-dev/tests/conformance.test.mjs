// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The extension and the Windows program are two implementations of a few small ideas. Here the extension is held to the statements in conformance/ (see its README);
// the Rust side reads the same files in desktop/core.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isScheduleActive } from '../../src/shared/blocking.js';

const vectors = JSON.parse(fs.readFileSync(new URL('../../conformance/schedule.json', import.meta.url), 'utf8'));

test('conformance: work hours run at the same moments in the extension as in the Windows program', () => {
  assert.ok(vectors.cases.length === 210 && vectors.moments.length === 13, "the vector file has the shape the test expects");
  const monday = new Date(2026, 10, 2); // a Monday
  let checked = 0;
  for (const c of vectors.cases) {
    // the Windows program counts the week from Monday (0), JavaScript from Sunday (0)
    const schedule = { enabled: true, days: c.days.map((d) => (d + 1) % 7), start: c.from, end: c.to };
    let i = 0;
    for (let weekday = 0; weekday < 7; weekday++) {
      for (const minute of vectors.moments) {
        const at = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + weekday, Math.floor(minute / 60), minute % 60);
        const want = c.bits[i++] === '1';
        assert.equal(isScheduleActive(schedule, at), want, `${c.from}–${c.to} on ${JSON.stringify(c.days)}, weekday ${weekday} minute ${minute}: the engine says ${want}`);
        checked++;
      }
    }
  }
  assert.equal(checked, 210 * 7 * 13);
});

test('conformance: the one difference that is on purpose (the same time twice) is what it says it is', () => {
  const when = new Date(2026, 10, 2, 12, 0); // Monday noon
  // the extension reads "start = end" as no schedule; the Windows program reads it as all day (desktop/README.md). The vectors hold no such rule, so this stays true on its own side.
  assert.equal(isScheduleActive({ enabled: true, days: [1], start: '09:00', end: '09:00' }, when), false);
});
