# premium-fleetqa-reset

Empty variant of [`../premium-fleetqa/`](../premium-fleetqa/). Applied
as the final gitops step before the Playwright nightly so both the
no-team scope and the Workstations team start as a known blank slate.

What's wiped per scope:

| Scope | Resource | baseline | reset |
|---|---|---:|---:|
| No team | Configuration profiles | 23 | 0 |
| No team | Scripts | 11 | 0 |
| No team | Policies | 27 | 0 |
| No team | Reports | 30 | 0 |
| Workstations | Configuration profiles | 23 | 0 |
| Workstations | Scripts | 6 | 0 |
| Workstations | Policies | 23 | 0 |
| Workstations | Queries | * | 0 |

The Workstations team is preserved because the top-level ABM/VPP config
binds device assignment to its name — only its content is wiped.

Preserved:

- `agent_options`
- `org_settings` — features, MDM/ABM/VPP, EUA, SSO, server URL, org info
- Labels (test infrastructure — tests filter hosts by these)

## Usage

Apply via the `gitops-premium-reset` workflow (runs as the final step of the nightly chain), or locally:

```bash
set -a; source playwright/.env.premium; set +a
fleetctl gitops \
  -f gitops/premium-fleetqa-reset/default.yml \
  -f gitops/premium-fleetqa-reset/fleets/workstations.yml \
  --delete-other-fleets
```

The Playwright suite's `cleanup-teardown` project re-wipes no-team
entities at the end of every test run as defence in depth.
