# Policies — audit

Existing coverage read:
- `tests/e2e/premium/policies/policies.spec.ts` — serial CRUD (create/edit/delete + dashboard activity feed) across `All fleets` + `Workstations`.
- `tests/e2e/free/policies/policies.spec.ts` — same CRUD, no dropdown.
- POMs: `PoliciesListPage` (add/openPolicy/deletePolicy/bulk-delete/search/teamDropdown/toast/`applyAutomationFilter` via URL param), `PolicyEditPage` (new+edit form, Ace SQL via `setSql`, platform checkboxes, save-new modal, `saveExisting`), `PolicyDetailsPage` (name/desc/resolution, Show query, Edit policy; **no Run button, no automations, no compat badge exposed**).
- `helpers/activity-copy.ts` `activityCopy.policy.{created,edited,deleted}` (fleet-suffix aware).
- API role-access: `helpers/api/role-access.ts` already probes `createPolicy`/`listPolicies` global + fleet-scoped; exercised in `tests/api/role-access/**`.
- UI role harness: `withStaticUser(browser, key, fn)` in `helpers/auth.ts`. Static users: global-admin/maintainer/observer(+plus/technician), ws-maintainer, ws-observer. **No team-admin static user.**

## Disposition table
| # | QA Wolf flow (basename) | Tier | Behavior (1 line) | Disposition | Target (existing or proposed path) | Notes |
|---|---|---|---|---|---|---|
| 1 | global-admin-create-edit-and-delete-custom-policy | Free | Custom-policy create/edit/delete + toasts | DUP | `tests/e2e/free/policies/policies.spec.ts` | Existing CRUD covers at greater depth (activity feed, field re-verify). |
| 2 | global-admin-able-to-select-a-policy-and-see-ctas-to-run-and-save | Free | Details page shows Show/Run/Edit CTAs | MERGE [CTAs] | AUGMENT `free/policies/policies.spec.ts` details step | Graft `Run policy`/`Show query`/`Edit policy` visibility onto existing details verify. |
| 3 | global-maintainer-able-to-create-an-os-specific-policy | Free | Create macOS-only policy, verify it shows on a host's Policies tab, delete | MERGE [OS-specific] | NEW `tests/e2e/free/policies/os-specific-policy.spec.ts` | Single-platform target + host↔policy linkage. Role=global-maintainer. Host-dependent. |
| 4 | global-admin-create-failing-policy-webhook | Free | Enable policy automations, set webhook URL, enable per-policy webhook via automation cell | MERGE [Automations] | NEW `tests/e2e/free/policies/policy-automations.spec.ts` | Needs automations-modal + per-policy automation POM. |
| 5 | global-observer-unable-to-perform-actions-on-policy-page-premium | Free | Observer: no Add/Manage-automations/Run/Save/checkboxes | MERGE [Role-neg] | NEW `tests/e2e/free/policies/role-permissions.spec.ts` | Maps to `global-observer` static user. (File mislabeled "premium".) |
| 6 | hosts-policies-table-links-to-all-hosts-filtered-by-selected-policy | Free | Host details Policies tab → "View all hosts" → Hosts filtered by policy | MERGE [Links-hosts] | NEW `tests/e2e/free/policies/links-to-hosts.spec.ts` | Host-dependent. |
| 7 | policies-link-to-all-hosts-filtered-by-selected-policy | Free | Policies list "N hosts" count link → Hosts filtered by policy | MERGE [Links-hosts] | NEW `tests/e2e/free/policies/links-to-hosts.spec.ts` | Host-dependent (needs a policy with host counts). |
| 8 | unable-to-create-policy-without-platform-selected | Free | Save-policy modal disables Save when no platform checked | MERGE [SQL-validation] | NEW `tests/e2e/free/policies/sql-validation.spec.ts` | Fold as sub-test. |
| 9 | verify-sql-statement-for-platform-compatibility | Free | Compat badge: invalid table→"No platforms", no tables→4 platforms, macOS-only table→macOS | MERGE [SQL-validation] | NEW `tests/e2e/free/policies/sql-validation.spec.ts` | Subset of premium #30. |
| 10 | disable-failing-policies-automation | Premium | Toggle policy-automations off then back on ("Other workflows" modal) | MERGE [Automations] | NEW `tests/e2e/premium/policies/policy-automations.spec.ts` | Mutates + reverts global automation config. |
| 11 | ability-to-save-policies-with-bad-sql-statements... (.ts) | Premium | Save policy with bad SQL (syntax error shown) is allowed; persists on reopen | MERGE [SQL-validation] | NEW `tests/e2e/premium/policies/sql-validation.spec.ts` | The "false-positives" case; overlaps #30 syntax sub-test. |
| 12 | empty-automation-state-prompts-to-create-an-integration | Premium | Ticket radio → "You have no integrations" → "Add integration" → /settings/integrations | NEW | NEW (sub-test of) `premium/policies/policy-automations.spec.ts` | Premium-only. |
| 13 | global-admin-able-to-select-a-policy-and-see-ctas-to-run-and-save | Premium | Details shows Run/Save (via Edit) | MERGE [CTAs] | AUGMENT `premium/policies/policies.spec.ts` | Tier pair of Free #2. |
| 14 | global-admin-automates-a-global-policy-premium | Premium | Enable automations + webhook radio + destination URL (global scope), verify persisted | MERGE [Automations] | NEW `premium/policies/policy-automations.spec.ts` | Global (All fleets) scope. |
| 15 | global-admin-automates-team-policy-webhook-premium | Premium | Same but team scope (Pigeons, fleet_id=3) | MERGE [Automations] | NEW `premium/policies/policy-automations.spec.ts` | Remap Pigeons→Workstations. |
| 16 | global-admin-create-edit-and-delete-custom-policy | Premium | Custom CRUD + toasts | DUP | `tests/e2e/premium/policies/policies.spec.ts` | Existing CRUD superset. |
| 17 | global-admin-create-edit-and-delete-default-policy | Premium | "Default" policy = Add policy → Save blank template, CRUD | CUT | — | Doesn't exercise the real policy-library templates; just an empty policy → identical to CRUD (#16). |
| 18 | global-admin-creates-edits-and-deletes-team-policy-premium | Premium | Team CRUD (Swans) + assert policy invisible in other team (isolation) | AUGMENT | `premium/policies/policies.spec.ts` | Existing spec does Workstations CRUD; add the **cross-team isolation** assertion. Needs a 2nd team. |
| 19 | global-maintainer-able-to-create-an-os-specific-policy | Premium | macOS-only policy shows on host Policies tab (Unassigned scope) | MERGE [OS-specific] | NEW `premium/policies/os-specific-policy.spec.ts` | Role=global-maintainer. |
| 20 | global-maintainer-able-to-select-a-policy-and-see-ctas...premium | Premium | Maintainer sees Run + Save CTAs | MERGE [CTAs] | AUGMENT `premium/policies/policies.spec.ts` (role variant) | Maps to global-maintainer. |
| 21 | global-maintainer-creates-edits-and-deletes-team-policy-premium | Premium | Team CRUD + isolation as maintainer | MERGE [Role-CRUD] | AUGMENT `premium/policies/policies.spec.ts` (role loop) | ~DUP of admin CRUD; only auth differs (already API-probed). Maps to global-maintainer. |
| 22 | global-maintainer-manage-automations-permissions-on-policy-page-premium | Premium | Automation-type filter ("All automations") options differ by scope (global hides Software/Scripts/Calendar; team enables them) | MERGE [Automation-perms] | NEW `premium/policies/automation-type-filter.spec.ts` | Mislabeled — about the *filter dropdown*, not the manage-automations button. |
| 23 | global-observer-unable-to-perform-actions-on-policy-page-premium | Premium | Observer: no Add/Manage/Run/Save/checkboxes | MERGE [Role-neg] | NEW `premium/policies/role-permissions.spec.ts` | Tier pair of Free #5; `global-observer`. |
| 24 | hosts-policies-table-links-to-all-hosts-filtered-by-selected-policy | Premium | Host details → View all hosts → filtered Hosts (status-pill title) | MERGE [Links-hosts] | NEW `premium/policies/links-to-hosts.spec.ts` | Host-dependent. |
| 25 | non-fma-apps-dont-support-patch-policy | Premium | Upload custom package, assert Software Actions has no "Patch" option | CUT | — (belongs to **software** cluster) | Not a policies flow — it's the software title Actions dropdown. Hand off to software audit. |
| 26 | policies-link-to-all-hosts-filtered-by-selected-policy | Premium | Policies list host-count link → filtered Hosts | MERGE [Links-hosts] | NEW `premium/policies/links-to-hosts.spec.ts` | Host-dependent. |
| 27 | populate-policy-description-and-resolution-using-ai-macos | Premium | Enable Generative-AI setting; Autofill Description + Resolution in save-new modal | NEW | NEW `premium/policies/ai-autofill.spec.ts` | External LLM dependency; toggles org-level AI setting. |
| 28 | run-policy-and-verify-sort-is-case-insensitive | Premium | Run policy live; verify Host-column sort is case-insensitive | MERGE [Run-live] | NEW `premium/policies/run-live.spec.ts` | HOST-DEPENDENT + flaky; low priority. |
| 29 | team-admin-able-to-create-and-delete-an-os-specific-policy-premium | Premium | macOS-only policy on host tab, as **team admin** | MERGE [OS-specific] | NEW `premium/policies/os-specific-policy.spec.ts` | **No team-admin static user** — role gap. |
| 30 | team-admin-automates-a-team-policy-premium | Premium | Automate team policy as team admin | MERGE [Automations] | NEW `premium/policies/policy-automations.spec.ts` | **team-admin gap.** |
| 31 | team-admin-creates-edits-and-deletes-team-policy-premium | Premium | Team CRUD + isolation as team admin | MERGE [Role-CRUD] | AUGMENT `premium/policies/policies.spec.ts` | **team-admin gap**; else ~DUP. |
| 32 | team-maintainer-creates-edits-and-deletes-policy-premium | Premium | Team CRUD as team maintainer | MERGE [Role-CRUD] | AUGMENT `premium/policies/policies.spec.ts` | Maps to `ws-maintainer`. ~DUP of admin CRUD. |
| 33 | team-maintainer-unable-to-click-manage-automations-button-on-policy-page-premium | Premium | Team-scope header shows team + "All automations" visible (thin positive) | MERGE [Automation-perms] | NEW `premium/policies/automation-type-filter.spec.ts` | `ws-maintainer`. Weak assertion. |
| 34 | team-observer-unable-to-add-a-policy-or-manage-automations-on-the-policies-page-premium | Premium | Team observer: no Add / no Manage automations | MERGE [Role-neg] | NEW `premium/policies/role-permissions.spec.ts` | `ws-observer`. |
| 35 | team-observer-unable-to-run-or-edit-a-policy-premium | Premium | Team observer: no Run/Save on details, no row checkboxes | MERGE [Role-neg] | NEW `premium/policies/role-permissions.spec.ts` | `ws-observer`. |
| 36 | unable-to-create-policy-without-platform-selected | Premium | Save-policy modal Save disabled when no platform | MERGE [SQL-validation] | NEW `premium/policies/sql-validation.spec.ts` | Tier pair of Free #8. |
| 37 | verify-pass-fail-percentage-on-live-policy | Premium | Run policy live; verify pass/fail % + host counts vs tooltip | MERGE [Run-live] | NEW `premium/policies/run-live.spec.ts` | HOST-DEPENDENT + flaky; low priority. |
| 38 | verify-sql-statement-for-platform-compatibility | Premium | Compat badge across 6 cases incl. syntax-error(save still enabled), CTE tables ignored, macadmins ext | MERGE [SQL-validation] | NEW `premium/policies/sql-validation.spec.ts` | Superset — canonical source for the SQL-validation spec. |

## Summary
- Counts: DUP 2, AUGMENT 1, NEW 3, CUT 2, MERGE 32
  - (MERGE flows collapse into 8 groups → ~10 spec files. "NEW" as a standalone disposition = single-flow gaps: empty-automation #12, AI-autofill #27; plus #17/#25 CUT.)

- **NEW specs recommended** (proposed paths):
  - `tests/e2e/{premium,free}/policies/sql-validation.spec.ts` — platform-compatibility badge, "save invalid/bad-SQL for false-positives" (Save stays enabled on syntax error), and "Save disabled when no platform selected". Premium #38 is the superset; #8/#9/#11/#36 fold in.
  - `tests/e2e/{premium,free}/policies/policy-automations.spec.ts` — "Other workflows" modal: enable/disable policy automations, webhook + ticket radios + destination URL, per-policy webhook via the row automation cell, and (premium only) the empty-integration → "Add integration" prompt. Covers flows #4,#10,#12,#14,#15,#30.
  - `tests/e2e/{premium,free}/policies/links-to-hosts.spec.ts` — Policies-list host-count link AND host-details Policies-tab "View all hosts" both land on Hosts filtered by that policy. Flows #6,#7,#24,#26.
  - `tests/e2e/premium/policies/os-specific-policy.spec.ts` (+ free variant) — single-platform (macOS-only) policy appears on a host's Policies tab. Flows #3,#19,#29.
  - `tests/e2e/premium/policies/role-permissions.spec.ts` (+ free) — observer negatives (no Add/Manage/Run/Edit/checkboxes), global + ws-observer. Flows #5,#23,#34,#35.
  - `tests/e2e/premium/policies/automation-type-filter.spec.ts` — "All automations" filter options (Software/Scripts/Calendar) enabled per scope/role. Flows #22,#33.
  - `tests/e2e/premium/policies/ai-autofill.spec.ts` — Generative-AI Autofill of Description + Resolution. Flow #27.
  - `tests/e2e/premium/policies/run-live.spec.ts` — Run policy live → pass/fail % + case-insensitive host sort. Flows #28,#37. **Host-dependent; defer to the host-dependent roadmap.**

- **AUGMENTs to existing `policies.spec.ts`:** add CTA-visibility (Show/Run/Edit) assertions to the details step (#2,#13,#20); add a cross-team isolation assertion to the premium team CRUD (#18); the role-CRUD positives (#21,#31,#32) are largely DUP of the admin CRUD (authorization already covered by API role-access probes) — at most a light role loop over the existing serial CRUD, not new specs.

- **Notable CUTs:**
  - #17 default-policy CRUD — the flow never picks a real policy-library template; it just adds an empty policy and runs the same create/edit/delete as #16. Redundant.
  - #25 non-fma-apps-dont-support-patch-policy — not a policies flow at all; it uploads a custom package and checks the *software title* Actions dropdown for "Patch". Belongs to the software cluster — hand off.

- **POM / helper work required:**
  - **New `PolicyAutomationsModal`** (component): "Automations" button → "Other workflows" modal; enable/disable slider (`.fleet-slider`); `webhook-radio-btn` / `ticket-radio-btn`; destination-URL input (placeholder `https://server.com/example`); empty-integration state ("You have no integrations." + "Add integration" link); toast "Successfully updated policy automations."
  - **`PoliciesListPage`**: (a) open a row's automation cell / "Add automation" and toggle the per-policy webhook checkbox in the per-policy manage-automations modal; (b) the **automation-type filter dropdown** UI ("All automations" → Software/Scripts/Calendar with enabled/disabled + per-scope availability) — today only the URL-param `applyAutomationFilter` exists.
  - **`PolicyEditPage`**: expose the platform-compatibility badge (`.platform-compatibility` text + `.compatible-platform` icon set per OS), the SQL syntax-error label ("Syntax error. Please review before saving.") with Save-stays-enabled, the save-new modal's disabled-Save-when-no-platform state, and the AI **Autofill** buttons for Description/Resolution.
  - **`PolicyDetailsPage`**: add a Run-policy button + navigation into the live-run flow (currently only Show query / Edit exposed).
  - **Live-run POM**: `ReportLivePage` only asserts the "Select targets" heading — reading live results (results-count, `.query-results__results-pass-fail-pct`, Host-column sort, "Policy finished") is a gap. Reuse/extend for policies.
  - **`HostDetailsPage`**: Policies tab + per-policy "View all hosts" link. **`HostsListPage`**: assert the "filtered by <policy>" status pill (`[aria-label="hosts filtered by NAME"]` / status-button title) + Pass/Fail status dropdown.
  - **Org-settings Advanced POM**: toggle "Disable generative AI features" (needed by the AI-autofill spec).

- **Role-model / infra gaps:**
  - **No team-admin static user** — flows #29,#30,#31 (team-admin OS-specific / automate / CRUD) cannot run. Recommend adding a `ws-admin` static user (Workstations admin) to `helpers/api/static-users.ts`, or folding those into global-admin coverage.
  - **Team-create reliance / ad-hoc teams**: flows lean on Swans/Ducks/Geese/Pigeons/Virtual Machines and hardcoded `fleet_id` (3/4/5). Remap to `Workstations` / `Unassigned`. Cross-team **isolation** assertions (#18,#21,#31,#32) need two teams; our model has Workstations + Unassigned + QA — pick a stable second scope.
  - **Shared-state mutation**: policy-automations flows flip global/team automation config and revert; AI flow toggles the org-level Generative-AI setting. Both are global mutations risky under parallel workers — scope to Workstations where possible and verify `cleanup.steps.ts` resets automation/webhook config (it wipes policies, but automation-integration + AI settings may persist).
  - **Host dependency**: OS-specific, links-to-hosts, and run-live specs all need real enrolled hosts with the right platform + pass/fail data — inherently flaky; align with the existing host-dependent testing roadmap.

- **Open questions for the human:**
  1. Add a `ws-admin` (team-admin) static user, or drop the 3 team-admin-specific flows as redundant with global-admin + API role-probes?
  2. Does `cleanup.steps.ts` reset policy-automation webhook/integration config and the org-level Generative-AI setting? If not, the automations + AI specs need their own teardown.
  3. Author the live-run pass/fail% + case-insensitive-sort specs now, or defer to the host-dependent roadmap (they need stable enrolled hosts)?
  4. Is the automation-type filter (Software/Scripts/Calendar options) premium-only? Confirm the free-tier behaviour before splitting tiers.
  5. Confirm #25 (non-fma patch policy) is reassigned to the software cluster audit.
