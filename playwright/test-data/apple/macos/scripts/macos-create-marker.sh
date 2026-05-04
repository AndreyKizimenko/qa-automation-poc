#!/bin/bash
# Creates a marker file so an osquery `file` table check can confirm execution.
set -euo pipefail
MARKER=/tmp/fleet-playwright-marker.txt
echo "fleet-playwright created $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$MARKER"
echo "Created $MARKER"
