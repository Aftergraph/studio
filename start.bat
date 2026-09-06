@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22+ is required.
  pause
  exit /b 1
)
start "" cmd /c "timeout /t 1 /nobreak >nul & start http://127.0.0.1:8000"
node server.mjs
