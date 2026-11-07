// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Looks at the dashboard on this machine, with made-up people: node scripts-dev/dashboard-preview.mjs [port]  → http://127.0.0.1:8787/?demo
// Serves the real handler (the page, the doors, the numbers) over a MemoryStore filled with the demo population. Nothing leaves the machine.
import http from 'node:http';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { handle } from '../server/usage/handler.js';
import { MemoryStore } from '../server/usage/memory-store.js';
import { makeDemoSnapshot } from '../server/usage/demo-data.js';
import { MemoryFeedbackStore } from '../server/usage/feedback-store.js';
import { makeDemoFeedback } from '../server/usage/demo-feedback.js';

const port = Number(process.argv[2]) || 8787;
const html = readFileSync(new URL('../server/usage/dashboard.html', import.meta.url), 'utf8');
const store = new MemoryStore();
const TOKEN = 'preview-token-0123456789';
store.snapshot = async () => makeDemoSnapshot(Date.now());
// the owner's view has messages you can really answer: the made-up ones, each with a ticket (the answer is handed out at POST /v1/feedback/replies, ticket "ticket-<id>")
const feedback = new MemoryFeedbackStore();
feedback.rows = makeDemoFeedback(Date.now()).reverse().map((r) => { const { can_reply, replies, ...row } = r; return { ...row, tk: can_reply ? 'preview-' + r.id : null }; });
feedback.seq = feedback.rows.length;
const opts = { dashToken: TOKEN, publicStats: true, dashboardHtml: html, demo: (/** @type {number} */ now) => makeDemoSnapshot(now), feedback, demoFeedback: makeDemoFeedback };

http.createServer(async (rq, rs) => {
  const url = `http://127.0.0.1:${port}${rq.url}`;
  const chunks = []; for await (const c of rq) chunks.push(c);
  const body = chunks.length && rq.method !== 'GET' && rq.method !== 'HEAD' ? Buffer.concat(chunks) : undefined;
  const res = await handle(new Request(url, { method: rq.method, headers: /** @type {any} */ (rq.headers), body }), store, Date.now(), opts);
  rs.writeHead(res.status, Object.fromEntries(res.headers));
  rs.end(Buffer.from(await res.arrayBuffer()));
}).listen(port, '127.0.0.1', () => console.log(`dashboard preview: http://127.0.0.1:${port}/?demo   (owner view: http://127.0.0.1:${port}/#t=${TOKEN}, public: /?public)`));
