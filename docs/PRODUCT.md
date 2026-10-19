# EyeTime 2.0 — product brief

> Focus, screen time and eye care for your browser. Free, open source, private by design.

This document is the source of truth for *what* EyeTime is and *why*. Design tokens and
component rules live in [DESIGN.md](DESIGN.md); engineering notes in [ARCHITECTURE.md](ARCHITECTURE.md).

## 1. Audit of v1.1 (why a redesign)

| Area | What we found | Consequence |
|---|---|---|
| Positioning | "Productivity OS" that is simultaneously a site blocker, habit tracker, TickTick client, new-tab builder with 29 widgets, doomscroll game, YouTube cleaner and a Windows daemon. | No hero use case. A new user cannot tell what to do first. |
| Naming | *Cockpit*, *Leak guard*, *Interceptor*, *Nuclear mode*, *Thought parking*, *Sentinel*. | Jargon the user has to decode; sounds hostile. |
| First run | Requires Developer mode + "Load unpacked" and a `.bat` file. | Practically unreachable for non-developers. |
| Honesty of data | Empty days show "100% focus", "100% control", "Eye rest balance 100%". | Fake-positive numbers destroy trust; empty states teach nothing. |
| Visual | Dark-only orange "neo glass": glows, gradients, emoji as icons, 11 px muted text, inconsistent radii. | Looks like a demo, not a product; poor contrast and no light theme. |
| Settings | 12 sections mixing concepts (Interceptor, Nuclear, Productivity, Exclusions…). | Hard to find anything; settings drive features instead of defaults being good. |
| Hostile UX | "Nuclear mode: disabling is IMPOSSIBLE", full-screen lockouts, math/typing challenges. | Users feel punished → uninstall. |
| Safety / privacy | Desktop agent **closes other browsers and incognito windows by default**, and its localhost server answers `Access-Control-Allow-Origin: *` with active window titles and accepts unauthenticated writes. | Data-loss risk and a real privacy hole in a product that promises "100% local". |
| Engineering | Russian strings are the i18n *keys* and are swapped by a runtime text-node translator; `setInterval` loops (1 s / 2 s) in an MV3 service worker; read-modify-write of the whole `stats` object every second; content script on every page at `document_start`. | Fragile, slow, battery-hungry, over-permissioned. |

## 2. Who it is for

1. **Knowledge workers & students** who lose hours to feeds, Shorts/Reels and "just one video".
2. **People with ADHD-like attention patterns** who need low-friction structure, not guilt.
3. **Heavy screen users** who want eye-strain reminders (20-20-20) without installing a second app.

Primary languages: English and Russian (existing audience); structure supports adding more.

## 3. Product principles

1. **One click to focus.** The first screen is always "start a focus session".
2. **Honest data.** No fake 100 %s. Empty means empty — and says what will appear and when.
3. **Friction, not force.** Gentle speed bumps (breathing pause, short wait) by default; *Strict* is an explicit, per-session choice.
4. **Calm interface.** Quiet neutral UI, one accent colour, real light & dark themes, comfortable type sizes.
5. **Private and verifiable.** No accounts, no analytics, no remote code, minimal permissions, no unauthenticated local servers.
6. **Great defaults, optional depth.** Works after a 30-second setup; power users can tune everything.

## 3b. Jobs to be done

| When I… | I want to… | So that… | Surface |
|---|---|---|---|
| sit down to work | start a timed session with one click and say what I'm doing | the internet stops pulling me away | Popup / New tab |
| catch myself opening YouTube | be stopped gently and reminded of my goal | I can choose consciously | Block page |
| wonder where my day went | see an honest summary by site and hour | I can change habits | Insights |
| stare at a screen for hours | be reminded to rest my eyes | I don't get a headache | Notifications / Eye-break page |
| want fewer distractions at set hours | schedule work hours | I don't rely on willpower | Settings → Blocking |

## 4. Scope of 2.0

### Core (must be excellent)
- **Focus sessions** — presets (15 / 25 / 50 / 90 min) + custom, optional goal text, optional break reminder, optional *Strict* mode, optional "open this link when I start" (music), soft chime.
- **Blocking** — category presets, custom sites, allow-list, work-hours schedule, per-site daily limits, breathing/wait friction, feed control for YouTube Shorts / Reels / TikTok.
- **Insights** — today / 7 / 30 days: total time, focus time, distraction share, breaks; per-site list with one-tap classification (productive / neutral / distracting); hourly chart; calendar heatmap; plain-language insights ("Your most distracting day was Monday").
- **Eye care** — 20-20-20 reminders, a full-page guided 20-second break, break counter, bedtime nudge.
- **Popup** — current-site card (time today, classify, block), focus control, today's summary, capture-a-thought.
- **Onboarding** — four steps, ends with the first session.

### Supporting (small, optional, local)
- **New tab "Home"** — clock, focus card, today summary, tasks, habits, quick links, notes. Fixed, beautiful layout with per-module on/off; 8 gradient backdrops + custom photo.
- **Data** — JSON export/import, CSV export, full reset.

### Out of scope / removed (with reasons)
| Removed | Why |
|---|---|
| New-tab widget builder (drag, resize, 29 widgets, profiles) | Maintenance-heavy, off-mission, unusable on small screens. Replaced by a few well-made modules. |
| TickTick integration | Needs user-supplied secrets, rarely used, adds permissions. Local tasks remain. |
| Endel-specific integration | Replaced by a generic "open a link on start". |
| Math / typing "doomscroll challenges" | Punitive; replaced by a breathing pause. |
| "Nuclear mode" | Replaced by *Strict focus session* (same power, honest name, bounded). |
| Windows daemon that closes browsers / incognito / touches policies | Unsafe by default. Companion rewritten as an optional, read-only, token-authenticated tracker (see ARCHITECTURE). |
| Desktop web app served by the daemon | Insights page covers it. |

### Migration
All v1 data (`settings`, `stats`, `dailyGoals`, habits, parked thoughts, custom domains) is migrated automatically on first run of 2.0; nothing is deleted.

## 5. Information architecture

```
Toolbar popup ─ Focus · Current site · Today · Capture
New tab ─ Home (optional)
Insights ─ Overview · Sites · Time of day · Calendar
Settings ─ General · Focus · Blocking · Eye care · Tracking · Data · About
Onboarding ─ Welcome · Distractions · Rhythm · Ready
Block page ─ (shown inside the tab that was blocked)
Eye-break page ─ (opened from notification / popup)
```

## 6. Success metrics (local, for maintainers' own judgement — nothing is collected)

- Time-to-first-focus-session after install ≤ 60 s.
- ≤ 2 clicks from any surface to start a session.
- Lighthouse a11y ≥ 95 on all extension pages; WCAG AA contrast for all text.
- Service worker idle: zero timers, only alarms/events.

## 7. Roadmap after 2.0

1. Chrome Web Store / Edge Add-ons / Firefox AMO listings (store assets are prepared in `store/`).
2. Additional languages (ES, DE, PT, UK, ZH…): drop-in files under `src/shared/locales/`.
3. Weekly summary card (in-app, not just a notification).
4. Companion apps for macOS and Linux.
