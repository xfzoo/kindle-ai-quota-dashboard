#!/bin/bash
LOG="/mnt/us/ai-quota-dashboard.log"
exec >>"$LOG" 2>&1
echo "--- $(date) launch ---"
BASE="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
echo "base=$BASE"
exec /bin/bash "$BASE/bin/dashboard_browser.sh" "https://xfzoo.github.io/kindle-ai-quota-dashboard/"
