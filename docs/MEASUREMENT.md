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

## The questions, and the queries that answer them

All in `server/usage/queries.sql` (plain SQLite; run against D1 with `wrangler d1 execute`).

| Question | Definition | Query |
|---|---|---|
| **Activation** | An install *activates* when it **starts a focus session on the first day**; the wider measures are a first session within a week and a finished session within a week. The same for opening the new tab on the first day: the step before. | `activation` |
| **Retention D1 / D7 / D30** | Share of installs that were active **the next day (D1)**, **on any day 7–13 (D7)** or **30–36 (D30)** after the install. An install is counted only when its window has been observed (age ≥ 13 for D7, ≥ 36 for D30). A window is used instead of one exact day because EyeTime is used a few days a week, not every day. | `retention` |
| **Which features are real** | Of the installs that reported in the last four weeks, the share that used each feature at all, and how many uses in total. A feature that few use is a candidate to simplify or to cut. | `feature_adoption` |
| **What people choose** | Look, layout, language, system among active installs. Defaults that nobody keeps are a design question. | `setup` |

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
