// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The background of Home: a bundled wallpaper, the person's own photo (with its cut-out and depth), a scene, a gradient or a colour; the credit of the wallpaper of the day;
// rain and snow over it. Everything here reads `state.settings` and paints on the page, nothing else.

import { $, h, icon, clear } from '../../ui/dom.js';
import { t } from '../../shared/i18n.js';
import { getPhoto } from '../../shared/photos.js';
import { dayKey } from '../../shared/time.js';
import { LOOKS } from '../../shared/looks.js';
import { luminance, normalizeHex } from '../../shared/color.js';
import { resolveTextTone } from '../../shared/phototone.js';
import { normalizeDepth } from '../../shared/depth.js';
import { FRAMES, framePaths, normalizeFrame, DAILY, dailyFrame, wallVeil } from '../../shared/frames.js';
import { describeCode } from '../../shared/weather.js';
import { canvasActive } from '../canvas.js';
import { alignClockFill } from '../type-apply.js';
import { BACKGROUNDS } from '../home-controls.js';
import { logError } from '../../shared/errorlog.js';
import { getPhotoInfo, clearPhotoInfo, photoKey } from '../photo-info.js';
import { mount3d, unmount3d } from '../gl3d.js';
import { applyDepth } from '../depth.js';
import { mountWeatherFx } from '../weather-fx.js';
import { loadWeather } from '../weather.js';
import { state } from './state.js';
import { track } from '../../shared/usage-store.js';

const DARK_SCENES = ['aurora', 'stars', 'photo', 'sea', 'onyx', 'peaks'];

/** A "quiet" theme hides the page's own buttons; they come back for a few seconds when the mouse moves or a key is pressed. */
let awakeTimer = 0;
const wake = () => { document.body.classList.add('awake'); clearTimeout(awakeTimer); awakeTimer = window.setTimeout(() => document.body.classList.remove('awake'), 2800); };
window.addEventListener('pointermove', wake, { passive: true }); window.addEventListener('keydown', wake);

export async function applyBackground() {
  const n = state.settings.newtab;
  let bg = BACKGROUNDS.includes(n.background) || n.background === 'photo' || (n.background === 'scene' && n.scene && n.scene.layers && n.scene.layers.length) ? n.background : 'look';
  const today = n.layout === 'today' && !canvasActive(state.settings);
  if (today && bg !== 'photo') bg = 'photo'; // Today is a photograph with white type: another background (a gradient, a colour, a scene) becomes the wallpaper of the day
  if (bg === 'look') { // "as in the look": Calm paints Dawn, Tide a sea (one per scheme), the others their own page colour
    const scene = LOOKS[state.settings.appearance.look]?.homeScene;
    bg = (scene && typeof scene === 'object' ? scene[document.documentElement.dataset.scheme] : scene) || 'look';
  }
  let scene = bg, photoTone = null, wxSrc = '', flatScene = bg, depthMap = '';
  if (bg === 'photo') {
    let frame = n.frame === DAILY || (today && n.background !== 'photo') ? dailyFrame(new Date(), wallSkip()) : normalizeFrame(n.frame); // a photo that ships with EyeTime, or the person's own
    if (today && !frame && !(await getPhoto('bg'))) frame = dailyFrame(new Date(), wallSkip()); // asked for their own photo but has none (yet)
    const paths = frame ? framePaths(frame) : null;
    paintCredit(today ? frame : '');
    const setVeil = ([vc, vt, vb]) => { const st = document.documentElement.style; st.setProperty('--vc', String(vc)); st.setProperty('--vt', String(vt)); st.setProperty('--vb', String(vb)); };
    setVeil(today && frame ? wallVeil(frame) : [0, 0, 0]);
    const newtabBg = paths ? chrome.runtime.getURL(paths.photo) : await getPhoto('bg');
    document.documentElement.style.setProperty('--photo-shade', String(frame ? FRAMES[frame].shade : 1));
    if (newtabBg) {
      const info = await getPhotoInfo(newtabBg);
      document.documentElement.style.setProperty('--photo', `url(${newtabBg})`);
      if (info.soft) document.documentElement.style.setProperty('--photo-soft', `url(${info.soft})`);
      if (today && !frame) setVeil(info.tone === 'dark' ? [0.4, 0.45, 0.3] : [0.18, 0.22, 0.14]); // their own photo: a light one needs more veil under white type
      photoTone = n.photoText === 'light' || n.photoText === 'dark' ? n.photoText : frame ? FRAMES[frame].tone : info.tone;
      wxSrc = newtabBg;
    } else bg = 'look';
    const newtabFg = bg !== 'photo' ? '' : paths ? (paths.mask ? chrome.runtime.getURL(paths.mask) : '') : await getPhoto('fg');
    if (newtabFg) { document.documentElement.style.setProperty('--photo-mask', `url(${newtabFg})`); scene = 'photo-cut'; } // the cut-out subject: a masked copy of the photo goes in front of the clock
    flatScene = scene;
    const d3 = normalizeDepth(n.depth);
    if (bg === 'photo' && wxSrc && d3.on && d3.volume) { // a 3D photo: its depth map was made for this very photo
      const newtabDepth = await getPhoto('depth');
      if (newtabDepth && newtabDepth.key === photoKey(wxSrc)) { depthMap = newtabDepth.png; scene = 'photo-3d'; }
    }
  }
  if (bg !== 'photo') { paintCredit(''); clearPhotoInfo(); document.documentElement.style.removeProperty('--photo'); document.documentElement.style.removeProperty('--photo-soft'); } // the glass / photo clock falls back to a plain fill
  const color = normalizeHex(n.bgColor) || '#e9e4ff';
  if (bg === 'color') document.documentElement.style.setProperty('--bg-color', color);
  document.body.dataset.bg = bg;
  document.body.classList.toggle('quiet', n.quiet === true);
  $('.bg').className = 'bg bgx-' + bg;
  await applyScene(bg === 'scene' ? n : null);
  applyDepth(state.settings, scene);
  let gl = false;
  if (depthMap) gl = await mount3d({ photo: wxSrc, depthMap, depth: n.depth }); else unmount3d();
  document.body.classList.toggle('bg-gl', gl);
  if (depthMap && !gl) applyDepth(state.settings, flatScene); // no WebGL or a broken map: the flat photo, as before
  // light hero text on scenes that are dark in every theme, and on dark custom colours; a photo follows the person's choice or its own brightness
  document.body.dataset.tone = photoTone && bg === 'photo' ? (resolveTextTone(n.photoText, photoTone) === 'dark' ? 'light' : 'dark') : bg === 'scene' && n.scene.tone ? n.scene.tone : DARK_SCENES.includes(bg) || (bg === 'color' && luminance(color) < 0.28) ? 'dark' : '';
  alignClockFill();
  applyWeatherFx(wxSrc);
}

/** "Next photo" on Today: how many wallpapers to skip today (kept for the day, then it starts over). */
function wallSkip() { try { const v = JSON.parse(localStorage.getItem('et-wall-skip') || 'null'); return v && v.day === dayKey() ? v.n : 0; } catch { return 0; } }
function nextWall() { track('wall_next'); try { localStorage.setItem('et-wall-skip', JSON.stringify({ day: dayKey(), n: wallSkip() + 1 })); } catch { /* private mode */ } applyBackground().catch((e) => logError('background', e)); }
/** Bottom-left on Today: who took the photo, and a way to see another one. */
function paintCredit(frame) {
  const el = $('#tdCredit');
  if (!frame || !FRAMES[frame]) { el.hidden = true; return; }
  const daily = state.settings.newtab.frame === DAILY || state.settings.newtab.background === 'look';
  clear(el, h('span', { class: 'cr-name', text: t('bg.frame.' + frame) }), h('span', { class: 'cr-by', text: FRAMES[frame].credit }),
    daily ? h('button', { class: 'cr-next', type: 'button', 'aria-label': t('td.nextPhoto'), 'data-tip': t('td.nextPhoto'), onclick: nextWall }, icon('refresh-cw')) : null);
  el.hidden = false;
}

/** A scene as the background: drawn by the scene engine (loaded when one is used). Same scene, new knobs → only the knobs change. */
let sceneInst = null, sceneSig = '';
async function applyScene(n) {
  const sig = n ? JSON.stringify(n.scene) : '';
  if (sig === sceneSig && (sceneInst || !n)) { if (sceneInst) sceneInst.setParams(n.sceneParams); return; }
  sceneSig = sig;
  if (sceneInst) { sceneInst.destroy(); sceneInst = null; }
  if (!n) return;
  const [{ mountScene }, { runAction }] = await Promise.all([import('../scene/engine.js'), import('../scene/actions.js')]);
  if (sceneSig !== sig) return; // changed again while loading
  sceneInst = mountScene($('.bg'), n.scene, { params: n.sceneParams, onAction: runAction });
}

/** Rain or snow over the background, if the person turned the weather and its effect on and it is raining or snowing where they are (or `#fx=rain|snow|thunder|drizzle` to look at one). */
const weatherFx = mountWeatherFx();
let wxPhoto = '';
export async function applyWeatherFx(photo = wxPhoto) {
  wxPhoto = photo;
  const forced = /[#&]fx=(rain|snow|thunder|drizzle)\b/.exec(location.hash);
  let fx = null, power = 1;
  const by = (kind) => ({ drizzle: 0.5, thunder: 1.4 }[kind] || 1);
  if (forced) { fx = forced[1] === 'snow' ? 'snow' : 'rain'; power = by(forced[1]); }
  else if (state.settings.weather && state.settings.weather.on && state.settings.weather.effect) {
    const r = await loadWeather();
    if (r.ok) { const k = describeCode(r.data.code, r.data.day); fx = k.fx; power = by(k.kind); }
  }
  await weatherFx.set(fx, power, photo);
}
