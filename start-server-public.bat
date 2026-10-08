@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Install Node.js LTS from https://nodejs.org then try again.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing packages...
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

echo Starting a PUBLIC dedicated cabinet...
echo Leave this window open. When you see WORLD PLAY, send that URL to friends.
echo.
node scripts\run-dedicated.mjs --public
echo.
pause
