# End-to-end test

Drives the real extension in Chromium: install → onboarding → tracking → pause/continue → strict focus → block page auto-release → limits → 1.x migration → every page renders without console errors → short-video guard.

```bash
npm i --no-save playwright          # or: PLAYWRIGHT_PATH=/path/to/playwright
npx playwright install chromium     # once
node scripts-dev/e2e/e2e.cjs        # EXT=dist/chrome node ... to test the packaged build
```

Every hostname is mapped to a local server (`--host-resolver-rules`), so the test needs no internet. Takes ~1 minute.

## Running everything

The suites are listed in `suites.json` (the one place CI reads too). `run.mjs` runs them:

```bash
npm run e2e                                  # all of them, three browsers at a time (about 12 minutes on 4 cores)
node scripts-dev/e2e/run.mjs --only starters,quotes
node scripts-dev/e2e/run.mjs --only a11y     # a prefix runs the parts of a split script (a11y-1, a11y-2, a11y-3)
node scripts-dev/e2e/run.mjs --shard 2/5 --jobs 2 --retries 1     # what one CI machine does
node scripts-dev/e2e/run.mjs --list          # what would run and for how long
```

* A big script is split with an environment variable (`ONLY` for upgrade.cjs, `PART=i/n` for a11y.cjs, `VISUAL_LANGS` for visual.cjs): add the parts to `suites.json`.
* A new test script must be added to `suites.json` (a suite, or a `tools` entry for a helper): a unit test fails when one is left out, because CI would never run it.
* `weight` is only a guess of the seconds a suite takes; it balances the shards (`split` in `run.mjs`). Update it from the summary the runner prints when a suite changes a lot.
* A suite that fails and passes on the retry is reported as **flaky** (a warning in CI): fix it, do not raise the retries.
* Logs of every suite are in `/tmp/eyetime-e2e/<id>.log` (uploaded as an artifact when a CI shard fails).
