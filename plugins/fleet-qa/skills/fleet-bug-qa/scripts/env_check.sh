#!/bin/bash
# usage: env_check.sh <pre-fix-ctx> <fixed-ctx> [fix-commit-sha ...]
# Prints version/branch/revision/license for both instances and, for each fix commit,
# whether each instance's revision contains it (needs the fleet repo to have both revisions fetched).
DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="${FLEET_REPO:-$HOME/repositories/fleet}"
PRE="$1"; FIX="$2"; shift 2
for ctx in "$PRE" "$FIX"; do
  v=$("$DIR/fleetapi.sh" "$ctx" GET /api/v1/fleet/version)
  lic=$("$DIR/fleetapi.sh" "$ctx" GET /api/v1/fleet/config | python3 -c 'import sys,json; d=json.load(sys.stdin); l=d.get("license",{}); print(l.get("tier","?"), "| server_url:", d.get("server_settings",{}).get("server_url"), "| apple_mdm:", d.get("mdm",{}).get("enabled_and_configured"), "| windows_mdm:", d.get("mdm",{}).get("windows_enabled_and_configured"), "| android_mdm:", d.get("mdm",{}).get("android_enabled_and_configured"))' 2>/dev/null)
  rev=$(echo "$v" | python3 -c 'import sys,json; print(json.load(sys.stdin)["revision"])' 2>/dev/null)
  echo "== $ctx"
  echo "$v" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(" ", d["version"], d["branch"], d["revision"][:10])' 2>/dev/null || echo "  unreachable: $v"
  echo "  license: $lic"
  for sha in "$@"; do
    if git -C "$REPO" cat-file -e "$rev^{commit}" 2>/dev/null; then
      if git -C "$REPO" merge-base --is-ancestor "$sha" "$rev" 2>/dev/null; then echo "  contains $sha: YES"; else echo "  contains $sha: no"; fi
    else
      echo "  contains $sha: unknown (revision $rev not in local repo — git fetch)"
    fi
  done
done
