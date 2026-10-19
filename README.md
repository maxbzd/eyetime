<div align="center">

<img src="icons/icon128.png" width="84" alt="EyeTime logo">

# EyeTime

**Focus, screen time and eye care for your browser.**<br>
Free, open source and 100% local — no account, no servers, no tracking.

[![License: MIT](https://img.shields.io/badge/license-MIT-orange.svg)](LICENSE)
[![CI](https://github.com/maxbzd/eyetime/actions/workflows/ci.yml/badge.svg)](https://github.com/maxbzd/eyetime/actions/workflows/ci.yml)
[![Privacy: local-first](https://img.shields.io/badge/privacy-local--first-2d6cdf.svg)](PRIVACY.md)
[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4.svg)]()

[English](README.md) · [Русский](README_RU.md)

<img src="store/screenshots/1-home.png" alt="EyeTime home page with focus card, today's stats, tasks and notes" width="860">

</div>

---

## Why EyeTime

Most blockers feel like punishment and most trackers feel like surveillance. EyeTime is built around three ideas:

1. **One click to focus.** Start a timed session from the toolbar, the new tab or a shortcut. Distracting sites pause until it ends.
2. **Honest, calm data.** See where your time really goes — per site, per hour, per day — with plain-language highlights. Empty means empty; nothing is invented.
3. **Friction, not force.** A breathing pause before a distracting site beats a lockout. Strict mode exists, but you choose it per session.

And because the name says it: it looks after your **eyes** too — 20-20-20 reminders counted in real screen time.

## Features

| | |
|---|---|
| 🎯 **Focus sessions** | 15 / 25 / 50 / 90 min or custom, optional goal text, soft start/end sound, optional *Strict* mode, "open my music" link. Distracting tabs are paused instantly and released automatically when the session ends. |
| 🛡 **Blocking that respects you** | Category presets (social, video, forums, news, games, shopping, messengers), your own sites, an allow-list, work-hours schedule, per-site daily limits, always-blocked list and a short breathing pause with a timed "continue". |
| 📊 **Insights** | Today / 7 / 30 days: screen time, focus time, distraction share, breaks. Stacked charts by day and hour, a calendar heatmap, a site table where one tap re-classifies a site (productive / neutral / distracting), highlights like "your most distracting day was Sunday", a **weekly review with a one-click limit suggestion**, CSV export, table view for accessibility. |
| ⏱ **Break timer** | After a session a rest countdown starts on its own (Pomodoro-style, configurable). Distracting sites stay open during the break. |
| 👁 **Eye care** | 20-20-20 reminders based on *active* screen time, a guided 20-second break page, break counter, bedtime nudge. |
| 🏠 **Home (new tab)** | Clock (7 styles), focus card with daily goal, today's summary, tasks with priorities, habits with streaks, notes, quick links; 17 backdrops or your own photo, 3 layouts, reorderable cards. Can be switched off. |
| 🎨 **Make it yours** | Eleven looks (Calm, Paper, Midnight, Terminal, Sakura, Forest, Aurora, Mono, Sunset, Nord, Ocean), any accent colour, fonts, corners, density, card style, light/dark/schedule, custom CSS and shareable looks. Contrast stays accessible. [Details](docs/THEMES.md). |
| 🚀 **Productivity loop** | Plan (≤ 3 priorities) → focus on a task → rate the session → see your goal streak and **best focus hours**. "Only my sites" sessions, long breaks, focus reminders, intent-based pause page. |
| 📱 **Short-video guard** | After a limit of Shorts / Reels / TikTok / VK Clips scrolling the page turns grayscale and pauses. Optional hiding of Shorts, recommendations, comments and the YouTube home feed. |
| 🌍 **English & Russian** | Key-based i18n; adding a language is one file. |
| 🔒 **Private by design** | Only domain names and seconds are stored, on your device. [Details](PRIVACY.md). |

<details>
<summary><b>More screenshots</b></summary>

<img src="store/screenshots/2-focus.png" width="860" alt="Popup with a running focus session and the paused-site page">
<img src="store/screenshots/3-insights.png" width="860" alt="Insights page">
<img src="store/screenshots/7-looks.png" width="860" alt="Eleven looks, each in light and dark">
<img src="store/screenshots/8-variant-1-terminal.png" width="420" alt="Terminal"><img src="store/screenshots/8-variant-2-sakura.png" width="420" alt="Sakura">
<img src="store/screenshots/8-variant-3-paper.png" width="420" alt="Paper"><img src="store/screenshots/8-variant-4-aurora.png" width="420" alt="Aurora">
<img src="store/screenshots/5-settings.png" width="860" alt="Settings page">
<img src="store/screenshots/4-home-dark.png" width="860" alt="Home page in dark mode">
<img src="store/screenshots/6-onboarding.png" width="860" alt="Onboarding">

</details>

## Install

> EyeTime is not in the Chrome Web Store yet. Until it is, install it in a minute from a release or from source.

**Chrome, Edge, Brave, Arc (Chromium 120+)**

1. Download `eyetime-chrome.zip` from the [latest release](https://github.com/maxbzd/eyetime/releases) and unzip it — *or* `git clone https://github.com/maxbzd/eyetime.git` (no build step needed).
2. Open `chrome://extensions`, switch on **Developer mode**, click **Load unpacked** and select the folder that contains `manifest.json`.
3. The setup wizard opens. Pin EyeTime from the puzzle-piece menu so it is one click away.

**Firefox (121+)** — experimental: run `npm run build`, then `about:debugging` → *This Firefox* → *Load Temporary Add-on* → `dist/firefox/manifest.json`. (Sound and site icons are Chrome-only for now.)

> Updating from EyeTime 1.x? Your settings, tasks, habits, notes and history migrate automatically. See [what changed](docs/PRODUCT.md#1-audit-of-v11-why-a-redesign).

## Using it

- **Start focus:** toolbar icon → type what you're working on → *Start focus*. Or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd>.
- **Right-click any page → EyeTime** to mark or block the site, or start/stop focus.
- **Teach it what distracts you:** open the popup on any site and tap *Productive / Neutral / Distracting*. The same works per row in Insights.
- **Set limits:** Settings → Blocking → *Daily limits* (works for any site).
- **Rest your eyes:** a reminder appears after 20 minutes of active screen time; the break page walks you through 20 seconds.

## Privacy in one table

| Stored on your device | Never stored or sent |
|---|---|
| Domain names and seconds per hour | Page URLs, titles, content, keystrokes |
| Your settings, tasks, notes, habits | Anything about you — there is no account |
| (optional) per-app seconds from the desktop companion | Analytics, crash reports, ads — none |

Permissions are minimal and each one is explained in **Settings → Data & privacy**. The only network request EyeTime ever makes is to `127.0.0.1` if *you* enable the desktop companion. See [PRIVACY.md](PRIVACY.md).

## Desktop companion (optional)

A tiny read-only Windows helper that adds time spent in desktop apps. It only notes the front app's executable name, is protected by a pairing token and can never touch your browser. → [companion/README.md](companion/README.md)

## Project layout

```
manifest.json          MV3 manifest (Chrome/Edge; Firefox variant built by npm run build)
src/shared/            pure logic: time, domains, classify, blocking, stats, migrate, i18n, storage
src/background/        service worker: tracker, focus, blocker, eye breaks, weekly report
src/popup|newtab|insights|options|onboarding|blocked|break/   the seven surfaces
src/content/feed.js    short-video guard (only YouTube / Instagram / TikTok / VK)
src/ui/                design tokens, components, charts, icons (Lucide), Inter font
companion/             optional Windows desktop companion (Python, stdlib only)
docs/                  PRODUCT.md · DESIGN.md · THEMES.md · ARCHITECTURE.md
scripts-dev/           checker, tests, icon + package builders
```

No framework, no bundler, no runtime dependencies — open the folder, read the code.

## Development

```bash
npm run check     # syntax, manifest, i18n parity, icons + 15 unit tests (Node 20+)
npm run build     # dist/eyetime-chrome.zip and dist/eyetime-firefox.zip
python -m unittest -v test_companion   # in companion/
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the architecture tour, adding a language and the browser-level test.

## Roadmap

- [x] Redesign, light/dark themes, key-based i18n, safer desktop companion (2.0)
- [ ] Chrome Web Store, Edge Add-ons and Firefox AMO listings
- [ ] More languages (ES, DE, PT, UK, ZH …) — [one file each](CONTRIBUTING.md#adding-a-language)
- [ ] macOS / Linux companion backends — [guide](companion/README.md#contributing-a-backend)
- [ ] In-app weekly review

## License

[MIT](LICENSE). Fonts: Inter (SIL OFL 1.1). Icons: Lucide (ISC). Both are bundled locally — EyeTime loads nothing from the internet.
