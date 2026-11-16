#!/bin/bash
# Removes every key slot above 1 from the root disk: the ones fleetd's escrows added. Slot 0 holds the boot
# passphrase and slot 1 the test passphrase, which authorizes the removal; neither is ever touched. Prints the
# slots left (`slots: 0 1`). One script, so that a test's cleanup is one round trip to the host.
set -eu
device=$(lsblk -rno PATH,FSTYPE | awk '$2 == "crypto_LUKS" { print $1; exit }')
[ -n "$device" ] || { echo "no LUKS device"; exit 1; }
slots() {
  cryptsetup luksDump "$device" | awk '/^Keyslots:/ { k = 1; next } /^[A-Z]/ { k = 0 } k && /^ +[0-9]+: luks2/ { sub(":", "", $1); printf " %s", $1 }'
}
for slot in $(slots); do
  [ "$slot" -ge 2 ] || continue
  cryptsetup luksKillSlot -q --key-file /root/luks-test-passphrase "$device" "$slot"
  echo "removed slot $slot"
done
echo "slots:$(slots)"
