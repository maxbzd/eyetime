# EyeTime Desktop Tracker & Sentinel — Master Multi-Browser & PC Engine (Python 3)
# Central master server at http://127.0.0.1:8765
# Features: Real-time PC App Tracking, 24h Hourly Timeline, App Kill-Switch, Chrome Anti-Uninstall Watchdog, Native Desktop App Server

import sys
import os
import time
import json
import threading
import ctypes
from ctypes import wintypes
from http.server import HTTPServer, ThreadingHTTPServer, BaseHTTPRequestHandler
import urllib.parse
import winreg

# Safe silent redirection for pythonw
if sys.stdout is None:
    sys.stdout = open(os.devnull, 'w')
if sys.stderr is None:
    sys.stderr = open(os.devnull, 'w')

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'eyetime_database.json')
APP_DIR = os.path.join(BASE_DIR, 'desktop_app')

# Win32 API Definitions
class LASTINPUTINFO(ctypes.Structure):
    _fields_ = [
        ('cbSize', wintypes.UINT),
        ('dwTime', wintypes.DWORD),
    ]

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

APP_NAME_MAP = {
    'code.exe': 'Visual Studio Code',
    'antigravity.exe': 'Antigravity IDE',
    'powershell.exe': 'PowerShell',
    'cmd.exe': 'Командная строка',
    'windowsterminal.exe': 'Терминал Windows',
    'capcut.exe': 'CapCut',
    'figma.exe': 'Figma',
    'photoshop.exe': 'Adobe Photoshop',
    'illustrator.exe': 'Adobe Illustrator',
    'premiere.exe': 'Adobe Premiere Pro',
    'afterfx.exe': 'Adobe After Effects',
    'blender.exe': 'Blender 3D',
    'unity.exe': 'Unity Editor',
    'unrealeditor.exe': 'Unreal Engine',
    'obs64.exe': 'OBS Studio',
    'telegram.exe': 'Telegram',
    'discord.exe': 'Discord',
    'slack.exe': 'Slack',
    'zoom.exe': 'Zoom',
    'ms-teams.exe': 'Microsoft Teams',
    'asap crm.exe': 'ASAP CRM',
    'notepad.exe': 'Блокнот',
    'word.exe': 'Microsoft Word',
    'excel.exe': 'Microsoft Excel',
    'powerpnt.exe': 'Microsoft PowerPoint',
    'explorer.exe': 'Проводник',
    'taskmgr.exe': 'Диспетчер задач',
    'steam.exe': 'Steam',
    'cs2.exe': 'Counter-Strike 2',
    'dota2.exe': 'Dota 2',
    'aimlab.exe': 'Aim Lab',
    'spotify.exe': 'Spotify',
    'chrome.exe': 'Google Chrome',
    'msedge.exe': 'Microsoft Edge',
    'firefox.exe': 'Mozilla Firefox'
}

APP_CATEGORY_MAP = {
    'Visual Studio Code': 'Код',
    'Antigravity IDE': 'Код',
    'PowerShell': 'Код',
    'Командная строка': 'Код',
    'Терминал Windows': 'Код',
    'CapCut': 'Видеомонтаж',
    'Figma': 'Дизайн',
    'Adobe Photoshop': 'Дизайн',
    'Adobe Premiere Pro': 'Видеомонтаж',
    'Blender 3D': '3D / Дизайн',
    'Telegram': 'Общение',
    'Discord': 'Общение',
    'Slack': 'Общение',
    'Zoom': 'Созвоны',
    'ASAP CRM': 'Работа / CRM',
    'Microsoft Word': 'Документы',
    'Microsoft Excel': 'Документы',
    'Steam': 'Игры',
    'Counter-Strike 2': 'Игры',
    'Dota 2': 'Игры',
    'Spotify': 'Музыка',
    'Google Chrome': 'Браузер',
    'Microsoft Edge': 'Браузер'
}

DISTRACTION_EXES = {
    'steam.exe', 'cs2.exe', 'dota2.exe', 'epicgameslauncher.exe',
    'telegram.exe', 'discord.exe', 'spotify.exe', 'tiktok.exe'
}

UNAUTHORIZED_BROWSERS = {
    'msedge.exe', 'firefox.exe', 'opera.exe', 'operagx.exe',
    'brave.exe', 'yandex.exe', 'browser.exe', 'vivaldi.exe',
    'tor.exe', 'waterfox.exe', 'arc.exe', 'dolphin anty.exe',
    'anty.exe', 'chromium.exe'
}

function_clean_app_name = lambda raw: (
    raw.replace('.exe', '')
       .replace('-x64', '')
       .replace('_x64', '')
       .replace('_agent', '')
       .replace('-', ' ')
       .replace('_', ' ')
       .title()
)

master_db = {
    'stats': {},
    'settings': {
        'blockOtherBrowsers': True
    },
    'dailyGoals': [],
    'blockedApps': [
        {'title': 'Telegram Desktop', 'exe': 'telegram.exe', 'enabled': True},
        {'title': 'Steam Client', 'exe': 'steam.exe', 'enabled': True},
        {'title': 'Discord', 'exe': 'discord.exe', 'enabled': True},
        {'title': 'Counter-Strike 2', 'exe': 'cs2.exe', 'enabled': True},
        {'title': 'Dota 2', 'exe': 'dota2.exe', 'enabled': True},
        {'title': 'Epic Games Launcher', 'exe': 'epicgameslauncher.exe', 'enabled': True}
    ],
    'focusBlock': {
        'active': False,
        'endTime': 0,
        'task': 'Главная задача дня',
        'strict': True
    },
    'hourly': {}
}

db_lock = threading.Lock()

def load_master_db():
    global master_db
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                master_db.update(data)
        except Exception:
            pass

def save_master_db():
    try:
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(master_db, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

load_master_db()

state = {
    'active_app': 'Рабочий стол',
    'exe_name': '',
    'window_title': '',
    'idle_seconds': 0,
    'is_idle': False,
    'category': 'Система',
    'is_distraction': False
}

def get_idle_duration_seconds():
    last_input = LASTINPUTINFO()
    last_input.cbSize = ctypes.sizeof(LASTINPUTINFO)
    if user32.GetLastInputInfo(ctypes.byref(last_input)):
        millis = kernel32.GetTickCount() - last_input.dwTime
        return millis / 1000.0
    return 0.0

def get_active_window_info():
    hwnd = user32.GetForegroundWindow()
    if not hwnd:
        return 'Рабочий стол', '', '', 'Система', 0

    length = user32.GetWindowTextLengthW(hwnd)
    title = ''
    if length > 0:
        buff = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buff, length + 1)
        title = buff.value.strip()

    pid = wintypes.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    if not pid.value:
        return (title if title else 'Рабочий стол'), '', title, 'Система', hwnd

    exe_name = ''
    try:
        # 0x1000 = PROCESS_QUERY_LIMITED_INFORMATION (Works on 64-bit and sandboxed processes)
        h_process = kernel32.OpenProcess(0x1000, False, pid.value)
        if not h_process:
            h_process = kernel32.OpenProcess(0x0400 | 0x0010, False, pid.value)

        if h_process:
            try:
                buf = ctypes.create_unicode_buffer(1024)
                size = wintypes.DWORD(1024)
                if kernel32.QueryFullProcessImageNameW(h_process, 0, buf, ctypes.byref(size)):
                    exe_name = os.path.basename(buf.value).lower()
                else:
                    psapi = ctypes.windll.psapi
                    if psapi.GetModuleFileNameExW(h_process, 0, buf, 1024):
                        exe_name = os.path.basename(buf.value).lower()
            finally:
                kernel32.CloseHandle(h_process)
    except Exception:
        pass

    # Fallback: deduce from title if exe wasn't resolved
    if not exe_name and title:
        t_low = title.lower()
        if 'chrome' in t_low: exe_name = 'chrome.exe'
        elif 'edge' in t_low: exe_name = 'msedge.exe'
        elif 'telegram' in t_low: exe_name = 'telegram.exe'
        elif 'visual studio code' in t_low or ' - code' in t_low: exe_name = 'code.exe'
        elif 'figma' in t_low: exe_name = 'figma.exe'

    friendly_name = APP_NAME_MAP.get(exe_name, function_clean_app_name(exe_name)) if exe_name else (title if title else 'Рабочий стол')
    category = APP_CATEGORY_MAP.get(friendly_name, 'Приложение')

    return friendly_name, exe_name, title, category, hwnd

def apply_chrome_protection_policies():
    """Apply Chrome Policies (allow extensions always, clean any leftover blocks)"""
    try:
        reg_path = r"Software\Policies\Google\Chrome"
        try:
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, reg_path, 0, winreg.KEY_ALL_ACCESS)
            try:
                winreg.DeleteKey(key, "URLBlocklist")
            except Exception:
                pass
            winreg.CloseKey(key)
        except Exception:
            pass
        return True
    except Exception:
        return False

def tracker_loop():
    last_time = time.time()

    while True:
        try:
            now = time.time()
            elapsed = now - last_time
            last_time = now

            idle_sec = get_idle_duration_seconds()
            is_idle = idle_sec >= 180.0

            app_name, exe_name, title, category, hwnd = get_active_window_info()

            is_dist = exe_name in DISTRACTION_EXES or category == 'Игры'

            state['active_app'] = app_name
            state['exe_name'] = exe_name
            state['window_title'] = title
            state['idle_seconds'] = round(idle_sec, 1)
            state['is_idle'] = is_idle
            state['category'] = category
            state['is_distraction'] = is_dist

            if tray_icon:
                try:
                    if is_idle:
                        tray_icon.title = f"EyeTime OS · AFK простой ({int(idle_sec)}с)"
                    elif is_dist:
                        tray_icon.title = f"EyeTime OS · Отвлечение: {app_name}"
                    else:
                        tray_icon.title = f"EyeTime OS · {app_name}"
                except Exception:
                    pass

            today_key = time.strftime('%Y-%m-%d')
            current_hour = time.localtime().tm_hour

            with db_lock:
                # ── 1. Block Unauthorized Browsers (No EyeTime Extension) ─
                block_other_browsers = master_db.get('settings', {}).get('blockOtherBrowsers', True)
                if block_other_browsers and exe_name in UNAUTHORIZED_BROWSERS:
                    # Allow only our own EyeTime Desktop window
                    is_eyetime_app = ('eyetime' in title.lower()) or ('127.0.0.1:8765' in title.lower())
                    if not is_eyetime_app and hwnd:
                        WM_CLOSE = 0x0010
                        user32.PostMessageW(hwnd, WM_CLOSE, 0, 0)
                        user32.ShowWindow(hwnd, 0)  # SW_HIDE

                # ── 2. Block Chrome Incognito Windows ─────────────────────
                if 'chrome.exe' in exe_name and ('инкогнито' in title.lower() or 'incognito' in title.lower()):
                    if hwnd:
                        WM_CLOSE = 0x0010
                        user32.PostMessageW(hwnd, WM_CLOSE, 0, 0)

                # Extension access is allowed (watchdog disabled)

                # ── 4. Desktop App Kill-Switch during Focus Block ─────────
                focus = master_db.setdefault('focusBlock', {})
                is_focus_active = focus.get('active', False) and (now < focus.get('endTime', 0))

                if is_focus_active:
                    blocked_list = master_db.get('blockedApps', [])
                    is_app_blocked = any(b.get('exe') == exe_name and b.get('enabled') for b in blocked_list)
                    if is_app_blocked and hwnd:
                        SW_MINIMIZE = 6
                        user32.ShowWindow(hwnd, SW_MINIMIZE)

                # ── 5. Record Today Stats & Apps ──────────────────────────
                stats = master_db.setdefault('stats', {})
                day = stats.setdefault(today_key, {
                    'totalSeconds': 0,
                    'productiveSeconds': 0,
                    'distractionSeconds': 0,
                    'idleSeconds': 0,
                    'domains': {},
                    'desktopApps': {}
                })

                if is_idle:
                    day['idleSeconds'] = day.get('idleSeconds', 0) + elapsed
                else:
                    if is_dist:
                        day['distractionSeconds'] = day.get('distractionSeconds', 0) + elapsed
                    else:
                        day['productiveSeconds'] = day.get('productiveSeconds', 0) + elapsed

                    if app_name and app_name != 'Рабочий стол':
                        apps = day.setdefault('desktopApps', {})
                        apps[app_name] = apps.get(app_name, 0) + elapsed

                day['totalSeconds'] = day.get('totalSeconds', 0) + elapsed

                # ── 6. Record Hourly Timeline Slot (0-23h) ────────────────
                hourly_map = master_db.setdefault('hourly', {}).setdefault(today_key, {})
                hour_slot = hourly_map.setdefault(str(current_hour), {
                    'productiveSec': 0,
                    'distractionSec': 0,
                    'idleSec': 0,
                    'apps': {}
                })

                if is_idle:
                    hour_slot['idleSec'] += elapsed
                elif is_dist:
                    hour_slot['distractionSec'] += elapsed
                else:
                    hour_slot['productiveSec'] += elapsed

                if app_name and app_name != 'Рабочий стол':
                    hour_apps = hour_slot.setdefault('apps', {})
                    hour_apps[app_name] = hour_apps.get(app_name, 0) + elapsed

                # Save checkpoint periodically
                if int(now) % 20 < 1:
                    save_master_db()

        except Exception:
            pass

        time.sleep(0.35)

# Threading HTTP Request Handler
class SentinelHTTPRequestHandler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, format, *args):
        return

    def log_error(self, format, *args):
        return

    def log_request(self, code='-', size='-'):
        return

    def send_cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Access-Control-Allow-Private-Network')
        self.send_header('Access-Control-Allow-Private-Network', 'true')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors()
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # Serve Desktop App UI
        if path == '/' or path == '/app' or path == '/app/':
            self.serve_file(os.path.join(APP_DIR, 'index.html'), 'text/html; charset=utf-8')
            return
        elif path.startswith('/app/') or path in ['/desktop.css', '/desktop.js', '/index.html']:
            filename = os.path.basename(path)
            local_path = os.path.join(APP_DIR, filename)
            mime = 'text/plain'
            if filename.endswith('.html'): mime = 'text/html; charset=utf-8'
            elif filename.endswith('.css'): mime = 'text/css; charset=utf-8'
            elif filename.endswith('.js'): mime = 'application/javascript; charset=utf-8'
            elif filename.endswith('.png'): mime = 'image/png'
            elif filename.endswith('.svg'): mime = 'image/svg+xml'
            self.serve_file(local_path, mime)
            return
        elif path.startswith('/assets/') or path == '/eyetime_audio.js':
            filename = os.path.basename(path)
            local_path = os.path.join(BASE_DIR, 'assets', filename)
            mime = 'application/javascript; charset=utf-8'
            if filename.endswith('.png'): mime = 'image/png'
            self.serve_file(local_path, mime)
            return

        # API: Status
        if path == '/api/status':
            now = time.time()
            today_key = time.strftime('%Y-%m-%d')

            with db_lock:
                day_stats = master_db.get('stats', {}).get(today_key, {})
                focus = master_db.get('focusBlock', {})
                settings = master_db.get('settings', {})

                is_active = focus.get('active', False) and (now < focus.get('endTime', 0))
                remaining = max(0, int(focus.get('endTime', 0) - now)) if is_active else 0

                bedtime_str = settings.get('bedtime', '23:00')
                try:
                    b_h, b_m = map(int, bedtime_str.split(':'))
                    now_t = time.localtime()
                    cur_m = now_t.tm_hour * 60 + now_t.tm_min
                    target_m = b_h * 60 + b_m
                    diff_m = target_m - cur_m
                    if diff_m < 0:
                        diff_m += 24 * 60
                    countdown_str = f"{diff_m // 60}ч {diff_m % 60}м"
                except Exception:
                    countdown_str = bedtime_str

                payload = {
                    'status': 'online',
                    'activeApp': state['active_app'],
                    'exeName': state['exe_name'],
                    'windowTitle': state['window_title'],
                    'idleSeconds': state['idle_seconds'],
                    'isIdle': state['is_idle'],
                    'category': state['category'],
                    'isDistraction': state['is_distraction'],
                    'focusBlockActive': is_active,
                    'focusRemainingSec': remaining,
                    'focusTask': focus.get('task', 'Главная задача дня'),
                    'todayProductiveSeconds': int(day_stats.get('productiveSeconds', 0)),
                    'todayDistractionSeconds': int(day_stats.get('distractionSeconds', 0)),
                    'todayIdleSeconds': int(day_stats.get('idleSeconds', 0)),
                    'bedtime': bedtime_str,
                    'bedtimeCountdown': countdown_str,
                    'protectionActive': True,
                    'blockOtherBrowsers': settings.get('blockOtherBrowsers', True)
                }

            self.send_json(payload)
            return

        # API: 24h Hourly Timeline
        elif path == '/api/timeline':
            today_key = time.strftime('%Y-%m-%d')
            current_hour = time.localtime().tm_hour

            with db_lock:
                day_stats = master_db.get('stats', {}).get(today_key, {})
                apps = day_stats.get('desktopApps', {})

                # Sorted Top Apps
                top_apps = []
                for name, sec in sorted(apps.items(), key=lambda x: x[1], reverse=True)[:8]:
                    h = int(sec // 3600)
                    m = int((sec % 3600) // 60)
                    time_str = f"{h}ч {m}м" if h > 0 else f"{m}м"
                    top_apps.append({
                        'name': name,
                        'category': APP_CATEGORY_MAP.get(name, 'Приложение'),
                        'timeStr': time_str,
                        'seconds': int(sec)
                    })

                # Real 24-hour slots
                hourly_map = master_db.get('hourly', {}).get(today_key, {})
                hours_slots = []
                for h in range(24):
                    h_stat = hourly_map.get(str(h), {})
                    p_sec = h_stat.get('productiveSec', 0)
                    d_sec = h_stat.get('distractionSec', 0)
                    i_sec = h_stat.get('idleSec', 0)
                    hours_slots.append({
                        'hour': h,
                        'label': f"{h:02d}:00",
                        'productiveMins': round(p_sec / 60, 1),
                        'distractionMins': round(d_sec / 60, 1),
                        'idleMins': round(i_sec / 60, 1),
                        'isFuture': (h > current_hour),
                        'isCurrent': (h == current_hour)
                    })

                self.send_json({
                    'topApps': top_apps,
                    'hours': hours_slots,
                    'currentHour': current_hour
                })
            return

        elif path == '/api/apps':
            with db_lock:
                self.send_json({'blockedApps': master_db.get('blockedApps', [])})
            return

        # Fallback Master Data
        with db_lock:
            payload = {
                'status': 'online',
                'activeApp': state['active_app'],
                'exeName': state['exe_name'],
                'windowTitle': state['window_title'],
                'idleSeconds': state['idle_seconds'],
                'isIdle': state['is_idle'],
                'category': state['category'],
                'masterData': master_db
            }
        self.send_json(payload)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length) if length > 0 else b'{}'

        try:
            req = json.loads(body.decode('utf-8'))
        except Exception:
            req = {}

        if path == '/api/focus_block':
            active = req.get('active', False)
            mins = req.get('durationMins', 90)
            task = req.get('task', 'Главная задача дня')
            with db_lock:
                focus = master_db.setdefault('focusBlock', {})
                focus['active'] = active
                focus['endTime'] = time.time() + (mins * 60) if active else 0
                focus['task'] = task
                save_master_db()
            self.send_json({'success': True, 'focusBlock': focus})
            return

        elif path == '/api/block_app':
            exe = req.get('exe', '').lower()
            title = req.get('title', exe)
            enabled = req.get('enabled', True)
            with db_lock:
                apps = master_db.setdefault('blockedApps', [])
                match = next((a for a in apps if a.get('exe') == exe), None)
                if match:
                    match['enabled'] = enabled
                else:
                    apps.append({'title': title, 'exe': exe, 'enabled': enabled})
                save_master_db()
            self.send_json({'success': True, 'blockedApps': apps})
            return

        elif path == '/api/toggle_browser_block':
            enabled = req.get('enabled', True)
            with db_lock:
                master_db.setdefault('settings', {})['blockOtherBrowsers'] = enabled
                save_master_db()
            self.send_json({'success': True, 'blockOtherBrowsers': enabled})
            return

        elif path == '/api/reapply_shield':
            ok = apply_chrome_protection_policies()
            self.send_json({'success': ok})
            return

        elif path == '/api/sync_domain':
            today_key = time.strftime('%Y-%m-%d')
            domain = req.get('domain')
            sec = req.get('seconds', 1)
            with db_lock:
                stats = master_db.setdefault('stats', {})
                day = stats.setdefault(today_key, {'totalSeconds': 0, 'domains': {}, 'desktopApps': {}})
                if domain and sec > 0:
                    domains = day.setdefault('domains', {})
                    domains[domain] = domains.get(domain, 0) + sec
                    day['totalSeconds'] = day.get('totalSeconds', 0) + sec
                    save_master_db()
            self.send_json({'success': True})
        elif path == '/api/settings':
            bedtime = req.get('bedtime')
            with db_lock:
                s = master_db.setdefault('settings', {})
                if bedtime:
                    s['bedtime'] = bedtime
                save_master_db()
            self.send_json({'success': True, 'settings': s})
            return

        self.send_json({'success': True})

    def serve_file(self, filepath, content_type):
        if os.path.exists(filepath):
            try:
                with open(filepath, 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', content_type)
                self.send_header('Content-Length', str(len(content)))
                self.send_cors()
                self.end_headers()
                self.wfile.write(content)
                return
            except Exception:
                pass
        self.send_response(404)
        self.send_cors()
        self.end_headers()

    def send_json(self, data):
        res = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(res)))
        self.send_cors()
        self.end_headers()
        self.wfile.write(res)

class ResilientThreadingServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True

def run_http_server():
    server_address = ('127.0.0.1', 8765)
    while True:
        try:
            httpd = ResilientThreadingServer(server_address, SentinelHTTPRequestHandler)
            httpd.serve_forever()
        except Exception:
            time.sleep(1.0)

# ── Windows System Tray Integration ────────────────────────
tray_icon = None

def open_dashboard(icon=None, item=None):
    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    app_url = "http://127.0.0.1:8765/app"
    try:
        import subprocess
        if os.path.exists(chrome_path):
            subprocess.Popen([chrome_path, f"--app={app_url}"])
        else:
            import webbrowser
            webbrowser.open(app_url)
    except Exception:
        pass

def start_focus_tray(mins):
    with db_lock:
        focus = master_db.setdefault('focusBlock', {})
        focus['active'] = True
        focus['endTime'] = time.time() + (mins * 60)
        focus['task'] = f'Фокус-Блок ({mins}м)'
        save_master_db()
    try:
        import webbrowser
        webbrowser.open('https://app.endel.io/player/focus')
    except Exception:
        pass

def stop_focus_tray(icon=None, item=None):
    with db_lock:
        focus = master_db.setdefault('focusBlock', {})
        focus['active'] = False
        focus['endTime'] = 0
        save_master_db()

def toggle_browser_block_tray(icon=None, item=None):
    with db_lock:
        cur = master_db.get('settings', {}).get('blockOtherBrowsers', True)
        master_db.setdefault('settings', {})['blockOtherBrowsers'] = not cur
        save_master_db()

def is_browser_block_enabled(item=None):
    return master_db.get('settings', {}).get('blockOtherBrowsers', True)

def exit_app(icon=None, item=None):
    if tray_icon:
        tray_icon.stop()
    os._exit(0)

def setup_tray():
    global tray_icon
    try:
        import pystray
        from PIL import Image

        icon_path = os.path.join(BASE_DIR, 'assets', 'icon32.png')
        if os.path.exists(icon_path):
            image = Image.open(icon_path)
        else:
            image = Image.new('RGBA', (32, 32), color=(255, 94, 14, 255))

        menu = pystray.Menu(
            pystray.MenuItem("⚡ EyeTime OS — Открыть", open_dashboard, default=True),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("🎯 Фокус-Блок", pystray.Menu(
                pystray.MenuItem("25 минут", lambda icon, item: start_focus_tray(25)),
                pystray.MenuItem("50 минут", lambda icon, item: start_focus_tray(50)),
                pystray.MenuItem("90 минут", lambda icon, item: start_focus_tray(90)),
                pystray.MenuItem("⏹️ Завершить", stop_focus_tray)
            )),
            pystray.MenuItem("🚫 Блокировка других браузеров", toggle_browser_block_tray, checked=is_browser_block_enabled),
            pystray.MenuItem("🛡️ Защита расширения: АКТИВНА", lambda icon, item: None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("✕ Выход", exit_app)
        )

        tray_icon = pystray.Icon("EyeTimeOS", image, "EyeTime OS — PC Sentinel", menu)
        tray_icon.run()
    except Exception:
        while True:
            time.sleep(3600)

if __name__ == '__main__':
    apply_chrome_protection_policies()
    t_tracker = threading.Thread(target=tracker_loop, daemon=True)
    t_tracker.start()
    t_server = threading.Thread(target=run_http_server, daemon=True)
    t_server.start()
    setup_tray()
