# The usage collector

The receiving end of EyeTime's **optional, anonymous usage report** (see `docs/MEASUREMENT.md` for what is measured and why, and `PRIVACY.md` for what people are told).
It is a single endpoint, `POST /v1/usage`, that accepts exactly what `src/shared/usage-schema.js` allows and refuses everything else.

```
handler.js        the endpoints as plain functions over a store (request → response): the report, forget, the dashboard page, its numbers, the owner's routes, the answer after removal, the public totals
digest.js         the weekly digest, the alarms and the clean-up (what the Worker's cron triggers run)
limits.js         the fixed names and caps shared by the handler and the stores
tracking-plan.js  what every counter and flag means (the source of docs/TRACKING-PLAN.md)
stats.js          the formulas behind the dashboard: plain functions from a snapshot of the store to one JSON object (no storage, no clock of its own)
dashboard.html    the dashboard: one file, no library, Russian and English
demo-data.js      a made-up population for trying the page and for the tests
memory-store.js   a store in memory (tests, a quick local try)
d1-store.js       the same store on Cloudflare D1 (SQLite)
worker.js         the Cloudflare Worker that wires the two
schema.sql        the tables (installs, firsts, usage_weeks, flags, experiments, ingest, uninstalls, notes, store_stats, settings)
queries.sql       quick questions for a console (the dashboard is the reference)
wrangler.toml     the Worker's settings (logs and analytics of the collector itself are off)
```

## What it will not do

- It does not store or log an IP address, a header, a cookie or a user agent, and a test checks that nothing of the kind is stored. The handler looks at two headers only to decide whether to answer, and keeps neither: `Content-Type` and `Content-Length` (a body announced as too big is refused unread), and `Origin`.
- It does not accept an unknown field, a value outside its list, or a body over 8 KB.
- It accepts one report per install per six hours (HTTP 429 otherwise).
- It accepts a browser request only from an extension (`chrome-extension://…`, `moz-extension://…`): a web page gets 403, so a page cannot be made to send reports. (A program that is not a browser can say anything in `Origin`; this is about web pages, not about a determined script.)
- It takes at most 1000 installs that report for the first time per hour in all (HTTP 429 with `Retry-After`; `MAX_NEW_PER_HOUR` in `handler.js`). The six-hour rule holds only for an id it has seen, so without this limit a script could fill the database with made-up ids. Installs that are already known keep reporting. For a real flood put a Cloudflare rate-limiting rule in front of the Worker too (dashboard: Security → WAF → Rate limiting rules); that cannot be set from this repository.
- It deletes everything held for an id when asked (`{ "v": 1, "op": "forget", "id": "…" }`), which the extension sends when someone stops sharing.

## Set it up (about five minutes; nothing here is deployed by the repository)

You need a Cloudflare account and `npx wrangler login`.

```bash
cd server/usage
npx wrangler d1 create eyetime-usage            # copy the database_id it prints into wrangler.toml
npx wrangler d1 execute eyetime-usage --remote --file schema.sql     # an existing database made before a newer table: run it again, every statement is IF NOT EXISTS
openssl rand -base64 24 | npx wrangler secret put DASH_TOKEN         # the key to the dashboard: at least 16 characters; keep it in a password manager
npx wrangler deploy                              # prints https://eyetime-usage.<you>.workers.dev
```

Then put the address in `src/shared/usage-config.js`:

```js
export const USAGE_ENDPOINT = 'https://eyetime-usage.<you>.workers.dev/v1/usage';
```

and release. Until that line is filled, no build can send anything and the settings screen says so.

## The owner's routes (all behind `DASH_TOKEN`, except the answer after removal)

| Route | What it does |
|---|---|
| `GET /v1/stats` | The numbers (any period and filter, see below). |
| `POST /v1/notes` `{ day, text }`, `DELETE /v1/notes/:id` | Events shown as marks on the charts (up to 300, 80 characters each). |
| `PUT /v1/store-stats` `{ day, users, installs?, uninstalls? }` | The store's numbers, typed in by the owner, for the coverage figure. |
| `PUT /v1/targets` `{ finish: 0.8, … }` | The targets of the scorecard (a value of `null` returns one to its default). |
| `POST /v1/uninstall` `{ "reason": … }` | The one answer of the page after removal. No key; accepted only from the project's own site (`SITE_ORIGINS`, default `https://maxbzd.github.io`) and with exactly this body; counted by day, 2000 a day at most. |

## Digest, alarms and clean-up (optional)

`wrangler.toml` has two cron triggers (Monday 06:00 UTC and every six hours). The weekly one deletes installs idle for `RETENTION_DAYS` (default 400, at least 30) and, when the Telegram secrets exist, sends the digest; the other only looks for something wrong and sends an alarm at most once in three days per cause.

```bash
npx wrangler secret put TG_BOT_TOKEN     # from @BotFather
npx wrangler secret put TG_CHAT_ID       # your chat with the bot (send it a message first)
# in wrangler.toml [vars]: DASH_URL = "https://eyetime-usage.<you>.workers.dev/", DIGEST_LANG = "ru"
```

Without the two secrets the crons still clean up and send nothing.

## The dashboard

Open `https://eyetime-usage.<you>.workers.dev/` and enter the key. (A bookmark `…/#t=<key>` signs in at once and removes the key from the address bar; the key is kept in that tab only and goes only to this address.)

- Without `DASH_TOKEN` (or with one shorter than 16 characters) the numbers do not exist: `GET /v1/stats` answers 404. A wrong key is 401 and the comparison is constant-time. The page itself holds no data and is served with a strict policy (`default-src 'none'`, own origin only, no framing, no referrer).
- `GET /v1/stats?days=28`, `?range=all`, `?from=2026-10-01&to=2026-10-31` answer for a period, and `&br=chrome&lang=ru` (also `app`, `os`, `look`, `layout`, `mode`, and by behaviour `use`, `session`, `blocking`) narrow it to a segment (a malformed one is a 400, never silently another period); the dashboard's period bar and filters use these.
- **Public statistics** (optional): `npx wrangler secret put PUBLIC_STATS` with the value `1` (or `[vars] PUBLIC_STATS = "1"` in `wrangler.toml`) turns on `GET /v1/public-stats` for anyone (cached five minutes, CORS open): totals over at least 50 installs only. `…/?public` shows them with the same page.
- Rotating the key: `wrangler secret put DASH_TOKEN` again; the old one stops working at once.
- Try the page with made-up people, before any real report: `node scripts-dev/dashboard-preview.mjs`, then open `http://127.0.0.1:8787/?demo`.

For a console: any query of `queries.sql` can be pasted into the D1 console (`wrangler d1 execute eyetime-usage --remote --command "…"`); the dashboard's rules are stricter (see `docs/MEASUREMENT.md`).

## Run it locally without Cloudflare

`handle(request, new MemoryStore())` is all there is; `scripts-dev/tests/usage-server.test.mjs` shows it, and runs the queries against an in-memory SQLite with the real `D1Store`.

## Changing the report

Edit `src/shared/usage-schema.js` first (the extension and this collector both import it), then `schema.sql` / `d1-store.js` if a new table or column is needed, then `PRIVACY.md` and `docs/MEASUREMENT.md`.
A unit test fails when the privacy page does not list a field the schema allows.
