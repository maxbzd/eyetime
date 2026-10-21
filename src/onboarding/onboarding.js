import { bootPage } from '../ui/page.js';
import { $, h, icon, clear } from '../ui/dom.js';
import { send } from '../ui/api.js';
import { t, LANGUAGES, fmtDuration } from '../shared/i18n.js';
import { updateSettings } from '../shared/storage.js';
import { PRESETS, PRESET_IDS } from '../shared/catalog.js';
import { parseUserDomain } from '../shared/domains.js';
import { looksGallery, accentPicker } from '../ui/appearance.js';

const STEPS = ['welcome', 'distractions', 'rhythm', 'look', 'ready'];
let step = 0, s;
const pick = { presets: {}, custom: [], minutes: 25, goal: 120, eye: true, friction: true, schedule: false, start: '09:00', end: '18:00' };

function dots() { clear($('#dots'), STEPS.map((_, i) => h('li', { class: i === step ? 'on' : i < step ? 'done' : '' }))); }

function sw(checked, onChange, label) {
  return h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked, 'aria-label': label, onchange: (e) => onChange(e.target.checked) }), h('span', { class: 'track' }), h('span', { class: 'thumb' }));
}

async function finish(startFocus) {
  await updateSettings((x) => {
    x.onboarded = true;
    for (const id of PRESET_IDS) x.blocking.presets[id] = !!pick.presets[id];
    x.blocking.custom = [...new Set([...x.blocking.custom, ...pick.custom])];
    x.focus.minutes = pick.minutes; x.focus.dailyGoal = pick.goal;
    x.eye.enabled = pick.eye; x.eye.notify = pick.eye;
    x.blocking.friction.enabled = pick.friction;
    x.blocking.schedule.enabled = pick.schedule; x.blocking.schedule.start = pick.start; x.blocking.schedule.end = pick.end;
  });
  await send('settings:changed');
  if (startFocus) await send('focus:start', { minutes: pick.minutes, goal: '', strict: false });
  location.href = chrome.runtime.getURL('src/newtab/newtab.html');
}

const views = {
  welcome: () => h('div', { class: 'step' },
    h('img', { class: 'hero-mark', src: '../../icons/logo.svg', alt: '' }),
    h('h1', { text: t('ob.welcomeTitle') }), h('p', { class: 'lead', text: t('ob.welcomeLead') }),
    h('div', { class: 'points' },
      [['target', 'ob.p1', 'ob.p1d'], ['chart-column', 'ob.p2', 'ob.p2d'], ['eye', 'ob.p3', 'ob.p3d'], ['shield-check', 'ob.p4', 'ob.p4d']].map(([ico, a, b]) => h('div', { class: 'point' }, h('div', { class: 'ic' }, icon(ico)), h('div', {}, h('b', { text: t(a) }), h('span', { text: t(b) }))))),
    h('div', { class: 'nav' }, h('span'), h('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: next }, t('ob.start'), icon('arrow-right')))),

  distractions: () => {
    const err = h('div', { class: 'hint', style: { color: 'var(--distracting-text)' } });
    const custom = h('div', { class: 'chips' });
    const drawCustom = () => clear(custom, pick.custom.map((d) => h('span', { class: 'chip chip-x' }, h('span', { class: 'chip-t', text: d }), h('button', { type: 'button', 'aria-label': t('common.remove') + ' ' + d, onclick: () => { pick.custom = pick.custom.filter((x) => x !== d); drawCustom(); } }, icon('x')))));
    drawCustom();
    const addDomain = () => {
      const d = parseUserDomain(input.value);
      if (!input.value.trim()) return;
      if (!d) { err.textContent = t('domains.invalid', { v: input.value }); return; }
      err.textContent = ''; if (!pick.custom.includes(d)) pick.custom.push(d); input.value = ''; drawCustom();
    };
    const input = h('input', { class: 'input', placeholder: t('ob.customPh'), 'aria-label': t('ob.customPh'), spellcheck: false, onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); addDomain(); } } });
    return h('div', { class: 'step' },
      h('h1', { text: t('ob.distTitle') }), h('p', { class: 'lead', text: t('ob.distLead') }),
      h('div', { class: 'chips' }, PRESET_IDS.map((id) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(!!pick.presets[id]), onclick: (e) => { pick.presets[id] = !pick.presets[id]; e.currentTarget.setAttribute('aria-pressed', String(pick.presets[id])); } }, icon(PRESETS[id].icon), t('preset.' + id)))),
      h('div', { class: 'stack gap-2' }, h('div', { class: 'row gap-2' }, input, h('button', { class: 'btn', type: 'button', onclick: addDomain }, icon('plus'), t('ob.add'))), err, custom),
      nav());
  },

  rhythm: () => {
    const time = (key) => h('input', { class: 'input input-sm', type: 'time', value: pick[key], 'aria-label': t(key === 'start' ? 'ob.from' : 'ob.to'), onchange: (e) => { if (e.target.value) pick[key] = e.target.value; } });
    const hours = h('div', { class: 'opt hours', hidden: !pick.schedule }, h('span', { class: 'muted', text: t('ob.from') }), time('start'), h('span', { class: 'muted', text: t('ob.to') }), time('end'));
    return h('div', { class: 'step' },
    h('h1', { text: t('ob.rhythmTitle') }), h('p', { class: 'lead', text: t('ob.rhythmLead') }),
    h('div', {},
      h('div', { class: 'opt' }, h('div', {}, h('b', { text: t('ob.focusLen') }), h('span', { class: 'd', text: t('ob.focusLenD') })),
        h('div', { class: 'segmented', role: 'group', 'aria-label': t('ob.focusLen') }, [15, 25, 50, 90].map((m) => h('button', { type: 'button', 'aria-pressed': String(pick.minutes === m), text: fmtDuration(m * 60), onclick: (e) => { pick.minutes = m; e.currentTarget.parentNode.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); } })))),
      h('div', { class: 'opt' }, h('div', {}, h('b', { text: t('ob.goal') }), h('span', { class: 'd', text: t('ob.goalD') })),
        h('div', { class: 'segmented', role: 'group', 'aria-label': t('ob.goal') }, [[0, t('common.off')], [60, fmtDuration(3600)], [120, fmtDuration(7200)], [180, fmtDuration(10800)]].map(([m, label]) => h('button', { type: 'button', 'aria-pressed': String(pick.goal === m), text: label, onclick: (e) => { pick.goal = m; e.currentTarget.parentNode.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); } })))),
      h('div', { class: 'opt' }, h('div', {}, h('b', { text: t('ob.friction') }), h('span', { class: 'd', text: t('ob.frictionD') })), sw(pick.friction, (v) => { pick.friction = v; }, t('ob.friction'))),
      h('div', { class: 'opt' }, h('div', {}, h('b', { text: t('ob.eye') }), h('span', { class: 'd', text: t('ob.eyeD') })), sw(pick.eye, (v) => { pick.eye = v; }, t('ob.eye'))),
      h('div', { class: 'opt' }, h('div', {}, h('b', { text: t('ob.schedule') }), h('span', { class: 'd', text: t('ob.scheduleD') })), sw(pick.schedule, (v) => { pick.schedule = v; hours.hidden = !v; }, t('ob.schedule'))),
      hours),
    nav());
  },

  look: () => {
    const ap = s.appearance;
    const set = (fn) => updateSettings((x) => { fn(x.appearance); });
    return h('div', { class: 'step step-look' },
      h('h1', { text: t('ob.lookTitle') }), h('p', { class: 'lead', text: t('ob.lookLead') }),
      h('div', { class: 'looks ob-looks' }, [...looksGallery(ap, { compact: true, onPick: (id) => set((a) => { a.look = id; }) }).children]),
      h('div', { class: 'opt' }, h('b', { text: t('opt.theme') }),
        h('div', { class: 'segmented', role: 'group', 'aria-label': t('opt.theme') }, [['system', t('opt.themeSystem')], ['light', t('opt.themeLight')], ['dark', t('opt.themeDark')]].map(([v, label]) => h('button', { type: 'button', 'aria-pressed': String(ap.mode === v), text: label, onclick: () => set((a) => { a.mode = v; }) })))),
      h('div', { class: 'opt' }, h('b', { text: t('opt.accent') }), accentPicker(ap, (v) => set((a) => { a.accent = v; }))),
      nav());
  },

  ready: () => h('div', { class: 'step' },
    h('h1', { text: t('ob.readyTitle') }), h('p', { class: 'lead', text: t('ob.readyLead') }),
    h('div', { class: 'pin' }, icon('puzzle'), h('span', { text: t('ob.pin') })),
    h('div', { class: 'done-actions' },
      h('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: () => finish(true) }, icon('play'), t('ob.startFirst', { time: fmtDuration(pick.minutes * 60) })),
      h('button', { class: 'btn btn-lg', type: 'button', onclick: () => finish(false) }, t('ob.explore'))),
    h('div', { class: 'nav' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: back }, icon('arrow-left'), t('common.back')), h('span'))),
};

function nav() {
  return h('div', { class: 'nav' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: back }, icon('arrow-left'), t('common.back')), h('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: next }, t('common.next'), icon('arrow-right')));
}
function next() { step = Math.min(STEPS.length - 1, step + 1); render(); }
function back() { step = Math.max(0, step - 1); render(); }
function render() { dots(); $('#card').classList.toggle('wide', STEPS[step] === 'look'); clear($('#card'), views[STEPS[step]]()); $('#card').scrollIntoView({ block: 'nearest' }); $('#skip').hidden = step === STEPS.length - 1; }

function drawLang() {
  const sel = h('select', { class: 'select select-auto', 'aria-label': t('opt.language'), onchange: async (e) => { await updateSettings((x) => { x.language = e.target.value; }); } },
    Object.entries(LANGUAGES).map(([code, name]) => h('option', { value: code, text: name, selected: document.documentElement.lang === code })));
  clear($('#lang'), sel);
}

(async function main() {
  s = await bootPage({ onSettings: (x) => { s = x; drawLang(); render(); } });
  for (const id of PRESET_IDS) pick.presets[id] = !!s.blocking.presets[id];
  pick.minutes = s.focus.minutes;
  drawLang(); render();
  $('#skip').addEventListener('click', () => finish(false));
})();
