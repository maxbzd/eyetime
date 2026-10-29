// The scene engine: draws a validated scene (shared/scene/schema.js) and keeps it alive.
//   mountScene(host, scene, opts)  → the world behind Home      mountUi(host, ui, opts) → a custom widget (the same nodes, in a box)
// Shapes and text are SVG; particles are a canvas. Every number, colour and text may be a formula, evaluated here by closures (shared/scene/expr.js),
// never by eval. The loop runs only as often as the scene needs: not at all for a still scene, once a second for one that follows the clock,
// ~30 times a second for one that moves — and it stops while the tab is hidden or reduced motion is on.

import { compile, compileTemplate, isFormula, toNumber, truthy } from '../../shared/scene/expr.js';
import { daylightAt, createSource, createPointer } from './data.js';

/** The faces a scene text can name besides the look's own (the files are in ui/tokens.css). */
const FONT_FAMILIES = { mono: 'var(--font-mono, ui-monospace, "JetBrains Mono", monospace)', script: '"Mrs Saint Delafield", "Caveat", cursive', condensed: '"Antonio", "Oswald", var(--font)', serif: '"Cormorant Garamond", "Iowan Old Style", Georgia, serif' };
const SVG = 'http://www.w3.org/2000/svg';
const FAST = new Set(['t', 'dt', 'mouseX', 'mouseY', 'second', 'nowS']);
const mk = (tag, attrs = {}) => { const e = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); return e; };
const colour = (v) => (typeof v === 'string' && v.startsWith('token:') ? `var(--${v.slice(6)})` : v);
let uid = 0;

/** A property that may be a constant or a formula → { dyn, v | run(env), vars }. */
function prop(raw, template = false) {
  if (template) { const c = compileTemplate(raw); return c.ok ? { dyn: c.vars.length > 0, v: c.vars.length ? undefined : c.run(new Map()), run: c.run, vars: c.vars } : { dyn: false, v: '' }; }
  if (isFormula(raw)) { const c = compile(raw.slice(1)); return c.ok ? { dyn: true, run: c.run, vars: c.vars } : { dyn: false, v: undefined, vars: [] }; }
  return { dyn: false, v: raw, vars: [] };
}

/** Builds the DOM of a tree of nodes. Returns { el, update(env), vars, particles }. */
function buildTree(nodes, ctx) {
  const g = mk('g');
  const parts = nodes.map((n) => buildNode(n, ctx)).filter(Boolean);
  for (const p of parts) if (p.el) g.append(p.el);
  return { el: g, update: (env) => { for (const p of parts) p.update(env); } };
}

function paintOf(raw, ctx) {
  if (raw && typeof raw === 'object' && raw.g) {
    const id = 'scg' + (++uid), isLin = raw.g === 'linear';
    const grad = mk(isLin ? 'linearGradient' : 'radialGradient', isLin ? { id, x1: 0, y1: 0, x2: 1, y2: 0, gradientTransform: `rotate(${raw.a - 90} .5 .5)` } : { id, cx: raw.cx, cy: raw.cy, r: raw.r });
    for (const [o, c] of raw.stops) {
      const stop = mk('stop', { offset: o }), p = prop(c);
      if (p.dyn) { (p.vars || []).forEach((v) => ctx.vars.add(v)); ctx.grads.push((env) => { const v = colour(p.run(env)); stop.setAttribute('stop-color', v); }); } else stop.setAttribute('stop-color', colour(p.v));
      grad.append(stop);
    }
    ctx.defs.append(grad);
    return { dyn: false, v: `url(#${id})` };
  }
  const p = prop(raw);
  return p.dyn ? { dyn: true, run: (env) => colour(p.run(env)), vars: p.vars } : { dyn: false, v: colour(p.v) };
}

function buildNode(n, ctx) {
  const t = n.t;
  if (t === 'particles') return makeParticles(n, ctx);
  const el = t === 'group' || t === 'ring' || t === 'lines' || t === 'bar' || t === 'list' ? mk('g') : t === 'ellipse' ? mk('ellipse') : t === 'rect' ? mk('rect') : t === 'line' ? mk('line') : t === 'path' ? mk('path') : t === 'text' ? mk('text') : t === 'spark' ? mk('g') : t === 'noise' ? mk('rect') : null;
  if (!el) return null;
  const setters = []; // [vars[], (env) => void]
  const use = (vars) => { for (const v of vars || []) ctx.vars.add(v); };
  const bind = (raw, apply, { template = false, paint = false } = {}) => {
    const p = paint ? paintOf(raw, ctx) : prop(raw, template);
    if (raw === undefined) return;
    if (p.dyn) { use(p.vars); setters.push((env) => apply(p.run(env))); } else apply(p.v);
  };
  const num = (key, fallback, apply) => { if (n[key] === undefined && fallback === undefined) return; bind(n[key] === undefined ? fallback : n[key], (v) => apply(toNumber(v))); };

  // geometry per type
  let childUpdate = null;
  const geo = {}; // current x, y, w, h, rot, sc for the transform
  const place = () => {
    const x = geo.x || 0, y = geo.y || 0, w = geo.w || 0, h = geo.h || 0, sc = geo.sc === undefined ? 1 : geo.sc, rot = geo.rot || 0;
    if (t === 'rect' || t === 'ellipse' || t === 'noise') {
      if (t === 'ellipse') { el.setAttribute('cx', x + w / 2); el.setAttribute('cy', y + h / 2); el.setAttribute('rx', w / 2); el.setAttribute('ry', h / 2); } else { el.setAttribute('x', x); el.setAttribute('y', y); el.setAttribute('width', w); el.setAttribute('height', h); }
      el.setAttribute('transform', `rotate(${rot} ${x + w / 2} ${y + h / 2}) translate(${x + w / 2} ${y + h / 2}) scale(${sc}) translate(${-x - w / 2} ${-y - h / 2})`);
    } else el.setAttribute('transform', `translate(${x} ${y}) rotate(${rot}) scale(${sc})`);
  };
  const g = (key, fallback) => num(key, fallback, (v) => { geo[key] = v; place(); });
  if (t === 'line') {
    for (const k of ['x1', 'y1', 'x2', 'y2']) num(k, 0, (v) => el.setAttribute(k, v));
    bind(n.stroke === undefined ? 'token:text-3' : n.stroke, (v) => el.setAttribute('stroke', v), { paint: true }); num('sw', 1, (v) => el.setAttribute('stroke-width', v));
    el.setAttribute('stroke-linecap', n.cap || 'round'); if (n.dash) el.setAttribute('stroke-dasharray', n.dash);
  }
  else if (t === 'ring') {
    const rr = { cx: 0, cy: 0, r: 40, sw: 8, val: 0 }, bar = mk('circle'), track = mk('circle');
    el.append(track, bar);
    const redraw = () => {
      const c = 2 * Math.PI * rr.r;
      for (const e of [track, bar]) { e.setAttribute('cx', 0); e.setAttribute('cy', 0); e.setAttribute('r', rr.r); e.setAttribute('stroke-width', rr.sw); e.setAttribute('fill', 'none'); }
      bar.setAttribute('stroke-dasharray', `${(c * Math.min(1, Math.max(0, rr.val))).toFixed(2)} ${c.toFixed(2)}`);
      el.setAttribute('transform', `translate(${geo.x || 0} ${geo.y || 0}) rotate(${(n.start === undefined ? -90 : n.start) + (geo.rot || 0)})`);
    };
    bar.setAttribute('stroke-linecap', n.cap || 'round');
    num('r', 40, (v) => { rr.r = v; redraw(); }); num('sw', 8, (v) => { rr.sw = v; redraw(); }); num('val', 0, (v) => { rr.val = v; redraw(); });
    g('x', 0); g('y', 0); if (n.rot !== undefined) g('rot', 0);
    bind(n.fill === undefined ? 'token:accent' : n.fill, (v) => bar.setAttribute('stroke', v), { paint: true });
    bind(n.track === undefined ? 'rgba(128,128,128,.25)' : n.track, (v) => track.setAttribute('stroke', v), { paint: true });
    redraw();
  } else if (t === 'bar') {
    const track = mk('rect'), fill = mk('rect'), bb = { w: 200, h: 12, r: 6, val: 0 };
    el.append(track, fill);
    const redraw = () => { for (const e of [track, fill]) { e.setAttribute('height', bb.h); e.setAttribute('rx', Math.min(bb.r, bb.h / 2)); } track.setAttribute('width', bb.w); fill.setAttribute('width', Math.max(0, bb.w * Math.min(1, Math.max(0, bb.val)))); };
    num('w', 200, (v) => { bb.w = v; redraw(); }); num('h', 12, (v) => { bb.h = v; redraw(); }); num('r', 6, (v) => { bb.r = v; redraw(); }); num('val', 0, (v) => { bb.val = v; redraw(); });
    g('x', 0); g('y', 0);
    bind(n.fill === undefined ? 'token:accent' : n.fill, (v) => fill.setAttribute('fill', v), { paint: true });
    bind(n.track === undefined ? 'rgba(128,128,128,.25)' : n.track, (v) => track.setAttribute('fill', v), { paint: true });
    redraw();
  } else if (t === 'spark') {
    const path = mk('path'); el.append(path);
    const sp = { w: 300, h: 80 }; let arr = [];
    const redraw = () => {
      const max = Math.max(1, ...arr.map(toNumber)), n2 = arr.length, kind = n.kind || 'line';
      if (!n2) { path.setAttribute('d', ''); return; }
      const px = (i) => (n2 === 1 ? sp.w / 2 : (i / (n2 - 1)) * sp.w), py = (v) => sp.h - (toNumber(v) / max) * sp.h;
      let d = '';
      if (kind === 'bars') { const bw = Math.max(1, sp.w / n2 - (toNumber(n.gap) || 4)); arr.forEach((v, i) => { const x0 = (i + 0.5) * (sp.w / n2) - bw / 2, y0 = py(v); d += `M${x0} ${sp.h}V${y0}h${bw}V${sp.h}z`; }); }
      else if (kind === 'dots') arr.forEach((v, i) => { const r = 3; d += `M${px(i) - r} ${py(v)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`; });
      else { d = arr.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(''); if (kind === 'area') d += `L${sp.w} ${sp.h}L0 ${sp.h}z`; }
      path.setAttribute('d', d);
    };
    num('w', 300, (v) => { sp.w = v; redraw(); }); num('h', 80, (v) => { sp.h = v; redraw(); }); g('x', 0); g('y', 0);
    path.setAttribute('fill', n.kind === 'line' || n.kind === undefined ? 'none' : 'currentColor');
    bind(n.fill, (v) => path.setAttribute('fill', v), { paint: true }); bind(n.stroke === undefined && (n.kind === 'line' || n.kind === undefined) ? 'token:accent' : n.stroke, (v) => path.setAttribute('stroke', v), { paint: true });
    num('sw', 3, (v) => path.setAttribute('stroke-width', v)); path.setAttribute('stroke-linejoin', 'round'); path.setAttribute('stroke-linecap', 'round');
    setters.push((env) => { const a = env.get(n.of); const sig = Array.isArray(a) ? a.join(',') : ''; if (sig !== path.dataset.sig) { path.dataset.sig = sig; arr = Array.isArray(a) ? a : []; redraw(); } });
    ctx.vars.add(n.of);
  } else if (t === 'list') {
    const rows = []; let sig = '';
    g('x', 0); g('y', 0);
    const rowH = prop(n.rowh === undefined ? 40 : n.rowh);
    const sub = { ...ctx, vars: new Set() };
    setters.push((env) => {
      const arr = (env.get(n.of) || []).slice(0, n.max || 6), s = JSON.stringify(arr) + '|' + rowH.v;
      if (s !== sig) {
        sig = s; rows.length = 0; el.replaceChildren();
        arr.forEach((item, i) => {
          const row = buildTree([n.item], sub), wrap = mk('g', { transform: `translate(0 ${i * (toNumber(rowH.dyn ? rowH.run(env) : rowH.v) || 40)})` });
          wrap.append(row.el); el.append(wrap);
          if (n.on && n.on.click) { wrap.style.cursor = 'pointer'; wrap.addEventListener('click', () => ctx.act(n.on.click, item)); }
          rows.push({ row, i, item }); sub.vars.forEach((v) => ctx.vars.add(v));
        });
      }
      rows.forEach(({ row, i, item }) => { const e2 = new Map(env); e2.set('item.text', item.text); e2.set('item.starred', item.starred || 0); e2.set('item.i', i); e2.set('item.n', arr.length); row.update(e2); });
    });
    ctx.vars.add(n.of); (n.item.vars || []).forEach((v) => ctx.vars.add(v));
    childUpdate = true;
  } else if (t === 'text') {
    g('x', 0); g('y', 0); if (n.rot !== undefined) g('rot', 0); if (n.sc !== undefined) g('sc', 1);
    bind(n.text, (v) => { el.textContent = String(v); }, { template: true });
    num('size', 40, (v) => el.setAttribute('font-size', v));
    num('weight', 400, (v) => el.setAttribute('font-weight', Math.round(v)));
    num('ls', 0, (v) => el.setAttribute('letter-spacing', v));
    el.setAttribute('text-anchor', n.align || 'start');
    el.style.fontFamily = FONT_FAMILIES[n.font] || (n.font === 'body' ? 'var(--font)' : 'var(--font-display, var(--font))');
    if (n.upper) el.style.textTransform = 'uppercase'; if (n.italic) el.style.fontStyle = 'italic';
    bind(n.fill === undefined ? 'token:text' : n.fill, (v) => el.setAttribute('fill', v), { paint: true });
    if (n.stroke !== undefined) bind(n.stroke, (v) => el.setAttribute('stroke', v), { paint: true }); if (n.sw !== undefined) num('sw', 0, (v) => el.setAttribute('stroke-width', v));
    el.style.fontVariantNumeric = 'tabular-nums';
  } else if (t === 'lines') {
    const id = 'scl' + (++uid), pat = mk('pattern', { id, patternUnits: 'userSpaceOnUse' }), ln = mk('line'), rect = mk('rect');
    const L = { gap: 8, sw: 1, w: 1000, h: 600 };
    const redraw = () => {
      const dir = n.dir || 'h', gp = Math.max(2, L.gap);
      pat.setAttribute('width', dir === 'h' ? 10 : gp); pat.setAttribute('height', dir === 'v' ? 10 : gp);
      if (dir === 'h') { ln.setAttribute('x1', 0); ln.setAttribute('x2', 10); ln.setAttribute('y1', gp / 2); ln.setAttribute('y2', gp / 2); }
      else if (dir === 'v') { ln.setAttribute('x1', gp / 2); ln.setAttribute('x2', gp / 2); ln.setAttribute('y1', 0); ln.setAttribute('y2', 10); }
      else { pat.setAttribute('width', gp); pat.setAttribute('height', gp); ln.setAttribute('x1', 0); ln.setAttribute('y1', gp); ln.setAttribute('x2', gp); ln.setAttribute('y2', 0); }
      ln.setAttribute('stroke-width', L.sw); rect.setAttribute('width', L.w); rect.setAttribute('height', L.h);
    };
    pat.append(ln); ctx.defs.append(pat); rect.setAttribute('fill', `url(#${id})`); el.append(rect);
    num('gap', 8, (v) => { L.gap = v; redraw(); }); num('sw', 1, (v) => { L.sw = v; redraw(); }); num('w', 1000, (v) => { L.w = v; redraw(); }); num('h', 600, (v) => { L.h = v; redraw(); });
    g('x', 0); g('y', 0);
    bind(n.stroke === undefined ? 'rgba(128,128,128,.3)' : n.stroke, (v) => ln.setAttribute('stroke', v), { paint: true });
    redraw();
  } else if (t === 'path') {
    if (n.d) el.setAttribute('d', n.d);
    g('x', 0); g('y', 0); if (n.rot !== undefined) g('rot', 0); if (n.sc !== undefined) g('sc', 1);
    bind(n.fill === undefined ? 'none' : n.fill, (v) => el.setAttribute('fill', v), { paint: true });
    bind(n.stroke, (v) => el.setAttribute('stroke', v), { paint: true }); num('sw', n.stroke ? 2 : 0, (v) => el.setAttribute('stroke-width', v)); el.setAttribute('stroke-linecap', n.cap || 'round'); el.setAttribute('stroke-linejoin', 'round');
  } else if (t === 'group') {
    g('x', 0); g('y', 0); if (n.rot !== undefined) g('rot', 0); if (n.sc !== undefined) g('sc', 1);
    const kids = buildTree(n.children || [], ctx); el.append(kids.el); childUpdate = kids.update;
    if (n.clip && typeof n.w === 'number' && typeof n.h === 'number') { const id = 'scc' + (++uid), cp = mk('clipPath', { id }); const r = n.clip === 'ellipse' ? mk('ellipse', { cx: n.w / 2, cy: n.h / 2, rx: n.w / 2, ry: n.h / 2 }) : mk('rect', { x: 0, y: 0, width: n.w, height: n.h }); cp.append(r); ctx.defs.append(cp); el.setAttribute('clip-path', `url(#${id})`); }
  } else if (t === 'noise') {
    const id = 'scn' + (++uid), f = mk('filter', { id, x: 0, y: 0, width: '100%', height: '100%' });
    f.append(mk('feTurbulence', { type: 'fractalNoise', baseFrequency: n.freq || 0.8, numOctaves: 2, seed: n.seed || 1, stitchTiles: 'stitch' }), mk('feColorMatrix', { values: '0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 1.1 -0.2' }));
    ctx.defs.append(f); el.setAttribute('filter', `url(#${id})`); el.setAttribute('fill', 'white');
    g('x', 0); g('y', 0); g('w', 1000); g('h', 600);
  } else { // rect, ellipse
    g('x', 0); g('y', 0); g('w', 100); g('h', 100); if (n.rot !== undefined) g('rot', 0); if (n.sc !== undefined) g('sc', 1);
    if (t === 'rect') num('r', 0, (v) => el.setAttribute('rx', v));
    bind(n.fill === undefined ? 'none' : n.fill, (v) => el.setAttribute('fill', v), { paint: true });
    bind(n.stroke, (v) => el.setAttribute('stroke', v), { paint: true }); if (n.stroke !== undefined) num('sw', 1, (v) => el.setAttribute('stroke-width', v));
  }
  // common: opacity, blur, blend, shadow, visibility, click
  if (n.op !== undefined) num('op', 1, (v) => { el.style.opacity = String(Math.min(1, Math.max(0, v))); });
  if (n.blur !== undefined) { const b = prop(n.blur); if (b.dyn) { use(b.vars); setters.push((env) => { el.style.filter = `blur(${toNumber(b.run(env)) * ctx.unit}px)`; }); } else el.style.filter = `blur(${toNumber(b.v) * ctx.unit}px)`; ctx.blurs.push({ el, v: b }); }
  if (n.blend && n.blend !== 'normal') el.style.mixBlendMode = n.blend;
  if (n.shadow) el.style.filter = `${el.style.filter} drop-shadow(${toNumber(n.shadow.x) * ctx.unit}px ${toNumber(n.shadow.y) * ctx.unit}px ${n.shadow.blur * ctx.unit}px ${colour(n.shadow.color)})`;
  if (n.show !== undefined) { const s = typeof n.show === 'boolean' ? { dyn: false, v: n.show } : prop(n.show); if (s.dyn) { use(s.vars); setters.push((env) => { el.style.display = truthy(s.run(env)) ? '' : 'none'; }); } else if (!s.v) el.style.display = 'none'; }
  if (n.on && n.on.click && t !== 'list') { el.style.cursor = 'pointer'; el.style.pointerEvents = 'auto'; el.addEventListener('click', () => ctx.act(n.on.click)); }
  // the variables this node reads decide how often the scene must be drawn
  for (const k of ['x', 'y', 'w', 'h', 'x1', 'y1', 'x2', 'y2', 'rot', 'sc', 'op', 'r', 'sw', 'val', 'size', 'weight', 'ls', 'fill', 'stroke', 'track', 'text', 'blur']) { const raw = n[k]; if (raw === undefined || typeof raw === 'object') continue; const p = prop(raw, k === 'text'); use(p.vars); }
  return { el, update: (env) => { for (const s of setters) s(env); if (typeof childUpdate === 'function') childUpdate(env); } };
}

/* ---------- particles ---------- */

function makeParticles(n, ctx) {
  const count = n.n || 60, sz = n.size || [1, 3], sp = n.speed || [4, 14], cols = n.colors || ['#ffffff'], rnd = (() => { let s = (n.seed || 7) >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); })();
  const dir = n.dir || 'up';
  const ps = Array.from({ length: count }, () => { const s = sp[0] + (sp[1] - sp[0]) * rnd(); const a = dir === 'any' ? rnd() * Math.PI * 2 : 0; return { x: rnd(), y: rnd(), vx: dir === 'left' ? -s : dir === 'right' ? s : dir === 'any' ? Math.cos(a) * s : 0, vy: dir === 'up' ? -s : dir === 'down' ? s : dir === 'any' ? Math.sin(a) * s : 0, r: sz[0] + (sz[1] - sz[0]) * rnd(), c: cols[Math.floor(rnd() * cols.length)], ph: rnd() * 6.28 }; });
  const P = { x: prop(n.x === undefined ? 0 : n.x), y: prop(n.y === undefined ? 0 : n.y), w: prop(n.w === undefined ? 1000 : n.w), h: prop(n.h === undefined ? 600 : n.h), op: prop(n.op === undefined ? 1 : n.op) };
  const val = (p, env) => (p.dyn ? toNumber(p.run(env)) : toNumber(p.v));
  ctx.vars.add('t'); for (const p of Object.values(P)) (p.vars || []).forEach((v) => ctx.vars.add(v));
  const show = n.show === undefined ? null : typeof n.show === 'boolean' ? { dyn: false, v: n.show } : prop(n.show); (show && show.vars || []).forEach((v) => ctx.vars.add(v));
  const fo = mk('foreignObject', { x: 0, y: 0, width: 1, height: 1 }), cv = document.createElement('canvas');
  cv.style.cssText = 'width:100%;height:100%;display:block';
  fo.append(cv);
  if (n.blend && n.blend !== 'normal') fo.style.mixBlendMode = n.blend;
  fo.style.pointerEvents = 'none';
  return { el: fo, update(env) {
    if (show && !truthy(show.dyn ? show.run(env) : show.v)) { fo.style.display = 'none'; return; }
    fo.style.display = '';
    const w = Math.max(1, val(P.w, env)), h = Math.max(1, val(P.h, env)), f = ctx.frame;
    fo.setAttribute('x', val(P.x, env)); fo.setAttribute('y', val(P.y, env)); fo.setAttribute('width', w); fo.setAttribute('height', h);
    const k = f.px * f.dpr, cw = Math.round(w * k), ch = Math.round(h * k);
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    const c2 = cv.getContext('2d'); c2.clearRect(0, 0, cw, ch);
    const a0 = Math.min(1, Math.max(0, val(P.op, env))), t = env.get('t') || 0;
    for (const p of ps) {
      if (!f.still) { p.x += p.vx * f.dt / w; p.y += p.vy * f.dt / h; p.x -= Math.floor(p.x); p.y -= Math.floor(p.y); }
      c2.globalAlpha = Math.max(0, a0 * (n.twinkle ? 0.45 + 0.55 * Math.sin(t * 1.3 + p.ph) : 1)); c2.fillStyle = p.c;
      c2.beginPath(); c2.arc(p.x * cw, p.y * ch, Math.max(0.4, p.r * k), 0, 6.2832); c2.fill();
    }
  } };
}

/* ---------- the runtime shared by scenes and widgets ---------- */

function runtime(host, def, opts, isUi) {
  const root = document.createElement('div');
  root.className = 'sc-root' + (isUi ? ' sc-ui' : '');
  const svg = mk('svg', { class: 'sc-svg', 'aria-hidden': 'true', preserveAspectRatio: 'xMidYMid slice' });
  const defs = mk('defs'); svg.append(defs);
  root.append(svg); host.append(root);
  const reduced = () => (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) || document.documentElement.dataset.motion === 'reduced';
  const ctx = { defs, vars: new Set(), frame: { dt: 0, px: 1, dpr: 1, still: false }, blurs: [], grads: [], unit: 1, act: (a, item) => opts.onAction && opts.onAction(a, item, api) };
  const nodes = isUi ? def.root : def.layers;
  const tree = buildTree(nodes, ctx);
  svg.append(tree.el);
  const paramVals = new Map();
  const pdef = def.params || {};
  const setParams = (vals = {}) => { for (const [k, p] of Object.entries(pdef)) { const v = vals[k] !== undefined ? vals[k] : p.def; paramVals.set(['p', k].join('.'), p.type === 'color' ? v : toNumber(v)); } };
  setParams(opts.params);
  const manual = new Map(), stateVal = new Map(), stateDefs = Object.entries(def.states || {}).map(([k, s]) => ({ k, ease: s.ease, when: s.when ? compile(s.when) : null }));
  stateDefs.forEach(({ k }) => stateVal.set(k, 0));
  for (const { when } of stateDefs) (when && when.vars || []).forEach((v) => ctx.vars.add(v));
  const source = opts.source || createSource(), pointer = createPointer(), ownSource = !opts.source;
  const env = new Map();
  let H = isUi ? 1000 * def.size[1] / def.size[0] : 600, px = 1, t0 = window.performance.now(), last = t0, raf = 0, timer = 0, alive = true;
  const UW = isUi ? def.size[0] : 1000;
  const size = () => {
    const r = root.getBoundingClientRect(); if (!r.width || !r.height) return;
    H = isUi ? def.size[1] : Math.round(UW * r.height / r.width); px = r.width / UW; ctx.unit = px;
    svg.setAttribute('viewBox', `0 0 ${UW} ${H}`);
    for (const b of ctx.blurs) if (!b.v.dyn) b.el.style.filter = `blur(${toNumber(b.v.v) * px}px)`;
  };
  const ro = new window.ResizeObserver(() => { size(); draw(0); }); ro.observe(root); size();

  function fillEnv(dt, tNow) {
    const d = new Date(), hf = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600, s = source.snapshot(), dl = daylightAt(hf, s.rise, s.set);
    env.set('t', tNow); env.set('dt', dt); env.set('W', UW); env.set('H', H); env.set('aspect', UW / H);
    env.set('hour', d.getHours()); env.set('minute', d.getMinutes()); env.set('second', d.getSeconds()); env.set('dayFrac', hf / 24); env.set('weekday', d.getDay()); env.set('nowS', Math.floor(Date.now() / 1000));
    env.set('daylight', dl); env.set('night', 1 - Math.min(1, Math.max(0, dl / 0.35)));
    env.set('mouseX', pointer.p.x); env.set('mouseY', pointer.p.y); env.set('reduced', reduced() ? 1 : 0); env.set('dark', document.documentElement.dataset.scheme === 'dark' ? 1 : 0);
    for (const k of ['focus', 'focusLeft', 'focusEnd', 'focusFrac', 'paused', 'goal', 'goalMin', 'focusToday', 'sessionsToday', 'tasksOpen', 'tasksDone', 'streak', 'screenToday', 'week', 'days14', 'tasks']) env.set(k, s[k]);
    for (const [k, v] of paramVals) env.set(k, v);
    for (const { k, ease, when } of stateDefs) {
      const target = manual.has(k) ? manual.get(k) : when ? (truthy(when.run(env)) ? 1 : 0) : 0;
      const cur = stateVal.get(k), step = dt / ease, next = cur < target ? Math.min(target, cur + step) : Math.max(target, cur - step);
      stateVal.set(k, next); env.set(['state', k].join('.'), next * next * (3 - 2 * next));
    }
  }
  const transitioning = () => stateDefs.some(({ k }) => { const v = stateVal.get(k); return v > 0 && v < 1; });
  function draw(dt, now = window.performance.now()) {
    if (!alive) return;
    fillEnv(dt, reduced() ? 0 : (now - t0) / 1000);
    ctx.frame.dt = dt; ctx.frame.px = px; ctx.frame.dpr = Math.min(2, window.devicePixelRatio || 1); ctx.frame.still = reduced();
    for (const gu of ctx.grads) gu(env);
    tree.update(env);
  }
  const rate = () => {
    if (reduced()) return 0;
    let fast = ctx.vars.has('t'), slow = false;
    for (const v of ctx.vars) { if (FAST.has(v)) fast = true; else slow = true; }
    if (transitioning()) fast = true;
    return fast ? 33 : slow ? 1000 : 0;
  };
  let acc = 0, slowCount = 0;
  function loop(now) {
    raf = 0; if (!alive) return;
    const dt = Math.min(0.1, (now - last) / 1000), every = rate();
    acc += now - last; last = now;
    if (every && acc >= every) {
      const s = window.performance.now(); draw(acc / 1000); acc = 0;
      slowCount = window.performance.now() - s > 12 ? slowCount + 1 : Math.max(0, slowCount - 1); // a heavy scene is drawn less often rather than made to stutter
      if (slowCount > 20) { acc = -200; slowCount = 10; }
    }
    void dt;
    if (!document.hidden && every !== 0) raf = window.requestAnimationFrame(loop); else timer = window.setTimeout(() => { if (alive) { last = window.performance.now(); raf = window.requestAnimationFrame(loop); } }, every === 0 ? 1500 : 500);
  }
  const wake = () => { if (!raf && alive && !document.hidden) { last = window.performance.now(); raf = window.requestAnimationFrame(loop); } };
  document.addEventListener('visibilitychange', wake);
  const offData = source.onChange(() => { draw(0); wake(); });
  const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)'); const onMq = () => { draw(0); wake(); }; if (mq && mq.addEventListener) mq.addEventListener('change', onMq);
  draw(0); raf = window.requestAnimationFrame(loop);

  const api = {
    root, setParams: (v) => { setParams(v); draw(0); },
    setState: (name, to) => { if (stateVal.has(name)) { manual.set(name, to ? 1 : 0); wake(); } },
    toggleState: (name) => { if (stateVal.has(name)) { manual.set(name, (manual.has(name) ? manual.get(name) : stateVal.get(name) > 0.5 ? 1 : 0) ? 0 : 1); wake(); } },
    update: () => { draw(0); },
    destroy() { alive = false; window.cancelAnimationFrame(raf); clearTimeout(timer); ro.disconnect(); pointer.destroy(); offData(); if (ownSource) source.destroy(); document.removeEventListener('visibilitychange', wake); if (mq && mq.removeEventListener) mq.removeEventListener('change', onMq); root.remove(); },
  };
  return api;
}

/**
 * The world behind Home. `opts`: { params, source, onAction }.
 * @param {HTMLElement} host @param {any} scene a validated scene
 */
export function mountScene(host, scene, opts = {}) {
  const inst = runtime(host, scene, opts, false);
  if (scene.bg) inst.root.style.background = scene.bg.startsWith('token:') ? `var(--${scene.bg.slice(6)})` : scene.bg;
  return inst;
}

/** A custom widget: the same nodes, drawn in a box of the widget's proportion. */
export function mountUi(host, ui, opts = {}) {
  const inst = runtime(host, ui, opts, true);
  inst.root.style.aspectRatio = `${ui.size[0]} / ${ui.size[1]}`;
  return inst;
}
