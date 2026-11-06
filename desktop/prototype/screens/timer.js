/* Timer: longer resets with a world of their own (Digital Detox), soundscapes, quick starts and a guided breath. */
(() => {
  const ET = window.ET, { $, $$, clamp, wait, reduced, toast } = ET;
  const D = {
    en: { title: 'Timer', h1: 'Timer', lead: 'Pick a length, close the doors, stay as long as you like.', detox: 'Digital detox', detoxS: 'A longer reset. Everything distracting is closed.', mixes: 'Soundscapes', mixesS: 'Quiet sound under your work. Plays only while this window is open.', quick: 'Quick starts', quickS: 'A session with your last list of blocked apps.', breathe: 'Breathe', breatheS: 'One minute that slows the heart and rests the eyes.', noDis: 'No distracting apps', start: 'Start', vol: 'Volume', playing: 'Playing', stop: 'Stop', min: 'min', hr: 'hr',
      detoxCards: [['Quiet Hours', 120, 'dawn'], ['The Retreat', 240, 'forest'], ['Digital Sabbath', 480, 'meadow'], ['Deep Work', 90, 'dusk'], ['Night Reset', 60, 'night'], ['Moonlight', 180, 'dunes']],
      mixList: ['Brown focus', 'Rain', 'Ocean', 'Forest wind', 'Fireplace'], quickList: [['Pomodoro', '25 / 5'], ['Deep work', '50 / 10'], ['Sprint', '15'], ['Eye reset', '5']], inhale: 'Breathe in', hold: 'Hold', exhale: 'Breathe out', round: (n, m) => `Round ${n} of ${m}`, breathDone: 'Well done. Eyes rested, pulse slower.', breathBtn: 'Start breathing', close: 'Close' },
    ru: { title: 'Таймер', h1: 'Таймер', lead: 'Выберите длительность, закройте двери и оставайтесь сколько нужно.', detox: 'Цифровой детокс', detoxS: 'Долгая перезагрузка. Всё отвлекающее закрыто.', mixes: 'Звуки', mixesS: 'Тихий фон под работу. Играет, пока окно открыто.', quick: 'Быстрый старт', quickS: 'Сессия с вашим последним списком блокировки.', breathe: 'Дыхание', breatheS: 'Одна минута, которая замедляет пульс и отдыхает глаза.', noDis: 'Без отвлекающих приложений', start: 'Старт', vol: 'Громкость', playing: 'Играет', stop: 'Стоп', min: 'мин', hr: 'ч',
      detoxCards: [['Тихие часы', 120, 'dawn'], ['Уединение', 240, 'forest'], ['Цифровой шабат', 480, 'meadow'], ['Глубокая работа', 90, 'dusk'], ['Ночная перезагрузка', 60, 'night'], ['Лунный свет', 180, 'dunes']],
      mixList: ['Коричневый шум', 'Дождь', 'Океан', 'Ветер в лесу', 'Камин'], quickList: [['Помодоро', '25 / 5'], ['Глубокая работа', '50 / 10'], ['Спринт', '15'], ['Сброс для глаз', '5']], inhale: 'Вдох', hold: 'Задержка', exhale: 'Выдох', round: (n, m) => `Круг ${n} из ${m}`, breathDone: 'Отлично. Глаза отдохнули, пульс стал ровнее.', breathBtn: 'Начать дыхание', close: 'Закрыть' },
  };
  const L = () => D[ET.lang()] || D.en;
  const ico = (n, c = '') => `<svg class="ico ${c}"><use href="#i-${n}"/></svg>`;
  const lenTxt = (m) => (m >= 60 ? `${m / 60 === Math.floor(m / 60) ? m / 60 : (m / 60).toFixed(1)} ${L().hr}` : `${m} ${L().min}`);

  const css = document.createElement('style'); css.textContent = `
  .tm-row { display: flex; gap: 16px; overflow-x: auto; scroll-snap-type: x proximity; padding: 4px 4px 16px; margin: 0 -4px; scrollbar-width: none; } .tm-row::-webkit-scrollbar { display: none; }
  .detox { position: relative; flex: none; width: min(78vw, 400px); height: 250px; border-radius: 32px; overflow: hidden; scroll-snap-align: start; text-align: left; border: 1px solid var(--edge); box-shadow: 0 24px 50px -22px #000; transition: transform .6s var(--spring), box-shadow .4s; cursor: pointer; }
  .detox:hover { transform: translateY(-6px) scale(1.015); box-shadow: 0 34px 70px -24px #000, 0 0 0 1px var(--edge-hi); } .detox:active { transform: scale(.98); }
  .detox canvas { position: absolute; inset: 0; width: 100%; height: 100%; transition: transform 1.6s var(--out-expo); } .detox:hover canvas { transform: scale(1.06); }
  .detox::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.05) 25%, rgba(0,0,0,.72)); }
  .detox .t { position: absolute; left: 22px; right: 22px; bottom: 20px; z-index: 2; } .detox h3 { margin: 0; font: 400 28px/1.1 var(--font-display); text-shadow: 0 2px 20px rgba(0,0,0,.5); } .detox p { margin: 6px 0 14px; color: rgba(255,255,255,.75); font: 500 14px/1.3 var(--font-body); }
  .detox .go { display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 16px 0 12px; border-radius: 99px; background: rgba(255,255,255,.2); backdrop-filter: blur(14px); border: 1px solid rgba(255,255,255,.28); font: 600 14px/1 var(--font-body); transition: background .25s, transform .4s var(--spring); } .detox:hover .go { background: #fff; color: #04100b; transform: scale(1.06); } .detox .go .ico { width: 14px; height: 14px; fill: currentColor; stroke: none; }
  .mixes { display: flex; gap: 22px; flex-wrap: wrap; align-items: flex-start; }
  .mix { width: 112px; text-align: center; cursor: pointer; } .mix .disc { position: relative; width: 112px; height: 112px; border-radius: 50%; display: grid; place-items: center; overflow: hidden; border: 1px solid var(--edge-hi); box-shadow: 0 16px 36px -14px #000; transition: transform .6s var(--spring), box-shadow .4s; }
  .mix:hover .disc { transform: scale(1.07) rotate(-4deg); } .mix:active .disc { transform: scale(.94); } .mix.on .disc { box-shadow: 0 0 0 3px rgba(140,242,198,.6), 0 0 40px rgba(140,242,198,.35); animation: spin 18s linear infinite; }
  .mix .disc i { position: absolute; inset: 0; } .mix .play { position: relative; z-index: 2; width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; background: rgba(0,0,0,.35); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,.4); } .mix.on .disc { animation: none; } .mix .play .ico { width: 18px; height: 18px; fill: #fff; stroke: none; }
  .mix .eq { display: none; gap: 3px; align-items: flex-end; height: 18px; } .mix.on .eq { display: flex; } .mix.on .play .ico { display: none; } .eq b { width: 4px; border-radius: 2px; background: #fff; animation: eq 1s ease-in-out infinite; } .eq b:nth-child(2) { animation-delay: -.3s; } .eq b:nth-child(3) { animation-delay: -.6s; } .eq b:nth-child(4) { animation-delay: -.15s; } @keyframes eq { 0%, 100% { height: 4px; } 50% { height: 18px; } }
  .mix span { display: block; margin-top: 10px; font: 600 13px/1.25 var(--font-body); }
  .vol { display: flex; align-items: center; gap: 14px; margin-top: 18px; padding: 12px 18px; border-radius: 99px; width: max-content; max-width: 100%; background: rgba(255,255,255,.05); border: 1px solid var(--edge); color: var(--text-2); font: 600 13px/1 var(--font-body); } .vol input { -webkit-appearance: none; appearance: none; width: 200px; height: 6px; border-radius: 3px; background: rgba(255,255,255,.14); outline: 0; } .vol input::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 0 14px rgba(255,255,255,.6); cursor: pointer; } .vol input::-moz-range-thumb { width: 20px; height: 20px; border: 0; border-radius: 50%; background: #fff; cursor: pointer; }
  .quick { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
  .qk { padding: 18px; border-radius: 26px; text-align: left; display: flex; align-items: center; gap: 14px; background: linear-gradient(158deg, rgba(40,58,52,.5), rgba(8,12,11,.64)); border: 1px solid var(--edge); backdrop-filter: blur(20px); transition: transform .45s var(--spring), border-color .3s; } .qk:hover { transform: translateY(-4px); border-color: var(--edge-hi); } .qk:active { transform: scale(.96); }
  .qk .r { width: 50px; height: 50px; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(var(--mint) var(--p, 70%), rgba(255,255,255,.1) 0); position: relative; flex: none; } .qk .r::after { content: ""; position: absolute; inset: 4px; border-radius: 50%; background: #0b1412; } .qk .r .ico { position: relative; z-index: 1; width: 18px; fill: var(--mint); stroke: none; }
  .qk b { display: block; font: 600 16px/1.2 var(--font-body); } .qk span { color: var(--text-3); font: 500 13px/1.3 var(--font-body); }
  .breath-card { display: flex; align-items: center; gap: 22px; padding: 22px 26px; flex-wrap: wrap; } .breath-card .orb-s { width: 88px; height: 88px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff, var(--sky) 45%, #2c7fb0); box-shadow: 0 0 50px rgba(134,215,255,.55); animation: orbs 6s ease-in-out infinite; flex: none; } @keyframes orbs { 50% { transform: scale(1.14); box-shadow: 0 0 80px rgba(134,215,255,.8); } }
  .breath-card h3 { margin: 0; font: 500 22px/1.2 var(--font-display); } .breath-card p { margin: 6px 0 0; color: var(--text-2); font: 500 14px/1.45 var(--font-body); max-width: 44ch; } .breath-card .grow { flex: 1; min-width: 220px; }
  .breath { position: absolute; inset: 0; z-index: 75; display: none; place-items: center; background: radial-gradient(70% 60% at 50% 45%, rgba(18,50,70,.96), rgba(0,3,6,.99)); } .breath.on { display: grid; animation: fadein .7s ease; }
  .breath .orb { position: relative; width: 220px; height: 220px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff, var(--sky) 38%, #2a78ad 78%); box-shadow: 0 0 120px rgba(134,215,255,.55), inset 0 -20px 50px rgba(0,40,80,.5); transform: scale(.55); will-change: transform; }
  .breath .halo { position: absolute; left: 50%; top: 50%; width: 220px; height: 220px; margin: -110px; border-radius: 50%; border: 1.5px solid rgba(134,215,255,.4); will-change: transform; }
  .breath .txt { position: absolute; left: 0; right: 0; bottom: 14%; text-align: center; } .breath .txt b { display: block; font: 300 44px/1.1 var(--font-display); } .breath .txt span { color: var(--text-2); font: 500 15px/1.4 var(--font-body); }
  .breath .round-btn { position: absolute; left: 28px; top: 24px; }
  `; document.head.append(css);

  /* ---------------- the sound: noise, filtered into rain, sea, wind and fire (no files) ---------------- */
  let actx = null, master = null, cur = null;
  function noise(kind) {
    const len = actx.sampleRate * 4, b = actx.createBuffer(1, len, actx.sampleRate), d = b.getChannelData(0); let last = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (kind === 'brown') { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; } else { b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852; b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .11; b6 = w * .115926; } }
    const s = actx.createBufferSource(); s.buffer = b; s.loop = true; return s;
  }
  function build(i) {
    const out = actx.createGain(), nodes = []; const add = (n) => { nodes.push(n); return n; }; const lfo = (freq, amt, param) => { const o = add(actx.createOscillator()), g = actx.createGain(); o.frequency.value = freq; g.gain.value = amt; o.connect(g); g.connect(param); o.start(); };
    if (i === 0) { const s = add(noise('brown')), f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520; s.connect(f); f.connect(out); s.start(); out.gain.value = .9; }
    if (i === 1) { const s = add(noise('pink')), hp = actx.createBiquadFilter(), lp = actx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700; lp.type = 'lowpass'; lp.frequency.value = 7200; s.connect(hp); hp.connect(lp); lp.connect(out); s.start(); out.gain.value = .55; lfo(.17, .08, out.gain); }
    if (i === 2) { const s = add(noise('brown')), lp = actx.createBiquadFilter(), g = actx.createGain(); lp.type = 'lowpass'; lp.frequency.value = 900; g.gain.value = .5; s.connect(lp); lp.connect(g); g.connect(out); s.start(); lfo(.09, .42, g.gain); lfo(.05, 260, lp.frequency); out.gain.value = 1; }
    if (i === 3) { const s = add(noise('pink')), bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = .8; s.connect(bp); bp.connect(out); s.start(); lfo(.11, 280, bp.frequency); lfo(.07, .25, out.gain); out.gain.value = .7; }
    if (i === 4) { const s = add(noise('brown')), lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; s.connect(lp); lp.connect(out); s.start(); out.gain.value = .8; const p = add(noise('pink')), hp = actx.createBiquadFilter(), cg = actx.createGain(); hp.type = 'highpass'; hp.frequency.value = 2400; cg.gain.value = 0; p.connect(hp); hp.connect(cg); cg.connect(out); p.start(); const crack = () => { if (!cur) return; const t = actx.currentTime; cg.gain.cancelScheduledValues(t); cg.gain.setValueAtTime(.0, t); cg.gain.linearRampToValueAtTime(.5 * Math.random() + .15, t + .004); cg.gain.exponentialRampToValueAtTime(.001, t + .05 + Math.random() * .08); setTimeout(crack, 60 + Math.random() * 700); }; crack(); }
    return { out, stop() { nodes.forEach((n) => { try { n.stop(); } catch { /* not a source */ } }); out.disconnect(); } };
  }
  function playMix(i, vol) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) { toast('Audio is not available here'); return false; }
    actx = actx || new AC(); if (actx.state === 'suspended') actx.resume(); if (!master) { master = actx.createGain(); master.connect(actx.destination); } master.gain.value = vol;
    stopMix(); const m = build(i); m.out.connect(master); cur = m; const t = actx.currentTime; master.gain.setValueAtTime(0, t); master.gain.linearRampToValueAtTime(vol, t + 1.2); return true;
  }
  function stopMix() { if (!cur) return; const m = cur; cur = null; if (master) { const t = actx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(0, t + .5); } setTimeout(() => m.stop(), 600); }

  /* ---------------- the screen ---------------- */
  const ART = [[150, 40], [205, 60], [190, 30], [135, 55], [25, 70]];
  let root, mixOn = -1, vol = .5, anims = [];
  function mount(el) {
    root = el; el.innerHTML = `<div class="vw"><h1></h1><p class="lead"></p>
      <div class="sec-head"><div><h2 id="tmD"></h2><p id="tmDs"></p></div></div><div class="tm-row" id="tmDetox"></div>
      <div class="sec-head"><div><h2 id="tmM"></h2><p id="tmMs"></p></div></div><div class="mixes" id="tmMixes"></div><div class="vol"><span id="tmVol"></span><input id="tmVolIn" type="range" min="0" max="100" value="50" aria-label="Volume"></div>
      <div class="sec-head"><div><h2 id="tmQ"></h2><p id="tmQs"></p></div></div><div class="quick" id="tmQuick"></div>
      <div class="sec-head"><div><h2 id="tmB"></h2><p id="tmBs"></p></div></div><div class="glass breath-card rise tilt"><div class="orb-s"></div><div class="grow"><h3 id="tmBh"></h3><p id="tmBp"></p></div><button class="pill-white" id="tmBgo" type="button"></button></div></div>
      <div class="breath" id="breath" aria-live="polite"><button class="round-btn" id="brClose" type="button">${ico('x')}</button><div class="halo" id="brHalo"></div><div class="orb" id="brOrb"></div><div class="txt"><b id="brT"></b><span id="brS"></span></div></div>`;
    $('#app').append($('#breath', el));
    $('#tmVolIn', el).addEventListener('input', (e) => { vol = e.target.value / 100; if (master && cur) master.gain.value = vol; });
    $('#tmBgo', el).addEventListener('click', breathe); $('#brClose').addEventListener('click', () => { brOn = false; $('#breath').classList.remove('on'); });
    ET.hscroll($('#tmDetox', el)); render(); ET.langHooks.push(() => { render(); $('#tbTitle').textContent = L().title; });
  }
  function render() {
    const l = L(); $('h1', root).textContent = l.h1; $('.lead', root).textContent = l.lead; $('#tmD').textContent = l.detox; $('#tmDs').textContent = l.detoxS; $('#tmM').textContent = l.mixes; $('#tmMs').textContent = l.mixesS; $('#tmQ').textContent = l.quick; $('#tmQs').textContent = l.quickS; $('#tmB').textContent = l.breathe; $('#tmBs').textContent = l.breatheS; $('#tmVol').textContent = l.vol; $('#tmBh').textContent = l.breathe + ' · 4-4-6'; $('#tmBp').textContent = l.breatheS; $('#tmBgo').textContent = l.breathBtn;
    anims.length = 0; const dx = $('#tmDetox'); dx.innerHTML = '';
    l.detoxCards.forEach(([name, min, scene], i) => {
      const b = document.createElement('button'); b.className = 'detox rise'; b.style.setProperty('--d', 100 + i * 80); b.type = 'button'; b.setAttribute('aria-label', `${name} ${lenTxt(min)}`);
      b.innerHTML = `<canvas></canvas><div class="t"><h3>${ET.esc(name)}</h3><p>${l.noDis}</p><span class="go">${ico('timer')}${lenTxt(min)}</span></div>`; dx.append(b);
      requestAnimationFrame(() => { const cv = $('canvas', b); const land = new ET.Landscape(cv, scene); land.draw(3); if (window.ResizeObserver) new ResizeObserver(() => { land.size(); land.draw(3); }).observe(cv); let raf = 0, t0 = 0; const loop = (n) => { land.draw(3 + n / 1000); raf = requestAnimationFrame(loop); }; b.addEventListener('pointerenter', () => { if (!reduced) raf = requestAnimationFrame(loop); }); b.addEventListener('pointerleave', () => cancelAnimationFrame(raf)); });
      b.addEventListener('click', () => { ET.S.min = min; ET.S.name = name.slice(0, 14); ET.S.scene = scene; ET.S.diff = 0; ET.startSession(); });
    });
    const mx = $('#tmMixes'); mx.innerHTML = '';
    l.mixList.forEach((name, i) => {
      const [h, s] = ART[i], m = document.createElement('div'); m.className = 'mix rise' + (mixOn === i ? ' on' : ''); m.style.setProperty('--d', 100 + i * 70); m.tabIndex = 0; m.setAttribute('role', 'button'); m.setAttribute('aria-pressed', String(mixOn === i)); m.setAttribute('aria-label', name);
      m.innerHTML = `<div class="disc"><i style="background:conic-gradient(from ${i * 60}deg, hsl(${h} ${s + 20}% 55%), hsl(${h + 70} 60% 45%), hsl(${h - 50} 70% 62%), hsl(${h} ${s + 20}% 55%))"></i><span class="play">${ico('timer')}<span class="eq"><b></b><b></b><b></b><b></b></span></span></div><span>${ET.esc(name)}</span>`;
      const toggle = () => { if (mixOn === i) { stopMix(); mixOn = -1; } else if (playMix(i, vol)) mixOn = i; $$('.mix', mx).forEach((x, k) => { x.classList.toggle('on', k === mixOn); x.setAttribute('aria-pressed', String(k === mixOn)); }); };
      m.addEventListener('click', toggle); m.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }); mx.append(m);
    });
    const qk = $('#tmQuick'); qk.innerHTML = '';
    l.quickList.forEach(([name, sub], i) => { const mins = [25, 50, 15, 5][i], b = document.createElement('button'); b.className = 'qk rise'; b.style.setProperty('--d', 100 + i * 70); b.type = 'button'; b.innerHTML = `<span class="r" style="--p:${Math.min(95, mins * 1.6)}%">${ico('timer')}</span><span><b>${name}</b><span>${sub}</span></span>`; b.addEventListener('click', () => { ET.S.min = mins; ET.S.name = name.slice(0, 14); ET.S.scene = ['dawn', 'dusk', 'forest', 'night'][i]; ET.startSession(); }); qk.append(b); });
  }
  let brOn = false;
  async function breathe() {
    const l = L(), o = $('#brOrb'), h = $('#brHalo'), t = $('#brT'), s = $('#brS'), box = $('#breath'); box.classList.add('on'); brOn = true; ET.gem() && ET.gem().glow(.2);
    const phase = async (txt, ms, from, to, round) => { if (!brOn) return; t.textContent = txt; s.textContent = round; o.animate([{ transform: `scale(${from})` }, { transform: `scale(${to})` }], { duration: reduced ? 10 : ms, fill: 'forwards', easing: 'cubic-bezier(.45,.05,.3,1)' }); h.animate([{ transform: `scale(${from * 1.05})`, opacity: .8 }, { transform: `scale(${to * 1.4})`, opacity: 0 }], { duration: reduced ? 10 : ms, fill: 'forwards', easing: 'ease-out' }); await wait(reduced ? 30 : ms); };
    for (let r = 1; r <= 3 && brOn; r++) { const rt = l.round(r, 3); await phase(l.inhale, 4000, .55, 1.55, rt); await phase(l.hold, 4000, 1.55, 1.58, rt); await phase(l.exhale, 6000, 1.58, .55, rt); }
    if (brOn) { t.textContent = '✓'; s.textContent = l.breathDone; await wait(reduced ? 100 : 2200); box.classList.remove('on'); toast(l.breathDone); } brOn = false;
  }
  document.addEventListener('et-photo', (e) => { if (root && /^scene-/.test(e.detail)) render(); });
  ET.screens.timer = { title: () => L().title, mount };
})();
