// Shared top bar for full-page surfaces.
import { h, icon } from './dom.js';
import { t } from '../shared/i18n.js';

const href = (p) => chrome.runtime.getURL(p);

export function mountHeader(mount, active) {
  const link = (id, path, label) => h('a', { href: href(path), 'aria-current': active === id ? 'page' : null, text: label });
  mount.replaceChildren(h('div', { class: 'app-header-in' },
    h('a', { class: 'app-brand', href: href('src/newtab/newtab.html') }, h('img', { src: '../../icons/logo.svg', alt: '', width: 26, height: 26 }), h('span', { text: 'EyeTime' })),
    h('nav', { class: 'app-nav', 'aria-label': 'Main' },
      link('home', 'src/newtab/newtab.html', t('nav.home')),
      link('insights', 'src/insights/insights.html', t('nav.insights')),
      link('settings', 'src/options/options.html', t('nav.settings')))));
  return mount;
}

export { icon };
