#!/usr/bin/env bash
# Download and extract the Playwright HTML-report artifacts from a GitHub
# Actions run, so the report parser can point at them. Prints every directory
# that contains an index.html on stdout, one per line, the suites'
# (`playwright-report-*`) first; everything else goes to stderr.
#
# A single-suite run has one report. A chained run (`QA — Nightly`,
# `QA — Branch run`) has one per Playwright job: the two suites, six
# gitops-verify reports and two fleetctl-CLI reports.
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

# Grab report-shaped artifacts. --dir puts each artifact in its own subdir
# named after the artifact. gh refuses to overwrite, so reports already in
# DEST (an earlier triage of the same run) are reused as they are.
if find "$DEST" -maxdepth 2 -name index.html | grep -q .; then
  log "Reusing the reports already in $DEST"
else
  gh run download "$RUN_ID" --repo "$REPO" --pattern '*report*' --dir "$DEST" >&2 \
    || gh run download "$RUN_ID" --repo "$REPO" --dir "$DEST" >&2
fi

# Every directory holding an index.html, one level down in its artifact
# subdir — or at the top, when only one artifact was downloaded and gh put it
# there directly.
REPORTS="$(find "$DEST" -maxdepth 2 -name index.html -exec dirname {} \; | sort)"
if [[ -z "$REPORTS" ]]; then
  log "No index.html found under $DEST. Contents:"
  find "$DEST" -maxdepth 2 >&2
  exit 1
fi

log "Report dirs (suites first):"
{
  echo "$REPORTS" | grep '/playwright-report-' || true
  echo "$REPORTS" | grep -v '/playwright-report-' || true
}
