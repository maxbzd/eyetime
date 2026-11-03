// The reference collector for EyeTime's optional anonymous usage report. Plain functions over a small store, so the same code runs in a Cloudflare Worker (worker.js, D1),
// in a test (memory-store.js) or behind any other server. It accepts exactly what src/shared/usage-schema.js allows and nothing else, keeps no IP address or header,
// and forgets an id on request.

import { validateReport, validateForget, LIMITS } from '../../src/shared/usage-schema.js';

export const MIN_GAP_MS = 6 * 3_600_000; // one report per install per six hours: a faulty client cannot flood the tables
const MAX_BODY = 4096;

const cors = {
  'access-control-allow-origin': '*', // the extension's origin is chrome-extension://<id> / moz-extension://<id>; the request carries no cookies and nothing secret
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
  'cache-control': 'no-store',
};
const reply = (status, body = null) => new Response(body, { status, headers: cors });

/**
 * @param {Request} req
 * @param {{ lastReceived(id: string): Promise<number | null>, save(report: any, now: number): Promise<void>, forget(id: string): Promise<void> }} store
 * @param {number} now
 */
export async function handle(req, store, now = Date.now()) {
  const url = new URL(req.url);
  if (url.pathname !== '/v1/usage') return reply(404);
  if (req.method === 'OPTIONS') return reply(204);
  if (req.method !== 'POST') return reply(405);
  if (!/^application\/json\b/i.test(req.headers.get('content-type') || '')) return reply(415);
  const text = await req.text();
  if (text.length > MAX_BODY) return reply(413);
  let body;
  try { body = JSON.parse(text); } catch { return reply(400); }

  if (validateForget(body)) { await store.forget(body.id); return reply(204); }
  const ok = validateReport(body);
  if (!ok.ok) return reply(400, ok.why);
  const last = await store.lastReceived(body.id);
  if (last !== null && now - last < MIN_GAP_MS) return reply(429);
  await store.save(body, now);
  return reply(204);
}

export { LIMITS };
