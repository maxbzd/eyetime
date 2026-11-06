// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The store of handler.js on Cloudflare D1 (SQLite). Same behaviour as memory-store.js.

import { MAX_UNINSTALLS_PER_DAY, MAX_NOTES, MAX_NOTE_LENGTH, SETTING_KEYS, dayOf } from './limits.js';

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const PER_INSTALL = ['firsts', 'usage_weeks', 'flags', 'experiments']; // the tables that hold rows of one install, next to `installs`

export class D1Store {
  /** @param {any} db a D1 database binding */
  constructor(db) { this.db = db; }

  async lastReceived(id) {
    const row = await this.db.prepare('SELECT last_report FROM installs WHERE id = ?').bind(id).first();
    return row ? row.last_report : null;
  }

  /** how many installs reported for the first time after `since` (ms) */
  async newSince(since) {
    const row = await this.db.prepare('SELECT COUNT(*) AS n FROM installs WHERE first_report > ?').bind(since).first();
    return row ? row.n : 0;
  }

  async save(r, now) {
    const old = await this.db.prepare('SELECT act, first_report, age FROM installs WHERE id = ?').bind(r.id).first();
    const act = [...new Set([...(old ? JSON.parse(old.act) : []), ...r.act])].sort((a, b) => a - b).slice(-800);
    const week = Math.floor(now / WEEK_MS);
    const stmts = [
      this.db.prepare(`INSERT INTO installs (id, first_report, last_report, app, br, os, lang, look, layout, mode, age, act, pr) VALUES (?1, ?2, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
        ON CONFLICT(id) DO UPDATE SET last_report = ?2, app = ?3, br = ?4, os = ?5, lang = ?6, look = ?7, layout = ?8, mode = ?9, age = MAX(age, ?10), act = ?11, pr = ?12`)
        .bind(r.id, now, r.app, r.br ?? 'other', r.os ?? 'win', r.lang, r.look ?? '-', r.layout ?? '-', r.mode ?? 'auto', r.age, JSON.stringify(act), r.pr === 'win' ? 'win' : 'ext'),
      ...Object.entries(r.first).map(([f, age]) => this.db.prepare('INSERT INTO firsts (id, feature, age) VALUES (?1, ?2, ?3) ON CONFLICT(id, feature) DO UPDATE SET age = MIN(age, ?3)').bind(r.id, f, age)),
      ...(r.fl ? [this.db.prepare('DELETE FROM flags WHERE id = ?').bind(r.id), ...r.fl.map((f) => this.db.prepare('INSERT INTO flags (id, flag) VALUES (?1, ?2)').bind(r.id, f))] : []),
      ...(r.x || []).map((a) => { const [exp, arm] = a.split(':'); return this.db.prepare('INSERT INTO experiments (id, exp, arm) VALUES (?1, ?2, ?3) ON CONFLICT(id, exp) DO UPDATE SET arm = ?3').bind(r.id, exp, arm); }),
      ...Object.entries(r.ft).map(([f, n]) => this.db.prepare('INSERT INTO usage_weeks (id, week, feature, n) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(id, week, feature) DO UPDATE SET n = n + ?4').bind(r.id, week, f, n)),
    ];
    await this.db.batch(stmts);
  }

  async forget(id) {
    await this.db.batch(['installs', ...PER_INSTALL].map((t) => this.db.prepare(`DELETE FROM ${t} WHERE id = ?`).bind(id)));
  }

  /** Count one thing that happened at the door (see INGEST_KINDS), by day. */
  async tally(kind, now) {
    await this.db.prepare('INSERT INTO ingest (day, kind, n) VALUES (?1, ?2, 1) ON CONFLICT(day, kind) DO UPDATE SET n = n + 1').bind(dayOf(now), kind).run();
  }

  /** Count one answer to the question after removal. False when the day's cap is used up. */
  async tallyUninstall(reason, now) {
    const day = dayOf(now);
    const row = await this.db.prepare('SELECT COALESCE(SUM(n), 0) AS n FROM uninstalls WHERE day = ?').bind(day).first();
    if ((row ? row.n : 0) >= MAX_UNINSTALLS_PER_DAY) return false;
    await this.db.prepare('INSERT INTO uninstalls (day, reason, n) VALUES (?1, ?2, 1) ON CONFLICT(day, reason) DO UPDATE SET n = n + 1').bind(day, reason).run();
    return true;
  }

  /** A note for a day, for the charts. Returns its id, or null when there are too many. */
  async addNote(day, text) {
    const row = await this.db.prepare('SELECT COUNT(*) AS n FROM notes').first();
    if ((row ? row.n : 0) >= MAX_NOTES) return null;
    const res = await this.db.prepare('INSERT INTO notes (day, text) VALUES (?1, ?2)').bind(day, String(text).slice(0, MAX_NOTE_LENGTH)).run();
    return res?.meta?.last_row_id ?? null;
  }

  async deleteNote(id) { await this.db.prepare('DELETE FROM notes WHERE id = ?').bind(id).run(); }

  /** The numbers of the store's own dashboard, typed in by the owner for a day: what makes the coverage of the sample known. */
  async saveStoreStat(row) {
    await this.db.prepare('INSERT INTO store_stats (day, users, installs, uninstalls) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(day) DO UPDATE SET users = ?2, installs = ?3, uninstalls = ?4')
      .bind(row.day, row.users ?? null, row.installs ?? null, row.uninstalls ?? null).run();
  }

  async getSetting(key) {
    const row = await this.db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
    return row ? row.value : null;
  }

  async setSetting(key, value) {
    if (!SETTING_KEYS.test(key)) throw new Error('setting not allowed: ' + key);
    if (value === null) await this.db.prepare('DELETE FROM settings WHERE key = ?').bind(key).run();
    else await this.db.prepare('INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2').bind(key, String(value)).run();
  }

  /** Delete everything of installs that have not reported for `days` days, and the daily counters older than that. Returns how many installs went. */
  async purge(now, days) {
    const cutoff = now - days * DAY_MS, day = dayOf(cutoff);
    const row = await this.db.prepare('SELECT COUNT(*) AS n FROM installs WHERE last_report < ?').bind(cutoff).first();
    await this.db.batch([
      this.db.prepare('DELETE FROM installs WHERE last_report < ?').bind(cutoff),
      ...PER_INSTALL.map((t) => this.db.prepare(`DELETE FROM ${t} WHERE id NOT IN (SELECT id FROM installs)`)),
      this.db.prepare('DELETE FROM ingest WHERE day < ?').bind(day),
      this.db.prepare('DELETE FROM uninstalls WHERE day < ?').bind(day),
    ]);
    return row ? row.n : 0;
  }

  /** Everything the statistics are computed from (see stats.js). */
  async snapshot() {
    const all = async (sql) => (await this.db.prepare(sql).all()).results;
    const [installs, firsts, weeks, flags, experiments, notes, ingest, uninstalls, storeStats, settings] = await Promise.all([
      all('SELECT id, first_report, last_report, app, br, os, lang, look, layout, mode, age, act, pr FROM installs'),
      all('SELECT id, feature, age FROM firsts'),
      all('SELECT id, week, feature, n FROM usage_weeks'),
      all('SELECT id, flag FROM flags'),
      all('SELECT id, exp, arm FROM experiments'),
      all('SELECT id, day, text FROM notes ORDER BY day, id'),
      all('SELECT day, kind, n FROM ingest'),
      all('SELECT day, reason, n FROM uninstalls'),
      all('SELECT day, users, installs, uninstalls FROM store_stats ORDER BY day'),
      all('SELECT key, value FROM settings'),
    ]);
    return { installs: installs.map((i) => ({ ...i, act: JSON.parse(i.act) })), firsts, weeks, flags, experiments, notes, ingest, uninstalls, store_stats: storeStats, settings: Object.fromEntries(settings.map((s) => [s.key, s.value])) };
  }
}
