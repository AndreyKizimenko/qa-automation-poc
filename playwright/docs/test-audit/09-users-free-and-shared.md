# Settings › Users — free + shared — test audit

**Specs covered:** 9 files · **Test declarations:** 27 · **Projects:** free (6 specs) / free + premium (3 shared specs)

Covers `/settings/users`: the user list (search, pagination, per-row Actions), the
two creation sub-pages (`/settings/users/new/human`, `/settings/users/new/api`), the
edit sub-page (`/settings/users/:id/edit`), and the inline Delete / Require password
reset / Reset sessions modals. The six `tests/e2e/free/settings/users/*` specs are
line-for-line near-copies of `tests/e2e/premium/settings/users/*` (audited as
`USRP`) minus the fleet-assignment surface; the three `tests/e2e/shared/settings/users/*`
specs are tier-agnostic and run **once per suite** (the `free` and `premium` projects
both use `testDir: ./tests` and only ignore the other tier's folder —
[`playwright.config.ts:151-179`](../../playwright.config.ts)).

Free ↔ premium delta, in full (nothing else differs):

| Free spec | Premium counterpart | Only difference |
|---|---|---|
| `regular-user-create.spec.ts` | `premium/…/regular-user-create.spec.ts` | Free role list is `Observer, Maintainer, Admin` (premium adds `Observer+`, `Technician`); free skips `useGlobalUser()` (no Permissions radio) and the `'Global'` fleets-cell assert; premium adds 3 fleet-assignment tests |
| `api-user-create.spec.ts` | `premium/…/api-user-create.spec.ts` | Same role-list delta (+`GitOps`); free skips the `globalUserRadio` / `allEndpointsRadio` default asserts; premium adds 3 fleet-scoped + 3 specific-endpoint tests; free reveal test expects default role `Observer` vs premium `GitOps` |
| `edit.spec.ts` | `premium/…/edit.spec.ts` | Identical bodies; premium adds a second describe (`Edit API-only user`) |
| `delete.spec.ts` | `premium/…/delete.spec.ts` | **Identical apart from one comment** |
| `form-validation.spec.ts` | `premium/…/form-validation.spec.ts` | Identical; premium adds `submit with Assign-to-fleets but no fleet checked` |
| `navigation-and-layout.spec.ts` | `premium/…/navigation-and-layout.spec.ts` | Free omits the `Fleets` column cell check (and the title word "fleets") |

## Contents

| ID | Spec | Test | Mode | Manual? |
|---|---|---|---|---|
| USRF-01 | `free/settings/users/api-user-create.spec.ts` | Create API-only user (free) › Add user → API-only user lands on the API create sub-page | UI | ☐ |
| USRF-02 | `free/settings/users/api-user-create.spec.ts` | Create API-only user (free) › creates API user with role `<Observer\|Maintainer\|Admin>` | UI | ☐ |
| USRF-03 | `free/settings/users/api-user-create.spec.ts` | Create API-only user (free) › API key reveal: heading, key visible, show/hide, copy, banner, then Done | UI | ☐ |
| USRF-04 | `free/settings/users/api-user-create.spec.ts` | Create API-only user (free) › activity feed shows the created-API-user entry | UI+API | ☐ |
| USRF-05 | `free/settings/users/regular-user-create.spec.ts` | Create regular user (free) › Add user → Regular user lands on the create sub-page | UI | ☐ |
| USRF-06 | `free/settings/users/regular-user-create.spec.ts` | Create regular user (free) › creates user with role `<Observer\|Maintainer\|Admin>` | UI | ☐ |
| USRF-07 | `free/settings/users/regular-user-create.spec.ts` | Create regular user (free) › activity feed shows the created-user entry | UI | ☐ |
| USRF-08 | `free/settings/users/edit.spec.ts` | Edit user › Save is disabled while Full name is empty | UI | ☐ |
| USRF-09 | `free/settings/users/edit.spec.ts` | Edit user › admin edits via row Actions → Edit; users row reflects the change | UI | ☐ |
| USRF-10 | `free/settings/users/edit.spec.ts` | Edit user › activity feed shows the edited-user entry | UI | ☐ |
| USRF-11 | `free/settings/users/delete.spec.ts` | Delete user › admin deletes a user via the row Actions menu | UI | ☐ |
| USRF-12 | `free/settings/users/delete.spec.ts` | Delete user › activity feed shows the deleted-user entry | UI | ☐ |
| USRF-13 | `free/settings/users/form-validation.spec.ts` | Create-user form validation › Regular user › clearing Full name disables Add | UI | ☐ |
| USRF-14 | `free/settings/users/form-validation.spec.ts` | Create-user form validation › Regular user › clearing Email disables Add | UI | ☐ |
| USRF-15 | `free/settings/users/form-validation.spec.ts` | Create-user form validation › Regular user › invalid email format surfaces an inline error | UI | ☐ |
| USRF-16 | `free/settings/users/form-validation.spec.ts` | Create-user form validation › API-only user › submitting an empty Name surfaces "Name is required" | UI | ☐ |
| USRF-17 | `free/settings/users/navigation-and-layout.spec.ts` | Users page navigation and layout › user menu → Users renders the list and page chrome | UI | ☐ |
| USRF-18 | `free/settings/users/navigation-and-layout.spec.ts` | Users page navigation and layout › first-page rows expose name, role, status, and Actions | UI | ☐ |
| USRF-19 | `free/settings/users/navigation-and-layout.spec.ts` | Users page navigation and layout › Add user dropdown exposes Regular user and API-only user options | UI | ☐ |
| USRF-20 | `free/settings/users/navigation-and-layout.spec.ts` | Users page navigation and layout › current admin cannot delete themselves | UI | ☐ |
| USRF-21 | `shared/settings/users/search.spec.ts` | Users search › search by name narrows the table to the matching user | UI | ☐ |
| USRF-22 | `shared/settings/users/search.spec.ts` | Users search › search by email narrows the table to the matching user | UI | ☐ |
| USRF-23 | `shared/settings/users/search.spec.ts` | Users search › clearing the search restores the unfiltered list | UI | ☐ |
| USRF-24 | `shared/settings/users/row-actions.spec.ts` | User row actions › Require password reset opens the confirmation modal and confirms | UI | ☐ |
| USRF-25 | `shared/settings/users/row-actions.spec.ts` | User row actions › Reset sessions opens the confirmation modal and confirms | UI | ☐ |
| USRF-26 | `shared/settings/users/row-actions.spec.ts` | Reset sessions invalidates the user token › resetting the user's sessions invalidates their existing token | UI+API | ☐ |
| USRF-27 | `shared/settings/users/pagination.spec.ts` | Users pagination › Next pagination control becomes enabled and advances the table | UI | ☐ |

Shared helper used by USRF-02/03 (`assertApiUserRow`,
[`api-user-create.spec.ts:24-32`](../../tests/e2e/free/settings/users/api-user-create.spec.ts)) —
a **validation bundle**: row visible · `.data-table__tooltip-truncated-text` (first) has
exactly the user's name · `.pill-badge` has exactly `API` · `.role__cell` has exactly the role.

POM behaviours referenced repeatedly:

- `usersPage.goto()` — `/settings/users` via URL, then ✅ *(UI)* first table row visible.
- `usersPage.findRowByEmail(email)` / `findRowByName(name)` — type the value into
  **Search by name or email** (no settle wait), return the row locator anchored on an
  end-anchored `.email__cell` regex / `rowWith(name).first()`. Search-then-act exists
  because the list paginates at 10/page and the static-user catalog alone fills page 1.
- `usersPage.clickRowAction(row, action)` — click the row's `.actions-dropdown__wrapper`,
  then click the `.actions-dropdown__option` whose text contains the action label.
- `toast.expectSuccess(text)` — a `role="alert"` card with class
  `toast-notification__card--success` containing `text` is visible.
- `dashboard.expectActivity(re)` — load `/dashboard` (✅ first card visible), then walk the
  activity feed up to 15 pages looking for a button whose accessible name matches; on miss,
  reload and re-walk up to 10 times.
- Auto `pageHealth` fixture (every test): ✅ *(UI/API)* no console errors and no 5xx
  responses during the test, asserted after a passing test.

---

### USRF-01 · Create API-only user (free) › Add user → API-only user lands on the API create sub-page

- **File:** [`playwright/tests/e2e/free/settings/users/api-user-create.spec.ts`](../../tests/e2e/free/settings/users/api-user-create.spec.ts)
- **Grep:** `npx playwright test -g "Add user → API-only user lands on the API create sub-page"`
- **Project:** free · **Premium twin:** `premium/settings/users/api-user-create.spec.ts` (identical body)
- **Mode:** UI · **Isolation:** serial describe, step 1 of 6
- **Preconditions:** admin session; at least one user exists (`goto()` waits for a row)
- **Data created:** none

**Flow**

1. ☐ Open `/settings/users` via URL.
   - ✅ *(UI)* First table row is visible.
2. ☐ Click **Add user** → click **API-only user**.
   - ✅ *(UI)* URL is `/settings/users/new/api`.
   - ✅ *(UI)* **Name** input (`#name`) is visible.

**Assessment**
- *Value:* catches the Add-user dropdown or the `new/api` route breaking.
- *Coverage gaps:* doesn't assert the free form's shape (that Permissions / API-access radios are absent and the role dropdown renders by default) — the only tier-gating check that would matter here.
- *Redundancy:* the dropdown option's existence is already asserted by USRF-19; the destination page is re-visited via URL by USRF-02/03/16.
- *Efficiency / smells:* none.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRF-02 · Create API-only user (free) › creates API user with role `<role>`

- **File:** [`playwright/tests/e2e/free/settings/users/api-user-create.spec.ts`](../../tests/e2e/free/settings/users/api-user-create.spec.ts)
- **Grep:** `npx playwright test -g "creates API user with role"`
- **Project:** free · **Roles (3 declarations, one body):** Observer, Maintainer, Admin
- **Premium twin:** `premium/settings/users/api-user-create.spec.ts` › `creates global API user with role <role> (all endpoints)` — same body plus 3 extra roles (`Observer+`, `Technician`, `GitOps`) and two default-state asserts
- **Mode:** UI · **Isolation:** serial describe, steps 2-4 of 6
- **Preconditions:** admin session
- **Data created:** API-only user `QA API <role> <stamp>-<slug>` — **not** deleted in-test; deleted in `afterAll` via `DELETE /users/:id`, and only if the post-hoc `listUsers` lookup found it (`if (id !== null)`, line 80)

**Flow**

1. ☐ Open `/settings/users/new/api` via URL (✅ *(UI)* **Name** visible).
2. ☐ Fill **Name** with `QA API <role> <stamp>-<slug>`.
3. ☐ Open the role dropdown and pick `<role>` (exact-text `dropdown-option` match, so `Observer` can't hit `Observer+`).
4. ☐ Click **Add** → ✅ *(UI)* **Done** button visible (the API-key panel rendered) → click **Done**.
   - ✅ *(UI)* URL is back on `/settings/users`.
   - ✅ *(UI)* Success toast `"<name> has been created!"`.
5. ☐ Type the name into **Search by name or email**.
   - ✅ *(UI)* `assertApiUserRow` bundle: row visible, Name cell text exactly the name, `API` pill badge, Role cell exactly `<role>`.

**Assessment**
- *Value:* the core free API-user creation journey, per role — catches role-option gating, the create POST, the key panel, and how the row renders.
- *Coverage gaps:* the returned token is never exercised against the API (does an `Observer` API user actually get observer authz?); free-only role gating (Observer+/Technician/GitOps must be **absent** from the dropdown) is unasserted; Status cell for API users unasserted.
- *Redundancy:* the key panel it walks through is asserted in depth by USRF-03; the `Done` → list → toast → row tail is identical in USRF-03. Cross-tier: near-total overlap with the premium twin (USRP) for `Observer`/`Maintainer`/`Admin`.
- *Efficiency / smells:* cleanup is conditional (`if (id !== null)`) — a lookup miss silently leaks a user, and API-only users carry a **server-stamped email that does not match `QA_TEST_EMAIL_RE`** ([`helpers/api/users.ts:66`](../../helpers/api/users.ts)), so `deleteAllQaTestUsers` in `cleanup-setup`/`cleanup-teardown` can never sweep them — leaks are permanent and inflate the user table other tests read (USRF-18/27). ⚠️ unclear: exact email Fleet stamps on `api_only` users (not derivable from this repo).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRF-03 · Create API-only user (free) › API key reveal: heading, key visible, show/hide, copy, banner, then Done

- **File:** [`playwright/tests/e2e/free/settings/users/api-user-create.spec.ts`](../../tests/e2e/free/settings/users/api-user-create.spec.ts)
- **Grep:** `npx playwright test -g "API key reveal: heading, key visible, show/hide, copy, banner, then Done"`
- **Project:** free · **Premium twin:** same title in `premium/…/api-user-create.spec.ts` (identical except the expected default role: free `Observer`, premium `GitOps`)
- **Mode:** UI · **Isolation:** serial describe, step 5 of 6
- **Preconditions:** admin session
- **Data created:** API-only user `QA API Reveal <stamp>` — deleted in `afterAll` (same conditional-tracking caveat as USRF-02)

**Flow**

1. ☐ Open `/settings/users/new/api` via URL; fill **Name** = `QA API Reveal <stamp>`; leave role at its default.
2. ☐ Click **Add**.
   - ✅ *(UI)* `<h1>` is the user's name.
   - ✅ *(UI)* API-key input (`input[name="api-key"]`) visible; `.info-banner` contains "note of this API key".
   - ✅ *(UI)* Key input starts masked (`type="password"`), **Show secret** visible.
3. ☐ Click **Show secret**.
   - ✅ *(UI)* Input flips to `type="text"`; **Hide secret** visible.
   - ✅ *(UI)* The input's value is longer than 20 chars (a real token, not a placeholder).
4. ☐ Click **Hide secret**.
   - ✅ *(UI)* Input back to `type="password"`; **Show secret** visible.
5. ☐ Click **Copy to clipboard**.
   - ✅ *(UI)* Button stays enabled and visible (clipboard contents not read).
6. ☐ Click **Done**.
   - ✅ *(UI)* URL `/settings/users`; success toast `"<name> has been created!"`.
   - ✅ *(UI)* After searching the name: `assertApiUserRow` bundle with role `Observer` — i.e. free's default role when the dropdown is untouched.

**Assessment**
- *Value:* the only test of the `ApiKeyDisplay` panel (mask/reveal/copy) and of the free form's **default role**.
- *Coverage gaps:* clipboard payload not verified; the revealed token is never used to call the API; no check that navigating away without **Done** still created the user.
- *Redundancy:* the trailing create-then-row assertions duplicate USRF-02 wholesale; the panel walk duplicates the premium twin exactly.
- *Efficiency / smells:* asserts `copyButton` visible immediately after clicking it — a tautology that can't fail. Same conditional cleanup / un-sweepable email issue as USRF-02.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRF-04 · Create API-only user (free) › activity feed shows the created-API-user entry

- **File:** [`playwright/tests/e2e/free/settings/users/api-user-create.spec.ts`](../../tests/e2e/free/settings/users/api-user-create.spec.ts)
- **Grep:** `npx playwright test -g "activity feed shows the created-API-user entry"`
- **Project:** free · **Premium twin:** same title in `premium/…/api-user-create.spec.ts` (premium adds a redundant id lookup first)
- **Mode:** UI+API · **Isolation:** serial describe, step 6 of 6 — **depends on USRF-02's Observer run having created `QA API Observer <stamp>-observer`**
- **Preconditions:** the Observer API user from USRF-02 still exists
- **Data created:** none

**Flow**

1. ☐ *(API)* `GET /users?query=QA API Observer <stamp>-observer` and pick the `api_only` record with that exact name.
   - ✅ *(API)* Such a user exists (`expect(target).toBeTruthy()`) — needed because API users' emails are server-generated.
2. ☐ Open `/dashboard` (✅ *(UI)* first card visible) and read the **Activity** feed.
   - ✅ *(UI)* A feed row matches `created a user\s+<stamped email>\.` (feed walked ≤15 pages, reloaded ≤10 times).

**Assessment**
- *Value:* confirms API-user creation writes the `created_user` activity with the right subject.
- *Coverage gaps:* doesn't check the actor ("<admin> created a user"), the timestamp, or the row's detail expansion.
- *Redundancy:* structurally identical to USRF-07 / USRF-10 / USRF-12 and to the premium twin — 4 near-identical activity-feed tests in this area alone.
- *Efficiency / smells:* cross-test dependency on USRF-02 makes the whole serial file fail as a block; a self-contained API-created user would decouple it.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRF-05 · Create regular user (free) › Add user → Regular user lands on the create sub-page

- **File:** [`playwright/tests/e2e/free/settings/users/regular-user-create.spec.ts`](../../tests/e2e/free/settings/users/regular-user-create.spec.ts)
- **Grep:** `npx playwright test -g "Add user → Regular user lands on the create sub-page"`
- **Project:** free · **Premium twin:** same title in `premium/…/regular-user-create.spec.ts` (identical body)
- **Mode:** UI · **Isolation:** serial describe, step 1 of 5
- **Preconditions:** admin session
- **Data created:** none

**Flow**

1. ☐ Open `/settings/users` via URL (✅ *(UI)* first row visible).
2. ☐ Click **Add user** → click **Regular user**.
   - ✅ *(UI)* URL is `/settings/users/new/human`.
   - ✅ *(UI)* **Full name** input visible.

**Assessment**
- *Value:* dropdown → human-create route smoke.
- *Coverage gaps:* doesn't assert free's form shape (no Permissions radio, role dropdown rendered, no fleets section).
- *Redundancy:* mirrors USRF-01; the option's presence is also asserted by USRF-19.
- *Efficiency / smells:* none.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRF-06 · Create regular user (free) › creates user with role `<role>`

- **File:** [`playwright/tests/e2e/free/settings/users/regular-user-create.spec.ts`](../../tests/e2e/free/settings/users/regular-user-create.spec.ts)
- **Grep:** `npx playwright test -g "creates user with role"`
- **Project:** free · **Roles (3 declarations, one body):** Observer, Maintainer, Admin
- **Premium twin:** `premium/…/regular-user-create.spec.ts` › `creates global user with role <role>` — **the only differences are the extra premium roles, the `useGlobalUser()` click (premium defaults Permissions to Assign-to-fleets), and premium's extra `toContainText('Global')` fleets-cell assert**
- **Mode:** UI · **Isolation:** serial describe, steps 2-4 of 5
- **Preconditions:** admin session; `FLEET_TEST_USER_PASSWORD` set (`qaTestPassword()` throws otherwise)
- **Data created:** user `qa-test-<stamp>-<slug>@fleetdm.com` — **not** deleted in-test; `afterAll` deletes it if `findUserByEmail` matched (`if (created)`, line 66); the `qa-test-*` email is also swept by `cleanup-setup`/`cleanup-teardown`

**Flow**

1. ☐ Open `/settings/users/new/human` via URL (✅ *(UI)* **Full name** visible).
2. ☐ Fill **Full name** = `QA <role>`, **Email** = `qa-test-<stamp>-<slug>@fleetdm.com`, **Password** = `FLEET_TEST_USER_PASSWORD`.
3. ☐ Open the role dropdown and pick `<role>` (exact-text option match).
4. ☐ Click **Add**.
   - ✅ *(UI)* URL back on `/settings/users`; success toast `"<name> has been created!"`.
5. ☐ Search the email.
   - ✅ *(UI)* Row visible, contains the name, `.role__cell` has exactly `<role>`, `.email__cell` has exactly the email.

**Assessment**
- *Value:* the primary free create-user journey and the UI→API→UI round-trip on name/role/email.
- *Coverage gaps:* the created user is never logged in (password actually usable? forced-reset default?); **Status** cell (`Invited`/`Active`) unasserted; no negative check that `Observer+`/`Technician`/`GitOps` are missing from the free dropdown; duplicate-email rejection untested.
- *Redundancy:* Observer/Maintainer/Admin bodies are otherwise identical to premium (USRP) — 3 of the 5 premium role runs are duplicated here.
- *Efficiency / smells:* conditional cleanup (`if (created)`) can silently skip tracking; three near-identical full UI creates cost ~3 page loads + 3 submits where one UI create plus API-level role coverage would do.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRF-07 · Create regular user (free) › activity feed shows the created-user entry

- **File:** [`playwright/tests/e2e/free/settings/users/regular-user-create.spec.ts`](../../tests/e2e/free/settings/users/regular-user-create.spec.ts)
- **Grep:** `npx playwright test -g "activity feed shows the created-user entry"`
- **Project:** free · **Premium twin:** same title in `premium/…/regular-user-create.spec.ts` (identical)
- **Mode:** UI · **Isolation:** serial describe, step 5 of 5 — depends on USRF-06's Observer run
- **Preconditions:** `qa-test-<stamp>-observer@fleetdm.com` was created earlier in this file
- **Data created:** none

**Flow**

1. ☐ Open `/dashboard` and read the **Activity** feed.
   - ✅ *(UI)* A row matches `created a user\s+qa-test-<stamp>-observer@fleetdm\.com\.`

**Assessment**
- *Value:* activity contract for human-user creation.
- *Coverage gaps:* actor and role not asserted.
- *Redundancy:* same shape as USRF-04/10/12 and the premium twin.
- *Efficiency / smells:* hard cross-test dependency on USRF-06 (email string reconstructed from `stamp`), so a failure there cascades.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRF-08 · Edit user › Save is disabled while Full name is empty

- **File:** [`playwright/tests/e2e/free/settings/users/edit.spec.ts`](../../tests/e2e/free/settings/users/edit.spec.ts)
- **Grep:** `npx playwright test -g "Save is disabled while Full name is empty"`
- **Project:** free · **Premium twin:** same title in `premium/…/edit.spec.ts` (identical body; only a comment differs)
- **Mode:** UI · **Isolation:** serial describe, step 1 of 3
- **Preconditions:** `beforeAll` creates `qa-test-<stamp>-edit@fleetdm.com` (name `QA Edit Initial`, `global_role: observer`, `admin_forced_password_reset: false`) via `POST /users/admin` — ✅ *(API)* response OK asserted inside `createUser`
- **Data created:** that user — deleted in `afterAll` via `DELETE /users/:id` (`ignoreMissing`)

**Flow**

1. ☐ Open `/settings/users/<id>/edit` via URL (✅ *(UI)* "Edit user" or "Edit API-only user" heading visible).
2. ☐ Clear **Full name**, press **Tab**.
   - ✅ *(UI)* **Save** is disabled.

**Assessment**
- *Value:* edit-form required-field gating.
- *Coverage gaps:* Email cleared / invalid on the edit form is untested; no check that **Save** re-enables when the name is restored.
- *Redundancy:* same validator as USRF-13 on the create form.
- *Efficiency / smells:* none (API setup, direct URL — correct choices here).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRF-09 · Edit user › admin edits via row Actions → Edit; users row reflects the change

- **File:** [`playwright/tests/e2e/free/settings/users/edit.spec.ts`](../../tests/e2e/free/settings/users/edit.spec.ts)
- **Grep:** `npx playwright test -g "admin edits via row Actions → Edit; users row reflects the change"`
- **Project:** free · **Premium twin:** same title in `premium/…/edit.spec.ts` (**byte-identical body**)
- **Mode:** UI · **Isolation:** serial describe, step 2 of 3 (mutates the user USRF-08 used; USRF-10 asserts its activity)
- **Preconditions:** the `beforeAll` user exists with role Observer
- **Data created:** none (renames the existing user to `QA Edit Updated`, role → Maintainer)

**Flow**

1. ☐ Open `/settings/users`; type the email into **Search by name or email**.
   - ✅ *(UI)* The row for that email is visible.
2. ☐ Open the row's **Actions** dropdown → click **Edit**.
   - ✅ *(UI)* URL matches `/settings/users/<id>/edit`; **Edit user** `<h1>` visible.
3. ☐ Set **Full name** = `QA Edit Updated`; pick role **Maintainer**; click **Save**.
   - ✅ *(UI)* URL back on `/settings/users`; success toast `"Successfully edited QA Edit Updated"`.
4. ☐ Re-search the email (the save redirect lands unfiltered).
   - ✅ *(UI)* Row visible and contains `QA Edit Updated` and `Maintainer`.

**Assessment**
- *Value:* the full edit journey incl. the row-Actions entry point and list refresh.
- *Coverage gaps:* email change (and its "confirmation email sent" toast variant) untested; **Cancel** / **Back to users** untested; no API re-read to confirm `global_role` actually changed (only the rendered cell); password-change and SSO/MFA toggles on the edit form untested.
- *Redundancy:* duplicated verbatim on premium (USRP); role-cell rendering also asserted by USRF-06.
- *Efficiency / smells:* step 4 asserts with `toContainText('Maintainer')` rather than the exact `.role__cell` match used elsewhere — weaker than the file's own convention.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRF-10 · Edit user › activity feed shows the edited-user entry

- **File:** [`playwright/tests/e2e/free/settings/users/edit.spec.ts`](../../tests/e2e/free/settings/users/edit.spec.ts)
- **Grep:** `npx playwright test -g "activity feed shows the edited-user entry"`
- **Project:** free · **Premium twin:** same title in `premium/…/edit.spec.ts` (identical; the matcher itself branches on `SUITE` — premium copy appends " for all fleets")
- **Mode:** UI · **Isolation:** serial describe, step 3 of 3 — depends on USRF-09
- **Preconditions:** USRF-09 performed the role change
- **Data created:** none

**Flow**

1. ☐ Open `/dashboard` and read the **Activity** feed.
   - ✅ *(UI)* A row matches `changed <email> to maintainer\.` (free copy; premium expects the `for all fleets` suffix — [`helpers/activity-copy.ts:224-227`](../../helpers/activity-copy.ts)).

**Assessment**
- *Value:* the one place the free-vs-premium activity copy difference is pinned.
- *Coverage gaps:* the name-change activity (if any) isn't asserted, only the role change.
- *Redundancy:* same shape as USRF-04/07/12.
- *Efficiency / smells:* tier branching lives in the helper, so a mis-set `SUITE` would silently assert the wrong copy.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRF-11 · Delete user › admin deletes a user via the row Actions menu

- **File:** [`playwright/tests/e2e/free/settings/users/delete.spec.ts`](../../tests/e2e/free/settings/users/delete.spec.ts)
- **Grep:** `npx playwright test -g "admin deletes a user via the row Actions menu"`
- **Project:** free · **Premium twin:** `premium/…/delete.spec.ts` — **identical apart from one comment**
- **Mode:** UI · **Isolation:** serial describe, step 1 of 2
- **Preconditions:** `beforeAll` API-creates `qa-test-<ts>-delete@fleetdm.com` (`QA Delete Target`, observer)
- **Data created:** that user — **deleted in this test through the UI**; `afterAll` is neutralised by setting `userId = undefined`

**Flow**

1. ☐ Open `/settings/users`; search the email → ✅ *(UI)* row visible.
2. ☐ Row **Actions** → **Delete**.
   - ✅ *(UI)* Delete-user modal visible and contains the user's name.
3. ☐ Click **Delete** in the modal.
   - ✅ *(UI)* Modal hidden; success toast `"Successfully deleted QA Delete Target."`.
   - ✅ *(UI)* No row containing the email remains (`toHaveCount(0)`, auto-waited).

**Assessment**
- *Value:* the delete journey end to end, incl. the confirm modal copy.
- *Coverage gaps:* no API confirmation the user is gone (`GET /users/:id` → 404) — the row check runs against a *search-filtered* table, so a stale filter would also read as "gone"; modal **Cancel** (no-op) path untested.
- *Redundancy:* verbatim duplicate of the premium delete spec — the strongest merge candidate in this area.
- *Efficiency / smells:* `usersPage.table.rowWith(email)` is a text-anywhere row filter, weaker than the `.email__cell` anchor the same POM offers.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRF-12 · Delete user › activity feed shows the deleted-user entry

- **File:** [`playwright/tests/e2e/free/settings/users/delete.spec.ts`](../../tests/e2e/free/settings/users/delete.spec.ts)
- **Grep:** `npx playwright test -g "activity feed shows the deleted-user entry"`
- **Project:** free · **Premium twin:** same title in `premium/…/delete.spec.ts` (identical)
- **Mode:** UI · **Isolation:** serial describe, step 2 of 2 — depends on USRF-11
- **Preconditions:** USRF-11 deleted the user
- **Data created:** none

**Flow**

1. ☐ Open `/dashboard` and read the **Activity** feed.
   - ✅ *(UI)* A row matches `deleted a user\s+<email>\.`

**Assessment**
- *Value:* deletion activity contract.
- *Coverage gaps:* actor not asserted.
- *Redundancy:* fourth copy of the same activity-feed pattern in this area (USRF-04/07/10/12), each also duplicated on premium.
- *Efficiency / smells:* none beyond the serial dependency.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRF-13 · Create-user form validation › Regular user › clearing Full name disables Add

- **File:** [`playwright/tests/e2e/free/settings/users/form-validation.spec.ts`](../../tests/e2e/free/settings/users/form-validation.spec.ts)
- **Grep:** `npx playwright test -g "clearing Full name disables Add"`
- **Project:** free · **Premium twin:** same title in `premium/…/form-validation.spec.ts` (identical; premium file adds one extra fleets-validation test)
- **Mode:** UI · **Isolation:** independent (parallel-safe, no data)
- **Preconditions:** `FLEET_TEST_USER_PASSWORD` set
- **Data created:** none (never submits)

**Flow**

1. ☐ Open `/settings/users/new/human` via URL.
2. ☐ Fill **Full name** = `QA Validation`, **Email** = `qa-test-validation@fleetdm.com`, **Password**, press **Tab**.
   - ✅ *(UI)* **Add** is enabled.
3. ☐ Clear **Full name**, press **Tab**.
   - ✅ *(UI)* **Add** is disabled.

**Assessment**
- *Value:* required-field gating on the create form, both directions.
- *Coverage gaps:* password-policy validation (too short / no digit) untested; no assertion of the inline "Full name must be present" message.
- *Redundancy:* setup steps are byte-identical to USRF-14; same validator as USRF-08.
- *Efficiency / smells:* fixed email `qa-test-validation@fleetdm.com` is un-stamped — harmless while the form is never submitted, but it sits outside `QA_TEST_EMAIL_RE` (no `-<digits>-` segment) so it would not be swept if it ever were created.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRF-14 · Create-user form validation › Regular user › clearing Email disables Add

- **File:** [`playwright/tests/e2e/free/settings/users/form-validation.spec.ts`](../../tests/e2e/free/settings/users/form-validation.spec.ts)
- **Grep:** `npx playwright test -g "clearing Email disables Add"`
- **Project:** free · **Premium twin:** same title in `premium/…/form-validation.spec.ts` (identical)
- **Mode:** UI · **Isolation:** independent
- **Preconditions:** `FLEET_TEST_USER_PASSWORD` set
- **Data created:** none

**Flow**

1. ☐ Open `/settings/users/new/human`; fill name/email/password; **Tab** → ✅ *(UI)* **Add** enabled.
2. ☐ Clear **Email**, press **Tab** → ✅ *(UI)* **Add** disabled.

**Assessment**
- *Value:* email is required.
- *Coverage gaps:* clearing **Password** is not covered (the third required field).
- *Redundancy:* same body as USRF-13 with a different field — an obvious 2-case parameterisation.
- *Efficiency / smells:* full page load + 3 fills to flip one assertion.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRF-15 · Create-user form validation › Regular user › invalid email format surfaces an inline error

- **File:** [`playwright/tests/e2e/free/settings/users/form-validation.spec.ts`](../../tests/e2e/free/settings/users/form-validation.spec.ts)
- **Grep:** `npx playwright test -g "invalid email format surfaces an inline error"`
- **Project:** free · **Premium twin:** same title in `premium/…/form-validation.spec.ts` (identical)
- **Mode:** UI · **Isolation:** independent
- **Preconditions:** none
- **Data created:** none

**Flow**

1. ☐ Open `/settings/users/new/human`; type `not-an-email` into **Email**; press **Tab**.
   - ✅ *(UI)* Text "Email is not a valid email" is visible.

**Assessment**
- *Value:* pins the inline email-format error copy.
- *Coverage gaps:* only one malformed shape; no check that **Add** is disabled while the error shows, and no check the error clears on correction.
- *Redundancy:* none.
- *Efficiency / smells:* `page.getByText` used raw in the spec rather than through a POM locator.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRF-16 · Create-user form validation › API-only user › submitting an empty Name surfaces "Name is required"

- **File:** [`playwright/tests/e2e/free/settings/users/form-validation.spec.ts`](../../tests/e2e/free/settings/users/form-validation.spec.ts)
- **Grep:** `npx playwright test -g "submitting an empty Name surfaces"`
- **Project:** free · **Premium twin:** same title in `premium/…/form-validation.spec.ts` (identical)
- **Mode:** UI · **Isolation:** independent
- **Preconditions:** none
- **Data created:** none (submit is rejected)

**Flow**

1. ☐ Open `/settings/users/new/api` via URL; click **Add** with **Name** empty.
   - ✅ *(UI)* Text "Name is required" is visible.

**Assessment**
- *Value:* API-user form validates on submit rather than silently creating a nameless user.
- *Coverage gaps:* doesn't assert the URL stayed on `/settings/users/new/api` (the premium fleets-validation test does assert its equivalent), nor that no user was created.
- *Redundancy:* none.
- *Efficiency / smells:* none.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRF-17 · Users page navigation and layout › user menu → Users renders the list and page chrome

- **File:** [`playwright/tests/e2e/free/settings/users/navigation-and-layout.spec.ts`](../../tests/e2e/free/settings/users/navigation-and-layout.spec.ts)
- **Grep:** `npx playwright test -g "user menu → Users renders the list and page chrome"`
- **Project:** free · **Premium twin:** same title in `premium/…/navigation-and-layout.spec.ts` (identical)
- **Mode:** UI · **Isolation:** independent
- **Preconditions:** admin session; ≥1 user
- **Data created:** none

**Flow**

1. ☐ Open `/dashboard` (✅ *(UI)* first card visible).
2. ☐ Click the avatar/user-menu trigger → click the **Users** menu item.
   - ✅ *(UI)* URL is `/settings/users`.
   - ✅ *(UI)* **Add user** button visible; **Search by name or email** visible; first table row visible.

**Assessment**
- *Value:* the only test of the navbar → Users entry point (every other test navigates by URL).
- *Coverage gaps:* column headers not asserted; no check the page is reachable via **Settings** → **Users** breadcrumb/side nav.
- *Redundancy:* the three chrome assertions are implicitly re-covered by `usersPage.goto()` everywhere else.
- *Efficiency / smells:* none.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRF-18 · Users page navigation and layout › first-page rows expose name, role, status, and Actions

- **File:** [`playwright/tests/e2e/free/settings/users/navigation-and-layout.spec.ts`](../../tests/e2e/free/settings/users/navigation-and-layout.spec.ts)
- **Grep:** `npx playwright test -g "first-page rows expose name, role, status, and Actions"`
- **Project:** free · **Premium twin:** `premium/…/navigation-and-layout.spec.ts` › `first-page rows expose name, role, fleets, status, and Actions` — **the only difference is the extra `Fleets` cell (`toBeAttached`)**
- **Mode:** UI · **Isolation:** independent, but **reads whatever users happen to be on page 1** — content depends on instance volume and on concurrent specs
- **Preconditions:** ≥1 user on page 1 (static-user catalog guarantees this)
- **Data created:** none

**Flow**

1. ☐ Open `/settings/users` via URL.
2. ☐ Count the `tbody` rows → ✅ *(UI)* count > 0.
3. ☐ For each row on page 1, resolve the **Name**, **Role** and **Status** cells by header position.
   - ✅ *(UI)* Name cell not empty; Role cell not empty; Status cell not empty.
   - ✅ *(UI)* The row's Actions dropdown trigger is visible.

**Assessment**
- *Value:* catches a column being dropped/renamed or a cell rendering blank for some role shape.
- *Coverage gaps:* asserts only non-emptiness — a wrong value passes; **Email** column not checked at all; no assertion that free does *not* render a **Fleets** column (the actual tier difference); doesn't cover rows beyond page 1.
- *Redundancy:* premium twin is the same test plus one cell.
- *Efficiency / smells:* `cellByColumn` re-scans all `<th>` elements per cell → 3 scans × up to 10 rows = ~30 header reads per run ([`pages/components/DataTable.ts:76`](../../pages/components/DataTable.ts)); the row set is captured by count first and re-resolved per index, so a concurrent spec creating/deleting users (notably USRF-27's 20 bulk users) can shift page 1 mid-loop and produce a spurious empty-cell failure.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRF-19 · Users page navigation and layout › Add user dropdown exposes Regular user and API-only user options

- **File:** [`playwright/tests/e2e/free/settings/users/navigation-and-layout.spec.ts`](../../tests/e2e/free/settings/users/navigation-and-layout.spec.ts)
- **Grep:** `npx playwright test -g "Add user dropdown exposes Regular user and API-only user options"`
- **Project:** free · **Premium twin:** same title in `premium/…/navigation-and-layout.spec.ts` (identical)
- **Mode:** UI · **Isolation:** independent
- **Preconditions:** none
- **Data created:** none

**Flow**

1. ☐ Open `/settings/users`; click **Add user**.
   - ✅ *(UI)* Option **Regular user** visible; option **API-only user** visible.
2. ☐ Press **Escape** (closes the dropdown; no assertion that it closed).

**Assessment**
- *Value:* dropdown renders both entry points.
- *Coverage gaps:* no assertion that Escape/outside-click actually dismisses the menu; option count not pinned (an extra option would pass).
- *Redundancy:* USRF-01 and USRF-05 each click through one of these options already.
- *Efficiency / smells:* trailing `Escape` is an un-asserted action — either assert dismissal or drop it.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRF-20 · Users page navigation and layout › current admin cannot delete themselves

- **File:** [`playwright/tests/e2e/free/settings/users/navigation-and-layout.spec.ts`](../../tests/e2e/free/settings/users/navigation-and-layout.spec.ts)
- **Grep:** `npx playwright test -g "current admin cannot delete themselves"`
- **Project:** free · **Premium twin:** same title in `premium/…/navigation-and-layout.spec.ts` (identical)
- **Mode:** UI · **Isolation:** independent
- **Preconditions:** `FLEET_ADMIN_EMAIL` set (asserted non-empty) and matching the logged-in session user
- **Data created:** none

**Flow**

1. ☐ Open `/settings/users`; search `FLEET_ADMIN_EMAIL`.
   - ✅ *(UI)* The admin's own row is visible.
2. ☐ Open that row's **Actions** dropdown.
   - ✅ *(UI)* **Delete** option is visible **and** carries `aria-disabled="true"`.

**Assessment**
- *Value:* the only self-protection / permission-gating check in the area.
- *Coverage gaps:* doesn't verify clicking the disabled option is a no-op; **Require password reset** / **Reset sessions** gating on self not checked; no coverage of what non-admin roles see in the Actions menu (free Observer/Maintainer shouldn't reach this page at all).
- *Redundancy:* duplicated verbatim on premium.
- *Efficiency / smells:* silently passes if `FLEET_ADMIN_EMAIL` names a *different* admin than the session user — the assertion would then be about someone else's row and would fail loudly, but the test never confirms "self" via `/me`.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRF-21 · Users search › search by name narrows the table to the matching user

- **File:** [`playwright/tests/e2e/shared/settings/users/search.spec.ts`](../../tests/e2e/shared/settings/users/search.spec.ts)
- **Grep:** `npx playwright test -g "search by name narrows the table to the matching user"`
- **Projects:** free **and** premium (shared tree) · **Premium twin:** none — this *is* the shared spec
- **Mode:** UI · **Isolation:** serial describe, step 1 of 3; shares two `beforeAll` users with USRF-22/23
- **Preconditions:** `beforeAll` API-creates `QA Search Alpha <stamp>` (observer) and `QA Search Beta <stamp>` (maintainer) with `qa-test-<stamp>-search{alpha,beta}@fleetdm.com` — ✅ *(API)* both POSTs asserted OK
- **Data created:** those two users — deleted in `afterAll` (not in-test)

**Flow**

1. ☐ Open `/settings/users`; type `QA Search Alpha <stamp>` into **Search by name or email**.
   - ✅ *(UI)* The Alpha row is visible.
   - ✅ *(UI)* No row containing the Beta name exists (`toHaveCount(0)`).

**Assessment**
- *Value:* name search returns the match.
- *Coverage gaps:* partial-token and case-insensitive search untested; no-results empty state untested; result count not pinned (unlike USRF-23, which does assert exactly 1 row).
- *Redundancy:* every other spec in this area already exercises search implicitly through `findRowByEmail`/`findRowByName`; USRF-22 is the same test on the email field.
- *Efficiency / smells:* the negative assert is close to vacuous — Beta may not have been on page 1 before the filter, so `toHaveCount(0)` can pass without the filter doing anything (the spec's own comment at [`search.spec.ts:59-63`](../../tests/e2e/shared/settings/users/search.spec.ts) acknowledges this for the third test but not here). Not volume-fragile: both anchors are `<stamp>`-unique.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRF-22 · Users search › search by email narrows the table to the matching user

- **File:** [`playwright/tests/e2e/shared/settings/users/search.spec.ts`](../../tests/e2e/shared/settings/users/search.spec.ts)
- **Grep:** `npx playwright test -g "search by email narrows the table to the matching user"`
- **Projects:** free and premium · **Mode:** UI · **Isolation:** serial describe, step 2 of 3
- **Preconditions:** the two `beforeAll` search users
- **Data created:** none

**Flow**

1. ☐ Open `/settings/users`; type the Beta email into the search box.
   - ✅ *(UI)* Row whose `.email__cell` exactly equals the Beta email is visible.
   - ✅ *(UI)* No row containing the Alpha email exists.

**Assessment**
- *Value:* search matches on the email field, not just name.
- *Coverage gaps:* same as USRF-21 (no partial/no-results/count checks).
- *Redundancy:* structurally identical to USRF-21 — one parameterised test over `{name, email}` would cover both.
- *Efficiency / smells:* same near-vacuous negative assertion; extra page load per case.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRF-23 · Users search › clearing the search restores the unfiltered list

- **File:** [`playwright/tests/e2e/shared/settings/users/search.spec.ts`](../../tests/e2e/shared/settings/users/search.spec.ts)
- **Grep:** `npx playwright test -g "clearing the search restores the unfiltered list"`
- **Projects:** free and premium · **Mode:** UI · **Isolation:** serial describe, step 3 of 3
- **Preconditions:** the two `beforeAll` search users **and ≥2 users total on the instance** for the post-clear assertion
- **Data created:** none

**Flow**

1. ☐ Open `/settings/users`; search `QA Search Alpha <stamp>`.
   - ✅ *(UI)* The table holds exactly 1 `tbody` row (the reliable "filter settled" signal).
   - ✅ *(UI)* That row is the Alpha row.
2. ☐ Clear the search box.
   - ✅ *(UI)* Row count polls to > 1.

**Assessment**
- *Value:* the filter is actually lifted on clear — the only test here that proves the filter did something.
- *Coverage gaps:* doesn't check the row count returns to the page size (10) or that pagination controls reappear.
- *Redundancy:* overlaps USRF-21's positive half.
- *Efficiency / smells:* **volume-dependent** — `> 1` row after clearing relies on pre-existing users (admin + the static-user catalog + its own 2), so it is the one test here that would fail on a bare instance; it is not order-fragile, since more users only help.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRF-24 · User row actions › Require password reset opens the confirmation modal and confirms

- **File:** [`playwright/tests/e2e/shared/settings/users/row-actions.spec.ts`](../../tests/e2e/shared/settings/users/row-actions.spec.ts)
- **Grep:** `npx playwright test -g "Require password reset opens the confirmation modal and confirms"`
- **Projects:** free and premium · **Mode:** UI · **Isolation:** serial describe, step 1 of 2 (shares the `beforeAll` user with USRF-25)
- **Preconditions:** `beforeAll` API-creates `QA Row Actions` / `qa-test-<stamp>-rowactions@fleetdm.com` (observer, no forced reset)
- **Data created:** that user — deleted in `afterAll` (not in-test)

**Flow**

1. ☐ Open `/settings/users`; search the email; open the row's **Actions** → **Require password reset**.
   - ✅ *(UI)* Modal visible and contains "reset their password".
2. ☐ Click **Confirm**.
   - ✅ *(UI)* Modal hidden; success toast `"Successfully required a password reset."`.

**Assessment**
- *Value:* the modal + endpoint wiring for the password-reset action.
- *Coverage gaps:* no verification the flag actually took effect — neither `GET /users/:id` (`force_password_reset`) nor a login attempt that lands on the reset screen; **Cancel** path untested; the row's **Status** cell change (if any) unasserted.
- *Redundancy:* same shape as USRF-25.
- *Efficiency / smells:* toast-only validation of a security-relevant action — the weakest assertion/impact ratio in the area.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRF-25 · User row actions › Reset sessions opens the confirmation modal and confirms

- **File:** [`playwright/tests/e2e/shared/settings/users/row-actions.spec.ts`](../../tests/e2e/shared/settings/users/row-actions.spec.ts)
- **Grep:** `npx playwright test -g "Reset sessions opens the confirmation modal and confirms"`
- **Projects:** free and premium · **Mode:** UI · **Isolation:** serial describe, step 2 of 2
- **Preconditions:** the `beforeAll` row-actions user
- **Data created:** none

**Flow**

1. ☐ Open `/settings/users`; search the email; **Actions** → **Reset sessions**.
   - ✅ *(UI)* Modal visible and contains "logged out of Fleet".
2. ☐ Click **Confirm**.
   - ✅ *(UI)* Modal hidden; success toast `"Successfully reset sessions."`.

**Assessment**
- *Value:* modal copy + wiring.
- *Coverage gaps:* effect not verified here (USRF-26 does that).
- *Redundancy:* **wholly contained in USRF-26**, which performs the same UI flow and then proves the token died — this test is deletable.
- *Efficiency / smells:* toast-only validation; duplicate page load and search.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRF-26 · Reset sessions invalidates the user token › resetting the user's sessions invalidates their existing token

- **File:** [`playwright/tests/e2e/shared/settings/users/row-actions.spec.ts`](../../tests/e2e/shared/settings/users/row-actions.spec.ts)
- **Grep:** `npx playwright test -g "resetting the user's sessions invalidates their existing token"`
- **Projects:** free and premium · **Mode:** UI+API · **Isolation:** own describe (not serial), independent
- **Preconditions:** `beforeAll` API-creates `QA Reset Sessions` / `qa-test-<ts>-resetsess@fleetdm.com` (observer, `admin_forced_password_reset: false` so the password is usable); `FLEET_TEST_USER_PASSWORD` set
- **Data created:** that user — deleted in `afterAll` (not in-test)

**Flow**

1. ☐ *(API)* In a **cookie-less** request context, `POST /login` as the test user with the QA password.
   - ✅ *(API)* Login succeeds and returns a token.
   - ✅ *(API)* `GET /me` with `Authorization: Bearer <token>` is OK.
2. ☐ Open `/settings/users`; search the email; **Actions** → **Reset sessions**.
   - ✅ *(UI)* Modal visible.
3. ☐ Click **Confirm**.
   - ✅ *(UI)* Success toast `"Successfully reset sessions."`.
   - ✅ *(API)* `GET /me` with the old token polls to HTTP **401**.

**Assessment**
- *Value:* the strongest test in the area — proves the UI action has real security effect, and the cookie-less context is exactly the right call (the browser context's admin cookie would mask the 401).
- *Coverage gaps:* doesn't check the *admin's own* session survives; no coverage of the reset-sessions effect on a browser session (user gets bounced to login).
- *Redundancy:* supersedes USRF-25 entirely.
- *Efficiency / smells:* also acts as the only test that a UI-configured password actually authenticates — worth noting when trimming; `Date.now()` is evaluated at module scope for the email, fine.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### USRF-27 · Users pagination › Next pagination control becomes enabled and advances the table

- **File:** [`playwright/tests/e2e/shared/settings/users/pagination.spec.ts`](../../tests/e2e/shared/settings/users/pagination.spec.ts)
- **Grep:** `npx playwright test -g "Next pagination control becomes enabled and advances the table"`
- **Projects:** free and premium · **Mode:** UI · **Isolation:** serial describe with a single test; **creates 20 users in `beforeAll`**
- **Preconditions:** `beforeAll` API-creates 20 users `QA Pagination 00…19` / `qa-test-<stamp>-pag<NN>@fleetdm.com` (observer) in parallel (`Promise.all`) — ✅ *(API)* each POST asserted OK
- **Data created:** 20 users — deleted sequentially in `afterAll`, **not** in-test

**Flow**

1. ☐ Open `/settings/users` via URL (page size 10).
   - ✅ *(UI)* **Next** button is enabled (i.e. > 10 users exist).
2. ☐ Capture the first row's full text, click **Next**.
   - ✅ *(UI)* The first row's text polls to something different — page 2 rendered fresh rows.

**Assessment**
- *Value:* pagination advances the user table; the enabled-state check doubles as a "more than one page exists" signal.
- *Coverage gaps:* **Previous** never exercised (nor that it returns to the original first row); no check that page 2 holds ≤10 distinct rows or that Next disables on the last page; no interaction between search + pagination.
- *Redundancy:* none within the area.
- *Efficiency / smells:* the 20-user bulk create is the area's main **cross-spec interference source** — for the life of this spec the first pages of the users table are crowded, which is precisely why every other spec must search-then-act, and it can shift page 1 under USRF-18's row loop. Volume-wise the test is self-sufficient (it doesn't rely on pre-existing users), but 20 users is far more than the 11 needed to enable **Next**; the parallel `Promise.all` create + serial delete also puts 40 API calls around a two-assertion test.

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
| Navbar → Users, page chrome | USRF-17 | Settings side-nav / breadcrumb entry point |
| User table columns | USRF-18 | Only non-emptiness; **Email** column unchecked; free's *absence* of a Fleets column unasserted; sorting untested |
| Create human user (role matrix) | USRF-06 (3 roles) | Free role-list gating (Observer+/Technician/GitOps must be absent); duplicate-email rejection; created user never logs in; Status cell |
| Create API-only user | USRF-01/02/03 | Generated token never used against the API; free's absent Permissions / API-access radios unasserted |
| Create-form validation | USRF-13/14/15/16 | Password-policy errors; clearing Password; error-clears-on-fix |
| Edit user | USRF-08/09 | Email change (+ its toast variant), password change, SSO/MFA toggles, Cancel/Back |
| Delete user | USRF-11, USRF-20 (self-delete blocked) | API confirmation of deletion; modal Cancel; deleting an API-only user |
| Require password reset | USRF-24 | Effect unverified (flag / login redirect) |
| Reset sessions | USRF-25, USRF-26 | Admin's own session unaffected; browser-session bounce |
| Search | USRF-21/22/23 | Partial/case-insensitive match; no-results empty state; search + pagination |
| Pagination | USRF-27 | Previous, last-page disabling, per-page control |
| Activity feed for user CRUD | USRF-04/07/10/12 | Actor never asserted |
| Free-tier gating overall | — | **No test asserts anything is hidden on free** — every free spec only exercises the reduced surface, so a regression that leaked premium controls (fleets radio, Observer+ role) onto free would pass |
| Non-admin access to Settings › Users | — | Untested (Observer/Maintainer should not reach the page) |

**Duplication**

1. **Free ≈ premium, wholesale.** `delete.spec.ts` is identical apart from a comment; `edit.spec.ts` (first describe), `form-validation.spec.ts` (3 of 4 tests) and `navigation-and-layout.spec.ts` (3 of 4 tests, the 4th differing by one cell) are identical bodies. `regular-user-create` / `api-user-create` differ only in the role list, the `useGlobalUser()` click, and premium's `'Global'` / fleet-assignment extras. Roughly **17 of the 20 free declarations are near-copies of USRP entries**.
2. **Activity-feed quartet** — USRF-04/07/10/12 share one body shape (goto dashboard, one regex), each also duplicated on premium: 8 declarations for one contract.
3. **USRF-25 ⊂ USRF-26** — same UI flow, weaker assertion.
4. **USRF-13 ≡ USRF-14** and **USRF-21 ≡ USRF-22** — same body, one field swapped.
5. **Role loops** re-drive the entire create journey per role (3× human, 3× API on free; 5×/6× on premium) where the tier-relevant delta is only which options the dropdown offers.

**UI-vs-API balance**

Balance is good: API is used for *setup* (`createUser`/`createApiUser` in `beforeAll`, per the suite's own convention) and only twice for *validation* — USRF-26's `GET /me` 401 poll (justified and the area's best assertion) and USRF-04's `listUsers` lookup (unavoidable, since Fleet stamps API users' emails server-side). The gap runs the other way: several state-changing flows validate **only** a toast — USRF-24 (password-reset flag), USRF-25 (sessions), USRF-11 (deletion confirmed only against a search-filtered table). Those are the places an API read would add real signal.

**Quick wins**

1. Delete USRF-25 — fully subsumed by USRF-26 ([`shared/settings/users/row-actions.spec.ts:43-54`](../../tests/e2e/shared/settings/users/row-actions.spec.ts)).
2. Add an API check to USRF-24 (`GET /users/:id` → `force_password_reset === true`) and to USRF-11 (`GET /users/:id` → 404).
3. Make API-user cleanup unconditional and sweepable: `createApiUserPage` users are tracked only `if (id !== null)` ([`api-user-create.spec.ts:80`](../../tests/e2e/free/settings/users/api-user-create.spec.ts)) and their server-stamped emails fall outside `QA_TEST_EMAIL_RE`, so `deleteAllQaTestUsers` can never reclaim leaks — extend the cleanup to `api_only` users whose name starts with `QA API`.
4. Drop USRF-27's bulk from 20 to 11 users and add a **Previous** hop — same coverage, half the interference with USRF-18's page-1 row loop ([`shared/settings/users/pagination.spec.ts:4`](../../tests/e2e/shared/settings/users/pagination.spec.ts)).
5. Merge USRF-13/14 (and USRF-21/22) into one parameterised test each; remove the tautological `copyButton` visible-after-click assert in USRF-03.

**Bigger bets**

1. **Collapse the free tree to a tier-delta spec.** Move the shared bodies (delete, edit, form validation, nav/layout, and the common part of the create flows) into `tests/e2e/shared/settings/users/`, driving the role list and the Permissions-radio step from `SUITE`; keep free-only files for what is genuinely different — which, on the evidence, is *the tests that should exist and don't*: "free hides the Permissions radio / the fleets section / the Observer+, Technician and GitOps role options". That converts ~17 duplicate declarations into ~6 shared + 2 real gating tests.
2. **Collapse the role matrices.** One UI create per tier plus API-level role coverage (create via `POST /users/admin` for the remaining roles, assert the rendered row) would cut 4 full UI journeys per tier while *adding* the missing "role X is/isn't offered on this tier" assertion.
3. **One activity-feed test per area, not per CRUD verb.** A single spec that performs create/edit/delete via API and asserts all three matchers in one `expectActivities([…])` walk replaces 8 dashboard loads across the two tiers and removes the serial cross-test dependencies in `api-user-create`, `regular-user-create`, `edit` and `delete`.
