// EyeTime — widget catalog for the board (all non-built-in widgets). Each widget is registered with
// EyeTimeBoard.register(type, definition, builder(w) -> HTMLElement, settingsSchema).
(function () {
  const B = window.EyeTimeBoard;
  const { el, t, tr, lang, card, head, every, dayKey, fmtDur, save, openSettings, SEARCH_URLS } = B.kit;
  const reg = B.register;

  const mkBtn = (text, onclick, cls = '') => el('button', { class: 'wb-btn ' + cls, type: 'button', text, onclick });
  const pad = (n) => String(n).padStart(2, '0');
  const sendBg = (msg) => { try { chrome.runtime.sendMessage(msg, () => void chrome.runtime.lastError); } catch (e) { } };
  const chime = () => { try { window.EyeTimeAudio && window.EyeTimeAudio.playCompletionChime(); } catch (e) { } };

  // ── Clock ────────────────────────────────────────────────────────────────
  reg('clock', { icon: '🕒', name: 'Часы и приветствие', desc: 'Время, дата и приветствие по имени', w: 4, ph: 2, cfg: { h24: true, seconds: false, name: '', align: 'left' } }, (w) => {
    const time = el('div', { class: 'wb-clock-time' }), date = el('div', { class: 'wb-clock-date' }), hi = el('div', { class: 'wb-clock-hi' });
    const node = card(w, time, date, hi);
    node.style.textAlign = w.cfg.align || 'left';
    every(node, w.cfg.seconds ? 1000 : 10000, () => {
      const d = new Date();
      time.textContent = d.toLocaleTimeString(lang(), { hour: '2-digit', minute: '2-digit', second: w.cfg.seconds ? '2-digit' : undefined, hour12: !w.cfg.h24 });
      date.textContent = d.toLocaleDateString(lang(), { weekday: 'long', day: 'numeric', month: 'long' });
      const h = d.getHours();
      const greet = h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
      hi.textContent = t(greet) + (w.cfg.name ? ', ' + w.cfg.name : '');
    });
    return node;
  }, [
    { key: 'name', type: 'text', label: 'Ваше имя (для приветствия)' },
    { key: 'h24', type: 'checkbox', label: '24-часовой формат' },
    { key: 'seconds', type: 'checkbox', label: 'Показывать секунды' },
    { key: 'align', type: 'select', label: 'Выравнивание', options: [['left', 'Слева'], ['center', 'По центру'], ['right', 'Справа']] }
  ]);

  // ── Time today ───────────────────────────────────────────────────────────
  reg('todaystats', { icon: '📊', name: 'Время за сегодня', desc: 'Экранное время и топ сайтов за день', w: 4, ph: 3 }, (w) => {
    const total = el('div', { class: 'wb-big' }), delta = el('div', { class: 'wb-sub' }), list = el('div', { class: 'wb-bars' });
    const node = card(w, head('📊', 'Время за сегодня'), total, delta, list);
    every(node, 20000, async () => {
      const { stats = {}, settings = {} } = await chrome.storage.local.get(['stats', 'settings']);
      const today = stats[dayKey()] || {}, y = new Date(); y.setDate(y.getDate() - 1);
      const ysec = (stats[dayKey(y)] || {}).totalSeconds || 0, sec = today.totalSeconds || 0;
      total.textContent = fmtDur(sec);
      delta.textContent = ysec ? `${sec >= ysec ? '+' : ''}${Math.round((sec - ysec) / ysec * 100)}% к вчерашнему дню` : 'Нет данных за вчера';
      const top = Object.entries(today.domains || {}).sort((a, b) => b[1] - a[1]).slice(0, 5), max = top[0] ? top[0][1] : 1;
      list.innerHTML = '';
      top.forEach(([d, s]) => list.append(el('div', { class: 'wb-bar-row' },
        el('span', { class: 'wb-bar-name', text: d }),
        el('span', { class: 'wb-bar-track' }, el('span', { class: 'wb-bar-fill' + (window.EyeTimeBlocking && EyeTimeBlocking.isDistraction(d, settings) ? ' bad' : ''), style: `width:${Math.max(4, s / max * 100)}%` })),
        el('span', { class: 'wb-bar-val', text: fmtDur(s) }))));
      if (!top.length) list.append(el('div', { class: 'wb-sub', text: 'Нет активности за сегодня' }));
      tr(node);
    });
    return node;
  });

  // ── Eye rest ─────────────────────────────────────────────────────────────
  reg('eyebreak', { icon: '👁️', name: 'Отдых для глаз', desc: 'Когда следующий перерыв, и кнопка «Сделал»', w: 4, ph: 3 }, (w) => {
    const big = el('div', { class: 'wb-big' }), sub = el('div', { class: 'wb-sub' });
    const btn = mkBtn('✅ Сделал перерыв', null, 'wb-btn-accent');
    const node = card(w, head('👁️', 'Отдых для глаз'), big, sub, btn);
    const refresh = async () => {
      const d = await chrome.storage.local.get(['settings', 'lastEyeRestTime']);
      const s = d.settings || {};
      if (s.notificationsEnabled === false) { big.textContent = '—'; sub.textContent = 'Напоминания выключены'; }
      else {
        const left = Math.max(0, (d.lastEyeRestTime || Date.now()) + (s.eyeRestIntervalMinutes || 20) * 60000 - Date.now());
        big.textContent = Math.ceil(left / 60000) + ' мин';
        sub.textContent = 'до следующего перерыва';
      }
      tr(node);
    };
    every(node, 15000, refresh);
    btn.addEventListener('click', async () => {
      const { stats = {} } = await chrome.storage.local.get(['stats']);
      const k = dayKey();
      const day = stats[k] || (stats[k] = { totalSeconds: 0, domains: {}, desktopApps: {}, breaksCompleted: 0 });
      day.breaksCompleted = (day.breaksCompleted || 0) + 1;
      await chrome.storage.local.set({ stats, lastEyeRestTime: Date.now() });
      refresh();
      B.confetti(btn);
    });
    return node;
  });

  // ── Daily rules ──────────────────────────────────────────────────────────
  reg('rules', { icon: '📜', name: 'Правила дня', desc: 'Ваши правила — по одному на день', w: 4, ph: 2 }, (w) => {
    const text = el('div', { class: 'wb-rule' }), idx = el('div', { class: 'wb-sub' });
    const node = card(w, head('📜', 'Правила дня'), text, idx);
    chrome.storage.local.get(['settings']).then(({ settings = {} }) => {
      const rules = (settings.interceptor && settings.interceptor.dailyRules) || [];
      if (!rules.length) { text.textContent = 'Добавьте правила дня в настройках'; tr(node); return; }
      let i = Math.floor(Date.now() / 86400000) % rules.length;
      const show = () => { text.textContent = '«' + rules[i] + '»'; idx.textContent = `${i + 1} / ${rules.length}`; tr(node); };
      node.append(el('button', { class: 'wb-btn wb-rule-next', text: '↻', title: 'Следующее', onclick: () => { i = (i + 1) % rules.length; show(); } }));
      show();
    });
    return node;
  });

  // ── Quick links ──────────────────────────────────────────────────────────
  reg('quicklinks', { icon: '🔗', name: 'Быстрые ссылки', desc: 'Плитки ваших любимых сайтов', w: 6, ph: 2, multi: true, configure: true, cfg: { title: '', links: [], align: 'left' } }, (w) => {
    const grid = el('div', { class: 'wb-links a-' + (w.cfg.align || 'left') });
    const links = w.cfg.links || [];
    links.forEach(l => {
      let host = '';
      try { host = new URL(l.url).hostname; } catch (e) { return; }
      const hue = [...host].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
      grid.append(el('a', { class: 'wb-link', href: l.url, rel: 'noopener' },
        el('span', { class: 'wb-link-ava', style: `background:hsl(${hue} 60% 45%)`, text: (l.name || host)[0].toUpperCase() }),
        el('span', { class: 'wb-link-name', text: l.name })));
    });
    if (!links.length) grid.append(mkBtn('+ Добавить ссылки', () => openSettings(w)));
    return card(w, w.cfg.title ? head('🔗', w.cfg.title) : null, grid);
  }, [{ key: 'title', type: 'text', label: 'Заголовок' }, { key: 'align', type: 'select', label: 'Выравнивание', options: [['left', 'Слева'], ['center', 'По центру'], ['right', 'Справа']] }, { key: 'links', type: 'links', label: 'Ссылки' }]);

  // ── Notes ────────────────────────────────────────────────────────────────
  reg('notes', { icon: '📝', name: 'Заметки', desc: 'Текстовое поле с автосохранением', w: 4, ph: 3, multi: true, cfg: { title: '', text: '' } }, (w) => {
    const ta = el('textarea', { class: 'wb-notes-ta', rows: 6, placeholder: 'Заметки…', 'aria-label': 'Заметки' });
    ta.value = w.cfg.text || '';
    let timer;
    ta.addEventListener('input', () => { w.cfg.text = ta.value; clearTimeout(timer); timer = setTimeout(save, 400); });
    return card(w, head('📝', w.cfg.title || 'Заметки'), ta);
  }, [{ key: 'title', type: 'text', label: 'Заголовок' }]);

  // ── Search ───────────────────────────────────────────────────────────────
  reg('search', { icon: '🔍', name: 'Поиск', desc: 'Строка поиска в любимой системе', w: 6, ph: 1, multi: true, cfg: { engine: 'duckduckgo' } }, (w) => {
    const input = el('input', { type: 'search', class: 'wb-search-input', placeholder: 'Искать в сети…', 'aria-label': 'Поиск' });
    const form = el('form', { class: 'wb-search', onsubmit: (e) => { e.preventDefault(); const q = input.value.trim(); if (q) location.href = (SEARCH_URLS[w.cfg.engine] || SEARCH_URLS.duckduckgo) + encodeURIComponent(q); } }, el('span', { text: '🔍' }), input);
    return card(w, form);
  }, [{ key: 'engine', type: 'select', label: 'Поисковая система', options: [['duckduckgo', 'DuckDuckGo'], ['google', 'Google'], ['bing', 'Bing'], ['brave', 'Brave'], ['yandex', 'Яндекс']] }]);

  // ── Countdown ────────────────────────────────────────────────────────────
  reg('countdown', { icon: '⏳', name: 'Обратный отсчёт', desc: 'Сколько дней до важной даты', w: 4, ph: 2, multi: true, configure: true, cfg: { title: '', date: '' } }, (w) => {
    const big = el('div', { class: 'wb-big' }), sub = el('div', { class: 'wb-sub' });
    const node = card(w, head('⏳', w.cfg.title || 'Обратный отсчёт'), big, sub);
    every(node, 60000, () => {
      sub.textContent = '';
      if (!w.cfg.date) { big.textContent = '📅'; sub.append(el('div', { text: 'Укажите дату события' }), mkBtn('Выбрать дату', () => openSettings(w))); tr(node); return; }
      const days = Math.round((new Date(w.cfg.date + 'T00:00:00') - new Date(dayKey() + 'T00:00:00')) / 86400000);
      big.textContent = String(Math.abs(days));
      sub.textContent = days === 0 ? 'Сегодня!' : days > 0 ? 'дн. осталось' : 'дн. прошло';
      tr(node);
    });
    return node;
  }, [{ key: 'title', type: 'text', label: 'Название события' }, { key: 'date', type: 'date', label: 'Дата' }]);

  // ── Pomodoro ─────────────────────────────────────────────────────────────
  const PHASES = { work: ['Работа', 'work'], short: ['Короткий перерыв', 'short'], long: ['Длинный перерыв', 'long'] };
  reg('pomodoro', { icon: '🍅', name: 'Помодоро', desc: 'Циклы работы и отдыха с уведомлением', w: 4, ph: 4, cfg: { work: 25, short: 5, long: 15, rounds: 4 } }, (w) => {
    const R = 54, C = 2 * Math.PI * R;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg'); svg.setAttribute('viewBox', '0 0 130 130'); svg.setAttribute('class', 'wb-ring');
    const track = document.createElementNS(svgNS, 'circle'), bar = document.createElementNS(svgNS, 'circle');
    [track, bar].forEach(c => { c.setAttribute('cx', 65); c.setAttribute('cy', 65); c.setAttribute('r', R); c.setAttribute('fill', 'none'); c.setAttribute('stroke-width', 9); });
    track.setAttribute('class', 'wb-ring-track'); bar.setAttribute('class', 'wb-ring-bar'); bar.setAttribute('stroke-linecap', 'round');
    bar.setAttribute('stroke-dasharray', C); bar.setAttribute('transform', 'rotate(-90 65 65)');
    svg.append(track, bar);
    const time = el('div', { class: 'wb-ring-time' }), label = el('div', { class: 'wb-ring-label' });
    const dots = el('div', { class: 'wb-dots' });
    const playBtn = mkBtn('▶', null, 'wb-btn-accent wb-round'), skipBtn = mkBtn('⏭', null, 'wb-round'), resetBtn = mkBtn('↺', null, 'wb-round');
    playBtn.title = 'Старт / пауза'; skipBtn.title = 'Пропустить'; resetBtn.title = 'Сброс';
    const node = card(w, head('🍅', 'Помодоро'), el('div', { class: 'wb-ring-wrap' }, svg, el('div', { class: 'wb-ring-center' }, time, label)), dots, el('div', { class: 'wb-row wb-center' }, resetBtn, playBtn, skipBtn));

    let st = { phase: 'work', round: 1, endTime: 0, remaining: w.cfg.work * 60000, running: false, date: dayKey(), done: 0 };
    const minutes = (ph) => (w.cfg[ph] || 25) * 60000;
    const persist = () => chrome.storage.local.set({ ['pomo_' + w.id]: st });
    const notify = () => {
      if (st.running) sendBg({ action: 'NOTIFY_AT', name: 'pomo_' + w.id, endTime: st.endTime, title: t('🍅 Помодоро'), message: t(st.phase === 'work' ? 'Время отдохнуть!' : 'Пора возвращаться к работе!') });
      else sendBg({ action: 'NOTIFY_CANCEL', name: 'pomo_' + w.id });
    };
    function next(auto) {
      if (st.phase === 'work') {
        if (st.date !== dayKey()) { st.date = dayKey(); st.done = 0; }
        st.done++;
        const long = st.round >= (w.cfg.rounds || 4);
        st.phase = long ? 'long' : 'short'; if (long) st.round = 1; else st.round++;
      } else st.phase = 'work';
      st.remaining = minutes(st.phase); st.running = false; st.endTime = 0;
      if (auto) { chime(); B.confetti(playBtn); }
      persist(); notify(); draw();
    }
    function draw() {
      const left = st.running ? Math.max(0, st.endTime - Date.now()) : st.remaining;
      const total = minutes(st.phase), s = Math.ceil(left / 1000);
      time.textContent = `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
      label.textContent = t(PHASES[st.phase][0]);
      bar.setAttribute('stroke-dashoffset', C * (1 - (1 - left / total)));
      bar.setAttribute('class', 'wb-ring-bar ph-' + st.phase);
      playBtn.textContent = st.running ? '⏸' : '▶';
      dots.textContent = '';
      for (let i = 1; i <= (w.cfg.rounds || 4); i++) dots.append(el('span', { class: 'wb-dot' + (i < st.round || (i === st.round && st.phase !== 'work') ? ' on' : '') + (i === st.round && st.phase === 'work' ? ' cur' : '') }));
      dots.append(el('span', { class: 'wb-sub', text: `  🍅 ${st.date === dayKey() ? st.done : 0}` }));
      tr(node);
    }
    playBtn.addEventListener('click', () => {
      if (st.running) { st.remaining = Math.max(0, st.endTime - Date.now()); st.running = false; }
      else { st.endTime = Date.now() + st.remaining; st.running = true; }
      persist(); notify(); draw();
    });
    skipBtn.addEventListener('click', () => next(false));
    resetBtn.addEventListener('click', () => { st.phase = 'work'; st.round = 1; st.remaining = minutes('work'); st.running = false; persist(); notify(); draw(); });
    chrome.storage.local.get(['pomo_' + w.id]).then(d => {
      if (d['pomo_' + w.id]) st = { ...st, ...d['pomo_' + w.id] };
      if (!st.running && st.remaining <= 0) st.remaining = minutes(st.phase);
      draw();
    });
    every(node, 500, () => { if (st.running && Date.now() >= st.endTime) next(true); else if (st.running) draw(); });
    return node;
  }, [
    { key: 'work', type: 'number', label: 'Работа (мин)', min: 1, max: 180 },
    { key: 'short', type: 'number', label: 'Короткий перерыв (мин)', min: 1, max: 60 },
    { key: 'long', type: 'number', label: 'Длинный перерыв (мин)', min: 1, max: 90 },
    { key: 'rounds', type: 'number', label: 'Циклов до длинного перерыва', min: 2, max: 10 }
  ]);

  // ── Checklist ────────────────────────────────────────────────────────────
  reg('checklist', { icon: '🗒️', name: 'Список дел', desc: 'Свой чек-лист с галочками', w: 4, ph: 3, multi: true, cfg: { title: '', items: [] } }, (w) => {
    const list = el('div', { class: 'wb-checks' }), count = el('span', { class: 'wb-sub' });
    const input = el('input', { class: 'wb-search-input', placeholder: 'Новый пункт… (Enter)', maxlength: 120, 'aria-label': 'Новый пункт' });
    const draw = () => {
      list.textContent = '';
      w.cfg.items.forEach((it, i) => {
        const cb = el('input', { type: 'checkbox', checked: !!it.d, onchange: () => { it.d = cb.checked; save(); draw(); if (w.cfg.items.every(x => x.d) && w.cfg.items.length > 1) B.confetti(cb); } });
        list.append(el('label', { class: 'wb-check-row' + (it.d ? ' done' : '') }, cb, el('span', { text: it.t }),
          el('button', { class: 'wb-x', type: 'button', title: 'Удалить', text: '✕', onclick: (e) => { e.preventDefault(); w.cfg.items.splice(i, 1); save(); draw(); } })));
      });
      count.textContent = w.cfg.items.length ? `${w.cfg.items.filter(x => x.d).length} / ${w.cfg.items.length}` : '';
      if (!w.cfg.items.length) list.append(el('div', { class: 'wb-sub', text: 'Список пуст — добавьте первый пункт' }));
      tr(list);
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && input.value.trim()) { w.cfg.items.push({ t: input.value.trim(), d: false }); input.value = ''; save(); draw(); } });
    const node = card(w, el('div', { class: 'wb-card-head' }, el('span', { class: 'wb-card-ico', text: '🗒️' }), el('span', { class: 'wb-card-title', text: w.cfg.title || 'Список дел' }), count), list, input);
    draw();
    return node;
  }, [{ key: 'title', type: 'text', label: 'Заголовок' }]);

  // ── Quote ────────────────────────────────────────────────────────────────
  const QUOTES = [
    ['Начни с одного шага — остальное подтянется.', 'Start with one step — the rest will follow.'],
    ['Фокус — это умение говорить «нет» хорошим идеям.', 'Focus is the art of saying no to good ideas.'],
    ['Маленький прогресс каждый день лучше большого рывка раз в месяц.', 'Small progress every day beats a big sprint once a month.'],
    ['Сделанное неидеально лучше идеального несделанного.', 'Done imperfectly beats perfect but undone.'],
    ['Внимание — самая дорогая валюта. Тратьте его осознанно.', 'Attention is the most expensive currency. Spend it deliberately.'],
    ['Лента подождёт. Твоя цель — нет.', 'The feed can wait. Your goal cannot.'],
    ['Глубокая работа — это суперсила XXI века.', 'Deep work is a superpower of the 21st century.'],
    ['Отдых — часть работы, а не награда за неё.', 'Rest is part of the work, not a reward for it.'],
    ['Если задача занимает две минуты — сделай её сейчас.', 'If a task takes two minutes, do it now.'],
    ['Скучное сегодня — это успех завтра.', 'The boring things today are tomorrow’s success.'],
    ['Не ищи мотивацию — создай привычку.', 'Don’t chase motivation — build a habit.'],
    ['Одна вкладка — одна мысль.', 'One tab, one thought.'],
    ['Сначала главное, потом всё остальное.', 'First things first, everything else second.'],
    ['Твои глаза тоже устают. Посмотри вдаль.', 'Your eyes get tired too. Look into the distance.'],
    ['Будущий ты скажет спасибо за сегодняшние усилия.', 'Future you will thank you for today’s effort.'],
    ['Тишина — лучший помощник для сложных задач.', 'Silence is the best helper for hard problems.'],
    ['Не сравнивай свой первый шаг с чужим сотым.', 'Don’t compare your first step with someone else’s hundredth.'],
    ['Дисциплина — это забота о будущем себе.', 'Discipline is caring for your future self.'],
    ['Разбей большое на маленькое — и страх исчезнет.', 'Break the big into the small and the fear fades.'],
    ['Лучшее время начать было вчера. Второе лучшее — сейчас.', 'The best time to start was yesterday. The second best is now.']
  ];
  reg('quote', { icon: '💭', name: 'Цитата дня', desc: 'Короткая мысль для настроя', w: 6, ph: 2, cfg: { align: 'left' } }, (w) => {
    const text = el('div', { class: 'wb-quote a-' + (w.cfg.align || 'left') });
    let i = Math.floor(Date.now() / 86400000) % QUOTES.length;
    const show = () => { text.textContent = '“' + QUOTES[i][lang() === 'ru-RU' ? 0 : 1] + '”'; };
    const node = card(w, text, el('button', { class: 'wb-btn wb-rule-next', text: '↻', title: 'Другая', onclick: () => { i = (i + 1) % QUOTES.length; show(); } }));
    show();
    return node;
  }, [{ key: 'align', type: 'select', label: 'Выравнивание', options: [['left', 'Слева'], ['center', 'По центру']] }]);

  // ── Calendar ─────────────────────────────────────────────────────────────
  reg('calendar', { icon: '📅', name: 'Календарь', desc: 'Месяц с выделенным сегодняшним днём', w: 4, ph: 4 }, (w) => {
    let off = 0;
    const title = el('div', { class: 'wb-cal-title' }), grid = el('div', { class: 'wb-cal' });
    const node = card(w, el('div', { class: 'wb-cal-head' }, mkBtn('‹', () => { off--; draw(); }, 'wb-round'), title, mkBtn('›', () => { off++; draw(); }, 'wb-round')), grid);
    function draw() {
      const now = new Date(), d = new Date(now.getFullYear(), now.getMonth() + off, 1);
      title.textContent = d.toLocaleDateString(lang(), { month: 'long', year: 'numeric' });
      grid.textContent = '';
      const mon = new Date(2024, 0, 1); // a Monday
      for (let i = 0; i < 7; i++) { const x = new Date(mon); x.setDate(1 + i); grid.append(el('span', { class: 'wb-cal-dow', text: x.toLocaleDateString(lang(), { weekday: 'short' }) })); }
      const lead = (d.getDay() + 6) % 7, days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      for (let i = 0; i < lead; i++) grid.append(el('span'));
      for (let day = 1; day <= days; day++) {
        const isToday = off === 0 && day === now.getDate();
        grid.append(el('span', { class: 'wb-cal-day' + (isToday ? ' today' : '') + ((d.getDay() + day - 1) % 7 === 0 || (d.getDay() + day - 1) % 7 === 6 ? ' we' : ''), text: String(day) }));
      }
    }
    draw();
    return node;
  });

  // ── Progress (day / week / month / year) ─────────────────────────────────
  reg('progress', { icon: '📆', name: 'Прогресс времени', desc: 'Сколько прошло: день, неделя, месяц, год', w: 4, ph: 3 }, (w) => {
    const list = el('div', { class: 'wb-bars' });
    const node = card(w, head('📆', 'Прогресс времени'), list);
    every(node, 60000, () => {
      const n = new Date();
      const day = (n.getHours() * 60 + n.getMinutes()) / 1440;
      const week = (((n.getDay() + 6) % 7) + day) / 7;
      const dim = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
      const month = (n.getDate() - 1 + day) / dim;
      const yStart = new Date(n.getFullYear(), 0, 1), yEnd = new Date(n.getFullYear() + 1, 0, 1);
      const year = (n - yStart) / (yEnd - yStart);
      list.textContent = '';
      [['День', day], ['Неделя', week], ['Месяц', month], ['Год', year]].forEach(([name, v]) => list.append(el('div', { class: 'wb-bar-row' },
        el('span', { class: 'wb-bar-name', text: name }), el('span', { class: 'wb-bar-track' }, el('span', { class: 'wb-bar-fill acc', style: `width:${Math.max(2, v * 100)}%` })), el('span', { class: 'wb-bar-val', text: Math.round(v * 100) + '%' }))));
      tr(node);
    });
    return node;
  });

  // ── Water ────────────────────────────────────────────────────────────────
  reg('water', { icon: '💧', name: 'Вода', desc: 'Счётчик стаканов воды за день', w: 4, ph: 2, cfg: { goal: 8, count: 0, date: '' } }, (w) => {
    if (w.cfg.date !== dayKey()) { w.cfg.date = dayKey(); w.cfg.count = 0; }
    const row = el('div', { class: 'wb-glasses' }), sub = el('div', { class: 'wb-sub' });
    const node = card(w, head('💧', 'Вода'), row, sub);
    const draw = () => {
      row.textContent = '';
      for (let i = 0; i < w.cfg.goal; i++) row.append(el('button', { class: 'wb-glass' + (i < w.cfg.count ? ' on' : ''), type: 'button', 'aria-label': String(i + 1), text: '💧', onclick: (e) => {
        w.cfg.count = (w.cfg.count === i + 1) ? i : i + 1; save(); draw(); if (w.cfg.count === w.cfg.goal) B.confetti(e.currentTarget);
      } }));
      sub.textContent = `${w.cfg.count} / ${w.cfg.goal}`;
    };
    draw();
    return node;
  }, [{ key: 'goal', type: 'number', label: 'Цель (стаканов в день)', min: 1, max: 16 }]);

  // ── Breathing ────────────────────────────────────────────────────────────
  const PATTERNS = { box: [['Вдох', 4, 1], ['Задержка', 4, 1], ['Выдох', 4, .5], ['Задержка', 4, .5]], '478': [['Вдох', 4, 1], ['Задержка', 7, 1], ['Выдох', 8, .5]], calm: [['Вдох', 5, 1], ['Выдох', 6, .5]] };
  reg('breathing', { icon: '🌬️', name: 'Дыхание', desc: 'Упражнение для спокойствия и отдыха глаз', w: 4, ph: 4, cfg: { pattern: 'box' } }, (w) => {
    const circle = el('div', { class: 'wb-breath' }), label = el('div', { class: 'wb-breath-label', text: 'Готовы?' });
    const btn = mkBtn('Начать', null, 'wb-btn-accent');
    const node = card(w, head('🌬️', 'Дыхание'), el('div', { class: 'wb-breath-stage' }, circle, label), el('div', { class: 'wb-row wb-center' }, btn));
    let timer = null, running = false;
    const run = (step) => {
      if (!running || !node.isConnected) return;
      const p = PATTERNS[w.cfg.pattern] || PATTERNS.box, [name, secs, sc] = p[step % p.length];
      circle.style.transition = `transform ${secs}s ease-in-out`;
      circle.style.transform = `scale(${0.55 + sc * 0.45})`;
      label.textContent = t(name);
      timer = setTimeout(() => run(step + 1), secs * 1000);
    };
    btn.addEventListener('click', () => {
      running = !running;
      clearTimeout(timer);
      if (running) { circle.style.transform = 'scale(.55)'; btn.textContent = t('Стоп'); requestAnimationFrame(() => run(0)); }
      else { circle.style.transition = 'transform .6s ease'; circle.style.transform = 'scale(.75)'; label.textContent = t('Готовы?'); btn.textContent = t('Начать'); }
    });
    circle.style.transform = 'scale(.75)';
    return node;
  }, [{ key: 'pattern', type: 'select', label: 'Ритм', options: [['box', 'Квадратное 4-4-4-4'], ['478', 'Расслабляющее 4-7-8'], ['calm', 'Спокойное 5-6']] }]);

  // ── World clocks ─────────────────────────────────────────────────────────
  reg('worldclocks', { icon: '🌍', name: 'Мировое время', desc: 'Время в разных городах', w: 4, ph: 3, multi: true, configure: true, cfg: { zones: 'Europe/London, America/New_York, Asia/Tokyo' } }, (w) => {
    const list = el('div', { class: 'wb-zones' });
    const node = card(w, head('🌍', 'Мировое время'), list);
    every(node, 10000, () => {
      list.textContent = '';
      const now = new Date();
      String(w.cfg.zones || '').split(',').map(z => z.trim()).filter(Boolean).slice(0, 8).forEach(z => {
        try {
          const f = (opt) => new Intl.DateTimeFormat(lang(), { timeZone: z, ...opt });
          const city = z.split('/').pop().replace(/_/g, ' ');
          list.append(el('div', { class: 'wb-zone' }, el('span', { class: 'wb-zone-city', text: city }), el('span', { class: 'wb-zone-time', text: f({ hour: '2-digit', minute: '2-digit', hour12: false }).format(now) })));
        } catch (e) { list.append(el('div', { class: 'wb-sub', text: z + ' — ?' })); }
      });
      if (!list.children.length) list.append(mkBtn('Выбрать города', () => openSettings(w)));
      tr(node);
    });
    return node;
  }, [{ key: 'zones', type: 'textarea', label: 'Часовые пояса (через запятую)', hint: 'Например: Europe/Moscow, America/New_York, Asia/Tokyo' }]);

  // ── Counter ──────────────────────────────────────────────────────────────
  reg('counter', { icon: '🔢', name: 'Счётчик', desc: 'Любой счётчик с кнопками + и −', w: 4, ph: 2, multi: true, cfg: { title: 'Счётчик', value: 0, step: 1, target: 0 } }, (w) => {
    const big = el('div', { class: 'wb-big' }), sub = el('div', { class: 'wb-sub' });
    const draw = () => { big.textContent = String(w.cfg.value); sub.textContent = w.cfg.target ? `цель: ${w.cfg.target}` : ''; tr(sub); };
    const set = (v) => { w.cfg.value = v; save(); draw(); if (w.cfg.target && v === w.cfg.target) B.confetti(big); };
    const node = card(w, head('🔢', w.cfg.title || 'Счётчик'), big, sub, el('div', { class: 'wb-row' }, mkBtn('−', () => set(w.cfg.value - (w.cfg.step || 1)), 'wb-round'), mkBtn('+', () => set(w.cfg.value + (w.cfg.step || 1)), 'wb-btn-accent wb-round'), mkBtn('↺', () => set(0), 'wb-round')));
    draw();
    return node;
  }, [
    { key: 'title', type: 'text', label: 'Название' },
    { key: 'step', type: 'number', label: 'Шаг', min: 1, max: 1000 },
    { key: 'target', type: 'number', label: 'Цель (0 — без цели)', min: 0, max: 100000 }
  ]);

  // ── Motto ────────────────────────────────────────────────────────────────
  reg('motto', { icon: '🔥', name: 'Девиз', desc: 'Крупная надпись — ваш главный фокус', w: 12, ph: 2, multi: true, configure: true, cfg: { text: 'Фокус.', size: 'l', align: 'center' } }, (w) => {
    return card(w, el('div', { class: `wb-motto s-${w.cfg.size} a-${w.cfg.align}`, text: w.cfg.text || 'Фокус.' }));
  }, [
    { key: 'text', type: 'textarea', label: 'Текст' },
    { key: 'size', type: 'select', label: 'Размер', options: [['m', 'Средний'], ['l', 'Большой'], ['xl', 'Огромный']] },
    { key: 'align', type: 'select', label: 'Выравнивание', options: [['left', 'Слева'], ['center', 'По центру'], ['right', 'Справа']] }
  ]);


  // ── Optional-permission helpers ──────────────────────────────────────────
  const hasPerm = (q) => new Promise(res => { try { chrome.permissions.contains(q, ok => res(!!ok)); } catch (e) { res(false); } });
  const askPerm = (q) => new Promise(res => { try { chrome.permissions.request(q, ok => res(!!ok)); } catch (e) { res(false); } });
  const tile = (name, url) => {
    let host = '';
    try { host = new URL(url).hostname; } catch (e) { return null; }
    const hue = [...host].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
    return el('a', { class: 'wb-link', href: url, rel: 'noopener', title: url },
      el('span', { class: 'wb-link-ava', style: `background:hsl(${hue} 60% 45%)`, text: (name || host)[0].toUpperCase() }),
      el('span', { class: 'wb-link-name', text: name || host.replace(/^www\./, '') }));
  };
  // Card that asks for an optional permission first, then renders `draw(container)`
  function permissionCard(w, icon, title, perm, why, draw) {
    const body = el('div', { class: 'wb-perm-body' });
    const node = card(w, head(icon, title), body);
    const show = async () => {
      body.textContent = '';
      if (await hasPerm(perm)) { try { await draw(body, show); } catch (e) { body.append(el('div', { class: 'wb-sub', text: 'Не удалось загрузить данные' })); } }
      else body.append(el('div', { class: 'wb-sub', text: why }), mkBtn('Разрешить доступ', async () => { if (await askPerm(perm)) show(); }, 'wb-btn-accent'));
      tr(node);
    };
    show();
    return node;
  }

  // ── Most visited sites ───────────────────────────────────────────────────
  reg('topsites', { icon: '⭐', name: 'Часто посещаемые', desc: 'Плитки ваших самых частых сайтов', w: 6, ph: 2, cfg: { count: 8 } }, (w) =>
    permissionCard(w, '⭐', 'Часто посещаемые', { permissions: ['topSites'] }, 'Нужен доступ к списку часто посещаемых сайтов. Данные остаются в браузере.', (body) => new Promise(res => {
      chrome.topSites.get(list => {
        const grid = el('div', { class: 'wb-links' });
        (list || []).slice(0, w.cfg.count || 8).forEach(s => { const t2 = tile(s.title, s.url); if (t2) grid.append(t2); });
        if (!grid.children.length) grid.append(el('div', { class: 'wb-sub', text: 'Пока нет данных — откройте несколько сайтов' }));
        body.append(grid); res();
      });
    })), [{ key: 'count', type: 'number', label: 'Сколько сайтов показывать', min: 2, max: 20 }]);

  // ── Bookmarks ────────────────────────────────────────────────────────────
  reg('bookmarks', { icon: '🔖', name: 'Закладки', desc: 'Панель закладок или недавно добавленные', w: 6, ph: 2, multi: true, cfg: { source: 'bar', count: 10 } }, (w) =>
    permissionCard(w, '🔖', w.cfg.source === 'recent' ? 'Недавние закладки' : 'Закладки', { permissions: ['bookmarks'] }, 'Нужен доступ к вашим закладкам. Данные остаются в браузере.', async (body) => {
      const flatten = (nodes) => nodes.flatMap(n => n.children ? flatten(n.children) : (n.url ? [n] : []));
      let items;
      if (w.cfg.source === 'recent') items = await chrome.bookmarks.getRecent(w.cfg.count || 10);
      else { const tree = await chrome.bookmarks.getTree(); const bar = tree[0].children[0]; items = (bar.children || []).filter(n => n.url).concat(flatten((bar.children || []).filter(n => n.children))); }
      const grid = el('div', { class: 'wb-links' });
      items.slice(0, w.cfg.count || 10).forEach(b => { const t2 = tile(b.title, b.url); if (t2) grid.append(t2); });
      if (!grid.children.length) grid.append(el('div', { class: 'wb-sub', text: 'Закладок пока нет' }));
      body.append(grid);
    }), [
    { key: 'source', type: 'select', label: 'Что показывать', options: [['bar', 'Панель закладок'], ['recent', 'Недавно добавленные']] },
    { key: 'count', type: 'number', label: 'Сколько закладок показывать', min: 2, max: 30 }
  ]);

  // ── Weather (Open-Meteo, opt-in) ─────────────────────────────────────────
  const WMO = (c) => c === 0 ? ['☀️', 'Ясно'] : c <= 2 ? ['🌤️', 'Переменная облачность'] : c === 3 ? ['☁️', 'Пасмурно'] : c <= 48 ? ['🌫️', 'Туман'] : c <= 57 ? ['🌦️', 'Морось'] : c <= 67 ? ['🌧️', 'Дождь'] : c <= 77 ? ['❄️', 'Снег'] : c <= 82 ? ['🌧️', 'Ливень'] : c <= 86 ? ['🌨️', 'Снегопад'] : ['⛈️', 'Гроза'];
  const WEATHER_PERM = { origins: ['https://api.open-meteo.com/*', 'https://geocoding-api.open-meteo.com/*'] };
  reg('weather', { icon: '🌤️', name: 'Погода', desc: 'Текущая погода и прогноз на день (Open-Meteo)', w: 4, ph: 3, multi: true, configure: true, cfg: { city: '', unit: 'c', geo: null, cache: null } }, (w) =>
    permissionCard(w, '🌤️', 'Погода', WEATHER_PERM, 'Погода загружается с сервиса Open-Meteo: туда отправляется только название вашего города. Включайте, если согласны.', async (body, again) => {
      if (!w.cfg.city) { body.append(el('div', { class: 'wb-sub', text: 'Укажите город в настройках виджета' }), mkBtn('Выбрать город', () => openSettings(w))); return; }
      if (!w.cfg.geo || w.cfg.geo.q !== w.cfg.city) {
        const r = await (await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' + encodeURIComponent(w.cfg.city) + '&language=' + (lang() === 'ru-RU' ? 'ru' : 'en'))).json();
        const g = r.results && r.results[0];
        if (!g) { body.append(el('div', { class: 'wb-sub', text: 'Город не найден' }), mkBtn('Выбрать город', () => openSettings(w))); return; }
        w.cfg.geo = { q: w.cfg.city, lat: g.latitude, lon: g.longitude, name: g.name, country: g.country || '' }; w.cfg.cache = null; save();
      }
      const g = w.cfg.geo, key = g.lat + ',' + g.lon + w.cfg.unit;
      if (!w.cfg.cache || w.cfg.cache.key !== key || Date.now() - w.cfg.cache.ts > 15 * 60000) {
        const u = `https://api.open-meteo.com/v1/forecast?latitude=${g.lat}&longitude=${g.lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto&temperature_unit=${w.cfg.unit === 'f' ? 'fahrenheit' : 'celsius'}`;
        w.cfg.cache = { key, ts: Date.now(), data: await (await fetch(u)).json() }; save();
      }
      const d = w.cfg.cache.data, c = d.current, [emoji, text] = WMO(c.weather_code), deg = w.cfg.unit === 'f' ? '°F' : '°C';
      body.append(
        el('div', { class: 'wb-weather-main' }, el('span', { class: 'wb-weather-emoji', text: emoji }), el('span', { class: 'wb-big', text: Math.round(c.temperature_2m) + '°' })),
        el('div', { class: 'wb-weather-text', text }),
        el('div', { class: 'wb-sub', text: `${g.name}${g.country ? ', ' + g.country : ''}` }),
        el('div', { class: 'wb-sub', text: `↑ ${Math.round(d.daily.temperature_2m_max[0])}${deg}  ↓ ${Math.round(d.daily.temperature_2m_min[0])}${deg}  · 💨 ${Math.round(c.wind_speed_10m)} km/h` }));
    }), [
    { key: 'city', type: 'text', label: 'Город' },
    { key: 'unit', type: 'select', label: 'Единицы', options: [['c', '°C'], ['f', '°F']] }
  ]);

  // ── Stopwatch ────────────────────────────────────────────────────────────
  reg('stopwatch', { icon: '⏲️', name: 'Секундомер', desc: 'Засеките время любого дела', w: 4, ph: 2, multi: true, cfg: { running: false, startedAt: 0, elapsed: 0 } }, (w) => {
    const big = el('div', { class: 'wb-big wb-mono' });
    const go = mkBtn('▶', null, 'wb-btn-accent wb-round'), rs = mkBtn('↺', null, 'wb-round');
    go.title = 'Старт / стоп'; rs.title = 'Сброс';
    const node = card(w, head('⏲️', 'Секундомер'), big, el('div', { class: 'wb-row' }, rs, go));
    const ms = () => w.cfg.elapsed + (w.cfg.running ? Date.now() - w.cfg.startedAt : 0);
    const draw = () => { const s = Math.floor(ms() / 1000); big.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; go.textContent = w.cfg.running ? '⏸' : '▶'; };
    go.addEventListener('click', () => { if (w.cfg.running) { w.cfg.elapsed = ms(); w.cfg.running = false; } else { w.cfg.startedAt = Date.now(); w.cfg.running = true; } save(); draw(); });
    rs.addEventListener('click', () => { w.cfg.elapsed = 0; w.cfg.running = false; save(); draw(); });
    every(node, 250, draw);
    return node;
  });
})();
