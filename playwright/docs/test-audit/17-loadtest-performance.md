# Loadtest / performance — test audit

**Specs covered:** 11 files · **Test declarations:** 73 · **Entries below:** 11 (one per spec file) · **Project:** loadtest

`tests/loadtest/` times how long Fleet's list and detail pages take to become usable against a
deliberately over-populated instance (500 policies / 500 reports / 500 labels / 400 scripts /
205 profiles / 240 script-only packages / 276 FMAs / 100 certificates in one team). Every test is
the same one-liner shape — `measureNav` or `measureSearch` wrapped around a direct-URL `goto()` or a
single filter/tab/sort interaction, plus a visibility assertion that marks "the page is ready".
Because 73 near-identical declarations would produce 73 near-identical entries, this file documents
**one entry per spec file**, with the measured navigations enumerated in a table inside it.

> **Read this first — the project records timings, it does not gate on them.**
> There is no threshold, budget, baseline, or regression gate anywhere in `helpers/perf.ts`,
> `helpers/perf-teardown.ts`, `playwright.config.ts`, or any spec. No `expect(ms).toBeLessThan(...)`,
> no non-zero exit on a slowdown, no CI workflow. A page that takes 29 seconds passes.
> **This is a report generator, not a test suite** — see [Area observations](#area-observations).

## Contents

| ID | Spec | Tests | Section in report | Mode | Manual? |
|---|---|---:|---|---|---|
| [PERF-01](#perf-01--dashboardspects--dashboard-load-times) | `loadtest/dashboard.spec.ts` | 6 | `Dashboard` | PERF | ☐ |
| [PERF-02](#perf-02--hostsspects--hosts-load-times) | `loadtest/hosts.spec.ts` | 9 | `Hosts` | PERF | ☐ |
| [PERF-03](#perf-03--host-detailsspects--host-details-load-times) | `loadtest/host-details.spec.ts` | 6 | `Host Details` | PERF | ☐ |
| [PERF-04](#perf-04--softwarespects--software-load-times) | `loadtest/software.spec.ts` | 14 | `Software` | PERF | ☐ |
| [PERF-05](#perf-05--software-osspects--software-os-load-times) | `loadtest/software-os.spec.ts` | 7 | `Software OS` | PERF | ☐ |
| [PERF-06](#perf-06--software-vulnerabilitiesspects--vulnerabilities-load-times) | `loadtest/software-vulnerabilities.spec.ts` | 5 | `Vulnerabilities` | PERF | ☐ |
| [PERF-07](#perf-07--policiesspects--policies-load-times) | `loadtest/policies.spec.ts` | 4 | `Policies` | PERF | ☐ |
| [PERF-08](#perf-08--reportsspects--reports-load-times) | `loadtest/reports.spec.ts` | 6 | `Reports` | PERF | ☐ |
| [PERF-09](#perf-09--controlsspects--controls-load-times) | `loadtest/controls.spec.ts` | 14 | `Controls` | PERF | ☐ |
| [PERF-10](#perf-10--labelsspects--labels-load-times) | `loadtest/labels.spec.ts` | 1 | `Labels` | PERF | ☐ |
| [PERF-11](#perf-11--usersspects--users-load-times) | `loadtest/users.spec.ts` | 1 | `Users` | PERF | ☐ |

`Mode` is **PERF** for all 73 declarations. `Manual?` is per-spec-file; the per-measurement `☐`
boxes live in each entry's table.

---

## How a measurement is taken (shared by all 73)

Read once; the entries below assume it.

**`measureNav(page, testInfo, label, navigate)`** — [`helpers/perf.ts:45`](../../helpers/perf.ts)
`Date.now()` immediately before the `navigate` callback, `Date.now()` immediately after it resolves.
The callback holds a `goto()` (each page object's `goto()` carries its own internal readiness
`expect`) and optionally extra `expect`s. Node-side clock, because `page.goto()` destroys the
browser JS context; ~50 ms of Playwright command overhead is inside every number.

**`measureSearch(page, testInfo, label, input, query, waitFor)`** — [`helpers/perf.ts:64`](../../helpers/perf.ts)
Fills the input, waits for the first request whose URL contains `query=`, **then** starts the clock,
waits for a matching `200`-or-`304` response, runs `waitFor()`, stops the clock. The client-side
debounce is deliberately excluded, so search numbers are *not* comparable to nav numbers.

**What is recorded** — [`helpers/perf.ts:20`](../../helpers/perf.ts) `saveResult()`
- A `load-time` annotation (`"<label> - 1.234s"`) on the test, visible in the HTML report.
- One JSON file per measurement in `playwright/.perf-results/` (gitignored):
  `{ section, label, elapsed, ms }`. `section` = `testInfo.titlePath[1]` with `" load times"`
  stripped, i.e. the describe title. `label` is the string passed to `measureNav`/`measureSearch`
  and is often **not** the test title — the entries below list both, because `label` is the key you
  read in the report and in history.

**Where results land** — [`helpers/perf-teardown.ts`](../../helpers/perf-teardown.ts), wired as
`globalTeardown` at config top level (so it also fires on premium/free runs, returning early when
`.perf-results/` is absent).
1. Reads every JSON, **deletes** `.perf-results/`.
2. Writes `playwright/.perf-history/<YYYY-MM-DD_HHMMSS>/results.json` (gitignored).
3. Prunes to the 10 most recent run directories.
4. Prints one ANSI table: current run vs the previous **3** runs, joined on `section|label`.

**What "fails" a loadtest test** — three things, none of them slowness:
- The readiness `expect` timing out. Loadtest project overrides `expect.timeout` to **30 s** and
  keeps `timeout: 60000`, `retries: 0` ([`playwright.config.ts:196`](../../playwright.config.ts)).
  This 30 s ceiling is the only de-facto perf gate in the whole project, and it surfaces as a
  locator timeout, not as a perf report.
- The auto `pageHealth` fixture: these specs import from `@fixtures`, so console errors and **5xx**
  responses during the measured navigation throw at teardown. This is the suite's only real
  assertion content beyond "an element appeared".
- A fixture precondition: `loadtestFleetId` throws if `FLEET_LOADTEST_FLEET_ID` is missing or
  non-numeric ([`fixtures.ts:290`](../../fixtures.ts)).

**Cold vs warm is implicit and unmarked.** Playwright gives each test a fresh browser context, so
any measurement whose first action is a `goto` pays the full uncached ~4.7 MB bundle fetch
(*cold*, marked `C` below). Every "`goto()` outside the clock, then measure a click" test measures a
warm SPA with the bundle already parsed (*warm*, `W`). Both land in the same report column with no
distinction, so `Hosts list` (C) and `Online status filter` (W) are not comparable quantities.

**Every measurement is a single sample.** No `--repeat-each`, no warm-up, no median, no discard of
outliers. With `fullyParallel: true` and workers defaulting to 4 locally, up to 4 measurements are
contending on the same instance while being timed, and the worker count is not recorded in
`results.json`.

**Environment** — this project cannot run against the normal QA instances:
- Its own high-scale Fleet instance, credentials in `playwright/.env.loadtest` (gitignored).
- `FLEET_LOADTEST_FLEET_ID` = a team provisioned by
  [`gitops/loadtest/generate.sh`](../../../gitops/loadtest/README.md) (~1.5 k entities, several
  minutes to apply), with hosts manually transferred in and background crons given time to populate
  software / vuln / label data.
- Auth via `loadtest-setup` → `.auth/loadtest-admin.json`
  ([`setup/loadtest.setup.ts`](../../setup/loadtest.setup.ts)). No `cleanup-setup` /
  `cleanup-teardown` in the chain — the project never mutates state.
- `npm run test:loadtest`, local only. No workflow in `.github/workflows/` references it.

---

### PERF-01 · `dashboard.spec.ts` — Dashboard load times

- **File:** [`playwright/tests/loadtest/dashboard.spec.ts`](../../tests/loadtest/dashboard.spec.ts)
- **Grep:** `npm run test:loadtest -- -g "Dashboard load times"`
- **Project:** loadtest · **Section:** `Dashboard` · **Mode:** PERF (6 measurements)
- **Isolation:** independent tests, no shared state, no cleanup
- **Preconditions:** `loadtestFleetId`; the loadtest team has hosts + software inventory; the global
  instance has activity records
- **Data created:** none — read-only throughout
- **POM:** [`pages/DashboardPage.ts`](../../pages/DashboardPage.ts) · `goto()` builds
  `/dashboard[/<platform>][?fleet_id=]` and internally asserts `firstCard` visible

| # | Test title | Recorded label | Navigates to | Ready-state assertion | C/W | Manual? |
|---|---|---|---|---|---|---|
| 1 | `Platform cards` | `Platform cards` | `/dashboard?fleet_id=<loadtest>` | ✅ *(UI)* first `[data-testid="card"]` visible — asserted inside `goto()` **and** again in the spec | C | ☐ |
| 2 | `Software block` | `Software block` | already on `/dashboard?fleet_id=` (goto outside the clock) | ✅ *(UI)* **Software** heading visible; first `<tbody>` row visible; that row's first `<td>` not empty | W | ☐ |
| 3 | `Activity block` | `Activity block` | already on `/dashboard` — **no `fleet_id`**, All-fleets view (only view that renders the Activity card) | ✅ *(UI)* first `.activity-feed-card` button whose accessible name contains `ago` visible | W | ☐ |
| 4 | `Filter by macOS` | `macOS` | `/dashboard/mac?fleet_id=` | ✅ *(UI)* first card visible (×2, as row 1) | C | ☐ |
| 5 | `Filter by Windows` | `Windows` | `/dashboard/windows?fleet_id=` | ✅ *(UI)* first card visible (×2) | C | ☐ |
| 6 | `Filter by Linux` | `Linux` | `/dashboard/linux?fleet_id=` | ✅ *(UI)* first card visible (×2) | C | ☐ |

**Assessment**
- *Value:* rows 1/4/5/6 are the only genuine cold dashboard loads and are worth keeping — a
  dashboard-aggregation regression under scale shows up here.
- *Coverage gaps:* no ChromeOS / iOS / iPadOS dashboard (POM supports all three); the Unassigned
  (no-team) dashboard is never measured; per-card counts are never read, so a dashboard rendering
  cards with wrong or zero numbers records a fast, healthy-looking time.
- *Redundancy:* rows 4–6 are the same measurement three times with only the URL path differing —
  they exist to compare platforms, which is legitimate, but row 1 already covers "dashboard loads".
- *Efficiency / smells:*
  - **Rows 2 and 3 can measure ~0.** `goto()` runs *before* the clock and already awaits
    `firstCard`, so by the time timing starts the software widget / activity feed have often already
    resolved. The recorded number is "time *remaining* after the cards painted", which is not what
    the labels suggest.
  - `firstCard` is asserted twice in rows 1/4/5/6 (inside `goto()` at
    [`DashboardPage.ts:112`](../../pages/DashboardPage.ts) and again in the spec) — harmless but
    noise.
  - Labels `macOS` / `Windows` / `Linux` (rows 4–6) drop the "Filter by" prefix while rows 1–3 keep
    a descriptive label; the printed table reads inconsistently.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### PERF-02 · `hosts.spec.ts` — Hosts load times

- **File:** [`playwright/tests/loadtest/hosts.spec.ts`](../../tests/loadtest/hosts.spec.ts)
- **Grep:** `npm run test:loadtest -- -g "Hosts load times"`
- **Project:** loadtest · **Section:** `Hosts` · **Mode:** PERF (9 measurements)
- **Isolation:** independent, read-only
- **Preconditions:** `loadtestFleetId`; the team has ≥1 host (rows 1/8/9 fail outright on an empty
  list, since `goto()` anchors on a row *containing a link*) and ≥1 custom label (row 6)
- **POM:** [`pages/hosts/HostsListPage.ts`](../../pages/hosts/HostsListPage.ts) · `goto()` builds
  `/hosts/manage?[fleet_id][&order_key&order_direction]` and asserts `table.firstRowWithLink`

| # | Test title | Recorded label | Navigates to / interacts with | Ready-state assertion | C/W | Manual? |
|---|---|---|---|---|---|---|
| 1 | `Hosts list` | `Hosts list` | `/hosts/manage?fleet_id=` | ✅ *(UI)* first `<tbody>` row containing a link — inside `goto()` and again in-spec | C | ☐ |
| 2 | `Online status filter` | `Online status filter` | selects **Online** in the status dropdown (`.manage-hosts__status-filter .react-select__control` → `dropdown-option` with text "Online") | ✅ *(UI)* option visible before click (in `StatusFilter`); then first row **OR** `.empty-state` visible | W | ☐ |
| 3 | `Platform filter - macOS` | `Platform filter - macOS` | opens `.label-filter-select__control`, clicks the first option containing "macOS" | ✅ *(UI)* option visible (in `LabelFilter`); then `rowOrEmpty()` | W | ☐ |
| 4 | `Platform filter - Windows` | `Platform filter - Windows` | same, option "Windows" | ✅ *(UI)* `rowOrEmpty()` | W | ☐ |
| 5 | `Platform filter - Linux` | `Platform filter - Linux` | same, option "Linux" | ✅ *(UI)* `rowOrEmpty()` | W | ☐ |
| 6 | `Label filter - first available` | `Label filter` | opens the label dropdown, clicks the first option whose text contains none of macOS/Windows/Linux/ChromeOS/iOS/iPadOS/Android; **falls back to the first option** if none qualify | ✅ *(UI)* `rowOrEmpty()` | W | ☐ |
| 7 | `Search host by name` | `Search host by name` | reads the first row's display name, fills the hosts search box | ✅ *(UI)* row containing that exact name visible, after a `query=` `200`/`304` response | W | ☐ |
| 8 | `Sort by Host name ascending` | `Sort name ascending` | `/hosts/manage?fleet_id=&order_key=display_name&order_direction=asc` | ✅ *(UI)* `firstRowWithLink` (×2) | C | ☐ |
| 9 | `Sort by Host name descending` | `Sort name descending` | same with `order_direction=desc` | ✅ *(UI)* `firstRowWithLink` (×2) | C | ☐ |

**Assessment**
- *Value:* the hosts list is Fleet's heaviest query at scale; rows 1/8/9 (cold, server-sorted) are
  the most defensible measurements in the whole project.
- *Coverage gaps:* no pagination measurement (page 2/N of a large host list is where offset queries
  hurt); no column-sort other than `display_name`; no combined filter (status + platform + label
  together, the realistic worst case); Offline / Missing / New statuses unmeasured; **Export hosts**
  (a full CSV dump — an obvious scale risk) unmeasured; no row-count assertion anywhere, so a filter
  that silently returns nothing still records a "fast" time via `rowOrEmpty()`.
- *Redundancy:* rows 3–5 are one measurement with three option labels. Row 6 duplicates 3–5's
  mechanics against an arbitrary label.
- *Efficiency / smells:*
  - `rowOrEmpty()` in rows 2–6 accepts `.empty-state`, so **a filter that matches zero hosts records
    the empty-state render time as the filter's cost**. On this dataset that is plausible for
    Windows/Linux if only macOS hosts were transferred in.
  - Row 6 is non-deterministic: which label gets clicked depends on dropdown order, so its number is
    not comparable run-to-run, and the fallback to `options.first()`
    ([`LabelFilter.ts:44`](../../pages/components/LabelFilter.ts)) can silently make it a platform
    filter — a duplicate of row 3.
  - Row 7 searches the **full exact host name**, the most selective query possible. A realistic
    search-perf probe would use a short shared prefix that matches thousands of rows.
  - Row 7's readiness gate is a no-op: the row it waits for was *already the first visible row*
    before typing, so `expect(rowWith(name)).toBeVisible()` can resolve against the stale
    pre-filter render. The number degenerates to "response arrival", excluding render.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### PERF-03 · `host-details.spec.ts` — Host Details load times

- **File:** [`playwright/tests/loadtest/host-details.spec.ts`](../../tests/loadtest/host-details.spec.ts)
- **Grep:** `npm run test:loadtest -- -g "Host Details load times"`
- **Project:** loadtest · **Section:** `Host Details` · **Mode:** PERF (6 measurements)
- **Isolation:** independent, read-only; all six share the `firstHostId` worker fixture
- **Preconditions:** `firstHostId` ([`fixtures.ts:301`](../../fixtures.ts)) — opens a throwaway
  context on `.auth/loadtest-admin.json`, loads
  `/hosts/manage?fleet_id=<id>&order_key=display_name&order_direction=asc`, reads the first row's
  first link `href` and parses `/hosts/(\d+)`.
  ⚠️ On an empty list or an unmatched href it **silently resolves to `0`**, so all six tests then
  navigate to `/hosts/0` and fail as locator timeouts with no hint at the cause.
- **POM:** [`pages/hosts/HostDetailsPage.ts`](../../pages/hosts/HostDetailsPage.ts) · `goto(id)` →
  `/hosts/<id>`, asserts "Disk space available" text visible

| # | Test title | Recorded label | Navigates to / interacts with | Ready-state assertion | C/W | Manual? |
|---|---|---|---|---|---|---|
| 1 | `Host details page` | `Host details page` | `/hosts/<firstHostId>` | ✅ *(UI)* "Disk space available" (in `goto()` **and** in-spec); "Operating system" text; first activity button with `ago` **OR** the `<h3>` "No activity" | C | ☐ |
| 2 | `Software inventory` | `Software inventory` | clicks the **Software** tab | ✅ *(UI)* `rowOrEmpty()` inside `openSoftwareTab()`, then the stricter `firstRowWithLink` in-spec | W | ☐ |
| 3 | `Software - Vulnerable filter` | `Vulnerable filter` | on the Software tab: opens the filter modal, clicks the **Vulnerable** switch, clicks **Apply** | ✅ *(UI)* URL matches `[?&]vulnerable=true` (in `FilterModal.applyVulnerable`); then `rowOrEmpty()` | W | ☐ |
| 4 | `Software - Library view` | `Library view` | on the Software tab: clicks the **Library** tab | ✅ *(UI)* `rowOrEmpty()` | W | ☐ |
| 5 | `Reports tab` | `Reports tab` | clicks the **Reports** tab | ✅ *(UI)* text matching `/\d+ reports?/` visible | W | ☐ |
| 6 | `Policies tab` | `Policies tab` | clicks the **Policies** tab | ✅ *(UI)* `rowOrEmpty()` | W | ☐ |

**Assessment**
- *Value:* row 1 is the real one — host details fans out to many endpoints (vitals, activity,
  policies count, software count) and is a plausible scale regression site. Rows 2/5/6 catch a
  per-tab query going quadratic.
- *Coverage gaps:* the measured host is whichever sorts first by display name, so its software
  inventory size is arbitrary — the *worst-case* host (most software, most policies) is never
  targeted. No Queries tab. No **Refetch**. No host-software search or pagination. No
  Unassigned-team host for comparison. Vitals values are never read, so a details page that renders
  empty vitals fast looks healthy.
- *Redundancy:* rows 2/4/6 are the same "click a tab, wait for `rowOrEmpty()`" shape; row 3 is the
  host-tab twin of PERF-04 row 6 (`Vulnerable filter` on the global software list) — same label,
  different section, so they do not collide in history but do read confusingly side by side.
- *Efficiency / smells:*
  - Rows 3/4/6 accept `.empty-state`; on a simulated host with no vulnerable software, row 3
    measures an empty-state paint.
  - Row 3 bills `open()` + switch click + **Apply** click (three UI round-trips) to the
    "Vulnerable filter" number, so it is not a server-latency measurement.
  - Row 5's `page.getByText(/\d+ reports?/)` is unscoped — any element on the page matching that
    pattern satisfies it.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### PERF-04 · `software.spec.ts` — Software load times

- **File:** [`playwright/tests/loadtest/software.spec.ts`](../../tests/loadtest/software.spec.ts)
- **Grep:** `npm run test:loadtest -- -g "Software load times"`
- **Project:** loadtest · **Section:** `Software` · **Mode:** PERF (14 measurements — the largest spec)
- **Isolation:** independent, read-only
- **Preconditions:** `loadtestFleetId`; software inventory + version rows populated (crons must have
  run); vulnerability data for rows 6 and 13
- **POMs:** [`SoftwareTitlesPage.ts`](../../pages/software/SoftwareTitlesPage.ts) — `goto()` hits
  `/software/inventory` (canonical; `/software/titles` is a legacy redirect), asserts the
  **Inventory** tab has `aria-selected="true"` *and* `rowOrEmpty()`. ·
  [`SoftwareVersionsPage.ts`](../../pages/software/SoftwareVersionsPage.ts) — `goto()` hits
  `/software/versions`, asserts `table.firstRow`.

| # | Test title | Recorded label | Navigates to / interacts with | Ready-state assertion | C/W | Manual? |
|---|---|---|---|---|---|---|
| 1 | `Software page` | `Software page` | `/software/inventory?fleet_id=` | ✅ *(UI)* Inventory tab `aria-selected="true"`; `rowOrEmpty()`; then `firstRowWithLink` in-spec | C | ☐ |
| 2 | `Sort by name ascending` | `Sort name ascending` | `…&order_key=name&order_direction=asc` | ✅ *(UI)* as row 1 | C | ☐ |
| 3 | `Sort by name descending` | `Sort name descending` | `…&order_key=name&order_direction=desc` | ✅ *(UI)* as row 1 | C | ☐ |
| 4 | `Sort by host count ascending` | `Sort hosts ascending` | `…&order_key=hosts_count&order_direction=asc` | ✅ *(UI)* as row 1 | C | ☐ |
| 5 | `Sort by host count descending` | `Sort hosts descending` | `…&order_key=hosts_count&order_direction=desc` | ✅ *(UI)* as row 1 | C | ☐ |
| 6 | `Vulnerable filter` | `Vulnerable filter` | `…&vulnerable=true` | ✅ *(UI)* as row 1 | C | ☐ |
| 7 | `Search software` | `Search software` | reads the first row's primary link text, fills the software search box | ✅ *(UI)* row containing that name visible, after a `query=` `200`/`304` | W | ☐ |
| 8 | `Show versions - page load` | `Versions - page load` | `/software/versions?fleet_id=` | ✅ *(UI)* `firstRow` (in `goto()`); then `firstRowWithLink` in-spec | C | ☐ |
| 9 | `Versions - sort name ascending` | `Versions - sort name asc` | `/software/versions?…&order_key=name&order_direction=asc` | ✅ *(UI)* as row 8 | C | ☐ |
| 10 | `Versions - sort name descending` | `Versions - sort name desc` | `…&order_direction=desc` | ✅ *(UI)* as row 8 | C | ☐ |
| 11 | `Versions - sort hosts ascending` | `Versions - sort hosts asc` | `…&order_key=hosts_count&order_direction=asc` | ✅ *(UI)* as row 8 | C | ☐ |
| 12 | `Versions - sort hosts descending` | `Versions - sort hosts desc` | `…&order_key=hosts_count&order_direction=desc` | ✅ *(UI)* as row 8 | C | ☐ |
| 13 | `Versions - vulnerable filter` | `Versions - vulnerable` | `/software/versions?…&vulnerable=true` | ✅ *(UI)* as row 8 | C | ☐ |
| 14 | `Versions - search` | `Versions - search` | reads the first version row's primary link text, fills the versions search box | ✅ *(UI)* row containing that name visible, after a `query=` `200`/`304` | W | ☐ |

**Assessment**
- *Value:* `hosts_count` sorting (rows 4/5/11/12) is a genuine scale hazard — it forces an aggregate
  over the host-software join — and `vulnerable=true` (rows 6/13) is the query family already known
  to blow up on QA MySQL with `table is full` 500s. `pageHealth` would catch that 500 here, which is
  the single most valuable thing this spec does.
- *Coverage gaps:* **Library** / **Fleet-maintained** / **App Store** tabs never measured despite
  the loadtest bundle provisioning 276 FMAs, 240 packages and 28 Android apps — the most
  scale-relevant Software pages in the dataset are skipped. No software **title detail** page, no
  **version detail**, no pagination, no `available_for_install=true` (the POM supports it), no
  combined sort+filter.
- *Redundancy:* rows 2–5 vs 9–12 are the same four sorts on two tables — 8 of the 14 measurements
  are sort permutations. Rows 6/13 duplicate PERF-06 row 1's query family, and row 6 shares the
  label `Vulnerable filter` with PERF-03 row 3.
- *Efficiency / smells:*
  - `rowOrEmpty()` in the titles `goto()` means rows 1–7 pass on an empty inventory; only the
    spec-level `firstRowWithLink` saves rows 1–6.
  - Rows 7/14 have the same stale-row problem as PERF-02 row 7 — the searched name is the row
    already on screen, so the "results rendered" gate is vacuous.
  - Row 7/14 queries are full exact names (least selective possible workload).
  - Ascending and descending sorts differ only in one URL param and, at this scale, usually in one
    index direction. Halving them would cost almost no signal.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### PERF-05 · `software-os.spec.ts` — Software OS load times

- **File:** [`playwright/tests/loadtest/software-os.spec.ts`](../../tests/loadtest/software-os.spec.ts)
- **Grep:** `npm run test:loadtest -- -g "Software OS load times"`
- **Project:** loadtest · **Section:** `Software OS` · **Mode:** PERF (7 measurements)
- **Isolation:** independent, read-only
- **Preconditions:** `loadtestFleetId`; OS rows populated for each platform queried
- **POM:** [`SoftwareOsPage.ts`](../../pages/software/SoftwareOsPage.ts) · `goto()` →
  `/software/os?[fleet_id][&platform][&order_key&order_direction]`, asserts `table.firstRow`

| # | Test title | Recorded label | Navigates to / interacts with | Ready-state assertion | C/W | Manual? |
|---|---|---|---|---|---|---|
| 1 | `OS page` | `OS page` | `/software/os?fleet_id=` | ✅ *(UI)* `firstRow` (in `goto()`); then `firstRowWithLink` in-spec | C | ☐ |
| 2 | `Platform filter - macOS` | `Platform - macOS` | `…&platform=darwin` | ✅ *(UI)* as row 1 | C | ☐ |
| 3 | `Platform filter - Windows` | `Platform - Windows` | `…&platform=windows` | ✅ *(UI)* as row 1 | C | ☐ |
| 4 | `Platform filter - Linux` | `Platform - Linux` | `…&platform=linux` | ✅ *(UI)* as row 1 | C | ☐ |
| 5 | `Sort hosts ascending` | `Sort hosts ascending` | `…&order_key=hosts_count&order_direction=asc` | ✅ *(UI)* as row 1 | C | ☐ |
| 6 | `Sort hosts descending` | `Sort hosts descending` | `…&order_key=hosts_count&order_direction=desc` | ✅ *(UI)* as row 1 | C | ☐ |
| 7 | `View hosts for top OS` | `Top OS hosts page` | on `/software/os?…hosts_count desc`: hovers the first OS row and clicks its hover-only **View all hosts** button, landing on the hosts list | ✅ *(UI)* hosts-list `firstRowWithLink` | W | ☐ |

**Assessment**
- *Value:* row 7 is the interesting one — it measures a hosts-list load filtered by `os_version_id`,
  a different query path than PERF-02 row 1. The comment at
  [`software-os.spec.ts:50`](../../tests/loadtest/software-os.spec.ts) explains it deliberately
  avoids the OS *detail* page because the loadtest fleet may lack vuln data.
- *Coverage gaps:* the OS detail page (`/software/os/:id`) is never measured at all — the gap row 7
  works around is itself an untested page. No iOS/iPadOS/Android/ChromeOS platform values. No
  pagination.
- *Redundancy:* rows 2–4 are one measurement with three `platform` values; rows 5/6 duplicate
  PERF-04 rows 4/5's `hosts_count` sort against a smaller table and use the **same labels**
  (`Sort hosts ascending` / `descending`) — distinguished only by section, easy to misread in the
  printed report.
- *Efficiency / smells:*
  - Row 7 bills `clickHoverAction`'s retry loop to the measurement: up to **three 3 s attempts plus
    re-hovers** ([`clickHoverAction.ts`](../../pages/components/clickHoverAction.ts)) can add ~9 s of
    pure test-harness latency to a number reported as a page-load time. There is nothing in the
    report to distinguish that from a slow server.
  - Every `goto()` anchor here is `firstRow` (any row, including a skeleton row) rather than
    `firstRowWithLink`; the spec-level assert is what makes rows 1–6 meaningful.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### PERF-06 · `software-vulnerabilities.spec.ts` — Vulnerabilities load times

- **File:** [`playwright/tests/loadtest/software-vulnerabilities.spec.ts`](../../tests/loadtest/software-vulnerabilities.spec.ts)
- **Grep:** `npm run test:loadtest -- -g "Vulnerabilities load times"`
- **Project:** loadtest · **Section:** `Vulnerabilities` · **Mode:** PERF (5 measurements)
- **Isolation:** independent, read-only
- **Preconditions:** `loadtestFleetId`; the vulnerability cron has run and produced CVE rows —
  every row here hard-fails on an empty list; row 2 additionally needs ≥1 *exploited* CVE
- **POM:** [`VulnerabilitiesListPage.ts`](../../pages/software/VulnerabilitiesListPage.ts) ·
  `goto()` → `/software/vulnerabilities?[fleet_id][&exploit][&order_key&order_direction]`, asserts
  `table.firstRow`

| # | Test title | Recorded label | Navigates to / interacts with | Ready-state assertion | C/W | Manual? |
|---|---|---|---|---|---|---|
| 1 | `Vulnerabilities page` | `Vulnerabilities page` | `/software/vulnerabilities?fleet_id=` | ✅ *(UI)* `firstRow` (in `goto()`); then `firstRowWithLink` in-spec | C | ☐ |
| 2 | `Exploited vulnerabilities filter` | `Exploited filter` | `…&exploit=true` | ✅ *(UI)* as row 1 | C | ☐ |
| 3 | `Sort severity ascending` | `Severity ascending` | `…&order_key=cvss_score&order_direction=asc` | ✅ *(UI)* as row 1 | C | ☐ |
| 4 | `Sort severity descending` | `Severity descending` | `…&order_key=cvss_score&order_direction=desc` | ✅ *(UI)* as row 1 | C | ☐ |
| 5 | `Search CVE` | `Search CVE` | `firstCveName()` reads the first row-with-link's **Vulnerability** cell link and asserts it matches `/^CVE-\d{4}-\d+$/` *(outside the clock)*; then fills the search box with it | ✅ *(UI)* row containing that CVE visible, after a `query=` `200`/`304` | W | ☐ |

**Assessment**
- *Value:* this is the query family behind the known QA `table is full` 500s, so `pageHealth`
  catching a 5xx here is real value. `cvss_score` sorting over a large CVE set is a legitimate
  scale probe.
- *Coverage gaps:* the CVE detail page (`/software/vulnerabilities/:cve`) is never measured. No
  `known_exploit` + severity combined filter. No pagination. Severity/EPSS values are never read, so
  a page that renders "—" for every score passes fast.
- *Redundancy:* rows 3/4 are one measurement in two directions. Row 2 overlaps PERF-04 rows 6/13
  conceptually (both are "the vulnerability data path under load").
- *Efficiency / smells:*
  - Row 5's `firstCveName()` contains a real assertion (`toHaveText(/^CVE-…/)`) that sits *outside*
    the timed span — good, but it makes row 5 the only search test that verifies its query is
    well-formed. The other four search tests (PERF-02/04/08) take whatever text they find.
  - Same vacuous-render-gate problem as every other `measureSearch` row: the CVE searched for is
    already the visible first row.
  - `firstRow` (skeleton-tolerant) as the `goto()` anchor again.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### PERF-07 · `policies.spec.ts` — Policies load times

- **File:** [`playwright/tests/loadtest/policies.spec.ts`](../../tests/loadtest/policies.spec.ts)
- **Grep:** `npm run test:loadtest -- -g "Policies load times"`
- **Project:** loadtest · **Section:** `Policies` · **Mode:** PERF (4 measurements)
- **Scopes:** All fleets (rows 1–2, no `fleet_id`) · loadtest team (rows 3–4)
- **Isolation:** independent, read-only
- **Preconditions:** `loadtestFleetId`; the gitops bundle's 500 policies applied to the team
- **POM:** [`PoliciesListPage.ts`](../../pages/policies/PoliciesListPage.ts) · `goto()` →
  `/policies/manage?[fleet_id][&automation_type]`, asserts `table.rowOrEmpty()`

| # | Test title | Recorded label | Navigates to / interacts with | Ready-state assertion | C/W | Manual? |
|---|---|---|---|---|---|---|
| 1 | `All fleets` | `All fleets` | `/policies/manage` (no `fleet_id`) | ✅ *(UI)* `rowOrEmpty()` — **only** the assert inside `goto()`; the spec body adds none | C | ☐ |
| 2 | `All fleets - Other automation filter` | `All fleets - Other filter` | `/policies/manage?automation_type=other` | ✅ *(UI)* `rowOrEmpty()` (from `goto()` only) | C | ☐ |
| 3 | `Team page` | `Team page` | `/policies/manage?fleet_id=` | ✅ *(UI)* `rowOrEmpty()` in `goto()` **and** again in-spec | C | ☐ |
| 4 | `Team - Software automation filter` | `Team - Software filter` | `applyAutomationFilter('software')` — takes the current URL, sets `automation_type=software`, and does a **full `page.goto`** | ✅ *(UI)* `rowOrEmpty()` inside `applyAutomationFilter` | W | ☐ |

**Assessment**
- *Value:* 500 policies in one team is exactly the shape that broke policy-list rendering
  historically; the All-fleets view additionally aggregates pass/fail counts per policy, which is the
  expensive part.
- *Coverage gaps:* no policy **detail** page, no **Run** / results view, no policy search (the POM
  has `search`), no pagination through 500 rows, no critical-only filter, no
  `automation_type=` other values beyond the two here. Policy pass/fail counts are never read — the
  aggregate columns are the slow part and nothing waits for them.
- *Redundancy:* rows 2 and 4 are the same automation filter applied to two scopes with two different
  `automation_type` values — the difference in what they cover is small.
- *Efficiency / smells:*
  - **`rowOrEmpty()` is the only gate on all four rows**, and it accepts `.empty-state`. If the
    gitops bundle was not applied, or if the `automation_type` filter matches nothing, these tests
    happily record the empty-state paint as "policies page load time". Rows 1, 2 and 4 have **no
    spec-level assertion whatsoever** beyond that.
  - Row 4 is labelled as a filter interaction but is implemented as a full navigation
    ([`PoliciesListPage.ts:133`](../../pages/policies/PoliciesListPage.ts)) — it measures a
    warm-context page load, not a client-side filter.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### PERF-08 · `reports.spec.ts` — Reports load times

- **File:** [`playwright/tests/loadtest/reports.spec.ts`](../../tests/loadtest/reports.spec.ts)
- **Grep:** `npm run test:loadtest -- -g "Reports load times"`
- **Project:** loadtest · **Section:** `Reports` · **Mode:** PERF (6 measurements)
- **Scopes:** All fleets (rows 1–3) · loadtest team (rows 4–6)
- **Isolation:** independent, read-only
- **Preconditions:** `loadtestFleetId`; the bundle's 500 reports applied; rows 3/6 need ≥1 report
  row with a primary link
- **POM:** [`ReportsListPage.ts`](../../pages/reports/ReportsListPage.ts) · `goto()` →
  `/reports/manage?[fleet_id][&platform]`, asserts `table.rowOrEmpty()`

| # | Test title | Recorded label | Navigates to / interacts with | Ready-state assertion | C/W | Manual? |
|---|---|---|---|---|---|---|
| 1 | `All fleets` | `All fleets` | `/reports/manage` (no `fleet_id`) | ✅ *(UI)* `rowOrEmpty()` — from `goto()` only, no spec-level assert | C | ☐ |
| 2 | `All fleets - platform filter` | `All fleets - platform filter` | `/reports/manage?platform=darwin` | ✅ *(UI)* `rowOrEmpty()` (from `goto()` only) | C | ☐ |
| 3 | `All fleets - search` | `All fleets - search` | `firstReportName()` = first row's primary link text; fills the reports search box | ✅ *(UI)* row containing that name visible, after a `query=` `200`/`304` | W | ☐ |
| 4 | `Team page` | `Team page` | `/reports/manage?fleet_id=` | ✅ *(UI)* `rowOrEmpty()` in `goto()`; then `firstRowWithLink` in-spec | C | ☐ |
| 5 | `Team - platform filter` | `Team - platform filter` | `applyPlatformFilter('darwin')` — re-`goto`s the current URL with `platform=darwin` | ✅ *(UI)* `firstRowWithLink` inside `applyPlatformFilter` | W | ☐ |
| 6 | `Team - search` | `Team - search` | ⚠️ uses **`measureNav`, not `measureSearch`** — clock wraps `search.fill(name)` **and** the row assertion | ✅ *(UI)* row containing that name visible | W | ☐ |

**Assessment**
- *Value:* 500 reports per team plus the All-fleets aggregate is a reasonable scale probe for the
  reports list.
- *Coverage gaps:* report **detail** / results pages unmeasured; **live query** run unmeasured
  (irrelevant here anyway — the loadtest hosts are simulations); no pagination through 500 rows; no
  platform value other than `darwin`; the `selectPlatform()` UI dropdown path exists in the POM but
  only the URL-param path is measured.
- *Redundancy:* rows 1–3 and 4–6 are the same three measurements at two scopes — a deliberate
  scope comparison, but it doubles the count. Rows 2/5 are the same platform filter twice.
- *Efficiency / smells:*
  - **Row 6 is not comparable to row 3.** Row 3 uses `measureSearch` (clock starts when the
    debounced request fires); row 6 uses `measureNav` around `fill()` + assert, so it *includes* the
    client-side debounce. They sit adjacent in the printed table under near-identical labels
    (`All fleets - search` / `Team - search`) and will always show row 6 as slower for a reason that
    has nothing to do with Fleet. This looks like an oversight, not a choice —
    [`reports.spec.ts:50`](../../tests/loadtest/reports.spec.ts).
  - Rows 1 and 2 have no spec-level assertion and rely on `rowOrEmpty()`, so they record the
    empty-state paint if the bundle was not applied.
  - Rows 3/6's search query is a full exact report name, and the target row is already on screen —
    same vacuous gate as elsewhere.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### PERF-09 · `controls.spec.ts` — Controls load times

- **File:** [`playwright/tests/loadtest/controls.spec.ts`](../../tests/loadtest/controls.spec.ts)
- **Grep:** `npm run test:loadtest -- -g "Controls load times"`
- **Project:** loadtest · **Section:** `Controls` · **Mode:** PERF (14 measurements)
- **Isolation:** independent, read-only
- **Preconditions:** `loadtestFleetId`; the bundle's 205 profiles / 100 certificates / 400 scripts
  applied; row 5 (`Certificates`) hard-fails without ≥1 certificate list item; row 2 needs an OS
  row; row 3 needs OS-settings status links
- **POMs:** [`OsUpdatesPage`](../../pages/controls/OsUpdatesPage.ts),
  [`OsSettingsPage`](../../pages/controls/OsSettingsPage.ts),
  [`ConfigurationProfilesPage`](../../pages/controls/ConfigurationProfilesPage.ts),
  [`CertificatesPage`](../../pages/controls/CertificatesPage.ts),
  [`InstallSoftwarePage`](../../pages/controls/InstallSoftwarePage.ts),
  [`ScriptsLibraryPage`](../../pages/controls/ScriptsLibraryPage.ts),
  [`ScriptsBatchProgressPage`](../../pages/controls/ScriptsBatchProgressPage.ts),
  [`VariablesPage`](../../pages/controls/VariablesPage.ts)

| # | Test title | Recorded label | Navigates to / interacts with | Ready-state assertion | C/W | Manual? |
|---|---|---|---|---|---|---|
| 1 | `OS Updates` | `OS Updates` | `/controls/os-updates?fleet_id=` | ✅ *(UI)* `table.firstRow` (in `goto()`; no spec-level assert) | C | ☐ |
| 2 | `OS Updates - View hosts for top OS` | `OS Updates - top OS hosts` | hovers the first OS row, clicks its hover-only **View all hosts** button | ✅ *(UI)* hosts-list `firstRowWithLink` | W | ☐ |
| 3 | `OS Settings - Top status hosts` | `OS Settings - status hosts` | `clickStatusWithMostHosts()` — reads every status link's `innerText`, parses `(\d+) hosts?`, clicks the highest; falls back to the **Verified** link when all are zero | ✅ *(UI)* hosts-list `rowOrEmpty()` | W | ☐ |
| 4 | `Configuration profiles` | `Configuration profiles` | `/controls/os-settings/configuration-profiles?fleet_id=` | ⚠️ *(UI)* **"Configuration profiles" heading only** — the 205-item profile list is never waited for | C | ☐ |
| 5 | `Certificates` | `Certificates` | `/controls/os-settings/certificates?fleet_id=` | ✅ *(UI)* first `<li>` containing `ago` visible (real data) | C | ☐ |
| 6 | `Install software - macOS` | `Install software - macOS` | `/controls/setup-experience/install-software/macos?fleet_id=` | ✅ *(UI)* "Install software" heading + `rowOrEmpty()` | C | ☐ |
| 7 | `Install software - Windows` | `Install software - Windows` | `…/install-software/windows?fleet_id=` | ✅ *(UI)* as row 6 | C | ☐ |
| 8 | `Install software - Linux` | `Install software - Linux` | `…/install-software/linux?fleet_id=` | ✅ *(UI)* as row 6 | C | ☐ |
| 9 | `Install software - iOS` | `Install software - iOS` | `…/install-software/ios?fleet_id=` | ✅ *(UI)* as row 6 | C | ☐ |
| 10 | `Install software - iPadOS` | `Install software - iPadOS` | `…/install-software/ipados?fleet_id=` | ✅ *(UI)* as row 6 | C | ☐ |
| 11 | `Install software - Android` | `Install software - Android` | `…/install-software/android?fleet_id=` | ✅ *(UI)* as row 6 | C | ☐ |
| 12 | `Scripts - Library` | `Scripts - Library` | `/controls/scripts/library?fleet_id=` | ⚠️ *(UI)* **"Library" heading only** — the 400-script list is never waited for | C | ☐ |
| 13 | `Scripts - Batch progress` | `Scripts - Batch progress` | `/controls/scripts/progress?fleet_id=` (**`goto()` has no readiness anchor at all**), then clicks the **Finished** tab | ✅ *(UI)* first `<li>` with `ago` **OR** `.empty-state` | C | ☐ |
| 14 | `Variables` | `Variables` | `/controls/variables/global-variables?fleet_id=` | ⚠️ *(UI)* **"Global variables" heading only** — the variables table is never waited for | C | ☐ |

**Assessment**
- *Value:* rows 4/5/12 are the pages the loadtest dataset was specifically built to stress (205
  profiles, 100 certificates, 400 scripts). Row 5 is the only one of the three that actually waits
  for data.
- *Coverage gaps:* **OS Settings' own page load is never measured** — row 3 measures the hosts list
  it links to, and `osSettings.goto()` runs outside the clock. Setup assistant, bootstrap package,
  setup-experience users, and Run-script pages are all unmeasured despite having POMs. No
  configuration-profile detail/download, no script detail, no batch-progress **Upcoming** tab.
- *Redundancy:* rows 6–11 are one measurement repeated across six platform paths, and the Install
  software page under Setup experience is nearly empty on this dataset for iOS/iPadOS/Android —
  six measurements for very little signal. Row 2 is the twin of PERF-05 row 7 (same
  `View all hosts` hover action, same hosts-list target, different source page).
- *Efficiency / smells:*
  - **Rows 4, 12, 14 measure the SPA shell, not the page.** Their POMs *have* list/table
    components (`ContentList` on profiles and scripts, `DataTable` on variables) but `goto()` anchors
    on a static heading that renders from the bundle before any API data arrives. These three
    numbers are effectively "how fast does the bundle parse", which is why they will look
    suspiciously uniform and immune to dataset size.
  - Row 13's `goto()` has no assertion at all
    ([`ScriptsBatchProgressPage.ts`](../../pages/controls/ScriptsBatchProgressPage.ts)), so the only
    thing bounding the measurement is the post-tab-click `firstItem.or(emptyState)`.
  - **Row 3 bills a read loop to the measurement**: `clickStatusWithMostHosts()` is called *inside*
    `measureNav` and performs one `innerText()` round-trip per status link before clicking
    ([`OsSettingsPage.ts`](../../pages/controls/OsSettingsPage.ts)). The recorded number is
    N round-trips + a click + a hosts-list load.
  - Row 2 inherits `clickHoverAction`'s up-to-9 s retry budget inside the timed span (see PERF-05
    row 7).
  - Rows 1 and 4–14 (except 13) have no spec-level assertion — they rely entirely on the POM's
    internal anchor, and several of those accept `.empty-state`.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### PERF-10 · `labels.spec.ts` — Labels load times

- **File:** [`playwright/tests/loadtest/labels.spec.ts`](../../tests/loadtest/labels.spec.ts)
- **Grep:** `npm run test:loadtest -- -g "Labels load times"`
- **Project:** loadtest · **Section:** `Labels` · **Mode:** PERF (1 measurement)
- **Isolation:** independent, read-only. Note this spec imports only `test` from `@fixtures` — **no
  `expect` is imported, so there is no spec-level assertion at all.**
- **Preconditions:** none beyond auth (labels are global; no `fleet_id`). Does **not** use
  `loadtestFleetId`, so it would pass against any instance.
- **POM:** [`LabelsPage.ts`](../../pages/labels/LabelsPage.ts) · `goto()` → `/labels/manage`

| # | Test title | Recorded label | Navigates to | Ready-state assertion | C/W | Manual? |
|---|---|---|---|---|---|---|
| 1 | `Labels` | `Labels` | `/labels/manage` (global, no `fleet_id`) | ⚠️ *(UI)* **`<h1>` "Labels" only** — the 500-row label table is never waited for | C | ☐ |

**Assessment**
- *Value:* close to zero as written. The heading renders from the bundle before the labels API
  responds, so this records bundle-parse time on a page whose 500-row table is the entire reason the
  measurement exists.
- *Coverage gaps:* the label table render, label search, pagination through 500 labels, and the
  label **detail** page (host membership for a dynamic label over a large fleet — the actual scale
  hazard) are all unmeasured.
- *Redundancy:* none.
- *Efficiency / smells:* `LabelsPage` already exposes a `DataTable`
  ([`LabelsPage.ts:46`](../../pages/labels/LabelsPage.ts)); swapping the `goto()` anchor to
  `table.firstRow` — or adding a spec-level `expect(labelsPage.table.firstRow).toBeVisible()` inside
  the callback — turns this from a shell measurement into a real one.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### PERF-11 · `users.spec.ts` — Users load times

- **File:** [`playwright/tests/loadtest/users.spec.ts`](../../tests/loadtest/users.spec.ts)
- **Grep:** `npm run test:loadtest -- -g "Users load times"`
- **Project:** loadtest · **Section:** `Users` · **Mode:** PERF (1 measurement)
- **Isolation:** independent, read-only. Imports only `test` — no spec-level assertion.
- **Preconditions:** none beyond auth. Does not use `loadtestFleetId`.
- **POM:** [`UsersPage.ts`](../../pages/settings/users/UsersPage.ts) · `goto()` →
  `/settings/users`, asserts `table.firstRow`

| # | Test title | Recorded label | Navigates to | Ready-state assertion | C/W | Manual? |
|---|---|---|---|---|---|---|
| 1 | `Users` | `Users` | `/settings/users` | ✅ *(UI)* `table.firstRow` visible (from `goto()`) — always ≥1 row, since the admin running the test is a user | C | ☐ |

**Assessment**
- *Value:* low. The loadtest gitops bundle provisions no users, so this page has a handful of rows
  on an instance built to hold thousands of everything else. It measures the bundle plus a trivial
  query.
- *Coverage gaps:* no user search, no pagination, no team-filtered user list (the premium scale case
  — a user with memberships across many teams). Nothing here would move if Fleet's user list
  regressed at scale, because the scale isn't there.
- *Redundancy:* functionally a duplicate of PERF-10 as a "does the SPA shell load" probe.
- *Efficiency / smells:* worth keeping only as a cheap control measurement (a baseline for
  "bundle + trivial query" that the heavier pages can be read against) — if that is the intent it
  should be labelled as such, otherwise it is noise.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

## Area observations

### Is there a threshold or regression gate?

**No — and this is the headline finding.** Grepping `helpers/perf.ts`, `helpers/perf-teardown.ts`,
`tests/loadtest/**` and `playwright.config.ts` for `threshold`, `budget`, `toBeLessThan`, `MAX_MS`,
`SLA` returns nothing. The only numeric comparisons in the codebase are **cosmetic terminal
colouring** in the teardown:

| Rule | Location | Effect |
|---|---|---|
| `ms > 15000` → red, `ms > 5000` → yellow | [`perf-teardown.ts:31`](../../helpers/perf-teardown.ts) | colours the *Current* column only |
| `abs(current − prev) < 200` → gray, faster → green, slower → yellow | [`perf-teardown.ts:42`](../../helpers/perf-teardown.ts) | colours the *prev-N* columns only |

Nothing fails, nothing exits non-zero, nothing is compared programmatically. **A page that takes
29 s prints red and passes.** The only failure modes are (a) a readiness locator exceeding the
loadtest project's 30 s `expect` timeout or the 60 s test timeout, (b) the auto `pageHealth` fixture
catching a console error or a 5xx during the measured navigation, (c) `FLEET_LOADTEST_FLEET_ID`
missing. Consequence: **`tests/loadtest/` is a report generator with an incidental 30 s smoke test
attached.** It should be described that way, or given a gate.

### Measurement soundness

| Issue | Detail |
|---|---|
| **Single sample** | Every one of the 73 numbers is measured exactly once per run. No warm-up, no repeats, no median, no outlier discard. Run-to-run noise on a shared instance is easily larger than a real regression. |
| **Self-inflicted concurrency** | `fullyParallel: true` and `workers` defaults to 4 locally ([`playwright.config.ts:99`](../../playwright.config.ts)). Up to 4 measurements are timed while contending on the same instance. The worker count is **not** recorded in `results.json`, so two runs at different `--workers` are silently incomparable. |
| **Cold/warm mixed in one table** | Each test gets a fresh browser context, so a first-action `goto` pays the uncached ~4.7 MB bundle (Fleet serves `bundle-*.js` without `Cache-Control`, per the config comment at line 100). Tests that `goto()` outside the clock then measure a click are warm. Both appear in the same column with no marker. ~50 of the 73 are cold, ~23 warm. |
| **Shell-only anchors** | `Labels`, `Configuration profiles`, `Scripts - Library`, `Variables` anchor on a static heading, so they exclude the data fetch entirely and will look uniform regardless of dataset size. `Scripts - Batch progress`'s `goto()` has no anchor. |
| **Empty-state tolerance** | `rowOrEmpty()` (accepts `.empty-state`) is the *only* gate on ~20 measurements — all four Policies rows, Reports rows 1–2, the five Hosts filter rows, three Host-details tabs, and all six `Install software` rows. If the gitops bundle was not applied or a filter matches nothing, the empty-state paint is recorded as the page's load time — fast, green, meaningless. |
| **Vacuous search gates** | All five `measureSearch` rows query the *exact name of the row already visible on screen*, so `expect(rowWith(name)).toBeVisible()` can resolve against the stale pre-filter render. The number degenerates to response arrival, excluding render — and the query is the most selective possible workload rather than a realistic broad prefix. |
| **Harness latency inside the clock** | `clickHoverAction`'s 3×3 s retry budget (`Top OS hosts page`, `OS Updates - top OS hosts`) and `clickStatusWithMostHosts`'s per-link `innerText()` loop (`OS Settings - status hosts`) are billed to the reported page-load times. |
| **`measureNav` used where `measureSearch` belongs** | `Reports › Team - search` includes the client debounce; its sibling `All fleets - search` does not. Adjacent rows, incomparable numbers. |
| **Arbitrary subject selection** | `firstHostId` picks whichever host sorts first by display name; `Label filter - first available` picks whichever label the dropdown lists first. Both are dataset-order-dependent, so their numbers are not stable across dataset rebuilds — and `firstHostId` silently degrades to `0` on failure. |

### Where results go, and whether anything consumes them

`.perf-results/*.json` (one file per measurement, transient) → deleted by the teardown →
`.perf-history/<timestamp>/results.json`, capped at 10 runs, compared against the last 3, printed
once to stdout. Both directories are **gitignored** ([`.gitignore:9-10`](../../.gitignore)) and no
workflow in `.github/workflows/` runs the loadtest project.

So the entire trend record lives only in the local checkout, and **nothing consumes it beyond the
next local run's terminal output** — no artifact upload, no CSV/JSON export, no dashboard, no
alerting, no commit. The history in this checkout illustrates the failure mode:

| Run dir | Measurements stored |
|---|---:|
| `2026-04-17_160519` | 21 |
| `2026-04-17_161256` | 24 |
| `2026-04-17_162222` | 73 |
| `2026-04-17_170741` | 73 |
| `2026-04-17_172250` | 26 |
| `2026-04-17_174015` | 73 |
| `2026-05-03_205547` | 11 |
| `2026-05-12_094000` | 65 |
| `2026-05-12_094340` | 71 |
| `2026-05-12_094721` | **1** |

Only 3 of 10 stored runs are complete. The teardown has no notion of a "complete run", so a
`--grep`-filtered or single-test run occupies a history slot and **displaces a full baseline**. The
three runs used for the comparison columns are the 65-, 71- and 1-measurement runs, so most rows
compare against `—`. Latest recorded run is 2026-05-12, ~2.5 months stale as of this audit.
The teardown also `rmSync`s `.perf-results/` *before* writing history
([`perf-teardown.ts:72`](../../helpers/perf-teardown.ts)), so a failure in the history write loses
the run. And because `globalTeardown` is registered at config top level, a leftover `.perf-results/`
from a crashed loadtest run would be folded into the next *premium or free* run's history.

Cosmetic but relevant to reading the report: results are grouped by section but ordered by file name
(`Date.now()`-prefixed), i.e. by completion order, which shuffles between parallel runs — so rows
move around inside a section from run to run.

### Environment constraint (why Andrey can't just run this)

This project **cannot be pointed at the premium or free QA instances**. It needs:

1. A dedicated high-scale Fleet instance (per-run credentials).
2. `playwright/.env.loadtest` (gitignored) with `FLEET_URL`, `FLEET_API_TOKEN`,
   `FLEET_ADMIN_EMAIL`, `FLEET_ADMIN_PASSWORD`, `FLEET_LOADTEST_FLEET_ID`.
3. A team provisioned by [`gitops/loadtest/generate.sh`](../../../gitops/loadtest/README.md) —
   ~1.5 k entities, several minutes of `fleetctl gitops` apply against a version-matched local
   `fleetctl` build, with the enroll secret and team name filled in by hand.
4. Hosts manually transferred into that team, then a wait for the software / vulnerability / label
   crons before the data-dependent measurements have anything to render.
5. `FLEET_LOADTEST_FLEET_ID` wired back into `.env.loadtest`.

Then `npm run test:loadtest`, locally. There is no CI path. Practically, manual re-verification of
this area requires standing up an instance first — it is not a "walk through the suite by hand"
exercise like the other areas.

### Coverage map

| Feature / user flow | Covered by | Gap |
|---|---|---|
| Dashboard (All fleets + team, 3 platforms) | PERF-01 | ChromeOS/iOS/iPadOS variants; card values never read; Unassigned scope |
| Hosts list (load, sort, status/platform/label filter, search) | PERF-02 | pagination, combined filters, Export hosts, non-name sorts, row counts |
| Host details (page, software, reports, policies tabs) | PERF-03 | Queries tab, Refetch, host-software search/pagination, worst-case host |
| Software inventory + versions (sort, vulnerable, search) | PERF-04 | **Library / Fleet-maintained / App Store tabs** (276 FMAs + 240 packages provisioned, none measured); title & version detail; pagination |
| Software OS (load, platform, sort, view hosts) | PERF-05 | OS detail page |
| Vulnerabilities (load, exploited, severity sort, CVE search) | PERF-06 | CVE detail page, combined filters, pagination |
| Policies (All fleets + team, automation filters) | PERF-07 | detail page, results view, search, pagination over 500, pass/fail aggregates |
| Reports (All fleets + team, platform filter, search) | PERF-08 | detail/results pages, pagination over 500, UI-dropdown platform path |
| Controls — OS updates, OS settings, profiles, certificates, setup experience, scripts, variables | PERF-09 | **OS Settings page load itself**; setup assistant; bootstrap package; setup-experience users; run-script; profile/script detail |
| Labels | PERF-10 | table render (measurement is shell-only), search, pagination, label detail |
| Users | PERF-11 | no scale in the dataset; search, pagination, team-filtered list |
| Queries / packs / integrations / org settings | — | not measured at all |
| Login, and the initial post-login redirect | — | never measured, though it is the first thing every user experiences |

### Duplication

1. **Platform/scope fan-outs (26 of 73 measurements).** `Install software` ×6 (PERF-09 rows 6–11),
   dashboard platforms ×3, hosts platform filters ×3, OS platform filters ×3, plus the All-fleets /
   team mirrors in PERF-07 and PERF-08. Each family is one code path with a different URL token.
2. **Ascending/descending sort pairs (12 measurements).** PERF-02 rows 8/9, PERF-04 rows 2–5 and
   9–12, PERF-05 rows 5/6, PERF-06 rows 3/4. Direction rarely changes cost at the same scale.
3. **`hosts_count` sort measured three times** — PERF-04 rows 4/5 (titles), 11/12 (versions),
   PERF-05 rows 5/6 (OS), the last two under *identical* labels in different sections.
4. **`View all hosts` hover action measured twice** — PERF-05 row 7 and PERF-09 row 2, both landing
   on the hosts list.
5. **Vulnerable-filter family measured four times** — PERF-03 row 3, PERF-04 rows 6/13, PERF-06
   row 1/2.
6. **Shell-only measurements (5)** — PERF-09 rows 4/12/14, PERF-10, and effectively PERF-11 are all
   measuring the same thing (bundle parse + heading paint) under five different names.

### UI-vs-API balance

Every measurement is browser-side; there is no API timing at all. That is right for a
user-perceived-latency suite, but two consequences follow:

- **The API is never timed independently**, so a number cannot be split into "server was slow" vs
  "React render was slow" — which is the first question anyone asks about a regression. Adding a
  `page.waitForResponse` timestamp inside `measureNav` would give both halves for free.
- **No measurement validates its own payload.** Not one test asserts a row count, a card value, or a
  cell's content beyond "non-empty" (PERF-01 row 2 is the sole exception). Combined with
  `rowOrEmpty()`, a Fleet build that returns empty lists everywhere would produce the fastest,
  greenest report this suite has ever printed.

### Quick wins

1. **Say what this is.** Add a header comment to `helpers/perf.ts` and a line to `CLAUDE.md`:
   *"records timings; never fails on slowness"*. Right now the `tests/` location implies a gate that
   does not exist.
2. **Fix the four shell-only anchors** — `LabelsPage.goto()` → `table.firstRow`,
   `ConfigurationProfilesPage.goto()` / `ScriptsLibraryPage.goto()` → `list.firstItem`,
   `VariablesPage.goto()` → `table.firstRow`, and give `ScriptsBatchProgressPage.goto()` an anchor.
   Five measurements go from meaningless to meaningful with four one-line edits. (Note these `goto()`s
   are shared with e2e specs — verify the e2e callers tolerate the stricter anchor.)
3. **Make `Reports › Team - search` use `measureSearch`**
   ([`reports.spec.ts:50`](../../tests/loadtest/reports.spec.ts)) so it is comparable to
   `All fleets - search`.
4. **Record run metadata** in `results.json` — worker count, Fleet version, host/software/CVE counts,
   and a `complete: true` flag — then have the teardown skip incomplete runs when building the
   comparison columns, so a `--grep` run stops displacing a full baseline.
5. **Replace `rowOrEmpty()` with a row-count assertion** wherever a populated dataset is a
   precondition (all four Policies rows, Reports rows 1–2, the hosts filter rows). An empty list
   should fail loudly, not record a fast time.

### Bigger bets

1. **Add a real gate, or move the project out of `tests/`.** Two viable shapes: (a) commit a
   `perf-baseline.json` of per-`section|label` p50s and fail a measurement that exceeds
   `baseline × 1.5` (with `--update-baseline` to re-bless); or (b) accept it as a reporting tool,
   move it to `tools/perf/`, and stop implying it is a test suite. Either is better than the current
   ambiguity, where a 29 s page load is a pass.
2. **Make the numbers statistically usable.** Pin `workers=1` for the loadtest project (removing
   self-contention), take 3–5 samples per measurement and record the median plus spread, and split
   the report into explicit **cold** and **warm** tables. This is the difference between "we have
   timings" and "we can detect a 20 % regression". Cost: runtime goes up several-fold — acceptable
   for a manually-triggered local suite.
3. **Re-point the fan-out budget at the untested scale surfaces.** Collapse `Install software` ×6 to
   2, the ascending/descending pairs to one direction each, and the platform fan-outs to one
   representative each (~20 measurements freed), then spend them on Software **Library** /
   **Fleet-maintained** / **App Store** (276 FMAs and 240 packages are provisioned and never
   measured), pagination on the 500-row lists, the detail pages (policy / report / CVE / OS / label),
   and the login → dashboard first-paint path.
