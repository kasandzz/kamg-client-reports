#!/bin/bash
# publish.sh - Push an HTML file to GitHub Pages and return the live URL
# Usage: bash /c/tmp/kamg-client-reports/publish.sh <source-html-path> <client-slug> [filename]
# Example: bash /c/tmp/kamg-client-reports/publish.sh ./report.html cod audit-q2-2026
# Returns: https://kasandzz.github.io/kamg-client-reports/cod/audit-q2-2026.html

set -euo pipefail

REPO_DIR="/c/tmp/kamg-client-reports"
REPO_REMOTE="https://github.com/kasandzz/kamg-client-reports.git"
BASE_URL="https://kasandzz.github.io/kamg-client-reports"

SOURCE="$1"
CLIENT="${2:-misc}"
FILENAME="${3:-$(date +%Y%m%d-%H%M%S)}"

# Ensure .html extension
[[ "$FILENAME" != *.html ]] && FILENAME="${FILENAME}.html"

# Auto-recover: if local clone is missing, re-clone
if [[ ! -d "${REPO_DIR}/.git" ]]; then
  echo "Local clone missing, re-cloning..."
  rm -rf "$REPO_DIR"
  git clone "$REPO_REMOTE" "$REPO_DIR"
fi

cd "$REPO_DIR"

# Pull latest to avoid conflicts
git pull --rebase origin main 2>/dev/null || true

# Create client directory
mkdir -p "${CLIENT}"

# Copy file
cp "$SOURCE" "${CLIENT}/${FILENAME}"

# Commit and push
git add "${CLIENT}/${FILENAME}"
git commit -m "publish(${CLIENT}): ${FILENAME}"
git push origin main

# Output the live URL (takes ~30s for Pages to deploy)
echo "${BASE_URL}/${CLIENT}/${FILENAME}"
