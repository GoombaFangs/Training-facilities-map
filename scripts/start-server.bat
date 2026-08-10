@echo off
title Training Facilities Map - Server
cd /d "%~dp0.."

if not exist "dist\index.html" (
  echo Building application...
  call npm run build
  if errorlevel 1 (
    echo Build failed.
    pause
    exit /b 1
  )
)

echo Starting server on port 3000...
echo Open http://localhost:3000 from this computer
echo Other computers on the LAN: http://^<server-ip^>:3000
echo.
node server/index.js
pause
