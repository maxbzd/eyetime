@echo off
chcp 65001 >nul
title EyeTime OS — Мастер Быстрой Установки (1-Click Installer)
color 0F

echo ==============================================================================
echo       ⚡ ДОБРО ПОЖАЛОВАТЬ В МАСТЕР УСТАНОВКИ EYETIME OS
echo ==============================================================================
echo   EyeTime OS — персональная операционная система для глубокого фокуса,
echo   защиты внимания от Shorts/Reels и продуктивной работы на компьютере.
echo ==============================================================================
echo.

set "PROJECT_DIR=%~dp0"
set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

:: 1. Copy folder path to clipboard for 1-click extension loading
powershell -Command "Set-Clipboard -Value '%PROJECT_DIR%'" >nul 2>&1
echo [1/3] Путь к папке проекта скопирован в буфер обмена!

:: 2. Setup Python Desktop Tracker
echo [2/3] Настройка десктопного агента Windows...
python --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo       ✓ Python обнаружен. Устанавливаем компоненты трея (pystray, pillow)...
    pip install pystray pillow --quiet >nul 2>&1
    
    :: Install autostart silently
    call "%PROJECT_DIR%\desktop_tracker\install_autostart.bat" >nul 2>&1
    
    :: Start silently to tray
    wscript.exe "%PROJECT_DIR%\desktop_tracker\eyetime_silent.vbs" >nul 2>&1
    echo       ✓ Десктопный агент запущен в системном трее Windows (возле часов)!
) else (
    echo       [!] Python не найден. Десктопный агент будет пропущен (можно установить позже).
)

:: 3. Guide to Chrome Extension
echo [3/3] Запуск браузера Chrome...
echo.
echo ==============================================================================
echo   ФИНАЛЬНЫЙ ШАГ: ПОДКЛЮЧЕНИЕ РАСШИРЕНИЯ В CHROME (ВСЕГО 2 КЛИКА)
echo ==============================================================================
echo.
echo   1. Сейчас откроется страница управления расширениями Chrome.
echo   2. Включите тумблер [Режим разработчика] (справа вверху).
echo   3. Нажмите кнопку [Загрузить распакованное расширение] (слева вверху).
echo   4. В поле выбора папки нажмите [Ctrl + V] и Enter (путь уже в буфере)!
echo.
echo   После этого откроется интерактивный ОНБОРДИНГ для настройки ваших целей!
echo ==============================================================================
echo.

:: Open chrome://extensions
start "" chrome.exe "chrome://extensions/" 2>nul
if %ERRORLEVEL% NEQ 0 (
    start "" "chrome://extensions/" 2>nul
)

pause
