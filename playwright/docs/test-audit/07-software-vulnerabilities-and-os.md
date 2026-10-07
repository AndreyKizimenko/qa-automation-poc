# Software vulnerabilities, versions & OS — test audit

**Specs covered:** 6 files · **Test declarations:** 24 entries (33 runtime tests — three specs generate variants in a `for` loop) · **Projects:** premium / free

This area covers Fleet's Software section outside the install/library flows: the
**Inventory** tab's `vulnerable=true` filter, its Vulnerabilities column and the
premium-only **severity** filter, the title → version → **CVE detail**
drill-down, the CVE page's hand-off to the hosts running each affected version,
the host-details Software tab's vulnerable filter, the **Vulnerabilities** tab
(search, exploited filter, pagination, CVE detail), the **OS** tab (platform
filter, "View all hosts", OS detail drill-in, Hosts sort), and the global
**vulnerability-automations webhook**. Premium and free carry near-identical
vulnerability specs (the free copies drop the team dropdown); the OS tab now has
a free spec too, covering the two OS cases that are not scope-dependent. Every
drill-down test discovers its target data through the Fleet API in `beforeAll`
and skips when the instance has none.

## Contents

| ID | Spec | Test | Mode | Manual? |
|---|---|---|---|---|
| SWV-01 | `premium/software/vulnerabilities.spec.ts` | Software Titles — every vulnerable-filtered row reports vulnerability data **(skipped — #50059)** | UI | ☐ |
| SWV-02 | `premium/software/vulnerabilities.spec.ts` | Software Titles — vulnerable filter, pagination, and column checks | UI | ☐ |
| SWV-03 | `premium/software/vulnerabilities.spec.ts` | `{macOS, Linux (deb), Windows}` — software titles → version → CVE detail flow † | UI | ☐ |
| SWV-04 | `premium/software/vulnerabilities.spec.ts` | Vulnerabilities tab — search narrows to a single CVE | UI | ☐ |
| SWV-05 | `premium/software/vulnerabilities.spec.ts` | Vulnerabilities tab — exploited-vulnerabilities filter | UI+API | ☐ |
| SWV-06 | `premium/software/vulnerabilities.spec.ts` | Vulnerabilities tab — list, pagination, and CVE detail flow | UI | ☐ |
| SWV-07 | `premium/software/vulnerabilities.spec.ts` | `{macOS, Linux (deb), Windows}` host — vulnerable software → version → CVE flow † | UI | ☐ |
| SWV-08 | `premium/software/vulnerability-automations.spec.ts` | Premium • Software • Vulnerability automations › enabling with a webhook URL persists, and turning it off keeps the URL | UI+API | ☐ |
| SWV-09 | `premium/software/os.spec.ts` | OS tab — platform filter narrows the list to `{macOS, Windows}` | UI | ☐ |
| SWV-10 | `premium/software/os.spec.ts` | OS tab — "View all hosts" lands on the Hosts list filtered by that OS | UI | ☐ |
| SWV-11 | `free/software/vulnerabilities.spec.ts` | Software vulnerabilities › Software Titles — vulnerable filter, pagination, and column checks | UI | ☐ |
| SWV-12 | `free/software/vulnerabilities.spec.ts` | `{macOS, Linux (deb), Windows}` — software titles → version → CVE detail flow † | UI | ☐ |
| SWV-13 | `free/software/vulnerabilities.spec.ts` | Vulnerabilities tab — list, pagination, and CVE detail flow | UI | ☐ |
| SWV-14 | `free/software/vulnerabilities.spec.ts` | `{macOS, Linux (deb), Windows}` host — vulnerable software → version → CVE flow † | UI | ☐ |
| SWV-15 | `free/software/vulnerability-automations.spec.ts` | Free • Software • Vulnerability automations › enabling with a webhook URL persists, and turning it off keeps the URL | UI+API | ☐ |
| SWV-16 | `premium/software/os.spec.ts` | OS tab — a row drills into that OS with matching version and counts | UI | ☐ |
| SWV-17 | `premium/software/os.spec.ts` | OS tab — sorting by Hosts reorders the list | UI | ☐ |
| SWV-18 | `premium/software/vulnerabilities.spec.ts` | Vulnerabilities — a CVE hands off to the hosts running each affected version † | UI | ☐ |
| SWV-19 | `premium/software/vulnerabilities.spec.ts` | Software Titles — the severity filter lists the CVSS bands from Critical down | UI | ☐ |
| SWV-20 | `free/software/vulnerabilities.spec.ts` | Vulnerabilities — a CVE hands off to the hosts running each affected version † | UI | ☐ |
| SWV-21 | `free/software/os.spec.ts` | OS tab — a row drills into that OS with matching version and counts | UI | ☐ |
| SWV-22 | `free/software/os.spec.ts` | OS tab — sorting by Hosts reorders the list | UI | ☐ |
| SWV-23 | `premium/software/vulnerabilities.spec.ts` | Vulnerabilities — a CVE's host count and hosts are its fleet's | UI+API | ☐ |
| SWV-24 | `free/software/vulnerabilities.spec.ts` | Software vulnerabilities › Vulnerabilities — a CVE's View all hosts lists hosts it affects | UI+API | ☐ |

† these seven entries resolve which CVE to open through `findRenderableCve`
rather than clicking the top row — the standing workaround for
[fleetdm/fleet#49913](https://github.com/fleetdm/fleet/issues/49913). See
[the workaround note](#the-findrenderablecve-workaround-fleetdmfleet49913) below.
The `Linux (deb)` variants are **no longer skipped on premium** — that pair of
skips was replaced by the workaround (2026-09-22).

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

### The `findRenderableCve` workaround (fleetdm/fleet#49913)

**Seven entries never click the CVE the UI puts in front of them.** SWV-03, SWV-07,
SWV-12, SWV-14, SWV-18 and SWV-20 all call
[`findRenderableCve`](../../helpers/api/software.ts) — which walks the rendered CVE
identifiers in page order, issues `GET /vulnerabilities/<cve>` for each, and returns
the first that answers — and then click **that** one.

The reason is a live product bug. Fleet matches a CVE onto a software version
(`software_cve`) and links it from the version-detail page, but the CVE **detail**
endpoint inner-joins `cve_meta` and 404s for any CVE the vulnerability feeds have
not enriched yet, rendering *"Vulnerability not detected"*. The version-detail table
sorts **newest match first**, which is exactly the row most likely to be
un-enriched — so clicking the top row dead-ends on an empty state for a window of
hours after each match. Recorded in
[`docs/blocked-by-product-bugs.md`](../blocked-by-product-bugs.md) under
**Worked around in the suite**, with the full mechanism in its notes.

What this means when auditing these entries:

- **The clicked CVE is non-deterministic run to run**, and so is the content of the
  CVE page the entry asserts on. Reproducing a failure by hand means probing
  `GET /vulnerabilities/<cve>` for the CVEs listed, not picking the first one.
- **Each entry carries a second skip**, distinct from the data-availability one:
  `test.skip(!cveText, 'Every CVE on this version 404s its detail page —
  fleetdm/fleet#49913')`. It fires only in the genuine dead end, but it means a
  fully-unenriched instance turns these into silent no-ops.
- **The probe costs one API request per un-renderable CVE.** On a version carrying
  dozens of fresh matches that is dozens of sequential round-trips before the first
  click.
- **Unblock condition:** the detail endpoint renders matched-but-unenriched CVEs.
  Then drop `findRenderableCve` and click the first row.

**The probe asks the page's scope (2026-09-29).** The CVE page requests
`GET /vulnerabilities/<cve>?fleet_id=<scope>`, and Fleet answers **204** when the CVE is
known but no host in that fleet is affected — the same *"Vulnerability not detected"*
screen. A fleet-scoped title page can list a version whose hosts were only passing
through: batch E's label-targeting specs borrow simulations onto VMs, and Fleet's
per-fleet software list keeps their version until its hourly refresh while the
per-fleet vulnerability counts already don't. That failed the premium Linux host flow
in PR #72's branch run on CVE-2026-61898 (enriched, 200 unscoped, 204 on VMs). So the
probe passes the page's `fleet_id` (`fleetIdFromUrl(page.url())`) and accepts only a
200, and the host flows (SWV-07, SWV-14) click the version **this host** has
(`hostVulnerableVersions`) rather than the title's first vulnerable version.

Separately, SWV-01 remains a hard `test.skip` for
[fleetdm/fleet#50059](https://github.com/fleetdm/fleet/issues/50059) (`vulnerable=true`
is not fleet-scoped). That one is a real skip, not a workaround — see its entry.

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

- **File:** [`playwright/tests/e2e/premium/software/vulnerabilities.spec.ts`](../../tests/e2e/premium/software/vulnerabilities.spec.ts) (L145-185, `for (const osKey of OS_KEYS)`)
- **Grep:** `npx playwright test --project=premium -g "macOS — software titles → version → CVE detail flow"` (swap `Windows`; `Linux \(deb\)` needs the escapes)
- **Project:** premium · **Scope:** Unassigned · **Variants:** macOS (`apps`), Linux deb (`deb_packages`), Windows (`programs`/`chocolatey_packages`) — **all three run**; the deb skip was retired 2026-09-22 in favour of the `findRenderableCve` workaround
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
5. ☐ On the version page, read **every** CVE link, then click one whose detail page actually answers.
   - ✅ *(UI)* CVE table has a row and each link text matches `^CVE-\d{4}-\d+$` — `SoftwareVersionDetailPage.cveNames`.
   - ☐ *(no user action)* `findRenderableCve` probes `GET /vulnerabilities/<cve>?fleet_id=<the page's scope>` in page order and returns the first that answers 200 — the [#49913 workaround](#the-findrenderablecve-workaround-fleetdmfleet49913). **`test.skip` if every listed CVE 404s.**
   - ☐ Click that CVE — `SoftwareVersionDetailPage.clickCve(cveText)`.
6. ☐ Land on the CVE detail page.
   - ✅ *(UI)* URL matches `/software/vulnerabilities/CVE-`.
   - ✅ *(UI)* `<h1>` equals the clicked CVE id (10 s budget) — `CveDetailPage.waitForReady`.
   - ✅ *(UI)* **Detected** and **Affected hosts** labels visible.
   - ✅ *(UI)* **Visit NVD page** link visible with `href === https://nvd.nist.gov/vuln/detail/<CVE>`.
   - ✅ *(UI)* **macOS variant only:** clicking the link opens a new tab whose URL matches `nvd.nist.gov/vuln/detail/<CVE>`, then closes it — real external request to nvd.nist.gov.
   - ✅ *(UI)* The vulnerable-software table on the CVE page has a row.

**Assessment**
- *Value:* the core vulnerability drill-down for all three platforms — proves title → version → CVE routing, that the version's CVE list is populated, and that the CVE page hydrates and links out correctly. Also the only test that exercises the real NVD link.
- *Coverage gaps:* premium's paid CVE fields are never asserted — severity/CVSS, probability of exploit, published date and the premium-only description (`CveDetailPage.description` is defined and never used); SWV-16 now asserts the same three premium-only *columns* on the OS detail page, so the CVE summary is the last unasserted premium enrichment surface. No breadcrumb/back navigation; no check that the CVE page's software table actually contains the title we drilled from.
- *Redundancy:* SWV-12 is the same flow on free. Steps 4–6 are duplicated by SWV-07/SWV-14, which reach the same pages from the host side.
- *Efficiency / smells:* clicking out to nvd.nist.gov makes the test depend on an external site. `searchByName`'s weak wait (`SoftwareTitlesPage.ts:96-99`) can race the next click. Discovery in `beforeAll` uses raw `fetch` instead of the sanctioned `withRequest` hook helper (`helpers/api/core.ts:71`). The `findRenderableCve` probe adds one sequential API request per un-renderable CVE before the click, and its skip can turn the whole variant into a no-op — see the [workaround note](#the-findrenderablecve-workaround-fleetdmfleet49913).

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

- **File:** [`playwright/tests/e2e/premium/software/vulnerabilities.spec.ts`](../../tests/e2e/premium/software/vulnerabilities.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "Vulnerabilities tab — exploited-vulnerabilities filter"`
- **Project:** premium · **Scope:** Unassigned
- **Mode:** UI+API · **Isolation:** independent, read-only
- **Source:** also QA Wolf `software-vulnerabilities-filter-by-exploited-vulnerabilities` (round 1 C6 #1; round 3, batch C)
- **Preconditions:** CISA-exploited CVEs on Unassigned: the load fleet's templated inventory carries ~100 (96 on 2026-10-03), so an empty list fails.
- **Data created:** none

**Flow**

1. ☐ Open **Software → Inventory** (via URL), select **Unassigned**, click the **Vulnerabilities** tab.
   - ✅ *(UI)* URL `/software/vulnerabilities`, table has a row.
2. ☐ In the exploited-vulnerabilities dropdown choose **Exploited vulnerabilities**.
   - ✅ *(UI)* The dropdown's value becomes "Exploited vulnerabilities"; URL contains `exploit=true`; a CVE row is listed.
3. ☐ *(API)* `GET /vulnerabilities?fleet_id=0&exploit=true`. Read each row on the page: its CVE, and whether its **Probability of exploit** cell carries the exploited icon.
   - ✅ *(UI+API)* every listed CVE is in the API's exploited list and is `cisa_known_exploit`.
   - ✅ *(UI+API)* a row has the icon exactly when the API gives it an EPSS score (`ProbabilityOfExploit` draws it only beside a score).
4. ☐ Hover a row's icon.
   - ✅ *(UI)* the tooltip names the Cybersecurity and Infrastructure Security Agency (CISA).

**Assessment**
- *Value:* the filter's provenance (what it lists is what CISA marks exploited) and the mark each row carries, on all 50 rows of page 1. Per-row expectations come from the API rather than "an icon on every row", because Fleet's own feeds can leave a known exploit unscored, and then it shows no icon.
- *Coverage gaps:* only page 1; switching back to **All vulnerabilities** isn't asserted; the free tier's absent filter is not checked here.
- *Redundancy:* none (premium-only feature).
- *Efficiency / smells:* a few seconds; the exploit column's index is read from the header once, then each row's cell. The icon has no accessible name, so it is matched as the cell's image.

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

- **File:** [`playwright/tests/e2e/premium/software/vulnerabilities.spec.ts`](../../tests/e2e/premium/software/vulnerabilities.spec.ts) (L246-298, `for (const osKey of OS_KEYS)`)
- **Grep:** `npx playwright test --project=premium -g "macOS host — vulnerable software → version → CVE flow"` (swap `Windows`; `Linux \(deb\)` needs the escapes)
- **Project:** premium · **Variants:** macOS, Linux deb, Windows — **all three run** ([#49913](https://github.com/fleetdm/fleet/issues/49913) is now worked around, not skipped) · **Scope:** n/a (host detail)
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
6. ☐ On the title page, click the version **this host** has installed (the vulnerable one); on the version page read every CVE link and click one whose detail page answers.
   - ✅ *(API)* `hostVulnerableVersions` reads the host's vulnerable versions of the title it clicked (`GET /hosts/:id/software?vulnerable=true`); the test fails if the host reports none. The title page lists every version in the fleet's scope, which can include hosts only passing through the fleet.
   - ✅ *(UI)* That version's link is on the title page; versions and CVE tables rendered; every CVE link matches the CVE pattern — `cveNames()`.
   - ☐ *(no user action)* `findRenderableCve` probes `GET /vulnerabilities/<cve>?fleet_id=<the page's scope>` in page order, 200 only — the [#49913 workaround](#the-findrenderablecve-workaround-fleetdmfleet49913). **`test.skip` if every listed CVE 404s.**
7. ☐ Land on the CVE detail page.
   - ✅ *(UI)* URL `/software/vulnerabilities/CVE-`; `<h1>` = CVE; **Detected** + **Affected hosts**; **Visit NVD page** href exact; vulnerable-software table has a row (no NVD click).

**Assessment**
- *Value:* the only coverage of the host-details Software tab's vulnerable filter and of the Applications-vs-Full-inventory view switch — plus a second, host-side route into the CVE pages.
- *Coverage gaps:* the vulnerable filter isn't verified to have actually narrowed the list (no count/row-content check); the host's software search box, per-row CVE counts, and "1 filter" button label are untested; no MDM/live-host variant.
- *Redundancy:* steps 6–7 duplicate SWV-03 steps 4–6 exactly; SWV-14 is the same test on free.
- *Efficiency / smells:* the title reached depends on whichever vulnerable package sorts first for that host, so the CVE landed on varies run to run — and `findRenderableCve` adds a second axis of non-determinism on top (which CVE on that version happens to be enriched today). Host discovery swallows API errors → silent skip, and the #49913 probe adds a second silent-skip path.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWV-08 · Premium • Software • Vulnerability automations › enabling with a webhook URL persists, and turning it off keeps the URL

- **File:** [`playwright/tests/e2e/premium/software/vulnerability-automations.spec.ts`](../../tests/e2e/premium/software/vulnerability-automations.spec.ts) (L34)
- **Grep:** `npx playwright test --project=premium -g "enabling with a webhook URL persists, and turning it off keeps the URL"` (matches the free copy too — `--project` is mandatory)
- **Project:** premium · **Scope:** All fleets (the **Automations** button is only enabled there, for global admins)
- **Mode:** UI+API · **Isolation:** mutates **global** app config; `beforeEach` snapshots `webhook_settings.vulnerabilities_webhook` via `GET /config` and `afterEach` restores it via `PATCH /config` (runs even on failure). Fleet merge-patches within `webhook_settings`, so sibling webhook specs running in parallel are unaffected.
- **Preconditions:** global-admin session (default premium auth state)
- **Data created:** app-config change only — reverted in `afterEach`
- **Source:** QA Wolf round 1 C6 #17 (`software-disable-software-vulnerability-automation`) supplies the off half

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
7. ☐ In the same modal, turn the vulnerability automations toggle **off** and click **Save**.
   - ✅ *(UI)* Toggle `aria-checked=false` before the save; the modal closes afterwards.
   - ✅ *(API)* `GET /config` is polled until `enable_vulnerabilities_webhook === false` — step 5's identical success toast can still be on screen, so no toast can say this save landed.
   - ✅ *(API)* `destination_url` still equals `https://example.com/pw-vuln-webhook` — Fleet keeps the URL for the next time the automation is turned on.
8. ☐ Click **Automations** again.
   - ✅ *(UI)* Toggle `aria-checked=false`.

**Assessment**
- *Value:* the full round trip in both directions — on, stored, re-read; off, stored, re-read — with a guaranteed restore. Catches a modal that appears to save but doesn't persist, in either direction, and an off switch that also wipes the destination URL.
- *Coverage gaps:* no ticket workflow (Jira/Zendesk) path; no invalid-URL validation or error toast; the off save has no success-toast assertion at all, and after it the reopened modal is checked only for the switch, so the kept URL is proven through the API alone; no check that the free and premium modals differ; no actual webhook delivery. (**Automations** being disabled on a specific fleet is [SWL-12](06-software-library.md) in area 06.)
- *Redundancy:* SWV-15 is a near-verbatim copy on free (only the team-dropdown step differs).
- *Efficiency / smells:* the API assertions are justified — server truth is authoritative, and for the off save it is the only signal that the save completed. The grep string is shared with the free copy, so `--project` is mandatory when running one.

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
- *Coverage gaps:* Linux/ChromeOS/iOS/iPadOS/Android options untested; **All platforms** reset untested; no OS-tab pagination. The row's Hosts and Vulnerabilities counts and the `/software/os/:id` drill-in are now covered by **SWV-16** (and **SWV-21** on free) — `SoftwareOsPage.clickFirstOs` remains dead code, superseded by `openOs(row)`.
- *Redundancy:* none — free's OS spec ([`free/software/os.spec.ts`](../../tests/e2e/free/software/os.spec.ts)) deliberately omits the platform filter, so this stays premium-only.
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
- *Coverage gaps:* doesn't assert the URL params (`os_version_id`/`os_name`), that the host count matches the OS row's count, that the listed hosts are of that OS, or that clearing the pill restores the unfiltered list. Only the first row (whatever OS that is) is exercised. **SWV-18/SWV-20 do all of this properly** for the CVE → hosts hand-off (pill contains name *and* version, `software_version_id` asserted on the URL, landed list polled non-empty) — this entry is the weaker sibling of the same pattern.
- *Redundancy:* the hover-action → filter-pill shape is shared with SWV-18/SWV-20 (⚠️ possible overlap with hosts-area filter-pill tests — cross-check area 03).
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

- **File:** [`playwright/tests/e2e/free/software/vulnerabilities.spec.ts`](../../tests/e2e/free/software/vulnerabilities.spec.ts) (L103-142, `for (const osKey of OS_KEYS)`)
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
3. ☐ Click the first version whose **Vulnerabilities** cell isn't `---`; read every CVE link and click one whose detail page answers.
   - ✅ *(UI)* Versions table rendered; every CVE link matches the CVE pattern; throws if no vulnerable version.
   - ☐ *(no user action)* `findRenderableCve` probes `GET /vulnerabilities/<cve>?fleet_id=<the page's scope>` in page order, 200 only — the [#49913 workaround](#the-findrenderablecve-workaround-fleetdmfleet49913). **`test.skip` if every listed CVE 404s.**
4. ☐ CVE detail page.
   - ✅ *(UI)* URL `/software/vulnerabilities/CVE-`; `<h1>` = CVE; **Detected** + **Affected hosts** labels; **Visit NVD page** href exact; **macOS variant** clicks it and asserts the new tab's URL; CVE-page software table has a row.

**Assessment**
- *Value:* free-tier drill-down parity across all three platforms.
- *Coverage gaps:* the free CVE page's *reduced* content is never asserted as reduced — nothing verifies the premium-only description/severity block is absent on free, which is the tier difference a manual tester would check here. **SWV-21 now does exactly that for the OS detail page** (`PREMIUM_ONLY_COLUMNS` asserted at count 0), so the pattern exists in the area and this entry simply hasn't adopted it.
- *Redundancy:* duplicate of SWV-03 modulo the dropdown.
- *Efficiency / smells:* the free/premium asymmetry this entry used to carry (deb skipped on premium, not on free) is **gone** — both tiers now run all three variants behind `findRenderableCve`, which is the correct instrument: the #49913 trigger is the *newest* CVE, not any platform, and the free Windows case is what proved it. External NVD click on the macOS variant duplicates SWV-03's.

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

- **File:** [`playwright/tests/e2e/free/software/vulnerabilities.spec.ts`](../../tests/e2e/free/software/vulnerabilities.spec.ts) (L169-221, `for (const osKey of OS_KEYS)`)
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
5. ☐ Click the first software title → the version this host has installed (`hostVulnerableVersions`) → a CVE whose detail page answers.
   - ✅ *(API)* the host reports a vulnerable version of that title (else the test fails).
   - ✅ *(UI)* Tables rendered at each hop; the host's version is linked on the title page; every CVE link matches the pattern.
   - ☐ *(no user action)* `findRenderableCve` probe — the [#49913 workaround](#the-findrenderablecve-workaround-fleetdmfleet49913). **`test.skip` if every listed CVE 404s.**
6. ☐ CVE detail — ✅ *(UI)* URL, heading, **Detected**, **Affected hosts**, NVD href, software-table row.

**Assessment**
- *Value:* free-tier host-software vulnerable-filter parity.
- *Coverage gaps:* same as SWV-07 — filter narrowing never verified; no tier-difference assertion.
- *Redundancy:* duplicate of SWV-07, now variant-for-variant (both tiers run all three platforms).
- *Efficiency / smells:* two silent-skip paths — `findHostByPlatform` swallowing API errors, and the #49913 probe finding nothing renderable; target title is instance-order dependent.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWV-15 · Free • Software • Vulnerability automations › enabling with a webhook URL persists, and turning it off keeps the URL

- **File:** [`playwright/tests/e2e/free/software/vulnerability-automations.spec.ts`](../../tests/e2e/free/software/vulnerability-automations.spec.ts) (L32)
- **Grep:** `npx playwright test --project=free -g "enabling with a webhook URL persists, and turning it off keeps the URL"`
- **Project:** free · **Scope:** single (aggregate always in effect)
- **Mode:** UI+API · **Isolation:** mutates **global** app config; snapshot in `beforeEach`, restore in `afterEach`
- **Preconditions:** admin session
- **Data created:** app-config change only — reverted
- **Source:** QA Wolf round 1 C6 #16 supplies the off half

**Flow**

1. ☐ Open **Software → Inventory** (via URL) — no dropdown on free.
2. ☐ Click **Automations** — ✅ *(UI)* **Manage automations** modal visible.
3. ☐ Toggle vulnerability automations on — ✅ *(UI)* `aria-checked=true`.
4. ☐ Select the **Webhook** workflow — ✅ *(UI)* destination-URL input visible.
5. ☐ Fill `https://example.com/pw-vuln-webhook`, click **Save**.
   - ✅ *(UI)* Modal closes; success toast "Successfully updated vulnerability automations."
   - ✅ *(API)* `GET /config` shows `enable_vulnerabilities_webhook === true` and the exact URL.
6. ☐ Reopen **Automations** — ✅ *(UI)* toggle on, URL field holds the value.
7. ☐ In the same modal, toggle vulnerability automations **off** and click **Save**.
   - ✅ *(UI)* `aria-checked=false` before the save; the modal closes.
   - ✅ *(API)* `GET /config` polled until `enable_vulnerabilities_webhook === false` (step 5's toast can still be showing); `destination_url` is still the URL.
8. ☐ Reopen **Automations** — ✅ *(UI)* toggle off.

**Assessment**
- *Value:* proves the webhook feature is not paywalled on free, and that it persists both on and off, keeping the URL when off.
- *Coverage gaps:* no assertion that the *premium-only* parts of the modal (ticket integrations) are absent on free — the tier check this spec exists for; no URL validation; the off half's kept URL is checked through the API only.
- *Redundancy:* verbatim duplicate of SWV-08 except the dropdown step (the file header says so).
- *Efficiency / smells:* API assertions justified (server truth, and the only completion signal for the off save). Shares its grep string with SWV-08.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWV-16 · OS tab — a row drills into that OS with matching version and counts

- **File:** [`playwright/tests/e2e/premium/software/os.spec.ts`](../../tests/e2e/premium/software/os.spec.ts) (L86)
- **Grep:** `npx playwright test --project=premium -g "OS tab — a row drills into that OS with matching version and counts"` (matches the free copy too — `--project` is mandatory)
- **Project:** premium · **Scope:** Unassigned
- **Mode:** UI · **Isolation:** independent, read-only
- **Preconditions:** a **macOS or Windows** OS row under Unassigned whose **Vulnerabilities** cell carries a count. Fleet writes `---` where it has matched none, and those drill into an empty table; Linux rows are excluded because a Linux OS's detail page shows a **Kernels** card instead of a Vulnerabilities card (`SoftwareOSDetailsPage.tsx`, `isLinuxLike`). With no such row the test **skips** (data-availability guard).
- **Data created:** none
- **Cross-link:** free mirror = **SWV-21**

**Flow**

1. ☐ Open **Software → Inventory** (via URL), select **Unassigned**, click the **OS** tab.
   - ✅ *(UI)* URL matches `/software/os`; the table has a row — `gotoOsTab()`.
2. ☐ Filter the list to **macOS** (then **Windows**, if no macOS row qualifies) and take the first row whose **Vulnerabilities** cell reads "N vulnerabilities" — `SoftwareOsPage.firstNonLinuxRowWithVulnerabilities()`.
   - ✅ *(UI)* After each filter change, every row names the platform before a row is read (the list keeps the previous rows while the filtered fetch is in flight).
   - Skip if neither platform has such a row.
3. ☐ Read that row's **Name**, **Version**, **Vulnerabilities** and **Hosts** cells — `SoftwareOsPage.rowValues()`; counts are parsed with thousands separators stripped.
4. ☐ Click the row's Name-column link.
   - ✅ *(UI)* URL matches `/software/os/:id` — `openOs(row)`.
5. ☐ Land on the OS detail page.
   - ✅ *(UI)* The `<h1>` contains the row's Name **with a leading `Microsoft ` stripped** (Fleet labels Windows rows `Microsoft Windows …` in the list and drops the vendor prefix in the heading).
   - ✅ *(UI)* The same `<h1>` contains the row's Version — name and version are one heading string, not two fields.
   - ✅ *(UI)* A level-2 **Vulnerabilities** heading is visible.
   - ✅ *(UI)* The vulnerabilities table has rendered a linked row — `SoftwareOsDetailPage.waitForReady()`.
6. ☐ (No user action) cross-page count agreement.
   - ✅ *(UI)* Summary **Hosts** value is non-zero and no larger than the list row's Hosts count — `hostCount()` (parses the number out of a cell that also carries "Updated N mins ago"). Not equality: sibling specs delete hosts between the two reads.
   - ✅ *(UI)* The `N items` results count above the vulnerabilities table equals the list row's Vulnerabilities count — `vulnerabilityCount()`.
7. ☐ (No user action) premium column contract.
   - ✅ *(UI)* All five headers visible, exact match: **Vulnerability**, **Severity**, **Probability of exploit**, **Published**, **Detected**.

**Assessment**
- *Value:* the strongest assertion in the OS half of this area, and the one thing SWV-09/SWV-10 never did — the list and the detail page are fed by **different endpoints**, so this pins that they agree on identity *and* on both rollup counts. The premium column list is also the only place the three paid vulnerability columns are asserted anywhere in the suite (`CveDetailPage`'s premium fields are still unasserted — see SWV-03).
- *Coverage gaps:* the vulnerabilities table's *contents* are never read (no CVE pattern check, no severity value, no row count against the `N items` figure it was compared to); the summary's other fields (last-updated note, the hosts click-through) are untouched; only one OS — the first macOS (else Windows) row with vulnerabilities — is exercised, so a platform-specific detail-page break elsewhere is invisible, and a Linux OS's Kernels card is never asserted (on free, three `os_version_id`s each cover two Ubuntu versions and their detail pages sum both versions' hosts, so a Linux variant would trip on that); no back-navigation.
- *Redundancy:* the `Microsoft `-prefix normalization duplicates SWV-10's, and the drill-in supersedes the "never exercised" note SWV-09 used to carry. SWV-21 is the free mirror, structurally identical minus the scope step and with the premium columns inverted.
- *Efficiency / smells:*
  - **The count comparison is a live race.** `hosts` and `vulnerabilities` are read from the list, then re-read from a different endpoint seconds later, against a shared instance where sibling specs delete and transfer hosts. SWV-18 explicitly declined an exact host-count comparison for precisely this reason (`expect.poll(...).toBeGreaterThan(0)` instead) — two entries in the same area take opposite positions on the same hazard. ⚠️ worth a verdict: either this is the stricter, correct assertion and SWV-18 is too loose, or this is a latent flake.
  - The heading assertions use `toContainText` on a normalized substring, so a heading of `macOS 15.1.1` satisfies a row reading `macOS` / `15.1` — a version *prefix* passes as a match.
  - `expect(row).not.toBeNull()` runs before `rowValues(row!)`, so the non-null assertion is doing real work, but `findRowByColumnPattern` re-resolves the header row per candidate row (O(rows × columns)), same as SWV-02.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWV-17 · OS tab — sorting by Hosts reorders the list

- **File:** [`playwright/tests/e2e/premium/software/os.spec.ts`](../../tests/e2e/premium/software/os.spec.ts) (L126)
- **Grep:** `npx playwright test --project=premium -g "OS tab — sorting by Hosts reorders the list"` (matches the free copy too — `--project` is mandatory)
- **Project:** premium · **Scope:** Unassigned
- **Mode:** UI · **Isolation:** independent, read-only
- **Preconditions:** **more than one** OS row under Unassigned (asserted, not skipped: `expect(ascending.length).toBeGreaterThan(1)`)
- **Data created:** none
- **Cross-link:** free mirror = **SWV-22**

**Flow**

1. ☐ Open **Software → Inventory** (via URL), select **Unassigned**, click the **OS** tab.
   - ✅ *(UI)* URL `/software/os`; the table has a row.
2. ☐ Click the **Hosts** column header.
   - ✅ *(UI)* URL contains `order_key=hosts_count`.
   - ✅ *(UI)* URL contains `order_direction=asc` — the first click's direction is asserted, not assumed.
3. ☐ Wait for the table to settle, then read every row's **Hosts** cell.
   - ✅ *(UI)* The loading overlay has cleared — `table.waitForSettled()`. Fleet keeps the previous rows visible under a translucent overlay for the whole round trip, so a read taken mid-fetch would report the **old** order.
   - ✅ *(UI)* More than one row rendered.
   - ✅ *(UI)* The host counts are in non-decreasing order (`toEqual([...ascending].sort(asc))`).
4. ☐ Click the **Hosts** header again.
   - ✅ *(UI)* URL contains `order_direction=desc`.
   - ✅ *(UI)* After settling, the host counts are in non-increasing order.
   - ✅ *(UI)* The descending list is **not** equal to the ascending one — guards the case where the param flips but the list never re-fetches.

**Assessment**
- *Value:* the only sort assertion in this area, and a well-built one: it asserts on the **rendered order**, not just the URL, and the final `not.toEqual` closes the "param changed, data didn't" hole that a URL-only check leaves open. `Hosts` is the OS table's only sortable column (`OSTableConfig.tsx` sets `disableSortBy` on every other), so this is complete coverage of OS-tab sorting.
- *Coverage gaps:* sorting is only checked **within page 1** — a sort that is applied client-side to the current page rather than server-side across the whole set would pass. No third click to confirm the toggle cycles back. No check that the *row identities* changed rather than just the counts (an all-equal-count instance would satisfy both sort assertions and only the `not.toEqual` would catch it — and it would catch it by failing, which is a false positive, not a true one). ~~⚠️ on an all-equal-count instance this failed despite correct behaviour.~~ **Fixed 2026-09-28:** the `not.toEqual` now runs only when `min !== max`, i.e. when the data can actually distinguish the two directions.
- *Redundancy:* none — no other entry in the area sorts anything.
- *Efficiency / smells:*
  - `hostCounts()` calls `cellByColumn` per row, which re-resolves the header row each time — O(rows × columns) header scans, the same pattern flagged in SWV-02/SWV-11.
  - The ascending assertion sorts a copy and compares, which passes on a single-row table too; the `> 1` guard above it is what makes it meaningful, and it is correctly placed.
  - Two full page loads' worth of work (nav + two sorted fetches) for one column.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWV-18 · Vulnerabilities — a CVE hands off to the hosts running each affected version

- **File:** [`playwright/tests/e2e/premium/software/vulnerabilities.spec.ts`](../../tests/e2e/premium/software/vulnerabilities.spec.ts) (L316)
- **Grep:** `npx playwright test --project=premium -g "a CVE hands off to the hosts running each affected version"` (matches the free copy too — `--project` is mandatory)
- **Project:** premium · **Scope:** Unassigned
- **Mode:** UI (API used only to pick a renderable CVE) · **Isolation:** independent, read-only
- **Preconditions:** CVEs listed under Unassigned, **and at least one of them has a renderable detail page** — otherwise `test.skip('No listed CVE has a renderable detail page — fleetdm/fleet#49913')`. See [the workaround note](#the-findrenderablecve-workaround-fleetdmfleet49913).
- **Data created:** none
- **Cross-link:** free mirror = **SWV-20**

**Flow**

1. ☐ Open **Software → Inventory** (via URL), select **Unassigned**, click the **Vulnerabilities** tab.
   - ✅ *(UI)* URL `/software/vulnerabilities`; the table has a row — `gotoVulnerabilitiesTab()`.
2. ☐ Read every CVE identifier on page 1 — `VulnerabilitiesListPage.cveNames()`.
   - ✅ *(UI)* The first CVE link is visible before the read.
3. ☐ (No user action) pick one whose detail page answers.
   - ✅ *(API)* `findRenderableCve` issues `GET /vulnerabilities/<cve>?fleet_id=<the list's scope>` per listed id, in page order, and keeps the first that answers 200. **Skips the test** if none answers.
4. ☐ Open that CVE's detail page — `CveDetailPage.goto(cve)` (direct URL, *not* a click from the list).
   - ✅ *(UI)* `<h1>` equals the CVE id (10 s budget — the page hydrates from a slow enrichment API).
   - ✅ *(UI)* A level-2 **Vulnerable software** heading is visible.
   - ✅ *(UI)* The vulnerable-software table has a row.
5. ☐ Read the **Affected hosts** summary value.
   - ✅ *(UI)* It parses to a number **> 0** — i.e. a real figure, not a placeholder or a `---`.
6. ☐ Read the first vulnerable-software row's **Name**, **Version** and **Hosts**.
   - ✅ *(UI)* That row's Hosts count is **> 0**, with the software name in the failure message.
7. ☐ Hover that row and click **View all hosts**.
   - ✅ *(UI)* The hover-only `row-hover-button` is clicked through `clickHoverAction` (survives a hover lost to a re-render).
   - ✅ *(UI)* URL matches `/hosts/manage?…software_version_id=\d+` — asserted inside `viewAllHostsFor()`.
8. ☐ Land on the Hosts list.
   - ✅ *(UI)* The "hosts filtered by …" status pill is visible.
   - ✅ *(UI)* The pill contains the software **name**.
   - ✅ *(UI)* The pill contains the software **version** — name *and* version, so a hand-off that resolved to the wrong version of the right title fails.
   - ✅ *(UI)* URL contains `software_version_id=\d+` (asserted a second time, in the spec).
   - ✅ *(UI)* `expect.poll(() => hostsList.hostCount()).toBeGreaterThan(0)` — the landed list is populated.

**Assessment**
- *Value:* high, and genuinely new coverage: the CVE detail page's **outbound** hand-off (CVE → affected version → the hosts running it), which no other entry reaches. The version-level pill assertion is the sharp edge — it is what separates "filtered by some software" from "filtered by *this* version", and `software_version_id` is the id that actually crosses the boundary. It is also the only entry in the area that reads the **Affected hosts** figure as a *number* rather than asserting its label is visible (which is all `assertOk` does, in five other entries).
- *Coverage gaps:* the landed host list is never checked to *contain* hosts running that version — only that it is non-empty; the deliberate refusal to compare `software.hosts` against `hostsList.hostCount()` is documented in the spec and sound (shared, concurrently-mutated host population), but it means the entry proves "the filter resolved to something" rather than "the filter resolved to the right set". Only the **first** vulnerable-software row is followed, so a CVE affecting several versions has one path covered. Nothing asserts the Affected-hosts total relates to the table below it (the spec comment explicitly notes why summing rows is not a contract — a host on two affected versions is counted once above and twice below).
- *Redundancy:* the hover-action → filter-pill shape duplicates SWV-10 (OS → Hosts); the CVE-page readiness assertions overlap `assertOk`'s, though this entry deliberately does **not** call `assertOk` (no NVD-link check here).
- *Efficiency / smells:*
  - **Step 4 enters by direct URL**, skipping the click from the list it just read — against the `CLAUDE.md` e2e click-through rule, and it means the list → detail routing is not what this entry covers (SWV-06 covers it). Defensible: the CVE that renders is not necessarily the one at the top, so clicking would need a search first.
  - The `findRenderableCve` probe fires one request per un-renderable CVE **sequentially**, over the whole first page of the Vulnerabilities list — on an instance mid-enrichment that is the slowest part of the test, and its skip turns the entry into a silent no-op.
  - `expect.poll` with no explicit timeout inherits the default; the host-count read throws (rather than returning null) if the results-count text doesn't match `/([\d,]+)\s+hosts?/`, so an empty-state list surfaces as a thrown `Unexpected hosts count` inside a poll rather than a clean assertion failure.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWV-19 · Software Titles — the severity filter lists the CVSS bands from Critical down

- **File:** [`playwright/tests/e2e/premium/software/vulnerabilities.spec.ts`](../../tests/e2e/premium/software/vulnerabilities.spec.ts) (L379)
- **Grep:** `npx playwright test --project=premium -g "the severity filter lists the CVSS bands from Critical down"`
- **Project:** premium **only** — `SoftwareFiltersModal` renders the severity control behind `isPremiumTier`, so there is no free counterpart and there should not be one
- **Scope:** Unassigned
- **Mode:** UI · **Isolation:** independent; the modal is **cancelled**, so the list underneath is left unfiltered for whatever runs next
- **Preconditions:** premium license; the Inventory list has enough rows for **Add filters** to be enabled (`FilterModal.open()` asserts the trigger is enabled first, so an empty table fails loudly rather than hanging)
- **Data created:** none

**Flow**

1. ☐ Open **Software → Inventory** (via URL), select **Unassigned**.
   - ✅ *(UI)* Inventory tab `aria-selected`; a row or the empty state visible.
2. ☐ Click **Add filters**.
   - ✅ *(UI)* The trigger was enabled before the click — `FilterModal.open()`.
   - ✅ *(UI)* The `.software-filters-modal` dialog is visible.
3. ☐ Look at the **Severity** dropdown with the vulnerable toggle still off.
   - ✅ *(UI)* The severity trigger carries `is-disabled` — Fleet passes `disabled={!vulnSoftwareFilterEnabled}`, so severity is unusable until the list is narrowed to vulnerable software.
4. ☐ Click the **Vulnerable software** toggle.
   - ✅ *(UI)* The severity trigger **loses** `is-disabled`.
   - ✅ *(UI)* Its rendered value reads exactly **"Any severity"** — the default.
5. ☐ Open the severity dropdown and read every option.
   - ✅ *(UI)* The option list equals, **in order**: `Any severity CVSS score 0-10`, `Critical severity CVSS score 9.0-10`, `High severity CVSS score 7.0-8.9`, `Medium severity CVSS score 4.0-6.9`, `Low severity CVSS score 0.1-3.9`, `Custom severity Custom CVSS score range` — each entry is the label plus its help text with the newline collapsed. Ordering **is** the behaviour here: a band rendered out of sequence would still satisfy a membership check.
   - ✅ *(UI)* The menu is dismissed afterwards (`toHaveCount(0)`) — `severityOptions()` re-clicks the trigger rather than pressing Escape, because Fleet's `Modal` closes on Escape and would take the whole dialog down with the menu.
6. ☐ Click **Cancel**.
   - ✅ *(UI)* The modal is hidden — `FilterModal.cancel()`.

**Assessment**
- *Value:* fills the area's most-cited gap — the premium severity/CVSS filter had **no** coverage at all, and `FilterModal` exposed only the vulnerable switch. Three things get pinned at once: that severity is premium-gated, that it is *disabled* until the vulnerable filter is on (a real interaction rule, not just a render), and the exact band boundaries. Asserting the full ordered list is the right instrument for a control whose whole meaning is a ranked scale, and the CVSS ranges are product copy a manual tester would otherwise have to eyeball.
- *Coverage gaps:* **nothing is ever applied.** Selecting Critical and checking the list narrows (or that `min_cvss_score`/`max_cvss_score` land in the URL) is not covered, so this proves the menu renders, not that the filter works. The **Custom** band's numeric range inputs are never opened. No free-tier assertion that the control is **absent** — the premium-gating claim in the spec comment is sourced from Fleet's code, not verified from the free side (contrast SWV-21, which does assert absence for the OS columns). The exploited filter (SWV-05) and this one are never combined.
- *Redundancy:* none.
- *Efficiency / smells:*
  - Class-based locators throughout (`.severity-filter__dropdown .react-select__control`, `is-disabled`) — documented as unavoidable for react-select, but `toHaveClass(/is-disabled/)` is a **styling** assertion standing in for a state assertion; a refactor that renamed the class would read as "not disabled" and pass step 4 while silently breaking step 3.
  - `severityOptions()` opens and closes the menu as a side effect of reading it, so the read is a mutation — fine here, but it means the helper can't be called twice without re-checking state.
  - The entry enters by direct URL rather than the navbar click-through, consistent with the rest of this file but against the `CLAUDE.md` e2e rule.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWV-20 · Vulnerabilities — a CVE hands off to the hosts running each affected version *(free)*

- **File:** [`playwright/tests/e2e/free/software/vulnerabilities.spec.ts`](../../tests/e2e/free/software/vulnerabilities.spec.ts) (L238)
- **Grep:** `npx playwright test --project=free -g "a CVE hands off to the hosts running each affected version"`
- **Project:** free · **Scope:** single (no team dropdown)
- **Mode:** UI (API used only to pick a renderable CVE) · **Isolation:** independent, read-only
- **Preconditions:** CVEs listed on the free instance with at least one renderable detail page — otherwise skipped for [#49913](https://github.com/fleetdm/fleet/issues/49913)
- **Data created:** none
- **Cross-link:** premium mirror = **SWV-18**

**Flow**

Identical to SWV-18 with the team-dropdown step removed:

1. ☐ Open **Software → Inventory** (via URL) → click the **Vulnerabilities** tab — ✅ *(UI)* URL `/software/vulnerabilities`, table has a row.
2. ☐ Read every listed CVE; ✅ *(API)* `findRenderableCve` picks the first whose detail page answers 200 in the list's scope (**skip** if none does).
3. ☐ Open that CVE's detail page by URL — ✅ *(UI)* `<h1>` = CVE; **Vulnerable software** heading; table has a row.
4. ☐ ✅ *(UI)* **Affected hosts** parses to > 0; the first software row's **Hosts** is > 0.
5. ☐ Hover the row, click **View all hosts** — ✅ *(UI)* URL `/hosts/manage?…software_version_id=\d+`.
6. ☐ ✅ *(UI)* Filter pill visible and contains the software **name** and **version**; URL carries `software_version_id`; `expect.poll(hostCount).toBeGreaterThan(0)`.

**Assessment**
- *Value:* free-tier parity for the CVE → hosts hand-off. The spec's own header states the justification: the hand-off is **not** premium-gated (only the summary's Severity and Probability of exploit are), so free would otherwise have no coverage of a flow it fully supports.
- *Coverage gaps:* same as SWV-18 — non-empty landed list rather than a membership check, first affected version only. Additionally, **the tier difference this file could cheaply assert is skipped**: nothing checks that Severity / Probability of exploit are *absent* from the free CVE summary, which is the one thing a manual tester would look at on this page on free. SWV-21 does exactly that for the OS detail page's columns, in the same tier, in a sibling spec.
- *Redundancy:* near-verbatim duplicate of SWV-18 minus `teamDropdown.select('Unassigned')`. Per the suite's tier-separation convention this duplication is intended.
- *Efficiency / smells:* same `findRenderableCve` cost and silent-skip path; same direct-URL entry to the CVE page. **History note:** this test originally asserted `software.hosts === hostsList.hostCount()`; the exact comparison was dropped (commit `881f32a`) after the premium sibling had already lost it, on the reasoning that two reads of a shared, concurrently-mutating host population are not required to agree. That reasoning was held against SWV-16 and **applied to it on 2026-09-28**: both OS specs now assert the detail count is non-zero and no larger than the list's, since hosts only ever leave during a run. The two specs no longer take opposite positions on the same hazard.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWV-21 · OS tab — a row drills into that OS with matching version and counts *(free)*

- **File:** [`playwright/tests/e2e/free/software/os.spec.ts`](../../tests/e2e/free/software/os.spec.ts) (L23)
- **Grep:** `npx playwright test --project=free -g "OS tab — a row drills into that OS with matching version and counts"`
- **Project:** free · **Scope:** single (no team dropdown)
- **Mode:** UI · **Isolation:** independent, read-only
- **Preconditions:** a macOS or Windows OS row reporting vulnerabilities on the free instance (skips without one; Linux rows are excluded, as in SWV-16)
- **Data created:** none
- **Cross-link:** premium mirror = **SWV-16**

**Flow**

Identical to SWV-16 with the scope step removed, and with the column contract **inverted**:

1. ☐ Open **Software → Inventory** (via URL) → click the **OS** tab — ✅ *(UI)* URL `/software/os`, table has a row.
2. ☐ Filter to macOS, then Windows — ✅ *(UI)* every row names the platform; take the first row reporting "N vulnerabilities" (skip if none); read its Name / Version / Vulnerabilities / Hosts.
3. ☐ Click the row's Name link — ✅ *(UI)* URL `/software/os/:id`.
4. ☐ ✅ *(UI)* `<h1>` contains the Name (minus a leading `Microsoft `) and the Version; **Vulnerabilities** heading visible; table rendered.
5. ☐ ✅ *(UI)* Summary **Hosts** is non-zero and no larger than the row's Hosts; the `N items` count equals the row's Vulnerabilities.
6. ☐ (No user action) free column contract.
   - ✅ *(UI)* **Vulnerability** and **Detected** headers are visible.
   - ✅ *(UI)* **Severity**, **Probability of exploit** and **Published** each have count **0** — `SoftwareVulnerabilitiesTableConfig` drops `cvss_score`, `epss_probability` and `cve_published` off-premium, so their absence is part of the free contract.

**Assessment**
- *Value:* the **only tier-difference assertion in this whole area**, and the model the rest of it should copy. Every other free entry here is a premium entry with the dropdown removed and asserts nothing about being free; this one states what free *lacks* and would catch a premium column leaking into the free build — a real regression class (paid data rendered to an unlicensed instance) that nothing else in the suite watches.
- *Coverage gaps:* absence is asserted only for the **OS detail** table. The CVE detail page (`CveDetailPage.description` is flagged premium-only in the POM and never asserted either way) and the Vulnerabilities-tab list columns get no equivalent check on free. As with SWV-16, the table contents are unread and only one OS is exercised.
- *Redundancy:* deliberate free mirror of SWV-16. The file header explains why it is a separate file rather than a shared spec with a tier conditional: the premium variants select a fleet scope first and free has none — consistent with the suite's explicit-tier-separation preference.
- *Efficiency / smells:*
  - ~~Inherits SWV-16's exact-count race~~ **fixed 2026-09-28 in both tiers** — was: inherits SWV-16's exact-count race against a shared instance, without SWV-16's excuse of also being the premium column check — this is the entry where a flaky count would be most annoying, since its unique value (the absent columns) does not need the counts at all.
  - `columnHeader(name)` uses `exact: true`, so a header gaining a sort caret's accessible text would flip a present column to count 0 and read as a tier regression.
  - `PREMIUM_ONLY_COLUMNS` is duplicated as a literal here and as part of `VULNERABILITY_COLUMNS` in the premium spec; the two lists can drift apart silently.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWV-22 · OS tab — sorting by Hosts reorders the list *(free)*

- **File:** [`playwright/tests/e2e/free/software/os.spec.ts`](../../tests/e2e/free/software/os.spec.ts) (L62)
- **Grep:** `npx playwright test --project=free -g "OS tab — sorting by Hosts reorders the list"`
- **Project:** free · **Scope:** single
- **Mode:** UI · **Isolation:** independent, read-only
- **Preconditions:** more than one OS row on the free instance (asserted)
- **Data created:** none
- **Cross-link:** premium mirror = **SWV-17**

**Flow**

Identical to SWV-17 with the scope step removed:

1. ☐ Open **Software → Inventory** (via URL) → **OS** tab.
2. ☐ Click the **Hosts** column header — ✅ *(UI)* URL gains `order_key=hosts_count` and `order_direction=asc`.
3. ☐ ✅ *(UI)* After `waitForSettled()`, more than one row rendered and the host counts are non-decreasing.
4. ☐ Click **Hosts** again — ✅ *(UI)* `order_direction=desc`; after settling the counts are non-increasing and the two orders differ.

**Assessment**
- *Value:* free parity for the one sortable OS column. Sorting is not premium-gated, so without this free would have no OS-sort coverage at all.
- *Coverage gaps:* identical to SWV-17 — page-1 only, no third toggle. ~~The `not.toEqual` guard produced a **false failure** on an all-equal-count instance.~~ **Fixed 2026-09-28** in both tiers: the guard is conditional on the counts being distinguishable.
- *Redundancy:* byte-identical to SWV-17 apart from the missing `teamDropdown.select('Unassigned')` line. Of the two OS entries free gained, this is the one whose tier-specific value is hardest to argue: unlike SWV-21 it asserts nothing free-specific, so it is pure mirror coverage.
- *Efficiency / smells:* same O(rows × columns) `hostCounts()` scan; two sorted fetches per run.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWV-23 · Vulnerabilities — a CVE's host count and hosts are its fleet's

- **File:** [`playwright/tests/e2e/premium/software/vulnerabilities.spec.ts`](../../tests/e2e/premium/software/vulnerabilities.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "host count and hosts are its fleet"`
- **Project:** premium · **Scopes:** VMs, All fleets
- **Mode:** UI+API · **Isolation:** independent, read-only
- **Source:** QA Wolf `software-vulnerabilities-filter-vulnerabilities-by-team` (round 1 C6 #3) and `software-vulnerabilities-view-all-hosts-vulnerabilities` (C6 #7; round 3, batch C)
- **Preconditions (API):** the real Linux VM online and on the VMs fleet; among its own first 20 CVEs (`GET /hosts/:id/software?vulnerable=true`), one counted on the VMs fleet whose count there differs from All fleets' (one the simulations on Unassigned share). Hosts are never moved to make one. The candidates come from the VM, not from the fleet's CVE list: that list is the hourly job's, and it can count a simulation a label spec had borrowed onto the fleet while the job ran — branch run 37667485374 picked such a CVE (`CVE-2006-10002`, a simulations-only `libxml-parser-perl`) and found no live host on the fleet, three attempts running.
- **Data created:** none

**Flow**

1. ☐ *(API)* Pick the CVE.
2. ☐ Open `/dashboard` → **Software** → select **VMs** → **Vulnerabilities**; search for the CVE.
   - ✅ *(UI)* one row; its **Hosts** equals the API's VMs-scoped count (re-read until they agree: both are the hourly job's).
3. ☐ Select **All fleets**; search again.
   - ✅ *(UI)* one row; its **Hosts** equals the API's All-fleets count, and differs from the VMs count.
4. ☐ Select **VMs**, search, hover the row and click **View all hosts**.
   - ✅ *(UI)* URL `/hosts/manage` with `vulnerability=<CVE>` and `fleet_id=<VMs>`; the pill shows the CVE.
   - ✅ *(UI+API)* the listed hosts are exactly `GET /hosts?vulnerability=<CVE>&fleet_id=<VMs>`, by name, and there is at least one.

**Assessment**
- *Value:* per-fleet vulnerability counts (QA Wolf only asserted "different"; this asserts each equals Fleet's figure for that scope) and the CVE → hosts hand-off, with the hosts compared whole because the VMs fleet is small. QA Wolf's flow ran `fleetctl trigger --name vulnerabilities` first; this never triggers a global cron.
- *Coverage gaps:* Unassigned's and Workstations' counts aren't read; the hand-off's list isn't compared with the count (one is live, the other hourly, so they needn't agree).
- *Redundancy:* SWV-18 is the CVE detail page's hand-off (by software version); this is the list row's (by CVE).
- *Efficiency / smells:* ~10 s. Up to 40 API reads to choose the CVE, usually two.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWV-24 · Software vulnerabilities › Vulnerabilities — a CVE's View all hosts lists hosts it affects

- **File:** [`playwright/tests/e2e/free/software/vulnerabilities.spec.ts`](../../tests/e2e/free/software/vulnerabilities.spec.ts)
- **Grep:** `npx playwright test --project=free -g "View all hosts lists hosts it affects"`
- **Project:** free · **Mode:** UI+API · **Isolation:** independent, read-only (runs after the file's heavy `beforeAll`)
- **Source:** QA Wolf `software-vulnerabilities-view-all-hosts-vulnerabilities` (round 1 C6 #7, its free half; round 3, batch C)
- **Data created:** none

**Flow**

1. ☐ Open **Software** → **Vulnerabilities**; take the first CVE; hover its row and click **View all hosts**.
   - ✅ *(UI)* URL has `vulnerability=<CVE>`; the pill shows the CVE; a host is listed.
   - ✅ *(UI+API)* every listed host is in `GET /hosts?vulnerability=<CVE>`.

**Assessment**
- *Value:* the hand-off on free, where it isn't gated.
- *Coverage gaps:* containment only: free's one scope holds hundreds of affected hosts, more than a page.
- *Redundancy:* SWV-23 is premium's, with a fleet.
- *Efficiency / smells:* seconds, after the file's `beforeAll`.

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
| Title → version → CVE drill-down | SWV-03, SWV-12 (all three platforms, both tiers) | no back-navigation; no check the CVE page lists the originating title; which CVE is opened is non-deterministic (#49913 workaround) |
| CVE detail page | `assertOk` in SWV-03/06/07/12/13/14; **Affected hosts** read as a number in SWV-18/SWV-20 | **premium summary enrichment still never asserted** — severity/CVSS, probability of exploit, published date, `CveDetailPage.description` (defined, unused), and no free-side absence check for them |
| CVE → hosts running an affected version | SWV-18, SWV-20 | landed list only checked non-empty, not that it contains hosts on that version; first affected version only; Affected-hosts total never related to the table below it |
| Vulnerabilities tab search | SWV-04 (premium only) | no free equivalent; no partial-match or empty-state case |
| Exploited-vulnerabilities filter | SWV-05 | rows never verified to be exploited; no reset to **All vulnerabilities** |
| Severity / CVSS filter (premium) | SWV-19 (options list + disabled-until-vulnerable rule) | **never applied** — no narrowed list, no `min_cvss_score`/`max_cvss_score` in the URL, no **Custom** range inputs, no free-side absence check |
| Vulnerabilities list pagination + tab reset | SWV-06, SWV-13 | conditional; no column/sort assertions |
| Host-details Software tab vulnerable filter + Applications↔Full inventory | SWV-07, SWV-14 | narrowing not asserted; host software search untested; no real MDM host variant |
| Vulnerability-automations webhook | SWV-08, SWV-15 (on → stored → re-read, then off → stored with the URL kept → re-read) | ticket workflow, invalid URL, tier-difference assertions, delivery; **Automations** disabled outside All fleets is SWL-12 (area 06) |
| OS tab platform filter | SWV-09 (premium only) | Linux/ChromeOS/iOS/iPadOS/Android, **All platforms** reset, pagination; free has no platform-filter test (by design — its spec covers only the scope-independent cases) |
| OS → Hosts hand-off | SWV-10 | URL params, count agreement, pill clearing — all three of which SWV-18 does properly for the CVE hand-off |
| OS detail page `/software/os/:id` | SWV-16 (premium), SWV-21 (free) | vulnerabilities-table *contents* unread; one OS per run; summary's other fields untouched; `SoftwareOsPage.clickFirstOs` is now dead code (superseded by `openOs(row)`) |
| OS-tab sorting | SWV-17, SWV-22 | page-1 only; false failure when every OS has the same host count |
| **Tier-difference assertions** | SWV-21 only (three premium-only OS columns asserted absent on free) | every other free entry is a premium entry minus the dropdown and asserts nothing about being free |
| Software **Versions** tab / **Show versions** toggle | — | **untested in e2e**; `SoftwareVersionsPage` is used only by `tests/loadtest/software.spec.ts`; `showVersionsSwitch` never used |

**Duplication**

1. **Free ≡ premium vulnerability specs.** SWV-11≡SWV-02(+SWV-01), SWV-12≡SWV-03, SWV-13≡SWV-06, SWV-14≡SWV-07, SWV-15≡SWV-08, SWV-20≡SWV-18. The only real deltas: the team-dropdown step, premium's one remaining skip (SWV-01), and free running the every-row check. ~55 % of this area's runtime is the same flow twice.
2. **`CveDetailPage.assertOk` runs in 6 of 22 entries** (12 of 31 runtime tests once loops expand) — the same six assertions about the same handful of CVEs. SWV-18/SWV-20 deliberately do *not* call it, asserting the page's data instead.
3. **Title → version → CVE tail** is identical in SWV-03/07/12/14; only the entry point (search vs host) differs. The `findRenderableCve` probe is now pasted into all four, plus SWV-18/SWV-20 — six copies of the same ten-line comment and skip.
4. **Optional-pagination probe** (`nextIfEnabled` ×2 + `previousIfEnabled`) appears in SWV-02, SWV-06, SWV-11, SWV-13.
5. **The OS pair is duplicated verbatim across tiers.** SWV-21≡SWV-16 and SWV-22≡SWV-17, differing only by `teamDropdown.select('Unassigned')` and the inverted column list. Only SWV-21's absence assertion is unique; SWV-22 carries no tier-specific content at all.
6. **Hover-action → filter-pill** is the same shape in SWV-10 (OS → Hosts) and SWV-18/SWV-20 (CVE → Hosts), with the newer pair asserting strictly more.

**UI-vs-API balance**

Only SWV-08/SWV-15 assert via API, and it is justified — `GET /config` is the authoritative, race-free check that a modal save persisted, and the UI re-read is still performed. For the second (off) save it is also the only completion signal: the first save's identical toast can still be on screen, so the test polls `GET /config` until the switch reads off. Everything else validates through the browser. The API is used heavily for **discovery** instead: `findVulnerableSoftwareBySources` (up to 5 paged `vulnerable=true` sweeps) and `findHostByPlatform` (up to 50 per-host vulnerable-software probes per platform) run in `beforeAll` for both vulnerability specs — correct in principle (UI scraping would be slower and flakier) but currently the area's biggest reliability liability: the sweep re-runs once per worker under `fullyParallel`, throws the whole chunk on a 500, and the host lookup converts API failures into silent skips. Both use raw `fetch` rather than the sanctioned `withRequest` hook wrapper.

`findRenderableCve` is a third kind of API use again: not discovery of *what* to test but a probe for **which instance data is navigable at all**, because Fleet links CVEs its own detail endpoint cannot render (#49913). It is the right concession — the alternative is six tests that fail on a product bug they are not about — but it has two costs the entries above record: the assertion target becomes non-deterministic run to run, and a fully-unenriched version turns the test into a silent skip. It is also the area's only API call made from inside a test body rather than a hook.

**The area's two exact-count comparisons disagree with each other.** SWV-16/SWV-21 assert list-row counts equal detail-page counts exactly; SWV-18/SWV-20 explicitly refuse the analogous comparison (`expect.poll(...).toBeGreaterThan(0)`) with a written rationale about the shared, concurrently-mutating host population — and the free one had an exact comparison *removed* for that reason. Both positions cannot be right about the same instance. Worth one verdict for the area rather than two per-entry ones.

**Quick wins**

1. Make the guarded assertions unconditional or fail loudly: in SWV-02/SWV-11 assert `rows.count() > 0` before the loop and `expect(multiRow).not.toBeNull()` / `expect(singleRow).not.toBeNull()` (`premium/.../vulnerabilities.spec.ts:105-113`, `free/.../vulnerabilities.spec.ts:61-75`) — today a slow or empty table passes with ~1 assertion.
2. Have `findHostByPlatform` throw on non-OK responses like its software sibling does (`helpers/api/hosts.ts:49,62`), so SWV-07/SWV-14 fail instead of silently skipping when the instance misbehaves.
3. Add the premium CVE-detail assertions the POM already models — severity / probability of exploit / published date / `description` — to one premium variant of SWV-03, and assert `description` is **absent** in SWV-12. SWV-21 already does exactly this shape for the OS detail page's three premium columns, so it is a copy of a pattern that exists, not a new one.
4. Cache the `beforeAll` discovery per worker (or move it to a worker-scoped fixture) so the `vulnerable=true` sweep runs once per project rather than once per worker per file — directly reduces the "table is full" 500 exposure.
5. Delete or rewrite the stale isolation exception at [`tests/README.md:154`](../../tests/README.md) — `softwareByOS` is not accumulated across tests, and the line makes people believe these tests can't be run individually.
6. Apply the severity filter in SWV-19 instead of only listing its options: select **Critical**, click **Apply**, and assert `min_cvss_score=9` reaches the URL. One extra click turns a render check into a filter check.
7. Lift the six copies of the `findRenderableCve` comment + skip into one helper (`openRenderableCve(versionDetailPage, request)`), so the workaround has a single place to be deleted when #49913 closes.
8. Settle the exact-vs-loose count question (see **UI-vs-API balance**) and make SWV-16/SWV-21 and SWV-18/SWV-20 agree.

**Bigger bets**

1. **Collapse the free/premium vulnerability duplication** into one spec parameterized on scope (`fleetIdFor`), keeping tier-specific extras (premium enrichment fields, free absence checks, SWV-01's skip) as explicit variants. Removes ~10 duplicate runtime tests without losing signal. ⚠️ weigh against the suite's stated preference for explicit tier separation over parameterized specs — the free OS spec's own header argues the opposite case and argues it well.
2. **Give the CVE detail page one owner test.** Assert the full page contract once (heading, enrichment block, NVD link, affected-hosts hand-off, software table matching the drill-down origin); reduce the four drill-down tests to routing checks. Cuts repeated 10 s enrichment waits, the repeated external NVD hit, and four of the six `findRenderableCve` probes. SWV-18 is most of this test already — it just needs the premium summary fields and a free-side absence mirror.
3. **Make tier-difference assertions the rule, not the exception.** SWV-21 is currently the only entry in the area that asserts what free *lacks*, and it found its own reason to exist (`SoftwareVulnerabilitiesTableConfig` drops three columns off-premium). The same one-line `toHaveCount(0)` treatment applied to the CVE summary (severity, probability of exploit, `description`), the Vulnerabilities-list columns and `FilterModal`'s severity control would turn six mirror specs that assert nothing tier-specific into six that do — at roughly one assertion each.
4. **Cover what is still untouched:** the Versions tab / **Show versions** toggle (`SoftwareVersionsPage` is used only by `tests/loadtest/software.spec.ts`), applying rather than merely listing the severity filter, and the OS-tab platform options beyond macOS/Windows.
