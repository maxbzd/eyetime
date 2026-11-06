// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Google: Calendar (busy times in, planned focus blocks out) and Tasks (a task list), through the person's own Google sign-in.
// Needs the OAuth client of EyeTime (oauth-config.js, docs/CONNECTIONS.md); without it this connection says it is not available in this build.
//
// Mapping: Tasks — title ⇄ text · status ⇄ done · due (a date) ⇄ due. Calendar — only events EyeTime made (they carry a private property); a block moved in Google moves the task.

import { json, http } from '../http.js';
import { SyncError } from '../run.js';
import { GOOGLE_CLIENT_ID } from '../oauth-config.js';
import { googleToken } from '../oauth.js';

const CAL = 'https://www.googleapis.com/calendar/v3', TASKS = 'https://tasks.googleapis.com/tasks/v1';
export const SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/tasks'];
const MAX_PAGES = 15;

const localParts = (/** @type {string} */ iso) => { const d = new Date(iso); return { day: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, min: d.getHours() * 60 + d.getMinutes() }; };
const hhmm = (/** @type {number} */ n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
const iso = (/** @type {string} */ day, /** @type {number} */ min) => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d, Math.floor(min / 60), min % 60).toISOString(); };

export const google = {
  id: 'google', label: 'Google', icon: 'calendar-days', kinds: ['tasks', 'events'], oauth: true,
  available: () => !!GOOGLE_CLIENT_ID,
  fields: [],
  origins: () => ['https://www.googleapis.com/*', 'https://tasks.googleapis.com/*'],

  /** The sign-in: a window, then the token (kept in the connection's secrets). */
  async signIn(/** @type {any} */ env = {}) { return googleToken(GOOGLE_CLIENT_ID, SCOPES, { interactive: true }, env); },

  async discover(/** @type {any} */ _conn, /** @type {any} */ secrets, /** @type {any} */ env = {}) {
    const auth = { authorization: 'Bearer ' + secrets.accessToken };
    const cals = await json(`${CAL}/users/me/calendarList?minAccessRole=writer`, { headers: auth, fetchImpl: env.fetchImpl });
    const lists = await json(`${TASKS}/users/@me/lists`, { headers: auth, fetchImpl: env.fetchImpl });
    return { calendars: (cals.items || []).map((/** @type {any} */ c) => ({ id: c.id, name: c.summaryOverride || c.summary })), taskLists: (lists.items || []).map((/** @type {any} */ l) => ({ id: l.id, name: l.title })) };
  },

  build(/** @type {any} */ conn, /** @type {any} */ secrets, /** @type {any} */ env = {}) {
    const o = conn.options || {}, now = () => (env.now ? env.now() : Date.now());
    /** @type {{ accessToken: string, expiresAt: number }} */ let tok = { accessToken: secrets.accessToken, expiresAt: secrets.expiresAt || 0 };
    /** A token for this run: the stored one while it lasts, else asked for again without a window. */
    const auth = async () => {
      if (!tok.accessToken || tok.expiresAt - 60_000 < now()) { tok = await googleToken(GOOGLE_CLIENT_ID, SCOPES, { interactive: false, email: o.email }, env); if (env.saveToken) await env.saveToken(tok); }
      return { authorization: 'Bearer ' + tok.accessToken };
    };
    const call = async (/** @type {string} */ url, /** @type {any} */ opts = {}) => json(url, { ...opts, headers: await auth(), fetchImpl: env.fetchImpl });
    const out = /** @type {any} */ ({});

    if (o.taskList) {
      const base = `${TASKS}/lists/${encodeURIComponent(o.taskList)}/tasks`;
      const norm = (/** @type {any} */ t) => ({ id: t.id, text: String(t.title || '').trim(), done: t.status === 'completed', due: t.due ? String(t.due).slice(0, 10) : null, updatedAt: Date.parse(t.updated || '') || 0 });
      const body = (/** @type {Record<string, any>} */ p) => { const b = /** @type {Record<string, any>} */ ({}); if ('text' in p) b.title = p.text; if ('due' in p) b.due = p.due ? p.due + 'T00:00:00.000Z' : null; if ('done' in p) { b.status = p.done ? 'completed' : 'needsAction'; if (!p.done) b.completed = null; } return b; };
      out.tasks = {
        fields: ['text', 'done', 'due'],
        async list() {
          const items = []; let token = '', more = true;
          for (let i = 0; i < MAX_PAGES && more; i++) {
            const r = await call(`${base}?showCompleted=true&showHidden=true&maxResults=100${token ? '&pageToken=' + encodeURIComponent(token) : ''}`);
            for (const t of r.items || []) if (!t.deleted) items.push(norm(t));
            token = r.nextPageToken || ''; more = !!token;
          }
          return { items: items.filter((t) => t.text), complete: !more };
        },
        async create(/** @type {any} */ it) { const r = await call(base, { method: 'POST', data: body({ text: it.text, due: it.due, done: it.done }) }); return { id: r.id }; },
        async update(/** @type {string} */ id, /** @type {Record<string, any>} */ patch) { await call(`${base}/${encodeURIComponent(id)}`, { method: 'PATCH', data: body(patch) }); return {}; },
        async remove(/** @type {string} */ id) { await http(`${base}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: await auth(), fetchImpl: env.fetchImpl, accept: [404, 410] }); },
      };
    }

    if (o.calendar) {
      const base = `${CAL}/calendars/${encodeURIComponent(o.calendar)}/events`;
      const range = (/** @type {string} */ from, /** @type {string} */ to) => `timeMin=${encodeURIComponent(iso(from, 0))}&timeMax=${encodeURIComponent(iso(to, 24 * 60 - 1))}&singleEvents=true&maxResults=250`;
      const body = (/** @type {any} */ b) => ({ summary: b.title, start: { dateTime: iso(b.day, b.start) }, end: { dateTime: iso(b.day, b.end) }, reminders: { useDefault: false }, extendedProperties: { private: { eyetimeBlock: '1', eyetimeTask: b.taskId } } });
      out.events = {
        async list(/** @type {{ from: string, to: string }} */ { from, to }) {
          const ours = [], busy = [];
          for (let pageToken = '', i = 0; i < MAX_PAGES; i++) {
            const r = await call(`${base}?${range(from, to)}${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`);
            for (const e of r.items || []) {
              if (e.status === 'cancelled') continue;
              const priv = e.extendedProperties && e.extendedProperties.private;
              if (priv && priv.eyetimeBlock === '1' && e.start && e.start.dateTime && e.end && e.end.dateTime) {
                const s = localParts(e.start.dateTime), en = localParts(e.end.dateTime);
                if (s.day === en.day) { ours.push({ id: e.id, taskId: priv.eyetimeTask || '', title: String(e.summary || '').trim(), day: s.day, start: s.min, end: en.min, updatedAt: Date.parse(e.updated || '') || 0 }); continue; }
              }
              if (e.transparency === 'transparent') continue; // "free" events do not make the person busy
              if (e.start && e.start.date) busy.push({ id: e.id, title: e.summary || '', day: e.start.date, allDay: true });
              else if (e.start && e.start.dateTime && e.end) { const s = localParts(e.start.dateTime), en = localParts(e.end.dateTime); if (s.day === en.day) busy.push({ id: e.id, title: e.summary || '', day: s.day, start: hhmm(s.min), end: hhmm(en.min) }); }
            }
            pageToken = r.nextPageToken || ''; if (!pageToken) break;
          }
          return { ours, busy };
        },
        async create(/** @type {any} */ b) { const r = await call(base, { method: 'POST', data: body(b) }); return { id: r.id, etag: r.etag }; },
        async update(/** @type {string} */ id, /** @type {any} */ _p, /** @type {any} */ b) { const r = await call(`${base}/${encodeURIComponent(id)}`, { method: 'PATCH', data: body(b) }); return { etag: r.etag }; },
        async remove(/** @type {string} */ id) { await http(`${base}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: await auth(), fetchImpl: env.fetchImpl, accept: [404, 410] }); },
      };
    }
    if (!out.tasks && !out.events) throw new SyncError('choose a task list or a calendar first', 'other');
    return out;
  },
};
