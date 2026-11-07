// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Where the messages to the maker are kept: in memory (tests, a local try) and on Cloudflare D1 (the Worker). Same behaviour. See feedback.sql and docs/FEEDBACK.md.
// A message has no usage ID and no IP address. Nothing here ever turns a text into markup: the dashboard shows it as text.

import { FB_STATUS, FB_LIMITS } from '../../src/shared/feedback-schema.js';

const DAY_MS = 86_400_000;
const startOfDay = (/** @type {number} */ ms) => Math.floor(ms / DAY_MS) * DAY_MS;
const DELIVERED_KEEP_MS = 14 * DAY_MS, UNDELIVERED_KEEP_MS = 180 * DAY_MS;
/** What the collector keeps of a ticket: its hash. The ticket itself is a secret of the device. */
export async function ticketHash(/** @type {string} */ t) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('eyetime-fb:' + t));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
const THEME = /^[\p{L}\p{N} _.\-/]{1,40}$/u;

/** What the owner may change about a message. Returns the checked patch, or null when anything in it is not allowed. */
export function checkPatch(/** @type {any} */ p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  const out = /** @type {Record<string, any>} */ ({});
  for (const [k, v] of Object.entries(p)) {
    if (k === 'status' && FB_STATUS.includes(v)) out.status = v;
    else if (k === 'theme' && (v === null || (typeof v === 'string' && THEME.test(v.trim())))) out.theme = v === null ? null : v.trim();
    else if (k === 'note' && (v === null || (typeof v === 'string' && v.length <= 500 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)))) out.note = v === null || !v.trim() ? null : v;
    else if (k === 'quote_ok' && typeof v === 'boolean') out.quote_ok = v;
    else if (k === 'replied' && v === true) out.replied = true;
    else return null;
  }
  return Object.keys(out).length ? out : null;
}

/** A row as the owner sees it: the hash of the ticket is not shown, only whether an answer can go back, and the answers already given. */
const parse = (/** @type {any} */ r, /** @type {any[]} */ replies = []) => { const { tk, ...rest } = r; return { ...rest, tags: JSON.parse(r.tags || '[]'), ctx: JSON.parse(r.ctx || '{}'), quote_ok: !!r.quote_ok, can_reply: !!tk, replies: replies.map((x) => ({ id: x.id, ts: x.ts, text: x.text, delivered_at: x.delivered_at ?? null })) }; };
const replyOk = (/** @type {number} */ n) => n < FB_LIMITS.replies;

export class MemoryFeedbackStore {
  constructor() { this.rows = /** @type {any[]} */ ([]); this.replies = /** @type {any[]} */ ([]); this.seq = 0; this.rseq = 0; }
  async countSince(/** @type {number} */ ms) { return this.rows.filter((r) => r.ts >= ms).length; }
  /** Keep a message. Null when the day's cap is used up. A ticket is kept as its hash. */
  async add(/** @type {any} */ m, /** @type {number} */ now, cap = 400) {
    if ((await this.countSince(startOfDay(now))) >= cap) return null;
    const row = { id: ++this.seq, ts: now, kind: m.kind, via: m.via, rating: m.rating ?? null, tags: m.tags || [], text: (m.text || '').trim(), contact: m.contact ?? null, ctx: m.ctx, status: 'new', theme: null, note: null, replied_at: null, done_at: null, quote_ok: false, tk: m.ticket ? await ticketHash(m.ticket) : null };
    this.rows.push(row);
    return row.id;
  }
  _view(/** @type {any} */ r) { const { tk, ...rest } = structuredClone(r); return { ...rest, can_reply: !!tk, replies: this.replies.filter((x) => x.fid === r.id).map(({ id, ts, text, delivered_at }) => ({ id, ts, text, delivered_at })) }; }
  async all() { return this.rows.map((r) => this._view(r)).reverse(); }
  async get(/** @type {number} */ id) { const r = this.rows.find((x) => x.id === id); return r ? this._view(r) : null; }
  async update(/** @type {number} */ id, /** @type {any} */ patch, now = Date.now()) {
    const r = this.rows.find((x) => x.id === id); if (!r) return false;
    const { replied, ...rest } = patch;
    Object.assign(r, rest);
    if (patch.status === 'done') r.done_at = now; else if (patch.status) r.done_at = null;
    if (replied) { r.replied_at = now; r.contact = null; } // answered: the address is not needed any more
    return true;
  }
  /** The owner's answer to a message that left a ticket. 'none' (no such message), 'no_ticket' (the author cannot be reached this way), 'limit' (already answered the most times), or the answer's id. */
  async addReply(/** @type {number} */ id, /** @type {string} */ text, now = Date.now()) {
    const r = this.rows.find((x) => x.id === id);
    if (!r) return 'none';
    if (!r.tk) return 'no_ticket';
    if (!replyOk(this.replies.filter((x) => x.fid === id).length)) return 'limit';
    const row = { id: ++this.rseq, fid: id, ts: now, text: text.trim(), delivered_at: null };
    this.replies.push(row);
    r.replied_at = now; r.contact = null;
    return row.id;
  }
  /** The answers waiting for these tickets; they are marked as handed over. Newest last. */
  async takeReplies(/** @type {string[]} */ tickets, now = Date.now()) {
    const out = [];
    for (const t of tickets) {
      const h = await ticketHash(t), r = this.rows.find((x) => x.tk === h); if (!r) continue;
      for (const a of this.replies.filter((x) => x.fid === r.id)) { if (a.delivered_at === null) a.delivered_at = now; out.push({ t, id: a.id, ts: a.ts, text: a.text }); }
    }
    return out;
  }
  async remove(/** @type {number} */ id) { const n = this.rows.length; this.rows = this.rows.filter((x) => x.id !== id); this.replies = this.replies.filter((x) => x.fid !== id); return this.rows.length < n; }
  /** The person deletes their own messages, with the tickets only they hold. Returns how many were deleted. */
  async forgetTickets(/** @type {string[]} */ tickets) {
    let n = 0;
    for (const t of tickets) { const h = await ticketHash(t), r = this.rows.find((x) => x.tk === h); if (r && (await this.remove(r.id))) n++; }
    return n;
  }
  /** Erase reply addresses older than `days`. Returns how many. */
  async scrubContacts(/** @type {number} */ now, days = 90) { let n = 0; for (const r of this.rows) if (r.contact && r.ts < now - days * DAY_MS) { r.contact = null; n++; } return n; }
  /** Erase answers that were handed over long ago (or never asked for), and with the last answer the ticket hash: the way back to the device closes. Returns how many answers. */
  async scrubReplies(/** @type {number} */ now) {
    const before = this.replies.length;
    this.replies = this.replies.filter((a) => (a.delivered_at === null ? now - a.ts < UNDELIVERED_KEEP_MS : now - a.delivered_at < DELIVERED_KEEP_MS));
    for (const r of this.rows) if (r.tk && now - r.ts > UNDELIVERED_KEEP_MS && !this.replies.some((a) => a.fid === r.id)) r.tk = null;
    return before - this.replies.length;
  }
}

export class D1FeedbackStore {
  constructor(/** @type {any} */ db) { this.db = db; }
  async countSince(/** @type {number} */ ms) { const r = await this.db.prepare('SELECT COUNT(*) AS n FROM feedback WHERE ts >= ?').bind(ms).first(); return r ? r.n : 0; }
  async add(/** @type {any} */ m, /** @type {number} */ now, cap = 400) {
    if ((await this.countSince(startOfDay(now))) >= cap) return null;
    const res = await this.db.prepare('INSERT INTO feedback (ts, kind, via, rating, tags, text, contact, ctx, tk) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)')
      .bind(now, m.kind, m.via, m.rating ?? null, JSON.stringify(m.tags || []), (m.text || '').trim(), m.contact ?? null, JSON.stringify(m.ctx), m.ticket ? await ticketHash(m.ticket) : null).run();
    return res?.meta?.last_row_id ?? null;
  }
  async _replies(/** @type {number | null} */ id = null) {
    const q = id === null ? this.db.prepare('SELECT * FROM feedback_replies ORDER BY id') : this.db.prepare('SELECT * FROM feedback_replies WHERE fid = ? ORDER BY id').bind(id);
    const { results } = await q.all(); return results;
  }
  async all() {
    const { results } = await this.db.prepare('SELECT * FROM feedback ORDER BY id DESC LIMIT 20000').all();
    const by = new Map(); for (const a of await this._replies()) { if (!by.has(a.fid)) by.set(a.fid, []); by.get(a.fid).push(a); }
    return results.map((r) => parse(r, by.get(r.id)));
  }
  async get(/** @type {number} */ id) { const r = await this.db.prepare('SELECT * FROM feedback WHERE id = ?').bind(id).first(); return r ? parse(r, await this._replies(id)) : null; }
  async update(/** @type {number} */ id, /** @type {any} */ patch, now = Date.now()) {
    if (!(await this.get(id))) return false;
    const sets = [], args = /** @type {any[]} */ ([]);
    const set = (/** @type {string} */ col, /** @type {any} */ v) => { args.push(v); sets.push(`${col} = ?${args.length}`); };
    for (const k of ['status', 'theme', 'note']) if (k in patch) set(k, patch[k]);
    if ('quote_ok' in patch) set('quote_ok', patch.quote_ok ? 1 : 0);
    if (patch.status) set('done_at', patch.status === 'done' ? now : null);
    if (patch.replied) { set('replied_at', now); sets.push('contact = NULL'); }
    args.push(id);
    await this.db.prepare(`UPDATE feedback SET ${sets.join(', ')} WHERE id = ?${args.length}`).bind(...args).run();
    return true;
  }
  async addReply(/** @type {number} */ id, /** @type {string} */ text, now = Date.now()) {
    const r = await this.db.prepare('SELECT tk FROM feedback WHERE id = ?').bind(id).first();
    if (!r) return 'none';
    if (!r.tk) return 'no_ticket';
    const n = await this.db.prepare('SELECT COUNT(*) AS n FROM feedback_replies WHERE fid = ?').bind(id).first();
    if (!replyOk(n ? n.n : 0)) return 'limit';
    const res = await this.db.prepare('INSERT INTO feedback_replies (fid, ts, text) VALUES (?1, ?2, ?3)').bind(id, now, text.trim()).run();
    await this.db.prepare('UPDATE feedback SET replied_at = ?1, contact = NULL WHERE id = ?2').bind(now, id).run();
    return res?.meta?.last_row_id ?? 0;
  }
  async takeReplies(/** @type {string[]} */ tickets, now = Date.now()) {
    const out = [];
    for (const t of tickets) {
      const r = await this.db.prepare('SELECT id FROM feedback WHERE tk = ?').bind(await ticketHash(t)).first(); if (!r) continue;
      for (const a of await this._replies(r.id)) out.push({ t, id: a.id, ts: a.ts, text: a.text });
      await this.db.prepare('UPDATE feedback_replies SET delivered_at = ?1 WHERE fid = ?2 AND delivered_at IS NULL').bind(now, r.id).run();
    }
    return out;
  }
  async remove(/** @type {number} */ id) { const had = await this.get(id); if (!had) return false; await this.db.prepare('DELETE FROM feedback_replies WHERE fid = ?').bind(id).run(); await this.db.prepare('DELETE FROM feedback WHERE id = ?').bind(id).run(); return true; }
  async forgetTickets(/** @type {string[]} */ tickets) {
    let n = 0;
    for (const t of tickets) { const r = await this.db.prepare('SELECT id FROM feedback WHERE tk = ?').bind(await ticketHash(t)).first(); if (r && (await this.remove(r.id))) n++; }
    return n;
  }
  async scrubContacts(/** @type {number} */ now, days = 90) {
    const r = await this.db.prepare('SELECT COUNT(*) AS n FROM feedback WHERE contact IS NOT NULL AND ts < ?').bind(now - days * DAY_MS).first();
    await this.db.prepare('UPDATE feedback SET contact = NULL WHERE contact IS NOT NULL AND ts < ?').bind(now - days * DAY_MS).run();
    return r ? r.n : 0;
  }
  async scrubReplies(/** @type {number} */ now) {
    const r = await this.db.prepare('SELECT COUNT(*) AS n FROM feedback_replies WHERE (delivered_at IS NULL AND ts < ?1) OR (delivered_at IS NOT NULL AND delivered_at < ?2)').bind(now - UNDELIVERED_KEEP_MS, now - DELIVERED_KEEP_MS).first();
    await this.db.prepare('DELETE FROM feedback_replies WHERE (delivered_at IS NULL AND ts < ?1) OR (delivered_at IS NOT NULL AND delivered_at < ?2)').bind(now - UNDELIVERED_KEEP_MS, now - DELIVERED_KEEP_MS).run();
    await this.db.prepare('UPDATE feedback SET tk = NULL WHERE tk IS NOT NULL AND ts < ?1 AND id NOT IN (SELECT fid FROM feedback_replies)').bind(now - UNDELIVERED_KEEP_MS).run();
    return r ? r.n : 0;
  }
}
