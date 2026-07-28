#!/usr/bin/env bash
# Scenario 6 — team transfers for the Windows MDM load test.
# Moves enrolled hosts from a SOURCE team to a DEST team in interactive batches.
# Both teams should already carry the full ~100-profile set, so each transfer forces a
# per-host remove of the source set + add of the dest set (the heaviest profile churn).
#
# Uses POST /api/latest/fleet/hosts/transfer with explicit host IDs so we control batch size.
# (The /transfer/filter endpoint moves ALL matching hosts at once and can't be capped.)
#
# IMPORTANT: keep BATCH_SIZE <= 30000. Single transfers larger than 30K are blocked by #46894.
# The script hard-refuses anything above 30000.
#
# Requires: bash, curl, jq.
#
# Usage:
#   export FLEET_URL="https://<instance>"        # no trailing slash
#   export FLEET_TOKEN="<api-only token>"
#   export SRC_TEAM_ID=1                          # move hosts OUT of this team
#   export DST_TEAM_ID=2                          # ...and INTO this team
#   export BATCH_SIZE=10000                       # optional, default 10000
#   ./transfer_hosts.sh
#
# Enumerated host IDs are cached to ids_<SRC>.txt so re-runs don't re-scan. Delete that
# file (or pass --refresh) to force a fresh enumeration.
set -euo pipefail

: "${FLEET_URL:?set FLEET_URL}"
: "${FLEET_TOKEN:?set FLEET_TOKEN}"
: "${SRC_TEAM_ID:?set SRC_TEAM_ID (source team to move hosts out of)}"
: "${DST_TEAM_ID:?set DST_TEAM_ID (destination team)}"
BATCH_SIZE="${BATCH_SIZE:-10000}"
PER_PAGE="${PER_PAGE:-1000}"

if (( BATCH_SIZE > 30000 )); then
  echo "BATCH_SIZE=$BATCH_SIZE exceeds the 30000 cap (#46894). Aborting." >&2
  exit 1
fi

command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }

AUTH=(-H "Authorization: Bearer ${FLEET_TOKEN}")
IDS_FILE="ids_${SRC_TEAM_ID}.txt"

# --- 1. Enumerate host IDs in the source team (cursor pagination on id) -------------
if [[ "${1:-}" == "--refresh" ]]; then rm -f "$IDS_FILE"; fi
if [[ -s "$IDS_FILE" ]]; then
  echo "Reusing cached host IDs in $IDS_FILE ($(wc -l < "$IDS_FILE" | tr -d ' ') hosts). Pass --refresh to rescan."
else
  echo "Enumerating hosts in source team $SRC_TEAM_ID ..."
  : > "$IDS_FILE"
  after=""
  page=0
  while :; do
    url="${FLEET_URL}/api/latest/fleet/hosts?team_id=${SRC_TEAM_ID}&order_key=id&order_direction=asc&per_page=${PER_PAGE}"
    [[ -n "$after" ]] && url="${url}&after=${after}"
    resp="$(curl -sS "${AUTH[@]}" "$url")"
    n="$(jq '.hosts | length' <<<"$resp")"
    [[ "$n" == "0" || "$n" == "null" ]] && break
    jq -r '.hosts[].id' <<<"$resp" >> "$IDS_FILE"
    after="$(jq -r '.hosts[-1].id' <<<"$resp")"
    page=$((page+1))
    printf '\r  fetched %d hosts...' "$(wc -l < "$IDS_FILE" | tr -d ' ')"
    [[ "$n" -lt "$PER_PAGE" ]] && break
  done
  echo ""
fi

TOTAL="$(wc -l < "$IDS_FILE" | tr -d ' ')"
if (( TOTAL == 0 )); then echo "No hosts found in team $SRC_TEAM_ID. Nothing to do."; exit 0; fi
echo "Ready to transfer $TOTAL hosts: team $SRC_TEAM_ID -> team $DST_TEAM_ID in batches of $BATCH_SIZE."

# --- 2. Interactive batched transfer ------------------------------------------------
transfer_batch() {   # $1 = start line (1-based), $2 = count
  local start="$1" count="$2"
  # collect the batch of ids into a JSON array
  local ids_json
  ids_json="$(sed -n "${start},$((start+count-1))p" "$IDS_FILE" | jq -R 'tonumber' | jq -s -c .)"
  local body
  body="$(jq -n --argjson team "$DST_TEAM_ID" --argjson hosts "$ids_json" '{team_id:$team, hosts:$hosts}')"
  local t0 t1 http
  t0=$(date +%s.%N)
  http=$(curl -sS -o /tmp/xfer_resp.$$ -w '%{http_code}' \
    -X POST "${FLEET_URL}/api/latest/fleet/hosts/transfer" \
    "${AUTH[@]}" -H "Content-Type: application/json" --data-binary "$body")
  t1=$(date +%s.%N)
  printf '  HTTP %s in %.2fs' "$http" "$(echo "$t1 - $t0" | bc)"
  if [[ "$http" != "200" ]]; then printf '  ERROR: %s' "$(cat /tmp/xfer_resp.$$)"; fi
  echo ""
  rm -f /tmp/xfer_resp.$$
}

pos=1
batch_no=0
auto=0
while (( pos <= TOTAL )); do
  count=$(( TOTAL - pos + 1 ))
  (( count > BATCH_SIZE )) && count=$BATCH_SIZE
  batch_no=$((batch_no+1))
  end=$(( pos + count - 1 ))

  if (( auto == 0 )); then
    printf '\nBatch %d: hosts %d-%d of %d (%d hosts). Transfer now? [y]es / [a]ll remaining / [q]uit: ' \
      "$batch_no" "$pos" "$end" "$TOTAL" "$count"
    read -r ans < /dev/tty || ans="q"
    case "$ans" in
      a|A) auto=1 ;;
      y|Y|"") ;;
      *) echo "Stopping. Resume later — already-transferred hosts just won't be in team $SRC_TEAM_ID anymore."; exit 0 ;;
    esac
  fi

  echo ">>> Batch $batch_no: transferring hosts $pos-$end -> team $DST_TEAM_ID"
  transfer_batch "$pos" "$count"
  pos=$(( end + 1 ))
done

echo ""
echo "Done. Transferred $TOTAL hosts from team $SRC_TEAM_ID to team $DST_TEAM_ID."
echo "Watch the churn:  SELECT status, COUNT(*) FROM host_mdm_windows_profiles GROUP BY status;"
echo "Note: the cached $IDS_FILE now lists hosts that are NO LONGER in team $SRC_TEAM_ID."
echo "To transfer them back, swap SRC/DST team IDs and run with --refresh."
