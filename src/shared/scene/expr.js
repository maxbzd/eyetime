// The expression language of scenes (pure). A scene is DATA: its numbers, colours and texts may be small formulas such as
//   sin(t * 0.5) * 20      mixc("#10142a", "#ffb37a", dayFrac)      focus > 0.5 ? 1 : 0.3      "{pad(hour, 2)}:{pad(minute, 2)}"
// They are parsed here and run by closures — never by eval or `new Function`. The language is deliberately small and cannot loop,
// define functions or reach anything but the values it is handed, so a formula can only ever be a pure calculation (like CSS calc()).
// Hard limits keep every formula cheap: length, tree size, depth.

export const LIMITS = { chars: 400, nodes: 160, depth: 14, string: 200 };

const FUNCS = new Map();
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'boolean' ? (v ? 1 : 0) : Number.isFinite(Number(v)) && v !== '' && v !== null ? Number(v) : 0);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const hash = (n) => { let h = Math.imul((Math.floor(n) | 0) ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const smooth = (a, b, x) => { const k = clamp((x - a) / ((b - a) || 1e-9), 0, 1); return k * k * (3 - 2 * k); };
const vnoise = (x, y = 0) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), h = (a, b) => hash(a * 73856093 ^ b * 19349663); return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v; };
const hex2 = (n) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');
const parseColor = (c) => { const s = String(c).trim(); let m = /^#([0-9a-f]{3})$/i.exec(s); if (m) return [...m[1]].map((x) => parseInt(x + x, 16)).concat(1); m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s); if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4), 16), m[2] ? parseInt(m[2], 16) / 255 : 1]; m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)$/i.exec(s); if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]]; return [0, 0, 0, 1]; };
const rgba = (r, g, b, a = 1) => `rgba(${Math.round(clamp(num(r), 0, 255))}, ${Math.round(clamp(num(g), 0, 255))}, ${Math.round(clamp(num(b), 0, 255))}, ${+clamp(num(a), 0, 1).toFixed(3)})`;
const hsla = (h, s, l, a = 1) => `hsla(${Math.round(((num(h) % 360) + 360) % 360)}, ${Math.round(clamp(num(s), 0, 100))}%, ${Math.round(clamp(num(l), 0, 100))}%, ${+clamp(num(a), 0, 1).toFixed(3)})`;
const mixc = (a, b, k) => { const x = parseColor(a), y = parseColor(b), t = clamp(num(k), 0, 1); return rgba(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t, x[3] + (y[3] - x[3]) * t); };
void hex2;

const def = (name, arity, fn) => FUNCS.set(name, { arity, fn });
for (const [n, f] of [['sin', Math.sin], ['cos', Math.cos], ['tan', Math.tan], ['abs', Math.abs], ['floor', Math.floor], ['ceil', Math.ceil], ['round', Math.round], ['sqrt', (x) => Math.sqrt(Math.max(0, x))], ['sign', Math.sign], ['fract', (x) => x - Math.floor(x)], ['exp', (x) => Math.exp(clamp(x, -50, 50))], ['log', (x) => Math.log(Math.max(1e-9, x))]]) def(n, 1, (a) => f(num(a)));
def('min', [2, 4], (...a) => Math.min(...a.map(num))); def('max', [2, 4], (...a) => Math.max(...a.map(num)));
def('pow', 2, (a, b) => { const r = Math.pow(num(a), clamp(num(b), -8, 8)); return Number.isFinite(r) ? r : 0; });
def('mod', 2, (a, b) => { const d = num(b) || 1; return ((num(a) % d) + d) % d; });
def('clamp', 3, (x, a, b) => clamp(num(x), num(a), num(b)));
def('mix', 3, (a, b, k) => num(a) + (num(b) - num(a)) * num(k));
def('smooth', 3, (a, b, x) => smooth(num(a), num(b), num(x)));
def('step', 2, (a, x) => (num(x) >= num(a) ? 1 : 0));
def('noise', [1, 2], (x, y) => vnoise(num(x), num(y)));
def('rand', 1, (s) => hash(num(s)));
def('atan2', 2, (y, x) => Math.atan2(num(y), num(x)));
def('rad', 1, (d) => num(d) * Math.PI / 180);
def('pad', 2, (n, w) => String(Math.max(0, Math.floor(num(n)))).padStart(clamp(Math.floor(num(w)), 1, 8), '0'));
def('fmt', 2, (n, d) => num(n).toFixed(clamp(Math.floor(num(d)), 0, 4)));
def('len', 1, (a) => (Array.isArray(a) ? a.length : typeof a === 'string' ? a.length : 0));
def('at', 2, (a, i) => (Array.isArray(a) ? num(a[clamp(Math.floor(num(i)), 0, Math.max(0, a.length - 1))]) : 0));
def('sum', 1, (a) => (Array.isArray(a) ? a.reduce((s, v) => s + num(v), 0) : 0));
def('maxa', 1, (a) => (Array.isArray(a) && a.length ? Math.max(...a.map(num)) : 0));
def('rgba', [3, 4], rgba); def('hsla', [3, 4], hsla); def('hsl', 3, (h, s, l) => hsla(h, s, l, 1)); def('mixc', 3, mixc);
def('alpha', 2, (c, a) => { const x = parseColor(c); return rgba(x[0], x[1], x[2], num(a)); });
export const FUNCTION_NAMES = [...FUNCS.keys()];

/* ---------- tokens ---------- */

const PUNCT = ['||', '&&', '==', '!=', '<=', '>=', '+', '-', '*', '/', '%', '<', '>', '!', '?', ':', '(', ')', ','];
function tokenize(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
    if (/[0-9.]/.test(c)) { const m = /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(src.slice(i)); if (!m) return null; out.push({ k: 'n', v: Number(m[0]) }); i += m[0].length; continue; }
    if (/[A-Za-z_]/.test(c)) { const m = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/.exec(src.slice(i)); out.push({ k: 'id', v: m[0] }); i += m[0].length; continue; }
    if (c === '"' || c === "'") { const j = src.indexOf(c, i + 1); if (j < 0 || j - i > LIMITS.string) return null; out.push({ k: 's', v: src.slice(i + 1, j) }); i = j + 1; continue; }
    const p = PUNCT.find((q) => src.startsWith(q, i));
    if (!p) return null;
    out.push({ k: 'p', v: p }); i += p.length;
  }
  return out;
}

/* ---------- parser (Pratt) → AST ---------- */

const BIN = { '||': [1, 'or'], '&&': [2, 'and'], '==': [3, 'eq'], '!=': [3, 'ne'], '<': [4, 'lt'], '>': [4, 'gt'], '<=': [4, 'le'], '>=': [4, 'ge'], '+': [5, 'add'], '-': [5, 'sub'], '*': [6, 'mul'], '/': [6, 'div'], '%': [6, 'mod'] };

/** Parse a formula → { ok, ast, vars, error }. `vars`: the names it reads. */
export function parse(src) {
  const text = String(src);
  if (text.length > LIMITS.chars) return { ok: false, error: 'long' };
  const toks = tokenize(text);
  if (!toks || !toks.length) return { ok: false, error: 'syntax' };
  let p = 0, count = 0;
  const vars = new Set();
  const peek = () => toks[p], eat = (v) => { const t = toks[p]; if (t && t.k === 'p' && t.v === v) { p++; return true; } return false; };
  const bump = () => { if (++count > LIMITS.nodes) throw new Error('big'); };
  function primary(depth) {
    if (depth > LIMITS.depth) throw new Error('deep');
    const t = toks[p++];
    if (!t) throw new Error('syntax');
    bump();
    if (t.k === 'n') return { o: 'num', v: t.v };
    if (t.k === 's') return { o: 'str', v: t.v };
    if (t.k === 'id') {
      if (t.v === 'true' || t.v === 'false') return { o: 'num', v: t.v === 'true' ? 1 : 0 };
      if (eat('(')) {
        const f = FUNCS.get(t.v);
        if (!f) throw new Error('func');
        const args = [];
        if (!eat(')')) { do args.push(expr(0, depth + 1)); while (eat(',')); if (!eat(')')) throw new Error('syntax'); }
        const [lo, hi] = Array.isArray(f.arity) ? f.arity : [f.arity, f.arity];
        if (args.length < lo || args.length > hi) throw new Error('arity');
        return { o: 'call', f: t.v, args };
      }
      vars.add(t.v);
      return { o: 'var', v: t.v };
    }
    if (t.k === 'p' && t.v === '(') { const e = expr(0, depth + 1); if (!eat(')')) throw new Error('syntax'); return e; }
    if (t.k === 'p' && t.v === '-') return { o: 'neg', a: primary(depth + 1) };
    if (t.k === 'p' && t.v === '!') return { o: 'not', a: primary(depth + 1) };
    throw new Error('syntax');
  }
  function expr(minPrec, depth) {
    if (depth > LIMITS.depth) throw new Error('deep');
    let left = primary(depth);
    for (;;) {
      const t = peek();
      if (!t || t.k !== 'p') break;
      if (t.v === '?' && minPrec <= 0) {
        p++; bump();
        const a = expr(0, depth + 1);
        if (!eat(':')) throw new Error('syntax');
        const b = expr(0, depth + 1);
        left = { o: 'cond', c: left, a, b };
        continue;
      }
      const b = BIN[t.v];
      if (!b || b[0] < minPrec) break;
      p++; bump();
      left = { o: b[1], a: left, b: expr(b[0] + 1, depth + 1) };
    }
    return left;
  }
  try {
    const ast = expr(0, 0);
    if (p !== toks.length) return { ok: false, error: 'syntax' };
    return { ok: true, ast, vars: [...vars] };
  } catch (e) { return { ok: false, error: e.message || 'syntax' }; }
}

/* ---------- compile ---------- */

const BINOPS = {
  or: (a, b) => (truthy(a) ? a : b), and: (a, b) => (truthy(a) ? b : a),
  eq: (a, b) => (a === b || (typeof a !== 'string' && typeof b !== 'string' && num(a) === num(b)) ? 1 : 0), ne: (a, b) => (BINOPS.eq(a, b) ? 0 : 1),
  lt: (a, b) => (num(a) < num(b) ? 1 : 0), gt: (a, b) => (num(a) > num(b) ? 1 : 0), le: (a, b) => (num(a) <= num(b) ? 1 : 0), ge: (a, b) => (num(a) >= num(b) ? 1 : 0),
  add: (a, b) => (typeof a === 'string' || typeof b === 'string' ? String(a) + String(b) : num(a) + num(b)), sub: (a, b) => num(a) - num(b), mul: (a, b) => num(a) * num(b),
  div: (a, b) => { const d = num(b); return d === 0 ? 0 : num(a) / d; }, mod: (a, b) => { const d = num(b); return d === 0 ? 0 : num(a) % d; },
};
const truthy = (v) => (typeof v === 'string' ? v.length > 0 : Array.isArray(v) ? v.length > 0 : !!num(v));

function build(n) {
  switch (n.o) {
    case 'num': case 'str': { const v = n.v; return () => v; }
    case 'var': { const k = n.v; return (env) => { const v = env.get(k); return v === undefined ? 0 : v; }; }
    case 'neg': { const a = build(n.a); return (env) => -num(a(env)); }
    case 'not': { const a = build(n.a); return (env) => (truthy(a(env)) ? 0 : 1); }
    case 'cond': { const c = build(n.c), a = build(n.a), b = build(n.b); return (env) => (truthy(c(env)) ? a(env) : b(env)); }
    case 'call': { const f = FUNCS.get(n.f).fn, args = n.args.map(build); return (env) => f(...args.map((a) => a(env))); }
    default: { const a = build(n.a), b = build(n.b), op = BINOPS[n.o]; return (env) => op(a(env), b(env)); }
  }
}

/** A formula → { ok, run(env), vars } (`env` is a Map name → number | string | array). A bad formula → { ok: false, error }. */
export function compile(src) {
  const r = parse(src);
  if (!r.ok) return r;
  const run = build(r.ast);
  return { ok: true, vars: r.vars, run: (env) => { try { const v = run(env); return typeof v === 'number' ? (Number.isFinite(v) ? v + 0 : 0) : v; } catch { return 0; } } };
}

/** `{expr}` holes inside a text template → { ok, parts, vars, run(env) → string }. */
export function compileTemplate(tpl) {
  const s = String(tpl);
  if (s.length > LIMITS.string * 2) return { ok: false, error: 'long' };
  const parts = [], vars = new Set();
  let i = 0;
  while (i < s.length) {
    const a = s.indexOf('{', i);
    if (a < 0) { parts.push(s.slice(i)); break; }
    parts.push(s.slice(i, a));
    const b = s.indexOf('}', a + 1);
    if (b < 0) return { ok: false, error: 'syntax' };
    const c = compile(s.slice(a + 1, b));
    if (!c.ok) return c;
    c.vars.forEach((v) => vars.add(v));
    parts.push(c);
    i = b + 1;
  }
  return { ok: true, vars: [...vars], run: (env) => parts.map((p) => (typeof p === 'string' ? p : String(p.run(env)))).join('') };
}

/** Is the text a formula? (`=` first, as in a spreadsheet.) */
export const isFormula = (v) => typeof v === 'string' && v.charCodeAt(0) === 61;
export { num as toNumber, truthy, parseColor, mixc };
