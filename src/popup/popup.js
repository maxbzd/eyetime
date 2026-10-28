import { bootPage } from '../ui/page.js';
import { addCapture } from '../shared/productivity.js';
import { $, h, icon, favicon, clear, toast } from '../ui/dom.js';
import { send } from '../ui/api.js';
import { mountFocusCard } from '../ui/focus-card.js';
import { mountToday } from '../ui/today-card.js';
import { t, fmtDuration, fmtTime } from '../shared/i18n.js';
import { getSettings, updateSettings, getRaw, getDays, onChange, updateCollection } from '../shared/storage.js';
import { makeClassifier } from '../shared/classify.js';
import { dayKey } from '../shared/time.js';
import { hostFromUrl, matches } from '../shared/domains.js';

const CLASSES = [{ id: 'productive' }, { id: 'neutral' }, { id: 'distracting' }];
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

  const seg = CLASSES.map(({ id: c }) => h('button', {
    type: 'button', 'data-cls': c, 'aria-pressed': String(cls === c),
    onclick: async () => {
      await updateSettings((s) => { s.sites[host] = c; if (c !== 'distracting') s.blocking.always = s.blocking.always.filter((x) => x !== host); });
      send('settings:changed'); renderSite();
    },
  }, t('class.' + c)));

  const blockBtn = h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': blocked ? t('site.unblock') : t('site.alwaysBlock'), 'data-tip': blocked ? t('site.unblock') : t('site.alwaysBlock'), onclick: async () => {
    await updateSettings((s) => { s.blocking.always = blocked ? s.blocking.always.filter((x) => x !== host) : [...new Set([...s.blocking.always, host])]; });
    await send('settings:changed');
    if (!blocked) window.close(); else renderSite();
  } }, icon(blocked ? 'unlock' : 'ban'));
  const limit = limitKey ? h('div', { class: 'site-extra' }, h('span', { class: 'num', text: fmtDuration(sec) }), h('div', { class: 'progress' }, h('i', { style: { width: Math.min(100, (sec / (b.limits[limitKey] * 60)) * 100) + '%' } })), h('span', { class: 'num', text: fmtDuration(b.limits[limitKey] * 60) })) : null;

  clear(el,
    h('div', { class: 'site-row' }, favicon(host, 'fav-lg'),
      h('div', { class: 'grow' }, h('div', { class: 'name truncate', text: host }), h('div', { class: 'meta num', text: sec >= 60 ? t('site.today', { time: fmtDuration(sec) }) : t('site.justStarted') })), blockBtn),
    h('div', { class: 'site-class', role: 'group', 'aria-label': t('site.classLabel') }, seg), limit);
}

/* ---------- eye break chip in the header: next 20-20-20 break, or "now" ---------- */

async function renderEye() {
  const chip = $('#eyeChip');
  const settings = await getSettings();
  if (!settings.eye.enabled) { chip.hidden = true; return; }
  const eye = await send('break:state');
  if (!eye || typeof eye.since !== 'number') { chip.hidden = true; return; }
  const left = Math.max(0, settings.eye.intervalMin * 60 - (eye.since || 0));
  chip.hidden = false; chip.classList.toggle('due', !!eye.due);
  clear(chip, icon('eye'), h('span', { class: 'num', text: eye.due ? t('eye.now') : fmtDuration(left) }));
  chip.setAttribute('aria-label', eye.due ? t('eye.due') : t('eye.nextIn', { time: fmtDuration(left) }));
  chip.setAttribute('data-tip', eye.due ? t('eye.due') : t('eye.nextIn', { time: fmtDuration(left) }));
  chip.onclick = () => { send('break:open'); window.close(); };
}

/* ---------- footer ---------- */

async function renderFooter() {
  const el = $('#footer');
  const { pausedUntil = 0 } = await getRaw('pausedUntil');
  const settings = await getSettings();
  const input = h('input', { class: 'input', placeholder: t('capture.placeholder'), 'aria-label': t('capture.placeholder'), maxlength: 500, onkeydown: async (e) => {
    if (e.key !== 'Enter' || !e.target.value.trim()) return;
    const text = e.target.value.trim();
    await updateCollection('captures', [], (list) => addCapture(list, text));
    e.target.value = '';
    toast(t('capture.saved'));
  } });
  const paused = pausedUntil > Date.now();
  const pause = paused
    ? null
    : h('button', { class: 'btn btn-ghost btn-icon', type: 'button', 'aria-label': t('track.pause'), 'data-tip': t('track.pause'), onclick: async () => { await send('tracking:pause', { minutes: 60 }); renderFooter(); } }, icon('pause'));
  const banner = paused
    ? h('div', { class: 'paused-banner' }, icon('pause'), h('span', { class: 'grow', text: t('track.pausedBanner', { time: fmtTime(new Date(pausedUntil), settings.newtab.clock24 ?? undefined) }) }),
        h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => { await send('tracking:pause', { minutes: 0 }); renderFooter(); } }, icon('play'), t('track.resumeShort')))
    : null;
  clear(el, banner, h('div', { class: 'foot-row' }, h('div', { class: 'capture grow' }, input), pause));
}

(async function main() {
  await bootPage({ onSettings: () => { renderSite(); renderFooter(); } });
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  tab = active ? { id: active.id, host: hostFromUrl(active.url) } : null;
  const preview = new URLSearchParams(location.search).get('site'); // ?site=github.com renders the site card without a real tab (docs, screenshots)
  if (preview) tab = { id: -1, host: preview };
  mountFocusCard($('#focus'), { variant: 'compact' });
  mountToday($('#today'), { closeOnBreak: true, compact: true });
  renderSite(); renderFooter(); renderEye(); setInterval(renderEye, 30_000);
  onChange(['d:*', 'pausedUntil'], () => { renderSite(); renderFooter(); });
})();
