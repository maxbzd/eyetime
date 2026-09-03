// EyeTime — Content Script (Anti-Doomscroll, Hard Block, Night Lockdown, YouTube Cleaner & ☢️ Fortified Nuclear Lockdown Mode)

(function () {
  let isOverlayActive = false;
  let interstitialShownThisSession = false;

  // GLOBAL HOTKEY QUICK CAPTURE MODAL (Alt+K)
  function toggleQuickCaptureModal() {
    let modal = document.getElementById('eyetime-global-quick-modal');
    if (modal) {
      modal.remove();
      return;
    }

    modal = document.createElement('div');
    modal.id = 'eyetime-global-quick-modal';
    modal.style.cssText = `
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483647 !important;
      background: rgba(5, 6, 8, 0.75) !important;
      backdrop-filter: blur(16px) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      color: #f8fafc !important;
      padding: 20px !important;
      animation: eyetime-fade-in 0.2s ease-out !important;
    `;

    modal.innerHTML = `
      <div style="width: 100%; max-width: 520px; background: #0e1017; border: 1px solid rgba(45, 212, 191, 0.5); border-radius: 20px; padding: 24px; box-shadow: 0 24px 60px rgba(0,0,0,0.9), 0 0 30px rgba(45, 212, 191, 0.2); display:flex; flex-direction:column; gap:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:800; color:#2dd4bf;">
            <span>⚡ БЫСТРЫЙ ЗАХВАТ МЫСЛИ</span>
            <span style="font-size:10px; background:rgba(45, 212, 191, 0.15); padding:2px 6px; border-radius:6px; border:1px solid rgba(45, 212, 191, 0.3);">Alt + K</span>
          </div>
          <span style="font-size:11px; color:#64748b;">Esc — закрыть</span>
        </div>

        <input type="text" id="eyetime-modal-input" placeholder="Запишите мысль... (Enter — отправить в TickTick)" style="width:100%; padding:14px 18px; border-radius:12px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15); color:#fff; font-size:15px; outline:none; font-family:inherit;" autocomplete="off">

        <div id="eyetime-modal-status" style="font-size:12px; color:#94a3b8; display:flex; justify-content:space-between;">
          <span>Enter сохранит мысль и вы сможете продолжить работу</span>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const input = document.getElementById('eyetime-modal-input');
    const status = document.getElementById('eyetime-modal-status');
    input.focus();

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        modal.remove();
      } else if (e.key === 'Enter') {
        const txt = input.value.trim();
        if (!txt) return;

        input.disabled = true;
        status.innerHTML = '<span style="color:#2dd4bf;">⏳ Сохранение в TickTick...</span>';

        chrome.runtime.sendMessage({ action: 'SAVE_QUICK_THOUGHT', text: txt }, (res) => {
          if (res && res.success) {
            status.innerHTML = `<span style="color:#2dd4bf; font-weight:700;">✅ Сохранено в ${res.target}!</span>`;
            setTimeout(() => {
              modal.remove();
            }, 600);
          } else {
            modal.remove();
          }
        });
      }
    });
  }

  // Listen to Global Shortcut Message from Background Worker
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'TOGGLE_QUICK_CAPTURE_MODAL') {
      toggleQuickCaptureModal();
    } else if (request.action === 'FORCE_NUCLEAR_LOCK') {
      showNuclearOverlay();
    }
  });

  // Listen to Keyboard Alt+K directly on web pages
  window.addEventListener('keydown', (e) => {
    if ((e.altKey && e.code === 'KeyK') || (e.ctrlKey && e.shiftKey && e.code === 'KeyK')) {
      e.preventDefault();
      toggleQuickCaptureModal();
    }
  });

  // Helper: Apply YouTube Cleaner CSS Rules directly to DOM
  function applyYouTubeCleaner(yt) {
    if (!window.location.hostname.includes('youtube.com')) return;

    let styleEl = document.getElementById('eyetime-yt-cleaner-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'eyetime-yt-cleaner-style';
      (document.head || document.documentElement).appendChild(styleEl);
    }

    if (!yt || !yt.enabled) {
      styleEl.textContent = '';
      return;
    }

    const rules = [];

    if (yt.hideHomePage) {
      rules.push('ytd-browse[page-subtype="home"] #contents, ytd-browse[page-subtype="home"] ytd-rich-grid-renderer { display: none !important; }');
    }

    if (yt.hideShorts) {
      rules.push(`
        ytd-rich-shelf-renderer[is-shorts],
        ytd-reel-shelf-renderer,
        ytd-mini-guide-entry-renderer:has(a[href*="shorts"]),
        ytd-guide-entry-renderer:has(a[href*="shorts"]),
        a[href*="/shorts"],
        ytd-notification-renderer:has(a[href*="shorts"]) { display: none !important; }
      `);
    }

    if (yt.hideComments) {
      rules.push('#comments, ytd-comments { display: none !important; }');
    }

    if (yt.hideRecommended) {
      rules.push('#related, ytd-watch-next-secondary-results-renderer { display: none !important; }');
    }

    if (yt.hideThumbnails) {
      rules.push('ytd-thumbnail, #thumbnail, .ytd-thumbnail, .ytp-videowall-still-image { display: none !important; }');
    }

    if (yt.blurThumbnails && !yt.hideThumbnails) {
      rules.push(`
        ytd-thumbnail img, #thumbnail img, img.yt-core-image {
          filter: blur(16px) !important;
          transition: filter 0.2s ease !important;
        }
        ytd-thumbnail:hover img, #thumbnail:hover img, img.yt-core-image:hover {
          filter: blur(0px) !important;
        }
      `);
    }

    if (yt.hideSubscriptions) {
      rules.push(`
        ytd-guide-section-renderer:has(a[href*="/feed/subscriptions"]),
        ytd-mini-guide-entry-renderer:has(a[href*="/feed/subscriptions"]) { display: none !important; }
      `);
    }

    if (yt.hideExplore) {
      rules.push(`
        ytd-guide-section-renderer:has(a[href*="/feed/explore"]),
        ytd-mini-guide-entry-renderer:has(a[href*="/feed/explore"]) { display: none !important; }
      `);
    }

    if (yt.hideTopBar) {
      rules.push('#masthead-container, ytd-masthead { display: none !important; } #page-manager { margin-top: 0 !important; }');
    }

    if (yt.disableEndCards) {
      rules.push('.ytp-ce-element, .ytp-endscreen-content, .ytp-ce-covering-overlay { display: none !important; }');
    }

    if (yt.blackAndWhite) {
      rules.push('ytd-app, body, html { filter: grayscale(100%) !important; }');
    }

    styleEl.textContent = rules.join('\n');
  }

  // Load YouTube Cleaner Settings Immediately
  function loadAndApplyYT() {
    if (window.location.hostname.includes('youtube.com')) {
      chrome.storage.local.get(['settings'], (data) => {
        if (data && data.settings && data.settings.youtubeCleaner) {
          applyYouTubeCleaner(data.settings.youtubeCleaner);
        }
      });
    }
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.settings) {
        const newSettings = changes.settings.newValue;
        if (newSettings && newSettings.youtubeCleaner) {
          applyYouTubeCleaner(newSettings.youtubeCleaner);
        }
      }
    });
  } catch (e) { }

  loadAndApplyYT();

  // Poll background worker to check page status
  async function checkPageStatus() {
    try {
      chrome.runtime.sendMessage({ action: 'CHECK_DOOMSCROLL' }, async (response) => {
        if (chrome.runtime.lastError || !response) return;

        if (response.isNuclearBlocked) {
          showNuclearOverlay(response.domain, response.endTime);
          return;
        }

        if (response.youtubeCleaner) {
          applyYouTubeCleaner(response.youtubeCleaner);
        }

        if (response.isNightLockdown) {
          showNightLockdownOverlay(response.bedtime);
          return;
        }

        if (response.isFocusBlockActive && response.isStrict) {
          showStrictFocusOverlay(response.task);
          return;
        }

        if (isOverlayActive) return;

        if (response.isHardBlocked) {
          showHardBlockOverlay(response.domain);
        } else if (response.challengeRequired) {
          showDoomscrollChallenge(response);
        } else if (!interstitialShownThisSession && isDistractionSite(response.domain)) {
          const appData = await chrome.storage.local.get(['settings', 'dailyGoals', 'stats']);
          const goals = appData.dailyGoals || [];
          const mainTask = goals[0]?.text || 'Главная задача не задана';
          const todayKey = new Date().toISOString().slice(0, 10);
          const spentSec = appData.stats?.[todayKey]?.domains?.[response.domain] || 0;
          const spentMins = Math.floor(spentSec / 60);

          showFrictionInterstitial(response.domain, mainTask, spentMins);
        }
      });
    } catch (e) { }
  }

  function isDistractionSite(domain) {
    if (!domain) return false;
    return ['youtube.com', 'vk.com', 'reddit.com', 'twitch.tv', 'tiktok.com', 'instagram.com', 'twitter.com', 'x.com'].some(d => domain.includes(d));
  }

  // Show Unbypassable ☢️ Nuclear Lockdown Mode Overlay with MutationObserver Anti-Deletion Shield
  function showNuclearOverlay(domain, endTime) {
    if (document.getElementById('eyetime-nuclear-lockdown-overlay')) return;
    isOverlayActive = true;

    function buildOverlay() {
      if (document.getElementById('eyetime-nuclear-lockdown-overlay')) return;

      const overlay = document.createElement('div');
      overlay.id = 'eyetime-nuclear-lockdown-overlay';
      overlay.style.cssText = `
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483647 !important;
        background: rgba(4, 5, 8, 0.99) !important;
        backdrop-filter: blur(40px) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        color: #f8fafc !important;
        padding: 20px !important;
        user-select: none !important;
      `;

      overlay.innerHTML = `
        <div style="width: 100%; max-width: 500px; background: #0c0d12; border: 2px solid #ef4444; border-radius: 26px; padding: 38px; text-align: center; box-shadow: 0 24px 80px rgba(239, 68, 68, 0.35); display:flex; flex-direction:column; gap:22px;">
          <div style="display:inline-block; align-self:center; padding:6px 18px; border-radius:14px; background:rgba(239, 68, 68, 0.18); color:#ef4444; font-size:13px; font-weight:900; letter-spacing:1px; border:1px solid rgba(239, 68, 68, 0.4);">
            ☢️ ЯДЕРНЫЙ РЕЖИМ (100% БЛОКИРОВКА)
          </div>
          <h2 style="font-size: 26px; font-weight: 800; margin: 0; color: #fff;">Доступ к ${domain || 'сайту'} заблокирован ⚠️</h2>
          
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 18px; padding: 20px; text-align: center; font-size: 14px; color: #cbd5e1; line-height: 1.6;">
            Вы добровольно запустили <strong>Ядерный режим</strong>.<br>
            Отключение блокировки, сброс таймера или обход режима <strong style="color:#ef4444;">НЕВОЗМОЖНЫ</strong>.<br><br>
            Осталось времени до снятия блока:<br>
            <div id="eyetime-nuclear-timer" style="font-size: 28px; font-weight: 900; color: #ef4444; margin-top: 8px;">--:--:--</div>
          </div>

          <button id="eyetime-close-nuclear-btn" style="padding: 16px; border-radius: 16px; background: linear-gradient(135deg, #ef4444, #dc2626); color: #ffffff; font-size: 15px; font-weight: 800; border: none; cursor: pointer;">
            Закрыть вкладку
          </button>
        </div>
      `;

      (document.body || document.documentElement).appendChild(overlay);

      const timerEl = document.getElementById('eyetime-nuclear-timer');
      function updateTimer() {
        const rem = (endTime || 0) - Date.now();
        if (rem <= 0) {
          if (timerEl) timerEl.textContent = '00:00:00';
          window.location.reload();
          return;
        }
        const totalSec = Math.floor(rem / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        if (timerEl) timerEl.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }

      updateTimer();
      setInterval(updateTimer, 1000);

      document.getElementById('eyetime-close-nuclear-btn').addEventListener('click', () => {
        window.location.href = 'about:blank';
      });
    }

    buildOverlay();

    // DOM ANTI-DELETION SHIELD (Re-inject overlay immediately if user deletes element in DevTools)
    const observer = new MutationObserver(() => {
      if (!document.getElementById('eyetime-nuclear-lockdown-overlay')) {
        buildOverlay();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    // Block DevTools shortcuts and right-click on Nuclear Overlay
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) || (e.ctrlKey && e.key === 'u')) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, true);
  }

  // Show Strict Focus Block Hard Lock Overlay
  function showStrictFocusOverlay(taskText) {
    if (document.getElementById('eyetime-strict-focus-overlay')) return;
    isOverlayActive = true;

    const overlay = document.createElement('div');
    overlay.id = 'eyetime-strict-focus-overlay';
    overlay.style.cssText = `
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483647 !important;
      background: rgba(5, 6, 8, 0.98) !important;
      backdrop-filter: blur(32px) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      color: #f8fafc !important;
      padding: 20px !important;
    `;

    overlay.innerHTML = `
      <div style="width: 100%; max-width: 480px; background: #0e1017; border: 1px solid rgba(45, 212, 191, 0.5); border-radius: 24px; padding: 36px; text-align: center; box-shadow: 0 24px 60px rgba(0,0,0,0.95); display:flex; flex-direction:column; gap:20px;">
        <div style="display:inline-block; align-self:center; padding:6px 16px; border-radius:14px; background:rgba(45, 212, 191, 0.15); color:#2dd4bf; font-size:13px; font-weight:800; border:1px solid rgba(45, 212, 191, 0.35);">
          🛑 ХАРД-РЕЖИМ ФОКУС-БЛОКА
        </div>
        <h2 style="font-size: 24px; font-weight: 800; margin: 0; color: #fff;">Активен 90м Фокус-Блок 🎯</h2>
        
        <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 18px; text-align: left;">
          <div style="font-size: 11px; color: #94a3b8;">Ваша главная цель на спринт:</div>
          <div style="font-size: 16px; font-weight: 800; color: #2dd4bf; margin-top: 4px;">${taskText}</div>
        </div>

        <p style="font-size:13px; color:#cbd5e1; margin:0;">Развлекательные сайты полностью заблокированы во время работы. Вернитесь к задаче!</p>

        <button id="eyetime-close-strict-focus-btn" style="padding: 14px; border-radius: 14px; background: linear-gradient(135deg, #2dd4bf, #10b981); color: #04201a; font-size: 14px; font-weight: 800; border: none; cursor: pointer; margin-top: 6px;">
          ← Вернуться к работе
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('eyetime-close-strict-focus-btn').addEventListener('click', () => {
      window.location.href = 'about:blank';
    });
  }

  // Show Unbypassable Hard Night Lockdown Full-Screen Screen
  function showNightLockdownOverlay(bedtimeStr) {
    if (document.getElementById('eyetime-night-lockdown-overlay')) return;
    isOverlayActive = true;

    const overlay = document.createElement('div');
    overlay.id = 'eyetime-night-lockdown-overlay';
    overlay.style.cssText = `
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483647 !important;
      background: rgba(11, 12, 16, 0.96) !important;
      backdrop-filter: blur(28px) !important;
      -webkit-backdrop-filter: blur(28px) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      color: #FFFFFF !important;
      padding: 20px !important;
    `;

    overlay.innerHTML = `
      <div style="width: 100%; max-width: 480px; background: radial-gradient(ellipse 85% 45% at 50% -10%, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.02) 60%, transparent 100%), linear-gradient(180deg, #22242B 0%, #15161C 100%); border: 1px solid rgba(255, 255, 255, 0.08); border-top: 1px solid rgba(255, 255, 255, 0.3); border-radius: 24px; padding: 36px 32px; text-align: center; box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.28), 0 24px 60px rgba(0,0,0,0.85); display:flex; flex-direction:column; align-items:center; gap:18px;">
        
        <div style="display:inline-flex; align-items:center; gap:8px; padding:6px 16px; border-radius:999px; background:rgba(255, 94, 14, 0.15); color:#FF5E0E; font-size:12px; font-weight:700; border:1px solid rgba(255, 94, 14, 0.3); box-shadow: 0 0 16px rgba(255, 94, 14, 0.25);">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
          <span>НОЧНОЙ ОТДЫХ · СИСТЕМА ЗАБЛОКИРОВАНА</span>
        </div>

        <h2 style="font-size: 24px; font-weight: 800; margin: 4px 0 0; color: #FFFFFF; letter-spacing: -0.02em;">Время отбоя (${bedtimeStr})</h2>
        
        <div style="background: #13141B; border: 1px solid rgba(255, 255, 255, 0.08); border-top: 1px solid rgba(255, 255, 255, 0.18); border-radius: 16px; padding: 18px 20px; text-align: center; font-size: 13.5px; color: #A5A8B6; line-height: 1.55; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);">
          Вы зафиксировали отбой на <strong style="color:#FF5E0E;">${bedtimeStr}</strong>.<br>
          Браузер закрыт до <strong style="color:#FFFFFF;">05:00 утра</strong> для полноценного сна и восстановления сил.<br><br>
          <span style="color: #6F7282; font-size: 12.5px;">Никаких новых вкладок и ночной работы. Закрывайте экран и отдыхайте!</span>
        </div>

        <div style="display:flex; flex-direction:column; gap:10px; width: 100%; margin-top: 4px;">
          <button id="eyetime-close-night-btn" style="width: 100%; padding: 13px; border-radius: 999px; background: linear-gradient(135deg, #FF6B00 0%, #FF3800 100%); color: #ffffff; font-size: 13.5px; font-weight: 700; border: none; cursor: pointer; box-shadow: 0 4px 18px rgba(255, 94, 14, 0.55); transition: transform 0.2s ease;">
            Закрыть вкладку и спать
          </button>
          
          <button id="eyetime-bypass-night-btn" style="width: 100%; padding: 10px; border-radius: 999px; background: transparent; color: #6F7282; font-size: 12px; font-weight: 600; border: 1px solid rgba(255, 255, 255, 0.08); cursor: pointer; transition: all 0.2s ease;">
            Разблокировать браузер (Экстренно)
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('eyetime-close-night-btn').addEventListener('click', () => {
      window.location.href = 'about:blank';
    });

    document.getElementById('eyetime-bypass-night-btn').addEventListener('click', async () => {
      try {
        const d = await chrome.storage.local.get('settings');
        const s = d.settings || {};
        s.interceptor = s.interceptor || {};
        s.interceptor.nightModeBypassed = true;
        await chrome.storage.local.set({ settings: s });
      } catch (e) {}
      overlay.remove();
      isOverlayActive = false;
    });
  }

  // Show 5-Second Friction Interstitial Overlay when visiting YouTube/Social Sites
  function showFrictionInterstitial(domain, mainTask, spentMins) {
    if (document.getElementById('eyetime-friction-overlay')) return;
    interstitialShownThisSession = true;
    isOverlayActive = true;

    const overlay = document.createElement('div');
    overlay.id = 'eyetime-friction-overlay';
    overlay.style.cssText = `
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483647 !important;
      background: rgba(11, 12, 16, 0.96) !important;
      backdrop-filter: blur(28px) !important;
      -webkit-backdrop-filter: blur(28px) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      color: #FFFFFF !important;
      padding: 20px !important;
    `;

    overlay.innerHTML = `
      <div style="width: 100%; max-width: 440px; background: radial-gradient(ellipse 85% 45% at 50% -10%, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.02) 60%, transparent 100%), linear-gradient(180deg, #22242B 0%, #15161C 100%); border: 1px solid rgba(255, 255, 255, 0.08); border-top: 1px solid rgba(255, 255, 255, 0.3); border-radius: 24px; padding: 32px 28px; text-align: center; box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.28), 0 24px 60px rgba(0,0,0,0.85); display:flex; flex-direction:column; align-items:center; gap:16px;">
        
        <div style="display:inline-flex; align-items:center; gap:8px; padding:5px 14px; border-radius:999px; background:rgba(255, 94, 14, 0.15); color:#FF5E0E; font-size:11.5px; font-weight:700; border:1px solid rgba(255, 94, 14, 0.3); box-shadow: 0 0 16px rgba(255, 94, 14, 0.2);">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>ПЕРЕХВАТЧИК ВНИМАНИЯ</span>
        </div>

        <h3 style="font-size: 20px; font-weight: 800; margin: 0; color: #FFFFFF; letter-spacing: -0.015em;">Вы открываете ${domain}</h3>
        
        <div style="background: #13141B; border: 1px solid rgba(255, 255, 255, 0.08); border-top: 1px solid rgba(255, 255, 255, 0.16); border-radius: 14px; padding: 14px 16px; text-align: left; width: 100%;">
          <div style="font-size: 11px; font-weight: 600; color: #6F7282; text-transform: uppercase; letter-spacing: 0.03em;">Главная задача на сегодня:</div>
          <div style="font-size: 14px; font-weight: 700; color: #FFFFFF; margin-top: 4px;">${mainTask}</div>
        </div>

        <div style="font-size: 12.5px; color: #A5A8B6;">
          Потрачено на ${domain} сегодня: <strong style="color:#FF5E0E;">${spentMins} мин</strong>
        </div>

        <div style="display:flex; flex-direction:column; gap:10px; width: 100%; margin-top: 4px;">
          <button id="eyetime-friction-back-btn" style="width: 100%; padding: 12px; border-radius: 999px; background: linear-gradient(135deg, #FF6B00 0%, #FF3800 100%); color: #ffffff; font-size: 13px; font-weight: 700; border: none; cursor: pointer; box-shadow: 0 4px 16px -2px rgba(255, 94, 14, 0.55); transition: transform 0.2s ease;">
            Вернуться к главной задаче
          </button>
          <button id="eyetime-friction-continue-btn" disabled style="width: 100%; padding: 10px; border-radius: 999px; background: #13141B; color: #6F7282; font-size: 12px; font-weight: 600; border: 1px solid rgba(255,255,255,0.08); cursor: not-allowed; opacity: 0.5; transition: all 0.2s ease;">
            Всё равно зайти (5s)
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const backBtn = document.getElementById('eyetime-friction-back-btn');
    const continueBtn = document.getElementById('eyetime-friction-continue-btn');

    backBtn.addEventListener('click', () => {
      window.location.href = 'about:blank';
    });

    let sec = 5;
    const timer = setInterval(() => {
      sec--;
      if (sec > 0) {
        continueBtn.textContent = `Всё равно зайти (${sec}s)`;
      } else {
        clearInterval(timer);
        continueBtn.disabled = false;
        continueBtn.style.opacity = '1';
        continueBtn.style.cursor = 'pointer';
        continueBtn.style.color = '#A5A8B6';
        continueBtn.textContent = 'Всё равно зайти';
      }
    }, 1000);

    continueBtn.addEventListener('click', () => {
      overlay.remove();
      isOverlayActive = false;
    });
  }

  function showHardBlockOverlay(domain) {
    if (document.getElementById('eyetime-hardblock-overlay')) return;
    isOverlayActive = true;

    const overlay = document.createElement('div');
    overlay.id = 'eyetime-hardblock-overlay';
    overlay.innerHTML = `
      <div id="eyetime-hardblock-card">
        <div class="eyetime-card-header">
          <div class="eyetime-badge-icon danger">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
          </div>
          <div class="eyetime-header-text">
            <h3>Сайт заблокирован</h3>
            <p>Режим полной фокусировки EyeTime</p>
          </div>
        </div>

        <div class="eyetime-info-box">
          Домен <span class="eyetime-highlight danger">${domain}</span> находится в вашем списке <strong style="color:#FF5E0E">полной блокировки (Хард-блок)</strong>. Доступ закрыт.
        </div>

        <div class="eyetime-actions">
          <button id="eyetime-close-hardblock-btn" class="eyetime-btn eyetime-btn-primary" style="width: 100%; padding: 12px; border-radius: 999px; background: linear-gradient(135deg, #FF6B00 0%, #FF3800 100%); color: #ffffff; font-size: 13.5px; font-weight: 700; border: none; cursor: pointer; box-shadow: 0 4px 18px rgba(255, 94, 14, 0.55);">
            Закрыть вкладку
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('eyetime-close-hardblock-btn').addEventListener('click', () => {
      window.location.href = 'about:blank';
    });
  }

  function generateMathProblem() {
    const types = ['mult_add', 'parentheses', 'sub_mult'];
    const selected = types[Math.floor(Math.random() * types.length)];

    if (selected === 'mult_add') {
      const a = Math.floor(Math.random() * 15) + 6;
      const b = Math.floor(Math.random() * 12) + 4;
      const c = Math.floor(Math.random() * 40) + 15;
      return {
        question: `${a} × ${b} + ${c} = ?`,
        answer: String(a * b + c),
        typeHint: '🧮 Математическая задача'
      };
    } else if (selected === 'parentheses') {
      const a = Math.floor(Math.random() * 35) + 15;
      const b = Math.floor(Math.random() * 35) + 15;
      const mult = Math.floor(Math.random() * 4) + 2;
      return {
        question: `(${a} + ${b}) × ${mult} = ?`,
        answer: String((a + b) * mult),
        typeHint: '🧮 Вычисление со скобками'
      };
    } else {
      const a = Math.floor(Math.random() * 50) + 50;
      const b = Math.floor(Math.random() * 25) + 10;
      const mult = Math.floor(Math.random() * 3) + 2;
      return {
        question: `(${a} - ${b}) × ${mult} = ?`,
        answer: String((a - b) * mult),
        typeHint: '🧮 Вычисление с разностью'
      };
    }
  }

  const LOGIC_SEQUENCES = [
    { seq: '2, 4, 8, 16, ?', ans: '32', hint: 'Удвоение чисел' },
    { seq: '3, 6, 12, 24, ?', ans: '48', hint: 'Умножение на 2' },
    { seq: '1, 4, 9, 16, 25, ?', ans: '36', hint: 'Квадраты чисел' },
    { seq: '10, 20, 35, 55, ?', ans: '80', hint: 'Прибавление +10, +15...' },
    { seq: '1, 1, 2, 3, 5, 8, ?', ans: '13', hint: 'Числа Фибоначчи' }
  ];

  function generateLogicChallenge() {
    const item = LOGIC_SEQUENCES[Math.floor(Math.random() * LOGIC_SEQUENCES.length)];
    return {
      question: `Завершите ряд: ${item.seq}`,
      answer: item.ans,
      typeHint: `🧩 Логический ряд (${item.hint})`
    };
  }

  const MINDFUL_QUOTES = [
    'Время — мой главный ресурс, и я распоряжаюсь им осознанно',
    'Я контролирую своё внимание, а не алгоритмы рекомендаций',
    'Настоящая жизнь происходит прямо сейчас вне этого экрана',
    'Мой мозг заслуживает качественного и глубокого отдыха',
    'Я делаю паузу, чтобы выдохнуть и вернуть фокус',
    '5 минут тишины ценнее часа бесконечного скроллинга'
  ];

  function generateTypingChallenge() {
    const text = MINDFUL_QUOTES[Math.floor(Math.random() * MINDFUL_QUOTES.length)];
    return {
      question: `Напечатайте точно фразу:\n"${text}"`,
      answer: text,
      typeHint: '✍️ Осознанный ввод фразы'
    };
  }

  function getRandomChallenge(allowedType) {
    if (allowedType === 'math') return Math.random() > 0.3 ? generateMathProblem() : generateLogicChallenge();
    if (allowedType === 'typing') return generateTypingChallenge();
    const roll = Math.random();
    if (roll < 0.4) return generateMathProblem();
    if (roll < 0.7) return generateTypingChallenge();
    return generateLogicChallenge();
  }

  function showDoomscrollChallenge(data) {
    if (document.getElementById('eyetime-doomscroll-overlay') || document.getElementById('eyetime-hardblock-overlay')) return;
    isOverlayActive = true;

    let challenge = getRandomChallenge(data.type || 'both');
    currentExpectedAnswer = challenge.answer.trim();

    const spentMins = Math.floor(data.spentSec / 60);

    const overlay = document.createElement('div');
    overlay.id = 'eyetime-doomscroll-overlay';
    overlay.innerHTML = `
      <div id="eyetime-doomscroll-card">
        <div class="eyetime-card-header">
          <div class="eyetime-badge-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <div class="eyetime-header-text">
            <h3>🧠 Защита от «залипания»</h3>
            <p id="eyetime-challenge-hint">${challenge.typeHint}</p>
          </div>
        </div>

        <div class="eyetime-info-box">
          Вы проводите время на <span class="eyetime-highlight">${data.domain}</span> уже <span class="eyetime-highlight">${spentMins} мин</span> сегодня (лимит: ${data.limitMins} мин). Чтобы сбить дофаминовый цикл, решите задачу:
        </div>

        <div class="eyetime-challenge-box">
          <div id="eyetime-challenge-prompt" class="eyetime-challenge-prompt">${challenge.question}</div>
          <input type="text" id="eyetime-challenge-input" class="eyetime-input" placeholder="Введите ваш ответ..." autocomplete="off">
          <div id="eyetime-error-text" class="eyetime-error">❌ Неверный ответ. Попробуйте ещё раз!</div>
        </div>

        <div class="eyetime-actions">
          <button id="eyetime-submit-btn" class="eyetime-btn eyetime-btn-primary">
            Продолжить (+5 мин)
          </button>
          <button id="eyetime-refresh-btn" class="eyetime-btn eyetime-btn-secondary" title="Сменить задачу">
            🔄 Другая
          </button>
          <button id="eyetime-close-tab-btn" class="eyetime-btn eyetime-btn-secondary">
            Закрыть вкладку
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const input = document.getElementById('eyetime-challenge-input');
    const submitBtn = document.getElementById('eyetime-submit-btn');
    const refreshBtn = document.getElementById('refreshBtn');
    const closeBtn = document.getElementById('eyetime-close-tab-btn');
    const errorText = document.getElementById('eyetime-error-text');

    input.focus();

    function verifyAnswer() {
      const userVal = input.value.trim();
      let isCorrect = false;

      if (challenge.answer.match(/^[0-9]+$/)) {
        isCorrect = (userVal === currentExpectedAnswer);
      } else {
        isCorrect = (userVal.toLowerCase() === currentExpectedAnswer.toLowerCase());
      }

      if (isCorrect) {
        chrome.runtime.sendMessage({ action: 'SOLVE_DOOMSCROLL', domain: data.domain }, () => {
          overlay.remove();
          isOverlayActive = false;
        });
      } else {
        errorText.style.display = 'block';
        input.style.borderColor = '#fb7185';
        input.value = '';
        input.focus();
      }
    }

    function refreshChallenge() {
      challenge = getRandomChallenge(data.type || 'both');
      currentExpectedAnswer = challenge.answer.trim();
      document.getElementById('eyetime-challenge-hint').textContent = challenge.typeHint;
      document.getElementById('eyetime-challenge-prompt').textContent = challenge.question;
      errorText.style.display = 'none';
      input.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      input.value = '';
      input.focus();
    }

    submitBtn.addEventListener('click', verifyAnswer);
    if (refreshBtn) refreshBtn.addEventListener('click', refreshChallenge);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') verifyAnswer();
    });

    closeBtn.addEventListener('click', () => {
      window.location.href = 'about:blank';
    });
  }

  // ── ⚡ ANTI-DOOMSCROLL SHORTS / REELS / CLIPS KILLER (B&W GRAYSCALE MODE) ──
  const SHORTS_LIMIT_SECS = 60; // 60 seconds limit
  let shortsTimeSpent = 0;
  let isShortsBlocked = false;
  let shortsSnoozeUntil = 0;

  function isShortsOrReelsUrl() {
    const url = window.location.href.toLowerCase();
    const path = window.location.pathname.toLowerCase();

    // YouTube Shorts
    if (url.includes('youtube.com') && (path.startsWith('/shorts') || url.includes('/shorts/'))) return true;
    // Instagram Reels
    if (url.includes('instagram.com') && (path.includes('/reels') || path.includes('/reel/'))) return true;
    // VK Clips
    if (url.includes('vk.com') && (path.includes('clips') || path.includes('/clip'))) return true;
    // TikTok
    if (url.includes('tiktok.com') && (path.startsWith('/@') || path.includes('/video/') || path.includes('/foryou') || path === '/' || path === '')) return true;

    return false;
  }

  function pauseAllShortsVideos() {
    document.querySelectorAll('video').forEach(v => {
      try {
        if (!v.paused) v.pause();
        v.playbackRate = 0;
      } catch (e) {}
    });
  }

  function applyGrayscaleFilter(enable) {
    const target = document.documentElement;
    if (enable) {
      target.style.setProperty('filter', 'grayscale(100%) contrast(1.1) brightness(0.65)', 'important');
      target.style.setProperty('transition', 'filter 1.2s cubic-bezier(0.16, 1, 0.3, 1)', 'important');
    } else {
      target.style.removeProperty('filter');
      target.style.removeProperty('transition');
    }
  }

  function showShortsLockoutModal() {
    if (document.getElementById('eyetime-anti-shorts-modal')) return;
    isShortsBlocked = true;

    // Apply Black & White filter to the entire page
    applyGrayscaleFilter(true);

    // Freeze video playback
    pauseAllShortsVideos();

    const overlay = document.createElement('div');
    overlay.id = 'eyetime-anti-shorts-modal';
    overlay.style.cssText = `
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483647 !important;
      background: rgba(11, 12, 16, 0.88) !important;
      backdrop-filter: blur(20px) !important;
      -webkit-backdrop-filter: blur(20px) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      color: #FFFFFF !important;
      padding: 20px !important;
      animation: eyetime-fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
    `;

    overlay.innerHTML = `
      <div style="
        width: 100%;
        max-width: 480px;
        background: radial-gradient(ellipse 85% 45% at 50% -10%, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.02) 60%, transparent 100%), linear-gradient(180deg, #22242B 0%, #15161C 100%);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-top: 1px solid rgba(255, 255, 255, 0.35);
        border-radius: 24px;
        padding: 36px 32px;
        box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.28), 0 24px 60px rgba(0, 0, 0, 0.9);
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 18px;
      ">
        <div style="
          width: 52px;
          height: 52px;
          border-radius: 16px;
          background: linear-gradient(135deg, #FF6B00 0%, #FF3800 100%);
          color: #FFF;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 20px rgba(255, 94, 14, 0.6);
        ">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
            <line x1="2" y1="2" x2="22" y2="22" stroke="#FFF" stroke-width="2.5"></line>
          </svg>
        </div>

        <div style="font-size: 11px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; color: #FF5E0E; background: rgba(255, 94, 14, 0.12); border: 1px solid rgba(255, 94, 14, 0.3); padding: 4px 12px; border-radius: 999px;">
          АНТИ-ЗАЛИПАНИЕ В ЛЕНТУ
        </div>

        <h1 style="font-size: 24px; font-weight: 800; letter-spacing: -0.02em; color: #FFFFFF; line-height: 1.25; margin: 0;">
          Ты залип в ленту.<br><span style="background: linear-gradient(135deg, #FF6B00 0%, #FF3800 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Вернись к задаче дня!</span>
        </h1>

        <p style="font-size: 13.5px; color: #A5A8B6; line-height: 1.5; margin: 0;">
          Бесконечные короткие ролики вымывают дофамин и крадут твое внимание. Экран переведен в чёрно-белый режим. Пора закрыть ленту и вернуться к делам.
        </p>

        <div style="display: flex; flex-direction: column; width: 100%; gap: 10px; margin-top: 8px;">
          <button id="eyetime-exit-shorts-btn" style="
            width: 100%;
            padding: 13px 20px;
            border-radius: 999px;
            background: linear-gradient(135deg, #FF6B00 0%, #FF3800 100%);
            color: #FFFFFF;
            font-size: 14px;
            font-weight: 700;
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 18px rgba(255, 94, 14, 0.6);
            transition: transform 0.15s ease;
          ">🔥 Закрыть ленту и вернуться к делу</button>

          <button id="eyetime-open-endel-btn" style="
            width: 100%;
            padding: 11px 20px;
            border-radius: 999px;
            background: #181A22;
            color: #FFFFFF;
            font-size: 13px;
            font-weight: 600;
            border: 1px solid rgba(255, 255, 255, 0.12);
            cursor: pointer;
            transition: background 0.15s ease;
          ">🎧 Включить Endel Focus</button>

          <button id="eyetime-snooze-shorts-btn" style="
            background: transparent;
            border: none;
            color: #6F7282;
            font-size: 11.5px;
            cursor: pointer;
            margin-top: 4px;
            text-decoration: underline;
          ">Досмотреть 1 ролик (останется Ч/Б)</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Keep videos paused
    const pauseInterval = setInterval(() => {
      if (!isShortsBlocked) {
        clearInterval(pauseInterval);
        return;
      }
      pauseAllShortsVideos();
    }, 300);

    // Button 1: Exit Shorts / Close
    document.getElementById('eyetime-exit-shorts-btn')?.addEventListener('click', () => {
      if (window.location.href.includes('youtube.com')) {
        window.location.href = 'https://www.youtube.com/';
      } else if (window.location.href.includes('vk.com')) {
        window.location.href = 'https://vk.com/feed';
      } else if (window.location.href.includes('instagram.com')) {
        window.location.href = 'https://www.instagram.com/';
      } else {
        chrome.runtime.sendMessage({ action: 'CLOSE_CURRENT_TAB' }, () => {
          window.location.href = chrome.runtime.getURL('newtab/newtab.html');
        });
      }
    });

    // Button 2: Endel Focus
    document.getElementById('eyetime-open-endel-btn')?.addEventListener('click', () => {
      window.location.href = 'https://app.endel.io/player/focus';
    });

    // Button 3: Snooze 60 seconds (Keeps B&W mode!)
    document.getElementById('eyetime-snooze-shorts-btn')?.addEventListener('click', () => {
      overlay.remove();
      isShortsBlocked = false;
      shortsSnoozeUntil = Date.now() + 60 * 1000;
      // Screen REMAINS B&W! No color returned!
      document.querySelectorAll('video').forEach(v => {
        try { v.playbackRate = 1; v.play(); } catch (e) {}
      });
    });
  }

  // Monitor loop for Shorts / Reels
  function initAntiShortsWatcher() {
    setInterval(() => {
      if (document.hidden) return;

      const onShorts = isShortsOrReelsUrl();

      if (!onShorts) {
        if (isShortsBlocked || shortsTimeSpent > 0) {
          shortsTimeSpent = 0;
          isShortsBlocked = false;
          applyGrayscaleFilter(false);
          const modal = document.getElementById('eyetime-anti-shorts-modal');
          if (modal) modal.remove();
        }
        return;
      }

      if (shortsSnoozeUntil > 0) {
        if (Date.now() < shortsSnoozeUntil) {
          applyGrayscaleFilter(true);
          return;
        } else {
          shortsSnoozeUntil = 0;
        }
      }

      shortsTimeSpent++;

      if (shortsTimeSpent >= SHORTS_LIMIT_SECS) {
        showShortsLockoutModal();
      }
    }, 1000);

    window.addEventListener('popstate', () => {
      if (!isShortsOrReelsUrl()) {
        shortsTimeSpent = 0;
        isShortsBlocked = false;
        applyGrayscaleFilter(false);
        const modal = document.getElementById('eyetime-anti-shorts-modal');
        if (modal) modal.remove();
      }
    });
  }

  initAntiShortsWatcher();
  setInterval(checkPageStatus, 2000);
  checkPageStatus();
})();
