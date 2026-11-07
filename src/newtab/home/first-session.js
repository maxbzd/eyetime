// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// What happens on the new tab after the three onboarding screens (the reasons are in docs/ONBOARDING.md):
//   - while the first session runs: a small card says what is held back and offers to look at a closed site (the one moment a person wants to see the product work);
//   - when it has finished: one dialog, once: "First focus done", the real number of times a site was held back, and then the choices that are better made now than before the person saw
//     anything: look and theme (applied live on the page behind the dialog), daily goal, eye breaks, work hours.
// The state is `obFirst` (set by onboarding when it starts the first session): stage run → done → closed. A session stopped early closes it without a word: no guilt, no celebration for nothing.

import { h, icon } from '../../ui/dom.js';
import { t, fmtDuration } from '../../shared/i18n.js';
import { getRaw, setRaw, getDays, getSettings, updateSettings, onChange } from '../../shared/storage.js';
import { getUsage } from '../../shared/usage-store.js';
import { isFocusLive } from '../../shared/blocking.js';
import { looksGallery } from '../../ui/appearance.js';
import { send } from '../../ui/api.js';
import { rangeKeys } from '../../shared/time.js';
import { seg, sw } from './opts.js';
import { openTour } from './tour.js';

const COACH = 'fsCoach', DONE = 'fsDone';
const GRACE_MS = 60_000; // the worker needs a moment to start the session the onboarding asked for

/** The first completed session that began at or after `since` (a few seconds before, for the worker taking its time), or null. Pure over day records: easy to test. */
export function sessionSince(/** @type {[string, any][]} */ days, /** @type {number} */ since) {
  let best = null;
  for (const [, d] of days) for (const x of (d && d.ss) || []) if (x && x.c && x.t >= since - 5_000 && (!best || x.t < best.t)) best = x;
  return best;
}

const remove = (/** @type {string} */ id) => { const el = document.getElementById(id); if (el) el.remove(); };

function coach(/** @type {any} */ o) {
  if (document.getElementById(COACH) || o.coachSeen) return;
  const close = async () => { const { obFirst } = await getRaw('obFirst'); if (obFirst) await setRaw({ obFirst: { ...obFirst, coachSeen: true } }); card.classList.add('leaving'); setTimeout(() => card.remove(), 240); };
  const card = h('aside', { id: COACH, class: 'fbc float fs-coach', role: 'dialog', 'aria-modal': 'false', 'aria-label': t('fs.coachTitle') },
    h('div', { class: 'fbc-reply-head' }, h('span', { class: 'fbc-ico on' }, icon('target')), h('b', { text: t('fs.coachTitle') })),
    o.sites > 0 ? h('p', { class: 'fbc-quote', text: t('fs.coachSites', { n: o.sites }) }) : null,
    h('div', { class: 'fbc-actions' },
      o.host ? h('a', { class: 'btn btn-primary btn-sm', href: 'https://' + o.host, target: '_blank', rel: 'noopener', onclick: close }, icon('external-link'), t('fs.coachTry')) : null,
      h('button', { class: 'btn btn-sm', type: 'button', onclick: close }, t('fs.ok'))));
  document.body.append(card);
}

let celebrating = false; // the dialog is built after a few awaits: a second call in the meantime (the state changes at once) must not build a second one
async function celebrate(/** @type {any} */ o, /** @type {any} */ ses) {
  if (celebrating || document.getElementById(DONE)) return;
  celebrating = true;
  const usage = await getUsage(), held = Math.max(0, (usage.total.block_page || 0) - (o.blocks0 || 0));
  const s = await getSettings(), ap = s.appearance;
  const set = (/** @type {(a: any) => void} */ fn) => updateSettings((x) => { fn(x.appearance); });
  const changed = () => send('settings:changed');
  const dlg = h('dialog', { id: DONE, class: 'dialog dialog-wide fs-done', 'aria-labelledby': 'fsDoneT' },
    h('div', { class: 'dialog-body' },
      h('div', { class: 'fs-badge', 'aria-hidden': 'true' }, icon('check')),
      h('h2', { id: 'fsDoneT', class: 'fs-title', text: t('fs.doneTitle') }),
      h('p', { class: 'fs-lead', text: t('fs.doneBody', { time: fmtDuration((ses && ses.m ? ses.m : o.minutes) * 60) }) }),
      held > 0 ? h('p', { class: 'fs-held' }, icon('shield-check'), t('fs.doneBlocked', { n: held })) : null,
      h('h3', { class: 'fs-sub', text: t('ob.lookTitle') }),
      h('div', { class: 'looks ob-looks fs-looks' }, [...looksGallery(ap, { compact: true, onPick: (id) => set((a) => { a.look = id; }) }).children]),
      seg(t('opt.theme'), [['system', t('opt.themeSystem')], ['light', t('opt.themeLight')], ['dark', t('opt.themeDark')]], ap.mode, (v) => set((a) => { a.mode = v; })),
      seg(t('ob.goal'), [[0, t('common.off')], [60, fmtDuration(3600)], [120, fmtDuration(7200)], [180, fmtDuration(10800)]], s.focus.dailyGoal, (v) => updateSettings((x) => { x.focus.dailyGoal = v; })),
      sw(t('ob.eye'), t('ob.eyeD'), !!s.eye.enabled, async (v) => { await updateSettings((x) => { x.eye.enabled = v; x.eye.notify = v; }); changed(); }),
      sw(t('ob.schedule'), t('ob.scheduleD'), !!s.blocking.schedule.enabled, async (v) => { await updateSettings((x) => { x.blocking.schedule.enabled = v; }); changed(); })),
    h('div', { class: 'dialog-actions' },
      h('button', { class: 'btn btn-lg', type: 'button', onclick: () => { dlg.close(); openTour(); } }, icon('sliders-horizontal'), t('fs.more')), // the long way: the rest of what EyeTime can do, one short step at a time
      h('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: () => dlg.close() }, t('fs.tuneDone'))));
  dlg.addEventListener('close', async () => { celebrating = false; dlg.remove(); const { obFirst } = await getRaw('obFirst'); if (obFirst) await setRaw({ obFirst: { ...obFirst, stage: 'closed' } }); });
  document.body.append(dlg); dlg.showModal();
}

/** Show what the first session needs now. Returns whether something of it is on the screen (the other cards on Home wait for it). */
export async function paintFirstSession() {
  const { obFirst, focus } = await getRaw(['obFirst', 'focus']);
  if (!obFirst || obFirst.stage === 'closed') { remove(COACH); return false; }
  const live = !!focus && isFocusLive(focus);
  if (obFirst.stage === 'run') {
    if (live) { if (!obFirst.seen) await setRaw({ obFirst: { ...obFirst, seen: true } }); coach(obFirst); return !obFirst.coachSeen; } // `seen`: it has been running, so a stop without a finish is an early stop, not a late start
    remove(COACH);
    const ses = sessionSince(await getDays(rangeKeys(2)), obFirst.at);
    if (ses) { await setRaw({ obFirst: { ...obFirst, stage: 'done', m: ses.m } }); await celebrate(obFirst, ses); return true; }
    if (obFirst.seen || Date.now() - obFirst.at > GRACE_MS) await setRaw({ obFirst: { ...obFirst, stage: 'closed' } }); // stopped early or never started: nothing to celebrate, nothing to say
    return false;
  }
  remove(COACH);
  await celebrate(obFirst, obFirst.m ? { m: obFirst.m } : null);
  return true;
}

/** Keep it in step with the session: it starts, ends, or is stopped. */
export function watchFirstSession() {
  paintFirstSession();
  onChange(['focus', 'obFirst'], paintFirstSession);
}
