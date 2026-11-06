// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Runs the unit tests with coverage of src/ and fails when the totals drop under the floor.
//   npm run coverage
// Only the logic that is plain JavaScript (src/shared) is reached by these tests; pages, the service worker and the content scripts are covered by the browser
// suites (scripts-dev/e2e), which this report cannot see. `load-all.test.mjs` makes every module of src/shared count, so the percentage is not flattered by files
// no test imports. The floor sits just under the current numbers (Nov 2026: lines 94.1, branches 86.5, functions 82.2, with the worker modules counted since they have tests against a pretend browser): raise it when the numbers rise.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const FLOOR = { lines: 93, branches: 85, functions: 80 };
const r = spawnSync(process.execPath, [
  '--experimental-test-coverage',
  '--test-coverage-include=src/**',
  '--test-coverage-exclude=src/newtab/ml/**',
  '--test-coverage-exclude=src/shared/packs/parked/**',
  `--test-coverage-lines=${FLOOR.lines}`, `--test-coverage-branches=${FLOOR.branches}`, `--test-coverage-functions=${FLOOR.functions}`,
  '--test', ...readdirSync('scripts-dev/tests').filter((f) => f.endsWith('.test.mjs')).map((f) => 'scripts-dev/tests/' + f),
], { stdio: 'inherit' });
process.exit(r.status ?? 1);
