# Store listing copy (Chrome Web Store · Edge Add-ons · Firefox AMO)

Everything below is ready to paste. Screenshots: `store/screenshots/` (1280×800). Privacy policy URL: `https://maxbzd.github.io/eyetime/privacy.html` (published by `.github/workflows/pages.yml`; the same text lives in `PRIVACY.md`).

## Name
EyeTime — Focus, Screen Time & Eye Care

## Summary (≤ 132 chars)
EN: Focus sessions, gentle pauses before distracting sites, honest screen-time stats and eye care. Free, open source, 100% local.
RU: Фокус-сессии, мягкая пауза перед отвлекающими сайтами, честная статистика и забота о глазах. Бесплатно, открытый код, всё локально.

## Description (EN)
EyeTime helps you do deep work without fighting your browser. It is free, open source and keeps everything on your device.

FOCUS IN ONE CLICK
Start a timed session from the toolbar, the new tab, Alt+Shift+F or the command palette (Ctrl/Cmd+K). Pick a mode — Deep work, Sprint, Study — add five more minutes when you are in the flow, and let the break timer do its job. Distracting sites pause until the session ends and open again by themselves. Strict mode is there when you really mean it.

BLOCKING THAT RESPECTS YOU
Choose categories (social, video, forums, news, games, shopping, messengers) or add your own sites. A short breathing pause with your own if–then plan beats a lockout. Add work hours, daily limits per site and a daily "distraction budget".

HONEST STATISTICS
Time per site, hour and day; a day timeline with your focus sessions; a calendar; estimate accuracy (planned vs. actual); your best focus hours; a weekly review and a shareable "My week" picture. Re-classify any site as productive, neutral or distracting with one tap. Export CSV or a Markdown journal.

A CALM NEW TAB
Clock, focus card with a daily goal, tasks with priorities (type "Report 14:30 45m !" and it understands), habits, notes and quick links. Eleven looks, any accent colour, 17 backdrops, real ambient sounds. Light and dark. Switch it off any time.

LOOK AFTER YOUR EYES
20-20-20 reminders based on real, active screen time and a guided 20-second break page.

SHORT-VIDEO GUARD
After a limit of Shorts / Reels / TikTok / VK Clips scrolling, the page goes grayscale and pauses.

PRIVATE BY DESIGN
No account. No servers. No analytics. Only domain names and seconds are stored — on your device. Optional settings sync uses your browser's own sync and never includes your history. The code is open source (MIT): https://github.com/maxbzd/eyetime

English, Russian, Spanish, German, French and Portuguese (Spanish, German, French and Portuguese are machine-translated and reviewed; corrections are welcome on GitHub).

## Описание (RU)
EyeTime помогает работать глубоко, а не бороться с браузером. Бесплатно, открытый код, все данные остаются на вашем устройстве.

ФОКУС В ОДНО НАЖАТИЕ
Запускайте сессию с панели, с новой вкладки, по Alt+Shift+F или из палитры команд (Ctrl/Cmd+K). Выберите режим — Глубокая работа, Спринт, Учёба — добавьте пять минут, если вошли в поток, и пусть таймер отдыха сделает своё дело. Отвлекающие сайты ставятся на паузу до конца сессии и открываются сами. Строгий режим — когда вы действительно серьёзны.

БЛОКИРОВКА С УВАЖЕНИЕМ
Выберите категории (соцсети, видео, форумы, новости, игры, покупки, мессенджеры) или добавьте свои сайты. Короткая пауза на вдох с вашим планом «если — то» лучше запрета. Рабочие часы, дневные лимиты по сайтам и дневной «бюджет отвлечений».

ЧЕСТНАЯ СТАТИСТИКА
Время по сайтам, часам и дням; таймлайн дня с фокус-сессиями; календарь; точность оценок (план и факт); лучшие часы фокуса; недельный обзор и картинка «Моя неделя». Меняйте тип сайта одним нажатием. Экспорт CSV и дневника в Markdown.

СПОКОЙНАЯ НОВАЯ ВКЛАДКА
Часы, карточка фокуса с дневной целью, задачи с приоритетами (напишите «Отчёт 14:30 45м !» — поймёт), привычки, заметки и быстрые ссылки. Одиннадцать стилей, любой акцентный цвет, 17 фонов, настоящие фоновые звуки. Светлая и тёмная темы. Можно отключить.

ЗАБОТА О ГЛАЗАХ
Напоминания 20-20-20 по реальному экранному времени и страница перерыва на 20 секунд.

ЗАЩИТА ОТ КОРОТКИХ ВИДЕО
После лимита прокрутки Shorts / Reels / TikTok / VK Клипов страница становится чёрно-белой и ставится на паузу.

ПРИВАТНОСТЬ ПО УМОЛЧАНИЮ
Без аккаунта, серверов и аналитики. Хранятся только домены и секунды — на вашем устройстве. Необязательная синхронизация настроек идёт через встроенную синхронизацию браузера и не включает историю. Открытый код (MIT): https://github.com/maxbzd/eyetime

## Single purpose (Chrome Web Store field)
Help users focus and manage screen time: track time per site, pause distracting sites during focus sessions, and remind users to rest their eyes.

## Permission justifications (Chrome Web Store → Privacy practices)
| Permission | Justification to paste |
|---|---|
| `storage` | Saves the user's settings, tasks and per-day statistics on their device. |
| `tabs` | Reads the address of the active tab so time can be attributed to a site and the pause page can be shown for the right site. Addresses are reduced to the domain immediately. |
| `webNavigation` | Detects a navigation to a distracting site early enough to show the pause page before the site loads. |
| `idle` | Stops counting time when the user is away from the computer. |
| `alarms` | Wakes the extension for the focus timer, break timer and reminders without a background loop. |
| `notifications` | Eye-break, session-complete and "time to focus" reminders the user asked for. |
| `contextMenus` | Right-click menu to classify or block the current site. |
| `offscreen` | Plays the soft session start/end sound and the optional ambient sound (service workers cannot play audio). |
| `favicon` | Shows site icons from the browser's own cache; nothing is downloaded. |
| Host access: youtube.com, instagram.com, tiktok.com, vk.com, vkvideo.ru | Only to limit short-video scrolling and to hide YouTube recommendations, comments and the home feed when the user turns those options on. No data is read or sent. |
| Optional: `127.0.0.1:8765` | Only when the user enables the desktop companion app on their own computer. |
| Optional host access: `https://*/*` (declared as *optional*, never granted at install) | Used only if the user subscribes to their own calendar link (Settings → Data & privacy): the browser then asks for access to that single address, the extension downloads that one .ics file once an hour and keeps the next 14 days of events on the device. The permission is withdrawn when the user unsubscribes. Nothing is sent anywhere. |
| `chrome.storage.sync` (covered by `storage`) | Optional, off by default: syncs settings (never history) through the browser's own sync. |

Remote code: **none** (all code is in the package). Data usage: **no user data is collected, transmitted or sold**; certify all three limited-use statements.

## Firefox AMO notes for the reviewer
- No build step, no minification, no obfuscation: the package is the source. `scripts-dev/pack.mjs` only copies files and adapts `manifest.json` (Firefox `background.scripts`, gecko id `eyetime@maxbzd.github.io`).
- `data_collection_permissions: { required: ['none'] }`.
- Ambient sounds load `src/audio/*.ogg` (CC0 recordings, credits in `src/audio/CREDITS.txt`); `offscreen` is a Chrome-only API and is feature-detected (the Firefox event page plays audio directly).
- Third-party code: Lucide icons (ISC, `src/ui/LICENSE-Lucide.txt`) and bundled fonts (licenses in `src/ui/fonts`).

## Screenshots (captions)
1. `1-home.png` — A calm new tab with a focus card, tasks and habits
2. `2-focus.png` — A running focus session and the pause page
3. `3-insights.png` — Honest statistics and a weekly review
4. `4-home-dark.png` — Dark look
5. `7-looks.png` — Eleven looks, each in light and dark
6. `11-palette.png` — Command palette (Ctrl/Cmd+K)
7. `12-timeline.png` — A day in detail: hours and focus sessions
8. `13-week-card.png` — A shareable "My week" card (totals only)

## Keywords
focus, pomodoro, website blocker, screen time, productivity, eye strain, 20-20-20, distraction, new tab, habits, time tracker
