// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The landing page: language, the opening, the live clock behind the peak, the day that slides by, the small working copies of the product, the pointer.
// No library and no request to another host. Without this script the page is whole and readable (the `js` class on <html> is what hides things for the opening).
(function () {
  'use strict';
  var doc = document, html = doc.documentElement, $ = function (s, r) { return (r || doc).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches, fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };

  /* ── language ── */
  var LANGS = ['en', 'ru', 'ro'], langBtns = $$('.lang button');
  var GREET = { en: ['Good night', 'Good morning', 'Good afternoon', 'Good evening'], ru: ['Доброй ночи', 'Доброе утро', 'Добрый день', 'Добрый вечер'], ro: ['Noapte bună', 'Bună dimineața', 'Bună ziua', 'Bună seara'] };
  var BREATH = { en: ['Breathe in', 'Breathe out'], ru: ['Вдох', 'Выдох'], ro: ['Inspiră', 'Expiră'] };
  var WORDS = { en: { cont: 'Continue to site', set: 'Limit set ✓', done: 'Well done', logged: 'Your eyes thank you. Break logged.', resume: 'Resume', pause: 'Pause', min: 'min' },
    ru: { cont: 'Продолжить', set: 'Лимит стоит ✓', done: 'Отлично', logged: 'Глаза говорят спасибо. Перерыв записан.', resume: 'Дальше', pause: 'Пауза', min: 'мин' },
    ro: { cont: 'Continuă pe site', set: 'Limită setată ✓', done: 'Foarte bine', logged: 'Ochii tăi îți mulțumesc. Pauza a fost notată.', resume: 'Reia', pause: 'Pauză', min: 'min' } };
  var lang = 'en', eyeLeft = 19;
  function tri(en, ru, ro) { return '<span data-en>' + en + '</span><span data-ru>' + ru + '</span><span data-ro>' + ro + '</span>'; }
  function part(h) { return h < 5 ? 0 : h < 12 ? 1 : h < 18 ? 2 : 3; }
  function paintWords() {
    var now = new Date(), g = $('#greet'), t = $('#today'), task = $('#fTask'), days = $('#days');
    if (g) g.textContent = GREET[lang][part(now.getHours())];
    var ei = $('#eyeIn'); if (ei) ei.textContent = (typeof eyeLeft === 'number' ? eyeLeft : 19) + ' ' + WORDS[lang].min;
    if (t) { try { t.textContent = '· ' + new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short' }).format(now); } catch (e) { t.textContent = ''; } }
    if (task && !task.dataset.touched) task.value = task.getAttribute('data-v-' + lang) || task.value;
    if (days) { try { var f = new Intl.DateTimeFormat(lang, { weekday: 'narrow' }); days.innerHTML = [5, 6, 7, 8, 9, 10, 11].map(function (d) { return '<span>' + f.format(new Date(2026, 0, d)) + '</span>'; }).join(''); } catch (e) { /* the letters in the page stay */ } }
  }
  function setLang(l) {
    lang = LANGS.indexOf(l) >= 0 ? l : 'en'; html.lang = lang;
    langBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.set === lang)); });
    try { localStorage.setItem('lang', lang); } catch (e) { /* private window */ }
    paintWords();
  }
  var saved = null; try { saved = localStorage.getItem('lang'); } catch (e) { /* private window */ }
  var nav = (navigator.language || 'en').toLowerCase().slice(0, 2);
  setLang(LANGS.indexOf(saved) >= 0 ? saved : nav);
  langBtns.forEach(function (b) { b.addEventListener('click', function () { setLang(b.dataset.set); }); });
  var taskEl = $('#fTask'); if (taskEl) taskEl.addEventListener('input', function () { taskEl.dataset.touched = '1'; });

  /* ── words rise one after another ── */
  $$('[data-split]').forEach(function (el) {
    $$(':scope > span', el).forEach(function (langSpan) {
      var i = 0;
      (function walk(node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (n) {
          if (n.nodeType === 3) {
            var frag = doc.createDocumentFragment();
            n.textContent.split(/(\s+)/).forEach(function (tok) {
              if (!tok) return;
              if (/^\s+$/.test(tok)) { frag.appendChild(doc.createTextNode(' ')); return; }
              var w = doc.createElement('span'), inner = doc.createElement('i'); w.className = 'w'; inner.textContent = tok; inner.style.setProperty('--i', String(i++)); w.appendChild(inner); frag.appendChild(w);
            });
            node.replaceChild(frag, n);
          } else if (n.nodeType === 1) walk(n);
        });
      })(langSpan);
    });
  });

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
    var t0 = performance.now(), loaded = !heroImg || heroImg.complete;
    if (heroImg && !loaded) { heroImg.addEventListener('load', function () { loaded = true; }); heroImg.addEventListener('error', function () { loaded = true; }); }
    (function tick() {
      var el = performance.now() - t0, p = Math.min(1, el / 900); if (!loaded && el < 3500) p = Math.min(p, 0.86);
      if (ldN) ldN.textContent = ('00' + Math.round(p * 100)).slice(-3); if (ldP) ldP.style.strokeDashoffset = String(164 * (1 - p));
      if (p >= 1) setTimeout(open, 180); else requestAnimationFrame(tick);
    })();
    setTimeout(open, 5000);
  }

  /* ── the clock: your time, behind the mountain ── */
  var hh = $('#hh'), mm = $('#mm'), eyeIn = $('#eyeIn');
  function clock() { var d = new Date(); if (hh) hh.textContent = pad(d.getHours()); if (mm) mm.textContent = pad(d.getMinutes()); }
  clock(); setInterval(clock, 1000);
  setInterval(function () { eyeLeft = eyeLeft > 1 ? eyeLeft - 1 : 20; if (eyeIn) eyeIn.textContent = eyeLeft + ' ' + WORDS[lang].min; paintWords(); }, 60000);

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
    pauseB.addEventListener('click', function () { paused = !paused; pauseB.innerHTML = paused ? tri(WORDS.en.resume, WORDS.ru.resume, WORDS.ro.resume) : tri(WORDS.en.pause, WORDS.ru.pause, WORDS.ro.pause); pauseB.classList.toggle('on', paused); });
    plusB.addEventListener('click', function () { left += 300; total = Math.max(total, left + 1); paint(); });
    modes.forEach(function (b) { b.addEventListener('click', function () { modes.forEach(function (o) { o.classList.toggle('on', o === b); }); total = Number(b.dataset.m) * 60; left = total - 1; paint(); }); });
    paint(); whileVisible(card, function () { if (!timer) timer = setInterval(step, 1000); }, function () { clearInterval(timer); timer = null; });
  })();

  /* ── 02 the pause: breathe with the orb, then the choice is yours ── */
  (function () {
    var card = $('#dPause'); if (!card) return;
    var T = $('#paT'), N = $('#paN'), Cb = $('#paC'), n = 5, phase = 0, t1 = null, t2 = null, label = Cb.innerHTML;
    function breath() { phase = 1 - phase; T.innerHTML = tri(BREATH.en[phase], BREATH.ru[phase], BREATH.ro[phase]); }
    function count() {
      if (n > 0) { n--; if ($('#paN')) $('#paN').textContent = String(n); if (n === 0) { Cb.disabled = false; Cb.innerHTML = tri(WORDS.en.cont, WORDS.ru.cont, WORDS.ro.cont); } }
    }
    function reset() { n = 5; Cb.disabled = true; Cb.innerHTML = label; N = $('#paN'); }
    $$('button', card).forEach(function (b) { b.addEventListener('click', function () { reset(); }); });
    whileVisible(card, function () { if (!t1) { reset(); t1 = setInterval(breath, 4000); t2 = setInterval(count, 1000); } }, function () { clearInterval(t1); clearInterval(t2); t1 = t2 = null; });
  })();

  /* ── 03 eyes: twenty seconds, again and again ── */
  (function () {
    var card = $('#dEye'); if (!card) return;
    var T = $('#eT'), P = $('#eP'), Hd = $('#eH'), S = $('#eS'), h0 = Hd.innerHTML, s0 = S.innerHTML, left = 20, rest = 0, timer = null;
    function step() {
      if (rest > 0) { rest--; if (rest === 0) { left = 20; T.textContent = '20'; P.style.strokeDashoffset = '0'; Hd.innerHTML = h0; S.innerHTML = s0; } return; }
      left--; T.textContent = String(left); P.style.strokeDashoffset = String(C * (1 - left / 20));
      if (left === 0) { rest = 4; T.textContent = '✓'; Hd.innerHTML = tri(WORDS.en.done, WORDS.ru.done, WORDS.ro.done); S.innerHTML = tri(WORDS.en.logged, WORDS.ru.logged, WORDS.ro.logged); }
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
  var lim = $('#limit'); if (lim) lim.addEventListener('click', function () { lim.innerHTML = tri(WORDS.en.set, WORDS.ru.set, WORDS.ro.set); lim.disabled = true; });

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

  /* ── the pointer ── */
  var cur = $('#cur');
  if (cur && fine && !calm) {
    var mx = -100, my = -100, px = -100, py = -100;
    window.addEventListener('pointermove', function (e) { mx = e.clientX; my = e.clientY; cur.classList.add('on'); }, { passive: true });
    doc.addEventListener('pointerleave', function () { cur.classList.remove('on'); });
    doc.addEventListener('pointerover', function (e) { var t = e.target; cur.classList.toggle('big', !!(t && t.closest && t.closest('a, button, summary, input, .mq li'))); });
    (function follow() { px += (mx - px) * 0.2; py += (my - py) * 0.2; cur.style.transform = 'translate3d(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px,0)'; requestAnimationFrame(follow); })();
  }

  /* only one answer open at a time */
  var qs = $$('.faq details'); qs.forEach(function (d) { d.addEventListener('toggle', function () { if (d.open) qs.forEach(function (o) { if (o !== d) o.open = false; }); }); });
})();
