// Redirects tabs to the block page when policy says so. Uses only `tabs` + `webNavigation`
// (no content script on every page, no all-sites host permission).

import { evaluate, blockedPageUrl } from '../shared/policy.js';
import { getRaw, setRaw } from '../shared/storage.js';

const isWeb = (url) => /^https?:\/\//i.test(url || '');

export async function checkTab(tabId, url) {
  if (!isWeb(url)) return;
  const d = await evaluate(url);
  if (d.action === 'allow') return;
  try { await chrome.tabs.update(tabId, { url: blockedPageUrl(url, d) }); } catch { /* tab closed */ }
}

/** Re-check every open tab (after a focus session starts or the schedule / lists change). */
export async function sweepTabs() {
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  // pause-style friction should not hit tabs that were already open; only hard blocks do
  for (const tab of tabs) {
    const d = await evaluate(tab.url);
    if (d.action === 'block') { try { await chrome.tabs.update(tab.id, { url: blockedPageUrl(tab.url, d) }); } catch { /* ignore */ } }
  }
}

/** Temporary "continue" permission for a rule domain. */
export async function grantPass(rule, minutes) {
  const { passes = {} } = await getRaw('passes');
  const now = Date.now();
  for (const k of Object.keys(passes)) if (passes[k] <= now) delete passes[k];
  passes[rule] = now + Math.max(1, minutes) * 60_000;
  await setRaw({ passes });
}

chrome.webNavigation.onBeforeNavigate.addListener((d) => { if (d.frameId === 0) checkTab(d.tabId, d.url); });
// Safety net for navigations webNavigation doesn't report (e.g. prerender swaps)
chrome.tabs.onUpdated.addListener((id, info, tab) => { if (info.url) checkTab(id, info.url); });
