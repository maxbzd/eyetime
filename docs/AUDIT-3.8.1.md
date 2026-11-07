# Audit of 3.8.1: what was found, what was done

Two reports came back before the store release (a read-through of the code, and a live test of the built package). Every finding was checked against the current branch first; what was true was fixed and given a test, and what was left alone is said here with the reason.

| Finding | Checked | What was done |
|---|---|---|
| The desktop helper's token is in a backup file | true | `exportAll` keeps the helper's setting off and its token empty; test in `usage-store.test.mjs` |
| Mass-delete guard does not protect 1–3 linked tasks | true | An empty answer with **two or more** linked tasks is held until the person agrees (it was four or more). **One** linked task whose counterpart is gone stays a plain deletion: it cannot be told from the person deleting the only item, and holding it would break the calendar-block sync that removes a single event. Tests in `sync-tasks.test.mjs` |
| Store texts: "Eleven looks", "17 backdrops", "46 widgets" | true | Corrected in the eleven listings, the site and the README; `store-check.mjs` now compares the numbers with the code and fails if they drift |
| "No analytics" becomes false once a collector address is set | true (a trap, not a bug today: the first release has no address) | `store-check.mjs` fails the day `USAGE_ENDPOINT` is filled while the site, the English listing or the README still say it |
| Quick add "45м!" | true | The estimate may be followed by `!`, `,` or `;`; tests in `quickadd.test.mjs` |
| "Show the night clock now" only in the palette | true | A row with a button in Settings (opens the new tab in night mode) |
| Skip in onboarding writes defaults; the look step applies at once | true for the old flow | The new flow (`docs/ONBOARDING.md`) writes nothing on skip but "onboarded", and the look is chosen after the first session, on the page it changes |
| Restoring a backup withdraws the Dock's access | true | The broad access is kept when the restored settings use the Dock or instant blocking; a reset still withdraws it |
| Switching the helper off keeps `127.0.0.1:8765` | true | The access is withdrawn |
| Switching the Dock off withdraws instant blocking's access | true | It is withdrawn only if instant blocking is off |
| `clearPhotos` does not tell other tabs; IndexedDB failure stops the new tab | true | `clearPhotos` bumps the revision; `getPhoto` treats an unreadable store as "no photo"; test in `photos.test.mjs` |
| Switching sync encryption off needs no passphrase | true | It asks for it and refuses a wrong one (unit and e2e tests) |
| `inflate` checks the cap after reading everything | true | Read in pieces, stopped at the cap |
| Weak passphrases ("password") accepted | true | A short list of the first passwords everyone tries, and one or two characters repeated, are refused (`weak`) |
| A broken widget stops the page | true | Each widget is built in a `try`; a failure is logged and the widget is left out |
| The depth model is loaded for every picture | true | One session per worker |
| `boot()` failures, `openBreakPage`, `tabs.create` / `alarms.create` at install | true | Handled and logged |
| `feed.js` shows an empty title if a translation is missing | true | English fallback |
| No size check before decoding a photo | true | Refused above 40 MB |
| Instant blocking does not say what it leaves to the tab blocker; overflow only in the error log | true | Settings says what is not covered, and shows how many sites did not fit the browser's rule limit |
| Dead i18n keys; the README badge; the old console address; `README_RU` network sentence | true | Removed (25 keys, including the ones the new onboarding made dead), fixed, rewritten |
| `store/LISTING.md` lists old screenshots | true | The section now points to the per-language set; the root PNGs are marked README-only (the README uses them) |
| No test for daylight-saving days; no test for a damaged profile | true | `widgets.test.mjs`, `schema-repair.test.mjs` (the code was already right; now it is held) |

## Left as it is, on purpose

- **The 30-second redirect window of a "Continue" is wider than "the redirect chain"** (`dnr.js` session rule, no URL filter). The tab blocker honours the same key in the same way, so instant blocking does not widen it; narrowing it needs the chain's hosts, which the browser does not give at the time of the click. It is bounded by tab and time, and written down here.
- **The IP-address bypass** is a limit of the whole blocker, not of instant blocking.
- **`identity` is not in the manifest** while no OAuth client id is filled in; `store/SUBMISSION.md` says to add it before enabling the Google and Microsoft providers.
- **`packs/parked/`** (15 files) stays in the repository, out of the package (`pack.mjs`, `build.test.mjs`); deleting it is a separate decision.
- **The `allowMass` race** (a flag set in the middle of another round) needs a live run to confirm; the code path is documented in `connections.js`.
- **Untranslated strings** in `de/fr/es/it/pt/pl` need a native speaker.
