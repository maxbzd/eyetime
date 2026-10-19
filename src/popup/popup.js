import { bootPage } from '../ui/page.js';
import { $, h, icon, favicon, clear, toast, confirmDialog } from '../ui/dom.js';
import { send } from '../ui/api.js';
import { t, fmtDuration, fmtTime } from '../shared/i18n.js';
import { getSettings, updateSettings, getRaw, getDays, onChange, getCollection, setCollection } from '../shared/storage.js';
import { makeClassifier } from '../shared/classify.js';
import { summarize } from '../shared/stats.js';
import { dayKey, rangeKeys } from '../shared/time.js';
import { hostFromUrl, matches } from '../shared/domains.js';
import { isFocusActive } from '../shared/blocking.js';
import { remainingMs, progress } from '../shared/focus.js';

const state = { settings: null, focus: null, today: null, yesterday: null, tab: null, eye: null, pausedUntil: 0, draft: { goal: '', minutes: 25, strict: false, custom: false } };
let tickId = null;

/* ---------- data ---------- */

async function load() {
  state.settings = await getSettings();
  const keys = rangeKeys(2);
  const [days, raw, eye] = await Promise.all([getDays(keys), getRaw(['focus', 'pausedUntil']), send('break:state')]);
  state.yesterday = days[0][1]; state.today = days[1][1];
  state.focus = isFocusActive(raw.focus) ? raw.focus : null;
  state.pausedUntil = raw.pausedUntil || 0;
  state.eye = eye && typeof eye.since === 'number' ? eye : { since: 0, due: false };
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.tab = tab ? { id: tab.id, host: hostFromUrl(tab.url), url: tab.url } : null;
}

/* ---------- focus card ---------- */

function renderFocus() {
  const el = $('#focus');
  clearInterval(tickId);
  if (state.focus) return renderFocusRunning(el);
  const s = state.settings.focus;
  if (state.draft.minutes === 25 && s.minutes !== 25 && !state.draft.touched) state.draft.minutes = s.minutes;
  if (!state.draft.touched) state.draft.strict = s.strict;
  const d = state.draft;

  const chips = s.presets.map((m) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(!d.custom && d.minutes === m), onclick: () => { d.minutes = m; d.custom = false; d.touched = true; renderFocus(); } }, t('focus.minutesShort', { n: m })));
  const custom = d.custom
    ? h('span', { class: 'custom-min' }, h('input', { class: 'input input-sm num', type: 'number', min: 1, max: 720, value: d.minutes, id: 'customMin', 'aria-label': t('focus.custom'), oninput: (e) => { d.minutes = Math.min(720, Math.max(1, Number(e.target.value) || 1)); updateStartLabel(); } }), h('span', { class: 'muted', text: t('unit.m') }))
    : h('button', { class: 'chip chip-custom', type: 'button', onclick: () => { d.custom = true; d.touched = true; renderFocus(); $('#customMin')?.focus(); } }, icon('plus'), t('focus.custom'));

  const goal = h('input', { class: 'input', id: 'goal', maxlength: 140, value: d.goal, placeholder: t('focus.goalPlaceholder'), 'aria-label': t('focus.goalPlaceholder'), oninput: (e) => { d.goal = e.target.value; }, onkeydown: (e) => { if (e.key === 'Enter') start(); } });
  const startBtn = h('button', { class: 'btn btn-primary btn-lg btn-block', id: 'startBtn', type: 'button', onclick: start }, icon('play'), h('span', { id: 'startLbl' }));
  const strict = h('label', { class: 'strict-row' },
    h('span', { class: 'lbl', 'data-tip': t('focus.strictHint') }, icon('lock'), t('focus.strict')),
    h('span', { class: 'switch' }, h('input', { type: 'checkbox', checked: d.strict, 'aria-label': t('focus.strict'), onchange: (e) => { d.strict = e.target.checked; d.touched = true; } }), h('span', { class: 'track' }), h('span', { class: 'thumb' })));

  clear(el, h('div', { class: 'focus-idle' },
    h('div', { class: 'focus-head' }, h('h2', { text: t('focus.title') }), h('span', { class: 'hint', text: t('focus.tagline') })),
    goal, h('div', { class: 'durations' }, chips, custom), startBtn, strict));
  updateStartLabel();
}

function updateStartLabel() {
  const lbl = $('#startLbl');
  if (lbl) lbl.textContent = t('focus.start', { time: fmtDuration(state.draft.minutes * 60) });
}

async function start() {
  const d = state.draft;
  const res = await send('focus:start', { minutes: d.minutes, goal: d.goal, strict: d.strict });
  if (res && res.ok === false) toast(t('common.error'));
  d.goal = '';
}

function renderFocusRunning(el) {
  const f = state.focus;
  const R = 76, C = 2 * Math.PI * R;
  const time = h('div', { class: 'time num' });
  const sub = h('div', { class: 'sub', text: t('focus.endsAt', { time: fmtTime(new Date(f.endsAt), state.settings.newtab.clock24 === null ? undefined : state.settings.newtab.clock24) }) });
  const bar = h('circle', { cx: 84, cy: 84, r: R, fill: 'none', 'stroke-width': 8, 'stroke-linecap': 'round', class: 'bar', 'stroke-dasharray': C });
  const track = h('circle', { cx: 84, cy: 84, r: R, fill: 'none', 'stroke-width': 8, class: 'track' });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 168 168'); svg.append(track, bar);

  const actions = f.strict
    ? h('span', { class: 'locked' }, icon('lock'), t('focus.strictLocked'))
    : h('button', { class: 'btn btn-ghost', type: 'button', onclick: endEarly }, t('focus.end'));

  clear(el, h('div', { class: 'focus-run' },
    h('span', { class: 'badge badge-accent badge-dot', text: t('focus.running') }),
    h('div', { class: 'ring' }, svg, h('div', { class: 'center' }, time, sub)),
    f.goal ? h('div', { class: 'goal-line truncate', text: f.goal }) : null,
    h('div', { class: 'run-actions' }, actions)));

  const paint = () => {
    const rem = remainingMs(f);
    if (rem <= 0) { clearInterval(tickId); refresh(); return; }
    const sec = Math.ceil(rem / 1000), hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60;
    time.textContent = hh ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    bar.setAttribute('stroke-dashoffset', String(C * progress(f)));
  };
  paint();
  tickId = setInterval(paint, 1000);
}

async function endEarly() {
  const ok = await confirmDialog({ title: t('focus.endConfirmTitle'), body: t('focus.endConfirmBody'), confirm: t('focus.end'), cancel: t('focus.keepGoing'), danger: true });
  if (ok) await send('focus:stop');
}

/* ---------- current site ---------- */

const CLS_ICON = { productive: 'circle-check', neutral: 'minus', distracting: 'circle-alert' };

function renderSite() {
  const el = $('#site');
  const host = state.tab?.host;
  if (!host) { el.hidden = true; return; }
  el.hidden = false;
  const { settings } = state;
  const { classify } = makeClassifier(settings);
  const cls = classify(host);
  const b = settings.blocking;
  const sec = Object.entries(state.today?.d || {}).reduce((a, [hh, s]) => (matches(hh, host) ? a + s : a), 0);
  const blocked = b.always.includes(host);
  const limitKey = Object.keys(b.limits).find((d) => matches(host, d));

  const seg = ['productive', 'neutral', 'distracting'].map((c) => h('button', {
    type: 'button', 'data-cls': c, 'aria-pressed': String(cls === c),
    onclick: async () => {
      await updateSettings((s) => { s.sites[host] = c; if (c !== 'distracting') s.blocking.always = s.blocking.always.filter((x) => x !== host); });
      send('settings:changed'); await refresh();
    },
  }, icon(CLS_ICON[c]), t('class.' + c)));

  const extra = h('div', { class: 'site-extra' },
    limitKey ? [h('span', { class: 'num', text: fmtDuration(sec) }), h('div', { class: 'progress' }, h('i', { style: { width: Math.min(100, (sec / (b.limits[limitKey] * 60)) * 100) + '%' } })), h('span', { class: 'num', text: fmtDuration(b.limits[limitKey] * 60) })] : h('span'),
    h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: async () => {
      await updateSettings((s) => { s.blocking.always = blocked ? s.blocking.always.filter((x) => x !== host) : [...new Set([...s.blocking.always, host])]; });
      await send('settings:changed');
      if (!blocked) window.close(); else await refresh();
    } }, icon(blocked ? 'unlock' : 'ban'), blocked ? t('site.unblock') : t('site.alwaysBlock')));

  clear(el,
    h('div', { class: 'site-row' }, favicon(host, 'fav-lg'),
      h('div', { class: 'grow' }, h('div', { class: 'name truncate', text: host }), h('div', { class: 'meta num', text: sec >= 60 ? t('site.today', { time: fmtDuration(sec) }) : t('site.justStarted') }))),
    h('div', { class: 'site-class', role: 'group', 'aria-label': t('site.classLabel') }, seg), extra);
}

/* ---------- today ---------- */

function renderToday() {
  const el = $('#today');
  const { classify } = makeClassifier(state.settings);
  const sum = summarize([[dayKey(), state.today]], classify);
  const y = summarize([[dayKey(), state.yesterday]], classify);

  if (sum.total < 60) {
    clear(el, h('div', { class: 'empty', style: { padding: 'var(--s-4)' } },
      h('div', { class: 'empty-icon' }, icon('chart-column')),
      h('h4', { text: t('today.emptyTitle') }), h('p', { text: t('today.emptyBody') })));
    el.append(eyeRow());
    return;
  }

  const diff = y.total >= 60 ? sum.total - y.total : null;
  const deltaTxt = diff === null ? '' : Math.abs(diff) < 300 ? t('today.sameAsYesterday') : t(diff > 0 ? 'today.moreThanYesterday' : 'today.lessThanYesterday', { time: fmtDuration(Math.abs(diff)) });
  const seg = (cls, key) => sum[key] > 0 ? h('i', { class: cls, style: { flexGrow: sum[key] }, 'data-tip': `${t('class.' + { p: 'productive', n: 'neutral', d: 'distracting' }[cls])}: ${fmtDuration(sum[key])}` }) : null;
  const top = sum.topSites.slice(0, 3);
  const max = top[0]?.sec || 1;

  clear(el,
    h('div', { class: 'today-head' },
      h('div', {}, h('div', { class: 'eyebrow', text: t('today.title') }), h('div', { class: 'today-total num', text: fmtDuration(sum.total) })),
      h('div', { class: 'delta', text: deltaTxt })),
    h('div', { class: 'split', role: 'img', 'aria-label': t('today.splitLabel') }, seg('p', 'productive'), seg('n', 'neutral'), seg('d', 'distracting')),
    h('div', { class: 'legend-grid' }, [['productive', 'dot-productive'], ['neutral', 'dot-neutral'], ['distracting', 'dot-distracting']].map(([k, dot]) =>
      h('div', {}, h('span', { class: 'lg' }, h('i', { class: 'dot ' + dot }), t('class.' + k)), h('b', { class: 'num', text: fmtDuration(sum[k]) })))),
    top.length ? h('div', { class: 'top-sites' }, top.map((s) => h('div', { class: 'top-site' }, favicon(s.host), h('span', { class: 'truncate', text: s.host }), h('span', { class: 't num', text: fmtDuration(s.sec) }), h('div', { class: 'bar' }, h('i', { class: 'cls-' + s.cls, style: { width: (s.sec / max) * 100 + '%' } })))) ) : null,
    eyeRow());
}

function eyeRow() {
  const { eye } = state.settings;
  if (!eye.enabled) return h('span');
  const left = Math.max(0, eye.intervalMin * 60 - (state.eye?.since || 0));
  const due = state.eye?.due;
  return h('div', { class: 'breaks' + (due ? ' due' : '') },
    h('span', { class: 'lbl' }, icon('eye'), due ? t('eye.due') : t('eye.nextIn', { time: fmtDuration(left) })),
    h('button', { class: 'btn btn-sm ' + (due ? 'btn-primary' : 'btn-ghost'), type: 'button', onclick: () => { send('break:open'); window.close(); } }, t('eye.breakNow')));
}

/* ---------- footer ---------- */

function renderFooter() {
  const el = $('#footer');
  const input = h('input', { class: 'input', placeholder: t('capture.placeholder'), 'aria-label': t('capture.placeholder'), maxlength: 500, onkeydown: async (e) => {
    if (e.key !== 'Enter' || !e.target.value.trim()) return;
    const list = await getCollection('captures', []);
    list.unshift({ id: String(Date.now()), text: e.target.value.trim(), at: Date.now() });
    await setCollection('captures', list.slice(0, 200));
    e.target.value = '';
    toast(t('capture.saved'));
  } });
  const paused = state.pausedUntil > Date.now();
  const pause = paused
    ? h('button', { type: 'button', onclick: async () => { await send('tracking:pause', { minutes: 0 }); await refresh(); } }, icon('play'), t('track.resume'))
    : h('button', { type: 'button', onclick: async () => { await send('tracking:pause', { minutes: 60 }); await refresh(); } }, icon('pause'), t('track.pause'));
  clear(el,
    h('div', { class: 'capture' }, input),
    h('div', { class: 'foot-row' }, pause, h('span', { class: 'num', text: paused ? t('track.pausedUntil', { time: fmtTime(new Date(state.pausedUntil)) }) : '' })));
}

/* ---------- boot ---------- */

function renderAll() { renderFocus(); renderSite(); renderToday(); renderFooter(); }

async function refresh() { await load(); renderAll(); }

(async function main() {
  await bootPage({ onSettings: () => refresh() });
  await load();
  renderAll();
  onChange(['focus', 'pausedUntil', 'd:*'], async () => {
    const wasFocus = !!state.focus;
    await load();
    // keep typed input intact: only re-render the parts that changed
    if (wasFocus !== !!state.focus) renderFocus();
    renderSite(); renderToday(); renderFooter();
  });
})();
