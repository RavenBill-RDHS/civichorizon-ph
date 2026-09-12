@echo off
setlocal
cd /d "%~dp0"
echo.
echo CivicHorizon Barebone MVP
echo =========================
echo Starting local web server...
echo.
where py >nul 2>&1
if %errorlevel%==0 (
  echo Open: http://localhost:8080
  echo Close this window to stop the server.
  start "" http://localhost:8080
  py -m http.server 8080
  goto :eof
)

where python >nul 2>&1
if %errorlevel%==0 (
  echo Open: http://localhost:8080
  echo Close this window to stop the server.
  start "" http://localhost:8080
  python -m http.server 8080
  goto :eof
)

echo Python was not found.
echo Install Python, then run this file again.
pause
