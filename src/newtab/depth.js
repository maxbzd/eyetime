// The depth effect on Home: puts the scene's front layers over the clock and slides every layer against the pointer.
// The layers come from shared/depth.js; the movement is CSS (--px / --py in -1..1, --str the strength), this file only feeds it.

import { $, h, clear } from '../ui/dom.js';
import { normalizeDepth, frontLayers, parallaxStrength } from '../shared/depth.js';
import { pointer3d } from './gl3d.js';

let sig = '';
let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, installed = false;

const motionOk = () => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches && document.documentElement.dataset.motion !== 'reduced';

function step() {
  cx += (tx - cx) * 0.09; cy += (ty - cy) * 0.09;
  document.body.style.setProperty('--px', cx.toFixed(4)); document.body.style.setProperty('--py', cy.toFixed(4));
  pointer3d(cx, cy);
  raf = Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001 ? window.requestAnimationFrame(step) : 0;
}

function install() {
  if (installed) return;
  installed = true;
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || !(document.body.classList.contains('has-depth') || document.body.classList.contains('bg-gl')) || !motionOk()) return;
    tx = (e.clientX / window.innerWidth - 0.5) * 2; ty = (e.clientY / window.innerHeight - 0.5) * 2;
    if (!raf) raf = window.requestAnimationFrame(step);
  }, { passive: true });
}

/** Call whenever the settings or the scene change. `scene` is the id of the background in use. */
export function applyDepth(settings, scene) {
  const d = normalizeDepth(settings.newtab.depth), layers = frontLayers(scene, d);
  const front = $('#bgFront');
  document.body.classList.toggle('has-depth', layers.length > 0);
  document.body.style.setProperty('--str', String(d.on && motionOk() ? parallaxStrength(d) : 0));
  const next = scene + ':' + layers.map((l) => l.cls).join(',');
  if (front && next !== sig) { sig = next; clear(front, ...layers.map((l) => h('i', { class: 'dl ' + l.cls, style: { '--k': String(l.k) } }))); }
  install();
}
