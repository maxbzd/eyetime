// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
/* Profile: who you are in numbers, and the shelf of gemstones you earn for habits. A gem can be put on as the colour of the whole app. */
(() => {
  const ET = window.ET, { $, $$, clamp, wait, reduced, toast, store, countTo } = ET;
  const D = {
    en: { title: 'Profile', name: 'Alex', since: 'Focusing since November 2026', sinceP: 'With EyeTime since', hours: 'Focus hours', streak: 'Day streak', sessions: 'Sessions', gems: 'Gemstones', gemsS: 'Earned by habits, never by time spent in the app. Tap a stone to see how.', owned: 'Owned', locked: 'Locked', progress: (a, b, u) => `${a} / ${b} ${u}`, apply: 'Use as the app colour', applied: 'This is your app colour', lockedBtn: 'Keep going', week: 'Your week', weekS: 'Screen time against your own average.', saved: 'Time saved', savedS: 'Compared with your average week.', lower: (p) => `${p}% lower`, close: 'Close', settings: 'Settings', theme: (n) => `${n} is now the colour of EyeTime`, days: ['M', 'T', 'W', 'T', 'F', 'S', 'S'], reached: 'Reached', how: 'How to get it',
      list: [['First Light', 'Finish your first focus session.', 1, 1, 'sessions', .0, 1], ['Spark', 'Focus on two days in a row.', 2, 2, 'days', .55, 2], ['Invested', 'Collect 10 hours of focus.', 10, 10, 'hours', .2, 3], ['Calm Eyes', 'Take 50 eye breaks.', 41, 50, 'breaks', -.32, 5], ['Unwavering', 'Focus on seven days in a row.', 5, 7, 'days', -.12, 4], ['Night Guard', 'Stay off screen after 22:00 for seven nights.', 3, 7, 'nights', .72, 6], ['Deep Diver', 'Collect 100 hours of focus.', 64, 100, 'hours', .38, 8], ['Radiant', 'Focus on thirty days in a row.', 5, 30, 'days', .95, 7]] },
    ru: { title: 'Профиль', name: 'Алекс', since: 'Фокусируется с ноября 2026', sinceP: 'С EyeTime с', hours: 'Часов фокуса', streak: 'Дней подряд', sessions: 'Сессий', gems: 'Камни', gemsS: 'Их дают за привычки, а не за время в приложении. Нажмите на камень, чтобы узнать как.', owned: 'Получен', locked: 'Закрыт', progress: (a, b, u) => `${a} / ${b} ${u}`, apply: 'Сделать цветом приложения', applied: 'Это цвет вашего приложения', lockedBtn: 'Продолжайте', week: 'Ваша неделя', weekS: 'Время за экраном против вашего среднего.', saved: 'Сэкономлено времени', savedS: 'В сравнении с вашей средней неделей.', lower: (p) => `на ${p}% меньше`, close: 'Закрыть', settings: 'Настройки', theme: (n) => `«${n}» теперь цвет EyeTime`, days: ['П', 'В', 'С', 'Ч', 'П', 'С', 'В'], reached: 'Получен', how: 'Как получить',
      list: [['Первый свет', 'Завершите первую сессию фокуса.', 1, 1, 'сессий', .0, 1], ['Искра', 'Фокусируйтесь два дня подряд.', 2, 2, 'дн.', .55, 2], ['Вложение', 'Наберите 10 часов фокуса.', 10, 10, 'ч', .2, 3], ['Спокойные глаза', 'Сделайте 50 перерывов для глаз.', 41, 50, 'перерывов', -.32, 5], ['Несгибаемый', 'Фокусируйтесь семь дней подряд.', 5, 7, 'дн.', -.12, 4], ['Ночной страж', 'Не садитесь за экран после 22:00 семь ночей.', 3, 7, 'ночей', .72, 6], ['Глубокое погружение', 'Наберите 100 часов фокуса.', 64, 100, 'ч', .38, 8], ['Сияющий', 'Фокусируйтесь тридцать дней подряд.', 5, 30, 'дн.', .95, 7]] },
  };
  const base = () => D[ET.lang()] || D.en;

  /* ---------------- the real numbers (inside the app) ---------------- */
  const REAL = !!window.__TAURI__;
  let realName = '';
  if (REAL) { try { window.__TAURI__.core.invoke('user_name').then((n) => { realName = n || ''; if (root) { const e = $('#pfName'); if (e) e.textContent = realName || L().name; } }).catch(() => {}); } catch { /* the generic name stays */ } }
  const pad2 = (n) => String(n).padStart(2, '0');
  const dayKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  function realStats() {
    const B = window.ETB, st = (B && B.getStatus && B.getStatus()) || {}, ud = (B && B.usageDays && B.usageDays()) || {}, t = st.totals || {};
    let eyes = {}; try { eyes = JSON.parse(localStorage.getItem('et-eyes') || '{}'); } catch { /* none */ }
    const at = (back) => { const d = new Date(); d.setDate(d.getDate() - back); const k = dayKey(d); return { d, u: back === 0 && st.today ? st.today : ud[k] || null }; };
    const secs = (u) => Object.values((u && u.secs) || {}).reduce((a, b) => a + b, 0);
    let nights = 0; for (let b = 0; b < 35; b++) { const u = at(b).u; if (u && secs(u) > 0 && !(((u.hours || [])[22] || 0) + ((u.hours || [])[23] || 0))) nights++; }
    const week = Array.from({ length: 7 }, (_, i) => { const r = at(6 - i); return { d: r.d, min: Math.round(secs(r.u) / 60), off: (r.u && r.u.offline_secs) || 0 }; });
    const rest = []; for (let b = 7; b < 35; b++) { const u = at(b).u; if (u && secs(u) > 0) rest.push(secs(u) / 60); }
    const avgDay = rest.length >= 3 ? rest.reduce((a, b) => a + b, 0) / rest.length : 0, thisWeek = week.reduce((a, b) => a + b.min, 0);
    return { hours: (t.focusMin || 0) / 60, streak: st.streakDays || 0, sessions: t.sessions || 0, best: Math.max(t.bestStreak || 0, st.streakDays || 0), eyes: Object.values(eyes).reduce((a, b) => a + b, 0), nights, week, since: t.sinceDay || '', saved: avgDay ? Math.max(0, Math.round(avgDay * 7 - thisWeek)) : null, avgWeek: avgDay * 7 };
  }
  const fmtH = (h) => (h >= 10 ? String(Math.floor(h)) : (Math.round(h * 10) / 10).toString().replace('.', ET.lang() === 'ru' ? ',' : '.'));
  function withReal(l) {
    const R = realStats(), have = [R.sessions, R.best, Math.floor(R.hours), R.eyes, R.best, R.nights, Math.floor(R.hours), R.best];
    const since = (() => { if (!R.since) return ''; const d = new Date(R.since + 'T12:00:00'); return `${l.sinceP} ${d.toLocaleDateString(ET.lang() === 'ru' ? 'ru-RU' : 'en-US', { month: 'long', year: 'numeric' })}`; })();
    return { ...l, name: realName || 'EyeTime', since, list: l.list.map((x, i) => [x[0], x[1], Math.min(have[i], x[3]), x[3], x[4], x[5], x[6]]), R };
  }
  const L = () => (REAL ? withReal(base()) : base());
  const ico = (n, c = '') => `<svg class="ico ${c}"><use href="#i-${n}"/></svg>`;
  const css = document.createElement('style'); css.textContent = `
  .pf-top { position: relative; text-align: center; padding: 18px 0 8px; }
  .pf-gear { position: absolute; right: 0; top: 10px; } .pf-gear:hover { transform: rotate(60deg) !important; }
  .emblem { position: relative; width: 190px; height: 190px; margin: 0 auto 6px; } .emblem svg.ringtxt { position: absolute; inset: 0; width: 100%; height: 100%; animation: spin 60s linear infinite; opacity: .75; } .emblem text { fill: var(--text-3); font: 600 11.5px var(--font-body); letter-spacing: .32em; }
  .avatar { position: absolute; left: 50%; top: 50%; width: 112px; height: 112px; margin: -56px; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 35% 28%, rgba(140,242,198,.4), rgba(20,46,40,.9) 70%); border: 1.5px solid rgba(140,242,198,.55); box-shadow: 0 0 50px rgba(140,242,198,.3), inset 0 0 30px rgba(140,242,198,.18); color: var(--mint); } .avatar .ico { width: 54px; height: 54px; stroke-width: 1.4; }
  .pf-name { font: 400 34px/1.1 var(--font-display); } .pf-since { margin-top: 6px; color: var(--text-3); font: 500 14px/1.3 var(--font-body); }
  .pf-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 22px; } .pf-stat { text-align: center; padding: 22px 12px; } .pf-stat .ico { width: 40px; height: 40px; margin: 0 auto 10px; color: var(--mint); stroke-width: 1.4; } .pf-stat b { display: block; font: 300 38px/1 var(--font-display); } .pf-stat span { display: block; margin-top: 8px; color: var(--text-3); font: 600 11px/1 var(--font-body); letter-spacing: .12em; text-transform: uppercase; } .pf-stat .fl { width: 40px; height: 48px; margin: 0 auto 6px; filter: drop-shadow(0 0 12px rgba(255,168,80,.6)); animation: flicker 2.4s ease-in-out infinite; }
  .shelf { display: flex; gap: 18px; overflow-x: auto; padding: 8px 4px 22px; margin: 0 -4px; scroll-snap-type: x proximity; scrollbar-width: none; } .shelf::-webkit-scrollbar { display: none; }
  .gm { flex: none; width: 150px; text-align: center; scroll-snap-align: start; cursor: pointer; border-radius: 26px; padding: 6px 4px 12px; transition: transform .5s var(--spring); } .gm:hover { transform: translateY(-8px); } .gm:active { transform: scale(.95); }
  .gm .st { position: relative; width: 138px; height: 138px; margin: 0 auto; display: grid; place-items: center; } .gm .st::before { content: ""; position: absolute; left: 50%; bottom: 4px; width: 90px; height: 16px; margin-left: -45px; border-radius: 50%; background: radial-gradient(closest-side, rgba(140,242,198,.35), transparent); filter: blur(4px); } .gm canvas, .gm img { position: relative; width: 138px; height: 138px; animation: gmfloat 6s ease-in-out infinite; animation-delay: calc(var(--i) * -.8s); filter: drop-shadow(0 12px 22px rgba(0,0,0,.6)); } .gm .sk { position: relative; width: 92px; height: 110px; border-radius: 46% 54% 50% 50%; background: linear-gradient(110deg, rgba(255,255,255,.04) 30%, rgba(255,255,255,.1) 50%, rgba(255,255,255,.04) 70%); background-size: 200% 100%; animation: shim 1.4s linear infinite; } @keyframes shim { to { background-position: -200% 0; } } @keyframes gmfloat { 50% { transform: translateY(-8px) rotate(2deg); } }
  .gm b { display: block; margin-top: 8px; font: 600 15px/1.2 var(--font-body); } .gm span.s { display: block; margin-top: 4px; font: 600 12px/1.2 var(--font-body); color: var(--mint); } .gm.lk span.s { color: var(--text-3); } .gm.lk img { opacity: .8; }
  .gm .pbar { height: 4px; border-radius: 2px; background: rgba(255,255,255,.1); margin: 10px 18px 0; overflow: hidden; } .gm .pbar i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--lime), var(--mint)); width: 0; transition: width 1.4s var(--out-expo) .6s; }
  .pf-two { display: grid; grid-template-columns: 1.4fr 1fr; gap: 14px; } .wk-bars { display: flex; align-items: flex-end; gap: 10px; height: 110px; margin-top: 16px; } .wk-bars div { flex: 1; text-align: center; font: 600 11px/1 var(--font-body); color: var(--text-3); } .wk-bars i { display: block; margin: 0 auto 8px; width: 100%; border-radius: 8px; background: linear-gradient(180deg, var(--sky), #4a8bd0); transform-origin: bottom; animation: grow 1s var(--out-expo) backwards; animation-delay: calc(var(--i) * 60ms + 600ms); } .wk-bars .today i { background: linear-gradient(180deg, var(--lime), var(--mint)); box-shadow: 0 0 18px rgba(140,242,198,.5); }
  .saved { text-align: center; } .saved .ringbig { position: relative; width: 150px; height: 150px; margin: 6px auto 12px; overflow: visible; } .saved .ringbig svg { width: 100%; height: 100%; transform: rotate(-90deg); overflow: visible; } .saved circle { fill: none; stroke-width: 9; } .saved .bgc { stroke: rgba(255,255,255,.08); } .saved .fg { stroke: url(#gGrad); stroke-linecap: round; stroke-dasharray: 100; stroke-dashoffset: 100; transition: stroke-dashoffset 1.8s var(--out-expo) .8s; filter: drop-shadow(0 0 8px rgba(140,242,198,.5)); } .saved .ringbig b { position: absolute; inset: 0; display: grid; place-items: center; font: 300 34px/1 var(--font-display); }
  .gd { position: absolute; inset: 0; z-index: 72; display: none; align-items: center; justify-content: center; flex-direction: column; text-align: center; padding: 20px var(--gutter-r) 20px var(--gutter); background: radial-gradient(70% 60% at 50% 40%, rgba(var(--gd-rgb, 30,70,60),.55), rgba(0,3,2,.97) 70%); backdrop-filter: blur(20px); } .gd.on { display: flex; animation: fadein .5s ease; }
  .gd .round-btn { position: absolute; left: calc(var(--gutter) + 12px); top: 24px; } .gd .big { position: relative; width: min(60vw, 320px); height: min(60vw, 320px); perspective: 900px; } .gd .big canvas, .gd .big img { width: 100%; height: 100%; transition: transform .2s ease-out; animation: gdin 1.1s var(--spring) backwards, gmfloat 7s ease-in-out 1.1s infinite; filter: drop-shadow(0 30px 50px rgba(0,0,0,.7)); } @keyframes gdin { from { opacity: 0; transform: scale(.3) rotate(-30deg); filter: blur(20px); } }
  .gd h2 { margin: 18px 0 6px; font: 300 40px/1.1 var(--font-display); animation: rise .9s var(--out-expo) .25s backwards; } .gd p { margin: 0 0 14px; color: var(--text-2); font: 500 16px/1.5 var(--font-body); max-width: 42ch; animation: rise .9s var(--out-expo) .35s backwards; }
  .gd .chipx { display: inline-flex; gap: 8px; align-items: center; padding: 8px 14px; border-radius: 99px; background: rgba(255,255,255,.08); border: 1px solid var(--edge); font: 600 13px/1 var(--font-body); margin-bottom: 16px; animation: rise .9s var(--out-expo) .45s backwards; } .gd .track2 { width: min(86%, 320px); height: 6px; border-radius: 3px; background: rgba(255,255,255,.12); margin: 0 auto 22px; overflow: hidden; } .gd .track2 i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--lime), var(--mint)); transition: width 1.4s var(--out-expo) .5s; width: 0; }
  .gd .pill-white { height: 54px; padding: 0 30px; font-size: 15px; animation: rise .9s var(--out-expo) .55s backwards; } .gd .pill-white[disabled] { opacity: .45; }
  @media (max-width: 800px) { .pf-two { grid-template-columns: 1fr; } .pf-stats { gap: 8px; } .pf-stat b { font-size: 28px; } }
  `; document.head.append(css);

  const hueOf = (h) => Math.round(150 + h * 300);
  let root, curGem = null; const stills = new Map();
  function mount(el) {
    root = el;
    el.innerHTML = `<div class="vw"><div class="pf-top"><button class="round-btn pf-gear" id="pfGear" type="button">${ico('grid')}</button><div class="emblem"><svg class="ringtxt" viewBox="0 0 190 190" aria-hidden="true"><defs><path id="emb" d="M95 95 m-82 0 a82 82 0 1 1 164 0 a82 82 0 1 1 -164 0"/></defs><text><textPath href="#emb">EYETIME · FOCUS COMPANY · EYETIME · FOCUS COMPANY ·</textPath></text></svg><div class="avatar">${ico('user')}</div></div><div class="pf-name" id="pfName"></div><div class="pf-since" id="pfSince"></div></div>
    <div class="pf-stats"><div class="glass pf-stat rise tilt" style="--d:100">${ico('target')}<b class="num" id="pfH">0</b><span id="pfHl"></span></div><div class="glass pf-stat rise tilt" style="--d:180"><svg class="fl" viewBox="0 0 62 78"><path d="M31 3c2 12 20 19 20 40a20 20 0 0 1-40 0c0-9 4-14 8-19 1 5 4 7 7 7-1-8-1-16 5-28z" fill="url(#fGrad)"/><path d="M31 36c1 6 9 9 9 18a9 9 0 0 1-18 0c0-5 3-7 5-10 1 2 2 3 4 3z" fill="#ffe7a0" opacity=".85"/></svg><b class="num" id="pfS">0</b><span id="pfSl"></span></div><div class="glass pf-stat rise tilt" style="--d:260">${ico('check')}<b class="num" id="pfN">0</b><span id="pfNl"></span></div></div>
    <div class="sec-head"><div><h2 id="pfG"></h2><p id="pfGs"></p></div></div><div class="shelf" id="pfShelf"></div>
    <div class="pf-two"><div class="glass rise tilt" style="--d:300"><div class="card-head"><div class="card-title">${ico('chart')}<span id="pfW"></span></div></div><p class="sub-label" style="margin:-6px 0 0;text-transform:none;letter-spacing:0;font-size:13px" id="pfWs"></p><div class="wk-bars" id="pfBars"></div></div><div class="glass saved rise tilt" style="--d:380"><div class="card-head"><div class="card-title">${ico('clock')}<span id="pfSv"></span></div></div><div class="ringbig"><svg viewBox="0 0 100 100"><circle class="bgc" cx="50" cy="50" r="42"/><circle class="fg" cx="50" cy="50" r="42" pathLength="100" id="pfRing"/></svg><b class="num" id="pfSvv">0</b></div><p class="sub-label" style="text-transform:none;letter-spacing:0;font-size:13px;margin-top:0" id="pfSvs"></p></div></div></div>
    <div class="gd" id="gd"><button class="round-btn" id="gdClose" type="button">${ico('x')}</button><div class="big"><canvas id="gdImg" width="560" height="560" aria-label="3D"></canvas></div><h2 id="gdH"></h2><p id="gdP"></p><div class="chipx" id="gdC"></div><div class="track2"><i id="gdBar"></i></div><button class="pill-white" id="gdBtn" type="button"></button></div>`;
    $('#app').append($('#gd', el));
    $('#pfGear', el).addEventListener('click', () => ET.go('settings')); $('#gdClose').addEventListener('click', closeGem);
    $('#gd').addEventListener('pointermove', (e) => { const im = $('#gdImg'), r = im.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; if (!reduced) im.style.transform = `rotateY(${x * 24}deg) rotateX(${-y * 18}deg)`; });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#gd').classList.contains('on')) closeGem(); });
    ET.hscroll($('#pfShelf', el)); render(); ET.langHooks.push(() => { render(); $('#tbTitle').textContent = L().title; });
  }
  function render() {
    const l = L(), el = root; $('#pfName').textContent = l.name; $('#pfSince').textContent = l.since; $('#pfHl').textContent = l.hours; $('#pfSl').textContent = l.streak; $('#pfNl').textContent = l.sessions; $('#pfG').textContent = l.gems; $('#pfGs').textContent = l.gemsS; $('#pfW').textContent = l.week; $('#pfWs').textContent = l.weekS; $('#pfSv').textContent = l.saved; $('#pfSvs').textContent = l.savedS; $('#pfGear').setAttribute('aria-label', l.settings); $('#gdClose').setAttribute('aria-label', l.close);
    const V = REAL ? { h: l.R.hours, s: l.R.streak, n: l.R.sessions } : { h: 128, s: 5, n: 214 };
    if (REAL && V.h < 10) { $('#pfH').textContent = fmtH(V.h); } else countTo($('#pfH'), Math.floor(V.h), 1500);
    countTo($('#pfS'), V.s, 900); countTo($('#pfN'), V.n, 1500);
    const shelf = $('#pfShelf'); shelf.innerHTML = '';
    l.list.forEach(([name, desc, have, need, unit, hue, seed], i) => {
      const own = have >= need, g = document.createElement('button'); g.className = 'gm rise' + (own ? '' : ' lk'); g.style.setProperty('--d', 120 + i * 60); g.style.setProperty('--i', i); g.type = 'button'; /* the name is its visible text (WCAG 2.5.3) */
      g.innerHTML = `<div class="st">${stills.get(seed) ? `<img alt="" src="${stills.get(seed)}">` : '<div class="sk"></div>'}</div><b>${name}</b> <span class="s">${own ? l.owned : l.progress(have, need, unit)}</span>${own ? '' : `<div class="pbar"><i data-w="${(have / need) * 100}"></i></div>`}`;
      g.addEventListener('click', () => openGem(i)); shelf.append(g); const bar = $('.pbar i', g); if (bar) setTimeout(() => { bar.style.width = bar.dataset.w + '%'; }, 80);
    });
    makeStills();
    const wk = REAL ? l.R.week : null, days = REAL ? wk.map((x) => x.min) : [210, 190, 240, 175, 205, 90, 120], mx = REAL ? Math.max(60, ...days) * 1.1 : 260; $('#pfBars').innerHTML = days.map((v, i) => `<div class="${(REAL ? i === 6 : i === 2) ? 'today' : ''}"><i style="--i:${i};height:${Math.max(2, (v / mx) * 100)}%"></i>${REAL ? l.days[(wk[i].d.getDay() + 6) % 7] : l.days[i]}</div>`).join('');
    if (REAL) { const sv = l.R.saved, ru = ET.lang() === 'ru'; $('#pfSvv').textContent = sv === null ? '—' : `${Math.floor(sv / 60)}${ru ? ' ч ' : 'h '}${sv % 60}${ru ? ' м' : 'm'}`; $('#pfSvs').textContent = sv === null ? (ru ? 'Нужно несколько дней, чтобы сравнить.' : 'It needs a few days to compare.') : l.savedS; setTimeout(() => { $('#pfRing').style.strokeDashoffset = String(sv === null || !l.R.avgWeek ? 100 : Math.max(2, 100 - (100 * sv) / l.R.avgWeek)); }, 50); }
    else { $('#pfSvv').textContent = ET.lang() === 'ru' ? '6 ч 20 м' : '6h 20m'; setTimeout(() => { $('#pfRing').style.strokeDashoffset = '30'; }, 50); }
  }
  let making = false, shelf = [], bigLive = null;
  async function makeStills() {
    if (making) return; making = true; const l = L();
    // every stone of the shelf is a live 3D stone, turning slowly; they share one renderer
    shelf.forEach((h) => h.stop()); shelf = [];
    for (const [, , have, need, , hue, seed] of l.list) {
      await wait(30); const idx = l.list.findIndex((x) => x[6] === seed), slot = $$('.gm .st', root)[idx]; if (!slot) continue;
      slot.innerHTML = ''; const cv = document.createElement('canvas'); cv.width = cv.height = 300; cv.className = 'live'; cv.style.animation = `gdin .9s var(--spring) backwards, gmfloat 6s ease-in-out ${idx * -.8}s infinite`; slot.append(cv);
      shelf.push(ET.gemLive(cv, { hue, seed, lock: have >= need ? 0 : 1, spin: .22 + (idx % 4) * .05, rot: seed * .7, px: 300 }));
    }
    making = false;
  }
  function openGem(i) {
    const l = L(), [name, desc, have, need, unit, hue, seed] = l.list[i], own = have >= need; curGem = { name, hue, own }; 
    bigLive && bigLive.stop(); bigLive = ET.gemLive($('#gdImg'), { hue, seed, lock: own ? 0 : 1, spin: .35, rot: seed * .7, px: 560, drag: true }); $('#gdImg').style.transform = ''; $('#gdH').textContent = name; $('#gdP').textContent = desc; $('#gdC').innerHTML = `${ico(own ? 'check' : 'clock')}${own ? l.owned : l.progress(have, need, unit)}`; $('#gdBar').style.width = '0'; setTimeout(() => { $('#gdBar').style.width = Math.min(100, (have / need) * 100) + '%'; }, 60);
    const applied = String(ET.store.get('et-hue')) === String(hue), b = $('#gdBtn'); b.disabled = !own; b.textContent = !own ? l.lockedBtn : applied ? l.applied : l.apply; b.onclick = () => { if (!own) return; ET.store.set('et-hue', String(hue)); ET.gem() && ET.gem().setBase(hue); ET.gem() && ET.gem().flash(); b.textContent = l.applied; toast(l.theme(name)); };
    $('#gd').style.setProperty('--gd-rgb', own ? '30,80,70' : '30,40,44'); $('#gd').classList.add('on'); $('#gdClose').focus({ preventScroll: true });
  }
  function closeGem() { $('#gd').classList.remove('on'); bigLive && bigLive.stop(); bigLive = null; }
  ET.screens.profile = { title: () => L().title, mount, show: () => { if (!root) return; if (REAL) { const B = window.ETB; (B && B.refreshUsage ? B.refreshUsage() : Promise.resolve()).then(() => render()); } else { countTo($('#pfH'), 128, 1500, undefined, 0); countTo($('#pfN'), 214, 1500, undefined, 0); } } };
})();
