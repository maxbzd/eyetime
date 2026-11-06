# The usage collector

The receiving end of EyeTime's **optional, anonymous usage report** (see `docs/MEASUREMENT.md` for what is measured and why, and `PRIVACY.md` for what people are told).
It is a single endpoint, `POST /v1/usage`, that accepts exactly what `src/shared/usage-schema.js` allows and refuses everything else.

```
handler.js        the endpoint as plain functions over a store (request → response); the only logic
memory-store.js   a store in memory (tests, a quick local try)
d1-store.js       the same store on Cloudflare D1 (SQLite)
worker.js         the Cloudflare Worker that wires the two
schema.sql        the three tables
queries.sql       the questions: activation, retention D1/D7/D30, feature adoption, setup
wrangler.toml     the Worker's settings (logs and analytics of the collector itself are off)
```

## What it will not do

- It does not store or log an IP address, a header, a cookie or a user agent, and a test checks that nothing of the kind is stored. The handler looks at two headers only to decide whether to answer, and keeps neither: `Content-Type` and `Content-Length` (a body announced as too big is refused unread), and `Origin`.
- It does not accept an unknown field, a value outside its list, or a body over 4 KB.
- It accepts one report per install per six hours (HTTP 429 otherwise).
- It accepts a browser request only from an extension (`chrome-extension://…`, `moz-extension://…`): a web page gets 403, so a page cannot be made to send reports. (A program that is not a browser can say anything in `Origin`; this is about web pages, not about a determined script.)
- It takes at most 1000 installs that report for the first time per hour in all (HTTP 429 with `Retry-After`; `MAX_NEW_PER_HOUR` in `handler.js`). The six-hour rule holds only for an id it has seen, so without this limit a script could fill the database with made-up ids. Installs that are already known keep reporting. For a real flood put a Cloudflare rate-limiting rule in front of the Worker too (dashboard: Security → WAF → Rate limiting rules); that cannot be set from this repository.
- It deletes everything held for an id when asked (`{ "v": 1, "op": "forget", "id": "…" }`), which the extension sends when someone stops sharing.

## Set it up (about five minutes; nothing here is deployed by the repository)

You need a Cloudflare account and `npx wrangler login`.

```bash
cd server/usage
npx wrangler d1 create eyetime-usage            # copy the database_id it prints into wrangler.toml
npx wrangler d1 execute eyetime-usage --remote --file schema.sql
npx wrangler deploy                              # prints https://eyetime-usage.<you>.workers.dev
```

Then put the address in `src/shared/usage-config.js`:

```js
export const USAGE_ENDPOINT = 'https://eyetime-usage.<you>.workers.dev/v1/usage';
```

and release. Until that line is filled, no build can send anything and the settings screen says so.

Read the numbers:

```bash
npx wrangler d1 execute eyetime-usage --remote --command "$(sed -n '/-- name: retention/,/^$/p' queries.sql | grep -v '^--')"
```

(or paste any query from `queries.sql` into the D1 console).

## Run it locally without Cloudflare

`handle(request, new MemoryStore())` is all there is; `scripts-dev/tests/usage-server.test.mjs` shows it, and runs the queries against an in-memory SQLite with the real `D1Store`.

## Changing the report

Edit `src/shared/usage-schema.js` first (the extension and this collector both import it), then `schema.sql` / `d1-store.js` if a new table or column is needed, then `PRIVACY.md` and `docs/MEASUREMENT.md`.
A unit test fails when the privacy page does not list a field the schema allows.
