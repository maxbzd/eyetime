# Privacy Policy

EyeTime is **local-first**. It has no account, no servers of its own, no analytics, no ads and no remote code.

## What is stored (on your device only, in `chrome.storage.local`)

- **Domain names and seconds** per hour, e.g. `github.com — 340 s at 10:00`. Never full URLs, page titles, page content or keystrokes.
- Your settings, tasks, notes, habits and quick links.
- A short local log of the last 20 errors (message and code location only, no page addresses). It is never sent anywhere; you can read it in Settings → About → *Report a problem* and clear it there.
- Nothing else: the shareable "My week" card is drawn locally and contains totals only.
- Optionally (if you enable the desktop companion): seconds per desktop application name.

## What is sent anywhere

**Nothing.** The extension makes no network requests. The single exception is entirely opt-in:

- **Desktop companion** — if you switch it on in Settings → Tracking, the extension reads `http://127.0.0.1:8765/v1/today` on **your own computer** using a pairing token. Nothing is sent to it.

- **Settings sync** — off by default. If you switch it on in Settings → Data & privacy, your *settings only* (look, focus modes, preferences) are stored in your browser's own sync storage (`chrome.storage.sync`) and travel through your browser account like bookmarks do. Tasks, notes, habits, links and browsing statistics are never included.

Fonts and icons are bundled inside the extension; no content is loaded from the internet.

## Permissions — why each one

| Permission | Why |
|---|---|
| `storage` | Save settings and statistics on this device |
| `tabs` | Read the address of the active tab to know which site you're on |
| `webNavigation` | Stop a paused site before it loads |
| `idle` | Detect when you're away so idle time isn't counted |
| `alarms` | Wake the extension for timers and reminders without a background loop |
| `contextMenus` | Right-click menu to classify or block the current site |
| `notifications` | Eye-break and session-complete reminders |
| `offscreen` | Play the soft session start/end sound |
| `favicon` | Show site icons from the browser's own cache (nothing is downloaded) |
| Sites: youtube.com, instagram.com, tiktok.com, vk.com, vkvideo.ru | Only to limit short-video scrolling and hide YouTube feeds |
| Optional: `127.0.0.1:8765` | Only when you enable the desktop companion |

## Your control

- **Incognito** windows are not tracked unless you switch it on.
- **Pause tracking** from the popup; exclude sites in Settings → Tracking.
- **Export** everything as JSON, or **delete it all**, in Settings → Data & privacy. Removing the extension also removes the data.

## Changes

Any change to this policy ships with a version bump and is listed in the release notes.

Questions: open an issue at <https://github.com/maxbzd/eyetime/issues>.
