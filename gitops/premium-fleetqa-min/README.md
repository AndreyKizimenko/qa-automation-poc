# premium-fleetqa-min

Trimmed variant of [`../premium-fleetqa/`](../premium-fleetqa/). Used to verify that `fleetctl gitops` actually applies changes to a live Premium instance, including team-scoped resources.

References files in `../lib/` like the baseline. Each scope (no-team, Workstations) trims a few items so gitops-verify can detect the difference.

## What's different from baseline

| Scope | Resource | baseline | min | paginates? |
|---|---|---:|---:|---|
| No team | profiles | 23 | 21 | ✓ both |
| No team | policies | 29 | 24 | ✓ both |
| No team | reports | 32 | 28 | ✓ both |
| No team | scripts | 11 | 9 | n/a |
| No team | labels | 27 | 24 | ✓ both |
| No team | custom host vitals | 3 | 2 | n/a |
| Workstations | profiles | 23 | 21 | ✓ both |
| Workstations | policies | 23 | 21 | ✓ both |
| Workstations | scripts | 6 | 5 | n/a |

Counts prove that an apply creates and deletes. **Values** prove that it updates, which fleetdm/fleet#48021
(omitted keys aren't reset) makes the more important half, so every settings section the baseline declares has
one changed value here: `org_name` (`Premium QA Automation (min)`), `fleet_desktop.transparency_url`,
`activity_expiry_settings.activity_expiry_window` (31), every webhook's destination path (`/fleet-min/…`),
`features.additional_queries` (one query instead of two), the inline policy's query and the label-scoped
policy's `critical`, and the inline reports' `interval` and `logging`. The `gitops` block and the Pilot hosts
label are identical in both: the gitops-mode specs read the repository URL, and the label is referenced.

## The instance ends each chain on this variant — then the suite wipes most of it

Every gitops chain (the nightly, a branch run) applies the baseline, verifies it, then applies this variant and
ends there. The suite's `cleanup-setup` and `cleanup-teardown` then delete every global report, policy, script
and profile, and Workstations' policies, profiles, scripts and software. So between runs the instance holds
**this variant's org settings, labels and custom host vitals, Workstations' reports (3 of its 5:
`fleets/workstations.yml` drops "Collect XProtect reports" and "Detect if Apple Intelligence is enabled"), and
everything on QA and VMs** — and none of the rest until the next chain re-applies it. Before calling a declared
item missing, check which of those it is; a spec that reads a gitops item reads one both configs declare and the
cleanup keeps ("Collect default browser on macOS").
