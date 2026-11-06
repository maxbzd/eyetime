// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Cloudflare Worker entry: POST /v1/usage. Binds a D1 database as `DB` (see wrangler.toml). Nothing is logged: no IP address, no header, no body.

import { handle } from './handler.js';
import { D1Store } from './d1-store.js';

export default {
  /** @param {Request} request @param {{ DB: any }} env */
  async fetch(request, env) { return handle(request, new D1Store(env.DB), Date.now()); },
};
