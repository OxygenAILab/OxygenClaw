@echo off
echo ==========================================
echo   Starting OxygenClaw WebUI
echo ==========================================
echo.
echo Make sure OpenOxygenClaw API Server is running on http://localhost:3001
echo.

cd /d "%~dp0packages\webui"

echo Installing dependencies...
call npm install

echo.
echo Starting WebUI on http://localhost:5173
echo.
call npm run dev

pause
