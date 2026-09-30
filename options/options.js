// EyeTime — Options Page JavaScript Logic with Arbitrary Time Selection for ☢️ Nuclear Mode

document.addEventListener('DOMContentLoaded', async () => {
  // Sidebar Tab Switching
  document.querySelectorAll('.nav-tab').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      const targetTabId = tabBtn.getAttribute('data-tab');

      document.querySelectorAll('.nav-tab').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));

      tabBtn.classList.add('active');
      const targetPanel = document.getElementById(targetTabId);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }
    });
  });

  // Interceptor controls
  const bedtimeInput = document.getElementById('bedtimeInput');
  const morningWalkToggle = document.getElementById('morningWalkToggle');
  const counterLabelInput = document.getElementById('counterLabelInput');
  const counterCurrentInput = document.getElementById('counterCurrentInput');
  const counterTargetInput = document.getElementById('counterTargetInput');
  const addCounterBtn = document.getElementById('addCounterBtn');
  const countersConfigList = document.getElementById('countersConfigList');
  const ruleInput = document.getElementById('ruleInput');
  const addRuleBtn = document.getElementById('addRuleBtn');
  const rulesConfigList = document.getElementById('rulesConfigList');

  // Nuclear Mode elements
  const nuclearActiveBadge = document.getElementById('nuclearActiveBadge');
  const nuclearDurationSelect = document.getElementById('nuclearDurationSelect');
  const nuclearCustomHoursInput = document.getElementById('nuclearCustomHoursInput');
  const nuclearPickerDateTime = document.getElementById('nuclearPickerDateTime');
  const startNuclearBtn = document.getElementById('startNuclearBtn');
  const nuclearDomainInput = document.getElementById('nuclearDomainInput');
  const addNuclearDomainBtn = document.getElementById('addNuclearDomainBtn');
  const nuclearDomainTags = document.getElementById('nuclearDomainTags');

  const notificationsToggle = document.getElementById('notificationsToggle');
  const intervalSelect = document.getElementById('intervalSelect');

  // YouTube Cleaner elements
  const ytCleanerToggle = document.getElementById('ytCleanerToggle');
  const ytHideHomePage = document.getElementById('ytHideHomePage');
  const ytHideShorts = document.getElementById('ytHideShorts');
  const ytHideComments = document.getElementById('ytHideComments');
  const ytHideRecommended = document.getElementById('ytHideRecommended');
  const ytHideThumbnails = document.getElementById('ytHideThumbnails');
  const ytBlurThumbnails = document.getElementById('ytBlurThumbnails');
  const ytHideSubscriptions = document.getElementById('ytHideSubscriptions');
  const ytHideExplore = document.getElementById('ytHideExplore');
  const ytHideTopBar = document.getElementById('ytHideTopBar');
  const ytDisableEndCards = document.getElementById('ytDisableEndCards');
  const ytBlackAndWhite = document.getElementById('ytBlackAndWhite');

  // TickTick elements
  const ticktickToggle = document.getElementById('ticktickToggle');
  const ticktickClientIdInput = document.getElementById('ticktickClientIdInput');
  const ticktickClientSecretInput = document.getElementById('ticktickClientSecretInput');
  const ticktickAuthCodeInput = document.getElementById('ticktickAuthCodeInput');
  const exchangeCodeBtn = document.getElementById('exchangeCodeBtn');
  const ticktickTokenInput = document.getElementById('ticktickTokenInput');
  const authTicktickBtn = document.getElementById('authTicktickBtn');
  const testTicktickBtn = document.getElementById('testTicktickBtn');

  // Custom Limits elements
  const customLimitDomainInput = document.getElementById('customLimitDomainInput');
  const customLimitMinsInput = document.getElementById('customLimitMinsInput');
  const addCustomLimitBtn = document.getElementById('addCustomLimitBtn');
  const customLimitsList = document.getElementById('customLimitsList');

  // Hard Block elements
  const hardBlockDomainInput = document.getElementById('hardBlockDomainInput');
  const addHardBlockBtn = document.getElementById('addHardBlockBtn');
  const hardBlockDomainTags = document.getElementById('hardBlockDomainTags');

  // Anti-Doomscroll elements
  const antiDoomToggle = document.getElementById('antiDoomToggle');
  const doomLimitInput = document.getElementById('doomLimitInput');
  const doomIntervalInput = document.getElementById('doomIntervalInput');
  const doomTypeSelect = document.getElementById('doomTypeSelect');
  const doomDomainInput = document.getElementById('doomDomainInput');
  const addDoomDomainBtn = document.getElementById('addDoomDomainBtn');
  const doomDomainTags = document.getElementById('doomDomainTags');

  // Productivity Classification elements
  const prodDomainInput = document.getElementById('prodDomainInput');
  const prodCategorySelect = document.getElementById('prodCategorySelect');
  const addProdCategoryBtn = document.getElementById('addProdCategoryBtn');
  const prodDomainList = document.getElementById('prodDomainList');

  // Excluded domains elements
  const domainInput = document.getElementById('domainInput');
  const addDomainBtn = document.getElementById('addDomainBtn');
  const domainTagsContainer = document.getElementById('domainTags');

  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const resetDataBtn = document.getElementById('resetDataBtn');
  const toast = document.getElementById('toast');

  let currentSettings = {
    eyeRestIntervalMinutes: 20,
    notificationsEnabled: true,
    excludedDomains: ['localhost', '127.0.0.1'],
    pauseUntil: 0,
    interceptor: {
      bedtime: '23:30',
      morningWalkRequired: true,
      uncomfortableCounters: [
        { label: 'Сессий глубокого фокуса', current: 0, target: 4 },
        { label: 'Важных закрытых задач', current: 0, target: 5 },
        { label: 'Прочитано страниц / статей', current: 0, target: 20 }
      ],
      dailyRules: [
        'Фокус важнее суеты',
        'Сначала главная задача дня',
        'Перерывы для отдыха глаз каждые 25 минут'
      ]
    },
    nuclearLock: {
      active: false,
      endTime: 0,
      domains: ['youtube.com', 'reddit.com', 'vk.com', 'twitter.com', 'x.com', 'tiktok.com', 'twitch.tv', 'instagram.com']
    },
    antiDoomscroll: {
      enabled: true,
      dailyLimitMinutes: 30,
      challengeIntervalMinutes: 5,
      targetDomains: ['youtube.com', 'reddit.com', 'vk.com', 'twitter.com', 'x.com', 'tiktok.com', 'twitch.tv', 'instagram.com'],
      challengeType: 'both'
    },
    youtubeCleaner: {
      enabled: true,
      hideHomePage: false,
      hideShorts: true,
      hideComments: false,
      hideRecommended: true,
      hideThumbnails: false,
      blurThumbnails: false,
      hideSubscriptions: false,
      hideExplore: false,
      hideTopBar: false,
      disableEndCards: true,
      blackAndWhite: false
    },
    ticktick: {
      enabled: false,
      clientId: '',
      clientSecret: '',
      token: ''
    },
    customDomainLimits: {},
    hardBlockedDomains: [],
    domainProductivity: {
      'github.com': 'productive',
      'figma.com': 'productive',
      'notion.so': 'productive',
      'google.com': 'neutral',
      'youtube.com': 'distraction',
      'vk.com': 'distraction'
    }
  };

  // Load existing settings
  const data = await chrome.storage.local.get(['settings']);
  if (data.settings) {
    currentSettings = Object.assign(currentSettings, data.settings);
    if (!currentSettings.nuclearLock) {
      currentSettings.nuclearLock = {
        active: false,
        endTime: 0,
        domains: ['youtube.com', 'reddit.com', 'vk.com', 'twitter.com', 'x.com', 'tiktok.com', 'twitch.tv', 'instagram.com']
      };
    }
    if (!currentSettings.interceptor) {
      currentSettings.interceptor = {
        bedtime: '23:30',
        morningWalkRequired: true,
        uncomfortableCounters: [
          { label: 'Сессий глубокого фокуса', current: 0, target: 4 },
          { label: 'Важных закрытых задач', current: 0, target: 5 },
          { label: 'Прочитано страниц / статей', current: 0, target: 20 }
        ],
        dailyRules: [
          'Фокус важнее суеты',
          'Сначала главная задача дня',
          'Перерывы для отдыха глаз каждые 25 минут'
        ]
      };
    }
    if (!currentSettings.ticktick) {
      currentSettings.ticktick = { enabled: false, clientId: '', clientSecret: '', token: '' };
    }
  }

  // Populate Interceptor Controls
  const inc = currentSettings.interceptor;
  bedtimeInput.value = inc.bedtime || '23:30';
  morningWalkToggle.checked = inc.morningWalkRequired !== false;

  renderCountersConfig();
  renderRulesConfig();
  renderNuclearModeUI();

  // Populate initial controls
  notificationsToggle.checked = currentSettings.notificationsEnabled;
  intervalSelect.value = String(currentSettings.eyeRestIntervalMinutes);

  // Populate TickTick controls
  ticktickToggle.checked = !!currentSettings.ticktick.enabled;
  ticktickClientIdInput.value = currentSettings.ticktick.clientId || '';
  ticktickClientSecretInput.value = currentSettings.ticktick.clientSecret || '';
  ticktickTokenInput.value = currentSettings.ticktick.token || '';

  // Populate YouTube Cleaner controls
  const yt = currentSettings.youtubeCleaner || {};
  ytCleanerToggle.checked = !!yt.enabled;
  ytHideHomePage.checked = !!yt.hideHomePage;
  ytHideShorts.checked = !!yt.hideShorts;
  ytHideComments.checked = !!yt.hideComments;
  ytHideRecommended.checked = !!yt.hideRecommended;
  ytHideThumbnails.checked = !!yt.hideThumbnails;
  ytBlurThumbnails.checked = !!yt.blurThumbnails;
  ytHideSubscriptions.checked = !!yt.hideSubscriptions;
  ytHideExplore.checked = !!yt.hideExplore;
  ytHideTopBar.checked = !!yt.hideTopBar;
  ytDisableEndCards.checked = !!yt.disableEndCards;
  ytBlackAndWhite.checked = !!yt.blackAndWhite;

  antiDoomToggle.checked = !!currentSettings.antiDoomscroll.enabled;
  doomLimitInput.value = currentSettings.antiDoomscroll.dailyLimitMinutes;
  doomIntervalInput.value = currentSettings.antiDoomscroll.challengeIntervalMinutes;
  doomTypeSelect.value = currentSettings.antiDoomscroll.challengeType || 'both';

  renderDomainTags();
  renderDoomDomainTags();
  renderCustomLimits();
  renderHardBlockTags();
  renderProdDomainList();

  // Save Settings Helper
  async function saveSettings(showToastMessage = 'Настройки сохранены') {
    await chrome.storage.local.set({ settings: currentSettings });
    showToast(showToastMessage);
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 2500);
  }

  function cleanDomain(raw) {
    if (!raw) return '';
    try {
      if (raw.includes('://')) raw = new URL(raw).hostname;
    } catch (e) { }
    return raw.trim().toLowerCase().replace(/^www\./, '');
  }

  // ☢️ NUCLEAR MODE FLEXIBLE DURATION SELECTION
  nuclearDurationSelect.addEventListener('change', () => {
    const val = nuclearDurationSelect.value;
    if (val === 'custom_hours') {
      nuclearCustomHoursInput.classList.remove('hidden');
      nuclearPickerDateTime.classList.add('hidden');
    } else if (val === 'custom_datetime') {
      nuclearPickerDateTime.classList.remove('hidden');
      nuclearCustomHoursInput.classList.add('hidden');
    } else {
      nuclearCustomHoursInput.classList.add('hidden');
      nuclearPickerDateTime.classList.add('hidden');
    }
  });

  function renderNuclearModeUI() {
    const n = currentSettings.nuclearLock;
    const isNowActive = n && n.active && Date.now() < n.endTime;

    if (isNowActive) {
      const endD = new Date(n.endTime);
      const dateStr = `${String(endD.getDate()).padStart(2, '0')}.${String(endD.getMonth() + 1).padStart(2, '0')}.${endD.getFullYear()} ${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`;
      nuclearActiveBadge.textContent = `🔴 АКТИВЕН ДО ${dateStr}`;
      nuclearActiveBadge.classList.remove('hidden');

      startNuclearBtn.disabled = true;
      startNuclearBtn.style.opacity = '0.5';
      startNuclearBtn.style.cursor = 'not-allowed';
      startNuclearBtn.textContent = '🔒 ЯДЕРНЫЙ БЛОК УЖЕ АКТИВЕН';
      nuclearDurationSelect.disabled = true;
      nuclearCustomHoursInput.disabled = true;
      nuclearPickerDateTime.disabled = true;
    } else {
      nuclearActiveBadge.classList.add('hidden');
      startNuclearBtn.disabled = false;
      startNuclearBtn.style.opacity = '1';
      startNuclearBtn.style.cursor = 'pointer';
      startNuclearBtn.textContent = '☢️ ЗАПУСТИТЬ ЯДЕРНЫЙ БЛОК';
      nuclearDurationSelect.disabled = false;
      nuclearCustomHoursInput.disabled = false;
      nuclearPickerDateTime.disabled = false;

      if (n && n.active) {
        n.active = false;
        saveSettings();
      }
    }

    renderNuclearDomainTags();
  }

  function renderNuclearDomainTags() {
    nuclearDomainTags.innerHTML = '';
    const isNowActive = currentSettings.nuclearLock && currentSettings.nuclearLock.active && Date.now() < currentSettings.nuclearLock.endTime;

    (currentSettings.nuclearLock.domains || []).forEach(domain => {
      const tag = document.createElement('div');
      tag.className = 'tag';
      tag.style.borderColor = 'rgba(239, 68, 68, 0.4)';
      tag.innerHTML = `
        <span style="color:#ef4444;">☢️ ${domain}</span>
        ${!isNowActive ? `<span class="tag-remove-nuclear" data-domain="${domain}">&times;</span>` : ''}
      `;
      nuclearDomainTags.appendChild(tag);
    });

    if (!isNowActive) {
      document.querySelectorAll('.tag-remove-nuclear').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const dom = e.target.getAttribute('data-domain');
          currentSettings.nuclearLock.domains = currentSettings.nuclearLock.domains.filter(d => d !== dom);
          renderNuclearDomainTags();
          await saveSettings(`Домен ${dom} удален из Ядерного блока`);
        });
      });
    }
  }

  addNuclearDomainBtn.addEventListener('click', async () => {
    const isNowActive = currentSettings.nuclearLock && currentSettings.nuclearLock.active && Date.now() < currentSettings.nuclearLock.endTime;
    if (isNowActive) {
      alert('⚠️ Во время активного Ядерного режима менять список сайтов нельзя!');
      return;
    }
    const dom = cleanDomain(nuclearDomainInput.value);
    if (dom && !currentSettings.nuclearLock.domains.includes(dom)) {
      currentSettings.nuclearLock.domains.push(dom);
      nuclearDomainInput.value = '';
      renderNuclearDomainTags();
      await saveSettings(`Домен ${dom} добавлен в Ядерный блок`);
    }
  });

  startNuclearBtn.addEventListener('click', async () => {
    const isNowActive = currentSettings.nuclearLock && currentSettings.nuclearLock.active && Date.now() < currentSettings.nuclearLock.endTime;
    if (isNowActive) return;

    let endTime = 0;
    let labelStr = '';

    const selVal = nuclearDurationSelect.value;
    if (selVal === 'custom_hours') {
      const h = parseInt(nuclearCustomHoursInput.value, 10);
      if (!h || h <= 0) {
        alert('⚠️ Введите корректное число часов.');
        return;
      }
      endTime = Date.now() + h * 60 * 60 * 1000;
      labelStr = `${h} ч.`;
    } else if (selVal === 'custom_datetime') {
      const dtVal = nuclearPickerDateTime.value;
      if (!dtVal) {
        alert('⚠️ Выберите дату и время окончания блока.');
        return;
      }
      endTime = new Date(dtVal).getTime();
      if (endTime <= Date.now()) {
        alert('⚠️ Выбранная дата должна быть в будущем!');
        return;
      }
      const d = new Date(endTime);
      labelStr = `до ${d.toLocaleString()}`;
    } else {
      const h = parseInt(selVal, 10);
      endTime = Date.now() + h * 60 * 60 * 1000;
      labelStr = `${h} ч.`;
    }

    const confirmLaunch = confirm(`⚠️ ВНИМАНИЕ! Вы запускаете ЯДЕРНЫЙ РЕЖИМ (${labelStr}).\n\nВ этот период вы НЕ сможете зайти на выбранные сайты, выключить режим или отменить блокировку.\n\nВы точно готовы сфокусироваться?`);

    if (confirmLaunch) {
      currentSettings.nuclearLock.active = true;
      currentSettings.nuclearLock.endTime = endTime;
      renderNuclearModeUI();
      await saveSettings(`☢️ ЯДЕРНЫЙ РЕЖИМ ЗАПУЩЕН (${labelStr})!`);
    }
  });

  // Interceptor Listeners
  bedtimeInput.addEventListener('change', async (e) => {
    currentSettings.interceptor.bedtime = e.target.value;
    await saveSettings('Время отбоя обновлено');
  });

  morningWalkToggle.addEventListener('change', async (e) => {
    currentSettings.interceptor.morningWalkRequired = e.target.checked;
    await saveSettings();
  });

  // Render Counters Config
  function renderCountersConfig() {
    countersConfigList.innerHTML = '';
    const counters = currentSettings.interceptor.uncomfortableCounters || [];

    if (counters.length === 0) {
      countersConfigList.innerHTML = '<div class="empty-state">Нет мозолящих глаз счётчиков</div>';
      return;
    }

    counters.forEach((c, idx) => {
      const item = document.createElement('div');
      item.className = 'custom-limit-item';
      item.innerHTML = `
        <div>
          <strong>${c.label}</strong>: <span class="limit-tag-badge">${c.unit || ''}${c.current} / ${c.unit || ''}${c.target}</span>
        </div>
        <span class="tag-remove-counter" data-idx="${idx}" style="cursor:pointer; font-weight:bold; color:#fb7185;">&times;</span>
      `;
      countersConfigList.appendChild(item);
    });

    document.querySelectorAll('.tag-remove-counter').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = e.target.getAttribute('data-idx');
        currentSettings.interceptor.uncomfortableCounters.splice(idx, 1);
        renderCountersConfig();
        await saveSettings('Счётчик удалён');
      });
    });
  }

  addCounterBtn.addEventListener('click', async () => {
    const label = counterLabelInput.value.trim();
    const current = parseInt(counterCurrentInput.value, 10) || 0;
    const target = parseInt(counterTargetInput.value, 10) || 10;

    if (label) {
      if (!currentSettings.interceptor.uncomfortableCounters) currentSettings.interceptor.uncomfortableCounters = [];
      currentSettings.interceptor.uncomfortableCounters.push({ label, current, target });

      counterLabelInput.value = '';
      counterCurrentInput.value = '';
      counterTargetInput.value = '';
      renderCountersConfig();
      await saveSettings(`Счётчик «${label}» добавлен`);
    }
  });

  // Render Rules Config
  function renderRulesConfig() {
    rulesConfigList.innerHTML = '';
    const rules = currentSettings.interceptor.dailyRules || [];

    rules.forEach((rule, idx) => {
      const tag = document.createElement('div');
      tag.className = 'tag';
      tag.innerHTML = `
        <span>«${rule}»</span>
        <span class="tag-remove-rule" data-idx="${idx}">&times;</span>
      `;
      rulesConfigList.appendChild(tag);
    });

    document.querySelectorAll('.tag-remove-rule').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = e.target.getAttribute('data-idx');
        currentSettings.interceptor.dailyRules.splice(idx, 1);
        renderRulesConfig();
        await saveSettings('Правило удалено');
      });
    });
  }

  addRuleBtn.addEventListener('click', async () => {
    const rule = ruleInput.value.trim();
    if (rule) {
      if (!currentSettings.interceptor.dailyRules) currentSettings.interceptor.dailyRules = [];
      currentSettings.interceptor.dailyRules.push(rule);
      ruleInput.value = '';
      renderRulesConfig();
      await saveSettings('Правило дня добавлено');
    }
  });

  // Eye Rest Listeners
  notificationsToggle.addEventListener('change', async (e) => {
    currentSettings.notificationsEnabled = e.target.checked;
    await saveSettings();
  });

  intervalSelect.addEventListener('change', async (e) => {
    currentSettings.eyeRestIntervalMinutes = parseInt(e.target.value, 10);
    await saveSettings();
  });

  // TickTick Listeners & OAuth
  ticktickToggle.addEventListener('change', async (e) => {
    currentSettings.ticktick.enabled = e.target.checked;
    await saveSettings('Настройки TickTick сохранены');
  });

  ticktickClientIdInput.addEventListener('change', async (e) => {
    currentSettings.ticktick.clientId = e.target.value.trim();
    await saveSettings('Client ID сохранён');
  });

  ticktickClientSecretInput.addEventListener('change', async (e) => {
    currentSettings.ticktick.clientSecret = e.target.value.trim();
    await saveSettings('Client Secret сохранён');
  });

  ticktickTokenInput.addEventListener('change', async (e) => {
    currentSettings.ticktick.token = e.target.value.trim();
    await saveSettings('Токен TickTick сохранён');
  });

  // Open Auth URL Button
  authTicktickBtn.addEventListener('click', () => {
    const clientId = ticktickClientIdInput.value.trim();
    if (!clientId) {
      alert('⚠️ Пожалуйста, введите Client ID перед входом.');
      return;
    }
    const redirectUri = 'http://localhost';
    const authUrl = `https://ticktick.com/oauth/authorize?client_id=${encodeURIComponent(clientId)}&scope=tasks:read%20tasks:write&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
    chrome.tabs.create({ url: authUrl });
    showToast('Страница авторизации открыта!');
  });

  // Exchange Code Button
  exchangeCodeBtn.addEventListener('click', async () => {
    const clientId = ticktickClientIdInput.value.trim();
    const clientSecret = ticktickClientSecretInput.value.trim();
    let rawVal = ticktickAuthCodeInput.value.trim();

    if (!clientId || !clientSecret) {
      alert('⚠️ Введите Client ID и Client Secret.');
      return;
    }
    if (!rawVal) {
      alert('⚠️ Вставьте ссылку (http://localhost/?code=...) или сам код из адресной строки.');
      return;
    }

    let code = rawVal;
    if (rawVal.includes('code=')) {
      try {
        const u = new URL(rawVal);
        code = u.searchParams.get('code') || rawVal;
      } catch (e) {
        const match = rawVal.match(/code=([^&]+)/);
        if (match) code = match[1];
      }
    }

    exchangeCodeBtn.textContent = '⏳ Получение токена...';
    try {
      const bodyParams = new URLSearchParams();
      bodyParams.append('client_id', clientId);
      bodyParams.append('client_secret', clientSecret);
      bodyParams.append('code', code);
      bodyParams.append('grant_type', 'authorization_code');
      bodyParams.append('redirect_uri', 'http://localhost');

      const res = await fetch('https://ticktick.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams.toString()
      });

      if (res.ok) {
        const tokenData = await res.json();
        const accessToken = tokenData.access_token;
        if (accessToken) {
          currentSettings.ticktick.token = accessToken;
          currentSettings.ticktick.enabled = true;
          ticktickTokenInput.value = accessToken;
          ticktickToggle.checked = true;
          ticktickAuthCodeInput.value = '';
          await saveSettings('🎉 Авторизация TickTick успешна!');
          alert('🎉 Поздравляем! Токен получен и сохранён. Синхронизация с TickTick готова!');
        } else {
          alert('❌ Ошибка: Токен не вернулся. Проверьте правильность кода.');
        }
      } else {
        alert(`❌ Ошибка ответа сервера TickTick: ${res.status}. Срок действия кода мог истечь. Откройте авторизацию заново.`);
      }
    } catch (err) {
      alert('❌ Сетевая ошибка при обмене кода на токен.');
    } finally {
      exchangeCodeBtn.textContent = 'Завершить вход 🚀';
    }
  });

  testTicktickBtn.addEventListener('click', async () => {
    const token = ticktickTokenInput.value.trim();
    if (!token) {
      alert('⚠️ Токен ещё не получен. Пройдите авторизацию выше!');
      return;
    }

    testTicktickBtn.textContent = '⏳ Подключение...';
    try {
      const res = await fetch('https://api.ticktick.com/open/v1/project', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('✅ Успешное подключение к TickTick!');
        alert('🎉 Связь с TickTick установлена успешно! Все ваши проекты доступны.');
      } else {
        alert(`❌ Ошибка TickTick: ${res.status}. Нажмите «Завершить вход» заново.`);
      }
    } catch (err) {
      alert('❌ Ошибка сети при попытке связи с TickTick API.');
    } finally {
      testTicktickBtn.textContent = '🔄 Проверить подключение';
    }
  });

  // YouTube Cleaner Listeners
  const ytKeys = [
    ['ytCleanerToggle', 'enabled'],
    ['ytHideHomePage', 'hideHomePage'],
    ['ytHideShorts', 'hideShorts'],
    ['ytHideComments', 'hideComments'],
    ['ytHideRecommended', 'hideRecommended'],
    ['ytHideThumbnails', 'hideThumbnails'],
    ['ytBlurThumbnails', 'blurThumbnails'],
    ['ytHideSubscriptions', 'hideSubscriptions'],
    ['ytHideExplore', 'hideExplore'],
    ['ytHideTopBar', 'hideTopBar'],
    ['ytDisableEndCards', 'disableEndCards'],
    ['ytBlackAndWhite', 'blackAndWhite']
  ];

  ytKeys.forEach(([elementId, settingKey]) => {
    const el = document.getElementById(elementId);
    if (el) {
      el.addEventListener('change', async (e) => {
        currentSettings.youtubeCleaner[settingKey] = e.target.checked;
        await saveSettings('Параметры YouTube обновлены');
      });
    }
  });

  // Anti-Doomscroll Listeners
  antiDoomToggle.addEventListener('change', async (e) => {
    currentSettings.antiDoomscroll.enabled = e.target.checked;
    await saveSettings();
  });

  doomLimitInput.addEventListener('change', async (e) => {
    currentSettings.antiDoomscroll.dailyLimitMinutes = Math.max(1, parseInt(e.target.value, 10) || 30);
    await saveSettings();
  });

  doomIntervalInput.addEventListener('change', async (e) => {
    currentSettings.antiDoomscroll.challengeIntervalMinutes = Math.max(1, parseInt(e.target.value, 10) || 5);
    await saveSettings();
  });

  doomTypeSelect.addEventListener('change', async (e) => {
    currentSettings.antiDoomscroll.challengeType = e.target.value;
    await saveSettings();
  });

  // Render Custom Limits
  function renderCustomLimits() {
    customLimitsList.innerHTML = '';
    const entries = Object.entries(currentSettings.customDomainLimits || {});

    if (entries.length === 0) {
      customLimitsList.innerHTML = '<div class="empty-state">Нет индивидуальных лимитов</div>';
      return;
    }

    entries.forEach(([domain, mins]) => {
      const item = document.createElement('div');
      item.className = 'custom-limit-item';
      item.innerHTML = `
        <div>
          <strong>${domain}</strong>: <span class="limit-tag-badge">${mins} мин / день</span>
        </div>
        <span class="tag-remove-limit" data-domain="${domain}" style="cursor:pointer; font-weight:bold; color:#fb7185;">&times;</span>
      `;
      customLimitsList.appendChild(item);
    });

    document.querySelectorAll('.tag-remove-limit').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const dom = e.target.getAttribute('data-domain');
        delete currentSettings.customDomainLimits[dom];
        renderCustomLimits();
        await saveSettings(`Лимит для ${dom} удалён`);
      });
    });
  }

  addCustomLimitBtn.addEventListener('click', async () => {
    const dom = cleanDomain(customLimitDomainInput.value);
    const mins = Math.max(1, parseInt(customLimitMinsInput.value, 10) || 20);

    if (dom) {
      currentSettings.customDomainLimits[dom] = mins;
      customLimitDomainInput.value = '';
      renderCustomLimits();
      await saveSettings(`Лимит ${mins} мин установлен для ${dom}`);
    }
  });

  // Render Hard Block Tags
  function renderHardBlockTags() {
    hardBlockDomainTags.innerHTML = '';
    (currentSettings.hardBlockedDomains || []).forEach(domain => {
      const tag = document.createElement('div');
      tag.className = 'tag';
      tag.style.borderColor = 'rgba(251, 113, 133, 0.4)';
      tag.innerHTML = `
        <span style="color:#fb7185;">🚫 ${domain}</span>
        <span class="tag-remove-hard" data-domain="${domain}">&times;</span>
      `;
      hardBlockDomainTags.appendChild(tag);
    });

    document.querySelectorAll('.tag-remove-hard').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const dom = e.target.getAttribute('data-domain');
        currentSettings.hardBlockedDomains = currentSettings.hardBlockedDomains.filter(d => d !== dom);
        renderHardBlockTags();
        await saveSettings(`Блокировка с ${dom} снята`);
      });
    });
  }

  addHardBlockBtn.addEventListener('click', async () => {
    const dom = cleanDomain(hardBlockDomainInput.value);
    if (dom && !currentSettings.hardBlockedDomains.includes(dom)) {
      currentSettings.hardBlockedDomains.push(dom);
      hardBlockDomainInput.value = '';
      renderHardBlockTags();
      await saveSettings(`Домен ${dom} заблокирован (Хард-блок)`);
    }
  });

  // Render Anti-Doomscroll Tags
  function renderDoomDomainTags() {
    doomDomainTags.innerHTML = '';
    (currentSettings.antiDoomscroll.targetDomains || []).forEach(domain => {
      const tag = document.createElement('div');
      tag.className = 'tag';
      tag.innerHTML = `
        <span>${domain}</span>
        <span class="tag-remove-doom" data-domain="${domain}">&times;</span>
      `;
      doomDomainTags.appendChild(tag);
    });

    document.querySelectorAll('.tag-remove-doom').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const domToRemove = e.target.getAttribute('data-domain');
        currentSettings.antiDoomscroll.targetDomains = currentSettings.antiDoomscroll.targetDomains.filter(d => d !== domToRemove);
        renderDoomDomainTags();
        await saveSettings('Список сайтов защиты обновлён');
      });
    });
  }

  addDoomDomainBtn.addEventListener('click', async () => {
    const dom = cleanDomain(doomDomainInput.value);
    if (dom && !currentSettings.antiDoomscroll.targetDomains.includes(dom)) {
      currentSettings.antiDoomscroll.targetDomains.push(dom);
      doomDomainInput.value = '';
      renderDoomDomainTags();
      await saveSettings(`Домен ${dom} добавлен в защиту от залипания`);
    }
  });

  // Render Productivity Domain List
  function renderProdDomainList() {
    prodDomainList.innerHTML = '';
    const entries = Object.entries(currentSettings.domainProductivity || {});

    if (entries.length === 0) {
      prodDomainList.innerHTML = '<div class="empty-state">Нет пользовательских категорий</div>';
      return;
    }

    const labels = {
      'productive': '🟢 Продуктивный',
      'neutral': '🟡 Нейтральный',
      'distraction': '🔴 Отвлекающий'
    };

    entries.forEach(([domain, type]) => {
      const item = document.createElement('div');
      item.className = 'custom-limit-item';
      item.innerHTML = `
        <div>
          <strong>${domain}</strong>: <span>${labels[type] || type}</span>
        </div>
        <span class="tag-remove-prod" data-domain="${domain}" style="cursor:pointer; font-weight:bold; color:#fb7185;">&times;</span>
      `;
      prodDomainList.appendChild(item);
    });

    document.querySelectorAll('.tag-remove-prod').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const dom = e.target.getAttribute('data-domain');
        delete currentSettings.domainProductivity[dom];
        renderProdDomainList();
        await saveSettings(`Категория для ${dom} сброшена`);
      });
    });
  }

  addProdCategoryBtn.addEventListener('click', async () => {
    const dom = cleanDomain(prodDomainInput.value);
    const cat = prodCategorySelect.value;
    if (dom) {
      currentSettings.domainProductivity[dom] = cat;
      prodDomainInput.value = '';
      renderProdDomainList();
      await saveSettings(`Категория для ${dom} сохранена`);
    }
  });

  // Render Excluded Domains Tags
  function renderDomainTags() {
    domainTagsContainer.innerHTML = '';
    (currentSettings.excludedDomains || []).forEach(domain => {
      const tag = document.createElement('div');
      tag.className = 'tag';
      tag.innerHTML = `
        <span>${domain}</span>
        <span class="tag-remove" data-domain="${domain}">&times;</span>
      `;
      domainTagsContainer.appendChild(tag);
    });

    document.querySelectorAll('.tag-remove').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const domToRemove = e.target.getAttribute('data-domain');
        currentSettings.excludedDomains = currentSettings.excludedDomains.filter(d => d !== domToRemove);
        renderDomainTags();
        await saveSettings('Список исключений обновлён');
      });
    });
  }

  addDomainBtn.addEventListener('click', async () => {
    const dom = cleanDomain(domainInput.value);
    if (dom && !currentSettings.excludedDomains.includes(dom)) {
      currentSettings.excludedDomains.push(dom);
      domainInput.value = '';
      renderDomainTags();
      await saveSettings(`Домен ${dom} добавлен в исключения`);
    }
  });

  // Export JSON Data
  exportJsonBtn.addEventListener('click', async () => {
    const allData = await chrome.storage.local.get(null);
    // Never put secrets into a backup file the user may share
    if (allData.settings && allData.settings.ticktick) {
      allData.settings.ticktick = { ...allData.settings.ticktick, token: '', clientSecret: '' };
    }
    const jsonStr = JSON.stringify(allData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `eyetime-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Файл JSON сохранён');
  });

  // Export CSV (one row per day + domain/app)
  document.getElementById('exportCsvBtn')?.addEventListener('click', async () => {
    const { stats = {} } = await chrome.storage.local.get(['stats']);
    const esc = v => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [['date', 'type', 'name', 'seconds']];
    Object.keys(stats).sort().forEach(date => {
      Object.entries(stats[date].domains || {}).forEach(([n, sec]) => rows.push([date, 'site', n, Math.round(sec)]));
      Object.entries(stats[date].desktopApps || {}).forEach(([n, sec]) => rows.push([date, 'app', n, Math.round(sec)]));
    });
    const blob = new Blob(['\ufeff' + rows.map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eyetime-stats-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('CSV saved');
  });

  // Import JSON backup (merges stats, replaces settings but keeps local TickTick secrets)
  const importInput = document.getElementById('importJsonInput');
  document.getElementById('importJsonBtn')?.addEventListener('click', () => importInput?.click());
  importInput?.addEventListener('change', async () => {
    const file = importInput.files[0];
    importInput.value = '';
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      if (!imported || typeof imported !== 'object' || Array.isArray(imported)) throw new Error('bad format');
      const current = await chrome.storage.local.get(null);
      const next = {};
      if (imported.settings && typeof imported.settings === 'object') {
        next.settings = imported.settings;
        if (current.settings?.ticktick) {
          next.settings.ticktick = { ...(imported.settings.ticktick || {}), token: current.settings.ticktick.token || '', clientSecret: current.settings.ticktick.clientSecret || '' };
        }
      }
      if (imported.stats && typeof imported.stats === 'object') {
        const stats = current.stats || {};
        Object.entries(imported.stats).forEach(([date, day]) => {
          const cur = stats[date] || {};
          stats[date] = { ...day, ...cur,
            domains: { ...(day.domains || {}), ...(cur.domains || {}) },
            desktopApps: { ...(day.desktopApps || {}), ...(cur.desktopApps || {}) } };
        });
        next.stats = stats;
      }
      ['dailyGoals', 'eyetime_onboarded'].forEach(k => { if (imported[k] !== undefined) next[k] = imported[k]; });
      await chrome.storage.local.set(next);
      showToast('Backup imported — reloading…');
      setTimeout(() => location.reload(), 800);
    } catch (e) {
      showToast('Import failed: invalid backup file');
    }
  });

  // Reset Data
  resetDataBtn.addEventListener('click', async () => {
    const confirmed = confirm('⚠️ Внимание!\nВы действительно хотите безвозвратно удалить всю сохранённую статистику активности и перерывов?');
    if (confirmed) {
      await chrome.storage.local.set({ stats: {} });
      showToast('Вся статистика успешно сброшена');
    }
  });
});

// Interface language selector
document.addEventListener('DOMContentLoaded', async () => {
  const sel = document.getElementById('languageSelect');
  if (!sel) return;
  const { settings = {} } = await chrome.storage.local.get(['settings']);
  sel.value = settings.language || 'auto';
  sel.addEventListener('change', async () => {
    const { settings: cur = {} } = await chrome.storage.local.get(['settings']);
    cur.language = sel.value;
    await chrome.storage.local.set({ settings: cur });
    try { localStorage.setItem('eyetime_lang', sel.value); } catch (e) { }
    location.reload();
  });
});
