# Policies (free + premium) — test audit

**Specs covered:** 6 files · **Test declarations:** 22 · **Projects:** premium / free

Policies are saved osquery queries with a pass/fail contract per host, managed at
`/policies/manage` (list, team scope, automations) with a query editor at
`/policies/new` + `/policies/:id/edit` and a results page at `/policies/:id`. The specs
split three ways per tier: a serial CRUD lifecycle (create → edit → delete → activity
feed), one global failing-policies-webhook automations test, and a batch of read-only
form checks (platform compatibility, SQL syntax error, save gating). Premium and free
carry near-identical copies of all three; entries below are paired premium-then-free so
the duplication is visible.

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
| POL-09 | `premium/policies/policy-automations.spec.ts` | Premium • Policies • automations › enabling the failing-policies webhook persists | UI+API | ☐ |
| POL-10 | `free/policies/policy-automations.spec.ts` | Free • Policies • automations › enabling the failing-policies webhook persists | UI+API | ☐ |
| POL-11 | `premium/policies/sql-validation.spec.ts` | platform compatibility › an invalid table reports no compatible platforms | UI | ☐ |
| POL-12 | `free/policies/sql-validation.spec.ts` | platform compatibility › an invalid table reports no compatible platforms | UI | ☐ |
| POL-13 | `premium/policies/sql-validation.spec.ts` | platform compatibility › a query with no tables is compatible with all four platforms | UI | ☐ |
| POL-14 | `free/policies/sql-validation.spec.ts` | platform compatibility › a query with no tables is compatible with all four platforms | UI | ☐ |
| POL-15 | `premium/policies/sql-validation.spec.ts` | platform compatibility › a macOS-only table is compatible with macOS only | UI | ☐ |
| POL-16 | `free/policies/sql-validation.spec.ts` | platform compatibility › a macOS-only table is compatible with macOS only | UI | ☐ |
| POL-17 | `premium/policies/sql-validation.spec.ts` | platform compatibility › a macadmins extension table is treated as macOS-compatible | UI | ☐ |
| POL-18 | `premium/policies/sql-validation.spec.ts` | platform compatibility › common-table-expression names are not treated as tables | UI | ☐ |
| POL-19 | `premium/policies/sql-validation.spec.ts` | SQL validation › a syntax error is surfaced but Save stays enabled | UI | ☐ |
| POL-20 | `free/policies/sql-validation.spec.ts` | SQL validation › a syntax error is surfaced but Save stays enabled | UI | ☐ |
| POL-21 | `premium/policies/sql-validation.spec.ts` | save gating › the Save policy modal disables Save until a platform is selected | UI | ☐ |
| POL-22 | `free/policies/sql-validation.spec.ts` | save gating › the Save policy modal disables Save until a platform is selected | UI | ☐ |

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
5. ☐ Enter SQL `SELECT 1 AS one;` — **not typed**: `setSql` calls Ace's `env.editor.setValue()` through `evaluate()`, bypassing the keyboard/pointer path ([`PolicyEditPage.ts:226`](../../pages/policies/PolicyEditPage.ts)).
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
9. ☐ Click **Policies** in the navbar, re-select the scope, type the policy name in **Search by name**.
   - ✅ *(UI)* A table row containing the name is visible (`DataTable.rowWith`).

**Assessment**
- *Value:* Covers the whole happy path a user actually walks — Add policy → modal → redirect → details render → the row is findable in the scoped list, plus the server-side activity record.
- *Coverage gaps:* SQL never goes through the editor's input path (Ace `setValue`), so typing/paste/autocomplete regressions in the SQL editor are invisible; the created policy's SQL is never read back (only POL-03 does); modal defaults (macOS platform, **All hosts**, **Critical**) are set but never verified after save; no duplicate-name / empty-name negative path; list columns (Passing/Failing hosts, Automations) unchecked.
- *Redundancy:* POL-02 is the same flow on free. Existence is proved three times over (details page + `/activities` + list row); the activity is asserted again in the UI by POL-07.
- *Efficiency / smells:* `assertActivity` at [`policies.spec.ts:49`](../../tests/e2e/premium/policies/policies.spec.ts) duplicates POL-07's UI walk of the same event. Step 9 re-navigates to the list only to search — cheap, but it's the third existence proof.

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
4. ☐ Click **Policies** in the navbar, search the name.
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
   - ✅ *(UI)* `.ace_content` = the new SQL; Name / Description / Resolution hold the new values before save (`PolicyEditPage.fillAll:204-206`).
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
- *Coverage gaps:* **The edited platform set (`['Windows','Linux']`) is never verified after save.** `PolicyDetailsPage.platformsDefinition` exists but is unused ([`PolicyDetailsPage.ts:54`](../../pages/policies/PolicyDetailsPage.ts)) and `PolicyEditPage.expectValues` — which *does* check platforms + SQL — is dead code ([`PolicyEditPage.ts:210`](../../pages/policies/PolicyEditPage.ts)). **Critical** is deliberately uncovered (POM comment: Fleet's `role=checkbox` proxy doesn't resolve). No check the old name disappears from the list; no cancel/discard path; target type (**All hosts** / **Custom**) untouched.
- *Redundancy:* POL-04 is the same flow on free. Final list search overlaps POL-01's step 9.
- *Efficiency / smells:* `openPolicy(name)` clicks a name link with no prior search, unlike `deletePolicy` which searches first — inconsistent, and fails once the scope holds more than a page of policies ([`policies.spec.ts:73`](../../tests/e2e/premium/policies/policies.spec.ts)). `assertActivity` here again duplicates POL-07.

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
- *Efficiency / smells:* `expect(policiesList.table.rowOrEmpty()).toBeVisible()` at [`policies.spec.ts:96`](../../tests/e2e/premium/policies/policies.spec.ts) is a tautology — an `.or()` of "any row" and "empty state" is satisfied either way; the following `toHaveCount(0)` is the only real assertion.

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

### POL-09 · Premium • Policies • automations › enabling the failing-policies webhook persists

- **File:** [`playwright/tests/e2e/premium/policies/policy-automations.spec.ts`](../../tests/e2e/premium/policies/policy-automations.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "Premium • Policies • automations"`
- **Project:** premium · **Scopes:** All fleets only
- **Mode:** UI+API · **Isolation:** standalone test with `beforeEach` / `afterEach`. **Mutates global app config** (`webhook_settings.failing_policies_webhook`) — snapshot + restore, so it is not safe to run concurrently with another spec touching the same subtree.
- **Preconditions (API):** `GET /config` snapshots the current failing-policies webhook; `POST /global/policies` seeds `pw-policy-auto-<ts>` with `SELECT 1;` so the **Automations** button is enabled (Fleet disables it when the scope has no policies).
- **Data created:** one API-seeded global policy (deleted in `afterEach` via `POST /global/policies/delete`); the config subtree is PATCHed back to its snapshot.

**Flow**

1. ☐ Open `/policies/manage` via URL, select **All fleets** in the dropdown.
   - ✅ *(UI)* Row-or-empty visible; dropdown reads "All fleets".
2. ☐ Click **Automations**.
   - ✅ *(UI)* The automations modal is visible (`openAutomations`).
3. ☐ Flip the enable switch on (idempotent — reads `aria-checked` first).
   - ✅ *(UI)* Switch has `aria-checked="true"`.
4. ☐ Click the **Webhook** radio label (the modal may open on **Ticket**).
   - ✅ *(UI)* The **Destination URL** field (placeholder `https://server.com/example`) becomes visible.
5. ☐ Fill the destination URL `https://example.com/pw-policy-webhook`, click **Save**.
   - ✅ *(UI)* Modal closes (`saveAutomations`).
   - ✅ *(UI)* Success toast `Successfully updated policy automations.`
6. ☐ *(no user action)* — server check.
   - ✅ *(API)* `GET /config` → `webhook_settings.failing_policies_webhook.enable_failing_policies_webhook === true` and `destination_url` equals the submitted URL.

**Assessment**
- *Value:* Proves the automations modal actually persists both fields (toast alone would not) and that the Webhook radio reveals the URL input.
- *Coverage gaps:* The modal is never reopened, so UI rehydration of the saved toggle/URL is untested — a classic Fleet regression spot. No policy is selected in the modal's per-policy list, so `policy_ids` stays empty and the "which policies trigger the webhook" UI is untested. No negative validation (empty or malformed URL with the toggle on). None of the premium-only workflows are touched: **install software**, **run script**, **calendar events**, ticket integrations (Jira/Zendesk). No team-scoped run (Workstations) even though scope handling is the premium-specific risk. Disable-again path untested.
- *Redundancy:* POL-10 is byte-identical except for the dropdown line — this premium spec asserts nothing premium.
- *Efficiency / smells:* `automationsModal.getByRole('switch')` ([`PoliciesListPage.ts:60`](../../pages/policies/PoliciesListPage.ts)) assumes exactly one switch in the modal — strict-mode break the moment Fleet adds another. `automationsModal` is `.modal__modal_container` filtered by the text "Automations", which will also match any nested modal containing that word. Global-config mutation from an e2e test is a parallel-safety hazard shared with `premium/dashboard/automations-activity.spec.ts` and `premium/settings/team-host-status-webhook.spec.ts` (different subtrees today).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-10 · Free • Policies • automations › enabling the failing-policies webhook persists

- **File:** [`playwright/tests/e2e/free/policies/policy-automations.spec.ts`](../../tests/e2e/free/policies/policy-automations.spec.ts)
- **Grep:** `npx playwright test --project=free -g "Free • Policies • automations"`
- **Project:** free · **Mode:** UI+API · **Isolation:** standalone; mutates global app config with snapshot/restore in `beforeEach`/`afterEach`
- **Preconditions (API):** `GET /config` snapshot; `POST /global/policies` seeds `pw-policy-auto-<ts>` to enable the **Automations** button
- **Data created:** one seeded policy (API-deleted after); config restored

**Flow**

1. ☐ Open `/policies/manage` via URL → click **Automations** → flip the switch on → click the **Webhook** radio → fill the destination URL → **Save**.
   - ✅ *(UI)* Modal visible; `aria-checked="true"`; URL field visible; modal closes; toast `Successfully updated policy automations.`
   - ✅ *(API)* `GET /config` shows the webhook enabled with the submitted `destination_url`.

**Assessment**
- *Value:* Confirms failing-policies webhooks are genuinely available on free (not paywalled) and persist.
- *Coverage gaps:* Same as POL-09, plus: no assertion that the premium-only workflows are hidden/paywalled in this modal on free — which is the one thing this file is uniquely positioned to check.
- *Redundancy:* Identical to POL-09 apart from the missing `teamDropdown.select('All fleets')`.
- *Efficiency / smells:* Same single-`switch` and text-filtered-modal assumptions.

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

### POL-19 · Premium • Policies • SQL validation › a syntax error is surfaced but Save stays enabled

- **File:** [`playwright/tests/e2e/premium/policies/sql-validation.spec.ts`](../../tests/e2e/premium/policies/sql-validation.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "a syntax error is surfaced but Save stays enabled"`
- **Project:** premium · **Mode:** UI (client-side only — no request; this is **not** a server-validation test) · **Isolation:** independent, read-only
- **Preconditions:** none · **Data created:** none

**Flow**

1. ☐ Open `/policies/new` via URL, enter `SELEC 1 FRO osquery_info WHER start_time > 1;`.
   - ✅ *(UI)* The inline text `Syntax error. Please review before saving.` is visible.
   - ✅ *(UI)* The **Save** button is still enabled (Fleet deliberately allows saving a broken query so teams can capture false-positives).

**Assessment**
- *Value:* Locks in an intentional product decision (broken SQL is savable) that a well-meaning "fix" would break, plus the warning copy.
- *Coverage gaps:* The policy is never actually saved with the bad SQL, so the server's acceptance of it — and what the details page then shows — is untested. No check that the error clears when the SQL is corrected.
- *Redundancy:* POL-20 is the identical test on free.
- *Efficiency / smells:* Same as POL-11 (browser cost for a client-side check).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### POL-20 · Free • Policies • SQL validation › a syntax error is surfaced but Save stays enabled

- **File:** [`playwright/tests/e2e/free/policies/sql-validation.spec.ts`](../../tests/e2e/free/policies/sql-validation.spec.ts)
- **Grep:** `npx playwright test --project=free -g "a syntax error is surfaced but Save stays enabled"`
- **Project:** free · **Mode:** UI (client-side only) · **Isolation:** independent, read-only
- **Preconditions:** none · **Data created:** none

**Flow**

1. ☐ Open `/policies/new` via URL, enter `SELEC 1 FRO osquery_info WHER start_time > 1;`.
   - ✅ *(UI)* `Syntax error. Please review before saving.` visible; **Save** still enabled.

**Assessment**
- *Value:* None beyond POL-19.
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
- *Efficiency / smells:* `platformCheckbox()` is **page-scoped**, not modal-scoped ([`PolicyEditPage.ts:116`](../../pages/policies/PolicyEditPage.ts)) — it happens to be unique here only because `/policies/new` renders no inline platform picker; it will break (strict mode or wrong control) if Fleet adds one. `clearNewPolicyPlatforms` unchecks blindly in a loop, so an already-unchecked box is a silent no-op.

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

## Area observations

**Coverage map**

| Feature / user flow | Covered by | Gap |
|---|---|---|
| Create policy (editor → Save policy modal → redirect) | POL-01, POL-02 | Modal defaults (platform, **All hosts**, **Critical**) never verified post-save; no duplicate/empty-name negative path |
| Edit policy (all fields + SQL + platforms) | POL-03, POL-04 | Edited **platform set is never asserted after save**; no cancel/discard path |
| Delete policy | POL-05, POL-06 | Single row only — real multi-row bulk delete, select-all, modal count copy, cancel path untested |
| Policy list: search | POL-01/03/05 (as a lookup mechanism) | Never asserted as a feature (no negative search, no result-count check) |
| Policy list: sort, pagination, `automation_type` filter | — (only `tests/loadtest/policies.spec.ts`, timing-only) | Untested functionally |
| Policy list: Passing/Failing host counts, Automations column, inherited-policies section (team scope) | — | Untested |
| Policy details page | POL-01/03 (name/desc/resolution, **Show query**, button presence) | **Run policy** never clicked; passing/failing host tabs + host links untested; **Platforms** field never read (locator exists, unused) |
| Team scoping of policies (premium) | POL-01/03/05 via the dropdown + `fleet_id` | No cross-scope leakage check (a Workstations policy must not appear under Unassigned); `Unassigned` scope not in `SCOPES` at all |
| Failing-policies webhook automation | POL-09, POL-10 | Modal never reopened (no rehydration check); `policy_ids` selection untested; no disable path; no invalid-URL validation |
| Other policy automations: install software, run script, calendar events (premium), Jira/Zendesk tickets | — | **Entirely untested** — the largest genuine hole in this area |
| Platform-compatibility badge | POL-11…POL-18 | Only macOS-specific tables sampled; no Windows/Linux-only table; identity asserted in 3 of 6 cases |
| SQL syntax warning + save gating | POL-19…POL-22 | Re-enable path untested; broken SQL never actually saved |
| Free-tier paywalls for premium policy features | — (`tests/e2e/free/paywalls.spec.ts` has no policies entry) | Untested |
| Activity-feed copy for policies | POL-07, POL-08 (+ regex unit test `tests/api/activity-copy.spec.ts`) | Order and count not asserted |
| Policy API contracts / roles / gitops | `tests/api/role-access/**`, `tests/api/gitops-verify/policies.spec.ts` | out of scope here |

**Duplication**

1. **Free ↔ premium mirrors.** 9 of 22 entries are near-exact copies: CRUD (POL-01/03/05/07 ↔ POL-02/04/06/08) and automations (POL-09 ↔ POL-10). Per the suite's tier-separation preference the CRUD pair is defensible (different license path). The automations pair is not — POL-09 asserts nothing premium and POL-10 asserts nothing free-specific.
2. **sql-validation mirrors.** POL-11/13/15/19/21 ↔ POL-12/14/16/20/22 are the same client-side component checks on both tiers, with premium arbitrarily holding two extras (POL-17, POL-18). `PlatformCompatibility` / `PolicyForm` have no tier branch, so the free copies are pure cost.
3. **Triple existence proof.** Each CRUD step confirms the same fact three ways: details page render + `/activities` API + a list-row search.
4. **Activity double-coverage.** The three `assertActivity` calls in the CRUD spec assert the same events POL-07/08 then walk in the UI, and the regexes themselves are unit-tested in `tests/api/activity-copy.spec.ts`.
5. **Compatibility-case shape.** POL-15, POL-17 and (partly) POL-18 are the same assertion with a different table name — natural table-driven parameters, currently three full browser tests.

**UI-vs-API balance**

- The CRUD spec's three `assertActivity` calls are the only API assertions there, and they are **redundant with POL-07/08**, which check the same events through the feed. One layer should go; the UI walk is the one that owns the copy contract, so keep it plus at most one API assert (delete, where no UI proof of server state exists).
- POL-09/10's `GET /config` check is **justified** — the toast is not evidence of persistence and Fleet has no other surface for it. But the missing complement is a UI one: reopen the modal and assert the saved toggle + URL render. Right now a rehydration bug ships green.
- POL-05/06 rely on `deleted_policy` as the only proof the record is gone; the UI side is a name-filtered `toHaveCount(0)` plus a tautological `rowOrEmpty()`. Either assert the unfiltered list/empty state properly or check `GET /policies` — currently neither is strong.
- POL-11…POL-22 make **no server calls at all**. They are React component tests running in a full browser session against a live instance.
- Setup/teardown in POL-09/10 is correctly API-driven (seed policy, snapshot/restore config).

**Quick wins**

1. Assert the edited platform set after save — `PolicyDetailsPage.platformsDefinition` is built and never used ([`PolicyDetailsPage.ts:54`](../../pages/policies/PolicyDetailsPage.ts)); today `['Windows','Linux']` is written and never read back ([`policies.spec.ts:82`](../../tests/e2e/premium/policies/policies.spec.ts), [`free/…/policies.spec.ts:65`](../../tests/e2e/free/policies/policies.spec.ts)).
2. Replace the tautological `expect(table.rowOrEmpty()).toBeVisible()` in both delete steps with `expect(table.emptyState).toBeVisible()` ([`policies.spec.ts:96`](../../tests/e2e/premium/policies/policies.spec.ts), [`free/…/policies.spec.ts:77`](../../tests/e2e/free/policies/policies.spec.ts)).
3. Drop two of the three `assertActivity` calls in each CRUD spec (keep `deleted_policy`); POL-07/08 already assert create/edit/delete through the UI.
4. Reopen the automations modal after save and assert the toggle + URL rehydrate, in POL-09/10 ([`policy-automations.spec.ts:54`](../../tests/e2e/premium/policies/policy-automations.spec.ts)).
5. Search before `openPolicy()` in the edit step so it matches `deletePolicy`'s pagination-safe pattern ([`policies.spec.ts:73`](../../tests/e2e/premium/policies/policies.spec.ts)), and tighten POL-18's `not.toContainText('No platforms')` into `toHaveCount(4)`.

**Bigger bets**

1. **Demote the 12 sql-validation entries.** None issues a request; they test `PlatformCompatibility` / `PolicyForm` / `SaveNewPolicyModal` in isolation. Ideal home is Fleet's frontend unit tests; the pragmatic middle is to collapse the compatibility cases into one table-driven test per tier (or a single tier-agnostic `shared/policies/sql-validation.spec.ts`, since there is no tier branch) and keep the syntax-error + save-gating cases as one form-behaviour test. Saves ~8–10 browser sessions per nightly.
2. **Make the premium automations spec earn its tier.** Point it at Workstations (team-scoped automations modal) and add the premium-only workflows — **install software**, **run script**, calendar events — which are currently the biggest untested surface in Policies and where automation regressions actually land. Free's copy then becomes the "webhook exists on free + premium workflows are paywalled" test.
3. **Add a policy-results-page test.** Click **Run policy** on the details page and assert the plumbing (results panel, host counts refresh) — bounded by the simulated-host caveat that live runs ignore the SQL and return no results ~20% of the time, so assert structure, not rows. ⚠️ unclear from the source whether osquery-perf hosts report policy pass/fail results at all, which would decide whether the Passing/Failing columns can ever be asserted.
