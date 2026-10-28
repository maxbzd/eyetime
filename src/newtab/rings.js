// Three figures for the Home hero: focus vs the daily goal, tasks done today, and today's screen time (its productive share).
// Vital draws them as rings, Ledger as stat tiles; the other looks keep the element empty and hidden.

import { h, svg, clear } from '../ui/dom.js';
import { t, fmtDuration } from '../shared/i18n.js';
import { getSettings, getDays, getCollection, onChange } from '../shared/storage.js';
import { makeClassifier } from '../shared/classify.js';
import { loadGuess } from '../shared/guessstore.js';
import { summarize } from '../shared/stats.js';
import { dayKey, rangeKeys } from '../shared/time.js';

const R = 46, C = 2 * Math.PI * R;
const LOOKS_WITH_RINGS = ['vital', 'ledger'];

function ring(cls, frac, big, label, sub) {
  const f = Math.max(0, Math.min(1, frac));
  const arc = svg('circle', { class: 'bar', cx: 60, cy: 60, r: R, fill: 'none', 'stroke-linecap': 'round', 'stroke-dasharray': `${(f * C).toFixed(1)} ${C.toFixed(1)}`, style: f > 0 ? '' : 'opacity:0' });
  return h('div', { class: 'rg ' + cls, style: { '--f': f.toFixed(3) }, role: 'img', 'aria-label': `${label}: ${big}${sub ? ' (' + sub + ')' : ''}` },
    h('div', { class: 'rg-fig' },
      svg('svg', { viewBox: '0 0 120 120', 'aria-hidden': 'true' }, svg('circle', { class: 'track', cx: 60, cy: 60, r: R, fill: 'none' }), arc),
      h('div', { class: 'rg-val num', text: big })),
    h('div', { class: 'rg-lbl', text: label }),
    h('div', { class: 'rg-sub', text: sub || ' ' }));
}

/** The three figures as plain data: [{ cls, frac, big, label, sub }]. `settings` is the current settings object. */
export async function loadRings(settings) {
  const days = await getDays(rangeKeys(1));
  const today = days[0][1];
  const tasks = await getCollection('tasks', []);
  const { classify } = makeClassifier(settings, await loadGuess());
  const sum = summarize([[dayKey(), today]], classify);
  const goalMin = settings.focus.dailyGoal, focusSec = today?.fs || 0;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const doneToday = tasks.filter((x) => x.done && (x.doneAt || 0) >= start.getTime()).length;
  const total = doneToday + tasks.filter((x) => !x.done).length;
  return [
    { cls: 'rg-focus', frac: goalMin ? focusSec / (goalMin * 60) : (focusSec ? 1 : 0), big: fmtDuration(focusSec), label: t('insights.focusTime'), sub: goalMin ? '/ ' + fmtDuration(goalMin * 60) : '' },
    { cls: 'rg-tasks', frac: total ? doneToday / total : 0, big: `${doneToday}/${total}`, label: t('mod.tasks'), sub: '' },
    { cls: 'rg-screen', frac: sum.total ? sum.productive / sum.total : 0, big: fmtDuration(sum.total), label: t('insights.screenTime'), sub: '' },
  ];
}

export function mountRings(root) {
  let busy = false, again = false;

  async function render() {
    if (busy) { again = true; return; }
    busy = true;
    try {
      const settings = await getSettings();
      const on = LOOKS_WITH_RINGS.includes(settings.appearance.look);
      root.hidden = !on;
      if (!on) { clear(root); return; }
      const data = await loadRings(settings);
      clear(root, ...data.map((d) => ring(d.cls, d.frac, d.big, d.label, d.sub)));
    } finally {
      busy = false;
      if (again) { again = false; render(); }
    }
  }

  render();
  onChange(['settings', 'tasks', 'd:*'], render);
}
