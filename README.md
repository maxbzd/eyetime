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

## 🔒 Privacy
100% local: no accounts, no analytics, only domain names are stored. See [PRIVACY.md](PRIVACY.md). Backups (JSON/CSV export + import) are in Settings → Data.

## 🗺️ Roadmap (help wanted!)
- [ ] Full UI localization (EN/RU now in manifest; UI strings next) — add your language in `_locales/`
- [ ] macOS / Linux desktop tracker (currently Windows only)
- [ ] Firefox port and Chrome Web Store / Edge Add-ons listing
- [ ] Blocking presets (social, news, video, gaming) and a schedule (work hours)
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
