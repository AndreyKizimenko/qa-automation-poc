#!/bin/bash
# Prints the root disk's LUKS key slot numbers, and nothing else of its header.
set -eu
device=$(lsblk -rno PATH,FSTYPE | awk '$2 == "crypto_LUKS" { print $1; exit }')
[ -n "$device" ] || { echo "no LUKS device"; exit 1; }
printf 'slots:'
cryptsetup luksDump "$device" | awk '/^Keyslots:/ { k = 1; next } /^[A-Z]/ { k = 0 } k && /^ +[0-9]+: luks2/ { sub(":", "", $1); printf " %s", $1 }'
echo
