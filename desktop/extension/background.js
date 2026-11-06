// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// EyeTime Bridge. Tells the EyeTime app which page is in front, asks what is closed, and closes pages that are.
// It never decides anything: the service on this computer does. If the app is not there, nothing is closed.
import { hostOf, verdict } from './rules.js';

const HOST = 'com.eyetime.helper';
const FRESH_MS = 30000; // a decision older than this is not trusted: no helper, no blocking by this extension
let port = null;
let decision = null;
let decisionAt = 0;
const waiting = [];
let chain = Promise.resolve();

function connect() {
  try {
    port = chrome.runtime.connectNative(HOST);
    port.onMessage.addListener((m) => {
      const w = waiting.shift();
      if (w) w(m);
    });
    port.onDisconnect.addListener(() => {
      port = null;
      waiting.splice(0).forEach((w) => w(null));
    });
  } catch {
    port = null;
  }
}

/** one question at a time: the answers come back in the order they were asked */
function ask(req) {
  const run = () =>
    new Promise((resolve) => {
      if (!port) connect();
      if (!port) return resolve(null);
      const timer = setTimeout(() => {
        const i = waiting.indexOf(done);
        if (i >= 0) waiting.splice(i, 1);
        resolve(null);
      }, 4000);
      const done = (m) => {
        clearTimeout(timer);
        resolve(m);
      };
      waiting.push(done);
      try {
        port.postMessage(req);
      } catch {
        waiting.pop();
        clearTimeout(timer);
        resolve(null);
      }
    });
  chain = chain.then(run, run);
  return chain;
}

const fresh = () => decision && Date.now() - decisionAt < FRESH_MS;
const verdictFor = (url, title) => (fresh() ? verdict(decision, url, title) : { blocked: false });

function blockedPage(url, v) {
  const reason = (decision.reasons && decision.reasons[0] && decision.reasons[0].name) || '';
  const q = new URLSearchParams({ u: url, w: v.why, r: reason, k: v.word || '' });
  return chrome.runtime.getURL('blocked.html') + '?' + q.toString();
}

function check(tabId, url, title) {
  if (!url || url.startsWith(chrome.runtime.getURL(''))) return;
  const v = verdictFor(url, title);
  if (v.blocked) chrome.tabs.update(tabId, { url: blockedPage(url, v) }).catch(() => {});
}

async function tick() {
  let tab = null;
  try {
    const win = await chrome.windows.getLastFocused();
    if (win && win.focused) [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
  } catch {
    /* no window */
  }
  // what is in front (nothing, when the browser is not the window the person is in)
  await ask({ op: 'site', host: tab ? hostOf(tab.url || '') : null, incognito: !!(tab && tab.incognito), browser: 'chromium' });
  const r = await ask({ op: 'decision' });
  if (r && r.ok && r.data) {
    decision = r.data;
    decisionAt = Date.now();
  }
  if (!fresh()) return;
  const tabs = await chrome.tabs.query({});
  tabs.forEach((t) => check(t.id, t.url, t.title));
}

chrome.webNavigation.onBeforeNavigate.addListener((d) => {
  if (d.frameId === 0) check(d.tabId, d.url, '');
});
chrome.tabs.onUpdated.addListener((id, change, tab) => {
  if (change.url || change.title) check(id, tab.url, tab.title);
});
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg && msg.type === 'verdict') reply(verdictFor(msg.url, ''));
  if (msg && msg.type === 'status') reply({ connected: !!port && fresh() });
});

// the service worker is kept alive by the open connection; the alarm brings it back if the browser put it to sleep
chrome.alarms.create('eyetime-wake', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(() => tick());
setInterval(tick, 2500);
tick();
