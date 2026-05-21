@echo off
setlocal

cd /d "%~dp0"
set "PORT=8001"
set "APP_URL=http://127.0.0.1:%PORT%"

where npm >nul 2>nul
if errorlevel 1 (
  echo npm command was not found. Please install Node.js first.
  pause
  exit /b 1
)

echo Starting YouTube ringtone app on %APP_URL%
start "" "%APP_URL%"
npm start

echo.
echo The app has stopped.
pause
