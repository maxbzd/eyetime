# EyeTime desktop companion (optional)

Adds **time in desktop apps** (VS Code, Figma, Slack…) to your EyeTime statistics. Browsers are measured by the extension itself, so they are skipped here.

> **Windows only for now.** macOS / Linux backends are welcome — see [Contributing a backend](#contributing-a-backend).

## Privacy & safety — what it does and does not do

| It does | It never does |
|---|---|
| Notes the **executable name** of the app in front, once per second | Read window titles, keystrokes, clipboard or screen contents |
| Skips browsers and idle time (2 min without input) | Close, hide or minimise windows, kill processes |
| Serves today's per-app seconds on `127.0.0.1:8765/v1/today` | Touch the registry, browser policies or other software |
| Requires a secret **pairing token** (`Authorization: Bearer …`) | Accept connections from other machines or web pages (no CORS; `Origin` and `Host` are checked) |
| Stores totals in `%APPDATA%\EyeTime\companion-data.json` | Send anything over the internet |

The code is one readable file (`eyetime_companion.py`, standard library only) with tests (`test_companion.py`).

## Set up

1. Install [Python 3.9+](https://www.python.org/downloads/) (tick *Add python.exe to PATH*).
2. Double-click **`run.bat`**. A window shows your **pairing token**.
3. In your browser: EyeTime → **Settings → Tracking → Desktop companion**, switch it on (the browser asks for permission to reach `127.0.0.1:8765`) and paste the token.
4. Optional: double-click **`install_autostart.bat`** to start it when you sign in (adds a shortcut to your Startup folder; **`uninstall_autostart.bat`** removes it).

Show the token again: `python eyetime_companion.py --show-token` · new token: `--new-token`.

## Uninstall

Close the window (or end `python.exe` in Task Manager), run `uninstall_autostart.bat`, delete this folder and `%APPDATA%\EyeTime`.

## Contributing a backend

A backend is any object with two methods:

```python
class Backend:
    def foreground_app(self) -> str | None: ...   # executable name without extension, e.g. "figma"
    def idle_seconds(self) -> float: ...          # seconds since the last keyboard/mouse input
```

`WindowsBackend` in `eyetime_companion.py` is the reference (about 30 lines). Ideas: macOS (`NSWorkspace.frontmostApplication` + `CGEventSourceSecondsSinceLastEventType`), Linux/X11 (`_NET_ACTIVE_WINDOW` + `XScreenSaver` idle). Keep the safety contract above: read-only, no titles.

## Tests

```bash
cd companion && python -m unittest -v test_companion
```
