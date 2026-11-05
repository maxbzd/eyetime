/* Updates, as the person sees them: a glowing chip in the title bar when a new version is there, a sheet that says what is new,
   progress while it is fetched and installed, a "what is new" after the app came back, and a card in Settings.
   Everything is decided by the helper (it checks, downloads, verifies and installs); this file only shows it and sends the clicks. */
(() => {
  'use strict';
  const ETB = window.ETB, ET = window.ET;
  if (!ETB || !ETB.req || !ET || !window.__TAURI__) return;
  const $ = ET.$, lang = () => ET.lang();

  const TX = {
    en: {
      chipNew: (v) => `Update ${v}`, chipLoad: (p) => `Downloading ${p}%`, chipReady: 'Update ready', chipInstall: 'Updating…', chipWait: 'After the block',
      title: 'A new version of EyeTime', sub: 'Ready to install in about a minute.', whatsNew: 'What is new', noNotes: 'Improvements and fixes.',
      now: 'Update now', later: 'Later', loading: (p) => `Downloading… ${p}%`, installing: 'Installing…', waiting: 'Waiting for the block to end',
      installNote: 'EyeTime closes for a few seconds and opens again by itself. Your rules and settings stay as they are.',
      lockNote: 'A locked block is running, so nothing is replaced now. The update installs by itself when it ends.',
      readyNote: 'Downloaded and checked. It installs when nothing is being blocked, or right now if you press the button.',
      auto: 'Install updates by themselves', autoD: 'Only at a quiet moment, never in the middle of a session.',
      foot: (mb) => `${mb} · from the EyeTime page on GitHub · checked with a SHA-256 fingerprint`, retry: 'Try again',
      doneT: (v) => `EyeTime is now ${v}`, doneS: 'Everything is in place. Here is what changed:', ok: 'Nice',
      setT: 'Updates', setCur: (v) => `EyeTime ${v}`, setLatest: 'You have the latest version.', setNew: (v) => `Version ${v} is available.`, setChecking: 'Looking for updates…',
      setAgo: (t) => `Checked ${t}`, setNever: 'Not checked yet', check: 'Check now', open: 'See what is new', setErr: (e) => `Could not check: ${e}`,
      agoNow: 'just now', agoMin: (m) => `${m} min ago`, agoH: (h) => `${h} h ago`, close: 'Close',
    },
    ru: {
      chipNew: (v) => `Обновление ${v}`, chipLoad: (p) => `Загрузка ${p}%`, chipReady: 'Обновление готово', chipInstall: 'Обновляется…', chipWait: 'После блокировки',
      title: 'Новая версия EyeTime', sub: 'Установится примерно за минуту.', whatsNew: 'Что нового', noNotes: 'Улучшения и исправления.',
      now: 'Обновить сейчас', later: 'Позже', loading: (p) => `Загрузка… ${p}%`, installing: 'Установка…', waiting: 'Ждём конца блокировки',
      installNote: 'EyeTime закроется на несколько секунд и откроется сам. Правила и настройки останутся как есть.',
      lockNote: 'Идёт строгая блокировка, поэтому сейчас ничего не заменяется. Обновление установится само, когда она закончится.',
      readyNote: 'Скачано и проверено. Установится, когда ничего не блокируется, или сразу, если нажать кнопку.',
      auto: 'Ставить обновления самим', autoD: 'Только в спокойный момент, не посреди сессии.',
      foot: (mb) => `${mb} · со страницы EyeTime на GitHub · проверено отпечатком SHA-256`, retry: 'Повторить',
      doneT: (v) => `EyeTime теперь ${v}`, doneS: 'Всё на месте. Вот что изменилось:', ok: 'Отлично',
      setT: 'Обновления', setCur: (v) => `EyeTime ${v}`, setLatest: 'У вас последняя версия.', setNew: (v) => `Доступна версия ${v}.`, setChecking: 'Ищем обновления…',
      setAgo: (t) => `Проверено ${t}`, setNever: 'Ещё не проверялось', check: 'Проверить', open: 'Что нового', setErr: (e) => `Не удалось проверить: ${e}`,
      agoNow: 'только что', agoMin: (m) => `${m} мин назад`, agoH: (h) => `${h} ч назад`, close: 'Закрыть',
    },
  };
  const L = () => TX[lang()] || TX.en;
  const mb = (n) => (n ? (n / 1048576).toFixed(1).replace('.', lang() === 'ru' ? ',' : '.') + (lang() === 'ru' ? ' МБ' : ' MB') : '');
  const ago = (ms) => (ms < 0 ? L().setNever : ms < 90000 ? L().setAgo(L().agoNow) : ms < 3600000 ? L().setAgo(L().agoMin(Math.round(ms / 60000))) : L().setAgo(L().agoH(Math.round(ms / 3600000))));

  const css = document.createElement('style');
  css.textContent = `
  .upd-chip{position:relative;display:none;align-items:center;gap:9px;height:40px;padding:0 16px 0 8px;border-radius:999px;border:1px solid rgba(140,242,198,.5);color:var(--mint);cursor:pointer;
    background:linear-gradient(135deg,rgba(140,242,198,.20),rgba(134,215,255,.10));backdrop-filter:blur(16px);font:600 14px/1 var(--font-body,system-ui);letter-spacing:.01em;
    transition:transform .35s var(--spring,ease),box-shadow .3s,border-color .3s;animation:updIn .7s var(--spring,ease) both}
  .upd-chip.on{display:flex}
  .upd-chip:hover{transform:translateY(-1px);box-shadow:0 0 0 5px rgba(140,242,198,.10),0 10px 30px -10px rgba(140,242,198,.55)}
  .upd-chip:active{transform:scale(.96)}
  .upd-chip::after{content:"";position:absolute;inset:-1px;border-radius:inherit;border:1px solid rgba(140,242,198,.55);opacity:0;animation:updPulse 2.8s ease-out infinite;pointer-events:none}
  .upd-chip.busy::after,.upd-chip.wait::after{animation:none}
  .upd-chip.wait{border-color:rgba(255,184,107,.5);color:var(--amber,#ffb86b);background:linear-gradient(135deg,rgba(255,184,107,.16),rgba(255,184,107,.05))}
  .upd-orb{position:relative;width:26px;height:26px;flex:none;display:grid;place-items:center}
  .upd-orb svg{position:absolute;inset:0;width:26px;height:26px;overflow:visible}
  .upd-orb .arrow{width:12px;height:12px;position:relative;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;animation:updBob 1.8s ease-in-out infinite}
  .upd-orb .track{fill:none;stroke:currentColor;stroke-opacity:.22;stroke-width:2.2}
  .upd-orb .ring{fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;transform:rotate(-90deg);transform-origin:50% 50%;transition:stroke-dashoffset .5s ease;stroke-dasharray:62.8;stroke-dashoffset:0}
  .upd-chip.busy .upd-orb .arrow{animation:none}
  .upd-chip.spin .upd-orb svg{animation:updSpin 1.1s linear infinite}
  .upd-chip.spin .upd-orb .ring{stroke-dashoffset:44}
  @keyframes updIn{from{opacity:0;transform:translateY(-8px) scale(.85)}to{opacity:1;transform:none}}
  @keyframes updPulse{0%{opacity:.7;transform:scale(1)}70%,100%{opacity:0;transform:scale(1.28,1.7)}}
  @keyframes updBob{0%,100%{transform:translateY(1px)}50%{transform:translateY(-1.5px)}}
  @keyframes updSpin{to{transform:rotate(360deg)}}

  .upd-scrim{position:fixed;inset:0;z-index:180;display:grid;place-items:center;background:rgba(2,6,5,.6);backdrop-filter:blur(16px);opacity:0;transition:opacity .3s}
  .upd-scrim.on{opacity:1}
  .upd-card{position:relative;width:min(460px,calc(100vw - 32px));max-height:calc(100vh - 40px);overflow:auto;padding:30px 30px 22px;border-radius:30px;color:var(--text,#eaf7f0);
    background:radial-gradient(120% 70% at 50% -10%,rgba(140,242,198,.16),transparent 60%),linear-gradient(180deg,rgba(26,38,33,.94),rgba(9,14,12,.96));
    border:1px solid var(--edge-hi,rgba(220,255,240,.3));box-shadow:0 40px 100px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.07);transform:translateY(18px) scale(.96);transition:transform .5s var(--spring,ease)}
  .upd-scrim.on .upd-card{transform:none}
  .upd-x{position:absolute;right:14px;top:14px;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;color:var(--text-3,#9db);background:transparent;border:0;cursor:pointer;transition:background .2s,color .2s}
  .upd-x:hover{background:rgba(255,255,255,.08);color:var(--text,#fff)}.upd-x svg{width:14px;height:14px;stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round}
  .upd-hero{display:flex;flex-direction:column;align-items:center;text-align:center}
  .upd-eye{position:relative;width:118px;height:118px;margin-bottom:6px}
  .upd-eye::before{content:"";position:absolute;inset:-26px;border-radius:50%;background:radial-gradient(closest-side,rgba(140,242,198,.34),rgba(134,215,255,.10) 55%,transparent);animation:updBreath 4.5s ease-in-out infinite}
  .upd-eye svg{position:relative;width:118px;height:118px;overflow:visible}
  .upd-eye .tr{fill:none;stroke:rgba(255,255,255,.1);stroke-width:2.5}
  .upd-eye .pg{fill:none;stroke:url(#updG);stroke-width:3;stroke-linecap:round;stroke-dasharray:314;stroke-dashoffset:314;transform:rotate(-90deg);transform-origin:60px 60px;transition:stroke-dashoffset .6s ease}
  .upd-eye .iris{fill:rgba(255,255,255,.04);stroke:var(--text,#fff);stroke-width:3}
  .upd-eye .pupil{fill:var(--mint,#8cf2c6);transform-origin:60px 60px;animation:pupil 6s ease-in-out infinite}
  .upd-eye .sparks{transform-origin:60px 60px;opacity:0;transition:opacity .5s}
  .upd-card.installing .upd-eye .sparks{opacity:1;animation:updSpin 2.6s linear infinite}
  .upd-card.installing .upd-eye .pg{stroke-dashoffset:60;animation:updSpin 1.6s linear infinite}
  @keyframes updBreath{0%,100%{transform:scale(.94);opacity:.8}50%{transform:scale(1.06);opacity:1}}
  .upd-ttl{margin:10px 0 2px;font:400 15px/1.3 var(--font-body,system-ui);color:var(--text-2,#9bb);letter-spacing:.01em}
  .upd-ver{display:flex;align-items:center;justify-content:center;gap:14px;margin:4px 0 2px;font:300 40px/1.1 var(--font-display,Outfit,system-ui);letter-spacing:-.01em}
  .upd-ver .from{color:var(--text-3,#789);font-size:26px;text-decoration:line-through;text-decoration-color:rgba(255,255,255,.18)}
  .upd-ver .to{background:linear-gradient(120deg,#eafff5,var(--mint,#8cf2c6) 55%,var(--sky,#86d7ff));-webkit-background-clip:text;background-clip:text;color:transparent}
  .upd-ver svg{width:26px;height:26px;stroke:var(--mint,#8cf2c6);stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;animation:updNudge 2s ease-in-out infinite}
  @keyframes updNudge{0%,100%{transform:translateX(-2px)}50%{transform:translateX(3px)}}
  .upd-sub{margin:2px 0 0;color:var(--text-2,#9bb);font-size:14px}
  .upd-notes{margin:20px 0 0;padding:16px 18px 12px;border-radius:20px;background:rgba(255,255,255,.04);border:1px solid var(--edge,rgba(200,255,230,.13))}
  .upd-notes h4{margin:0 0 10px;font:600 11px/1 var(--font-body,system-ui);letter-spacing:.14em;text-transform:uppercase;color:var(--text-3,#789)}
  .upd-notes ul{list-style:none;margin:0;padding:0;display:grid;gap:9px}
  .upd-notes li{position:relative;padding-left:26px;font-size:14px;line-height:1.4;color:var(--text,#eaf7f0);animation:updRise .55s var(--out-expo,ease) both}
  .upd-notes li::before{content:"";position:absolute;left:2px;top:3px;width:14px;height:14px;border-radius:50%;background:rgba(140,242,198,.18) url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14'><path d='M4 7.2l2 2L10 5' fill='none' stroke='%238cf2c6' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/></svg>") center/14px no-repeat}
  @keyframes updRise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  .upd-bar{height:8px;margin:18px 2px 0;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden;display:none}
  .upd-card.loading .upd-bar,.upd-card.installing .upd-bar{display:block}
  .upd-bar i{display:block;height:100%;width:0;border-radius:inherit;background:linear-gradient(90deg,var(--mint,#8cf2c6),var(--sky,#86d7ff));box-shadow:0 0 14px rgba(140,242,198,.6);transition:width .5s ease;position:relative;overflow:hidden}
  .upd-bar i::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.55) 50%,transparent 70%);transform:translateX(-100%);animation:updShine 1.6s ease-in-out infinite}
  .upd-card.installing .upd-bar i{width:100%!important;animation:updPulseBar 1.6s ease-in-out infinite}
  @keyframes updShine{to{transform:translateX(100%)}}@keyframes updPulseBar{50%{opacity:.55}}
  .upd-msg{margin:14px 2px 0;font-size:13px;line-height:1.5;color:var(--text-2,#9bb);min-height:0}
  .upd-msg:empty{display:none}.upd-msg.u-warn{color:var(--amber,#ffb86b)}.upd-msg.u-err{color:#ff9aa6}
  .upd-auto{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:16px 0 0;padding:12px 4px 0;border-top:1px solid var(--edge,rgba(200,255,230,.13));cursor:pointer}
  .upd-auto b{display:block;font:500 14px/1.3 var(--font-body,system-ui)}.upd-auto span{display:block;margin-top:2px;font-size:12px;color:var(--text-3,#789)}
  .upd-sw{position:relative;flex:none;width:44px;height:26px;border-radius:99px;background:rgba(255,255,255,.12);border:0;padding:0;cursor:pointer;transition:background .3s}
  .upd-sw::after{content:"";position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.4);transition:transform .35s var(--spring,ease)}
  .upd-sw[aria-checked=true]{background:linear-gradient(135deg,var(--mint,#8cf2c6),var(--sky,#86d7ff))}.upd-sw[aria-checked=true]::after{transform:translateX(18px);background:#04100b}
  .upd-sw:focus-visible,.upd-act button:focus-visible,.upd-chip:focus-visible,.upd-x:focus-visible{outline:2px solid var(--mint,#8cf2c6);outline-offset:2px}
  .upd-act{display:flex;gap:10px;justify-content:flex-end;margin-top:18px}
  .upd-act button{flex:none;white-space:nowrap;height:46px;padding:0 24px;border-radius:999px;border:1px solid var(--edge,rgba(200,255,230,.2));background:rgba(255,255,255,.06);color:inherit;font:600 14px var(--font-body,system-ui);cursor:pointer;transition:transform .3s var(--spring,ease),opacity .2s}
  .upd-act button:hover{transform:translateY(-1px)}.upd-act button:active{transform:scale(.96)}
  .upd-act button.go{background:#f4faf7;color:#04100b;border-color:transparent;box-shadow:0 8px 24px -8px rgba(255,255,255,.35)}
  .upd-act button:disabled{opacity:.5;pointer-events:none}
  .upd-foot{margin:14px 0 0;text-align:center;font-size:11px;color:var(--text-3,#789);letter-spacing:.01em}
  .upd-done .upd-eye .pg{stroke-dashoffset:0}
  .upd-conf{position:absolute;inset:0;overflow:hidden;border-radius:inherit;pointer-events:none}
  .upd-conf i{position:absolute;top:96px;left:50%;width:6px;height:6px;border-radius:50%;opacity:0;animation:updConf 1.8s var(--out-expo,ease) forwards}
  @keyframes updConf{0%{opacity:1;transform:translate(0,0) scale(.4)}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(1)}}
  #updAutoRow .c{display:flex;align-items:center}
  #updSeeRow[hidden]{display:none}
  @media (prefers-reduced-motion:reduce){.upd-chip,.upd-chip::after,.upd-orb .arrow,.upd-eye::before,.upd-eye .pupil,.upd-ver svg,.upd-bar i::after,.upd-card.installing .upd-eye .sparks,.upd-card.installing .upd-eye .pg,.upd-conf i{animation:none!important}}
  `;
  document.head.append(css);

  const ARROW = '<svg class="arrow" viewBox="0 0 12 12"><path d="M6 10V2M2.5 5.5 6 2l3.5 3.5"/></svg>';
  const chip = document.createElement('button');
  chip.type = 'button'; chip.id = 'updChip'; chip.className = 'upd-chip';
  chip.innerHTML = `<span class="upd-orb"><svg viewBox="0 0 26 26"><circle class="track" cx="13" cy="13" r="10"/><circle class="ring" cx="13" cy="13" r="10"/></svg>${ARROW}</span><span class="t"></span>`;
  const anchor = $('.tb-right'), lb = $('#langBtn');
  if (anchor) anchor.insertBefore(chip, lb || anchor.firstChild);

  let u = null, sheet = null, doneSheet = null, doneShownFor = '';
  const send = async (op, extra) => { const r = await ETB.req({ op, ...(extra || {}) }); if (r.ok && r.data && r.data.state) paint(r.data); return r; };

  /* ---------------------------------------------------------------- the chip */
  function paintChip() {
    const has = u && u.info && ['available', 'downloading', 'ready', 'installing'].includes(u.state);
    chip.classList.toggle('on', !!has);
    if (!has) return;
    const busy = u.state === 'downloading' || u.state === 'installing';
    const wait = !!u.waitingForLock;
    chip.classList.toggle('busy', busy); chip.classList.toggle('wait', wait); chip.classList.toggle('spin', u.state === 'installing');
    const ring = $('.ring', chip), pct = u.state === 'downloading' ? u.pct : u.state === 'ready' || u.state === 'installing' ? 100 : 0;
    if (u.state !== 'installing') ring.style.strokeDashoffset = u.state === 'available' ? '0' : String(62.8 * (1 - pct / 100));
    else ring.style.strokeDashoffset = '';
    const txt = wait ? L().chipWait : u.state === 'downloading' ? L().chipLoad(u.pct) : u.state === 'installing' ? L().chipInstall : u.state === 'ready' ? L().chipReady : L().chipNew(u.info.version);
    const t = $('.t', chip); if (t.textContent !== txt) t.textContent = txt;
    chip.setAttribute('aria-label', txt);
  }
  chip.addEventListener('click', () => openSheet());

  /* ---------------------------------------------------------------- the sheet */
  function scrim(inner, cls) {
    const s = document.createElement('div'); s.className = 'upd-scrim'; s.setAttribute('role', 'dialog'); s.setAttribute('aria-modal', 'true');
    s.innerHTML = `<div class="upd-card ${cls || ''}">${inner}</div>`;
    document.body.append(s); requestAnimationFrame(() => s.classList.add('on'));
    return s;
  }
  const XSVG = '<svg viewBox="0 0 14 14"><path d="M2 2l10 10M12 2 2 12"/></svg>';
  const EYE = (sparks) => `<div class="upd-eye"><svg viewBox="0 0 120 120"><defs><linearGradient id="updG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8cf2c6"/><stop offset="1" stop-color="#86d7ff"/></linearGradient></defs>
    <circle class="tr" cx="60" cy="60" r="50"/><circle class="pg" cx="60" cy="60" r="50"/><circle class="iris" cx="60" cy="60" r="27"/><circle class="pupil" cx="60" cy="60" r="11"/>
    <g class="sparks">${[0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${60 + 50 * Math.cos((i * Math.PI) / 3)}" cy="${60 + 50 * Math.sin((i * Math.PI) / 3)}" r="${i % 2 ? 2.2 : 3.2}" fill="#d4f77c"/>`).join('')}</g></svg>${sparks || ''}</div>`;

  function closeSheet(el, after) { if (!el) return; el.classList.remove('on'); setTimeout(() => el.remove(), 320); document.removeEventListener('keydown', onEsc, true); if (after) after(); }
  const onEsc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); if (doneSheet) dismissDone(); else if (sheet) { closeSheet(sheet); sheet = null; } } };

  function openSheet() {
    if (sheet || !u || !u.info) return;
    sheet = scrim(`<button class="upd-x" type="button" aria-label="${L().close}">${XSVG}</button>
      <div class="upd-hero">${EYE()}<div class="upd-ttl"></div><div class="upd-ver"><span class="from"></span><svg viewBox="0 0 26 26"><path d="M4 13h17M15 6l7 7-7 7"/></svg><span class="to"></span></div><p class="upd-sub"></p></div>
      <div class="upd-notes"><h4></h4><ul></ul></div>
      <div class="upd-bar"><i></i></div><div class="upd-msg"></div>
      <div class="upd-auto" role="presentation"><div><b></b><span></span></div><button class="upd-sw" type="button" role="switch" aria-checked="false"></button></div>
      <div class="upd-act"><button type="button" class="upd-later"></button><button type="button" class="go"></button></div><div class="upd-foot"></div>`);
    document.addEventListener('keydown', onEsc, true);
    const s = sheet;
    $('.upd-x', s).onclick = () => { closeSheet(s); sheet = null; };
    s.addEventListener('mousedown', (e) => { if (e.target === s) { closeSheet(s); sheet = null; } });
    $(".upd-later", s).onclick = () => { closeSheet(s); sheet = null; };
    $('.go', s).onclick = () => send('update_install');
    const sw = $('.upd-sw', s); const flip = async () => { const on = sw.getAttribute('aria-checked') !== 'true'; sw.setAttribute('aria-checked', String(on)); await send('update_set_auto', { on }); };
    sw.onclick = (e) => { e.stopPropagation(); flip(); }; $('.upd-auto', s).onclick = (e) => { if (e.target !== sw) flip(); };
    paintSheet(true); setTimeout(() => $('.go', s).focus(), 350);
  }
  const set = (el, txt) => { if (el && el.textContent !== txt) el.textContent = txt; };
  function paintSheet(first) {
    if (!sheet) return;
    if (!u || !u.info || !['available', 'downloading', 'ready', 'installing'].includes(u.state)) { const s = sheet; sheet = null; closeSheet(s); return; }
    const s = sheet, card = $('.upd-card', s), i = u.info;
    const loading = u.state === 'downloading', installing = u.state === 'installing';
    card.classList.toggle('loading', loading); card.classList.toggle('installing', installing);
    set($('.upd-ttl', s), L().title); set($('.from', s), u.current); set($('.to', s), i.version);
    set($('.upd-sub', s), L().sub); set($('.upd-notes h4', s), L().whatsNew);
    const ul = $('.upd-notes ul', s), notes = i.notes && i.notes.length ? i.notes : [L().noNotes];
    if (first || ul.dataset.l !== lang() + '|' + notes.join('|')) { ul.dataset.l = lang() + '|' + notes.join('|'); ul.innerHTML = ''; notes.forEach((n, k) => { const li = document.createElement('li'); li.textContent = n; li.style.animationDelay = 120 + k * 70 + 'ms'; ul.append(li); }); }
    const pct = loading ? u.pct : u.state === 'ready' || installing ? 100 : 0;
    $('.upd-bar i', s).style.width = pct + '%';
    $('.pg', s).style.strokeDashoffset = installing ? '' : String(314 * (1 - pct / 100));
    const msg = $('.upd-msg', s); let m = '', cls = '';
    if (u.waitingForLock) { m = L().lockNote; cls = 'u-warn'; } else if (installing) m = L().installNote; else if (u.error) { m = u.error; cls = 'u-err'; } else if (u.state === 'ready') m = L().readyNote;
    set(msg, m); msg.className = 'upd-msg ' + cls;
    const [a, ad] = $('.upd-auto', s).querySelectorAll('b,span'); set(a, L().auto); set(ad, L().autoD);
    $('.upd-sw', s).setAttribute('aria-checked', String(!!u.auto)); $('.upd-sw', s).setAttribute('aria-label', L().auto);
    set($(".upd-later", s), L().later);
    const go = $('.go', s);
    set(go, loading ? L().loading(u.pct) : installing ? L().installing : u.waitingForLock ? L().waiting : u.error && u.state === 'available' ? L().retry : L().now);
    go.disabled = loading || installing || !!u.waitingForLock;
    set($('.upd-foot', s), L().foot(mb(i.size) || ''));
    $('.upd-x', s).setAttribute('aria-label', L().close);
  }

  /* ---------------------------------------------------------------- after the update: what is new */
  function dismissDone() { const d = doneSheet; doneSheet = null; closeSheet(d); send('update_ack'); }
  function openDone() {
    if (doneSheet || sheet || !u || !u.updated) return;
    const up = u.updated; doneShownFor = up.to;
    const sparks = '<div class="upd-conf">' + Array.from({ length: 22 }, (_, k) => { const a = (k / 22) * Math.PI * 2 + (k % 3) * 0.2, r = 90 + (k % 5) * 26; const c = ['#8cf2c6', '#86d7ff', '#d4f77c', '#a98bff'][k % 4]; return `<i style="--dx:${Math.cos(a) * r}px;--dy:${Math.sin(a) * r - 10}px;background:${c};animation-delay:${(k % 6) * 40}ms"></i>`; }).join('') + '</div>';
    const notes = up.notes && up.notes.length ? up.notes : [L().noNotes];
    doneSheet = scrim(`<div class="upd-hero">${EYE()}<div class="upd-ver" style="margin-top:14px"><span class="to">${L().doneT(up.to).replace(/</g, '&lt;')}</span></div><p class="upd-sub">${L().doneS}</p></div>
      <div class="upd-notes"><h4>${L().whatsNew}</h4><ul>${notes.map((n, k) => `<li style="animation-delay:${200 + k * 80}ms"></li>`).join('')}</ul></div>
      <div class="upd-act"><button type="button" class="go">${L().ok}</button></div>${sparks}`, 'upd-done');
    $$('li', doneSheet).forEach((li, k) => { li.textContent = notes[k]; });
    $('.upd-ver .to', doneSheet).style.fontSize = '30px';
    document.addEventListener('keydown', onEsc, true);
    $('.go', doneSheet).onclick = dismissDone; const d0 = doneSheet; setTimeout(() => { const g = d0 && $('.go', d0); if (g) g.focus(); }, 400);
  }
  const $$ = ET.$$;

  /* ---------------------------------------------------------------- the "About" group in Settings becomes the place for updates */
  function settingsCard() {
    const old = $('#sUpd'), grp = old ? old.closest('.st-group') : $('#etbUpdGroup');
    if (!grp) return;
    if (!grp.dataset.upd) {
      grp.dataset.upd = '1'; grp.id = 'etbUpdGroup';
      const row = old.closest('.st-row'), nb = old.cloneNode(true); old.replaceWith(nb); nb.id = 'sUpd'; nb.onclick = () => send('update_check');
      if (!$('.t span', row)) $('.t', row).append(document.createElement('span'));
      row.insertAdjacentHTML('afterend', `<div class="st-row" id="updAutoRow"><div class="t"><b></b><span></span></div><div class="c"><button class="upd-sw" type="button" role="switch" aria-checked="false"></button></div></div>
        <div class="st-row" id="updSeeRow" hidden><div class="t"><b></b></div><div class="c"><button class="btn-s" type="button"></button></div></div>`);
      const sw = $('#updAutoRow .upd-sw', grp); const flip = async () => { const on = sw.getAttribute('aria-checked') !== 'true'; sw.setAttribute('aria-checked', String(on)); await send('update_set_auto', { on }); };
      sw.onclick = (e) => { e.stopPropagation(); flip(); }; $('#updAutoRow', grp).onclick = (e) => { if (e.target !== sw) flip(); };
      $('#updSeeRow button', grp).onclick = () => openSheet();
    }
    if (!u) return;
    const rows = grp.querySelectorAll('.st-row'), verRow = rows[0], chkRow = rows[1];
    set($('.c span', verRow), L().setCur(u.current));
    const st = u.state === 'checking' ? L().setChecking : u.info && u.state !== 'idle' ? L().setNew(u.info.version) : u.state === 'error' && u.error ? L().setErr(u.error) : L().setLatest;
    set($('.t b', chkRow), L().setT); set($('.t span', chkRow), `${st} ${u.state === 'checking' ? '' : ago(u.checkedAgoMs)}`.trim());
    const chk = $('#sUpd', grp); if (chk.lastChild.textContent !== L().check) chk.lastChild.textContent = L().check;
    chk.disabled = u.state === 'checking' || u.state === 'downloading' || u.state === 'installing';
    const [a, ad] = $('#updAutoRow', grp).querySelectorAll('b,span'); set(a, L().auto); set(ad, L().autoD);
    $('#updAutoRow .upd-sw', grp).setAttribute('aria-checked', String(!!u.auto));
    const see = $('#updSeeRow', grp), show = !!(u.info && ['available', 'downloading', 'ready'].includes(u.state));
    see.hidden = !show; set($('.t b', see), L().setNew(u.info ? u.info.version : '')); set($('button', see), L().open);
  }
  new MutationObserver(settingsCard).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('et-settings-shown', settingsCard);

  /* ---------------------------------------------------------------- the news from the helper */
  function paint(next) {
    u = next; paintChip(); paintSheet(false); settingsCard();
    if (u && u.updated && doneShownFor !== u.updated.to) setTimeout(openDone, 1200);
  }
  document.addEventListener('et-status', (e) => { if (e.detail && e.detail.update) paint(e.detail.update); });
  ET.langHooks.push(() => { paintChip(); paintSheet(true); settingsCard(); });
  if (ETB.getStatus && ETB.getStatus() && ETB.getStatus().update) paint(ETB.getStatus().update);
})();
