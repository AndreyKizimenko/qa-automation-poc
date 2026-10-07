#!/bin/bash
# Sourced by the other lt-*.sh scripts:  LT=fleet-493loadtest-3 source lt-env.sh
# The loadtest terraform names the ECS cluster, Aurora cluster, Redis replication group and CloudWatch log group after
# the workspace ($LT), and the internal (device) ALB $LT-int. Everything below can be overridden by env.
#   LT        the instance (required), e.g. fleet-493loadtest-3
#   R         AWS region (us-east-2)
#   LT_CTX    fleetctl context in ~/.fleet/config for the admin API (loadtest); its token is read, never printed
#   LT_URL    public URL (from the context's address, else https://$LT.loadtest.fleetdm.com)
#   LT_STATE  per-instance state kept between runs (saved ALB action, logs): ~/.fleet-loadtest/$LT
[ -n "${LT:-}" ] || { echo "lt-env: set LT to the load test, e.g. LT=fleet-493loadtest-3" >&2; return 1 2>/dev/null || exit 1; }
R=${R:-us-east-2}
C=${C:-$LT}
LT_CTX=${LT_CTX:-loadtest}
LT_STATE=${LT_STATE:-$HOME/.fleet-loadtest/$LT}
mkdir -p "$LT_STATE"

_lt_ctx() { awk -v c="  $LT_CTX:" -v k="$1:" '$0==c{f=1;next} f&&/^  [a-z]/{exit} f&&$1==k{print $2}' ~/.fleet/config 2>/dev/null; }
LT_URL=${LT_URL:-$(_lt_ctx address)}
LT_URL=${LT_URL:-https://$LT.loadtest.fleetdm.com}

# The writer can move between cluster members after a failover, so look it up instead of naming it.
WRITER_ID=${WRITER_ID:-$(aws rds describe-db-clusters --region "$R" --db-cluster-identifier "$LT" \
  --query 'DBClusters[0].DBClusterMembers[?IsClusterWriter].DBInstanceIdentifier | [0]' --output text 2>/dev/null)}

# Admin API with the context's token (FLEET_TOKEN overrides). Usage: lt_api GET /api/latest/fleet/version [json]
lt_api() {
  local m=$1 p=$2 tok=${FLEET_TOKEN:-$(_lt_ctx token)}; shift 2
  if [ -n "${1:-}" ]; then curl -sk -m "${LT_API_TIMEOUT:-120}" -X "$m" -H "Authorization: Bearer $tok" -H 'Content-Type: application/json' -d "$1" "$LT_URL$p"
  else curl -sk -m "${LT_API_TIMEOUT:-120}" -X "$m" -H "Authorization: Bearer $tok" "$LT_URL$p"; fi
}

# Time helpers that work with BSD (macOS) and GNU date.
lt_iso_ago() { date -u -v-"${1}"S +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "-${1} seconds" +%Y-%m-%dT%H:%M:%SZ; }
lt_epoch() { date -j -u -f "%Y-%m-%dT%H:%M:%SZ" "$1" +%s 2>/dev/null || date -u -d "$1" +%s; }
lt_now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

lt_desired() { aws ecs describe-services --region "$R" --cluster "$C" --services fleet --query 'services[0].desiredCount' --output text 2>/dev/null; }

lt_check() {
  local bad=""
  { [ -z "$WRITER_ID" ] || [ "$WRITER_ID" = None ]; } && bad="Aurora writer for cluster $LT (wrong LT, or the AWS session expired: aws sso login)"
  [ -z "$(_lt_ctx token)" ] && [ -z "${FLEET_TOKEN:-}" ] && bad="${bad:+$bad; }no token for fleetctl context '$LT_CTX'"
  [ -n "$bad" ] && echo "lt-env: $bad" >&2
  [ -z "$bad" ]
}
