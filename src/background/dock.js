// The dock: a small tab on the edge of web pages that opens EyeTime's side panel (src/dock/). It needs access to websites, which the person grants
// in Settings (an optional permission: asked on the click, never at install). Everything stays on the device; the page script only draws the tab
// and an extension iframe — it reads nothing from the page except its address and title when the person saves it.
//
// This module: registers / removes the page script, the keyboard shortcut and the "Save to topic" right-click menu.

import { getSettings, getCollection, updateCollection } from '../shared/storage.js';
import { ensureInbox, addLink } from '../shared/topics.js';
import { resolveLocale, setLocale, t } from '../shared/i18n.js';
import { DOCK_ORIGINS } from '../shared/dock.js';

const SCRIPT_ID = 'eyetime-dock';
const ICON = 'icons/icon128.png';

const hasAccess = async () => { try { return await chrome.permissions.contains({ origins: DOCK_ORIGINS }); } catch { return false; } };
// test builds declare a local host permission in the manifest; a store build never does
const localOnly = () => { try { const hp = chrome.runtime.getManifest().host_permissions || []; return hp.length && !hp.some((p) => p === '<all_urls>' || p.startsWith('https://*')) ? hp.filter((p) => p.startsWith('http://127.0.0.1')) : null; } catch { return null; } };

/** Registers the page script when the dock is on and access was granted; removes it otherwise. Safe to call any time. */
export async function syncDock() {
  if (!chrome.scripting || !chrome.scripting.registerContentScripts) return;
  try {
    const s = await getSettings();
    const test = localOnly();
    const on = !!s.dock.enabled && (test ? true : await hasAccess());
    const have = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
    if (!on) { if (have.length) await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] }); return; }
    const hidden = (s.dock.hidden || []).filter((h) => /^[a-z0-9.-]+$/i.test(h)).flatMap((h) => [`*://${h}/*`, `*://*.${h}/*`]);
    const def = { id: SCRIPT_ID, matches: test || DOCK_ORIGINS, excludeMatches: hidden, js: ['src/content/dock.js'], runAt: 'document_idle', allFrames: false, persistAcrossSessions: true };
    if (have.length) await chrome.scripting.updateContentScripts([def]); else await chrome.scripting.registerContentScripts([def]);
  } catch { /* no scripting API (very old browser) or a bad pattern: the dock simply stays off */ }
}

/** "Save to EyeTime topic" in the right-click menu: one entry per topic (the inbox first). Called by buildMenus. */
export async function buildTopicMenu() {
  if (!chrome.contextMenus) return;
  const s = await getSettings();
  if (!s.dock.enabled) return;
  setLocale(resolveLocale(s.language));
  const topics = ensureInbox(await getCollection('topics', []), t('topic.inbox')).slice(0, 12);
  const ctx = ['page', 'link'];
  chrome.contextMenus.create({ id: 'dock:root', title: t('menu.saveTo'), contexts: ctx });
  for (const tp of topics) chrome.contextMenus.create({ id: 'dock:save:' + tp.id, parentId: 'dock:root', title: (tp.id === 'inbox' ? t('topic.inbox') : tp.title).slice(0, 40), contexts: ctx });
}

chrome.contextMenus?.onClicked.addListener(async (info, tab) => {
  const id = String(info.menuItemId);
  if (!id.startsWith('dock:save:')) return;
  const topicId = id.slice('dock:save:'.length);
  const url = info.linkUrl || info.pageUrl || (tab && tab.url) || '';
  const title = info.linkUrl ? '' : (tab && tab.title) || '';
  const s = await getSettings();
  setLocale(resolveLocale(s.language));
  let res = null, name = '';
  await updateCollection('topics', [], (cur) => {
    const list = ensureInbox(cur, t('topic.inbox'));
    res = addLink(list, topicId, { url, title });
    name = (list.find((x) => x.id === topicId) || {}).title || '';
    return res.added ? res.topics : list.length !== cur.length ? list : undefined;
  });
  const msg = res && res.added ? t('menu.saved', { topic: name }) : res && res.reason === 'duplicate' ? t('menu.savedDup', { topic: name }) : t('menu.saveFail');
  chrome.notifications.create('dock-save-' + Date.now(), { type: 'basic', iconUrl: ICON, title: 'EyeTime', message: msg, priority: 0 });
});

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== 'toggle-dock') return;
  try { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); if (tab && tab.id != null) await chrome.tabs.sendMessage(tab.id, { type: 'dock:toggle' }); } catch { /* no dock on this page */ }
});

chrome.permissions?.onRemoved?.addListener(() => syncDock());
