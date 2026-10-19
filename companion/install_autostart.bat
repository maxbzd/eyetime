@echo off
rem Adds a per-user Startup shortcut that runs the companion minimised. Fully reversible with uninstall_autostart.bat.
set "SCRIPT=%~dp0eyetime_companion.py"
set "LINK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\EyeTime companion.lnk"
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%LINK%'); $s.TargetPath='pythonw.exe'; $s.Arguments='\"%SCRIPT%\"'; $s.WorkingDirectory='%~dp0'; $s.WindowStyle=7; $s.Save()"
if exist "%LINK%" (echo Done. The companion will start when you sign in.) else (echo Could not create the shortcut. Is Python installed and on PATH?)
pause
