// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The state and the actions of one focus control: what is chosen (the draft), what is running, what the storage says, and the things a click does.
// The views (idle.js, running.js) only read this and draw; index.js decides which one to show.

import { toast, confirmDialog } from '../dom.js';
import { send } from '../api.js';
import { t, fmtDuration } from '../../shared/i18n.js';
import { getSettings, getRaw, getDays, getCollection } from '../../shared/storage.js';
import { goalStreak, suggestMinutes } from '../../shared/productivity.js';
import { rangeKeys } from '../../shared/time.js';
import { isFocusLive } from '../../shared/blocking.js';
import { isRestActive } from '../../shared/focus.js';

/**
 * @param {HTMLElement} root @param {{ large: boolean }} o
 * @returns the context the views get: `st` (state), `render` / `refresh` (set by index.js), `start`, `endEarly`, `applyMode`, `startLabel`, `load`, `tickId` (the running countdown's timer)
 */
export function createSession(root, { large }) {
  const ctx = { root, large, uid: Math.random().toString(36).slice(2, 7), tickId: /** @type {any} */ (null), render: () => {}, refresh: async () => {}, st: null, load: null, start: null, endEarly: null, applyMode: null, startLabel: null };
  const st = { settings: null, focus: null, rest: null, review: null, today: null, streak: 0, suggest: null, tasks: [], draft: { goal: '', taskId: '', minutes: null, strict: null, scope: null, mode: null, custom: false } };
  ctx.st = st;
  async function load() {
    st.settings = await getSettings();
    const { focus, rest, review } = await getRaw(['focus', 'rest', 'review']);
    st.review = review || null;
    const days = await getDays(rangeKeys(30));
    st.today = days[29][1];
    st.suggest = suggestMinutes(days, st.settings.focus.presets);
    st.streak = goalStreak(days, st.settings.focus.dailyGoal, st.settings.focus.goalDays, { grace: st.settings.focus.streakGrace });
    st.tasks = (await getCollection('tasks', [])).filter((x) => !x.done);
    st.events = (await getRaw('calendar')).calendar || [];
    st.allDay = (await getRaw('calendarDays')).calendarDays || [];
    st.focus = isFocusLive(focus) ? focus : null; // running, or paused
    st.rest = !st.focus && isRestActive(rest) ? rest : null;
    const d = st.draft, s = st.settings.focus;
    if (d.minutes === null) d.minutes = s.minutes;
    if (d.strict === null) d.strict = s.strict;
    if (d.scope === null) d.scope = s.scope;
    if (d.mode === null) d.mode = s.mode;
  }

  function startLabel() { return t('focus.start', { time: fmtDuration(st.draft.minutes * 60) }); }

  let starting = false;
  async function start() {
    if (starting) return; // a second click while the first start is on its way
    starting = true;
    try {
      const d = st.draft;
      const res = await send('focus:start', { minutes: d.minutes, goal: d.goal, strict: d.strict, taskId: d.taskId, scope: d.scope, mode: d.mode });
      if (res && res.ok === false) toast(t(res.error === 'active' ? 'focus.alreadyRunning' : 'common.error'));
      d.goal = ''; d.taskId = '';
    } finally { starting = false; }
  }

  async function endEarly() {
    const ok = await confirmDialog({ title: t('focus.endConfirmTitle'), body: t('focus.endConfirmBody'), confirm: t('focus.end'), cancel: t('focus.keepGoing'), danger: true });
    if (ok) await send('focus:stop');
  }

  /** A mode is a preset for the whole session: length, scope, strictness (sound and extra allowed sites are applied by the worker). */
  function applyMode(id) {
    const d = st.draft, s = st.settings.focus, m = s.modes.find((x) => x.id === id);
    if (!m) return;
    d.mode = m.id; d.minutes = m.minutes; d.custom = !s.presets.includes(m.minutes); d.strict = !!m.strict; d.scope = m.scope || 'distractions';
    ctx.render();
  }

  Object.assign(ctx, { load, start, endEarly, applyMode, startLabel });
  return ctx;
}
