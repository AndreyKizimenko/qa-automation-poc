#!/bin/bash
# One load step with trip wires:  LT=<lt> lt-step.sh <label> <hold-minutes> ['<apply command>'] ['<revert command>']
# Runs the apply command, then samples every 60 s (lt-status.sh) for the hold time. Captures heap + goroutine profiles
# (fleetctl debug, one task behind the load balancer) at the first sample ≥ 20% and ≥ 40% memory. Trips at memory
# ≥ ${TRIP_MEM:-60}%, running < desired − 3, or healthz failing (non-200 or ≥ 10 s) 3 samples in a row: captures
# profiles, runs the revert command, exits 2. If the AWS readings go blank (SSO session expired) for 3 samples, the
# memory/task trip wires and ramp.sh recovery are gone, so it reverts too (BLIND_ACTION=continue keeps going on
# healthz alone). Log: ./steps.log, profiles in ./profiles/. Run it from the QA folder.
#   lt-step.sh S1-500-policies 75 './policies.sh apply' './policies.sh revert'
D=$(cd "$(dirname "$0")" && pwd); source "$D/lt-env.sh" || exit 1
export TZ=UTC
label=${1:?label}; hold=${2:?minutes}; apply=${3:-}; revert=${4:-}
FLEETCTL=${FLEETCTL:-fleetctl}
mkdir -p profiles
log() { echo "$(date -u +%H:%M:%SZ) $*" | tee -a steps.log; }
grab() { local p="profiles/$label-$1-$(date -u +%H%M%S)"; for k in heap goroutine; do timeout 90 "$FLEETCTL" debug $k --context "$LT_CTX" --outfile "$p-$k.pb.gz" >/dev/null 2>&1; done; echo "$p"; }
sample() { LT=$LT bash "$D/lt-status.sh" 1 2>/dev/null | cut -c11-; }
aws sts get-caller-identity >/dev/null 2>&1 || { echo "AWS session expired: ask the user to run aws sso login before a load step" >&2; exit 3; }
desired=$(lt_desired); min=$(( ${desired:-25} - 3 ))
log "== $label: start | $(sample)"
[ -n "$apply" ] && log "$label: apply: $(bash -c "$apply" 2>&1 | tail -1)"
t0=$(date +%s); bad=0; blind=0; g20=0; g40=0
while [ $(( $(date +%s) - t0 )) -lt $(( hold * 60 )) ]; do
  sleep 60
  line=$(sample)
  mmax=$(sed -nE 's/.*mem max\/avg (-?[0-9]+)\/.*/\1/p' <<<"$line"); run=$(sed -nE 's/.*running\/pending ([0-9]+)\/.*/\1/p' <<<"$line")
  hc=$(sed -nE 's/.*healthz ([0-9]+)\/.*/\1/p' <<<"$line"); ht=$(sed -nE 's/.*healthz [0-9]+\/([0-9]+).*/\1/p' <<<"$line")
  extra=""
  [ "${mmax:-0}" -ge 20 ] && [ $g20 = 0 ] && { extra=" | profiles $(grab m20)"; g20=1; }
  [ "${mmax:-0}" -ge 40 ] && [ $g40 = 0 ] && { extra=" | profiles $(grab m40)"; g40=1; }
  log "  $label +$(( ($(date +%s) - t0) / 60 ))m $line$extra"
  if [ "$hc" != 200 ] || [ "${ht:-99}" -ge 10 ]; then bad=$((bad + 1)); else bad=0; fi
  if [ -z "$mmax" ] || [ "$mmax" = -1 ] || [ -z "$run" ]; then blind=$((blind + 1)); else blind=0; fi
  if [ $blind -ge 3 ] && [ "${BLIND_ACTION:-revert}" = revert ]; then
    log "BLIND $label: no AWS readings for 3 samples (SSO expired?) — reverting while the API still works"
    [ -n "$revert" ] && log "$label: revert: $(bash -c "$revert" 2>&1 | tail -1)"
    exit 4
  fi
  if [ "${mmax:-0}" -ge "${TRIP_MEM:-60}" ] || { [ -n "$run" ] && [ "$run" -lt "$min" ]; } || [ $bad -ge 3 ]; then
    log "TRIP $label: mem ${mmax}% running ${run} healthz-fails ${bad} | profiles $(grab trip)"
    [ -n "$revert" ] && log "$label: revert: $(bash -c "$revert" 2>&1 | tail -1)"
    exit 2
  fi
done
log "== $label: held ${hold} min"
