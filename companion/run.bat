@echo off
title Elvani companion
cd /d "%~dp0"
python eyetime_companion.py
if errorlevel 1 pause
