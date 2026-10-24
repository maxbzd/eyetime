import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanUrl, newTopic, ensureInbox, addLink, updateLink, removeLink, removeTopic, moveLink, progress, topicSeconds, topicsToMarkdown, INBOX_ID, MAX_LINKS } from '../../src/shared/topics.js';

test('cleanUrl keeps only http(s) pages and drops tracking noise', () => {
  assert.equal(cleanUrl('https://Example.com/a/?utm_source=x&id=3#top'), 'https://example.com/a/?id=3'.replace('/a/?', '/a/?'));
  assert.equal(cleanUrl('https://example.com/'), 'https://example.com');
  assert.equal(cleanUrl('javascript:alert(1)'), null); assert.equal(cleanUrl('data:text/html,hi'), null); assert.equal(cleanUrl('chrome://settings'), null); assert.equal(cleanUrl('nonsense'), null); assert.equal(cleanUrl(''), null);
  assert.equal(cleanUrl('https://youtu.be/abc?si=zzz&t=30'), 'https://youtu.be/abc?t=30');
});

test('the inbox always exists and cannot be removed', () => {
  const t = ensureInbox([newTopic('Python')], 'Inbox');
  assert.equal(t[0].id, INBOX_ID); assert.equal(ensureInbox(t).length, 2);
  assert.equal(removeTopic(t, INBOX_ID).length, 2); assert.equal(removeTopic(t, t[1].id).length, 1);
});

test('addLink: adds on top, never twice, refuses bad addresses and full topics; never mutates', () => {
  const base = ensureInbox([newTopic('Python')]); const py = base[1].id;
  const a = addLink(base, py, { url: 'https://docs.python.org/3/tutorial/?utm_medium=x', title: ' The Tutorial ' });
  assert.ok(a.added); assert.equal(a.topics[1].links[0].title, 'The Tutorial'); assert.equal(base[1].links.length, 0);
  assert.equal(addLink(a.topics, py, { url: 'https://docs.python.org/3/tutorial/#intro' }).reason, 'duplicate');
  assert.equal(addLink(a.topics, py, { url: 'ftp://x' }).reason, 'url'); assert.equal(addLink(a.topics, 'nope', { url: 'https://a.com' }).reason, 'topic');
  assert.equal(addLink(a.topics, py, { url: 'https://example.org/x', title: '' }).topics[1].links[0].title, 'example.org');
  let full = a.topics; for (let i = 0; i < MAX_LINKS; i++) full = addLink(full, py, { url: 'https://s.com/' + i }).topics;
  assert.equal(addLink(full, py, { url: 'https://s.com/over' }).reason, 'full');
});

test('status, remove and move', () => {
  let t = ensureInbox([newTopic('A'), newTopic('B')]); const [, a, b] = t;
  t = addLink(t, a.id, { url: 'https://x.com/1' }).topics; const id = t[1].links[0].id;
  t = updateLink(t, a.id, id, { status: 'doing' }); assert.equal(t[1].links[0].status, 'doing');
  t = updateLink(t, a.id, id, { status: 'bogus' }); assert.equal(t[1].links[0].status, 'doing');
  t = moveLink(t, a.id, id, b.id); assert.equal(t[1].links.length, 0); assert.equal(t[2].links[0].id, id);
  assert.deepEqual(progress(t[2]), { todo: 0, doing: 1, done: 0, total: 1 });
  t = removeLink(t, b.id, id); assert.equal(t[2].links.length, 0);
});

test('time per topic counts each host of its links once per day (subdomains too)', () => {
  let t = ensureInbox([newTopic('Python')]); const py = t[1].id;
  t = addLink(t, py, { url: 'https://docs.python.org/3/' }).topics; t = addLink(t, py, { url: 'https://docs.python.org/3/library/' }).topics; t = addLink(t, py, { url: 'https://youtube.com/watch?v=1' }).topics;
  const days = [['2026-10-20', { d: { 'docs.python.org': 600, 'youtube.com': 300, 'reddit.com': 900 } }], ['2026-10-21', { d: { 'm.youtube.com': 50, 'a.docs.python.org': 10 } }], ['2026-10-22', {}]];
  assert.equal(topicSeconds(t[1], days), 600 + 300 + 50 + 10);
  assert.equal(topicSeconds(t[0], days), 0);
});

test('markdown export lists non-empty topics with status boxes', () => {
  let t = ensureInbox([newTopic('Rust')]); t = addLink(t, t[1].id, { url: 'https://doc.rust-lang.org/book/', title: 'The [Book]' }).topics;
  t = updateLink(t, t[1].id, t[1].links[0].id, { status: 'done' });
  const md = topicsToMarkdown(t);
  assert.match(md, /## Rust/); assert.match(md, /- \[x\] \[The Book\]\(https:\/\/doc\.rust-lang\.org\/book\)/); assert.doesNotMatch(md, /Inbox/);
});
