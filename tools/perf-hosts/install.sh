#!/usr/bin/env bash
#
# Build the self-contained osquery-perf binary from a cloned fleetdm/fleet repo
# and install the persistent launchd daemons that keep ~300 hosts online on the
# premium + free QA instances. Idempotent: re-run to rebuild + reload.
#
# The committed plists are templates — the instance URL and enroll secret are
# placeholders, substituted here from perf-hosts.env (gitignored). Copy
# perf-hosts.env.example to perf-hosts.env and fill it in before the first run.
#
# Usage:
#   FLEET_REPO=~/fleet ./install.sh              # persistent daemons only (recommended)
#   FLEET_REPO=~/fleet ./install.sh --daily-refresh   # also install the 09:00 daily fresh-host job
#
set -euo pipefail

FLEET_REPO="${FLEET_REPO:-$HOME/fleet}"
BIN=/usr/local/bin/fleet-perf
HERE="$(cd "$(dirname "$0")" && pwd)"
SECRETS_FILE="${SECRETS_FILE:-$HERE/perf-hosts.env}"
LABELS=(premium free)
WITH_REFRESH=0
[[ "${1:-}" == "--daily-refresh" ]] && WITH_REFRESH=1

command -v go >/dev/null || { echo "error: Go toolchain not found on PATH"; exit 1; }
[[ -d "$FLEET_REPO/cmd/osquery-perf" ]] || {
  echo "error: $FLEET_REPO/cmd/osquery-perf not found — set FLEET_REPO to your cloned fleetdm/fleet checkout"; exit 1;
}

# --- instance credentials ---------------------------------------------------
# Sourced from perf-hosts.env unless already exported. Missing values are a
# hard error: a daemon installed with an unsubstituted placeholder would fail
# to enroll anything and the cause wouldn't be obvious from the logs.
if [[ -f "$SECRETS_FILE" ]]; then
  # shellcheck source=/dev/null  # path is user-configurable via SECRETS_FILE
  set -a; . "$SECRETS_FILE"; set +a
fi
for var in PREMIUM_FLEET_URL PREMIUM_ENROLL_SECRET FREE_FLEET_URL FREE_ENROLL_SECRET \
           PREMIUM_MDM_SCEP_CHALLENGE FREE_MDM_SCEP_CHALLENGE; do
  [[ -n "${!var:-}" ]] || {
    echo "error: $var is not set. Copy perf-hosts.env.example to perf-hosts.env and fill it in"
    echo "       (or export the four vars yourself). Values come from each instance's"
    echo "       Settings -> Organization settings -> Agent options / enroll secret."
    exit 1
  }
done

echo "==> Building fleet-perf from $FLEET_REPO (templates are go:embed-ed → self-contained)"
# Build as the current user (not root) so Go uses your module cache, then
# sudo-install the artifact — /usr/local/bin isn't user-writable.
TMP_BIN="$(mktemp -t fleet-perf)"
( cd "$FLEET_REPO" && go build -o "$TMP_BIN" ./cmd/osquery-perf )

echo "==> Installing binary to $BIN + log dir (sudo)"
sudo install -d -m 755 "$(dirname "$BIN")" /usr/local/var/log
sudo install -m 755 -o root -g wheel "$TMP_BIN" "$BIN"
rm -f "$TMP_BIN"

install_daemon() {
  local label="$1" plist="/Library/LaunchDaemons/com.fleetqa.perf.$1.plist"
  local src="$HERE/com.fleetqa.perf.$label.plist"
  local rendered; rendered="$(mktemp)"

  # Enroll secrets are base64 (A-Za-z0-9+/=), so '|' is always a safe delimiter.
  case "$label" in
    premium)
      sed -e "s|__PREMIUM_FLEET_URL__|${PREMIUM_FLEET_URL}|" \
          -e "s|__PREMIUM_ENROLL_SECRET__|${PREMIUM_ENROLL_SECRET}|" \
          -e "s|__PREMIUM_MDM_SCEP_CHALLENGE__|${PREMIUM_MDM_SCEP_CHALLENGE}|" "$src" > "$rendered" ;;
    free)
      sed -e "s|__FREE_FLEET_URL__|${FREE_FLEET_URL}|" \
          -e "s|__FREE_ENROLL_SECRET__|${FREE_ENROLL_SECRET}|" \
          -e "s|__FREE_MDM_SCEP_CHALLENGE__|${FREE_MDM_SCEP_CHALLENGE}|" "$src" > "$rendered" ;;
    *)
      cp "$src" "$rendered" ;;   # refresh carries no credentials
  esac

  # Never install a plist that still has a placeholder — it would enroll nothing
  # and the launchd log wouldn't say why.
  if grep -q '__[A-Z_]*__' "$rendered"; then
    rm -f "$rendered"
    echo "error: com.fleetqa.perf.$label.plist still has unsubstituted placeholders" >&2
    exit 1
  fi

  sudo install -m 644 -o root -g wheel "$rendered" "$plist"
  rm -f "$rendered"
  # bootout is harmless if not currently loaded.
  sudo launchctl bootout system "$plist" 2>/dev/null || true
  sudo launchctl bootstrap system "$plist"
  echo "   loaded com.fleetqa.perf.$label"
}

echo "==> Installing persistent daemons"
for label in "${LABELS[@]}"; do install_daemon "$label"; done

if [[ "$WITH_REFRESH" == "1" ]]; then
  echo "==> Installing OPTIONAL daily refresh job (09:00)"
  install_daemon refresh
fi

echo
echo "==> Done. Verify:"
echo "   sudo launchctl print system/com.fleetqa.perf.premium | grep -i state"
echo "   tail -f /usr/local/var/log/fleet-perf-*.log"
echo "   # then watch the host count climb in each Fleet instance's UI"
