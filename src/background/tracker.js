// Screen-time tracker. Event-driven (tab/window/idle events + a 30 s alarm) — no timers, so it survives
// MV3 service-worker suspension. The "current target" lives in storage.session; every sync() closes the
// previous interval (credits the seconds) and opens the next one.

import { getSettings, addTime, getRaw } from '../shared/storage.js';
import { hostFromUrl, matchesAny } from '../shared/domains.js';
import { updateBadge } from './badge.js';
import { onActiveTime } from './breaks.js';

const MAX_GAP = 120; // seconds; a longer silence means the machine slept — don't credit it
const session = () => chrome.storage.session;

let chain = Promise.resolve();
/** Serialised: overlapping events never double-count. */
export function sync(reason = '') {
  chain = chain.then(() => run(reason)).catch((e) => console.warn('[tracker]', e));
  return chain;
}

async function currentTarget(settings) {
  const t = settings.tracking;
  if (!t.enabled) return null;
  const { pausedUntil = 0 } = await getRaw('pausedUntil');
  if (pausedUntil > Date.now()) return null;

  let win;
  try { win = await chrome.windows.getLastFocused(); } catch { return null; }
  if (!win || !win.focused) return null; // another app has focus (desktop companion may cover that)

  const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
  if (!tab) return null;
  const host = hostFromUrl(tab.url);
  if (!host || matchesAny(host, t.excluded)) return null;
  if (tab.incognito && !t.incognito) return null;

  const idle = await chrome.idle.queryState(Math.max(15, t.idleSeconds));
  if (idle !== 'active' && !(t.countAudible && tab.audible)) return null;
  return { host, tabId: tab.id };
}

async function run(reason) {
  const now = Date.now();
  const settings = await getSettings();
  const { trk } = await session().get('trk');

  // 1) close the previous interval
  if (trk && trk.host) {
    const sec = Math.round((now - trk.since) / 1000);
    if (sec > 0 && sec <= MAX_GAP) {
      const hour = new Date(trk.since + (now - trk.since) / 2).getHours();
      await addTime({ host: trk.host, sec, hour, date: new Date(now) });
      await onActiveTime(sec, now);
    }
  }

  // 2) open the next one
  const target = await currentTarget(settings);
  await session().set({ trk: target ? { host: target.host, since: now } : { host: null, since: now } });

  await updateBadge(settings);
}

/* ---------- wiring (registered synchronously at worker start) ---------- */

chrome.tabs.onActivated.addListener(() => sync('activated'));
chrome.tabs.onUpdated.addListener((id, info) => { if (info.url || info.status === 'complete' || 'audible' in info) sync('updated'); });
chrome.tabs.onRemoved.addListener(() => sync('removed'));
chrome.windows.onFocusChanged.addListener(() => sync('focus'));
chrome.idle.onStateChanged.addListener((state) => sync('idle:' + state));

chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'tick') sync('tick'); });

export async function initTracker() {
  const settings = await getSettings();
  chrome.idle.setDetectionInterval(Math.max(15, settings.tracking.idleSeconds));
  await chrome.alarms.create('tick', { periodInMinutes: 0.5 });
  await sync('init');
}
