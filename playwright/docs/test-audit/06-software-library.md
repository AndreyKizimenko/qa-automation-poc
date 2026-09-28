# Software library & packages — test audit

**Specs covered:** 5 files · **Test declarations:** 15 (→ 56 runtime tests after parameterisation) · **Projects:** premium / free

This area covers everything an admin *adds* to Fleet's software library — custom
packages (`.pkg` / `.msi` / `.deb`), Fleet-maintained apps (FMA), Apple VPP apps and
Managed Google Play (Android) apps — plus the `/software/library` list, the
title-detail installer accordion, the Edit-package modal, the Unassigned ("no
teams") software views, and role/scope gating on the **Automations** button.
`library.spec.ts` is the lifecycle workhorse: a double loop (2 scopes × 7 add
cases) around a serial `add → delete → activity feed` describe, i.e. 42 of the
56 runtime tests in this area. `edit-package.spec.ts` is the only in-UI edit
round-trip; the other three files are thin gating/scoping specs.

**Standing fact that shapes this whole area:** nothing here ever installs software
on a host. The premium/free QA hosts are osquery-perf **simulations**, so an
install/uninstall command has nothing to execute against, and the one real
MDM-enrolled macOS VM (`liveMacosHost`) is not used by any software spec. Every
assertion is "the installer is in the library / catalog / activity feed", never
"the bits landed on a machine".

## Contents

| ID | Spec | Test | Mode | Manual? |
|---|---|---|---|---|
| SWL-01 | `premium/software/library.spec.ts` | Software library lifecycle › add | UI+API | ☐ |
| SWL-02 | `premium/software/library.spec.ts` | Software library lifecycle › delete | UI+API | ☐ |
| SWL-03 | `premium/software/library.spec.ts` | Software library lifecycle › activity feed shows add → delete | UI | ☐ |
| SWL-04 | `premium/software/library.spec.ts` | Software — add-software gating › Add software is disabled under All fleets, with a tooltip | UI | ☐ |
| SWL-05 | `premium/software/edit-package.spec.ts` | Software edit — custom package self-service (Unassigned) › add | UI+API | ☐ |
| SWL-06 | `premium/software/edit-package.spec.ts` | … › edit — enabling Self-service persists | UI+API | ☐ |
| SWL-07 | `premium/software/edit-package.spec.ts` | … › delete | UI+API | ☐ |
| SWL-08 | `premium/software/edit-package.spec.ts` | … › activity feed shows add → edit → delete | UI | ☐ |
| SWL-09 | `premium/software/no-teams-views.spec.ts` | Unassigned scope persists across Inventory, OS, and Vulnerabilities | UI | ☐ |
| SWL-10 | `premium/software/no-teams-views.spec.ts` | drilling into a title shows its detail page with no "Add software" action | UI | ☐ |
| SWL-11 | `premium/software/manage-automations-access.spec.ts` | global admin can open the Manage automations modal on All fleets | UI | ☐ |
| SWL-12 | `premium/software/manage-automations-access.spec.ts` | global admin: Automations button is disabled on a specific fleet, with a tooltip | UI | ☐ |
| SWL-13 | `premium/software/manage-automations-access.spec.ts` | `<role>` never sees the Automations button, on any fleet | UI | ☐ |
| SWL-14 | `free/software/manage-automations-access.spec.ts` | global admin can open the Manage automations modal | UI | ☐ |
| SWL-15 | `free/software/manage-automations-access.spec.ts` | `<role>` does not see the Automations button | UI | ☐ |

`Mode` is one of: **UI** (all validation through the browser), **UI+API** (browser flow,
some assertions via API), **API** (no meaningful UI validation), **PERF** (timing).

---

### SWL-01 · Software library lifecycle (Unassigned · Workstations) — 7 add cases › add

- **File:** [`playwright/tests/e2e/premium/software/library.spec.ts`](../../tests/e2e/premium/software/library.spec.ts)
- **Grep:** `npx playwright test -g "Software library lifecycle (Unassigned) — Custom package — macOS › add"` (one describe per scope × case; see the case list below)
- **Project:** premium · **Scopes:** Unassigned, Workstations
- **Mode:** UI+API · **Isolation:** serial describe, step 1 of 3 (shares `titleName` / `titleId` / `packageName` with delete + activity feed) · `test.setTimeout(90_000)`
- **Cases (7, each × 2 scopes = 14 describes):**
  1. `custom` macOS — [`gh_2.92.0_macOS_universal.pkg`](../../test-data/apple/macos/software/) (**27 MB**)
  2. `custom` Windows — `npp.8.9.4.Installer.x64.msi` (7.7 MB)
  3. `custom` Linux — `step-cli_0.30.2-1_amd64.deb` (14.6 MB)
  4. `fma` macOS — **Airtame**
  5. `fma` Windows — **7-Zip**
  6. `vpp` iOS — **Bear**
  7. `android` — `com.openai.chatgpt`
- **Preconditions:** clean instance (`cleanup-setup` runs `deleteAllInstallSoftwareTitles` on `fleet_id=0` and Workstations); premium license; VPP token + Managed Google Play configured on the instance (assumed, never asserted); `Workstations` gitops team exists (`workstationsFleetId` worker fixture)
- **Data created:** one software title per (scope, case) — deleted by SWL-02; residue swept by `cleanup-teardown`

**Flow**

1. ☐ Open the dashboard (via URL `/dashboard`).
   - ✅ *(UI)* First dashboard card is visible — `DashboardPage.goto()`.
2. ☐ Click **Software** in the navbar.
   - ✅ *(UI)* URL matches `/software` — `Navbar.goToSoftware()`.
3. ☐ Select the scope in the team dropdown (**Unassigned** / **Workstations**).
   - ✅ *(UI)* Dropdown's single-value shows exactly the scope label — `TeamDropdown.selectByLabel()` (idempotent; no click if already correct).
4. ☐ Click **Add software**.
   - ✅ *(UI)* URL matches `/software/add/fleet-maintained` — the click carries `fleet_id` from the list page, so the destination inherits the scope (`SoftwareTitlesPage.clickAddSoftware()`).
5. ☐ **Case-specific add path:**
   - **`custom`** — Click the **Custom package** tab (skipped if already selected).
     - ✅ *(UI)* URL matches `/software/add/package`; **Add software** `<h1>` heading and the **Custom package** tab are visible.
     - ☐ Choose the fixture file in the uploader (hidden `input#upload-file`).
     - ✅ *(UI)* **Add software** button becomes enabled.
     - ☐ Click **Add software**.
     - ✅ *(UI)* If the `.file-progress-modal` appears within 3 s it is hidden again within 45 s (an `if` — a package that never shows the modal silently skips this).
     - ✅ *(UI)* Redirects to `/software/titles/:id` within 30 s.
     - ✅ *(UI)* Success toast matching `/successfully added/` is visible.
   - **`fma`** — stay on the **Fleet-maintained** tab.
     - ✅ *(UI)* **Add software** heading visible and the tab is `aria-selected` (15 s each) — `expectLoaded()`.
     - ☐ Type the app name in the catalog search box.
     - ✅ *(UI)* A row whose text starts with the app name is visible — `searchFor()`.
     - ✅ *(UI)* **Precondition guard:** the platform column's cell shows an **Add** button and **no** `success-icon` — `expectNotAddedFor()`.
     - ☐ Click **Add** in the macOS or Windows column of that row.
     - ☐ Click **Add software** on the FMA detail page.
     - ✅ *(UI)* If "Uploading software…" appears within 3 s it clears within 45 s (again an `if`).
     - ✅ *(UI)* URL reaches `/software/titles/:id` within 30 s (`page.waitForURL` inline in the spec, [library.spec.ts:128](../../tests/e2e/premium/software/library.spec.ts#L128)).
   - **`vpp`** — Click the **App store** tab, then pick **Apple (macOS, iOS, and iPadOS)** in the platform combobox.
     - ✅ *(UI)* **Add software** heading + at least one `.software-vpp-form__list-item` visible.
     - ✅ *(UI)* A list item matching *both* the app name and the platform label (**Bear** + **iOS**) is visible — `expectListed()`.
     - ☐ Click that item's radio label, then **Add software**.
     - ✅ *(UI)* **Add software** enabled before the click; redirects to `/software/titles/:id`.
   - **`android`** — Click the **App store** tab, pick **Android** in the platform combobox.
     - ✅ *(UI)* **Add software** heading + **Application ID** input visible.
     - ☐ Type `com.openai.chatgpt`, click **Add software**.
     - ✅ *(UI)* **Add software** enabled before the click; redirects to `/software/titles/:id` within 30 s.
6. ☐ (Automatic) land on the new title's detail page.
   - ✅ *(UI)* The active installer accordion row (`.library-item-accordion` without `--inactive`) is visible.
   - ✅ *(UI)* The title's display heading (`aria-label="software display name"`) has non-empty text — **only** a length check, the expected name is never asserted.
7. ☐ (No user action) API cross-check of the add.
   - ✅ *(API)* `GET /activities` (paged, ≤5×100, newest first) contains `added_software` (custom/FMA) or `added_app_store_app` (VPP/Android) whose `details.software_title` equals the heading text, **and** whose `actor_email` is `FLEET_ADMIN_EMAIL` — `assertActivity`.
   - ✅ *(UI)* Title id parsed from the URL is > 0.
   - ✅ *(API)* For custom/FMA only: the activity carries a non-empty `details.software_package` (the installer filename, saved for SWL-03).
8. ☐ Open the **Library** tab via URL `/software/library?fleet_id=<n>`, re-select the scope, search the title name.
   - ✅ *(UI)* **Library** tab is `aria-selected`; a data row or the empty state is present — `SoftwareLibraryPage.goto()`.
   - ✅ *(UI)* A row containing the title name is visible.
9. ☐ **`fma` only** — reopen `/software/add/fleet-maintained?fleet_id=<n>`, search the app.
   - ✅ *(UI)* The platform cell now shows the `success-icon` and **no Add** button — `expectAddedFor()`.
10. ☐ **`vpp` only** — reopen `/software/add/app-store?fleet_id=<n>&platform=apple`.
    - ✅ *(UI)* The (Bear, iOS) list item is **gone** (count 0) — Fleet filters already-added VPP apps server-side.
    - *(No equivalent post-add catalog check exists for the `android` case.)*

**Assessment**
- *Value:* the broadest regression net in the area — proves all four Add-software entry points still work end-to-end (tab navigation, file upload through Fleet's installer pipeline, FMA CDN fetch, VPP catalog submit, Google Play metadata fetch), that scope is carried from the list page into the add flow, that the new title lands on the Library tab under the right fleet, and that Fleet emits the right activity with the right actor.
- *Coverage gaps:* the title name is never asserted against the expected value (a case where Fleet renders the *wrong* app would pass); no **Advanced options** on add (pre-install query, install/post-install/uninstall scripts, self-service, label scoping, categories) — flagged as net-new in [`C6-software.md` flow 22](../qawolf-migration/audit/C6-software.md); no version/platform/hosts columns asserted on the Library row; no **Download** of the uploaded installer; no duplicate-add rejection, no unsupported-file-type rejection, no oversized-file path; the Android catalog is never re-checked after add; nothing verifies the package is actually *installable* on a host (simulated hosts — see area note).
- *Redundancy:* SWL-05 re-runs this exact custom-package add path with a different `.deb`. The three `custom` cases differ only in the fixture's extension — the browser-side flow is byte-identical, so cases 1–3 buy server-side installer-parsing coverage and nothing UI-side. Add-path coverage also overlaps [`install-software.spec.ts`](../../tests/e2e/premium/controls/setup-experience/install-software.spec.ts), which adds the same four kinds via API.
- *Efficiency / smells:*
  - The (scope × case) double loop yields 42 runtime tests from 3 declarations; each `add` uploads a real 7–27 MB installer over the browser, so this is the slowest cluster in the suite.
  - `titleId` returned by `uploadPackage()` is discarded ([library.spec.ts:120](../../tests/e2e/premium/software/library.spec.ts#L120)) and re-parsed from `page.url()` at [:150](../../tests/e2e/premium/software/library.spec.ts#L150).
  - `page.waitForURL(...)` inline in the spec at [:128](../../tests/e2e/premium/software/library.spec.ts#L128) — the other three add paths do this inside their POM; the FMA one leaks Playwright API into the spec.
  - `expect(titleName.length).toBeGreaterThan(0)` at [:143](../../tests/e2e/premium/software/library.spec.ts#L143) is a tautology-grade assertion for FMA/VPP/Android, where `c.appName` is known.
  - Two `if (await …isVisible({timeout:3_000}).catch(…))` progress-modal branches ([`SoftwareCustomPackagePage.ts:82`](../../pages/software/SoftwareCustomPackagePage.ts#L82), [`FleetMaintainedAppDetailPage.ts:36`](../../pages/software/FleetMaintainedAppDetailPage.ts#L36)) can silently skip the "upload finished" wait.
  - `searchFor()` is re-run inside `clickAdd` / `expectAddedFor` / `expectNotAddedFor`, so the FMA case types the search query 3–4 times.
  - `expect(softwareLibrary.table.rowWith(titleName)).toBeVisible()` is unscoped — a second matching row would be a strict-mode failure rather than a clean assertion.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-02 · Software library lifecycle (Unassigned · Workstations) — 7 add cases › delete

- **File:** [`playwright/tests/e2e/premium/software/library.spec.ts`](../../tests/e2e/premium/software/library.spec.ts)
- **Grep:** `npx playwright test -g "Software library lifecycle (Workstations) — FMA — 7-Zip (Windows) › delete"`
- **Project:** premium · **Scopes:** Unassigned, Workstations · same 7 cases as SWL-01
- **Mode:** UI+API · **Isolation:** serial describe, step 2 of 3 — depends on `titleId` / `titleName` from SWL-01 (fails on a bare `-g "delete"` run)
- **Preconditions:** SWL-01 passed in the same worker
- **Data created:** none — this *is* the cleanup step

**Flow**

1. ☐ Open `/software/titles/<titleId>?fleet_id=<n>` via URL (raw `page.goto` in the spec, not `softwareTitleDetail.goto()`).
2. ☐ Click the installer accordion row header to expand it, click **Delete this version**, confirm in the modal.
   - ✅ *(UI)* A modal whose title matches `Delete software` or `Delete package` is visible before confirming.
   - ✅ *(UI)* After confirming, the active accordion row is hidden (Fleet redirects to the library list when the last installer is removed) — `SoftwareInstallerCard.delete()`.
3. ☐ (No user action) API cross-check.
   - ✅ *(API)* `GET /activities` contains `deleted_software` / `deleted_app_store_app` with `details.software_title === titleName`, actor = suite admin.
4. ☐ Open **Library** via URL `/software/library?fleet_id=<n>`, re-select the scope.
   - ✅ *(UI)* Library tab `aria-selected`; a row or the empty state is visible (asserted twice — once inside `goto()`, once again at [:202](../../tests/e2e/premium/software/library.spec.ts#L202)).
   - ✅ *(UI)* No row containing the title name (`toHaveCount(0)`) — no search is applied first, deliberately (the search box is disabled when the table is empty).
5. ☐ **`fma` only** — reopen the Fleet-maintained catalog.
   - ✅ *(UI)* The platform cell is back to an **Add** button with no `success-icon`.
6. ☐ **`vpp` only** — reopen the App store (Apple) tab.
   - ✅ *(UI)* The (Bear, iOS) list item is listed again.

**Assessment**
- *Value:* proves delete removes the title from the fleet's Library **and** returns the app to the FMA/VPP catalogs — i.e. the round-trip is genuinely reversible, not just visually gone.
- *Coverage gaps:* no delete-success toast assertion; the "Cancel" path on the delete modal is never exercised; the **Download** action revealed by the same expanded panel is never clicked; multi-package titles (a title holding an active + rollback installer) are never deleted one-version-at-a-time even though the POM comments describe that shape; no check that deleting does *not* remove host-reported inventory rows for the same title.
- *Redundancy:* the `toHaveCount(0)` library check duplicates what `cleanup-teardown` guarantees anyway; SWL-07 is the same delete against a different `.deb`.
- *Efficiency / smells:*
  - Raw `page.goto('/software/titles/...')` at [:192](../../tests/e2e/premium/software/library.spec.ts#L192) while `SoftwareTitleDetailPage.goto({titleId, fleetId})` exists and is used by `edit-package.spec` — and unlike that spec, no readiness anchor is asserted before clicking.
  - `rowOrEmpty()` asserted twice (once in `goto()`, once inline).
  - **Soft-pass risk:** `rowWith(titleName).toHaveCount(0)` inspects only the rows currently rendered. If the Library list is ever paginated past page 1 for that scope — e.g. [`install-software.spec.ts`](../../tests/e2e/premium/controls/setup-experience/install-software.spec.ts#L184) adds 11 FMA titles to the *same* scope in a parallel worker — a not-actually-deleted title on page 2 passes silently. ⚠️ unclear: the Library page's default rows-per-page is not visible from the test code.
  - `SoftwareInstallerCard.header` is `getByRole('button', { expanded: false })` — if a future page load renders the row pre-expanded, the locator resolves to nothing rather than no-op'ing.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-03 · Software library lifecycle (Unassigned · Workstations) — 7 add cases › activity feed shows add → delete

- **File:** [`playwright/tests/e2e/premium/software/library.spec.ts`](../../tests/e2e/premium/software/library.spec.ts)
- **Grep:** `npx playwright test -g "Software library lifecycle (Unassigned) — VPP — Bear (iOS) › activity feed shows add → delete"`
- **Project:** premium · **Scopes:** Unassigned, Workstations · same 7 cases
- **Mode:** UI · **Isolation:** serial describe, step 3 of 3 — needs `packageName` (custom/FMA) or `titleName` (VPP/Android) from SWL-01
- **Preconditions:** SWL-01 + SWL-02 passed in the same worker
- **Data created:** none

**Flow**

1. ☐ Open the dashboard (via URL).
2. ☐ Read the **Activity** feed.
   - ✅ *(UI)* Both expected rows are present in the rendered feed — `DashboardPage.expectActivities()` walks up to 15 feed pages and reloads up to 10 times waiting for propagation. Expected copy:
     - **custom / FMA:** `added <installer filename> to <unassigned|the Workstations fleet>.` and `deleted <installer filename> from <…>.` — note the feed shows the *file*, not the title.
     - **VPP / Android:** `added <Title> (<iOS|Android>) to <the No team fleet|the Workstations fleet>.` and `deleted <Title> (<platform>) from <unassigned|the Workstations fleet>.` — the Unassigned suffix is deliberately **asymmetric** (Fleet populates `team_name="No team"` on add and `null` on delete), encoded in [`activity-copy.ts:74`](../../helpers/activity-copy.ts#L74).

**Assessment**
- *Value:* the only place the rendered activity *copy* (verb + subject + scope suffix) is checked for software; the API-side `assertActivity` in SWL-01/02 would not catch a broken renderer or a wrong scope suffix. The asymmetric No-team suffix is a genuine product quirk this pins down.
- *Coverage gaps:* the feed row is matched by text only — the actor avatar/name, the timestamp, and the click-through detail modal (which for software shows the install script / query) are not asserted. `edited_software` never appears here (there is no edit in this lifecycle).
- *Redundancy:* moderate against SWL-01/02's `assertActivity` — same two activities, different layer. Justified (contract vs. rendering), but the *existence* half is asserted twice.
- *Efficiency / smells:* runs 14 times (2 scopes × 7 cases) to validate 4 distinct copy templates; the `custom` × 3 permutations produce identical matchers modulo the filename. `dashboard.expectActivities` can reload the dashboard 10× before failing, so a genuinely missing activity costs ~10 dashboard loads per case.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-04 · Software — add-software gating › Add software is disabled under All fleets, with a tooltip

- **File:** [`playwright/tests/e2e/premium/software/library.spec.ts`](../../tests/e2e/premium/software/library.spec.ts)
- **Grep:** `npx playwright test -g "Add software is disabled under All fleets, with a tooltip"`
- **Project:** premium · **Scope:** All fleets
- **Mode:** UI · **Isolation:** standalone describe, no shared state
- **Preconditions:** premium license (the team dropdown must exist)
- **Data created:** none

**Flow**

1. ☐ Open `/software/inventory` via URL.
   - ✅ *(UI)* **Inventory** tab is `aria-selected` (catches a removed legacy redirect); a row or the empty state is visible.
2. ☐ Select **All fleets** in the team dropdown.
3. ☐ Hover the **Add software** button.
   - ✅ *(UI)* **Add software** is disabled.
   - ✅ *(UI)* The text **"Select a fleet to add software."** is visible (hover is `{ force: true }` because a disabled button swallows pointer events).

**Assessment**
- *Value:* pins the aggregate-scope guard and its exact copy — cheap, deterministic, and the one negative path in the add flow.
- *Coverage gaps:* doesn't assert the button becomes *enabled* again after switching to a specific fleet (SWL-12 does that for Automations but not for Add software); doesn't confirm that navigating directly to `/software/add/package` without `fleet_id` is also handled.
- *Redundancy:* none.
- *Efficiency / smells:* raw `page.getByText('Select a fleet to add software.')` in the spec at [library.spec.ts:251](../../tests/e2e/premium/software/library.spec.ts#L251) rather than a POM locator; enters by direct URL rather than the dashboard → navbar click-through the suite prescribes for e2e specs (defensible for a gating check, but inconsistent with SWL-01 in the same file).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-05 · Software edit — custom package self-service (Unassigned) › add

- **File:** [`playwright/tests/e2e/premium/software/edit-package.spec.ts`](../../tests/e2e/premium/software/edit-package.spec.ts)
- **Grep:** `npx playwright test -g "Software edit — custom package self-service (Unassigned) › add"`
- **Project:** premium · **Scope:** Unassigned only (`FLEET_ID = 0` hardcoded)
- **Mode:** UI+API · **Isolation:** serial describe, step 1 of 4 · `test.setTimeout(90_000)`
- **Preconditions:** clean instance; the fixture is `linux/software/sublime-text_build-4200_amd64.deb` (16 MB) chosen precisely because `library.spec` never uploads it, so a parallel worker on the same Unassigned scope can't collide on the title "Sublime Text"
- **Data created:** software title "Sublime Text" on `fleet_id=0` — deleted by SWL-07

**Flow**

1. ☐ Open the dashboard (via URL) → click **Software** in the navbar → select **Unassigned** → click **Add software**.
   - ✅ *(UI)* Same chain of assertions as SWL-01 steps 1–4.
2. ☐ Click the **Custom package** tab, choose `sublime-text_build-4200_amd64.deb`, click **Add software**.
   - ✅ *(UI)* Progress modal (if shown) clears ≤45 s; redirect to `/software/titles/:id` ≤30 s; success toast `/successfully added/`.
3. ☐ (Automatic) land on the title detail page.
   - ✅ *(UI)* Active installer accordion row visible.
   - ✅ *(UI)* Display heading text is non-empty (again, the expected "Sublime Text" is not asserted).
4. ☐ (No user action) API cross-check.
   - ✅ *(API)* `added_software` activity with `details.software_title === <heading text>`, actor = suite admin.
   - ✅ *(API)* `details.software_package` non-empty (kept for SWL-08's feed matcher).

**Assessment**
- *Value:* as a step it exists only to stage SWL-06; on its own it re-proves the custom-package upload path.
- *Coverage gaps:* same as SWL-01 step 5 (`custom`) — no advanced options, no self-service set *at add time* (which is the natural comparison point for SWL-06), no Library-tab listing check (SWL-01 has one, this doesn't).
- *Redundancy:* **high** — a near-verbatim copy of SWL-01's `custom` Linux case, differing only in the `.deb` file and the missing Library verification. The whole `edit-package.spec` add/delete/feed scaffolding exists to reach one edit assertion.
- *Efficiency / smells:* uploads a second 16 MB installer per run purely to have something editable; `FLEET_ID = 0` is hardcoded at [edit-package.spec.ts:27](../../tests/e2e/premium/software/edit-package.spec.ts#L27) instead of `fleetIdFor()`, so the spec can never be extended to Workstations without a rewrite.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-06 · Software edit — custom package self-service (Unassigned) › edit — enabling Self-service persists

- **File:** [`playwright/tests/e2e/premium/software/edit-package.spec.ts`](../../tests/e2e/premium/software/edit-package.spec.ts)
- **Grep:** `npx playwright test -g "edit — enabling Self-service persists"`
- **Project:** premium · **Scope:** Unassigned
- **Mode:** UI+API · **Isolation:** serial describe, step 2 of 4 — needs `titleId` from SWL-05
- **Preconditions:** SWL-05 passed in the same worker
- **Data created:** none (mutates the staged title)

**Flow**

1. ☐ Open `/software/titles/<titleId>?fleet_id=0` (via `SoftwareTitleDetailPage.goto()`).
   - ✅ *(UI)* Active installer accordion row visible.
2. ☐ Click the **All hosts** label badge in the collapsed accordion header (this is the edit affordance for a package with no custom label scope).
   - ✅ *(UI)* A modal titled **Edit package** (premium multi-package title) or **Edit software** is visible, and its `role="switch"` Self-service slider is visible — `EditSoftwareModal.expectOpen()`.
   - ✅ *(UI)* The Self-service slider reads `aria-checked="false"` — i.e. the freshly added package defaults to *off*.
3. ☐ Click the **Self-service** slider.
   - ✅ *(UI)* Slider flips to `aria-checked="true"`.
4. ☐ Click **Save**, then **Save** again in the **Save changes?** confirmation dialog (enabling self-service reveals the categories field, which Fleet treats as a material change).
   - ✅ *(UI)* Both the confirmation dialog and the edit modal are hidden afterwards.
5. ☐ (No user action) persistence check.
   - ✅ *(API)* `GET /software/titles/<id>?fleet_id=0` → `software_package.self_service === true` — `getSoftwarePackage()`. The POM comment states a reopened modal renders stale config, so the UI cannot be used for this.

**Assessment**
- *Value:* the only in-UI edit round-trip in the area, and the only assertion that Fleet's Edit-package modal actually persists a change. Also pins the "Save changes?" double-confirmation behaviour.
- *Coverage gaps:* only one of the modal's many fields is exercised — no pre-install query, install/post-install/uninstall scripts, categories (which self-service *reveals* and this test never looks at), label scoping, or installer replacement ([`C6-software.md` flows 20/21](../qawolf-migration/audit/C6-software.md) call an `fma-edit-scripts.spec.ts` net-new and unwritten). No success-toast assertion. No **Cancel**/discard path. No UI confirmation at all that the title now shows a self-service badge, and no check that the package appears under **Self-service** on a host's software Library. The `Self-service only` filter switch on the Library page is modelled ([`SoftwareLibraryPage.ts:36`](../../pages/software/SoftwareLibraryPage.ts#L36)) but never used by any spec.
- *Redundancy:* none — this assertion is unique in the suite.
- *Efficiency / smells:*
  - The edit affordance is the **All hosts** badge ([`SoftwareInstallerCard.ts:46`](../../pages/components/SoftwareInstallerCard.ts#L46)) — an accessible-name match on a *label-scope* badge, which breaks the moment a package has a real label scope or the badge copy changes. There is no "Edit" affordance modelled.
  - "A reopened modal renders stale config" is a described product defect used to justify an API-only assertion, but there is no row for it in [`docs/blocked-by-product-bugs.md`](../blocked-by-product-bugs.md) and no filed Fleet issue — per `CLAUDE.md` that should be filed, not silently worked around.
  - `EditSoftwareModal.save()` clicks `confirmSaveButton` unconditionally; if Fleet ever *stops* showing the confirmation for this change, the test fails on a missing dialog rather than adapting.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-07 · Software edit — custom package self-service (Unassigned) › delete

- **File:** [`playwright/tests/e2e/premium/software/edit-package.spec.ts`](../../tests/e2e/premium/software/edit-package.spec.ts)
- **Grep:** `npx playwright test -g "Software edit — custom package self-service (Unassigned) › delete"`
- **Project:** premium · **Scope:** Unassigned
- **Mode:** UI+API · **Isolation:** serial describe, step 3 of 4 — needs `titleId` / `titleName`
- **Preconditions:** SWL-05 passed
- **Data created:** none — cleanup step

**Flow**

1. ☐ Open `/software/titles/<titleId>?fleet_id=0`.
2. ☐ Expand the installer accordion row, click **Delete this version**, confirm in the **Delete package** modal.
   - ✅ *(UI)* Modal visible before confirm; accordion row hidden after.
3. ☐ (No user action) API cross-check.
   - ✅ *(API)* `deleted_software` activity with `details.software_title === titleName`, actor = suite admin.

**Assessment**
- *Value:* cleanup with a delete-activity contract check.
- *Coverage gaps:* no Library-listing check after delete (SWL-02 has one); no toast; doesn't assert that deleting a self-service-enabled package is allowed (which would have been a cheap extra given the state SWL-06 leaves behind).
- *Redundancy:* duplicates SWL-02's delete for the `custom` kind.
- *Efficiency / smells:* none beyond the duplication.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-08 · Software edit — custom package self-service (Unassigned) › activity feed shows add → edit → delete

- **File:** [`playwright/tests/e2e/premium/software/edit-package.spec.ts`](../../tests/e2e/premium/software/edit-package.spec.ts)
- **Grep:** `npx playwright test -g "activity feed shows add → edit → delete"`
- **Project:** premium · **Scope:** Unassigned
- **Mode:** UI · **Isolation:** serial describe, step 4 of 4 — needs `packageName`
- **Preconditions:** SWL-05–07 passed
- **Data created:** none

**Flow**

1. ☐ Open the dashboard (via URL) and read the **Activity** feed.
   - ✅ *(UI)* Three rows present: `added sublime-text_build-4200_amd64.deb to unassigned.`, `edited sublime-text_build-4200_amd64.deb on unassigned.`, `deleted sublime-text_build-4200_amd64.deb from unassigned.` (regexes built from [`activity-copy.ts:153`](../../helpers/activity-copy.ts#L153)).

**Assessment**
- *Value:* the only place `edited_software` activity copy is asserted anywhere in the suite.
- *Coverage gaps:* the edit activity's *details* (which field changed, `self_service: true`) are never inspected — a rendered "edited X" would pass even if Fleet recorded the wrong change. No Workstations variant, so the `on the <fleet> fleet` suffix for `edited_software` is untested.
- *Redundancy:* the add and delete matchers duplicate SWL-03's `custom` Linux matchers modulo the filename; only the `edited` matcher is unique.
- *Efficiency / smells:* none — cheap and single-purpose.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-09 · Premium • Software • no-teams views (Unassigned) › Unassigned scope persists across Inventory, OS, and Vulnerabilities

- **File:** [`playwright/tests/e2e/premium/software/no-teams-views.spec.ts`](../../tests/e2e/premium/software/no-teams-views.spec.ts)
- **Grep:** `npx playwright test -g "Unassigned scope persists across Inventory, OS, and Vulnerabilities"`
- **Project:** premium · **Scope:** Unassigned
- **Mode:** UI · **Isolation:** independent test, read-only
- **Preconditions:** ambient host-reported software / OS / vulnerability data on unassigned hosts (offline hosts keep their last check-in records, so this doesn't need live hosts)
- **Data created:** none

**Flow**

1. ☐ Open `/software/inventory` via URL, select **Unassigned**.
   - ✅ *(UI)* Team dropdown reads exactly `Unassigned`.
   - ✅ *(UI)* A data row **or** the empty state is visible.
2. ☐ Click the **OS** tab.
   - ✅ *(UI)* URL matches `/software/os`; first row visible (`gotoOsTab()`).
   - ✅ *(UI)* Team dropdown still reads `Unassigned`.
   - ✅ *(UI)* A row or the empty state is visible.
3. ☐ Click the **Vulnerabilities** tab.
   - ✅ *(UI)* URL matches `/software/vulnerabilities`; first row visible (`gotoVulnerabilitiesTab()`).
   - ✅ *(UI)* Team dropdown still reads `Unassigned`.
   - ✅ *(UI)* A row or the empty state is visible.

**Assessment**
- *Value:* guards the real bug class this came from — the scope dropdown silently resetting to "All fleets" when moving between software sub-tabs.
- *Coverage gaps:* the `rowOrEmpty()` assertions accept an **empty table**, so the spec's own docstring claim that these tabs "all render data" under Unassigned is not actually enforced. The item-count-equals-row-count integrity check and section-header checks that motivated this spec ([`C6-software.md` flow 26](../qawolf-migration/audit/C6-software.md)) were not implemented. The **Library** tab is not included in the scope-persistence sweep even though it is the tab this area is about. `fleet_id` is never read back off the URL.
- *Redundancy:* the OS-tab and Vulnerabilities-tab "renders data" halves overlap [`os.spec.ts`](../../tests/e2e/premium/software/os.spec.ts) and [`vulnerabilities.spec.ts`](../../tests/e2e/premium/software/vulnerabilities.spec.ts); the unique content is the dropdown-persistence assertion after each tab click.
- *Efficiency / smells:* `gotoOsTab()` / `gotoVulnerabilitiesTab()` already assert `firstRow` visible, then the spec immediately asserts the weaker `rowOrEmpty()` — the stronger assertion is inside the POM and the weaker one in the spec, which reads backwards.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-10 · Premium • Software • no-teams views (Unassigned) › drilling into a title shows its detail page with no "Add software" action

- **File:** [`playwright/tests/e2e/premium/software/no-teams-views.spec.ts`](../../tests/e2e/premium/software/no-teams-views.spec.ts)
- **Grep:** `npx playwright test -g "drilling into a title shows its detail page with no"`
- **Project:** premium · **Scope:** Unassigned
- **Mode:** UI · **Isolation:** independent test, read-only
- **Preconditions:** at least one software title listed under Unassigned
- **Data created:** none

**Flow**

1. ☐ Open `/software/inventory` via URL, select **Unassigned**.
2. ☐ Click the first software title's name link.
   - ✅ *(UI)* URL matches `/software/titles/:id`.
   - ✅ *(UI)* No **Add software** button on the page (`toHaveCount(0)`) — it's a list-page action only.

**Assessment**
- *Value:* thin. Asserts one absent button on a page reached by clicking an arbitrary row.
- *Coverage gaps:* nothing about the detail page's *actual* content is asserted — no heading, no versions table, no Hosts count, no scope indicator, and no check that the title detail is still scoped to Unassigned after the drill-in (which is the interesting part of a "no teams" spec).
- *Redundancy:* the drill-in-from-inventory step duplicates `host-software.spec.ts` and `vulnerabilities.spec.ts`; the only unique assertion is the absent button.
- *Efficiency / smells:* `clickFirstSoftwareTitle()` is `firstRowWithLink.locator('td').first().getByRole('link').first().click()` ([`SoftwareTitlesPage.ts:180`](../../pages/software/SoftwareTitlesPage.ts#L180)) — exactly the `.first()`-chain [`tests/README.md`](../../tests/README.md) lists as an anti-pattern, when `DataTable.firstRowPrimaryLink` exists for this. Also `page.getByRole('button', { name: 'Add software' })` is built inline in the spec while `SoftwareTitlesPage.addSoftwareButton` already exposes it.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-11 · Premium • Software • Manage automations access › global admin can open the Manage automations modal on All fleets

- **File:** [`playwright/tests/e2e/premium/software/manage-automations-access.spec.ts`](../../tests/e2e/premium/software/manage-automations-access.spec.ts)
- **Grep:** `npx playwright test -g "global admin can open the Manage automations modal on All fleets"`
- **Project:** premium · **Scope:** All fleets · **Role:** static `global-admin`
- **Mode:** UI · **Isolation:** independent; runs in a **separate browser context** via `withStaticUser` so the shared admin storage state is untouched
- **Preconditions:** static users provisioned; `FLEET_STATIC_USER_PASSWORD` set. `withStaticUser` reuses a cached session file if it still authenticates, otherwise logs in through the login form and caches the new state.
- **Data created:** none (modal is opened, never saved)
- **Cross-link:** free mirror = **SWL-14**

**Flow**

1. ☐ Log in as the static **global admin** (fresh context).
2. ☐ Open `/software/inventory` via URL.
   - ✅ *(UI)* Inventory tab `aria-selected`; a row or the empty state visible.
3. ☐ Select **All fleets** in the team dropdown.
4. ☐ Click **Automations**.
   - ✅ *(UI)* The **Automations** button is enabled.
   - ✅ *(UI)* A modal container containing the text **Manage automations** is visible.

**Assessment**
- *Value:* proves the admin+aggregate-scope combination is the one that unlocks the modal; combined with SWL-12/13 it covers the whole gate.
- *Coverage gaps:* the modal's contents are not asserted (no vulnerability-automations toggle, workflow radios, destination-URL field, Save button) and it is never dismissed or saved — that lives in `vulnerability-automations.spec.ts`. A *fleet-scoped* admin (team admin) is not covered, only global roles.
- *Redundancy:* SWL-14 is the same assertion on free; the modal-open action also happens inside `vulnerability-automations.spec.ts`.
- *Efficiency / smells:*
  - Because `withStaticUser` builds its own context, the auto `pageHealth` fixture (which listens on the *fixture* `page`) monitors an unrelated blank page — these five tests get **no console-error / 5xx coverage**, and each still pays for an unused fixture `page`.
  - `new SoftwareTitlesPage(page)` is constructed in the spec body (unavoidable given the separate context, but it bypasses the fixture layer).
  - `SoftwareTitlesPage.openManageAutomations()` already does click + modal assertion; the spec re-implements it inline.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-12 · Premium • Software • Manage automations access › global admin: Automations button is disabled on a specific fleet, with a tooltip

- **File:** [`playwright/tests/e2e/premium/software/manage-automations-access.spec.ts`](../../tests/e2e/premium/software/manage-automations-access.spec.ts)
- **Grep:** `npx playwright test -g "Automations button is disabled on a specific fleet, with a tooltip"`
- **Project:** premium · **Scope:** Workstations · **Role:** static `global-admin`
- **Mode:** UI · **Isolation:** independent, separate browser context
- **Preconditions:** static users provisioned; `Workstations` fleet exists
- **Data created:** none

**Flow**

1. ☐ Log in as the static **global admin** (fresh context), open `/software/inventory`.
2. ☐ Select **Workstations** in the team dropdown.
3. ☐ Hover the **Automations** button (`{ force: true }` — a disabled button swallows pointer events).
   - ✅ *(UI)* **Automations** is disabled.
   - ✅ *(UI)* Text containing **"to manage automations."** is visible.

**Assessment**
- *Value:* pins the "vulnerability automations are global, so a fleet scope disables the entry point" rule.
- *Coverage gaps:* only **Workstations** is checked — not Unassigned, where the same rule should hold. The tooltip assertion is a fragment, so the subject of the sentence (presumably "Select 'All fleets'…") is unverified; SWL-04 pins its tooltip copy in full, so this is inconsistent within the area.
- *Redundancy:* structurally identical to SWL-04 (disabled control + forced hover + tooltip) on the same page — merge candidate.
- *Efficiency / smells:* partial-string tooltip assertion at [manage-automations-access.spec.ts:47](../../tests/e2e/premium/software/manage-automations-access.spec.ts#L47); raw `page.getByText(...)` in the spec; no `pageHealth` coverage (see SWL-11).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-13 · Premium • Software • Manage automations access › `global-maintainer` / `global-observer` never sees the Automations button, on any fleet

- **File:** [`playwright/tests/e2e/premium/software/manage-automations-access.spec.ts`](../../tests/e2e/premium/software/manage-automations-access.spec.ts)
- **Grep:** `npx playwright test -g "global-observer never sees the Automations button, on any fleet"`
- **Project:** premium · **Scopes:** All fleets, Workstations, Unassigned (all three, inside one test) · **Roles:** `global-maintainer`, `global-observer` (one test declaration per role)
- **Mode:** UI · **Isolation:** independent, separate browser context per role
- **Preconditions:** static maintainer + observer users provisioned
- **Data created:** none
- **Cross-link:** free mirror = **SWL-15**

**Flow**

1. ☐ Log in as the static **global maintainer** (then, in the second test, **global observer**) in a fresh context.
2. ☐ Open `/software/inventory` via URL.
   - ✅ *(UI)* Inventory tab `aria-selected`; a row or the empty state visible.
3. ☐ For each of **All fleets**, **Workstations**, **Unassigned**: select the scope in the team dropdown.
   - ✅ *(UI)* Dropdown reads the selected scope (inside `select()`).
   - ✅ *(UI)* **Automations** button count is 0 — absence, not a disabled state, because the gate is `isGlobalAdmin`.

**Assessment**
- *Value:* the role half of the gate, swept across every scope so a scope-specific leak can't hide.
- *Coverage gaps:* only two non-admin *global* roles; fleet-scoped roles (fleet admin / maintainer / observer) and the observer-plus role are not covered here (they may live in `tests/api/role-access/premium/`, which probes endpoints rather than UI affordances). No check that these roles *can* still read the software list (the `rowOrEmpty` inside `goto()` is the closest thing).
- *Redundancy:* SWL-15 is the same assertion on free minus the scope loop; the scope sweep is deliberately redundant per the spec's own comment (honouring the original QA Wolf "unable to click across every team" coverage).
- *Efficiency / smells:* three dropdown round-trips per role to re-assert a role-only gate — the spec comment concedes the gate is not team-gated; no `pageHealth` coverage (see SWL-11).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-14 · Free • Software • Manage automations access › global admin can open the Manage automations modal

- **File:** [`playwright/tests/e2e/free/software/manage-automations-access.spec.ts`](../../tests/e2e/free/software/manage-automations-access.spec.ts)
- **Grep:** `npx playwright test -g "global admin can open the Manage automations modal"`
- **Project:** free · **Scope:** n/a (free has no team dropdown) · **Role:** static `global-admin`
- **Mode:** UI · **Isolation:** independent, separate browser context via `withStaticUser`
- **Preconditions:** static users provisioned on the free instance
- **Data created:** none
- **Cross-link:** premium mirror = **SWL-11**

**Flow**

1. ☐ Log in as the static **global admin** (fresh context).
2. ☐ Open `/software/inventory` via URL.
   - ✅ *(UI)* Inventory tab `aria-selected`; a row or the empty state visible.
3. ☐ Click **Automations**.
   - ✅ *(UI)* The button is enabled (no scope to pick — the aggregate is always in effect on free).
   - ✅ *(UI)* A modal containing **Manage automations** is visible.

**Assessment**
- *Value:* confirms vulnerability automations are genuinely a free-tier feature and that the absence of a team dropdown doesn't leave the button disabled.
- *Coverage gaps:* modal contents unasserted (same as SWL-11); no free counterpart to SWL-12 (there is nothing to disable on free, so this is fine).
- *Redundancy:* deliberate free/premium mirror of SWL-11. Per the suite's tier-separation convention this duplication is intended.
- *Efficiency / smells:* same `withStaticUser` / `pageHealth` blind spot as SWL-11; `openManageAutomations()` POM method unused.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-15 · Free • Software • Manage automations access › `global-maintainer` / `global-observer` does not see the Automations button

- **File:** [`playwright/tests/e2e/free/software/manage-automations-access.spec.ts`](../../tests/e2e/free/software/manage-automations-access.spec.ts)
- **Grep:** `npx playwright test -g "global-maintainer does not see the Automations button"`
- **Project:** free · **Roles:** `global-maintainer`, `global-observer` (one test declaration per role)
- **Mode:** UI · **Isolation:** independent, separate browser context per role
- **Preconditions:** static maintainer + observer users provisioned on free
- **Data created:** none
- **Cross-link:** premium mirror = **SWL-13**

**Flow**

1. ☐ Log in as the static role user (fresh context).
2. ☐ Open `/software/inventory` via URL.
   - ✅ *(UI)* Inventory tab `aria-selected`; a row or the empty state visible.
   - ✅ *(UI)* **Automations** button count is 0.

**Assessment**
- *Value:* cheapest test in the area; confirms the `isGlobalAdmin` gate isn't premium-only.
- *Coverage gaps:* as SWL-13, minus the scope sweep (correctly — free has no scopes).
- *Redundancy:* deliberate mirror of SWL-13.
- *Efficiency / smells:* same `pageHealth` blind spot; otherwise minimal.

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
| Add custom package (`.pkg` / `.msi` / `.deb`) | SWL-01, SWL-05 | Advanced options on add (pre-install query, install / post-install / uninstall scripts, self-service, categories, label scope); duplicate-add and invalid-file rejection; `.exe`, `.rpm`, `.tar.gz` fixtures sit in `test-data/` unused |
| Add Fleet-maintained app | SWL-01 (Airtame macOS, 7-Zip Windows) | FMA catalog search/paging/sorting as a feature; FMA script + query editing ([`C6-software.md` flows 20/21](../qawolf-migration/audit/C6-software.md), unwritten); FMA version pinning / update |
| Add Apple VPP app | SWL-01 (Bear, iOS) | macOS and iPadOS VPP platforms; the App Store *search* UI (`vppUiSearchNames` exists for it, unused); missing/expired VPP-token error path |
| Add Managed Google Play app | SWL-01 (ChatGPT) | Invalid application-ID error path; no post-add catalog re-check (FMA and VPP both have one) |
| Library tab list | SWL-01, SWL-02 | Columns (Version / Type / Hosts / Status), sorting, pagination, the **Self-service only** filter switch (locator exists, never used), **Download installer** |
| Edit installer config | SWL-06 (self-service only) | Every other field in the Edit modal; Cancel/discard; re-uploading a replacement installer |
| Delete installer | SWL-02, SWL-07 | Cancel path; per-version delete on a multi-package title; blocked-delete when referenced by Setup Experience (only covered incidentally in `install-software.spec.ts`) |
| Add-software gating | SWL-04 (All fleets) | Non-admin roles vs. **Add software**; direct URL to `/software/add/*` without `fleet_id`; free-tier paywall on `/software/add/*` — [`paywalls.spec.ts`](../../tests/e2e/free/paywalls.spec.ts) lists no `software/add` URL despite `library.spec`'s header claiming all four paths are paywalled |
| Automations button gating | SWL-11–15 | Fleet-scoped roles (fleet admin/maintainer/observer); modal internals (covered in `vulnerability-automations.spec.ts`) |
| Unassigned ("no teams") software views | SWL-09, SWL-10 | Library tab omitted from the persistence sweep; item-count-vs-row-count integrity dropped from the original design |
| **Install / uninstall on a host** | **nothing** | The whole install lifecycle (queue → pending → installed/failed, uninstall, retry, host Software → Library "All available", self-service install by an end user, policy-triggered `install_software` automation) is untested. Root cause: the QA hosts are osquery-perf simulations that cannot execute an install; the one real MDM-enrolled macOS VM (`liveMacosHost`) is used by host specs but by **no** software spec |
| Software install activity types | none | `installed_software`, `uninstalled_software`, `enabled/disabled_vpp` etc. never asserted — `activity-copy.ts` has no builders for them |

**Duplication**

1. **SWL-05/07/08 vs SWL-01/02/03 (`custom` Linux).** `edit-package.spec` re-implements the entire custom-package add → delete → activity-feed lifecycle to reach one edit assertion (SWL-06). Roughly three quarters of that spec, including a 16 MB upload per run, is duplicated work.
2. **The three `custom` cases in `library.spec`.** macOS `.pkg`, Windows `.msi`, Linux `.deb` drive an identical browser flow; only Fleet's server-side installer parsing differs. 6 of the 42 runtime lifecycle tests (×3 sub-tests = 18) come from this axis.
3. **Activity assertions at two layers.** SWL-01/02/05/07 assert `added_*` / `deleted_*` via `GET /activities`; SWL-03/08 assert the same events' rendered copy. Only the *copy* half is unique — the existence half is doubled 14×.
4. **SWL-04 vs SWL-12.** Same page, same pattern (disabled control + `hover({force:true})` + tooltip text), different button, different files. Natural merge into one "software page gating" spec.
5. **SWL-09/10 vs `os.spec.ts` + `vulnerabilities.spec.ts` + `host-software.spec.ts`.** The tab-renders-data and drill-into-a-title steps exist in all of them; only the dropdown-persistence and absent-button assertions are unique to `no-teams-views`.
6. **`library.spec` vs `install-software.spec.ts`.** Both add all four software kinds across both scopes (9 cases × 2 there, 7 × 2 here) — one via UI, one via API. Different features under test, but the same instance-side work is done twice per run, plus 11 extra FMA adds for the pagination test.

**UI-vs-API balance**

- **SWL-06's API-only persistence check** (`getSoftwarePackage` → `self_service === true`) is the one place in this area where API stands in for a UI assertion. It is *documented* as necessary (the reopened Edit modal renders stale config) but that's an unfiled product defect being routed around — per `CLAUDE.md` it belongs in [`docs/blocked-by-product-bugs.md`](../blocked-by-product-bugs.md) with a Fleet issue, and the test should assert the visible self-service badge in the meantime.
- **`assertActivity` in SWL-01/02/05/07 is justified** — it is the activity-payload contract (type + `details.software_title` + `actor_email`) plus the mechanism that extracts `software_package` for the feed matchers. It is not a shortcut around a UI assertion, because SWL-03/08 assert the rendered feed separately.
- **Everything else is UI.** No test in this area uses the API to *set up* state, which is the right call for a lifecycle spec but means every run pays for real uploads.
- **Weak-assertion watch list** (technically UI, but close to no-ops): `expect(titleName.length).toBeGreaterThan(0)` (SWL-01, SWL-05); `rowOrEmpty()` used as a "renders data" proof in SWL-09; the partial tooltip string in SWL-12; `rowWith(name).toHaveCount(0)` in SWL-02 without a search or pagination guard.

**Quick wins**

1. Assert the expected app name on the title-detail heading for the FMA / VPP / Android cases (`c.appName` is right there) instead of `titleName.length > 0` — [library.spec.ts:143](../../tests/e2e/premium/software/library.spec.ts#L143), [edit-package.spec.ts:61](../../tests/e2e/premium/software/edit-package.spec.ts#L61).
2. **Delete `helpers/catalogs/` or start using it.** `fmaApps` (285 lines), `vppApps` (98 entries), `androidApps`, `vppUiSearchNames` are imported by **zero** specs — both `library.spec` and `install-software.spec` hardcode their own `CASES` arrays. Meanwhile [`helpers/README.md:20`](../../helpers/README.md#L20) and [`catalogs/README.md`](../../helpers/catalogs/README.md) document them as the way to pick an app, so the next author will wire up a 285-entry list and multiply the case matrix. Either point the two `CASES` arrays at the catalogs (no new tests) or drop the module.
3. Replace the raw `page.goto('/software/titles/...')` at [library.spec.ts:192](../../tests/e2e/premium/software/library.spec.ts#L192) with `softwareTitleDetail.goto({ titleId, fleetId })` + a `card` visibility anchor (as `edit-package.spec` already does), and drop the duplicated `rowOrEmpty()` at [:202](../../tests/e2e/premium/software/library.spec.ts#L202).
4. Swap `clickFirstSoftwareTitle()`'s `.first()` chain ([`SoftwareTitlesPage.ts:180`](../../pages/software/SoftwareTitlesPage.ts#L180)) for `DataTable.firstRowPrimaryLink`, and use `softwareTitles.addSoftwareButton` instead of the inline `getByRole` in [no-teams-views.spec.ts:36](../../tests/e2e/premium/software/no-teams-views.spec.ts#L36).
5. Pin SWL-12's tooltip to the full sentence and add the **Unassigned** scope to it (one extra dropdown selection), matching how SWL-04 pins `Select a fleet to add software.`.

**Bigger bets**

1. **Collapse `edit-package.spec` into `library.spec` as an eighth case.** Add an `edit` sub-test that runs only for `custom` cases (or only for one designated case), reusing the already-uploaded installer. Removes one 16 MB upload per run and ~3 duplicated sub-tests, and gets the edit round-trip covered on **Workstations** as well as Unassigned — which is where the `edited … on the <fleet> fleet` activity suffix currently has no coverage at all. Then invest the freed budget in the *unexercised* Edit-modal fields (pre-install query, install/uninstall scripts, categories), which is the single largest functional gap in the area.
2. **Own the "software is never installed anywhere" gap explicitly.** Either (a) build one host-backed install spec against `liveMacosHost` — upload a small `.pkg`, install from the host's Software tab, assert pending → installed and the `installed_software` activity, then uninstall — accepting that it is a single-host serial test; or (b) write it down as a permanent boundary in `TODO.md` so nobody assumes the library specs cover installation. Today the suite silently reads as if add-to-library were the whole feature. `install_software` policy automation ([`C6-software.md` flow 25](../qawolf-migration/audit/C6-software.md)) sits behind the same decision.
3. **Rebalance the (scope × case) matrix instead of running the full cross-product.** The scope axis exercises Fleet's `fleet_id` plumbing and the case axis exercises four different add pipelines; running all 7 × 2 × 3 = 42 tests every night mostly re-verifies that a `.pkg` and a `.msi` take the same three clicks. A matrix of "every case once on Unassigned + one representative case (plus FMA, which has the scope-sensitive catalog state) on Workstations" keeps the distinct coverage at roughly half the runtime, freeing the budget for the Library-tab columns, filters, and pagination that nothing currently touches.
