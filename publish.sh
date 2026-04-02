#!/bin/bash
# publish.sh - Push an HTML file to GitHub Pages and return the live URL
# Usage: bash /c/tmp/kamg-client-reports/publish.sh <source-html-path> <client-slug> [filename]
# Example: bash /c/tmp/kamg-client-reports/publish.sh ./report.html cod audit-q2-2026
# Returns: https://kasandzz.github.io/kamg-client-reports/cod/audit-q2-2026.html

set -euo pipefail

REPO_DIR="/c/tmp/kamg-client-reports"
BASE_URL="https://kasandzz.github.io/kamg-client-reports"

SOURCE="$1"
CLIENT="${2:-misc}"
FILENAME="${3:-$(date +%Y%m%d-%H%M%S)}"

# Ensure .html extension
[[ "$FILENAME" != *.html ]] && FILENAME="${FILENAME}.html"

# Create client directory
mkdir -p "${REPO_DIR}/${CLIENT}"

# Copy file
cp "$SOURCE" "${REPO_DIR}/${CLIENT}/${FILENAME}"

# Commit and push
cd "$REPO_DIR"
git add "${CLIENT}/${FILENAME}"
git commit -m "publish(${CLIENT}): ${FILENAME}"
git push origin main

# Output the live URL
echo "${BASE_URL}/${CLIENT}/${FILENAME}"
