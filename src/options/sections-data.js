// Settings → Data & privacy: calendar, tasks in/out, settings sync, backup, privacy, danger zone.

import { h, icon, toast, confirmDialog } from '../ui/dom.js';
import { send } from '../ui/api.js';
import { row, group, sectionHead } from './ui.js';
import { t, getLocale } from '../shared/i18n.js';
import { importAll, resetAll, getRaw, setRaw, getRange, onChange, getCollection, updateCollection } from '../shared/storage.js';
import { tasksToMarkdown, tasksToCsv, parseTasksText } from '../shared/taskio.js';
import { buildJournal } from '../shared/journal.js';
import { downloadBackup } from '../ui/backup.js';
import { parseIcs } from '../shared/ics.js';
import { normalizeCalendarUrl } from '../shared/calsub.js';
import { makeClassifier } from '../shared/classify.js';
import { fmtTime } from '../shared/i18n.js';
import { dayKey } from '../shared/time.js';

const sec = (id, ...kids) => h('section', { class: 'sec', id }, kids);

/* ============================== Data & privacy ============================== */
export function data({ s, save, refresh }) {
  const PERMS = [['storage', 'perm.storage'], ['tabs', 'perm.tabs'], ['webNavigation', 'perm.webNavigation'], ['idle', 'perm.idle'], ['alarms', 'perm.alarms'], ['contextMenus', 'perm.contextMenus'], ['notifications', 'perm.notifications'], ['offscreen', 'perm.offscreen'], ['favicon', 'perm.favicon'], ['youtube/instagram/tiktok/vk', 'perm.hosts']];
  const doExport = downloadBackup;
  async function doImport(file) {
    try {
      const payload = JSON.parse(await file.text());
      const ok = await confirmDialog({ title: t('opt.importTitle'), body: t('opt.importBody'), confirm: t('opt.importConfirm'), danger: true });
      if (!ok) return;
      await importAll(payload); toast(t('opt.importDone')); setTimeout(() => location.reload(), 600);
    } catch { toast(t('opt.importFail')); }
  }
  const fileIn = document.getElementById('importFile');
  fileIn.onchange = () => { if (fileIn.files[0]) doImport(fileIn.files[0]); fileIn.value = ''; };

  /* calendar file: events of the next 14 days, kept locally */
  const calStatus = h('div', { class: 'setting-desc sync-status' });
  const calFile = h('input', { type: 'file', accept: '.ics,text/calendar', hidden: true, 'aria-label': t('opt.calendarBtn') });
  const subIn = h('input', { class: 'input input-sm', type: 'url', autocomplete: 'off', spellcheck: false, placeholder: t('opt.calSubPh'), 'aria-label': t('opt.calSubTitle'), style: { width: '280px', maxWidth: '100%' } });
  const subBtn = h('button', { class: 'btn', type: 'button', onclick: () => subscribeCal() }, icon('link'), t('opt.calSubBtn'));
  const unsubBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => unsubscribeCal() }, t('opt.calUnsub'));
  const subStatus = h('div', { class: 'setting-desc sync-status', 'aria-live': 'polite' });
  async function paintCal() {
    const [events, meta, subRaw] = await Promise.all([getRaw('calendar'), getRaw('calendarMeta'), getRaw('calendarSub')]);
    const list = (events.calendar || []).filter((e) => e.day >= dayKey());
    calStatus.textContent = list.length && meta.calendarMeta ? t('opt.calendarStatus', { n: list.length, date: new Date(meta.calendarMeta.at).toLocaleDateString(getLocale()) }) : t('opt.calendarNone');
    const sub = subRaw.calendarSub;
    subIn.hidden = subBtn.hidden = !!sub; unsubBtn.hidden = !sub;
    const host = sub ? (normalizeCalendarUrl(sub.url).host || '') : '';
    subStatus.textContent = !sub ? '' : sub.error ? t('opt.calErr.' + sub.error, { status: sub.status || '' }) : sub.ok ? t('opt.calSubOk', { host, n: sub.n || 0, time: new Date(sub.at).toLocaleTimeString(getLocale(), { hour: 'numeric', minute: '2-digit' }) }) : t('opt.calSubWait', { host });
  }
  async function subscribeCal() {
    const n = normalizeCalendarUrl(subIn.value);
    if (!n.ok) { toast(t('opt.calBadUrl')); return; }
    const ok = await chrome.permissions.request({ origins: [n.pattern] }).catch(() => false); // must be the first await: it needs the click
    if (!ok) { toast(t('opt.calDenied')); return; }
    await setRaw({ calendarSub: { url: n.url, since: Date.now(), host: n.host } });
    subIn.value = ''; paintCal();
    await send('calendar:sync'); paintCal();
  }
  async function unsubscribeCal() {
    const { calendarSub } = await getRaw('calendarSub');
    await chrome.storage.local.remove(['calendarSub', 'calendar', 'calendarMeta']);
    const n = calendarSub ? normalizeCalendarUrl(calendarSub.url) : null;
    if (n && n.ok) await chrome.permissions.remove({ origins: [n.pattern] }).catch(() => {});
    send('calendar:sync'); paintCal();
  }
  onChange(['calendarSub', 'calendar'], paintCal);
  calFile.onchange = async () => {
    const f = calFile.files[0]; calFile.value = ''; if (!f) return;
    const text = await f.text();
    if (!/BEGIN:VCALENDAR/i.test(text)) { toast(t('opt.calendarBad')); return; }
    const events = parseIcs(text, { from: new Date(), days: 14 });
    await setRaw({ calendar: events, calendarMeta: { at: Date.now(), name: String(f.name).slice(0, 60) } });
    toast(events.length ? t('opt.calendarDone', { n: events.length }) : t('opt.calendarEmpty')); paintCal();
  };
  paintCal();
  const calendarGroup = group(t('opt.groupCalendar'), (() => { const r = row({ title: t('opt.calendar'), desc: t('opt.calendarDesc'), control: h('div', { class: 'row gap-2 wrap' }, h('button', { class: 'btn', type: 'button', onclick: () => calFile.click() }, icon('upload'), t('opt.calendarBtn')), h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: async () => { await chrome.storage.local.remove(['calendar', 'calendarMeta']); paintCal(); } }, t('opt.calendarClear')), calFile) }); r.querySelector('.setting-text').append(calStatus); return r; })(), (() => { const r = row({ title: t('opt.calSubTitle'), desc: t('opt.calSubDesc'), control: h('div', { class: 'row gap-2 wrap' }, subIn, subBtn, unsubBtn) }); r.querySelector('.setting-text').append(subStatus); return r; })());

  /* tasks: Markdown / CSV out, Markdown / CSV / plain list in */
  const download = (name, text, type) => { const url = URL.createObjectURL(new Blob([text], { type })); const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url); };
  const taskFile = h('input', { type: 'file', accept: '.md,.markdown,.txt,.csv,text/plain,text/markdown,text/csv', hidden: true, 'aria-label': t('opt.tasksImport') });
  taskFile.onchange = async () => {
    const f = taskFile.files[0]; taskFile.value = ''; if (!f) return;
    const existing = await getCollection('tasks', []);
    const { tasks: found, skipped } = parseTasksText(await f.text(), { existing });
    if (!found.length) { toast(skipped ? t('opt.tasksNone', { n: skipped }) : t('opt.tasksEmpty')); return; }
    const ok = await confirmDialog({ title: t('opt.tasksConfirmTitle', { n: found.length }), body: t('opt.tasksConfirmBody', { sample: found.slice(0, 3).map((x) => x.text).join(' · '), skipped }), confirm: t('opt.tasksImportBtn') });
    if (!ok) return;
    await updateCollection('tasks', [], (cur) => [...found, ...cur]);
    toast(t('opt.tasksDone', { n: found.length }));
  };
  const tasksGroup = group(t('opt.groupTasks'),
    row({ title: t('opt.tasksExport'), desc: t('opt.tasksExportDesc'), control: h('div', { class: 'row gap-2 wrap' },
      h('button', { class: 'btn', type: 'button', onclick: async () => download(`eyetime-tasks-${dayKey()}.md`, tasksToMarkdown(await getCollection('tasks', [])), 'text/markdown') }, icon('file-text'), 'Markdown'),
      h('button', { class: 'btn', type: 'button', onclick: async () => download(`eyetime-tasks-${dayKey()}.csv`, tasksToCsv(await getCollection('tasks', [])), 'text/csv') }, icon('download'), 'CSV')) }),
    row({ title: t('opt.tasksImport'), desc: t('opt.tasksImportDesc'), control: h('div', {}, h('button', { class: 'btn', type: 'button', onclick: () => taskFile.click() }, icon('upload'), t('opt.tasksImportBtn')), taskFile) }));

  return sec('data', sectionHead(t('sec.data'), t('sec.dataDesc')),
    calendarGroup,
    tasksGroup,
    syncGroup(s),
    group(t('opt.groupBackup'),
      row({ title: t('opt.export'), desc: t('opt.exportDesc'), control: h('button', { class: 'btn', type: 'button', onclick: doExport }, icon('download'), t('opt.exportBtn')) }),
      row({ title: t('opt.journal'), desc: t('opt.journalDesc'), control: h('button', { class: 'btn', type: 'button', onclick: async () => {
        const entries = await getRange(90);
        const md = buildJournal(entries, { classify: makeClassifier(s).classify, clock24: s.newtab.clock24 ?? undefined });
        const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
        const a = h('a', { href: url, download: `eyetime-journal-${dayKey()}.md` }); document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      } }, icon('file-text'), t('opt.journalBtn')) }),
      row({ title: t('opt.import'), desc: t('opt.importDesc'), control: h('button', { class: 'btn', type: 'button', onclick: () => fileIn.click() }, icon('upload'), t('opt.importBtn')) }),
      row({ title: t('opt.csv'), desc: t('opt.csvDesc'), control: h('a', { class: 'btn', href: chrome.runtime.getURL('src/insights/insights.html') }, icon('arrow-up-right'), t('opt.openInsights')) })),
    h('div', {}, h('h3', { class: 'group-title', text: t('opt.groupPrivacy') }),
      h('div', { class: 'card' }, h('div', { class: 'setting' }, h('div', { class: 'setting-text' }, h('div', { class: 'setting-title', text: t('opt.privacyTitle') }), h('div', { class: 'setting-desc', text: t('opt.privacyBody') }))),
        h('div', { class: 'privacy-head' }, h('span', { text: t('opt.permName') }), h('span', { text: t('opt.permWhy') })),
        h('div', {}, PERMS.map(([p, k]) => h('div', { class: 'perm' }, h('b', { text: p }), h('span', { text: t(k) })))))),
    h('div', {}, h('h3', { class: 'group-title', text: t('opt.groupDanger') }),
      h('div', { class: 'card danger-zone' }, row({ title: t('opt.reset'), desc: t('opt.resetDesc'), control: h('button', { class: 'btn btn-danger', type: 'button', onclick: async () => {
        const ok = await confirmDialog({ title: t('opt.resetTitle'), body: t('opt.resetBody'), extra: h('button', { class: 'btn btn-sm', type: 'button', style: { alignSelf: 'flex-start' }, onclick: doExport }, icon('download'), t('opt.backupFirst')), confirm: t('opt.resetConfirm'), danger: true });
        if (ok) { await resetAll(); toast(t('opt.resetDone')); setTimeout(() => location.reload(), 600); }
      } }, icon('trash-2'), t('opt.resetBtn')) }))));
}

let syncPaint = null, syncListening = false;
/** Optional settings sync: the toggle is a device-level flag (not part of the synced settings). */
function syncGroup(s) {
  const status = h('div', { class: 'setting-desc' });
  const input = h('input', { type: 'checkbox', 'aria-label': t('opt.sync'), onchange: async (e) => { await setRaw({ syncSettings: e.target.checked }); paint(); } });
  const sw = h('label', { class: 'switch' }, input, h('span', { class: 'track' }), h('span', { class: 'thumb' }));
  const nowBtn = h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => { await send('sync:now'); setTimeout(paint, 400); } }, icon('refresh-cw'), t('opt.syncNow'));
  async function paint() {
    const { syncSettings, syncStatus } = await getRaw(['syncSettings', 'syncStatus']);
    input.checked = !!syncSettings; nowBtn.hidden = !syncSettings;
    status.textContent = !syncSettings ? t('opt.syncOff')
      : !syncStatus ? t('opt.syncWait')
      : syncStatus.ok ? t('opt.syncOk', { time: fmtTime(new Date(syncStatus.at), s.newtab.clock24 ?? undefined) })
      : syncStatus.error === 'unsupported' ? t('opt.syncUnsupported') : syncStatus.error === 'incompatible' ? t('opt.syncIncompatible') : syncStatus.error === 'too_big' ? t('opt.syncTooBig') : t('opt.syncError', { e: syncStatus.error });
  }
  paint();
  syncPaint = paint; // one page-wide listener repaints the newest status row (the page redraws often; per-draw listeners would pile up)
  if (!syncListening) { syncListening = true; chrome.storage.onChanged.addListener((c, area) => { if (area === 'local' && (c.syncStatus || c.syncSettings) && syncPaint) syncPaint(); }); }
  return group(t('opt.groupSync'),
    (() => { const r = row({ title: t('opt.sync'), desc: t('opt.syncDesc'), control: h('div', { class: 'row gap-3' }, nowBtn, sw) }); r.querySelector('.setting-text').append(status); status.classList.add('sync-status'); return r; })());
}
