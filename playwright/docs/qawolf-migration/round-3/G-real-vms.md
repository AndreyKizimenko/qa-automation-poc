# Batch G — Real VMs: live runs and execution side effects

**10 gaps → 1 new spec and about 5 augments, after folds.** `Live policies` · `Live reports and CSV` ·
`Install side effects` · `MDM command feed` · `Script-only packages` · `A host's Library`

**Status: reviewed and being built** (planned 2026-10-01; re-checked 2026-10-05 against batches C and D's learnings,
and 2026-10-07 against E and F's; reviewed 2026-10-07, Andrey's answers in *Decisions*). Built on
`playwright/qawolf-round3-batch-g` beside batch H.

> ## ▶ Start here
>
> **Branch from `main` at or after 68c8846** ([PR #89](https://github.com/AndreyKizimenko/qa-automation-poc/pull/89),
> batches E and F; [PR #90](https://github.com/AndreyKizimenko/qa-automation-poc/pull/90)). **Invoke the `playwright-test-author` skill first** (Skill tool) and follow it. Then read, in order:
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
> **Since batches A and B (2026-10-03).** The full list is in
> [README §5](README.md#since-batches-a-and-b-2026-10-03). These apply here:
>
> - **Remove what a test leaves behind in an `afterEach`, not only a `finally`** (a timed-out test skips its
>   `finally`): the script-only package (§2.5), whose queued run would hold the Linux VM's queue for the retry;
>   the policy run live (§2.2), which every host in its scope also runs on schedule; and the label holding the
>   VMs, which nothing sweeps on free.
> - **The VMs sweep only catches names it knows** (`setup/cleanup.steps.ts`, "sweep host-execution leftovers"):
>   `fleet-pw-*` titles; `pw-*` policies, scripts, profiles and labels; reports by exact prefix only
>   (`pw-run-script-`, `pw-rl-`, `pw-stored-results-`), because gitops' `pw-host-report-results` lives on the same
>   fleet and is never swept. A per-run report on the VMs fleet needs its prefix added there. **`pw-*` labels are
>   swept on premium only**: on free a spec deletes its own (`deleteLabelsMatching`, as
>   `shared/labels/labels.spec.ts` does).
> - **Reuse what A and B built:** `DashboardPage.selectActivityType` (§2.4); `ReportDetailsPage` (`clickLiveReport`,
>   `resultRows`, the empty state); and B's `premium/reports/stored-results.spec.ts`, which reads the macOS VM's
>   row by `requireRealHost('darwin')` and its display name.
> - **Nothing here writes global config**: no Org settings › Advanced key (`advanced-options.spec.ts` asserts
>   they stay unchanged) and nothing on the global enroll list.
> - **Run cost:** the premium branch run takes ~63.5 min (run 37395809242, after E and F): the main project ~47 (3
>   workers, worker-bound, against a 100-min `globalTimeout`), the exclusive step ~14, gitops-mode ~1. R2 #72's
>   Linux minutes land in the main project.
> - **If another batch is built at the same time**, announce every VM run to its session and wait for its "go"
>   before a run with dependencies: each VM has one queue.
>
> **Since batches C and D (2026-10-05).** The full list is in
> [README §5](README.md#since-batches-c-and-d-2026-10-05). These apply here:
>
> - **A dashboard check at the end of a long test gets buried** under the other workers' activity (D's VM test
>   flaked on it). Check through the API first (`assertActivity`), and read the feed right after the action
>   (§2.4). `expectActivities` reloads the page, which clears the feed's type filter (React state).
> - **The VMs can be offline, and the pickers now say so** (PR #87): resolve every VM a test needs with
>   `requireRealHost` before building on it; the Macs dropped out of the 2026-10-05 nightly (~11:00–11:19 UTC,
>   infra). A live run on a label of the three VMs finishes with two if one is offline, and reads the wrong
>   percentage (§2.2).
> - **Built-in platform labels hold the wrong hosts** (the macOS label holds the Ubuntu simulations): never target
>   a Platforms chip (`ReportLivePage.targetChip` reaches them too; §2.2).
> - **Two script-queue bugs, both reachable on the VMs**: [#54732](https://github.com/fleetdm/fleet/issues/54732)
>   (an edit while a run is queued leaves it Pending forever) and [#54734](https://github.com/fleetdm/fleet/issues/54734)
>   (a run cancelled while running still records its result). G edits no script, but its `afterEach` title delete
>   is a cancel (§2.5).
> - **Slices:** G claims none yet. Free today: `findSimulations` linux 8–9 and 20+, darwin 7–9, windows 3+
>   (C holds linux 2–7, darwin 6, windows 2; D linux 10–19, darwin 10–39; E and F claimed none: E's live runs take
>   `findOnlineHost(…, 'linux', { kind: 'simulated' })` and move nothing). C3 #28 and R2 #88 need theirs (§2.2,
>   §2.5).
> - **The Hosts page rewrites its URL**: only if a step reaches a host through the Hosts list, use
>   `HostsListPage.searchFor`.
> - **Reuse what C and D built:** `createPolicy({ platform })`, `hostsOfferedTitle`, `findScriptableSimulations`,
>   `Toast.dismissAll`, and C6 #27's Unassigned Library read in `no-teams-views.spec.ts` (R2 #88).
>
> **Since batches E and F (2026-10-07).** The full lists are in [README §5](README.md#since-batch-e-2026-10-05)
> and [§5 › Since batch F](README.md#since-batch-f-2026-10-07). These apply here:
>
> - **The instances run 8d05209** (built 2026-10-06). No Fleet file this plan cites changed. Two things that did:
>   an unchanged stored report result's `last_fetched` now moves only once it's 50 minutes old (fleetdm/fleet#54897;
>   G's live runs read no stored results, but a step that reuses `stored-results.spec.ts`' row read takes its
>   bound), and `fleetctl gitops` no longer blocks queued script runs and installs.
> - **Reuse what E built for live runs:** `ReportLivePage.hostSearch` and `targetHost(displayName)` target one host
>   by search (E's one-host runs by an observer and an observer+, `premium/reports/role-access.spec.ts`);
>   `ReportsListPage.liveReportButton` / `narrowTo(name)`; `createReport({ observerCanRun })`.
>   `ReportLivePage.finishedHeading` still reads only "Report finished" (§2.2).
> - **Key R2 #72's activity checks to this attempt** (§2.5): `latestActivityId` before the Run, then
>   `assertActivityAfter` matching the nonce title and the host id. Fleet records JSON details with its own key
>   order, so compare fields.
> - **If another batch is built at the same time**, the two ship in one PR with one branch run (README › Since
>   batch F). A gitops-mode run (H) makes every control G clicks read-only, so neither starts a run while the other
>   is mid-run.
> - **Triaging G's branch run:** if `gh run download` stalls, fetch the report zip with `curl` (README › Since
>   batch F). Expect the premium job to grow by R2 #72's Linux minutes; E and F's run took 63.5 min.
>
> Facts below were checked on 2026-10-01 against `main` (d55846a), PR #78's branch, and Fleet
> `rc-minor-fleet-v4.93.0`, the build both instances run, again on 2026-10-03 against `main` (da2aceb) and the
> RC branch's head (ac3c0d6), on 2026-10-05 against `main` (61db6b0) and the RC head both instances ran then
> (c87f85c; `service_campaigns.go:196` and the other cited lines unchanged), and on 2026-10-07 against `main`
> (68c8846) and the build both instances run now (8d05209: no cited Fleet file changed; the suite lines in
> `helpers/api/software.ts`, `setup/cleanup.steps.ts` and `DashboardPage.ts` moved and are updated below).

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
- **C4 #P14 is mostly current.** 4.93's Reports list has no Unassigned scope (`ManageQueriesPage.tsx:117-118`),
  but the live target picker gives global users an **Unassigned** chip (`SelectTargets.tsx:600-605`), which is what
  the flow clicks. Premium's Unassigned is simulations only, so what it can truthfully assert is scoping: every
  result host is in `listFleetHosts(request, 0)` and no VM appears. Fold into C4 #P8 as a premium run on that chip,
  stopped once rows land (decision 1).
- **R2 #15: fold, don't build.** Assert it inside `software-lifecycle-on-host.spec.ts` (§2.3); other specs'
  refetch requests on the same VM could make a standalone test pass for the wrong reason.
- **R2 #88 needs no VM, and C half-built it.** Whether *Run* is offered is a server-side decision. C6 #27
  (`premium/software/no-teams-views.spec.ts:56-73`) shows a package on Unassigned offered in a Linux simulation's
  Library; what's missing is the *Run* label for a script-only package. Cheapest: in `script-only-package.spec.ts`,
  between its add and delete, read a claimed Linux simulation's Library row (linux 8), and add `'Run' | 'Rerun'`
  to `LibraryInstallAction`. Whether a simulation without orbit is offered it is unverified; if not, take one from
  `findScriptableSimulations`. Don't click it there (decision 5).
- **C5 #13** (from batch B) is a host's Library tab, read-only on a VM.

### Review decisions (2026-10-07, Andrey's answers in *Decisions*)

Every flow body read, against `main` 8b3a437 and Fleet 8d05209 (the build both instances run).

| Gap | Decision | Where | Why |
|---|---|---|---|
| C3 #37 | **build** | new `shared/policies/live-policy-run.spec.ts` | Nothing in the suite runs a policy live. The three VMs, picked by host search (E's `targetHost`), with SQL only the Mac passes: Yes 33%, No 67%, tooltips "1 host" / "2 hosts", each row's Pass / Fail. No `pw-*` label: nothing to delete, nothing left on free. |
| C3 #28 | **fold** into C3 #37 | same test | The VM names mix case on both tiers (`WIN-…`, `macos-…`, `ubuntu-…`), so the same run proves the case-insensitive Host sort. No simulations, no slice. |
| C4 #F2, #P8 | **build, reshaped** | new `shared/reports/live-report-export.spec.ts` | A live report's export is untested anywhere. On the three VMs, not All hosts: All hosts is ~300 simulations whose canned rows ignore the SQL, and one that drops offline keeps the run from finishing; the flow's only check there ("responded % = online %") is the flaky part. The CSV is parsed: one row per VM with its own platform. |
| C4 #P14 | **cut** | — | E's `premium/reports/role-access.spec.ts` already proves the Unassigned chip, offered or withheld by role and scope (RPT-29/30). What's left is a scope check over premium's Unassigned, which is simulations only and races the specs that move simulations on and off it. |
| C5 #13 | **build, reshaped** | premium host-Library spec + a free twin | The header's static copy is low value. What the tab decides: "N items" matches the API, and **Add software** routes by the host's platform (macOS and Windows → Fleet-maintained, Linux → Custom package) with the host's fleet. Free has no Library tab, and nothing checks that. The Self-service filter is skipped: no VMs-fleet title is self-service. |
| R2 #15 | **fold** | `premium/software/software-lifecycle-on-host.spec.ts` | `refetch_requested` read the moment each install or uninstall settles. Its limit: the flag has no author, and other specs ask for refetches on the same VMs, so a `true` can't be attributed; a Fleet that stopped asking would still fail most runs. The plan's no-refetch helper option has the same blind spot and is dropped. |
| R2 #69 | **build** as planned | `shared/hosts/mdm-commands.spec.ts` | The activity through the API first, then the dashboard filtered to "Ran custom MDM command", the row, and its details modal by command UUID. It replaces the unfiltered end check, the buried-feed pattern that flaked in D. |
| R2 #72 | **build, on the Mac** | `premium/software/script-only-package.spec.ts`, its own describe | A real host running a script-only package, which a simulation only fakes. On the Mac, not Linux: the Linux VM's orbit queue carries ~8 specs and sets the suite's floor, the Mac's ~4. |
| R2 #88 | **fold** into R2 #72 | same test | R2 #72 clicks **Run** in the VM's Library, which is R2 #88's check. No simulation, no slice. |

Two facts the review corrected: a live run started in the UI has no timeout at all (`FLEET_LIVE_QUERY_REST_PERIOD`
bounds only the synchronous REST endpoint, so `host-live-query.spec.ts`' comment saying otherwise is wrong), and C's
"never failing SQL on the VMs fleet" protects that fleet's two install policies, so a global policy with no automation
failing on the VMs triggers nothing.

## 2. Facts for the build

### 2.1 What simulations answer

- **Every live query to a simulation returns the same row, whatever the SQL** (`cmd/osquery-perf/agent.go:3644-3660,
  3730-3745`), and our daemons run with `--live_query_no_results_prob 0`
  (`tools/perf-hosts/com.fleetqa.perf.premium.plist:37-38`). So **every simulation shows Pass** in a live policy
  run, and only a VM can show Fail. Checked live on 2026-10-02: 12 of 12 premium simulations answered `SELECT
  'probe' … WHERE 1 = 0;` with the canned `netconf` row.
- **Simulations with orbit** (`-orbit_prob` 0.5) fake script runs, with random output and an exit code of 0 or 1
  at random (`agent.go:2167-2173`), and record installs (failing ~5% of the time). Nothing lands on a disk, but Fleet
  records the result.
- **A live run never finishes while an online targeted host hasn't answered**: it ends at `ActualResults >=
  Online` (`server/service/service_campaigns.go:195-197`), with no timeout. Bound every wait, or press Stop.

### 2.2 Live policies and reports (C3 #28, #37, C4 #F2, #P8, #P14)

- **Run policy** (`PolicyDetailsPage.tsx:438`) → target selection ("N hosts targeted (P% online)") → `POST
  /reports/run` with `report_id: null` → "Running policy" / "Policy finished" (`LiveResultsHeading.tsx:84-87`).
  Today only the button's visibility is checked (`premium/policies/policies.spec.ts:63`).
- **C3 #28:** the Host column sorts with `sortType: "caseInsensitive"` (`PolicyResultsTableConfig.tsx:42-56`),
  client-side, 20 a page; the default sort is Status. Simulations' random mixed-case hostnames
  (`agent.go:2636-2645`) are valid evidence here. Target a `pw-*` manual label of a claimed simulation slice
  (`findSimulations('linux', 10, 20)`, linux 20–29, members never moved), **never a Platforms chip**: the built-in
  labels hold simulations of every platform, and the macOS one the Ubuntu ones.
- **C3 #37:** "(Yes: X%, No: Y%)" with "N host(s)" tooltips; the denominator is the hosts that answered
  (`PolicyResults.tsx:135-151`). Since simulations always pass, target a `pw-*` **manual label holding the three
  VMs** (premium VMs fleet; free Unassigned) with platform-dependent SQL, so one passes and two fail: Yes 33%, No 67%.
  Resolve all three with `requireRealHost` before creating the label, and assert "3 hosts targeted (100% online)"
  before Run: with one VM offline the run finishes on two and reads "Yes 50%", failing for the wrong reason.
  **Don't target the VMs fleet chip**: label specs borrow simulations onto it (the slice registries above
  `findMdmSimulations` and `findSimulations` in `helpers/api/hosts.ts`). A missing table lands in Errors, not Fail.
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
- Today every wait asks for a refetch itself: `waitForSoftwareSettled` (`helpers/api/software.ts:763`) first waits
  out a refetch Fleet already queued (`waitForNoPendingRefetch`, `:787`), then posts its own
  (`waitForHostRefetch({ refetch: true })`, `:790`). So nothing proves Fleet asked. A no-refetch option may not be
  needed: read `refetch_requested` right after `waitForHostSoftwareStatus`, then check that `detail_updated_at`
  moves before the helper's own post.
- **Fold into `software-lifecycle-on-host.spec.ts:80`** on the Mac's durable FMA (Itsycal, `helpers/vm-fixtures.ts:50`),
  left uninstalled: after the install result, assert `refetch_requested` is true, then that `detail_updated_at`
  advances **with no refetch request** (add a no-refetch option to `waitForSoftwareSettled`). Don't assert the UI
  spinner clearing: it gives up after 60 s, and the VMs take 70–120 s.

### 2.4 The global feed's MDM command filter (R2 #69)

`shared/hosts/mdm-commands.spec.ts:48` sends `UserList` to the real Mac through `fleetctl` and covers both host
views and the modal, and the dashboard row **unfiltered** (`:133-136`). Add, in the same run: the type filter
"Ran custom MDM command" (`ran_custom_mdm_command`, `server/fleet/activities.go:1041-1042`; label in
`frontend/interfaces/activity.ts:584`), the row "ran UserList as a custom MDM command on HOST.", and the same
`.command-details-modal`. Not tier-gated. `DashboardPage.selectActivityType('Ran custom MDM command')` sets the
filter (batch A's `shared/dashboard/activity-feed.spec.ts` uses it); the feed shows only with no fleet selected.
No extra VM time.

**The existing unfiltered check is the pattern that flaked in D**: it reads the dashboard after an acknowledgement
poll of up to 180 s (`mdm-commands.spec.ts:70-78`), by which time the other workers' activity can bury the row past
the feed walk. And the type filter is React state (`ActivityFeed.tsx:179`), which `expectActivities`' reloads
(`DashboardPage.ts:443-448`) clear. So: check the activity through the API first,
`assertActivity(request, 'ran_custom_mdm_command', (d) => d.command_uuid === commandUuid)` (the details carry
`command_uuid`, `server/fleet/activities.go:1032-1039`); then load the dashboard on All fleets, `selectActivityType`,
and read `activityRows(...)` directly, never `expectActivity` after the filter. Replace the unfiltered end check with
this (decision 3).

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
  fleetdm/fleet#54607), run it on the Linux VM, delete it in an `afterEach` (deleting the title cancels a run
  still queued, which would otherwise hold the Linux queue for the retry); the VMs sweep covers `^fleet-pw-`
  (`OWN_PACKAGE`, `setup/cleanup.steps.ts:202`). Assert Upcoming through `listUpcomingActivities`: the item can
  be picked up before the page loads.
- **Never edit the package while its run is queued or running** (#54732, #54734), and key every activity and modal
  assertion to the run's nonce title, so a dead attempt's late result can't decide the retry (#54734's shape;
  unverified for installs).
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

`ReportLivePage` (`targetChip`, `hostSearch`, `targetHost`, `run`, `stopButton`, `resultsRows`, `runSummary`), `PolicyDetailsPage.runButton`,
`ReportEditPage.clickLiveReport` / `ReportDetailsPage.clickLiveReport`, `HostDetailsPage` (`openLibrary(title)`,
which filters to one title; `showPastActivities` / `showUpcomingActivities`, `activityItem`, `mdmCommandDetailsModal`),
`DashboardPage.selectActivityType`; the download pattern in `HostsListPage.exportHosts` and `export-csv.spec.ts:20`;
API: `createManualLabel`, `deleteLabelsMatching`, `createPolicy` (takes `platform`), `createReport`, `getReport`,
`requireRealHost`, `listFleetHosts`, `uploadSoftwarePackageBuffer`, `waitForHostSoftwareStatus`,
`waitForNoPendingRefetch` (reads `refetch_requested`), `listUpcomingActivities`, `assertActivity`,
`hostsOfferedTitle`, `findScriptableSimulations`, `latestActivityId` / `assertActivityAfter`; `Toast.dismissAll`;
`ReportsListPage.liveReportButton` / `narrowTo`, `createReport({ observerCanRun })`.

## Decisions (answered by Andrey, 2026-10-07)

All four review recommendations accepted:

1. **C4 #P14: cut.**
2. **C4 #F2 / #P8 on the three VMs**, not All hosts.
3. **C5 #13 reshaped:** the item count and Add software's routing per VM, and a free twin.
4. **R2 #72 on the Mac**, with R2 #88 folded in.

The plan's own recommendations below stand for R2 #69 (decision 3) and the global policy (decision 4).

### The plan's questions, as written before the review

1. **C4 #P14:** fold into C4 #P8 as a scoping check, or cut. *(Updated from the C/D re-check:)* the Unassigned chip
   still exists in the target picker, so the flow's step is current. Recommended: fold, as a premium run on that
   chip, every result host in `listFleetHosts(0)`, no VM, Stop once rows land.
2. **R2 #72's Linux VM minutes** (§3): worth it, given the Linux queue is the floor? *(C/D re-check:)* the main
   project is ~46 min against a 100-min `globalTimeout` (~47 after E and F). Recommended: build, with `HOST_RETRIES`.
3. *(new, from A/B learnings)* **R2 #69's type filter:** batch A's `shared/dashboard/activity-feed.spec.ts`
   proves the feed's type filter (on "Added report", both tiers). Filter by "Ran custom MDM command" as planned,
   or narrow R2 #69 to the global row's command details modal? *(C/D re-check:)* recommended: the API check, the
   filtered row and the modal's command UUID, replacing the unfiltered end check (§2.4), which also removes the
   buried-feed flake D hit.
4. *(new, from C)* **C3 #37's policy is global**: `createPolicy` also runs it on schedule, so it fails on the
   Windows and Linux VMs until the `afterEach` deletes it. It has no automation, so it's harmless, but it breaks
   the letter of C's "never failing SQL on the VMs fleet". Recommended: global, with this written down.
5. *(new, from C)* **R2 #88's home:** `script-only-package.spec.ts`, which needs no extra upload (§1).
   Recommended.

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
- **Labels you put the VMs in** are `pw-*`, removed in an `afterEach`. On premium the VMs sweep catches
  leftovers; on free nothing sweeps labels, so the spec purges its own.

## Done when

- Every row has a written review decision; the questions above have Andrey's answer.
- The live-policy spec and the augments built on every tier each targets; nothing left installed on a VM;
  every per-run package and label deleted.
- `npm run check` clean; each changed spec run with dependencies on its tiers, once headed, and `--repeat-each=5
  --workers=2` for anything on a VM. Before any VM run, confirm the VMs are online: a failure now says why
  (`helpers/api/hosts.ts`, PR #87), and an offline Mac is infra, not the test.
- `playwright-test-reviewer` run on the branch's diff, findings fixed or answered.
- Docs in the same commits: this file's *What landed*, a [DELIVERY-LOG](../DELIVERY-LOG.md) line, a
  [test-audit](../../test-audit/README.md) entry per `test()`, `helpers/README.md` / `pages/README.md`, any
  `test-data/` README, and this round's [README](README.md) batch table and [INDEX](INDEX.md).
- PR open, Andrey told it's ready for its branch run; mention the VM minutes added.

## What landed

Built on `playwright/qawolf-round3-batch-g` from 2026-10-07.

| Gap | Landed in | What it asserts |
|---|---|---|
| C3 #37 + C3 #28 | new `shared/policies/live-policy-run.spec.ts` (both tiers) | Policies → the policy → Run policy → the three VMs by host search, "3 hosts targeted (100% online)" → "Policy finished", 100% responded, 3 results. The Mac Pass, Windows and Linux Fail; "(Yes: 33%, No: 67%)" with tooltips "1 host" / "2 hosts"; the Host column ascending `macos-…`, `ubuntu-…`, `WIN-…` and the reverse (the names are checked to sort differently with case first); Export results is `<name> - Results (…).csv` with `host,status` and `yes` / `no` per VM. `PolicyLivePage`, a `ReportLivePage` of the policy kind. |
| C4 #F2 + #P8 | new `shared/reports/live-report-export.spec.ts` (both tiers) | Reports → the report → Live report → the three VMs → "Report finished", 3 results; each VM's `platform` cell equals the platform Fleet recorded for it; Export results is `<name> - Results (…).csv` with `host_display_name,platform` and exactly those rows. `ReportLivePage.exportResults` / `resultsCount` / `resultsColumnValues` / `resultsSortControl`; `helpers/csv.ts`; `getHostPlatform`. |
| R2 #69 | `shared/hosts/mdm-commands.spec.ts` (both tiers) | After the Mac acknowledges `UserList`: the activity log holds a `ran_custom_mdm_command` with this command's UUID (its actor is the API user `fleetctl` signs in as); the dashboard filtered to "Ran custom MDM command" shows "ran UserList as a custom MDM command on HOST.", and its row opens the details modal ("ran UserList as a custom MDM command on <hostname>.") carrying this command's request and acknowledged response. Replaces the unfiltered end check. `DashboardPage.mdmCommandDetailsModal`. |
| C5 #13 | new `premium/software/host-library-tab.spec.ts` (one test per VM); new `free/hosts/host-software-tab.spec.ts` | On each premium VM's Library: the subheader; "N items" equal to the titles the API says the host is offered (re-read by reload until a pair agrees, since per-run packages come and go); **Add software** opens `/software/add/fleet-maintained?fleet_id=<VMs>` on the Fleet-maintained tab for macOS and Windows and `/software/add/package?fleet_id=<VMs>` on Custom package for Linux. On free, a host's Software tab is the inventory alone, with no Library or Inventory tab. `HostSoftwareLibrary.subheader` / `itemCount`, `HostDetailsPage.openLibraryTab`, `countHostLibraryTitles`. |
| C4 #P14 | — | Cut at review. |
