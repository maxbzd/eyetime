@echo off
title EyeTime Desktop Tracker
color 0A
echo Starting EyeTime PC Tracker on http://127.0.0.1:8765...
"C:\Users\maxbz\AppData\Local\hermes\hermes-agent\venv\Scripts\python.exe" "%~dp0eyetime_tracker.py"
pause
