// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The landing page: language, the opening, the live clock behind the peak, the day that slides by, the small working copies of the product, the pointer.
// No library and no request to another host. Without this script the page is whole and readable (the `js` class on <html> is what hides things for the opening).
(function () {
  'use strict';
  var doc = document, html = doc.documentElement, $ = function (s, r) { return (r || doc).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches, fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };

  /* ── language ──
     The page is written in English. Every other language is one file, lang/<code>.json (key → text), fetched only when it is needed.
     A visitor is offered English and, when the browser speaks another of our languages, that one: nothing else. */
  var NATIVE = { en: 'English', ru: 'Русский', es: 'Español', de: 'Deutsch', fr: 'Français', pt: 'Português', it: 'Italiano', pl: 'Polski', uk: 'Українська', zh: '中文', ja: '日本語', ro: 'Română' };
  var CJK = { zh: 1, ja: 1 }, NB = ' ';
  var EN = {}, dicts = { en: EN }, lang = 'en', eyeLeft = 19, home = 'en';
  var metaD = $('meta[name="description"]'), taskEl = $('#fTask');
  $$('[data-t]').forEach(function (el) { var k = el.getAttribute('data-t'); if (!(k in EN)) EN[k] = el.innerHTML; });
  $$('[data-ta]').forEach(function (el) { EN[el.getAttribute('data-ta')] = el.getAttribute('aria-label'); });
  EN['meta-title'] = doc.title; EN['meta-desc'] = metaD ? metaD.getAttribute('content') : ''; EN['task-value'] = taskEl ? taskEl.value : '';
  function t(key) { var d = dicts[lang]; return d && d[key] != null ? d[key] : EN[key] != null ? EN[key] : ''; }

  /* the language of this computer: the first of its languages that we speak */
  (function () {
    var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
    for (var i = 0; i < list.length; i++) { var p = String(list[i]).toLowerCase().split('-')[0]; if (NATIVE[p]) { home = p; return; } }
  })();
  var choices = home === 'en' ? ['en'] : ['en', home];
  var saved = null; try { saved = localStorage.getItem('lang'); } catch (e) { /* private window */ }
  lang = choices.indexOf(saved) >= 0 ? saved : home;

  /* the text comes from our own files; only line breaks, emphasis and links to this project are taken from it, and as nodes, never as HTML */
  function copyInto(from, to) {
    Array.prototype.forEach.call(from.childNodes, function (n) {
      if (n.nodeType === 3) to.appendChild(doc.createTextNode(n.nodeValue));
      else if (n.nodeType === 1) {
        var tag = n.nodeName.toLowerCase();
        if (tag === 'br') to.appendChild(doc.createElement('br'));
        else if (tag === 'em') { var e = doc.createElement('em'); copyInto(n, e); to.appendChild(e); }
        else if (tag === 'a' && /^https:\/\/github\.com\/maxbzd\/eyetime\//.test(n.getAttribute('href') || '')) { var a = doc.createElement('a'); a.setAttribute('href', n.getAttribute('href')); copyInto(n, a); to.appendChild(a); }
        else copyInto(n, to);
      }
    });
  }
  /* small typographic care: no line ends on a lone little word or a lone last word, none starts with a dash or a bare unit */
  function tidy(el) {
    if (CJK[lang]) return;
    var nodes = [], seg = [];
    (function walk(n) { Array.prototype.forEach.call(n.childNodes, function (c) { if (c.nodeType === 3) { nodes.push(c); seg.push(c); } else if (c.nodeName === 'BR') seg = []; else if (c.nodeType === 1) walk(c); }); })(el);
    nodes.forEach(function (n) {
      var s = n.nodeValue.replace(/(\d) (?=[\p{L}%°])/gu, '$1' + NB).replace(/(?<![\p{L}\p{N}])(\p{L}) (?=[^\s ]{1,16}(?![^\s ]))/gu, '$1' + NB).replace(/(?<![\p{L}\p{N}])(\p{L}{2}) (?=[^\s ]{1,10}(?![^\s ]))/gu, '$1' + NB).replace(/ ([—–]) /g, NB + '$1 ').replace(/(?<![\p{L}\p{N}\-])([\p{L}’']{1,9})-([\p{L}’']{1,6})(?![\p{L}\p{N}\-])/gu, '$1\u2011$2');
      if (lang === 'fr') s = s.replace(/ ([:;!?»])/g, NB + '$1').replace(/(«) /g, '$1' + NB);
      n.nodeValue = s;
    });
    var joined = seg.map(function (n) { return n.nodeValue; }).join('');
    if (joined.trim().split(/[  ]+/).length >= 4) {
      for (var i = seg.length - 1; i >= 0; i--) {
        /* only a space inside one piece of text: the one before the last word (never the space beside a tag, which is a place where the words are cut apart) */
        var v = seg[i].nodeValue, body = v.replace(/^\s+|\s+$/g, ''), start = v.indexOf(body), gap = Math.max(body.lastIndexOf(' '), body.lastIndexOf(NB));
        /* the gap before the last word, if it is still an ordinary space and what it would join stays short enough to fit a narrow line */
        if (gap >= 0 && body.charAt(gap) === ' ') {
          var tail = body.slice(gap + 1), head = body.slice(0, gap).split(/ /).pop();
          if (tail.length <= 12 && head.length + tail.length <= 18) { gap += start; seg[i].nodeValue = v.slice(0, gap) + NB + v.slice(gap + 1); }
        }
        break;
      }
    }
  }
  function setMarkup(el, s) {
    el.textContent = '';
    if (s.indexOf('<') < 0) el.appendChild(doc.createTextNode(s));
    else copyInto(new DOMParser().parseFromString('<!doctype html><body>' + s, 'text/html').body, el);
    tidy(el);
  }
  function render(el) { setMarkup(el, t(el.getAttribute('data-t'))); }
  function setKey(el, key) {
    var s = el.hasAttribute('data-t') ? el : $('[data-t]', el);
    if (!s) { s = doc.createElement('span'); el.textContent = ''; el.appendChild(s); }
    s.setAttribute('data-t', key); render(s);
  }

  /* words rise one after another. Chinese and Japanese have no spaces: the browser's own word finder cuts them (sign by sign if it has none),
     and a closing mark never begins a line (a word joiner keeps it with the sign before it, even across an <em>) */
  var CLOSE = /^[。，、．！？：；）」』”’…—]/;
  function pieces(s) {
    if (!CJK[lang]) return s.split(/([ \t\n\r\f]+)/);
    var segs;
    try { segs = Array.from(new Intl.Segmenter(lang, { granularity: 'word' }).segment(s), function (x) { return x.segment; }); } catch (e) { segs = s.match(/[\s\S]/g) || []; }
    /* closing marks, and in Japanese the kana that only inflect or join the word before them (行った, 戦わず, ブラウザと), stay with that word */
    var out = []; segs.forEach(function (g) { if (out.length && (CLOSE.test(g) || (lang === 'ja' && /^[\u3041-\u309f]+$/.test(g) && !CLOSE.test(out[out.length - 1].slice(-1))))) out[out.length - 1] += g; else out.push(g); });
    return out;
  }
  function split(el) {
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = doc.createDocumentFragment(), parts = pieces(n.nodeValue);
          if (CJK[lang] && parts.length && CLOSE.test(parts[0]) && n.previousSibling && n.previousSibling.nodeType === 1) {
            var ws = n.previousSibling.querySelectorAll('.w'), lastW = ws[ws.length - 1], lead = /^[\u3002\uff0c\u3001\uff0e\uff01\uff1f\uff1a\uff1b\uff09\u300d\u300f\u201d\u2019\u2026\u2014]+/.exec(parts[0])[0];
            if (lastW) { var pi = doc.createElement('i'); pi.className = 'p'; pi.textContent = lead; pi.style.setProperty('--i', lastW.firstChild.style.getPropertyValue('--i')); lastW.appendChild(pi); parts[0] = parts[0].slice(lead.length); }
          }
          parts.forEach(function (tok) {
            if (!tok) return;
            if (/^[ \t\n\r\f]+$/.test(tok)) { frag.appendChild(doc.createTextNode(' ')); return; }
            var w = doc.createElement('span'), inner = doc.createElement('i'); w.className = 'w'; inner.textContent = tok; inner.style.setProperty('--i', String(i++)); w.appendChild(inner); frag.appendChild(w);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.nodeName !== 'BR') walk(n);
      });
    })(el);
  }

  function part(h) { return h < 5 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'; }
  function paintWords() {
    var now = new Date(), g = $('#greet'), td = $('#today'), days = $('#days'), ei = $('#eyeIn');
    if (g) g.textContent = t('greet-' + part(now.getHours()));
    if (ei) ei.textContent = eyeLeft + ' ' + t('unit-min');
    if (td) { try { td.textContent = '· ' + new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short' }).format(now); } catch (e) { td.textContent = ''; } }
    if (taskEl && !taskEl.dataset.touched) taskEl.value = t('task-value');
    if (days) { try { var f = new Intl.DateTimeFormat(lang, { weekday: 'narrow' }); days.textContent = ''; [5, 6, 7, 8, 9, 10, 11].forEach(function (d) { var s = doc.createElement('span'); s.textContent = f.format(new Date(2026, 0, d)); days.appendChild(s); }); } catch (e) { /* the letters in the page stay */ } }
  }
  /* the switch: English and the language of this computer; nothing at all if the computer speaks English */
  var sw = $('#lang');
  function paintSwitch() { if (sw) $$('button', sw).forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.set === lang)); }); }
  function paintAll() {
    html.lang = lang === 'zh' ? 'zh-Hans' : lang;
    $$('[data-t]').forEach(render);
    $$('[data-ta]').forEach(function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-ta'))); });
    $$('[data-split]').forEach(split);
    doc.title = t('meta-title'); if (metaD) metaD.setAttribute('content', t('meta-desc'));
    paintWords(); paintSwitch();
  }
  if (sw && choices.length > 1) {
    choices.forEach(function (c) {
      var b = doc.createElement('button'); b.type = 'button'; b.dataset.set = c; b.textContent = c.toUpperCase(); b.title = NATIVE[c]; b.setAttribute('aria-label', NATIVE[c]); b.setAttribute('lang', c);
      b.addEventListener('click', function () { setLang(c); }); sw.appendChild(b);
    });
    sw.hidden = false;
  }
  function load(l) {
    if (dicts[l]) return Promise.resolve();
    return fetch('lang/' + l + '.json', { credentials: 'omit' }).then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); }).then(function (d) { dicts[l] = d; });
  }
  function setLang(l) {
    var want = choices.indexOf(l) >= 0 ? l : 'en';
    load(want).then(function () { lang = want; }, function () { lang = 'en'; }).then(function () {
      try { localStorage.setItem('lang', lang); } catch (e) { /* private window */ }
      paintAll();
    });
  }
  if (taskEl) taskEl.addEventListener('input', function () { taskEl.dataset.touched = '1'; });
  var langReady = false;
  var first = lang; lang = 'en';
  paintAll(); // English at once (the page is English), then the language of the visitor as soon as its file is here
  load(first).then(function () { lang = first; }, function () { lang = 'en'; }).then(function () { langReady = true; paintAll(); });

  /* ── things come in when they are seen ── */
  var seen = $$('.rv, [data-split], .card');
  function reveal(el) { el.classList.add('in'); }
  if (calm || !('IntersectionObserver' in window)) seen.forEach(reveal);
  else {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
    seen.forEach(function (el) { if (!el.closest('.hero')) io.observe(el); });
  }

  /* ── the opening ── */
  var ldN = $('#ldN'), ldP = $('#ldP'), heroImg = $('.hero-bg img'), opened = false;
  function open() {
    if (opened) return; opened = true; html.classList.add('ready');
    setTimeout(function () { $$('.hero .rv, .hero [data-split]').forEach(reveal); }, calm ? 0 : 350);
  }
  if (calm) open();
  else {
    var t0 = performance.now(), imgOk = !heroImg || heroImg.complete;
    if (heroImg && !imgOk) { heroImg.addEventListener('load', function () { imgOk = true; }); heroImg.addEventListener('error', function () { imgOk = true; }); }
    (function tick() {
      var el = performance.now() - t0, p = Math.min(1, el / 900); if (!(imgOk && (langReady || el > 2500)) && el < 3500) p = Math.min(p, 0.86);
      if (ldN) ldN.textContent = ('00' + Math.round(p * 100)).slice(-3); if (ldP) ldP.style.strokeDashoffset = String(164 * (1 - p));
      if (p >= 1) setTimeout(open, 180); else requestAnimationFrame(tick);
    })();
    setTimeout(open, 5000);
  }

  /* ── the clock: your time, behind the mountain ── */
  var hh = $('#hh'), mm = $('#mm'), eyeIn = $('#eyeIn');
  function clock() { var d = new Date(); if (hh) hh.textContent = pad(d.getHours()); if (mm) mm.textContent = pad(d.getMinutes()); }
  clock(); setInterval(clock, 1000);
  setInterval(function () { eyeLeft = eyeLeft > 1 ? eyeLeft - 1 : 20; if (eyeIn) paintWords(); }, 60000);

  /* ── depth: the layers of the hero follow the pointer ── */
  var hero = $('.hero'), tx = 0, ty = 0, cx = 0, cy = 0, heroOn = true;
  if (hero && fine && !calm) {
    window.addEventListener('pointermove', function (e) { tx = (e.clientX / window.innerWidth - 0.5) * 2; ty = (e.clientY / window.innerHeight - 0.5) * 2; }, { passive: true });
    (function loop() {
      if (heroOn) { cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06; hero.style.setProperty('--px', cx.toFixed(4)); hero.style.setProperty('--py', cy.toFixed(4)); }
      requestAnimationFrame(loop);
    })();
  }

  /* ── dust in the morning light, between the sky and the peak ── */
  var cv = $('#dust');
  if (cv && !calm) {
    var ctx = cv.getContext('2d'), W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1), motes = [];
    var size = function () { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size(); window.addEventListener('resize', size);
    for (var k = 0; k < (window.innerWidth < 700 ? 34 : 70); k++) motes.push({ x: Math.random(), y: Math.random(), r: 0.5 + Math.random() * 1.7, s: 0.00008 + Math.random() * 0.00022, d: Math.random() * 6.28, a: 0.15 + Math.random() * 0.5, z: 0.3 + Math.random() });
    (function draw(t) {
      if (heroOn) {
        ctx.clearRect(0, 0, W, H);
        for (var j = 0; j < motes.length; j++) {
          var m = motes[j]; m.y -= m.s * 16; m.x += Math.sin(t * 0.0003 + m.d) * 0.00012; if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
          var x = m.x * W - cx * 26 * m.z, y = m.y * H - cy * 16 * m.z, tw = 0.6 + 0.4 * Math.sin(t * 0.0012 + m.d);
          ctx.beginPath(); ctx.arc(x, y, m.r, 0, 6.283); ctx.fillStyle = 'rgba(255,244,225,' + (m.a * tw).toFixed(3) + ')'; ctx.fill();
        }
      }
      requestAnimationFrame(draw);
    })(0);
  }

  /* ── the day: each chapter slides over the one before, which steps back ── */
  var chapters = $$('.ch'), rail = $('#rail'), railLinks = rail ? $$('a', rail) : [], day = $('#day'), ticking = false;
  function onScroll() {
    ticking = false;
    var vh = window.innerHeight;
    heroOn = window.scrollY < vh * 1.1;
    var stacked = window.matchMedia('(min-width: 981px) and (min-height: 680px)').matches, active = -1;
    for (var i = 0; i < chapters.length; i++) {
      var r = chapters[i].getBoundingClientRect();
      if (r.top < vh * 0.5) active = i;
      if (stacked && !calm) { var next = chapters[i + 1], cover = next ? Math.max(0, Math.min(1, 1 - next.getBoundingClientRect().top / vh)) : 0; chapters[i].style.setProperty('--cover', cover.toFixed(3)); }
    }
    if (rail && day) {
      var dr = day.getBoundingClientRect(); rail.classList.toggle('on', dr.top < vh * 0.5 && dr.bottom > vh * 0.6);
      railLinks.forEach(function (a, n) { a.classList.toggle('on', n === active); });
    }
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  window.addEventListener('resize', onScroll); onScroll();

  /* run a small copy of the product only while it is on the screen */
  function whileVisible(el, start, stop) {
    if (!el) return; if (!('IntersectionObserver' in window)) { start(); return; }
    new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) start(); else stop(); }); }, { threshold: 0.25 }).observe(el);
  }
  var C = 326.7; // the length of the ring (2πr, r = 52)

  /* ── 01 focus: a real countdown; the buttons work ── */
  (function () {
    var card = $('#dFocus'); if (!card) return;
    var T = $('#fT'), P = $('#fP'), End = $('#fEnd'), pauseB = $('#fPause'), plusB = $('#fPlus'), modes = $$('#fModes .pill'), total = 25 * 60, left = total - 1, paused = false, timer = null;
    function paint() {
      T.textContent = pad(Math.floor(left / 60)) + ':' + pad(left % 60); P.style.strokeDashoffset = String(C * (1 - left / total));
      var e = new Date(Date.now() + left * 1000); End.textContent = pad(e.getHours()) + ':' + pad(e.getMinutes());
    }
    function step() { if (paused) return; left = left > 0 ? left - 1 : total - 1; paint(); }
    pauseB.addEventListener('click', function () { paused = !paused; setKey(pauseB, paused ? 'resume' : 'pause'); pauseB.classList.toggle('on', paused); });
    plusB.addEventListener('click', function () { left += 300; total = Math.max(total, left + 1); paint(); });
    modes.forEach(function (b) { b.addEventListener('click', function () { modes.forEach(function (o) { o.classList.toggle('on', o === b); }); total = Number(b.dataset.m) * 60; left = total - 1; paint(); }); });
    paint(); whileVisible(card, function () { if (!timer) timer = setInterval(step, 1000); }, function () { clearInterval(timer); timer = null; });
  })();

  /* ── 02 the pause: breathe with the orb, then the choice is yours ── */
  (function () {
    var card = $('#dPause'); if (!card) return;
    var T = $('#paT'), N = $('#paN'), Cb = $('#paC'), n = 5, phase = 0, t1 = null, t2 = null;
    function breath() { phase = 1 - phase; setKey(T, phase ? 'breathe-out' : 'breathe-in'); }
    function count() {
      if (n > 0) { n--; if ($('#paN')) $('#paN').textContent = String(n); if (n === 0) { Cb.disabled = false; Cb.textContent = ''; setKey(Cb, 'continue-to-site'); } }
    }
    function reset() { n = 5; Cb.disabled = true; Cb.textContent = ''; var a = doc.createElement('span'), b = doc.createElement('span'); a.setAttribute('data-t', 'continue-in'); render(a); b.id = 'paN'; b.textContent = '5'; Cb.appendChild(a); Cb.appendChild(doc.createTextNode(' ')); Cb.appendChild(b); N = b; }
    $$('button', card).forEach(function (b) { b.addEventListener('click', function () { reset(); }); });
    whileVisible(card, function () { if (!t1) { reset(); t1 = setInterval(breath, 4000); t2 = setInterval(count, 1000); } }, function () { clearInterval(t1); clearInterval(t2); t1 = t2 = null; });
  })();

  /* ── 03 eyes: twenty seconds, again and again ── */
  (function () {
    var card = $('#dEye'); if (!card) return;
    var T = $('#eT'), P = $('#eP'), Hd = $('#eH'), S = $('#eS'), left = 20, rest = 0, timer = null;
    function step() {
      if (rest > 0) { rest--; if (rest === 0) { left = 20; T.textContent = '20'; P.style.strokeDashoffset = '0'; setKey(Hd, 'look-far-away'); setKey(S, 'find-something-about-six-metres'); } return; }
      left--; T.textContent = String(left); P.style.strokeDashoffset = String(C * (1 - left / 20));
      if (left === 0) { rest = 4; T.textContent = '✓'; setKey(Hd, 'well-done'); setKey(S, 'eyes-thank-you'); }
    }
    whileVisible(card, function () { if (!timer) timer = setInterval(step, 1000); }, function () { clearInterval(timer); timer = null; });
  })();

  /* ── 04 the numbers count up once; the limit can be set ── */
  function countUp(el) {
    var to = Number(el.dataset.count), t0 = performance.now(), dur = 1300; if (calm || !to) { el.textContent = String(to); return; }
    (function f(t) { var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4); el.textContent = String(Math.round(to * e)); if (p < 1) requestAnimationFrame(f); })(t0);
  }
  if ('IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { countUp(e.target); cio.unobserve(e.target); } }); }, { threshold: 0.6 });
    $$('[data-count]').forEach(function (el) { cio.observe(el); });
  }
  var lim = $('#limit'); if (lim) lim.addEventListener('click', function () { setKey(lim, 'limit-set'); lim.disabled = true; });

  /* ── 05 looks: pick one and the whole page takes its colour ── */
  (function () {
    var sw = $$('#sw button'), img = $('#pvImg'), pvT = $('#pvT'); if (!sw.length) return;
    function ink(hex) { var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return 'rgb(' + Math.round(r * 0.09) + ',' + Math.round(g * 0.09) + ',' + Math.round(b * 0.09) + ')'; }
    sw.forEach(function (b) {
      b.addEventListener('click', function () {
        sw.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        html.style.setProperty('--acc', b.dataset.acc); html.style.setProperty('--acc-ink', ink(b.dataset.acc));
        if (img) { img.style.opacity = '0'; setTimeout(function () { img.src = 'walls/' + b.dataset.img + '.webp'; img.onload = function () { img.style.opacity = '1'; }; }, 250); }
      });
    });
    function t() { var d = new Date(); if (pvT) pvT.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()); }
    t(); setInterval(t, 20000);
  })();

  /* ── the pointer: one dot of our own; the system arrow is hidden once it is alive (touch screens keep theirs) ── */
  var cur = $('#cur');
  if (cur && fine) {
    var mx = 0, my = 0, px = 0, py = 0, shown = false, running = false;
    var place = function () { cur.style.transform = 'translate3d(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px,0)'; };
    var follow = function () {
      var k = calm ? 1 : 0.38; px += (mx - px) * k; py += (my - py) * k; place();
      if (Math.abs(mx - px) > 0.2 || Math.abs(my - py) > 0.2) requestAnimationFrame(follow); else { px = mx; py = my; place(); running = false; }
    };
    var kindOf = function (el) { return el && el.closest ? (el.closest('input, textarea') ? 'txt' : el.closest('a, button, summary, label, .mq li') ? 'big' : '') : ''; };
    var setKind = function (el) { var k = kindOf(el); cur.classList.toggle('big', k === 'big'); cur.classList.toggle('txt', k === 'txt'); };
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      mx = e.clientX; my = e.clientY;
      if (!shown) { shown = true; px = mx; py = my; place(); html.classList.add('has-cur'); setKind(e.target); }
      cur.classList.add('on');
      if (!running) { running = true; requestAnimationFrame(follow); }
    }, { passive: true });
    doc.addEventListener('pointerover', function (e) { if (shown) setKind(e.target); });
    doc.addEventListener('pointerdown', function () { cur.classList.add('down'); });
    doc.addEventListener('pointerup', function () { cur.classList.remove('down'); });
    html.addEventListener('mouseleave', function () { cur.classList.remove('on'); });
    html.addEventListener('mouseenter', function () { if (shown) cur.classList.add('on'); });
  }

  /* only one answer open at a time */
  var qs = $$('.faq details'); qs.forEach(function (d) { d.addEventListener('toggle', function () { if (d.open) qs.forEach(function (o) { if (o !== d) o.open = false; }); }); });
})();
