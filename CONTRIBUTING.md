# Contributing to EyeTime

Thanks for helping make EyeTime better for everyone! It is free, open source and local-first — please keep it that way: **no analytics, no remote code, no accounts, minimal permissions.**

## Quick start

```bash
git clone https://github.com/maxbzd/eyetime.git && cd eyetime
# Chrome: chrome://extensions → Developer mode → Load unpacked → pick this folder (no build step)
npm run check        # syntax · manifest · HTML refs · i18n parity · icons · unit tests (Node 22+)
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
2. Register it in `src/shared/locales/index.js` (`LOCALES` and `LANGUAGES`).
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
| `npm run check` | static checks + unit tests |
| `node scripts-dev/e2e/e2e.cjs` | the whole extension in real Chromium ([how](scripts-dev/e2e/README.md)) |
| `npm run types` | TypeScript check of `src/shared` and `src/background` from JSDoc comments |
| `node scripts-dev/e2e/upgrade.cjs` | upgrade from old versions, every language at 400 px / 125 % zoom (`ONLY=regex` runs one case) |
| `node scripts-dev/e2e/visual.cjs [--update]` | screenshots of the main screens against `visual-baseline/`; `--update` after a change you meant to make |
| `node scripts-dev/e2e/perf.cjs`, `a11y.cjs --strict`, `blocking.cjs`, `calendar.cjs` | load budgets, accessibility (axe), real blocking scenarios, calendar subscription |
| `cd companion && python -m unittest -v test_companion` | desktop companion |
| `npm run build` | store packages in `dist/` |

Please run `npm run check` before opening a PR, and the e2e when you touch the worker, blocking or storage.

## Good first issues

Translations · new blocking presets (`src/shared/catalog.js`) · macOS/Linux companion backend · Firefox polish (sound, favicons) · accessibility audits with a screen reader · store listing assets.

## Pull requests

Small and focused is great. Describe the *why*, include a screenshot for UI changes (light + dark), and mention anything that changes permissions or stored data (that needs a migration + test).
