#!/bin/bash
BASE="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
exec "$BASE/bin/dashboard_browser.sh" "https://xfzoo.github.io/kindle-ai-quota-dashboard/"
