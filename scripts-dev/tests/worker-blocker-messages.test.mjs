// What the worker does when a site is opened (the pause or block page, the "continue" passes, the count of temptations), and who may talk to it.
import test, { mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeChrome } from './helpers/fake-chrome.mjs';

const chrome = installFakeChrome();
await import('../../src/background/blocker.js');
await import('../../src/background/messages.js');
const { startFocus } = await import('../../src/background/focus.js');
const { updateSettings, getRaw } = await import('../../src/shared/storage.js');

const start = new Date(2026, 10, 4, 10, 0, 0).getTime(); // Wednesday
const settle = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const navigate = async (tabId, url) => { await Promise.all(chrome.webNavigation.onBeforeNavigate.fire({ tabId, frameId: 0, url })); await settle(); };
const redirects = () => chrome._callsTo('tabs.update').map(([, props]) => new URL(props.url));
const day = () => chrome.storage.local._all()['d:2026-11-04'] || {};
const EXT = `chrome-extension://${chrome.runtime.id}/src/popup/popup.html`;
/** what a page sends to the worker, and what comes back (undefined: the worker did not answer, as for a message it ignores) */
const ask = (msg, sender = { url: EXT, tab: { id: 7 } }) => new Promise((resolve) => {
  let answered = false;
  const results = chrome.runtime.onMessage.fire(msg, sender, (r) => { answered = true; resolve(r); });
  if (!results.some((r) => r === true)) resolve(undefined);
  else setTimeout(() => { if (!answered) resolve('no answer'); }, 500);
});

beforeEach(async () => {
  mock.timers.reset(); mock.timers.enable({ apis: ['Date'], now: start });
  await chrome.storage.local.clear(); await chrome.storage.session.clear(); await chrome.alarms.clearAll();
  chrome._tabs().length = 0; chrome._calls.length = 0;
});

test('a distracting site gets the pause page, a neutral one nothing, and a page that is not a website nothing', async () => {
  const t = chrome._openTab('about:blank');
  await navigate(t.id, 'https://www.youtube.com/watch?v=1');
  const r = redirects();
  assert.equal(r.length, 1);
  assert.equal(`${r[0].protocol}//${r[0].host}`, `chrome-extension://${chrome.runtime.id}`); assert.equal(r[0].pathname, '/src/blocked/blocked.html');
  assert.equal(r[0].searchParams.get('u'), 'https://www.youtube.com/watch?v=1'); assert.equal(r[0].searchParams.get('r'), 'friction'); assert.equal(r[0].searchParams.get('a'), 'pause');
  chrome._calls.length = 0;
  await navigate(t.id, 'https://example.org/'); await navigate(t.id, 'chrome://extensions'); await navigate(t.id, 'file:///tmp/x.html');
  assert.deepEqual(redirects(), []);
});

test('only the top frame is looked at', async () => {
  await Promise.all(chrome.webNavigation.onBeforeNavigate.fire({ tabId: 1, frameId: 3, url: 'https://www.youtube.com/embed/1' })); await settle();
  assert.deepEqual(redirects(), []);
});

test('during a focus session a distracting site is a hard block, and the attempt is counted once in five seconds', async () => {
  await startFocus({ minutes: 25 });
  chrome._calls.length = 0;
  const t = chrome._openTab('about:blank');
  await navigate(t.id, 'https://www.reddit.com/'); await navigate(t.id, 'https://www.reddit.com/');
  const r = redirects();
  assert.ok(r.length >= 1 && r[0].searchParams.get('r') === 'focus' && r[0].searchParams.get('a') === 'block');
  assert.equal(day().pa['reddit.com'], 1, 'the same attempt reported twice (webNavigation and the tab update) is one temptation');
  assert.equal(day().fa, 1, 'and it is marked as one that happened during a session');
});

test('"continue" lets the site through for the minutes given, for that site only, and a passed site is not stopped again', async () => {
  const t = chrome._openTab('about:blank');
  assert.deepEqual(await ask({ type: 'pass:grant', rule: 'youtube.com', minutes: 10 }, { url: EXT, tab: { id: t.id } }), { ok: true });
  chrome._calls.length = 0;
  await navigate(t.id, 'https://www.youtube.com/'); assert.deepEqual(redirects(), [], 'passed');
  const other = chrome._openTab('about:blank');
  await navigate(other.id, 'https://www.reddit.com/'); assert.equal(redirects().length, 1, 'another site, in another tab, is not covered by the pass');
  chrome._calls.length = 0;
  await navigate(t.id, 'https://www.reddit.com/'); assert.deepEqual(redirects(), [], 'the tab that pressed continue may follow the redirects of that visit for thirty seconds (youtu.be -> youtube.com)');
  mock.timers.tick(31_000);
  await navigate(t.id, 'https://www.reddit.com/'); assert.equal(redirects().length, 1, 'and no longer');
  mock.timers.tick(11 * 60_000); chrome._calls.length = 0;
  await navigate(other.id, 'https://www.youtube.com/'); assert.equal(redirects().length, 1, 'the pass ran out');
});

test('messages from a web page are ignored, except the two a content script needs', async () => {
  const page = { url: 'https://evil.example/', tab: { id: 3 } };
  for (const m of [{ type: 'focus:start', minutes: 5 }, { type: 'pass:grant', rule: 'youtube.com', minutes: 480 }, { type: 'tracking:pause', minutes: 600 }, { type: 'sync:now' }]) {
    assert.equal(await ask(m, page), undefined, m.type);
  }
  assert.equal((await getRaw('focus')).focus, undefined, 'nothing started');
  assert.equal((await getRaw('passes')).passes, undefined, 'nothing granted');
  const t = chrome._openTab('https://evil.example/');
  assert.deepEqual(await ask({ type: 'tab:close' }, { url: 'https://youtube.com/', tab: { id: t.id } }), { ok: true });
  assert.equal(chrome._tabs().length, 0, 'the short-video guard may close its own tab');
  assert.deepEqual(await ask({ type: 'dock:pos', y: 0.5 }, page), { ok: true });
  assert.deepEqual(await ask({ type: 'dock:pos', y: 7 }, page), { ok: false }, 'and a place off the screen is refused');
});

test('what a page sends is bounded: a pass is at most eight hours, a tracking pause at most a day, nonsense is refused', async () => {
  await ask({ type: 'pass:grant', rule: 'youtube.com', minutes: 1e9 });
  let pass = (await getRaw('passes')).passes['youtube.com'];
  assert.equal(pass, start + 480 * 60_000);
  await ask({ type: 'pass:grant', rule: 'youtube.com', minutes: 'soon' });
  pass = (await getRaw('passes')).passes['youtube.com'];
  assert.equal(pass, start + 10 * 60_000, 'not a number: the usual ten minutes');
  assert.deepEqual(await ask({ type: 'pass:grant', rule: 'a b', minutes: 5 }), { ok: false, error: 'rule' });
  assert.deepEqual(await ask({ type: 'pass:grant', rule: '', minutes: 5 }), { ok: false, error: 'rule' });
  await ask({ type: 'tracking:pause', minutes: 1e9 });
  assert.equal((await getRaw('pausedUntil')).pausedUntil, start + 24 * 60 * 60_000);
  await ask({ type: 'tracking:pause', minutes: 0 });
  assert.equal((await getRaw('pausedUntil')).pausedUntil, 0, '0 ends a pause');
});

test('a strict session cannot be stopped from a page, a normal one can', async () => {
  await startFocus({ minutes: 25, strict: true });
  assert.deepEqual(await ask({ type: 'focus:stop' }), { ok: false, error: 'strict' });
  assert.ok((await getRaw('focus')).focus);
  await chrome.storage.local.set({ focus: null });
  await startFocus({ minutes: 25 });
  assert.deepEqual(await ask({ type: 'focus:stop' }), { ok: true });
  assert.equal((await getRaw('focus')).focus, null);
});

test('opening the tabs again when a session starts: a tab that was open on a distracting site is hard-blocked, a pause-style one is left alone', async () => {
  chrome._openTab('https://www.youtube.com/', { active: false });
  chrome._openTab('https://example.org/', { active: false });
  await startFocus({ minutes: 25 }); await settle();
  const r = redirects();
  assert.equal(r.length, 1); assert.equal(r[0].searchParams.get('u'), 'https://www.youtube.com/');
  assert.equal(r[0].searchParams.get('a'), 'block');
  await updateSettings(() => {});
});
