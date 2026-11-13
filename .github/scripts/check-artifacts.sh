#!/usr/bin/env bash
# Guards one rule: nothing a test run produces leaves CI in the clear.
#
# A Playwright report holds live credentials (typed passwords in step titles, the API
# token in traces and in failed API assertions), and anyone signed in to GitHub can
# download a public repository's artifacts. Reports used to be uploaded as they were.
# Run from anywhere in the repo; exits 1 after printing every problem it finds.
#
# What it checks, and why each one is here:
# - actions/upload-artifact is used in exactly one place, .github/upload-report/action.yml,
#   which encrypts first. Any other use fails. So does any other way of publishing files
#   from a run: GitHub Pages, a release upload, a gist. A step that publishes something
#   which provably holds no report, trace, screenshot, log or environment says so on its
#   own line: `# unencrypted-ok: <reason>`.
# - The upload action still encrypts: it pipes the report through report-crypt.mjs and
#   uploads only a *.tar.gz.enc path. Editing it to upload the directory would undo the
#   rule from the inside.
# - The public key CI encrypts to exists and is a public key, and no private key is
#   tracked anywhere in the repository.
# - report-crypt.mjs works on this machine's Node: round trip, wrong key refused,
#   tampering detected.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1

fail=0
problem() { echo "::error::$*"; fail=1; }

ACTION=.github/upload-report/action.yml
PUBLIC_KEY=.github/report-public-key.pem
CRYPT=.github/scripts/report-crypt.mjs

echo "== upload paths"
publishers='actions/upload-artifact|actions/upload-pages-artifact|actions/deploy-pages|peaceiris/actions-gh-pages|softprops/action-gh-release|gh release (upload|create)|gh gist create'
while IFS= read -r hit; do
  [ -z "$hit" ] && continue
  file="${hit%%:*}"
  rest="${hit#*:}"
  line="${rest%%:*}"
  text="${rest#*:}"
  # A comment that only mentions an action is not a use of it.
  if grep -qE '^[[:space:]]*#' <<< "$text"; then continue; fi
  if [ "$file" = "$ACTION" ] && grep -q 'actions/upload-artifact' <<< "$text"; then continue; fi
  if grep -qE '#[[:space:]]*unencrypted-ok:[[:space:]]*[^[:space:]]' <<< "$text"; then continue; fi
  problem "$file:$line publishes files from a run without encrypting them. Upload a report through ./.github/upload-report; for anything else that is safe to publish, add '# unencrypted-ok: <reason>' to the line."
done < <(git grep -nE "$publishers" -- .github/workflows .github/upload-report .github/gitops-action 2>/dev/null || true)

echo "== the upload action encrypts"
if [ ! -f "$ACTION" ]; then
  problem "$ACTION is missing"
else
  grep -q 'report-crypt.mjs encrypt' "$ACTION" \
    || problem "$ACTION no longer pipes the report through report-crypt.mjs encrypt"
  uploads=$(grep -cE '^[[:space:]]*-?[[:space:]]*uses:[[:space:]]*actions/upload-artifact' "$ACTION")
  [ "$uploads" = 1 ] || problem "$ACTION should call actions/upload-artifact exactly once (found $uploads)"
  # Every `path:` handed to upload-artifact must be the encrypted file.
  paths=$(awk '/uses:[[:space:]]*actions\/upload-artifact/ {inside=1} inside && /^[[:space:]]+path:/ {sub(/^[[:space:]]+path:[[:space:]]*/, ""); print}' "$ACTION")
  [ -n "$paths" ] || problem "$ACTION gives actions/upload-artifact no path"
  while IFS= read -r p; do
    case "$p" in
      ''|*.tar.gz.enc) ;;
      *) problem "$ACTION uploads '$p', which is not the encrypted *.tar.gz.enc file" ;;
    esac
  done <<< "$paths"
fi

echo "== keys"
if [ ! -f "$PUBLIC_KEY" ]; then
  problem "$PUBLIC_KEY is missing: CI has nothing to encrypt reports to"
elif ! node -e "require('crypto').createPublicKey(require('fs').readFileSync(process.argv[1]))" "$PUBLIC_KEY" 2>/dev/null; then
  problem "$PUBLIC_KEY is not a valid public key"
fi
# Built from two pieces so this file doesn't match itself.
marker="PRIVATE"" KEY-----"
tracked=$(git grep -lF -- "$marker" -- . 2>/dev/null || true)
if [ -n "$tracked" ]; then
  printf '%s\n' "$tracked"
  problem "a private key is tracked in the files above; remove it and replace the key pair"
fi

echo "== report-crypt.mjs"
node "$CRYPT" selftest || problem "$CRYPT failed its self-test"

[ "$fail" = 0 ] || exit 1
echo "ok: reports are uploaded only through $ACTION, encrypted to $PUBLIC_KEY"
