// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The guided set-up: the long way through what EyeTime can do, for the person who wants it (docs/ONBOARDING.md, "Finding the rest"). Six short steps, each with the real controls
// (a change is applied at once, on the page behind), each skippable. It is offered after the first session, in the command palette, and by a quiet tip; it is never forced and it
// never asks for a permission itself: what needs one is a link into Settings, where the browser asks in its own words.

import { h, icon, clear, openModal, retire } from '../../ui/dom.js';
import { t, fmtDuration } from '../../shared/i18n.js';
import { getSettings, updateSettings } from '../../shared/storage.js';
import { send } from '../../ui/api.js';
import { track } from '../../shared/usage-store.js';
import { seg, sw } from './opts.js';
import { openDrawer, openEditor } from './drawer.js';

export const TOUR_STEPS = ['day', 'limits', 'rhythm', 'home', 'night', 'tools'];
const settingsUrl = (/** @type {string} */ section) => chrome.runtime.getURL('src/options/options.html#' + section);

/** Change a setting, and tell the rest of the extension (the worker reads blocking and break settings from storage on a message). */
const set = async (/** @type {(x: any) => void} */ fn) => { await updateSettings(fn); send('settings:changed'); };

/** A row that goes somewhere: for what needs a permission, which Settings asks for in its own place. */
const go = (/** @type {any} */ ico, /** @type {string} */ title, /** @type {string} */ desc, /** @type {string} */ href) =>
  h('a', { class: 'opt tour-go', href, target: '_blank', rel: 'noopener' }, h('span', { class: 'tour-go-ico', 'aria-hidden': 'true' }, ico), h('div', {}, h('b', { text: title }), h('span', { class: 'd', text: desc })), h('span', { class: 'tour-go-arrow', 'aria-hidden': 'true' }, icon('arrow-up-right')));

const action = (/** @type {string} */ ico, /** @type {string} */ label, /** @type {() => void} */ run) =>
  h('div', { class: 'opt' }, h('button', { class: 'btn', type: 'button', onclick: run }, icon(ico), label));

/**
 * The controls of one step. `redraw` repaints the step (a control that shows or hides another one); `leave` closes the tour before something opens on the page.
 * @type {Record<string, (s: any, redraw: () => void, leave: () => void) => any[]>}
 */
const BODY = {
  day: (s) => [
    sw(t('tour.ritual'), t('tour.ritualD'), !!s.ritual.on, (v) => set((x) => { x.ritual.on = v; })),
    seg(t('tour.layout'), [['today', t('tour.layoutToday')], ['center', t('tour.layoutCenter')], ['split', t('tour.layoutSplit')], ['minimal', t('tour.layoutMinimal')]], s.newtab.layout, (v) => set((x) => { x.newtab.layout = v; })),
  ],
  limits: (s, redraw) => [
    sw(t('tour.budget'), t('tour.budgetD'), !!s.blocking.budget.enabled, async (v) => { await set((x) => { x.blocking.budget.enabled = v; }); redraw(); }),
    s.blocking.budget.enabled ? seg(t('tour.budgetMin'), [15, 30, 60].map((m) => [m, fmtDuration(m * 60)]), s.blocking.budget.minutes, (v) => set((x) => { x.blocking.budget.minutes = v; })) : null,
    go(icon('shield'), t('tour.limitsMore'), t('tour.limitsMoreD'), settingsUrl('blocking')),
  ],
  rhythm: (s) => [
    seg(t('tour.break'), [[0, t('common.off')], [5, fmtDuration(300)], [10, fmtDuration(600)]], s.focus.breakMinutes, (v) => set((x) => { x.focus.breakMinutes = v; })),
    seg(t('tour.sound'), [['off', t('common.off')], ['brown', t('wg.sound.brown')], ['rain', t('wg.sound.rain')]], s.focus.ambient, (v) => set((x) => { x.focus.ambient = v; })),
  ],
  home: (_s, _r, leave) => [
    action('layout-grid', t('tour.addWidgets'), () => { leave(); openEditor(); }),
    action('palette', t('tour.looks'), () => { leave(); openDrawer(); }),
  ],
  night: (s, redraw, leave) => [
    sw(t('sb.title'), t('tour.nightD'), !!s.standby.on, async (v) => { await set((x) => { x.standby.on = v; }); redraw(); }),
    s.standby.on ? seg(t('sb.after'), [5, 10, 30].map((m) => [m, fmtDuration(m * 60)]), s.standby.after, (v) => set((x) => { x.standby.after = v; })) : null,
    sw(t('tour.bedtime'), t('tour.bedtimeD'), !!s.eye.bedtime.enabled, (v) => set((x) => { x.eye.bedtime.enabled = v; })),
    action('moon', t('sb.now'), () => { leave(); window.dispatchEvent(new window.CustomEvent('et:standby')); }),
  ],
  tools: (_s, _r, leave) => [
    go(icon('list-checks'), t('tour.toolsTasks'), t('tour.toolsTasksD'), settingsUrl('data')),
    go(icon('panel-right'), t('tour.toolsDock'), t('tour.toolsDockD'), settingsUrl('general')),
    go(icon('zap'), t('tour.toolsInstant'), t('tour.toolsInstantD'), settingsUrl('blocking')),
    h('div', { class: 'opt' }, h('div', {}, h('b', { text: t('tour.toolsKeys') }), h('span', { class: 'd', text: t('tour.toolsKeysD') })),
      h('button', { class: 'btn', type: 'button', onclick: () => { leave(); window.dispatchEvent(new window.CustomEvent('et:palette')); } }, icon('command'), t('tour.try'))),
  ],
};

/** Open the guided set-up, at a step (a tip opens it at its own). */
export async function openTour(/** @type {{ at?: string }} */ { at = 'day' } = {}) {
  if (document.getElementById('tour')) return;
  track('tour_open'); // a count only, and only if the person shares anonymous numbers
  let i = Math.max(0, TOUR_STEPS.indexOf(at));
  const dots = h('div', { class: 'tour-dots', 'aria-hidden': 'true' }, TOUR_STEPS.map(() => h('span', { class: 'tour-dot' })));
  const count = h('span', { class: 'tour-count' }), title = h('h2', { id: 'tourT', class: 'fs-title tour-title' }), lead = h('p', { class: 'fs-lead' }), body = h('div', { class: 'tour-body' });
  const back = h('button', { class: 'btn btn-lg', type: 'button', onclick: () => { i--; draw(); } }, icon('arrow-left'), t('tour.back'));
  const next = h('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: () => { if (i >= TOUR_STEPS.length - 1) dlg.close(); else { i++; draw(); } } });
  const dlg = h('dialog', { id: 'tour', class: 'dialog dialog-wide fs-done tour', 'aria-labelledby': 'tourT' },
    h('div', { class: 'dialog-body' }, h('div', { class: 'tour-head' }, dots, count), title, lead, body),
    h('div', { class: 'dialog-actions' }, back, next));
  dlg.addEventListener('close', () => retire(dlg));
  async function draw() {
    const id = TOUR_STEPS[i], s = await getSettings();
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k <= i));
    count.textContent = t('tour.step', { n: i + 1, m: TOUR_STEPS.length });
    title.textContent = t('tour.' + id + '.t'); lead.textContent = t('tour.' + id + '.d');
    clear(body, ...BODY[id](s, draw, () => dlg.close()).filter(Boolean));
    back.hidden = i === 0;
    clear(next, ...(i >= TOUR_STEPS.length - 1 ? [t('tour.done')] : [t('tour.next'), icon('arrow-right')]));
  }
  await draw();
  document.body.append(dlg); openModal(dlg);
}
