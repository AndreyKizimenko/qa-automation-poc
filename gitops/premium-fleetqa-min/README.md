# premium-fleetqa-min

Trimmed variant of [`../premium-fleetqa/`](../premium-fleetqa/). Used to verify that `fleetctl gitops` actually applies changes to a live Premium instance, including team-scoped resources.

References files in `../lib/` like the baseline. Each scope (no-team, Workstations, Compliance) trims a few items so gitops-verify can detect the difference.

## What's different from baseline

| Scope | Resource | baseline | min | paginates? |
|---|---|---:|---:|---|
| No team | profiles | 23 | 21 | ✓ both |
| No team | policies | 29 | 24 | ✓ both |
| No team | reports | 32 | 28 | ✓ both |
| No team | scripts | 11 | 9 | n/a |
| No team | labels | 28 | 25 | ✓ both |
| No team | custom host vitals | 3 | 2 | n/a |
| Workstations | profiles | 23 | 21 | ✓ both |
| Workstations | policies | 23 | 21 | ✓ both |
| Workstations | scripts | 6 | 5 | n/a |
| Compliance | profiles | 6 | 4 | n/a |
| Compliance | policies | 7 | 6 | n/a |
| Compliance | reports | 2 | 1 | n/a |
| Compliance | scripts | 12 | 6 | n/a |
| Compliance | custom packages | 5 | 3 | n/a |

Counts prove that an apply creates and deletes. **Values** prove that it updates, which fleetdm/fleet#48021
(omitted keys aren't reset) makes the more important half, so every settings section the baseline declares has
one changed value here: `org_name` (`Premium QA Automation (min)`), `fleet_desktop.transparency_url`,
`activity_expiry_settings.activity_expiry_window` (31), every webhook's destination path (`/fleet-min/…`),
`features.additional_queries` (one query instead of two), `vulnerability_exposure_historical_reporting.cvss_min`
(8), `controls.macos_migration.webhook_url` (`/fleet-min/`), the inline policy's query and the label-scoped
policy's `critical`, and the inline reports' `interval` and `logging`. The `gitops` block, the ABM and Windows
default fleets, the other global MDM flags and the Pilot hosts label are identical in both: the gitops-mode
specs read the repository URL, a flipped MDM flag would change how real hosts enroll, and the label is referenced.

On Compliance every section has a changed value too: `agent_options.command_line_flags.events_max`,
`host_expiry_window`, both webhook paths, Recovery Lock off, the macOS minimum version, the iPadOS deadline, the
Windows deadline days, macOS key escrow off, the BitLocker PIN off, `lock_end_user_info` off, the local account
type (`admin`), DB Browser's `self_service` off, the Gatekeeper policy without its script automation, and the
FileVault report's interval — and every list drops an entry (a macOS and a Windows profile, the Windows scripts
glob, the Linux package and the Windows script-only package, the "Itsycal is installed" policy, the uptime report).

## The instance ends each chain on this variant — then the suite wipes most of it

Every gitops chain (the nightly, a branch run) applies the baseline, verifies it, then applies this variant and
ends there. The suite's `cleanup-setup` and `cleanup-teardown` then delete every global report, policy, script
and profile, and Workstations' policies, profiles, scripts and software. So between runs the instance holds
**this variant's org settings, labels and custom host vitals, Workstations' reports (3 of its 5:
`fleets/workstations.yml` drops "Collect XProtect reports" and "Detect if Apple Intelligence is enabled"),
everything on QA and VMs, and this variant's Compliance fleet in full** (the cleanup never touches it) — and
none of the rest until the next chain re-applies it. Before calling a declared item missing, check which of
those it is; a spec that reads a gitops item reads one both configs declare and the cleanup keeps ("Collect
default browser on macOS").
