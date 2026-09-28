#!/bin/bash
# Builds fleet-playwright-<role>-<version>.msi: a per-machine MSI that installs
# one marker file under "C:\Program Files\Fleet Playwright <Role>\" and nothing
# else — no custom actions, no services, no registry beyond Windows Installer's
# own Programs entry, which is what puts it in Fleet's software inventory.
# Needs msitools (`brew install msitools` / `apt install wixl`):
#
#   ./make-msi.sh install 1.0.0     # premium/software/install-on-host.spec.ts
#   ./make-msi.sh uninstall 1.0.0   # premium/software/uninstall-from-host.spec.ts
#
# One package per spec, for the reason make-pkg.sh gives: a premium title can
# hold several packages, and two specs sharing one would share a Library row.
#
# The UpgradeCode is derived from the role, so every version of one role is the
# same product to Windows Installer and a newer build upgrades an older one.
set -euo pipefail

ROLE="${1:?usage: make-msi.sh <role> [version]}"
VERSION="${2:-1.0.0}"
NAME="Fleet Playwright $(tr '[:lower:]' '[:upper:]' <<< "${ROLE:0:1}")${ROLE:1}"
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/fleet-playwright-$ROLE-$VERSION.msi"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Deterministic GUIDs: a v5-style UUID from the role (and version, for the
# per-build ProductCode). The component GUID stays fixed per role.
guid() { python3 -c "import uuid,sys; print(str(uuid.uuid5(uuid.NAMESPACE_URL, sys.argv[1])).upper())" "$1"; }

printf 'fleet playwright fixture %s %s\r\n' "$ROLE" "$VERSION" > "$WORK/marker.txt"
cat > "$WORK/product.wxs" <<WXS
<?xml version="1.0" encoding="utf-8"?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">
  <Product Id="$(guid "fleet-playwright-$ROLE-$VERSION")" Name="$NAME" Language="1033"
           Version="$VERSION" Manufacturer="Fleet QA"
           UpgradeCode="$(guid "fleet-playwright-$ROLE-upgrade")">
    <Package InstallerVersion="200" Compressed="yes" InstallScope="perMachine"
             Description="Inert fixture package for the Fleet Playwright suite" />
    <MajorUpgrade DowngradeErrorMessage="A newer $NAME is already installed." />
    <Media Id="1" Cabinet="fixture.cab" EmbedCab="yes" />
    <Directory Id="TARGETDIR" Name="SourceDir">
      <Directory Id="ProgramFiles64Folder">
        <Directory Id="INSTALLDIR" Name="$NAME">
          <Component Id="Marker" Guid="$(guid "fleet-playwright-$ROLE-marker")" Win64="yes">
            <File Id="MarkerFile" Name="marker.txt" Source="$WORK/marker.txt" KeyPath="yes" />
          </Component>
        </Directory>
      </Directory>
    </Directory>
    <Feature Id="Main" Level="1">
      <ComponentRef Id="Marker" />
    </Feature>
  </Product>
</Wix>
WXS

wixl -a x64 -o "$OUT" "$WORK/product.wxs"
echo "$OUT  $(stat -f%z "$OUT" 2>/dev/null || stat -c%s "$OUT") bytes"
