# Reports / queries — test audit

**Specs covered:** 9 files · **Test declarations:** 28 · **Projects:** premium / free (RPT-26 runs in both)

Fleet's "Reports" are saved queries (`/reports/manage`, `/reports/new`, `/reports/:id`,
`/reports/:id/edit`, `/reports/:id/live`; the REST API still calls them `queries`). The area
splits into a serial CRUD lifecycle spec per tier (create → run live → edit → delete →
activity-feed; create turns the report's automations on and edit turns them off), plus small
single-purpose describes in the same files for SQL validation and new-report defaults (both
tiers) and the live-report target picker (premium), and small single-purpose specs for the list
filters, the per-report automations modal, and "Save as new" (premium also copies into another
fleet). `shared/reports/edit-warnings.spec.ts` runs on both tiers and covers which edits Fleet's
"Save changes?" prompt guards. `premium/reports/stored-results.spec.ts` reads results the real
macOS VM stored, for a long-standing gitops report and a new one. Premium runs the lifecycle
twice via a `for (const scope of ['All fleets', 'Workstations'])` loop; free mirrors it without
the team dropdown. The reports the non-lifecycle specs need are seeded through
`@helpers/api/reports`, and whatever they create, through the UI or the API, is deleted through
it. `premium/reports/report-label-targets.spec.ts` is audited with label targeting, in
[area 22](22-label-targeting.md) (LT-09).

**Standing environment note for this area:** apart from three real VMs per tier (macOS,
Windows, Ubuntu; on the **VMs** fleet on premium), the ~300 online hosts on each QA instance are
osquery-perf simulations, which answer a live query with a canned row whatever its SQL. Nothing
in this area asserts live-query *results*; only the real-host spec
[`shared/hosts/host-live-query.spec.ts`](../../tests/e2e/shared/hosts/host-live-query.spec.ts)
can, and it does. See RPT-02 / RPT-15. The results this area does read are *scheduled* ones the
real macOS VM stored, in RPT-27 / RPT-28.

## Contents

| ID | Spec | Test | Mode | Manual? |
|---|---|---|---|---|
| RPT-01 | `premium/reports/reports.spec.ts` | Reports CRUD (All fleets · Workstations) › create | UI+API | ☐ |
| RPT-02 | `premium/reports/reports.spec.ts` | Reports CRUD (All fleets · Workstations) › run live report | UI | ☐ |
| RPT-03 | `premium/reports/reports.spec.ts` | Reports CRUD (All fleets · Workstations) › edit | UI+API | ☐ |
| RPT-04 | `premium/reports/reports.spec.ts` | Reports CRUD (All fleets · Workstations) › delete | UI+API | ☐ |
| RPT-05 | `premium/reports/reports.spec.ts` | Reports CRUD (All fleets · Workstations) › activity feed shows create → edit → delete | UI | ☐ |
| RPT-06 | `premium/reports/reports.spec.ts` | Reports — SQL validation › a report with a syntax error saves, and reopens with its SQL and the error | UI | ☐ |
| RPT-07 | `premium/reports/reports.spec.ts` | Reports — new-report defaults › starts from the default osquery_info query, and the Save report modal from its defaults | UI | ☐ |
| RPT-08 | `premium/reports/automations.spec.ts` | Premium • Reports • automations › a report's automations are turned on, then off again, and the list says so | UI+API | ☐ |
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
| RPT-19 | `free/reports/automations.spec.ts` | Free • Reports • automations › a report's automations are turned on, then off again, and the list says so | UI+API | ☐ |
| RPT-20 | `free/reports/save-as-new.spec.ts` | Free • Reports • Save as new › pre-fills "Copy of \<name\>" and creates a duplicate | UI | ☐ |
| RPT-21 | `free/reports/save-as-new.spec.ts` | Free • Reports • Save as new › rejects a name that already exists | UI | ☐ |
| RPT-22 | `premium/reports/reports.spec.ts` | Reports — live report targets › selecting a fleet targets its hosts and enables Run | UI | ☐ |
| RPT-23 | `free/reports/reports.spec.ts` | Reports — SQL validation › a report with a syntax error saves, and reopens with its SQL and the error | UI | ☐ |
| RPT-24 | `free/reports/reports.spec.ts` | Reports — new-report defaults › starts from the default osquery_info query, and the Save report modal from its defaults | UI | ☐ |
| RPT-25 | `premium/reports/save-as-new.spec.ts` | Premium • Reports • Save as new › copies into another fleet chosen in the modal's Fleet field | UI+API | ☐ |
| RPT-26 | `shared/reports/edit-warnings.spec.ts` | Shared • Reports • edit warnings › an edit that would delete a report's stored results asks first, and one that wouldn't saves straight away | UI+API | ☐ |
| RPT-27 | `premium/reports/stored-results.spec.ts` | Premium • Reports • stored results › the long-standing gitops report holds a fresh result from the macOS VM | UI+API · **real VM** | ☐ |
| RPT-28 | `premium/reports/stored-results.spec.ts` | Premium • Reports • stored results › a report created with Store data on collects a result from the macOS VM | UI+API · **real VM** | ☐ |

`Mode`: **UI** (all validation through the browser), **UI+API** (browser flow, some assertions
via API), **API** (no meaningful UI validation), **PERF** (timing).

**Shared preconditions for every entry below:** the `cleanup-setup` project runs before both
the `premium` and `free` projects and calls `deleteAllQueries`
([`helpers/api/cleanup.ts:9`](../../helpers/api/cleanup.ts)), which deletes every **global**
report: it lists `GET /queries` with no fleet, so a fleet's reports are out of its reach (its
docstring's "every saved query on the instance" overstates it). `cleanup-teardown` repeats it
after. So each run starts with no global reports, and any global report a spec leaves behind is
swept at the end of the run. **Fleet reports aren't swept that way.** The Workstations wipe
leaves reports alone (gitops owns five there), so a report a spec puts in Workstations has to be
deleted by that spec (RPT-01/04's Workstations scope, RPT-25). On the VMs fleet the sweep in
[`setup/cleanup.steps.ts`](../../setup/cleanup.steps.ts) deletes only the `pw-run-script-*`,
`pw-rl-*` and `pw-stored-results-*` prefixes, which leaves gitops' `pw-host-report-results` in
place.

---

### RPT-01 · Reports CRUD (All fleets · Workstations) › create

- **File:** [`playwright/tests/e2e/premium/reports/reports.spec.ts`](../../tests/e2e/premium/reports/reports.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "Reports CRUD"` (both scopes' whole
  lifecycles: a serial sub-test needs its siblings)
- **Project:** premium · **Scopes:** All fleets, Workstations (two independent serial describes)
- **Mode:** UI+API · **Isolation:** serial describe, step 1 of 5. Closure state shared with the
  other four sub-tests: `reportName`, `editedName` (derived), the `created` / `edited` value
  objects, and `reportId`, which this step sets from `saveNew()` and RPT-03 uses for its API
  read. RPT-02/03/04 reach the report by name through the list. A failure here cascades:
  Playwright skips the rest of the serial describe.
- **Source:** the automations steps are QA Wolf
  `queries-global-users-ability-to-set-created-queries-to-send-historical-results-to-log-destination-on-query-creation-and-query-editing`
  (round 1 C4 #P2; round 3, batch B)
- **Preconditions:** no global reports (`cleanup-setup`); `workstationsFleetId` worker fixture
  resolved from the API; the config names a result log plugin (`logging.result.plugin`, read by
  `resultLogPlugin()`, which throws when there is none).
- **Data created:** report `playwright-report-<scope-slug>-<timestamp>` in the selected scope,
  automations on, every 30 minutes — renamed by RPT-03, deleted by RPT-04. While it exists it is
  scheduled on every host in scope (every host on the instance, for All fleets) and its results
  go to the log destination. ⚠️ On Workstations nothing else removes it: `cleanup-setup` leaves
  fleet reports alone, so a lifecycle that dies between this step and RPT-04 leaves the report in
  Workstations, automations on, until someone deletes it.

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
   `setValue`, not typed — see [`ReportEditPage.ts:233`](../../pages/reports/ReportEditPage.ts)).
   - ✅ *(UI)* Editor content text equals the new SQL exactly.
5. ☐ Click **Save** → the **Save report** modal opens; fill **Name**, **Description**; set
   **Interval** to *Every 30 minutes* via the frequency dropdown; tick **Observers can run**;
   turn the **Automations** slider on; click **Save** in the modal.
   - ✅ *(UI)* "Save report" modal is visible.
   - ✅ *(UI)* Interval dropdown label reads *Every 30 minutes* after selection (only asserted
     when the label had to change).
   - ✅ *(UI)* The slider reads `aria-checked="true"` (it is clicked only if it wasn't already).
   - ✅ *(UI)* Success toast **"Report created."**
   - ✅ *(UI)* URL settles on `/reports/:id`; the id is parsed (the helper throws if it can't
     be) and kept as `reportId`.
6. ☐ *(API)* `GET /activities` contains `created_saved_query` whose `details.query_name` is the
   new name.
   - ✅ *(API)* Activity exists (pages back up to 5 × 100 entries) **and** its `actor_email`
     equals `FLEET_ADMIN_EMAIL` — `assertActivity`.
7. ☐ On `/reports/:id`, read the report name + description.
   - ✅ *(UI)* `<h1>` inside `.main-content.query-details-page` has exactly the submitted name.
   - ✅ *(UI)* `.query-details-page__query-description` has exactly the submitted description.
8. ☐ Read the report's automations.
   - ✅ *(API)* `GET /queries/:id` (`getReport`) → `automations_enabled === true`.
   - ✅ *(UI)* The **Automations** line under the description ends in **On**.
   - ✅ *(UI)* The **Log destination** line contains the plugin `GET /config` names in
     `logging.result.plugin` (case-insensitive), so the page names the destination the instance
     really uses.
9. ☐ Click **Show query**, read the SQL in the modal, click **Close**.
   - ✅ *(UI)* Query modal opens, its SQL contains `SELECT 1 AS one;`, and the modal is hidden
     again after Close.
10. ☐ Click **Reports** in the navbar, then navigate directly to `/reports/manage?fleet_id=…`
    (deliberate hard reload — see the comment at
    [`reports.spec.ts:67`](../../tests/e2e/premium/reports/reports.spec.ts); the React-router
    transition back from `/reports/:id` doesn't re-fetch when `fleet_id` is unchanged), re-select
    the scope, and type the report name into **Search by name**.
    - ✅ *(UI)* URL is `/reports/manage` after the navbar click.
    - ✅ *(UI)* A row containing the report name is visible.
    - ✅ *(UI)* That row's **Interval** cell (resolved by matching the visible column header) reads
      exactly *Every 30 minutes*.

**Assessment**
- *Value:* catches a broken new-report save path end-to-end — modal fields persisting, the
  redirect to the details page, the interval round-tripping into the list column, and the
  activity record being written with the right scope. The Automations slider is the one modal
  field read back, through the API and on the details page, together with the log destination
  Fleet sends the results to.
- *Coverage gaps:* **Observers can run** and the modal's platform/target fields are set but never
  re-read after save (nothing re-opens the form). The modal's "Historical results will be sent to
  your log destination: …" sentence beside the slider isn't read (RPT-03 reads the "will not"
  form on the edit page), and whether results actually reach the destination is beyond e2e. No
  check that the report lands in the *selected* scope beyond the activity suffix: `getReport`
  returns the owning fleet, and the step reads only `automationsEnabled` from it. No
  duplicate-name-on-create check. No cancel path here (RPT-07 cancels the modal). The search step
  asserts presence, never absence of non-matching rows, so it doesn't prove search filters.
- *Redundancy:* mirrors RPT-14 (free) almost line-for-line — the only differences are the scope
  loop, the dropdown call, and `fleetIdFor(...)`. The `created_saved_query` API assertion overlaps
  RPT-05, which asserts the same event through the dashboard feed. `automations_enabled` is read
  twice, through the API and the details page; the page is the user-facing half.
- *Efficiency / smells:*
  - `reportId` serves only the API reads in this step and RPT-03
    ([`reports.spec.ts:57`](../../tests/e2e/premium/reports/reports.spec.ts)); RPT-02/03 could
    open the report with `reportDetails.goto(reportId)` instead of list→search→click.
  - Step 10 clicks the navbar *and* then hard-navigates to the same page — one wasted page load,
    kept only to exercise the navbar link that step 1 already exercised.
  - `search.fill()` with no wait for the filtered fetch; the assertion passes on the unfiltered
    list too, so it isn't testing search.
  - With automations on and a 30-minute interval, the report is scheduled on every host in scope
    for the minute the lifecycle takes. Benign SQL; on Workstations, see the ⚠️ under *Data
    created*.

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
- **Grep:** `npx playwright test --project=premium -g "Reports CRUD"` (both scopes' whole
  lifecycles: a serial sub-test needs its siblings)
- **Project:** premium · **Scopes:** All fleets, Workstations
- **Mode:** UI+API · **Isolation:** serial describe, step 3 of 5 — reads `reportName` and
  `reportId`, writes the live report over to `editedName`; RPT-04 and RPT-05 depend on that rename
  having happened.
- **Source:** the automations steps are QA Wolf's flow cited under RPT-01 (round 1 C4 #P2; round
  3, batch B)
- **Preconditions:** RPT-01 created the report, automations on.
- **Data created:** none new; the existing report is renamed to `<name>-edited`, its automations
  turned off, its interval set to 15 minutes and its platforms to Windows + Linux.

**Flow**

1. ☐ Navigate to `/reports/manage?fleet_id=…` via URL, re-select the scope, click the report's
   name link, click **Edit report**.
   - ✅ *(UI)* Row-or-empty anchor, `/reports/:id`, then `/reports/:id/edit`.
   - ✅ *(UI)* The inline **Name** input holds the original name (the one explicit "the editor
     loaded the right report" check in the lifecycle).
2. ☐ Fill the whole form (`fillAll`): SQL → `SELECT version FROM osquery_info;`, **Interval** →
   *Every 15 minutes*, untick **Observers can run**, set the platform checkbox set to exactly
   **Windows + Linux** (unticking macOS and ChromeOS), turn the **Automations** slider off, then
   **Name** and **Description**. Then a second repair pass re-applies any field React clobbered
   mid-fill, the slider included.
   - ✅ *(UI)* Editor text equals the new SQL after each `setSql`.
   - ✅ *(UI)* Final pre-save asserts on the form: Name value, Description value, Interval label,
     **Observers can run** unchecked, checked-platform set deep-equals `['Windows','Linux']`,
     editor text contains the new SQL, slider `aria-checked="false"`.
3. ☐ Read the sentence beside the slider.
   - ✅ *(UI)* It contains "Historical results will not be sent to your log destination:
     `<plugin>`" (case-insensitive), the plugin read from `GET /config` → `logging.result.plugin`.
4. ☐ Click **Save** → confirm in the **Save changes** modal (the SQL changed and the report stores
   results, so Fleet asks first).
   - ✅ *(UI)* "Save changes" modal is visible.
   - ✅ *(UI)* Success toast **"Report updated."**
   - ✅ *(UI)* URL settles back on `/reports/:id`.
5. ☐ *(API)* `GET /activities` contains `edited_saved_query` with `details.query_name === <edited name>`.
   - ✅ *(API)* Activity present and attributed to the admin — `assertActivity`.
6. ☐ On the details page, read name + description and the automations; click **Show query**, read
   SQL, **Close**.
   - ✅ *(UI)* `<h1>` equals the edited name; description paragraph equals the edited description.
   - ✅ *(API)* `GET /queries/:id` → `automations_enabled === false`.
   - ✅ *(UI)* The **Automations** line ends in **Off**.
   - ✅ *(UI)* Query modal SQL contains `SELECT version FROM osquery_info;`.
7. ☐ Click **Reports** in the navbar, re-select the scope, search the edited name.
   - ✅ *(UI)* URL `/reports/manage`; a row with the edited name is visible; its **Interval** cell
     reads exactly *Every 15 minutes*.

**Assessment**
- *Value:* the densest test in the area — rename, description, SQL, interval and automations all
  round-trip through a real save, the activity carries the new name, and the slider's sentence
  names the instance's real log destination.
- *Coverage gaps:* **platforms** and **Observers can run** are set and asserted *in the form
  before saving*, then never re-read from a fresh load — so a persistence bug in either field
  passes. `ReportEditPage.expectValues()`
  ([`ReportEditPage.ts:485`](../../pages/reports/ReportEditPage.ts)) does exactly this check
  (though not for the slider) and **is called by no spec in the repo**. The form's *loaded* state
  goes unasserted for the fields the fill flips: the slider is clicked only when its
  `aria-checked` differs from the target, so a form that opened with automations off — a
  rehydration bug for RPT-01's "on" — still saves "off" and passes; the same holds for **Observers
  can run**. The **Log destination** line isn't re-read once automations are off. No negative
  path (rename to an existing name, discard changes, leave the page with unsaved edits).
- *Redundancy:* RPT-16 (free) is the same test minus the scope; RPT-05 re-asserts the
  `edited_saved_query` event through the UI feed. RPT-26 reads the "Save changes?" copy that step
  4 only confirms.
- *Efficiency / smells:*
  - Step 7 clicks the navbar but — unlike RPT-01 step 10 and unlike free RPT-16 — does **not**
    hard-navigate afterwards ([`reports.spec.ts:117`](../../tests/e2e/premium/reports/reports.spec.ts)).
    The stale-list problem RPT-01's comment documents applies here too and bites harder (a cached
    list still holds the *old* name). Inconsistent with both siblings; a flake candidate.
  - `fillAll`'s repair pass is a documented flake workaround
    ([`ReportEditPage.ts:436`](../../pages/reports/ReportEditPage.ts)) but it also silently masks a
    real "field resets itself" product bug — the drift is re-applied and *then* asserted. RPT-26's
    spec describes the mechanism: after **Edit report**, the form fills from navigation state and
    then again when its own fetch returns.
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

### RPT-06 · Reports — SQL validation › a report with a syntax error saves, and reopens with its SQL and the error

- **File:** [`playwright/tests/e2e/premium/reports/reports.spec.ts`](../../tests/e2e/premium/reports/reports.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "a report with a syntax error saves, and reopens with its SQL and the error"`
- **Project:** premium · **Scope:** global (`/reports/new` with no `fleet_id`), outside the scope loop
- **Mode:** UI — the save and the reopen go through the server, but every assertion is on screen ·
  **Isolation:** its own describe, with an `afterEach` that deletes the report by id.
- **Source:** QA Wolf `queries-global-users-ability-to-save-invalid-queries` (round 1 C4 #P1; round
  3, batch B)
- **Preconditions:** none.
- **Data created:** global report `pw-report-bad-sql-<nonce>` holding the broken SQL — platform
  macOS, interval **Never** (so no host runs it), **Observers can run** off, empty description —
  deleted in the `afterEach` (`DELETE /queries/id/:id`).

**Flow**

1. ☐ Navigate to `/reports/new` **via URL**.
   - ✅ *(UI)* The SQL editor content is visible (`gotoNew()` anchor).
2. ☐ Replace the SQL with `SELECT * FRM osquery_info;`.
   - ✅ *(UI)* Editor text equals it.
   - ✅ *(UI)* Inline message **"Syntax error. Please review before saving."** is visible (the
     locator accepts the variants Fleet's validator emits, with or without a line and column).
   - ✅ *(UI)* The **Save** button is still enabled (Fleet deliberately allows saving broken SQL).
3. ☐ Click **Save** → the **Save report** modal opens; fill **Name** `pw-report-bad-sql-<nonce>`,
   leave **Description** empty, set **Interval** to *Never*, leave **Observers can run** unticked,
   tick **macOS** → click **Save** in the modal. The parser finds no table in broken SQL, so the
   modal ticks no platform and keeps its Save disabled until one is ticked.
   - ✅ *(UI)* "Save report" modal visible; interval label reads *Never*.
   - ✅ *(UI)* Success toast **"Report created."**; URL settles on `/reports/:id`, whose id the
     `afterEach` deletes.
4. ☐ Open `/reports/<id>/edit` **via URL**.
   - ✅ *(UI)* The **Name** input is visible (`gotoEdit()` anchor).
   - ✅ *(UI)* The editor's SQL equals the broken SQL exactly (`sqlText()`, trimmed): Fleet stored
     it unchanged.
   - ✅ *(UI)* The syntax error is shown again — the editor validates the stored SQL as it loads.

**Assessment**
- *Value:* locks in an intentional product decision end to end: SQL the client validator flags
  still saves (the server refuses only an empty query), comes back byte-for-byte, and reopens with
  its warning. A well-meaning "fix" on either side — Save disabled on a syntax error, or the server
  rejecting the SQL — fails here.
- *Coverage gaps:* the saved name isn't re-read on reopen, and the details page the save lands on
  isn't read. No check that the error clears once the SQL is corrected. Broken SQL saved from an
  edit (the **Save** on `/reports/:id/edit`, which also asks "Save changes?") is untested. The
  modal's disabled Save with no platform ticked is relied on, not asserted.
- *Redundancy:* RPT-23 is the identical test on free. POL-19/20 make the same claim for policies:
  a different form and endpoint, the same `SQLEditor` warning and the same server rule.
- *Efficiency / smells:*
  - Step 4 reads the SQL **once**, as soon as the Name input appears. A fresh load of the edit
    page starts from Fleet's defaults and fills when the report's fetch returns — which RPT-26
    waits out with `expect.poll` — so this read can race the fetch and see the default query.
    Polling `sqlText()`, or waiting for the Name input's value first, removes the race.
  - `createdId` is set only once `saveNew()` returns, so a save the server stored but whose toast
    or redirect then failed leaves the `afterEach` with no id. The report is global, so
    `cleanup-teardown` sweeps it, and with interval *Never* no host runs it meanwhile.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### RPT-07 · Reports — new-report defaults › starts from the default osquery_info query, and the Save report modal from its defaults

- **File:** [`playwright/tests/e2e/premium/reports/reports.spec.ts`](../../tests/e2e/premium/reports/reports.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "starts from the default osquery_info query, and the Save report modal from its defaults"`
- **Project:** premium · **Scope:** global (`/reports/new` with no `fleet_id`)
- **Mode:** UI · **Isolation:** fully independent; nothing saved — the modal is cancelled.
- **Source:** QA Wolf `schedule-global-admin-can-create-edit-and-remove-teams-scheduled-query-premium`
  (round 1 C4 #P28; round 3, batch B) — its new-report defaults
- **Preconditions:** none.
- **Data created:** none.

**Flow**

1. ☐ Navigate to `/reports/new` **via URL**.
   - ✅ *(UI)* Editor content visible.
2. ☐ Read the editor without touching it.
   - ✅ *(UI)* Text contains `SELECT * FROM osquery_info`.
   - ✅ *(UI)* **Save** is enabled on an untouched form.
3. ☐ Click **Save**.
   - ✅ *(UI)* The **Save report** modal is visible.
   - ✅ *(UI)* The ticked platforms are exactly **macOS, Windows, Linux, ChromeOS** — `osquery_info`
     exists on all four, so the modal ticks every platform.
   - ✅ *(UI)* **Interval** reads *Every hour*.
   - ✅ *(UI)* **Observers can run** is unticked.
   - ✅ *(UI)* The **Automations** slider reads `aria-checked="false"`.
4. ☐ Click **Cancel**.
   - ✅ *(UI)* The modal is hidden.

**Assessment**
- *Value:* pins Fleet's `DEFAULT_QUERY` and the defaults a user saves with when they change
  nothing — the ones that decide which hosts run a new report (every platform, hourly) and
  whether its results are sent anywhere (automations off).
- *Coverage gaps:* **Advanced options** stays closed, so the Store data (on), logging type and
  minimum osquery version defaults go unread; the target default (**All hosts**) and the empty
  Name and Description aren't asserted; nothing checks that Cancel saved nothing. The platform
  default is derived from the SQL's tables, and this reads it for one query only.
- *Redundancy:* RPT-24 is the identical test on free. The modal it reads is the one RPT-01 fills.
- *Efficiency / smells:* `checkedPlatforms()` reads each checkbox once with `isChecked()`, right
  after the modal appears, rather than retrying; if Fleet ever ticked the defaults a render later,
  this would read a partial set (`expect.poll` would retry it). `platformCheckbox()` is page-wide,
  which holds on `/reports/new`, where the modal's checkboxes are the only platform ones.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### RPT-08 · Premium • Reports • automations › a report's automations are turned on, then off again, and the list says so

- **File:** [`playwright/tests/e2e/premium/reports/automations.spec.ts`](../../tests/e2e/premium/reports/automations.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "a report's automations are turned on, then off again, and the list says so"`
- **Project:** premium · **Scopes:** All fleets only
- **Mode:** UI+API · **Isolation:** self-contained; `beforeEach` seeds, `afterEach` deletes.
- **Source:** QA Wolf `queries-global-users-global-admin-can-update-managed-automations-premium`
  (round 1 C4 #P7; round 3, batch B) — the off direction and the list's cell
- **Preconditions:** `beforeEach` *(API)* `POST /queries` creates a global report
  `pw-report-auto-<timestamp>-<rand>` with SQL `SELECT 1;`, an empty description, a daily interval
  (86 400 s), snapshot logging and Store data on. The interval is what lets the list read **On**
  once automations are enabled; with no interval the cell reads **Paused**.
- **Data created:** that report — `afterEach` deletes every global report whose name contains the
  marker (`deleteReportsMatching`). While it exists it is scheduled once a day on every host on
  the instance.

**Flow**

1. ☐ Navigate to `/reports/manage` **via URL**, select **All fleets**.
   - ✅ *(UI)* Row-or-empty anchor; the dropdown reads *All fleets*.
2. ☐ Click **Manage automations**.
   - ✅ *(UI)* The **Manage automations** modal is visible.
3. ☐ Tick the checkbox whose accessible name is the seeded report's name, click **Save**.
   - ✅ *(UI)* The modal is hidden.
   - ✅ *(UI)* Success toast **"Successfully updated report automations."**
4. ☐ *(API)* `GET /queries` and find the report by id.
   - ✅ *(API)* `automations_enabled === true`.
5. ☐ Type the report's name into **Search by name**, read its **Automations** cell.
   - ✅ *(UI)* The cell reads **On**. It is found by its text — the row's cell whose whole text is
     On, Off or Paused (`automationsCell`) — rather than by column position, because the list
     re-renders its header after the modal saves, and an index read from it can land on the
     Performance cell.
6. ☐ Click **Manage automations** again.
   - ✅ *(UI)* The report's checkbox is ticked: the modal reopens on the stored state.
7. ☐ Untick it, click **Save**.
   - ✅ *(UI)* The modal is hidden; toast **"Successfully updated report automations."**
   - ✅ *(API)* `automations_enabled === false`.
   - ✅ *(UI)* The **Automations** cell reads **Off**.

**Assessment**
- *Value:* the per-report automations switch in both directions, read three ways: the stored flag
  and the list's Automations column after each save, and the modal reopening ticked in between.
- *Coverage gaps:* the **Paused** state (on, no interval) is avoided rather than asserted. The
  modal's other reports aren't asserted untouched, so a "Save enables everything" bug would pass.
  Nothing checks that automations actually reach a log destination (out of scope for e2e). A
  fleet-owned report's automations are untested.
- *Redundancy:* RPT-19 (free) is the same test apart from the describe title and the
  `teamDropdown.select` line — and `select()` is a documented no-op on free, so the two files could
  be one shared spec. RPT-01/03 read `automations_enabled` too, set from the report's own form.
- *Efficiency / smells:*
  - `findReportById` lists **global** reports only
    ([`helpers/api/reports.ts:79`](../../helpers/api/reports.ts)), so this test shape cannot be
    reused for a fleet-owned report as it stands; `getReport(id)` reads any report by id.
  - `automationsCell` matches any cell in the row whose whole text is On, Off or Paused — sound
    while no other column renders one of those words alone.
  - The daily interval schedules `SELECT 1;` on every host on the instance for the seconds the
    test runs; benign, and the price of reading **On**.
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
  report **and** any global `Copy of …` it spawned (substring match on the base name), plus
  RPT-25's fleet copy by id when that test recorded one.
- **Preconditions:** *(API)* `POST /queries` creates global `playwright-saveasnew-<ts>-<rand>`.
- **Data created:** the base report + one global duplicate; both removed in `afterEach`.

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
  were carried over. The premium-only **Fleet** field inside the modal is RPT-25's.
- *Redundancy:* RPT-20 (free) is identical source. The premium file's premium-only coverage is its
  third test, RPT-25.
- *Efficiency / smells:* `submitSaveAsNew()` contains no wait or assertion of its own
  ([`ReportEditPage.ts:359`](../../pages/reports/ReportEditPage.ts)), so all synchronisation rests
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
- **Grep:** `npx playwright test --project=free -g "Reports CRUD"` (the whole lifecycle: a serial
  sub-test needs its siblings)
- **Project:** free · **Scopes:** n/a (no team dropdown on free)
- **Mode:** UI+API · **Isolation:** serial describe, step 1 of 5; shares `reportName` /
  `editedName` / `created` / `edited` / `reportId` with the other four via closure.
- **Source:** the automations steps are QA Wolf's flow cited under RPT-01 (round 1 C4 #P2; round
  3, batch B)
- **Preconditions:** no global reports (`cleanup-setup` also gates the free project); the config
  names a result log plugin (`logging.result.plugin`).
- **Data created:** global report `playwright-report-<timestamp>`, automations on, every 30
  minutes — renamed by RPT-16, deleted by RPT-17. While it exists it is scheduled on every host on
  the instance, the free VMs included; `cleanup-teardown` sweeps it if the lifecycle dies.

**Flow**

1. ☐ Open the **dashboard** via URL, click **Reports** in the navbar.
   - ✅ *(UI)* Dashboard first card; URL `/reports/manage`.
2. ☐ Click **Add report** → URL `/reports/new`.
3. ☐ Set the SQL to `SELECT 1 AS one;` → ✅ *(UI)* editor text equals it.
4. ☐ Click **Save** → fill **Name** / **Description**, **Interval** *Every 30 minutes*, tick
   **Observers can run**, turn the **Automations** slider on → click **Save**.
   - ✅ *(UI)* "Save report" modal visible; interval label updated; slider
     `aria-checked="true"`; toast **"Report created."**; URL settles on `/reports/:id` (id parsed
     and kept as `reportId`).
5. ☐ *(API)* ✅ `created_saved_query` activity with the report's name, admin-attributed.
6. ☐ On `/reports/:id`:
   - ✅ *(UI)* `<h1>` = name, description paragraph = description.
   - ✅ *(API)* `GET /queries/:id` → `automations_enabled === true`.
   - ✅ *(UI)* The **Automations** line ends in **On**; the **Log destination** line contains the
     config's result plugin (case-insensitive).
   - ✅ *(UI)* **Show query** modal SQL contains `SELECT 1 AS one;`, modal closes.
7. ☐ Click **Reports** in the navbar, then hard-navigate to `/reports/manage`, search the name.
   - ✅ *(UI)* Row visible; **Interval** cell reads exactly *Every 30 minutes*.

**Assessment**
- *Value:* same as RPT-01, on the tier where reports are un-paywalled — a smoke test that the free
  editor + save modal work without any team plumbing, automations and the log destination
  included.
- *Coverage gaps:* identical to RPT-01's (observers-can-run/platform persistence, the modal's
  "will be sent" sentence, duplicate name).
- *Redundancy:* **direct duplicate of RPT-01** modulo the scope loop and `fleetIdFor`. Nothing about
  report creation is tier-dependent, so this pair is the strongest merge-to-`shared` candidate in
  the area — the blocker is only that premium wants the two-scope loop.
- *Efficiency / smells:* same navbar-click-then-hard-goto double navigation
  ([`free/reports/reports.spec.ts:63`](../../tests/e2e/free/reports/reports.spec.ts)); `reportId`
  serves only the API reads, as on premium.

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
- **Grep:** `npx playwright test --project=free -g "Reports CRUD"` (the whole lifecycle: a serial
  sub-test needs its siblings)
- **Project:** free · **Mode:** UI+API · **Isolation:** serial describe, step 3 of 5 — reads
  `reportId`, renames the report to `editedName`, which RPT-17/RPT-18 depend on.
- **Source:** the automations steps are QA Wolf's flow cited under RPT-01 (round 1 C4 #P2; round
  3, batch B)
- **Preconditions:** RPT-14 created the report, automations on.
- **Data created:** none new; the report is renamed, its automations turned off.

**Flow**

1. ☐ Navigate to `/reports/manage` via URL, click the report link, click **Edit report**.
   - ✅ *(UI)* `/reports/:id` then `/reports/:id/edit`; the **Name** input holds the original name.
2. ☐ Fill the whole form: SQL `SELECT version FROM osquery_info;`, **Interval** *Every 15 minutes*,
   untick **Observers can run**, platforms exactly **Windows + Linux**, **Automations** slider
   off, new **Name** and **Description**; repair pass re-applies drift.
   - ✅ *(UI)* Pre-save asserts: name, description, interval label, observers unchecked, platform
     set deep-equals `['Windows','Linux']`, editor contains the SQL, slider `aria-checked="false"`.
3. ☐ Read the sentence beside the slider → ✅ *(UI)* it contains "Historical results will not be
   sent to your log destination: `<plugin>`" (case-insensitive; plugin from `GET /config`).
4. ☐ Click **Save** → confirm **Save changes** → ✅ *(UI)* modal visible, toast **"Report
   updated."**, URL back on `/reports/:id`.
5. ☐ *(API)* ✅ `edited_saved_query` activity with the edited name, admin-attributed.
6. ☐ Details page:
   - ✅ *(UI)* `<h1>` = edited name, description = edited description.
   - ✅ *(API)* `GET /queries/:id` → `automations_enabled === false`.
   - ✅ *(UI)* The **Automations** line ends in **Off**.
   - ✅ *(UI)* **Show query** SQL contains `SELECT version FROM osquery_info;`.
7. ☐ Click **Reports** in the navbar, then hard-navigate to `/reports/manage`, search the edited
   name → ✅ *(UI)* row visible, **Interval** cell reads *Every 15 minutes*.

**Assessment**
- *Value:* same as RPT-03 — the densest free-tier report test, automations included.
- *Coverage gaps:* platforms and observers-can-run are asserted only pre-save, never re-read;
  `ReportEditPage.expectValues()` remains unused. The slider's loaded state is unasserted (it is
  clicked only when it differs, as in RPT-03). No rename-collision or discard-changes path.
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

### RPT-19 · Free • Reports • automations › a report's automations are turned on, then off again, and the list says so

- **File:** [`playwright/tests/e2e/free/reports/automations.spec.ts`](../../tests/e2e/free/reports/automations.spec.ts)
- **Grep:** `npx playwright test --project=free -g "a report's automations are turned on, then off again, and the list says so"`
- **Project:** free · **Mode:** UI+API · **Isolation:** self-contained; `beforeEach` seeds,
  `afterEach` deletes by marker.
- **Source:** same QA Wolf flow as RPT-08 (round 1 C4 #P7; round 3, batch B)
- **Preconditions:** *(API)* `POST /queries` creates `pw-report-auto-<ts>-<rand>` (`SELECT 1;`,
  daily interval, snapshot logging, Store data on — the interval lets the list read **On** rather
  than **Paused**).
- **Data created:** that report, deleted in `afterEach`. While it exists it is scheduled once a
  day on every host on the instance, the free VMs included.

**Flow**

1. ☐ Navigate to `/reports/manage` **via URL** (no team dropdown on free).
2. ☐ Click **Manage automations** → ✅ *(UI)* modal visible.
3. ☐ Tick the checkbox named after the seeded report, click **Save** → ✅ *(UI)* modal hidden;
   toast **"Successfully updated report automations."**
4. ☐ *(API)* ✅ `GET /queries` → the report's `automations_enabled === true`.
5. ☐ Search the report's name → ✅ *(UI)* its **Automations** cell (found by its text, as in
   RPT-08) reads **On**.
6. ☐ Click **Manage automations** → ✅ *(UI)* the report's checkbox is ticked.
7. ☐ Untick it, click **Save** → ✅ *(UI)* modal hidden; toast.
   - ✅ *(API)* `automations_enabled === false`.
   - ✅ *(UI)* The cell reads **Off**.

**Assessment**
- *Value:* confirms the per-report automations switch is not premium-gated, in both directions,
  with the list's column read at each end.
- *Coverage gaps:* same as RPT-08 (**Paused** avoided, other reports not asserted untouched, no log
  destination reached).
- *Redundancy:* **RPT-08 with one line removed.** `teamDropdown.select()` is already a no-op on
  free, so a single `shared/reports/automations.spec.ts` would cover both tiers with no branching.
- *Efficiency / smells:* same as RPT-08 (global-only `findReportById`, the text-matched cell, the
  daily schedule for the test's seconds).

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
- *Redundancy:* **byte-identical to RPT-12** apart from the describe title. The premium file's
  only premium-specific test is its third, RPT-25 (the modal's Fleet field); the two tests both
  files hold are pure duplication.
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
  - ~~⚠️ **The fleet is a hardcoded string.**~~ **Fixed 2026-09-28:** the test now takes the `vmsFleetId` worker fixture and asserts it resolved before using `VMS_FLEET`, so a rename fails with that message instead of a chip-not-found timeout. Original finding: `const fleet = 'VMs'` ([`reports.spec.ts:156`](../../tests/e2e/premium/reports/reports.spec.ts)) — the suite resolves this fleet by id everywhere else. If the fleet is renamed the failure is a chip-not-found timeout rather than a clear precondition error, and there is **no guard** asserting the fleet exists or holds hosts (contrast HOSTP-09, which turns exactly this class of missing furniture into a readable message).
  - ~~⚠️ **`targetChip(name)` is an unscoped substring match.**~~ **Fixed 2026-09-28:** the name is now an end-anchored regex, so a longer target containing this one cannot match. Original finding: it was an unscoped substring `getByRole('button', { name })` ([`ReportLivePage.ts:89`](../../pages/reports/ReportLivePage.ts)). A label named `VMs`, a second chip containing the word, or any other button on the page whose accessible name contains it resolves to two elements and fails strict mode. The picker offers fleets **and** labels side by side, so this is a live collision risk, not a theoretical one.
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

### RPT-23 · Reports — SQL validation › a report with a syntax error saves, and reopens with its SQL and the error *(free)*

- **File:** [`playwright/tests/e2e/free/reports/reports.spec.ts`](../../tests/e2e/free/reports/reports.spec.ts)
- **Grep:** `npx playwright test --project=free -g "a report with a syntax error saves, and reopens with its SQL and the error"`
- **Project:** free · **Mode:** UI (the save and the reopen go through the server; every assertion
  is on screen) · **Isolation:** its own describe, with an `afterEach` that deletes the report by id
- **Source:** same QA Wolf flow as RPT-06 (round 1 C4 #P1; round 3, batch B)
- **Preconditions:** none.
- **Data created:** global report `pw-report-bad-sql-<nonce>` with the broken SQL, platform macOS,
  interval **Never** — so no host runs it, the free VMs included — deleted in the `afterEach`.

**Flow**

1. ☐ Open `/reports/new` via URL, replace the SQL with `SELECT * FRM osquery_info;`.
   - ✅ *(UI)* The syntax error is visible; **Save** is still enabled.
2. ☐ Click **Save** → fill **Name** `pw-report-bad-sql-<nonce>` (Description empty), **Interval**
   *Never*, **Observers can run** unticked, tick **macOS** (the modal ticks none for broken SQL) →
   **Save** in the modal.
   - ✅ *(UI)* Toast **"Report created."**; redirect to `/reports/:id`.
3. ☐ Open `/reports/<id>/edit` via URL.
   - ✅ *(UI)* The editor's SQL equals the broken SQL exactly; the syntax error is shown again.

**Assessment**
- *Value:* confirms free saves it too; beyond that, nothing over RPT-06 — neither the form nor the
  server's acceptance rule has a tier branch.
- *Coverage gaps:* same as RPT-06.
- *Redundancy:* exact duplicate of RPT-06.
- *Efficiency / smells:* same one-shot SQL read on reopen as RPT-06, racing the edit page's fetch.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### RPT-24 · Reports — new-report defaults › starts from the default osquery_info query, and the Save report modal from its defaults *(free)*

- **File:** [`playwright/tests/e2e/free/reports/reports.spec.ts`](../../tests/e2e/free/reports/reports.spec.ts)
- **Grep:** `npx playwright test --project=free -g "starts from the default osquery_info query, and the Save report modal from its defaults"`
- **Project:** free · **Mode:** UI · **Isolation:** fully independent; nothing saved — the modal is
  cancelled.
- **Source:** same QA Wolf flow as RPT-07 (round 1 C4 #P28; round 3, batch B)
- **Preconditions:** none.
- **Data created:** none.

**Flow**

1. ☐ Open `/reports/new` via URL.
   - ✅ *(UI)* Editor text contains `SELECT * FROM osquery_info`; **Save** is enabled.
2. ☐ Click **Save**.
   - ✅ *(UI)* The **Save report** modal is visible; ticked platforms are exactly macOS, Windows,
     Linux, ChromeOS; **Interval** reads *Every hour*; **Observers can run** is unticked; the
     **Automations** slider reads `aria-checked="false"`.
3. ☐ Click **Cancel** → ✅ *(UI)* the modal is hidden.

**Assessment**
- *Value:* the same defaults on free. A free user's new report reaches every host on the
  instance, so the hourly, all-platforms default matters at least as much here.
- *Coverage gaps:* same as RPT-07 (Advanced options, target and Name/Description defaults unread;
  Cancel not shown to save nothing).
- *Redundancy:* exact duplicate of RPT-07.
- *Efficiency / smells:* same one-shot `checkedPlatforms()` read as RPT-07.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### RPT-25 · Premium • Reports • Save as new › copies into another fleet chosen in the modal's Fleet field

- **File:** [`playwright/tests/e2e/premium/reports/save-as-new.spec.ts`](../../tests/e2e/premium/reports/save-as-new.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "copies into another fleet chosen in the modal's Fleet field"`
- **Project:** premium · **Scopes:** a global report, copied into **Workstations**
- **Mode:** UI+API · **Isolation:** self-contained; the same `beforeEach` as RPT-12 seeds the base
  report, and the `afterEach` also deletes the Workstations copy by id (`fleetCopyId`):
  `deleteReportsMatching` lists global reports only, and `cleanup-setup` leaves Workstations'
  reports alone.
- **Source:** QA Wolf `queries-global-users-save-an-existing-query-as-new-query-admin-user` (round
  1 C4 #P15; round 3, batch B)
- **Preconditions:** *(API)* the seeded global `playwright-saveasnew-<ts>-<rand>` (`SELECT 1;`, no
  interval); an admin with more than one fleet to choose, since Fleet shows the modal's **Fleet**
  field only then; `workstationsFleetId` worker fixture.
- **Data created:** Workstations report `Copy of <base name>`, deleted by id in the `afterEach`.
  It inherits the base report's empty interval, so no host runs it. ⚠️ The id is recorded only once
  the API finds the copy, so a failure between the click and that lookup (the toast, say) leaves
  the copy in Workstations, where nothing sweeps it.

**Flow**

1. ☐ Open `/reports/<id>/edit` **via URL**.
   - ✅ *(UI)* Name input and editor content are both visible (`gotoEdit()` anchors).
2. ☐ Click **Save as new**.
   - ✅ *(UI)* The **Save as new** modal is visible; the name it pre-fills is kept as the copy's
     name (RPT-12 asserts its value).
   - ✅ *(UI)* The modal's **Fleet** field reads *All fleets* — the report's own scope.
3. ☐ Open the **Fleet** field, pick **Workstations** (a `TeamDropdown` scoped to the modal).
   - ✅ *(UI)* The field reads *Workstations*.
4. ☐ Click **Save** in the modal.
   - ✅ *(UI)* Toast **"Successfully added report Copy of \<base name\>."**
5. ☐ *(API)* `GET /queries?team_id=<Workstations>`, then `GET /queries/:id` on the match.
   - ✅ *(API)* The copy is listed among Workstations' reports.
   - ✅ *(API)* Its owning fleet is Workstations.
6. ☐ Open `/reports/manage?fleet_id=<Workstations>` **via URL**, select **Workstations**, search
   the copy's name.
   - ✅ *(UI)* Its row is visible.

**Assessment**
- *Value:* the premium half of Save as new, and the reason this file exists beside free's: the
  Fleet field's choice reaches the server (Workstations owns the copy) and the copy shows in that
  fleet's list.
- *Coverage gaps:* the field's options aren't read (All fleets plus the fleets the user
  administers or maintains, never Unassigned). The original isn't checked to stay global and
  unchanged, and the copy isn't checked absent from the All fleets list. The copy's SQL, interval
  and platforms aren't compared with the original's. Copying out of a fleet (Workstations → All
  fleets, or fleet → fleet) is untested.
- *Redundancy:* steps 1–2 repeat RPT-12's opening. Steps 5 and 6 prove the same placement twice:
  the API for ownership, the list row for what a user sees.
- *Efficiency / smells:*
  - The orphan risk under *Data created*: deleting `Copy of <base name>` by name from Workstations
    in the `afterEach` (`findReportByName(…, workstationsFleetId)`) would cover a failure before
    the lookup too.
  - `TeamDropdown`'s options are page-wide (`.fleet-dropdown__option`); only its trigger and label
    are scoped to the modal. Safe while one menu is open at a time.
  - Direct-URL entry, like RPT-12/13.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### RPT-26 · Shared • Reports • edit warnings › an edit that would delete a report's stored results asks first, and one that wouldn't saves straight away

- **File:** [`playwright/tests/e2e/shared/reports/edit-warnings.spec.ts`](../../tests/e2e/shared/reports/edit-warnings.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "an edit that would delete a report's stored results asks first, and one that wouldn't saves straight away"` (and `--project=free`)
- **Project:** premium **and** free (`shared/`) · **Scopes:** All fleets on premium (the dropdown
  select is a no-op on free)
- **Mode:** UI+API · **Isolation:** independent; four `test.step`s on one report, so a report names
  the step that failed; the `afterEach` deletes the report by id.
- **Source:** QA Wolf `queries-global-users-edit-and-save-query-verify-query-report-removed-reset`
  and `queries-global-users-enable-and-disable-discard-data-query-option` (round 1 C4 #P3 and #P4;
  round 3, batch B)
- **Preconditions:** none beyond the seed.
- **Data created:** global report `pw-report-edit-warnings-<nonce>`, seeded through the API with
  `SELECT 1;` and no interval, so no host ever runs it. Its description, SQL and Store data are
  edited in turn; the `afterEach` deletes it.

**Flow**

1. ☐ *(API)* Seed the report, then `GET /queries/:id`.
   - ✅ *(API)* Store data is on (`discard_data: false`) and logging is snapshot — the state in
     which Fleet guards edits at all, and what a new report gets.
2. ☐ Open the **dashboard** via URL → click **Reports** in the navbar → select **All fleets** →
   search the name → click it.
   - ✅ *(UI)* The details page's heading is the report's name.

*Step 1 — a description-only edit saves without asking*

3. ☐ Open `/reports/<id>/edit` via URL; wait until **Name** holds the report's name and the editor
   reads `SELECT 1;` (a fresh load starts from Fleet's defaults, so the saved values appearing is
   the sign the report's fetch has landed). Fill **Description** "Edited by Playwright", click
   **Save**.
   - ✅ *(UI)* Toast **"Report updated."** with no **Save changes?** modal in the DOM; URL back on
     `/reports/:id`.
   - ✅ *(API)* The description is stored.

*Step 2 — an SQL edit warns that the results go with the old query*

4. ☐ Open the edit page afresh; wait for the stored description and `SELECT 1;`; set the SQL to
   `SELECT 2;`, click **Save**.
   - ✅ *(UI)* The **Save changes?** modal reads "Changing this report's Query will delete its
     previous results, since the existing results do not reflect the updated Query."
5. ☐ Click **Save** in the modal.
   - ✅ *(UI)* Toast **"Report updated."**
   - ✅ *(API)* The query is `SELECT 2;`.

*Step 3 — turning Store data off warns that the results are deleted*

6. ☐ Open the edit page afresh; wait for `SELECT 2;`; open **Advanced options**; untick **Store
   data**; click **Save**.
   - ✅ *(UI)* **Store data** is ticked before the click and unticked after.
   - ✅ *(UI)* The modal reads the generic "The changes you are making to this report will delete
     its previous results."
7. ☐ Click **Save** in the modal.
   - ✅ *(UI)* Toast **"Report updated."**
   - ✅ *(API)* `discard_data === true`.
   - ✅ *(UI)* The details page's empty state reads **Nothing to report** / "Results from this
     report are not stored in Fleet."

*Step 4 — turning Store data back on saves without asking*

8. ☐ Open the edit page afresh; open **Advanced options**; wait for **Store data** to read
   unticked (a fresh form's default is ticked, so this is the sign the fetch landed); tick it;
   click **Save**.
   - ✅ *(UI)* Toast **"Report updated."** with no modal; URL back on `/reports/:id`.
   - ✅ *(API)* `discard_data === false`.
   - ✅ *(UI)* The empty state reads "This report does not collect data on a schedule."

**Assessment**
- *Value:* pins the rule behind Fleet's **Save changes?** prompt (`EditQueryForm`'s
  `confirmChanges`) from both sides: two edits that would delete stored results ask first, each
  with the copy that says why, and two that wouldn't save straight away. A prompt on every save,
  or on none, fails here. The details page's empty state follows Store data in both directions.
- *Coverage gaps:* the reason the prompt exists — the stored results really being deleted — isn't
  asserted: the report never runs, so there is nothing to delete, and the server's deletion
  (`server/service/queries.go`) goes unchecked. The other edits that prompt (platforms, minimum
  osquery version, a move to differential logging) and **Cancel** in the prompt (nothing saved)
  are untested.
- *Redundancy:* runs once per tier from `shared/`; the free run is the same test, and the evidence
  that none of this is tier-gated. Step 2's prompt is also passed through in RPT-03/16, which
  confirm it without reading its copy.
- *Efficiency / smells:*
  - The opening walk (dashboard → Reports → search → open) asserts only the heading; every step
    then loads the edit page by URL, so the walk serves the e2e convention rather than any step.
    The spec says why the edits don't go through **Edit report**: after that click the form fills
    from navigation state and fills again when its own fetch returns, so a value typed in between
    is overwritten and the save goes out with nothing changed, without a prompt.
  - `saveExisting({ prompt: false })` waits for the toast, then checks that no modal exists. If
    Fleet did prompt, the failure would read as a missing **"Report updated."** toast after 10 s,
    not as "a prompt opened".
  - Step 4's wait is implicit: it relies on **Store data** reading unticked, the opposite of a
    fresh form's default, rather than on a field this step set.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### RPT-27 · Premium • Reports • stored results › the long-standing gitops report holds a fresh result from the macOS VM

- **File:** [`playwright/tests/e2e/premium/reports/stored-results.spec.ts`](../../tests/e2e/premium/reports/stored-results.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "the long-standing gitops report holds a fresh result from the macOS VM"`
- **Project:** premium · **Scope:** the **VMs** fleet · **Host:** the real macOS VM
  (`requireRealHost(…, 'darwin')`)
- **Mode:** UI+API · **real VM**, read-only · **Isolation:** independent; nothing written. The
  describe retries `HOST_RETRIES` times (1 in CI, 0 locally); default 60 s timeout.
- **Source:** QA Wolf `reports-reports-disable-stored-reports-setting` (round 1 C5 #15; round 3,
  batch B), reshaped. Andrey decided (2026-10-02) not to toggle the org-wide *Store report
  results* setting: turning it off has no confirmation, and a run that crosses Fleet's hourly
  cleanup with it off deletes every stored result on the instance. This test and RPT-28 check what
  the setting protects instead.
- **Preconditions:** the macOS VM online and on the VMs fleet (asserted). `pw-host-report-results`
  declared on the VMs fleet by gitops
  ([`vms.yml`](../../../gitops/premium-fleetqa/fleets/vms.yml): `SELECT 'bar' AS foo;`, darwin,
  every 300 s, snapshot, Store data on) and never deleted by the suite — the VMs sweep deletes
  reports by exact prefix, and this name matches none.
- **Data created:** none.

**Flow**

1. ☐ *(API)* Find the online macOS VM and its fleet.
   - ✅ *(API)* It is on the VMs fleet.
2. ☐ *(API)* Find `pw-host-report-results` among the VMs fleet's reports, then `GET /queries/:id`.
   - ✅ *(API)* It exists.
   - ✅ *(API)* It stores its results (`discard_data: false`).
3. ☐ *(API)* `GET /hosts/<vm>/queries` → the report's `last_fetched` for the VM.
   - ✅ *(API)* It isn't null.
   - ✅ *(API)* It is younger than twice the report's interval plus 120 s — 720 s at 300 s. osquery
     runs the report every interval, so a VM that is still collecting has stored a row within one;
     the rest is room for a run that's just due and its delivery.
4. ☐ Open the **dashboard** via URL → click **Reports** in the navbar → pick **VMs** in the fleet
   dropdown → search the report → click it.
   - ✅ *(UI)* The results table's row for the VM (matched by display name) contains `bar`.

**Assessment**
- *Value:* the only check that scheduled collection is still running on the instance, rather than
  that a row once existed. HOSTP-09 reads the same row but not its age, so a Mac whose osquery
  stopped weeks ago, or a server that stopped storing results (the org setting off, say), still
  passes there; here it fails within 12 minutes of the last row. It runs in seconds: nothing waits.
- *Coverage gaps:* the age is read through the API; the report page's own timestamp isn't read,
  and the UI row can't tell fresh from stale, since the SQL returns `bar` every time. Only the
  macOS VM is checked (the report targets darwin). The org setting itself — its **Store report
  results** checkbox, and what turning it off does — is untested by decision.
- *Redundancy:* overlaps HOSTP-09 (same report, VM and `bar`). HOSTP-09 reads it through the
  host's Reports tab and the per-host page; this test through the report's own page, plus the age.
- *Efficiency / smells:*
  - It stands on gitops furniture and on the Mac's uptime. An offline or paused VM fails it, which
    is the point, but a run review should check the VM before calling it a product defect.
  - `getHostReportLastFetched` returns null on any non-OK response, so an API error fails as "the
    macOS VM has stored a result"; `listReports` returns `[]` on error, so a failed list reads as
    the report missing from `vms.yml`.
  - The age compares the runner's clock with the server's timestamp; the 120 s slack absorbs
    ordinary skew.
  - `getHostReportLastFetched` reads `GET /hosts/:id/queries`, while `getHostReportRows` and
    `listHostReportIds` use `/hosts/:id/reports`: two names for one surface in one helper file.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### RPT-28 · Premium • Reports • stored results › a report created with Store data on collects a result from the macOS VM

- **File:** [`playwright/tests/e2e/premium/reports/stored-results.spec.ts`](../../tests/e2e/premium/reports/stored-results.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "a report created with Store data on collects a result from the macOS VM"`
- **Project:** premium · **Scope:** the **VMs** fleet · **Host:** the real macOS VM
- **Mode:** UI+API · **real VM** · **Timeout:** 420 s; the poll waits up to 300 s ·
  **Isolation:** independent; the describe retries `HOST_RETRIES` times; `try/finally` deletes
  the report. No `afterEach`.
- **Source:** same QA Wolf flow and decision as RPT-27 (round 1 C5 #15, reshaped; round 3,
  batch B)
- **Preconditions:** the macOS VM online and on the VMs fleet (asserted).
- **Data created:** VMs-fleet report `pw-stored-results-<nonce>` (`SELECT '<name>' AS stored;`,
  macOS, Store data on), run every 60 s on the fleet's macOS hosts while it exists; deleted in the
  `finally`. Playwright aborts a timed-out test before its `finally` runs, so a timed-out
  attempt's report keeps running on the Mac until the VMs sweep in `cleanup.steps.ts` deletes
  `pw-stored-results-*` (at the end of the run, or at the start of the next).

**Flow**

1. ☐ *(API)* Find the online macOS VM and its fleet.
   - ✅ *(API)* It is on the VMs fleet.
2. ☐ Open the **dashboard** via URL → click **Reports** in the navbar → pick **VMs** in the fleet
   dropdown → click **Add report** → set the SQL to `SELECT '<name>' AS stored;`.
   - ✅ *(UI)* URL `/reports/new`; editor text equals the SQL.
3. ☐ Click **Save** → fill **Name** `pw-stored-results-<nonce>`, **Description**, **Interval**
   *Every 5 minutes*, **Observers can run** unticked, platforms **macOS** only → open **Advanced
   options**, leave **Store data** ticked (its default) → click **Save** in the modal.
   - ✅ *(UI)* "Save report" modal visible; interval label reads *Every 5 minutes*; **Store data**
     is ticked.
   - ✅ *(UI)* Toast **"Report created."**; URL settles on `/reports/:id`.
4. ☐ *(API)* `GET /queries/:id`.
   - ✅ *(API)* `discard_data === false`: the modal's Store data reached the server.
5. ☐ *(API)* `PATCH /queries/:id` → interval 60 s (the UI's shortest is 5 minutes).
6. ☐ *(API)* Poll `GET /hosts/<vm>/reports/<id>` every 10 s, for up to 5 minutes.
   - ✅ *(API)* The VM's stored rows are exactly `[{ stored: <name> }]`.
7. ☐ Open `/reports/<id>?fleet_id=<VMs>` **via URL**.
   - ✅ *(UI)* The results table's row for the VM contains the report's name.
8. ☐ *(API)* `finally`: delete the report.

**Assessment**
- *Value:* a report created through the UI today still stores results end to end: the modal's
  Store data reaches the server, the Mac runs the report on schedule, Fleet stores its answer, and
  the report page shows it. The row is the VM's answer to this run's own SQL (a name unique to the
  run), so neither a leftover row nor a simulation's canned answer could satisfy it.
- *Coverage gaps:* Store data is the modal's default, so the test confirms it rather than choosing
  it. The **Collecting results...** state before the first row isn't read, nor is a later run
  replacing the row. The org-wide setting is untested by decision (RPT-27).
- *Redundancy:* **high with LT-09** ([area 22](22-label-targeting.md)), which also creates a report
  on the VMs fleet through the UI, cuts it to 60 s through the API and polls for the Mac's stored
  row. This adds the Store data checkbox in the modal, `discard_data` read back, and the row on the
  report's own page; LT-09 adds label targeting. Folding the three into LT-09 would save one wait
  on the Mac per run, typically a minute or two and up to five.
- *Efficiency / smells:*
  - No `afterEach` (see *Data created*). The sweep catches it, at the price of a report running
    every 60 s on the Mac for the rest of the run.
  - `getHostReportRows` returns `[]` on any non-OK response, so an API failure surfaces after five
    minutes as "the macOS VM never stored a row".
  - VM-bound minutes on one worker; with `HOST_RETRIES` a failing run spends up to twice the 420-s
    timeout here.
  - The report page is opened by URL rather than through the list (step 2 already walked it).

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
| Create a report (editor → Save report modal) | RPT-01, RPT-14 (automations on); RPT-28 (platforms, Store data, on the VMs fleet) | duplicate-name on create; modal platform / target / observers fields never re-read; the modal's "will be sent to your log destination" sentence unread |
| New-report defaults | RPT-07, RPT-24 (default SQL; four platforms, *Every hour*, observers off, automations off; Cancel) | **Advanced options** defaults (Store data, logging, minimum osquery version) and the target default unread |
| Report details page (`/reports/:id`) | RPT-01/03, RPT-14/16 (name, description, Show query, **Automations** On/Off, **Log destination**); RPT-26 (the empty state with Store data off, and with no schedule); RPT-27/28 (the VM's stored row) | **Back to reports** button; the "Collecting results..." state; the frequency display |
| Edit a report | RPT-03, RPT-16 (every field, automations off); RPT-26 (which edits ask "Save changes?", and the copy) | platforms + observers-can-run persistence after reload (`ReportEditPage.expectValues()` exists and is **called by no spec**); the slider's loaded state; rename collision; unsaved-changes warning; the prompt for platforms / minimum osquery version / differential logging; **Cancel** in the prompt |
| Store data, per report | RPT-26 (off: prompt, `discard_data`, "not stored in Fleet"; back on: no prompt); RPT-28 (on: the Mac's row is stored) | that turning it off deletes stored rows — RPT-26's report has none |
| Delete a report | RPT-04, RPT-17 | cancel in the modal; multi-row bulk delete; post-delete 404 |
| Activity-feed copy | RPT-05, RPT-18 + `tests/api/activity-copy.spec.ts` | ordering / actor / count |
| List name search | RPT-09 (only test with a negative assertion) | no free counterpart; clear-search; no-match empty state |
| List platform filter | RPT-10 | only macOS; All-platforms reset untested; **Platform** column contents never asserted |
| Inherited (global → team) | RPT-11 | converse direction; inherited-report read-only affordances |
| Per-report automations | RPT-08, RPT-19 (on → off in **Manage automations**, the list's On/Off cell); RPT-01/03, RPT-14/16 (the form's slider, the details page) | the **Paused** state; other reports untouched by a save; results reaching the log destination; a fleet report's automations; the global log-destination config |
| Save as new | RPT-12/13, RPT-20/21; RPT-25 (into Workstations through the modal's **Fleet** field) | proof the duplicate is a *new* id; SQL/description carry-over; the **Fleet** field's options (never Unassigned); copying out of a fleet |
| Live report — navigation | RPT-02, RPT-15 (**navigation only — never clicks Run**) | see the row below; real-result coverage lives only in [`shared/hosts/host-live-query.spec.ts`](../../tests/e2e/shared/hosts/host-live-query.spec.ts) against `liveMacosHost` |
| Live report — target picker | RPT-22 (**fleet chip only**, premium) | **Run** still never clicked: *Running* → *Report finished*, `N targeted / P% responded`, Stop / Run again / Close and the Errors tab remain untested. Within the picker: the selected-targets table is never read, the host count is matched as `\d+` rather than reconciled against `GET /hosts?fleet_id=`, and **All hosts** / platform / label / individual-host targets and multi-select are untested (no free counterpart, so platform + label targeting is uncovered on both tiers) |
| SQL validation | RPT-06, RPT-23 (a report with a syntax error saves and reopens with its SQL and warning) | the error clearing on corrected SQL; broken SQL saved from an edit |
| Reports list pagination / sorting / column set | — | untested (only `tests/loadtest/reports.spec.ts` touches the list at scale, for timing) |
| Scheduled reports storing results | RPT-27 (the gitops report's row is fresh), RPT-28 (a new report's row arrives); LT-09 in [area 22](22-label-targeting.md) | the org-wide **Store report results** setting (untested by decision, 2026-10-02); the Windows and Ubuntu VMs; the stored set replaced on the next run; nothing on free — no fleets there, so no report survives `cleanup-setup`, and a global one lands on ~300 simulations |

**Live-query reality check.** What a live-report test *can* assert on the premium/free QA instances:
route transitions, the **Select targets** screen, target-row contents, that **Run** starts a
campaign, the *Report finished* heading, and the `N host(s) targeted (P% responded)` summary — with
`resultsRows` and `noResultsState` treated as **alternatives**, never as an expected row count.
What it *cannot* assert: any result value, any row count, or that the report's SQL was the query
that ran — the osquery-perf simulations answer with a canned row whatever the SQL. RPT-02 / RPT-15
stay on the safe side of that line, so **no test in this area fakes result validation**; the
defect is the opposite — their titles claim a run they never perform, and they stop three steps
before the plumbing that *is* assertable. RPT-22 takes one of those three steps — the target
picker, Run's enablement, and the targeted-host count — and deliberately stops before pressing
**Run**, so the area still has no coverage of the run screen itself even though the list above
says most of it is assertable. *Scheduled* results are a different surface: RPT-27 / RPT-28 read
rows the real macOS VM stored for reports on the VMs fleet, and RPT-28's row answers SQL unique to
the run, so no simulation could produce it.

**Duplication**

1. **Free CRUD is a transcription of premium CRUD** — RPT-14/15/16/17/18 vs RPT-01/02/03/04/05.
   Same data objects, same steps, same assertions; the deltas are the scope loop, the
   `teamDropdown.select()` calls, and `fleetIdFor()`. Free/premium separation is a deliberate house
   convention, but here it also means every fix has to land twice (and hasn't — see the RPT-03 vs
   RPT-16 hard-navigate divergence).
2. **The two Save-as-new tests both tiers hold are byte-identical** (RPT-12/13 vs RPT-20/21).
   Premium's third test, RPT-25 (the modal's **Fleet** field), is the premium file's only
   premium coverage.
3. **`automations.spec.ts` premium vs free differ by one no-op line** (RPT-08 vs RPT-19), on → off
   and the list's cell included.
4. **Every report activity is asserted twice** — once via `assertActivity` (API) inside
   create/edit/delete, once via the dashboard feed in the final sub-test. On premium that is
   3 API + 3 UI assertions per scope, ×2 scopes, plus 3 + 3 on free = 12 assertions of the same
   6 copy strings, on top of `tests/api/activity-copy.spec.ts`.
5. **RPT-02/RPT-15's list→details→edit walk is re-run verbatim** by RPT-03/RPT-16 immediately after — and a fifth time by RPT-22, whose only unique steps are the three picker assertions at the end.
6. **A query with a syntax error, saved and reopened,** appears four times: RPT-06 / RPT-23 here and
   POL-19 / POL-20 for policies. The same `SQLEditor` warning and the same server rule (only an
   empty query is refused), through two forms; within each area the free twin is pure duplication,
   and RPT-07 / RPT-24 are the same kind of pair.
7. **The stored-results specs overlap two other areas' specs.** RPT-28 repeats LT-09's wait
   ([area 22](22-label-targeting.md)): a report created on the VMs fleet through the UI, cut to
   60 s through the API, and the Mac's stored row polled for. RPT-27 reads HOSTP-09's report and
   row ([area 03](03-hosts-premium.md)), adding only the age and the report's own page.

**UI-vs-API balance**

- **Justified API use:** the three `assertActivity` calls check `type` + `details.query_name` +
  `actor_email` — the activity *record* contract, which the rendered feed can't show (actor email,
  event type). Keeping *one* layer per event is defensible; keeping both, as now, is not.
- **API beside a UI check, for the same field:** `automations_enabled` in RPT-08 / RPT-19 (beside
  the modal reopening ticked and the list's On/Off cell) and in RPT-01/03, RPT-14/16 (beside the
  details page's **Automations** line). Each API read supplements a UI assertion rather than
  replacing one; the UI half is the one a user sees.
- **API as the oracle where the screen shows nothing:** RPT-26's reads of `description`, `query`
  and `discard_data` after each save (the empty state is the UI half for Store data); RPT-25's
  proof that Workstations owns the copy (the Workstations list row is the UI half); RPT-27's
  `last_fetched` age, which no screen in its flow shows; RPT-28's poll for the Mac's row, followed
  by the same row on the report page. These are justified: a toast or a list row doesn't prove the
  stored state.
- **Legitimate API setup (not validation):** `createReport` / `deleteReportsMatching` in
  automations, list-filters and save-as-new, `createReport` in RPT-26, and `setReportInterval(60)`
  in RPT-28 (the UI's shortest interval is 5 minutes) — correct; doing these through the UI would
  be pure cost. `findReportById` / `deleteReportsMatching` list **global** reports only
  ([`helpers/api/reports.ts:61`](../../helpers/api/reports.ts)); `getReport(id)` reads any report
  by id and `findReportByName` takes a fleet, which is how RPT-25 reaches its Workstations copy.
- **Everything else is UI**, and the UI assertions are mostly strong (exact `toHaveText` on the
  name heading, description, and Interval cell rather than `toBeVisible`). The two weak ones are
  `rowOrEmpty()` in RPT-04/RPT-17 (unfalsifiable) and the `/reports/\d+/` URL regex in
  RPT-12/RPT-20 (matches the report you started from).

**Quick wins**

1. Rename RPT-02 / RPT-15 to what they do (e.g. `opens the live-report target picker`) **or** extend
   them by three lines — select a target, **Run**, assert the *Report finished* heading and the
   `% responded` summary with `resultsRows`/`noResultsState` as alternatives
   ([`reports.spec.ts:83`](../../tests/e2e/premium/reports/reports.spec.ts),
   [`free/reports/reports.spec.ts:72`](../../tests/e2e/free/reports/reports.spec.ts)).
2. Call the already-written `ReportEditPage.expectValues(edited)`
   ([`ReportEditPage.ts:485`](../../pages/reports/ReportEditPage.ts)) after `saveExisting()` in
   RPT-03/RPT-16 — that closes the platforms + observers-can-run persistence gap for free. Teach it
   the Automations slider first, so the reopened form's slider is read too.
3. Add the hard `reportsList.goto({ fleetId })` to premium RPT-03 step 7
   ([`reports.spec.ts:117`](../../tests/e2e/premium/reports/reports.spec.ts)) so it matches RPT-01 and
   free RPT-16; the documented stale-list bug applies there too.
4. `reportId` is already in the describe closure (RPT-01 sets it); reach the report with
   `reportDetails.goto(reportId)` in RPT-02/03 — removes two list loads, two dropdown selects and
   two searches per scope ([`reports.spec.ts:57`](../../tests/e2e/premium/reports/reports.spec.ts)).
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
8. In RPT-01, assert `getReport(reportId).fleetId` against the scope: the step already makes the
   call, and the owning fleet is what proves the report landed in the *selected* scope.
9. Make RPT-06 / RPT-23's reopen wait for the stored SQL (`expect.poll(() => reportEdit.sqlText())`,
   as RPT-26 does) instead of reading it once while the edit page's fetch may still be in flight.
10. Make the two fleet-report cleanups survive a timeout or an early failure: an `afterEach` in
    RPT-28 that deletes `pw-stored-results-<nonce>` by name on the VMs fleet, and an `afterEach` in
    RPT-25 that deletes `Copy of <base name>` by name from Workstations rather than by an id
    recorded only after the API lookup.

**Bigger bets**

1. **Collapse the tier duplication for the non-scoped report specs.** RPT-08 / RPT-19 differ by a
   no-op select, and RPT-12/13 vs RPT-20/21 are identical. Move `automations.spec.ts` and the two
   shared Save-as-new tests to `tests/e2e/shared/reports/`, beside `edit-warnings.spec.ts`, and keep
   RPT-25 — the one test that needs the **Fleet** field — in a premium file. Net −1 file and −3
   test declarations, no behaviour lost.
2. **Pick one activity layer.** Either keep `assertActivity` in the mutating sub-tests and delete
   the final feed sub-test (relying on `tests/api/activity-copy.spec.ts` + one representative feed
   test for the rendering contract), or keep the feed sub-test and drop the three API calls. As
   written the area pays for both, and the feed walk is its slowest assertion.
3. **Give the reports list a proper filter/table spec, mirrored on free.** `list-filters.spec.ts` is
   premium-only and covers three of ~eight list behaviours; pagination, sorting, the **Platform**
   column, All-platforms reset, and the no-match empty state are all unowned. A single shared
   list-behaviour spec seeded via the API would cover more than the current premium file at similar
   runtime.
4. **Prove what the "Save changes?" prompt promises.** RPT-26 can't: its report never runs, so it
   has no results to lose. RPT-28 already pays for a stored row on the Mac; editing that report's
   SQL afterwards and asserting the VM's rows are gone (`getHostReportRows` → `[]`) costs seconds,
   not another wait, and covers the deletion RPT-26 leaves out. If RPT-28 folds into LT-09
   (duplication 7), the check goes with it.
