// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Every counter and flag the report may carry is described, and described counters exist: the plan and the schema cannot drift apart.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FEATURES, FLAGS, WIN_FEATURES, WIN_FLAGS } from '../../src/shared/usage-schema.js';
import { FEATURE_PLAN, FLAG_PLAN, WIN_FEATURE_PLAN, WIN_FLAG_PLAN } from '../../server/usage/tracking-plan.js';
import { ADOPTION } from '../../server/usage/stats.js';

test('every counter and every flag is described, and nothing is described that does not exist', () => {
  assert.deepEqual(Object.keys(FEATURE_PLAN).sort(), [...FEATURES].sort());
  assert.deepEqual(Object.keys(FLAG_PLAN).sort(), [...FLAGS].sort());
  for (const [id, [what, page]] of [...Object.entries(FEATURE_PLAN), ...Object.entries(FLAG_PLAN)]) assert.ok(what.length > 8 && page.length > 3, id);
});

test('every counter is read somewhere: adoption, or one of the pages that reads a family of counters', () => {
  const families = /^(fl_|bp_|nt_|err_|onboarding_done)/;
  for (const f of FEATURES) assert.ok(ADOPTION.includes(f) || families.test(f), f + ' feeds no page');
});

test('the Windows app’s counters and flags are described too', () => {
  assert.deepEqual(Object.keys(WIN_FEATURE_PLAN).sort(), [...WIN_FEATURES].sort());
  assert.deepEqual(Object.keys(WIN_FLAG_PLAN).sort(), [...WIN_FLAGS].sort());
});
