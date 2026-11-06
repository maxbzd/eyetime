// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), lerp = (a, b, t) => a + (b - a) * t;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeOut = (t) => 1 - Math.pow(1 - t, 4), easeExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const raf = () => new Promise((r) => requestAnimationFrame(r)), wait = (ms) => new Promise((r) => setTimeout(r, ms));
/** a promise that runs `fn(t)` for `ms` milliseconds with t from 0 to 1 */
async function tween(ms, fn) { if (reduced) { fn(1); return; } const t0 = performance.now(); for (;;) { const t = clamp((performance.now() - t0) / ms, 0, 1); fn(t); if (t >= 1) return; await raf(); } }
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* private window */ } if (window.ETB && k.startsWith('et-')) window.ETB.push(k, v); } };

/* ============================================================ words (English and Russian; the product ships in 11) */
const WORDS = {
  en: { demo: 'Demo data', screenTime: 'Screen time', today: 'Today', screenToday: 'Total on screen', mostUsed: 'Most used', focusScore: 'Focus', switches: 'Switches', offline: 'Time away from screen', score: 'Score', gFocus: 'Focus', gEyes: 'Eyes', gRest: 'Rest',
    ax1: '8 AM', ax2: '12 PM', ax3: '4 PM', ax4: '8 PM', eyeNext: 'Next eye break', eyeHow: 'Look 20 feet away for 20 seconds', eyeRest: 'Rest my eyes now', eyeLook: 'Look far away', moreOpts: 'Options', mClose: 'Close distracting apps now', mDnd: 'Do Not Disturb', mMute: 'Mute notification sounds', mCycles: 'Pomodoro cycles (25 / 5, a long break after 4)', mBreaks: 'Allow short breaks', frozenTag: 'Frozen · only allowed apps', on: 'on', tipFocus: 'Focus minutes against your daily goal.', tipEyes: 'Eye breaks you took out of the ones due.', tipRest: 'Evenings without a screen and a steady bedtime.', focusNow: 'Start focus', ctaHint: 'starts a session with your last settings',
    myApps: 'My apps', manage: 'Manage', unblock: 'Unblock', rules: 'Rules', upcoming: 'Up next', startsIn12: 'Starts in 12h', every20: 'Every 20 min', startsIn108: 'Starts in 108h', workTime: 'Work Time', workTimeS: 'Weekdays, 9–17', eyeRule: 'Eye breaks', eyeRuleS: '20-20-20, 20 s', weekendZen: 'Weekend Zen', weekendS: 'Sat–Sun, 9–11', newRule: 'New rule',
    you: 'You', average: 'Average', strongStart: 'Strong start', strongStartP: 'Five days of showing up. You are doing what most people don’t.', focusing: 'Focus in progress', open: 'Open',
    tHome: 'Home', tRules: 'Rules', tTimer: 'Timer', tInsights: 'Insights', tProfile: 'Profile', duration: 'Duration', blocked: 'Blocked', difficulty: 'Difficulty', later: 'Schedule for later', startSession: 'Start session',
    onBreak: 'On a break', resume: 'Resume', remaining: 'Remaining time', snooze: 'Snooze 5 min', leave: 'Leave early', doneTitle: 'Session complete', backHome: 'Back to Home',
    now: 'Today', yesterday: 'Yesterday', daysAgo: (n) => `${n} days ago`,
    hm: (h, m) => (h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`), specHead: (p) => `Your screen time is <b>${p}% lower</b> than your weekly average`, offPct: (p) => `${p}% of your day`,
    diff: ['Normal', 'Timeout', 'Locked', 'Frozen'], diffDesc: ['You can snooze or leave at any time.', 'Leaving takes a 10 second hold. Snoozing stays available.', 'No way out until the timer ends. Use it when you mean it.', 'Only your allowed apps can run. Task Manager, Settings and sign-out are closed until the timer ends.'],
    info: ['You can snooze and cancel this session', 'Leaving early needs a 10 s hold', 'Cannot be cancelled once started', 'Only allowed apps run. No way out until the end'],
    unTitle: (a) => `Unblock ${a} for…`, unLeft: (n) => `${n} out of 7 left today`, unGo: (m) => `Unblock for ${m}m`, unNever: 'Nevermind', blockedN: (a, s) => `${a} apps · ${s} sites`,
    toastRules: 'Rules arrive in the next step', toastTab: 'This tab comes in the next step', toastLater: 'Scheduling comes with Rules', unblocked: 'Unblocked', blockAgain: 'Block again', blockSub: '3 apps and 12 sites are blocked until 5:00 PM', blockedAgainT: 'Blocked again', unblockedSub: 'Apps are open for a few minutes. Then the rule blocks them again.',
    doneP: (n, m) => `${m} minutes of focus. Everything you blocked stayed blocked.`, gain: (s) => `Score +${s}`, breakOn: 'Break started. Back in 5 minutes.', lockedNote: (t) => `Locked until ${t}. Nothing to do but the work.`, holdLeave: 'Hold to leave', leftToast: 'Session ended early' },
  ru: { demo: 'Пример данных', screenTime: 'Время за экраном', today: 'Сегодня', screenToday: 'Всего за экраном', mostUsed: 'Чаще всего', focusScore: 'Фокус', switches: 'Переключения', offline: 'Время вдали от экрана', score: 'Счёт', gFocus: 'Фокус', gEyes: 'Глаза', gRest: 'Отдых',
    ax1: '8:00', ax2: '12:00', ax3: '16:00', ax4: '20:00', eyeNext: 'Следующий перерыв для глаз', eyeHow: 'Посмотрите вдаль на 6 метров на 20 секунд', eyeRest: 'Дать глазам отдохнуть', eyeLook: 'Смотрите вдаль', moreOpts: 'Параметры', mClose: 'Закрыть отвлекающие приложения сейчас', mDnd: 'Не беспокоить', mMute: 'Выключить звуки уведомлений', mCycles: 'Циклы помодоро (25 / 5, длинный перерыв после 4)', mBreaks: 'Разрешить короткие перерывы', frozenTag: 'Заморозка · только разрешённые приложения', on: 'вкл', tipFocus: 'Минуты фокуса относительно цели на день.', tipEyes: 'Сколько перерывов для глаз вы сделали из положенных.', tipRest: 'Вечера без экрана и ровное время сна.', focusNow: 'Начать фокус', ctaHint: 'запускает сессию с прошлыми настройками',
    myApps: 'Мои приложения', manage: 'Управлять', unblock: 'Разблокировать', rules: 'Правила', upcoming: 'Скоро', startsIn12: 'Через 12 ч', every20: 'Каждые 20 мин', startsIn108: 'Через 108 ч', workTime: 'Рабочее время', workTimeS: 'Будни, 9–17', eyeRule: 'Перерывы для глаз', eyeRuleS: '20-20-20, 20 с', weekendZen: 'Тихие выходные', weekendS: 'Сб–Вс, 9–11', newRule: 'Новое правило',
    you: 'Вы', average: 'В среднем', strongStart: 'Сильное начало', strongStartP: 'Пять дней подряд. Вы делаете то, что делают немногие.', focusing: 'Идёт фокус', open: 'Открыть',
    tHome: 'Главная', tRules: 'Правила', tTimer: 'Таймер', tInsights: 'Итоги', tProfile: 'Профиль', duration: 'Длительность', blocked: 'Блокировка', difficulty: 'Сложность', later: 'Запланировать', startSession: 'Начать сессию',
    onBreak: 'Перерыв', resume: 'Продолжить', remaining: 'Осталось', snooze: 'Отложить на 5 мин', leave: 'Выйти раньше', doneTitle: 'Сессия завершена', backHome: 'На главную',
    now: 'Сегодня', yesterday: 'Вчера', daysAgo: (n) => `${n} дн. назад`,
    hm: (h, m) => (h ? `${h} ч ${String(m).padStart(2, '0')} м` : `${m} м`), specHead: (p) => `Вы провели за экраном на <b>${p}% меньше</b>, чем в среднем за неделю`, offPct: (p) => `${p}% вашего дня`,
    diff: ['Обычная', 'С паузой', 'Жёсткая', 'Заморозка'], diffDesc: ['Можно отложить или выйти в любой момент.', 'Чтобы выйти, нужно удерживать кнопку 10 секунд. Отложить можно.', 'Выйти нельзя, пока не кончится таймер. Включайте, когда серьёзно.', 'Работают только разрешённые приложения. Диспетчер задач, Параметры и выход из системы закрыты до конца таймера.'],
    info: ['Сессию можно отложить и отменить', 'Для выхода надо удерживать 10 с', 'После старта отменить нельзя', 'Работают только разрешённые приложения. Выхода нет до конца'],
    unTitle: (a) => `Разблокировать ${a} на…`, unLeft: (n) => `Осталось ${n} из 7 на сегодня`, unGo: (m) => `Разблокировать на ${m} мин`, unNever: 'Не нужно', blockedN: (a, s) => `${a} прил. · ${s} сайтов`,
    toastRules: 'Правила будут в следующем шаге', toastTab: 'Эта вкладка будет в следующем шаге', toastLater: 'Планирование придёт вместе с Правилами', unblocked: 'Разблокировано', blockAgain: 'Заблокировать снова', blockSub: '3 приложения и 12 сайтов закрыты до 17:00', blockedAgainT: 'Снова заблокировано', unblockedSub: 'Приложения открыты на несколько минут. Потом правило закроет их снова.',
    doneP: (n, m) => `${m} минут фокуса. Всё заблокированное так и осталось закрытым.`, gain: (s) => `Счёт +${s}`, breakOn: 'Перерыв начался. Вернёмся через 5 минут.', lockedNote: (t) => `Заблокировано до ${t}. Остаётся только работа.`, holdLeave: 'Удерживайте, чтобы выйти', leftToast: 'Сессия завершена раньше' },
};
let lang = store.get('et-lang') || ((navigator.language || 'en').toLowerCase().startsWith('ru') ? 'ru' : 'en');
const W = () => WORDS[lang];
/** the streak chip shows only a number: its name is that number and what it counts (the name must contain the visible text) */
function syncStreakName() { const chip = $('#streakChip'); if (chip) chip.setAttribute('aria-label', `${$('#streakNum').textContent} — ${lang === 'ru' ? 'дней подряд' : 'day streak'}`); }

let applyLang = function applyLang() {
  document.documentElement.lang = lang;
  $$('[data-i18n]').forEach((el) => { const v = W()[el.dataset.i18n]; if (typeof v === 'string') el.textContent = v; });
  $('#langBtn').textContent = lang === 'ru' ? 'EN' : 'RU';
  $('#langBtn').setAttribute('aria-label', `${$('#langBtn').textContent} — ${lang === 'ru' ? 'сменить язык' : 'change language'}`); // the name holds the visible text
  syncStreakName();
  $('#specHead').innerHTML = W().specHead(19);
  $('#sheetName').value = lang === 'ru' ? 'Фокус' : 'Focus'; $('#sName').textContent = $('#sheetName').value;
  renderBlockCard(); renderSheet(); setDay(dayOffset, false); if (booted) { drawOffline(); drawBig(); }
};

/* ============================================================ demo data (clearly marked in the title bar) */
const DAYS = [
  { score: 82, focus: 84, eyes: 72, rest: 86, delta: 3, screen: 217, focusPct: 80, switches: 3, offline: 638, offPct: 62, spec: 19 },
  { score: 76, focus: 70, eyes: 78, rest: 80, delta: -2, screen: 262, focusPct: 71, switches: 6, offline: 592, offPct: 58, spec: 4 },
  { score: 79, focus: 77, eyes: 75, rest: 85, delta: 1, screen: 241, focusPct: 74, switches: 5, offline: 610, offPct: 60, spec: 9 },
];
const NOW_BAR = 13; // 2:30 PM of 24 half-hours from 8:00 to 20:00
function barData(seed) { let s = seed * 9301 + 49297; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280; return Array.from({ length: 24 }, (_, i) => { const lunch = i >= 8 && i <= 10, focusy = i < 8 || (i > 11 && i < 22); const f = Math.round((focusy ? 14 + r() * 14 : 4 + r() * 8)), d = Math.round((lunch ? 12 + r() * 12 : 1 + r() * 9)); return [clamp(f, 0, 30), clamp(d, 0, 30 - 0)]; }); }
const BARS = [barData(3), barData(8), barData(5)];
/* the real app starts from nothing, not from the demo numbers; the helper fills this in */
if (window.__TAURI__) { DAYS.length = 1; DAYS[0] = { score: 0, focus: 0, eyes: 0, rest: 0, delta: 0, screen: 0, focusPct: 0, switches: 0, offline: 0, offPct: 0, spec: 0 }; BARS.length = 1; BARS[0] = Array.from({ length: 24 }, () => [0, 0]); }
let dayOffset = 0, state = { ...DAYS[0] }, booted = false;

/* ============================================================ count-up numbers */
const counters = new WeakMap();
function countTo(el, to, ms, fmt = (v) => String(Math.round(v)), from) {
  const start = from ?? (counters.get(el) ?? 0); counters.set(el, to);
  if (reduced || ms <= 0) { el.textContent = fmt(to); return Promise.resolve(); }
  return tween(ms, (t) => { el.textContent = fmt(lerp(start, to, easeExpo(t))); });
}
const drawBig = () => { const m = state.screen; $('#screenBig').innerHTML = (m >= 60 ? `${Math.floor(m / 60)}<small>${lang === 'ru' ? 'ч' : 'h'}</small> ` : '') + `${String(m % 60).padStart(2, '0')}<small>${lang === 'ru' ? 'м' : 'm'}</small>`; };
function countBig(to, ms) { const el = $('#screenBig'), from = counters.get(el) ?? 0; counters.set(el, to); const f = (v) => { const m = Math.round(v); el.innerHTML = (m >= 60 ? `${Math.floor(m / 60)}<small>${lang === 'ru' ? 'ч' : 'h'}</small> ` : '') + `${String(m % 60).padStart(2, '0')}<small>${lang === 'ru' ? 'м' : 'm'}</small>`; }; return reduced ? f(to) : tween(ms, (t) => f(lerp(from, to, easeExpo(t)))); }
function drawOffline() { $('#offlineVal').textContent = W().hm(Math.floor(state.offline / 60), state.offline % 60); $('#offlinePct').textContent = W().offPct(state.offPct); }

/* ============================================================ the three gauges and the connector */
const GAUGES = { focus: { hue: 0.16, key: 'focus' }, eyes: { hue: -0.14, key: 'eyes' }, rest: { hue: 0.42, key: 'rest' } };
function paintGauges(ms = 1600) {
  $$('.gauge').forEach((g, i) => { const k = g.dataset.g, v = state[k]; g.querySelector('rect.fill').style.strokeDashoffset = String(100 - v); countTo(g.querySelector('.gv'), v, ms); });
}

/* ============================================================ chart: bars for every half hour */
const chart = $('#chart'), tip = $('#chartTip');
function buildChart(rows) {
  $$('.bar', chart).forEach((b) => b.remove());
  rows.forEach(([f, d], i) => {
    const b = document.createElement('div'); b.className = 'bar' + (dayOffset === 0 && i > NOW_BAR ? ' ghost' : '') + (dayOffset === 0 && i === NOW_BAR ? ' now' : ''); b.style.setProperty('--i', i);
    const mk = (c, v) => { const e = document.createElement('i'); e.className = c; e.style.height = Math.max(3, (v / 30) * 100 * 0.92) + '%'; return e; };
    if (!b.classList.contains('ghost')) { b.append(mk('f', f), mk('d', d)); } else { b.append(mk('f', 10)); }
    const h = 8 + Math.floor(i / 2), m = i % 2 ? '30' : '00', ap = h >= 12 ? 'PM' : 'AM', hh = lang === 'ru' ? `${h}:${m}` : `${((h + 11) % 12) + 1}:${m} ${ap}`;
    b.dataset.tip = b.classList.contains('ghost') ? hh : `${hh}<br><em>${f}${lang === 'ru' ? ' мин фокус' : ' min focus'}</em> · <u>${d}${lang === 'ru' ? ' мин отвлечение' : ' min distraction'}</u>`;
    b.addEventListener('pointerenter', () => { $$('.bar.on', chart).forEach((x) => x.classList.remove('on')); b.classList.add('on'); tip.innerHTML = b.dataset.tip; const cr = chart.getBoundingClientRect(), br = b.getBoundingClientRect(); tip.style.left = clamp(br.left - cr.left + br.width / 2, 70, cr.width - 70) + 'px'; tip.classList.add('on'); });
    chart.append(b);
  });
}
chart.addEventListener('pointerleave', () => { tip.classList.remove('on'); $$('.bar.on', chart).forEach((x) => x.classList.remove('on')); });

/* the comparison spectrum */
function buildSpectrum() {
  const sp = $('#spectrum'); $$('i', sp).forEach((x) => x.remove());
  const n = 64; for (let i = 0; i < n; i++) { const t = i / (n - 1), e = document.createElement('i'); const hue = lerp(165, 350, Math.pow(t, 1.2)); e.style.cssText = `--i:${i};height:${34 + 56 * Math.abs(Math.sin(i * .52 + 1.1)) * (0.55 + .45 * Math.sin(i * .17))}%;background:linear-gradient(180deg,hsl(${hue} 80% 68%),hsl(${hue} 70% 46%))`; sp.prepend(e); }
}
function placeSpecPin(pct) { const pin = $('#specPin'); pin.style.height = '100%'; pin.style.left = lerp(18, 50, 1 - clamp(pct / 40, 0, 1)) + '%'; }

/* ============================================================ switching days */
async function setDay(off, animate = true) {
  dayOffset = off; const d = DAYS[off]; const prev = state; state = { ...d };
  const lab = $('#dayLabel'), text = off === 0 ? W().now : off === 1 ? W().yesterday : W().daysAgo(off);
  if (animate) { const old = lab.firstElementChild, nu = document.createElement('span'); nu.textContent = text; nu.style.transform = 'translateY(100%)'; nu.style.opacity = '0'; lab.append(nu); await raf(); await raf(); old.style.transform = 'translateY(-100%)'; old.style.opacity = '0'; nu.style.transform = 'none'; nu.style.opacity = '1'; setTimeout(() => old.remove(), 500); } else { lab.innerHTML = `<span>${esc(text)}</span>`; }
  $('#dayPrev').disabled = off >= DAYS.length - 1; $('#dayNext').disabled = off === 0;
  if (animate) {
    countTo($('#scoreVal'), d.score, 1100); countBig(d.screen, 1100); countTo($('#focusPct'), d.focusPct, 900, (v) => Math.round(v) + '%'); countTo($('#switchNum'), d.switches, 700);
    countTo($('#offlineVal'), state.offline, 900, (v) => W().hm(Math.floor(v / 60), Math.round(v) % 60)); $('#offlineMeter').style.transition = 'width 1.2s var(--out-expo)'; $('#offlineMeter').style.width = d.offPct + '%'; $('#offlinePct').textContent = W().offPct(d.offPct);
    paintGauges(1100); buildChart(BARS[off]);
  }
  setDelta(d.delta); $('#specHead').innerHTML = W().specHead(d.spec); placeSpecPin(d.spec);
  if (window.__gem) window.__gem.pulse(.6);
}
function setDelta(v) { const el = $('#scoreDelta'); el.style.visibility = v === 0 ? 'hidden' : 'visible'; el.querySelector('span').textContent = Math.abs(v); const up = v >= 0; el.style.color = up ? 'var(--mint)' : 'var(--rose)'; el.style.background = up ? 'rgba(140,242,198,.1)' : 'rgba(255,107,125,.1)'; el.style.borderColor = up ? 'rgba(140,242,198,.25)' : 'rgba(255,107,125,.3)'; el.querySelector('svg').style.transform = up ? 'none' : 'rotate(180deg)'; }
$('#dayPrev').addEventListener('click', () => setDay(dayOffset + 1)); $('#dayNext').addEventListener('click', () => setDay(dayOffset - 1));

/* ============================================================ the night scene: stars and the cave */
const starsC = $('#stars'), sctx = starsC.getContext('2d'); let stars = [], shoot = null, sw = 0, sh = 0, dpr = Math.min(devicePixelRatio || 1, 2);
function sizeCanvas(c, ctx) { const r = c.getBoundingClientRect(); c.width = Math.max(2, Math.round(r.width * dpr)); c.height = Math.max(2, Math.round(r.height * dpr)); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return [r.width, r.height]; }
function initStars() { [sw, sh] = sizeCanvas(starsC, sctx); const n = Math.round((sw * sh) / 5200); stars = Array.from({ length: n }, () => ({ x: Math.random() * sw, y: Math.random() * sh * .8, r: Math.random() * 1.15 + .25, ph: Math.random() * 6.28, sp: .4 + Math.random() * 1.6, z: .2 + Math.random() * .8, h: Math.random() < .2 ? 160 + Math.random() * 60 : 0 })); }
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
function drawStars(t) {
  sctx.clearRect(0, 0, sw, sh);
  const fade = clamp((t - 200) / 1600, 0, 1);
  for (const s of stars) {
    const tw = .55 + .45 * Math.sin(t * .001 * s.sp + s.ph), a = tw * fade * (.35 + .65 * s.z);
    const x = s.x + mouse.x * 14 * s.z, y = s.y + mouse.y * 9 * s.z;
    sctx.fillStyle = s.h ? `hsla(${s.h},80%,80%,${a})` : `rgba(235,250,244,${a})`; sctx.beginPath(); sctx.arc(x, y, s.r, 0, 6.283); sctx.fill();
    if (s.r > 1 && tw > .9) { sctx.strokeStyle = `rgba(235,250,244,${a * .5})`; sctx.lineWidth = .6; sctx.beginPath(); sctx.moveTo(x - 4, y); sctx.lineTo(x + 4, y); sctx.moveTo(x, y - 4); sctx.lineTo(x, y + 4); sctx.stroke(); }
  }
  if (!shoot && Math.random() < .0016 && t > 3000) shoot = { x: Math.random() * sw * .8 + sw * .1, y: Math.random() * sh * .25, vx: 7 + Math.random() * 4, vy: 2.4 + Math.random() * 2, life: 0 };
  if (shoot) { shoot.life += 1; const L = 70; const g = sctx.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.vx * 9, shoot.y - shoot.vy * 9); g.addColorStop(0, `rgba(255,255,255,${.9 * (1 - shoot.life / L)})`); g.addColorStop(1, 'rgba(255,255,255,0)'); sctx.strokeStyle = g; sctx.lineWidth = 1.4; sctx.beginPath(); sctx.moveTo(shoot.x, shoot.y); sctx.lineTo(shoot.x - shoot.vx * 9, shoot.y - shoot.vy * 9); sctx.stroke(); shoot.x += shoot.vx; shoot.y += shoot.vy; if (shoot.life > L) shoot = null; }
}
/* the cave: two dark rock walls with a faint rim light, a floor, fog; drawn once per size */
const caveC = $('#cave'), cctx = caveC.getContext('2d');
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const photos = {}; let matcapTex = null;
/* generated photographs, when there are any: { 'home': 'data:image/jpeg;base64,…' } (drop-in; the drawn scene is the fallback) */
const PHOTO_URLS = { home: 'assets/home-cave.jpg', 'opal-mint': 'assets/opal-mint.jpg', 'scene-dawn': 'assets/scene-dawn.jpg', 'scene-dusk': 'assets/scene-dusk.jpg', 'scene-meadow': 'assets/scene-meadow.jpg', 'scene-forest': 'assets/scene-forest.jpg', 'scene-night': 'assets/scene-night.jpg', 'scene-dunes': 'assets/scene-dunes.jpg' };
function loadPhoto(name, then) { if (!PHOTO_URLS[name]) return; const im = new Image(); im.onload = () => { photos[name] = im; then && then(im); document.dispatchEvent(new CustomEvent('et-photo', { detail: name })); }; im.onerror = () => {}; im.src = PHOTO_URLS[name]; }
function drawCave() {
  const [w, h] = sizeCanvas(caveC, cctx), c = cctx, rnd = mulberry(7); c.clearRect(0, 0, w, h);
  const gw = $('#gemWrap').getBoundingClientRect(), ar = $('#app').getBoundingClientRect(), sy = gw.top - ar.top + gw.height * .79, sx = gw.left - ar.left + gw.width / 2;
  c.fillStyle = '#010403'; c.fillRect(0, 0, w, h);
  if (photos.home) { /* a photographed cave replaces the drawn one: the arch frames the gem, the slab is the ground below the interface */
    const im = photos.home, k = Math.max(w / im.width, h / im.height) * 1.04, iw = im.width * k, ih = im.height * k, ox = clamp(w / 2 - .49 * iw, w - iw, 0), oy = h - ih;
    c.drawImage(im, ox, oy, iw, ih);
    const vg = c.createRadialGradient(w / 2, h * .42, h * .18, w / 2, h * .5, Math.max(w, h) * .75); vg.addColorStop(0, 'rgba(0,3,2,0)'); vg.addColorStop(1, 'rgba(0,3,2,.55)'); c.fillStyle = vg; c.fillRect(0, 0, w, h);
    const tx = c.createLinearGradient(0, h * .46, 0, h * .9); tx.addColorStop(0, 'rgba(0,3,2,0)'); tx.addColorStop(1, 'rgba(0,3,2,.62)'); c.fillStyle = tx; c.fillRect(0, h * .46, w, h * .54);
    return;
  }
  /* soft things are drawn small and scaled up (cheap, and it works where canvas filters do not) */
  const small = (k, draw) => { const oc = document.createElement('canvas'); oc.width = Math.max(2, Math.round(w * k)); oc.height = Math.max(2, Math.round(h * k)); const o = oc.getContext('2d'); o.scale(k, k); draw(o); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(oc, 0, 0, w, h); };
  small(.12, (o) => { const shaft = o.createLinearGradient(0, 0, 0, sy); shaft.addColorStop(0, 'rgba(170,255,225,.22)'); shaft.addColorStop(.7, 'rgba(140,242,198,.08)'); shaft.addColorStop(1, 'rgba(140,242,198,0)'); o.fillStyle = shaft; o.beginPath(); o.moveTo(w / 2 - w * .06, 0); o.lineTo(w / 2 + w * .06, 0); o.lineTo(sx + w * .15, sy); o.lineTo(sx - w * .15, sy); o.closePath(); o.fill(); });
  /* rock walls in three depths: the far ones pale and soft, the near ones black and sharp */
  const layer = (reachK, base, hi, k, seed, rim) => small(k, (o) => {
    const r2 = mulberry(seed);
    for (const side of [-1, 1]) {
      const reach = w * reachK, steps = 46, bs = [];
      for (let i = 0; i <= steps; i++) { const f = i / steps; const swell = .45 + .55 * Math.pow(Math.sin(Math.min(1, f * 1.04) * Math.PI * .96), .5); const jag = (Math.sin(i * .9 + seed) * .5 + .5) * .18 + r2() * .2; bs.push(reach * swell * (.82 + jag)); }
      const X = (b) => (side < 0 ? b : w - b), edge = side < 0 ? 0 : w, Y = (i) => (i / steps) * h * 1.06 - h * .03;
      o.save(); o.beginPath(); o.moveTo(edge, -20); bs.forEach((b, i) => o.lineTo(X(b), Y(i))); o.lineTo(edge, h + 20); o.closePath();
      const g = o.createLinearGradient(edge, 0, X(reach * 1.15), 0); g.addColorStop(0, base); g.addColorStop(.7, base); g.addColorStop(1, hi); o.fillStyle = g; o.fill(); o.clip();
      for (let q = 0; q < 260; q++) { /* faceted planes lit from the opening above */
        const px = X(r2() * reach * 1.1), py = r2() * h, sz = 14 + r2() * 90, lit = r2(); o.globalAlpha = .06 + lit * .16; o.fillStyle = lit > .6 ? hi : '#000'; o.beginPath(); o.moveTo(px, py); o.lineTo(px + (r2() - .5) * sz * 2.2, py + (r2() - .25) * sz); o.lineTo(px + (r2() - .5) * sz * 1.5, py + sz * (.6 + r2())); o.closePath(); o.fill();
      }
      o.globalAlpha = 1; const vg = o.createLinearGradient(0, 0, 0, h); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(.7, 'rgba(0,0,0,.25)'); vg.addColorStop(1, 'rgba(0,0,0,.7)'); o.fillStyle = vg; o.fillRect(0, 0, w, h); o.restore();
      if (rim) { o.save(); o.beginPath(); bs.forEach((b, i) => (i ? o.lineTo(X(b), Y(i)) : o.moveTo(X(b), Y(i)))); o.strokeStyle = rim; o.lineWidth = 1.3 / k; o.shadowColor = 'rgba(140,242,198,.7)'; o.shadowBlur = 22 * k; o.stroke(); o.restore(); }
    }
  });
  layer(.17, '#0a1816', '#1d3a37', .25, 3, 'rgba(160,255,225,.10)');
  layer(.24, '#050d0b', '#142925', .6, 5, 'rgba(160,255,225,.14)');
  layer(.31, '#010403', '#0d1a18', 1, 9, 'rgba(160,255,225,.17)');
  /* the floor, and the boulder the stand sits on */
  const fl = c.createLinearGradient(0, sy - 30, 0, h); fl.addColorStop(0, 'rgba(10,22,20,0)'); fl.addColorStop(.35, 'rgba(5,12,11,.85)'); fl.addColorStop(1, 'rgba(1,3,2,1)'); c.fillStyle = fl; c.fillRect(0, sy - 30, w, h - sy + 30);
  const bw = Math.min(w * .105, 170), pts = Array.from({ length: 18 }, (_, i) => { const a = (i / 18) * 6.283, rr = 1 + (rnd() - .5) * .2; return [sx + Math.cos(a) * bw * rr, sy + 18 + Math.sin(a) * bw * .26 * rr + (Math.sin(a) > 0 ? 54 : 0)]; });
  c.save(); c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath(); const bg = c.createLinearGradient(0, sy, 0, sy + 80); bg.addColorStop(0, '#1b3733'); bg.addColorStop(.35, '#0a1614'); bg.addColorStop(1, '#010403'); c.fillStyle = bg; c.fill(); c.clip();
  for (let k = 0; k < 70; k++) { const px = sx + (rnd() - .5) * bw * 2, py = sy + 20 + rnd() * 70, sz = 8 + rnd() * 30; c.globalAlpha = .08 + rnd() * .12; c.fillStyle = rnd() > .5 ? '#2c534c' : '#000'; c.beginPath(); c.moveTo(px, py); c.lineTo(px + (rnd() - .5) * sz * 2, py + sz * .4); c.lineTo(px + (rnd() - .5) * sz, py + sz); c.closePath(); c.fill(); }
  c.restore(); c.save(); c.beginPath(); pts.slice(0, 9).forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.strokeStyle = 'rgba(160,255,225,.28)'; c.lineWidth = 1.2; c.shadowColor = 'rgba(140,242,198,.8)'; c.shadowBlur = 18; c.stroke(); c.restore();
  const pool = c.createRadialGradient(sx, sy + 10, 0, sx, sy + 10, w * .22); pool.addColorStop(0, 'rgba(140,242,198,.16)'); pool.addColorStop(1, 'rgba(140,242,198,0)'); c.fillStyle = pool; c.fillRect(0, 0, w, h);
}

/* ============================================================ the gem (WebGL; a smooth opal, original shape, shaded in a fragment shader) */
const GLSL_NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;} vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;} vec4 perm(vec4 x){return mod289(((x*34.)+1.)*x);} vec4 tis(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=mod289(i);
vec4 p=perm(perm(perm(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);vec4 norm=tis(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}`;
const GEM_VERT = `uniform float uTime; uniform float uPulse; uniform float uSeed; varying vec3 vN; varying vec3 vW; varying vec3 vOo; ${GLSL_NOISE}
vec3 shape(vec3 p){ float r=1.+.11*snoise(p*.85+vec3(0.,uTime*.04,3.)+vec3(uSeed*1.9,uSeed*.7,uSeed*1.3))+.04*snoise(p*1.7-vec3(uTime*.03)+vec3(uSeed)); vec3 q=p*r; q.y*=1.36; q.x*=.88; q.z*=.9; q.xz*=1.-.16*q.y; q*=1.+uPulse*.03*sin(uTime*4.); return q; }
void main(){ vec3 p=normalize(position); vec3 t=normalize(cross(p,vec3(0.,1.,.01))); vec3 b=normalize(cross(p,t)); float e=.012; vec3 P0=shape(p),P1=shape(normalize(p+t*e)),P2=shape(normalize(p+b*e)); vec3 n=normalize(cross(P1-P0,P2-P0)); if(dot(n,p)<0.) n=-n;
 vOo=p; vN=normalize(mat3(modelMatrix)*n); vec4 w=modelMatrix*vec4(P0,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;
const GEM_FRAG = `precision highp float; uniform float uTime; uniform float uIntro; uniform float uHue; uniform float uGlow; uniform sampler2D uMat; uniform float uMatAmt; uniform float uSeed; uniform float uLock; varying vec3 vN; varying vec3 vW; varying vec3 vOo; ${GLSL_NOISE}
vec3 pal(float t){ return .5+.5*cos(6.28318*(t+vec3(0.,.33,.67))); }
vec3 hueRot(vec3 c,float a){ const vec3 k=vec3(.57735); float ca=cos(a),sa=sin(a); return c*ca+cross(k,c)*sa+k*dot(k,c)*(1.-ca); }
vec3 env(vec3 d){ float up=d.y*.5+.5; vec3 c=mix(vec3(.01,.05,.06),vec3(.08,.18,.2),up);
 c+=vec3(1.,.96,.9)*2.2*pow(max(dot(d,normalize(vec3(-.5,.8,.6))),0.),38.); c+=vec3(.4,1.,.8)*1.1*pow(max(dot(d,normalize(vec3(.85,.1,.45))),0.),14.); c+=vec3(.6,.45,1.)*1.*pow(max(dot(d,normalize(vec3(-.9,-.2,.25))),0.),12.); c+=vec3(1.,.6,.7)*.7*pow(max(dot(d,normalize(vec3(.2,-.9,.3))),0.),8.); return c; }
void main(){ vec3 vO=vOo+vec3(uSeed*.6,uSeed*1.1,uSeed*.4); vec3 N=normalize(vN); vec3 V=normalize(cameraPosition-vW); float ndv=clamp(dot(N,V),0.,1.); float fres=pow(1.-ndv,3.); float rim=pow(1.-ndv,1.7); vec3 R=reflect(-V,N); vec3 Rf=refract(-V,N,.8);
 vec3 base=mix(vec3(.02,.09,.1),vec3(.07,.2,.22),ndv);
 float film=ndv*1.15+snoise(vO*.9+vec3(0.,uTime*.04,0.))*.4+uHue; vec3 irid=mix(vec3(.82),pal(film),.72);
 float sw=snoise(vO*1.35+Rf*.9+vec3(0.,uTime*.05,0.)); vec3 inner=pal(sw*.3+ndv*.25+uHue+.12)*smoothstep(-.25,.85,sw)*(.3+.5*ndv);
 float sw2=snoise(vO*2.6-Rf*.6+vec3(uTime*.04)); inner+=pal(sw2*.3+uHue+.55)*.2*smoothstep(0.,1.,sw2);
 vec3 col=base+inner*.9+irid*(.16+.95*rim); col+=vec3(.1,.17,.17)*ndv;
 col+=env(R)*(.22+fres*1.2); float sp=pow(max(snoise(vO*16.+uTime*.2),0.),5.); col+=vec3(1.)*sp*.35*ndv;
 float n=snoise(vO*3.)*.5+.5; float th=uIntro*1.3-.12; if(uIntro<.999&&n>th) discard; float edge=smoothstep(th-.1,th,n)*step(uIntro,.999); col+=vec3(1.,.95,.8)*edge*3.2;
 if(uMatAmt>.001){ vec3 Nv=normalize((viewMatrix*vec4(N,0.)).xyz); vec2 uv=Nv.xy*.46+.5+.045*vec2(snoise(vO*1.7+vec3(uTime*.07,0.,0.)),snoise(vO*1.7+vec3(7.,uTime*.07,0.))); vec3 mc=texture2D(uMat,clamp(uv,.02,.98)).rgb; float lu=dot(mc,vec3(.3,.55,.15)); mc=mix(vec3(lu),mc,2.1); mc=pow(max(mc,0.),vec3(1.22))*1.55; mc=hueRot(mc,uHue*6.28318); col=mix(col,mc+env(R)*.16+irid*.12*rim+vec3(1.)*fres*.18,uMatAmt*.82); }
 col=mix(col,vec3(dot(col,vec3(.3,.5,.2)))*.42,uLock); col*=1.+uGlow*.55; col=1.-exp(-col*1.35); gl_FragColor=vec4(col,1.); }`;
function initGem() {
  const canvas = $('#gem'), wrap = $('#gemWrap'); let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch { document.documentElement.classList.add('no-webgl'); return null; }
  if (!renderer.getContext()) { document.documentElement.classList.add('no-webgl'); return null; }
  renderer.setPixelRatio(dpr); renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, .1, 50); camera.position.set(0, .15, 6.9);
  const uni = { uSeed: { value: 0 }, uLock: { value: 0 }, uMat: { value: null }, uMatAmt: { value: 0 }, uTime: { value: 0 }, uIntro: { value: reduced ? 1 : 0 }, uHue: { value: 0 }, uGlow: { value: 0 }, uPulse: { value: 0 } };
  const gemMat = new THREE.ShaderMaterial({ vertexShader: GEM_VERT, fragmentShader: GEM_FRAG, uniforms: uni });
  const gem = new THREE.Mesh(new THREE.SphereGeometry(1, 176, 128), gemMat); const group = new THREE.Group(); group.add(gem); group.position.y = -.2; scene.add(group);
  /* the little black stand it sits on, with a lit rim */
  const stand = new THREE.Group(); stand.position.y = -1.5;
  const baseM = new THREE.MeshStandardMaterial({ color: 0x050908, metalness: .7, roughness: .28 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(.62, .78, .16, 72), baseM); stand.add(disc);
  const rimM = new THREE.MeshBasicMaterial({ color: 0x8cf2c6, transparent: true, opacity: .0 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.7, .012, 8, 96), rimM); rim.rotation.x = Math.PI / 2; rim.position.y = .085; stand.add(rim); scene.add(stand);
  const k = new THREE.PointLight(0xfff0d8, 1.4, 12); k.position.set(-2.2, 3, 3.6); scene.add(k); const m = new THREE.PointLight(0x8cf2c6, 2.2, 10); m.position.set(2.8, -.6, 2); scene.add(m); scene.add(new THREE.AmbientLight(0x203830, .8));
  /* a pool of light on the stand */
  const gl = document.createElement('canvas'); gl.width = gl.height = 128; const gx = gl.getContext('2d'); const gg = gx.createRadialGradient(64, 64, 0, 64, 64, 64); gg.addColorStop(0, 'rgba(255,255,255,.9)'); gg.addColorStop(.35, 'rgba(255,255,255,.25)'); gg.addColorStop(1, 'rgba(255,255,255,0)'); gx.fillStyle = gg; gx.fillRect(0, 0, 128, 128); const glowTex = new THREE.CanvasTexture(gl);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, color: 0x8cf2c6, blending: THREE.AdditiveBlending, depthWrite: false })); pool.rotation.x = -Math.PI / 2; pool.position.y = -1.4; scene.add(pool);
  /* motes of dust rising around it */
  const N = 70, pos = new Float32Array(N * 3), seed = []; for (let i = 0; i < N; i++) { seed.push([Math.random() * 6.28, .9 + Math.random() * 1.8, Math.random(), .15 + Math.random() * .3]); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const dust = new THREE.Points(pg, new THREE.PointsMaterial({ map: glowTex, size: .16, transparent: true, opacity: 0, color: 0xcffff0, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(dust);
  let w = 0, h = 0; const resize = () => { const r = wrap.getBoundingClientRect(); w = Math.max(2, r.width); h = Math.max(2, r.height); renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < .8 ? 40 : 30; camera.updateProjectionMatrix(); }; resize();
  const api = { hue: 0, hueT: 0, glowT: 0, pulseV: 0, spin: 0, introDone: false, resize,
    setHue(v) { this.hueT = v; }, pulse(v = 1) { this.pulseV = Math.max(this.pulseV, v); }, glow(v) { this.glowT = v; }, flash() { this.pulseV = 1.4; }, setStand(v) { stand.visible = v; pool.position.y = v ? -1.4 : -1.75; }, setBase(v) { this.base = v; this.hueT = v; }, setMatcap(tex) { uni.uMat.value = tex; const t0m = performance.now(); const go = () => { const k = clamp((performance.now() - t0m) / 1400, 0, 1); uni.uMatAmt.value = k; if (k < 1) requestAnimationFrame(go); }; go(); } };
  let t0 = performance.now(), last = t0; const tIntro = t0 + 300; api.rotY = 0.4; api.vel = 0; let drag = null; canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, moved: 0, t: e.timeStamp }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
  canvas.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x; drag.x = e.clientX; drag.moved += Math.abs(dx); api.rotY += dx * .011; api.vel = clamp(dx * .11, -9, 9); });
  const up = () => { if (!drag) return; if (drag.moved < 5) api.pulse(1.1); drag = null; canvas.style.cursor = 'grab'; }; canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  function frame(now) {
    const t = (now - t0) / 1000, dt = Math.min(.05, (now - last) / 1000); last = now;
    uni.uTime.value = t; api.hue = lerp(api.hue, api.hueT, 1 - Math.exp(-dt * 3)); uni.uHue.value = api.hue; document.documentElement.style.setProperty('--gem-h', String(Math.round(150 + api.hue * 300)));
    uni.uIntro.value = reduced ? 1 : clamp((now - tIntro) / 2800, 0, 1); const intro = easeOut(uni.uIntro.value);
    api.pulseV = lerp(api.pulseV, 0, 1 - Math.exp(-dt * 2.2)); uni.uPulse.value = api.pulseV; uni.uGlow.value = lerp(uni.uGlow.value, api.glowT + api.pulseV * .8, 1 - Math.exp(-dt * 4));
    mouse.x = lerp(mouse.x, mouse.tx, 1 - Math.exp(-dt * 3.4)); mouse.y = lerp(mouse.y, mouse.ty, 1 - Math.exp(-dt * 3.4));
    api.vel *= Math.exp(-dt * 1.5); if (!drag) api.rotY += (.22 + api.vel) * dt; group.rotation.y = api.rotY + mouse.x * .35; group.rotation.x = mouse.y * .14; group.position.y = -.2 + Math.sin(t * .9) * .04 + (1 - intro) * -.25; const s = (.82 + .18 * intro) * (1 + Math.sin(t * .8) * .008 + api.pulseV * .05); group.scale.setScalar(s);
    camera.position.x = mouse.x * .3; camera.position.y = .15 - mouse.y * .12; camera.lookAt(0, -.1, 0);
    rimM.opacity = .55 * intro * (.75 + .25 * Math.sin(t * 1.6)); rimM.color.setHSL((150 + api.hue * 300) / 360, .75, .68); pool.material.opacity = .5 * intro * (.8 + .2 * Math.sin(t * 1.3)); pool.material.color.setHSL((150 + api.hue * 300) / 360, .8, .6); m.color.setHSL((150 + api.hue * 300) / 360, .8, .62);
    const arr = pg.attributes.position.array; for (let i = 0; i < N; i++) { const sd = seed[i], a = sd[0] + t * sd[3] * .4, y = ((sd[2] + t * sd[3] * .06) % 1) * 4.2 - 1.8; arr[i * 3] = Math.cos(a) * sd[1]; arr[i * 3 + 1] = y; arr[i * 3 + 2] = Math.sin(a) * sd[1] * .7; } pg.attributes.position.needsUpdate = true; dust.material.opacity = .55 * intro;
    renderer.render(scene, camera);
  }
  api.frame = frame; return api;
}

/** A polished picture of a stone (for the gemstone shelf): its own tiny renderer, drawn once, thrown away. */
function gemStill({ hue = 0, seed = 0, lock = 0, size = 360, rot = .5 } = {}) {
  try {
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const r = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true }); r.setSize(size, size, false); r.setClearColor(0x000000, 0);
    const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(28, 1, .1, 50); cam.position.set(0, 0, 5.7);
    const u = { uTime: { value: 3 + seed }, uIntro: { value: 1 }, uHue: { value: hue }, uGlow: { value: 0 }, uPulse: { value: 0 }, uSeed: { value: seed }, uLock: { value: lock }, uMat: { value: matcapTex }, uMatAmt: { value: matcapTex ? 1 : 0 } };
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), new THREE.ShaderMaterial({ vertexShader: GEM_VERT, fragmentShader: GEM_FRAG, uniforms: u })); m.rotation.y = rot; sc.add(m); r.render(sc, cam);
    const url = cv.toDataURL('image/png'); r.dispose(); const ext = r.getContext().getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); return url;
  } catch { return ''; }
}
/** Live stones. One WebGL renderer draws every stone that is on the screen into its own 2D canvas, so a whole shelf can turn
    and shine in 3D without a WebGL context for each. `cv` is a <canvas>; returns { stop, set }. Drag on it to turn the stone. */
const live = { r: null, sc: null, cam: null, mesh: null, u: null, cv: null, items: new Set(), raf: 0, rr: 0, t0: 0 };
function liveInit() {
  if (live.r) return true;
  try {
    const cv = document.createElement('canvas'); cv.width = cv.height = 480;
    const r = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true }); r.setSize(480, 480, false); r.setClearColor(0x000000, 0);
    const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(28, 1, .1, 50); cam.position.set(0, 0, 5.7);
    const u = { uTime: { value: 3 }, uIntro: { value: 1 }, uHue: { value: 0 }, uGlow: { value: 0 }, uPulse: { value: 0 }, uSeed: { value: 0 }, uLock: { value: 0 }, uMat: { value: matcapTex }, uMatAmt: { value: matcapTex ? 1 : 0 } };
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 72), new THREE.ShaderMaterial({ vertexShader: GEM_VERT, fragmentShader: GEM_FRAG, uniforms: u })); sc.add(mesh);
    Object.assign(live, { r, sc, cam, mesh, u, cv }); live.t0 = performance.now(); return true;
  } catch { return false; }
}
function liveFrame(now) {
  live.raf = requestAnimationFrame(liveFrame);
  const list = [...live.items]; if (!list.length) { cancelAnimationFrame(live.raf); live.raf = 0; return; }
  // the stones that are in view, a few per frame, so that a full shelf never slows the screen down
  const vis = list.filter((it) => { if (!it.cv.isConnected) return false; const b = it.cv.getBoundingClientRect(); return b.width > 0 && b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth; });
  const n = Math.min(vis.length, 5);
  for (let k = 0; k < n; k++) {
    const it = vis[(live.rr + k) % vis.length], dt = Math.min(0.1, (now - (it.last || now)) / 1000); it.last = now;
    if (!it.drag) it.rot += it.spin * dt; else it.rot += it.vel; it.vel *= 0.94;
    live.u.uHue.value = it.hue; live.u.uSeed.value = it.seed; live.u.uLock.value = it.lock; live.u.uTime.value = 3 + it.seed + now / 9000; live.u.uMat.value = matcapTex; live.u.uMatAmt.value = matcapTex ? 1 : 0;
    live.mesh.rotation.y = it.rot; live.mesh.rotation.x = it.tilt; live.r.render(live.sc, live.cam);
    const c = it.cv, x = it.ctx; if (c.width !== it.px) { c.width = c.height = it.px; } x.clearRect(0, 0, c.width, c.height); x.drawImage(live.cv, 0, 0, c.width, c.height);
  }
  live.rr = (live.rr + n) % Math.max(1, vis.length);
}
function gemLive(cv, o = {}) {
  if (!liveInit()) return { stop() {}, set() {} };
  const it = { cv, ctx: cv.getContext('2d'), hue: o.hue || 0, seed: o.seed || 0, lock: o.lock || 0, spin: reduced ? 0 : (o.spin ?? .3), rot: o.rot ?? .5, tilt: o.tilt ?? 0, px: o.px || 300, vel: 0, drag: false, last: 0 };
  live.items.add(it);
  if (o.drag) {
    let sx = 0, lx = 0;
    cv.style.touchAction = 'none'; cv.style.cursor = 'grab';
    cv.addEventListener('pointerdown', (e) => { it.drag = true; sx = lx = e.clientX; try { cv.setPointerCapture(e.pointerId); } catch { /* ignore */ } cv.style.cursor = 'grabbing'; });
    cv.addEventListener('pointermove', (e) => { if (!it.drag) return; it.vel = (e.clientX - lx) * 0.012; lx = e.clientX; });
    ['pointerup', 'pointercancel'].forEach((ev) => cv.addEventListener(ev, () => { it.drag = false; cv.style.cursor = 'grab'; }));
  }
  if (!live.raf) live.raf = requestAnimationFrame(liveFrame);
  return { stop() { live.items.delete(it); }, set(p) { Object.assign(it, p); } };
}
/** A horizontal shelf: fades softly at the edges, scrolls by drag, wheel with Shift, arrows and the keyboard. */
function hscroll(sc) {
  if (sc.parentNode.classList.contains('hs')) return sc.parentNode;
  const wrap = document.createElement('div'); wrap.className = 'hs'; sc.parentNode.insertBefore(wrap, sc); wrap.append(sc); sc.classList.add('hs-sc'); sc.tabIndex = 0;
  const mk = (d) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'hs-nav ' + (d < 0 ? 'prev' : 'next'); b.setAttribute('aria-label', d < 0 ? 'Previous' : 'Next'); b.innerHTML = `<svg class="ico"><use href="#i-${d < 0 ? 'left' : 'right'}"/></svg>`; b.addEventListener('click', () => sc.scrollBy({ left: d * Math.max(240, sc.clientWidth * .8), behavior: 'smooth' })); wrap.append(b); return b; };
  const prev = mk(-1), next = mk(1);
  const upd = () => { const max = sc.scrollWidth - sc.clientWidth, x = sc.scrollLeft; sc.style.setProperty('--ml', clamp(x, 0, 56) + 'px'); sc.style.setProperty('--mr', clamp(max - x, 0, 72) + 'px'); prev.classList.toggle('on', x > 4); next.classList.toggle('on', max - x > 4); };
  sc.addEventListener('scroll', upd, { passive: true }); if (window.ResizeObserver) new ResizeObserver(upd).observe(sc); requestAnimationFrame(upd); setTimeout(upd, 400); setTimeout(upd, 1500);
  let d = null, moved = 0;
  sc.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' || e.button) return; d = { x: e.clientX, l: sc.scrollLeft }; moved = 0; });
  window.addEventListener('pointermove', (e) => { if (!d) return; const dx = e.clientX - d.x; moved = Math.max(moved, Math.abs(dx)); if (moved > 5) { sc.classList.add('dragging'); sc.scrollLeft = d.l - dx; } });
  window.addEventListener('pointerup', () => { if (!d) return; d = null; setTimeout(() => sc.classList.remove('dragging'), 0); });
  sc.addEventListener('click', (e) => { if (moved > 5) { e.stopPropagation(); e.preventDefault(); moved = 0; } }, true);
  sc.addEventListener('wheel', (e) => { if (e.shiftKey && Math.abs(e.deltaX) < Math.abs(e.deltaY)) { sc.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
  sc.addEventListener('keydown', (e) => { if (e.target !== sc) return; if (e.key === 'ArrowRight') { sc.scrollBy({ left: 160, behavior: 'smooth' }); e.preventDefault(); } if (e.key === 'ArrowLeft') { sc.scrollBy({ left: -160, behavior: 'smooth' }); e.preventDefault(); } });
  return wrap;
}
/* ============================================================ glass behaviour: spotlight, tilt, magnetic button, ripple */
const grid = $('.grid');
document.addEventListener('pointermove', (e) => {
  const app = $('#app').getBoundingClientRect(); mouse.tx = ((e.clientX - app.left) / app.width - .5) * 2; mouse.ty = ((e.clientY - app.top) / app.height - .5) * 2;
  const cg = $('#cglow'); cg.style.opacity = '1'; cg.style.transform = `translate(${e.clientX - app.left}px, ${e.clientY - app.top}px)`;
  const g = e.target.closest ? e.target.closest('.glass') : null;
  if (g) { const r = g.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; g.style.setProperty('--mx', x + 'px'); g.style.setProperty('--my', y + 'px'); if (g.classList.contains('tilt') && !reduced) { const rx = ((y / r.height) - .5) * -4, ry = ((x / r.width) - .5) * 5; g.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`; } }
}, { passive: true });
document.addEventListener('pointerout', (e) => { const g = e.target.closest && e.target.closest('.glass.tilt'); if (g && !g.contains(e.relatedTarget)) g.style.transform = ''; });
document.documentElement.addEventListener('mouseleave', () => { $('#cglow').style.opacity = '0'; mouse.tx = mouse.ty = 0; });
const cta = $('#cta');
cta.addEventListener('pointermove', (e) => { if (reduced) return; const r = cta.getBoundingClientRect(); cta.style.transform = `translate(${((e.clientX - r.left) / r.width - .5) * 14}px, ${((e.clientY - r.top) / r.height - .5) * 9}px) scale(1.025)`; });
cta.addEventListener('pointerleave', () => { cta.style.transform = ''; });
function ripple(btn, e) { const r = btn.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2, s = document.createElement('span'); s.className = 'ripple'; s.style.cssText = `width:${d}px;height:${d}px;left:${(e.clientX || r.left + r.width / 2) - r.left - d / 2}px;top:${(e.clientY || r.top + r.height / 2) - r.top - d / 2}px`; btn.append(s); setTimeout(() => s.remove(), 850); }
document.addEventListener('pointerdown', (e) => { const b = e.target.closest && e.target.closest('.cta'); if (b) ripple(b, e); });
$$('.gauge').forEach((g) => { const on = () => { window.__gem && window.__gem.setHue(GAUGES[g.dataset.g].hue); }, off = () => { window.__gem && window.__gem.setHue(window.__gem.base || 0); }; g.addEventListener('pointerenter', on); g.addEventListener('focus', on); g.addEventListener('pointerleave', off); g.addEventListener('blur', off); });

/* ============================================================ dock with a springy highlight */
const dock = $('#dock'), dockHi = $('#dockHi');
function moveDock(btn, instant) { const r = btn.getBoundingClientRect(), d = dock.getBoundingClientRect(); if (instant) dockHi.style.transition = 'none'; dockHi.style.width = r.width + 'px'; dockHi.style.transform = `translateX(${r.left - d.left}px)`; if (instant) { dockHi.offsetWidth; dockHi.style.transition = ''; } }
/* ---- router: Home is the stage; every other screen registers itself in ET.screens and is built the first time it is opened ---- */
const ET = window.ET = { screens: {}, view: 'home', words: WORDS };
const views = {}; let switching = false;
async function go(name) {
  if (name === ET.view || switching) return;
  const scr = ET.screens[name]; if (name !== 'home' && !scr) { toast(W().toastTab); return; }
  switching = true; const from = ET.view === 'home' ? $('#stage') : views[ET.view];
  const hiTab = name === 'settings' ? 'profile' : name; $$('button', dock).forEach((x) => { if (x.dataset.tab !== hiTab) x.removeAttribute('aria-current'); else x.setAttribute('aria-current', 'page'); }); moveDock($(`[data-tab=${hiTab}]`, dock));
  from.classList.add('leave'); await wait(reduced ? 0 : 240); from.hidden = true; from.classList.remove('leave');
  ET.view = name; $('#app').dataset.view = name; $('#tbTitle').textContent = scr ? (typeof scr.title === 'function' ? scr.title() : scr.title) : '';
  let to; if (name === 'home') to = $('#stage'); else { if (!views[name]) { const el = document.createElement('main'); el.className = 'view'; el.id = 'view-' + name; $('#app').insertBefore(el, $('#miniSession')); views[name] = el; scr.mount(el); } to = views[name]; if (scr.show) scr.show(to); }
  to.hidden = false; to.classList.add('enter'); setTimeout(() => to.classList.remove('enter'), 1000); to.scrollTop = 0; switching = false;
  if (!reduced && window.__gem && name === 'home') window.__gem.pulse(.5);
}
$$('button', dock).forEach((b) => b.addEventListener('click', () => { if (b.dataset.tab === 'home' && ET.view === 'home') return; go(b.dataset.tab); }));
let toastT; function toast(msg) { $('#toastText').textContent = msg; const t = $('#toast'); t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200); }
$('#toRules').addEventListener('click', () => go('rules')); $$('.mini-rule').forEach((b) => b.addEventListener('click', () => go('rules')));
$('#streakChip').addEventListener('click', () => { const f = $('.flame svg'); f.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25) rotate(-6deg)' }, { transform: 'scale(1)' }], { duration: 700, easing: 'cubic-bezier(.34,1.56,.64,1)' }); $('#flameNum').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.4)' }, { transform: 'scale(1)' }], { duration: 600 }); });

/* ============================================================ the wheel picker (snap, drag, keyboard; items curve away from the middle) */
function wheel(root, items, initial, onChange, fmt = (v) => v) {
  const list = $('.wheel-list', root); list.innerHTML = ''; const els = items.map((v) => { const d = document.createElement('div'); d.textContent = fmt(v); d.setAttribute('role', 'option'); list.append(d); return d; });
  let idx = Math.max(0, items.indexOf(initial)), ready = false; const IH = 44; const pad = () => { list.style.paddingTop = list.style.paddingBottom = Math.max(0, (list.clientHeight - IH) / 2) + 'px'; }; pad();
  const paint = () => { const c = list.scrollTop / IH; els.forEach((e, i) => { const d = i - c, a = Math.abs(d); e.style.transform = `translateZ(${-a * 12}px) rotateX(${clamp(d * -22, -70, 70)}deg) scale(${1 - Math.min(a, 3) * .06})`; e.style.opacity = String(clamp(1 - a * .3, .12, 1)); e.style.color = a < .5 ? 'var(--text)' : 'var(--text-2)'; e.setAttribute('aria-selected', String(a < .5)); }); const n = clamp(Math.round(c), 0, items.length - 1); if (n !== idx && ready) { idx = n; onChange(items[idx]); } };
  let snapT; const snap = () => { if (down) return; const target = clamp(Math.round(list.scrollTop / IH), 0, items.length - 1) * IH; if (Math.abs(list.scrollTop - target) > .5) list.scrollTo({ top: target, behavior: 'smooth' }); };
  list.addEventListener('scroll', () => { requestAnimationFrame(paint); clearTimeout(snapT); snapT = setTimeout(snap, 120); }, { passive: true });
  let down = false, sy = 0, st = 0, vel = 0, ly = 0, lt = 0;
  list.addEventListener('pointerdown', (e) => { down = true; sy = e.clientY; st = list.scrollTop; list.classList.add('drag'); list.setPointerCapture(e.pointerId); ly = e.clientY; lt = e.timeStamp; vel = 0; });
  list.addEventListener('pointermove', (e) => { if (!down) return; list.scrollTop = st - (e.clientY - sy); const dt = e.timeStamp - lt; if (dt > 0) vel = (e.clientY - ly) / dt; ly = e.clientY; lt = e.timeStamp; });
  const end = () => { if (!down) return; down = false; list.classList.remove('drag'); const target = clamp(Math.round((list.scrollTop - vel * 160) / IH), 0, items.length - 1); list.scrollTo({ top: target * IH, behavior: 'smooth' }); };
  list.addEventListener('pointerup', end); list.addEventListener('pointercancel', end);
  list.addEventListener('keydown', (e) => { const k = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0; if (k) { e.preventDefault(); list.scrollTo({ top: clamp(idx + k, 0, items.length - 1) * IH, behavior: 'smooth' }); } });
  els.forEach((e, i) => e.addEventListener('click', () => list.scrollTo({ top: i * IH, behavior: 'smooth' })));
  const api = { set(v) { pad(); idx = Math.max(0, items.indexOf(v)); list.scrollTop = idx * IH; paint(); }, sync() { pad(); list.scrollTop = idx * IH; paint(); } };
  requestAnimationFrame(() => { pad(); list.scrollTop = idx * IH; paint(); ready = true; }); return api;
}

/* ============================================================ the focus sheet */
const S = { more: { close: true, dnd: true, mute: false, cycles: false, breaks: true }, scene: 'dawn', name: 'Focus', min: 25, blocks: new Set(['Instagram', 'YouTube', 'X', 'Telegram', 'TikTok']), diff: 0 };
const BLOCKABLE = [['Instagram', '#e1306c'], ['YouTube', '#ff3b30'], ['X', '#111'], ['Telegram', '#2aa3e4'], ['TikTok', '#16d6c8'], ['Reddit', '#ff5700'], ['Discord', '#5865f2'], ['Steam', '#2b4f7d'], ['Netflix', '#d81f26']];
const DURS = [5, 10, 15, 20, 25, 30, 45, 50, 60, 75, 90, 120];
let durWheel, unWheel;
function renderSheet() {
  $('#durVal').textContent = S.min >= 60 && S.min % 60 === 0 ? `${S.min / 60}${lang === 'ru' ? ' ч' : 'h'}` : `${S.min}${lang === 'ru' ? ' мин' : 'm'}`;
  $('#blockVal').textContent = W().blockedN(S.blocks.size, S.blocks.size * 3 + 4); $('#diffVal').textContent = W().diff[S.diff];
  const bc = $('#blockChips'); bc.innerHTML = ''; BLOCKABLE.forEach(([n, c]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.setAttribute('aria-pressed', String(S.blocks.has(n))); b.innerHTML = `<span class="app-tile" data-n="${String(n).replace(/"/g, '&quot;')}" style="background:${c}">${n.slice(0, 2)}</span>${n}`; b.addEventListener('click', () => { S.blocks.has(n) ? S.blocks.delete(n) : S.blocks.add(n); b.setAttribute('aria-pressed', String(S.blocks.has(n))); $('#blockVal').textContent = W().blockedN(S.blocks.size, S.blocks.size * 3 + 4); }); bc.append(b); });
  const labels = W().diff; $$('#seg button').forEach((b, i) => { b.textContent = labels[i]; b.setAttribute('aria-pressed', String(i === S.diff)); }); $('.seg-hi').style.transform = `translateX(${S.diff * 100}%)`; $('#segDesc').textContent = W().diffDesc[S.diff]; $('#infoLine').textContent = W().info[S.diff];
  { const mo = $('#moreList'), names = { close: W().mClose, dnd: W().mDnd, mute: W().mMute, cycles: W().mCycles, breaks: W().mBreaks }; mo.innerHTML = '';
    Object.keys(names).forEach((k) => { const r = document.createElement('div'); r.className = 'mo-row'; r.innerHTML = `<span>${names[k]}</span><button class="sw" role="switch" aria-checked="${S.more[k]}" type="button" aria-label="${names[k]}"></button>`; $('.sw', r).addEventListener('click', (e) => { S.more[k] = !S.more[k]; e.currentTarget.setAttribute('aria-checked', String(S.more[k])); $('#moreVal').textContent = Object.values(S.more).filter(Boolean).length + ' ' + W().on; }); mo.append(r); });
    $('#moreVal').textContent = Object.values(S.more).filter(Boolean).length + ' ' + W().on; }
  $('#startBtn').disabled = S.blocks.size === 0; $('#startBtn').style.opacity = S.blocks.size === 0 ? .5 : 1;
}
$$('#seg button').forEach((b) => b.addEventListener('click', () => { S.diff = +b.dataset.v; renderSheet(); }));
$$('.opt > button').forEach((b) => b.addEventListener('click', () => { const o = b.parentElement, open = !o.classList.contains('open'); $$('.opt').forEach((x) => { x.classList.remove('open'); x.firstElementChild.setAttribute('aria-expanded', 'false'); }); if (open) { o.classList.add('open'); b.setAttribute('aria-expanded', 'true'); if (o.id === 'optDur') setTimeout(() => durWheel && durWheel.sync(), 80); } }));
let lastFocus = null;
function openScrim(id) { const s = $(id); lastFocus = document.activeElement; s.classList.add('on'); s.setAttribute('aria-hidden', 'false'); return s; }
function closeScrim(id) { const s = $(id); s.classList.remove('on'); s.setAttribute('aria-hidden', 'true'); if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); }
function openSheet() { renderSheet(); openScrim('#sheetScrim'); setTimeout(() => $('#startBtn').focus({ preventScroll: true }), 300); window.__gem && window.__gem.glow(.25); }
function closeSheet() { closeScrim('#sheetScrim'); window.__gem && window.__gem.glow(0); }
$('#sheetClose').addEventListener('click', closeSheet); $('#sheetScrim').addEventListener('pointerdown', (e) => { if (e.target.id === 'sheetScrim') closeSheet(); });
$('#sheetName').addEventListener('input', (e) => { S.name = e.target.value || 'Focus'; }); $('#laterBtn').addEventListener('click', () => toast(W().toastLater));
cta.addEventListener('click', openSheet);

/* ============================================================ unblock */
let unMin = 5, openUntil = 0, openTimer = null, blockedNow = true;
let realCard = null;
function renderBlockCard() {
  const card = $('#blockCard'), ring = $('#blockRing'); card.classList.toggle('is-open', !blockedNow);
  $('#blockTitle').textContent = blockedNow ? (realCard ? realCard.title : W().workTime) : W().unblocked; $('#blockSub').textContent = blockedNow ? (realCard ? realCard.sub : W().blockSub) : W().unblockedSub;
  $('#blockIcon').firstElementChild.setAttribute('href', blockedNow ? '#i-shield' : '#i-unlock');
  const b = $('#unblockBtn'); b.querySelector('span').textContent = blockedNow ? W().unblock : W().blockAgain; b.querySelector('use').setAttribute('href', blockedNow ? '#i-unlock' : '#i-lock');
}
function tickOpen() { const left = Math.max(0, openUntil - Date.now()); const s = Math.ceil(left / 1000); $('#blockTimer').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; $('#blockRing').style.strokeDashoffset = String(100 - (left / (unMin * 60000)) * 100); if (left <= 0) relock(); }
function relock() { clearInterval(openTimer); blockedNow = true; $('#blockRing').style.strokeDashoffset = '0'; renderBlockCard(); toast(W().blockedAgainT); }
$('#unblockBtn').addEventListener('click', () => { if (!blockedNow) { relock(); return; } $('#unTitle').textContent = W().unTitle('Instagram'); $('#unLeft').textContent = W().unLeft(7); $('#unGo').textContent = W().unGo(unMin); $('#unNever').textContent = W().unNever; openScrim('#unScrim'); unWheel = unWheel || wheel($('#unWheel'), [1, 2, 3, 4, 5, 6, 7, 8, 10, 15], 5, (v) => { unMin = v; $('#unGo').textContent = W().unGo(v); }, (v) => `${v} ${lang === 'ru' ? 'мин' : 'minutes'}`); setTimeout(() => unWheel.sync(), 120); });
$('#unClose').addEventListener('click', () => closeScrim('#unScrim')); $('#unNever').addEventListener('click', () => closeScrim('#unScrim')); $('#unScrim').addEventListener('pointerdown', (e) => { if (e.target.id === 'unScrim') closeScrim('#unScrim'); });
$('#unGo').addEventListener('click', () => { closeScrim('#unScrim'); blockedNow = false; openUntil = Date.now() + unMin * 60000; renderBlockCard(); clearInterval(openTimer); tickOpen(); openTimer = setInterval(tickOpen, 250); });

/* ============================================================ landscape (sky, mountains, a lake with shimmer): the session's world */
const SCENES = {
  dawn: { hz: .5, seed: 11, sky: ['#5b7cc0', '#a7a4dc', '#f0b3d6', '#ffe0cf'], sun: ['255,248,225', '255,214,190', '255,200,200'], mt: [['#8c8fc4', '#b9a6cf'], ['#5f6d9c', '#8f88b6'], ['#2f3f52', '#3d4d5f']], fog: 'rgba(255,222,215,.55)', water: ['rgba(70,96,120,.40)', 'rgba(24,52,64,.66)', 'rgba(6,20,26,.9)'], cloud: '255,240,245' },
  dusk: { hz: .6, seed: 21, sky: ['#27456f', '#5b78ae', '#ee9e8c', '#ffd2a0'], sun: ['255,236,200', '255,176,140', '255,150,130'], mt: [['#6b7fa6', '#9a9bb8'], ['#42557a', '#6c759b'], ['#1c2a42', '#2a3a52']], fog: 'rgba(255,200,170,.5)', water: ['rgba(60,90,120,.42)', 'rgba(20,48,66,.7)', 'rgba(4,16,24,.92)'], cloud: '255,214,200' },
  meadow: { hz: .6, water: false, seed: 31, sky: ['#40367f', '#8a62bd', '#ee86b4', '#ffc6a6'], sun: ['255,232,210', '255,170,190', '255,140,170'], mt: [['#7a5aa0', '#a56ab0'], ['#4d3d82', '#7a5aa0'], ['#241e4a', '#33295e']], fog: 'rgba(255,190,210,.5)', water: ['rgba(80,60,130,.4)', 'rgba(36,26,80,.7)', 'rgba(10,6,28,.92)'], cloud: '255,200,225' },
  forest: { hz: .58, seed: 41, sky: ['#9fb6ae', '#c3d3c8', '#e1eadd', '#f3f5ea'], sun: ['255,255,235', '240,250,225', '230,245,220'], mt: [['#9db3a7', '#c0d0c5'], ['#6f8a7d', '#98ad9f'], ['#2f4a3a', '#42604e']], fog: 'rgba(235,245,230,.6)', water: ['rgba(90,120,110,.42)', 'rgba(30,62,54,.68)', 'rgba(6,22,18,.92)'], cloud: '245,250,240' },
  night: { hz: .58, seed: 51, stars: true, sky: ['#040813', '#0a1530', '#16294c', '#2b4467'], sun: ['210,230,255', '120,160,220', '80,120,200'], mt: [['#1d2a46', '#2d3f62'], ['#121b32', '#1d2c4b'], ['#070c18', '#0d1526']], fog: 'rgba(80,115,170,.35)', water: ['rgba(40,70,110,.4)', 'rgba(10,26,52,.72)', 'rgba(2,8,18,.94)'], cloud: '120,150,200' },
};
SCENES.dunes = { ...SCENES.night, hz: .68, water: false, seed: 61 };
class Landscape {
  constructor(canvas, scene = 'dawn') { this.pal = SCENES[scene] || SCENES.dawn; this.photo = photos['scene-' + (SCENES[scene] ? scene : 'dawn')] || null; this.c = canvas; this.x = canvas.getContext('2d'); this.layer = document.createElement('canvas'); this.glints = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), p: Math.random() * 6.28, s: .6 + Math.random() * 1.8, r: .7 + Math.random() * 1.6 })); this.clouds = []; this.seed = this.pal.seed; this.size(); }
  size() { const r = this.c.getBoundingClientRect(); this.w = Math.max(2, Math.round(r.width)); this.h = Math.max(2, Math.round(r.height)); const d = Math.min(devicePixelRatio || 1, 1.5); this.c.width = this.w * d; this.c.height = this.h * d; this.x.setTransform(d, 0, 0, d, 0, 0); this.layer.width = this.w; this.layer.height = this.h; this.build(); }
  ridge(x, rnd, amp, rough) { let v = 0, a = amp, f = 1; for (let o = 0; o < 6; o++) { v += (1 - Math.abs(Math.sin(x * f * 6.3 + rnd[o] * 9))) * a - a * .5; a *= rough; f *= 2.1; } return v; }
  buildPhoto() {
    const { w, h, pal: P } = this, c = this.layer.getContext('2d'), im = this.photo, k = Math.max(w / im.width, h / im.height);
    c.clearRect(0, 0, w, h); c.drawImage(im, (w - im.width * k) / 2, (h - im.height * k) * .55, im.width * k, im.height * k); this.hz = (P.hz || .55) * h; this.water = P.water !== false;
  }
  drawPhoto(t) {
    const { w, h, hz, x } = this; if (h < 60 || w < 60) return; x.clearRect(0, 0, w, h); x.save();
    const s = 1.02 + .035 * (.5 + .5 * Math.sin(t * .05)), fy = hz; x.translate(w / 2 + Math.sin(t * .03) * w * .006, fy); x.scale(s, s); x.translate(-w / 2, -fy);
    x.drawImage(this.layer, 0, 0, w, hz + 1, 0, 0, w, hz + 1);
    if (this.water) { for (let y = hz; y < h; y += 3) { const k = (y - hz) / (h - hz), dx = Math.sin(y * .05 + t * 1.2) * (.6 + k * 3.2); x.drawImage(this.layer, 0, y, w, 3, dx - 5, y, w + 10, 3); } }
    else x.drawImage(this.layer, 0, hz, w, h - hz, 0, hz, w, h - hz);
    if (this.water) for (const g of this.glints) { const a = Math.max(0, Math.sin(t * g.s + g.p)); if (a < .72) continue; const gx = g.x * w, gy = hz + 10 + Math.pow(g.y, 1.5) * Math.max(1, h - hz - 14), r = Math.max(.4, g.r * (1 + (gy - hz) / h * 2)); x.globalAlpha = (a - .72) / .28 * .8; x.fillStyle = '#fff'; x.fillRect(gx - r * 2.4, gy - .5, r * 4.8, 1); x.fillRect(gx - .5, gy - r, 1, r * 2); x.beginPath(); x.arc(gx, gy, r * .6, 0, 6.283); x.fill(); x.globalAlpha = 1; }
    x.restore();
  }
  build() {
    if (this.photo) return this.buildPhoto();
    const { w, h, pal: P } = this, c = this.layer.getContext('2d'), hz = h * .56, rnd = mulberry(this.seed), phases = (k) => Array.from({ length: 6 }, () => rnd() + k);
    const sky = c.createLinearGradient(0, 0, 0, hz); [0, .38, .7, 1].forEach((o, i) => sky.addColorStop(o, P.sky[i])); c.fillStyle = sky; c.fillRect(0, 0, w, h);
    if (P.stars) { for (let i = 0; i < 160; i++) { c.globalAlpha = .25 + rnd() * .7; c.fillStyle = '#e8f0ff'; c.beginPath(); c.arc(rnd() * w, rnd() * hz * .8, .4 + rnd() * 1.1, 0, 6.283); c.fill(); } c.globalAlpha = 1; }
    const sx = P.stars ? .3 : .66, sun = c.createRadialGradient(w * sx, hz * (P.stars ? .35 : .96), 0, w * sx, hz * (P.stars ? .35 : .96), w * (P.stars ? .2 : .32)); sun.addColorStop(0, `rgba(${P.sun[0]},.95)`); sun.addColorStop(.25, `rgba(${P.sun[1]},.5)`); sun.addColorStop(1, `rgba(${P.sun[2]},0)`); c.fillStyle = sun; c.fillRect(0, 0, w, h);
    if (P.stars) { c.fillStyle = '#f2f6ff'; c.beginPath(); c.arc(w * sx, hz * .35, Math.max(14, w * .018), 0, 6.283); c.fill(); }
    const layers = [{ k: 1, base: hz - h * .09, amp: h * .12, rough: .5 }, { k: 2, base: hz - h * .035, amp: h * .13, rough: .52 }, { k: 3, base: hz + 2, amp: h * .06, rough: .5 }];
    layers.forEach((L, li) => { const ph = phases(L.k); c.beginPath(); c.moveTo(0, hz + 4); for (let x = 0; x <= w; x += 3) c.lineTo(x, L.base - this.ridge(x / w + L.k * .31, ph, L.amp, L.rough)); c.lineTo(w, hz + 4); c.closePath(); const g = c.createLinearGradient(0, L.base - L.amp, 0, hz); g.addColorStop(0, P.mt[li][0]); g.addColorStop(1, P.mt[li][1]); c.fillStyle = g; c.fill(); });
    const fog = c.createLinearGradient(0, hz - h * .12, 0, hz + 2); fog.addColorStop(0, P.fog.replace(/[\d.]+\)$/, '0)')); fog.addColorStop(1, P.fog); c.fillStyle = fog; c.fillRect(0, hz - h * .12, w, h * .12 + 2);
    this.hz = hz; this.cloudSprite = document.createElement('canvas'); this.cloudSprite.width = w * 2; this.cloudSprite.height = hz; const cc = this.cloudSprite.getContext('2d'); for (let i = 0; i < 16; i++) { const cx = rnd() * w * 2, cy = hz * (.12 + rnd() * .5), rw = 80 + rnd() * 240, rh = 12 + rnd() * 26; const g = cc.createRadialGradient(cx, cy, 0, cx, cy, rw); g.addColorStop(0, `rgba(${P.cloud},.5)`); g.addColorStop(1, `rgba(${P.cloud},0)`); cc.save(); cc.translate(cx, cy); cc.scale(1, rh / rw); cc.translate(-cx, -cy); cc.fillStyle = g; cc.beginPath(); cc.arc(cx, cy, rw, 0, 6.283); cc.fill(); cc.restore(); }
  }
  draw(t) {
    if (this.photo) return this.drawPhoto(t);
    const { w, h, hz } = this, x = this.x; x.clearRect(0, 0, w, h);
    x.drawImage(this.layer, 0, 0, w, hz + 2, 0, 0, w, hz + 2);
    const off = (t * 5) % (w * 2); x.save(); x.beginPath(); x.rect(0, 0, w, hz); x.clip(); x.globalAlpha = .9; x.drawImage(this.cloudSprite, -off, 0); x.drawImage(this.cloudSprite, w * 2 - off, 0); x.restore();
    /* mirrored water with a gentle ripple, in strips */
    const strip = 3; for (let y = hz; y < h; y += strip) { const k = (y - hz) / (h - hz), src = hz - (y - hz) * .92; if (src < 0) break; const dx = Math.sin(y * .06 + t * 1.4) * (1.5 + k * 7); x.drawImage(this.layer, 0, src, w, strip, dx - 6, y, w + 12, strip); }
    const wg = x.createLinearGradient(0, hz, 0, h); wg.addColorStop(0, this.pal.water[0]); wg.addColorStop(.5, this.pal.water[1]); wg.addColorStop(1, this.pal.water[2]); x.fillStyle = wg; x.fillRect(0, hz, w, h - hz);
    for (const g of this.glints) { const a = Math.max(0, Math.sin(t * g.s + g.p)); if (a < .55) continue; const gx = g.x * w + Math.sin(t * .3 + g.p) * 8, gy = hz + 6 + Math.pow(g.y, 1.4) * (h - hz - 8), r = g.r * (1 + (gy - hz) / h * 2.6), al = (a - .55) / .45; x.globalAlpha = al * .9; x.fillStyle = '#fff'; x.fillRect(gx - r * 3, gy - .6, r * 6, 1.2); x.fillRect(gx - .6, gy - r * 1.2, 1.2, r * 2.4); x.beginPath(); x.arc(gx, gy, r * .8, 0, 6.283); x.fill(); x.globalAlpha = 1; }
  }
}

/* ============================================================ seven-segment timer */
const SEG = { a: [7, 1, 22, 5], g: [7, 29.5, 22, 5], d: [7, 58, 22, 5], f: [1, 6, 5, 22], b: [30, 6, 5, 22], e: [1, 35, 5, 22], c: [30, 35, 5, 22] };
const DIG = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'];
function digitEl() { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 36 64'); s.setAttribute('class', 'dg'); for (const [k, [x, y, w, h]] of Object.entries(SEG)) { const r = document.createElementNS(s.namespaceURI, 'rect'); r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', w); r.setAttribute('height', h); r.setAttribute('rx', 2.4); r.setAttribute('class', 'seg7'); r.dataset.s = k; s.append(r); } s.dataset.v = ''; return s; }
function setDigit(el, v) { if (el.dataset.v === String(v)) return; el.dataset.v = String(v); const on = DIG[v]; $$('rect', el).forEach((r) => r.classList.toggle('on', on.includes(r.dataset.s))); }
const lcd = { el: null, fmt: '', digits: [] };
function renderLcd(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60), txt = h > 0 ? `${h}${String(m).padStart(2, '0')}${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}${String(s).padStart(2, '0')}`, fmt = h > 0 ? 'hms' : 'ms';
  const root = $('#lcd'); if (lcd.fmt !== fmt) { lcd.fmt = fmt; root.innerHTML = ''; lcd.digits = []; const add = () => { const d = digitEl(); root.append(d); lcd.digits.push(d); }; const colon = () => { const c = document.createElement('div'); c.className = 'colon'; c.innerHTML = '<i></i><i></i>'; root.append(c); }; if (fmt === 'hms') { add(); colon(); add(); add(); colon(); add(); add(); } else { add(); add(); colon(); add(); add(); } }
  [...txt].forEach((ch, i) => setDigit(lcd.digits[i], +ch));
}

/* ============================================================ the session flow: sheet → 3-2-1 → the lake → done */
const run = { on: false, total: 0, left: 0, speed: 1, snooze: false, breakLeft: 0, last: 0, startedAt: 0, minimized: false, landscape: null, cdLand: null, raf: 0, cancelled: false };
const fmtClock = (ms) => { const d = new Date(ms); return lang === 'ru' ? `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };
async function startSession() {
  closeSheet(); if (run.on) return; run.cancelled = false;
  if (window.ETB && !(await window.ETB.startSession(S))) return;
  const cd = $('#countdown'); cd.classList.add('on'); const land = new Landscape($('#cdCanvas'), S.scene); land.draw(0); run.cdLand = land;
  const num = $('#cdNum'); window.__gem && window.__gem.pulse(1);
  for (const n of [3, 2, 1]) { if (run.cancelled) break; num.innerHTML = `<span>${n}</span>`; land.draw(n); await wait(reduced ? 300 : 1000); }
  cd.classList.remove('on'); num.innerHTML = ''; if (run.cancelled) return;
  beginRun();
}
$('#startBtn').addEventListener('click', startSession); $('#cdClose').addEventListener('click', () => { run.cancelled = true; $('#countdown').classList.remove('on'); $('#cdNum').innerHTML = ''; });
function beginRun() {
  run.on = true; run.total = S.min * 60; run.left = run.total; run.speed = 1; run.snooze = false; run.last = performance.now(); run.startedAt = Date.now();
  $('#sName').textContent = S.name; $('#mBlock').textContent = W().blockedN(S.blocks.size, S.blocks.size * 3 + 4); $('#mDiff').textContent = W().diff[S.diff]; $('#sBlockers').textContent = '';
  $('#tStart').textContent = fmtClock(run.startedAt); $('#tEnd').textContent = fmtClock(run.startedAt + run.total * 1000);
  const locked = S.diff >= 2, frozen = S.diff === 3; $('#sMin').style.display = frozen ? 'none' : ''; $('#sBlockers').textContent = frozen ? W().frozenTag : ''; $('#snoozeBtn').style.display = locked ? 'none' : ''; $('#leaveBtn').style.display = locked ? 'none' : ''; const ln = $('#lockedNote'); ln.style.display = locked ? 'block' : 'none'; ln.textContent = W().lockedNote(fmtClock(run.startedAt + run.total * 1000));
  $('#leaveText').textContent = S.diff === 1 ? W().holdLeave : W().leave; $('#breakBanner').classList.remove('on'); lcd.fmt = '';
  const ses = $('#session'); ses.classList.add('on', 'in'); setTimeout(() => ses.classList.remove('in'), 1300); run.landscape = new Landscape($('#sessCanvas'), S.scene);
  window.__gem && window.__gem.glow(.5); $('#miniSession').classList.remove('show'); run.minimized = false; cancelAnimationFrame(run.raf); loop(performance.now());
}
function loop(now) {
  run.raf = requestAnimationFrame(loop); const dt = (now - run.last) / 1000; run.last = now;
  if (run.on && !run.minimized) run.landscape.draw(now / 1000);
  if (!run.on) return;
  if (run.snooze) { run.breakLeft -= dt * run.speed; $('#breakTime').textContent = `${Math.floor(Math.max(0, run.breakLeft) / 60)}:${String(Math.floor(Math.max(0, run.breakLeft) % 60)).padStart(2, '0')}`; if (run.breakLeft <= 0) resume(); }
  else run.left -= dt * run.speed;
  const left = Math.max(0, run.left), p = 1 - left / run.total; renderLcd(Math.ceil(left));
  const L = Math.ceil(left), hh = Math.floor(L / 3600), mm = Math.floor((L % 3600) / 60), ss = L % 60; $('#remText').textContent = hh ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${mm}:${String(ss).padStart(2, '0')}`; $('#pctText').textContent = Math.floor(p * 100) + '%';
  $('#fillBar').style.width = (p * 100) + '%'; $('#knob').style.left = (p * 100) + '%'; $('#miniTime').textContent = $('#remText').textContent;
  if (run.left <= 0) finish(true);
}
function resume() { run.snooze = false; $('#breakBanner').classList.remove('on'); $('#snoozeBtn').style.display = S.diff === 2 ? 'none' : ''; }
$('#snoozeBtn').addEventListener('click', () => { run.snooze = true; run.breakLeft = 300; $('#breakBanner').classList.add('on'); $('#snoozeBtn').style.display = 'none'; toast(W().breakOn); }); $('#resumeBtn').addEventListener('click', resume);
$('#demoSkip').addEventListener('click', () => { run.speed = run.speed === 1 ? 60 : 1; $('#demoSkip').textContent = run.speed === 1 ? 'Demo ▸▸ ×60' : 'Demo ×60 ▸▸ · tap to slow'; });
$('#sMin').addEventListener('click', () => { run.minimized = true; $('#session').classList.remove('on'); $('#miniSession').classList.add('show'); });
$('#miniOpen').addEventListener('click', () => { run.minimized = false; $('#session').classList.add('on', 'in'); setTimeout(() => $('#session').classList.remove('in'), 1300); $('#miniSession').classList.remove('show'); });
/* leaving early: a quick tap, or a ten second hold on Timeout */
(() => {
  const b = $('#leaveBtn'), hold = $('#leaveHold'); let t0 = 0, rafId = 0;
  const need = () => (S.diff === 1 ? 10000 : 0);
  const stop = () => { cancelAnimationFrame(rafId); t0 = 0; hold.style.transition = 'width .3s'; hold.style.width = '0'; };
  const step = () => { if (!t0) return; const p = (performance.now() - t0) / need(); hold.style.transition = 'none'; hold.style.width = clamp(p, 0, 1) * 100 + '%'; if (p >= 1) { stop(); leave(); } else rafId = requestAnimationFrame(step); };
  b.addEventListener('pointerdown', () => { if (!need()) { leave(); return; } t0 = performance.now(); step(); }); ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, stop));
  b.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !need()) { e.preventDefault(); leave(); } });
  function leave() { finish(false); }
})();
function finish(completed) {
  if (!run.on) return; run.on = false; cancelAnimationFrame(run.raf); $('#session').classList.remove('on'); $('#miniSession').classList.remove('show'); window.__gem && window.__gem.glow(0);
  if (!completed) { toast(W().leftToast); return; }
  const minutes = S.min, gain = Math.max(1, Math.round(minutes / 12)); state.score = Math.min(100, state.score + gain); state.focus = Math.min(100, state.focus + gain * 2); state.focusPct = Math.min(99, state.focusPct + 2);
  const d = $('#done'); d.classList.add('on'); $('#doneText').textContent = W().doneP(S.name, minutes); $('#doneGain').innerHTML = `<svg class="ico" style="width:16px;height:16px"><use href="#i-arrow"/></svg>${W().gain(gain)}`;
  burst(); window.__gem && window.__gem.flash();
}
$('#doneBtn').addEventListener('click', async () => {
  $('#done').classList.remove('on'); cancelAnimationFrame(confRaf); await wait(120);
  countTo($('#scoreVal'), state.score, 1400); countTo($('#focusPct'), state.focusPct, 900, (v) => Math.round(v) + '%'); const g = $('[data-g=focus]'); g.querySelector('rect.fill').style.strokeDashoffset = String(100 - state.focus); countTo(g.querySelector('.gv'), state.focus, 1200);
  const f = $('.bar.now .f'); if (f) { f.style.transition = 'height 1.2s var(--out-expo)'; f.style.height = '96%'; } window.__gem && window.__gem.pulse(1); $('#streakNum').textContent = $('#flameNum').textContent = '6'; $('#streakChip').click();
});
/* confetti of small lights */
let confRaf = 0;
function burst() {
  const c = $('#confetti'), x = c.getContext('2d'); const r = c.getBoundingClientRect(); c.width = r.width * dpr; c.height = r.height * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cols = ['#d4f77c', '#8cf2c6', '#86d7ff', '#a98bff', '#ffffff']; const ps = Array.from({ length: reduced ? 0 : 150 }, () => { const a = Math.random() * 6.283, v = 4 + Math.random() * 11; return { x: r.width / 2, y: r.height * .4, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 5, r: 1.4 + Math.random() * 3.4, c: cols[(Math.random() * cols.length) | 0], life: 0, max: 90 + Math.random() * 90 }; });
  cancelAnimationFrame(confRaf); const step = () => { x.clearRect(0, 0, r.width, r.height); x.globalCompositeOperation = 'lighter'; for (const p of ps) { p.life++; p.vy += .16; p.vx *= .985; p.x += p.vx; p.y += p.vy; const a = Math.max(0, 1 - p.life / p.max); x.globalAlpha = a; x.fillStyle = p.c; x.shadowColor = p.c; x.shadowBlur = 12; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 6.283); x.fill(); } x.globalAlpha = 1; x.shadowBlur = 0; confRaf = requestAnimationFrame(step); }; step();
}

/* ============================================================ the eye break card: a live countdown and a 20 second rest */
(() => {
  const card = $('#eyeCard'); let left = 8 * 60 + 12, total = 20 * 60, resting = false, sec = 20;
  const paint = () => { $('#eyeClock').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; $('#eyeRing').style.strokeDashoffset = String(100 - (1 - left / total) * 100); };
  paint(); setInterval(() => { if (resting) return; left = Math.max(0, left - 1); if (left === 0) left = total; paint(); }, 1000);
  async function rest() { if (resting) return; resting = true; card.classList.add('is-resting'); window.__gem && window.__gem.glow(.3); for (sec = 20; sec > 0; sec--) { $('#eyeSec').textContent = sec; await wait(reduced ? 80 : 1000); } card.classList.remove('is-resting'); resting = false; left = total; paint(); window.__gem && window.__gem.glow(0); window.__gem && window.__gem.pulse(.7); state.eyes = Math.min(100, state.eyes + 2); try { const k = 'et-eyes', o = JSON.parse(localStorage.getItem(k) || '{}'), t = new Date(), d = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); o[d] = (o[d] || 0) + 1; localStorage.setItem(k, JSON.stringify(o)); } catch { /* counted only for the screens */ } const g = $('[data-g=eyes]'); g.querySelector('rect.fill').style.strokeDashoffset = String(100 - state.eyes); countTo(g.querySelector('.gv'), state.eyes, 900); toast(lang === 'ru' ? 'Глаза отдохнули. Eyes +2' : 'Eyes rested. Eyes +2'); }
  $('#eyeNow').addEventListener('click', rest);
})();

/* ============================================================ keys */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { const anyScrim = document.querySelector('.scrim.on'); if (anyScrim && !['unScrim', 'sheetScrim'].includes(anyScrim.id)) { const x = anyScrim.querySelector('.round-btn'); if (x) x.click(); return; } if ($('#unScrim').classList.contains('on')) closeScrim('#unScrim'); else if ($('#sheetScrim').classList.contains('on')) closeSheet(); else if ($('#countdown').classList.contains('on')) $('#cdClose').click(); return; }
  const typing = /INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || ''); if (typing) return;
  if (e.code === 'Space' && !run.on && !document.querySelector('.scrim.on') && !$('#done').classList.contains('on') && !$('#countdown').classList.contains('on') && !/BUTTON/.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); openSheet(); }
  if (e.key === 'ArrowLeft' && !$('#dayPrev').disabled && !document.querySelector('.scrim.on')) $('#dayPrev').click(); if (e.key === 'ArrowRight' && !$('#dayNext').disabled && !document.querySelector('.scrim.on')) $('#dayNext').click();
});
$('#langBtn').addEventListener('click', () => { lang = lang === 'ru' ? 'en' : 'ru'; store.set('et-lang', lang); applyLang(); buildChart(BARS[dayOffset]); });
/* a focus trap for the two dialogs */
document.addEventListener('keydown', (e) => { if (e.key !== 'Tab') return; const sc = document.querySelector('.scrim.on'); if (!sc) return; const f = $$('button, input, [tabindex="0"]', sc).filter((x) => !x.disabled && x.offsetParent !== null); if (!f.length) return; const first = f[0], last = f[f.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } });

/* ============================================================ boot: one orchestrated entrance */
async function boot() {
  buildSpectrum(); initStars(); drawCave(); buildChart(BARS[0]); setDelta(state.delta);
  window.__gem = initGem(); if (window.__gem) window.__gem.hueT = 0;
  { const th = store.get('et-hue'); if (th !== null && window.__gem) window.__gem.setBase(+th); }
  setTimeout(() => ['dawn', 'dusk', 'meadow', 'forest', 'night', 'dunes'].forEach((n, i) => setTimeout(() => loadPhoto('scene-' + n), i * 400)), 2500);
  loadPhoto('home', () => { drawCave(); if (window.__gem) window.__gem.setStand(false); });
  loadPhoto('opal-mint', (im) => { const g = window.__gem; if (!g) return; const tex = new THREE.Texture(im); tex.needsUpdate = true; matcapTex = tex; g.setMatcap(tex); });
  applyLang();
  const t0 = performance.now(); const cdEl = $('#countdown'), doneEl = $('#done'); function tick(now) { const covered = ET.view !== 'home' || cdEl.classList.contains('on') || doneEl.classList.contains('on') || (run.on && !run.minimized); if (!covered) { drawStars(now - t0); if (window.__gem) window.__gem.frame(now); } requestAnimationFrame(tick); } requestAnimationFrame(tick);
  durWheel = wheel($('#durWheel'), DURS, S.min, (v) => { S.min = v; renderSheet(); }, (v) => `${v} ${lang === 'ru' ? 'мин' : 'min'}`);
  requestAnimationFrame(drawCave); moveDock($('[aria-current=page]', dock), true);
  setTimeout(() => document.documentElement.classList.add('booted'), reduced ? 0 : 4200); booted = true; const d = reduced ? 0 : 1; await wait(d * 650);
  countTo($('#scoreVal'), state.score, reduced ? 0 : 1700); paintGauges(reduced ? 0 : 1900); countBig(state.screen, reduced ? 0 : 1600); countTo($('#focusPct'), state.focusPct, reduced ? 0 : 1300, (v) => Math.round(v) + '%'); countTo($('#switchNum'), state.switches, 900);
  countTo($('#offlineVal'), state.offline, reduced ? 0 : 1500, (v) => W().hm(Math.floor(v / 60), Math.round(v) % 60)); $('#offlineMeter').style.width = state.offPct + '%'; placeSpecPin(state.spec);
  addEventListener('resize', () => { initStars(); drawCave(); window.__gem && window.__gem.resize(); moveDock($('[aria-current=page]', dock), true); if (run.landscape) run.landscape.size(); });
}
/* every value that came from a person or from the computer (a name they typed, the name of a program in front) goes through esc() before it is placed in markup */
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* A switch is a button with no text: its name is the title of the row or card it sits in. Done here once, for every screen, whenever one appears (axe: "button-name"). */
const nameSwitches = (root) => (root.querySelectorAll ? root : document).querySelectorAll('button.sw:not([aria-label]):not([aria-labelledby]), button.upd-sw:not([aria-label]):not([aria-labelledby])').forEach((b) => {
  const host = b.closest('.st-row, .au, .lim, .catc, .rule, .li, .row, .glass');
  const title = host && host.querySelector('.t > b, b, h3, .nm');
  const text = title && title.textContent.trim();
  if (text) b.setAttribute('aria-label', text);
});
/* Headings: a screen has one h1, and its groups were written as h3. Where a heading jumps more than one level, its level is the next one down (the look does not change). */
const fixHeadings = (root) => {
  let prev = 0;
  for (const h of root.querySelectorAll('h1, h2, h3, h4')) {
    const given = h.getAttribute('aria-level');
    if (given) { prev = Number(given); continue; }
    const level = Number(h.tagName[1]);
    if (prev && level > prev + 1) { h.setAttribute('role', 'heading'); h.setAttribute('aria-level', String(prev + 1)); prev += 1; } else prev = level;
  }
};
new MutationObserver((list) => {
  const views = new Set();
  for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1) { nameSwitches(n.matches && n.matches('button.sw, .upd-sw') ? n.parentNode || document : n); views.add(n.closest ? n.closest('.vw') || n : n); }
  views.forEach((v) => fixHeadings(v));
}).observe(document.body, { childList: true, subtree: true });
nameSwitches(document);
Object.assign(ET, { esc, hscroll, gemStill, gemLive, SCENES, $, $$, clamp, lerp, easeOut, easeExpo, tween, wait, raf, reduced, store, go, toast, wheel, countTo, mulberry, ripple, openSheet, closeSheet, openScrim, closeScrim, BLOCKABLE, DURS, S, run, Landscape, W, t: (k, ...a) => { const v = W()[k]; return typeof v === 'function' ? v(...a) : v; }, lang: () => lang, langHooks: [], startSession, gem: () => window.__gem, dpr });
Object.assign(ET, {
  /* the real app: the helper tells the screens what is going on */
  setBlockCard(c) { realCard = c; if (blockedNow) renderBlockCard(); },
  unblockGranted(m) { unMin = m; blockedNow = false; openUntil = Date.now() + m * 60000; renderBlockCard(); clearInterval(openTimer); tickOpen(); openTimer = setInterval(tickOpen, 250); },
  askUnblockMinutes: () => unMin,
  setHome(d) { const sig = JSON.stringify(d); if (sig === ET._homeSig) return; ET._homeSig = sig;
    ET._noData = !!d.day.empty;
    if (d.day.empty) { /* nothing has been counted yet: say so instead of showing a perfect score */
      const dash = '—', msg = lang === 'ru' ? 'Данных пока нет. Они появятся, когда вы начнёте работать.' : 'No data yet. It appears as you work.';
      DAYS[0] = { ...DAYS[0], ...d.day }; state = { ...DAYS[0] }; if (d.bars) { BARS[0] = d.bars; buildChart(BARS[0]); }
      $('#scoreVal').textContent = dash; $('#scoreVal').style.opacity = '.3'; $('#focusPct').textContent = dash; drawBig(); $('#switchNum').textContent = '0'; drawOffline();
      $$('.gauge').forEach((g) => { if (g.dataset.g !== 'eyes') { g.querySelector('.gv').textContent = dash; g.querySelector('rect.fill').style.strokeDashoffset = '100'; } });
      $('#scoreDelta').style.visibility = 'hidden'; $('#specHead').textContent = msg; $('#specPin').style.opacity = '0'; $('#offlineMeter').style.width = '0%';
      return;
    }
    $('#specPin').style.opacity = ''; $('#scoreVal').style.opacity = ''; if (dayOffset !== 0 || !booted) { DAYS[0] = { ...DAYS[0], ...d.day }; if (d.bars) BARS[0] = d.bars; return; } DAYS[0] = { ...DAYS[0], ...d.day }; state = { ...DAYS[0] }; if (d.bars) { BARS[0] = d.bars; buildChart(BARS[0]); } countBig(state.screen, 600); countTo($('#focusPct'), state.focusPct, 600, (v) => Math.round(v) + '%'); countTo($('#switchNum'), state.switches, 400); countTo($('#scoreVal'), state.score, 600); paintGauges(600); drawOffline(); $('#offlineMeter').style.width = state.offPct + '%'; countTo($('#offlineVal'), state.offline, 600, (v) => W().hm(Math.floor(v / 60), Math.round(v) % 60)); },
  setStreak(n) { $('#streakNum').textContent = $('#flameNum').textContent = String(n); syncStreakName(); },
  /* a session that was already running when the window opened: no countdown, straight to the lake */
  resumeRun(ses, leftSec, totalSec) { if (run.on) return; Object.assign(S, { name: ses.name, min: Math.round(totalSec / 60), diff: ses.level, scene: ses.scene || S.scene }); beginRun(); run.total = totalSec; run.left = leftSec; run.startedAt = ses.startedAtMs; $('#tStart').textContent = fmtClock(ses.startedAtMs); $('#tEnd').textContent = fmtClock(ses.endsAtMs); },
  endRunExternal(completed) { finish(completed); },
});
const _apply = applyLang; applyLang = function () { _apply(); ET.langHooks.forEach((f) => { try { f(); } catch { /* a screen that is not built yet */ } }); };
document.fonts && document.fonts.ready ? document.fonts.ready.then(boot) : boot();
})();
