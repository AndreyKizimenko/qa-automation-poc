# Batch E — Role-based UI visibility

**41 gaps → about 30 tests, in seven role matrices.** `Policies` · `Reports` · `Host details` · `Hosts list` ·
`Labels` · `Scripts` · `Dashboard`

**Status: ready for review** (planned 2026-10-01).

> ## ▶ Start here
>
> **Branch from current `main`** (batches A and B merged with
> [PR #82](https://github.com/AndreyKizimenko/qa-automation-poc/pull/82)).
> **Invoke the `playwright-test-author` skill first** (Skill tool) and follow it. Then read, in order:
> [README.md](README.md) §4–§5 (how a round-3 batch runs; rules new since round 2), round 2's
> [README §9](../round-2/README.md#9-working-a-batch-since-d), `playwright/CLAUDE.md` (the cleanup pipeline;
> the static users under **Env vars**; the login throttle under **API access**), then this file, then
> [A](A-settings-users-labels.md)'s and [B](B-policy-report-software-forms.md)'s *What landed*, which built the
> admin half of five of this batch's rows.
>
> **What this batch is.** Round 1 merged QA Wolf's one flow per role per tier per page into role specs for
> policies and reports. **Those specs were never written**, so the MERGE rows pointing at them counted as
> covered and weren't. The API side is covered: `tests/api/role-access/**` proves allow and deny per endpoint.
> What each role is **shown** isn't. You're building one matrix per area, with the role as a dimension,
> instead of 41 flows.
>
> **Build every cell from §2**, which reads what each role is shown from Fleet's permission checks, not from
> the QA Wolf flows' text (which is often stale). Re-check a cell against the live page before you build it.
>
> Facts below were checked on 2026-10-01 against `main` (d55846a) and Fleet `rc-minor-fleet-v4.93.0`, the
> build both instances run.
>
> **Since batches A and B (2026-10-03, re-checked against `main` da2aceb).** What applies here:
>
> - **The overlapping rows now meet built specs** (finding 6, §6, decision 3). B wrote a fleet's
>   failing-policies webhook on a throwaway `pw-*` fleet, report automations on/off on All fleets, and Save
>   as new into Workstations; A wrote Workstations' enroll secrets under a snapshot restore. Each as admin.
>   On Workstations, a role write of the enroll secrets races A's restore, and one of the fleet's webhook races
>   `team-host-status-webhook.spec.ts` (§6).
> - **[#54619](https://github.com/fleetdm/fleet/issues/54619):** saving a fleet's policy automations replaces
>   its whole `webhook_settings`. `team-admin` can't reach a `pw-*` fleet, so C3 #30's write has no safe fleet
>   (decision 7).
> - **The report edit form refills itself** after *Edit report*: load it afresh with `reportEdit.gotoEdit(id)`
>   and wait for the saved values before editing (P21, P26, P30).
> - **A toast doesn't prove a second save**: poll the stored state through the API (`expect.poll`).
> - **An absence check passes on a closed menu**: assert an option that is there before one that isn't.
> - **Cell labels move under you**: a policy row's Automations cell is named from the *global* webhook's
>   state, and a report's reads On / Off / Paused (Traps).
> - **A timed-out test skips its `finally`**: what a spec creates is removed in an `afterEach` (§5).
> - **`--repeat-each` on a serial describe that writes global config needs `--workers=1`.**
> - **Building beside another batch:** announce each instance run, and wait for a "go" before a run with
>   dependencies (`cleanup-setup` wipes global reports and policies and Workstations' policies).

## The gaps

| Gap | What's untested today | Proposed target | Kind | Source flow |
|---|---|---|---|---|
| round 1 C1 #6 | free observer: no Add label | `free/hosts/cta-visibility.spec.ts` | augment | `flows-Free/hosts-global-observer-cant-see-and-click-cta-buttons-free.flow.js` |
| round 1 C1 #21 | global maintainer: Add label | `premium/hosts/cta-visibility.spec.ts` | augment | `flows-Premium/hosts-global-maintainer-can-see-and-click-cta-buttons.flow.js` |
| round 1 C2 #3 | free: a global maintainer runs a live report on a host | role matrix | new | `flows-Free/hosts-details-global-maintainer-able-to-custom-query-host.flow.js` |
| round 1 C2 #13 | as round 1 C2 #3, premium | role matrix | new | `flows-Premium/hosts-details-global-maintainer-able-to-custom-query-host.flow.js` |
| round 1 C3 #5 | free observer: the policy page offers no Add / Manage automations / Run / Save / checkboxes (API deny only) | role matrix: policies | new | `flows-Free/policies-global-observer-unable-to-perform-actions-on-policy-page-premium.flow.js` |
| round 1 C3 #23 | as round 1 C3 #5, premium | role matrix: policies | new | `flows-Premium/policies-global-observer-unable-to-perform-actions-on-policy-page-premium.flow.js` |
| round 1 C3 #20 | global maintainer sees a policy's Run / Edit CTAs | role matrix: policies | new | `flows-Premium/policies-global-maintainer-able-to-select-a-policy-and-see-ctas-to-run-and-save-premium.flow.js` |
| round 1 C3 #21 | global maintainer: fleet policy CRUD in the UI | role matrix: policies | new | `flows-Premium/policies-global-maintainer-creates-edits-and-deletes-team-policy-premium.flow.js` |
| round 1 C3 #22 | global maintainer: the automation-type filter's options by scope — but the options depend on scope, not role (`ManagePoliciesPage.tsx:105-118`) | review: a scope check in a policies list spec, or cut | review | `flows-Premium/policies-global-maintainer-manage-automations-permissions-on-policy-page-premium.flow.js` |
| round 1 C3 #30 | team admin automates a fleet policy | role matrix: policies | new | `flows-Premium/policies-team-admin-automates-a-team-policy-premium.flow.js` |
| round 1 C3 #31 | team admin: fleet policy CRUD | role matrix: policies | new | `flows-Premium/policies-team-admin-creates-edits-and-deletes-team-policy-premium.flow.js` |
| round 1 C3 #32 | team maintainer: fleet policy CRUD in the UI (API create only) | role matrix: policies | new | `flows-Premium/policies-team-maintainer-creates-edits-and-deletes-policy-premium.flow.js` |
| round 1 C3 #33 | team maintainer can't open Manage automations | role matrix: policies | new | `flows-Premium/policies-team-maintainer-unable-to-click-manage-automations-button-on-policy-page-premium.flow.js` |
| round 1 C3 #34 | team observer can't add a policy or manage automations (UI) | role matrix: policies | new | `flows-Premium/policies-team-observer-unable-to-add-a-policy-or-manage-automations-on-the-policies-page-premium.flow.js` |
| round 1 C3 #35 | team observer can't run or edit a policy (UI) | role matrix: policies | new | `flows-Premium/policies-team-observer-unable-to-run-or-edit-a-policy-premium.flow.js` |
| round 1 C4 #F3 | free observer can only select and run a report | role matrix: reports | new | `flows-Free/queries-global-users-global-observer-can-only-select-and-run-a-query.flow.js` |
| round 1 C4 #P9 | global maintainer runs a report | role matrix: reports | new | `flows-Premium/queries-global-users-global-maintainer-able-to-run-query-premium.flow.js` |
| round 1 C4 #P10 | global maintainer selects a fleet as the target | role matrix: reports | new | `flows-Premium/queries-global-users-global-maintainer-able-to-select-teams-target-for-query-premium.flow.js` |
| round 1 C4 #P11 | global observer selects a fleet as the target | role matrix: reports | new | `flows-Premium/queries-global-users-global-observer-able-to-select-teams-target-for-query-premium.flow.js` |
| round 1 C4 #P12 | global observer can only select and run (API deny only) | role matrix: reports | new | `flows-Premium/queries-global-users-global-observer-can-only-select-and-run-a-query.flow.js` |
| round 1 C4 #P16 | Save as new as a user with access to one fleet | role matrix: reports | new | `flows-Premium/queries-global-users-save-as-new-query-user-with-access-to-just-one-team-can-only-save-queries-to-that-team.flow.js` |
| round 1 C4 #P18 | global observer+ creates and runs a report | role matrix: reports | new | `flows-Premium/queries-observer-observer-global-can-create-and-run-a-live-query.flow.js` |
| round 1 C4 #P19 | fleet observer+ creates and runs a report | role matrix: reports | new | `flows-Premium/queries-observer-observer-team-role-can-create-and-run-a-live-query.flow.js` |
| round 1 C4 #P20 | team admin runs a live report on a host | role matrix: reports | new | `flows-Premium/queries-team-users-team-admin-able-to-custom-query-host-premium.flow.js` |
| round 1 C4 #P21 | team admin edits / deletes a report they didn't write | role matrix: reports | new | `flows-Premium/queries-team-users-team-admin-able-to-delete-or-edit-query-not-authored-by-them-premium.flow.js` |
| round 1 C4 #P22 | team admin selects a fleet as the target | role matrix: reports | new | `flows-Premium/queries-team-users-team-admin-able-to-select-teams-target-for-query-premium.flow.js` |
| round 1 C4 #P23 | team admin creates and runs a live report | role matrix: reports | new | `flows-Premium/queries-team-users-team-admin-can-create-and-run-live-query-premium.flow.js` |
| round 1 C4 #P24 | team admin searches and filters inherited reports | role matrix: reports | new | `flows-Premium/queries-team-users-team-admin-can-search-and-filter-by-platforms-and-view-inherited-queries-on-team-query-view-premium.flow.js` |
| round 1 C4 #P25 | team admin can't edit an inherited report | role matrix: reports | new | `flows-Premium/queries-team-users-team-admin-cannot-edit-an-inherited-query-premium.flow.js` |
| round 1 C4 #P26 | team maintainer: reports they didn't write, and inherited ones | role matrix: reports | new | `flows-Premium/queries-team-users-team-maintainer-can-edit-delete-a-team-query-that-they-did-not-author-only-for-queries-on-their-team-premium.flow.js` |
| round 1 C4 #P30 | team admin schedules a fleet report | role matrix: reports | new | `flows-Premium/schedule-team-admin-create-edit-and-remove-teams-scheduled-query-premium.flow.js` |
| round 1 C7 #16 | global observer: host details offers no Transfer or Delete, and the Live report modal lists only `observer_can_run` reports with no create link (the OS card's "Create new policy" no longer exists) | role matrix: host details | new | `flows-Premium/settings-global-observer-cant-click-or-see-cta-buttons-on-hosts-details-page-premium.flow.js` |
| round 1 C7 #21 | team admin: Add hosts and Enroll secrets on the Hosts list | role matrix: hosts | new | `flows-Premium/settings-team-admin-can-see-and-click-cta-buttons-premium.flow.js` |
| round 1 C7 #23 | team maintainer: Add hosts and Enroll secrets | role matrix: hosts | new | `flows-Premium/settings-team-maintainer-can-see-and-click-cta-buttons-premium.flow.js` |
| round 1 C7 #24 | fleet observer (`ws-observer`): no CTAs | role matrix: hosts | new | `flows-Premium/settings-team-observer-cant-see-and-click-cta-buttons-premium.flow.js` |
| round 1 C7 #22 | team admin turns a report's automations on and off | role matrix: reports | new | `flows-Premium/settings-team-admin-can-update-managed-automations-premium.flow.js` |
| round 1 C7 #26 | global maintainer uploads a script to a fleet (UI and the role-access probes) | role matrix: scripts | new | `flows-Premium/settings-upload-script-as-maintainer-to-a-team-premium.flow.js` |
| round 1 C9 #14 | team maintainer creates, edits and deletes a label of their own | `premium/labels/role-access.spec.ts` | augment | `flows-Premium/new-labels-page-team-maintainer-can-create-edit-and-delete-own-labels.flow.js` |
| round 1 C9 #15 | fleet observer filters Hosts by a label | `premium/labels/role-access.spec.ts` | augment | `flows-Premium/new-labels-page-team-observer-can-only-view-labels-and-filter-labels-on-hosts.flow.js` |
| round 2 #49 | dashboard platform cards and filter as a global maintainer — nothing on those cards is role-gated (`DashboardPage.tsx:941-958`) | review: cut, or assert the Activity card instead (global roles only) | review | `Fleet_20260828 (1)/Premium/src/tests/dashboard/display-and-filter-platform-cards-global-maintainer.spec.ts` |
| round 2 #50 | as round 2 #49, as a global observer | review: as round 2 #49 | review | `Fleet_20260828 (1)/Premium/src/tests/dashboard/display-and-filter-platform-cards-global-observer.spec.ts` |

## 1. Review first

Read every flow body; the INDEX row is the audit's summary of it. What the bodies already showed:

| | finding | what to do |
|---|---|---|
| 1 | **C2 #3, C2 #13 and C4 #P20 never run a live report.** They open host details → Actions → Live report, and assert that the *Select a report* modal and its *create a report* link appear. P20 is titled "team admin" but signs in as global admin (`logInAsGlobalAdmin()`), so as written it duplicates `shared/hosts/host-live-query.spec.ts`. | One host-details cell per role: is *Live report* offered, is the create link shown. Any host the role can see; no run, no real VM needed. |
| 2 | **C9 #15 ("fleet observer") signs in as the global observer.** | Decide the cell: `ws-observer` (what the title means) or `global-observer` (what the body does). |
| 3 | **Mislabeled flows.** C3 #33 ("team maintainer unable to click Manage automations") only checks the header shows the fleet and *All automations* is visible. C3 #22 is about the automation-type **filter's options** by scope (All fleets hides Calendar, Software and Scripts; a fleet enables Software and Scripts), not the button. | Build what the body asserts, and ground the cell in the component. |
| 4 | **Twins.** P12 = F3 (tier helper aside); C3 #5 = C3 #23 (byte-identical but the import); C7 #21 ≈ C7 #23 (login and fleet differ). | One cell each, on each tier the role exists on. |
| 5 | **P24 is mostly covered.** Its search and platform-filter steps are `premium/reports/list-filters.spec.ts` as another role; its one new step, "an inherited report has no *Edit report*", is P25. | Fold P24 into P25. |
| 6 | **Overlaps with other batches**: C3 #30 vs [B](B-policy-report-software-forms.md)'s C3 #15 (a fleet's failing-policies webhook); C7 #22 vs B's C4 #P7 (report automations off, the On/Off cell); C7 #21/#23 vs [A](A-settings-users-labels.md)'s C1 #19 (enroll secret add/copy/delete); P16 vs B's C4 #P15 (Save as new's fleet dropdown). A and B built the admin half of each: C3 #15 on a throwaway `pw-fleet-webhook-*` fleet (`premium/policies/policy-automations.spec.ts`); P7 on All fleets (free + premium `reports/automations.spec.ts`); C1 #19 on Workstations under a snapshot restore of its whole secret list (`premium/settings/enroll-secrets.spec.ts`); P15 into Workstations (`premium/reports/save-as-new.spec.ts`). | Decide which batch owns each write. The usual answer, and what B's plan says: the form batch (A/B) owns the write as admin; E owns only "this role gets the control". On Workstations, a role write of the enroll secrets or the fleet's webhook races a spec already writing there (§6). |
| 7 | **Low-value CRUD.** P30 (team admin fleet-report CRUD) and C3 #21/#31/#32 (fleet policy CRUD as maintainer, team admin, ws-maintainer). Round 1 called them "~DUP of admin CRUD; only auth differs". | Likely cut P30, or reduce it to a visibility cell. Build **at most one** write test for policies that loops over the write roles. |
| 8 | **P19 needs a fleet-scoped observer+, and none exists.** There's also no single-fleet team admin (`team-admin` holds two fleets), no team technician, and no human gitops user (only `api-global-gitops`), so a gitops UI column isn't possible. | Decision: provision a `ws-observer-plus` human (a one-shot manual step, password from 1Password, as `helpers/api/static-users.ts`'s header describes), or cut P19. |
| 9 | **F3 and P12 run a live report against All hosts** (~300 simulations) and wait up to 180 s for "Report finished", then compare "% responded". A live run finishes only once every online targeted host has answered (`service_campaigns.go:195-197`, no timeout), and simulations answer with the same row whatever the SQL. | Target `liveMacosHost` or a label holding the VMs, and bound the wait. |
| 10 | **`global-technician`** is in no row, but the human user exists. | A cheap extra column in every matrix. Ask whether it's wanted. |
| 11 | **C3 #22 isn't a role property.** The automation-type filter's options depend on the scope, and are the same for every role (`ManagePoliciesPage.tsx:105-118,741-818`). | A scope check in a policies list spec (batch B's area), or cut. |
| 12 | **Round 2 #49 / #50 have nothing to vary.** The platform cards aren't role-gated. | Cut, or replace with the cell that is gated: the Activity card shows for global roles, not team roles. `DashboardPage.activityHeading` / `activityFeedCard` exist (A's `shared/dashboard/activity-feed.spec.ts`, admin only). |
| 13 | **Five UI-vs-API disagreements** (§2): three filed as Fleet bugs (#54622, #54623, #54624), two by design. | Cells on a filed bug assert the intended behaviour and skip with the bug's TODO. |

## 2. What each role sees

Read from Fleet's source at `rc-minor-fleet-v4.93.0` on 2026-10-01. Roles: GA / GM / GO / GO+ / GT are global
admin / maintainer / observer / observer+ / technician; TA / TM / TO / TO+ the fleet versions. **Team flags
follow the `fleet_id` in the URL** (`useTeamIdParam.ts:510-527`); on host details they follow the host's own
fleet (`HostActionsDropdown.tsx:87-96`). Re-check any cell against the live page before you build it.

| area | control | roles that get it | source |
|---|---|---|---|
| **Policies** list | *Add policy*, row checkboxes | GA, GM, TA, TM (team roles on their own fleet) | `ManagePoliciesPage.tsx:397-398` |
| | a row's Automations cell as a button (a plain span for the rest; `PoliciesListPage.automationsCell`) | GA, GM, TA, TM | `:874-875,921-922`; `PoliciesTableConfig.tsx:158-160` |
| | *Manage automations* | GA, TA; disabled when the fleet has only inherited policies | `:400`, `:640-643` |
| | inherited rows | an "Inherited" tag, no checkbox | |
| Policy details | *Edit* | GA, GM; TA / TM on their fleet's policies, **never inherited** | `PolicyDetailsPage.tsx:198-201` |
| | *Run policy* | GA, GM, GT, GO+, TA, TM, TO+ (not GO, TO) | `:210-216` |
| | `/policies/new` | 403 page for GO, GO+, GT, TO | `router/index.tsx:800` |
| **Reports** list | header button | "Add report" for GA, GM, TA, TM; "Live report" for GO+, TO+; nothing for GO, TO, GT | `ManageQueriesPage.tsx:299-304,464` |
| | *Manage automations* | GA; TA on their fleet | `:132`, `:425` |
| | row checkboxes | GA, GM, TA, TM; none on inherited rows, even for GA | |
| Report details | *Edit report* | GA, GM; TA / TM on fleet reports, never inherited. **No authorship check** in the UI or the rego | `QueryDetailsPage.tsx:298-301` |
| | *Live report* | GO / TO only when `observer_can_run`; always for the rest | `:286-293` |
| Save as new | fleet dropdown | only with more than one fleet (ws-maintainer gets a Name-only modal) | `SaveAsNewQueryModal.tsx:197` |
| Live target picker | fleets offered | global roles: Unassigned and every fleet; team roles: their fleets, no Unassigned; GO's fleet pills disabled without `observer_can_run` | `SelectTargets.tsx:546-584,601-607` |
| **Hosts list** | *Add hosts*, gear › *Enroll secrets* | GA, GM, TA, TM | `ManageHostsPage.tsx:248-249,2207` |
| | gear › *Activity automations* | GA, TA | |
| | *Export hosts* | everyone; disabled with no hosts | |
| | **"+" *Add label*** (aria-label "Add label", in the label filter's heading) | GA, GM, GT, TA, TM | `:493-500`; `CustomLabelGroupHeading.tsx:68-76` |
| **Host details** | *Transfer* | GA, GM, GT | `HostActionsDropdown/helpers.tsx` |
| | *Delete*, *Lock*, *Wipe*, *Turn off MDM* | GA, GM, TA, TM | |
| | *Run script* | GA, GM, GT, TA, TM | |
| | *Live report* | everyone; GO / TO's modal lists only `observer_can_run` reports and has **no create link** | `SelectReportModal.tsx:95-107` |
| **Labels** page | *Add label* | GA, GM, GT, TA, TM | `ManageLabelsPage.tsx:90-95` |
| | *Edit* / *Delete* | GA, GM, GT on any label; TA / TM on a label **they authored**, or a team label on their fleet | `LabelsTableConfig.tsx:60-76` |
| **Scripts** (Controls) | the Controls page | 403 for GO, GO+, TO | `router/index.tsx:670-671` |
| | *Add script*, row actions | hidden for technicians | `ScriptLibrary.tsx` |
| **Dashboard** | platform filter, Hosts / Software / MDM cards | **not role-gated** | `DashboardPage.tsx:941-958` |
| | Activity card | global roles only | `:773` |

So C9 #14 holds: a team maintainer edits and deletes a label they wrote. `premium/labels/role-access.spec.ts`
checks a gitops label, which no team role authored. The OS card's "Create new policy" that C7 #16 asserts no
longer exists. Drop it.

**Where the UI and the API disagree.** Reproduced on premium on 2026-10-02: three are Fleet bugs, now filed, and
two are by design. A cell on a filed bug asserts the intended behaviour and skips with `TODO(fleetdm/fleet#N)` and a
row in `docs/blocked-by-product-bugs.md` until the fix lands.

1. **Transfer for a team admin** is hidden (`HostActionsDropdown/helpers.tsx:142-155`), but the API grants
   `transfer_host` to a user who holds the role on both fleets (`policy.rego:405-409`). `team-admin` holds
   Workstations and VMs. **By design:** Fleet's role table marks Transfer for fleet roles as REST API only
   (`articles/role-based-access.md`, the fleet-level table's footnote), so `host-transfer-permissions.spec.ts`'s
   comment stands.
2. **A global technician sees the "create a report" link** in the host Live report modal
   (`SelectReportModal.tsx:99-100`), but `/reports/new` shows them a 403. **Filed:**
   [fleetdm/fleet#54622](https://github.com/fleetdm/fleet/issues/54622).
3. **A team admin on an inherited policy:** the row's automations modal unlocks Ticket / Webhook
   (`PolicyAutomationsFields.tsx:142-147`), and saving writes app config, which answers 403; the modal stays open
   with no error. Only while the global webhook or ticket automation is on. **Filed:**
   [fleetdm/fleet#54623](https://github.com/fleetdm/fleet/issues/54623).
4. **Maintainers and report automations:** no *Manage automations* button (`ManageQueriesPage.tsx:132`), yet the
   API and the edit form's slider let them set `automations_enabled`. Likely by design.
5. **A global observer+ on an Unassigned policy:** *Run* is hidden (`useTeamIdParam.ts:524-527`: `!!currentTeam?.id`
   is false for Unassigned's id 0), though the role table says observer+ runs all policies. **Filed:**
   [fleetdm/fleet#54624](https://github.com/fleetdm/fleet/issues/54624).

## 3. The pattern to copy

**`tests/e2e/premium/software/role-access.spec.ts`**: a typed table, one entry per role
(`RoleCase { key, scope, fleetOptions, assertColumns, canAddSoftware }`), and `for (const role of ROLES) test(…)`,
one test per role, each signed in through `withStaticUser`. Presence is `toBeVisible()`, absence `toHaveCount(0)`.

Add one thing from `premium/hosts/host-transfer-permissions.spec.ts`: **every negative cell also asserts a
control the role does get**. That spec checks *Delete* is visible before checking *Transfer* is absent;
without it, a menu that never rendered passes as "hidden".

- **One test per role** for policies, reports and host details. Each walks several pages, and a failure has
  to name the role rather than hide the roles after it.
- **An in-test loop** where it's one page and one check: the dashboard, and the *Add label* check added to the
  existing `cta-visibility` tests.
- **Writes and live runs are their own tests**, outside the visibility matrix. A failed save inside a matrix
  becomes a cleanup problem; a live run takes 25–90 s (Fleet's rest period) and needs its own `test.setTimeout`.

Other specs that already take a role dimension, and what they assert, so you extend rather than duplicate:

| spec | shape | asserts |
|---|---|---|
| `premium/hosts/cta-visibility.spec.ts` | loop over `ENROLL_ROLES` (admin, maintainer) + an observer test | Add hosts, Export hosts, gear → Enroll secrets; observer: Export only. **No Add label** (C1 #21) |
| `free/hosts/cta-visibility.spec.ts` | admin + observer tests | the same; no Add label (C1 #6) |
| `premium/software/manage-automations-access.spec.ts` | two admin tests + a `NON_ADMINS` table, in-test loop over scopes | Automations absent on every scope |
| `premium/labels/role-access.spec.ts` | three tests (global-observer, ws-maintainer, team-admin) | Add label; row actions on a global label: View all hosts only |
| `premium/hosts/host-transfer-permissions.spec.ts` | `ROLES` loop (admin, maintainer, technician) + a team-admin negative | Transfer works per role; team admin sees Delete, not Transfer |
| `premium/account/my-account.spec.ts` | `MY_ACCOUNT_USERS` loop (8 users) + a `team-admin` tooltip test | email, name, role, fleets; `team-admin`'s Role skipped behind [fleetdm/fleet#54620](https://github.com/fleetdm/fleet/issues/54620) ("Various"); its "2 fleets" tooltip names both (batch A's C10 #10) |
| `premium/settings/team-host-status-webhook.spec.ts` | `team-admin` only | writes Workstations' host-status webhook (C3 #30's neighbour, §6) |

`shared/dashboard/platform-cards.spec.ts` runs as admin only: round 2 A folded the maintainer and observer
flows in and dropped the role dimension, which is why round 2 #49 and #50 are here.

## 4. Users and sign-in

| key | role | tier |
|---|---|---|
| `global-admin`, `global-maintainer`, `global-observer` | global | free + premium (same emails) |
| `global-observer-plus`, `global-technician` | global | premium |
| `team-admin` | admin of **Workstations and VMs** | premium |
| `ws-maintainer`, `ws-observer` | Workstations | premium |

API-only users (no browser sign-in; `withStaticUser` throws for them): `api-global-*` on both tiers; on
premium `api-ws-{admin,maintainer,observer}`, `api-ws-maint-qa-obs`, `api-global-{observer-plus,technician,gitops}`.

- `withStaticUser(browser, key, fn)` (`helpers/auth.ts`) opens a new context per call. The session is cached
  in `.auth/static-<SUITE>-<key>.json`, checked with `GET /me` before reuse, and re-logged-in when dead.
- **Logins are throttled at 10 a minute, burst 9, in one bucket shared by every user and worker.** That's why
  the cache exists. A role costs one login per run; don't design around fresh logins. A throttled UI login
  lands back on `/login`, looking like a wrong password. An API-only login goes through `apiLogin`
  (`helpers/api/users.ts`), which waits out a 429.
- `sessionBearerHeaders(page)` calls the API as the signed-in role, for confirming that a write the role made
  in the UI landed.
- The static users can't be edited or re-minted (their bearer tokens can't be rotated). Read their roles;
  never change them.

## 5. Data each matrix needs

**Correction to a common belief: `cleanup-setup` does not wipe Workstations reports.** `deleteAllQueries`
lists queries with no team id, which returns global ones only (`server/datastore/mysql/queries.go:864`). The
Workstations step resets the setup experience, deletes policies, installable software, profiles and scripts,
and clears OS updates (`setup/cleanup.steps.ts:141-152`). Nothing sweeps Workstations reports.
Global reports and policies, and Workstations policies, are wiped at run start; on premium the VMs sweep removes
`pw-` policies, scripts and profiles there, every `pw-` label, and VMs reports **by exact prefix**
(`pw-run-script-`, `pw-rl-`, `pw-stored-results-`), so a new per-run report on the VMs fleet needs its prefix
added to that list. Throwaway `pw-*` fleets are swept too.

**Durable, read-only:**

- **Workstations reports**: five gitops reports (`collect-default-browser`, `collect-santa-denied-logs`,
  `collect-xprotect-reports`, `detect-apns-certificate`, `detect-apple-intelligence`), authored by no static
  user. Good for "*Edit* shown on a report you didn't write". **Never save or delete them**: gitops owns them.
- **VMs fleet**: report `pw-host-report-results` (gitops; `premium/reports/stored-results.spec.ts` asserts it
  keeps collecting, and no sweep touches it); policies "Claude is installed (macOS/Windows)". Those carry
  `install_software` automations, so read them, never touch them.
- **Labels**: 12 gitops global labels on premium (`gitops/premium-fleetqa/default.yml`), and some on free.

**Created by the spec and removed in an `afterEach`** (a timed-out test skips its `finally`): a global policy
(inherited on a fleet's view), a Workstations policy, a global report with `observer_can_run` (the observer
cells), a Workstations report written by admin (the "someone else's report" cells). Name them `pw-*`. A
Workstations report survives `cleanup-setup` and nothing sweeps it, so delete it yourself, by id, as
`save-as-new.spec.ts` does with its fleet copy.

**Helpers** (`helpers/api/policies.ts`, `reports.ts`): `createPolicy` is global-only; `createFleetPolicy`
creates a fleet's. `createReport` has no `observer_can_run` option (add one). `getReport(request, id)` reads
any report, global or fleet, including `observerCanRun` and `automationsEnabled`. `deleteReportsMatching` lists
global reports only; `listReports(request, fleetId)` and `findReportByName(request, name, fleetId)` read a
fleet's.

**Hosts.** Workstations has **no hosts**, so `ws-maintainer` and `ws-observer` can't open a host's page unless
a simulation is staged onto Workstations and moved back (`host-delete.spec.ts` does that). `team-admin` sees
the VMs fleet (`liveMacosHost`, plus borrowed simulations); global roles see the simulations in Unassigned.
Leave the ws-* roles out of host details, and out of any hosts-list cell that needs a host; Export hosts may
not render on an empty fleet (C7 #24).

## 6. Writes and live runs

| write | rows | rule |
|---|---|---|
| fleet policy create / edit / delete | C3 #21, #31, #32 | one looped test at most (finding 7) |
| a fleet's failing-policies webhook | C3 #30 | **not on Workstations**: a fleet's automations save replaces its whole `webhook_settings` ([#54619](https://github.com/fleetdm/fleet/issues/54619)), which `team-host-status-webhook.spec.ts` writes there as `team-admin`. B wrote it as admin on a throwaway `pw-*` fleet, but `team-admin` holds only Workstations and VMs, and the static users are never re-roled (decision 7). Nothing in cleanup resets a fleet's webhooks |
| report Save as new | P16 | the modal's Fleet field is `ReportEditPage.saveAsNewFleetDropdown` (a `TeamDropdown` scoped to the modal); delete the copy by id in an `afterEach` |
| fleet report edit / delete | P21, P26 | on a spec-created report, never a gitops one. Open it with `reportEdit.gotoEdit(id)` and wait for the saved values before editing: the form refills itself and can overwrite an edit. "Save changes?" shows only for an edit that deletes stored results (`saveExisting({ prompt })`) |
| report automations toggle | C7 #22 | on a spec-owned report only: the flow **unchecks every report on the fleet** first, which would switch off the gitops reports' automations. `ReportsListPage.setReportAutomation(name, on)` touches one; seed the report with an interval, or the cell reads *Paused*; read the cell with `automationsCell(name)`, which matches by content (a column index goes stale when the table re-renders after the save) |
| fleet enroll secret add / delete | C7 #21, #23 | never delete a secret the test didn't add; hosts enroll with the existing ones. `EnrollSecretModal.addGenerated` + `delete(value)`, and a `setTeamEnrollSecrets` snapshot restore in an `afterEach`: for a fleet the modal lists one query and saves from another, so waiting for rows doesn't guard the save. On Workstations it races `premium/settings/enroll-secrets.spec.ts`'s own restore (decision 3) |
| script upload / delete on Workstations | C7 #26 | the Workstations wipe deletes its scripts; `ScriptsLibraryPage.uploadScript` takes a path or an in-memory `{ name, mimeType, buffer }` |
| label create / edit / delete | C9 #14 | Dynamic, named `pw-*` (the flow picks Dynamic or Manual at random; Manual needs a host on the fleet); the VMs sweep removes `pw-` labels on premium |
| live report, saved | F3, P12, P9 | on `liveMacosHost` or the VMs fleet, not All hosts |
| live report, ad hoc | P18, P19, P23 | the same; **drop P23's `addHostsToTeam`** (it transfers hosts into fleets) |

A live query on a real VM only reads, so it's safe there. Nothing in this batch delivers a profile, installs
anything or touches a lock setting.

## Decisions to put to Andrey

1. **P19:** provision a `ws-observer-plus` human user, or cut the row (finding 8).
2. **C9 #15:** `ws-observer` or `global-observer` (finding 2).
3. **Ownership of the overlapping writes** (finding 6). A and B have built the admin half of each, and B's plan
   assumes E owns only "this role gets the control". For C7 #21 / #23, a role write on Workstations' enroll
   secrets races A's snapshot restore there (§6).
4. **P30 and the role CRUD rows** (finding 7): cut, or one looped write test.
5. **A `global-technician` column** in each matrix (finding 10).
6. **C3 #22, round 2 #49 / #50:** cut, or the replacement cells (findings 11, 12).
7. **C3 #30's write** *(new, from A/B learnings)*: `team-admin` can't reach a throwaway `pw-*` fleet, and on
   Workstations the save races `team-host-status-webhook.spec.ts` ([#54619](https://github.com/fleetdm/fleet/issues/54619)).
   Options: the visibility cell only (team admin opens Manage automations on Workstations, sees *Webhooks or
   tickets*, and cancels; B covers the save); a per-run `qa-test-*` user made admin of a `pw-*` fleet (one more
   UI login under the throttle; `cleanup-setup` sweeps both); or the write on Workstations in one serial
   describe with `team-host-status-webhook`'s test.
8. **A `pw-` sweep for Workstations reports** *(new, from A/B learnings)*: nothing removes a Workstations report a
   killed run leaves (this batch's admin-written report; B's Save-as-new copy has the same gap). Add one to
   the Workstations step, by exact prefix like the VMs one, or rely on the `afterEach`?

## Free coverage

`global-admin`, `global-maintainer` and `global-observer` exist on free with the same emails. A global-role cell
goes in `shared/` only once the source read shows the page renders the same on both tiers. Policies and
reports render a fleet picker and premium-only automation options on premium, so plan explicit `free/`
siblings for those. Never branch with `if (isPremium)`. The rows that name free (C1 #6, C2 #3, C3 #5, C4 #F3)
are the minimum, not the ceiling.

## Traps this batch will hit

- **A negative assertion on a page that didn't render** passes. Anchor every absence on a presence (§3). The
  same goes for a menu: after opening a `TeamDropdown` (Save as new's Fleet field) or a row's actions, assert
  an option that's there before one that isn't, or the check passes on a menu that never opened.
- **A policy row's Automations cell is named from the global failing-policies webhook's state**: "Edit
  automation: Webhook" while it's on, "Add automation" once it's off, even though the policy is still in
  `policy_ids`. `policy-automations.spec.ts`'s serial describe turns that webhook on and off from another
  worker. Assert the cell as a button or as absent (`PoliciesListPage.automationsCell` matches every name), never
  its label. A cell that needs the global webhook on ([#54623](https://github.com/fleetdm/fleet/issues/54623)'s)
  writes `webhook_settings.failing_policies_webhook`, and a write to that key from another file races the serial
  describe.
- **A report's Automations cell reads On / Off / Paused**; Paused is automations on with interval 0.
- **Copy in the flows is stale.** QA Wolf matched text like "Manage Automations" and "Add a policy". Take
  names from the component, and match the accessible name, not the visible label.
- **The login throttle** (§4): ten roles × two tiers × fresh logins would trip it; the session cache doesn't, so
  go through `withStaticUser`.
- **Lists page at 20, and other specs crowd them.** Search to your own `pw-*` record before reading a row's
  controls.
- **"Inherited"** means a global policy or report seen from a fleet's view. It renders only when a global one
  exists, so create it; `cleanup-setup` drained them at run start.

## Done when

- Every cell in the matrices traces to §2, re-checked against the live page (and §2 corrected where it was
  wrong).
- Each review decision is in the gap table (build / fold / cut / long-term, with a reason), and the open
  questions above have Andrey's answer.
- One role-dimensioned spec per area (policies, reports, host details) plus the hosts-list, labels, scripts and
  dashboard cells, on every tier the role exists on.
- Every write and live run is its own test, cleans up in an `afterEach`, and is confirmed through the API as the
  signed-in role.
- `npm run check` clean. Each spec run with dependencies on its tiers, and once headed. Anything with a live run
  `--repeat-each=5 --workers=2`.
- `playwright-test-reviewer` run on the branch's diff, findings fixed or answered.
- Docs in the same commits: this file's *What landed*, a [DELIVERY-LOG](../DELIVERY-LOG.md) line, a
  [test-audit](../../test-audit/README.md) entry per `test()`, `helpers/README.md` for the new helpers, and this
  round's [README](README.md) batch table and [INDEX](INDEX.md).
- PR open, Andrey told it's ready for its branch run.

## What landed

*Nothing yet.*
