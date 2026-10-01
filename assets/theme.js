// Applies the accent color / font chosen on the new tab (Customize → Appearance) to every EyeTime page.
(function () {
  const FONTS = {
    system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, Helvetica, Arial, sans-serif',
    serif: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
    rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", "Quicksand", system-ui, sans-serif'
  };
  function rgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '255, 94, 14';
    const n = parseInt(m[1], 16);
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  }
  function apply(th) {
    if (!th) return;
    const s = document.documentElement.style;
    if (th.accent) { s.setProperty('--fx-orange', th.accent); s.setProperty('--fx-accent-rgb', rgb(th.accent)); }
    if (th.font && FONTS[th.font]) { s.setProperty('--font', FONTS[th.font]); document.documentElement.style.fontFamily = FONTS[th.font]; }
  }
  try { apply(JSON.parse(localStorage.getItem('eyetime_theme') || 'null')); } catch (e) { }
  try {
    chrome.storage.local.get(['newtabLayout'], (d) => {
      const th = d && d.newtabLayout && d.newtabLayout.theme;
      if (th) { apply(th); try { localStorage.setItem('eyetime_theme', JSON.stringify({ accent: th.accent, font: th.font })); } catch (e) { } }
    });
  } catch (e) { }
})();
