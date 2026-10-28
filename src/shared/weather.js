// Optional weather (off until the person turns it on). Open-Meteo needs no key and no account; the only thing sent is the rounded coordinates of the chosen city.
// Pure helpers: validation, request addresses, what the answer means. Fetching and caching are in newtab/weather.js.

export const WEATHER_ORIGINS = ['https://api.open-meteo.com/*', 'https://geocoding-api.open-meteo.com/*'];
export const WEATHER_TTL = 30 * 60_000;
export const WEATHER_UNITS = ['auto', 'c', 'f'];
/** Regions that use Fahrenheit. */
const FAHRENHEIT = new Set(['US', 'LR', 'MM', 'BS', 'BZ', 'KY', 'PW']);

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null);

/** A chosen city: { name, lat, lon } or null. */
export function normalizePlace(p) {
  if (!p || typeof p !== 'object') return null;
  const name = str(p.name, 80), lat = num(p.lat, -90, 90), lon = num(p.lon, -180, 180);
  return name && lat !== null && lon !== null ? { name, lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 } : null;
}

export function normalizeWeather(w) {
  const c = w && typeof w === 'object' ? w : {};
  return { on: c.on === true, place: normalizePlace(c.place), unit: WEATHER_UNITS.includes(c.unit) ? c.unit : 'auto', effect: c.effect !== false };
}

/** 'c' or 'f': the chosen unit, or by the region of the browser language (en-US → Fahrenheit) when it is on auto. */
export function unitFor(w, lang = '') {
  if (w.unit === 'c' || w.unit === 'f') return w.unit;
  const region = (/^[a-z]{2,3}[-_]([A-Za-z]{2})\b/.exec(lang) || [])[1];
  return region && FAHRENHEIT.has(region.toUpperCase()) ? 'f' : 'c';
}

export function forecastUrl(place, unit) {
  const q = new URLSearchParams({
    latitude: String(place.lat), longitude: String(place.lon),
    current: 'temperature_2m,apparent_temperature,weather_code,is_day',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    temperature_unit: unit === 'f' ? 'fahrenheit' : 'celsius', timezone: 'auto', forecast_days: '1',
  });
  return 'https://api.open-meteo.com/v1/forecast?' + q.toString();
}
export function geocodeUrl(name, lang = 'en') {
  return 'https://geocoding-api.open-meteo.com/v1/search?' + new URLSearchParams({ name: name.trim().slice(0, 60), count: '6', language: String(lang).slice(0, 2), format: 'json' }).toString();
}

/** The parts of an Open-Meteo forecast the app uses, or null if the answer is not what was asked for. */
export function parseForecast(j) {
  const c = j && j.current, d = j && j.daily;
  if (!c || typeof c !== 'object') return null;
  const temp = num(c.temperature_2m, -90, 70), code = num(c.weather_code, 0, 99);
  if (temp === null || code === null) return null;
  const first = (a) => (Array.isArray(a) ? num(a[0], -90, 70) : null);
  const rain = d && Array.isArray(d.precipitation_probability_max) ? num(d.precipitation_probability_max[0], 0, 100) : null;
  return { temp: Math.round(temp), feels: num(c.apparent_temperature, -90, 70) === null ? null : Math.round(c.apparent_temperature), code, day: c.is_day !== 0, hi: first(d && d.temperature_2m_max) === null ? null : Math.round(d.temperature_2m_max[0]), lo: first(d && d.temperature_2m_min) === null ? null : Math.round(d.temperature_2m_min[0]), rain };
}

/** The cities of a geocoding answer: up to six, each { name, lat, lon, where } with `where` = region, country. */
export function parseGeocode(j) {
  const list = j && Array.isArray(j.results) ? j.results : [];
  const out = [];
  for (const r of list) {
    const place = normalizePlace({ name: r && r.name, lat: r && r.latitude, lon: r && r.longitude });
    if (!place) continue;
    out.push({ ...place, where: [str(r.admin1, 60), str(r.country, 60)].filter((x) => x && x !== place.name).join(', ') });
    if (out.length === 6) break;
  }
  return out;
}

/** The night versions of two icons (written as `icon:` so the icon build keeps them). */
const NIGHT = { sun: { icon: 'moon' }, 'cloud-sun': { icon: 'cloud-moon' } };

/**
 * What the weather code means (WMO codes): a kind for the words and the icon, and which effect to draw over the photo.
 * @returns {{ kind: 'clear'|'partly'|'cloud'|'fog'|'drizzle'|'rain'|'snow'|'thunder', fx: 'rain'|'snow'|null, ico: string }}
 */
export function describeCode(code, day = true) {
  if (code === 0 || code === 1) return { kind: 'clear', fx: null, ico: day ? 'sun' : NIGHT.sun.icon };
  if (code === 2) return { kind: 'partly', fx: null, ico: day ? 'cloud-sun' : NIGHT['cloud-sun'].icon };
  if (code === 3) return { kind: 'cloud', fx: null, ico: 'cloud' };
  if (code === 45 || code === 48) return { kind: 'fog', fx: null, ico: 'cloud-fog' };
  if (code >= 51 && code <= 57) return { kind: 'drizzle', fx: 'rain', ico: 'cloud-drizzle' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { kind: 'rain', fx: 'rain', ico: 'cloud-rain' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { kind: 'snow', fx: 'snow', ico: 'cloud-snow' };
  if (code >= 95) return { kind: 'thunder', fx: 'rain', ico: 'cloud-lightning' };
  return { kind: 'cloud', fx: null, ico: 'cloud' };
}
