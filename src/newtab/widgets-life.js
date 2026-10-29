// Widgets for the day itself: tasks, habits, a counter, calendars (month, agenda, week strip), the body (breathing, water, mood, focus sound) and the look of the page (quote, label, photo, orb, quick links).

import { icon, favicon } from '../ui/dom.js';
import { send } from '../ui/api.js';
import { t, fmtNumber, fmtDate, weekdayName, getLocale, fmtDuration } from '../shared/i18n.js';
import { getSettings, getCollection, setCollection, updateCollection, getDays } from '../shared/storage.js';
import { dayKey, addDays, rangeKeys, parseKey } from '../shared/time.js';
import { updateEstLog } from '../shared/tasks.js';
import { pickQuote, renderQuote } from '../shared/quotepick.js';
import { monthGrid, breathAt, BREATH } from '../shared/wgx.js';
import { el, h, clearKeep as clear, live, motionOk } from './widget-kit.js';

const weekStartOf = (c, _s) => (c.weekStart === 'mon' ? 1 : c.weekStart === 'sun' ? 0 : /^(en-US|en-CA|ja|zh|pt-BR)/.test(getLocale()) ? 0 : 1);
const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
const MOODS = [{ icon: 'angry', v: 1 }, { icon: 'frown', v: 2 }, { icon: 'meh', v: 3 }, { icon: 'smile', v: 4 }, { icon: 'laugh', v: 5 }];
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
            if (e.key !== 'Enter' || !e.target.value.trim()) return;
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

  counter: {
    build(root, api) {
      const draw = () => {
        const c = api.cfg(), frac = c.target ? Math.min(1, c.count / c.target) : 0;
        const set = (n) => api.save({ count: Math.max(0, Math.min(99999, n)) });
        clear(root, el('div', 'wg-label', c.title || t('wg.k.counter')),
          el('div', 'ct-num num', fmtNumber(c.count), c.target ? el('span', 'ct-of', '/ ' + fmtNumber(c.target)) : null),
          c.target ? el('div', 'ct-bar', el('i', '', { style: `width:${(frac * 100).toFixed(1)}%` })) : null,
          el('div', 'ct-btns',
            h('button', { class: 'btn btn-icon', type: 'button', 'aria-label': t('wg.counter.minus'), disabled: !c.count, onclick: () => set(c.count - c.step) }, icon('minus')),
            h('button', { class: 'btn btn-primary btn-icon', type: 'button', 'aria-label': t('wg.counter.plus'), onclick: () => set(c.count + c.step) }, icon('plus')),
            c.count ? h('button', { class: 'btn btn-ghost btn-icon ct-reset', type: 'button', 'aria-label': t('wg.counter.reset'), onclick: () => set(0) }, icon('rotate-ccw')) : null));
      };
      draw();
      return { update: draw };
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

  water: {
    build(root, api) {
      const draw = () => {
        let c = api.cfg(); const today = dayKey(), n = c.day === today ? c.n : 0;
        const set = (v) => api.save({ day: today, n: Math.max(0, Math.min(40, v)) });
        clear(root, el('div', 'wg-label', t('wg.k.water')),
          el('div', 'wa-cups', Array.from({ length: Math.max(c.goal, n) }, (_, i) => h('button', { class: 'wa-cup' + (i < n ? ' on' : ''), type: 'button', 'aria-pressed': String(i < n), 'aria-label': t('wg.water.cup', { n: i + 1 }), onclick: () => set(i + 1 === n ? i : i + 1) }, icon('droplet')))),
          el('div', 'wg-sub', t('wg.water.of', { n: fmtNumber(n), goal: fmtNumber(c.goal) })));
      };
      draw();
      return { update: draw, destroy() {} };
    },
  },

  mood: {
    build(root, api) {
      const draw = () => {
        const c = api.cfg(), today = dayKey(), log = c.log, week = rangeKeys(7);
        const set = (v) => { const next = { ...log }; log[today] === v ? delete next[today] : next[today] = v; api.save({ log: next }); };
        clear(root, el('div', 'wg-label', t('wg.mood.q')),
          el('div', 'md-row', MOODS.map((m) => { const v = m.v; return h('button', { class: 'md-btn m' + v + (log[today] === v ? ' on' : ''), type: 'button', 'aria-pressed': String(log[today] === v), 'aria-label': t('wg.mood.' + v), 'data-tip': t('wg.mood.' + v), onclick: () => set(v) }, icon(m.icon)); })),
          el('div', 'md-week', week.map((k) => el('i', log[k] ? 'm' + log[k] : '', { title: k }))));
      };
      draw();
      return { update: draw };
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

  label: {
    build(root, api) {
      const draw = () => {
        const c = api.cfg();
        root.dataset.font = c.font; root.dataset.align = c.align;
        clear(root, el('div', 'lb-text' + (c.text ? '' : ' empty'), { style: `font-weight:${c.weight}` }, c.text || t('wg.label.ph')));
      };
      draw();
      return { update: draw };
    },
  },

  photo: {
    build(root, api) {
      const draw = () => {
        const c = api.cfg();
        root.dataset.style = c.style;
        clear(root, el('div', 'ph-frame', el('div', 'ph-img', { role: 'img', 'aria-label': t('wg.k.photo') }), c.style === 'polaroid' ? el('div', 'ph-cap', c.text || fmtDate(new Date(), { day: 'numeric', month: 'long' })) : c.text ? el('div', 'ph-cap sm', c.text) : null));
      };
      draw();
      return { update: draw };
    },
  },

  orb: {
    build(root, api) {
      const draw = () => {
        const c = api.cfg();
        root.dataset.palette = c.palette; root.dataset.speed = c.speed;
        clear(root, el('div', 'ob-wrap', el('div', 'ob-orb', el('i', 'a'), el('i', 'b'), el('i', 'c')), el('div', 'ob-gloss')));
      };
      draw();
      return { update: draw };
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
          return h('a', { class: 'lk-tile', href: l.url, title: l.title }, favicon(host.replace(/^www\./, ''), 'fav'), el('span', 'lk-t', l.title));
        })));
      };
      return live(draw, { watch: ['settings'] });
    },
  },
};
