/* The bridge between the screens and the helper (the Windows service that really closes things).
   In a plain browser (the design prototype) this file does nothing and the screens run on demo data.
   Inside the app: the helper owns the setup, the session and every way out; the screens ask and show. */
(() => {
  'use strict';
  const T = window.__TAURI__;
  if (!T || !T.core || !window.ET) return;
  const ET = window.ET, $ = ET.$, $$ = ET.$$;
  const invoke = T.core.invoke;
  document.documentElement.classList.add('real');

  const KEYS = ['et-rules', 'et-items', 'et-limits', 'et-auto', 'et-cats', 'et-kw', 'et-ex', 'et-protect'];
  const lang = () => ET.lang();
  const TX = {
    en: {
      engineOn: 'Blocking engine: running', engineOff: 'Blocking engine: not running', engineWarnHosts: 'Blocking engine: cannot write the hosts file', engineWarnAgent: 'Blocking engine: running, no screen agent yet', clock: 'The clock was moved. A locked block keeps its own time.',
      nothing: 'Nothing is blocked right now', nothingSub: 'Start a session or add a rule', blockedSub: (a, s, t) => `${a} apps and ${s} sites are blocked${t ? ' · ' + t : ''}`, until: (m) => `${m >= 60 ? Math.floor(m / 60) + ' h ' : ''}${m % 60} min left`,
      closed: (n) => `EyeTime closed ${n}`, closing: (n) => `${n} is being closed. Save your work`, locked: 'This is locked. Only an emergency key opens it.', rejected: 'Not allowed while a locked block is running', offline: 'The blocking engine is not running',
      pinTitle: 'Enter your PIN', pinWrong: 'Wrong PIN', pinLocked: (s) => `Too many tries. Wait ${s} s`, cancel: 'Cancel', ok: 'Continue', hold: 'Hold', holding: 'Keep holding…', wait: (s) => `Wait ${s} s`, ready: 'Continue', type: 'Type this text exactly. Pasting is off.', mathQ: 'Solve it', wrong: 'Not right', friendQ: 'Ask your partner for the code', pinFor: 'PIN',
      ttEnd: 'Leave the session', ttBreak: 'Take a break', ttUnblock: 'Unblock for a while', ttEmerg: 'Emergency key', ttUninstall: 'Allow uninstalling', emergBtn: (n) => `Emergency key (${n} left)`, noKeys: 'No emergency keys left this week',
      pinCard: 'App PIN', pinCardD: 'Asked before anything can be loosened', pinSet: 'Set PIN', pinChange: 'Change', pinRemove: 'Remove', pinNew: 'New PIN (4 to 12 digits)', pinOld: 'Current PIN', pinSaved: 'PIN saved', pinGone: 'PIN removed', partnerSaved: 'Partner code saved',
      extT: 'Browser extension', extOn: 'Connected: pages, words and exceptions are closed in your browser.', extOff: 'Not connected. Without it EyeTime closes whole sites only (through the hosts file), not single pages or words.', extHow: 'Once: open the extensions page, switch on Developer mode, choose Load unpacked, and pick the folder below.', extFolder: 'Open the extension folder', extChrome: 'Chrome extensions', extEdge: 'Edge extensions',
      streakT: (n) => `${n} ${n === 1 ? 'day' : 'days'} in a row`, streakP: 'A finished focus session counts for the day.', streakNone: 'No streak yet', streakNoneP: 'Finish a focus session today to start one.', streak: 'days', uninT: 'Updating or removing EyeTime', uninD: 'While EyeTime protects you, setup cannot change or remove it. This permission lasts 10 minutes.', uninBtn: 'Allow uninstalling', uninOk: 'Allowed for 10 minutes. Run setup now.',
      dTitleEvery: 'Block everything', dTitleLocked: 'Locked session', dTitleFrozen: 'Frozen session', dTitleRule: 'Locked rule',
      dLockedA: (m, t) => `${m} min, until ${t}. It cannot be ended, paused or changed once it starts.`,
      dFrozenA: (m, t) => `${m} min, until ${t}. Everything except Windows itself and EyeTime is closed: no browser, no games, no other apps. Task Manager and Settings are closed too.`,
      dRuleA: (w) => `${w}. While it runs, it cannot be switched off or loosened.`,
      dKeys: (n) => n > 0 ? `The only way out is an emergency key. You have ${n} left this week; using one ends the block for 30 minutes and breaks your streak.` : 'You have NO emergency keys left this week. If you start this, you cannot get out before it ends.',
      dWork: 'Programs that are blocked get 15 seconds to close and offer to save. Anything unsaved in them can be lost after that. Save your work first.',
      dTask: 'Task Manager is disabled while it runs.', dPriv: 'Private browser windows are closed.', dVpn: 'VPN and proxy tools are closed.', dEvery: 'It blocks everything except your Always allowed list. Check that list first.',
      dAck: 'I understand, and I want this', dStart: 'Start', dSave: 'Keep it', dBack: 'Go back',
      noEscape: 'Locked blocks need at least one emergency key a week (Rules → Protection).', tooLong: 'A frozen rule can be at most 8 hours long.', busy: 'A session is already running',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    },
    ru: {
      engineOn: 'Движок блокировки: работает', engineOff: 'Движок блокировки: не запущен', engineWarnHosts: 'Движок блокировки: не может записать файл hosts', engineWarnAgent: 'Движок блокировки: работает, агент экрана ещё не подключился', clock: 'Часы переведены. Строгая блокировка идёт по своему времени.',
      nothing: 'Сейчас ничего не заблокировано', nothingSub: 'Запустите сессию или добавьте правило', blockedSub: (a, s, t) => `Закрыто: ${a} прилож. и ${s} сайтов${t ? ' · ' + t : ''}`, until: (m) => `осталось ${m >= 60 ? Math.floor(m / 60) + ' ч ' : ''}${m % 60} мин`,
      closed: (n) => `EyeTime закрыл ${n}`, closing: (n) => `${n} закрывается. Сохраните работу`, locked: 'Это заблокировано. Откроет только аварийный ключ.', rejected: 'Пока идёт строгая блокировка, так менять нельзя', offline: 'Движок блокировки не запущен',
      pinTitle: 'Введите PIN', pinWrong: 'Неверный PIN', pinLocked: (s) => `Слишком много попыток. Подождите ${s} с`, cancel: 'Отмена', ok: 'Продолжить', hold: 'Удерживайте', holding: 'Держите…', wait: (s) => `Подождите ${s} с`, ready: 'Продолжить', type: 'Введите текст точно как написано. Вставка отключена.', mathQ: 'Решите пример', wrong: 'Неверно', friendQ: 'Попросите у напарника код', pinFor: 'PIN',
      ttEnd: 'Выйти из сессии', ttBreak: 'Сделать перерыв', ttUnblock: 'Разблокировать на время', ttEmerg: 'Аварийный ключ', ttUninstall: 'Разрешить удаление', emergBtn: (n) => `Аварийный ключ (осталось ${n})`, noKeys: 'На этой неделе аварийных ключей не осталось',
      pinCard: 'PIN приложения', pinCardD: 'Спрашивается, прежде чем что-то ослабить', pinSet: 'Задать PIN', pinChange: 'Изменить', pinRemove: 'Убрать', pinNew: 'Новый PIN (от 4 до 12 цифр)', pinOld: 'Текущий PIN', pinSaved: 'PIN сохранён', pinGone: 'PIN убран', partnerSaved: 'Код напарника сохранён',
      extT: 'Расширение для браузера', extOn: 'Подключено: страницы, слова и исключения закрываются в браузере.', extOff: 'Не подключено. Без него EyeTime закрывает сайты целиком (через файл hosts), но не отдельные страницы и не слова.', extHow: 'Один раз: откройте страницу расширений, включите «Режим разработчика», нажмите «Загрузить распакованное» и выберите папку ниже.', extFolder: 'Открыть папку расширения', extChrome: 'Расширения Chrome', extEdge: 'Расширения Edge',
      streakT: (n) => `${n} дн. подряд`, streakP: 'День засчитывается, если завершена сессия фокуса.', streakNone: 'Серии пока нет', streakNoneP: 'Завершите сессию фокуса сегодня, чтобы начать.', streak: 'дн.', uninT: 'Обновление и удаление EyeTime', uninD: 'Пока EyeTime вас защищает, программа установки не может его изменить или удалить. Разрешение действует 10 минут.', uninBtn: 'Разрешить удаление', uninOk: 'Разрешено на 10 минут. Запускайте установку.',
      dTitleEvery: 'Закрыть всё', dTitleLocked: 'Строгая сессия', dTitleFrozen: 'Замороженная сессия', dTitleRule: 'Строгое правило',
      dLockedA: (m, t) => `${m} мин, до ${t}. После старта её нельзя закончить, поставить на паузу или изменить.`,
      dFrozenA: (m, t) => `${m} мин, до ${t}. Закрыто всё, кроме самой Windows и EyeTime: ни браузера, ни игр, ни других программ. Диспетчер задач и Параметры тоже закрываются.`,
      dRuleA: (w) => `${w}. Пока оно действует, его нельзя выключить или ослабить.`,
      dKeys: (n) => n > 0 ? `Единственный выход, аварийный ключ. На этой неделе осталось: ${n}. Ключ снимает блокировку на 30 минут и сбрасывает серию.` : 'Аварийных ключей на этой неделе НЕ осталось. Если запустить, выйти раньше конца не получится.',
      dWork: 'Заблокированным программам даётся 15 секунд, чтобы закрыться и предложить сохранить. Несохранённое после этого может пропасть. Сначала сохраните работу.',
      dTask: 'Диспетчер задач отключён на время блокировки.', dPriv: 'Приватные окна браузера закрываются.', dVpn: 'VPN и прокси закрываются.', dEvery: 'Закрыто всё, кроме списка «Всегда разрешено». Проверьте этот список.',
      dAck: 'Я понимаю и хочу этого', dStart: 'Запустить', dSave: 'Оставить', dBack: 'Назад',
      noEscape: 'Строгим блокировкам нужен хотя бы один аварийный ключ в неделю (Правила → Защита).', tooLong: 'Замороженное правило не может быть длиннее 8 часов.', busy: 'Сессия уже идёт',
      days: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    },
  };
  const L = () => TX[lang()] || TX.en;

  /* ---------------------------------------------------------------- talking to the helper */
  const req = async (o) => {
    try { return await invoke('helper', { req: o }); } catch (e) { return { ok: false, code: 'offline', message: String(e), data: null }; }
  };
  let status = null, online = false;

  /* ---------------------------------------------------------------- the setup: screens -> helper */
  const pending = {}; let timer = 0, pinForEdit = null;
  const pre = window.ETB; // calls made before this file loaded
  async function flush() {
    const keys = { ...pending }; for (const k of Object.keys(pending)) delete pending[k];
    if (!Object.keys(keys).length) return;
    if (keys['et-rules'] && !(await confirmRules(keys['et-rules']))) { rollback(); return; }
    const r = await req({ op: 'set_state', keys, pin: pinForEdit });
    if (r.ok) { pinForEdit = null; return; }
    if (r.code === 'pin' || r.code === 'pin_locked') {
      if (r.code === 'pin_locked') ET.toast(L().pinLocked(Math.ceil((r.data || 0) / 1000)));
      const pin = r.code === 'pin' ? await askPin() : null;
      if (pin) { pinForEdit = pin; Object.assign(pending, keys); flush(); } else rollback();
      return;
    }
    if (r.code === 'no_escape') ET.toast(/hours|8/.test(r.message || '') && JSON.stringify(r.data || '').includes('too_long') ? L().tooLong : L().noEscape);
    else if (r.code === 'locked') ET.toast(L().rejected); else if (r.code === 'offline') ET.toast(L().offline); else ET.toast(r.message || L().rejected);
    rollback();
  }
  /* the helper said no: the screens go back to what the helper has */
  async function rollback() {
    const r = await req({ op: 'get_state' });
    if (r.ok && r.data) { for (const k of KEYS) if (r.data[k] !== undefined) localStorage.setItem(k, JSON.stringify(r.data[k])); }
    setTimeout(() => location.reload(), 900);
  }
  function cleanForHelper(k, v) {
    let o; try { o = JSON.parse(v); } catch { return undefined; }
    if (k === 'et-protect' && o && typeof o === 'object') { o = { ...o }; delete o.pin; } // codes never travel with the settings
    return o;
  }
  const ETB = window.ETB = {
    push(k, v) {
      if (KEYS.includes(k)) { const o = cleanForHelper(k, v); if (o !== undefined) { pending[k] = o; clearTimeout(timer); timer = setTimeout(flush, 250); } return; }
      if (k === 'et-s-launch' || k === 'et-s-tray') invoke('apply_setting', { key: k.slice(5), value: String(v) }).catch(() => {});
    },
    startSession: async (S) => {
      const every = [...S.blocks].some((b) => /^(everything|all|все|всё|\*)$/i.test(b));
      if ((S.diff >= 2 || every) && !(await confirmSession(S, every))) return false;
      const r = await req({ op: 'start_session', name: S.name, minutes: S.min, level: S.diff, blocks: [...S.blocks], scene: S.scene, allow_breaks: !!S.more.breaks, dnd: !!S.more.dnd, mute: !!S.more.mute, close_now: !!S.more.close });
      if (!r.ok) { ET.toast(r.code === 'busy' ? L().busy : r.code === 'no_escape' ? L().noEscape : r.code === 'offline' ? L().offline : r.message || '?'); return false; }
      status = r.data; expectSession = true; return true;
    },
    ask: (action, target, minutes) => ask(action, target, minutes),
    getStatus: () => status,
    req,
  };
  if (pre && pre.q) pre.q.forEach(([k, v]) => ETB.push(k, v));

  /* ---------------------------------------------------------------- a small dialog */
  const css = document.createElement('style');
  css.textContent = `
  .etb-scrim{position:fixed;inset:0;z-index:200;display:grid;place-items:center;background:rgba(3,6,12,.62);backdrop-filter:blur(14px);opacity:0;transition:opacity .25s}.etb-scrim.on{opacity:1}
  .etb-card{width:min(420px,calc(100vw - 32px));padding:26px 26px 22px;border-radius:26px;background:linear-gradient(180deg,rgba(24,32,48,.92),rgba(12,18,30,.94));border:1px solid rgba(255,255,255,.12);box-shadow:0 30px 80px rgba(0,0,0,.55);color:var(--text,#eaf2ff);transform:translateY(14px) scale(.97);transition:transform .35s cubic-bezier(.2,.9,.2,1)}
  .etb-scrim.on .etb-card{transform:none}
  .etb-card h3{margin:0 0 4px;font:500 20px/1.2 Outfit,system-ui;letter-spacing:.2px}.etb-card p{margin:0 0 14px;color:var(--text-2,#9fb0c8);font-size:14px;line-height:1.45}
  .etb-card .tgt{font:500 16px/1.7 ui-monospace,Consolas,monospace;margin:0 0 10px;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.05);user-select:none;-webkit-user-select:none}
  .etb-card .tgt .ok{color:#8cf2c6}.etb-card .tgt .bad{color:#ff6b7d;text-decoration:underline}.etb-card .tgt .rest{opacity:.55}
  .etb-card textarea,.etb-card input{width:100%;box-sizing:border-box;padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:inherit;font:500 16px/1.4 inherit;outline:none}
  .etb-card textarea:focus,.etb-card input:focus{border-color:rgba(140,242,198,.6);box-shadow:0 0 0 3px rgba(140,242,198,.15)}
  .etb-row{display:flex;gap:10px;margin-top:16px;justify-content:flex-end}.etb-row button{min-height:44px;padding:0 20px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:inherit;font:500 15px Figtree,system-ui;cursor:pointer;position:relative;overflow:hidden}
  .etb-row button.go{background:#eaf2ff;color:#0b1220;border-color:transparent}.etb-row button:disabled{opacity:.45;cursor:default}
  .etb-row button i{position:absolute;inset:0;width:0;background:rgba(140,242,198,.45);pointer-events:none}.etb-row button span{position:relative}
  .etb-msg{min-height:18px;margin-top:8px;font-size:13px;color:#ff9aa6}.etb-card .math{font:600 28px Outfit,system-ui;text-align:center;margin:6px 0 12px}
  .etb-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}.etb-pad button{height:46px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:inherit;font:500 18px Figtree,system-ui;cursor:pointer}
  .etb-dots{display:flex;gap:10px;justify-content:center;margin:6px 0}.etb-dots i{width:12px;height:12px;border-radius:50%;border:1px solid rgba(255,255,255,.4)}.etb-dots i.on{background:#8cf2c6;border-color:#8cf2c6}
  .shake{animation:etbshake .4s}@keyframes etbshake{20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}
  .etb-emerg{margin-top:14px;padding:10px 16px;border-radius:999px;border:1px solid rgba(255,184,107,.4);background:rgba(255,184,107,.08);color:#ffcf99;font:500 14px Figtree,system-ui;cursor:pointer}
  .etb-pincard{display:flex;align-items:center;gap:14px;justify-content:space-between}.etb-pincard .b{display:flex;gap:8px}.etb-pincard button{min-height:38px;padding:0 16px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:inherit;cursor:pointer;font:500 14px Figtree,system-ui}
  `;
  document.head.append(css);

  function dialog(title, sub) {
    const scrim = document.createElement('div'); scrim.className = 'etb-scrim'; scrim.setAttribute('role', 'dialog'); scrim.setAttribute('aria-modal', 'true');
    const card = document.createElement('div'); card.className = 'etb-card'; scrim.append(card);
    const h = document.createElement('h3'); h.textContent = title; const p = document.createElement('p'); p.textContent = sub || ''; card.append(h, p);
    const body = document.createElement('div'); const msg = document.createElement('div'); msg.className = 'etb-msg'; const row = document.createElement('div'); row.className = 'etb-row'; card.append(body, msg, row);
    document.body.append(scrim); requestAnimationFrame(() => scrim.classList.add('on'));
    const close = () => { scrim.classList.remove('on'); setTimeout(() => scrim.remove(), 280); document.removeEventListener('keydown', esc, true); };
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); api.onclose && api.onclose(); } }; document.addEventListener('keydown', esc, true);
    const api = { card, body, row, msg, close, say: (t) => { msg.textContent = t || ''; }, shake: () => { card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); }, onclose: null };
    return api;
  }
  function button(label, cls, fn) { const b = document.createElement('button'); b.type = 'button'; if (cls) b.className = cls; b.innerHTML = '<i></i><span></span>'; b.lastChild.textContent = label; if (fn) b.addEventListener('click', fn); return b; }
  function holdIt(b, ms, done) {
    const bar = b.firstChild; let t0 = 0, raf = 0, label = b.lastChild.textContent;
    const stop = () => { cancelAnimationFrame(raf); t0 = 0; bar.style.transition = 'width .3s'; bar.style.width = '0'; b.lastChild.textContent = label; };
    const step = () => { if (!t0) return; const p = (performance.now() - t0) / ms; bar.style.transition = 'none'; bar.style.width = Math.min(1, p) * 100 + '%'; b.lastChild.textContent = L().holding; if (p >= 1) { t0 = 0; done(); } else raf = requestAnimationFrame(step); };
    b.addEventListener('pointerdown', () => { t0 = performance.now(); step(); }); ['pointerup', 'pointerleave', 'pointercancel'].forEach((e) => b.addEventListener(e, stop));
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !t0) { t0 = performance.now() - ms + 500; step(); } }); b.addEventListener('keyup', stop);
  }

  function askPin() {
    return new Promise((resolve) => {
      const d = dialog(L().pinTitle, ''); const inp = document.createElement('input'); inp.type = 'password'; inp.inputMode = 'numeric'; inp.maxLength = 12; inp.autocomplete = 'off'; inp.setAttribute('aria-label', 'PIN'); d.body.append(inp); setTimeout(() => inp.focus(), 120);
      let done = false; const fin = (v) => { if (done) return; done = true; d.close(); resolve(v); };
      d.onclose = () => fin(null); d.row.append(button(L().cancel, '', () => fin(null)), button(L().ok, 'go', () => fin(inp.value || null)));
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') fin(inp.value || null); });
    });
  }

  /* a block that cannot be lifted is explained first, in plain words, and has to be agreed to */
  function confirmDanger({ title, lines, okLabel }) {
    return new Promise((resolve) => {
      const d = dialog(title, ''); d.card.querySelector('p').remove();
      const ul = document.createElement('ul'); ul.style.cssText = 'margin:0 0 14px;padding-left:18px;color:var(--text-2,#9fb0c8);font-size:14px;line-height:1.5;display:grid;gap:8px'; lines.forEach((t) => { const li = document.createElement('li'); li.textContent = t; ul.append(li); }); d.body.append(ul);
      const lab = document.createElement('label'); lab.style.cssText = 'display:flex;gap:10px;align-items:center;cursor:pointer;font-size:14px'; const cb = document.createElement('input'); cb.type = 'checkbox'; cb.style.cssText = 'width:20px;height:20px;flex:none'; lab.append(cb, document.createTextNode(L().dAck)); d.body.append(lab);
      let done = false; const fin = (v) => { if (done) return; done = true; d.close(); resolve(v); };
      const go = button(okLabel || L().dStart, 'go', () => fin(true)); go.disabled = true; cb.addEventListener('change', () => { go.disabled = !cb.checked; });
      d.onclose = () => fin(false); d.row.append(button(L().dBack, '', () => fin(false)), go);
    });
  }
  const clock = (ms) => new Date(ms).toLocaleTimeString(lang() === 'ru' ? 'ru-RU' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  function protectNow() { try { return JSON.parse(localStorage.getItem('et-protect')) || {}; } catch { return {}; } }
  function extraLines(everything) {
    const tam = (protectNow().tam) || {}, out = [L().dWork]; if (tam.private !== false) out.push(L().dPriv); if (tam.vpn !== false) out.push(L().dVpn); if (tam.taskmgr) out.push(L().dTask); if (everything) out.push(L().dEvery); return out;
  }
  async function confirmSession(S, every) {
    const frozen = S.diff >= 3, hard = S.diff >= 2, ends = Date.now() + S.min * 60000, left = status ? status.emergencyLeft : 0;
    const lines = hard ? [frozen ? L().dFrozenA(S.min, clock(ends)) : L().dLockedA(S.min, clock(ends)), L().dKeys(left), ...extraLines(every)] : [L().dEvery, L().dWork];
    return confirmDanger({ title: frozen ? L().dTitleFrozen : hard ? L().dTitleLocked : L().dTitleEvery, lines });
  }
  const lockedRuleIds = new Set(); // rules the person has already agreed to as locked
  try { (JSON.parse(localStorage.getItem('et-rules')) || []).forEach((r) => { if (r.on !== false && r.level >= 2) lockedRuleIds.add(r.id + ':' + r.level); }); } catch { /* none */ }
  async function confirmRules(rules) {
    for (const r of rules) {
      if (r.on === false || r.kind === 'timer' || !(r.level >= 2) || lockedRuleIds.has(r.id + ':' + r.level)) continue;
      const days = (r.days || []).map((d) => L().days[d]).join(', '), when = r.from === r.to ? (lang() === 'ru' ? 'весь день' : 'all day') : `${r.from}–${r.to}`;
      const lines = [L().dRuleA(`${r.name || ''}: ${days}, ${when}`), L().dKeys(status ? status.emergencyLeft : 0), ...extraLines(r.block === 'all')];
      const ok = await confirmDanger({ title: r.level >= 3 ? L().dTitleFrozen : L().dTitleRule, lines, okLabel: L().dSave });
      if (!ok) return false;
      lockedRuleIds.add(r.id + ':' + r.level);
    }
    return true;
  }

  /* ---------------------------------------------------------------- the way out: the helper sets the challenge, the dialog shows it */
  const TITLES = (a) => ({ end_session: L().ttEnd, break: L().ttBreak, unblock: L().ttUnblock, emergency: L().ttEmerg, uninstall: L().ttUninstall })[a] || a;
  async function ask(action, target, minutes) {
    const c = await req({ op: 'challenge', action, target: target || null, minutes: minutes || 5 });
    if (!c.ok) {
      if (c.code === 'locked') ET.toast(L().locked); else if (c.code === 'no_keys') ET.toast(L().noKeys); else if (c.code === 'offline') ET.toast(L().offline); else if (c.code !== 'none') ET.toast(c.message || '?');
      return null;
    }
    const ch = c.data;
    return new Promise((resolve) => {
      const d = dialog(TITLES(action), ''); let finished = false, pin = '', partner = '';
      const finish = (st) => { if (finished) return; finished = true; d.close(); resolve(st); };
      d.onclose = () => finish(null); d.row.append(button(L().cancel, '', () => { d.onclose(); d.close(); }));
      let pinInp = null;
      if (ch.needsPin) { pinInp = document.createElement('input'); pinInp.type = 'password'; pinInp.inputMode = 'numeric'; pinInp.maxLength = 12; pinInp.placeholder = L().pinFor; pinInp.autocomplete = 'off'; pinInp.setAttribute('aria-label', 'PIN'); pinInp.style.marginBottom = '12px'; d.body.append(pinInp); }
      const submit = async (answer, extra) => {
        const r = await req({ op: 'complete', challenge_id: ch.id, answer: answer || '', pin: pinInp ? pinInp.value : null, partner_code: extra || null });
        if (r.ok) { status = r.data || status; finish(r.data || true); return true; }
        if (r.code === 'early') { d.say(''); return 'early:' + r.data; }
        if (r.code === 'pin') { d.say(L().pinWrong); d.shake(); } else if (r.code === 'pin_locked') { d.say(L().pinLocked(Math.ceil((r.data || 0) / 1000))); d.shake(); } else if (r.code === 'wrong') { d.say(L().wrong); d.shake(); } else if (r.code === 'expired') { d.close(); finished = true; resolve(ask(action, target, minutes)); } else d.say(r.message || '');
        return false;
      };
      const ready = Math.max(0, ch.readyMs - (status ? status.nowMs : ch.issuedMs)); const readyAt = performance.now() + ready;
      const k = ch.kind;
      if (k === 'none') { submit(''); return; }
      if (k === 'hold') {
        d.card.querySelector('p').textContent = L().hold; const b = button(L().hold, 'go'); d.row.append(b); holdIt(b, 2600, () => submit(''));
      } else if (k === 'wait') {
        const total = Math.max(1, Math.ceil(ready / 1000)); const b = button(L().wait(total), 'go'); b.disabled = true; d.row.append(b);
        const iv = setInterval(() => { if (!b.isConnected) return clearInterval(iv); const left = Math.ceil((readyAt - performance.now()) / 1000); b.firstChild.style.width = Math.min(100, ((total - left) / total) * 100) + '%'; if (left <= 0) { clearInterval(iv); b.disabled = false; b.lastChild.textContent = L().ready; b.onclick = () => submit(''); } else b.lastChild.textContent = L().wait(left); }, 250);
      } else if (k === 'type') {
        d.card.querySelector('p').textContent = L().type; const tg = document.createElement('div'), ta = document.createElement('textarea'); tg.className = 'tgt'; ta.rows = 3; ta.spellcheck = false; d.body.append(tg, ta); setTimeout(() => ta.focus(), 120);
        const txt = ch.prompt, paint = async () => {
          const v = ta.value; let h = ''; for (let i = 0; i < txt.length; i++) { const c0 = txt[i] === ' ' ? '&nbsp;' : txt[i]; h += i < v.length ? (v[i] === txt[i] ? `<span class="ok">${c0}</span>` : `<span class="bad">${c0}</span>`) : `<span class="rest">${c0}</span>`; } tg.innerHTML = h;
          if (v === txt) { ta.disabled = true; let r = await submit(v); while (typeof r === 'string' && r.startsWith('early:')) { await ET.wait(+r.slice(6) + 80); r = await submit(v); } if (r === false) ta.disabled = false; }
        };
        paint(); ta.addEventListener('input', paint); ta.addEventListener('paste', (e) => { e.preventDefault(); d.say(L().type); }); ta.addEventListener('drop', (e) => e.preventDefault());
      } else if (k === 'math') {
        d.card.querySelector('p').textContent = L().mathQ; const q = document.createElement('div'), inp = document.createElement('input'); q.className = 'math'; q.textContent = ch.prompt; inp.inputMode = 'numeric'; inp.style.textAlign = 'center'; d.body.append(q, inp); setTimeout(() => inp.focus(), 120);
        inp.addEventListener('keydown', async (e) => { if (e.key !== 'Enter') return; let r = await submit(inp.value); while (typeof r === 'string' && r.startsWith('early:')) { await ET.wait(+r.slice(6) + 80); r = await submit(inp.value); } if (r === false) inp.value = ''; });
      } else if (k === 'friend') {
        d.card.querySelector('p').textContent = L().friendQ; const dots = document.createElement('div'), pad = document.createElement('div'); dots.className = 'etb-dots'; dots.innerHTML = '<i></i><i></i><i></i><i></i>'; pad.className = 'etb-pad'; d.body.append(dots, pad);
        const paint = () => $$('i', dots).forEach((e, i) => e.classList.toggle('on', i < partner.length));
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].forEach((key) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = key; if (!key) b.style.visibility = 'hidden'; b.onclick = async () => { if (key === '⌫') partner = partner.slice(0, -1); else if (partner.length < 12) partner += key; paint(); }; pad.append(b); });
        d.row.append(button(L().ok, 'go', async () => { const r = await submit('', partner); if (r === false) { partner = ''; paint(); } }));
      }
    });
  }

  /* ---------------------------------------------------------------- what the helper reports -> the screens */
  let expectSession = false, lastEvent = 0, usageDays = null, usageAt = 0;
  const fmtSec = (s) => s;
  function dayModel(u) {
    const total = Object.values(u.secs || {}).reduce((a, b) => a + b, 0), dis = u.dis_secs || 0, off = u.offline_secs || 0;
    const screen = Math.round(total / 60), offline = Math.round(off / 60);
    const focusPct = total ? Math.round(100 * (1 - dis / total)) : 100, offPct = total + off ? Math.round((100 * off) / (total + off)) : 0;
    const rest = Math.min(100, Math.round(offPct * 1.3)), score = total + off === 0 ? 0 : Math.round(focusPct * 0.7 + rest * 0.3);
    return { score, focus: focusPct, rest, screen, focusPct, switches: u.switches || 0, offline, offPct, total, empty: total === 0 };
  }
  function bars(u) {
    const rows = [];
    for (let i = 0; i < 24; i++) {
      const h = 8 + Math.floor(i / 2), all = ((u.hours || [])[h] || 0) / 60 / 2, d = ((u.dis_hours || [])[h] || 0) / 60 / 2;
      rows.push([Math.max(0, Math.min(30, Math.round(all - d))), Math.max(0, Math.min(30, Math.round(d)))]);
    }
    return rows;
  }
  function paintHome(st) {
    const keys = usageDays ? Object.keys(usageDays).sort() : [];
    const today = st.today || {}; const days = keys.length ? keys.map((k) => usageDays[k]) : [today];
    if (keys.length) days[days.length - 1] = today;
    const m = dayModel(today), prev = days.length > 1 ? dayModel(days[days.length - 2]) : null;
    const week = days.slice(-7).map(dayModel).filter((x) => x.total > 0); const avg = week.length ? week.reduce((a, b) => a + b.screen, 0) / week.length : 0;
    const spec = avg > 0 && m.screen < avg ? Math.round((1 - m.screen / avg) * 100) : 0;
    ET.setHome({ day: { ...m, delta: prev && prev.total > 0 ? m.score - prev.score : 0, spec }, bars: bars(today) });
    ET.setStreak(st.streakDays || 0);
    // the small texts that used to be demo: real numbers or an honest dash
    const hm = (m) => (m >= 60 ? `${Math.floor(m / 60)}${lang() === 'ru' ? '\u0447' : 'h'} ${String(m % 60).padStart(2, '0')}${lang() === 'ru' ? '\u043c' : 'm'}` : `${m}${lang() === 'ru' ? '\u043c' : 'm'}`);
    const lab = $$('.spec-labels b'); if (lab.length === 2) { lab[0].textContent = m.empty ? '\u2014' : hm(m.screen); lab[1].textContent = avg > 0 ? hm(Math.round(avg)) : '\u2014'; }
    const sh = $('.streak h4'), sp = $('.streak p');
    if (sh && sp) { const n = st.streakDays || 0; sh.textContent = n > 0 ? L().streakT(n) : L().streakNone; sp.textContent = n > 0 ? L().streakP : L().streakNoneP; }
    // the three most used things, as tiles
    const stack = $('.stat .app-stack'); if (stack) {
      const top = Object.entries(today.secs || {}).sort((x, y) => y[1] - x[1]).slice(0, 3), sig = top.map((t) => t[0]).join();
      if (stack.dataset.sig !== sig) {
        stack.dataset.sig = sig; stack.innerHTML = '';
        top.forEach(([k]) => { const name = k.replace(/^(exe|site):/, '').replace(/\.(exe|com|org|net|ru)$/, ''); let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360; const t = document.createElement('span'); t.className = 'app-tile'; t.title = name; t.dataset.n = name; t.style.background = `hsl(${h} 65% 48%)`; t.textContent = name.slice(0, 2).replace(/^./, (c) => c.toUpperCase()); stack.append(t); });
      }
    }
  }
  function paintBlock(st) {
    const d = st.decision || {}; const r = (d.reasons || [])[0];
    if (!d.exes) return;
    const apps = d.allowOnly ? '∞' : (d.exes || []).length, sites = d.allowOnly ? '∞' : (d.domains || []).length;
    if (r) ET.setBlockCard({ title: r.name, sub: L().blockedSub(apps, sites, r.minsLeft ? L().until(r.minsLeft) : '') }); else ET.setBlockCard({ title: L().nothing, sub: L().nothingSub });
  }
  function paintEngine() {
    extensionCard();
    const t = $('#engTxt'), dot = $('#engDot'); if (!t) return;
    const bad = !online || (status && !status.hostsOk), warn = online && status && !status.agentConnected;
    const txt = !online ? L().engineOff : status && !status.hostsOk ? L().engineWarnHosts : warn ? L().engineWarnAgent : L().engineOn;
    if (t.textContent !== txt) t.textContent = txt; // only when it changed: this runs from a mutation observer
    if (dot) dot.style.background = bad ? '#ff6b7d' : warn ? '#ffb86b' : '';
  }
  let sessionMissing = 0;
  function syncSession(st) {
    const ses = st.session, run = ET.run;
    if (ses && !run.on && !expectSession) { const left = Math.max(1, (ses.endsAtMs - st.nowMs) / 1000), total = (ses.endsAtMs - ses.startedAtMs) / 1000; ET.resumeRun(ses, left, total); }
    if (ses && run.on) {
      expectSession = false; sessionMissing = 0;
      const left = Math.max(0, (ses.endsAtMs - st.nowMs) / 1000); if (Math.abs(run.left - left) > 1.5) run.left = left;
      const brk = ses.snoozeUntilMs && ses.snoozeUntilMs > st.nowMs;
      if (brk && !run.snooze) { run.snooze = true; $('#breakBanner').classList.add('on'); $('#snoozeBtn').style.display = 'none'; }
      if (brk) run.breakLeft = (ses.snoozeUntilMs - st.nowMs) / 1000;
      if (!brk && run.snooze) { run.snooze = false; $('#breakBanner').classList.remove('on'); $('#snoozeBtn').style.display = ses.level >= 2 ? 'none' : ''; }
      emergencyButton(st, ses);
    }
    if (!ses && run.on && !expectSession) { if (++sessionMissing >= 1) { const completed = run.left <= 5; ET.endRunExternal(completed); } }
  }
  function emergencyButton(st, ses) {
    let b = $('#etbEmerg'); const need = ses.level >= 2;
    if (!need) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('button'); b.id = 'etbEmerg'; b.type = 'button'; b.className = 'etb-emerg'; const ln = $('#lockedNote'); ln.after(b); b.addEventListener('click', async () => { const r = await ask('emergency'); if (r) refresh(); }); }
    b.textContent = L().emergBtn(st.emergencyLeft); b.disabled = st.emergencyLeft <= 0;
  }
  function news(st) {
    for (const e of st.events || []) if (e.atMs > lastEvent) { lastEvent = e.atMs; if (lastEvent && e.kind !== 'tool') ET.toast((e.kind === 'closing' ? L().closing : L().closed)(e.name.replace(/\.exe$/, ''))); }
  }
  async function refresh() {
    const r = await req({ op: 'status' });
    online = !!r.ok;
    if (r.ok) {
      const first = !status; status = r.data; if (first) lastEvent = Math.max(0, ...(status.events || []).map((e) => e.atMs));
      syncSession(status); paintBlock(status); news(status);
      if (!usageDays || performance.now() - usageAt > 30000) { const u = await req({ op: 'usage' }); if (u.ok) { usageDays = u.data; usageAt = performance.now(); } }
      paintHome(status);
      document.dispatchEvent(new CustomEvent('et-status', { detail: status }));
    }
    paintEngine();
  }
  /* window buttons (the window has no frame of its own) */
  {
    const wc = $('.win-ctl');
    if (wc) {
      wc.removeAttribute('aria-hidden');
      const names = [['minimize', 'Minimize', 'Свернуть'], ['toggle_maximize', 'Maximize', 'Развернуть'], ['close', 'Close', 'Закрыть']];
      $$('button', wc).forEach((b, i) => { b.tabIndex = 0; b.setAttribute('aria-label', names[i][lang() === 'ru' ? 2 : 1]); b.addEventListener('click', () => invoke('window_ctl', { action: names[i][0] }).catch(() => {})); });
    }
  }
  /* first start after an update: if the helper has no setup yet but this window does, hand it over */
  req({ op: 'get_state' }).then((r) => { if (r.ok && r.data && !Object.keys(r.data).length) KEYS.forEach((k) => { const v = localStorage.getItem(k); if (v) ETB.push(k, v); }); });
  setInterval(refresh, 2000); refresh();
  /* the first run: a new person gets the first minute, not an empty app */
  setTimeout(async () => {
    if (!ET.onboarding || !ET.onboarding.shouldRun()) return;
    const r = await req({ op: 'get_state' });
    const empty = !(r.ok && r.data && (r.data['et-items'] || []).length + (r.data['et-rules'] || []).length > 0);
    if (empty) ET.onboarding.open(); else { try { localStorage.setItem('et-onboarded', '1'); } catch { /* ignore */ } }
  }, 6500);
  /* the person's own reason, under the name of the running session */
  setInterval(() => {
    const n = $('#sName'); if (!n || !ET.run.on) return;
    let w = ''; try { w = JSON.parse(localStorage.getItem('et-s-why') || '""'); } catch { /* none */ }
    let line = $('#whyLine');
    if (!w) { if (line) line.remove(); return; }
    if (!line) { line = document.createElement('div'); line.id = 'whyLine'; line.style.cssText = 'margin:2px 0 10px;font:italic 300 16px Outfit,system-ui;color:#cfe3f5;text-shadow:0 1px 14px rgba(0,0,0,.6);max-width:640px'; n.after(line); }
    if (line.textContent !== '\u201c' + w + '\u201d') line.textContent = '\u201c' + w + '\u201d';
  }, 2000);
  ET.engineText = (d) => d;
  // a language change resets the texts the screens own: paint the real ones again
  ET.langHooks.push(() => { ET._homeSig = ''; if (status) { paintHome(status); paintBlock(status); } paintEngine(); });
  document.addEventListener('et-settings-shown', paintEngine);
  function uninstallCard() {
    const v = $('#view-settings'); if (!v || $('#etbUninst')) return;
    const card = document.createElement('div'); card.id = 'etbUninst'; card.className = 'glass st-group'; card.style.marginTop = '16px';
    card.innerHTML = `<div class="etb-pincard" style="padding:6px 4px"><div><h3 style="margin:0">${L().uninT}</h3><p class="s" style="margin:4px 0 0;max-width:480px">${L().uninD}</p></div><div class="b"><button type="button">${L().uninBtn}</button></div></div>`;
    $('button', card).onclick = async () => { const r = await ask('uninstall'); if (r) ET.toast(L().uninOk); };
    ($('.st-wrap', v) || v).append(card);
  }
  function extensionCard() {
    const v = $('#view-settings'); if (!v) return;
    let card = $('#etbExt');
    const on = !!(status && status.extConnected);
    if (!card) {
      card = document.createElement('div'); card.id = 'etbExt'; card.className = 'glass st-group'; card.style.marginTop = '16px';
      card.innerHTML = `<div class="etb-pincard" style="padding:6px 4px;align-items:flex-start"><div><h3 style="margin:0">${L().extT}</h3><p class="s" id="etbExtS" style="margin:4px 0 0;max-width:520px"></p><p class="s" style="margin:8px 0 0;max-width:520px;opacity:.8">${L().extHow}</p></div><div class="b" style="flex-wrap:wrap;justify-content:flex-end"><button type="button" data-k="extension_folder">${L().extFolder}</button><button type="button" data-k="chrome_extensions">${L().extChrome}</button><button type="button" data-k="edge_extensions">${L().extEdge}</button></div></div>`;
      $$('button', card).forEach((b) => (b.onclick = () => invoke('open_target', { kind: b.dataset.k }).catch(() => {})));
      ($('.st-wrap', v) || v).append(card);
    }
    const t = $('#etbExtS', card), txt = on ? L().extOn : L().extOff;
    if (t.textContent !== txt) t.textContent = txt;
  }
  new MutationObserver(() => { paintEngine(); uninstallCard(); extensionCard(); }).observe(document.body, { childList: true, subtree: true });

  /* ---------------------------------------------------------------- the buttons that used to pretend */
  const stop = (e) => { e.stopImmediatePropagation(); e.preventDefault(); };
  const sessionEl = $('#session');
  // leaving early
  ['pointerdown', 'click', 'keydown'].forEach((ev) => sessionEl.addEventListener(ev, async (e) => {
    const b = e.target.closest && e.target.closest('#leaveBtn'); if (!b) return;
    if (ev === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    stop(e); if (ev !== 'click') return;
    const st = await ask('end_session'); if (st) { expectSession = false; ET.endRunExternal(false); refresh(); }
  }, true));
  // a break
  sessionEl.addEventListener('click', async (e) => {
    if (e.target.closest && e.target.closest('#snoozeBtn')) { stop(e); const st = await ask('break', null, 5); if (st) { ET.toast(lang() === 'ru' ? 'Перерыв начался' : 'Break started'); refresh(); } }
    else if (e.target.closest && e.target.closest('#resumeBtn')) { stop(e); const r = await req({ op: 'resume' }); if (r.ok) { status = r.data; refresh(); } }
  }, true);
  // the unblock dialog on the home screen
  $('#unScrim').addEventListener('click', async (e) => {
    if (!(e.target.closest && e.target.closest('#unGo'))) return; stop(e); ET.closeScrim('#unScrim');
    const m = ET.askUnblockMinutes(); const st = await ask('unblock', 'all', m); if (st) { ET.unblockGranted(m); refresh(); }
  }, true);
  document.addEventListener('click', async (e) => {
    const b = e.target.closest && e.target.closest('#unblockBtn'); if (!b) return;
    if (b.querySelector('use') && b.querySelector('use').getAttribute('href') === '#i-lock') { stop(e); await req({ op: 'resume' }); refresh(); ET.toast(lang() === 'ru' ? 'Снова заблокировано' : 'Blocked again'); location.hash = ''; }
  }, true);
  // the rest of the world asks for the same dialog
  ET.unblockUI = (host, { onDone, forceLocked } = {}) => {
    host.innerHTML = ''; const b = document.createElement('button'); b.className = 'go'; b.type = 'button'; b.textContent = forceLocked ? L().ttEmerg : L().ttUnblock;
    b.addEventListener('click', async () => { const st = await ask(forceLocked ? 'emergency' : 'unblock', 'all', ET.protect && ET.protect.len || 5); if (st) { onDone && onDone(5); refresh(); } }); host.append(b);
  };

  /* ---------------------------------------------------------------- the app PIN, in the protection tab */
  function pinCard(root) {
    if (!root || $('#etbPinCard', root)) return;
    const card = document.createElement('div'); card.id = 'etbPinCard'; card.className = 'glass bk-card'; card.style.marginTop = '16px';
    const set = status && status.pinSet;
    card.innerHTML = `<div class="etb-pincard"><div><h3 style="margin:0">${L().pinCard}</h3><p class="s" style="margin:4px 0 0">${L().pinCardD}</p></div><div class="b"></div></div>`;
    const box = $('.b', card);
    const mk = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = fn; box.append(b); };
    const dlg = (old, cb) => {
      const d = dialog(L().pinCard, L().pinNew); let oldI = null; if (old) { oldI = document.createElement('input'); oldI.type = 'password'; oldI.inputMode = 'numeric'; oldI.placeholder = L().pinOld; oldI.style.marginBottom = '10px'; d.body.append(oldI); }
      const nu = document.createElement('input'); nu.type = 'password'; nu.inputMode = 'numeric'; nu.maxLength = 12; nu.placeholder = L().pinNew; d.body.append(nu); setTimeout(() => (oldI || nu).focus(), 120);
      d.row.append(button(L().cancel, '', d.close), button(L().ok, 'go', async () => { const r = await cb(oldI ? oldI.value : null, nu.value); if (r.ok) d.close(); else { d.say(r.code === 'pin' ? L().pinWrong : r.code === 'pin_locked' ? L().pinLocked(Math.ceil((r.data || 0) / 1000)) : r.code === 'locked' ? L().rejected : r.message); d.shake(); } }));
    };
    if (!set) mk(L().pinSet, () => dlg(false, async (o, n) => { const r = await req({ op: 'set_pin', old: null, new: n }); if (r.ok) { ET.toast(L().pinSaved); refresh().then(() => { card.remove(); pinCard(root); }); } return r; }));
    else {
      mk(L().pinChange, () => dlg(true, async (o, n) => { const r = await req({ op: 'set_pin', old: o, new: n }); if (r.ok) ET.toast(L().pinSaved); return r; }));
      mk(L().pinRemove, () => dlg(true, async (o) => { const r = await req({ op: 'set_pin', old: o, new: '' }); if (r.ok) { ET.toast(L().pinGone); refresh().then(() => { card.remove(); pinCard(root); }); } return r; }));
    }
    root.append(card);
  }
  const hookPane = () => {
    const p = ET.rulePanes && ET.rulePanes.protect; if (!p || p.__etb) return; p.__etb = true; let root = null;
    const m0 = p.mount, r0 = p.render; p.mount = (el) => { root = el; const x = m0(el); pinCard(el); return x; }; p.render = () => { const x = r0(); if (root) pinCard(root); return x; };
  };
  hookPane();
  // the partner's code goes to the helper, never into the saved settings
  document.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'pinIn') { const v = e.target.value; clearTimeout(ETB.pt); ETB.pt = setTimeout(async () => { if (v.length >= 4) { const r = await req({ op: 'set_partner_pin', old: ETB.lastPartner || null, new: v }); if (r.ok) { ETB.lastPartner = v; ET.toast(L().partnerSaved); } else if (r.code === 'pin') { const o = await askPin(); if (o) { const r2 = await req({ op: 'set_partner_pin', old: o, new: v }); if (r2.ok) { ETB.lastPartner = v; ET.toast(L().partnerSaved); } } } } }, 700); }
  }, true);
})();
