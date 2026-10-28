// Loading the weather for Home: one request at a time, kept for half an hour, and the last good answer is shown when the network is away.
// It asks Open-Meteo only when the person has turned the weather on, chosen a city and granted access (Settings → General → Weather).

import { getRaw, setRaw, getSettings } from '../shared/storage.js';
import { normalizeWeather, unitFor, forecastUrl, parseForecast, WEATHER_ORIGINS, WEATHER_TTL } from '../shared/weather.js';

const KEY = 'weatherCache';
let inflight = null;

export async function hasAccess() {
  try { return await chrome.permissions.contains({ origins: WEATHER_ORIGINS }); } catch { return false; }
}

/**
 * @typedef {{ temp: number, feels: number | null, code: number, day: boolean, hi: number | null, lo: number | null, rain: number | null }} Forecast
 * @returns {Promise<{ ok: true, data: Forecast, unit: 'c' | 'f', place: { name: string, lat: number, lon: number }, stale: boolean } | { ok: false, why: 'off' | 'place' | 'access' | 'net' }>}
 */
export function loadWeather(force = false) {
  if (!inflight) inflight = fetchWeather(force).finally(() => { inflight = null; });
  return inflight;
}

async function fetchWeather(force) {
  const w = normalizeWeather((await getSettings()).weather);
  if (!w.on) return { ok: false, why: 'off' };
  if (!w.place) return { ok: false, why: 'place' };
  const unit = unitFor(w, navigator.language), place = w.place;
  const cache = (await getRaw(KEY))[KEY];
  const same = cache && cache.lat === place.lat && cache.lon === place.lon && cache.unit === unit && parseForecast({ current: { temperature_2m: cache.data && cache.data.temp, weather_code: cache.data && cache.data.code } });
  if (same && !force && Date.now() - cache.at < WEATHER_TTL) return { ok: true, data: cache.data, unit, place, stale: false };
  if (!(await hasAccess())) return { ok: false, why: 'access' };
  try {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch(forecastUrl(place, unit), { signal: ctl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' }).finally(() => clearTimeout(timer));
    if (!res.ok) throw new Error('http ' + res.status);
    const data = parseForecast(await res.json());
    if (!data) throw new Error('unexpected answer');
    await setRaw({ [KEY]: { at: Date.now(), lat: place.lat, lon: place.lon, unit, data } });
    return { ok: true, data, unit, place, stale: false };
  } catch {
    return same ? { ok: true, data: cache.data, unit, place, stale: true } : { ok: false, why: 'net' };
  }
}
