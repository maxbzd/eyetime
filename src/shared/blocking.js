import { matchesAny, bestMatch } from './domains.js';
import { toMinutes } from './time.js';

/** true when `session` is a running (not paused) focus session at `now`. */
export const isFocusActive = (session, now = Date.now()) => !!session && !session.pausedAt && now < session.endsAt;
/** A session that exists: running, or paused (blocking and meeting warnings are off while it is paused, but it is still "the session"). */
export const isFocusLive = (session, now = Date.now()) => !!session && (!!session.pausedAt || now < session.endsAt);

/**
 * Is "now" inside the configured work hours? Supports overnight ranges (22:00–06:00):
 * the day the range *started* decides whether it applies.
 */
export function isScheduleActive(schedule, now = new Date()) {
  if (!schedule || !schedule.enabled) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(schedule.start), end = toMinutes(schedule.end);
  const today = now.getDay();
  if (start === end) return false;
  if (start < end) return schedule.days.includes(today) && cur >= start && cur < end;
  if (cur >= start) return schedule.days.includes(today);
  if (cur < end) return schedule.days.includes((today + 6) % 7);
  return false;
}

export const REDIRECT_GRACE = '*redirect';
/** The redirect window belongs to the tab that pressed "continue": another tab, or another site opened at once, gets no free pass. */
export const redirectGraceKey = (tabId) => `${REDIRECT_GRACE}:${tabId}`;
export const REDIRECT_GRACE_MS = 30_000;

/**
 * Decide what to do when the user opens `host`.
 *
 * ctx: { settings, classifier, focus, passes, usageOf, now, tabId }
 *   passes  – { [ruleDomain]: untilTimestamp } temporary "continue" permissions
 *   usageOf – (domain) => seconds already spent on that domain (and its subdomains) today
 *
 * Returns { action: 'allow' | 'pause' | 'block', reason?, strict?, canPass?, passMinutes?, rule? }
 *   reason: 'always' | 'focus' | 'schedule' | 'limit' | 'friction'
 */
export function decide(host, ctx) {
  const { settings, classifier, focus, passes = {}, usageOf = () => 0, distractingSec = 0 } = ctx;
  const now = ctx.now ?? Date.now();
  const b = settings.blocking;
  if (!host || matchesAny(host, b.allow)) return { action: 'allow' };

  const rule = classifier.ruleDomain(host);
  // A "continue" on the pause page also opens a 30 s window, in that tab only, for the redirect chain that follows (youtu.be → youtube.com,
  // consent hops, link shorteners): otherwise the destination, a different rule domain, would show the pause page a second time.
  const grace = ctx.tabId != null && (passes[redirectGraceKey(ctx.tabId)] || 0) > now;
  const passed = (passes[rule] || 0) > now || grace;

  if (matchesAny(host, b.always)) return { action: 'block', reason: 'always', rule, canPass: false };

  const cls = classifier.classify(host);
  const distracting = cls === 'distracting';

  // a focus mode can bring its own allowed sites (e.g. "Study" keeps YouTube open): those are never closed by the session
  const modeAllowed = isFocusActive(focus, now) && matchesAny(host, focus.allow || []);

  // "only my sites": a session of this scope closes everything that is not productive or on the allow-list
  if (!modeAllowed && isFocusActive(focus, now) && focus.scope === 'only-mine' && cls !== 'productive' && !matchesAny(host, settings.tracking?.excluded || [])) {
    const strict = !!focus.strict;
    if (strict || !passed) return { action: 'block', reason: 'focus', scope: 'only-mine', rule, strict, canPass: !strict, passMinutes: b.friction.passMinutes };
  }

  if (distracting) {
    if (isFocusActive(focus, now) && !modeAllowed) {
      const strict = !!focus.strict;
      if (strict || !passed) return { action: 'block', reason: 'focus', rule, strict, canPass: !strict, passMinutes: b.friction.passMinutes };
    }
    // a site the running focus mode allows (Study → YouTube) is also exempt from the work-hours schedule while that session lasts; the daily limit below still caps it
    if (!modeAllowed && isScheduleActive(b.schedule, new Date(now))) {
      const strict = !!b.schedule.strict;
      if (strict || !passed) return { action: 'block', reason: 'schedule', rule, strict, canPass: !strict, passMinutes: b.schedule.passMinutes };
    }
  }

  const limitKey = bestMatch(host, Object.keys(b.limits));
  if (limitKey && usageOf(limitKey) >= b.limits[limitKey] * 60 && !(passes[limitKey] > now) && !passed) {
    return { action: 'block', reason: 'limit', rule: limitKey, canPass: true, passMinutes: b.friction.passMinutes, limitMin: b.limits[limitKey] };
  }

  // the distraction budget: one daily allowance for all distracting sites together
  if (distracting && b.budget?.enabled && distractingSec >= b.budget.minutes * 60 && !passed && !modeAllowed) {
    return { action: 'block', reason: 'budget', rule, canPass: true, passMinutes: b.friction.passMinutes, budgetMin: b.budget.minutes, usedSec: distractingSec };
  }

  if (distracting && b.friction.enabled && !passed) {
    return { action: 'pause', reason: 'friction', rule, canPass: true, passMinutes: b.friction.passMinutes, seconds: b.friction.seconds };
  }
  return { action: 'allow' };
}
