// Focus-session helpers (pure).

export const MIN_MINUTES = 1;
export const MAX_MINUTES = 12 * 60;

export function createSession({ minutes, goal = '', strict = false, taskId = '', scope = 'distractions', mode = '', allow = [], now = Date.now() }) {
  const m = Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(minutes)));
  return { id: String(now), startedAt: now, endsAt: now + m * 60_000, minutes: m, goal: String(goal).trim().slice(0, 140), strict: !!strict, taskId: String(taskId || '').slice(0, 40), scope: scope === 'only-mine' ? 'only-mine' : 'distractions', mode: String(mode || '').slice(0, 24), allow: (Array.isArray(allow) ? allow : []).filter((d) => typeof d === 'string').slice(0, 30) };
}

export const remainingMs = (s, now = Date.now()) => (s ? Math.max(0, s.endsAt - now) : 0);
export const elapsedMs = (s, now = Date.now()) => (s ? Math.min(s.endsAt, now) - s.startedAt : 0);
export const progress = (s, now = Date.now()) => (s ? Math.min(1, Math.max(0, elapsedMs(s, now) / (s.endsAt - s.startedAt))) : 0);

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
