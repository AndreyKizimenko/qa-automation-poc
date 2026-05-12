#!/bin/bash
set -e

# Self-contained generator for QA load-test GitOps configuration.
# Creates all test data and a team-load-test.yml — no external dependencies.
#
# Usage:
#   ./generate.sh              Generate everything in ./generated/
#   ./generate.sh --clean      Remove generated data
#
# Then apply:
#   1. Edit generated/team-load-test.yml — replace the TODO placeholders for name and secret
#   2. Run: /path/to/fleet/build/fleetctl gitops -f ./generated/team-load-test.yml

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GEN_DIR="$SCRIPT_DIR/generated"

if [ "$1" = "--clean" ]; then
  echo "Cleaning generated data..."
  rm -rf "$GEN_DIR"
  echo "Done."
  exit 0
fi

echo "Generating QA load-test data in $GEN_DIR ..."

mkdir -p "$GEN_DIR"/{policies,reports,labels}
mkdir -p "$GEN_DIR"/scripts/{macos,windows,linux,python}
mkdir -p "$GEN_DIR"/profiles/{macos,windows,android}
mkdir -p "$GEN_DIR"/software

# ══════════════════════════════════════════════
# Profiles
# ══════════════════════════════════════════════

echo "  Generating 100 macOS profiles..."
for i in $(seq 1 100); do
  num=$(printf '%03d' $i)
  UUID1=$(printf 'QA%06d-0001-4000-A000-%012d' $i $i)
  UUID2=$(printf 'QA%06d-0002-4000-A000-%012d' $i $i)
  cat > "$GEN_DIR/profiles/macos/qa-macos-profile-$num.mobileconfig" <<PROFEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>PayloadContent</key>
	<array>
		<dict>
			<key>PayloadDescription</key>
			<string>QA load-test profile $num</string>
			<key>PayloadDisplayName</key>
			<string>QA macOS Load Test $num</string>
			<key>PayloadIdentifier</key>
			<string>com.fleetdm.qa.loadtest.macos.$num.inner</string>
			<key>PayloadType</key>
			<string>com.apple.defaults.managed</string>
			<key>PayloadUUID</key>
			<string>$UUID1</string>
			<key>PayloadVersion</key>
			<integer>1</integer>
		</dict>
	</array>
	<key>PayloadDescription</key>
	<string>QA load-test macOS profile $num of 100</string>
	<key>PayloadDisplayName</key>
	<string>QA macOS Load Test Profile $num</string>
	<key>PayloadIdentifier</key>
	<string>com.fleetdm.qa.loadtest.macos.$num</string>
	<key>PayloadOrganization</key>
	<string>Fleet QA</string>
	<key>PayloadScope</key>
	<string>System</string>
	<key>PayloadType</key>
	<string>Configuration</string>
	<key>PayloadUUID</key>
	<string>$UUID2</string>
	<key>PayloadVersion</key>
	<integer>1</integer>
</dict>
</plist>
PROFEOF
done

echo "  Generating 100 Windows profiles..."
for i in $(seq 1 100); do
  num=$(printf '%03d' $i)
  cat > "$GEN_DIR/profiles/windows/qa-windows-profile-$num.xml" <<WINPROFEOF
<Replace>
  <Item>
    <Meta>
      <Format xmlns="syncml:metinf">chr</Format>
    </Meta>
    <Target>
      <LocURI>./Vendor/MSFT/Policy/Config/QALoadTest/Setting$num</LocURI>
    </Target>
    <Data>enabled-$num</Data>
  </Item>
</Replace>
WINPROFEOF
done

echo "  Generating 5 Android profiles..."
ANDROID_SAFE_KEYS=(privateKeySelectionEnabled screenCaptureDisabled cameraDisabled bluetoothDisabled shareLocationDisabled)
for i in $(seq 1 5); do
  num=$(printf '%03d' $i)
  key="${ANDROID_SAFE_KEYS[$((i - 1))]}"
  cat > "$GEN_DIR/profiles/android/qa-android-profile-$num.json" <<ANDROIDEOF
{
  "$key": true
}
ANDROIDEOF
done

# ══════════════════════════════════════════════
# Scripts (100 per type)
# ══════════════════════════════════════════════

echo "  Generating 100 macOS scripts..."
for i in $(seq 1 100); do
  num=$(printf '%03d' $i)
  cat > "$GEN_DIR/scripts/macos/qa-macos-$num.sh" <<'MACEOF'
#!/bin/sh
# QA load-test script for macOS - SCRIPT_NUM
MARKER_DIR="/tmp/fleet-qa/macos"
mkdir -p "$MARKER_DIR"
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) - Script SCRIPT_NUM executed on $(hostname)" > "$MARKER_DIR/script-SCRIPT_NUM.log"
exit 0
MACEOF
  sed -i '' "s/SCRIPT_NUM/$num/g" "$GEN_DIR/scripts/macos/qa-macos-$num.sh"
  chmod +x "$GEN_DIR/scripts/macos/qa-macos-$num.sh"
done

echo "  Generating 100 Windows scripts..."
for i in $(seq 1 100); do
  num=$(printf '%03d' $i)
  cat > "$GEN_DIR/scripts/windows/qa-windows-$num.ps1" <<WINEOF
# QA load-test script for Windows - $num
\$markerDir = Join-Path \$env:TEMP "fleet-qa\\windows"
if (-not (Test-Path \$markerDir)) { New-Item -ItemType Directory -Path \$markerDir -Force | Out-Null }
\$timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
"\$timestamp - Script $num executed on \$(\$env:COMPUTERNAME)" | Out-File -FilePath (Join-Path \$markerDir "script-$num.log") -Encoding UTF8
exit 0
WINEOF
done

echo "  Generating 100 Python scripts..."
for i in $(seq 1 100); do
  num=$(printf '%03d' $i)
  cat > "$GEN_DIR/scripts/python/qa-python-$num.py" <<PYEOF
#!/usr/bin/env python3
"""QA load-test script (Python) - $num"""
import os, datetime, socket
marker_dir = os.path.join("/tmp", "fleet-qa", "python")
os.makedirs(marker_dir, exist_ok=True)
ts = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
with open(os.path.join(marker_dir, "script-$num.log"), "w") as f:
    f.write(f"{ts} - Script $num executed on {socket.gethostname()}\n")
PYEOF
  chmod +x "$GEN_DIR/scripts/python/qa-python-$num.py"
done

echo "  Generating 100 Linux scripts..."
for i in $(seq 1 100); do
  num=$(printf '%03d' $i)
  cat > "$GEN_DIR/scripts/linux/qa-linux-$num.sh" <<'LINEOF'
#!/bin/sh
# QA load-test script for Linux - SCRIPT_NUM
MARKER_DIR="/tmp/fleet-qa/linux"
mkdir -p "$MARKER_DIR"
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) - Script SCRIPT_NUM executed on $(hostname)" > "$MARKER_DIR/script-SCRIPT_NUM.log"
exit 0
LINEOF
  sed -i '' "s/SCRIPT_NUM/$num/g" "$GEN_DIR/scripts/linux/qa-linux-$num.sh"
  chmod +x "$GEN_DIR/scripts/linux/qa-linux-$num.sh"
done

# ══════════════════════════════════════════════
# Script-only software packages (80 sh + 80 ps1)
# ══════════════════════════════════════════════

echo "  Generating 80 macOS script packages..."
for i in $(seq 1 80); do
  num=$(printf '%03d' $i)
  cat > "$GEN_DIR/software/qa-install-macos-$num.sh" <<SHPKGEOF
#!/bin/sh
# QA load-test script-only package for macOS - $num
mkdir -p /tmp/fleet-qa/software
date -u +%Y-%m-%dT%H:%M:%SZ > /tmp/fleet-qa/software/pkg-macos-$num.log
exit 0
SHPKGEOF
  chmod +x "$GEN_DIR/software/qa-install-macos-$num.sh"
done

echo "  Generating 80 Windows script packages..."
for i in $(seq 1 80); do
  num=$(printf '%03d' $i)
  cat > "$GEN_DIR/software/qa-install-windows-$num.ps1" <<PSPKGEOF
# QA load-test script-only package for Windows - $num
New-Item -ItemType Directory -Path "C:\fleet-qa\software" -Force | Out-Null
Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ" | Out-File -FilePath "C:\fleet-qa\software\pkg-windows-$num.log" -Encoding UTF8
exit 0
PSPKGEOF
done

echo "  Generating 80 Linux script packages..."
for i in $(seq 1 80); do
  num=$(printf '%03d' $i)
  cat > "$GEN_DIR/software/qa-install-linux-$num.sh" <<LINPKGEOF
#!/bin/sh
# QA load-test script-only package for Linux - $num
mkdir -p /tmp/fleet-qa/software
date -u +%Y-%m-%dT%H:%M:%SZ > /tmp/fleet-qa/software/pkg-linux-$num.log
exit 0
LINPKGEOF
  chmod +x "$GEN_DIR/software/qa-install-linux-$num.sh"
done

# ══════════════════════════════════════════════
# Policies (500)
# ══════════════════════════════════════════════

POLICY_NAMES=(
  "Hostname is set" "osquery is reporting" "System uptime check"
  "OS version present" "Network interface exists" "CPU is active"
  "Memory is available" "Disk is present" "System clock is valid"
  "Platform info available"
)
POLICY_QUERIES=(
  "SELECT 1 FROM system_info WHERE hostname IS NOT NULL AND hostname != '';"
  "SELECT 1 FROM osquery_info WHERE version IS NOT NULL AND pid > 0;"
  "SELECT 1 FROM uptime WHERE total_seconds > 0;"
  "SELECT 1 FROM os_version WHERE major > 0;"
  "SELECT 1 FROM interface_addresses WHERE address IS NOT NULL LIMIT 1;"
  "SELECT 1 FROM cpu_time WHERE user > 0 LIMIT 1;"
  "SELECT 1 FROM memory_info WHERE memory_total > 0;"
  "SELECT 1 FROM disk_info WHERE disk_size > 0 LIMIT 1;"
  "SELECT 1 FROM time WHERE unix_time > 0;"
  "SELECT 1 FROM platform_info WHERE vendor IS NOT NULL;"
)

echo "  Generating 500 policies..."
for i in $(seq 1 500); do
  idx=$(( (i - 1) % 10 ))
  cat > "$GEN_DIR/policies/policy-$(printf '%04d' $i).yml" <<POLICYEOF
- name: "Load test - ${POLICY_NAMES[$idx]} (#$i)"
  query: "${POLICY_QUERIES[$idx]}"
  critical: $([ $((i % 3)) -eq 0 ] && echo "true" || echo "false")
  description: "Load test policy $i of 500. Validates: ${POLICY_NAMES[$idx]}."
  resolution: "This is an automated load-test policy. No action required."
  platform: "darwin,linux,windows"
POLICYEOF
done

# ══════════════════════════════════════════════
# Reports (500)
# ══════════════════════════════════════════════

REPORT_NAMES=(
  "System information" "OS version details" "Uptime details"
  "Network interfaces" "CPU time stats" "Memory usage"
  "Disk information" "Current time" "Platform details" "osquery status"
)
REPORT_QUERIES=(
  "SELECT hostname, cpu_brand, physical_memory FROM system_info;"
  "SELECT name, version, major, minor, patch, platform FROM os_version;"
  "SELECT days, hours, minutes, total_seconds FROM uptime;"
  "SELECT interface, address, type FROM interface_addresses;"
  "SELECT core, user, nice, system, idle FROM cpu_time;"
  "SELECT memory_total, memory_free, cached, swap_total, swap_free FROM memory_info;"
  "SELECT disk_index, type, disk_size, pci_slot FROM disk_info;"
  "SELECT unix_time, timestamp, datetime, iso_8601 FROM time;"
  "SELECT vendor, version, extra FROM platform_info;"
  "SELECT version, build_platform, config_hash, pid, start_time FROM osquery_info;"
)

echo "  Generating 500 reports..."
for i in $(seq 1 500); do
  idx=$(( (i - 1) % 10 ))
  cat > "$GEN_DIR/reports/report-$(printf '%04d' $i).yml" <<REPORTEOF
- name: "Load test - ${REPORT_NAMES[$idx]} (#$i)"
  description: "Load test report $i of 500. Collects: ${REPORT_NAMES[$idx]}."
  query: "${REPORT_QUERIES[$idx]}"
  interval: $(( (i % 5 + 1) * 3600 ))
  observer_can_run: true
  automations_enabled: false
  platform: "darwin,linux,windows"
REPORTEOF
done

# ══════════════════════════════════════════════
# Labels (500 — dynamic / host_vitals / manual)
# ══════════════════════════════════════════════

LABEL_QUERIES=(
  "SELECT 1 FROM system_info WHERE cpu_brand LIKE '%PLACEHOLDER%';"
  "SELECT 1 FROM os_version WHERE version LIKE '%PLACEHOLDER%';"
  "SELECT 1 FROM interface_addresses WHERE address LIKE 'PLACEHOLDER%';"
  "SELECT 1 FROM disk_info WHERE description LIKE '%PLACEHOLDER%';"
  "SELECT 1 FROM uptime WHERE total_seconds > PLACEHOLDER;"
  "SELECT 1 FROM system_info WHERE physical_memory > PLACEHOLDER;"
  "SELECT 1 FROM cpu_time WHERE user > PLACEHOLDER LIMIT 1;"
  "SELECT 1 FROM os_version WHERE major >= PLACEHOLDER;"
  "SELECT 1 FROM system_info WHERE hostname LIKE '%PLACEHOLDER%';"
  "SELECT 1 FROM platform_info WHERE vendor LIKE '%PLACEHOLDER%';"
)
LABEL_DESCRIPTIONS=(
  "Hosts with CPU matching pattern" "Hosts running OS version matching pattern"
  "Hosts with network address prefix" "Hosts with disk description matching pattern"
  "Hosts with uptime exceeding threshold" "Hosts with physical memory exceeding threshold"
  "Hosts with CPU user time exceeding threshold" "Hosts with OS major version at or above threshold"
  "Hosts with hostname matching pattern" "Hosts with platform vendor matching pattern"
)
LABEL_PLATFORMS=("darwin" "windows" "ubuntu" "" "darwin" "windows" "" "centos" "darwin" "")
DEPARTMENTS=("Engineering" "Sales" "Marketing" "Finance" "Legal" "HR" "Support" "Operations" "Design" "Product")

echo "  Generating 500 labels..."
for i in $(seq 1 500); do
  num=$(printf '%04d' $i)
  bucket=$(( (i - 1) % 20 ))

  if [ $bucket -lt 10 ]; then
    idx=$bucket
    case $idx in
      0|1|3|8|9) placeholder="test-$num" ;;
      2)         placeholder="10.$((i % 256))" ;;
      4)         placeholder="$((i * 100))" ;;
      5)         placeholder="$((i * 1073741824))" ;;
      6)         placeholder="$((i * 1000))" ;;
      7)         placeholder="$((10 + i % 10))" ;;
      *)         placeholder="$num" ;;
    esac
    query="${LABEL_QUERIES[$idx]/PLACEHOLDER/$placeholder}"
    platform="${LABEL_PLATFORMS[$idx]}"
    platform_line=""
    [ -n "$platform" ] && platform_line="  platform: $platform"
    cat > "$GEN_DIR/labels/label-$num.yml" <<LBLEOF
- name: "Load test - ${LABEL_DESCRIPTIONS[$idx]} (#$i)"
  description: "Load test label $i of 500. ${LABEL_DESCRIPTIONS[$idx]}."
  query: "$query"
  label_membership_type: dynamic
$platform_line
LBLEOF
  elif [ $bucket -lt 15 ]; then
    dept_idx=$(( (i - 1) % 10 ))
    cat > "$GEN_DIR/labels/label-$num.yml" <<LBLEOF
- name: "Load test - Department ${DEPARTMENTS[$dept_idx]} (#$i)"
  description: "Load test host vitals label $i of 500."
  label_membership_type: host_vitals
  criteria:
    vital: end_user_idp_department
    value: "${DEPARTMENTS[$dept_idx]} $i"
LBLEOF
  else
    platforms=("darwin" "windows" "ubuntu" "" "darwin")
    pidx=$(( (i - 1) % 5 ))
    platform="${platforms[$pidx]}"
    platform_line=""
    [ -n "$platform" ] && platform_line="  platform: $platform"
    cat > "$GEN_DIR/labels/label-$num.yml" <<LBLEOF
- name: "Load test - Manual group (#$i)"
  description: "Load test manual label $i of 500."
  label_membership_type: manual
$platform_line
  hosts:
    - "qa-host-$num-a.local"
    - "qa-host-$num-b.local"
    - "qa-host-$num-c.local"
LBLEOF
  fi
done

# ══════════════════════════════════════════════
# Generate team-load-test.yml
# ══════════════════════════════════════════════

echo "  Generating team-load-test.yml..."

TEAM_FILE="$GEN_DIR/team-load-test.yml"
cat > "$TEAM_FILE" <<'TEAMEOF'
name: # TODO: Replace with your team name
labels:
  - paths: ./labels/*.yml
settings:
  features:
    enable_host_users: true
    enable_software_inventory: true
  host_expiry_settings:
    host_expiry_enabled: false
    host_expiry_window: 0
  secrets:
    - secret: # TODO: Replace with your enroll secret
agent_options:
  config:
    decorators:
      load:
        - SELECT uuid AS host_uuid FROM system_info;
        - SELECT hostname AS hostname FROM system_info;
    options:
      disable_distributed: false
      distributed_interval: 10
      distributed_plugin: tls
      distributed_tls_max_attempts: 3
      logger_tls_endpoint: /api/osquery/log
      logger_tls_period: 10
      pack_delimiter: /
  update_channels:
    osqueryd: stable
    orbit: stable
    desktop: stable
controls:
  enable_disk_encryption: true
  apple_settings:
    configuration_profiles:
      - paths: ./profiles/macos/*.mobileconfig
  macos_updates:
    deadline:
    minimum_version:
    update_new_hosts: true
  windows_settings:
    configuration_profiles:
      - paths: ./profiles/windows/*.xml
  windows_updates:
    deadline_days: 7
    grace_period_days: 2
  ios_updates:
    deadline: "2026-06-01"
    minimum_version: "18.5"
  ipados_updates:
    deadline: "2026-06-01"
    minimum_version: "18.5"
  android_enabled_and_configured: true
  android_settings:
    configuration_profiles:
      - paths: ./profiles/android/*.json
    certificates:
TEAMEOF

# Append android certificates
for i in $(seq 1 100); do
  num=$(printf '%03d' $i)
  cat >> "$TEAM_FILE" <<CERTEOF
    - certificate_authority_name: ANDROID
      name: "Load test cert $num"
      subject_name: "CN=loadtest-$num.fleet.example.com"
CERTEOF
done

cat >> "$TEAM_FILE" <<'TEAMEOF2'
  scripts:
    - paths: ./scripts/macos/*.sh
    - paths: ./scripts/windows/*.ps1
    - paths: ./scripts/linux/*.sh
TEAMEOF2

# Python scripts need individual path: entries (glob skips .py)
for i in $(seq 1 100); do
  num=$(printf '%03d' $i)
  echo "    - path: ./scripts/python/qa-python-$num.py" >> "$TEAM_FILE"
done

cat >> "$TEAM_FILE" <<'TEAMEOF3'
policies:
  - paths: ./policies/*.yml
reports:
  - paths: ./reports/*.yml
software:
  packages:
TEAMEOF3

# Software packages need individual path: entries (no glob support)
for i in $(seq 1 80); do
  num=$(printf '%03d' $i)
  echo "    - path: ./software/qa-install-macos-$num.sh" >> "$TEAM_FILE"
done
for i in $(seq 1 80); do
  num=$(printf '%03d' $i)
  echo "    - path: ./software/qa-install-windows-$num.ps1" >> "$TEAM_FILE"
done
for i in $(seq 1 80); do
  num=$(printf '%03d' $i)
  echo "    - path: ./software/qa-install-linux-$num.sh" >> "$TEAM_FILE"
done

cat >> "$TEAM_FILE" <<'TEAMEOF4'
  fleet_maintained_apps:
    # macOS FMAs (all available)
    - slug: 010-editor/darwin
      self_service: true
    - slug: 1password/darwin
      self_service: true
    - slug: 8x8-work/darwin
      self_service: true
    - slug: abstract/darwin
      self_service: true
    - slug: adobe-acrobat-pro/darwin
      self_service: true
    - slug: adobe-acrobat-reader/darwin
      self_service: true
    - slug: adobe-creative-cloud/darwin
      self_service: true
    - slug: adobe-digital-editions/darwin
      self_service: true
    - slug: adobe-dng-converter/darwin
      self_service: true
    - slug: aircall/darwin
      self_service: true
    - slug: airtame/darwin
      self_service: true
    - slug: amazon-chime/darwin
      self_service: true
    - slug: android-studio/darwin
      self_service: true
    - slug: anka-virtualization/darwin
      self_service: true
    - slug: anydesk/darwin
      self_service: true
    - slug: apparency/darwin
      self_service: true
    - slug: appcleaner/darwin
      self_service: true
    - slug: arc/darwin
      self_service: true
    - slug: archaeology/darwin
      self_service: true
    - slug: arduino-ide/darwin
      self_service: true
    - slug: asana/darwin
      self_service: true
    - slug: audacity/darwin
      self_service: true
    - slug: avast-secure-browser/darwin
      self_service: true
    - slug: aws-vpn-client/darwin
      self_service: true
    - slug: backblaze/darwin
      self_service: true
    - slug: balenaetcher/darwin
      self_service: true
    - slug: bbedit/darwin
      self_service: true
    - slug: betterdisplay/darwin
      self_service: true
    - slug: beyond-compare/darwin
      self_service: true
    - slug: bitwarden/darwin
      self_service: true
    - slug: blender/darwin
      self_service: true
    - slug: box-drive/darwin
      self_service: true
    - slug: brave-browser/darwin
      self_service: true
    - slug: bruno/darwin
      self_service: true
    - slug: calibre/darwin
      self_service: true
    - slug: camtasia/darwin
      self_service: true
    - slug: canva/darwin
      self_service: true
    - slug: charles/darwin
      self_service: true
    - slug: chatgpt-atlas/darwin
      self_service: true
    - slug: chatgpt/darwin
      self_service: true
    - slug: cisco-jabber/darwin
      self_service: true
    - slug: citrix-workspace/darwin
      self_service: true
    - slug: claude/darwin
      self_service: true
    - slug: cleanmymac/darwin
      self_service: true
    - slug: cleanshot/darwin
      self_service: true
    - slug: clickup/darwin
      self_service: true
    - slug: clion/darwin
      self_service: true
    - slug: clockify/darwin
      self_service: true
    - slug: cloudflare-warp/darwin
      self_service: true
    - slug: connect-fonts/darwin
      self_service: true
    - slug: coteditor/darwin
      self_service: true
    - slug: crashplan/darwin
      self_service: true
    - slug: cursor/darwin
      self_service: true
    - slug: cyberduck/darwin
      self_service: true
    - slug: dash/darwin
      self_service: true
    - slug: datagrip/darwin
      self_service: true
    - slug: db-browser-for-sqlite/darwin
      self_service: true
    - slug: dbeaver-community/darwin
      self_service: true
    - slug: dbeaver-enterprise/darwin
      self_service: true
    - slug: dbeaverlite/darwin
      self_service: true
    - slug: dbeaverultimate/darwin
      self_service: true
    - slug: dcv-viewer/darwin
      self_service: true
    - slug: deepl/darwin
      self_service: true
    - slug: dialpad/darwin
      self_service: true
    - slug: discord/darwin
      self_service: true
    - slug: displaylink/darwin
      self_service: true
    - slug: docker-desktop/darwin
      self_service: true
    - slug: drawio/darwin
      self_service: true
    - slug: dropbox/darwin
      self_service: true
    - slug: eclipse-ide/darwin
      self_service: true
    - slug: egnyte/darwin
      self_service: true
    - slug: elgato-control-center/darwin
      self_service: true
    - slug: elgato-stream-deck/darwin
      self_service: true
    - slug: evernote/darwin
      self_service: true
    - slug: expressvpn/darwin
      self_service: true
    - slug: figma/darwin
      self_service: true
    - slug: filemaker-pro/darwin
      self_service: true
    - slug: firefox/darwin
      self_service: true
    - slug: firefox@esr/darwin
      self_service: true
    - slug: fork/darwin
      self_service: true
    - slug: front/darwin
      self_service: true
    - slug: ghostty/darwin
      self_service: true
    - slug: gimp/darwin
      self_service: true
    - slug: github/darwin
      self_service: true
    - slug: gitkraken/darwin
      self_service: true
    - slug: goland/darwin
      self_service: true
    - slug: google-chrome/darwin
      self_service: true
    - slug: google-drive/darwin
      self_service: true
    - slug: gpg-suite/darwin
      self_service: true
    - slug: grammarly-desktop/darwin
      self_service: true
    - slug: granola/darwin
      self_service: true
    - slug: hyper/darwin
      self_service: true
    - slug: iina/darwin
      self_service: true
    - slug: imazing-profile-editor/darwin
      self_service: true
    - slug: inkscape/darwin
      self_service: true
    - slug: insomnia/darwin
      self_service: true
    - slug: intellij-idea-ce/darwin
      self_service: true
    - slug: intellij-idea/darwin
      self_service: true
    - slug: intune-company-portal/darwin
      self_service: true
    - slug: iterm2/darwin
      self_service: true
    - slug: jabra-direct/darwin
      self_service: true
    - slug: jetbrains-toolbox/darwin
      self_service: true
    - slug: keepassxc/darwin
      self_service: true
    - slug: keeper-password-manager/darwin
      self_service: true
    - slug: keka/darwin
      self_service: true
    - slug: kitty/darwin
      self_service: true
    - slug: krita/darwin
      self_service: true
    - slug: lens/darwin
      self_service: true
    - slug: libreoffice/darwin
      self_service: true
    - slug: linear-linear/darwin
      self_service: true
    - slug: little-snitch/darwin
      self_service: true
    - slug: logi-options+/darwin
      self_service: true
    - slug: loom/darwin
      self_service: true
    - slug: lulu/darwin
      self_service: true
    - slug: maccy/darwin
      self_service: true
    - slug: mattermost/darwin
      self_service: true
    - slug: messenger/darwin
      self_service: true
    - slug: microsoft-auto-update/darwin
      self_service: true
    - slug: microsoft-edge/darwin
      self_service: true
    - slug: microsoft-excel/darwin
      self_service: true
    - slug: microsoft-onenote/darwin
      self_service: true
    - slug: microsoft-outlook/darwin
      self_service: true
    - slug: microsoft-powerpoint/darwin
      self_service: true
    - slug: microsoft-teams/darwin
      self_service: true
    - slug: microsoft-word/darwin
      self_service: true
    - slug: miro/darwin
      self_service: true
    - slug: mongodb-compass/darwin
      self_service: true
    - slug: mysqlworkbench/darwin
      self_service: true
    - slug: nextcloud/darwin
      self_service: true
    - slug: nordpass/darwin
      self_service: true
    - slug: nordvpn/darwin
      self_service: true
    - slug: notion-calendar/darwin
      self_service: true
    - slug: notion/darwin
      self_service: true
    - slug: nova/darwin
      self_service: true
    - slug: nudge/darwin
      self_service: true
    - slug: obs/darwin
      self_service: true
    - slug: obsidian/darwin
      self_service: true
    - slug: okta-verify/darwin
      self_service: true
    - slug: ollama/darwin
      self_service: true
    - slug: omnigraffle/darwin
      self_service: true
    - slug: omnissa-horizon-client/darwin
      self_service: true
    - slug: onedrive/darwin
      self_service: true
    - slug: opera/darwin
      self_service: true
    - slug: orbstack/darwin
      self_service: true
    - slug: p4v/darwin
      self_service: true
    - slug: parallels/darwin
      self_service: true
    - slug: pgadmin4/darwin
      self_service: true
    - slug: phpstorm/darwin
      self_service: true
    - slug: podman-desktop/darwin
      self_service: true
    - slug: postman/darwin
      self_service: true
    - slug: pritunl/darwin
      self_service: true
    - slug: privileges/darwin
      self_service: true
    - slug: proton-mail/darwin
      self_service: true
    - slug: protonvpn/darwin
      self_service: true
    - slug: proxifier/darwin
      self_service: true
    - slug: proxyman/darwin
      self_service: true
    - slug: pycharm-ce/darwin
      self_service: true
    - slug: pycharm/darwin
      self_service: true
    - slug: quip/darwin
      self_service: true
    - slug: rancher/darwin
      self_service: true
    - slug: rapidapi/darwin
      self_service: true
    - slug: raycast/darwin
      self_service: true
    - slug: rectangle/darwin
      self_service: true
    - slug: rider/darwin
      self_service: true
    - slug: royal-tsx/darwin
      self_service: true
    - slug: rubymine/darwin
      self_service: true
    - slug: rustrover/darwin
      self_service: true
    - slug: santa/darwin
      self_service: true
    - slug: sequel-ace/darwin
      self_service: true
    - slug: shottr/darwin
      self_service: true
    - slug: signal/darwin
      self_service: true
    - slug: sketch/darwin
      self_service: true
    - slug: slack/darwin
      self_service: true
    - slug: snagit/darwin
      self_service: true
    - slug: sourcetree/darwin
      self_service: true
    - slug: splashtop-business/darwin
      self_service: true
    - slug: splashtop-streamer/darwin
      self_service: true
    - slug: spotify/darwin
      self_service: true
    - slug: stats/darwin
      self_service: true
    - slug: steam/darwin
      self_service: true
    - slug: sublime-merge/darwin
      self_service: true
    - slug: sublime-text/darwin
      self_service: true
    - slug: surfshark/darwin
      self_service: true
    - slug: suspicious-package/darwin
      self_service: true
    - slug: tableau/darwin
      self_service: true
    - slug: tableplus/darwin
      self_service: true
    - slug: tailscale-app/darwin
      self_service: true
    - slug: teamviewer/darwin
      self_service: true
    - slug: telegram/darwin
      self_service: true
    - slug: teleport-connect/darwin
      self_service: true
    - slug: teleport-suite/darwin
      self_service: true
    - slug: textexpander/darwin
      self_service: true
    - slug: the-unarchiver/darwin
      self_service: true
    - slug: thunderbird/darwin
      self_service: true
    - slug: todoist-app/darwin
      self_service: true
    - slug: tor-browser/darwin
      self_service: true
    - slug: tower/darwin
      self_service: true
    - slug: transmit/darwin
      self_service: true
    - slug: tunnelblick/darwin
      self_service: true
    - slug: twingate/darwin
      self_service: true
    - slug: utm/darwin
      self_service: true
    - slug: virtualbox/darwin
      self_service: true
    - slug: viscosity/darwin
      self_service: true
    - slug: visual-studio-code/darwin
      self_service: true
    - slug: vlc/darwin
      self_service: true
    - slug: vnc-viewer/darwin
      self_service: true
    - slug: wacom-tablet/darwin
      self_service: true
    - slug: warp/darwin
      self_service: true
    - slug: webex/darwin
      self_service: true
    - slug: webstorm/darwin
      self_service: true
    - slug: whatsapp/darwin
      self_service: true
    - slug: windows-app/darwin
      self_service: true
    - slug: windsurf/darwin
      self_service: true
    - slug: wireshark-app/darwin
      self_service: true
    - slug: wrike/darwin
      self_service: true
    - slug: yubico-authenticator/darwin
      self_service: true
    - slug: yubico-yubikey-manager/darwin
      self_service: true
    - slug: zed/darwin
      self_service: true
    - slug: zeplin/darwin
      self_service: true
    - slug: zoom/darwin
      self_service: true
    - slug: zotero/darwin
      self_service: true
    # Windows FMAs (all available)
    - slug: 010-editor/windows
      self_service: true
    - slug: 1password/windows
      self_service: true
    - slug: 7-zip/windows
      self_service: true
    - slug: 8x8-work/windows
      self_service: true
    - slug: adobe-acrobat-reader/windows
      self_service: true
    - slug: aircall/windows
      self_service: true
    - slug: airtame/windows
      self_service: true
    - slug: asana/windows
      self_service: true
    - slug: blender/windows
      self_service: true
    - slug: box-drive/windows
      self_service: true
    - slug: brave-browser/windows
      self_service: true
    - slug: camtasia/windows
      self_service: true
    - slug: cisco-jabber/windows
      self_service: true
    - slug: claude/windows
      self_service: true
    - slug: clickup/windows
      self_service: true
    - slug: cloudflare-warp/windows
      self_service: true
    - slug: crashplan/windows
      self_service: true
    - slug: cursor/windows
      self_service: true
    - slug: cyberduck/windows
      self_service: true
    - slug: discord/windows
      self_service: true
    - slug: docker/windows
      self_service: true
    - slug: figma/windows
      self_service: true
    - slug: firefox/windows
      self_service: true
    - slug: firefox@esr/windows
      self_service: true
    - slug: gimp/windows
      self_service: true
    - slug: github-desktop/windows
      self_service: true
    - slug: google-chrome/windows
      self_service: true
    - slug: google-drive/windows
      self_service: true
    - slug: inkscape/windows
      self_service: true
    - slug: keepassxc/windows
      self_service: true
    - slug: krita/windows
      self_service: true
    - slug: lastpass/windows
      self_service: true
    - slug: microsoft-edge/windows
      self_service: true
    - slug: notepad++/windows
      self_service: true
    - slug: notion/windows
      self_service: true
    - slug: obs/windows
      self_service: true
    - slug: ollama/windows
      self_service: true
    - slug: postman/windows
      self_service: true
    - slug: putty/windows
      self_service: true
    - slug: slack/windows
      self_service: true
    - slug: sourcetree/windows
      self_service: true
    - slug: spotify/windows
      self_service: true
    - slug: steam/windows
      self_service: true
    - slug: sublime-text/windows
      self_service: true
    - slug: tailscale/windows
      self_service: true
    - slug: teamviewer/windows
      self_service: true
    - slug: telegram/windows
      self_service: true
    - slug: twingate/windows
      self_service: true
    - slug: visual-studio-code/windows
      self_service: true
    - slug: vlc/windows
      self_service: true
    - slug: webex/windows
      self_service: true
    - slug: wireshark/windows
      self_service: true
    - slug: yubico-authenticator/windows
      self_service: true
    - slug: zoom/windows
      self_service: true
    - slug: zotero/windows
      self_service: true
  # NOTE: Apple VPP apps removed to avoid name conflicts with FMAs.
  # Add macOS/iOS/iPadOS app_store_apps here if your VPP token has apps that don't overlap with FMA names above.
  app_store_apps:
    # Android apps
    - app_store_id: "com.openai.chatgpt"
      platform: android
      self_service: true
      setup_experience: true
    - app_store_id: "com.zhiliaoapp.musically"
      platform: android
      setup_experience: false
    - app_store_id: "com.instagram.android"
      platform: android
      self_service: true
      setup_experience: true
    - app_store_id: "com.netflix.mediaclient"
      platform: android
      self_service: true
      setup_experience: true
    - app_store_id: "com.sand.aircast"
      platform: android
      self_service: true
      setup_experience: true
    - app_store_id: "com.sand.remotesupportaddon"
      platform: android
      self_service: true
    - app_store_id: "com.sand.airdroid"
      platform: android
      self_service: true
    - app_store_id: "com.alltrails.alltrails"
      platform: android
      self_service: true
    - app_store_id: "com.google.android.apps.docs"
      platform: android
      self_service: true
    - app_store_id: "com.google.android.apps.docs.editors.docs"
      platform: android
      self_service: true
    - app_store_id: "com.google.android.apps.docs.editors.sheets"
      platform: android
      self_service: true
    - app_store_id: "com.google.android.apps.docs.editors.slides"
      platform: android
      self_service: true
    - app_store_id: "com.google.android.gm"
      platform: android
      self_service: true
    - app_store_id: "com.google.android.calendar"
      platform: android
      self_service: true
    - app_store_id: "com.microsoft.teams"
      platform: android
      self_service: true
    - app_store_id: "com.microsoft.office.outlook"
      platform: android
      self_service: true
    - app_store_id: "com.Slack"
      platform: android
      self_service: true
    - app_store_id: "com.spotify.music"
      platform: android
      self_service: true
    - app_store_id: "com.whatsapp"
      platform: android
      self_service: true
    - app_store_id: "com.dropbox.android"
      platform: android
      self_service: true
    - app_store_id: "com.evernote"
      platform: android
      self_service: true
    - app_store_id: "com.todoist"
      platform: android
      self_service: true
    - app_store_id: "com.figma.mirror"
      platform: android
      self_service: true
    - app_store_id: "com.github.android"
      platform: android
      self_service: true
    - app_store_id: "com.lastpass.lpandroid"
      platform: android
      self_service: true
TEAMEOF4

echo ""
echo "Generation complete. Output: $GEN_DIR/"
echo ""
echo "  team-load-test.yml  (the config to apply)"
echo "  policies/           500 policies"
echo "  reports/            500 reports"
echo "  labels/             500 labels (dynamic/host_vitals/manual)"
echo "  scripts/            400 scripts (100 macOS + 100 Windows + 100 Linux + 100 Python)"
echo "  profiles/           205 profiles (100 macOS + 100 Windows + 5 Android)"
echo "  software/           240 script-only packages (80 macOS + 80 Windows + 80 Linux)"
echo "  + 100 Android certificates, 276 FMAs, 28 Android apps"
echo ""
echo "Next steps:"
echo "  1. Edit $GEN_DIR/team-load-test.yml"
echo "     - Set 'name:' to your team name"
echo "     - Set 'secret:' to your enroll secret"
echo "  2. Apply with fleetctl (use your Fleet repo's built binary):"
echo "     /path/to/fleet/build/fleetctl gitops -f $GEN_DIR/team-load-test.yml"
