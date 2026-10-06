@echo off
cd /d "%~dp0"
echo Starting a PUBLIC dedicated cabinet (Cloudflare tunnel)...
echo Leave this window open. When you see WORLD PLAY, send that URL to friends.
call npm run server:public
pause
