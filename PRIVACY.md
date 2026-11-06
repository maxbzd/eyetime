# Privacy Policy

EyeTime is **local-first**. It has no account, no ads and no remote code. It has no analytics either, unless you switch on the one optional thing described under *Anonymous usage* below: off by default, and you can read every report before it is sent.

## What is stored (on your device only, in `chrome.storage.local`)

- **Domain names and seconds** per hour, e.g. `github.com — 340 s at 10:00`. Never full URLs, page titles, page content or keystrokes.
- Your settings, tasks, notes, habits and quick links.
- A short local log of the last 20 errors (message and code location only, no page addresses). It is never sent anywhere; you can read it in Settings → About → *Report a problem* and clear it there.
- If you import a calendar file (.ics): the times and titles of the next 14 days' events, kept locally and never uploaded; remove them any time in Settings → Data & privacy.
- Nothing else: the shareable "My week" card is drawn locally and contains totals only.
- Optionally (if you enable the desktop companion): seconds per desktop application name.

## What is sent anywhere

**Nothing.** The extension makes no network requests of its own. The exceptions are all entirely opt-in (plus one feature that stays on your computer, described among them):

- **Desktop companion** — if you switch it on in Settings → Tracking, the extension reads `http://127.0.0.1:8765/v1/today` on **your own computer** using a pairing token. Nothing is sent to it.

- **Calendar subscription** — if you paste your calendar's secret iCal address (up to three calendars) in Settings → Data & privacy, the extension downloads each file from the address you gave, once an hour, directly from your browser (a plain request without cookies, no third party involved). Only the events of the next 14 days are kept, on your device. The optional meeting warning and quiet mode work from those stored events; nothing is sent anywhere. The address is secret, so it is stored locally only: never synced and never included in a backup. *Unsubscribe* deletes it and withdraws the browser permission.
- **Settings sync** — off by default. If you switch it on in Settings → Data & privacy, your *settings only* (look, focus modes, preferences) are stored in your browser's own sync storage (`chrome.storage.sync`) and travel through your browser account like bookmarks do. Tasks (unless you switch on task sync below), notes, habits, links and browsing statistics are never included. With *Encrypt synced data with a passphrase* (below the sync switches) the copy is sealed on your device first: the cloud holds only ciphertext, a salt and a time.
- **Weather** — off by default. If you switch it on (Settings → General → Weather) and pick a city, the browser asks you for access to `api.open-meteo.com` and `geocoding-api.open-meteo.com`. Searching for a city sends the text you typed to Open-Meteo's geocoding service; the forecast request carries only the city's coordinates rounded to about a kilometre (never your IP-based location, name or any identifier; no cookies, no referrer). Open-Meteo is a free service without accounts or keys. The answer is kept on your device for half an hour. Turning the weather off withdraws the permission.

- **Unknown sites (experimental)** — off by default (Settings → General). If you switch it on in a recent desktop Chrome, EyeTime asks the language model that Chrome itself runs **on your computer** (Gemini Nano) to sort sites that are in none of your lists, using only the site address and the title of an open tab. The page content is never read, nothing is sent to EyeTime or anyone else, and the answers (distracting / productive) are kept on your device, shape only your reports (marked with a spark) and never block anything. EyeTime never starts the model download by itself: if Chrome still needs to download the model, you press a button first. *Forget the guesses* deletes them. Not available in other browsers.

- **Task sync** — off by default and a separate switch (Settings → Data & privacy → *Sync tasks too*), because task text is personal. If you switch it on, your open tasks and the ones finished in the last three days are stored in your browser's own sync storage (`chrome.storage.sync`) and travel to your other browsers signed in to the same account, governed by that browser's sync policy. Habits, notes, history and the calendar never sync. With the sync passphrase on, the task list is sealed on your device before it is uploaded, like the settings. Nothing goes to EyeTime or any third party. To remove the cloud copy, turn the switch off on all your devices and clear sync data in the browser's sync settings.
- **The dock** — off by default. If you turn it on in Settings → General → Dock, the browser asks you to allow EyeTime to access websites. EyeTime then draws a small black tab on the edge of web pages and, when you open it, a panel from EyeTime's own pages inside the page. It does **not** read, copy or send page content. The only things taken from a page are its address and title, and only when you press *Save* (or use *Save to EyeTime topic* in the right-click menu): they are stored on your device in your topics list, with tracking parameters removed. The numbers on the tab's rings come from EyeTime's own local data. Topics are included in the backup file and never synced or sent anywhere. You can hide the dock on chosen sites (for example your bank), and turning the dock off withdraws the access.

- **Connected services** — off until you connect one (Settings → Data & privacy → *Connected services*). Todoist, Notion and CalDAV (iCloud, Fastmail, Nextcloud…) can be kept in step with your tasks and calendar. (Google and Microsoft are prepared but not offered in this version.) When you connect one, the browser asks for access to that service's own address only (for example `api.todoist.com`), and EyeTime talks to it **directly from your browser**: there is no EyeTime server in between and no third party. What is sent is what a sync is: the text, due date, done state, priority and estimate of your tasks, and, for a calendar, the planned focus blocks you chose to put there (title and time). What is read is the tasks of the list you chose and the busy times of the calendar you chose (kept on your device, for 14 days). Tokens, passwords and sign-in tokens are kept in local storage only: never synced, never in a backup, never in the usage report; you paste an access token or an app-specific password yourself, never your main password. *Disconnect* deletes the credentials, the pairing records and the calendar events brought in, and withdraws the browser permission; nothing is deleted on either side. If you switch off *Delete in both places*, deletions are never copied; and a sync that would delete a large part of your tasks stops and asks first.

- **Anonymous usage** — off by default. If you switch on *Share anonymous usage numbers* (Settings → Data & privacy; EyeTime also asks once, after you have finished a focus session and come back on another day, and never again whatever you answer), EyeTime sends **one small report a week** to its own collector, over HTTPS, without cookies. Its purpose is to find out whether new people reach a first session, whether they come back, and which features nobody uses, so that EyeTime can be made simpler and better. The report is **numbers and names from a fixed list**; *Show what would be sent* in the same place shows the exact next report, built by the same code that sends it. It is described here field by field:

  | Field | What it holds |
  |---|---|
  | `v` | the version of the report format |
  | `id` | a random identifier made when you switch sharing on (128 random bits, not derived from anything on your device or in your browser). It is replaced when you press *New anonymous ID*, and deleted when you switch sharing off |
  | `app` | the EyeTime version, e.g. 3.7.0 |
  | `br`, `os` | the browser family (Chrome, Edge, Firefox) and the operating-system family (Mac, Windows, Linux, ChromeOS): nothing finer, no version, no model |
  | `lang`, `look`, `layout`, `mode` | your interface language, the look and the arrangement of Home you chose, and light / dark / automatic |
  | `age` | whole days since you installed EyeTime |
  | `act` | the days (counted as days since the install, never as dates or times) on which you opened or used EyeTime, for the last 60 days |
  | `first` | for each feature in the list below, how many days after the install you first used it |
  | `ft` | for each feature, how many times you used it since the last report |

  The features that are counted, and nothing else: `newtab_view`, `popup_open`, `insights_view`, `settings_view`, `focus_start`, `focus_done`, `focus_stop`, `focus_pause`, `eye_break_done`, `eye_break_skip`, `block_page`, `block_continue`, `task_add`, `task_done`, `habit_check`, `shutdown_done`, `plan_done`, `ritual_plan`, `ritual_skip`, `connection_add`, `palette_open`, `drawer_open`, `editor_open`, `starter_apply`, `wall_next`, `standby_open`. These are the names of EyeTime's own buttons and screens. **Never** a website, an address, a page title, a task, a note, a goal, a name, a time of day, a location or anything you typed.

  The counters are kept on your device whether or not you share (that is how *Show what would be sent* can show you your own numbers, and how sharing, once switched on, reports the real days since the install rather than only the future); they are never sent unless you switch sharing on. **The collector** (its code is in this repository, `server/usage/`) accepts exactly these fields and refuses anything else, keeps at most one report per install per six hours, and does not store or log your IP address, headers, cookies or user agent. **Stopping**: switching sharing off sends one request that asks the collector to delete everything it holds for your `id`, then deletes the `id` here; *Delete all my data* in Settings does the same. The counters and the `id` are never part of a backup file and are never synced. In Firefox the browser asks for its own *technical and interaction data* permission when you switch sharing on, and you can withdraw it in the add-on's permissions.

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
| `declarativeNetRequestWithHostAccess` | Instant blocking (off by default): lets the browser itself send a distracting site to the pause page before a request is made. It does nothing until you switch that setting on and allow access to websites; it cannot read pages or requests, and the browser shows no warning for it. Chrome only |
| `scripting` | Lets the dock's page script be registered on demand, and only after you have granted access to websites (it does nothing on its own; the browser shows no warning for it) |
| Sites: youtube.com, instagram.com, tiktok.com, vk.com, vkvideo.ru | Only to limit short-video scrolling and hide YouTube feeds |
| Optional: `127.0.0.1:8765` | Only when you enable the desktop companion |
| Optional: websites (`http://*/*`, `https://*/*`) | Asked only when you turn on the **dock** (Settings → General → Dock); withdrawn when you turn it off. See below. |
| Optional: `api.open-meteo.com`, `geocoding-api.open-meteo.com` | Asked only when you turn on the weather; withdrawn when you turn it off |
| Optional (Firefox): technical and interaction data | Asked only when you switch on *Share anonymous usage numbers* (see above); nothing is sent without it. Chrome has no such permission: the switch is the consent |
| Optional: the address of one service (`api.todoist.com`, `api.notion.com`, or your CalDAV server, for iCloud `*.icloud.com`) | Asked only when you connect that service in Settings → Data & privacy → Connected services; withdrawn when you disconnect it |
| Optional: one `https://` site | Asked only when you subscribe to a calendar link, and only for the site that hosts your calendar (for example calendar.google.com); withdrawn when you unsubscribe, reset or restore a backup |

## Your control

- **Incognito** windows are not tracked unless you switch it on.
- **Pause tracking** from the popup; exclude sites in Settings → Tracking.
- **Export** everything as JSON, or **delete it all**, in Settings → Data & privacy. Removing the extension also removes the data.

## Changes

Any change to this policy ships with a version bump and is listed in the release notes.

Questions: open an issue at <https://github.com/maxbzd/eyetime/issues>.
