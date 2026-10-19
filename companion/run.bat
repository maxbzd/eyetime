@echo off
title EyeTime companion
cd /d "%~dp0"
python eyetime_companion.py
if errorlevel 1 pause
