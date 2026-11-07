// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The two small controls the dialogs on Home share (the first session's, and the guided set-up): a row of choices, and a switch. Each applies on the spot.

import { h } from '../../ui/dom.js';

/** A labelled row of choices; `on(value)` runs when one is picked. */
export function seg(/** @type {string} */ label, /** @type {[any, string][]} */ opts, /** @type {any} */ cur, /** @type {(v: any) => void} */ on) {
  return h('div', { class: 'opt' }, h('b', { text: label }),
    h('div', { class: 'segmented', role: 'group', 'aria-label': label }, opts.map(([v, text]) => h('button', {
      type: 'button', 'aria-pressed': String(cur === v), text,
      onclick: (e) => { on(v); e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); },
    }))));
}

/** A labelled switch with a line under the label. */
export function sw(/** @type {string} */ label, /** @type {string} */ desc, /** @type {boolean} */ on, /** @type {(v: boolean) => void} */ fn) {
  return h('div', { class: 'opt' }, h('div', {}, h('b', { text: label }), desc ? h('span', { class: 'd', text: desc }) : null),
    h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: on, 'aria-label': label, onchange: (e) => fn(e.target.checked) }), h('span', { class: 'track' }), h('span', { class: 'thumb' })));
}
