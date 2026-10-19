// Context-menu actions as pure settings mutations (the worker only wires them to the browser menu).

export const MENU_IDS = ['cls:productive', 'cls:neutral', 'cls:distracting', 'block:always'];

/**
 * Apply a menu action for `host` to settings `s` (mutates). Returns { changed, key } where key is an i18n key
 * describing what happened ('menu.marked' / 'menu.blocked' / 'menu.unblocked'), or null.
 */
export function applyMenuAction(id, host, s) {
  if (!host) return { changed: false, key: null };
  if (id.startsWith('cls:')) {
    const cls = id.slice(4);
    if (!['productive', 'neutral', 'distracting'].includes(cls)) return { changed: false, key: null };
    s.sites[host] = cls;
    if (cls !== 'distracting') s.blocking.always = s.blocking.always.filter((d) => d !== host);
    return { changed: true, key: 'menu.marked', cls };
  }
  if (id === 'block:always') {
    const on = s.blocking.always.includes(host);
    s.blocking.always = on ? s.blocking.always.filter((d) => d !== host) : [...s.blocking.always, host];
    return { changed: true, key: on ? 'menu.unblocked' : 'menu.blocked' };
  }
  return { changed: false, key: null };
}
