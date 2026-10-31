@echo off
title AegisDisplay - Remove Virtual Monitor
cd /d "%~dp0"

echo ========================================================
echo    AegisDisplay: Remove Virtual Extended Monitor
echo ========================================================
echo.

:: Check for Administrative Privileges and auto-elevate
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [UAC] Requesting Administrator permissions...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b 0
)

echo Removing Virtual Monitor Device Node...
set DEVCON="%~dp0drivers\vdd\VDD.Control\Dependencies\devcon.exe"
%DEVCON% remove Root\MttVDD

echo.
echo Virtual Monitor removed.
pause
