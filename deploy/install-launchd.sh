#!/bin/bash
#
# Deploy the news-reporter schedule as a macOS LaunchAgent.
#
# Why launchd instead of cron: `agy` reads its OAuth credentials through the
# macOS login Keychain. The cron daemon runs in a separate security session
# that cannot access the login Keychain, so `agy` demands re-login. A
# LaunchAgent runs inside the user's GUI login session, where the Keychain is
# reachable. See README "Scheduling (macOS launchd)" for details.
#
# Usage:
#   deploy/install-launchd.sh            # install + load (default)
#   deploy/install-launchd.sh uninstall  # unload + remove
#   deploy/install-launchd.sh status     # show current state
#   deploy/install-launchd.sh run        # trigger one run now (for testing)

set -euo pipefail

LABEL="com.erwin.news-reporter"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_PLIST="${REPO_DIR}/deploy/${LABEL}.plist"
DEST_PLIST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
DOMAIN="gui/$(id -u)"
SERVICE="${DOMAIN}/${LABEL}"

cmd="${1:-install}"

case "$cmd" in
  install)
    echo "==> Installing ${LABEL}"
    mkdir -p "${HOME}/Library/LaunchAgents"
    # Copy the versioned plist into LaunchAgents.
    cp "$SRC_PLIST" "$DEST_PLIST"
    echo "    copied $SRC_PLIST -> $DEST_PLIST"

    # Reload cleanly: bootout any previous instance, then bootstrap fresh.
    launchctl bootout "$SERVICE" 2>/dev/null || true
    launchctl bootstrap "$DOMAIN" "$DEST_PLIST"
    echo "    bootstrapped $SERVICE"

    # Remove the old cron entry if it still references this repo, to avoid
    # double-runs (cron would still fail the Keychain check anyway).
    if crontab -l 2>/dev/null | grep -q "news-reporter/run.sh"; then
      echo "==> Removing old crontab entry for news-reporter/run.sh"
      crontab -l 2>/dev/null | grep -v "news-reporter/run.sh" | crontab -
    fi

    echo "==> Done. Verify with: $0 status"
    echo "    Test a run now with:  $0 run"
    ;;

  uninstall)
    echo "==> Uninstalling ${LABEL}"
    launchctl bootout "$SERVICE" 2>/dev/null || true
    rm -f "$DEST_PLIST"
    echo "    removed $DEST_PLIST"
    ;;

  status)
    echo "==> ${SERVICE}"
    launchctl print "$SERVICE" 2>/dev/null | grep -E "state|program|run interval|last exit|path" || \
      echo "    (not loaded)"
    ;;

  run)
    echo "==> Kickstarting ${SERVICE} (one-off test run)"
    launchctl kickstart -k "$SERVICE"
    echo "    Tail the log with: tail -f ${REPO_DIR}/logs/cron.log"
    ;;

  *)
    echo "Unknown command: $cmd" >&2
    echo "Usage: $0 [install|uninstall|status|run]" >&2
    exit 1
    ;;
esac
