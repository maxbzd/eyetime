// EyeTime — Widget board: build the new tab like a constructor.
// Layout lives in chrome.storage.local.newtabLayout = { v, theme, widgets: [{ id, type, w, cfg }] }.
// Built-in widgets are existing DOM cards kept in #widgetBank and moved onto the board; new widget types are
// rendered here. Widths are 12-column spans; heights are automatic (masonry via grid row spans).
(function () {
  const ROW = 8;            // grid-auto-rows unit (px)
  const GAP = 16;           // gap between widgets (px)
  const WIDTHS = [[3, 'S'], [4, 'M'], [6, 'L'], [8, 'XL'], [12, '▭']];
  const KEY = 'newtabLayout';

  const t = (s) => (window.EyeTimeI18n ? window.EyeTimeI18n.t(s) : s);
  const lang = () => (window.EyeTimeI18n && window.EyeTimeI18n.lang === 'ru') ? 'ru-RU' : 'en-US';
  const $ = (sel, root = document) => root.querySelector(sel);

  function el(tag, props, ...kids) {
    const n = document.createElement(tag);
    if (props) Object.entries(props).forEach(([k, v]) => {
      if (k === 'class') n.className = v;
      else if (k === 'style') n.style.cssText = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v === true ? '' : v);
    });
    kids.flat().forEach(k => k != null && n.append(k.nodeType ? k : document.createTextNode(k)));
    return n;
  }

  // ── Catalog ──────────────────────────────────────────────────────────────
  const CATALOG = {
    focus:     { icon: '⏱️', name: 'Фокус-Блок',          desc: 'Таймер глубокой работы с блокировкой отвлечений', builtin: true, w: 4 },
    leaks:     { icon: '🚰', name: 'Анти-слив',            desc: 'Сколько времени утекло на отвлекающие сайты', builtin: true, w: 4 },
    habits:    { icon: '✅', name: 'Привычки',             desc: 'Ежедневные привычки, стрик и челлендж', builtin: true, w: 4 },
    tasks:     { icon: '☑️', name: 'Задачи дня',           desc: 'Список задач с синхронизацией TickTick', builtin: true, w: 6 },
    thoughts:  { icon: '🧠', name: 'Парковка мыслей',      desc: 'Быстрые заметки, чтобы не отвлекаться', builtin: true, w: 6 },
    goals:     { icon: '🎯', name: 'Цели',                 desc: 'Счётчики целей на день', builtin: true, w: 6 },
    chart:     { icon: '📈', name: 'Дневной фокус',        desc: 'График активности за неделю', builtin: true, w: 6 },
    clock:     { icon: '🕒', name: 'Часы и приветствие',   desc: 'Время, дата и приветствие по имени', w: 4, cfg: { h24: true, seconds: false, name: '' } },
    todaystats:{ icon: '📊', name: 'Время за сегодня',     desc: 'Экранное время и топ сайтов за день', w: 4 },
    eyebreak:  { icon: '👁️', name: 'Отдых для глаз',       desc: 'Когда следующий перерыв, и кнопка «Сделал»', w: 4 },
    rules:     { icon: '📜', name: 'Правила дня',          desc: 'Ваши правила — по одному на день', w: 4 },
    quicklinks:{ icon: '🔗', name: 'Быстрые ссылки',       desc: 'Плитки ваших любимых сайтов', w: 6, multi: true, cfg: { title: '', links: [] } },
    notes:     { icon: '📝', name: 'Заметки',              desc: 'Текстовое поле с автосохранением', w: 4, multi: true, cfg: { title: '', text: '' } },
    search:    { icon: '🔍', name: 'Поиск',                desc: 'Строка поиска в любимой системе', w: 6, multi: true, cfg: { engine: 'duckduckgo' } },
    countdown: { icon: '⏳', name: 'Обратный отсчёт',      desc: 'Сколько дней до важной даты', w: 4, multi: true, cfg: { title: '', date: '' } }
  };

  // Settings forms for configurable widgets
  const SCHEMA = {
    clock: [
      { key: 'name', type: 'text', label: 'Ваше имя (для приветствия)' },
      { key: 'h24', type: 'checkbox', label: '24-часовой формат' },
      { key: 'seconds', type: 'checkbox', label: 'Показывать секунды' }
    ],
    search: [{ key: 'engine', type: 'select', label: 'Поисковая система', options: [['duckduckgo', 'DuckDuckGo'], ['google', 'Google'], ['bing', 'Bing'], ['brave', 'Brave'], ['yandex', 'Яндекс']] }],
    countdown: [
      { key: 'title', type: 'text', label: 'Название события' },
      { key: 'date', type: 'date', label: 'Дата' }
    ],
    notes: [{ key: 'title', type: 'text', label: 'Заголовок' }],
    quicklinks: [
      { key: 'title', type: 'text', label: 'Заголовок' },
      { key: 'links', type: 'links', label: 'Ссылки' }
    ]
  };

  const SEARCH_URLS = {
    duckduckgo: 'https://duckduckgo.com/?q=', google: 'https://www.google.com/search?q=', bing: 'https://www.bing.com/search?q=',
    brave: 'https://search.brave.com/search?q=', yandex: 'https://yandex.com/search/?text='
  };

  const DEFAULT_THEME = { accent: '#FF5E0E', bg: 'glow', density: 'comfortable', cards: 'glass', anim: true };
  const DEFAULT_LAYOUT = () => ({
    v: 1, theme: { ...DEFAULT_THEME },
    widgets: [
      ['focus', 4], ['leaks', 4], ['habits', 4], ['tasks', 6], ['thoughts', 6], ['goals', 6], ['chart', 6]
    ].map(([type, w]) => ({ id: type, type, w, cfg: {} }))
  });

  const ACCENTS = ['#FF5E0E', '#EF4444', '#EC4899', '#A855F7', '#6366F1', '#3B82F6', '#14B8A6', '#34D399', '#F59E0B'];
  const BACKGROUNDS = [['glow', 'Свечение'], ['aurora', 'Аврора (анимация)'], ['midnight', 'Полночь'], ['grid', 'Сетка']];

  let layout = null, editing = false, board = null, dock = null, ro = null, saveTimer = null;
  let first = true;

  const uid = () => 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  async function load() {
    const d = await chrome.storage.local.get([KEY]);
    let l = d[KEY];
    if (!l || !Array.isArray(l.widgets)) l = DEFAULT_LAYOUT();
    l.theme = { ...DEFAULT_THEME, ...(l.theme || {}) };
    // drop unknown types, keep unique built-ins unique
    const seen = new Set();
    l.widgets = l.widgets.filter(w => CATALOG[w.type] && (CATALOG[w.type].multi || !seen.has(w.type)) && seen.add(w.type));
    l.widgets.forEach(w => { w.id = w.id || uid(); w.cfg = { ...(CATALOG[w.type].cfg ? clone(CATALOG[w.type].cfg) : {}), ...(w.cfg || {}) }; });
    return l;
  }

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => chrome.storage.local.set({ [KEY]: layout }), 150);
  }

  // ── Theme ────────────────────────────────────────────────────────────────
  function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '255, 94, 14';
    const n = parseInt(m[1], 16);
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  }

  function applyTheme() {
    const th = layout.theme, root = document.documentElement.style;
    root.setProperty('--fx-orange', th.accent);
    root.setProperty('--fx-accent-rgb', hexToRgb(th.accent));
    document.body.classList.toggle('theme-compact', th.density === 'compact');
    document.body.classList.toggle('cards-flat', th.cards === 'flat');
    document.body.classList.toggle('no-anim', !th.anim);
    ['glow', 'aurora', 'midnight', 'grid'].forEach(b => document.body.classList.toggle('bg-' + b, th.bg === b));
  }

  // ── Board rendering ──────────────────────────────────────────────────────
  function builtinEl(type) { return document.querySelector(`[data-widget="${type}"]`); }

  function updateSpan(wrap) {
    const inner = wrap.firstElementChild;
    if (!inner) return;
    const top = parseFloat(getComputedStyle(wrap).paddingTop) || 0;
    wrap.style.gridRowEnd = 'span ' + Math.max(1, Math.ceil((inner.offsetHeight + top + GAP) / ROW));
  }

  function render() {
    // return built-ins to the bank, then place them again
    Object.keys(CATALOG).filter(k => CATALOG[k].builtin).forEach(k => {
      const e = builtinEl(k);
      if (e) $('#widgetBank').append(e);
    });
    if (ro) ro.disconnect();
    ro = new ResizeObserver(entries => entries.forEach(en => updateSpan(en.target.parentElement)));
    board.innerHTML = '';

    layout.widgets.forEach((w, i) => {
      const def = CATALOG[w.type];
      const content = def.builtin ? builtinEl(w.type) : buildWidget(w);
      if (!content) return;
      content.classList.add('wb-content');
      const wrap = el('div', { class: 'wb-widget' + (first ? ' wb-enter' : ''), 'data-id': w.id, style: `grid-column: span ${w.w}; --i:${i}` });
      wrap.append(content, toolbar(w));
      board.append(wrap);
      ro.observe(content);
      updateSpan(wrap);
    });
    first = false;
    if (!layout.widgets.length) board.append(el('div', { class: 'wb-empty' }, el('p', { text: 'Здесь пока пусто.' }), el('button', { class: 'wb-btn wb-btn-accent', text: '+ Добавить виджет', onclick: openGallery })));
    if (window.EyeTimeI18n) window.EyeTimeI18n.translateTree(board);
  }

  function toolbar(w) {
    const def = CATALOG[w.type];
    const idx = () => layout.widgets.findIndex(x => x.id === w.id);
    const bar = el('div', { class: 'wb-toolbar', onpointerdown: (e) => e.stopPropagation() });
    const handle = el('span', { class: 'wb-handle', title: 'Перетащить', text: '⠿' });
    handle.addEventListener('pointerdown', () => { handle.closest('.wb-widget').draggable = true; });
    bar.append(...[handle,
      el('span', { class: 'wb-title', text: def.name }),
      el('button', { class: 'wb-ico', title: 'Раньше', text: '←', onclick: () => move(idx(), -1) }),
      el('button', { class: 'wb-ico', title: 'Позже', text: '→', onclick: () => move(idx(), 1) }),
      el('span', { class: 'wb-sizes' }, WIDTHS.map(([cols, label]) =>
        el('button', { class: 'wb-size' + (w.w === cols ? ' on' : ''), title: `${cols}/12`, text: label, onclick: () => { w.w = cols; save(); render(); } }))),
      SCHEMA[w.type] ? el('button', { class: 'wb-ico', title: 'Настройки виджета', text: '⚙', onclick: () => openSettings(w) }) : null,
      el('button', { class: 'wb-ico wb-del', title: 'Удалить виджет', text: '✕', onclick: () => removeWidget(w) })].filter(Boolean));
    return bar;
  }

  function flip(mutate) {
    const rects = new Map([...board.children].map(c => [c, c.getBoundingClientRect()]));
    mutate();
    if (!layout.theme.anim) return;
    [...board.children].forEach(c => {
      const a = rects.get(c); if (!a) return;
      const b = c.getBoundingClientRect();
      const dx = a.left - b.left, dy = a.top - b.top;
      if (!dx && !dy) return;
      c.style.transition = 'none';
      c.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        c.style.transition = 'transform .35s cubic-bezier(.16,1,.3,1)';
        c.style.transform = '';
        setTimeout(() => { c.style.transition = ''; }, 400);
      });
    });
  }

  function move(i, delta) {
    const j = i + delta;
    if (j < 0 || j >= layout.widgets.length) return;
    flip(() => {
      const [w] = layout.widgets.splice(i, 1);
      layout.widgets.splice(j, 0, w);
      const wraps = [...board.children];
      const [node] = wraps.splice(i, 1);
      wraps.splice(j, 0, node);
      wraps.forEach(n => board.append(n));
      board.querySelectorAll('.wb-widget').forEach((n, k) => n.style.setProperty('--i', k));
    });
    save();
  }

  function removeWidget(w) {
    const wrap = board.querySelector(`[data-id="${w.id}"]`);
    const done = () => { layout.widgets = layout.widgets.filter(x => x.id !== w.id); save(); render(); };
    if (wrap && layout.theme.anim) { wrap.classList.add('wb-leaving'); setTimeout(done, 220); } else done();
  }

  function addWidget(type) {
    const def = CATALOG[type];
    if (!def.multi && layout.widgets.some(w => w.type === type)) return null;
    const w = { id: def.builtin ? type : uid(), type, w: def.w, cfg: def.cfg ? clone(def.cfg) : {} };
    layout.widgets.push(w);
    save(); render();
    const wrap = board.querySelector(`[data-id="${w.id}"]`);
    if (wrap) { wrap.scrollIntoView({ behavior: 'smooth', block: 'center' }); wrap.classList.add('wb-flash'); }
    if (SCHEMA[type] && ['countdown', 'quicklinks'].includes(type)) openSettings(w);
    return w;
  }

  // ── Drag & drop reorder ──────────────────────────────────────────────────
  function initDnD() {
    let dragging = null;
    board.addEventListener('dragstart', (e) => {
      const wrap = e.target.closest && e.target.closest('.wb-widget');
      if (!editing || !wrap || wrap !== e.target) { e.preventDefault(); return; }
      dragging = wrap;
      wrap.classList.add('wb-dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', wrap.dataset.id); } catch (err) { }
    });
    board.addEventListener('dragover', (e) => {
      if (!dragging) return;
      e.preventDefault();
      const over = e.target.closest && e.target.closest('.wb-widget');
      if (!over || over === dragging) return;
      const r = over.getBoundingClientRect();
      const after = (over.style.gridColumn.includes('12') || r.width > r.height * 1.6)
        ? e.clientY > r.top + r.height / 2
        : e.clientX > r.left + r.width / 2;
      const ref = after ? over.nextElementSibling : over;
      if (ref === dragging || ref === dragging.nextElementSibling && !after) return;
      flip(() => board.insertBefore(dragging, ref));
    });
    const finish = () => {
      if (!dragging) return;
      dragging.classList.remove('wb-dragging');
      dragging.draggable = false;
      const order = [...board.children].map(n => n.dataset.id);
      layout.widgets.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      board.querySelectorAll('.wb-widget').forEach((n, k) => n.style.setProperty('--i', k));
      dragging = null;
      save();
    };
    board.addEventListener('drop', (e) => { e.preventDefault(); finish(); });
    board.addEventListener('dragend', finish);
    document.addEventListener('pointerup', () => board.querySelectorAll('.wb-widget[draggable="true"]').forEach(n => { if (!n.classList.contains('wb-dragging')) n.draggable = false; }));
  }

  // ── Edit mode, dock, gallery, settings, theme panel ──────────────────────
  function setEditing(on) {
    editing = on;
    document.body.classList.toggle('wb-editing', on);
    dock.classList.toggle('open', on);
    editBtn.classList.toggle('on', on);
    board.querySelectorAll('.wb-widget').forEach(n => { n.draggable = false; });
    if (!on) closePanels();
    requestAnimationFrame(() => board.querySelectorAll('.wb-widget').forEach(updateSpan));
  }

  let editBtn = null, overlay = null;

  function closePanels() { if (overlay) { overlay.remove(); overlay = null; } }

  function openPanel(title, body, wide) {
    closePanels();
    overlay = el('div', { class: 'wb-overlay', onclick: (e) => { if (e.target === overlay) closePanels(); } },
      el('div', { class: 'wb-panel' + (wide ? ' wide' : ''), role: 'dialog', 'aria-label': title },
        el('div', { class: 'wb-panel-head' }, el('h3', { text: title }), el('button', { class: 'wb-ico', text: '✕', title: 'Закрыть', onclick: closePanels })),
        body));
    document.body.append(overlay);
    if (window.EyeTimeI18n) window.EyeTimeI18n.translateTree(overlay);
    return overlay;
  }

  function openGallery() {
    const grid = el('div', { class: 'wb-gallery' });
    Object.entries(CATALOG).forEach(([type, def]) => {
      const used = !def.multi && layout.widgets.some(w => w.type === type);
      grid.append(el('button', {
        class: 'wb-gal-item', disabled: used,
        onclick: () => { addWidget(type); closePanels(); }
      }, el('span', { class: 'wb-gal-ico', text: def.icon }), el('span', { class: 'wb-gal-name', text: def.name }),
        el('span', { class: 'wb-gal-desc', text: def.desc }), el('span', { class: 'wb-gal-tag', text: used ? 'Уже на экране' : '+ Добавить' })));
    });
    openPanel('Добавить виджет', grid, true);
  }

  function openSettings(w) {
    const def = CATALOG[w.type];
    const form = el('div', { class: 'wb-form' });
    SCHEMA[w.type].forEach(f => {
      const id = 'wbf-' + f.key;
      const row = el('label', { class: 'wb-field', for: id }, el('span', { text: f.label }));
      let input;
      if (f.type === 'select') {
        input = el('select', { id }, f.options.map(([v, l]) => el('option', { value: v, text: l, selected: w.cfg[f.key] === v })));
        input.addEventListener('change', () => { w.cfg[f.key] = input.value; save(); render(); });
      } else if (f.type === 'checkbox') {
        input = el('input', { id, type: 'checkbox', checked: !!w.cfg[f.key] });
        input.addEventListener('change', () => { w.cfg[f.key] = input.checked; save(); render(); });
      } else if (f.type === 'links') {
        input = linksEditor(w);
      } else {
        input = el('input', { id, type: f.type, value: w.cfg[f.key] || '', maxlength: 60 });
        input.addEventListener('change', () => { w.cfg[f.key] = input.value.trim(); save(); render(); });
      }
      row.append(input);
      form.append(row);
    });
    openPanel(def.name, form);
  }

  function linksEditor(w) {
    const box = el('div', { class: 'wb-links-editor' });
    const draw = () => {
      box.innerHTML = '';
      w.cfg.links.forEach((l, i) => box.append(el('div', { class: 'wb-link-row' },
        el('input', { value: l.name, maxlength: 24, 'aria-label': 'Название', onchange: (e) => { l.name = e.target.value.trim() || l.name; save(); render(); } }),
        el('input', { value: l.url, 'aria-label': 'URL', onchange: (e) => { l.url = normUrl(e.target.value) || l.url; e.target.value = l.url; save(); render(); } }),
        el('button', { class: 'wb-ico', type: 'button', text: '✕', title: 'Удалить', onclick: () => { w.cfg.links.splice(i, 1); save(); draw(); render(); } }))));
      const name = el('input', { placeholder: 'Название', maxlength: 24 }), url = el('input', { placeholder: 'https://…' });
      const add = () => {
        const u = normUrl(url.value);
        if (!u) return;
        w.cfg.links.push({ name: name.value.trim() || new URL(u).hostname.replace(/^www\./, ''), url: u });
        save(); draw(); render();
      };
      box.append(el('div', { class: 'wb-link-row' }, name, url, el('button', { class: 'wb-btn', type: 'button', text: 'Добавить', onclick: add })));
    };
    draw();
    return box;
  }

  function normUrl(v) {
    v = (v || '').trim();
    if (!v) return '';
    if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
    try { return new URL(v).href; } catch (e) { return ''; }
  }

  function openTheme() {
    const th = layout.theme;
    const apply = () => { applyTheme(); save(); };
    const swatches = el('div', { class: 'wb-swatches' }, ACCENTS.map(c => el('button', {
      class: 'wb-swatch' + (th.accent.toLowerCase() === c.toLowerCase() ? ' on' : ''), style: `background:${c}`, title: c,
      onclick: (e) => { th.accent = c; swatches.querySelectorAll('.wb-swatch').forEach(s => s.classList.remove('on')); e.target.classList.add('on'); custom.value = c; apply(); }
    })));
    const custom = el('input', { type: 'color', value: th.accent, 'aria-label': 'Свой цвет', oninput: (e) => { th.accent = e.target.value; swatches.querySelectorAll('.wb-swatch').forEach(s => s.classList.remove('on')); apply(); } });
    const seg = (key, opts) => el('div', { class: 'wb-seg' }, opts.map(([v, l]) => el('button', {
      class: th[key] === v ? 'on' : '', text: l,
      onclick: (e) => { th[key] = v; e.target.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('on')); e.target.classList.add('on'); apply(); render(); }
    })));
    const anim = el('input', { type: 'checkbox', checked: th.anim, onchange: (e) => { th.anim = e.target.checked; apply(); } });
    openPanel('Оформление', el('div', { class: 'wb-form' },
      el('div', { class: 'wb-field' }, el('span', { text: 'Акцентный цвет' }), el('div', { class: 'wb-row' }, swatches, custom)),
      el('div', { class: 'wb-field' }, el('span', { text: 'Фон' }), seg('bg', BACKGROUNDS)),
      el('div', { class: 'wb-field' }, el('span', { text: 'Плотность' }), seg('density', [['comfortable', 'Свободно'], ['compact', 'Компактно']])),
      el('div', { class: 'wb-field' }, el('span', { text: 'Стиль карточек' }), seg('cards', [['glass', 'Стекло'], ['flat', 'Плоские']])),
      el('label', { class: 'wb-field wb-check' }, anim, el('span', { text: 'Анимации' }))));
  }

  function resetLayout() {
    if (!confirm('Вернуть расположение и оформление по умолчанию? Данные виджетов (заметки, ссылки) будут удалены.')) return;
    layout = DEFAULT_LAYOUT();
    save(); applyTheme(); render();
  }

  function buildChrome() {
    editBtn = el('button', { class: 'header-action-btn wb-edit-btn', title: 'Настроить экран', onclick: () => setEditing(!editing) },
      el('span', { text: '✏️' }), el('span', { text: 'Настроить' }));
    const actions = $('.header-actions');
    if (actions) actions.prepend(editBtn);

    dock = el('div', { class: 'wb-dock', role: 'toolbar', 'aria-label': 'Настройка экрана' },
      el('button', { class: 'wb-btn wb-btn-accent', text: '+ Виджет', onclick: openGallery }),
      el('button', { class: 'wb-btn', text: '🎨 Оформление', onclick: openTheme }),
      el('button', { class: 'wb-btn', text: '↺ Сбросить', onclick: resetLayout }),
      el('button', { class: 'wb-btn wb-btn-done', text: '✓ Готово', onclick: () => setEditing(false) }));
    document.body.append(dock);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { if (overlay) closePanels(); else if (editing) setEditing(false); }
    });
  }

  // ── Widget implementations ───────────────────────────────────────────────
  function card(w, ...kids) { return el('section', { class: 'fintrixity-card wb-card wb-' + w.type }, ...kids); }
  function head(icon, title) { return el('div', { class: 'wb-card-head' }, el('span', { class: 'wb-card-ico', text: icon }), el('span', { class: 'wb-card-title', text: title })); }

  const fmtDur = (sec) => { const m = Math.round(sec / 60); return m >= 60 ? `${Math.floor(m / 60)}ч ${m % 60}м` : `${m}м`; };
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const every = (node, ms, fn) => { fn(); const id = setInterval(() => { if (!node.isConnected) clearInterval(id); else fn(); }, ms); };

  function buildWidget(w) {
    return ({ clock: wClock, quicklinks: wLinks, notes: wNotes, todaystats: wStats, rules: wRules, search: wSearch, countdown: wCountdown, eyebreak: wEyebreak })[w.type](w);
  }

  function wClock(w) {
    const time = el('div', { class: 'wb-clock-time' }), date = el('div', { class: 'wb-clock-date' }), hi = el('div', { class: 'wb-clock-hi' });
    const node = card(w, time, date, hi);
    every(node, w.cfg.seconds ? 1000 : 10000, () => {
      const d = new Date();
      time.textContent = d.toLocaleTimeString(lang(), { hour: '2-digit', minute: '2-digit', second: w.cfg.seconds ? '2-digit' : undefined, hour12: !w.cfg.h24 });
      date.textContent = d.toLocaleDateString(lang(), { weekday: 'long', day: 'numeric', month: 'long' });
      const h = d.getHours();
      const greet = h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
      hi.textContent = '';
      hi.append(document.createTextNode(t(greet)));
      if (w.cfg.name) hi.append(document.createTextNode(', ' + w.cfg.name));
    });
    return node;
  }

  function wLinks(w) {
    const grid = el('div', { class: 'wb-links' });
    const links = w.cfg.links || [];
    links.forEach(l => {
      let host = '';
      try { host = new URL(l.url).hostname; } catch (e) { return; }
      const hue = [...host].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
      grid.append(el('a', { class: 'wb-link', href: l.url, rel: 'noopener' },
        el('span', { class: 'wb-link-ava', style: `background:hsl(${hue} 60% 45%)`, text: (l.name || host)[0].toUpperCase() }),
        el('span', { class: 'wb-link-name', text: l.name })));
    });
    if (!links.length) grid.append(el('button', { class: 'wb-btn', text: '+ Добавить ссылки', onclick: () => openSettings(w) }));
    return card(w, w.cfg.title ? head('🔗', w.cfg.title) : null, grid);
  }

  function wNotes(w) {
    const ta = el('textarea', { class: 'wb-notes-ta', rows: 6, placeholder: 'Заметки…', 'aria-label': 'Заметки' });
    ta.value = w.cfg.text || '';
    let timer;
    ta.addEventListener('input', () => { w.cfg.text = ta.value; clearTimeout(timer); timer = setTimeout(save, 400); });
    return card(w, head('📝', w.cfg.title || 'Заметки'), ta);
  }

  function wStats(w) {
    const total = el('div', { class: 'wb-big' }), delta = el('div', { class: 'wb-sub' }), list = el('div', { class: 'wb-bars' });
    const node = card(w, head('📊', 'Время за сегодня'), total, delta, list);
    every(node, 20000, async () => {
      const [{ stats = {}, settings = {} }] = [await chrome.storage.local.get(['stats', 'settings'])];
      const today = stats[dayKey()] || {}, y = new Date(); y.setDate(y.getDate() - 1);
      const ysec = (stats[dayKey(y)] || {}).totalSeconds || 0, sec = today.totalSeconds || 0;
      total.textContent = fmtDur(sec);
      delta.textContent = ysec ? `${sec >= ysec ? '+' : ''}${Math.round((sec - ysec) / ysec * 100)}% vs вчера` : 'Нет данных за вчера';
      const top = Object.entries(today.domains || {}).sort((a, b) => b[1] - a[1]).slice(0, 5), max = top[0] ? top[0][1] : 1;
      list.innerHTML = '';
      top.forEach(([d, s]) => list.append(el('div', { class: 'wb-bar-row' },
        el('span', { class: 'wb-bar-name', text: d }),
        el('span', { class: 'wb-bar-track' }, el('span', { class: 'wb-bar-fill' + (window.EyeTimeBlocking && EyeTimeBlocking.isDistraction(d, settings) ? ' bad' : ''), style: `width:${Math.max(4, s / max * 100)}%` })),
        el('span', { class: 'wb-bar-val', text: fmtDur(s) }))));
      if (!top.length) list.append(el('div', { class: 'wb-sub', text: 'Нет активности за сегодня' }));
      if (window.EyeTimeI18n) window.EyeTimeI18n.translateTree(node);
    });
    return node;
  }

  function wRules(w) {
    const text = el('div', { class: 'wb-rule' }), idx = el('div', { class: 'wb-sub' });
    const node = card(w, head('📜', 'Правила дня'), text, idx);
    chrome.storage.local.get(['settings']).then(({ settings = {} }) => {
      const rules = (settings.interceptor && settings.interceptor.dailyRules) || [];
      if (!rules.length) { text.textContent = 'Добавьте правила дня в настройках'; return; }
      let i = Math.floor(Date.now() / 86400000) % rules.length;
      const show = () => { text.textContent = '«' + rules[i] + '»'; idx.textContent = `${i + 1} / ${rules.length}`; if (window.EyeTimeI18n) window.EyeTimeI18n.translateTree(node); };
      node.append(el('button', { class: 'wb-btn wb-rule-next', text: '↻', title: 'Следующее', onclick: () => { i = (i + 1) % rules.length; show(); } }));
      show();
    });
    return node;
  }

  function wSearch(w) {
    const input = el('input', { type: 'search', class: 'wb-search-input', placeholder: 'Искать в сети…', 'aria-label': 'Поиск' });
    const form = el('form', { class: 'wb-search', onsubmit: (e) => { e.preventDefault(); const q = input.value.trim(); if (q) location.href = (SEARCH_URLS[w.cfg.engine] || SEARCH_URLS.duckduckgo) + encodeURIComponent(q); } },
      el('span', { text: '🔍' }), input);
    return card(w, form);
  }

  function wCountdown(w) {
    const big = el('div', { class: 'wb-big' }), sub = el('div', { class: 'wb-sub' });
    const node = card(w, head('⏳', w.cfg.title || 'Обратный отсчёт'), big, sub);
    every(node, 60000, () => {
      if (!w.cfg.date) { big.textContent = '—'; sub.textContent = ''; sub.append(el('button', { class: 'wb-btn', text: 'Выбрать дату', onclick: () => openSettings(w) })); return; }
      const days = Math.round((new Date(w.cfg.date + 'T00:00:00') - new Date(dayKey() + 'T00:00:00')) / 86400000);
      big.textContent = String(Math.abs(days));
      sub.textContent = days === 0 ? 'Сегодня!' : days > 0 ? 'дн. осталось' : 'дн. прошло';
      if (window.EyeTimeI18n) window.EyeTimeI18n.translateTree(node);
    });
    return node;
  }

  function wEyebreak(w) {
    const big = el('div', { class: 'wb-big' }), sub = el('div', { class: 'wb-sub' });
    const btn = el('button', { class: 'wb-btn wb-btn-accent', text: '✅ Сделал перерыв' });
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
      if (window.EyeTimeI18n) window.EyeTimeI18n.translateTree(node);
    };
    every(node, 15000, refresh);
    btn.addEventListener('click', async () => {
      const { stats = {} } = await chrome.storage.local.get(['stats']);
      const k = dayKey();
      const day = stats[k] || (stats[k] = { totalSeconds: 0, domains: {}, desktopApps: {}, breaksCompleted: 0 });
      day.breaksCompleted = (day.breaksCompleted || 0) + 1;
      await chrome.storage.local.set({ stats, lastEyeRestTime: Date.now() });
      refresh();
      confetti(btn);
    });
    return node;
  }

  // ── Delight: tiny confetti burst ─────────────────────────────────────────
  function confetti(origin) {
    if (!layout || !layout.theme.anim || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = origin && origin.getBoundingClientRect ? origin.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 3, width: 0, height: 0 };
    const cv = el('canvas', { class: 'wb-confetti', width: innerWidth, height: innerHeight });
    document.body.append(cv);
    const ctx = cv.getContext('2d');
    const accent = layout.theme.accent, colors = [accent, '#FBBF24', '#34D399', '#60A5FA', '#F472B6', '#fff'];
    const ox = r.left + r.width / 2, oy = r.top + r.height / 2;
    const ps = Array.from({ length: 70 }, () => ({ x: ox, y: oy, vx: (Math.random() - .5) * 11, vy: -Math.random() * 11 - 3, s: 4 + Math.random() * 5, c: colors[(Math.random() * colors.length) | 0], rot: Math.random() * 6, vr: (Math.random() - .5) * .4 }));
    let frames = 0;
    (function tick() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      ps.forEach(p => { p.vy += .35; p.x += p.vx; p.y += p.vy; p.rot += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, 1 - frames / 90); ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s / 1.6); ctx.restore(); });
      if (++frames < 90) requestAnimationFrame(tick); else cv.remove();
    })();
  }

  // ── Public API ───────────────────────────────────────────────────────────
  async function init() {
    layout = await load();
    board = $('#widgetBoard');
    applyTheme();
    buildChrome();
    initDnD();
    render();
    window.addEventListener('resize', () => board.querySelectorAll('.wb-widget').forEach(updateSpan));
    // fonts / late content can change heights
    setTimeout(() => board.querySelectorAll('.wb-widget').forEach(updateSpan), 400);
  }

  window.EyeTimeBoard = { init, confetti, CATALOG };
})();
