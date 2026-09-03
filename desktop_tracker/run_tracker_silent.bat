@echo off
rem EyeTime Tracker — Silent Background Executable Launcher
if "%~1"=="-h" goto hidden_run
mshta vbscript:CreateObject("WScript.Shell").Run("""%~f0"" -h",0)(window.close)&exit

:hidden_run
cd /d "%~dp0"
python "%~dp0eyetime_tracker.py"
