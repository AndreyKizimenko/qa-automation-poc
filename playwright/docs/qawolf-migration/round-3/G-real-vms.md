# Batch G — Real VMs: live runs and execution side effects

**10 gaps → 1 new spec and about 5 augments, after folds.** `Live policies` · `Live reports and CSV` ·
`Install side effects` · `MDM command feed` · `Script-only packages` · `A host's Library`

**Status: ready for review** (planned 2026-10-01).

> ## ▶ Start here
>
> **Branch from `main` after [PR #78](https://github.com/AndreyKizimenko/qa-automation-poc/pull/78) has merged.**
> **Invoke the `playwright-test-author` skill first** (Skill tool) and follow it. Then read, in order:
> [README.md](README.md) §4–§5 (**a failed install script stalls the VM**, fleetdm/fleet#54607), round 2's
> [README §5](../round-2/README.md) and [§9](../round-2/README.md#9-working-a-batch-since-d), round 2's
> [D → What landed](../round-2/D-host-execution.md#what-landed-and-what-changed-from-the-plan) (the durable VM
> software), `playwright/CLAUDE.md` (**Test hosts**), then this file.
>
> **What this batch is.** What only a real VM can show, or what reads a real VM's data: a live policy that can
> fail, a live report's real rows exported to CSV, an install that makes Fleet refetch by itself, a script-only
> package that runs. **Most of it costs almost no VM time** (§3): live queries go through osquery's distributed
> path, not the orbit queue the install specs contend for. The script-only package run is the exception.
>
> Facts below were checked on 2026-10-01 against `main` (d55846a), PR #78's branch, and Fleet
> `rc-minor-fleet-v4.93.0`, the build both instances run.

## The gaps

| Gap | What's untested today | Proposed target | Kind | Source flow |
|---|---|---|---|---|
| round 1 C3 #28 | Run policy live: the Host column sorts case-insensitively (client-side, so simulations' mixed-case names are valid evidence) | `shared/policies/…` (new) | new | `flows-Premium/policies-run-policy-and-verify-sort-is-case-insensitive.flow.js` |
| round 1 C3 #37 | Run policy live: the Yes / No percentages and their host counts (simulations always pass, so only the VMs can fail) | `shared/policies/…` (new), with C3 #28 | new | `flows-Premium/policies-verify-pass-fail-percentage-on-live-policy.flow.js` |
| round 1 C4 #F2 | free: a live report against All hosts, and its results exported to CSV | `shared/hosts/host-live-query.spec.ts` or a reports spec | augment | `flows-Free/queries-global-users-global-admin-run-a-live-query-and-allow-exporting-results.flow.js` |
| round 1 C4 #P8 | as round 1 C4 #F2, premium | same | augment | `flows-Premium/queries-global-users-global-admin-run-a-live-query-and-allow-exporting-results.flow.js` |
| round 1 C4 #P14 | a live report targeting Unassigned (the Reports list no longer has an Unassigned scope; premium's Unassigned is simulations only) | review: fold into C4 #P8 as a scoping check, or cut | review | `flows-Premium/queries-global-users-run-live-query-by-no-team-premium.flow.js` |
| round 1 C5 #13 | a host's Library tab (premium only): the subheader and item count, the All available / Self service dropdown, search, Add software, the columns — read-only on a VMs-fleet VM (the row was first filed as a fleet's Library) | `premium/software/…` host Library read, or fold into an existing VM software spec | augment | `flows-Premium/general-library-verify-tab-availability-and-content.flow.js` |
| round 2 #15 | an install or uninstall makes Fleet request a vitals refetch by itself (`refetch_requested` set on the result; every wait today asks for one) | fold into `premium/software/software-lifecycle-on-host.spec.ts` | augment | `Fleet_20260828 (1)/Premium/src/tests/automatic-host-vitals-refetch/installs-and-uninstalls-automatically-triggers-host-vitals-refetch-fleet-maintained.spec.ts` |
| round 2 #69 | the global feed: filter by "Ran custom MDM command" and open its details (host half covered) | `shared/hosts/mdm-commands.spec.ts` | augment | `Fleet_20260828 (1)/Premium/src/tests/mdm/mdm-command-details-show-on-global-and-host-activity.spec.ts` |
| round 2 #72 | a script-only package run on a host: Upcoming / Past, details modal (handed to D in round 2, never built) | `premium/software/script-only-package.spec.ts` | augment | `Fleet_20260828 (1)/Premium/src/tests/packages/add-custom-package-that-only-contains-a-script.spec.ts` |
| round 2 #88 | the host's Library offers a script-only package's Run button (a server-side decision: a Linux simulation shows it, no VM needed) | `premium/software/script-only-package.spec.ts` | augment | `Fleet_20260828 (1)/Premium/src/tests/scripts/Add a .sh script as a software package.spec.ts` |

## 1. Review first

Read every flow body. Known so far:

- **C3 #28 and C3 #37 are tier-agnostic:** one new `shared/` spec for the live policy run.
- **C4 #P14 is half stale.** 4.93's Reports list has no Unassigned scope (`ManageQueriesPage.tsx:117-118`), and
  premium's Unassigned is simulations only, so all it can truthfully assert is scoping (every exported host is an
  Unassigned host, no VM appears). Fold into C4 #P8, or cut.
- **R2 #15: fold, don't build.** Assert it inside `software-lifecycle-on-host.spec.ts` (§2.3); other specs'
  refetch requests on the same VM could make a standalone test pass for the wrong reason.
- **R2 #88 needs no VM.** Whether *Run* is offered is a server-side decision, so a Linux simulation in the
  existing Unassigned spec shows it. Don't click it there.
- **C5 #13** (from batch B) is a host's Library tab, read-only on a VM.
- **The CLAUDE.md simulation facts are stale** (§2.1): fix them in the same PR as this batch, or tell Andrey.

## 2. Facts for the build

### 2.1 What simulations answer

- **Every live query to a simulation returns the same row, whatever the SQL** (`cmd/osquery-perf/agent.go:3644-3660,
  3730-3745`), and our daemons run with `--live_query_no_results_prob 0`
  (`tools/perf-hosts/com.fleetqa.perf.premium.plist:37-38`). So **every simulation shows Pass** in a live policy
  run, and only a VM can show Fail. `playwright/CLAUDE.md`'s "return no rows ~20% of runs" is osquery-perf's
  default, not ours. Whether the running daemons match the plist is unverified.
- **Simulations with orbit** (`-orbit_prob` 0.5) fake script runs, with random output and an exit code of 0 or 1
  at random (`agent.go:2167-2173`), and record installs. CLAUDE.md's "never install anything" is true of the disk,
  not of what Fleet records.
- **A live run never finishes while an online targeted host hasn't answered**: it ends at `ActualResults >=
  Online` (`server/service/service_campaigns.go:195-197`), with no timeout. Bound every wait, or press Stop.

### 2.2 Live policies and reports (C3 #28, #37, C4 #F2, #P8, #P14)

- **Run policy** (`PolicyDetailsPage.tsx:438`) → target selection ("N hosts targeted (P% online)") → `POST
  /reports/run` with `report_id: null` → "Running policy" / "Policy finished" (`LiveResultsHeading.tsx:84-87`).
  Today only the button's visibility is checked (`premium/policies/policies.spec.ts:57`).
- **C3 #28:** the Host column sorts with `sortType: "caseInsensitive"` (`PolicyResultsTableConfig.tsx:42-56`),
  client-side, 20 a page; the default sort is Status. Simulations' random mixed-case hostnames
  (`agent.go:2636-2645`) are valid evidence here.
- **C3 #37:** "(Yes: X%, No: Y%)" with "N host(s)" tooltips; the denominator is the hosts that answered
  (`PolicyResults.tsx:135-151`). Since simulations always pass, target a `pw-*` **manual label holding the three
  VMs** (premium VMs fleet; free Unassigned) with platform-dependent SQL, so one passes and two fail: Yes 33%, No 67%.
  **Don't target the VMs fleet chip**: label specs borrow simulations onto it (`helpers/api/hosts.ts:331-336`). A
  missing table lands in Errors, not Fail.
- **C4 #F2 / #P8, All hosts and CSV.** `shared/hosts/host-live-query.spec.ts` runs a saved report against one
  Mac; the reports specs stop at the ready state. "Export results" (`QueryResults.tsx:184-213`) downloads
  `"<report name> - Results (MM-dd-yy hh-mm-ss).csv"` (local 12-hour time, `utilities/generate_csv/index.ts:14-16`),
  first column `host_display_name`, every filtered row. Truthful assertions: the VM's row carries the real value,
  and the CSV's row count equals the page's "N results". **Not** "responded % equals online %": simulations flap.
  Use `download.suggestedFilename()` with a regex. On free, "All hosts" includes the free VMs.
- Missing pieces: `ReportLivePage.finishedHeading` is hard-coded to "Report finished" (policies say "Policy
  finished"), and it has no Export, percentages or sort accessors.

### 2.3 An install triggers a refetch by itself (R2 #15)

- `SaveHostSoftwareInstallResult` sets `refetch_requested` when an install's status is *installed*
  (`server/service/orbit.go:2425-2430`); an uninstall, when the activity status is *uninstalled* (`:1525-1530`).
- Today every wait asks for a refetch itself: `waitForSoftwareSettled` (`helpers/api/software.ts:671`) →
  `waitForHostRefetch({ refetch: true })` → `POST hosts/:id/refetch`. So nothing proves Fleet asked.
- **Fold into `software-lifecycle-on-host.spec.ts:80`** on the Mac's durable FMA (Itsycal, `helpers/vm-fixtures.ts:50`),
  left uninstalled: after the install result, assert `refetch_requested` is true, then that `detail_updated_at`
  advances **with no refetch request** (add a no-refetch option to `waitForSoftwareSettled`). Don't assert the UI
  spinner clearing: it gives up after 60 s, and the VMs take 70–120 s.

### 2.4 The global feed's MDM command filter (R2 #69)

`shared/hosts/mdm-commands.spec.ts:48` sends `UserList` to the real Mac through `fleetctl` and covers both host
views and the modal, and the dashboard row **unfiltered** (`:133-136`). Add, in the same run: the type filter
"Ran custom MDM command" (`ran_custom_mdm_command`, `server/fleet/activities.go:1041-1042`; label in
`frontend/interfaces/activity.ts:584`), the row "ran UserList as a custom MDM command on HOST.", and the same
`.command-details-modal`. Not tier-gated. `DashboardPage` has no type-filter method yet (batch A's activity-feed
work adds one, so coordinate). No extra VM time.

### 2.5 A script-only package run (R2 #72, #88)

- `premium/software/script-only-package.spec.ts:45` adds a `.sh` as a script-only package on Unassigned and
  removes it; running on a host is out of scope (`:17-18`).
- A host's Library shows Run / Rerun / Retry (`frontend/pages/hosts/details/cards/Software/helpers.tsx:409-417`);
  Run is the same `POST hosts/:id/software/:title_id/install`. Toast "Script is running. To see details, go to
  Details > Activity." Activities "<actor> told Fleet to run <title> on this host." / "<actor> ran <title> on this
  host." Modal "Script details": "Fleet ran <title> (<file>) on <host> (<ago>)."; **its Details reveal appears only
  if the script printed output.**
- The current fixture (`test-data/shared/software/fleet-playwright-script-package.sh`) prints nothing. Upload a
  per-run `fleet-pw-script-<nonce>.sh` to the VMs fleet that **echoes and exits 0** (a failure would trip
  fleetdm/fleet#54607), run it on the Linux VM, delete it in the `finally`; the VMs sweep covers `^fleet-pw-`
  (`setup/cleanup.steps.ts:165`). Assert Upcoming through `listUpcomingActivities`: the item can be picked up
  before the page loads.
- `HostSoftwareLibrary` has no Run / Rerun action, and its `install()` expects the install toast;
  `activity-copy.ts` has no "ran" / "told Fleet to run" entries. Add them.

### 2.6 A host's Library tab (C5 #13)

`frontend/pages/hosts/details/cards/HostSoftwareLibrary/HostSoftwareLibrary.tsx:636`, premium only
(`HostDetailsPage.tsx:1548`): subheader "Software available to be installed on this host", "N items"
(`TableCount`), a dropdown "All available" / "Self service", "Search by name", "Add software" (admins and
maintainers, non-Android hosts, non-empty library). The flow's "Actions" column header is now empty
(`HostSoftwareLibraryTableConfig.tsx:223`). The per-row actions are already covered by the update, uninstall and
inventory specs. Read a VMs-fleet VM (`requireRealHost`), read-only: no VM time.

## 3. Cost

| rows | VM time added | why |
|---|---|---|
| C3 #28, C4 #F2 / #P8 / #P14 | ~0 | osquery's distributed path, not the orbit queue |
| C3 #37 | ~0.5 min | three VMs answer one query |
| R2 #69, C5 #13 | 0 | piggybacks on an existing run; a read |
| R2 #15, folded | ~0 | the install is already happening |
| R2 #88, on a simulation | 0 | |
| **R2 #72** | **1–3 min on the Linux VM, plus contention** | the Linux queue is the suite's bottleneck (~13 min of contention at 3 workers); give it `HOST_RETRIES` and a 300–600 s timeout |

## Reusable pieces

`ReportLivePage` (`targetChip`, `run`, `stopButton`, `resultsRows`, `runSummary`), `PolicyDetailsPage.runButton`,
`ReportEditPage.clickLiveReport`, `HostDetailsPage` (`openLibrary`, `showPastActivities` /
`showUpcomingActivities`, `activityItem`, `mdmCommandDetailsModal`); the download pattern in `HostsListPage.exportHosts`
and `export-csv.spec.ts:21`; API: `createManualLabel`, `createPolicy`, `requireRealHost`, `listFleetHosts`,
`uploadSoftwarePackageBuffer`, `waitForHostSoftwareStatus`, `listUpcomingActivities`.

## Decisions to put to Andrey

1. **C4 #P14:** fold into C4 #P8 as a scoping check, or cut.
2. **R2 #72's Linux VM minutes** (§3): worth it, given the Linux queue is the floor?
3. **The CLAUDE.md simulation facts** (§2.1): correct them in this batch's PR?

## Free coverage

C3 #28 / #37, the live report and CSV, and the MDM command feed exist on free: `shared/`. On free the three VMs
sit in Unassigned, so "All hosts" and a manual label of the VMs both work there. The script-only package, the
Library tab and the refetch row are premium specs today.

## Traps this batch will hit

- **One queue per VM.** Anything that installs or runs on a VM waits behind every other spec doing the same:
  `--workers=2` locally, `HOST_RETRIES` on the describe, a timeout that holds every wait.
- **A failed install script stalls orbit for up to 5 minutes** (#54607). Every script here must succeed; fail an
  install, if you must, with a pre-install query that returns no rows.
- **Durable VM software is never deleted**, only uninstalled; per-run packages are `fleet-pw-*` and deleted in the
  same test.
- **A live run has no timeout of its own** (§2.1).
- **Labels you put the VMs in** are `pw-*`, removed in the `finally`; the VMs sweep catches leftovers.

## Done when

- Every row has a written review decision; the questions above have Andrey's answer.
- The live-policy spec and the augments built on every tier each targets; nothing left installed on a VM;
  every per-run package and label deleted.
- `npm run check` clean; each changed spec run with dependencies on its tiers, once headed, and `--repeat-each=5
  --workers=2` for anything on a VM.
- `playwright-test-reviewer` run on the branch's diff, findings fixed or answered.
- Docs in the same commits: this file's *What landed*, a [DELIVERY-LOG](../DELIVERY-LOG.md) line, a
  [test-audit](../../test-audit/README.md) entry per `test()`, `helpers/README.md` / `pages/README.md`, any
  `test-data/` README, and this round's [README](README.md) batch table and [INDEX](INDEX.md).
- PR open, Andrey told it's ready for its branch run; mention the VM minutes added.

## What landed

*Nothing yet.*
