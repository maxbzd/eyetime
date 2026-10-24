// Right-click menu (page and toolbar icon): classify or block the current site, start / stop focus.
import { getSettings, updateSettings, getRaw } from '../shared/storage.js';
import { applyMenuAction } from '../shared/menu.js';
import { hostFromUrl } from '../shared/domains.js';
import { isFocusActive } from '../shared/blocking.js';
import { resolveLocale, setLocale, t } from '../shared/i18n.js';
import { startFocus, stopFocus } from './focus.js';
import { sweepTabs } from './blocker.js';
import { updateBadge } from './badge.js';
import { buildTopicMenu } from './dock.js';

const ICON = 'icons/icon128.png';

export async function buildMenus() {
  if (!chrome.contextMenus) return;
  const s = await getSettings();
  setLocale(resolveLocale(s.language));
  await chrome.contextMenus.removeAll();
  const mk = (o) => chrome.contextMenus.create({ contexts: ['page'], ...o });
  mk({ id: 'root', title: 'EyeTime', contexts: ['page', 'action'] });
  for (const c of ['productive', 'neutral', 'distracting']) mk({ id: 'cls:' + c, parentId: 'root', title: t('menu.markAs', { cls: t('class.' + c) }), contexts: ['page'] });
  mk({ id: 'block:always', parentId: 'root', title: t('menu.alwaysBlock'), contexts: ['page'] });
  mk({ id: 'focus:toggle', parentId: 'root', title: t('menu.toggleFocus'), contexts: ['page', 'action'] });
  await buildTopicMenu();
}

chrome.contextMenus?.onClicked.addListener(async (info, tab) => {
  const id = info.menuItemId;
  if (id === 'focus:toggle') {
    const { focus } = await getRaw('focus');
    if (isFocusActive(focus)) { if (!focus.strict) await stopFocus(); return; }
    const s = await getSettings();
    await startFocus({ minutes: s.focus.minutes, strict: s.focus.strict });
    return;
  }
  const host = hostFromUrl(tab?.url);
  let result = { changed: false };
  await updateSettings((s) => { result = applyMenuAction(String(id), host, s); });
  if (!result.changed) return;
  await sweepTabs();
  const s = await getSettings();
  await updateBadge(s);
  setLocale(resolveLocale(s.language));
  chrome.notifications.create('menu-' + Date.now(), { type: 'basic', iconUrl: ICON, title: 'EyeTime', message: t(result.key, { host, cls: result.cls ? t('class.' + result.cls).toLowerCase() : '' }), priority: 0 });
});
