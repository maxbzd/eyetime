// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The store of handler.js kept in memory: for tests, and a way to try the collector without a database. Same behaviour as d1-store.js.

import { MAX_UNINSTALLS_PER_DAY, MAX_NOTES, MAX_NOTE_LENGTH, SETTING_KEYS, dayOf } from './limits.js';

const DAY_MS = 86_400_000;

export class MemoryStore {
  constructor() {
    this.installs = new Map(); this.firsts = new Map(); this.weeks = new Map(); this.flags = new Map(); this.experiments = new Map();
    this.notes = []; this.noteSeq = 0; this.ingest = new Map(); this.uninstalls = new Map(); this.storeStats = new Map(); this.settings = new Map();
  }
  async newSince(since) { let n = 0; for (const i of this.installs.values()) if (i.first_report > since) n++; return n; }
  async lastReceived(id) { return this.installs.get(id)?.last_report ?? null; }
  async save(r, now) {
    const old = this.installs.get(r.id);
    const act = [...new Set([...(old ? old.act : []), ...r.act])].sort((a, b) => a - b).slice(-800);
    this.installs.set(r.id, { id: r.id, first_report: old ? old.first_report : now, last_report: now, app: r.app, br: r.br ?? 'other', os: r.os ?? 'win', lang: r.lang, look: r.look ?? '-', layout: r.layout ?? '-', mode: r.mode ?? 'auto', age: Math.max(r.age, old ? old.age : 0), act, pr: r.pr === 'win' ? 'win' : 'ext' });
    for (const [f, age] of Object.entries(r.first)) { const k = r.id + '|' + f; if (!this.firsts.has(k) || this.firsts.get(k) > age) this.firsts.set(k, age); }
    if (r.fl) { // a state: this report replaces the earlier one
      for (const k of [...this.flags.keys()]) if (k.startsWith(r.id + '|')) this.flags.delete(k);
      for (const f of r.fl) this.flags.set(r.id + '|' + f, true);
    }
    for (const a of r.x || []) { const [exp, arm] = a.split(':'); this.experiments.set(`${r.id}|${exp}`, arm); } // the arm an install is in
    const week = Math.floor(now / (7 * DAY_MS));
    for (const [f, n] of Object.entries(r.ft)) { const k = `${r.id}|${week}|${f}`; this.weeks.set(k, (this.weeks.get(k) || 0) + n); }
  }
  async forget(id) {
    this.installs.delete(id);
    for (const m of [this.firsts, this.weeks, this.flags, this.experiments]) for (const k of [...m.keys()]) if (k.startsWith(id + '|')) m.delete(k);
  }

  /** Count one thing that happened at the door (see INGEST_KINDS), by day. */
  async tally(kind, now) { const k = dayOf(now) + '|' + kind; this.ingest.set(k, (this.ingest.get(k) || 0) + 1); }
  /** Count one answer to the question after removal. False when the day's cap is used up. */
  async tallyUninstall(reason, now) {
    const day = dayOf(now); let total = 0;
    for (const [k, n] of this.uninstalls) if (k.startsWith(day + '|')) total += n;
    if (total >= MAX_UNINSTALLS_PER_DAY) return false;
    const k = day + '|' + reason; this.uninstalls.set(k, (this.uninstalls.get(k) || 0) + 1);
    return true;
  }
  /** A note for a day, for the charts. Returns its id, or null when there are too many. */
  async addNote(day, text) {
    if (this.notes.length >= MAX_NOTES) return null;
    const note = { id: ++this.noteSeq, day, text: String(text).slice(0, MAX_NOTE_LENGTH) };
    this.notes.push(note);
    return note.id;
  }
  async deleteNote(id) { this.notes = this.notes.filter((n) => n.id !== id); }
  /** The numbers of the store's own dashboard (active users, installs, removals), typed in by the owner for a day: what makes the coverage of the sample known. */
  async saveStoreStat(row) { this.storeStats.set(row.day, { day: row.day, users: row.users ?? null, installs: row.installs ?? null, uninstalls: row.uninstalls ?? null }); }
  async getSetting(key) { return this.settings.get(key) ?? null; }
  async setSetting(key, value) {
    if (!SETTING_KEYS.test(key)) throw new Error('setting not allowed: ' + key);
    if (value === null) this.settings.delete(key); else this.settings.set(key, String(value));
  }
  /** Delete everything of installs that have not reported for `days` days, and the daily counters older than that. Returns how many installs went. */
  async purge(now, days) {
    const cutoff = now - days * DAY_MS, gone = [...this.installs.values()].filter((i) => i.last_report < cutoff).map((i) => i.id);
    for (const id of gone) await this.forget(id);
    const day = dayOf(cutoff);
    for (const m of [this.ingest, this.uninstalls]) for (const k of [...m.keys()]) if (k.split('|')[0] < day) m.delete(k);
    return gone.length;
  }

  /** Everything the statistics are computed from (see stats.js). */
  async snapshot() {
    const pairs = (m) => [...m].map(([k, n]) => { const [day, what] = k.split('|'); return { day, what, n }; });
    return {
      installs: [...this.installs.values()].map((i) => ({ ...i })),
      firsts: [...this.firsts].map(([k, age]) => { const [id, feature] = k.split('|'); return { id, feature, age }; }),
      weeks: [...this.weeks].map(([k, n]) => { const [id, week, feature] = k.split('|'); return { id, week: Number(week), feature, n }; }),
      flags: [...this.flags.keys()].map((k) => { const [id, flag] = k.split('|'); return { id, flag }; }),
      experiments: [...this.experiments].map(([k, arm]) => { const [id, exp] = k.split('|'); return { id, exp, arm }; }),
      notes: this.notes.map((n) => ({ ...n })),
      ingest: pairs(this.ingest).map(({ day, what, n }) => ({ day, kind: what, n })),
      uninstalls: pairs(this.uninstalls).map(({ day, what, n }) => ({ day, reason: what, n })),
      store_stats: [...this.storeStats.values()].map((r) => ({ ...r })),
      settings: Object.fromEntries(this.settings),
    };
  }
}
