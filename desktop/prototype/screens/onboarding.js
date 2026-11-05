/* The first minute: "The Door". Not slides: you wake the stone by holding it, choose the doors that pull you away,
   paint your quiet hours on a day dial, pick how hard the door is to open, say why, and close the door by holding it shut.
   What you choose becomes the first rule and the first list. Works in the app and in the plain browser prototype. */
(() => {
  'use strict';
  const ET = window.ET;
  if (!ET) return;
  const { $, $$, clamp } = ET;
  const reduced = ET.reduced;

  /* ---------------------------------------------------------------- words */
  const D = {
    en: {
      skip: 'Skip', back: 'Back', next: 'Continue', begin: 'Begin',
      wakeH: 'Hold to wake it', wakeS: 'Press and hold the stone.', title: 'EyeTime', tag: 'Quiet is built from closed doors.',
      doorsT: 'What pulls you away?', doorsS: 'Tap what you want closed while you work. You can change this any time.', doorsAdd: 'Add a site or an app', doorsAddB: 'Add', doorsN: (n) => (n === 0 ? 'Nothing chosen yet' : `${n} ${n === 1 ? 'door' : 'doors'} to close`),
      presets: [['Social', ['Instagram', 'X', 'TikTok', 'Facebook', 'Snapchat']], ['Video', ['YouTube', 'Twitch', 'Netflix']], ['Games', ['Steam', 'Discord', 'Roblox']], ['Chats', ['Telegram', 'WhatsApp', 'Discord']]],
      hoursT: 'When do you want quiet?', hoursS: 'Drag the two lights around the day. Sun is noon, the moon is midnight.', quiet: (a, b, h) => `Quiet from ${a} to ${b} · ${h}`, allDay: 'The whole day', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], pw: 'Work 9–17', pe: 'Evening 20–23', pn: 'Night 23–6',
      hardT: 'How hard should it be to give in?', hardS: 'Be honest with yourself. Harder is not always better: you can always raise it later.',
      lv: [['Normal', 'You can leave or pause at any time.'], ['Timeout', 'Leaving takes a small effort: a hold, a wait, a few words.'], ['Locked', 'No way out until it ends. Only an emergency key opens it.'], ['Frozen', 'Everything closed. Choose this later, when you know your rhythm.']],
      rec: 'Recommended', later: 'Later', lockedNote: 'Locked blocks cannot be ended. You get a few emergency keys a month, and one a week.',
      linkT: 'Connect your browser', linkS: 'So that EyeTime can close pages and words, not only whole sites. One time, one minute.', eng: 'Blocking engine', ext: 'Browser extension', on: 'Connected', off: 'Not connected', wait: 'Looking…', openF: 'Open the extension folder', openC: 'Chrome extensions', openE: 'Edge extensions', linkH: 'Open the extensions page, switch on Developer mode, Load unpacked, pick the folder. This step can wait.',
      whyT: 'Why are you doing this?', whyS: 'One sentence. EyeTime will remind you of it when you reach for a closed door.', whyPh: 'I am doing this so that…', whys: ['finish what matters', 'sleep better', 'be present with people', 'study without noise'],
      sealH: 'Hold to close the door', sealS: 'Keep holding.', done: 'The door is closed.', doneS: 'Quiet is on. Your first rule is in place.', go25: 'Start 25 minutes now', look: 'Look around',
    },
    ru: {
      skip: 'Пропустить', back: 'Назад', next: 'Дальше', begin: 'Начать',
      wakeH: 'Удерживайте, чтобы разбудить', wakeS: 'Нажмите на камень и держите.', title: 'EyeTime', tag: 'Тишина строится из закрытых дверей.',
      doorsT: 'Что вас отвлекает?', doorsS: 'Отметьте то, что должно быть закрыто, пока вы работаете. Потом можно изменить.', doorsAdd: 'Добавить сайт или приложение', doorsAddB: 'Добавить', doorsN: (n) => (n === 0 ? 'Пока ничего не выбрано' : `Дверей закрыть: ${n}`),
      presets: [['Соцсети', ['Instagram', 'X', 'TikTok', 'Facebook', 'Snapchat']], ['Видео', ['YouTube', 'Twitch', 'Netflix']], ['Игры', ['Steam', 'Discord', 'Roblox']], ['Чаты', ['Telegram', 'WhatsApp', 'Discord']]],
      hoursT: 'Когда вам нужна тишина?', hoursS: 'Двигайте два огонька по кругу дня. Солнце — полдень, луна — полночь.', quiet: (a, b, h) => `Тишина с ${a} до ${b} · ${h}`, allDay: 'Весь день', days: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'], pw: 'Работа 9–17', pe: 'Вечер 20–23', pn: 'Ночь 23–6',
      hardT: 'Насколько трудно должно быть сдаться?', hardS: 'Будьте честны с собой. Строже — не всегда лучше: усилить можно в любой момент.',
      lv: [['Обычный', 'Выйти или поставить на паузу можно когда угодно.'], ['Тайм-аут', 'Чтобы выйти, нужно небольшое усилие: удержать, подождать, набрать несколько слов.'], ['Строгий', 'Выхода нет до конца. Откроет только аварийный ключ.'], ['Заморозка', 'Закрыто всё. Выберите позже, когда поймёте свой ритм.']],
      rec: 'Рекомендуем', later: 'Позже', lockedNote: 'Строгую блокировку нельзя закончить. Аварийных ключей несколько в месяц и один в неделю.',
      linkT: 'Подключите браузер', linkS: 'Чтобы EyeTime закрывал страницы и слова, а не только сайты целиком. Один раз, одна минута.', eng: 'Движок блокировки', ext: 'Расширение для браузера', on: 'Подключено', off: 'Не подключено', wait: 'Проверяю…', openF: 'Открыть папку расширения', openC: 'Расширения Chrome', openE: 'Расширения Edge', linkH: 'Откройте страницу расширений, включите «Режим разработчика», «Загрузить распакованное», выберите папку. Этот шаг можно отложить.',
      whyT: 'Зачем вам это?', whyS: 'Одна фраза. EyeTime напомнит её, когда вы потянетесь к закрытой двери.', whyPh: 'Я делаю это, чтобы…', whys: ['успеть главное', 'лучше спать', 'быть рядом с людьми', 'учиться без шума'],
      sealH: 'Удерживайте, чтобы закрыть дверь', sealS: 'Держите.', done: 'Дверь закрыта.', doneS: 'Тишина включена. Первое правило готово.', go25: 'Начать на 25 минут', look: 'Осмотреться',
    },
  };
  const T = () => D[ET.lang()] || D.en;
  const ICO = (n, c = '') => `<svg class="ico ${c}"><use href="#i-${n}"/></svg>`;
  const IMG = { wake: 'assets/lake-night-1.jpg', doors: 'assets/door-forest.jpg', hours: 'assets/lake-night-2.jpg', hard: 'assets/lake-night-3.jpg', link: 'assets/lake-night-2.jpg', why: 'assets/lake-night-4.jpg', seal: 'assets/door-forest.jpg', done: 'assets/lake-night-1.jpg' };

  /* ---------------------------------------------------------------- styles */
  const css = document.createElement('style');
  css.textContent = `
  #onb{position:fixed;inset:0;z-index:150;background:#04070c;color:var(--text,#eaf2ff);opacity:0;pointer-events:none;transition:opacity .9s ease;font-family:inherit;overflow:hidden}
  #onb.on{opacity:1;pointer-events:auto}
  #onb .bg{position:absolute;inset:-3%;background:center/cover no-repeat;opacity:0;transform:scale(1.08);transition:opacity 1.6s ease,transform 16s ease-out,filter 1.2s}
  #onb .bg.on{opacity:1;transform:scale(1)}
  #onb .bg.dim{filter:brightness(.55) saturate(.9)}
  #onb .vig{position:absolute;inset:0;background:radial-gradient(110% 85% at 50% 42%,rgba(4,7,12,0) 25%,rgba(4,7,12,.5) 68%,rgba(4,7,12,.9) 100%),linear-gradient(180deg,rgba(4,7,12,.35),rgba(4,7,12,0) 30%,rgba(4,7,12,.55))}
  #onb .fog{position:absolute;left:-20%;right:-20%;height:46%;bottom:-6%;background:radial-gradient(60% 60% at 50% 50%,rgba(170,200,210,.16),transparent 70%);filter:blur(24px);animation:onbfog 22s ease-in-out infinite alternate;pointer-events:none}
  #onb .fog.b{top:6%;bottom:auto;height:34%;animation-duration:30s;animation-direction:alternate-reverse;opacity:.7}
  @keyframes onbfog{from{transform:translateX(-7%)}to{transform:translateX(7%)}}
  #onb .top{position:absolute;top:0;left:0;right:0;height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 28px;z-index:5}
  #onb .pips{display:flex;gap:7px}#onb .pips i{width:28px;height:3px;border-radius:3px;background:rgba(255,255,255,.2);transition:background .5s,width .5s}#onb .pips i.on{background:#8cf2c6;width:44px}#onb .pips i.past{background:rgba(140,242,198,.5)}
  #onb .skip{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);color:var(--text-2,#9fb0c8);border-radius:999px;padding:8px 16px;font:500 14px Figtree,system-ui;cursor:pointer;transition:all .2s}#onb .skip:hover{color:#fff;background:rgba(255,255,255,.14)}
  #onb .stage{position:absolute;inset:64px 0 0;display:grid;place-items:center;padding:0 24px 24px}
  #onb .act{position:absolute;width:min(920px,100%);display:flex;flex-direction:column;align-items:center;text-align:center;opacity:0;transform:translateY(28px) scale(.985);pointer-events:none;transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .9s cubic-bezier(.16,1,.3,1)}
  #onb .act.on{opacity:1;transform:none;pointer-events:auto}
  #onb h2{font:300 clamp(28px,4.2vw,44px)/1.1 Outfit,Figtree,system-ui;letter-spacing:.3px;text-shadow:0 2px 30px rgba(0,0,0,.6)}
  #onb .sub{margin-top:12px;color:#b6c4d8;font-size:16px;line-height:1.5;max-width:560px;text-shadow:0 1px 18px rgba(0,0,0,.7)}
  #onb .glass{background:linear-gradient(180deg,rgba(18,26,38,.62),rgba(8,13,22,.7));border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-radius:26px;box-shadow:0 30px 80px rgba(0,0,0,.45)}
  #onb .row{display:flex;gap:12px;align-items:center;justify-content:center;margin-top:22px;flex-wrap:nowrap}
  #onb .cta{min-width:200px;height:52px;padding:0 32px;border:0;border-radius:999px;background:linear-gradient(135deg,#8cf2c6,#d4f77c);color:#07120d;font:600 16px Figtree,system-ui;cursor:pointer;box-shadow:0 10px 40px rgba(140,242,198,.35),inset 0 1px 0 rgba(255,255,255,.5);transition:transform .3s cubic-bezier(.16,1,.3,1),box-shadow .3s,opacity .3s;position:relative;overflow:hidden}
  #onb .cta:hover:not(:disabled){transform:translateY(-2px) scale(1.02)}#onb .cta:disabled{opacity:.4;cursor:default;box-shadow:none}
  #onb .ghost{background:none;border:0;color:#9fb0c8;font:500 15px Figtree,system-ui;cursor:pointer;padding:10px 16px;border-radius:999px}#onb .ghost:hover{color:#fff;background:rgba(255,255,255,.07)}
  /* the stone */
  #onb .stone{position:relative;width:min(300px,38vh);aspect-ratio:1;margin:0 auto}
  #onb .stone img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;transition:filter 1.4s,transform 1.4s cubic-bezier(.16,1,.3,1);filter:brightness(.18) saturate(.3) drop-shadow(0 0 0 rgba(140,242,198,0));animation:onbfloat 7s ease-in-out infinite}
  #onb .stone.lit .ring{opacity:0;transition:opacity .8s}#onb .stone{margin-bottom:34px}#onb .stone.lit img{filter:brightness(1) saturate(1.05) drop-shadow(0 0 46px rgba(140,242,198,.45))}
  #onb .stone .ring{position:absolute;inset:-26px;width:calc(100% + 52px);height:calc(100% + 52px);transform:rotate(-90deg);pointer-events:none}
  #onb .ring circle{fill:none;stroke-width:2.2}#onb .ring .bgc{stroke:rgba(255,255,255,.12)}#onb .ring .fgc{stroke:url(#onbg);stroke-linecap:round;stroke-dasharray:100;stroke-dashoffset:100;filter:drop-shadow(0 0 6px rgba(140,242,198,.8))}
  @keyframes onbfloat{50%{transform:translateY(-9px)}}
  #onb .holdzone{cursor:pointer;touch-action:none;-webkit-user-select:none;user-select:none}
  #onb .hint{margin-top:30px;font:500 15px Figtree,system-ui;letter-spacing:.4px;color:#cfe3f5;animation:onbpulse 2.4s ease-in-out infinite}
  @keyframes onbpulse{50%{opacity:.45}}
  #onb .titleword{font:200 clamp(48px,8vw,84px)/1 Outfit,Figtree,system-ui;letter-spacing:2px;margin-top:6px;display:flex}
  #onb .titleword span{opacity:0;transform:translateY(20px);filter:blur(8px);display:inline-block;transition:all 1s cubic-bezier(.16,1,.3,1)}#onb .titleword.on span{opacity:1;transform:none;filter:none}
  /* the doors: tiles */
  #onb .doors{display:grid;grid-template-columns:repeat(auto-fill,minmax(108px,1fr));gap:10px;margin-top:16px;width:min(820px,100%);padding:14px}
  #onb .dtile{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;position:relative;display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px 8px 10px;border-radius:20px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:inherit;font:500 13px Figtree,system-ui;cursor:pointer;transition:all .35s cubic-bezier(.16,1,.3,1)}
  #onb .dtile:hover{transform:translateY(-3px);background:rgba(255,255,255,.08)}
  #onb .dtile .app-tile{width:46px;height:46px;border-radius:14px;margin:0;border:0;transition:transform .4s cubic-bezier(.34,1.56,.64,1),filter .4s,opacity .4s;opacity:.7;filter:grayscale(.6)}
  #onb .dtile[aria-pressed=true]{border-color:rgba(140,242,198,.6);background:rgba(140,242,198,.1);box-shadow:0 0 34px rgba(140,242,198,.2)}
  #onb .dtile[aria-pressed=true] .app-tile{opacity:1;filter:none;transform:scale(1.08)}
  #onb .dtile .lock{position:absolute;top:8px;right:8px;width:18px;height:18px;border-radius:50%;background:#8cf2c6;color:#07120d;display:grid;place-items:center;transform:scale(0);transition:transform .4s cubic-bezier(.34,1.56,.64,1)}
  #onb .dtile[aria-pressed=true] .lock{transform:scale(1)}#onb .dtile .lock svg{width:11px;height:11px}
  #onb .chips{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:20px}
  #onb .chip2{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#dbe7f5;border-radius:999px;padding:9px 16px;font:500 14px Figtree,system-ui;cursor:pointer;transition:all .25s}#onb .chip2:hover{background:rgba(255,255,255,.14)}#onb .chip2[aria-pressed=true]{background:#8cf2c6;color:#07120d;border-color:transparent}
  #onb .addrow{display:flex;gap:8px;margin-top:14px;width:min(460px,100%)}
  #onb input[type=text]{flex:1;min-width:0;height:44px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.07);color:inherit;padding:0 18px;font:500 15px Figtree,system-ui;outline:none}#onb input[type=text]:focus{border-color:rgba(140,242,198,.6);box-shadow:0 0 0 3px rgba(140,242,198,.15)}
  #onb .count{margin-top:16px;font:500 14px Figtree,system-ui;color:#9fe9c9;min-height:20px}
  /* the dial */
  #onb .dialwrap{display:flex;gap:44px;align-items:center;justify-content:center;flex-wrap:wrap;margin-top:18px}
  #onb .dial{width:min(340px,42vh);aspect-ratio:1;touch-action:none;-webkit-user-select:none;user-select:none}
  #onb .dial svg{width:100%;height:100%;overflow:visible}
  #onb .dial .track{stroke:rgba(255,255,255,.1);fill:none;stroke-width:26;stroke-linecap:butt}
  #onb .dial .arc{stroke:url(#dg);fill:none;stroke-width:26;stroke-linecap:round;filter:drop-shadow(0 0 14px rgba(140,242,198,.55))}
  #onb .dial .tick{stroke:rgba(255,255,255,.28);stroke-width:1.4}
  #onb .dial text{fill:#9fb0c8;font:500 12px Figtree,system-ui;text-anchor:middle}
  #onb .dial .knob{cursor:grab;filter:drop-shadow(0 4px 10px rgba(0,0,0,.5))}#onb .dial .knob:active{cursor:grabbing}
  #onb .dialside{display:flex;flex-direction:column;gap:16px;align-items:flex-start;text-align:left;max-width:430px}
  #onb .qtext{font:300 24px/1.3 Outfit,Figtree,system-ui}#onb .qtext b{font-weight:500;color:#8cf2c6}
  #onb .days{display:flex;gap:6px}#onb .days button{width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#cfe0f2;font:500 13px Figtree,system-ui;cursor:pointer;transition:all .25s}#onb .days button[aria-pressed=true]{background:#8cf2c6;color:#07120d;border-color:transparent}
  /* the four doors of strictness */
  #onb .levels{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;width:min(900px,100%);margin-top:24px}
  #onb .lvl{position:relative;padding:20px 14px 18px;border-radius:24px;border:1px solid rgba(255,255,255,.12);background:rgba(8,13,22,.55);backdrop-filter:blur(14px);color:inherit;text-align:center;cursor:pointer;transition:all .4s cubic-bezier(.16,1,.3,1);display:flex;flex-direction:column;align-items:center;gap:10px;font:inherit}
  #onb .lvl:hover:not(:disabled){transform:translateY(-5px)}#onb .lvl[aria-pressed=true]{border-color:rgba(140,242,198,.7);background:rgba(140,242,198,.1);box-shadow:0 0 44px rgba(140,242,198,.18)}#onb .lvl:disabled{opacity:.45;cursor:default}
  #onb .lvl{text-transform:none;letter-spacing:normal}#onb .lvl b{font:500 17px Figtree,system-ui}#onb .lvl span.d{font-size:13px;line-height:1.4;color:#a9b9cc}
  #onb .lvl .tagc{position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:#8cf2c6;color:#07120d;border-radius:999px;font:600 11px Figtree,system-ui;padding:3px 10px;letter-spacing:.3px;white-space:nowrap}
  #onb .door3d{width:64px;height:84px;perspective:300px;position:relative}
  #onb .door3d .frame{position:absolute;inset:0;border:3px solid #6f7d8f;border-bottom:0;border-radius:6px 6px 0 0;background:radial-gradient(80% 70% at 50% 60%,rgba(140,242,198,.35),rgba(10,20,30,.9))}
  #onb .door3d .leaf{position:absolute;inset:3px 3px 0 3px;border-radius:4px 4px 0 0;background:linear-gradient(90deg,#5f6e5a,#7d8b72);transform-origin:left center;transition:transform .8s cubic-bezier(.16,1,.3,1);box-shadow:inset 0 0 0 2px rgba(0,0,0,.18)}
  #onb .door3d .leaf::after{content:'';position:absolute;right:7px;top:46%;width:6px;height:6px;border-radius:50%;background:#d9c58a}
  #onb .door3d .pad{position:absolute;left:50%;top:34%;width:16px;height:14px;margin-left:-8px;border-radius:3px;background:#ffd27a;opacity:0;transition:opacity .5s}
  #onb .door3d .pad::before{content:'';position:absolute;left:2px;top:-9px;width:8px;height:10px;border:2.5px solid #ffd27a;border-bottom:0;border-radius:6px 6px 0 0}
  #onb .lvl[data-l="0"] .leaf{transform:rotateY(-62deg)}#onb .lvl[data-l="1"] .leaf{transform:rotateY(-24deg)}#onb .lvl[data-l="2"] .leaf,#onb .lvl[data-l="3"] .leaf{transform:rotateY(0)}
  #onb .lvl[data-l="2"] .pad{opacity:1}#onb .lvl[data-l="3"] .frame{border-color:#9fdcff;box-shadow:0 0 22px rgba(150,220,255,.5)}#onb .lvl[data-l="3"] .leaf{background:linear-gradient(90deg,#7fa6bf,#c9e6f5)}
  #onb .note{margin-top:18px;max-width:560px;font-size:14px;color:#ffd9a8;min-height:20px}
  /* connect */
  #onb .conn{width:min(560px,100%);margin-top:22px;padding:8px 22px;text-align:left}
  #onb .crow{display:flex;align-items:center;gap:14px;padding:16px 0;border-bottom:1px solid rgba(255,255,255,.08)}#onb .crow:last-of-type{border-bottom:0}
  #onb .crow .dot{width:12px;height:12px;border-radius:50%;background:#6c7d95;flex:none;transition:all .4s}#onb .crow.ok .dot{background:#8cf2c6;box-shadow:0 0 14px rgba(140,242,198,.8)}#onb .crow.no .dot{background:#ffb86b}
  #onb .crow b{font:500 16px Figtree,system-ui;flex:1}#onb .crow em{font-style:normal;color:#9fb0c8;font-size:14px}
  /* why + seal */
  #onb .whybox{width:min(560px,100%);margin-top:22px}
  #onb .whybox input{width:100%;height:56px;font-size:18px;text-align:center}
  #onb .sealbtn{position:relative;width:132px;height:132px;border-radius:50%;margin:18px auto 0;border:1px solid rgba(255,255,255,.2);background:rgba(8,13,22,.55);backdrop-filter:blur(14px);color:#eaf2ff;cursor:pointer;display:grid;place-items:center;touch-action:none;transition:transform .3s cubic-bezier(.16,1,.3,1),box-shadow .5s}
  #onb .sealbtn:hover{transform:scale(1.04)}#onb .sealbtn svg.r{position:absolute;inset:-10px;width:calc(100% + 20px);height:calc(100% + 20px);transform:rotate(-90deg)}
  #onb .sealbtn .ico{width:44px;height:44px;color:#8cf2c6}
  #onb .final h2{font-size:clamp(34px,5vw,56px)}
  #onb .flash{position:absolute;inset:0;background:radial-gradient(circle at 50% 38%,rgba(255,255,255,.9),rgba(140,242,198,.35) 40%,transparent 70%);opacity:0;pointer-events:none}#onb .flash.go{animation:onbflash 1.6s ease-out}
  @keyframes onbflash{0%{opacity:0}12%{opacity:1}100%{opacity:0}}
  #onb canvas.sp{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
  #onb video.bgv{position:absolute;inset:-3%;width:106%;height:106%;object-fit:cover;opacity:0;transition:opacity 1.2s;pointer-events:none}#onb video.bgv.on{opacity:1}
  @media (max-width:760px){#onb .levels{grid-template-columns:repeat(2,1fr)}#onb .dialwrap{gap:20px}}
  @media (prefers-reduced-motion:reduce){#onb *{animation:none!important;transition-duration:.01s!important}}
  `;
  document.head.append(css);

  /* ---------------------------------------------------------------- the choices */
  const choice = { doors: new Set(), custom: [], from: 540, to: 1020, days: [0, 1, 2, 3, 4], level: 1, why: '' };
  const hm = (m) => { m = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  const span = () => ((choice.to - choice.from) % 1440 + 1440) % 1440 || 1440;
  const fmtSpan = (m) => { const h = Math.floor(m / 60), r = m % 60; const ru = ET.lang() === 'ru'; return `${h ? h + (ru ? ' ч' : ' h') : ''}${h && r ? ' ' : ''}${r ? r + (ru ? ' мин' : ' min') : ''}`; };

  /* what a name is: a site or an app, and its colour */
  const KNOWN = { Instagram: ['site', '#e1306c'], YouTube: ['site', '#ff3b30'], X: ['site', '#111111'], TikTok: ['site', '#16d6c8'], Facebook: ['site', '#1877f2'], Snapchat: ['site', '#fffc00'], Reddit: ['site', '#ff5700'], Netflix: ['site', '#d81f26'], Twitch: ['site', '#9146ff'], Telegram: ['app', '#2aa3e4'], WhatsApp: ['app', '#25d366'], Discord: ['app', '#5865f2'], Steam: ['app', '#2b4f7d'], Roblox: ['app', '#e2231a'] };
  const kindOf = (n) => (KNOWN[n] ? KNOWN[n][0] : /\./.test(n) ? 'site' : 'app');
  const colorOf = (n) => (KNOWN[n] ? KNOWN[n][1] : `hsl(${[...n].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)} 60% 46%)`);
  const TILES = Object.keys(KNOWN);

  /* ---------------------------------------------------------------- the shell */
  let root, acts = [], order = [], cur = -1, bgs = {}, sparkRaf = 0, sparks = [];
  function build() {
    if (root) return;
    root = document.createElement('div'); root.id = 'onb'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'EyeTime');
    root.innerHTML = `<svg width="0" height="0" style="position:absolute"><defs><linearGradient id="onbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8cf2c6"/><stop offset="1" stop-color="#d4f77c"/></linearGradient><linearGradient id="dg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8cf2c6"/><stop offset="1" stop-color="#86d7ff"/></linearGradient></defs></svg>
      ${[...new Set(Object.values(IMG))].map((u) => `<div class="bg" data-u="${u}" style="background-image:url(${u})"></div>`).join('')}
      <video class="bgv" id="onbVid" muted playsinline preload="auto"></video>
      <div class="fog"></div><div class="fog b"></div><div class="vig"></div><canvas class="sp" id="onbSp"></canvas>
      <div class="top"><div class="pips" id="onbPips"></div><button class="skip" id="onbSkip" type="button"></button></div>
      <div class="stage" id="onbStage"></div><div class="flash" id="onbFlash"></div>`;
    document.body.append(root);
    $$('.bg', root).forEach((b) => (bgs[b.dataset.u] = b));
  }
  const setBg = (u, dim) => { Object.entries(bgs).forEach(([k, b]) => { b.classList.toggle('on', k === u); b.classList.toggle('dim', !!dim && k === u); }); };

  /* ---------------------------------------------------------------- sparks (small light, for the big moments) */
  function burst(n, y = 0.4) {
    const cv = $('#onbSp'), r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); cv.width = r.width * d; cv.height = r.height * d;
    const cols = ['#d4f77c', '#8cf2c6', '#86d7ff', '#ffffff'];
    for (let i = 0; i < (reduced ? 0 : n); i++) { const a = Math.random() * 6.283, v = 120 + Math.random() * 540; sparks.push({ x: cv.width / 2, y: cv.height * y, vx: Math.cos(a) * v * d, vy: (Math.sin(a) * v - 180) * d, g: 470 * d, r: (1 + Math.random() * 2.6) * d, c: cols[(Math.random() * 4) | 0], l: 0, m: 1.3 + Math.random() * 1.2 }); }
    cancelAnimationFrame(sparkRaf);
    const x = cv.getContext('2d'); let last = performance.now();
    const step = (now) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; x.clearRect(0, 0, cv.width, cv.height); x.globalCompositeOperation = 'lighter'; sparks.forEach((p) => { p.l += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; x.globalAlpha = Math.max(0, 1 - p.l / p.m); x.fillStyle = p.c; x.shadowColor = p.c; x.shadowBlur = 12; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 6.283); x.fill(); }); sparks = sparks.filter((p) => p.l < p.m); if (sparks.length) sparkRaf = requestAnimationFrame(step); else x.clearRect(0, 0, cv.width, cv.height); };
    sparkRaf = requestAnimationFrame(step);
  }

  /* ---------------------------------------------------------------- hold (a ring that fills while pressed) */
  function holdable(el, ring, ms, onDone, onProgress) {
    let t0 = 0, raf = 0, done = false;
    const set = (p) => { if (ring) ring.style.strokeDashoffset = String(100 - p * 100); onProgress && onProgress(p); };
    const stop = () => { if (done) return; cancelAnimationFrame(raf); t0 = 0; if (ring) { ring.style.transition = 'stroke-dashoffset .5s'; } set(0); };
    const step = () => { if (!t0) return; const p = clamp((performance.now() - t0) / ms, 0, 1); if (ring) ring.style.transition = 'none'; set(p); if (p >= 1) { done = true; t0 = 0; onDone(); } else raf = requestAnimationFrame(step); };
    el.addEventListener('pointerdown', (e) => { if (done) return; try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ } t0 = performance.now(); step(); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => el.addEventListener(ev, stop));
    el.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !done) { e.preventDefault(); t0 = performance.now() - ms * 0.55; step(); setTimeout(() => { if (!done) stop(); }, 700); } });
    return { reset() { done = false; set(0); } };
  }

  /* ---------------------------------------------------------------- the acts */
  const stillSrc = () => { try { return ET.gemStill({ hue: 0, seed: 0, size: 600, rot: 0.9 }); } catch { return ''; } };
  let gemUrl = '';

  function actWake() {
    const a = document.createElement('section'); a.className = 'act'; a.dataset.id = 'wake';
    gemUrl = gemUrl || stillSrc();
    a.innerHTML = `<div class="stone holdzone" id="onbStone" tabindex="0" role="button" aria-label="${T().wakeH}"><img alt="" src="${gemUrl}"><svg class="ring" viewBox="0 0 100 100"><circle class="bgc" cx="50" cy="50" r="48.6" pathLength="100"/><circle class="fgc" id="onbWakeRing" cx="50" cy="50" r="48.6" pathLength="100"/></svg></div>
      <div class="hint" id="onbHint">${T().wakeH}</div>
      <div class="titleword" id="onbTitle" aria-hidden="true">${[...T().title].map((c, i) => `<span style="transition-delay:${i * 70}ms">${c}</span>`).join('')}</div>
      <p class="sub" id="onbTag" style="opacity:0;transition:opacity 1s .6s">${T().tag}</p>
      <div class="row" style="opacity:0;transition:opacity .8s 1.2s" id="onbBeginRow"><button class="cta" id="onbBegin" type="button">${T().begin}</button></div>`;
    return { el: a, enter() {
      const stone = $('#onbStone', a), ring = $('#onbWakeRing', a); let woke = false;
      holdable(stone, ring, 1500, () => {
        woke = true; stone.classList.add('lit'); stone.classList.remove('holdzone'); $('#onbHint', a).style.display = 'none'; $('#onbFlash').classList.add('go'); burst(120, 0.34); ET.gem && ET.gem() && ET.gem().pulse && ET.gem().pulse(1);
        $('#onbTitle', a).classList.add('on'); $('#onbTag', a).style.opacity = '1'; $('#onbBeginRow', a).style.opacity = '1'; setTimeout(() => $('#onbBegin', a).focus(), 1400);
      });
      $('#onbBegin', a).onclick = () => go(1);
    } };
  }

  function actDoors() {
    const a = document.createElement('section'); a.className = 'act'; a.dataset.id = 'doors';
    a.innerHTML = `<h2>${T().doorsT}</h2><p class="sub">${T().doorsS}</p>
      <div class="chips" id="onbPre">${T().presets.map(([n, names], i) => `<button class="chip2" type="button" data-i="${i}" aria-pressed="false">${n}</button>`).join('')}</div>
      <div class="doors glass" id="onbDoors">${TILES.map((n) => `<button class="dtile" type="button" data-n="${n}" aria-pressed="false"><span class="app-tile" data-n="${n}" style="background:${colorOf(n)}">${n.slice(0, 2)}</span>${n}<span class="lock">${ICO('lock')}</span></button>`).join('')}</div>
      <div class="addrow"><input type="text" id="onbAdd" placeholder="${T().doorsAdd}" spellcheck="false" autocomplete="off" aria-label="${T().doorsAdd}"><button class="chip2" id="onbAddB" type="button">${T().doorsAddB}</button></div>
      <div class="count" id="onbCount"></div>
      <div class="row"><button class="ghost" data-back type="button">${T().back}</button><button class="cta" data-next type="button" id="onbDoorsNext" disabled>${T().next}</button></div>`;
    const count = () => { const n = choice.doors.size; $('#onbCount', a).textContent = T().doorsN(n); $('#onbDoorsNext', a).disabled = n === 0; };
    const paint = () => $$('.dtile', a).forEach((b) => b.setAttribute('aria-pressed', String(choice.doors.has(b.dataset.n))));
    const addTile = (n) => { if ($(`.dtile[data-n="${CSS.escape(n)}"]`, a)) return; const b = document.createElement('button'); b.className = 'dtile'; b.type = 'button'; b.dataset.n = n; b.setAttribute('aria-pressed', 'true'); b.innerHTML = `<span class="app-tile" data-n="${String(n).replace(/"/g, '&quot;')}" style="background:${colorOf(n)}">${n.slice(0, 2)}</span>${n.replace(/</g, '&lt;')}<span class="lock">${ICO('lock')}</span>`; b.onclick = () => toggle(n); $('#onbDoors', a).append(b); };
    const toggle = (n) => { choice.doors.has(n) ? choice.doors.delete(n) : choice.doors.add(n); paint(); count(); };
    $$('.dtile', a).forEach((b) => (b.onclick = () => toggle(b.dataset.n)));
    $$('#onbPre .chip2', a).forEach((b) => (b.onclick = () => { const names = T().presets[+b.dataset.i][1]; const all = names.every((n) => choice.doors.has(n)); names.forEach((n) => (all ? choice.doors.delete(n) : choice.doors.add(n))); b.setAttribute('aria-pressed', String(!all)); paint(); count(); }));
    const add = () => { const inp = $('#onbAdd', a), v = inp.value.trim().replace(/^https?:\/\//, '').replace(/^www\./, '').slice(0, 40); if (!v) return; if (!KNOWN[v]) { choice.custom.push(v); addTile(v); } choice.doors.add(v); inp.value = ''; paint(); count(); };
    $('#onbAddB', a).onclick = add; $('#onbAdd', a).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.stopPropagation(); add(); } });
    return { el: a, enter() { count(); } };
  }

  function actHours() {
    const a = document.createElement('section'); a.className = 'act'; a.dataset.id = 'hours';
    const C = 170, R = 128; // dial centre and radius in a 340 box
    const pt = (m, r = R) => { const f = ((m - 720) / 1440) * 2 * Math.PI; return [C + r * Math.sin(f), C - r * Math.cos(f)]; };
    a.innerHTML = `<h2>${T().hoursT}</h2><p class="sub">${T().hoursS}</p>
      <div class="dialwrap"><div class="dial glass" style="border-radius:50%;padding:6px"><svg viewBox="0 0 340 340" id="onbDial" role="group" aria-label="${T().hoursT}">
        <circle class="track" cx="${C}" cy="${C}" r="${R}"/><path class="arc" id="onbArc" d=""/>
        ${[0, 3, 6, 9, 12, 15, 18, 21].map((h) => { const [x1, y1] = pt(h * 60, R - 22), [x2, y2] = pt(h * 60, R + 22); return `<line class="tick" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" opacity="${h % 6 ? 0.4 : 1}"/>`; }).join('')}
        <text x="${C}" y="${C - R - 30}">12</text><text x="${C}" y="${C + R + 42}">00</text><text x="${C - R - 34}" y="${C + 4}">06</text><text x="${C + R + 34}" y="${C + 4}">18</text>
        <g id="onbSun" opacity=".9" transform="translate(${C - 12} ${C - 46})"><circle cx="12" cy="12" r="6" fill="#ffd27a"/><g stroke="#ffd27a" stroke-width="1.6" stroke-linecap="round"><path d="M12 1v3M12 20v3M1 12h3M20 12h3M4.2 4.2l2 2M17.8 17.8l2 2M4.2 19.8l2-2M17.8 6.2l2-2"/></g></g>
        <g transform="translate(${C - 10} ${C + 22})"><path d="M18 14.5A8 8 0 1 1 9.5 3a6.5 6.5 0 0 0 8.5 11.5z" fill="#bcd0ff"/></g>
        <g class="knob" id="onbK1" tabindex="0" role="slider" aria-label="from"><circle r="17" fill="#8cf2c6"/><circle r="7" fill="#07120d" opacity=".25"/></g>
        <g class="knob" id="onbK2" tabindex="0" role="slider" aria-label="to"><circle r="17" fill="#86d7ff"/><circle r="7" fill="#07120d" opacity=".25"/></g></svg></div>
        <div class="dialside"><div class="qtext" id="onbQ"></div><div class="days" id="onbDays">${T().days.map((d, i) => `<button type="button" data-d="${i}" aria-pressed="${choice.days.includes(i)}">${d}</button>`).join('')}</div>
        <div class="chips" style="justify-content:flex-start;margin:0"><button class="chip2" data-p="540,1020" type="button">${T().pw}</button><button class="chip2" data-p="1200,1380" type="button">${T().pe}</button><button class="chip2" data-p="1380,360" type="button">${T().pn}</button></div></div></div>
      <div class="row"><button class="ghost" data-back type="button">${T().back}</button><button class="cta" data-next type="button">${T().next}</button></div>`;
    const arc = $('#onbArc', a), k1 = $('#onbK1', a), k2 = $('#onbK2', a), svg = $('#onbDial', a);
    const draw = () => {
      const [x1, y1] = pt(choice.from), [x2, y2] = pt(choice.to), s = span();
      arc.setAttribute('d', s >= 1440 ? `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - 0.01} ${C - R}` : `M ${x1} ${y1} A ${R} ${R} 0 ${s > 720 ? 1 : 0} 1 ${x2} ${y2}`);
      k1.setAttribute('transform', `translate(${x1} ${y1})`); k2.setAttribute('transform', `translate(${x2} ${y2})`);
      k1.setAttribute('aria-valuetext', hm(choice.from)); k2.setAttribute('aria-valuetext', hm(choice.to));
      $('#onbQ', a).innerHTML = s >= 1440 ? `<b>${T().allDay}</b>` : T().quiet(`<b>${hm(choice.from)}</b>`, `<b>${hm(choice.to)}</b>`, fmtSpan(s));
    };
    const minOf = (e) => { const r = svg.getBoundingClientRect(), x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2); const f = Math.atan2(x, -y); return Math.round(((((f / (2 * Math.PI)) * 1440 + 720) % 1440) + 1440) % 1440 / 15) * 15 % 1440; };
    const drag = (k, key) => { let on = false; k.addEventListener('pointerdown', (e) => { on = true; try { k.setPointerCapture(e.pointerId); } catch { /* ignore */ } e.preventDefault(); }); k.addEventListener('pointermove', (e) => { if (!on) return; choice[key] = minOf(e); if (choice.from === choice.to) choice[key] = (choice[key] + 15) % 1440; draw(); }); ['pointerup', 'pointercancel'].forEach((ev) => k.addEventListener(ev, () => (on = false)));
      k.addEventListener('keydown', (e) => { const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 15 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -15 : 0; if (d) { e.preventDefault(); e.stopPropagation(); choice[key] = (choice[key] + d + 1440) % 1440; draw(); } }); };
    drag(k1, 'from'); drag(k2, 'to');
    $$('#onbDays button', a).forEach((b) => (b.onclick = () => { const d = +b.dataset.d; choice.days = choice.days.includes(d) ? choice.days.filter((x) => x !== d) : [...choice.days, d].sort(); if (!choice.days.length) choice.days = [d]; $$('#onbDays button', a).forEach((x) => x.setAttribute('aria-pressed', String(choice.days.includes(+x.dataset.d)))); }));
    $$('.chip2[data-p]', a).forEach((b) => (b.onclick = () => { const [f, t] = b.dataset.p.split(',').map(Number); choice.from = f; choice.to = t; draw(); }));
    return { el: a, enter() { draw(); } };
  }

  function actHard() {
    const a = document.createElement('section'); a.className = 'act'; a.dataset.id = 'hard';
    a.innerHTML = `<h2>${T().hardT}</h2><p class="sub">${T().hardS}</p>
      <div class="levels" id="onbLv">${T().lv.map(([n, d], i) => `<button class="lvl" type="button" data-l="${i}" aria-pressed="${i === choice.level}" ${i === 3 ? 'disabled' : ''}>${i === 1 ? `<span class="tagc">${T().rec}</span>` : i === 3 ? `<span class="tagc" style="background:#9fdcff">${T().later}</span>` : ''}<div class="door3d"><div class="frame"></div><div class="leaf"></div><div class="pad"></div></div><b>${n}</b><span class="d">${d}</span></button>`).join('')}</div>
      <div class="note" id="onbNote"></div>
      <div class="row"><button class="ghost" data-back type="button">${T().back}</button><button class="cta" data-next type="button">${T().next}</button></div>`;
    const note = () => ($('#onbNote', a).textContent = choice.level === 2 ? T().lockedNote : '');
    $$('.lvl', a).forEach((b) => (b.onclick = () => { if (b.disabled) return; choice.level = +b.dataset.l; $$('.lvl', a).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); note(); }));
    return { el: a, enter: note };
  }

  function actLink() {
    const a = document.createElement('section'); a.className = 'act'; a.dataset.id = 'link';
    a.innerHTML = `<h2>${T().linkT}</h2><p class="sub">${T().linkS}</p>
      <div class="conn glass"><div class="crow" id="onbEng"><span class="dot"></span><b>${T().eng}</b><em>${T().wait}</em></div><div class="crow" id="onbExt"><span class="dot"></span><b>${T().ext}</b><em>${T().wait}</em></div></div>
      <div class="chips"><button class="chip2" data-k="extension_folder" type="button">${T().openF}</button><button class="chip2" data-k="chrome_extensions" type="button">${T().openC}</button><button class="chip2" data-k="edge_extensions" type="button">${T().openE}</button></div>
      <p class="sub" style="font-size:14px">${T().linkH}</p>
      <div class="row"><button class="ghost" data-back type="button">${T().back}</button><button class="cta" data-next type="button">${T().next}</button></div>`;
    let iv = 0;
    const row = (id, ok) => { const r = $(id, a); r.className = 'crow ' + (ok ? 'ok' : 'no'); $('em', r).textContent = ok ? T().on : T().off; };
    $$('.chip2[data-k]', a).forEach((b) => (b.onclick = () => window.__TAURI__.core.invoke('open_target', { kind: b.dataset.k }).catch(() => {})));
    return { el: a, enter() { const poll = () => { const s = window.ETB && window.ETB.getStatus && window.ETB.getStatus(); row('#onbEng', !!(s && s.hostsOk !== false)); row('#onbExt', !!(s && s.extConnected)); }; poll(); iv = setInterval(poll, 1500); }, leave() { clearInterval(iv); } };
  }

  function actWhy() {
    const a = document.createElement('section'); a.className = 'act'; a.dataset.id = 'why';
    a.innerHTML = `<h2>${T().whyT}</h2><p class="sub">${T().whyS}</p>
      <div class="whybox"><input type="text" id="onbWhy" maxlength="90" placeholder="${T().whyPh}" autocomplete="off" aria-label="${T().whyT}"></div>
      <div class="chips">${T().whys.map((w) => `<button class="chip2" type="button">${w}</button>`).join('')}</div>
      <div class="row"><button class="ghost" data-back type="button">${T().back}</button><button class="cta" data-next type="button">${T().next}</button></div>`;
    const inp = $('#onbWhy', a); inp.value = choice.why; inp.addEventListener('input', () => (choice.why = inp.value.trim()));
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.stopPropagation(); go(cur + 1); } });
    $$('.chip2', a).forEach((b) => (b.onclick = () => { const base = ET.lang() === 'ru' ? 'Я делаю это, чтобы ' : 'I am doing this to '; inp.value = base + b.textContent; choice.why = inp.value; inp.focus(); }));
    return { el: a, enter() { setTimeout(() => inp.focus(), 500); } };
  }

  function actSeal() {
    const a = document.createElement('section'); a.className = 'act'; a.dataset.id = 'seal';
    a.innerHTML = `<h2>${T().sealH}</h2><p class="sub" id="onbSealS">${choice.why ? '“' + choice.why.replace(/</g, '&lt;') + '”' : T().sealS}</p>
      <button class="sealbtn" id="onbSeal" type="button" aria-label="${T().sealH}"><svg class="r" viewBox="0 0 100 100"><circle class="bgc" cx="50" cy="50" r="48.6" pathLength="100" style="fill:none;stroke:rgba(255,255,255,.14);stroke-width:2"/><circle id="onbSealRing" cx="50" cy="50" r="48.6" pathLength="100" style="fill:none;stroke:url(#onbg);stroke-width:2.4;stroke-linecap:round;stroke-dasharray:100;stroke-dashoffset:100;filter:drop-shadow(0 0 6px rgba(140,242,198,.8))"/></svg>${ICO('lock')}</button>
      <div class="row" style="margin-top:20px"><button class="ghost" data-back type="button">${T().back}</button></div>`;
    return { el: a, enter() {
      const why = choice.why; $('#onbSealS', a).textContent = why ? '“' + why + '”' : T().sealS;
      const vid = $('#onbVid'), haveVid = vid && vid.dataset.ok === '1';
      holdable($('#onbSeal', a), $('#onbSealRing', a), 2400, finish, (p) => {
        // the door closes as you hold: with a video, its frames follow your hand; without, the picture dims and the fog thickens
        if (haveVid && vid.duration) vid.currentTime = p * (vid.duration - 0.05);
        else { const b = bgs[IMG.seal]; if (b) b.style.filter = `brightness(${1 - p * 0.55}) saturate(${1 - p * 0.3})`; }
        root.style.setProperty('--hold', p);
      });
    } };
  }

  function actDone() {
    const a = document.createElement('section'); a.className = 'act final'; a.dataset.id = 'done';
    gemUrl = gemUrl || stillSrc();
    a.innerHTML = `<div class="stone lit" style="width:min(220px,28vh)"><img alt="" src="${gemUrl}"></div><h2 style="margin-top:24px">${T().done}</h2><p class="sub">${T().doneS}</p>
      <div class="row"><button class="cta" id="onbGo" type="button">${T().go25}</button><button class="ghost" id="onbLook" type="button">${T().look}</button></div>`;
    return { el: a, enter() { $('#onbFlash').classList.add('go'); burst(160, 0.3); setTimeout(() => $('#onbGo', a).focus(), 600); $('#onbGo', a).onclick = () => { close(); ET.S.diff = Math.min(choice.level, 2); ET.S.min = 25; ET.S.name = ET.lang() === 'ru' ? 'Фокус' : 'Focus'; ET.go('home').then(() => setTimeout(() => ET.startSession(), 400)); }; $('#onbLook', a).onclick = () => { close(); ET.go('rules'); }; } };
  }

  /* ---------------------------------------------------------------- flow */
  function plan() {
    const real = !!(window.__TAURI__ && window.ETB);
    order = [['wake', actWake], ['doors', actDoors], ['hours', actHours], ['hard', actHard]];
    if (real) order.push(['link', actLink]);
    order.push(['why', actWhy], ['seal', actSeal], ['done', actDone]);
  }
  function renderPips() { const p = $('#onbPips'); p.innerHTML = order.slice(0, -1).map((_, i) => `<i class="${i === cur ? 'on' : i < cur ? 'past' : ''}"></i>`).join(''); p.style.visibility = cur === 0 || cur === order.length - 1 ? 'hidden' : 'visible'; }
  function go(i) {
    i = clamp(i, 0, order.length - 1); if (i === cur) return;
    const prev = acts[cur]; if (prev) { prev.el.classList.remove('on'); prev.leave && prev.leave(); }
    cur = i; const act = acts[cur]; const id = order[cur][0];
    setBg(IMG[id], id === 'doors' || id === 'seal' ? false : false);
    // a closing door at the end needs the door picture back at full brightness
    if (id === 'seal') { const b = bgs[IMG.seal]; if (b) b.style.filter = ''; }
    renderPips(); setTimeout(() => { act.el.classList.add('on'); act.enter && act.enter(); }, prev ? 260 : 80);
    $$('[data-next]', act.el).forEach((b) => (b.onclick = () => go(cur + 1))); $$('[data-back]', act.el).forEach((b) => (b.onclick = () => go(cur - 1)));
  }

  /* ---------------------------------------------------------------- what it writes */
  function apply() {
    const rd = (k, d) => { try { return JSON.parse(ET.store.get(k)) || d; } catch { return d; } };
    const items = rd('et-items', []).filter((i) => !choice.doors.has(i.name));
    const chosen = [...choice.doors].map((n) => ({ name: n, type: kindOf(n), color: colorOf(n), g: 'dis', domain: kindOf(n) === 'site' && /\./.test(n) ? n.toLowerCase() : '', exe: '' }));
    // an item already on the lists is moved, not doubled
    const merged = [...chosen, ...items.map((i) => (choice.doors.has(i.name) ? { ...i, g: 'dis' } : i))];
    ET.store.set('et-items', JSON.stringify(merged));
    const rules = rd('et-rules', []).filter((r) => r.id !== 'onb-quiet');
    const overnight = choice.to <= choice.from && span() < 1440;
    rules.unshift({ id: 'onb-quiet', name: ET.lang() === 'ru' ? 'Тихие часы' : 'Quiet hours', kind: 'schedule', from: hm(choice.from), to: hm(span() >= 1440 ? choice.from : choice.to), days: choice.days, block: 'dis', breaks: choice.level < 2, on: true, glyph: overnight ? 'moon' : 'cal', level: Math.min(choice.level, 2), dur: 25 });
    ET.store.set('et-rules', JSON.stringify(rules));
    const prot = rd('et-protect', {}); prot.level = Math.min(choice.level, 2); prot.friction = prot.friction || 'hold'; prot.emerg = prot.emerg || 3; prot.emergWeek = prot.emergWeek || 1;
    ET.store.set('et-protect', JSON.stringify(prot));
    try { localStorage.setItem('et-s-why', JSON.stringify(choice.why)); } catch { /* ignore */ }
    ET.S.diff = Math.min(choice.level, 2);
    ET.S.blocks = new Set(choice.doors.size ? [...choice.doors] : ET.S.blocks);
  }
  function finish() { apply(); try { localStorage.setItem('et-onboarded', '1'); } catch { /* ignore */ } go(order.length - 1); }

  /* ---------------------------------------------------------------- open / close */
  const onKey = (e) => { if (!root || !root.classList.contains('on')) return; if (e.key === 'Escape') { e.stopPropagation(); skip(); } };
  function skip() { try { localStorage.setItem('et-onboarded', '1'); } catch { /* ignore */ } close(); }
  function close() { if (!root) return; root.classList.remove('on'); acts[cur] && acts[cur].leave && acts[cur].leave(); document.removeEventListener('keydown', onKey, true); setTimeout(() => { root.remove(); root = null; acts = []; bgs = {}; cur = -1; }, 950); ET.gem && ET.gem() && ET.gem().glow && ET.gem().glow(0); }
  async function open() {
    if (root) return;
    Object.assign(choice, { doors: new Set(), custom: [], from: 540, to: 1020, days: [0, 1, 2, 3, 4], level: 1, why: '' });
    plan(); build(); gemUrl = '';
    $('#onbSkip').textContent = T().skip; $('#onbSkip').onclick = skip;
    const stage = $('#onbStage'); acts = order.map(([, f]) => f()); acts.forEach((a) => stage.append(a.el));
    document.addEventListener('keydown', onKey, true);
    // a door that closes as you hold: used when the video is there (assets/door-close.mp4), otherwise a picture that dims
    const v = $('#onbVid'); v.addEventListener('loadeddata', () => (v.dataset.ok = '1'), { once: true }); v.src = 'assets/door-close.mp4'; v.load();
    requestAnimationFrame(() => root.classList.add('on')); cur = -1; setTimeout(() => go(0), 350);
    ET.gem && ET.gem() && ET.gem().glow && ET.gem().glow(0.15);
  }
  ET.onboarding = { open, shouldRun: () => { try { return !localStorage.getItem('et-onboarded'); } catch { return false; } } };
  ET.tour = open;
  if (/[#&?]onboarding\b/.test(location.hash + location.search)) setTimeout(open, 2200);
})();
