// Settings → Appearance: looks gallery, colour mode, accent, type, shape, density, custom CSS, share/import/reset.

import { h, icon, toast, confirmDialog } from '../ui/dom.js';
import { row, group, toggle, select, segmented, sectionHead } from './ui.js';
import { t } from '../shared/i18n.js';
import { FONTS, RADII, DENSITY, CARD_STYLES, SCALES, LOOK_EXPORT_KEYS, sanitizeAppearance, sanitizeCustomCss } from '../shared/looks.js';
import { DEFAULT_SETTINGS } from '../shared/defaults.js';
import { looksGallery, accentPicker } from '../ui/appearance.js';

const timeIn = (value, label, onChange) => h('input', { class: 'input input-sm', type: 'time', value, 'aria-label': label, style: { width: '110px' }, onchange: (e) => e.target.value && onChange(e.target.value) });

function importDialog(onApply) {
  const area = h('textarea', { class: 'input token', rows: 9, spellcheck: false, placeholder: '{ "eyetimeLook": 1, "appearance": { "look": "midnight" } }', 'aria-label': t('ap.importTitle'), style: { width: '100%', resize: 'vertical' } });
  const info = h('div', { class: 'hint', 'aria-live': 'polite' });
  const go = h('button', { class: 'btn btn-primary', type: 'button', disabled: true, text: t('ap.import') });
  let clean = null;
  const parse = () => {
    clean = null; info.style.color = ''; area.classList.remove('is-invalid');
    if (!area.value.trim()) { info.textContent = ''; go.disabled = true; return; }
    try {
      const parsed = JSON.parse(area.value);
      const c = sanitizeAppearance(parsed && parsed.eyetimeLook === 1 ? parsed.appearance : parsed);
      if (!Object.keys(c).length) throw new Error('empty');
      clean = c; go.disabled = false;
      info.style.color = 'var(--success-text)'; info.textContent = t('ap.importOk', { look: c.look ? t('look.' + c.look) : t('ap.fromLook'), n: Object.keys(c).length });
    } catch { go.disabled = true; area.classList.add('is-invalid'); info.style.color = 'var(--distracting-text)'; info.textContent = t('ap.importBad'); }
  };
  area.addEventListener('input', parse);
  go.addEventListener('click', () => { if (clean) { dlg.close(); onApply(clean); } });
  const paste = h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => { try { area.value = await navigator.clipboard.readText(); parse(); } catch { area.focus(); } } }, icon('clipboard'), t('ap.paste'));
  const dlg = h('dialog', { class: 'dialog dialog-wide' },
    h('div', { class: 'dialog-body stack gap-3' }, h('h3', { text: t('ap.importTitle') }), h('p', { class: 'muted-2', text: t('ap.importDesc') }), area, h('div', { class: 'row gap-2', style: { justifyContent: 'space-between' } }, info, paste)),
    h('div', { class: 'dialog-actions' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => dlg.close(), text: t('common.cancel') }), go));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg); dlg.showModal(); area.focus();
}

export function appearance({ s, save }) {
  const ap = s.appearance;
  const set = (key) => (v) => save((x) => { x.appearance[key] = v; }, true);
  const mode = [['system', t('opt.themeSystem'), 'monitor'], ['light', t('opt.themeLight'), 'sun'], ['dark', t('opt.themeDark'), 'moon'], ['schedule', t('ap.modeSchedule'), 'clock']];

  const cssErr = h('div', { class: 'hint', style: { color: 'var(--distracting-text)' } });
  const css = h('textarea', { class: 'input token', rows: 8, spellcheck: false, value: ap.customCss, placeholder: '.card { border-radius: 4px; }', 'aria-label': t('ap.css'), style: { width: '100%', resize: 'vertical' },
    onchange: (e) => {
      const r = sanitizeCustomCss(e.target.value);
      if (!r.ok) { cssErr.textContent = t('ap.cssRemote'); css.setAttribute('aria-invalid', 'true'); css.classList.add('is-invalid'); return; }
      cssErr.textContent = ''; css.removeAttribute('aria-invalid'); css.classList.remove('is-invalid');
      save((x) => { x.appearance.customCss = r.css; });
    } });

  const share = async () => {
    const out = { eyetimeLook: 1, appearance: Object.fromEntries(LOOK_EXPORT_KEYS.map((k) => [k, ap[k]])) };
    try { await navigator.clipboard.writeText(JSON.stringify(out, null, 2)); toast(t('ap.copied')); } catch { toast(t('common.error')); }
  };
  const reset = async () => {
    if (!await confirmDialog({ title: t('ap.resetTitle'), body: t('ap.resetBody'), confirm: t('ap.reset'), danger: true })) return;
    save((x) => { x.appearance = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.appearance)); }, true);
  };

  return h('section', { class: 'sec', id: 'appearance' },
    sectionHead(t('sec.appearance'), t('sec.appearanceDesc')),
    h('div', { class: 'stack gap-3' }, h('h3', { class: 'group-title', text: t('ap.looks') }), looksGallery(ap, { onPick: (id) => save((x) => { x.appearance.look = id; }, true) })),
    group(t('ap.color'),
      row({ title: t('opt.theme'), desc: t('ap.mode.' + ap.mode), control: segmented(mode, ap.mode, set('mode'), t('opt.theme')) }),
      ap.mode === 'schedule' ? row({ title: t('ap.schedule'), desc: t('ap.scheduleDesc'), control: h('div', { class: 'row gap-2' },
        h('span', { class: 'muted', text: t('ap.darkFrom') }), timeIn(ap.schedule.dark, t('ap.darkFrom'), (v) => save((x) => { x.appearance.schedule.dark = v; }, true)),
        h('span', { class: 'muted', text: t('ap.lightFrom') }), timeIn(ap.schedule.light, t('ap.lightFrom'), (v) => save((x) => { x.appearance.schedule.light = v; }, true))) }) : null,
      row({ title: t('opt.accent'), desc: t('ap.accentDesc'), stack: true, control: accentPicker(ap, set('accent')) })),
    group(t('ap.shape'),
      row({ title: t('ap.font'), desc: t('ap.fontDesc'), control: select([['look', t('ap.fromLook')], ...Object.entries(FONTS).map(([id, f]) => [id, f.label])], ap.font, set('font'), { label: t('ap.font') }) }),
      row({ title: t('ap.scale'), desc: t('ap.scaleDesc'), control: segmented(SCALES.map((v) => [v, v + '%']), ap.scale, set('scale'), t('ap.scale')) }),
      row({ title: t('ap.radius'), desc: t('ap.radiusDesc'), control: select([['look', t('ap.fromLook')], ...Object.keys(RADII).map((id) => [id, t('radius.' + id)])], ap.radius, set('radius'), { label: t('ap.radius') }) }),
      row({ title: t('ap.density'), desc: t('ap.densityDesc'), control: segmented(Object.keys(DENSITY).map((id) => [id, t('density.' + id)]), ap.density, set('density'), t('ap.density')) }),
      row({ title: t('ap.cards'), desc: t('ap.cardsDesc'), control: select(CARD_STYLES.map((id) => [id, id === 'look' ? t('ap.fromLook') : t('cards.' + id)]), ap.cards, set('cards'), { label: t('ap.cards') }) }),
      row({ title: t('ap.motion'), desc: t('ap.motionDesc'), control: toggle(ap.motion === 'reduced', (v) => save((x) => { x.appearance.motion = v ? 'reduced' : 'system'; }, true), t('ap.motion')) })),
    group(t('ap.advanced'),
      row({ title: t('ap.css'), desc: t('ap.cssDesc'), stack: true, control: h('div', { class: 'stack gap-2', style: { width: '100%' } }, css, cssErr) }),
      row({ title: t('ap.share'), desc: t('ap.shareDesc'), stack: true, control: h('div', { class: 'row gap-2 wrap' },
        h('button', { class: 'btn', type: 'button', onclick: share }, icon('copy'), t('ap.copy')),
        h('button', { class: 'btn', type: 'button', onclick: () => importDialog((clean) => save((x) => { Object.assign(x.appearance, clean); }, true)) }, icon('download'), t('ap.import'))) }),
      row({ title: t('ap.reset'), desc: t('ap.resetRow'), control: h('button', { class: 'btn btn-danger', type: 'button', onclick: reset }, icon('rotate-ccw'), t('ap.reset')) })));
}
