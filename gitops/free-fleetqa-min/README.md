# free-fleetqa-min

Trimmed variant of [`../free-fleetqa/`](../free-fleetqa/) used to verify that `fleetctl gitops` actually applies changes to a live instance.

References payloads in `../lib/` via relative `path:` — the same source of truth the baseline uses for profiles, policies, scripts, reports, and labels. Only the *set* of refs differs, so trimming an item never means editing its content.

## What's different from baseline

| | baseline | min | pagination |
|---|---|---|---|
| Configuration profiles | 23 | 21 | ✓ both |
| Policies | 28 | 23 | ✓ both |
| Reports | 31 | 27 | ✓ both |
| Labels | 27 | 24 | ✓ both |
| Scripts | 11 | 9 | n/a |
| Custom host vitals | 3 | 2 | n/a |
| `org_name` | Free QA Automation | Free QA Automation (min) | n/a |

Label and report counts include multi-entry files — 14 label files / 21 report file
refs in baseline expand to 27 labels / 31 reports — and the inline policy and report.

Counts prove that an apply creates and deletes. Values prove that it updates, which
fleetdm/fleet#48021 (omitted keys aren't reset) makes the more important half, so every
settings section the baseline declares has one changed value here: `org_name`,
`activity_expiry_settings.activity_expiry_window` (31), every webhook's destination path
(`/fleet-min/…`), `features.additional_queries` (one query instead of two), the inline
policy's query, and the inline report's `interval` and `logging`. `fleet_desktop` can't carry
a delta on free (changing it is premium).

## Usage

Apply via the `gitops-free-min` workflow, or locally:

```bash
set -a; source playwright/.env.free; set +a
fleetctl gitops -f gitops/free-fleetqa-min/default.yml
```

The Playwright `gitops-verify` project reads whichever target is pointed at via
`GITOPS_TARGET` — a config directory, or a single `fleets/*.yml` for team scope — and
asserts the live instance matches. Run it with
`npm run test:gitops-verify:free-min` from `playwright/`.
