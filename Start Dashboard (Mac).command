#!/bin/bash
# Launches the North Lawndale Housing Dashboard.
# Starts a tiny local web server (for the fully polished experience) and opens
# the dashboard in your default browser. Press Ctrl+C or close this window to stop.
cd "$(dirname "$0")"
PORT=8742

if command -v python3 >/dev/null 2>&1; then
  ( sleep 1; open "http://localhost:$PORT/index.html" ) &
  echo ""
  echo "  North Lawndale Housing Dashboard"
  echo "  Serving at http://localhost:$PORT — press Ctrl+C to stop."
  echo ""
  python3 -m http.server "$PORT"
else
  # No Python available — open the file directly (works fine too).
  open "index.html"
fi
