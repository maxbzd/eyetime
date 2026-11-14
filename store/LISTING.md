# Store listing copy (Chrome Web Store · Edge Add-ons · Firefox AMO)

Everything below is ready to paste. Screenshots: `store/screenshots/<lang>/` (five per language, 1280×800, made by `scripts-dev/e2e/store-shots.cjs`; the store takes five and refuses any other size). Support: `maxbzd1600@gmail.com` (Telegram @maxbzd), issues: `https://github.com/maxbzd/eyetime/issues`. Privacy policy URL: `https://maxbzd.github.io/eyetime/privacy.html` (published by `.github/workflows/pages.yml`; the same text lives in `PRIVACY.md`).

## Name, summary, description, screenshot captions, keywords
One file per language, same structure — paste the sections into the store form of that language:

| Language | File | Screenshots |
|---|---|---|
| English (source) | `store/listing/en.md` | `store/screenshots/en/*.jpg` |
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
| `declarativeNetRequestWithHostAccess` (no install warning) and the same optional host access | Only if the user turns on Settings → Blocking → Instant blocking: the browser asks for access to websites, then EyeTime gives the browser a list of rules ("send this domain to the pause page") so that not even one request reaches a distracting site. The rules are made from the user's own lists on the device; nothing is read from pages and nothing is sent anywhere. |
| `scripting` (registers the dock's page script on demand, only after the user grants website access; no install warning) and optional host access: `http://*/*`, `https://*/*` (the dock; declared as *optional*, never granted at install) | Only if the user turns on the dock (Settings → General → Dock): the browser asks for access to websites, then EyeTime registers a small page script that draws one tab on the edge of pages and an extension iframe with the user's own panel (focus timer, tasks, a learning list). The script reads nothing from the page except its address and title, handed to the panel only when the user presses Save. All data stays on the device; nothing is sent anywhere. The access is withdrawn when the user turns the dock off. |
| Optional host access: `https://*/*` (declared as *optional*, never granted at install) | Used only if the user subscribes to their own calendar link (Settings → Data & privacy): the browser then asks for access to the one site that hosts the calendar, the extension downloads that one .ics file once an hour and keeps the next 14 days of events on the device. The permission is withdrawn when the user unsubscribes (or resets / restores data). Redirects are not followed. Nothing is sent anywhere. |
| `chrome.storage.sync` (covered by `storage`) | Optional, off by default: syncs settings, and (a separate switch) the open task list, through the browser's own sync. Never history, habits, notes or the calendar. |

Remote code: **none** (all code is in the package). The content security policy of the extension pages is `script-src 'self' 'wasm-unsafe-eval'`: `'wasm-unsafe-eval'` is there only so that the on-device models (background cut-out, 3D photo, the optional site classifier; ONNX Runtime WebAssembly, in the package) can run; it allows WebAssembly, not `eval` or inline script, and no script is loaded from anywhere but the package. The policy also limits images, fonts, sounds and styles to the extension itself (plus `data:` and `blob:` for the person's own photos), so nothing a shared theme says can make a page fetch from outside, and it turns on Trusted Types (`require-trusted-types-for 'script'`, one policy named `eyetime` that lets through only the extension's own files), so that a string can never become running code on an extension page. Data usage: **no user data is collected, transmitted or sold**; certify all three limited-use statements.

## Firefox AMO notes for the reviewer
- The package is a production build of the source: each page's script is bundled and minified with esbuild (names and strings are kept, nothing is obfuscated). Build steps: `docs/BUILDING.md` (`npm ci && npm run build`, Node 22; the same source gives the same bytes). `scripts-dev/pack.mjs` also adapts `manifest.json` for Firefox (`background.scripts`, gecko id `eyetime@maxbzd.github.io`). The source archive is attached to the submission.
- `data_collection_permissions: { required: ['none'] }`.
- Ambient sounds load `src/audio/*.ogg` (CC0 recordings, credits in `src/audio/CREDITS.txt`); `offscreen` is a Chrome-only API and is feature-detected (the Firefox event page plays audio directly).
- Third-party code: Lucide icons (ISC, `src/ui/LICENSE-Lucide.txt`) and bundled fonts (licenses in `src/ui/fonts`).

## Screenshots (captions)
The store set is the five pictures per language in `store/screenshots/<lang>/*.jpg` (see the table above); their captions are in each `store/listing/<lang>.md`. The PNG files in the root of `store/screenshots/` are older pictures that only the README and the promo script use: do not upload them to a store.

## Keywords
focus, pomodoro, website blocker, screen time, productivity, eye strain, 20-20-20, distraction, new tab, habits, time tracker
