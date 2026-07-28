#!/usr/bin/env bash
#
# fleet-helm-test.sh — Deploy Fleet to Docker Desktop Kubernetes for local Helm-chart testing.
#
# Automates Parts 2 & 4–10 of the "Test Fleet Helm Chart With Docker Desktop" runbook:
# switches kube-context, brings up MySQL+Redis via Compose, preps the namespace/secret,
# resolves chart deps, installs Fleet, waits for the pod to be Ready, then port-forwards.
# The only manual step left is confirming the service is reachable in your browser.
#
# Usage:
#   ./fleet-helm-test.sh <image-tag>
#
# The argument is used verbatim as the fleetdm/fleet image tag to deploy — pass
# exactly what exists on Docker Hub (e.g. rc-patch-fleet-v4.88.1, v4.88.1, main).
#
# Runs FULLY ISOLATED from a local `make serve` dev server so both can run at once:
#   - dedicated MySQL database  fleet_helm   (dev uses `fleet`)
#   - dedicated Redis logical DB 1           (dev uses 0)
#   - port-forward on 8081                   (dev serves on 8080)
# First run does first-time-setup; later runs reuse it.
#
# Env overrides (rarely needed):
#   KUBE_CONTEXT   (default: docker-desktop)
#   NAMESPACE      (default: fleet)
#   LOCAL_PORT     (default: 8081) — dev server uses 8080
#   KEY_FILE       (default: ~/.fleet-local-key)
#   DB_NAME        (default: fleet_helm) — kept separate from dev's `fleet` DB
#   REDIS_DB       (default: 1) — Redis logical DB index; dev uses 0

set -euo pipefail

# --- helpers ---------------------------------------------------------------
info()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()    { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m!\033[0m %s\n' "$*"; }
die()   { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

KUBE_CONTEXT="${KUBE_CONTEXT:-docker-desktop}"
NAMESPACE="${NAMESPACE:-fleet}"
LOCAL_PORT="${LOCAL_PORT:-8081}"
KEY_FILE="${KEY_FILE:-$HOME/.fleet-local-key}"
DB_NAME="${DB_NAME:-fleet_helm}"
REDIS_DB="${REDIS_DB:-1}"

# --- arg parsing -----------------------------------------------------------
[ $# -ge 1 ] || die "usage: $(basename "$0") <image-tag>  (e.g. rc-patch-fleet-v4.88.1)"

IMAGE_TAG="$1"

# --- repo root -------------------------------------------------------------
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || die "not inside the Fleet git repo"
cd "$REPO_ROOT"

# --- tool checks -----------------------------------------------------------
for bin in kubectl helm docker; do
  command -v "$bin" >/dev/null 2>&1 || die "'$bin' not found on PATH"
done

# --- fail fast: image tag must exist on Docker Hub -------------------------
info "Checking Docker Hub for fleetdm/fleet:$IMAGE_TAG ..."
if ! docker manifest inspect "fleetdm/fleet:$IMAGE_TAG" >/dev/null 2>&1; then
  die "image fleetdm/fleet:$IMAGE_TAG not found on Docker Hub — check the version or pass an explicit tag"
fi
ok "Image fleetdm/fleet:$IMAGE_TAG exists"

# --- Part 3 guard: private key ---------------------------------------------
if [ ! -f "$KEY_FILE" ]; then
  warn "$KEY_FILE missing — generating one (Part 3)"
  openssl rand -base64 32 > "$KEY_FILE"
  ok "Wrote $KEY_FILE"
else
  ok "Reusing existing $KEY_FILE"
fi

# --- Part 2: preflight ------------------------------------------------------
info "Switching kube-context to $KUBE_CONTEXT"
kubectl config use-context "$KUBE_CONTEXT" >/dev/null
kubectl get nodes >/dev/null || die "cluster not reachable — is Docker Desktop Kubernetes enabled?"
ok "Cluster reachable"

# --- Part 4: MySQL + Redis --------------------------------------------------
info "Starting MySQL + Redis via docker compose"
docker compose up -d mysql redis
ok "MySQL + Redis up"

# --- Part 4b: dedicated helm DB (isolated from local dev's `fleet` DB) ------
info "Waiting for MySQL to accept connections"
for i in $(seq 1 60); do
  docker compose exec -T mysql mysqladmin ping -uroot -ptoor --silent >/dev/null 2>&1 && break
  [ "$i" -eq 60 ] && die "MySQL did not become ready in time"
  sleep 1
done
info "Ensuring database '$DB_NAME' exists and 'fleet' user can access it"
docker compose exec -T mysql mysql -uroot -ptoor -e \
  "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\`; GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO 'fleet'@'%'; FLUSH PRIVILEGES;" \
  || die "failed to create/grant database '$DB_NAME'"
ok "Database '$DB_NAME' ready"

# --- Part 5: namespace + mysql secret --------------------------------------
info "Ensuring namespace '$NAMESPACE' and mysql secret"
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f - >/dev/null
kubectl -n "$NAMESPACE" create secret generic mysql \
  --from-literal=mysql-password=insecure \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null
ok "Namespace + secret ready"

# --- Part 6: chart dependencies --------------------------------------------
info "Resolving Helm chart dependencies"
helm dependency update ./charts/fleet >/dev/null 2>&1 || warn "dependency update reported an issue (usually safe to ignore)"
ok "Chart dependencies resolved"

# --- Part 8: install --------------------------------------------------------
info "Installing Fleet (image tag $IMAGE_TAG)"
helm upgrade --install fleet ./charts/fleet \
  --namespace "$NAMESPACE" \
  --set imageRepository=fleetdm/fleet \
  --set imageTag="$IMAGE_TAG" \
  --set replicas=1 \
  --set fleet.tls.enabled=false \
  --set fleet.logging.debug=true \
  --set mysql.enabled=false \
  --set redis.enabled=false \
  --set database.address=host.docker.internal:3306 \
  --set database.database="$DB_NAME" \
  --set database.username=fleet \
  --set database.secretName=mysql \
  --set database.passwordKey=mysql-password \
  --set cache.address=host.docker.internal:6379 \
  --set-string cache.database="$REDIS_DB" \
  --set-string environments.FLEET_SERVER_PRIVATE_KEY="$(cat "$KEY_FILE")"

# --- Part 9: wait for readiness --------------------------------------------
info "Waiting for the Fleet pod to become Ready (up to 5m)"
if ! kubectl -n "$NAMESPACE" rollout status deploy/fleet --timeout=300s; then
  warn "Pod did not become Ready. Recent logs:"
  kubectl -n "$NAMESPACE" logs deploy/fleet -c fleet --tail=100 || true
  die "Fleet failed to start"
fi
ok "Fleet pod is Ready"

# --- Part 10: port-forward --------------------------------------------------
echo
ok "Fleet v$IMAGE_TAG is running."
info "Opening port-forward — confirm the service in your browser:"
printf '\n    \033[1;36mhttp://localhost:%s\033[0m\n\n' "$LOCAL_PORT"
info "Press Ctrl-C to stop the port-forward. Then run ./fleet-helm-reset.sh to tear down."
exec kubectl -n "$NAMESPACE" port-forward svc/fleet-service "${LOCAL_PORT}:8080"
