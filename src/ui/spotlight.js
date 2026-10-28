// A soft light that follows the pointer over cards (the Obsidian look paints it; every other look ignores the two variables).
// One delegated listener, one frame at a time, nothing while the pointer is still.

export function installSpotlight(root = document) {
  let raf = 0, card = null, x = 0, y = 0;
  const paint = () => {
    raf = 0;
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', (x - r.left).toFixed(0) + 'px');
    card.style.setProperty('--my', (y - r.top).toFixed(0) + 'px');
  };
  root.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || document.documentElement.dataset.look !== 'obsidian') return;
    const t = /** @type {Element | null} */ (e.target);
    const c = t && t.closest ? t.closest('.card') : null;
    if (!c) return;
    card = /** @type {HTMLElement} */ (c); x = e.clientX; y = e.clientY;
    if (!raf) raf = window.requestAnimationFrame(paint);
  }, { passive: true });
}
