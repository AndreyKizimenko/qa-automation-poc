# Batch H — gitops mode V2

**5 gaps → about 10 tests in the `gitops-mode` project, in new files.** `Controls gated surfaces` · `The
software exception` · `Variables` · `Change management` · `Policies, Reports, Software, OS settings`

**Status: ready for review** (planned 2026-10-01).

> ## ▶ Start here
>
> **Branch from `main` at or after da2aceb** ([PR #82](https://github.com/AndreyKizimenko/qa-automation-poc/pull/82),
> batches A and B). **Invoke the `playwright-test-author` skill first** (Skill tool) and follow it. Then read, in order:
> [README.md](README.md) §4–§5, round 2's [G-out-of-band.md](../round-2/G-out-of-band.md) (the gitops-mode V1
> work and its *Parked for V2* list) and [GITOPS-PLAN.md](../round-2/GITOPS-PLAN.md), `playwright/CLAUDE.md`
> (the `gitops-mode` project), then this file.
>
> **What this batch is.** Round 2's gitops-mode V1 asserted the indicator, the links, the Settings and Hosts
> gated surfaces and two exceptions, and parked the rest. This batch is that parked list. **Gitops mode is a
> global switch** that makes every mutating control read-only, so everything here runs in the `gitops-mode`
> project: alone, one worker, no retries, after the exclusive step.
>
> **Since batches A and B (2026-10-03).** The full list is in
> [README §5](README.md#since-batches-a-and-b-2026-10-03). These apply here:
>
> - **Variables have a helper and a sweep** (§2.3): `createVariable`, and the next run's `cleanup-setup` deletes
>   any `PW_VAR_*` variable.
> - **`EnrollSecretModal` acts on a secret by its value only.** For gated-state reads use
>   `modal.rowControls(modal.rows.first())`, as `02` and `03` do. Never write the global enroll list: the
>   simulations re-enroll with it, and `restoreGlobalEnrollSecrets` is the only write a spec makes there.
> - **A toast doesn't prove a second save.** `ChangeManagementPage.save()` waits on a toast that stays up for
>   seconds, so confirm each save through `getGitOpsMode` (`expect.poll`) (§2.4).
> - **Restore in an `afterEach`**, keyed to the test that changed something; a timed-out test skips its `finally`.
> - **If another batch is built at the same time**, a gitops-mode run needs its session's explicit "go": the flag
>   makes every control its run clicks read-only.
>
> Facts below were checked on 2026-10-01 against `main` (d55846a) and Fleet `rc-minor-fleet-v4.93.0`, the build
> both instances run, and again on 2026-10-03 against `main` (da2aceb) and the RC branch's head (ac3c0d6).

## The gaps

| Gap | What's untested today | Proposed target | Kind | Source flow |
|---|---|---|---|---|
| round 2 #57 | Controls gated surfaces: Disk encryption checkbox / BitLocker PIN / Save, Configuration profiles Add / Delete | `premium/gitops-mode/02-gated-surfaces.spec.ts` | augment | `Fleet_20260828 (1)/Premium/src/tests/gitops/gitops-mode-gated-areas-of-the-ui-controls.spec.ts` |
| round 2 G V2 | the `software` exception: the FMA form's Add software and the Library accordion's Delete gated (round 2 thought two product bugs blocked it; one was closed as not reproducible, the other is a seeding need) | `premium/gitops-mode/03-exceptions.spec.ts` | augment | round 2 [G › Parked for V2](../round-2/G-out-of-band.md) |
| round 2 G V2 | Controls › Variables' split gating (Add variable disabled, Delete <name> enabled) | `premium/gitops-mode/02-gated-surfaces.spec.ts` | augment | round 2 [G › Parked for V2](../round-2/G-out-of-band.md) |
| round 2 G V2 | the Change-management UI write flow: tick an exception, Save, toast and activity; "Git repository URL is required" (round 2 #58) | `premium/gitops-mode/…` (new) | new | round 2 [G › Parked for V2](../round-2/G-out-of-band.md) |
| round 2 G V2 | Policies, Reports, Software-title details and Controls › OS settings gated surfaces | `premium/gitops-mode/02-gated-surfaces.spec.ts` | augment | round 2 [G › Parked for V2](../round-2/G-out-of-band.md) |

## 1. Review first

- **The `software` exception isn't blocked.** Round 2 parked it as "blocked by two product bugs". The first was
  #54169, closed as not reproducible (`GITOPS-PLAN.md:505-515`); the second is a seeding need (an
  app-not-yet-added resolver), not a bug. `blocked-by-product-bugs.md` has no software-exception row (its gitops
  rows are #48218 and #54168). It's buildable now.
- **GITOPS-PLAN's empty-URL "third state" is unreachable**: the server refuses to turn gitops mode on with an
  empty repository URL (`server/service/appconfig.go:1265-1266`). Drop it. The UI's "Git repository URL is
  required when GitOps mode is enabled" is still assertable as a form error (§2.4).
- **The Policies / Reports / Software / OS-settings row is breadth, not signal** (round 2 G said so,
  `G-out-of-band.md:225-226`), and its software-title and OS-settings parts overlap the rows above. Build the
  wrapped controls that differ from what's asserted; don't walk every page.
- **The BitLocker PIN proves nothing about gating** (§2.1): it's disabled whenever Windows encryption is off.

## 2. Facts for the build

### 2.1 Controls gated surfaces (round 2 #57)

- **Disk encryption:** "Enable disk encryption" (`DiskEncryption.tsx:302`) and "Require BitLocker PIN" (`:444`)
  read the gitops flag directly, so assert `toBeDisabled()`; only Save goes through the gitops wrapper (`:267`), so
  assert its tooltip with `expectGatedByGitOps`.
- **Configuration profiles:** "Add profile" (`ConfigurationProfiles.tsx:229-238,287,313`) and each `Delete <name>`
  (`ProfileListItem.tsx:239-255`) are wrapped; View, Edit and Download stay enabled.
- **Seed on Workstations** with `uploadProfile(workstationsFleetId, inertMobileconfig(...))` (the inert pattern in
  `helpers/profiles.ts`; Workstations has no real host), delete it in `afterAll`. **Never upload on Unassigned**:
  MDM-enrolled simulations sit there. Never click Save.

### 2.2 The `software` exception

- **The Fleet-maintained app form's "Add software"** is wrapped with `entityType="software"`
  (`FleetAppDetailsForm.tsx:310-328`). It's also disabled when the app is already added, so resolve an app that
  isn't: `GET /software/fleet_maintained_apps?fleet_id=N&available=true` (`countFleetMaintainedApps` sends
  `available`, but no helper returns an id yet). `FleetMaintainedAppDetailPage.addSoftwareButton` exists; the page
  has no `goto`.
- **The Library accordion's "Delete this version"** is gated only for Fleet-maintained, App Store or multi-package
  titles (`LibraryItemAccordion.tsx:590-612`). The VMs fleet's durable FMA can be viewed read-only.
- Ticking the exception should lift exactly these. **Never click either button.**

### 2.3 Variables' split gating

"Add variable" is wrapped with no entity type (`GlobalVariables.tsx:138-194`); `Delete <name>` has no wrapper
("Delete is allowed in GitOps mode", `GlobalVariablesTableConfig.tsx:86-101`). Seed a variable with
`createVariable(request, name, value)` (`helpers/api/variables.ts`), named `PW_VAR_<stamp>` like
`shared/controls/custom-variables.spec.ts`'s, and delete it in an `afterEach` (`deleteVariablesMatching`). The
gitops-mode invocation doesn't run `cleanup-setup`, so a leftover waits for the next run's `PW_VAR_*` sweep. The
`secrets` exception means **enroll** secrets; it doesn't unlock Add variable.

### 2.4 The Change-management write flow

- `IntegrationsPage/cards/ChangeManagement/ChangeManagement.tsx`: checkboxes Labels / Software / Enroll secrets; the
  URL input is disabled while the mode is off. Errors: "Git repository URL is required when GitOps mode is
  enabled", "Git repository URL must include protocol (e.g. https://)" (`:43-47`). Save sends the whole `gitops`
  subtree (`:126-136`); toast "Successfully updated settings" (`:148`). `ChangeManagementPage.save()` waits on that
  toast, which stays up for seconds: a second save in the same test can pass on the first one's, so read each
  save back through `getGitOpsMode`.
- Activities `enabled_gitops_exception` / `disabled_gitops_exception` and `enabled_gitops_mode` /
  `disabled_gitops_mode` (`server/fleet/activities.go:866-913`), logged on API flips too. Feed copy: "enabled the
  labels exception for GitOps." / "enabled GitOps mode in the UI." (`GlobalActivityItem.tsx:1164-1174`); neither is
  in `activity-copy.ts`. Identical activities from earlier flips are already in the feed: anchor on
  `latestActivityId` / `assertActivityAfter`.
- **State the teardown doesn't restore.** `disableGitOpsMode` flips only the flag
  (`helpers/api/gitops-mode.ts:95-108`); only `withGitOpsMode`'s snapshot restores the exceptions and the URL. A
  killed run leaves a ticked exception, and **exceptions change what `fleetctl gitops` does** (a `labels`
  exception keeps labels the YAML omits), so a stuck one alters the nightly's gitops chain. And
  `01-indicator-and-links`'s `afterAll` restorer would re-apply its pre-run snapshot. So: tick **one exception
  only**, restore it in an `afterEach`, never type or blank the URL (QA Wolf blanked it), and add a cleanup step
  that restores the exceptions to their declared values if a run dies.
- The disabled-Save check will go stale (form validation is moving to submit-only); assert the error copy.

### 2.5 Policies, Reports, Software-title, OS settings

Policies: the list's checkboxes (`PoliciesTableConfig.tsx:469,497`) and the form's Save (`PolicyForm.tsx:826`) are
wrapped. Reports: Save and Save as new (`EditQueryForm.tsx:826,845`); Live report isn't. `createPolicy` is
global-only, so a seeded policy would run on the VMs. Use `createFleetPolicy` (PR #78) on Workstations, or
`SELECT 1;`.

## 3. The project's limits

`workers: 1`, `fullyParallel: false`, `retries: 0` (`playwright.config.ts:284-302`); CI's step runs with
`--global-timeout=900000` (`.github/workflows/playwright-premium.yml:150-154`). Today: 19 tests, about a minute
on one worker (0.9 min in run 37077445852; `01` 3 tests; `02` serial, ending with "Change management stays fully
editable" at `:132`; `03` labels and secrets, one skipped for #48218; `zz-everything-is-back` 6 tests). About
10–12 new tests at 3–6 s each add roughly a minute; an `addFmaToFleet` seed would add 5–45 s, so prefer the
"available" resolver.

## Reusable pieces

`pages/components/gitopsMode.ts` (`expectGatedByGitOps`, `expectNotGatedByGitOps`, `expectGitOpsTooltip`),
`helpers/api/gitops-mode.ts` (`withGitOpsMode`, `setGitOpsException`, `enableGitOpsMode`, `getGitOpsMode`),
`ChangeManagementPage` (`exceptionCheckbox`, `save`; no error locator yet), `DiskEncryptionPage`,
`ConfigurationProfilesPage`, `VariablesPage`, `EnrollSecretModal` (`goto(fleetId)`, `rowControls`),
`SoftwareTitleDetailPage`, `FleetMaintainedAppDetailPage.addSoftwareButton`, `latestActivityId` /
`assertActivityAfter`; API: `createVariable` / `deleteVariablesMatching`, `createFleetPolicy`, `uploadProfile`.

## Decisions to put to Andrey

1. **Change management's write flow:** OK to tick and restore one exception, plus a cleanup step restoring the
   declared exceptions after a dead run (§2.4)?
2. **The breadth row** (§2.5): build only the wrapped controls not already asserted, or cut it.

## Traps this batch will hit

- **`02-gated-surfaces` is serial with no retries.** Put new tests in new files numbered before `zz-`.
- **`zz-everything-is-back` can't detect a leftover exception.** Your `afterEach` is the only guard.
- **A concurrent `PATCH /config`** (another run, another batch's session, a person) can flip the flag mid-run:
  `gh run list` first, and announce the run to any parallel session.
- **Fleet's default exception set has `secrets: true`** (`server/fleet/app.go:1587`); the live value is
  unverified, so read it before asserting what an exception lifts.

## Done when

- Every row has a written review decision; the questions above have Andrey's answer.
- The new gitops-mode specs built, each restoring every exception and seeded item it touched, and the cleanup
  step for exceptions in place if Andrey agreed to it.
- `npm run check` clean; `npm run test:gitops-mode` green twice (login, the specs, teardown), and once headed.
- `playwright-test-reviewer` run on the branch's diff, findings fixed or answered.
- Docs in the same commits: this file's *What landed*, a [DELIVERY-LOG](../DELIVERY-LOG.md) line, a
  [test-audit](../../test-audit/README.md) entry per `test()`, round 2's [GITOPS-PLAN.md](../round-2/GITOPS-PLAN.md)
  (V2 done, the third state dropped), and this round's [README](README.md) batch table and [INDEX](INDEX.md).
- PR open, Andrey told it's ready for its branch run.

## What landed

*Nothing yet.*
