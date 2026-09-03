// EyeTime Desktop — Frontend Master Controller
const API_BASE = 'http://127.0.0.1:8765';

let selectedFocusMins = 90;
let isFocusActive = false;

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initFocusControls();
  initBlocker();
  initShield();
  
  // Start polling daemon state
  pollStatus();
  setInterval(pollStatus, 1000);

  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      pollStatus(true);
      fetchTimeline();
    });
  }
});

// ── Tabs Navigation ──────────────────────────────────────
function initTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  const panes = document.querySelectorAll('.tab-pane');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const targetId = `pane-${tab.getAttribute('data-tab')}`;
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add('active');
        if (tab.getAttribute('data-tab') === 'timeline') {
          fetchTimeline();
        }
      }
    });
  });
}

// ── Poll Status from Python Daemon ───────────────────────
async function pollStatus(showNotification = false) {
  try {
    const res = await fetch(`${API_BASE}/api/status`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Daemon unreachable');
    const data = await res.json();

    // 1. Live Foreground Window info
    const liveAppName = document.getElementById('liveAppName');
    const liveCategory = document.getElementById('liveCategory');
    const liveDot = document.getElementById('liveDot');
    const mainActiveApp = document.getElementById('mainActiveApp');
    const mainActiveTitle = document.getElementById('mainActiveTitle');
    const mainActiveExe = document.getElementById('mainActiveExe');
    const mainActiveCategory = document.getElementById('mainActiveCategory');
    const mainIdleSec = document.getElementById('mainIdleSec');
    const cardStatusBadge = document.getElementById('cardStatusBadge');

    const appName = data.activeApp || 'Рабочий стол';
    const category = data.category || 'Система';
    const title = data.windowTitle || '';
    const exe = data.exeName || '';
    const isIdle = !!data.isIdle;
    const idleSec = data.idleSeconds || 0;

    if (liveAppName) liveAppName.textContent = appName;
    if (liveCategory) liveCategory.textContent = category;
    if (mainActiveApp) mainActiveApp.textContent = appName;
    if (mainActiveTitle) mainActiveTitle.textContent = title || 'Окно без заголовка';
    if (mainActiveExe) mainActiveExe.textContent = exe || '--';
    if (mainActiveCategory) mainActiveCategory.textContent = category;
    if (mainIdleSec) mainIdleSec.textContent = `${idleSec} сек`;

    // Dot and badge state
    if (liveDot) {
      liveDot.className = 'live-dot';
      if (isIdle) {
        liveDot.classList.add('idle');
        if (cardStatusBadge) {
          cardStatusBadge.textContent = 'AFK / Простой';
          cardStatusBadge.style.color = 'var(--fx-fg-3)';
          cardStatusBadge.style.borderColor = 'rgba(255,255,255,0.1)';
        }
      } else if (data.isDistraction) {
        liveDot.classList.add('distraction');
        if (cardStatusBadge) {
          cardStatusBadge.textContent = 'Отвлечение';
          cardStatusBadge.style.color = 'var(--fx-rose)';
          cardStatusBadge.style.borderColor = 'rgba(251, 113, 133, 0.3)';
        }
      } else {
        if (cardStatusBadge) {
          cardStatusBadge.textContent = 'В фокусе';
          cardStatusBadge.style.color = 'var(--fx-mint)';
          cardStatusBadge.style.borderColor = 'rgba(52, 211, 153, 0.3)';
        }
      }
    }

    // 2. Focus Block Timer State
    const timerDisplay = document.getElementById('desktopTimerDisplay');
    const focusStatus = document.getElementById('desktopFocusStatus');
    const launchBtn = document.getElementById('desktopToggleFocusBtn');
    const focusTaskSub = document.getElementById('focusTaskSub');

    isFocusActive = !!data.focusBlockActive;
    const remainingSec = data.focusRemainingSec || 0;

    if (isFocusActive) {
      const m = Math.floor(remainingSec / 60);
      const s = remainingSec % 60;
      if (timerDisplay) timerDisplay.textContent = `${m}:${String(s).padStart(2, '0')}`;
      if (focusStatus) {
        focusStatus.textContent = 'АКТИВЕН';
        focusStatus.style.background = '#FFFFFF';
        focusStatus.style.color = 'var(--fx-orange)';
      }
      if (launchBtn) {
        launchBtn.textContent = 'Остановить фокус-блок';
        launchBtn.classList.add('active-btn');
      }
      if (focusTaskSub) focusTaskSub.textContent = data.focusTask || 'Глубокая концентрация';
    } else {
      if (timerDisplay && !launchBtn?.classList.contains('active-btn')) {
        timerDisplay.textContent = `${selectedFocusMins}:00`;
      }
      if (focusStatus) {
        focusStatus.textContent = 'Не активен';
        focusStatus.style.background = 'rgba(0,0,0,0.25)';
        focusStatus.style.color = 'rgba(255,255,255,0.9)';
      }
      if (launchBtn) {
        launchBtn.textContent = `Запустить ${selectedFocusMins}м Фокус-Блок`;
        launchBtn.classList.remove('active-btn');
      }
      if (focusTaskSub) focusTaskSub.textContent = 'Глубокая концентрация';
    }

    // 3. Metrics
    const prodSec = data.todayProductiveSeconds || 0;
    const distSec = data.todayDistractionSeconds || 0;
    const totalIdleSec = data.todayIdleSeconds || 0;

    const prodElem = document.getElementById('metricProdTime');
    const distElem = document.getElementById('metricDistTime');
    const idleElem = document.getElementById('metricIdleTime');
    const scoreElem = document.getElementById('metricScore');

    if (prodElem) {
      const ph = Math.floor(prodSec / 3600);
      const pm = Math.floor((prodSec % 3600) / 60);
      prodElem.textContent = (ph > 0) ? `${ph}ч ${pm}м` : `${pm}м`;
    }

    if (distElem) {
      const dh = Math.floor(distSec / 3600);
      const dm = Math.floor((distSec % 3600) / 60);
      distElem.textContent = (dh > 0) ? `${dh}ч ${dm}м` : `${dm}м`;
    }

    if (idleElem) {
      const ih = Math.floor(totalIdleSec / 3600);
      const im = Math.floor((totalIdleSec % 3600) / 60);
      idleElem.textContent = (ih > 0) ? `${ih}ч ${im}м` : `${im}м`;
    }

    if (scoreElem) {
      const totalTracked = prodSec + distSec;
      const pct = totalTracked > 0 ? Math.round((prodSec / totalTracked) * 100) : 100;
      scoreElem.textContent = `${pct}%`;
    }

    // 4. Bedtime
    const bedtimeVal = document.getElementById('headerBedtimeVal');
    if (bedtimeVal && data.bedtimeCountdown) {
      bedtimeVal.textContent = data.bedtimeCountdown;
    }

    if (showNotification) {
      showDesktopToast('✓ Данные обновлены');
    }
  } catch (err) {
    const liveAppName = document.getElementById('liveAppName');
    if (liveAppName) liveAppName.textContent = 'Связь с демоном...';
  }
}

// ── Focus Controls ───────────────────────────────────────
function initFocusControls() {
  const durBtns = document.querySelectorAll('.dur-btn');
  const timerDisplay = document.getElementById('desktopTimerDisplay');
  const launchBtn = document.getElementById('desktopToggleFocusBtn');
  const strictCheck = document.getElementById('desktopStrictLockCheck');

  durBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      durBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedFocusMins = parseInt(btn.getAttribute('data-mins'), 10);
      if (!isFocusActive) {
        if (timerDisplay) timerDisplay.textContent = `${selectedFocusMins}:00`;
        if (launchBtn) launchBtn.textContent = `Запустить ${selectedFocusMins}м Фокус-Блок`;
      }
    });
  });

  if (launchBtn) {
    launchBtn.addEventListener('click', async () => {
      try {
        const willActivate = !isFocusActive;
        await fetch(`${API_BASE}/api/focus_block`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            active: willActivate,
            durationMins: selectedFocusMins,
            strict: strictCheck?.checked || false
          })
        });
        if (willActivate) {
          if (window.EyeTimeAudio) {
            window.EyeTimeAudio.playFocusGong();
          }
          window.open('https://app.endel.io/player/focus', '_blank');
        }
        pollStatus();
      } catch (err) {}
    });
  }
}

// ── Timeline Fetch & Render (Real 24-Hour Hourly View) ────
async function fetchTimeline() {
  const stage = document.getElementById('timelineBarStage');
  const table = document.getElementById('appsTableContainer');
  if (!stage) return;

  try {
    const res = await fetch(`${API_BASE}/api/timeline`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();

    stage.innerHTML = '';
    const hours = data.hours || [];

    if (hours.length === 0) {
      stage.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;color:var(--fx-fg-3);font-size:11px;">Таймлайн накапливает активность за день...</div>';
    } else {
      hours.forEach(h => {
        const slot = document.createElement('div');
        slot.className = `hourly-slot ${h.isCurrent ? 'current' : ''} ${h.isFuture ? 'future' : ''}`;

        const totalActiveMins = h.productiveMins + h.distractionMins;
        const heightPct = h.isFuture ? 0 : Math.min(100, Math.max(6, Math.round((totalActiveMins / 60) * 100)));
        const isDistDominant = h.distractionMins > h.productiveMins;

        slot.innerHTML = `
          <div class="hourly-tooltip">
            <strong>${h.label} — ${String(h.hour + 1).padStart(2, '0')}:00</strong>
            ${h.isFuture ? '<div>Еще не наступил</div>' : `
              <div>Фокус: <span style="color:var(--fx-orange);font-weight:700;">${Math.round(h.productiveMins)}м</span></div>
              <div>Отвлечения: <span style="color:var(--fx-rose);font-weight:700;">${Math.round(h.distractionMins)}м</span></div>
              <div>Простой: <span style="color:var(--fx-fg-3);">${Math.round(h.idleMins)}м</span></div>
            `}
          </div>
          ${!h.isFuture ? `<div class="hourly-fill ${isDistDominant ? 'dist' : 'work'}" style="height: ${heightPct}%;"></div>` : ''}
        `;
        stage.appendChild(slot);
      });
    }

    if (table) {
      table.innerHTML = '';
      const topApps = data.topApps || [];
      if (topApps.length === 0) {
        table.innerHTML = '<div style="color:var(--fx-fg-3);font-size:12px;padding:12px;">Статистика программ появится по мере работы за ПК</div>';
      } else {
        topApps.forEach(app => {
          const row = document.createElement('div');
          row.className = 'app-row';
          row.innerHTML = `
            <div class="app-row-name">
              <span>${app.name}</span>
              <span class="live-category-badge">${app.category}</span>
            </div>
            <span class="app-row-time">${app.timeStr}</span>
          `;
          table.appendChild(row);
        });
      }
    }
  } catch (err) {}
}

// ── App Blocker List & Custom Exe ─────────────────────────
async function initBlocker() {
  const list = document.getElementById('blockedAppsList');
  const input = document.getElementById('customExeInput');
  const addBtn = document.getElementById('addBlockExeBtn');
  if (!list) return;

  const defaultBlocked = [
    { title: 'Telegram Desktop', exe: 'telegram.exe', enabled: true },
    { title: 'Steam', exe: 'steam.exe', enabled: true },
    { title: 'Discord', exe: 'discord.exe', enabled: true },
    { title: 'Counter-Strike 2', exe: 'cs2.exe', enabled: true },
    { title: 'Dota 2', exe: 'dota2.exe', enabled: true },
    { title: 'Epic Games Launcher', exe: 'epicgameslauncher.exe', enabled: true }
  ];

  async function loadApps() {
    try {
      const res = await fetch(`${API_BASE}/api/apps`, { cache: 'no-store' });
      const apps = res.ok ? (await res.json()).blockedApps : defaultBlocked;
      renderApps(apps);
    } catch (e) {
      renderApps(defaultBlocked);
    }
  }

  function renderApps(apps) {
    list.innerHTML = '';
    apps.forEach((app, idx) => {
      const item = document.createElement('div');
      item.className = 'blocked-app-item';
      item.innerHTML = `
        <div class="blocked-app-info">
          <span class="blocked-app-title">${app.title}</span>
          <span class="blocked-app-exe">${app.exe}</span>
        </div>
        <input type="checkbox" ${app.enabled ? 'checked' : ''} data-exe="${app.exe}">
      `;
      list.appendChild(item);
    });

    list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', async (e) => {
        const exe = e.target.getAttribute('data-exe');
        try {
          await fetch(`${API_BASE}/api/block_app`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exe, enabled: e.target.checked })
          });
          showDesktopToast(`Обновлен статус: ${exe}`);
        } catch (err) {}
      });
    });
  }

  if (addBtn && input) {
    addBtn.addEventListener('click', async () => {
      const val = input.value.trim().toLowerCase();
      if (!val) return;
      const exeName = val.endsWith('.exe') ? val : val + '.exe';
      try {
        await fetch(`${API_BASE}/api/block_app`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exe: exeName, title: exeName, enabled: true })
        });
        input.value = '';
        loadApps();
        showDesktopToast(`Добавлено: ${exeName}`);
      } catch (err) {}
    });
  }

  loadApps();
}

// ── Chrome Shield ────────────────────────────────────────
function initShield() {
  const btn = document.getElementById('reapplyPolicyBtn');
  if (btn) {
    btn.addEventListener('click', async () => {
      try {
        const res = await fetch(`${API_BASE}/api/reapply_shield`, { method: 'POST' });
        if (res.ok) {
          showDesktopToast('🔒 Защита Chrome переприменена успешно!');
        } else {
          showDesktopToast('Политики активны');
        }
      } catch (err) {
        showDesktopToast('Политики активны');
      }
    });
  }
}

// Toast
function showDesktopToast(msg) {
  let t = document.getElementById('desktopToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'desktopToast';
    t.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #181A22;
      border: 1px solid var(--fx-orange);
      border-radius: 12px;
      padding: 10px 18px;
      color: var(--fx-orange);
      font-size: 12.5px;
      font-weight: 700;
      box-shadow: 0 10px 30px rgba(0,0,0,0.8);
      z-index: 10000;
      transition: all 0.3s ease;
      opacity: 0;
      transform: translateY(10px);
    `;
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  t.style.transform = 'translateY(0)';
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(10px)';
  }, 2800);
}
