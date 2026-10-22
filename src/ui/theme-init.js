// Classic (non-module) script loaded synchronously in <head> of every page: applies the user's look before first paint
// (no flash). The look is resolved by src/shared/looks.js on the settings page / whenever settings change and cached in
// localStorage as { mode, schedule, scale, css, light:{vars,attrs}, dark:{vars,attrs} }; here we only pick the scheme and paint.
(function () {
  var KEY = 'et-look';
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var more = window.matchMedia ? window.matchMedia('(prefers-contrast: more)') : null;
  var current = null, timer = 0;

  function scheme(c) {
    if (c.mode === 'light' || c.mode === 'dark') return c.mode;
    if (c.mode === 'schedule') {
      var d = new Date(), m = d.getHours() * 60 + d.getMinutes();
      var dk = String((c.schedule && c.schedule.dark) || '20:00').split(':'), lt = String((c.schedule && c.schedule.light) || '07:00').split(':');
      var a = +dk[0] * 60 + +dk[1], b = +lt[0] * 60 + +lt[1];
      return a > b ? (m >= a || m < b ? 'dark' : 'light') : (m >= a && m < b ? 'dark' : 'light');
    }
    return mq && mq.matches ? 'dark' : 'light';
  }

  function paint(c) {
    current = c;
    var set = c[scheme(c)];
    for (var k in set.vars) root.style.setProperty(k, set.vars[k]);
    for (var a in set.attrs) root.setAttribute(a, set.attrs[a]);
    if (more && more.matches) { // the system asks for more contrast: secondary text becomes full-strength text, hairlines become strong lines
      root.setAttribute('data-contrast', 'more');
      root.style.setProperty('--text-2', 'var(--text)'); root.style.setProperty('--text-3', 'var(--text)');
      root.style.setProperty('--border-strong', 'var(--text)'); root.style.setProperty('--border', 'var(--text)');
    } else root.removeAttribute('data-contrast');
    var el = document.getElementById('et-custom-css');
    if (c.css) {
      if (!el) { el = document.createElement('style'); el.id = 'et-custom-css'; (document.head || root).appendChild(el); }
      if (el.textContent !== c.css) el.textContent = c.css;
    } else if (el) el.remove();
    clearInterval(timer);
    if (c.mode === 'schedule') timer = setInterval(function () { paint(current); }, 60000); // flip at the scheduled minute
  }

  function apply(c, persist) {
    if (persist) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} }
    paint(c);
  }

  var cached = null;
  try { cached = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  if (cached && cached.light && cached.dark) paint(cached);
  else root.setAttribute('data-scheme', mq && mq.matches ? 'dark' : 'light'); // first run: tokens.css fallback (Calm)
  if (mq) mq.addEventListener('change', function () { if (current) paint(current); else root.setAttribute('data-scheme', mq.matches ? 'dark' : 'light'); });

  if (more) more.addEventListener('change', function () { if (current) paint(current); });

  /** @type {any} */ (window).EyeTimeTheme = { apply: apply };
})();
