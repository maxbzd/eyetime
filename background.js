// EyeTime — Background Service Worker with Ironclad Nuclear Lockdown, Anti-Bypass Shield & Master Central DB Multi-Browser Sync Engine

// Chrome/Edge load these via importScripts; Firefox lists them in manifest background.scripts
if (typeof importScripts === 'function') importScripts('assets/i18n_en.js', 'assets/i18n.js', 'assets/blocking.js', 'assets/report.js');
const BL = self.EyeTimeBlocking;
const RP = self.EyeTimeReport;
const t = (s) => self.EyeTimeI18n.t(s);

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DEFAULT_SETTINGS = {
  eyeRestIntervalMinutes: 20,
  notificationsEnabled: true,
  excludedDomains: ['localhost', '127.0.0.1'],
  pauseUntil: 0,
  interceptor: {
    bedtime: '23:30',
    bedtimeSetForToday: false,
    strictFocusLock: false,
    uncomfortableCounters: [
      { label: 'Сессий глубокого фокуса', current: 0, target: 4 },
      { label: 'Важных закрытых задач', current: 0, target: 5 },
      { label: 'Прочитано страниц / статей', current: 0, target: 20 }
    ],
    dailyRules: [
      'Сначала главная задача дня',
      'Перерывы для отдыха глаз каждые 25 минут',
      'Фокус важнее суеты'
    ]
  },
  nuclearLock: {
    active: false,
    endTime: 0,
    domains: ['youtube.com', 'reddit.com', 'vk.com', 'twitter.com', 'x.com', 'tiktok.com', 'twitch.tv', 'instagram.com', 'youtu.be', 'vk.ru']
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

let activeTabId = null;
let activeDomain = null;
let lastTickTimestamp = Date.now();

// PC Application Tracker State
let pcTrackerStatus = {
  online: false,
  activeApp: '',
  exeName: '',
  windowTitle: '',
  isIdle: false,
  category: 'Приложение',
  lastSeen: 0
};

// Poll Local Python/Windows Master Central Database on http://127.0.0.1:8765
async function pollDesktopTracker() {
  try {
    const res = await fetch('http://127.0.0.1:8765/', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      pcTrackerStatus = {
        online: true,
        activeApp: data.activeApp || '',
        exeName: data.exeName || '',
        windowTitle: data.windowTitle || '',
        isIdle: !!data.isIdle,
        category: data.category || 'Приложение',
        lastSeen: Date.now()
      };

      // Direct Uninterrupted Sync from Central Master DB across Chrome + Edge + PC Apps
      if (data.masterData && data.masterData.stats) {
        const storageData = await chrome.storage.local.get(['stats']);
        const stats = storageData.stats || {};

        Object.entries(data.masterData.stats).forEach(([dateKey, masterDay]) => {
          if (!stats[dateKey]) {
            stats[dateKey] = { totalSeconds: 0, domains: {}, desktopApps: {}, breaksCompleted: 0 };
          }
          if (!stats[dateKey].desktopApps) stats[dateKey].desktopApps = {};
          if (!stats[dateKey].domains) stats[dateKey].domains = {};

          Object.entries(masterDay.desktopApps || {}).forEach(([app, sec]) => {
            stats[dateKey].desktopApps[app] = Math.max(stats[dateKey].desktopApps[app] || 0, Math.round(sec));
          });

          Object.entries(masterDay.domains || {}).forEach(([dom, sec]) => {
            stats[dateKey].domains[dom] = Math.max(stats[dateKey].domains[dom] || 0, Math.round(sec));
          });

          if (!stats[dateKey].hourly) stats[dateKey].hourly = {};
          if (masterDay.hourly) {
            Object.entries(masterDay.hourly).forEach(([h, sec]) => {
              stats[dateKey].hourly[h] = Math.max(stats[dateKey].hourly[h] || 0, Math.round(sec));
            });
          }

          const domTot = Object.values(stats[dateKey].domains).reduce((a, b) => a + b, 0);
          const appTot = Object.values(stats[dateKey].desktopApps).reduce((a, b) => a + b, 0);
          stats[dateKey].totalSeconds = domTot + appTot;
        });

        await chrome.storage.local.set({ stats, pcTrackerStatus });
      } else {
        await chrome.storage.local.set({ pcTrackerStatus });
      }
    }
  } catch (e) {
    pcTrackerStatus.online = false;
    await chrome.storage.local.set({ pcTrackerStatus: { online: false, lastSeen: Date.now() } });
  }
}

setInterval(pollDesktopTracker, 2000);
pollDesktopTracker();

// Global Command Listener (Alt+K Quick Thought Capture)
chrome.commands.onCommand.addListener((command) => {
  if (command === 'quick-capture') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'TOGGLE_QUICK_CAPTURE_MODAL' }).catch(() => { });
      }
    });
  }
});

// Alarm & Startup setup
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(['settings', 'stats']);
  if (!data.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
  if (!data.stats) {
    await chrome.storage.local.set({ stats: {} });
  }
  chrome.alarms.create('eyeRestAlarm', { periodInMinutes: 1 });
  chrome.alarms.create('trackerTick', { periodInMinutes: 0.5 });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('trackerTick', { periodInMinutes: 0.5 });
});

// Alarm Handler
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'eyeRestAlarm') {
    await checkEyeRestNotification();
  }
  if (alarm.name.startsWith('notify:')) {
    const name = alarm.name.slice(7);
    const d = await chrome.storage.local.get(['notifyPayloads']);
    const p = (d.notifyPayloads || {})[name];
    if (p) {
      chrome.notifications.create('notify_' + name, { type: 'basic', iconUrl: 'icons/icon128.png', title: p.title, message: p.message });
      delete d.notifyPayloads[name];
      await chrome.storage.local.set({ notifyPayloads: d.notifyPayloads });
    }
  }
  if (alarm.name === 'focusEnd') {
    await finishFocusBlock();
  }
  if (alarm.name === 'trackerTick') {
    updateBadge(true);
    maybeSendWeeklyReport();
    refreshActiveTab();
    pollDesktopTracker();
  }
});

function getDomainFromUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'chrome:' || parsed.protocol === 'chrome-extension:' || parsed.protocol === 'about:') {
      return null;
    }
    return parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '').replace(/^tv\./, '');
  } catch (e) {
    return null;
  }
}

function isExcluded(domain, settings) {
  if (!domain) return true;
  const list = settings.excludedDomains || [];
  return list.some(ex => domain === ex || domain.endsWith('.' + ex));
}

function isNuclearActive(settings) {
  const n = settings.nuclearLock;
  if (n && n.active && Date.now() < n.endTime) {
    return true;
  }
  return false;
}

// ALIAS EXPANSION MATCHING (youtube -> youtube.com, youtube.be, ytimg.com; twitter -> x.com)
function isDomainNuclearMatched(domain, nuclearDomains) {
  if (!domain || !nuclearDomains || nuclearDomains.length === 0) return false;

  const aliases = [];
  nuclearDomains.forEach(d => {
    aliases.push(d);
    if (d.includes('youtube')) {
      aliases.push('youtu.be', 'ytimg.com');
    }
    if (d.includes('twitter')) {
      aliases.push('x.com');
    }
    if (d.includes('x.com')) {
      aliases.push('twitter.com');
    }
    if (d.includes('vk.com')) {
      aliases.push('vk.ru', 'userapi.com');
    }
  });

  return aliases.some(a => domain === a || domain.endsWith('.' + a) || a.endsWith('.' + domain));
}

// Bypasses Protection: DISABLED to always allow access to chrome://extensions
function enforceExtensionProtection(tabId, url, settings) {
  // Always permit access to internal pages, extensions, and settings
  return;
}

// Toolbar badge: today's tracked time (teal while work hours are active)
let lastBadgeUpdate = 0;
async function updateBadge(force) {
  if (!force && Date.now() - lastBadgeUpdate < 20000) return;
  lastBadgeUpdate = Date.now();
  const data = await chrome.storage.local.get(['settings', 'stats']);
  const settings = data.settings || DEFAULT_SETTINGS;
  if (settings.showBadge === false) { chrome.action.setBadgeText({ text: '' }); return; }
  const sec = data.stats?.[localDateKey()]?.totalSeconds || 0;
  const m = Math.floor(sec / 60), h = Math.floor(m / 60);
  const text = sec < 60 ? '' : (h === 0 ? `${m}m` : (h >= 10 ? `${h}h` : `${h}h${String(m % 60).padStart(2, '0')}`));
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: BL.isScheduleActive(settings) ? '#0d9488' : '#475569' });
}

async function trackActiveTab() {
  const now = Date.now();
  const elapsedSeconds = Math.floor((now - lastTickTimestamp) / 1000);
  lastTickTimestamp = now;

  // Ignore gaps longer than 2 minutes (worker was suspended / computer slept)
  if (elapsedSeconds <= 0 || elapsedSeconds > 120) return;

  const data = await chrome.storage.local.get(['settings', 'stats']);
  const settings = data.settings || DEFAULT_SETTINGS;
  if (settings.pauseUntil && now < settings.pauseUntil) return;

  // 1. TRACK BROWSER DOMAINS & POST TO MASTER CENTRAL DB FOR MULTI-BROWSER SYNC (CHROME + EDGE)
  if (activeDomain && !isExcluded(activeDomain, settings)) {
    const idleState = await chrome.idle.queryState(60);
    if (idleState === 'active') {
      const todayKey = localDateKey();
      const storageData = await chrome.storage.local.get(['stats']);
      const stats = storageData.stats || {};
      if (!stats[todayKey]) {
        stats[todayKey] = { totalSeconds: 0, domains: {}, desktopApps: {}, breaksCompleted: 0 };
      }
      if (!stats[todayKey].domains) stats[todayKey].domains = {};
      if (!stats[todayKey].desktopApps) stats[todayKey].desktopApps = {};

      if (!stats[todayKey].hourly) stats[todayKey].hourly = {};
      const currentHour = new Date().getHours();
      stats[todayKey].hourly[currentHour] = (stats[todayKey].hourly[currentHour] || 0) + elapsedSeconds;

      const domTot = Object.values(stats[todayKey].domains).reduce((a, b) => a + b, 0);
      const appTot = Object.values(stats[todayKey].desktopApps).reduce((a, b) => a + b, 0);
      stats[todayKey].totalSeconds = domTot + appTot;

      await chrome.storage.local.set({ stats });
      updateBadge();

      // Post tick to Master Central DB Server on PC
      try {
        fetch('http://127.0.0.1:8765/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'SYNC_DOMAIN_TIME',
            domain: activeDomain,
            seconds: elapsedSeconds
          })
        }).catch(() => { });
      } catch (e) { }
    }
  }
}

function refreshActiveTab() {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    if (tabs.length > 0 && tabs[0].url) {
      const dom = getDomainFromUrl(tabs[0].url);
      activeTabId = tabs[0].id;
      activeDomain = dom;

      chrome.storage.local.get(['settings'], (data) => {
        const settings = data.settings || DEFAULT_SETTINGS;
        enforceExtensionProtection(tabs[0].id, tabs[0].url, settings);

        // Immediate hard redirect for active tab if nuclear blocked
        if (isNuclearActive(settings) && dom) {
          if (isDomainNuclearMatched(dom, settings.nuclearLock.domains)) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'FORCE_NUCLEAR_LOCK' }).catch(() => { });
          }
        }
      });
    } else {
      activeDomain = null;
    }
    trackActiveTab();
  });
}

setInterval(refreshActiveTab, 1000);

// MV3 service workers are suspended when idle, so timers alone are not reliable:
// wake up on tab/window events and on a 30s alarm.
chrome.tabs.onActivated.addListener(refreshActiveTab);
chrome.tabs.onUpdated.addListener((id, info) => { if (info.url || info.status === 'complete') refreshActiveTab(); });
chrome.windows.onFocusChanged.addListener(refreshActiveTab);


// Fortified Navigation Monitor: Block Tab Instantly Before Loading Page
if (chrome.webNavigation && chrome.webNavigation.onBeforeNavigate) {
  chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    if (details.frameId !== 0) return;
    const data = await chrome.storage.local.get(['settings']);
    const settings = data.settings || DEFAULT_SETTINGS;

    enforceExtensionProtection(details.tabId, details.url, settings);

    if (isNuclearActive(settings)) {
      const dom = getDomainFromUrl(details.url);
      if (dom && isDomainNuclearMatched(dom, settings.nuclearLock.domains)) {
        chrome.tabs.sendMessage(details.tabId, { action: 'FORCE_NUCLEAR_LOCK' }).catch(() => { });
      }
    }
  });
}

// Instant Tab Navigation Monitor Backup
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    const data = await chrome.storage.local.get(['settings']);
    const settings = data.settings || DEFAULT_SETTINGS;

    enforceExtensionProtection(tabId, changeInfo.url, settings);

    if (isNuclearActive(settings)) {
      const dom = getDomainFromUrl(changeInfo.url);
      if (dom && isDomainNuclearMatched(dom, settings.nuclearLock.domains)) {
        chrome.tabs.sendMessage(tabId, { action: 'FORCE_NUCLEAR_LOCK' }).catch(() => { });
      }
    }
  }
});

// Monday-morning digest of the last completed week
function fmtHM(sec) {
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}ч ${m % 60}м` : `${m}м`;
}

async function maybeSendWeeklyReport() {
  const data = await chrome.storage.local.get(['settings', 'stats', 'lastWeeklyReport']);
  const settings = data.settings || DEFAULT_SETTINGS;
  if (settings.weeklyReport === false) return;
  const now = new Date();
  const monday9 = RP.weekStart(now); monday9.setHours(9, 0, 0, 0);
  if (now < monday9) return;
  const report = RP.computeWeeklyReport(data.stats || {}, (d) => BL.isDistraction(d, settings), now);
  const thisWeekKey = RP.key(RP.weekStart(now));
  if (data.lastWeeklyReport === thisWeekKey) return;
  await chrome.storage.local.set({ lastWeeklyReport: thisWeekKey });
  if (report.total < 600) return; // nothing meaningful to report
  const lines = [
    report.deltaPct === null
      ? t('Экранное время: ' + fmtHM(report.total))
      : t('Экранное время: ' + fmtHM(report.total) + ' (' + (report.deltaPct > 0 ? '+' : '') + report.deltaPct + '% к прошлой неделе)')
  ];
  if (report.distraction >= 60) lines.push(t('Отвлечения: ' + fmtHM(report.distraction)));
  if (report.topSites.length) lines.push(t('Чаще всего: ' + report.topSites.join(', ')));
  if (report.focusSessions) lines.push(t('Фокус-сессий: ' + report.focusSessions));
  chrome.notifications.create('weeklyReport', {
    type: 'basic', iconUrl: 'icons/icon128.png',
    title: t('📊 Итоги недели'),
    message: lines.join('\n')
  });
}

chrome.notifications.onClicked.addListener((id) => {
  if (id === 'weeklyReport') chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
});

// Focus block bookkeeping lives here so it works even if the new tab page was closed
async function finishFocusBlock() {
  const data = await chrome.storage.local.get(['settings', 'stats']);
  const settings = data.settings || DEFAULT_SETTINGS;
  const inc = settings.interceptor || {};
  if (!inc.focusBlockActive || Date.now() < (inc.focusBlockEndTime || 0) - 2000) return;
  inc.focusBlockActive = false;
  const counter = (inc.uncomfortableCounters || []).find(c => c.label === 'Сессий глубокого фокуса');
  if (counter) counter.current = (counter.current || 0) + 1;
  settings.interceptor = inc;
  const stats = data.stats || {};
  const day = stats[localDateKey()] || (stats[localDateKey()] = { totalSeconds: 0, domains: {}, desktopApps: {}, breaksCompleted: 0 });
  day.focusSessions = (day.focusSessions || 0) + 1;
  await chrome.storage.local.set({ settings, stats });
  chrome.notifications.create('focusDone', {
    type: 'basic', iconUrl: 'icons/icon128.png',
    title: t('🏆 Фокус-блок успешно завершен! Отличная работа!'),
    message: t('Сделайте перерыв: встаньте, выпейте воды, посмотрите вдаль.')
  });
}

async function checkEyeRestNotification() {
  const data = await chrome.storage.local.get(['settings', 'stats', 'lastEyeRestTime']);
  const settings = data.settings || DEFAULT_SETTINGS;
  if (!settings.notificationsEnabled) return;
  if (settings.pauseUntil && Date.now() < settings.pauseUntil) return;

  const intervalMins = settings.eyeRestIntervalMinutes || 20;
  const intervalMs = intervalMins * 60 * 1000;
  const lastRest = data.lastEyeRestTime || Date.now();

  if (Date.now() - lastRest >= intervalMs) {
    await chrome.storage.local.set({ lastEyeRestTime: Date.now() });

    const options = {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: t('👁️ Пауза для глаз (20-20-20)'),
      message: t('Прошло ' + intervalMins + ' минут реального времени! Посмотрите на объект в 6 метрах на 20 секунд.'),
      priority: 2
    };
    // Action buttons are not supported by Firefox
    if (chrome.notifications.onButtonClicked) {
      options.buttons = [{ title: t('✅ Сделал перерыв') }, { title: t('⏸️ Сноуз 5 мин') }];
    }
    chrome.notifications.create('eyeRestNotice', options);
  }
}

async function countBreak() {
  const data = await chrome.storage.local.get(['stats']);
  const todayKey = localDateKey();
  const stats = data.stats || {};
  if (!stats[todayKey]) stats[todayKey] = { totalSeconds: 0, domains: {}, desktopApps: {}, breaksCompleted: 0 };
  stats[todayKey].breaksCompleted = (stats[todayKey].breaksCompleted || 0) + 1;
  await chrome.storage.local.set({ stats });
}

// Firefox has no notification buttons: clicking the notification itself counts as a finished break
chrome.notifications.onClicked.addListener(async (notificationId) => {
  if (notificationId === 'eyeRestNotice' && !chrome.notifications.onButtonClicked) {
    await countBreak();
    chrome.notifications.clear(notificationId);
  }
});

if (chrome.notifications.onButtonClicked) chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (notificationId === 'eyeRestNotice') {
    if (buttonIndex === 0) {
      await countBreak();
    } else if (buttonIndex === 1) {
      const data = await chrome.storage.local.get(['settings']);
      const settings = data.settings || DEFAULT_SETTINGS;
      settings.pauseUntil = Date.now() + 5 * 60 * 1000;
      await chrome.storage.local.set({ settings });
    }
    chrome.notifications.clear(notificationId);
  }
});

function isNightLockdownActive(settings) {
  // Bedtime night lockdown disabled by user request
  return false;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'SAVE_QUICK_THOUGHT') {
    (async () => {
      const txt = request.text;
      const data = await chrome.storage.local.get(['settings', 'dailyGoals']);
      const token = data.settings?.ticktick?.token;

      if (token) {
        try {
          const res = await fetch('https://api.ticktick.com/open/v1/task', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title: txt, projectId: 'inbox' })
          });
          if (res.ok) {
            sendResponse({ success: true, target: 'TickTick Inbox' });
            return;
          }
        } catch (e) { }
      }

      const goals = data.dailyGoals || [];
      goals.push({ text: txt, done: false });
      await chrome.storage.local.set({ dailyGoals: goals });
      sendResponse({ success: true, target: 'Локальные задачи' });
    })();
    return true;
  }

  if (request.action === 'CHECK_DOOMSCROLL') {
    (async () => {
      const data = await chrome.storage.local.get(['settings', 'stats', 'lastDoomChallengeSolved']);
      const settings = data.settings || DEFAULT_SETTINGS;
      const interceptor = settings.interceptor || {};

      const domain = sender.tab ? getDomainFromUrl(sender.tab.url) : activeDomain;

      // 1. NUCLEAR MODE LOCK (HIGHEST PRIORITY)
      if (isNuclearActive(settings) && domain) {
        const nuclearDomains = settings.nuclearLock.domains || [];
        if (isDomainNuclearMatched(domain, nuclearDomains)) {
          sendResponse({
            isNuclearBlocked: true,
            domain,
            endTime: settings.nuclearLock.endTime
          });
          return;
        }
      }

      if (!domain) {
        sendResponse({ challengeRequired: false });
        return;
      }

      // Tell the content script whether this site is one of the user's distractions
      const isDistraction = BL.isDistraction(domain, settings);
      const reply = sendResponse;
      sendResponse = (o) => reply(Object.assign({ isDistraction }, o));

      // 2. WORK HOURS: distractions are blocked during the configured schedule
      if (isDistraction && BL.isScheduleActive(settings) && !(settings.pauseUntil && Date.now() < settings.pauseUntil)) {
        const sched = BL.getBlocking(settings).schedule;
        const passUntil = (await chrome.storage.local.get(['schedulePass'])).schedulePass?.[domain] || 0;
        if (Date.now() >= passUntil) {
          sendResponse({ isScheduleBlocked: true, domain, strict: !!sched.strict, end: sched.end, passMinutes: sched.passMinutes });
          return;
        }
      }

      const isFocusActive = interceptor.focusBlockActive && Date.now() < (interceptor.focusBlockEndTime || 0);
      const isStrict = interceptor.strictFocusLock || false;

      if (isFocusActive && isDistraction) {
        sendResponse({
          isFocusBlockActive: true,
          isStrict: isStrict,
          task: interceptor.focusBlockTask || 'Главная задача'
        });
        return;
      }

      const hardBlocked = settings.hardBlockedDomains || [];
      if (hardBlocked.some(hb => domain === hb || domain.endsWith('.' + hb))) {
        sendResponse({ isHardBlocked: true, domain });
        return;
      }

      const customLimits = settings.customDomainLimits || {};
      const todayKey = localDateKey();
      const domainSpentSec = data.stats?.[todayKey]?.domains?.[domain] || 0;
      const customLimitMins = customLimits[domain];

      if (customLimitMins && domainSpentSec >= customLimitMins * 60) {
        sendResponse({
          challengeRequired: true,
          domain,
          limitMins: customLimitMins,
          spentSec: domainSpentSec,
          type: settings.antiDoomscroll?.challengeType || 'both'
        });
        return;
      }

      const anti = settings.antiDoomscroll || DEFAULT_SETTINGS.antiDoomscroll;
      if (!anti.enabled) {
        sendResponse({ challengeRequired: false, domain, youtubeCleaner: settings.youtubeCleaner });
        return;
      }

      const isTarget = (anti.targetDomains || []).some(td => domain === td || domain.endsWith('.' + td));
      if (!isTarget) {
        sendResponse({ challengeRequired: false, domain, youtubeCleaner: settings.youtubeCleaner });
        return;
      }

      const dailyLimitSec = (anti.dailyLimitMinutes || 30) * 60;
      if (domainSpentSec < dailyLimitSec) {
        sendResponse({ challengeRequired: false, domain, youtubeCleaner: settings.youtubeCleaner });
        return;
      }

      const lastSolved = data.lastDoomChallengeSolved?.[domain] || 0;
      const intervalSec = (anti.challengeIntervalMinutes || 5) * 60;

      if (Date.now() - lastSolved < intervalSec * 1000) {
        sendResponse({ challengeRequired: false, domain, youtubeCleaner: settings.youtubeCleaner });
        return;
      }

      sendResponse({
        challengeRequired: true,
        domain,
        limitMins: anti.dailyLimitMinutes,
        spentSec: domainSpentSec,
        type: anti.challengeType || 'both'
      });
    })();

    return true;
  }

  if (request.action === 'SCHEDULE_PASS' && request.domain) {
    (async () => {
      const data = await chrome.storage.local.get(['settings', 'schedulePass']);
      const sched = BL.getBlocking(data.settings).schedule;
      if (sched.strict) { sendResponse({ success: false }); return; }
      const pass = data.schedulePass || {};
      pass[request.domain] = Date.now() + (sched.passMinutes || 5) * 60000;
      await chrome.storage.local.set({ schedulePass: pass });
      sendResponse({ success: true });
    })();
    return true;
  }

  if (request.action === 'SOLVE_DOOMSCROLL') {
    (async () => {
      const data = await chrome.storage.local.get(['lastDoomChallengeSolved']);
      const solved = data.lastDoomChallengeSolved || {};
      solved[request.domain] = Date.now();
      await chrome.storage.local.set({ lastDoomChallengeSolved: solved });
      sendResponse({ success: true });
    })();
    return true;
  }

  if (request.action === 'CLOSE_CURRENT_TAB' && sender.tab) {
    chrome.tabs.remove(sender.tab.id).catch(() => {});
    sendResponse({ success: true });
    return true;
  }

  // Generic "notify me at <time>" used by widgets (e.g. Pomodoro)
  if (request.action === 'NOTIFY_AT' && request.name && request.endTime) {
    (async () => {
      const d = await chrome.storage.local.get(['notifyPayloads']);
      const p = d.notifyPayloads || {};
      p[request.name] = { title: String(request.title || ''), message: String(request.message || '') };
      await chrome.storage.local.set({ notifyPayloads: p });
      chrome.alarms.create('notify:' + request.name, { when: request.endTime });
      sendResponse({ success: true });
    })();
    return true;
  }

  if (request.action === 'NOTIFY_CANCEL' && request.name) {
    chrome.alarms.clear('notify:' + request.name);
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'FOCUS_STARTED' && request.endTime) {
    chrome.alarms.create('focusEnd', { when: request.endTime });
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'FOCUS_STOPPED') {
    chrome.alarms.clear('focusEnd');
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'FORCE_TICK') {
    trackActiveTab();
    pollDesktopTracker();
    sendResponse({ success: true, pcTrackerStatus });
    return true;
  }
});
