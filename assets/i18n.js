// EyeTime i18n engine. The UI source language is Russian; other languages are applied at runtime
// from dictionaries (assets/i18n_<lang>.js) by translating text nodes and common attributes.
// Works in extension pages, content scripts (via EyeTimeI18n.watch) and the service worker (EyeTimeI18n.t).
(function () {
  const G = typeof self !== 'undefined' ? self : window;
  const DICTS = { en: G.EYETIME_DICT_EN || {} };
  const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE']);
  const hasCyr = s => /[А-Яа-яЁё]/.test(s);
  const esc = s => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
  const norm = s => s.replace(/\s+/g, ' ').trim();

  let lang = 'ru';
  let exact = new Map();
  let patterns = [];

  function build() {
    exact = new Map(); patterns = []; wordRe = null;
    const dict = DICTS[lang];
    if (!dict) return;
    for (const [ru, en] of Object.entries(dict)) {
      if (ru.includes('{}')) {
        const src = ru.split('{}').map(esc).join('(.+?)');
        patterns.push([new RegExp('^' + src + '$'), en]);
        // also register the text without leading/trailing placeholder (value often lives in its own tag)
        const strip = x => x.replace(/^\s*\{\}\s*|\s*\{\}\s*$/g, '').trim();
        const k = strip(ru), v = strip(en);
        if (k && k !== ru && !k.includes('{}') && !exact.has(k)) exact.set(k, v);
      } else exact.set(ru, en);
    }
    patterns.sort((a, b) => b[0].source.length - a[0].source.length);
  }

  // Fallback for composed strings (dates, tooltips): replace known UI words inside short strings with digits / attributes
  let wordRe = null;
  function words(str) {
    if (!wordRe) {
      const keys = [...exact.keys()].filter(k => /^[А-Яа-яЁё ]{2,30}$/.test(k)).sort((a, b) => b.length - a.length).map(esc);
      wordRe = keys.length ? new RegExp('(?<![А-Яа-яЁё])(' + keys.join('|') + ')(?![А-Яа-яЁё])', 'g') : /$^/;
    }
    return str.replace(wordRe, w => exact.get(w) || w);
  }

  function t(str, loose) {
    if (lang === 'ru' || typeof str !== 'string' || !hasCyr(str)) return str;
    const n = norm(str);
    let out = exact.get(n);
    if (out === undefined) {
      for (const [re, en] of patterns) {
        const m = n.match(re);
        if (m) { let i = 1; out = en.replace(/\{\}/g, () => t(m[i++] ?? '')); break; }
      }
    }
    if (out === undefined) {
      if (loose || (str.length <= 60 && /\d/.test(str))) { const w = words(str); return w; }
      return str;
    }
    const lead = str.match(/^\s*/)[0], trail = str.match(/\s*$/)[0];
    return lead + out + trail;
  }

  function translateEl(el) {
    if (el.nodeType !== 1) return;
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v && hasCyr(v)) { const r = t(v, true); if (r !== v) el.setAttribute(a, r); }
    }
    if (el.tagName === 'INPUT' && /^(button|submit)$/.test(el.type) && hasCyr(el.value)) el.value = t(el.value);
  }

  function translateTree(root) {
    if (lang === 'ru' || !root) return;
    if (root.nodeType === 3) { const r = t(root.nodeValue); if (r !== root.nodeValue) root.nodeValue = r; return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1 && SKIP.has(root.tagName)) return;
    if (root.nodeType === 1) translateEl(root);
    const doc = root.ownerDocument || root;
    const w = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.nodeType === 1 && SKIP.has(n.tagName)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    let n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) { if (hasCyr(n.nodeValue)) { const r = t(n.nodeValue); if (r !== n.nodeValue) n.nodeValue = r; } }
      else translateEl(n);
    }
  }

  function observe(root) {
    const mo = new MutationObserver(muts => {
      for (const m of muts) {
        if (m.type === 'childList') m.addedNodes.forEach(translateTree);
        else if (m.type === 'characterData') translateTree(m.target);
        else if (m.type === 'attributes') translateEl(m.target);
      }
    });
    mo.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  function resolve(pref) {
    if (pref && pref !== 'auto' && DICTS[pref]) return pref;
    if (pref === 'ru') return 'ru';
    let ui = '';
    try { ui = (chrome.i18n.getUILanguage() || navigator.language || '').toLowerCase(); } catch (e) { ui = (navigator.language || '').toLowerCase(); }
    if (ui.startsWith('ru') || ui.startsWith('uk') || ui.startsWith('be') || ui.startsWith('kk')) return 'ru';
    return 'en';
  }

  function setLang(l) { lang = l; build(); }

  const api = { t, translateTree, setLang, get lang() { return lang; }, languages: { auto: 'Auto', en: 'English', ru: 'Русский' },
    watch(el) { translateTree(el); observe(el); },
    ready: Promise.resolve() };

  const isPage = typeof document !== 'undefined' && document.documentElement && location.protocol === 'chrome-extension:';

  // Extension pages: resolve synchronously from a cached preference to avoid a flash, then confirm from storage
  if (isPage) {
    let cached = null;
    try { cached = localStorage.getItem('eyetime_lang'); } catch (e) { }
    setLang(resolve(cached));
    const apply = () => { translateTree(document.documentElement); document.title = t(document.title); observe(document.documentElement); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
    for (const fn of ['alert', 'confirm', 'prompt']) { const o = G[fn].bind(G); G[fn] = (m, ...r) => o(t(String(m)), ...r); }
    api.ready = new Promise(res => {
      try {
        chrome.storage.local.get(['settings'], d => {
          const pref = (d && d.settings && d.settings.language) || 'auto';
          try { localStorage.setItem('eyetime_lang', pref); } catch (e) { }
          const next = resolve(pref);
          if (next !== lang) { const was = lang; setLang(next); if (next === 'ru' && was !== 'ru') location.reload(); else { translateTree(document.documentElement); document.title = t(document.title); } }
          res();
        });
      } catch (e) { res(); }
    });
  } else {
    // Content script / service worker: read the preference from storage
    api.ready = new Promise(res => {
      try {
        chrome.storage.local.get(['settings'], d => { setLang(resolve(d && d.settings && d.settings.language)); res(); });
        chrome.storage.onChanged.addListener((c, area) => { if (area === 'local' && c.settings) setLang(resolve(c.settings.newValue && c.settings.newValue.language)); });
      } catch (e) { res(); }
    });
    setLang(resolve('auto'));
  }
  G.EyeTimeI18n = api;
})();
