@echo off
setlocal
chcp 65001 >nul

set "TRACKER_VBS=%~dp0..\desktop_tracker\eyetime_silent.vbs"

:: Start daemon if not already responding on port 8765
curl -s http://127.0.0.1:8765/api/status >nul 2>&1
if %errorlevel% neq 0 (
    wscript "%TRACKER_VBS%"
    timeout /t 1 /nobreak >nul
)

:: Launch Native Edge App Window (loads directly from local server for 100% hot-reload auto-updates!)
start "" msedge.exe --app="http://127.0.0.1:8765/app" --window-size=1200,820 --user-data-dir="%LOCALAPPDATA%\EyeTimeDesktop"
