// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// An in-memory service and an in-memory device, to run the real synchronisation against.
import { SyncError } from '../../../src/shared/sync/run.js';

export class FakeService {
  constructor() { this.clock = 1_000; this.seq = 0; this.items = new Map(); this.events = new Map(); this.complete = true; this.calls = []; this.failCreate = new Set(); this.throwOn = null; }
  tick() { return ++this.clock; }
  add(o) { const id = 'r' + ++this.seq; this.items.set(id, { id, text: '', done: false, due: null, starred: false, est: null, ...o, updatedAt: this.tick() }); return id; }
  edit(id, patch) { Object.assign(this.items.get(id), patch, { updatedAt: this.tick() }); }
  addEvent(o) { const id = 'e' + ++this.seq; this.events.set(id, { id, title: '', day: null, start: 0, end: 0, taskId: null, ...o, updatedAt: this.tick() }); return id; }
  editEvent(id, patch) { Object.assign(this.events.get(id), patch, { updatedAt: this.tick() }); }
  boom(kind, when) { this.throwOn = { kind, when }; }
  check(call) { this.calls.push(call); if (this.throwOn && this.throwOn.when === call) { const k = this.throwOn.kind; this.throwOn = null; throw new SyncError(k + ' failure', k, { status: 500 }); } }
  get provider() {
    const me = this;
    return {
      id: 'fake',
      tasks: {
        fields: ['text', 'done', 'due', 'starred', 'est'],
        async list() { me.check('list'); return { items: [...me.items.values()].map((x) => ({ ...x })), complete: me.complete }; },
        async create(item) { me.check('create'); if (me.failCreate.has(item.text)) throw new Error('refused: ' + item.text); const id = me.add({ ...item }); return { id }; },
        async update(id, patch) { me.check('update'); if (!me.items.has(id)) throw new Error('gone'); me.edit(id, patch); return {}; },
        async remove(id) { me.check('remove'); me.items.delete(id); },
      },
      events: {
        async list() { me.check('listEvents'); return { ours: [...me.events.values()].filter((e) => e.taskId).map((e) => ({ ...e })), busy: [] }; },
        async create(b) { me.check('createEvent'); const id = me.addEvent({ ...b }); return { id }; },
        async update(id, patch) { me.check('updateEvent'); if (!me.events.has(id)) throw new Error('gone'); me.editEvent(id, patch); return {}; },
        async remove(id) { me.check('removeEvent'); me.events.delete(id); },
      },
    };
  }
}

export class FakeDevice {
  constructor(tasks = []) { this.tasks = tasks; this.links = { tasks: {}, blocks: {} }; this.t = 1_700_000_000_000; this.n = 0; this.beforeWrite = null; }
  advance(ms) { this.t += ms; }
  get deps() {
    const me = this;
    return {
      now: () => me.t, newId: () => 'L' + ++me.n,
      async readTasks() { return me.tasks.map((x) => ({ ...x })); },
      async updateTasks(fn) { if (me.beforeWrite) { const f = me.beforeWrite; me.beforeWrite = null; f(me); } me.tasks = fn(me.tasks.map((x) => ({ ...x }))); },
      async readLinks(kind) { return structuredClone(me.links[kind]); },
      async writeLinks(kind, l) { me.links[kind] = structuredClone(l); },
    };
  }
  task(id) { return this.tasks.find((x) => x.id === id); }
}
