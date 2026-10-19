// Message router: pages talk to the worker only for things that need worker-side effects
// (alarms, tab redirects, notifications). Plain preference changes are written to storage directly.

import { getRaw, setRaw } from '../shared/storage.js';
import { startFocus, stopFocus } from './focus.js';
import { grantPass, sweepTabs } from './blocker.js';
import { completeBreak, skipBreak, snoozeBreak, openBreakPage, scheduleBedtime, getEyeState } from './breaks.js';
import { sync } from './tracker.js';
import { isFocusActive } from '../shared/blocking.js';

const handlers = {
  'focus:start': (m) => startFocus(m),
  'focus:stop': async () => {
    const { focus } = await getRaw('focus');
    if (focus && focus.strict && isFocusActive(focus)) return { ok: false, error: 'strict' };
    await stopFocus();
    return { ok: true };
  },
  'pass:grant': async (m) => { await grantPass(m.rule, m.minutes); return { ok: true }; },
  'break:complete': async () => { await completeBreak(); return { ok: true }; },
  'break:skip': async () => { await skipBreak(); return { ok: true }; },
  'break:snooze': async () => { await snoozeBreak(); return { ok: true }; },
  'break:open': async () => { await openBreakPage(); return { ok: true }; },
  'break:state': () => getEyeState(),
  'tracking:pause': async (m) => { await setRaw({ pausedUntil: m.minutes ? Date.now() + m.minutes * 60_000 : 0 }); await sync('pause'); return { ok: true }; },
  'tab:close': async (m, sender) => { if (sender.tab) await chrome.tabs.remove(sender.tab.id); return { ok: true }; },
  'settings:changed': async () => { await scheduleBedtime(); await sweepTabs(); await sync('settings'); return { ok: true }; },
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const fn = msg && !msg.target && handlers[msg.type];
  if (!fn) return false;
  Promise.resolve(fn(msg, sender)).then(sendResponse, (e) => sendResponse({ ok: false, error: String(e && e.message || e) }));
  return true; // async response
});
