# Changelog

## 3.0.0 — 2026-10-21

Plan with your own words, see where focus goes, reach people in their language.

### New
- **Calendar by link.** Paste your calendar's secret iCal address (Google, Outlook…; links that redirect to another site are refused with a clear message) in Settings → Data & privacy and EyeTime refreshes it every hour, straight from your browser; the next meeting shows on the focus card. The browser asks for access to the one site that hosts the calendar; unsubscribing, resetting or restoring a backup withdraws it. Nothing is followed to other sites, at most one download runs at a time, and a failing link is retried at most every 30 minutes. The address stays on the device: never synced, never in a backup. Importing a file still works.
- **Dates in plain words** in quick add, in six languages: `Report tomorrow 14:30 45m !`, `Call on Friday`, `Pay rent in 3 days`, `Plan next week`, `Отчёт завтра`, `Informe el lunes`, `Bericht morgen`, `Rapport demain`, `Relatório amanhã`. A task with a date gets a due chip and stays out of today's plan. Repeat words ("every day", "cada día", "jeden Tag", "chaque jour", "todo dia"…) work in all six languages too.
- **Focus time by project.** The first `#tag` of the task you focus on becomes the session's project; Insights → Focus shows time per project with the change against the previous period.
- **Tasks in and out:** export as a Markdown checklist or CSV; import from Markdown, CSV or a plain list (each line understands quick-add words); duplicates are skipped and you confirm first.
- **Forgive one missed day a week** for the goal streak (on by default; Settings → Focus).
- **"What's new"** card after an update that brings new features (never after a small fix, never on first install).
- **Suggest an idea** button next to *Report a problem*; GitHub templates for ideas and translation fixes.
- The **Monday digest** also tells how many weekly goals you reached and where most focus went.
- The language picker in onboarding is a drop-down (six languages no longer fit in a row).

### For the stores
- Descriptions for the Chrome / Edge / Firefox listings in all six languages and localized screenshots for each (`store/listing/`, `store/screenshots/<lang>/`); Edge submission steps; the permission texts explain the new optional address permission.

### Under the hood
- **Tests:** visual regression of the main screens (English, Russian, German · light and dark), a load check (a year of dense data and 60 open tabs: Home opens in 0.4 s), an end-to-end test of the calendar subscription with a local server (no cookies, errors keep old events, unsubscribe cleans up, the address never reaches a backup), date-word and import/export unit tests in all languages.
- **Types:** `npm run types` checks `src/shared` and `src/background` with TypeScript from JSDoc comments (zero errors, in CI).
- The two biggest files were split (`modules.js` → one file per Home module; `sections.js` → data and about sections); the interface is pixel-identical (the visual test proves it).

### Fixed — found by an independent review before release
- Calendar subscription: a failing link is retried at most every 30 minutes (not on every worker wake-up), one download at a time, the hourly alarm is no longer pushed back by wake-ups, a download that finishes after *Unsubscribe* can no longer bring the address back, redirects to other sites are refused, the response size is limited while reading; *Reset* and *Restore backup* now withdraw the browser permission too.
- Date words: "среда" (environment), German "jeden Morgen", "every monday" (a repeat), "no friday meetings", dates in the past and "this friday" on a Friday behave sensibly; Portuguese "no sábado" works.
- Task import: quoted CSV headers, invalid dates/times, "Completed" status, re-importing an export no longer duplicates finished tasks and finished tasks no longer count as "done today"; files over 2 MB are refused.
- Home: deleting a task could remove a different one after another tab or a focus session changed the list; plural forms in the new messages ("1 task", "1 event"); one Settings listener instead of one per redraw.
- Seed data for store screenshots (empty Habits card, first-run checklist in the picture).

## 2.8.0 — 2026-10-21

Four new languages, calendar and planning fixes, a demo video.

### New
- **Spanish, German, French and Portuguese** — the whole interface plus the store texts (machine-translated and reviewed; corrections are welcome, see `docs/TRANSLATING.md`). Quick add understands "every day / jeden Tag / cada día / chaque jour / todo dia" and the weekday and weekly forms in these languages too.
- **A 30-second demo** (`store/demo.mp4`, `demo.gif`) on the project page and in the README, recorded by a script (`scripts-dev/e2e/demo.cjs`) so it can be refreshed with every release.
- The language picker in onboarding is a drop-down (six languages no longer fit in a row).

### Fixed — found by an independent code review
- **Calendar import** handles real-world files: weekly series that started more than two years ago, "3rd Tuesday of the month", every-other-week on given days, yearly events, date-only end and exception dates, moved and cancelled meetings (no ghost copies), reminders no longer replace an event's title, and times stay right across clock changes and for UTC or other-time-zone series.
- **"Clear completed" no longer deletes recurring tasks.** A recurring task you did not finish keeps today's reminder. The words *daily*, *weekly*, *weekdays* inside a sentence ("Prepare weekly report") are no longer taken as a repeat rule. Recurring tasks come back right after midnight, not hours later.
- **Plan my day** leaves tasks you booked for another day alone, no longer returns an empty plan when your best hour is late in the evening, uses the work-day end only when the work schedule is on, and says so when everything is already scheduled.
- Estimate accuracy no longer counts a recurring task twice; weekly goals and the estimate history are kept when you restore a backup; the week on the share card is the week the goals belong to.
- *What pulls you* no longer says "mostly between … " and "spread through the day" at once.

### Fixed — narrow windows and long translations
- Buttons may wrap their label in narrow windows instead of overflowing; the calendar button row and module headers no longer overflow; every language is checked at 400 px / 125 % zoom in the test suite.
- Wording and clipped labels corrected in all four new languages (share column header, search field, if-then plans, KPI tiles…); dates in the calendar status follow the app language; four screen-reader labels were English-only.

### Fixed — releases
- The Release workflow failed on a clean checkout (the project-page images are generated); the check now builds them first. Versions 2.6.0 and 2.7.0 were never published as GitHub releases — their changes are all in this one.

## 2.7.0 — 2026-10-21

Planning the day and the week.

### New
- **Plan my day** (Home → Tasks): pick how much time you really have today and EyeTime fits your tasks into it, using your own estimate history, and shows what does not fit.
- **Recurring tasks**: type `every day`, `weekdays` or `every week` in quick add (also in Russian). A finished recurring task reappears on its next day by itself.
- **Weekly outcomes**: a small strip on Home with your 1–3 goals for the week; the weekly review and the shareable card report how many you reached.
- **Calendar import (.ics)** in Settings → Data & privacy: EyeTime shows your next meeting on the focus card, warns when a session would overlap it and offers a session that ends right before it. The file is read locally; only the next 14 days are kept.
- **What pulls you** (Insights → Sites): when you are usually drawn to a distracting site, how long it takes you, and a one-tap daily limit.

### Fixed
- The preview chips under the quick-add field had no styling; they now look like the task chips.

### Tested
- New unit tests for planning, weeks, calendar parsing and trigger analysis; end-to-end checks for the new dialogs and cards in the upgrade crawl.

## 2.6.0 — 2026-10-21

Reliability and support.

### New
- **Report a problem** (Settings → About): builds a short diagnostic text — versions, setting switches, counts and the last errors — that you can read, copy and attach to a GitHub issue, or open a prefilled issue. Nothing is sent automatically and it contains no sites, tasks or notes. A small local log keeps the last 20 errors (no page addresses).
- **Backup reminder** on Home for people with real history: after 30 days without a backup file EyeTime suggests saving one (snoozable for 14 days).
- **Project page and privacy policy** site (published from `site/` via GitHub Pages) and ready-to-paste store listing, permission justifications and a step-by-step publishing checklist (`store/`).

### Tested
- New end-to-end scenarios for what real browsing does: a second window, same-page navigation, the browser stopping the service worker, a session that ended while the browser was closed, a pass shared between tabs. Upgrade tests now start from v2.1.0, v2.2.0 and v2.5.3 settings. All run in CI.

## 2.5.3 — 2026-10-21

From real-world use.

### Fixed
- **A second pause page after "Continue"** on short links (e.g. `youtu.be` → `youtube.com`): the pass covered only the first site, the redirect target was a different rule domain. A "Continue" now also opens a 30-second window for the redirect chain that follows (never for always-blocked sites or strict sessions). Covered by an end-to-end test that fails without the fix.
- **Cut-off tooltips** on the icons in the top corner of Home and in the popup header: they now open downwards and stay inside the window.

### Changed
- **Ambient focus sounds are now real recordings.** The synthesised rain and café were replaced: *Rain*, *River* and *Forest* are seamless loops cut from CC0 field recordings (credits in `src/audio/CREDITS.txt`), *Brown noise* stays synthesised. The old *Café* choice becomes *Rain* automatically.

## 2.5.2 — 2026-10-20

Fixes from a second independent review.

- CI: the accessibility step could not run (a second `npm i --no-save` removed Playwright); both are now installed together.
- *Get started → Add a task* works when the cards are hidden (minimal layout) or the Tasks card is off (opens the palette); the checklist sits in the right place in the split layout and stops repainting on every tracker write.
- Storage thinning near the quota looks only at day records, never runs in Firefox (no 10 MB cap there) and can't throw on a thinned day.
- Journal: desktop-app time is included in totals like in Insights; day headings carry the year.
- Sounds start even if the audio context was created suspended (Firefox event page).

## 2.5.1 — 2026-10-20

### Fixed
- Completed *Get started* steps keep full text contrast (caught by the axe check, which now runs on every change).

## 2.5.0 — 2026-10-20

### New
- **Get started** checklist on Home for new profiles: a first 5-minute session, marking what distracts you, writing a task, trying the command palette. Steps tick themselves from real use; it disappears when done, when dismissed, or after three weeks.
- **Journal export** (Settings → Data & privacy): your last 90 days as a readable Markdown file — focus time, screen time, distraction share, sessions with goals and ratings, and your "went well" line. No site names. Handy for any notes app.
- A note turned into a task keeps its time, length and priority (`Call Anna 16:45 30m !`).

### Fixed
- Home *Notes*: a note added from another page (popup, pause page) is no longer overwritten by a stale list while the field is focused.

## 2.4.0 — 2026-10-20

Accessibility, resilience and Firefox.

### Accessibility
- Automated **axe-core audit** of every page and state (running session, review, break, block pages, palette, dialogs) in a light and a dark look, English and Russian — now 0 violations and enforced in CI.
- Fixed: the progress bar of the daily goal has a name; the custom-accent swatch no longer misuses `aria-pressed`; the search button's accessible name contains its visible text; real heading structure (`h1` on Settings and in the popup, card titles at level 2); the sidebar is a landmark; empty table header made readable.

### Resilience
- Very heavy browsing could approach the browser's 10 MB storage limit over 400 days. Past 8 MB the hourly breakdown of days older than 120 days is dropped first (totals, sessions and the calendar stay). Measured: a profile with 400 days × 40 sites × 12 hours uses 5 MB; Home opens in ~220 ms and Insights in ~300 ms with 300 tasks.

### Firefox
- Sounds (session start/end chime and ambient noise) now work in Firefox too: its background is an event page with Web Audio, so the same synthesis code runs there directly. The Firefox package passes `web-ext lint` with no errors (CI-checked).

## 2.3.2 — 2026-10-20

### Fixed
- **Narrow screens and large text**: Settings no longer scroll sideways with long site names (chips shorten with an ellipsis, input rows wrap), the Home reminder pill wraps, the *Privacy* buttons wrap, look previews stay inside their cards. A new CI check opens 17 pages at 400 px with 125 % text and very long names in English and Russian and fails on any horizontal scroll.
- *Close the day* dialog fades its scrolling list above the buttons; the shortcuts list has an aligned key column; the evening nudge no longer shows a stray ". ·".
- Refreshed store screenshots (with realistic hourly data) plus new ones: command palette, day timeline, *My week* card.

## 2.3.1 — 2026-10-20

Hardening release after an independent code review and a new upgrade/empty-profile regression crawl (now part of CI).

### Fixed
- **Clock format was inverted**: choosing *24-hour* showed 12-hour times and vice versa (Home clock, schedules, timeline, block pages). Now correct.
- **Settings sync**: a freshly installed browser adopts your cloud settings on first sync instead of overwriting them with its defaults; starting a focus session no longer counts as an edit (so a stale browser can't overwrite real changes); the companion token is never synced; pulled settings take effect immediately (alarms, menus, reminders); the cloud copy is written before old chunks are removed; newer-format data is never overwritten; emoji can't be split across chunks.
- **Quick-add** no longer reads decimals or versions (`12.50`, `chapter 10.15`) as a time; a dot counts only with am/pm or `@`/`at`/`в`.
- A task added from the command palette can no longer be lost by the Home task field; **Ctrl+K works on a Russian keyboard layout**.
- Estimate accuracy shows the latest tasks and keeps finished tasks after *Clear completed*.
- Task-time notifications start the session with the task's planned length; custom focus modes without a name show a neutral label; the toolbar badge updates after **+5 min**; a mode's ambient sound survives a browser restart.
- Empty Focus tab no longer logs a missing-icon error; "Remind me at your best hour" handles a full reminder list and midnight neighbours; timeline summary hidden on days without hourly data; settings search count clears; no listener pile-up on the Data page.

## 2.3.0 — 2026-10-20

A second exhaustive audit (every screen × state × width × language × look, with an automatic horizontal-overflow report) and a round of new features.

### New
- **Command palette** — `Ctrl/Cmd + K` on Home, Insights and Settings: start a focus mode, focus on a task, take an eye break, pause tracking, jump to any Insights tab or Settings section, switch look or theme, close the day. Type anything and press Enter to add it as a task.
- **Quick-add tasks** — write `Report 14:30 45m ! #work` and EyeTime takes out the time (schedules the start reminder), planned length, priority and tags, with a live preview while you type. Starting a focus session on a task uses its planned length.
- **Estimate accuracy** (Insights → Focus) — planned vs. actual focus time on finished tasks, with a plain verdict on the planning fallacy, plus a "took X, planned Y" toast when you tick a task off.
- **Day timeline** (Insights → Patterns) — one day hour by hour with your focus sessions on a lane underneath; step back through the last weeks.
- **My week card** — turn the weekly review into a shareable PNG (totals only: no site names or task titles). Download or copy.
- **Sync settings across browsers** (Settings → Data & privacy, off by default) — looks, focus modes and preferences via your browser's own sync. Tasks, notes and history never sync.
- **+5 min** on a running session; **Save / Skip** on the session review (rating is optional); **5 more minutes** on the eye-break page.

### Fixed and polished
- Insights: tables become stacked rows on phones, no horizontal scroll in any tab, scope captions on every Focus card, no future hours on today's chart, weekly review no longer says "balanced" while distractions are rising, calendar redesigned (weekday labels, quantile scale, untracked days).
- Popup: a pending review replaces the start form so everything fits 600 px; paused-tracking banner with a clear *Resume*; one capture field instead of two.
- Home: split-layout clock no longer wraps, notes grow instead of showing a resize handle, no duplicate "goal reached" message.
- Block pages: long hostnames, a helpful invalid-link page, goal and *remaining* labels, schedule end time in your clock format, *Allow {site}* wording.
- Onboarding: stable layout, an *Add* button for custom sites, editable work hours, localized goal labels.
- Narrow settings header and Insights header no longer overflow at large text scales.

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
