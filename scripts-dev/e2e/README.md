# End-to-end test

Drives the real extension in Chromium: install → onboarding → tracking → pause/continue → strict focus → block page auto-release → limits → 1.x migration → every page renders without console errors → short-video guard.

```bash
npm i --no-save playwright          # or: PLAYWRIGHT_PATH=/path/to/playwright
npx playwright install chromium     # once
node scripts-dev/e2e/e2e.cjs        # EXT=dist/chrome node ... to test the packaged build
```

Every hostname is mapped to a local server (`--host-resolver-rules`), so the test needs no internet. Takes ~1 minute.
