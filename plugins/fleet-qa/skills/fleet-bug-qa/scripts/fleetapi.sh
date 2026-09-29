#!/bin/bash
# usage: fleetapi.sh <fleetctl-context> <METHOD> <path> [json-body | @file.json]
#        fleetapi.sh <ctx> <METHOD> <path> -F field=value -F software=@pkg.sh ...   (multipart upload)
# Reads address + token for the context straight from ~/.fleet/config. Set FLEET_TOKEN to act as another user.
CTX="$1"; METHOD="$2"; PATHX="$3"; shift 3
ADDR=$(awk -v c="  $CTX:" '$0==c{f=1;next} f&&/^  [a-z]/{exit} f&&/address:/{print $2}' ~/.fleet/config)
TOKEN=${FLEET_TOKEN:-$(awk -v c="  $CTX:" '$0==c{f=1;next} f&&/^  [a-z]/{exit} f&&/token:/{print $2}' ~/.fleet/config)}
[ -z "$ADDR" ] && { echo "no fleetctl context '$CTX' in ~/.fleet/config" >&2; exit 2; }
if [ "$1" == "-F" ]; then
  curl -s -X "$METHOD" -H "Authorization: Bearer $TOKEN" "$@" "$ADDR$PATHX"
elif [ -n "$1" ]; then
  curl -s -X "$METHOD" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$1" "$ADDR$PATHX"
else
  curl -s -X "$METHOD" -H "Authorization: Bearer $TOKEN" "$ADDR$PATHX"
fi
