// A pretend browser for the tests of the service worker: the parts of the `chrome.*` API that EyeTime's worker uses, with the behaviour that matters
// (storage that notifies, alarms that can be fired, tabs and windows that can be set up, events that can be raised) and nothing else.
//   import { installFakeChrome } from './helpers/fake-chrome.mjs';
//   const chrome = installFakeChrome();       // sets globalThis.chrome; import the module under test AFTER this
//
// Strict on purpose: calling something that is not in here throws "fake chrome: missing ...", so a new use of the API shows up as a failing test and a new line here,
// and is never silently ignored. A test controls time with node:test's `mock.timers.enable({ apis: ['Date'] })` (the worker only reads Date.now() and `new Date()`).

const clone = (v) => (v === undefined ? undefined : structuredClone(v));

function event() {
  const listeners = [];
  return {
    addListener: (fn) => { listeners.push(fn); },
    removeListener: (fn) => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); },
    hasListener: (fn) => listeners.includes(fn),
    /** raise the event: every listener is called; the results (promises included) are returned */
    fire: (...args) => listeners.map((fn) => fn(...args)),
    listeners,
  };
}

function storageArea(name, onChanged, { quota = Infinity } = {}) {
  let data = {};
  const pick = (keys) => {
    if (keys == null) return clone(data);
    if (typeof keys === 'string') keys = [keys];
    const out = {};
    if (Array.isArray(keys)) for (const k of keys) { if (k in data) out[k] = clone(data[k]); }
    else for (const [k, d] of Object.entries(keys)) out[k] = k in data ? clone(data[k]) : d; // an object: its values are the defaults
    return out;
  };
  return {
    get: async (keys) => pick(keys),
    set: async (items) => {
      const changes = {};
      for (const [k, v] of Object.entries(items)) { changes[k] = { oldValue: clone(data[k]), newValue: clone(v) }; }
      if (JSON.stringify({ ...data, ...items }).length > quota) throw new Error('QUOTA_BYTES quota exceeded');
      for (const [k, v] of Object.entries(items)) data[k] = clone(v);
      onChanged.fire(changes, name);
    },
    remove: async (keys) => {
      const changes = {};
      for (const k of [].concat(keys)) if (k in data) { changes[k] = { oldValue: clone(data[k]) }; delete data[k]; }
      if (Object.keys(changes).length) onChanged.fire(changes, name);
    },
    clear: async () => { const changes = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, { oldValue: v }])); data = {}; if (Object.keys(changes).length) onChanged.fire(changes, name); },
    getBytesInUse: async (keys) => JSON.stringify(keys == null ? data : pick(keys)).length,
    /** for the tests: everything that is stored, without a copy and without events */
    _all: () => data,
  };
}

/** @param {{ extensionId?: string, firefox?: boolean }} [opts] */
export function installFakeChrome({ extensionId = 'fakeextensionidfakeextensionid12', firefox = false } = {}) {
  const storageChanged = event();
  const alarmsEvent = event();
  const alarmTable = new Map();
  const tabsState = { nextId: 1, list: [] };
  const win = { id: 1, focused: true, incognito: false };
  const calls = []; // what the worker asked of the browser, in order: [api, ...args]
  const log = (api, ...args) => calls.push([api, ...args]);

  const chrome = {
    _calls: calls,
    _alarms: alarmTable,
    runtime: {
      id: extensionId,
      getURL: (p = '') => `chrome-extension://${extensionId}/${String(p).replace(/^\//, '')}`,
      getManifest: () => ({ version: '3.7.0', host_permissions: undefined }),
      getContexts: async () => [],
      sendMessage: async (m) => { log('runtime.sendMessage', m); return undefined; },
      onMessage: event(), onInstalled: event(), onStartup: event(),
      lastError: undefined,
    },
    storage: {
      local: storageArea('local', storageChanged, { quota: 10_000_000 }),
      session: storageArea('session', storageChanged),
      sync: storageArea('sync', storageChanged, { quota: 102_400 }),
      onChanged: storageChanged,
    },
    alarms: {
      onAlarm: alarmsEvent,
      create: async (name, info = {}) => { if (typeof name === 'object') { info = name; name = ''; } alarmTable.set(name, { name, ...info }); log('alarms.create', name, info); },
      get: async (name) => alarmTable.get(name),
      getAll: async () => [...alarmTable.values()],
      clear: async (name) => { log('alarms.clear', name); return alarmTable.delete(name); },
      clearAll: async () => { alarmTable.clear(); return true; },
    },
    tabs: {
      onUpdated: event(), onActivated: event(), onRemoved: event(), onCreated: event(),
      query: async (q = {}) => tabsState.list.filter((t) => (q.active === undefined || t.active === q.active) && (q.windowId === undefined || t.windowId === q.windowId) && (!q.url || [].concat(q.url).some((p) => new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$').test(t.url)))).map(clone),
      get: async (id) => { const t = tabsState.list.find((x) => x.id === id); if (!t) throw new Error('No tab with id: ' + id); return clone(t); },
      update: async (id, props) => { const t = tabsState.list.find((x) => x.id === id); if (!t) throw new Error('No tab with id: ' + id); log('tabs.update', id, props); Object.assign(t, props.url ? { url: props.url } : {}); return clone(t); },
      create: async (props) => { log('tabs.create', props); const t = { id: tabsState.nextId++, windowId: win.id, active: props.active !== false, incognito: false, audible: false, ...props }; tabsState.list.push(t); return clone(t); },
      remove: async (id) => { log('tabs.remove', id); const i = tabsState.list.findIndex((x) => x.id === id); if (i < 0) throw new Error('No tab with id: ' + id); tabsState.list.splice(i, 1); },
      sendMessage: async (id, m) => { log('tabs.sendMessage', id, m); },
    },
    windows: {
      onFocusChanged: event(),
      getLastFocused: async () => clone(win),
    },
    idle: {
      _state: 'active',
      onStateChanged: event(),
      setDetectionInterval: (s) => log('idle.setDetectionInterval', s),
      queryState: async () => chrome.idle._state,
    },
    webNavigation: { onBeforeNavigate: event() },
    notifications: {
      onClicked: event(), onButtonClicked: event(), onClosed: event(),
      create: async (id, opts) => { log('notifications.create', id, opts); return id; },
      clear: async (id) => { log('notifications.clear', id); return true; },
    },
    action: {
      setBadgeText: async (o) => log('action.setBadgeText', o), setBadgeBackgroundColor: async (o) => log('action.setBadgeBackgroundColor', o),
      setBadgeTextColor: async (o) => log('action.setBadgeTextColor', o), setTitle: async (o) => log('action.setTitle', o),
    },
    contextMenus: { create: (o) => { log('contextMenus.create', o); return o.id; }, removeAll: async () => log('contextMenus.removeAll'), onClicked: event() },
    commands: { onCommand: event() },
    i18n: { getMessage: (k) => k, getUILanguage: () => 'en' },
    permissions: { contains: async () => false, request: async () => false, remove: async () => true, onAdded: event(), onRemoved: event() },
    scripting: { registerContentScripts: async () => {}, unregisterContentScripts: async () => {}, getRegisteredContentScripts: async () => [], updateContentScripts: async () => {} },
    offscreen: { createDocument: async (o) => log('offscreen.createDocument', o), closeDocument: async () => {}, Reason: { AUDIO_PLAYBACK: 'AUDIO_PLAYBACK' } },

    // ---- what a test does to the pretend browser ----
    _window: win,
    /** open a tab (active by default) and return it */
    _openTab(url, props = {}) {
      const t = { id: tabsState.nextId++, windowId: win.id, url, title: url, active: true, incognito: false, audible: false, ...props };
      if (t.active) for (const o of tabsState.list) if (o.windowId === t.windowId) o.active = false;
      tabsState.list.push(t);
      return t;
    },
    _tabs: () => tabsState.list,
    /** fire the alarm of that name now (and drop it if it is a one-shot) */
    async _fireAlarm(name) {
      const a = alarmTable.get(name);
      if (!a) return false;
      if (!a.periodInMinutes) alarmTable.delete(name);
      await Promise.all(alarmsEvent.fire({ name, scheduledTime: Date.now() }));
      return true;
    },
    /** every call to a given API, as the argument lists */
    _callsTo: (api) => calls.filter((c) => c[0] === api).map((c) => c.slice(1)),
  };
  // Firefox has no 10 MB cap and a different way to say which browser it is
  if (firefox) chrome.runtime.getBrowserInfo = async () => ({ name: 'Firefox' });
  // a strict wrapper for the namespaces that matter: asking for something that is not there is an error with the name of what is missing
  const strict = (obj, path) => new Proxy(obj, { get(t, k, r) { if (k in t || typeof k === 'symbol' || k.startsWith('_') || k === 'then' || k === 'toJSON') return Reflect.get(t, k, r); throw new Error(`fake chrome: missing ${path}.${String(k)}`); } });
  const wrapped = {};
  for (const [k, v] of Object.entries(chrome)) wrapped[k] = k.startsWith('_') || typeof v !== 'object' ? v : strict(v, 'chrome.' + k);
  globalThis.chrome = strict(wrapped, 'chrome');
  return globalThis.chrome;
}
