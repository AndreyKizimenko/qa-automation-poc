#!/bin/bash
# Starts the helper that answers fleetd's passphrase dialog, and returns at once. fleetd fetches its next
# script only after the dialog's round has ended, so the helper has to be waiting before Create key is
# clicked. It runs as the desktop user, reads the host's test passphrase on stdin from a root-only file,
# and writes a log with nothing secret in it.
set -eu
user=qa
uid=$(id -u "$user")
passphrase_file=/root/luks-test-passphrase
helper=/tmp/pw-luks-answer.py
log=/tmp/pw-luks-answer.log
[ -r "$passphrase_file" ] || { echo "no test passphrase on this host"; exit 1; }
wayland=$(ls "/run/user/$uid" | grep -E '^wayland-[0-9]+$' | head -1)
[ -n "$wayland" ] || { echo "no Wayland session for $user"; exit 1; }
pkill -u "$user" -f "$helper" 2>/dev/null || true
cat > "$helper" <<'PY'
__HELPER__
PY
chmod 644 "$helper"
setsid sudo -n -u "$user" env \
  WAYLAND_DISPLAY="$wayland" DISPLAY=":${wayland#wayland-}" \
  DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$uid/bus" XDG_RUNTIME_DIR="/run/user/$uid" \
  python3 "$helper" __MODE__ __SECONDS__ < "$passphrase_file" > "$log" 2>&1 &
sleep 1
echo "helper started for $user on $wayland, mode __MODE__"
