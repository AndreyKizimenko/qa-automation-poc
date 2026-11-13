#!/usr/bin/env bash
# Prints, as Markdown on stdout, how the failed and flaky tests of one run fared
# in the nightlies before it: the "failed 4 of the last 14 nights" a job summary
# shows beside a red test. Progress goes to stderr.
#
# Usage:
#   run-history-summary.sh <OWNER/REPO> <run-id> [reports-dir] [nights]
#
#   <run-id>       the run being summarised
#   [reports-dir]  that run's playwright-report-* artifacts, already downloaded;
#                  when empty or omitted they are downloaded here
#   [nights]       how many earlier nightlies to compare with (default 14)
#
# It reads reports, so it needs the report private key: the file at
# $QA_REPORT_KEY, else ~/.config/qa-automation/report-private-key.pem. In CI the
# run-history workflow is the one job given that key (.github/workflows/run-history.yml).
#
# What it prints holds no secret, and that is the rule for anything added here:
# a test's file and title, its outcome and retry count, a hash of its error, run
# ids and dates. Never an error's text, a step title or a request, which can
# carry a typed password or a token. The decrypted reports stay in a temp
# directory that is removed on the way out.
set -euo pipefail

REPO="${1:?OWNER/REPO required}"
CURRENT="${2:?the id of the run to summarise is required}"
CURRENT_DIR="${3:-}"
NIGHTS="${4:-14}"

log() { echo "$@" >&2; }

ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
SCRIPTS="$ROOT/.claude/skills/playwright-run-reviewer/scripts"
WORK="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/run-history-XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
HISTORY="$WORK/history.jsonl"

# A run's two suite reports, decrypted in place. Fails when the run kept none.
fetch_suite_reports() {
  local id="$1" dest="$2"
  if ! find "$dest" -maxdepth 2 \( -name index.html -o -name '*.tar.gz.enc' \) 2>/dev/null | grep -q .; then
    gh run download "$id" --repo "$REPO" --pattern 'playwright-report-*' --dir "$dest" >&2 || return 1
  fi
  # fetch_ci_run.sh reuses what is already in the directory and decrypts it.
  bash "$SCRIPTS/fetch_ci_run.sh" "$id" "$REPO" "$dest" >/dev/null || return 1
}

# The nightlies that finished before this run, oldest first.
earlier="$(
  gh run list --repo "$REPO" --workflow qa-nightly.yml --branch main --limit 60 \
    --json databaseId,status \
    --jq "[.[] | select(.status == \"completed\" and .databaseId != ${CURRENT})] | .[0:${NIGHTS}] | reverse | .[].databaseId"
)"

recorded=0
for id in $earlier; do
  dest="$WORK/run-$id"
  if ! fetch_suite_reports "$id" "$dest"; then
    log "run $id: no suite report to read (expired, or the suites never ran)"
    continue
  fi
  for tier in premium free; do
    if [ -d "$dest/playwright-report-$tier" ]; then
      python3 "$SCRIPTS/run_history.py" add "$dest/playwright-report-$tier" --run "$id" --tier "$tier" --history "$HISTORY" >&2
    fi
  done
  recorded=$((recorded + 1))
  # Its lines are in the history; the decrypted report itself is no longer needed.
  rm -rf "$dest"
done

if [ -z "$CURRENT_DIR" ]; then
  CURRENT_DIR="$WORK/current"
fi
fetch_suite_reports "$CURRENT" "$CURRENT_DIR" || log "run $CURRENT: no suite report to read"

echo "## How this run's failures fared before"
echo
echo "Earlier nightlies with a report still in retention: $recorded (the last $NIGHTS are looked at)."
echo
echo '```'
for tier in premium free; do
  if [ -d "$CURRENT_DIR/playwright-report-$tier" ]; then
    python3 "$SCRIPTS/run_history.py" show "$CURRENT_DIR/playwright-report-$tier" \
      --run "$CURRENT" --tier "$tier" --history "$HISTORY" --last "$NIGHTS"
  else
    echo "Run $CURRENT ($tier): no suite report, so nothing to compare."
  fi
  echo
done
echo '```'
