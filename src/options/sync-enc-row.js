// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Settings → Data & privacy → Sync: "Encrypt synced data with a passphrase". The cloud of the browser account then holds only ciphertext (shared/syncseal.js).
// Four states: none; set here and given this session; set here and still to be given (after a restart); set on another device and not yet given here.

import { h, toast, confirmDialog } from '../ui/dom.js';
import { send } from '../ui/api.js';
import { row } from './ui.js';
import { t } from '../shared/i18n.js';
import { getRaw } from '../shared/storage.js';
import { WrongPassphraseError } from '../shared/vault.js';
import { enableSyncEncryption, unlockSyncEncryption, unlockLocal, changeSyncPassphrase, disableSyncEncryption, loadSyncKey } from '../shared/syncvault.js';
import { passphraseDialog, newPassphraseProblem } from './passphrase-dialog.js';

const wrong = (/** @type {unknown} */ e) => (e instanceof WrongPassphraseError ? t('cn.vault.wrong') : t('common.error'));

/** @returns {HTMLElement} */
export function syncEncRow() {
  const status = h('div', { class: 'setting-desc sync-status', 'aria-live': 'polite' });
  const controls = h('div', { class: 'row gap-2' });
  const r = row({ title: t('opt.syncEnc'), desc: t('opt.syncEncDesc'), control: controls });
  r.querySelector('.setting-text').append(status);
  const btn = (/** @type {string} */ id, /** @type {string} */ label, /** @type {() => Promise<void>} */ run, cls = 'btn') => h('button', { class: cls, type: 'button', id, onclick: run, text: label });
  const after = async (/** @type {string} */ msg) => { toast(t(msg)); await send('sync:now').catch(() => {}); await paint(); };

  async function paint() {
    const { syncEnc, syncNeeds } = await getRaw(['syncEnc', 'syncNeeds']);
    const unlocked = !!syncEnc && !!(await loadSyncKey(syncEnc));
    controls.replaceChildren();
    status.classList.toggle('warn', !!syncNeeds || (!!syncEnc && !unlocked));
    if (!syncEnc && !syncNeeds) {
      status.textContent = '';
      controls.append(btn('syncEncSet', t('opt.syncEncSet'), async () => {
        const v = await passphraseDialog({ title: t('opt.syncEncSet'), body: t('opt.syncEncSetBody'), fields: [{ id: 'pass', label: t('cn.vault.pass') }, { id: 'pass2', label: t('cn.vault.pass2') }], confirm: t('opt.syncEncSet'),
          check: async (x) => { const p = newPassphraseProblem(x); if (p) return p; try { await enableSyncEncryption(x.pass); return ''; } catch { return t('common.error'); } } });
        if (v) await after('opt.syncEncIsOn');
      }));
    } else if (!syncEnc) { // the cloud holds one that was set on another device
      status.textContent = t('opt.syncEncNeeds');
      controls.append(btn('syncEncUnlock', t('cn.vault.unlock'), async () => {
        const v = await passphraseDialog({ title: t('cn.vault.unlock'), fields: [{ id: 'pass', label: t('cn.vault.pass') }], confirm: t('cn.vault.unlock'), check: async (x) => { try { await unlockSyncEncryption(syncNeeds, x.pass); return ''; } catch (e) { return wrong(e); } } });
        if (v) await after('opt.syncEncUnlocked');
      }, 'btn btn-primary'));
    } else if (!unlocked) { // after a restart
      status.textContent = t('opt.syncEncLocked');
      controls.append(btn('syncEncUnlock', t('cn.vault.unlock'), async () => {
        const v = await passphraseDialog({ title: t('cn.vault.unlock'), fields: [{ id: 'pass', label: t('cn.vault.pass') }], confirm: t('cn.vault.unlock'), check: async (x) => { try { await unlockLocal(x.pass); return ''; } catch (e) { return wrong(e); } } });
        if (v) await after('opt.syncEncUnlocked');
      }, 'btn btn-primary'), offButton());
    } else {
      status.textContent = t('opt.syncEncOn');
      controls.append(
        btn('syncEncChange', t('cn.vault.change'), async () => {
          const v = await passphraseDialog({ title: t('cn.vault.change'), fields: [{ id: 'old', label: t('cn.vault.old') }, { id: 'pass', label: t('cn.vault.pass') }, { id: 'pass2', label: t('cn.vault.pass2') }], confirm: t('cn.vault.change'),
            check: async (x) => { const p = newPassphraseProblem(x); if (p) return p; try { await changeSyncPassphrase(x.old, x.pass); return ''; } catch (e) { return wrong(e); } } });
          if (v) await after('opt.syncEncChanged');
        }), offButton());
    }
  }
  function offButton() {
    return btn('syncEncOff', t('opt.syncEncOff'), async () => {
      if (!(await confirmDialog({ title: t('opt.syncEncOff'), body: t('opt.syncEncOffBody'), confirm: t('opt.syncEncOff'), danger: true }))) return;
      await disableSyncEncryption();
      await after('opt.syncEncIsOff');
    }, 'btn btn-ghost');
  }
  paint();
  return r;
}
