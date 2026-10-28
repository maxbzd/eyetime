// The night clock ("StandBy"): after a while with no mouse, key or touch, Home is replaced by a huge dim clock on black, like a bedside clock.
// It drifts a little every minute so no pixel stays lit (burn-in), and any movement brings Home back.

import { h } from '../ui/dom.js';
import { t, fmtTime, fmtDate } from '../shared/i18n.js';
import { clock, remainingMs, isPaused } from '../shared/focus.js';
import { isFocusActive } from '../shared/blocking.js';

export const STANDBY_STYLES = ['red', 'amber', 'white'];
export const STANDBY_AFTER = [5, 10, 15, 30, 60];
const COLORS = { red: '#ff453a', amber: '#ffb340', white: '#f2f2f2' };

/**
 * @param {{ getSettings: () => any, getFocus: () => any, onShow?: () => void }} o
 * @returns {{ show: () => void, hide: () => void, isOn: () => boolean, rearm: () => void }}
 */
export function mountStandby({ getSettings, getFocus, onShow }) {
  const time = h('div', { class: 'sb-time num' }), date = h('div', { class: 'sb-date' }), focus = h('div', { class: 'sb-focus' }), hint = h('div', { class: 'sb-hint', text: t('sb.exit') });
  const box = h('div', { class: 'sb-box' }, time, date, focus);
  const root = h('div', { class: 'sb', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('sb.title'), hidden: true }, box, hint);
  document.body.append(root);
  let on = false, tick = 0, drift = 0, idleTimer = 0, moved = 0;

  const paint = () => {
    const s = getSettings(), now = new Date(), f = getFocus();
    const txt = fmtTime(now, s.newtab.clock24 ?? undefined, !!s.standby.seconds), ap = /\s?([AaPp]\.?[Mm]\.?)$/.exec(txt);
    time.replaceChildren(ap ? txt.slice(0, ap.index) : txt, ...(ap ? [h('span', { class: 'sb-ap', text: ap[1].toUpperCase() })] : []));
    fit();
    date.textContent = fmtDate(now);
    focus.textContent = f && isFocusActive(f) ? `${t('sb.focus')} · ${clock(remainingMs(f))}` : f && isPaused(f) ? `${t('sb.focus')} ❚❚ ${clock(remainingMs(f))}` : '';
    root.style.setProperty('--sb-color', COLORS[s.standby.style] || COLORS.red);
  };
  /** The digits fill the screen: as large as the width and height allow. */
  const fit = () => {
    time.style.fontSize = '100px';
    const w = time.scrollWidth || 1;
    time.style.fontSize = Math.max(40, Math.min(window.innerHeight * 0.58, (window.innerWidth * 0.86 * 100) / w)).toFixed(0) + 'px';
  };
  /** A small step in a random direction, slowly (burn-in protection). */
  const nudge = () => {
    const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 3;
    box.style.transform = `translate(${(Math.cos(a) * r).toFixed(2)}vw, ${(Math.sin(a) * r).toFixed(2)}vh)`;
  };

  function show() {
    if (on) return;
    on = true; moved = 0;
    root.hidden = false; // (shown first: the digits are measured to fill the screen)
    paint(); nudge();
    document.querySelector('main.nt')?.setAttribute('inert', '');
    tick = window.setInterval(paint, 1000); drift = window.setInterval(nudge, 60_000);
    onShow?.();
  }
  function hide() {
    if (!on) return;
    on = false; root.hidden = true; clearInterval(tick); clearInterval(drift);
    document.querySelector('main.nt')?.removeAttribute('inert');
    arm();
  }

  /** Wait for the quiet to last; any activity starts the wait again. */
  function arm() {
    clearTimeout(idleTimer);
    const s = getSettings();
    if (!s.standby.on || on) return;
    idleTimer = window.setTimeout(() => { if (document.visibilityState === 'visible' && getSettings().standby.on) show(); else arm(); }, Math.max(1, s.standby.after) * 60_000);
  }
  const activity = (e) => {
    if (on) {
      // a tiny mouse tremor must not end it; a key, a click, a touch or a real movement does
      if (e.type === 'mousemove' || e.type === 'pointermove') { moved += Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0); if (moved < 24) return; }
      e.preventDefault?.(); hide(); return;
    }
    arm();
  };
  for (const ev of ['mousemove', 'pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) window.addEventListener(ev, activity, { passive: false, capture: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') arm(); });
  window.addEventListener('et:standby', show);
  window.addEventListener('resize', () => { if (on) fit(); });
  arm();
  return { show, hide, isOn: () => on, rearm: arm };
}
