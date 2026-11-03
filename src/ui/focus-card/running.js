// The running view: the countdown ring, what was held back, pause / extend / end, and a few ideas for the break.

import { h, svg, icon, clear, toast } from '../dom.js';
import { send } from '../api.js';
import { t, fmtTime } from '../../shared/i18n.js';
import { updateCollection } from '../../shared/storage.js';
import { addCapture } from '../../shared/productivity.js';
import { remainingMs, progress, isPaused } from '../../shared/focus.js';

/** While focusing: park stray thoughts (so they stop pulling), see what was held back, pick a sound. */
  function runningExtras(ctx) {
  const { st, large } = ctx;
    const held = st.today?.fa || 0;
    const park = h('input', { class: 'input input-sm', placeholder: t('focus.park'), 'aria-label': t('focus.park'), maxlength: 300, onkeydown: async (e) => {
      if (e.key !== 'Enter' || !e.target.value.trim()) return;
      const text = e.target.value.trim();
      await updateCollection('captures', [], (notes) => addCapture(notes, text));
      e.target.value = ''; toast(t('focus.parked'));
    } });
    const cur = st.settings.focus.ambient || 'off';
    const sounds = h('div', { class: 'segmented segmented-sm', role: 'group', 'aria-label': t('focus.ambient') }, ['off', 'brown', 'rain', 'river', 'forest'].map((k) => h('button', { type: 'button', 'aria-pressed': String(cur === k), text: t('ambient.' + k), 'data-tip': k === 'brown' ? t('ambient.brownTip') : undefined, onclick: () => send('ambient:set', { kind: k }) })));
    return h('div', { class: 'run-extras' }, large ? park : null, sounds, held ? h('div', { class: 'held', 'data-tip': t('focus.heldTip') }, icon('shield-check'), t('focus.held', { n: held })) : null);
  }

/** Breaks work best away from the screen and with movement — offer something concrete instead of a bare countdown. */
  function restIdeas(ctx) {
  const { st } = ctx;
    const ideas = ['rest.i1', 'rest.i2', 'rest.i3', 'rest.i4', 'rest.i5', 'rest.i6'];
    const pick = ideas[Math.floor(st.rest.startedAt / 60000) % ideas.length];
    return h('div', { class: 'rest-idea' }, icon('sparkles'), h('span', { text: t(pick) }));
  }

export function renderRunning(ctx, restMode = false) {
  const { st, root, large, refresh, start, startLabel, endEarly } = ctx;
    const f = restMode ? st.rest : st.focus;
    const size = large ? 220 : 104, sw = large ? 8 : 7, R = size / 2 - sw, C = 2 * Math.PI * R, mid = size / 2;
    const time = h('div', { class: 'time num' });
    const paused = !restMode && isPaused(f);
    const ends = paused ? '' : t('focus.endsAt', { time: fmtTime(new Date(f.endsAt), st.settings.newtab.clock24 ?? undefined) });
    const track = svg('circle', { cx: mid, cy: mid, r: R, fill: 'none', 'stroke-width': sw, class: 'track' });
    const bar = svg('circle', { cx: mid, cy: mid, r: R, fill: 'none', 'stroke-width': sw, 'stroke-linecap': 'round', class: 'bar', 'stroke-dasharray': C });
    const ring = svg('svg', { viewBox: `0 0 ${size} ${size}` }, track, bar);
    const label = restMode ? t(f.long ? 'rest.long' : 'rest.title') : paused ? t('focus.paused') : t('focus.running');
    const actions = restMode
      ? [h('button', { class: 'btn btn-sm', type: 'button', onclick: () => send('rest:skip') }, t('rest.skip')),
         h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: async () => { await send('rest:skip'); await start(); } }, icon('play'), startLabel())]
      : f.strict
        ? h('span', { class: 'locked' }, icon('lock'), t('focus.strictLocked'))
        : paused
          ? [h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => send('focus:resume') }, icon('play'), t('focus.resume')),
             h('button', { class: 'btn btn-sm', type: 'button', onclick: endEarly }, t('focus.end'))]
          : [h('button', { class: 'btn btn-sm', type: 'button', 'data-tip': t('focus.pauseTip'), onclick: () => send('focus:pause') }, icon('pause'), t('focus.pause')),
             h('button', { class: 'btn btn-sm', type: 'button', 'data-tip': t('focus.extendTip', { n: 5 }), onclick: async () => { const r = await send('focus:extend', { minutes: 5 }); if (r && r.ok === false) toast(t(r.error === 'max' ? 'focus.maxLength' : 'common.error')); } }, icon('plus'), t('focus.extend', { n: 5 })),
             h('button', { class: 'btn btn-sm', type: 'button', onclick: endEarly }, t('focus.end'))];
    const extras = restMode ? restIdeas(ctx) : runningExtras(ctx);
    const ringEl = h('div', { class: 'ring', role: 'timer', 'aria-label': label, style: { width: size + 'px', height: size + 'px' } }, ring, h('div', { class: 'center' }, time, large ? h('div', { class: 'sub', text: ends }) : null));
    const badge = h('span', { class: 'badge ' + (restMode ? 'badge-success' : paused ? 'badge-warn' : 'badge-accent') + ' badge-dot', text: label });
    const goalEl = restMode ? (large ? h('div', { class: 'goal-line', text: t('rest.hint') }) : null) : (f.goal ? h('div', { class: 'goal-line', text: f.goal }) : null);
    const pausedNote = paused && large ? h('div', { class: 'muted', style: { fontSize: 'var(--fs-sm)', maxWidth: '44ch', textAlign: 'center' }, text: t('focus.pausedHint') }) : null;
    clear(root, large
      ? h('div', { class: 'focus-run large' + (restMode ? ' rest' : '') }, badge, ringEl, goalEl, pausedNote, h('div', { class: 'run-actions' }, actions), extras)
      // popup: ring and details side by side — a running session must leave room for the rest of the popup
      : h('div', { class: 'focus-run compact' + (restMode ? ' rest' : '') },
          h('div', { class: 'run-top' }, ringEl, h('div', { class: 'run-info' }, badge, goalEl, h('div', { class: 'muted run-ends', text: ends }), h('div', { class: 'run-actions' }, actions))),
          extras));
    const paint = () => {
      const rem = remainingMs(f);
      if (rem <= 0) { clearInterval(ctx.tickId); refresh(); return; }
      const sec = Math.ceil(rem / 1000), hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60;
      time.textContent = hh ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
      bar.setAttribute('stroke-dashoffset', String(C * progress(f)));
    };
    paint(); ctx.tickId = setInterval(paint, 1000);
  }
