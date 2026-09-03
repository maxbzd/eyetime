@echo off
title EyeTime Tracker — Remove AutoStart
color 0C

set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\EyeTimeTracker.lnk"

if exist "%SHORTCUT_PATH%" (
    del "%SHORTCUT_PATH%"
    echo AutoStart shortcut removed successfully.
) else (
    echo AutoStart shortcut was not found.
)

pause
