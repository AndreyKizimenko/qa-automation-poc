# Labels, packs, dashboard automations, free paywalls — test audit

**Specs covered:** 11 files · **Entries:** 30 · **Test declarations:** 49 (loop-generated cases counted individually — the paywall loop contributes 17 of them, the Hosts-enrolled row sweep 3; each loop is documented as a single entry, MISC-20 and MISC-23) · **Projects:** premium / free (packs and the platform-cards spec run in both)

This is the leftovers area: the dedicated **Labels** page (`/labels/manage`, reachable only from the user menu), the deprecated **osquery Packs** feature (`/packs/manage`, no nav entry), the **dashboard** itself — its platform filter, the "Hosts enrolled" chart, the historical chart card and the per-fleet switches that empty it, plus the **activity-feed automations** modal (the global `activities_webhook`) — and the free tier's **paywall-presence** sweep. Labels carry two serial CRUD lifecycles (Dynamic + Manual) plus read-only sort/permission specs; packs is one serial CRUD lifecycle shared by both tiers; the paywall spec is a table-driven loop of direct-URL visits. The four dashboard specs are read-only apart from MISC-27, which is the only test in the suite that creates and deletes a fleet of its own — a sanctioned exception, for a reason worth reading before re-running it by hand.

## Contents

| ID | Spec | Test | Mode | Manual? |
|---|---|---|---|---|
| MISC-01 | `shared/labels/labels.spec.ts` | Labels • Dynamic label lifecycle › create | UI | ☐ |
| MISC-02 | `shared/labels/labels.spec.ts` | Labels • Dynamic label lifecycle › edit to a name with special characters | UI | ☐ |
| MISC-03 | `shared/labels/labels.spec.ts` | Labels • Dynamic label lifecycle › delete | UI | ☐ |
| MISC-04 | `shared/labels/labels.spec.ts` | Labels • Dynamic label lifecycle › activity feed shows create → edit → delete | UI | ☐ |
| MISC-05 | `shared/labels/labels.spec.ts` | Labels • Manual label lifecycle › create | UI+API | ☐ |
| MISC-06 | `shared/labels/labels.spec.ts` | Labels • Manual label lifecycle › edit from the Hosts list swaps a host | UI+API | ☐ |
| MISC-07 | `shared/labels/labels.spec.ts` | Labels • Manual label lifecycle › delete from the Hosts list | UI | ☐ |
| MISC-08 | `shared/labels/labels.spec.ts` | Labels • Manual label lifecycle › activity feed shows create → edit → delete | UI | ☐ |
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
| MISC-20 | `free/paywalls.spec.ts` | Free • paywall presence › ×18 URL cases (17 loop rows + the MDM integrations test) | UI | ☐ |
| MISC-21 | `free/paywalls.spec.ts` | Settings — no Teams nav link | UI | ☐ |
| MISC-22 | `shared/dashboard/platform-cards.spec.ts` | Dashboard • platform cards › the platform filter defaults to All and swaps in each platform view | UI | ☐ |
| MISC-23 | `shared/dashboard/platform-cards.spec.ts` | … › the `<platform>` row in Hosts enrolled opens its enrolled hosts (×3) | UI | ☐ |
| MISC-24 | `premium/dashboard/fleet-scoped-cards.spec.ts` | Hosts online renders for a fleet scope, with its controls | UI+API | ☐ |
| MISC-25 | `premium/dashboard/fleet-scoped-cards.spec.ts` | switching to Vulnerability exposure re-requests the chart for the fleet | UI+API | ☐ |
| MISC-26 | `premium/dashboard/fleet-scoped-cards.spec.ts` | applying a platform filter narrows the request and flags the chart Filtered | UI+API | ☐ |
| MISC-27 | `premium/dashboard/historical-data-collection.spec.ts` | each fleet switch empties its own chart dataset, and re-enabling restores both | UI+API | ☐ |
| MISC-28 | `free/dashboard/historical-data-collection.spec.ts` | the chart card offers one dataset and charts it | UI | ☐ |
| MISC-29 | `free/dashboard/historical-data-collection.spec.ts` | Activity & data retention offers the hosts online switch and not the premium one | UI+API | ☐ |
| MISC-30 | `shared/dashboard/activity-feed.spec.ts` | Dashboard • activity feed filters › search, type, date and sort narrow the feed to one actor's activities | UI+API | ☐ |

`Mode`: **UI** (all validation through the browser), **UI+API** (browser flow, some assertions via API), **API** (no meaningful UI validation), **PERF** (timing).

---

### MISC-01 · Labels • Dynamic label lifecycle › create

- **File:** [`playwright/tests/e2e/shared/labels/labels.spec.ts`](../../tests/e2e/shared/labels/labels.spec.ts)
- **Grep:** `npx playwright test -g "Labels • Dynamic label lifecycle › create"`
- **Project:** premium **and** free · **Scopes:** none — labels are created globally (no team dropdown)
- **Mode:** UI · **Isolation:** serial describe, step 1 of 4 (shares `name` / `editedName` closure vars with edit/delete/activity)
- **Preconditions:** `beforeAll` opens a cookie-less API context (`baseURL` from `FLEET_URL`) and calls `deleteLabelsMatching(ctx, 'pw-label-dyn')` — `GET /labels?per_page=500`, then `DELETE /labels/id/:id` for every non-builtin label whose name contains the marker. The cleanup projects sweep `pw-*` labels on premium only (the VMs-fleet step, skipped on free), so this is the spec's own self-heal on free. Each instance carries 20-odd gitops labels; list is client-side-paginated at 20/page, sorted by name.
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

### MISC-02 · Labels • Dynamic label lifecycle › edit to a name with special characters

- **File:** [`playwright/tests/e2e/shared/labels/labels.spec.ts`](../../tests/e2e/shared/labels/labels.spec.ts)
- **Grep:** `npx playwright test -g "Labels • Dynamic label lifecycle › edit to a name"`
- **Project:** premium **and** free · **Mode:** UI · **Isolation:** serial step 2 of 4 (depends on MISC-01)
- **Preconditions:** the label from MISC-01 exists
- **Data created:** renames the label to `<name> !@#$%^&*()_-+=` (round 3 batch A, C1 #14: a name with special characters)

**Flow**

1. ☐ Open `/labels/manage` via URL.
2. ☐ Page to the label's row, hover it, click the row **Actions** dropdown (`.actions-dropdown-select__control`), pick **Edit** (option matched by `.actions-dropdown-select__option` + text — the menu portals to `<body>` and carries no test id).
   - ✅ *(UI)* URL matches `/labels/<id>`.
   - ✅ *(UI)* **Name** field pre-populated with the original name.
   - ✅ *(UI)* **Description** field pre-populated with the original description.
3. ☐ Overwrite **Name** → `<name> !@#$%^&*()_-+=`, **Description** → `… (edited)`; click **Save**.
   - ✅ *(UI)* Success toast `Label updated successfully.`
4. ☐ Re-open `/labels/manage` and page to the renamed row.
   - ✅ *(UI)* Row for the edited name is visible, shows the special-characters name verbatim, and contains the edited description.

**Assessment**
- *Value:* the strongest assertion in the file — the edit form is verified to *load* existing values (name + description), not just accept new ones. The special-characters name then rides through the list, the delete toast (MISC-03) and the activity feed (MISC-04), which is QA Wolf's special-characters flow folded in rather than a lifecycle of its own.
- *Coverage gaps:* the label's type and query are not re-asserted after edit; whether a Dynamic label can be converted to Manual (or vice versa) is untested; the edit form's platform field is never read back.
- *Redundancy:* none since MISC-06 edits from the Hosts list (the manual label's membership); the rename is the overlap.
- *Efficiency / smells:* none material. The pre-populated-value assertions are exactly what similar CRUD specs in the suite usually omit — worth copying elsewhere.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-03 · Labels • Dynamic label lifecycle › delete

- **File:** [`playwright/tests/e2e/shared/labels/labels.spec.ts`](../../tests/e2e/shared/labels/labels.spec.ts)
- **Grep:** `npx playwright test -g "Labels • Dynamic label lifecycle › delete"`
- **Project:** premium **and** free · **Mode:** UI · **Isolation:** serial step 3 of 4 · this is the lifecycle's cleanup
- **Preconditions:** renamed label from MISC-02 exists

**Flow**

1. ☐ Open `/labels/manage` via URL; page to the renamed row; open its **Actions** dropdown; pick **Delete**.
   - ✅ *(UI)* The `Delete label` modal is visible (`.modal__modal_container` filtered by title text — Fleet's Modal renders a role-less title).
2. ☐ Click **Delete** inside the modal.
   - ✅ *(UI)* Success toast `Successfully deleted <editedName>.`
3. ☐ Re-open `/labels/manage` and page through the whole list.
   - ✅ *(UI)* No row matching the edited name on any page — `locateRow(editedName)` returns a locator with count 0.

**Assessment**
- *Value:* confirms the delete confirmation modal wires to a real delete and the toast names the label.
- *Coverage gaps:* the modal's **Cancel** path is untested; label deletion's side effects (hosts losing the label, software/profile targeting that referenced it) are untested.
- *Redundancy:* MISC-07 deletes from the Hosts list instead; only the paged absence check is shared.
- *Efficiency / smells:* the absence check pages the whole list (`locateRow`), so it costs a page walk; it used to read page 1 only and could pass on a failed delete (FINDINGS #1, fixed 2026-10-02).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-04 · Labels • Dynamic label lifecycle › activity feed shows create → edit → delete

- **File:** [`playwright/tests/e2e/shared/labels/labels.spec.ts`](../../tests/e2e/shared/labels/labels.spec.ts)
- **Grep:** `npx playwright test -g "Labels • Dynamic label lifecycle › activity feed shows create → edit → delete"`
- **Project:** premium **and** free · **Mode:** UI · **Isolation:** serial step 4 of 4 (needs MISC-01…03 to have run)

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

### MISC-05 · Labels • Manual label lifecycle › create

- **File:** [`playwright/tests/e2e/shared/labels/labels.spec.ts`](../../tests/e2e/shared/labels/labels.spec.ts)
- **Grep:** `npx playwright test -g "Labels • Manual label lifecycle › create"`
- **Project:** premium **and** free · **Mode:** UI+API (API used for the host precondition only) · **Isolation:** serial step 1 of 4 in the second describe
- **Source:** also QA Wolf `mdm-add-and-update-manual-labels-to-host` (round 1 C9 #11; round 3, batch C), whose lifecycle runs from the Hosts list
- **Preconditions:** `beforeAll` purges `pw-label-man*` labels via the API (same helper as MISC-01). `findSimulations(request, 'linux', 3, 2)` picks three online Linux **simulations** (slices 2–4, registered in `helpers/api/hosts.ts`, never moved) and `getHostDisplayName` reads their names; the test fails if the pool has fewer. Never a real VM: on free the VMs share the label's global scope. `pageHealth.disable()` — typing in the host picker makes Fleet log a benign 4xx (`Invalid usage: missing required parameter(s)`) to the console.
- **Data created:** label `pw-label-man-<timestamp>` with the first two simulations as members

**Flow**

1. ☐ *(API precondition)* Pick three Linux simulations and read their display names.
2. ☐ Open `/labels/manage` via URL → click **Add label** → URL `/labels/new`.
3. ☐ Click the **Manual** radio label.
   - ✅ *(UI)* The `Manual` radio is checked.
4. ☐ Fill **Name** / **Description**.
5. ☐ For each of the first two hosts: type its display name into the host **search box**, then click the first result in the dropdown.
   - ✅ *(UI)* The host the picker selected is the one searched for (`addHost`'s return value).
   - ✅ *(UI)* It appears in the **selected-hosts** table — guards against saving a manual label with zero hosts, which the server rejects with a 422.
6. ☐ Click **Save**.
   - ✅ *(UI)* Success toast `Label added successfully.`; URL back on `/labels/manage`.
7. ☐ Re-open the list, page to the row.
   - ✅ *(UI)* Row visible, contains the description, contains `Manual`.
8. ☐ **Hosts** in the navbar → **Filter by platform or label** → type the label's name → pick it.
   - ✅ *(UI)* URL `/hosts/manage/labels/<id>`; the pill is "hosts filtered by <name>".
   - ✅ *(UI)* The list holds exactly the two members, by name.

**Assessment**
- *Value:* the manual-label host picker (search → select → selected table), a distinct Fleet component (`TargetsInput`), and what the label then does: the Hosts list filtered by it lists exactly its members.
- *Coverage gaps:* the empty-selection 422 path the POM comment describes; the labels table's own host count.
- *Redundancy:* steps 2, 4, 6, 7 duplicate MISC-01.
- *Efficiency / smells:* `pageHealth.disable()` is whole-test, so genuine console errors and 5xx are also suppressed for this test; the underlying Fleet console 4xx has no filed issue. The picker's tables have no accessible names, so `.targets-input__hosts-search-dropdown` / `__hosts-selected-table` tell them apart (documented in the POM). The label filter is typed into: filling its "Filter labels by name..." box closes the menu.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-06 · Labels • Manual label lifecycle › edit from the Hosts list swaps a host

- **File:** [`playwright/tests/e2e/shared/labels/labels.spec.ts`](../../tests/e2e/shared/labels/labels.spec.ts)
- **Grep:** `npx playwright test -g "Labels • Manual label lifecycle › edit from the Hosts list"`
- **Project:** premium **and** free · **Mode:** UI+API · **Isolation:** serial step 2 of 4 · `pageHealth.disable()` (the same host search as MISC-05)

**Flow**

1. ☐ Open `/hosts/manage`; filter by the label; click **Edit label** beside its pill.
   - ✅ *(UI)* URL `/labels/<id>`; **Name** and **Description** pre-populated with the created values.
   - ✅ *(UI)* The selected-hosts table holds exactly the two members.
2. ☐ Overwrite Name and Description; click **Remove** on the second member; search for the third host and pick it; click **Save**.
   - ✅ *(UI)* The removed row is gone; the added host is in the selected table.
   - ✅ *(UI)* Toast `Label updated successfully.`
   - ✅ *(API)* `GET /labels/:id/hosts` holds exactly the first and third hosts (polled: the toast can't prove what was stored).
3. ☐ Re-open the Labels list, page to the renamed row.
   - ✅ *(UI)* Row visible with the edited description.
4. ☐ **Hosts** → filter by the renamed label.
   - ✅ *(UI)* The pill names it; the list holds exactly the first and third hosts.

**Assessment**
- *Value:* the Hosts list's **Edit label** (otherwise untested), and the manual-only part of an edit: the form pre-loads the members, and a removal and an addition both persist and show on the filtered list. No longer a duplicate of MISC-02.
- *Coverage gaps:* the Hosts list's Edit label for a role that isn't global or the label's author (it's hidden then) is batch E's.
- *Redundancy:* rename + description edit still repeat MISC-02's.
- *Efficiency / smells:* one API read, as the oracle for what the save stored.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-07 · Labels • Manual label lifecycle › delete from the Hosts list

- **File:** [`playwright/tests/e2e/shared/labels/labels.spec.ts`](../../tests/e2e/shared/labels/labels.spec.ts)
- **Grep:** `npx playwright test -g "Labels • Manual label lifecycle › delete from the Hosts list"`
- **Project:** premium **and** free · **Mode:** UI · **Isolation:** serial step 3 of 4 · lifecycle cleanup

**Flow**

1. ☐ Open `/hosts/manage`; filter by the renamed label; click **Delete label** beside its pill.
   - ✅ *(UI)* `Delete label` modal visible.
2. ☐ Confirm **Delete**.
   - ✅ *(UI)* Toast `Successfully deleted label.` (the Labels page's says the name; this one doesn't).
   - ✅ *(UI)* Back on `/hosts/manage` with no label in the route and no pill.
3. ☐ Open the Labels list and page through it.
   - ✅ *(UI)* `locateRow(editedName)` count 0 on every page.

**Assessment**
- *Value:* the Hosts list's **Delete label** (otherwise untested) and where it leaves you; MISC-03 keeps the Labels page's delete.
- *Coverage gaps:* the member hosts aren't re-read for losing the label.
- *Redundancy:* the absence check is MISC-03's.
- *Efficiency / smells:* none.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-08 · Labels • Manual label lifecycle › activity feed shows create → edit → delete

- **File:** [`playwright/tests/e2e/shared/labels/labels.spec.ts`](../../tests/e2e/shared/labels/labels.spec.ts)
- **Grep:** `npx playwright test -g "Labels • Manual label lifecycle › activity feed shows create → edit → delete"`
- **Project:** premium **and** free · **Mode:** UI · **Isolation:** serial step 4 of 4

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

### MISC-20 · Free • paywall presence › 18 URL cases

- **File:** [`playwright/tests/e2e/free/paywalls.spec.ts`](../../tests/e2e/free/paywalls.spec.ts)
- **Grep:** run the group with `npx playwright test --project=free -g "Free • paywall presence"`, or one case with its exact name, e.g. `-g "Controls — OS settings / Host names"`
- **Project:** free only · **Mode:** UI · **Isolation:** 18 independent tests — 17 generated by a `for` loop over `PAYWALLED_PAGES` (each row its own `test()` and its own page load) plus one standalone test for the MDM integrations page, `Settings — Integrations / MDM (Android zero-touch, Apple Business, Microsoft Entra cards)`. Documented here as one entry.
- **Preconditions:** free-tier instance, admin session. Direct-URL navigation is explicitly sanctioned for this spec by `playwright/CLAUDE.md`.
- **Data created:** none

**Flow** *(per loop row)*

1. ☐ Navigate directly to the URL.
2. ☐ *(the five OS-settings rows only)* Look for the card's own heading.
   - ✅ *(UI)* a heading named exactly as the row's **Heading** column is visible. OS settings sends a section it doesn't know to **Disk encryption**, which shows the same paywall, so without this a row would pass with its own card gone.
3. ☐ Look for text matching `/This feature is included in Fleet Premium/i`.
   - ✅ *(UI)* the first match is visible.
   - ✅ *(UI)* there is exactly **1** match.

**Flow** *(the MDM integrations test)*

1. ☐ Navigate directly to `/settings/integrations/mdm`.
2. ☐ For each of the **Android zero-touch**, **Apple Business (AB)** and **Microsoft Entra** cards:
   - ✅ *(UI, soft)* the card's section shows the Premium message — each card is checked on its own, so one missing banner doesn't hide the others.
3. ☐ ✅ *(UI)* the page has exactly **3** Premium messages — the page's free MDM toggles carry none.

Cases (tick as you re-run each by hand):

| ☐ | Page | URL | Heading asserted | Banners |
|---|---|---|---|---|
| ☐ | Controls — OS updates | `/controls/os-updates` | — | 1 |
| ☐ | Controls — OS settings (root → disk encryption) | `/controls/os-settings` | `Disk encryption` | 1 |
| ☐ | Controls — OS settings / Disk encryption | `/controls/os-settings/disk-encryption` | `Disk encryption` | 1 |
| ☐ | Controls — OS settings / Certificates | `/controls/os-settings/certificates` | `Certificates` | 1 |
| ☐ | Controls — OS settings / Passwords | `/controls/os-settings/passwords` | `Passwords` | 1 |
| ☐ | Controls — OS settings / Host names | `/controls/os-settings/host-name-template` | `Host names` | 1 |
| ☐ | Controls — Setup experience (root) | `/controls/setup-experience` | — | 1 |
| ☐ | Controls — Setup experience / Bootstrap package | `/controls/setup-experience/bootstrap-package` | — | 1 |
| ☐ | Controls — Setup experience / Install software | `/controls/setup-experience/install-software` | — | 1 |
| ☐ | Controls — Setup experience / Run script | `/controls/setup-experience/run-script` | — | 1 |
| ☐ | Controls — Setup experience / Setup assistant | `/controls/setup-experience/setup-assistant` | — | 1 |
| ☐ | Controls — Setup experience / Users | `/controls/setup-experience/users` | — | 1 |
| ☐ | Settings — Integrations / Calendars | `/settings/integrations/calendars` | — | 1 |
| ☐ | Settings — Integrations / Identity provider | `/settings/integrations/identity-provider` | — | 1 |
| ☐ | Settings — Integrations / Conditional access | `/settings/integrations/conditional-access` | — | 1 |
| ☐ | Settings — Integrations / Change management | `/settings/integrations/change-management` | — | 1 |
| ☐ | Settings — Integrations / Certificate authorities | `/settings/integrations/certificate-authorities` | — | 1 |
| ☐ | Settings — Integrations / MDM *(standalone test)* | `/settings/integrations/mdm` | the three cards, by section | **3** |

**Assessment**
- *Value:* cheap, broad regression net over 18 licence gates. It is **not** pure element-absence checking — it asserts the *presence* of the paywall plus an exact count, so it fails in both directions that matter: paywall vanishes (count 0) and the page stops rendering (count 0). The exact count is what makes it more than a smoke test: a second banner appearing, or a card joining or leaving the MDM page, fails loudly. On the five OS-settings rows the card heading now pins *which* page answered, which closes the one silent pass the sweep had — OS settings falling back to Disk encryption's identical paywall for a section it doesn't recognise. That is why **Host names** could be added safely: without the heading, a removed or renamed Host names card would still have passed on Disk encryption's banner.
- *Coverage gaps:* the spec never asserts the **gated feature is absent**. If Fleet regressed to render the paywall *and* the real premium controls (e.g. an **Add profile** button under the banner), every case still passes. The heading anchor covers only the OS-settings rows — the OS updates, Setup experience and Integrations rows still assert no URL or heading, so a redirect to a page carrying the same copy would pass there (Setup experience has the same kind of section fallback risk as OS settings, unexamined). The paywall's own CTA (the "Learn more"/upgrade link and its href) is unchecked. Untested paywalled surfaces worth adding: `/software` **Library** self-service/labels-scoping gates, `/policies` calendar automations, teams-related settings pages beyond MISC-21, and anything gated on `/settings/integrations/*` sub-tabs not in the list. Gates behind a *button* rather than a page — the host details **User** card's *Add user* modal — can't be rows here; that one is [HOST-24](02-hosts-shared-and-free.md).
- *Redundancy:* the API-side counterpart is [`tests/api/free/endpoints.spec.ts`](../../tests/api/free/endpoints.spec.ts) (8 endpoints → 402 + `Requires Fleet Premium license`), which is a genuinely different layer, plus [`tests/api/free/license.spec.ts`](../../tests/api/free/license.spec.ts) for `license.tier === 'free'` and two premium-only writes. Free-tier UI gating is also asserted in `free/hosts/mdm-actions-availability.spec.ts`, `free/hosts/host-idp-username.spec.ts` and `free/software/manage-automations-access.spec.ts` — no overlap with these URLs.
- *Efficiency / smells:* 18 separate `test()`s means 18 contexts + page loads; a single test looping with soft assertions (`expect.soft`, as the MDM test already does across its three cards) would cut most of the fixture overhead while still reporting every failing URL — the trade-off is losing per-URL retry/attribution. `pw.getByText(regex)` and `pw.getByRole('heading', …)` in the spec body are raw-locator use, tolerable here given there is no page object for a banner. `heading` is optional, so a new OS-settings row added without one silently loses the anchor.

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

### MISC-22 · Dashboard • platform cards › the platform filter defaults to All and swaps in each platform view

- **File:** [`playwright/tests/e2e/shared/dashboard/platform-cards.spec.ts`](../../tests/e2e/shared/dashboard/platform-cards.spec.ts)
- **Grep:** `npx playwright test -g "the platform filter defaults to All and swaps in each platform view"`
- **Projects:** premium **and** free (a `shared/` spec — it runs once per tier) · **Scopes:** none; the case never touches the fleet dropdown, so premium runs it under whatever scope the dashboard opens with
- **Mode:** UI · **Isolation:** independent, read-only; no shared state
- **Preconditions:** the instance carries hosts on **macOS, Windows and Linux** (both osquery-perf pools do). ChromeOS / iOS / iPadOS / Android are deliberately left out of the case table — neither instance has hosts for them, so their rows render as inert text rather than links.
- **Data created:** none

> **The dashboard has no "platform cards" any more.** The name is the QA Wolf flow's, kept on the file. Fleet replaced that row of cards with the **Hosts enrolled** bar chart (`HostsEnrolledCard`), which is what MISC-23 clicks. What survives under the old name is the **Platform:** filter and the host-count cards it swaps in and out — this case.

**Flow**

1. ☐ Open `/dashboard` via URL (`DashboardPage.goto()`).
   - ✅ *(UI)* The first dashboard card is visible — `goto()` anchors on `data-testid="card"`.
   - ✅ *(UI)* The **Platform:** filter's single-value reads exactly `All`.
   - ✅ *(UI)* The **Total hosts** host-count card is visible. `hostCountCard(name)` matches a *link* whose accessible name ends in the card name (the rendered name is `<count> Total hosts`), so the count itself is never asserted.
2. ☐ For each platform in turn — **macOS** → `/dashboard/mac`, **Windows** → `/dashboard/windows`, **Linux** → `/dashboard/linux` — pick it in the **Platform:** filter.
   - ✅ *(UI)* URL matches that platform's path (asserted inside `selectPlatform()`, then again in the spec — selecting a platform is a `router.push`, so the path *is* the proof the filter took effect).
   - ✅ *(UI)* The filter's single-value reads the platform label (inside `selectPlatform()`).
   - ✅ *(UI)* **Total hosts** count is **0** — the all-platforms aggregate card is dropped from every platform view.
   - ✅ *(UI)* An **Operating systems** `<h2>` is visible — the card that only a platform view renders.
   - ✅ *(UI)* **macOS / Windows only:** the vendor sentence `Apple releases updates and fixes for supported operating systems.` / `Microsoft releases …` is visible. Linux carries no vendor, so that assertion is skipped for it.
3. ☐ Set the filter back to **All**.
   - ✅ *(UI)* **Total hosts** is visible again.

**Assessment**
- *Value:* the only functional coverage the dashboard's platform routing has. It pins four things at once: the filter's default, the three `router.push` destinations, the aggregate card disappearing on a platform view, and the per-platform **Operating systems** card arriving with the right vendor copy. Cheap and deterministic — one page load, no writes.
- *Coverage gaps:* the OS card's *contents* (the version list, the host counts, the "View all hosts" link) are never touched; **Missing hosts** / **Low disk space hosts** / **ABM issue hosts** cards are never asserted on any view, nor the premium-only extra card; no host-count value is compared to anything, so a card reading `0 Total hosts` on a 300-host instance passes; the four platforms the instances carry no hosts for (ChromeOS, iOS, iPadOS, Android) are never visited, so their `/dashboard/<platform>` routes are unproven; direct-URL entry to `/dashboard/mac` (rather than picking the filter) is never exercised, so the filter's *rehydration* from the URL is untested.
- *Redundancy:* none. `DashboardPage.goto()` is used as an anchor by a dozen specs across the suite, but nothing else asserts a dashboard card.
- *Efficiency / smells:*
  - The vendor sentence is built with a raw `dashboard.page.getByText(...)` in the spec body rather than a POM accessor — the one raw locator in the file.
  - `platformFilter` / `platformFilterValue` are react-select v5 class selectors (`.dashboard-page__platform-filter .react-select__control`), documented in the POM as unavoidable because the trigger exposes no role.
  - `selectPlatform()` is idempotent (reads the current value and returns without clicking if it already matches), so the closing "back to All" step is a real navigation only because the loop left it on Linux.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-23 · Dashboard • platform cards › the `<platform>` row in Hosts enrolled opens its enrolled hosts — ×3 platforms

- **File:** [`playwright/tests/e2e/shared/dashboard/platform-cards.spec.ts`](../../tests/e2e/shared/dashboard/platform-cards.spec.ts)
- **Grep:** one case at a time — `npx playwright test -g "the macOS row in Hosts enrolled opens its enrolled hosts"` (likewise `Windows`, `Linux`); the whole group with `-g "row in Hosts enrolled"`
- **Projects:** premium **and** free · **Scopes:** none
- **Mode:** UI · **Isolation:** three independent loop-generated tests (macOS / Windows / Linux), documented here as one entry; each is its own page load, none share state
- **Preconditions:** hosts enrolled on all three platforms, and Fleet's **built-in platform labels** present (they always are — Fleet ships them)
- **Data created:** none

> **Read this before "fixing" a green run.** The QA pools are osquery-perf **simulations** that answer *every* built-in label query, so the "macOS" label holds ~200 mostly-**Ubuntu** hosts on both instances. That is a fixture artefact, not a Fleet bug. The spec therefore asserts the **link contract** — that clicking a platform row opens the hosts list scoped to the label named for that platform, enrolled hosts only — and **never** the rows behind it. A "every row on this page is a Mac" assertion would be red because of our hosts, not Fleet, and a green one would prove nothing.

**Flow** *(per platform)*

1. ☐ Open `/dashboard` via URL.
   - ✅ *(UI)* First dashboard card visible (`goto()` anchor).
   - ✅ *(UI)* The **Hosts enrolled** `<h2>` is visible.
2. ☐ Click the platform's row in the **Hosts enrolled** chart — the y-axis tick, a `role="button"` whose accessible name is `"<platform> hosts"` (Fleet's `ClickableYAxisTick`). A platform with no hosts and no label to link to renders as inert text instead, so `toHaveCount(0)` is how "not clickable" would read.
   - ✅ *(UI)* URL matches `/hosts/manage/labels/\d+` — Fleet resolves the built-in label's id server-side, so only the **shape** is pinned, never a literal id.
   - ✅ *(UI)* URL contains `status=enrolled`.
   - ✅ *(UI)* The hosts list's label-filter trigger reads exactly the platform label — `HostsListPage.labelFilter.trigger` (`.label-filter-select__control`; react-select v5, no role). This is the assertion that ties the opened page to the platform that was clicked.
   - ✅ *(UI)* A data row **or** the empty state is visible — `DataTable.rowOrEmpty()`.

**Assessment**
- *Value:* pins `MANAGE_HOSTS_LABEL(labelId)` + `status=enrolled` — the one place in the suite where the dashboard's most-clicked link is proven to land somewhere coherent. The filter-reads-the-platform-name assertion is what makes it more than a smoke test: a wiring bug that sent every row to the same label id would fail on it.
- *Coverage gaps:* by design, nothing about **which hosts** come back (see the box above) — and by consequence nothing proves the label id in the URL is the *right* built-in label rather than merely *a* label whose filter chip happens to be named after the platform. The bar's host **count** is never read, nor compared with the hosts list's own count; a row for a platform with zero hosts is never asserted to be inert (the "renders as inert text" behaviour is documented in the POM but never tested); the chart's own heading is the only part of `HostsEnrolledCard` asserted.
- *Redundancy:* the `rowOrEmpty()` tail overlaps every hosts-list spec in [`02-hosts-shared-and-free.md`](02-hosts-shared-and-free.md); the unique content is the URL shape plus the label-filter value.
- *Efficiency / smells:* three tests × (one dashboard load + one hosts-list load) to assert one link template three times — the platform axis buys the "not all rows point at the same label" guarantee and nothing else. `hostsList` is pulled as a fixture purely for `labelFilter.trigger` and `table.rowOrEmpty()`.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-24 · Premium • Dashboard • fleet-scoped chart card › Hosts online renders for a fleet scope, with its controls

- **File:** [`playwright/tests/e2e/premium/dashboard/fleet-scoped-cards.spec.ts`](../../tests/e2e/premium/dashboard/fleet-scoped-cards.spec.ts)
- **Grep:** `npx playwright test -g "Hosts online renders for a fleet scope, with its controls"`
- **Project:** premium · **Scope:** the **VMs** fleet (`vmsFleetId` worker fixture, resolved once per worker by name via `GET /fleets`; it throws if the fleet is missing)
- **Mode:** UI+API · **Isolation:** independent, read-only — the card writes nothing
- **Preconditions:**
  - The **VMs** fleet exists and has **≥30 days of host check-in history**. This is why the spec is not on Workstations: Workstations holds no hosts, so its chart is a field of "No data" cells that cannot tell a working query from a broken one.
  - Deployment-wide historical collection is **on** for `uptime`. Not asserted as a precondition — it surfaces as a failure on the "Data collection is disabled" count-0 assertion.
- **Data created:** none
- **Cross-link:** free's cut-down counterpart is **MISC-28**; the write half of this surface is **MISC-27**.

**Flow**

1. ☐ Open `/dashboard` via URL.
   - ✅ *(UI)* First dashboard card visible.
2. ☐ Select **VMs** in the fleet dropdown (`TeamDropdown.selectByLabel('VMs')`), with a response listener armed **before** the click.
   - ✅ *(API)* A `GET …/charts/uptime?…fleet_id=<vmsFleetId>` response arrives with status **200**. Arming the wait first is what makes this an assertion rather than decoration: it proves the scope change actually re-queried the chart *for that fleet*, and it is the synchronisation point every cell assertion below depends on.
   - ✅ *(UI)* The dropdown's value is exactly `VMs` (asserted inside `selectByLabel()`, which is anchored to the whole label so one fleet name can't select another that contains it).
3. ☐ (No user action) Read the card's chrome.
   - ✅ *(UI)* The dataset dropdown's single-value reads `Hosts online`.
   - ✅ *(UI)* `.chart-card__title` count is **0** — premium must render the dataset *dropdown*, not free's plain heading. This is the tier-shape assertion, and it is the exact mirror of MISC-28's.
   - ✅ *(UI)* The card's info icon is visible.
   - ✅ *(UI)* **Configure chart filters** is visible.
   - ✅ *(UI)* The checkerboard legend contains both `No data` and `More`.
4. ☐ (No user action) Read the chart body.
   - ✅ *(UI)* The **Data collection is disabled** heading count is **0** — without this, an instance-wide setting that emptied the chart would pass as "no data yet".
   - ✅ *(UI)* At least one cell **with hosts** is visible — `chartCellsWithHosts` matches only cells whose accessible name ends `: N hosts`, excluding `No data` cells. The stronger of the two cell locators.

**Assessment**
- *Value:* the premium tier-shape check (dropdown, not heading) plus proof that picking a fleet re-issues a *fleet-scoped* chart query that returns real hours. The `fleet_id=` predicate on the response is the only place in the suite that proves the chart is scoped at all.
- *Coverage gaps:* the chart's **values** are never checked against anything (no comparison with the host count, no 30-day window assertion); the info icon's tooltip copy is unread; the legend is matched on two words, not its buckets; switching *back* to All fleets / Unassigned is untested, so a scope that sticks would pass; no negative case for a fleet with no history (which is exactly what MISC-27's throwaway fleet renders, but that spec asserts presence rather than emptiness).
- *Redundancy:* the "controls are visible" trio (info icon, Configure chart filters, disabled-heading count 0) repeats in MISC-25 and again in MISC-28; only the legend and `chartCellsWithHosts` assertions are unique here.
- *Efficiency / smells:*
  - The card is scoped by `.chart-card` and its internals by BEM/`checkerboard-viz` classes — documented in the POM (the card has no heading of its own on premium), but it means the whole entry rests on class selectors.
  - The `waitForResponse` here carries **no timeout**, and the project leaves `actionTimeout` unset, which makes the wait unbounded — a chart request that never lands burns the whole test budget instead of failing where it broke. MISC-27's helper caps the same wait at 60 s; this file does not.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-25 · Premium • Dashboard • fleet-scoped chart card › switching to Vulnerability exposure re-requests the chart for the fleet

- **File:** [`playwright/tests/e2e/premium/dashboard/fleet-scoped-cards.spec.ts`](../../tests/e2e/premium/dashboard/fleet-scoped-cards.spec.ts)
- **Grep:** `npx playwright test -g "switching to Vulnerability exposure re-requests the chart for the fleet"`
- **Project:** premium · **Scope:** **VMs** fleet
- **Mode:** UI+API · **Isolation:** independent, read-only
- **Preconditions:** as MISC-24, plus deployment-wide collection on for `vulnerabilities`
- **Data created:** none

> **⚠️ `/charts/cve` takes 10–11 seconds on the QA instances, even when they are idle** — longer than the suite's 10 s assertion timeout. This is the single most important fact for re-running any of MISC-25 / MISC-27 by hand: the chart body genuinely is empty for ten seconds after the dataset switch, and that is normal. Every positive chart assertion in these specs waits on the `/charts/<metric>` response *first*, and asserting on cells without that wait fails as an empty chart under any load.

**Flow**

1. ☐ Open `/dashboard` via URL, select **VMs** in the fleet dropdown.
   - ✅ *(UI)* Dataset dropdown reads `Hosts online` — the starting state.
2. ☐ Switch the dataset dropdown to **Vulnerability exposure**, with a response listener armed before the click.
   - ✅ *(API)* `GET …/charts/cve?…fleet_id=<vmsFleetId>` → **200**. Ten to eleven seconds (see the box).
   - ✅ *(UI)* The dataset dropdown reads `Vulnerability exposure` (inside `selectChartDataset()`).
3. ☐ (No user action) Read the card.
   - ✅ *(UI)* **Data collection is disabled** heading count **0**.
   - ✅ *(UI)* The first chart cell is visible — note this uses `chartCells`, which matches `No data` cells **too**, so it is weaker than MISC-24's `chartCellsWithHosts`. Deliberate: a fleet can legitimately have no CVE exposure in a given hour.
   - ✅ *(UI)* Info icon visible; **Configure chart filters** visible — the controls survive a dataset switch.

**Assessment**
- *Value:* the only coverage of the premium-gated `cve` dataset and of the dataset dropdown as a control (that switching re-queries, scoped, rather than re-slicing a cached payload).
- *Coverage gaps:* the cve chart's contents are entirely unasserted beyond "a cell exists"; nothing checks the dataset selection survives a reload, or that switching *back* to Hosts online re-requests `uptime`; free's absence of this dataset is asserted in MISC-28 by the dropdown's absence rather than by a paywall, so `cve` has no explicit tier gate anywhere.
- *Redundancy:* the controls trio duplicates MISC-24; MISC-27 also switches to Vulnerability exposure and waits on `/charts/cve` three times, so this dataset switch is exercised four times per premium run at ~11 s a call.
- *Efficiency / smells:* the unbounded `waitForResponse` noted in MISC-24 applies here too, and it matters more — `cve` is precisely the request most likely to hang. Two dashboard loads per run (this and MISC-24) each re-select VMs from scratch rather than entering with `goto({ fleetId })`, which the CRUD-spec convention in `playwright/CLAUDE.md` prescribes for scope-aware navigation.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-26 · Premium • Dashboard • fleet-scoped chart card › applying a platform filter narrows the request and flags the chart Filtered

- **File:** [`playwright/tests/e2e/premium/dashboard/fleet-scoped-cards.spec.ts`](../../tests/e2e/premium/dashboard/fleet-scoped-cards.spec.ts)
- **Grep:** `npx playwright test -g "applying a platform filter narrows the request and flags the chart Filtered"`
- **Project:** premium · **Scope:** **VMs** fleet
- **Mode:** UI+API · **Isolation:** independent. **Nothing persists** — `ChartCard` keeps filter state in component state only ("UI edits are not saved"), so the reload at the end *is* the cleanup, and asserting the pill is gone is the proof nothing was written.
- **Preconditions:** as MISC-24
- **Data created:** none

**Flow**

1. ☐ Open `/dashboard` via URL, select **VMs**.
   - ✅ *(UI)* Dataset dropdown reads `Hosts online`.
   - ✅ *(UI)* The **Filtered** pill count is **0** — the pill appears only once the applied filters differ from the card's seeded defaults, so its absence here is the baseline the rest of the case is measured against.
2. ☐ Click **Configure chart filters**.
   - ✅ *(UI)* The `.chart-filter-modal` is visible (inside `openChartFilters()`).
3. ☐ In the modal's platforms field (Fleet's legacy react-select v1 `Dropdown`, whose closed control shows its `All platforms` placeholder), pick **macOS**.
4. ☐ Click **Apply**, with a response listener armed before the click.
   - ✅ *(UI)* The modal is hidden afterwards (inside `applyChartFilters()`).
   - ✅ *(API)* `GET …/charts/uptime?…fleet_id=<vmsFleetId>…platforms=darwin` → **200**. The `platforms=darwin` predicate is the whole point: it proves the UI label **macOS** is translated to Fleet's platform token and reaches the server, which no DOM assertion could show.
   - ✅ *(UI)* The **Filtered** pill is visible.
5. ☐ Reload the page.
   - ✅ *(UI)* Dataset dropdown reads `Hosts online`.
   - ✅ *(UI)* The **Filtered** pill count is **0** again — filters live in component state, never in config.

**Assessment**
- *Value:* the only assertion in the suite that a UI filter label is translated into the API's own vocabulary (`macOS` → `darwin`), and the only "this control deliberately does not persist" check on the dashboard. Both are the kind of thing a DOM-only test cannot see.
- *Coverage gaps:* only the **platforms** half of the filter modal is used — the **Labels** field is never touched, nor a multi-select of two platforms, nor clearing a filter back to `All platforms` (the pill's disappearance is only ever observed via a reload, never via the UI path); the modal's **Cancel** is never clicked; the chart body is not re-read after filtering, so nothing checks the narrowed data actually rendered — only that the request went out and a pill appeared.
- *Redundancy:* the VMs selection and the `Hosts online` baseline repeat MISC-24 and MISC-25 for a third time in the same file.
- *Efficiency / smells:* `selectChartFilterPlatforms()` opens the field by clicking `getByText('All platforms')` — the placeholder text, which doubles as the "nothing selected" state, so the method can only ever open a *fresh* filter field; re-opening it after a selection would not find that text. Fine for this one case, a trap for the next author. Same unbounded `waitForResponse` as MISC-24/25.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-27 · Premium • Dashboard • historical data collection › each fleet switch empties its own chart dataset, and re-enabling restores both

- **File:** [`playwright/tests/e2e/premium/dashboard/historical-data-collection.spec.ts`](../../tests/e2e/premium/dashboard/historical-data-collection.spec.ts)
- **Grep:** `npx playwright test -g "each fleet switch empties its own chart dataset, and re-enabling restores both"`
- **Project:** premium · **Scope:** a **throwaway fleet the test creates and deletes**
- **Mode:** UI+API · **Isolation:** one standalone test, `test.setTimeout(180_000)` — three fleet-settings saves (two behind a confirmation), four dashboard loads, three waits on `/charts/cve`
- **Preconditions:** deployment-wide historical collection **on for both datasets** — read via `getGlobalHistoricalData` and `test.skip`ped otherwise. That is not just a data guard: the per-fleet checkboxes grey out with a "Disabled globally" tooltip when the matching global switch is off, so there would be nothing to click.
- **Data created / mutated:** a fleet `pw-historical-data-<epoch-ms>-<parallelIndex>` via `POST /fleets`, created **before the first page load** so the fleet dropdown (which reads the team list once at app boot) already lists it; the `parallelIndex` suffix keeps the name unique under `--repeat-each`, since Fleet rejects a duplicate fleet name. Its `features.historical_data.{uptime,vulnerabilities}` are written three times and left back at `{true, true}`. The fleet is then deleted.
- **Cross-link:** the read-only half of this surface is **MISC-24…26**; free's read-only half is **MISC-28 / MISC-29**.

> **⚠️ Blast radius — the reason this spec creates its own fleet.** Ticking a retention checkbox **deletes the history Fleet has already collected** for that scope. Fleet's own confirmation says so: *"Previously collected data will be deleted. This cannot be undone."* A fleet made seconds earlier has nothing to lose; every standing fleet does — and the VMs fleet's 30 days is exactly what MISC-24…26 plot, in parallel with this. Running this by hand against **Workstations, VMs or any fleet the instance keeps** destroys data with no recovery path.
>
> **This is a sanctioned, documented exception to `playwright/CLAUDE.md`'s "do not create or delete teams from test bodies".** That rule exists to protect the gitops-provisioned Workstations fleet, which nothing may delete. A fleet that lives only between the top of this test and its `finally` is a different thing, and it is the only safe subject here. Do not "simplify" it onto a standing fleet.
>
> **The deployment-wide switches on Advanced options are read, never written.** They delete *every* fleet's history at once. The original QA Wolf flow flipped them as setup; this spec does not, and neither should a manual runner.

> **⚠️ Polarity trap.** The checkboxes on a fleet's settings page are **disables** — ticked means "stopped collecting" — while the API field is their opposite (`features.historical_data.uptime: true` means "still collecting"), and the deployment-wide checkboxes on Advanced options are **enables** (see MISC-29). All of them render Fleet's `Checkbox`, whose accessible name is the `name` prop rather than the visible label, so the per-fleet *disable* and the deployment-wide *enable* **both resolve as `disableHostsActive`** while meaning opposite things. Read the helper name and the expected value, never the locator's name.

**Flow**

1. ☐ (No user action) Read `GET /config` → `features.historical_data`.
   - ✅ *(API)* Both `uptime` and `vulnerabilities` are `true`; otherwise the test skips.
2. ☐ Create the throwaway fleet (`POST /fleets`) — before any page load.
3. ☐ Open `/dashboard?fleet_id=<id>` and select the new fleet in the dropdown.
   - ✅ *(API)* `/charts/uptime?…fleet_id=<id>` → 200, waited on **before** any cell assertion, capped at 60 s (`withChartResponse`).
   - ✅ *(UI)* The dropdown reads the fleet's name.
   - ✅ *(UI)* `.data-collection-disabled-state` count **0**.
   - ✅ *(UI)* The first chart cell is visible. A brand-new fleet has no hosts and no history, so this grid is entirely `No data` cells — the grid's **presence**, not its values, is the signal that the dataset is still being collected. (Hence `chartCells`, not `chartCellsWithHosts`.)
4. ☐ Switch the dataset to **Vulnerability exposure**.
   - ✅ *(API)* `/charts/cve?…fleet_id=<id>` → 200 — **10–11 s**, capped at 60 s.
   - ✅ *(UI)* Disabled panel count 0; first chart cell visible.
5. ☐ Open `/settings/fleets/settings?fleet_id=<id>` (`TeamSettingsPage.goto()`).
   - ✅ *(UI)* **Webhook settings** heading visible (the `goto()` anchor).
   - ✅ *(UI)* **Activity & data retention** heading visible.
6. ☐ Tick **Disable hosts online historical reporting** — leaving vulnerabilities alone — dismiss any lingering toasts, and click **Save**.
   - ✅ *(UI)* The checkbox reads `aria-checked="true"` (inside `setHistoricalDataDisabled('hostsOnline', true)`).
   - ✅ *(UI)* The confirmation modal contains `fleet "<fleet name>"` — the proof that a **per-fleet** switch, not the deployment-wide one, is about to be written.
   - ✅ *(UI)* The modal's list items are exactly `['Hosts online']`. Fleet lists only the datasets *this save newly turns off*, so a dataset already disabled is absent — which is what makes step 11's assertion meaningful.
7. ☐ Click **Save and disable**.
   - ✅ *(UI)* The modal is hidden and a success toast `Successfully updated settings.` shows (both inside `confirmDisable()`).
   - ✅ *(API)* The fleet's `features.historical_data` equals `{ uptime: false, vulnerabilities: true }`.
8. ☐ Re-open `/dashboard?fleet_id=<id>`, re-select the fleet, switch the dataset to **Hosts online**.
   - ✅ *(UI)* The **Data collection is disabled** heading is visible.
   - ✅ *(UI)* The panel's sentence contains `to see data for this fleet` — the sentence names the scope the switch applied to, which is how "this fleet" is told apart from "all fleets".
   - ✅ *(UI)* `chartCells` count is **0**.
9. ☐ Switch the dataset to **Vulnerability exposure**.
   - ✅ *(API)* `/charts/cve?…fleet_id=<id>` → 200 (again 10–11 s).
   - ✅ *(UI)* Disabled panel count 0; first chart cell visible — **one dataset collapses while the other keeps charting**, which toggling both at once could never show. This is the case's central assertion.
10. ☐ Switch back to **Hosts online** and click **Turn on** in the disabled panel.
    - ✅ *(UI)* URL matches `/settings/fleets/settings?fleet_id=<id>` — the card's way back routes to the switch that emptied it.
    - ✅ *(UI)* **Activity & data retention** heading visible.
    - ✅ *(UI)* The hosts-online checkbox reads `aria-checked="true"`.
11. ☐ Tick **Disable vulnerability exposure historical reporting**, dismiss toasts, click **Save**.
    - ✅ *(UI)* The confirmation lists exactly `['Vulnerability exposure']` — hosts online is already off, so it is not re-listed.
12. ☐ Click **Save and disable**.
    - ✅ *(UI)* Modal hidden + success toast.
    - ✅ *(API)* `features.historical_data` equals `{ uptime: false, vulnerabilities: false }`.
13. ☐ Re-open `/dashboard?fleet_id=<id>`, re-select the fleet, and step through **both** datasets.
    - ✅ *(UI)* For each: the **Data collection is disabled** heading is visible and `chartCells` count is 0. Neither dataset issues a chart request now — `ChartCard` gates the query on collection being enabled — so both panels render straight from the fleet's config and there is nothing to wait on.
14. ☐ Click **Turn on**, untick **both** checkboxes, dismiss toasts, click **Save**.
    - ✅ *(UI)* **Activity & data retention** heading visible.
    - ✅ *(UI)* Success toast `Successfully updated settings.`
    - ✅ *(UI)* The confirmation modal count is **0** — re-enabling deletes nothing, so Fleet raises no confirmation. A confirmation appearing here would be the product defect.
    - ✅ *(API)* `features.historical_data` equals `{ uptime: true, vulnerabilities: true }`.
15. ☐ Re-open `/dashboard?fleet_id=<id>` — a **fresh page load**, not a dataset switch — and re-select the fleet.
    - ✅ *(API)* `/charts/uptime?…fleet_id=<id>` → 200.
    - ✅ *(UI)* Disabled panel count 0; first chart cell visible.
16. ☐ Switch to **Vulnerability exposure**.
    - ✅ *(API)* `/charts/cve?…fleet_id=<id>` → 200.
    - ✅ *(UI)* Disabled panel count 0; first chart cell visible.
    - *Why a fresh load each time:* `ChartCard` holds every dataset for **five minutes**, so a chart "restored" without reloading could be the copy fetched before anything was turned off.
17. ☐ Delete the throwaway fleet.
    - ✅ *(API)* `DELETE /fleets/<id>` succeeds, retried on a schedule for up to 30 s and tolerating a 404 (`deleteFleetWithRetry` — the QA gateway serves the occasional 502, so one attempt is not enough of a guarantee). It runs in the test's `finally` **and** again in an `afterEach`: Playwright aborts a timed-out test *before* its `finally` runs but still gives hooks their own budget, and nothing else in the suite sweeps a stray fleet — it would sit in every other spec's fleet dropdown until somebody noticed.

**Assessment**
- *Value:* the highest-information test in this area. It proves the two per-fleet retention switches are genuinely independent, that the confirmation names the correct scope and lists only the newly-disabled datasets, that the disabled panel's copy distinguishes fleet from deployment scope, that "Turn on" routes back to the switch responsible, that re-enabling needs no confirmation, and that the chart actually comes back on a cold load rather than from ChartCard's five-minute cache. Each of those is a distinct regression a narrower test would miss.
- *Coverage gaps:* the **deployment-wide** switches are never written by anything (correctly — see the box — but it means the "all fleets" wording of the disabled panel, and the "Disabled globally" greyed-out tooltip on the per-fleet checkboxes, have **zero coverage**); the confirmation's **Cancel** path is never taken, so `confirmDisableCancelButton` is dead code; nothing asserts the data was *actually deleted* (a new fleet has none, which is the price of the safe subject); the **team-admin** role on a fleet's own settings page is untested for these switches (SET-07 covers the webhook on the same page as a team admin); and the throwaway fleet means the case can never observe a chart going from *populated* to empty — only from `No data` grid to panel.
- *Redundancy:* the "card renders with its controls" opening overlaps MISC-24; the dataset switch to Vulnerability exposure overlaps MISC-25 — at ~11 s a call, this spec pays for it three more times.
- *Efficiency / smells:*
  - Everything is one test declaration. A failure anywhere in a 17-step, 180 s flow gives one red line and no attribution — the suite's own CRUD convention (`playwright/CLAUDE.md`) would split this into serial sub-tests, and this is the strongest candidate in the area for it.
  - `withChartResponse` caps its wait at 60 s **because the project leaves `actionTimeout` unset**, which makes page waits unbounded. That cap exists only in this file; `fleet-scoped-cards.spec` has the same waits with no cap (MISC-24).
  - `toast.dismissAll()` before every `save()` is a workaround for toasts overlaying the Save button; it is applied three times and never explained at the call sites.
  - The fleet is deleted in **two** places for one object. Correct and deliberate, but it means the delete helper must stay idempotent (`ignoreMissing: true`) forever.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-28 · Free • Dashboard • historical data collection › the chart card offers one dataset and charts it

- **File:** [`playwright/tests/e2e/free/dashboard/historical-data-collection.spec.ts`](../../tests/e2e/free/dashboard/historical-data-collection.spec.ts)
- **Grep:** `npx playwright test -g "the chart card offers one dataset and charts it"`
- **Project:** free · **Scope:** n/a — free has no fleets, so "all fleets" is the only scope a switch or chart can apply to
- **Mode:** UI · **Isolation:** independent and **read-only by design** (see the box)
- **Preconditions:** `getGlobalHistoricalData().uptime === true`, else the test skips (the card would render its disabled state). The free instance must have hosts checking in — the final assertion needs at least one hour with a non-zero host count.
- **Data created:** none
- **Cross-link:** premium mirror = **MISC-24**

> **Deliberately read-only, and it must stay that way.** Free has no per-fleet scope, so the only switch this tier exposes is the **deployment-wide** one — and turning it off *deletes the history already collected*, for the whole instance, permanently ("This cannot be undone"). There is no throwaway scope to fall back on the way premium has one (MISC-27). Flipping it off and on again would leave the free instance's chart a field of "No data" for 30 days. **Do not tick anything here by hand.**

**Flow**

1. ☐ (No user action) Read `GET /config` → `features.historical_data.uptime`.
   - ✅ *(API)* Skip gate only — `true` or the test skips.
2. ☐ Open `/dashboard` via URL.
   - ✅ *(UI)* First dashboard card visible.
3. ☐ (No user action) Read the card's shape.
   - ✅ *(UI)* `.chart-card__title` reads exactly `Hosts online` — a single dataset means Fleet renders a **heading** where premium renders a dropdown.
   - ✅ *(UI)* The premium dataset dropdown's single-value count is **0**. Together with the line above, this is the tier gate on the `cve` dataset — asserted as an absent control, not as a paywall banner.
   - ✅ *(UI)* The fleet dropdown's trigger count is **0** — free has no fleets at all.
   - ✅ *(UI)* The info icon is visible.
   - ✅ *(UI)* **Configure chart filters** is visible — the filter control is *not* premium-gated.
4. ☐ (No user action) Read the chart body.
   - ✅ *(UI)* `.data-collection-disabled-state` count **0**.
   - ✅ *(UI)* At least one cell **with hosts** is visible (`chartCellsWithHosts`, matching `: N hosts` and excluding `No data`) — a grid of "No data" cells alone cannot tell a working query from a broken one.

**Assessment**
- *Value:* net-new free coverage of a surface QA Wolf only ever ran on premium, and the only place the free/premium *shape* difference on this card is pinned from the free side. The `chartCellsWithHosts` assertion makes it a real data check rather than a render check.
- *Coverage gaps:* the filter modal is present-but-unopened here (MISC-26 covers the premium filter round-trip; free's is untested end to end); the disabled state is never *seen* on free — the case skips rather than asserting it, so free's "Data collection is disabled" panel and its "all fleets" wording have no coverage anywhere; no reload/persistence check.
- *Redundancy:* mirrors MISC-24's controls assertions on the other tier. Per the suite's tier-separation convention this duplication is intended.
- *Efficiency / smells:* **no `waitForResponse` at all** — and that is correct rather than an oversight: the 10–11 s trap is `/charts/cve`, which free does not offer, and `uptime` returns promptly. Worth knowing before somebody "harmonises" this file with the premium one. The skip gate costs a `GET /config` on every run.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-29 · Free • Dashboard • historical data collection › Activity & data retention offers the hosts online switch and not the premium one

- **File:** [`playwright/tests/e2e/free/dashboard/historical-data-collection.spec.ts`](../../tests/e2e/free/dashboard/historical-data-collection.spec.ts)
- **Grep:** `npx playwright test -g "Activity & data retention offers the hosts online switch and not the premium one"`
- **Project:** free · **Scope:** global (Advanced options is a deployment-wide page)
- **Mode:** UI+API · **Isolation:** independent, **read-only** — the checkbox is read, never clicked
- **Preconditions:** free admin session. No skip gate: the expected checkbox state is *derived* from the config rather than assumed, so either value passes.
- **Data created:** none

> **⚠️ Polarity trap — this is the opposite of MISC-27's checkbox.** On Advanced options the checkbox is an **enable**: *"Hosts online historical reporting"*, ticked = **still collecting**. On a fleet's settings page (MISC-27) the checkbox is a **disable**: ticked = **stopped**. Both render Fleet's `Checkbox`, whose accessible name is the `name` prop rather than the visible label, so **both resolve as `disableHostsActive`** while meaning opposite things. Trust the assertion's expected value over the locator's name — and note the POM member here is called `hostsOnlineHistoricalCheckbox` precisely to stop that name leaking into the spec.
>
> **Untick nothing.** This switch is deployment-wide on an instance with no fleet scope; turning it off deletes free's entire uptime history irreversibly (see MISC-28).

**Flow**

1. ☐ (No user action) Read `GET /config` → `features.historical_data` — used as the **expected value**, not as a gate.
2. ☐ Open `/settings/organization/advanced` (`OrganizationAdvancedPage.goto()`).
   - ✅ *(UI)* The **Host lifecycle** heading is visible — the `goto()` anchor; the page has no "Advanced options" title of its own and opens straight into its sections.
   - ✅ *(UI)* The **Activity & data retention** heading is visible.
3. ☐ (No user action) Read the hosts-online switch.
   - ✅ *(UI+API)* Its `aria-checked` equals `String(config.features.historical_data.uptime)` — the UI is compared against the config rather than a fixture, so what this can catch is "the page disagrees with the server", not "the value is right".
   - ✅ *(UI)* Its `aria-disabled` is `false` — free's switch is editable (the spec simply declines to use it).
4. ☐ (No user action) Check the premium switch is absent.
   - ✅ *(UI)* The `disableVulnerabilities` checkbox count is **0**.
   - ✅ *(UI)* The text `Vulnerability exposure historical reporting` count is **0** — premium-gated in Fleet's `ActivityDataRetentionSection`. Two assertions rather than one because the control and its label could regress independently.

**Assessment**
- *Value:* the free-tier gate on the vulnerabilities retention switch, asserted both as an absent control and as absent copy; plus a config-vs-UI consistency check on the surviving switch. Cheap, deterministic, mutates nothing.
- *Coverage gaps:* nothing on **premium's** Advanced options page asserts the mirror (that the vulnerabilities switch *is* present and editable there) — the premium half of this gate is untested; the switch is never toggled anywhere, so the deployment-wide write path, its confirmation modal, and the "Disabled globally" tooltip it puts on the per-fleet checkboxes are wholly uncovered (deliberately — see the box, and the same gap is called out in MISC-27); the page's other Activity & data retention controls (activity expiry) are untouched, and SET-04 in [`10-settings-org-and-integrations.md`](10-settings-org-and-integrations.md) only asserts the Advanced card's fields don't disturb each other.
- *Redundancy:* none — this is the only spec that reads the Advanced options retention section. It shares the page with SET-04, which writes a different field on it.
- *Efficiency / smells:* the second absence assertion uses a raw `organizationAdvanced.page.getByText(...)` in the spec body rather than a POM accessor. The two checkbox members on `OrganizationAdvancedPage` carry the *visible* semantics in their names (`hostsOnlineHistoricalCheckbox`) while their locators carry Fleet's inverted `name` prop — a documented mismatch, and the reason the POM's comment block is longer than the class.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### MISC-30 · Dashboard • activity feed filters › search, type, date and sort narrow the feed to one actor's activities

- **File:** [`playwright/tests/e2e/shared/dashboard/activity-feed.spec.ts`](../../tests/e2e/shared/dashboard/activity-feed.spec.ts)
- **Grep:** `npx playwright test -g "narrow the feed to one actor"`
- **Project:** premium **and** free · **Scopes:** global (premium: the dashboard on **All fleets**, where the feed shows) · **Mode:** UI+API
- **Isolation:** standalone; the actor and anything it left are deleted in an `afterEach`
- **Preconditions:** a throwaway global **maintainer** `QA Feed <ms>` / `qa-test-<ms>-feed@fleetdm.com`, created through the API. Through a **cookie-less** context with its own token it logs in (`apiLogin`, throttle-aware), creates a global report `pw-feed-<ms>` and deletes it — three activities whose actor is that user.
- **Data created:** the user (deleted in the `afterEach`; swept as `qa-test-*`) and the report (deleted by the user; by the `afterEach` if the test died first)

**Flow**

1. ☐ Open the dashboard (premium: **All fleets**); scroll to **Activity**.
2. ☐ Type the user's name into **Search activities by user's name or email**.
   - ✅ *(UI)* Exactly **3** rows, newest first: `deleted the report pw-feed-<ms> globally.`, `created a report … globally.`, `successfully logged in`.
   - ✅ *(UI)* Every row's actor is the user.
3. ☐ Type filter (**All types** → **Added report**).
   - ✅ *(UI)* 1 row, the create. Back to **All types**: 3 rows.
4. ☐ Date filter **Yesterday**.
   - ✅ *(UI)* `No activities match the current criteria`; no rows. **Today**: 3 rows.
5. ☐ **Sort by oldest**.
   - ✅ *(UI)* The three rows in reverse: logged in, created, deleted.

**Assessment**
- *Value:* the feed's four controls, each able to fail: the server-side search, the type and date query parameters, and the sort direction, all over rows the test made (QA Wolf's flow walked ten pages and picked a random actor). On both tiers.
- *Coverage gaps:* searching by **email** (the same prefix match), the type filter's own search box, multi-page results under a filter, and the 7-day / 30-day / 3- / 12-month ranges (identical "start date" arithmetic to Today's, but unexercised).
- *Redundancy:* `expectActivities` reads the feed in many lifecycle specs, but never through a filter.
- *Efficiency / smells:* "Yesterday" / "Today" use the browser's local midnight; a run that crosses it between the user's actions and the filter would fail (rare, and the failure says so). The type dropdown is reached by its `activity-type-select__*` classes (documented on `DashboardPage.selectActivityType`).

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
| Dashboard platform filter + platform views | MISC-22 | OS-card contents; the Missing / Low-disk-space / ABM-issue cards; host-count values; the four platforms with no hosts (ChromeOS, iOS, iPadOS, Android); direct-URL entry to `/dashboard/<platform>` |
| "Hosts enrolled" chart → built-in label link | MISC-23 | **label membership is deliberately not assertable** (the osquery-perf pool answers every built-in label query — the "macOS" label holds mostly Ubuntu hosts); bar counts never read; the inert no-hosts row never checked |
| Historical chart card — read (premium) | MISC-24, MISC-25, MISC-26 | chart values never compared to anything; the **Labels** half of the filter modal; Cancel; switching scope back to All fleets; a fleet-with-no-history negative case |
| Historical chart card — read (free) | MISC-28 | free's filter round-trip; free's "Data collection is disabled" panel (the case skips instead of asserting it) |
| Per-fleet historical-data switches | MISC-27 | the confirmation's Cancel path (`confirmDisableCancelButton` is dead code); team-admin role on the same page; no proof data was actually deleted (a throwaway fleet has none) |
| **Deployment-wide historical-data switches** | MISC-29 (free, presence + state only) | **never written by anything, on either tier** — so the "all fleets" wording of the disabled panel and the "Disabled globally" tooltip on the per-fleet checkboxes have zero coverage. Deliberate: the write is irreversible and instance-wide. Premium's Advanced options page has no counterpart to MISC-29 at all |
| Dashboard cards / software widget / platform tabs | — | `DashboardPage` exposes `cards`, `softwareTable`, `/dashboard/{mac,windows,…}` — **no spec in this area asserts any of it** (only `firstCard` visibility as a `goto` anchor) |
| Free paywall banners (18 pages) | MISC-20 | never asserts the gated feature UI is absent; card heading anchored on the five OS-settings rows only, no URL anchor anywhere; CTA link unchecked |
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

1. ~~Fix the page-1-only delete assertions~~ — done 2026-10-02: both deletes page the list with `locateRow()`.
2. Give MISC-21 a positive control (assert the settings sidebar rendered) at [`paywalls.spec.ts:58-61`](../../tests/e2e/free/paywalls.spec.ts) — it is currently vacuous.
3. ~~Assert `addHost()`'s return value~~ (done 2026-10-02); still open: a **View all hosts** membership check so manual labels are actually verified.
4. Delete MISC-08 (duplicate of MISC-04) and reduce MISC-06/07 to the manual-specific parts — removes one dashboard feed walk and two redundant CRUD round-trips from every premium run.
5. Tighten `PackEditPage.saveButton` to an exact name and swap `page.getByText(packName)).toBeHidden()` for `packsList.packRow(name)).toHaveCount(0)` ([`PackEditPage.ts:38`](../../pages/packs/PackEditPage.ts), [`packs.spec.ts:53`](../../tests/e2e/shared/packs/packs.spec.ts)).

**Bigger bets**

1. **Decide packs' fate.** Packs is deprecated in Fleet, its only meaningful test (MISC-18) is blocked on a 405 scheduling endpoint, and its POM is the suite's most brittle locator cluster (react-select v1 classes that will never gain a `data-testid` — [`PackEditPage.ts:42-48`](../../pages/packs/PackEditPage.ts)). Either cut MISC-14…18 to a single smoke test ("the packs page loads and lists packs") or delete the area and reclaim the maintenance surface. Keeping a full CRUD lifecycle on a deprecated feature, running in **both** tiers, is the worst of the three options.
2. **A role-scoped page fixture.** Ten specs (including MISC-11…13) hand-roll `withStaticUser(browser, key, async page => new SomePage(page))`. A fixture like `asStaticUser('global-observer')` returning pre-built page objects would remove the boilerplate and make it much cheaper to widen role coverage (observer+, technician, ws-observer) — which is the biggest permission gap here. Pair it with API-side label role probes under `tests/api/role-access/premium/`, which currently has none.
3. **Make the paywall sweep two-sided and extend it to the dashboard.** Add a per-row "gated control must be absent" locator to `PAYWALLED_PAGES` so the spec catches a paywall rendering *alongside* the premium feature, and consider folding the 18 tests into one soft-assert loop. Separately, the dashboard itself (cards, Software widget, platform tabs — all modelled in `DashboardPage` and used only as a `goto` anchor) has no functional test anywhere in this area.
