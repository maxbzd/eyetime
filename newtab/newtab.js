function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// EyeTime — Daily Cockpit Master Logic
// Features: Auto-Synced Phone TickTick Tasks, Mental Scratchpad, Anti-Leak Kill-Switch, Work Launchpad, Hero Focus Block, 90-Day Challenge, Focus Bar Chart

document.addEventListener('DOMContentLoaded', async () => {
  const data = await chrome.storage.local.get(['settings', 'stats', 'dailyGoals']);
  const settings = data.settings || {};
  const stats = data.stats || {};
  const interceptor = settings.interceptor || {};

  // Initialize all cockpit systems
  initScreenMode(interceptor, settings.ticktick);
  initWorkLaunchpad(interceptor);
  initHeroFocusBlock(interceptor);
  initAntiLeakKillSwitch(stats, settings);
  initHero90DayChallenge(interceptor);
  initSmartTasksList(data.dailyGoals || [], settings.ticktick);
  initMentalScratchpad(interceptor);
  initUncomfortableCompact(interceptor);
  initFocusBarChart(stats);
  initBedtimeCountdown(interceptor);
  initNightMode(interceptor);

  // Top header navigation
  const openDashBtn = document.getElementById('openDashboardBtn');
  if (openDashBtn) {
    openDashBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
    });
  }

  const openOptsBtn = document.getElementById('openOptionsBtn');
  if (openOptsBtn) {
    openOptsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  const heroCard2Footer = document.getElementById('heroCard2Footer');
  if (heroCard2Footer) {
    heroCard2Footer.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
    });
  }
});

// Helper: Save Interceptor Settings
async function saveInterceptor(interceptor) {
  const data = await chrome.storage.local.get('settings');
  const s = data.settings || {};
  s.interceptor = interceptor;
  await chrome.storage.local.set({ settings: s });
}

// Toast Notification
function showSyncToast(msg) {
  let toast = document.getElementById('eyetime-sync-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'eyetime-sync-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 10000;
      background: #13141B;
      border: 1px solid rgba(255, 94, 14, 0.4);
      box-shadow: 0 12px 30px rgba(0,0,0,0.8), 0 0 20px rgba(255, 94, 14, 0.25);
      border-radius: 14px;
      padding: 12px 18px;
      color: #FF5E0E;
      font-size: 13px;
      font-weight: 700;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      opacity: 0;
      transform: translateY(10px);
      pointer-events: none;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';
  clearTimeout(window.__eyetimeToastTimer);
  window.__eyetimeToastTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
  }, 3200);
}

// ── 1. WORK LAUNCHPAD (Quick Productive Links) ───────────────────────
function initWorkLaunchpad(interceptor) {
  const container = document.getElementById('workLaunchpad');
  if (!container) return;

  // Clear presets if they match the initial hardcoded defaults or if not custom
  if (Array.isArray(interceptor.workLaunchpad)) {
    const isDefault = interceptor.workLaunchpad.length === 5 &&
      interceptor.workLaunchpad[0]?.name === 'CRM' &&
      interceptor.workLaunchpad[1]?.name === 'TickTick';
    if (isDefault) {
      interceptor.workLaunchpad = [];
      saveInterceptor(interceptor);
    }
  } else {
    interceptor.workLaunchpad = [];
    saveInterceptor(interceptor);
  }

  let links = interceptor.workLaunchpad || [];

  async function addNewService() {
    const name = prompt('Название рабочего сервиса (например, CRM или Notion):');
    if (!name || !name.trim()) return;
    let url = prompt('URL ссылка (например, https://notion.so):');
    if (!url || !url.trim()) return;
    url = url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    links.push({ name: name.trim(), url, icon: '🔗' });
    interceptor.workLaunchpad = links;
    await saveInterceptor(interceptor);
    renderLaunchpad();
    showSyncToast(`✅ Сервис «${name.trim()}» добавлен в Launchpad!`);
  }

  function renderLaunchpad() {
    container.innerHTML = '';

    if (links.length === 0) {
      const emptyBtn = document.createElement('button');
      emptyBtn.className = 'launchpad-add-first-btn';
      emptyBtn.innerHTML = `<span>+</span><span>Добавить сервис</span>`;
      emptyBtn.addEventListener('click', addNewService);
      container.appendChild(emptyBtn);
      return;
    }

    links.forEach((l, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'launchpad-item-wrap';

      const a = document.createElement('a');
      a.className = 'launchpad-item';
      a.href = l.url;
      a.target = '_blank';
      a.title = `${l.name} (${l.url})`;
      a.innerHTML = `
        <span class="launchpad-icon">${l.icon || '🔗'}</span>
        <span class="launchpad-lbl">${l.name}</span>
      `;

      const delBtn = document.createElement('button');
      delBtn.className = 'launchpad-item-del';
      delBtn.title = 'Удалить';
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        links.splice(idx, 1);
        interceptor.workLaunchpad = links;
        await saveInterceptor(interceptor);
        renderLaunchpad();
      });

      wrap.appendChild(a);
      wrap.appendChild(delBtn);
      container.appendChild(wrap);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'launchpad-add-btn';
    addBtn.title = 'Добавить сервис';
    addBtn.textContent = '+';
    addBtn.addEventListener('click', addNewService);
    container.appendChild(addBtn);
  }

  renderLaunchpad();
}

// ── 2. HERO FOCUS BLOCK (Card 1: Deep Work Timer & Session Control) ───
function initHeroFocusBlock(interceptor) {
  const timerDisplay = document.getElementById('heroTimerDisplay');
  const statusText = document.getElementById('focusBlockStatusText');
  const subText = document.getElementById('heroFocusSubText');
  const toggleBtn = document.getElementById('toggleFocusBlockBtn');
  const strictCheckbox = document.getElementById('strictFocusLockCheckbox');
  const durBtns = document.querySelectorAll('.dur-btn');

  let selectedFocusMins = interceptor.selectedFocusMins || 90;
  strictCheckbox.checked = !!interceptor.strictFocusLock;

  strictCheckbox.addEventListener('change', async (e) => {
    interceptor.strictFocusLock = e.target.checked;
    await saveInterceptor(interceptor);
    if (e.target.checked) {
      showSyncToast('🔒 Хард-режим включен (отвлечения закрыты наглухо)');
    }
  });

  durBtns.forEach(btn => {
    const mins = parseInt(btn.getAttribute('data-mins'), 10);
    if (mins === selectedFocusMins) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }

    btn.addEventListener('click', async () => {
      durBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedFocusMins = mins;
      interceptor.selectedFocusMins = mins;

      if (!interceptor.focusBlockActive) {
        timerDisplay.textContent = `${selectedFocusMins}:00`;
        toggleBtn.textContent = `Запустить ${selectedFocusMins}м Фокус-Блок`;
      }
      await saveInterceptor(interceptor);
    });
  });

  const isActive = interceptor.focusBlockActive && Date.now() < (interceptor.focusBlockEndTime || 0);

  if (isActive) {
    statusText.textContent = 'АКТИВЕН';
    statusText.className = 'hero-focus-status-pill hero-focus-status-pill--active';
    toggleBtn.textContent = 'Остановить фокус-блок';
    toggleBtn.classList.add('btn-hero-stop');
    subText.textContent = interceptor.focusBlockTask || 'Фокус над задачей';

    function updateTimer() {
      const remainingMs = (interceptor.focusBlockEndTime || 0) - Date.now();
      if (remainingMs <= 0) {
        timerDisplay.textContent = '00:00';
        statusText.textContent = 'ЗАВЕРШЕН';
        statusText.className = 'hero-focus-status-pill';
        toggleBtn.textContent = 'Запустить новый блок';
        toggleBtn.classList.remove('btn-hero-stop');
        interceptor.focusBlockActive = false;
        saveInterceptor(interceptor);
        if (window.EyeTimeAudio) {
          window.EyeTimeAudio.playCompletionChime();
        }
        showSyncToast('🏆 Фокус-блок успешно завершен! Отличная работа!');
        return;
      }
      const totalSec = Math.floor(remainingMs / 1000);
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      timerDisplay.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
    }

    updateTimer();
    setInterval(updateTimer, 1000);
  } else {
    statusText.textContent = 'Не активен';
    statusText.className = 'hero-focus-status-pill';
    timerDisplay.textContent = `${selectedFocusMins}:00`;
    toggleBtn.textContent = `Запустить ${selectedFocusMins}м Фокус-Блок`;
    toggleBtn.classList.remove('btn-hero-stop');
  }

  toggleBtn.addEventListener('click', async () => {
    const data = await chrome.storage.local.get(['settings', 'dailyGoals']);
    const current = data.settings?.interceptor || {};

    if (current.focusBlockActive && Date.now() < (current.focusBlockEndTime || 0)) {
      current.focusBlockActive = false;
      showSyncToast('⏹️ Фокус-блок остановлен');
      await saveInterceptor(current);
      statusText.textContent = 'Не активен';
      statusText.className = 'hero-focus-status-pill';
      timerDisplay.textContent = `${selectedFocusMins}:00`;
      toggleBtn.textContent = `Запустить ${selectedFocusMins}м Фокус-Блок`;
      toggleBtn.classList.remove('btn-hero-stop');
      if (window.focusTimerInterval) clearInterval(window.focusTimerInterval);
    } else {
      current.focusBlockActive = true;
      current.focusBlockEndTime = Date.now() + selectedFocusMins * 60 * 1000;
      current.focusBlockInterrupts = 0;
      const goals = data.dailyGoals || [];
      current.focusBlockTask = goals[0]?.text || 'Главная задача дня';
      await saveInterceptor(current);

      // 1. Проигрываем глубокий гонг (звучит 4.8с до полного затухания)
      if (window.EyeTimeAudio) {
        window.EyeTimeAudio.playFocusGong();
      }

      // 2. Открываем Endel Focus в новой активной вкладке - пользователя сразу переносит туда,
      // а Новая вкладка остается в фоне, благодаря чему звук гонга дозвучивает плавно до конца без обрыва!
      window.open('https://app.endel.io/player/focus', '_blank');

      // 3. Обновляем статус Новой вкладки в активный без перезагрузки страницы
      statusText.textContent = 'АКТИВЕН';
      statusText.className = 'hero-focus-status-pill hero-focus-status-pill--active';
      toggleBtn.textContent = 'Остановить фокус-блок';
      toggleBtn.classList.add('btn-hero-stop');
      subText.textContent = current.focusBlockTask || 'Фокус над задачей';

      if (window.focusTimerInterval) clearInterval(window.focusTimerInterval);
      window.focusTimerInterval = setInterval(() => {
        const remainingMs = (current.focusBlockEndTime || 0) - Date.now();
        if (remainingMs <= 0) {
          timerDisplay.textContent = '00:00';
          statusText.textContent = 'ЗАВЕРШЕН';
          statusText.className = 'hero-focus-status-pill';
          toggleBtn.textContent = `Запустить ${selectedFocusMins}м Фокус-Блок`;
          toggleBtn.classList.remove('btn-hero-stop');
          current.focusBlockActive = false;
          saveInterceptor(current);
          if (window.EyeTimeAudio) window.EyeTimeAudio.playCompletionChime();
          clearInterval(window.focusTimerInterval);
          return;
        }
        const totalSec = Math.floor(remainingMs / 1000);
        const mins = Math.floor(totalSec / 60);
        const secs = totalSec % 60;
        timerDisplay.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
      }, 1000);
    }
  });
}

// ── 3. ANTI-LEAK KILL SWITCH (Card 2: Distraction Leaks & 1-Click Cutoff) ───
function initAntiLeakKillSwitch(stats, settings) {
  const container = document.getElementById('antiLeakContent');
  const pill = document.getElementById('antiLeakPill');
  if (!container) return;

  const todayKey = localDateKey();
  const todayDomains = stats[todayKey]?.domains || {};

  const distractionList = [
    'youtube.com', 'vk.com', 'reddit.com', 'twitch.tv', 'tiktok.com',
    'instagram.com', 'twitter.com', 'x.com', 'avito.ru', 'hh.ru', 'netflix.com'
  ];

  const leaks = [];
  Object.entries(todayDomains).forEach(([domain, sec]) => {
    if (distractionList.some(d => domain.includes(d)) && sec >= 60) {
      leaks.push({ domain, mins: Math.round(sec / 60) });
    }
  });

  leaks.sort((a, b) => b.mins - a.mins);

  if (leaks.length === 0) {
    pill.textContent = '100% контроль';
    pill.className = 'hero-delta-pill pill-mint';
    container.innerHTML = `
      <div class="anti-leak-empty">
        <div class="anti-leak-clean-text">0м отвлечений сегодня</div>
        <div class="anti-leak-sub">Все посещенные сайты — продуктивные</div>
      </div>
    `;
    return;
  }

  const totalDistMins = leaks.reduce((acc, curr) => acc + curr.mins, 0);
  pill.textContent = `-${totalDistMins}м утечек`;
  pill.className = 'hero-delta-pill pill-amber';

  container.innerHTML = '';
  const topLeaks = leaks.slice(0, 2);

  topLeaks.forEach(item => {
    const row = document.createElement('div');
    row.className = 'anti-leak-row';

    const hardBlocked = settings.hardBlockedDomains || [];
    const isBlocked = hardBlocked.includes(item.domain);

    row.innerHTML = `
      <div class="anti-leak-info">
        <span class="anti-leak-dot"></span>
        <span class="anti-leak-domain">${item.domain}</span>
        <span class="anti-leak-time">${item.mins}м</span>
      </div>
      <button class="btn-anti-leak-kill ${isBlocked ? 'blocked' : ''}" data-domain="${item.domain}">
        ${isBlocked ? 'Заблокирован 🔒' : 'Блок до вечера'}
      </button>
    `;
    container.appendChild(row);
  });

  container.querySelectorAll('.btn-anti-leak-kill').forEach(btn => {
    btn.addEventListener('click', async () => {
      const dom = btn.getAttribute('data-domain');
      const data = await chrome.storage.local.get('settings');
      const s = data.settings || {};
      s.hardBlockedDomains = s.hardBlockedDomains || [];

      if (!s.hardBlockedDomains.includes(dom)) {
        s.hardBlockedDomains.push(dom);
        await chrome.storage.local.set({ settings: s });
        btn.textContent = 'Заблокирован 🔒';
        btn.classList.add('blocked');
        showSyncToast(`🔒 Домен ${dom} заблокирован до конца дня!`);
      } else {
        s.hardBlockedDomains = s.hardBlockedDomains.filter(d => d !== dom);
        await chrome.storage.local.set({ settings: s });
        btn.textContent = 'Блок до вечера';
        btn.classList.remove('blocked');
        showSyncToast(`🔓 Домен ${dom} разблокирован`);
      }
    });
  });
}

// ── 4. HABIT TRACKER / N-DAY CHALLENGE (Card 3) ───────────────────────
const DAY_MS = 86400000;
const localKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const newHabitId = () => 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const HABIT_INPUT_STYLE = 'background:rgba(255,255,255,.06);color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:8px 10px;font:inherit;font-size:13px;';
const HABIT_BTN_STYLE = 'background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.16);border-radius:10px;padding:8px 12px;font:inherit;font-size:12px;font-weight:600;cursor:pointer;';
const DURATION_OPTIONS = [7, 21, 30, 66, 90, 180, 365];

// Builds the habits object, migrating the legacy fixed "walk / skincare" 90-day challenge if present
function loadHabits(interceptor) {
  if (interceptor.habits && Array.isArray(interceptor.habits.items)) return interceptor.habits;
  const legacy = interceptor.challenges || {};
  const start = legacy.startDate || localKey(new Date());
  const habits = { items: [], totalDays: legacy.totalDays || 30, startDate: start, log: {} };
  const done = legacy.completedDays || {};
  if (Object.keys(done).length) {
    habits.totalDays = legacy.totalDays || 90;
    habits.items = [{ id: 'walk', name: 'Утренняя прогулка' }, { id: 'care', name: 'Уход за лицом' }];
    Object.entries(done).forEach(([idx, d]) => {
      const key = localKey(new Date(new Date(start + 'T00:00:00').getTime() + (Number(idx) - 1) * DAY_MS));
      const ids = [d.walk && 'walk', d.care && 'care'].filter(Boolean);
      if (ids.length) habits.log[key] = ids;
    });
  } else {
    const tr = (s) => (window.EyeTimeI18n ? window.EyeTimeI18n.t(s) : s);
    habits.items = [{ id: 'move', name: tr('Движение 20+ минут') }, { id: 'read', name: tr('Чтение 15+ минут') }];
  }
  return habits;
}

function initHero90DayChallenge(interceptor) {
  const $ = (id) => document.getElementById(id);
  const habitsList = $('habitsList');
  if (!habitsList) return;

  const habits = loadHabits(interceptor);
  interceptor.habits = habits;
  const persist = () => saveInterceptor(interceptor);
  persist();

  const dayIndexOf = (date) => Math.floor((new Date(localKey(date) + 'T00:00:00') - new Date(habits.startDate + 'T00:00:00')) / DAY_MS) + 1;
  const dateOfIndex = (i) => new Date(new Date(habits.startDate + 'T00:00:00').getTime() + (i - 1) * DAY_MS);
  const doneOn = (key) => (habits.log[key] || []).filter(id => habits.items.some(h => h.id === id));
  const isFull = (key) => habits.items.length > 0 && doneOn(key).length === habits.items.length;

  let selectedIndex = Math.min(habits.totalDays, Math.max(1, dayIndexOf(new Date())));

  function todayState() {
    const idx = dayIndexOf(new Date());
    return { idx, finished: idx > habits.totalDays, key: localKey(new Date()) };
  }

  function makeCheck(cls, habit, key, disabled) {
    const label = document.createElement('label');
    label.className = cls;
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = doneOn(key).includes(habit.id);
    cb.disabled = !!disabled;
    cb.addEventListener('change', () => toggle(key, habit.id, cb.checked));
    const span = document.createElement('span');
    span.textContent = habit.name;
    label.append(cb, span);
    return label;
  }

  async function toggle(key, id, on) {
    const set = new Set(habits.log[key] || []);
    on ? set.add(id) : set.delete(id);
    if (set.size) habits.log[key] = [...set]; else delete habits.log[key];
    await persist();
    render();
  }

  function calculateStreak() {
    const d = new Date();
    if (!isFull(localKey(d))) d.setDate(d.getDate() - 1); // today may still be in progress
    let streak = 0;
    while (dayIndexOf(d) >= 1 && isFull(localKey(d))) { streak++; d.setDate(d.getDate() - 1); }
    return streak;
  }

  function render() {
    const { idx, finished, key } = todayState();
    const total = habits.totalDays;

    habitsList.innerHTML = '';
    if (!habits.items.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'Нет привычек. Добавьте первую!';
      habitsList.appendChild(empty);
    }
    habits.items.forEach(h => habitsList.appendChild(makeCheck('hero-habit-item', h, key, finished)));

    const doneToday = doneOn(key).length;
    $('milestoneTag').textContent = finished ? 'Челлендж завершён 🎉' : `Сегодня: ${doneToday}/${habits.items.length}`;
    $('challengeDaysText').textContent = finished ? `День ${total} из ${total}` : `День ${idx} из ${total}`;
    $('streakCountTag').textContent = `Стрик: ${calculateStreak()} дн.`;
    $('gridFooterLabel').textContent = `Сетка ${total} дней`;
    $('matrixTitle').textContent = `Челлендж ${total} дней`;

    // Modal: selected day checks
    const selKey = localKey(dateOfIndex(selectedIndex));
    const isToday = selectedIndex === idx;
    $('modalSelectedDayInfo').textContent = `День ${selectedIndex}${isToday ? ' (Сегодня)' : ''}:`;
    const checks = $('modalHabitChecks');
    checks.innerHTML = '';
    habits.items.forEach(h => checks.appendChild(makeCheck('check-item', h, selKey, dateOfIndex(selectedIndex) > new Date())));

    renderManager();
    renderMatrix(idx);
  }

  function renderMatrix(todayIdx) {
    const grid = $('matrixGrid');
    grid.innerHTML = '';
    for (let i = 1; i <= habits.totalDays; i++) {
      const key = localKey(dateOfIndex(i));
      const done = doneOn(key).length;
      const cell = document.createElement('div');
      cell.className = 'matrix-cell';
      if (isFull(key)) cell.classList.add('done-both');
      else if (done > 0) cell.classList.add('done-half');
      if (i === todayIdx) cell.classList.add('is-today');
      if (i === selectedIndex) cell.classList.add('is-selected');
      cell.title = `День ${i}${i === todayIdx ? ' (Сегодня)' : ''}: ${done}/${habits.items.length}`;
      cell.addEventListener('click', () => { selectedIndex = i; render(); });
      grid.appendChild(cell);
    }
  }

  function renderManager() {
    const box = $('habitManager');
    box.innerHTML = '';
    habits.items.forEach(h => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px';
      const input = document.createElement('input');
      input.type = 'text'; input.value = h.name; input.maxLength = 60; input.style.cssText = HABIT_INPUT_STYLE + 'flex:1;';
      input.addEventListener('change', async () => { h.name = input.value.trim() || h.name; await persist(); render(); });
      const del = document.createElement('button');
      del.type = 'button'; del.style.cssText = HABIT_BTN_STYLE; del.textContent = 'Удалить';
      del.addEventListener('click', async () => {
        habits.items = habits.items.filter(x => x.id !== h.id);
        await persist(); render();
      });
      row.append(input, del);
      box.appendChild(row);
    });
    const sel = $('challengeDaysSelect');
    if (!sel.options.length) {
      [...new Set([...DURATION_OPTIONS, habits.totalDays])].sort((a, b) => a - b).forEach(n => {
        const o = document.createElement('option');
        o.value = n; o.textContent = `${n} дней`;
        sel.appendChild(o);
      });
    }
    sel.value = String(habits.totalDays);
  }

  async function addHabit() {
    const input = $('newHabitInput');
    const name = input.value.trim();
    if (!name || habits.items.length >= 12) return;
    habits.items.push({ id: newHabitId(), name });
    input.value = '';
    await persist(); render();
  }
  $('addHabitBtn').addEventListener('click', addHabit);
  $('newHabitInput').addEventListener('keydown', e => { if (e.key === 'Enter') addHabit(); });

  $('challengeDaysSelect').addEventListener('change', async (e) => {
    habits.totalDays = parseInt(e.target.value, 10) || 30;
    selectedIndex = Math.min(selectedIndex, habits.totalDays);
    await persist(); render();
  });

  $('restartChallengeBtn').addEventListener('click', async () => {
    if (!confirm('Начать челлендж заново? Отметки будут очищены, привычки сохранятся.')) return;
    habits.startDate = localKey(new Date());
    habits.log = {};
    selectedIndex = 1;
    await persist(); render();
  });

  const modal = $('matrixModal');
  $('openMatrixModalBtn')?.addEventListener('click', () => { modal.classList.remove('hidden'); render(); });
  $('closeMatrixModalBtn')?.addEventListener('click', () => modal.classList.add('hidden'));
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') modal.classList.add('hidden'); });

  render();
}

// ── 5. TICKTICK TASKS (AUTO-SYNC WITH PHONE & INBOX QUICK CAPTURE) ───
function initSmartTasksList(goals, ttSettings) {
  const container = document.getElementById('threeTasksContainer');
  const toggleAllBtn = document.getElementById('toggleAllTasksBtn');
  const syncBtn = document.getElementById('syncTicktickBtn');
  const quickInput = document.getElementById('quickCaptureInput');
  const syncBadge = document.getElementById('ttSyncBadge');

  const defaultTasks = [];

  let tasks = (goals && goals.length > 0) ? goals : defaultTasks;
  let showAll = false;

  function getSortedTasks() {
    return [...tasks].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.isStarred !== b.isStarred) return a.isStarred ? -1 : 1;
      return (b.priority || 0) - (a.priority || 0);
    });
  }

  function render() {
    container.innerHTML = '';
    const sorted = getSortedTasks();

    if (sorted.length === 0) {
      container.innerHTML = '<div class="empty-state">Нет задач на сегодня. Введите новую задачу выше!</div>';
      return;
    }

    const main = sorted[0];
    const mainCard = document.createElement('div');
    mainCard.className = `task-card main-task-card ${main.done ? 'done' : ''}`;
    mainCard.innerHTML = `
      <div style="display:flex; align-items:center; gap:16px;">
        <input type="checkbox" class="task-check" ${main.done ? 'checked' : ''} data-id="${escapeHtml(main.id || main.text)}">
        <div class="main-task-content">
          <span class="main-task-badge">ЦЕЛЬ ДНЯ ${main.priority === 5 ? '· Высокий приоритет' : ''}</span>
          <span class="main-task-title">${escapeHtml(main.text)}</span>
        </div>
      </div>
      <button class="star-main-btn ${main.isStarred ? 'active' : ''}" data-id="${escapeHtml(main.id || main.text)}" title="Главная задача дня">★</button>
    `;
    container.appendChild(mainCard);

    if (sorted.length > 1) {
      const topSub = sorted.slice(1, 3);
      const subRow = document.createElement('div');
      subRow.className = 'secondary-tasks-row';

      topSub.forEach(sub => {
        const subCard = document.createElement('div');
        subCard.className = `task-card sub-task-card ${sub.done ? 'done' : ''}`;
        subCard.innerHTML = `
          <div style="display:flex; align-items:center; gap:12px;">
            <input type="checkbox" class="task-check" ${sub.done ? 'checked' : ''} data-id="${escapeHtml(sub.id || sub.text)}">
            <span class="sub-task-title">${escapeHtml(sub.text)}</span>
          </div>
          <button class="star-main-btn ${sub.isStarred ? 'active' : ''}" data-id="${escapeHtml(sub.id || sub.text)}" title="Сделать главной целью">★</button>
        `;
        subRow.appendChild(subCard);
      });

      container.appendChild(subRow);
    }

    if (showAll && sorted.length > 3) {
      const expContainer = document.createElement('div');
      expContainer.className = 'expanded-tasks-container';

      const rest = sorted.slice(3);
      rest.forEach(t => {
        const item = document.createElement('div');
        item.className = `task-card sub-task-card ${t.done ? 'done' : ''}`;
        item.innerHTML = `
          <div style="display:flex; align-items:center; gap:12px;">
            <input type="checkbox" class="task-check" ${t.done ? 'checked' : ''} data-id="${escapeHtml(t.id || t.text)}">
            <span class="sub-task-title">${escapeHtml(t.text)}</span>
          </div>
          <button class="star-main-btn ${t.isStarred ? 'active' : ''}" data-id="${escapeHtml(t.id || t.text)}" title="Сделать главной целью">★</button>
        `;
        expContainer.appendChild(item);
      });

      container.appendChild(expContainer);
    }

    if (sorted.length > 3) {
      toggleAllBtn.style.display = 'inline-flex';
      toggleAllBtn.textContent = showAll ? 'Свернуть' : `Все задачи (${sorted.length})`;
    } else {
      toggleAllBtn.style.display = 'none';
    }

    // Checkbox completion handler
    container.querySelectorAll('.task-check').forEach(cb => {
      cb.addEventListener('change', async (e) => {
        const id = e.target.getAttribute('data-id');
        const match = tasks.find(t => (t.id || t.text) === id);
        if (match) {
          match.done = e.target.checked;
          await chrome.storage.local.set({ dailyGoals: tasks });

          if (match.isTickTick && match.id && ttSettings?.token) {
            try {
              if (match.done) {
                await fetch(`https://api.ticktick.com/open/v1/task/${match.projectId || 'inbox'}/${match.id}/complete`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${ttSettings.token}` }
                });
                showSyncToast(`✅ Задача «${match.text}» завершена в TickTick!`);
              }
            } catch (err) {}
          }
        }
        render();
      });
    });

    container.querySelectorAll('.star-main-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        tasks.forEach(t => {
          t.isStarred = ((t.id || t.text) === id);
        });
        await chrome.storage.local.set({ dailyGoals: tasks });
        render();
      });
    });
  }

  toggleAllBtn.addEventListener('click', () => {
    showAll = !showAll;
    render();
  });

  // Quick inline task creation into TickTick
  quickInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const txt = quickInput.value.trim();
      if (!txt) return;

      const newTask = {
        id: 'local_' + Date.now(),
        text: txt,
        done: false,
        priority: 0,
        isTickTick: false
      };

      if (ttSettings && ttSettings.token) {
        try {
          const res = await fetch('https://api.ticktick.com/open/v1/task', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${ttSettings.token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title: txt })
          });
          if (res.ok) {
            const data = await res.json();
            newTask.id = data.id;
            newTask.isTickTick = true;
            showSyncToast(`⚡ Задача «${txt}» сохранена в TickTick!`);
          }
        } catch (err) {}
      }

      tasks.unshift(newTask);
      await chrome.storage.local.set({ dailyGoals: tasks });
      quickInput.value = '';
      render();
    }
  });

  // ── AUTOMATIC TICKTICK PHONE SYNC ENGINE ──────────────────
  async function autoSyncWithTickTick(isManual = false) {
    if (!ttSettings || !ttSettings.token) {
      if (syncBadge) syncBadge.textContent = '✓ Локальный режим';
      return;
    }

    if (syncBadge) syncBadge.textContent = '⏳ Синхронизация...';

    try {
      const activeTaskIds = new Set();
      const fetchedTasks = [];

      // 1. Fetch Inbox
      const inboxRes = await fetch('https://api.ticktick.com/open/v1/project/inbox/data', {
        headers: { 'Authorization': `Bearer ${ttSettings.token}` }
      });
      if (inboxRes.ok) {
        const inboxData = await inboxRes.json();
        (inboxData.tasks || []).forEach(t => {
          if (t.status !== 2) {
            activeTaskIds.add(t.id);
            fetchedTasks.push({
              id: t.id,
              projectId: 'inbox',
              text: t.title,
              done: false,
              priority: t.priority || 0,
              isTickTick: true
            });
          }
        });
      }

      // 2. Fetch all Projects
      const projRes = await fetch('https://api.ticktick.com/open/v1/project', {
        headers: { 'Authorization': `Bearer ${ttSettings.token}` }
      });
      if (projRes.ok) {
        const projects = await projRes.json();
        for (const proj of (projects || [])) {
          const pRes = await fetch(`https://api.ticktick.com/open/v1/project/${proj.id}/data`, {
            headers: { 'Authorization': `Bearer ${ttSettings.token}` }
          });
          if (pRes.ok) {
            const pData = await pRes.json();
            (pData.tasks || []).forEach(t => {
              if (t.status !== 2) {
                activeTaskIds.add(t.id);
                fetchedTasks.push({
                  id: t.id,
                  projectId: proj.id,
                  text: t.title,
                  done: false,
                  priority: t.priority || 0,
                  isTickTick: true
                });
              }
            });
          }
        }
      }

      // 3. COMPARE: Did the user check off tasks on their phone?
      let phoneCompletedCount = 0;
      tasks.forEach(localT => {
        if (localT.isTickTick && localT.id && !localT.done) {
          if (!activeTaskIds.has(localT.id)) {
            localT.done = true;
            phoneCompletedCount++;
          }
        }
      });

      fetchedTasks.forEach(ft => {
        if (!tasks.some(t => t.id === ft.id)) {
          tasks.push(ft);
        }
      });

      await chrome.storage.local.set({ dailyGoals: tasks });
      render();

      if (syncBadge) syncBadge.textContent = '✓ Синхронизировано с телефоном';

      if (phoneCompletedCount > 0) {
        showSyncToast(`📱 Авто-проверка: ${phoneCompletedCount} задач(и) уже закрыты на телефоне!`);
      } else if (isManual) {
        showSyncToast('✅ Задачи синхронизированы с TickTick!');
      }
    } catch (err) {
      if (syncBadge) syncBadge.textContent = '⚠️ Ошибка связи с TickTick';
      if (isManual) showSyncToast('❌ Не удалось подключиться к TickTick');
    }
  }

  if (syncBtn) {
    syncBtn.addEventListener('click', () => autoSyncWithTickTick(true));
  }

  autoSyncWithTickTick(false);
  render();
}

// ── 6. MENTAL SCRATCHPAD (Парковка мыслей / Буфер отвлечений) ─────────
function initMentalScratchpad(interceptor) {
  const input = document.getElementById('scratchpadInput');
  const list = document.getElementById('scratchpadList');
  if (!input || !list) return;

  const defaultThoughts = [];

  let thoughts = interceptor.parkedThoughts || defaultThoughts;

  function renderThoughts() {
    list.innerHTML = '';
    if (thoughts.length === 0) {
      list.innerHTML = `
        <div class="scratchpad-empty-state">
          <span class="empty-icon">🧠</span>
          <span>Нет отложенных мыслей. Мозг свободен для работы!</span>
        </div>
      `;
      return;
    }

    thoughts.forEach(th => {
      const li = document.createElement('li');
      li.className = 'scratchpad-item';
      li.innerHTML = `
        <span class="scratchpad-dot"></span>
        <span class="scratchpad-text">${escapeHtml(th.text)}</span>
        <button class="btn-remove-thought" data-id="${th.id}" title="Удалить мысль">✕</button>
      `;
      list.appendChild(li);
    });

    list.querySelectorAll('.btn-remove-thought').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        thoughts = thoughts.filter(t => t.id !== id);
        interceptor.parkedThoughts = thoughts;
        await saveInterceptor(interceptor);
        renderThoughts();
      });
    });
  }

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const val = input.value.trim();
      if (!val) return;

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      thoughts.unshift({ id: Date.now(), text: val, time: timeStr });
      interceptor.parkedThoughts = thoughts;
      await saveInterceptor(interceptor);
      input.value = '';
      renderThoughts();
      showSyncToast('🧠 Мысль припаркована. Разбор после 19:00!');
    }
  });

  renderThoughts();
}

// ── 7. UNCOMFORTABLE ACTIONS (СООБЩЕНИЯ РЕПЕТИТОРАМ + СОЗВОНЫ) ─────────
function initUncomfortableCompact(interceptor) {
  const grid = document.getElementById('uncomfortableGrid');
  if (!grid) return;

  let counters = interceptor.uncomfortableCounters || [];

  function render() {
    grid.innerHTML = '';
    counters.slice(0, 4).forEach((c, idx) => {
      const card = document.createElement('div');
      card.className = 'uncomfortable-compact-card';

      const pct = Math.min(100, Math.round((c.current / (c.target || 1)) * 100));

      card.innerHTML = `
        <div class="unc-top">
          <span class="unc-lbl">${escapeHtml(c.label)}</span>
          <div class="unc-step-btns">
            <button class="unc-btn minus" data-idx="${idx}" title="Уменьшить">−</button>
            <button class="unc-btn plus" data-idx="${idx}" title="Увеличить">+</button>
          </div>
        </div>
        <div class="unc-body">
          <span class="unc-val">${c.current}</span>
          <span class="unc-target">цель: ${c.target}</span>
        </div>
        <div class="unc-progress-track">
          <div class="unc-progress-fill" style="width: ${pct}%;"></div>
        </div>
      `;
      grid.appendChild(card);
    });

    grid.querySelectorAll('.unc-btn.plus').forEach(b => {
      b.addEventListener('click', async () => {
        const idx = parseInt(b.getAttribute('data-idx'), 10);
        counters[idx].current = (counters[idx].current || 0) + 1;
        interceptor.uncomfortableCounters = counters;
        await saveInterceptor(interceptor);
        render();
      });
    });

    grid.querySelectorAll('.unc-btn.minus').forEach(b => {
      b.addEventListener('click', async () => {
        const idx = parseInt(b.getAttribute('data-idx'), 10);
        counters[idx].current = Math.max(0, (counters[idx].current || 0) - 1);
        interceptor.uncomfortableCounters = counters;
        await saveInterceptor(interceptor);
        render();
      });
    });
  }

  render();
}

// ── 8. FOCUS HOURS BAR CHART (ДНЕВНОЙ ФОКУС / ЧАСЫ РАБОТЫ — 100% РЕАЛЬНЫЕ ДАННЫЕ) ───
function initFocusBarChart(stats) {
  const stage = document.getElementById('focusBarChartStage');
  const totalFocusElem = document.getElementById('chartTotalFocus');
  const toggleDaysBtn = document.getElementById('chartToggleDays');
  const toggleWeeksBtn = document.getElementById('chartToggleWeeks');
  if (!stage) return;

  let currentMode = 'days'; // 'days' or 'weeks'

  function renderChart() {
    stage.innerHTML = '';
    const now = new Date();

    if (currentMode === 'days') {
      const currentDayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
      const mondayOffset = (currentDayOfWeek + 6) % 7; // days since Monday (0 = Mon, 6 = Sun)

      // Monday 00:00 of the current week
      const monday = new Date(now);
      monday.setDate(now.getDate() - mondayOffset);
      monday.setHours(0, 0, 0, 0);

      const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
      const fullDayNames = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

      // Gather 100% real data for Monday through Sunday
      const weekData = [];
      let todayRealSec = 0;

      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateKey = localDateKey(d);
        const dayStats = stats[dateKey] || {};

        const isFuture = (i > mondayOffset);
        const isToday = (i === mondayOffset);
        const prodSec = isFuture ? 0 : (dayStats.productiveSeconds || 0);
        const distSec = isFuture ? 0 : (dayStats.distractionSeconds || 0);

        if (isToday) {
          todayRealSec = prodSec;
        }

        weekData.push({
          day: dayNames[i],
          fullDay: fullDayNames[i],
          dateKey,
          prodSec,
          distSec,
          isFuture,
          isToday
        });
      }

      // Display 100% truthful focus time for today in header
      if (totalFocusElem) {
        const h = Math.floor(todayRealSec / 3600);
        const m = Math.floor((todayRealSec % 3600) / 60);
        totalFocusElem.textContent = (h > 0) ? `${h}ч ${m}м` : `${m}м`;
      }

      // Benchmark ceiling: 6 hours (21600s) or maximum day in week
      const maxSec = Math.max(21600, ...weekData.map(d => d.prodSec));

      weekData.forEach(item => {
        const col = document.createElement('div');
        col.className = `chart-col ${item.isToday ? 'active' : ''}`;

        // Format focus string
        let valStr = '0м';
        if (item.prodSec > 0) {
          const h = Math.floor(item.prodSec / 3600);
          const m = Math.floor((item.prodSec % 3600) / 60);
          valStr = (h > 0) ? `${h}ч ${m}м` : `${m}м`;
        }

        // Format distraction string
        let distStr = '0м';
        if (item.distSec > 0) {
          const h = Math.floor(item.distSec / 3600);
          const m = Math.floor((item.distSec % 3600) / 60);
          distStr = (h > 0) ? `${h}ч ${m}м` : `${m}м`;
        }

        // Calculate height percentage
        let heightPct = 0;
        if (!item.isFuture && item.prodSec > 0) {
          heightPct = Math.max(12, Math.min(100, Math.round((item.prodSec / maxSec) * 100)));
        }

        col.innerHTML = `
          <div class="chart-tooltip">
            <div class="chart-tooltip-title">${item.isToday ? 'Сегодня · ' : ''}${item.fullDay} (${item.dateKey})</div>
            <div class="chart-tooltip-row">
              <span>Фокус:</span>
              <span style="color:var(--fx-orange); font-weight:700;">${valStr}</span>
            </div>
            <div class="chart-tooltip-row">
              <span>Отвлечений:</span>
              <span style="color:var(--fx-rose); font-weight:700;">${distStr}</span>
            </div>
          </div>
          <div class="chart-bar-track">
            <div class="chart-bar-fill ${item.isToday ? 'chart-bar-fill--active' : ''}" style="height: ${heightPct}%;">
              ${(item.isToday && heightPct > 0) ? '<span class="chart-bar-dot"></span>' : ''}
            </div>
          </div>
          <span class="chart-bar-lbl ${item.isToday ? 'chart-bar-lbl--active' : ''}">${item.day}</span>
        `;

        stage.appendChild(col);
      });
    } else {
      // WEEKS MODE: Last 4 Weeks of Real Data
      const weeksData = [];
      const now = new Date();

      for (let w = 3; w >= 0; w--) {
        const start = new Date(now);
        start.setDate(now.getDate() - (w * 7 + 6));
        start.setHours(0, 0, 0, 0);

        let weekProdSec = 0;
        let weekDistSec = 0;

        for (let d = 0; d < 7; d++) {
          const curr = new Date(start);
          curr.setDate(start.getDate() + d);
          const k = localDateKey(curr);
          const dayStat = stats[k] || {};
          weekProdSec += (dayStat.productiveSeconds || 0);
          weekDistSec += (dayStat.distractionSeconds || 0);
        }

        weeksData.push({
          label: (w === 0) ? 'Тек.' : `-${w}н`,
          fullName: (w === 0) ? 'Текущая неделя' : `${w} нед. назад`,
          prodSec: weekProdSec,
          distSec: weekDistSec,
          isCurrent: (w === 0)
        });
      }

      if (totalFocusElem && weeksData[3]) {
        const h = Math.floor(weeksData[3].prodSec / 3600);
        const m = Math.floor((weeksData[3].prodSec % 3600) / 60);
        totalFocusElem.textContent = (h > 0) ? `${h}ч ${m}м` : `${m}м`;
      }

      const maxSec = Math.max(36000, ...weeksData.map(w => w.prodSec));

      weeksData.forEach(item => {
        const col = document.createElement('div');
        col.className = `chart-col ${item.isCurrent ? 'active' : ''}`;

        const h = Math.floor(item.prodSec / 3600);
        const m = Math.floor((item.prodSec % 3600) / 60);
        const valStr = (h > 0) ? `${h}ч ${m}м` : `${m}м`;

        const heightPct = item.prodSec > 0 ? Math.max(12, Math.min(100, Math.round((item.prodSec / maxSec) * 100))) : 0;

        col.innerHTML = `
          <div class="chart-tooltip">
            <div class="chart-tooltip-title">${item.fullName}</div>
            <div class="chart-tooltip-row">
              <span>Фокус:</span>
              <span style="color:var(--fx-orange); font-weight:700;">${valStr}</span>
            </div>
          </div>
          <div class="chart-bar-track">
            <div class="chart-bar-fill ${item.isCurrent ? 'chart-bar-fill--active' : ''}" style="height: ${heightPct}%;">
              ${(item.isCurrent && heightPct > 0) ? '<span class="chart-bar-dot"></span>' : ''}
            </div>
          </div>
          <span class="chart-bar-lbl ${item.isCurrent ? 'chart-bar-lbl--active' : ''}">${item.label}</span>
        `;

        stage.appendChild(col);
      });
    }
  }

  if (toggleDaysBtn && toggleWeeksBtn) {
    toggleDaysBtn.addEventListener('click', () => {
      currentMode = 'days';
      toggleDaysBtn.classList.add('fintrixity-toggle-item--active');
      toggleWeeksBtn.classList.remove('fintrixity-toggle-item--active');
      renderChart();
    });

    toggleWeeksBtn.addEventListener('click', () => {
      currentMode = 'weeks';
      toggleWeeksBtn.classList.add('fintrixity-toggle-item--active');
      toggleDaysBtn.classList.remove('fintrixity-toggle-item--active');
      renderChart();
    });
  }

  renderChart();
}

// ── 9. BEDTIME COUNTDOWN (DISABLED) ───────────────────────────────────
function initBedtimeCountdown(interceptor) {
  const banner = document.getElementById('bedtimeBanner');
  if (banner) {
    banner.style.display = 'none'; // Disabled by user request
  }
}

// ── 10. SCREEN MODES & NIGHT LOCKDOWN (DISABLED) ────────────────────
function initScreenMode(interceptor, ttSettings) {
  const modeToggleBtn = document.getElementById('toggleDayNightModeBtn');

  // Completely disable automatic night lockdown
  let isNight = false;
  document.body.className = 'mode-day';

  if (modeToggleBtn) {
    modeToggleBtn.classList.remove('mode-night-active');
    modeToggleBtn.innerHTML = '<span class="mode-indicator-dot"></span><span>Режим: День</span>';
  }
}

function initNightMode(interceptor) {
  const ideaInput = document.getElementById('nightIdeaInput');
  const ideasList = document.getElementById('nightIdeasList');
  if (!ideaInput || !ideasList) return;

  function renderIdeas() {
    ideasList.innerHTML = '';
    (interceptor.nightIdeas || []).forEach(idea => {
      const li = document.createElement('li');
      li.textContent = idea;
      ideasList.appendChild(li);
    });
  }

  ideaInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && ideaInput.value.trim()) {
      if (!interceptor.nightIdeas) interceptor.nightIdeas = [];
      interceptor.nightIdeas.push(ideaInput.value.trim());
      ideaInput.value = '';
      await saveInterceptor(interceptor);
      renderIdeas();
    }
  });

  renderIdeas();
}
