// Message router: pages talk to the worker only for things that need worker-side effects
// (alarms, tab redirects, notifications). Plain preference changes are written to storage directly.

import { getRaw, setRaw } from '../shared/storage.js';
import { startFocus, stopFocus, extendFocus, endRest, reviewSession, pauseFocus, resumeFocus } from './focus.js';
import { updateDay } from '../shared/storage.js';
import { dayKey } from '../shared/time.js';
import { PAUSE_REASONS } from '../shared/productivity.js';
import { setAmbient } from './audio.js';
import { updateSettings } from '../shared/storage.js';
import { grantPass } from './blocker.js';
import { completeBreak, skipBreak, snoozeBreak, openBreakPage, getEyeState } from './breaks.js';
import { sync } from './tracker.js';
import { isFocusActive } from '../shared/blocking.js';
import { syncNow } from './sync.js';
import { syncTasksNow } from './tasksync.js';
import { applySettings } from './apply.js';
import { logError } from '../shared/errorlog.js';

import { syncCalendar, armCalendar } from './calendar.js';

const handlers = {
  'calendar:sync': async () => { await armCalendar(); return syncCalendar(); },
  'focus:start': (m) => startFocus(m),
  'focus:stop': async () => {
    const { focus } = await getRaw('focus');
    if (focus && focus.strict && isFocusActive(focus)) return { ok: false, error: 'strict' };
    await stopFocus();
    return { ok: true };
  },
  'sync:now': async () => { const [settings] = await Promise.all([syncNow(), syncTasksNow()]); return settings; },
  'focus:pause': () => pauseFocus(),
  'focus:resume': () => resumeFocus(),
  'focus:extend': (m) => extendFocus(m.minutes),
  'session:review': (m) => reviewSession(m),
  'pause:reason': async (m) => {
    if (!PAUSE_REASONS.includes(m.reason)) return { ok: false };
    await updateDay(dayKey(), (d) => { (d.pr ||= {})[m.reason] = (d.pr[m.reason] || 0) + 1; });
    return { ok: true };
  },
  'ambient:set': async (m) => {
    if (!['off', 'brown', 'rain', 'river', 'forest'].includes(m.kind)) return { ok: false };
    await updateSettings((s) => { s.focus.ambient = m.kind; });
    const { focus } = await getRaw('focus');
    await setAmbient(isFocusActive(focus) ? m.kind : 'off');
    return { ok: true };
  },
  'rest:skip': async () => { await endRest({ notify: false }); return { ok: true }; },
  'pass:grant': async (m, sender) => { await grantPass(m.rule, m.minutes, sender.tab ? sender.tab.id : null); return { ok: true }; },
  'break:complete': async () => { await completeBreak(); return { ok: true }; },
  'break:skip': async () => { await skipBreak(); return { ok: true }; },
  'break:snooze': async () => { await snoozeBreak(); return { ok: true }; },
  'break:open': async () => { await openBreakPage(); return { ok: true }; },
  'break:state': () => getEyeState(),
  'tracker:sync': async () => { await sync('open'); return { ok: true }; },
  'tracking:pause': async (m) => { await setRaw({ pausedUntil: m.minutes ? Date.now() + m.minutes * 60_000 : 0 }); await sync('pause'); return { ok: true }; },
  'tab:close': async (m, sender) => { if (sender.tab) await chrome.tabs.remove(sender.tab.id); return { ok: true }; },
  'dock:pos': async (m) => { const y = Number(m.y); if (!(y >= 0.05 && y <= 0.95)) return { ok: false }; await updateSettings((s) => { s.dock.y = Math.round(y * 1000) / 1000; }, { touch: false }); return { ok: true }; }, // a place on the screen is not a settings edit: it must not win a settings sync
  'dock:page': async (m, sender) => (sender.tab ? { url: sender.tab.url || '', title: sender.tab.title || '' } : { url: '', title: '' }),
  'settings:changed': async () => { await applySettings(); return { ok: true }; },
};

// Web pages run EyeTime's content scripts (the social-site guard, the dock). A compromised page could make those speak: they may only ask for what they need.
const FROM_PAGES = new Set(['tab:close', 'dock:pos']);
const fromExtensionPage = (sender) => !sender.url || sender.url.startsWith(chrome.runtime.getURL(''));

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const fn = msg && !msg.target && handlers[msg.type];
  if (!fn) return false;
  if (!fromExtensionPage(sender) && !FROM_PAGES.has(msg.type)) return false;
  Promise.resolve(fn(msg, sender)).then(sendResponse, (e) => { logError('msg:' + msg.type, e); sendResponse({ ok: false, error: String(e && e.message || e) }); });
  return true; // async response
});
