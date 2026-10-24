# Store listing copy (Chrome Web Store · Edge Add-ons · Firefox AMO)

Everything below is ready to paste. Screenshots: `store/screenshots/` (1280×800). Privacy policy URL: `https://maxbzd.github.io/eyetime/privacy.html` (published by `.github/workflows/pages.yml`; the same text lives in `PRIVACY.md`).

## Name, summary, description, screenshot captions, keywords
One file per language, same structure — paste the sections into the store form of that language:

| Language | File | Screenshots |
|---|---|---|
| English (source) | `store/listing/en.md` | `store/screenshots/*.png` |
| Русский | `store/listing/ru.md` | `store/screenshots/ru/*.jpg` |
| Español | `store/listing/es.md` | `store/screenshots/es/*.jpg` |
| Deutsch | `store/listing/de.md` | `store/screenshots/de/*.jpg` |
| Français | `store/listing/fr.md` | `store/screenshots/fr/*.jpg` |
| Português | `store/listing/pt.md` | `store/screenshots/pt/*.jpg` |
| Italiano | `store/listing/it.md` | `store/screenshots/it/*.jpg` |
| Polski | `store/listing/pl.md` | `store/screenshots/pl/*.jpg` |
| Українська | `store/listing/uk.md` | `store/screenshots/uk/*.jpg` |
| 简体中文 | `store/listing/zh.md` | `store/screenshots/zh/*.jpg` |
| 日本語 | `store/listing/ja.md` | `store/screenshots/ja/*.jpg` |

The summary of every language is ≤ 132 characters (a Chrome Web Store limit). All non-English texts are machine-translated and reviewed; native-speaker corrections are welcome (the `translation` issues on GitHub). Regenerate the localized screenshots with `node scripts-dev/e2e/screenshots-lang.cjs`.

## Single purpose (Chrome Web Store field)
Help users focus and manage screen time: track time per site, pause distracting sites during focus sessions, and remind users to rest their eyes.

## Permission justifications (Chrome Web Store → Privacy practices)
| Permission | Justification to paste |
|---|---|
| `storage` | Saves the user's settings, tasks and per-day statistics on their device. |
| `tabs` | Reads the address of the active tab so time can be attributed to a site and the pause page can be shown for the right site. Addresses are reduced to the domain immediately. |
| `webNavigation` | Detects a navigation to a distracting site early enough to show the pause page before the site loads. |
| `idle` | Stops counting time when the user is away from the computer. |
| `alarms` | Wakes the extension for the focus timer, break timer and reminders without a background loop. |
| `notifications` | Eye-break, session-complete and "time to focus" reminders the user asked for. |
| `contextMenus` | Right-click menu to classify or block the current site. |
| `offscreen` | Plays the soft session start/end sound and the optional ambient sound (service workers cannot play audio). |
| `favicon` | Shows site icons from the browser's own cache; nothing is downloaded. |
| Host access: youtube.com, instagram.com, tiktok.com, vk.com, vkvideo.ru | Only to limit short-video scrolling and to hide YouTube recommendations, comments and the home feed when the user turns those options on. No data is read or sent. |
| Optional: `127.0.0.1:8765` | Only when the user enables the desktop companion app on their own computer. |
| `scripting` + optional host access: `http://*/*`, `https://*/*` (the dock; declared as *optional*, never granted at install) | Only if the user turns on the dock (Settings → General → Dock): the browser asks for access to websites, then EyeTime registers a small page script that draws one tab on the edge of pages and an extension iframe with the user's own panel (focus timer, tasks, a learning list). The script reads nothing from the page except its address and title, handed to the panel only when the user presses Save. All data stays on the device; nothing is sent anywhere. The access is withdrawn when the user turns the dock off. |
| Optional host access: `https://*/*` (declared as *optional*, never granted at install) | Used only if the user subscribes to their own calendar link (Settings → Data & privacy): the browser then asks for access to the one site that hosts the calendar, the extension downloads that one .ics file once an hour and keeps the next 14 days of events on the device. The permission is withdrawn when the user unsubscribes (or resets / restores data). Redirects are not followed. Nothing is sent anywhere. |
| `chrome.storage.sync` (covered by `storage`) | Optional, off by default: syncs settings, and (a separate switch) the open task list, through the browser's own sync. Never history, habits, notes or the calendar. |

Remote code: **none** (all code is in the package). Data usage: **no user data is collected, transmitted or sold**; certify all three limited-use statements.

## Firefox AMO notes for the reviewer
- No build step, no minification, no obfuscation: the package is the source. `scripts-dev/pack.mjs` only copies files and adapts `manifest.json` (Firefox `background.scripts`, gecko id `eyetime@maxbzd.github.io`).
- `data_collection_permissions: { required: ['none'] }`.
- Ambient sounds load `src/audio/*.ogg` (CC0 recordings, credits in `src/audio/CREDITS.txt`); `offscreen` is a Chrome-only API and is feature-detected (the Firefox event page plays audio directly).
- Third-party code: Lucide icons (ISC, `src/ui/LICENSE-Lucide.txt`) and bundled fonts (licenses in `src/ui/fonts`).

## Screenshots (captions)
1. `1-home.png` — A calm new tab with a focus card, tasks and habits
2. `2-focus.png` — A running focus session and the pause page
3. `3-insights.png` — Honest statistics and a weekly review
4. `4-home-dark.png` — Dark look
5. `7-looks.png` — Eleven looks, each in light and dark
6. `11-palette.png` — Command palette (Ctrl/Cmd+K)
7. `12-timeline.png` — A day in detail: hours and focus sessions
8. `13-week-card.png` — A shareable "My week" card (totals only)

## Keywords
focus, pomodoro, website blocker, screen time, productivity, eye strain, 20-20-20, distraction, new tab, habits, time tracker
