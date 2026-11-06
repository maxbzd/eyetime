// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The weekly digest and the alerts: what they say, that they say it once, that a failed send is tried again, and that without a bot nothing leaves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDigest, findAlerts, runScheduled, WEEKLY_CRON } from '../../server/usage/digest.js';
import { computeStats } from '../../server/usage/stats.js';
import { makeDemoSnapshot } from '../../server/usage/demo-data.js';
import { MemoryStore } from '../../server/usage/memory-store.js';

const DAY = 86_400_000, NOW = Date.UTC(2026, 10, 20, 12);
const demoStore = () => { const s = new MemoryStore(); s.snapshot = async () => makeDemoSnapshot(NOW); return s; };
const bot = () => { const sent = []; return { sent, fetchImpl: async (url, init) => { sent.push({ url, body: JSON.parse(init.body) }); return { ok: true, status: 200 }; } }; };
const ENV = { TG_BOT_TOKEN: '123:abc', TG_CHAT_ID: '42', DASH_URL: 'https://c.example/' };

test('digest: the week in a few lines, in either language, with nothing that names an install', () => {
  const s = computeStats(makeDemoSnapshot(NOW), NOW, { recentDays: 28 });
  const ru = buildDigest(s, { lang: 'ru', url: 'https://c.example/' }), en = buildDigest(s, { lang: 'en' });
  assert.match(ru, /^EyeTime · неделя /); assert.match(ru, /Активны: \d+/); assert.match(ru, /Приём отчётов/); assert.match(ru, /Панель: https:\/\/c\.example\//);
  assert.match(en, /^EyeTime · week /); assert.match(en, /Active: \d+/); assert.ok(!/Dashboard:/.test(en), 'no address, no line');
  assert.ok(ru.split('\n').length >= 5 && ru.length < 900, 'short enough to read in a chat');
  assert.ok(!/[0-9a-f]{32}/.test(ru + en), 'no identifier');
  assert.match(ru, /Состояние: \d+ в норме/); assert.match(ru, /Посмотрите: /, 'the figures that are off are named');
  assert.equal(buildDigest(computeStats({ installs: [], firsts: [], weeks: [], flags: [] }, NOW), { lang: 'en' }).split('\n')[0].startsWith('EyeTime'), true, 'an empty collector still answers');
});

test('alerts: errors, a fall in activity, refused reports and a slow tab, each only with enough data', () => {
  const s = computeStats(makeDemoSnapshot(NOW), NOW, { recentDays: 28 });
  assert.ok(findAlerts(s, 'en').some((a) => a.id === 'errors'), 'the demo has far too many errors');
  const quiet = { scorecard: [{ id: 'err', status: 'good' }], weekly: [], ingest: { rejected_share_7d: 0.01, accepted_7d: 500, rejected_7d: 5 } };
  assert.deepEqual(findAlerts(quiet), []);
  const fall = { weekly: [{ partial: false, active: 100 }, { partial: false, active: 60 }, { partial: true, active: 5 }], scorecard: [], ingest: null };
  assert.deepEqual(findAlerts(fall, 'en').map((a) => a.id), ['drop']); assert.match(findAlerts(fall, 'en')[0].text, /60 against 100/);
  assert.deepEqual(findAlerts({ ...fall, weekly: [{ partial: false, active: 10 }, { partial: false, active: 2 }] }), [], 'ten people falling to two is not an alert');
  assert.deepEqual(findAlerts({ weekly: [], scorecard: [], ingest: { rejected_share_7d: 0.5, accepted_7d: 5, rejected_7d: 5 } }), [], 'ten reports are too few to blame a version');
  assert.deepEqual(findAlerts({ weekly: [], scorecard: [], ingest: { rejected_share_7d: 0.5, accepted_7d: 50, rejected_7d: 50 } }, 'en').map((a) => a.id), ['ingest']);
  assert.deepEqual(findAlerts({ weekly: [], scorecard: [{ id: 'speed', status: 'bad', value: 100_000, target: 500 }], ingest: null }, 'en').map((a) => a.id), ['speed']);
});

test('scheduled: without a bot nothing is sent, and the weekly run still deletes what is too old', async () => {
  const store = new MemoryStore(); let purged = null; const real = store.purge.bind(store); store.purge = async (now, days) => { purged = days; return real(now, days); };
  const { sent, fetchImpl } = bot();
  const r = await runScheduled({ store, now: NOW, env: {}, cron: WEEKLY_CRON, fetchImpl });
  assert.deepEqual([sent.length, r.digest, r.alerts, purged], [0, false, [], 400]);
  await runScheduled({ store, now: NOW, env: { RETENTION_DAYS: '90' }, cron: WEEKLY_CRON, fetchImpl }); assert.equal(purged, 90);
  await runScheduled({ store, now: NOW, env: { RETENTION_DAYS: '5' }, cron: WEEKLY_CRON, fetchImpl }); assert.equal(purged, 400, 'never below thirty days');
  purged = null; await runScheduled({ store, now: NOW, env: {}, cron: '30 */6 * * *', fetchImpl }); assert.equal(purged, null, 'only the weekly run deletes');
});

test('scheduled: the digest goes once a week, an alert once in three days, and a failed send is tried again', async () => {
  const store = demoStore(), { sent, fetchImpl } = bot();
  const week = await runScheduled({ store, now: NOW, env: ENV, cron: WEEKLY_CRON, fetchImpl });
  assert.equal(week.digest, true); assert.ok(sent[0].url.startsWith('https://api.telegram.org/bot123:abc/sendMessage')); assert.equal(sent[0].body.chat_id, '42'); assert.match(sent[0].body.text, /^EyeTime · неделя/);
  assert.ok(week.alerts.includes('errors'), 'and the alert that was due');
  const six = await runScheduled({ store, now: NOW + 6 * 3_600_000, env: ENV, cron: '30 */6 * * *', fetchImpl });
  assert.deepEqual(six.alerts, [], 'not again six hours later'); assert.equal(six.digest, false);
  const later = await runScheduled({ store, now: NOW + 4 * DAY, env: ENV, cron: '30 */6 * * *', fetchImpl });
  assert.ok(later.alerts.includes('errors'), 'again after the quiet days');
  // a failing send keeps the alert due
  const flaky = demoStore(); let down = true; const f2 = async () => ({ ok: !down, status: down ? 500 : 200 });
  const failed = await runScheduled({ store: flaky, now: NOW, env: ENV, cron: '30 */6 * * *', fetchImpl: f2 });
  assert.ok(failed.errors.some((e) => e.startsWith('alert:')) && failed.alerts.length === 0);
  down = false; const again = await runScheduled({ store: flaky, now: NOW + 3_600_000, env: ENV, cron: '30 */6 * * *', fetchImpl: f2 });
  assert.ok(again.alerts.includes('errors'), 'sent when the bot is back');
  const thrown = await runScheduled({ store: demoStore(), now: NOW, env: ENV, cron: WEEKLY_CRON, fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal(thrown.digest, false, 'an offline bot is not a crash');
});
