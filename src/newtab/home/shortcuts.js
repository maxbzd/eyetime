// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Single-key shortcuts of Home (ignored while typing): the new tab is where work starts, so it should be drivable from the keyboard.

import { $, h } from '../../ui/dom.js';
import { t } from '../../shared/i18n.js';
import { openShutdown } from '../shutdown.js';
import { openDrawer } from './drawer.js';

/** Single-key shortcuts (ignored while typing): the new tab is where work starts, so it should be drivable from the keyboard. */
const SHORTCUTS = [['Ctrl K', 'sc.palette'], ['f', 'sc.focus'], ['n', 'sc.task'], ['d', 'sc.closeDay'], ['c', 'sc.customize'], ['i', 'sc.insights'], ['s', 'sc.settings'], ['?', 'sc.help']];
function homeShortcuts(e) {
  if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.querySelector('dialog[open]') || !$('#drawer').hidden) return;
  const k = e.key;
  const go = (fn) => { e.preventDefault(); fn(); };
  if (k === 'f') go(() => { const el = document.querySelector('#focus input[id^="goal"]'); el?.scrollIntoView({ block: 'center' }); el?.focus(); });
  else if (k === 'n') go(() => { window.dispatchEvent(new window.CustomEvent('et:open-panel')); const el = document.querySelector('#mod-tasks input'); el?.scrollIntoView({ block: 'center' }); el?.focus(); });
  else if (k === 'd') go(openShutdown);
  else if (k === 'c') go(openDrawer);
  else if (k === 'i') go(() => { location.href = '../insights/insights.html'; });
  else if (k === 's') go(() => { location.href = '../options/options.html'; });
  else if (k === '?') go(openShortcutHelp);
}
function openShortcutHelp() {
  const dlg = h('dialog', { class: 'dialog' }, h('form', { method: 'dialog' },
    h('div', { class: 'dialog-body stack gap-3' }, h('h3', { text: t('sc.title') }),
      h('div', { class: 'sc-list' }, SHORTCUTS.map(([key, label]) => h('div', { class: 'sc-row' }, h('span', { class: 'kbd', text: key }), h('span', { text: t(label) }))))),
    h('div', { class: 'dialog-actions' }, h('button', { class: 'btn btn-primary', value: 'ok', text: t('common.close'), autofocus: true }))));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg); dlg.showModal();
}


export function installShortcuts() { document.addEventListener('keydown', homeShortcuts); }
