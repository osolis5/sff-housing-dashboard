@echo off
rem Launches the North Lawndale Housing Dashboard.
rem Starts a tiny local web server and opens the dashboard in your default
rem browser. Close this window (or press Ctrl+C) to stop.
cd /d "%~dp0"
set PORT=8742

where py >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:%PORT%/index.html"
  echo.
  echo   North Lawndale Housing Dashboard
  echo   Serving at http://localhost:%PORT% - press Ctrl+C to stop.
  echo.
  py -m http.server %PORT%
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:%PORT%/index.html"
  echo.
  echo   North Lawndale Housing Dashboard
  echo   Serving at http://localhost:%PORT% - press Ctrl+C to stop.
  echo.
  python -m http.server %PORT%
  goto :eof
)

rem No Python available - open the file directly (works fine too).
start "" "index.html"
