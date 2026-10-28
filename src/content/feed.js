// EyeTime feed control — runs only on YouTube, Instagram, TikTok and VK.
//  1) hides Shorts / recommendations / comments / the home feed when switched on in Settings
//  2) after a limit of short-video scrolling in one visit: turns the page grayscale, pauses video and asks
// No network requests, no page content is read or stored. All UI is built with DOM APIs (YouTube enforces Trusted Types).
(() => {
  const host = location.hostname.replace(/^www\./, '');
  const is = (d) => host === d || host.endsWith('.' + d);
  const site = is('youtube.com') ? 'yt' : is('instagram.com') ? 'ig' : is('tiktok.com') ? 'tt' : (is('vk.com') || is('vkvideo.ru')) ? 'vk' : null;
  if (!site) return;

  const msg = (k) => chrome.i18n.getMessage(k);
  const DEFAULT = { shortLimit: true, shortMinutes: 3, hideShorts: false, hideRecs: false, hideComments: false, hideHome: false };
  let feed = { ...DEFAULT };
  let lockEl = null, pauseId = null, extraSec = 0;

  /* ---------- hiding ---------- */
  function css() {
    if (site !== 'yt') return '';
    const r = [];
    if (feed.hideShorts) r.push('ytd-reel-shelf-renderer', 'ytd-rich-shelf-renderer[is-shorts]', 'ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts])', 'ytd-guide-entry-renderer:has(a[title="Shorts"])', 'ytd-mini-guide-entry-renderer[aria-label="Shorts"]', 'ytd-video-renderer:has(a[href^="/shorts/"])', 'ytd-grid-video-renderer:has(a[href^="/shorts/"])', 'yt-chip-cloud-chip-renderer:has(a[href="/shorts"])');
    if (feed.hideRecs) r.push('#related', 'ytd-watch-next-secondary-results-renderer', '.ytp-endscreen-content', '.ytp-ce-element', '.ytp-suggestion-set');
    if (feed.hideComments) r.push('ytd-comments', '#comments');
    if (feed.hideHome) r.push('ytd-browse[page-subtype="home"] ytd-rich-grid-renderer');
    return r.length ? r.join(',\n') + ' { display: none !important; }' : '';
  }
  function applyCss() {
    let el = document.getElementById('eyetime-feed-css');
    const text = css();
    if (!text) { el?.remove(); return; }
    if (!el) { el = document.createElement('style'); el.id = 'eyetime-feed-css'; (document.head || document.documentElement).append(el); }
    el.textContent = text;
  }

  /* ---------- short-video guard ---------- */
  const inShort = () => {
    const p = location.pathname;
    if (site === 'yt') return p.startsWith('/shorts');
    if (site === 'ig') return p.startsWith('/reels') || p.startsWith('/reel/');
    if (site === 'tt') return !p.startsWith('/@') || p.includes('/video/');
    return p.startsWith('/clips') || host === 'vkvideo.ru';
  };
  const KEY = 'eyetime-short-sec';
  const getSec = () => Number(sessionStorage.getItem(KEY) || 0);

  function lock() {
    if (lockEl) return;
    document.documentElement.style.setProperty('filter', 'grayscale(1)', 'important');
    const stop = () => document.querySelectorAll('video').forEach((v) => { try { v.pause(); } catch { /* ignore */ } });
    stop(); pauseId = setInterval(stop, 500);

    const host_ = document.createElement('div');
    host_.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:rgba(15,14,13,.62);backdrop-filter:blur(6px);filter:none';
    const root = host_.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = ':host{all:initial}.card{font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#fff;color:#1c1917;border-radius:22px;padding:28px;max-width:380px;box-shadow:0 24px 80px rgba(0,0,0,.4);text-align:center}h2{margin:0 0 8px;font-size:22px;letter-spacing:-.02em}p{margin:0 0 20px;color:#57534e}.row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}button{font:inherit;font-weight:600;border-radius:12px;padding:10px 16px;border:1px solid #d3cec7;background:#fff;color:#1c1917;cursor:pointer}button.p{background:#cf450a;border-color:#cf450a;color:#fff}@media(prefers-color-scheme:dark){.card{background:#181716;color:#f5f3f0}p{color:#bdb7b0}button{background:#211f1d;border-color:#433f3b;color:#f5f3f0}button.p{background:#ff7a3d;border-color:#ff7a3d;color:#1a0e07}}';
    const card = document.createElement('div'); card.className = 'card'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-labelledby', 'et-feed-title');
    const h2 = document.createElement('h2'); h2.id = 'et-feed-title'; h2.textContent = msg('feedTitle');
    const p = document.createElement('p'); p.textContent = msg('feedBody').replace('{n}', String(feed.shortMinutes));
    const row = document.createElement('div'); row.className = 'row';
    const leave = document.createElement('button'); leave.className = 'p'; leave.textContent = msg('feedLeave');
    leave.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'tab:close' }));
    const more = document.createElement('button'); more.textContent = msg('feedMore');
    more.addEventListener('click', () => { extraSec += 300; unlock(); });
    row.append(leave, more); card.append(h2, p, row); root.append(style, card);
    // keyboard focus stays inside the dialog (Tab cycles between its two buttons); Escape never skips the limit
    root.addEventListener('keydown', (e) => {
      const ev = /** @type {KeyboardEvent} */ (e);
      if (ev.key !== 'Tab') return;
      const first = leave, last = more, cur = root.activeElement;
      if (ev.shiftKey && cur === first) { ev.preventDefault(); last.focus(); } else if (!ev.shiftKey && cur === last) { ev.preventDefault(); first.focus(); }
    });
    document.documentElement.append(host_); lockEl = host_;
    leave.focus();
  }
  function unlock() {
    lockEl?.remove(); lockEl = null; clearInterval(pauseId);
    document.documentElement.style.removeProperty('filter');
  }

  setInterval(() => {
    if (!feed.shortLimit || lockEl || document.visibilityState !== 'visible' || !inShort()) return;
    const sec = getSec() + 1;
    sessionStorage.setItem(KEY, String(sec));
    if (sec >= feed.shortMinutes * 60 + extraSec) lock();
  }, 1000);

  /* ---------- settings ---------- */
  function load() {
    chrome.storage.local.get('settings').then(({ settings }) => {
      feed = { ...DEFAULT, ...(settings?.blocking?.feed || {}) };
      applyCss();
      if (!feed.shortLimit) unlock();
    }).catch(() => {});
  }
  chrome.storage.onChanged.addListener((c, area) => { if (area === 'local' && c.settings) load(); });
  load();
})();
