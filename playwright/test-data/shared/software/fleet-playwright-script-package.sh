#!/bin/sh

# Inert script-only software package for the Fleet Playwright suite.
# Writes a marker under the system temp dir and exits 0 on macOS and Linux.
echo "fleet playwright script-only package ran at $(date)" > /tmp/fleet-playwright-script-package.log
