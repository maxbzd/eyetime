// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// A small XML reader for WebDAV answers (the service worker has no DOMParser). Well-formed XML only, which is what CalDAV servers send.
// Names are kept without their namespace prefix: `D:href`, `d:href` and `href` are all "href".

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (/** @type {string} */ s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[/** @type {'amp'} */ (e)] ?? m));

/** @typedef {{ name: string, attrs: Record<string, string>, children: XNode[], text: string }} XNode */

/** @returns {XNode} the root element */
export function parseXml(/** @type {string} */ src) {
  const root = /** @type {XNode} */ ({ name: '#root', attrs: {}, children: [], text: '' });
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([A-Za-z_][\w.:-]*)((?:\s+[\w.:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(src))) {
    const top = stack[stack.length - 1];
    if (stack.length > 64) throw new Error('XML nested too deep'); // a real answer is a few levels deep; the walk over the tree must not be a stack of tens of thousands
    if (m[1] !== undefined) top.text += m[1];
    else if (m[3]) {
      if (m[2]) { if (stack.length > 1) stack.pop(); continue; }
      const attrs = /** @type {Record<string, string>} */ ({});
      for (const a of m[4].matchAll(/([\w.:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1].split(':').pop() || a[1]] = decode(a[2] ?? a[3] ?? '');
      const node = { name: m[3].split(':').pop() || m[3], attrs, children: [], text: '' };
      top.children.push(node);
      if (!m[5]) stack.push(node);
    } else if (m[6] !== undefined) top.text += decode(m[6]);
  }
  if (!root.children.length) throw new Error('not XML');
  return root.children[0];
}

/** The first descendant with this (local) name, or null. */
export function find(/** @type {XNode | null} */ n, /** @type {string} */ name) {
  if (!n) return null;
  for (const c of n.children) { if (c.name === name) return c; const d = find(c, name); if (d) return d; }
  return null;
}
export function findAll(/** @type {XNode | null} */ n, /** @type {string} */ name, /** @type {XNode[]} */ out = []) {
  if (!n) return out;
  for (const c of n.children) { if (c.name === name) out.push(c); findAll(c, name, out); }
  return out;
}
export const textOf = (/** @type {XNode | null} */ n) => (n ? n.text.trim() : '');

export const escapeXml = (/** @type {string} */ s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c] || c));
