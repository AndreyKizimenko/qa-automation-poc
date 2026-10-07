# Settings › Users — premium — test audit

**Specs covered:** 7 files · **Test declarations:** 34 (43 at runtime — two role loops expand) · **Projects:** premium

Covers `/settings/users`: the user list page (search, per-row Actions, Add-user dropdown), the two
creation sub-pages (`/new/human`, `/new/api`), the edit sub-page (`/:id/edit`), the delete modal, and
form validation. Premium adds the **Fleets** column, the fleet-assignment permission mode (which is
the *default* on premium), the `Observer+` / `Technician` / `GitOps` roles, and the Fleet MFA
(*Enable two-factor authentication (email)*) option on the create form. Six files split by
operation rather than by lifecycle; only `edit` and `delete` use API preconditions — both create specs
drive creation through the UI, once per role/fleet permutation. The seventh, `team-admin-scope`, is a
different seat: a **team admin** managing their own fleet's members on the fleet's **Users** tab
(`/settings/fleets/users?fleet_id=…`), and the rename-yes / delete-no permission on the fleet itself.

Near-verbatim free mirrors exist for five of the seven files (`tests/e2e/free/settings/users/`) and the
tier-agnostic list behaviours (search, pagination, Require-password-reset, Reset-sessions) live in
`tests/e2e/shared/settings/users/`. Both are cross-referenced below.

## Contents

| ID | Spec | Test | Mode | Manual? |
|---|---|---|---|---|
| USRP-01 | `api-user-create.spec.ts` | Add user → API-only user lands on the API create sub-page | UI | ☐ |
| USRP-02 | `api-user-create.spec.ts` | creates global API user with role `<role>` (all endpoints) ×6 | UI | ☐ |
| USRP-03 | `api-user-create.spec.ts` | creates API user assigned to 1 fleet (Workstations, Maintainer) | UI | ☐ |
| USRP-04 | `api-user-create.spec.ts` | creates API user assigned to 2 fleets with the same role | UI | ☐ |
| USRP-05 | `api-user-create.spec.ts` | creates API user assigned to 2 fleets with different roles | UI | ☐ |
| USRP-06 | `api-user-create.spec.ts` | Specific API endpoints toggle reveals the endpoint selector | UI | ☐ |
| USRP-07 | `api-user-create.spec.ts` | endpoint search dropdown lists matching endpoints as the user types | UI | ☐ |
| USRP-08 | `api-user-create.spec.ts` | creates API user with specific endpoints + 1 fleet | UI | ☐ |
| USRP-09 | `api-user-create.spec.ts` | API key reveal: heading, key visible, show/hide, copy, banner, then Done | UI | ☐ |
| USRP-10 | `api-user-create.spec.ts` | activity feed shows the created-API-user entry | UI+API | ☐ |
| USRP-11 | `regular-user-create.spec.ts` | Add user → Regular user lands on the create sub-page | UI | ☐ |
| USRP-12 | `regular-user-create.spec.ts` | creates global user with role `<role>` ×5 | UI | ☐ |
| USRP-13 | `regular-user-create.spec.ts` | creates user assigned to Workstations with Maintainer role | UI | ☐ |
| USRP-14 | `regular-user-create.spec.ts` | creates user assigned to 2 fleets with different roles | UI | ☐ |
| USRP-15 | `regular-user-create.spec.ts` | creates user assigned to 2 fleets with the same role | UI | ☐ |
| USRP-16 | `regular-user-create.spec.ts` | activity feed shows the created-user entry | UI | ☐ |
| USRP-17 | `edit.spec.ts` | Save is disabled while Full name is empty | UI | ☐ |
| USRP-18 | `edit.spec.ts` | admin edits via row Actions → Edit; users row reflects the change | UI | ☐ |
| USRP-19 | `edit.spec.ts` | activity feed shows the edited-user entry | UI | ☐ |
| USRP-20 | `edit.spec.ts` | switches an API user from All to Specific endpoints and saves | UI | ☐ |
| USRP-21 | `delete.spec.ts` | admin deletes a user via the row Actions menu | UI | ☐ |
| USRP-22 | `delete.spec.ts` | activity feed shows the deleted-user entry | UI | ☐ |
| USRP-23 | `form-validation.spec.ts` | clearing Full name disables Add | UI | ☐ |
| USRP-24 | `form-validation.spec.ts` | clearing Email disables Add | UI | ☐ |
| USRP-25 | `form-validation.spec.ts` | invalid email format surfaces an inline error | UI | ☐ |
| USRP-26 | `form-validation.spec.ts` | submit with Assign-to-fleets but no fleet checked surfaces an error | UI | ☐ |
| USRP-27 | `form-validation.spec.ts` | submitting an empty Name surfaces "Name is required" | UI | ☐ |
| USRP-28 | `navigation-and-layout.spec.ts` | user menu → Users renders the list and page chrome | UI | ☐ |
| USRP-29 | `navigation-and-layout.spec.ts` | first-page rows expose name, role, fleets, status, and Actions | UI | ☐ |
| USRP-30 | `navigation-and-layout.spec.ts` | Add user dropdown exposes Regular user and API-only user options | UI | ☐ |
| USRP-31 | `navigation-and-layout.spec.ts` | current admin cannot delete themselves | UI | ☐ |
| USRP-32 | `team-admin-scope.spec.ts` | a team admin creates a member, edits their name and role, then removes them | UI+API | ☐ |
| USRP-33 | `team-admin-scope.spec.ts` | a team admin may rename their fleet but not delete it | UI+API | ☐ |
| USRP-34 | `regular-user-create.spec.ts` | two-factor option › the two-factor checkbox starts unchecked, needs email, and hides under SSO | UI | ☐ |

All specs live under [`playwright/tests/e2e/premium/settings/users/`](../../tests/e2e/premium/settings/users/).

---

### USRP-01 · Create API-only user (premium) › Add user → API-only user lands on the API create sub-page

- **File:** [`api-user-create.spec.ts`](../../tests/e2e/premium/settings/users/api-user-create.spec.ts)
- **Grep:** `npx playwright test -g "API-only user lands on the API create sub-page"`
- **Project:** premium · **Mode:** UI · **Isolation:** serial describe, step 1 of 10 (shares `stamp` + `createdUserIds`)
- **Preconditions:** at least one user exists (the list `goto()` waits on a first row) — always true
- **Data created:** none

**Flow**

1. ☐ Open `/settings/users` via URL.
   - ✅ *(UI)* First table row is visible — `UsersPage.goto()`.
2. ☐ Click **Add user** → click **API-only user** in the dropdown.
   - ✅ *(UI)* URL matches `/settings/users/new/api`.
   - ✅ *(UI)* The **Name** input (`#name`) is visible.

**Assessment**
- *Value:* catches the Add-user dropdown wiring / route for the API sub-page.
- *Coverage gaps:* doesn't assert the page heading (**New API-only user**, already in the POM), nor that Email/Password are absent (the defining difference of this form).
- *Redundancy:* the dropdown-option visibility half of USRP-30; the same click path is re-exercised nowhere else, but USRP-02…09 all reach the page by URL, so this is the only click-through.
- *Efficiency / smells:* first step of a 10-test serial chain — a flake here skips the other nine.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-02 · Create API-only user (premium) › creates global API user with role `<role>` (all endpoints)

- **File:** [`api-user-create.spec.ts`](../../tests/e2e/premium/settings/users/api-user-create.spec.ts) (loop, `PREMIUM_API_ROLES`)
- **Grep:** `npx playwright test -g "creates global API user with role"`
- **Project:** premium · **Roles:** Observer, Observer+, Technician, GitOps, Maintainer, Admin (6 runtime tests)
- **Mode:** UI · **Isolation:** serial describe; each iteration is self-contained, cleanup deferred to `afterAll`
- **Preconditions:** none
- **Data created:** API user `QA API <role> <stamp>-<slug>` per role — id looked up via `GET /users?query=<name>`, deleted in `afterAll`

**Flow**

1. ☐ Open `/settings/users/new/api` via URL; fill **Name**.
   - ✅ *(UI)* **Global user** permissions radio is checked by default (API form default differs from the regular form).
   - ✅ *(UI)* **All API endpoints** radio is checked by default.
2. ☐ Open the role dropdown, click the role option (exact-text match so `Observer` ≠ `Observer+`).
3. ☐ Click **Add** → the API-key panel appears → click **Done** (`submitAndDone()`).
   - ✅ *(UI)* **Done** button visible before it is clicked (implicit success signal).
   - ✅ *(UI)* URL is back at `/settings/users`.
   - ✅ *(UI)* Success toast `"<name> has been created!"`.
4. ☐ Type the user's name into **Search by name or email**; read the matching row.
   - ✅ *(UI)* Row visible; Name cell text == submitted name; row carries an **API** pill badge; `.role__cell` == the role exactly — `assertApiUserRow`, [`api-user-create.spec.ts:14`](../../tests/e2e/premium/settings/users/api-user-create.spec.ts#L14).

**Assessment**
- *Value:* proves the API-user create form round-trips each premium role and that the list renders the API pill + role. Genuinely tier-specific for `Observer+`, `Technician`, `GitOps`.
- *Coverage gaps:* the generated token is never used to prove the role actually grants/denies anything (that lives in `tests/api/role-access/premium/`); no assertion that the created user is `api_only` at the API level beyond the pill.
- *Redundancy:* **6 iterations of one code path.** Only two are behaviourally distinct: `Observer` vs `Observer+` (the label-collision guard the anchored regex exists for). `Technician`/`Maintainer`/`Admin`/`GitOps` are the same dropdown → same POST → same cell renderer with different strings. Also mirrors USRP-12 (regular form, 5 roles) and the free spec's `creates API user with role <role>` ×3.
- *Efficiency / smells:* the two default-radio assertions re-run 6× (lines 82–83) — they belong in USRP-01 once. Cleanup id is pushed only `if (id !== null)` (line 93), so a lookup miss leaks the user **silently and permanently**: API users get a server-stamped email that `QA_TEST_EMAIL_RE` in [`helpers/api/users.ts:66`](../../helpers/api/users.ts#L66) almost certainly does not match, so `deleteAllQaTestUsers` can't reap them. ⚠️ unclear: the exact placeholder-email format Fleet stamps on `api_only` users — worth confirming, because leaked users crowd the 10-rows-per-page list that the shared pagination/search specs assert against.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-03 · Create API-only user (premium) › creates API user assigned to 1 fleet (Workstations, Maintainer)

- **File:** [`api-user-create.spec.ts`](../../tests/e2e/premium/settings/users/api-user-create.spec.ts)
- **Grep:** `npx playwright test -g "creates API user assigned to 1 fleet"`
- **Project:** premium · **Mode:** UI · **Isolation:** serial describe
- **Preconditions:** `Workstations` fleet exists (gitops-provisioned)
- **Data created:** API user `QA API 1Fleet <stamp>` — deleted in `afterAll`

**Flow**

1. ☐ Open `/settings/users/new/api` via URL; fill **Name**.
2. ☐ Click the **Assign to fleet(s)** label.
   - ✅ *(UI)* Radio was enabled before the click and is checked after — `useAssignToFleets()`.
3. ☐ Tick the **Workstations** checkbox; in that fleet's row pick **Maintainer** from the role dropdown.
4. ☐ Click **Add** → **Done**.
   - ✅ *(UI)* URL back at `/settings/users`; success toast `"<name> has been created!"`.
5. ☐ Search the name; read the row.
   - ✅ *(UI)* `assertApiUserRow` bundle (visible, Name cell, **API** pill, `.role__cell` == `Maintainer`).
   - ✅ *(UI)* Row contains `Workstations` (Fleets column) — substring check, not anchored to the cell.

**Assessment**
- *Value:* covers the premium-only fleet-scoped API-user path and the single-fleet Fleets-cell render.
- *Coverage gaps:* the Fleets assertion is `toContainText` on the whole row, so it would also pass if `Workstations` appeared in another cell; no verification via `GET /users/:id` that `fleets[]` carries the right id+role.
- *Redundancy:* same product behaviour as USRP-13 (identical fleet+role on the regular form). The fleet-assignment control is the same React component on both forms.
- *Efficiency / smells:* same silent-leak guard as USRP-02 (line 121).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-04 · Create API-only user (premium) › creates API user assigned to 2 fleets with the same role

- **File:** [`api-user-create.spec.ts`](../../tests/e2e/premium/settings/users/api-user-create.spec.ts)
- **Grep:** `npx playwright test -g "2 fleets with the same role"` *(also matches USRP-15)*
- **Project:** premium · **Mode:** UI · **Isolation:** serial describe
- **Preconditions:** `Workstations` and `QA` fleets exist
- **Data created:** API user `QA API 2FleetsSame <stamp>` — deleted in `afterAll`

**Flow**

1. ☐ `/settings/users/new/api` via URL; fill **Name**; switch to **Assign to fleet(s)**.
2. ☐ Tick **Workstations** → role **Observer**; tick **QA** → role **Observer**.
3. ☐ Click **Add** → **Done**.
   - ✅ *(UI)* Success toast `"<name> has been created!"`.
4. ☐ Search the name; read the row.
   - ✅ *(UI)* `assertApiUserRow` bundle with `.role__cell` == `Observer` (not `Various`).
   - ✅ *(UI)* Row contains `2 fleets`; row does **not** contain `Various`.

**Assessment**
- *Value:* the only check that a uniform role across fleets collapses to the role name, not `Various`. Real renderer logic.
- *Coverage gaps:* doesn't hover/expand the `2 fleets` cell to confirm which two fleets are listed.
- *Redundancy:* duplicates USRP-15 exactly (same renderer, regular form). Keep one.
- *Efficiency / smells:* silent-leak guard (line 147).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-05 · Create API-only user (premium) › creates API user assigned to 2 fleets with different roles

- **File:** [`api-user-create.spec.ts`](../../tests/e2e/premium/settings/users/api-user-create.spec.ts)
- **Grep:** `npx playwright test -g "creates API user assigned to 2 fleets with different roles"`
- **Project:** premium · **Mode:** UI · **Isolation:** serial describe
- **Preconditions:** `Workstations` and `QA` fleets exist
- **Data created:** API user `QA API 2FleetsDiff <stamp>` — deleted in `afterAll`

**Flow**

1. ☐ `/settings/users/new/api` via URL; fill **Name**; switch to **Assign to fleet(s)**.
2. ☐ Tick **Workstations** → **Observer**; tick **QA** → **Admin**.
3. ☐ Click **Add** → **Done**.
   - ✅ *(UI)* Success toast `"<name> has been created!"`.
4. ☐ Search the name; read the row.
   - ✅ *(UI)* `assertApiUserRow` bundle with `.role__cell` == `Various`.
   - ✅ *(UI)* Row contains `2 fleets`.

**Assessment**
- *Value:* the `Various` branch of the Role cell — a real product rule.
- *Coverage gaps:* no check of which role applies to which fleet (only the collapsed label).
- *Redundancy:* duplicates USRP-14 exactly. Pair with USRP-04 as one same-vs-different test rather than four tests across two files.
- *Efficiency / smells:* silent-leak guard (line 173).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-06 · Create API-only user (premium) › Specific API endpoints toggle reveals the endpoint selector

- **File:** [`api-user-create.spec.ts`](../../tests/e2e/premium/settings/users/api-user-create.spec.ts)
- **Grep:** `npx playwright test -g "Specific API endpoints toggle reveals"`
- **Project:** premium · **Mode:** UI · **Isolation:** serial describe · **Data created:** none

**Flow**

1. ☐ `/settings/users/new/api` via URL.
   - ✅ *(UI)* `.endpoint-selector-table` is hidden while **All API endpoints** is selected.
2. ☐ Click the **Specific API endpoints** label.
   - ✅ *(UI)* Endpoint selector table is visible.
   - ✅ *(UI)* **Search by name or path** input is visible.

**Assessment**
- *Value:* one-line conditional-render check.
- *Coverage gaps:* doesn't check the reverse toggle (back to All endpoints hides + clears the selection).
- *Redundancy:* fully contained in USRP-08 (lines 216–217 repeat both assertions) and partly in USRP-20 (edit form).
- *Efficiency / smells:* candidate to fold into USRP-08; costs a page load for two assertions.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-07 · Create API-only user (premium) › endpoint search dropdown lists matching endpoints as the user types

- **File:** [`api-user-create.spec.ts`](../../tests/e2e/premium/settings/users/api-user-create.spec.ts)
- **Grep:** `npx playwright test -g "endpoint search dropdown lists matching endpoints"`
- **Project:** premium · **Mode:** UI · **Isolation:** serial describe · **Data created:** none

**Flow**

1. ☐ `/settings/users/new/api` via URL; click **Specific API endpoints**.
2. ☐ Type `users` into **Search by name or path**.
   - ✅ *(UI)* At least one suggestion row renders (`.endpoint-selector-table__search-dropdown tbody tr`).
   - ✅ *(UI)* A suggestion row containing `List users` is visible.

**Assessment**
- *Value:* proves the endpoint catalog is loaded and filterable — worth having, since a broken catalog fetch would otherwise only surface as an empty dropdown.
- *Coverage gaps:* no negative case (a nonsense query → empty state); doesn't assert the row shows the HTTP method + path alongside the label.
- *Redundancy:* USRP-08 performs the same search twice via `addEndpoint()`; this test is the isolated version of that step.
- *Efficiency / smells:* `.first()` on the suggestion rows is tolerated in USRP-08's `addEndpoint` ([`CreateApiUserPage.ts:174`](../../pages/settings/users/CreateApiUserPage.ts#L174)).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-08 · Create API-only user (premium) › creates API user with specific endpoints + 1 fleet

- **File:** [`api-user-create.spec.ts`](../../tests/e2e/premium/settings/users/api-user-create.spec.ts)
- **Grep:** `npx playwright test -g "creates API user with specific endpoints"`
- **Project:** premium · **Mode:** UI · **Isolation:** serial describe
- **Preconditions:** `Workstations` fleet exists
- **Data created:** API user `QA API Specific <stamp>` — deleted in `afterAll`

**Flow**

1. ☐ `/settings/users/new/api` via URL; fill **Name**; switch to **Assign to fleet(s)**.
2. ☐ Tick **Workstations** → role **Observer**.
3. ☐ Click **Specific API endpoints**.
   - ✅ *(UI)* Endpoint selector table visible.
4. ☐ Search `users` → click the **List users** suggestion; search `hosts` → click the **List hosts** suggestion.
5. ☐ Click **Add** → **Done**.
   - ✅ *(UI)* URL back at `/settings/users`; success toast `"<name> has been created!"`.
6. ☐ Search the name.
   - ✅ *(UI)* `assertApiUserRow` bundle with `.role__cell` == `Observer`.

**Assessment**
- *Value:* the only test that submits a scoped-endpoint API user end-to-end.
- *Coverage gaps:* **never verifies the endpoint allow-list persisted** — no re-open of the edit page, no `GET /users/:id`, and the token isn't used to prove `List users` succeeds while another endpoint 403s. A regression that silently dropped the selection would pass. Also no assertion that the two picks landed in the "Selected endpoints" table before submit.
- *Redundancy:* subsumes USRP-06 and most of USRP-07.
- *Efficiency / smells:* silent-leak guard (line 228).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-09 · Create API-only user (premium) › API key reveal: heading, key visible, show/hide, copy, banner, then Done

- **File:** [`api-user-create.spec.ts`](../../tests/e2e/premium/settings/users/api-user-create.spec.ts)
- **Grep:** `npx playwright test -g "API key reveal"`
- **Project:** premium · **Mode:** UI · **Isolation:** serial describe
- **Preconditions:** none
- **Data created:** API user `QA API Reveal <stamp>` (created with form defaults) — deleted in `afterAll`

**Flow**

1. ☐ `/settings/users/new/api` via URL; fill **Name** only, leaving all defaults.
2. ☐ Click **Add**.
   - ✅ *(UI)* `<h1>` equals the submitted name.
   - ✅ *(UI)* The API-key input is visible; the info banner contains "…note of this API key…".
   - ✅ *(UI)* Key input `type="password"` (masked by default); **Show secret** button visible.
3. ☐ Click **Show secret**.
   - ✅ *(UI)* Input flips to `type="text"`; **Hide secret** button visible.
   - ✅ *(UI)* Input value length > 20 — the panel surfaces a real token, not a placeholder.
4. ☐ Click **Hide secret**.
   - ✅ *(UI)* Input back to `type="password"`; **Show secret** visible again.
5. ☐ Click **Copy to clipboard**.
   - ✅ *(UI)* Button was enabled beforehand and is still visible after (affordance only — clipboard contents are deliberately not read).
6. ☐ Click **Done**.
   - ✅ *(UI)* URL back at `/settings/users`; success toast `"<name> has been created!"`.
   - ✅ *(UI)* `assertApiUserRow` bundle with `.role__cell` == `GitOps`.

**Assessment**
- *Value:* the highest-value test in the file — the token panel is a one-shot, unrecoverable UI, so a regression here is data loss for the user.
- *Coverage gaps:* the token is never used against the API to prove it authenticates; no check that navigating away without Done still created the user; no check that the key cannot be re-viewed afterwards.
- *Redundancy:* free mirror is byte-comparable (`free/settings/users/api-user-create.spec.ts`). The row assertion at the end repeats USRP-02.
- *Efficiency / smells:* asserting `.role__cell` == `GitOps` hard-codes an **undocumented form default** (the spec comment at line 243 states GitOps is the premium default role) — it will break on a product default change with a confusing message. Silent-leak guard (line 285).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-10 · Create API-only user (premium) › activity feed shows the created-API-user entry

- **File:** [`api-user-create.spec.ts`](../../tests/e2e/premium/settings/users/api-user-create.spec.ts)
- **Grep:** `npx playwright test -g "activity feed shows the created-API-user entry"`
- **Project:** premium · **Mode:** UI+API · **Isolation:** serial describe, last step — **depends on the `Observer` iteration of USRP-02 having created its user**
- **Preconditions:** `QA API Observer <stamp>-observer` still exists (it is only deleted in `afterAll`)
- **Data created:** none

**Flow**

1. ☐ *(no UI)* `GET /users?query=QA API Observer <stamp>-observer` → find the `api_only` match.
   - ✅ *(API)* The user exists (`expect(id).not.toBeNull()` with an explicit message).
2. ☐ Open `/dashboard` via URL.
   - ✅ *(UI)* First dashboard card visible (`DashboardPage.goto()`).
3. ☐ Read the **Activity** feed, paging **Next** up to 15 times and reloading up to 10 times until found.
   - ✅ *(UI)* A feed row matches `created a user\s+<server-stamped email>\.` — `activityCopy.user.created`.

**Assessment**
- *Value:* pins the activity-feed copy contract for API-user creation, including that Fleet logs the server-stamped email rather than the name.
- *Coverage gaps:* doesn't assert the actor (the admin who created it) or the "API-only" nature of the subject in the feed copy.
- *Redundancy:* USRP-16 is the same assertion for a human user; the two could be one test asserting both matchers via `expectActivities([...])`.
- *Efficiency / smells:* the user is fetched twice — `findApiUserIdByName` then `listUsers` again (lines 293–296) — for one record. Hard-coding the reconstructed name couples this test to USRP-02's slug convention; a rename there breaks here at runtime, not at compile time.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-11 · Create regular user (premium) › Add user → Regular user lands on the create sub-page

- **File:** [`regular-user-create.spec.ts`](../../tests/e2e/premium/settings/users/regular-user-create.spec.ts)
- **Grep:** `npx playwright test -g "Regular user lands on the create sub-page"`
- **Project:** premium · **Mode:** UI · **Isolation:** serial describe, step 1 of 6 · **Data created:** none

**Flow**

1. ☐ Open `/settings/users` via URL.
   - ✅ *(UI)* First table row visible.
2. ☐ Click **Add user** → **Regular user**.
   - ✅ *(UI)* URL matches `/settings/users/new/human`.
   - ✅ *(UI)* **Full name** input visible.

**Assessment**
- *Value:* dropdown → route wiring for the human form.
- *Coverage gaps:* doesn't assert the premium default (**Assign to fleet(s)** pre-selected, no role dropdown rendered) — the one thing that makes this page premium-specific. USRP-26 asserts it as a side effect.
- *Redundancy:* free mirror is identical; overlaps USRP-30.
- *Efficiency / smells:* head of a 6-test serial chain.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-12 · Create regular user (premium) › creates global user with role `<role>`

- **File:** [`regular-user-create.spec.ts`](../../tests/e2e/premium/settings/users/regular-user-create.spec.ts) (loop, `PREMIUM_GLOBAL_ROLES`)
- **Grep:** `npx playwright test -g "creates global user with role"`
- **Project:** premium · **Roles:** Observer, Observer+, Technician, Maintainer, Admin (5 runtime tests; **GitOps deliberately absent**)
- **Mode:** UI · **Isolation:** serial describe; cleanup deferred to `afterAll`
- **Preconditions:** `FLEET_TEST_USER_PASSWORD` set (`qaTestPassword()` throws otherwise)
- **Data created:** human user `qa-test-<stamp>-<slug>@fleetdm.com` per role — deleted in `afterAll`; leftovers reaped by `cleanup-setup`

**Flow**

1. ☐ Open `/settings/users/new/human` via URL.
2. ☐ Fill **Full name** (`QA <role>`), **Email**, **Password**.
3. ☐ Click the **Global user** label (premium defaults to Assign-to-fleets, so the role dropdown isn't rendered until this switch).
   - ✅ *(UI)* Radio was enabled, then is checked — `useGlobalUser()`.
4. ☐ Open the role dropdown → click the role (exact-text match).
5. ☐ Click **Add**.
   - ✅ *(UI)* URL back at `/settings/users`; success toast `"<name> has been created!"`.
6. ☐ Search the email; read the row.
   - ✅ *(UI)* Row visible; contains the name; `.role__cell` == role exactly; `.email__cell` == the submitted email; row contains `Global`.
7. ☐ *(no UI)* `GET /users?query=<email>` to record the id for cleanup — bookkeeping only, not asserted.

**Assessment**
- *Value:* UI→API→UI round-trip on name/email/role for the human form, plus the `Global` Fleets-cell render.
- *Coverage gaps:* **GitOps global role is never created from the regular form** (⚠️ unclear whether Fleet offers it there — the `GlobalRole` type includes it and the free spec's comment says GitOps is premium-only, so this looks like a real gap). No login-as-the-created-user check, so "role saved" is only proven by the list cell. No SSO/MFA authentication-mode variants are ever submitted — USRP-34 toggles **Single sign-on** and reads the MFA checkbox, but never saves a user with either.
- *Redundancy:* **5 iterations of one code path** — only `Observer` vs `Observer+` is behaviourally distinct. Mirrors USRP-02 (API form, same dropdown component) and the free spec's 3-role loop. The 5-assertion row block here is `assertApiUserRow` minus the pill — see the `expectUserRow` note in Area observations.
- *Efficiency / smells:* `if (created) createdUserIds.push(...)` (line 74) silently skips cleanup on a lookup miss — benign here because the email matches `QA_TEST_EMAIL_RE` and `cleanup-setup` reaps it, unlike USRP-02.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-13 · Create regular user (premium) › creates user assigned to Workstations with Maintainer role

- **File:** [`regular-user-create.spec.ts`](../../tests/e2e/premium/settings/users/regular-user-create.spec.ts)
- **Grep:** `npx playwright test -g "creates user assigned to Workstations with Maintainer role"`
- **Project:** premium · **Mode:** UI · **Isolation:** serial describe
- **Preconditions:** `Workstations` fleet exists; `FLEET_TEST_USER_PASSWORD` set
- **Data created:** `qa-test-<stamp>-wsmaintainer@fleetdm.com` — deleted in `afterAll`

**Flow**

1. ☐ `/settings/users/new/human` via URL; fill **Full name**, **Email**, **Password**.
2. ☐ Tick the **Workstations** checkbox (Assign-to-fleets is already the premium default — no radio click); pick **Maintainer** in that fleet's row dropdown.
3. ☐ Click **Add**.
   - ✅ *(UI)* URL back at `/settings/users`; success toast `"<name> has been created!"`.
4. ☐ Search the email; read the row.
   - ✅ *(UI)* Row visible, contains the name; `.role__cell` == `Maintainer`; `.email__cell` == email; row contains `Workstations`.

**Assessment**
- *Value:* the premium-default permission mode (fleet assignment) submitted without touching the radio — a genuinely premium-only path.
- *Coverage gaps:* no API check that `fleets[]` carries `{Workstations id, maintainer}`; the `Workstations` assertion is row-wide rather than cell-anchored.
- *Redundancy:* same product behaviour as USRP-03 (API form).
- *Efficiency / smells:* none beyond the shared row-assertion duplication.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-14 · Create regular user (premium) › creates user assigned to 2 fleets with different roles

- **File:** [`regular-user-create.spec.ts`](../../tests/e2e/premium/settings/users/regular-user-create.spec.ts)
- **Grep:** `npx playwright test -g "creates user assigned to 2 fleets with different roles"`
- **Project:** premium · **Mode:** UI · **Isolation:** serial describe
- **Preconditions:** `Workstations` and `QA` fleets exist
- **Data created:** `qa-test-<stamp>-twofleetsdiff@fleetdm.com` — deleted in `afterAll`

**Flow**

1. ☐ `/settings/users/new/human` via URL; fill **Full name**, **Email**, **Password**.
2. ☐ Tick **Workstations** → **Observer**; tick **QA** → **Admin**.
3. ☐ Click **Add**.
   - ✅ *(UI)* URL back at `/settings/users`; success toast `"<name> has been created!"`.
4. ☐ Search the email; read the row.
   - ✅ *(UI)* Row visible; contains `2 fleets`; `.role__cell` == `Various`; `.email__cell` == email.

**Assessment**
- *Value:* `Various` collapse on the human form.
- *Coverage gaps:* does not assert the name cell (unlike its siblings); no per-fleet role verification.
- *Redundancy:* duplicates USRP-05 (same renderer via the API form).
- *Efficiency / smells:* none.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-15 · Create regular user (premium) › creates user assigned to 2 fleets with the same role

- **File:** [`regular-user-create.spec.ts`](../../tests/e2e/premium/settings/users/regular-user-create.spec.ts)
- **Grep:** `npx playwright test -g "creates user assigned to 2 fleets with the same role"`
- **Project:** premium · **Mode:** UI · **Isolation:** serial describe
- **Preconditions:** `Workstations` and `QA` fleets exist
- **Data created:** `qa-test-<stamp>-twofleetssame@fleetdm.com` — deleted in `afterAll`

**Flow**

1. ☐ `/settings/users/new/human` via URL; fill **Full name**, **Email**, **Password**.
2. ☐ Tick **Workstations** → **Observer**; tick **QA** → **Observer**.
3. ☐ Click **Add**.
   - ✅ *(UI)* URL back at `/settings/users`; success toast `"<name> has been created!"`.
4. ☐ Search the email; read the row.
   - ✅ *(UI)* Row contains `2 fleets`; `.role__cell` == `Observer` (exact, so it can't be `Various`); `.email__cell` == email.

**Assessment**
- *Value:* the uniform-role branch on the human form.
- *Coverage gaps:* unlike USRP-04 it omits the explicit `not.toContainText('Various')` guard (the exact `.role__cell` match covers it).
- *Redundancy:* duplicates USRP-04.
- *Efficiency / smells:* none.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-16 · Create regular user (premium) › activity feed shows the created-user entry

- **File:** [`regular-user-create.spec.ts`](../../tests/e2e/premium/settings/users/regular-user-create.spec.ts)
- **Grep:** `npx playwright test -g "activity feed shows the created-user entry"`
- **Project:** premium · **Mode:** UI · **Isolation:** serial describe, last step — **depends on USRP-12's `Observer` iteration**
- **Preconditions:** `qa-test-<stamp>-observer@fleetdm.com` was created earlier in the chain
- **Data created:** none

**Flow**

1. ☐ Open `/dashboard` via URL.
   - ✅ *(UI)* First dashboard card visible.
2. ☐ Read the **Activity** feed (paging Next ≤15, reloading ≤10).
   - ✅ *(UI)* A row matches `created a user\s+qa-test-<stamp>-observer@fleetdm\.com\.`.

**Assessment**
- *Value:* activity copy contract for human-user creation.
- *Coverage gaps:* no actor assertion; no check that a *fleet-scoped* create logs different copy.
- *Redundancy:* same shape as USRP-10 / USRP-19 / USRP-22 — four separate feed-walking tests in this area.
- *Efficiency / smells:* the email is re-derived by string concatenation from `stamp` + the loop's slug convention (line 183) rather than captured — silently breaks if USRP-12's naming changes.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-17 · Edit user › Save is disabled while Full name is empty

- **File:** [`edit.spec.ts`](../../tests/e2e/premium/settings/users/edit.spec.ts)
- **Grep:** `npx playwright test -g "Save is disabled while Full name is empty"`
- **Project:** premium · **Mode:** UI · **Isolation:** serial describe, step 1 of 3
- **Preconditions:** `beforeAll` creates `qa-test-<stamp>-edit@fleetdm.com` (name `QA Edit Initial`, `global_role: observer`, `admin_forced_password_reset: false`) via `POST /users/admin`
- **Data created:** the above — deleted in `afterAll`

**Flow**

1. ☐ Open `/settings/users/<id>/edit` **via URL** (deliberate: the row-Actions entry point is USRP-18's job).
   - ✅ *(UI)* Either the **Edit user** or **Edit API-only user** heading is visible — `EditUserPage.goto()`.
2. ☐ Clear **Full name**, press **Tab**.
   - ✅ *(UI)* **Save** button is disabled.

**Assessment**
- *Value:* thin — one disabled-button check on the edit form.
- *Coverage gaps:* does not assert the form **hydrated** with the existing values (`QA Edit Initial`, Observer, the email) before editing. That is the regression this page is most likely to have, and nothing in the area covers it. Also no invalid-email check on the edit form.
- *Redundancy:* same validator behaviour as USRP-23 on the create form.
- *Efficiency / smells:* none.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-18 · Edit user › admin edits via row Actions → Edit; users row reflects the change

- **File:** [`edit.spec.ts`](../../tests/e2e/premium/settings/users/edit.spec.ts)
- **Grep:** `npx playwright test -g "admin edits via row Actions"`
- **Project:** premium · **Mode:** UI · **Isolation:** serial describe, step 2 of 3 (edits the `beforeAll` user; USRP-19 asserts the resulting activity)
- **Preconditions:** the `beforeAll` user exists with role Observer
- **Data created:** none (mutates the fixture user to `QA Edit Updated` / Maintainer)

**Flow**

1. ☐ Open `/settings/users` via URL; type the email into **Search by name or email**.
   - ✅ *(UI)* The row whose `.email__cell` exactly equals the email is visible.
2. ☐ Open that row's **Actions** dropdown → click **Edit**.
   - ✅ *(UI)* URL matches `/settings/users/<digits>/edit`.
   - ✅ *(UI)* **Edit user** `<h1>` visible (human variant, not the API one).
3. ☐ Replace **Full name** with `QA Edit Updated`; pick **Maintainer** in the role dropdown; click **Save**.
   - ✅ *(UI)* URL back at `/settings/users`.
   - ✅ *(UI)* Success toast `Successfully edited QA Edit Updated` (no trailing period — Fleet only appends it, plus a confirmation-email note, when the email changed).
4. ☐ Re-search the email (the save redirect lands on an unfiltered, paginated list).
   - ✅ *(UI)* Row visible; contains `QA Edit Updated`; contains `Maintainer`.

**Assessment**
- *Value:* the area's only real edit flow — row Actions → Edit route → save → list reflects it, plus the exact no-period toast copy.
- *Coverage gaps:* **email change is untested**, even though the spec comment documents that it produces different toast copy (period + confirmation-email suffix) — that branch is the more interesting one. Also untested: switching a user from Global to fleet-scoped (and back), removing a fleet, and the **Cancel** / **Back to users** paths.
- *Redundancy:* the free mirror (`free/settings/users/edit.spec.ts`) is the same test minus premium roles.
- *Efficiency / smells:* the final row checks use `toContainText('Maintainer')` on the whole row instead of the `.role__cell` anchor the create specs use ([`edit.spec.ts:70`](../../tests/e2e/premium/settings/users/edit.spec.ts#L70)) — weaker and inconsistent; would also pass if `Maintainer` appeared in the Fleets cell.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-19 · Edit user › activity feed shows the edited-user entry

- **File:** [`edit.spec.ts`](../../tests/e2e/premium/settings/users/edit.spec.ts)
- **Grep:** `npx playwright test -g "activity feed shows the edited-user entry"`
- **Project:** premium · **Mode:** UI · **Isolation:** serial describe, step 3 of 3 — requires USRP-18 to have saved
- **Preconditions:** USRP-18 changed the user's global role to Maintainer
- **Data created:** none

**Flow**

1. ☐ Open `/dashboard` via URL.
   - ✅ *(UI)* First card visible.
2. ☐ Read the **Activity** feed (paging Next ≤15, reloading ≤10).
   - ✅ *(UI)* A row matches `changed <email> to maintainer for all fleets\.` — `activityCopy.user.changedGlobalRole`, whose ` for all fleets` suffix is **premium-only** (free omits it, keyed off `process.env.SUITE`).

**Assessment**
- *Value:* pins the premium-specific activity suffix for a role change — the one activity matcher in this area that actually differs by tier.
- *Coverage gaps:* the name change made in USRP-18 produces no asserted activity; fleet-role-change copy is untested.
- *Redundancy:* fourth feed-walking test in the area.
- *Efficiency / smells:* none.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-20 · Edit API-only user › switches an API user from All to Specific endpoints and saves

- **File:** [`edit.spec.ts`](../../tests/e2e/premium/settings/users/edit.spec.ts)
- **Grep:** `npx playwright test -g "switches an API user from All to Specific endpoints"`
- **Project:** premium · **Mode:** UI · **Isolation:** own describe, **not serial**, single test
- **Preconditions:** `beforeAll` creates API user `QA API Edit <stamp>` (`global_role: observer`) via `POST /users/api_only`
- **Data created:** the above — deleted in `afterAll`

**Flow**

1. ☐ Open `/settings/users/<id>/edit` via URL.
   - ✅ *(UI)* **Edit API-only user** `<h1>` visible — confirms the route branches on `api_only`.
   - ✅ *(UI)* Endpoint selector table hidden (All endpoints is the saved default).
2. ☐ Click **Specific API endpoints**.
   - ✅ *(UI)* Endpoint selector table visible.
3. ☐ Search `hosts` → click the **List hosts** suggestion.
4. ☐ Click **Save**.
   - ✅ *(UI)* URL back at `/settings/users`.
   - ✅ *(UI)* A success toast matching `/Successfully edited/`.

**Assessment**
- *Value:* proves the edit route renders the API-user form variant and accepts an endpoint-scope change.
- *Coverage gaps:* **nothing verifies persistence** — no reload of the edit page, no `GET /users/:id`, no toast text beyond a regex that ignores the user's name. A save that discarded the endpoint list would pass. Also untested on this form: editing an API user's name/role/fleets, and token rotation.
- *Redundancy:* the toggle-reveals-selector assertions duplicate USRP-06.
- *Efficiency / smells:* the loosest success assertion in the area (`/Successfully edited/`) where the exact copy is known.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-21 · Delete user › admin deletes a user via the row Actions menu

- **File:** [`delete.spec.ts`](../../tests/e2e/premium/settings/users/delete.spec.ts)
- **Grep:** `npx playwright test -g "admin deletes a user via the row Actions menu"`
- **Project:** premium · **Mode:** UI · **Isolation:** serial describe, step 1 of 2
- **Preconditions:** `beforeAll` creates `qaTestEmail('delete')` / `QA Delete Target` (`global_role: observer`) via `POST /users/admin`
- **Data created:** none; consumes the fixture user. The tracker is cleared after the UI delete so `afterAll` doesn't fire a redundant `DELETE`

**Flow**

1. ☐ Open `/settings/users` via URL; type the email into **Search by name or email** (the list paginates at 10/page and concurrent specs crowd page 1).
   - ✅ *(UI)* The exact-email row is visible.
2. ☐ Open the row's **Actions** dropdown → click **Delete**.
   - ✅ *(UI)* The **Delete user** modal is visible and contains the user's name.
3. ☐ Click **Delete** in the modal.
   - ✅ *(UI)* Modal is hidden.
   - ✅ *(UI)* Success toast `Successfully deleted QA Delete Target.` (with the trailing period).
   - ✅ *(UI)* No row containing the email remains (`toHaveCount(0)`, auto-waiting).

**Assessment**
- *Value:* the full delete journey with exact toast copy and post-delete list state. Well-formed.
- *Coverage gaps:* modal **Cancel** path untested (does the user survive?); no API confirmation that the record is gone (`GET /users/:id` → 404); deleting an **API-only** user is untested; no check that the deleted user's session/token is invalidated.
- *Redundancy:* free mirror is the same test.
- *Efficiency / smells:* the final `rowWith(email)` check runs against the still-filtered table, which is the right way round. None.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-22 · Delete user › activity feed shows the deleted-user entry

- **File:** [`delete.spec.ts`](../../tests/e2e/premium/settings/users/delete.spec.ts)
- **Grep:** `npx playwright test -g "activity feed shows the deleted-user entry"`
- **Project:** premium · **Mode:** UI · **Isolation:** serial describe, step 2 of 2 — requires USRP-21
- **Preconditions:** USRP-21 deleted the user
- **Data created:** none

**Flow**

1. ☐ Open `/dashboard` via URL.
   - ✅ *(UI)* First card visible.
2. ☐ Read the **Activity** feed (paging Next ≤15, reloading ≤10).
   - ✅ *(UI)* A row matches `deleted a user\s+<email>\.`.

**Assessment**
- *Value:* activity copy contract for deletion.
- *Coverage gaps:* none meaningful for its scope.
- *Redundancy:* structurally identical to USRP-10 / 16 / 19.
- *Efficiency / smells:* none.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-23 · Create-user form validation › Regular user › clearing Full name disables Add

- **File:** [`form-validation.spec.ts`](../../tests/e2e/premium/settings/users/form-validation.spec.ts)
- **Grep:** `npx playwright test -g "clearing Full name disables Add"`
- **Project:** premium · **Mode:** UI · **Isolation:** independent (no serial, no shared state) · **Data created:** none (never submits)
- **Preconditions:** `FLEET_TEST_USER_PASSWORD` set

**Flow**

1. ☐ Open `/settings/users/new/human` via URL.
2. ☐ Fill **Full name** `QA Validation`, **Email** `qa-test-validation@fleetdm.com`, **Password**; press **Tab**.
   - ✅ *(UI)* **Add** is enabled (baseline).
3. ☐ Clear **Full name**, press **Tab**.
   - ✅ *(UI)* **Add** is disabled.

**Assessment**
- *Value:* confirms the form validator gates submission on Full name. Real behaviour, but button-state only.
- *Coverage gaps:* **asserts no validation copy** — no inline "Full name is required"-style message is checked, so a regression that dropped the message while keeping the button disabled passes. Untested entirely: password-policy copy (Fleet requires 12–48 chars, 1 digit, 1 symbol — see [`helpers/api/users.ts:78`](../../helpers/api/users.ts#L78)), duplicate-email submit (server error toast), and name-length limits.
- *Redundancy:* same code path as USRP-24 (different field) and USRP-17 (same validator on the edit form) — three tests, one behaviour.
- *Efficiency / smells:* the placeholder email `qa-test-validation@fleetdm.com` does **not** match `QA_TEST_EMAIL_RE` (no `-<digits>-` segment), so if this form ever did submit, `deleteAllQaTestUsers` could not reap it. Harmless today, a trap if the test grows.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-24 · Create-user form validation › Regular user › clearing Email disables Add

- **File:** [`form-validation.spec.ts`](../../tests/e2e/premium/settings/users/form-validation.spec.ts)
- **Grep:** `npx playwright test -g "clearing Email disables Add"`
- **Project:** premium · **Mode:** UI · **Isolation:** independent · **Data created:** none

**Flow**

1. ☐ Open `/settings/users/new/human` via URL.
2. ☐ Fill **Full name**, **Email**, **Password**; press **Tab**.
   - ✅ *(UI)* **Add** is enabled.
3. ☐ Clear **Email**, press **Tab**.
   - ✅ *(UI)* **Add** is disabled.

**Assessment**
- *Value:* marginal on top of USRP-23.
- *Coverage gaps:* no copy assertion; clearing **Password** is not covered (arguably the third field of the same triple).
- *Redundancy:* byte-for-byte USRP-23 with the cleared field swapped. Prime merge candidate — one test looping the three required fields.
- *Efficiency / smells:* re-fills the whole form and reloads the page for one differing line.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-25 · Create-user form validation › Regular user › invalid email format surfaces an inline error

- **File:** [`form-validation.spec.ts`](../../tests/e2e/premium/settings/users/form-validation.spec.ts)
- **Grep:** `npx playwright test -g "invalid email format surfaces an inline error"`
- **Project:** premium · **Mode:** UI · **Isolation:** independent · **Data created:** none

**Flow**

1. ☐ Open `/settings/users/new/human` via URL.
2. ☐ Type `not-an-email` into **Email**, press **Tab**.
   - ✅ *(UI)* Text `Email is not a valid email` is visible on the page — real client-side validation copy.

**Assessment**
- *Value:* one of only three tests in the area asserting actual validation copy.
- *Coverage gaps:* single malformed input; no `foo@`, `@bar.com`, whitespace, or over-length cases; the error is matched anywhere on the page rather than under the Email field.
- *Redundancy:* free mirror is identical.
- *Efficiency / smells:* `page.getByText(...)` is unscoped — would pass if the copy appeared anywhere, including a toast.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-26 · Create-user form validation › Regular user › submit with Assign-to-fleets but no fleet checked surfaces an error

- **File:** [`form-validation.spec.ts`](../../tests/e2e/premium/settings/users/form-validation.spec.ts)
- **Grep:** `npx playwright test -g "no fleet checked surfaces an error"`
- **Project:** premium · **Mode:** UI · **Isolation:** independent · **Data created:** none (submit is rejected)
- **Preconditions:** `FLEET_TEST_USER_PASSWORD` set

**Flow**

1. ☐ Open `/settings/users/new/human` via URL; fill **Full name**, **Email** (`qa-test-emptyfleets@fleetdm.com`), **Password**.
   - ✅ *(UI)* **Assign to fleet(s)** radio is checked by default with no fleet pre-selected — the premium default.
   - ✅ *(UI)* **Add** is enabled (no client-side disable for this case).
2. ☐ Click **Add**.
   - ✅ *(UI)* Text `Please select at least one fleet for this user.` is visible.
   - ✅ *(UI)* URL is still `/settings/users/new/human` — the submit did not navigate away.

**Assessment**
- *Value:* highest-value validation test in the file — premium-only rule, real copy, and a no-navigation guard. Also the only place the premium default permission mode is asserted.
- *Coverage gaps:* doesn't confirm no user was created (a `GET /users?query=` check would close it); doesn't cover the mirror-image case of Global-user mode with no role picked.
- *Redundancy:* none (premium-only; free has no fleets).
- *Efficiency / smells:* unscoped `getByText`. The email `qa-test-emptyfleets@fleetdm.com` doesn't match `QA_TEST_EMAIL_RE` — if the validation regressed and the user *were* created, cleanup couldn't reap it and it would leak every run.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-27 · Create-user form validation › API-only user › submitting an empty Name surfaces "Name is required"

- **File:** [`form-validation.spec.ts`](../../tests/e2e/premium/settings/users/form-validation.spec.ts)
- **Grep:** `npx playwright test -g "submitting an empty Name surfaces"`
- **Project:** premium · **Mode:** UI · **Isolation:** independent · **Data created:** none

**Flow**

1. ☐ Open `/settings/users/new/api` via URL.
2. ☐ Click **Add** with the form empty.
   - ✅ *(UI)* Text `Name is required` is visible — the API form validates on submit rather than disabling **Add**.

**Assessment**
- *Value:* documents that the API form's validation model differs from the human form (submit-time, not disable-time). Real copy.
- *Coverage gaps:* no assertion that the URL didn't change / no user was created; whitespace-only name untested; duplicate API-user name untested.
- *Redundancy:* free mirror is identical.
- *Efficiency / smells:* unscoped `getByText`.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-28 · Users page navigation and layout › user menu → Users renders the list and page chrome

- **File:** [`navigation-and-layout.spec.ts`](../../tests/e2e/premium/settings/users/navigation-and-layout.spec.ts)
- **Grep:** `npx playwright test -g "user menu → Users renders the list and page chrome"`
- **Project:** premium · **Mode:** UI · **Isolation:** independent · **Data created:** none

**Flow**

1. ☐ Open `/dashboard` via URL.
   - ✅ *(UI)* First dashboard card visible.
2. ☐ Click the user-menu trigger in the navbar → click the **Users** menu item.
   - ✅ *(UI)* URL matches `/settings/users`.
   - ✅ *(UI)* **Add user** button visible.
   - ✅ *(UI)* **Search by name or email** input visible.
   - ✅ *(UI)* First table row visible.

**Assessment**
- *Value:* the area's only click-through entry point from the dashboard (every other spec `goto()`s by URL, so this test carries the whole navigation contract).
- *Coverage gaps:* no page heading / breadcrumb assertion; column headers not asserted anywhere (USRP-29 reads them but never asserts the set — a renamed or dropped column would surface as a thrown "Column not found", not a clear failure).
- *Redundancy:* the chrome assertions overlap USRP-30 (**Add user**) and every `UsersPage.goto()` (first row).
- *Efficiency / smells:* none.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-29 · Users page navigation and layout › first-page rows expose name, role, fleets, status, and Actions

- **File:** [`navigation-and-layout.spec.ts`](../../tests/e2e/premium/settings/users/navigation-and-layout.spec.ts)
- **Grep:** `npx playwright test -g "first-page rows expose name, role, fleets, status"`
- **Project:** premium · **Mode:** UI · **Isolation:** independent · **Data created:** none
- **Preconditions:** at least one user on page 1 (always true)

**Flow**

1. ☐ Open `/settings/users` via URL.
2. ☐ For every row on page 1 (up to 10), read the **Name**, **Role**, **Fleets** and **Status** cells by resolving each column's index from the header text (`DataTable.cellByColumn`).
   - ✅ *(UI)* Row count > 0.
   - ✅ *(UI)* Per row: Name cell not empty; Role cell not empty; Fleets cell attached (content may be `Global` or a fleet list); Status cell not empty.
   - ✅ *(UI)* Per row: the `.actions-dropdown__wrapper` Actions trigger is visible.

**Assessment**
- *Value:* low — a smoke test that the table renders cells. The **Fleets** column is premium-only, which is the one tier-specific thing here.
- *Coverage gaps:* assertions are non-empty/attached only, so garbage content passes; `Status` values (`Active` / invited) are never checked against expected copy; column *set* is never asserted; sorting is untested.
- *Redundancy:* every create test already asserts a concrete row's Name/Role/Email/Fleets with exact values (USRP-02, 12–15) — this adds breadth over rows whose content the test doesn't know.
- *Efficiency / smells:* `cellByColumn` re-scans all table headers with `innerText()` for **each** of the 4 cells on **each** row — up to 40 header sweeps per run ([`DataTable.ts:76`](../../pages/components/DataTable.ts#L76)). Also depends on whatever users happen to be on page 1, which under concurrency includes other specs' fixtures — content-agnostic assertions are the only reason it isn't flaky.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-30 · Users page navigation and layout › Add user dropdown exposes Regular user and API-only user options

- **File:** [`navigation-and-layout.spec.ts`](../../tests/e2e/premium/settings/users/navigation-and-layout.spec.ts)
- **Grep:** `npx playwright test -g "Add user dropdown exposes Regular user and API-only user"`
- **Project:** premium · **Mode:** UI · **Isolation:** independent · **Data created:** none

**Flow**

1. ☐ Open `/settings/users` via URL; click **Add user**.
   - ✅ *(UI)* Option **Regular user** visible.
   - ✅ *(UI)* Option **API-only user** visible.
2. ☐ Press **Escape** to close the dropdown (no assertion that it closed).

**Assessment**
- *Value:* minimal — the two options' existence.
- *Coverage gaps:* doesn't assert the dropdown closes on Escape, nor that only these two options exist.
- *Redundancy:* fully subsumed by USRP-01 + USRP-11, which each click one option and assert the destination.
- *Efficiency / smells:* delete candidate.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-31 · Users page navigation and layout › current admin cannot delete themselves

- **File:** [`navigation-and-layout.spec.ts`](../../tests/e2e/premium/settings/users/navigation-and-layout.spec.ts)
- **Grep:** `npx playwright test -g "current admin cannot delete themselves"`
- **Project:** premium · **Mode:** UI · **Isolation:** independent · **Data created:** none
- **Preconditions:** `FLEET_ADMIN_EMAIL` env var set (asserted, not skipped)

**Flow**

1. ☐ Open `/settings/users` via URL.
   - ✅ *(API/env)* `FLEET_ADMIN_EMAIL` is non-empty.
2. ☐ Type the admin's email into **Search by name or email**.
   - ✅ *(UI)* The admin's row (exact `.email__cell` match) is visible.
3. ☐ Open the admin row's **Actions** dropdown.
   - ✅ *(UI)* A **Delete** option is visible.
   - ✅ *(UI)* That option has `aria-disabled="true"`.

**Assessment**
- *Value:* real guardrail — a regression here lets an admin lock the org out of its own instance.
- *Coverage gaps:* doesn't verify the option is actually inert (clicking it should not open the modal); doesn't cover the sibling self-protections (can an admin demote their own role? require their own password reset?).
- *Redundancy:* none. The free mirror has the same test.
- *Efficiency / smells:* leaves the Actions dropdown open at test end (no Escape, unlike USRP-30) — harmless with per-test contexts.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-32 · Premium • Settings • team admin scope › a team admin creates a member, edits their name and role, then removes them

- **File:** [`team-admin-scope.spec.ts`](../../tests/e2e/premium/settings/users/team-admin-scope.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "a team admin creates a member, edits their name and role"`
- **Project:** premium · **Role:** `team-admin` (static user — admin on **Workstations** and **VMs**, no global role) · **Scope:** Workstations
- **Mode:** UI+API · **Isolation:** independent (not serial); own browser context via `withStaticUser`; `finally` deletes the member through the admin API
- **Preconditions:** `team-admin@fleetdm.com` provisioned with `FLEET_STATIC_USER_PASSWORD`; `FLEET_TEST_USER_PASSWORD` set (the member's password); the Workstations fleet (`workstationsFleetId`)
- **Data created:** human user `qa-test-<ts>-member@fleetdm.com` ("QA Fleet Member <ts>"), created *by the team admin*, deleted in `finally`; the `cleanup-setup` qa-test sweep reaps it after a dead run. Activities for the create, role change and removal (not asserted).

**Flow**

1. ☐ Log in as `team-admin` in a fresh context (cached session, re-logging in only if it bounced).
2. ☐ Open the **Dashboard** via URL and pick **Workstations** in the fleet dropdown.
   - ✅ *(UI)* the dropdown reads `Workstations`.
3. ☐ Open the user menu → **Users**.
   - ✅ *(UI)* the URL is `/settings/fleets/users?fleet_id=<Workstations>` — a team admin's **Users** lands on their fleet's Users tab, not `/settings/users`.
4. ☐ Click **Add user**.
   - ✅ *(UI)* the create-user modal opens (a team admin gets the create form; a global admin would get a picker of existing users).
5. ☐ Fill **Full name**, **Email** and **Password**, leave the role at its default, and click **Add**.
   - ✅ *(UI)* success toast `Successfully created QA Fleet Member <ts>.`; the modal closes.
6. ☐ Type the email into the tab's **Search** box.
   - ✅ *(UI)* the member's row contains the name and `Observer` — the default fleet role.
   - ✅ *(API)* `GET /users?query=<email>` → `global_role` null and exactly one fleet role, `{ Workstations, observer }`.
7. ☐ Row **Actions** → **Edit**.
   - ✅ *(UI)* the edit modal opens with **Full name** prefilled.
8. ☐ Change the name to `… - Edited`, pick **Admin** in **Team role**, click **Save**.
   - ✅ *(UI)* success toast `Successfully edited QA Fleet Member <ts>.` — Fleet names the user as they were *before* the edit; the modal closes.
9. ☐ Search the email again.
   - ✅ *(UI)* the row contains the edited name and `Admin`.
   - ✅ *(API)* the user's name is the edited one and its fleet roles are exactly `[{ Workstations, admin }]`.
10. ☐ Row **Actions** → **Remove**.
    - ✅ *(UI)* the remove modal opens; click **Remove** → success toast `Successfully removed QA Fleet Member <ts> - Edited`; the modal closes.
11. ☐ Search the email again.
    - ✅ *(UI)* no row for it (count 0).
    - ✅ *(API)* the user **still exists** — removing from a fleet doesn't delete — and has no fleet roles.
12. ☐ *(API teardown, `finally`)* delete the member through the admin API if it exists.

**Assessment**
- *Value:* the team admin's whole member-management loop from their own seat, each step read back from the server, including the one thing a global-admin test can't show: **Remove** takes the user off the fleet and leaves the account. The pre-edit-name toast is pinned as Fleet's behaviour rather than guessed at. First coverage of `/settings/fleets/users` anywhere in the area.
- *Coverage gaps:* the team admin's **limits** are untested — nothing checks they can't give the member a role on a fleet they don't administer (QA), can't grant a global role, or can't edit or remove a global user listed on their fleet's tab; the Observer+ / Technician / Maintainer fleet roles are never picked; the member never signs in (the header explains: a forced password reset and two logins against the 10-per-minute login limit, where the API read already shows the role); the fleet-scoped activity copy is unasserted.
- *Redundancy:* the role-dropdown mechanics echo USRP-13/18 on the global admin's pages; the entry point, modals and seat differ, so the overlap is thin.
- *Efficiency / smells:* `FleetUsersPage` reaches its modals by component class (Fleet's `Modal` has no dialog role) and picks **Team role** through the react-select control's class — each documented, but three class fallbacks in one new POM. `fleetRoles()` accepts `fleets` or `teams`, tolerant of the API rename at the cost of never saying which key Fleet sent. The context is a `withStaticUser` one, which the auto `pageHealth` fixture doesn't watch.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-33 · Premium • Settings • team admin scope › a team admin may rename their fleet but not delete it

- **File:** [`team-admin-scope.spec.ts`](../../tests/e2e/premium/settings/users/team-admin-scope.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "a team admin may rename their fleet but not delete it"`
- **Project:** premium · **Role:** `team-admin` · **Fleets:** Workstations (administered), QA (`qaFleetId`, not administered)
- **Mode:** UI+API · **Isolation:** independent; changes nothing by construction; own context via `withStaticUser`
- **Preconditions:** the `team-admin` static user; the Workstations and QA fleets
- **Data created:** none. **A rename is never saved:** Workstations and VMs are declared by name in gitops, so a renamed fleet would be orphaned by the next apply (which creates a new, empty fleet under the old name) and every worker resolving `workstationsFleetId` by name would fail meanwhile.

**Flow**

1. ☐ Log in as `team-admin` in a fresh context.
2. ☐ Open `/settings/fleets/users?fleet_id=<Workstations>` **via URL**.
   - ✅ *(UI)* **Add user** visible (`FleetUsersPage.goto` anchor).
   - ✅ *(UI)* **Rename fleet** visible in the fleet header.
   - ✅ *(UI)* **Delete fleet** absent (count 0) — withheld from everyone but global admins; the visible Rename proves the header rendered.
3. ☐ Click **Rename fleet**.
   - ✅ *(UI)* **Fleet name** reads `Workstations`.
4. ☐ Click **Cancel** → ✅ *(UI)* the rename modal closes.
5. ☐ *(API, as the team admin — their session token from the browser cookie, sent as a bearer token)* `PATCH /fleets/<Workstations>` with `{ "name": "" }`.
   - ✅ *(API)* **422** — authorized, then refused for the empty name; nothing changes.
6. ☐ *(API, as the team admin)* the same on `/fleets/<QA>`.
   - ✅ *(API)* **403** — not authorized on a fleet they don't administer.

**Assessment**
- *Value:* a neat answer to a hard permission to test — proving "may rename" without renaming a gitops-owned fleet. The 422/403 pair checks itself: if Fleet ever validated before authorizing, the QA call would turn 422 and fail, so the Workstations 422 can't quietly stop meaning "authorized". The Delete-absent-beside-Rename-present shape keeps the absence check honest.
- *Coverage gaps:* **delete is only a missing button** — there's no `DELETE /fleets/<Workstations>` → 403 probe as the team admin, deliberately: Fleet has no delete it refuses *after* authorizing (as the empty-name rename is), so if the gate regressed the probe would delete Workstations. The server side of delete is left to Fleet's own authz tests; **Add hosts** / **Manage enroll secrets** in the same header are unasserted for this role; the rename modal's Save is never exercised, even to see it enabled; team maintainer / observer (who should see neither button) aren't checked.
- *Redundancy:* none in this area; fleet create/delete as a global admin is MISC-27's throwaway fleet in [area 13](13-labels-packs-dashboard-paywalls.md).
- *Efficiency / smells:* direct-URL entry to the Users tab (USRP-32 covers the menu path, so that's fine). `sessionBearerHeaders` reads Fleet's `__Host-token` / `token` cookie — a tidy way to call the API as a static user with no token of its own, but it ties the test to Fleet's cookie name. The API calls are the real assertions; the UI half is presence only. `pageHealth` doesn't watch the `withStaticUser` context.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRP-34 · Create regular user (premium) — two-factor option › the two-factor checkbox starts unchecked, needs email, and hides under SSO

- **File:** [`regular-user-create.spec.ts`](../../tests/e2e/premium/settings/users/regular-user-create.spec.ts) — its own **non-serial** describe below the serial create block, so a failure here can't skip USRP-11…16
- **Grep:** `npx playwright test --project=premium -g "the two-factor checkbox starts unchecked"`
- **Project:** premium · **Mode:** UI · **Isolation:** independent; never submits
- **Preconditions:** admin session; **SSO configured on the premium instance** — the Authentication radios render only then, and the test asserts **Single sign-on** is enabled, so without SSO it fails rather than skips; `GET /config` decides the expected enabled state (Fleet can send email if `smtp_settings.configured`, or if `email.backend` is `"ses"` — `canSendEmail`, mirroring the form's own rule)
- **Data created:** none

**Flow**

1. ☐ *(API)* `GET /config` → can Fleet send email?
2. ☐ Open `/settings/users` via URL (✅ *(UI)* first row visible), click **Add user** → **Regular user**.
3. ☐ Look at **Enable two-factor authentication (email)**.
   - ✅ *(UI)* visible.
   - ✅ *(UI)* unchecked.
   - ✅ *(UI)* **enabled** if Fleet can send email, **disabled** if not — only the branch matching the instance's config runs.
4. ☐ Under **Authentication**, click **Single sign-on**.
   - ✅ *(UI)* the **Single sign-on** radio was enabled, and is now checked.
   - ✅ *(UI)* the two-factor checkbox is gone (count 0) — Fleet refuses MFA for SSO users.
5. ☐ Click **Password**.
   - ✅ *(UI)* the two-factor checkbox is back.

**Assessment**
- *Value:* the form rules around Fleet MFA — off by default, dependent on email, excluded by SSO. Each is a small regression that lets an admin create a user who can't sign in. Pairs with the free absence checks in [USRF-05 / USRF-09](09-users-free-and-shared.md) and with [API-32](14-api-contracts.md) (free refuses `mfa_enabled` with 402).
- *Coverage gaps:* **MFA is never turned on anywhere in the suite** — the box is never ticked and no premium user is saved with it, by UI or API; the edit form's checkbox (same rule, `EditUserPage.tsx`) is untested on premium; only the instance's current email branch runs, so the other half of the enabled/disabled rule goes unverified until the config changes; after switching back to Password the checkbox's unchecked/enabled state isn't re-checked; its visible label isn't asserted. The API-only path that combines SSO with Fleet MFA is refused with a known copy bug, *"Fleet MFA is is not applicable to SSO users"* ([fleetdm/fleet#54381](https://github.com/fleetdm/fleet/issues/54381), released in 4.92.1, #g-orchestration). The user form never lets the two combine, so the UI can't reach it, and no spec asserts the string; a test of it would assert the intended copy behind a skip.
- *Redundancy:* steps 1–2 repeat USRP-11's landing.
- *Efficiency / smells:* `mfaCheckbox` is found by the accessible name `mfa_enabled` — Fleet's `Checkbox` takes its name from the `name` prop, not the label — so the locator keys on a form-field name no user sees, and a label copy change passes unnoticed (documented in `UserFormFields`). `canSendEmail` re-implements the front end's rule as the oracle; if Fleet changes the rule, the test's expectation and the product drift apart without either being wrong on its own terms. The SSO dependency is stated in the test's comment and surfaces as a `toBeEnabled()` failure on the radio.

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
| Users list chrome + navbar entry | USRP-28, 30 | column set never asserted; no sorting |
| Row shape (Name/Role/Fleets/Status/Actions) | USRP-29 | assertions are non-empty only; Status copy unchecked |
| Create human user, global role | USRP-12 (5 roles) | **GitOps** global role never created here (⚠️ unclear if offered); no user is ever saved with SSO or MFA |
| Fleet MFA option on the create form | USRP-34 (default off, email-dependent, hidden under SSO); free absence in USRF-05/09; free API refusal API-32 | **MFA never turned on** by UI or API; edit form's checkbox untested on premium; only the instance's current email branch runs |
| Create human user, fleet-scoped | USRP-13, 14, 15 | per-fleet role never verified via API; >2 fleets untested |
| Create API user, global role | USRP-02 (6 roles) | token never exercised against the API |
| Create API user, fleet-scoped | USRP-03, 04, 05 | same |
| API endpoint scoping | USRP-06, 07, 08, 20 | **persistence of the allow-list is never verified anywhere**; no allow/deny probe with the token |
| API key reveal panel | USRP-09 | key never used; no "can't re-view later" check |
| Edit human user | USRP-17, 18 | form hydration unasserted; **email change (different toast copy) untested**; Global↔fleet switch untested; Cancel path untested |
| Edit API user | USRP-20 | save not verified; name/role/fleet edits untested |
| Delete user | USRP-21 | Cancel path; deleting an API user; API 404 confirmation |
| Self-protection | USRP-31 | only Delete; self-demotion untested |
| A fleet's Users tab, as its team admin (create / edit / remove member) | USRP-32 | the team admin's limits (other fleets, global roles, global users on their tab); Observer+ / Technician / Maintainer fleet roles; member never signs in |
| Fleet rename / delete permission, as a team admin | USRP-33 (rename allowed by API 422-vs-403; Delete button absent) | no `DELETE /fleets/:id` → 403 probe; rename never saved (deliberate — gitops owns the name); team maintainer / observer view of the header |
| Form validation | USRP-23–27 | **password policy copy, duplicate email, duplicate API name, name length all untested**; edit-form validation copy untested |
| Activity feed | USRP-10, 16, 19, 22 | actor never asserted; fleet-role-change copy untested |
| Invites (SMTP-based "invite user") | — | entirely absent (⚠️ unclear whether this instance has SMTP configured, which may be why) |
| Search / pagination / Require password reset / Reset sessions | [`shared/settings/users/`](../../tests/e2e/shared/settings/users/) | out of scope for this area |

**Duplication**

1. **Role permutations (the big one).** USRP-02 runs 6 roles and USRP-12 runs 5 through the same
   `DropdownWrapper` → `data-testid=dropdown-option` → `.role__cell` path. Only the
   `Observer` / `Observer+` pair is genuinely distinct product behaviour (the label-collision the
   anchored regexes guard). `Technician`, `Maintainer`, `Admin`, `GitOps` are the same code path
   re-run with a different string. Add the free mirrors (3 + 3 roles) and this cluster is **17
   full create-flows for ~2 behaviours**. Recommended keep-set: Observer, Observer+, one privileged
   role, per form.
2. **Fleet-assignment permutations across forms.** USRP-03/04/05 (API form) and USRP-13/14/15
   (human form) assert the *same* Fleets/Role cell renderer (`Workstations` · `2 fleets` ·
   `Various` vs exact role). The renderer is shared, so one form should own these three cases and
   the other should keep a single fleet-scoped smoke.
3. **Row-assertion block.** The 5-assertion bundle is written four ways: `assertApiUserRow`
   ([`api-user-create.spec.ts:14`](../../tests/e2e/premium/settings/users/api-user-create.spec.ts#L14),
   **copy-pasted verbatim** into `free/settings/users/api-user-create.spec.ts:24`), inline ×4 in
   `regular-user-create.spec.ts` (lines 62–71, 100–105, 133–139, 169–174), a weaker
   `toContainText` version in `edit.spec.ts:67-70`, and a column-based one in USRP-29.
   → **`expectUserRow` belongs on `UsersPage`**: `expectRow(row, { name, email, role, fleets, api })`
   with `.role__cell` / `.email__cell` anchors and an optional `.pill-badge` check. It would replace
   ~45 lines across 4 premium + 2 free specs and would fix the edit spec's weaker assertion for free.
4. **Validation button-state tests.** USRP-23, USRP-24 and USRP-17 are one behaviour (required-field
   → disabled submit) in three tests. Collapse to one loop over the required fields.
5. **Landing-page tests.** USRP-30 is fully contained in USRP-01 + USRP-11.
6. **Activity-feed tests.** Four near-identical feed walks (USRP-10, 16, 19, 22). Each `expectActivity`
   can walk 15 pages × 10 reloads, so these are among the slowest tests in the area; USRP-10 and
   USRP-16 could merge into one `expectActivities([created-human, created-api])`.
7. **Cross-tier mirrors.** `edit`, `delete`, `navigation-and-layout`, `form-validation` are ~95%
   identical to their `free/settings/users/` counterparts. Per the suite's explicit-tier-separation
   preference that is accepted duplication, but the *premium* files should then carry only what is
   premium-specific plus one smoke of the shared path — today they carry the full free suite again.

**Cleanup / leak analysis** (this is what breaks the shared pagination + search specs)

- Both create specs defer deletion to `afterAll` and record ids conditionally:
  `if (id !== null) createdUserIds.push(id)` ([api-user-create lines 93, 121, 147, 173, 228, 285](../../tests/e2e/premium/settings/users/api-user-create.spec.ts#L93)) and
  `if (created) createdUserIds.push(created.id)` ([regular-user-create:74](../../tests/e2e/premium/settings/users/regular-user-create.spec.ts#L74)).
  A lookup miss leaks silently — no assertion, no warning.
- For **human** users that is recoverable: emails match `QA_TEST_EMAIL_RE` so
  `deleteAllQaTestUsers` in `cleanup-setup`/`cleanup-teardown` reaps them.
- For **API-only** users it is not: Fleet stamps its own placeholder email, which ⚠️ almost
  certainly does not match `^qa-test-\d+-[a-z0-9]+@fleetdm\.com$`, so nothing in the suite can ever
  reap a leaked API user. A crashed worker in `api-user-create.spec.ts` leaves up to 10 permanent
  users on the instance. Since the list paginates at 10/page, accumulation directly degrades
  `shared/settings/users/pagination.spec.ts` and `search.spec.ts`, and pushes newly-created rows off
  page 1 (which is exactly why `findRowByEmail`/`findRowByName` search first —
  [`UsersPage.ts:124`](../../pages/settings/users/UsersPage.ts#L124)).
- Also worth noting: at peak, `api-user-create.spec.ts` holds ~10 users alive simultaneously because
  nothing is deleted until `afterAll`.
- The hard-coded validation emails (`qa-test-validation@`, `qa-test-emptyfleets@`) do not match the
  cleanup regex either. They are never submitted today, so this is latent rather than active.
- **`disposableUser` fixture** (the deferred idea) applies cleanly to the API-precondition specs —
  `edit.spec.ts:15-30` and `:84-94`, `delete.spec.ts:12-27`, plus `shared/.../row-actions.spec.ts`
  and `search.spec.ts` — replacing four hand-rolled `beforeAll`/`afterAll` pairs. For the two
  *create* specs the user is born in the browser, so what they need is a sibling
  **`trackedUser` / cleanup-registry fixture** (`register(email | name)`, reap in fixture teardown,
  unconditionally and per-test). That also unlocks dropping `mode: 'serial'` from both create specs,
  whose only real serial dependency is the trailing activity test.

**UI-vs-API balance**

Healthily UI-weighted. `edit` and `delete` build preconditions over the API (correct — the create
flow is covered elsewhere) and validate through the browser. The only genuine API assertion in the
area is USRP-10's `expect(id).not.toBeNull()`, and it exists to resolve the server-stamped email —
justified. The four activity-feed tests read the feed through the UI, which is the suite convention.
The gap is the opposite of a shortcut: several tests would be **stronger with an API check they
don't make** — USRP-08 and USRP-20 (endpoint allow-list persisted?), USRP-13/03 (`fleets[]` correct?),
USRP-21 (`GET /users/:id` → 404?), USRP-26 (no user created?). The `POST` calls in the create specs
are cleanup bookkeeping, not validation, so those tests are `UI` mode despite touching the API.

**Quick wins**

1. Trim the role loops to `['Observer', 'Observer+', 'Admin']` in
   [`regular-user-create.spec.ts:6`](../../tests/e2e/premium/settings/users/regular-user-create.spec.ts#L6) and
   [`api-user-create.spec.ts:23`](../../tests/e2e/premium/settings/users/api-user-create.spec.ts#L23) — drops 5 full UI create-flows with no behavioural loss.
2. Move the two default-radio assertions out of the USRP-02 loop body (`api-user-create.spec.ts:82-83`) into USRP-01, where they run once.
3. Add `UsersPage.expectRow(...)` and delete `assertApiUserRow` from both premium and free API specs plus the four inline blocks in `regular-user-create.spec.ts`; use it in `edit.spec.ts:67-70` to replace the weak `toContainText('Maintainer')` with a `.role__cell` anchor.
4. Delete USRP-30 (subsumed by USRP-01 + USRP-11) and fold USRP-06 into USRP-08.
5. Make cleanup unconditional in both create specs: fail loudly (or `console.warn`) when the post-create lookup returns nothing, instead of `if (id !== null)` — a silent skip is how API users leak permanently.

**Bigger bets**

1. **`trackedUser` + `disposableUser` fixture pair**, then drop `mode: 'serial'` from
   `api-user-create.spec.ts` and `regular-user-create.spec.ts`. Today a flake in the first sub-test
   skips the remaining 9 / 5; with per-test cleanup each permutation is independent and the suite
   parallelises better (relevant to the workers=4→6 question).
2. **Own the endpoint-scoping contract end-to-end.** Merge USRP-06/07/08/20 into one lifecycle
   (create scoped API user → reopen edit page and assert the saved allow-list → call an allowed
   endpoint 200 and a disallowed one 403 with the returned token → widen back to All endpoints).
   That converts the area's weakest cluster into its strongest, and is the only way the feature's
   actual purpose gets tested.
3. **Split premium files down to premium-only behaviour** and let the free mirrors own the shared
   paths (or vice versa): premium keeps fleet-assignment permutations, the Fleets column, the
   `Various` collapse, the premium role set, and the "select at least one fleet" rule. That plus
   quick win 1 removes roughly half the runtime of this area, which is currently the densest in the
   suite for the amount of distinct behaviour it covers.
