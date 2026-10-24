// "Learn" topics for the dock: a topic is a title, a note and a list of links with a status. Pure functions — storage lives in the callers.
// Time per topic comes from the day records EyeTime already keeps (seconds per host), matched against the hosts of the topic's links.

import { hostFromUrl, matches } from './domains.js';

export const MAX_TOPICS = 40, MAX_LINKS = 80, NOTE_MAX = 2000, TITLE_MAX = 80, LINK_TITLE_MAX = 160;
export const INBOX_ID = 'inbox';
export const STATUSES = ['todo', 'doing', 'done'];

const TRACKING = /^(utm_[a-z]+|fbclid|gclid|yclid|mc_cid|mc_eid|ref_src|igshid|si)$/i;

/** A clean, comparable address of a web page, or null (only http/https pages are kept). Tracking parameters and the #fragment are dropped. */
export function cleanUrl(input) {
  let u;
  try { u = new URL(String(input || '').trim()); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  u.hash = '';
  for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
  u.hostname = u.hostname.toLowerCase();
  const s = u.toString();
  return s.length > 2000 ? null : s.replace(/\/$/, '');
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function newTopic(title, now = Date.now()) {
  return { id: newId(), title: String(title || '').trim().slice(0, TITLE_MAX), note: '', createdAt: now, links: [] };
}

/** The inbox is always the first topic: where "save this page" lands when no topic was picked. */
export function ensureInbox(topics, title = 'Inbox') {
  const list = Array.isArray(topics) ? topics : [];
  if (list.some((x) => x.id === INBOX_ID)) return list;
  return [{ id: INBOX_ID, title, note: '', createdAt: 0, links: [] }, ...list];
}

/** → { topics, added, reason } — a new list with the link added to the top of the topic (never mutates the input). Duplicates (same cleaned address) are not added twice. */
export function addLink(topics, topicId, { url, title }, now = Date.now()) {
  const clean = cleanUrl(url);
  if (!clean) return { topics, added: false, reason: 'url' };
  const i = topics.findIndex((x) => x.id === topicId);
  if (i < 0) return { topics, added: false, reason: 'topic' };
  const topic = topics[i];
  if (topic.links.some((l) => l.url === clean)) return { topics, added: false, reason: 'duplicate' };
  if (topic.links.length >= MAX_LINKS) return { topics, added: false, reason: 'full' };
  const host = hostFromUrl(clean) || clean;
  const link = { id: newId(), url: clean, title: String(title || '').trim().slice(0, LINK_TITLE_MAX) || host, status: 'todo', addedAt: now };
  const next = topics.slice(); next[i] = { ...topic, links: [link, ...topic.links] };
  return { topics: next, added: true, link };
}

/** Same change applied to one topic / one link; a no-op for unknown ids. */
export const updateTopic = (topics, id, patch) => topics.map((x) => (x.id === id ? { ...x, ...patch, title: patch.title !== undefined ? String(patch.title).trim().slice(0, TITLE_MAX) || x.title : x.title, note: patch.note !== undefined ? String(patch.note).slice(0, NOTE_MAX) : x.note } : x));
export const updateLink = (topics, topicId, linkId, patch) => topics.map((x) => (x.id === topicId ? { ...x, links: x.links.map((l) => (l.id === linkId ? { ...l, ...patch, status: STATUSES.includes(patch.status) ? patch.status : l.status } : l)) } : x));
export const removeLink = (topics, topicId, linkId) => topics.map((x) => (x.id === topicId ? { ...x, links: x.links.filter((l) => l.id !== linkId) } : x));
/** The inbox cannot be removed. */
export const removeTopic = (topics, id) => (id === INBOX_ID ? topics : topics.filter((x) => x.id !== id));

/** Moves a link to another topic (when it is not already there). */
export function moveLink(topics, fromId, linkId, toId) {
  const from = topics.find((x) => x.id === fromId), link = from && from.links.find((l) => l.id === linkId), to = topics.find((x) => x.id === toId);
  if (!link || !to || fromId === toId || to.links.some((l) => l.url === link.url) || to.links.length >= MAX_LINKS) return topics;
  return topics.map((x) => (x.id === fromId ? { ...x, links: x.links.filter((l) => l.id !== linkId) } : x.id === toId ? { ...x, links: [link, ...x.links] } : x));
}

/** { todo, doing, done, total } */
export function progress(topic) {
  const out = { todo: 0, doing: 0, done: 0, total: topic.links.length };
  for (const l of topic.links) out[l.status in out ? l.status : 'todo']++;
  return out;
}

/** Seconds spent on the topic's sites over the given day records [[key, record]] — every host of a link counts once per day. */
export function topicSeconds(topic, days) {
  const hosts = [...new Set(topic.links.map((l) => hostFromUrl(l.url)).filter(Boolean))];
  if (!hosts.length) return 0;
  let sec = 0;
  for (const [, day] of days || []) for (const [h, s] of Object.entries((day && day.d) || {})) if (hosts.some((x) => matches(h, x))) sec += s;
  return sec;
}

/** A plain Markdown outline of all topics, for export. */
export function topicsToMarkdown(topics) {
  const mark = { todo: '[ ]', doing: '[~]', done: '[x]' };
  return (topics || []).filter((x) => x.links.length || x.note).map((x) => [`## ${x.title}`, x.note ? `\n${x.note}\n` : '', ...x.links.map((l) => `- ${mark[l.status] || '[ ]'} [${l.title.replace(/[[\]]/g, '')}](${l.url})`)].join('\n')).join('\n\n') + '\n';
}
