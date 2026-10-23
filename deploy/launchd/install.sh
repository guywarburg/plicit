#!/usr/bin/env bash
# Install Plicit launchd agents into ~/Library/LaunchAgents.
# Substitutes USERNAME and node paths for the current user before loading.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TARGET_DIR="$HOME/Library/LaunchAgents"
LOG_DIR="$HOME/Library/Logs/plicit"
NODE_BIN="$(dirname "$(which node)")"
USERNAME="$(whoami)"

mkdir -p "$TARGET_DIR" "$LOG_DIR"

for src in "$REPO_ROOT"/deploy/launchd/dev.plicit.*.plist; do
  name="$(basename "$src")"
  dest="$TARGET_DIR/$name"
  echo "→ $dest"
  sed \
    -e "s|/Users/USERNAME|$HOME|g" \
    -e "s|/Users/USERNAME/.nvm/versions/node/v22.20.0/bin|$NODE_BIN|g" \
    -e "s|USERNAME|$USERNAME|g" \
    "$src" > "$dest"
done

echo
echo "Now load with:"
echo "  launchctl load ~/Library/LaunchAgents/dev.plicit.listener.plist"
echo "  launchctl load ~/Library/LaunchAgents/dev.plicit.analyzer.plist"
echo "  launchctl load ~/Library/LaunchAgents/dev.plicit.summarizer.plist"
