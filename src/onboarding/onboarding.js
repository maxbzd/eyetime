// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The first minutes, in three light screens (the design record and the reasons are in docs/ONBOARDING.md):
//   1 Hello          one promise, a few marks, and the fine print that matters: how long it takes, and that EyeTime is the new tab.
//   2 What pulls you away?   chips of kinds of sites (nothing is pre-selected), and as soon as one is chosen, a live preview of how a pause looks.
//   3 Your first focus       what will you work on, 5 / 10 / 25 minutes, one big button: the first session starts on the real new tab.
// Everything else the old flow asked (look, theme, daily goal, eye breaks, work hours) is applied with sensible defaults and asked after the first session, on the page itself
// (newtab/home/first-session.js), where the person can see what they are choosing. Nothing here asks for an account, a permission or a notification, and every screen can be skipped.

import { patchObFirst } from '../shared/first-session-state.js';
import { dropdown } from '../ui/dropdown.js';
import { bootPage } from '../ui/page.js';
import { $, h, icon, clear, isEnter } from '../ui/dom.js';
import { send } from '../ui/api.js';
import { t, LANGUAGES, fmtDuration } from '../shared/i18n.js';
import { updateSettings, setRaw } from '../shared/storage.js';
import { track, getUsage } from '../shared/usage-store.js';
import { PRESETS, PRESET_IDS } from '../shared/catalog.js';
import { parseUserDomain } from '../shared/domains.js';

const STEPS = ['hello', 'distractions', 'first'];
let step = 0;
const pick = { presets: /** @type {Record<string, boolean>} */ ({}), custom: /** @type {string[]} */ ([]), minutes: 5, goal: '' };

/** The sites the person named: kinds first (their domains), then their own. The first of them is the one the previews and the first session talk about. */
export const chosenHosts = (/** @type {{ presets: Record<string, boolean>, custom: string[] }} */ p) => [...new Set([...p.custom, ...PRESET_IDS.filter((id) => p.presets[id]).map((id) => PRESETS[id].domains[0] === 'youtu.be' ? 'youtube.com' : PRESETS[id].domains[0])])];

/** Every domain the first session will hold back: the kinds' whole lists and the person's own (a count of kinds says "2" for what is really dozens of sites). */
export const closedDomains = (/** @type {{ presets: Record<string, boolean>, custom: string[] }} */ p) => [...new Set([...p.custom, ...PRESET_IDS.filter((id) => p.presets[id]).flatMap((id) => PRESETS[id].domains)])];

function progress() {
  clear($('#dots'), STEPS.map((_, i) => h('li', { class: i === step ? 'on' : i < step ? 'done' : '' })));
  $('#stepLabel').textContent = t('ob.v2.step', { a: step + 1, b: STEPS.length });
}

async function finish(startFirst) {
  const hosts = PRESET_IDS.filter((id) => pick.presets[id]).length + pick.custom.length;
  await updateSettings((x) => {
    x.onboarded = true;
    if (step > 0 || hosts) for (const id of PRESET_IDS) x.blocking.presets[id] = !!pick.presets[id]; // someone who skipped at once keeps the starting set; someone who chose gets exactly their choice
    x.blocking.custom = [...new Set([...x.blocking.custom, ...pick.custom])];
  });
  await track('onboarding_done');
  await send('settings:changed');
  if (startFirst) {
    const [host] = chosenHosts(pick), usage = await getUsage();
    const obFirst = { at: Date.now(), minutes: pick.minutes, sites: closedDomains(pick).length, host: host || '', blocks0: usage.total.block_page || 0, stage: 'run', sid: '' };
    await setRaw({ obFirst });
    const started = await send('focus:start', { minutes: pick.minutes, goal: pick.goal.trim().slice(0, 120), strict: false, remember: false }); // the first session of five minutes is not the person's choice of a usual length
    if (started && typeof started.id === 'string') await patchObFirst({ sid: started.id }); // which session it is: a second one must not be taken for it
  }
  location.href = chrome.runtime.getURL('src/newtab/newtab.html');
}

/** What a pause looks like, from the real strings of the real pause page (blocked.html), for the first site chosen. It breathes. */
function pausePreview(host) {
  return h('div', { class: 'prev', role: 'img', 'aria-label': t('ob.v2.prevT', { host }) },
    h('div', { class: 'prev-card', 'aria-hidden': 'true' },
      h('div', { class: 'prev-site' }, h('span', { class: 'prev-dot' }), host),
      h('div', { class: 'prev-breath' }, h('i')),
      h('div', { class: 'prev-t', text: t('block.pause.title') }),
      h('div', { class: 'prev-l', text: t('block.pause.lead', { host }) }),
      h('div', { class: 'prev-b' }, h('span', { class: 'p', text: t('block.back') }), h('span', { class: 'q', text: t('block.continue') }))),
    h('p', { class: 'prev-note', text: t('ob.v2.prevT', { host }) }));
}

const views = {
  hello: () => h('div', { class: 'step step-hello' },
    h('img', { class: 'hero-mark', src: '../../icons/logo.svg', alt: '' }),
    h('h1', { text: t('ob.welcomeTitle') }), h('p', { class: 'lead', text: t('ob.welcomeLead') }),
    h('ul', { class: 'marks' }, [['target', 'ob.p1'], ['eye', 'ob.p3'], ['chart-column', 'ob.p2'], ['shield-check', 'ob.p4']].map(([ico, k]) => h('li', null, h('span', { class: 'mk', 'aria-hidden': 'true' }, icon(ico)), t(k)))),
    h('div', { class: 'nav nav-hello' },
      h('div', { class: 'fine' }, h('p', { text: t('ob.v2.time') }), h('p', { text: t('ob.v2.newtab') })),
      h('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: next }, t('ob.start'), icon('arrow-right')))),

  distractions: () => {
    const err = h('div', { class: 'hint', style: { color: 'var(--distracting-text)' } });
    const custom = h('div', { class: 'chips' });
    const prev = h('div', { class: 'prev-slot', 'aria-live': 'polite' });
    const drawPrev = () => { const [host, ...more] = chosenHosts(pick); clear(prev, host ? pausePreview(host) : h('p', { class: 'prev-none', text: t('ob.v2.prevNone') }), host && more.length ? h('p', { class: 'prev-also', text: t('ob.v2.prevAlso', { sites: more.slice(0, 4).join(', ') }) }) : null); }; // the preview shows one site: the line under it names the others, so "Social" and a closed reddit.com do not look like a fault
    const drawCustom = () => { clear(custom, pick.custom.map((d) => h('span', { class: 'chip chip-x' }, h('span', { class: 'chip-t', text: d }), h('button', { type: 'button', 'aria-label': t('common.remove') + ' ' + d, onclick: () => { pick.custom = pick.custom.filter((x) => x !== d); drawCustom(); } }, icon('x'))))); drawPrev(); };
    const addDomain = () => {
      const d = parseUserDomain(input.value);
      if (!input.value.trim()) return;
      if (!d) { err.textContent = t('domains.invalid', { v: input.value }); return; }
      err.textContent = ''; if (!pick.custom.includes(d)) pick.custom.push(d); input.value = ''; drawCustom();
    };
    const input = h('input', { class: 'input', placeholder: t('ob.customPh'), 'aria-label': t('ob.customPh'), spellcheck: false, onkeydown: (e) => { if (isEnter(e)) { e.preventDefault(); addDomain(); } } });
    drawCustom();
    return h('div', { class: 'step step-dist' },
      h('h1', { text: t('ob.distTitle') }), h('p', { class: 'lead', text: t('ob.distLead') }),
      h('div', { class: 'dist-l' },
        h('div', { class: 'chips' }, PRESET_IDS.map((id) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(!!pick.presets[id]), onclick: (e) => { pick.presets[id] = !pick.presets[id]; e.currentTarget.setAttribute('aria-pressed', String(pick.presets[id])); drawPrev(); } }, icon(PRESETS[id].icon), t('preset.' + id)))),
        h('div', { class: 'stack gap-2' }, h('div', { class: 'row gap-2' }, input, h('button', { class: 'btn', type: 'button', onclick: addDomain }, icon('plus'), t('ob.add'))), err, custom)),
      prev,
      h('div', { class: 'nav' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: back }, icon('arrow-left'), t('common.back')),
        h('div', { class: 'nav-r' }, h('button', { class: 'link', type: 'button', onclick: () => { pick.presets = {}; pick.custom = []; next(); } }, t('ob.v2.none')), h('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: next }, t('common.next'), icon('arrow-right')))));
  },

  first: () => {
    const goal = h('input', { class: 'input input-lg', type: 'text', maxlength: '120', value: pick.goal, placeholder: t('ob.v2.goalPh'), 'aria-label': t('ob.v2.goalQ'), spellcheck: false, oninput: (e) => { pick.goal = e.target.value; }, onkeydown: (e) => { if (isEnter(e)) { e.preventDefault(); finish(true); } } });
    const start = h('button', { class: 'btn btn-primary btn-lg go', type: 'button', onclick: () => finish(true) }, icon('play'), t('ob.startFirst', { time: fmtDuration(pick.minutes * 60) }));
    const mins = h('div', { class: 'segmented', role: 'group', 'aria-label': t('ob.focusLen') }, [5, 10, 25].map((m) => h('button', { type: 'button', 'aria-pressed': String(pick.minutes === m), text: fmtDuration(m * 60), onclick: (e) => { pick.minutes = m; e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); start.lastChild.textContent = t('ob.startFirst', { time: fmtDuration(m * 60) }); } })));
    return h('div', { class: 'step' },
      h('h1', { text: t('ob.v2.firstTitle') }), h('p', { class: 'lead', text: t(chosenHosts(pick).length ? 'ob.v2.firstLead' : 'ob.v2.firstLeadNone') }), // nothing chosen: nothing is promised
      h('div', { class: 'field' }, h('label', { class: 'q', for: 'goalIn', text: t('ob.v2.goalQ') }), Object.assign(goal, { id: 'goalIn' }),
        h('div', { class: 'chips sugg' }, [['ob.v2.g1', 'pencil'], ['ob.v2.g2', 'book-open'], ['ob.v2.g3', 'list-checks']].map(([k, ico]) => h('button', { class: 'chip', type: 'button', onclick: () => { pick.goal = t(k); goal.value = pick.goal; goal.focus(); } }, icon(ico), t(k))))),
      h('div', { class: 'opt' }, h('div', {}, h('b', { text: t('ob.focusLen') }), h('span', { class: 'd', text: t('ob.v2.lenD') })), mins),
      h('div', { class: 'done-actions' }, start),
      h('div', { class: 'pin' }, icon('puzzle'), h('span', { text: t('ob.pin') })),
      h('div', { class: 'nav' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: back }, icon('arrow-left'), t('common.back')), h('button', { class: 'link', type: 'button', onclick: () => finish(false) }, t('ob.v2.look'))));
  },
};

function next() { step = Math.min(STEPS.length - 1, step + 1); render(); }
function back() { step = Math.max(0, step - 1); render(); }
function render() {
  progress();
  $('#card').classList.toggle('wide', STEPS[step] === 'distractions');
  clear($('#card'), views[STEPS[step]]());
  $('#card').scrollIntoView({ block: 'nearest' });
  $('#skip').hidden = step === STEPS.length - 1;
  $('#skip').textContent = t(step === 0 ? 'ob.skip' : 'ob.v2.saveExit'); // on the first screen it skips; later it keeps what was chosen so far, and says so
  const focusEl = $('#card').querySelector('h1'); if (focusEl) { focusEl.tabIndex = -1; if (step > 0) focusEl.focus({ preventScroll: true }); }
}

function drawLang() {
  const sel = dropdown(Object.entries(LANGUAGES), document.documentElement.lang, async (v) => { await updateSettings((x) => { x.language = v; }); }, { label: t('opt.language'), cls: 'select-auto' });
  clear($('#lang'), sel);
}

(async function main() {
  await bootPage({ onSettings: () => { drawLang(); render(); } });
  drawLang(); render();
  $('#skip').addEventListener('click', () => finish(false));
})();
