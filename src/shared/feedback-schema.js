// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// What a message to the maker may contain, and nothing else. Read by the extension and the Windows app (to build and check a message before it leaves) and by the collector (to refuse
// anything that is not exactly this), so they cannot drift apart. It has no browser or storage code. See docs/FEEDBACK.md.
//
// A message is something a person chose to send: an idea, a problem, a kind word, or the answer to one small question EyeTime asked at a good moment. It carries no anonymous-usage ID,
// no IP address and no address of any page. The text is whatever the person typed (the form says where it goes and asks them not to write anything personal).

import { UNINSTALL_REASONS } from './usage-schema.js';

/** idea, problem and kind word are written on the person's own initiative; the others are answers to a question EyeTime asked. */
export const FB_KINDS = ['idea', 'problem', 'kudos', 'session', 'week', 'pmf', 'pause', 'leaving'];
/** Where the message came from: the always-open door, or the moment that asked. */
export const FB_VIA = ['door', 'after_session', 'week_review', 'pmf', 'pause_page', 'removal'];
/** What an idea, a problem or a kind word is about (optional chips). */
export const FB_AREAS = ['focus', 'blocking', 'eyes', 'stats', 'look', 'sync', 'other'];
/** The chips of each question. For `leaving` the tag is the reason on the page after removal. */
export const FB_TAGS = {
  idea: FB_AREAS, problem: FB_AREAS, kudos: FB_AREAS,
  session: ['slow', 'hindered', 'unclear', 'timer', 'blocking', 'stats', 'design', 'other'],
  week: ['focus', 'blocking', 'eyes', 'stats', 'look', 'other'],
  pmf: ['timer', 'blocking', 'eyes', 'stats', 'newtab', 'other'],
  pause: [],
  leaving: UNINSTALL_REASONS,
};
/** The range of the rating, where a kind has one: [low, high]. session 1–4 faces, week 1–5, pmf 0 not / 1 somewhat / 2 very disappointed, pause 0 no / 1 helped. */
export const FB_RATING = { session: [1, 4], week: [1, 5], pmf: [0, 2], pause: [0, 1] };
/** How long a person has used EyeTime, in coarse steps (active days), so answers can be read by group without an identifier. */
export const FB_DAYS = ['d0_6', 'd7_13', 'd14_29', 'd30p'];
export const FB_LIMITS = { text: 1000, contact: 120, bytes: 4096, perDay: 400, tags: 8, reply: 1000, replies: 3, polls: 5 };
/** The messages an answer can come back to: only what the person wrote on their own initiative. */
export const FB_REPLY_KINDS = ['idea', 'problem', 'kudos'];
export const FB_STATUS = ['new', 'read', 'starred', 'done', 'wont'];

const SLUG = /^[a-z0-9-]{1,24}$/;
const VERSION = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const EMAIL = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,200}\.[^\s@<>"']{2,24}$/;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u2028\u2029]/;
const KEYS = ['v', 'kind', 'via', 'rating', 'tags', 'text', 'contact', 'ticket', 'ctx'];
const TICKET = /^[A-Za-z0-9_-]{22,43}$/;
const CTX_KEYS = ['app', 'br', 'os', 'lang', 'pr', 'days'];

/**
 * Check a message. Strict on purpose: an unknown key, a value outside its list or a text that is too long makes the whole message invalid.
 * @param {any} r @returns {{ ok: true } | { ok: false, why: string }}
 */
export function validateFeedback(r) {
  const bad = (/** @type {string} */ why) => ({ ok: /** @type {const} */ (false), why });
  if (!r || typeof r !== 'object' || Array.isArray(r)) return bad('not an object');
  for (const k of Object.keys(r)) if (!KEYS.includes(k)) return bad('unknown key ' + k);
  if (r.v !== 1) return bad('version');
  if (!FB_KINDS.includes(r.kind)) return bad('kind');
  if (!FB_VIA.includes(r.via)) return bad('via');
  const range = /** @type {Record<string, number[]>} */ (FB_RATING)[r.kind];
  if (range) { if (r.rating !== undefined && !(Number.isInteger(r.rating) && r.rating >= range[0] && r.rating <= range[1])) return bad('rating'); } else if (r.rating !== undefined) return bad('rating');
  const list = /** @type {Record<string, string[]>} */ (FB_TAGS)[r.kind];
  if (r.tags !== undefined && (!Array.isArray(r.tags) || r.tags.length > FB_LIMITS.tags || !r.tags.every((x) => typeof x === 'string' && list.includes(x)) || new Set(r.tags).size !== r.tags.length)) return bad('tags');
  const text = r.text === undefined ? '' : r.text;
  if (typeof text !== 'string' || text.length > FB_LIMITS.text || CONTROL.test(text)) return bad('text');
  const written = text.trim().length;
  if (['idea', 'problem', 'kudos'].includes(r.kind) && written < 3) return bad('a message needs some words');
  if (!written && r.rating === undefined && !(r.tags && r.tags.length)) return bad('empty');
  if (r.contact !== undefined) {
    if (!['idea', 'problem', 'leaving'].includes(r.kind) || typeof r.contact !== 'string' || r.contact.length > FB_LIMITS.contact || !EMAIL.test(r.contact)) return bad('contact');
  }
  if (r.ticket !== undefined && (!FB_REPLY_KINDS.includes(r.kind) || typeof r.ticket !== 'string' || !TICKET.test(r.ticket))) return bad('ticket');
  const c = r.ctx;
  if (!c || typeof c !== 'object' || Array.isArray(c)) return bad('ctx');
  for (const k of Object.keys(c)) if (!CTX_KEYS.includes(k)) return bad('ctx.' + k);
  if (typeof c.app !== 'string' || !VERSION.test(c.app)) return bad('ctx.app');
  for (const k of ['br', 'os', 'lang']) if (c[k] !== undefined && (typeof c[k] !== 'string' || !SLUG.test(c[k]))) return bad('ctx.' + k);
  if (c.pr !== undefined && c.pr !== 'win' && c.pr !== 'ext') return bad('ctx.pr');
  if (c.days !== undefined && !FB_DAYS.includes(c.days)) return bad('ctx.days');
  if (JSON.stringify(r).length > FB_LIMITS.bytes) return bad('too big');
  return { ok: true };
}

/** Active days → the coarse step a message carries. */
export const daysBucket = (/** @type {number} */ n) => (n >= 30 ? 'd30p' : n >= 14 ? 'd14_29' : n >= 7 ? 'd7_13' : 'd0_6');

/** A random ticket for one message, made on the device. The collector keeps only its hash; the device keeps the ticket to ask whether the author has answered. 16 random bytes, base64url. */
export function newTicket(/** @type {Crypto} */ cryptoLike = globalThis.crypto) {
  const b = cryptoLike.getRandomValues(new Uint8Array(16));
  let s = ''; for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The question "has the author answered?": the tickets of the person's own messages, at most FB_LIMITS.polls. */
export function validatePoll(/** @type {any} */ r) {
  if (!r || typeof r !== 'object' || Array.isArray(r) || Object.keys(r).sort().join() !== 't,v' || r.v !== 1) return false;
  return Array.isArray(r.t) && r.t.length >= 1 && r.t.length <= FB_LIMITS.polls && r.t.every((x) => typeof x === 'string' && TICKET.test(x)) && new Set(r.t).size === r.t.length;
}

/** The owner's answer: a short plain text. */
export const validateReplyText = (/** @type {any} */ t) => typeof t === 'string' && t.trim().length >= 1 && t.length <= FB_LIMITS.reply && !CONTROL.test(t);
