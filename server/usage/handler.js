// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The reference collector for EyeTime's optional anonymous usage report. Plain functions over a small store, so the same code runs in a Cloudflare Worker (worker.js, D1),
// in a test (memory-store.js) or behind any other server. It accepts exactly what src/shared/usage-schema.js allows and nothing else, keeps no IP address or header,
// and forgets an id on request.

import { validateReport, validateForget, LIMITS, UNINSTALL_REASONS, PRODUCTS } from '../../src/shared/usage-schema.js';
import { computeStats, publicStats, DIMS, normalizeTargets } from './stats.js';
import { MAX_NOTE_LENGTH } from './limits.js';
import { validateFeedback, validatePoll, validateReplyText, FB_KINDS, FB_STATUS, FB_LIMITS } from '../../src/shared/feedback-schema.js';
import { checkPatch } from './feedback-store.js';
import { feedbackSummary, filterMessages } from './feedback-stats.js';

export const MIN_GAP_MS = 6 * 3_600_000; // one report per install per six hours: a faulty client cannot flood the tables
export const MAX_NEW_PER_HOUR = 1000; // installs that report for the first time, in all, per hour: a flood of made-up ids (the six-hour rule only holds for an id seen before) fills nothing past this
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const MAX_BODY = 8192;
const MESSAGES_SHOWN = 500; // the inbox shows this many at a time; the numbers above it cover all

/** Only EyeTime itself (an extension page or its worker) is a browser origin that may call this. A web page is refused, so a page cannot be made to send reports. */
export const isExtensionOrigin = (origin) => /^(chrome|moz)-extension:\/\/[a-z0-9-]{8,64}$/i.test(origin || '');

const headersFor = (origin) => ({
  ...(origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}), // the request carries no cookies and nothing secret
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
  'cache-control': 'no-store',
});

/** Compare two secrets in time that does not depend on where they differ. */
export function sameSecret(/** @type {string} */ a, /** @type {string} */ b) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** A calendar day "YYYY-MM-DD" → days since 1970, or null when it is not a real date. */
export const calendarDay = (/** @type {any} */ v) => { if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null; const ms = Date.parse(v + 'T00:00:00Z'); return Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== v ? null : Math.floor(ms / DAY_MS); };

/**
 * The period a dashboard asks for: ?range=all, or ?days=N (1–3650, counted back from today), or ?from=YYYY-MM-DD&to=YYYY-MM-DD (either may be left out). Nothing given: the default.
 * And what it is narrowed to: ?br=chrome&lang=ru (the setup: app, br, os, lang, look, layout, mode; and the use: use, session, blocking; a value is a short slug).
 * Anything malformed is null (a 400), so a typo is never silently answered with another period.
 * @param {URL} url
 */
export function parsePeriod(url) {
  const r = parseRange(url);
  if (!r) return null;
  const filter = {};
  for (const d of DIMS) {
    const v = url.searchParams.get(d);
    if (v === null) continue;
    if (!/^[a-z0-9._-]{1,24}$/.test(v) || (d === 'pr' && !PRODUCTS.includes(v))) return null;
    filter[d] = v;
  }
  return Object.keys(filter).length ? { ...r, filter } : r;
}
/** @param {URL} url */
function parseRange(url) {
  const q = url.searchParams;
  const day = calendarDay;
  if (q.get('range') === 'all') return { all: true };
  const days = q.get('days');
  if (days !== null) return /^\d{1,4}$/.test(days) && +days >= 1 && +days <= 3650 ? { recentDays: +days } : null;
  const f = q.get('from'), t = q.get('to');
  if (f === null && t === null) return {};
  const from = f === null ? undefined : day(f), to = t === null ? undefined : day(t);
  if (from === null || to === null) return null;
  if (from !== undefined && to !== undefined && (from > to || to - from > 3650)) return null;
  return { from, to };
}

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff' };
const PAGE_HEADERS = {
  'content-type': 'text/html; charset=utf-8', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY',
  // the page is one file with its own script and style and fetches only this origin
  'content-security-policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

/** What an owner's request must carry: the dashboard's secret. 404 when none is set (the owner's side does not exist), 401 when it is wrong. */
function ownerDoor(/** @type {Request} */ req, /** @type {any} */ store, /** @type {any} */ opts) {
  if (!opts.dashToken || opts.dashToken.length < 16 || !store.snapshot) return new Response(null, { status: 404 });
  const given = /^Bearer (.+)$/.exec(req.headers.get('authorization') || '')?.[1] || '';
  return sameSecret(given, opts.dashToken) ? null : new Response(null, { status: 401, headers: { 'cache-control': 'no-store', 'www-authenticate': 'Bearer' } });
}

/** A small JSON body, or undefined when it is too long or not JSON. */
async function readJson(/** @type {Request} */ req, max = 2048) {
  const text = await req.text();
  if (text.length > max) return undefined;
  try { return JSON.parse(text); } catch { return undefined; }
}

const quiet = { 'cache-control': 'no-store' };
/** The inbox: the numbers over all messages, and the ones that match the filter (?kind= &status= &q= &written=1), newest first. */
function inboxResponse(/** @type {any[]} */ rows, /** @type {URL} */ url, /** @type {number} */ now) {
  const q = url.searchParams, kind = q.get('kind') || undefined, status = q.get('status') || undefined, text = q.get('q') || '';
  if ((kind && !FB_KINDS.includes(kind)) || (status && !FB_STATUS.includes(status)) || text.length > 100) return new Response('bad filter', { status: 400, headers: quiet });
  const shown = filterMessages(rows, { kind, status, q: text, written: q.get('written') === '1' });
  return new Response(JSON.stringify({ summary: feedbackSummary(rows, now), messages: shown.slice(0, MESSAGES_SHOWN), matching: shown.length }), { status: 200, headers: { ...JSON_HEADERS, ...quiet } });
}
const isObject = (/** @type {any} */ b) => !!b && typeof b === 'object' && !Array.isArray(b);
const count = (/** @type {any} */ v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 1_000_000_000);

/**
 * @param {Request} req
 * @param {any} store the store (memory-store.js or d1-store.js): the report, the owner's notes, the door's counters, the settings
 * @param {number} now
 * @param {{ dashToken?: string, publicStats?: boolean, dashboardHtml?: string, demo?: (now: number) => any, experiments?: { id: string, arms: string[] }[], siteOrigins?: string[], feedback?: any, demoFeedback?: (now: number) => any[] }} [opts]
 *   dashToken: the secret that opens the owner's dashboard (GET /v1/stats) and lets the owner write (notes, store numbers, targets); without it the owner's side does not exist.
 *   publicStats: also answer GET /v1/public-stats (totals over many installs only, see stats.js publicStats) to anyone.
 *   dashboardHtml: the page served at / (the dashboard).
 *   demo: makes a made-up snapshot, answered at GET /v1/demo-stats (a local preview; the Worker does not pass it).
 *   experiments: the experiments a report may name (default: EXPERIMENTS of the schema).
 *   feedback: the store of messages to the maker (feedback-store.js); without it the routes /v1/feedback do not exist and the page after removal sends the reason only.
 *   demoFeedback: makes made-up messages, answered at GET /v1/demo-feedback (a local preview).
 *   siteOrigins: the web origins that may send the answer of the page after removal (default: the project's page).
 */
export async function handle(req, store, now = Date.now(), opts = {}) {
  const origin = req.headers.get('origin');
  const reply = (status, body = null, extra = {}) => new Response(body, { status, headers: { ...headersFor(origin && isExtensionOrigin(origin) ? origin : ''), ...extra } });
  const url = new URL(req.url);
  // a thing that happened at the door, counted by day and never by who; counting must never get in the way of answering
  const door = async (/** @type {string} */ kind, /** @type {Response} */ res) => { try { await store.tally?.(kind, now); } catch { /* the counter is not the door */ } return res; };

  // the owner's side: a page, and the numbers behind it (behind a secret). Nothing here is reachable without the token, except the page itself, which holds no data.
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/dashboard') && opts.dashboardHtml) return new Response(opts.dashboardHtml, { status: 200, headers: { ...PAGE_HEADERS, 'cache-control': 'no-store' } });
  if (req.method === 'GET' && url.pathname === '/v1/stats') {
    const no = ownerDoor(req, store, opts); if (no) return no;
    const period = parsePeriod(url);
    if (!period) return new Response('bad period', { status: 400, headers: quiet });
    return new Response(JSON.stringify(computeStats(await store.snapshot(), now, period)), { status: 200, headers: { ...JSON_HEADERS, ...quiet } });
  }
  // what the owner writes: a note for the charts, the numbers of the store's dashboard, the targets
  if (url.pathname === '/v1/notes' && req.method === 'POST') {
    const no = ownerDoor(req, store, opts); if (no) return no;
    const b = await readJson(req);
    const text = isObject(b) && typeof b.text === 'string' ? b.text.trim() : '';
    if (!isObject(b) || Object.keys(b).sort().join() !== 'day,text' || calendarDay(b.day) === null || !text || text.length > MAX_NOTE_LENGTH || /[\u0000-\u001f\u007f]/.test(text)) return new Response('bad note', { status: 400, headers: quiet });
    const id = await store.addNote(b.day, text);
    return id === null ? new Response('too many notes', { status: 409, headers: quiet }) : new Response(JSON.stringify({ id }), { status: 201, headers: { ...JSON_HEADERS, ...quiet } });
  }
  const noteId = /^\/v1\/notes\/(\d{1,9})$/.exec(url.pathname);
  if (noteId && req.method === 'DELETE') {
    const no = ownerDoor(req, store, opts); if (no) return no;
    await store.deleteNote(Number(noteId[1]));
    return new Response(null, { status: 204, headers: quiet });
  }
  if (url.pathname === '/v1/store-stats' && req.method === 'PUT') {
    const no = ownerDoor(req, store, opts); if (no) return no;
    const b = await readJson(req);
    const dayNo = isObject(b) ? calendarDay(b.day) : null;
    if (!isObject(b) || Object.keys(b).some((k) => !['day', 'users', 'installs', 'uninstalls'].includes(k)) || dayNo === null || dayNo > Math.floor(now / DAY_MS) + 1 || !count(b.users ?? null) || !count(b.installs ?? null) || !count(b.uninstalls ?? null) || b.users == null) return new Response('bad numbers', { status: 400, headers: quiet });
    await store.saveStoreStat({ day: b.day, users: b.users, installs: b.installs ?? null, uninstalls: b.uninstalls ?? null });
    return new Response(null, { status: 204, headers: quiet });
  }
  if (url.pathname === '/v1/targets' && req.method === 'PUT') {
    const no = ownerDoor(req, store, opts); if (no) return no;
    const t = normalizeTargets(await readJson(req));
    if (!t.ok) return new Response('bad targets: ' + t.why, { status: 400, headers: quiet });
    await store.setSetting('targets', Object.keys(t.targets).length ? JSON.stringify(t.targets) : null);
    return new Response(null, { status: 204, headers: quiet });
  }
  // the answer of the page that opens after removal: one reason from a fixed list, counted by day, from the project's own page only
  if (url.pathname === '/v1/uninstall') {
    const sites = opts.siteOrigins || ['https://maxbzd.github.io'];
    if (origin && !sites.includes(origin)) return new Response(null, { status: 403 });
    const cors = origin ? { 'access-control-allow-origin': origin, vary: 'Origin', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400', ...quiet } : quiet;
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return new Response(null, { status: 405, headers: cors });
    if (!/^application\/json\b/i.test(req.headers.get('content-type') || '')) return new Response(null, { status: 415, headers: cors });
    const b = await readJson(req, 2048);
    const extra = isObject(b) && Object.keys(b).every((k) => (opts.feedback ? ['reason', 'text', 'contact', 'app', 'more'] : ['reason']).includes(k)); // more than the reason only where there is a store for it
    if (!extra || !UNINSTALL_REASONS.includes(b.reason) || !store.tallyUninstall) return new Response(null, { status: 400, headers: cors });
    // a few words and an address are optional: they become a message of the kind "leaving" (the reason is its tag), only where a feedback store is set up
    const written = typeof b.text === 'string' && b.text.trim() ? b.text : undefined, contact = typeof b.contact === 'string' && b.contact.trim() ? b.contact.trim() : undefined;
    if (('text' in b && typeof b.text !== 'string') || ('contact' in b && typeof b.contact !== 'string') || ('app' in b && (typeof b.app !== 'string' || !/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(b.app)))) return new Response(null, { status: 400, headers: cors });
    let msg = null;
    if (opts.feedback && (written || contact)) {
      msg = { v: 1, kind: 'leaving', via: 'removal', tags: [b.reason], ...(written ? { text: written } : {}), ...(contact ? { contact } : {}), ctx: { app: b.app || '0.0.0' } };
      if (!validateFeedback(msg).ok) return new Response(null, { status: 400, headers: cors });
    }
    if ('more' in b) { // a few words added after the reason was counted: stored as a message, not counted again
      if (b.more !== true || !msg) return new Response(null, { status: 400, headers: cors });
      return new Response(null, { status: (await opts.feedback.add(msg, now, FB_LIMITS.perDay)) === null ? 429 : 204, headers: cors });
    }
    const counted = await store.tallyUninstall(b.reason, now);
    if (counted && msg) await opts.feedback.add(msg, now);
    return new Response(null, { status: counted ? 204 : 429, headers: cors });
  }
  // messages to the maker: what people chose to send (ideas, problems, kind words, the answers to a small question), and the owner's side: read, sort, answer. A separate store, see feedback-store.js.
  if (url.pathname.startsWith('/v1/feedback') && opts.feedback) {
    const fb = opts.feedback;
    // from EyeTime itself (an extension page): one message, or the question "has the author answered?"
    if ((url.pathname === '/v1/feedback' && req.method !== 'GET') || url.pathname === '/v1/feedback/replies' || url.pathname === '/v1/feedback/forget') {
      if (origin && !isExtensionOrigin(origin)) return door('wrong_origin', reply(403));
      if (req.method === 'OPTIONS') return reply(204);
      if (req.method !== 'POST') return reply(405);
      if (!/^application\/json\b/i.test(req.headers.get('content-type') || '')) return door('bad_type', reply(415));
      const b = await readJson(req, FB_LIMITS.bytes + 512);
      if (b === undefined) return door('bad_json', reply(400));
      if (url.pathname === '/v1/feedback/forget') { // the person deletes a message of theirs, by the ticket only they hold
        if (!validatePoll(b)) return reply(400);
        await fb.forgetTickets(b.t);
        return reply(204);
      }
      if (url.pathname === '/v1/feedback/replies') {
        if (!validatePoll(b)) return reply(400);
        const found = await fb.takeReplies(b.t, now);
        return reply(200, JSON.stringify({ r: found }), JSON_HEADERS);
      }
      const ok = validateFeedback(b);
      if (!ok.ok) return door('bad_feedback', reply(400, ok.why));
      const id = await fb.add(b, now, FB_LIMITS.perDay);
      return id === null ? reply(429, null, { 'retry-after': '86400' }) : reply(204);
    }
    // the owner's side
    const no = ownerDoor(req, { snapshot: true }, opts); if (no) return no;
    if (req.method === 'GET' && url.pathname === '/v1/feedback') {
      return inboxResponse(await fb.all(), url, now);
    }
    const m = /^\/v1\/feedback\/(\d{1,9})(\/reply)?$/.exec(url.pathname);
    if (m && !m[2] && req.method === 'PATCH') {
      const patch = checkPatch(await readJson(req, 1024));
      if (!patch) return new Response('bad patch', { status: 400, headers: quiet });
      return new Response(null, { status: (await fb.update(Number(m[1]), patch, now)) ? 204 : 404, headers: quiet });
    }
    if (m && !m[2] && req.method === 'DELETE') return new Response(null, { status: (await fb.remove(Number(m[1]))) ? 204 : 404, headers: quiet });
    if (m && m[2] && req.method === 'POST') {
      const b = await readJson(req, FB_LIMITS.reply * 4 + 64);
      if (!isObject(b) || Object.keys(b).join() !== 'text' || !validateReplyText(b.text)) return new Response('bad reply', { status: 400, headers: quiet });
      const res = await fb.addReply(Number(m[1]), b.text, now);
      if (res === 'none') return new Response(null, { status: 404, headers: quiet });
      if (res === 'no_ticket') return new Response('this message cannot be answered here', { status: 409, headers: quiet });
      if (res === 'limit') return new Response('already answered the most times', { status: 409, headers: quiet });
      return new Response(JSON.stringify({ id: res }), { status: 201, headers: { ...JSON_HEADERS, ...quiet } });
    }
    return new Response(null, { status: 404, headers: quiet });
  }
  if (req.method === 'GET' && url.pathname === '/v1/demo-feedback' && opts.demoFeedback) {
    return inboxResponse(opts.demoFeedback(now), url, now);
  }
  // made-up figures for looking at the page before the first real report (the page asks for them with ?demo); only where the host passes a generator (a local preview), never in the Worker
  if (req.method === 'GET' && url.pathname === '/v1/demo-stats' && opts.demo) {
    const period = parsePeriod(url);
    if (!period) return new Response('bad period', { status: 400 });
    return new Response(JSON.stringify(computeStats(opts.demo(now), now, period)), { status: 200, headers: { ...JSON_HEADERS, ...quiet } });
  }
  if (req.method === 'GET' && url.pathname === '/v1/public-stats') {
    if (!opts.publicStats || !store.snapshot) return new Response(null, { status: 404 });
    return new Response(JSON.stringify(publicStats(computeStats(await store.snapshot(), now, { compare: false }))), { status: 200, headers: { ...JSON_HEADERS, 'cache-control': 'public, max-age=300', 'access-control-allow-origin': '*' } });
  }

  // the report itself
  if (url.pathname !== '/v1/usage') return reply(404);
  if (origin && !isExtensionOrigin(origin)) return door('wrong_origin', reply(403)); // a browser says where the request comes from; a web page is not EyeTime
  if (req.method === 'OPTIONS') return reply(204);
  if (req.method !== 'POST') return reply(405);
  if (!/^application\/json\b/i.test(req.headers.get('content-type') || '')) return door('bad_type', reply(415));
  if (Number(req.headers.get('content-length')) > MAX_BODY) return door('too_big', reply(413)); // refused before the body is read
  const text = await req.text();
  if (text.length > MAX_BODY) return door('too_big', reply(413));
  let body;
  try { body = JSON.parse(text); } catch { return door('bad_json', reply(400)); }

  if (validateForget(body)) { await store.forget(body.id); return door('forgot', reply(204)); }
  const ok = validateReport(body, opts.experiments);
  if (!ok.ok) return door('bad_report', reply(400, ok.why));
  const last = await store.lastReceived(body.id);
  if (last !== null && now - last < MIN_GAP_MS) return door('too_soon', reply(429));
  if (last === null && (await store.newSince(now - HOUR_MS)) >= MAX_NEW_PER_HOUR) return door('flood', reply(429, null, { 'retry-after': '3600' }));
  await store.save(body, now);
  return door('accepted', reply(204));
}

export { LIMITS };
