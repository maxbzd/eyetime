// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Mutation testing: Stryker changes the logic a little (a `<` becomes `<=`, a `+` a `-`, a condition `true`) and runs the tests; a change that no test notices is a
// "survivor" — a place where the code can be wrong and the tests would still pass. Coverage says a line ran; this says whether a test would notice if it were wrong.
//   npm run mutation              the pure logic of src/shared that matters most (about ten minutes)
//   npm run mutation -- --mutate src/shared/time.js     one file
// It is not a dependency of the project (its own dependencies carry advisories that `npm audit` would flag): npm runs it from the registry at a fixed version.
import { readdirSync } from 'node:fs';

// tests that read the repository as a whole (weights of pages, every module loads, the shared vectors) or spend their time on purpose (the key derivation) say nothing about one mutated function
const NOT_FOR_MUTATION = new Set(['weight.test.mjs', 'load-all.test.mjs', 'conformance.test.mjs', 'vault.test.mjs', 'e2e-runner.test.mjs']);
const testFiles = readdirSync('scripts-dev/tests').filter((f) => f.endsWith('.test.mjs') && !NOT_FOR_MUTATION.has(f)).map((f) => 'scripts-dev/tests/' + f);

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'tap',
  tap: { testFiles, nodeArgs: [] },
  mutate: [
    'src/shared/blocking.js', 'src/shared/classify.js', 'src/shared/domains.js', 'src/shared/time.js', 'src/shared/validate.js', 'src/shared/focus.js',
    'src/shared/stats.js', 'src/shared/productivity.js', 'src/shared/datewords.js', 'src/shared/dayplan.js', 'src/shared/week.js', 'src/shared/tasks.js',
  ],
  coverageAnalysis: 'off',
  reporters: ['clear-text', 'json', 'html'],
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  thresholds: { high: 85, low: 70, break: null },
  timeoutMS: 20000,
  concurrency: 4,
  tempDirName: '.stryker-tmp',
};
