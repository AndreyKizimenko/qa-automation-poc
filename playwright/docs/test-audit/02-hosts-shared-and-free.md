# Hosts — shared + free — test audit

**Specs covered:** 9 files · **Test declarations:** 14 · **Projects:** premium + free (the 7 `shared/hosts` specs run in **both** projects), free only (the 2 `free/hosts` specs)

This area covers the hosts list (`/hosts/manage`: column chooser, CSV export, Add hosts modal, role-gated CTAs) and the single-host detail page (`/hosts/:id`: vitals + refetch, Local user accounts card, Software tab, Reports tab, Actions menu, live report against one host). The seven `shared/` specs are one-flow-per-file with no serial describes and no shared mutable state; the two `free/` specs are role/paywall matrices that live in `free/` because their expected answer inverts on premium (each has a `premium/hosts/` mirror).

**Host-population split — read this before reproducing anything manually.** Five of the 14 tests bind to the *real* MDM-enrolled macOS VM through the `liveMacosHost` worker fixture ([`fixtures.ts:256`](../../fixtures.ts)); the rest run against whatever osquery-perf simulation the API resolver happens to return. Simulated hosts ignore live-query SQL, report thin/absent vitals, and are not MDM-enrolled.

| Test | Host population |
|---|---|
| HOST-01, HOST-02, HOST-03 | real macOS VM (`liveMacosHost`) |
| HOST-05, HOST-06 | real macOS VM (`liveMacosHost`) — HOST-06 does not actually need it |
| HOST-04 | first host by name reporting software — in practice a simulation |
| HOST-07, HOST-08, HOST-09, HOST-10, HOST-11 | no specific host; whatever tops/fills the list |
| HOST-12, HOST-13 | real MDM-enrolled macOS / Windows VM (`kind: 'real'`) |
| HOST-14 | any online Linux host — real Linux VMs are *not* MDM-enrolled, so this can land on either a real VM or a simulation |

## Contents

| ID | Spec | Test | Mode | Manual? |
|---|---|---|---|---|
| HOST-01 | `shared/hosts/host-details-smoke.spec.ts` | Host details — refetch re-collects the host vitals | UI+API | ☐ |
| HOST-02 | `shared/hosts/host-details-smoke.spec.ts` | Host details — local user accounts card filters by username | UI | ☐ |
| HOST-03 | `shared/hosts/host-details-smoke.spec.ts` | Host details — Agent tooltip reports osquery and Orbit versions | UI | ☐ |
| HOST-04 | `shared/hosts/host-software.spec.ts` | Hosts — software tab search filters, and a title links to filtered hosts | UI | ☐ |
| HOST-05 | `shared/hosts/host-live-query.spec.ts` | Host details — runs a saved report live against the host | UI | ☐ |
| HOST-06 | `shared/hosts/host-reports-tab.spec.ts` | Host details — reports tab lists the host reports, searches, and sorts | UI | ☐ |
| HOST-07 | `shared/hosts/edit-columns.spec.ts` | Hosts — Edit columns shows and hides the User email column | UI | ☐ |
| HOST-08 | `shared/hosts/export-csv.spec.ts` | Hosts — Export hosts downloads a CSV that includes the listed hosts | UI | ☐ |
| HOST-09 | `shared/hosts/add-hosts-download.spec.ts` | Hosts — Add hosts modal downloads the certificate, enroll secret, and flagfile | UI+API | ☐ |
| HOST-10 | `free/hosts/cta-visibility.spec.ts` | global admin sees Add hosts, Enroll secrets, and Export hosts | UI | ☐ |
| HOST-11 | `free/hosts/cta-visibility.spec.ts` | global observer sees only Export hosts | UI | ☐ |
| HOST-12 | `free/hosts/mdm-actions-availability.spec.ts` | macOS (MDM-enrolled) offers only Turn off MDM | UI | ☐ |
| HOST-13 | `free/hosts/mdm-actions-availability.spec.ts` | Windows (MDM-enrolled) offers none of Lock, Wipe or Turn off MDM | UI | ☐ |
| HOST-14 | `free/hosts/mdm-actions-availability.spec.ts` | Ubuntu (no MDM) offers none of Lock, Wipe or Turn off MDM | UI | ☐ |

`Mode`: **UI** = all validation through the browser · **UI+API** = browser flow with some API assertions · **API** = no meaningful UI validation · **PERF** = timing.

---

### HOST-01 · Host details — refetch re-collects the host vitals

- **File:** [`playwright/tests/e2e/shared/hosts/host-details-smoke.spec.ts`](../../tests/e2e/shared/hosts/host-details-smoke.spec.ts)
- **Grep:** `npx playwright test -g "Host details — refetch re-collects the host vitals"`
- **Project:** premium + free (shared) · **Scopes:** n/a (single host, no team dropdown)
- **Mode:** UI+API · **Isolation:** standalone test, no describe, no shared state
- **Preconditions:** **the real macOS VM** — `liveMacosHost` resolves the first online, **MDM-enrolled** `darwin` host via `findOnlineHost(request, 'darwin', { kind: 'real' })` ([`helpers/api/hosts.ts:170`](../../helpers/api/hosts.ts), [`fixtures.ts:256`](../../fixtures.ts)); the fixture *throws* (not skips) if the VM is off or unenrolled. The VM must be checking in on its distributed interval — a wedged osquery makes this fail, not flake harmlessly. Manually: pick the real VM in Hosts, not a `playwright-*`-looking simulation.
- **Data created:** none (refetch mutates only the host's `detail_updated_at`)

**Flow**

1. ☐ *(API precondition)* `GET /hosts/:id` → record `host.detail_updated_at` as `before` — `getHostDetailUpdatedAt` ([`helpers/api/hosts.ts:244`](../../helpers/api/hosts.ts), which itself asserts the response is OK).
2. ☐ Open `/hosts/:id` via URL; page is considered ready when the **Disk space available** vital is visible (`HostDetailsPage.goto`).
3. ☐ Wait for **Refetch** to be enabled, then click it (`refetch()` waits for the idle label so it can't race a refetch already in flight).
   - ✅ *(UI)* The header's `Last fetched …` line settles to **"Last fetched less than a minute ago"** (60s budget).
   - ✅ *(API)* `GET /hosts/:id` `detail_updated_at` polls to a value **different from `before`** (30s budget) — proves the fresh vitals came from this refetch, not a background detail cycle.

**Assessment**
- *Value:* real regression catch — the refetch button actually round-trips to the agent and Fleet stores + renders newer vitals. The API delta makes it a genuine assertion rather than a copy check.
- *Coverage gaps:* no assertion on the transient **"Fetching fresh vitals…"** disabled state; no assertion that a *specific* vital changed; no offline-host path (Fleet shows an error/"host is offline" affordance) and no error toast path.
- *Redundancy:* none.
- *Efficiency / smells:* clean. `lastFetched` is a class locator (`.host-header__last-fetched`) but that is justified in the POM ([`pages/hosts/HostDetailsPage.ts:36`](../../pages/hosts/HostDetailsPage.ts) — role-less div). Worst case is a slow test (up to ~90s of waits) rather than a weak one.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOST-02 · Host details — local user accounts card filters by username

- **File:** [`playwright/tests/e2e/shared/hosts/host-details-smoke.spec.ts`](../../tests/e2e/shared/hosts/host-details-smoke.spec.ts)
- **Grep:** `npx playwright test -g "Host details — local user accounts card filters by username"`
- **Project:** premium + free (shared) · **Mode:** UI · **Isolation:** standalone
- **Preconditions:** **the real macOS VM** (`liveMacosHost`, same resolver as HOST-01). Additionally the VM must have already reported **local user accounts** *and* at least one username must not be a substring of another (`unambiguousUsername`). The fixture does **not** request `withUsers: true`, so this precondition is only discovered at assert time — it fails with `no distinctly-named local user among …`.
- **Data created:** none (read-only)

**Flow**

1. ☐ *(precondition, from the fixture's API read)* Pick a username from `liveMacosHost.usernames` (sourced from `GET /hosts/:id` → `host.users[].username`) that no other username contains.
   - ✅ *(API-derived guard)* Such a username exists — else hard-fail with the full username list.
2. ☐ Open `/hosts/:id` via URL (ready when **Disk space available** is visible).
   - ✅ *(UI)* The **Local user accounts** card heading is visible.
   - ✅ *(UI)* The card's table has at least one row.
3. ☐ Type the chosen username into **Search local user accounts by username**.
   - ✅ *(UI)* Exactly **1** row remains in the card.
   - ✅ *(UI)* That row's username cell equals the searched username exactly.

**Assessment**
- *Value:* covers a small, genuinely user-facing filter (client-side substring search inside the card) plus the fact that the card renders real reported users. Cheap.
- *Coverage gaps:* no no-match/empty-state assertion ("No users detected on this host" / zero-result copy); no clearing the search to restore all rows; nothing on the card's other columns (shell, uid, groups) or its pagination/"show more" affordance.
- *Redundancy:* shares the whole page load with HOST-01 and HOST-03 — three separate tests each doing `goto(liveMacosHost.id)` against the same VM in the same file (see *Duplication* below).
- *Efficiency / smells:* the substring-uniqueness dance is clever but makes the test's subject data-dependent and non-reproducible by hand from the spec alone (Andrey has to read `GET /hosts/:id` to know which user it will pick). Simpler: assert `usersRows` count drops *and* every remaining row contains the term. Also, the fixture should be requesting `withUsers: true` — the option exists ([`helpers/api/hosts.ts:141`](../../helpers/api/hosts.ts)) but `liveMacosHost` doesn't pass it, so a VM whose `users` detail query hasn't landed produces a confusing failure instead of a clear precondition error.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOST-03 · Host details — Agent tooltip reports osquery and Orbit versions

- **File:** [`playwright/tests/e2e/shared/hosts/host-details-smoke.spec.ts`](../../tests/e2e/shared/hosts/host-details-smoke.spec.ts)
- **Grep:** `npx playwright test -g "Host details — Agent tooltip reports osquery and Orbit versions"`
- **Project:** premium + free (shared) · **Mode:** UI · **Isolation:** standalone
- **Preconditions:** **the real macOS VM** (`liveMacosHost`). The VM must be a **fleetd** host (reporting `orbit_version`) — vanilla-osquery hosts render the Agent value as plain text with no tooltip. The fixture does not pass `withOrbit: true` even though the POM explicitly tells callers to ([`pages/hosts/HostDetailsPage.ts:357`](../../pages/hosts/HostDetailsPage.ts)).
- **Data created:** none (read-only)

**Flow**

1. ☐ Open `/hosts/:id` via URL (ready when **Disk space available** is visible).
   - ✅ *(UI)* The **Agent** vital's value (the `<dd>` of the `Agent` term, via `DataSet`) contains the VM's `orbit_version` as reported by `GET /hosts/:id`.
2. ☐ Hover the **Agent** value (the inner tooltip-wrapper element, since the `<dd>` padding doesn't trigger it).
   - ✅ *(UI)* A `role="tooltip"` appears containing `osquery: <osquery_version>`.
   - ✅ *(UI)* The same tooltip contains `Orbit: <orbit_version>`.

**Assessment**
- *Value:* confirms the vitals panel surfaces the true agent versions and that the hover tooltip splits fleetd vs osquery correctly — a real (if narrow) regression target after agent-version rendering changes.
- *Coverage gaps:* the tooltip's third line (**Fleet Desktop** version) is not asserted; no vanilla-osquery counterpart (no-tooltip case); no other vital is checked at all (Memory, Processor, Operating system, Disk encryption, Public/Private IP, Added to Fleet) even though the page load is already paid for.
- *Redundancy:* same page-load duplication as HOST-02.
- *Efficiency / smells:* `liveMacosHost.orbitVersion!` ([`host-details-smoke.spec.ts:76`](../../tests/e2e/shared/hosts/host-details-smoke.spec.ts)) non-null-asserts a value the fixture never guaranteed — if the VM ever reports no Orbit version this throws inside `toContainText` with an opaque message. Either add `withOrbit: true` to `liveMacosHost` or assert the precondition explicitly like HOST-02 does.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOST-04 · Hosts — software tab search filters, and a title links to filtered hosts

- **File:** [`playwright/tests/e2e/shared/hosts/host-software.spec.ts`](../../tests/e2e/shared/hosts/host-software.spec.ts)
- **Grep:** `npx playwright test -g "software tab search filters, and a title links to filtered hosts"`
- **Project:** premium + free (shared) · **Mode:** UI · **Isolation:** standalone, read-only
- **Preconditions:** **a simulated host, not the VM.** `findHostWithSoftware` ([`helpers/api/hosts.ts:77`](../../helpers/api/hosts.ts)) takes the first host by `display_name` ascending (scans up to 50) whose `GET /hosts/:id/software` returns anything — on the QA instances that is an osquery-perf simulation. The host must report **at least two** titles whose names differ in their first alphanumeric token (otherwise the `filteredOut` guard hard-fails). The chosen title must also have a software-title detail page with a **Hosts** count link. Host may be offline — last-reported inventory persists.
- **Data created:** none

**Flow**

1. ☐ *(API precondition)* Resolve a host reporting software (`GET /hosts?per_page=50&order_key=display_name` then `GET /hosts/:id/software?per_page=1` per candidate).
   - ✅ *(API)* Such a host exists.
2. ☐ Open `/hosts/:id` via URL, click the **Software** tab.
   - ✅ *(UI)* The software table settles to either rows **or** its empty state — `openSoftwareTab()` uses `rowOrEmpty()` ([`pages/hosts/HostDetailsPage.ts:158`](../../pages/hosts/HostDetailsPage.ts)), so an empty table satisfies this wait.
3. ☐ Switch the software view dropdown to **Full inventory** (macOS hosts default to "Applications"; the method silently no-ops on Windows/Linux, where the dropdown doesn't exist).
   - ✅ *(UI)* On macOS, the URL gains `macos_applications=false`.
4. ☐ Read the Name-column links.
   - ✅ *(UI)* At least one software title is listed.
   - ✅ *(derived guard)* A listed title exists that does **not** contain the first token of `names[0]`.
5. ☐ Type the first token of the first title into **Search by name or vulnerability (CVE)**.
   - ✅ *(UI)* The searched title's Name link is still visible.
   - ✅ *(UI)* The non-matching title's Name link is gone (`toHaveCount(0)`) — this is the assertion that proves the server-side filter landed.
6. ☐ Click the searched title's Name link → software title detail page.
   - ✅ *(UI)* The `software display name` heading is visible; its text is captured.
7. ☐ Click the **Hosts** count metric (targeted by its `software_title_id` href) → hosts list.
   - ✅ *(UI)* A filter pill (`role="status"`, name `hosts filtered by …`) is visible.
   - ✅ *(UI)* The pill contains the **first token** of the title's display name.

**Assessment**
- *Value:* decent — covers three joins in one pass (host inventory renders, host-scoped software search hits the server, software-title → filtered-hosts-list deep link carries its filter).
- *Coverage gaps:* the **Vulnerable** filter on the host's software tab is never applied here (`applyVulnerableFilter()` exists and is unused by this area); CVE search (the same input accepts a CVE) untested; the **Library** sub-tab untested from the host side; no assertion that the filtered hosts list actually contains the host we came from — which would be the real payoff of step 7; version/type/last-used columns unasserted.
- *Redundancy:* the software-title → hosts-list pill hop overlaps the software area's own title-detail specs (see the software audit file); the host-side entry point is the unique part.
- *Efficiency / smells:* (a) the final pill assertion is weak — `toContainText(firstToken(titleName))` ([`host-software.spec.ts:56`](../../tests/e2e/shared/hosts/host-software.spec.ts)) accepts a partial name match, so a pill naming the *wrong* title with a shared first word passes; (b) `showFullInventory()`'s `if ((await trigger.count()) === 0) return;` ([`HostDetailsPage.ts:184`](../../pages/hosts/HostDetailsPage.ts)) is a deliberate but silent branch — the test cannot tell you whether it ran the macOS or the non-macOS path; (c) `rowOrEmpty()` in step 2 tolerates an empty table (the test still fails one step later at `names.length > 0`, so this is a diagnosability smell, not a silent pass); (d) the subject title is whatever sorts first for that host, so the test is not reproducible by hand without the API read.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOST-05 · Host details — runs a saved report live against the host

- **File:** [`playwright/tests/e2e/shared/hosts/host-live-query.spec.ts`](../../tests/e2e/shared/hosts/host-live-query.spec.ts)
- **Grep:** `npx playwright test -g "Host details — runs a saved report live against the host"`
- **Project:** premium + free (shared) · **Mode:** UI · **Isolation:** standalone; seeds + deletes its own uniquely-named report in a `try/finally`
- **Preconditions:** **the real macOS VM** (`liveMacosHost`) — this is the one test in the area that *requires* a real device: simulations ignore the SQL and return no rows ~20% of the time. The VM must be online and answering on its distributed interval. Live-query must be enabled on the instance. Runtime is long (up to 90s waiting for **Report finished**).
- **Data created:** global saved report `pw-hostlq-<timestamp>-<rand>` with query `SELECT 'bar' AS foo;` via `POST /queries` — deleted in `finally` by `deleteReportsMatching` (lists reports, deletes every name containing the marker).

**Flow**

1. ☐ *(API setup)* Create the marker report (`createReport`, [`helpers/api/reports.ts:18`](../../helpers/api/reports.ts)) — global scope, so it shows up in every host's report picker until deleted.
2. ☐ Open `/hosts/:id` via URL, click **Actions → Live report**.
   - ✅ *(UI)* The **Select a report** modal is visible.
   - ✅ *(UI)* The modal offers the **create a report** link (authoring path exists alongside running a saved one).
3. ☐ Type the marker into **Filter reports**.
   - ✅ *(UI)* The seeded report's entry is visible.
4. ☐ Click the seeded report's entry.
   - ✅ *(UI)* The modal closes.
   - ✅ *(UI)* URL contains `host_id=<the host's id>` — the report's edit screen carries the host through as the live-run target.
5. ☐ Click **Live report** on the edit screen → lands on `/reports/:id/live`.
   - ✅ *(UI)* The **Select targets** heading is visible (`waitForReady`).
   - ✅ *(UI)* The selected-targets table has exactly **1** row.
   - ✅ *(UI)* That row names the VM (`displayName`).
6. ☐ Click **Run**.
   - ✅ *(UI)* **Report finished** heading appears (90s budget; Fleet closes the campaign at `FLEET_LIVE_QUERY_REST_PERIOD`, default 25s, even if the host never answers).
   - ✅ *(UI)* Run summary contains **"1 host targeted"**.
   - ✅ *(UI)* Run summary contains **"100% responded"**.
   - ✅ *(UI)* Results table has exactly **1** row, attributed to the VM, containing the value the SQL selected (`bar`).
7. ☐ *(API teardown)* Delete every report whose name contains the marker.

**Assessment**
- *Value:* highest-value test in the area. End-to-end it proves campaign creation, WebSocket streaming, target propagation from the host page into the report editor, and that the host executed the *actual* SQL (the `bar` assertion is the only place in this area where a live result value is checked).
- *Coverage gaps:* no **Stop** / cancel-mid-run path; **Errors** tab never opened; no assertion on the results table's column headers (`foo`); no CSV export of results; no "0% responded"/offline-target path; the **create a report** link is asserted visible but never clicked.
- *Redundancy:* overlaps the reports area's own live-run specs on the run mechanics; unique in entering from **host → Actions → Live report** and in asserting a single-host target.
- *Efficiency / smells:* clean and well-isolated. Two cost notes: the seeded report is **global**, so while it exists it appears in every other host's report picker and in the Reports list (marker-scoped assertions elsewhere keep this safe, but it's shared visible state); and `deleteReportsMatching` does a full list + filter, which is fine but O(all reports).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOST-06 · Host details — reports tab lists the host reports, searches, and sorts

- **File:** [`playwright/tests/e2e/shared/hosts/host-reports-tab.spec.ts`](../../tests/e2e/shared/hosts/host-reports-tab.spec.ts)
- **Grep:** `npx playwright test -g "reports tab lists the host reports, searches, and sorts"`
- **Project:** premium + free (shared) · **Mode:** UI · **Isolation:** standalone; seeds + deletes two marker reports in `try/finally`
- **Preconditions:** binds to **the real macOS VM** (`liveMacosHost`) — but only uses its `displayName` in the "awaiting results" copy. ⚠️ Nothing here needs a real device; any online host would do. Manually reproducible on any host.
- **Data created:** two global saved reports `pw-hostrpt-<ts>-<rand>-omega` then `-alpha` (created omega-first so default "Newest results" order differs from name order), query defaults to `SELECT 1;`, no platform restriction → they apply to every host. Both deleted in `finally`.

**Flow**

1. ☐ *(API setup)* `POST /queries` twice — omega, then alpha.
2. ☐ Open `/hosts/:id` via URL, click the **Reports** tab.
   - ✅ *(UI)* URL ends in `/reports`.
   - ✅ *(UI)* The tab settles to report cards **or** the "No reports scheduled" empty state ([`HostDetailsPage.ts:306`](../../pages/hosts/HostDetailsPage.ts)).
   - ✅ *(UI)* The tab's count reads `N report(s)` (regex `/\d+ reports?/` — the number itself is not tied to anything).
   - ✅ *(UI)* The **"Show reports that don't store results"** toggle is `aria-checked="false"` by default.
3. ☐ Type the marker into **Search by name**.
   - ✅ *(UI)* Exactly **2** report cards remain.
   - ✅ *(UI)* A card titled `…-alpha` is visible; a card titled `…-omega` is visible.
   - ✅ *(UI)* The alpha card reads **"Fleet is awaiting results from `<host display name>`"** — the no-stored-result state.
4. ☐ Open the sort dropdown, pick **Name A-Z**.
   - ✅ *(UI)* URL contains `sort=name_asc`.
   - ✅ *(UI)* Card names, in render order, poll to `[alpha, omega]`.
5. ☐ Open the sort dropdown, pick **Name Z-A**.
   - ✅ *(UI)* URL contains `sort=name_desc`.
   - ✅ *(UI)* Card names poll to `[omega, alpha]`.
6. ☐ *(API teardown)* Delete both marker reports.

**Assessment**
- *Value:* moderate. The sort assertions are real (URL param **and** rendered order), and the marker scoping makes them robust under parallel workers. The "awaiting results" copy assertion is a nice product-behaviour check.
- *Coverage gaps:* the **"don't store results" toggle is asserted at its default and never flipped** — its actual filtering behaviour is untested, which is the only interesting thing about it. **Newest/Oldest results** sort options untested. Card **Actions → View report for all hosts** never exercised; **Show details** is knowingly out of scope (needs a stored result). The unfiltered count is never reconciled with the number of cards. No empty-state path.
- *Redundancy:* overlaps `premium/hosts/host-report-details.spec.ts` (the stored-result drill) on tab entry; overlaps the reports area on report creation.
- *Efficiency / smells:* (a) **uses the scarce `liveMacosHost` fixture for a display-name string** — this puts avoidable contention on the one real VM and couples an otherwise host-agnostic test to VM uptime; swap to `findOnlineHost(..., 'darwin')` or `findHostWithSoftware`. (b) `reportsCount` matching `/\d+ reports?/` is a shape check, not a value check — it would pass on `0 reports`. (c) `openReportsTab()`'s `.or(reportsEmptyState)` tolerates an empty tab; the later `toHaveCount(2)` is what saves the test.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOST-07 · Hosts — Edit columns shows and hides the User email column

- **File:** [`playwright/tests/e2e/shared/hosts/edit-columns.spec.ts`](../../tests/e2e/shared/hosts/edit-columns.spec.ts)
- **Grep:** `npx playwright test -g "Edit columns shows and hides the User email column"`
- **Project:** premium + free (shared) · **Scopes:** Unassigned on premium; no-op on free (no dropdown)
- **Mode:** UI · **Isolation:** standalone; restores the column state by toggling twice
- **Preconditions:** at least one host visible in the list (`goto()` waits for the first row containing a link, [`HostsListPage.ts:153`](../../pages/hosts/HostsListPage.ts)). ⚠️ Also assumes **User email is hidden in the stored browser state** — hidden columns are a per-context `localStorage` preference and the project's saved auth state carries `localStorage`, so a polluted `.auth/*-admin.json` would break the very first assertion. No specific host needed.
- **Data created:** none (a localStorage preference, toggled back)

**Flow**

1. ☐ Open `/hosts/manage` via URL; wait for the first host row.
2. ☐ On premium, select **Unassigned** in the team dropdown (idempotent; skipped on free).
   - ✅ *(UI)* The **User email** column header is **hidden** (Fleet's default column set).
3. ☐ Click **Edit columns**, tick **User email** in the modal, click **Save** (modal closes).
   - ✅ *(UI)* The **User email** column header is now visible.
4. ☐ Click **Edit columns**, untick **User email**, click **Save**.
   - ✅ *(UI)* The **User email** column header is hidden again.

**Assessment**
- *Value:* low-to-moderate. Catches a broken column chooser (modal wiring / persistence to the table), which is a real if rarely-changing feature.
- *Coverage gaps:* only one column of ~20 is exercised; no check that the toggled column actually renders **data** (the point of `device_mapping`); no check that the preference **survives a reload** — which is the actual product promise of the feature; no multi-column select/deselect; no "Save" vs dismiss-without-saving distinction (Cancel/X path untested).
- *Redundancy:* none in this area.
- *Efficiency / smells:* `columnHeader()` uses a non-exact `columnheader` name match — fine today. The bigger smell is that the first assertion encodes an environment assumption (default column set + clean localStorage) rather than establishing it; a reset step or a "assert then restore in a fixture" would make it self-healing.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOST-08 · Hosts — Export hosts downloads a CSV that includes the listed hosts

- **File:** [`playwright/tests/e2e/shared/hosts/export-csv.spec.ts`](../../tests/e2e/shared/hosts/export-csv.spec.ts)
- **Grep:** `npx playwright test -g "Export hosts downloads a CSV that includes the listed hosts"`
- **Project:** premium + free (shared) · **Scopes:** Unassigned on premium; no-op on free
- **Mode:** UI · **Isolation:** standalone, read-only
- **Preconditions:** at least one host in the (Unassigned) list. No specific host — whatever sorts first. Browser downloads must be permitted (Playwright default).
- **Data created:** a temp CSV in Playwright's download dir (auto-cleaned)

**Flow**

1. ☐ Open `/hosts/manage` via URL; wait for the first host row.
2. ☐ On premium, select **Unassigned** (no-op on free).
3. ☐ Read the first row's host-name link text.
   - ✅ *(UI)* It is non-empty.
4. ☐ Click **Export hosts** and capture the browser download.
   - ✅ *(UI/file)* The downloaded CSV's text contains the first host's display name.

**Assessment**
- *Value:* low. It proves the export endpoint fires, returns a file, and the file is not empty of hosts. That's a smoke check.
- *Coverage gaps:* no header-row/column assertion (the CSV's column set is the thing that breaks); **no assertion that the export respects the current view** — filters, search term, selected team, or the visible column selection (which HOST-07 shows is configurable); no row-count sanity check; the bulk-selection export path ("export N selected") untested.
- *Redundancy:* the **Export hosts** button's *visibility* is also asserted in HOST-10 and HOST-11 (and their premium mirrors) — three tests touch the same button, only this one clicks it.
- *Efficiency / smells:* the assertion is the weakest form available (`csv.toContain(name)` on a ~300-row file). Making the export follow a search term (`search=<name>` then assert the CSV has exactly a header + 1 row) would turn this into a real test at the same cost. `firstHostName()` returning `''` on a missing link is guarded by the `length > 0` check, so no silent pass.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOST-09 · Hosts — Add hosts modal downloads the certificate, enroll secret, and flagfile

- **File:** [`playwright/tests/e2e/shared/hosts/add-hosts-download.spec.ts`](../../tests/e2e/shared/hosts/add-hosts-download.spec.ts)
- **Grep:** `npx playwright test -g "Add hosts modal downloads the certificate, enroll secret, and flagfile"`
- **Project:** premium + free (shared) · **Scopes:** All fleets on premium (so the modal serves the **global** enroll secret); no-op on free (always global)
- **Mode:** UI+API · **Isolation:** standalone, read-only
- **Preconditions:** logged in as an admin (the **Add hosts** button is role-gated — see HOST-10/11); at least one host in the list for `goto()` to settle; the instance must have a global enroll secret configured. No specific host.
- **Data created:** three temp downloads (auto-cleaned)

**Flow**

1. ☐ Open `/hosts/manage` via URL; wait for the first host row.
2. ☐ On premium, select **All fleets** (no-op on free).
3. ☐ Click **Add hosts** → the Add hosts modal opens.
4. ☐ Click the **Advanced** tab.
   - ✅ *(UI)* The Fleet-certificate **Download** control is visible.
5. ☐ Click the certificate **Download**, capture the file.
   - ✅ *(file)* Its contents contain `BEGIN CERTIFICATE`.
6. ☐ Click **Plain osquery** to expand that section.
   - ✅ *(UI)* The enroll-secret **Download** button is visible.
7. ☐ *(API)* `GET /spec/enroll_secret` → the list of global enroll secrets (`getGlobalEnrollSecrets`).
8. ☐ Click the enroll-secret **Download**, capture the file.
   - ✅ *(API+file)* The file's trimmed contents match one of the API's global enroll secrets — the strongest assertion in this test.
9. ☐ Click the flagfile **Download**, capture the file.
   - ✅ *(file)* Contains `--enroll_secret_path=secret.txt`.
   - ✅ *(file)* Contains `--tls_server_certs=fleet.pem`.

**Assessment**
- *Value:* good for its size — the enroll-secret file matching the API's secret is a genuine contract check (a wrong-scope secret here would silently break real enrollment), and the flagfile flags are the ones that matter.
- *Coverage gaps:* the modal's **default (fleetd) tab** is never visited — the platform install commands / fleetd installer download / "Download installer" path is the way most users enroll and is entirely untested; the on-screen enroll-secret **text and its copy button** untested; no premium **team-scoped** variant (select Workstations → assert the file matches that fleet's secret via `getTeamEnrollSecrets`), which is the case most likely to regress; certificate is only checked for a PEM header, not that it matches the server's actual cert.
- *Redundancy:* enroll-secret *management* is covered by `premium/settings/enroll-secrets.spec.ts`; this is the only consumer of `AddHostsModal`.
- *Efficiency / smells:* `certificateDownload` takes `.first()` ([`pages/components/AddHostsModal.ts:31`](../../pages/components/AddHostsModal.ts)) because the control duplicates once Plain osquery is expanded — documented and ordered around, acceptable. Three role-less class scopes in this component, each with a justification comment.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOST-10 · Free • Hosts • CTA visibility by role › global admin sees Add hosts, Enroll secrets, and Export hosts

- **File:** [`playwright/tests/e2e/free/hosts/cta-visibility.spec.ts`](../../tests/e2e/free/hosts/cta-visibility.spec.ts)
- **Grep:** `npx playwright test --project=free -g "global admin sees Add hosts, Enroll secrets, and Export hosts"`
- **Project:** free only · **Mode:** UI · **Isolation:** standalone; own browser context via `withStaticUser` (the shared admin storage state is untouched)
- **Preconditions:** the pre-provisioned static user `global-admin@fleetdm.com` exists on the **free** instance and `FLEET_STATIC_USER_PASSWORD` is set; at least one host visible so `goto()` settles. `withStaticUser` reuses a cached session if valid, else logs in fresh and caches ([`helpers/auth.ts:105`](../../helpers/auth.ts)).
- **Data created:** a cached session file for the static user

**Flow**

1. ☐ Log in as **global-admin** in a fresh context (or reuse its cached session), open `/hosts/manage` via URL.
   - ✅ *(UI)* **Add hosts** button visible.
   - ✅ *(UI)* **Enroll secrets** button visible (exact-name match, so it can't be satisfied by the empty-state "Manage enroll secrets" link).
   - ✅ *(UI)* **Export hosts** button visible.

**Assessment**
- *Value:* low as written — a global admin seeing the primary CTAs is the trivially-true case, and every other admin test in the suite would fail if it weren't. Its real function is to be the **control** for HOST-11.
- *Coverage gaps:* free has more roles than admin/observer — **maintainer** and **observer+** are not covered here (the premium mirror does test maintainer); no check that the buttons *work* for the admin (HOST-09 covers Add hosts implicitly); no team-admin/team-maintainer dimension (n/a on free).
- *Redundancy:* near-total with [`premium/hosts/cta-visibility.spec.ts`](../../tests/e2e/premium/hosts/cta-visibility.spec.ts), which asserts the identical three buttons for `global-admin` + `global-maintainer`. The expected answer does **not** differ by tier (these CTAs have no license gate), so this pair is duplication rather than a tier matrix — unlike HOST-12/13/14, where the premium/free split is load-bearing. Also note the observer title is byte-identical across the two files, so `-g` without `--project` hits both.
- *Efficiency / smells:* pure visibility assertions (`toBeVisible`) with no interaction — the weakest assertion class. Enters by direct URL rather than clicking through the navbar (acceptable for a presence check, per the suite's own convention note). Merging this file's admin case into the premium spec's role loop and keeping only the *observer* case on free would lose nothing.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOST-11 · Free • Hosts • CTA visibility by role › global observer sees only Export hosts

- **File:** [`playwright/tests/e2e/free/hosts/cta-visibility.spec.ts`](../../tests/e2e/free/hosts/cta-visibility.spec.ts)
- **Grep:** `npx playwright test --project=free -g "global observer sees only Export hosts"`
- **Project:** free only · **Mode:** UI · **Isolation:** standalone; own context via `withStaticUser`
- **Preconditions:** static user `global-observer@fleetdm.com` on the free instance; at least one host visible to an observer.
- **Data created:** a cached session file

**Flow**

1. ☐ Log in as **global-observer** in a fresh context, open `/hosts/manage` via URL.
   - ✅ *(UI)* **Export hosts** button visible (no role gate).
   - ✅ *(UI)* **Add hosts** button absent (`toHaveCount(0)`).
   - ✅ *(UI)* **Enroll secrets** button absent (`toHaveCount(0)`).

**Assessment**
- *Value:* moderate — this is a real **negative-space** assertion and negative space is where RBAC regressions actually land (a gating change exposing enroll controls to an observer). The paired positive case (HOST-10) is what keeps it honest: without it, a page that failed to render *any* CTA would also pass the two `toHaveCount(0)` lines. Worth keeping the pair together for that reason. That said, UI-absence assertions are cheap-to-fool coverage: the buttons being hidden says nothing about whether the **API** would refuse an observer's enroll-secret read — that is `tests/api/role-access/free/global-roles.spec.ts`'s job, and it does not currently probe host/enroll-secret endpoints.
- *Coverage gaps:* observer's host **Actions** menu on the detail page is not checked here (no Transfer/Delete/Run script absence); no observer+ / maintainer rows; no attempt to reach `/hosts/manage?manage_enroll_secrets=1` directly as an observer, which is the assertion that would prove the gate isn't merely cosmetic.
- *Redundancy:* byte-identical test title and body to the observer case in [`premium/hosts/cta-visibility.spec.ts`](../../tests/e2e/premium/hosts/cta-visibility.spec.ts) — same expectation on both tiers.
- *Efficiency / smells:* `toHaveCount(0)` on a `getByRole('button')` is the right shape for absence (it retries and doesn't pass on a slow render the way a bare `toBeHidden()` on a missing element can be misread). Direct-URL entry as above.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOST-12 · Free • Hosts • MDM action availability › macOS (MDM-enrolled) offers only Turn off MDM

- **File:** [`playwright/tests/e2e/free/hosts/mdm-actions-availability.spec.ts`](../../tests/e2e/free/hosts/mdm-actions-availability.spec.ts)
- **Grep:** `npx playwright test --project=free -g "macOS \(MDM-enrolled\) offers only Turn off MDM"`
- **Project:** free only · **Mode:** UI · **Isolation:** standalone (one of three cases generated from a `CASES` array — separate `test()` per case, not a loop-around-describe)
- **Preconditions:** **a real, online, MDM-enrolled macOS VM on the free instance** — resolved by `findOnlineHost(request, 'darwin', { kind: 'real' })`, i.e. `mdm_enrollment_status=enrolled`. Not the `liveMacosHost` fixture, but the same resolver and in practice the same machine. Apple MDM must be configured on the free instance and the device still enrolled/connected, or the expectation flips. Hard-fails (`not.toBeNull()`) rather than skipping when no such host exists.
- **Data created:** none. **Nothing destructive is ever clicked** — the test only opens the Actions menu.

**Flow**

1. ☐ *(API precondition)* Resolve an online real macOS host (`GET /hosts?status=online&platform=darwin&mdm_enrollment_status=enrolled`, re-filtered client-side on the host's own `platform`).
   - ✅ *(API)* Such a host exists.
2. ☐ Open `/hosts/:id` via URL, click **Actions**.
   - ✅ *(UI)* At least one option renders (`openActions()`).
   - ✅ *(UI)* **Turn off MDM** is offered exactly once — not premium-gated.
   - ✅ *(UI)* **Lock** is absent (`toHaveCount(0)`) — Fleet Premium feature.
   - ✅ *(UI)* **Wipe** is absent (`toHaveCount(0)`) — Fleet Premium feature.

**Assessment**
- *Value:* the highest-value negative-space test in the area, and worth defending. This is the **paywall assertion for Lock and Wipe** — it is the only automated check that free doesn't expose two irreversible device commands, and the regression it guards (a gating change leaking a destructive action to the wrong tier) is exactly the kind that ships unnoticed. The mixed matrix is what gives it teeth: because **Turn off MDM must be present** in the same menu, an entirely-empty or unrendered menu fails the test. That is the difference between this and a pure absence check.
- *Coverage gaps:* the absence is asserted only in the UI — no API probe that `POST /hosts/:id/lock` returns 402 on free, which is where a determined user would go. Nothing here checks the **role** dimension (observer on premium vs admin) or the `Unlock` option; nothing verifies the greyed-out/tooltip "premium feature" affordance if Fleet renders one; the command itself is deliberately never fired (see `docs/qawolf-migration/PARITY.md` §6).
- *Redundancy:* mirrors [`premium/hosts/mdm-actions-availability.spec.ts`](../../tests/e2e/premium/hosts/mdm-actions-availability.spec.ts) case-for-case, but with an **inverted** expectation (premium expects all three). This is legitimate tier-matrix duplication, not waste — unlike HOST-10/11.
- *Efficiency / smells:* `actionOption()` is a class-scoped locator with a `^label$` regex ([`HostDetailsPage.ts:255`](../../pages/hosts/HostDetailsPage.ts)) — justified (react-select options carry no roles). Per-case assertion messages name the expectation, so failures are self-explaining. Two of the three cases contend for the same real VMs as HOST-01/02/03/05.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOST-13 · Free • Hosts • MDM action availability › Windows (MDM-enrolled) offers none of Lock, Wipe or Turn off MDM

- **File:** [`playwright/tests/e2e/free/hosts/mdm-actions-availability.spec.ts`](../../tests/e2e/free/hosts/mdm-actions-availability.spec.ts)
- **Grep:** `npx playwright test --project=free -g "Windows \(MDM-enrolled\) offers none of Lock, Wipe or Turn off MDM"`
- **Project:** free only · **Mode:** UI · **Isolation:** standalone
- **Preconditions:** **a real, online, MDM-enrolled Windows VM on the free instance** (`findOnlineHost(request, 'windows', { kind: 'real' })`). Windows MDM must be configured and the VM still enrolled. Hard-fails if absent.
- **Data created:** none; menu is opened only.

**Flow**

1. ☐ *(API precondition)* Resolve an online real Windows host.
   - ✅ *(API)* Such a host exists.
2. ☐ Open `/hosts/:id` via URL, click **Actions**.
   - ✅ *(UI)* At least one option renders.
   - ✅ *(UI)* **Lock** absent — premium-gated.
   - ✅ *(UI)* **Wipe** absent — premium-gated.
   - ✅ *(UI)* **Turn off MDM** absent — `canTurnOffMdm` requires an Apple device.

**Assessment**
- *Value:* this one **is** a pure negative-space assertion — all three expectations are "absent". Its value is therefore weaker than HOST-12's and rests entirely on `openActions()`'s `expect(actionOptions.first()).toBeVisible()` guard, which is the only thing standing between this test and passing on a menu that failed to render at all (the menu always has non-MDM entries like Transfer/Delete/Run script, so the guard does hold). Worth keeping — it's the Apple-only gate on Turn off MDM, which is genuinely counter-intuitive and could regress — but it would be materially stronger if it also asserted a *positive* option is present, e.g. **Transfer** or **Run script**, mirroring HOST-12's mixed matrix.
- *Coverage gaps:* as HOST-12, plus: nothing asserts *which* options the Windows menu does offer.
- *Redundancy:* inverted mirror of the premium Windows case (premium expects Lock + Wipe, no Turn off MDM). Legitimate.
- *Efficiency / smells:* the free instance needs a real enrolled Windows VM purely for this one test; if the Windows VM is the least reliably-provisioned host on the free instance, this is the test that will hard-fail first (and it fails with a clear `expected an online windows host` message, which is the right behaviour).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOST-14 · Free • Hosts • MDM action availability › Ubuntu (no MDM) offers none of Lock, Wipe or Turn off MDM

- **File:** [`playwright/tests/e2e/free/hosts/mdm-actions-availability.spec.ts`](../../tests/e2e/free/hosts/mdm-actions-availability.spec.ts)
- **Grep:** `npx playwright test --project=free -g "Ubuntu \(no MDM\) offers none of Lock, Wipe or Turn off MDM"`
- **Project:** free only · **Mode:** UI · **Isolation:** standalone
- **Preconditions:** **any online Linux host** — `findOnlineHost(request, 'linux', {})` with **no `kind` constraint**, so this can resolve either a real Linux VM or an osquery-perf simulation; the resolver also omits Fleet's `platform` param for linux (there is no linux label group) and filters client-side across ubuntu/debian/rhel/… ([`helpers/api/hosts.ts:303`](../../helpers/api/hosts.ts)). MDM state is irrelevant here, which is why no `kind` is needed. Manually: any online Linux row will do.
- **Data created:** none; menu is opened only.

**Flow**

1. ☐ *(API precondition)* Resolve an online Linux host.
   - ✅ *(API)* Such a host exists.
2. ☐ Open `/hosts/:id` via URL, click **Actions**.
   - ✅ *(UI)* At least one option renders.
   - ✅ *(UI)* **Lock** absent — premium-gated (on premium, Linux *does* offer it via scripts, with no MDM needed).
   - ✅ *(UI)* **Wipe** absent — same.
   - ✅ *(UI)* **Turn off MDM** absent — Apple-only.

**Assessment**
- *Value:* pure negative space again, and the weakest of the three cases: all three actions are absent for *two independent reasons* (tier gate and platform gate), so a single regression in either gate can be masked by the other. Its unique contribution is confirming that Fleet's script-driven Linux Lock/Wipe — which needs no MDM at all — is still tier-gated on free. That is a real and non-obvious gate. Same "add a positive option" recommendation as HOST-13.
- *Coverage gaps:* as HOST-13. Also: the premium mirror expects **Lock + Wipe present** on Linux, so this free case is the only side asserting the gate; if the premium Linux case is the one that breaks, this test stays green.
- *Redundancy:* inverted mirror of the premium Ubuntu case. Legitimate.
- *Efficiency / smells:* cheapest of the three (no real-VM dependency, so it can run against the plentiful sim pool). Note the `{}` requirements object means this test is the only MDM-availability case that does **not** contend for a real VM — good, and worth preserving if the others are ever refactored.

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
| Hosts list renders / first row loads | HOST-07, HOST-08, HOST-09 (incidentally, via `goto()`'s anchor) | no explicit list-rendering test; column values, host-count header, sorting by column all untested here |
| Hosts list search | — | **not covered** in this area (search box exists on `HostsListPage`); loadtest measures search timing only |
| Status / Label / Platform filters | — | **not covered.** `StatusFilter`, `LabelFilter`, `PlatformDropdown` component objects exist but no `shared`/`free` hosts spec uses them (only the software vulnerability specs and loadtest do) |
| Pagination of the hosts list | — | **not covered** in e2e (only `settings/users/pagination.spec.ts` uses `Pagination`) |
| Edit columns | HOST-07 | one column only; no reload-persistence check |
| Export hosts CSV | HOST-08 | no header/column, filter-respect, or selected-rows export |
| Add hosts modal | HOST-09 | **fleetd tab / installer download / copyable install commands entirely untested**; no team-scoped enroll secret |
| Enroll secrets management | `premium/settings/enroll-secrets.spec.ts` | free-tier enroll-secret modal untested |
| Bulk select / transfer / delete | `premium/hosts/{bulk-transfer,host-delete}.spec.ts` | no free-tier bulk path; "Select all matching hosts" untested |
| Host details vitals | HOST-01, HOST-03 | only Agent + (implicitly) Disk space; Memory, Processor, OS, Disk encryption, IPs, Added to Fleet unasserted |
| Refetch | HOST-01 | no in-flight/disabled state, no offline-host path |
| Local user accounts card | HOST-02 | no empty state, no clear-search, other columns unasserted |
| Host software tab | HOST-04 | Vulnerable filter, CVE search, Library sub-tab, self-referential hosts-list check missing |
| Host reports tab | HOST-06 | "don't store results" toggle behaviour, Newest/Oldest sorts, card Actions untested |
| Host live report | HOST-05 | Stop/cancel, Errors tab, results CSV, 0%-responded path |
| Host Actions menu | HOST-12/13/14 (presence/absence only) | Transfer/Run script/Delete from details on free untested; Lock/Wipe/Unlock **commands never fired** (deliberate, `PARITY.md` §6) |
| Host policies tab | — | **not covered** in this area (`policiesTab` locator exists, unused) |
| Host activity card | — | **not covered** (`firstActivityTimestamp` / `activityEmptyState` locators exist, unused here) |
| Host certificates table (Details tab) | — | **not covered** (only referenced as the reason `usersCard` needs scoping) |

**Duplication**

1. **HOST-01/02/03** — three tests, one file, same real VM, three separate `goto(liveMacosHost.id)` page loads. Independent concerns, so the split is defensible for failure attribution, but the VM round-trips are paid three times and all three share the same fixture-precondition failure mode.
2. **HOST-10/11 vs `premium/hosts/cta-visibility.spec.ts`** — the observer test is byte-identical across tiers and the admin case is a subset of the premium role loop. These CTAs have **no license gate**, so there is no tier matrix to express: this is straight duplication. (Contrast HOST-12/13/14, where the inversion is the whole point.)
3. **Export hosts button** — visibility asserted in HOST-10, HOST-11 and both premium CTA tests; clicked only in HOST-08.
4. **Report seeding** — HOST-05 and HOST-06 each create global marker reports via `POST /queries` and clean up with `deleteReportsMatching`; the reports area does the same again. Consistent pattern, worth a shared `disposableReport` fixture.
5. **`findOnlineHost(..., { kind: 'real' })`** is invoked by HOST-12 and HOST-13 directly and by the `liveMacosHost` fixture for HOST-01/02/03/05/06 — five worker-level resolutions of essentially the same machine per run.

**UI-vs-API balance**

Healthy overall — 12 of 14 tests validate through the browser, and the two API assertions are both *justified* rather than shortcuts:

- **HOST-01** uses `GET /hosts/:id → detail_updated_at` to prove the "Last fetched less than a minute ago" text followed from *this* refetch. There is no UI-only way to distinguish that from a background detail cycle, so the API check is the assertion, not a shortcut.
- **HOST-09** compares the downloaded enroll-secret file against `GET /spec/enroll_secret`. Correctness here *is* a value-match against server state; the UI cannot self-verify it.

API use elsewhere is **precondition/setup only** (host resolution, report seeding, teardown) — which is the right shape. No test in this area substitutes an API read for a UI assertion it could have made. The opposite problem exists instead: several UI assertions are weaker than they need to be (see quick wins 1 and 2), and the **absence-only** assertions in HOST-13/HOST-14 have no API counterpart proving the gate is enforced server-side (a `402` probe on `POST /hosts/:id/lock` in `tests/api/free/endpoints.spec.ts` would close that, and that file currently has no host/lock probes).

**Quick wins**

1. Add `withUsers: true` and `withOrbit: true` to the `liveMacosHost` fixture ([`fixtures.ts:256`](../../fixtures.ts)) — turns HOST-02's and HOST-03's data-luck failures into clear precondition errors and removes the unsafe `orbitVersion!` at [`host-details-smoke.spec.ts:76`](../../tests/e2e/shared/hosts/host-details-smoke.spec.ts).
2. Strengthen HOST-08: search the hosts list for the first host's name before exporting, then assert the CSV has a header row + exactly one data row and the expected column names ([`export-csv.spec.ts:20`](../../tests/e2e/shared/hosts/export-csv.spec.ts)).
3. Repoint HOST-06 off `liveMacosHost` to any online host ([`host-reports-tab.spec.ts:28`](../../tests/e2e/shared/hosts/host-reports-tab.spec.ts)) — it only needs a display name, and this frees the real VM for the four tests that genuinely need it.
4. Add one positive option assertion (e.g. **Transfer** present) to HOST-13 and HOST-14 ([`mdm-actions-availability.spec.ts:72`](../../tests/e2e/free/hosts/mdm-actions-availability.spec.ts)) so the all-absent cases can't pass on a half-rendered menu.
5. In HOST-04, replace the filter-pill `firstToken` substring check with the full title text, and assert the filtered hosts list actually contains the host the test drilled from ([`host-software.spec.ts:55`](../../tests/e2e/shared/hosts/host-software.spec.ts)).

**Bigger bets**

1. **Collapse the CTA-visibility duplication.** Fold the free admin case into the premium spec's role loop and keep a single tier-agnostic role matrix (admin/maintainer/observer/observer+) under `shared/hosts/`, since none of these CTAs is license-gated. Removes 2 free tests and adds the two missing roles.
2. **Cover the hosts-list filter surface.** `StatusFilter`, `LabelFilter`, `PlatformDropdown` and `Pagination` are all built and unused by this area — one `shared/hosts/list-filters.spec.ts` (status × platform × label, each asserting the row count/URL param changes and the filter pill) would close the largest single gap in the area, and it runs happily against the sim fleet.
3. **Cover the Add hosts fleetd path.** The Advanced/plain-osquery branch is tested while the default fleetd tab — the one nearly every real enrollment uses — is not. Add the platform tabs, the copyable install command, and (premium) a team-scoped enroll-secret assertion via `getTeamEnrollSecrets`.
