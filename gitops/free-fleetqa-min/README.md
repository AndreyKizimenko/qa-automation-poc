# free-fleetqa-min

Trimmed variant of [`../free-fleetqa/`](../free-fleetqa/) used to verify that `fleetctl gitops` actually applies changes to a live instance.

References payloads in `../lib/` via relative `path:` — the same source of truth the baseline uses for profiles, policies, scripts, reports, and labels. Only the *set* of refs differs, so trimming an item never means editing its content.

## What's different from baseline

| | baseline | min | pagination |
|---|---|---|---|
| Configuration profiles | 23 | 21 | ✓ both |
| Policies | 27 | 22 | ✓ both |
| Reports | 30 | 26 | ✓ both |
| Labels | 25 | 23 | ✓ both |
| Scripts | 11 | 9 | n/a |
| `org_name` | Free QA Automation | Free QA Automation (min) | n/a |

Label and report counts include multi-entry files — 12 label files / 21 report file
refs in baseline expand to 25 labels / 30 reports.

The `org_name` change is a cheap "did gitops actually apply?" signal that doesn't depend on counts.

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
