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
| Policies | 28 |
| Reports | 31 |
| Labels | 27 |
| Scripts | 11 |
| Custom host vitals | 3 |

Report and label counts expand from multi-entry files (21 report file refs / 14 label
files), and include the entities `default.yml` declares inline: a policy with every key a
free policy can hold and a report with every option set away from its default (`critical`,
label targeting and the automations are premium). The two Linux scripts come from one
`paths:` glob.

## What default.yml declares beyond the lib lists

The org-level surface a free customer manages from YAML, each holding the value the instance
already had so that gitops owns it and `gitops-verify` holds the instance to it:
`server_settings` (every documented key), `features` with `additional_queries` (two benign
detail queries every host answers) and `historical_data.uptime` (on — turning it off deletes
the dashboard's history; the vulnerabilities dataset is premium), `fleet_desktop` at Fleet's
defaults (changing any of its keys is premium, so free can only hold them), `activity_expiry_settings`,
all four `webhook_settings` (declared and off, with example destinations), `secrets`, and
`controls.android_enabled_and_configured` (Android MDM was turned on in the UI; the server ignores
the key on a config write, so it records the assumption). The min variant changes one value in
each section so the nightly proves updates, not only creates and deletes. Nothing new reaches
the free VMs: on free the real VMs sit in Unassigned, which is where no-team `controls` land, so
free's `controls` stay as they were.

## Verifying an apply landed

[`../free-fleetqa-min/`](../free-fleetqa-min/README.md) is a deliberately trimmed
variant of this config. The nightly orchestrator applies baseline → verifies → applies
min → verifies, so a gitops apply that silently no-ops gets caught by the count and
`org_name` differences between the two.

For background on the file format itself, see
[Fleet's YAML documentation](https://fleetdm.com/docs/configuration/yaml-files).
