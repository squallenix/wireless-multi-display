@echo off
title AegisDisplay - Configure Virtual Monitor Resolution
cd /d "%~dp0"

echo ======================================================
echo    AegisDisplay: Set Virtual Monitor Resolution
echo ======================================================
echo.
echo Windows Display Settings will open now.
echo.
echo Instructions:
echo  1. In the diagram at top, click Monitor [2] (Virtual Display).
echo  2. Scroll down to "Display resolution".
echo  3. Select [1920 x 1080] or [1366 x 768] (to match your laptop).
echo  4. Click "Keep changes".
echo.
echo Opening Windows Display Settings...
start ms-settings:display
echo.
pause
