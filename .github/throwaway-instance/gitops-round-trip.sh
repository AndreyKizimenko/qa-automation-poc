#!/usr/bin/env bash
# `fleetctl generate-gitops` on a brand-new server, its output applied back with `fleetctl gitops`, and
# generated again: the release checklist's "generate-gitops from a brand-new Fleet server", and proof that
# what it writes is a config the same server accepts and reproduces.
#
#   ENROLL_SECRET=… .github/throwaway-instance/gitops-round-trip.sh <work-dir>
#
# fleetctl must be the server's own build and already logged in (`fleetctl config set`; `CONFIG=` names
# another config file). ENROLL_SECRET is the server's enroll secret, which generate-gitops leaves out.
set -euo pipefail
work=${1:?usage: gitops-round-trip.sh <work-dir>}
mkdir -p "$work"

fleetctl generate-gitops --dir "$work/first"

# generate-gitops redacts the enroll secret to a TODO line; the copy that is applied names it from the
# environment instead, as a real gitops repo does. A change to that line fails here, not in the apply.
todo='  - secret: # TODO: Add your enroll secrets here'
if ! grep -qxF "$todo" "$work/first/default.yml"; then
  echo "::error::generate-gitops no longer writes the redacted enroll secret as \"$todo\": update $0"
  exit 1
fi
sed "s|^$todo\$|  - secret: \$ENROLL_SECRET|" "$work/first/default.yml" > "$work/applied.yml"

fleetctl gitops -f "$work/applied.yml"
fleetctl generate-gitops --dir "$work/second"

# A setting a brand-new server has never saved comes out with no value, and the apply saves it as
# false (integrations.conditional_access_enabled and certificates_disable_host_end_user_binding on
# the first Fleet 5 builds), so "no value" and "false" compare equal. Anything else that differs fails.
normalize() { sed -E 's/: false$/:/' "$1"; }
if ! diff -u <(normalize "$work/first/default.yml") <(normalize "$work/second/default.yml"); then
  echo "::error::generate-gitops wrote a different config after its own output was applied (diff above)"
  exit 1
fi
if ! diff -r -x default.yml "$work/first" "$work/second"; then
  echo "::error::generate-gitops wrote different files after its own output was applied (diff above)"
  exit 1
fi
echo "generate-gitops → gitops → generate-gitops: the same config"
