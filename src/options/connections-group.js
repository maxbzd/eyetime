// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Settings → Data & privacy → Connected services: Todoist, Notion, Google, Microsoft and CalDAV (iCloud, Fastmail, Nextcloud…) kept in step with the tasks and the calendar here.
// This file is only the screen: what is kept lives in shared/connections.js, the conversation with each service in shared/sync/, the schedule in background/connections.js.
// A browser asks for permission only on a click, so the permission request is always the first thing a click does.

import { h, icon, toast, confirmDialog, openModal, retire } from '../ui/dom.js';
import { send } from '../ui/api.js';
import { dropdown } from '../ui/dropdown.js';
import { row, toggle } from './ui.js';
import { t, fmtDate, fmtTime } from '../shared/i18n.js';
import { listConnections, saveConnection, patchConnection, removeConnection, newConnId, getSecrets, setSecrets, MAX_CONNECTIONS, vaultState, enableVault, unlockWith, lockVault, disableVault, changePassphrase, resetVault, WrongPassphraseError } from '../shared/connections.js';
import { PROVIDERS, providerList } from '../shared/sync/providers/index.js';
import { SyncError } from '../shared/sync/run.js';
import { passphraseDialog, newPassphraseProblem } from './passphrase-dialog.js';
import { track } from '../shared/usage-store.js';

const FIELD_HELP = { todoist: 'cn.h.todoist', notion: 'cn.h.notion', caldav: 'cn.h.caldav' };
const CALDAV_PRESETS = [['iCloud', 'https://caldav.icloud.com'], ['Fastmail', 'https://caldav.fastmail.com'], ['Nextcloud', 'https://']];

const request = (/** @type {any} */ p) => chrome.permissions.request(p).catch(() => false);
const have = (/** @type {string[]} */ origins) => chrome.permissions.contains({ origins }).catch(() => false);

/** One line about how a connection is doing. */
export function statusLine(/** @type {any} */ c, now = Date.now()) {
  const s = c.status || {};
  if (!s.at) return t('cn.never');
  if (s.needsUnlock) return t('cn.err.locked');
  if (s.needsAuth) return t('cn.err.auth');
  if (s.ok === false) {
    const when = s.retryAt && s.retryAt > now ? fmtTime(new Date(s.retryAt)) : '';
    return s.error === 'permission' ? t('cn.err.permission') : s.error === 'rate' ? t('cn.err.rate', { when }) : s.error === 'network' ? t('cn.err.network') : t('cn.err.other', { detail: s.detail || '' });
  }
  const parts = [t('cn.last', { when: fmtDate(new Date(s.at)) + ' ' + fmtTime(new Date(s.at)) })];
  if (s.tasks) { const r = s.tasks, up = r.createdRemote + r.updatedRemote + r.deletedRemote, down = r.createdLocal + r.updatedLocal + r.deletedLocal; if (up || down) parts.push(t('cn.counts', { up, down })); }
  if (c.calendar && typeof s.events === 'number') parts.push(t('cn.events', { n: s.events }));
  return parts.join(' · ');
}

export function connectionsGroup() {
  const list = h('div', { class: 'card list' });
  const onStore = (/** @type {any} */ ch, /** @type {string} */ area) => { if ((area === 'local' && (ch.conns || ch.vault)) || (area === 'session' && ch.vaultKey)) { if (!list.isConnected) chrome.storage.onChanged.removeListener(onStore); else paint(); } };
  chrome.storage.onChanged.addListener(onStore);

  async function paint() {
    const conns = Object.values(await listConnections());
    const rows = [await vaultRow(paint), ...conns.map((c) => connectionRow(c, paint))];
    rows.push(row({
      title: conns.length ? t('cn.add') : t('cn.empty'), desc: conns.length ? '' : t('cn.desc'),
      control: conns.length >= MAX_CONNECTIONS ? null : h('button', { class: 'btn', type: 'button', id: 'cnAdd', onclick: () => openConnect(paint) }, icon('plus'), t('cn.add')),
    }));
    list.replaceChildren(...rows);
  }
  paint();
  return h('div', { id: 'connections' }, h('h3', { class: 'group-title', text: t('cn.title') }), list);
}

/* ---------- the passphrase for the sign-in details ---------- */

/**
 * A small dialog with password fields. `fields`: [{ id, label }]; `check(values)` returns a message to show in place (the dialog stays open) or '' to go on; it may throw
 * to say a thing went wrong. Resolves with the values, or null when cancelled.
 * @param {{ title: string, body?: string, fields: { id: string, label: string }[], confirm: string, danger?: boolean, check?: (v: Record<string, string>) => Promise<string> | string }} o
 */

/** The first row: the passphrase is off, set (and given since the browser started), or set and still to be given. */
async function vaultRow(/** @type {() => void} */ repaint) {
  const state = await vaultState();
  const wrong = (/** @type {unknown} */ e) => (e instanceof WrongPassphraseError ? t('cn.vault.wrong') : t('common.error'));
  const done = (/** @type {string} */ key) => { toast(t(key)); send('vault:unlocked').catch(() => {}); repaint(); };
  const btn = (/** @type {string} */ id, /** @type {string} */ label, /** @type {() => Promise<void>} */ run, cls = 'btn') => h('button', { class: cls, type: 'button', id, onclick: run, text: label });

  if (state === 'off') {
    return row({ title: t('cn.vault.title'), desc: t('cn.vault.desc'), control: btn('vaultSet', t('cn.vault.set'), async () => {
      const v = await passphraseDialog({ title: t('cn.vault.setTitle'), body: t('cn.vault.setBody'), fields: [{ id: 'pass', label: t('cn.vault.pass') }, { id: 'pass2', label: t('cn.vault.pass2') }], confirm: t('cn.vault.set'), check: newPassphraseProblem });
      if (v) { await enableVault(v.pass); done('cn.vault.isOn'); }
    }) });
  }
  if (state === 'locked') {
    return row({ title: t('cn.vault.titleLocked'), desc: t('cn.vault.descLocked'), control: h('div', { class: 'row gap-2' },
      btn('vaultUnlock', t('cn.vault.unlock'), async () => {
        const v = await passphraseDialog({ title: t('cn.vault.unlock'), fields: [{ id: 'pass', label: t('cn.vault.pass') }], confirm: t('cn.vault.unlock'), check: async (x) => { try { await unlockWith(x.pass); return ''; } catch (e) { return wrong(e); } } });
        if (v) done('cn.vault.unlocked');
      }, 'btn btn-primary'),
      btn('vaultForgot', t('cn.vault.forgot'), async () => {
        if (await confirmDialog({ title: t('cn.vault.forgotTitle'), body: t('cn.vault.forgotBody'), confirm: t('cn.vault.forgotGo'), danger: true })) { await resetVault(); send('conn:arm').catch(() => {}); toast(t('cn.vault.wasReset')); repaint(); }
      }, 'btn btn-ghost')) });
  }
  return row({ title: t('cn.vault.titleOn'), desc: t('cn.vault.descOn'), control: h('div', { class: 'row gap-2' },
    btn('vaultLock', t('cn.vault.lock'), async () => { await lockVault(); toast(t('cn.vault.locked')); repaint(); }),
    btn('vaultChange', t('cn.vault.change'), async () => {
      const v = await passphraseDialog({ title: t('cn.vault.change'), fields: [{ id: 'old', label: t('cn.vault.old') }, { id: 'pass', label: t('cn.vault.pass') }, { id: 'pass2', label: t('cn.vault.pass2') }], confirm: t('cn.vault.change'),
        check: async (x) => { const p = newPassphraseProblem(x); if (p) return p; try { await changePassphrase(x.old, x.pass); return ''; } catch (e) { return wrong(e); } } });
      if (v) done('cn.vault.changed');
    }),
    btn('vaultOff', t('cn.vault.off'), async () => {
      const v = await passphraseDialog({ title: t('cn.vault.off'), body: t('cn.vault.offBody'), fields: [{ id: 'pass', label: t('cn.vault.pass') }], confirm: t('cn.vault.off'), check: async (x) => { try { await disableVault(x.pass); return ''; } catch (e) { return wrong(e); } } });
      if (v) done('cn.vault.isOff');
    }, 'btn btn-ghost')) });
}

function connectionRow(/** @type {any} */ c, /** @type {() => void} */ repaint) {
  const def = PROVIDERS[c.provider], s = c.status || {};
  const bad = s.ok === false || s.needsAuth;
  const syncBtn = h('button', { class: 'btn', type: 'button', onclick: async () => {
    syncBtn.disabled = true; syncBtn.lastChild.textContent = t('cn.syncing');
    try { await send('conn:sync', { id: c.id }); } catch { /* the status says what happened */ }
    repaint();
  } }, icon('refresh-cw'), h('span', { text: t('cn.sync') }));
  const offBtn = h('button', { class: 'btn btn-ghost', type: 'button', 'aria-label': t('cn.disconnect') + ': ' + c.label, onclick: async () => {
    const ok = await confirmDialog({ title: t('cn.disconnectTitle', { name: c.label }), body: t('cn.disconnectBody'), confirm: t('cn.disconnect'), danger: true });
    if (!ok) return;
    await removeConnection(c.id); send('conn:arm').catch(() => {});
    try { // withdraw the access nobody else uses any more
      const keep = new Set(Object.values(await listConnections()).flatMap((x) => (PROVIDERS[x.provider] ? PROVIDERS[x.provider].origins(x) : [])));
      const drop = (def ? def.origins(c) : []).filter((o) => !keep.has(o));
      if (drop.length) await chrome.permissions.remove({ origins: drop });
    } catch { /* the browser keeps it: harmless */ }
    repaint();
  } }, icon('x'), t('cn.disconnect'));
  const extra = [];
  if (s.needsAuth) extra.push(h('button', { class: 'btn btn-primary', type: 'button', onclick: () => openConnect(repaint, c) }, icon('link'), t('cn.signin')));
  const unsafe = (s.tasks && s.tasks.unsafe) || (s.calendar && s.calendar.unsafe);
  if (unsafe) extra.push(h('button', { class: 'btn', type: 'button', onclick: async () => {
    await patchConnection(c.id, (x) => { x.options = { ...x.options, allowMass: true }; });
    await send('conn:sync', { id: c.id }).catch(() => {});
    await patchConnection(c.id, (x) => { x.options = { ...x.options, allowMass: false }; });
    repaint();
  } }, t('cn.allowDeletes')));
  const kinds = [c.tasks ? t('cn.tasks') : '', c.calendar ? t('cn.calendar') : ''].filter(Boolean).join(' · ');
  const top = row({
    title: (def ? def.label : c.provider) + (c.label && def && c.label !== def.label ? ' · ' + c.label : ''),
    desc: [kinds, statusLine(c)].filter(Boolean).join(' — ') + (unsafe ? '. ' + t('cn.held', { n: (s.tasks && s.tasks.held) || 0 }) : ''),
    warn: !!(bad || unsafe),
    control: h('div', { class: 'row gap-2 wrap' }, ...extra, syncBtn, offBtn),
  });
  const del = row({
    title: t('cn.deletes'), desc: t('cn.deletesDesc'),
    control: toggle(c.deletes !== false, (/** @type {boolean} */ on) => { patchConnection(c.id, (x) => { x.deletes = on; }); }, t('cn.deletes') + ': ' + c.label),
  });
  return h('div', { class: 'conn' }, top, c.tasks ? del : null);
}

/* ------------------------------ the dialog: pick → sign in → choose → save ------------------------------ */

/**
 * @param {() => void} done  called after something was saved
 * @param {any} [again]      an existing connection that has to sign in again (its choices are kept)
 */
function openConnect(done, again = null) {
  const body = h('div', { class: 'dialog-body stack gap-3' });
  const actions = h('div', { class: 'dialog-actions' });
  const dlg = h('dialog', { class: 'dialog dialog-wide', 'aria-label': t('cn.dlgTitle') }, body, actions);
  dlg.addEventListener('close', () => retire(dlg));
  document.body.append(dlg); openModal(dlg);
  const cancel = h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => dlg.close(), text: t('common.cancel') });
  const message = h('p', { class: 'hint', role: 'status', style: { minHeight: '1.4em' } });
  const say = (/** @type {string} */ text, bad = true) => { message.textContent = text; message.style.color = bad ? 'var(--distracting-text)' : ''; };

  /** The step that asks which service. */
  function pick() {
    body.replaceChildren(h('h3', { text: t('cn.dlgTitle') }), h('p', { class: 'muted-2', text: t('cn.pick') }),
      h('div', { class: 'stack gap-2' }, providerList().filter((def) => !def.available || def.available()).map((def) => { // a service that is not set up in this build is not offered
        const off = def.available && !def.available();
        return h('button', { class: 'btn cn-pick', type: 'button', disabled: off, 'data-provider': def.id, onclick: () => form(def) },
          icon(def.icon), h('span', { text: def.label }), off ? h('span', { class: 'muted', text: t('cn.na') }) : null);
      })),
      h('p', { class: 'hint', text: t('cn.things') }));
    actions.replaceChildren(cancel);
  }

  /** The step that asks for what the service needs (a token, a password…), then signs in and looks at what there is to choose from. */
  function form(/** @type {any} */ def) {
    /** @type {Record<string, HTMLInputElement>} */ const inputs = {};
    const fields = def.fields.map((/** @type {any} */ f) => {
      const input = h('input', { class: 'input', type: f.secret ? 'password' : 'text', autocomplete: 'off', spellcheck: false, 'data-field': f.key, 'aria-label': t('cn.f.' + f.key), placeholder: f.key === 'server' ? 'https://' : '', value: again && again.options && !f.secret ? again.options[f.key] || '' : '' });
      inputs[f.key] = input;
      return h('label', { class: 'stack gap-1' }, h('b', { text: t('cn.f.' + f.key) }), input);
    });
    const presets = def.id === 'caldav' ? h('div', { class: 'row gap-2 wrap' }, CALDAV_PRESETS.map(([name, url]) => h('button', { class: 'btn btn-sm', type: 'button', onclick: () => { inputs.server.value = url; inputs.server.focus(); } }, name))) : null;
    body.replaceChildren(h('h3', { text: def.label }), FIELD_HELP[def.id] ? h('p', { class: 'muted-2', text: t(FIELD_HELP[def.id]) }) : h('p', { class: 'muted-2', text: t('cn.h.oauth') }), presets, ...fields, message);
    const go = h('button', { class: 'btn btn-primary', type: 'button', text: t('cn.connect'), onclick: async () => {
      const values = Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.value.trim()]));
      const missing = def.fields.find((/** @type {any} */ f) => !values[f.key]);
      if (missing) { inputs[missing.key].focus(); say(t('cn.fill')); return; }
      const draft = { id: again ? again.id : newConnId(), provider: def.id, label: def.label, tasks: false, calendar: false, deletes: true, options: { ...(again ? again.options : {}), ...Object.fromEntries(def.fields.filter((/** @type {any} */ f) => !f.secret).map((/** @type {any} */ f) => [f.key, values[f.key]])) }, status: {}, createdAt: Date.now() };
      let origins;
      try { origins = def.origins(draft); } catch { origins = []; }
      if (!origins.length) { inputs[def.fields[0].key].focus(); say(t('cn.fill')); return; }
      go.disabled = true; say(t('cn.connecting'), false);
      // the permission request has to be the first thing the click does (the browser wants a fresh click)
      if (def.oauth && !(await request({ permissions: ['identity'] }))) { go.disabled = false; say(t('cn.denied')); return; }
      if (!(await request({ origins }))) { go.disabled = false; say(t('cn.denied')); return; }
      try {
        const secrets = def.oauth ? await def.signIn() : Object.fromEntries(def.fields.filter((/** @type {any} */ f) => f.secret).map((/** @type {any} */ f) => [f.key, values[f.key]]));
        const env = { fetchImpl: (/** @type {any} */ u, /** @type {any} */ i) => fetch(u, i), now: () => Date.now() };
        if (again) { // a new sign-in for what is already set up: keep the choices, clear the pause
          await patchConnection(again.id, (x) => { x.status = {}; x.options = { ...x.options, ...draft.options }; });
          await saveSecrets(again.id, secrets);
          send('conn:sync', { id: again.id }).catch(() => {}); send('conn:arm').catch(() => {}); done(); dlg.close(); return;
        }
        const found = await def.discover(draft, secrets, env);
        choose(def, draft, secrets, found);
      } catch (e) {
        go.disabled = false;
        say(e instanceof SyncError && e.kind === 'auth' ? t('cn.err.auth') : t('cn.failed', { detail: String((e && /** @type {any} */ (e).message) || e).slice(0, 120) }));
      }
    } });
    actions.replaceChildren(h('button', { class: 'btn btn-ghost', type: 'button', onclick: pick, text: t('common.back') }), cancel, go);
    (Object.values(inputs)[0] || go).focus();
  }

  /** The step that asks what to sync: which project, list, database, calendar. */
  function choose(/** @type {any} */ def, /** @type {any} */ draft, /** @type {any} */ secrets, /** @type {any} */ found) {
    const NONE = '';
    /** @type {Array<{ key: string, label: string, options: Array<[string, string]>, value: string, needed?: boolean }>} */ const asks = [];
    if (def.id === 'todoist') asks.push({ key: 'projectId', label: t('cn.pickProject'), options: [[NONE, t('cn.allProjects')], ...found.projects.map((/** @type {any} */ p) => /** @type {[string, string]} */ ([p.id, p.name]))], value: NONE });
    else if (def.id === 'notion') {
      asks.push({ key: 'doneProp', label: t('cn.pickDone'), options: found.done.map((/** @type {any} */ p) => [p.id, p.name]), value: (found.done[0] || {}).id || '', needed: true });
      asks.push({ key: 'dueProp', label: t('cn.pickDue'), options: [[NONE, t('cn.none')], ...found.date.map((/** @type {any} */ p) => /** @type {[string, string]} */ ([p.id, p.name]))], value: (found.date[0] || {}).id || NONE });
    } else if (def.id === 'caldav') {
      asks.push({ key: 'tasksUrl', label: t('cn.pickTasks'), options: [[NONE, t('cn.none')], ...found.tasks.map((/** @type {any} */ c) => /** @type {[string, string]} */ ([c.id, c.name]))], value: (found.tasks[0] || {}).id || NONE });
      asks.push({ key: 'eventsUrl', label: t('cn.pickCal'), options: [[NONE, t('cn.none')], ...found.events.map((/** @type {any} */ c) => /** @type {[string, string]} */ ([c.id, c.name]))], value: NONE });
    } else {
      asks.push({ key: 'taskList', label: t('cn.pickTasks'), options: [[NONE, t('cn.none')], ...found.taskLists.map((/** @type {any} */ l) => /** @type {[string, string]} */ ([l.id, l.name]))], value: (found.taskLists[0] || {}).id || NONE });
      asks.push({ key: 'calendar', label: t('cn.pickCal'), options: [[NONE, t('cn.none')], ...found.calendars.map((/** @type {any} */ c) => /** @type {[string, string]} */ ([c.id, c.name]))], value: NONE });
    }
    const picked = Object.fromEntries(asks.map((a) => [a.key, a.value]));
    body.replaceChildren(h('h3', { text: def.label }), h('p', { class: 'muted-2', text: t('cn.choose') }),
      ...asks.map((a) => h('div', { class: 'stack gap-1' }, h('b', { text: a.label }), dropdown(a.options, a.value, (v) => { picked[a.key] = v; }, { label: a.label }))),
      asks.some((a) => /taskList|tasksUrl|projectId|doneProp/.test(a.key)) && def.kinds.includes('events') ? h('p', { class: 'hint', text: t('cn.calNote') }) : null, message);
    const save = h('button', { class: 'btn btn-primary', type: 'button', text: t('cn.save'), onclick: async () => {
      const wantsTasks = def.id === 'todoist' || def.id === 'notion' || !!(picked.taskList || picked.tasksUrl);
      const wantsCal = !!(picked.calendar || picked.eventsUrl);
      if (!wantsTasks && !wantsCal) { say(t('cn.chooseSomething')); return; }
      if (def.id === 'notion' && !picked.doneProp) { say(t('cn.notionNoDone')); return; }
      const options = { ...draft.options, ...Object.fromEntries(Object.entries(picked).filter(([, v]) => v)) };
      if (found.hosts) options.hosts = found.hosts;
      if (found.databaseId) options.databaseId = found.databaseId;
      if (found.title) options.titleProp = found.title;
      const conn = { ...draft, tasks: wantsTasks, calendar: wantsCal, options };
      save.disabled = true;
      const origins = def.origins(conn);
      if (!(await have(origins)) && !(await request({ origins }))) { save.disabled = false; say(t('cn.denied')); return; } // hosts found while looking around
      await saveConnection(conn, secrets);
      track('connection_add'); send('conn:arm').catch(() => {}); send('conn:sync', { id: conn.id }).catch(() => {});
      toast(t('cn.added', { name: def.label })); done(); dlg.close();
    } });
    actions.replaceChildren(cancel, save);
    save.focus();
  }

  pick();
}

async function saveSecrets(/** @type {string} */ id, /** @type {any} */ secrets) {
  await setSecrets(id, { ...((await getSecrets(id)) || {}), ...secrets });
}
