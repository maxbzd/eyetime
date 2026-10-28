// Focus-session helpers (pure).

export const MIN_MINUTES = 1;
export const MAX_MINUTES = 12 * 60;

export function createSession({ minutes, goal = '', strict = false, taskId = '', scope = 'distractions', mode = '', allow = [], now = Date.now() }) {
  const m = Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(minutes)));
  return { id: String(now), startedAt: now, endsAt: now + m * 60_000, minutes: m, goal: String(goal).trim().slice(0, 140), strict: !!strict, taskId: String(taskId || '').slice(0, 40), scope: scope === 'only-mine' ? 'only-mine' : 'distractions', mode: String(mode || '').slice(0, 24), allow: (Array.isArray(allow) ? allow : []).filter((d) => typeof d === 'string').slice(0, 30) };
}

// A session can be paused (not a strict one): `pausedAt` is set while it is, and `pausedMs` adds up the time it stood still. On resume `endsAt` moves
// by the pause, so the planned focus time stays exactly what it was.
export const isPaused = (s) => !!s && !!s.pausedAt;
export const remainingMs = (s, now = Date.now()) => (s ? Math.max(0, s.endsAt - (s.pausedAt || now)) : 0);
export const elapsedMs = (s, now = Date.now()) => (s ? Math.max(0, (s.pausedAt || Math.min(s.endsAt, now)) - s.startedAt - (s.pausedMs || 0)) : 0);
/** The focus time planned for the whole session (its length plus any "+5 min"), without the pauses. */
export const plannedMs = (s) => (s ? s.endsAt - s.startedAt - (s.pausedMs || 0) : 0);
export const progress = (s, now = Date.now()) => (s ? Math.min(1, Math.max(0, elapsedMs(s, now) / Math.max(1, plannedMs(s)))) : 0);

export const MAX_PAUSE_MS = 15 * 60_000; // a pause that is forgotten ends by itself
export const PAUSE_FORGOTTEN_MS = 60 * 60_000; // a pause found over by more than this when the browser starts is a forgotten one: the session ends instead of resuming
/** The session, paused at `now`. A session already paused, ended, or strict is returned as it is. */
export const pauseSession = (s, now = Date.now()) => (!s || s.pausedAt || s.strict || now >= s.endsAt ? s : { ...s, pausedAt: now });
/** The session, resumed at `now`: the time it stood still is added to its end. */
export function resumeSession(s, now = Date.now()) {
  if (!s || !s.pausedAt) return s;
  const d = Math.max(0, now - s.pausedAt);
  const { pausedAt, ...rest } = s; void pausedAt;
  return { ...rest, endsAt: s.endsAt + d, pausedMs: (s.pausedMs || 0) + d };
}

/** mm:ss, or h:mm:ss above an hour. */
export function clock(ms) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** A rest period that follows a completed session. Distracting sites are *not* blocked while it runs. */
export function createRest({ minutes, now = Date.now() }) {
  const m = Math.min(60, Math.max(1, Math.round(minutes)));
  return { startedAt: now, endsAt: now + m * 60_000, minutes: m };
}
export const isRestActive = (rest, now = Date.now()) => !!rest && now < rest.endsAt;
