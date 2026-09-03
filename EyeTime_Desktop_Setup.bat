@echo off
setlocal
chcp 65001 >nul
title EyeTime Desktop — Master Setup & Launcher

echo ============================================================
echo   EyeTime Desktop — Master Cockpit & Chrome Protection
echo ============================================================
echo.

:: 1. Self-elevation to Administrator for System Registry Chrome Policies
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [1/3] Запрос прав администратора для включения защиты расширения...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo [✓] Права администратора получены.
echo.

:: 2. Apply Windows Registry Policies to Lock Chrome Extension Uninstall
echo [2/3] Активация защиты Chrome от удаления...
reg add "HKLM\SOFTWARE\Policies\Google\Chrome\URLBlocklist" /v 1 /t REG_SZ /d "chrome://extensions*" /f >nul 2>&1
reg add "HKCU\SOFTWARE\Policies\Google\Chrome\URLBlocklist" /v 1 /t REG_SZ /d "chrome://extensions*" /f >nul 2>&1
echo [✓] Политика защиты Chrome активирована (кнопка удалить заблокирована).
echo.

:: 3. Setup Autostart for the Background Daemon
echo [3/3] Настройка автозапуска фонового демона...
set "TRACKER_SCRIPT=%~dp0desktop_tracker\eyetime_silent.vbs"
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "EyeTimeSentinel" /t REG_SZ /d "wscript.exe \"%TRACKER_SCRIPT%\"" /f >nul 2>&1

:: 4. Start Background Tracker if not running
curl -s http://127.0.0.1:8765/api/status >nul 2>&1
if %errorlevel% neq 0 (
    echo Запуск фонового сервиса EyeTime...
    wscript "%TRACKER_SCRIPT%"
    timeout /t 2 /nobreak >nul
) else (
    echo [✓] Фоновый сервис EyeTime активен.
)

:: 5. Create Desktop Shortcut for one-click launch
set "TARGET_LAUNCHER=%~dp0desktop_app\launch_app.bat"
powershell -Command "$d=[Environment]::GetFolderPath('Desktop'); $s=(New-Object -COM WScript.Shell).CreateShortcut(\"$d\EyeTime Desktop.lnk\"); $s.TargetPath='%TARGET_LAUNCHER%'; $s.WorkingDirectory='%~dp0'; $s.Save()" >nul 2>&1

echo.
echo ============================================================
echo   [ГОТОВО] Приложение установлено и готово к работе!
echo   Ярлык «EyeTime Desktop» создан на вашем Рабочем столе.
echo ============================================================
echo.

:: 6. Launch Desktop Application Window
call "%TARGET_LAUNCHER%"
