# Changelog

## 3.9.2 — 2026-11-07 — The first session ends the way it should

A release about the moment that matters most to a new person: the end of the first focus session. It works the same whether the new tab is open or closed, whether the session ran out or was stopped, and whether a second one started in between. The first-days card, the tips switch and the page after removal got the same care.

### The first session and its dialog
- **A stopped first session ends in silence, also when the new tab is open.** The worker now decides "is this the session the onboarding started?" *before* it clears the running session, and leaves a mark (`stopped`) for the page. Before, an open tab reacted to the cleared session first, closed the matter, and the worker then no longer recognised the session and put up the "how did it go?" card. A test replays exactly that order, with a page that closes the matter the moment the session disappears.
- **A stop in the last seconds before the planned end is a stop.** The page used to wait up to 20 seconds for a finished session that would never be written; with the mark it closes the matter at once, and a record that really was written still wins.
- **The count in the dialog is the session's own.** The number of pages held back is read at the end of the session (`blocksEnd`) instead of whenever the dialog happens to be drawn, so pages stopped after the session, or in a second one, no longer inflate it. A session with nothing held back says "N minutes of focus" without a count.
- **The state of the first session is written in patches, under one lock.** The onboarding page, the worker (a stop, the end of the session) and every open new tab all write to it, sometimes in the same instant, and each used to write the whole object back, so one could erase a field another had just set (a `stopped` mark, the count taken at the end). Now each party sends only the fields it owns (`patchObFirst`), merged into the value read inside the lock; two tests cover it, one with four writers at once.
- **A start slower than a minute is waited for.** If the new tab is drawn before the worker has started the session (a browser that has just reopened), the matter is no longer closed after the first minute: the page waits up to the planned length of the session, and closes it only if the session never came.
- **An open dialog closes by itself when another session takes over.** If a second session starts while "First focus done" is still on the screen, the dialog is dismissed (the matter was already closed for good; now the screen agrees).

### Home
- **"Start 5 min" on the first-days card is a try, and stays one.** It no longer turns your usual session length into five minutes or switches strict mode off (`focus:start` is sent with `remember: false`, as in the onboarding). A new check sets 25 minutes and strict mode, presses the button, and expects both to be unchanged.
- A failure while redrawing the background after the system light/dark theme changes goes to the local error log (the last background call without a handler).

### Anonymous numbers
- **Opening the guided set-up is counted** (`tour_open`, a count with no content), so it is possible to see whether the tour is used. It is in the report only if the person has agreed to share anonymous numbers, like every other counter; it is listed in `PRIVACY.md`, `docs/TRACKING-PLAN.md`, the collector's plan and the dashboard (Features). It is one more counter of the same kind (a count of using a feature), so the consent version stays as it is.

### Tips
- **One switch decides, and it travels with your settings.** "No more tips" on the card now writes only Settings → General → "Tips about features"; the page asks nothing else. Before, a second flag kept on the device could disagree with the switch after settings arrived from another device (the switch said "on", no tip ever came). The history of tips already seen stays in the backup, as before.

### The page after removal
- **Step one, the reason, is confirmed too.** "Thank you" appears only when the collector took the answer; if it refused or the network failed, the list stays and a line says that nothing was stored and that you can choose again (the optional words step already worked this way).

### Notes, canvas and look
- **A note turned into a task is moved, not copied.** "Make a task" in the notes module removed the note by its position in a list that could already have changed, so the note stayed beside the new task. It now re-reads the stored notes and removes the one with that id; deleting a note works the same way. The `tour` check covers the path from a note to a task.
- **An empty canvas says what to do.** A canvas layout with no block on it showed a bare page; it now carries a short hint pointing at the widget panel (`cv.empty`, translated into all 11 languages).
- **The arrangement editor opens with blocks that do not lie on one another.** Blocks below the first screen (Today, Tasks) were put in their usual places without looking at the focus card, which is wider on some looks, so they overlapped it (and the first-days card, the day's strip and the backup reminder showed through the arrangement). Now a block that would land on another slides to the free side space, the card in the way gives up some width when the space is too narrow for it, and the flowing cards are hidden while the editor is open. A check in `editor` fails on the old behaviour.
- **A toast with "Undo" stays for seven seconds and waits while the pointer or the keyboard is on it** (it used to vanish after three, which is short for reaching a button, and let an end-to-end check miss it on a slow machine). Plain toasts keep their three seconds.
- **The widget gallery opens on "All"** instead of on the first category, so the first thing seen is the whole set.
- **The backup reminder on the Today layout is a small pill** that gives up its place on short windows (under 560 px high) instead of covering the day.
- **The first line of the onboarding no longer carries a focus frame** when the page opens; keyboard focus still shows on every control.
- **The dock's second design has readable group titles** (white at 64 %, enough contrast on the dark glass).
- **"min" instead of "minutes" in the short-video dialog** in English, German, Spanish, French, Italian and Portuguese, so the line fits one row.

### Texts and documents
- **A new 36-second demo video** (1920×1080, 30 fps, no sound, 4.6 MB) is on the project page, with its first frame as a link in both READMEs. It is not a screen recording: the real interface is photographed at twice the size and composed with motion and words (the new tab, a focus session, the pause page, insights, looks, and the close), and every frame is drawn from the time, so it is sharp and steady. The page loads it only when asked (no autoplay, with controls). `scripts-dev/e2e/demo-video.cjs` renders it again after any interface change; the old screen recorder is gone.
- **All the pictures are taken again from the current build:** the screenshots in the READMEs, the project page's set and the five store screenshots in each of the 11 languages. The onboarding picture shows the real first run (what pulls your attention away, with the pause preview), and a new one shows the end of the first session. Five pictures nobody linked to (the dock series and a second insights view) are removed.
- `docs/FEEDBACK.md`: the table rows for the question of fit and for the pause question now describe what the code does (a finished session as the trigger, thumbs only with no free text, the 30-day budget after an answer and 60 days after a closed card), and rules 2 and 4 say that the quiet is one for all questions and that showing a question starts the budget at once.
- `store-check.mjs` compares the number of languages in the Russian README with the product's own list (it only forbade "6" before).

### Under the hood
- 626 unit tests (620 before). New: the first-session plan for a marked stop; the worker replays a stopped first session against a page that closes the matter first; the count taken at the end of a finished session; the patching of the first session's state with several writers; a slow start waited for; a five-minute try that does not change the usual length (the earlier check ran a 25-minute session against a 25-minute default and could not tell).
- End-to-end: `feedback` no longer depends on the hour it runs at (after 18:00 the evening review strip comes first, by design). `onboarding` stops a first session after two and a half minutes with the tab open and expects no dialog, no card and the mark; `tour` presses "Start 5 min" with a 25-minute strict setup, and checks that "No more tips" is the Settings switch and that switching it on brings tips back.

## 3.9.1 — 2026-11-07 — Smoother first minutes, tips you control, calmer questions

A polish release on top of 3.9.0: the first session and its dialog behave in the cases people really run into, the task button on the first-days card works on the Today layout, tips get a proper switch in Settings, and every small question keeps the same quiet.

### First run and first session
- **The first session is tied to its own id.** The onboarding remembers which session it started. If a second session begins before the new tab shows the "First focus done" dialog, the coach card and the dialog no longer mix the two sessions up: the first one's moment is closed quietly, the dialog never appears in the middle of the second, and the dialog's length and count come from the session it is about.
- **A first session stopped after two minutes or more ends in silence.** The "how did it go?" card is no longer put up for it (it was already skipped for a finished one), so the first contact with the product has no stray question.
- **The session the onboarding starts no longer changes your usual session length.** A new `remember: false` option of `focus:start` keeps the "last used" length, scope and strictness as they were.
- The coach card counts closed **sites**, the dialog says "without distractions" only when something was in fact held back, and "I'll choose later" promises nothing. (Shipped in 3.9.0; covered by new tests in this release.)

### Home
- **"Add a task" on the first-days card works on the Today layout.** The tasks live in the side panel there; the button now opens the panel, puts the cursor in the field, and falls back to the command palette when no field can be shown. An end-to-end test types a task through it.
- A failure while drawing the background after a photo change or "Next photo" is written to the local error log instead of being lost as an unhandled rejection.

### Tips and guided set-up
- **Tips have a switch: Settings → General → "Tips about features".** "No more tips" on the card now flips the same switch, and turning it on again brings tips back.
- **The choice about tips travels with a backup.** Restoring a backup no longer brings tips back for someone who switched them off, or shows the ones already seen; a new `tips` setting defaults to on.

### Questions and feedback
- **The mood of the week is never asked during a focus session**, also when Insights is open in one (like every other question).
- **A closed "how disappointed would you be" question counts as asked.** The next one is a rating after a session, and the question of fit returns after 90 days; before, someone who always chose "Not now" was asked it again and again and never saw the rating.
- **After a GitHub draft opens, the form says so honestly:** "The draft is open. Nothing has been sent yet: press Submit new issue on GitHub." A blocked pop-up now says that pop-ups are blocked (and keeps the words), instead of blaming the connection. Eleven languages.
- **The page after removal says "Sent" only when the collector took the message**; otherwise it says that nothing was stored and that it can be tried again.

### Texts and documents
- **The README and the project page no longer carry the 30-second demo clip** (a 256-colour GIF, and a short MP4 with the same footage on the page). It was soft and stuttering next to the sharp screenshots, so the README now leads with the real pictures of the product and the project page with the full-size screenshot of Home. The recording script (`scripts-dev/e2e/demo.cjs`) stays for a better demo later.
- The Russian README says 11 languages (it said 6) and `store-check.mjs` now guards that line too; the body of `docs/FEEDBACK.md` matches what is built (a rating after a finished session once 7 days of use have passed, one question in 30 days, "Not now" and "Don't ask for ratings" on every card, the store-review invitation marked as planned).

### Under the hood
- 620 unit tests (617 in the release before): the plan of the first session now also covers a second session and the session id; the worker test covers the questions after a stopped or finished first session and the unchanged usual length; the feedback tests cover the mood during a session and the question of fit; the backup tests cover the tips choice.
- The end-to-end suites `onboarding` (the session id) and `tour` (the task button, the tips switch and its restore) are extended; the visual baselines are unchanged.

## 3.9.0 — 2026-11-07 — The first minutes, and a way to answer you

The first run is now three light screens and a real first session; the person can write to the maker and get the answer back inside EyeTime; the optional anonymous numbers and the dashboard that reads them are in the code, but no collector address is set in this release, so nothing is sent; a guided set-up and quiet tips help people find the rest; and the privacy, sync, first-run and questions code got a round of hardening.

### A steadier first run, quiet questions that keep their word
- **The dialog after the first session is no longer lost when the new tab is open as the session ends** (the usual case): the worker clears the session a moment before it writes the finished one, and the page used to take that moment for an early stop and close the matter for good. It now waits for the record (up to 20 seconds after the planned end); a session stopped early is still closed at once. The decision is pure and tested (`first-session-plan.js`), and the end-to-end test now ends the session in the real order.
- **A backup made before 3.8.1 no longer brings the desktop helper's token back when it is imported** (the switch comes back off and the token empty, in both file formats).
- **The week's mood and "Did this pause help?" keep the same quiet as every other question**: one in 30 days, 60 days after "Not now", not soon after the question about numbers, and the pause one never during a focus session.
- **First run, said honestly**: the card during the first session counts the sites that are closed (not the kinds chosen); with nothing chosen ("I'll choose later") the last screen promises nothing; under the preview a line names other sites that are held back (so "Social" and a closed reddit.com do not look like a fault); "5 minutes without distractions" is said only when something was in fact held back; the first session no longer turns the usual session length into five minutes, and does not add a second question on top of its own dialog; the mark of the chosen look follows the choice in that dialog; the button that skips on the first screen says "Save and finish" on the second one.
- **The page after removal** is described as it is (an optional second step with a few words), in the notice, the measurement notes and the code.
- **Numbers a person can count**: 46 widgets (the gallery's tiles), "22 photo backgrounds" (the grid of photos); the README says "seven ready themes" and the Russian README 16 looks; `store-check.mjs` keeps all of it.
- Smaller: the form says the language in use, not "auto", and shows a thank-you after the GitHub draft opens (a blocked pop-up is an error, not a count); a rejected message to the maker shows in the collector's intake; a report refused because the hour's room for new installs is full is kept for the next try; "show the night clock now" is in Settings also while the clock is off; a failure drawing the background is logged, not fatal; links to other documents in the published privacy page work; dead texts removed.

### Finding the rest: a guided set-up and quiet tips
- **"Set up in detail"**, offered after the first session (and in the command palette, and in Settings → General): six short steps (your day on Home · limits · a rhythm for work · make Home yours · evenings · your other tools), each with the real controls applied at once, each skippable. What needs the browser's permission is a link into Settings: the tour never asks for one.
- **Quiet tips about features you have not met**: one small card, at most once a week, never in the first week, never during a session, never about something you already use, each shown once, or twice if *Not now* was chosen (it returns a single time after 45 days); *Show me* opens the tour at that step, *No more tips* is for good. Nothing is counted or sent.

### Privacy, sync and resilience
- **The desktop helper's token is no longer written to a backup file** (the switch comes back off and the token empty), and switching the helper off withdraws its `127.0.0.1` access.
- **Task and calendar sync holds deletions when a service answers with nothing and two or more tasks were linked** (before, only four or more were protected); one linked task whose counterpart is gone is still a plain deletion.
- **Restoring a backup or switching the Dock off no longer withdraws the browser access that the restored settings, or instant blocking, still use.**
- **The numbers in the store texts are checked against the code** (16 looks, 22 photo backgrounds, 46 widgets: what a person can count in the galleries; and "no analytics" fails the check the day a collector address is filled in); the texts were corrected in all eleven languages, the site and the README.
- **Quick add understands "45m!"**; Settings has a "show the night clock now" button; instant blocking says when some sites did not fit the browser's rule limit and what it does not cover (daily limits, the budget, guessed sites).
- **Safety nets**: a photo that cannot be read (no IndexedDB) no longer stops the new tab from coming up, and a reset tells the other tabs; the depth model is loaded once per worker; one broken widget no longer stops the others; a failing `boot()`, a tab that cannot open and a missing translation in the short-video card are handled; a photo over 40 MB is refused before it is decoded.
- **Sync encryption**: switching it off needs the passphrase, a compressed payload is read with a cap while it is unpacked, and a few passwords everyone tries first are refused.

### The first minutes: three screens, then a real first session
- **Onboarding is now three light screens instead of five** (`docs/ONBOARDING.md` has the research, the five candidates compared, and what was refused): a hello that says how long it takes and that EyeTime is the new tab (and where the way back is); *What pulls your attention away?* with nothing pre-selected and **a live preview of how a pause looks** on the first site chosen; and *Your first focus* (what will you work on, 5 / 10 / 25 minutes, one big button).
- **The first session starts on the real new tab**, with a small card that says what is closed and offers to show it. When it ends, one dialog: the real number of times a site was held back, and the choices that are better made now than before the person saw anything (look, theme, daily goal, eye breaks, work hours), applied live. A session stopped early is not celebrated.
- No account, no permission, no notification request, no quiz and no invented numbers. The old "rhythm" and "look" screens are gone from the first run; their defaults stay and the same choices are asked after the first session.

### Write to the maker, and the answer comes back inside EyeTime
- **A form for an idea, a problem or a kind word** (command palette, the popup, Settings): the words, optional chips, the version and system attached only if left on, and the exact text of what is attached shown. Eleven languages. Without a collector (this release) it opens a GitHub draft and says that it will be public.
- **The author can answer from the dashboard, and the answer appears on the person's new tab.** No account and no address: the message carries a random ticket made on the device (never pre-ticked), the collector keeps only its hash, and the extension asks for answers at most every six hours. Messages can be deleted by their author with that ticket. Described in `PRIVACY.md` and `docs/COMPLIANCE.md`.
- **Small questions that stay out of the way:** a rating after a finished session, how disappointed the person would be without EyeTime (once, then every 90 days), the mood of the week under the weekly review. At most one in 30 days, never in the first week or during a session, "Not now" is quiet for 60 days and *Don't ask for ratings* is for good. The consent question counts toward the same budget and goes first.
- **The dashboard has a Feedback page** (fit score with interval against the 40 % line, ratings by week, themes, "are we asking too often", the inbox with the reply box) and `docs/FEEDBACK.md` records the decisions. The Telegram digest says how many messages are new and waiting.

### Optional anonymous usage numbers, and the dashboard that reads them
- **The report grew, and is still a list of numbers from fixed lists** (version 1 of the schema, up to 6 KB): which optional features people keep switched on and, in steps, how many tasks, habits and blocked sites they have; how long finished sessions are and how many are stopped in the first five minutes; why pages are stopped; how fast the new tab is ready (five buckets); whether the welcome was finished; and errors by place only. *Settings → Data & privacy → Share anonymous usage* shows the exact report before it goes. Still off by default, still no address in a build until the collector exists, still nothing but numbers (`PRIVACY.md` lists every field and a test insists on it).
- **The collector gets a dashboard** (`server/usage/`): twelve pages (the Windows one appears only when there is Windows data) (overview with a product-health scorecard, growth with new / stayed / returned / lapsed, activation with the first-week habits of those who stayed, retention with the curve, cohorts and DAU / MAU, features with trends and a detail view, sessions and blocking, quality with versions, audience with segment comparison, and a glossary), in Russian and English, light and dark, behind a secret key. Any period (7 / 28 / 90 days, all time, two dates), comparison with the period before, **filters by version, browser, system, language, look, layout and mode**, **export to CSV, JSON, Markdown and PDF**, and an optional public page of totals over 50+ installs. The formulas are plain functions with tests on populations counted by hand (people who left count as not retained). `node scripts-dev/dashboard-preview.mjs` shows it with a made-up population. Only the browser extension reports; the Windows app sends nothing. See `docs/MEASUREMENT.md` and `server/usage/README.md`.

### Analytics that can be trusted (the collector and the dashboard; the extension changes only where said)
- **Every share has a 95 % interval and every change says whether it is more than chance**; the **north star** (sessions finished per active week), **events on the charts**, **targets the owner edits**, **days of the week**, **behavioural filters** (how much they use it, whether they ever started a session, whether blocking is on).
- **Experiments**: a device is put in an arm by a random number that never leaves it; the report names the arm only for an experiment listed in the schema (`x`); a new **Experiments** page compares the arms with significance.
- **Why people leave**: the page opened after removal (`site/uninstall.html`) sends one reason from a list, counted by day on the collector with no identifier (an optional second step lets the person add a few words and, only for an answer, an email: that is a message to the maker, sent only on Send); the extension sets the page only when a collector exists.
- **Report intake** (what the door accepted and refused, by day), **coverage of the sample** against the store's own numbers (typed in by the owner), a **Telegram digest and alarms** (cron), **deletion of installs idle for 400 days**.
- **`docs/TRACKING-PLAN.md`** lists every counter and flag with the page that reads it (generated; `npm run check` keeps it current), and **an end-to-end test** runs many simulated people through the real client code, the collector and the D1 store and checks the dashboard's numbers against what they did.
- Dashboard: drawn anew in a Linear / Attio style.
- **The question about sharing anonymous numbers is now a note, not a strip**: written in the maker's own voice, with two plain promises (never sold or used for money; nothing personal), the exact report one click away and an honest "no" that is never asked about again. Eleven languages.
- **The question about sharing is built for conversion and for the law**: it is asked right after a finished session (or after a week of waiting), never during work; "Maybe later" brings it back after three weeks with other words, up to three asks, the third says it is the last and its "No, thanks" is final, and a plain "Don't ask again" link is there on the first two; the first ask has two voices (an experiment whose winner is read from how the people who agreed split between them); the text now says plainly that after a yes EyeTime sends the numbers on its own once a week; the refusal is a real, bordered, readable button; a link opens the full notice; the thank-you says where the switch is. A consent now carries a version, and a change of what is sent stops reports until the person agrees again. `PRIVACY.md` has the full notice (controller, basis, recipients, transfers, retention, rights, children, California, the Chrome Web Store Limited Use statement) and `docs/COMPLIANCE.md` is the review, with what is left to the owner.
- **The Windows app becomes a second product in the same collector** (`pr: "win"`), only if the person says yes; see `docs/MEASUREMENT.md`. The dashboard gets an *Extension | Windows* switch and a Windows page.

## 3.8.1 — 2026-11-06 — One licence

- **The whole repository is now under the Functional Source License (FSL-1.1-ALv2), no longer MIT.** The code stays open to read, run and change for any purpose except a competing commercial product; every version becomes Apache 2.0 two years after it is released. The name "EyeTime" and the logo are not licensed. `LICENSE` is the official text, `NOTICE` says what is third-party and plain words, every source file carries a two-line header, and `npm run check` keeps all of it true (`scripts-dev/license-check.mjs`). The wording "open source" is gone from the app, the listings and the site: it is source-available.
- Versions before 3.8.1 were published under the MIT licence and stay so for anyone who already has them.

## 3.8.0 — 2026-11-06 — Lighter, stricter, easier to trust

### Faster to open
- **A production build.** The packages hold one bundle per page instead of a tree of modules: the new tab loads 2 scripts and 18 files instead of 131 and 148, the popup 11 files instead of 55, the options page 12 instead of 106; time to the end of loading (median of 14 loads) falls from about 230 ms to about 90 ms on the new tab and from about 142 ms to 65 ms in the popup. Source and development are unchanged (load the folder as it is). The build is reproducible (two builds, same bytes; `scripts-dev/verify-build.mjs`), each release has an SBOM and a signed provenance statement, and the shipped package is loaded into a browser and used by a test of its own. See `docs/BUILDING.md`.
- **One language per page.** The translations are read as data, and only the language in use: the popup now reads 363 KB of script at start instead of 1 387 KB, the new tab 804 KB instead of 1 828 KB, and the background worker no longer loads eleven languages every time it wakes. (`src/shared/locales/data/*.json` are written from the `.js` files by `npm run locales`; `npm run check` fails if they are out of date.)
- A test now counts what each page and the worker load at start, and fails when a page starts to carry translations as code or grows past its budget (`scripts-dev/tests/weight.test.mjs`). The load-time budgets of the browser suite were tightened from 3.5 s to 1.5 s for Home.

### Lighter on the browser
- **The worker is no longer woken twice a minute for nothing.** The 30-second tracking alarm now runs only while a site is being counted or a focus session or rest is running; with nobody at the keyboard it is off (120 wake-ups an hour saved), and coming back starts it again.
- **Your own photo, its cut-out and its depth map live in IndexedDB**, not in the 10 MB of `chrome.storage.local` that the history shares: the photo is no longer copied into a change event for every open page whenever it is written, and no longer read again by every backup and daily clean-up. A photo from an earlier version is moved the first time it is needed (nothing is lost, tested in a real browser).

### Instant blocking (optional, Chrome)
- **Settings → Blocking → Instant blocking.** Until now the pause page was put up by the worker after the navigation had started, so one request still left for the site in those 15–40 ms. With this switched on the browser itself (declarativeNetRequest) sends a distracting tab to the pause page before any request is made: a real server counted **1 request without it, 0 with it** (`scripts-dev/e2e/instant.cjs`). Off by default; it needs access to websites, asked for at the click and given back when it is switched off (unless the Dock uses it); the new permission `declarativeNetRequestWithHostAccess` shows no install warning and cannot read anything.
- The rules are made from the same decision the blocker makes (`shared/dnr.js`), for lists, the work hours, sessions and passes, and are rebuilt when any of those change (and by an alarm at the minute the next one ends). The one property that must hold, that a rule never sends a page where the blocker would let it through (the page would be sent back and forth), is checked on 400 random setups (`dnr.test.mjs`) and in a real browser against a deliberately stale rule. Limits and the budget (they depend on usage) and "only my sites" stay with the tab blocker, which also remains the net for everything the rules miss.

### Encrypted sync (optional)
- **Settings → Data & privacy → Sync → Encrypt synced data with a passphrase.** The settings and the task list are compressed and sealed (AES-256-GCM, key from the passphrase by PBKDF2) on the device before they go to the browser account's cloud, so the cloud holds only ciphertext. Each device asks for the passphrase once per browser session; until then it uploads nothing in the clear and loses nothing. A copy changed by one bit, or an old copy put back with a new time, does not open and is never overwritten; an older EyeTime stops at "written by a newer version" instead of replacing the ciphertext; changing the passphrase or switching it off on one device is followed by the others. Tested as two browsers on one cloud (`worker-syncenc.test.mjs`), as a format (`syncseal.test.mjs`) and in a real browser (`e2e/syncenc.cjs`). Details and limits: `SECURITY.md`.

### More exact
- **Tracking keeps the fractions of a second.** Flicking through tabs used to drop every stay shorter than half a second; now what does not make a whole second is carried to the next one, so a day adds up to the time that really passed (`creditSeconds`, tested over thousands of random spans).

### Safer
- **A passphrase for the sign-in details** of connected services (Settings → Data & privacy): optional; the tokens and passwords become sealed data (AES-256-GCM, key from the passphrase by PBKDF2 with 600 000 rounds), unlocked once after the browser starts. A forgotten passphrase deletes only the sealed details. `SECURITY.md` says what this does and does not protect against.
- Background work started when the worker boots (sync, calendar, connections, usage) can no longer fail unseen: a rejection goes to the local error log instead of an "Uncaught (in promise)" on the extensions page.
- Messages from pages to the worker are bounded: a "continue" lasts 1 minute to 8 hours, a tracking pause up to a day, and a malformed value is refused (`src/shared/validate.js`).
- The optional usage collector now answers only extension origins (a web page gets 403, and CORS names the extension instead of everyone), refuses an oversized body before reading it, and takes at most 1 000 new installs per hour, so a script cannot fill its database with made-up ids.
- `SECURITY.md`: how to report a problem privately, what is in and out of scope, the threat model, what is stored unencrypted and why, and how the update signing key is rotated (or replaced if stolen).

### Under the hood
- **Tests that check the tests.** Mutation testing (Stryker, `npm run mutation`) changes the logic a little and asks whether any test notices: 75 % did at first, against 97 % line coverage. Five modules were brought up with new edge tests (stats 49 → 92 %, dayplan 65 → 87 %, domains 68 → 88 %). The service worker now has tests against a strict pretend browser (tracker, breaks, focus, blocker, messages: 28 tests), and the new-tab-to-session path has one that plays a whole session and fails on any request that leaves the extension (with a control that proves the monitor sees the worker).
- **One statement for two implementations.** `conformance/schedule.json` says when a work-hours rule is running (19 110 cases); the Rust engine writes it and the extension's tests read it, so the two cannot drift apart.
- `node scripts-dev/i18n-report.mjs` hints (`scripts-dev/i18n-report.mjs`): where the machine-translated languages look wrong; a nightly run on Chrome stable, beta, dev and canary (`nightly.yml`); the visual suite in a CI-like container (`visual-docker.sh`); `docs/REPO-SIZE.md` (where the 111 MB of history is, and the two ways to lighten it).
- Tools are at fixed versions (`package-lock.json`; `npm audit` finds nothing); ESLint's rules are all errors and cover the desktop screens too; the type check covers every folder of `src/` (all but the third-party engine) with five more strict flags; unit tests have a coverage floor; parsers of what people paste or import (`.ics`, XML from a calendar server, task lists, themes, dates in words) are fuzzed with damaged input.
- CI: lint, types, coverage, `npm audit`, pinned versions of web-ext and axe-core, least-privilege tokens, CodeQL (JavaScript, Python, Rust), Dependabot.

## 3.7.0 — 2026-11-04 — The day as one story, and your other tools

### Measurement (optional, off by default)
- **Anonymous usage** (Settings → Data & privacy): once a week EyeTime can send the days it was used and how often each of its own features was, with the look, layout and language: numbers and names from a fixed list, never a site, task, note, goal or time. *Show what would be sent* shows the exact next report; switching off (or *Delete all my data*) asks the collector to forget the random id. EyeTime asks once, after a first finished session and a second day, and never again. Counting happens on the device either way; nothing leaves it unless you switch sharing on, and a build without a collector address (`src/shared/usage-config.js`) cannot send at all. The collector, its schema and the queries for activation, D1/D7/D30 retention and feature adoption are in `server/usage/`; `docs/MEASUREMENT.md` says what is measured and why, `PRIVACY.md` lists every field.

### The day as one story (Home · Today)
- **Morning**: a card asks "What matters today?": your open tasks (priorities, what is due or overdue first), up to three chosen, each with a time that fits your calendar, best hours and how long things really take you; one button starts the day (and, if you leave it on, sets a reminder at each time). "Not today" is respected: it is not asked again.
- **Work**: just the line of intent; one quiet line under it says how many of the three are done and what is next. After a session the break leads to the next of the three (its length, its name) instead of a blank line. A card never interrupts a running session.
- **Evening** (from 18:00, a setting): the same "Close the day" form as before, now on the page: the day in numbers, one win, where you left off, tomorrow's three. "In an hour" puts it away. **Closed**: one line says so, with tomorrow; "Reopen" brings it back.
- Settings → Home page → *Daily ritual* switches it off or moves the evening. The "Plan my day" dialog and the "Close the day" shortcut (`D`) work as before and write to the same record.

### Connected services (two-way sync)
- **Settings → Data & privacy → Connected services**: keep your tasks in step with **Todoist**, **Notion** and **CalDAV** reminders (iCloud, Fastmail, Nextcloud), and your calendar with **CalDAV** calendars: busy times come in (the planner and the meeting warning use them), planned focus blocks go out as events marked as EyeTime's. Things (Apple) has no way to be reached from outside the app, so it cannot be connected: export Markdown or CSV.
- Real two-way merging, not an export: each side's changes are carried over field by field against what both looked like at the last sync; an edit beats a deletion; a first connection matches tasks with the same text instead of duplicating them; a sync that would delete a large part of your tasks stops and asks first (*Allow deletions once*); *Delete in both places* can be turned off.
- Direct and private: the browser talks to the service itself (no EyeTime server); the browser asks for that service's address only, and it is withdrawn when you disconnect. Tokens and passwords stay on the device, outside backups and settings sync.
- Runs every 15 minutes in the background and shortly after you change a task; *Sync now*, a status on every row, a refused sign-in pauses the connection and asks to sign in again, a service that asks to slow down is left alone for as long as it asks.
- **Google and Microsoft are prepared but not offered yet**: they need OAuth clients registered once by the team (`docs/CONNECTIONS.md`); the code is in, the choice is not shown and the extra `identity` permission is not requested until then. The adapters are tested against mocks of each service, not yet against live accounts: `docs/CONNECTIONS.md` has the checklist.

### Settings
- **Essentials / All settings**: Settings opens on the essentials (about 40 rows instead of 86); the switch is under the search box and the choice is remembered. Anything you have already changed or use (a dock, reminders, a calendar subscription, sync) stays visible; search and *All settings* show everything; each section says how many are hidden.
- **Make it calm again** (Settings → Appearance, and Customize on Home): back to the designed look in one tap: the daily photograph under Today, the Calm look, standard type and shape. Your light/dark choice, tasks, links, widgets and history stay, and there is an Undo.

### Under the hood
- Home (`newtab.js`, 420 lines) is split into `src/newtab/home/*` (hero, background, blocks, parts, nudges, drawer, shortcuts, palette) and the focus card into `src/ui/focus-card/*`; switching between Today and the other arrangements happens in place.
- The end-to-end suites run in parallel and in five balanced CI shards (`scripts-dev/e2e/run.mjs`, `suites.json`): a retried pass is reported as flaky, one stable `e2e-ok` check for the branch rules. A unit test fails when a new test script is not listed.
- A research kit for watching people use EyeTime (`docs/research/`, `scripts-dev/research/`): protocol, consent, screener, observation sheet, analysis rules, a clean-profile session launcher and a summary with the SUS score.

## 3.5.0 — 2026-11-02 — A calmer EyeTime

A new look for the whole app, and a new Home built around one idea: a photo, the time and one line.

### New: Home · Today
- **A wallpaper that changes every day**: 14 colour photographs ship with EyeTime (public domain, credits in `docs/PHOTO-CREDITS.md`), a soft veil and a touch of film grain keep white type readable on every one (checked by `scripts-dev/e2e/wall-contrast.cjs`). *Another photo* is one click away; or pick one, or use your own.
- **One line of intent**: type what you focus on and press Enter — the session starts. The length is a small pill, today's priorities appear as one-click hints. While a session runs the clock becomes the countdown with a thin progress line; pause, +5 min and end show on hover.
- **Quiet corners**: today's focus against your goal (top left), the next eye break (top right), the photo's name and credit (bottom left), four small icons (bottom right).
- **Tasks, habits, notes and links** open in a glass panel (the list icon or `N`). The first-run list, the *What's new* card and the evening "close the day" nudge show as quiet glass under the line.
- Existing profiles move from the old default arrangement to Today once, on update; any arrangement you chose (split, minimal, your own canvas) stays. Customize → Layout → *Centered* brings the old Home back.

### Changed: the look of everything
- **Calm is redrawn**: bone paper and soft ink, one lime signal for "now", a serif voice (Instrument Serif; Cyrillic falls back to Cormorant), pill buttons and tabs, tonal inputs, a floating customize sheet. A new mark and toolbar icons. Dark mode is near-black with the same lime.
- The **pause page, the eye break and onboarding** show the photo of the day behind a veil (the eye break stays dim so it still rests the eyes). Insights, Settings and the popup keep the light paper, where tables and charts read best.
- The dock, the short-video guard card and the toolbar badge follow the new accent.
- Other looks are untouched; their accent is the new "signal".

### Fixed
- Settings no longer overflows at 400 px / 125 % zoom; the header fits in every language.
- `npm run types` is clean again (Date arithmetic and two tuple casts in the widgets and the scene formulas).

### Also in this release
The work that was waiting for a release: the Home editor, widgets, the scene engine, photo themes, quotes, weather, the night clock, and five new looks. Details below.

### Also in this release: Home becomes yours

### New: arrange Home
- **Free-form Home editor** (Customize → Arrange Home): drag every block, pull any corner or side to resize, stretch the clock any way you like, snapping guides, undo/redo (Ctrl/⌘ Z), keyboard moves. It opens on exactly what the page already shows.
- **A strip for the selected block**: exact position and size, align to the screen, bring to front / send to back, duplicate, remove. A short guide the first time, a shortcut list on `?`, a tidier toolbar with a *More* menu.
- **Type designer** for the clock and greeting: fonts (now also Antonio, Cormorant, a handwriting face), weight, spacing, opacity, solid / gradient / outline / **glass** (a soft copy of your photo through the digits) / **photo** fills, glow, shadow.
- **46 widgets in seven groups** (time, focus, stats, tasks & notes, calendar, body & mind, style), each at three ready sizes (S, M, L) and built to look right at all of them: a clock (analog, flip, digital, any time zone), date, moon phase, sunrise and sunset, year, timer; focus now, daily-goal ring, streak, focus map, best hours, today's sessions, screen time, top sites, distractions, today vs yesterday; to-do (tick and add right on Home), habit, counter, month, agenda, week strip; breathing (box, calm, 4-7-8), water, mood, focus sound; quote, text label, photo frame, glow orb, quick links; plus the older fifteen. A gallery with categories and a size switch.
- **Card styles** — glass, **liquid glass** (the card bends the picture behind it; Chromium, plain glass elsewhere), solid, outline, bare, neon, paper, tint: one for the whole theme and, if you like, its own for any widget; ready styles first, sliders under *Fine-tune*.
- **Glass** (five) and **Editorial** (six): photo themes in the spirit of phone lock screens. Real photographs ship with EyeTime and the clock sits *between* the photo and its foreground — behind the peak, the branches, the cliff. *Glass*: big, slightly stretched digits of frosted glass (clear on a dark photo, smoked on a light one) and a row of glass cards under them — goal ring, streak, a *Focus* pill that becomes the time left. *Editorial*: a tall hairline clock, today's tasks as numbered lines (click to tick off), a handwritten word, a small mark and a *Focus* countdown. The clock is 24-hour in these themes; the app's own look stays as you set it. The photos also appear in *Background → Photos*; credits in docs/PHOTO-CREDITS.md.
- **Scene engine**: backgrounds and widgets are data, not code. A small formula language (no eval, no loops, strictly validated) can read the time, daylight, mouse, focus session, daily goal, tasks and week, and drive shapes, text, rings, bars, charts, lists and particles; a custom widget sits on Home like any other. This is what the Mono themes and their widgets are written in, and the base for sharing styles later.
- **Layouts** that switch by focus session or hour, pinning, and **theme files** (save / load a whole look; hostile files are refused).
- **Backgrounds in the editor**, text colour on photos (Auto / white / black), layers in front of the clock, and **subject cut-out** (a local model).
- **3D photo**: a depth map is made on your device from one photo (Depth Anything V2 Small, Apache-2.0, 27 MB, bundled) and the photo is drawn with WebGL so near things slide more than far ones with the mouse. Optional: the clock goes behind the nearest part. Falls back to the flat photo without WebGL.

### New: calm extras
- **Night clock** (StandBy): after quiet minutes Home turns into a huge dim clock on black that drifts so the screen is never marked.
- **Optional weather** (off until you turn it on): Open-Meteo forecast for a city you pick (only rounded coordinates are sent), a weather widget, and **rain on glass / snow** over your photo. Still with reduced motion.
- **Quotes**: 33 short quotes, each language written natively (not translated), on Home, the pause page, the break screen and before a session.
- **Pause a focus session** for up to 15 minutes from the popup, the menu or the palette.
- **Unknown sites** (experimental, off by default): Chrome's own on-device model sorts busy sites that are in no list, from address and title only. Reports only; it never blocks, and your choice wins.
- A **Home** section in Settings (Home page, weather, quotes, night clock).

### Fixed
- Two independent test reports: honest pause hint, a forgotten pause resumes quietly or ends the session, a damaged schema stamp is repaired, backups without a stamp keep settings and the calendar, notes obey their cap, the Home page follows the on/off switch in other tabs, and more.
- The editor used to open with the clock and greeting far bigger than on the page; it now opens at the size of their words.

### Also in this release: five new looks

Five new looks, each designed as a whole (Settings → Appearance, first in the gallery).

### New
- **Obsidian** — true black glass with a warm ember glow, a hairline of light on every card, a thin clock that glows.
- **Void** — type and hairlines only: no filled cards, a white pill for the one main action, one-pixel rules.
- **Noir** — ivory serif on black (or ink on ivory by day), tracked small caps, champagne details and a watch-dial timer with 60 ticks.
- **Pearl** — airy frosted glass over soft pastel light, pill controls, a gradient main button.
- **Bento** — soft colour tiles (peach, mint, lilac, sky, butter), rounded type, chunky progress bars.
- Every look comes in light and dark, covers Home, the popup, Insights, Settings, onboarding, the pause and break pages, and is contrast-checked like the others. The look gallery previews now show each look's own character.

### Changed
- Choosing a look also takes its own Home background (Calm still paints Dawn; the others use their page colour). Your explicit background choices are kept.

## 3.4.0 — 2026-10-24

### New
- **Turn on the dock from Home**: the *What's new* card now has a *Turn on the dock* button, so the edge tab is one click away (it is still opt-in and asks the browser for access to websites first).

### Changed
- **Styled dropdowns everywhere**: the browser's grey system lists are gone. Every choice list (settings, the focus mode in the popup, the topic in the dock, language at first run, site types in Insights) is now one dropdown that follows the look and dark mode, opens above or below as there is room, and works from the keyboard (arrows, Home/End, type to jump, Enter, Esc).
- **A calmer popup**: the focus card is a hero with a soft wash of the accent, the options sit in quiet tray controls, the start button has depth, and the timer ring glows without being clipped. Same colours and shapes as your look.
- **Dawn is the default Home background** for new installs (soft peach-to-lilac gradient). Existing choices are kept.

## 3.3.1 — 2026-10-24

The dock gets its final look.

### New
- **Three looks for the open panel** — pick in Settings → General → Dock → *Panel style*: **Glass** (default: pure black with a warm glow, soft cards, a bold orange ring), **Void** (quiet typography on black, hairlines, no boxes) and **Noir** (ivory serif on black, a watch-dial timer with 60 ticks). The change reaches an open panel at once.

### Changed
- The panel and the edge tab are now true OLED black, in the same style as each other (the panel used to be dark navy). The idle tab is smaller and calmer: a slim bar that lights up orange while a focus session runs.
- New store screenshots of the dock.

## 3.3.0 — 2026-10-24

The dock: EyeTime next to every page.

### New
- **The dock** (opt-in: Settings → General → Dock). A small black tab grows out of the window edge on web pages, with soft curves like a phone's notch; hover and it widens into three live rings — today's focus (or the running session), tasks done today, and learning progress. A click opens a side panel in a macOS-like style: **Now** (the focus timer, today's tasks and a quick add), **Learn** and **Thoughts**. Drag the tab along the edge, put it on either side, hide it on chosen sites, or toggle it with `Alt+Shift+D`. It asks the browser for access to websites only when you turn it on; the page script reads nothing from pages.
- **Learning topics**: make a topic for what you want to learn, save the current page into it with one press (or *Save to EyeTime topic* in the right-click menu, also for links), mark each link *to do / in progress / done*, add notes, and see how much time you really spent on the topic's sites in the last 30 days. Export as Markdown (Settings → Data & privacy). Topics are in the backup file.

## 3.2.0 — 2026-10-23

Tasks that follow you, room to breathe, and the Chinese and Japanese you can type dates in.

### New
- **Sync tasks between browsers** (opt-in, Settings → Data & privacy → *Sync tasks too*): open tasks and ones finished in the last three days travel through the browser's own sync, merged without losing anything (a task deleted or edited on one side is told apart from a new one; an empty or unreadable cloud copy never deletes tasks here). Habits, notes and history never sync.
- **Storage meter and *Free up space*** in Settings → Data & privacy: see how much of the browser's 10 MB your history takes; one click drops the hour-by-hour detail of days older than 30 days (totals, sessions and tasks stay). EyeTime also tells you once a week when you pass 80 %.
- **Dates and repeats in Chinese and Japanese** in quick add: `报告 明天 14:30`, `周五前交报告`, `拉伸 每天`, `レポート 明日までに`, `来週の金曜日`, `ストレッチ 毎日`.

### Fixed
- Italian and Polish no longer call both tabs and cards "schede" / "karty" (cards are now *riquadri* / *kafelki*).
- Review fixes carried from 3.1: unsubscribing from a calendar cannot be undone by a download that finishes at the same moment; a calendar file imported in 3.0 is kept; multi-day all-day events written with `DURATION`; a meeting moved later the same day warns again; "every Monday" in Italian, Polish and Ukrainian is a repeat, not a date; "1 год" in Russian is not an estimate of one hour.

### Developer
- The visual baseline is rendered by the CI machine (its text anti-aliasing differs from other machines); the test waits until the layout stops moving.

## 3.1.0 — 2026-10-22

Five new languages, a calendar that understands your meetings, and a pass on accessibility.

### New
- **Five new languages:** Italiano, Polski, Українська, 简体中文 and 日本語 (eleven in total), with store texts and localized screenshots. Dates in plain words and repeat words (`domani`, `jutro`, `завтра`, `ogni giorno`, `codziennie`, `щодня`…) work in Italian, Polish and Ukrainian. The texts are machine-translated: native-speaker corrections are welcome (issues labelled `translation`).
- **Up to three calendars** by link, merged into one list; each can be removed on its own. A file import still works alongside.
- **All-day events** (a conference day, a trip) mark a busy day: *Plan my day* then puts at most two focus blocks into it, and the focus card says so.
- **A warning before a meeting** (a notification two minutes ahead, on by default; Settings → Data & privacy) and an optional **quiet mode during meetings** that holds back eye-break notices and the focus chime while a meeting is on.
- **Accessibility:** a keyboard-only test of every screen (every stop has a name and a visible focus mark, dialogs close with Escape), a **more-contrast** look that follows the system setting (full-strength secondary text, strong borders, a thicker focus ring), support for **forced colours** (Windows High Contrast), and a check that reduced motion stops every endless animation.

### Fixed
- Polish letters (ł, ś, ż, ą, ę…) were drawn in a fallback font: the bundled fonts now include Latin Extended.
- The *productive / neutral / distracting* legend on Home broke long words in narrow cards.
- The previous week's plan is kept for the Monday digest and the share card, so a plan written on Sunday night is not lost.
- The Ukrainian browser language no longer falls back to Russian.

### Developer
- Type check now covers the screens (`ui`, `newtab`, `options`, `insights`, `popup`), not only the shared code and the worker.
- Visual regression covers 7 screens × 4 languages × light/dark and is a blocking CI step; keyboard, calendar and load checks run in CI; CI runs on Node 22.

## 3.0.0 — 2026-10-21

Plan with your own words, see where focus goes, reach people in their language.

### New
- **Calendar by link.** Paste your calendar's secret iCal address (Google, Outlook…; links that redirect to another site are refused with a clear message) in Settings → Data & privacy and EyeTime refreshes it every hour, straight from your browser; the next meeting shows on the focus card. The browser asks for access to the one site that hosts the calendar; unsubscribing, resetting or restoring a backup withdraws it. Nothing is followed to other sites, at most one download runs at a time, and a failing link is retried at most every 30 minutes. The address stays on the device: never synced, never in a backup. Importing a file still works.
- **Dates in plain words** in quick add, in six languages: `Report tomorrow 14:30 45m !`, `Call on Friday`, `Pay rent in 3 days`, `Plan next week`, `Отчёт завтра`, `Informe el lunes`, `Bericht morgen`, `Rapport demain`, `Relatório amanhã`. A task with a date gets a due chip and stays out of today's plan. Repeat words ("every day", "cada día", "jeden Tag", "chaque jour", "todo dia"…) work in all six languages too.
- **Focus time by project.** The first `#tag` of the task you focus on becomes the session's project; Insights → Focus shows time per project with the change against the previous period.
- **Tasks in and out:** export as a Markdown checklist or CSV; import from Markdown, CSV or a plain list (each line understands quick-add words); duplicates are skipped and you confirm first.
- **Forgive one missed day a week** for the goal streak (on by default; Settings → Focus).
- **"What's new"** card after an update that brings new features (never after a small fix, never on first install).
- **Suggest an idea** button next to *Report a problem*; GitHub templates for ideas and translation fixes.
- The **Monday digest** also tells how many weekly goals you reached and where most focus went.
- The language picker in onboarding is a drop-down (six languages no longer fit in a row).

### For the stores
- Descriptions for the Chrome / Edge / Firefox listings in all six languages and localized screenshots for each (`store/listing/`, `store/screenshots/<lang>/`); Edge submission steps; the permission texts explain the new optional address permission.

### Under the hood
- **Tests:** visual regression of the main screens (English, Russian, German · light and dark), a load check (a year of dense data and 60 open tabs: Home opens in 0.4 s), an end-to-end test of the calendar subscription with a local server (no cookies, errors keep old events, unsubscribe cleans up, the address never reaches a backup), date-word and import/export unit tests in all languages.
- **Types:** `npm run types` checks `src/shared` and `src/background` with TypeScript from JSDoc comments (zero errors, in CI).
- The two biggest files were split (`modules.js` → one file per Home module; `sections.js` → data and about sections); the interface is pixel-identical (the visual test proves it).

### Fixed — found by an independent review before release
- Calendar subscription: a failing link is retried at most every 30 minutes (not on every worker wake-up), one download at a time, the hourly alarm is no longer pushed back by wake-ups, a download that finishes after *Unsubscribe* can no longer bring the address back, redirects to other sites are refused, the response size is limited while reading; *Reset* and *Restore backup* now withdraw the browser permission too.
- Date words: "среда" (environment), German "jeden Morgen", "every monday" (a repeat), "no friday meetings", dates in the past and "this friday" on a Friday behave sensibly; Portuguese "no sábado" works.
- Task import: quoted CSV headers, invalid dates/times, "Completed" status, re-importing an export no longer duplicates finished tasks and finished tasks no longer count as "done today"; files over 2 MB are refused.
- Home: deleting a task could remove a different one after another tab or a focus session changed the list; plural forms in the new messages ("1 task", "1 event"); one Settings listener instead of one per redraw.
- Seed data for store screenshots (empty Habits card, first-run checklist in the picture).

## 2.8.0 — 2026-10-21

Four new languages, calendar and planning fixes, a demo video.

### New
- **Spanish, German, French and Portuguese** — the whole interface plus the store texts (machine-translated and reviewed; corrections are welcome, see `docs/TRANSLATING.md`). Quick add understands "every day / jeden Tag / cada día / chaque jour / todo dia" and the weekday and weekly forms in these languages too.
- **A 30-second demo** (`store/demo.mp4`, `demo.gif`) on the project page and in the README, recorded by a script (`scripts-dev/e2e/demo.cjs`) so it can be refreshed with every release.
- The language picker in onboarding is a drop-down (six languages no longer fit in a row).

### Fixed — found by an independent code review
- **Calendar import** handles real-world files: weekly series that started more than two years ago, "3rd Tuesday of the month", every-other-week on given days, yearly events, date-only end and exception dates, moved and cancelled meetings (no ghost copies), reminders no longer replace an event's title, and times stay right across clock changes and for UTC or other-time-zone series.
- **"Clear completed" no longer deletes recurring tasks.** A recurring task you did not finish keeps today's reminder. The words *daily*, *weekly*, *weekdays* inside a sentence ("Prepare weekly report") are no longer taken as a repeat rule. Recurring tasks come back right after midnight, not hours later.
- **Plan my day** leaves tasks you booked for another day alone, no longer returns an empty plan when your best hour is late in the evening, uses the work-day end only when the work schedule is on, and says so when everything is already scheduled.
- Estimate accuracy no longer counts a recurring task twice; weekly goals and the estimate history are kept when you restore a backup; the week on the share card is the week the goals belong to.
- *What pulls you* no longer says "mostly between … " and "spread through the day" at once.

### Fixed — narrow windows and long translations
- Buttons may wrap their label in narrow windows instead of overflowing; the calendar button row and module headers no longer overflow; every language is checked at 400 px / 125 % zoom in the test suite.
- Wording and clipped labels corrected in all four new languages (share column header, search field, if-then plans, KPI tiles…); dates in the calendar status follow the app language; four screen-reader labels were English-only.

### Fixed — releases
- The Release workflow failed on a clean checkout (the project-page images are generated); the check now builds them first. Versions 2.6.0 and 2.7.0 were never published as GitHub releases — their changes are all in this one.

## 2.7.0 — 2026-10-21

Planning the day and the week.

### New
- **Plan my day** (Home → Tasks): pick how much time you really have today and EyeTime fits your tasks into it, using your own estimate history, and shows what does not fit.
- **Recurring tasks**: type `every day`, `weekdays` or `every week` in quick add (also in Russian). A finished recurring task reappears on its next day by itself.
- **Weekly outcomes**: a small strip on Home with your 1–3 goals for the week; the weekly review and the shareable card report how many you reached.
- **Calendar import (.ics)** in Settings → Data & privacy: EyeTime shows your next meeting on the focus card, warns when a session would overlap it and offers a session that ends right before it. The file is read locally; only the next 14 days are kept.
- **What pulls you** (Insights → Sites): when you are usually drawn to a distracting site, how long it takes you, and a one-tap daily limit.

### Fixed
- The preview chips under the quick-add field had no styling; they now look like the task chips.

### Tested
- New unit tests for planning, weeks, calendar parsing and trigger analysis; end-to-end checks for the new dialogs and cards in the upgrade crawl.

## 2.6.0 — 2026-10-21

Reliability and support.

### New
- **Report a problem** (Settings → About): builds a short diagnostic text — versions, setting switches, counts and the last errors — that you can read, copy and attach to a GitHub issue, or open a prefilled issue. Nothing is sent automatically and it contains no sites, tasks or notes. A small local log keeps the last 20 errors (no page addresses).
- **Backup reminder** on Home for people with real history: after 30 days without a backup file EyeTime suggests saving one (snoozable for 14 days).
- **Project page and privacy policy** site (published from `site/` via GitHub Pages) and ready-to-paste store listing, permission justifications and a step-by-step publishing checklist (`store/`).

### Tested
- New end-to-end scenarios for what real browsing does: a second window, same-page navigation, the browser stopping the service worker, a session that ended while the browser was closed, a pass shared between tabs. Upgrade tests now start from v2.1.0, v2.2.0 and v2.5.3 settings. All run in CI.

## 2.5.3 — 2026-10-21

From real-world use.

### Fixed
- **A second pause page after "Continue"** on short links (e.g. `youtu.be` → `youtube.com`): the pass covered only the first site, the redirect target was a different rule domain. A "Continue" now also opens a 30-second window for the redirect chain that follows (never for always-blocked sites or strict sessions). Covered by an end-to-end test that fails without the fix.
- **Cut-off tooltips** on the icons in the top corner of Home and in the popup header: they now open downwards and stay inside the window.

### Changed
- **Ambient focus sounds are now real recordings.** The synthesised rain and café were replaced: *Rain*, *River* and *Forest* are seamless loops cut from CC0 field recordings (credits in `src/audio/CREDITS.txt`), *Brown noise* stays synthesised. The old *Café* choice becomes *Rain* automatically.

## 2.5.2 — 2026-10-20

Fixes from a second independent review.

- CI: the accessibility step could not run (a second `npm i --no-save` removed Playwright); both are now installed together.
- *Get started → Add a task* works when the cards are hidden (minimal layout) or the Tasks card is off (opens the palette); the checklist sits in the right place in the split layout and stops repainting on every tracker write.
- Storage thinning near the quota looks only at day records, never runs in Firefox (no 10 MB cap there) and can't throw on a thinned day.
- Journal: desktop-app time is included in totals like in Insights; day headings carry the year.
- Sounds start even if the audio context was created suspended (Firefox event page).

## 2.5.1 — 2026-10-20

### Fixed
- Completed *Get started* steps keep full text contrast (caught by the axe check, which now runs on every change).

## 2.5.0 — 2026-10-20

### New
- **Get started** checklist on Home for new profiles: a first 5-minute session, marking what distracts you, writing a task, trying the command palette. Steps tick themselves from real use; it disappears when done, when dismissed, or after three weeks.
- **Journal export** (Settings → Data & privacy): your last 90 days as a readable Markdown file — focus time, screen time, distraction share, sessions with goals and ratings, and your "went well" line. No site names. Handy for any notes app.
- A note turned into a task keeps its time, length and priority (`Call Anna 16:45 30m !`).

### Fixed
- Home *Notes*: a note added from another page (popup, pause page) is no longer overwritten by a stale list while the field is focused.

## 2.4.0 — 2026-10-20

Accessibility, resilience and Firefox.

### Accessibility
- Automated **axe-core audit** of every page and state (running session, review, break, block pages, palette, dialogs) in a light and a dark look, English and Russian — now 0 violations and enforced in CI.
- Fixed: the progress bar of the daily goal has a name; the custom-accent swatch no longer misuses `aria-pressed`; the search button's accessible name contains its visible text; real heading structure (`h1` on Settings and in the popup, card titles at level 2); the sidebar is a landmark; empty table header made readable.

### Resilience
- Very heavy browsing could approach the browser's 10 MB storage limit over 400 days. Past 8 MB the hourly breakdown of days older than 120 days is dropped first (totals, sessions and the calendar stay). Measured: a profile with 400 days × 40 sites × 12 hours uses 5 MB; Home opens in ~220 ms and Insights in ~300 ms with 300 tasks.

### Firefox
- Sounds (session start/end chime and ambient noise) now work in Firefox too: its background is an event page with Web Audio, so the same synthesis code runs there directly. The Firefox package passes `web-ext lint` with no errors (CI-checked).

## 2.3.2 — 2026-10-20

### Fixed
- **Narrow screens and large text**: Settings no longer scroll sideways with long site names (chips shorten with an ellipsis, input rows wrap), the Home reminder pill wraps, the *Privacy* buttons wrap, look previews stay inside their cards. A new CI check opens 17 pages at 400 px with 125 % text and very long names in English and Russian and fails on any horizontal scroll.
- *Close the day* dialog fades its scrolling list above the buttons; the shortcuts list has an aligned key column; the evening nudge no longer shows a stray ". ·".
- Refreshed store screenshots (with realistic hourly data) plus new ones: command palette, day timeline, *My week* card.

## 2.3.1 — 2026-10-20

Hardening release after an independent code review and a new upgrade/empty-profile regression crawl (now part of CI).

### Fixed
- **Clock format was inverted**: choosing *24-hour* showed 12-hour times and vice versa (Home clock, schedules, timeline, block pages). Now correct.
- **Settings sync**: a freshly installed browser adopts your cloud settings on first sync instead of overwriting them with its defaults; starting a focus session no longer counts as an edit (so a stale browser can't overwrite real changes); the companion token is never synced; pulled settings take effect immediately (alarms, menus, reminders); the cloud copy is written before old chunks are removed; newer-format data is never overwritten; emoji can't be split across chunks.
- **Quick-add** no longer reads decimals or versions (`12.50`, `chapter 10.15`) as a time; a dot counts only with am/pm or `@`/`at`/`в`.
- A task added from the command palette can no longer be lost by the Home task field; **Ctrl+K works on a Russian keyboard layout**.
- Estimate accuracy shows the latest tasks and keeps finished tasks after *Clear completed*.
- Task-time notifications start the session with the task's planned length; custom focus modes without a name show a neutral label; the toolbar badge updates after **+5 min**; a mode's ambient sound survives a browser restart.
- Empty Focus tab no longer logs a missing-icon error; "Remind me at your best hour" handles a full reminder list and midnight neighbours; timeline summary hidden on days without hourly data; settings search count clears; no listener pile-up on the Data page.

## 2.3.0 — 2026-10-20

A second exhaustive audit (every screen × state × width × language × look, with an automatic horizontal-overflow report) and a round of new features.

### New
- **Command palette** — `Ctrl/Cmd + K` on Home, Insights and Settings: start a focus mode, focus on a task, take an eye break, pause tracking, jump to any Insights tab or Settings section, switch look or theme, close the day. Type anything and press Enter to add it as a task.
- **Quick-add tasks** — write `Report 14:30 45m ! #work` and EyeTime takes out the time (schedules the start reminder), planned length, priority and tags, with a live preview while you type. Starting a focus session on a task uses its planned length.
- **Estimate accuracy** (Insights → Focus) — planned vs. actual focus time on finished tasks, with a plain verdict on the planning fallacy, plus a "took X, planned Y" toast when you tick a task off.
- **Day timeline** (Insights → Patterns) — one day hour by hour with your focus sessions on a lane underneath; step back through the last weeks.
- **My week card** — turn the weekly review into a shareable PNG (totals only: no site names or task titles). Download or copy.
- **Sync settings across browsers** (Settings → Data & privacy, off by default) — looks, focus modes and preferences via your browser's own sync. Tasks, notes and history never sync.
- **+5 min** on a running session; **Save / Skip** on the session review (rating is optional); **5 more minutes** on the eye-break page.

### Fixed and polished
- Insights: tables become stacked rows on phones, no horizontal scroll in any tab, scope captions on every Focus card, no future hours on today's chart, weekly review no longer says "balanced" while distractions are rising, calendar redesigned (weekday labels, quantile scale, untracked days).
- Popup: a pending review replaces the start form so everything fits 600 px; paused-tracking banner with a clear *Resume*; one capture field instead of two.
- Home: split-layout clock no longer wraps, notes grow instead of showing a resize handle, no duplicate "goal reached" message.
- Block pages: long hostnames, a helpful invalid-link page, goal and *remaining* labels, schedule end time in your clock format, *Allow {site}* wording.
- Onboarding: stable layout, an *Add* button for custom sites, editable work hours, localized goal labels.
- Narrow settings header and Insights header no longer overflow at large text scales.

## 2.2.0 — 2026-10-19

A full pass over every screen, found by auditing each surface in light/dark, English/Russian and at several widths.

### Interface polish
- **Home**: an aligned bento grid (rows share one height) replaces the ragged masonry; task rows give the title the full width with actions on hover; designed empty states; keyboard shortcuts (`f` focus goal, `n` task, `d` close the day, `c` customize, `i`/`s` Insights/Settings, `?` help).
- **Popup** now fits Chromium's 600 px limit in every state (was up to ~980 px): side-by-side running card, one-line Today, break chip in the header.
- **Insights** split into **Overview / Focus / Sites & apps / Patterns** tabs; the Focus tab is a proper card grid with labelled charts; larger calendar heatmap.
- **Settings**: search box (press `/`), clearer group headings, layout fixes.
- **Onboarding** gained *Make it yours* (live look picker) and a daily-goal choice.
- Tooling: `scripts-dev/e2e/audit.cjs` (screenshots of every surface/state) and `contrast-sweep.cjs` (rendered contrast on every page × look × scheme).


## 2.1.0 — 2026-10-19

### Make it yours — customisation
- **Eleven looks** (Calm, Paper, Midnight, Terminal, Sakura, Forest, Aurora, Mono, Sunset, Nord, Ocean), each with light and dark schemes and its own typography, corners, card style and shadows. Live split light/dark previews in **Settings → Appearance**.
- Colour mode **System / Light / Dark / Schedule**; accent = look colour, ten presets or **any custom colour** — contrast is enforced automatically (tested for every combination).
- Fonts (Inter, Manrope, Nunito, Source Serif, JetBrains Mono, System), interface size 90–125 %, corner style, density, card style, reduce motion.
- **Home**: 17 backdrops, 7 clock styles, 3 layouts, reorderable cards. Custom CSS (sanitised), copy/import a look as JSON, reset. See [docs/THEMES.md](docs/THEMES.md).
- Settings schema v3 (old `theme` / `accent` migrate automatically; v2 backups import fine).

### Productivity
- **Daily focus goal** with progress bar and goal streak; **session log** with a quick "how did it go?" rating after each session.
- **Task-linked focus**: pick a task (priorities first) or press ▶ on a task; time is added to the task, and you can tick it off right after.
- **Today's priorities**: star up to three tasks; Home nudges you to plan in the morning, review in the evening and celebrates a reached goal. "Not feeling it? Just 5 minutes" lowers the bar to start.
- **Only my sites** focus scope: closes everything except productive sites and your allow-list (per session or by default), with *Add to my sites* on the block page.
- **Long break** after every Nth session; **focus reminders** (time + weekdays + length, one click to start).
- **Intent on the pause page** (for work / break / autopilot / bored) — turning back is counted and celebrated.
- **Insights → Focus & productivity**: goal days, streak, average session, quality, **your best focus hours**, time by task, recent sessions, pause-page choices.
- New: `src/shared/productivity.js` (pure, tested), 33 unit tests, 55-step e2e.

### Research-driven focus (see [docs/RESEARCH.md](docs/RESEARCH.md))
- **Close the day**: a two-minute evening ritual — one win, "where did you leave off?" notes, and up to three priorities for tomorrow (applied automatically next morning).
- **If-then plans** on the pause page ("If I want to open reddit.com, then I will …") and **Park it for later**; **park a thought** while a session runs.
- **Ready-to-resume notes** per task, shown when you pick the task again; tasks can be **scheduled for a time** (notification starts the session).
- **Your own best session length**, learned from your ratings; goal **days off** don't break the streak.
- **Break ideas** (stand, look far, water, breathe) instead of a bare countdown; optional **ambient sound** (brown noise, rain, café) while focusing.
- Insights: site switches per hour, what pulls you away, weekday pattern, wins, best session length.
- 10 more e2e checks (65 total), 37 unit tests.

### Also in 2.1.0

- **Break timer after a session** (Pomodoro-style): a rest countdown starts automatically, distracting sites stay open, popup/Home show a Break card with *Start next session* / *Skip*; badge turns green; configurable (off / 3 / 5 / 10 / 15 min).
- **Weekly review** on Insights (7-day range) with one actionable suggestion — e.g. *Set a 30 min/day limit for youtube.com* in one click, with Undo.
- **Right-click menu**: mark the current site as productive / neutral / distracting, toggle always-block, start/stop focus. (New permission: `contextMenus`.)
- Countdown in the Home tab title while a session runs; focus-trapped, labelled customise drawer; `role=timer` on the ring.
- Firefox/AMO: icons are built with `createElementNS` (no `innerHTML`); `web-ext lint` reports 0 errors.
- Store promo images in `store/promo/`.

## 2.0.0 — the redesign

A ground-up rebuild around one clear job: **start focusing in one click, understand your time honestly, look after your eyes.** See [docs/PRODUCT.md](docs/PRODUCT.md) for the audit and reasoning.

### New
- Calm, accessible design system with real light and dark themes, six accent colours, bundled Inter (Latin + Cyrillic) and Lucide icons.
- **Popup**: focus control, current-site card (classify in one tap, always-block, daily-limit meter), today's summary, quick note, pause tracking.
- **Home (new tab)**: clock, focus card, today, tasks, habits with streaks, notes, quick links, gradient/photo backgrounds, customise drawer; can be switched off.
- **Insights**: KPI row with deltas, stacked charts by day and hour, calendar heatmap, typical day, site table with one-tap re-classification, plain-language highlights, table view, CSV export.
- **Block page**: breathing pause, honest reason, live countdown, automatic release when the reason ends.
- **Eye care**: 20-20-20 counted in active screen time, guided break page, natural-break detection, bedtime nudge.
- **Strict focus** (per session), daily limits for any site, work-hours schedule, short-video guard, YouTube feed controls.
- 4-step onboarding; English and Russian, key-based i18n.

### Changed
- Event-driven service worker (no timers), per-day storage, serialised writes.
- No content script on every page and no all-sites permission; blocking uses `webNavigation` + `tabs`.
- Desktop companion rewritten: read-only, token-protected, no CORS, no window/process/registry actions.
- Automatic, tested migration of all 1.x data.

### Removed
- Widget builder (29 widgets), TickTick integration, Endel integration, "Nuclear mode", math/typing challenges, the Windows daemon's browser/incognito closing and its desktop web app. Reasons in PRODUCT.md.

### Security & privacy fixes
- The 1.x desktop agent answered any website with `Access-Control-Allow-Origin: *`, exposing active-window titles and accepting unauthenticated writes, and closed other browsers by default. Both are gone.

## 1.1.0
Habit tracker, work hours, blocking presets, toolbar badge, English + Russian UI, JSON/CSV export.
