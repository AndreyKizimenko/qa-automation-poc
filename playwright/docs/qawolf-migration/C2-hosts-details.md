# hosts-details (Host DETAILS page) — audit

Scope: the `/hosts/:id` detail page — custom/live query a host, delete host from
details, Reports (queries) tab render/sort/view-details, software tab search + drill,
refetch vitals, run existing query, search local users, lock/wipe, hover agent/osquery
tooltip.

**Existing-suite baseline:** there are **NO committed host-details e2e specs**
(`find tests -path '*host*'` returns only `tests/loadtest/*`). The `HostDetailsPage`
POM (118 lines) has tabs + `openSoftwareTab`/`showFullInventory`/`clickFirstSoftware`
+ `refetchButton`/`actionsButton` *locators* but **no action methods** (no Actions-menu
open, no delete/lock/wipe/live-report, no reports-card/user-search/agent-tooltip
helpers). The `firstHostId` worker fixture is **loadtest-only** (built from
`.auth/loadtest-admin.json` + `loadtestFleetId`) and is unusable for premium/free e2e.
A `liveMacosHost` fixture + host-Actions POM methods were prototyped but live only in
the parked stash (`stash@{0}` "CIS host-tests WIP parked 2026-06-28"), not committed.
Everything below is therefore GAP work, landing in a new `tests/e2e/{premium,free}/hosts/`
area (matches the roadmap in the host-tests memory note).

## Disposition table

| # | QA Wolf flow (basename) | Tier | Behavior (1 line) | Disposition | Target (existing or proposed path) | Notes |
|---|---|---|---|---|---|---|
| 1 | global-admin-able-to-custom-query-host | Free | Host Actions → Live report opens "Select a report" modal showing the "create your own report" option | NEW | `tests/e2e/free/hosts/host-live-query.spec.ts` | Primary of free live-query spec; shallow (only asserts modal opens). Merge role variant (#3) + run-existing (#8) in. |
| 2 | global-admin-can-delete-host-from-hosts-details-page | Free | Actions → Delete → confirm; toast + host count decreases | CUT | — | Destructive + count-assertion needs a host **pool** we don't have; would remove the sole live VM (re-enrolls with a new id, breaking the worker fixture). Infra-blocked. See open Qs. |
| 3 | global-maintainer-able-to-custom-query-host | Free | Same as #1 as global-maintainer | MERGE | → `host-live-query.spec.ts` (free) | Role permutation of #1 (both roles "can"). Fold as a role loop or defer role dim to `tests/api/role-access/`. |
| 4 | global-maintainer-can-delete-host-from-hosts-details-page | Free | Delete host as maintainer (sorts OS, avoids VM hosts) | CUT | — | Sibling of #2 (role dup) + same destructive/no-pool blocker. |
| 5 | hosts-queries-table-renders | Free | Reports tab renders report cards, count, sort dropdown default "Newest results", search input, card name/last-updated/Actions | NEW | `tests/e2e/free/hosts/host-reports-tab.spec.ts` | Free host is no-team → its cached reports get wiped by cleanup; spec must provision a saved query + get a result cached (needs a run/interval). Precondition-heavy. |
| 6 | hosts-software-table-links-to-all-hosts-filtered-by-selected-software | Free | Software tab → click software → software-title page → click Hosts count → /hosts filtered by that software | NEW | `tests/e2e/free/hosts/host-software.spec.ts` | Primary of free host-software spec. Reuses `SoftwareTitleDetailPage` + `HostsListPage`. Merge search (#9) in. |
| 7 | refetch-hosts-vitals | Free | Refetch button → "Last fetched less than a minute ago" | NEW | `tests/e2e/free/hosts/host-details-smoke.spec.ts` | Primary of free smoke spec. `refetch()` method exists only in stash. Merge user-search (#10) in. |
| 8 | run-existing-query-on-host | Free | Actions → Live report → pick saved query → Run → "Report finished", 1 result, value "bar", host name | MERGE | → `host-live-query.spec.ts` (free) | The meaty half of the live-query spec. Actually completes a run (reports `run live report` spec only reaches "Select targets"). Also AUGMENTs `tests/e2e/free/reports/reports.spec.ts`. |
| 9 | search-for-hosts-software | Free | Software tab → Full inventory → search by name filters table | MERGE | → `host-software.spec.ts` (free) | Also exercises refetch + `showFullInventory` (already in POM). |
| 10 | search-for-hosts-users | Free | Details tab "Local user accounts" card → search by username filters | MERGE | → `host-details-smoke.spec.ts` (free) | Needs new Local-user-accounts card locators in POM. |
| 11 | global-admin-able-to-custom-query-host | Premium | Same as #1, premium tier | NEW | `tests/e2e/premium/hosts/host-live-query.spec.ts` | Premium counterpart (tier separation → own file). Merge #13 + #20. |
| 12 | global-admin-can-delete-host-from-hosts-details-page | Premium | Delete host (selects Unassigned + Online filter, last online host) | CUT | — | Same destructive/no-pool blocker as #2. Also creates team-dropdown scope churn. |
| 13 | global-maintainer-able-to-custom-query-host | Premium | Same as #11 as maintainer | MERGE | → `host-live-query.spec.ts` (premium) | Role permutation. |
| 14 | global-maintainer-can-delete-host-from-hosts-details-page | Premium | Delete host as maintainer | CUT | — | Sibling role dup + destructive. |
| 15 | hosts-queries-table-renders | Premium | Reports tab renders sort dropdown, search (placeholder "Search by name"), reports-list, card names | NEW | `tests/e2e/premium/hosts/host-reports-tab.spec.ts` | Premium host lives in QA fleet (not wiped by cleanup) → reports can be gitops-provisioned there. Merge sort (#23) + view-details (#24). |
| 16 | hosts-software-table-links-to-all-hosts-filtered-by-selected-software | Premium | Software drill → software-title → Hosts count link → filtered hosts; asserts filter pill shows software name | NEW | `tests/e2e/premium/hosts/host-software.spec.ts` | Premium counterpart. Merge search (#21). |
| 17 | hover-and-verify-agent-osquery-details | Premium | Hosts-list Agent tooltip osquery version → open host → hover Agent underline → tooltip "osquery: X" + "Orbit:" | MERGE | → `host-details-smoke.spec.ts` (premium) | Premium-only in QA Wolf (feature exists on free too). Needs tooltip locators (`[data-tip]`/`role=tooltip` class fallback, commented). |
| 18 | lock-via-host-details | Premium | Actions → Lock → checkbox "I wish to lock <host>" → Lock → "LOCK PENDING" + toast + activity "locked this host" | CUT | — | **Destructive/host-state-mutating.** QA Wolf targeted a *fake* host by private-IP `fe80::…`; we have no fake/disposable MDM host — locking the sole live macOS VM breaks all other host specs and needs MDM lock capability. Infra-blocked; high-value if a disposable MDM host is provisioned. |
| 19 | refetch-hosts-vitals | Premium | Same as #7, premium | NEW | `tests/e2e/premium/hosts/host-details-smoke.spec.ts` | Premium counterpart. Merge user-search (#22) + agent-hover (#17). |
| 20 | run-existing-query-on-host | Premium | Same as #8, premium (picks first report, Run → 1 result "bar") | MERGE | → `host-live-query.spec.ts` (premium) | Same as #8. |
| 21 | search-for-hosts-software | Premium | Same as #9, premium | MERGE | → `host-software.spec.ts` (premium) | — |
| 22 | search-for-hosts-users | Premium | Same as #10, premium | MERGE | → `host-details-smoke.spec.ts` (premium) | — |
| 23 | sort-queries-on-host-details-page | Premium | Reports tab sort dropdown Name Z-A / A-Z reorders report cards | MERGE | → `host-reports-tab.spec.ts` (premium) | Premium-only. Deepest render assertion (verifies actual sort order). Fold as a sub-test after render (#15). |
| 24 | view-query-details-through-host-details-page | Premium | Report card Actions → Show details → report results page; perf-impact value + tooltip; "View data for all hosts" → full host list | MERGE | → `host-reports-tab.spec.ts` (premium) | Premium-only, substantial (cross-checks `/reports` perf column via 2nd tab). Could split to its own `host-report-details.spec.ts` if the tab spec gets heavy. |
| 25 | wipe-via-host-details | Premium | Actions → Wipe → checkbox "I wish to wipe" → Wipe → "WIPE PENDING"/"WIPED" + script activity | CUT | — | **Destructive.** QA Wolf targeted a *fake* Linux host (no hardware model, fake IP). Same blocker as lock (#18). Infra-blocked; revisit with a disposable host. |

## Summary

- **Counts:** DUP 0, AUGMENT 0, NEW 8, CUT 6, MERGE 11
  - (NEW = 8 because 4 spec concepts × 2 tiers = 8 files; MERGE rows fold into those same 8 files. Zero DUP/AUGMENT because the host-details page has no existing e2e coverage at all.)

- **NEW specs recommended** (4 concepts, one file per tier under a new `tests/e2e/{premium,free}/hosts/` area):
  - `host-software.spec.ts` (free + premium) — Software tab: Full-inventory search-by-name filtering **and** drill into a software title → click its Hosts count → land on `/hosts/manage` filtered by that software (filter pill shows the name). Absorbs flows #6, #9, #16, #21.
  - `host-reports-tab.spec.ts` (free + premium) — Reports tab renders cards/count/sort-dropdown/search (both tiers); **premium adds** sort Name A-Z/Z-A ordering (#23) and report-card Actions → Show details → report-results page with perf-impact + "View data for all hosts" (#24). Absorbs #5, #15, #23, #24.
  - `host-live-query.spec.ts` (free + premium) — host Actions → Live report → "Select a report" modal (custom-query entry, "create your own report" option) → pick a saved query → Run → "Report finished" with a result. Absorbs #1, #3, #8, #11, #13, #20. Role dimension (admin + maintainer both allowed) folds in or defers to `tests/api/role-access/`.
  - `host-details-smoke.spec.ts` (free + premium) — Refetch vitals → "Last fetched less than a minute ago"; Local-user-accounts card search; **premium adds** hover Agent underline → osquery/Orbit tooltip (#17). Absorbs #7, #10, #19, #22, #17.

- **Notable CUTs (+reason):**
  - **Delete host from details** (#2, #4, #12, #14) — destructive + the "host count decreased" assertion needs a disposable host **pool**. Deleting our sole live macOS VM removes it (agent re-enrolls with a *new* id, breaking the `liveMacosHost`/worker cache). The 4 flows are also 2 role-dups × 2 tiers.
  - **Lock (#18) / Wipe (#25)** — destructive MDM state changes. QA Wolf ran them against *fake* hosts (fake private-IP `fe80::…`, no hardware model); we have no disposable MDM-enrolled host. Genuinely valuable behaviors, purely infra-blocked — flag for the human, not truly "low value".

- **POM / helper work required:**
  - **`HostDetailsPage` needs action methods** (only locators exist today):
    - `openActions()` + `runAction('Live report' | 'Delete' | 'Lock' | 'Wipe' | 'Transfer' | 'Show details')` — host Actions menu uses `.actions-dropdown__option` / `[class*="dropdown__option"]` (react-select, no role) → class fallback with comment.
    - `refetch()` (click + wait out "Fetching fresh vitals…" → assert "Last fetched less than a minute ago"). Prototyped in the parked stash.
    - Reports tab: locators for `.host-reports-tab__count`, `.host-reports-tab__sort-dropdown`, `.host-report-card` (+ `__name`/`__last-updated`), report search (`#search` / "Search by name"); methods `sortReports(label)`, `openReportCardActions(name)`, `showReportDetails(name)`, `expectReportsRendered()`. All class-based (no roles) → commented fallbacks.
    - Software tab: search-by-name input + `searchSoftware(term)` + `clickSoftware(name)` (partially covered by `clickFirstSoftware`).
    - Details tab: Local-user-accounts card locators + `searchUsers(term)`.
    - Agent/osquery tooltip: hover target `.data-set:has-text("Agent") dd [data-tip]` + `role=tooltip` assertion (class fallback, commented).
    - Select-a-report modal + run-to-results: overlaps `ReportLivePage` — de-stale `ReportLivePage` to cover the completed-run screen ("Report finished", result rows), per the host-tests memory roadmap.
  - **`SoftwareTitleDetailPage`** — add a "Hosts count → filtered hosts list" navigation method (grep shows no host-count link helper yet); reuse `HostsListPage` for the destination assertion (filter pill = `[role="status"]`).
  - **Delete/Lock/Wipe modal POMs** — only needed if those CUTs are ever un-blocked.

- **Role-model / infra gaps:**
  - **No live-host fixture for e2e.** `firstHostId` is loadtest-only. Need to commit a `liveMacosHost` worker fixture (premium → QA fleet via existing `qaFleetId`; free → no-team; both display-named "MacOS 26") — currently only in the parked stash. **The host is the only persistent given** (cleanup does NOT wipe the QA fleet but DOES wipe unassigned/Workstations/global), so every host spec must self-provision + self-clean its reports/software/queries; free-tier reports specs are harder because the no-team host's reports get wiped.
  - **Reports-on-host precondition:** cards only appear once a saved query has a *cached result* for the host — needs a real run (live or interval; `distributed_interval` 10s but scheduled-query cadence is longer). Premium can lean on QA-fleet gitops reports; free must run one itself.
  - **No disposable host pool / no disposable MDM host** → delete/lock/wipe are un-authorable safely today.
  - Static users exist for `global-admin` and `global-maintainer` (both roles the "custom query" permutations need) — no gap there. No team-**admin** static user, but these flows don't need one.
  - QA Wolf specifics to drop: hardcoded `fleet+GlobalAdmin*@qawolf.email`, `page.waitForTimeout`, `networkidle`, `.delete-loading`, `.display_name__header`, `.display_name__cell`, `[data-tip]`, `Virtual Machines`/`All fleets` scope names (→ our `Unassigned`/`Workstations`/`All fleets`).

- **Open questions for the human:**
  1. Delete/Lock/Wipe from host details — do we want these at all given they need a disposable/re-enrollable (and for lock/wipe, MDM-enrolled) host? If yes, is standing up a disposable host pool in scope, or should these stay CUT / move to API-level role-access checks?
  2. `view-query-details` (#24) opens a 2nd tab to cross-check the `/reports` perf-impact column and asserts a "Minimal" tooltip — keep that cross-check, or simplify to just asserting the host report-results page renders?
  3. Should the admin-vs-maintainer "can custom query" permutation live as a UI role loop in `host-live-query`, or move to `tests/api/role-access/`?
