import { bootPage } from '../ui/page.js';
import { $, h, icon, favicon, clear, toast } from '../ui/dom.js';
import { send } from '../ui/api.js';
import { mountFocusCard } from '../ui/focus-card.js';
import { mountToday } from '../ui/today-card.js';
import { t, fmtDuration, fmtTime } from '../shared/i18n.js';
import { getSettings, updateSettings, getRaw, getDays, onChange, getCollection, setCollection } from '../shared/storage.js';
import { makeClassifier } from '../shared/classify.js';
import { dayKey } from '../shared/time.js';
import { hostFromUrl, matches } from '../shared/domains.js';

const CLS_ICON = { productive: 'circle-check', neutral: 'minus', distracting: 'circle-alert' };
let tab = null;

/* ---------- current site ---------- */

async function renderSite() {
  const el = $('#site');
  const host = tab?.host;
  if (!host) { el.hidden = true; return; }
  el.hidden = false;
  const settings = await getSettings();
  const [[, day]] = await getDays([dayKey()]);
  const { classify } = makeClassifier(settings);
  const cls = classify(host);
  const b = settings.blocking;
  const sec = Object.entries(day?.d || {}).reduce((a, [hh, s]) => (matches(hh, host) ? a + s : a), 0);
  const blocked = b.always.includes(host);
  const limitKey = Object.keys(b.limits).find((d) => matches(host, d));

  const seg = ['productive', 'neutral', 'distracting'].map((c) => h('button', {
    type: 'button', 'data-cls': c, 'aria-pressed': String(cls === c),
    onclick: async () => {
      await updateSettings((s) => { s.sites[host] = c; if (c !== 'distracting') s.blocking.always = s.blocking.always.filter((x) => x !== host); });
      send('settings:changed'); renderSite();
    },
  }, icon(CLS_ICON[c]), t('class.' + c)));

  const extra = h('div', { class: 'site-extra' },
    limitKey ? [h('span', { class: 'num', text: fmtDuration(sec) }), h('div', { class: 'progress' }, h('i', { style: { width: Math.min(100, (sec / (b.limits[limitKey] * 60)) * 100) + '%' } })), h('span', { class: 'num', text: fmtDuration(b.limits[limitKey] * 60) })] : h('span'),
    h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: async () => {
      await updateSettings((s) => { s.blocking.always = blocked ? s.blocking.always.filter((x) => x !== host) : [...new Set([...s.blocking.always, host])]; });
      await send('settings:changed');
      if (!blocked) window.close(); else renderSite();
    } }, icon(blocked ? 'unlock' : 'ban'), blocked ? t('site.unblock') : t('site.alwaysBlock')));

  clear(el,
    h('div', { class: 'site-row' }, favicon(host, 'fav-lg'),
      h('div', { class: 'grow' }, h('div', { class: 'name truncate', text: host }), h('div', { class: 'meta num', text: sec >= 60 ? t('site.today', { time: fmtDuration(sec) }) : t('site.justStarted') }))),
    h('div', { class: 'site-class', role: 'group', 'aria-label': t('site.classLabel') }, seg), extra);
}

/* ---------- footer ---------- */

async function renderFooter() {
  const el = $('#footer');
  const { pausedUntil = 0 } = await getRaw('pausedUntil');
  const settings = await getSettings();
  const input = h('input', { class: 'input', placeholder: t('capture.placeholder'), 'aria-label': t('capture.placeholder'), maxlength: 500, onkeydown: async (e) => {
    if (e.key !== 'Enter' || !e.target.value.trim()) return;
    const list = await getCollection('captures', []);
    list.unshift({ id: String(Date.now()), text: e.target.value.trim(), at: Date.now() });
    await setCollection('captures', list.slice(0, 200));
    e.target.value = '';
    toast(t('capture.saved'));
  } });
  const paused = pausedUntil > Date.now();
  const pause = paused
    ? h('button', { type: 'button', onclick: async () => { await send('tracking:pause', { minutes: 0 }); renderFooter(); } }, icon('play'), t('track.resume'))
    : h('button', { type: 'button', onclick: async () => { await send('tracking:pause', { minutes: 60 }); renderFooter(); } }, icon('pause'), t('track.pause'));
  clear(el, h('div', { class: 'capture' }, input),
    h('div', { class: 'foot-row' }, pause, h('span', { class: 'num', text: paused ? t('track.pausedUntil', { time: fmtTime(new Date(pausedUntil), settings.newtab.clock24 ?? undefined) }) : '' })));
}

(async function main() {
  await bootPage({ onSettings: () => { renderSite(); renderFooter(); } });
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  tab = active ? { id: active.id, host: hostFromUrl(active.url) } : null;
  mountFocusCard($('#focus'), { variant: 'compact' });
  mountToday($('#today'), { closeOnBreak: true });
  renderSite(); renderFooter();
  onChange(['d:*', 'pausedUntil'], () => { renderSite(); renderFooter(); });
})();
