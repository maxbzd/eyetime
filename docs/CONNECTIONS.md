# Connected services: two-way sync

EyeTime keeps its tasks and its calendar in step with the tools people already use, so that nobody has to move a way of working to try it.
Everything goes **straight from the browser to the service**: there is no EyeTime server, no account, and no third party. The promise is in `PRIVACY.md` (*Connected services*); this page is for the people who maintain it.

## What works today, and how it was verified

| Service | Tasks | Calendar | How it signs in | Verified against |
|---|---|---|---|---|
| Todoist | yes (text, done, due date, priority ⇄ star, estimate ⇄ duration) | – | API token the person pastes | a mock of API v1 (`helpers/mock-todoist.mjs`) |
| Notion | yes (a database: title, checkbox or status, date) | – | integration token + database link | a mock (`helpers/mock-notion.mjs`) |
| CalDAV: iCloud, Fastmail, Nextcloud… | yes (VTODO) | yes (VEVENT) | app-specific password | a mock (`helpers/mock-caldav.mjs`) |
| Google *(not offered yet)* | yes (Tasks) | yes (Calendar) | OAuth in the browser's own window, silent renewal | mocks (`helpers/mock-cloud.mjs`) |
| Microsoft *(not offered yet)* | yes (To Do) | yes (Outlook calendar) | OAuth code + PKCE with a refresh token | mocks (`helpers/mock-cloud.mjs`) |
| Things (Apple) | **impossible** | – | the app has no web API and no way to be reached from outside it; export Markdown or CSV instead | – |

**Be honest about it: none of the adapters has been run against a live service yet.** They are written from the services' documentation and tested against mocks that follow the same paths, methods and fields. Before a release that advertises a connection, someone has to connect a real account of each (a throwaway one) and run the checklist at the end of this page. Expect small differences: a field name, a paging detail, a rate limit.

Known limits, also told to the person where they matter:
- iCloud Reminders lists that were "upgraded" in iOS 13 and later are not visible to CalDAV; only calendars and older reminder lists are. This is Apple's, not ours.
- A recurring task or event is never changed or copied (a sync that rewrote a recurrence would be worse than none); it stays as it is on its side.
- A calendar brings its busy times in (14 days ahead, no titles beyond 80 characters) and puts **planned focus blocks** out: a task that has a time (`at`, `atDay`, `est`) becomes an event that EyeTime marks as its own (an extended property or a marker in the description), and only those are ever changed or deleted.

## Google and Microsoft: registering the OAuth clients (the team does this once)

The code is finished, but **3.7.0 does not offer them**: the dialog lists a service only when its client id is in `src/shared/sync/oauth-config.js`, and the manifest does not ask for `identity`. To switch them on: register the clients below, fill in the ids, add `"optional_permissions": ["identity"]` to `manifest.json` (Firefox too), and update PRIVACY.md, `site/privacy.html` and `store/SUBMISSION.md` (they say Todoist, Notion and CalDAV today). A client id is public by design; there is no client secret anywhere in EyeTime.

Both need the **redirect URI** the browser gives the extension: `https://<extension-id>.chromiumapp.org/` (Chrome, Edge) or the `…extensions.allizom.org` address (Firefox). Print it with `chrome.identity.getRedirectURL()` from any extension page. The extension id of a store build is fixed by the store; for development, pin it with a `key` in the manifest.

**Google** (Google Cloud console → APIs & Services):
1. Create a project, enable *Google Calendar API* and *Google Tasks API*.
2. OAuth consent screen: *External*, add the scopes `https://www.googleapis.com/auth/calendar.events`, `https://www.googleapis.com/auth/calendar.readonly` and `https://www.googleapis.com/auth/tasks`. The calendar and tasks scopes are *sensitive*: publishing needs Google's verification (a privacy policy URL, a demo video). Until then the app is in *Testing* and limited to 100 named test users.
3. Credentials → *OAuth client ID* → type *Web application* (the implicit flow is what `launchWebAuthFlow` uses), add the redirect URI above.
4. Put the client id in `GOOGLE_CLIENT_ID`.

**Microsoft** (Entra admin center → App registrations):
1. New registration, *Accounts in any organizational directory and personal Microsoft accounts*.
2. Authentication → add a *Single-page application* platform with the redirect URI above (this is what allows code + PKCE without a secret).
3. API permissions (delegated): `Tasks.ReadWrite`, `Calendars.ReadWrite`, `offline_access`, `User.Read`.
4. Put the *Application (client) ID* in `MICROSOFT_CLIENT_ID`.

After either: tick the *Connected services* line in the store's data disclosure (`store/SUBMISSION.md`) and update the privacy page if the scopes changed.

## How it works

```
Settings (page)                          service worker                              shared/sync/ (pure)
connections-group.js ── saves ──► conns / connSecrets / cl:<id>:<kind>      planPairs  three-way merge
   Sync now ── conn:sync ──────► background/connections.js ── syncTasks ──► run.js ── provider.tasks
                                  alarm every 15 min, 45 s after a change           └── syncBlocks ► provider.events
```

- **`pairs.js`**: the merge. Each pair of items (a local task, a remote item) has a *base*, the snapshot of what both looked like when they last agreed. Per field: only one side changed → take it; both changed to the same → nothing; both differently → the most recent edit wins (`updatedAt`) and it is counted as a conflict. An edit beats a deletion. A first-time pairing adopts items with the same text (or the same task id) instead of duplicating. A listing that is not known to be complete never deletes anything, and a run that would delete more than a fifth of the tasks (at least 5) stops and waits for the person (*Allow deletions once*).
- **`run.js`**: one synchronisation, start to finish. Every step is safe to repeat; an item that failed is tried again next time; the pairs are saved after each step, so a crash in the middle loses nothing. A failure of the whole conversation (sign-in refused, rate limit, no network) is a `SyncError` with a kind; the worker records it as the connection's status, pauses on `auth` until the person signs in again, and waits as long as a service asks for on `rate`.
- **Local changes while a run is going**: tasks are written with `updateCollection` (a lock, a fresh read); a change the person made during the run is detected by comparing with what was read, and left for the next run.
- **`providers/*.js`**: one file per service: `fields`, `origins(conn)`, `discover()`, `build()` → `{ tasks, events }`. See the head of `providers/index.js`. Nothing else is contacted. Every request is made with `credentials: 'omit'` and a fixed list of headers.
- **Storage** (`shared/connections.js`): `conns` (what Settings shows), `connSecrets` (tokens: never synced, never exported, deleted with the connection), `cl:<id>:<kind>` (the pairs). `exportAll` leaves all three out; the e2e checks it.
- **Busy times** are stored as the calendar source `conn-<id>` next to subscriptions, so the planner, the meeting warning and quiet mode use them without knowing where they came from.

## Adding a service

1. A file in `providers/` that follows the shape in `providers/index.js`; register it there.
2. A mock in `scripts-dev/tests/helpers/` that behaves like the service (paths, methods, fields, the way a finished item disappears from the active list…), and a test like `connections-todoist.test.mjs`: create / edit / complete / delete on each side, a conflict, a failure in the middle, the rate limit, the refused token.
3. Strings for `cn.f.<field>` and `cn.h.<id>` in every language, and a line in this table.

## Checklist before saying "works with X" in public

For each service, with a throwaway account:
- [ ] Connect, choose the list or calendar, first sync: nothing duplicated, nothing lost.
- [ ] Edit a task on each side; complete on each side; delete on each side (with and without *Delete in both places*).
- [ ] The same task edited on both sides before a sync.
- [ ] 300+ tasks (paging), and a task with emoji, a very long title, a due date in another time zone.
- [ ] Revoke the token on the service: the row asks to sign in again and nothing is deleted.
- [ ] Disconnect: the permission is withdrawn, nothing is left in `chrome.storage.local` (`conns`, `connSecrets`, `cl:*`), the service's data is untouched.
- [ ] Calendar: a planned block appears as an event, moves when the task moves, disappears when it is unscheduled; a meeting made in the calendar shows as busy time in *Plan my day*.
