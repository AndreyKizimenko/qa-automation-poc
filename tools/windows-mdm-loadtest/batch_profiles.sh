#!/usr/bin/env bash
# Drive the Windows MDM load-test profile scenarios against the batch endpoint.
# The batch endpoint is DECLARATIVE: it sets the team's profile set to exactly what you POST.
#   apply   -> scenario 3 (add 100 profiles)
#   replace -> scenario 4 (swap to 100 differently-named profiles)
#   update  -> in-place MODIFY: re-apply the SAME names with changed contents so Fleet
#              re-verifies + re-pushes all 100 profiles to every host (no add/remove).
#              Generate the body with gen_win_profiles.py --rev N (see README). Used to
#              drive concurrent modification-path writer load, e.g. for #49705.
#   delete  -> scenario 5 (empty set removes all)
# GitOps calls this same endpoint under the hood; hitting it directly isolates the
# profile fan-out / reconcile path for a clean 4.87-vs-4.89 comparison.
#
# Usage:
#   export FLEET_URL="https://<instance>"          # no trailing slash
#   export FLEET_TOKEN="<api token>"               # fleetctl user or API-only token
#   export TEAM_ID=1                               # target team (omit for "No team" / global)
#   ./batch_profiles.sh apply    batch_A.json
#   ./batch_profiles.sh replace  batch_B.json
#   ./batch_profiles.sh update   batch_A_r2.json
#   ./batch_profiles.sh delete
set -euo pipefail

ACTION="${1:?usage: $0 apply|replace|update|delete [body.json]}"
BODY="${2:-}"
: "${FLEET_URL:?set FLEET_URL}"
: "${FLEET_TOKEN:?set FLEET_TOKEN}"

QS=""
if [[ -n "${TEAM_ID:-}" ]]; then QS="?team_id=${TEAM_ID}"; fi
URL="${FLEET_URL}/api/latest/fleet/mdm/profiles/batch${QS}"

TMP=""
case "$ACTION" in
  apply|replace)
    [[ -n "$BODY" ]] || { echo "need a body json for $ACTION"; exit 1; }
    DATA_FILE="$BODY"
    ;;
  update)
    [[ -n "$BODY" ]] || { echo "need a body json for $ACTION"; exit 1; }
    DATA_FILE="$BODY"
    # in-place modify only works if the body reuses the SAME profile names already applied
    # (e.g. gen_win_profiles.py --prefix "LoadTest A" --rev N). Different names => add/remove.
    echo "NOTE: 'update' is an in-place modify — the body must reuse the SAME profile names"
    echo "      already applied to this team (bumped --rev), or this becomes an add/remove."
    ;;
  delete)
    TMP="$(mktemp)"; printf '{"profiles":[]}' > "$TMP"; DATA_FILE="$TMP"
    ;;
  *) echo "unknown action: $ACTION"; exit 1;;
esac

echo ">>> $ACTION  ->  $URL"
START=$(date +%s.%N)
HTTP=$(curl -sS -o /tmp/batch_resp.$$ -w '%{http_code}' \
  -X POST "$URL" \
  -H "Authorization: Bearer ${FLEET_TOKEN}" \
  -H "Content-Type: application/json" \
  --data-binary @"${DATA_FILE}")
END=$(date +%s.%N)
[[ -n "$TMP" ]] && rm -f "$TMP"

printf 'HTTP %s in %.2fs\n' "$HTTP" "$(echo "$END - $START" | bc)"
echo "--- response body ---"; cat /tmp/batch_resp.$$; echo; rm -f /tmp/batch_resp.$$
# 204 No Content = success. Any 4xx/5xx prints the error body above.
