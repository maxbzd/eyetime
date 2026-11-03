// Runs the end-to-end suites listed in suites.json: several at a time on one machine, or split over CI machines.
//
//   node scripts-dev/e2e/run.mjs                      every suite, one after another
//   node scripts-dev/e2e/run.mjs --jobs 3             three at a time (each suite has its own browser and profile)
//   node scripts-dev/e2e/run.mjs --shard 2/4          the 2nd of 4 balanced parts (what the CI matrix does)
//   node scripts-dev/e2e/run.mjs --only starters,quotes     (or --only a11y: a prefix matches the parts a11y-1, a11y-2 …)
//   node scripts-dev/e2e/run.mjs --skip visual        everything but
//   node scripts-dev/e2e/run.mjs --retries 1          a failed suite runs once more; a pass on the retry is reported as FLAKY, not hidden
//   node scripts-dev/e2e/run.mjs --list [--shard 2/4] show what would run and the expected time, run nothing
//
// Output of every suite goes to $E2E_LOGS (default /tmp/eyetime-e2e/<id>.log); a failed suite prints the tail of its log.
// In GitHub Actions each suite is a collapsible group. Exit code 1 when anything failed.

import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, createWriteStream, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import os from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const LOGS = process.env.E2E_LOGS || '/tmp/eyetime-e2e';
const CI = !!process.env.GITHUB_ACTIONS;

/** @param {string[]} argv */
export function parseArgs(argv) {
  const o = { jobs: 1, shard: null, only: [], skip: [], retries: 0, list: false, timeout: 900 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => argv[++i];
    if (a === '--jobs') o.jobs = Math.max(1, Number(next()) || 1);
    else if (a === '--shard') { const m = /^(\d+)\/(\d+)$/.exec(next() || ''); if (!m || +m[1] < 1 || +m[1] > +m[2]) throw new Error('--shard i/n, e.g. 2/4'); o.shard = [+m[1], +m[2]]; }
    else if (a === '--only') o.only = (next() || '').split(',').filter(Boolean);
    else if (a === '--skip') o.skip = (next() || '').split(',').filter(Boolean);
    else if (a === '--retries') o.retries = Math.max(0, Number(next()) || 0);
    else if (a === '--timeout') o.timeout = Number(next()) || o.timeout;
    else if (a === '--list') o.list = true;
    else throw new Error('unknown argument ' + a);
  }
  return o;
}

/** A name matches an id exactly or as a prefix of its parts: `a11y` selects a11y-1, a11y-2 … */
export const matches = (id, names) => names.some((n) => id === n || id.startsWith(n + '-'));

/**
 * Longest-processing-time-first: the biggest suite goes to the lightest shard. Deterministic (ties by id), so every CI machine computes the same split.
 * @template {{ id: string, weight: number }} T
 * @param {T[]} suites @param {number} n @returns {T[][]}
 */
export function split(suites, n) {
  const bins = Array.from({ length: n }, () => ({ w: 0, items: /** @type {T[]} */ ([]) }));
  for (const s of [...suites].sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id))) {
    const bin = bins.reduce((m, b) => (b.w < m.w ? b : m));
    bin.items.push(s); bin.w += s.weight;
  }
  return bins.map((b) => b.items);
}

/** Every *.cjs here is a suite or a declared tool: a new test script that nobody registered would silently never run in CI. */
export function unregistered(cfg, dir = HERE) {
  const known = new Set([...cfg.suites.map((s) => s.file), ...cfg.tools]);
  return readdirSync(dir).filter((f) => f.endsWith('.cjs') && !known.has(f));
}

export function loadConfig() { return JSON.parse(readFileSync(join(HERE, 'suites.json'), 'utf8')); }

const fmt = (s) => (s >= 60 ? `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, '0')}s` : `${s.toFixed(0)}s`);

function runOne(suite, timeoutSec) {
  return new Promise((resolve) => {
    const log = join(LOGS, suite.id + '.log'), out = createWriteStream(log);
    const t0 = Date.now();
    const child = spawn(process.execPath, [join(HERE, suite.file), ...(suite.args || [])], { env: { ...process.env, ...(suite.env || {}) }, stdio: ['ignore', 'pipe', 'pipe'] });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutSec * 1000);
    child.stdout.pipe(out, { end: false }); child.stderr.pipe(out, { end: false });
    child.on('close', (code) => { clearTimeout(timer); out.end(); resolve({ id: suite.id, ok: code === 0 && !timedOut, code, timedOut, secs: (Date.now() - t0) / 1000, log }); });
    child.on('error', (e) => { clearTimeout(timer); out.end(`spawn failed: ${e.message}\n`); resolve({ id: suite.id, ok: false, code: -1, timedOut: false, secs: 0, log }); });
  });
}

function tail(file, n = 40) {
  try { return readFileSync(file, 'utf8').trimEnd().split('\n').slice(-n).join('\n'); } catch { return '(no log)'; }
}

async function main() {
  const o = parseArgs(process.argv.slice(2)), cfg = loadConfig();
  const missing = cfg.suites.filter((s) => !existsSync(join(HERE, s.file)));
  if (missing.length) { console.error('suites.json lists files that do not exist: ' + missing.map((s) => s.file).join(', ')); process.exit(2); }
  const loose = unregistered(cfg);
  if (loose.length) { console.error('not in suites.json (add it as a suite or a tool): ' + loose.join(', ')); process.exit(2); }
  let suites = cfg.suites;
  if (o.only.length) suites = suites.filter((s) => matches(s.id, o.only));
  if (o.skip.length) suites = suites.filter((s) => !matches(s.id, o.skip));
  if (o.shard) suites = split(suites, o.shard[1])[o.shard[0] - 1] || [];
  if (!suites.length) { console.error('nothing to run'); process.exit(o.only.length ? 2 : 0); }
  const expected = suites.reduce((a, s) => a + s.weight, 0);
  const jobs = Math.min(o.jobs, suites.length, Math.max(1, os.cpus().length * 2));
  if (o.list) {
    for (const s of suites) console.log(`${s.id.padEnd(22)} ${String(s.weight).padStart(4)}s  ${s.file} ${(s.args || []).join(' ')} ${Object.entries(s.env || {}).map(([k, v]) => k + '=' + v).join(' ')}`);
    console.log(`${suites.length} suites, ~${fmt(expected)} of work, ~${fmt(expected / jobs)} with ${jobs} at a time`); return;
  }
  mkdirSync(LOGS, { recursive: true });
  console.log(`running ${suites.length} suites${o.shard ? ` (shard ${o.shard.join('/')})` : ''}, ${jobs} at a time, ~${fmt(expected / jobs)} expected; logs in ${LOGS}`);
  const queue = [...suites].sort((a, b) => b.weight - a.weight); // the long ones start first: the run ends when the last one does
  const results = [], t0 = Date.now();
  async function worker() {
    for (let s; (s = queue.shift());) {
      let r = await runOne(s, o.timeout), tries = 1;
      while (!r.ok && tries <= o.retries) { console.log(`${s.id}: failed, trying once more`); const again = await runOne(s, o.timeout); tries++; if (again.ok) again.flaky = true; r = again; }
      results.push(r);
      if (CI) console.log(`::group::${r.ok ? (r.flaky ? 'FLAKY' : 'PASS') : 'FAIL'} ${s.id} (${fmt(r.secs)})`);
      else console.log(`${r.ok ? (r.flaky ? 'FLAKY' : 'PASS ') : 'FAIL '} ${s.id} (${fmt(r.secs)})${r.timedOut ? ' — timed out' : ''}`);
      if (CI || !r.ok) console.log(CI ? tail(r.log, 400) : tail(r.log).replace(/^/gm, '    | '));
      if (CI) { console.log('::endgroup::'); if (r.flaky) console.log(`::warning::${s.id} failed once and passed on a retry: a flaky test, look at it`); if (!r.ok) console.log(`::error::${s.id} failed`); }
    }
  }
  await Promise.all(Array.from({ length: jobs }, worker));
  const wall = (Date.now() - t0) / 1000, bad = results.filter((r) => !r.ok), flaky = results.filter((r) => r.flaky);
  console.log('\n' + results.sort((a, b) => b.secs - a.secs).map((r) => `${r.ok ? (r.flaky ? 'flaky' : 'ok   ') : 'FAIL '} ${r.id.padEnd(22)} ${fmt(r.secs)}`).join('\n'));
  console.log(`\n${results.length - bad.length}/${results.length} passed${flaky.length ? `, ${flaky.length} only on a retry (${flaky.map((r) => r.id).join(', ')})` : ''} in ${fmt(wall)} (the sum of the suites: ${fmt(results.reduce((a, r) => a + r.secs, 0))})`);
  process.exit(bad.length ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch((e) => { console.error(e.message || e); process.exit(2); });
