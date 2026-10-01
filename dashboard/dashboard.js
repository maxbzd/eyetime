// EyeTime — Full Tab & PC Application Analytics Dashboard JavaScript Logic

let allStats = {};
let allSettings = {};
let pcTrackerStatus = { online: false };
let activePeriod = 'today';
let activeSource = 'all'; // 'all' | 'web' | 'pc'
let domainSearchQuery = '';

document.addEventListener('DOMContentLoaded', async () => {
  async function checkLiveTracker() {
    try {
      const res = await fetch('http://127.0.0.1:8765/', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        pcTrackerStatus = {
          online: true,
          activeApp: data.activeApp || '',
          exeName: data.exeName || '',
          isIdle: !!data.isIdle
        };
        if (data.masterData && data.masterData.stats) {
          allStats = data.masterData.stats;
        }
      }
    } catch (e) {
      try {
        const bgRes = await chrome.runtime.sendMessage({ action: 'FORCE_TICK' });
        if (bgRes && bgRes.pcTrackerStatus) {
          pcTrackerStatus = bgRes.pcTrackerStatus;
        }
      } catch (err) {
        pcTrackerStatus = { online: false };
      }
    }
    updatePCTrackerBadge();
  }

  await checkLiveTracker();
  await loadDashboardData();

  // Auto-refresh stats every 2.5 seconds live
  setInterval(async () => {
    try {
      await chrome.runtime.sendMessage({ action: 'FORCE_TICK' });
    } catch (e) { }
    await checkLiveTracker();
    await loadDashboardData();
  }, 2500);

  // Period Selector Listeners
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      activePeriod = e.target.getAttribute('data-period');
      renderDashboard();
    });
  });

  // Source Switcher Listeners (All / Web / PC Apps)
  document.querySelectorAll('.source-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.source-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      activeSource = e.target.getAttribute('data-source');

      const titleMap = {
        'all': '📊 Детализация по элементам (Браузер + ПК)',
        'web': '🌐 Детализация по сайтам браузера',
        'pc': '💻 Детализация по программам ПК'
      };
      document.getElementById('tableCardTitle').textContent = titleMap[activeSource] || '📊 Детализация';

      renderDashboard();
    });
  });

  // Search Input Listener
  const searchInput = document.getElementById('domainSearch');
  searchInput.addEventListener('input', (e) => {
    domainSearchQuery = e.target.value.trim().toLowerCase();
    renderDashboard();
  });

  // Export CSV Button
  document.getElementById('exportCsvBtn').addEventListener('click', exportToCSV);

  // Settings Button
  document.getElementById('openSettingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});

// Load data from chrome.storage.local
async function loadDashboardData() {
  const data = await chrome.storage.local.get(['stats', 'settings', 'pcTrackerStatus']);
  allStats = data.stats || {};
  allSettings = data.settings || {};
  if (data.pcTrackerStatus) {
    pcTrackerStatus = data.pcTrackerStatus;
  }
  updatePCTrackerBadge();
  renderDashboard();
}

function updatePCTrackerBadge() {
  const badge = document.getElementById('pcTrackerNavBadge');
  if (!badge) return;

  if (pcTrackerStatus && pcTrackerStatus.online) {
    const activeApp = pcTrackerStatus.activeApp || 'Активен';
    badge.textContent = `🟢 ПК Трекер: Подключён (${activeApp})`;
    badge.style.borderColor = 'rgba(45, 212, 191, 0.4)';
    badge.style.color = '#2dd4bf';
  } else {
    badge.textContent = '⚪ ПК Трекер: Офлайн (Запустите run_tracker.bat)';
    badge.style.borderColor = 'rgba(148, 163, 184, 0.3)';
    badge.style.color = '#94a3b8';
  }
}

// Format duration helper
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0м';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}ч ${mins}м`;
  }
  if (mins > 0) {
    return `${mins}м ${secs}с`;
  }
  return `${secs}с`;
}

// Get local date string YYYY-MM-DD
function getTodayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get date array for selected period
function getPeriodDateKeys(period) {
  const keys = [];
  const count = period === 'today' ? 1 : (period === '7days' ? 7 : 30);
  const now = new Date();

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    keys.push(getTodayKey(d));
  }
  return keys;
}

// Domain & Desktop App category mapper helper
function getItemCategory(name) {
  const n = name.toLowerCase();
  if (['visual studio code', 'antigravity', 'powershell', 'командная строка', 'терминал', 'github.com', 'gitlab.com', 'stackoverflow.com', 'codepen.io'].some(d => n.includes(d))) return 'Код';
  if (['grok.com', 'lovable.dev', 'lovable.app', 'x.ai', 'deepgram', 'supabase', 'openai.com', 'claude.ai', 'chatgpt.com', 'anymodel.org'].some(d => n.includes(d))) return 'Нейросети / AI';
  if (['capcut', 'premiere', 'after effects', 'видеомонтаж'].some(d => n.includes(d))) return 'Видеомонтаж';
  if (['figma', 'photoshop', 'illustrator', 'figma.com', 'miro.com', 'blender', '3d'].some(d => n.includes(d))) return 'Дизайн';
  if (['telegram', 'discord', 'slack', 'telegram.org', 'vk.com', 'twitter.com', 'x.com', 'reddit.com', 'kurazh.org'].some(d => n.includes(d))) return 'Общение';
  if (['zoom', 'teams', 'созвоны'].some(d => n.includes(d))) return 'Созвоны';
  if (['asap crm', 'asapcrm', 'crm', 'dolphin anty', 'digitalzen', 'notion.so', 'docs.google.com', 'word', 'excel', 'powerpoint', 'блокнот'].some(d => n.includes(d))) return 'Работа / CRM';
  if (['google.com', 'yandex.ru', 'bing.com', 'duckduckgo.com', 'flow.google.com'].some(d => n.includes(d))) return 'Поиск';
  if (['endel.io', 'spotify', 'music'].some(d => n.includes(d))) return 'Фокус / Музыка';
  if (['dustmail', 'mail', 'accounts.google.com'].some(d => n.includes(d))) return 'Почта / Аккаунты';
  if (['youtube.com', 'twitch.tv', 'netflix.com', 'vlc', 'downloader'].some(d => n.includes(d))) return 'Медиа';
  if (['steam', 'counter-strike', 'cs2', 'dota', 'aim lab', 'игры'].some(d => n.includes(d))) return 'Игры';
  if (['проводник', 'диспетчер', 'система'].some(d => n.includes(d))) return 'Система';
  return 'Сервисы / Web';
}

const CATEGORY_COLORS = {
  'Нейросети / AI': '#FF5E0E',
  'Работа / CRM': '#FF8A00',
  'Код': '#818CF8',
  'Дизайн': '#E879F9',
  'Видеомонтаж': '#EC4899',
  'Общение': '#FB7185',
  'Созвоны': '#38BDF8',
  'Фокус / Музыка': '#FBBF24',
  'Поиск': '#2DD4BF',
  'Почта / Аккаунты': '#94A3B8',
  'Медиа': '#F43F5E',
  'Игры': '#EF4444',
  'Система': '#64748B',
  'Сервисы / Web': '#38BDF8',
  'Приложение': '#2DD4BF'
};

const BRAND_SVG_ICONS = {
  telegram: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#24A1DE"><path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.56 8.16l-2.02 9.52c-.15.68-.56.84-1.13.52l-3.1-2.28-1.5 1.44c-.16.16-.3.3-.6.3l.22-3.15 5.73-5.18c.25-.22-.05-.34-.38-.12l-7.08 4.46-3.05-.95c-.66-.2-.67-.66.14-.98l11.95-4.6c.55-.2 1.04.14.82.98z"/></svg>`,
  steam: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#66c0f4"><rect width="24" height="24" rx="5" fill="#171A21"/><path d="M11.979 3C7.02 3 3 7.02 3 11.979c0 1.25.26 2.44.73 3.52l3.47 1.43c.29-.2.65-.32 1.03-.32.03 0 .07 0 .1 0l1.54-2.23v-.03c0-1.34 1.09-2.43 2.43-2.43s2.43 1.09 2.43 2.43-1.09 2.43-2.43 2.43c-.01 0-.02 0-.03 0l-2.2 1.56c0 .03 0 .06 0 .08 0 .99-.8 1.79-1.79 1.79-.88 0-1.62-.64-1.77-1.48L5.05 19.34C6.96 20.97 9.38 21 11.979 21c4.959 0 8.979-4.02 8.979-8.979S16.938 3 11.979 3z" fill="#FFF"/></svg>`,
  windows: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#0078D4"><path d="M0 3.449L9.75 2.1v9.451H0m10.95-9.62L24 0v11.551H10.95M0 12.45h9.75v9.451L0 20.551m10.95-8.101H24V24l-13.05-1.801"/></svg>`,
  terminal: `<svg width="18" height="18" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#4D4D4D"/><path d="M6 8l4 4-4 4M12 16h6" stroke="#FFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  code: `<svg width="18" height="18" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#007ACC"/><path d="M8 7l-4 5 4 5M16 7l4 5-4 5" stroke="#FFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  antigravity: `<svg width="18" height="18" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#4285F4"/><path d="M12 5v14M5 12h14" stroke="#FFF" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  discord: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#5865F2"><rect width="24" height="24" rx="5" fill="#5865F2"/><path d="M16.5 8a13.5 13.5 0 0 0-3.3-1 .06.06 0 0 0-.06.03c-.14.25-.3.58-.4.84a12.3 12.3 0 0 0-3.7 0 8.5 8.5 0 0 0-.42-.84.06.06 0 0 0-.06-.03A13.5 13.5 0 0 0 5.3 8a.05.05 0 0 0-.02.02C3.1 11.2 2.5 14.3 2.8 17.3a.06.06 0 0 0 .02.04 13.6 13.6 0 0 0 4.1 2.1.06.06 0 0 0 .06-.02c.3-.43.6-.88.8-1.35a.06.06 0 0 0-.03-.08 8.9 8.9 0 0 1-1.3-.6.06.06 0 0 1 0-.09c.09-.07.18-.13.26-.2a.06.06 0 0 1 .06 0c2.7 1.2 5.6 1.2 8.3 0a.06.06 0 0 1 .06 0c.09.07.17.13.26.2a.06.06 0 0 1 0 .09c-.4.23-.8.43-1.3.6a.06.06 0 0 0-.03.08c.27.47.55.92.83 1.35a.06.06 0 0 0 .06.02 13.5 13.5 0 0 0 4.1-2.1.06.06 0 0 0 .02-.04c.4-3.5-.5-6.6-2.5-9.3a.05.05 0 0 0-.02-.02z" fill="#FFF"/></svg>`,
  figma: `<svg width="18" height="18" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#1E1E1E"/><circle cx="9" cy="7" r="3" fill="#F24E1E"/><circle cx="15" cy="7" r="3" fill="#FF7262"/><circle cx="9" cy="12" r="3" fill="#A259FF"/><circle cx="15" cy="12" r="3" fill="#1ABCFE"/><circle cx="9" cy="17" r="3" fill="#0ACF83"/></svg>`,
  capcut: `<svg width="18" height="18" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#11131C"/><polygon points="9,6 18,12 9,18" fill="#2DD4BF"/></svg>`
};

// Item Icon Helper (Web Favicon or Inline SVG / Clean Initials Badge)
function getItemIconHtml(name) {
  const isWeb = name.includes('.');
  if (isWeb) {
    const hue = [...name].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 360, 7);
    return `<span class="domain-fav domain-fav-letter" style="background:hsl(${hue} 55% 42%)">${name.charAt(0).toUpperCase().replace(/[<>&"']/g, '')}</span>`;
  }

  const lower = name.toLowerCase();

  if (lower.includes('telegram')) return BRAND_SVG_ICONS.telegram;
  if (lower.includes('steam')) return BRAND_SVG_ICONS.steam;
  if (lower.includes('terminal') || lower.includes('windowsterminal') || lower.includes('powershell') || lower.includes('cmd')) return BRAND_SVG_ICONS.terminal;
  if (lower.includes('проводник') || lower.includes('explorer') || lower.includes('snipping') || lower.includes('диспетчер')) return BRAND_SVG_ICONS.windows;
  if (lower.includes('antigravity')) return BRAND_SVG_ICONS.antigravity;
  if (lower.includes('code') || lower.includes('visual studio')) return BRAND_SVG_ICONS.code;
  if (lower.includes('discord')) return BRAND_SVG_ICONS.discord;
  if (lower.includes('figma')) return BRAND_SVG_ICONS.figma;
  if (lower.includes('capcut')) return BRAND_SVG_ICONS.capcut;

  const initials = name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '').slice(0, 2).toUpperCase() || 'APP';
  return `<span class="app-initials-badge">${initials}</span>`;
}

// Main Dashboard Render
function renderDashboard() {
  const dateKeys = getPeriodDateKeys(activePeriod);

  // Aggregate stats across selected period
  let totalSec = 0;
  let totalBreaks = 0;
  const aggregatedItems = {};
  const aggregatedHourly = {};

  dateKeys.forEach(key => {
    const day = allStats[key] || { domains: {}, desktopApps: {}, hourly: {}, totalSeconds: 0, breaksCompleted: 0 };
    totalBreaks += day.breaksCompleted || 0;

    // Collect Web Domains if enabled by source filter
    if (activeSource === 'all' || activeSource === 'web') {
      Object.entries(day.domains || {}).forEach(([dom, sec]) => {
        aggregatedItems[dom] = (aggregatedItems[dom] || 0) + sec;
        totalSec += sec;
      });
    }

    // Collect PC Desktop Apps if enabled by source filter
    if (activeSource === 'all' || activeSource === 'pc') {
      Object.entries(day.desktopApps || {}).forEach(([app, sec]) => {
        aggregatedItems[app] = (aggregatedItems[app] || 0) + sec;
        if (activeSource === 'pc') {
          totalSec += sec;
        }
      });
    }

    Object.entries(day.hourly || {}).forEach(([h, sec]) => {
      aggregatedHourly[h] = (aggregatedHourly[h] || 0) + sec;
    });
  });

  // Fallback: If hourly has 0 recorded but totalSec > 0, distribute to current/past hours of today
  const hourlySum = Object.values(aggregatedHourly).reduce((a, b) => a + b, 0);
  if (hourlySum === 0 && totalSec > 0) {
    const curH = new Date().getHours();
    const h1 = Math.max(0, curH - 1);
    const h2 = curH;
    aggregatedHourly[h1] = Math.round(totalSec * 0.45);
    aggregatedHourly[h2] = Math.round(totalSec * 0.55);
  }

  // 1. Metric Card 1: Total Screen Time (+ real comparison with the previous period of the same length)
  document.getElementById('statTotalTime').textContent = formatDuration(totalSec);
  {
    const sub = document.getElementById('statTimeSub');
    const parse = (k) => { const [y, m, dd] = k.split('-').map(Number); return new Date(y, m - 1, dd); };
    const first = parse(dateKeys[0]);
    let prevTotal = 0;
    for (let i = 1; i <= dateKeys.length; i++) {
      const pd = new Date(first); pd.setDate(pd.getDate() - i);
      const day = allStats[getTodayKey(pd)] || {};
      if (activeSource === 'all' || activeSource === 'web') prevTotal += Object.values(day.domains || {}).reduce((a, b) => a + b, 0);
      if (activeSource === 'pc') prevTotal += Object.values(day.desktopApps || {}).reduce((a, b) => a + b, 0);
    }
    if (sub) {
      if (prevTotal <= 0) { sub.textContent = 'Нет данных за прошлый период'; sub.className = 'metric-sub neutral'; }
      else {
        const pct = Math.round((totalSec - prevTotal) / prevTotal * 100);
        sub.textContent = `${pct > 0 ? '↑ +' : pct < 0 ? '↓ ' : '⎯ '}${pct}% по сравнению с прошлым периодом`;
        sub.className = 'metric-sub ' + (pct > 0 ? 'negative' : pct < 0 ? 'positive' : 'neutral');
      }
    }
  }

  // 2. Metric Card 2: Eye Health Score
  const intervalMins = allSettings.eyeRestIntervalMinutes || 20;
  const expectedBreaks = Math.floor(totalSec / (intervalMins * 60));
  let healthScore = 100;
  if (expectedBreaks > 0) {
    healthScore = Math.min(100, Math.round((totalBreaks / expectedBreaks) * 100));
  }
  document.getElementById('statHealthScore').textContent = `${healthScore}%`;
  document.getElementById('statHealthSub').textContent = `${totalBreaks} перерывов сделано`;

  // 3. Metric Card 3: Top Category
  const categories = {};
  Object.entries(aggregatedItems).forEach(([item, sec]) => {
    const cat = getItemCategory(item);
    categories[cat] = (categories[cat] || 0) + sec;
  });

  const sortedCats = Object.entries(categories).sort((a, b) => b[1] - a[1]);
  if (sortedCats.length > 0) {
    const [topCat, topCatSec] = sortedCats[0];
    const catPct = Math.round((topCatSec / Math.max(1, totalSec)) * 100);
    document.getElementById('statTopCategory').textContent = topCat;
    document.getElementById('statCategorySub').textContent = `${catPct}% от общего времени`;
  } else {
    document.getElementById('statTopCategory').textContent = '--';
    document.getElementById('statCategorySub').textContent = '0% от общего времени';
  }

  // 4. Metric Card 4: Top Item (Domain or App)
  const sortedItems = Object.entries(aggregatedItems).sort((a, b) => b[1] - a[1]);
  if (sortedItems.length > 0) {
    const [topItem, topItemSec] = sortedItems[0];
    document.getElementById('statTopDomain').textContent = topItem;
    document.getElementById('statTopDomainSub').textContent = formatDuration(topItemSec);
  } else {
    document.getElementById('statTopDomain').textContent = '--';
    document.getElementById('statTopDomainSub').textContent = '0м 0с';
  }

  // Render Sub-components
  renderDomainsTable(aggregatedItems, totalSec);
  renderCategoryPie(categories, totalSec);
  renderHourlyFullChart(aggregatedHourly);
  render30DayMatrix();
}

// Render Domains & PC Apps Table
function renderDomainsTable(itemsObj = {}, totalSec = 0) {
  const tbody = document.getElementById('domainsTableBody');
  tbody.innerHTML = '';

  let entries = Object.entries(itemsObj)
    .filter(([, sec]) => sec > 0)
    .sort((a, b) => b[1] - a[1]);

  if (domainSearchQuery) {
    entries = entries.filter(([item]) => item.toLowerCase().includes(domainSearchQuery));
  }

  if (entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">Ничего не найдено</td></tr>';
    return;
  }

  const maxSec = entries[0][1];

  entries.forEach(([item, sec]) => {
    const pct = Math.round((sec / Math.max(1, totalSec)) * 100);
    const barPct = Math.max(8, Math.round((sec / maxSec) * 100));
    const iconHtml = getItemIconHtml(item);
    const cat = getItemCategory(item);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="domain-cell">
          ${iconHtml}
          <span class="domain-name" title="${item}">${item}</span>
        </div>
      </td>
      <td><span class="cat-badge">${cat}</span></td>
      <td><span class="time-text">${formatDuration(sec)}</span></td>
      <td>
        <div class="share-cell">
          <div class="table-bar-bg">
            <div class="table-bar-fill" style="width: ${barPct}%;"></div>
          </div>
          <span class="pct-text">${pct}%</span>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Render SVG Category Pie/Doughnut Chart & Legend
function renderCategoryPie(categories, totalSec) {
  const svg = document.getElementById('categoryPieSvg');
  const legend = document.getElementById('categoryLegend');
  svg.innerHTML = '';
  legend.innerHTML = '';

  const entries = Object.entries(categories).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0 || totalSec <= 0) {
    legend.innerHTML = '<div class="empty-state">Нет данных</div>';
    return;
  }

  const radius = 65;
  const strokeWidth = 20;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;

  entries.forEach(([cat, sec]) => {
    const percent = sec / totalSec;
    const color = CATEGORY_COLORS[cat] || '#38BDF8';
    const strokeDasharray = `${percent * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedPercent * circumference;

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '100');
    circle.setAttribute('cy', '100');
    circle.setAttribute('r', radius);
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', color);
    circle.setAttribute('stroke-width', strokeWidth);
    circle.setAttribute('stroke-dasharray', strokeDasharray);
    circle.setAttribute('stroke-dashoffset', strokeDashoffset);

    svg.appendChild(circle);
    accumulatedPercent += percent;

    // Legend item
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <div class="legend-left">
        <span class="legend-dot" style="background-color: ${color}; box-shadow: 0 0 6px ${color};"></span>
        <span>${cat}</span>
      </div>
      <strong>${Math.round(percent * 100)}% (${formatDuration(sec)})</strong>
    `;
    legend.appendChild(item);
  });
}

// Render Full-Width Hourly Activity SVG Bar Chart
function renderHourlyFullChart(hourlyData = {}) {
  const svg = document.getElementById('hourlyFullSvg');
  const badge = document.getElementById('peakHourBadge');
  svg.innerHTML = '';

  let maxSec = 0;
  let peakHour = -1;

  for (let h = 0; h < 24; h++) {
    const val = hourlyData[h] || 0;
    if (val > maxSec) {
      maxSec = val;
      peakHour = h;
    }
  }

  if (peakHour >= 0 && maxSec > 0) {
    badge.textContent = `Пик активности: ${String(peakHour).padStart(2, '0')}:00 (${formatDuration(maxSec)})`;
    badge.className = 'badge-mint';
  } else {
    badge.textContent = 'Нет данных активности';
    badge.className = 'badge-gray';
  }

  const chartBottom = 130;
  const maxBarHeight = 95;
  const barWidth = 18;
  const gap = 10;
  const startX = 20;

  // Defs Gradient
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <linearGradient id="fullHourlyGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FF6B00" />
      <stop offset="100%" stop-color="#FF3800" />
    </linearGradient>
    <linearGradient id="normalHourlyGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2dd4bf" />
      <stop offset="100%" stop-color="#10b981" />
    </linearGradient>
  `;
  svg.appendChild(defs);

  // Grid lines
  [35, 70, 105].forEach(y => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '10');
    line.setAttribute('y1', y);
    line.setAttribute('x2', '690');
    line.setAttribute('y2', y);
    line.setAttribute('stroke', 'rgba(255, 255, 255, 0.04)');
    line.setAttribute('stroke-dasharray', '4 4');
    svg.appendChild(line);
  });

  const nowHour = new Date().getHours();

  for (let h = 0; h < 24; h++) {
    const val = hourlyData[h] || 0;
    const barHeight = maxSec > 0 ? Math.max(4, (val / maxSec) * maxBarHeight) : 4;
    const x = startX + h * (barWidth + gap);
    const y = chartBottom - barHeight;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', barWidth);
    rect.setAttribute('height', barHeight);
    rect.setAttribute('rx', '3');
    rect.setAttribute('class', 'chart-bar');

    if (h === peakHour && maxSec > 0) {
      rect.setAttribute('fill', 'url(#fullHourlyGradient)');
    } else if (val > 0) {
      rect.setAttribute('fill', 'url(#normalHourlyGradient)');
    } else {
      rect.setAttribute('fill', 'rgba(255, 255, 255, 0.06)');
    }

    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${String(h).padStart(2, '0')}:00 — ${formatDuration(val)}${h === nowHour ? ' (Текущий час)' : ''}`;
    rect.appendChild(title);

    svg.appendChild(rect);

    // Hour label under bar
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x + barWidth / 2);
    text.setAttribute('y', chartBottom + 18);
    text.setAttribute('class', 'chart-axis-label');
    if (h === nowHour) {
      text.setAttribute('fill', 'var(--accent-mint)');
      text.setAttribute('font-weight', 'bold');
    }
    text.textContent = String(h).padStart(2, '0');
    svg.appendChild(text);
  }
}

// Render 30-Day Activity Heatmap Grid (7-Column Real Calendar)
function render30DayMatrix() {
  const container = document.getElementById('matrixGrid');
  container.innerHTML = '';

  const now = new Date();
  const todayKey = getTodayKey(now);
  const currentDayOfWeek = (now.getDay() + 6) % 7; // Monday = 0, Sunday = 6

  // Monday of the current week
  const currentMonday = new Date(now);
  currentMonday.setDate(now.getDate() - currentDayOfWeek);
  currentMonday.setHours(0, 0, 0, 0);

  // 4 full weeks: 3 past weeks + current week (28 days total)
  const startMonday = new Date(currentMonday);
  startMonday.setDate(currentMonday.getDate() - 21);

  const days = [];
  const russianMonths = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const weekdayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  for (let i = 0; i < 28; i++) {
    const d = new Date(startMonday);
    d.setDate(startMonday.getDate() + i);
    const key = getTodayKey(d);
    const dayData = allStats[key] || { totalSeconds: 0 };
    const isToday = (key === todayKey);
    const isFuture = (d > now);

    days.push({
      date: d,
      dateKey: key,
      dayNum: d.getDate(),
      monthStr: russianMonths[d.getMonth()],
      weekdayName: weekdayNames[i % 7],
      totalSec: isFuture ? 0 : (dayData.totalSeconds || 0),
      isToday,
      isFuture
    });
  }

  const maxSec = Math.max(3600, ...days.map(d => d.totalSec));

  days.forEach(day => {
    const cell = document.createElement('div');
    let levelClass = 'level-0';

    if (!day.isFuture && day.totalSec > 0) {
      const ratio = day.totalSec / maxSec;
      if (ratio > 0.66) levelClass = 'level-3';
      else if (ratio > 0.33) levelClass = 'level-2';
      else levelClass = 'level-1';
    }

    if (day.isFuture) {
      levelClass = 'future';
    }

    cell.className = `matrix-cell ${levelClass} ${day.isToday ? 'today' : ''}`;
    cell.textContent = day.dayNum;
    cell.title = `${day.dayNum} ${day.monthStr} (${day.weekdayName}${day.isToday ? ' · Сегодня' : ''}): ${day.isFuture ? 'Будущий день' : formatDuration(day.totalSec)}`;
    container.appendChild(cell);
  });
}

// Export All History to CSV
function exportToCSV() {
  const rows = [['Дата', 'Тип', 'Источник/Домен/Приложение', 'Секунды', 'Время']];

  Object.entries(allStats).forEach(([dateStr, dayData]) => {
    Object.entries(dayData.domains || {}).forEach(([domain, sec]) => {
      rows.push([dateStr, 'Сайт', domain, sec, formatDuration(sec)]);
    });
    Object.entries(dayData.desktopApps || {}).forEach(([app, sec]) => {
      rows.push([dateStr, 'Программа ПК', app, sec, formatDuration(sec)]);
    });
  });

  const csvContent = rows.map(e => e.join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `eyetime-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
