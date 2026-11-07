// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// What the connections accept from a server: an answer of a sensible size, XML that is not a tower, and a password only over https.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bodyText } from '../../src/shared/sync/http.js';
import { parseXml } from '../../src/shared/sync/xml.js';
import { assertSecure } from '../../src/shared/sync/providers/caldav.js';

const streamOf = (chunks, headers = {}) => new Response(new ReadableStream({ start(c) { for (const x of chunks) c.enqueue(new TextEncoder().encode(x)); c.close(); } }), { headers });

test('an answer is read up to a limit, and a server that sends more is refused', async () => {
  assert.equal(await bodyText(streamOf(['ab', 'cd'])), 'abcd');
  await assert.rejects(bodyText(streamOf(['x'.repeat(600), 'y'.repeat(600)]), 1000), /too big/);
  await assert.rejects(bodyText(streamOf(['x'], { 'content-length': '999999999' })), /too big/, 'by the length it announces, before a byte is read');
});

test('XML nested tens of thousands of levels deep is refused, a real answer is not', () => {
  assert.ok(parseXml('<d:multistatus><d:response><d:href>/a</d:href></d:response></d:multistatus>'));
  assert.throws(() => parseXml('<a>'.repeat(100) + 'x'), /too deep/);
});

test('a CalDAV password is never sent in the open over a network', () => {
  for (const ok of ['https://caldav.icloud.com', 'https://cloud.example.org/remote.php/dav', 'http://localhost:8080/', 'http://127.0.0.1:5232/', 'http://[::1]/']) assert.doesNotThrow(() => assertSecure(ok), ok);
  for (const bad of ['http://nas.local/dav', 'http://192.168.1.5/dav', 'http://example.org/', 'ftp://x/', 'not a url', '//x']) assert.throws(() => assertSecure(bad), bad);
});
