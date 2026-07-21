# Queries + Schedule — audit

Cluster covers QA Wolf `queries-*` (→ our **reports** area) and `schedule-*` flows.
35 flows total: 5 Free, 30 Premium.

## Key structural finding (corrects the brief's assumption)

**There is NO separate "Schedule" feature/page in current Fleet, and no SchedulePage POM
is needed.** The Navbar POM exposes only `Reports` (→ `/reports/manage`). Every `schedule-*`
flow operates entirely inside the Reports UI ("Add report", "Edit report", the frequency
dropdown, the "Back to reports" link). A "scheduled query" is just a saved **report with a
non-`Never` interval** — and `tests/e2e/*/reports/reports.spec.ts` already sets an interval on
create (`Every 30 minutes`), edits it (`Every 15 minutes`), and asserts the interval cell in the
list. So the schedule flows are report-CRUD/role variants, not a coverage gap requiring a new POM.

## What the existing reports.spec.ts already covers (the DUP bar)

Premium (`All fleets` + `Workstations` scopes) and Free (global): full CRUD as serial sub-tests —
create (name/description/interval/observers-can-run + SQL, verify on details + interval cell in
list), **run live report only to the "Select targets" heading (does NOT run to completion or
export)**, edit (all fields incl. platforms + interval), bulk delete, and a dashboard activity-feed
assertion (`created a report`/`edited the report`/`deleted the report`). Show-query modal covered.
Platform filter exists **only as a URL param** (`ReportsListPage.applyPlatformFilter`), not the UI dropdown.

## Disposition table

| # | QA Wolf flow (basename) | Tier | Behavior (1 line) | Disposition | Target (existing or proposed path) | Notes |
|---|---|---|---|---|---|---|
| F1 | queries-…global-admin-can-create-edit-and-delete-global-query | Free | Report CRUD by global admin | DUP | tests/e2e/free/reports/reports.spec.ts | Existing spec is deeper (field verify + activity feed) |
| F2 | queries-…global-admin-run-a-live-query-and-allow-exporting-results | Free | Run live query to completion on All hosts + export CSV | MERGE | (new) free/reports/live-run.spec.ts | Group "live-run+export"; existing spec stops at Select targets |
| F3 | queries-…global-observer-can-only-select-and-run-a-query | Free | Observer sees no Add/Edit; can run observer-can-run report | MERGE | (new) free/reports/role-access.spec.ts | Group "observer read-only"; static `global-observer` exists |
| F4 | queries-…save-an-existing-query-as-new-query-admin-user | Free | "Save as new" → "Copy of X" duplicate | MERGE | (new) free/reports/save-as-new.spec.ts | Group "save-as-new" |
| F5 | schedule-global-maintainer-can-create-edit-and-delete-a-scheduled-query | Free | Report create/edit-name/delete by maintainer (no interval set!) | CUT | — | Pure role-dup of F1; maintainer perms == admin for reports; no schedule behavior |
| P1 | queries-…ability-to-save-invalid-queries | Prem | Invalid SQL: syntax-error label shown, Save stays enabled, saves | AUGMENT | premium/reports/reports.spec.ts | Add negative-path sub-test. Copy: "Syntax error. Please review before saving." |
| P2 | queries-…historical-results-to-log-destination-on-creation-and-editing | Prem | Automations on/off switch → log destination (Filesystem) on create + edit | NEW | (new) premium/reports/automations.spec.ts | Copy: "Automations on/off", "Historical results will be sent to your log destination: Filesystem.", detail "Automations:On" / "Log destination: Filesystem" |
| P3 | queries-…edit-and-save-query-verify-query-report-removed-reset | Prem | Editing SQL/platform/min-osquery-ver triggers "delete previous results" modal + report reset | NEW | (new) premium/reports/results-lifecycle.spec.ts | HOST-DEP (needs results to collect). Copy: "Changing this report's SQL will delete its previous results…" |
| P4 | queries-…enable-and-disable-discard-data-query-option | Prem | Advanced options → Discard data; results page "Nothing to report" vs "Collecting results" | NEW | (merge into) premium/reports/results-lifecycle.spec.ts | HOST-DEP. `#discardData` checkbox under "Advanced options" |
| P5 | queries-…global-admin-can-create-edit-and-delete-global-query | Prem | Report CRUD by global admin | DUP | premium/reports/reports.spec.ts | — |
| P6 | queries-…global-admin-search-filter-by-platforms-view-inherited (team view) | Prem | Search-by-name count, platform-filter dropdown (macOS hides windows qry), view inherited query | NEW | (new) premium/reports/list-filters.spec.ts | UI platform dropdown + inherited pill; existing spec only URL-param filter |
| P7 | queries-…global-admin-can-update-managed-automations | Prem | Reports list "Automations" button → modal enable/disable → On/Off in table | NEW | (merge into) premium/reports/automations.spec.ts | Toast: "Successfully updated report automations." ; `automations_enabled` cell |
| P8 | queries-…global-admin-run-a-live-query-and-allow-exporting-results | Prem | Run live to completion on All hosts + export CSV | MERGE | (new) premium/reports/live-run.spec.ts | Group "live-run+export" w/ F2 |
| P9 | queries-…global-maintainer-able-to-run-query | Prem | Maintainer runs live query to completion | MERGE | premium/reports/live-run.spec.ts | Role variant; static `global-maintainer` exists |
| P10 | queries-…global-maintainer-able-to-select-teams-target | Prem | Maintainer selects a team as live-run target (checkmark + hosts targeted) | MERGE | premium/reports/live-run.spec.ts | Group "target selection" |
| P11 | queries-…global-observer-able-to-select-teams-target | Prem | Observer (admin-created observer-can-run qry) selects team target | MERGE | premium/reports/live-run.spec.ts | Group "target selection" |
| P12 | queries-…global-observer-can-only-select-and-run-a-query | Prem | Observer read-only + can run observer-can-run report | MERGE | premium/reports/role-access.spec.ts | Group "observer read-only" w/ F3 |
| P13 | queries-…osquery-table-for-adobe-plugins-detection (.ts) | Prem | osquery schema sidebar search (adobe_plugins) → copy example → live-run macOS → assert results | NEW | (new) premium/reports/osquery-schema.spec.ts | HOST+DATA-DEP (macOS host w/ Adobe). Aligns w/ host-tests project |
| P14 | queries-…run-live-query-by-no-team | Prem | Run live query targeting "No team"/Unassigned | MERGE | premium/reports/live-run.spec.ts | Group "target/scope"; Unassigned selector |
| P15 | queries-…save-an-existing-query-as-new-query-admin-user | Prem | Save-as-new w/ team dropdown, dup-name error, cross-team copy | MERGE | premium/reports/save-as-new.spec.ts | Richer than F4. Copy: default "Copy of X"; error 'A report called "X" already exists for this fleet.'; success "Successfully added report X." |
| P16 | queries-…save-as-new-user-with-access-to-just-one-team | Prem | Single-team user: save-as-new modal shows only Name, no team dropdown | MERGE | premium/reports/save-as-new.spec.ts | Single-team variant → maps to `ws-maintainer` |
| P17 | queries-…view-host-details-link-from-queries-page | Prem | Report results page: host links → host's query-report page + back | NEW | (new) premium/reports/host-details-link.spec.ts | HOST+DATA-DEP. `.hqr-table__query-info`, "Back to host details", "View data for all hosts" |
| P18 | queries-observer-observer-global-can-create-and-run-a-live-query | Prem | Observer+ (global) creates + runs live query to completion | MERGE | premium/reports/live-run.spec.ts | Role variant; static `global-observer-plus` exists |
| P19 | queries-observer-observer-team-role-can-create-and-run-a-live-query | Prem | Observer+ (team) creates + runs live query | MERGE | premium/reports/live-run.spec.ts | GAP: no team observer-plus static user; uses addHostsToTeam+Ducks |
| P20 | queries-team-users-team-admin-able-to-custom-query-host | Prem | Host details → Actions → Live report → "Select a report" modal ("create your own report") | NEW | AUGMENT host-details area (not reports) | team-admin GAP; addHostsToTeam+Ducks. Belongs w/ hostDetails POM |
| P21 | queries-team-users-team-admin-able-to-delete-or-edit-query-not-authored-by-them | Prem | Team admin edits+deletes a team query authored by another user | MERGE | premium/reports/role-access.spec.ts | Group "edit/delete perms"; team-admin GAP |
| P22 | queries-team-users-team-admin-able-to-select-teams-target | Prem | Team admin selects team as live-run target | MERGE | premium/reports/live-run.spec.ts | Group "target selection"; team-admin GAP |
| P23 | queries-team-users-team-admin-can-create-and-run-live-query | Prem | Team admin creates+runs live query, team target, >20gb-free label | MERGE | premium/reports/live-run.spec.ts | Role variant; team-admin GAP; addHostsToTeam Pigeons/Turkeys |
| P24 | queries-team-users-team-admin-search-filter-inherited | Prem | Team admin search count + platform filter + inherited view | MERGE | premium/reports/list-filters.spec.ts | w/ P6; team-admin GAP |
| P25 | queries-team-users-team-admin-cannot-edit-an-inherited-query | Prem | Team admin: inherited query has no "Edit report" button | MERGE | premium/reports/list-filters.spec.ts | Inherited-row assertion; team-admin GAP |
| P26 | queries-team-users-team-maintainer-can-edit-delete-not-authored + inherited | Prem | Team maintainer edits+deletes team qry (not author); cannot edit/delete inherited global qry | MERGE | premium/reports/role-access.spec.ts | Group "edit/delete perms"; maps to `ws-maintainer` |
| P27 | schedule-add-query-to-team-schedule | Prem | Create team-scoped report w/ frequency (Every 6 hours), assert interval cell | DUP | premium/reports/reports.spec.ts | Team scope + interval create + interval-cell already covered (Workstations) |
| P28 | schedule-global-admin-can-create-edit-and-remove-teams-scheduled-query | Prem | Team-scoped report CRUD + rich default-state assertions | AUGMENT | premium/reports/reports.spec.ts | Graft: default SQL `SELECT * FROM osquery_info;`, all 4 platforms compatible, observers-can-run default off, Live report / Save as new buttons enabled |
| P29 | schedule-global-maintainer-can-create-edit-and-delete-a-scheduled-query | Prem | Report create/edit-name/delete by maintainer (no interval) | CUT | — | Role-dup of P5; no schedule behavior |
| P30 | schedule-team-admin-create-edit-and-remove-teams-scheduled-query | Prem | Team admin CRUD of team-scoped report w/ frequency | MERGE | premium/reports/reports.spec.ts (role variant) | Low value (DUP of P28 + role); team-admin GAP |

## Summary

- **Counts: DUP 3, AUGMENT 2, NEW 8, CUT 2, MERGE 20** (35 flows)

### NEW specs recommended (proposed paths)
1. `tests/e2e/premium/reports/save-as-new.spec.ts` (+ `free/reports/save-as-new.spec.ts`) — F4, P15, P16 (default copy name, dup-name error, cross-team copy, single-team-user modal variant).
2. `tests/e2e/premium/reports/list-filters.spec.ts` — P6, P24, P25 (search count, UI platform-filter dropdown, inherited-query view + team-admin no-edit).
3. `tests/e2e/premium/reports/automations.spec.ts` — P2, P7 (per-report automations switch + log destination; list-level "Automations" manage modal + On/Off cell).
4. `tests/e2e/premium/reports/results-lifecycle.spec.ts` — P3, P4 [HOST-DEP] (SQL/platform/min-osquery edit → reset-warning modal; discard-data → "Nothing to report" vs "Collecting results").
5. `tests/e2e/premium/reports/live-run.spec.ts` (+ `free/reports/live-run.spec.ts`) — F2, P8, P9, P10, P11, P14, P18, P19, P22, P23 [HOST-DEP] (run-to-completion, export CSV, target picker: All hosts / team pills / specific host / Unassigned, results heading, across roles).
6. `tests/e2e/premium/reports/role-access.spec.ts` (+ `free` observer) — F3, P12, P21, P26, P30 (observer read-only + run; team-admin & team-maintainer edit/delete not-authored; cannot touch inherited).
7. `tests/e2e/premium/reports/osquery-schema.spec.ts` — P13 [HOST+DATA-DEP] (osquery schema sidebar → adobe_plugins → live-run w/ real results).
8. `tests/e2e/premium/reports/host-details-link.spec.ts` — P17 [HOST+DATA-DEP], and P20 as an **AUGMENT to the host-details area** (host → Live report modal), not the reports area.
9. AUGMENT existing `premium/reports/reports.spec.ts`: P1 (invalid-SQL-still-saves sub-test) and P28 (default-state assertions on freshly-created report).

### Notable CUTs
- F5, P29 (`schedule-global-maintainer` free+premium): create/edit-name/delete a report as maintainer with **no interval ever set** — pure role duplicates of the admin CRUD in reports.spec; report permissions don't distinguish admin vs maintainer, so zero added coverage.
- P30 marked MERGE (not CUT) only to preserve team-admin role intent, but it is effectively DUP of P28 + role and is blocked on a missing static user — a candidate to drop if team-admin coverage isn't prioritized.

### POM / helper work required
- **ReportLivePage — largest build.** Currently only asserts the "Select targets" heading. Needs: target picker (All hosts button, team pills with `data-testid="check-icon"` selected state, specific-host searchbox, Unassigned/"No team" selector), Run, live-results heading ("% responded", "Report finished" / "Running report", "N results", targeted-count `run-query-page__targets-total-count`), Export results (download event → `.csv`), Show query, Errors tab, Close, Run again. Gates specs #5, and P13/P17.
- **ReportEditPage** — add: `saveAsNew()` + save-as-new modal (`button.save-as-new-query`, `#queryName`, in-modal team dropdown, dup-name error toast); automations switch (`getByRole('switch')`) + log-destination copy; "Advanced options" disclosure (discard-data `#discardData`, minimum-osquery-version select, platform-in-advanced); invalid-SQL syntax-error label with Save-still-enabled; SQL/settings-change "delete previous results" warning modal.
- **ReportsListPage** — add: UI platform-filter dropdown (today only `applyPlatformFilter` via URL param), inherited-query row helpers (`.pill-badge__element` = "Inherited"), search results-count text ("N report(s)"), list-level "Automations" button + manage-automations modal + `automations_enabled` cell.
- **ReportDetailsPage** — add: results-state helpers ("Collecting results…", "Nothing to report", results table, `Automations:On/Off`, `Log destination`), and host-details link navigation for P17.
- **No SchedulePage POM** — do NOT build one; schedule flows fold into reports.
- **Query API helper** — only `deleteAllQueries` exists in `helpers/api/cleanup.ts`; a `createQuery` precondition helper would let role/permission specs seed a report via API instead of the UI (useful for P12/P21/P26 second-user setups).

### Role-model / infra gaps
- **No team-admin static user** (blocks/limits P20, P21, P22, P24, P25, P30). This is the single biggest role gap for this cluster. Needs provisioning (e.g. a `ws-admin` on Workstations) before those specs can be authored honestly.
- **No team observer-plus static user** (blocks P19); global observer-plus (`global-observer-plus`) exists for P18.
- Single-team-access user (P16) maps cleanly to existing `ws-maintainer` (maintainer on Workstations only). Team-maintainer flows (P26) map to `ws-maintainer`.
- **Team retargeting + no-team-create rule**: flows reference Swans / Pigeons / Geese / Ducks / Turkeys / Virtual Machines / "No team (renamed)" and several call `addHostsToTeam(...)`. All must retarget to `Workstations` / `QA` / `Unassigned`, and the host-adding/team-create steps dropped in favor of the gitops model.
- **Host dependency**: specs #4, #5, #7, #8 and P20 require enrolled hosts that actually return results (export CSV, results collection, Adobe data). Align with the host-tests project / MacOS 26 VM fleet; flag as flake-prone and gate behind host availability.

### Open questions for the human
1. Confirm the current Fleet build has no standalone "Schedule" page (nav shows only "Reports"; all flows here operate on `/reports`). If confirmed, the schedule cluster carries no unique coverage beyond report interval + roles.
2. How deep should live-query-run coverage go given host dependency and known flakiness — port the full target-picker/results/export assertions, or keep reports.spec at the current "Select targets renders" depth and add only a thin run+export smoke on the VM fleet?
3. Provision team-admin (and team observer-plus) static users? Without team-admin, ~6 flows can't be authored faithfully.
4. Are P13 (Adobe osquery table) and P17 (host-details link) worth the real-data dependency (macOS host with Adobe installed, populated report results), or park them with the host-tests roadmap?
