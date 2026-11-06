// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Settings → Data & privacy → Anonymous usage: off until the person says yes. Shows exactly what would be sent, when the last report went, and lets the person start over with a new id.

import { h, icon, toast } from '../ui/dom.js';
import { row, toggle } from './ui.js';
import { t, fmtDate } from '../shared/i18n.js';
import { getShare, previewReport, enableSharing, disableSharing, haveEndpoint } from '../shared/usage-store.js';

export function usageGroup() {
  const list = h('div', { class: 'card list' });
  let showing = false;

  async function paint() {
    const [share, prev] = await Promise.all([getShare(), previewReport()]);
    const configured = haveEndpoint();
    const sw = toggle(share.on, async (on) => {
      if (on) { const ok = await enableSharing(); if (!ok) toast(t('us.denied')); } else await disableSharing();
      paint();
    }, t('us.on'));
    sw.querySelector('input').disabled = !configured && !share.on;
    const pre = h('pre', { class: 'code usage-preview', tabindex: 0, 'aria-label': t('us.show'), text: prev.text, hidden: !showing });
    const showBtn = h('button', { class: 'btn', type: 'button', 'aria-expanded': String(showing), onclick: () => { showing = !showing; pre.hidden = !showing; showBtn.setAttribute('aria-expanded', String(showing)); showBtn.lastChild.textContent = t(showing ? 'us.hide' : 'us.show'); } }, icon('eye'), h('span', { text: t(showing ? 'us.hide' : 'us.show') }));
    list.replaceChildren(...[
      row({ title: t('us.on'), desc: configured || share.on ? t('us.desc') : t('us.desc') + ' ' + t('us.notConfigured'), control: sw }),
      row({ title: t('us.show'), desc: share.on ? (share.lastReportAt ? t('us.last', { when: fmtDate(new Date(share.lastReportAt)) }) : t('us.never')) : t('us.previewNote'), stack: true, control: h('div', { class: 'stack gap-2', style: { width: '100%' } }, showBtn, pre) }),
      share.on ? row({ title: t('us.reset'), desc: t('us.resetDesc', { id: (share.id || '').slice(0, 6) }), control: h('button', { class: 'btn', type: 'button', onclick: async () => { await disableSharing(); await enableSharing(); paint(); } }, icon('refresh-cw'), t('us.reset')) }) : null].filter(Boolean));
  }
  paint();
  return h('div', {}, h('h3', { class: 'group-title', text: t('us.title') }), list);
}
