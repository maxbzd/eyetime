// EyeTime dock — page script (registered only after the person turned the dock on and allowed access to websites; see src/background/dock.js).
// It draws one small black "notch" that grows out of the window edge with soft curves, holding three little progress rings (focus, tasks, learning);
// a click opens an extension iframe (src/dock/dock.html) with the panel. From the page it reads nothing but its address and title, and only hands
// them to the panel. Numbers on the rings come from EyeTime's own storage. A classic script (no imports), kept small: it runs on every page.
(() => {
  if (window.top !== window || !/^https?:$/.test(location.protocol) || document.documentElement.dataset.eyetimeDock) return;
  document.documentElement.dataset.eyetimeDock = '1';

  const EXT_ORIGIN = chrome.runtime.getURL('').slice(0, -1);
  const msg = (k, fb) => chrome.i18n.getMessage(k) || fb;
  const LABEL = msg('dockTab', 'EyeTime');
  const ITEMS = [
    { k: 'focus', tab: 'now', color: '#ff6a3d', name: msg('dockFocus', 'Focus'), paths: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>' },
    { k: 'tasks', tab: 'now', color: '#32d74b', name: msg('dockTasks', 'Tasks'), paths: '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>' },
    { k: 'learn', tab: 'learn', color: '#0a84ff', name: msg('dockLearn', 'Learn'), paths: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>' },
  ];
  const CIRC = 2 * Math.PI * 15.5;
  let dock = { enabled: true, side: 'right', y: 0.4, hidden: [] };
  let host, wrap, notch, panel, frame, open = false, timer = 0;
  const refs = {};

  const css = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .wrap { position: fixed; inset: 0; pointer-events: none; --w: 12px; --r: 10px; font: 600 10px/1 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif; }
    .wrap.expanded { --w: 54px; --r: 20px; }
    /* the notch: a black capsule fixed to the edge; two concave flares melt it into the window frame */
    .notch { position: fixed; top: var(--cy); transform: translateY(-50%); width: var(--w); background: #000; color: #fff; pointer-events: auto; touch-action: none;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px; padding: 12px 0; min-height: 88px;
      filter: drop-shadow(0 3px 10px rgba(0, 0, 0, .28)); transition: width .34s cubic-bezier(.3, 1.35, .5, 1), min-height .3s cubic-bezier(.3, 1.2, .5, 1); cursor: grab; }
    .right .notch { right: 0; border-radius: 22px 0 0 22px; } .left .notch { left: 0; border-radius: 0 22px 22px 0; }
    .notch::before, .notch::after { content: ''; position: absolute; width: var(--r); height: var(--r); pointer-events: none; transition: width .34s cubic-bezier(.3, 1.35, .5, 1), height .34s cubic-bezier(.3, 1.35, .5, 1); }
    .right .notch::before { right: 0; top: calc(var(--r) * -1); background: radial-gradient(circle at 0 0, transparent calc(var(--r) - .6px), #000 var(--r)); }
    .right .notch::after { right: 0; bottom: calc(var(--r) * -1); background: radial-gradient(circle at 0 100%, transparent calc(var(--r) - .6px), #000 var(--r)); }
    .left .notch::before { left: 0; top: calc(var(--r) * -1); background: radial-gradient(circle at 100% 0, transparent calc(var(--r) - .6px), #000 var(--r)); }
    .left .notch::after { left: 0; bottom: calc(var(--r) * -1); background: radial-gradient(circle at 100% 100%, transparent calc(var(--r) - .6px), #000 var(--r)); }
    .hit { position: absolute; top: -24px; bottom: -24px; width: 34px; } .right .hit { left: -20px; } .left .hit { right: -20px; }
    .wrap.expanded .notch { min-height: 190px; }
    .item { position: relative; width: 40px; padding: 0; border: 0; background: none; color: inherit; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 3px; border-radius: 12px;
      opacity: 0; transform: scale(.6); transition: opacity .22s, transform .34s cubic-bezier(.3, 1.35, .5, 1); pointer-events: none; font: inherit; }
    .wrap:not(.expanded) .item { position: absolute; }
    .wrap.expanded .item { opacity: 1; transform: none; pointer-events: auto; } .wrap.expanded .item:nth-child(2) { transition-delay: .03s; } .wrap.expanded .item:nth-child(3) { transition-delay: .06s; }
    .item:focus-visible { outline: 2px solid #0a84ff; outline-offset: 2px; }
    .item:hover .ring { transform: scale(1.08); }
    .ring { position: relative; width: 34px; height: 34px; transition: transform .2s; }
    .ring svg.r { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
    .ring svg.i { position: absolute; left: 50%; top: 50%; width: 14px; height: 14px; margin: -7px 0 0 -7px; stroke: #fff; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .track { stroke: rgba(255, 255, 255, .2); } .arc { transition: stroke-dashoffset .6s cubic-bezier(.3, 1, .4, 1); }
    .pct { font-size: 10px; letter-spacing: .01em; color: rgba(255, 255, 255, .92); font-variant-numeric: tabular-nums; min-height: 10px; }
    .dots { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px; pointer-events: none; transition: opacity .2s; }
    .dots i { width: 4px; height: 4px; border-radius: 50%; display: block; } .wrap.expanded .dots { opacity: 0; }
    .panel { position: fixed; top: 12px; bottom: 12px; width: 392px; max-width: calc(100vw - 96px); border-radius: 20px; overflow: hidden; z-index: 1; pointer-events: none; opacity: 0; background: #1c1c1e;
      box-shadow: 0 0 0 .5px rgba(0, 0, 0, .3), 0 24px 64px rgba(0, 0, 0, .3), 0 4px 14px rgba(0, 0, 0, .14); transition: transform .3s cubic-bezier(.2, .9, .25, 1.02), opacity .2s; }
    .right .panel { right: 66px; transform: translateX(34px) scale(.98); transform-origin: right center; } .left .panel { left: 66px; transform: translateX(-34px) scale(.98); transform-origin: left center; }
    .wrap.open .panel { opacity: 1; pointer-events: auto; transform: none; }
    iframe { width: 100%; height: 100%; border: 0; display: block; color-scheme: normal; }
    @media (prefers-reduced-motion: reduce) { .notch, .notch::before, .notch::after, .item, .panel, .arc { transition: none; } }
    @media (forced-colors: active) { .notch, .item { forced-color-adjust: none; } }
    @media print { :host { display: none !important; } }
  `;

  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
  const post = (m) => { try { frame && frame.contentWindow && frame.contentWindow.postMessage(m, EXT_ORIGIN); } catch { /* the panel is not ready */ } };
  const pageInfo = () => ({ type: 'eyetime:page', url: location.href, title: document.title || '', host: location.hostname });
  const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const clamp = (n) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));

  /* ---------- the numbers on the rings ---------- */
  async function refresh() {
    if (!host) return;
    try {
      const key = 'd:' + dayKey();
      const s = await chrome.storage.local.get(['settings', 'focus', 'tasks', 'topics', key]);
      const now = Date.now(), f = s.focus, goalMin = ((s.settings || {}).focus || {}).dailyGoal || 120, day = s[key] || {};
      const running = f && f.endsAt > now && f.startedAt <= now;
      const todayFocus = Math.min(1, (day.fs || 0) / 60 / goalMin);
      const focusP = running ? clamp((now - f.startedAt) / (f.endsAt - f.startedAt)) : todayFocus;
      const focusLabel = running ? Math.max(1, Math.round((f.endsAt - now) / 60000)) + 'm' : Math.round(todayFocus * 100) + '%';
      const tasks = s.tasks || [], d0 = new Date(); d0.setHours(0, 0, 0, 0);
      const doneToday = tasks.filter((x) => x.done && x.doneAt >= d0.getTime()).length, open_ = tasks.filter((x) => !x.done).length;
      const tasksP = doneToday + open_ ? doneToday / (doneToday + open_) : 0;
      const links = (s.topics || []).flatMap((x) => x.links || []), doneLinks = links.filter((l) => l.status === 'done').length;
      const learnP = links.length ? doneLinks / links.length : 0;
      const vals = { focus: [focusP, focusLabel, running ? ' ▶' : ''], tasks: [tasksP, Math.round(tasksP * 100) + '%', ''], learn: [learnP, links.length ? Math.round(learnP * 100) + '%' : '+', ''] };
      for (const it of ITEMS) {
        const r = refs[it.k], [p, label] = vals[it.k];
        r.arc.style.strokeDashoffset = String(CIRC * (1 - p)); r.pct.textContent = label;
        r.btn.setAttribute('aria-label', `${it.name}: ${label}`);
      }
    } catch { /* storage unavailable (extension reloaded): the notch stays as it is */ }
  }

  /* ---------- panel ---------- */
  function ensureFrame(tabName) {
    if (frame) return;
    frame = document.createElement('iframe');
    frame.title = 'EyeTime';
    frame.src = chrome.runtime.getURL('src/dock/dock.html') + '#' + dock.side + '/' + (tabName || 'now');
    frame.addEventListener('load', () => post(pageInfo()));
    panel.append(frame);
  }
  function setOpen(v, tabName) {
    open = v;
    wrap.classList.toggle('open', v); wrap.classList.toggle('expanded', v || wrap.matches(':hover'));
    notch.setAttribute('aria-expanded', String(v));
    if (v) { ensureFrame(tabName); post(pageInfo()); if (tabName) post({ type: 'eyetime:tab', tab: tabName }); setTimeout(() => { try { frame.focus(); } catch { /* ignore */ } }, 260); }
    else if (notch.contains(root().activeElement)) { try { refs.focus.btn.focus({ preventScroll: true }); } catch { /* ignore */ } }
  }
  const root = () => host.shadowRoot;

  /* ---------- the notch is expanded while hovered / focused / open ---------- */
  let leaveTimer = 0;
  const expand = () => { clearTimeout(leaveTimer); wrap.classList.add('expanded'); refresh(); };
  const collapse = () => { clearTimeout(leaveTimer); leaveTimer = setTimeout(() => { if (!open && !notch.matches(':hover') && !notch.matches(':focus-within')) wrap.classList.remove('expanded'); }, 450); };

  function place() { // keep the notch (with its flares) inside the window whatever its height
    const h = notch.offsetHeight || 76, m = h / 2 + 30, vh = window.innerHeight;
    wrap.style.setProperty('--cy', Math.min(vh - m, Math.max(m, dock.y * vh)) + 'px');
  }

  function drag(e) {
    if (e.button !== 0 || e.target.closest('.item')) return;
    const startY = e.clientY, startPos = dock.y; let moved = false;
    const move = (ev) => { if (Math.abs(ev.clientY - startY) > 4) moved = true; if (moved) { dock.y = clamp(startPos + (ev.clientY - startY) / window.innerHeight); place(); } };
    const up = () => {
      window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', up, true);
      if (moved) { try { chrome.runtime.sendMessage({ type: 'dock:pos', y: Math.round(dock.y * 1000) / 1000 }); } catch { /* the worker wakes with the next message */ } }
    };
    window.addEventListener('pointermove', move, true); window.addEventListener('pointerup', up, true);
  }

  function build() {
    host = document.createElement('div');
    host.id = 'eyetime-dock';
    host.style.cssText = 'all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;';
    const rootEl = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style'); style.textContent = css;
    wrap = document.createElement('div'); wrap.className = 'wrap ' + (dock.side === 'left' ? 'left' : 'right');
    notch = document.createElement('div'); notch.className = 'notch'; notch.setAttribute('role', 'group'); notch.setAttribute('aria-label', LABEL); notch.title = LABEL; notch.setAttribute('aria-expanded', 'false');
    const hit = document.createElement('div'); hit.className = 'hit'; notch.append(hit);
    const dots = document.createElement('div'); dots.className = 'dots'; for (const it of ITEMS) { const i = document.createElement('i'); i.style.background = it.color; dots.append(i); } notch.append(dots);
    for (const it of ITEMS) {
      const btn = document.createElement('button'); btn.className = 'item'; btn.type = 'button'; btn.setAttribute('aria-label', it.name);
      const ring = document.createElement('span'); ring.className = 'ring';
      const r = svgEl('svg', { class: 'r', viewBox: '0 0 36 36' });
      r.append(svgEl('circle', { class: 'track', cx: 18, cy: 18, 'r': 15.5, fill: 'none', 'stroke-width': 3 }));
      const arc = svgEl('circle', { class: 'arc', cx: 18, cy: 18, 'r': 15.5, fill: 'none', 'stroke-width': 3, 'stroke-linecap': 'round', stroke: it.color, 'stroke-dasharray': String(CIRC), 'stroke-dashoffset': String(CIRC) });
      r.append(arc);
      const ic = svgEl('svg', { class: 'i', viewBox: '0 0 24 24' }); ic.innerHTML = it.paths; // fixed strings above, never page content
      ring.append(r, ic);
      const pct = document.createElement('span'); pct.className = 'pct';
      btn.append(ring, pct); notch.append(btn);
      btn.addEventListener('click', () => setOpen(open && it.tab === currentTab ? false : true, it.tab));
      refs[it.k] = { btn, arc, pct };
    }
    panel = document.createElement('div'); panel.className = 'panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'EyeTime');
    wrap.append(notch, panel); rootEl.append(style, wrap);
    notch.addEventListener('pointerenter', expand); notch.addEventListener('pointerleave', collapse);
    notch.addEventListener('focusin', expand); notch.addEventListener('focusout', collapse);
    notch.addEventListener('pointerdown', drag);
    (document.body || document.documentElement).append(host);
    place(); refresh(); timer = setInterval(refresh, 30000);
    window.addEventListener('resize', place);
  }
  let currentTab = 'now';

  function destroy() { clearInterval(timer); window.removeEventListener('resize', place); if (host) host.remove(); host = frame = panel = notch = wrap = null; open = false; delete document.documentElement.dataset.eyetimeDock; }

  window.addEventListener('message', (e) => {
    if (!frame || e.source !== frame.contentWindow || e.origin !== EXT_ORIGIN || !e.data) return;
    if (e.data.type === 'eyetime:close') setOpen(false);
    else if (e.data.type === 'eyetime:need-page') post(pageInfo());
    else if (e.data.type === 'eyetime:tab-is') currentTab = e.data.tab === 'learn' ? 'learn' : 'now';
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) setOpen(false); }, true);
  chrome.runtime.onMessage.addListener((m) => { if (m && m.type === 'dock:toggle' && host) setOpen(!open); });

  const hiddenHere = (list) => (list || []).some((h) => location.hostname === h || location.hostname.endsWith('.' + h));
  chrome.storage.local.get('settings').then(({ settings }) => {
    if (settings && settings.dock) dock = { ...dock, ...settings.dock };
    if (!dock.enabled || hiddenHere(dock.hidden)) return destroy();
    build();
  }).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.settings) {
      const d = (changes.settings.newValue || {}).dock || {};
      if (!d.enabled || hiddenHere(d.hidden)) { if (host) destroy(); return; }
      const sideChanged = host && (d.side || 'right') !== dock.side;
      dock = { ...dock, ...d };
      if (!host) { document.documentElement.dataset.eyetimeDock = '1'; build(); } else if (sideChanged) { const was = open; destroy(); document.documentElement.dataset.eyetimeDock = '1'; build(); if (was) setOpen(true); } else place();
    }
    if (host && (changes.focus || changes.tasks || changes.topics || changes.settings || Object.keys(changes).some((k) => k.startsWith('d:')))) refresh();
  });
})();
