# Hosts — shared + free — test audit

**Specs covered:** 15 files · **Test declarations:** 27 entries (25 `test()` declarations — `free/hosts/mdm-actions-availability.spec.ts` is one loop over 3 cases, documented as three entries; the interpreter loop in `shared/hosts/host-run-script.spec.ts` is one loop over 4 cases, documented as **one** entry, HOST-22) · **32 executions** · **Projects:** premium + free (the 10 `shared/hosts` specs run in **both** projects), free only (the 5 `free/hosts` specs)

This area covers the hosts list (`/hosts/manage`: column chooser, CSV export, Add hosts modal, role-gated CTAs) and the single-host detail page (`/hosts/:id`: vitals + refetch, Local user accounts card, Certificates card, Software tab, Reports tab, Activity card, Actions menu, live report against one host, **Run script** on a real device, a custom **MDM command** read back through the Activity card, and the **User** card's *Add user* modal, which shows the Fleet Premium message on free). The ten `shared/` specs carry no serial describes; tests within a file are independent. The one piece of shared mutable state is HOST-21's temporary `script_execution_timeout` write to agent options (the VMs fleet on premium, **global** on free), restored in its `finally`. The three `free/` specs are role/paywall checks that live in `free/` because their expected answer inverts on premium (each has a `premium/hosts/` mirror).

**Host-population split — read this before reproducing anything manually.** There are **three real VMs per tier — macOS, Windows and Ubuntu, all ARM.** On premium they sit on the **VMs** fleet (id 103); on free they are in Unassigned. Specs reach them with `findOnlineHost(..., { kind: 'real' })` ([`helpers/api/hosts.ts:202`](../../helpers/api/hosts.ts)), which keys on the reported **hardware model** (`VirtualMac2,1`, `QEMU Virtual Machine`) — **not** on MDM enrollment: since perf-hosts PR #45 roughly 30% of the osquery-perf simulations are MDM-enrolled too, so enrollment no longer tells a real device from a simulation. `liveMacosHost` ([`fixtures.ts:276`](../../fixtures.ts)) is the macOS VM resolved that way (its error message still says "MDM-enrolled"; it does not check). Everything else runs against whatever simulation the API resolver returns. Simulations ignore live-query SQL, report thin/absent vitals, **never execute a script and never acknowledge an MDM command** — which is why HOST-19…HOST-23 are real-VM-only by construction. The macOS VMs lack the Xcode Command Line Tools, so `/usr/bin/python3` there is Apple's install-prompt stub; Python is exercised on Linux.

| Test | Host population |
|---|---|
| HOST-01, HOST-02, HOST-03 | real macOS VM (`liveMacosHost`) |
| HOST-05, HOST-06 | real macOS VM (`liveMacosHost`) — HOST-06 does not actually need it |
| HOST-15, HOST-16 | real macOS VM (`liveMacosHost`) — **mandatory**: a simulation reports no certificates, so the card never mounts |
| HOST-17 | real macOS VM (`liveMacosHost`) — **mandatory**: the Applications filter is macOS-only and a simulation reports no application paths |
| HOST-18 | real macOS VM (`liveMacosHost`) — host id only; does not actually need it |
| HOST-04 | first host by name reporting software — in practice a simulation |
| HOST-07, HOST-08, HOST-09, HOST-10, HOST-11 | no specific host; whatever tops/fills the list |
| HOST-12, HOST-13 | real MDM-enrolled macOS / Windows VM (`kind: 'real'`) |
| HOST-14 | any online Linux host — real Linux VMs are *not* MDM-enrolled, so this can land on either a real VM or a simulation |
| HOST-19, HOST-23 | real macOS VM (`requireRealHost`, which wraps `findOnlineHost(…, { kind: 'real' })`) — **mandatory**: a script or MDM command must reach a device that executes/answers it. HOST-23 additionally asserts the VM is MDM-enrolled (`On …`) |
| HOST-20, HOST-21 | real **Ubuntu** VM (`kind: 'real'`) — mandatory |
| HOST-22 | one real VM per variant: macOS (zsh), Ubuntu (bash, Python), **Windows** (PowerShell) — mandatory |
| HOST-24 | an online **non-MDM simulated** Windows host (`findSimulations`, slice 0) — read-only, and a simulation keeps it off the free VMs, which sit in Unassigned |

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
| HOST-15 | `shared/hosts/host-certificates.spec.ts` | Host details — the certificates card lists every reported certificate | UI+API | ☐ |
| HOST-16 | `shared/hosts/host-certificates.spec.ts` | Host details — a certificate row opens its full details | UI+API | ☐ |
| HOST-17 | `shared/hosts/host-software.spec.ts` | Hosts — the Applications view narrows the inventory to top-level applications | UI | ☐ |
| HOST-18 | `shared/hosts/host-reports-tab.spec.ts` | Host details — the results-recency sorts keep reports awaiting results last | UI | ☐ |
| HOST-19 | `shared/hosts/host-run-script.spec.ts` | Run script › a script changes the host, and a report run by that host reads the change back | UI+API | ☐ |
| HOST-20 | `shared/hosts/host-run-script.spec.ts` | Run script › a script that exits non-zero reads as an error, with the output it recorded | UI+API | ☐ |
| HOST-21 | `shared/hosts/host-run-script.spec.ts` | Run script › a script that outlives the agent timeout is stopped, and the details say why | UI+API | ☐ |
| HOST-22 | `shared/hosts/host-run-script.spec.ts` | Run script › a `<interpreter>` script runs under `<interpreter>` (4 cases: zsh, bash, Python, PowerShell) | UI+API | ☐ |
| HOST-23 | `shared/hosts/mdm-commands.spec.ts` | a custom MDM command is acknowledged by the host and reported everywhere Fleet shows it | UI+API | ☐ |
| HOST-24 | `free/hosts/host-idp-username.spec.ts` | Free • Hosts • IdP username › Add user opens the Fleet Premium message instead of the IdP field | UI | ☐ |
| HOST-25 | `shared/hosts/host-reports-tab.spec.ts` | Host details — reports that don't store results show only with the toggle on | UI+API | ☐ |
| HOST-26 | `free/hosts/host-actions-role-access.spec.ts` | Free • Hosts • Actions by role › <role> is offered the host actions its role grants (2 roles) | UI | ☐ |
| HOST-27 | `free/hosts/host-software-tab.spec.ts` | a host's Software tab is its inventory alone, with no Library | UI | ☐ |

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
   - ✅ *(UI)* The header button flips to **Fetching fresh vitals** (`refetchingButton`) — Fleet took the request.
   - ✅ *(API)* `waitForHostRefetch(request, id, { since: before, timeout: 180_000 })` ([`helpers/api/hosts.ts:471`](../../helpers/api/hosts.ts)) — polls `GET /hosts/:id` every 5s until `detail_updated_at` is **later than `before`** (180s budget; the real-VM round trip measures 70–120s) — proves the fresh vitals came from this refetch, not a background detail cycle. Replaces the old inline poll; the same helper serves any spec that needs "the host re-reported".
   - ✅ *(UI)* After a **fresh load** of `/hosts/:id`, the header's `Last fetched …` line matches `/Last fetched (in )?less than a minute/` — reloaded because the open page stops polling after 60s and stays on the old time; `(in )?` absorbs date-fns phrasing a timestamp slightly ahead of the browser clock as "in less than a minute".

**Assessment**
- *Value:* real regression catch — the refetch button actually round-trips to the agent and Fleet stores + renders newer vitals. The API delta makes it a genuine assertion rather than a copy check.
- *Coverage gaps:* the transient **Fetching fresh vitals** state is asserted only as visible (not as disabled); no assertion that a *specific* vital changed; no offline-host path (Fleet shows an error/"host is offline" affordance) and no error toast path.
- *Redundancy:* none.
- *Efficiency / smells:* clean. `lastFetched` is a class locator (`.host-header__last-fetched`) but that is justified in the POM ([`pages/hosts/HostDetailsPage.ts:36`](../../pages/hosts/HostDetailsPage.ts) — role-less div). Worst case is a slow test (up to ~240s of waits, budget 300s) rather than a weak one.

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
- **Project:** premium + free (shared) · **Mode:** UI · **Isolation:** standalone, read-only; first of two independent tests in the file (HOST-17 is the second)
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
   - ✅ *(UI)* The columns are **Name**, **Installed version**, **Type**, **Last opened**, **Vulnerabilities**, **File path**, **Hash**.
   - ✅ *(UI)* "N items" is over 20 and the page shows 20 titles; **Next** shows 20 others, none from the first page; **Previous** shows the first page again.
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
- *Coverage gaps:* the **Vulnerable** filter on the host's software tab is never applied here (`applyVulnerableFilter()` exists and is unused by this area); CVE search (the same input accepts a CVE) untested; the **Library** sub-tab untested from the host side; no assertion that the filtered hosts list actually contains the host we came from — which would be the real payoff of step 7; the columns are asserted as headers, not their cells (a simulation leaves "Last opened" empty).
- *Redundancy:* the software-title → hosts-list pill hop overlaps the software area's own title-detail specs (see the software audit file); the host-side entry point is the unique part. Shares the file and the `showFullInventory()` call with HOST-17, but runs against a different (API-chosen, simulated) host, so the two never observe the same inventory.
- *Efficiency / smells:* (a) the final pill assertion is weak — `toContainText(firstToken(titleName))` ([`host-software.spec.ts:56`](../../tests/e2e/shared/hosts/host-software.spec.ts)) accepts a partial name match, so a pill naming the *wrong* title with a shared first word passes; (b) `showFullInventory()`'s `if ((await trigger.count()) === 0) return;` ([`HostDetailsPage.ts:234`](../../pages/hosts/HostDetailsPage.ts)) is a deliberate but silent branch — *this* test still cannot tell you whether it ran the macOS or the non-macOS path (HOST-17 now pins the macOS branch, on the VM; the non-macOS branch remains unobserved on both tiers); (c) `rowOrEmpty()` in step 2 tolerates an empty table (the test still fails one step later at `names.length > 0`, so this is a diagnosability smell, not a silent pass); (d) the subject title is whatever sorts first for that host, so the test is not reproducible by hand without the API read.

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
- **Project:** premium + free (shared) · **Mode:** UI · **Isolation:** standalone; seeds + deletes two marker reports in `try/finally`. First of two independent tests in the file (HOST-18 is the second)
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
- *Coverage gaps:* the **"don't store results" toggle** is only read at its default here; HOST-25 flips it. The **Newest/Oldest results** sorts are now covered by HOST-18, in the same file — but only as a *partition* invariant, so the recency ordering itself is still unasserted. Card **Actions → View report for all hosts** never exercised; **Show details** is knowingly out of scope (needs a stored result). The unfiltered count is never reconciled with the number of cards. No empty-state path.
- *Redundancy:* overlaps `premium/hosts/host-report-details.spec.ts` (the stored-result drill) on tab entry; overlaps the reports area on report creation; and now overlaps HOST-18, which pays the same VM page load and tab entry again to drive the other two options of the same sort dropdown.
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
- **Project:** free only · **Mode:** UI · **Isolation:** own context via `withStaticUser`; read-only
- **Preconditions:** `global-admin@fleetdm.com` on the free instance; at least one host visible
- **Data created:** none

**Flow**

1. ☐ Log in as **global-admin** → `/hosts/manage` via URL.
   - ✅ *(UI)* **Add hosts** and **Export hosts** visible; the gear holds **Enroll secrets** (Escape closes it).
2. ☐ Once the table settles, open the label filter's menu.
   - ✅ *(UI)* the "Filter labels by name..." box and the **Add label** "+" beside it.

**Assessment**
- *Value:* the control for HOST-11: without it, a page that rendered no CTAs would pass HOST-11's absences.
- *Coverage gaps:* the global maintainer isn't read on free (it is on premium, HOSTP-10).
- *Redundancy:* the same cell as HOSTP-10's admin case; the expectation doesn't differ by tier.
- *Efficiency / smells:* seconds.

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
- **Project:** free only · **Mode:** UI · **Isolation:** own context via `withStaticUser`; read-only
- **Data created:** none

**Flow**

1. ☐ Log in as **global-observer** → `/hosts/manage` via URL.
   - ✅ *(UI)* **Export hosts** visible; **Add hosts** and the gear absent (no gear item for an observer, so no gear).
2. ☐ Once the table settles, open the label filter's menu.
   - ✅ *(UI)* the search box; no **Add label**; the search box still showing afterwards, so the absence was read off an open menu.

**Assessment**
- *Value:* the negative space, where role regressions land; HOST-10 keeps it honest.
- *Coverage gaps:* the observer's host Actions are HOST-26.
- *Redundancy:* the same cell as HOSTP-11 on premium.
- *Efficiency / smells:* seconds.

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
- **Preconditions:** **a real, online macOS VM on the free instance** — resolved by `requireRealHost(request, 'darwin')`, which picks by `hardware_model` (`/virtual|qemu/i`), not by MDM enrolment. Not the `liveMacosHost` fixture, but the same resolver and in practice the same machine. The VM must also be **MDM-enrolled**, with Apple MDM configured on the free instance, or the expectation flips; the resolver doesn't check that. Hard-fails rather than skipping when no such host exists, saying whether the VM is offline since its last check-in or not enrolled at all.
- **Data created:** none. **Nothing destructive is ever clicked** — the test only opens the Actions menu.

**Flow**

1. ☐ *(API precondition)* Resolve the online real macOS host (`GET /hosts?status=online&platform=darwin`, re-filtered client-side on the host's own `platform` and on `hardware_model`).
   - ✅ *(API)* Such a host exists.
2. ☐ Open `/hosts/:id` via URL, click **Actions**.
   - ✅ *(UI)* At least one option renders (`openActions()`).
   - ✅ *(UI)* **Turn off MDM** is offered exactly once — not premium-gated.
   - ✅ *(UI)* **Lock** is absent (`toHaveCount(0)`) — Fleet Premium feature.
   - ✅ *(UI)* **Wipe** is absent (`toHaveCount(0)`) — Fleet Premium feature.

**Assessment**
- *Value:* the highest-value negative-space test in the area, and worth defending. This is the **paywall assertion for Lock and Wipe** — it is the only automated check that free doesn't expose two irreversible device commands, and the regression it guards (a gating change leaking a destructive action to the wrong tier) is exactly the kind that ships unnoticed. The mixed matrix is what gives it teeth: because **Turn off MDM must be present** in the same menu, an entirely-empty or unrendered menu fails the test. That is the difference between this and a pure absence check.
- *Coverage gaps:* the absence is asserted only in the UI — no API probe that `POST /hosts/:id/lock` returns 402 on free, which is where a determined user would go. Nothing here checks the **role** dimension (observer on premium vs admin) or the `Unlock` option; nothing verifies the greyed-out/tooltip "premium feature" affordance if Fleet renders one; the command itself is deliberately never fired: Lock and Wipe are never fired on a real VM, only their availability is asserted.
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

### HOST-15 · Host details — the certificates card lists every reported certificate

- **File:** [`playwright/tests/e2e/shared/hosts/host-certificates.spec.ts`](../../tests/e2e/shared/hosts/host-certificates.spec.ts)
- **Grep:** `npx playwright test -g "the certificates card lists every reported certificate"`
- **Project:** premium + free (shared) · **Scopes:** n/a (single host, no team dropdown)
- **Mode:** UI+API · **Isolation:** standalone test, no describe, read-only
- **Preconditions:** **the real macOS VM is mandatory, not a preference.** Fleet mounts the card only for an **Apple or Windows** host that reports **at least one certificate** (`HostDetailsPage.tsx`, `showCertificatesCard`); an osquery-perf simulation reports none, so against one the card never renders and every assertion below would be vacuous. `liveMacosHost` resolves the real VM ([`fixtures.ts:256`](../../fixtures.ts)) and *throws* if it is off or unenrolled. The card is **not premium-gated** — the mount condition is platform and data only, which is why the spec lives in `shared/` and runs on both tiers. Both tiers' macOS VMs carry the same four system-keychain certificates (two Apple defaults plus Fleet's own CA and its identity certificate). Manually: pick the real VM in Hosts, Details tab, scroll to **Certificates**.
- **Data created:** none

**Flow**

1. ☐ *(API precondition)* `GET /hosts/:id/certificates?per_page=10&order_key=common_name&order_direction=asc` — `getHostCertificates` ([`helpers/api/hosts.ts:458`](../../helpers/api/hosts.ts)) deliberately mirrors the card's **own** page size and default sort (`DEFAULT_CERTIFICATES_PAGE_SIZE` = 10, `CERTIFICATES_DEFAULT_SORT`), so the comparison below stays row-for-row even if a VM ever reports more certificates than one page holds.
   - ✅ *(API)* the host's `count` is > 0, with a failure message naming the host and the mount condition.
2. ☐ Open `/hosts/:id` via URL.
   - ✅ *(UI)* **Disk space available** vital visible (`HostDetailsPage.goto` anchor).
3. ☐ *(no user action)* the card mounts.
   - ✅ *(UI)* the **Certificates** heading is visible **and** the first table row is visible — `CertificatesCard.waitForReady` ([`pages/components/CertificatesCard.ts:64`](../../pages/components/CertificatesCard.ts)). Note this is an `and`, not an `or`: unlike the Software/Reports tabs, an empty card is *not* an accepted settle state here.
4. ☐ Read the column headers.
   - ✅ *(UI)* **Name**, **Issuer**, **Scope**, **Issued**, **Expires** each resolve as a `columnheader` with that exact label.
5. ☐ *(no user action)* count and row tally.
   - ✅ *(UI)* the card's results count reads exactly `<N> certificate` / `<N> certificates` where `N` is the API's **total** (the singular/plural branch is in the spec, not the page object).
   - ✅ *(UI)* the number of rendered rows equals the length of the API **page** — the count is the host's total, the table shows one page of it.
6. ☐ *(no user action)* per-certificate row check — repeated for every certificate the API returned.
   - ✅ *(UI)* a row whose **Name cell** is exactly that certificate's common name is visible. **The row locator is pinned to the Name column** ([`CertificatesCard.ts:57`](../../pages/components/CertificatesCard.ts)) — a certificate row cannot be matched on "any cell", because Fleet issues every host both a `Fleet` CA certificate **and** a `Fleet Identity` certificate whose Issuer cell reads `Fleet`, so a text filter resolves two rows.
   - ✅ *(UI)* that row contains the **issuer common name** the API reports for it.
   - ✅ *(UI)* that row contains `System` or `User` — Fleet renders `source` capitalised, and a user-scope certificate renders the bare word "User" with the username in a tooltip (`CertificatesTableConfig.tsx`).

**Assessment**
- *Value:* the only coverage of the Certificates card anywhere in the suite, and the assertion shape is the right one — rows are compared against what Fleet's API reports for *this* host rather than against fixed names, because the VMs are re-provisioned and re-enrolled, which rotates the Fleet identity certificate and changes its dates. Catches the card failing to mount, a row dropped between API and table, a mis-wired Issuer or Scope column, and a count that disagrees with the rows.
- *Coverage gaps:* the **Issued** and **Expires** columns are never compared to `not_valid_before` / `not_valid_after` even though the helper already returns both — three of the five columns are asserted and two are only checked for existence; no expired / expiring-soon rendering; no sort, no pagination (a VM reporting >10 certificates leaves row 11+ unasserted — the count-vs-rows assertion is the only thing that would hint at it); **no Windows host**, though the card mounts for Windows too; no user-keychain (`source: "user"`) certificate, so the `'User'` branch is dead in practice on these VMs; no negative case (an Apple host reporting nothing must render **no card at all**); the same card on the end-user **My device** page is untested.
- *Redundancy:* none — no other spec touches this card. It is named in `HostDetailsPage`'s comments only as the reason the Local user accounts card needs scoping.
- *Efficiency / smells:*
  - ~~**Soft-pass:** the issuer assertion passed trivially on an empty common name.~~ **Fixed 2026-09-28:** both the Issuer and Scope assertions now read their own cell via `CertificatesCard.cell(commonName, column)` instead of the whole row, and the issuer one is skipped when Fleet reports no issuer common name. `toContainText` rather than `toHaveText` because Fleet's `TooltipTruncatedTextCell` emits each value twice — visible copy plus tooltip copy.
  - `toContainText('System' | 'User')` is a **row-wide** substring match, not a Scope-column assertion: an issuer or subject containing the word satisfies it without the Scope cell rendering at all. `'User'` is especially loose.
  - `row(commonName)` resolves more than one row if a host ever reports two certificates sharing a common name (plausible across the system and login keychains) — that surfaces as a strict-mode violation rather than a clean assertion.
  - No `toHaveScreenshot` of the table, deliberately (it fails on font rendering and never says what changed). Worth keeping it that way.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOST-16 · Host details — a certificate row opens its full details

- **File:** [`playwright/tests/e2e/shared/hosts/host-certificates.spec.ts`](../../tests/e2e/shared/hosts/host-certificates.spec.ts)
- **Grep:** `npx playwright test -g "a certificate row opens its full details"`
- **Project:** premium + free (shared) · **Scopes:** n/a
- **Mode:** UI+API · **Isolation:** standalone, read-only; independent of HOST-15 (re-reads the API itself)
- **Preconditions:** identical to HOST-15 — the real macOS VM via `liveMacosHost`, card mounts only for an Apple/Windows host reporting ≥1 certificate, not premium-gated.
- **Data created:** none

**Flow**

1. ☐ *(API precondition)* `getHostCertificates` again; take `certificates[0]` — the first by common name ascending, i.e. the card's own first row.
   - ✅ *(API)* at least one certificate is returned.
2. ☐ Open `/hosts/:id` via URL → ✅ *(UI)* **Disk space available** visible; card ready (heading + first row).
3. ☐ Hover that certificate's row and click its **View details**.
   - ✅ *(UI)* the `.certificate-details-modal` is visible (`CertificatesCard.openDetails`). "View details" is a `row-hover-button` Fleet keeps hidden until the row is hovered, so the click goes through `clickHoverAction` to survive a hover lost to a re-render.
4. ☐ *(no user action)* modal shape.
   - ✅ *(UI)* **Subject name**, **Issuer name** and **Validity period** each render as an `h3` section heading. The remaining sections (**Key info**, **Basic constraints**, **Signature**) are asserted *nowhere* — `CertificateDetailsModal.tsx` renders each only when the certificate carries a value for it, so they are deliberately out of scope.
5. ☐ *(no user action)* the modal is **this row's** certificate.
   - ✅ *(UI)* **Subject name › Common name** equals the API's `common_name`.
   - ✅ *(UI)* **Issuer name › Common name** equals the API's issuer common name. Both sections carry a "Common name" term, so each value is read from **inside its own section** ([`CertificatesCard.ts:102`](../../pages/components/CertificatesCard.ts)) — an unscoped lookup matches two elements.
6. ☐ Click **Close**.
   - ✅ *(UI)* the modal is hidden.
   - 📌 **Manual gotcha:** Escape closes it too — Fleet's `Modal` closes on Escape. That matters on the *other* modals on this page: if a Fleet `Modal` contains a react-select whose menu is open, Escape takes the **whole dialog** down with the menu, so a menu is dismissed by **re-clicking its trigger**, not with Escape (see [`FilterModal.ts:67`](../../pages/components/FilterModal.ts), the **Add filters** modal on this page's Software tab).

**Assessment**
- *Value:* proves the row→modal wiring carries the right certificate rather than an arbitrary one, which is the only thing that can silently go wrong here; and it does so on two fields in two different sections, so a section-scoping regression is caught.
- *Coverage gaps:* only `certificates[0]` is ever opened — no second row, so "each row opens *its own* certificate" is evidenced by one sample; the validity **dates** shown in the modal are never compared to the API's `not_valid_before` / `not_valid_after`, despite the helper carrying both and the **Validity period** section being asserted as present; serial number, key algorithm, signature algorithm and basic constraints unasserted; no Windows certificate; no check that the modal's values match the **row's** rendered cells (the comparison is modal-vs-API, not modal-vs-row).
- *Redundancy:* re-does HOST-15's `goto` + `waitForReady` + a second `GET /certificates` on the same host in the same file — two VM page loads where one test with an extra step would do. Defensible for failure attribution (card-renders vs modal-opens are different failures), expensive on the one scarce real VM.
- *Efficiency / smells:*
  - The subject row is "whichever certificate sorts first by common name", so the test is not reproducible by hand without reading the API first — same shape as HOST-04's API-chosen title.
  - `closeDetails()` asserts the modal hides, which is the only thing the last step buys; the test would lose nothing measurable if it ended at step 5, and would then not depend on the modal's Close button's accessible name.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOST-17 · Hosts — the Applications view narrows the inventory to top-level applications

- **File:** [`playwright/tests/e2e/shared/hosts/host-software.spec.ts`](../../tests/e2e/shared/hosts/host-software.spec.ts)
- **Grep:** `npx playwright test -g "the Applications view narrows the inventory to top-level applications"`
- **Project:** premium + free (shared) · **Scopes:** n/a
- **Mode:** UI · **Isolation:** standalone, read-only; second test in the file and independent of HOST-04 (different host, different entry)
- **Preconditions:** **the real macOS VM** (`liveMacosHost`), unlike HOST-04 which takes an API-chosen host. macOS hosts default the Software tab to **Applications** (top-level apps only) and offer **Full inventory**; the filter is **platform-gated, not tier-gated** (`HostSoftwareTable.tsx`, `showApplicationsFilter`), which is why this runs on both tiers rather than premium-only. A simulation reports a synthetic inventory with no application paths, so the narrowing against one would be meaningless. The VM must report ≥1 top-level application **and** ≥1 non-application package that lands on page 1 of Full inventory (see the smell below).
- **Data created:** none

**Flow**

1. ☐ Open the VM at `/hosts/:id` via URL → ✅ *(UI)* **Disk space available** visible.
2. ☐ Click the **Software** tab.
   - ✅ *(UI)* the table settles to rows **or** its empty state (`openSoftwareTab`).
   - ✅ *(UI)* the view dropdown's value reads **Applications** — macOS's default, asserted nowhere else in the suite.
   - ✅ *(UI)* the first Name-column link is visible.
3. ☐ Read the **N items** count and the Name-column links of the Applications view.
   - ✅ *(UI)* at least one top-level application is listed.
4. ☐ Switch the view dropdown to **Full inventory**.
   - ✅ *(UI)* the URL gains `macos_applications=false` (asserted inside `selectSoftwareView`).
   - ✅ *(UI)* the **N items** count **polls** to a value **strictly greater** than the Applications count — the strict-subset claim, and the headline assertion of this test. Polled rather than read once: Fleet keeps the previous view's rows under a translucent loading overlay for the whole round trip.
5. ☐ *(no user action)* derive a subject.
   - ✅ *(derived guard)* the full inventory lists a title the Applications view does not ("expected the full inventory to list something the Applications view does not").
6. ☐ Type that title into **Search by name or vulnerability (CVE)** (still under Full inventory).
   - ✅ *(UI)* its Name link is visible.
7. ☐ Switch the view back to **Applications**, search the same term.
   - ✅ *(UI)* the software table's `.empty-state` is visible.
   - ✅ *(UI)* its Name link has count 0 — the entry is reported by the host but is **not** a top-level application.
8. ☐ Search for the application captured in step 3.
   - ✅ *(UI)* its Name link is visible — so the empty result in step 7 is the filter at work and not a broken search.

**Assessment**
- *Value:* good. The claim is genuinely two-sided — a count inequality *plus* a named title that resolves in one view and not the other, plus a control search proving the narrowed view still finds things. Asserted as set membership rather than on fixed titles, and both subjects are searched for explicitly in each view, so the *searches* don't depend on which page a title lands on.
- *Coverage gaps:* the reverse membership is never asserted — that an application appears under **both** views (step 8 searches only under Applications); no Windows/Linux assertion that the dropdown is **absent**, so `selectSoftwareView`'s silent no-op branch stays unobserved on both tiers; the `.empty-state` **copy** is not asserted, only its presence; the view filter is never combined with the **Vulnerable** filter or with pagination; `macos_applications=true` on the way back is asserted inside the POM but not re-checked after the search.
- *Redundancy:* shares the file, the tab entry and `showFullInventory()` with HOST-04 — but HOST-04 runs against an API-chosen (simulated) host and this one against the VM, so the two never observe the same inventory. This test answers, for macOS only, the "which branch did `showFullInventory` take?" smell recorded against HOST-04.
- *Efficiency / smells:*
  - ⚠️ **The subject derivation is page-1-bound, and this is the test's real fragility.** `packageOnly` is the first *Full-inventory page 1* name absent from the *Applications page 1* names. If the VM ever reports more applications than one page holds, an application that sorts onto Applications page 2 is indistinguishable from a package, gets picked as the subject, and step 7's `.empty-state` assertion then **fails on correct product behaviour**. The searches are pagination-proof; the choice of subject is not. The spec's own header claims pagination-independence, which is true of the assertions and not of the derivation.
  - `expect.poll(() => hostDetails.softwareItemCount())` — `softwareItemCount()` **throws** on an unparseable count string rather than returning null, and a throw inside `expect.poll` is not retried away. In practice the count keeps its previous value under the loading overlay so it parses; the hazard is latent rather than live.
  - `.empty-state` is a raw class locator reached straight off `softwareTable` in the spec ([`host-software.spec.ts:115`](../../tests/e2e/shared/hosts/host-software.spec.ts)) rather than through the page object, which already owns `softwareRowOrEmpty()`.
  - Costs a second real-VM page load in a file whose other test deliberately avoids the VM.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOST-18 · Host details — the results-recency sorts keep reports awaiting results last

- **File:** [`playwright/tests/e2e/shared/hosts/host-reports-tab.spec.ts`](../../tests/e2e/shared/hosts/host-reports-tab.spec.ts)
- **Grep:** `npx playwright test -g "the results-recency sorts keep reports awaiting results last"`
- **Project:** premium + free (shared) · **Scopes:** n/a
- **Mode:** UI · **Isolation:** standalone; seeds one marker report and deletes it in `finally`. Second test in the file, independent of HOST-06.
- **Preconditions:** binds to **the real macOS VM** (`liveMacosHost`) but uses only its **host id** — ⚠️ nothing here needs a real device (same avoidable binding as HOST-06). What the tiers *do* differ on is what populates the partition:
  - **premium** — the instance furniture `pw-host-report-results` on the **VMs** fleet (see [HOSTP-09](03-hosts-premium.md)) keeps a fresh stored result for the VM, so the partition has something on both sides.
  - **free** — the partition is **trivially satisfied**: free has no report that can hold a stored result (no fleet to park a long-lived one on, and `cleanup-setup` wipes every global report), so all cards are "awaiting". What the test still proves there is that each sort reaches the server and keeps the host's reports listed.
- **Data created:** one global saved report `pw-hostsort-<ts>-<rand>-alpha` (`SELECT 1;`, no platform restriction → applies to every host); deleted in `finally`.

**Flow**

1. ☐ *(API setup)* `POST /queries` → the marker report.
2. ☐ Open `/hosts/:id` via URL, click the **Reports** tab.
   - ✅ *(UI)* URL ends in `/reports`; report cards **or** the "No reports scheduled" empty state have rendered.
3. ☐ *(no user action)* default state.
   - ✅ *(UI)* the sort dropdown's value reads **Newest results** — Fleet's default.
   - ✅ *(UI)* the seeded report's card is visible.
   - ✅ *(UI)* **partition invariant** (see below), under "Newest results".
4. ☐ Open the sort dropdown, pick **Oldest results**.
   - ✅ *(UI)* the URL contains `sort=oldest_results`.
   - ✅ *(UI)* the dropdown's value reads **Oldest results**.
   - ✅ *(UI)* the seeded card is still visible — so the re-sort narrowed nothing.
   - ✅ *(UI)* **partition invariant** again. This is the point of the test: **report cards awaiting results stay last under *both* recency sorts.** `order_direction=asc` on `last_fetched` still returns the dated report first — nulls do **not** float to the top. What is asserted is therefore a *partition* invariant, not a plain ordering one, and the relative order of the awaiting cards among themselves is explicitly **not** a contract.
5. ☐ Open the sort dropdown, pick **Newest results**.
   - ✅ *(UI)* the URL has **no** `sort` param at all (`not.toHaveURL(/sort=/)`) — **selecting "Newest results" removes the `sort` param rather than setting one**, because it is the default and `HostReportsTab.onSortChange` writes the default as `undefined`.
   - ✅ *(UI)* the dropdown's value, the seeded card, and the partition invariant, all again.
6. ☐ *(API teardown)* delete every report matching the marker.

**How the partition invariant is expressed.** Every rendered card is read in **one DOM pass** — `reportCardResultStates` ([`HostDetailsPage.ts:408`](../../pages/hosts/HostDetailsPage.ts)) returns `{name, hasResults}` per card, where `hasResults` is "the card rendered its Last updated / Last ran line", which `HostReportCard` emits only once `last_fetched` is set. The spec then asserts the boolean sequence **equals itself sorted descending**, i.e. every card with a stored result precedes every card without one — phrased that way so the assertion holds, and stays readable, whichever side is empty. One pass rather than two locator queries because the unfiltered tab is shared mutable state: sibling specs seed global reports that apply to this host too, so two passes can observe different card sets and pair a name with the wrong card's state.

**Assessment**
- *Value:* on premium this is a real product assertion that a naive ordering check would get wrong — it encodes that Fleet deliberately parks null-`last_fetched` cards at the bottom under both directions. The "default sort removes the param" assertion is the other genuinely useful half: it pins behaviour that looks like a bug from the URL alone.
- *Coverage gaps:* the **ordering among cards that *do* have results** — the actual recency claim — is never asserted. With a single dated report on the instance, `asc` and `desc` are indistinguishable, so a Fleet regression that ignored `order_direction` entirely would still pass. The "don't store results" toggle is still never flipped (HOST-06 leaves it at its default too). No empty-state path; no assertion reconciling the tab's `N reports` count with the number of cards read.
- *Redundancy:* shares the file, the host and the tab entry with HOST-06; the Name A-Z / Z-A sorts there and the recency sorts here drive the same control through the same POM method. A single test covering all four options would pay the page load once.
- *Efficiency / smells:*
  - ⚠️ **On free the headline assertion is vacuous** — an all-`false` sequence sorts to itself, so only the URL / dropdown-value / card-visibility checks carry weight there. The spec header says so honestly; worth deciding whether it should be premium-only rather than shared.
  - Uses the scarce `liveMacosHost` fixture for a host id (HOST-06's smell, repeated) — this file now takes the VM twice per run.
  - Reads the **unfiltered** list on purpose (the seeded report is awaiting results, and no test can seed a stored result inside its own lifetime), so the assertion's input is shared mutable state. The single-pass read mitigates the name/state mispairing, not the run-to-run variability in what is on the tab.
  - `not.toHaveURL(/sort=/)` also passes if the URL lost its whole query string for an unrelated reason — it asserts the absence of a param, not the presence of the default.
  - Depends, on premium, on furniture owned by a *different* area's spec (HOSTP-09's `pw-host-report-results`) with no guard of its own: if that report disappears, this test silently degrades to free's vacuous form instead of failing.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOST-19 · Shared • Hosts • Run script › a script changes the host, and a report run by that host reads the change back

- **File:** [`playwright/tests/e2e/shared/hosts/host-run-script.spec.ts`](../../tests/e2e/shared/hosts/host-run-script.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "a script changes the host, and a report run by that host reads the change back"` (`--project=free` for the free run)
- **Project:** premium + free (shared) · **Scopes:** n/a — the script and report go to whichever fleet the host is in, read off the host at run time (`requireRealHost` returns its `fleetId`): the **VMs** fleet on premium, Unassigned on free
- **Mode:** UI+API · **Isolation:** standalone; first of four independent tests in the describe (HOST-20…22 are the others). Budget 420s.
- **Preconditions:** **the real macOS VM is mandatory** — resolved with `requireRealHost(request, 'darwin')` ([`helpers/api/hosts.ts`](../../helpers/api/hosts.ts); `findOnlineHost(…, { kind: 'real' })` underneath), which throws *"… Check the darwin VM is powered on and enrolled."* if none is online. osquery-perf simulations never execute a script, so a run against one proves nothing. The VM runs its scripts **one at a time**, so this test can queue behind any other script spec (HOST-20…22, the batch runs in [CTL-24/25](11-controls-profiles-scripts-variables.md)) — the 180s script wait and 420s budget absorb that. Script execution must be on in organization settings (`cleanup-setup` guarantees it).
- **Data created:** per run, all named with a nonce (`<base36 ms><4 hex>`):
  - a report `pw-run-script-effect-<id>` — `SELECT sha256 FROM hash WHERE path = '/tmp/fleet-playwright-run-script-<id>';`, `platform: darwin`, **`interval: 60`**; **team-scoped to the VMs fleet on premium** (so only the VMs run it), **global on free** (where `cleanup-setup`'s `deleteAllQueries` would sweep it if the test died);
  - a library script `pw-run-script-effect-<id>.sh` — `printf '%s' '<id>' > <marker>; echo "wrote <id>"`;
  - on the VM, the file `/tmp/fleet-playwright-run-script-<id>` holding the nonce.
  All three are removed in `finally`: script and report via the API, the marker file by a fire-and-forget **ad-hoc** script (`queueAdHocScript` → `POST /scripts/run`, `rm -f <marker>`) whose result nobody checks. On premium, `cleanup-setup`'s VMs-fleet sweep also deletes `pw-` scripts and `pw-run-script-` reports left by a dead run. The script-run and ad-hoc-run **activities** stay in the feed permanently.

**Flow**

1. ☐ *(API setup)* `POST /queries` → the 60s report, created **first** so its schedule is already counting down while the script runs. Then `POST /scripts` (multipart) → the library script, with `fleet_id` omitted on free (free rejects `fleet_id=0`).
2. ☐ Open the VM at `/hosts/:id` via URL → ✅ *(UI)* **Disk space available** visible.
3. ☐ Click **Actions** → **Run script** (react-select option by exact text).
   - ✅ *(UI)* the `.run-script-modal` is visible and its table rendered (`RunScriptModal.expectOpen`).
   - ✅ *(UI)* the script's **Status** cell reads `---` — never run on this host (the name is new every run).
4. ☐ In the script's row, open the row **Actions** dropdown → **Run**.
   - ✅ *(UI)* the **Run script?** confirmation reads `<script> will run on <host display name>.`
5. ☐ Click **Run** in the confirmation.
   - ✅ *(UI)* success toast **"Script is running or will run when the host comes online."**; the list modal is visible again underneath.
6. ☐ *(wait — no user action)* the VM picks the script up on its next check-in and reports back.
   - ✅ *(API)* `GET /hosts/:id/scripts?per_page=100` → this script's `last_execution.status` polls to **`ran`** (3s interval, 180s budget; `getHostScriptLastExecution`). This is a *wait*, not the assertion: the modal only refetches its list after its own actions, so the settled status is read by reopening it (next step).
   - The **Upcoming** tab of the Activity card would briefly show the pending run here, but the VM picks it up within seconds, so the item is **not asserted anywhere** in the suite.
7. ☐ Click **Close** on the modal, then **Actions → Run script** again.
   - ✅ *(UI)* the script's Status cell reads **Ran**.
8. ☐ Row **Actions** → **Show run details**.
   - ✅ *(UI)* the `.run-script-details-modal` and its status line are visible (`ScriptDetailsModal.expectOpen`).
   - ✅ *(UI)* status line reads exactly **`Exit code: 0 (Script ran successfully.)`**.
   - ✅ *(UI)* the recorded output reads exactly `wrote <id>`.
9. ☐ Click **Close** on the details.
   - ✅ *(UI)* the script's Status cell **still reads Ran** — closing the details does not revert the row to "Pending". Then **Close** the Run script modal.
10. ☐ Reload `/hosts/:id` (fresh load), click the Activity card's **Past** tab.
    - ✅ *(UI)* the tab is `aria-selected="true"`.
11. ☐ Click the activity **"… ran the `<script>` script on this host."** (`activityCopy.script.ranOnThisHost`).
    - ✅ *(UI)* the same Script details modal opens; its output reads `wrote <id>`. **Close**.
12. ☐ Open the **Dashboard**.
    - ✅ *(UI)* the activity feed has **"… ran the `<script>` script on `<host display name>`."** (`activityCopy.script.ran`; `expectActivity` walks up to 15 pages and reloads up to 10 times for a late activity).
13. ☐ *(wait — no user action)* the VM runs the report on its 60s schedule and Fleet stores the row. Measured: the first row lands **~66s** after the report is created.
    - ✅ *(API)* `GET /hosts/:id/reports/:reportId` → first row's `sha256` polls to **SHA-256 of this run's nonce** (5s interval, 240s budget; `getHostReportRows`). Hashing a per-run nonce at a per-run path means a file left by an earlier run cannot satisfy it.
14. ☐ Reload `/hosts/:id`, click the **Reports** tab.
    - ✅ *(UI)* URL ends in `/reports`; cards or the empty state rendered (`openReportsTab`).
15. ☐ Type the report name into the Reports tab's **Search** box.
    - ✅ *(UI)* the report's card (exact `h3` name) is visible.
    - ✅ *(UI)* the card's inline first result — read in one DOM pass by `reportCardFirstResult` ([`HostDetailsPage.ts:529`](../../pages/hosts/HostDetailsPage.ts)) — **equals** `{ sha256: <expected hash> }` exactly (no other columns, no other value).
16. ☐ *(API teardown)* delete script, delete report, queue the ad-hoc `rm -f` on the VM.

**Assessment**
- *Value:* the strongest real-device test in the area and arguably in the suite. It proves the **effect** of a script, not that one was sent: the device writes a nonce, the *same device* reads it back through osquery on a schedule, and the Reports-tab card renders that exact hash. One flow crosses script execution, the Run script modal, the details modal from two entry points, the host Activity card, the dashboard feed and stored host report results — each tied to this run by the nonce.
- *Coverage gaps:* the **Upcoming** activity and the modal's **Pending** state are never observed (the VM is too fast — structurally hard to assert without a slow script); the Run script modal's script-**content** preview (the name button) is unused; no re-run of the same script (does the Status row and the history show two runs?); the dashboard-feed entry is never *clicked* (the feed opens the same details modal — a third entry point left untested); the host's Activity item is matched by name only, so its actor ("admin") is unasserted.
- *Redundancy:* shares the Run script modal steps (3–9) with HOST-20/21/22 via the spec-local `runFromModal`; the Reports-tab card read overlaps HOSTP-09 ([03](03-hosts-premium.md)) — but this is the only test that gets a stored result *inside its own lifetime*, which HOSTP-09 and HOST-18 both explicitly say can't be done cheaply. It can; it costs ~70s.
- *Efficiency / smells:*
  - The two long waits (script status, report rows) are API polls — justified: the modal doesn't refetch, and the host page has no live-updating surface for stored results. The UI then re-asserts both values, so nothing is validated *only* through the API.
  - Navigates by direct URL (`goto(host.id)`), not dashboard → Hosts → click-through as `playwright/CLAUDE.md` asks of e2e specs. Defensible for a host resolved by id, but it is a convention deviation.
  - **On free the report is global**, `platform: darwin`, every 60s — every darwin osquery-perf simulation on the free instance is scheduled to run it for the test's lifetime too. Whether the sims actually post results is unverified here, but free's MySQL is the box already pegged at ~100% memory; worth a look if free flakes cluster around this spec.
  - The marker cleanup is fire-and-forget and runs only from `finally` — a timed-out test (Playwright skips `finally` on timeout) leaves a few bytes in `/tmp` on the VM. Harmless, but it's the one piece of VM state nothing else sweeps.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOST-20 · Shared • Hosts • Run script › a script that exits non-zero reads as an error, with the output it recorded

- **File:** [`playwright/tests/e2e/shared/hosts/host-run-script.spec.ts`](../../tests/e2e/shared/hosts/host-run-script.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "a script that exits non-zero reads as an error"`
- **Project:** premium + free (shared) · **Scopes:** n/a (host's own fleet: VMs on premium, Unassigned on free)
- **Mode:** UI+API · **Isolation:** standalone; independent of HOST-19/21/22. Budget 300s.
- **Preconditions:** **the real Ubuntu VM** (`requireRealHost(request, 'linux')`, throws if none) — mandatory; a simulation never runs the script. Shares that VM's one-at-a-time script queue with HOST-21 and two HOST-22 variants.
- **Data created:** library script `pw-run-script-fails-<id>.sh` (`#!/bin/bash`, `echo "failing on purpose <id>"`, `exit 3`) on the host's fleet; deleted in `finally`. The run's activity stays in the feed.

**Flow**

1. ☐ *(API setup)* upload the script to the host's fleet.
2. ☐ Open the VM at `/hosts/:id` → **Actions → Run script**.
   - ✅ *(UI)* the modal is open; the script's Status cell reads `---`.
3. ☐ Row **Actions → Run** → confirmation reads `<script> will run on <host>.` → click **Run**.
   - ✅ *(UI)* toast **"Script is running or will run when the host comes online."**
4. ☐ *(wait)* ✅ *(API)* `last_execution.status` polls to **`error`** (180s).
5. ☐ **Close** the modal, reopen **Actions → Run script**.
   - ✅ *(UI)* the Status cell reads **Error**.
6. ☐ Row **Actions → Show run details**.
   - ✅ *(UI)* status line reads exactly **`Exit code: 3 (Script failed.)`** — the real exit code, not a generic failure.
   - ✅ *(UI)* the output reads exactly **`failing on purpose <id> script execution error: exit status 3`** — what the script printed, followed by the line **Orbit appends to recorded output** on a non-zero exit (`script execution error: exit status N`). `toHaveText` normalises the newline between them to a space.
7. ☐ **Close** the details, **Close** the modal.
8. ☐ Reload `/hosts/:id` → Activity card **Past** tab.
9. ☐ Click **"… ran the `<script>` script on this host."** — a failed run reads the same as a successful one in the activity list; only the details tell them apart.
   - ✅ *(UI)* the details modal opens with status line **`Exit code: 3 (Script failed.)`**. **Close**.

**Assessment**
- *Value:* pins the failure path end to end on both the modal and the Activity-card entry points, and the exact-output assertion pins Orbit's appended error line — a genuine contract that the effect test can't see.
- *Coverage gaps:* the dashboard feed is not checked here (HOST-19 covers the shape, and a failed run reads identically there — `activityCopy.script.ran` says so); the Activity-card details re-assert only the status line, not the output; no failure on macOS or Windows (only Linux/bash); no "script not found / interpreter missing" failure mode (which is what macOS Python would produce — see HOST-22).
- *Redundancy:* steps 2–5 are HOST-19's modal round trip again; the Activity-card entry point duplicates HOST-19 step 11 with a different status line.
- *Efficiency / smells:* hard-codes Orbit's error wording (`script execution error: exit status 3`) — correct and deliberate, but an Orbit copy change fails this spec with a product-side cause that has nothing to do with Fleet server; worth a comment pointing at the Orbit source. Direct-URL navigation, as HOST-19.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOST-21 · Shared • Hosts • Run script › a script that outlives the agent timeout is stopped, and the details say why

- **File:** [`playwright/tests/e2e/shared/hosts/host-run-script.spec.ts`](../../tests/e2e/shared/hosts/host-run-script.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "a script that outlives the agent timeout is stopped"`
- **Project:** premium + free (shared) · **Scopes:** n/a
- **Mode:** UI+API · **Isolation:** standalone, but **writes shared configuration**: it lowers `script_execution_timeout` to **60s** on the host's fleet's agent options — **the VMs fleet on premium, the global agent options on free** (free has no fleets) — and restores the snapshot in `finally`. Budget 360s.
- **Preconditions:** **the real Ubuntu VM** (`kind: 'real'`), mandatory. Why agent options at all: Fleet's default script timeout is **300s** and a host runs scripts one at a time, so a script sitting out the default would block every other spec's script on that VM for five minutes. The lowered value reaches the host in the same orbit config poll that delivers the pending script, so it is in force for this run. While lowered it also caps software uninstalls on those hosts (all finish well inside 60s) — and **on free, the global write applies to every host on the instance**, the ~300 simulations included.
- **Data created:** library script `pw-run-script-timeout-<id>.sh` (`echo "started <id>"; sleep 180; echo "finished <id>"`), deleted in `finally`; the agent-options write, restored in `finally`. The snapshot logic drops a `script_execution_timeout` that already equals 60 rather than restoring it — only an earlier run of this test that died before `finally` (or a concurrent `--repeat-each` copy) can have left that value, and restoring it would strand the lowered timeout.

**Flow**

1. ☐ *(API snapshot)* read agent options — `GET /fleets/:id` → `fleet.agent_options` on premium, `GET /config` → `agent_options` on free (`getAgentOptions`). Upload the script.
2. ☐ *(API setup)* write the snapshot back with `script_execution_timeout: 60` — `POST /fleets/:id/agent_options` (premium) or `PATCH /config { agent_options }` (free). Both replace the **whole document**, which is why a full snapshot is passed. *Manually:* **Settings → Organization settings → Agent options** (free) or **Settings → Fleets → VMs → Agent options** (premium), add a top-level `script_execution_timeout: 60` (a sibling of `config:`), Save — and put the original back afterwards.
3. ☐ Open the Ubuntu VM at `/hosts/:id` → **Actions → Run script** → ✅ *(UI)* Status `---` → row **Actions → Run** → confirm → ✅ *(UI)* toast "Script is running or will run when the host comes online."
4. ☐ *(wait)* ✅ *(API)* `last_execution.status` polls to **`error`** (**240s** budget — shorter than the 300s default timeout, so if the lowered value had *not* reached the host the kill would come too late and this wait would fail; that is the only thing that ties the test to the configured value, see below).
5. ☐ **Close**, reopen **Actions → Run script** → ✅ *(UI)* Status reads **Error**.
6. ☐ Row **Actions → Show run details**.
   - ✅ *(UI)* status line reads exactly **`Error: Timeout. Fleet stopped the script to protect host performance.`** — **with no duration.** `RunScriptDetailsModal` fills in "after N seconds" only when it finds that phrase in the script's **output**, never from the configured timeout, so for this script the line carries none. The script's output is kept free of the word "seconds" so the copy stays fixed. **`TODO(fleetdm/fleet#54262)`** in the spec: once the modal reads the server's message, the line becomes "…after 60 seconds…" and the assertion should include `timeoutSeconds`.
   - ✅ *(UI)* output reads exactly **`started <id> script execution error: signal: killed`** — what printed before the `sleep` is kept, `finished <id>` never ran, and **Orbit appends `signal: killed`** for the kill.
7. ☐ *(API teardown)* restore the agent-options snapshot; delete the script.

**Assessment**
- *Value:* the only coverage of Fleet's script timeout, and the output assertion is precise in the right way — it proves the script was killed mid-run (before, not after, the `sleep`) rather than merely failing. The snapshot-restore is careful about its own leftovers.
- *Coverage gaps:* **the configured timeout value itself is never asserted on screen** — blocked by fleetdm/fleet#54262 (the modal can't show it); until then the 60s is proven only indirectly, by the 240s wait being shorter than the 300s default. A slow queue that pushed pickup past ~180s would blur that. No check that the Activity card or feed distinguishes a timeout (they don't — worth a line saying so). No macOS/Windows timeout. The agent-options UI is never touched (setup is API).
- *Redundancy:* modal round trip shared with HOST-19/20/22.
- *Efficiency / smells:*
  - ⚠️ **The restore lives only in `finally`, with no `afterEach`.** Playwright aborts a timed-out test before its `finally` runs (see README → "Things the audit's own conclusions should absorb"), so a timeout here leaves the 60s cap in place — on free, **globally** — until the *next* run of this test drops it. Every script and uninstall on those hosts in between runs under the lowered cap. ~~`cleanup-setup` does not reset agent options.~~ **Partly fixed 2026-09-28:** the "bring the real VMs to their resting state" step in `cleanup.steps.ts` removes a `script_execution_timeout` override from the VMs fleet's agent options (premium) or the global ones (free) at the start and end of every run, so a timed-out run's cap lasts until that run's `cleanup-teardown` at most. The in-test restore is still `finally`-only.
  - On premium the VMs fleet's agent options are gitops-declared (`agent_options: path: ../../lib/agent-options.yml` in `gitops/premium-fleetqa/fleets/vms.yml`); the test's write is invisible to gitops and would be overwritten by a concurrent apply (and vice versa) — which the CI workflows now prevent: Playwright and the nightly apply share one concurrency group per tier (2026-09-28).
  - Costs ~60–70s of real wall-clock on the Linux VM's single script queue by design.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOST-22 · Shared • Hosts • Run script › a `<interpreter>` script runs under `<interpreter>` — zsh · bash · Python · PowerShell

- **File:** [`playwright/tests/e2e/shared/hosts/host-run-script.spec.ts`](../../tests/e2e/shared/hosts/host-run-script.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "Run script › a .* script runs under"` (one variant: `-g "a Python script runs under Python"`)
- **Project:** premium + free (shared) · **Variants (4, one `for` loop):**

  | Variant | VM | File | Content | Output must match |
  |---|---|---|---|---|
  | zsh | **macOS** | `.sh` | `#!/bin/zsh` · `echo "zsh $ZSH_VERSION"` | `/^zsh \d+\.\d+/` |
  | bash | **Ubuntu** | `.sh` | `#!/bin/bash` · `echo "bash $BASH_VERSION"` | `/^bash \d+\.\d+/` |
  | Python | **Ubuntu** | `.py` | `#!/usr/bin/env python3` · prints `python <major>.<minor>` | `/^python 3\.\d+/` |
  | PowerShell | **Windows** | `.ps1` | `Write-Output "powershell $($PSVersionTable.PSVersion)"` | `/^powershell \d+\.\d+/` |

- **Mode:** UI+API · **Isolation:** four independent tests; budget 300s each.
- **Preconditions:** one **real VM per variant** (`requireRealHost(request, platform)`), mandatory. **Python runs on Linux on purpose:** the macOS VMs have no Xcode Command Line Tools, so `/usr/bin/python3` there is Apple's install-prompt stub and exits non-zero. This is the only test in the area that uses the **Windows** VM for execution.
- **Data created:** one library script `pw-run-script-<label>-<id><ext>` per variant on the host's fleet; deleted in `finally`.

**Flow** (per variant)

1. ☐ *(API setup)* upload the script.
2. ☐ Open the variant's VM at `/hosts/:id` → **Actions → Run script** → ✅ *(UI)* Status `---` → row **Actions → Run** → confirm → ✅ *(UI)* toast "Script is running or will run when the host comes online."
3. ☐ *(wait)* ✅ *(API)* `last_execution.status` polls to **`ran`** (180s).
4. ☐ **Close**, reopen → ✅ *(UI)* Status **Ran**.
5. ☐ Row **Actions → Show run details**.
   - ✅ *(UI)* status line **`Exit code: 0 (Script ran successfully.)`**.
   - ✅ *(UI)* output matches the variant's regex. Each script prints **its own interpreter's version variable**, which is empty (or a syntax error) under any other shell — so the output proves *which* interpreter ran, not just that something exited 0. E.g. `$ZSH_VERSION` is unset under `/bin/sh`, so a zsh script run by sh prints `zsh ` and fails the regex.

**Assessment**
- *Value:* good design — the version-variable trick makes each row falsifiable against "Fleet ran it under the wrong interpreter", which is the actual regression risk for shebang handling.
- *Coverage gaps:* no Python on macOS (environmental — the stub; worth a note that a CLT-equipped VM would unlock it); no `.sh` without a shebang (Fleet's default `/bin/sh` path on macOS vs Linux), no `#!/bin/sh` row at all; no Windows `.bat`/`.cmd` rejection; the Activity card and feed are not checked (HOST-19 covers them).
- *Redundancy:* four copies of the same modal round trip, plus HOST-19/20/21's. The loop could run all four uploads up front and poll them together, but the VMs execute serially anyway, so the saving would be navigation only.
- *Efficiency / smells:* the regexes anchor at `^` but not `$`, so trailing noise is tolerated — fine for a version string. Direct-URL navigation, as HOST-19.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOST-23 · Shared • Hosts • a custom MDM command is acknowledged by the host and reported everywhere Fleet shows it

- **File:** [`playwright/tests/e2e/shared/hosts/mdm-commands.spec.ts`](../../tests/e2e/shared/hosts/mdm-commands.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "a custom MDM command is acknowledged by the host"`
- **Project:** premium + free (shared) — free and premium send custom commands the same way and render the same Activity card, toggle and details modal with the same copy · **Scopes:** n/a
- **Mode:** UI+API (+CLI) · **Isolation:** standalone, no describe. Budget 240s.
- **Preconditions:** **the real macOS VM** (`requireRealHost(request, 'darwin')`, which throws if none is online) — ✅ *(API)* found, and ✅ *(API)* its `mdm.enrollment_status` (`GET /hosts/:id`, `getHostMdmIdentity`) starts with **`On`**. An MDM-enrolled *simulation* never acknowledges anything, so the enrollment check alone would not be enough — `kind: 'real'` is what excludes them. The `fleetctl` binary must be on `PATH` (or `FLEETCTL_BIN`); it runs against an isolated per-suite config (`helpers/fleetctl.ts`), not `~/.fleetctl`.
- **Data created:** a `UserList` MDM command in the VM's command history and its activity (both permanent — commands can't be withdrawn); the payload file under the test's output dir. **`UserList` is read-only** — it asks the Mac to list local users and changes nothing. Anything sent to a real VM must be (see `playwright/CLAUDE.md` → Test hosts).

**Flow**

1. ☐ *(CLI)* Write the plist (`<key>RequestType</key><string>UserList</string>`) to a file and run `fleetctl mdm run-command --payload <file> --hosts <hostname>`.
   - ✅ *(CLI)* exit code 0.
   - ✅ *(CLI)* stdout contains **"Hosts will run the command the next time they check into Fleet."**
   - ✅ *(CLI)* stdout carries the results hint `fleetctl get mdm-command-results --id=<uuid>` — the **command UUID** is parsed out of it and ties every later view to *this* command.
2. ☐ *(CLI, wait)* `fleetctl get mdm-command-results --id=<uuid>` until **STATUS** reads **`Acknowledged`** (5s interval, 180s — the VM answers in seconds but only on its next MDM check-in).
   - ✅ *(CLI)* the results also show **TYPE** `UserList` and **HOSTNAME** `<hostname>`.
3. ☐ Open the VM at `/hosts/:id` → Activity card **Past** tab → make sure **Show MDM commands** is **off** (`showMdmCommands(false)` clicks the switch only if needed, then asserts `aria-checked="false"`).
4. ☐ Click the first **"… ran UserList as a custom MDM command on this host."** activity.
   - ✅ *(UI)* the `.command-details-modal` opens with its request payload visible.
   - ✅ *(UI)* its status line matches that same sentence (`activityCopy.mdmCommand.ranOnThisHost`).
   - ✅ *(UI)* **Request payload** textarea contains `<string>UserList</string>` … `<key>CommandUUID</key><string><uuid></string>` — this run's command, not an earlier identical one (the `.first()` pick is safe because a wrong pick fails here rather than passing).
   - ✅ *(UI)* **Response from `<hostname>`** textarea contains `<string><uuid></string>` followed by `<key>Status</key><string>Acknowledged</string>`. **Close**.
5. ☐ Turn **Show MDM commands** **on**.
   - ✅ *(UI)* the "ran UserList as a custom MDM command on this host." activity is **gone** (count 0) — the switch swaps the feed wholesale from activities to commands.
6. ☐ Click the first **"The UserList command was acknowledged."** item (`activityCopy.mdmCommand.acknowledged`, anchored at `^`).
   - ✅ *(UI)* status line contains **"The UserList command was acknowledged by `<hostname>`"**.
   - ✅ *(UI)* the same payload + response UUID checks as step 4. **Close**.
7. ☐ Click the **Upcoming** tab (switch still on).
   - ✅ *(UI)* no item matching `^The UserList command is pending\.` — acknowledged means no longer upcoming. (The *pending* state itself is never observed: the VM acknowledges within seconds, so the Upcoming item is not asserted positively anywhere.)
8. ☐ *(API)* the activity log has a `ran_custom_mdm_command` activity whose `command_uuid` is this command's (`findActivity`; its actor is the API user `fleetctl` signs in as, so the admin-actor check of `assertActivity` doesn't apply).
9. ☐ Open the **Dashboard** → activity type filter → **Ran custom MDM command**.
   - ✅ *(UI)* the filtered feed shows **"… ran UserList as a custom MDM command on `<host display name>`."** (`activityCopy.mdmCommand.ran`), read straight from the filtered feed (a reload would drop the filter).
   - Click it → ✅ *(UI)* the `.command-details-modal` opens; its status line contains **"ran UserList as a custom MDM command on `<hostname>`."**; the same payload + response UUID checks as step 4. **Close**.

**Assessment**
- *Value:* high. The only test that sends an MDM command to a real device and reads the **device's answer** back — through the CLI, both Activity-card views, and the feed filtered to its type — with every view pinned to the command by UUID. It also covers the **Show MDM commands** toggle, which nothing else touches. Choosing a read-only command is exactly right for a VM that can't be rebuilt.
- *Coverage gaps:* the command is sent via **CLI only** — the UI has no custom-command sender, so that is inherent, but `POST /commands/run` and the `GET /commands/results` API are not asserted directly either; the **response body's content** (the user list itself) is never checked beyond the Acknowledged status — asserting it contains a known local username would prove the device actually *executed* UserList; no Error/NotNow response path; `fleetctl get mdm-commands` (the list view) untested; Windows MDM commands (SyncML) untested although the Windows VM is enrolled.
- *Redundancy:* the CLI steps overlap area 19's `fleetctl mdm` coverage ([19-fleetctl-cli.md](19-fleetctl-cli.md)) — but those can't reach a real device's acknowledgement, so this is complementary.
- *Efficiency / smells:*
  - The dashboard row is pinned by UUID too: the feed is filtered to the type, the newest row for a `UserList` on this host is opened, and its modal must carry this command. The filter keeps the row near the top however much the other workers logged during the acknowledgement wait, which an unfiltered feed walk used to lose.
  - Step 7 is an absence-only check against a tab whose contents aren't otherwise waited on — `showUpcomingActivities` asserts the tab is selected, not that its list rendered, so it can pass on a still-loading panel.
  - `CommandUUID` is matched by a regex over the payload textarea with `s` (dotall) — fine, but it depends on Fleet echoing the UUID into the rendered payload, which is Fleet's own injection, not what the test sent.
  - Direct-URL navigation to the host.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOST-24 · Free • Hosts • IdP username › Add user opens the Fleet Premium message instead of the IdP field

- **File:** [`playwright/tests/e2e/free/hosts/host-idp-username.spec.ts`](../../tests/e2e/free/hosts/host-idp-username.spec.ts)
- **Grep:** `npx playwright test --project=free -g "Add user opens the Fleet Premium message"`
- **Project:** free only · **Mode:** UI · **Isolation:** standalone, read-only — nothing is saved
- **Preconditions:** an online **non-MDM simulated** Windows host on the free instance (`findSimulations(request, 'windows', 1, 0)`); any host would do for a read-only check, and a simulation keeps it off the free VMs in Unassigned. The host must have no IdP username — on free none can be set ([API-31](14-api-contracts.md)), and a non-MDM simulation reports no IdP account of its own.
- **Data created:** none

**Flow**

1. ☐ *(API setup)* Resolve the host.
   - ✅ *(API)* a host was resolved (`toBeDefined`).
2. ☐ Open the host at `/hosts/:id` **via URL**.
   - ✅ *(UI)* **Disk space available** visible (`HostDetailsPage.goto` anchor).
   - ✅ *(UI)* the **User** card's **Username (IdP)** reads `---`.
   - ✅ *(UI)* the card's button reads **Add user** — offered on free too: the button is gated by role, not tier.
3. ☐ Click **Add user**.
   - ✅ *(UI)* the modal titled **Add user** is open.
   - ✅ *(UI)* it shows "This feature is included in Fleet Premium".
   - ✅ *(UI)* there's no **Username (IdP)** field (count 0).
   - ✅ *(UI)* there's no **Save** button (count 0).

**Assessment**
- *Value:* the free half of the IdP-username pair ([HOSTP-13](03-hosts-premium.md) on premium), and the right shape for a paywall that sits behind a button rather than on a page: the modal's title proves it opened, so the two absences can't pass on a modal that never rendered. Catches the field leaking onto free, and the button disappearing — which would lose the upsell Fleet shows it for.
- *Coverage gaps:* the modal is never closed; the Premium message's link is unchecked; only the global admin — whether a free **observer** is offered the button (it shouldn't be, by `canWriteEndUser`) is untested on free; the API refusal lives in [API-31](14-api-contracts.md), not here.
- *Redundancy:* complements [MISC-20](13-labels-packs-dashboard-paywalls.md)'s page-level paywall sweep — this gate isn't a page, so it couldn't be a row in that table. Mirrors HOSTP-13's steps 3–4 with the inverted answer, which is the justified kind of tier duplication (like HOST-12/13/14).
- *Efficiency / smells:* draws Windows slice 0 on free — the same host as API-31; `findSimulations`' slice list in `helpers/api/hosts.ts` records the shared read. Harmless while both only read or get refused; if API-31's gate ever regressed, its `PUT` would leave a username on this host and fail the `---` check here too. Direct-URL entry to the host, like the rest of the area's host-detail tests.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOST-25 · Host details — reports that don't store results show only with the toggle on

- **File:** [`playwright/tests/e2e/shared/hosts/host-reports-tab.spec.ts`](../../tests/e2e/shared/hosts/host-reports-tab.spec.ts)
- **Grep:** `npx playwright test -g "reports that don't store results show only with the toggle on"`
- **Project:** premium + free (shared) · **Mode:** UI+API (API setup only) · **Isolation:** standalone; the Mac VM (`liveMacosHost`) is only read
- **Preconditions:** the org-wide **Store report results** is on (the toggle is hidden otherwise); the suite never turns it off.
- **Data created:** two global reports, `pw-hostrpt-<ms>-<rand>-stores` and `…-discards` (Discard data on), deleted in the `finally`; cleanup wipes global reports too.

**Flow**

1. ☐ *(API)* Create the two reports.
2. ☐ Open the Mac's **Reports** tab; search for the marker.
   - ✅ *(UI)* **Show reports that don't store results** is off; the storing report is listed and the discarding one isn't.
3. ☐ Turn the toggle on.
   - ✅ *(UI)* It reads on; the URL has `show_dont_store=true`; both reports are listed.
4. ☐ Turn it off again.
   - ✅ *(UI)* It reads off; the storing report is listed and the discarding one isn't.

**Assessment**
- *Value:* the toggle's filtering, which HOST-06 only read at its default: off lists only reports that keep results (`discard_data = 0` with snapshot logging, `query_results.go`), on adds the rest. The storing sibling keeps every state a positive read of the same filtered list.
- *Coverage gaps:* only Discard data; a report with a non-snapshot logging type (differential) is the other kind the toggle hides. The report count (+1) isn't asserted: every sibling spec's global reports move it.
- *Redundancy:* shares HOST-06's search and card locators.
- *Efficiency / smells:* seconds. The two reports have no interval, so neither ever runs on the VM.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOST-26 · Free • Hosts • Actions by role › <global-maintainer | global-observer> is offered the host actions its role grants

- **File:** [`playwright/tests/e2e/free/hosts/host-actions-role-access.spec.ts`](../../tests/e2e/free/hosts/host-actions-role-access.spec.ts)
- **Grep:** `npx playwright test --project=free -g "Free • Hosts • Actions by role"`
- **Project:** free · **Variants (2):** `global-maintainer`, `global-observer` · **Host:** an online Linux simulation, by id (the free real VMs share Unassigned)
- **Mode:** UI · **Isolation:** one test per role; nothing runs or moves
- **Preconditions (API):** reports `pw-role-hostrep-<role>-<nonce>-observers` (*Observers can run*) and `…-others`, deleted in an `afterEach`.

**Flow**

1. ☐ Log in → the host's details → **Actions**.
   - ✅ *(UI)* **Live report**; **Run script** and **Delete** for GM only; **Transfer** for neither (no fleets on free).
2. ☐ **Live report** → filter by the marker.
   - ✅ *(UI)* `…-observers` listed; `…-others` and the **create a report** link for GM only. **Close**.

**Assessment**
- *Value:* free's half of HOSTP-20.
- *Efficiency / smells:* seconds.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

### HOST-27 · Free • Hosts • a host's Software tab is its inventory alone, with no Library

- **File:** [`playwright/tests/e2e/free/hosts/host-software-tab.spec.ts`](../../tests/e2e/free/hosts/host-software-tab.spec.ts)
- **Grep:** `npx playwright test --project=free host-software-tab`
- **Project:** free · **Host:** any online Linux simulation (`findOnlineHost(…, 'linux', { kind: 'simulated' })`), read only
- **Mode:** UI · **Isolation:** standalone

**Flow**

1. ☐ Open the host's details → **Software**.
   - ✅ *(UI)* the inventory renders: rows or its empty state, and **Search by name or vulnerability (CVE)**.
   - ✅ *(UI)* no **Library** tab and no **Inventory** tab: free's Software card has no sub-tabs (`showSoftwareLibraryTab = isPremiumTier`).

**Assessment**
- *Value:* The tier gate on the host Library, which no free spec read (premium's side is [SWH-16](21-software-on-hosts.md)); the search box is the positive control that the tab rendered before the absences are checked.
- *Coverage gaps:* None worth adding: free has nothing to install.
- *Efficiency / smells:* Seconds.

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
| **User** card (host end user / IdP username) | HOST-24 (free: *Add user* opens the Premium message) | premium add / edit / remove is area 03 (HOSTP-13…15); the free observer's view of the button; the modal's close path |
| Host software tab | HOST-04, HOST-17 | Vulnerable filter, CVE search, Library sub-tab, self-referential hosts-list check missing; the macOS Applications/Full-inventory filter is covered (HOST-17) but the *absence* of that dropdown on Windows/Linux is not |
| Host reports tab | HOST-06, HOST-18 | "don't store results" toggle behaviour and card Actions untested; the Newest/Oldest sorts are covered only as an "awaiting results sorts last" partition, so the recency ordering itself is unasserted (and vacuous on free) |
| Host live report | HOST-05 | Stop/cancel, Errors tab, results CSV, 0%-responded path |
| Host Actions menu | HOST-12/13/14 (presence/absence only); **Run script** fired by HOST-19…22 on both tiers | Transfer/Delete from details on free untested; Lock/Wipe/Unlock **commands never fired** (deliberate: never on a real VM, availability asserted instead); Run script's *disabled* state is covered by [CTL-26](11-controls-profiles-scripts-variables.md) |
| Run script on a host (modal → run → details) | HOST-19 (effect, read back by a report), HOST-20 (non-zero exit), HOST-21 (timeout), HOST-22 (zsh / bash / Python / PowerShell) | Pending / Upcoming state never observed; no re-run; script-content preview unused; configured timeout value unassertable until fleetdm/fleet#54262; no Python on macOS (no Xcode CLT on the VMs) |
| Custom MDM command | HOST-23 (`UserList` via `fleetctl`, read back on both Activity-card views + feed) | response *content* unchecked; no Error/NotNow path; no Windows command; the dashboard assertion is not tied to this run's UUID |
| Host policies tab | — | **not covered** in this area (`policiesTab` locator exists, unused) |
| Host activity card | HOST-19, HOST-20 (Past → script run → details modal), HOST-23 (Past, **Show MDM commands** toggle, Upcoming) | the **Upcoming** tab is only ever asserted *empty* (HOST-23) — a queued item is picked up within seconds, so no spec sees one; no pagination; empty state (`activityEmptyState`) unused |
| Host certificates card (Details tab) | HOST-15, HOST-16 | Issued/Expires columns compared to nothing; no Windows host; no user-scope certificate; no "host reports none → no card" negative; My-device copy of the card untested |

**Duplication**

1. **HOST-01/02/03** — three tests, one file, same real VM, three separate `goto(liveMacosHost.id)` page loads. Independent concerns, so the split is defensible for failure attribution, but the VM round-trips are paid three times and all three share the same fixture-precondition failure mode.
2. **HOST-10/11 vs `premium/hosts/cta-visibility.spec.ts`** — the observer test is byte-identical across tiers and the admin case is a subset of the premium role loop. These CTAs have **no license gate**, so there is no tier matrix to express: this is straight duplication. (Contrast HOST-12/13/14, where the inversion is the whole point.)
3. **Export hosts button** — visibility asserted in HOST-10, HOST-11 and both premium CTA tests; clicked only in HOST-08.
4. **Report seeding** — HOST-05 and HOST-06 each create global marker reports via `POST /queries` and clean up with `deleteReportsMatching`; the reports area does the same again. Consistent pattern, worth a shared `disposableReport` fixture.
5. **`findOnlineHost(..., { kind: 'real' })`** is invoked by HOST-12 and HOST-13 directly and by the `liveMacosHost` fixture for HOST-01/02/03/05/06/15/16/17/18 — nine tests on essentially the same machine per run, per tier. Only HOST-01/02/03/15/16/17 genuinely need a real device; HOST-05, HOST-06 and HOST-18 take it for a host id or a display name. HOST-19…23 add **execution** load on top: the macOS VM takes HOST-19, HOST-23 and the zsh variant; the Ubuntu VM takes HOST-20, HOST-21 and two HOST-22 variants; the Windows VM takes PowerShell — and all three also take the batch runs in [CTL-24/25](11-controls-profiles-scripts-variables.md). A host runs scripts **one at a time**, so these queue behind each other (HOST-21 alone holds the Ubuntu queue ~60s), which is why their waits run to 180–240s. Contention on the VMs is now the area's biggest scheduling cost.

**UI-vs-API balance**

Healthy overall — 22 of 24 entries validate through the browser, and the two API assertions that carry weight are both *justified* rather than shortcuts:

- **HOST-01** uses `GET /hosts/:id → detail_updated_at` to prove the "Last fetched less than a minute ago" text followed from *this* refetch. There is no UI-only way to distinguish that from a background detail cycle, so the API check is the assertion, not a shortcut.
- **HOST-09** compares the downloaded enroll-secret file against `GET /spec/enroll_secret`. Correctness here *is* a value-match against server state; the UI cannot self-verify it.

HOST-15/HOST-16 sit between the two: the API read is the **source of the expected values** (which certificates, with which issuer and scope), and the only assertion made on it is the precondition guard `total > 0`. That is the right shape for a table whose contents rotate with every VM re-provision — the alternative, fixed certificate names, would go stale on the next re-enrollment.

HOST-19…23 use the API (and, in HOST-23, `fleetctl`) as **the clock**: the script-status poll, the report-rows poll and the `mdm-command-results` poll are waits for a real device, because the UI surfaces don't refetch on their own. Each waited-for value is then re-asserted in the UI (Status cell, details modal, report card, both Activity-card views), so none of them validates *only* through the API. HOST-23's CLI assertions are a surface in their own right, not a shortcut.

API use elsewhere is **precondition/setup only** (host resolution, report seeding, teardown) — which is the right shape. No test in this area substitutes an API read for a UI assertion it could have made. The opposite problem exists instead: several UI assertions are weaker than they need to be (see quick wins 1 and 2), and the **absence-only** assertions in HOST-13/HOST-14 have no API counterpart proving the gate is enforced server-side (a `402` probe on `POST /hosts/:id/lock` in `tests/api/free/endpoints.spec.ts` would close that, and that file currently has no host/lock probes).

**Quick wins**

1. Add `withUsers: true` and `withOrbit: true` to the `liveMacosHost` fixture ([`fixtures.ts:256`](../../fixtures.ts)) — turns HOST-02's and HOST-03's data-luck failures into clear precondition errors and removes the unsafe `orbitVersion!` at [`host-details-smoke.spec.ts:76`](../../tests/e2e/shared/hosts/host-details-smoke.spec.ts).
2. Strengthen HOST-08: search the hosts list for the first host's name before exporting, then assert the CSV has a header row + exactly one data row and the expected column names ([`export-csv.spec.ts:20`](../../tests/e2e/shared/hosts/export-csv.spec.ts)).
3. Repoint HOST-06 **and HOST-18** off `liveMacosHost` to any online host ([`host-reports-tab.spec.ts`](../../tests/e2e/shared/hosts/host-reports-tab.spec.ts)) — one needs a display name and the other a host id, and this frees the real VM for the six tests that genuinely need it.
4. Add one positive option assertion (e.g. **Transfer** present) to HOST-13 and HOST-14 ([`mdm-actions-availability.spec.ts:72`](../../tests/e2e/free/hosts/mdm-actions-availability.spec.ts)) so the all-absent cases can't pass on a half-rendered menu.
5. In HOST-04, replace the filter-pill `firstToken` substring check with the full title text, and assert the filtered hosts list actually contains the host the test drilled from ([`host-software.spec.ts:55`](../../tests/e2e/shared/hosts/host-software.spec.ts)).
6. Harden HOST-15's two row assertions ([`host-certificates.spec.ts:66-67`](../../tests/e2e/shared/hosts/host-certificates.spec.ts)): guard the issuer against `''` before asserting it (`toContainText('')` always passes), and read **Scope** out of its own cell instead of matching `System`/`User` anywhere in the row. Both are one-line changes and both currently admit a silent pass.
7. Make HOST-17's subject derivation pagination-proof ([`host-software.spec.ts:102`](../../tests/e2e/shared/hosts/host-software.spec.ts)) — pick `packageOnly` from a *searched* Full-inventory result rather than from page 1, or assert first that the Applications view is a single page. As written, a VM that grows past one page of applications fails the test on correct product behaviour.
8. Give HOST-21's agent-options restore an `afterEach` twin ([`host-run-script.spec.ts:320`](../../tests/e2e/shared/hosts/host-run-script.spec.ts)) — Playwright skips `finally` on a test timeout, and on free the stranded 60s cap is **global**. Alternatively have `cleanup-setup` drop a `script_execution_timeout` of 60 the way it re-enables script execution.
9. ~~Tie HOST-23's dashboard assertion to this run~~ — done: the feed is filtered to *Ran custom MDM command*, and the row's modal is checked for this command's UUID.

**Bigger bets**

1. **Collapse the CTA-visibility duplication.** Fold the free admin case into the premium spec's role loop and keep a single tier-agnostic role matrix (admin/maintainer/observer/observer+) under `shared/hosts/`, since none of these CTAs is license-gated. Removes 2 free tests and adds the two missing roles.
2. **Cover the hosts-list filter surface.** `StatusFilter`, `LabelFilter`, `PlatformDropdown` and `Pagination` are all built and unused by this area — one `shared/hosts/list-filters.spec.ts` (status × platform × label, each asserting the row count/URL param changes and the filter pill) would close the largest single gap in the area, and it runs happily against the sim fleet.
3. **Cover the Add hosts fleetd path.** The Advanced/plain-osquery branch is tested while the default fleetd tab — the one nearly every real enrollment uses — is not. Add the platform tabs, the copyable install command, and (premium) a team-scoped enroll-secret assertion via `getTeamEnrollSecrets`.
