#!/bin/bash
# Removes the marker created by create-fleet-playwright-marker.sh. Idempotent.
set -euo pipefail
MARKER=/tmp/fleet-playwright-marker.txt
rm -f "$MARKER"
echo "Removed $MARKER"
