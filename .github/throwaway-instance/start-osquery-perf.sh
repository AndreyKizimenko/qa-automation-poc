#!/usr/bin/env bash
# Starts THROWAWAY_HOSTS osquery-perf hosts in the background against FLEET_URL with ENROLL_SECRET, spread
# over the seed's OS templates (`fleet-data.mjs os-templates`). They keep running for the rest of the
# job, through an upgrade's restart, and the runner stops them when the job ends. Run from the
# repository root, after the `.github/throwaway-instance` action built osquery-perf into .fleet-src.
#
# Two of osquery-perf's defaults are turned off, because each makes a host the run counts on miss:
#   -http_message_signature_prob 0   by default 1 in 10 hosts signs its requests, which needs a host
#                                    identity certificate from Fleet's SCEP endpoint; the throwaway Fleet
#                                    serves none (404), and such a host never enrolls.
#   -live_query_no_results_prob 0    by default 1 in 5 live-query answers carries no rows, and the live
#                                    report spec expects a row from every host.
set -euo pipefail
: "${FLEET_URL:?}" "${ENROLL_SECRET:?}" "${THROWAWAY_HOSTS:?}"

templates="$(node .github/throwaway-instance/fleet-data.mjs os-templates "$THROWAWAY_HOSTS")"
log="${RUNNER_TEMP:-/tmp}/osquery-perf.log"

# osquery-perf builds its software inventory from software-library/ beside it, so it runs from there.
cd .fleet-src/cmd/osquery-perf
nohup osquery-perf \
  -server_url "$FLEET_URL" \
  -enroll_secret "$ENROLL_SECRET" \
  -host_count "$THROWAWAY_HOSTS" \
  -os_templates "$templates" \
  -start_period 30s \
  -http_message_signature_prob 0 \
  -live_query_no_results_prob 0 \
  > "$log" 2>&1 &

echo "osquery-perf: $THROWAWAY_HOSTS hosts ($templates), its log in $log"
