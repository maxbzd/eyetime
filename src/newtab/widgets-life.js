// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Widgets for the day itself: tasks, habits, a counter, calendars (month, agenda, week strip), the body (breathing, water, mood, focus sound) and the look of the page (quote, label, photo, orb, quick links).

import { icon, favicon, isEnter } from '../ui/dom.js';
import { send } from '../ui/api.js';
import { t, fmtNumber, fmtDate, weekdayName, getLocale, fmtDuration } from '../shared/i18n.js';
import { getSettings, getCollection, setCollection, updateCollection, getDays } from '../shared/storage.js';
import { dayKey, addDays, rangeKeys, parseKey } from '../shared/time.js';
import { updateEstLog } from '../shared/tasks.js';
import { safeHref } from '../shared/settings-clean.js';
import { pickQuote, renderQuote } from '../shared/quotepick.js';
import { monthGrid, breathAt, BREATH } from '../shared/wgx.js';
import { el, h, clearKeep as clear, live, motionOk } from './widget-kit.js';

const weekStartOf = (c, _s) => (c.weekStart === 'mon' ? 1 : c.weekStart === 'sun' ? 0 : /^(en-US|en-CA|ja|zh|pt-BR)/.test(getLocale()) ? 0 : 1);
const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
const settingsLink = (hash, label) => h('a', { class: 'btn btn-sm', href: chrome.runtime.getURL('src/options/options.html#' + hash) }, icon('settings'), label);

export const LIFE_DEFS = {
  /* ---------- tasks ---------- */
  todo: {
    build(root, api) {
      const draw = async (alive) => {
        const [tasks, s] = await Promise.all([getCollection('tasks', []), getSettings()]);
        if (!alive() || root.contains(document.activeElement) && document.activeElement?.matches('input.wt-add')) return;
        const open = tasks.filter((x) => !x.done).sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0) || (a.due || 'z').localeCompare(b.due || 'z')), n = api.cfg().n;
        const toggle = (x, on) => updateCollection('tasks', [], (list) => { const k = list.find((y) => y.id === x.id); if (!k) return; k.done = on; k.doneAt = on ? Date.now() : 0; if (on) k.starred = false; getCollection('estLog', []).then((log) => setCollection('estLog', updateEstLog(log, k))); });
        clear(root, el('div', 'wg-label', t('wg.k.todo'), open.length ? el('span', 'wt-count num', fmtNumber(open.length)) : null),
          open.length ? el('ul', 'wt-list', open.slice(0, n).map((x) => el('li', 'wt-item' + (x.starred ? ' star' : ''),
            h('label', { class: 'check' }, h('input', { type: 'checkbox', 'aria-label': x.text, onchange: (e) => toggle(x, e.target.checked) }), el('span', 'box', icon('check'))),
            el('span', 'wt-text', x.text), x.starred ? el('span', 'wt-star', icon('star')) : null))) : el('div', 'wg-sub', t('wg.todo.empty')),
          open.length > n ? el('div', 'wg-sub', t('wg.todo.more', { n: fmtNumber(open.length - n) })) : null,
          h('input', { class: 'input wt-add', maxlength: 200, placeholder: t('wg.todo.add'), 'aria-label': t('wg.todo.add'), onkeydown: async (e) => {
            if (!isEnter(e) || !e.target.value.trim()) return;
            const { taskFromInput } = await import('../shared/tasks.js');
            const text = e.target.value; e.target.value = '';
            await updateCollection('tasks', [], (list) => { list.unshift(taskFromInput(text, list).task); });
          } }));
        void s;
      };
      return live(draw, { watch: ['tasks'] });
    },
  },

  habit: {
    build(root, api) {
      let pick = '';
      const draw = async (alive) => {
        const data = await getCollection('habits', { items: [], log: {} });
        if (!alive()) return;
        if (!data.items.length) { clear(root, el('div', 'wg-label', t('wg.k.habit')), el('div', 'wg-sub', t('wg.habit.none')), settingsLink('', t('wg.habit.add'))); return; }
        const id = pick || api.cfg().id, it = data.items.find((x) => x.id === id) || data.items[0], today = dayKey();
        const on = (k) => (data.log[k] || []).includes(it.id);
        let streak = 0, d = new Date(); if (!on(dayKey(d))) d = addDays(d, -1);
        while (on(dayKey(d)) && streak < 3650) { streak++; d = addDays(d, -1); }
        const week = rangeKeys(7);
        const toggle = () => updateCollection('habits', { items: [], log: {} }, (v) => { const set = new Set(v.log[today] || []); set.has(it.id) ? set.delete(it.id) : set.add(it.id); set.size ? v.log[today] = [...set] : delete v.log[today]; });
        clear(root, el('div', 'wg-label', data.items.length > 1
          ? h('button', { class: 'hb-name', type: 'button', 'aria-label': t('wg.habit.next') + ': ' + it.name, onclick: () => { pick = data.items[(data.items.indexOf(it) + 1) % data.items.length].id; api.save({ id: pick }); draw(() => true); } }, it.name, icon('chevrons-up-down'))
          : it.name),
          h('button', { class: 'hb-done' + (on(today) ? ' on' : ''), type: 'button', 'aria-pressed': String(on(today)), 'aria-label': it.name, onclick: toggle }, icon('check')),
          el('div', 'hb-week', week.map((k) => el('i', on(k) ? 'on' : k === today ? 'now' : '', { title: k }))),
          streak >= 1 ? el('div', 'fx-chip', icon('flame'), t('wg.streak.days', { n: fmtNumber(streak) })) : el('div', 'wg-sub', t('wg.habit.start')));
      };
      return live(draw, { watch: ['habits'], every: 600_000 });
    },
  },


  /* ---------- calendar ---------- */
  month: {
    build(root, api) {
      const draw = async (alive) => {
        const now = new Date(), s = await getSettings(), c = api.cfg(), ws = weekStartOf(c, s), tasks = await getCollection('tasks', []);
        if (!alive()) return;
        const due = new Set(tasks.filter((x) => !x.done && x.due).map((x) => x.due)), today = dayKey(now);
        const grid = monthGrid(now.getFullYear(), now.getMonth(), ws);
        clear(root, el('div', 'wg-label', fmtDate(now, { month: 'long', year: 'numeric' })),
          el('div', 'mn-grid', { role: 'grid' },
            Array.from({ length: 7 }, (_, i) => el('span', 'mn-dow', weekdayName((ws + i) % 7, 'narrow'))),
            grid.flat().map((c2) => el('span', 'mn-d num' + (c2.inMonth ? '' : ' out') + (c2.key === today ? ' now' : '') + (due.has(c2.key) ? ' due' : ''), String(c2.day)))));
      };
      return live(draw, { watch: ['tasks', 'settings'], every: 3_600_000 });
    },
  },

  agenda: {
    build(root, api) {
      const draw = async (alive) => {
        const [events, allDay] = await Promise.all([getCollection('calendar', []), getCollection('calendarDays', [])]);
        if (!alive()) return;
        const now = new Date(), today = dayKey(now), nowMin = now.getHours() * 60 + now.getMinutes(), n = api.cfg().n;
        const todays = events.filter((e) => e.day === today && toMin(e.end) > nowMin).sort((a, b) => toMin(a.start) - toMin(b.start));
        const days = allDay.filter((e) => e.day === today);
        if (!events.length && !allDay.length) { clear(root, el('div', 'wg-label', t('wg.k.agenda')), el('div', 'wg-sub', t('wg.ne.none')), settingsLink('calendar', t('wg.agenda.connect'))); return; }
        clear(root, el('div', 'wg-label', t('wg.k.agenda')),
          days.slice(0, 2).map((e) => el('div', 'ag-allday', icon('sun'), e.title || t('meet.untitled'))),
          todays.length ? el('ul', 'ag-list', todays.slice(0, n).map((e) => el('li', 'ag-row' + (toMin(e.start) <= nowMin ? ' now' : ''),
            el('span', 'ag-time num', e.start), el('span', 'ag-title', e.title || t('meet.untitled')), el('span', 'ag-len', fmtDuration((toMin(e.end) - toMin(e.start)) * 60)))))
            : el('div', 'wg-sub', t('wg.ne.done')));
      };
      return live(draw, { watch: ['calendar', 'calendarDays'], every: 30_000 });
    },
  },

  weekstrip: {
    build(root) {
      const draw = async (alive) => {
        const s = await getSettings(), ws = weekStartOf({}, s), now = new Date();
        const start = addDays(now, -((now.getDay() - ws + 7) % 7)), keys = Array.from({ length: 7 }, (_, i) => dayKey(addDays(start, i)));
        const [tasks, ds] = await Promise.all([getCollection('tasks', []), getDays(keys)]);
        if (!alive()) return;
        const today = dayKey(now), max = Math.max(30 * 60, ...ds.map(([, d]) => d?.fs || 0));
        clear(root, el('div', 'wk-strip', keys.map((k, i) => {
          const d = parseKey(k), fs = ds[i][1]?.fs || 0, n = tasks.filter((x) => !x.done && x.due === k).length;
          return el('div', 'ws-day' + (k === today ? ' now' : k < today ? ' past' : ''),
            el('span', 'ws-dow', weekdayName(d.getDay(), 'short')), el('span', 'ws-num num', String(d.getDate())),
            el('span', 'ws-bar', el('i', '', { style: `height:${Math.max(fs ? 8 : 0, fs / max * 100).toFixed(0)}%` })),
            el('span', 'ws-tasks', n ? el('b', 'num', String(n)) : ''));
        })));
      };
      return live(draw, { watch: ['tasks', 'd:*', 'settings'], every: 3_600_000 });
    },
  },

  /* ---------- body ---------- */
  breath: {
    build(root, api) {
      const circle = el('div', 'br-circle'), word = el('div', 'br-word'), count = el('div', 'br-count num');
      let raf = 0, t0 = 0, last = '';
      const names = { in: t('wg.breath.in'), hold: t('wg.breath.hold'), out: t('wg.breath.out'), rest: t('wg.breath.hold') };
      const frame = (ts) => {
        const c = api.cfg(); if (!t0) t0 = ts;
        const b = breathAt(c.pattern, (ts - t0) / 1000), k = b.phase + b.left;
        circle.style.setProperty('--b', (0.45 + b.size * 0.55).toFixed(3));
        if (k !== last) { last = k; word.textContent = names[b.phase]; count.textContent = String(b.left); }
        raf = window.requestAnimationFrame(frame);
      };
      clear(root, el('div', 'br-stage', circle, el('div', 'br-text', word, count)), el('div', 'wg-sub br-pat', ''));
      const pat = () => { const p = BREATH[api.cfg().pattern] || BREATH.box; root.querySelector('.br-pat').textContent = p.filter(Boolean).join(' · '); };
      pat();
      if (motionOk()) raf = window.requestAnimationFrame(frame);
      else { circle.style.setProperty('--b', '.8'); word.textContent = t('wg.breath.still'); }
      return { update: () => { t0 = 0; last = ''; pat(); }, destroy: () => window.cancelAnimationFrame(raf) };
    },
  },



  sound: {
    build(root) {
      const KINDS = ['off', 'brown', 'rain', 'river', 'forest'];
      const draw = async (alive) => {
        const s = await getSettings();
        if (!alive()) return;
        const cur = s.focus.ambient || 'off';
        clear(root, el('div', 'wg-label', t('wg.k.sound')),
          el('div', 'sd-grid', KINDS.map((k) => h('button', { class: 'chip sd-btn' + (k === cur ? ' on' : ''), type: 'button', 'aria-pressed': String(k === cur), onclick: () => send('ambient:set', { kind: k }) }, t('wg.sound.' + k)))),
          el('div', 'wg-sub', t('wg.sound.note')));
      };
      return live(draw, { watch: ['settings'] });
    },
  },

  /* ---------- the look of the page ---------- */
  quote: {
    build(root, api) {
      const draw = () => {
        const c = api.cfg(), q = pickQuote(c.ctx, { seed: dayKey() + c.ctx });
        if (!q) { clear(root); return; }
        const r = renderQuote(q, getLocale());
        root.dataset.look = c.look;
        clear(root, el('blockquote', 'qt-text', r.text), r.author ? el('div', 'qt-by', '— ' + r.author) : null);
      };
      return live(draw, { every: 3_600_000 });
    },
  },




  links: {
    build(root, api) {
      const draw = async (alive) => {
        const s = await getSettings();
        if (!alive()) return;
        const links = s.newtab.links.slice(0, api.cfg().n);
        if (!links.length) { clear(root, el('div', 'wg-label', t('wg.k.links')), el('div', 'wg-sub', t('wg.links.none')), settingsLink('', t('wg.links.add'))); return; }
        clear(root, el('div', 'lk-grid', links.map((l) => {
          let host = ''; try { host = new URL(l.url).hostname; } catch { /* a broken link still shows its title */ }
          return h('a', { class: 'lk-tile', href: safeHref(l.url) || undefined, title: l.title }, favicon(host.replace(/^www\./, ''), 'fav'), el('span', 'lk-t', l.title));
        })));
      };
      return live(draw, { watch: ['settings'] });
    },
  },
};
