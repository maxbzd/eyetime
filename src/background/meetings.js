// Meetings from the imported / subscribed calendars: a heads-up when a running focus session would run into one, and an optional quiet
// mode (no eye-break notices, no chimes) while a meeting is on. Driven by the 30-second `tick` alarm; nothing is kept in memory.

import { getSettings, getRaw, setRaw } from '../shared/storage.js';
import { isFocusActive } from '../shared/blocking.js';
import { upcomingMeeting, inMeeting } from '../shared/calstore.js';
import { dayKey } from '../shared/time.js';
import { resolveLocale, setLocale, t } from '../shared/i18n.js';

const ICON = 'icons/icon128.png';
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

/** True while a meeting is on and the user asked for quiet. */
export async function meetingQuiet(settings) {
  try {
    const s = settings || await getSettings();
    if (!s.calendar || !s.calendar.quiet) return false;
    const { calendar } = await getRaw('calendar');
    return !!inMeeting(calendar || [], dayKey(), nowMin());
  } catch { return false; }
}

/** If a focus session is running and a meeting starts within `warnMin` minutes, say so once. */
export async function checkMeetings() {
  try {
    const settings = await getSettings();
    if (!settings.calendar || !settings.calendar.warn) return;
    const { focus } = await getRaw('focus');
    if (!focus || !isFocusActive(focus)) return;
    const { calendar, meetingWarned } = await getRaw(['calendar', 'meetingWarned']);
    const m = upcomingMeeting(calendar || [], dayKey(), nowMin(), Math.max(1, Number(settings.calendar.warnMin) || 2));
    if (!m) return;
    const warned = meetingWarned || [];
    const wid = m.id + '#' + m.start; // a meeting moved to another time the same day is a new heads-up
    if (warned.includes(wid)) return;
    await setRaw({ meetingWarned: [...warned, wid].slice(-20) });
    setLocale(resolveLocale(settings.language));
    const left = Math.max(1, Math.round((focus.endsAt - Date.now()) / 60_000));
    await chrome.notifications.create('meeting-soon', { type: 'basic', iconUrl: ICON, priority: 1, title: t('meet.soonTitle', { time: m.start }), message: t('meet.soonBody', { title: m.title || t('meet.untitled'), n: left }) });
  } catch { /* a heads-up is a nicety, never an error */ }
}

chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'tick') checkMeetings(); });
