#!/usr/bin/env bash
# Download and extract the Playwright HTML-report artifact from a GitHub
# Actions run, so the report parser can point at it. Prints the directory that
# contains index.html on the last line (everything else goes to stderr).
#
# Usage:
#   fetch_ci_run.sh <run-url-or-id> [repo] [dest-dir]
#
#   <run-url-or-id>  full URL (https://github.com/OWNER/REPO/actions/runs/ID)
#                    or a bare numeric run id (then [repo] is required).
#   [repo]           OWNER/REPO. Optional if a full URL was given.
#   [dest-dir]       where to download. Default: a mktemp dir.
#
# Uses `gh run download` (the raw artifacts/.../zip API 404s intermittently on
# its redirect, so we don't use it). Requires the `gh` CLI, authenticated.
set -euo pipefail

log() { echo "$@" >&2; }

INPUT="${1:?run url or id required}"
REPO="${2:-}"
DEST="${3:-}"

if [[ "$INPUT" =~ github\.com/([^/]+/[^/]+)/actions/runs/([0-9]+) ]]; then
  REPO="${BASH_REMATCH[1]}"
  RUN_ID="${BASH_REMATCH[2]}"
elif [[ "$INPUT" =~ ^[0-9]+$ ]]; then
  RUN_ID="$INPUT"
else
  log "Could not parse a run id from: $INPUT"
  exit 1
fi

if [[ -z "$REPO" ]]; then
  log "Repo is required when passing a bare run id (OWNER/REPO)."
  exit 1
fi

log "Run:  $REPO #$RUN_ID"

if [[ -z "$DEST" ]]; then
  DEST="$(mktemp -d "${TMPDIR:-/tmp}/pw-run-${RUN_ID}-XXXX")"
fi
mkdir -p "$DEST"

# Grab report-shaped artifacts (there is usually exactly one). --dir puts each
# artifact in its own subdir named after the artifact.
gh run download "$RUN_ID" --repo "$REPO" --pattern '*report*' --dir "$DEST" >&2 \
  || gh run download "$RUN_ID" --repo "$REPO" --dir "$DEST" >&2

# Find the directory holding index.html (one level down in the artifact subdir).
INDEX_DIR="$(find "$DEST" -maxdepth 2 -name index.html -print -quit | xargs -I{} dirname {})"
if [[ -z "$INDEX_DIR" ]]; then
  log "No index.html found under $DEST. Contents:"
  find "$DEST" -maxdepth 2 >&2
  exit 1
fi

log "Report dir:"
echo "$INDEX_DIR"
