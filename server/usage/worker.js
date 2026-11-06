// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Cloudflare Worker entry: POST /v1/usage takes the reports; GET / is the dashboard, GET /v1/stats its numbers (behind the secret DASH_TOKEN), GET /v1/public-stats the public
// totals (only when PUBLIC_STATS is "1"). Binds a D1 database as `DB` (see wrangler.toml). Nothing is logged: no IP address, no header, no body.

import { handle } from './handler.js';
import { D1Store } from './d1-store.js';
import dashboardHtml from './dashboard.html';

export default {
  /** @param {Request} request @param {{ DB: any, DASH_TOKEN?: string, PUBLIC_STATS?: string }} env */
  async fetch(request, env) {
    return handle(request, new D1Store(env.DB), Date.now(), { dashToken: env.DASH_TOKEN, publicStats: env.PUBLIC_STATS === '1', dashboardHtml });
  },
};
