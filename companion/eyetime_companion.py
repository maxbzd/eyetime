#!/usr/bin/env python3
"""EyeTime desktop companion — optional, read-only, Windows-only (for now).

What it does
  * every second notes which desktop application has the keyboard focus (executable name only)
  * adds that second to today's per-app total, unless you are idle or the app is a browser
    (browsers are measured by the EyeTime extension itself)
  * serves today's totals on http://127.0.0.1:8765/v1/today to the EyeTime extension, protected by a pairing token

What it never does
  * read window titles, keystrokes, clipboard or screen contents
  * close, hide or minimise any window, kill processes, or touch the registry / browser policies
  * accept connections from other machines, or answer web pages (no CORS headers; Origin and Host are checked)

Standard library only. See README.md.
"""
import argparse
import hmac
import json
import os
import secrets
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST, PORT = "127.0.0.1", 8765
IDLE_SECONDS = 120
SAMPLE_INTERVAL = 1.0
FLUSH_INTERVAL = 30
KEEP_DAYS = 400
BROWSERS = {"chrome", "msedge", "firefox", "brave", "opera", "opera_gx", "vivaldi", "arc", "iexplore", "chromium", "yandex", "browser"}
FRIENDLY = {
    "code": "Visual Studio Code", "devenv": "Visual Studio", "idea64": "IntelliJ IDEA", "pycharm64": "PyCharm", "webstorm64": "WebStorm",
    "windowsterminal": "Windows Terminal", "powershell": "PowerShell", "cmd": "Command Prompt", "notepad": "Notepad", "explorer": "File Explorer",
    "figma": "Figma", "slack": "Slack", "discord": "Discord", "telegram": "Telegram", "whatsapp": "WhatsApp", "zoom": "Zoom", "teams": "Microsoft Teams",
    "ms-teams": "Microsoft Teams", "winword": "Word", "excel": "Excel", "powerpnt": "PowerPoint", "outlook": "Outlook", "obsidian": "Obsidian", "notion": "Notion",
    "spotify": "Spotify", "steam": "Steam", "photoshop": "Photoshop", "illustrator": "Illustrator", "blender": "Blender", "obs64": "OBS Studio",
}


def data_dir():
    base = os.environ.get("APPDATA") or os.path.join(os.path.expanduser("~"), ".config")
    path = os.path.join(base, "EyeTime")
    os.makedirs(path, exist_ok=True)
    return path


def friendly_name(exe_stem):
    key = exe_stem.lower()
    return FRIENDLY.get(key) or exe_stem.replace("_", " ").replace("-", " ").strip().title() or "Unknown"


def is_browser(exe_stem):
    return exe_stem.lower() in BROWSERS


class Store:
    """Per-day per-app seconds, persisted as JSON."""

    def __init__(self, path):
        self.path = path
        self.lock = threading.Lock()
        self.days = {}
        self.active_app = None
        self.dirty = False
        self._load()

    def _load(self):
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                raw = json.load(f)
            if isinstance(raw, dict) and isinstance(raw.get("days"), dict):
                self.days = raw["days"]
        except (OSError, ValueError):
            self.days = {}

    def add(self, day, app, seconds):
        with self.lock:
            apps = self.days.setdefault(day, {})
            apps[app] = round(apps.get(app, 0) + seconds, 1)
            self.dirty = True

    def today(self, day):
        with self.lock:
            return dict(self.days.get(day, {}))

    def flush(self):
        with self.lock:
            if not self.dirty:
                return
            keys = sorted(self.days)
            for k in keys[:-KEEP_DAYS]:
                del self.days[k]
            tmp = self.path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump({"version": 1, "days": self.days}, f)
            os.replace(tmp, self.path)
            self.dirty = False


class Tracker(threading.Thread):
    """Samples a backend once per second. Backend: foreground_app() -> exe stem | None, idle_seconds() -> float."""

    def __init__(self, backend, store, clock=time.time, day_fn=lambda: time.strftime("%Y-%m-%d")):
        super().__init__(daemon=True)
        self.backend, self.store, self.clock, self.day_fn = backend, store, clock, day_fn
        self.stop_event = threading.Event()

    def sample(self, elapsed):
        stem = self.backend.foreground_app()
        if not stem or is_browser(stem) or self.backend.idle_seconds() >= IDLE_SECONDS:
            self.store.active_app = None
            return
        name = friendly_name(stem)
        self.store.active_app = name
        self.store.add(self.day_fn(), name, min(elapsed, 5.0))  # cap: a stalled sample must not credit minutes

    def run(self):
        last, last_flush = self.clock(), self.clock()
        while not self.stop_event.wait(SAMPLE_INTERVAL):
            now = self.clock()
            try:
                self.sample(now - last)
            except Exception:  # never crash the tracker on a transient OS error
                pass
            last = now
            if now - last_flush >= FLUSH_INTERVAL:
                self.store.flush()
                last_flush = now
        self.store.flush()


def make_handler(store, token, day_fn=lambda: time.strftime("%Y-%m-%d"), port=None):
    allowed_hosts = {f"{HOST}:{port or PORT}", f"localhost:{port or PORT}"}

    class Handler(BaseHTTPRequestHandler):
        server_version = "EyeTimeCompanion/1"
        protocol_version = "HTTP/1.1"

        def log_message(self, *args):  # silence
            pass

        def _send(self, code, payload=None):
            body = json.dumps(payload if payload is not None else {}).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            # DNS-rebinding guard: only answer requests addressed to the loopback name
            if self.headers.get("Host", "") not in allowed_hosts:
                return self._send(403, {"error": "forbidden"})
            # Browsers always send Origin on cross-site requests; a web page must never reach this API.
            origin = self.headers.get("Origin", "")
            if origin and not origin.startswith(("chrome-extension://", "moz-extension://")):
                return self._send(403, {"error": "forbidden"})
            supplied = self.headers.get("Authorization", "")
            expected = f"Bearer {token}"
            if not hmac.compare_digest(supplied.encode(), expected.encode()):
                return self._send(401, {"error": "unauthorized"})
            if self.path.split("?")[0] == "/v1/today":
                return self._send(200, {"date": day_fn(), "apps": store.today(day_fn()), "activeApp": store.active_app})
            return self._send(404, {"error": "not found"})

        # No POST/PUT/DELETE handlers: the extension only ever reads.
        def do_OPTIONS(self):
            self._send(403, {"error": "forbidden"})

    return Handler


class WindowsBackend:
    """Foreground application via the Win32 API (ctypes). Reads the executable name only."""

    def __init__(self):
        import ctypes
        from ctypes import wintypes
        self.ct, self.wt = ctypes, wintypes
        self.user32, self.kernel32 = ctypes.windll.user32, ctypes.windll.kernel32

        class LASTINPUTINFO(ctypes.Structure):
            _fields_ = [("cbSize", wintypes.UINT), ("dwTime", wintypes.DWORD)]
        self.LASTINPUTINFO = LASTINPUTINFO

    def idle_seconds(self):
        info = self.LASTINPUTINFO()
        info.cbSize = self.ct.sizeof(self.LASTINPUTINFO)
        if not self.user32.GetLastInputInfo(self.ct.byref(info)):
            return 0.0
        return max(0.0, (self.kernel32.GetTickCount() - info.dwTime) / 1000.0)

    def foreground_app(self):
        hwnd = self.user32.GetForegroundWindow()
        if not hwnd:
            return None
        pid = self.wt.DWORD()
        self.user32.GetWindowThreadProcessId(hwnd, self.ct.byref(pid))
        handle = self.kernel32.OpenProcess(0x1000, False, pid.value)  # PROCESS_QUERY_LIMITED_INFORMATION
        if not handle:
            return None
        try:
            size = self.wt.DWORD(1024)
            buf = self.ct.create_unicode_buffer(1024)
            if not self.kernel32.QueryFullProcessImageNameW(handle, 0, buf, self.ct.byref(size)):
                return None
            return os.path.splitext(os.path.basename(buf.value))[0]
        finally:
            self.kernel32.CloseHandle(handle)


def load_token(path, rotate=False):
    if not rotate:
        try:
            with open(path, "r", encoding="utf-8") as f:
                t = f.read().strip()
            if len(t) >= 24:
                return t
        except OSError:
            pass
    t = secrets.token_urlsafe(24)
    with open(path, "w", encoding="utf-8") as f:
        f.write(t)
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass
    return t


def main(argv=None):
    ap = argparse.ArgumentParser(description="EyeTime desktop companion (read-only)")
    ap.add_argument("--show-token", action="store_true", help="print the pairing token and exit")
    ap.add_argument("--new-token", action="store_true", help="generate a new pairing token")
    args = ap.parse_args(argv)

    d = data_dir()
    token = load_token(os.path.join(d, "companion-token.txt"), rotate=args.new_token)
    if args.show_token:
        print(token)
        return 0
    if sys.platform != "win32":
        print("The EyeTime companion currently supports Windows only. See companion/README.md to contribute macOS/Linux backends.")
        return 1

    store = Store(os.path.join(d, "companion-data.json"))
    tracker = Tracker(WindowsBackend(), store)
    tracker.start()
    server = ThreadingHTTPServer((HOST, PORT), make_handler(store, token))
    print("EyeTime companion is running. It only reads which app is in front — nothing else.")
    print(f"Pairing token (paste it into EyeTime → Settings → Tracking): {token}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        tracker.stop_event.set()
        tracker.join(timeout=3)
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
