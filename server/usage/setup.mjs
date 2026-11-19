// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// One-command set-up of the usage collector on Cloudflare (what README.md lists, done in order).
//   node server/usage/setup.mjs
// In GitHub Actions (collector.yml) it takes CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID and DASH_TOKEN from secrets and needs no browser.
// It needs Node.js 20+ and a free Cloudflare account. Open a browser once to log in; everything else is automatic and can be run again.
// It creates the database, applies schema.sql, makes the key of the dashboard, deploys the Worker and prints the two things to keep: the address and the key.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TOML = join(HERE, 'wrangler.toml');
const DB_NAME = 'eyetime-usage';
const WRANGLER = ['--yes', 'wrangler@4'];

/** Pure helpers (kept apart so a test can feed them what wrangler prints). */
export const parseDatabaseId = (text) => (String(text).match(/"database_id"\s*:\s*"([0-9a-f-]{36})"/i) || [])[1] || null;
export const findDatabaseId = (listJson, name = DB_NAME) => {
  try { const rows = JSON.parse(listJson); const row = (Array.isArray(rows) ? rows : []).find((r) => r && r.name === name); return (row && (row.uuid || row.database_id)) || null; } catch { return null; }
};
export const parseWorkerUrl = (text) => (String(text).match(/https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.workers\.dev/i) || [])[0] || null;
export const withDatabaseId = (toml, id) => toml.replace(/database_id\s*=\s*"[^"]*"/, `database_id = "${id}"`);

function wr(args, { input, interactive = false } = {}) {
  const r = spawnSync('npx', [...WRANGLER, ...args], { cwd: HERE, encoding: 'utf8', shell: process.platform === 'win32', input, stdio: [input !== undefined ? 'pipe' : interactive ? 'inherit' : 'ignore', 'pipe', 'pipe'] });
  return { ok: r.status === 0, out: `${r.stdout || ''}\n${r.stderr || ''}` };
}
const say = (s) => console.log(s);
function stop(msg, detail) { console.error(`\n✗ ${msg}`); if (detail) console.error(String(detail).trim().split('\n').slice(-12).join('\n')); process.exit(1); }

async function main() {
  if (Number(process.versions.node.split('.')[0]) < 20) stop('Node.js 20 or newer is needed (https://nodejs.org).');
  say('Elvani collector: set-up\n');

  const TOKEN = process.env.CLOUDFLARE_API_TOKEN, ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (TOKEN) { // run from GitHub Actions (.github/workflows/collector.yml): no browser, the token is the login
    say('1/5  Cloudflare login by token…');
    const who = wr(['whoami']);
    if (!who.ok) stop('The Cloudflare token was refused (check CLOUDFLARE_API_TOKEN and its rights).', who.out);
    if (ACCOUNT) await ensureWorkersSubdomain(ACCOUNT, TOKEN).catch((e) => say(`    (the workers.dev address could not be checked: ${e.message})`));
  } else {
    say('1/5  Cloudflare login (a browser tab opens; press "Allow")…');
    const who = wr(['whoami']);
    if (!who.ok || /not authenticated/i.test(who.out)) { const l = wr(['login'], { interactive: true }); if (!l.ok) stop('The login did not finish.', l.out); }
  }

  say('2/5  The database…');
  let id = null;
  const made = wr(['d1', 'create', DB_NAME, '--location', 'weur']);
  if (made.ok) id = parseDatabaseId(made.out);
  if (!id) { const list = wr(['d1', 'list', '--json']); id = findDatabaseId(list.out.slice(list.out.indexOf('['))); }
  if (!id) stop('Could not create or find the database.', made.out);
  writeFileSync(TOML, withDatabaseId(readFileSync(TOML, 'utf8'), id));

  say('3/5  The tables…');
  const sch = wr(['d1', 'execute', DB_NAME, '--remote', '--yes', '--file', 'schema.sql']);
  if (!sch.ok) stop('The tables were not created.', sch.out);

  say('4/5  Publishing the collector…');
  const dep = wr(['deploy'], { interactive: true });
  if (!dep.ok) stop('The deploy failed.', dep.out);
  const url = parseWorkerUrl(dep.out);

  say('5/5  The key of the dashboard…');
  const given = process.env.DASH_TOKEN || '';
  if (given && given.length < 16) stop('DASH_TOKEN must be at least 16 characters.');
  const key = given || randomBytes(24).toString('base64url');
  const sec = wr(['secret', 'put', 'DASH_TOKEN'], { input: key + '\n' });
  if (!sec.ok) stop('The dashboard key was not saved.', sec.out);
  if (!url) stop('Deployed, but no address was found in the output; look for "workers.dev" above.', dep.out);

  say('\n✓ Done.\n');
  if (given) { // the key is the one the owner chose (a GitHub secret): a public log must not print it
    say(`Address to give Claude (endpoint): ${url}/v1/usage\nDashboard:                        ${url}/\nThe dashboard key is the DASH_TOKEN you saved.`);
    return;
  }
  const note = `Elvani collector\n\nAddress to give Claude (endpoint): ${url}/v1/usage\nDashboard:                        ${url}/\nDashboard key (keep it private):  ${key}\n`;
  writeFileSync('eyetime-collector.txt', note);
  say(note);
  say('Saved to eyetime-collector.txt in this folder (do not commit it). Send me the "endpoint" line only, never the key.');
}

/** A new account has no *.workers.dev address yet and a deploy without a person cannot ask for one: make it (the name can be changed later in Cloudflare). */
async function ensureWorkersSubdomain(account, token) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/workers/subdomain`;
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const have = await (await fetch(url, { headers })).json();
  if (have && have.success && have.result && have.result.subdomain) return;
  const made = await (await fetch(url, { method: 'PUT', headers, body: JSON.stringify({ subdomain: `eyetime-${randomBytes(3).toString('hex')}` }) })).json();
  if (!made.success) throw new Error((made.errors && made.errors[0] && made.errors[0].message) || 'refused');
  say('    made the workers.dev address of the account');
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
