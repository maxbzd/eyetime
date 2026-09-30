// EyeTime blocking logic shared by the service worker, content script and options page.
// Pure functions only (no chrome.* calls) so they can be unit-tested with `npm test`.
(function (root) {
  const PRESETS = {
    social: { icon: '💬', name: 'Соцсети', domains: ['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'vk.com', 'vk.ru', 'tiktok.com', 'snapchat.com', 'pinterest.com', 'linkedin.com', 'threads.net', 'ok.ru'] },
    video: { icon: '📺', name: 'Видео и стримы', domains: ['youtube.com', 'youtu.be', 'twitch.tv', 'netflix.com', 'rutube.ru', 'kinopoisk.ru', 'hbomax.com', 'disneyplus.com', 'vimeo.com'] },
    forums: { icon: '🗨️', name: 'Форумы и ленты', domains: ['reddit.com', 'pikabu.ru', '9gag.com', 'quora.com', 'tumblr.com', 'imgur.com', '4chan.org'] },
    news: { icon: '📰', name: 'Новости', domains: ['news.ycombinator.com', 'cnn.com', 'bbc.com', 'nytimes.com', 'theguardian.com', 'lenta.ru', 'rbc.ru', 'meduza.io', 'buzzfeed.com'] },
    games: { icon: '🎮', name: 'Игры', domains: ['store.steampowered.com', 'steamcommunity.com', 'epicgames.com', 'roblox.com', 'twitch.tv', 'chess.com', 'lichess.org', 'itch.io', 'miniclip.com'] },
    shopping: { icon: '🛒', name: 'Шопинг', domains: ['amazon.com', 'ebay.com', 'aliexpress.com', 'wildberries.ru', 'ozon.ru', 'etsy.com', 'temu.com', 'shein.com'] },
    messengers: { icon: '✉️', name: 'Мессенджеры', domains: ['web.telegram.org', 'web.whatsapp.com', 'discord.com', 'messenger.com', 'slack.com'] }
  };

  const DEFAULT_BLOCKING = {
    presets: { social: true, video: true, forums: true },
    customDistractions: [],
    allowedDomains: [],
    schedule: { enabled: false, days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00', strict: false, passMinutes: 5 }
  };

  function getBlocking(settings) {
    const b = (settings && settings.blocking) || {};
    return {
      presets: b.presets || DEFAULT_BLOCKING.presets,
      customDistractions: b.customDistractions || [],
      allowedDomains: b.allowedDomains || [],
      schedule: Object.assign({}, DEFAULT_BLOCKING.schedule, b.schedule || {})
    };
  }

  function matches(domain, list) {
    return !!domain && list.some(d => domain === d || domain.endsWith('.' + d));
  }

  // Domains treated as "distractions": enabled presets + user's custom list, minus the allow-list
  function getDistractionDomains(settings) {
    const b = getBlocking(settings);
    const set = new Set(b.customDistractions);
    Object.keys(PRESETS).forEach(id => { if (b.presets[id]) PRESETS[id].domains.forEach(d => set.add(d)); });
    return [...set].filter(d => !matches(d, b.allowedDomains));
  }

  function isDistraction(domain, settings) {
    const b = getBlocking(settings);
    if (matches(domain, b.allowedDomains)) return false;
    return matches(domain, getDistractionDomains(settings));
  }

  const toMin = hhmm => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };

  // Is "now" inside the configured work hours? Supports overnight ranges (e.g. 22:00-06:00).
  function isScheduleActive(settings, now) {
    const s = getBlocking(settings).schedule;
    if (!s.enabled) return false;
    now = now || new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const start = toMin(s.start), end = toMin(s.end);
    if (start === end) return false;
    if (start < end) return s.days.includes(now.getDay()) && cur >= start && cur < end;
    // overnight: the day the range *started* decides
    if (cur >= start) return s.days.includes(now.getDay());
    if (cur < end) return s.days.includes((now.getDay() + 6) % 7);
    return false;
  }

  const api = { PRESETS, DEFAULT_BLOCKING, getBlocking, getDistractionDomains, isDistraction, isScheduleActive, matches };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.EyeTimeBlocking = api;
})(typeof self !== 'undefined' ? self : this);
