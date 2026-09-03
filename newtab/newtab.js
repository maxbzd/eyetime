// EyeTime — Daily Cockpit Master Logic
// Features: Auto-Synced Phone TickTick Tasks, Mental Scratchpad, Anti-Leak Kill-Switch, Work Launchpad, Hero Focus Block, 90-Day Challenge, Focus Bar Chart

document.addEventListener('DOMContentLoaded', async () => {
  // Check First-Time User Onboarding
  try {
    const onboardData = await chrome.storage.local.get('eyetime_onboarded');
    if (!onboardData.eyetime_onboarded) {
      window.location.href = chrome.runtime.getURL('onboarding/onboarding.html');
      return;
    }
  } catch (e) {}

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

  const todayKey = new Date().toISOString().slice(0, 10);
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

// ── 4. HERO 90-DAY CHALLENGE & MATRIX MODAL (Card 3) ──────────────────
function initHero90DayChallenge(interceptor) {
  const todayWalkCheck = document.getElementById('todayWalkCheck');
  const todayCareCheck = document.getElementById('todayCareCheck');
  const streakTag = document.getElementById('streakCountTag');
  const challengeDaysText = document.getElementById('challengeDaysText');
  const milestoneTag = document.getElementById('milestoneTag');
  const openModalBtn = document.getElementById('openMatrixModalBtn');
  const modal = document.getElementById('matrixModal');
  const closeModalBtn = document.getElementById('closeMatrixModalBtn');
  const modalWalkCheck = document.getElementById('modalWalkCheck');
  const modalCareCheck = document.getElementById('modalCareCheck');
  const modalSelectedDayInfo = document.getElementById('modalSelectedDayInfo');
  const grid = document.getElementById('matrixGrid');

  const totalDays = interceptor.challenges?.totalDays || 90;
  const todayStr = new Date().toISOString().slice(0, 10);
  interceptor.challenges = interceptor.challenges || {};

  if (!interceptor.challenges.startDate) {
    interceptor.challenges.startDate = todayStr;
    saveInterceptor(interceptor);
  }

  const startDate = new Date(interceptor.challenges.startDate + 'T00:00:00');
  const todayDate = new Date(todayStr + 'T00:00:00');
  const diffDays = Math.floor((todayDate - startDate) / (1000 * 60 * 60 * 24));
  const todayIndex = Math.min(totalDays, Math.max(1, diffDays + 1));

  let completedMap = interceptor.challenges.completedDays || {};
  let selectedIndex = todayIndex;

  if (!completedMap[todayIndex]) {
    completedMap[todayIndex] = {
      walk: !!interceptor.morningWalkDone,
      care: false
    };
  }

  function syncChecks() {
    const todayData = completedMap[todayIndex] || { walk: false, care: false };
    todayWalkCheck.checked = !!todayData.walk;
    todayCareCheck.checked = !!todayData.care;

    if (modalWalkCheck && modalCareCheck) {
      const selData = completedMap[selectedIndex] || { walk: false, care: false };
      modalWalkCheck.checked = !!selData.walk;
      modalCareCheck.checked = !!selData.care;
      if (modalSelectedDayInfo) {
        modalSelectedDayInfo.textContent = (selectedIndex === todayIndex) 
          ? `День ${selectedIndex} (Сегодня):` 
          : `День ${selectedIndex}:`;
      }
    }
  }

  async function updateChallenge(walk, care, dayIdx) {
    if (!completedMap[dayIdx]) completedMap[dayIdx] = {};
    completedMap[dayIdx].walk = walk;
    completedMap[dayIdx].care = care;

    if (dayIdx === todayIndex) {
      interceptor.morningWalkDone = walk;
    }

    interceptor.challenges.completedDays = completedMap;
    await saveInterceptor(interceptor);
    syncChecks();
    renderMatrix();
  }

  todayWalkCheck.addEventListener('change', () => {
    updateChallenge(todayWalkCheck.checked, todayCareCheck.checked, todayIndex);
  });

  todayCareCheck.addEventListener('change', () => {
    updateChallenge(todayWalkCheck.checked, todayCareCheck.checked, todayIndex);
  });

  if (modalWalkCheck && modalCareCheck) {
    modalWalkCheck.addEventListener('change', () => {
      updateChallenge(modalWalkCheck.checked, modalCareCheck.checked, selectedIndex);
    });
    modalCareCheck.addEventListener('change', () => {
      updateChallenge(modalWalkCheck.checked, modalCareCheck.checked, selectedIndex);
    });
  }

  function calculateStreak() {
    let streak = 0;
    for (let i = todayIndex; i >= 1; i--) {
      if (completedMap[i] && (completedMap[i].walk || completedMap[i].care)) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  function renderMatrix() {
    grid.innerHTML = '';
    let completedCount = 0;

    for (let i = 1; i <= totalDays; i++) {
      const cell = document.createElement('div');
      cell.className = 'matrix-cell';

      const dayData = completedMap[i];
      let walkStr = 'Прогулка: Нет';
      let careStr = 'Уход: Нет';

      if (dayData) {
        if (dayData.walk) walkStr = 'Прогулка: Да';
        if (dayData.care) careStr = 'Уход: Да';

        if (dayData.walk && dayData.care) {
          cell.classList.add('done-both');
          completedCount++;
        } else if (dayData.walk || dayData.care) {
          cell.classList.add('done-half');
        }
      }

      if (i === todayIndex) cell.classList.add('is-today');
      if (i === selectedIndex) cell.classList.add('is-selected');

      cell.title = `День ${i}${i === todayIndex ? ' (Сегодня)' : ''}: ${walkStr} | ${careStr}`;

      cell.addEventListener('click', () => {
        selectedIndex = i;
        syncChecks();
        renderMatrix();
      });

      grid.appendChild(cell);
    }

    const currentStreak = calculateStreak();
    if (streakTag) streakTag.textContent = `Стрик: ${currentStreak} дн.`;

    const remainingToMilestone = Math.max(0, 30 - completedCount);
    if (milestoneTag) milestoneTag.textContent = `До рубежа: ${remainingToMilestone} дн.`;
    if (challengeDaysText) challengeDaysText.textContent = `День ${todayIndex} из ${totalDays}`;
  }

  // Modal handlers
  if (openModalBtn && modal) {
    openModalBtn.addEventListener('click', () => {
      modal.classList.remove('hidden');
      renderMatrix();
    });
  }

  if (closeModalBtn && modal) {
    closeModalBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal) {
      modal.classList.add('hidden');
    }
  });

  syncChecks();
  renderMatrix();
}

// ── 5. TICKTICK TASKS (AUTO-SYNC WITH PHONE & INBOX QUICK CAPTURE) ───
function initSmartTasksList(goals, ttSettings) {
  const container = document.getElementById('threeTasksContainer');
  const toggleAllBtn = document.getElementById('toggleAllTasksBtn');
  const syncBtn = document.getElementById('syncTicktickBtn');
  const quickInput = document.getElementById('quickCaptureInput');
  const syncBadge = document.getElementById('ttSyncBadge');

  const defaultTasks = [
    { text: 'Сфокусироваться на главной задаче дня', done: false, isStarred: true, priority: 5 },
    { text: 'Провести рабочий созвон / встречу', done: false, priority: 3 },
    { text: 'Подвести итоги дня перед отбоем', done: false, priority: 1 }
  ];

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
        <input type="checkbox" class="task-check" ${main.done ? 'checked' : ''} data-id="${main.id || main.text}">
        <div class="main-task-content">
          <span class="main-task-badge">ЦЕЛЬ ДНЯ ${main.priority === 5 ? '· Высокий приоритет' : ''}</span>
          <span class="main-task-title">${main.text}</span>
        </div>
      </div>
      <button class="star-main-btn ${main.isStarred ? 'active' : ''}" data-id="${main.id || main.text}" title="Главная задача дня">★</button>
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
            <input type="checkbox" class="task-check" ${sub.done ? 'checked' : ''} data-id="${sub.id || sub.text}">
            <span class="sub-task-title">${sub.text}</span>
          </div>
          <button class="star-main-btn ${sub.isStarred ? 'active' : ''}" data-id="${sub.id || sub.text}" title="Сделать главной целью">★</button>
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
            <input type="checkbox" class="task-check" ${t.done ? 'checked' : ''} data-id="${t.id || t.text}">
            <span class="sub-task-title">${t.text}</span>
          </div>
          <button class="star-main-btn ${t.isStarred ? 'active' : ''}" data-id="${t.id || t.text}" title="Сделать главной целью">★</button>
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

  const defaultThoughts = [
    { id: 1, text: 'Посмотреть обзор микрофона', time: '14:20' }
  ];

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
        <span class="scratchpad-text">${th.text}</span>
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

  const defaultLabels = [
    { label: 'Сессий глубокого фокуса', defaultTarget: 4 },
    { label: 'Важных закрытых задач', defaultTarget: 5 }
  ];

  let counters = interceptor.uncomfortableCounters || [];

  if (!counters || counters.length === 0) {
    counters = [
      { label: defaultLabels[0].label, current: 0, target: defaultLabels[0].defaultTarget, isCounter: true },
      { label: defaultLabels[1].label, current: 0, target: defaultLabels[1].defaultTarget, isCounter: true }
    ];
    interceptor.uncomfortableCounters = counters;
    saveInterceptor(interceptor);
  }

  function render() {
    grid.innerHTML = '';
    counters.slice(0, 2).forEach((c, idx) => {
      const card = document.createElement('div');
      card.className = 'uncomfortable-compact-card';

      const pct = Math.min(100, Math.round((c.current / (c.target || 1)) * 100));

      card.innerHTML = `
        <div class="unc-top">
          <span class="unc-lbl">${c.label}</span>
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
        const dateKey = d.toISOString().slice(0, 10);
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
          const k = curr.toISOString().slice(0, 10);
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

// ── 9. BEDTIME COUNTDOWN ─────────────────────────────────────────────
function initBedtimeCountdown(interceptor) {
  const label = document.getElementById('fixedBedtimeLabel');
  const timeVal = document.getElementById('bedtimeTimeVal');
  const bedtimeStr = interceptor.bedtime || '23:00';

  if (label) label.textContent = bedtimeStr;

  function update() {
    const [bHrs, bMins] = bedtimeStr.split(':').map(Number);
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const bedMins = bHrs * 60 + bMins;

    let diff = bedMins - currentMins;
    if (diff < 0) diff += 24 * 60;

    const h = Math.floor(diff / 60);
    const m = diff % 60;
    if (timeVal) timeVal.textContent = `${h}ч ${m}м`;
  }

  update();
  setInterval(update, 30000);
}

// ── 10. SCREEN MODES & NIGHT LOCKDOWN ────────────────────────────────
function initScreenMode(interceptor, ttSettings) {
  const unlockBtn = document.getElementById('unlockDayBtn');
  const modeToggleBtn = document.getElementById('toggleDayNightModeBtn');

  const [bedtimeH, bedtimeM] = (interceptor.bedtime || '23:00').split(':').map(Number);
  const now = new Date();
  const currentTotalMins = now.getHours() * 60 + now.getMinutes();
  const bedtimeTotalMins = bedtimeH * 60 + bedtimeM;

  let isNight = (currentTotalMins >= bedtimeTotalMins || currentTotalMins < 5 * 60);

  if (interceptor.nightModeBypassed) {
    isNight = false;
  }

  function applyMode() {
    if (isNight) {
      document.body.className = 'mode-night';
      if (modeToggleBtn) {
        modeToggleBtn.classList.add('mode-night-active');
        modeToggleBtn.innerHTML = '<span class="mode-indicator-dot"></span><span>Режим: Сон</span>';
      }
    } else {
      document.body.className = 'mode-day';
      if (modeToggleBtn) {
        modeToggleBtn.classList.remove('mode-night-active');
        modeToggleBtn.innerHTML = '<span class="mode-indicator-dot"></span><span>Режим: День</span>';
      }
    }
  }

  if (unlockBtn) {
    unlockBtn.addEventListener('click', async () => {
      isNight = false;
      interceptor.nightModeBypassed = true;
      await saveInterceptor(interceptor);
      applyMode();
      showSyncToast('☀️ Ночной режим отключен. День активен!');
    });
  }

  if (modeToggleBtn) {
    modeToggleBtn.addEventListener('click', async () => {
      isNight = !isNight;
      interceptor.nightModeBypassed = !isNight;
      await saveInterceptor(interceptor);
      applyMode();
      showSyncToast(isNight ? '🌙 Включен режим Сна' : '☀️ Включен режим Дня');
    });
  }

  applyMode();
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
