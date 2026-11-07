# Measuring EyeTime without watching anyone

Until now the product was built blind: no number said whether a new person reaches a first session, comes back after a week, or ever opens the things we spend months on.
This page says what we measure, how, what we promise, and how to read the numbers. The promise is the product, so it comes first.

## The promise

1. **Nothing leaves the device unless the person switches it on.** *Settings → Data & privacy → Share anonymous usage* is off by default. The collector address is empty in a build until the team sets it; with no address nothing can be sent even if the switch is on.
2. **The person can read the report before and after it is sent.** The same screen shows the exact JSON that would go out next (*Show what would be sent*). It is built by the same function that sends it.
3. **A report holds numbers and names from fixed lists** (`src/shared/usage-schema.js`). No site, address, title, task, note, goal, time of day, IP address or account. A unit test builds the heaviest report there could be and asserts that every string in it is a short slug from a list.
4. **The identifier is random and belongs to the sharing, not to the person.** It is 128 random bits made when sharing is switched on, never derived from anything, and replaced when it is switched off and on again. *Stop sharing* also asks the collector to forget it (`op: forget`) and deletes the local copy.
5. **The collector keeps nothing it does not need.** No IP, no headers, no logs (`server/usage/`). One report per install per six hours. The code is in this repository and a test checks that a stored row holds nothing but the report.
6. **Local counters exist whether or not anyone shares**, so the person can see their own numbers (*Show what would be sent*), and so switching sharing on later reports the true history of days since the install and not just the future. They never leave the device on their own.

## What is counted

Two things only: **on which days EyeTime was used**, and **how often each feature was used** (a counter per name in `FEATURES`).

- *Active day*: a day on which the person opened EyeTime (new tab, popup, Insights, Settings) or used any counted feature. Background tracking does not make a day active: it says nothing about the person.
- *Age*: whole local days since the install. A report says "active on ages 0, 1, 2, 5, 6", never a date or a time.
- *First use*: the age at which a feature was first used. This is what makes the activation funnel possible.
- *Counters*: per feature, the uses since the last report (a week).
- The setup: look, layout, language, light / dark / auto, browser family and operating-system family. The things we choose defaults for.
- **What stays switched on** (`fl`, a state and not a count): which optional features are on (morning ritual, dock, weather, calendar, sync and its encryption, instant blocking, schedule, limits, friction, eye reminders, bedtime, standby, companion app, …) and, in steps, how many tasks, habits and blocked sites there are (0 / 1–5 / 6–20 / 21+). A feature that people try and then switch off shows here and nowhere else.
- **How things went**, in fixed buckets and never as a time or a title: the length of a finished session (under 15 / 15–25 / 25–35 / 35–50 / 50–75 / 75+ min), a session stopped in its first five minutes, why a page was stopped (always, session, schedule, limit, budget, friction), how fast the new tab was ready (under 100 / 250 / 500 / 1000 ms / slower), whether the welcome was finished, and errors by *place* only (background, pages, blocker, sync, other; never the text).

## The questions, and the queries that answer them

All in `server/usage/queries.sql` (plain SQLite; run against D1 with `wrangler d1 execute`).

| Question | Definition | Query |
|---|---|---|
| **Activation** | An install *activates* when it **starts a focus session on the first day**; the wider measures are a first session within a week and a finished session within a week. The same for opening the new tab on the first day: the step before. | `activation` |
| **Retention D1 / D7 / D30** | Share of installs that were active **the next day (D1)**, **on any day 7–13 (D7)** or **30–36 (D30)** after the install. An install is counted only when its window has been observed (age ≥ 13 for D7, ≥ 36 for D30). A window is used instead of one exact day because EyeTime is used a few days a week, not every day. | `retention` |
| **Which features are real** | Of the installs that reported in the last four weeks, the share that used each feature at all, and how many uses in total. A feature that few use is a candidate to simplify or to cut. | `feature_adoption` |
| **What people choose** | Look, layout, language, system among active installs. Defaults that nobody keeps are a design question. | `setup` |
| **Does a session reach its end** | Finished ÷ started, the share stopped in the first five minutes, and the length of the finished ones. Decides the default length and what stopping looks like. | dashboard: *Focus sessions* |
| **Does blocking work, and is it gentle** | Why pages are stopped, and the share of pause pages that end in *Continue*. Many *Continue* means too little friction or the wrong reason. | dashboard: *Blocking* |
| **Is the new tab fast on real machines** | Histogram of the time until ready; the bucket the median and the 90th percentile fall in. Budget: 90 % of opens under 500 ms. | dashboard: *New tab speed* |
| **Does something break** | Installs with at least one error, and errors per 1000 installs by place. | dashboard: *Health* |

The queries in `queries.sql` are the quick ones for a console. **The dashboard is the reference**; where they differ, believe the dashboard. Its rules, which `scripts-dev/tests/usage-stats.test.mjs` checks against populations that can be counted by hand:

- **People who left count as not retained.** A window (D1, D7, D30, a cohort week) is counted for an install only when the calendar says the window is over and a week more has passed for the weekly report to arrive (installed at least `window + 7` days ago). Never because the install happened to keep reporting: that would drop everyone who left and flatter every figure.
- **The period scopes everything.** *Active* = a day of activity or the last report in it; the weekly counters are rounded outward to whole weeks (they are stored by week); the funnel, activation and retention follow the installs **made in the period** for as long as they have been around; the weekly chart and the cohort table always end at the end of the period (12 weeks at least, 26 at most). Default 90 days, so that the 30-day return of people who came in the period can be seen; a 7- or 28-day period has no D30 yet and says so.
- **Stayed, returned, lapsed.** A week's active installs are split into *new* (made that week), *stayed* (active the week before too), *returned* (quiet for a week or more, back now) and *lapsed* (active the week before, not now); quick ratio = (new + returned) ÷ lapsed. The last two weeks are marked incomplete (reports arrive weekly), so lapsing is overstated there.
- **DAU / MAU** is measured on 28 days that have been fully reported (ending a week ago), as the average number active per day ÷ the number active in the 28 days.
- **First-week habits** compare coming back in week 2 between people who used something in their first week and people who did not, among installs three weeks old. A link, not a cause; a group under 30 is shown but marked *not a finding*, and the unreliable rows sort last.
- **Segments** show, for each value of a setting (the six biggest, the rest as *other*), the active installs, return in week 2, a first session within a week, finish rate, active days of 28 and errors per 1000. Best and worst are marked only among segments of at least 30 installs.
- **Every figure is `k of n`**, and one that rests on fewer than 50 installs (30 sessions, 100 tab opens) is dimmed and hatched. A feature is a *candidate to cut* only with at least 50 active installs and under 5 % of them using it.
- **Comparison.** Against the period of the same length right before (not for *all time*, and not when it would end before the first install). Rates are compared in percentage points, counts in percent, and nothing is compared when either side is a small sample.

## The dashboard

`server/usage/dashboard.html`, served by the collector at `/` and drawn from `GET /v1/stats` (behind the secret `DASH_TOKEN`). One file, no library, nothing requested except its own origin; Russian and English, light and dark, usable on a phone and by keyboard.

**Ten pages**, in a side navigation (tabs on a phone) that follows the address (`#growth`, `#retention`, …); a dot beside a page means something on it needs a look:

| Page | Answers | What is on it |
|---|---|---|
| Overview | How is the product doing? | the figures that matter, a *product health* scorecard (green / amber / red against our own targets), what stands out in plain words with a link to the page, weekly active |
| Growth | Who comes, stays, returns, leaves? | weekly active, **lifecycle** (new / stayed / returned / lapsed and the *quick ratio*), new installs by week, active per day |
| Activation | Does a new person reach a first finished session? | the funnel, *when* the first session starts, the welcome, and the **first-week habits** table (what the people who stayed did that the others did not) |
| Retention | Do people come back, and how deeply? | D1 / D7 / D30, the **retention curve**, the cohort heat-map, **engagement**: days active of 28, DAU / MAU |
| Audience | Who are they? | the setup distributions, and the **segment comparison** (the same figures for each language, browser, system, version, look, layout, mode), what people keep switched on |
| Features | What is alive? | every feature with its share, uses and a weekly trend line; a click opens the feature: trend, uses by week, ever tried, time to first use, link with coming back |
| Sessions & blocking | Do sessions reach the end, why are pages stopped, are breaks taken? | length, weekly trends, reasons, continue rate, eye breaks |
| Quality | Fast, healthy, up to date? | new-tab speed and its weekly trend, errors by place and per 1000, **versions in use** with finish rate and errors per version |
| Experiments | Did a change help? | each experiment's arms side by side: installs, D1, D7, a first session in the week, finish rate, active days; a difference from the control is called significant only when chance does not explain it (p < 0.05, at least 20 per arm) |
| Method | How is each figure counted? | a glossary of every figure and how to read it |

- **Look and feel**: a quiet tracker-style shell (grey sidebar with icons, one white panel, breadcrumb and actions on top, hairlines instead of shadows, 13px type, one accent colour, light and dark). The keys **1–9** open the first nine pages in the order of the sidebar; on a phone the sidebar becomes a row of tabs.
- **Period** (one row above everything): 7 / 28 / 90 days, all time, or any two dates; **filters** narrow the whole dashboard to a segment (version, browser, system, language, look, layout, mode, and by behaviour: how much they use it, whether they ever started a session, whether they keep blocking on), and the comparison with the previous period is narrowed the same way. Period and filters are in the address, so a link opens the same view. **Compare with the previous period** is on by default.
- **Export** (the same menu on the public view): *CSV* of every figure of every page (long format `section,id,metric,label,value,k,n`, a BOM for Excel, labels in the language of the page, cells that start like a formula are neutralised), *JSON* (the collector's full answer), a *Markdown report* (file, or copied) and *print / PDF*. File names carry the period.
- **Every page says which question it answers and which people it counts** (active in the period, installs of the period, weeks of the period).
- **Public statistics**: with `PUBLIC_STATS=1` the collector also answers `GET /v1/public-stats`, and `/?public` shows it: only totals over at least 50 installs, small categories folded into "other", no cohorts, errors or versions. Below 50 it says it is still collecting.
- **Look at it before there is data**: `node scripts-dev/dashboard-preview.mjs` serves the real handler with a made-up population of 500 installs (`/?demo`); `node scripts-dev/dashboard-demo.mjs out.html` makes one self-contained file of it (the formulas run in the browser).

### What a figure is worth: intervals, chance, the north star

- **Every share carries a 95 % interval** (Wilson, which stays honest for small numbers and for 0 % and 100 %). "42 % (31–54 %)" says how much the 42 can be trusted; two intervals that overlap heavily are not two different things.
- **A change against the previous period says whether it is more than chance.** Two shares are compared with a two-proportion test; the arrow is solid only when p < 0.05 and each side has at least 20 people, otherwise it says *could be noise*. A wiggle of a few points on a few dozen installs is never news.
- **The north star: sessions finished per active week** (a finished focus session per install active that week). One number that rises when more people come back *and* when they get something done, which neither installs nor opens can show. The overview draws it by week next to its minutes estimate.
- **Events on the charts.** The owner adds a note on a day ("Release 3.8.1", "Post on Habr") from the *Event* menu; it becomes a mark on every weekly chart and a row in the Growth page, so a jump is read against what was done. Notes are the owner's, written through `POST /v1/notes`, up to 300 of up to 80 characters.
- **Targets are the owner's.** *Targets* in the scorecard edits the numbers it is measured against (`PUT /v1/targets`, stored in the collector); the return and activation rates can be given a target too and then get a row. Defaults below.
- **Why people leave.** When the extension is removed the browser opens one page on the project's site (`site/uninstall.html`) with seven buttons. A click sends only `{ "reason": … }` from a fixed list; the collector counts it per day and keeps no identifier, and the page sets no cookie and stores nothing. The extension asks for that page only when a collector exists (`setUninstallURL`), so a build without one asks nothing. The Retention page shows the reasons and the removal share of the store's user count.
- **Coverage of the sample.** The people who share are not all the people. The owner types in the store's weekly users (`PUT /v1/store-stats`, or the form under *Coverage of the sample* on the Audience page) and the dashboard shows what share of them reports. Under 10 % the dashboard says to read the figures as a small, selected group.
- **Report intake.** The collector counts, by day and without ids, what it accepted and what it refused and why (a bad report, too soon, too big, a web page, a flood). The Quality page shows it; a sudden refusal rate means a version that sends something the schema does not know, and the digest warns about it.
- **Days of the week** of the active days (the retention page), so a Tuesday dip is not read as a trend.

### Experiments

A change is tried by putting some devices in an arm. The arm is drawn on the device from a random number that is kept there, never sent and left out of backups; a report says only `"x": ["welcome:short"]`, and only for an experiment that is listed. To start one:

1. Add it to `EXPERIMENTS` in `src/shared/usage-schema.js`, the control first: `{ id: 'welcome', arms: ['control', 'short'] }`. The collector reads the same list, so a report that names an experiment that is not in it is refused.
2. In the code that differs, ask `await armOf('welcome')` (`src/shared/usage-store.js`) and branch on the arm. The arm is drawn on the device whether or not the person shares, so what they see never depends on sharing; only a sharer's report says which arm it was.
3. Release. After a few weeks the **Experiments** page shows each arm with its intervals and whether the difference from the control is significant. Do not stop at the first green arrow: decide the length and the number of people in advance, and remember that it is the people who share that are compared, as everywhere else.
4. Remove the code of the loser, and remove the experiment from the list.

Every counter, flag and field of the report is listed in `docs/TRACKING-PLAN.md` with the page that reads it; the file is generated (`node scripts-dev/tracking-plan.mjs`), a test fails when the schema and the plan differ, and `npm run check` fails when the file is stale.

### The question about sharing is itself an experiment (and how it is measured without asking those who said no)

How the question is worded matters more than anything else for how many people agree, so it is tested, honestly: the experiment `ask-copy` (`src/shared/usage-schema.js`) puts every device in the *personal* ("may I ask you a small favour?") or the *practical* ("help decide what gets fixed next") voice for the **first** ask, 50/50; the second and third asks have their own words for everybody. Only people who said yes ever report, and they name their arm; but because the arms were shared out evenly over **all** devices, how the people who agreed split between the arms is the conversion of each wording. The **Experiments** page shows it ("Agreements by group") and calls a winner only with at least 200 people who agreed and p < 0.05 (`consentSplit` in `stats.js`). About 400 agreements tell a 55 / 45 split from chance, so a few thousand people have to be asked. Nothing is ever collected from a person who said no. Do not change the wording of an arm while the test runs; when there is a winner, make it the only wording and remove the experiment.

What is not tested, on purpose: anything that makes a "no" harder, smaller than readable, or costlier (see `docs/COMPLIANCE.md`). The rhythm is fixed: at a good moment (right after a finished session, or after a week of waiting); **Maybe later** brings the question back after three weeks with other words, up to three asks in all; **Don't ask again** (first two asks) and **No, thanks** (the third, which says it is the last) are final; and a consent is for the version of what is sent that it was given for.

### The digest and the alarms

With the Worker's cron triggers and two secrets (`TG_BOT_TOKEN`, `TG_CHAT_ID`) the collector sends the owner a Telegram message every Monday (the week's figures with the change and the link to the dashboard) and, at most once in three days per cause, an alarm when errors, new-tab speed, a fall in active installs (under 70 % of the week before) or a share of refused reports crosses a line. Nothing is sent without the two secrets, and the message holds only totals.

### Retention of the data

An install that has not reported for 400 days (`RETENTION_DAYS`, at least 30) is deleted with everything held for it, on the weekly run. An install of the people who share is a number, but a number is not owed forever.

### Scorecard targets (ours, not an industry standard)

| Figure | Green | Amber |
|---|---|---|
| New tab: 9 of 10 opens under | ≤ 500 ms | ≤ 1000 ms |
| Sessions finished | ≥ 70 % | ≥ 50 % |
| Stopped in the first 5 minutes | ≤ 10 % | ≤ 20 % |
| Installs with an error | ≤ 5 % | ≤ 10 % |
| Quick ratio, last full week | ≥ 1 | ≥ 0.8 |
| People on the newest version | ≥ 80 % | ≥ 50 % |
| DAU / MAU | ≥ 20 % | ≥ 10 % |

A row with too little data (under 50 installs, 30 sessions, 100 tab opens) shows *low data* and is neither green nor red. The rows are computed on the collector from the owner's targets (*Targets* on the scorecard); amber starts at three quarters of the target for a rate that should be high, and at twice the target for one that should be low.

### What the dashboard does not cover

The numbers come from **the browser extension only**. The Windows app (`desktop/`) sends nothing: its only network use is the update check. Reporting from it would need its own opt-in, its own list of counters (blocks by kind, programs closed, unlock attempts, service restarts) and a decision about the promise made to the people who pay for it; see the end of this page. It is a decision for the owner and has not been made. Nothing outside the app is measured either (the site, the store page, downloads): the Chrome Web Store dashboard and the GitHub release counts already answer *how many came*, and this dashboard answers *what they did*.

## Targets for the first quarter

Targets are a way to notice, not a verdict. They are proposals to replace with the first real numbers (the first two weeks are only about getting a baseline).

| Metric | First baseline | Aim by the end of the quarter |
|---|---|---|
| Opt-in to sharing | whatever it is | ≥ 20 % of the installs that finished a first session (the ask is shown once, after the first finished session, never again once answered) |
| Activation (focus session on day 1) | measure | + 10 points over the baseline |
| D7 retention | measure | + 5 points |
| Features used by < 5 % of active installs | list them | decide for each: promote, simplify or remove |

## How to read the numbers honestly

- **It is a sample of the people who agreed**, and they are not typical (more careful about privacy, probably more engaged). Read levels with caution and changes between versions with more confidence.
- **Small groups are noise.** Do not read a retention percentage from a cohort of fewer than 50 installs.
- **A version cannot be compared with the one before it unless the same ask was shown.** The ask is part of the experiment; changing it changes who is in the sample.
- **Numbers never replace the sessions in `docs/research/`.** A funnel says where people stop; only watching them says why.

## What happens when the team turns it on

1. Create the collector (`server/usage/README.md`): a Cloudflare Worker and a D1 database, five minutes, no server to run.
2. Put its address in `src/shared/usage-config.js` (`USAGE_ENDPOINT`) and ship.
3. Chrome Web Store: the *Privacy practices* tab must say that usage data is collected (optionally, with consent) and why; `store/SUBMISSION.md` has the text.
4. Firefox: the manifest already declares the data as an optional permission (`technicalAndInteraction`); the extension asks for it when the person switches sharing on.
5. `PRIVACY.md` and the site's privacy page already describe it. Keep them in step with `usage-schema.js`: a unit test fails when a field exists in one and not the other.
6. **Wording elsewhere that says "no analytics"** is true while the address is empty and stops being exact once it is filled in. Change it in the same release: `store/listing/*.md` (line 34 of each language: "No account. No servers. No analytics."), the line in `site/index.html`, `README.md` / `README_RU.md` if they say it, and the store screenshots' captions if any do. Say what is true: *"No account, no ads, nothing leaves your device unless you switch it on. The one optional thing is anonymous usage numbers, which you can read before they are sent."*

## The Windows app (measured, only if the person says yes)

The app is a second product in the same collector (`pr: "win"` in the report; the dashboard has an *Extension | Windows* switch and a page of its own). The rules are the extension's, and the owner decided that it is measured only with permission:

- **Off by default, and nothing can be sent from a build without a collector address** (`COLLECTOR` in `desktop/core/src/telemetry.rs` is empty until the collector exists). The app asks **once**, in a note in the corner, after three days of use and once something was closed, and never again after a "no". *Settings → Share anonymous numbers* shows the switch and the exact next report. Nothing is sent while a session runs, and the question does not appear then.
- **The report** is the extension's shape with its own, shorter lists (`WIN_FEATURES`, `WIN_FLAGS` in `src/shared/usage-schema.js`; the Rust side has a test that reads that file, so the lists cannot drift): what was closed **by kind of reason** (rule, session, limit, cool-down), how the challenge before unblocking is shown and how it ends (by kind: hold, wait, type, sum, PIN, friend's code; by purpose: end a session, a break, unblock, edit rules, emergency), sessions started, finished and stopped, the window opened, the service started or did not stop cleanly, updates found, installed and failed. Flags: PIN set, a friend's code, auto-update, browser extension connected, locked rules, limits, schedule, sessions used, strict mode, Windows 10 or 11.
- **Never**: a program name, a site, a path, a window title, a rule name, a PIN, a code, text typed in the app, a time of day, an IP address. The heaviest possible report is built in a test and every word of it must be from a list.
- **The same identifier rules**: 128 random bits made when sharing is switched on, replaced when it is switched off and on again; switching off asks the collector to forget it (retried every six hours until it has).
- **Sending**: the service posts through `curl.exe` (the same way it checks for updates), over https, to the one address in the build, with no redirect, no cookie and no referrer; a failed try waits six hours.
- **Counting is local** on the computer whether or not anything is shared, so the preview is the person's real numbers.
- **On the dashboard**: pick *Windows* at the top. Overview, Growth and Retention use the same definitions as for the extension; the *Windows app* page shows what is closed and why, how the challenge ends (do people get through it, or give up?), sessions, unclean stops and updates, and what is set up.

Not decided and not built: a question about how likely someone is to recommend the product (NPS), and anything that would measure what people block (names of programs or sites) rather than kinds of events.
