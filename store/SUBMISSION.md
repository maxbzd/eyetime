# Publishing checklist (what only the account owner can do)

Prepared: package (`npm run build` → `dist/eyetime-chrome.zip`, `dist/eyetime-firefox.zip`; also attached to every GitHub release), listing text and permission justifications (`store/LISTING.md`), screenshots (`store/screenshots/`), privacy policy page (`site/privacy.html` → GitHub Pages).

## 0. One-time: turn on the project page
Repository → Settings → Pages → *Build and deployment* → Source: **GitHub Actions**. The `Pages` workflow then publishes `https://maxbzd.github.io/eyetime/` (+ `/privacy.html`) on every push.

## 1. Firefox Add-ons (free)
1. Sign in at https://addons.mozilla.org/developers/ with a Mozilla account.
2. *Submit a New Add-on* → **On this site** → upload `eyetime-firefox.zip` from the latest release.
3. Source code: answer "No" (nothing is minified or generated; see reviewer notes in `store/LISTING.md`) and paste the *Firefox AMO notes* into "Notes to reviewer".
4. Listing: name, summary, description (EN as the default; add RU, ES, DE, FR, PT, IT, PL, UK, ZH-CN, JA as locales from `store/listing/`), category *Productivity* (+ *Privacy & Security*), screenshots with the captions from `store/LISTING.md`, privacy policy URL, support URL `https://github.com/maxbzd/eyetime/issues`.
5. Submit. Review usually takes from hours to a few days.

## 2. Chrome Web Store (one-time developer fee, currently about 5 USD — check the current price)
1. Register at https://chrome.google.com/webstore/devconsole (pay the fee, verify the e-mail).
2. *Add new item* → upload `eyetime-chrome.zip` from the latest release.
3. *Store listing*: paste name/summary/description from `store/listing/<lang>.md` (EN, RU, ES, DE, FR, PT, IT, PL, UK, ZH-CN, JA; each language with its own screenshots), category *Productivity*, upload the screenshots, small promo tile `store/promo`.
4. *Privacy practices*: single purpose, every row of the permission table, "no remote code", privacy policy URL, and the data usage:
   - **While `USAGE_ENDPOINT` in `src/shared/usage-config.js` is empty** (the default; nothing can be sent): *none collected*.
   - **Once the collector is set up and the address is in** (see `docs/MEASUREMENT.md`): tick **User activity** (the counts of EyeTime's own buttons and screens, and the days it was used), and answer the three certifications as true: the data is not sold, not used for anything unrelated to the single purpose, and not used for creditworthiness or lending. Say it is **optional and off by default** (opt-in) and that a person can read the exact report and stop at any time. The text for the field: *"Optional, off by default. If the user turns on 'Share anonymous usage numbers', EyeTime sends one report a week with counts of its own features and the days it was used, and the interface look and language. No websites, text, or identity. The user can see the exact report and stop at any time; stopping deletes it from the server."*
   - **Connected services** (an optional host permission for the address of one service; see `docs/CONNECTIONS.md`): in the permission justification say *"Optional. Only when the user connects Todoist, Notion or a CalDAV calendar in Settings. The browser asks for the address of that one service. The browser talks to the service directly; nothing goes to the developer. Withdrawn when the user disconnects."* Data usage: the user's own tasks and calendar are sent to **the service the user chose**, not to us, and not stored by us: disclose it under *Personal communications / user activity* only if the form asks about data transmitted to third parties the user selected. Google and Microsoft are not offered in this version; Google's OAuth verification (sensitive scopes) has to be finished, and `identity` added to `optional_permissions`, before they are switched on (`docs/CONNECTIONS.md`).
   - Firefox (AMO): the manifest already declares `technicalAndInteraction` as an **optional** data permission; AMO shows it in the listing. Nothing to do but keep it in step with the above.
5. *Distribution*: public, all regions. Submit for review (typically a few days; a first review with `tabs` + `webNavigation` can ask questions — the justifications are written to pre-empt them).
6. Edge Add-ons: see section 2b.

## 2b. Microsoft Edge Add-ons (free)
1. Sign in at https://partner.microsoft.com/dashboard/microsoftedge/overview with a Microsoft account and register as a developer (no fee).
2. *Create new extension* → upload the **same** `eyetime-chrome.zip` (Edge runs Chrome extensions unchanged).
3. *Availability*: public, all markets. *Properties*: category *Productivity*, privacy policy URL `https://maxbzd.github.io/eyetime/privacy.html`, website `https://maxbzd.github.io/eyetime/`, support `https://github.com/maxbzd/eyetime/issues`.
4. *Store listings*: add one listing per language (EN, RU, ES, DE, FR, PT, IT, PL, UK, ZH, JA) from `store/listing/<lang>.md`, with that language's five screenshots from `store/screenshots/<lang>/` (English: `store/screenshots/en/`).
5. *Notes for certification*: paste the same permission justifications as for Chrome (`store/LISTING.md`). Review usually takes a few days.

## 3. After approval
Put the store links on the project page (`site/index.html`, the two download buttons) and in `README.md`. Each new release: bump `manifest.json` version → the Release workflow builds the zips → upload them in each store.
