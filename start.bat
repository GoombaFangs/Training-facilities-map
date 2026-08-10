@echo off
cd /d "%~dp0"
echo Starting Training Facilities Map...
echo.
echo Open in browser: http://127.0.0.1:5173/
echo.
echo Keep this window open while using the app.
echo Press Ctrl+C to stop the server.
echo.
npm run dev
pause
