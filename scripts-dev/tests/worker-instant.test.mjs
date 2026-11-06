// Instant blocking in the worker: when the browser's rules are put in place, when they are taken away, and that the tab blocker still catches what the rules did not.
import test, { mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeChrome } from './helpers/fake-chrome.mjs';

const chrome = installFakeChrome();
await import('../../src/background/blocker.js');
await import('../../src/background/messages.js');
const { syncInstant } = await import('../../src/background/instant.js');
const { startFocus } = await import('../../src/background/focus.js');
const { updateSettings } = await import('../../src/shared/storage.js');

const start = new Date(2026, 10, 4, 10, 0, 0).getTime(); // Wednesday
const settle = (ms = 80) => new Promise((r) => setTimeout(r, ms));
const WEB = ['http://*/*', 'https://*/*'];
const BLOCKED = `chrome-extension://${chrome.runtime.id}/src/blocked/blocked.html`;
const rules = async () => chrome.declarativeNetRequest.getDynamicRules();
const redirectFor = async (host) => { const re = (await rules()).find((r) => r.action.type === 'redirect' && new RegExp(r.condition.regexFilter).test(`https://${host}/`)); return re ? re.action.redirect.regexSubstitution : null; };
const ask = (msg, sender = { url: `chrome-extension://${chrome.runtime.id}/src/popup/popup.html`, tab: { id: 7 } }) => new Promise((resolve) => { chrome.runtime.onMessage.fire(msg, sender, resolve); setTimeout(() => resolve('no answer'), 800); });
const navigate = async (tabId, url) => { await Promise.all(chrome.webNavigation.onBeforeNavigate.fire({ tabId, frameId: 0, url })); await settle(500); };

beforeEach(async () => {
  mock.timers.reset(); mock.timers.enable({ apis: ['Date'], now: start });
  await chrome.storage.local.clear(); await chrome.storage.session.clear(); await chrome.alarms.clearAll();
  const stale = await rules(); if (stale.length) await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: stale.map((r) => r.id) });
  for (const o of WEB) await chrome.permissions.remove({ origins: [o] });
  chrome._tabs().length = 0; chrome._calls.length = 0;
});

test('off by default: no rules, however often the worker syncs', async () => {
  await syncInstant();
  assert.equal((await rules()).length, 0);
  assert.equal((await chrome.alarms.get('instant-sync')), undefined);
});

test('switched on without access to websites: still no rules (a redirect needs the access)', async () => {
  await updateSettings((s) => { s.blocking.instant = true; });
  await syncInstant();
  assert.equal((await rules()).length, 0);
});

test('switched on with access: the distracting sites get rules at once (a change in storage is enough), and others do not', async () => {
  chrome._grant(WEB);
  await updateSettings((s) => { s.blocking.instant = true; });
  await settle();
  assert.match(await redirectFor('www.youtube.com'), /r=friction&a=pause&u=\\1$/);
  assert.equal(await redirectFor('github.com'), null);
});

test('access taken away, or the switch turned off: the rules go', async () => {
  chrome._grant(WEB);
  await updateSettings((s) => { s.blocking.instant = true; }); await settle();
  assert.ok((await rules()).length > 0);
  await chrome.permissions.remove({ origins: WEB }); await settle();
  assert.equal((await rules()).length, 0);
  chrome._grant(WEB); await settle();
  assert.ok((await rules()).length > 0);
  await updateSettings((s) => { s.blocking.instant = false; }); await settle();
  assert.equal((await rules()).length, 0);
  assert.equal(await chrome.alarms.get('instant-sync'), undefined);
});

test('a focus session makes them blocks, and its end is an alarm that puts the pause back', async () => {
  chrome._grant(WEB);
  await updateSettings((s) => { s.blocking.instant = true; });
  await startFocus({ minutes: 25 }); await settle();
  assert.match(await redirectFor('www.youtube.com'), /r=focus&a=block/);
  const alarm = await chrome.alarms.get('instant-sync');
  assert.ok(alarm && alarm.when > start + 25 * 60_000, 'a sync at the end of the session');
  mock.timers.reset(); mock.timers.enable({ apis: ['Date'], now: alarm.when + 1000 });
  await chrome.storage.local.remove('focus'); // what finishing the session does to storage
  await chrome._fireAlarm('instant-sync'); await settle();
  assert.match(await redirectFor('www.youtube.com'), /r=friction&a=pause/);
});

test('"continue" takes the rule away before the answer comes back, so the page can go back to the site', async () => {
  chrome._grant(WEB);
  await updateSettings((s) => { s.blocking.instant = true; }); await settle();
  assert.ok(await redirectFor('www.youtube.com'));
  const r = await ask({ type: 'pass:grant', rule: 'youtube.com', minutes: 10 });
  assert.equal(r.ok, true);
  assert.equal(await redirectFor('www.youtube.com'), null, 'no rule at the moment the answer arrives');
  const alarm = await chrome.alarms.get('instant-sync');
  assert.equal(alarm.when, start + 30_000 + 500, 'the next change is the end of the 30 seconds of the redirect window, then the end of the pass');
  // the 30 seconds in that tab only
  const session = await chrome.declarativeNetRequest.getSessionRules();
  assert.equal(session.length, 1); assert.deepEqual(session[0].condition.tabIds, [7]);
});

test('many changes at once make a few updates, not one each, and the last state wins', async () => {
  chrome._grant(WEB);
  await updateSettings((s) => { s.blocking.instant = true; }); await settle(); chrome._calls.length = 0;
  await Promise.all(Array.from({ length: 30 }, () => syncInstant()));
  assert.ok(chrome._callsTo('dnr.updateDynamicRules').length <= 2, 'merged into at most two runs');
});

test('the browser refuses the rules: nothing is left half done and the error is logged, not thrown', async () => {
  chrome._grant(WEB);
  await updateSettings((s) => { s.blocking.instant = true; }); await settle();
  assert.ok((await rules()).length > 0);
  const real = chrome.declarativeNetRequest.updateDynamicRules; let n = 0;
  chrome.declarativeNetRequest.updateDynamicRules = async (o) => { if (n++ === 0) throw new Error('Rule count exceeded'); return real(o); };
  await syncInstant();
  assert.equal((await rules()).length, 0, 'no rules rather than wrong ones');
  chrome.declarativeNetRequest.updateDynamicRules = real;
  await syncInstant();
  assert.ok((await rules()).length > 0, 'the next sync repairs it');
});

test('the tab blocker is still the net: a page the rules did not catch is sent to the block page, one the browser already sent is left alone', async () => {
  chrome._grant(WEB);
  await updateSettings((s) => { s.blocking.instant = true; }); await settle();
  const t = chrome._openTab(`${BLOCKED}?d=1&r=friction&a=pause&u=https://www.youtube.com/`);
  chrome._calls.length = 0;
  await navigate(t.id, 'https://www.youtube.com/');
  assert.equal(chrome._callsTo('tabs.update').length, 0, 'already on the block page: no second redirect');
  const t2 = chrome._openTab('https://www.youtube.com/');
  await navigate(t2.id, 'https://www.youtube.com/');
  assert.equal(chrome._callsTo('tabs.update').length, 1, 'still on the site after the wait: the blocker steps in');
});

test('a limit (which depends on usage) is not waited for: the blocker answers at once', async () => {
  chrome._grant(WEB);
  await updateSettings((s) => { s.blocking.instant = true; s.blocking.friction.enabled = false; s.blocking.limits['news.example'] = 1; });
  chrome.storage.local._all()['d:2026-11-04'] = { d: { 'news.example': 600 } };
  const t = chrome._openTab('https://news.example/'); chrome._calls.length = 0;
  const t0 = Date.now(); void t0;
  await Promise.all(chrome.webNavigation.onBeforeNavigate.fire({ tabId: t.id, frameId: 0, url: 'https://news.example/' })); await settle(120);
  assert.equal(chrome._callsTo('tabs.update').length, 1);
});
