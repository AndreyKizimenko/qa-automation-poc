# Software vulnerabilities, versions & OS — test audit

**Specs covered:** 5 files · **Test declarations:** 15 entries (24 runtime tests — three specs generate variants in a `for` loop) · **Projects:** premium / free

This area covers Fleet's Software section outside the install/library flows: the
**Inventory** tab's `vulnerable=true` filter and its Vulnerabilities column, the
title → version → **CVE detail** drill-down, the host-details Software tab's
vulnerable filter, the **Vulnerabilities** tab (search, exploited filter,
pagination, CVE detail), the **OS** tab (platform filter, "View all hosts"), and
the global **vulnerability-automations webhook**. Premium and free carry
near-identical vulnerability specs (the free copies drop the team dropdown); the
OS tab is premium-only. Every drill-down test discovers its target data through
the Fleet API in `beforeAll` and skips when the instance has none.

## Contents

| ID | Spec | Test | Mode | Manual? |
|---|---|---|---|---|
| SWV-01 | `premium/software/vulnerabilities.spec.ts` | Software Titles — every vulnerable-filtered row reports vulnerability data **(skipped — #50059)** | UI | ☐ |
| SWV-02 | `premium/software/vulnerabilities.spec.ts` | Software Titles — vulnerable filter, pagination, and column checks | UI | ☐ |
| SWV-03 | `premium/software/vulnerabilities.spec.ts` | `{macOS, Linux (deb)†, Windows}` — software titles → version → CVE detail flow | UI | ☐ |
| SWV-04 | `premium/software/vulnerabilities.spec.ts` | Vulnerabilities tab — search narrows to a single CVE | UI | ☐ |
| SWV-05 | `premium/software/vulnerabilities.spec.ts` | Vulnerabilities tab — exploited-vulnerabilities filter | UI | ☐ |
| SWV-06 | `premium/software/vulnerabilities.spec.ts` | Vulnerabilities tab — list, pagination, and CVE detail flow | UI | ☐ |
| SWV-07 | `premium/software/vulnerabilities.spec.ts` | `{macOS, Linux (deb)†, Windows}` host — vulnerable software → version → CVE flow | UI | ☐ |
| SWV-08 | `premium/software/vulnerability-automations.spec.ts` | Premium • Software • Vulnerability automations › enabling with a webhook URL persists | UI+API | ☐ |
| SWV-09 | `premium/software/os.spec.ts` | OS tab — platform filter narrows the list to `{macOS, Windows}` | UI | ☐ |
| SWV-10 | `premium/software/os.spec.ts` | OS tab — "View all hosts" lands on the Hosts list filtered by that OS | UI | ☐ |
| SWV-11 | `free/software/vulnerabilities.spec.ts` | Software vulnerabilities › Software Titles — vulnerable filter, pagination, and column checks | UI | ☐ |
| SWV-12 | `free/software/vulnerabilities.spec.ts` | `{macOS, Linux (deb), Windows}` — software titles → version → CVE detail flow | UI | ☐ |
| SWV-13 | `free/software/vulnerabilities.spec.ts` | Vulnerabilities tab — list, pagination, and CVE detail flow | UI | ☐ |
| SWV-14 | `free/software/vulnerabilities.spec.ts` | `{macOS, Linux (deb), Windows}` host — vulnerable software → version → CVE flow | UI | ☐ |
| SWV-15 | `free/software/vulnerability-automations.spec.ts` | Free • Software • Vulnerability automations › enabling with a webhook URL persists | UI+API | ☐ |

† the `Linux (deb)` variant is skipped on premium only ([fleetdm/fleet#49913](https://github.com/fleetdm/fleet/issues/49913)).

`Mode`: **UI** = all validation through the browser · **UI+API** = browser flow with
some assertions via API · **API** = no meaningful UI validation · **PERF** = timing.

---

## Read this before running the vulnerability specs by hand

**The `softwareByOS` "isolation exception" no longer exists.**
[`tests/README.md:154`](../../tests/README.md) says the vulnerability flow "builds up
`softwareByOS` across ordered tests". That is **stale** — in both the premium and free
specs `softwareByOS` and `hostByOS` are filled **once, entirely inside
`test.beforeAll`, via the API** ([premium
`vulnerabilities.spec.ts:39-57`](../../tests/e2e/premium/software/vulnerabilities.spec.ts),
[free `:34-50`](../../tests/e2e/free/software/vulnerabilities.spec.ts)) and are only
ever **read** by the tests. Git history shows they were never accumulated across
tests in this repo.

Consequences for manual / targeted runs:

- **Any single test can be run alone.** `beforeAll` re-runs in whatever worker picks
  up the test, so `-g "Windows — software titles"` populates the refs it needs. No
  ordering dependency exists between SWV-01…SWV-07 (or SWV-11…SWV-14).
- Declaration order in the premium file is SWV-01, SWV-02, SWV-03 (macos → deb →
  windows), SWV-04, SWV-05, SWV-06, SWV-07 (macos → deb → windows). That order is
  cosmetic only.
- Because `playwright.config.ts` sets `fullyParallel: true`, the file's tests are
  spread over workers and **`beforeAll` runs once per worker** — 2 (CI) to 4 (local)
  concurrent copies of the discovery sweep. See the temp-table note below.
- The README line should be deleted or rewritten (quick win Q5).

**QA-instance risk — concurrent `vulnerable=true` 500s ("table is full").**
`findVulnerableSoftwareBySources` ([`helpers/api/software.ts:49`](../../helpers/api/software.ts))
issues up to 5 × `GET /software/titles?vulnerable=true&per_page=100`, and it
**throws** on a non-OK response, failing *every* test in that worker's chunk with a
`beforeAll` error. Multiply by workers, and by the free spec's identical sweep, and
this is the most likely place in the suite to trip the known QA MySQL temp-table
exhaustion. The same query also runs through the UI in SWV-02, SWV-03, SWV-11,
SWV-12 (and SWV-01 when un-skipped) — there a 500 surfaces as an empty table plus a
`pageHealth` 5xx failure at teardown. `findHostByPlatform`
([`helpers/api/hosts.ts:40`](../../helpers/api/hosts.ts)) additionally fires up to 50
`hosts/:id/software?vulnerable=true` probes per platform, but **swallows** failures
(`return null` / `continue`) → SWV-07/SWV-14 silently *skip* instead of failing.

---

### SWV-01 · Software Titles — every vulnerable-filtered row reports vulnerability data

- **File:** [`playwright/tests/e2e/premium/software/vulnerabilities.spec.ts`](../../tests/e2e/premium/software/vulnerabilities.spec.ts) (L79)
- **Grep:** `npx playwright test --project=premium -g "every vulnerable-filtered row reports vulnerability data"`
- **Project:** premium · **Scope:** Unassigned
- **Mode:** UI · **Isolation:** independent; reads nothing from `beforeAll`
- **Status:** **`test.skip` — blocked by [fleetdm/fleet#50059](https://github.com/fleetdm/fleet/issues/50059)** (`vulnerable=true` is not fleet-scoped; `fuse3` renders `---` on the premium instance). Logged in [`docs/blocked-by-product-bugs.md`](../blocked-by-product-bugs.md).
- **Preconditions:** instance has vulnerable software in Unassigned
- **Data created:** none

**Flow**

1. ☐ Open **Software → Inventory** (via URL `/software/inventory`), select **Unassigned** in the team dropdown.
   - ✅ *(UI)* Inventory tab is `aria-selected=true`; a row or the empty state is visible — `SoftwareTitlesPage.goto()`.
   - ✅ *(UI)* Team dropdown reads "Unassigned" — `TeamDropdown.select`.
2. ☐ Click **Add filters** → toggle **Vulnerable software** → click **Apply**.
   - ✅ *(UI)* Filter trigger was enabled before the click — `FilterModal.open`.
   - ✅ *(UI)* URL contains `vulnerable=true` — asserted twice (`FilterModal.applyVulnerable` and the spec's `openVulnerableTitles`).
3. ☐ For every row on page 1, read the **Vulnerabilities** cell.
   - ✅ *(UI)* Cell text is not `---` — `expectRowHasVulnData` ([`helpers/vuln.ts:26`](../../helpers/vuln.ts)).

**Assessment**
- *Value:* the only assertion in the suite that the vulnerable filter never returns a row with no CVE data — i.e. that filter and column agree. Currently earning its keep as a bug reproducer, not as a regression guard.
- *Coverage gaps:* page 1 only; doesn't check the count badge, severity column, or that the CVEs listed actually belong to the title.
- *Redundancy:* the identical loop runs unskipped on free inside SWV-11 (`free/.../vulnerabilities.spec.ts:61-66`).
- *Efficiency / smells:* `rows.count()` is a one-shot read — with an empty/late table `rowCount === 0` and the test **passes with zero assertions** (`vulnerabilities.spec.ts:92-95`). `expectRowHasVulnData` constructs a new `DataTable` and re-scans `thead` per row (`helpers/vuln.ts:27-29`), so header resolution is O(rows × columns).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWV-02 · Software Titles — vulnerable filter, pagination, and column checks

- **File:** [`playwright/tests/e2e/premium/software/vulnerabilities.spec.ts`](../../tests/e2e/premium/software/vulnerabilities.spec.ts) (L99)
- **Grep:** `npx playwright test --project=premium -g "Software Titles — vulnerable filter, pagination, and column checks"`
- **Project:** premium · **Scope:** Unassigned
- **Mode:** UI · **Isolation:** independent
- **Preconditions:** vulnerable titles in Unassigned; ≥2 pages for the pagination leg
- **Data created:** none

**Flow**

1. ☐ Open **Software → Inventory** (via URL), select **Unassigned**, click **Add filters** → **Vulnerable software** → **Apply**.
   - ✅ *(UI)* Inventory tab selected, row-or-empty visible, dropdown reads Unassigned, URL has `vulnerable=true`.
2. ☐ Find a row whose **Vulnerabilities** cell reads "N vulnerabilities" and hover it.
   - ✅ *(UI)* A tooltip list containing `CVE-…` list items becomes visible within 5 s and its first item matches `CVE-\d{4}-\d+` — `assertVulnTooltip` ([`helpers/vuln.ts:47`](../../helpers/vuln.ts)).
   - ⚠️ Whole step is inside `if (multiRow)` — skipped silently when page 1 has no aggregate row.
3. ☐ Find a row whose **Vulnerabilities** cell is a single CVE id.
   - ✅ *(UI)* Cell text matches `^CVE-\d{4}-\d+$` — `expectSingleCve`.
   - ⚠️ Also `if`-guarded.
4. ☐ Click **Next**, **Next**, then **Previous** in the pager.
   - ✅ *(UI)* After each click the first row's primary link text differs from before — `Pagination.nextIfEnabled` / `previousIfEnabled`.
   - ⚠️ Second **Next** and **Previous** only run when the first **Next** was enabled; their boolean results are discarded, so a disabled control is a silent no-op.

**Assessment**
- *Value:* smoke-covers the vulnerable filter plus the two rendering modes of the Vulnerabilities column (single CVE inline, tooltip for many) and that paging fetches fresh rows.
- *Coverage gaps:* no assertion on the item-count text, on sort by Vulnerabilities, on the tooltip's CVE contents matching the row, or on returning to page 1 restoring the original rows.
- *Redundancy:* SWV-11 is the same test on free **plus** the SWV-01 every-row loop; steps 1–4 are byte-identical apart from the team dropdown.
- *Efficiency / smells:* three `if` branches mean the test can pass having asserted only "URL contains vulnerable=true" (`vulnerabilities.spec.ts:105-118`). `findRowByColumnPattern` re-resolves headers per row. Enters by URL rather than clicking **Software** in the navbar, against the `CLAUDE.md` e2e rule.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWV-03 · `{macOS · Linux (deb) · Windows}` — software titles → version → CVE detail flow

- **File:** [`playwright/tests/e2e/premium/software/vulnerabilities.spec.ts`](../../tests/e2e/premium/software/vulnerabilities.spec.ts) (L121-156, `for (const osKey of OS_KEYS)`)
- **Grep:** `npx playwright test --project=premium -g "macOS — software titles → version → CVE detail flow"` (swap `Windows`; `Linux \(deb\)` needs the escapes)
- **Project:** premium · **Scope:** Unassigned · **Variants:** macOS (`apps`), Linux deb (`deb_packages`) **skipped**, Windows (`programs`/`chocolatey_packages`)
- **Mode:** UI (API used for target discovery only) · **Isolation:** independent; reads `softwareByOS` from `beforeAll`
- **Preconditions:** `findVulnerableSoftwareBySources` found a title for the platform whose versions carry ≥1 CVE **in Unassigned**; otherwise `test.skip('No <OS> software found')`. ⚠️ unclear: the helper passes no `order_key`, so which title you get depends on Fleet's default ordering — to reproduce manually, filter **Vulnerable software** and pick any title of that platform whose Vulnerabilities cell isn't `---`.
- **Data created:** none

**Flow**

1. ☐ Open **Software → Inventory** (via URL), select **Unassigned**, apply the **Vulnerable software** filter.
   - ✅ *(UI)* As SWV-02 step 1.
2. ☐ Type the discovered title name into **Search by name or vulnerability**.
   - ✅ *(UI)* A first row is visible — `searchByName`. ⚠️ does **not** assert the row is the searched title, so a not-yet-refetched table satisfies it.
3. ☐ Click the title's name link.
4. ☐ On the title page, scan the versions table and click the first version whose **Vulnerabilities** cell isn't `---`.
   - ✅ *(UI)* Versions table has rendered a row — `SoftwareTitleDetailPage.waitForReady`.
   - ✅ *(UI)* Throws `No version with vulnerabilities found on this software title` if every version reads `---` — `clickFirstVersionWithVulnerabilities` ([`SoftwareTitleDetailPage.ts:56`](../../pages/software/SoftwareTitleDetailPage.ts)).
5. ☐ On the version page, click the first **Vulnerability** link.
   - ✅ *(UI)* CVE table has a row; the link text matches `^CVE-\d{4}-\d+$` — `SoftwareVersionDetailPage.clickFirstCve`.
6. ☐ Land on the CVE detail page.
   - ✅ *(UI)* URL matches `/software/vulnerabilities/CVE-`.
   - ✅ *(UI)* `<h1>` equals the clicked CVE id (10 s budget) — `CveDetailPage.waitForReady`.
   - ✅ *(UI)* **Detected** and **Affected hosts** labels visible.
   - ✅ *(UI)* **Visit NVD page** link visible with `href === https://nvd.nist.gov/vuln/detail/<CVE>`.
   - ✅ *(UI)* **macOS variant only:** clicking the link opens a new tab whose URL matches `nvd.nist.gov/vuln/detail/<CVE>`, then closes it — real external request to nvd.nist.gov.
   - ✅ *(UI)* The vulnerable-software table on the CVE page has a row.

**Assessment**
- *Value:* the core vulnerability drill-down for two platforms — proves title → version → CVE routing, that the version's CVE list is populated, and that the CVE page hydrates and links out correctly. Also the only test that exercises the real NVD link.
- *Coverage gaps:* premium's paid CVE fields are never asserted — severity/CVSS, probability of exploit, published date and the premium-only description (`CveDetailPage.description` is defined and never used). No breadcrumb/back navigation; no check that the CVE page's software table actually contains the title we drilled from; deb entirely uncovered on premium.
- *Redundancy:* SWV-12 is the same flow on free (and does **not** skip deb). Steps 4–6 are duplicated by SWV-07/SWV-14, which reach the same pages from the host side.
- *Efficiency / smells:* clicking out to nvd.nist.gov makes the test depend on an external site. `searchByName`'s weak wait (`SoftwareTitlesPage.ts:96-99`) can race the next click. Discovery in `beforeAll` uses raw `fetch` instead of the sanctioned `withRequest` hook helper (`helpers/api/core.ts:71`).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWV-04 · Vulnerabilities tab — search narrows to a single CVE

- **File:** [`playwright/tests/e2e/premium/software/vulnerabilities.spec.ts`](../../tests/e2e/premium/software/vulnerabilities.spec.ts) (L158)
- **Grep:** `npx playwright test --project=premium -g "Vulnerabilities tab — search narrows to a single CVE"`
- **Project:** premium · **Scope:** Unassigned
- **Mode:** UI · **Isolation:** independent
- **Preconditions:** ≥1 CVE listed for Unassigned
- **Data created:** none

**Flow**

1. ☐ Open **Software → Inventory** (via URL), select **Unassigned**, click the **Vulnerabilities** tab.
   - ✅ *(UI)* URL matches `/software/vulnerabilities`; the table has a row — `gotoVulnerabilitiesTab`.
2. ☐ Read the first row's **Vulnerability** link text.
   - ✅ *(UI)* It matches `^CVE-\d{4}-\d+$` — `firstCveName`.
3. ☐ Type that CVE id into **Search by CVE**.
   - ✅ *(UI)* The table settles to exactly **1** `tbody tr`.
   - ✅ *(UI)* That row's primary link text equals the searched CVE.

**Assessment**
- *Value:* proves server-side CVE search is exact and wired to the table — the one place the Vulnerabilities-tab search box is covered.
- *Coverage gaps:* no partial-id search (e.g. `CVE-2026-`), no no-results empty state, no clearing the search to restore the list, and no search-by-CVE on the Inventory tab (whose box advertises "name or vulnerability").
- *Redundancy:* none — free has no counterpart (gap on free).
- *Efficiency / smells:* none material; `toHaveCount(1)` retries so the un-awaited fill is safe.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWV-05 · Vulnerabilities tab — exploited-vulnerabilities filter

- **File:** [`playwright/tests/e2e/premium/software/vulnerabilities.spec.ts`](../../tests/e2e/premium/software/vulnerabilities.spec.ts) (L175)
- **Grep:** `npx playwright test --project=premium -g "Vulnerabilities tab — exploited-vulnerabilities filter"`
- **Project:** premium · **Scope:** Unassigned
- **Mode:** UI · **Isolation:** independent
- **Preconditions:** none beyond a populated Vulnerabilities tab
- **Data created:** none

**Flow**

1. ☐ Open **Software → Inventory** (via URL), select **Unassigned**, click the **Vulnerabilities** tab.
   - ✅ *(UI)* URL `/software/vulnerabilities`, table has a row.
2. ☐ In the exploited-vulnerabilities dropdown choose **Exploited vulnerabilities**.
   - ✅ *(UI)* The option was visible before clicking, and the dropdown's rendered value becomes "Exploited vulnerabilities" — `selectExploitedFilter` ([`VulnerabilitiesListPage.ts:45`](../../pages/software/VulnerabilitiesListPage.ts)).
   - ✅ *(UI)* URL contains `exploit=true`.
   - ✅ *(UI)* Either a row **or** the empty state is visible.

**Assessment**
- *Value:* thin — proves the premium exploited filter drives `exploit=true` and doesn't blank the page.
- *Coverage gaps:* nothing verifies the filtered rows *are* exploited (no "Known exploit"/probability column assertion), that the row count shrank, or that switching back to **All vulnerabilities** restores the list. Severity / CVSS filters are not touched at all.
- *Redundancy:* none (premium-only feature).
- *Efficiency / smells:* `rowOrEmpty()` is a visibility-only assertion that cannot fail meaningfully — the strongest signal in the test is the URL. Class-based react-select locators are documented as unavoidable.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWV-06 · Vulnerabilities tab — list, pagination, and CVE detail flow

- **File:** [`playwright/tests/e2e/premium/software/vulnerabilities.spec.ts`](../../tests/e2e/premium/software/vulnerabilities.spec.ts) (L191)
- **Grep:** `npx playwright test --project=premium -g "Vulnerabilities tab — list, pagination, and CVE detail flow"`
- **Project:** premium · **Scope:** Unassigned
- **Mode:** UI · **Isolation:** independent
- **Preconditions:** CVEs listed for Unassigned; ≥2 pages for the pagination leg
- **Data created:** none

**Flow**

1. ☐ Open **Software → Inventory** (via URL), select **Unassigned**, click the **Vulnerabilities** tab.
   - ✅ *(UI)* URL `/software/vulnerabilities`, table has a row.
2. ☐ Note the first CVE id.
   - ✅ *(UI)* Matches the CVE pattern — `firstCveName`.
3. ☐ Click **Next**, then **Next** again.
   - ✅ *(UI)* First-row link text changes after each enabled click — `Pagination.nextIfEnabled`. ⚠️ `if`-guarded; the second click's result is discarded.
4. ☐ Click the **Vulnerabilities** tab again (already active).
   - ✅ *(UI)* The list resets to page 1 — first row's link text equals the CVE from step 2.
5. ☐ Click the first CVE.
   - ✅ *(UI)* The clicked id equals the step-2 id (`expect(clickedCve).toBe(cveName)`).
   - ✅ *(UI)* URL matches `/software/vulnerabilities/CVE-`.
   - ✅ *(UI)* CVE detail bundle — `<h1>` = CVE, **Detected** + **Affected hosts** labels, **Visit NVD page** href exact, vulnerable-software table has a row (`assertOk`, no NVD click).

**Assessment**
- *Value:* covers the Vulnerabilities list end to end: paging fetches new data, re-clicking the tab resets pagination, and a list row routes to the right CVE page.
- *Coverage gaps:* no column assertions on the list (severity, probability, hosts, published), no sorting, no back-navigation from the CVE page, no `Affected hosts` click-through.
- *Redundancy:* SWV-13 is the identical test on free. Step 5's CVE-page bundle is also asserted by SWV-03, SWV-07, SWV-12, SWV-14 — five entries assert `assertOk` per run.
- *Efficiency / smells:* the pagination leg is optional, so on a single-page instance step 3–4 assert nothing (`vulnerabilities.spec.ts:203-208`).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWV-07 · `{macOS · Linux (deb) · Windows}` host — vulnerable software → version → CVE flow

- **File:** [`playwright/tests/e2e/premium/software/vulnerabilities.spec.ts`](../../tests/e2e/premium/software/vulnerabilities.spec.ts) (L217-263, `for (const osKey of OS_KEYS)`)
- **Grep:** `npx playwright test --project=premium -g "macOS host — vulnerable software → version → CVE flow"` (swap `Windows`; `Linux \(deb\)` needs the escapes)
- **Project:** premium · **Variants:** macOS, Linux deb **skipped** ([#49913](https://github.com/fleetdm/fleet/issues/49913)), Windows · **Scope:** n/a (host detail)
- **Mode:** UI (API used for host discovery only) · **Isolation:** independent; reads `hostByOS` from `beforeAll`
- **Preconditions:** `findHostByPlatform` returned a host of that platform whose `hosts/:id/software?vulnerable=true` is non-empty; otherwise `test.skip('No <OS> host with vulnerable software')`. Hosts are osquery-perf simulations with random names — resolved by platform, never by name.
- **Data created:** none

**Flow**

1. ☐ Open the host's page via URL `/hosts/:id`.
   - ✅ *(UI)* "Disk space available" vitals label visible — `HostDetailsPage.goto`.
2. ☐ Click the **Software** tab.
   - ✅ *(UI)* Table settles to rows **or** empty state (macOS defaults to the Applications view, which can be empty) — `openSoftwareTab`.
3. ☐ On macOS, switch the software-view dropdown to **Full inventory** (no-op on Windows/Linux, where the dropdown doesn't render).
   - ✅ *(UI)* The software search box is visible before the dropdown presence check — guards a silent no-op ([`HostDetailsPage.ts:172-190`](../../pages/hosts/HostDetailsPage.ts)).
   - ✅ *(UI)* URL contains `macos_applications=false`.
   - ✅ *(UI)* A first row is visible (retrying — deliberately not `isVisible()`, which used to skip on a false negative).
4. ☐ Click **Add filters** → **Vulnerable software** → **Apply**.
   - ✅ *(UI)* Trigger enabled; URL contains `vulnerable=true`.
   - ✅ *(UI)* A first row is visible after filtering.
5. ☐ Click the first software title in the Name column.
6. ☐ On the title page, click the first version whose **Vulnerabilities** cell isn't `---`; on the version page click the first **Vulnerability** link.
   - ✅ *(UI)* Versions table rendered; CVE link matches the CVE pattern; throws if no vulnerable version exists.
7. ☐ Land on the CVE detail page.
   - ✅ *(UI)* URL `/software/vulnerabilities/CVE-`; `<h1>` = CVE; **Detected** + **Affected hosts**; **Visit NVD page** href exact; vulnerable-software table has a row (no NVD click).

**Assessment**
- *Value:* the only coverage of the host-details Software tab's vulnerable filter and of the Applications-vs-Full-inventory view switch — plus a second, host-side route into the CVE pages.
- *Coverage gaps:* the vulnerable filter isn't verified to have actually narrowed the list (no count/row-content check); the host's software search box, per-row CVE counts, and "1 filter" button label are untested; no MDM/live-host variant.
- *Redundancy:* steps 6–7 duplicate SWV-03 steps 4–6 exactly; SWV-14 is the same test on free.
- *Efficiency / smells:* the title reached depends on whichever vulnerable package sorts first for that host, so the CVE landed on varies run to run — the same #49913 404 that forced the deb skip can bite macOS/Windows if their first CVE is ever unenriched (noted in [`docs/blocked-by-product-bugs.md`](../blocked-by-product-bugs.md)). Host discovery swallows API errors → silent skip.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWV-08 · Premium • Software • Vulnerability automations › enabling with a webhook URL persists

- **File:** [`playwright/tests/e2e/premium/software/vulnerability-automations.spec.ts`](../../tests/e2e/premium/software/vulnerability-automations.spec.ts) (L33)
- **Grep:** `npx playwright test --project=premium -g "enabling with a webhook URL persists"` (matches the free copy too — add `--project`)
- **Project:** premium · **Scope:** All fleets (the **Automations** button is only enabled there, for global admins)
- **Mode:** UI+API · **Isolation:** mutates **global** app config; `beforeEach` snapshots `webhook_settings.vulnerabilities_webhook` via `GET /config` and `afterEach` restores it via `PATCH /config` (runs even on failure). Fleet merge-patches within `webhook_settings`, so sibling webhook specs running in parallel are unaffected.
- **Preconditions:** global-admin session (default premium auth state)
- **Data created:** app-config change only — reverted in `afterEach`

**Flow**

1. ☐ Open **Software → Inventory** (via URL), select **All fleets**.
   - ✅ *(UI)* Inventory tab selected; dropdown reads "All fleets".
2. ☐ Click **Automations**.
   - ✅ *(UI)* The **Manage automations** modal is visible — `openManageAutomations`.
3. ☐ Turn the **vulnerability automations** toggle on.
   - ✅ *(UI)* Toggle's `aria-checked` is `true` afterwards (idempotent set) — `setVulnerabilityAutomations`.
4. ☐ Select the **Webhook** workflow radio.
   - ✅ *(UI)* The destination-URL input becomes visible — `selectWebhookWorkflow`.
5. ☐ Fill **Destination URL** with `https://example.com/pw-vuln-webhook` and click **Save**.
   - ✅ *(UI)* The modal closes (the reliable save signal) — `saveAutomations`.
   - ✅ *(UI)* Success toast "Successfully updated vulnerability automations." — `Toast.expectSuccess`.
   - ✅ *(API)* `GET /config` → `webhook_settings.vulnerabilities_webhook.enable_vulnerabilities_webhook === true` and `destination_url === <url>`.
6. ☐ Click **Automations** again.
   - ✅ *(UI)* Toggle `aria-checked=true` and the URL field holds the saved value.

**Assessment**
- *Value:* solid round-trip: UI write → server truth → UI re-read, with guaranteed restore. Catches a modal that appears to save but doesn't persist (a recurring Fleet class of bug).
- *Coverage gaps:* no ticket workflow (Jira/Zendesk) path; no disable round-trip; no invalid-URL validation/error toast; no assertion that **Automations** is disabled under a specific fleet (the premium-only rule the POM comment documents); no check that the free/premium modal differ; no actual webhook delivery.
- *Redundancy:* SWV-15 is a near-verbatim copy on free (only the team-dropdown step differs).
- *Efficiency / smells:* the API assertion is justified (server truth is authoritative and race-free). The grep string is shared with the free copy, so `--project` is mandatory when running one.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWV-09 · OS tab — platform filter narrows the list to `{macOS · Windows}`

- **File:** [`playwright/tests/e2e/premium/software/os.spec.ts`](../../tests/e2e/premium/software/os.spec.ts) (L19-39, `for (const {label, value, token} of PLATFORMS)`)
- **Grep:** `npx playwright test --project=premium -g "OS tab — platform filter narrows the list to macOS"` (swap `Windows`)
- **Project:** premium · **Scope:** Unassigned · **Variants:** macOS (`platform=darwin`), Windows (`platform=windows`) — Linux deliberately excluded (rows are distro-named)
- **Mode:** UI · **Isolation:** independent
- **Preconditions:** hosts of that platform have reported an OS (offline hosts keep their last check-in record)
- **Data created:** none

**Flow**

1. ☐ Open **Software → Inventory** (via URL), select **Unassigned**, click the **OS** tab.
   - ✅ *(UI)* URL matches `/software/os`; the table has a row — `gotoOsTab`.
2. ☐ In the platform dropdown choose **macOS** / **Windows**.
   - ✅ *(UI)* Option visible before click; dropdown value becomes the label; a first row is visible — `SoftwareOsPage.selectPlatform`.
   - ✅ *(UI)* URL contains `platform=darwin` / `platform=windows`.
   - ✅ *(UI)* Once settled, **no** row lacks the platform word: `rows.filter({ hasNotText: token }).toHaveCount(0)` — retrying, which absorbs react-query `keepPreviousData`.

**Assessment**
- *Value:* the only assertion that the OS-tab platform filter both drives the query param and genuinely narrows the rendered rows.
- *Coverage gaps:* Linux/ChromeOS/iOS/iPadOS/Android options untested; **All platforms** reset untested; the row's Hosts count and Vulnerabilities columns are never asserted; no OS-tab pagination; clicking an OS row into `/software/os/:id` is never exercised (`SoftwareOsDetailPage` and `clickFirstOs` are dead code across the suite).
- *Redundancy:* none — free has no OS-tab spec at all.
- *Efficiency / smells:* `hasNotText` matches the **whole row**, not the Name column the comment describes (`os.spec.ts:35-37`), so a platform word appearing in any other column would mask a wrong row. Two full navigations for what is one filter interaction.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWV-10 · OS tab — "View all hosts" lands on the Hosts list filtered by that OS

- **File:** [`playwright/tests/e2e/premium/software/os.spec.ts`](../../tests/e2e/premium/software/os.spec.ts) (L41)
- **Grep:** `npx playwright test --project=premium -g "OS tab — \"View all hosts\" lands on the Hosts list filtered by that OS"`
- **Project:** premium · **Scope:** Unassigned
- **Mode:** UI · **Isolation:** independent
- **Preconditions:** ≥1 OS row for Unassigned
- **Data created:** none

**Flow**

1. ☐ Open **Software → Inventory** (via URL), select **Unassigned**, click the **OS** tab.
   - ✅ *(UI)* URL `/software/os`; table has a row.
2. ☐ Read the first row's **Name** (e.g. "Microsoft Windows 11 Pro"), dropping the `Microsoft ` prefix.
3. ☐ Hover the first row and click **View all hosts**.
   - ✅ *(UI)* Hover-only button clicked, retried up to 3× with a final `force` fallback — `clickHoverAction`.
4. ☐ Land on the Hosts list.
   - ✅ *(UI)* The "hosts filtered by …" status pill is visible.
   - ✅ *(UI)* The pill text contains the normalized OS name.

**Assessment**
- *Value:* covers the OS → Hosts hand-off and that the filter pill names the right OS — a real integration between two pages.
- *Coverage gaps:* doesn't assert the URL params (`os_version_id`/`os_name`), that the host count matches the OS row's count, that the listed hosts are of that OS, or that clearing the pill restores the unfiltered list. Only the first row (whatever OS that is) is exercised.
- *Redundancy:* none in this area (⚠️ possible overlap with hosts-area filter-pill tests — cross-check area 03).
- *Efficiency / smells:* the `Microsoft ` string surgery encodes a product labelling quirk; if Fleet changes either label the assertion silently weakens to a substring match. `force: true` fallback inside `clickHoverAction` is a tolerated flake workaround.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWV-11 · Software vulnerabilities › Software Titles — vulnerable filter, pagination, and column checks *(free)*

- **File:** [`playwright/tests/e2e/free/software/vulnerabilities.spec.ts`](../../tests/e2e/free/software/vulnerabilities.spec.ts) (L53)
- **Grep:** `npx playwright test --project=free -g "Software Titles — vulnerable filter, pagination, and column checks"`
- **Project:** free · **Scope:** single (no team dropdown)
- **Mode:** UI · **Isolation:** independent
- **Preconditions:** vulnerable titles on the free instance
- **Data created:** none

**Flow**

1. ☐ Open **Software → Inventory** (via URL) — no scope step on free — click **Add filters** → **Vulnerable software** → **Apply**.
   - ✅ *(UI)* Inventory tab selected, row-or-empty visible, URL has `vulnerable=true` (asserted in the POM and again in the spec).
2. ☐ For every row on page 1, read the **Vulnerabilities** cell.
   - ✅ *(UI)* Cell is not `---` — `expectRowHasVulnData`. **This is the assertion premium skips as SWV-01**; it runs here because free has one scope, so #50059 can't leak.
3. ☐ Hover a "N vulnerabilities" row → tooltip lists CVEs (first matches the CVE pattern). ⚠️ `if`-guarded.
4. ☐ Single-CVE row's cell matches `^CVE-\d{4}-\d+$`. ⚠️ `if`-guarded.
5. ☐ **Next**, **Next**, **Previous** — first-row link text changes after each enabled click. ⚠️ `if`-guarded.

**Assessment**
- *Value:* on free this is the one filter+column test, and it carries the every-row integrity check that premium can't run today.
- *Coverage gaps:* same as SWV-02 (no item-count, no sort, no page-1 restore); page 1 only for step 2.
- *Redundancy:* **direct duplicate of SWV-02** plus **SWV-01**; the only behavioural difference is the missing team dropdown. A single shared spec with a scope-aware helper would cover both tiers.
- *Efficiency / smells:* `rows.count()` non-retrying → zero-assertion pass if the table is empty (`free/.../vulnerabilities.spec.ts:61-66`); three `if` branches; O(rows × columns) header scans.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWV-12 · `{macOS · Linux (deb) · Windows}` — software titles → version → CVE detail flow *(free)*

- **File:** [`playwright/tests/e2e/free/software/vulnerabilities.spec.ts`](../../tests/e2e/free/software/vulnerabilities.spec.ts) (L83-108, `for (const osKey of OS_KEYS)`)
- **Grep:** `npx playwright test --project=free -g "Windows — software titles → version → CVE detail flow"` (swap `macOS`; `Linux \(deb\)` needs the escapes)
- **Project:** free · **Variants:** macOS, Linux deb, Windows — **none skipped**
- **Mode:** UI (API discovery only) · **Isolation:** independent; reads `softwareByOS` from the file's `beforeAll` (no `fleetId`, since free has no fleets)
- **Preconditions:** a vulnerable title per source group exists; otherwise `test.skip('No <OS> software found')`
- **Data created:** none

**Flow**

Identical to SWV-03 with the team-dropdown step removed:

1. ☐ Open **Software → Inventory** (via URL) → **Add filters** → **Vulnerable software** → **Apply**.
   - ✅ *(UI)* URL has `vulnerable=true`.
2. ☐ Search the discovered title, click its name link.
   - ✅ *(UI)* A row is visible after typing (⚠️ not asserted to be the searched title).
3. ☐ Click the first version whose **Vulnerabilities** cell isn't `---`; then the first **Vulnerability** link.
   - ✅ *(UI)* Versions table rendered; CVE link matches the CVE pattern; throws if no vulnerable version.
4. ☐ CVE detail page.
   - ✅ *(UI)* URL `/software/vulnerabilities/CVE-`; `<h1>` = CVE; **Detected** + **Affected hosts** labels; **Visit NVD page** href exact; **macOS variant** clicks it and asserts the new tab's URL; CVE-page software table has a row.

**Assessment**
- *Value:* free-tier drill-down parity, including the deb variant that premium can't run.
- *Coverage gaps:* the free CVE page's *reduced* content is never asserted as reduced — nothing verifies the premium-only description/severity block is absent on free, which is the tier difference a manual tester would check here.
- *Redundancy:* duplicate of SWV-03 modulo the dropdown and the deb skip.
- *Efficiency / smells:* ⚠️ the deb variant is unskipped on free while premium skips it for #49913. Plausible reason: the 404 is in the **premium** CVE-detail endpoint (per the issue notes), so free takes another path — but if this variant ever fails on free, the skip decision needs revisiting, not the test. External NVD click on the macOS variant duplicates SWV-03's.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWV-13 · Vulnerabilities tab — list, pagination, and CVE detail flow *(free)*

- **File:** [`playwright/tests/e2e/free/software/vulnerabilities.spec.ts`](../../tests/e2e/free/software/vulnerabilities.spec.ts) (L110)
- **Grep:** `npx playwright test --project=free -g "Vulnerabilities tab — list, pagination, and CVE detail flow"`
- **Project:** free · **Scope:** single
- **Mode:** UI · **Isolation:** independent
- **Preconditions:** CVEs listed on the free instance
- **Data created:** none

**Flow**

1. ☐ Open **Software → Inventory** (via URL), click the **Vulnerabilities** tab.
   - ✅ *(UI)* URL `/software/vulnerabilities`; table has a row.
2. ☐ Note the first CVE id (asserted to match the CVE pattern).
3. ☐ Click **Next** twice. ⚠️ `if`-guarded; second result discarded.
   - ✅ *(UI)* First-row link text changes per enabled click.
4. ☐ Click the **Vulnerabilities** tab again → list resets to page 1.
   - ✅ *(UI)* First row's link text equals the step-2 CVE.
5. ☐ Click the first CVE → CVE detail page.
   - ✅ *(UI)* Clicked id equals step-2 id; URL `/software/vulnerabilities/CVE-`; `assertOk` bundle (heading, **Detected**, **Affected hosts**, NVD href, software table row).

**Assessment**
- *Value:* free-tier Vulnerabilities-list parity.
- *Coverage gaps:* free has **no** counterpart to SWV-04 (CVE search) — the free Vulnerabilities tab's search box is entirely untested; also no column/sort assertions.
- *Redundancy:* duplicate of SWV-06.
- *Efficiency / smells:* optional pagination leg can no-op; `assertOk` runs for the fifth time across the area.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWV-14 · `{macOS · Linux (deb) · Windows}` host — vulnerable software → version → CVE flow *(free)*

- **File:** [`playwright/tests/e2e/free/software/vulnerabilities.spec.ts`](../../tests/e2e/free/software/vulnerabilities.spec.ts) (L135-173, `for (const osKey of OS_KEYS)`)
- **Grep:** `npx playwright test --project=free -g "Windows host — vulnerable software → version → CVE flow"` (swap `macOS`; `Linux \(deb\)` needs the escapes)
- **Project:** free · **Variants:** macOS, Linux deb, Windows — **none skipped**
- **Mode:** UI (API host discovery only) · **Isolation:** independent; reads `hostByOS` from `beforeAll`
- **Preconditions:** a host of that platform reporting vulnerable software; otherwise skip. Simulated osquery-perf hosts.
- **Data created:** none

**Flow**

Identical to SWV-07:

1. ☐ Open `/hosts/:id` (via URL) — ✅ *(UI)* vitals "Disk space available" visible.
2. ☐ Click **Software** — ✅ *(UI)* rows-or-empty settled.
3. ☐ macOS: switch to **Full inventory** — ✅ *(UI)* search box visible first; URL `macos_applications=false`; ✅ *(UI)* first row visible.
4. ☐ **Add filters** → **Vulnerable software** → **Apply** — ✅ *(UI)* URL `vulnerable=true`; first row visible.
5. ☐ Click the first software title → first vulnerable version → first **Vulnerability** link.
   - ✅ *(UI)* Tables rendered at each hop; CVE link matches the pattern; throws if no vulnerable version.
6. ☐ CVE detail — ✅ *(UI)* URL, heading, **Detected**, **Affected hosts**, NVD href, software-table row.

**Assessment**
- *Value:* free-tier host-software vulnerable-filter parity.
- *Coverage gaps:* same as SWV-07 — filter narrowing never verified; no tier-difference assertion.
- *Redundancy:* duplicate of SWV-07 (which additionally skips deb).
- *Efficiency / smells:* same silent-skip risk from `findHostByPlatform` swallowing API errors; target title is instance-order dependent.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWV-15 · Free • Software • Vulnerability automations › enabling with a webhook URL persists

- **File:** [`playwright/tests/e2e/free/software/vulnerability-automations.spec.ts`](../../tests/e2e/free/software/vulnerability-automations.spec.ts) (L32)
- **Grep:** `npx playwright test --project=free -g "enabling with a webhook URL persists"`
- **Project:** free · **Scope:** single (aggregate always in effect)
- **Mode:** UI+API · **Isolation:** mutates **global** app config; snapshot in `beforeEach`, restore in `afterEach`
- **Preconditions:** admin session
- **Data created:** app-config change only — reverted

**Flow**

1. ☐ Open **Software → Inventory** (via URL) — no dropdown on free.
2. ☐ Click **Automations** — ✅ *(UI)* **Manage automations** modal visible.
3. ☐ Toggle vulnerability automations on — ✅ *(UI)* `aria-checked=true`.
4. ☐ Select the **Webhook** workflow — ✅ *(UI)* destination-URL input visible.
5. ☐ Fill `https://example.com/pw-vuln-webhook`, click **Save**.
   - ✅ *(UI)* Modal closes; success toast "Successfully updated vulnerability automations."
   - ✅ *(API)* `GET /config` shows `enable_vulnerabilities_webhook === true` and the exact URL.
6. ☐ Reopen **Automations** — ✅ *(UI)* toggle on, URL field holds the value.

**Assessment**
- *Value:* proves the webhook feature is not paywalled on free and persists.
- *Coverage gaps:* no assertion that the *premium-only* parts of the modal (ticket integrations) are absent on free — the tier check this spec exists for; no disable round-trip; no URL validation.
- *Redundancy:* verbatim duplicate of SWV-08 except the dropdown step (the file header says so).
- *Efficiency / smells:* API assertion justified (server truth). Shares its grep string with SWV-08.

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
| Inventory `vulnerable=true` filter | SWV-01/02, SWV-11 | item-count, sorting by Vulnerabilities, page-1 restore; premium every-row integrity blocked (#50059) |
| Vulnerabilities column rendering (single CVE, "N vulnerabilities" tooltip) | SWV-02, SWV-11 | both legs `if`-guarded; tooltip contents not matched to the row's real CVEs |
| Title → version → CVE drill-down | SWV-03, SWV-12 | premium deb blocked (#49913); no back-navigation; no check the CVE page lists the originating title |
| CVE detail page | `assertOk` in SWV-03/06/07/12/13/14 | **premium enrichment never asserted** — severity/CVSS, probability of exploit, published date, `CveDetailPage.description` (defined, unused); no `Affected hosts` click-through |
| Vulnerabilities tab search | SWV-04 (premium only) | no free equivalent; no partial-match or empty-state case |
| Exploited-vulnerabilities filter | SWV-05 | rows never verified to be exploited; no reset to **All vulnerabilities** |
| Severity / CVSS filters (premium) | — | **untested**; `FilterModal` exposes only the vulnerable switch |
| Vulnerabilities list pagination + tab reset | SWV-06, SWV-13 | conditional; no column/sort assertions |
| Host-details Software tab vulnerable filter + Applications↔Full inventory | SWV-07, SWV-14 | narrowing not asserted; host software search untested; no real MDM host variant |
| Vulnerability-automations webhook | SWV-08, SWV-15 | ticket workflow, disable round-trip, invalid URL, **Automations** disabled outside All fleets, tier-difference assertions, delivery |
| OS tab platform filter | SWV-09 | Linux/ChromeOS/iOS/iPadOS/Android, **All platforms** reset, host-count + vulnerability columns, pagination; **free has no OS spec** |
| OS → Hosts hand-off | SWV-10 | URL params, count agreement, pill clearing |
| OS detail page `/software/os/:id` | — | **untested**; `SoftwareOsDetailPage` + `SoftwareOsPage.clickFirstOs` are dead code |
| Software **Versions** tab / **Show versions** toggle | — | **untested in e2e**; `SoftwareVersionsPage` is used only by `tests/loadtest/software.spec.ts`; `showVersionsSwitch` never used |

**Duplication**

1. **Free ≡ premium vulnerability specs.** SWV-11≡SWV-02(+SWV-01), SWV-12≡SWV-03, SWV-13≡SWV-06, SWV-14≡SWV-07, SWV-15≡SWV-08. The only real deltas: the team-dropdown step, premium's two skips, and free running the every-row check. ~55 % of this area's runtime is the same flow twice.
2. **`CveDetailPage.assertOk` runs in 5 of 15 entries** (10 of 24 runtime tests once loops expand) — the same six assertions about the same handful of CVEs.
3. **Title → version → CVE tail** is identical in SWV-03/07/12/14; only the entry point (search vs host) differs.
4. **Optional-pagination probe** (`nextIfEnabled` ×2 + `previousIfEnabled`) appears in SWV-02, SWV-06, SWV-11, SWV-13.

**UI-vs-API balance**

Only SWV-08/SWV-15 assert via API, and it is justified — `GET /config` is the authoritative, race-free check that a modal save persisted, and the UI re-read is still performed. Everything else validates through the browser. The API is used heavily for **discovery** instead: `findVulnerableSoftwareBySources` (up to 5 paged `vulnerable=true` sweeps) and `findHostByPlatform` (up to 50 per-host vulnerable-software probes per platform) run in `beforeAll` for both vulnerability specs — correct in principle (UI scraping would be slower and flakier) but currently the area's biggest reliability liability: the sweep re-runs once per worker under `fullyParallel`, throws the whole chunk on a 500, and the host lookup converts API failures into silent skips. Both use raw `fetch` rather than the sanctioned `withRequest` hook wrapper.

**Quick wins**

1. Make the guarded assertions unconditional or fail loudly: in SWV-02/SWV-11 assert `rows.count() > 0` before the loop and `expect(multiRow).not.toBeNull()` / `expect(singleRow).not.toBeNull()` (`premium/.../vulnerabilities.spec.ts:105-113`, `free/.../vulnerabilities.spec.ts:61-75`) — today a slow or empty table passes with ~1 assertion.
2. Have `findHostByPlatform` throw on non-OK responses like its software sibling does (`helpers/api/hosts.ts:49,62`), so SWV-07/SWV-14 fail instead of silently skipping when the instance misbehaves.
3. Add the premium CVE-detail assertions the POM already models — severity / probability of exploit / published date / `description` — to one premium variant of SWV-03, and assert `description` is **absent** in SWV-12 (the only tier difference on that page).
4. Cache the `beforeAll` discovery per worker (or move it to a worker-scoped fixture) so the `vulnerable=true` sweep runs once per project rather than once per worker per file — directly reduces the "table is full" 500 exposure.
5. Delete or rewrite the stale isolation exception at [`tests/README.md:154`](../../tests/README.md) — `softwareByOS` is not accumulated across tests, and the line makes people believe these tests can't be run individually.

**Bigger bets**

1. **Collapse the free/premium vulnerability duplication** into one spec parameterized on scope (`fleetIdFor`), keeping tier-specific extras (premium enrichment fields, free absence checks, the two premium skips) as explicit variants. Removes ~8 duplicate runtime tests without losing signal.
2. **Give the CVE detail page one owner test.** Assert the full page contract once (heading, enrichment block, NVD link, affected-hosts click-through, software table matching the drill-down origin); reduce the four drill-down tests to routing checks. Cuts repeated 10 s enrichment waits and the repeated external NVD hit.
3. **Cover the untouched surfaces of the Software section:** the Versions tab / **Show versions** toggle, `/software/os/:id`, and the premium severity+exploit filters — three POMs (`SoftwareVersionsPage`, `SoftwareOsDetailPage`, `FilterModal`'s premium controls) exist with no e2e test behind them, and the OS tab has no free-tier coverage at all.
