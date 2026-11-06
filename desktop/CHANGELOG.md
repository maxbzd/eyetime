# EyeTime for Windows: what changed

Every `## x.y.z` section becomes the release notes of the tag `desktop-vx.y.z`. Only the lines that start with `- ` are shown in the app, so keep each point short.

## 0.2.0

- The app updates itself: a glowing chip appears when a new version is out, and one click installs it
- Updates only install at a quiet moment, never in the middle of a session or a locked block
- Every download is checked against its SHA-256 fingerprint before it is run
- Insights and Profile show your real numbers: screen time, switches, focus hours, sessions and streaks
- Over 3 400 app and site logos, and a search that finds them while you add an app or a site
- A bigger list of well-known sites and programs, so that a name like Pinterest or Epic Games really closes it
- Automation: when a program comes to the front, a normal session can start by itself
- A quiet Windows notification for eye breaks and a note before bedtime
- Safer: the service decides who may ask it for what, the data folder is closed to ordinary users, PINs are stored with Argon2id, and updates must carry the release signature

## 0.1.0

- First version: blocking engine, rules, protected helper, browser extension
