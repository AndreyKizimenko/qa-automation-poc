#!/bin/bash
# Brings device traffic back in steps after a cut:  LT=<lt> ramp-up.sh 10 25 50 100
# Holds each step ${STEP_MIN:-8} min, sampling every minute. If the hottest task reaches ${MAX_MEM:-70}% memory or
# fewer than desired − 3 tasks run, it drops back to the previous level, holds 10 min and retries the step (twice at
# most, then stays at the previous level and exits 2). Log: $LT_STATE/ramp-up.log
D=$(cd "$(dirname "$0")" && pwd); source "$D/lt-env.sh" || exit 1
export TZ=UTC
LOG="$LT_STATE/ramp-up.log"
log() { echo "$(date -u +%H:%M:%SZ) $*" | tee -a "$LOG"; }
min=$(( $(lt_desired) - 3 ))
prev=0
for pct in "$@"; do
  tries=0
  while :; do
    log "ramp to ${pct}% ($(LT=$LT bash "$D/ramp.sh" "$pct" 2>&1 | tail -1))"
    bad=0
    for i in $(seq 1 "${STEP_MIN:-8}"); do
      sleep 60
      line=$(LT=$LT bash "$D/lt-status.sh" 1 2>/dev/null | cut -c11-)
      mmax=$(sed -nE 's/.*mem max\/avg (-?[0-9]+)\/.*/\1/p' <<<"$line"); run=$(sed -nE 's/.*running\/pending ([0-9]+)\/.*/\1/p' <<<"$line")
      log "  ${pct}% +${i}m $line"
      if [ "${mmax:--1}" -ge "${MAX_MEM:-70}" ] || [ "${run:-0}" -lt "$min" ]; then bad=1; break; fi
    done
    [ $bad -eq 0 ] && break
    tries=$((tries + 1))
    log "  unhealthy at ${pct}% -> back to ${prev}% for 10 min (try $tries)"
    LT=$LT bash "$D/ramp.sh" "$prev" >/dev/null 2>&1; sleep 600
    [ $tries -ge 2 ] && { log "giving up at ${pct}%, holding ${prev}%"; exit 2; }
  done
  prev=$pct
done
log "ramp-up done at ${prev}%"
