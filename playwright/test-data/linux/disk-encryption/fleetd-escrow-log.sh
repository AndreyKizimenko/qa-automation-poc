#!/bin/bash
# Prints fleetd's key-escrow log lines since a moment (Unix seconds), without timestamps or the host's
# name: an escrow request it picked up, the path it took, and each dialog it launched. Reads only fleetd's
# own journal.
set -eu
journalctl -u orbit --since "@__SINCE__" --no-pager -o cat 2>/dev/null \
  | grep -E "escrow requested|escrow path|program=(zenity|kdialog)|dialog tool|passphrase" \
  | sed -E 's/^[0-9TZ:.-]+ //' | cut -c1-160 || true
