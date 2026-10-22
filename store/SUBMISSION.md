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
4. *Privacy practices*: single purpose, every row of the permission table, "no remote code", data usage = none collected, privacy policy URL.
5. *Distribution*: public, all regions. Submit for review (typically a few days; a first review with `tabs` + `webNavigation` can ask questions — the justifications are written to pre-empt them).
6. Edge Add-ons: see section 2b.

## 2b. Microsoft Edge Add-ons (free)
1. Sign in at https://partner.microsoft.com/dashboard/microsoftedge/overview with a Microsoft account and register as a developer (no fee).
2. *Create new extension* → upload the **same** `eyetime-chrome.zip` (Edge runs Chrome extensions unchanged).
3. *Availability*: public, all markets. *Properties*: category *Productivity*, privacy policy URL `https://maxbzd.github.io/eyetime/privacy.html`, website `https://maxbzd.github.io/eyetime/`, support `https://github.com/maxbzd/eyetime/issues`.
4. *Store listings*: add one listing per language (EN, RU, ES, DE, FR, PT, IT, PL, UK, ZH, JA) from `store/listing/<lang>.md`, with that language's screenshots from `store/screenshots/<lang>/` (English: `store/screenshots/*.png`).
5. *Notes for certification*: paste the same permission justifications as for Chrome (`store/LISTING.md`). Review usually takes a few days.

## 3. After approval
Put the store links on the project page (`site/index.html`, the two download buttons) and in `README.md`. Each new release: bump `manifest.json` version → the Release workflow builds the zips → upload them in each store.
