// EyeTime — Widget board: build the new tab like a constructor.
// Layout lives in chrome.storage.local.newtabLayout = { v, theme, widgets: [{ id, type, w, cfg, style }] }.
// Built-in widgets are existing DOM cards kept in #widgetBank and moved onto the board; other widgets are rendered by
// builders registered via EyeTimeBoard.register() (see board-widgets.js). Widths are 12-column spans; heights are
// automatic (masonry via grid row spans). Presets live in board-presets.js.
(function () {
  const ROW = 8;            // grid-auto-rows unit (px)
  const GAP = 16;           // gap between widgets (px)
  const WIDTHS = [[3, 'S'], [4, 'M'], [6, 'L'], [8, 'XL'], [12, '▭']];
  const KEY = 'newtabLayout', BG_KEY = 'newtabBg', WELCOME_KEY = 'newtabWelcomed', PROF_KEY = 'newtabProfiles';

  const t = (s) => (window.EyeTimeI18n ? window.EyeTimeI18n.t(s) : s);
  const lang = () => (window.EyeTimeI18n && window.EyeTimeI18n.lang === 'ru') ? 'ru-RU' : 'en-US';
  const $ = (sel, root = document) => root.querySelector(sel);
  const tr = (node) => { if (window.EyeTimeI18n) window.EyeTimeI18n.translateTree(node); return node; };

  function el(tag, props, ...kids) {
    const n = document.createElement(tag);
    if (props) Object.entries(props).forEach(([k, v]) => {
      if (k === 'class') n.className = v;
      else if (k === 'style') n.style.cssText = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v === true ? '' : v);
    });
    kids.flat().forEach(k => k != null && k !== false && n.append(k.nodeType ? k : document.createTextNode(k)));
    return n;
  }

  // ── Registry ─────────────────────────────────────────────────────────────
  // def: { icon, name, desc, w, ph (preview height), builtin?, multi?, cfg? }
  const CATALOG = {}, BUILDERS = {}, SCHEMA = {};
  function register(type, def, builder, schema) {
    CATALOG[type] = def;
    if (builder) BUILDERS[type] = builder;
    if (schema) SCHEMA[type] = schema;
  }

  [
    ['focus', '⏱️', 'Фокус-Блок', 'Таймер глубокой работы с блокировкой отвлечений', 4, 2],
    ['leaks', '🚰', 'Анти-слив', 'Сколько времени утекло на отвлекающие сайты', 4, 2],
    ['habits', '✅', 'Привычки', 'Ежедневные привычки, стрик и челлендж', 4, 2],
    ['tasks', '☑️', 'Задачи дня', 'Список задач с синхронизацией TickTick', 6, 5],
    ['thoughts', '🧠', 'Парковка мыслей', 'Быстрые заметки, чтобы не отвлекаться', 6, 2],
    ['goals', '🎯', 'Цели', 'Счётчики целей на день', 6, 2],
    ['chart', '📈', 'Дневной фокус', 'График активности за неделю', 6, 3]
  ].forEach(([type, icon, name, desc, w, ph]) => register(type, { icon, name, desc, w, ph, builtin: true }));

  const SEARCH_URLS = {
    duckduckgo: 'https://duckduckgo.com/?q=', google: 'https://www.google.com/search?q=', bing: 'https://www.bing.com/search?q=',
    brave: 'https://search.brave.com/search?q=', yandex: 'https://yandex.com/search/?text='
  };

  // ── Theme ────────────────────────────────────────────────────────────────
  const DEFAULT_THEME = {
    accent: '#FF5E0E', bg: 'glow', density: 'comfortable', cards: 'glass', anim: true,
    font: 'system', scale: 1, radius: 'normal', width: 'normal', header: 'full', fit: 'fill',
    cardAlpha: 0.55, bgBlur: 0, bgDim: 0.35, bgImage: false
  };
  const FONTS = {
    system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, Helvetica, Arial, sans-serif',
    serif: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
    rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", "Quicksand", system-ui, sans-serif'
  };
  const RADII = { sharp: '6px', normal: '20px', round: '32px' };
  const WIDTH_PX = { narrow: '880px', normal: '1080px', wide: '1400px', full: '100%' };
  const ACCENTS = ['#FF5E0E', '#EF4444', '#EC4899', '#A855F7', '#6366F1', '#3B82F6', '#06B6D4', '#14B8A6', '#34D399', '#84CC16', '#F59E0B', '#94A3B8'];
  const BG_LIST = ['glow', 'aurora', 'midnight', 'grid', 'sunset', 'ocean', 'forest', 'mono'];
  const BACKGROUNDS = [['glow', 'Свечение'], ['aurora', 'Аврора (анимация)'], ['midnight', 'Полночь'], ['grid', 'Сетка'],
    ['sunset', 'Закат'], ['ocean', 'Океан'], ['forest', 'Лес'], ['mono', 'Графит'], ['image', 'Своё фото']];
  const CARD_STYLES = [['glass', 'Стекло'], ['flat', 'Плоские'], ['outline', 'Контур'], ['tinted', 'Тонированные'], ['frosted', 'Матовые'], ['brutal', 'Жёсткие']];

  let layout = null, editing = false, board = null, dock = null, ro = null, saveTimer = null, editBtn = null, overlay = null, bgLayer = null;
  let first = true, bgImageData = '';

  const uid = () => 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const scale = () => Number(layout && layout.theme.scale) || 1;

  function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '255, 94, 14';
    const n = parseInt(m[1], 16);
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  }

  function applyTheme() {
    const th = layout.theme, root = document.documentElement.style, body = document.body;
    root.setProperty('--fx-orange', th.accent);
    try { localStorage.setItem('eyetime_theme', JSON.stringify({ accent: th.accent, font: th.font })); } catch (e) { }
    root.setProperty('--fx-accent-rgb', hexToRgb(th.accent));
    root.setProperty('--font', FONTS[th.font] || FONTS.system);
    root.setProperty('--fx-radius', RADII[th.radius] || RADII.normal);
    root.setProperty('--wb-width', WIDTH_PX[th.width] || WIDTH_PX.normal);
    root.setProperty('--wb-scale', String(th.scale || 1));
    root.setProperty('--wb-card-alpha', String(th.cardAlpha));
    body.classList.toggle('theme-compact', th.density === 'compact');
    body.classList.toggle('hdr-min', th.header === 'minimal');
    body.classList.toggle('no-anim', !th.anim);
    CARD_STYLES.forEach(([k]) => body.classList.toggle('cards-' + k, th.cards === k && k !== 'glass'));
    BG_LIST.forEach(b => body.classList.toggle('bg-' + b, th.bg === b));
    body.classList.toggle('bg-image', th.bg === 'image' && !!bgImageData);
    if (bgLayer) {
      bgLayer.style.backgroundImage = th.bg === 'image' && bgImageData ? `url(${bgImageData})` : 'none';
      bgLayer.style.filter = `blur(${th.bgBlur}px)`;
      bgLayer.style.setProperty('--dim', String(th.bgDim));
    }
  }

  // ── Persistence ──────────────────────────────────────────────────────────
  function normalize(l) {
    if (!l || !Array.isArray(l.widgets)) l = DEFAULT_LAYOUT();
    l.theme = { ...DEFAULT_THEME, ...(l.theme || {}) };
    const seen = new Set();
    l.widgets = l.widgets.filter(w => w && CATALOG[w.type] && (CATALOG[w.type].multi || !seen.has(w.type)) && seen.add(w.type));
    l.widgets.forEach(w => {
      w.id = w.id || uid();
      w.w = Number.isInteger(w.w) && w.w >= 3 && w.w <= 12 ? w.w : CATALOG[w.type].w;
      w.cfg = { ...(CATALOG[w.type].cfg ? clone(CATALOG[w.type].cfg) : {}), ...(w.cfg || {}) };
      w.style = { transparent: false, accent: '', ...(w.style || {}) };
    });
    return l;
  }

  const DEFAULT_LAYOUT = () => ({
    v: 2, theme: { ...DEFAULT_THEME },
    widgets: [['focus', 4], ['leaks', 4], ['habits', 4], ['tasks', 6], ['thoughts', 6], ['goals', 6], ['chart', 6]]
      .map(([type, w]) => ({ id: type, type, w, cfg: {}, style: {} }))
  });

  // Undo / redo (kept in memory while editing)
  let hist = [], histIdx = -1, restoring = false;
  const snap = () => JSON.stringify(layout);
  function resetHistory() { hist = [snap()]; histIdx = 0; updateUndoButtons(); }
  function recordHistory() {
    if (!editing || restoring) return;
    const s = snap();
    if (s === hist[histIdx]) return;
    hist = hist.slice(0, histIdx + 1); hist.push(s);
    if (hist.length > 60) hist.shift();
    histIdx = hist.length - 1;
    updateUndoButtons();
  }
  function stepHistory(d) {
    const j = histIdx + d;
    if (j < 0 || j >= hist.length) return;
    histIdx = j;
    restoring = true;
    layout = normalize(JSON.parse(hist[j]));
    first = false; applyTheme(); render(); save();
    restoring = false;
    updateUndoButtons();
  }
  function updateUndoButtons() {
    if (!dock) return;
    const u = dock.querySelector('.wb-undo'), r = dock.querySelector('.wb-redo');
    if (u) u.disabled = histIdx <= 0;
    if (r) r.disabled = histIdx >= hist.length - 1;
  }

  function save() {
    recordHistory();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { commitActive(); chrome.storage.local.set({ [KEY]: layout, [PROF_KEY]: profiles }); }, 150);
  }

  // ── Board rendering ──────────────────────────────────────────────────────
  const builtinEl = (type) => document.querySelector(`[data-widget="${type}"]`);

  // Row packing: widgets flow in order into rows of 12 columns. With "fill" (default) every complete row is
  // stretched to the full width, so the board stays tidy no matter how widgets are ordered or sized.
  function layoutRows() {
    if (!board) return;
    const wraps = [...board.querySelectorAll('.wb-widget')];
    const spans = EyeTimePack.packRows(wraps.map(n => Number(n.dataset.cols) || 4), layout.theme.fit !== 'exact');
    wraps.forEach((n, i) => { n.style.gridColumn = `span ${spans[i]}`; n.dataset.span = spans[i]; });
  }
  const updateAll = layoutRows;

  function render() {
    Object.keys(CATALOG).filter(k => CATALOG[k].builtin).forEach(k => { const e = builtinEl(k); if (e) $('#widgetBank').append(e); });
    board.innerHTML = '';

    layout.widgets.forEach((w, i) => {
      const def = CATALOG[w.type];
      let content = null;
      try { content = def.builtin ? builtinEl(w.type) : BUILDERS[w.type](w); } catch (e) { console.error('widget failed', w.type, e); }
      if (!content) return;
      content.classList.add('wb-content');
      const wrap = el('div', { class: 'wb-widget' + (first ? ' wb-enter' : '') + (w.style.transparent ? ' wb-transparent' : ''), 'data-id': w.id, 'data-type': w.type, style: `--i:${i}`, 'data-cols': w.w });
      if (w.style.accent) { wrap.style.setProperty('--fx-orange', w.style.accent); wrap.style.setProperty('--fx-accent-rgb', hexToRgb(w.style.accent)); }
      wrap.append(content, toolbar(w), resizeHandle(w, wrap));
      board.append(wrap);
    });
    first = false;
    layoutRows();
    if (!layout.widgets.length) board.append(el('div', { class: 'wb-empty' }, el('p', { text: 'Здесь пока пусто.' }), el('button', { class: 'wb-btn wb-btn-accent', text: '+ Добавить виджет', onclick: openGallery })));
    tr(board);
  }

  function toolbar(w) {
    const def = CATALOG[w.type];
    const idx = () => layout.widgets.findIndex(x => x.id === w.id);
    const bar = el('div', { class: 'wb-toolbar', onpointerdown: (e) => e.stopPropagation() });
    const handle = el('span', { class: 'wb-handle', title: 'Перетащить', text: '⠿' });
    handle.addEventListener('pointerdown', () => { handle.closest('.wb-widget').draggable = true; });
    bar.append(handle,
      el('span', { class: 'wb-title', text: def.name }),
      el('button', { class: 'wb-ico', title: 'Раньше', text: '←', onclick: () => move(idx(), -1) }),
      el('button', { class: 'wb-ico', title: 'Позже', text: '→', onclick: () => move(idx(), 1) }),
      el('span', { class: 'wb-sizes' }, WIDTHS.map(([cols, label]) =>
        el('button', { class: 'wb-size' + (w.w === cols ? ' on' : ''), title: `${cols}/12`, text: label, onclick: () => { w.w = cols; save(); render(); } }))),
      el('button', { class: 'wb-ico', title: 'Настройки виджета', text: '⚙', onclick: () => openSettings(w) }),
      el('button', { class: 'wb-ico', title: 'Дублировать', text: '⧉', hidden: !def.multi, onclick: () => duplicate(w) }),
      el('button', { class: 'wb-ico wb-del', title: 'Удалить виджет', text: '✕', onclick: () => removeWidget(w) }));
    bar.querySelectorAll('[hidden]').forEach(n => n.remove());
    return bar;
  }

  // Drag the right edge of a widget to change its width (snaps to columns)
  function resizeHandle(w, wrap) {
    const h = el('div', { class: 'wb-resize', title: 'Потяните, чтобы изменить ширину', role: 'separator', 'aria-orientation': 'vertical' }, el('span', { class: 'wb-resize-grip' }), el('span', { class: 'wb-resize-tip' }));
    h.addEventListener('pointerdown', (e) => {
      if (!editing) return;
      e.preventDefault(); e.stopPropagation();
      h.setPointerCapture(e.pointerId);
      wrap.classList.add('wb-resizing');
      const tip = h.querySelector('.wb-resize-tip');
      const move = (ev) => {
        const b0 = board.getBoundingClientRect(), left = wrap.getBoundingClientRect().left;
        const colW = (b0.width + GAP * scale()) / 12;
        const cols = Math.max(3, Math.min(12, Math.round((ev.clientX - left + GAP * scale() / 2) / colW)));
        if (cols !== w.w) { w.w = cols; wrap.dataset.cols = cols; layoutRows(); }
        tip.textContent = `${wrap.dataset.span || cols}/12`;
      };
      const up = () => {
        h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
        wrap.classList.remove('wb-resizing');
        save(); render();
      };
      h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
    });
    return h;
  }

  function flip(mutate) {
    const rects = new Map([...board.children].map(c => [c, c.getBoundingClientRect()]));
    mutate();
    layoutRows();
    if (!layout.theme.anim) return;
    const s = scale();
    [...board.children].forEach(c => {
      const a = rects.get(c); if (!a) return;
      const b = c.getBoundingClientRect();
      const dx = (a.left - b.left) / s, dy = (a.top - b.top) / s;
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

  function duplicate(w) {
    const copy = clone(w); copy.id = uid();
    layout.widgets.splice(layout.widgets.findIndex(x => x.id === w.id) + 1, 0, copy);
    save(); render();
  }

  function addWidget(type) {
    const def = CATALOG[type];
    if (!def.multi && layout.widgets.some(w => w.type === type)) return null;
    const w = { id: def.builtin ? type : uid(), type, w: def.w, cfg: def.cfg ? clone(def.cfg) : {}, style: { transparent: false, accent: '' } };
    layout.widgets.push(w);
    save(); render();
    const wrap = board.querySelector(`[data-id="${w.id}"]`);
    if (wrap) { wrap.scrollIntoView({ behavior: 'smooth', block: 'center' }); wrap.classList.add('wb-flash'); }
    if (def.configure) openSettings(w);
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
      if (ref === dragging || (ref === dragging.nextElementSibling && !after)) return;
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

  // ── Edit mode & panels ───────────────────────────────────────────────────
  function setEditing(on) {
    editing = on;
    document.body.classList.toggle('wb-editing', on);
    dock.classList.toggle('open', on);
    editBtn.classList.toggle('on', on);
    if (on) { dismissWelcome(); resetHistory(); }
    board.querySelectorAll('.wb-widget').forEach(n => { n.draggable = false; });
    if (!on) closePanels();
    requestAnimationFrame(updateAll);
  }

  function closePanels() { if (overlay) { overlay.remove(); overlay = null; } }

  function openPanel(title, body, size) {
    closePanels();
    overlay = el('div', { class: 'wb-overlay', onclick: (e) => { if (e.target === overlay) closePanels(); } },
      el('div', { class: 'wb-panel ' + (size || ''), role: 'dialog', 'aria-label': title },
        el('div', { class: 'wb-panel-head' }, el('h3', { text: title }), el('button', { class: 'wb-ico', text: '✕', title: 'Закрыть', onclick: closePanels })),
        body));
    document.body.append(overlay);
    tr(overlay);
    return overlay;
  }

  function openGallery() {
    const q = el('input', { type: 'search', class: 'wb-gal-search', placeholder: 'Найти виджет…', 'aria-label': 'Поиск' });
    const grid = el('div', { class: 'wb-gallery' });
    const draw = () => {
      grid.innerHTML = '';
      const needle = q.value.trim().toLowerCase();
      Object.entries(CATALOG).forEach(([type, def]) => {
        if (needle && !(t(def.name) + ' ' + t(def.desc)).toLowerCase().includes(needle)) return;
        const used = !def.multi && layout.widgets.some(w => w.type === type);
        grid.append(el('button', { class: 'wb-gal-item', disabled: used, onclick: () => { addWidget(type); closePanels(); } },
          el('span', { class: 'wb-gal-ico', text: def.icon }), el('span', { class: 'wb-gal-name', text: def.name }),
          el('span', { class: 'wb-gal-desc', text: def.desc }), el('span', { class: 'wb-gal-tag', text: used ? 'Уже на экране' : '+ Добавить' })));
      });
      tr(grid);
    };
    q.addEventListener('input', draw);
    draw();
    openPanel('Добавить виджет', el('div', {}, q, grid), 'wide');
    q.focus();
  }

  // Settings: widget-specific schema + generic style options
  function openSettings(w) {
    const def = CATALOG[w.type];
    const form = el('div', { class: 'wb-form' });
    const changed = () => { save(); render(); };
    (SCHEMA[w.type] || []).forEach(f => {
      const id = 'wbf-' + f.key;
      const row = el('label', { class: 'wb-field' + (f.type === 'checkbox' ? ' wb-check' : ''), for: id });
      let input;
      if (f.type === 'select') {
        input = el('select', { id }, f.options.map(([v, l]) => el('option', { value: v, text: l, selected: String(w.cfg[f.key]) === String(v) })));
        input.addEventListener('change', () => { w.cfg[f.key] = isNaN(Number(input.value)) || input.value === '' ? input.value : Number(input.value); changed(); });
      } else if (f.type === 'checkbox') {
        input = el('input', { id, type: 'checkbox', checked: !!w.cfg[f.key] });
        input.addEventListener('change', () => { w.cfg[f.key] = input.checked; changed(); });
      } else if (f.type === 'links') {
        input = linksEditor(w);
      } else if (f.type === 'number') {
        input = el('input', { id, type: 'number', value: w.cfg[f.key], min: f.min, max: f.max });
        input.addEventListener('change', () => { w.cfg[f.key] = Math.min(f.max ?? 1e9, Math.max(f.min ?? -1e9, Number(input.value) || f.min || 0)); changed(); });
      } else if (f.type === 'textarea') {
        input = el('textarea', { id, rows: 3, maxlength: 300 });
        input.value = w.cfg[f.key] || '';
        input.addEventListener('change', () => { w.cfg[f.key] = input.value.trim(); changed(); });
      } else {
        input = el('input', { id, type: f.type, value: w.cfg[f.key] || '', maxlength: 80 });
        input.addEventListener('change', () => { w.cfg[f.key] = input.value.trim(); changed(); });
      }
      if (f.type === 'checkbox') row.append(input, el('span', { text: f.label })); else row.append(el('span', { text: f.label }), input);
      if (f.hint) row.append(el('small', { class: 'wb-hint', text: f.hint }));
      form.append(row);
    });

    // generic style options (every widget)
    const trans = el('input', { id: 'wbf-transparent', type: 'checkbox', checked: !!w.style.transparent });
    trans.addEventListener('change', () => { w.style.transparent = trans.checked; changed(); });
    const acc = el('input', { type: 'color', value: w.style.accent || layout.theme.accent, 'aria-label': 'Цвет виджета' });
    acc.addEventListener('input', () => { w.style.accent = acc.value; save(); const wrap = board.querySelector(`[data-id="${w.id}"]`); if (wrap) { wrap.style.setProperty('--fx-orange', acc.value); wrap.style.setProperty('--fx-accent-rgb', hexToRgb(acc.value)); } });
    form.append(el('div', { class: 'wb-sep', text: 'Внешний вид виджета' }),
      el('label', { class: 'wb-field wb-check', for: 'wbf-transparent' }, trans, el('span', { text: 'Без фона (прозрачный)' })),
      el('div', { class: 'wb-field' }, el('span', { text: 'Свой акцентный цвет' }),
        el('div', { class: 'wb-row' }, acc, el('button', { class: 'wb-btn', type: 'button', text: 'Как в теме', onclick: () => { w.style.accent = ''; changed(); closePanels(); } }))));
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
      const name = el('input', { placeholder: 'Название', maxlength: 24, 'aria-label': 'Название' }), url = el('input', { placeholder: 'https://…', 'aria-label': 'URL' });
      const add = () => {
        const u = normUrl(url.value);
        if (!u) return;
        w.cfg.links.push({ name: name.value.trim() || new URL(u).hostname.replace(/^www\./, ''), url: u });
        save(); draw(); render();
      };
      box.append(el('div', { class: 'wb-link-row' }, name, url, el('button', { class: 'wb-btn', type: 'button', text: 'Добавить', onclick: add })));
      tr(box);
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

  // ── Appearance panel ─────────────────────────────────────────────────────
  function openTheme() {
    const th = layout.theme;
    const apply = () => { applyTheme(); save(); requestAnimationFrame(updateAll); };
    const seg = (key, opts, after) => {
      const box = el('div', { class: 'wb-seg' });
      opts.forEach(([v, l]) => box.append(el('button', {
        class: String(th[key]) === String(v) ? 'on' : '', text: l, type: 'button',
        onclick: (e) => { th[key] = v; box.querySelectorAll('button').forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); apply(); if (after) after(); }
      })));
      return tr(box);
    };
    const field = (label, ...ctl) => el('div', { class: 'wb-field' }, el('span', { text: label }), ...ctl);
    // Visual option tiles (thumbnail + label), like the theme pickers in Slack / Revolut
    const accentRgb = () => hexToRgb(th.accent);
    const BG_PV = {
      glow: () => `radial-gradient(circle at 50% -10%, rgba(${accentRgb()}, .45), #0b0c10 70%)`,
      aurora: () => `radial-gradient(circle at 20% 20%, rgba(${accentRgb()}, .6), transparent 55%), radial-gradient(circle at 85% 90%, rgba(99,102,241,.6), transparent 55%), #0b0c10`,
      midnight: () => '#07080b',
      grid: () => `linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px) 0 0/10px 10px, linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px) 0 0/10px 10px, #0b0c10`,
      sunset: () => 'linear-gradient(160deg, #1c0b33, #4a1d52 50%, #a3413f)',
      ocean: () => 'linear-gradient(170deg, #02121f, #053553 55%, #0b6a7a)',
      forest: () => 'linear-gradient(165deg, #06120d, #0e2b1f 55%, #1d4a33)',
      mono: () => 'radial-gradient(circle at 50% -10%, rgba(255,255,255,.18), #121212 70%)',
      image: () => (bgImageData ? `center/cover url(${bgImageData})` : 'repeating-linear-gradient(45deg, #1b1c24, #1b1c24 6px, #23242d 6px, #23242d 12px)')
    };
    const CARD_PV = {
      glass: 'linear-gradient(180deg, rgba(255,255,255,.2), rgba(255,255,255,.03)), #1a1b22',
      flat: '#13141b',
      outline: 'transparent',
      tinted: () => `linear-gradient(180deg, rgba(${accentRgb()}, .35), rgba(${accentRgb()}, .08)), #12131a`,
      frosted: 'rgba(255,255,255,.12)',
      brutal: '#0d0e13'
    };
    const tiles = (key, opts, preview, after, cls) => {
      const box = el('div', { class: 'wb-tiles ' + (cls || '') });
      opts.forEach(([v, l]) => {
        const pv = el('span', { class: 'wb-tile-pv' });
        preview(v, pv);
        const tile = el('button', { class: 'wb-tile' + (String(th[key]) === String(v) ? ' on' : ''), type: 'button', 'aria-pressed': String(th[key]) === String(v) ? 'true' : 'false',
          onclick: () => { th[key] = v; box.querySelectorAll('.wb-tile').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); }); tile.classList.add('on'); tile.setAttribute('aria-pressed', 'true'); apply(); if (after) after(); } },
          pv, el('span', { class: 'wb-tile-name', text: l }));
        box.append(tile);
      });
      return tr(box);
    };

    const custom = el('input', { type: 'color', value: th.accent, 'aria-label': 'Свой цвет', oninput: (e) => { th.accent = e.target.value; swatches.querySelectorAll('.wb-swatch').forEach(s => s.classList.remove('on')); apply(); } });
    const swatches = el('div', { class: 'wb-swatches' }, ACCENTS.map(c => el('button', {
      class: 'wb-swatch' + (th.accent.toLowerCase() === c.toLowerCase() ? ' on' : ''), style: `background:${c}`, title: c, type: 'button',
      onclick: (e) => { th.accent = c; swatches.querySelectorAll('.wb-swatch').forEach(s => s.classList.remove('on')); e.currentTarget.classList.add('on'); custom.value = c; apply(); }
    })));

    const slider = (key, min, max, step, fmt) => {
      const out = el('span', { class: 'wb-range-val', text: fmt(th[key]) });
      const inp = el('input', { type: 'range', min, max, step, value: th[key], oninput: (e) => { th[key] = Number(e.target.value); out.textContent = fmt(th[key]); apply(); } });
      return el('div', { class: 'wb-range' }, inp, out);
    };

    // custom background image
    const fileIn = el('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async (e) => { const f = e.target.files[0]; if (f) await setBgImage(f); th.bg = 'image'; apply(); openTheme(); } });
    const imgBox = el('div', { class: 'wb-field' + (th.bg === 'image' ? '' : ' wb-collapsed') },
      el('div', { class: 'wb-row' },
        el('button', { class: 'wb-btn', type: 'button', text: bgImageData ? 'Заменить фото' : 'Выбрать фото…', onclick: () => fileIn.click() }),
        bgImageData ? el('button', { class: 'wb-btn', type: 'button', text: 'Убрать', onclick: async () => { await chrome.storage.local.remove(BG_KEY); bgImageData = ''; th.bg = 'glow'; apply(); openTheme(); } }) : null, fileIn),
      el('span', { text: 'Размытие фона' }), slider('bgBlur', 0, 24, 1, v => v + 'px'),
      el('span', { text: 'Затемнение' }), slider('bgDim', 0, 0.9, 0.05, v => Math.round(v * 100) + '%'));

    const bgSeg = tiles('bg', BACKGROUNDS, (v, pv) => { pv.style.background = BG_PV[v](); if (v === 'image' && !bgImageData) pv.textContent = '🖼️'; }, () => { imgBox.classList.toggle('wb-collapsed', th.bg !== 'image'); if (th.bg === 'image' && !bgImageData) fileIn.click(); });
    const alphaField = field('Прозрачность матовых карточек', slider('cardAlpha', 0.2, 0.95, 0.05, v => Math.round(v * 100) + '%'));
    alphaField.classList.toggle('wb-collapsed', th.cards !== 'frosted');

    openPanel('Оформление', el('div', { class: 'wb-form' },
      field('Акцентный цвет', el('div', { class: 'wb-row' }, swatches, custom)),
      field('Фон', bgSeg), imgBox,
      field('Стиль карточек', tiles('cards', CARD_STYLES, (v, pv) => { const s = CARD_PV[v]; const bg = typeof s === 'function' ? s() : s; pv.classList.add('wb-cpv', 'cpv-' + v); pv.style.setProperty('--cpv', bg); pv.style.setProperty('--acc', th.accent); pv.innerHTML = '<i></i>'; }, () => alphaField.classList.toggle('wb-collapsed', th.cards !== 'frosted'))), alphaField,
      field('Скругление', tiles('radius', [['sharp', 'Острые'], ['normal', 'Обычные'], ['round', 'Круглые']], (v, pv) => { pv.classList.add('wb-rpv'); pv.style.setProperty('--r', { sharp: '3px', normal: '10px', round: '20px' }[v]); pv.innerHTML = '<i></i>'; }, null, 'small')),
      field('Шрифт', tiles('font', [['system', 'Системный'], ['rounded', 'Округлый'], ['serif', 'С засечками'], ['mono', 'Моно']], (v, pv) => { pv.classList.add('wb-fpv'); pv.style.fontFamily = FONTS[v]; pv.textContent = 'Aa'; }, null, 'small')),
      field('Размер интерфейса', seg('scale', [[0.9, 'S'], [1, 'M'], [1.1, 'L'], [1.25, 'XL']])),
      field('Ширина страницы', seg('width', [['narrow', 'Узкая'], ['normal', 'Обычная'], ['wide', 'Широкая'], ['full', 'На весь экран']])),
      field('Ряды', seg('fit', [['fill', 'Растягивать на всю ширину'], ['exact', 'Точные размеры']], () => layoutRows())),
      field('Плотность', seg('density', [['comfortable', 'Свободно'], ['compact', 'Компактно']])),
      field('Шапка', seg('header', [['full', 'Полная'], ['minimal', 'Минимальная']])),
      el('label', { class: 'wb-field wb-check' }, el('input', { type: 'checkbox', checked: th.anim, onchange: (e) => { th.anim = e.target.checked; apply(); } }), el('span', { text: 'Анимации' }))), 'wide');
  }

  // Downscale the chosen photo so it fits comfortably into extension storage
  function setBgImage(file) {
    return new Promise((resolve) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = async () => {
        const k = Math.min(1, 1920 / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        bgImageData = cv.toDataURL('image/jpeg', 0.8);
        URL.revokeObjectURL(url);
        await chrome.storage.local.set({ [BG_KEY]: bgImageData });
        layout.theme.bgImage = true;
        resolve();
      };
      img.onerror = () => resolve();
      img.src = url;
    });
  }

  // ── Presets, export / import ─────────────────────────────────────────────
  function hasUserData() {
    return layout.widgets.some(w => (w.type === 'notes' && w.cfg.text) || (w.type === 'quicklinks' && (w.cfg.links || []).length) || (w.type === 'checklist' && (w.cfg.items || []).length));
  }

  function applyPreset(p) {
    if (hasUserData() && !confirm('Заменить текущий набор? Заметки, ссылки и списки из текущего набора будут удалены.')) return;
    const next = { v: 2, theme: { ...DEFAULT_THEME, bgImage: layout.theme.bgImage, ...(p.theme || {}) }, widgets: p.widgets.map(([type, w, cfg, style]) => ({ id: CATALOG[type] && CATALOG[type].builtin ? type : uid(), type, w, cfg: cfg || {}, style: style || {} })) };
    if (p.theme && p.theme.bg !== 'image' && next.theme.bg === 'image' && !bgImageData) next.theme.bg = 'glow';
    layout = normalize(next);
    first = true;
    save(); applyTheme(); render();
    closePanels();
    dismissWelcome();
  }

  function presetPreview(p) {
    const box = el('div', { class: 'wb-pv' });
    p.widgets.forEach(([type, w]) => {
      const def = CATALOG[type]; if (!def) return;
      box.append(el('span', { class: 'wb-pv-i', style: `grid-column: span ${w}; grid-row: span ${def.ph || 2}`, text: def.icon }));
    });
    const accent = (p.theme && p.theme.accent) || layout.theme.accent;
    box.style.setProperty('--pv', accent);
    return box;
  }

  function openPresets() {
    const presets = (window.EyeTimePresets || []);
    const grid = el('div', { class: 'wb-presets' }, presets.map(p => el('button', { class: 'wb-preset', onclick: () => applyPreset(p) },
      presetPreview(p), el('span', { class: 'wb-gal-name' }, el('span', { text: p.icon }), ' ', el('span', { text: p.name })), el('span', { class: 'wb-gal-desc', text: p.desc }))));
    const importIn = el('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!data || data.kind !== 'eyetime-layout' || !Array.isArray(data.layout && data.layout.widgets)) throw new Error('bad');
        applyPreset({ widgets: data.layout.widgets.filter(w => CATALOG[w.type]).map(w => [w.type, w.w, w.cfg, w.style]), theme: { ...data.layout.theme, bg: data.layout.theme && data.layout.theme.bg === 'image' ? 'glow' : (data.layout.theme || {}).bg } });
      } catch (err) { alert('Не удалось импортировать: неверный файл раскладки.'); }
    } });
    const footer = el('div', { class: 'wb-row wb-preset-footer' },
      el('button', { class: 'wb-btn', type: 'button', text: '⬇ Экспорт раскладки', onclick: exportLayout }),
      el('button', { class: 'wb-btn', type: 'button', text: '⬆ Импорт', onclick: () => importIn.click() }), importIn);
    openPanel('Готовые наборы', el('div', {}, el('p', { class: 'wb-hint', text: 'Выберите стартовую раскладку — потом её можно изменить как угодно.' }), grid, footer), 'wide');
  }

  function exportLayout() {
    const out = clone(layout);
    out.theme.bgImage = false; if (out.theme.bg === 'image') out.theme.bg = 'glow';
    const blob = new Blob([JSON.stringify({ kind: 'eyetime-layout', version: 2, layout: out }, null, 2)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: 'eyetime-layout.json' });
    document.body.append(a); a.click(); a.remove();
  }

  function resetLayout() {
    if (!confirm('Вернуть расположение и оформление по умолчанию? Данные виджетов (заметки, ссылки) будут удалены.')) return;
    layout = normalize(DEFAULT_LAYOUT());
    first = true;
    save(); applyTheme(); render();
  }


  // ── Profiles: several named screens (e.g. Work / Home), optionally switched automatically by work hours ─────────
  let profiles = { active: 'main', list: [{ id: 'main', name: 'Основной', auto: 'none', layout: null }] };
  let profileBtn = null, profileMenu = null, scheduleCache = null;
  const pname = (p) => (p.name === 'Основной' ? t(p.name) : p.name);
  const activeProfile = () => profiles.list.find(p => p.id === profiles.active) || profiles.list[0];

  function commitActive() {
    const p = activeProfile();
    if (p && layout) p.layout = clone(layout);
  }

  function updateProfileChip() {
    if (!profileBtn) return;
    profileBtn.querySelector('.wb-profile-name').textContent = pname(activeProfile());
    profileBtn.title = t('Профиль экрана');
  }

  function activate(id) {
    profiles.active = id;
    layout = normalize(activeProfile().layout ? clone(activeProfile().layout) : DEFAULT_LAYOUT());
    first = true;
    applyTheme(); render();
    if (editing) resetHistory();
    clearTimeout(saveTimer);
    chrome.storage.local.set({ [KEY]: layout, [PROF_KEY]: profiles });
    updateProfileChip();
    closeProfileMenu();
  }

  function switchProfile(id) {
    if (!profiles.list.some(p => p.id === id) || id === profiles.active) return;
    commitActive();
    activate(id);
  }

  function createProfile(name, copy) {
    commitActive();
    const id = 'p' + Date.now().toString(36);
    const base = copy ? clone(layout) : DEFAULT_LAYOUT();
    profiles.list.push({ id, name: (name || '').trim().slice(0, 24) || t('Новый профиль'), auto: 'none', layout: base });
    switchProfile(id);
    return id;
  }

  // "work" profile is shown during work hours, "off" profile the rest of the time
  function autoTarget() {
    if (!scheduleCache || !window.EyeTimeBlocking || !scheduleCache.blocking) return null;
    const active = EyeTimeBlocking.isScheduleActive(scheduleCache);
    const want = active ? 'work' : 'off';
    const hit = profiles.list.find(p => p.auto === want);
    return hit ? hit.id : null;
  }
  function applyAuto() {
    if (editing) return;
    const id = autoTarget();
    if (id && id !== profiles.active) switchProfile(id);
  }

  function closeProfileMenu() { if (profileMenu) { profileMenu.remove(); profileMenu = null; } }
  function toggleProfileMenu() {
    if (profileMenu) { closeProfileMenu(); return; }
    profileMenu = el('div', { class: 'wb-menu', role: 'menu' });
    profiles.list.forEach(p => profileMenu.append(el('button', { class: 'wb-menu-item' + (p.id === profiles.active ? ' on' : ''), role: 'menuitem', onclick: () => switchProfile(p.id) },
      el('span', { class: 'wb-menu-check', text: p.id === profiles.active ? '✓' : '' }), el('span', { text: pname(p) }),
      p.auto !== 'none' ? el('small', { class: 'wb-menu-auto', text: p.auto === 'work' ? '💼' : '🏠' }) : null)));
    profileMenu.append(el('div', { class: 'wb-menu-sep' }),
      el('button', { class: 'wb-menu-item', role: 'menuitem', onclick: () => { closeProfileMenu(); const n = prompt(t('Название нового профиля (например, Работа):')); if (n !== null) createProfile(n, true); } }, el('span', { class: 'wb-menu-check', text: '+' }), el('span', { text: 'Новый профиль' })),
      el('button', { class: 'wb-menu-item', role: 'menuitem', onclick: () => { closeProfileMenu(); openProfiles(); } }, el('span', { class: 'wb-menu-check', text: '⚙' }), el('span', { text: 'Управление профилями' })));
    profileBtn.after(profileMenu);
    tr(profileMenu);
    setTimeout(() => document.addEventListener('click', function off(e) { if (!profileMenu || !profileMenu.contains(e.target)) { closeProfileMenu(); document.removeEventListener('click', off); } }), 0);
  }

  function openProfiles() {
    const box = el('div', { class: 'wb-form' });
    const draw = () => {
      box.textContent = '';
      profiles.list.forEach(p => {
        const name = el('input', { value: pname(p), maxlength: 24, 'aria-label': 'Название профиля', onchange: (e) => { p.name = e.target.value.trim() || p.name; updateProfileChip(); chrome.storage.local.set({ [PROF_KEY]: profiles }); } });
        const auto = el('select', { 'aria-label': 'Автопереключение', onchange: (e) => { p.auto = e.target.value; chrome.storage.local.set({ [PROF_KEY]: profiles }); applyAuto(); } },
          [['none', 'Только вручную'], ['work', '💼 В рабочие часы'], ['off', '🏠 Вне рабочих часов']].map(([v, l]) => el('option', { value: v, text: l, selected: p.auto === v })));
        box.append(el('div', { class: 'wb-prof-row' + (p.id === profiles.active ? ' on' : '') }, name, auto,
          el('button', { class: 'wb-btn', type: 'button', text: p.id === profiles.active ? 'Активен' : 'Открыть', disabled: p.id === profiles.active, onclick: () => { switchProfile(p.id); draw(); } }),
          el('button', { class: 'wb-ico', type: 'button', title: 'Дублировать', text: '⧉', onclick: () => { commitActive(); const copy = clone(p); copy.id = 'p' + Date.now().toString(36); copy.name = p.name + ' 2'; copy.auto = 'none'; profiles.list.push(copy); chrome.storage.local.set({ [PROF_KEY]: profiles }); draw(); } }),
          profiles.list.length > 1 ? el('button', { class: 'wb-ico wb-del', type: 'button', title: 'Удалить', text: '✕', onclick: () => {
            if (!confirm(t('Удалить профиль?') + ' ' + p.name)) return;
            const wasActive = p.id === profiles.active;
            commitActive();
            profiles.list = profiles.list.filter(x => x.id !== p.id);
            if (wasActive) activate(profiles.list[0].id); else chrome.storage.local.set({ [PROF_KEY]: profiles });
            draw(); updateProfileChip();
          } }) : null));
      });
      box.append(el('p', { class: 'wb-hint', text: 'Автопереключение использует расписание из Настроек → Рабочие часы: например, «Работа» с таймером и задачами днём и «Дом» с календарём и музыкой вечером.' }),
        el('button', { class: 'wb-btn wb-btn-accent', type: 'button', text: '+ Новый профиль', onclick: () => { const n = prompt(t('Название нового профиля (например, Работа):')); if (n !== null) { createProfile(n, true); draw(); } } }));
      tr(box);
    };
    draw();
    openPanel('Профили экрана', box, 'wide');
  }

  // ── Chrome (edit button, dock, welcome banner) ───────────────────────────
  function buildChrome() {
    editBtn = el('button', { class: 'header-action-btn wb-edit-btn', title: 'Настроить экран', onclick: () => setEditing(!editing) },
      el('span', { text: '✏️' }), el('span', { text: 'Настроить' }));
    const actions = $('.header-actions');
    profileBtn = el('button', { class: 'header-action-btn wb-profile-btn', 'aria-haspopup': 'menu', onclick: (e) => { e.stopPropagation(); toggleProfileMenu(); } }, el('span', { text: '🗂️' }), el('span', { class: 'wb-profile-name' }), el('span', { text: '▾' }));
    if (actions) { actions.prepend(editBtn); actions.prepend(profileBtn); }
    updateProfileChip();

    dock = el('div', { class: 'wb-dock', role: 'toolbar', 'aria-label': 'Настройка экрана' },
      el('button', { class: 'wb-btn wb-ico-btn wb-undo', title: 'Отменить (Ctrl+Z)', 'aria-label': 'Отменить', text: '↶', onclick: () => stepHistory(-1) }),
      el('button', { class: 'wb-btn wb-ico-btn wb-redo', title: 'Повторить (Ctrl+Shift+Z)', 'aria-label': 'Повторить', text: '↷', onclick: () => stepHistory(1) }),
      el('button', { class: 'wb-btn wb-btn-accent', text: '+ Виджет', onclick: openGallery }),
      el('button', { class: 'wb-btn', text: '🧩 Наборы', onclick: openPresets }),
      el('button', { class: 'wb-btn', text: '🗂️ Профили', onclick: openProfiles }),
      el('button', { class: 'wb-btn', text: '🎨 Оформление', onclick: openTheme }),
      el('button', { class: 'wb-btn', text: '↺ Сбросить', onclick: resetLayout }),
      el('button', { class: 'wb-btn wb-btn-done', text: '✓ Готово', onclick: () => setEditing(false) }));
    document.body.append(dock);
    tr(dock);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { if (overlay) closePanels(); else if (editing) setEditing(false); }
      if (editing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || ''))) {
        e.preventDefault(); stepHistory(e.shiftKey ? 1 : -1);
      }
    });
  }

  function dismissWelcome() {
    const banner = document.querySelector('.wb-welcome');
    if (banner) { banner.classList.add('wb-leaving'); setTimeout(() => banner.remove(), 220); }
    chrome.storage.local.set({ [WELCOME_KEY]: true });
  }

  async function maybeWelcome(hadLayout) {
    const d = await chrome.storage.local.get([WELCOME_KEY]);
    if (hadLayout || d[WELCOME_KEY]) return;
    const presets = window.EyeTimePresets || [];
    const dismiss = async () => dismissWelcome();
    const banner = el('div', { class: 'wb-welcome' },
      el('div', { class: 'wb-welcome-text' }, el('strong', { text: '👋 Соберите экран под себя' }), el('span', { text: 'Выберите готовый набор — потом можно переставлять и менять всё.' })),
      el('div', { class: 'wb-welcome-chips' }, presets.slice(0, 5).map(p => el('button', { class: 'wb-btn', onclick: async () => { applyPreset(p); await dismiss(); } }, el('span', { text: p.icon }), ' ', el('span', { text: p.name }))),
        el('button', { class: 'wb-btn wb-btn-ghost', text: 'Оставить как есть', onclick: dismiss })));
    board.before(tr(banner));
  }

  // ── Shared helpers for widget builders ───────────────────────────────────
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fmtDur = (sec) => { const m = Math.round(sec / 60); return m >= 60 ? `${Math.floor(m / 60)}ч ${m % 60}м` : `${m}м`; };
  const every = (node, ms, fn) => { fn(); const id = setInterval(() => { if (!node.isConnected) clearInterval(id); else fn(); }, ms); };
  const card = (w, ...kids) => el('section', { class: 'fintrixity-card wb-card wb-' + w.type }, ...kids);
  const head = (icon, title) => el('div', { class: 'wb-card-head' }, el('span', { class: 'wb-card-ico', text: icon }), el('span', { class: 'wb-card-title', text: title }));

  function confetti(origin) {
    if (!layout || !layout.theme.anim || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = origin && origin.getBoundingClientRect ? origin.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 3, width: 0, height: 0 };
    const cv = el('canvas', { class: 'wb-confetti', width: innerWidth, height: innerHeight });
    document.body.append(cv);
    const ctx = cv.getContext('2d');
    const colors = [layout.theme.accent, '#FBBF24', '#34D399', '#60A5FA', '#F472B6', '#fff'];
    const ox = r.left + r.width / 2, oy = r.top + r.height / 2;
    const ps = Array.from({ length: 70 }, () => ({ x: ox, y: oy, vx: (Math.random() - .5) * 11, vy: -Math.random() * 11 - 3, s: 4 + Math.random() * 5, c: colors[(Math.random() * colors.length) | 0], rot: Math.random() * 6, vr: (Math.random() - .5) * .4 }));
    let frames = 0;
    (function tick() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      ps.forEach(p => { p.vy += .35; p.x += p.vx; p.y += p.vy; p.rot += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, 1 - frames / 90); ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s / 1.6); ctx.restore(); });
      if (++frames < 90) requestAnimationFrame(tick); else cv.remove();
    })();
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  async function init() {
    const d = await chrome.storage.local.get([KEY, BG_KEY, PROF_KEY, 'settings']);
    bgImageData = d[BG_KEY] || '';
    layout = normalize(d[KEY]);
    scheduleCache = d.settings || null;
    if (d[PROF_KEY] && Array.isArray(d[PROF_KEY].list) && d[PROF_KEY].list.length) {
      profiles = d[PROF_KEY];
      if (!profiles.list.some(p => p.id === profiles.active)) profiles.active = profiles.list[0].id;
      // the active profile owns the saved layout
      const ap = profiles.list.find(p => p.id === profiles.active);
      if (ap) ap.layout = clone(layout);
    } else { profiles.list[0].layout = clone(layout); }
    board = $('#widgetBoard');
    bgLayer = el('div', { id: 'wbBg', 'aria-hidden': 'true' });
    document.body.prepend(bgLayer);
    applyTheme();
    buildChrome();
    initDnD();
    render();
    maybeWelcome(!!d[KEY]);
    applyAuto();
    setInterval(async () => { scheduleCache = (await chrome.storage.local.get(['settings'])).settings || scheduleCache; applyAuto(); }, 60000);
    chrome.storage.onChanged.addListener((c, area) => {
      // keep several open new tabs in sync with the saved layout (ignore our own debounced writes)
      if (area === 'local' && c[KEY] && !editing && JSON.stringify(c[KEY].newValue) !== JSON.stringify(layout)) { layout = normalize(c[KEY].newValue); first = false; applyTheme(); render(); }
    });
  }

  window.EyeTimeBoard = { init, confetti, register, kit: { el, t, tr, lang, card, head, every, dayKey, fmtDur, save, openSettings, SEARCH_URLS, normUrl, scale, updateAll, getLayout: () => layout }, CATALOG };
})();
