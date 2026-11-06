# EyeTime for Windows: what changed

Every `## x.y.z` section becomes the release notes of the tag `desktop-vx.y.z`. Only the lines that start with `- ` are shown in the app, so keep each point short.

## Unreleased

- The service keeps only the rights of the system that it uses (starting the agent in your session, folder checks): it can no longer debug any process, load a driver, read or write files regardless of their rights, take ownership or create tokens, so a flaw in it has less to work with. The setup applies it and stops if it cannot; the Windows test checks it and that a blocked program is still closed
- Locked blocks: an edit that turned an overnight rule (17:00–09:00) into an all-day one on the same days was let through although it opens the morning after the last day; found by a test over 40 000 random edits, fixed, and now proven for every moment of the week
- Ready for `winget install maxbzd.EyeTime`: each release now carries the manifests that winget-pkgs asks for, already checked by winget
- Accessibility: the first test of the window with axe found, and this fixes, sliders without a value (the quiet-hours dial), switches without a name, a language button and a streak chip whose name did not contain the text they show, an achievement button likewise, and headings that skipped a level; the window now passes axe (WCAG 2.1 A and AA) in both languages on every screen
- The window can no longer be made to run script by a name it shows: no inline script is allowed, and names of programs, rules and sites are escaped before they are shown
- The service limits what an unknown program can do with its pipe: a few connections, a few seconds
- A program is closed by force only if it is still the program that was meant (a process number can be given to another program in between)
- State and the hosts file are written so that a power cut leaves the old file or the new one, never half of one
- The installer and the app start Windows tools by their full path, so a file planted beside the installer cannot be run with administrator rights
- The update key can be changed without leaving anybody behind: the app trusts a list of keys (see SECURITY.md)
- The installer and the programs can be signed with a certificate when the project has one (a warning in the build until then)

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
