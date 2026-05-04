# premium-fleetqa-min

Trimmed variant of [`../premium-fleetqa/`](../premium-fleetqa/). Used to verify that `fleetctl gitops` actually applies changes to a live Premium instance, including team-scoped resources.

References files in `../lib/` like the baseline. Each scope (no-team, Workstations) trims a few items so api-verify can detect the difference.

## What's different from baseline

| Scope | Resource | baseline | min | paginates? |
|---|---|---:|---:|---|
| No team | profiles | 23 | 21 | ✓ both |
| No team | policies | 27 | 22 | ✓ both |
| No team | reports | 30 | 26 | ✓ both |
| No team | scripts | 11 | 9 | n/a |
| No team | labels | 25 | 23 | ✓ both |
| Workstations | profiles | 23 | 21 | ✓ both |
| Workstations | policies | 23 | 21 | ✓ both |
| Workstations | scripts | 6 | 5 | n/a |

`org_name` also differs (`Premium QA Automation (min)`) for a cheap drift signal.
