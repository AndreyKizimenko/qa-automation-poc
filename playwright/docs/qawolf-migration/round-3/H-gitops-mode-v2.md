# Batch H — gitops mode V2

**5 gaps → about 10 tests in the `gitops-mode` project, in new files.** `Controls gated surfaces` · `The
software exception` · `Variables` · `Change management` · `Policies, Reports, Software, OS settings`

**Status: built 2026-10-07, ships with batch G** (planned 2026-10-01; re-checked 2026-10-05 against batches C and D's
learnings, and 2026-10-07 against E and F's; reviewed and built 2026-10-07: 7 tests, every recommendation accepted,
see *Review decisions*, *Decisions* and *What landed*).

> ## ▶ Start here
>
> **Branch from `main` at or after 68c8846** ([PR #89](https://github.com/AndreyKizimenko/qa-automation-poc/pull/89),
> batches E and F; [PR #90](https://github.com/AndreyKizimenko/qa-automation-poc/pull/90)). **Invoke the `playwright-test-author` skill first** (Skill tool) and follow it. Then read, in order:
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
> **Since batches C and D (2026-10-05).** The full list is in
> [README §5](README.md#since-batches-c-and-d-2026-10-05). H draws no hosts, so their host-picker, slice and
> label-membership rules don't apply. These do:
>
> - **Running and cancelling batch scripts aren't gated** in gitops mode (§2.5): D's surfaces are operations, like
>   Add hosts. A script row's Edit and Delete are gated; Download isn't.
> - **The Hosts list's label pill** (*Edit label* / *Delete label*) is gated with `entityType="labels"`
>   (`HostsFilterBlock.tsx:220-255`) and shows only for a custom label. Not in this batch (decision 3).
> - **Check the exception activities through the API**, keyed to their `exception` detail: the project's own
>   flips log the same types over and over and crowd the feed (§2.4).
> - **Clear toasts between saves**: `changeManagement.toast.dismissAll()` before a second Save (§2.4).
> - **Nothing declares the exceptions** (§2.4): gitops rejects `org_settings.gitops.exceptions` outright, so a
>   cleanup step restores a pinned baseline, not "declared values" (decision 1).
>
> **Since batches E and F (2026-10-07).** The full lists are in [README §5](README.md#since-batch-e-2026-10-05)
> and [§5 › Since batch F](README.md#since-batch-f-2026-10-07). H draws no hosts and no static users. These apply:
>
> - **The BitLocker PIN can prove gating** on a throwaway `pw-*` fleet with Windows encryption on (§2.1,
>   decision 4). Scope a throwaway fleet by URL, never `TeamDropdown.selectByLabel`; `deleteFleet` takes its
>   bootstrap package with it.
> - **A report seeded on Workstations** (§2.5's Reports row) isn't swept by name: `cleanup-setup` deletes Workstations
>   reports only by exact prefix (`pw-role-`, `Copy of playwright-saveasnew-`), and this project runs no
>   `cleanup-setup`. Delete it in an `afterEach` and add its prefix to that sweep, or read a gitops report.
>   Workstations holds three of its five between runs (every gitops chain ends on the min config); "Collect default
>   browser on macOS" is in both.
> - **An app store app's Edit configuration looks ungated** (§1). Opening it throws Fleet's missing-Ace-worker
>   error ([#54845](https://github.com/fleetdm/fleet/issues/54845)), which `pageHealth` ignores by name
>   (`DEFAULT_IGNORED_PAGE_ERRORS`), so a probe of its Save is safe to write.
> - **Root a `filter({ has })` locator at the page**, never at a scoped locator, whenever H scopes a control to a
>   card or a modal (README › Since batch F).
> - **The setup-experience and MDM-settings forms F saves are gitops-gated**, with page-object members F added
>   (`BootstrapPackagePage.manualAgentInstallCheckbox`, `InstallSoftwarePage.rowCheckbox` /
>   `cancelSetupIfSoftwareFailsCheckbox`, `IntegrationsPage`'s migration form). None is an H gap and round 3 adds no
>   scope: note them in GITOPS-PLAN as V3 candidates, beside decision 3's.
> - **Reuse what E built:** `PoliciesListPage.narrowTo` and `ReportsListPage.narrowTo` (a row by name, tags and
>   all), `ReportsListPage.liveReportButton`, the `AccessDenied` component.
> - **If built beside G**, every gitops-mode run makes G's controls read-only: announce it and wait for G's "go",
>   and ship in one PR with one branch run (README › Since batch F).
>
> Facts below were checked on 2026-10-01 against `main` (d55846a) and Fleet `rc-minor-fleet-v4.93.0`, the build
> both instances run, again on 2026-10-03 against `main` (da2aceb) and the RC branch's head (ac3c0d6), and on
> 2026-10-05 against `main` (61db6b0) and the RC head both instances ran then (c87f85c, which has no frontend or
> gitops changes since ac3c0d6; every Fleet line cited below re-checked), and on 2026-10-07 against `main` (68c8846)
> and the build both instances run now (8d05209: no frontend change, and no cited Fleet or suite line moved).

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
  `G-out-of-band.md:279-280`), and its software-title and OS-settings parts overlap the rows above. Build the
  wrapped controls that differ from what's asserted; don't walk every page.
- **An app store app's Edit configuration is not a gitops-mode bypass** *(checked at review, 2026-10-07)*. The
  Actions menu is built in `SoftwareDetailsSummary.tsx`, not `SoftwareSummaryCard` (which only passes the handler
  down), and `buildActionOptions` disables "Edit configuration" in gitops mode with the gitops tip, through
  `useGitOpsMode("software")` (`:108-114`, `:222`). `EditConfigurationModal` needs no check of its own: nothing else
  opens it. Nothing to probe or file.
- **The BitLocker PIN adds nothing to the enforcement checkbox** *(checked at review)*. Its disabled state is
  `isPlatformFormDisabled("windows") || !windowsEnabled` (`DiskEncryption.tsx:423-426`), the same
  `isPlatformFormDisabled` (`:150-151`) that disables "Enable disk encryption" one line above. Asserting the
  checkbox proves the gitops branch; a throwaway fleet with Windows encryption on would prove it again. Cut
  (decision 4).
- **A stuck exception changes what `fleetctl gitops` does, with the mode on or off** *(found at review; read from
  Fleet's source at 8d05209, not reproduced)*. `client.go:2258-2300` and `:2593-2610` read
  `config.gitops.exceptions` whatever `gitops_mode_enabled` says: an entity that is **not** excepted and whose key
  the YAML omits is deleted, and an excepted entity whose key the YAML carries is refused. Premium's YAML has no
  `secrets:` key (`gitops/premium-fleetqa-min/default.yml:35`, enroll secrets are the UI's), declares `labels:` in
  `default.yml`, and `software:` in `qa.yml` and `vms.yml`. So a stuck `labels` or `software: true` turns the gitops
  chain red, and a stuck **`secrets: false` deletes every global and fleet enroll secret**, which the simulations
  re-enroll with. `02` and `03` already run with `secrets: false`; the teardown and `cleanup-setup` only turn the
  flag off, and `cleanup-setup` runs after the next nightly's gitops chain anyway. Decision 1 pins a baseline and
  restores it in the teardown and at the head of every premium gitops apply.

### Review decisions (2026-10-07, Andrey's answers in *Decisions*)

Every cited Fleet line re-read at 8d05209 (the build both instances run); the QA Wolf flow body
(`gitops-mode-gated-areas-of-the-ui-controls.spec.ts`) read; the surfaces probed live with the mode off. Live
exceptions on premium: `labels: false, software: false, secrets: true`.

| Gap | Decision | Where | Why |
|---|---|---|---|
| round 2 #57 | **build, trimmed** | `premium/gitops-mode/04-controls-and-reports.spec.ts` | Disk encryption's checkbox reads the flag directly and its Save goes through the wrapper, a pattern V1 doesn't cover. Configuration profiles: Add profile, and on one inert `pw-` profile seeded on Workstations, its Delete gated while View, Edit and Download stay open, and Edit's *Update profile* gated (the modal is the only place to read a profile's targets, so Fleet leaves Edit open). **BitLocker PIN cut** (§1). |
| software exception | **build, one surface** | `03-exceptions.spec.ts` | The Fleet-maintained app form's *Add software* on Workstations, for an app the fleet hasn't added: gated, then unlocked by the exception. The Library accordion's *Delete this version* is dropped: the same wrapper and `entityType`, and with the exception on, a stray click on the VMs fleet's durable FMA deletes a fixture. |
| Variables | **build** | `04-controls-and-reports.spec.ts` | *Add variable* gated, *Delete <name>* open, on a seeded `PW_VAR_*` variable: the over-gating detector round 2 parked. |
| Change management | **build, reshaped** | `05-change-management.spec.ts` (new) | Two UI saves. **The way out:** turning the mode off in the UI keeps the exceptions and the URL, logs `disabled_gitops_mode`, and the navbar marker goes without a reload. **One exception:** ticking *Labels* saves only that exception, logs `enabled_gitops_exception` with `exception: labels`, and the new-label form opens unlocked after client-side navigation (the save updates `AppContext`). Labels, because a stuck labels exception fails loudly; secrets is never written from the UI. **Cut:** "Git repository URL is required": copy only, the server refuses an empty URL anyway (`appconfig.go:1265-1266`), and validation is moving to submit-only. |
| breadth row | **cut, one pair kept** | `04-controls-and-reports.spec.ts` | A gitops report on Workstations ("Collect default browser on macOS", in the full and min configs): *Save* and *Save as new* gated, *Live report* open. No seed and no hosts, so it replaces the Run-script-on-a-selection idea. The rest repeats V1's patterns. |
| decision 3, and F's gated forms | **skip** | GITOPS-PLAN, as V3 candidates | None is a QA Wolf gap: script rows' Edit / Delete, a batch's Cancel, the Hosts-list label pill, F's setup-experience and MDM-settings forms. |

**Free coverage:** none new. Gitops mode is premium-only, and free's Change management paywall is already a
`PAYWALLED_PAGES` row (`free/paywalls.spec.ts:37`).

## 2. Facts for the build

### 2.1 Controls gated surfaces (round 2 #57)

- **Disk encryption:** "Enable disk encryption" (`DiskEncryption.tsx:302`) and "Require BitLocker PIN" (`:444`)
  read the gitops flag directly, so assert `toBeDisabled()`; only Save goes through the gitops wrapper (`:267`), so
  assert its tooltip with `expectGatedByGitOps`.
- **Configuration profiles:** "Add profile" (`ConfigurationProfiles.tsx:229-238,287,313`) and each `Delete <name>`
  (`ProfileListItem.tsx:239-255`) are wrapped; View, Edit and Download stay enabled.
- **Seed on Workstations** with `uploadProfile(request, workstationsFleetId, inertMobileconfig(...))` (the inert
  pattern in `helpers/profiles.ts`, whose names must match `/^pw-[a-z0-9-]+$/`; Workstations has no real host),
  delete it in `afterAll`. **Never upload on Unassigned**:
  MDM-enrolled simulations sit there. Never click Save.
- **The BitLocker PIN on a throwaway fleet** (decision 4). F's `premium/controls/os-settings/disk-encryption.spec.ts`
  (CTL-41) shows the PIN enabled once Windows enforcement is on, on a `pw-*` fleet. Seed one with enforcement on
  through the API (`POST /disk_encryption` with `fleet_id` and `windows_settings.enable_disk_encryption: true`; a
  `setFleetDiskEncryption` helper is needed, F added only `getFleetWindowsDiskEncryption`), open its Windows tab by
  URL (`diskEncryption.goto({ fleetId, platform: 'windows' })`), and assert both checkboxes `toBeDisabled()` with
  enforcement still checked. Gitops mode gates the UI only, so the API seed works with the flag on. Delete the fleet
  in an `afterEach`; the next run's `cleanup-setup` sweeps a leftover `pw-*` fleet (this project runs none).

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
  in `activity-copy.ts`. Identical activities from earlier flips are already in the feed, and every
  `withGitOpsMode` flip adds more (`appconfig.go:1281-1283,1387-1389`): assert through
  `assertActivityAfter(request, 'enabled_gitops_exception', before, (d) => d.exception === 'labels')` (the detail key
  is `exception`, `server/fleet/activities.go:899-901`), and read feed copy only right after the save, by its text,
  never by position.
- **A second Save in the same test**: call `changeManagement.toast.dismissAll()` before it, then confirm the save
  through `getGitOpsMode`.
- **State the teardown doesn't restore.** `disableGitOpsMode` flips only the flag
  (`helpers/api/gitops-mode.ts:95-108`); only `withGitOpsMode`'s snapshot restores the exceptions and the URL. A
  killed run leaves a ticked exception, and **exceptions change what `fleetctl gitops` does** (a `labels`
  exception keeps labels the YAML omits), so a stuck one alters the nightly's gitops chain. And
  `01-indicator-and-links`'s `afterAll` restorer would re-apply its pre-run snapshot. So: tick **one exception
  only**, restore it in an `afterEach`, never type or blank the URL (QA Wolf blanked it), and add a cleanup step
  that restores a **pinned baseline** if a run dies. Nothing declares the exceptions: gitops rejects
  `org_settings.gitops.exceptions` (`pkg/spec/gitops.go:922-936`, "not supported via GitOps; set exceptions in the
  Fleet UI"), `fleetctl` strips them (`server/service/client.go:751-757`), and no `gitops/*/default.yml` has a
  `gitops:` block. Read the live values once at review and pin them (decision 1).
- The disabled-Save check will go stale (form validation is moving to submit-only); assert the error copy.

### 2.5 Policies, Reports, Software-title, OS settings

**Scripts:** Add script and Upload (`ScriptLibrary.tsx:206,231`) and a row's Edit and Delete
(`ScriptListItem.tsx:104-134`, `EditScriptModal.tsx:197,213-219`) are gated; Download isn't. Running and cancelling
aren't: the Hosts list's Run script on a selection (`ManageHostsPage.tsx:1987-2015`), the Run script modal and a
batch's Cancel (`ScriptBatchDetailsPage.tsx:286-290`, hidden only once finished) have no gitops reference. They're
operations, like Add hosts. Today's specs assert only Add script (`01:76-78`, `zz`).

Policies: the list's checkboxes (`PoliciesTableConfig.tsx:469,497`) and the form's Save (`PolicyForm.tsx:826`) are
wrapped. Reports: Save and Save as new (`EditQueryForm.tsx:826,845`); Live report isn't. `createPolicy` is
global-only, so a seeded policy would run on the VMs. Use `createFleetPolicy` (PR #78) on Workstations, or
`SELECT 1;`.

## 3. The project's limits

`workers: 1`, `fullyParallel: false`, `retries: 0` (`playwright.config.ts:284-302`); CI's step runs with
`--global-timeout=900000` (`.github/workflows/playwright-premium.yml:150-154`). Today: 19 tests, about a minute
on one worker (0.9 min in run 37077445852, 1.0 in 37395809242; `01` 3 tests; `02` serial, ending with "Change management stays fully
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

## Decisions (answered by Andrey, 2026-10-07)

1. **The pinned exception baseline is `labels: false, software: false, secrets: true`** (the live values, read at
   review), restored in two places: the `gitops-mode-teardown` project (mode off and the baseline, after every run
   of the project), and a step at the head of every premium gitops apply (`gitops-premium.yml`,
   `gitops-premium-min.yml`) that puts the exceptions back before `fleetctl gitops` reads them (§1: the next
   nightly's chain runs before `cleanup-setup`). The workflow change means H's branch run is dispatched with
   `--ref <branch>`.
2. **Change management: the way out and one exception.** Turn the mode off through the UI, and tick *Labels*; never
   *Enroll secrets*. The URL-required copy is cut.
3. **The breadth row is cut**, except the report pair (*Save* / *Save as new* gated, *Live report* open) on a gitops
   Workstations report. No Run script check.
4. **The Controls row is trimmed, no BitLocker PIN** (§1): encryption checkbox and Save, Add profile, and one inert
   profile on Workstations for its row's Delete / Edit / *Update profile*.
5. **Decision 3's surfaces and F's gated forms are skipped**, and recorded in GITOPS-PLAN as V3 candidates.

## Traps this batch will hit

- **`02-gated-surfaces` is serial with no retries.** Put new tests in new files numbered before `zz-`.
- **`zz-everything-is-back` can't detect a leftover exception.** Your `afterEach` is the only guard.
- **A concurrent `PATCH /config`** (another run, another batch's session, a person) can flip the flag mid-run:
  `gh run list` first, and announce the run to any parallel session.
- **Fleet's default exception set has `secrets: true`** (`server/fleet/app.go:1587`), and so has premium (read at
  review): that value is load-bearing, because premium's YAML has no `secrets:` key (§1). Nothing in H writes it.

## Done when

- Every row has a written review decision; the questions above have Andrey's answer.
- The new gitops-mode specs built, each restoring every exception and seeded item it touched, and the cleanup
  step restoring the pinned exception baseline in place if Andrey agreed to it.
- `npm run check` clean; `npm run test:gitops-mode` green twice (login, the specs, teardown), and once headed.
- `playwright-test-reviewer` run on the branch's diff, findings fixed or answered.
- Docs in the same commits: this file's *What landed*, a [DELIVERY-LOG](../DELIVERY-LOG.md) line, a
  [test-audit](../../test-audit/README.md) entry per `test()`, round 2's [GITOPS-PLAN.md](../round-2/GITOPS-PLAN.md)
  (V2 done, the third state dropped), and this round's [README](README.md) batch table and [INDEX](INDEX.md).
- PR open, Andrey told it's ready for its branch run.

## What landed

Built 2026-10-07 on `playwright/qawolf-round3-batch-h` (from `main` 8b3a437), beside batch G; the two ship in
one PR. Seven tests in the `gitops-mode` project (the project goes from 19 to 26), one CI step, and the teardown.

| Gap | Test | Where |
|---|---|---|
| round 2 #57 | Disk encryption — enforcement is locked and Save is gated | `04-controls-and-reports.spec.ts` (GITOPS-23) |
| round 2 #57 | Configuration profiles — Add and Delete are gated, View, Edit and Download stay open (and Edit's *Update profile* gated; an inert `pw-gitops-*` profile on Workstations, deleted in an `afterEach`) | `04-controls-and-reports.spec.ts` (GITOPS-24) |
| Variables | Variables — Add variable is gated, Delete stays open (a `PW_VAR_GITOPS_*` variable, deleted in an `afterEach`) | `04-controls-and-reports.spec.ts` (GITOPS-25) |
| breadth row | Reports — Save and Save as new are gated, Live report stays open (on "Collect default browser on macOS") | `04-controls-and-reports.spec.ts` (GITOPS-26) |
| software exception | software — the exception unlocks the Fleet-maintained app form | `03-exceptions.spec.ts` (GITOPS-22) |
| Change management | turning gitops mode off keeps the exceptions and the repository URL | `05-change-management.spec.ts` (GITOPS-27) |
| Change management | ticking the labels exception saves only that exception and unlocks labels without a reload | `05-change-management.spec.ts` (GITOPS-28) |

**The pinned exception baseline** (decision 1): `GITOPS_EXCEPTIONS_BASELINE` and `resetGitOpsMode` in
`helpers/api/gitops-mode.ts`; the gitops-mode teardown restores and asserts it; and
`.github/scripts/restore-gitops-exceptions.sh` runs first in `gitops-premium.yml` and `gitops-premium-min.yml`
(writes only on drift, reads it back, warns when it restored anything). Run against premium at rest: it found the
baseline and wrote nothing. Documented in `CLAUDE.md`, `docs/ci-pipeline.md`, `gitops/premium-fleetqa/README.md`.

**Helpers and page objects:** `findAvailableFleetMaintainedApp`; `FleetMaintainedAppDetailPage.goto`,
`ConfigurationProfilesPage.rowButton`, `VariablesPage.deleteButton`; `withGitOpsMode` takes a partial exception set.

**Found on the way:** `02`'s enroll-secrets test failed once (run 1): its first hover can land on the empty state's
*Add secret*, which the list replaces with another button elsewhere. `02` and `03` now wait for the first secret's
row. Not a Fleet bug.
The branch run ([37667485374](https://github.com/AndreyKizimenko/qa-automation-poc/actions/runs/37667485374), PR #92)
failed GITOPS-24 once at *Add profile*'s tooltip: OS settings' status cards render a spinner and then the cards, so
the content can shift after the one hover the check made. `expectGitOpsTooltip` now steps away and re-hovers until the
tip opens (10 s), with a `reveal` hovered first for a row's actions. Not a Fleet bug.

**Verified:** `npm run check` clean (the 19 warnings are `main`'s). `test:gitops-mode` with dependencies (login, the
project, the teardown) three times on premium, each announced to batch G's session and run on its "go": run 1, every
new test green and `02`'s enroll-secrets test red as above; after the fix, green twice (27 passed, 1 skipped for
#48218), the second one headed. After the runs, the instance read back at rest (mode off, the baseline exceptions)
with no `pw-gitops-*` profile or `PW_VAR_GITOPS_*` variable left. `playwright-test-reviewer` on the branch: one
finding (a comment that misstated the enroll-secret race), fixed.

**Docs:** this file's review, a [DELIVERY-LOG](../DELIVERY-LOG.md) entry, test-audit area **20** (GITOPS-22…28, and
its teardown, safety-note and observations brought current), [GITOPS-PLAN §12](../round-2/GITOPS-PLAN.md) (V2, the
third state dropped, V3 candidates), this round's README and INDEX.
