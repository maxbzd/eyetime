// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Screen-time tracker. Event-driven (tab/window/idle events + a 30 s alarm) — no timers, so it survives
// MV3 service-worker suspension. The "current target" lives in storage.session; every sync() closes the
// previous interval (credits the seconds) and opens the next one.

import { getSettings, addTime, getRaw, updateDay } from '../shared/storage.js';
import { dayKey, splitAtMidnight, creditSeconds } from '../shared/time.js';
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
  let rem = 0; // ms that did not make a whole second at the last close

  // 1) close the previous interval
  if (trk && trk.host) {
    const gap = (now - trk.since) / 1000;
    if (gap > 0 && gap <= MAX_GAP) {
      // an interval that crosses midnight is split: each part goes to its own day and hour; the fractions of a second are carried, not dropped
      const { credits, rem: left } = creditSeconds(splitAtMidnight(trk.since, now), trk.rem);
      rem = left;
      let sec = 0;
      for (const c of credits) {
        await addTime({ host: trk.host, sec: c.sec, hour: new Date(c.from + (c.to - c.from) / 2).getHours(), date: new Date(c.to - 1) });
        sec += c.sec;
      }
      if (sec > 0) await onActiveTime(sec, now);
    }
  }

  // 2) open the next one
  const target = await currentTarget(settings);
  // a switch = moving from one site to a different one (context switching is what fragments attention)
  if (trk && trk.host && target && target.host !== trk.host) await updateDay(dayKey(new Date(now)), (d) => { d.sw = (d.sw || 0) + 1; });
  await session().set({ trk: target ? { host: target.host, since: now, rem } : { host: null, since: now, rem } });
  await keepTick(!!target);

  await updateBadge(settings);
}

/**
 * The 30-second alarm exists only while it has something to do: a site is being counted (its interval must be closed before it could look like a sleeping computer), or
 * a focus session or a rest is running (the badge counts its minutes down). With nobody at the keyboard and nothing running, the worker is not woken twice a minute for
 * nothing: coming back (an idle, window or tab event) runs this again and starts the alarm.
 */
async function keepTick(/** @type {boolean} */ counting) {
  const { focus, rest } = await getRaw(['focus', 'rest']);
  const need = counting || !!focus || !!rest;
  const has = !!(await chrome.alarms.get('tick'));
  if (need && !has) await chrome.alarms.create('tick', { periodInMinutes: 0.5 });
  else if (!need && has) await chrome.alarms.clear('tick');
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
  await sync('init'); // which also starts the 30-second alarm if there is something to count
}
