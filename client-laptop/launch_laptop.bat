@echo off
title AegisDisplay - Laptop Client Launcher
cd /d "%~dp0"

echo ======================================================
echo       AegisDisplay: Laptop Receiver App Launcher
echo ======================================================
echo.

:: 1. Auto-discover Host PC via PowerShell UDP query
set "DISCOVERED_IP="
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "try { $c = [System.Net.Sockets.UdpClient]::new(); $c.Client.ReceiveTimeout = 1200; $c.EnableBroadcast = $true; $b = [Text.Encoding]::ASCII.GetBytes('AEGIS_DISCOVER'); $null = $c.Send($b, $b.Length, '255.255.255.255', 8444); $ep = [System.Net.IPEndPoint]::new([System.Net.IPAddress]::Any, 0); $r = $c.Receive([ref]$ep); $j = ConvertFrom-Json ([Text.Encoding]::ASCII.GetString($r)); if ($j.type -eq 'AEGIS_ANNOUNCE' -and $j.ip) { Write-Output $j.ip } } catch {}" 2^>nul`) do (
    set "DISCOVERED_IP=%%I"
)

if not "%DISCOVERED_IP%"=="" (
    echo [Auto-Discovery] Host PC detected at: %DISCOVERED_IP%
    set "DEFAULT_IP=%DISCOVERED_IP%"
) else (
    set "DEFAULT_IP=192.168.10.3"
)

set /p HOST_IP="Enter Host PC IP [default: %DEFAULT_IP%]: "
if "%HOST_IP%"=="" set "HOST_IP=%DEFAULT_IP%"

set /p PORT="Enter Port [default 8443]: "
if "%PORT%"=="" set "PORT=8443"

set "TARGET_URL=https://%HOST_IP%:%PORT%/"

echo.
echo ======================================================
echo  Choose Receiver Mode:
echo   [1] Dedicated App Window (Edge / Chrome / Opera / Brave) [Recommended]
echo   [2] Python + FFplay Stream Receiver (client_laptop.py)
echo   [3] Open in Default Web Browser
echo ======================================================
set /p MODE="Select mode [1/2/3, default: 1]: "
if "%MODE%"=="" set "MODE=1"

if "%MODE%"=="2" goto RUN_PYTHON
if "%MODE%"=="3" goto RUN_DEFAULT

:RUN_APP
echo.
echo Searching for installed browser for Dedicated App Mode...

set "BROWSER_EXE="

:: Check Microsoft Edge
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

:: Check Google Chrome
if not defined BROWSER_EXE if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%LocalAppData%\Google\Chrome\Application\chrome.exe"

:: Check Brave
if not defined BROWSER_EXE if exist "%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe" set "BROWSER_EXE=%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe"
if not defined BROWSER_EXE if exist "%LocalAppData%\BraveSoftware\Brave-Browser\Application\brave.exe" set "BROWSER_EXE=%LocalAppData%\BraveSoftware\Brave-Browser\Application\brave.exe"

:: Check Opera GX / Opera
if not defined BROWSER_EXE if exist "%ProgramFiles%\Opera GX\launcher.exe" set "BROWSER_EXE=%ProgramFiles%\Opera GX\launcher.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles%\Opera GX\opera.exe" set "BROWSER_EXE=%ProgramFiles%\Opera GX\opera.exe"
if not defined BROWSER_EXE if exist "%LocalAppData%\Programs\Opera GX\launcher.exe" set "BROWSER_EXE=%LocalAppData%\Programs\Opera GX\launcher.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles%\Opera\launcher.exe" set "BROWSER_EXE=%ProgramFiles%\Opera\launcher.exe"

if defined BROWSER_EXE (
    echo Launching dedicated native receiver via "%BROWSER_EXE%"...
    start "" "%BROWSER_EXE%" --app="%TARGET_URL%" --start-fullscreen --test-type --ignore-certificate-errors --allow-insecure-localhost --unsafely-treat-insecure-origin-as-secure="https://%HOST_IP%:%PORT%" --disable-features=Translate
    exit /b 0
)

:RUN_DEFAULT
echo Opening default web browser...
start "" "%TARGET_URL%"
exit /b 0

:RUN_PYTHON
echo.
echo Launching native Python FFplay receiver...
python --version >nul 2>nul
if %errorlevel% neq 0 (
    echo [Error] Python 3 was not found in your system PATH.
    echo Please install Python 3 or use Option 1 (App Window).
    pause
    exit /b 1
)

python -c "import websocket" >nul 2>nul
if %errorlevel% neq 0 (
    echo Installing websocket-client dependency...
    pip install websocket-client
)

python client_laptop.py
exit /b 0
