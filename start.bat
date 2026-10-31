@echo off
title AegisDisplay - Wireless Virtual Multi-Display
cd /d "%~dp0"

echo ======================================================
echo    AegisDisplay: Secure Wireless Multi-Display Host
echo ======================================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

:: 2. Auto-install npm dependencies if missing
if not exist "node_modules\ws" (
    echo [Setup] First-time launch: Installing dependencies...
    call npm install --omit=dev
    echo.
)

:: 3. Check and auto-compile native C++ binaries if missing
if not exist "src\capture\native\desktop_runner.exe" (
    echo [Setup] Compiling native C++ screen enumerator, input injector, and desktop runner...
    powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\compile_native.ps1"
    echo.
)

:: 3. Ensure 16:9 Virtual Display profile is deployed
if not exist "C:\VirtualDisplayDriver\vdd_settings.xml" (
    if not exist "C:\VirtualDisplayDriver" mkdir "C:\VirtualDisplayDriver" >nul 2>&1
    copy /y "drivers\vdd\VirtualDisplayDriver\vdd_settings.xml" "C:\VirtualDisplayDriver\vdd_settings.xml" >nul 2>&1
)

:: 4. Launch Host Server
echo [Starting] Launching secure HTTPS / WSS streaming server...
node src\server.js
pause
