// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The page that stands in for a closed one. It opens the original again as soon as the block is over.
const q = new URLSearchParams(location.search);
const url = q.get('u') || '', why = q.get('w') || 'site', rule = q.get('r') || '', word = q.get('k') || '';
const ru = /^ru|^uk|^be/i.test(navigator.language || '');
let host = url;
try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* keep the whole address */ }
const T = ru
  ? { t: 'Закрыто EyeTime', site: (h) => `Сейчас ${h} закрыт.`, only: (h) => `${h} не в списке разрешённого.`, keyword: (w) => `На странице есть слово «${w}».`, rule: (r) => `Правило: ${r}`, f: 'Страница откроется сама, когда блокировка закончится.' }
  : { t: 'Closed by EyeTime', site: (h) => `${h} is closed right now.`, only: (h) => `${h} is not on your allowed list.`, keyword: (w) => `This page has the word "${w}".`, rule: (r) => `Rule: ${r}`, f: 'The page opens by itself when the block ends.' };
document.documentElement.lang = ru ? 'ru' : 'en';
document.getElementById('t').textContent = T.t;
const s = document.getElementById('s');
const line = why === 'only' ? T.only(host) : why === 'keyword' ? T.keyword(word) : T.site(host);
s.textContent = line + (rule ? ' ' + T.rule(rule) : '');
document.getElementById('f').textContent = T.f;
setInterval(() => {
  chrome.runtime.sendMessage({ type: 'verdict', url }, (v) => {
    if (chrome.runtime.lastError) return;
    if (v && !v.blocked && url) location.replace(url);
  });
}, 2500);
