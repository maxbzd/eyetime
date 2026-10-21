// Settings sections. Each takes ctx = { s: settings, save(fn), refresh() } and returns an element.

import { h, icon, toast, confirmDialog, clear } from '../ui/dom.js';
import { send } from '../ui/api.js';
import { row, group, toggle, select, domainEditor, sectionHead } from './ui.js';
import { t, LANGUAGES, weekdayName, fmtDuration } from '../shared/i18n.js';
import { PRESETS, PRESET_IDS } from '../shared/catalog.js';
import { importAll, resetAll, getRaw, setRaw, getRange } from '../shared/storage.js';
import { buildJournal } from '../shared/journal.js';
import { downloadBackup } from '../ui/backup.js';
import { parseIcs } from '../shared/ics.js';
import { buildReport, issueUrl } from '../shared/diagnostics.js';
import { readErrors, clearErrors } from '../shared/errorlog.js';
import { makeClassifier } from '../shared/classify.js';
import { fmtTime } from '../shared/i18n.js';
import { parseUserDomain } from '../shared/domains.js';
import { dayKey } from '../shared/time.js';

export { appearance } from './appearance-section.js';
const sec = (id, ...kids) => h('section', { class: 'sec', id }, kids);
const mins = (list) => list.map((m) => [m, t('opt.minutes', { n: m })]);

/* ============================== General ============================== */
export function general({ s, save, refresh }) {
  return sec('general', sectionHead(t('sec.general'), t('sec.generalDesc')),
    group(null,
      row({ title: t('opt.language'), control: select([['auto', t('opt.auto')], ...Object.entries(LANGUAGES)], s.language, (v) => save((x) => { x.language = v; }, true), { label: t('opt.language') }) })),
    group(t('opt.groupHome'),
      row({ title: t('opt.homeEnabled'), desc: t('opt.homeEnabledDesc'), control: toggle(s.newtab.enabled, (v) => save((x) => { x.newtab.enabled = v; }), t('opt.homeEnabled')) }),
      row({ title: t('opt.homeCustomize'), desc: t('opt.homeCustomizeDesc'), control: h('a', { class: 'btn', href: chrome.runtime.getURL('src/newtab/newtab.html') }, icon('sliders-horizontal'), t('home.customize')) })),
    group(t('opt.groupNotify'),
      row({ title: t('opt.badge'), desc: t('opt.badgeDesc'), control: toggle(s.tracking.badge, (v) => save((x) => { x.tracking.badge = v; }), t('opt.badge')) }),
      row({ title: t('opt.weekly'), desc: t('opt.weeklyDesc'), control: toggle(s.weeklyReport, (v) => save((x) => { x.weeklyReport = v; }), t('opt.weekly')) })));
}

/* ============================== Focus ============================== */

/** Focus modes: presets for a whole session — length, scope, strictness, sound and sites that stay open. */
function modesEditor(s, save) {
  const modes = s.focus.modes;
  const upd = (id, fn) => save((x) => { const m = x.focus.modes.find((y) => y.id === id); if (m) fn(m); });
  const card = (m) => h('div', { class: 'mode-card' },
    h('div', { class: 'row gap-2' },
      icon(m.icon || 'zap'),
      h('input', { class: 'input input-sm grow', value: m.name || (t('mode.' + m.id) === 'mode.' + m.id ? '' : t('mode.' + m.id)), maxlength: 24, placeholder: t('mode.new'), 'aria-label': t('mode.name'), onchange: (e) => upd(m.id, (y) => { y.name = e.target.value.trim(); }) }),
      modes.length > 1 ? h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': t('common.remove'), onclick: () => save((x) => { x.focus.modes = x.focus.modes.filter((y) => y.id !== m.id); if (x.focus.mode === m.id) x.focus.mode = x.focus.modes[0].id; }, true) }, icon('x')) : null),
    h('div', { class: 'mode-fields' },
      select([15, 25, 30, 45, 50, 60, 90, 120].map((n) => [n, fmtDuration(n * 60)]), m.minutes, (v) => upd(m.id, (y) => { y.minutes = Number(v); }), { label: t('opt.focusDefault') }),
      select([['distractions', t('opt.scopeDistractions')], ['only-mine', t('focus.onlyMine')]], m.scope, (v) => upd(m.id, (y) => { y.scope = v; }), { label: t('opt.scope') }),
      select(['off', 'brown', 'rain', 'river', 'forest'].map((k) => [k, t('ambient.' + k)]), m.ambient || 'off', (v) => upd(m.id, (y) => { y.ambient = v; }), { label: t('opt.ambient') }),
      h('label', { class: 'row gap-2 mode-strict' }, toggle(!!m.strict, (v) => upd(m.id, (y) => { y.strict = v; }), t('focus.strict')), h('span', { text: t('focus.strictShort') }))),
    h('div', { class: 'stack gap-2' }, h('div', { class: 'muted', style: { fontSize: 'var(--fs-sm)' }, text: t('mode.allow') }),
      domainEditor({ items: m.allow || [], placeholder: 'example.com', onAdd: (d) => upd(m.id, (y) => { y.allow = [...new Set([...(y.allow || []), d])]; }), onRemove: (d) => upd(m.id, (y) => { y.allow = (y.allow || []).filter((x) => x !== d); }) })));
  return h('div', { class: 'stack gap-3', style: { alignItems: 'stretch' } }, modes.map(card),
    modes.length < 6 ? h('button', { class: 'btn btn-sm', type: 'button', style: { alignSelf: 'flex-start' }, onclick: () => save((x) => { x.focus.modes.push({ id: 'm' + Date.now().toString(36), icon: 'zap', name: '', minutes: 25, scope: 'distractions', strict: false, ambient: 'off', allow: [] }); }, true) }, icon('plus'), t('mode.add')) : null);
}

/** Scheduled "time to focus" nudges: a time, the weekdays it repeats on and how long the session is. */
function remindersEditor(s, save) {
  const list = s.focus.reminders;
  const upd = (id, fn) => save((x) => { const r = x.focus.reminders.find((y) => y.id === id); if (r) fn(r); });
  const days = [1, 2, 3, 4, 5, 6, 0];
  const rows = list.map((r) => h('div', { class: 'reminder' },
    h('input', { class: 'input input-sm', type: 'time', value: r.time, 'aria-label': t('opt.remindTime'), onchange: (e) => e.target.value && upd(r.id, (x) => { x.time = e.target.value; }) }),
    h('div', { class: 'row gap-1 wrap' }, days.map((d) => h('button', { class: 'chip chip-day', type: 'button', 'aria-pressed': String(r.days.includes(d)), text: weekdayName(d), onclick: () => upd(r.id, (x) => { x.days = x.days.includes(d) ? x.days.filter((n) => n !== d) : [...x.days, d]; }) }))),
    select([...new Set([...s.focus.presets, r.minutes])].sort((a, b) => a - b).map((m) => [m, t('opt.minutes', { n: m })]), r.minutes, (v) => upd(r.id, (x) => { x.minutes = Number(v); }), { label: t('opt.remindLen') }),
    h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': t('common.remove'), onclick: () => save((x) => { x.focus.reminders = x.focus.reminders.filter((y) => y.id !== r.id); }, true) }, icon('x'))));
  return h('div', { class: 'stack gap-3', style: { alignItems: 'stretch' } }, rows,
    list.length < 5 ? h('button', { class: 'btn btn-sm', type: 'button', style: { alignSelf: 'flex-start' }, onclick: () => save((x) => { x.focus.reminders.push({ id: Date.now().toString(36), time: '09:00', days: [1, 2, 3, 4, 5], minutes: 50 }); }, true) }, icon('plus'), t('opt.addReminder')) : null);
}

export function focus({ s, save, refresh }) {
  const presetErr = h('div', { class: 'hint', style: { color: 'var(--distracting-text)' } });
  const setPresets = (list) => save((x) => { x.focus.presets = list; if (!list.includes(x.focus.minutes)) x.focus.minutes = list[0]; }, true);
  const presetsIn = h('div', { class: 'stack gap-2' },
    h('div', { class: 'dur-chips' }, s.focus.presets.map((m) => h('span', { class: 'chip chip-x' }, h('span', { class: 'chip-t', text: fmtDuration(m * 60) }), s.focus.presets.length > 1 ? h('button', { type: 'button', 'aria-label': t('common.remove') + ' ' + fmtDuration(m * 60), onclick: () => setPresets(s.focus.presets.filter((n) => n !== m)) }, icon('x')) : null)),
      s.focus.presets.length < 5 ? h('input', { class: 'input input-sm num', type: 'number', min: 1, max: 720, placeholder: t('opt.addMinutes'), 'aria-label': t('opt.addMinutes'), style: { width: '110px' }, onkeydown: (e) => {
        if (e.key !== 'Enter') return; e.preventDefault();
        const n = Math.round(Number(e.target.value));
        if (!(n >= 1 && n <= 720)) { presetErr.textContent = t('opt.presetBad'); return; }
        if (s.focus.presets.includes(n)) { presetErr.textContent = ''; e.target.value = ''; return; }
        setPresets([...s.focus.presets, n].sort((a, b) => a - b));
      } }) : null), presetErr);
  const urlIn = h('input', { class: 'input input-sm', style: { width: '260px' }, type: 'url', placeholder: 'https://…', value: s.focus.openUrl, 'aria-label': t('opt.focusUrl'), onchange: (e) => {
    const v = e.target.value.trim();
    if (v && !/^https?:\/\//i.test(v)) { toast(t('links.invalid')); e.target.value = s.focus.openUrl; e.target.setAttribute('aria-invalid', 'true'); return; }
    e.target.removeAttribute('aria-invalid');
    save((x) => { x.focus.openUrl = v; });
  } });
  return sec('focus', sectionHead(t('sec.focus'), t('sec.focusDesc')),
    group(null,
      row({ title: t('opt.focusDefault'), desc: t('opt.focusDefaultDesc'), control: select(s.focus.presets.map((m) => [m, t('opt.minutes', { n: m })]), s.focus.minutes, (v) => save((x) => { x.focus.minutes = Number(v); }), { label: t('opt.focusDefault') }) }),
      row({ title: t('opt.focusPresets'), desc: t('opt.focusPresetsDesc'), stack: true, control: presetsIn }),
      row({ title: t('opt.restAfter'), desc: t('opt.restAfterDesc'), control: select([[0, t('common.off')], ...[3, 5, 10, 15].map((m) => [m, t('opt.minutes', { n: m })])], s.focus.breakMinutes, (v) => save((x) => { x.focus.breakMinutes = Number(v); }), { label: t('opt.restAfter') }) }),
      row({ title: t('opt.longBreak'), desc: t('opt.longBreakDesc'), control: h('div', { class: 'row gap-2' },
        select([[0, t('common.off')], ...[2, 3, 4, 5].map((n) => [n, t('opt.everyN', { n })])], s.focus.longBreak.every, (v) => save((x) => { x.focus.longBreak.every = Number(v); }), { label: t('opt.longBreak') }),
        select([10, 15, 20, 30].map((m) => [m, t('opt.minutes', { n: m })]), s.focus.longBreak.minutes, (v) => save((x) => { x.focus.longBreak.minutes = Number(v); }), { label: t('opt.longBreakLen') })) }),
      row({ title: t('focus.strict'), desc: t('opt.strictDesc'), control: toggle(s.focus.strict, (v) => save((x) => { x.focus.strict = v; }), t('focus.strict')) })),
    group(t('opt.groupProductivity'),
      row({ title: t('opt.dailyGoal'), desc: t('opt.dailyGoalDesc'), control: select([[0, t('common.off')], ...[30, 60, 90, 120, 180, 240, 300].map((m) => [m, fmtDuration(m * 60)])], s.focus.dailyGoal, (v) => save((x) => { x.focus.dailyGoal = Number(v); }), { label: t('opt.dailyGoal') }) }),
      s.focus.dailyGoal ? row({ title: t('opt.goalDays'), desc: t('opt.goalDaysDesc'), control: h('div', { class: 'row gap-1 wrap' }, [1, 2, 3, 4, 5, 6, 0].map((d) => h('button', { class: 'chip chip-day', type: 'button', 'aria-pressed': String(s.focus.goalDays.includes(d)), text: weekdayName(d), onclick: () => save((x) => { const on = x.focus.goalDays.includes(d); if (on && x.focus.goalDays.length === 1) return; x.focus.goalDays = on ? x.focus.goalDays.filter((n) => n !== d) : [...x.focus.goalDays, d]; }, true) }))) }) : null,
      row({ title: t('opt.ambient'), desc: t('opt.ambientDesc'), control: select(['off', 'brown', 'rain', 'river', 'forest'].map((k) => [k, t('ambient.' + k)]), s.focus.ambient, (v) => send('ambient:set', { kind: v }).then(() => {}), { label: t('opt.ambient') }) }),
      row({ title: t('opt.scope'), desc: t('opt.scopeDesc'), control: select([['distractions', t('opt.scopeDistractions')], ['only-mine', t('focus.onlyMine')]], s.focus.scope, (v) => save((x) => { x.focus.scope = v; }), { label: t('opt.scope') }) }),
      row({ title: t('opt.review'), desc: t('opt.reviewDesc'), control: toggle(s.focus.review, (v) => save((x) => { x.focus.review = v; }), t('opt.review')) }),
      row({ title: t('opt.modes'), desc: t('opt.modesDesc'), stack: true, control: modesEditor(s, save) }),
      row({ title: t('opt.reminders'), desc: t('opt.remindersDesc'), stack: true, control: remindersEditor(s, save) })),
    group(t('opt.groupExtras'),
      row({ title: t('opt.focusSound'), desc: t('opt.focusSoundDesc'), control: toggle(s.focus.sound, (v) => save((x) => { x.focus.sound = v; }), t('opt.focusSound')) }),
      row({ title: t('opt.focusUrl'), desc: t('opt.focusUrlDesc'), control: urlIn }),
      row({ title: t('opt.suggestBreak'), desc: t('opt.suggestBreakDesc'), control: toggle(s.focus.suggestBreak, (v) => save((x) => { x.focus.suggestBreak = v; }), t('opt.suggestBreak')) })));
}

/* ============================== Blocking ============================== */

/** If-then plans for the pause page. Planning the response to an urge in advance ("if X, then Y") is one of the best-studied ways to act on intentions. */
function plansEditor(s, save) {
  const list = s.blocking.plans;
  const upd = (id, fn) => save((x) => { const p = x.blocking.plans.find((y) => y.id === id); if (p) fn(p); });
  const suggestions = ['plan.s1', 'plan.s2', 'plan.s3', 'plan.s4'];
  const add = (then = '') => save((x) => { x.blocking.plans.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 4), when: '', then }); }, true);
  return h('div', { class: 'stack gap-3', style: { alignItems: 'stretch' } },
    list.map((p) => h('div', { class: 'plan-row' },
      h('span', { class: 'muted', text: t('plan.if') }),
      h('input', { class: 'input input-sm', value: p.when, placeholder: t('plan.whenPh'), spellcheck: false, 'aria-label': t('plan.if'), onchange: (e) => { const v = e.target.value.trim(); if (!v) { upd(p.id, (y) => { y.when = ''; }); return; } const d = parseUserDomain(v); if (d) upd(p.id, (y) => { y.when = d; }); else { toast(t('domains.invalid', { v })); e.target.value = p.when; } } }),
      h('span', { class: 'muted', text: t('plan.then') }),
      h('input', { class: 'input input-sm grow', value: p.then, maxlength: 100, placeholder: t('plan.thenPh'), 'aria-label': t('plan.then'), onchange: (e) => upd(p.id, (y) => { y.then = e.target.value.trim().slice(0, 100); }) }),
      h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': t('common.remove'), onclick: () => save((x) => { x.blocking.plans = x.blocking.plans.filter((y) => y.id !== p.id); }, true) }, icon('x')))),
    list.length < 6 ? h('div', { class: 'row gap-2 wrap' }, h('button', { class: 'btn btn-sm', type: 'button', onclick: () => add() }, icon('plus'), t('plan.add')), !list.length ? suggestions.map((k) => h('button', { class: 'chip', type: 'button', onclick: () => add(t(k)) }, t(k))) : null) : null);
}

export function blocking({ s, save, refresh }) {
  const b = s.blocking;
  const presetCards = h('div', { class: 'preset-grid' }, PRESET_IDS.map((id) => {
    const on = !!b.presets[id];
    return h('label', { class: 'preset' + (on ? ' on' : '') },
      h('span', { class: 'ic' }, icon(PRESETS[id].icon)),
      h('span', { class: 'grow' }, h('div', { class: 'nm', text: t('preset.' + id) }), h('div', { class: 'ct', text: t('preset.count', { n: PRESETS[id].domains.length }) })),
      toggle(on, (v) => save((x) => { x.blocking.presets[id] = v; }, true), t('preset.' + id)));
  }));

  const addTo = (key) => (d) => save((x) => { if (!x.blocking[key].includes(d)) x.blocking[key].push(d); }, true);
  const removeFrom = (key) => (d) => save((x) => { x.blocking[key] = x.blocking[key].filter((v) => v !== d); }, true);

  const sch = b.schedule;
  const days = h('div', { class: 'days', role: 'group', 'aria-label': t('opt.schedDays') }, [1, 2, 3, 4, 5, 6, 0].map((d) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(sch.days.includes(d)), onclick: () => save((x) => { const set = new Set(x.blocking.schedule.days); set.has(d) ? set.delete(d) : set.add(d); x.blocking.schedule.days = [...set].sort(); }, true) }, weekdayName(d))));
  const time = (key) => h('input', { class: 'input input-sm', type: 'time', value: sch[key], 'aria-label': key === 'start' ? t('opt.schedStart') : t('opt.schedEnd'), onchange: (e) => { if (e.target.value) save((x) => { x.blocking.schedule[key] = e.target.value; }); } });

  const fr = b.friction;
  const feed = b.feed;

  // limits
  const limitList = Object.entries(b.limits).sort();
  const dIn = h('input', { class: 'input', type: 'text', placeholder: 'youtube.com', 'aria-label': t('opt.limitSite'), spellcheck: false });
  const mIn = h('input', { class: 'input', type: 'number', min: 1, max: 1440, value: 30, 'aria-label': t('opt.limitMinutes') });
  const addLimit = () => {
    const d = parseUserDomain(dIn.value); const m = Math.round(Number(mIn.value));
    if (!d) { toast(t('domains.invalid', { v: dIn.value })); return; }
    if (!(m >= 1)) return;
    save((x) => { x.blocking.limits[d] = m; }, true);
  };
  const limits = h('div', { class: 'card' },
    limitList.length ? limitList.map(([d, m]) => h('div', { class: 'limit-row' }, h('span', { class: 'nm', text: d }), h('span', { class: 'muted num', text: t('opt.perDay', { n: m }) }),
      h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': t('common.remove') + ' ' + d, onclick: () => save((x) => { delete x.blocking.limits[d]; }, true) }, icon('x')))) : h('div', { class: 'setting' }, h('div', { class: 'setting-desc', text: t('opt.limitsEmpty') })),
    h('div', { class: 'add-limit', style: { borderTop: limitList.length ? '1px solid var(--border)' : 'none' } }, dIn, mIn, h('span', { class: 'muted', text: t('opt.minPerDay') }), h('button', { class: 'btn', type: 'button', onclick: addLimit }, icon('plus'), t('common.add'))));

  return sec('blocking', sectionHead(t('sec.blocking'), t('sec.blockingDesc')),
    h('div', {}, h('h3', { class: 'group-title', text: t('opt.groupWhat') }), presetCards),
    group(null,
      row({ title: t('opt.custom'), desc: t('opt.customDesc'), stack: true, control: domainEditor({ items: b.custom, onAdd: addTo('custom'), onRemove: removeFrom('custom'), placeholder: 'example.com' }) }),
      row({ title: t('opt.allow'), desc: t('opt.allowDesc'), stack: true, control: domainEditor({ items: b.allow, onAdd: addTo('allow'), onRemove: removeFrom('allow'), placeholder: 'example.com' }) })),

    group(t('opt.groupFriction'),
      row({ title: t('opt.friction'), desc: t('opt.frictionDesc'), control: toggle(fr.enabled, (v) => save((x) => { x.blocking.friction.enabled = v; }, true), t('opt.friction')) }),
      fr.enabled ? row({ title: t('opt.frictionSeconds'), control: select([5, 8, 10, 15, 30].map((n) => [n, t('opt.seconds', { n })]), fr.seconds, (v) => save((x) => { x.blocking.friction.seconds = Number(v); }), { label: t('opt.frictionSeconds') }) }) : null,
      row({ title: t('opt.passMinutes'), desc: t('opt.passMinutesDesc'), control: select(mins([5, 10, 15, 30]), fr.passMinutes, (v) => save((x) => { x.blocking.friction.passMinutes = Number(v); }), { label: t('opt.passMinutes') }) }),
      row({ title: t('opt.budget'), desc: t('opt.budgetDesc'), control: h('div', { class: 'row gap-2' }, b.budget.enabled ? select([15, 30, 45, 60, 90, 120].map((m) => [m, fmtDuration(m * 60)]), b.budget.minutes, (v) => save((x) => { x.blocking.budget.minutes = Number(v); }), { label: t('opt.budget') }) : null, toggle(b.budget.enabled, (v) => save((x) => { x.blocking.budget.enabled = v; }, true), t('opt.budget'))) }),
      fr.enabled ? row({ title: t('opt.plans'), desc: t('opt.plansDesc'), stack: true, control: plansEditor(s, save) }) : null),

    group(t('opt.groupSchedule'),
      row({ title: t('opt.schedule'), desc: t('opt.scheduleDesc'), control: toggle(sch.enabled, (v) => save((x) => { x.blocking.schedule.enabled = v; }, true), t('opt.schedule')) }),
      sch.enabled ? [
        row({ title: t('opt.schedDays'), stack: true, control: days }),
        row({ title: t('opt.schedHours'), control: h('div', { class: 'row gap-2' }, time('start'), h('span', { class: 'muted', text: '–' }), time('end')) }),
        row({ title: t('opt.schedStrict'), desc: t('opt.schedStrictDesc'), control: toggle(sch.strict, (v) => save((x) => { x.blocking.schedule.strict = v; }), t('opt.schedStrict')) }),
      ] : null),

    h('div', {}, h('h3', { class: 'group-title', text: t('opt.groupLimits') }), h('p', { class: 'hint', style: { margin: '-4px 4px 10px' }, text: t('opt.limitsDesc') }), limits),

    group(t('opt.groupAlways'), row({ title: t('opt.always'), desc: t('opt.alwaysDesc'), stack: true, control: domainEditor({ items: b.always, onAdd: addTo('always'), onRemove: removeFrom('always'), placeholder: 'example.com', empty: t('opt.alwaysEmpty') }) })),

    group(t('opt.groupFeed'),
      row({ title: t('opt.shortLimit'), desc: t('opt.shortLimitDesc'), control: toggle(feed.shortLimit, (v) => save((x) => { x.blocking.feed.shortLimit = v; }, true), t('opt.shortLimit')) }),
      feed.shortLimit ? row({ title: t('opt.shortMinutes'), control: select(mins([1, 3, 5, 10, 15]), feed.shortMinutes, (v) => save((x) => { x.blocking.feed.shortMinutes = Number(v); }), { label: t('opt.shortMinutes') }) }) : null,
      row({ title: t('opt.hideShorts'), desc: t('opt.hideShortsDesc'), control: toggle(feed.hideShorts, (v) => save((x) => { x.blocking.feed.hideShorts = v; }), t('opt.hideShorts')) }),
      row({ title: t('opt.hideRecs'), desc: t('opt.hideRecsDesc'), control: toggle(feed.hideRecs, (v) => save((x) => { x.blocking.feed.hideRecs = v; }), t('opt.hideRecs')) }),
      row({ title: t('opt.hideHome'), desc: t('opt.hideHomeDesc'), control: toggle(feed.hideHome, (v) => save((x) => { x.blocking.feed.hideHome = v; }), t('opt.hideHome')) }),
      row({ title: t('opt.hideComments'), control: toggle(feed.hideComments, (v) => save((x) => { x.blocking.feed.hideComments = v; }), t('opt.hideComments')) })));
}

/* ============================== Eye care ============================== */
export function eye({ s, save }) {
  const e = s.eye;
  return sec('eye', sectionHead(t('sec.eye'), t('sec.eyeDesc')),
    group(null,
      row({ title: t('opt.eyeEnabled'), desc: t('opt.eyeEnabledDesc'), control: toggle(e.enabled, (v) => save((x) => { x.eye.enabled = v; }, true), t('opt.eyeEnabled')) }),
      e.enabled ? [
        row({ title: t('opt.eyeInterval'), desc: t('opt.eyeIntervalDesc'), control: select(mins([15, 20, 30, 45, 60]), e.intervalMin, (v) => save((x) => { x.eye.intervalMin = Number(v); }), { label: t('opt.eyeInterval') }) }),
        row({ title: t('opt.eyeLength'), control: select([20, 30, 60].map((n) => [n, t('opt.seconds', { n })]), e.breakSeconds, (v) => save((x) => { x.eye.breakSeconds = Number(v); }), { label: t('opt.eyeLength') }) }),
        row({ title: t('opt.eyeNotify'), desc: t('opt.eyeNotifyDesc'), control: toggle(e.notify, (v) => save((x) => { x.eye.notify = v; }), t('opt.eyeNotify')) }),
        row({ title: t('opt.eyePreview'), control: h('button', { class: 'btn', type: 'button', onclick: () => send('break:open') }, icon('eye'), t('opt.eyePreviewBtn')) }),
      ] : null),
    group(t('opt.groupBedtime'),
      row({ title: t('opt.bedtime'), desc: t('opt.bedtimeDesc'), control: toggle(e.bedtime.enabled, (v) => save((x) => { x.eye.bedtime.enabled = v; }, true), t('opt.bedtime')) }),
      e.bedtime.enabled ? [
        row({ title: t('opt.bedtimeAt'), control: h('input', { class: 'input input-sm', type: 'time', value: e.bedtime.time, 'aria-label': t('opt.bedtimeAt'), onchange: (ev) => { if (ev.target.value) save((x) => { x.eye.bedtime.time = ev.target.value; }); } }) }),
        row({ title: t('opt.bedtimeLead'), control: select(mins([15, 30, 45, 60]), e.bedtime.leadMin, (v) => save((x) => { x.eye.bedtime.leadMin = Number(v); }), { label: t('opt.bedtimeLead') }) }),
      ] : null));
}

/* ============================== Tracking ============================== */
export function tracking({ s, save, refresh }) {
  const tr = s.tracking, comp = s.companion;
  const status = h('span', { class: 'badge', id: 'compStatus', text: '' });

  async function setCompanion(on) {
    if (on) {
      const ok = await chrome.permissions.request({ origins: ['http://127.0.0.1:8765/*'] }).catch(() => false);
      if (!ok) { toast(t('opt.compDenied')); refresh(); return; }
    }
    await save((x) => { x.companion.enabled = on; }, true);
  }
  const tokenIn = h('input', { class: 'input input-sm token', style: { width: '240px' }, placeholder: t('opt.compTokenPh'), value: comp.token, spellcheck: false, 'aria-label': t('opt.compToken'), onchange: (e) => save((x) => { x.companion.token = e.target.value.trim(); }, true) });

  return sec('tracking', sectionHead(t('sec.tracking'), t('sec.trackingDesc')),
    group(null,
      row({ title: t('opt.trackEnabled'), desc: t('opt.trackEnabledDesc'), control: toggle(tr.enabled, (v) => save((x) => { x.tracking.enabled = v; }, true), t('opt.trackEnabled')) }),
      row({ title: t('opt.idle'), desc: t('opt.idleDesc'), control: select([[30, t('opt.seconds', { n: 30 })], [60, t('opt.minutes', { n: 1 })], [120, t('opt.minutes', { n: 2 })], [300, t('opt.minutes', { n: 5 })]], tr.idleSeconds, (v) => save((x) => { x.tracking.idleSeconds = Number(v); }, true), { label: t('opt.idle') }) }),
      row({ title: t('opt.audible'), desc: t('opt.audibleDesc'), control: toggle(tr.countAudible, (v) => save((x) => { x.tracking.countAudible = v; }), t('opt.audible')) }),
      row({ title: t('opt.incognito'), desc: t('opt.incognitoDesc'), control: toggle(tr.incognito, (v) => save((x) => { x.tracking.incognito = v; }), t('opt.incognito')) })),
    group(t('opt.groupExcluded'), row({ title: t('opt.excluded'), desc: t('opt.excludedDesc'), stack: true, control: domainEditor({ items: tr.excluded, placeholder: 'example.com',
      onAdd: (d) => save((x) => { if (!x.tracking.excluded.includes(d)) x.tracking.excluded.push(d); }, true), onRemove: (d) => save((x) => { x.tracking.excluded = x.tracking.excluded.filter((v) => v !== d); }, true) }) })),
    group(t('opt.groupCompanion'),
      row({ title: t('opt.comp'), desc: t('opt.compDesc'), control: h('div', { class: 'row gap-3' }, comp.enabled ? status : null, toggle(comp.enabled, setCompanion, t('opt.comp'))) }),
      comp.enabled ? row({ title: t('opt.compToken'), desc: t('opt.compTokenDesc'), control: tokenIn }) : null,
      row({ title: t('opt.compHow'), desc: t('opt.compHowDesc'), control: h('a', { class: 'btn', href: 'https://github.com/maxbzd/eyetime/tree/main/companion', target: '_blank', rel: 'noopener' }, icon('external-link'), t('opt.compDocs')) })));
}

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
  async function paintCal() {
    const [events, meta] = await Promise.all([getRaw('calendar'), getRaw('calendarMeta')]);
    const list = (events.calendar || []).filter((e) => e.day >= dayKey());
    calStatus.textContent = list.length && meta.calendarMeta ? t('opt.calendarStatus', { n: list.length, date: new Date(meta.calendarMeta.at).toLocaleDateString() }) : t('opt.calendarNone');
  }
  calFile.onchange = async () => {
    const f = calFile.files[0]; calFile.value = ''; if (!f) return;
    const text = await f.text();
    if (!/BEGIN:VCALENDAR/i.test(text)) { toast(t('opt.calendarBad')); return; }
    const events = parseIcs(text, { from: new Date(), days: 14 });
    await setRaw({ calendar: events, calendarMeta: { at: Date.now(), name: String(f.name).slice(0, 60) } });
    toast(events.length ? t('opt.calendarDone', { n: events.length }) : t('opt.calendarEmpty')); paintCal();
  };
  paintCal();
  const calendarGroup = group(t('opt.groupCalendar'), (() => { const r = row({ title: t('opt.calendar'), desc: t('opt.calendarDesc'), control: h('div', { class: 'row gap-2' }, h('button', { class: 'btn', type: 'button', onclick: () => calFile.click() }, icon('upload'), t('opt.calendarBtn')), h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: async () => { await chrome.storage.local.remove(['calendar', 'calendarMeta']); paintCal(); } }, t('opt.calendarClear')), calFile) }); r.querySelector('.setting-text').append(calStatus); return r; })());

  return sec('data', sectionHead(t('sec.data'), t('sec.dataDesc')),
    calendarGroup,
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

/* ============================== About ============================== */
/** The real binding (the user may have changed it on chrome://extensions/shortcuts); falls back to the default. */
function shortcutKeys(name, fallback) {
  const el = h('span', { class: 'shortcut' }, fallback.map((k) => h('span', { class: 'kbd', text: k })));
  chrome.commands?.getAll?.().then((all) => {
    const c = all.find((x) => x.name === name);
    const keys = c && c.shortcut ? c.shortcut.split(/[+]/).filter(Boolean) : null;
    if (c && !c.shortcut) clear(el, h('span', { class: 'muted', text: t('about.scNone') }));
    else if (keys) clear(el, keys.map((k) => h('span', { class: 'kbd', text: k })));
  }).catch(() => {});
  return el;
}

/** "Report a problem": builds the diagnostic text, shows it, lets the person copy it or open a prefilled GitHub issue. */
async function openReport(s) {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all);
  const info = { version: chrome.runtime.getManifest().version, userAgent: navigator.userAgent, platform: navigator.platform, language: navigator.language, settings: s,
    counts: { days: keys.filter((k) => k.startsWith('d:')).length, tasks: (all.tasks || []).length, notes: (all.captures || []).length, habits: (all.habits || []).length },
    bytes: await chrome.storage.local.getBytesInUse(null), sync: !!all.syncSettings, errors: await readErrors() };
  const report = buildReport(info);
  const area = h('textarea', { class: 'input token', rows: 14, readonly: true, spellcheck: false, 'aria-label': t('opt.reportPreview'), style: { width: '100%', resize: 'vertical' }, value: report });
  const dlg = h('dialog', { class: 'dialog' }, h('div', { class: 'dialog-body stack gap-3' }, h('h3', { text: t('opt.reportPreview') }), h('p', { class: 'muted-2', text: t('opt.reportNote') }), area),
    h('div', { class: 'dialog-actions' },
      h('button', { class: 'btn btn-ghost', type: 'button', onclick: async () => { await clearErrors(); dlg.close(); toast(t('opt.reportClear')); } }, t('opt.reportClear')),
      h('button', { class: 'btn', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(report); toast(t('opt.reportCopied')); } catch { area.select(); } } }, icon('copy'), t('opt.reportCopy')),
      h('a', { class: 'btn btn-primary', href: issueUrl(report), target: '_blank', rel: 'noopener', onclick: () => navigator.clipboard?.writeText(report).catch(() => {}) }, icon('arrow-up-right'), t('opt.reportOpen'))));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg); dlg.showModal();
}

export function about({ s }) {
  const v = chrome.runtime.getManifest().version;
  const link = (href, ico, label) => h('a', { class: 'btn', href, target: '_blank', rel: 'noopener' }, ico, label);
  return sec('about', sectionHead(t('sec.about')),
    h('div', { class: 'card' },
      h('div', { class: 'about-logo' }, h('img', { src: '../../icons/logo.svg', alt: '' }), h('div', {}, h('h3', { text: 'EyeTime' }), h('div', { class: 'muted', text: t('about.version', { v }) }), h('div', { class: 'muted', text: t('about.tagline') }))),
      h('div', { class: 'row gap-2 wrap', style: { padding: '0 var(--s-5) var(--s-5)' } },
        link('https://github.com/maxbzd/eyetime', icon('code-xml'), t('about.source')),
        link('https://github.com/maxbzd/eyetime/blob/main/CHANGELOG.md', icon('sparkles'), t('about.whatsNew')),
        link('https://github.com/maxbzd/eyetime/issues/new/choose', icon('bug'), t('about.report')),
        link('https://github.com/maxbzd/eyetime/blob/main/PRIVACY.md', icon('shield-check'), t('about.privacy')))),
    group(t('opt.groupSupport'),
      row({ title: t('opt.reportTitle'), desc: t('opt.reportDesc'), control: h('button', { class: 'btn', type: 'button', onclick: () => openReport(s) }, icon('bug'), t('opt.reportBtn')) })),
    group(t('about.shortcuts'),
      row({ title: t('about.scFocus'), control: shortcutKeys('toggle-focus', ['Alt', 'Shift', 'F']) }),
      row({ title: t('about.scPopup'), control: shortcutKeys('_execute_action', ['Alt', 'Shift', 'E']) }),
      row({ title: t('about.scChange'), control: h('button', { class: 'btn', type: 'button', onclick: () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }) }, icon('keyboard'), t('about.scBtn')) })));
}
