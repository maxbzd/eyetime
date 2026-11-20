// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// What an update leaves behind when a part of Elvani is taken away: the settings and the saved data of the parts that are gone (the weather, the sorting of unknown
// sites, the widgets that were dropped), so that nothing of them stays in a person's storage. Runs once, when an older version is updated; safe to run again.

import { updateSettings } from '../shared/storage.js';
import { normalizeWidgets, WIDGET_ID_RE } from '../shared/widgets.js';

/** Storage keys of parts that no longer exist. */
const GONE_KEYS = ['weatherCache', 'siteGuess'];

export async function dropRetired() {
  await chrome.storage.local.remove(GONE_KEYS);
  await updateSettings((s) => {
    delete s.weather; delete s.smartSites;
    const n = s.newtab;
    if (n && Array.isArray(n.widgets)) {
      const kept = normalizeWidgets(n.widgets), ids = new Set(kept.map((w) => w.id));
      n.widgets = kept;
      // the place a dropped widget had on the free-form Home goes with it
      const items = n.canvas && n.canvas.items;
      if (items && typeof items === 'object') for (const id of Object.keys(items)) if (WIDGET_ID_RE.test(id) && !ids.has(id)) delete items[id];
    }
  }, { touch: false }); // not a deliberate edit: it must not win a settings sync over another browser's
}
