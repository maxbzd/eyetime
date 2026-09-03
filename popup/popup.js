// EyeTime — Popup JavaScript Logic (Focus Score & Bento Grid)

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await chrome.runtime.sendMessage({ action: 'FORCE_TICK' });
  } catch (e) { }

  await renderPopup();

  // Handle Pause Menu Toggle
  const pauseBtn = document.getElementById('pauseBtn');
  const pauseMenu = document.getElementById('pauseMenu');

  pauseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    pauseMenu.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    pauseMenu.classList.add('hidden');
  });

  // Pause Menu Option Selection
  document.querySelectorAll('.pause-option').forEach(option => {
    option.addEventListener('click', async (e) => {
      const value = e.target.getAttribute('data-pause');
      let pauseUntil = 0;

      if (value === '3600') {
        pauseUntil = Date.now() + 3600 * 1000;
      } else if (value === 'eod') {
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        pauseUntil = endOfDay.getTime();
      }

      const data = await chrome.storage.local.get(['settings']);
      const settings = data.settings || {};
      settings.pauseUntil = pauseUntil;
      await chrome.storage.local.set({ settings });

      await renderPopup();
    });
  });

  // Open Dashboard Page
  document.getElementById('openDashboardBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
  });

  // Open Options Page
  document.getElementById('openOptionsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});

// Helper: Format seconds into readable time string
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0м';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) return `${hrs}ч ${mins}м`;
  if (mins > 0) return `${mins}м ${secs}с`;
  return `${secs}с`;
}

// Helper: Get local YYYY-MM-DD
function getTodayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getYesterdayKey() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getTodayKey(yesterday);
}

// Main Render Function
async function renderPopup() {
  const data = await chrome.storage.local.get(['stats', 'settings']);
  const stats = data.stats || {};
  const settings = data.settings || {};

  const todayKey = getTodayKey();
  const yesterdayKey = getYesterdayKey();
  const todayData = stats[todayKey] || { domains: {}, hourly: {}, totalSeconds: 0, breaksCompleted: 0 };
  const yesterdayData = stats[yesterdayKey] || { totalSeconds: 0 };

  // 1. Update Pause Control Status
  updatePauseStatus(settings.pauseUntil);

  // 2. Hero Card: Today Time & Eye Breaks
  document.getElementById('todayTimeMain').textContent = formatDuration(todayData.totalSeconds);
  document.getElementById('breaksCount').textContent = todayData.breaksCompleted || 0;

  // 3. Comparison with Yesterday
  renderComparison(todayData.totalSeconds, yesterdayData.totalSeconds);

  // 4. Eye Health Score Ring
  renderEyeHealthScore(todayData.totalSeconds, todayData.breaksCompleted || 0, settings.eyeRestIntervalMinutes || 20);

  // 5. Focus Score Calculation & Rendering
  renderFocusScore(todayData.domains, settings.domainProductivity);

  // 6. Top 5 Sites Today
  renderTopDomains(todayData.domains);

  // 7. Hourly Activity SVG Chart
  renderHourlyChart(todayData.hourly);

  // 8. 7-Day History SVG Chart
  renderWeeklyChart(stats);
}

// Update Pause Status Indicator
function updatePauseStatus(pauseUntil) {
  const pauseBtn = document.getElementById('pauseBtn');
  const pauseBtnText = document.getElementById('pauseBtnText');
  const now = Date.now();

  if (pauseUntil && pauseUntil > now) {
    pauseBtn.classList.add('paused');
    const remainingMins = Math.ceil((pauseUntil - now) / (60 * 1000));
    if (remainingMins > 60) {
      pauseBtnText.textContent = 'Пауза до завтра';
    } else {
      pauseBtnText.textContent = `Пауза (${remainingMins}м)`;
    }
  } else {
    pauseBtn.classList.remove('paused');
    pauseBtnText.textContent = 'Активен';
  }
}

// Calculate and render Circular Eye Health Gauge
function renderEyeHealthScore(totalSeconds, breaksCompleted, intervalMins) {
  const intervalSec = intervalMins * 60;
  const expectedBreaks = Math.floor(totalSeconds / intervalSec);
  let score = 100;

  if (expectedBreaks > 0) {
    score = Math.min(100, Math.round((breaksCompleted / expectedBreaks) * 100));
  }

  document.getElementById('healthScoreValue').textContent = `${score}%`;
  const ringFill = document.getElementById('healthRingFill');

  const svg = ringFill.ownerSVGElement;
  if (!svg.querySelector('#ringGradient')) {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#2dd4bf" />
        <stop offset="100%" stop-color="#10b981" />
      </linearGradient>
    `;
    svg.insertBefore(defs, svg.firstChild);
  }

  const circumference = 175.9;
  const offset = circumference - (circumference * score / 100);
  ringFill.style.strokeDashoffset = offset;
}

// Render Focus Score % & Progress Segments
function renderFocusScore(domainsObj, customProdMap) {
  let prodSec = 0;
  let neutralSec = 0;
  let distSec = 0;

  Object.entries(domainsObj || {}).forEach(([domain, sec]) => {
    let type = customProdMap?.[domain];
    if (!type) {
      if (['github.com', 'gitlab.com', 'stackoverflow.com', 'figma.com', 'notion.so', 'docs.google.com'].some(d => domain.includes(d))) type = 'productive';
      else if (['youtube.com', 'vk.com', 'reddit.com', 'twitch.tv', 'tiktok.com', 'instagram.com', 'twitter.com', 'x.com'].some(d => domain.includes(d))) type = 'distraction';
      else type = 'neutral';
    }

    if (type === 'productive') prodSec += sec;
    else if (type === 'distraction') distSec += sec;
    else neutralSec += sec;
  });

  const totalTracked = prodSec + neutralSec + distSec;
  let score = 100;
  if (totalTracked > 0) {
    score = Math.round(((prodSec + 0.5 * neutralSec) / totalTracked) * 100);
  }

  document.getElementById('focusScoreBadge').textContent = `${score}% Фокус`;

  const prodPct = totalTracked > 0 ? (prodSec / totalTracked) * 100 : 100;
  const neutPct = totalTracked > 0 ? (neutralSec / totalTracked) * 100 : 0;
  const distPct = totalTracked > 0 ? (distSec / totalTracked) * 100 : 0;

  document.getElementById('barProductive').style.width = `${prodPct}%`;
  document.getElementById('barNeutral').style.width = `${neutPct}%`;
  document.getElementById('barDistraction').style.width = `${distPct}%`;

  document.getElementById('txtProductive').textContent = `🟢 ${formatDuration(prodSec)} Продуктивно`;
  document.getElementById('txtDistraction').textContent = `🔴 ${formatDuration(distSec)} Отвлечение`;
}

// Render Comparison vs Yesterday Badge
function renderComparison(todaySec, yesterdaySec) {
  const badge = document.getElementById('comparisonBadge');
  const icon = document.getElementById('cmpIcon');
  const text = document.getElementById('cmpText');

  if (!yesterdaySec || yesterdaySec <= 0) {
    badge.className = 'comparison-badge neutral';
    icon.textContent = '⎯';
    text.textContent = 'Нет данных за вчера';
    return;
  }

  const diff = todaySec - yesterdaySec;
  const pct = Math.round((diff / yesterdaySec) * 100);

  if (pct > 0) {
    badge.className = 'comparison-badge up';
    icon.textContent = '↑';
    text.textContent = `+${pct}% vs вчера`;
  } else if (pct < 0) {
    badge.className = 'comparison-badge down';
    icon.textContent = '↓';
    text.textContent = `${pct}% vs вчера`;
  } else {
    badge.className = 'comparison-badge neutral';
    icon.textContent = '⎯';
    text.textContent = 'Столько же, сколько вчера';
  }
}

// Domain category mapper helper
function getDomainCategory(domain) {
  if (['youtube.com', 'twitch.tv', 'netflix.com', 'vimeo.com', 'kinopoisk.ru'].some(d => domain.includes(d))) return 'Медиа';
  if (['github.com', 'gitlab.com', 'stackoverflow.com', 'codepen.io'].some(d => domain.includes(d))) return 'Код';
  if (['google.com', 'yandex.ru', 'bing.com', 'duckduckgo.com'].some(d => domain.includes(d))) return 'Поиск';
  if (['telegram.org', 'vk.com', 'twitter.com', 'x.com', 'reddit.com'].some(d => domain.includes(d))) return 'Соцсети';
  if (['figma.com', 'notion.so', 'docs.google.com', 'miro.com'].some(d => domain.includes(d))) return 'Работа';
  return 'Веб';
}

// Render Top 5 Domains
function renderTopDomains(domainsObj) {
  const container = document.getElementById('topDomainsList');
  const tagCount = document.getElementById('domainCountTag');
  container.innerHTML = '';

  const entries = Object.entries(domainsObj || {})
    .filter(([_, sec]) => sec > 0)
    .sort((a, b) => b[1] - a[1]);

  tagCount.textContent = `${entries.length} сайтов`;

  if (entries.length === 0) {
    container.innerHTML = '<div class="empty-state">Нет активности за сегодня</div>';
    return;
  }

  const top5 = entries.slice(0, 5);
  const maxSec = top5[0][1];

  top5.forEach(([domain, sec]) => {
    const pct = Math.max(8, Math.round((sec / maxSec) * 100));
    const formattedTime = formatDuration(sec);
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
    const firstLetter = domain.charAt(0).toUpperCase();
    const category = getDomainCategory(domain);

    const item = document.createElement('div');
    item.className = 'domain-item';
    item.innerHTML = `
      <div class="domain-info">
        <div class="domain-left">
          <img class="domain-icon" src="${faviconUrl}" alt="${domain}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
          <div class="domain-icon-fallback" style="display:none;">${firstLetter}</div>
          <span class="domain-name" title="${domain}">${domain}</span>
          <span class="domain-cat-tag">${category}</span>
        </div>
        <span class="domain-time">${formattedTime}</span>
      </div>
      <div class="bar-bg">
        <div class="bar-fill" style="width: ${pct}%;"></div>
      </div>
    `;
    container.appendChild(item);
  });
}

// Render Hourly SVG Bar Chart
function renderHourlyChart(hourlyData) {
  const svg = document.getElementById('hourlyChartSvg');
  const peakHourText = document.getElementById('peakHourText');
  svg.innerHTML = '';

  const hourly = hourlyData || {};
  let maxSec = 0;
  let peakHour = -1;

  for (let h = 0; h < 24; h++) {
    const val = hourly[h] || 0;
    if (val > maxSec) {
      maxSec = val;
      peakHour = h;
    }
  }

  if (peakHour >= 0 && maxSec > 0) {
    peakHourText.textContent = `Пик: ${String(peakHour).padStart(2, '0')}:00 (${formatDuration(maxSec)})`;
  } else {
    peakHourText.textContent = 'Нет данных';
  }

  const chartBottom = 88;
  const maxBarHeight = 65;
  const barWidth = 8.5;
  const gap = 5;
  const startX = 14;

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <linearGradient id="hourlyGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2dd4bf" />
      <stop offset="100%" stop-color="#10b981" />
    </linearGradient>
  `;
  svg.appendChild(defs);

  [25, 55, 85].forEach(y => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '10');
    line.setAttribute('y1', y);
    line.setAttribute('x2', '340');
    line.setAttribute('y2', y);
    line.setAttribute('stroke', 'rgba(255, 255, 255, 0.04)');
    line.setAttribute('stroke-dasharray', '3 3');
    svg.appendChild(line);
  });

  for (let h = 0; h < 24; h++) {
    const val = hourly[h] || 0;
    const barHeight = maxSec > 0 ? Math.max(3, (val / maxSec) * maxBarHeight) : 3;
    const x = startX + h * (barWidth + gap);
    const y = chartBottom - barHeight;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', barWidth);
    rect.setAttribute('height', barHeight);
    rect.setAttribute('rx', '2.5');
    rect.setAttribute('class', 'chart-bar');

    if (h === peakHour && maxSec > 0) {
      rect.setAttribute('fill', 'url(#hourlyGradient)');
    }

    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${String(h).padStart(2, '0')}:00 — ${formatDuration(val)}`;
    rect.appendChild(title);

    svg.appendChild(rect);

    if ([0, 6, 12, 18, 23].includes(h)) {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x + barWidth / 2);
      text.setAttribute('y', chartBottom + 16);
      text.setAttribute('class', 'chart-axis-label');
      text.textContent = String(h).padStart(2, '0');
      svg.appendChild(text);
    }
  }
}

// Render 7-Day History SVG Bar Chart
function renderWeeklyChart(allStats) {
  const svg = document.getElementById('weeklyChartSvg');
  const avgText = document.getElementById('weeklyAvgText');
  svg.innerHTML = '';

  const days = [];
  const daysShort = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    const key = getTodayKey(d);
    const totalSec = allStats[key]?.totalSeconds || 0;
    days.push({
      dateKey: key,
      dayName: daysShort[d.getDay()],
      totalSec: totalSec,
      isToday: (i === 0)
    });
  }

  const maxSec = Math.max(1, ...days.map(d => d.totalSec));
  const total7Days = days.reduce((sum, d) => sum + d.totalSec, 0);
  const avgSec = Math.round(total7Days / 7);

  avgText.textContent = `Среднее: ${formatDuration(avgSec)} / день`;

  const chartBottom = 88;
  const maxBarHeight = 65;
  const barWidth = 30;
  const gap = 16;
  const startX = 18;

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2dd4bf" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
  `;
  svg.appendChild(defs);

  [25, 55, 85].forEach(y => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '10');
    line.setAttribute('y1', y);
    line.setAttribute('x2', '340');
    line.setAttribute('y2', y);
    line.setAttribute('stroke', 'rgba(255, 255, 255, 0.04)');
    line.setAttribute('stroke-dasharray', '3 3');
    svg.appendChild(line);
  });

  days.forEach((day, index) => {
    const barHeight = maxSec > 0 ? Math.max(4, (day.totalSec / maxSec) * maxBarHeight) : 4;
    const x = startX + index * (barWidth + gap);
    const y = chartBottom - barHeight;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', barWidth);
    rect.setAttribute('height', barHeight);
    rect.setAttribute('rx', '4');
    rect.setAttribute('class', day.isToday ? 'chart-bar active-day' : 'chart-bar');

    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${day.dayName} (${day.dateKey}): ${formatDuration(day.totalSec)}`;
    rect.appendChild(title);
    svg.appendChild(rect);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x + barWidth / 2);
    text.setAttribute('y', chartBottom + 16);
    text.setAttribute('class', 'chart-axis-label');
    if (day.isToday) {
      text.setAttribute('fill', '#2dd4bf');
      text.setAttribute('font-weight', 'bold');
    }
    text.textContent = day.dayName;
    svg.appendChild(text);
  });
}
