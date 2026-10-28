// Redirects tabs to the block page when policy says so. Uses only `tabs` + `webNavigation`
// (no content script on every page, no all-sites host permission).

import { evaluate, loadContext, blockedPageUrl } from '../shared/policy.js';
import { decide, redirectGraceKey, REDIRECT_GRACE_MS } from '../shared/blocking.js';
import { hostFromUrl } from '../shared/domains.js';
import { DEFAULT_SETTINGS, clone } from '../shared/defaults.js';
import { makeClassifier } from '../shared/classify.js';
import { logError } from '../shared/errorlog.js';
import { getRaw, setRaw, updateDay } from '../shared/storage.js';
import { dayKey } from '../shared/time.js';

/** If the stored policy cannot be read at all, the factory rules apply (a pause page on distracting sites) rather than letting everything through. */
function failClosed(url) {
  const host = hostFromUrl(url), settings = clone(DEFAULT_SETTINGS);
  try { return host ? { ...decide(host, { settings, classifier: makeClassifier(settings), focus: null, passes: {} }), host } : { action: 'allow' }; } catch { return { action: 'allow' }; }
}

const isWeb = (url) => /^https?:\/\//i.test(url || '');

const recent = new Map(); // tabId+url → ts: webNavigation and tabs.onUpdated both report one navigation

/** Count a temptation: the pause / block page had to step in for this host (`pa`), and whether a session was running (`fa`). */
async function logAttempt(tabId, url, d) {
  const key = tabId + '|' + url, now = Date.now();
  if (now - (recent.get(key) || 0) < 5000) return;
  recent.set(key, now);
  if (recent.size > 50) for (const [k, t] of recent) if (now - t > 5000) recent.delete(k);
  const host = (d.rule || d.host || '').replace(/^www\./, '');
  if (!host) return;
  await updateDay(dayKey(), (day) => { const pa = (day.pa ||= {}); pa[host] = (pa[host] || 0) + 1; if (d.reason === 'focus') day.fa = (day.fa || 0) + 1; });
}

export async function checkTab(tabId, url) {
  if (!isWeb(url)) return;
  let d;
  try { d = await evaluate(url, Date.now(), tabId); } catch (e) { logError('blocker:evaluate', e); d = failClosed(url); } // damaged settings must not open the gates
  if (d.action === 'allow') return;
  logAttempt(tabId, url, d).catch(() => {});
  try { await chrome.tabs.update(tabId, { url: blockedPageUrl(url, d) }); } catch { /* tab closed */ }
}

/** Re-check every open tab (after a focus session starts or the schedule / lists change). Loads policy context once. */
export async function sweepTabs() {
  const [tabs, ctx] = await Promise.all([chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }), loadContext()]);
  for (const tab of tabs) {
    const host = hostFromUrl(tab.url);
    if (!host) continue;
    let d;
    try { d = decide(host, { ...ctx, tabId: tab.id }); } catch { continue; }
    // pause-style friction should not hit tabs that were already open; only hard blocks do
    if (d.action === 'block') { try { await chrome.tabs.update(tab.id, { url: blockedPageUrl(tab.url, d) }); } catch { /* tab closed */ } }
  }
}

/** Temporary "continue" permission for a rule domain. */
export async function grantPass(rule, minutes, tabId = null) {
  const { passes = {} } = await getRaw('passes');
  const now = Date.now();
  for (const k of Object.keys(passes)) if (passes[k] <= now) delete passes[k];
  passes[rule] = now + Math.max(1, minutes) * 60_000;
  if (tabId != null) passes[redirectGraceKey(tabId)] = now + REDIRECT_GRACE_MS;
  await setRaw({ passes });
}

chrome.webNavigation.onBeforeNavigate.addListener((d) => { if (d.frameId === 0) checkTab(d.tabId, d.url); });
// Safety net for navigations webNavigation doesn't report (e.g. prerender swaps)
chrome.tabs.onUpdated.addListener((id, info, tab) => { if (info.url) checkTab(id, info.url); });
