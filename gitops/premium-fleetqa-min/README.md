# premium-fleetqa-min

Trimmed variant of [`../premium-fleetqa/`](../premium-fleetqa/). Used to verify that `fleetctl gitops` actually applies changes to a live Premium instance, including team-scoped resources.

References files in `../lib/` like the baseline. Each scope (no-team, Workstations) trims a few items so gitops-verify can detect the difference.

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

## The instances rest on this variant

Every gitops chain (the nightly, a branch run) applies the baseline, verifies it, then applies this variant and
ends there, so between runs the instance holds min, not the baseline. Workstations shows 3 of its 5 reports, for
example: `fleets/workstations.yml` drops "Collect XProtect reports" and "Detect if Apple Intelligence is enabled".
Before calling a declared item missing, diff the two configs; a spec that reads a gitops item reads one both
declare ("Collect default browser on macOS").
