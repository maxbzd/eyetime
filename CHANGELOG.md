# Changelog

## 2.2.0 — 2026-10-19

A full pass over every screen, found by auditing each surface in light/dark, English/Russian and at several widths.

### Interface polish
- **Home**: an aligned bento grid (rows share one height) replaces the ragged masonry; task rows give the title the full width with actions on hover; designed empty states; keyboard shortcuts (`f` focus goal, `n` task, `d` close the day, `c` customize, `i`/`s` Insights/Settings, `?` help).
- **Popup** now fits Chromium's 600 px limit in every state (was up to ~980 px): side-by-side running card, one-line Today, break chip in the header.
- **Insights** split into **Overview / Focus / Sites & apps / Patterns** tabs; the Focus tab is a proper card grid with labelled charts; larger calendar heatmap.
- **Settings**: search box (press `/`), clearer group headings, layout fixes.
- **Onboarding** gained *Make it yours* (live look picker) and a daily-goal choice.
- Tooling: `scripts-dev/e2e/audit.cjs` (screenshots of every surface/state) and `contrast-sweep.cjs` (rendered contrast on every page × look × scheme).


## 2.1.0 — 2026-10-19

### Make it yours — customisation
- **Eleven looks** (Calm, Paper, Midnight, Terminal, Sakura, Forest, Aurora, Mono, Sunset, Nord, Ocean), each with light and dark schemes and its own typography, corners, card style and shadows. Live split light/dark previews in **Settings → Appearance**.
- Colour mode **System / Light / Dark / Schedule**; accent = look colour, ten presets or **any custom colour** — contrast is enforced automatically (tested for every combination).
- Fonts (Inter, Manrope, Nunito, Source Serif, JetBrains Mono, System), interface size 90–125 %, corner style, density, card style, reduce motion.
- **Home**: 17 backdrops, 7 clock styles, 3 layouts, reorderable cards. Custom CSS (sanitised), copy/import a look as JSON, reset. See [docs/THEMES.md](docs/THEMES.md).
- Settings schema v3 (old `theme` / `accent` migrate automatically; v2 backups import fine).

### Productivity
- **Daily focus goal** with progress bar and goal streak; **session log** with a quick "how did it go?" rating after each session.
- **Task-linked focus**: pick a task (priorities first) or press ▶ on a task; time is added to the task, and you can tick it off right after.
- **Today's priorities**: star up to three tasks; Home nudges you to plan in the morning, review in the evening and celebrates a reached goal. "Not feeling it? Just 5 minutes" lowers the bar to start.
- **Only my sites** focus scope: closes everything except productive sites and your allow-list (per session or by default), with *Add to my sites* on the block page.
- **Long break** after every Nth session; **focus reminders** (time + weekdays + length, one click to start).
- **Intent on the pause page** (for work / break / autopilot / bored) — turning back is counted and celebrated.
- **Insights → Focus & productivity**: goal days, streak, average session, quality, **your best focus hours**, time by task, recent sessions, pause-page choices.
- New: `src/shared/productivity.js` (pure, tested), 33 unit tests, 55-step e2e.

### Research-driven focus (see [docs/RESEARCH.md](docs/RESEARCH.md))
- **Close the day**: a two-minute evening ritual — one win, "where did you leave off?" notes, and up to three priorities for tomorrow (applied automatically next morning).
- **If-then plans** on the pause page ("If I want to open reddit.com, then I will …") and **Park it for later**; **park a thought** while a session runs.
- **Ready-to-resume notes** per task, shown when you pick the task again; tasks can be **scheduled for a time** (notification starts the session).
- **Your own best session length**, learned from your ratings; goal **days off** don't break the streak.
- **Break ideas** (stand, look far, water, breathe) instead of a bare countdown; optional **ambient sound** (brown noise, rain, café) while focusing.
- Insights: site switches per hour, what pulls you away, weekday pattern, wins, best session length.
- 10 more e2e checks (65 total), 37 unit tests.

### Also in 2.1.0

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
