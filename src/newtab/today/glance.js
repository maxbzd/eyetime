// Home · Today: two whispers in the top corners — today's focus against the goal, and the next eye break. Nothing else.

import { h, svg, icon, clear } from '../../ui/dom.js';
import { send } from '../../ui/api.js';
import { t, fmtDuration } from '../../shared/i18n.js';
import { getSettings, getRaw, getDays, onChange } from '../../shared/storage.js';
import { isFocusLive } from '../../shared/blocking.js';
import { elapsedMs } from '../../shared/focus.js';
import { dayKey } from '../../shared/time.js';

const ring = (p) => svg('svg', { class: 'gl-ring', viewBox: '0 0 20 20', width: 16, height: 16, 'aria-hidden': 'true' },
  svg('circle', { cx: 10, cy: 10, r: 8, fill: 'none', 'stroke-width': 2.4, class: 'gl-track' }),
  svg('circle', { cx: 10, cy: 10, r: 8, fill: 'none', 'stroke-width': 2.4, 'stroke-linecap': 'round', class: 'gl-arc', 'stroke-dasharray': `${(50.27 * Math.min(1, p)).toFixed(2)} 50.27`, transform: 'rotate(-90 10 10)' }));

export function mountGlance(root) {
  root.setAttribute('aria-label', t('today.title')); // a landmark of its own (complementary): the corners are page content too
  async function paint() {
    const s = await getSettings();
    const [[, day]] = await getDays([dayKey()]);
    const { focus } = await getRaw('focus');
    const fs = (day?.fs || 0) + (isFocusLive(focus) ? Math.round(elapsedMs(focus) / 1000) : 0), goal = s.focus.dailyGoal || 0;
    const eye = s.eye.enabled ? await send('break:state').catch(() => null) : null;
    const left = eye && typeof eye.since === 'number' ? Math.max(0, s.eye.intervalMin * 60 - eye.since) : null;
    const focusTxt = goal ? `${fs >= 60 ? fmtDuration(fs) : '0m'} / ${fmtDuration(goal * 60)}` : fs >= 60 ? fmtDuration(fs) : '';
    clear(root,
      h('a', { class: 'gl gl-focus', href: '../insights/insights.html', 'aria-label': t('goal.label') + ': ' + focusTxt, 'data-tip': t('goal.label') }, ring(goal ? fs / (goal * 60) : 0), h('span', { class: 'num', text: focusTxt || t('focus.title') })),
      left === null ? null : h('button', { class: 'gl gl-eye' + (eye.due || left === 0 ? ' due' : ''), type: 'button', 'data-tip': t('eye.breakNow'), onclick: () => send('break:open') },
        icon('eye'), h('span', { class: 'num', text: eye.due || left === 0 ? t('eye.now') : t('eye.nextIn', { time: fmtDuration(left) }) })));
    root.hidden = false;
  }
  paint();
  onChange(['d:*', 'settings', 'focus'], paint);
  setInterval(paint, 30_000);
}
