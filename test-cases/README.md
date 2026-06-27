# Fleet test case library

Manual/regression test cases for Fleet, organized **by feature area** (not by
product group). This is the human-readable counterpart to the Playwright e2e
suite: it captures **what to test and what the expected result is**, including
scenarios that are impractical to automate (host-dependent flows, MDM
enrollment, GitOps, cross-platform).

The goal is a **great source of truth** and an **effective, non-exhaustive** set
— one solid case per real behavior, no duplication across areas.

## Why this exists

- The [`release-qa`](https://github.com/fleetdm/fleet/blob/main/.github/ISSUE_TEMPLATE/release-qa.md)
  template only covers high-level smokes.
- Feature **stories** carry detailed `## Test plan` checklists that are otherwise
  lost once the story closes.
- We need a durable, reviewable place to run regressions against.

## How cases are derived

1. **Stories (source of intent).** Feature stories (`label:story
   -label:~engineering-initiated`) are read oldest → newest; the `## Test plan`
   (or legacy `## QA > Manual testing steps`) is extracted, superseded behavior
   collapsed, and `TODO`/placeholder plans skipped. Linked Figma / API / `.yml`
   PRs enrich detail.
2. **Live product (source of truth).** Cases are verified against a running Fleet
   instance (Playwright MCP); where story and product disagree, the product wins.
3. **Feature-area curation.** Cases are filed by feature (not by the team that
   built them) and audited for an effective set: duplicates merged, cosmetic /
   low-value checks dropped. See [`AUDIT.md`](AUDIT.md) for the curation log.

## Adding cases for a new feature

When a new feature ships, pull the test cases from its story and **drop them into
the matching feature file** below — no need to figure out a product group. Assign
the next sequential `<AREA>-NNN` id and cite the story in `Source`. If it doesn't
fit an existing file cleanly, it's usually a sign of a genuinely new feature area.

## Organization

One file per feature area. GitOps is cross-cutting (YAML/`fleetctl` flows for any
feature) and kept in its own file.

| File | Feature area | Cases |
|------|------|------:|
| [`hosts.md`](hosts.md) | Host list/details/vitals, My device, labels, fleet membership, status | 19 |
| [`queries-and-reports.md`](queries-and-reports.md) | Live query, saved queries/reports, results, SQL editor | 18 |
| [`policies.md`](policies.md) | Policies, automations, CIS benchmarks, compliance | 19 |
| [`software-inventory.md`](software-inventory.md) | Installed software, versions, OS, vulnerabilities (CVE/CVSS) | 33 |
| [`software-deployment.md`](software-deployment.md) | FMA, VPP/App Store, custom packages, `.ipa`, Android, self-service | 95 |
| [`configuration-profiles.md`](configuration-profiles.md) | Config profiles, OS settings, custom settings, DDM | 19 |
| [`disk-encryption.md`](disk-encryption.md) | FileVault/BitLocker/LUKS, key escrow, recovery keys | 15 |
| [`os-updates.md`](os-updates.md) | OS update enforcement | 9 |
| [`mdm-enrollment.md`](mdm-enrollment.md) | ADE/ABM, Windows/Autopilot/Entra, Android, EUA, migration | 36 |
| [`mdm-commands-and-actions.md`](mdm-commands-and-actions.md) | MDM commands, device actions (lock/wipe/clear passcode) | 18 |
| [`setup-experience.md`](setup-experience.md) | Setup experience: software, scripts, local admin, bootstrap | 32 |
| [`certificates.md`](certificates.md) | SCEP/NDES/ACME/DigiCert CAs, delivery/renewal, host display | 27 |
| [`identity-and-access.md`](identity-and-access.md) | SSO, IdP/SCIM, host IdP identity, conditional access | 23 |
| [`scripts.md`](scripts.md) | Script library, run/execute, results, enable/disable | 25 |
| [`settings-and-integrations.md`](settings-and-integrations.md) | Org/server config, log dest, webhooks, calendars, UI/UX | 37 |
| [`gitops.md`](gitops.md) | GitOps / `generate-gitops` / `fleetctl` across all features | 77 |
| [`activity-and-audit.md`](activity-and-audit.md) | Activity feed, audit log | 13 |

**515 cases.** Only the software-derived cases have been fully live-verified;
others are derived from story test plans and verified at the navigation/structure
level — host/integration-gated cases are flagged by their Preconditions.

## Test case anatomy

```
### HOSTS-001 — Host details page shows the fleetd version

- **Tier:** Free               (Free | Premium | Both — gated by license)
- **Priority:** P1             (P0 smoke/release-blocker | P1 core | P2 extended)
- **Platforms:** All           (macOS | Windows | Linux | iOS/iPadOS | Android | All | N/A)
- **Preconditions:** Enrolled hosts; one on a previous orbit version for comparison.
- **Source:** #17361           (origin stories — traceability back to intent)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the Host details page for a host running new orbit | The fleetd (orbit) version is shown |
```

### Conventions

- **ID scheme:** `<AREA>-<NNN>`, zero-padded to 3, running per feature file. Area
  codes: `HOSTS QUERY POLICY SWINV SWDEP PROFILE DISK OSUPDATE ENROLL MDMCMD SETUP
  CERT IDENTITY SCRIPT SETTINGS GITOPS ACTIVITY`. New cases append the next id.
- **One test case = one user-observable outcome.** Prefer several focused cases
  over one mega-case with branching.
- **Steps are imperative; expected results are observable.** "Profile shows status
  Pending", not "it works".
- **Tier matters.** Mark Premium-only cases; Free cases must also be verified to
  be correctly *hidden/restricted* under Free.
- **One home per behavior.** If a behavior spans product groups (software ↔ MDM),
  it lives in exactly one feature file — don't duplicate. GitOps variants of a
  flow go in [`gitops.md`](gitops.md).
