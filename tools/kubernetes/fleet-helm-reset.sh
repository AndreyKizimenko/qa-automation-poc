#!/usr/bin/env bash
#
# fleet-helm-reset.sh — Tear down the local Fleet Helm deployment.
#
# Reverses fleet-helm-test.sh: uninstalls the Helm release, deletes the namespace,
# and (by default) drops ONLY the dedicated helm database (fleet_helm) so the next
# run starts fresh. Your local dev database (`fleet`) and MySQL/Redis stay running
# and untouched. ~/.fleet-local-key is preserved so Part 3 stays skipped.
#
# Usage:
#   ./fleet-helm-reset.sh            # drop fleet_helm DB; leave dev DB + containers alone
#   ./fleet-helm-reset.sh --keep-db  # release + namespace only; keep fleet_helm data
#   ./fleet-helm-reset.sh --nuke     # DESTRUCTIVE: docker compose down -v (wipes ALL
#                                    #   volumes incl. your local dev `fleet` database)
#
# Env overrides:
#   FLEET_REPO (default: git toplevel if it's a Fleet clone, else ~/repositories/fleet
#               or ~/fleet) — the checkout supplying docker-compose.yml
#   NAMESPACE  (default: fleet)
#   DB_NAME    (default: fleet_helm)

set -uo pipefail

info()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()    { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m!\033[0m %s\n' "$*"; }

NAMESPACE="${NAMESPACE:-fleet}"
DB_NAME="${DB_NAME:-fleet_helm}"
MODE="drop-db"
case "${1:-}" in
  --keep-db) MODE="keep-db" ;;
  --nuke)    MODE="nuke" ;;
  "")        ;;
  *)         echo "unknown flag: $1" >&2; exit 1 ;;
esac

# Resolve the Fleet checkout the same way fleet-helm-test.sh does — the git
# toplevel of the invocation directory is not enough, since this script lives in
# the qa-automation repo but needs Fleet's docker-compose.yml.
looks_like_fleet() { [ -f "$1/docker-compose.yml" ] && [ -d "$1/charts/fleet" ]; }

if [ -n "${FLEET_REPO:-}" ]; then
  looks_like_fleet "$FLEET_REPO" || {
    echo "FLEET_REPO=$FLEET_REPO is not a Fleet checkout (needs docker-compose.yml and charts/fleet)" >&2
    exit 1
  }
  REPO_ROOT="$FLEET_REPO"
else
  REPO_ROOT=""
  for candidate in \
    "$(git rev-parse --show-toplevel 2>/dev/null || true)" \
    "$HOME/repositories/fleet" \
    "$HOME/fleet"; do
    [ -n "$candidate" ] || continue
    if looks_like_fleet "$candidate"; then REPO_ROOT="$candidate"; break; fi
  done
  [ -n "$REPO_ROOT" ] || {
    echo "could not find a Fleet checkout — set FLEET_REPO=/path/to/fleet or run from inside one" >&2
    exit 1
  }
fi
# This script runs without `set -e`, so guard the cd explicitly — the docker
# compose calls below would otherwise run against whatever directory we're in.
cd "$REPO_ROOT" || { echo "cannot cd to $REPO_ROOT" >&2; exit 1; }
ok "Using Fleet checkout $REPO_ROOT"

info "Uninstalling Helm release 'fleet'"
helm -n "$NAMESPACE" uninstall fleet 2>/dev/null && ok "Release removed" || ok "No release to remove"

info "Deleting namespace '$NAMESPACE'"
kubectl delete namespace "$NAMESPACE" --ignore-not-found
ok "Namespace deleted"

case "$MODE" in
  keep-db)
    ok "Kept database '$DB_NAME' — next run reuses its data"
    ;;
  drop-db)
    info "Dropping database '$DB_NAME' (local dev DB left untouched)"
    if docker compose exec -T mysql mysqladmin ping -uroot -ptoor --silent >/dev/null 2>&1; then
      docker compose exec -T mysql mysql -uroot -ptoor -e "DROP DATABASE IF EXISTS \`$DB_NAME\`;" \
        && ok "Database '$DB_NAME' dropped (next run = fresh setup)" \
        || warn "could not drop '$DB_NAME'"
    else
      warn "MySQL not running — nothing to drop"
    fi
    ;;
  nuke)
    warn "DESTRUCTIVE: wiping ALL compose volumes, including your local dev 'fleet' database"
    docker compose down -v
    ok "Containers + all volumes removed"
    ;;
esac

echo
ok "Reset complete. ~/.fleet-local-key kept — rerun fleet-helm-test.sh anytime."
