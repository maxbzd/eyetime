// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Made-up messages for looking at the Feedback page before there is a real one, and for the tests. Seeded, so the same call always gives the same rows. Nobody wrote any of this.

const DAY = 86_400_000;
function rng(/** @type {number} */ seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const IDEAS = [
  ['Страница паузы белая и слепит вечером. Можно сделать тёмную?', 'blocking', 'тёмная пауза', 'ru'], ['Хочется отложить напоминание о перерыве на час, когда я на созвоне.', 'eyes', 'отложить перерыв', 'ru'],
  ['Было бы здорово видеть недельную цель прямо на новой вкладке.', 'focus', 'цели', 'ru'], ['Add a dark pause page, please. The white one is blinding at night.', 'blocking', 'тёмная пауза', 'en'],
  ['Snooze the break reminder for an hour. I present a lot.', 'eyes', 'отложить перерыв', 'en'], ['Sync my focus goals between my laptop and my desktop.', 'sync', 'синхронизация', 'en'],
  ['Разрешите несколько таймеров под разные проекты, чтобы видеть статистику по каждому.', 'focus', 'проекты', 'ru'], ['Нужен виджет с погодой поменьше, он занимает много места.', 'look', 'внешний вид', 'ru'],
  ['Ein Fokus-Timer, der sich an meinen Kalender hält, wäre klasse.', 'focus', 'календарь', 'de'], ['Could the pause page show my own reason for blocking this site?', 'blocking', 'тёмная пауза', 'en'],
  ['Export the weekly review as an image I can share with my team.', 'stats', 'экспорт', 'en'], ['Добавьте белый шум для фокуса прямо в таймер.', 'focus', 'звук', 'ru'],
];
const PROBLEMS = [
  ['Напоминание о перерыве срабатывает, когда я показываю экран на встрече.', 'eyes', 'отложить перерыв', 'ru'], ['Break reminder fires while I\'m presenting. Please add a way to snooze for an hour.', 'eyes', 'отложить перерыв', 'en'],
  ['После обновления новая вкладка открывается дольше обычного, около секунды.', 'look', 'скорость', 'ru'], ['The pause page keeps showing for a site I allowed 10 minutes ago.', 'blocking', null, 'en'],
  ['Статистика за вчера показывает ноль, хотя я работал весь день.', 'stats', null, 'ru'], ['Синхронизация настроек не подтянула мои режимы на втором компьютере.', 'sync', 'синхронизация', 'ru'],
];
const KUDOS = [
  ['Наконец перестал залипать в новостях. Спасибо!', 'blocking', 'uk'], ['Beautiful new tab. I open it just to look at it.', 'look', 'en'], ['Eye breaks actually work, my headaches are gone.', 'eyes', 'en'], ['Лучший таймер фокуса из всех, что пробовал.', 'focus', 'ru'], ['Danke für die Ruhe im Browser.', 'look', 'de'],
];
const WEEK_TEXT = ['Хотелось бы видеть, сколько часов я реально сфокусирован, а не просто на экране.', 'Мне не хватило напоминания в обед.', 'Nice week, the streak keeps me going.', 'Too many pauses on Monday, I turned some limits off.', 'Лучше, чем обычно, потому что наконец закрыл вкладки с видео.'];
const PMF_TEXT = ['Не хватает синхронизации между устройствами.', 'Хотел бы больше статистики по сайтам.', 'Please keep it this calm, don\'t add more features.', 'Сделайте тёмную страницу паузы.', 'Чуть меньше строгости на старте.'];
const REASONS = ['slow', 'broken', 'not_useful', 'too_strict', 'other_tool', 'temporary', 'other'];
const LEAVE_TEXT = ['Слишком строго блокировал рабочие сайты в первый же день.', 'Tab opened slower than my old one.', 'Перешёл на другой инструмент: там есть мобильное приложение.', 'Only removed it for now, will come back.'];

/** @param {number} now @returns {any[]} newest first, like feedback-store.js */
export function makeDemoFeedback(now, { seed = 7 } = {}) {
  const r = rng(seed), rows = /** @type {any[]} */ ([]);
  const pick = (/** @type {any[]} */ a) => a[Math.floor(r() * a.length)];
  const ago = (/** @type {number} */ maxDays) => now - Math.floor(Math.pow(r(), 1.2) * maxDays * DAY) - Math.floor(r() * 3_600_000);
  const ctx = (/** @type {string} */ lang) => ({ app: pick(['3.8.1', '3.8.1', '3.8.0', '3.7.0']), br: pick(['chrome', 'chrome', 'edge', 'firefox']), os: pick(['win', 'win', 'mac', 'linux']), lang, days: pick(['d0_6', 'd7_13', 'd14_29', 'd14_29', 'd30p', 'd30p']) });
  const add = (/** @type {any} */ row) => rows.push({ id: 0, status: 'new', theme: null, note: null, contact: null, replied_at: null, done_at: null, quote_ok: false, text: '', tags: [], rating: null, can_reply: false, replies: [], ...row });
  for (const [text, area, theme, lang] of [...IDEAS, ...IDEAS.slice(0, 6)]) add({ ts: ago(80), kind: 'idea', via: 'door', tags: [area], text, theme, ctx: ctx(lang), contact: r() < 0.25 ? 'someone@example.com' : null, can_reply: r() < 0.7 });
  for (const [text, area, theme, lang] of [...PROBLEMS, ...PROBLEMS.slice(0, 2)]) add({ ts: ago(80), kind: 'problem', via: 'door', tags: [area], text, theme, ctx: ctx(lang), contact: r() < 0.3 ? 'someone@example.com' : null, can_reply: r() < 0.7 });
  for (const [text, area, lang] of KUDOS) add({ ts: ago(80), kind: 'kudos', via: r() < 0.5 ? 'door' : 'week_review', tags: [area], text, ctx: ctx(lang) });
  for (let i = 0; i < 170; i++) { // sessions: the rating drifts up as the product gets better
    const t = ago(84), ageW = (now - t) / (7 * DAY), p = 0.52 + (12 - ageW) * 0.012, rating = r() < p ? (r() < 0.45 ? 4 : 3) : r() < 0.6 ? 2 : 1;
    const bad = rating <= 2, tags = r() < 0.55 ? [pick(bad ? ['slow', 'hindered', 'unclear', 'timer', 'other'] : ['timer', 'blocking', 'stats', 'design', 'other'])] : [];
    add({ ts: t, kind: 'session', via: 'after_session', rating, tags, text: r() < 0.12 ? pick(WEEK_TEXT) : '', ctx: ctx(pick(['ru', 'en', 'en', 'ru', 'de', 'uk'])) });
  }
  for (let i = 0; i < 46; i++) { const t = ago(84), ageW = (now - t) / (7 * DAY); add({ ts: t, kind: 'week', via: 'week_review', rating: Math.max(1, Math.min(5, Math.round(3.3 + (12 - ageW) * 0.05 + (r() - 0.5) * 3))), text: r() < 0.3 ? pick(WEEK_TEXT) : '', ctx: ctx(pick(['ru', 'en', 'en', 'de'])) }); }
  for (let i = 0; i < 64; i++) { // the question of fit: the people who use it longer love it more
    const c = ctx(pick(['ru', 'ru', 'en', 'en', 'de', 'uk', 'es'])), love = { d0_6: 0.2, d7_13: 0.27, d14_29: 0.38, d30p: 0.5 }[/** @type {'d0_6'} */ (c.days)], x = r();
    const rating = x < love ? 2 : x < love + 0.38 ? 1 : 0;
    add({ ts: ago(80), kind: 'pmf', via: 'pmf', rating, tags: rating === 2 || r() < 0.4 ? [pick(['timer', 'blocking', 'blocking', 'eyes', 'stats', 'newtab', 'other'])] : [], text: r() < 0.35 ? pick(PMF_TEXT) : '', ctx: c });
  }
  for (let i = 0; i < 28; i++) add({ ts: ago(70), kind: 'pause', via: 'pause_page', rating: r() < 0.58 ? 1 : 0, ctx: ctx(pick(['ru', 'en'])) });
  for (let i = 0; i < 24; i++) add({ ts: ago(80), kind: 'leaving', via: 'removal', tags: [pick(REASONS)], text: r() < 0.4 ? pick(LEAVE_TEXT) : '', ctx: ctx(pick(['ru', 'en', 'de'])), contact: r() < 0.12 ? 'someone@example.com' : null });
  rows.sort((a, b) => b.ts - a.ts); rows.forEach((x, i) => { x.id = rows.length - i; });
  // the owner has already worked through some: the oldest are read, a few ideas are done
  for (const x of rows) if (now - x.ts > 30 * DAY) x.status = ['idea', 'problem'].includes(x.kind) && x.theme === 'отложить перерыв' ? 'done' : x.status === 'new' ? 'read' : x.status;
  for (const x of rows) if (x.kind === 'idea' && x.theme === 'тёмная пауза' && x.id % 3 === 0) x.status = 'starred';
  for (const x of rows) if (x.status === 'done') x.done_at = x.ts + 20 * DAY;
  // some of the older ones the owner has already answered, in the extension
  for (const x of rows) if (x.can_reply && now - x.ts > 20 * DAY && x.id % 4 === 0) { x.replied_at = x.ts + 2 * DAY; x.contact = null; x.replies = [{ id: x.id, ts: x.replied_at, text: x.ctx.lang === 'en' ? 'Thank you! This is on the list for the next release.' : 'Спасибо! Это в списке на ближайший релиз.', delivered_at: x.replied_at + 3_600_000 }]; }
  return rows;
}
