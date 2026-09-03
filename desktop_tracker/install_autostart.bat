@echo off
title EyeTime Tracker — AutoStart Installer
color 0A

echo =======================================================
echo   EyeTime Desktop Tracker — AutoStart Installation
echo =======================================================
echo.

set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\EyeTimeTracker.lnk"

echo Creating Windows Background Startup Shortcut...

powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = 'C:\Users\maxbz\AppData\Local\hermes\hermes-agent\venv\Scripts\python.exe'; $s.Arguments = '\"%~dp0eyetime_tracker.py\"'; $s.WorkingDirectory = '%~dp0'; $s.WindowStyle = 7; $s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo.
    echo SUCCESS! EyeTime Desktop Tracker is now installed to Windows AutoStart.
    echo It will run in the background whenever your PC starts.
    echo.
    echo Launching tracker right now...
    start /b "" "C:\Users\maxbz\AppData\Local\hermes\hermes-agent\venv\Scripts\python.exe" "%~dp0eyetime_tracker.py"
    echo.
    echo Done! You can close this window.
) else (
    echo.
    echo FAILED to create startup shortcut.
)

pause
