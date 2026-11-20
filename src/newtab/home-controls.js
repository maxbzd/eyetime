// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The controls that shape the look of Home, shared by the customize drawer and the arrangement editor:
// the scene (background, photo, cut-out), depth, the look and accent, the clock format and the greeting.
// Each builder takes the settings it draws (`n` = the Home settings in effect) and `set(fn)`, which changes them (fn gets `{ ...settings, newtab }`).

import { h, icon, toast } from '../ui/dom.js';
import { t } from '../shared/i18n.js';
import { getPhoto, setPhoto, removePhotos } from '../shared/photos.js';
import { normalizeHex } from '../shared/color.js';
import { normalizeDepth } from '../shared/depth.js';
import { looksGallery, accentPicker } from '../ui/appearance.js';
import { FRAME_IDS } from '../shared/frames.js';

export const BACKGROUNDS = ['look', 'peaks', 'dawn', 'ocean', 'forest', 'dusk', 'sand', 'slate', 'mesh', 'aurora', 'stars', 'waves', 'grain', 'dots', 'sphere', 'grid', 'living', 'plain', 'color'];
export const CLOCKS = ['thin', 'bold', 'mono', 'serif', 'compact', 'stacked', 'none'];
export const LAYOUTS = ['today', 'center', 'split', 'minimal'];

/** Downscale a user photo so storage stays small. */
export const MAX_PHOTO_BYTES = 40 * 1024 * 1024;
export function fileToDataUrl(file, maxW = 1920) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_PHOTO_BYTES) { reject(new Error('photo too large')); return; } // decoding a very large picture can stall or crash the tab
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxW / img.width);
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.82)); URL.revokeObjectURL(img.src);
    };
    img.onerror = reject; img.src = URL.createObjectURL(file);
  });
}

/** Background tiles, colour and photo. */
export function backgroundControls(n, set) {
  const fileIn = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { await removePhotos(['fg']); await setPhoto('bg', await fileToDataUrl(f)); await set((s) => { s.newtab.background = 'photo'; s.newtab.frame = ''; }); toast(t('home.photoSaved')); } catch { toast(t('common.error')); }
  } });
  const tiles = [...BACKGROUNDS, 'photo', ...(n.scene && n.scene.layers && n.scene.layers.length ? ['scene'] : [])].map((id) => h('button', { class: 'bg-tile', type: 'button', 'aria-pressed': String(n.background === id), onclick: async () => {
    if (id === 'photo' && !n.frame) { if (!(await getPhoto('bg'))) { fileIn.click(); return; } }
    await set((s) => { s.newtab.background = id; });
  } }, h('i', { class: 'bgx-' + (id === 'photo' ? 'plain' : id), style: id === 'photo' ? { background: 'repeating-linear-gradient(45deg, var(--surface-2), var(--surface-2) 6px, var(--surface-3) 6px, var(--surface-3) 12px)' } : id === 'color' ? { '--bg-color': normalizeHex(n.bgColor) || '#e9e4ff' } : {} }), h('span', { text: t('bg.' + id) })));
  const colorIn = h('label', { class: 'row gap-2', style: { marginTop: 'var(--s-3)' } }, h('span', { class: 'muted-2', text: t('home.bgColor') }),
    h('input', { type: 'color', value: normalizeHex(n.bgColor) || '#e9e4ff', 'aria-label': t('home.bgColor'), onchange: (e) => set((s) => { s.newtab.bgColor = e.target.value; s.newtab.background = 'color'; }) }));
  const frames = h('div', { class: 'frame-grid', role: 'group', 'aria-label': t('bg.frames') }, FRAME_IDS.map((id) => h('button', { class: 'frame-tile', type: 'button', 'aria-pressed': String(n.background === 'photo' && n.frame === id), 'aria-label': t('bg.frame.' + id), 'data-tip': t('bg.frame.' + id),
    onclick: () => set((s) => { s.newtab.background = 'photo'; s.newtab.frame = id; }) }, h('img', { src: chrome.runtime.getURL(`src/newtab/frames/${id}-t.webp`), alt: '', width: 80, height: 50 }))));
  if (FRAME_IDS.length > 24) { // a long list scrolls in its own box and opens at the photo in use
    frames.classList.add('is-long');
    const reveal = () => { const on = frames.querySelector('[aria-pressed="true"]'); if (on && frames.clientHeight) frames.scrollTop = Math.max(0, on.offsetTop - (frames.clientHeight - on.offsetHeight) / 2); };
    window.requestAnimationFrame(reveal); new window.ResizeObserver((_, ro) => { if (frames.clientHeight) { reveal(); ro.disconnect(); } }).observe(frames);
  }
  const daily = h('button', { class: 'chip', type: 'button', style: { marginBottom: 'var(--s-2)' }, 'aria-pressed': String((n.background === 'photo' && n.frame === 'daily') || (n.layout === 'today' && n.background === 'look')), onclick: () => set((s) => { s.newtab.background = 'photo'; s.newtab.frame = 'daily'; }) }, icon('refresh-cw'), t('bg.daily'));
  return [h('div', { class: 'bg-grid' }, tiles), h('div', { class: 'muted-2 frame-label', text: t('bg.frames') }), daily, frames, fileIn,
    n.background === 'color' ? null : colorIn,
    n.background === 'photo' ? h('button', { class: 'btn btn-sm', style: { marginTop: 'var(--s-3)' }, type: 'button', onclick: () => fileIn.click() }, icon('image'), t('home.changePhoto')) : null,
    n.background === 'photo' ? h('div', { class: 'stack gap-2', style: { marginTop: 'var(--s-4)' } }, h('div', { class: 'eyebrow', text: t('bg.textTone') }),
      h('div', { class: 'segmented', role: 'group', 'aria-label': t('bg.textTone') }, [['auto', 'bg.toneAuto'], ['light', 'bg.toneLight'], ['dark', 'bg.toneDark']].map(([v, k]) => h('button', { type: 'button', 'aria-pressed': String((n.photoText || 'auto') === v), text: t(k), onclick: () => set((s) => { s.newtab.photoText = v; }) }))),
      h('p', { class: 'muted', style: { fontSize: 'var(--fs-sm)' }, text: t('bg.toneHint') })) : null,
    ];
}

/** Depth: layers in front of the clock, and the parallax. */
export function depthControls(n, set) {
  const depth = normalizeDepth(n.depth);
  const toggle = (label, on, patch) => h('label', { class: 'toggle-row' }, h('span', { text: label }), h('span', { class: 'switch' }, h('input', { type: 'checkbox', checked: on, 'aria-label': label, onchange: (e) => set((s) => { s.newtab.depth = { ...normalizeDepth(s.newtab.depth), ...patch(e.target.checked) }; }) }), h('span', { class: 'track' }), h('span', { class: 'thumb' })));
  return [h('p', { class: 'muted', style: { fontSize: 'var(--fs-sm)', marginBottom: 'var(--s-2)' }, text: t('dp.hint') }),
    toggle(t('dp.on'), depth.on, (v) => ({ on: v })), toggle(t('dp.parallax'), depth.parallax, (v) => ({ parallax: v })),
    h('label', { class: 'toggle-row' }, h('span', { text: t('dp.strength') }), h('input', { type: 'range', min: 0, max: 100, step: 5, value: depth.strength, 'aria-label': t('dp.strength'), disabled: !depth.on || !depth.parallax, style: { width: '140px', accentColor: 'var(--accent)' }, onchange: (e) => set((s) => { s.newtab.depth = { ...normalizeDepth(s.newtab.depth), strength: Number(e.target.value) }; }) }))];
}

/** The look gallery and the accent colour (these are the appearance options, shared by every layout). */
export function lookControls(settings, set) {
  return [looksGallery(settings.appearance, { compact: true, onPick: (id) => set((s) => { s.appearance.look = id; if (s.newtab.background === 'dawn') s.newtab.background = 'look'; }) })];
}
export const accentControls = (settings, set) => [accentPicker(settings.appearance, (v) => set((s) => { s.appearance.accent = v; }))];

/** 12/24-hour clock and the greeting. */
export function clockFormatControls(n, set) {
  const seg = h('div', { class: 'segmented', role: 'group', 'aria-label': t('home.clockFormat') }, [[null, 'home.clockAuto'], [false, 'home.clock12'], [true, 'home.clock24']].map(([v, k]) => h('button', { type: 'button', 'aria-pressed': String(n.clock24 === v), text: t(k), onclick: () => set((s) => { s.newtab.clock24 = v; }) })));
  const greeting = h('label', { class: 'toggle-row', style: { marginTop: 'var(--s-3)' } }, h('span', { text: t('home.greeting') }), h('span', { class: 'switch' }, h('input', { type: 'checkbox', checked: n.greeting, onchange: (e) => set((s) => { s.newtab.greeting = e.target.checked; }) }), h('span', { class: 'track' }), h('span', { class: 'thumb' })));
  return [seg, greeting];
}
