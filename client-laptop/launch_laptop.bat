@echo off
title AegisDisplay - Laptop Client Launcher
cd /d "%~dp0"

echo ======================================================
echo       AegisDisplay: Laptop Receiver App Launcher
echo ======================================================
echo.

set /p HOST_IP="Enter your Host PC IP (e.g. 192.168.10.3): "
if "%HOST_IP%"=="" set HOST_IP=192.168.10.3

set /p PORT="Enter Port [default 8443]: "
if "%PORT%"=="" set PORT=8443

set TARGET_URL=https://%HOST_IP%:%PORT%

echo.
echo Launching standalone receiver window for %TARGET_URL%...

:: Try Microsoft Edge App Mode
where msedge >nul 2>nul
if %errorlevel% equ 0 (
    start msedge --app="%TARGET_URL%" --start-fullscreen --disable-features=Translate
    exit /b 0
)

:: Try Google Chrome App Mode
where chrome >nul 2>nul
if %errorlevel% equ 0 (
    start chrome --app="%TARGET_URL%" --start-fullscreen --disable-features=Translate
    exit /b 0
)

:: Try Brave Browser
where brave >nul 2>nul
if %errorlevel% equ 0 (
    start brave --app="%TARGET_URL%" --start-fullscreen
    exit /b 0
)

:: Fallback to default browser
start "" "%TARGET_URL%"
exit /b 0
