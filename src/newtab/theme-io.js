// Save the look of Home as a theme file, or load one. Validation lives in shared/themefile.js: a file is never trusted.

import { h, icon, toast, confirmDialog } from '../ui/dom.js';
import { t } from '../shared/i18n.js';
import { getSettings, updateSettings, getRaw, setRaw } from '../shared/storage.js';
import { buildTheme, parseTheme, applyTheme } from '../shared/themefile.js';
import { dayKey } from '../shared/time.js';

/** The drawer block: save / load. */
export function themeBlock() {
  let withPhoto = false;
  const download = (text, name) => { const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })); const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url); };
  const save = h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => {
    const s = await getSettings();
    const media = withPhoto ? await getRaw(['newtabBg', 'newtabFg']) : null;
    const theme = buildTheme(s, { name: '', media: media ? { bg: media.newtabBg, fg: media.newtabFg } : null });
    download(JSON.stringify(theme), `eyetime-theme-${dayKey()}.json`);
  } }, icon('download'), t('th.save'));
  const photo = h('label', { class: 'toggle-row' }, h('span', { text: t('th.withPhoto') }), h('span', { class: 'switch' }, h('input', { type: 'checkbox', 'aria-label': t('th.withPhoto'), onchange: (e) => { withPhoto = e.target.checked; } }), h('span', { class: 'track' }), h('span', { class: 'thumb' })));
  const file = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    const r = parseTheme(await f.text());
    if (!r.ok) { toast(t('th.err.' + r.error)); return; }
    const ok = await confirmDialog({ title: t('th.confirmTitle'), body: t('th.confirmBody'), confirm: t('th.confirmYes'), danger: true });
    if (!ok) return;
    if (r.theme.media.bg) { await setRaw({ newtabBg: r.theme.media.bg }); if (r.theme.media.fg) await setRaw({ newtabFg: r.theme.media.fg }); else await chrome.storage.local.remove('newtabFg'); }
    await updateSettings((s) => { applyTheme(s, r.theme); });
    toast(t('th.done'));
  } });
  return h('div', { class: 'stack gap-2' }, h('p', { class: 'muted', style: { fontSize: 'var(--fs-sm)' }, text: t('th.hint') }), photo, h('div', { class: 'row gap-2' }, save, h('button', { class: 'btn btn-sm', type: 'button', onclick: () => file.click() }, icon('upload'), t('th.load'))), file);
}
