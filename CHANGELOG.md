# Changelog

## 2.1.0 — Unreleased

- **Break timer after a session** (Pomodoro-style): a rest countdown starts automatically, distracting sites stay open, popup/Home show a Break card with *Start next session* / *Skip*; badge turns green; configurable (off / 3 / 5 / 10 / 15 min).
- **Weekly review** on Insights (7-day range) with one actionable suggestion — e.g. *Set a 30 min/day limit for youtube.com* in one click, with Undo.
- **Right-click menu**: mark the current site as productive / neutral / distracting, toggle always-block, start/stop focus. (New permission: `contextMenus`.)
- Countdown in the Home tab title while a session runs; focus-trapped, labelled customise drawer; `role=timer` on the ring.
- Firefox/AMO: icons are built with `createElementNS` (no `innerHTML`); `web-ext lint` reports 0 errors.
- Store promo images in `store/promo/`.

## 2.0.0 — the redesign

A ground-up rebuild around one clear job: **start focusing in one click, understand your time honestly, look after your eyes.** See [docs/PRODUCT.md](docs/PRODUCT.md) for the audit and reasoning.

### New
- Calm, accessible design system with real light and dark themes, six accent colours, bundled Inter (Latin + Cyrillic) and Lucide icons.
- **Popup**: focus control, current-site card (classify in one tap, always-block, daily-limit meter), today's summary, quick note, pause tracking.
- **Home (new tab)**: clock, focus card, today, tasks, habits with streaks, notes, quick links, gradient/photo backgrounds, customise drawer; can be switched off.
- **Insights**: KPI row with deltas, stacked charts by day and hour, calendar heatmap, typical day, site table with one-tap re-classification, plain-language highlights, table view, CSV export.
- **Block page**: breathing pause, honest reason, live countdown, automatic release when the reason ends.
- **Eye care**: 20-20-20 counted in active screen time, guided break page, natural-break detection, bedtime nudge.
- **Strict focus** (per session), daily limits for any site, work-hours schedule, short-video guard, YouTube feed controls.
- 4-step onboarding; English and Russian, key-based i18n.

### Changed
- Event-driven service worker (no timers), per-day storage, serialised writes.
- No content script on every page and no all-sites permission; blocking uses `webNavigation` + `tabs`.
- Desktop companion rewritten: read-only, token-protected, no CORS, no window/process/registry actions.
- Automatic, tested migration of all 1.x data.

### Removed
- Widget builder (29 widgets), TickTick integration, Endel integration, "Nuclear mode", math/typing challenges, the Windows daemon's browser/incognito closing and its desktop web app. Reasons in PRODUCT.md.

### Security & privacy fixes
- The 1.x desktop agent answered any website with `Access-Control-Allow-Origin: *`, exposing active-window titles and accepting unauthenticated writes, and closed other browsers by default. Both are gone.

## 1.1.0
Habit tracker, work hours, blocking presets, toolbar badge, English + Russian UI, JSON/CSV export.
