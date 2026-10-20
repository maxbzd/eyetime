import test from 'node:test';
import assert from 'node:assert/strict';
import { setLocale, t, fmtDuration, resolveLocale } from '../../src/shared/i18n.js';

test('i18n: plurals, params and fallbacks', () => {
  setLocale('en');
  assert.equal(t('focus.start', { time: '25m' }), 'Start focus · 25m');
  assert.equal(t('insights.sessions', { n: 1 }), '1 session'); assert.equal(t('insights.sessions', { n: 3 }), '3 sessions');
  assert.equal(t('no.such.key'), 'no.such.key');
  setLocale('ru');
  assert.equal(t('insights.sessions', { n: 1 }), '1 сессия'); assert.equal(t('insights.sessions', { n: 3 }), '3 сессии'); assert.equal(t('insights.sessions', { n: 5 }), '5 сессий');
  assert.equal(t('insights.sessions', { n: 21 }), '21 сессия');
  setLocale('en');
});

test('i18n: duration formatting and locale resolution', () => {
  setLocale('en');
  assert.equal(fmtDuration(0), '0s'); assert.equal(fmtDuration(59), '59s'); assert.equal(fmtDuration(3600), '1h'); assert.equal(fmtDuration(5400), '1h\u00a030m');
  setLocale('ru'); assert.equal(fmtDuration(5400), '1ч\u00a030м'); setLocale('en');
  assert.equal(resolveLocale('auto', 'ru-RU'), 'ru'); assert.equal(resolveLocale('auto', 'uk'), 'ru'); assert.equal(resolveLocale('auto', 'de-DE'), 'en'); assert.equal(resolveLocale('ru', 'en-US'), 'ru');
});

test('fmtTime: true = 24-hour, false = 12-hour', async () => {
  const { fmtTime, setLocale } = await import('../../src/shared/i18n.js');
  setLocale('en');
  const d = new Date(2026, 0, 1, 15, 5), mid = new Date(2026, 0, 1, 0, 5);
  assert.equal(fmtTime(d, true), '15:05'); assert.equal(fmtTime(mid, true), '00:05');
  assert.match(fmtTime(d, false), /^3:05\sPM$/);
  assert.equal(fmtTime(d, null), fmtTime(d)); // follows the language
});
