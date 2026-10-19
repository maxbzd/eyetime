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
| `d:YYYY-MM-DD` | one record per local day: `d` host→sec, `h` hour→host→sec, `a` app→sec, `fs` focus sec, `fc` focus sessions, `b` breaks, `ss` session log `[{id,t,m,p,g,k,c,r}]`, `pr` pause-page reasons |
| `focus` | the running session `{ id, startedAt, endsAt, minutes, goal, strict }` or `null` |
| `rest` | the break timer that follows a completed session `{ startedAt, endsAt, minutes, long }` or `null` (focus rules do not apply while it runs) |
| `review` | the "how did it go?" card waiting for an answer `{ id, day, goal, taskId, minutes, completed }` or `null` |
| `passes` | `{ ruleDomain: untilTs }` temporary "continue" permissions |
| `tasks` (`{ id, text, done, starred, focusSec, … }`), `habits`, `captures`, `newtabBg`, `pausedUntil`, `lastWeekly` | small user data |

The look is additionally cached in `localStorage['et-look']` so `theme-init.js` can paint before first render (see [THEMES.md](THEMES.md)). `chrome.storage.session` holds volatile state: the tracker's current interval (`trk`) and eye-break counters (`eye`).

Per-day keys keep every write small and independent; reads fetch only the range a page needs. History older than 400 days is pruned daily.

## Tracking (`src/background/tracker.js`)

Event-driven. Every `sync()` closes the previous interval (crediting seconds to the host that was active) and opens the next one. Triggers: tab activated/updated/removed, window focus, idle state change, and a 30 s alarm. A gap > 120 s (sleep) is not credited. Counting requires: tracking on, not paused, browser window focused, host not excluded, not incognito (unless enabled), user not idle — *or* the tab is audible. Calls are serialised through a promise chain so overlapping events never double-count.

## Blocking (`src/shared/blocking.js` + `src/background/blocker.js`)

`decide(host, ctx)` is a **pure function**: allow-list → always-blocked → focus session → schedule → daily limit → friction pause. `policy.evaluate(url)` loads the context from storage; the worker calls it on `webNavigation.onBeforeNavigate` and redirects the tab to the block page. The block page re-evaluates continuously, so it releases the original URL the moment the reason disappears. Strict sessions ignore passes and the worker refuses `focus:stop`.

No content script runs on arbitrary pages and there is no all-sites host permission. The only content script (`feed.js`) matches YouTube, Instagram, TikTok and VK.

## Productivity loop (`src/shared/productivity.js`)

Pure, unit-tested logic for plan → focus → review: long breaks (`restFor`), daily goal and goal streak, session log, best focus hours (`bestHours`, weighted by the user's rating), day review, one gentle Home nudge (`nudge`), scheduled reminders (`nextReminder`). The worker writes sessions in `finishFocus`/`stopFocus`, credits focus time to the linked task and queues `review`; `reminders.js` keeps a single alarm for the next slot. A session carries its `scope` (`distractions` | `only-mine`) and `decide()` closes everything that is not productive or allow-listed in the latter.

## Classification (`classify.js`)

Candidates: built-in productive list, enabled presets, custom/always lists, user overrides. The **most specific** (longest) domain wins; on a tie, user > custom > built-in. The allow-list demotes "distracting" to "neutral" unless the user explicitly marked the site.

## i18n (`src/shared/i18n.js`, `locales/`)

Flat key → string maps; plural forms via `Intl.PluralRules`; `{param}` interpolation. English is the reference. `scripts-dev/check.mjs` fails the build when a used key is missing, a language lacks a key, or placeholders differ.

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

## Why these permissions

See **Settings → Data & privacy** in the app (or `perm.*` in `locales/en.js`).
