# Batch C — Server-side decisions, over simulations

**23 gaps → about 10 specs, mostly augments, after 4–6 cuts.** `Policy ↔ hosts links` · `Platform targeting` ·
`Transfers and Select all matching` · `Labels` · `Host tabs` · `Vulnerabilities` · `Unassigned views`

**Status: reviewed 2026-10-03, building** (planned 2026-10-01). 19 gaps kept, 4 cut; see
[Review decisions](#review-decisions-2026-10-03).

> ## ▶ Start here
>
> **Branch from `main` at or after da2aceb** ([PR #82](https://github.com/AndreyKizimenko/qa-automation-poc/pull/82),
> batches A and B). **Invoke the `playwright-test-author` skill first** (Skill tool) and follow it. Then read, in order:
> [README.md](README.md) §4–§5, round 2's [README §9](../round-2/README.md#9-working-a-batch-since-d),
> `playwright/CLAUDE.md` (**Test hosts**: what a simulation can and can't answer, borrowing with
> `findSimulations`), round 2's [E → What landed](../round-2/E-label-targeting.md#what-landed) (set membership over
> borrowed simulations), then this file.
>
> **What this batch is.** Things Fleet decides **on the server**: which hosts a policy link lands on, whether
> a policy is listed for a host of another platform, what *Select all matching* transfers, which reports a
> host's tab lists. Simulations answer those as well as a VM does, and there are 300 of them. Nothing here
> installs, runs or delivers anything.
>
> **Two facts change how you write these** (§2): simulations **pass every policy** (only `SELECT 0;` fails),
> and *Select all matching* only appears with 50+ rows selected.
>
> **Since batches A and B (2026-10-03).** The full list is in
> [README §5](README.md#since-batches-a-and-b-2026-10-03). These apply here:
>
> - **Throwaway `pw-*` fleets are approved**: created and deleted in the test, deleted again in an `afterEach` that
>   finds the fleet by name, and swept by cleanup on premium. Deleting a fleet returns its hosts to Unassigned
>   (`ON DELETE SET NULL`, Fleet `server/datastore/mysql/teams.go:268-272`), so simulations staged on one come back
>   with the sweep. That gives C1 #12 and C5 #10's search half a new option (decisions 1 and 5).
> - **`pw-*` labels are swept on premium only**, inside the VMs-fleet step. On free a spec deletes its own and
>   purges a dead run's leftovers up front, as `shared/labels/labels.spec.ts` does. That spec's Manual lifecycle
>   holds **Linux slice 2** of `findSimulations` (a member, never moved); C9 #11 builds on it (§3.4).
> - **An absence check passes on something that never rendered.** Prove the present half first: the selection bar
>   reading "All hosts on this page are selected" before *Select all matching* is absent (C1 #10); the org-name
>   heading before the fleet dropdown and the Fleet column are absent (C5 #1).
> - **`DataTable.cellByColumn` takes the column index from the header**, which can re-render after the list
>   changes. Read C5 #10's Fleet cells by content once the list shows VMs.
> - **A second save's toast can be the first one's.** Read C9 #11's membership back through `listLabelHostIds`
>   after each save.
> - **The org-wide *Store report results* is never toggled** (batch B's decision), so the host Reports tab's
>   toggle (C5 #7 / #20) is always shown.
> - **Nothing here writes global config.** Undo a host move in an `afterEach` too: a timed-out test skips its
>   `finally`, and only the VMs-fleet sweep returns borrowed simulations (none returns them from QA or
>   Workstations).
> - **Reuse:** `ReportDetailsPage.resultRows` (C4 #P17), `createFleetPolicy`'s `platform` and
>   `labels_include_any` (§3.1, §3.3), `getHostDisplayName` for a `findSimulations` id, `deleteLabelsMatching`.
> - **If another batch is built at the same time**, announce each run to its session. A run with dependencies
>   waits for its "go": `cleanup-setup` wipes every global policy and report, which this batch's specs create.
>
> Facts below were checked on 2026-10-01 against `main` (d55846a) and Fleet `rc-minor-fleet-v4.93.0`
> (`cmd/osquery-perf/agent.go` at the same commit), the build both instances run, and again on 2026-10-03 against
> `main` (da2aceb) and the RC branch's head (ac3c0d6).

## The gaps

| Gap | What's untested today | Proposed target | Kind | Source flow |
|---|---|---|---|---|
| round 1 C3 #6 | free: a host's Policies tab → View all hosts filtered by that policy | `shared/policies/policy-hosts-links.spec.ts` | new | `flows-Free/policies-hosts-policies-table-links-to-all-hosts-filtered-by-selected-policy.flow.js` |
| round 1 C3 #24 | as round 1 C3 #6, premium | `shared/policies/policy-hosts-links.spec.ts` | new | `flows-Premium/policies-hosts-policies-table-links-to-all-hosts-filtered-by-selected-policy.flow.js` |
| round 1 C3 #7 | free: the policies list's host-count link → hosts filtered by the policy and response | `shared/policies/policy-hosts-links.spec.ts` | new | `flows-Free/policies-policies-link-to-all-hosts-filtered-by-selected-policy.flow.js` |
| round 1 C3 #26 | as round 1 C3 #7, premium | `shared/policies/policy-hosts-links.spec.ts` | new | `flows-Premium/policies-policies-link-to-all-hosts-filtered-by-selected-policy.flow.js` |
| round 1 C3 #3 | free: a policy set to macOS only is listed on a macOS host's Policies tab and not on another platform's (the flow does set the platform; the round-2 flow G cut was a different one) | free twin of the C3 #19 case | new | `flows-Free/policies-global-maintainer-able-to-create-an-os-specific-policy.flow.js` |
| round 1 C3 #19 | a platform-only policy on a host's Policies tab (label targeting only today) | `premium/policies/policy-label-targets.spec.ts` | augment | `flows-Premium/policies-global-maintainer-able-to-create-an-os-specific-policy.flow.js` |
| round 1 C3 #29 | as round 1 C3 #19, as team-admin — but the flow saves the default policy from the host's tab and never sets a platform | review: likely cut (team-admin policy create is in batch E's policies matrix) | review | `flows-Premium/policies-team-admin-able-to-create-and-delete-an-os-specific-policy-premium.flow.js` |
| round 1 C1 #10 | "Select all matching" is withheld under a filter that can't be transferred by filter (the flow: Low disk space hosts); the label case is batch-run's scale test | `premium/hosts/bulk-transfer.spec.ts` | augment | `flows-Premium/hosts-attempt-to-bulk-transfer-all-hosts-with-filter-unhappy-path.flow.js` |
| round 1 C1 #12 | transfer through "Select all matching" (needs 51+ hosts staged on a fleet nothing else uses) | review: `premium/exclusive/`, or cut (decision) | review | `flows-Premium/hosts-bulk-transfer-hosts.flow.js` |
| round 1 C1 #11 | bulk delete with fleet / status / search filters and the counts across scopes (deleted simulations never come back; host-delete already covers a bulk delete) | review: likely cut, or one search-narrowed delete in host-delete | review | `flows-Premium/hosts-bulk-delete-hosts-with-3-filters-premium.flow.js` |
| round 1 C5 #10 | the Hosts fleet dropdown switching the list to that fleet's hosts (its type-to-search needs 10+ rows, All fleets and Unassigned included; the four standing fleets make 6) | `premium/hosts/…` a hosts-list spec: select VMs, every Fleet cell reads VMs | augment | `flows-Premium/dashboard-team-dropdowns-searchable-searching-and-selecting-a-valid-team-shows-proper-hosts.flow.js` |
| round 1 C9 #11 | a manual label's host count, filter pill and host membership edits from the Hosts list | `shared/labels/labels.spec.ts` (moved by batch A) | augment | `flows-Premium/mdm-add-and-update-manual-labels-to-host.flow.js` |
| round 1 C5 #1 | free dashboard: no fleet dropdown (the check can skip), and the hosts table's team column absent | `free/dashboard/historical-data-collection.spec.ts` | augment | `flows-Free/dashboard-teams-dropdowns-not-searchable-in-free.flow.js` |
| round 1 C5 #7 | free: the host Reports tab's "Show reports that don't store results" toggle flipped, and a discard-data report appearing | `shared/hosts/host-reports-tab.spec.ts` | augment | `flows-Free/reports-reports-show-reports-that-have-no-results.flow.ts` |
| round 1 C5 #20 | as round 1 C5 #7, premium | `shared/hosts/host-reports-tab.spec.ts` | augment | `flows-Premium/reports-reports-show-reports-that-have-no-results.flow.ts` |
| round 1 C5 #12 | a host's Inventory tab: columns and pagination | `shared/hosts/host-software.spec.ts` | augment | `flows-Premium/general-inventory-verify-tab-availability-and-content.flow.js` |
| round 1 C4 #P17 | a report's results → a host's details and Back (host → report direction only today) | `premium/hosts/host-report-details.spec.ts` | augment | `flows-Premium/queries-global-users-view-host-details-link-from-queries-page.flow.js` |
| round 1 C6 #1 | the exploited-vulnerabilities filter: the exploit icon on each row (URL only today) | `premium/software/vulnerabilities.spec.ts` | augment | `flows-Premium/software-vulnerabilities-filter-by-exploited-vulnerabilities.flow.js` |
| round 1 C6 #3 | a CVE's affected-host count differs by fleet (Unassigned only today) | `premium/software/vulnerabilities.spec.ts` | augment | `flows-Premium/software-vulnerabilities-filter-vulnerabilities-by-team.flow.js` |
| round 1 C6 #6 | an Inventory row's View all hosts hand-off (the CVE page's software row only today) | `premium/software/vulnerabilities.spec.ts` | augment | `flows-Premium/software-vulnerabilities-view-all-hosts-from-software-with-vulnerabilities.flow.js` |
| round 1 C6 #7 | Hosts filtered by a CVE (the CVE filter pill; deferred in round 1) | `premium/software/vulnerabilities.spec.ts` | augment | `flows-Premium/software-vulnerabilities-view-all-hosts-vulnerabilities.flow.js` |
| round 1 C6 #26 | Unassigned views: item count = row count, OS and CVE drill-ins | `premium/software/no-teams-views.spec.ts` | augment | `flows-Premium/no-teams-no-teams-able-to-view-software-os-and-vulnerabilities.flow.js` |
| round 1 C6 #27 | the Library of a host on Unassigned (a VMs-fleet host only today) | `premium/software/software-label-targets.spec.ts` or no-teams-views | augment | `flows-Premium/no-teams-no-teams-add-software-for-user-on-no-teams.flow.js` |

## 1. Review first

Read every flow body. Known so far:

- **C3 #3 is not a duplicate.** The free flow does set a platform (unchecks Windows / Linux / ChromeOS,
  `flows-Free/…os-specific-policy.flow.js:94-96`). The flow round-2 G cut was a different, round-2 one. Build it
  as the free twin of C3 #19's platform case.
- **C3 #29: likely cut.** The team-admin flow saves the default policy from a host's tab and never sets a
  platform; team-admin policy create belongs to [batch E](E-role-visibility.md)'s policies matrix.
- **C1 #10 is the negative case.** The flow checks *Select all matching* is **withheld** under the
  Low-disk-space filter. The positive label case is already `batch-run.spec.ts`'s scale test.
- **C1 #11: likely cut.** Its counts across scopes read a pool that changes under every other spec, deleted
  simulations never come back, and `host-delete.spec.ts` already covers a bulk delete. At most, one
  search-narrowed delete of a staged host folded into `host-delete`.
- **C1 #12: a decision** (§3.2): `exclusive/`, or cut.
- **C5 #10: cut the search half.** The page's "Search fleets" box appears only with 10+ rows, and All fleets and
  Unassigned count as rows (`FleetsDropdown.tsx:59-63,185,357`). Workstations, VMs, QA and Mobile make 6, more
  only while a throwaway `pw-*` fleet exists. Keep the cheap read: select VMs, every Fleet cell reads VMs.
- **C5 #7 / #20**: the toggle is **"Show reports that don't store results"**, not "no results".
- **C4 #P17** reads the macOS VM's durable `pw-host-report-results` result: read-only, so no effect on the VM.
- **C6 #1 has a data risk** (§3.5).
- **The free twin of C3 #7** (the policies list's host-count links) waits on an hourly cron: a decision (§3.1).

## 2. What simulations do

- **They pass every policy.** `-policy_pass_prob` defaults to 1.0 (`cmd/osquery-perf/agent.go:4602`), and the
  daemons' plist doesn't set it. `SELECT 0;` always fails (`:3340-3363`). So the hosts a failing link lands on
  are exactly the ones that ran a `SELECT 0;` policy, and a passing one lands on everything that ran it.
- **A policy response only exists after the host has run the policy**: hourly, or on a refetch
  (`server/service/osquery.go:1728` sends policies when a refetch is requested). Use `requestHostRefetch`
  (`waitForNoPendingRefetch` first).
- **They ignore live-query SQL.** Every live query to a simulation returns the same row whatever the SQL
  (`agent.go:3644-3660`). Our daemons run with `--live_query_no_results_prob 0`
  (`tools/perf-hosts/com.fleetqa.perf.premium.plist`), so they do answer, but nothing in this batch should depend
  on what they answer.
- **Half of them simulate orbit** (`-orbit_prob` 0.5), and those fake installs and script runs with a result:
  they don't install anything, but they don't sit pending either.
- **Deleted simulations come back only at the daemons' daily refresh**, if then. Never delete one you didn't
  stage for it.

## 3. Facts for the build

### 3.1 Policy ↔ hosts links (C3 #6, #24, #7, #26)

- **From a host's Policies tab:** "View all hosts", a button shown on row hover only and only when the host has
  a response (`frontend/pages/hosts/details/cards/Policies/HostPoliciesTable/HostPoliciesTableConfig.tsx:114-135`).
  It goes to `/hosts/manage?policy_id=X&policy_response=passing|failing&fleet_id=`. `fleet_id` is the page's
  fleet context, not the host's.
- **From the policies list:** columns "Pass" and "Fail", each an "N host(s)" link to the same URL
  (`PoliciesTableConfig.tsx:348-414`). They show `---` until counted, and **counts come from the hourly
  aggregation cron** (`cmd/fleet/cron.go:1506-1510`). Premium can read the durable VMs-fleet policy "Claude is
  installed (macOS)" (`gitops/premium-fleetqa/fleets/vms.yml:84`). Read it only; it carries an install
  automation. Free has no durable policy, so its twin either waits up to an hour or triggers a global cron:
  **never trigger the instance's crons from a test**. Ask Andrey; the likely answer is premium only plus the
  free paywall-free half (the host tab link, C3 #6).
- **The Hosts page:** a "Pass" / "Fail" dropdown (`PoliciesFilter.tsx:14-25`) and a pill with `role=status`,
  `aria-label="hosts filtered by <name>"`, dismissed with "Remove <name> filter". Both tiers.
- **Bounding the expected set:** on premium, target the policy at a manual label holding borrowed simulations,
  refetch them, and assert the filtered list equals that set. On free (no fleets, so label targeting is
  premium-only), assert your refetched simulations ⊆ the list: others run it on their hourly cycle.
- `createPolicy` takes no platform, labels or fleet. Add options. `createFleetPolicy` (fleet policies only) already
  takes `platform` and `labels_include_any`.

### 3.2 *Select all matching* and transfers (C1 #10, #12, C5 #10)

- The button appears only with **50+ rows selected** (`DataTable.tsx:527-530`; page size from
  `HostsPageConfig.tsx:67`) and only when no unsupported filter is on: `showMarkAllPages={!unsupportedFilter}`
  (`ManageHostsPage.tsx:2088-2108,2140`). Policy, software, OS, low-disk, vulnerability and MDM filters hide it;
  label, status, search and fleet don't. Copy: "<N> selected", "All hosts on this page are selected", "All
  matching hosts are selected" (`DataTable.tsx:456-481`).
- **C1 #10 is vacuous unless the filter matches 50+ hosts.** Low disk space may match fewer. Use the OS filter
  (macOS 14.1.2 is 100 simulations) to get a full page, then assert the button is absent.
- **C1 #12, the transfer itself:** `POST /hosts/transfer/filter {fleet_id: dest, filters: {query, status,
  label_id, fleet_id: current}}` (`ManageHostsPage.tsx:1500-1557`); the server takes only those four keys
  (`server/service/hosts.go:4247-4300`). Toast: "Hosts successfully transferred to  <name>." (two spaces). It
  needs 51+ hosts on a fleet **nothing else uses**, and no standing fleet is one: QA must stay empty
  (`bulk-transfer` asserts it, and `host-transfer-permissions` moves Windows simulations through it), Workstations
  holds `host-delete`'s staged hosts, VMs has the real VMs. **Options:** cut; `premium/exclusive/`, staging 51
  Windows simulations onto QA through the API and moving them back in the `finally`, plus a sweep; or a throwaway
  `pw-*` fleet, which nothing else uses and whose deletion returns its hosts to Unassigned, so the fleet sweep
  doubles as the host sweep. Whether 51 online Windows simulations exist past the slices already claimed is
  unverified. Never Select all matching on Unassigned: it moves every matching simulation, and
  `batch-run`'s scale test needs 50+ online macOS simulations there.
- **C5 #10:** the Fleet column's header is "Fleet" (`team_name`).

### 3.3 Platform targeting (C3 #3, #19)

UI: the "Target" checkboxes "macOS" / "Windows" / "Linux" / "ChromeOS" (`PlatformSelector.tsx:85-118`); API:
`platform: "darwin"` (comma-joined, no spaces). The server lists a policy for a host only when
`p.platforms = '' OR FIND_IN_SET(<host platform>, p.platforms)` (`server/datastore/mysql/policies.go:1405-1414`,
`hosts.go:4074-4097`), so a host of another platform **doesn't list it at all**, with no response needed. Add a
`platform: darwin` case to `policy-label-targets.spec.ts`: listed for a darwin simulation (and the macOS VM),
absent for a linux and a windows simulation (`listHostPolicyIds`), with a free twin.

### 3.4 Labels and host tabs (C9 #11, C5 #1, #7, #20, #12, C4 #P17)

- **C9 #11:** `LabelsPage.addHost` exists; a remove-host method and choosing a label by name in `LabelFilter`
  (it has `selectPlatform` / `selectFirstCustomLabel` only) don't. Membership only, so simulations are never
  moved. `shared/labels/labels.spec.ts`'s Manual lifecycle already creates a manual label holding Linux slice 2 of
  `findSimulations` (one member), so the host count and the filter pill can be read there. The flow's edit
  removes a member and adds another, which takes more hosts than that: claim the next free Linux slice (3 on).
  `pw-*` labels are swept on premium only (the VMs-fleet cleanup step); on free nothing sweeps them, so the
  lifecycle purges its own leftovers up front and deletes what it creates.
- **C5 #1:** free renders `<h1>{org_name}</h1>` instead of the dropdown (`DashboardPage.tsx:888-906`) and drops
  the Fleet column (`HostTableConfig.tsx:839-852`; `hostsList.columnHeader('Fleet')`). The existing free test
  skips when hosts-online collection is off, so write an unconditional one rather than augmenting it.
- **C5 #7 / #20:** the toggle is "Show reports that don't store results" (`HostReportsTab.tsx:220-231`,
  `?show_dont_store=true`, API `include_reports_dont_store_results=true`). Off, only `discard_data=0 AND
  logging_type='snapshot'` reports are listed (`query_results.go:545-549`). It's hidden when the org-wide
  "Store report results" is off, which the suite never turns off. `createReport` can't set `discard_data` yet
  (its `interval` option sends `discard_data: false`). Seeding it through the edit form instead meets the form's
  refill (`ReportEditPage`). Assert through a search marker; the card count is shared.
- **C5 #12:** columns "Name", "Installed version", "Type", "Last opened", "Vulnerabilities", "File path", "Hash";
  placeholder "Search by name or vulnerability (CVE)"; 20 a page. A Windows simulation has ~141 programs
  (8 pages); macOS opens on the Applications view. Don't assert "Last opened" is set on every row: simulations
  likely leave it empty.
- **C4 #P17:** a report's Host cell links to the host's report page (`QueryReportTableConfig.tsx:71-79`):
  host heading, "Back to host details", "View data for all hosts". `ReportDetailsPage.resultRows` holds the
  results table's rows (`premium/reports/stored-results.spec.ts` reads them); a row's Host link has no locator
  yet.

### 3.5 Vulnerabilities and Unassigned (C6 #1, #3, #6, #7, #26, #27)

- **C6 #1:** options "All vulnerabilities" / "Exploited vulnerabilities"; the server filters on
  `cisa_known_exploit=1`, premium only. The icon is `Icon name="error"` with no aria-label and a CISA tooltip
  (`ProbabilityOfExploit.tsx:30-53`). **A CISA-exploited CVE with a null EPSS shows no icon**, so "an icon on
  every row" can fail on Fleet's own data, and the exploited list may be empty. Assert the tooltip on rows that
  render one, or reduce it to the filter's URL and the list's provenance through the API.
- **C6 #3:** "Hosts" column; `GET /vulnerabilities?fleet_id=`; counts from `vulnerability_host_counts`,
  rebuilt by the hourly vulnerabilities cron. Choose through the API a CVE whose All fleets and Unassigned
  counts differ, then assert the UI equals the API in each scope. **Never move hosts to force a difference.**
- **C6 #6:** an Inventory row's "View all hosts" (hover) → `/hosts/manage?software_title_id=&fleet_id=`
  (`SoftwareInventoryTableConfig.tsx:196-218`).
- **C6 #7:** a row's link → `/hosts/manage?vulnerability=<CVE>&fleet_id=`; the pill shows the raw CVE with tooltip
  "Hosts affected by the specified CVE." The hosts list is computed live; the table's count is hourly, so don't
  compare them. Skip the flow's `fleetctl trigger --name vulnerabilities`.
- **C6 #26:** "N items" is the API total at 50 a page, so it equals the rows only after a narrowing search. OS
  drill: `/software/os/<id>?fleet_id=0`; CVE drill: `/software/vulnerabilities/<CVE>?fleet_id=0`.
- **Use `findRenderableCve(request, …, fleetId)`** (`helpers/api/software.ts:371`) for any CVE drill-in: the
  enrichment race (fleetdm/fleet#49913) means the top row may not render, and the probe is fleet-scoped.
- **C6 #27:** a host's Library on Unassigned (`GET /hosts/:id/software?available_for_install=true`, premium
  only); premium's Unassigned has no VM, so a linux simulation. Upload a per-run `fleet-pw-*` `.deb` to
  Unassigned (cleanup wipes it) and never install it.

## Reusable pieces

- `helpers/api/hosts.ts`: `findSimulations` (claimed slices: linux 0–2, darwin 0–5, windows 0–1; all past
  `BORROW_SKIP` = 40), `findMdmSimulations`, `findSimulatedHostIds` (offsets in use: bulk-transfer darwin 0–2,
  host-transfer-permissions windows 0–2, host-delete darwin 10/11/20 and windows 10, cli fleets darwin 30),
  `getHostDisplayName`, `transferHosts`, `requestHostRefetch`, `waitForNoPendingRefetch`, `listFleetHosts`,
  `requireRealHost`.
- Labels: `createManualLabel`, `setManualLabelHosts`, `listLabelHostIds`, `deleteLabelById`,
  `deleteLabelsMatching`. Policies: `createPolicy`, `createFleetPolicy`, `listHostPolicyIds`,
  `deleteFleetPolicies`. Reports: `createReport`. Fleets: `createFleet`, `deleteFleet`.
- Page objects: `HostsListPage` (`filterPill`, `selectAllOnPage`, `selectAllMatchingButton`, `selectedCount`,
  `columnHeader`), `HostDetailsPage` (`openPoliciesTab`, `policyRow`, `dontStoreResultsToggle`,
  `selectSoftwareView`), `VulnerabilitiesListPage`, `CveDetailPage.viewAllHostsFor`, `HostQueryReportPage`,
  `ReportDetailsPage.resultRows`.

## Review decisions (2026-10-03)

Every flow body, target spec and the Fleet components behind them were read, and both instances probed. Andrey
took every recommendation below. **19 gaps kept (most folded into existing specs, one new spec file), 4 cut.**

### Found at review

- **The offline simulations are a free pool.** Each tier also holds ~280–300 *offline* simulation records:
  yesterday's set, abandoned when the perf daemons restart at 16:00 UTC (`tools/perf-hosts/com.fleetqa.perf.refresh.plist`)
  and deleted by host expiry (`host_expiry_window: 1`) a day later. Every picker (`findOnlineHost`,
  `findSimulations`, `findSimulatedHostIds`) takes online hosts, so nothing else touches them. C1 #12 stages its
  51 hosts from there, which removes the need for `exclusive/`.
- **Low disk space matches ~676 hosts on premium's Unassigned** (2026-10-03), so C1 #10 keeps the flow's own filter:
  a full page always fills.
- **`policies.spec` sets a policy's platforms on edit but never reads them back**, though its comment says "a stuck
  field surfaces at the post-save verification". The platform case (C3 #3/#19) creates its policy through the
  UI's Target checkboxes and reads the stored `platform` back.
- **The Hosts list's label pill carries "Edit label" and "Delete label"** (`HostsFilterBlock.tsx:190-255`), and
  nothing tests them. C9 #11's flow uses exactly those, so the Manual lifecycle moves its edit and delete there
  (the Dynamic lifecycle keeps the Labels page's row actions).
- **The exploited list has 96 CVEs and none with a null EPSS** (premium, 2026-10-03), so the icon is assertable today;
  the test still counts rows with an EPSS rather than assuming every row has one.
- **"Select all matching" appears at exactly a full page** (`>= defaultPageSize`, `DataTable.tsx:527`), so 50 staged
  hosts would raise it; 51 is what makes "all matching" differ from "this page".
- **`host-delete` deletes four *online* simulations every run**, which come back only at the daily refresh. Moving it
  to offline ones would stop the drain. Not this batch's: a follow-up.

### Per gap

| gap | decision | where and how |
|---|---|---|
| C3 #6, C3 #24 | **build**, both tiers | new `shared/policies/policy-hosts.spec.ts`: a passing (`SELECT 1;`) and a failing (`SELECT 0;`) global `pw-*` policy, two simulations refetched; on one's Policies tab each row's View all hosts lands on `policy_id` + its own response, the pill names the policy, and the refetched hosts are listed under their response and not the other (⊆, since other hosts answer on their hourly cycle) |
| C3 #3, C3 #19 | **build as one shared test** | same file: a global policy created through the Save-policy modal with only macOS ticked; stored as `darwin`; listed for a darwin simulation, not for a linux or a windows one (API), and on the darwin host's Policies tab but not the linux host's, beside an untargeted sibling that both list. Replaces "augment `policy-label-targets` + a free twin": a global policy behaves the same on both tiers |
| C3 #26 | **build**, premium | the policies list's Pass link for the durable VMs-fleet policy "Claude is installed (macOS)" (read only; it carries an install automation) → hosts filtered by it, equal to a live API read |
| C3 #7 | **cut** (Andrey: premium only) | the list's counts come from the hourly aggregation and free has no policy that survives cleanup; free keeps the host-tab link (C3 #6) |
| C3 #29 | **cut** | duplicates batch E's C3 #31 (team-admin fleet policy CRUD); the flow never sets a platform |
| C1 #10 | **build** | `bulk-transfer.spec.ts`: under the Low disk space filter a full page selected ("All hosts on this page are selected") offers no *Select all matching* |
| C1 #12 | **build** (Andrey: approved) | `bulk-transfer.spec.ts`: 51 offline Ubuntu simulations staged on a throwaway `pw-*` fleet → select the page → *Select all matching* ("51 selected") → Transfer to Unassigned. A `page.route` guard lets `POST /hosts/transfer/filter` through only when its filter is that fleet. API: all 51 unassigned. The `afterEach` deletes the fleet, which returns any staged host. Fails, not skips, when fewer than 51 offline simulations exist |
| C1 #11 | **cut** (Andrey) | `host-delete` covers a bulk delete of a selection; the flow's three filters only decide which rows are on the page (the delete is still by id), and its counts across scopes read shared totals |
| C5 #10 | **cut the search half; fold the rest** | search needs 10+ fleets (`FleetsDropdown.tsx:59-63`); `bulk-transfer`'s staged test also asserts every Fleet cell reads "QA". Dashboard → Hosts keeps the scope in `no-teams-views` already |
| C9 #11 | **build** | `shared/labels/labels.spec.ts` Manual lifecycle: two members (Linux slices 2–3); the Hosts list filtered by the label shows exactly them; edit from the pill's "Edit label" swaps slice 3 for 4, read back through `listLabelHostIds` and the filtered list; delete from the pill's "Delete label" |
| C5 #1 | **fold** | `free/paywalls.spec.ts` beside "no Teams nav link": the dashboard's heading is the org name and it has no fleet dropdown; the Hosts list has a Host column and no Fleet column. Unconditional |
| C5 #7, C5 #20 | **build**, both tiers | `shared/hosts/host-reports-tab.spec.ts`: a `discard_data` report (`createReport` gains the option) is absent with "Show reports that don't store results" off, present on, absent again; read through the search marker |
| C5 #12 | **fold** (low value, kept) | `shared/hosts/host-software.spec.ts`: the Inventory columns and one page forward. No per-row "Last opened" check: simulations leave it empty |
| C4 #P17 | **fold** | `premium/hosts/host-report-details.spec.ts`: from the report's results, the Mac's Host link → its report page (heading, "Back to host details") → back |
| C6 #1 | **build** | `premium/software/vulnerabilities.spec.ts`' exploited test: page 1's rows carry the exploit icon wherever the API gives an EPSS, every row the API returns is `cisa_known_exploit`, and the icon's tooltip names CISA |
| C6 #3, C6 #7 | **build together** | premium `vulnerabilities.spec.ts`, VMs fleet scope: a CVE (chosen through the API) whose fleet count differs from All fleets' shows the API's fleet count; its View all hosts lands on `vulnerability=<CVE>&fleet_id=<VMs>`, and the list equals a live API read (a handful of hosts). Free twin of #7 in `free/software/vulnerabilities.spec.ts` (first page ⊆ the API's set) |
| C6 #6 | **build, moved** | `shared/software/titles-table.spec.ts`, both tiers: a title row's View all hosts → `software_title_id` and a pill naming the title. The flow's "rows with vulnerabilities" isn't the behaviour, and would pull in the slow `vulnerable=true` query |
| C6 #26 | **cut** | the CVE drill on Unassigned is `vulnerabilities.spec`'s "list, pagination, and CVE detail flow", the OS drill is `os.spec`'s "a row drills into that OS", and no *Add software* on Unassigned is `no-teams-views`; what's left ("N items" equals the rows after a search) is a count |
| C6 #27 | **build** | `premium/software/no-teams-views.spec.ts`: a per-run `fleet-pw-*` `.deb` uploaded to Unassigned is in an Unassigned Linux simulation's Library (UI and API); never installed, deleted in the `finally` |

### Simulations claimed

`findSimulations`: linux 3–7 (label members 3–4, the Library read 5, policy refetches 6–7), darwin 6–7 and
windows 2–3 (policy reads and refetches). None is moved. Batch D, built alongside, takes linux 10–39. C1 #12's
offline hosts come from a separate helper, outside `findSimulations`' pool.

## Free coverage

Policies, the host Policies and Reports tabs, the Inventory tab and platform targeting all exist on free. Use
`shared/` where the page is the same, a `free/` sibling where premium's fleets change it, and the free paywall
for the vulnerability and Library rows.

## Traps this batch will hit

- **Moving darwin simulations off Unassigned shifts `batch-run`'s scale test**: it needs 50+ online macOS hosts
  there. Borrow from your own slice, and only what you need.
- **Never use failing SQL on the VMs fleet.** It runs two install policies, and simulations pass them, so
  nothing installs. Keep it that way.
- **Never trigger the vulnerabilities or aggregation crons.** They're global, and other runs see the effect.
- **Cleanup wipes global and Unassigned policies, reports and software. `pw-*` labels are swept on premium only;
  on free they survive it.**
- **A shared count is never an assertion.** Assert set membership over the hosts you staged.

## Done when

- ~~Every row has a written review decision; the questions above have Andrey's answer.~~ Done 2026-10-03.
- The augments and new specs built, on every tier each targets, each moving back every simulation it borrowed
  in its `finally` (and claimed in the registry in `helpers/api/hosts.ts`).
- `npm run check` clean; each changed spec run with dependencies on its tiers, once headed, `--repeat-each=5` for
  anything waiting on a refetch.
- `playwright-test-reviewer` run on the branch's diff, findings fixed or answered.
- Docs in the same commits: this file's *What landed*, a [DELIVERY-LOG](../DELIVERY-LOG.md) line, a
  [test-audit](../../test-audit/README.md) entry per `test()`, `helpers/README.md` / `pages/README.md`, and this
  round's [README](README.md) batch table and [INDEX](INDEX.md).
- PR open, Andrey told it's ready for its branch run.

## What landed

Built on `playwright/qawolf-round3-batch-c`. Each slice was run on every tier it targets before it was
committed.

| slice | gaps | what |
|---|---|---|
| policies | C3 #3, #19, #6, #24, #26 | **New `shared/policies/policy-hosts.spec.ts`**: a policy created through the Save policy modal with only macOS ticked is stored as `darwin`, listed (API) on a macOS simulation and not on a Linux or Windows one, beside an untargeted sibling all three list, and shown on the macOS host's Policies tab but not the Linux host's. A passing (`SELECT 1;`) and a failing (`SELECT 0;`) Linux-only policy, two simulations refetched until they answer both; each row's **View all hosts** lands on `policy_id` + that answer, the pill and the Pass / Fail control match, both simulations are listed (searched by name), and neither is once the control is switched. **New `premium/policies/policy-host-counts.spec.ts`**: the VMs fleet's "Claude is installed (macOS)" Pass link carries `fleet_id`, and the hosts under Pass and then Fail equal a live API read. Premium 3/3 and 5×, free 2/2 |
| transfers | C1 #10, #12, C5 #10 | **`premium/hosts/bulk-transfer.spec.ts`**: the dashboard's Low disk space card → a full page selected ("All hosts on this page are selected", "50 selected") and no *Select all matching hosts*. A new describe stages 51 offline Ubuntu simulations (`findOfflineSimulations`, newest abandoned set first) on a throwaway `pw-transfer-*` fleet; *Select all matching* reads "51 selected", Transfer → Unassigned, and a `page.route` guard passes `POST /hosts/transfer/filter` only when its filter is that fleet (one request, to `fleet_id: null`); API: the fleet is empty and all 51 are on Unassigned. The `afterEach` deletes the fleet by name. The QA-staged test also reads each row's Fleet cell (C5 #10). `CLAUDE.md` › Test hosts names the offline pool. Premium 5/5, the two new tests 5× |
| labels | C9 #11 | **`shared/labels/labels.spec.ts` Manual lifecycle**, both tiers: created with two Linux simulations (slices 2–3); the Hosts list filtered by it (typed into the label filter, `LabelFilter.selectLabel`) holds exactly them; **edit from the Hosts list** (the pill's *Edit label*): the form shows both members, one is removed and slice 4 added, `listLabelHostIds` reads the new pair, and the filtered list holds it; **delete from the Hosts list** (the pill's *Delete label*): "Successfully deleted label.", back on the unfiltered list. The Dynamic lifecycle keeps the Labels page's Edit and Delete. `LabelsPage.addHost` now reads the search dropdown (the edit form's selected table holds the same cells), `selectedHost` / `selectedHostNames` / `removeHost`; `HostsListPage.editLabelButton` / `deleteLabelButton` / `deleteLabelModal`. Premium 12/12, free 8/8, the Manual describe 3× on one worker |
| host tabs | C5 #1, #7, #20, #12, C4 #P17 | **`free/paywalls.spec.ts`**: the dashboard's `h1` is the org name and there is no fleet dropdown; the Hosts list has a Host column and no Fleet column (`columnHeader(name, { exact })`: "Added to Fleet" contains it). **`shared/hosts/host-reports-tab.spec.ts`**: a Discard-data report (`createReport({ discardData })`) beside a storing one, on the Mac's Reports tab: absent with the toggle off, listed with it on (`show_dont_store=true`), absent again. **`shared/hosts/host-software.spec.ts`**: the full inventory's seven columns, "N items" over 20, Next shows 20 other titles and Previous the first page again (`softwareColumnHeader`, `turnSoftwarePage`). **`premium/hosts/host-report-details.spec.ts`**: from the report's results the Mac's Host link opens its per-host page, and Back to host details lands on `/hosts/<id>/details` (`ReportDetailsPage.hostResultLink`). Premium 6/6, free 25/25 (with the paywall rows) |
| vulnerabilities and Unassigned | C6 #1, #3, #6, #7, #27 | **premium `vulnerabilities.spec.ts`**: the exploited filter's rows are all in the API's exploited list and CISA-flagged, each carries the exploit icon exactly when the API gives it an EPSS score, and the icon's tooltip names CISA (`exploitMarks`, `hoverExploitIcon`). New: on the VMs fleet, a CVE (chosen through the API, counted differently under All fleets) shows the API's count in each scope, and its row's View all hosts lists exactly the API's hosts for it on that fleet. **free `vulnerabilities.spec.ts`**: a CVE's View all hosts lists hosts it affects (⊆ the API's). **`shared/software/titles-table.spec.ts`**: a title row's View all hosts → `software_title_id` and a pill naming it (both tiers). **`premium/software/no-teams-views.spec.ts`**: a per-run `fleet-pw-unassigned-*` `.deb` on Unassigned is offered to an Unassigned Linux simulation, in the API and its Library. `listVulnerabilities`, `listVulnerabilityHosts`; `VulnerabilitiesListPage.row` / `hostsCount` / `viewAllHostsFor`; `SoftwareTitlesPage.viewAllHostsForFirstTitle`. Premium 4/4 and the two vulnerability tests 3×, free 2/2 |
| cut | C3 #7 (free), C3 #29, C1 #11, C5 #10's search, C6 #26 | as reviewed |
