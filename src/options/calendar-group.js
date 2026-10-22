// Settings → Data & privacy → Calendar: an imported file, up to three subscriptions by link, and what meetings do (warning, quiet).

import { h, icon, toast } from '../ui/dom.js';
import { send } from '../ui/api.js';
import { row, group, toggle } from './ui.js';
import { t, getLocale } from '../shared/i18n.js';
import { getRaw, setRaw, onChange } from '../shared/storage.js';
import { parseIcsFull } from '../shared/ics.js';
import { normalizeCalendarUrl } from '../shared/calsub.js';
import { loadSubs, saveSubs, writeSource, removeSource, FILE_KEY, MAX_SUBS } from '../shared/calstore.js';
import { dayKey } from '../shared/time.js';

let stopWatch = null;

export function calendarGroup(s, save) {
  const fileStatus = h('div', { class: 'setting-desc sync-status' });
  const calFile = h('input', { type: 'file', accept: '.ics,text/calendar', hidden: true, 'aria-label': t('opt.calendarBtn') });
  const subIn = h('input', { class: 'input input-sm', type: 'url', autocomplete: 'off', spellcheck: false, placeholder: t('opt.calSubPh'), 'aria-label': t('opt.calSubTitle'), style: { width: '280px', maxWidth: '100%' } });
  const subBtn = h('button', { class: 'btn', type: 'button', onclick: () => subscribe() }, icon('link'), t('opt.calSubBtn'));
  const subList = h('div', { class: 'stack gap-2', 'aria-live': 'polite' });

  const timeOf = (ms) => new Date(ms).toLocaleTimeString(getLocale(), { hour: 'numeric', minute: '2-digit' });
  async function paint() {
    const [{ calendar }, { calendarMeta }, subs] = await Promise.all([getRaw('calendar'), getRaw('calendarMeta'), loadSubs()]);
    const fromFile = ((await getRaw('calendarSrc')).calendarSrc || {})[FILE_KEY];
    const n = fromFile ? (fromFile.events || []).filter((e) => e.day >= dayKey()).length : 0;
    fileStatus.textContent = fromFile && calendarMeta ? t('opt.calendarStatus', { n, date: new Date(calendarMeta.at).toLocaleDateString(getLocale()) }) : t('opt.calendarNone');
    subIn.hidden = subBtn.hidden = subs.length >= MAX_SUBS;
    subList.replaceChildren(...subs.map((sub) => {
      const host = sub.host || normalizeCalendarUrl(sub.url).host || '';
      const text = sub.error ? t('opt.calErr.' + sub.error, { status: sub.status || '' }) : sub.ok ? t('opt.calSubOk', { host, n: sub.n || 0, time: timeOf(sub.at) }) : t('opt.calSubWait', { host });
      return h('div', { class: 'row gap-2 wrap', style: { alignItems: 'center' } }, h('span', { class: 'setting-desc sync-status', style: { flex: '1 1 220px' }, text }),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => unsubscribe(sub.id), 'aria-label': t('opt.calUnsub') + ' ' + host }, t('opt.calUnsub')));
    }));
    void calendar;
  }

  async function subscribe() {
    const n = normalizeCalendarUrl(subIn.value);
    if (!n.ok) { toast(t('opt.calBadUrl')); return; }
    const ok = await chrome.permissions.request({ origins: [n.pattern] }).catch(() => false); // must be the first await: it needs the click
    if (!ok) { toast(t('opt.calDenied')); return; }
    const subs = await loadSubs();
    if (subs.length >= MAX_SUBS) { toast(t('opt.calMax', { n: MAX_SUBS })); return; }
    if (subs.some((x) => x.url === n.url)) { toast(t('opt.calAlready')); return; }
    await saveSubs([...subs, { id: 'c' + Date.now().toString(36), url: n.url, since: Date.now(), host: n.host }]);
    subIn.value = ''; paint();
    await send('calendar:sync'); paint();
  }

  async function unsubscribe(id) {
    const subs = await loadSubs();
    const gone = subs.find((x) => x.id === id);
    const rest = subs.filter((x) => x.id !== id);
    await saveSubs(rest); await removeSource(id);
    const n = gone ? normalizeCalendarUrl(gone.url) : null;
    if (n && n.ok && !rest.some((x) => { const m = normalizeCalendarUrl(x.url); return m.ok && m.pattern === n.pattern; })) await chrome.permissions.remove({ origins: [n.pattern] }).catch(() => {});
    send('calendar:sync'); paint();
  }

  calFile.onchange = async () => {
    const f = calFile.files[0]; calFile.value = ''; if (!f) return;
    if (f.size > 5_000_000) { toast(t('opt.calendarBad')); return; }
    const text = await f.text();
    if (!/BEGIN:VCALENDAR/i.test(text)) { toast(t('opt.calendarBad')); return; }
    const data = parseIcsFull(text, { from: new Date(), days: 14 });
    await writeSource(FILE_KEY, data);
    await setRaw({ calendarMeta: { at: Date.now(), name: String(f.name).slice(0, 60) } });
    toast(data.events.length ? t('opt.calendarDone', { n: data.events.length }) : t('opt.calendarEmpty')); paint();
  };

  if (stopWatch) stopWatch(); // one listener, however often Settings redraws
  stopWatch = onChange(['calendarSubs', 'calendarSrc'], paint);
  paint();

  const fileRow = row({ title: t('opt.calendar'), desc: t('opt.calendarDesc'), control: h('div', { class: 'row gap-2 wrap' },
    h('button', { class: 'btn', type: 'button', onclick: () => calFile.click() }, icon('upload'), t('opt.calendarBtn')),
    h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: async () => { await removeSource(FILE_KEY); await chrome.storage.local.remove('calendarMeta'); paint(); } }, t('opt.calendarClear')), calFile) });
  fileRow.querySelector('.setting-text').append(fileStatus);
  const subRow = row({ title: t('opt.calSubTitle'), desc: t('opt.calSubDesc'), control: h('div', { class: 'row gap-2 wrap' }, subIn, subBtn) });
  subRow.querySelector('.setting-text').append(subList);
  const cal = s.calendar || { warn: true, warnMin: 2, quiet: false };
  return group(t('opt.groupCalendar'), fileRow, subRow,
    row({ title: t('opt.calWarn'), desc: t('opt.calWarnDesc'), control: toggle(cal.warn, (v) => save((x) => { x.calendar.warn = v; }), t('opt.calWarn')) }),
    row({ title: t('opt.calQuiet'), desc: t('opt.calQuietDesc'), control: toggle(cal.quiet, (v) => save((x) => { x.calendar.quiet = v; }), t('opt.calQuiet')) }));
}
