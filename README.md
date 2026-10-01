# ⚡ EyeTime OS — Personal Attention Guardian & Deep Work System

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-orange.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Chrome%20%7C%20Windows%2010%2F11-blue.svg)]()
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20Local--First-brightgreen.svg)]()
[![UI Theme](https://img.shields.io/badge/Design-Fintrixity%20Neo--Dark-FF5E0E.svg)]()

**A local-first, distraction-free productivity operating system.**  
*Combines an interactive Chromium Cockpit (Fintrixity Neo-Dark Glass) and a background Windows Sentinel daemon.*

[English](README.md) • [Русская версия (Документация на русском)](README_RU.md)

</div>

---

## 💡 Why EyeTime OS?

Most website blockers fail because:
1. They feel restrictive rather than empowering.
2. They are trivially bypassed by opening another browser or an incognito window.
3. They lack flow-state triggers and acoustic feedback.

**EyeTime OS fixes this** by turning productivity into a tactile, high-agency cockpit with soundscapes, an automated 100% Grayscale doomscroll interceptor, and a background Windows sentinel.

---

## ✨ Core Superpowers

### 1. 🛡️ Daily Flow Cockpit (New Tab)
* **Hero Focus Blocks**: Presets for 25m, 50m, or 90m deep work sessions.
* **Procedural Tibetan Singing Bowl Gong**: Authentic ~196 Hz acoustic resonance synthesized via the Web Audio API without heavy external audio files. Resonates smoothly for 4.8 seconds to prime your nervous system for flow.
* **🎧 Seamless Endel Focus Integration**: Launching focus automatically opens your personalized focus soundscape at `https://app.endel.io/player/focus` in an active tab while the gong rings out in the background.
* **Daily Goals & Counters**: Track custom daily metrics (e.g. Focus Sessions, Key Tasks Closed, Pages Read) with live plus/minus steppers.
* **Mental Scratchpad**: Instant thought dumping box to park intrusive thoughts without losing your train of thought.
* **Bedtime Countdown**: Live countdown to your sleep schedule, automatically transitioning the interface into night relaxation mode.

### 2. 🩻 Anti-Doomscroll (Shorts / Reels / Clips Killer)
* **Platforms Protected**: YouTube Shorts, Instagram Reels, VK Clips, and TikTok.
* **What happens after 60 seconds of doomscrolling**:
  1. The entire screen smoothly desaturates into **100% Black & White (Grayscale)**.
  2. All videos are instantly paused.
  3. A high-contrast intervention modal appears: *"You've been caught doomscrolling. Return to your primary task!"* with one-click exits to focus or Endel.

### 3. 📊 Full-Page Analytics & 7-Day Matrix
* **Honest 7-Day Calendar**: True Monday–Sunday matrix showing daily completion and streak status.
* **24-Hour Activity Curve**: Visual hourly breakdown of your focus hours and peaks.
* **Category Breakdown**: Dynamic donut chart categorizing time into AI Tools (`#FF5E0E`), Development (`#818CF8`), Communication, Media, and System apps.

### 4. 💻 Windows Desktop Sentinel (Python 3 Win32)
* **Runs 24/7 in Windows System Tray**: Resides silently down by the clock, consuming only ~4.9 MB of RAM.
* **Accurate Process Detection**: Uses `QueryFullProcessImageNameW` (0x1000) for cross-integrity process tracking (VS Code, Chrome, Telegram, Figma, etc.).
* **Anti-Bypass Guard**: Closes unauthorized secondary browsers (Edge, Firefox, Brave, Opera, Tor) and blocks Chrome Incognito mode.

---

## 🚀 1-Click Installation (Windows)

We created a **single-click installer** so anyone can set up the entire system in under 60 seconds:

1. Clone or download this repository:
   ```bash
   git clone https://github.com/maxbzd/eyetime.git
   ```
2. Double-click **`INSTALL.bat`** in the project folder.
   - It will automatically set up the Windows System Tray sentinel.
   - It will copy the extension folder path to your clipboard.
   - It will open `chrome://extensions/` for you.
3. In Chrome:
   - Toggle **Developer mode** on (top-right).
   - Click **Load unpacked** (top-left) and press `Ctrl + V` then Enter.
4. **Interactive Onboarding Wizard**:
   - The first time you launch, EyeTime greets you with a guided setup where you choose your bedtime, set your custom daily goals, test the Tibetan gong, and personalize your experience.

---

## 🆕 What's new in 1.1
- **Habit tracker**: your own habits, challenge length from 7 to 365 days, streaks, day grid.
- **Work hours**: pick days and hours; distracting sites are blocked on schedule (strict mode or a short "allow for 5 min" pass).
- **Blocking presets**: toggle whole categories, add your own sites, keep an allow-list.
- **Toolbar badge** with today's screen time.
- English + Russian interface, JSON/CSV export and import, fixed day-boundary bug for non-UTC time zones.

## 🧩 Build your own new tab
Click **Customize** on the new tab: drag widgets (or use the arrows), **drag a widget's right edge to resize it**, add / duplicate / remove widgets, and restyle everything. `Ctrl+Z` / `Ctrl+Shift+Z` undo and redo every change. Rows always stay tidy — whatever you move, each row is stretched to the full width.
- **8 ready-made sets**: Classic, Minimal, Deep work, Developer, Student, Zen, Morning ritual, Control panel — plus export / import of your own layout as a file.
- **Screen profiles**: keep several screens (e.g. *Work* and *Home*) and switch from the header — or let EyeTime switch automatically with your **work-hours schedule**.
- **29 widgets**: Focus Block, Leak guard, Habits, Tasks, Thought parking, Goals, Daily focus chart, Clock & greeting, Time today, Eye rest, Daily rules, Quick links, Notes, Search, Countdown, Pomodoro, To-do list, Quote of the day, Calendar, Time progress, Water, Breathing, World time, Counter, Motto, Stopwatch, **Most visited**, **Bookmarks** and **Weather** (the last three ask for an optional permission only when you add them).
- **Appearance**: 12 accent colors + custom color, 8 backgrounds + your own photo (blur / dimming), 6 card styles, corner radius, 4 fonts, interface size, page width, row stretching, density, minimal header, animations (respects "reduce motion"). The accent color and font are applied to every EyeTime page. Any widget can also get its own accent color or a transparent background.

## 🔒 Privacy
100% local: no accounts, no analytics, only domain names are stored. See [PRIVACY.md](PRIVACY.md). Backups (JSON/CSV export + import) are in Settings → Data.

## 🗺️ Roadmap (help wanted!)
- [x] English + Russian UI (auto-detected from browser language, switch in Settings). Add a language: copy `assets/i18n_en.js`, translate the values, register it in `assets/i18n.js`
- [ ] More languages (ES, DE, PT, ZH, UK…)
- [ ] macOS / Linux desktop tracker (currently Windows only)
- [ ] Firefox port and Chrome Web Store / Edge Add-ons listing
- [x] Blocking presets (social, video, forums, news, games, shopping, messengers) and a work-hours schedule
- [x] Customizable habit tracker / N-day challenge
- [ ] Weekly report

Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## 🎨 Design System: Fintrixity Neo-Dark Glass
* **Obsidian Base**: `#0B0C10` with top radial orange glow.
* **Specular Highlight Bento Cards**: Dual-layer reflections (`rgba(255, 255, 255, 0.28)` specular edge).
* **Radiant Fire Orange**: `#FF5E0E` gradients and glowing interactive states.
* **Tabular Figures**: High-contrast typography optimized for rapid scanning.

---

## 🔒 100% Privacy & Local-First
No analytics trackers, no cloud accounts, and no data telemetry. All metrics and timestamps remain strictly on your own local hard drive.

---

## 📄 License
This project is open-source under the [MIT License](LICENSE). Contributions, forks, and feature suggestions are welcome!
