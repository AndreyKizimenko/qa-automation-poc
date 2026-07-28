# hosts-list (Hosts LIST page + labels + transfer + webhooks + CSV + bulk actions + CTA-by-role) — audit

Context: there is currently **zero** e2e hosts coverage (`tests/e2e` has no hosts spec; only `tests/loadtest/hosts.spec.ts`). Existing POMs are thin: `HostsListPage` (61 lines — search / addHosts / editColumns buttons + goto + firstHost helpers) and `LabelsPage` (25 lines — just the `/labels/manage` list). So almost every flow here is a genuine gap. Free/premium pairs and role-permutation sets collapse, so MERGE is heavy too.

## Disposition table
| # | QA Wolf flow (basename) | Tier | Behavior (1 line) | Disposition | Target (existing or proposed path) | Notes |
|---|---|---|---|---|---|---|
| 1 | add-and-download-host-files | Free | Add Hosts modal → Advanced tab → download Fleet cert / enroll secret / flagfile; assert file contents | NEW | `tests/e2e/shared/hosts/add-hosts-download.spec.ts` (primary) | Tier-agnostic (only diff is tls_hostname). Big POM gap: Add-Hosts modal, Advanced tab, Plain-osquery dropdown, 3 download buttons. Downloads assert cert `BEGIN CERTIFICATE`, enroll secret string, flagfile server line. |
| 2 | create-edit-and-delete-custom-label | Free | Create → edit → delete a custom SQL label via the Hosts label filter; toast + filter-pill assertions | NEW | `tests/e2e/shared/hosts/labels-crud.spec.ts` (primary, serial CRUD) | Toasts: "Label added successfully." / "Label updated successfully." / "Successfully deleted label." Label created from Hosts label-filter "Add label"; edit/delete via filter-pill pencil/trash icons (`data-testid=pencil-icon`/`trash-icon`). Tooltip shows description on hover. |
| 3 | edit-host-status-webhook | Free | Settings → Integrations → Host status webhook: enable, set URL + %, save, verify persist, cleanup | NEW | `tests/e2e/shared/settings/host-status-webhook.spec.ts` (primary) | Global host-status webhook exists in both tiers → shared. Needs IntegrationsPage POM expansion (thin today). URL from `DESTINATION_URL` env. Toast "Successfully updated settings." |
| 4 | export-hosts-to-csv | Free | Click "Export hosts" → CSV download contains first online host name | NEW | `tests/e2e/shared/hosts/export-csv.spec.ts` (primary) | POM gap: `exportHosts()` download + CSV read. Reuse `firstHostName()`. |
| 5 | global-admin-can-see-and-click-cta-buttons | Free | Admin sees/uses Add hosts, Manage enroll secret (add/copy/delete secret), Add label | NEW | `tests/e2e/free/hosts/cta-visibility.spec.ts` (primary) | Bundles enroll-secret add/copy/delete lifecycle (see POM notes). Drop the hardcoded "DO NOT DELETE THIS SECRET" guard + clipboard hack. |
| 6 | global-observer-cant-see-and-click-cta-buttons-free | Free | Observer: Export visible; Add hosts / Manage enroll secret / Add label NOT visible | MERGE | `tests/e2e/free/hosts/cta-visibility.spec.ts` | Negative role case in the free CTA spec (`global-observer` static user). |
| 7 | hide-and-show-user-email-column | Free | Edit columns → toggle "User email" column on/off; assert header + data | NEW | `tests/e2e/shared/hosts/edit-columns.spec.ts` (primary) | POM gap: edit-columns modal (check/uncheck by label, save). Tier-agnostic. |
| 8 | activity-log-enabling-disabling-and-editing-webhooks-appears-on-activity-log | Premium | Dashboard "Automations" modal: enable/disable/edit activity-feed automations; assert entries in activity feed | NEW | `tests/e2e/premium/dashboard/automations-activity.spec.ts` | **Mis-titled — NOT host-status webhook.** This is the dashboard activity-feed automations modal. Belongs to a dashboard/automations cluster — flag for reassignment. Reuse `dashboard.expectActivities([...])`; activities: "enabled/disabled/edited activity automations". |
| 9 | add-and-download-host-files | Premium | Same as #1, premium instance | MERGE | `tests/e2e/shared/hosts/add-hosts-download.spec.ts` | Identical to free except tls_hostname. Tier collapse. |
| 10 | attempt-to-bulk-transfer-all-hosts-with-filter-unhappy-path | Premium | With a label filter applied + all-hosts selected, "Select all matching hosts" must NOT appear | MERGE | `tests/e2e/premium/hosts/bulk-transfer.spec.ts` | Negative edge case grafted into bulk-transfer spec. Filters on "Low disk space hosts" built-in label. |
| 11 | bulk-delete-hosts-with-3-filters-premium | Premium | Filter by team+status+search, bulk-delete matching hosts, verify counts drop across scopes | NEW | `tests/e2e/premium/hosts/bulk-delete.spec.ts` | **Destructive** — deletes real enrolled hosts with no re-enroll path. Heavy count arithmetic. Flag viability (see infra gaps). POM: header checkbox, results-count, Delete btn, `.delete-host-modal`, toast "Hosts successfully deleted". |
| 12 | bulk-transfer-hosts | Premium | Select 50 hosts, "Select all matching", transfer between teams; verify counts | NEW | `tests/e2e/premium/hosts/bulk-transfer.spec.ts` (primary) | **Creates + deletes two teams in body** ("Bulk Transfer Hosts", "TeamToTransferHostsFrom") → must rework to Unassigned↔Workstations using `transferHosts`/`transferHostsByFilter` API helpers for preconditions/cleanup. POM: transfer-icon, transfer modal "Select a fleet", "Select all matching hosts". |
| 13 | create-a-team-from-transfer-hosts-modal | Premium | From transfer modal, "Create a fleet" link → create team, assign host, delete team | CUT | — | Entire purpose is create+delete a team in the body — incompatible with gitops model; no team-admin/host-provisioning fit. Salvage: assert the "Create a fleet" link is present in the transfer modal as a 1-line AUGMENT to #12. |
| 14 | create-and-delete-label-with-special-characters | Premium | Create label named `!@#$%^&*()_-+=` then delete | MERGE | `tests/e2e/shared/hosts/labels-crud.spec.ts` | Contributes a special-character label-name case to the labels CRUD spec. |
| 15 | create-edit-and-delete-custom-label | Premium | Same as #2, premium | MERGE | `tests/e2e/shared/hosts/labels-crud.spec.ts` | Tier collapse — labels are global/tier-agnostic. |
| 16 | edit-host-status-webhook-settings-team-level | Premium | Team Admin edits team-level host status webhook; asserts host-expiry tooltip/help + disabled input | NEW | `tests/e2e/premium/settings/team-host-status-webhook.spec.ts` | Premium-only (team settings). **Needs team-admin static user (does not exist)** — blocked. Extra assertions: host-expiry tooltip, help text, disabled expiry input when globally set. |
| 17 | edit-host-status-webhook | Premium | Same as #3, premium global settings | MERGE | `tests/e2e/shared/settings/host-status-webhook.spec.ts` | Global variant, tier collapse. |
| 18 | export-hosts-to-csv | Premium | Same as #4, premium | MERGE | `tests/e2e/shared/hosts/export-csv.spec.ts` | Tier collapse. |
| 19 | global-admin-can-see-and-click-cta-buttons | Premium | Admin CTAs (as #5) on premium | NEW | `tests/e2e/premium/hosts/cta-visibility.spec.ts` (primary) | Same bundle as #5 incl enroll-secret lifecycle. |
| 20 | global-admin-can-transfer-host-to-existing-team-premium | Premium | Global admin transfers a single host to a team (via host details Actions→Transfer) and back | NEW | `tests/e2e/premium/hosts/host-transfer-permissions.spec.ts` (primary) | Uses QA Wolf team "Turkeys" → rework to Workstations↔Unassigned. Transfer action lives on host **details** (overlaps hosts-details cluster) but is driven from the list; keep here as the role-permission spec. |
| 21 | global-maintainer-can-see-and-click-cta-buttons | Premium | Maintainer CTAs (same as admin) | MERGE | `tests/e2e/premium/hosts/cta-visibility.spec.ts` | Positive role case (`global-maintainer`). |
| 22 | global-maintainer-can-transfer-host-to-existing-team-premium | Premium | Global maintainer transfers a single host to a team | MERGE | `tests/e2e/premium/hosts/host-transfer-permissions.spec.ts` | Positive role case. Relies on `addHostsToTeam` — drop (can't provision hosts). |
| 23 | global-observer-cant-see-and-click-cta-buttons-premium | Premium | Observer CTAs hidden (as #6) on premium | MERGE | `tests/e2e/premium/hosts/cta-visibility.spec.ts` | Negative role case. |
| 24 | hide-and-show-user-email-column | Premium | Same as #7, premium | MERGE | `tests/e2e/shared/hosts/edit-columns.spec.ts` | Tier collapse. |
| 25 | search-for-teams-in-transfer-hosts-modal | Premium | Type a team name in the transfer modal; assert single typeahead match + transfer | MERGE | `tests/e2e/premium/hosts/bulk-transfer.spec.ts` | Team-search/typeahead case in the transfer modal (`dropdown-option` testid). Uses arbitrary teams → rework to Workstations. |
| 26 | team-admin-able-to-delete-host-premium | Premium | Team Admin can delete a host (host details Actions→Delete) | NEW | `tests/e2e/premium/hosts/host-delete-permissions.spec.ts` | **Triple-blocked**: needs team-admin static user (missing) + host provisioning (`addHostsToTeam`) + is destructive. Strong CUT candidate unless those unblock. Delete action on host details (overlaps hosts-details). |
| 27 | team-admin-unable-to-transfer-host-premium | Premium | Team Admin does NOT see the Transfer action on a host | MERGE | `tests/e2e/premium/hosts/host-transfer-permissions.spec.ts` | Negative role case. **Needs team-admin static user (missing).** |

## Summary

- **Counts: DUP 0, AUGMENT 0, NEW 13, CUT 1, MERGE 13** (27 total)

### NEW specs recommended (proposed paths)
- `tests/e2e/shared/hosts/add-hosts-download.spec.ts` — Add Hosts modal Advanced-tab downloads (cert / enroll secret / flagfile). [flows 1, 9]
- `tests/e2e/shared/hosts/labels-crud.spec.ts` — custom-label create/edit/delete (serial), incl. special-char name case. [flows 2, 14, 15]
- `tests/e2e/shared/hosts/export-csv.spec.ts` — Export hosts CSV. [flows 4, 18]
- `tests/e2e/shared/hosts/edit-columns.spec.ts` — hide/show "User email" column. [flows 7, 24]
- `tests/e2e/shared/settings/host-status-webhook.spec.ts` — global host-status webhook enable/config/persist. [flows 3, 17]
- `tests/e2e/free/hosts/cta-visibility.spec.ts` — CTA visibility by role, free (admin positive + observer negative), incl enroll-secret lifecycle. [flows 5, 6]
- `tests/e2e/premium/hosts/cta-visibility.spec.ts` — CTA visibility by role, premium (admin + maintainer positive, observer negative). [flows 19, 21, 23]
- `tests/e2e/premium/hosts/bulk-transfer.spec.ts` — bulk-select + transfer, "select all matching", team typeahead, unhappy-path. [flows 12, 10, 25]
- `tests/e2e/premium/hosts/bulk-delete.spec.ts` — bulk delete with filters (destructive — see caveat). [flow 11]
- `tests/e2e/premium/hosts/host-transfer-permissions.spec.ts` — single-host transfer by role (admin/maintainer can, team-admin can't). [flows 20, 22, 27]
- `tests/e2e/premium/hosts/host-delete-permissions.spec.ts` — team-admin host delete (blocked — see gaps). [flow 26]
- `tests/e2e/premium/settings/team-host-status-webhook.spec.ts` — team-level host status webhook + host-expiry tooltip (blocked — needs team-admin). [flow 16]
- `tests/e2e/premium/dashboard/automations-activity.spec.ts` — activity-feed automations enable/disable/edit + activity assertions. [flow 8 — REASSIGN to dashboard cluster]

### Notable CUTs
- **create-a-team-from-transfer-hosts-modal (13)** — the whole flow creates and then deletes a team in the test body, which our gitops model forbids; nothing salvageable as a spec beyond asserting the "Create a fleet" link exists in the transfer modal (fold into bulk-transfer). Everything else (create team → assign → delete team) is off-limits.
- Cross-flow cruft dropped everywhere (not standalone CUTs but do-not-port): hardcoded `fleet+GlobalAdminN@qawolf.email` accounts, the "DO NOT DELETE THIS SECRET" guard + clipboard round-trip, `addHostsToTeam`/host-provisioning, `waitForTimeout`, `.Select-*`/`:below()`/`tbody tr:has-text()` selectors, `waitForPageLoad`.

### POM / helper work required (substantial — HostsListPage must grow well beyond its current 61 lines)
- **HostsListPage — Add Hosts modal**: open modal, Advanced tab, "Plain osquery" platform dropdown, download buttons (Fleet certificate, enroll secret, flagfile), "Manage enroll secret" modal (add secret, read value, delete secret + confirm), "Add label" entry from the label filter.
- **HostsListPage — export**: `exportHosts()` returning the CSV download; CSV-read helper (or reuse an existing download util).
- **HostsListPage — edit columns**: open "Edit columns" modal, toggle a column by its label, save, assert column header present/absent (`.device_mapping__header` for User email).
- **HostsListPage — bulk select / transfer / delete**: header select-all checkbox (`checkbox-unchecked-icon`), row checkboxes, "Select all matching hosts" affordance, transfer icon (`transfer-icon`), bulk Delete button, `.delete-host-modal` confirm, results-count reader, host-count reader (`div[class*="count"] span`). Toasts: "Hosts successfully transferred to X.", "Hosts successfully removed", "Hosts successfully deleted".
- **Transfer modal component** (new, reusable): "Select a fleet" react-select trigger, option selection (`dropdown-option` testid), team typeahead/search input, Transfer button, "Create a fleet" link. Reuse `transferHosts`/`transferHostsByFilter` from `helpers/api/hosts.ts` for preconditions/cleanup.
- **Labels CRUD** (extend LabelsPage or add to HostsListPage): create label via label-filter "Add label" (SQL `#query`, name `#name`, Save), filter-pill pencil/trash icons, delete-label confirm modal, label-filter selected-option + tooltip assertions. LabelFilter component already exists for selecting.
- **IntegrationsPage** (very thin today): host-status webhook subpage — enable toggle (`enableHostStatusWebhook`), destination URL (`#destination_url`), percentage dropdown, days dropdown, Save + persistence-after-reload. Team-level variant: team settings host-status webhook fields + host-expiry tooltip/help/disabled input.
- **DashboardPage** already has `expectActivities()` + activity feed; needs an "Automations" modal accessor for flow 8 (out of scope — note for dashboard cluster).
- Reusable components already present and fine to reuse: `DataTable`, `TeamDropdown`, `StatusFilter` (has `selectByName` for New/Online/All hosts), `LabelFilter`, `Toast`, `Pagination`, `Navbar`.

### Role-model / infra gaps
- **No team-admin static user.** `static-users.ts` has global roles + `ws-maintainer`/`ws-observer` (fleet-scoped), but no team-**admin**. Blocks flows 16, 26, 27 (team-level webhook, team-admin delete, team-admin can't-transfer). Provision a `ws-admin`-style static user or mark these blocked.
- **Cannot provision hosts.** Flows lean on `addHostsToTeam` to create hosts on demand; our suite has no such helper and relies on already-enrolled hosts. Any flow that needs a specific/guaranteed host must drop that assumption.
- **Destructive bulk-delete (flow 11) + team-admin delete (flow 26)** remove real enrolled hosts with no re-enroll path. Viability question — may need to be quarantined, run against a disposable/loadtest instance, or reframed as API-only. Flag prominently.
- **Team create/delete in bodies** (flows 12, 13) and **arbitrary QA Wolf teams** (Turkeys, Swans, Ducks, Geese, Pigeons) — none exist on our instances (only Workstations / QA / Unassigned). All transfer specs must rework to Workstations↔Unassigned using the existing API transfer helpers; no create/delete of teams in test bodies.
- **`DESTINATION_URL` env var** used by webhook flows — needs a stable placeholder URL or documented env var per `.env.example`.

### Open questions for the human
1. **Shared vs. explicit free/premium split** for the tier-agnostic host-list features (add-hosts-download, export-csv, edit-columns, labels-crud). They're byte-identical across tiers, so I proposed `shared/`; your documented preference leans to explicit `free/`+`premium/` duplication. Which way for these four?
2. **team-admin static user** — add one (so flows 16/26/27 can run), or drop those flows for now?
3. **Bulk-delete (11) & team-admin delete (26)** destroy real hosts. Acceptable on the QA instance, or should these be API-only / gated to a disposable instance? How do hosts get re-enrolled afterward?
4. **Flow 8 (activity-feed automations)** is filed under hosts but is a dashboard/automations feature — reassign to that cluster?
5. **Host-status webhook** — does it live under a `hosts/` area or `settings/`? I placed it under `settings/` since it's a Settings→Integrations page; confirm.
6. **Enroll-secret management** (add/copy/delete) is currently bundled inside the CTA-visibility flows — keep it there, or split into its own `enroll-secret.spec.ts`?
