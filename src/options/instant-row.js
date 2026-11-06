// Settings → Blocking: "Instant blocking". The browser itself sends a distracting tab to the pause page, before any request is made (see shared/dnr.js).
// It needs access to websites, an optional permission that is asked for here, at the click, and given back when this is switched off (unless the Dock still uses it).

import { h, toast } from '../ui/dom.js';
import { row, toggle } from './ui.js';
import { t } from '../shared/i18n.js';

const ORIGINS = ['http://*/*', 'https://*/*'];

/** @returns {HTMLElement | null} null in a browser without declarativeNetRequest (the setting would do nothing) */
export function instantRow(/** @type {any} */ s, /** @type {Function} */ save, /** @type {Function} */ refresh = () => {}) {
  if (!chrome.declarativeNetRequest) return null;
  const on = !!s.blocking.instant;
  const status = h('div', { class: 'setting-desc sync-status', 'aria-live': 'polite' });
  (async () => {
    let has = true;
    try { has = await chrome.permissions.contains({ origins: ORIGINS }); } catch { /* no permissions API */ }
    const test = (chrome.runtime.getManifest().host_permissions || []).length > 0; // test builds declare the permission up front
    status.textContent = on && !has && !test ? t('opt.instantNoAccess') : '';
    status.classList.toggle('warn', !!status.textContent);
  })();

  async function turn(/** @type {boolean} */ value) {
    if (value) {
      let ok = false;
      try { ok = await chrome.permissions.request({ origins: ORIGINS }); } catch { /* the browser refused to ask */ } // must be the first await: it needs the click
      if (!ok) { toast(t('opt.instantDenied')); return refresh(); }
      return save((x) => { x.blocking.instant = true; }, true);
    }
    await save((x) => { x.blocking.instant = false; }, true);
    if (!s.dock || !s.dock.enabled) { try { await chrome.permissions.remove({ origins: ORIGINS }); } catch { /* nothing to withdraw */ } } // the Dock is the only other thing that uses it
  }

  const r = row({ adv: 'instant', title: t('opt.instant'), desc: t('opt.instantDesc'), control: toggle(on, turn, t('opt.instant')) });
  r.querySelector('.setting-text').append(status);
  return r;
}
