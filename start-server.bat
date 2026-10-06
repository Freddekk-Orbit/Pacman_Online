@echo off
cd /d "%~dp0"
echo Starting the dedicated Pac-Man cabinet on this laptop...
echo Leave this window open. Play from other computers.
call npm run server
pause
