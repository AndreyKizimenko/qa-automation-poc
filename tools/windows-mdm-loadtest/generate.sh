#!/usr/bin/env bash
#
# Regenerate every profile batch the load-test scenarios need.
#
# The generator is deterministic, so this reproduces byte-identical output on
# any machine — which is why none of it is committed. Run it once after cloning,
# and again whenever gen_win_profiles.py changes.
#
# Usage:
#   ./generate.sh              # batches A, B, and A-rev2
#   ./generate.sh 3            # A, B, and A-rev3 instead (next update round)
#
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"

REV="${1:-2}"
command -v python3 >/dev/null || { echo "python3 is required" >&2; exit 1; }

# Scenario 3 & 5 — the baseline set.
python3 gen_win_profiles.py --out ./profiles_A --prefix "LoadTest A" --json ./batch_A.json

# Scenario 4 — differently-named replacement set. Its LocURIs are namespaced off
# the prefix, so A and B stay disjoint (see the README's replace gotcha).
python3 gen_win_profiles.py --out ./profiles_B --prefix "LoadTest B" --json ./batch_B.json

# Update scenario — same names and LocURIs as A, changed <Data> bytes, so
# re-applying it is a pure in-place modify rather than an add/remove.
python3 gen_win_profiles.py --out "./profiles_A_r${REV}" --prefix "LoadTest A" \
  --rev "$REV" --json "./batch_A_r${REV}.json"

echo
echo "Ready. Batch bodies: batch_A.json, batch_B.json, batch_A_r${REV}.json"
echo "XML (for GitOps custom_settings): profiles_A/, profiles_B/, profiles_A_r${REV}/"
