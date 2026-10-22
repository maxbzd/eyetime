// Message router: pages talk to the worker only for things that need worker-side effects
// (alarms, tab redirects, notifications). Plain preference changes are written to storage directly.

import { getRaw, setRaw } from '../shared/storage.js';
import { startFocus, stopFocus, extendFocus, endRest, reviewSession } from './focus.js';
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
  'pass:grant': async (m) => { await grantPass(m.rule, m.minutes); return { ok: true }; },
  'break:complete': async () => { await completeBreak(); return { ok: true }; },
  'break:skip': async () => { await skipBreak(); return { ok: true }; },
  'break:snooze': async () => { await snoozeBreak(); return { ok: true }; },
  'break:open': async () => { await openBreakPage(); return { ok: true }; },
  'break:state': () => getEyeState(),
  'tracking:pause': async (m) => { await setRaw({ pausedUntil: m.minutes ? Date.now() + m.minutes * 60_000 : 0 }); await sync('pause'); return { ok: true }; },
  'tab:close': async (m, sender) => { if (sender.tab) await chrome.tabs.remove(sender.tab.id); return { ok: true }; },
  'settings:changed': async () => { await applySettings(); return { ok: true }; },
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const fn = msg && !msg.target && handlers[msg.type];
  if (!fn) return false;
  Promise.resolve(fn(msg, sender)).then(sendResponse, (e) => { logError('msg:' + msg.type, e); sendResponse({ ok: false, error: String(e && e.message || e) }); });
  return true; // async response
});
