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

## The pages, in files

- **Home** (`src/newtab/newtab.js`, about 90 lines) only boots the page and decides what to do when the settings change. The parts are in `src/newtab/home/`: `state` (what they share: the settings in view, the running session; they read it, never each other's variables), `hero` (clock, date, greeting, quote), `background` (wallpaper, own photo with cut-out and depth, scene, weather effect, credit), `blocks` (modules, widgets, skins), `parts` (the focus line and corner tiles of Today, or the focus card; swapped in place when the arrangement changes), `nudges`, `drawer` (customize + the editor), `focus-watch`, `layout-watch`, `shortcuts`, `palette`.
- **The focus control** (`src/ui/focus-card/`, used by the popup, the dock and Home): `session` (state and actions), `idle` and `running` (views), `index` (mounts, re-renders on change, `destroy()`). `src/ui/focus-card.js` re-exports it.
- **Settings** (`src/options/`): one file per section; `simple.js` lists the settings hidden in the *Essentials* view (and keeps visible what the person already changed or uses); search and *All settings* show everything.
- **Measurement** (`src/shared/usage*.js`, `src/background/usage.js`, `server/usage/`): see `docs/MEASUREMENT.md`.

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

- **The dock** (`content/dock.js`, `dock/`, `background/dock.js`, `shared/topics.js`) — opt-in (`settings.dock`). The page script is registered dynamically (`scripting.registerContentScripts`) only after the optional website access is granted (`scripting` itself is a normal permission without an install warning), so installs and updates never show a permission warning. It draws a shadow-DOM "notch" and an extension iframe (`dock/dock.html`, a web-accessible resource); the iframe holds all UI and talks to storage itself, the page only gets its address and title through `postMessage` (origin-checked). The panel has three looks (`dock/designs.css`, selected by `html[data-design]` from `settings.dock.design`, default 2; `shared/dock.js` validates it). Topics live in the `topics` collection. Tested by `e2e/dock.cjs` (the test build declares `http://127.0.0.1/*` up front) and `tests/topics.test.mjs`.

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

## Connected services (`src/shared/sync/`, `shared/connections.js`, `background/connections.js`, `options/connections-group.js`)
Two-way sync of tasks and calendar with Todoist, Notion, CalDAV, Google and Microsoft: a pure three-way merge (`pairs.js`), one run start to finish (`run.js`), one adapter per service (`providers/`), a scheduler in the worker (every 15 minutes and after a change) and the Settings screen. Credentials live in `connSecrets` and never leave the device. The full description, the OAuth registration steps and the pre-release checklist are in `docs/CONNECTIONS.md`.

## Classification (`classify.js`)

Candidates: built-in productive list, enabled presets, custom/always lists, user overrides. The **most specific** (longest) domain wins; on a tie, user > custom > built-in. The allow-list demotes "distracting" to "neutral" unless the user explicitly marked the site.

## i18n (`src/shared/i18n.js`, `locales/`)

Flat key → string maps; plural forms via `Intl.PluralRules`; `{param}` interpolation. **A page loads one language**: English is code (`locales/en.js`, the fallback for a missing key), every other language is read as data (`locales/data/<lang>.json`, written from the `.js` files by `npm run locales`, checked by `npm run check`) with `await setLocale(...)`. The service worker cannot `import()`, so data is what works there too. `scripts-dev/tests/weight.test.mjs` fails if a page starts to load translations as code. English is the reference; eleven languages ship (en, ru, es, de, fr, pt, it, pl, uk, zh, ja — see [TRANSLATING.md](TRANSLATING.md)). The store texts live in `_locales/<lang>/messages.json`. `scripts-dev/check.mjs` fails the build when a used key is missing, a language lacks a key, or placeholders differ.

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
| Store screenshots (English and per language) and the demo video | `screenshots.cjs` (the English set), `store-shots.cjs` (the five store screenshots in every language), `demo-shots.cjs` + `demo-video.cjs` + `demo-video.html` (the real interface at twice the size, composed with motion into `store/demo.mp4` (36 s, the walk through the product) and, with `--film promo` and `promo-video.html`, `store/promo.mp4` (24 s: a hook, three ideas, install; its music and effects are made from nothing by `promo-sound.cjs`, so there is nothing to license); every frame is drawn from the time, so the result does not depend on the machine) |
| Calendar subscription against a local server | `calendar.cjs` |
| Visual regression (en/ru/de × light/dark, frozen clock): `--update` rewrites the baseline after an intended change | `visual.cjs`, `visual-baseline/` |
| Load: a year of dense data, 60 open tabs, with budgets | `perf.cjs` |
| All the end-to-end suites at once, in parallel or in CI shards (`suites.json`, `run.mjs`: `npm run e2e`) | `scripts-dev/e2e/run.mjs` |
| Two-way sync: the merge, tasks, planned blocks, each adapter against a mock, OAuth (PKCE), iCal/XML | `sync-*.test.mjs`, `connections-*.test.mjs`, `ical-xml.test.mjs` |
| Connected services in Settings (Todoist mock: connect, first sync, edits, refused token, backup without secrets, disconnect) | `connections.cjs` |
| Essentials / All settings, "Make it calm again"; anonymous usage (counting, preview, consent, report, forget) | `essentials.cjs`, `usage.cjs` |
| The collector for the usage report, against an in-memory SQLite | `scripts-dev/tests/usage-server.test.mjs` |
| Types from JSDoc (all of `src/` but the third-party engine; five strict flags on) | `npm run types` |
| What every page and the worker load at start, counted from the code (no browser): budgets per page, no translations as code | `weight.test.mjs` |
| Damaged input to every parser of what people paste or import (`.ics`, XML, tasks, themes, dates in words), seeded | `fuzz.test.mjs`; Rust: property tests in `core/src/hosts.rs` and `ipc.rs` |
| Seconds credited by the tracker add up to the time that passed (fractions carried) | `credit.test.mjs` |
| Coverage of `src/` with a floor; every module of `src/shared` counted | `npm run coverage`, `load-all.test.mjs` |
| The desktop window with hostile names, under the window's own policy; the pipe limits | `desktop/tests/xss_real.cjs`, `helper/src/limits.rs` tests |

## Why these permissions

See **Settings → Data & privacy** in the app (or `perm.*` in `locales/en.js`).

- **Instant blocking** (`shared/dnr.js`, `background/instant.js`, `options/instant-row.js`) — opt-in (`settings.blocking.instant`, needs the optional access to websites). `buildRules` turns the same `decide()` the blocker uses into declarativeNetRequest redirect rules (one per listed domain, an allow rule for a more specific allowed site, a session rule for the 30 s window of one tab); the blocked page receives the address raw after `&u=` (`d=1`). Soundness (a rule never redirects what `decide` allows) is the invariant; the tab blocker stays as the net and waits 350 ms for the rule before stepping in. The page that is about to release a tab syncs the rules first, and cuts a loop after three releases in five seconds.
