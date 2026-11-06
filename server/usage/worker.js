// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Cloudflare Worker entry: POST /v1/usage takes the reports; GET / is the dashboard, GET /v1/stats its numbers (behind the secret DASH_TOKEN), GET /v1/public-stats the public
// totals (only when PUBLIC_STATS is "1"); the owner's notes, store numbers and targets are written behind the same secret. POST /v1/uninstall counts the answer of the page
// after removal. A cron trigger (wrangler.toml) sends the weekly digest and alerts through Telegram when TG_BOT_TOKEN and TG_CHAT_ID are set, and deletes what is too old.
// Binds a D1 database as `DB` (see wrangler.toml). Nothing is logged: no IP address, no header, no body.

import { handle } from './handler.js';
import { D1Store } from './d1-store.js';
import { runScheduled } from './digest.js';
import dashboardHtml from './dashboard.html';

export default {
  /** @param {Request} request @param {{ DB: any, DASH_TOKEN?: string, PUBLIC_STATS?: string, SITE_ORIGINS?: string }} env */
  async fetch(request, env) {
    const siteOrigins = env.SITE_ORIGINS ? env.SITE_ORIGINS.split(',').map((x) => x.trim()).filter(Boolean) : undefined;
    return handle(request, new D1Store(env.DB), Date.now(), { dashToken: env.DASH_TOKEN, publicStats: env.PUBLIC_STATS === '1', dashboardHtml, siteOrigins });
  },
  /** @param {{ cron: string }} event @param {any} env @param {{ waitUntil(p: Promise<any>): void }} ctx */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduled({ store: new D1Store(env.DB), now: Date.now(), env, cron: event.cron }).catch(() => ({})));
  },
};
