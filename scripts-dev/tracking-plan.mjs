// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Writes docs/TRACKING-PLAN.md from the schema and server/usage/tracking-plan.js; with --check it only says whether the file is up to date.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURES, FLAGS, WIN_FEATURES, WIN_FLAGS } from '../src/shared/usage-schema.js';
import { renderTrackingPlan } from '../server/usage/tracking-plan.js';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs/TRACKING-PLAN.md');
const text = renderTrackingPlan(FEATURES, FLAGS, WIN_FEATURES, WIN_FLAGS);
if (process.argv.includes('--check')) {
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) { console.error('docs/TRACKING-PLAN.md is out of date: run  node scripts-dev/tracking-plan.mjs'); process.exit(1); }
} else { fs.writeFileSync(file, text); console.log('tracking plan written'); }
