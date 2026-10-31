@echo off
title AegisDisplay - Wireless Virtual Multi-Display
cd /d "%~dp0"

echo ======================================================
echo    AegisDisplay: Secure Wireless Multi-Display Host
echo ======================================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

:: Check if native binaries exist
if not exist "src\capture\native\enum_screens.exe" (
    echo [Setup] Compiling native C++ screen enumerator and input injector...
    powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\compile_native.ps1"
)

:: Launch Server
echo [Starting] Launching secure HTTPS / WSS streaming server...
node src\server.js
pause
