#!/bin/bash
# usage: fleet_version.sh <fleetctl-context>...
# Prints each instance's build in bug-report format:
#   released build  -> fleet-v4.92.0
#   branch/RC build -> rc-minor-fleet-v4.93.0 (e700854)
for CTX in "$@"; do
  ADDR=$(awk -v c="  $CTX:" '$0==c{f=1;next} f&&/^  [a-z]/{exit} f&&/address:/{print $2}' ~/.fleet/config)
  TOKEN=$(awk -v c="  $CTX:" '$0==c{f=1;next} f&&/^  [a-z]/{exit} f&&/token:/{print $2}' ~/.fleet/config)
  [ -z "$ADDR" ] && { echo "$CTX: no such fleetctl context" >&2; continue; }
  curl -s -H "Authorization: Bearer $TOKEN" "$ADDR/api/v1/fleet/version" | python3 -c '
import sys, json
ctx = sys.argv[1]
try: d = json.load(sys.stdin)
except Exception: print(f"{ctx}: unreachable"); sys.exit()
v, b, r = d.get("version", ""), d.get("branch", ""), d.get("revision", "")[:7]
print(f"{ctx}: fleet-v{v}" if v and "-" not in v else f"{ctx}: {b} ({r})")' "$CTX"
done
