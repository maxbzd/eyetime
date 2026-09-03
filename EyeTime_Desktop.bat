@echo off
start "" "C:\Users\maxbz\AppData\Local\hermes\hermes-agent\venv\Scripts\pythonw.exe" "C:\Users\maxbz\Downloads\chrome\desktop_tracker\eyetime_tracker.py"
ping 127.0.0.1 -n 2 >nul
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app="http://127.0.0.1:8765/app"
