# Architecture

Plain ES modules, no bundler, no runtime dependencies. Open any file and read it.

```
                ┌─────────────────── extension pages (popup, newtab, insights, options, onboarding, blocked, break)
 user ─────────▶│  src/ui/*  (dom, components, charts, theme)   src/shared/*  (pure logic)
                └───────┬─────────────────────────────▲────────────────────┘
                        │ chrome.runtime.sendMessage   │ chrome.storage.onChanged
                        ▼                              │
                ┌─────────────── service worker (src/background) ───────────────┐
 browser events▶│ tracker · focus · blocker · breaks · menus · weekly · companion       │
 alarms ───────▶│ (no timers: events + chrome.alarms only)                      │
                └───────────────────────────────┬───────────────────────────────┘
                                                ▼
                                      chrome.storage.local
```

## Storage layout

| Key | Content |
|---|---|
| `settings` | user preferences, deep-merged with `DEFAULT_SETTINGS` on every read |
| `meta` | `{ schemaVersion, installedAt, migratedFrom }` |
| `d:YYYY-MM-DD` | one record per local day: `d` host→sec, `h` hour→host→sec, `a` app→sec, `fs` focus sec, `fc` focus sessions, `b` breaks, `ss` session log `[{id,t,m,p,g,k,c,r}]`, `pr` pause-page reasons, `sw` site switches, `pa` host→times the pause/block page stepped in, `fa` same during focus sessions, `w` the evening "win" |
| `focus` | the running session `{ id, startedAt, endsAt, minutes, goal, strict }` or `null` |
| `rest` | the break timer that follows a completed session `{ startedAt, endsAt, minutes, long }` or `null` (focus rules do not apply while it runs) |
| `review` | the "how did it go?" card waiting for an answer `{ id, day, goal, taskId, minutes, completed }` or `null` |
| `passes` | `{ ruleDomain: untilTs }` temporary "continue" permissions |
| `tasks` (`{ id, text, done, starred, focusSec, resume, at/atDay, planFor, … }`), `habits`, `captures`, `newtabBg`, `pausedUntil`, `lastWeekly` | small user data |

The look is additionally cached in `localStorage['et-look']` so `theme-init.js` can paint before first render (see [THEMES.md](THEMES.md)). `chrome.storage.session` holds volatile state: the tracker's current interval (`trk`) and eye-break counters (`eye`).

Per-day keys keep every write small and independent; reads fetch only the range a page needs. History older than 400 days is pruned daily.

## Tracking (`src/background/tracker.js`)

Event-driven. Every `sync()` closes the previous interval (crediting seconds to the host that was active) and opens the next one. Triggers: tab activated/updated/removed, window focus, idle state change, and a 30 s alarm. A gap > 120 s (sleep) is not credited. Counting requires: tracking on, not paused, browser window focused, host not excluded, not incognito (unless enabled), user not idle — *or* the tab is audible. Calls are serialised through a promise chain so overlapping events never double-count.

- **Task sync** (`shared/tasksync.js`, `background/tasksync.js`) — opt-in (`syncTasks`), keys `st:meta`/`st:0..9` in `chrome.storage.sync`. A three-way merge against `tasksBase` (what this device last synced) tells "deleted there" from "new there"; a missing or corrupt cloud copy never deletes anything; the list order is not synced (devices would rewrite each other's); finished tasks travel for three days. Covered by `scripts-dev/tests/tasksync.test.mjs` and `e2e/tasksync.cjs`.

## Blocking (`src/shared/blocking.js` + `src/background/blocker.js`)

`decide(host, ctx)` is a **pure function**: allow-list → always-blocked → focus session → schedule → daily limit → friction pause. `policy.evaluate(url)` loads the context from storage; the worker calls it on `webNavigation.onBeforeNavigate` and redirects the tab to the block page. The block page re-evaluates continuously, so it releases the original URL the moment the reason disappears. Strict sessions ignore passes and the worker refuses `focus:stop`.

No content script runs on arbitrary pages and there is no all-sites host permission. The only content script (`feed.js`) matches YouTube, Instagram, TikTok and VK.

## Productivity loop (`src/shared/productivity.js`)

Pure, unit-tested logic for plan → focus → review: long breaks (`restFor`), daily goal and goal streak, session log, best focus hours (`bestHours`, weighted by the user's rating), day review, one gentle Home nudge (`nudge`), scheduled reminders (`nextReminder`). The worker writes sessions in `finishFocus`/`stopFocus`, credits focus time to the linked task and queues `review`; `reminders.js` keeps a single alarm for the next slot. A session carries its `scope` (`distractions` | `only-mine`) and `decide()` closes everything that is not productive or allow-listed in the latter.

## Planning (`tasks.js`, `week.js`, `dayplan.js`, `ics.js`, `triggers.js`)

All pure and unit-tested; the UI only renders their output.
- **Recurring tasks** — `taskFromInput` stores `task.repeat` (`daily | weekdays | weekly`); `applyRepeats` reopens a finished recurring task on its next day. It runs when Home opens, when the worker boots and on the daily `prune` alarm (`background/rollover.js`), and is idempotent, so the three can race safely.
- **Weekly outcomes** (`week.js`) — up to three results per ISO week in the `weekPlan` collection; the weekly review and the share card count how many were reached.
- **Plan my day** (`dayplan.js`) — fits the starred tasks into the time left today using the user's own estimate history (`estLog`), never past the end of the work day.
- **Calendar** (`ics.js`) — the user imports an .ics file; only events of the next 14 days are kept in `calendar`/`calendarMeta` (local storage, never uploaded). The focus card shows the next meeting and offers a session that ends before it.
- **Triggers** (`triggers.js`) — from the hourly data: when a distracting site pulls the user in and for how long, with a one-tap daily limit.

### Month 2 additions
- **Dates in words** (`datewords.js`) — pure `findDateWord(text, now)`; quick add turns it into `task.due` (date only) or `atDay` (with a time). Only unambiguous words count (no 3-letter weekday abbreviations).
- **Calendar subscription** (`calsub.js`, `background/calendar.js`) — the address lives in the local `calendarSub` key only (excluded from `exportAll`, never in settings, so never in sync); an hourly `calendar-sync` alarm downloads it with `credentials: 'omit'` under an *optional* host permission requested for that one origin.
- **Projects** (`projects.js`) — a session entry carries `tg` (first `#tag` of its task); Insights groups by it.
- **Task import/export** (`taskio.js`) — Markdown round-trips through quick add; CSV has a fixed header.
- **What's new** (`whatsnew.js`) — the worker sets `whatsNew` on a minor update; Home shows and clears it.

## Classification (`classify.js`)

Candidates: built-in productive list, enabled presets, custom/always lists, user overrides. The **most specific** (longest) domain wins; on a tie, user > custom > built-in. The allow-list demotes "distracting" to "neutral" unless the user explicitly marked the site.

## i18n (`src/shared/i18n.js`, `locales/`)

Flat key → string maps; plural forms via `Intl.PluralRules`; `{param}` interpolation. English is the reference; eleven languages ship (en, ru, es, de, fr, pt, it, pl, uk, zh, ja — see [TRANSLATING.md](TRANSLATING.md)). The store texts live in `_locales/<lang>/messages.json`. `scripts-dev/check.mjs` fails the build when a used key is missing, a language lacks a key, or placeholders differ.

## Migration (`migrate.js`)

Pure function from a raw 1.x storage snapshot to the 2.0 layout (settings mapping, habits, thoughts → notes, stats → per-day records). Runs once in `ensureSchema()`; unit-tested with a realistic profile.

## Optional desktop companion

`companion/` is a separate, read-only Python process. The worker pulls `GET http://127.0.0.1:8765/v1/today` with a bearer token once per tick (only when enabled and permitted via an *optional* host permission). It cannot call into the browser.

## Testing

| Layer | Tool |
|---|---|
| Pure logic, migration, i18n, WCAG contrast | `node --test` (`scripts-dev/tests/`) |
| Static checks: syntax, manifest refs, HTML refs, i18n parity, icons | `scripts-dev/check.mjs` |
| Whole extension in real Chromium (install → onboarding → tracking → blocking → focus → migration → feed guard → no console errors) | `scripts-dev/e2e/` (Playwright, not a dependency) |
| Companion | `python -m unittest` |
| Narrow windows, 125 % zoom and long names in every language; upgrade from old versions; accessibility (axe) | `upgrade.cjs`, `a11y.cjs` |
| Real-world blocking scenarios (second window, SPA navigation, restarted service worker, shared pass) | `blocking.cjs` |
| Store screenshots (English and per language) and the demo video | `screenshots.cjs`, `screenshots-lang.cjs`, `demo.cjs` |
| Calendar subscription against a local server | `calendar.cjs` |
| Visual regression (en/ru/de × light/dark, frozen clock): `--update` rewrites the baseline after an intended change | `visual.cjs`, `visual-baseline/` |
| Load: a year of dense data, 60 open tabs, with budgets | `perf.cjs` |
| Types from JSDoc (`src/shared`, `src/background`) | `npm run types` |

## Why these permissions

See **Settings → Data & privacy** in the app (or `perm.*` in `locales/en.js`).
