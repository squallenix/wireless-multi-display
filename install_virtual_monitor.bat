@echo off
title AegisDisplay - Install Virtual Extended Monitor
cd /d "%~dp0"

echo ========================================================
echo    AegisDisplay: Virtual Extended Monitor Setup
echo ========================================================
echo.

:: 1. Check for Administrative Privileges and auto-elevate
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [UAC] Requesting Administrator permissions...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b 0
)

echo [Step 1/3] Installing Driver Security Certificate...
set CERT_PATH="%~dp0drivers\vdd\VirtualDisplayDriver\Virtual_Display_Driver.cer"
certutil -addstore -f root %CERT_PATH% >nul
certutil -addstore -f TrustedPublisher %CERT_PATH% >nul
echo    [OK] Certificate trusted.

echo.
echo [Step 2/3] Registering Driver Package into Windows...
set INF_PATH="%~dp0drivers\vdd\VirtualDisplayDriver\MttVDD.inf"
pnputil /add-driver %INF_PATH% /install
echo    [OK] Driver package registered.

echo.
echo [Step 3/3] Creating Virtual Monitor 2 Device Node...
set DEVCON="%~dp0drivers\vdd\VDD.Control\Dependencies\devcon.exe"
%DEVCON% install %INF_PATH% Root\MttVDD

echo.
echo ========================================================
echo    SUCCESS! Virtual Monitor #2 Created Successfully!
echo ========================================================
echo.
echo Windows will now recognize a separate second monitor.
echo Open: Windows Settings -> System -> Display
echo Ensure it is set to: "Extend these displays"
echo.
echo You can now restart AegisDisplay (start.bat) and choose:
echo    👉 Monitor 2 (Virtual Extended Display)
echo on your phone or laptop!
echo.
pause
