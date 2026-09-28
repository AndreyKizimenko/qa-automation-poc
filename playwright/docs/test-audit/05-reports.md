# Reports / queries — test audit

**Specs covered:** 7 files · **Test declarations:** 22 · **Projects:** premium / free

Fleet's "Reports" are saved queries (`/reports/manage`, `/reports/new`, `/reports/:id`,
`/reports/:id/edit`, `/reports/:id/live`; the REST API still calls them `queries`). The area
splits into a serial CRUD lifecycle spec per tier (create → run live → edit → delete →
activity-feed), plus small single-purpose describes for SQL validation, new-report defaults
and the live-report target picker, and small single-purpose specs for the list filters, the
per-report automations modal, and "Save as new". Premium runs the lifecycle twice via a
`for (const scope of ['All fleets', 'Workstations'])` loop; free mirrors it without the team
dropdown. Every seeded report in the non-lifecycle specs is created and deleted through
`@helpers/api/reports`.

**Standing environment note for this area:** the premium/free QA instances have no real
osquery hosts other than the `liveMacosHost` VMs — the ~300 online hosts are osquery-perf
simulations that ignore the report's SQL and return no rows for a fraction of runs. Nothing
in this area may assert live-query *results*; only the real-host spec
[`shared/hosts/host-live-query.spec.ts`](../../tests/e2e/shared/hosts/host-live-query.spec.ts)
can, and it does. See RPT-02 / RPT-15.

## Contents

| ID | Spec | Test | Mode | Manual? |
|---|---|---|---|---|
| RPT-01 | `premium/reports/reports.spec.ts` | Reports CRUD (All fleets · Workstations) › create | UI+API | ☐ |
| RPT-02 | `premium/reports/reports.spec.ts` | Reports CRUD (All fleets · Workstations) › run live report | UI | ☐ |
| RPT-03 | `premium/reports/reports.spec.ts` | Reports CRUD (All fleets · Workstations) › edit | UI+API | ☐ |
| RPT-04 | `premium/reports/reports.spec.ts` | Reports CRUD (All fleets · Workstations) › delete | UI+API | ☐ |
| RPT-05 | `premium/reports/reports.spec.ts` | Reports CRUD (All fleets · Workstations) › activity feed shows create → edit → delete | UI | ☐ |
| RPT-06 | `premium/reports/reports.spec.ts` | Reports — SQL validation › invalid SQL surfaces a syntax error but Save stays enabled | UI | ☐ |
| RPT-07 | `premium/reports/reports.spec.ts` | Reports — new-report defaults › starts from the default osquery_info query with Save enabled | UI | ☐ |
| RPT-08 | `premium/reports/automations.spec.ts` | Premium • Reports • automations › enabling a report's automations persists | UI+API | ☐ |
| RPT-09 | `premium/reports/list-filters.spec.ts` | Premium • Reports • list filters › search by name narrows the list | UI | ☐ |
| RPT-10 | `premium/reports/list-filters.spec.ts` | Premium • Reports • list filters › platform filter hides reports that do not target the platform | UI | ☐ |
| RPT-11 | `premium/reports/list-filters.spec.ts` | Premium • Reports • list filters › a global report shows as "Inherited" in a team list | UI | ☐ |
| RPT-12 | `premium/reports/save-as-new.spec.ts` | Premium • Reports • Save as new › pre-fills "Copy of \<name\>" and creates a duplicate | UI | ☐ |
| RPT-13 | `premium/reports/save-as-new.spec.ts` | Premium • Reports • Save as new › rejects a name that already exists | UI | ☐ |
| RPT-14 | `free/reports/reports.spec.ts` | Reports CRUD › create | UI+API | ☐ |
| RPT-15 | `free/reports/reports.spec.ts` | Reports CRUD › run live report | UI | ☐ |
| RPT-16 | `free/reports/reports.spec.ts` | Reports CRUD › edit | UI+API | ☐ |
| RPT-17 | `free/reports/reports.spec.ts` | Reports CRUD › delete | UI+API | ☐ |
| RPT-18 | `free/reports/reports.spec.ts` | Reports CRUD › activity feed shows create → edit → delete | UI | ☐ |
| RPT-19 | `free/reports/automations.spec.ts` | Free • Reports • automations › enabling a report's automations persists | UI+API | ☐ |
| RPT-20 | `free/reports/save-as-new.spec.ts` | Free • Reports • Save as new › pre-fills "Copy of \<name\>" and creates a duplicate | UI | ☐ |
| RPT-21 | `free/reports/save-as-new.spec.ts` | Free • Reports • Save as new › rejects a name that already exists | UI | ☐ |
| RPT-22 | `premium/reports/reports.spec.ts` | Reports — live report targets › selecting a fleet targets its hosts and enables Run | UI | ☐ |

`Mode`: **UI** (all validation through the browser), **UI+API** (browser flow, some assertions
via API), **API** (no meaningful UI validation), **PERF** (timing).

**Shared preconditions for every entry below:** the `cleanup-setup` project runs before both
the `premium` and `free` projects and calls `deleteAllQueries`
([`helpers/api/cleanup.ts:9`](../../helpers/api/cleanup.ts)), which deletes **every** saved
query on the instance; `cleanup-teardown` repeats it after. So each run starts with an empty
reports list, and any report a spec leaves behind is swept at the end of the run.

---

### RPT-01 · Reports CRUD (All fleets · Workstations) › create

- **File:** [`playwright/tests/e2e/premium/reports/reports.spec.ts`](../../tests/e2e/premium/reports/reports.spec.ts)
- **Grep:** `npx playwright test --project=premium premium/reports/reports.spec.ts -g "create"`
- **Project:** premium · **Scopes:** All fleets, Workstations (two independent serial describes)
- **Mode:** UI+API · **Isolation:** serial describe, step 1 of 5. Closure state shared with the
  other four sub-tests: `reportName`, `editedName` (derived), and the `created` / `edited` value
  objects. No report id is carried — every later step re-finds the report by name through the
  list. A failure here cascades: Playwright skips the rest of the serial describe.
- **Preconditions:** empty reports list (`cleanup-setup`); `workstationsFleetId` worker fixture
  resolved from the API.
- **Data created:** report `playwright-report-<scope-slug>-<timestamp>` in the selected scope —
  renamed by RPT-03, deleted by RPT-04.

**Flow**

1. ☐ Open the **dashboard** (via URL `/dashboard`), then click **Reports** in the navbar.
   - ✅ *(UI)* Dashboard's first card is visible (`dashboard.goto()` anchor).
   - ✅ *(UI)* URL becomes `/reports/manage` (`navbar.goToReports()`).
2. ☐ Select the scope in the team dropdown (**All fleets** / **Workstations**).
   - ✅ *(UI)* The dropdown's current value reads the selected scope — idempotent, so on a fresh
     load already showing the scope no click happens and nothing is asserted.
3. ☐ Click **Add report**.
   - ✅ *(UI)* URL matches `/reports/new`.
4. ☐ Replace the editor's SQL with `SELECT 1 AS one;` (written straight into Ace's buffer via
   `setValue`, not typed — see [`ReportEditPage.ts:186`](../../pages/reports/ReportEditPage.ts)).
   - ✅ *(UI)* Editor content text equals the new SQL exactly.
5. ☐ Click **Save** → the **Save report** modal opens; fill **Name**, **Description**; set
   **Interval** to *Every 30 minutes* via the frequency dropdown; tick **Observers can run**;
   click **Save** in the modal.
   - ✅ *(UI)* "Save report" modal is visible.
   - ✅ *(UI)* Interval dropdown label reads *Every 30 minutes* after selection (only asserted
     when the label had to change).
   - ✅ *(UI)* Success toast **"Report created."**
   - ✅ *(UI)* URL settles on `/reports/:id`; the id is parsed and the helper throws if it can't
     be. **The returned id is discarded by the spec.**
6. ☐ *(API)* `GET /activities` contains `created_saved_query` whose `details.query_name` is the
   new name.
   - ✅ *(API)* Activity exists (pages back up to 5 × 100 entries) **and** its `actor_email`
     equals `FLEET_ADMIN_EMAIL` — `assertActivity`.
7. ☐ On `/reports/:id`, read the report name + description.
   - ✅ *(UI)* `<h1>` inside `.main-content.query-details-page` has exactly the submitted name.
   - ✅ *(UI)* `.query-details-page__query-description` has exactly the submitted description.
8. ☐ Click **Show query**, read the SQL in the modal, click **Close**.
   - ✅ *(UI)* Query modal opens, its SQL contains `SELECT 1 AS one;`, and the modal is hidden
     again after Close.
9. ☐ Click **Reports** in the navbar, then navigate directly to `/reports/manage?fleet_id=…`
   (deliberate hard reload — see the comment at
   [`reports.spec.ts:58`](../../tests/e2e/premium/reports/reports.spec.ts); the React-router
   transition back from `/reports/:id` doesn't re-fetch when `fleet_id` is unchanged), re-select
   the scope, and type the report name into **Search by name**.
   - ✅ *(UI)* URL is `/reports/manage` after the navbar click.
   - ✅ *(UI)* A row containing the report name is visible.
   - ✅ *(UI)* That row's **Interval** cell (resolved by matching the visible column header) reads
     exactly *Every 30 minutes*.

**Assessment**
- *Value:* catches a broken new-report save path end-to-end — modal fields persisting, the
  redirect to the details page, the interval round-tripping into the list column, and the
  activity record being written with the right scope.
- *Coverage gaps:* **Observers can run** and the modal's platform/target fields are set but never
  re-read after save (nothing re-opens the form). No check that the report actually lands in the
  *selected* scope beyond the activity suffix (a Workstations report showing under All fleets
  wouldn't be caught here). No duplicate-name-on-create check. No cancel/discard path. The search
  step asserts presence, never absence of non-matching rows, so it doesn't prove search filters.
- *Redundancy:* mirrors RPT-14 (free) almost line-for-line — the only differences are the scope
  loop, the dropdown call, and `fleetIdFor(...)`. The `created_saved_query` API assertion overlaps
  RPT-05, which asserts the same event through the dashboard feed.
- *Efficiency / smells:*
  - `saveNew()` returns the new report's id and the spec throws it away
    ([`reports.spec.ts:52`](../../tests/e2e/premium/reports/reports.spec.ts)); keeping it in the
    closure would let RPT-02/03 use `reportDetails.goto(id)` instead of list→search→click.
  - Step 9 clicks the navbar *and* then hard-navigates to the same page — one wasted page load,
    kept only to exercise the navbar link that step 1 already exercised.
  - `search.fill()` with no wait for the filtered fetch; the assertion passes on the unfiltered
    list too, so it isn't testing search.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### RPT-02 · Reports CRUD (All fleets · Workstations) › run live report

- **File:** [`playwright/tests/e2e/premium/reports/reports.spec.ts`](../../tests/e2e/premium/reports/reports.spec.ts)
- **Grep:** `npx playwright test --project=premium premium/reports/reports.spec.ts -g "run live report"`
- **Project:** premium · **Scopes:** All fleets, Workstations
- **Mode:** UI · **Isolation:** serial describe, step 2 of 5 — consumes `reportName` from RPT-01.
- **Preconditions:** RPT-01 created the report.
- **Data created:** none (no campaign is started).

**Flow**

1. ☐ Navigate to `/reports/manage?fleet_id=…` via URL, re-select the scope.
   - ✅ *(UI)* A row or the empty state is visible (`goto()` anchor).
2. ☐ Click the report's name link in the list.
   - ✅ *(UI)* URL matches `/reports/:id`.
3. ☐ Click **Edit report**.
   - ✅ *(UI)* URL matches `/reports/:id/edit`.
4. ☐ Click **Live report**.
   - ✅ *(UI)* URL matches `/reports/:id/live`.
5. ☐ Stop there.
   - ✅ *(UI)* The `Select targets` `<h1>` is visible (`reportLive.waitForReady()`).

**Assessment**
- *Value:* proves the list → details → edit → live-report *navigation chain* and that the target
  picker renders. That is genuinely all it can prove on this instance.
- ⚠️ **The title over-promises: the test never clicks Run.** No targets are selected, no campaign
  is created, no results/heading/`% responded` assertion is made. It is a route smoke test named
  after a flow it doesn't perform. It does *not* pretend to validate query results — good — but a
  reader scanning titles will assume live-run coverage exists here when it doesn't.
- *Coverage gaps:* everything past the picker: selecting a host/label/fleet target, **Run**,
  the *Running report* → *Report finished* heading transition, the `N host targeted / P% responded`
  summary, **Stop** / **Run again** / **Close**, and the Errors tab. Against simulated hosts only
  the plumbing is assertable (finished heading + responded count, with `resultsRows` and
  `noResultsState` treated as alternatives, exactly as
  [`ReportLivePage.ts:14`](../../pages/reports/ReportLivePage.ts) documents) — results content is
  off-limits because the simulations ignore the SQL and return no rows ~20% of the time.
- *Redundancy:* identical to RPT-15 (free). The real end-to-end live run — target the macOS VM,
  Run, assert `1 host targeted` / `100% responded` / one result row containing `bar` — already
  exists in
  [`shared/hosts/host-live-query.spec.ts`](../../tests/e2e/shared/hosts/host-live-query.spec.ts),
  which runs in *both* projects. So the only unique thing RPT-02/RPT-15 add over that spec is the
  details-page entry point.
- *Efficiency / smells:* four page loads for one `toBeVisible()`. Steps 1–3 exist only to reach
  `/reports/:id/live`, a route the test could reach directly; and RPT-03 repeats steps 1–3 verbatim
  in the very next sub-test.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### RPT-03 · Reports CRUD (All fleets · Workstations) › edit

- **File:** [`playwright/tests/e2e/premium/reports/reports.spec.ts`](../../tests/e2e/premium/reports/reports.spec.ts)
- **Grep:** `npx playwright test --project=premium premium/reports/reports.spec.ts -g "edit"`
- **Project:** premium · **Scopes:** All fleets, Workstations
- **Mode:** UI+API · **Isolation:** serial describe, step 3 of 5 — reads `reportName`, writes the
  live report over to `editedName`; RPT-04 and RPT-05 depend on that rename having happened.
- **Preconditions:** RPT-01 created the report.
- **Data created:** none new; the existing report is renamed to `<name>-edited`.

**Flow**

1. ☐ Navigate to `/reports/manage?fleet_id=…` via URL, re-select the scope, click the report's
   name link, click **Edit report**.
   - ✅ *(UI)* Row-or-empty anchor, `/reports/:id`, then `/reports/:id/edit`.
   - ✅ *(UI)* The inline **Name** input holds the original name (the one explicit "the editor
     loaded the right report" check in the area).
2. ☐ Fill the whole form (`fillAll`): SQL → `SELECT version FROM osquery_info;`, **Interval** →
   *Every 15 minutes*, untick **Observers can run**, set the platform checkbox set to exactly
   **Windows + Linux** (unticking macOS and ChromeOS), then **Name** and **Description**.
   Then a second repair pass re-applies any field React clobbered mid-fill.
   - ✅ *(UI)* Editor text equals the new SQL after each `setSql`.
   - ✅ *(UI)* Final pre-save asserts on the form: Name value, Description value, Interval label,
     **Observers can run** unchecked, checked-platform set deep-equals `['Windows','Linux']`,
     editor text contains the new SQL.
3. ☐ Click **Save** → confirm in the **Save changes** modal.
   - ✅ *(UI)* "Save changes" modal is visible.
   - ✅ *(UI)* Success toast **"Report updated."**
   - ✅ *(UI)* URL settles back on `/reports/:id`.
4. ☐ *(API)* `GET /activities` contains `edited_saved_query` with `details.query_name === <edited name>`.
   - ✅ *(API)* Activity present and attributed to the admin — `assertActivity`.
5. ☐ On the details page, read name + description; click **Show query**, read SQL, **Close**.
   - ✅ *(UI)* `<h1>` equals the edited name; description paragraph equals the edited description.
   - ✅ *(UI)* Query modal SQL contains `SELECT version FROM osquery_info;`.
6. ☐ Click **Reports** in the navbar, re-select the scope, search the edited name.
   - ✅ *(UI)* URL `/reports/manage`; a row with the edited name is visible; its **Interval** cell
     reads exactly *Every 15 minutes*.

**Assessment**
- *Value:* the densest test in the area — rename, description, SQL, and interval all round-trip
  through a real save, and the activity carries the new name.
- *Coverage gaps:* **platforms** and **Observers can run** are set and asserted *in the form
  before saving*, then never re-read from a fresh load — so a persistence bug in either field
  passes. `ReportEditPage.expectValues()`
  ([`ReportEditPage.ts:375`](../../pages/reports/ReportEditPage.ts)) does exactly this check and
  **is called by no spec in the repo**. No negative path (rename to an existing name, discard
  changes, leave the page with unsaved edits).
- *Redundancy:* RPT-16 (free) is the same test minus the scope; RPT-05 re-asserts the
  `edited_saved_query` event through the UI feed.
- *Efficiency / smells:*
  - Step 6 clicks the navbar but — unlike RPT-01 step 9 and unlike free RPT-16 — does **not**
    hard-navigate afterwards ([`reports.spec.ts:98`](../../tests/e2e/premium/reports/reports.spec.ts)).
    The stale-list problem RPT-01's comment documents applies here too and bites harder (a cached
    list still holds the *old* name). Inconsistent with both siblings; a flake candidate.
  - `fillAll`'s repair pass is a documented flake workaround
    ([`ReportEditPage.ts:325`](../../pages/reports/ReportEditPage.ts)) but it also silently masks a
    real "field resets itself" product bug — the drift is re-applied and *then* asserted.
  - Steps 1's list→details→edit walk duplicates RPT-02 step 1–3 exactly.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### RPT-04 · Reports CRUD (All fleets · Workstations) › delete

- **File:** [`playwright/tests/e2e/premium/reports/reports.spec.ts`](../../tests/e2e/premium/reports/reports.spec.ts)
- **Grep:** `npx playwright test --project=premium premium/reports/reports.spec.ts -g "delete"`
- **Project:** premium · **Scopes:** All fleets, Workstations
- **Mode:** UI+API · **Isolation:** serial describe, step 4 of 5 — consumes `editedName`; this is
  the lifecycle's cleanup step.
- **Preconditions:** RPT-01 + RPT-03 ran.
- **Data created:** none; removes the report.

**Flow**

1. ☐ Navigate to `/reports/manage?fleet_id=…` via URL, re-select the scope.
2. ☐ Type the report name into **Search by name**, tick the row's checkbox, click **Delete** in
   the bulk-action bar, confirm **Delete** in the **Delete reports** modal.
   - ✅ *(UI)* The row is visible before selection.
   - ✅ *(UI)* "Delete reports" modal opens, then is hidden after confirming.
3. ☐ Look at the (still name-filtered) list.
   - ✅ *(UI)* A row **or** the empty state is visible — this can effectively never fail; it is a
     settle-wait dressed as an assertion.
   - ✅ *(UI)* Zero rows match the report name.
4. ☐ *(API)* `GET /activities` contains `deleted_saved_query` with the report's name.
   - ✅ *(API)* Present and admin-attributed — `assertActivity`.

**Assessment**
- *Value:* covers the bulk-select delete path (the only delete affordance on the list) plus the
  confirmation modal, and proves the row really goes away.
- *Coverage gaps:* no check that the row count/empty state is what you'd expect, no "Cancel in the
  modal leaves the report alone" path, no multi-row bulk delete, and no check that
  `/reports/:id` 404s afterwards.
- *Redundancy:* RPT-17 (free) is identical; RPT-05 re-asserts the delete activity via UI.
- *Efficiency / smells:* `bulkDeleteButton` is a page-wide `getByRole('button', {name:'Delete'})`
  ([`ReportsListPage.ts:57`](../../pages/reports/ReportsListPage.ts)) — it only stays unambiguous
  because the modal isn't open yet; any future page-level Delete button breaks it. The
  `rowOrEmpty()` assertion in step 3 should be dropped or replaced with something falsifiable.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### RPT-05 · Reports CRUD (All fleets · Workstations) › activity feed shows create → edit → delete

- **File:** [`playwright/tests/e2e/premium/reports/reports.spec.ts`](../../tests/e2e/premium/reports/reports.spec.ts)
- **Grep:** `npx playwright test --project=premium premium/reports/reports.spec.ts -g "activity feed shows"`
- **Project:** premium · **Scopes:** All fleets, Workstations
- **Mode:** UI · **Isolation:** serial describe, step 5 of 5 — consumes `reportName` + `editedName`.
- **Preconditions:** RPT-01/03/04 all ran in this describe.
- **Data created:** none.

**Flow**

1. ☐ Open the **dashboard** via URL.
   - ✅ *(UI)* First dashboard card visible.
2. ☐ Read the **Activity** feed, paging with **Next** as needed.
   - ✅ *(UI)* A feed row reads `created a report <name> globally.` (All fleets) /
     `… on the Workstations fleet.` (Workstations).
   - ✅ *(UI)* A row reads `edited the report <edited name><scope suffix>.`
   - ✅ *(UI)* A row reads `deleted the report <edited name><scope suffix>.`
   - Mechanics: walks up to 15 feed pages (8 rows each), and if a matcher is still missing reloads
     the dashboard and re-walks, up to 10 attempts; matched rows carry over between attempts.
     Copy regexes come from [`helpers/activity-copy.ts:113`](../../helpers/activity-copy.ts) and are
     independently pinned to Fleet's source by `tests/api/activity-copy.spec.ts`.

**Assessment**
- *Value:* the only place the *rendered* activity copy for reports — verb + name + scope suffix —
  is checked in a browser. That copy is scope-sensitive and easy to regress.
- *Coverage gaps:* no assertion on ordering, actor name, timestamp, or the row's expandable
  detail; no count, so a duplicated activity passes.
- *Redundancy:* **high.** All three events were already asserted via `assertActivity` in
  RPT-01/03/04. The API versions add only the `actor_email` check; this one adds only the rendered
  string. One of the two layers is enough per event — the honest split is "keep the UI copy check
  here, drop the three API calls" or vice-versa.
- *Efficiency / smells:* the reload-and-rewalk loop (up to 10 reloads × 15 pages) is the area's
  slowest single assertion bundle, and it runs twice on premium (once per scope) for what is
  really one copy contract.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### RPT-06 · Reports — SQL validation › invalid SQL surfaces a syntax error but Save stays enabled

- **File:** [`playwright/tests/e2e/premium/reports/reports.spec.ts`](../../tests/e2e/premium/reports/reports.spec.ts)
- **Grep:** `npx playwright test --project=premium premium/reports/reports.spec.ts -g "invalid SQL surfaces"`
- **Project:** premium · **Scopes:** n/a (outside the scope loop)
- **Mode:** UI · **Isolation:** fully independent; nothing persisted.
- **Preconditions:** none.
- **Data created:** none.

**Flow**

1. ☐ Navigate to `/reports/new` **via URL**.
   - ✅ *(UI)* The SQL editor content is visible (`gotoNew()` anchor).
2. ☐ Replace the SQL with `SELECT * FRM osquery_info;`.
   - ✅ *(UI)* Editor text equals it.
   - ✅ *(UI)* Inline message **"Syntax error. Please review before saving."** is visible.
   - ✅ *(UI)* The **Save** button is still enabled (Fleet deliberately allows saving broken SQL).

**Assessment**
- *Value:* pins an intentional product behaviour that a well-meaning "validate before save" change
  would break.
- *Coverage gaps:* doesn't actually save the invalid report, so "Fleet lets you persist it" is
  asserted only indirectly via the button state. No check that valid SQL clears the message.
- *Redundancy:* same assertion pair as
  [`premium/policies/sql-validation.spec.ts`](../../tests/e2e/premium/policies/sql-validation.spec.ts)
  › "a syntax error is surfaced but Save stays enabled" and its free twin — same shared `SQLEditor`
  component, four copies across the suite. No free *reports* counterpart exists (see gaps).
- *Efficiency / smells:* none — this is the right shape for a read-only editor check.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### RPT-07 · Reports — new-report defaults › starts from the default osquery_info query with Save enabled

- **File:** [`playwright/tests/e2e/premium/reports/reports.spec.ts`](../../tests/e2e/premium/reports/reports.spec.ts)
- **Grep:** `npx playwright test --project=premium premium/reports/reports.spec.ts -g "starts from the default"`
- **Project:** premium · **Scopes:** n/a
- **Mode:** UI · **Isolation:** fully independent; nothing persisted.
- **Preconditions:** none.
- **Data created:** none.

**Flow**

1. ☐ Navigate to `/reports/new` **via URL**.
   - ✅ *(UI)* Editor content visible.
2. ☐ Read the editor without touching it.
   - ✅ *(UI)* Text contains `SELECT * FROM osquery_info`.
   - ✅ *(UI)* **Save** is enabled on an untouched form.

**Assessment**
- *Value:* one-liner guard on Fleet's `DEFAULT_QUERY` and the ready-to-save initial state.
- *Coverage gaps:* nothing else about the new-report form's defaults is checked — the interval
  default, default platform targets, or the absence of the inline Name field on `/reports/new`.
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

### RPT-08 · Premium • Reports • automations › enabling a report's automations persists

- **File:** [`playwright/tests/e2e/premium/reports/automations.spec.ts`](../../tests/e2e/premium/reports/automations.spec.ts)
- **Grep:** `npx playwright test --project=premium premium/reports/automations.spec.ts`
- **Project:** premium · **Scopes:** All fleets only
- **Mode:** UI+API · **Isolation:** self-contained; `beforeEach` seeds, `afterEach` deletes.
- **Preconditions:** `beforeEach` *(API)* `POST /queries` creates a global report
  `pw-report-auto-<timestamp>-<rand>` with SQL `SELECT 1;` and empty description.
- **Data created:** that report — `afterEach` deletes every global report whose name contains the
  marker (`deleteReportsMatching`).

**Flow**

1. ☐ Navigate to `/reports/manage` **via URL**, select **All fleets**.
   - ✅ *(UI)* Row-or-empty anchor.
2. ☐ Click **Automations**.
   - ✅ *(UI)* The **Manage automations** modal is visible.
3. ☐ Tick the checkbox whose accessible name is the seeded report's name.
4. ☐ Click **Save** in the modal.
   - ✅ *(UI)* The modal is hidden.
   - ✅ *(UI)* Success toast **"Successfully updated report automations."**
5. ☐ *(API)* `GET /queries` and find the report by id.
   - ✅ *(API)* `automations_enabled === true`.

**Assessment**
- *Value:* covers the whole per-report automations toggle path and, uniquely in this area, checks a
  field that the list UI doesn't display.
- *Coverage gaps:* the *disable* direction is never exercised even though `setReportAutomation`
  supports it. Nothing checks the report's own detail/edit view reflects the state, nor that
  automations actually fire to a log destination (out of scope for e2e). The modal's other reports
  aren't asserted untouched, so a "Save enables everything" bug would pass.
- *Redundancy:* RPT-19 (free) is byte-for-byte the same test apart from the describe title and the
  missing `teamDropdown.select` line — and `select()` is a documented no-op on free, so the two
  files could literally be one shared spec.
- *Efficiency / smells:*
  - Step 5's persistence check is *(API)* where a UI check exists: re-opening the modal and
    asserting the checkbox is still ticked would prove the same thing through the surface a user
    sees. Justifiable only if you consider `automations_enabled` an API contract.
  - `findReportById` lists **global** reports only
    ([`helpers/api/reports.ts:69`](../../helpers/api/reports.ts)), so this test shape cannot be
    reused for a team-scoped report without a `fleetId` argument.
  - Direct-URL entry rather than dashboard → navbar; minor deviation from the e2e convention.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### RPT-09 · Premium • Reports • list filters › search by name narrows the list

- **File:** [`playwright/tests/e2e/premium/reports/list-filters.spec.ts`](../../tests/e2e/premium/reports/list-filters.spec.ts)
- **Grep:** `npx playwright test --project=premium premium/reports/list-filters.spec.ts -g "search by name"`
- **Project:** premium · **Scopes:** All fleets
- **Mode:** UI · **Isolation:** self-contained; seeds two reports, `finally`-deletes by marker.
- **Preconditions:** *(API)* two global reports `<marker>-alpha` and `<marker>-beta`.
- **Data created:** both reports, removed in `finally`.

**Flow**

1. ☐ Navigate to `/reports/manage` **via URL**, select **All fleets**.
2. ☐ Type `<marker>-alpha` into **Search by name**.
   - ✅ *(UI)* The `-alpha` row is visible.
   - ✅ *(UI)* Zero rows match `-beta` — the negative half RPT-01/03 lack, and what makes this a
     real search test.

**Assessment**
- *Value:* the only genuine proof that the reports-list name search filters rather than merely
  renders.
- *Coverage gaps:* no partial/substring search, no case-insensitivity check, no "clear the search
  restores both rows", no empty-state copy when nothing matches.
- *Redundancy:* the presence half overlaps the search steps in RPT-01/RPT-03/RPT-14/RPT-16, but
  the exclusion assertion is unique. No free counterpart.
- *Efficiency / smells:* `searchByName` is a bare `fill()` with no settle wait; the `-beta`
  `toHaveCount(0)` assertion could pass *before* the unfiltered list has rendered at all, making
  this a possible false-pass. Anchoring on the `-alpha` row first (as written) mitigates but
  doesn't remove it, since `-alpha` is visible pre-filter too.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### RPT-10 · Premium • Reports • list filters › platform filter hides reports that do not target the platform

- **File:** [`playwright/tests/e2e/premium/reports/list-filters.spec.ts`](../../tests/e2e/premium/reports/list-filters.spec.ts)
- **Grep:** `npx playwright test --project=premium premium/reports/list-filters.spec.ts -g "platform filter hides"`
- **Project:** premium · **Scopes:** All fleets
- **Mode:** UI · **Isolation:** self-contained; `finally`-deletes by marker.
- **Preconditions:** *(API)* two global reports — `<marker>-mac` with `platform: 'darwin'` and
  `<marker>-win` with `platform: 'windows'`.
- **Data created:** both, removed in `finally`.

**Flow**

1. ☐ Navigate to `/reports/manage` **via URL**, select **All fleets**, search the shared marker.
   - ✅ *(UI)* Both the `-mac` and `-win` rows are visible (baseline before filtering).
2. ☐ Open the **platform** dropdown and pick **macOS**.
   - ✅ *(UI)* The `macOS` option is visible before it is clicked.
   - ✅ *(UI)* Row-or-empty re-renders after the pick (`selectPlatform` anchor).
   - ✅ *(UI)* URL now contains `platform=darwin`.
   - ✅ *(UI)* The `-mac` row survives; zero rows match `-win`.

**Assessment**
- *Value:* strongest filter test in the area — has a real before/after and both a survivor and a
  casualty, so it can't false-pass on an empty table.
- *Coverage gaps:* only the macOS option is exercised; **All platforms** (reset), Windows, Linux,
  ChromeOS untested. A report targeting *all* platforms is never checked to survive every filter.
  The list's **Platform** column contents are never asserted.
- *Redundancy:* none within e2e. `tests/loadtest/reports.spec.ts` uses the URL-param variant
  (`applyPlatformFilter`) purely for timing, and `tests/api/gitops-verify/reports.spec.ts` asserts
  the `platform` field at the API level.
- *Efficiency / smells:* the platform dropdown is reached through a raw BEM class
  (`.queries-table__platform-dropdown .react-select__control`,
  [`ReportsListPage.ts:52`](../../pages/reports/ReportsListPage.ts)) — documented as unavoidable
  (react-select v5 exposes no role) and correctly confined to the page object.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### RPT-11 · Premium • Reports • list filters › a global report shows as "Inherited" in a team list

- **File:** [`playwright/tests/e2e/premium/reports/list-filters.spec.ts`](../../tests/e2e/premium/reports/list-filters.spec.ts)
- **Grep:** `npx playwright test --project=premium premium/reports/list-filters.spec.ts -g "Inherited"`
- **Project:** premium · **Scopes:** Workstations (viewing a global report)
- **Mode:** UI · **Isolation:** self-contained; `finally`-deletes by marker.
- **Preconditions:** *(API)* one **global** report `<marker>`; `workstationsFleetId` worker fixture.
- **Data created:** that report, removed in `finally`.

**Flow**

1. ☐ Navigate to `/reports/manage?fleet_id=<workstations>` **via URL**, select **Workstations**.
2. ☐ Search the marker.
   - ✅ *(UI)* A row with the marker name is visible in the team's list.
   - ✅ *(UI)* That row contains the text **Inherited**.

**Assessment**
- *Value:* the only coverage of global-report inheritance into a team list — a premium-only
  behaviour with a real regression history in Fleet's `merge_inherited` handling.
- *Coverage gaps:* the converse isn't tested (a Workstations-owned report must *not* appear
  in another team's list, nor carry the badge). No check that an inherited report is read-only /
  not deletable from the team view.
- *Redundancy:* none.
- *Efficiency / smells:* `row.getByText('Inherited')` is scoped to the row, which is right. Nothing
  else to flag.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### RPT-12 · Premium • Reports • Save as new › pre-fills "Copy of \<name\>" and creates a duplicate

- **File:** [`playwright/tests/e2e/premium/reports/save-as-new.spec.ts`](../../tests/e2e/premium/reports/save-as-new.spec.ts)
- **Grep:** `npx playwright test --project=premium premium/reports/save-as-new.spec.ts -g "pre-fills"`
- **Project:** premium · **Scopes:** global (report seeded without a team)
- **Mode:** UI · **Isolation:** self-contained; `beforeEach` seeds, `afterEach` deletes the base
  report **and** any `Copy of …` it spawned (substring match on the base name).
- **Preconditions:** *(API)* `POST /queries` creates global `playwright-saveasnew-<ts>-<rand>`.
- **Data created:** the base report + one duplicate; both removed in `afterEach`.

**Flow**

1. ☐ Navigate to `/reports/<id>/edit` **via URL**.
   - ✅ *(UI)* Name input and editor content are both visible (`gotoEdit()` anchors).
2. ☐ Click **Save as new**.
   - ✅ *(UI)* The **Save as new** modal is visible.
   - ✅ *(UI)* Its name field is pre-filled with exactly `Copy of <base name>`.
3. ☐ Click **Save** in the modal without editing the name.
   - ✅ *(UI)* Success toast **"Successfully added report Copy of \<base name\>."**
   - ✅ *(UI)* URL matches `/reports/<digits>` (i.e. Fleet navigated to *a* report).

**Assessment**
- *Value:* covers the duplicate-a-report flow including the exact pre-filled name and the success
  copy.
- *Coverage gaps:* the URL assertion doesn't prove the id *changed* — the base report's own id
  matches `/reports/\d+` too, so a bug where Save-as-new silently overwrote the original and stayed
  put would pass. Nothing asserts the copy exists in the list or that its SQL/description/interval
  were carried over. The premium-only **Fleet** dropdown inside the modal — the whole reason a
  separate premium copy of this spec exists, per its own docstring — is never touched.
- *Redundancy:* RPT-20 (free) is identical source. Given the Fleet dropdown is untested, the
  premium file currently adds **zero** premium-specific coverage over the free one.
- *Efficiency / smells:* `submitSaveAsNew()` contains no wait or assertion of its own
  ([`ReportEditPage.ts:259`](../../pages/reports/ReportEditPage.ts)), so all synchronisation rests
  on the toast matcher — fine here, but note success toasts auto-dismiss after 5s.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### RPT-13 · Premium • Reports • Save as new › rejects a name that already exists

- **File:** [`playwright/tests/e2e/premium/reports/save-as-new.spec.ts`](../../tests/e2e/premium/reports/save-as-new.spec.ts)
- **Grep:** `npx playwright test --project=premium premium/reports/save-as-new.spec.ts -g "rejects a name"`
- **Project:** premium · **Scopes:** global
- **Mode:** UI · **Isolation:** self-contained (same `beforeEach`/`afterEach` as RPT-12).
- **Preconditions:** *(API)* global report `playwright-saveasnew-<ts>-<rand>` exists.
- **Data created:** none beyond the seeded base report.

**Flow**

1. ☐ Navigate to `/reports/<id>/edit` **via URL**.
2. ☐ Click **Save as new**, then overwrite the pre-filled name with the base report's own name.
   - ✅ *(UI)* Modal visible (from `openSaveAsNew`; its return value is discarded here).
3. ☐ Click **Save** in the modal.
   - ✅ *(UI)* Error toast containing `A report called "<base name>" already exists`.

**Assessment**
- *Value:* the area's only duplicate-name negative path, and it pins Fleet's error copy.
- *Coverage gaps:* doesn't assert the modal stays open, that no second report was created, or that
  the URL didn't change. The equivalent negative path on **create** (RPT-01) and on **rename**
  (RPT-03) is untested.
- *Redundancy:* RPT-21 (free) is identical source.
- *Efficiency / smells:* the failing request is a 4xx, which the auto `pageHealth` fixture
  deliberately ignores — no opt-out needed, correct as written.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### RPT-14 · Reports CRUD › create *(free)*

- **File:** [`playwright/tests/e2e/free/reports/reports.spec.ts`](../../tests/e2e/free/reports/reports.spec.ts)
- **Grep:** `npx playwright test --project=free free/reports/reports.spec.ts -g "create"`
- **Project:** free · **Scopes:** n/a (no team dropdown on free)
- **Mode:** UI+API · **Isolation:** serial describe, step 1 of 5; shares `reportName` /
  `editedName` / `created` / `edited` with the other four via closure.
- **Preconditions:** empty reports list (`cleanup-setup` also gates the free project).
- **Data created:** report `playwright-report-<timestamp>` — renamed by RPT-16, deleted by RPT-17.

**Flow**

1. ☐ Open the **dashboard** via URL, click **Reports** in the navbar.
   - ✅ *(UI)* Dashboard first card; URL `/reports/manage`.
2. ☐ Click **Add report** → URL `/reports/new`.
3. ☐ Set the SQL to `SELECT 1 AS one;` → ✅ *(UI)* editor text equals it.
4. ☐ Click **Save** → fill **Name** / **Description**, **Interval** *Every 30 minutes*, tick
   **Observers can run** → click **Save**.
   - ✅ *(UI)* "Save report" modal visible; interval label updated; toast **"Report created."**;
     URL settles on `/reports/:id` (id parsed, then discarded).
5. ☐ *(API)* ✅ `created_saved_query` activity with the report's name, admin-attributed.
6. ☐ On `/reports/:id`: ✅ *(UI)* `<h1>` = name, description paragraph = description; **Show
   query** modal SQL contains `SELECT 1 AS one;`, modal closes.
7. ☐ Click **Reports** in the navbar, then hard-navigate to `/reports/manage`, search the name.
   - ✅ *(UI)* Row visible; **Interval** cell reads exactly *Every 30 minutes*.

**Assessment**
- *Value:* same as RPT-01, on the tier where reports are un-paywalled — a smoke test that the free
  editor + save modal work without any team plumbing.
- *Coverage gaps:* identical to RPT-01's (observers-can-run/platform persistence, duplicate name,
  cancel path). Additionally free never gets the SQL-validation or new-report-defaults checks
  (RPT-06/RPT-07 are premium-only files).
- *Redundancy:* **direct duplicate of RPT-01** modulo the scope loop and `fleetIdFor`. Nothing about
  report creation is tier-dependent, so this pair is the strongest merge-to-`shared` candidate in
  the area — the blocker is only that premium wants the two-scope loop.
- *Efficiency / smells:* same discarded `saveNew()` id; same navbar-click-then-hard-goto double
  navigation ([`free/reports/reports.spec.ts:51`](../../tests/e2e/free/reports/reports.spec.ts)).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### RPT-15 · Reports CRUD › run live report *(free)*

- **File:** [`playwright/tests/e2e/free/reports/reports.spec.ts`](../../tests/e2e/free/reports/reports.spec.ts)
- **Grep:** `npx playwright test --project=free free/reports/reports.spec.ts -g "run live report"`
- **Project:** free · **Mode:** UI · **Isolation:** serial describe, step 2 of 5 — consumes
  `reportName`.
- **Preconditions:** RPT-14 created the report.
- **Data created:** none.

**Flow**

1. ☐ Navigate to `/reports/manage` via URL → ✅ *(UI)* row-or-empty anchor.
2. ☐ Click the report's name link → ✅ *(UI)* URL `/reports/:id`.
3. ☐ Click **Edit report** → ✅ *(UI)* URL `/reports/:id/edit`.
4. ☐ Click **Live report** → ✅ *(UI)* URL `/reports/:id/live`.
5. ☐ ✅ *(UI)* The `Select targets` `<h1>` is visible. Test ends.

**Assessment**
- *Value:* proves the free tier exposes the same live-report entry point. Nothing more.
- ⚠️ **Same title/behaviour mismatch as RPT-02: "run live report" never clicks Run.** No targets,
  no campaign, no results assertion. Correct restraint given the simulated hosts — wrong name.
- *Coverage gaps:* everything after the target picker (see RPT-02). Free's real live-run coverage
  comes from `shared/hosts/host-live-query.spec.ts`, which the free project also picks up.
- *Redundancy:* identical to RPT-02, and its navigation chain is repeated verbatim by RPT-16 step 1.
- *Efficiency / smells:* four navigations for one visibility assertion.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### RPT-16 · Reports CRUD › edit *(free)*

- **File:** [`playwright/tests/e2e/free/reports/reports.spec.ts`](../../tests/e2e/free/reports/reports.spec.ts)
- **Grep:** `npx playwright test --project=free free/reports/reports.spec.ts -g "edit"`
- **Project:** free · **Mode:** UI+API · **Isolation:** serial describe, step 3 of 5 — renames the
  report to `editedName`, which RPT-17/RPT-18 depend on.
- **Preconditions:** RPT-14 created the report.
- **Data created:** none new.

**Flow**

1. ☐ Navigate to `/reports/manage` via URL, click the report link, click **Edit report**.
   - ✅ *(UI)* `/reports/:id` then `/reports/:id/edit`; the **Name** input holds the original name.
2. ☐ Fill the whole form: SQL `SELECT version FROM osquery_info;`, **Interval** *Every 15 minutes*,
   untick **Observers can run**, platforms exactly **Windows + Linux**, new **Name** and
   **Description**; repair pass re-applies drift.
   - ✅ *(UI)* Pre-save asserts: name, description, interval label, observers unchecked, platform
     set deep-equals `['Windows','Linux']`, editor contains the SQL.
3. ☐ Click **Save** → confirm **Save changes** → ✅ *(UI)* modal visible, toast **"Report
   updated."**, URL back on `/reports/:id`.
4. ☐ *(API)* ✅ `edited_saved_query` activity with the edited name, admin-attributed.
5. ☐ ✅ *(UI)* Details page `<h1>` = edited name, description = edited description; **Show query**
   SQL contains `SELECT version FROM osquery_info;`.
6. ☐ Click **Reports** in the navbar, then hard-navigate to `/reports/manage`, search the edited
   name → ✅ *(UI)* row visible, **Interval** cell reads *Every 15 minutes*.

**Assessment**
- *Value:* same as RPT-03 — the densest free-tier report test.
- *Coverage gaps:* platforms and observers-can-run are asserted only pre-save, never re-read;
  `ReportEditPage.expectValues()` remains unused. No rename-collision or discard-changes path.
- *Redundancy:* **direct duplicate of RPT-03.** The one substantive divergence is that free *does*
  hard-navigate in step 6 while premium RPT-03 does not — the free version is the correct one.
- *Efficiency / smells:* `fillAll`'s self-healing repair pass can mask a genuine field-reset
  product bug; step 1 duplicates RPT-15's navigation chain.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### RPT-17 · Reports CRUD › delete *(free)*

- **File:** [`playwright/tests/e2e/free/reports/reports.spec.ts`](../../tests/e2e/free/reports/reports.spec.ts)
- **Grep:** `npx playwright test --project=free free/reports/reports.spec.ts -g "delete"`
- **Project:** free · **Mode:** UI+API · **Isolation:** serial describe, step 4 of 5; the
  lifecycle's cleanup step.
- **Preconditions:** RPT-14 + RPT-16 ran.
- **Data created:** none; removes the report.

**Flow**

1. ☐ Navigate to `/reports/manage` via URL.
2. ☐ Search the report name, tick the row checkbox, click **Delete**, confirm in the **Delete
   reports** modal.
   - ✅ *(UI)* Row visible pre-selection; modal opens then hides.
3. ☐ ✅ *(UI)* Row-or-empty visible (unfalsifiable settle-wait); ✅ *(UI)* zero rows match the name.
4. ☐ *(API)* ✅ `deleted_saved_query` activity with the name, admin-attributed.

**Assessment**
- *Value:* same as RPT-04 — bulk-select delete + confirmation on the free tier.
- *Coverage gaps:* no cancel path, no multi-row delete, no post-delete 404 check.
- *Redundancy:* **direct duplicate of RPT-04.**
- *Efficiency / smells:* same page-wide `Delete` locator and same unfalsifiable `rowOrEmpty()`
  assertion as RPT-04.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### RPT-18 · Reports CRUD › activity feed shows create → edit → delete *(free)*

- **File:** [`playwright/tests/e2e/free/reports/reports.spec.ts`](../../tests/e2e/free/reports/reports.spec.ts)
- **Grep:** `npx playwright test --project=free free/reports/reports.spec.ts -g "activity feed shows"`
- **Project:** free · **Mode:** UI · **Isolation:** serial describe, step 5 of 5 — consumes
  `reportName` + `editedName`.
- **Preconditions:** RPT-14/16/17 all ran.
- **Data created:** none.

**Flow**

1. ☐ Open the **dashboard** via URL → ✅ *(UI)* first card visible.
2. ☐ Read the **Activity** feed, paging with **Next**.
   - ✅ *(UI)* Rows read `created a report <name> globally.`, `edited the report <edited name>
     globally.`, `deleted the report <edited name> globally.`
   - ⚠️ The matchers are built with `scope: 'All fleets'`, which is why the suffix is ` globally` —
     free has no fleets, so the copy happens to coincide. Free is passing a premium scope label to
     get the right string ([`free/reports/reports.spec.ts:103`](../../tests/e2e/free/reports/reports.spec.ts)).
   - Same walk mechanics as RPT-05 (15 pages × 8 rows, up to 10 reloads).

**Assessment**
- *Value:* the rendered report activity copy on free.
- *Coverage gaps:* no ordering, actor, timestamp, or count assertions.
- *Redundancy:* **high** — the three events were already asserted via `assertActivity` in
  RPT-14/16/17; and the strings are identical to RPT-05's All-fleets variant, so premium already
  covers this exact copy.
- *Efficiency / smells:* slowest assertion bundle in the free reports spec, for a contract already
  pinned by `tests/api/activity-copy.spec.ts` and re-asserted twice on premium.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### RPT-19 · Free • Reports • automations › enabling a report's automations persists

- **File:** [`playwright/tests/e2e/free/reports/automations.spec.ts`](../../tests/e2e/free/reports/automations.spec.ts)
- **Grep:** `npx playwright test --project=free free/reports/automations.spec.ts`
- **Project:** free · **Mode:** UI+API · **Isolation:** self-contained; `beforeEach` seeds,
  `afterEach` deletes by marker.
- **Preconditions:** *(API)* `POST /queries` creates `pw-report-auto-<ts>-<rand>`.
- **Data created:** that report, deleted in `afterEach`.

**Flow**

1. ☐ Navigate to `/reports/manage` **via URL** (no team dropdown on free).
2. ☐ Click **Automations** → ✅ *(UI)* **Manage automations** modal visible.
3. ☐ Tick the checkbox named after the seeded report.
4. ☐ Click **Save** → ✅ *(UI)* modal hidden; ✅ *(UI)* toast **"Successfully updated report
   automations."**
5. ☐ *(API)* ✅ `GET /queries` → the report's `automations_enabled === true`.

**Assessment**
- *Value:* confirms the per-report automations toggle is not premium-gated.
- *Coverage gaps:* no disable direction; no re-open-the-modal UI verification; other reports not
  asserted untouched.
- *Redundancy:* **RPT-08 with one line removed.** `teamDropdown.select()` is already a no-op on
  free, so a single `shared/reports/automations.spec.ts` would cover both tiers with no branching.
- *Efficiency / smells:* API-verified persistence where a UI verification is available (same note
  as RPT-08).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### RPT-20 · Free • Reports • Save as new › pre-fills "Copy of \<name\>" and creates a duplicate

- **File:** [`playwright/tests/e2e/free/reports/save-as-new.spec.ts`](../../tests/e2e/free/reports/save-as-new.spec.ts)
- **Grep:** `npx playwright test --project=free free/reports/save-as-new.spec.ts -g "pre-fills"`
- **Project:** free · **Mode:** UI · **Isolation:** self-contained; `beforeEach` seeds,
  `afterEach` deletes the base report and any `Copy of …`.
- **Preconditions:** *(API)* global report `playwright-saveasnew-<ts>-<rand>`.
- **Data created:** the base report + one duplicate; both removed.

**Flow**

1. ☐ Navigate to `/reports/<id>/edit` **via URL** → ✅ *(UI)* name input + editor visible.
2. ☐ Click **Save as new** → ✅ *(UI)* modal visible, name field pre-filled exactly
   `Copy of <base name>`.
3. ☐ Click **Save** → ✅ *(UI)* toast **"Successfully added report Copy of \<base name\>."**;
   ✅ *(UI)* URL matches `/reports/<digits>`.

**Assessment**
- *Value:* duplicate-a-report on free, including the pre-filled name and success copy.
- *Coverage gaps:* same as RPT-12 — the URL regex also matches the base report's own id, so it
  doesn't prove a *new* report was opened; nothing checks the copy in the list or that its SQL and
  description were carried across.
- *Redundancy:* **byte-identical to RPT-12** apart from the describe title. Since the premium test
  never touches the premium-only Fleet dropdown, the two files are pure duplication today.
- *Efficiency / smells:* synchronisation rests entirely on the auto-dismissing success toast.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### RPT-21 · Free • Reports • Save as new › rejects a name that already exists

- **File:** [`playwright/tests/e2e/free/reports/save-as-new.spec.ts`](../../tests/e2e/free/reports/save-as-new.spec.ts)
- **Grep:** `npx playwright test --project=free free/reports/save-as-new.spec.ts -g "rejects a name"`
- **Project:** free · **Mode:** UI · **Isolation:** self-contained (same hooks as RPT-20).
- **Preconditions:** *(API)* the seeded base report exists.
- **Data created:** none beyond it.

**Flow**

1. ☐ Navigate to `/reports/<id>/edit` **via URL**.
2. ☐ Click **Save as new** → ✅ *(UI)* modal visible; overwrite the name with the base report's own
   name.
3. ☐ Click **Save** → ✅ *(UI)* error toast `A report called "<base name>" already exists`.

**Assessment**
- *Value:* duplicate-name rejection copy on free.
- *Coverage gaps:* doesn't assert the modal stays open or that nothing was created.
- *Redundancy:* **byte-identical to RPT-13.**
- *Efficiency / smells:* the 4xx is correctly left to `pageHealth`'s ignore rule.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### RPT-22 · Reports — live report targets › selecting a fleet targets its hosts and enables Run

- **File:** [`playwright/tests/e2e/premium/reports/reports.spec.ts`](../../tests/e2e/premium/reports/reports.spec.ts)
- **Grep:** `npx playwright test --project=premium premium/reports/reports.spec.ts -g "selecting a fleet targets its hosts and enables Run"`
- **Project:** premium · **Scopes:** All fleets (the list is opened unscoped; the *target* is the **VMs** fleet)
- **Mode:** UI · **Isolation:** standalone `test.describe('Reports — live report targets')` with a single test, **not** serial and not part of the scoped CRUD loop. Self-contained: the report is **created and deleted over the API inside the same test**, in `try/finally`. Nothing is run, so the only state it leaves is the UI state of a page that is never persisted.
- **Preconditions:** premium license (fleets are a premium concept — this is the one genuinely premium thing in the file). **The `VMs` fleet must exist and hold hosts** — it is the fleet that owns the real QA VMs and therefore the one fleet guaranteed to have something for "N hosts targeted" to count. Empty reports list is not required (the test searches by its own name).
- **Data created:** one global report `playwright-live-targets-<ts>` with `SELECT 1 AS one;` — deleted in `finally`; `cleanup-teardown`'s `deleteAllQueries` sweeps it if the test aborts.

**Flow**

1. ☐ *(API setup)* `POST /queries` → `playwright-live-targets-<ts>`.
2. ☐ Open `/reports/manage` via URL, select **All fleets**.
   - ✅ *(UI)* a row or the empty state is visible (`ReportsListPage.goto` anchor); the dropdown reads "All fleets".
3. ☐ Type the report's name into **Search by name**, click its row link.
   - ✅ *(UI)* URL matches `/reports/:id` (`openReport`).
4. ☐ Click **Edit**, then **Live report** in the editor.
   - ✅ *(UI)* URL matches `/reports/:id/edit` (`clickEdit`), then `/reports/:id/live` (`clickLiveReport`).
   - ✅ *(UI)* the **Select targets** `h1` is visible (`ReportLivePage.waitForReady`).
5. ☐ *(no user action)* the empty picker state — the baseline the rest of the test is measured against.
   - ✅ *(UI)* **Run** is **disabled**.
   - ✅ *(UI)* the targeted-host summary is **empty** (`.run-query-page__targets-total-count` — role-less spans, so scoped by the page's own class).
6. ☐ Click the **VMs** fleet chip.
   - ✅ *(UI)* the chip flips to selected — `toggleTarget` reads `data-selected` rather than the accessible name, because each chip's name is prefixed by its state icon ("plus" unselected, "check" selected).
   - ✅ *(UI)* the summary now matches `/\d+\s*hosts?\s*targeted/`. **Whitespace-class, not a literal space:** Fleet joins the summary's parts with **non-breaking** spaces, so `"N hosts targeted"` with a literal space never matches.
   - ✅ *(UI)* **Run** is **enabled** — selecting a target is what turns the run on.
7. ☐ Click the **VMs** chip again to deselect it.
   - ✅ *(UI)* the chip flips back to unselected.
   - ✅ *(UI)* the summary is empty again.
   - ✅ *(UI)* **Run** is disabled again. The reversal is the load-bearing half: it proves the count came from *this* fleet selection and not from a default the page had all along.
8. ☐ *(API teardown)* `DELETE /queries/:id` in `finally`.

**Assessment**
- *Value:* closes the biggest hole RPT-02 / RPT-15 leave open. Those two reach `/reports/:id/live` and stop; this one exercises the picker itself — that **Run** is gated on having a target, that a fleet chip is a valid target, that Fleet computes and renders a host count for it, and that all three reverse. It is also the only assertion in the area that touches the premium-only **fleet** row of the target picker (platforms and labels are offered on both tiers; fleets are not). And it does all of that **without running a campaign**, so it stays on the safe side of the simulated-host line described above.
- *Coverage gaps:* **Run is never clicked** — the area still has no coverage of *Running report* → *Report finished*, the `N targeted / P% responded` summary on the run screen, Stop / Run again / Close, or the Errors tab; the **selected-targets table** (`targetRows`) is never read, so nothing asserts *which* hosts were picked, only that a number appeared; the count is matched as a shape (`\d+`), never reconciled against `GET /hosts?fleet_id=<VMs>`, so a chip that targeted the *wrong* fleet passes; the other target kinds (**All hosts**, a platform, a label, an individual host) are untested, as is multi-select and the "(P% online)" half of the summary; no free counterpart, which is correct for the fleet chip but leaves platform/label targeting uncovered on both tiers.
- *Redundancy:* steps 2–4 re-walk the list → details → edit → live navigation that RPT-02/RPT-15 already perform and that RPT-03/RPT-16 perform again immediately after — the fifth copy of that walk in this file. The only unique steps are 5–7.
- *Efficiency / smells:*
  - ⚠️ **The fleet is a hardcoded string, not the `vmsFleetId` worker fixture.** `const fleet = 'VMs'` ([`reports.spec.ts:156`](../../tests/e2e/premium/reports/reports.spec.ts)) — the suite resolves this fleet by id everywhere else. If the fleet is renamed the failure is a chip-not-found timeout rather than a clear precondition error, and there is **no guard** asserting the fleet exists or holds hosts (contrast HOSTP-09, which turns exactly this class of missing furniture into a readable message).
  - ⚠️ **`targetChip(name)` is an unscoped, substring `getByRole('button', { name })`** ([`ReportLivePage.ts:89`](../../pages/reports/ReportLivePage.ts)). A label named `VMs`, a second chip containing the word, or any other button on the page whose accessible name contains it resolves to two elements and fails strict mode. The picker offers fleets **and** labels side by side, so this is a live collision risk, not a theoretical one.
  - `toggleTarget` early-returns when `data-selected` already matches, so on a page that rendered the chip *pre-selected* the test would assert the post-click state without ever clicking — the selection half would pass vacuously. The deselect step is what would catch it.
  - `toBeEmpty()` on the summary passes both for "rendered but blank" and — in practice — for an element that exists with no text for an unrelated reason; it is a weaker baseline than asserting the Run button alone.
  - The report is created with a query (`SELECT 1 AS one;`) that is never used — nothing is run — so the seed could be any report at all; it exists only to have a `/reports/:id/live` route to open.

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
| Create a report (editor → Save report modal) | RPT-01, RPT-14 | duplicate-name on create; cancel/discard; modal platform+target fields never re-read |
| Report details page (`/reports/:id`) | RPT-01, RPT-03 (name, description, Show query) | **Back to reports** button, per-host results table, the "Fleet is awaiting results" state, the report's own automations/frequency display |
| Edit a report | RPT-03, RPT-16 | platforms + observers-can-run persistence after reload (`ReportEditPage.expectValues()` exists and is **called by no spec**); rename collision; unsaved-changes warning |
| Delete a report | RPT-04, RPT-17 | cancel in the modal; multi-row bulk delete; post-delete 404 |
| Activity-feed copy | RPT-05, RPT-18 + `tests/api/activity-copy.spec.ts` | ordering / actor / count |
| List name search | RPT-09 (only test with a negative assertion) | no free counterpart; clear-search; no-match empty state |
| List platform filter | RPT-10 | only macOS; All-platforms reset untested; **Platform** column contents never asserted |
| Inherited (global → team) | RPT-11 | converse direction; inherited-report read-only affordances |
| Per-report automations | RPT-08, RPT-19 | disable direction; UI re-verification; global automations/log-destination config |
| Save as new | RPT-12/13, RPT-20/21 | proof the duplicate is a *new* id; SQL/description carry-over; the premium-only **Fleet** dropdown in the modal |
| Live report — navigation | RPT-02, RPT-15 (**navigation only — never clicks Run**) | see the row below; real-result coverage lives only in [`shared/hosts/host-live-query.spec.ts`](../../tests/e2e/shared/hosts/host-live-query.spec.ts) against `liveMacosHost` |
| Live report — target picker | RPT-22 (**fleet chip only**, premium) | **Run** still never clicked: *Running* → *Report finished*, `N targeted / P% responded`, Stop / Run again / Close and the Errors tab remain untested. Within the picker: the selected-targets table is never read, the host count is matched as `\d+` rather than reconciled against `GET /hosts?fleet_id=`, and **All hosts** / platform / label / individual-host targets and multi-select are untested (no free counterpart, so platform + label targeting is uncovered on both tiers) |
| SQL validation + new-report defaults | RPT-06, RPT-07 (**premium file only**) | no free counterpart, despite the editor being tier-agnostic and free/policies having its own mirror |
| Reports list pagination / sorting / column set | — | untested (only `tests/loadtest/reports.spec.ts` touches the list at scale, for timing) |
| Report scheduling actually running (stored results) | — | untested and arguably untestable here: needs a scheduled interval to elapse on a real host |

**Live-query reality check.** What a live-report test *can* assert on the premium/free QA instances:
route transitions, the **Select targets** screen, target-row contents, that **Run** starts a
campaign, the *Report finished* heading, and the `N host(s) targeted (P% responded)` summary — with
`resultsRows` and `noResultsState` treated as **alternatives**, never as an expected row count.
What it *cannot* assert: any result value, any row count, or that the report's SQL was the query
that ran — the osquery-perf simulations ignore the SQL and return no rows a meaningful fraction of
the time. RPT-02 / RPT-15 stay on the safe side of that line, so **no test in this area fakes
result validation**; the defect is the opposite — their titles claim a run they never perform, and
they stop three steps before the plumbing that *is* assertable. RPT-22 takes one of those three
steps — the target picker, Run's enablement, and the targeted-host count — and deliberately stops
before pressing **Run**, so the area still has no coverage of the run screen itself even though the
list above says most of it is assertable.

**Duplication**

1. **Free CRUD is a transcription of premium CRUD** — RPT-14/15/16/17/18 vs RPT-01/02/03/04/05.
   Same data objects, same steps, same assertions; the deltas are the scope loop, the
   `teamDropdown.select()` calls, and `fleetIdFor()`. Free/premium separation is a deliberate house
   convention, but here it also means every fix has to land twice (and hasn't — see the RPT-03 vs
   RPT-16 hard-navigate divergence).
2. **`save-as-new.spec.ts` premium vs free are byte-identical** (RPT-12/13 vs RPT-20/21). The
   premium file's stated reason to exist (the modal's Fleet dropdown) is untested.
3. **`automations.spec.ts` premium vs free differ by one no-op line** (RPT-08 vs RPT-19).
4. **Every report activity is asserted twice** — once via `assertActivity` (API) inside
   create/edit/delete, once via the dashboard feed in the final sub-test. On premium that is
   3 API + 3 UI assertions per scope, ×2 scopes, plus 3 + 3 on free = 12 assertions of the same
   6 copy strings, on top of `tests/api/activity-copy.spec.ts`.
5. **RPT-02/RPT-15's list→details→edit walk is re-run verbatim** by RPT-03/RPT-16 immediately after — and a fifth time by RPT-22, whose only unique steps are the three picker assertions at the end.
6. **The SQL-syntax-error assertion pair** appears in RPT-06 and in both policies
   `sql-validation.spec.ts` files — four copies of one `SQLEditor` behaviour.

**UI-vs-API balance**

- **Justified API use:** the three `assertActivity` calls check `type` + `details.query_name` +
  `actor_email` — the activity *record* contract, which the rendered feed can't show (actor email,
  event type). Keeping *one* layer per event is defensible; keeping both, as now, is not.
- **Shortcut around a UI assertion:** RPT-08 / RPT-19 step 5. `automations_enabled` is verified by
  `GET /queries` when re-opening the **Manage automations** modal and asserting the checkbox is
  still ticked would verify it through the user-facing surface. This is the one place in the area
  where the API assertion replaces, rather than supplements, a possible UI check.
- **Legitimate API setup (not validation):** `createReport` / `deleteReportsMatching` in
  automations, list-filters and save-as-new — correct; seeding reports through the UI would be pure
  cost. Note `findReportById` / `deleteReportsMatching` list **global** reports only
  ([`helpers/api/reports.ts:51`](../../helpers/api/reports.ts)), so none of these specs can be
  retargeted at a team-scoped report without a `fleetId` argument.
- **Everything else is UI**, and the UI assertions are mostly strong (exact `toHaveText` on the
  name heading, description, and Interval cell rather than `toBeVisible`). The two weak ones are
  `rowOrEmpty()` in RPT-04/RPT-17 (unfalsifiable) and the `/reports/\d+/` URL regex in
  RPT-12/RPT-20 (matches the report you started from).

**Quick wins**

1. Rename RPT-02 / RPT-15 to what they do (e.g. `opens the live-report target picker`) **or** extend
   them by three lines — select a target, **Run**, assert the *Report finished* heading and the
   `% responded` summary with `resultsRows`/`noResultsState` as alternatives
   ([`reports.spec.ts:74`](../../tests/e2e/premium/reports/reports.spec.ts),
   [`free/reports/reports.spec.ts:60`](../../tests/e2e/free/reports/reports.spec.ts)).
2. Call the already-written `ReportEditPage.expectValues(edited)`
   ([`ReportEditPage.ts:375`](../../pages/reports/ReportEditPage.ts)) after `saveExisting()` in
   RPT-03/RPT-16 — that closes the platforms + observers-can-run persistence gap for free.
3. Add the hard `reportsList.goto({ fleetId })` to premium RPT-03 step 6
   ([`reports.spec.ts:98`](../../tests/e2e/premium/reports/reports.spec.ts)) so it matches RPT-01 and
   free RPT-16; the documented stale-list bug applies there too.
4. Keep `saveNew()`'s returned id in the describe closure and reach the report via
   `reportDetails.goto(id)` in RPT-02/03 — removes two list loads, two dropdown selects and two
   searches per scope ([`reports.spec.ts:52`](../../tests/e2e/premium/reports/reports.spec.ts)).
5. Drop the unfalsifiable `expect(reportsList.table.rowOrEmpty()).toBeVisible()` in RPT-04/RPT-17,
   and tighten RPT-12/RPT-20's URL check to assert the id differs from `baseId`.
6. Resolve RPT-22's target fleet through the `vmsFleetId` worker fixture instead of the hardcoded
   `const fleet = 'VMs'` ([`reports.spec.ts:156`](../../tests/e2e/premium/reports/reports.spec.ts)),
   and scope `ReportLivePage.targetChip()` to the picker's own container with an exact-ish match
   ([`ReportLivePage.ts:89`](../../pages/reports/ReportLivePage.ts)) — today a label sharing the
   fleet's name breaks the locator under strict mode.
7. Reconcile RPT-22's `\d+ hosts targeted` against `GET /hosts?fleet_id=<VMs>&status=online` so the
   count proves the *right* fleet was targeted. One API call, and it turns a shape check into a
   value check.

**Bigger bets**

1. **Collapse the tier duplication for the non-scoped report specs.** Move
   `save-as-new.spec.ts` and `automations.spec.ts` to `tests/e2e/shared/reports/` (the team
   dropdown call is already a no-op on free), and add the premium-only bit that actually justifies a
   premium file: the **Fleet** dropdown inside the Save-as-new modal, and the disable direction for
   automations. Net −2 files, +2 real behaviours.
2. **Pick one activity layer.** Either keep `assertActivity` in the mutating sub-tests and delete
   the final feed sub-test (relying on `tests/api/activity-copy.spec.ts` + one representative feed
   test for the rendering contract), or keep the feed sub-test and drop the three API calls. As
   written the area pays for both, and the feed walk is its slowest assertion.
3. **Give the reports list a proper filter/table spec, mirrored on free.** `list-filters.spec.ts` is
   premium-only and covers three of ~eight list behaviours; pagination, sorting, the **Platform**
   column, All-platforms reset, and the no-match empty state are all unowned. A single shared
   list-behaviour spec seeded via the API would cover more than the current premium file at similar
   runtime.
