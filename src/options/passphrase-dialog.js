// The dialog that asks for a passphrase (or two, or an old and a new one), shared by the vault of connected services and by the encryption of synced data.
// It is a <dialog>, so the keyboard, the focus and the escape key are the browser's; the check runs before it closes and its message stays in the dialog.

import { h } from '../ui/dom.js';
import { t } from '../shared/i18n.js';
import { passphraseProblem } from '../shared/vault.js';

/**
 * @param {{ title: string, body?: string, fields: { id: string, label: string }[], confirm: string, danger?: boolean, check?: (values: Record<string, string>) => string | Promise<string> }} o
 * @returns {Promise<Record<string, string> | null>} the values, or null when it was cancelled
 */
export function passphraseDialog({ title, body = '', fields, confirm, danger = false, check = () => '' }) {
  return new Promise((resolve) => {
    const inputs = Object.fromEntries(fields.map((f) => [f.id, h('input', { class: 'input', type: 'password', id: 'vault-' + f.id, autocomplete: f.id === 'old' || f.id === 'pass' ? 'current-password' : 'new-password', maxlength: 256, 'aria-label': f.label, placeholder: f.label })]));
    const msg = h('p', { class: 'hint', role: 'alert', id: 'vaultMsg' });
    const go = h('button', { class: 'btn ' + (danger ? 'btn-danger-solid' : 'btn-primary'), type: 'submit', text: confirm });
    const dlg = h('dialog', { class: 'dialog' }, h('form', { method: 'dialog' },
      h('div', { class: 'dialog-body stack gap-3' }, h('h3', { text: title }), body ? h('p', { class: 'muted-2', text: body }) : null, ...fields.map((f) => inputs[f.id]), msg),
      h('div', { class: 'dialog-actions' }, h('button', { class: 'btn btn-ghost', type: 'button', text: t('common.cancel'), onclick: () => dlg.close('no') }), go)));
    dlg.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const values = Object.fromEntries(fields.map((f) => [f.id, /** @type {HTMLInputElement} */ (inputs[f.id]).value]));
      go.disabled = true; msg.textContent = '';
      try { const problem = await check(values); if (problem) { msg.textContent = problem; go.disabled = false; return; } } catch { msg.textContent = t('common.error'); go.disabled = false; return; }
      dlg.dataset.values = JSON.stringify(values); dlg.close('yes');
    });
    dlg.addEventListener('close', () => { resolve(dlg.returnValue === 'yes' ? JSON.parse(dlg.dataset.values || '{}') : null); dlg.remove(); });
    document.body.append(dlg); dlg.showModal(); /** @type {HTMLElement} */ (inputs[fields[0].id]).focus();
  });
}

export const newPassphraseProblem = (/** @type {Record<string, string>} */ v) => (passphraseProblem(v.pass) ? t('cn.vault.short', { n: 8 }) : v.pass !== v.pass2 ? t('cn.vault.mismatch') : '');
