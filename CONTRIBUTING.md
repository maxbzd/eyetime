# Contributing to EyeTime

Thanks for helping make EyeTime better for everyone! It is free, source-available (FSL-1.1-ALv2) and local-first — please keep it that way: **no analytics, no remote code, no accounts, minimal permissions.**

## Licence of what you send

EyeTime is licensed under the Functional Source License, FSL-1.1-ALv2 (`LICENSE`). By sending a change (a pull request, a patch) you confirm that you wrote it or may send it, that it is licensed under the same terms, and that the author of EyeTime may also relicense it (for example for a commercial licence). If that does not suit you, open an issue to talk first. Every source file keeps its two header lines.

## Quick start

```bash
git clone https://github.com/maxbzd/eyetime.git && cd eyetime
# Chrome: chrome://extensions → Developer mode → Load unpacked → pick this folder (no build step)
npm run check        # syntax · manifest · HTML refs · i18n parity · icons · unit tests (Node 22+; nothing to install)
npm ci               # once, for the two dev tools below (eslint, typescript), at the versions in package-lock.json
npm run verify       # check + lint + types
```

Edit a file, press the reload icon on the extension card, refresh the page you're working on.

## Tour

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first (5 minutes). The short version:

- **Logic lives in `src/shared/` as pure functions** — time, domains, classification, blocking decisions, stats, migration. If you change behaviour, change it there and add a test in `scripts-dev/tests/`.
- **The service worker is event-driven.** No `setInterval`/`setTimeout` loops — use `chrome.alarms` or browser events. Anything that must survive suspension goes in storage.
- **UI is built with `h()` from `src/ui/dom.js`.** Never put user data in `innerHTML`; use `h()` / `textContent`.
- **Styling uses tokens** from `src/ui/tokens.css` ([docs/DESIGN.md](docs/DESIGN.md)). No hard-coded colours in page CSS; check both themes.

## Adding a language

1. Copy `src/shared/locales/en.js` to `xx.js`, translate the **values** (keep `{placeholders}`; plural objects use CLDR categories for your language).
2. Register it in `src/shared/locales/index.js` (`LOCALES`) and `src/shared/locales/languages.js` (`LANGUAGES`), then run `npm run locales` (writes `locales/data/xx.json`, the file the extension reads; `npm run check` fails when it is out of date).
3. Copy `_locales/en/messages.json` to `_locales/xx/messages.json` and translate it (store name, description, shortcut label, the short-video overlay).
4. `npm run check` fails if a key is missing or a placeholder differs.

Full guide, including how to fix a wrong translation and what to keep untouched: [docs/TRANSLATING.md](docs/TRANSLATING.md).

## Icons

Icons are [Lucide](https://lucide.dev). Use `icon('name')` (or `icon: 'name'` in a data table) and run:

```bash
npm i --no-save lucide-static && npm run icons
```

`icons.js` is generated — it contains only the icons the code references.

## Tests

| Command | What |
|---|---|
| `npm run check` | static checks + unit tests (no install needed) |
| `npm run lint` | ESLint over `src/`, the desktop screens and the scripts (every rule is an error) |
| `npm run coverage` | the unit tests with a coverage floor on `src/` |
| `npm run locales` | rewrites `src/shared/locales/data/*.json` after a translation changed |
| `node scripts-dev/e2e/e2e.cjs` | the whole extension in real Chromium ([how](scripts-dev/e2e/README.md)) |
| `npm run types` | TypeScript check of `src/` (all but `newtab/ml`) from JSDoc comments |
|  | (`tsconfig.json` turns `strict` on one flag at a time: `alwaysStrict`, `noImplicitThis`, `strictBindCallApply`, `strictFunctionTypes` and `useUnknownInCatchVariables` are on; `noImplicitAny` (about 3 400 places) and `strictNullChecks` (about 490) are what remains. Turn one on when you have fixed its places.) |
| `node scripts-dev/e2e/upgrade.cjs` | upgrade from old versions, every language at 400 px / 125 % zoom (`ONLY=regex` runs one case) |
| `node scripts-dev/e2e/visual.cjs [--update]` | screenshots of the main screens against `visual-baseline/`; `--update` after a change you meant to make |
| `node scripts-dev/e2e/perf.cjs`, `a11y.cjs --strict`, `blocking.cjs`, `calendar.cjs` | load budgets, accessibility (axe), real blocking scenarios, calendar subscription |
| `cd companion && python -m unittest -v test_companion` | desktop companion |
| `npm run build` | store packages in `dist/` (production build: bundled, minified, reproducible; see [docs/BUILDING.md](docs/BUILDING.md)) |
| `EXT=$PWD/dist/chrome node scripts-dev/e2e/dist.cjs` | the built package loaded into Chromium and used |
| `node scripts-dev/verify-build.mjs [--against file.zip]` | the build is reproducible, and equals a published package |
| `npm run mutation` | mutation testing of the pure logic (about ten minutes; not part of CI) |

Please run `npm run check` before opening a PR, and the e2e when you touch the worker, blocking or storage.

## Good first issues

Translations · new blocking presets (`src/shared/catalog.js`) · macOS/Linux companion backend · Firefox polish (sound, favicons) · accessibility audits with a screen reader · store listing assets.

## Pull requests

Small and focused is great. Describe the *why*, include a screenshot for UI changes (light + dark), and mention anything that changes permissions or stored data (that needs a migration + test).
