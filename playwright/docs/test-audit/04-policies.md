# Policies (free + premium) — test audit

**Specs covered:** 13 files · **Test declarations:** 42 · **Projects:** premium / free / premium-exclusive

Policies are saved osquery queries with a pass/fail contract per host, managed at
`/policies/manage` (list, team scope, automations) with a query editor at
`/policies/new` + `/policies/:id/edit` and a results page at `/policies/:id`. Each tier's
`policies/` folder holds the same three spec files, and premium and free carry
near-identical copies of most of what is in them; entries are paired premium-then-free so
the duplication is visible:

- `policies.spec.ts` — a serial CRUD lifecycle (create → edit → delete → activity feed);
  premium adds fleet isolation (POL-31).
- `policy-automations.spec.ts` — a **serial** two-test describe on the global
  failing-policies webhook (enabled, sent for one policy and turned off again, and the
  form's in-flight lock), one policy's own automations modal, and the Ticket workflow with
  no integration; premium adds a fleet's own webhook, on a throwaway fleet (POL-30).
- `sql-validation.spec.ts` — the policy form: platform compatibility, a policy with a
  syntax error saved and reopened, and save gating.

Four more files: `shared/policies/policy-autofill.spec.ts` runs AI Autofill on both tiers
(POL-32); `shared/policies/policy-hosts.spec.ts` covers which hosts a macOS-only policy runs on and a host's
link to the hosts that gave the same answer (POL-33/34), and `premium/policies/policy-host-counts.spec.ts` the
list's Pass / Fail links (POL-35); and `premium/exclusive/policies/policy-automation-runs.spec.ts` runs a policy's
script automation on the Ubuntu VM (POL-27). `premium/policies/policy-label-targets.spec.ts`
is audited with label targeting, in [area 22](22-label-targeting.md) (LT-08). `role-access.spec.ts` on each tier
is what each role is shown (POL-36…39); `policy-automations.spec.ts` also holds the fleet admin's #54623 check
(POL-40, skipped) and the automation filter's options by scope (POL-41). `shared/policies/live-policy-run.spec.ts` runs a
policy live on the three real VMs (POL-42).

## Contents

| ID | Spec | Test | Mode | Manual? |
|---|---|---|---|---|
| POL-01 | `premium/policies/policies.spec.ts` | Policies CRUD (All fleets \| Workstations) › create | UI+API | ☐ |
| POL-02 | `free/policies/policies.spec.ts` | Policies CRUD › create | UI+API | ☐ |
| POL-03 | `premium/policies/policies.spec.ts` | Policies CRUD (All fleets \| Workstations) › edit | UI+API | ☐ |
| POL-04 | `free/policies/policies.spec.ts` | Policies CRUD › edit | UI+API | ☐ |
| POL-05 | `premium/policies/policies.spec.ts` | Policies CRUD (All fleets \| Workstations) › delete | UI+API | ☐ |
| POL-06 | `free/policies/policies.spec.ts` | Policies CRUD › delete | UI+API | ☐ |
| POL-07 | `premium/policies/policies.spec.ts` | Policies CRUD (…) › activity feed shows create → edit → delete | UI | ☐ |
| POL-08 | `free/policies/policies.spec.ts` | Policies CRUD › activity feed shows create → edit → delete | UI | ☐ |
| POL-09 | `premium/policies/policy-automations.spec.ts` | Premium • Policies • automations › the failing-policies webhook is enabled, sent for one policy, and turned off again | UI+API | ☐ |
| POL-10 | `free/policies/policy-automations.spec.ts` | Free • Policies • automations › the failing-policies webhook is enabled, sent for one policy, and turned off again | UI+API | ☐ |
| POL-11 | `premium/policies/sql-validation.spec.ts` | platform compatibility › an invalid table reports no compatible platforms | UI | ☐ |
| POL-12 | `free/policies/sql-validation.spec.ts` | platform compatibility › an invalid table reports no compatible platforms | UI | ☐ |
| POL-13 | `premium/policies/sql-validation.spec.ts` | platform compatibility › a query with no tables is compatible with all four platforms | UI | ☐ |
| POL-14 | `free/policies/sql-validation.spec.ts` | platform compatibility › a query with no tables is compatible with all four platforms | UI | ☐ |
| POL-15 | `premium/policies/sql-validation.spec.ts` | platform compatibility › a macOS-only table is compatible with macOS only | UI | ☐ |
| POL-16 | `free/policies/sql-validation.spec.ts` | platform compatibility › a macOS-only table is compatible with macOS only | UI | ☐ |
| POL-17 | `premium/policies/sql-validation.spec.ts` | platform compatibility › a macadmins extension table is treated as macOS-compatible | UI | ☐ |
| POL-18 | `premium/policies/sql-validation.spec.ts` | platform compatibility › common-table-expression names are not treated as tables | UI | ☐ |
| POL-19 | `premium/policies/sql-validation.spec.ts` | SQL validation › a policy with a syntax error saves, and reopens with its SQL and the error | UI | ☐ |
| POL-20 | `free/policies/sql-validation.spec.ts` | SQL validation › a policy with a syntax error saves, and reopens with its SQL and the error | UI | ☐ |
| POL-21 | `premium/policies/sql-validation.spec.ts` | save gating › the Save policy modal disables Save until a platform is selected | UI | ☐ |
| POL-22 | `free/policies/sql-validation.spec.ts` | save gating › the Save policy modal disables Save until a platform is selected | UI | ☐ |
| POL-23 | `premium/policies/policy-automations.spec.ts` | Premium • Policies • automations › the automations form locks itself while the save is in flight | UI | ☐ |
| POL-24 | `free/policies/policy-automations.spec.ts` | Free • Policies • automations › the automations form locks itself while the save is in flight | UI | ☐ |
| POL-25 | `premium/policies/policy-automations.spec.ts` | Premium • Policies • one policy's automations › install software, run script and continuous, saved together from the row, are stored and reopen | UI+API | ☐ |
| POL-26 | `free/policies/policy-automations.spec.ts` | Free • Policies • one policy's automations › a policy's automations modal offers webhooks or tickets, and nothing a fleet policy adds | UI | ☐ |
| POL-27 | `premium/exclusive/policies/policy-automation-runs.spec.ts` | Premium • Policies • automation runs › a failing script is tried 3 times, and a refetch runs it again only once continuous automations are on | UI+API · **real VM** | ☐ |
| POL-28 | `premium/policies/policy-automations.spec.ts` | Premium • Policies • automations with no ticket integration › choosing Ticket offers "Add integration", which leads to Settings › Integrations | UI+API | ☐ |
| POL-29 | `free/policies/policy-automations.spec.ts` | Free • Policies • automations with no ticket integration › choosing Ticket offers "Add integration", which leads to Settings › Integrations | UI+API | ☐ |
| POL-30 | `premium/policies/policy-automations.spec.ts` | Premium • Policies • a fleet's failing-policies webhook › enabling it at a fleet's scope stores it on that fleet, not in global config | UI+API | ☐ |
| POL-31 | `premium/policies/policies.spec.ts` | Policies — fleet isolation › a fleet's policy is listed under its fleet and not under another | UI | ☐ |
| POL-32 | `shared/policies/policy-autofill.spec.ts` | Shared • Policies • AI Autofill › Autofill writes a description and a resolution for the SQL | UI+API · **live fleetdm.com call** | ☐ |
| POL-33 | `shared/policies/policy-hosts.spec.ts` | Shared • Policies • policy hosts › a policy saved for macOS only runs on macOS hosts | UI+API | ☐ |
| POL-34 | `shared/policies/policy-hosts.spec.ts` | Shared • Policies • policy hosts › a host's policy links to the hosts that gave the same answer | UI+API | ☐ |
| POL-35 | `premium/policies/policy-host-counts.spec.ts` | the Pass count opens exactly the hosts passing the policy, and Fail those failing it | UI+API | ☐ |
| POL-36 | `premium/policies/role-access.spec.ts` | Premium • Policies • role access › <role> is shown the policy controls its role grants (7 roles) | UI | ☐ |
| POL-37 | `premium/policies/role-access.spec.ts` | Premium • Policies • role access › <team-admin \| ws-maintainer> creates a Workstations policy from the UI | UI+API | ☐ |
| POL-38 | `premium/policies/role-access.spec.ts` | Premium • Policies • role access › global-observer-plus is offered Run policy on an Unassigned policy *(skipped, #54624)* | UI | ☐ |
| POL-39 | `free/policies/role-access.spec.ts` | Free • Policies • role access › <role> is shown the policy controls its role grants (2 roles) | UI | ☐ |
| POL-40 | `premium/policies/policy-automations.spec.ts` | Premium • Policies • automations › a fleet admin can't add an inherited policy to the global webhook *(skipped, #54623)* | UI+API | ☐ |
| POL-41 | `premium/policies/policy-automations.spec.ts` | Premium • Policies • the automation filter by scope › offers only the automation types the scope supports | UI | ☐ |
| POL-42 | `shared/policies/live-policy-run.spec.ts` | Policies • run live on the real VMs › marks each VM Pass or Fail, sums them as Yes / No, sorts the hosts case-insensitively and exports them | UI+API · **real VMs** | ☐ |

---

### POL-01 · Policies CRUD (All fleets · Workstations) › create

- **File:** [`playwright/tests/e2e/premium/policies/policies.spec.ts`](../../tests/e2e/premium/policies/policies.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "Policies CRUD \(All fleets\) › create"` (and `\(Workstations\)`)
- **Project:** premium · **Scopes:** All fleets, Workstations (`for (const scope of SCOPES)` — two serial describes, run in parallel with each other)
- **Mode:** UI+API · **Isolation:** serial describe, step 1 of 4. Shares closure state `stamp`, `policyName`, `editedName`, `created`, `edited` with POL-03 / POL-05 / POL-07. A failure here skips the rest of the describe.
- **Preconditions:** `cleanup-setup` has wiped global + Workstations policies, so the list is empty and short (page 1 only). No other setup.
- **Data created:** policy `playwright-policy-<slug>-<stamp>` — renamed by POL-03, deleted by POL-05; `cleanup-teardown` sweeps it if the chain aborts.

**Flow**

1. ☐ Open `/dashboard` via URL.
   - ✅ *(UI)* First dashboard card is visible (`DashboardPage.goto`).
2. ☐ Click **Policies** in the navbar.
   - ✅ *(UI)* URL is `/policies/manage` (`Navbar.goToPolicies`).
3. ☐ Select the scope in the team dropdown (no-op if already showing it).
   - ✅ *(UI)* `.team-dropdown__single-value` reads exactly the scope label (`TeamDropdown.selectByLabel`).
4. ☐ Click **Add policy**.
   - ✅ *(UI)* URL matches `/policies/new` (`PoliciesListPage.addPolicy`).
5. ☐ Enter SQL `SELECT 1 AS one;` — **not typed**: `setSql` calls Ace's `env.editor.setValue()` through `evaluate()`, bypassing the keyboard/pointer path ([`PolicyEditPage.ts:257`](../../pages/policies/PolicyEditPage.ts)).
   - ✅ *(UI)* `.ace_content` renders exactly the SQL.
6. ☐ Click **Save** → the **Save policy** modal opens → fill **Name**, **Description**, **Resolution** → click **Save** in the modal. Platforms (default macOS), target (**All hosts**) and **Critical** are left at modal defaults.
   - ✅ *(UI)* "Save policy" modal is visible before filling.
   - ✅ *(UI)* Success toast `Policy created.` (`Toast.expectSuccess`, class-narrowed to the success variant).
   - ✅ *(UI)* URL redirects to `/policies/:id`; the id parses (throws otherwise).
7. ☐ *(no user action)* — API check.
   - ✅ *(API)* `GET /activities?order_key=created_at&order_direction=desc` (100/page, ≤5 pages) contains a `created_policy` entry with `details.policy_name === policyName`, and `actor_email === FLEET_ADMIN_EMAIL` (`assertActivity`).
8. ☐ Read the policy details page.
   - ✅ *(UI)* `<h1>` = name, `.policy-details-page__policy-description` = description, DataSet **Resolve** = resolution (`PolicyDetailsPage.expectValues`). **Platforms and SQL are not asserted here.**
   - ✅ *(UI)* **Show query**, **Run policy**, **Edit policy** buttons are visible.
9. ☐ Click **Policies** in the navbar, then load the list afresh (`policiesList.goto`), re-select the scope,
   type the policy name in **Search by name**. The full load is load-bearing: the navbar lands on a list React
   Query serves from its cache for 5 s after the last fetch (`staleTime: 5000`, `ManagePoliciesPage.tsx`) and never
   refetches on its own, so a list fetched empty just before the create — the run starts with no global
   policies — stays "No policies apply to all fleets" with the search box disabled (branch run 37873060103,
   both tiers, first attempt).
   - ✅ *(UI)* A table row containing the name is visible (`DataTable.rowWith`).

**Assessment**
- *Value:* Covers the whole happy path a user actually walks — Add policy → modal → redirect → details render → the row is findable in the scoped list, plus the server-side activity record.
- *Coverage gaps:* SQL never goes through the editor's input path (Ace `setValue`), so typing/paste/autocomplete regressions in the SQL editor are invisible; the created policy's SQL is never read back (only POL-03 does); modal defaults (macOS platform, **All hosts**, **Critical**) are set but never verified after save; no duplicate-name / empty-name negative path; list columns (Passing/Failing hosts, Automations) unchecked.
- *Redundancy:* POL-02 is the same flow on free. Existence is proved three times over (details page + `/activities` + list row); the activity is asserted again in the UI by POL-07.
- *Efficiency / smells:* `assertActivity` at [`policies.spec.ts:55`](../../tests/e2e/premium/policies/policies.spec.ts) duplicates POL-07's UI walk of the same event. Step 9 re-navigates to the list only to search — cheap, but it's the third existence proof.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-02 · Policies CRUD › create (free)

- **File:** [`playwright/tests/e2e/free/policies/policies.spec.ts`](../../tests/e2e/free/policies/policies.spec.ts)
- **Grep:** `npx playwright test --project=free -g "Policies CRUD › create"`
- **Project:** free · **Scopes:** n/a (no team dropdown)
- **Mode:** UI+API · **Isolation:** serial describe, step 1 of 4; shares `policyName` / `editedName` / `created` / `edited` with POL-04 / POL-06 / POL-08
- **Preconditions:** `cleanup-setup` equivalent for the free project has wiped global policies
- **Data created:** policy `playwright-policy-<stamp>` — renamed by POL-04, deleted by POL-06

**Flow**

Identical to POL-01 with two lines removed: no `teamDropdown.select()` after the navbar
click, and no re-select before the final search.

1. ☐ Open `/dashboard` via URL → click **Policies** in the navbar.
   - ✅ *(UI)* First dashboard card visible; URL `/policies/manage`.
2. ☐ Click **Add policy** → enter SQL `SELECT 1 AS one;` (Ace `setValue`) → **Save** → fill Name / Description / Resolution → **Save**.
   - ✅ *(UI)* URL `/policies/new`; `.ace_content` = SQL; "Save policy" modal visible; toast `Policy created.`; redirect to `/policies/:id`.
   - ✅ *(API)* `created_policy` activity with matching `policy_name`, actor = suite admin.
3. ☐ Read the details page.
   - ✅ *(UI)* h1 / description / **Resolve** match the submitted values; **Show query**, **Run policy**, **Edit policy** visible.
4. ☐ Click **Policies** in the navbar, load the list afresh (`policiesList.goto` — the stale-cache reason in
   POL-01 step 9), search the name.
   - ✅ *(UI)* Row with the name is visible.

**Assessment**
- *Value:* Confirms policy creation works on a free license (no team plumbing) — the one thing POL-01 can't prove.
- *Coverage gaps:* Same as POL-01. Additionally: no assertion that premium-only controls (**Critical**, install-software / run-script automations) are absent or paywalled on free.
- *Redundancy:* ~95% duplicate of POL-01 — every assertion is the same; only the dropdown lines differ.
- *Efficiency / smells:* Same double activity coverage (`free/policies/policies.spec.ts:40` + POL-08).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-03 · Policies CRUD (All fleets · Workstations) › edit

- **File:** [`playwright/tests/e2e/premium/policies/policies.spec.ts`](../../tests/e2e/premium/policies/policies.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "Policies CRUD \(All fleets\) › edit"`
- **Project:** premium · **Scopes:** All fleets, Workstations
- **Mode:** UI+API · **Isolation:** serial describe, step 2 of 4 — consumes `policyName` from POL-01, produces `editedName` for POL-05 / POL-07
- **Preconditions:** POL-01 created the policy under the same scope
- **Data created:** none; renames the existing policy to `<policyName>-edited`

**Flow**

1. ☐ Open `/policies/manage?fleet_id=<id>` via URL (`fleetIdFor(scope, workstationsFleetId)`; `All fleets` → no param), then select the scope in the dropdown.
   - ✅ *(UI)* A table row **or** the empty state is visible (`PoliciesListPage.goto`).
   - ✅ *(UI)* Dropdown reads the scope.
2. ☐ Click the policy's name link in the list.
   - ✅ *(UI)* URL matches `/policies/\d+` (`openPolicy`). No search first — relies on the row being on page 1.
3. ☐ Click **Edit policy**.
   - ✅ *(UI)* URL matches `/policies/:id/edit` (`PolicyDetailsPage.clickEdit`).
   - ✅ *(UI)* **Name** input is pre-filled with the original name (the form rehydrated).
4. ☐ `fillAll(edited)`: set SQL `SELECT version FROM osquery_info;` (Ace `setValue`) → tick **Windows** + **Linux**, untick **macOS** + **ChromeOS** → fill **Name**, **Description**, **Resolution** (text fields go last because platform/SQL re-renders reset them).
   - ✅ *(UI)* `.ace_content` = the new SQL; Name / Description / Resolution hold the new values before save (`PolicyEditPage.fillAll:235-237`).
5. ☐ Click **Save**.
   - ✅ *(UI)* Success toast `Policy updated.`
   - ✅ *(API)* `edited_policy` activity with `policy_name === editedName`, actor = suite admin.
6. ☐ Click **Back to policy**.
   - ✅ *(UI)* URL back to `/policies/:id`.
   - ✅ *(UI)* h1 / description / **Resolve** equal the edited values — **platforms not asserted**.
7. ☐ Click **Show query**, read the SQL, click **Close**.
   - ✅ *(UI)* Query modal opens, its `.ace_content` contains the edited SQL, and the modal closes (`PolicyDetailsPage.showQuery`).
8. ☐ Click **Policies** in the navbar, re-select the scope, search the edited name.
   - ✅ *(UI)* Row with the edited name is visible.

**Assessment**
- *Value:* The strongest test in the area — every text field, the SQL, and the platform set diverge from the create values, so a stuck field or a dropped PATCH surfaces. Also the only place **Show query** is exercised.
- *Coverage gaps:* **The edited platform set (`['Windows','Linux']`) is never verified after save.** `PolicyDetailsPage.platformsDefinition` exists but is unused ([`PolicyDetailsPage.ts:54`](../../pages/policies/PolicyDetailsPage.ts)) and `PolicyEditPage.expectValues` — which *does* check platforms + SQL — is dead code ([`PolicyEditPage.ts:241`](../../pages/policies/PolicyEditPage.ts)). **Critical** is deliberately uncovered (POM comment: Fleet's `role=checkbox` proxy doesn't resolve). No check the old name disappears from the list; no cancel/discard path; target type (**All hosts** / **Custom**) untouched.
- *Redundancy:* POL-04 is the same flow on free. Final list search overlaps POL-01's step 9.
- *Efficiency / smells:* `openPolicy(name)` clicks a name link with no prior search, unlike `deletePolicy` which searches first — inconsistent, and fails once the scope holds more than a page of policies ([`policies.spec.ts:79`](../../tests/e2e/premium/policies/policies.spec.ts)). `assertActivity` here again duplicates POL-07.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-04 · Policies CRUD › edit (free)

- **File:** [`playwright/tests/e2e/free/policies/policies.spec.ts`](../../tests/e2e/free/policies/policies.spec.ts)
- **Grep:** `npx playwright test --project=free -g "Policies CRUD › edit"`
- **Project:** free · **Mode:** UI+API · **Isolation:** serial describe, step 2 of 4; consumes `policyName` from POL-02
- **Preconditions:** POL-02 created the policy
- **Data created:** none; renames to `<policyName>-edited`

**Flow**

Line-for-line the same as POL-03 minus the `fleet_id` param and the two dropdown selects.

1. ☐ Open `/policies/manage` via URL → click the policy name → click **Edit policy**.
   - ✅ *(UI)* Row-or-empty visible; URL `/policies/\d+` then `/policies/:id/edit`; **Name** pre-filled with the original name.
2. ☐ Fill SQL + platforms (**Windows**, **Linux**) + Name / Description / Resolution → **Save**.
   - ✅ *(UI)* Fields hold the new values pre-save; toast `Policy updated.`
   - ✅ *(API)* `edited_policy` activity with the edited name.
3. ☐ Click **Back to policy**, then **Show query** → **Close**.
   - ✅ *(UI)* h1 / description / **Resolve** = edited values (platforms not asserted); query modal SQL contains the edited SQL.
4. ☐ Click **Policies** in the navbar, search the edited name.
   - ✅ *(UI)* Row visible.

**Assessment**
- *Value:* Free-tier PATCH of a global policy. Nothing tier-specific is asserted beyond that.
- *Coverage gaps:* Same as POL-03 (platforms unverified post-save; Critical, target type, cancel path untested).
- *Redundancy:* ~95% duplicate of POL-03.
- *Efficiency / smells:* Same unsearched `openPolicy` (`free/policies/policies.spec.ts:56`).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-05 · Policies CRUD (All fleets · Workstations) › delete

- **File:** [`playwright/tests/e2e/premium/policies/policies.spec.ts`](../../tests/e2e/premium/policies/policies.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "Policies CRUD \(All fleets\) › delete"`
- **Project:** premium · **Scopes:** All fleets, Workstations
- **Mode:** UI+API · **Isolation:** serial describe, step 3 of 4; consumes `editedName` from POL-03. This is also the cleanup step for the describe.
- **Preconditions:** POL-03 renamed the policy
- **Data created:** none (removes the policy)

**Flow**

1. ☐ Open `/policies/manage?fleet_id=<id>` via URL, select the scope.
   - ✅ *(UI)* Row-or-empty visible; dropdown reads the scope.
2. ☐ Type the policy name in **Search by name**, tick the row's checkbox, click **Delete** in the table header, confirm in the **Delete policies** modal (`PoliciesListPage.deletePolicy`).
   - ✅ *(UI)* The matching row is visible before selecting it.
   - ✅ *(UI)* "Delete policies" modal appears, then closes after confirming.
3. ☐ Look at the (still name-filtered) list.
   - ✅ *(UI)* A row **or** the empty state is visible — `rowOrEmpty()` is an `.or()` locator, so this can practically never fail.
   - ✅ *(UI)* Zero rows match the policy name (`toHaveCount(0)`).
   - ✅ *(API)* `deleted_policy` activity with `policy_name === editedName`, actor = suite admin.

**Assessment**
- *Value:* Covers checkbox selection → header bulk-**Delete** → confirmation modal, the only delete path Fleet's policies list offers.
- *Coverage gaps:* No toast assertion after delete (⚠️ unclear whether Fleet shows one here — nothing in the POM); no `GET /policies` confirmation that the record is gone (the activity is a proxy); only one row is selected, so true multi-row bulk delete and the modal's "N policies" copy are untested; no cancel path; select-all header checkbox untested.
- *Redundancy:* POL-06 is the same on free.
- *Efficiency / smells:* `expect(policiesList.table.rowOrEmpty()).toBeVisible()` at [`policies.spec.ts:102`](../../tests/e2e/premium/policies/policies.spec.ts) is a tautology — an `.or()` of "any row" and "empty state" is satisfied either way; the following `toHaveCount(0)` is the only real assertion.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-06 · Policies CRUD › delete (free)

- **File:** [`playwright/tests/e2e/free/policies/policies.spec.ts`](../../tests/e2e/free/policies/policies.spec.ts)
- **Grep:** `npx playwright test --project=free -g "Policies CRUD › delete"`
- **Project:** free · **Mode:** UI+API · **Isolation:** serial describe, step 3 of 4; consumes `editedName` from POL-04; cleanup step
- **Preconditions:** POL-04 renamed the policy
- **Data created:** none

**Flow**

1. ☐ Open `/policies/manage` via URL.
   - ✅ *(UI)* Row-or-empty visible.
2. ☐ Search the name, tick the row checkbox, click **Delete**, confirm in **Delete policies**.
   - ✅ *(UI)* Row visible pre-select; modal opens and closes.
3. ☐ Inspect the filtered list.
   - ✅ *(UI)* `rowOrEmpty()` visible (tautological); zero rows match the name.
   - ✅ *(API)* `deleted_policy` activity with the edited name.

**Assessment**
- *Value:* Delete on a free license.
- *Coverage gaps:* Same as POL-05.
- *Redundancy:* Duplicate of POL-05 minus the dropdown.
- *Efficiency / smells:* Same tautological `rowOrEmpty()` assert (`free/policies/policies.spec.ts:77`).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-07 · Policies CRUD (All fleets · Workstations) › activity feed shows create → edit → delete

- **File:** [`playwright/tests/e2e/premium/policies/policies.spec.ts`](../../tests/e2e/premium/policies/policies.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "Policies CRUD \(All fleets\) › activity feed"`
- **Project:** premium · **Scopes:** All fleets, Workstations
- **Mode:** UI · **Isolation:** serial describe, step 4 of 4; consumes `policyName` + `editedName` from POL-01 / POL-03
- **Preconditions:** POL-01/03/05 have run in this describe
- **Data created:** none

**Flow**

1. ☐ Open `/dashboard` via URL (no `fleet_id` — the global feed).
   - ✅ *(UI)* First dashboard card visible.
2. ☐ Read the **Activity** card; page through it with **Next** as needed.
   - ✅ *(UI)* Feed contains rows matching three regexes built by `activityCopy.policy` — `created a policy <name> <suffix>.`, `edited the policy <edited> <suffix>.`, `deleted the policy <edited> <suffix>.` where suffix is ` globally` (All fleets) or ` on the Workstations fleet`.
   - Mechanics (`DashboardPage.expectActivities`): matches `role=button` names inside `.activity-feed-card`; walks up to 15 pages, waiting on each `GET …/activities?…page=N`; if matchers are still missing it reloads the dashboard and re-walks, up to 10 attempts; the first still-missing matcher is surfaced through `toBeVisible()` for a readable failure.

**Assessment**
- *Value:* The only UI-side check of policy activity copy, including the scope suffix — catches renderer/copy regressions the API assertions can't see.
- *Coverage gaps:* **Order is not asserted** despite the title ("create → edit → delete") — it is set membership over a paginated walk. Count is not asserted either, so a duplicated activity passes. The feed's own filters (actor/type dropdowns) and the activity detail modal are untested. Nothing checks the actor name/avatar rendered in the row.
- *Redundancy:* Same three events already asserted via `/activities` in POL-01/03/05; the regexes themselves are unit-tested in [`tests/api/activity-copy.spec.ts`](../../tests/api/activity-copy.spec.ts). POL-08 repeats this on free with the ` globally` suffix.
- *Efficiency / smells:* Up to 10 dashboard reloads × 15 pages is the most expensive assertion in the area; tolerant by design for propagation lag, but it also means a genuinely missing activity costs a long timeout.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-08 · Policies CRUD › activity feed shows create → edit → delete (free)

- **File:** [`playwright/tests/e2e/free/policies/policies.spec.ts`](../../tests/e2e/free/policies/policies.spec.ts)
- **Grep:** `npx playwright test --project=free -g "Policies CRUD › activity feed"`
- **Project:** free · **Mode:** UI · **Isolation:** serial describe, step 4 of 4
- **Preconditions:** POL-02/04/06 have run
- **Data created:** none

**Flow**

1. ☐ Open `/dashboard` via URL, read the **Activity** card (paginating as needed).
   - ✅ *(UI)* Rows match `created a policy <name> globally.`, `edited the policy <edited> globally.`, `deleted the policy <edited> globally.` — the spec passes `scope: 'All fleets'` explicitly since free has no scope concept.

**Assessment**
- *Value:* Confirms the free-tier feed renders the same policy copy (no team suffix drift).
- *Coverage gaps:* Same as POL-07 (no order, no count).
- *Redundancy:* Duplicate of POL-07's All-fleets branch; the free/premium difference here is only whether `fleetSuffix` could diverge, which `activity-copy.spec.ts` already pins.
- *Efficiency / smells:* none beyond the shared reload cost.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-09 · Premium • Policies • automations › the failing-policies webhook is enabled, sent for one policy, and turned off again

- **File:** [`playwright/tests/e2e/premium/policies/policy-automations.spec.ts`](../../tests/e2e/premium/policies/policy-automations.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "the failing-policies webhook is enabled, sent for one policy, and turned off again"`
- **Project:** premium · **Scopes:** All fleets only
- **Mode:** UI+API · **Isolation:** **serial describe, step 1 of 2** — `test.describe.configure({ mode: 'serial' })` ([`policy-automations.spec.ts:62`](../../tests/e2e/premium/policies/policy-automations.spec.ts)); POL-23 is step 2, and a failure here skips it. Own `beforeEach` / `afterEach`, no shared closure state. Three `test.step`s, so a report names the stage that failed. **Mutates global app config** (`webhook_settings.failing_policies_webhook`, `policy_ids` included) — snapshot + restore, so it is not safe to run concurrently with another spec touching the same subtree.
- **Why the describe is serial:** both tests snapshot and restore the **same global config key**. Run in parallel they raced — one test's `afterEach` restore landed between the other's save and its read-back, so the read-back saw the restored value and failed on correct product behaviour. ⚠️ **Not `--repeat-each`-safe:** serial mode orders tests *within one describe in one worker*, while `--repeat-each` produces copies Playwright may schedule in parallel workers, reinstating the race.
- **Preconditions (API):** `GET /config` snapshots the current failing-policies webhook — enabled flag, URL and `policy_ids`; `POST /global/policies` seeds `pw-policy-auto-<nonce>` with `SELECT 1;` so the **Manage automations** button is enabled (Fleet disables it when the scope has no policies). `SELECT 1;` passes on every host, so the webhook never has a failure to send.
- **Data created:** one API-seeded global policy; the `afterEach` PATCHes the config subtree — enabled flag, URL and `policy_ids` — back to its snapshot, then deletes the policy via `POST /global/policies/delete`.

**Flow**

*Step 1 — enable it with a destination URL*

1. ☐ Open `/policies/manage` via URL, select **All fleets** in the dropdown.
   - ✅ *(UI)* Row-or-empty visible; dropdown reads "All fleets".
2. ☐ Click **Manage automations**.
   - ✅ *(UI)* The automations modal is visible (`openAutomations`).
3. ☐ Flip the enable switch on (idempotent — reads `aria-checked` first).
   - ✅ *(UI)* Switch has `aria-checked="true"`.
4. ☐ Click the **Webhook** radio label (the modal may open on **Ticket**).
   - ✅ *(UI)* The **Destination URL** field (placeholder `https://server.com/example`) becomes visible.
5. ☐ Fill the destination URL `https://example.com/pw-policy-webhook`, click **Save**.
   - ✅ *(UI)* Modal closes (`saveAutomations`); success toast `Successfully updated policy automations.`
   - ✅ *(API)* `GET /config` → `webhook_settings.failing_policies_webhook.enable_failing_policies_webhook === true` and `destination_url` equals the submitted URL.

*Step 2 — tick Send webhook in the policy's own modal*

6. ☐ Type the seeded policy's name in **Search by name**, click the row's Automations cell (`openPolicyAutomations`).
   - ✅ *(UI)* Exactly one cell matches; the **Manage automations** modal opens and reads "Manage automations for the `<policy>` policy on All fleets."
7. ☐ Tick **Send webhook** (the checkbox Fleet names `ticket_webhook`; it stays disabled, "Not enabled for All fleets", until step 1 has turned the global webhook on), click **Save**.
   - ✅ *(UI)* The checkbox reads `aria-checked="true"`; the modal closes; toast `Successfully updated policy automations.`
   - ✅ *(API)* `GET /config` → `failing_policies_webhook.policy_ids` contains the seeded policy's id.
   - ✅ *(UI)* The row's Automations cell is a button named **Edit automation: Webhook**.

*Step 3 — turn it off, keeping the URL and the policy*

8. ☐ Click **Manage automations**, flip the switch off, click **Save**.
   - ✅ *(UI)* Switch reads `aria-checked="false"`; the modal closes; toast `Successfully updated policy automations.`
   - ✅ *(API)* `GET /config` → `enable_failing_policies_webhook === false`, `destination_url` is still the step-1 URL, and `policy_ids` still contains the policy.
   - ✅ *(UI)* The row's Automations cell is named **Add automation**: Fleet labels the cell from the global webhook's state, not from `policy_ids`.

**Assessment**
- *Value:* The whole life of the global failing-policies webhook in one test. The scope-wide modal persists the enabled flag and the URL (the toast alone would not prove it), the policy's own modal stores the policy in `policy_ids`, and turning the webhook off keeps both the URL and the policy list — the "off is not delete" contract a re-enable depends on. The row's cell name is checked at each state, so the list's summary is tied to what's stored.
- *Coverage gaps:* The scope-wide modal is never reopened, so UI rehydration of the saved switch and URL is untested at global scope (POL-30 reopens it at a fleet's). Unticking the policy (its removal from `policy_ids`) isn't exercised. No negative validation (empty or malformed URL with the switch on). The webhook never fires: `SELECT 1;` passes everywhere, so the POST Fleet sends for a failing policy, and its payload, are untested — and only the real VMs could produce a genuine failure, since the simulations pass every policy but `SELECT 0;`. A configured Jira or Zendesk integration is untested; the Ticket workflow is covered only in its empty state (POL-28). The premium-only workflows on a fleet policy are POL-25's.
- *Redundancy:* POL-10 is the same three steps on free, apart from the dropdown line and a shorter modal-copy check. This premium copy runs on All fleets and asserts nothing premium; a fleet's own webhook is POL-30. POL-23 re-walks step 1 up to the **Save** click.
- *Efficiency / smells:* `automationsModal.getByRole('switch')` ([`PoliciesListPage.ts:77`](../../pages/policies/PoliciesListPage.ts)) assumes exactly one switch in the modal — strict-mode break the moment Fleet adds another. `automationsModal` is `.modal__modal_container` filtered by the text "Automations", which would also match the per-policy **Manage automations** modal; step 2 uses the separate `.manage-automations-modal` locator, and only one of the two is open at a time. The last cell check pins current behaviour rather than a requirement: the cell reads "Add automation" while `policy_ids` still holds the policy, so a Fleet change that showed the dormant webhook would fail here. Global-config mutation from an e2e test is a parallel-safety hazard shared with `premium/dashboard/automations-activity.spec.ts` and `premium/settings/team-host-status-webhook.spec.ts` (different subtrees today).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-10 · Free • Policies • automations › the failing-policies webhook is enabled, sent for one policy, and turned off again

- **File:** [`playwright/tests/e2e/free/policies/policy-automations.spec.ts`](../../tests/e2e/free/policies/policy-automations.spec.ts)
- **Grep:** `npx playwright test --project=free -g "the failing-policies webhook is enabled, sent for one policy, and turned off again"`
- **Project:** free · **Mode:** UI+API · **Isolation:** **serial describe, step 1 of 2** ([`policy-automations.spec.ts:44`](../../tests/e2e/free/policies/policy-automations.spec.ts)); POL-24 is step 2 and is skipped if this fails. Three `test.step`s. Mutates global app config, `policy_ids` included, with snapshot/restore in `beforeEach`/`afterEach`. Serial for the same reason as POL-09 — two tests sharing one global config key raced, with one's restore landing between the other's save and read-back. ⚠️ **Not `--repeat-each`-safe** (serial orders within a describe in one worker; repeat-each copies can run in parallel workers)
- **Preconditions (API):** `GET /config` snapshot (enabled flag, URL, `policy_ids`); `POST /global/policies` seeds `pw-policy-auto-<nonce>` (`SELECT 1;`, which passes everywhere) to enable the **Manage automations** button
- **Data created:** one seeded policy; the `afterEach` restores the config subtree, `policy_ids` included, then deletes the policy through the API

**Flow**

1. ☐ *Enable it.* Open `/policies/manage` via URL (no team dropdown on free) → click **Manage automations** → flip the switch on → click the **Webhook** radio → fill `https://example.com/pw-policy-webhook` → **Save**.
   - ✅ *(UI)* Modal visible; `aria-checked="true"`; URL field visible; modal closes; toast `Successfully updated policy automations.`
   - ✅ *(API)* `GET /config` shows the webhook enabled with the submitted `destination_url`.
2. ☐ *Send it for one policy.* Search the seeded policy, click its Automations cell → tick **Send webhook** (`ticket_webhook`) → **Save**.
   - ✅ *(UI)* The modal reads "Manage automations for the `<policy>` policy" (a prefix: free's copy goes on "…on All fleets.", as POL-26 notes); checkbox ticked; modal closes; toast `Successfully updated policy automations.`
   - ✅ *(API)* `policy_ids` contains the seeded policy's id.
   - ✅ *(UI)* The row's Automations cell is named **Edit automation: Webhook**.
3. ☐ *Turn it off.* Click **Manage automations** → flip the switch off → **Save**.
   - ✅ *(UI)* `aria-checked="false"`; modal closes; toast `Successfully updated policy automations.`
   - ✅ *(API)* `enable_failing_policies_webhook === false`; the URL and `policy_ids` are kept.
   - ✅ *(UI)* The cell is named **Add automation**.

**Assessment**
- *Value:* Confirms the failing-policies webhook is genuinely available on free (not paywalled), both scope-wide and for one policy, persists, and turns off without losing its URL or its policy list. Every policy on free is global, so this is the only way free routes a policy to the webhook.
- *Coverage gaps:* Same as POL-09 (no rehydration of the scope-wide modal, no untick, no URL validation, the webhook never fires), plus: no assertion that premium-only workflows are absent from the scope-wide modal on free (POL-26 covers the per-policy modal's rows).
- *Redundancy:* Identical to POL-09 apart from the missing `teamDropdown.select('All fleets')` and the shorter modal-copy check; the same holds for POL-24 vs POL-23, so free's serial describe mirrors premium's test-for-test.
- *Efficiency / smells:* Same single-`switch` and text-filtered-modal assumptions as POL-09, and the same pinned cell name in step 3.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-11 · Premium • Policies • platform compatibility › an invalid table reports no compatible platforms

- **File:** [`playwright/tests/e2e/premium/policies/sql-validation.spec.ts`](../../tests/e2e/premium/policies/sql-validation.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "an invalid table reports no compatible platforms"`
- **Project:** premium · **Mode:** UI (client-side only — **no policy is created and no request is made**) · **Isolation:** fully independent, read-only
- **Preconditions:** none
- **Data created:** none

**Flow**

1. ☐ Open `/policies/new` via URL.
   - ✅ *(UI)* `.ace_content` is visible (`gotoNew`).
2. ☐ Enter SQL `SELECT 1 FROM foo WHERE start_time > 1;` (Ace `setValue`, not typed).
   - ✅ *(UI)* `.ace_content` renders the SQL.
   - ✅ *(UI)* The compatibility badge reads `No platforms (check your query for invalid tables or tables that are supported on different platforms)`.
   - ✅ *(UI)* Zero `.compatible-platform` check icons.

**Assessment**
- *Value:* Guards Fleet's client-side osquery-table parser + the exact user-facing copy for an unknown table.
- *Coverage gaps:* Nothing verifies the policy could still be saved from this state; the *incompatible* icons (`.incompatible-platform`) are never counted, so "no check icons" would also pass if the badge rendered nothing at all.
- *Redundancy:* POL-12 is the identical test on free — and the component is tier-agnostic (same `PolicyForm` / `PlatformCompatibility`), so the free copy adds no signal.
- *Efficiency / smells:* A full browser + login + page load to assert a pure React computation; belongs in Fleet's frontend unit tests. Class-based locators (`.platform-compatibility`, `.compatible-platform`) are documented but brittle. `gotoNew()` navigates by URL, skipping the click-through convention (acceptable for a form-only check).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-12 · Free • Policies • platform compatibility › an invalid table reports no compatible platforms

- **File:** [`playwright/tests/e2e/free/policies/sql-validation.spec.ts`](../../tests/e2e/free/policies/sql-validation.spec.ts)
- **Grep:** `npx playwright test --project=free -g "an invalid table reports no compatible platforms"`
- **Project:** free · **Mode:** UI (client-side only) · **Isolation:** independent, read-only
- **Preconditions:** none · **Data created:** none

**Flow**

1. ☐ Open `/policies/new` via URL, enter `SELECT 1 FROM foo WHERE start_time > 1;`.
   - ✅ *(UI)* Badge reads the full `No platforms (check your query…)` copy; zero compatible-platform icons.

**Assessment**
- *Value:* None beyond POL-11 — the component has no tier branch.
- *Coverage gaps:* Same as POL-11.
- *Redundancy:* Exact duplicate of POL-11.
- *Efficiency / smells:* Same as POL-11.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-13 · Premium • Policies • platform compatibility › a query with no tables is compatible with all four platforms

- **File:** [`playwright/tests/e2e/premium/policies/sql-validation.spec.ts`](../../tests/e2e/premium/policies/sql-validation.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "a query with no tables is compatible with all four platforms"`
- **Project:** premium · **Mode:** UI (client-side only) · **Isolation:** independent, read-only
- **Preconditions:** none · **Data created:** none

**Flow**

1. ☐ Open `/policies/new` via URL, enter `SELECT * WHERE 1 = 1;`.
   - ✅ *(UI)* Exactly 4 `.compatible-platform` check icons (macOS, Windows, Linux, ChromeOS).

**Assessment**
- *Value:* Pins the "no tables → assume all platforms" branch of the compatibility calculator.
- *Coverage gaps:* Only the count is asserted, not *which* four platforms are shown.
- *Redundancy:* POL-14 is the same test on free.
- *Efficiency / smells:* Same as POL-11 (browser test for a client-side computation).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-14 · Free • Policies • platform compatibility › a query with no tables is compatible with all four platforms

- **File:** [`playwright/tests/e2e/free/policies/sql-validation.spec.ts`](../../tests/e2e/free/policies/sql-validation.spec.ts)
- **Grep:** `npx playwright test --project=free -g "a query with no tables is compatible with all four platforms"`
- **Project:** free · **Mode:** UI (client-side only) · **Isolation:** independent, read-only
- **Preconditions:** none · **Data created:** none

**Flow**

1. ☐ Open `/policies/new` via URL, enter `SELECT * WHERE 1 = 1;`.
   - ✅ *(UI)* Exactly 4 compatible-platform icons.

**Assessment**
- *Value:* None beyond POL-13.
- *Coverage gaps:* Same as POL-13.
- *Redundancy:* Exact duplicate of POL-13.
- *Efficiency / smells:* Same as POL-11.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-15 · Premium • Policies • platform compatibility › a macOS-only table is compatible with macOS only

- **File:** [`playwright/tests/e2e/premium/policies/sql-validation.spec.ts`](../../tests/e2e/premium/policies/sql-validation.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "a macOS-only table is compatible with macOS only"`
- **Project:** premium · **Mode:** UI (client-side only) · **Isolation:** independent, read-only
- **Preconditions:** none · **Data created:** none

**Flow**

1. ☐ Open `/policies/new` via URL, enter `SELECT 1 FROM gatekeeper WHERE assessments_enabled = 1;`.
   - ✅ *(UI)* Exactly 1 compatible-platform icon.
   - ✅ *(UI)* The check icon sits inside the `.platform` entry whose text is **macOS**.

**Assessment**
- *Value:* The most meaningful of the compatibility cases — count *and* identity are both asserted, so a wrong-platform mapping is caught.
- *Coverage gaps:* Only one single-platform table is sampled; no Windows-only or Linux-only table (e.g. `windows_security_center`, `apt_sources`), and no multi-table query where the intersection is empty.
- *Redundancy:* POL-16 is the same test on free.
- *Efficiency / smells:* Same as POL-11.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-16 · Free • Policies • platform compatibility › a macOS-only table is compatible with macOS only

- **File:** [`playwright/tests/e2e/free/policies/sql-validation.spec.ts`](../../tests/e2e/free/policies/sql-validation.spec.ts)
- **Grep:** `npx playwright test --project=free -g "a macOS-only table is compatible with macOS only"`
- **Project:** free · **Mode:** UI (client-side only) · **Isolation:** independent, read-only
- **Preconditions:** none · **Data created:** none

**Flow**

1. ☐ Open `/policies/new` via URL, enter `SELECT 1 FROM gatekeeper WHERE assessments_enabled = 1;`.
   - ✅ *(UI)* Exactly 1 compatible-platform icon, and it is **macOS**.

**Assessment**
- *Value:* None beyond POL-15.
- *Coverage gaps:* Same as POL-15.
- *Redundancy:* Exact duplicate of POL-15.
- *Efficiency / smells:* Same as POL-11.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-17 · Premium • Policies • platform compatibility › a macadmins extension table is treated as macOS-compatible

- **File:** [`playwright/tests/e2e/premium/policies/sql-validation.spec.ts`](../../tests/e2e/premium/policies/sql-validation.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "a macadmins extension table is treated as macOS-compatible"`
- **Project:** premium only (**no free counterpart**) · **Mode:** UI (client-side only) · **Isolation:** independent, read-only
- **Preconditions:** none · **Data created:** none

**Flow**

1. ☐ Open `/policies/new` via URL, enter `SELECT 1 FROM mdm WHERE enrolled = 'true';`.
   - ✅ *(UI)* Exactly 1 compatible-platform icon.
   - ✅ *(UI)* That icon is on the **macOS** entry.

**Assessment**
- *Value:* Guards the extension-table (macadmins) part of the schema the parser bundles — a real past regression class, since `mdm` is not a core osquery table.
- *Coverage gaps:* Only `mdm` is sampled; other extension tables (`munki_info`, `macos_profiles`, `filevault_status`) untested.
- *Redundancy:* Structurally identical to POL-15, differing only in the table name; free has no copy of this case, which makes the tier split arbitrary rather than intentional.
- *Efficiency / smells:* Same as POL-11.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-18 · Premium • Policies • platform compatibility › common-table-expression names are not treated as tables

- **File:** [`playwright/tests/e2e/premium/policies/sql-validation.spec.ts`](../../tests/e2e/premium/policies/sql-validation.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "common-table-expression names are not treated as tables"`
- **Project:** premium only (**no free counterpart**) · **Mode:** UI (client-side only) · **Isolation:** independent, read-only
- **Preconditions:** none · **Data created:** none

**Flow**

1. ☐ Open `/policies/new` via URL, enter `WITH defined_cte AS (SELECT 1 AS n FROM osquery_info) SELECT n FROM defined_cte;`.
   - ✅ *(UI)* The badge does **not** contain `No platforms` (negative assertion — satisfied by any other badge text).
   - ✅ *(UI)* The **macOS** entry carries a compatible-platform check icon.

**Assessment**
- *Value:* Pins the CTE-aware parsing rule: a CTE alias must not be mistaken for an unknown osquery table.
- *Coverage gaps:* The full expected platform set for `osquery_info` (all four) isn't asserted — only macOS; a regression that dropped Windows/Linux would pass. No nested/multiple CTEs, no subquery aliases.
- *Redundancy:* Overlaps POL-11 (the "No platforms" copy) and POL-15/17 (macOS icon); free has no copy.
- *Efficiency / smells:* `not.toContainText('No platforms')` is the weakest assertion in the file — prefer `toHaveCount(4)` on `compatiblePlatforms`.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-19 · Premium • Policies • SQL validation › a policy with a syntax error saves, and reopens with its SQL and the error

- **File:** [`playwright/tests/e2e/premium/policies/sql-validation.spec.ts`](../../tests/e2e/premium/policies/sql-validation.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "a policy with a syntax error saves, and reopens with its SQL and the error"`
- **Project:** premium · **Scope:** global (`/policies/new` with no `fleet_id`) · **Mode:** UI — the save and the reopen go through the server, but every assertion is on screen · **Isolation:** its own describe, with an `afterEach`; the file's other tests create nothing
- **Preconditions:** none
- **Data created:** global policy `pw-policy-bad-sql-<nonce>` holding the broken SQL, with empty Description and Resolution and the Save policy modal's default platforms — deleted in the `afterEach` (`POST /global/policies/delete`). A saved global policy is scheduled on every host, so it must not outlive the test.

**Flow**

1. ☐ Open `/policies/new` via URL, enter `SELEC 1 FRO osquery_info WHER start_time > 1;` (Ace `setValue`).
   - ✅ *(UI)* The inline syntax error is visible (`sqlSyntaxError` — `Syntax error… Please review before saving.`; the locator accepts any of the three messages Fleet's query validator emits).
   - ✅ *(UI)* The **Save** button is still enabled (Fleet deliberately saves SQL its parser flags, so a query the validator gets wrong can still be used).
2. ☐ Click **Save** → the **Save policy** modal opens → fill **Name** `pw-policy-bad-sql-<nonce>`, leave **Description** and **Resolution** empty → click **Save** in the modal (`saveNew`).
   - ✅ *(UI)* "Save policy" modal visible; success toast `Policy created.`; redirect to `/policies/:id`, whose id the `afterEach` deletes.
3. ☐ Open `/policies/<id>/edit` via URL (`gotoEdit` loads `/policies/<id>` first, then the editor).
   - ✅ *(UI)* The **Name** input and the editor are visible.
   - ✅ *(UI)* **Name** holds the saved name.
   - ✅ *(UI)* The editor's SQL equals the broken SQL exactly (`sqlText()`, trimmed): Fleet stored it unchanged.
   - ✅ *(UI)* The syntax error is shown again — the editor validates the stored SQL as it loads.

**Assessment**
- *Value:* Locks in an intentional product decision end to end: SQL the client validator flags still saves (the server refuses only an empty query), comes back byte-for-byte, and reopens with its warning. A well-meaning "fix" on either side — Save disabled on a syntax error, or the server rejecting the SQL — fails here.
- *Coverage gaps:* The details page the save lands on isn't read (its name, or the SQL behind **Show query**). No check that the error clears once the SQL is corrected. Editing an existing policy into broken SQL (the **Save** on `/policies/:id/edit`) is untested. What hosts report for the policy is unasserted, and these instances couldn't assert it: the real VMs fail to run it, while the simulations would report it passing (they pass every policy but `SELECT 0;`).
- *Redundancy:* POL-20 is the identical test on free. Step 2 repeats POL-01's walk through the Save policy modal.
- *Efficiency / smells:* Both page loads are by URL (`gotoNew`, `gotoEdit`) rather than click-through — acceptable for a form check, but reopening through **Edit policy** on the page the save lands on would cover that page as well. `createdId` is set only once `saveNew` returns, so if the server stored the policy but the toast or the redirect then failed, the `afterEach` has no id and the policy waits for `cleanup-teardown`'s global-policy wipe.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-20 · Free • Policies • SQL validation › a policy with a syntax error saves, and reopens with its SQL and the error

- **File:** [`playwright/tests/e2e/free/policies/sql-validation.spec.ts`](../../tests/e2e/free/policies/sql-validation.spec.ts)
- **Grep:** `npx playwright test --project=free -g "a policy with a syntax error saves, and reopens with its SQL and the error"`
- **Project:** free · **Mode:** UI (the save and the reopen go through the server; every assertion is on screen) · **Isolation:** its own describe, with an `afterEach`
- **Preconditions:** none
- **Data created:** global policy `pw-policy-bad-sql-<nonce>` with the broken SQL, deleted in the `afterEach`

**Flow**

1. ☐ Open `/policies/new` via URL, enter `SELEC 1 FRO osquery_info WHER start_time > 1;`.
   - ✅ *(UI)* The syntax error is visible; **Save** is still enabled.
2. ☐ Click **Save** → fill **Name** `pw-policy-bad-sql-<nonce>` (Description and Resolution empty) → **Save** in the modal.
   - ✅ *(UI)* Toast `Policy created.`; redirect to `/policies/:id`.
3. ☐ Open `/policies/<id>/edit` via URL.
   - ✅ *(UI)* **Name** holds the saved name; the editor's SQL equals the broken SQL exactly; the syntax error is shown again.

**Assessment**
- *Value:* Confirms free saves it too; beyond that, nothing over POL-19 — `PolicyForm` and the server's acceptance rule have no tier branch.
- *Coverage gaps:* Same as POL-19.
- *Redundancy:* Exact duplicate of POL-19.
- *Efficiency / smells:* Same as POL-11.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-21 · Premium • Policies • save gating › the Save policy modal disables Save until a platform is selected

- **File:** [`playwright/tests/e2e/premium/policies/sql-validation.spec.ts`](../../tests/e2e/premium/policies/sql-validation.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "the Save policy modal disables Save until a platform is selected"`
- **Project:** premium · **Mode:** UI (client-side form gating — nothing is submitted) · **Isolation:** independent; no policy is created
- **Preconditions:** none · **Data created:** none

**Flow**

1. ☐ Open `/policies/new` via URL, enter `SELECT 1 FROM osquery_info;`.
   - ✅ *(UI)* `.ace_content` renders the SQL.
2. ☐ Click **Save**.
   - ✅ *(UI)* The **Save policy** modal is visible.
3. ☐ Untick **macOS**, **Windows**, **Linux**, **ChromeOS** in the modal (`clearNewPolicyPlatforms` unchecks all four).
   - ✅ *(UI)* The modal's **Save** button is disabled.

**Assessment**
- *Value:* Covers `SaveNewPolicyModal`'s `disableSave` guard — a policy can't be created with no platform.
- *Coverage gaps:* No inline error/tooltip copy is asserted; the re-enable path (tick one platform → Save becomes enabled) isn't checked, so a permanently-stuck disabled button would pass; the modal's other required field (Name) isn't gated-tested; the modal is left open (no Cancel/Escape path).
- *Redundancy:* POL-22 is the identical test on free.
- *Efficiency / smells:* `platformCheckbox()` is **page-scoped**, not modal-scoped ([`PolicyEditPage.ts:138`](../../pages/policies/PolicyEditPage.ts)) — it happens to be unique here only because `/policies/new` renders no inline platform picker; it will break (strict mode or wrong control) if Fleet adds one. `clearNewPolicyPlatforms` unchecks blindly in a loop, so an already-unchecked box is a silent no-op.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-22 · Free • Policies • save gating › the Save policy modal disables Save until a platform is selected

- **File:** [`playwright/tests/e2e/free/policies/sql-validation.spec.ts`](../../tests/e2e/free/policies/sql-validation.spec.ts)
- **Grep:** `npx playwright test --project=free -g "the Save policy modal disables Save until a platform is selected"`
- **Project:** free · **Mode:** UI (client-side form gating) · **Isolation:** independent; no policy created
- **Preconditions:** none · **Data created:** none

**Flow**

1. ☐ Open `/policies/new` via URL, enter `SELECT 1 FROM osquery_info;`, click **Save**, untick all four platforms in the **Save policy** modal.
   - ✅ *(UI)* Modal visible; modal **Save** disabled.

**Assessment**
- *Value:* None beyond POL-21.
- *Coverage gaps:* Same as POL-21.
- *Redundancy:* Exact duplicate of POL-21.
- *Efficiency / smells:* Same page-scoped checkbox locator.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-23 · Premium • Policies • automations › the automations form locks itself while the save is in flight

- **File:** [`playwright/tests/e2e/premium/policies/policy-automations.spec.ts`](../../tests/e2e/premium/policies/policy-automations.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "Premium • Policies • automations › the automations form locks itself while the save is in flight"`
- **Project:** premium · **Scopes:** All fleets only
- **Mode:** UI · **Isolation:** **serial describe, step 2 of 2** — `test.describe.configure({ mode: 'serial' })` ([`policy-automations.spec.ts:62`](../../tests/e2e/premium/policies/policy-automations.spec.ts)). Shares no closure state with POL-09, but shares its `beforeEach` / `afterEach` **and the global config key they drive**. Still **mutates global app config** (`webhook_settings.failing_policies_webhook`) — snapshot + restore — so it is not safe to run concurrently with any other spec touching that subtree. ⚠️ **Not `--repeat-each`-safe:** serial mode orders the two tests *within one describe in one worker*; `--repeat-each` produces independent copies that Playwright is free to schedule in parallel workers, which reinstates exactly the race serial was added to remove.
- **Why serial:** the two tests in this describe snapshot and restore the **same global config key**. Run in parallel they raced — one test's `afterEach` restore landed between the other's save and its read-back, so the read-back saw the *restored* value and the assertion failed on correct product behaviour. Serial keeps the two hook cycles from interleaving. (Consequence: a failure in POL-09 skips this test.)
- **Preconditions (API):** identical to POL-09 — `GET /config` snapshots the failing-policies webhook; `POST /global/policies` seeds `pw-policy-auto-<nonce>` so the **Manage automations** button is enabled (Fleet disables it when the scope has no policies).
- **Data created:** one API-seeded global policy (deleted in `afterEach`); the config subtree is PATCHed back to its snapshot. Note the in-flight PATCH **is released and does land**, so this test really does enable the webhook with `https://example.com/pw-policy-webhook-inflight` before the restore undoes it.

**Flow**

1. ☐ *(test setup, no user action)* Install a `page.route` on `/api/*/fleet/config` that **holds the PATCH open** until the in-flight assertions have run, then releases it. Non-PATCH methods `fallback()` straight through, so the page's own config **reads** are untouched.
   - 📌 **The hold replaces a sleep.** Holding the response keeps the in-flight window open exactly as long as the assertions need and no longer — there is no timing constant to tune and no race to lose on a slow instance. Manually, the equivalent is throttling the network or using devtools request blocking; there is no pure-UI way to widen this window.
   - 📌 The route is installed on the **page**, not the API `request` context, so `afterEach`'s restore PATCH (which goes through `request`) is not intercepted.
2. ☐ Open `/policies/manage` via URL, select **All fleets** in the dropdown.
   - ✅ *(UI)* Row-or-empty visible; dropdown reads "All fleets".
3. ☐ Click **Manage automations**.
   - ✅ *(UI)* the automations modal is visible (`openAutomations`).
4. ☐ Flip the enable switch on, click the **Webhook** radio label, fill the destination URL.
   - ✅ *(UI)* switch has `aria-checked="true"`; the **Destination URL** field is visible.
5. ☐ Click **Save** — and, because the PATCH is held, the form stays in its saving state.
   - ✅ *(UI)* the modal's **Save** button is **disabled**.
   - ✅ *(UI)* the modal's **disabled-content overlay** is visible — `.modal__content-wrapper-disabled` inside the automations modal. Fleet passes `isUpdating` down as the `Modal`'s `isContentDisabled`, which both disables the submit button *and* lays an overlay over the form. The overlay is a bare `div` with no role and no text, so **the modifier class its wrapper gains is the only way to see it** — a documented class-fallback, not a shortcut.
6. ☐ *(test action, no user action)* Release the held PATCH.
   - ✅ *(UI)* the automations modal is hidden — the save completed and Fleet closed the dialog.
   - ✅ *(UI)* success toast `Successfully updated policy automations.`
7. ☐ *(API teardown)* restore the config snapshot; delete the seeded policy.

**Assessment**
- *Value:* the only double-submit guard asserted anywhere in Policies, and the only assertion in the area that Fleet's `Modal` disables its *content* and not just its submit button — two different props, and a regression can break either independently. The `page.route` hold makes it deterministic rather than a timing gamble, which is what earns it a place in a nightly suite.
- *Coverage gaps:* never attempts the thing the lock exists to prevent — no second **Save** click, no field edit, no Escape / **Cancel** while the save is in flight, so "locked" is asserted as *appearance* rather than as *behaviour*; no failure path (a PATCH released with a 4xx/5xx must re-enable the form and surface an error, and a form left permanently locked after a failed save is the more likely real bug); the enable-switch and URL input are never individually asserted as disabled, only the wrapper class; free's copy (POL-24) is not cross-checked against premium's.
- *Redundancy:* POL-24 is byte-identical apart from the missing `teamDropdown.select('All fleets')` line. Steps 2–4 re-walk POL-09's step 1 purely to get back into the modal; up to the **Save** click the two tests are the same.
- *Efficiency / smells:*
  - The premium copy again asserts **nothing premium** (see POL-09) — it runs on `All fleets`, drives global config, and never touches a team-scoped automations modal.
  - `.modal__content-wrapper-disabled` is a raw class locator **in the spec**, not in `PoliciesListPage`. The page object already owns `automationsModal` and `saveAutomationsButton`; the overlay belongs there too, with the same explanatory comment.
  - If an assertion in step 5 fails, `release()` is never called and the held route is abandoned — harmless (the context is torn down) but it means the failure screenshot always shows the modal mid-save, which is at least legible.
  - `page.route(/\/api\/[^/]+\/fleet\/config$/)` bypasses `apiUrl()` and hardcodes the route shape the suite otherwise routes through a helper. Justified (this is a *browser* route pattern, not an API call) but worth a note if Fleet ever versions the path differently.
  - The webhook really is enabled by this test before the restore, so it shares POL-09's global-config blast radius with `premium/dashboard/automations-activity.spec.ts` and `premium/settings/team-host-status-webhook.spec.ts` (different subtrees today).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-24 · Free • Policies • automations › the automations form locks itself while the save is in flight

- **File:** [`playwright/tests/e2e/free/policies/policy-automations.spec.ts`](../../tests/e2e/free/policies/policy-automations.spec.ts)
- **Grep:** `npx playwright test --project=free -g "Free • Policies • automations › the automations form locks itself while the save is in flight"`
- **Project:** free · **Mode:** UI
- **Isolation:** **serial describe, step 2 of 2** — `test.describe.configure({ mode: 'serial' })` ([`policy-automations.spec.ts:44`](../../tests/e2e/free/policies/policy-automations.spec.ts)), for the same reason as POL-23: both tests in the describe snapshot and restore the same global config key, and in parallel one test's `afterEach` restore landed between the other's save and its read-back. Mutates global app config with snapshot/restore in `beforeEach` / `afterEach`. ⚠️ **Not `--repeat-each`-safe** — serial orders tests within one describe in one worker, while `--repeat-each` copies are schedulable in parallel workers.
- **Preconditions (API):** `GET /config` snapshot; `POST /global/policies` seeds `pw-policy-auto-<nonce>` to enable the **Manage automations** button.
- **Data created:** one seeded policy (API-deleted after); config restored. The held PATCH is released and lands before the restore.

**Flow**

1. ☐ *(test setup)* Hold Fleet's config **PATCH** open with `page.route`; non-PATCH methods fall through.
2. ☐ Open `/policies/manage` via URL (no team dropdown on free) → click **Manage automations** → flip the switch on → click the **Webhook** radio → fill the destination URL.
   - ✅ *(UI)* modal visible; `aria-checked="true"`; Destination URL field visible.
3. ☐ Click **Save**; while the PATCH is held:
   - ✅ *(UI)* **Save** is disabled.
   - ✅ *(UI)* the modal's `.modal__content-wrapper-disabled` overlay is visible (`isUpdating` → `Modal`'s `isContentDisabled`; the overlay is a role-less, text-less `div`, so the wrapper's modifier class is the only handle).
4. ☐ Release the held PATCH.
   - ✅ *(UI)* the modal is hidden.
   - ✅ *(UI)* toast `Successfully updated policy automations.`
5. ☐ *(API teardown)* restore config; delete the seeded policy.

**Assessment**
- *Value:* confirms the in-flight lock is not premium-gated — the same `isUpdating` plumbing runs on free. That is a thin claim on its own; its value is as the free half of a pair, not as an independent test.
- *Coverage gaps:* same as POL-23 (no second submit, no error path, no per-control disabled assertions), plus the one thing free's file is uniquely positioned to check and doesn't: that the **premium-only workflows are absent or paywalled** in this modal while it is locked or otherwise.
- *Redundancy:* **byte-identical to POL-23 apart from the missing `teamDropdown.select('All fleets')`.** With POL-09 ↔ POL-10 that makes free's serial describe a copy of premium's, two tests each.
- *Efficiency / smells:* same as POL-23 — spec-level `.modal__content-wrapper-disabled` class locator that belongs in `PoliciesListPage`, spec-level `page.route` regex, and the abandoned hold on an assertion failure. Cost is one extra full browser session per nightly free run for an assertion the premium copy already makes against the same React component.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-25 · Premium • Policies • one policy's automations › install software, run script and continuous, saved together from the row, are stored and reopen

- **File:** [`playwright/tests/e2e/premium/policies/policy-automations.spec.ts`](../../tests/e2e/premium/policies/policy-automations.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "one policy's automations"`
- **Project:** premium · **Scopes:** Workstations only — it has no hosts, so nothing the automations point at ever runs
- **Mode:** UI+API · **Isolation:** its own describe, outside POL-09/23's serial one; touches no global config
- **Preconditions (API):** a Workstations policy `pw-policy-automations-<nonce>` (`platform: linux`), a script `pw-policy-automations-<nonce>.sh` and a generated `.deb` titled `fleet-pw-policy-automations-<nonce>`, all on Workstations.
- **Data created:** the three above, deleted in the `finally` — the policy first, since Fleet won't delete a title an install policy points at. The Workstations wipe in `cleanup.steps.ts` removes whatever a dead run leaves.

**Flow**

1. ☐ Dashboard → **Policies** → team dropdown **Workstations**.
   - ✅ *(UI)* the policy's Automations cell is a button named **Add automation** (it shows "---").
2. ☐ Search the policy, click its Automations cell.
   - ✅ *(UI)* the **Manage automations** modal reads "Manage automations for the `<policy>` policy on Workstations."
3. ☐ Tick **Install software**, pick the package's title; tick **Run script**, pick the script; tick **Continuous software & script automations**; **Save**.
   - ✅ *(UI)* each picker shows what was picked; the modal closes; toast `Successfully updated policy automations.`
   - ✅ *(API)* the policy's `install_software.software_title_id` is the title, `run_script.id` the script, `continuous_automations_enabled` true.
4. ☐ Look at the row again.
   - ✅ *(UI)* the cell is now named **Edit automations** and reads **2 automations** — Continuous is a setting, not an automation.
5. ☐ Reopen the modal.
   - ✅ *(UI)* Install software and Run script are ticked with the title and script shown; Continuous is ticked. **Cancel**.

**Assessment**
- *Value:* the only coverage of the row's per-policy automations modal, which is the UI path to script and software automations (`install-on-host`'s Deploy creates its policy itself). The API read-back catches a modal that looks saved and isn't; the reopen catches one that saved and can't show it.
- *Coverage gaps:* no **removal** (untick and save → the automations gone); the Resend configuration profile, Calendar and Conditional access rows aren't exercised (they read *Not enabled for Workstations* or are disabled there); the multi-package picker only renders for a title with more than one package; no validation case (ticking Install software and saving with nothing picked).
- *Efficiency:* ~10 s, no host.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-26 · Free • Policies • one policy's automations › a policy's automations modal offers webhooks or tickets, and nothing a fleet policy adds

- **File:** [`playwright/tests/e2e/free/policies/policy-automations.spec.ts`](../../tests/e2e/free/policies/policy-automations.spec.ts)
- **Grep:** `npx playwright test --project=free -g "one policy's automations"`
- **Project:** free · **Mode:** UI · **Isolation:** its own describe; touches no global config
- **Preconditions (API):** a global policy `pw-policy-automations-<nonce>`, deleted in the `finally`.

**Flow**

1. ☐ Dashboard → **Policies**.
   - ✅ *(UI)* the platform filter renders and the **Filter by automation** one doesn't (`renderAutomationFilter` is premium-only).
2. ☐ Search the policy, click its Automations cell (**Add automation**).
   - ✅ *(UI)* the modal lists exactly one automation, **Send webhook or create ticket**; none of Install software, Run script, Resend configuration profile, Calendar event, Conditional access; no Continuous checkbox. **Cancel**.

**Assessment**
- *Value:* free's half of POL-25. The rows are gated by the policy being global, not by the tier (`PolicyAutomationsFields`' `isGlobalPolicy`), and every policy on free is global — so a change that keyed the rows on something else would offer free automations its API refuses (`premium:"true"` fields).
- *Coverage gaps:* the webhook row is disabled until the scope-wide webhook is on, so ticking it is left to POL-10, which turns the webhook on first; free's modal says "…on **All fleets**", copy carried over from premium.
- *Efficiency:* a few seconds.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-27 · Premium • Policies • automation runs › a failing script is tried 3 times, and a refetch runs it again only once continuous automations are on

- **File:** [`playwright/tests/e2e/premium/exclusive/policies/policy-automation-runs.spec.ts`](../../tests/e2e/premium/exclusive/policies/policy-automation-runs.spec.ts)
- **Grep:** `npx playwright test --project=premium-exclusive policy-automation-runs` (by file name: the exclusive project's `testDir` is `tests/e2e`)
- **Project:** `premium-exclusive` — alone after the main project, since Fleet queues an automation's attempts below every user-requested activity and beside the install specs they starve · **Host:** the **Ubuntu VM** on the VMs fleet (`requireRealHost(request, 'linux')`) — scripts run only on real hosts, and the Macs have no `python3`
- **Mode:** UI+API · **Timeout:** 20 min, CI `HOST_RETRIES` · **Isolation:** one test; everything it makes is per-run (`pw-auto-run-<nonce>`)
- **Preconditions (API):** a manual label holding only the Ubuntu VM; a Python script on the VMs fleet that prints `pw policy automation <nonce>: failing on purpose` and exits 3; a fleet policy `SELECT 1 WHERE 0 > 1;` (it can't pass), `platform: linux`, `labels_include_any` that label, `script_id` that script, continuous off.
- **Data created:** the label, script and policy, deleted in an **`afterEach`** (policy first, any queued attempt cancelled) — it runs after a timeout, which a `finally` doesn't, and a continuous never-passing policy left behind would run its script on every refetch any spec asks of the VM. The VMs sweep removes `pw-*` policies, scripts and labels a killed run leaves, and the resting-state step cancels a queued `pw-*` script.

**Flow**

1. ☐ *(API)* Wait out any refetch in flight, request one, wait for the VM's `policy_updated_at` to move.
   - ✅ *(API)* exactly **3** `ran_script` activities carry the policy's id once none is queued — the first run and two retries — each with an empty actor (Fleet ran it) and exit code 3.
2. ☐ Host details → Activity → **Past** → the newest *"Fleet ran the `<script>` script on this host."*
   - ✅ *(UI)* the details modal reads `Exit code: 3 (Script failed.)` and shows the script's line followed by orbit's `script execution error: exit status 3`.
3. ☐ *(API)* Refetch again and wait for the policy results to land.
   - ✅ *(API)* nothing is queued for the script, and there are still 3 attempts: the policy was already failing, and continuous is off.
4. ☐ Dashboard → **Policies** → **VMs** → the policy's Automations cell → **Manage automations**.
   - ✅ *(UI)* Run script is ticked with the script shown. Tick **Continuous software & script automations**, **Save** → toast `Successfully updated policy automations.`
   - ✅ *(API)* `continuous_automations_enabled` is true.
5. ☐ *(API)* Refetch once more.
   - ✅ *(API)* exactly **6** attempts once none is queued — a fresh 3, each exit code 3. Continuous re-fires on a still-failing result *and* restarts the attempt count; without the restart the refetch would bring one run, not three.

**Assessment**
- *Value:* the only coverage of a policy's run-script automation actually running, of Fleet's retry ladder for it, and of continuous automations. The negative step is what makes the continuous step mean something: the same refetch with the setting off queues nothing.
- *Coverage gaps:* the hourly cadence isn't asserted (it's osquery's policy update interval, a config value); a script that *passes* isn't run (it would only show that a success isn't retried); the retry stopping once the policy passes isn't exercised (the SQL can't pass); install-software automations and their own cap (10 failures per host and installer per 24 h) are SWH-15's.
- *Efficiency:* six script runs and three refetches on the Ubuntu VM — **8.5 min** alone in `premium-exclusive` (the whole exclusive step 9.2 min); in the main project it took 10–13 min beside the install specs and, in CI, starved past its budget (Fleet queues an automation's attempts below every user-requested activity). The waits' worst-case budgets add up past the 20-min timeout, so a VM that's very slow shows as a timeout rather than at the slow wait; the `afterEach` makes that safe.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-28 · Premium • Policies • automations with no ticket integration › choosing Ticket offers "Add integration", which leads to Settings › Integrations

- **File:** [`playwright/tests/e2e/premium/policies/policy-automations.spec.ts`](../../tests/e2e/premium/policies/policy-automations.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "automations with no ticket integration"`
- **Project:** premium · **Scopes:** All fleets only
- **Mode:** UI+API · **Isolation:** its own describe, outside POL-09/23's serial one. It reads global config and never writes it: the switch and the radio are only changed in the form, and the test leaves through **Add integration** without saving.
- **Preconditions (API):** `GET /config` → `integrations.jira` and `integrations.zendesk` are both empty, asserted first so a configured integration fails as that rather than as a missing button. The instances guarantee it: gitops doesn't declare `integrations`, so every apply clears them, and no spec adds one. `POST /global/policies` seeds `pw-policy-no-integration-<nonce>` so **Manage automations** is enabled.
- **Data created:** the seeded global policy, deleted in the test's `finally`.

**Flow**

1. ☐ *(API)* Read `GET /config`.
   - ✅ *(API)* No Jira and no Zendesk integration.
2. ☐ Open `/dashboard` via URL → click **Policies** in the navbar → select **All fleets** in the dropdown.
   - ✅ *(UI)* First dashboard card visible; URL `/policies/manage`; dropdown reads "All fleets".
3. ☐ Click **Manage automations**, flip the switch on (**Add integration** stays disabled while it is off).
   - ✅ *(UI)* The automations modal is visible; switch `aria-checked="true"`.
4. ☐ Click the **Ticket** radio label (`selectTicketWorkflow`).
   - ✅ *(UI)* The **Ticket** radio is checked.
   - ✅ *(UI)* `You have no integrations.` is visible, and the **Add integration** button is enabled.
5. ☐ Click **Add integration**.
   - ✅ *(UI)* URL matches `/settings/integrations`.
   - ✅ *(UI)* The **Ticketing** heading is visible (`IntegrationsPage.ticketingHeading`).

**Assessment**
- *Value:* Pins the only Ticket state these instances can reach — no integration — with its copy and the link out to the page that fixes it. Cheap.
- *Coverage gaps:* Never with an integration: picking a Jira or Zendesk integration and saving a ticket workflow is untested on both tiers (it needs a Jira or Zendesk sandbox). **Add integration** being disabled while the switch is off isn't asserted. The Integrations page is checked only for its heading.
- *Redundancy:* POL-29 is the same test on free, byte-identical apart from the `teamDropdown.select('All fleets')` line, which is a no-op on free. `OtherWorkflowsModal` isn't tier-gated, so one `shared/` spec — as POL-32 is — would cover both tiers. Steps 2–3 enter the modal the way POL-09 does.
- *Efficiency / smells:* A few seconds. The policy is deleted in a `finally` only; a timeout skips it, and `cleanup-teardown`'s global-policy wipe catches it. `selectTicketWorkflow` clicks the label filtered by the text "Ticket", which would also match any later label in the modal containing that word.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-29 · Free • Policies • automations with no ticket integration › choosing Ticket offers "Add integration", which leads to Settings › Integrations

- **File:** [`playwright/tests/e2e/free/policies/policy-automations.spec.ts`](../../tests/e2e/free/policies/policy-automations.spec.ts)
- **Grep:** `npx playwright test --project=free -g "automations with no ticket integration"`
- **Project:** free · **Mode:** UI+API · **Isolation:** its own describe, outside POL-10/24's serial one; reads global config and never writes it
- **Preconditions (API):** `GET /config` → no Jira and no Zendesk integration (asserted); `POST /global/policies` seeds `pw-policy-no-integration-<nonce>`
- **Data created:** the seeded policy, deleted in the test's `finally`

**Flow**

1. ☐ *(API)* Read `GET /config`.
   - ✅ *(API)* No Jira and no Zendesk integration.
2. ☐ Open `/dashboard` via URL → click **Policies** in the navbar (no team dropdown on free) → **Manage automations** → flip the switch on → click the **Ticket** radio label.
   - ✅ *(UI)* Modal visible; `aria-checked="true"`; **Ticket** checked; `You have no integrations.` visible; **Add integration** enabled.
3. ☐ Click **Add integration**.
   - ✅ *(UI)* URL matches `/settings/integrations`; the **Ticketing** heading is visible.

**Assessment**
- *Value:* Confirms ticket workflows are offered on free and that the empty state links out to free's Integrations page.
- *Coverage gaps:* Same as POL-28.
- *Redundancy:* Identical to POL-28 minus the dropdown line (see POL-28 on a `shared/` spec).
- *Efficiency / smells:* Same as POL-28.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-30 · Premium • Policies • a fleet's failing-policies webhook › enabling it at a fleet's scope stores it on that fleet, not in global config

- **File:** [`playwright/tests/e2e/premium/policies/policy-automations.spec.ts`](../../tests/e2e/premium/policies/policy-automations.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "a fleet's failing-policies webhook"`
- **Project:** premium · **Scope:** a throwaway fleet, `pw-fleet-webhook-<nonce>`
- **Mode:** UI+API · **Isolation:** its own describe; reads global config and never writes it. Not on Workstations: saving a fleet's policy automations replaces the fleet's whole `webhook_settings` ([fleetdm/fleet#54619](https://github.com/fleetdm/fleet/issues/54619)), so on Workstations it would wipe the host-status webhook that `team-host-status-webhook.spec.ts` (SET-07) writes there in parallel.
- **Preconditions (API):** `POST /fleets` creates `pw-fleet-webhook-<nonce>`; `POST /fleets/<id>/policies` seeds `pw-fleet-webhook-policy-<nonce>` (`SELECT 1;`, `platform: linux`) so **Manage automations** is enabled.
- **Data created:** the fleet and its policy. The test's last step deletes the fleet (`DELETE /fleets/<id>`, which takes its policy with it); an `afterEach` deletes it again, tolerating a 404, for a body that failed or timed out.

**Flow**

1. ☐ Open `/dashboard` via URL → click **Policies** in the navbar → pick `pw-fleet-webhook-<nonce>` in the fleet dropdown (`selectByLabel`).
   - ✅ *(UI)* First dashboard card visible; URL `/policies/manage`; dropdown reads the fleet's name.
2. ☐ Click **Manage automations**.
   - ✅ *(UI)* The automations modal is visible, with the **Webhooks or tickets** heading a fleet's scope adds.
3. ☐ Flip the switch on → click the **Webhook** radio → fill `https://example.com/pw-fleet-policy-webhook` → **Save**.
   - ✅ *(UI)* `aria-checked="true"`; URL field visible; modal closes; toast `Successfully updated policy automations.`
   - ✅ *(API)* `GET /teams/<id>` → `webhook_settings.failing_policies_webhook.enable_failing_policies_webhook === true` and `destination_url` equals the submitted URL.
   - ✅ *(API)* `GET /config` → the global failing-policies webhook's `destination_url` is **not** this URL. Only the URL is compared: POL-09 may have the global webhook on from another worker.
4. ☐ Click **Manage automations** again.
   - ✅ *(UI)* The switch reads `aria-checked="true"` and the URL field holds the saved URL — the modal reopens on the fleet's webhook.
5. ☐ *(API)* `DELETE /fleets/<id>`.

**Assessment**
- *Value:* The only coverage of a fleet's own failing-policies webhook — the half of the automations modal that saves through the fleet (`team.webhook_settings`) rather than global config. Reading both sides back catches a save routed to the wrong scope, and the reopen is the area's only rehydration check of the scope-wide modal.
- *Coverage gaps:* Ticking a fleet policy for the webhook (the fleet's `policy_ids`) and turning it off aren't exercised; POL-09 covers both, globally only. #54619 is sidestepped, not pinned: the throwaway fleet has no host-status webhook for the save to wipe. The global negative check compares the URL alone, so a save that also flipped the global enabled flag would pass. The Ticket workflow at a fleet's scope is untested.
- *Redundancy:* Steps 2–3 repeat POL-09's step 1 at a different scope. No free twin — fleets are premium-only.
- *Efficiency / smells:* A fleet created and deleted per run, a few seconds. While it exists it shows in every fleet dropdown, as `historical-data-collection.spec.ts`'s fleet does. A run killed before the `afterEach` leaves the fleet behind until `cleanup.steps.ts`'s `pw-*` fleet sweep removes it.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-31 · Policies — fleet isolation › a fleet's policy is listed under its fleet and not under another

- **File:** [`playwright/tests/e2e/premium/policies/policies.spec.ts`](../../tests/e2e/premium/policies/policies.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "Policies — fleet isolation"`
- **Project:** premium · **Scopes:** Workstations, then VMs
- **Mode:** UI · **Isolation:** its own describe, outside the CRUD scope loop; reading the VMs fleet's list changes nothing on it
- **Preconditions (API):** `POST /fleets/<Workstations>/policies` seeds `pw-policy-isolation-<nonce>` (`SELECT 1;`).
- **Data created:** the seeded Workstations policy, deleted in the test's `finally` (`POST /fleets/<id>/policies/delete`); after a timeout, `cleanup-teardown`'s Workstations wipe removes it.

**Flow**

1. ☐ Open `/dashboard` via URL → click **Policies** in the navbar → select **Workstations** in the dropdown → type the policy name in **Search by name**.
   - ✅ *(UI)* First dashboard card visible; URL `/policies/manage`; dropdown reads "Workstations".
   - ✅ *(UI)* A row with the name is visible.
2. ☐ Select **VMs** in the dropdown → type the policy name in **Search by name** again.
   - ✅ *(UI)* Dropdown reads "VMs"; the URL carries `fleet_id=<VMs id>`.
   - ✅ *(UI)* Once the table settles (`waitForSettled`), the empty state is visible — proof the VMs list loaded with this search — and no row has the name.

**Assessment**
- *Value:* Pins the premium isolation contract on the list: a fleet's view shows its own policies and the inherited global ones, never a sibling fleet's. The empty-state assertion makes the missing row an answer rather than a page still loading.
- *Coverage gaps:* One direction only (Workstations → VMs), and not under Unassigned. A Workstations policy's details page opened with the VMs `fleet_id` isn't tried. Inherited global policies appearing under a fleet aren't asserted.
- *Redundancy:* Step 1 repeats POL-01's last step (a Workstations policy found under Workstations) with an API-seeded policy. No free twin — fleets are premium-only.
- *Efficiency / smells:* A few seconds and one API seed. VMs is only read, which keeps the real-host fleet safe to use as the "other" fleet.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-32 · Shared • Policies • AI Autofill › Autofill writes a description and a resolution for the SQL

- **File:** [`playwright/tests/e2e/shared/policies/policy-autofill.spec.ts`](../../tests/e2e/shared/policies/policy-autofill.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "Shared • Policies • AI Autofill"` (and `--project=free`)
- **Project:** premium **and** free (`shared/`) · **Scopes:** All fleets on premium (the dropdown select is a no-op on free)
- **Mode:** UI+API · **live call to fleetdm.com** · **Timeout:** 90 s; each field waits up to 35 s, since Fleet gives fleetdm.com 30 s before it answers 422 (an answer usually takes ~3 s) · **Isolation:** independent; saves nothing and writes no config
- **Preconditions (API):** `GET /config` → `server_settings.ai_features_disabled === false`: Generative AI is on (Settings › Advanced › Features), which is Fleet's default and how both instances run. Asserted first, so a disabled setting fails as that rather than as an empty field.
- **Data created:** none — the Save policy modal is cancelled. The SQL does leave the instance: Fleet forwards it to fleetdm.com.

**Flow**

1. ☐ *(API)* Read `GET /config`.
   - ✅ *(API)* Generative AI is on.
2. ☐ Open `/dashboard` via URL → click **Policies** in the navbar → select **All fleets** (premium) → click **Add policy**.
   - ✅ *(UI)* First dashboard card visible; URL `/policies/manage`, then `/policies/new`.
3. ☐ Enter SQL `SELECT name, version FROM os_version;` (Ace `setValue`), click **Save**.
   - ✅ *(UI)* `.ace_content` renders the SQL; the **Save policy** modal is visible; **Description** and **Resolution** are empty.
4. ☐ Click **Autofill** beside **Description**. Fleet's `POST /autofill/policy` (no license check) forwards the SQL to fleetdm.com, which answers with an LLM-written description and resolution.
   - ✅ *(UI)* **Description** is not empty (within 35 s).
5. ☐ Click **Autofill** beside **Resolution**; it fills from the same answer.
   - ✅ *(UI)* **Resolution** is not empty (within 35 s).
6. ☐ Click **Cancel** in the modal.
   - ✅ *(UI)* The modal closes.

**Assessment**
- *Value:* The only coverage of AI Autofill, and of the whole chain behind it: Fleet's endpoint, its proxy to fleetdm.com, the LLM, and the modal writing one answer into two fields. A `page.route` stub would prove only that React copies a response into textareas; the live call is the version that catches the outage a customer would see.
- *Coverage gaps:* Only non-emptiness is asserted — the wording is an LLM's, so any text passes, relevant or not. The disabled path (Generative AI off: both buttons disabled, tooltip "AI features are disabled in organization settings") is untested; it needs a global config write, so it would belong in `exclusive/`. The "Thinking..." in-flight state, the 422 on an upstream failure, and saving the filled-in text aren't exercised. Autofill exists only in the Save policy modal, so the edit form has nothing to cover.
- *Redundancy:* Runs once per tier from `shared/`. The free run is the evidence Autofill isn't paywalled, matching the endpoint's missing license check; otherwise the two runs are the same test.
- *Efficiency / smells:* Seconds when fleetdm.com answers in its usual ~3 s, up to the 90-s timeout when it doesn't. It depends on a service outside the QA instances: a fleetdm.com outage turns it red on both tiers, which a run review should read as a customer-visible outage, not a test bug. The two buttons are both named "Autofill"; `autofillButton(field)` tells them apart by the `<label>` holding each.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-33 · Shared • Policies • policy hosts › a policy saved for macOS only runs on macOS hosts

- **File:** [`playwright/tests/e2e/shared/policies/policy-hosts.spec.ts`](../../tests/e2e/shared/policies/policy-hosts.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "a policy saved for macOS only"` (and `--project=free`)
- **Project:** premium **and** free (`shared/`) · **Scopes:** All fleets on premium (a global policy; the dropdown select is a no-op on free)
- **Mode:** UI+API · **Isolation:** independent; simulations are only read (`findSimulations` darwin 6, linux 6, windows 2), never moved
- **Preconditions (API):** an online, non-MDM simulation of each platform past the borrowing offset.
- **Data created:** two global policies, `pw-policy-hosts-<nonce>-any` (API, every platform) and `…-macos` (UI); both deleted in the `finally` (cleanup wipes global policies too).

**Flow**

1. ☐ *(API)* Create `…-any`: `SELECT 1;`, no platform.
2. ☐ Open `/dashboard` → **Policies** in the navbar → **All fleets** (premium) → **Add policy**; set the SQL to `SELECT 1;` → **Save**; in the **Save policy** modal fill the name and description, leave only **macOS** ticked, **Save**.
   - ✅ *(UI)* toast "Policy created."; the URL is `/policies/:id`.
3. ☐ *(API)* `GET /global/policies/:id`.
   - ✅ *(API)* `platform` is `darwin`.
4. ☐ *(API)* `GET /hosts/:id` for the three simulations.
   - ✅ *(API)* the macOS simulation lists both policies; the Linux and Windows ones list `…-any` and not `…-macos`.
5. ☐ Open the macOS simulation's **Policies** tab.
   - ✅ *(UI)* the `…-macos` row is there (status `---`: no answer is needed for a policy to be listed).
6. ☐ Open the Linux simulation's **Policies** tab.
   - ✅ *(UI)* the `…-any` row is there and the `…-macos` row isn't.

**Assessment**
- *Value:* The server half of platform targeting (`FIND_IN_SET(<host platform>, p.platforms)`), which nothing else asserts, and the only place the Save policy modal's platform checkboxes are read back as stored. The CRUD spec (POL-03/04) ticks Windows + Linux on edit and never reads them.
- *Coverage gaps:* One platform only, set at create; an edit that changes the platforms and a policy for several platforms aren't covered. ChromeOS has no host here. The policies list's "Targeted platforms" column isn't read.
- *Redundancy:* premium and free behave the same, so it is one shared test; label targeting (LT-08) covers a fleet policy's other target.
- *Efficiency / smells:* Seconds. The UI half proves the tab renders what the API lists, on two hosts; the API half covers the third platform without a third page load.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-34 · Shared • Policies • policy hosts › a host's policy links to the hosts that gave the same answer

- **File:** [`playwright/tests/e2e/shared/policies/policy-hosts.spec.ts`](../../tests/e2e/shared/policies/policy-hosts.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "a host's policy links"` (and `--project=free`)
- **Project:** premium **and** free (`shared/`) · **Scopes:** none (a host's page; the link carries no fleet)
- **Mode:** UI+API · **Timeout:** 240 s (two refetches, each answered within ~20 s) · **Isolation:** independent; `findSimulations` linux 6–7, refetched, never moved
- **Preconditions (API):** two online, non-MDM Linux simulations.
- **Data created:** two global Linux-only policies, `pw-policy-hosts-<nonce>-pass` (`SELECT 1;`) and `…-fail` (`SELECT 0;`, the one query a simulation fails); deleted in the `finally`. Linux-only keeps the failing one off the macOS and Windows VMs; neither has an automation.

**Flow**

1. ☐ *(API)* Create both policies; for each simulation wait out any outstanding refetch, then request one.
   - ✅ *(API)* both simulations answer `pass` and `fail` (polled, up to 180 s).
2. ☐ For each policy in turn, open the first simulation's **Policies** tab, hover the policy's row and click **View all hosts**.
   - ✅ *(UI)* the URL is `/hosts/manage` with `policy_id=<id>` and `policy_response=passing` (or `failing`).
   - ✅ *(UI)* the pill is "hosts filtered by <policy>"; the Pass / Fail control reads **Pass** (or **Fail**).
3. ☐ Search the list for each simulation by name.
   - ✅ *(UI)* each is listed.
4. ☐ Switch the control to the other answer and search for each simulation again.
   - ✅ *(UI)* the pill still names the policy; the table renders and neither simulation is listed.

**Assessment**
- *Value:* The only coverage of a host's policy → hosts hand-off, and of the Hosts list filtered by a policy *and* an answer: the button's two URLs, the pill, the Pass / Fail control, and Fleet's live per-answer host query. Both answers are exercised, not just whatever the first row's is.
- *Coverage gaps:* Containment, not equality: every Linux simulation that runs the policy on its hourly cycle is listed too, so a list that wrongly added hosts with *no* answer would pass. The page's fleet context (`fleet_id`) is never set from a host page, so the link's fleet parameter is covered only by POL-35.
- *Redundancy:* premium and free behave the same; one shared test. POL-35 reaches the same filtered list from the policies list.
- *Efficiency / smells:* ~20–40 s, most of it the refetch. A refetch merges into one already outstanding, so it is waited out first (`waitForNoPendingRefetch`). The control is react-select v1 with no accessible name, so its value is read by class (`HostsListPage.policyResponseValue`).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-35 · the Pass count opens exactly the hosts passing the policy, and Fail those failing it

- **File:** [`playwright/tests/e2e/premium/policies/policy-host-counts.spec.ts`](../../tests/e2e/premium/policies/policy-host-counts.spec.ts)
- **Grep:** `npx playwright test --project=premium policy-host-counts`
- **Project:** premium · **Scopes:** VMs
- **Mode:** UI+API · **Isolation:** read-only
- **Preconditions (API):** the VMs fleet's gitops policy "Claude is installed (macOS)" (`gitops/premium-fleetqa/fleets/vms.yml`), which carries an install automation and is only read.
- **Data created:** none.

**Flow**

1. ☐ Open `/dashboard` → **Policies** → select **VMs**; search for the policy; click its **Pass** cell's "N hosts" link.
   - ✅ *(UI)* the URL is `/hosts/manage` with the policy's id, `policy_response=passing` and `fleet_id=<VMs>`.
   - ✅ *(UI)* the pill is "hosts filtered by Claude is installed (macOS)"; the control reads **Pass**.
2. ☐ Read the listed hosts.
   - ✅ *(UI+API)* they are exactly `GET /hosts?policy_id&policy_response=passing&fleet_id`, by name, and there is at least one (the Mac VM keeps Claude installed).
3. ☐ Switch the control to **Fail**.
   - ✅ *(UI+API)* the table renders and lists exactly the API's failing hosts (usually none).

**Assessment**
- *Value:* The policies list's Pass / Fail links, which were untested, and the one place the link's `fleet_id` is asserted. Set equality is affordable because the VMs fleet holds a handful of hosts.
- *Coverage gaps:* The count itself isn't compared with anything: it is the hourly job's snapshot, and the list is live. A policy created in the test can't be used, so the link of a brand-new policy (`---`) isn't covered. No free twin: the counts come from an hourly job, and free has no policy that survives cleanup.
- *Redundancy:* The filtered list is POL-34's destination; this reaches it from the list.
- *Efficiency / smells:* Seconds. Depends on a gitops-declared policy staying declared; a missing one fails with the re-apply instruction. Simulations the label-targeting specs borrow onto the VMs fleet can answer mid-test, so each comparison re-reads both sides until they agree.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-36 · Premium • Policies • role access › <role> is shown the policy controls its role grants

- **File:** [`playwright/tests/e2e/premium/policies/role-access.spec.ts`](../../tests/e2e/premium/policies/role-access.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "Premium • Policies • role access › .* is shown"`
- **Project:** premium · **Variants (7):** `global-maintainer`, `global-observer`, `global-observer-plus`, `global-technician` on All fleets; `team-admin`, `ws-maintainer`, `ws-observer` on Workstations
- **Mode:** UI · **Isolation:** one test per role, each signed in through `withStaticUser`'s cached session; read-only apart from its seeded policies
- **Preconditions (API):** `POST /global/policies` seeds `pw-role-pol-global-<role>-<nonce>`; a team role also gets `POST /fleets/<Workstations>/policies` → `pw-role-pol-ws-<role>-<nonce>`.
- **Data created:** the seeded policies, deleted in an `afterEach` (global by id; Workstations by name, so one stored before a failure is found). `cleanup-setup` drains both scopes too.

**Flow**

1. ☐ Sign in as the role → open `/policies/manage` on All fleets (global roles) or Workstations (team roles; `ws-*` have no fleet picker).
   - ✅ *(UI)* `ws-*`: no fleet picker, the page title is "Workstations".
2. ☐ Search the list down to the role's own policy (the global one for a global role, the Workstations one for a team role).
   - ✅ *(UI)* exactly one row; its **Automations** cell is visible.
   - ✅ *(UI)* GM, TA, TM: a row checkbox and an Automations cell that's a button. GO, GO+, GT, TO: neither.
   - ✅ *(UI)* **Add policy** for GM, TA, TM only; **Manage automations** for TA only.
3. ☐ *(TA only)* Click **Manage automations**, then Escape.
   - ✅ *(UI)* the automations modal opens with its **Webhook** option, and closes. Nothing is saved (POL-30 saves it as admin on a throwaway fleet).
4. ☐ *(team roles)* Search for the global policy.
   - ✅ *(UI)* its row has the **Inherited** tag and no checkbox.
   - ✅ *(UI)* opened, it shows **Show query**; **Run policy** for TA and TM, not TO; **Edit policy** for none of them.
5. ☐ Open the role's own policy from the list.
   - ✅ *(UI)* its name heading and **Show query**; **Run policy** for every role but GO and TO; **Edit policy** for GM, TA, TM.
6. ☐ *(GO, GO+, GT, TO)* Open `/policies/new` (with Workstations' `fleet_id` for TO).
   - ✅ *(UI)* the 403 page: "403", "Access denied."

**Assessment**
- *Value:* The first assertion of what each role is *shown* on Policies; the API probes only cover create. The technician and observer+ columns are the unusual ones (Run without Edit or Add policy). Every absence is anchored on the same screen's seeded row, Automations cell or Show query, so a page that never rendered can't pass. The cells come from Fleet's gating (`ManagePoliciesPage`, `PoliciesTableConfig`, `PolicyDetailsPage`, the router).
- *Coverage gaps:* The global roles never read a fleet's list (a global maintainer may edit inherited policies). TO+ has no static user. #54624 (GO+ on an Unassigned policy) is POL-38, skipped.
- *Redundancy:* None; the admin's controls are POL-01's.
- *Efficiency / smells:* A few seconds a role; one login per role per run through the session cache.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-37 · Premium • Policies • role access › <team-admin | ws-maintainer> creates a Workstations policy from the UI

- **File:** [`playwright/tests/e2e/premium/policies/role-access.spec.ts`](../../tests/e2e/premium/policies/role-access.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "creates a Workstations policy from the UI"`
- **Project:** premium · **Variants (2):** `team-admin`, `ws-maintainer` · **Scope:** Workstations
- **Mode:** UI+API · **Isolation:** one test per role; its policy is its own
- **Data created:** `pw-role-pol-create-<role>-<nonce>` on Workstations, tracked by name before the save and deleted in an `afterEach`.

**Flow**

1. ☐ Sign in as the role → Policies on Workstations → **Add policy** → SQL `SELECT 1;` → **Save** → name it in the Save policy modal → **Save**.
   - ✅ *(UI)* toast "Policy created."; the URL is the new policy's details page.
2. ☐ *(API)* Read the policy back.
   - ✅ *(API)* `GET /fleets/<Workstations>/policies/<id>`: the name, `team_id` = Workstations, `author_email` = the role's email; and it's in the fleet's list.

**Assessment**
- *Value:* A team role's save goes to the fleet's endpoint and is authored by that role. A team role's save touching something it can't write is a known bug class here (#54623).
- *Coverage gaps:* No edit or delete as the role: they take the admin's form and endpoints (POL-03/05). A global maintainer's fleet create runs the admin's code path and isn't covered.
- *Redundancy:* The form steps are POL-01's.
- *Efficiency / smells:* Seconds.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-38 · Premium • Policies • role access › global-observer-plus is offered Run policy on an Unassigned policy *(skipped)*

- **File:** [`playwright/tests/e2e/premium/policies/role-access.spec.ts`](../../tests/e2e/premium/policies/role-access.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "Run policy on an Unassigned policy"`
- **Project:** premium · **Scope:** Unassigned
- **Mode:** UI · **Isolation:** skipped behind [fleetdm/fleet#54624](https://github.com/fleetdm/fleet/issues/54624) (`docs/blocked-by-product-bugs.md`)
- **Preconditions (API):** `POST /fleets/0/policies` seeds `pw-role-pol-unassigned-<nonce>`, deleted in the `afterEach`.

**Flow**

1. ☐ Sign in as `global-observer-plus` → Policies → **Unassigned** → search the policy → open it.
   - ✅ *(UI)* **Show query** and **Run policy**; no **Edit policy**.

**Assessment**
- *Value:* Fleet's role table says observer+ runs every policy; the UI hides Run on Unassigned because `isObserverPlus` needs a non-zero fleet id. Run un-skipped on 2026-10-05, it failed on exactly that button.
- *Coverage gaps:* None beyond the bug.
- *Efficiency / smells:* Skipped: costs nothing until the fix ships.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-39 · Free • Policies • role access › <role> is shown the policy controls its role grants

- **File:** [`playwright/tests/e2e/free/policies/role-access.spec.ts`](../../tests/e2e/free/policies/role-access.spec.ts)
- **Grep:** `npx playwright test --project=free -g "Free • Policies • role access"`
- **Project:** free · **Variants (2):** `global-maintainer`, `global-observer`
- **Mode:** UI · **Isolation:** one test per role through `withStaticUser`
- **Data created:** `pw-role-pol-<role>-<nonce>` (global), deleted in an `afterEach`.

**Flow**

1. ☐ Sign in as the role → `/policies/manage` → search the policy.
   - ✅ *(UI)* one row, its **Automations** cell visible; GM: a row checkbox, the cell a button, **Add policy**; GO: none of them; **Manage automations** for neither.
2. ☐ Open the policy.
   - ✅ *(UI)* name heading and **Show query**; **Run policy** and **Edit policy** for GM only.
3. ☐ *(GO)* Open `/policies/new`.
   - ✅ *(UI)* the 403 page.

**Assessment**
- *Value:* Free's half of POL-36; free has no picker or inherited rows, so it's an explicit sibling rather than `shared/`.
- *Coverage gaps:* As POL-36's.
- *Efficiency / smells:* Seconds.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-40 · Premium • Policies • automations › a fleet admin can't add an inherited policy to the global webhook *(skipped)*

- **File:** [`playwright/tests/e2e/premium/policies/policy-automations.spec.ts`](../../tests/e2e/premium/policies/policy-automations.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "a fleet admin can't add an inherited policy"`
- **Project:** premium · **Scope:** Workstations, on the inherited global policy the describe seeds
- **Mode:** UI+API · **Isolation:** skipped behind [fleetdm/fleet#54623](https://github.com/fleetdm/fleet/issues/54623). It sits in POL-09/23's serial describe because it needs the global failing-policies webhook on, which those tests own and restore in their `afterEach`.

**Flow**

1. ☐ *(API)* `PATCH /config`: the global failing-policies webhook on, with a `pw` URL (restored after).
2. ☐ Sign in as `team-admin` → Policies on Workstations → the inherited policy's **Automations** cell.
   - ✅ *(UI)* "Manage automations for the <name> policy on All fleets."; the **Send webhook** checkbox is disabled.

**Assessment**
- *Value:* Today a fleet admin can tick it, and Save answers 403 with the modal left open and no error. Run un-skipped on 2026-10-05, the checkbox was enabled.
- *Coverage gaps:* The failed save's missing error isn't asserted. It goes away with the fix.
- *Efficiency / smells:* Skipped.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-41 · Premium • Policies • the automation filter by scope › offers only the automation types the scope supports

- **File:** [`playwright/tests/e2e/premium/policies/policy-automations.spec.ts`](../../tests/e2e/premium/policies/policy-automations.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "the automation filter by scope"`
- **Project:** premium · **Scopes:** All fleets, Unassigned, Workstations (`test.step` each)
- **Mode:** UI · **Isolation:** its own describe; read-only apart from its seeded policy
- **Preconditions (API):** `POST /global/policies` seeds `pw-policy-filter-<nonce>`: the filter is disabled on a scope with no policies, and a global one is listed or inherited everywhere. Deleted in an `afterEach`.

**Flow**

1. ☐ For each scope: Policies → the scope → click **Filter by automation**.
   - ✅ *(UI)* **All automations** is offered (the menu is open).
   - ✅ *(UI)* All fleets: **Webhooks or tickets** only. Unassigned: every type but **Calendar**. Workstations: all seven (Software, Patch, Scripts, Profiles, Calendar, Conditional access, Webhooks or tickets).

**Assessment**
- *Value:* The filter's per-scope options (`getValidAutomationTypesForTeam`), which nothing tested; free only asserts the filter is absent (POL-26). It runs as the admin: the options follow the scope, not the role.
- *Coverage gaps:* Choosing an option and the filtered list it gives aren't exercised.
- *Efficiency / smells:* Seconds.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

### POL-42 · Policies • run live on the real VMs › marks each VM Pass or Fail, sums them as Yes / No, sorts the hosts case-insensitively and exports them

- **File:** [`playwright/tests/e2e/shared/policies/live-policy-run.spec.ts`](../../tests/e2e/shared/policies/live-policy-run.spec.ts)
- **Grep:** `npx playwright test --project=premium live-policy-run` (and `--project=free`)
- **Project:** premium, free · **Hosts:** the macOS, Windows and Linux **real VMs** (VMs fleet on premium, Unassigned on free), picked by name
- **Mode:** UI+API · **Isolation:** one test; its own policy, deleted in an `afterEach`
- **Preconditions (API):** the three VMs online (`requireRealHost`); their names sort differently with and without case (checked first). `POST /global/policies` creates `pw-live-policy-<nonce>`, `SELECT 1 FROM os_version WHERE platform = 'darwin';` (a row on macOS only).

**Flow**

1. ☐ Dashboard → **Policies** → **All fleets** → search the policy → open it → **Run policy**.
   - ✅ *(UI)* the details page's heading is the policy's name; the URL is `/policies/:id/live`.
2. ☐ On **Select targets**, search each VM by name and click its result.
   - ✅ *(UI)* three hosts in the selected table; "3 hosts targeted (100% online)".
3. ☐ **Run**.
   - ✅ *(UI)* "Policy finished" (bounded at 150 s); "3 hosts targeted", "100% responded"; "3 results", three rows.
4. ☐ Read the table.
   - ✅ *(UI)* the Mac is **Pass**, the Windows and Linux VMs **Fail**.
5. ☐ Read the summary; hover **33%**, then **67%**.
   - ✅ *(UI)* "(Yes: 33%, No: 67%)"; the tooltips read "1 host" and "2 hosts".
6. ☐ Click the **Host** header, then again.
   - ✅ *(UI)* ascending is `macos-…`, `ubuntu-…`, `WIN-…` (case-insensitive; a case-sensitive sort would put `WIN-…` first); descending is the reverse.
7. ☐ **Export results**.
   - ✅ *(UI)* the file is `<policy> - Results (MM-dd-yy hh-mm-ss).csv`; its columns are `host`, `status`, and it holds one row per VM: `yes` for the Mac, `no` for the others.

**Assessment**
- *Value:* The first test to run a policy live; until now the suite only checked that **Run policy** is shown. Only real hosts can fail a policy (simulations answer every query with a row), so this is the one place Fail, the No share and the export's `no` are proven.
- *Coverage gaps:* The Errors tab and **Export errors** (a query that errors on one VM), **Run again**, **Stop**, and running from the policy editor before saving.
- *Efficiency / smells:* ~20 s; live queries use osquery's distributed path, not the VMs' install and script queue. A VM offline fails the target-count check with Fleet's own number in the message.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

## Area observations

**Coverage map**

| Feature / user flow | Covered by | Gap |
|---|---|---|
| Create policy (editor → Save policy modal → redirect) | POL-01, POL-02 | Modal defaults (platform, **All hosts**, **Critical**) never verified post-save; no duplicate/empty-name negative path |
| Edit policy (all fields + SQL + platforms) | POL-03, POL-04 | Edited **platform set is never asserted after save**; no cancel/discard path |
| Delete policy | POL-05, POL-06 | Single row only — real multi-row bulk delete, select-all, modal count copy, cancel path untested |
| Policy list: search | POL-01/03/05 (as a lookup mechanism) | Never asserted as a feature (no negative search, no result-count check) |
| Policy list: sort, pagination, `automation_type` filter | — (only `tests/loadtest/policies.spec.ts`, timing-only) | Untested functionally |
| Policy list: Passing/Failing host counts, inherited-policies section (team scope) | POL-35 (the Pass / Fail links of a VMs-fleet policy) | The counts themselves (an hourly snapshot) and the inherited-policies section untested |
| Platform targeting: which hosts list a platform-scoped policy | POL-33 (macOS only, both tiers) | Several platforms, and a platform changed on edit |
| A host's Policies tab → hosts with the same answer | POL-34 (both answers, both tiers) | Containment only: other hosts answer hourly |
| Policy list: Automations column | POL-09/10 (**Add automation** ↔ **Edit automation: Webhook**), POL-25 (**Edit automations**, "2 automations") | Ticket and calendar summaries untested |
| Policy details page | POL-01/03 (name/desc/resolution, **Show query**, button presence) | Passing/failing host tabs + host links untested; **Platforms** field never read (locator exists, unused) |
| Run a policy live | POL-42 (three real VMs: Pass / Fail, Yes / No and tooltips, Host sort, Export results) | Errors tab, Export errors, Run again, Stop; a live run from the editor before saving |
| Team scoping of policies (premium) | POL-01/03/05 via the dropdown + `fleet_id`; POL-31 (a Workstations policy is absent under VMs) | Leakage checked in one direction only (Workstations → VMs), not under Unassigned; `Unassigned` scope not in `SCOPES` at all |
| Failing-policies webhook automation (global) | POL-09, POL-10 (enable → one policy in `policy_ids` → off) | Scope-wide modal never reopened (no rehydration check); unticking a policy untested; no invalid-URL validation; the webhook never fires (`SELECT 1;` passes everywhere) |
| Failing-policies webhook automation (a fleet's) | POL-30 (on a throwaway fleet) | A fleet policy's ticking and the off path untested; #54619 sidestepped, not pinned |
| Automations modal in-flight lock (double-submit guard) | POL-23, POL-24 | Asserted as appearance (Save disabled + `.modal__content-wrapper-disabled` overlay), never as behaviour — no second submit attempt, no Cancel/Escape mid-save, and **no failed-save path**, which is where a permanently-locked form would actually ship |
| Other policy automations: install software, run script, continuous (premium) | POL-25 (saved and reopened), POL-27 (a failing script run on the Ubuntu VM) | Calendar events and conditional access untested; removing an automation untested |
| Ticket workflows (Jira / Zendesk) | POL-28, POL-29 (no integration: the empty state and its link to Settings › Integrations) | A configured integration never exercised — it needs a Jira or Zendesk sandbox |
| Platform-compatibility badge | POL-11…POL-18 | Only macOS-specific tables sampled; no Windows/Linux-only table; identity asserted in 3 of 6 cases |
| SQL syntax warning + save gating | POL-19…POL-22 (POL-19/20 save the broken SQL and reopen it) | Re-enable path untested; the error clearing on a corrected query untested; broken SQL saved only as a new policy, never from an edit |
| AI Autofill (Save policy modal) | POL-32 (both tiers, live fleetdm.com call) | Only non-emptiness asserted; the Generative-AI-off path untested |
| Free-tier paywalls for premium policy features | — (`tests/e2e/free/paywalls.spec.ts` has no policies entry) | Untested |
| Activity-feed copy for policies | POL-07, POL-08 (+ regex unit test `tests/api/activity-copy.spec.ts`) | Order and count not asserted |
| What each role is shown (list, details, `/policies/new`) | POL-36 (7 roles, premium), POL-39 (2, free); a team role's create POL-37; #54623 / #54624 skipped (POL-40, POL-38) | TO+ (no static user); a global role on a fleet's list |
| Automation filter options by scope | POL-41 | Choosing an option and its filtered list |
| Policy API contracts / roles / gitops | `tests/api/role-access/**`, `tests/api/gitops-verify/policies.spec.ts` | out of scope here |

**Duplication**

1. **Free ↔ premium mirrors.** 14 of 32 entries are near-exact copies: CRUD (POL-01/03/05/07 ↔ POL-02/04/06/08) and automations (POL-09 ↔ POL-10, POL-23 ↔ POL-24, POL-28 ↔ POL-29). Per the suite's tier-separation preference the CRUD pair is defensible (different license path). The automations pairs are not — POL-09/23/28 assert nothing premium and POL-10/24/29 assert nothing free-specific. The mirror costs three browser sessions per tier.
2. **sql-validation mirrors.** POL-11/13/15/19/21 ↔ POL-12/14/16/20/22 are the same client-side component checks on both tiers, with premium arbitrarily holding two extras (POL-17, POL-18). `PlatformCompatibility` / `PolicyForm` have no tier branch, so the free copies are pure cost.
3. **Triple existence proof.** Each CRUD step confirms the same fact three ways: details page render + `/activities` API + a list-row search.
4. **Activity double-coverage.** The three `assertActivity` calls in the CRUD spec assert the same events POL-07/08 then walk in the UI, and the regexes themselves are unit-tested in `tests/api/activity-copy.spec.ts`.
5. **Compatibility-case shape.** POL-15, POL-17 and (partly) POL-18 are the same assertion with a different table name — natural table-driven parameters, currently three full browser tests.

**UI-vs-API balance**

- The CRUD spec's three `assertActivity` calls are the only API assertions there, and they are **redundant with POL-07/08**, which check the same events through the feed. One layer should go; the UI walk is the one that owns the copy contract, so keep it plus at most one API assert (delete, where no UI proof of server state exists).
- POL-09/10's `GET /config` checks are **justified** — the toast is not evidence of persistence. The row's cell name is their UI complement for the per-policy step, but the scope-wide modal is never reopened, so a rehydration bug there ships green at global scope (POL-30 reopens it at a fleet's).
- POL-28/29 and POL-32 use the API only as a precondition guard (no ticket integration; Generative AI on), so an instance in the wrong state fails with that message rather than as a missing control. POL-30's two API reads are the contract itself: where the save landed, and where it didn't.
- POL-05/06 rely on `deleted_policy` as the only proof the record is gone; the UI side is a name-filtered `toHaveCount(0)` plus a tautological `rowOrEmpty()`. Either assert the unfiltered list/empty state properly or check `GET /policies` — currently neither is strong.
- POL-11…POL-22, POL-19/20's save and reopen aside, make **no server calls at all**. They are React component tests running in a full browser session against a live instance.
- Setup/teardown in POL-09/10 (and POL-23/24) is correctly API-driven (seed policy, snapshot/restore config).
- POL-23/24 make **no assertion through the API at all** and are the better shape for it: the claim is about what the *form* does while a request is open, so the network is the instrument (`page.route` holding the PATCH), not the oracle. Worth copying wherever else the suite wants an in-flight state — it replaces a sleep with a deterministic hold.

**Quick wins**

1. Assert the edited platform set after save — `PolicyDetailsPage.platformsDefinition` is built and never used ([`PolicyDetailsPage.ts:54`](../../pages/policies/PolicyDetailsPage.ts)); today `['Windows','Linux']` is written and never read back ([`policies.spec.ts:88`](../../tests/e2e/premium/policies/policies.spec.ts), [`free/…/policies.spec.ts:65`](../../tests/e2e/free/policies/policies.spec.ts)).
2. Replace the tautological `expect(table.rowOrEmpty()).toBeVisible()` in both delete steps with `expect(table.emptyState).toBeVisible()` ([`policies.spec.ts:102`](../../tests/e2e/premium/policies/policies.spec.ts), [`free/…/policies.spec.ts:77`](../../tests/e2e/free/policies/policies.spec.ts)).
3. Drop two of the three `assertActivity` calls in each CRUD spec (keep `deleted_policy`); POL-07/08 already assert create/edit/delete through the UI.
4. Reopen the automations modal after save and assert the toggle + URL rehydrate, in POL-09/10 ([`policy-automations.spec.ts:95`](../../tests/e2e/premium/policies/policy-automations.spec.ts)) — POL-30 does it at a fleet's scope in two lines.
6. Move `.modal__content-wrapper-disabled` out of both in-flight specs and onto `PoliciesListPage` (next to `automationsModal` / `saveAutomationsButton`), with the `isUpdating` → `isContentDisabled` explanation attached — it is a legitimate class fallback, and it currently lives duplicated in two spec bodies ([`premium/…/policy-automations.spec.ts:175`](../../tests/e2e/premium/policies/policy-automations.spec.ts), [`free/…/policy-automations.spec.ts:155`](../../tests/e2e/free/policies/policy-automations.spec.ts)).
7. Add the failed-save half to POL-23: release the held PATCH with a 500 and assert the form **re-enables** and surfaces an error. A form that stays locked after a failed save is the regression the lock itself invites, and the `page.route` scaffolding to test it is already there.
5. Search before `openPolicy()` in the edit step so it matches `deletePolicy`'s pagination-safe pattern ([`policies.spec.ts:79`](../../tests/e2e/premium/policies/policies.spec.ts)), and tighten POL-18's `not.toContainText('No platforms')` into `toHaveCount(4)`.

**Bigger bets**

1. **Demote the 12 sql-validation entries.** Apart from POL-19/20's save and reopen, none issues a request; they test `PlatformCompatibility` / `PolicyForm` / `SaveNewPolicyModal` in isolation. Ideal home is Fleet's frontend unit tests; the pragmatic middle is to collapse the compatibility cases into one table-driven test per tier (or a single tier-agnostic `shared/policies/sql-validation.spec.ts`, since there is no tier branch) and keep the syntax-error + save-gating cases as one form-behaviour test. Saves ~8–10 browser sessions per nightly.
2. **Make the premium automations spec earn its tier.** POL-25 (install software, run script and continuous on a Workstations policy) and POL-30 (a fleet's webhook) are premium's own; calendar events and conditional access are the premium workflows left untested. The scope-wide pair POL-09/23 runs on All fleets and asserts nothing premium, so free's copy could become the "webhook exists on free + premium workflows are absent" test.
3. **Add a policy-results-page test.** Click **Run policy** on the details page and assert the plumbing (results panel, host counts refresh) — bounded by the simulated-host caveat that live runs ignore the SQL and return no results ~20% of the time, so assert structure, not rows. They do: simulations pass every policy except `SELECT 0;` and answer on a refetch within ~20 s, which is what POL-34 runs on.
