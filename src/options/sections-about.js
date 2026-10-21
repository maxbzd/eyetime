// Settings → About: version, links, report a problem, suggest an idea, shortcuts.

import { h, icon, toast, clear } from '../ui/dom.js';
import { row, group, sectionHead } from './ui.js';
import { t } from '../shared/i18n.js';
import { buildReport, issueUrl } from '../shared/diagnostics.js';
import { readErrors, clearErrors } from '../shared/errorlog.js';

const sec = (id, ...kids) => h('section', { class: 'sec', id }, kids);

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
      row({ title: t('opt.ideaTitle'), desc: t('opt.ideaDesc'), control: h('a', { class: 'btn', href: 'https://github.com/maxbzd/eyetime/issues/new?template=feature_request.md&title=Idea%3A+', target: '_blank', rel: 'noopener' }, icon('lightbulb'), t('opt.ideaBtn')) }),
      row({ title: t('opt.reportTitle'), desc: t('opt.reportDesc'), control: h('button', { class: 'btn', type: 'button', onclick: () => openReport(s) }, icon('bug'), t('opt.reportBtn')) })),
    group(t('about.shortcuts'),
      row({ title: t('about.scFocus'), control: shortcutKeys('toggle-focus', ['Alt', 'Shift', 'F']) }),
      row({ title: t('about.scPopup'), control: shortcutKeys('_execute_action', ['Alt', 'Shift', 'E']) }),
      row({ title: t('about.scChange'), control: h('button', { class: 'btn', type: 'button', onclick: () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }) }, icon('keyboard'), t('about.scBtn')) })));
}
