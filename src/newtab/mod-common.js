// Shared bits of the Home modules: the card frame, the calm empty state, ids.

import { h, icon } from '../ui/dom.js';

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function card(id, ico, title, ...body) {
  return h('section', { class: 'card mod', id: 'mod-' + id }, h('div', { class: 'mod-head' }, h('h3', { 'aria-level': 2 }, ico, title)), body);
}

/** A calm, centred empty state shared by the modules: soft icon, one line of guidance. */
export function emptyMini({ ico, title, body }) {
  return h('div', { class: 'empty-mini' }, h('div', { class: 'em-ico' }, icon(ico)), h('div', { class: 'em-title', text: title }), body ? h('div', { class: 'em-body', text: body }) : null);
}
