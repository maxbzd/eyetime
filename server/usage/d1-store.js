// The store of handler.js on Cloudflare D1 (SQLite). Same behaviour as memory-store.js.

const WEEK_MS = 7 * 86_400_000;

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
      this.db.prepare(`INSERT INTO installs (id, first_report, last_report, app, br, os, lang, look, layout, mode, age, act) VALUES (?1, ?2, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
        ON CONFLICT(id) DO UPDATE SET last_report = ?2, app = ?3, br = ?4, os = ?5, lang = ?6, look = ?7, layout = ?8, mode = ?9, age = MAX(age, ?10), act = ?11`)
        .bind(r.id, now, r.app, r.br, r.os, r.lang, r.look, r.layout, r.mode, r.age, JSON.stringify(act)),
      ...Object.entries(r.first).map(([f, age]) => this.db.prepare('INSERT INTO firsts (id, feature, age) VALUES (?1, ?2, ?3) ON CONFLICT(id, feature) DO UPDATE SET age = MIN(age, ?3)').bind(r.id, f, age)),
      ...Object.entries(r.ft).map(([f, n]) => this.db.prepare('INSERT INTO usage_weeks (id, week, feature, n) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(id, week, feature) DO UPDATE SET n = n + ?4').bind(r.id, week, f, n)),
    ];
    await this.db.batch(stmts);
  }

  async forget(id) {
    await this.db.batch(['installs', 'firsts', 'usage_weeks'].map((t) => this.db.prepare(`DELETE FROM ${t} WHERE id = ?`).bind(id)));
  }
}
