// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The collector tells the owner instead of waiting to be opened: a short digest once a week, and a message when something needs a look (errors up, activity down, reports refused,
// a slow new tab). It reads the same statistics as the dashboard, through the same scorecard, so the two cannot disagree. It runs from a Cloudflare cron trigger (worker.js)
// and sends through a Telegram bot the owner makes; with no bot configured it sends nothing and only does the housekeeping (deleting what is too old).
// A message holds numbers and the names of figures, never an identifier or anything from an install.

import { computeStats } from './stats.js';
import { dayOf } from './limits.js';
import { feedbackSummary } from './feedback-stats.js';

/** The cron expression of the weekly digest (Monday, 06:00 UTC); the other trigger only looks for alerts. */
export const WEEKLY_CRON = '0 6 * * 1';
/** An alert is not repeated for this many days. */
export const ALERT_QUIET_DAYS = 3;
/** Installs that have not reported for this many days are deleted (an environment variable can change it, but not below 30). */
export const DEFAULT_RETENTION_DAYS = 400;

const T = {
  ru: {
    head: 'EyeTime · неделя {a} — {b}', active: 'Активны: {n}', activeChange: '{p} к прошлой неделе', fresh: 'Новых установок: {n}', star: 'Завершено сессий на активного: {v} (≈ {m} мин фокуса)',
    d7: 'Возврат на 2-й неделе: {v}', stick: 'Липкость: {v}', health: 'Состояние: {ok} в норме, {warn} внимание, {bad} плохо', look: 'Посмотрите: {list}', door: 'Приём отчётов за неделю: принято {a}, отклонено {r}', open: 'Панель: {url}', msgs: 'Сообщения: новых {n}, ждут ответа {w}', msgsTop: 'чаще всего просят: {theme} ({k})',
    na: 'мало данных', alertHead: '⚠ EyeTime: нужно посмотреть',
    sc: { speed: 'Скорость новой вкладки', finish: 'Сессии доходят до конца', early: 'Ранние остановки', err: 'Установки с ошибками', quick: 'Приток против оттока', upd: 'Люди на свежей версии', stick: 'Липкость', goal_d1: 'Цель: возврат на след. день', goal_d7: 'Цель: возврат на 2-й неделе', goal_d30: 'Цель: возврат на 5-й неделе', goal_act: 'Цель: первая сессия за неделю' },
    alerts: {
      errors: 'Ошибки: у {v} установок есть ошибки (цель не больше {t}).', drop: 'Активность упала: {now} против {before} на прошлой неделе ({p}).', ingest: 'Приём отчётов: {p} отчётов за неделю отклонено ({n} из {all}). Похоже, одна из версий шлёт неверный отчёт.',
      speed: 'Новая вкладка медленная: 9 из 10 открытий дольше {v} мс (цель {t} мс).',
    },
  },
  en: {
    head: 'EyeTime · week {a} — {b}', active: 'Active: {n}', activeChange: '{p} vs last week', fresh: 'New installs: {n}', star: 'Finished sessions per active install: {v} (about {m} min of focus)',
    d7: 'Back in week 2: {v}', stick: 'Stickiness: {v}', health: 'Health: {ok} fine, {warn} to watch, {bad} bad', look: 'Look at: {list}', door: 'Reports this week: {a} accepted, {r} refused', open: 'Dashboard: {url}', msgs: 'Messages: {n} new, {w} waiting for an answer', msgsTop: 'asked for most: {theme} ({k})',
    na: 'low data', alertHead: '⚠ EyeTime: needs a look',
    sc: { speed: 'New tab speed', finish: 'Sessions reach the end', early: 'Early stops', err: 'Installs with errors', quick: 'Inflow vs outflow', upd: 'People on the newest version', stick: 'Stickiness', goal_d1: 'Goal: back the next day', goal_d7: 'Goal: back in week 2', goal_d30: 'Goal: back in week 5', goal_act: 'Goal: first session in a week' },
    alerts: {
      errors: 'Errors: {v} of installs have errors (target at most {t}).', drop: 'Activity fell: {now} against {before} last week ({p}).', ingest: 'Reports: {p} of this week’s reports were refused ({n} of {all}). A version may be sending a wrong report.',
      speed: 'The new tab is slow: 9 of 10 opens take longer than {v} ms (target {t} ms).',
    },
  },
};
const fill = (/** @type {string} */ s, /** @type {Record<string, any>} */ v) => Object.entries(v).reduce((a, [k, x]) => a.split('{' + k + '}').join(String(x)), s);
const pct = (/** @type {number | null} */ x, d = 0) => (x == null ? '—' : (x * 100).toFixed(d) + '%');
const num = (/** @type {number | null} */ x, d = 1) => (x == null ? '—' : String(Math.round(x * 10 ** d) / 10 ** d));

/** The last two full weeks of the weekly active counts: [last, before] (null where there is none). */
function lastWeeks(/** @type {any} */ s) {
  const full = (s.weekly || []).filter((/** @type {any} */ w) => !w.partial);
  return { last: full.at(-1) || null, before: full.at(-2) || null };
}

/**
 * The weekly digest as text. `lang` is "ru" or "en"; `url` is the address of the dashboard (optional).
 * @param {any} s statistics from computeStats @param {{ lang?: string, url?: string, fb?: any }} [o] fb: feedbackSummary of the messages (optional)
 */
export function buildDigest(s, { lang = 'ru', url = '', fb = null } = {}) {
  const L = T[/** @type {'ru' | 'en'} */ (lang === 'en' ? 'en' : 'ru')], { last, before } = lastWeeks(s), lines = [];
  lines.push(fill(L.head, { a: last ? last.from.slice(5) : '', b: last ? last.to.slice(5) : '' }));
  if (last) lines.push(fill(L.active, { n: last.active }) + (before && before.active >= 20 ? ' (' + fill(L.activeChange, { p: (last.active >= before.active ? '+' : '−') + Math.abs(Math.round(((last.active - before.active) / before.active) * 100)) + '%' }) + ')' : ''));
  const lc = (s.lifecycle || []).filter((/** @type {any} */ w) => !w.partial).at(-1);
  if (lc) lines.push(fill(L.fresh, { n: lc.new }));
  if (s.northstar && s.northstar.value != null) lines.push(fill(L.star, { v: num(s.northstar.value, 2), m: num(s.northstar.minutes, 0) }));
  if (s.retention && s.retention.d7.n >= 20) lines.push(fill(L.d7, { v: pct(s.retention.d7.pct) }));
  if (s.engagement && s.engagement.dau_mau != null && s.engagement.mau >= 50) lines.push(fill(L.stick, { v: pct(s.engagement.dau_mau) }));
  const rows = s.scorecard || [], count = (/** @type {string} */ st) => rows.filter((/** @type {any} */ r) => r.status === st).length;
  if (rows.length) lines.push(fill(L.health, { ok: count('good'), warn: count('warn'), bad: count('bad') }));
  const look = rows.filter((/** @type {any} */ r) => r.status === 'warn' || r.status === 'bad').map((/** @type {any} */ r) => (L.sc[r.id] || r.id));
  if (look.length) lines.push(fill(L.look, { list: look.join(', ') }));
  if (s.ingest) lines.push(fill(L.door, { a: s.ingest.accepted_7d, r: s.ingest.rejected_7d }));
  if (fb && fb.total) {
    lines.push(fill(L.msgs, { n: fb.new, w: fb.waiting_reply }));
    const top = (fb.ideas || []).find((/** @type {any} */ x) => x.open > 0);
    if (top && top.k >= 3) lines.push(fill(L.msgsTop, { theme: top.theme, k: top.k }));
  }
  if (url) lines.push(fill(L.open, { url }));
  return lines.join('\n');
}

/**
 * What needs a look now: [{ id, text }]. Each rule needs enough data to mean something, and says what it saw.
 * @param {any} s statistics from computeStats @param {string} [lang]
 */
export function findAlerts(s, lang = 'ru') {
  const L = T[/** @type {'ru' | 'en'} */ (lang === 'en' ? 'en' : 'ru')], out = /** @type {{ id: string, text: string }[]} */ ([]), by = Object.fromEntries((s.scorecard || []).map((/** @type {any} */ r) => [r.id, r]));
  if (by.err && by.err.status === 'bad') out.push({ id: 'errors', text: fill(L.alerts.errors, { v: pct(by.err.value), t: pct(by.err.target) }) });
  if (by.speed && by.speed.status === 'bad') out.push({ id: 'speed', text: fill(L.alerts.speed, { v: by.speed.value >= 100_000 ? 1000 : by.speed.value, t: by.speed.target }) });
  const { last, before } = lastWeeks(s);
  if (last && before && before.active >= 20 && last.active < before.active * 0.7) out.push({ id: 'drop', text: fill(L.alerts.drop, { now: last.active, before: before.active, p: '−' + Math.round((1 - last.active / before.active) * 100) + '%' }) });
  const ing = s.ingest;
  if (ing && ing.rejected_share_7d != null && ing.rejected_share_7d > 0.2 && ing.accepted_7d + ing.rejected_7d >= 20) out.push({ id: 'ingest', text: fill(L.alerts.ingest, { p: pct(ing.rejected_share_7d), n: ing.rejected_7d, all: ing.accepted_7d + ing.rejected_7d }) });
  return out;
}

/**
 * One run of the cron trigger: housekeeping, then (when a bot is configured) the weekly digest and any alert that has not been sent in the last few days.
 * @param {{ store: any, now: number, env: Record<string, any>, cron?: string, fetchImpl?: typeof fetch, feedback?: any }} o
 * @returns {Promise<{ purged: number | null, digest: boolean, alerts: string[], errors: string[], scrubbed?: { contacts: number, replies: number } }>}
 */
export async function runScheduled({ store, now, env, cron = '', fetchImpl = fetch, feedback = null }) {
  const out = { purged: /** @type {number | null} */ (null), digest: false, alerts: /** @type {string[]} */ ([]), errors: /** @type {string[]} */ ([]) };
  const weekly = cron === WEEKLY_CRON;
  const keep = Number(env.RETENTION_DAYS) >= 30 ? Number(env.RETENTION_DAYS) : DEFAULT_RETENTION_DAYS;
  if (weekly && store.purge) { try { out.purged = await store.purge(now, keep); } catch (e) { out.errors.push('purge'); } }
  // the messages to the maker: reply addresses are erased after 90 days and answers after they were handed over (the messages themselves stay until the owner or the person asks for them to go)
  if (weekly && feedback) { try { out.scrubbed = { contacts: await feedback.scrubContacts(now), replies: await feedback.scrubReplies(now) }; } catch { out.errors.push('scrub'); } }
  const token = env.TG_BOT_TOKEN, chat = env.TG_CHAT_ID;
  if (!token || !chat || !store.snapshot) return out;
  const lang = env.DIGEST_LANG === 'en' ? 'en' : 'ru';
  const send = async (/** @type {string} */ text) => {
    try {
      const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }) });
      return res.ok;
    } catch { return false; }
  };
  const s = computeStats(await store.snapshot(), now, { recentDays: 28 });
  let fbSum = null; if (feedback) { try { fbSum = feedbackSummary(await feedback.all(), now); } catch { /* the digest is not the messages */ } }
  if (weekly) { if (await send(buildDigest(s, { lang, url: env.DASH_URL || '', fb: fbSum }))) out.digest = true; else out.errors.push('digest'); }
  for (const a of findAlerts(s, lang)) {
    const key = 'alert:' + a.id, last = await store.getSetting(key), day = dayOf(now);
    if (last && (Date.parse(day) - Date.parse(last)) / 86_400_000 < ALERT_QUIET_DAYS) continue;
    if (await send(T[lang].alertHead + '\n' + a.text + (env.DASH_URL ? '\n' + env.DASH_URL : ''))) { await store.setSetting(key, day); out.alerts.push(a.id); } else out.errors.push('alert:' + a.id);
  }
  return out;
}
