// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// What the parts of the Home page share. They read and write it through `state`, never through each other, so no module has to import the one that boots the page.

import { canvasActive } from '../canvas.js';

export const state = {
  /** the settings the page shows: the layout in use over the default (see home-config.js) */
  settings: /** @type {any} */ (null),
  /** the stored settings as they are, all layouts included */
  raw: /** @type {any} */ (null),
  /** whether the page shows the Today dashboard (its composer and tiles replace the focus card) */
  todayOn: /** @type {boolean | undefined} */ (undefined),
  /** the session that is running (or paused), for the tab title and the layout of a focus session */
  runningFocus: /** @type {any} */ (null),
  /** the night clock */
  standby: /** @type {any} */ (null),
  /** set by newtab.js: build the page again from `raw` (a layout that switches on by itself needs it) */
  reapply: /** @type {() => void} */ (() => {}),
};

export const isToday = (/** @type {any} */ s) => s.newtab.layout === 'today' && !canvasActive(s);


