# Labels, packs, dashboard automations, free paywalls — test audit

**Specs covered:** 6 files · **Entries:** 21 · **Test declarations:** 37 (the paywall spec's 17 loop-generated cases are documented as one entry, MISC-20) · **Projects:** premium / free (packs runs in both)

This is the leftovers area: the dedicated **Labels** page (`/labels/manage`, reachable only from the user menu), the deprecated **osquery Packs** feature (`/packs/manage`, no nav entry), the dashboard's **activity-feed automations** modal (the global `activities_webhook`), and the free tier's **paywall-presence** sweep. Labels carry two serial CRUD lifecycles (Dynamic + Manual) plus read-only sort/permission specs; packs is one serial CRUD lifecycle shared by both tiers; the paywall spec is a table-driven loop of direct-URL visits.

## Contents

| ID | Spec | Test | Mode | Manual? |
|---|---|---|---|---|
| MISC-01 | `premium/labels/labels.spec.ts` | Premium • Labels • Dynamic label lifecycle › create | UI | ☐ |
| MISC-02 | `premium/labels/labels.spec.ts` | Premium • Labels • Dynamic label lifecycle › edit | UI | ☐ |
| MISC-03 | `premium/labels/labels.spec.ts` | Premium • Labels • Dynamic label lifecycle › delete | UI | ☐ |
| MISC-04 | `premium/labels/labels.spec.ts` | Premium • Labels • Dynamic label lifecycle › activity feed shows create → edit → delete | UI | ☐ |
| MISC-05 | `premium/labels/labels.spec.ts` | Premium • Labels • Manual label lifecycle › create | UI+API | ☐ |
| MISC-06 | `premium/labels/labels.spec.ts` | Premium • Labels • Manual label lifecycle › edit | UI | ☐ |
| MISC-07 | `premium/labels/labels.spec.ts` | Premium • Labels • Manual label lifecycle › delete | UI | ☐ |
| MISC-08 | `premium/labels/labels.spec.ts` | Premium • Labels • Manual label lifecycle › activity feed shows create → edit → delete | UI | ☐ |
| MISC-09 | `premium/labels/sort-view.spec.ts` | the Name column sorts ascending by default and toggles to descending | UI | ☐ |
| MISC-10 | `premium/labels/sort-view.spec.ts` | "View all hosts" lands on the Hosts list filtered by that label | UI | ☐ |
| MISC-11 | `premium/labels/role-access.spec.ts` | global observer cannot add labels and can only view hosts | UI | ☐ |
| MISC-12 | `premium/labels/role-access.spec.ts` | team maintainer can add labels but cannot edit a global label | UI | ☐ |
| MISC-13 | `premium/labels/role-access.spec.ts` | team admin can add labels but cannot edit a global label | UI | ☐ |
| MISC-14 | `shared/packs/packs.spec.ts` | Packs CRUD › create | UI+API | ☐ |
| MISC-15 | `shared/packs/packs.spec.ts` | Packs CRUD › edit | UI+API | ☐ |
| MISC-16 | `shared/packs/packs.spec.ts` | Packs CRUD › delete | UI+API | ☐ |
| MISC-17 | `shared/packs/packs.spec.ts` | Packs CRUD › activity feed shows create → edit → delete | UI | ☐ |
| MISC-18 | `shared/packs/packs.spec.ts` | Packs CRUD › pack query executes on targeted host — **skipped** | API | ☐ |
| MISC-19 | `premium/dashboard/automations-activity.spec.ts` | enabling, editing, and disabling each land in the activity feed | UI+API | ☐ |
| MISC-20 | `free/paywalls.spec.ts` | Free • paywall presence › ×17 URL cases (one `test()` per row) | UI | ☐ |
| MISC-21 | `free/paywalls.spec.ts` | Settings — no Teams nav link | UI | ☐ |

`Mode`: **UI** (all validation through the browser), **UI+API** (browser flow, some assertions via API), **API** (no meaningful UI validation), **PERF** (timing).

---

### MISC-01 · Premium • Labels • Dynamic label lifecycle › create

- **File:** [`playwright/tests/e2e/premium/labels/labels.spec.ts`](../../tests/e2e/premium/labels/labels.spec.ts)
- **Grep:** `npx playwright test -g "Premium • Labels • Dynamic label lifecycle › create"`
- **Project:** premium · **Scopes:** none — labels are created globally (no team dropdown)
- **Mode:** UI · **Isolation:** serial describe, step 1 of 4 (shares `name` / `editedName` closure vars with edit/delete/activity)
- **Preconditions:** `beforeAll` opens a cookie-less API context (`baseURL` from `FLEET_URL`) and calls `deleteLabelsMatching(ctx, 'pw-label-dyn')` — `GET /labels?per_page=500`, then `DELETE /labels/id/:id` for every non-builtin label whose name contains the marker. Fleet's cleanup projects do **not** wipe labels, so this is the spec's own self-heal. Instance carries ~27 gitops labels; list is client-side-paginated at 20/page, sorted by name.
- **Data created:** label `pw-label-dyn-<timestamp>` — renamed by MISC-02, removed by MISC-03

**Flow**

1. ☐ Open `/labels/manage` **via URL** (`LabelsPage.goto`).
   - ✅ *(UI)* `Labels` `<h1>` heading is visible.
2. ☐ Click **Add label**.
   - ✅ *(UI)* URL is `/labels/new`; the **Name** textbox is visible (`clickAddLabel`).
3. ☐ Click the **Dynamic** radio's `<label>` (the real `<input type=radio>` is `display:none`).
   - ✅ *(UI)* The `Dynamic` radio is checked (`selectType`).
4. ☐ Fill **Name** = `pw-label-dyn-<ts>`, **Description** = `Playwright dynamic label`. The SQL query editor and the **Platform** dropdown are left untouched.
5. ☐ Click **Save**.
   - ✅ *(UI)* Success toast `Label added successfully.` (`Toast.expectSuccess` — matches a `role="alert"` card carrying `.toast-notification__card--success`).
   - ✅ *(UI)* URL is back on `/labels/manage`.
6. ☐ Re-open `/labels/manage`, then page forward with **Next** until the new label's row appears (`locateRow` → `Pagination.nextIfEnabled`, which waits for the first row's primary link text to change).
   - ✅ *(UI)* Row for the label is visible.
   - ✅ *(UI)* Row text contains the description.
   - ✅ *(UI)* Row text contains `Dynamic` (the Type column).

**Assessment**
- *Value:* catches a regression in the whole add-label form → list round-trip: form submit, toast, redirect, and the row's name/description/type rendering.
- *Coverage gaps:* the Dynamic label's **SQL query** is never entered or asserted — the label is saved with whatever the editor defaults to, so query persistence, SQL validation, and platform selection are untested (`LabelsPage.queryEditorContent` and `selectPlatform()` are dead code, [`LabelsPage.ts:56`](../../pages/labels/LabelsPage.ts) / [`:98`](../../pages/labels/LabelsPage.ts)). ⚠️ unclear from source whether Fleet pre-fills a default query for Dynamic labels or accepts an empty one. Also untested: duplicate-name rejection, name-length validation, Cancel, and that the dynamic label actually resolves any hosts.
- *Redundancy:* structurally identical to MISC-05 (Manual lifecycle) — the two differ only in the radio choice and the host-picker step.
- *Efficiency / smells:* `goto()` is a direct URL — Labels has no top-nav entry, only a user-menu item (`Navbar.labelsItem`, [`Navbar.ts:39`](../../pages/components/Navbar.ts)), and **no spec ever clicks it**, so the menu entry itself is uncovered. Step 6 re-navigates rather than relying on the post-save list render (defensible: the save redirect may land on page 1 while the row is on page 2).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-02 · Premium • Labels • Dynamic label lifecycle › edit

- **File:** [`playwright/tests/e2e/premium/labels/labels.spec.ts`](../../tests/e2e/premium/labels/labels.spec.ts)
- **Grep:** `npx playwright test -g "Premium • Labels • Dynamic label lifecycle › edit"`
- **Project:** premium · **Mode:** UI · **Isolation:** serial step 2 of 4 (depends on MISC-01)
- **Preconditions:** the label from MISC-01 exists
- **Data created:** renames the label to `<name>-edited`

**Flow**

1. ☐ Open `/labels/manage` via URL.
2. ☐ Page to the label's row, hover it, click the row **Actions** dropdown (`.actions-dropdown-select__control`), pick **Edit** (option matched by `.actions-dropdown-select__option` + text — the menu portals to `<body>` and carries no test id).
   - ✅ *(UI)* URL matches `/labels/<id>`.
   - ✅ *(UI)* **Name** field pre-populated with the original name.
   - ✅ *(UI)* **Description** field pre-populated with the original description.
3. ☐ Overwrite **Name** → `<name>-edited`, **Description** → `… (edited)`; click **Save**.
   - ✅ *(UI)* Success toast `Label updated successfully.`
4. ☐ Re-open `/labels/manage` and page to the renamed row.
   - ✅ *(UI)* Row for the edited name is visible and contains the edited description.

**Assessment**
- *Value:* the strongest assertion in the file — the edit form is verified to *load* existing values (name + description), not just accept new ones.
- *Coverage gaps:* the label's type and query are not re-asserted after edit; whether a Dynamic label can be converted to Manual (or vice versa) is untested; the edit form's platform field is never read back.
- *Redundancy:* mirrored 1:1 by MISC-06.
- *Efficiency / smells:* none material. The pre-populated-value assertions are exactly what similar CRUD specs in the suite usually omit — worth copying elsewhere.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-03 · Premium • Labels • Dynamic label lifecycle › delete

- **File:** [`playwright/tests/e2e/premium/labels/labels.spec.ts`](../../tests/e2e/premium/labels/labels.spec.ts)
- **Grep:** `npx playwright test -g "Premium • Labels • Dynamic label lifecycle › delete"`
- **Project:** premium · **Mode:** UI · **Isolation:** serial step 3 of 4 · this is the lifecycle's cleanup
- **Preconditions:** renamed label from MISC-02 exists

**Flow**

1. ☐ Open `/labels/manage` via URL; page to the renamed row; open its **Actions** dropdown; pick **Delete**.
   - ✅ *(UI)* The `Delete label` modal is visible (`.modal__modal_container` filtered by title text — Fleet's Modal renders a role-less title).
2. ☐ Click **Delete** inside the modal.
   - ✅ *(UI)* Success toast `Successfully deleted <editedName>.`
3. ☐ Re-open `/labels/manage`.
   - ✅ *(UI)* No row matching the edited name — `rowFor(name)` has count 0.

**Assessment**
- *Value:* confirms the delete confirmation modal wires to a real delete and the toast names the label.
- *Coverage gaps:* the modal's **Cancel** path is untested; label deletion's side effects (hosts losing the label, software/profile targeting that referenced it) are untested.
- *Redundancy:* mirrored by MISC-07.
- *Efficiency / smells:* **false-pass risk** — the final assertion uses `rowFor()` ([`labels.spec.ts:91`](../../tests/e2e/premium/labels/labels.spec.ts)), which only looks at **page 1**, while create/edit deliberately use the paging `locateRow()`. With ~27 gitops labels the `pw-label-…` name can sit on page 2, so a delete that silently failed would still pass. Use `locateRow` (assert the returned locator has count 0) or a `GET /labels` check.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-04 · Premium • Labels • Dynamic label lifecycle › activity feed shows create → edit → delete

- **File:** [`playwright/tests/e2e/premium/labels/labels.spec.ts`](../../tests/e2e/premium/labels/labels.spec.ts)
- **Grep:** `npx playwright test -g "Premium • Labels • Dynamic label lifecycle › activity feed shows create → edit → delete"`
- **Project:** premium · **Mode:** UI · **Isolation:** serial step 4 of 4 (needs MISC-01…03 to have run)

**Flow**

1. ☐ Open `/dashboard` via URL.
   - ✅ *(UI)* At least one dashboard card is visible (`DashboardPage.goto` anchors on `data-testid="card"`).
2. ☐ Read the **Activity** feed card, clicking **Next** to page back through it.
   - ✅ *(UI)* A feed row matches `created a label <name>.`
   - ✅ *(UI)* A feed row matches `edited the label <editedName>.`
   - ✅ *(UI)* A feed row matches `deleted the label <editedName>.`
   - Mechanics: `expectActivities` walks up to 15 feed pages, and if a matcher is still missing reloads the dashboard and re-walks up to 10 times (activity writes are async). Matchers come from [`activityCopy.label`](../../helpers/activity-copy.ts) with source citations into Fleet's `GlobalActivityItem.tsx`; [`tests/api/activity-copy.spec.ts`](../../tests/api/activity-copy.spec.ts) is the unit gate that keeps the regexes honest.

**Assessment**
- *Value:* the label activity copy is the only place the create/edit/delete verbs and the article switch ("a label" → "the label") are verified against a real feed.
- *Coverage gaps:* no assertion on the actor name, timestamp, or that the row is clickable/expandable; the team-scoped label suffix (`on the <fleet> fleet`) is never produced because labels are always created globally here.
- *Redundancy:* the *feed-reading machinery* is exercised by every CRUD lifecycle in the suite (MISC-08, MISC-17, MISC-19, plus policies/reports/scripts/software). The label-specific matchers are unique.
- *Efficiency / smells:* worst-case cost is high (10 reloads × 15 pages) though the happy path is one walk. Merging MISC-04 into the end of MISC-03 would save one test's fixture + dashboard load; the suite convention deliberately keeps it separate for failure attribution.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-05 · Premium • Labels • Manual label lifecycle › create

- **File:** [`playwright/tests/e2e/premium/labels/labels.spec.ts`](../../tests/e2e/premium/labels/labels.spec.ts)
- **Grep:** `npx playwright test -g "Premium • Labels • Manual label lifecycle › create"`
- **Project:** premium · **Mode:** UI+API (API used for the host precondition only) · **Isolation:** serial step 1 of 4 in the second describe
- **Preconditions:** `beforeAll` purges `pw-label-man*` labels via the API (same helper as MISC-01). `firstHostDisplayName(request)` → `GET /hosts?per_page=1` supplies a host display name; `test.skip(!hostName)` if the instance has none. `pageHealth.disable()` — typing in the host picker makes Fleet log a benign 4xx (`Invalid usage: missing required parameter(s)`) to the console.
- **Data created:** label `pw-label-man-<timestamp>` with one host member

**Flow**

1. ☐ *(API precondition)* Fetch the first host's display name.
2. ☐ Open `/labels/manage` via URL → click **Add label** → URL `/labels/new`.
3. ☐ Click the **Manual** radio label.
   - ✅ *(UI)* The `Manual` radio is checked.
4. ☐ Fill **Name** / **Description**.
5. ☐ Type the host's display name into the host **search box**, then click the first result.
   - ✅ *(UI)* First search result (`.display_name__cell`) is visible (`addHost`).
   - ✅ *(UI)* The clicked host now appears in the **selected-hosts** table (`.targets-input__hosts-selected-table`) — guards against saving a manual label with zero hosts, which the server rejects with a 422.
6. ☐ Click **Save**.
   - ✅ *(UI)* Success toast `Label added successfully.`
   - ✅ *(UI)* URL back on `/labels/manage`.
7. ☐ Re-open the list, page to the row.
   - ✅ *(UI)* Row visible, contains the description, contains `Manual`.

**Assessment**
- *Value:* the only coverage of the manual-label host picker (search → select → selected table), which is a distinct Fleet component (`TargetsInput`) from the dynamic form.
- *Coverage gaps:* **membership is never verified after save** — nothing asserts the label has 1 host (no Hosts-count column read, no "View all hosts" follow-through, no `GET /labels/:id/hosts`). ⚠️ unclear whether the labels table even has a host-count column. Also untested: removing a host from a manual label, adding several hosts, and the empty-selection 422 path the POM comment describes.
- *Redundancy:* steps 2, 4, 6, 7 duplicate MISC-01 exactly.
- *Efficiency / smells:* `addHost()` **returns** the selected host name and the spec discards it ([`labels.spec.ts:135`](../../tests/e2e/premium/labels/labels.spec.ts)) — if the picker selected a *different* host than the one searched for, the test still passes. `pageHealth.disable()` is whole-test, so genuine console errors and 5xx are also suppressed for this test; the underlying Fleet console 4xx has no filed issue. `.display_name__cell` / `.targets-input__*` are raw class locators (documented in the POM, acceptable) but `.first()` on the search results is a tolerated shortcut.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-06 · Premium • Labels • Manual label lifecycle › edit

- **File:** [`playwright/tests/e2e/premium/labels/labels.spec.ts`](../../tests/e2e/premium/labels/labels.spec.ts)
- **Grep:** `npx playwright test -g "Premium • Labels • Manual label lifecycle › edit"`
- **Project:** premium · **Mode:** UI · **Isolation:** serial step 2 of 4

**Flow** — byte-for-byte the same as MISC-02, against the manual label.

1. ☐ Open `/labels/manage`; row **Actions** → **Edit**.
   - ✅ *(UI)* URL `/labels/<id>`; **Name** and **Description** pre-populated with the created values.
2. ☐ Overwrite both; click **Save**.
   - ✅ *(UI)* Toast `Label updated successfully.`
3. ☐ Re-open the list, page to the renamed row.
   - ✅ *(UI)* Row visible with the edited description.

**Assessment**
- *Value:* marginal beyond MISC-02 — the only manual-specific thing an edit could break (the host membership editor pre-loading the existing members) is not asserted.
- *Coverage gaps:* the edit form's selected-hosts table is never checked for the host added in MISC-05; host add/remove on edit untested.
- *Redundancy:* **direct duplicate of MISC-02.** Prime candidate for deletion or for being reduced to "edit form shows the existing host member".
- *Efficiency / smells:* none beyond the duplication.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-07 · Premium • Labels • Manual label lifecycle › delete

- **File:** [`playwright/tests/e2e/premium/labels/labels.spec.ts`](../../tests/e2e/premium/labels/labels.spec.ts)
- **Grep:** `npx playwright test -g "Premium • Labels • Manual label lifecycle › delete"`
- **Project:** premium · **Mode:** UI · **Isolation:** serial step 3 of 4 · lifecycle cleanup

**Flow** — identical to MISC-03.

1. ☐ Row **Actions** → **Delete**.
   - ✅ *(UI)* `Delete label` modal visible.
2. ☐ Confirm **Delete**.
   - ✅ *(UI)* Toast `Successfully deleted <editedName>.`
3. ☐ Re-open the list.
   - ✅ *(UI)* `rowFor(editedName)` count 0.

**Assessment**
- *Value:* duplicate of MISC-03; adds nothing manual-specific.
- *Coverage gaps:* deleting a manual label with members doesn't assert the member host loses the label.
- *Redundancy:* **direct duplicate of MISC-03.**
- *Efficiency / smells:* same page-1-only false-pass as MISC-03 ([`labels.spec.ts:175`](../../tests/e2e/premium/labels/labels.spec.ts)).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-08 · Premium • Labels • Manual label lifecycle › activity feed shows create → edit → delete

- **File:** [`playwright/tests/e2e/premium/labels/labels.spec.ts`](../../tests/e2e/premium/labels/labels.spec.ts)
- **Grep:** `npx playwright test -g "Premium • Labels • Manual label lifecycle › activity feed shows create → edit → delete"`
- **Project:** premium · **Mode:** UI · **Isolation:** serial step 4 of 4

**Flow** — identical to MISC-04, with the manual label's names.

1. ☐ Open `/dashboard`; walk the **Activity** feed.
   - ✅ *(UI)* Rows matching `created a label …`, `edited the label …`, `deleted the label …`.

**Assessment**
- *Value:* none beyond MISC-04 — Fleet's label activity copy carries no manual/dynamic distinction, so the same three regexes are re-verified.
- *Coverage gaps:* n/a.
- *Redundancy:* **fully redundant with MISC-04.** Deleting it removes one dashboard load + up-to-15-page feed walk from every premium run.
- *Efficiency / smells:* worst-case reload budget as MISC-04.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-09 · Premium • Labels • sort + view all hosts › the Name column sorts ascending by default and toggles to descending

- **File:** [`playwright/tests/e2e/premium/labels/sort-view.spec.ts`](../../tests/e2e/premium/labels/sort-view.spec.ts)
- **Grep:** `npx playwright test -g "the Name column sorts ascending by default and toggles to descending"`
- **Project:** premium · **Mode:** UI · **Isolation:** independent, read-only (no mutation)
- **Preconditions:** ≥2 gitops-provisioned custom labels on the instance (asserted, not skipped)

**Flow**

1. ☐ Open `/labels/manage` via URL.
2. ☐ Read every row's **Name** cell on page 1 (`labelNames()` resolves the Name column index from the header via `DataTable.cellByColumn`, then `innerText` per row).
   - ✅ *(UI)* More than one label name was read.
   - ✅ *(UI)* Names are in ascending order — compared with `>` / `<`, i.e. **case-sensitive UTF-16 code-unit order**, matching Fleet's client-side sort (`ARM…` before `Apple…`).
3. ☐ Click the **Name** column header button.
   - ✅ *(UI)* `expect.poll` until the re-read name list is in descending order.

**Assessment**
- *Value:* pins Fleet's default sort (name/asc) and the header-click toggle, including the case-sensitivity quirk that would otherwise look like a bug in the test.
- *Coverage gaps:* only page 1 is checked, so sorting is never verified to be **global** across the paginated set (a client-side sort applied per page would pass); the **Description** and **Type** columns are sortable per `sortByColumn`'s signature but untested; a third click (back to ascending, or to unsorted) is untested; no assertion that a sort indicator/arrow renders.
- *Redundancy:* none in this area. Comparable sort assertions exist for other list pages (software, reports) but not for labels.
- *Efficiency / smells:* `labelNames()` is an N-round-trip loop (`cellByColumn` re-reads the header row for every row — O(rows × columns) `innerText` calls, [`LabelsPage.ts:137`](../../pages/labels/LabelsPage.ts)); called three times here. Resolving the column index once would cut most of it.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-10 · Premium • Labels • sort + view all hosts › "View all hosts" lands on the Hosts list filtered by that label

- **File:** [`playwright/tests/e2e/premium/labels/sort-view.spec.ts`](../../tests/e2e/premium/labels/sort-view.spec.ts)
- **Grep:** `npx playwright test -g "\"View all hosts\" lands on the Hosts list filtered by that label"`
- **Project:** premium · **Mode:** UI · **Isolation:** independent, read-only
- **Preconditions:** ≥1 gitops label

**Flow**

1. ☐ Open `/labels/manage` via URL.
2. ☐ Take the **first** label name on page 1; hover its row; open **Actions**; click **View all hosts**.
   - ✅ *(UI)* The Hosts-list **filter pill** is visible — `role="status"` with accessible name `hosts filtered by …` (`HostsListPage.filterPill`, [`HostsListPage.ts:107`](../../pages/hosts/HostsListPage.ts)).
   - ✅ *(UI)* The pill text contains the label name.

**Assessment**
- *Value:* covers the cross-page navigation contract (labels → hosts?label_id=N) and that the filter is surfaced to the user.
- *Coverage gaps:* the hosts **table** is never inspected — no assertion that rows appear, that the count matches the label's host count, or that the URL carries the label id. A pill rendered with the right name over an unfiltered/empty table passes. Removing the filter (pill ✕) is untested.
- *Redundancy:* the same `filterPill` contract is asserted in [`shared/hosts/host-software.spec.ts:55`](../../tests/e2e/shared/hosts/host-software.spec.ts) and [`premium/software/os.spec.ts:56`](../../tests/e2e/premium/software/os.spec.ts) for software/OS filters — same component, different entry point, so keeping this one is justified.
- *Efficiency / smells:* implicit `[0]` on `labelNames()` picks whatever label sorts first — fine for a read-only check, but the test's outcome depends on gitops content it doesn't control.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-11 · Premium • Labels • role access › global observer cannot add labels and can only view hosts

- **File:** [`playwright/tests/e2e/premium/labels/role-access.spec.ts`](../../tests/e2e/premium/labels/role-access.spec.ts)
- **Grep:** `npx playwright test -g "global observer cannot add labels and can only view hosts"`
- **Project:** premium · **Mode:** UI · **Isolation:** independent; runs in its **own browser context** (not the shared admin state)
- **Preconditions:** static user `global-observer@fleetdm.com` pre-provisioned (never created by the suite) + `FLEET_STATIC_USER_PASSWORD`. `withStaticUser` reuses a cached session from `.auth/static-premium-global-observer.json` when valid, otherwise logs in via the form and caches it — deliberate, because Fleet rate-limits `POST /login` to 10/min in one bucket shared by all users and workers ([`helpers/auth.ts:75`](../../helpers/auth.ts)).
- **Data created:** none (read-only)

**Flow**

1. ☐ Sign in as **QA Static Global Observer** in a clean context; land on `/dashboard` (session-validity probe).
2. ☐ Open `/labels/manage` via URL.
   - ✅ *(UI)* `Labels` heading visible (`goto` anchor).
   - ✅ *(UI)* **Add label** button has count 0.
3. ☐ Take the first label name; hover the row; open its **Actions** dropdown.
   - ✅ *(UI)* **View all hosts** option is visible — this is the non-vacuity guard: it proves the menu actually opened before the negative assertions below.
   - ✅ *(UI)* **Edit** option count 0.
   - ✅ *(UI)* **Delete** option count 0.

**Assessment**
- *Value:* guards Fleet's `canAddLabel` and `hasEditPermission` gates for a read-only role — a regression that let observers mutate labels would be caught.
- *Coverage gaps:* the observer is never made to *attempt* the action (no direct `GET /labels/new` visit to check the route is blocked, no API probe) — only the buttons' absence is checked. `global-observer-plus`, `global-technician`, `ws-observer` and `global-maintainer` are not covered here.
- *Redundancy:* none inside this area; the API-side counterpart lives in `tests/api/role-access/premium/**`, which does not currently probe label endpoints (`grep label tests/api/role-access/premium` → no hits), so this UI spec is the only label permission coverage.
- *Efficiency / smells:* the spec constructs `new LabelsPage(page)` by hand because fixtures bind to the admin `page`. This is the suite-wide idiom (10 specs do it: `free|premium/{account,hosts,software,settings}` + this one), so it isn't an anomaly — but a `staticUserPage`-style fixture returning a role-scoped page would remove ~4 lines of ceremony per test across all of them.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-12 · Premium • Labels • role access › team maintainer can add labels but cannot edit a global label

- **File:** [`playwright/tests/e2e/premium/labels/role-access.spec.ts`](../../tests/e2e/premium/labels/role-access.spec.ts)
- **Grep:** `npx playwright test -g "team maintainer can add labels but cannot edit a global label"`
- **Project:** premium · **Mode:** UI · **Isolation:** own browser context via `withStaticUser('ws-maintainer')`
- **Preconditions:** static user `ws-maintainer@fleetdm.com` (Maintainer on **Workstations** only)

**Flow**

1. ☐ Sign in as **QA Static Workstations Maintainer**; open `/labels/manage` via URL.
   - ✅ *(UI)* **Add label** button **is** visible (`canAddLabel` admits team maintainers).
2. ☐ First label name → hover row → open **Actions**.
   - ✅ *(UI)* **View all hosts** visible (menu-opened guard).
   - ✅ *(UI)* **Edit** count 0 · **Delete** count 0 — `hasEditPermission` omits team roles, so a team maintainer cannot mutate a *global* label.

**Assessment**
- *Value:* covers the asymmetric pair of gates — "may create" but "may not edit someone else's global label". That asymmetry is easy to regress in one direction only.
- *Coverage gaps:* the interesting half is missing — a maintainer creating a label and then checking it *can* edit **its own** label. As written, the "can add" claim stops at button visibility; the add form is never opened or submitted as this role.
- *Redundancy:* the assertion block is identical to MISC-11 apart from the Add-label expectation, and to MISC-13 apart from the role.
- *Efficiency / smells:* three near-identical bodies invite a table-driven loop over `[role, canAdd]` pairs; the suite's house style (per `feedback_review_style`) tolerates the duplication for readability, so this is a judgement call, not a defect.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-13 · Premium • Labels • role access › team admin can add labels but cannot edit a global label

- **File:** [`playwright/tests/e2e/premium/labels/role-access.spec.ts`](../../tests/e2e/premium/labels/role-access.spec.ts)
- **Grep:** `npx playwright test -g "team admin can add labels but cannot edit a global label"`
- **Project:** premium · **Mode:** UI · **Isolation:** own browser context via `withStaticUser('team-admin')`
- **Preconditions:** static user `team-admin@fleetdm.com` (Admin on **Workstations** *and* **VMs**)

**Flow** — same three-step shape as MISC-12.

1. ☐ Sign in as **QA Static Team Admin**; open `/labels/manage`.
   - ✅ *(UI)* **Add label** visible.
2. ☐ Open the first row's **Actions**.
   - ✅ *(UI)* **View all hosts** visible · **Edit** count 0 · **Delete** count 0.

**Assessment**
- *Value:* justified by the spec's own docstring: team admin passes `canAddLabel` through a *different* branch (`isAnyTeamMaintainerOrTeamAdmin`) than the maintainer, so the two can regress independently.
- *Coverage gaps:* same as MISC-12 — no positive "can edit its own label" case, and no check that a global admin *does* see Edit/Delete (that positive control is implied by MISC-02/03 running as admin, but not asserted in this spec).
- *Redundancy:* body identical to MISC-12 except the static-user key.
- *Efficiency / smells:* as MISC-12.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-14 · Packs CRUD › create

- **File:** [`playwright/tests/e2e/shared/packs/packs.spec.ts`](../../tests/e2e/shared/packs/packs.spec.ts)
- **Grep:** `npx playwright test -g "Packs CRUD › create"`
- **Project:** premium **and** free (tier-agnostic, `tests/e2e/shared/`) · **Scopes:** none (packs are global on the Fleet API)
- **Mode:** UI+API · **Isolation:** serial describe, step 1 of 4 (+1 skipped); shares `packName` via closure
- **Preconditions:** `cleanup-setup` wipes packs on `fleet_id=0`; at least one host whose name matches the letter `a`
- **Data created:** pack `Smoke Pack <timestamp>` targeting one host — deleted by MISC-16

**Flow**

1. ☐ Open `/packs/manage` **via URL** (Packs has no top-nav entry — documented inline).
   - ✅ *(UI)* URL matches `/packs`; the `Packs` heading is visible.
2. ☐ Click **Add new pack**.
   - ✅ *(UI)* URL is `/packs/new`.
3. ☐ Fill **Name** and **Description** (`fillBasics`).
4. ☐ Add a host target (`addFirstHostTarget('a')`): click the target-picker placeholder, type `a` into its search input, then click the first host option's **add** (＋) icon button.
   - ✅ *(UI)* The target dropdown menu is visible.
   - ✅ *(UI)* A host option row (`.target-option__wrapper.is-host`) is visible.
   - ✅ *(UI)* The targets summary reads a **non-zero** "N unique host(s)" — the locator regex `[1-9]\d* unique hosts?` only matches after a host is really selected, so it doubles as the selection assertion.
5. ☐ Click **Save query pack**.
   - ✅ *(UI)* URL matches `/packs/<id>`; the **Edit pack** heading is visible (`saveNew`).
   - ✅ *(API)* `GET /activities` contains a `created_pack` entry whose `details.pack_name` equals the pack name **and** whose `actor_email` is `FLEET_ADMIN_EMAIL` (`assertActivity`, pages back 5×100 activities).
6. ☐ Re-open `/packs/manage`.
   - ✅ *(UI)* A row whose name-link matches the pack exactly is visible.
   - ✅ *(UI)* The row's **Hosts** cell (resolved by column header) parses to a number ≥ 1.

**Assessment**
- *Value:* end-to-end coverage of a deprecated-but-still-shipped feature: the create form, the legacy react-select target picker, and the list's host-count column.
- *Coverage gaps:* no query is ever added to the pack (a pack with no scheduled query is inert), so the feature's actual purpose is untested here — MISC-18, the test that would have covered it, is skipped. Also untested: label/team targets (only a host target is used), duplicate names, form validation, **Cancel**.
- *Redundancy:* the `created_pack` API assertion overlaps MISC-17, which asserts the same event's rendered copy in the dashboard feed. One of the two is enough.
- *Efficiency / smells:* the target picker is driven entirely through **react-select v1 library classes** — `.Select-placeholder`, `.Select-input input`, `.Select-menu`, `.target-option__wrapper.is-host`, `.target-option__add-btn` ([`PackEditPage.ts:42-48`](../../pages/packs/PackEditPage.ts), `:75`). The fallback is documented and catalogued as tolerated, but it is the most brittle locator cluster in this area: a react-select version bump or a class rename in Fleet's `target-option` breaks all of MISC-14/15/16 at once, and the widget is unlikely to ever gain a `data-testid` because packs is deprecated. `.first()` on `firstHostOption` is a tolerated shortcut. Searching `'a'` assumes host names contain the letter.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-15 · Packs CRUD › edit

- **File:** [`playwright/tests/e2e/shared/packs/packs.spec.ts`](../../tests/e2e/shared/packs/packs.spec.ts)
- **Grep:** `npx playwright test -g "Packs CRUD › edit"`
- **Project:** premium and free · **Mode:** UI+API · **Isolation:** serial step 2 of 4
- **Preconditions:** pack from MISC-14 exists

**Flow**

1. ☐ Open `/packs/manage`; click the pack's name **link** to open its edit page.
2. ☐ Overwrite **Description**; click **Save**.
   - ✅ *(UI)* Success toast `Successfully updated this pack.` — asserted inside `updateDescription` and load-bearing: it confirms the PATCH landed before the caller navigates away.
3. ☐ Re-open `/packs/manage`, re-open the pack.
   - ✅ *(UI)* The **Description** field holds the updated value (round-trip through a reload).
   - ✅ *(API)* `GET /activities` contains `edited_pack` with `details.pack_name` = the pack name, actor = suite admin.

**Assessment**
- *Value:* real persistence check — the value is re-read after a full navigation, not just after the save.
- *Coverage gaps:* only Description is edited. Renaming a pack, toggling its enabled/disabled state, and editing its **targets** (add/remove hosts, which is where the brittle picker lives) are untested.
- *Redundancy:* the `edited_pack` API assertion is re-asserted as rendered copy in MISC-17.
- *Efficiency / smells:* `PackEditPage.saveButton` is `getByRole('button', { name: /save/i })` ([`PackEditPage.ts:38`](../../pages/packs/PackEditPage.ts)) — a loose regex that would also match **Save query pack**; it happens to be unique on the edit page, so it works, but an exact name would be safer. The double list→pack navigation costs two page loads; re-reading the field after `page.reload()` would be cheaper.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-16 · Packs CRUD › delete

- **File:** [`playwright/tests/e2e/shared/packs/packs.spec.ts`](../../tests/e2e/shared/packs/packs.spec.ts)
- **Grep:** `npx playwright test -g "Packs CRUD › delete"`
- **Project:** premium and free · **Mode:** UI+API · **Isolation:** serial step 3 of 4 · lifecycle cleanup

**Flow**

1. ☐ Open `/packs/manage`; tick the pack row's **checkbox**; click the toolbar **Delete**.
   - ✅ *(UI)* The `Delete pack` modal is visible (`.modal__modal_container` filtered by title text, so the modal's Delete can't be confused with the toolbar's).
2. ☐ Click **Delete** in the modal.
   - ✅ *(UI)* The modal is hidden (`deletePack`).
3. ☐ *(back on the list)*
   - ✅ *(UI)* Text matching the pack name is hidden.
   - ✅ *(API)* `GET /activities` contains `deleted_pack` with the pack name, actor = suite admin.

**Assessment**
- *Value:* covers the bulk-selection delete path (checkbox → toolbar → modal), which is the only way to delete a pack in Fleet's UI.
- *Coverage gaps:* multi-select delete (2+ packs) untested; modal **Cancel** untested; nothing asserts the pack's schedule/stats are cleaned up.
- *Redundancy:* `deleted_pack` re-asserted in MISC-17.
- *Efficiency / smells:* `expect(page.getByText(packName)).toBeHidden()` ([`packs.spec.ts:53`](../../tests/e2e/shared/packs/packs.spec.ts)) is a **weak negative** — `toBeHidden()` passes for a locator that resolves to zero elements, so it can't distinguish "row gone" from "list failed to render at all"; `expect(packsList.packRow(name)).toHaveCount(0)` would be tighter and reuse the POM. Raw `page.getByText` in a spec also bypasses the page object.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-17 · Packs CRUD › activity feed shows create → edit → delete

- **File:** [`playwright/tests/e2e/shared/packs/packs.spec.ts`](../../tests/e2e/shared/packs/packs.spec.ts)
- **Grep:** `npx playwright test -g "Packs CRUD › activity feed shows create → edit → delete"`
- **Project:** premium and free · **Mode:** UI · **Isolation:** serial step 4 of 4

**Flow**

1. ☐ Open `/dashboard` via URL (anchors on the first card).
2. ☐ Walk the **Activity** feed, clicking **Next** and reloading as needed.
   - ✅ *(UI)* Rows matching `created pack <name>.`, `edited pack <name>.`, `deleted pack <name>.` — note packs have **no dedicated Fleet renderer**, so the copy comes from `defaultActivityTemplate` ([`activity-copy.ts:129`](../../helpers/activity-copy.ts)); these regexes are what would catch Fleet gaining (or losing) a pack-specific template.

**Assessment**
- *Value:* the only check that pack activities render at all in the UI; the fall-through template is fragile precisely because nobody owns it.
- *Coverage gaps:* no scope suffix to verify (packs are global); actor/timestamp unchecked.
- *Redundancy:* **all three events are already asserted via the API** in MISC-14/15/16 (`assertActivity`). This test only adds "and the dashboard renders them". Keep this one and drop the three `assertActivity` calls, or vice-versa — running both doubles the activity-log traffic per lifecycle.
- *Efficiency / smells:* same worst-case reload budget as MISC-04.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-18 · Packs CRUD › pack query executes on targeted host — **SKIPPED**

- **File:** [`playwright/tests/e2e/shared/packs/packs.spec.ts`](../../tests/e2e/shared/packs/packs.spec.ts)
- **Grep:** `npx playwright test -g "pack query executes on targeted host"`
- **Project:** premium and free · **Mode:** API (no browser interaction at all) · **Isolation:** inside the serial describe but self-contained
- **Skip reason:** `POST /api/v1/fleet/packs/schedule` returns **405** — the endpoint appears partially deprecated. Tracked in [`TODO.md`](../../TODO.md) ("Find the replacement scheduling endpoint or drop the test"), not in `docs/blocked-by-product-bugs.md`, i.e. classified as deferred debt rather than a filed Fleet defect.
- **Timeout:** 5 minutes (4-minute poll at 15s intervals)

**Flow** *(as written; currently not executed)*

1. ☐ `GET /hosts` → take `hosts[0]`; assert it exists.
2. ☐ `GET /queries` → reuse `queries[0]` **if any exist**, else `POST /queries` with `SELECT 1;`.
3. ☐ `POST /packs` with the pack name, description and `host_ids: [hostID]`; assert OK.
4. ☐ `POST /packs/schedule` with `{pack_id, query_id, interval: 10}`; assert OK. ← the 405
5. ☐ Poll `GET /hosts/:id` every 15s for up to 4 minutes, looking for `pack_stats` entry for this pack with `query_stats[].executions > 0`.
6. ☐ `DELETE /packs/id/:id`.
   - ✅ *(API)* Every request OK.
   - ✅ *(API)* `executed` is truthy — i.e. the host reported at least one execution.

**Assessment**
- *Value:* if unblocked, this would be the only test proving a pack actually *does* anything. As written, it is also the only test in this area that would exercise osquery scheduling.
- *Coverage gaps:* even unblocked it asserts nothing in the UI (the pack page's "Last executed"/stats display), and hosts on the QA instances are **osquery-perf simulations** — ⚠️ unclear whether simulated hosts report `pack_stats` at all, so the test may not be revivable on this infrastructure even after the endpoint question is answered.
- *Redundancy:* none.
- *Efficiency / smells:* branchy setup (`if (queries.length) … else create`) means the test's inputs vary run to run; reuses an arbitrary existing query. Cleanup is a bare `DELETE` with no status assertion and is skipped entirely if an earlier `expect` throws. Given packs is deprecated in Fleet, deleting this test is a defensible alternative to reviving it.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-19 · Premium • Dashboard • activity automations › enabling, editing, and disabling each land in the activity feed

- **File:** [`playwright/tests/e2e/premium/dashboard/automations-activity.spec.ts`](../../tests/e2e/premium/dashboard/automations-activity.spec.ts)
- **Grep:** `npx playwright test -g "enabling, editing, and disabling each land in the activity feed"`
- **Project:** premium · **Scopes:** global config (no team dropdown) · **Mode:** UI+API
- **Isolation:** single test, but it **mutates global app config** — there is one activity webhook per instance, so this test cannot run concurrently with a copy of itself (`--repeat-each` with parallel workers will fail it). Sibling appConfig specs are safe because each restores only its own subtree.
- **Preconditions:** none beyond admin. `GET /config` snapshots `webhook_settings.activities_webhook` first; a `finally` block PATCHes it back (falling back to `enabled: false`, `url: ''` if it was unset).
- **Data created:** app-config change only, restored

**Flow**

1. ☐ *(API)* `GET /config` — snapshot the current activities webhook.
2. ☐ Open `/dashboard` via URL (anchors on the first card).
3. ☐ Click **Automations** in the activity-feed header.
   - ✅ *(UI)* The activity-feed-automations modal is visible (`openAutomations`).
4. ☐ Flip the enable **switch** on (`setAutomationsEnabled(true)` reads `aria-checked` and only clicks if needed — Fleet's `Slider` has no accessible name).
   - ✅ *(UI)* The switch's `aria-checked` is `true`.
5. ☐ Fill the destination-URL field (reached by placeholder `https://server.com/example`) with `https://example.com/fleet-activity-automations`; click **Save**.
   - ✅ *(UI)* The modal closes (`saveAutomations`).
   - ✅ *(API)* `GET /config` → `enable_activities_webhook === true` and `destination_url ===` the URL. **Load-bearing, not just a check**: it serialises the PATCH before the modal is reopened, otherwise the reopened modal can load pre-save config and the next save writes the stale value back.
6. ☐ Re-open **Automations**.
   - ✅ *(UI)* The switch is still `aria-checked=true` (state persisted across modal close/open).
7. ☐ Replace the URL with the `-edited` variant; **Save**.
   - ✅ *(UI)* Modal closed. ✅ *(API)* `GET /config` shows the edited URL, still enabled.
8. ☐ Re-open **Automations**; flip the switch **off**; **Save**.
   - ✅ *(UI)* Switch reads `aria-checked=false` before saving; modal closed.
   - ✅ *(API)* `GET /config` shows `enabled: false`, URL unchanged (Fleet keeps the destination when disabling).
9. ☐ Re-open `/dashboard`; walk the **Activity** feed.
   - ✅ *(UI)* Rows matching `enabled activity automations.`, `edited activity automations.`, `disabled activity automations.` — these matchers carry **no subject**, only the verb, so they are the one activity family in the suite that cannot be name-stamped for uniqueness (see *smells*).
10. ☐ *(API, `finally`)* PATCH the snapshotted webhook back.

**Assessment**
- *Value:* the only coverage of the dashboard's Automations modal — enable/edit/disable, the toggle's persisted state, and the fact that all three verbs are journalled. Also the only place the `activities_webhook` config subtree is exercised through the UI.
- *Coverage gaps:* the webhook never actually **fires** — no request-bin assertion that an activity is POSTed to the destination. URL validation (empty / non-URL / http vs https) untested. The modal's **Cancel** path untested. Saving with the toggle on but the URL blank untested. No assertion that the previously-saved URL is *pre-filled* when the modal reopens (only the toggle state is checked).
- *Redundancy:* the feed-walk in step 9 re-exercises `expectActivities`, already covered by MISC-04/08/17 and every CRUD lifecycle in the suite; the three automations matchers themselves are unique to this test. The API `GET /config` assertions overlap `tests/api/config.spec.ts` in shape but not in these fields.
- *Efficiency / smells:* the activity matchers are subject-less regexes, so on a shared instance a **neighbouring run's** `enabled activity automations.` row satisfies this test — the assertion cannot prove the row came from this run (contrast the rest of the suite, which relies on `Date.now()`-stamped names; `DashboardPage.expectActivities`' docstring states matcher uniqueness is the caller's contract, [`DashboardPage.ts:170`](../../pages/DashboardPage.ts)). The declared "cannot run concurrently with itself" constraint is enforced only by convention, not by a lock or a serial-mode marker. Also note the citation lines for these three matchers in [`activity-copy.ts:236-240`](../../helpers/activity-copy.ts) (1671/1674/1677) collide with the `report.*` citations — one of the two blocks' line references is stale.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-20 · Free • paywall presence › 17 URL cases

- **File:** [`playwright/tests/e2e/free/paywalls.spec.ts`](../../tests/e2e/free/paywalls.spec.ts)
- **Grep:** run the group with `npx playwright test -g "Free • paywall presence"`, or one case with its exact name, e.g. `-g "Controls — OS updates"`
- **Project:** free only · **Mode:** UI · **Isolation:** 17 independent single-assertion tests generated by a `for` loop over `PAYWALLED_PAGES` (documented here as one entry; each row is its own `test()` and its own page load)
- **Preconditions:** free-tier instance, admin session. Direct-URL navigation is explicitly sanctioned for this spec by `playwright/CLAUDE.md`.
- **Data created:** none

**Flow** *(per row)*

1. ☐ Navigate directly to the URL.
2. ☐ Look for text matching `/This feature is included in Fleet Premium/i`.
   - ✅ *(UI)* The first matching element is visible.
   - ✅ *(UI)* The number of matching elements equals `expectedBanners ?? 1` — the MDM integrations page expects **2** (ABM + Microsoft Entra cards).

Cases (tick as you re-run each by hand):

| ☐ | Page | URL | Banners |
|---|---|---|---|
| ☐ | Controls — OS updates | `/controls/os-updates` | 1 |
| ☐ | Controls — OS settings (root → disk encryption) | `/controls/os-settings` | 1 |
| ☐ | Controls — OS settings / Disk encryption | `/controls/os-settings/disk-encryption` | 1 |
| ☐ | Controls — OS settings / Certificates | `/controls/os-settings/certificates` | 1 |
| ☐ | Controls — OS settings / Passwords | `/controls/os-settings/passwords` | 1 |
| ☐ | Controls — Setup experience (root) | `/controls/setup-experience` | 1 |
| ☐ | Controls — Setup experience / Bootstrap package | `/controls/setup-experience/bootstrap-package` | 1 |
| ☐ | Controls — Setup experience / Install software | `/controls/setup-experience/install-software` | 1 |
| ☐ | Controls — Setup experience / Run script | `/controls/setup-experience/run-script` | 1 |
| ☐ | Controls — Setup experience / Setup assistant | `/controls/setup-experience/setup-assistant` | 1 |
| ☐ | Controls — Setup experience / Users | `/controls/setup-experience/users` | 1 |
| ☐ | Settings — Integrations / MDM (ABM + Entra) | `/settings/integrations/mdm` | **2** |
| ☐ | Settings — Integrations / Calendars | `/settings/integrations/calendars` | 1 |
| ☐ | Settings — Integrations / Identity provider | `/settings/integrations/identity-provider` | 1 |
| ☐ | Settings — Integrations / Conditional access | `/settings/integrations/conditional-access` | 1 |
| ☐ | Settings — Integrations / Change management | `/settings/integrations/change-management` | 1 |
| ☐ | Settings — Integrations / Certificate authorities | `/settings/integrations/certificate-authorities` | 1 |

**Assessment**
- *Value:* cheap, broad regression net over 17 licence gates. It is **not** pure element-absence checking — it asserts the *presence* of the paywall plus an exact count, so it fails in both directions that matter: paywall vanishes (count 0) and the page stops rendering (count 0). The exact-count assertion is what makes it more than a smoke test: a second banner appearing (or the ABM/Entra card count changing) fails loudly.
- *Coverage gaps:* the spec never asserts the **gated feature is absent**. If Fleet regressed to render the paywall *and* the real premium controls (e.g. an **Add profile** button under the banner), every case still passes — nothing checks for the absence of the feature UI. It also never asserts the URL or a page heading, so a silent redirect to a page that happens to carry the same copy would pass. The paywall's own CTA (the "Learn more"/upgrade link and its href) is unchecked. Untested paywalled surfaces worth adding: `/software` **Library** self-service/labels-scoping gates, `/policies` calendar automations, teams-related settings pages beyond MISC-21, and anything gated on `/settings/integrations/*` sub-tabs not in the list.
- *Redundancy:* the API-side counterpart is [`tests/api/free/endpoints.spec.ts`](../../tests/api/free/endpoints.spec.ts) (8 endpoints → 402 + `Requires Fleet Premium license`), which is a genuinely different layer, plus [`tests/api/free/license.spec.ts`](../../tests/api/free/license.spec.ts) for `license.tier === 'free'`. Free-tier UI gating is also asserted in `free/hosts/mdm-actions-availability.spec.ts` and `free/software/manage-automations-access.spec.ts` — no overlap with these URLs.
- *Efficiency / smells:* 17 separate `test()`s means 17 contexts + page loads for 17 assertions; a single test looping with soft assertions (`expect.soft`) would cut most of the fixture overhead while still reporting every failing URL — the trade-off is losing per-URL retry/attribution. `pw.getByText(regex)` in the spec body is raw-locator use, tolerable here given there is no page object for a banner. `expectedBanners ?? 1` silently defaults, so a page that grows a second banner legitimately looks like a failure until the table is updated (arguably the point).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-21 · Free • paywall presence › Settings — no Teams nav link

- **File:** [`playwright/tests/e2e/free/paywalls.spec.ts`](../../tests/e2e/free/paywalls.spec.ts)
- **Grep:** `npx playwright test -g "Settings — no Teams nav link"`
- **Project:** free only · **Mode:** UI · **Isolation:** independent, read-only

**Flow**

1. ☐ Navigate directly to `/settings/organization/info`.
2. ☐ Look for a link whose accessible name is exactly `Teams`.
   - ✅ *(UI)* Count is 0.

**Assessment**
- *Value:* guards the one free-tier gate that shows up as a *missing* nav item rather than a banner — teams don't exist on free.
- *Coverage gaps:* **this is the one genuinely vacuous assertion in the area.** There is no positive control: if the settings page failed to render (blank page, redirect, 500), the `Teams` link count is still 0 and the test passes green. It needs a companion assertion that the settings sidebar rendered at all (e.g. the `Organization info` heading or the `Integrations` link is visible). It also doesn't check that `/settings/teams` itself is unreachable, nor that the premium mirror asserts the link *is* present.
- *Redundancy:* the API side is covered by `POST /teams` → 402 in [`tests/api/free/endpoints.spec.ts`](../../tests/api/free/endpoints.spec.ts).
- *Efficiency / smells:* raw `page.getByRole` in the spec; a `SettingsPage`/`Navbar`-level accessor would be reusable and would naturally carry the positive control.

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
| Dynamic label create/edit/delete | MISC-01…03 | SQL query never entered or asserted; platform selector never used (`selectPlatform` is dead code); no host-resolution check |
| Manual label create/edit/delete | MISC-05…07 | membership never verified after save; host removal untested; selected host not compared to the requested one |
| Host-vitals label type | — | **entirely untested** (`LabelType` includes `'Host vitals'`, no spec uses it) |
| Label list sort | MISC-09 | page 1 only; Description/Type columns unsorted; third-click state |
| Label → hosts navigation | MISC-10 | hosts table/count/URL never asserted; pill dismissal untested |
| Label permissions (UI) | MISC-11…13 | no positive "own label is editable" case; no route-level block check; observer+/technician/ws-observer uncovered; **no API-side label role probes exist** |
| Reaching Labels via the user menu | — | every spec deep-links `/labels/manage`; `Navbar.labelsItem` is never clicked |
| Label activity copy | MISC-04, MISC-08 (duplicate) | team-scoped label suffix never produced |
| Packs CRUD (UI) | MISC-14…16 | no query ever added to a pack; label/team targets untested; rename/enable-disable untested |
| Pack execution / scheduling | MISC-18 (**skipped**, 405) | zero live coverage; may be unreachable on simulated hosts anyway |
| Dashboard activity automations | MISC-19 | webhook never observed firing; URL validation, Cancel, URL pre-fill unchecked |
| Dashboard cards / software widget / platform tabs | — | `DashboardPage` exposes `cards`, `softwareTable`, `/dashboard/{mac,windows,…}` — **no spec in this area asserts any of it** (only `firstCard` visibility as a `goto` anchor) |
| Free paywall banners (17 pages) | MISC-20 | never asserts the gated feature UI is absent; no URL/heading anchor; CTA link unchecked |
| Free "no Teams" gate | MISC-21 | vacuous — no positive control that the page rendered |

**Duplication**

1. **Dynamic vs Manual label lifecycles** — MISC-02/03 and MISC-06/07 are line-for-line identical, and MISC-04/MISC-08 assert the same three regexes (label activity copy has no type distinction). Four of the eight label tests carry no unique risk. Collapsing the Manual lifecycle to *create + membership verification* (the only manual-specific behaviour) would halve the file's runtime.
2. **Activity assertions asserted twice per pack lifecycle** — MISC-14/15/16 each call `assertActivity` (API) for the same events MISC-17 verifies as rendered copy (UI).
3. **Role-access triplet** — MISC-11/12/13 differ only by static-user key and one expectation; the house style tolerates this, so it's a judgement call rather than a defect.
4. **`expectActivities` machinery** — re-exercised by MISC-04, MISC-08, MISC-17, MISC-19 and by every CRUD spec elsewhere in the suite; only the matchers differ.

**UI-vs-API balance**

Mostly healthy. The API is used in three distinct ways here and only one is a shortcut:

- **Justified (activity-feed contract):** `assertActivity` in MISC-14/15/16 checks the activity *record* (type + `details.pack_name` + actor), which the UI copy check can't see — but keeping both layers per event is belt-and-braces.
- **Justified (load-bearing serialisation):** `expectActivitiesWebhook` in MISC-19 is documented as the write barrier between modal saves, not decoration. Removing it would reintroduce a stale-config race.
- **Justified (precondition/self-heal):** `deleteLabelsMatching` in the labels `beforeAll` (Fleet's cleanup projects don't wipe labels) and `firstHostDisplayName` in MISC-05.
- **The one real gap in the other direction:** the labels delete assertions use a page-1-only `rowFor()` check (MISC-03/07) where either a paging UI check or a `GET /labels` API check would be sound. And MISC-18 is API-only by construction with no UI counterpart.

**Quick wins**

1. Fix the page-1-only delete assertions — use `locateRow()` (or `GET /labels`) at [`labels.spec.ts:91`](../../tests/e2e/premium/labels/labels.spec.ts) and [`:175`](../../tests/e2e/premium/labels/labels.spec.ts); today a failed delete can pass green.
2. Give MISC-21 a positive control (assert the settings sidebar rendered) at [`paywalls.spec.ts:38-41`](../../tests/e2e/free/paywalls.spec.ts) — it is currently vacuous.
3. Assert `addHost()`'s return value equals the requested host name at [`labels.spec.ts:135`](../../tests/e2e/premium/labels/labels.spec.ts), and follow up with a **View all hosts** membership check so manual labels are actually verified.
4. Delete MISC-08 (duplicate of MISC-04) and reduce MISC-06/07 to the manual-specific parts — removes one dashboard feed walk and two redundant CRUD round-trips from every premium run.
5. Tighten `PackEditPage.saveButton` to an exact name and swap `page.getByText(packName)).toBeHidden()` for `packsList.packRow(name)).toHaveCount(0)` ([`PackEditPage.ts:38`](../../pages/packs/PackEditPage.ts), [`packs.spec.ts:53`](../../tests/e2e/shared/packs/packs.spec.ts)).

**Bigger bets**

1. **Decide packs' fate.** Packs is deprecated in Fleet, its only meaningful test (MISC-18) is blocked on a 405 scheduling endpoint, and its POM is the suite's most brittle locator cluster (react-select v1 classes that will never gain a `data-testid` — [`PackEditPage.ts:42-48`](../../pages/packs/PackEditPage.ts)). Either cut MISC-14…18 to a single smoke test ("the packs page loads and lists packs") or delete the area and reclaim the maintenance surface. Keeping a full CRUD lifecycle on a deprecated feature, running in **both** tiers, is the worst of the three options.
2. **A role-scoped page fixture.** Ten specs (including MISC-11…13) hand-roll `withStaticUser(browser, key, async page => new SomePage(page))`. A fixture like `asStaticUser('global-observer')` returning pre-built page objects would remove the boilerplate and make it much cheaper to widen role coverage (observer+, technician, ws-observer) — which is the biggest permission gap here. Pair it with API-side label role probes under `tests/api/role-access/premium/`, which currently has none.
3. **Make the paywall sweep two-sided and extend it to the dashboard.** Add a per-row "gated control must be absent" locator to `PAYWALLED_PAGES` so the spec catches a paywall rendering *alongside* the premium feature, and consider folding the 17 tests into one soft-assert loop. Separately, the dashboard itself (cards, Software widget, platform tabs — all modelled in `DashboardPage` and used only as a `goto` anchor) has no functional test anywhere in this area.
