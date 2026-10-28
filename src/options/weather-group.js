// Settings → General → Weather: off until the person says yes (that is also when the browser asks for access to Open-Meteo), then a city, the unit and the rain effect.

import { h, icon, toast } from '../ui/dom.js';
import { row, group, toggle, segmented } from './ui.js';
import { t, getLocale } from '../shared/i18n.js';
import { normalizeWeather, geocodeUrl, parseGeocode, WEATHER_ORIGINS } from '../shared/weather.js';

export function weatherGroup(s, save, refresh) {
  const w = normalizeWeather(s.weather);

  async function turnOn() {
    let ok = false;
    try { ok = await chrome.permissions.request({ origins: WEATHER_ORIGINS }); } catch { /* the browser refused to ask */ } // must be the first await: it needs the click
    if (!ok) { toast(t('wx.denied')); refresh(); return; }
    save((x) => { x.weather.on = true; }, true);
  }
  async function turnOff() {
    await save((x) => { x.weather.on = false; }, true);
    chrome.permissions.remove({ origins: WEATHER_ORIGINS }).catch(() => {});
  }

  const results = h('div', { class: 'stack gap-2', 'aria-live': 'polite' });
  const input = h('input', { class: 'input', type: 'search', autocomplete: 'off', spellcheck: false, maxlength: 60, placeholder: t('wx.search'), 'aria-label': t('wx.search'),
    onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); find(); } } });
  async function find() {
    const q = input.value.trim();
    if (q.length < 2) return;
    results.replaceChildren(h('div', { class: 'setting-desc', text: t('wx.loading') }));
    try {
      const res = await fetch(geocodeUrl(q, getLocale()), { credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!res.ok) throw new Error('http ' + res.status);
      const list = parseGeocode(await res.json());
      results.replaceChildren(...(list.length
        ? list.map((c) => h('button', { class: 'btn btn-ghost btn-sm wx-pick', type: 'button', onclick: () => save((x) => { x.weather.place = { name: c.name, lat: c.lat, lon: c.lon }; }, true) }, icon('check'), h('b', { text: c.name }), c.where ? h('span', { class: 'muted', text: ' · ' + c.where }) : null))
        : [h('div', { class: 'setting-desc', text: t('wx.none') })]));
    } catch { results.replaceChildren(h('div', { class: 'setting-desc warn', role: 'alert', text: t('wx.err') })); }
  }

  return group(t('wx.title'),
    row({ title: t('wx.on'), desc: t('wx.desc'), control: toggle(w.on, (v) => (v ? turnOn() : turnOff()), t('wx.on')) }),
    w.on ? [
      row({ title: t('wx.city'), desc: w.place ? t('wx.current', { name: w.place.name }) : t('wx.pickFirst'), stack: true,
        control: h('div', { class: 'stack gap-2' }, h('div', { class: 'row gap-2' }, input, h('button', { class: 'btn', type: 'button', onclick: find }, icon('search'), t('wx.find'))), results) }),
      row({ title: t('wx.unit'), control: segmented(['auto', 'c', 'f'].map((u) => [u, t('wx.unit.' + u)]), w.unit, (v) => save((x) => { x.weather.unit = v; }, true), t('wx.unit')) }),
      row({ title: t('wx.effect'), desc: t('wx.effectDesc'), control: toggle(w.effect, (v) => save((x) => { x.weather.effect = v; }), t('wx.effect')) }),
    ] : null);
}
