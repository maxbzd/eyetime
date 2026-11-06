// What a translation reader would want before trusting nine machine-translated languages: not whether the keys exist (npm run check does that) but where the words look wrong.
//   node scripts-dev/i18n-report.mjs [--lang ru] [--json]       a summary per language and the strings to look at first
// Signals (each is a hint for a human, never a verdict):
//   same     the text is exactly the English one (not translated), unless it is a name, a number, a symbol or a word that is the same in that language
//   long     much longer than the English text for a short string: the screen may overflow (the layout tests use 400 px and 125 % zoom; a 2.5x string is where they would show it)
//   latin    in a language that is not written in Latin letters: whole English words left in the text
//   ending   the English ends in "…", "?" or "!" and the translation does not (or the other way round); a full stop is not compared (an abbreviation such as "Min." ends with one)
//   spaces   leading or trailing spaces, doubled spaces, or a line break that the English does not have
import { LOCALES } from '../src/shared/locales/index.js';

const en = LOCALES.en;
const NON_LATIN = new Set(['ru', 'uk', 'zh', 'ja']);
const KEEP = new Set(['EyeTime', 'Todoist', 'Notion', 'CalDAV', 'iCloud', 'Fastmail', 'Nextcloud', 'Google', 'Microsoft', 'Pomodoro', 'CSV', 'JSON', 'Markdown', 'URL', 'PIN', 'OK', 'ICS', 'iCal', 'AI', 'CSS', 'API', 'RSS', 'HTML', 'YouTube', 'TikTok', 'Instagram', 'VK', 'Reddit', 'Shorts', 'Reels', 'Chrome', 'Edge', 'Firefox', 'Brave', 'Alt', 'Ctrl', 'Cmd', 'Shift', 'Enter', 'Esc', 'GitHub', 'Mac', 'Windows', 'Linux', 'Gemini', 'Nano', 'Hex', 'MIT', 'PNG', 'SVG', 'WebP', 'JPEG', 'min', 'ics', 'http', 'https', 'example', 'com', 'basic']);
const words = (s) => (s.replace(/\{\w+\}/g, '').match(/[A-Za-z]{3,}/g) || []);

/** The findings for one language: [{ key, signal, en, text }] */
export function review(lang, dict = LOCALES[lang], base = en) {
  const out = [];
  for (const [key, ev] of Object.entries(base)) {
    const tv = dict[key];
    if (tv === undefined) continue;
    const pairs = typeof ev === 'string' && typeof tv === 'string' ? [[ev, tv]] : typeof ev === 'object' && typeof tv === 'object' ? Object.keys(ev).filter((k) => typeof tv[k] === 'string' && typeof ev[k] === 'string').map((k) => [ev[k], tv[k]]) : [];
    for (const [e, t] of pairs) {
      const add = (signal) => out.push({ key, signal, en: e, text: t });
      const plain = e.replace(/\{\w+\}/g, '').trim();
      // one word that is the same is mostly a cognate ("Neutral", "Fokus"); a phrase that is the same is mostly a string nobody translated
      if (e === t && /[A-Za-z]{4,}/.test(plain) && (/\s/.test(plain) || plain.length >= 14) && !/^[A-Z0-9 .\-/+·→←↑↓:%…]+$/.test(plain) && ![...words(plain)].every((w) => KEEP.has(w))) add('same');
      if (e.length >= 6 && e.length <= 40 && t.length > e.length * 2.5 && t.length - e.length > 18) add('long');
      if (NON_LATIN.has(lang)) { const left = words(t).filter((w) => !KEEP.has(w) && !/^(px|ms|min|sec|km|kg|cm|mm)$/i.test(w)); if (left.length) add('latin'); }
      const endE = /[…?!]$/.test(e.trim()), endT = /[…?!？！]$/.test(t.trim());
      if (endE !== endT && e.trim().length > 3) add('ending');
      if (/^\s|\s$|  /.test(t) !== /^\s|\s$|  /.test(e) || /\n/.test(t) !== /\n/.test(e)) add('spaces');
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv.includes('--lang') ? process.argv[process.argv.indexOf('--lang') + 1] : '';
  const json = process.argv.includes('--json');
  const report = {};
  for (const lang of Object.keys(LOCALES).filter((l) => l !== 'en' && (!only || l === only))) {
    const f = review(lang), total = Object.keys(en).length;
    const by = {}; for (const x of f) by[x.signal] = (by[x.signal] || 0) + 1;
    report[lang] = { keys: total, flagged: new Set(f.map((x) => x.key)).size, by, findings: f };
  }
  if (json) console.log(JSON.stringify(report, null, 1));
  else {
    console.log('language  keys  flagged  ' + ['same', 'long', 'latin', 'ending', 'spaces'].map((s) => s.padEnd(7)).join(''));
    for (const [lang, r] of Object.entries(report)) console.log(`${lang.padEnd(9)} ${String(r.keys).padEnd(5)} ${String(r.flagged).padEnd(8)} ${['same', 'long', 'latin', 'ending', 'spaces'].map((s) => String(r.by[s] || 0).padEnd(7)).join('')}`);
    if (only) for (const x of report[only].findings.slice(0, 60)) console.log(`\n[${x.signal}] ${x.key}\n   en: ${x.en.slice(0, 100)}\n   ${only}: ${x.text.slice(0, 100)}`);
    else console.log('\nnode scripts-dev/i18n-report.mjs --lang ru   lists what to look at in one language');
  }
}
