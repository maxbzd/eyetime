// The background photo in 3D, drawn with WebGL from the photo and its depth map (depth-make.js): as the pointer moves, near parts slide more than far ones.
// For every pixel the shader looks for where that pixel would be seen from the shifted viewpoint (a few rounds of "which depth is there, so where do I look"),
// which keeps edges sharp and needs no mesh. A second canvas draws only the nearest part (a depth threshold) in front of the clock, if the person wants that.
// It moves with the pointer (the smoothed offset comes from depth.js), sways gently for a few seconds when the page opens, and rests when nothing moves.

import { glShift, normalizeDepth } from '../shared/depth.js';

const VS = `attribute vec2 a; varying vec2 v; void main(){ v = vec2(a.x * .5 + .5, .5 - a.y * .5); gl_Position = vec4(a, 0., 1.); }`;
const FS = `precision highp float;
varying vec2 v; uniform sampler2D P, D; uniform vec2 off, sc; uniform float str, focus, zoom, cut, soft;
vec2 cover(vec2 u){ u = (u - .5) * sc + .5; return (u - .5) / zoom + .5; }
void main(){
  vec2 uv = cover(v), p = uv, sh = off * str;
  float d = focus;
  for (int i = 0; i < 8; i++) { d = texture2D(D, p).r; p = uv + sh * (d - focus); }
  vec3 c = texture2D(P, p).rgb;
#ifdef FRONT
  float a = smoothstep(cut - soft, cut + soft, d);
  c *= 1. - mix(.28, .5, v.y); // the same darkening the page puts over a photo, so the two layers match
  gl_FragColor = vec4(c * a, a);
#else
  gl_FragColor = vec4(c, 1.);
#endif
}`;
const FOCUS = 0.32, SWAY_MS = 14_000, FRAME_MS = 33;

/** @typedef {{ canvas: HTMLCanvasElement, gl: WebGLRenderingContext, prog: WebGLProgram, front: boolean, u: Record<string, WebGLUniformLocation | null> }} Layer */
/** @type {{ layers: Layer[], key: string, img: HTMLImageElement | null, dep: HTMLImageElement | null, params: any, px: number, py: number, raf: number, last: number, swayFrom: number, lost: boolean } | null} */
let st = null;
let listening = false;

const loadImage = (src) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('image')); i.src = src; });
const motionOk = () => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches && document.documentElement.dataset.motion !== 'reduced';

function compile(gl, type, src) {
  const s = /** @type {WebGLShader} */ (gl.createShader(type));
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader');
  return s;
}

/** @returns {Layer | null} */
function makeLayer(parent, img, dep, front) {
  const canvas = document.createElement('canvas'); canvas.className = front ? 'gl3d gl3d-front' : 'gl3d'; canvas.setAttribute('aria-hidden', 'true');
  const gl = /** @type {WebGLRenderingContext | null} */ (canvas.getContext('webgl', { alpha: front, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' }));
  if (!gl) return null;
  try {
    const prog = /** @type {WebGLProgram} */ (gl.createProgram());
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS)); gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, (front ? '#define FRONT\n' : '') + FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = (image, unit) => {
      const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    };
    tex(img, 0); tex(dep, 1);
    const u = Object.fromEntries(['P', 'D', 'off', 'sc', 'str', 'focus', 'zoom', 'cut', 'soft'].map((n) => [n, gl.getUniformLocation(prog, n)]));
    gl.uniform1i(u.P, 0); gl.uniform1i(u.D, 1);
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); if (st) st.lost = true; });
    parent.append(canvas);
    return { canvas, gl, prog, front, u };
  } catch { canvas.remove(); return null; }
}

function fit(l) {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5), w = Math.max(1, Math.round(window.innerWidth * dpr)), h = Math.max(1, Math.round(window.innerHeight * dpr));
  if (l.canvas.width !== w || l.canvas.height !== h) { l.canvas.width = w; l.canvas.height = h; }
  l.gl.viewport(0, 0, w, h);
}

function paint(x, y) {
  if (!st || !st.img) return;
  const { params } = st, shift = glShift(params.depth), zoom = 1 + shift * 1.7;
  const ia = st.img.naturalWidth / st.img.naturalHeight, ca = window.innerWidth / window.innerHeight;
  const sc = ca > ia ? [1, ia / ca] : [ca / ia, 1];
  for (const l of st.layers) {
    const { gl, u } = l;
    fit(l); gl.useProgram(l.prog);
    gl.uniform2f(u.off, x, y); gl.uniform2f(u.sc, sc[0], sc[1]);
    gl.uniform1f(u.str, shift); gl.uniform1f(u.focus, FOCUS); gl.uniform1f(u.zoom, zoom);
    gl.uniform1f(u.cut, params.depth.cut / 100); gl.uniform1f(u.soft, 0.05);
    if (l.front) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

/** Where the picture is looked from right now: the pointer's smoothed offset plus the sway of the first seconds. */
function frame(t) {
  if (!st) return;
  st.raf = 0;
  if (st.lost) { unmount3d(); document.body.classList.remove('bg-gl'); return; } // the graphics driver dropped the context: back to the flat photo
  let sx = 0, sy = 0, swaying = false;
  if (st.params.depth.sway && motionOk() && st.swayFrom) {
    const e = t - st.swayFrom;
    if (e < SWAY_MS) { swaying = true; const a = Math.min(1, e / 1500) * Math.min(1, (SWAY_MS - e) / 2500); sx = Math.sin(e * 0.00085) * 0.42 * a; sy = Math.sin(e * 0.0013 + 1.2) * 0.2 * a; }
    else st.swayFrom = 0;
  }
  if (t - st.last >= FRAME_MS || !swaying) { st.last = t; paint(motionOk() ? st.px + sx : 0, motionOk() ? st.py + sy : 0); }
  if (swaying) st.raf = window.requestAnimationFrame(frame);
}
const schedule = () => { if (st && !st.raf && !document.hidden) st.raf = window.requestAnimationFrame(frame); };

/** Called with the smoothed pointer offset (-1..1) every time it changes. */
export function pointer3d(x, y) { if (!st) return; st.px = x; st.py = y; st.swayFrom = 0; schedule(); }

function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener('resize', () => schedule(), { passive: true });
  document.addEventListener('visibilitychange', () => { if (!st || document.hidden) return; st.swayFrom = st.params.depth.sway ? window.performance.now() : 0; schedule(); });
}

export function unmount3d() {
  if (!st) return;
  window.cancelAnimationFrame(st.raf);
  for (const l of st.layers) { l.gl.getExtension('WEBGL_lose_context')?.loseContext(); l.canvas.remove(); }
  st = null;
}

/**
 * Show the photo in 3D. `params` = { depth: the Home depth settings }; `behind` draws the nearest part in front of the clock.
 * @param {{ photo: string, depthMap: string, depth: any }} o
 * @returns {Promise<boolean>} false when it could not (no WebGL, a broken picture): the page then keeps the flat photo
 */
export async function mount3d({ photo, depthMap, depth }) {
  const d = normalizeDepth(depth), key = photo.length + ':' + photo.slice(-48) + '|' + depthMap.length + ':' + depthMap.slice(-24) + '|' + (d.behind ? 'f' : 'b');
  if (st && st.key === key && !st.lost) { st.params = { depth: d }; paint(st.px, st.py); schedule(); return true; }
  unmount3d();
  const bg = document.querySelector('.bg'), front = d.behind ? document.querySelector('#bgFront .dl-gl') : null;
  if (!bg) return false;
  let img, dep;
  try { [img, dep] = await Promise.all([loadImage(photo), loadImage(depthMap)]); } catch { return false; }
  if (st) return false; // another call got here first
  const layers = [makeLayer(bg, img, dep, false), front ? makeLayer(front, img, dep, true) : null].filter(Boolean);
  if (!layers.length || (!layers[0] || layers[0].front)) { for (const l of layers) l.canvas.remove(); return false; }
  st = { layers, key, img, dep, params: { depth: d }, px: 0, py: 0, raf: 0, last: 0, swayFrom: d.sway ? window.performance.now() : 0, lost: false };
  paint(0, 0); schedule(); listen();
  return true;
}

export const active3d = () => !!st;
