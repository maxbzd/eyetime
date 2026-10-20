// "My week" card: a 1080×1350 PNG drawn on a canvas from the same data as the weekly review.
// Contains no site names or task titles — only totals — so it is safe to share.

import { h, icon, toast } from '../ui/dom.js';
import { t, fmtDuration, fmtDate, weekdayName, fmtNumber } from '../shared/i18n.js';
import { parseKey, dayKey } from '../shared/time.js';
import { wrappedStats } from '../shared/wrapped.js';

const W = 1080, H = 1350;

function cssVar(name, fallback) {
  const v = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
function rr(ctx, x, y, w, hgt, r) { ctx.beginPath(); ctx.roundRect(x, y, w, hgt, r); }
function loadImage(src) { return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }

export async function drawWrapped({ sum, prev, cur, goalMin }) {
  const s = wrappedStats({ sum, prev, cur, goalMin });
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const col = { bg: cssVar('--bg', '#faf9f7'), surface: cssVar('--surface', '#fff'), text: cssVar('--text', '#1c1917'), text2: cssVar('--text-2', '#57534e'), text3: cssVar('--text-3', '#78716c'), accent: cssVar('--accent', '#d4440a'), good: cssVar('--productive', '#2563eb'), bad: cssVar('--distracting', '#dc2626'), border: cssVar('--border', '#e7e5e4'), empty: cssVar('--bar-empty', '#eee') };
  const font = window.getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
  const F = (w, px) => `${w} ${px}px ${font}`;

  ctx.fillStyle = col.bg; ctx.fillRect(0, 0, W, H);
  const glow = (x, y, r, color) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `color-mix(in srgb, ${color} 30%, transparent)`); g.addColorStop(1, 'transparent'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); };
  glow(180, 80, 820, col.accent); glow(1000, 520, 720, col.good);

  const pad = 84;
  const logo = await loadImage('../../icons/logo.svg');
  if (logo) ctx.drawImage(logo, pad, 76, 56, 56);
  ctx.fillStyle = col.text; ctx.font = F(700, 38); ctx.textBaseline = 'middle'; ctx.fillText('EyeTime', pad + 76, 106);
  const keys = cur.map((e) => e[0]);
  const range = `${fmtDate(parseKey(keys[0]), { day: 'numeric', month: 'short' })} – ${fmtDate(parseKey(keys[keys.length - 1]), { day: 'numeric', month: 'short' })}`;
  ctx.textAlign = 'right'; ctx.fillStyle = col.text2; ctx.font = F(560, 32); ctx.fillText(range, W - pad, 106); ctx.textAlign = 'left';

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = col.text2; ctx.font = F(600, 38); ctx.fillText(t('wrapped.title'), pad, 270);
  ctx.fillStyle = col.text; ctx.font = F(750, 190); ctx.fillText(fmtDuration(sum.focusSec), pad, 450);
  ctx.fillStyle = col.text2; ctx.font = F(560, 42); ctx.fillText(`${t('wrapped.focusOf')} · ${t('insights.sessions', { n: sum.focusSessions })}`, pad, 520);

  // daily focus bars
  const chartTop = 600, chartH = 300, chartW = W - pad * 2, n = Math.max(1, s.perDay.length), gap = 22, bw = (chartW - gap * (n - 1)) / n;
  const max = Math.max(1, ...s.perDay.map((d) => d.focus), (goalMin || 0) * 60);
  ctx.fillStyle = col.surface; rr(ctx, pad - 28, chartTop - 36, chartW + 56, chartH + 130, 36); ctx.fill(); ctx.strokeStyle = col.border; ctx.lineWidth = 2; ctx.stroke();
  s.perDay.forEach((d, i) => {
    const x = pad + i * (bw + gap), hgt = d.focus ? Math.max(14, (d.focus / max) * chartH) : 8;
    ctx.fillStyle = d.focus ? (s.best && d.key === s.best.key ? col.accent : `color-mix(in srgb, ${col.accent} 45%, ${col.surface})`) : col.empty;
    rr(ctx, x, chartTop + chartH - hgt, bw, hgt, Math.min(18, bw / 2)); ctx.fill();
    ctx.fillStyle = col.text3; ctx.font = F(560, 28); ctx.textAlign = 'center'; ctx.fillText(weekdayName(parseKey(d.key).getDay()), x + bw / 2, chartTop + chartH + 52); ctx.textAlign = 'left';
  });
  if (goalMin) { const y = chartTop + chartH - (goalMin * 60 / max) * chartH; ctx.strokeStyle = col.good; ctx.setLineDash([10, 10]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(pad - 10, y); ctx.lineTo(W - pad + 10, y); ctx.stroke(); ctx.setLineDash([]); }

  // three numbers
  const tiles = [
    [s.goalDays === null ? t('wrapped.activeDays') : t('wrapped.goalDays'), s.goalDays === null ? `${sum.activeDays}/${s.days}` : `${s.goalDays}/${s.days}`, null],
    [t('wrapped.distraction'), `${s.share}%`, s.shareDelta === null ? null : `${s.shareDelta > 0 ? '+' : ''}${fmtNumber(s.shareDelta)} ${t('insights.pts').trim()}`],
    [t('wrapped.breaks'), fmtNumber(sum.breaks), null],
  ];
  const tw = (chartW - 2 * 28) / 3, ty = 1026;
  tiles.forEach(([label, value, sub], i) => {
    const x = pad + i * (tw + 28);
    ctx.fillStyle = col.surface; rr(ctx, x, ty, tw, 180, 30); ctx.fill(); ctx.strokeStyle = col.border; ctx.stroke();
    ctx.fillStyle = col.text3; let lp = 27; ctx.font = F(600, lp); while (ctx.measureText(label).width > tw - 56 && lp > 18) { lp -= 1; ctx.font = F(600, lp); } ctx.fillText(label, x + 28, ty + 50);
    ctx.fillStyle = col.text; ctx.font = F(750, 70); ctx.fillText(value, x + 28, ty + 122);
    if (sub) { ctx.fillStyle = s.shareDelta > 0 ? col.bad : col.good; ctx.font = F(650, 26); ctx.fillText(sub, x + 28, ty + 162); }
  });

  // one honest sentence
  const line = s.msg === 'goal' ? t('wrapped.msgGoal', { n: s.goalDays }) : s.msg === 'up' ? t('wrapped.msgUp', { pct: s.focusDelta }) : s.best ? t('wrapped.msgBest', { day: weekdayName(parseKey(s.best.key).getDay(), 'long'), time: fmtDuration(s.best.focus) }) : t('wrapped.msgSteady');
  ctx.fillStyle = col.text; ctx.font = F(650, 40);
  const words = line.split(' '); let row = '', y = 1290; const lines = [];
  for (const w of words) { const test = row ? row + ' ' + w : w; if (ctx.measureText(test).width > chartW && row) { lines.push(row); row = w; } else row = test; }
  lines.push(row);
  y = 1262 - (lines.length - 1) * 24; lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, pad, y + i * 52));
  ctx.fillStyle = col.text3; ctx.font = F(560, 24); ctx.textAlign = 'right'; ctx.fillText(t('wrapped.footer'), W - pad, H - 36); ctx.textAlign = 'left';
  return c;
}

/** Preview dialog with Download / Copy. */
export async function openWrapped(input) {
  const canvas = await drawWrapped(input);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const url = URL.createObjectURL(blob);
  const name = `eyetime-week-${dayKey()}.png`;
  const copyBtn = h('button', { class: 'btn', type: 'button', onclick: async () => {
    try { await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]); toast(t('wrapped.copied')); } catch { toast(t('common.error')); }
  } }, icon('copy'), t('wrapped.copy'));
  const save = h('a', { class: 'btn btn-primary', href: url, download: name }, icon('download'), t('wrapped.save'));
  const dlg = h('dialog', { class: 'dialog wrapped-dlg' }, h('div', { class: 'dialog-body stack gap-3' }, h('h3', { text: t('wrapped.preview') }), h('p', { class: 'muted-2', text: t('wrapped.privacy') }), h('img', { class: 'wrapped-img', src: url, alt: t('wrapped.preview') })),
    h('div', { class: 'dialog-actions' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => dlg.close() }, t('common.close')), copyBtn, save));
  dlg.addEventListener('close', () => { URL.revokeObjectURL(url); dlg.remove(); });
  document.body.append(dlg);
  dlg.showModal();
}
