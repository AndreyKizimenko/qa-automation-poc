# free-fleetqa

GitOps config for the **Free** QA Fleet instance. Fleet Free has no teams, so this is
a single `default.yml` covering org settings plus the global controls, policies,
reports, labels, and scripts the Playwright free suite expects to find.

```
free-fleetqa/
└── default.yml              # org settings + global controls/policies/reports/labels/scripts
```

All `path:` references resolve to `../lib/` — the same shared payloads the premium
configs use, so a profile or policy is authored once and applied on both tiers.

## Apply

```bash
set -a; source playwright/.env.free; set +a
fleetctl gitops -f gitops/free-fleetqa/default.yml
```

The config interpolates `$FLEET_URL`, `$FLEET_ENROLL_SECRET`, and
`$FLEET_SSO_METADATA_URL`, so sourcing `.env.free` first is what supplies them. In CI
this runs via the `gitops-free` workflow, which reads the same values from repo
secrets.

Note that on free the **enroll secret is managed by gitops** (premium manages it
per-team instead), so applying this config rotates the secret to whatever
`$FLEET_ENROLL_SECRET` holds.

## Scope summary

| Resource | Count |
|---|---:|
| Configuration profiles | 23 |
| Policies | 27 |
| Reports | 30 |
| Labels | 25 |
| Scripts | 11 |

Report and label counts expand from multi-entry files (21 report file refs / 12 label
files).

## Verifying an apply landed

[`../free-fleetqa-min/`](../free-fleetqa-min/README.md) is a deliberately trimmed
variant of this config. The nightly orchestrator applies baseline → verifies → applies
min → verifies, so a gitops apply that silently no-ops gets caught by the count and
`org_name` differences between the two.

For background on the file format itself, see
[Fleet's YAML documentation](https://fleetdm.com/docs/configuration/yaml-files).
