// Optional desktop companion (see /companion). Off by default; when enabled in Settings → Tracking the worker
// pulls aggregated per-app seconds from http://127.0.0.1:8765 using a pairing token. Read-only: the companion
// can never change browser behaviour, and the extension never sends anything to it.

import { getSettings, updateDay } from '../shared/storage.js';
import { dayKey } from '../shared/time.js';

const BASE = 'http://127.0.0.1:8765';

export async function pullCompanion() {
  const { companion } = await getSettings();
  if (!companion.enabled || !companion.token) return { state: 'off' };
  try {
    const res = await fetch(`${BASE}/v1/today`, { headers: { Authorization: `Bearer ${companion.token}` }, cache: 'no-store' });
    if (res.status === 401) return { state: 'unauthorized' };
    if (!res.ok) return { state: 'error' };
    const data = await res.json();
    if (data.date === dayKey() && data.apps && typeof data.apps === 'object') {
      await updateDay(data.date, (day) => {
        for (const [app, sec] of Object.entries(data.apps)) if (typeof sec === 'number' && sec >= 0) day.a[String(app).slice(0, 80)] = Math.max(day.a[app] || 0, Math.round(sec));
      });
    }
    return { state: 'ok', app: data.activeApp || null };
  } catch { return { state: 'offline' }; }
}

chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'tick') pullCompanion(); });
