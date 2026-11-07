// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Cloudflare Worker entry: POST /v1/usage takes the reports; GET / is the dashboard, GET /v1/stats its numbers (behind the secret DASH_TOKEN), GET /v1/public-stats the public
// totals (only when PUBLIC_STATS is "1"); the owner's notes, store numbers and targets are written behind the same secret. POST /v1/uninstall counts the answer of the page
// after removal. A cron trigger (wrangler.toml) sends the weekly digest and alerts through Telegram when TG_BOT_TOKEN and TG_CHAT_ID are set, and deletes what is too old.
// POST /v1/feedback takes the messages people chose to send, POST /v1/feedback/replies hands the author's answers back to the device that asks with its ticket; the owner reads and answers behind the same secret.
// Binds a D1 database as `DB` (see wrangler.toml), and optionally another as `FEEDBACK_DB` for the messages. Nothing is logged: no IP address, no header, no body.

import { handle } from './handler.js';
import { D1Store } from './d1-store.js';
import { D1FeedbackStore } from './feedback-store.js';
import { runScheduled } from './digest.js';
import dashboardHtml from './dashboard.html';

/** Messages to the maker are best kept in a database of their own (FEEDBACK_DB, see README.md); without one they share DB. Without either binding there are no feedback routes. */
const feedbackOf = (/** @type {any} */ env) => { const db = env.FEEDBACK_DB || env.DB; return db ? new D1FeedbackStore(db) : null; };

export default {
  /** @param {Request} request @param {{ DB: any, FEEDBACK_DB?: any, DASH_TOKEN?: string, PUBLIC_STATS?: string, SITE_ORIGINS?: string }} env */
  async fetch(request, env) {
    const siteOrigins = env.SITE_ORIGINS ? env.SITE_ORIGINS.split(',').map((x) => x.trim()).filter(Boolean) : undefined;
    return handle(request, new D1Store(env.DB), Date.now(), { dashToken: env.DASH_TOKEN, publicStats: env.PUBLIC_STATS === '1', dashboardHtml, siteOrigins, feedback: feedbackOf(env) });
  },
  /** @param {{ cron: string }} event @param {any} env @param {{ waitUntil(p: Promise<any>): void }} ctx */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduled({ store: new D1Store(env.DB), now: Date.now(), env, cron: event.cron, feedback: feedbackOf(env) }).catch(() => ({})));
  },
};
