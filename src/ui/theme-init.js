// Classic (non-module) script loaded synchronously in <head> of every page so the right theme and accent
// are applied before first paint — no flash. Settings pages call EyeTimeTheme.apply() when the user changes them.
(function () {
  // Each accent has a light-theme and a dark-theme variant; fills are checked for ≥4.5:1 against their foreground.
  var ACCENTS = {
    ember:  { l: ['#cf450a', '#b83d08', '#ffffff', '#b83d08', '#fdeee6'], d: ['#ff7a3d', '#ff8e58', '#1a0e07', '#ff9a66', '#2b1a11'] },
    blue:   { l: ['#2563eb', '#1d4fd0', '#ffffff', '#1d4ed8', '#e8f0ff'], d: ['#6ea0ff', '#86b0ff', '#071226', '#8fb4ff', '#13213f'] },
    violet: { l: ['#7c3aed', '#6a2ed6', '#ffffff', '#6d28d9', '#f1eaff'], d: ['#a98bff', '#b8a0ff', '#150b2e', '#b9a2ff', '#241a42'] },
    pink:   { l: ['#c71f6e', '#b01761', '#ffffff', '#b01761', '#fde8f1'], d: ['#ff7eb6', '#ff93c2', '#2a0716', '#ff9cc8', '#3a1226'] },
    teal:   { l: ['#0b7f7a', '#096b67', '#ffffff', '#0b6f6b', '#e0f4f2'], d: ['#2cc4bd', '#47d3cc', '#04201f', '#5fdad3', '#0f2a29'] },
    green:  { l: ['#2f7d32', '#276b2a', '#ffffff', '#276b2a', '#e6f3e6'], d: ['#6fd16f', '#85dc85', '#0a1f0a', '#8ae08a', '#14291a'] },
  };
  var KEYS = ['--accent', '--accent-hover', '--accent-fg', '--accent-text', '--accent-soft'];
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function isDark(theme) { return theme === 'dark' || (theme !== 'light' && mq && mq.matches); }

  function apply(theme, accent) {
    var root = document.documentElement;
    theme = theme || 'system'; accent = ACCENTS[accent] ? accent : 'ember';
    if (theme === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
    root.dataset.accent = accent;
    var v = ACCENTS[accent][isDark(theme) ? 'd' : 'l'];
    KEYS.forEach(function (k, i) { root.style.setProperty(k, v[i]); });
    root.style.setProperty('--accent-ring', hexA(v[0], isDark(theme) ? 0.4 : 0.35));
    try { localStorage.setItem('et-theme', JSON.stringify({ theme: theme, accent: accent })); } catch (e) {}
  }

  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  var saved = null;
  try { saved = JSON.parse(localStorage.getItem('et-theme') || 'null'); } catch (e) {}
  apply(saved && saved.theme, saved && saved.accent);
  if (mq) mq.addEventListener('change', function () { var s = null; try { s = JSON.parse(localStorage.getItem('et-theme') || 'null'); } catch (e) {} apply(s && s.theme, s && s.accent); });

  window.EyeTimeTheme = { apply: apply, ACCENTS: ACCENTS };
})();
