// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The store of handler.js kept in memory: for tests, and a way to try the collector without a database. Same behaviour as d1-store.js.

export class MemoryStore {
  constructor() { this.installs = new Map(); this.firsts = new Map(); this.weeks = new Map(); }
  async newSince(since) { let n = 0; for (const i of this.installs.values()) if (i.first_report > since) n++; return n; }
  async lastReceived(id) { return this.installs.get(id)?.last_report ?? null; }
  async save(r, now) {
    const old = this.installs.get(r.id);
    const act = [...new Set([...(old ? old.act : []), ...r.act])].sort((a, b) => a - b).slice(-800);
    this.installs.set(r.id, { id: r.id, first_report: old ? old.first_report : now, last_report: now, app: r.app, br: r.br, os: r.os, lang: r.lang, look: r.look, layout: r.layout, mode: r.mode, age: Math.max(r.age, old ? old.age : 0), act });
    for (const [f, age] of Object.entries(r.first)) { const k = r.id + '|' + f; if (!this.firsts.has(k) || this.firsts.get(k) > age) this.firsts.set(k, age); }
    const week = Math.floor(now / (7 * 86_400_000));
    for (const [f, n] of Object.entries(r.ft)) { const k = `${r.id}|${week}|${f}`; this.weeks.set(k, (this.weeks.get(k) || 0) + n); }
  }
  async forget(id) {
    this.installs.delete(id);
    for (const m of [this.firsts, this.weeks]) for (const k of [...m.keys()]) if (k.startsWith(id + '|')) m.delete(k);
  }
}
