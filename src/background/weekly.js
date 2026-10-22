// Monday-morning digest of the last completed week, shown as a notification (can be switched off).

import { getSettings, getDays, getRaw, setRaw, getCollection } from '../shared/storage.js';
import { mondayKey, weekProgress } from '../shared/week.js';
import { projectTotals } from '../shared/projects.js';
import { dayKey, weekStart, addDays } from '../shared/time.js';
import { makeClassifier } from '../shared/classify.js';
import { summarize, delta } from '../shared/stats.js';
import { fmtDuration, resolveLocale, setLocale, t } from '../shared/i18n.js';

const weekKeys = (monday) => Array.from({ length: 7 }, (_, i) => dayKey(addDays(monday, i)));

export async function maybeSendWeeklyReport(now = new Date()) {
  const settings = await getSettings();
  if (!settings.weeklyReport) return;
  const monday = weekStart(now);
  const at = new Date(monday); at.setHours(9, 0, 0, 0);
  if (now < at) return;
  const thisWeek = dayKey(monday);
  const { lastWeekly } = await getRaw('lastWeekly');
  if (lastWeekly === thisWeek) return;
  await setRaw({ lastWeekly: thisWeek });

  const last = addDays(monday, -7), prev = addDays(monday, -14);
  const { classify } = makeClassifier(settings);
  const lastEntries = await getDays(weekKeys(last));
  const cur = summarize(lastEntries, classify);
  const before = summarize(await getDays(weekKeys(prev)), classify);
  if (cur.total < 600) return;

  setLocale(resolveLocale(settings.language));
  const lines = [];
  const d = delta(cur.total, before.total);
  lines.push(t('weekly.total', { time: fmtDuration(cur.total) }) + (d === null ? '' : ` (${d > 0 ? '+' : ''}${d}%)`));
  if (cur.distracting >= 600) lines.push(t('weekly.distracting', { time: fmtDuration(cur.distracting) }));
  if (cur.focusSessions) lines.push(t('weekly.focus', { n: cur.focusSessions, time: fmtDuration(cur.focusSec) }));
  const lastKey = mondayKey(last);
  const plans = [await getCollection('weekPlan', null), await getCollection('weekPlanPrev', null)];
  const wp = weekProgress(plans.find((x) => x && x.week === lastKey) || null, lastKey);
  if (wp.total) lines.push(t('weekly.goals', { done: wp.done, total: wp.total }));
  const top = projectTotals(lastEntries).find((r) => r.tag && r.sec >= 600);
  if (top) lines.push(t('weekly.project', { tag: top.tag, time: fmtDuration(top.sec) }));
  if (cur.topSites[0]) lines.push(t('weekly.top', { sites: cur.topSites.slice(0, 3).map((s) => s.host).join(', ') }));
  await chrome.notifications.create('weekly', { type: 'basic', iconUrl: 'icons/icon128.png', title: t('weekly.title'), message: lines.join('\n') });
}

chrome.notifications.onClicked.addListener((id) => {
  if (id === 'weekly') { chrome.notifications.clear(id); chrome.tabs.create({ url: chrome.runtime.getURL('src/insights/insights.html?range=7') }); }
});
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'tick') maybeSendWeeklyReport(); });
