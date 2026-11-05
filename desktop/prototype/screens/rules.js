/* Rules: what is blocked, when, and the three lists every app and site lives in (distracting, neutral, always allowed).
   Cards for the rules, an editor sheet (schedule or timer, days, time wheels, breaks), drag and drop between the lists. */
(() => {
  const ET = window.ET, { $, $$, clamp, wait, reduced, store, wheel, toast, openScrim, closeScrim } = ET;
  const D = {
    en: { title: 'Rules', tabs: ['Rules', 'Limits', 'Lists', 'Protection', 'Automation'], strictL: 'Strictness', levels: ['Normal', 'Timeout', 'Locked', 'Frozen'], levelD: ['You can pause or end it any time.', 'Leaving needs a wait that grows every time.', 'No pause, no edit and no way out until it ends.', 'Locked, and only allowed apps can run.'], h1: 'Rules', lead: 'Decide what stays closed and when. Rules run on their own, even when EyeTime is in the tray.', nowTitle: (n) => `${n} is on`, nowSub: (t) => `Everything on its list stays closed until ${t}.`, nowNone: 'Nothing is blocked right now', nowNoneSub: 'The next rule starts soon. You can also start a focus session.', takeBreak: 'Take a break', startFocus: 'Start focus',
      rules: 'Rules', rulesSub: 'Tap a rule to change it. Switch it off to pause it.', newRule: 'New rule', active: (t) => `Active until ${t}`, startsIn: (t) => `Starts in ${t}`, off: 'Off', paused: 'Paused', blocks: 'Blocks', everyDay: 'Every day', weekdays: 'Weekdays', weekends: 'Weekends', days: ['M', 'T', 'W', 'T', 'F', 'S', 'S'], dayNames: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      lists: 'Apps and sites', listsSub: 'Drag between the lists, or tap the dot to move. Changes apply to every rule that uses the list.', gDis: 'Distracting', gDisD: 'Closed during rules and focus', gNeu: 'Neutral', gNeuD: 'Open, counted but not judged', gAllow: 'Always allowed', gAllowD: 'Never blocked', add: 'Add an app or a site', addPh: 'instagram.com or Slack', app: 'App', site: 'Site', empty: 'Drop something here',
      edit: 'Edit rule', create: 'New rule', name: 'Name', schedule: 'Schedule', timer: 'Timer', from: 'From', to: 'To', onDays: 'On these days', blocked: 'Blocked', breaks: 'Breaks allowed', yes: 'Yes', no: 'No', save: 'Save', delete: 'Delete rule', overlap: 'This rule overlaps with another one. Both will apply.', hours: 'Hours', minutes: 'Minutes', saved: 'Rule saved', deleted: 'Rule deleted', ruleOn: 'Rule is on', ruleOff: 'Rule is off', moved: (n, g) => `${n} → ${g}`, added: (n) => `${n} added`, dup: 'Already in your lists', list: { dis: 'Distracting', neu: 'Neutral', allow: 'Always allowed' }, blockSet: { dis: 'Distracting list', all: 'Everything except allowed', pick: 'Chosen apps' }, durM: 'Duration', pickList: 'What to block', h: 'h', m: 'm' },
    ru: { title: 'Правила', tabs: ['Правила', 'Лимиты', 'Списки', 'Защита', 'Автоматизация'], strictL: 'Строгость', levels: ['Обычная', 'С паузой', 'Жёсткая', 'Заморозка'], levelD: ['Можно поставить на паузу или завершить в любой момент.', 'Чтобы выйти, нужно ждать, и ожидание растёт.', 'Без паузы, правок и выхода, пока не закончится.', 'Жёсткая, и работают только разрешённые приложения.'], h1: 'Правила', lead: 'Решите, что остаётся закрытым и когда. Правила работают сами, даже когда EyeTime свёрнут в трей.', nowTitle: (n) => `Работает «${n}»`, nowSub: (t) => `Всё из списка закрыто до ${t}.`, nowNone: 'Сейчас ничего не заблокировано', nowNoneSub: 'Скоро начнётся следующее правило. Можно и сразу запустить фокус.', takeBreak: 'Сделать перерыв', startFocus: 'Начать фокус',
      rules: 'Правила', rulesSub: 'Нажмите на правило, чтобы изменить. Выключите, чтобы поставить на паузу.', newRule: 'Новое правило', active: (t) => `Работает до ${t}`, startsIn: (t) => `Через ${t}`, off: 'Выключено', paused: 'На паузе', blocks: 'Закрывает', everyDay: 'Каждый день', weekdays: 'Будни', weekends: 'Выходные', days: ['П', 'В', 'С', 'Ч', 'П', 'С', 'В'], dayNames: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
      lists: 'Приложения и сайты', listsSub: 'Перетаскивайте между списками или нажмите на точку, чтобы переместить. Изменения действуют во всех правилах.', gDis: 'Отвлекают', gDisD: 'Закрыты во время правил и фокуса', gNeu: 'Нейтральные', gNeuD: 'Открыты, время считается без оценки', gAllow: 'Всегда разрешены', gAllowD: 'Никогда не блокируются', add: 'Добавить приложение или сайт', addPh: 'instagram.com или Slack', app: 'Приложение', site: 'Сайт', empty: 'Перетащите сюда',
      edit: 'Правило', create: 'Новое правило', name: 'Название', schedule: 'По расписанию', timer: 'Таймер', from: 'С', to: 'До', onDays: 'По дням', blocked: 'Блокировка', breaks: 'Перерывы разрешены', yes: 'Да', no: 'Нет', save: 'Сохранить', delete: 'Удалить правило', overlap: 'Это правило пересекается с другим. Будут действовать оба.', hours: 'Часы', minutes: 'Минуты', saved: 'Правило сохранено', deleted: 'Правило удалено', ruleOn: 'Правило включено', ruleOff: 'Правило выключено', moved: (n, g) => `${n} → ${g}`, added: (n) => `${n} добавлено`, dup: 'Уже есть в списках', list: { dis: 'Отвлекают', neu: 'Нейтральные', allow: 'Всегда разрешены' }, blockSet: { dis: 'Список отвлекающих', all: 'Всё, кроме разрешённого', pick: 'Выбранные' }, durM: 'Длительность', pickList: 'Что закрывать', h: 'ч', m: 'м' },
  };
  const L = () => D[ET.lang()] || D.en;

  /* ---------------- data ---------------- */
  const ITEMS = [['Instagram', 'site', '#e1306c', 'dis'], ['YouTube', 'site', '#ff3b30', 'dis'], ['X', 'site', '#16181c', 'dis'], ['TikTok', 'site', '#16d6c8', 'dis'], ['Reddit', 'site', '#ff5700', 'dis'], ['Netflix', 'site', '#d81f26', 'dis'], ['Telegram', 'app', '#2aa3e4', 'dis'], ['Steam', 'app', '#2b4f7d', 'dis'],
    ['Slack', 'app', '#7c3aed', 'neu'], ['Notion', 'app', '#3a3a3a', 'neu'], ['Chrome', 'app', '#4a8af4', 'neu'], ['Spotify', 'app', '#1db954', 'neu'],
    ['VS Code', 'app', '#2b7de9', 'allow'], ['Figma', 'app', '#a259ff', 'allow'], ['Terminal', 'app', '#222', 'allow'], ['Calendar', 'app', '#ef4444', 'allow']].map(([name, type, color, g]) => ({ name, type, color, g }));
  const DEFAULT_RULES = [
    { id: 'r1', name: 'Work Time', kind: 'schedule', from: '09:00', to: '17:00', days: [0, 1, 2, 3, 4], block: 'dis', breaks: true, on: true, glyph: 'cal' },
    { id: 'r2', name: 'Morning Reading', kind: 'schedule', from: '06:00', to: '07:00', days: [0, 1, 2, 3, 4, 5, 6], block: 'all', breaks: false, on: true, glyph: 'moon', level: 1 },
    { id: 'r3', name: 'Weekend Zen', kind: 'schedule', from: '09:00', to: '11:00', days: [5, 6], block: 'dis', breaks: true, on: true, glyph: 'sun' },
    { id: 'r4', name: 'Late Night', kind: 'schedule', from: '23:00', to: '06:00', days: [0, 1, 2, 3, 4, 5, 6], block: 'all', breaks: true, on: false, glyph: 'moon', level: 2 },
  ];
  const load = (k, d) => { try { const v = JSON.parse(store.get(k)); return v || d; } catch { return d; } };
  let rules = load('et-rules', DEFAULT_RULES), items = load('et-items', ITEMS);
  const save = () => { store.set('et-rules', JSON.stringify(rules)); store.set('et-items', JSON.stringify(items)); };
  const tm = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const fmt = (min) => { const m = ((min % 1440) + 1440) % 1440; return ET.lang() === 'ru' ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` : (() => { const h = Math.floor(m / 60); return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; })(); };
  const dur = (min) => { const h = Math.floor(min / 60), m = Math.round(min % 60); return h >= 48 ? `${Math.round(h / 24)} ${ET.lang() === 'ru' ? 'дн' : 'd'}` : h ? `${h}${L().h}${m ? ' ' + m + L().m : ''}` : `${m}${L().m}`; };
  /** is the rule running now, and when does it end / start next (minutes from now) */
  function status(r, now = new Date()) {
    if (r.kind === 'timer') return { s: 'timer' };
    if (!r.on) return { s: 'off' };
    const day = (now.getDay() + 6) % 7, cur = now.getHours() * 60 + now.getMinutes(), a = tm(r.from), b = tm(r.to), over = b <= a;
    const inside = (d, c) => (over ? (r.days.includes(d) && c >= a) || (r.days.includes((d + 6) % 7) && c < b) : r.days.includes(d) && c >= a && c < b);
    if (inside(day, cur)) return { s: 'active', end: b };
    for (let k = 0; k < 8; k++) { const d = (day + k) % 7; if (!r.days.includes(d)) continue; const start = k * 1440 + a; if (start > cur) return { s: 'next', in: start - cur }; }
    return { s: 'next', in: 7 * 1440 };
  }
  const dayLabel = (days) => (days.length === 7 ? L().everyDay : days.join() === '0,1,2,3,4' ? L().weekdays : days.join() === '5,6' ? L().weekends : days.map((d) => L().dayNames[d]).join(', '));

  /* ---------------- styles ---------------- */
  const css = document.createElement('style'); css.textContent = `
  .rl-now { display: flex; align-items: center; gap: 22px; padding: 24px 26px; flex-wrap: wrap; }
  .rl-now .shield-ico { width: 64px; height: 64px; border-radius: 22px; } .rl-now .shield-ico .ico { width: 30px; height: 30px; }
  .rl-now h3 { margin: 0; font: 500 22px/1.2 var(--font-display); } .rl-now p { margin: 5px 0 0; color: var(--text-2); font: 500 14px/1.45 var(--font-body); max-width: 46ch; }
  .rl-now .grow { flex: 1; min-width: 220px; } .rl-now .acts { display: flex; gap: 10px; flex-wrap: wrap; }
  .rl-now .stack { display: flex; margin-top: 12px; }
  .ghost-btn { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 20px; border-radius: 999px; background: rgba(255,255,255,.07); border: 1px solid var(--edge); font: 600 14px/1 var(--font-body); transition: transform .35s var(--spring), background .25s; } .ghost-btn:hover { background: rgba(255,255,255,.12); transform: translateY(-2px); } .ghost-btn:active { transform: scale(.95); }
  .rl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
  .rule { position: relative; min-height: 196px; padding: 18px; border-radius: 28px; text-align: left; display: flex; flex-direction: column; background: linear-gradient(158deg, rgba(40,58,52,.55), rgba(8,12,11,.66) 64%); border: 1px solid var(--edge); backdrop-filter: blur(22px); transition: transform .5s var(--spring), border-color .3s, background .4s, opacity .4s; cursor: pointer; overflow: hidden; }
  .rule::before { content: ""; position: absolute; inset: -40% -20% auto; height: 80%; background: radial-gradient(closest-side, rgba(140,242,198,.18), transparent); opacity: 0; transition: opacity .5s; pointer-events: none; }
  .rule[data-s="active"]::before { opacity: 1; } .rule[data-s="active"] { border-color: rgba(140,242,198,.4); }
  .rule[data-s="off"] { opacity: .55; } .rule:hover { transform: translateY(-5px); border-color: var(--edge-hi); } .rule:active { transform: scale(.97); }
  .rule .glyphs { display: flex; align-items: center; gap: 8px; color: var(--text-2); } .rule .glyphs .ico { width: 24px; height: 24px; } .rule .glyphs .arr { width: 16px; color: var(--text-3); } .rule .glyphs .sh { color: var(--text); }
  .rule .chipt { align-self: flex-start; margin: 16px 0 10px; padding: 5px 10px; border-radius: 99px; background: rgba(255,255,255,.08); font: 600 12px/1 var(--font-body); color: var(--text-2); }
  .rule[data-s="active"] .chipt { background: rgba(140,242,198,.14); color: var(--mint); }
  .rule b { font: 600 18px/1.2 var(--font-body); } .rule .sub { margin-top: 4px; color: var(--text-3); font: 500 13px/1.35 var(--font-body); }
  .rule .foot { margin-top: auto; padding-top: 14px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .rule .app-stack .app-tile { width: 24px; height: 24px; font-size: 9px; border-color: #0c1311; }
  .sw { position: relative; width: 46px; height: 28px; border-radius: 99px; background: rgba(255,255,255,.14); transition: background .35s; flex: none; cursor: pointer; border: 0; } .sw::after { content: ""; position: absolute; left: 3px; top: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.4); transition: transform .5s var(--spring); }
  .sw[aria-checked="true"] { background: linear-gradient(100deg, var(--lime), var(--mint)); } .sw[aria-checked="true"]::after { transform: translateX(18px); }
  .rule.new { align-items: center; justify-content: center; gap: 12px; border-style: dashed; color: var(--mint); font: 600 15px/1.2 var(--font-body); min-height: 196px; }
  .rule.new .plus { width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; background: linear-gradient(135deg, var(--lime), var(--mint)); color: #04100b; transition: transform .6s var(--spring); } .rule.new:hover .plus { transform: rotate(90deg) scale(1.1); }
  .lists { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; align-items: start; }
  .list-card { padding: 16px; border-radius: 28px; transition: box-shadow .3s, border-color .3s; } .list-card.over { box-shadow: 0 0 0 2px var(--mint), 0 0 40px rgba(140,242,198,.25); }
  .list-card h3 { margin: 0; display: flex; align-items: center; gap: 9px; font: 600 16px/1 var(--font-body); } .list-card h3 i { width: 10px; height: 10px; border-radius: 50%; } .list-card .d { margin: 6px 0 12px; color: var(--text-3); font: 500 12.5px/1.35 var(--font-body); }
  .li { display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 8px; border-radius: 16px; cursor: grab; transition: background .2s, transform .35s var(--spring), opacity .3s; animation: rise .7s var(--out-expo) backwards; animation-delay: calc(var(--i, 0) * 30ms); }
  .li:hover { background: rgba(255,255,255,.06); } .li.drag { opacity: .35; transform: scale(.96); } .li .app-tile { margin: 0; width: 32px; height: 32px; border-radius: 10px; font-size: 11px; border: 0; }
  .li .n { flex: 1; min-width: 0; } .li .n b { display: block; font: 600 14px/1.2 var(--font-body); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .li .n span { color: var(--text-3); font: 500 12px/1.2 var(--font-body); }
  .li .mv { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; flex: none; transition: transform .35s var(--spring), background .2s; } .li .mv:hover { background: rgba(255,255,255,.1); transform: scale(1.15); } .li .mv i { width: 10px; height: 10px; border-radius: 50%; }
  .li-empty { padding: 22px 8px; text-align: center; color: var(--text-3); font: 500 13px/1.3 var(--font-body); border: 1px dashed var(--edge); border-radius: 16px; }
  .add-row { display: flex; gap: 10px; margin-bottom: 14px; } .add-row input { flex: 1; min-width: 0; height: 46px; padding: 0 18px; border-radius: 999px; background: rgba(255,255,255,.06); border: 1px solid var(--edge); color: var(--text); font: 500 14px/1 var(--font-body); outline: 0; transition: border-color .25s, background .25s; user-select: text; } .add-row input:focus { border-color: rgba(140,242,198,.6); background: rgba(255,255,255,.09); } .add-row input::placeholder { color: var(--text-3); }
  /* editor */
  .sheet.editor { width: min(100%, 500px); padding: 0; max-height: calc(100% - 8px); overflow-y: auto; overflow-x: hidden; border-radius: 36px; } .editor .hero-img { position: relative; height: 188px; background: linear-gradient(180deg, #1c3a4a, #0a1a22); overflow: hidden; } .editor .hero-img canvas { position: absolute; inset: 0; width: 100%; height: 100%; } .editor .hero-img::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.15), rgba(9,13,12,.96)); }
  .editor .hero-img .round-btn { position: absolute; z-index: 2; left: 16px; top: 16px; background: rgba(0,0,0,.35); backdrop-filter: blur(12px); }
  .editor .body { padding: 0 22px 24px; margin-top: -46px; position: relative; z-index: 2; } .editor .opt { border-radius: 24px; margin-bottom: 10px; } .editor .opt > button { height: 60px; } .editor .opt .lb { font: 600 15px/1 var(--font-body); }
  .rl-tabs { position: relative; display: inline-grid; grid-auto-flow: column; grid-auto-columns: 1fr; padding: 4px; border-radius: 99px; background: rgba(255,255,255,.06); border: 1px solid var(--edge); backdrop-filter: blur(16px); margin: 4px 0 22px; max-width: 100%; overflow-x: auto; scrollbar-width: none; } .rl-tabs::-webkit-scrollbar { display: none; } .rl-tabs .hi { position: absolute; top: 4px; bottom: 4px; left: 0; border-radius: 99px; background: linear-gradient(160deg, rgba(255,255,255,.2), rgba(255,255,255,.08)); box-shadow: inset 0 1px 0 rgba(255,255,255,.2); transition: transform .6s var(--spring), width .6s var(--spring); } .rl-tabs button { position: relative; height: 40px; padding: 0 20px; white-space: nowrap; font: 600 14px/1 var(--font-body); color: var(--text-3); transition: color .25s; } .rl-tabs button:hover { color: var(--text-2); } .rl-tabs button[aria-selected="true"] { color: var(--text); }
  .pane.enter { animation: viewin .7s var(--out-expo) backwards; } .pane.leave { animation: viewout .2s ease-in forwards; } .pane[hidden] { display: none !important; }
  .lvl { display: inline-flex; align-items: center; gap: 5px; margin-left: 8px; padding: 3px 8px; border-radius: 99px; font: 700 10.5px/1 var(--font-body); letter-spacing: .06em; text-transform: uppercase; background: rgba(255,184,107,.14); color: var(--amber); } .lvl .ico { width: 11px; height: 11px; stroke-width: 2.2; }
  .e-seg { position: relative; display: grid; grid-template-columns: 1fr 1fr; padding: 4px; border-radius: 99px; background: rgba(0,0,0,.4); backdrop-filter: blur(12px); margin-bottom: 14px; } .e-seg .hi { position: absolute; top: 4px; bottom: 4px; left: 4px; width: calc(50% - 4px); border-radius: 99px; background: rgba(255,255,255,.16); transition: transform .5s var(--spring); } .e-seg button { position: relative; height: 38px; display: flex; align-items: center; justify-content: center; gap: 8px; font: 600 14px/1 var(--font-body); color: var(--text-3); } .e-seg button[aria-pressed="true"] { color: var(--text); } .e-seg .ico { width: 16px; height: 16px; }
  .e-name { width: 100%; height: 60px; padding: 0 18px; border-radius: 20px; background: rgba(255,255,255,.07); border: 1px solid var(--edge); color: var(--text); font: 500 22px/1 var(--font-display); outline: 0; margin-bottom: 8px; user-select: text; } .e-name:focus { border-color: rgba(140,242,198,.6); }
  .days { display: flex; justify-content: space-between; gap: 6px; padding: 4px 6px 14px; } .days button { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,.1); color: var(--text-2); font: 600 14px/1 var(--font-body); transition: transform .4s var(--spring), background .25s, color .25s; } .days button[aria-pressed="true"] { background: #f4faf7; color: #04100b; transform: scale(1.06); } .days button:active { transform: scale(.88); }
  .days-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 6px 0; } .days-row .dl { font: 600 15px/1 var(--font-body); } .days-row .dsum { color: var(--text-3); font: 500 13px/1 var(--font-body); }
  .tw { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; } .tw .wheel { height: 150px; } .tw .lab { text-align: center; color: var(--text-3); font: 600 11px/1 var(--font-body); letter-spacing: .1em; text-transform: uppercase; margin-bottom: 4px; }
  .warn { display: none; gap: 8px; align-items: center; margin: 10px 4px; color: var(--amber); font: 500 13px/1.35 var(--font-body); } .warn.on { display: flex; animation: rise .5s var(--out-expo); } .warn .ico { width: 16px; height: 16px; }
  .pill-white.wide { width: 100%; height: 56px; font-size: 16px; margin-top: 14px; } .del { display: block; margin: 14px auto 0; color: var(--rose); font: 600 15px/1 var(--font-body); padding: 8px 14px; border-radius: 99px; } .del:hover { background: rgba(255,107,125,.1); }
  @media (max-width: 900px) { .lists { grid-template-columns: 1fr; } }
  `; document.head.append(css);

  /* ---------------- the screen ---------------- */
  const ico = (n, c = '') => `<svg class="ico ${c}"><use href="#i-${n}"/></svg>`;
  const tile = (it, cls = '') => `<span class="app-tile ${cls}" data-n="${String(it.name).replace(/"/g, '&quot;')}" style="background:${it.color}">${it.name.slice(0, 2)}</span>`;
  const gcolor = { dis: 'var(--rose)', neu: 'var(--sky)', allow: 'var(--mint)' };
  let root, editing = null;

  function mount(el) {
    root = el; el.innerHTML = `<div class="vw"><h1></h1><p class="lead"></p><div class="rl-tabs" id="rlTabs" role="tablist"><i class="hi"></i>${[0, 1, 2, 3, 4].map((i) => `<button type="button" role="tab" data-t="${['rules', 'limits', 'lists', 'protect', 'triggers'][i]}"></button>`).join('')}</div>
      <div class="pane" id="rlP-rules"><div id="rlNow"></div><div class="sec-head"><div><h2 id="rlRulesT"></h2><p id="rlRulesS"></p></div></div><div class="rl-grid" id="rlGrid"></div></div>
      <div class="pane" id="rlP-limits" hidden></div>
      <div class="pane" id="rlP-lists" hidden><div class="sec-head" style="margin-top:4px"><div><h2 id="rlListsT"></h2><p id="rlListsS"></p></div></div><div class="add-row"><input id="rlAdd" type="text" spellcheck="false" autocomplete="off"><button class="pill-white" id="rlAddBtn" type="button"></button></div><div class="lists" id="rlLists"></div><div id="rlExtra"></div></div>
      <div class="pane" id="rlP-protect" hidden></div><div class="pane" id="rlP-triggers" hidden></div></div>`;
    $$('#rlTabs button', el).forEach((b) => b.addEventListener('click', () => showTab(b.dataset.t)));
    if (ET.listsExtra) ET.listsExtra($('#rlExtra', el));
    buildEditor(); render(); ET.langHooks.push(() => { render(); $('#tbTitle').textContent = L().title; renderEditor(); });
    $('#rlAddBtn', el).addEventListener('click', addItem); $('#rlAdd', el).addEventListener('keydown', (e) => { if (e.key === 'Enter') addItem(); });
    setInterval(() => { if (ET.view === 'rules') renderNow(); }, 30000);
  }
  function render() {
    const l = L(); $('h1', root).textContent = l.h1; $('.lead', root).textContent = l.lead; $('#rlRulesT').textContent = l.rules; $('#rlRulesS').textContent = l.rulesSub; $('#rlListsT').textContent = l.lists; $('#rlListsS').textContent = l.listsSub; $('#rlAdd').placeholder = l.addPh; $('#rlAdd').setAttribute('aria-label', l.add); $('#rlAddBtn').textContent = l.add;
    $$('#rlTabs button', root).forEach((b, i) => { b.textContent = l.tabs[i]; b.setAttribute('aria-selected', String(b.dataset.t === tab)); }); placeTabHi(false);
    renderNow(); renderRules(); renderLists(); Object.values(ET.rulePanes || {}).forEach((pn) => pn.render && pn.render());
  }
  let tab = 'rules';
  function placeTabHi(anim = true) { const b = $(`#rlTabs button[data-t=${tab}]`, root), hi = $('#rlTabs .hi', root); if (!b) return; hi.style.transition = anim ? '' : 'none'; hi.style.width = b.offsetWidth + 'px'; hi.style.transform = `translateX(${b.offsetLeft}px)`; if (!anim) { hi.offsetWidth; hi.style.transition = ''; } }
  async function showTab(name) {
    if (name === tab) return; const from = $('#rlP-' + tab, root), to = $('#rlP-' + name, root); tab = name; $$('#rlTabs button', root).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.t === name))); placeTabHi();
    from.classList.add('leave'); await wait(reduced ? 0 : 180); from.hidden = true; from.classList.remove('leave');
    const pn = (ET.rulePanes || {})[name]; if (pn && !to.dataset.mounted) { to.dataset.mounted = '1'; pn.mount(to); }
    to.hidden = false; to.classList.add('enter'); setTimeout(() => to.classList.remove('enter'), 800);
  }
  ET.rulesTab = async (name) => { await ET.go('rules'); if (root) showTab(name); };
  function renderNow() {
    const l = L(), act = rules.map((r) => ({ r, st: status(r) })).filter((x) => x.st.s === 'active'), box = $('#rlNow');
    const tiles = items.filter((i) => i.g === 'dis').slice(0, 6).map((i) => tile(i)).join('');
    if (act.length) { const { r, st } = act[0]; box.innerHTML = `<div class="glass rise" style="--d:100"><div class="rl-now"><div class="shield-ico">${ico('shield')}</div><div class="grow"><h3>${l.nowTitle(r.name)}</h3><p>${l.nowSub(fmt(st.end))}</p><div class="app-stack stack">${tiles}</div></div><div class="acts"><button class="pill-white" id="rlBreak" type="button">${ico('unlock')}${l.takeBreak}</button></div></div></div>`; $('#rlBreak').addEventListener('click', () => { ET.go('home'); setTimeout(() => $('#unblockBtn').click(), 900); }); }
    else { const nx = rules.map((r) => ({ r, st: status(r) })).filter((x) => x.st.s === 'next').sort((a, b) => a.st.in - b.st.in)[0]; box.innerHTML = `<div class="glass rise" style="--d:100"><div class="rl-now"><div class="shield-ico" style="color:var(--text-2);border-color:var(--edge);background:rgba(255,255,255,.06)">${ico('shield')}</div><div class="grow"><h3>${l.nowNone}</h3><p>${nx ? l.startsIn(dur(nx.st.in)) + ' · ' + nx.r.name : l.nowNoneSub}</p></div><div class="acts"><button class="pill-white" id="rlFocus" type="button">${ico('timer')}${l.startFocus}</button></div></div></div>`; $('#rlFocus').addEventListener('click', () => { ET.go('home'); setTimeout(() => ET.openSheet(), 700); }); }
  }
  function renderRules() {
    const l = L(), grid = $('#rlGrid'); grid.innerHTML = '';
    rules.forEach((r, i) => {
      const st = status(r), chip = st.s === 'timer' ? `${dur(r.dur || 25)} · ${l.timer}` : st.s === 'active' ? l.active(fmt(st.end)) : st.s === 'next' ? l.startsIn(dur(st.in)) : l.off, dis = items.filter((x) => (r.block === 'dis' ? x.g === 'dis' : r.block === 'all' ? x.g !== 'allow' : x.g === 'dis')).slice(0, 4);
      const card = document.createElement('div'); card.className = 'rule rise'; card.style.setProperty('--d', 120 + i * 70); card.dataset.s = st.s; card.tabIndex = 0; card.setAttribute('role', 'button'); card.setAttribute('aria-label', r.name);
      card.innerHTML = `<div class="glyphs">${ico(r.glyph === 'sun' ? 'sun' : r.glyph === 'moon' ? 'moon' : 'cal')}${ico('arrow', 'arr')}${ico('shield', 'sh')}</div><span class="chipt">${chip}</span><b>${r.name}${r.level ? `<span class="lvl">${ico('lock')}${l.levels[r.level]}</span>` : ''}</b><div class="sub">${r.kind === 'timer' ? l.blockSet[r.block] : `${fmt(tm(r.from))} – ${fmt(tm(r.to))} · ${dayLabel(r.days)}`}</div><div class="foot"><div class="app-stack">${dis.map((x) => tile(x)).join('')}</div>${r.kind === 'timer' ? `<button class="pill-white go" type="button" style="height:36px;padding:0 14px;font-size:13px">${ico('timer')}${ET.lang() === 'ru' ? 'Старт' : 'Start'}</button>` : `<button class="sw" role="switch" aria-checked="${r.on}" aria-label="${r.on ? l.ruleOn : l.ruleOff}: ${r.name}"></button>`}</div>`;
      const go = $('.go', card); if (go) go.addEventListener('click', (e) => { e.stopPropagation(); ET.S.min = r.dur || 25; ET.S.name = r.name; ET.go('home'); setTimeout(() => ET.startSession(), 500); });
      const sw = $('.sw', card); if (sw) sw.addEventListener('click', (e) => { e.stopPropagation(); r.on = !r.on; save(); sw.setAttribute('aria-checked', String(r.on)); toast(r.on ? l.ruleOn : l.ruleOff); setTimeout(() => { renderRules(); renderNow(); }, 350); });
      card.addEventListener('click', () => openEditor(r)); card.addEventListener('keydown', (e) => { if (e.key === 'Enter') openEditor(r); });
      grid.append(card);
    });
    const nw = document.createElement('button'); nw.className = 'rule new rise'; nw.style.setProperty('--d', 120 + rules.length * 70); nw.type = 'button'; nw.innerHTML = `<span class="plus">${ico('plus')}</span>${l.newRule}`; nw.addEventListener('click', () => openEditor(null)); grid.append(nw);
  }
  function renderLists() {
    const l = L(), box = $('#rlLists'); box.innerHTML = '';
    [['dis', l.gDis, l.gDisD], ['neu', l.gNeu, l.gNeuD], ['allow', l.gAllow, l.gAllowD]].forEach(([g, name, desc], gi) => {
      const card = document.createElement('div'); card.className = 'glass list-card rise'; card.style.setProperty('--d', 200 + gi * 90); card.dataset.g = g;
      card.innerHTML = `<h3><i style="background:${gcolor[g]};box-shadow:0 0 10px ${gcolor[g]}"></i>${name}</h3><div class="d">${desc}</div><div class="rows"></div>`;
      const rows = $('.rows', card), list = items.filter((x) => x.g === g);
      if (!list.length) rows.innerHTML = `<div class="li-empty">${l.empty}</div>`;
      list.forEach((it, i) => {
        const row = document.createElement('div'); row.className = 'li'; row.style.setProperty('--i', i); row.draggable = true; row.dataset.name = it.name;
        row.innerHTML = `${tile(it)}<div class="n"><b>${it.name}</b><span>${it.type === 'app' ? l.app : l.site}</span></div><button class="mv" type="button" aria-label="${name}: ${it.name}"><i style="background:${gcolor[g]}"></i></button>`;
        row.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', it.name); e.dataTransfer.effectAllowed = 'move'; row.classList.add('drag'); }); row.addEventListener('dragend', () => { row.classList.remove('drag'); $$('.list-card.over', root).forEach((x) => x.classList.remove('over')); });
        $('.mv', row).addEventListener('click', () => move(it.name, { dis: 'neu', neu: 'allow', allow: 'dis' }[g]));
        rows.append(row);
      });
      card.addEventListener('dragover', (e) => { e.preventDefault(); card.classList.add('over'); }); card.addEventListener('dragleave', (e) => { if (!card.contains(e.relatedTarget)) card.classList.remove('over'); }); card.addEventListener('drop', (e) => { e.preventDefault(); card.classList.remove('over'); move(e.dataTransfer.getData('text/plain'), g); });
      box.append(card);
    });
  }
  function move(name, g) { const it = items.find((x) => x.name === name); if (!it || it.g === g) return; it.g = g; save(); renderLists(); renderRules(); toast(L().moved(name, L().list[g])); }
  function addItem() {
    const inp = $('#rlAdd'), v = inp.value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''); if (!v) { inp.focus(); return; }
    if (items.some((x) => x.name.toLowerCase() === v.toLowerCase())) { toast(L().dup); return; }
    const site = /\./.test(v), hue = [...v].reduce((a, c) => a + c.charCodeAt(0), 0) % 360; items.unshift({ name: v, type: site ? 'site' : 'app', color: `hsl(${hue} 55% 42%)`, g: 'dis' }); save(); inp.value = ''; renderLists(); toast(L().added(v));
  }

  /* ---------------- the editor ---------------- */
  let E = null, wFrom, wTo, wDur, scrim, sheetEl;
  function buildEditor() {
    scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.id = 'ruleScrim'; scrim.setAttribute('aria-hidden', 'true');
    scrim.innerHTML = `<div class="sheet editor" role="dialog" aria-modal="true" aria-labelledby="edName"><div class="hero-img"><canvas id="edCanvas"></canvas><button class="round-btn" id="edClose" type="button" aria-label="Close">${ico('x')}</button></div><div class="body">
      <div class="e-seg" id="edSeg"><i class="hi"></i><button type="button" data-k="schedule">${ico('cal')}<span></span></button><button type="button" data-k="timer">${ico('timer')}<span></span></button></div>
      <input class="e-name" id="edName" maxlength="24" autocomplete="off">
      <div class="opt" id="edFrom"><button type="button" aria-expanded="false">${ico('clock')}<span class="lb"></span><span class="val"><span class="v"></span>${ico('right', 'chev')}</span></button><div class="opt-body"><div class="opt-inner"><div class="tw"><div><div class="lab"></div><div class="wheel"><div class="wheel-sel"></div><div class="wheel-list" tabindex="0"></div></div></div><div><div class="lab"></div><div class="wheel"><div class="wheel-sel"></div><div class="wheel-list" tabindex="0"></div></div></div></div></div></div></div>
      <div class="opt" id="edTo"><button type="button" aria-expanded="false">${ico('clock')}<span class="lb"></span><span class="val"><span class="v"></span>${ico('right', 'chev')}</span></button><div class="opt-body"><div class="opt-inner"><div class="tw"><div><div class="lab"></div><div class="wheel"><div class="wheel-sel"></div><div class="wheel-list" tabindex="0"></div></div></div><div><div class="lab"></div><div class="wheel"><div class="wheel-sel"></div><div class="wheel-list" tabindex="0"></div></div></div></div></div></div></div>
      <div class="opt" id="edDur"><button type="button" aria-expanded="false">${ico('clock')}<span class="lb"></span><span class="val"><span class="v"></span>${ico('right', 'chev')}</span></button><div class="opt-body"><div class="opt-inner"><div><div class="wheel"><div class="wheel-sel"></div><div class="wheel-list" tabindex="0"></div></div></div></div></div></div>
      <div class="warn" id="edWarn">${ico('clock')}<span></span></div>
      <div class="days-row"><b class="dl"></b><span class="dsum"></span></div><div class="days" id="edDays"></div>
      <div class="opt" id="edBlock"><button type="button" aria-expanded="false">${ico('shield')}<span class="lb"></span><span class="val"><i class="dot-red"></i><span class="v"></span>${ico('right', 'chev')}</span></button><div class="opt-body"><div class="opt-inner"><div><div class="seg" id="edBlockSeg" style="grid-template-columns:repeat(3,1fr)"><i class="seg-hi" style="width:calc((100% - 8px) / 3)"></i><button type="button" data-v="dis"></button><button type="button" data-v="all"></button><button type="button" data-v="pick"></button></div></div></div></div></div>
      <div class="opt" id="edStrict"><button type="button" aria-expanded="false">${ico('lock')}<span class="lb"></span><span class="val"><span class="v"></span>${ico('right', 'chev')}</span></button><div class="opt-body"><div class="opt-inner"><div><div class="seg" id="edStrictSeg"><i class="seg-hi"></i><button type="button" data-v="0"></button><button type="button" data-v="1"></button><button type="button" data-v="2"></button><button type="button" data-v="3"></button></div><p class="seg-desc" id="edStrictD"></p></div></div></div></div>
      <div class="opt" id="edBreaks"><button type="button" aria-expanded="false" style="cursor:pointer">${ico('shield')}<span class="lb"></span><span class="val"><span class="v"></span><span class="sw" role="switch" aria-checked="true" id="edBreakSw" style="margin-left:6px"></span></span></button></div>
      <button class="pill-white wide" id="edSave" type="button"></button><button class="del" id="edDel" type="button"></button></div></div>`;
    $('#app').append(scrim); sheetEl = $('.sheet', scrim);
    scrim.addEventListener('pointerdown', (e) => { if (e.target === scrim) closeEditor(); }); $('#edClose').addEventListener('click', closeEditor);
    $$('#edSeg button', scrim).forEach((b) => b.addEventListener('click', () => { E.kind = b.dataset.k; renderEditor(); }));
    $('#edName').addEventListener('input', (e) => { E.name = e.target.value; });
    $$('.opt > button', scrim).forEach((b) => b.addEventListener('click', (e) => { if (e.target.closest('.sw')) return; const o = b.parentElement; if (o.id === 'edBreaks') return; const open = !o.classList.contains('open'); $$('.opt', scrim).forEach((x) => { x.classList.remove('open'); x.firstElementChild.setAttribute('aria-expanded', 'false'); }); if (open) { o.classList.add('open'); b.setAttribute('aria-expanded', 'true'); setTimeout(() => { (o.id === 'edFrom' ? wFrom : o.id === 'edTo' ? wTo : o.id === 'edDur' ? [wDur] : []).forEach((w) => w.sync()); }, 90); } }));
    $$('#edBlockSeg button', scrim).forEach((b) => b.addEventListener('click', () => { E.block = b.dataset.v; renderEditor(); }));
    $$('#edStrictSeg button', scrim).forEach((b) => b.addEventListener('click', () => { E.level = +b.dataset.v; renderEditor(); }));
    $('#edBreakSw').addEventListener('click', (e) => { e.stopPropagation(); E.breaks = !E.breaks; renderEditor(); }); $('#edBreaks > button').addEventListener('click', () => { E.breaks = !E.breaks; renderEditor(); });
    $('#edSave').addEventListener('click', saveRule); $('#edDel').addEventListener('click', delRule);
    scrim.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeEditor(); } });
    const mk = (id, key) => { const o = $('#' + id, scrim), ws = $$('.wheel', o); const hrs = Array.from({ length: 24 }, (_, i) => i), mins = Array.from({ length: 12 }, (_, i) => i * 5); return [wheel(ws[0], hrs, 0, (v) => { const [, m] = E[key].split(':'); E[key] = `${String(v).padStart(2, '0')}:${m}`; renderEditor(true); }, (v) => String(v).padStart(2, '0')), wheel(ws[1], mins, 0, (v) => { const [h] = E[key].split(':'); E[key] = `${h}:${String(v).padStart(2, '0')}`; renderEditor(true); }, (v) => String(v).padStart(2, '0'))]; };
    wFrom = mk('edFrom', 'from'); wTo = mk('edTo', 'to'); wDur = wheel($('.wheel', $('#edDur', scrim)), ET.DURS.concat([150, 180, 240]), 25, (v) => { E.dur = v; renderEditor(true); }, (v) => `${v} ${ET.lang() === 'ru' ? 'мин' : 'min'}`);
    const dEl = $('#edDays', scrim); for (let i = 0; i < 7; i++) { const b = document.createElement('button'); b.type = 'button'; b.dataset.d = i; b.addEventListener('click', () => { const s = new Set(E.days); s.has(i) ? s.delete(i) : s.add(i); if (!s.size) return; E.days = [...s].sort(); renderEditor(true); }); dEl.append(b); }
  }
  function renderEditor(keepWheels) {
    if (!E) return; const l = L();
    $$('#edSeg button', scrim).forEach((b, i) => { b.setAttribute('aria-pressed', String(b.dataset.k === E.kind)); b.lastElementChild.textContent = i ? l.timer : l.schedule; }); $('#edSeg .hi', scrim).style.transform = `translateX(${E.kind === 'timer' ? 100 : 0}%)`;
    $('#edName').value = E.name; $('#edName').placeholder = l.name;
    const setOpt = (id, label, val) => { const o = $('#' + id, scrim); $('.lb', o).textContent = label; $('.v', o).textContent = val; };
    const wl = [[l.hours, l.minutes]]; ['edFrom', 'edTo'].forEach((id) => { const labs = $$('.lab', $('#' + id, scrim)); labs[0].textContent = l.hours; labs[1].textContent = l.minutes; });
    setOpt('edFrom', l.from, fmt(tm(E.from))); setOpt('edTo', l.to, fmt(tm(E.to))); const tmr = E.kind === 'timer'; $('#edFrom', scrim).style.display = $('#edTo', scrim).style.display = tmr ? 'none' : ''; $('#edDur', scrim).style.display = tmr ? '' : 'none'; $('.days-row', scrim).style.display = $('#edDays', scrim).style.display = tmr ? 'none' : ''; setOpt('edDur', l.durM, dur(E.dur || 25));
    $('.dl', scrim).textContent = l.onDays; $('.dsum', scrim).textContent = dayLabel(E.days); $$('#edDays button', scrim).forEach((b) => { b.textContent = l.days[b.dataset.d]; b.setAttribute('aria-pressed', String(E.days.includes(+b.dataset.d))); b.setAttribute('aria-label', l.dayNames[b.dataset.d]); });
    setOpt('edBlock', l.blocked, l.blockSet[E.block]); const bs = $$('#edBlockSeg button', scrim); const keys = ['dis', 'all', 'pick']; bs.forEach((b, i) => { b.textContent = l.blockSet[keys[i]]; b.setAttribute('aria-pressed', String(keys[i] === E.block)); b.style.fontSize = '12.5px'; }); $('#edBlockSeg .seg-hi', scrim).style.transform = `translateX(${keys.indexOf(E.block) * 100}%)`;
    setOpt('edStrict', l.strictL, l.levels[E.level || 0]); $$('#edStrictSeg button', scrim).forEach((b, i) => { b.textContent = l.levels[i]; b.setAttribute('aria-pressed', String(i === (E.level || 0))); b.style.fontSize = '12.5px'; }); $('#edStrictSeg .seg-hi', scrim).style.transform = `translateX(${(E.level || 0) * 100}%)`; $('#edStrictD', scrim).textContent = l.levelD[E.level || 0];
    setOpt('edBreaks', l.breaks, E.breaks ? l.yes : l.no); $('#edBreakSw').setAttribute('aria-checked', String(E.breaks));
    const ov = E.kind !== 'timer' && rules.some((r) => r.id !== E.id && r.on && r.days.some((d) => E.days.includes(d)) && tm(r.from) < tm(E.to) && tm(E.from) < tm(r.to)); const w = $('#edWarn', scrim); w.classList.toggle('on', ov); $('span', w).textContent = l.overlap;
    $('#edSave').textContent = l.save; $('#edDel').textContent = l.delete; $('#edDel').style.display = E.isNew ? 'none' : ''; $$('.sheet-title,.hero-img', scrim);
  }
  function drawHero() { const cv = $('#edCanvas', scrim); if (!cv.parentElement.clientWidth) return; const land = new ET.Landscape(cv); land.seed = 4; land.size(); land.draw(2); }
  function openEditor(rule) {
    E = rule ? { ...rule, days: [...rule.days] } : { id: 'r' + Date.now().toString(36), name: '', kind: 'schedule', dur: 25, from: '09:00', to: '17:00', days: [0, 1, 2, 3, 4], block: 'dis', breaks: true, level: 0, on: true, glyph: 'cal', isNew: true };
    if (E.isNew) E.name = ET.lang() === 'ru' ? 'Новое правило' : 'New rule';
    renderEditor(); openScrim('#ruleScrim'); wFrom[0].set(+E.from.slice(0, 2)); wFrom[1].set(+E.from.slice(3)); wTo[0].set(+E.to.slice(0, 2)); wTo[1].set(+E.to.slice(3)); wDur.set(E.dur || 25); setTimeout(drawHero, 60); setTimeout(() => $('#edName', scrim).focus({ preventScroll: true }), 350);
  }
  function closeEditor() { closeScrim('#ruleScrim'); E = null; }
  function saveRule() { const { isNew, ...r } = E; if (!r.name.trim()) { $('#edName', scrim).focus(); sheetEl.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], { duration: 300 }); return; } const i = rules.findIndex((x) => x.id === r.id); if (i >= 0) rules[i] = r; else rules.push(r); save(); closeEditor(); render(); toast(L().saved); }
  function delRule() { rules = rules.filter((x) => x.id !== E.id); save(); closeEditor(); render(); toast(L().deleted); }

  ET.screens.rules = { title: () => L().title, mount, show: () => { if (root) placeTabHi(false); } };
})();
