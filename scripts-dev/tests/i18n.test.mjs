// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
import test from 'node:test';
import assert from 'node:assert/strict';
import { setLocale, t, fmtDuration, resolveLocale } from '../../src/shared/i18n.js';

test('i18n: plurals, params and fallbacks', async () => {
  await setLocale('en');
  assert.equal(t('focus.start', { time: '25m' }), 'Start focus · 25m');
  assert.equal(t('insights.sessions', { n: 1 }), '1 session'); assert.equal(t('insights.sessions', { n: 3 }), '3 sessions');
  assert.equal(t('no.such.key'), 'no.such.key');
  await setLocale('ru');
  assert.equal(t('insights.sessions', { n: 1 }), '1 сессия'); assert.equal(t('insights.sessions', { n: 3 }), '3 сессии'); assert.equal(t('insights.sessions', { n: 5 }), '5 сессий');
  assert.equal(t('insights.sessions', { n: 21 }), '21 сессия');
  await setLocale('en');
});

test('i18n: duration formatting and locale resolution', async () => {
  await setLocale('en');
  assert.equal(fmtDuration(0), '0s'); assert.equal(fmtDuration(59), '59s'); assert.equal(fmtDuration(3600), '1h'); assert.equal(fmtDuration(5400), '1h\u00a030m');
  await setLocale('ru'); assert.equal(fmtDuration(5400), '1ч\u00a030м'); await setLocale('de'); assert.equal(fmtDuration(5400), '1h\u00a030min'); await setLocale('en');
  assert.equal(resolveLocale('auto', 'ru-RU'), 'ru'); assert.equal(resolveLocale('auto', 'uk'), 'uk'); assert.equal(resolveLocale('auto', 'it-IT'), 'it'); assert.equal(resolveLocale('auto', 'pl'), 'pl'); assert.equal(resolveLocale('auto', 'zh-CN'), 'zh'); assert.equal(resolveLocale('auto', 'zh-TW'), 'zh'); assert.equal(resolveLocale('auto', 'ko-KR'), 'en'); assert.equal(resolveLocale('auto', 'de-DE'), 'de'); assert.equal(resolveLocale('auto', 'es-MX'), 'es'); assert.equal(resolveLocale('auto', 'fr-CA'), 'fr'); assert.equal(resolveLocale('auto', 'pt-BR'), 'pt'); assert.equal(resolveLocale('auto', 'ja-JP'), 'ja'); assert.equal(resolveLocale('ru', 'en-US'), 'ru');
});

test('fmtTime: true = 24-hour, false = 12-hour', async () => {
  const { fmtTime, setLocale } = await import('../../src/shared/i18n.js');
  await setLocale('en');
  const d = new Date(2026, 0, 1, 15, 5), mid = new Date(2026, 0, 1, 0, 5);
  assert.equal(fmtTime(d, true), '15:05'); assert.equal(fmtTime(mid, true), '00:05');
  assert.match(fmtTime(d, false), /^3:05\sPM$/);
  assert.equal(fmtTime(d, null), fmtTime(d)); // follows the language
});

test('i18n: a language is read once, an unknown or unreadable one leaves English, and the data files are the translations', async () => {
  const { LOCALES, LANGUAGES } = await import('../../src/shared/locales/index.js');
  const { LANGUAGES: names } = await import('../../src/shared/i18n.js');
  const fs = await import('node:fs');
  assert.deepEqual(names, LANGUAGES);
  await setLocale('ru'); assert.equal(t('common.cancel'), LOCALES.ru['common.cancel']);
  await setLocale('xx'); assert.equal(t('common.cancel'), LOCALES.en['common.cancel'], 'an unknown code is English');
  await setLocale('__proto__'); assert.equal(t('common.cancel'), LOCALES.en['common.cancel'], 'a key of Object.prototype is not a language');
  // every language but English has a data file, and each one parses to exactly the translation the .js file holds
  for (const code of Object.keys(LOCALES)) {
    const file = new URL(`../../src/shared/locales/data/${code}.json`, import.meta.url);
    if (code === 'en') { assert.equal(fs.existsSync(file), false, 'English is code, not data'); continue; }
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), LOCALES[code], code);
  }
  await setLocale('en');
});

test('i18n: in a browser the words come from the extension file, and a file that cannot be read leaves English', async () => {
  const { setLocale: set, t: tr, getLocale } = await import('../../src/shared/i18n.js?browser');
  const asked = [];
  globalThis.chrome = { runtime: { getURL: (p) => 'chrome-extension://x/' + p } };
  globalThis.fetch = async (url) => { asked.push(url); return url.endsWith('/de.json') ? { ok: true, json: async () => ({ 'common.cancel': 'Abbrechen' }) } : { ok: false, json: async () => ({}) }; };
  try {
    await set('de'); assert.equal(tr('common.cancel'), 'Abbrechen'); assert.equal(getLocale(), 'de');
    await set('de'); assert.equal(asked.length, 1, 'read once');
    await set('fr'); assert.equal(getLocale(), 'en', 'a file that is not there leaves English'); assert.equal(asked.length, 2);
    await Promise.all([set('es'), set('es')]); assert.equal(asked.filter((u) => u.endsWith('/es.json')).length, 1, 'two at once ask once (or at most twice, never an error)');
  } finally { delete globalThis.chrome; delete globalThis.fetch; }
});
