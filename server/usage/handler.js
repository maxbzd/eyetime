// The reference collector for EyeTime's optional anonymous usage report. Plain functions over a small store, so the same code runs in a Cloudflare Worker (worker.js, D1),
// in a test (memory-store.js) or behind any other server. It accepts exactly what src/shared/usage-schema.js allows and nothing else, keeps no IP address or header,
// and forgets an id on request.

import { validateReport, validateForget, LIMITS } from '../../src/shared/usage-schema.js';

export const MIN_GAP_MS = 6 * 3_600_000; // one report per install per six hours: a faulty client cannot flood the tables
export const MAX_NEW_PER_HOUR = 1000; // installs that report for the first time, in all, per hour: a flood of made-up ids (the six-hour rule only holds for an id seen before) fills nothing past this
const HOUR_MS = 3_600_000;
const MAX_BODY = 4096;

/** Only EyeTime itself (an extension page or its worker) is a browser origin that may call this. A web page is refused, so a page cannot be made to send reports. */
export const isExtensionOrigin = (origin) => /^(chrome|moz)-extension:\/\/[a-z0-9-]{8,64}$/i.test(origin || '');

const headersFor = (origin) => ({
  ...(origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}), // the request carries no cookies and nothing secret
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
  'cache-control': 'no-store',
});

/**
 * @param {Request} req
 * @param {{ lastReceived(id: string): Promise<number | null>, newSince(since: number): Promise<number>, save(report: any, now: number): Promise<void>, forget(id: string): Promise<void> }} store
 * @param {number} now
 */
export async function handle(req, store, now = Date.now()) {
  const origin = req.headers.get('origin');
  const reply = (status, body = null, extra = {}) => new Response(body, { status, headers: { ...headersFor(origin && isExtensionOrigin(origin) ? origin : ''), ...extra } });
  const url = new URL(req.url);
  if (url.pathname !== '/v1/usage') return reply(404);
  if (origin && !isExtensionOrigin(origin)) return reply(403); // a browser says where the request comes from; a web page is not EyeTime
  if (req.method === 'OPTIONS') return reply(204);
  if (req.method !== 'POST') return reply(405);
  if (!/^application\/json\b/i.test(req.headers.get('content-type') || '')) return reply(415);
  if (Number(req.headers.get('content-length')) > MAX_BODY) return reply(413); // refused before the body is read
  const text = await req.text();
  if (text.length > MAX_BODY) return reply(413);
  let body;
  try { body = JSON.parse(text); } catch { return reply(400); }

  if (validateForget(body)) { await store.forget(body.id); return reply(204); }
  const ok = validateReport(body);
  if (!ok.ok) return reply(400, ok.why);
  const last = await store.lastReceived(body.id);
  if (last !== null && now - last < MIN_GAP_MS) return reply(429);
  if (last === null && (await store.newSince(now - HOUR_MS)) >= MAX_NEW_PER_HOUR) return reply(429, null, { 'retry-after': '3600' });
  await store.save(body, now);
  return reply(204);
}

export { LIMITS };
