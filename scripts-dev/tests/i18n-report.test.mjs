import test from 'node:test';
import assert from 'node:assert/strict';
import { review } from '../i18n-report.mjs';

const base = { a: 'Start the focus session', b: 'Done', c: 'Save…', d: 'Add a site, e.g. example.com', e: 'Short text', f: 'Hello {n} world', g: 'Plain' };
const signals = (lang, dict) => review(lang, dict, base).map((x) => `${x.key}:${x.signal}`).sort();

test('i18n report: an untranslated phrase, a lost ellipsis, English words left in a non-Latin text, a string far too long, and stray spaces are each noticed', () => {
  const dict = { a: 'Start the focus session', b: 'Done', c: 'Сохранить', d: 'Добавьте сайт, например example.com', e: 'Короткий текст который невероятно длинный по сравнению с оригиналом', f: 'Привет  {n} мир', g: 'Plain' };
  const s = signals('ru', dict);
  assert.ok(s.includes('a:same'), 'a phrase that is the same as the English one');
  assert.ok(!s.includes('b:same') && !s.includes('g:same'), 'one short word that is the same is a cognate, not a finding');
  assert.ok(s.includes('c:ending'), 'the ellipsis was lost');
  assert.ok(!s.includes('d:latin'), 'example.com is a name, not a left-over English word');
  assert.ok(s.includes('e:long'), 'a short string made much longer');
  assert.ok(s.includes('f:spaces'), 'a doubled space');
});

test('i18n report: a good translation has nothing flagged, and a missing key is not this report\'s business', () => {
  const good = { a: 'Начать сессию фокуса', b: 'Готово', c: 'Сохранить…', d: 'Добавьте сайт, например example.com', e: 'Короткий текст', f: 'Привет {n} мир' };
  assert.deepEqual(review('ru', good, base), []);
});

test('i18n report: plural forms are compared form by form', () => {
  const b = { n: { one: '{n} session today', other: '{n} sessions today' } };
  assert.deepEqual(review('de', { n: { one: '{n} Sitzung heute', other: '{n} Sitzungen heute' } }, b), []);
  assert.deepEqual(review('de', { n: { one: '{n} session today', other: '{n} Sitzungen heute' } }, b).map((x) => x.signal), ['same']);
});
