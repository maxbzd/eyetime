// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The one way the connections talk to the network: a request with a time limit, no cookies, no referrer, and every failure turned into a SyncError the runner understands
// (sign-in refused → 'auth', too many requests → 'rate' with the wait, unreachable → 'network', anything else → 'other').

import { SyncError } from './run.js';
import { errorText } from '../errorlog.js';

export const sleep = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {string} url
 * @param {{ method?: string, headers?: Record<string, string>, body?: string | null, timeoutMs?: number, fetchImpl?: typeof fetch, accept?: number[] }} [o]
 * `accept`: extra statuses that are not errors (e.g. 404 when asking whether something exists)
 * @returns {Promise<Response>}
 */
export async function http(url, { method = 'GET', headers = {}, body = null, timeoutMs = 20_000, fetchImpl = fetch, accept = [] } = {}) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs);
  let res;
  try { res = await fetchImpl(url, { method, headers, body, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', redirect: 'follow', signal: ctl.signal }); }
  catch (e) { throw new SyncError(ctl.signal.aborted ? 'timeout' : 'network: ' + errorText(e).slice(0, 80), 'network'); }
  finally { clearTimeout(timer); }
  if (res.ok || accept.includes(res.status)) return res;
  if (res.status === 401 || res.status === 403) throw new SyncError('sign-in refused (' + res.status + ')', 'auth', { status: res.status });
  if (res.status === 429) { const wait = Number(res.headers.get('retry-after')); throw new SyncError('too many requests', 'rate', { status: 429, retryAfter: wait > 0 ? wait : 60 }); }
  const text = await res.text().catch(() => '');
  throw new SyncError(`${method} ${new URL(url).host} → ${res.status} ${text.slice(0, 100)}`.trim(), 'other', { status: res.status });
}

/** JSON in, JSON out (an empty answer is `null`). */
export async function json(/** @type {string} */ url, /** @type {Parameters<typeof http>[1] & { data?: any }} */ o = {}) {
  const { data, ...rest } = o;
  const res = await http(url, { ...rest, headers: { accept: 'application/json', ...(data !== undefined ? { 'content-type': 'application/json' } : {}), ...(rest.headers || {}) }, body: data !== undefined ? JSON.stringify(data) : rest.body });
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { throw new SyncError('the answer was not JSON', 'other', { status: res.status }); }
}
