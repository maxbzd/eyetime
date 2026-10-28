import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlace, normalizeWeather, unitFor, forecastUrl, geocodeUrl, parseForecast, parseGeocode, describeCode, WEATHER_ORIGINS } from '../../src/shared/weather.js';

test('normalizeWeather: off by default, garbage becomes a safe value', () => {
  assert.deepEqual(normalizeWeather(undefined), { on: false, place: null, unit: 'auto', effect: true });
  assert.deepEqual(normalizeWeather({ on: 'yes', place: { name: 'x', lat: 999, lon: 1 }, unit: 'k', effect: false }), { on: false, place: null, unit: 'auto', effect: false });
  const ok = normalizeWeather({ on: true, place: { name: '  Kyiv ', lat: 50.4501234, lon: 30.5234567 }, unit: 'f' });
  assert.deepEqual(ok, { on: true, place: { name: 'Kyiv', lat: 50.45, lon: 30.52 }, unit: 'f', effect: true });
});

test('normalizePlace: coordinates are rounded to about a kilometre and bounded', () => {
  assert.equal(normalizePlace({ name: 'A', lat: 91, lon: 0 }), null);
  assert.equal(normalizePlace({ name: '', lat: 1, lon: 1 }), null);
  assert.equal(normalizePlace({ name: 'A', lat: '1', lon: 1 }), null);
  assert.deepEqual(normalizePlace({ name: 'A'.repeat(200), lat: -33.8688, lon: 151.2093 }), { name: 'A'.repeat(80), lat: -33.87, lon: 151.21 });
});

test('unitFor: Fahrenheit only where it is used, unless chosen', () => {
  assert.equal(unitFor({ unit: 'auto' }, 'en-US'), 'f');
  assert.equal(unitFor({ unit: 'auto' }, 'en-GB'), 'c');
  assert.equal(unitFor({ unit: 'auto' }, 'ru'), 'c');
  assert.equal(unitFor({ unit: 'auto' }, 'es_US'), 'f');
  assert.equal(unitFor({ unit: 'auto' }, ''), 'c');
  assert.equal(unitFor({ unit: 'c' }, 'en-US'), 'c');
  assert.equal(unitFor({ unit: 'f' }, 'ru'), 'f');
});

test('the request addresses only name Open-Meteo and carry nothing but the place', () => {
  const u = new URL(forecastUrl({ name: 'Kyiv', lat: 50.45, lon: 30.52 }, 'f'));
  assert.equal(u.origin, 'https://api.open-meteo.com');
  assert.equal(u.searchParams.get('latitude'), '50.45'); assert.equal(u.searchParams.get('temperature_unit'), 'fahrenheit');
  assert.ok(!u.search.includes('Kyiv'));
  const g = new URL(geocodeUrl('  São Paulo & co ', 'pt-BR'));
  assert.equal(g.origin, 'https://geocoding-api.open-meteo.com'); assert.equal(g.searchParams.get('name'), 'São Paulo & co'); assert.equal(g.searchParams.get('language'), 'pt');
  assert.ok(WEATHER_ORIGINS.every((o) => /^https:\/\/[a-z-]+\.open-meteo\.com\/\*$/.test(o)));
});

test('parseForecast: the real shape is read, a wrong one is refused', () => {
  const j = { current: { temperature_2m: 7.6, apparent_temperature: 4.2, weather_code: 61, is_day: 0 }, daily: { temperature_2m_max: [9.4], temperature_2m_min: [3.1], precipitation_probability_max: [80] } };
  assert.deepEqual(parseForecast(j), { temp: 8, feels: 4, code: 61, day: false, hi: 9, lo: 3, rain: 80 });
  assert.equal(parseForecast({}), null); assert.equal(parseForecast(null), null);
  assert.equal(parseForecast({ current: { temperature_2m: 'hot', weather_code: 1 } }), null);
  assert.equal(parseForecast({ current: { temperature_2m: 500, weather_code: 1 } }), null);
  assert.deepEqual(parseForecast({ current: { temperature_2m: 1, weather_code: 3, is_day: 1 } }), { temp: 1, feels: null, code: 3, day: true, hi: null, lo: null, rain: null });
});

test('parseGeocode: up to six valid cities with a readable region', () => {
  const r = Array.from({ length: 9 }, (_, i) => ({ name: 'Town' + i, latitude: 10 + i, longitude: 20, admin1: 'Region', country: 'Land' }));
  r.push({ name: 'Bad', latitude: 999, longitude: 0 }, null);
  const out = parseGeocode({ results: r });
  assert.equal(out.length, 6); assert.deepEqual(out[0], { name: 'Town0', lat: 10, lon: 20, where: 'Region, Land' });
  assert.deepEqual(parseGeocode({}), []); assert.deepEqual(parseGeocode(null), []);
  assert.equal(parseGeocode({ results: [{ name: 'Paris', latitude: 48.85, longitude: 2.35, admin1: 'Paris', country: 'France' }] })[0].where, 'France');
});

test('describeCode: every WMO code group has a kind, an icon and the right effect', () => {
  const fx = (c) => describeCode(c).fx;
  assert.equal(describeCode(0).ico, 'sun'); assert.equal(describeCode(0, false).ico, 'moon'); assert.equal(describeCode(2, false).ico, 'cloud-moon');
  for (const c of [51, 53, 55, 61, 63, 65, 66, 80, 81, 82, 95, 96, 99]) assert.equal(fx(c), 'rain', 'rain for ' + c);
  for (const c of [71, 73, 75, 77, 85, 86]) assert.equal(fx(c), 'snow', 'snow for ' + c);
  for (const c of [0, 1, 2, 3, 45, 48]) assert.equal(fx(c), null, 'no effect for ' + c);
  assert.equal(describeCode(45).kind, 'fog'); assert.equal(describeCode(96).kind, 'thunder'); assert.equal(describeCode(-5).kind, 'cloud');
});
