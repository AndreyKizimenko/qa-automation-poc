#!/bin/bash
# Builds fleet-playwright-<role>-<version>.pkg: an unsigned component package
# that installs one inert app bundle, /Applications/Fleet Playwright <Role>.app,
# and nothing else — no scripts, no launch items. Run on macOS (needs pkgbuild):
#
#   ./make-pkg.sh install 1.0.0     # premium/software/install-on-host.spec.ts
#   ./make-pkg.sh uninstall 1.0.0   # premium/software/uninstall-from-host.spec.ts
#
# One package per spec, because a premium title can hold several packages: two
# specs uploading the same title to the VMs fleet would share one Library row.
#
# Why an app bundle: Fleet's macOS software inventory comes from osquery's
# `apps` table, which lists .app bundles. A package that only drops files (the gh
# CLI .pkg next to this one, say) installs fine but never appears in inventory,
# so an install spec could never see it land.
#
# The bundle's executable is a shell stub that exits 0; nothing ever launches it.
# File timestamps are pinned so a rebuild differs only in pkgbuild's own metadata.
set -euo pipefail

ROLE="${1:?usage: make-pkg.sh <role> [version]}"
VERSION="${2:-1.0.0}"
NAME="Fleet Playwright $(tr '[:lower:]' '[:upper:]' <<< "${ROLE:0:1}")${ROLE:1}"
BUNDLE_ID="com.fleetdm.playwright.$ROLE"
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/fleet-playwright-$ROLE-$VERSION.pkg"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

APP="$WORK/root/$NAME.app/Contents"
mkdir -p "$APP/MacOS"
cat > "$APP/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key><string>fleet-playwright-$ROLE</string>
  <key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
  <key>CFBundleName</key><string>$NAME</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
</dict>
</plist>
PLIST
printf '#!/bin/sh\nexit 0\n' > "$APP/MacOS/fleet-playwright-$ROLE"
chmod 755 "$APP/MacOS/fleet-playwright-$ROLE"
find "$WORK/root" -exec touch -h -t 200001010000 {} +

pkgbuild \
  --root "$WORK/root" \
  --identifier "$BUNDLE_ID" \
  --version "$VERSION" \
  --install-location /Applications \
  "$OUT" >/dev/null
echo "$OUT  $(stat -f%z "$OUT") bytes"
