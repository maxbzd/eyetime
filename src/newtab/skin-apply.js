// Puts a skin (shared/skins.js) on a card: sets its CSS variables, and for liquid glass gives it its own refraction filter.
// Liquid glass = the page behind the card is blurred a little and bent at the rim, like a thick pane of glass. The bend is an SVG displacement map drawn
// for the card's own size (so every corner is right) and used as `backdrop-filter: url(#…)`. Only Chromium can do that; elsewhere the card is plain frosted glass.

import { normalizeSkin, skinTokens, autoInk } from '../shared/skins.js';

/** What the skins need to know about the scene: the ink that reads on it and the look's accent. */
/** @returns {{ ink: 'light' | 'dark', accent: string }} */
export function skinEnv() {
  const cs = window.getComputedStyle(document.documentElement);
  return { ink: autoInk({ tone: document.body.dataset.tone || '', scheme: document.documentElement.dataset.scheme || 'light' }), accent: cs.getPropertyValue('--accent').trim() };
}

const VARS = new WeakMap(); // element → the variable names set on it (to remove them when the skin changes)

/** Apply `skin` (raw or normalised; null / 'look' = none) to `el`. `env` from skinEnv(). */
export function paintSkin(el, skin, env = skinEnv()) {
  const sk = normalizeSkin(skin), sig = JSON.stringify([sk, env.ink, env.accent]);
  if (el.dataset.sksig === sig) return; // nothing changed: keep what is there (a liquid card would flicker)
  el.dataset.sksig = sig;
  for (const k of VARS.get(el) || []) el.style.removeProperty(k);
  VARS.delete(el);
  el.classList.remove('sk-liquid', 'sk-bare', 'sk-on');
  if (!sk || sk.s === 'look') { delete el.dataset.sk; unliquid(el); return; }
  const t = skinTokens(sk, env);
  for (const [k, v] of Object.entries(t.vars)) el.style.setProperty(k, v);
  VARS.set(el, Object.keys(t.vars));
  el.dataset.sk = sk.s; el.classList.add('sk-on');
  el.classList.toggle('sk-bare', t.bare);
  if (t.liquid && supportsLiquid()) { el.classList.add('sk-liquid'); liquid(el, sk); } else unliquid(el);
}

/* ---------- liquid glass ---------- */

let svg = null, seq = 0;
const state = new WeakMap(); // element → { id, ro, sig }
export const supportsLiquid = () => typeof CSS !== 'undefined' && CSS.supports('backdrop-filter', 'url(#x)') && /Chrome\//.test(navigator.userAgent) && !/Firefox\//.test(navigator.userAgent);

function defs() {
  if (svg) return svg;
  svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true'); svg.style.cssText = 'position:absolute;pointer-events:none';
  document.body.append(svg);
  return svg;
}

/** A displacement map for a w×h card with corner radius r: neutral grey inside, a push at the rim that is strongest right at the edge. */
export function liquidMap(w, h, r, bezel) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  const hx = w / 2, hy = h / 2, rr = Math.min(r, hx, hy);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = x + 0.5 - hx, py = y + 0.5 - hy, qx = Math.abs(px) - (hx - rr), qy = Math.abs(py) - (hy - rr);
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0), out = Math.hypot(ox, oy), sdf = out + Math.min(Math.max(qx, qy), 0) - rr; // < 0 inside
    const dist = -sdf, i = (y * w + x) * 4;
    let vx = 0, vy = 0;
    if (dist >= 0 && dist < bezel) {
      const k = Math.pow(1 - dist / bezel, 2.2); // 1 at the edge, 0 at the end of the bezel
      let nx, ny;
      if (out > 0) { nx = (px < 0 ? -1 : 1) * ox / out; ny = (py < 0 ? -1 : 1) * oy / out; } else if (qx > qy) { nx = px < 0 ? -1 : 1; ny = 0; } else { nx = 0; ny = py < 0 ? -1 : 1; }
      vx = -nx * k; vy = -ny * k; // looks inwards: the rim shows what lies further in, bent like a lens
    }
    d[i] = Math.round(128 + 127 * vx); d[i + 1] = Math.round(128 + 127 * vy); d[i + 2] = 128; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

function liquid(el, sk) {
  let st = state.get(el);
  if (!st) {
    st = { id: 'et-lq-' + (++seq), ro: null, sig: '' };
    const f = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    f.id = st.id; f.setAttribute('filterUnits', 'userSpaceOnUse'); f.setAttribute('primitiveUnits', 'userSpaceOnUse'); f.setAttribute('color-interpolation-filters', 'sRGB');
    const img = document.createElementNS('http://www.w3.org/2000/svg', 'feImage'); img.setAttribute('result', 'map'); img.setAttribute('preserveAspectRatio', 'none');
    const disp = document.createElementNS('http://www.w3.org/2000/svg', 'feDisplacementMap'); disp.setAttribute('in', 'SourceGraphic'); disp.setAttribute('in2', 'map'); disp.setAttribute('xChannelSelector', 'R'); disp.setAttribute('yChannelSelector', 'G');
    f.append(img, disp); defs().append(f);
    st.node = f; st.img = img; st.disp = disp;
    st.ro = new window.ResizeObserver(() => refresh(el)); st.ro.observe(el);
    state.set(el, st);
  }
  st.sk = sk;
  el.style.setProperty('--sk-bf', `url(#${st.id})`);
  refresh(el);
}

function refresh(el) {
  const st = state.get(el);
  if (!st) return;
  const r0 = el.getBoundingClientRect(), k = el.offsetWidth ? r0.width / el.offsetWidth : 1; // the card may be scaled by the free-form layout
  const w = Math.round(el.offsetWidth || r0.width / k), h = Math.round(el.offsetHeight || r0.height / k);
  if (w < 20 || h < 20) return;
  const radius = parseFloat(window.getComputedStyle(el).borderTopLeftRadius) || 20, bezel = Math.max(8, Math.min(26, radius * 0.9)), sig = [w, h, Math.round(radius), bezel].join();
  if (sig === st.sig) return;
  st.sig = sig;
  const f = st.node;
  f.setAttribute('x', '0'); f.setAttribute('y', '0'); f.setAttribute('width', String(w)); f.setAttribute('height', String(h));
  st.img.setAttribute('x', '0'); st.img.setAttribute('y', '0'); st.img.setAttribute('width', String(w)); st.img.setAttribute('height', String(h));
  st.img.setAttribute('href', liquidMap(w, h, radius, bezel));
  st.disp.setAttribute('scale', String(Math.round(bezel * 1.7)));
}

function unliquid(el) {
  const st = state.get(el);
  el.style.removeProperty('--sk-bf');
  if (!st) return;
  st.ro?.disconnect(); st.node?.remove(); state.delete(el);
}
