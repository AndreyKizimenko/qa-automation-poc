#!/usr/bin/env bash
# Puts the premium instance's gitops-mode exceptions back to the pinned baseline,
# before `fleetctl gitops` reads them.
#
# `fleetctl gitops` applies `config.gitops.exceptions` whether or not gitops mode
# is on (Fleet's server/service/client.go): an entity that is NOT excepted and
# whose key the YAML omits is deleted, and an excepted entity whose key the YAML
# carries is refused. Premium's YAML declares no `secrets:` (enroll secrets are
# managed in the UI) but does declare `labels:` and `software:`, so the instance
# rests on secrets excepted and labels and software not. A gitops-mode spec run
# killed before its teardown can leave them otherwise: a stuck `secrets: false`
# would make this apply delete every enroll secret the simulations re-enroll
# with, and a stuck `labels: true` would make it refuse the YAML.
#
# Nothing can declare the exceptions (gitops rejects
# `org_settings.gitops.exceptions`), so the baseline lives here and in the
# Playwright suite's GITOPS_EXCEPTIONS_BASELINE
# (playwright/helpers/api/gitops-mode.ts). Change both together.
#
# Writes only when the exceptions differ, and keeps `gitops_mode_enabled` and
# `repository_url` as found: PATCH /config replaces the `gitops` subtree whole.
set -euo pipefail

BASELINE='{"labels":false,"software":false,"secrets":true}'
config_url="$FLEET_URL/api/latest/fleet/config"
auth="Authorization: Bearer $FLEET_API_TOKEN"

config="$(curl -fsSL -H "$auth" "$config_url")"
if jq -e --argjson b "$BASELINE" '.gitops.exceptions == $b' <<<"$config" >/dev/null; then
  echo "gitops exceptions are at the baseline: $BASELINE"
  exit 0
fi

found="$(jq -c '.gitops.exceptions' <<<"$config")"
body="$(jq -c --argjson b "$BASELINE" '{gitops: (.gitops | .exceptions = $b)}' <<<"$config")"
curl -fsSL -X PATCH -H "$auth" -H 'Content-Type: application/json' --data "$body" "$config_url" >/dev/null

# Read it back: an apply on the old exceptions is what this step exists to prevent.
config="$(curl -fsSL -H "$auth" "$config_url")"
if ! jq -e --argjson b "$BASELINE" '.gitops.exceptions == $b' <<<"$config" >/dev/null; then
  echo "::error title=gitops exceptions not restored::found $found, still $(jq -c '.gitops.exceptions' <<<"$config") after the PATCH"
  exit 1
fi
echo "::warning title=gitops exceptions restored::found $found, restored $BASELINE (a gitops-mode spec run likely died before its teardown)"
