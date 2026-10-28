import test from 'node:test';
import assert from 'node:assert/strict';
import { QUOTES, QUOTE_AUTHORS, QUOTE_CONTEXTS } from '../../src/shared/quotes.js';
import { pickQuote, renderQuote, quotesAllowed, hashSeed } from '../../src/shared/quotepick.js';
import { LOCALES } from '../../src/shared/locales/index.js';

const LANGS = Object.keys(LOCALES);

test('every quote exists in every interface language, with its own text', () => {
  assert.equal(LANGS.length, 11);
  for (const q of QUOTES) {
    for (const l of LANGS) {
      const t = q.t[l];
      assert.ok(typeof t === 'string' && t.trim().length >= 8, `${q.id} is missing in ${l}`);
      assert.ok(t.length <= 220, `${q.id} (${l}) is too long for a line on Home: ${t.length}`);
      assert.ok(!/^[“”"«»„「]/.test(t) && !/[“”"«»「」]$/.test(t), `${q.id} (${l}) carries its own quotation marks (they are added when shown)`);
      assert.ok(!/\{|\}|\n/.test(t), `${q.id} (${l}) has stray markup`);
    }
    // not one text copied into several languages (each language is written separately); a few short ones may coincide in Latin-script languages
    const nonLatin = ['ru', 'uk', 'zh', 'ja'];
    for (const l of nonLatin) assert.notEqual(q.t[l], q.t.en, `${q.id}: ${l} equals the English text`);
    const distinct = new Set(LANGS.map((l) => q.t[l])).size;
    assert.ok(distinct >= 9, `${q.id}: only ${distinct} different texts across ${LANGS.length} languages`);
  }
});

test('ids are unique, authors exist in every language, contexts are known', () => {
  assert.equal(new Set(QUOTES.map((q) => q.id)).size, QUOTES.length);
  for (const q of QUOTES) {
    assert.ok(q.ctx.length && q.ctx.every((c) => QUOTE_CONTEXTS.includes(c)), q.id + ' has an unknown place');
    if (q.by) { assert.ok(QUOTE_AUTHORS[q.by], q.id + ': unknown author'); for (const l of LANGS) assert.ok(QUOTE_AUTHORS[q.by][l], `${q.by} has no name in ${l}`); }
  }
  for (const by of Object.keys(QUOTE_AUTHORS)) assert.ok(QUOTES.some((q) => q.by === by), by + ' is not used');
});

test('each place has enough quotes that it does not repeat too soon', () => {
  const n = (c) => QUOTES.filter((q) => q.ctx.includes(c)).length;
  assert.ok(n('day') >= 15 && n('start') >= 8 && n('pause') >= 6 && n('rest') >= 3, JSON.stringify(QUOTE_CONTEXTS.map(n)));
});

test('a quote is chosen the same way for the same seed, and never the same twice in a row when it can be avoided', () => {
  assert.equal(pickQuote('day', { seed: '2026-10-28day' }).id, pickQuote('day', { seed: '2026-10-28day' }).id);
  const ids = new Set(Array.from({ length: 60 }, (_, i) => pickQuote('day', { seed: 'd' + i }).id));
  assert.ok(ids.size >= 12, 'the daily pick should spread over the list: ' + ids.size);
  const first = pickQuote('pause', { seed: 'x' });
  assert.notEqual(pickQuote('pause', { seed: 'x', avoid: first.id }).id, first.id);
  assert.equal(pickQuote('nowhere', {}), null);
  assert.equal(hashSeed('a'), hashSeed('a')); assert.notEqual(hashSeed('a'), hashSeed('b'));
});

test('quotes are written with the marks of each language and the author in that language', () => {
  const q = QUOTES.find((x) => x.id === 'seneca-waste');
  assert.deepEqual([renderQuote(q, 'ru').text[0], renderQuote(q, 'ru').author], ['«', 'Сенека']);
  assert.equal(renderQuote(q, 'de').text[0], '„'); assert.equal(renderQuote(q, 'ja').text[0], '「'); assert.equal(renderQuote(q, 'en').text[0], '“');
  assert.equal(renderQuote(q, 'ja').author, 'セネカ'); assert.equal(renderQuote(q, 'fr').author, 'Sénèque');
  assert.equal(renderQuote(q, 'xx').text[0], '“'); // an unknown language falls back to English
  const tip = renderQuote(QUOTES.find((x) => !x.by), 'ru');
  assert.equal(tip.author, null); assert.equal(tip.tip, true); assert.ok(!/^[«“]/.test(tip.text)); // an EyeTime tip is not put in quotation marks
});

test('quotes are shown only where the settings allow', () => {
  const on = { on: true, home: true, pause: true, rest: false, start: false };
  assert.equal(quotesAllowed(on, 'day'), true); assert.equal(quotesAllowed(on, 'pause'), true);
  assert.equal(quotesAllowed(on, 'rest'), false); assert.equal(quotesAllowed(on, 'start'), false);
  assert.equal(quotesAllowed({ ...on, on: false }, 'day'), false); assert.equal(quotesAllowed(undefined, 'day'), false);
});
