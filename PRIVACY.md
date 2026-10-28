# Privacy Policy

EyeTime is **local-first**. It has no account, no servers of its own, no analytics, no ads and no remote code.

## What is stored (on your device only, in `chrome.storage.local`)

- **Domain names and seconds** per hour, e.g. `github.com — 340 s at 10:00`. Never full URLs, page titles, page content or keystrokes.
- Your settings, tasks, notes, habits and quick links.
- A short local log of the last 20 errors (message and code location only, no page addresses). It is never sent anywhere; you can read it in Settings → About → *Report a problem* and clear it there.
- If you import a calendar file (.ics): the times and titles of the next 14 days' events, kept locally and never uploaded; remove them any time in Settings → Data & privacy.
- Nothing else: the shareable "My week" card is drawn locally and contains totals only.
- Optionally (if you enable the desktop companion): seconds per desktop application name.

## What is sent anywhere

**Nothing.** The extension makes no network requests of its own. Three exceptions, all entirely opt-in (plus one feature that stays on your computer, described last):

- **Desktop companion** — if you switch it on in Settings → Tracking, the extension reads `http://127.0.0.1:8765/v1/today` on **your own computer** using a pairing token. Nothing is sent to it.

- **Calendar subscription** — if you paste your calendar's secret iCal address (up to three calendars) in Settings → Data & privacy, the extension downloads each file from the address you gave, once an hour, directly from your browser (a plain request without cookies, no third party involved). Only the events of the next 14 days are kept, on your device. The optional meeting warning and quiet mode work from those stored events; nothing is sent anywhere. The address is secret, so it is stored locally only: never synced and never included in a backup. *Unsubscribe* deletes it and withdraws the browser permission.
- **Settings sync** — off by default. If you switch it on in Settings → Data & privacy, your *settings only* (look, focus modes, preferences) are stored in your browser's own sync storage (`chrome.storage.sync`) and travel through your browser account like bookmarks do. Tasks (unless you switch on task sync below), notes, habits, links and browsing statistics are never included.
- **Weather** — off by default. If you switch it on (Settings → General → Weather) and pick a city, the browser asks you for access to `api.open-meteo.com` and `geocoding-api.open-meteo.com`. Searching for a city sends the text you typed to Open-Meteo's geocoding service; the forecast request carries only the city's coordinates rounded to about a kilometre (never your IP-based location, name or any identifier; no cookies, no referrer). Open-Meteo is a free service without accounts or keys. The answer is kept on your device for half an hour. Turning the weather off withdraws the permission.

- **Unknown sites (experimental)** — off by default (Settings → General). If you switch it on in a recent desktop Chrome, EyeTime asks the language model that Chrome itself runs **on your computer** (Gemini Nano) to sort sites that are in none of your lists, using only the site address and the title of an open tab. The page content is never read, nothing is sent to EyeTime or anyone else, and the answers (distracting / productive) are kept on your device, shape only your reports (marked with a spark) and never block anything. EyeTime never starts the model download by itself: if Chrome still needs to download the model, you press a button first. *Forget the guesses* deletes them. Not available in other browsers.

- **Task sync** — off by default and a separate switch (Settings → Data & privacy → *Sync tasks too*), because task text is personal. If you switch it on, your open tasks and the ones finished in the last three days are stored in your browser's own sync storage (`chrome.storage.sync`) and travel to your other browsers signed in to the same account, governed by that browser's sync policy. Habits, notes, history and the calendar never sync. Nothing goes to EyeTime or any third party. To remove the cloud copy, turn the switch off on all your devices and clear sync data in the browser's sync settings.
- **The dock** — off by default. If you turn it on in Settings → General → Dock, the browser asks you to allow EyeTime to access websites. EyeTime then draws a small black tab on the edge of web pages and, when you open it, a panel from EyeTime's own pages inside the page. It does **not** read, copy or send page content. The only things taken from a page are its address and title, and only when you press *Save* (or use *Save to EyeTime topic* in the right-click menu): they are stored on your device in your topics list, with tracking parameters removed. The numbers on the tab's rings come from EyeTime's own local data. Topics are included in the backup file and never synced or sent anywhere. You can hide the dock on chosen sites (for example your bank), and turning the dock off withdraws the access.

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
| `scripting` | Lets the dock's page script be registered on demand, and only after you have granted access to websites (it does nothing on its own; the browser shows no warning for it) |
| Sites: youtube.com, instagram.com, tiktok.com, vk.com, vkvideo.ru | Only to limit short-video scrolling and hide YouTube feeds |
| Optional: `127.0.0.1:8765` | Only when you enable the desktop companion |
| Optional: websites (`http://*/*`, `https://*/*`) | Asked only when you turn on the **dock** (Settings → General → Dock); withdrawn when you turn it off. See below. |
| Optional: `api.open-meteo.com`, `geocoding-api.open-meteo.com` | Asked only when you turn on the weather; withdrawn when you turn it off |
| Optional: one `https://` site | Asked only when you subscribe to a calendar link, and only for the site that hosts your calendar (for example calendar.google.com); withdrawn when you unsubscribe, reset or restore a backup |

## Your control

- **Incognito** windows are not tracked unless you switch it on.
- **Pause tracking** from the popup; exclude sites in Settings → Tracking.
- **Export** everything as JSON, or **delete it all**, in Settings → Data & privacy. Removing the extension also removes the data.

## Changes

Any change to this policy ships with a version bump and is listed in the release notes.

Questions: open an issue at <https://github.com/maxbzd/eyetime/issues>.
