// EyeTime — Background Service Worker with Ironclad Nuclear Lockdown, Anti-Bypass Shield & Master Central DB Multi-Browser Sync Engine

const DEFAULT_SETTINGS = {
  eyeRestIntervalMinutes: 20,
  notificationsEnabled: true,
  excludedDomains: ['localhost', '127.0.0.1'],
  pauseUntil: 0,
  interceptor: {
    bedtime: '23:30',
    bedtimeSetForToday: false,
    morningWalkRequired: true,
    morningWalkDone: false,
    strictFocusLock: false,
    uncomfortableCounters: [
      { label: 'Созвонов проведено', current: 0, target: 10, isAccountable: true },
      { label: 'Платящих школ', current: 0, target: 5 },
      { label: 'Доход в этом месяце', current: 0, target: 750, unit: '$' },
      { label: 'Накоплено', current: 4200, target: 6000, unit: '$' }
    ],
    dailyRules: [
      'Утро — CRM, всегда',
      'Два продюсерских проекта максимум',
      'Подушка — не бюджет'
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
});

// Alarm Handler
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'eyeRestAlarm') {
    await checkEyeRestNotification();
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

// Bypasses Protection: Instantly block chrome://extensions, settings, flags, history during active Nuclear Lock
function enforceExtensionProtection(tabId, url, settings) {
  if (!url) return;
  const isNuclear = isNuclearActive(settings);
  const isNight = isNightLockdownActive(settings);

  if (isNuclear || isNight) {
    const lower = url.toLowerCase();
    const forbidden = [
      'chrome://extensions',
      'chrome://settings',
      'chrome://flags',
      'chrome://history',
      'edge://extensions',
      'edge://settings',
      'about:addons',
      'about:config'
    ];
    if (forbidden.some(f => lower.includes(f))) {
      chrome.tabs.update(tabId, { url: chrome.runtime.getURL('newtab/newtab.html') }).catch(() => { });
    }
  }
}

async function trackActiveTab() {
  const now = Date.now();
  const elapsedSeconds = Math.floor((now - lastTickTimestamp) / 1000);
  lastTickTimestamp = now;

  if (elapsedSeconds <= 0) return;

  const data = await chrome.storage.local.get(['settings', 'stats']);
  const settings = data.settings || DEFAULT_SETTINGS;
  if (settings.pauseUntil && now < settings.pauseUntil) return;

  // 1. TRACK BROWSER DOMAINS & POST TO MASTER CENTRAL DB FOR MULTI-BROWSER SYNC (CHROME + EDGE)
  if (activeDomain && !isExcluded(activeDomain, settings)) {
    const idleState = await chrome.idle.queryState(60);
    if (idleState === 'active') {
      const todayKey = new Date().toISOString().slice(0, 10);
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

setInterval(() => {
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
}, 1000);

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

    chrome.notifications.create('eyeRestNotice', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '👁️ Пауза для глаз (20-20-20)',
      message: `Прошло ${intervalMins} минут реального времени! Посмотрите на объект в 6 метрах на 20 секунд.`,
      buttons: [{ title: '✅ Сделал перерыв' }, { title: '⏸️ Сноуз 5 мин' }],
      priority: 2
    });
  }
}

chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (notificationId === 'eyeRestNotice') {
    if (buttonIndex === 0) {
      const data = await chrome.storage.local.get(['stats']);
      const todayKey = new Date().toISOString().slice(0, 10);
      const stats = data.stats || {};
      if (stats[todayKey]) {
        stats[todayKey].breaksCompleted = (stats[todayKey].breaksCompleted || 0) + 1;
        await chrome.storage.local.set({ stats });
      }
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
  const bedtimeStr = settings.interceptor?.bedtime || '23:30';
  const [bHrs, bMins] = bedtimeStr.split(':').map(Number);

  const now = new Date();
  const hrs = now.getHours();
  const mins = now.getMinutes();
  const currentMins = hrs * 60 + mins;
  const bedtimeMins = bHrs * 60 + bMins;

  if (currentMins >= bedtimeMins || currentMins < 5 * 60) {
    return true;
  }
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

      // 2. NIGHT LOCKDOWN CHECK
      if (isNightLockdownActive(settings)) {
        sendResponse({
          isNightLockdown: true,
          bedtime: settings.interceptor?.bedtime || '23:30'
        });
        return;
      }

      if (!domain) {
        sendResponse({ challengeRequired: false });
        return;
      }

      const isFocusActive = interceptor.focusBlockActive && Date.now() < (interceptor.focusBlockEndTime || 0);
      const isStrict = interceptor.strictFocusLock || false;
      const isDistraction = ['youtube.com', 'reddit.com', 'vk.com', 'twitter.com', 'x.com', 'tiktok.com', 'twitch.tv', 'instagram.com'].some(d => domain.includes(d));

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
      const todayKey = new Date().toISOString().slice(0, 10);
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

  if (request.action === 'FORCE_TICK') {
    trackActiveTab();
    pollDesktopTracker();
    sendResponse({ success: true, pcTrackerStatus });
    return true;
  }
});
