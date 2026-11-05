# EyeTime for Windows

A desktop app that really closes things: distracting sites (the hosts file) and programs (closed by the system), on a schedule, in
sessions and by limits. The window you see is only a view. The blocking is done by a protected Windows service, so a block holds
when the window is closed, when the app crashes, and after a restart.

macOS and Linux are not part of this yet.

## The pieces

| Folder | What it is |
|---|---|
| `core/` | Pure logic, no Windows in it: the rules engine, schedules, usage and limits, the hosts file writer, the unblock challenges, the PIN, emergency keys, tamper guards, the message format. 59 unit tests. |
| `helper/` | `eyetime-helper.exe`. **The service** (`--service`) decides and carries out blocks; **the agent** (`--agent`, started by the service inside your own session) sees the foreground window and asks programs to close; **the native host** (`--native-host`) is the end of the browser extension's channel. `src/supervisor.rs` is the brain and is tested against a pretend computer (22 tests); `src/os_windows.rs` is the real one. |
| `app/src-tauri/` | `eyetime.exe`: the window (Tauri 2). Frameless, lives in the tray, starts with Windows, one instance. Talks to the service over a named pipe. |
| `prototype/` | The screens (HTML, CSS, JS). `bridge.js` connects them to the service. Opened in a plain browser they run on demo data. |
| `installer/` | `eyetime-setup.exe`: the animated installer and uninstaller, with the program files inside. |
| `extension/` | `EyeTime Bridge`, a small Chrome / Edge / Brave extension. It tells the service which page is in front and closes pages the service says are closed: single pages, words in the address or title, exceptions, and "everything but my list". It decides nothing itself, and closes nothing when the service is not there. Talks to the service through the helper's native host (`eyetime-helper.exe`, started by the browser). |
| `tests/` | `e2e_real.cjs` drives the screens against the real service logic on a pretend computer. |

## How a block works

1. The screens keep their setup in the same eight keys as always (`et-rules`, `et-items`, `et-limits`, `et-auto`, `et-cats`, `et-kw`, `et-ex`, `et-protect`). Every change goes to the service, which keeps the real copy. The window starts from the service's copy.
2. Every two seconds the service asks the engine (`core::engine::decide`) what is closed right now, from the rules that are active, the running session, the limits that were used up and the grants you earned.
3. Sites: one managed block in the hosts file (every name checked first, nothing else touched, the original file kept once). Programs: asked to close politely (so they can offer to save), and closed by force after 15 seconds (8 in a frozen session). A short list of system programs and EyeTime itself is never closed, whatever any list says.
4. A locked block cannot be ended, paused or loosened. Not from the window, not by editing the setup: the service refuses.

## Strictness

| | Can leave | Break | Edit while running |
|---|---|---|---|
| **Normal** | any time | any time | yes |
| **Timeout** | after the chosen challenge (hold, wait, type, sum, partner code) | with the challenge | yes, with the PIN if one is set |
| **Locked** | only with an emergency key | no | only stronger, never weaker |
| **Frozen** | only with an emergency key, 8 hours at most | no | only stronger |

Frozen closes everything except Windows itself and EyeTime, and also Task Manager, Settings, Registry editor and similar tools.

## Protections

- **Always a way out.** The service refuses a locked session or rule unless at least one emergency key a week exists, and refuses a frozen rule longer than 8 hours. Emergency keys are counted by the service (per week and per month), never by the window. Using one lifts everything for 30 minutes and resets your streak.
- **Warnings before anything that cannot be undone.** Starting a locked or frozen session, and keeping a locked rule, explains in plain words what will happen, how many keys are left, that unsaved work can be lost, and needs an explicit tick.
- **Closing is polite first.** Programs are asked to close like a click on their X, so they can offer to save.
- **App PIN** (4 to 12 digits, salted and stretched, three tries then a growing lockout). Asked before anything is loosened.
- **Clock cheating.** While a locked block runs, time is counted by the computer's own interrupt clock, which counts sleep and cannot be set. Moving the system clock changes nothing and is shown as a warning.
- **Restarts.** A running session survives a restart. The clock cannot be rolled back across one.
- **Hosts file watch.** Edits to the block are undone within two seconds.
- **Private windows** (Incognito, InPrivate) are closed while a block runs. **VPN and proxy tools** are closed. Firefox's own DNS is switched off by policy so that it cannot step around the hosts file.
- **The service guards itself.** Stopping it is refused during a locked block (and, with the watchdog on, without permission). It restarts by itself if killed. It also starts in Safe Mode. Uninstalling needs the same permission (Settings → Allow uninstalling), and never happens during a locked block.
- **Always allowed list** wins over every block, except in a frozen session.

## What this cannot do (so you are not surprised)

- A person with administrator rights and enough determination can always get around a program that runs on their own computer (boot to recovery, disable the service from outside). The guards raise the effort high enough to stop impulses, not a determined attack.
- "Block everything except my list" works for programs. For websites it needs the browser extension (the hosts file cannot invert). Without the extension, allow-only closes the browsers that are not on your list.
- **The extension is loaded by hand, once.** Browsers refuse to install an extension from outside their store on a personal computer. Settings → Browser extension has buttons for the extension's folder and the browser's extensions page: switch on Developer mode, Load unpacked, pick the folder. (Publishing it in the Chrome and Edge stores would remove this step.) Firefox is not supported yet.
- A browser with its own encrypted DNS, or a site reached by an address that is not on the list, can slip through the hosts file. The keyword and exception features need the extension.
- Muting sounds is not done yet on Windows.
- Home shows dashes until something has been counted (no invented perfect score). The rule cards under "Rules" on Home are still sample data. Do Not Disturb turns off pop-up notifications.
- Needs the Microsoft WebView2 runtime (part of Windows 11 and of up-to-date Windows 10; the installer and the window both use it).
- Some antivirus programs warn when a program edits the hosts file. That is what blocking sites at system level means.
- The installer is not signed. Windows SmartScreen will warn about an unknown publisher until it is.
- **Checked on real Windows by the CI.** Each push builds on a Windows machine, installs the installer silently, and checks the service, the pipe, the hosts file, the window (clicked through over its debugging port, with pictures), the native host, and the uninstall. It has not been run on every Windows version or with every antivirus, so try it in a virtual machine first.

## If you ever get stuck

1. Use an emergency key (Rules → Protection shows how many are left). It lifts everything for 30 minutes.
2. A frozen session ends by itself after at most 8 hours, a locked one at its end time.
3. If the window does not open or the service is broken: in an administrator Command Prompt run
   `sc config EyeTimeHelper start= disabled`, restart the computer, then run
   `"C:\Program Files\EyeTime\eyetime-helper.exe" --cleanup` (this removes the block from the hosts file and the policies).
   The original hosts file is also kept at `C:\ProgramData\EyeTime\hosts.original`.

**По-русски, если застряли:** аварийный ключ снимает всё на 30 минут; замороженная сессия заканчивается сама не позже чем через 8 часов.
Если окно не открывается: в командной строке от администратора `sc config EyeTimeHelper start= disabled`, перезагрузка, потом
`"C:\Program Files\EyeTime\eyetime-helper.exe" --cleanup`. Исходный файл hosts лежит в `C:\ProgramData\EyeTime\hosts.original`.

## Building

```
cd desktop
cargo test -p eyetime-core -p eyetime-helper        # logic, any OS
cargo build -p eyetime-helper --bin eyetime-sim     # the simulator
./target/debug/eyetime-sim prototype 8131 &         # then: node tests/e2e_real.cjs
```

On Windows (the CI does this, see `.github/workflows/desktop.yml`):

```
cargo build --release -p eyetime-helper -p eyetime
$env:EYETIME_PAYLOAD = "<folder with eyetime.exe and eyetime-helper.exe>"
cargo build --release -p eyetime-setup              # EyeTime-Setup.exe with the files inside
```
