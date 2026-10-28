// Settings → General → Dock: the edge tab on web pages. Turning it on asks the browser for access to websites (an optional permission, never at install).

import { h, toast } from '../ui/dom.js';
import { row, group, toggle, select, domainEditor } from './ui.js';
import { t } from '../shared/i18n.js';
import { DOCK_ORIGINS, DOCK_DESIGNS, dockDesign } from '../shared/dock.js';

const DESIGN_NAMES = { 1: 'Void', 2: 'Glass', 3: 'Noir' }; // names of looks, like the app's own style names

export function dockGroup(s, save, refresh = () => {}) {
  const d = s.dock || { enabled: false, side: 'right', hidden: [] };
  const status = h('div', { class: 'setting-desc sync-status', 'aria-live': 'polite' });
  async function paint() {
    let has = true;
    try { has = await chrome.permissions.contains({ origins: DOCK_ORIGINS }); } catch { /* no permissions API */ }
    const test = (chrome.runtime.getManifest().host_permissions || []).length > 0; // test builds declare the permission up front
    status.textContent = d.enabled && !has && !test ? t('opt.dockNoAccess') : '';
    status.classList.toggle('warn', !!status.textContent);
  }
  paint();

  async function turn(on) {
    if (on) {
      let ok = false;
      try { ok = await chrome.permissions.request({ origins: DOCK_ORIGINS }); } catch { /* the browser refused to ask */ } // must be the first await: it needs the click
      if (!ok) { toast(t('opt.dockDenied')); return refresh(); } // nothing was saved: no "Saved" flash, the switch just goes back
      return save((x) => { x.dock.enabled = true; }, true);
    }
    await save((x) => { x.dock.enabled = false; }, true);
    try { await chrome.permissions.remove({ origins: DOCK_ORIGINS }); } catch { /* nothing to withdraw */ }
    // a calendar link that relied on this broad access shows its "needs access" state: unsubscribing and subscribing again asks for that one site
  }

  const mainRow = row({ title: t('opt.dock'), desc: t('opt.dockDesc'), control: toggle(d.enabled, turn, t('opt.dock')) });
  mainRow.querySelector('.setting-text').append(status);
  const rows = [mainRow];
  if (d.enabled) {
    rows.push(
      row({ title: t('opt.dockSide'), control: select([['right', t('opt.dockRight')], ['left', t('opt.dockLeft')]], d.side, (v) => save((x) => { x.dock.side = v; }), { label: t('opt.dockSide') }) }),
      row({ title: t('opt.dockDesign'), desc: t('opt.dockDesignDesc'), control: select(DOCK_DESIGNS.map((n) => [n, DESIGN_NAMES[n]]), dockDesign(d), (v) => save((x) => { x.dock.design = Number(v); }), { label: t('opt.dockDesign') }) }),
      row({ title: t('opt.dockHidden'), desc: t('opt.dockHiddenDesc'), stack: true, control: domainEditor({ items: d.hidden || [], placeholder: 'example.com',
        onAdd: (host) => save((x) => { x.dock.hidden = [...new Set([...(x.dock.hidden || []), host])].slice(0, 100); }, true),
        onRemove: (host) => save((x) => { x.dock.hidden = (x.dock.hidden || []).filter((h2) => h2 !== host); }, true) }) }),
      row({ title: t('opt.dockShortcut'), desc: t('opt.dockShortcutDesc'), control: h('span', { class: 'kbd', text: 'Alt+Shift+D' }) }));
  }
  return group(t('opt.groupDock'), ...rows);
}
