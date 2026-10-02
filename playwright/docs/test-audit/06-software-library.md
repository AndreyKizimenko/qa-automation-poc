# Software library & packages — test audit

**Specs covered:** 16 files · **Test declarations:** 34 (→ 85 runtime tests after parameterisation) · **Projects:** premium / free

This area covers everything an admin *adds* to Fleet's software library — custom
packages (`.pkg` / `.msi` / `.deb` / `.sh`), Fleet-maintained apps (FMA), Apple VPP
apps and Managed Google Play (Android) apps — plus the `/software/inventory` and
`/software/library` lists and their shared table controls, the title-detail summary
card (Type line, custom icon, display name, version pin), the installer accordion
(Edit software / Download installer / Delete this version), the Fleet-maintained
catalog's own filters, the Unassigned ("no teams") software views, scope
persistence across the navbar, and role/scope gating on **Add software** and the
**Automations** button.

`library.spec.ts` is still the lifecycle workhorse: a double loop (2 scopes × 7
add cases) around a serial `add → delete → activity feed` describe, i.e. 43 of
the 83 runtime tests in this area. Around it sit two newer rings. The **shape**
specs each seed one distinctly-named title and inspect one property of it
(`script-only-package`, `package-scripts`, `custom-icons`, `display-name`,
`version-pinning`). The **read-only** specs touch no state at all
(`titles-table` on both tiers, `fleet-maintained-filters`, `role-access`,
`add-software-validation`, `no-teams-views`). `edit-package.spec.ts` remains the
only in-UI *edit* round-trip that writes something back.

**Standing fact that shapes this whole area:** nothing here ever installs software
on a host. The premium/free QA hosts are osquery-perf **simulations**, so an
install/uninstall command has nothing to execute against, and the real macOS VM
(`liveMacosHost`) is not used by any software spec. Every assertion is "the
installer is in the library / catalog / activity feed", never "the bits landed on
a machine". That is still true after the additions below — `script-only-package`
uploads a shell script Fleet stores as an install script and never runs, and
`package-scripts` downloads an installer instead of installing it.

**Durable precondition — the Fleet-maintained app shelf.** The premium instance's
**QA** fleet carries a permanent shelf of 10 Fleet-maintained apps × macOS and
Windows (20 titles), declared in
[`gitops/premium-fleetqa/fleets/qa.yml`](../../../gitops/premium-fleetqa/fleets/qa.yml)
and **never cleaned up**: `setup/cleanup.steps.ts` wipes only Unassigned and
Workstations, so QA is the one scope where an app can sit long enough for Fleet's
hourly `maintained_apps_auto_update` cron to cache a *second* build of it. SWL-28
and SWL-29 depend on that shelf existing and on its titles arriving **unpinned**
— an exact pin makes the cron skip a title, so a run that dies without restoring
the pin freezes version history for every later run. Nothing on the shelf is
self-service or part of the setup experience, deliberately: QA is also the target
fleet for the host-transfer specs.

**Every seeding spec claims its own title**, on purpose. A premium custom-package
title can hold several packages, so two specs uploading a same-named fixture to
the same fleet leave the Library accordion with two rows and every row-scoped
locator ambiguous. The claims in force today:

| Spec | Claims | Scope |
|---|---|---|
| `premium/software/library.spec.ts` | `airtame` (macOS FMA), `7-Zip` (Windows FMA), Bear (VPP iOS), `com.openai.chatgpt`, `gh_2.92.0_macOS_universal.pkg`, `npp.8.9.4.Installer.x64.msi`, `step-cli_0.30.2-1_amd64.deb` | Unassigned + Workstations |
| `premium/software/edit-package.spec.ts` | `sublime-text_build-4200_amd64.deb` (→ title "Sublime Text") | Unassigned |
| `premium/software/custom-icons.spec.ts` | `anydesk/darwin`, `archaeology/darwin` | Unassigned |
| `premium/software/display-name.spec.ts` | `clockify/darwin` | Unassigned |
| `premium/software/script-only-package.spec.ts` | `fleet-playwright-script-package.sh` (→ title `fleet-playwright-script-package`) | Unassigned |
| `premium/software/package-scripts.spec.ts` | `fleet-playwright-pkg_1.0.0_amd64.deb` (→ title `fleet-playwright-pkg`) | Unassigned |
| `premium/controls/setup-experience/install-software.spec.ts` (area 12) | eleven macOS FMA slugs for its pagination case | Unassigned + Workstations |
| `premium/software/version-pinning.spec.ts` | `Postman` (macOS) on the durable shelf — reads, never adds | QA |

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
| SWL-16 | `shared/software/titles-table.spec.ts` | Software • inventory table › renders its columns and marks only Name and Hosts sortable | UI | ☐ |
| SWL-17 | `shared/software/titles-table.spec.ts` | … › sorting by Name orders the page in both directions | UI | ☐ |
| SWL-18 | `shared/software/titles-table.spec.ts` | … › sorting by Hosts orders the page in both directions | UI | ☐ |
| SWL-19 | `premium/software/titles-table.spec.ts` | Library vs Inventory › the Library tab is the installable subset of Inventory | UI | ☐ |
| SWL-20 | `premium/software/role-access.spec.ts` | `<role>` sees the software inventory scoped to their fleets | UI | ☐ |
| SWL-21 | `premium/software/fleet-maintained-filters.spec.ts` | … › the platform filter narrows the catalog to apps offered on that platform | UI+API | ☐ |
| SWL-22 | `premium/software/fleet-maintained-filters.spec.ts` | … › "Hide added apps" leaves only entries that can still be added | UI | ☐ |
| SWL-23 | `premium/software/fleet-maintained-filters.spec.ts` | … › searching by name narrows the catalog to matching apps | UI | ☐ |
| SWL-24 | `premium/software/add-software-validation.spec.ts` | a `.<ext>` is refused before anything is uploaded | UI | ☐ |
| SWL-25 | `premium/software/custom-icons.spec.ts` | upload, replace and remove a custom icon | UI+API | ☐ |
| SWL-26 | `premium/software/custom-icons.spec.ts` | only square PNGs of the right size and dimensions are accepted | UI+API | ☐ |
| SWL-27 | `premium/software/display-name.spec.ts` | setting and clearing a display name changes how the title is listed | UI | ☐ |
| SWL-28 | `premium/software/version-pinning.spec.ts` | pinning to latest, an exact version and a major version each take effect | UI+API | ☐ |
| SWL-29 | `premium/software/version-pinning.spec.ts` | pinning to an older version stores that build, not the newest *(skips on data availability)* | UI+API | ☐ |
| SWL-30 | `premium/software/script-only-package.spec.ts` | a `.sh` is added as a script-only package and removed again | UI+API | ☐ |
| SWL-31 | `premium/software/package-scripts.spec.ts` | the installer downloads byte-identical and Advanced options shows its stored scripts | UI+API | ☐ |
| SWL-32 | `premium/software/no-teams-views.spec.ts` | All fleets sticks from Hosts to Policies, and Controls falls back to a fleet | UI | ☐ |
| SWL-33 | `premium/software/patch-policy.spec.ts` | a macOS app: each patch option stores its own policy, and unticking Patch removes it | UI+API | ☐ |
| SWL-34 | `premium/software/patch-policy.spec.ts` | a Windows app: Force patch offers no Notify, and the server refuses Notify and both flags at once | UI+API | ☐ |

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
   - ✅ *(UI)* **`android` / `vpp` cases only** — the summary card's **Type** line reads `Application (Android)` / `Application (<iOS>)`. Fleet derives it from the title's osquery source (`SOURCE_TYPE_CONVERSION`), so `android_apps` renders "Application (Android)" and `ios_apps` renders "Application (iOS)"; it is the only visible difference on the title page between an App Store / Play Store app and a package of the same name. The `custom` and `fma` cases assert no Type line at all (SWL-30 pins the script-only one).
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
- *Coverage gaps:* the title name is never asserted against the expected value (a case where Fleet renders the *wrong* app would pass); the **Type** line is asserted for the app-store cases only, so `Custom package` / `Fleet-maintained` Type copy is unpinned here; no **Advanced options** on add (pre-install query, install/post-install/uninstall scripts, self-service, label scoping, categories) — flagged as net-new in [`C6-software.md` flow 22](../qawolf-migration/audit/C6-software.md); no version/platform/hosts columns asserted on the Library row; no **Download** of the uploaded installer; no duplicate-add rejection, no unsupported-file-type rejection, no oversized-file path; the Android catalog is never re-checked after add; nothing verifies the package is actually *installable* on a host (simulated hosts — see area note).
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
  - `SoftwareInstallerCard.header` is now matched by its BEM class rather than by expanded state, and `expand()` reads `aria-expanded` before clicking — so the "row renders pre-expanded" hazard this entry previously flagged is closed ([`SoftwareInstallerCard.ts:51`](../../pages/components/SoftwareInstallerCard.ts#L51)).

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
  - The edit affordance used here is the **All hosts** badge ([`SoftwareInstallerCard.ts:59`](../../pages/components/SoftwareInstallerCard.ts#L59)) — an accessible-name match on a *label-scope* badge, which breaks the moment a package has a real label scope or the badge copy changes. The row's own **Edit software** button *is* now modelled (`installerCard.editSoftwareButton`) and SWL-31 opens the same modal with it, so this spec is the odd one out.
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
- **Cross-link:** the "All fleets" counterpart in the same file — one scope across five *pages* instead of one page's tabs — is **SWL-32**

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

### SWL-13 · Premium • Software • Manage automations access › `<role>` never sees the Automations button, on any fleet

- **File:** [`playwright/tests/e2e/premium/software/manage-automations-access.spec.ts`](../../tests/e2e/premium/software/manage-automations-access.spec.ts)
- **Grep:** `npx playwright test -g "team-admin never sees the Automations button, on any fleet"` (one test per role)
- **Project:** premium · **Roles:** `global-maintainer`, `global-observer`, `team-admin`, `ws-maintainer` — 1 declaration → **4 runtime tests**
- **Mode:** UI · **Isolation:** independent, separate browser context per role
- **Preconditions:** the four static users provisioned; `Workstations` **and** `VMs` exist (`team-admin` administers exactly those two); `ws-maintainer` belongs to Workstations alone
- **Data created:** none
- **Cross-link:** free mirror = **SWL-15**; the *read-view* role matrix on the same page = **SWL-20**

**Scopes swept, per role** — the fixed three-scope matrix this test used to run has been replaced by each role's own picker contents:

| Role | Scopes swept |
|---|---|
| `global-maintainer` | All fleets, Workstations, Unassigned |
| `global-observer` | All fleets, Workstations, Unassigned |
| `team-admin` | VMs, Workstations (no aggregate entry exists for them) |
| `ws-maintainer` | none — Fleet renders no picker for a single-fleet user |

**Flow**

1. ☐ Log in as the static role user in a fresh context.
2. ☐ Open `/software/inventory` via URL.
   - ✅ *(UI)* Inventory tab `aria-selected`; a row or the empty state is visible.
3. ☐ **Single-fleet role (`ws-maintainer`):** don't look for a picker.
   - ✅ *(UI)* The team-dropdown trigger has count 0.
   - ✅ *(UI)* The **Manage automations** button has count 0. The test returns here.
4. ☐ **Everyone else:** for each scope in that role's list, select it in the team dropdown.
   - ✅ *(UI)* The dropdown reads the selected scope (asserted inside `selectByLabel()`).
   - ✅ *(UI)* The **Manage automations** button count is 0 — absence, not a disabled state, because the gate is `isGlobalAdmin`.

**Assessment**
- *Value:* the role half of the gate, now swept across each role's *own* picker rather than a fixed matrix — so a team admin is checked on the fleets they actually administer, and a single-fleet user on the one view they have. The `scopes: []` case is the genuinely new coverage: it proves the button is absent on the page shape where there is no scope to pick at all.
- *Coverage gaps:* **`ws-observer` is not covered here** although the sibling [`role-access.spec.ts`](../../tests/e2e/premium/software/role-access.spec.ts) (SWL-20) does cover it — the two role lists on the same page have drifted (5 there, 4 here). `global-observer-plus` and `global-technician` are in neither. Nothing checks that these roles can still *read* the software list beyond `goto()`'s `rowOrEmpty`, and the button's absence is never confirmed on the **Library** tab.
- *Redundancy:* SWL-15 is the free mirror minus the scope sweep; the picker-opening half now overlaps SWL-20, which logs in the same way, on the same page, to assert the same picker.
- *Efficiency / smells:* three dropdown round-trips per global role to re-assert a role-only gate — the spec's own comment concedes the gate is not team-gated and keeps the sweep to honour the original QA Wolf coverage. `scopes: []` reads as "no scopes" at the call site when it means "no picker". No `pageHealth` coverage (see SWL-11).

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

### SWL-16 · Software • inventory table › renders its columns and marks only Name and Hosts sortable

- **File:** [`playwright/tests/e2e/shared/software/titles-table.spec.ts`](../../tests/e2e/shared/software/titles-table.spec.ts)
- **Grep:** `npx playwright test -g "renders its columns and marks only Name and Hosts sortable"`
- **Projects:** premium **and** free — a `shared/` spec, so 1 declaration → 2 runtime tests · **Scope:** Unassigned on premium, n/a on free
- **Mode:** UI · **Isolation:** independent, read-only
- **Preconditions:** ambient host-reported software under the scope (the ~300 osquery-perf simulations supply it on premium; free has its own pool)
- **Data created:** none

**Flow**

1. ☐ Open `/software/inventory` via URL.
   - ✅ *(UI)* **Inventory** tab is `aria-selected` (catches a removed legacy redirect); a data row or the empty state is visible — `SoftwareTitlesPage.goto()`.
2. ☐ Select **Unassigned** in the team dropdown.
   - ✅ *(UI)* Dropdown reads `Unassigned` — `TeamDropdown.selectByLabel()`, which **returns immediately on free** (`SUITE !== 'premium'`), so the free run asserts nothing here and lists the whole instance.
3. ☐ Read the table's column headers.
   - ✅ *(UI)* They equal exactly `['Name', 'Version', 'Type', 'Vulnerabilities', 'Hosts']`, in order — `columnHeaders()` reads `thead th` and drops the blank trailing action column.
4. ☐ Look at each header for a sort control.
   - ✅ *(UI)* **Name** and **Hosts** each expose a `<button>` inside `thead` whose accessible name is the column — `sortControl()`.
   - ✅ *(UI)* **Version**, **Type** and **Vulnerabilities** expose none (`toHaveCount(0)`). Fleet renders a sortable header as `<button class="sortable-header">` and a non-sortable one as a plain div, so a zero count *is* "this column can't be sorted".

**Assessment**
- *Value:* one cheap, deterministic contract on the table shell, asserted on both tiers by folder placement rather than by a duplicated free spec. The named column list survives a column being inserted — the QA Wolf flow it replaced asserted `nth(0)/nth(2)/nth(4)`, which would have silently re-pointed.
- *Coverage gaps:* column *contents* are never asserted (no `---` rendering for a title with no vulnerabilities, no version formatting, no Type vocabulary); the **Library** tab's own columns (Version / Type / Hosts / Status) are covered by nothing in this area; the Filter modal and the "show versions" switch (`SoftwareTitlesPage.showVersionsSwitch`, modelled) are untouched; on free this is the only software-table assertion of any kind.
- *Redundancy:* the same five-name `COLUMNS` list is re-declared and re-asserted in [`role-access.spec.ts`](../../tests/e2e/premium/software/role-access.spec.ts) (SWL-20, for three of its five roles). Two copies can drift.
- *Efficiency / smells:* `goto()` + `teamDropdown.select()` are copy-pasted across all three tests in the file instead of a `beforeEach`.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-17 · Software • inventory table › sorting by Name orders the page in both directions

- **File:** [`playwright/tests/e2e/shared/software/titles-table.spec.ts`](../../tests/e2e/shared/software/titles-table.spec.ts)
- **Grep:** `npx playwright test -g "sorting by Name orders the page in both directions"`
- **Projects:** premium **and** free (1 declaration → 2 runtime tests) · **Scope:** Unassigned on premium
- **Mode:** UI · **Isolation:** independent, read-only
- **Preconditions:** more than one software title under the scope
- **Data created:** none

**Flow**

1. ☐ Open `/software/inventory`, select **Unassigned**.
2. ☐ Click the **Name** column header.
   - ✅ *(UI)* The URL gains `order_key=name` **and** `order_direction=asc` — asserted *before* the rows, because the click flips the URL well ahead of the re-fetch (`sortBy()`).
   - ✅ *(UI)* The table's loading overlay clears — `DataTable.waitForSettled()`. Fleet leaves the previous result on screen under a translucent overlay for the whole request, so a read taken mid-fetch reports stale rows.
3. ☐ Read the **Name** column.
   - ✅ *(UI)* More than one row rendered.
   - ✅ *(UI)* Values are non-decreasing under a **case-insensitive** `localeCompare` (`sensitivity: 'base'`) — the column uses a case-insensitive MySQL collation, so "Zoom" and "zoom" tie and their relative order is arbitrary.
4. ☐ Click **Name** again.
   - ✅ *(UI)* URL flips to `order_direction=desc`; table settles.
   - ✅ *(UI)* Values are non-increasing.
   - ✅ *(UI)* The descending page's first name differs from the ascending page's first name — a sort control that flipped the URL without re-querying would otherwise satisfy both order checks.

**Assessment**
- *Value:* proves Fleet's *server-side* ordering on the page it returned, plus that the control actually re-fetched. The deliberate scope reduction is the point: the source flow paged the whole table and diffed it against a locally-sorted copy, i.e. re-tested MySQL's collation over thousands of rows for minutes. The contract here is "the page Fleet returned is ordered" + "the order it was asked for is the order in the URL".
- *Coverage gaps:* only page one, so a server that orders each page independently would pass; the two directions are never checked to be exact reverses; no sort on the **Library** tab; pagination is never entered; the sort is not asserted to survive a scope change or a search.
- *Redundancy:* none.
- *Efficiency / smells:* `expect(descending[0]).not.toBe(ascending[0])` is a change-detector — it fails legitimately (though improbably) when the alphabetically first and last titles tie case-insensitively.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-18 · Software • inventory table › sorting by Hosts orders the page in both directions

- **File:** [`playwright/tests/e2e/shared/software/titles-table.spec.ts`](../../tests/e2e/shared/software/titles-table.spec.ts)
- **Grep:** `npx playwright test -g "sorting by Hosts orders the page in both directions"`
- **Projects:** premium **and** free (1 declaration → 2 runtime tests) · **Scope:** Unassigned on premium
- **Mode:** UI · **Isolation:** independent, read-only
- **Preconditions:** more than one software title under the scope, with a spread of host counts (the simulated pool supplies it; a scope with no hosts — e.g. Workstations — would fail the final assertion, which is why Unassigned is chosen)
- **Data created:** none

**Flow**

1. ☐ Open `/software/inventory`, select **Unassigned**.
2. ☐ Click the **Hosts** column header.
   - ✅ *(UI)* URL gains `order_key=hosts_count` and `order_direction=asc`; the table settles.
3. ☐ Read the **Hosts** column and parse each cell with `Number`.
   - ✅ *(UI)* More than one row rendered.
   - ✅ *(UI)* The numbers are non-decreasing.
4. ☐ Click **Hosts** again.
   - ✅ *(UI)* URL flips to `desc`; table settles.
   - ✅ *(UI)* The numbers are non-increasing.
   - ✅ *(UI)* The descending page's first count is **strictly greater** than the ascending page's first count — the "it actually re-queried" guard, stronger than SWL-17's string inequality.

**Assessment**
- *Value:* the numeric half of the same contract, and the one assertion in the file that couldn't pass on a frozen page.
- *Coverage gaps:* as SWL-17 — page one only, no cross-page ordering, no tie handling; nothing checks the rendered count against the hosts the title is actually on (the count links to a filtered hosts list that no software spec follows).
- *Redundancy:* structurally identical to SWL-17 with a different comparator — a merge candidate (one parameterised test over `[Name, name, caseInsensitive]` / `[Hosts, hosts_count, numeric]`).
- *Efficiency / smells:*
  - ~~⚠️ **Latent test bug.**~~ **Fixed 2026-09-28:** a local `hostCount()` strips thousands separators before parsing. Original finding: `columnValues('Hosts').map(Number)` parsed the *rendered* cell. Fleet formats large counts with a thousands separator, and `Number('1,234')` is `NaN`; every `<=` / `>=` comparison against `NaN` is false, so the `every()` check fails with an unhelpful message the moment one title is on ≥1,000 hosts. Both QA instances hold ~300 simulations today, so the bug is dormant — it would surface first on a loadtest-scale instance. `Number(v.replace(/,/g, ''))` fixes it.
  - Same copy-pasted `goto()` + `select()` prologue as SWL-16/17.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-19 · Premium • Software • Library vs Inventory › the Library tab is the installable subset of Inventory

- **File:** [`playwright/tests/e2e/premium/software/titles-table.spec.ts`](../../tests/e2e/premium/software/titles-table.spec.ts)
- **Grep:** `npx playwright test -g "the Library tab is the installable subset of Inventory"`
- **Project:** premium · **Scope:** Unassigned (`fleetId: 0`)
- **Mode:** UI · **Isolation:** independent, read-only — both counts are read, neither list is touched
- **Preconditions:** premium license (there is no Library tab on free, where every installer path is paywalled); **at least one installer-managed title under Unassigned** — see the smell below
- **Data created:** none

**Flow**

1. ☐ Open `/software/inventory?fleet_id=0`; select **Unassigned**.
   - ✅ *(UI)* Inventory tab `aria-selected`; a row or the empty state is visible.
   - ✅ *(UI)* The "**N items**" summary above the table parses to a number — a local `itemCount()` that matches `/([\d,]+)\s+items?/` on `.table-container__results-count` and throws with the raw text if it can't.
2. ☐ Click the **Library** tab.
   - ✅ *(UI)* URL matches `/software/library`; a row or the empty state is visible — `gotoLibraryTab()` (the click carries the current fleet scope).
   - ✅ *(UI)* Library's own "N items" summary parses.
3. ✅ *(UI)* `libraryCount < inventoryCount`. The **subset relation** is the invariant on purpose: the exact counts move with whatever the library lifecycle specs have added in a parallel worker.

**Assessment**
- *Value:* the only test that pins the Inventory/Library split from fleetdm/fleet#44467 — that Library is a strict subset (what Fleet can install) rather than a second rendering of the same list. Tier-correct: it sits in `premium/` because free has no Library tab at all.
- *Coverage gaps:* "subset" is asserted only as a smaller number — nothing checks that a Library row is *also* an Inventory row, that Library holds only installer-managed source types, or that a host-reported title never appears there. No Library columns, sort, pagination, or the **Self-service only** filter (`SoftwareLibraryPage.selfServiceSwitch` is modelled and used by **zero** specs).
- *Redundancy:* none.
- *Efficiency / smells:*
  - ⚠️ **Flake risk.** If Unassigned's Library is empty at that instant — `cleanup-setup` wipes it, and the lifecycle specs delete their own titles as they go — Fleet renders the empty state with no results-count element, so `innerText()` times out instead of reporting "the library is empty". The test quietly depends on a parallel worker having something in flight.
  - `itemCount()` is a third copy of the same regex ([`FleetMaintainedAppsPage.ts:124`](../../pages/software/FleetMaintainedAppsPage.ts#L124) has the other), declared in the spec rather than on `SoftwareTitlesPage` next to `resultsCount`.
  - Its parameter is typed structurally (`{ innerText(): Promise<string> }`) rather than as a `Locator`, which hides which POM member it expects.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-20 · Premium • Software • role access › `<role>` sees the software inventory scoped to their fleets

- **File:** [`playwright/tests/e2e/premium/software/role-access.spec.ts`](../../tests/e2e/premium/software/role-access.spec.ts)
- **Grep:** `npx playwright test -g "team-admin sees the software inventory scoped to their fleets"` (one test per role)
- **Project:** premium · **Roles:** `global-maintainer`, `global-observer`, `team-admin`, `ws-maintainer`, `ws-observer` — 1 declaration → **5 runtime tests**
- **Mode:** UI · **Isolation:** independent; each role logs into a **separate browser context** via `withStaticUser` (cached session file reused when it still authenticates, otherwise a fresh form login)
- **Preconditions:** static users provisioned + `FLEET_STATIC_USER_PASSWORD`; the **VMs** and **Workstations** fleets both exist — `team-admin` is admin of exactly those two, and VMs is the fleet holding the real hosts (so the one with software to list)
- **Data created:** none

**Per-role expectations**

| Role | Scope picker | Scope asserted on | Column list | Add software |
|---|---|---|---|---|
| `global-maintainer` | *contains* All fleets, Workstations, VMs, Unassigned | All fleets | full | visible |
| `global-observer` | same | All fleets | full | absent |
| `team-admin` | **exactly** `['VMs', 'Workstations']` — no aggregate entry | VMs | full | visible |
| `ws-maintainer` | none rendered | n/a | table shell only | visible |
| `ws-observer` | none rendered | n/a | table shell only | absent |

**Flow**

1. ☐ Log in as the static role user in a fresh context.
2. ☐ Open `/software/inventory` via URL.
   - ✅ *(UI)* Inventory tab `aria-selected`; a row or the empty state is visible.
3. ☐ **Single-fleet roles (`ws-maintainer`, `ws-observer`):** don't look for a picker.
   - ✅ *(UI)* The team-dropdown trigger has count 0 — a user with exactly one fleet gets no picker.
   - ✅ *(UI)* An `<h1>` reading **Workstations** is visible — Fleet puts the fleet's name in the page title instead.
4. ☐ **Everyone else:** click the team dropdown open and read every entry.
   - ✅ *(UI)* `team-admin`: the entry list **equals** `['VMs', 'Workstations']` — a subset with no aggregate, which is the whole point of the case.
   - ✅ *(UI)* global roles: the list **contains** All fleets / Workstations / VMs / Unassigned. Containment rather than equality, because gitops can add fleets to the instance.
   - ☐ Press **Escape** to close the menu, then select the role's scope.
   - ✅ *(UI)* The dropdown reads that scope (asserted inside `selectByLabel()`).
5. ☐ Look at the page's controls.
   - ✅ *(UI)* The search box (`Search by name or vulnerability`) is visible.
   - ✅ *(UI)* The **Filter** button is visible — `FilterModal.openButton`.
6. ☐ Look at the table.
   - ✅ *(UI)* Roles on a scope with data: headers equal `['Name', 'Version', 'Type', 'Vulnerabilities', 'Hosts']`.
   - ✅ *(UI)* `ws-*` roles: only a row-or-empty-state check — Workstations holds no hosts, so what its inventory lists is whatever the library specs have added at that moment; the table *shell* is what's asserted there.
7. ✅ *(UI)* **Add software** is visible for the maintainer/admin roles and has count 0 for the two observers.

**Assessment**
- *Value:* the only role matrix over the Software area's *read* view, and the only place three distinct picker shapes are pinned at once — global (aggregate + every fleet), team-admin (a subset with no aggregate), single-fleet (no picker, fleet name as `<h1>`). The `team-admin` exact-list assertion is the strongest: it is what would catch a fleet the user doesn't administer leaking into the picker. One spec with role as a dimension replaces four near-identical source flows.
- *Coverage gaps:* `global-observer-plus` and `global-technician` exist as static users and are not covered; there is no *negative* scope probe (team-admin navigating to `?fleet_id=<a fleet they don't administer>` — that lives in `tests/api/role-access/premium/`, at the endpoint layer, not the UI); the Library / OS / Vulnerabilities tabs and the title-detail page are not role-checked at all; `canAddSoftware` is asserted as button presence only and never followed into the add form, so nothing proves an observer can't reach `/software/add/package` by URL.
- *Redundancy:* `COLUMNS` duplicates SWL-16's list; the picker sweep overlaps SWL-13 in the sibling `manage-automations-access.spec.ts` — same login mechanism, same page, different button. The two specs' role lists have **drifted**: five roles here, four there.
- *Efficiency / smells:*
  - The `ws-*` branch hard-codes the heading text `Workstations` although the case is keyed only on `fleetOptions: null`; a third single-fleet role would silently assert the wrong fleet's name.
  - `expect(options).toEqual(['VMs', 'Workstations'])` is order-sensitive on a react-select menu.
  - `page.keyboard.press('Escape')` is raw Playwright in the spec — `TeamDropdown` models opening and selecting but not "close without selecting".
  - No `pageHealth` coverage: `withStaticUser` builds its own context, so the auto fixture watches an unrelated blank page (see SWL-11).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-21 · Premium • Software • Fleet-maintained filters › the platform filter narrows the catalog to apps offered on that platform

- **File:** [`playwright/tests/e2e/premium/software/fleet-maintained-filters.spec.ts`](../../tests/e2e/premium/software/fleet-maintained-filters.spec.ts)
- **Grep:** `npx playwright test -g "the platform filter narrows the catalog to apps offered on that platform"`
- **Project:** premium · **Scope:** Unassigned (`FLEET_ID = 0` — the catalog is identical on every fleet, and this one needs no id resolved)
- **Mode:** UI+API · **Isolation:** independent, read-only — nothing is added
- **Preconditions:** premium license; Fleet's Fleet-maintained catalog reachable (~1,400 platform entries today)
- **Data created:** none

**Flow**

1. ☐ Open `/software/add/fleet-maintained?fleet_id=0` via URL.
   - ✅ *(UI)* The **Add software** `<h1>` is visible (15 s) and the **Fleet-maintained** tab is `aria-selected` (15 s) — `expectLoaded()`. The generous waits are for Fleet's large Add-software JS bundle on the shared instance (fleetdm/fleet#45682).
2. ☐ Read the "**N items**" summary.
   - ✅ *(API)* It equals `GET /software/fleet_maintained_apps?fleet_id=0&per_page=1` → `count` — `countFleetMaintainedApps()`. **The count is per platform *entry*, not per row:** the table groups an app's macOS and Windows cells into one row while the count stays per-platform, so a 3-row "zoom" search reads "5 items". (The source flow's `expect(addCount).toEqual(searchedResults)` only held by luck.)
3. ☐ Pick **macOS** in the platform filter (Fleet's react-select `DropdownWrapper`; options carry `data-testid="dropdown-option"`).
   - ✅ *(UI)* The filter's single-value reads `macOS`, and the item count has changed — `selectPlatform()` settles on the count rather than on the click, because the filter is server-side (`platform=` on the apps request).
   - ✅ *(API)* The new count equals the API's count for `platform=darwin`.
   - ✅ *(UI)* It is smaller than the unfiltered total.
   - ✅ *(UI)* **No** rendered macOS cell shows `---` (`platformColumnCells('macOS')` = `td:nth-child(2)` on every row). A `---` cell is an app not offered on that platform, and none may survive the filter — this replaces the source flow's per-row loop over 900+ paged rows.
4. ☐ Pick **Windows**.
   - ✅ *(API)* count equals the API's `platform=windows` count; ✅ *(UI)* smaller than the total; ✅ *(UI)* different from the macOS count; ✅ *(UI)* no `---` in the Windows column.
5. ☐ Pick **All platforms**.
   - ✅ *(UI)* The item count is back to the original total.

**Assessment**
- *Value:* the only catalog-filter coverage, and the design is the right one — it cross-checks the rendered count against the API under the *same* filters instead of hard-coding numbers that the next Fleet release invalidates, and it proves the filter's actual promise ("every row offers this platform") with one count instead of a per-row page walk.
- *Coverage gaps:* only page one's cells are scanned for `---`, so a leak onto page 2 is invisible; the platform cell's third state — an already-added `success-icon` — isn't distinguished from an **Add** button here; the catalog's own sort and pagination are untouched; no error path (an unreachable catalog).
- *Redundancy:* none — `library.spec` uses the catalog but never its filters.
- *Efficiency / smells:*
  - `selectPlatform()` settles on `expect.poll(...).not.toBe(before)` — a change-detector. If two platforms ever returned the same count, or the call were made with the filter already on that value after an external change, the poll burns its full timeout instead of failing usefully.
  - Step 5 asserts the restored total with no settle of its own, leaning entirely on that internal poll.
  - `platformColumnCells()` is positional (`td:nth-child(2|3)`), documented as necessary because the header can't be reached from a cell — but it breaks silently if a column is inserted ahead of the platform columns.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-22 · Premium • Software • Fleet-maintained filters › "Hide added apps" leaves only entries that can still be added

- **File:** [`playwright/tests/e2e/premium/software/fleet-maintained-filters.spec.ts`](../../tests/e2e/premium/software/fleet-maintained-filters.spec.ts)
- **Grep:** `npx playwright test -g "Hide added apps"`
- **Project:** premium · **Scope:** Unassigned (`FLEET_ID = 0`)
- **Mode:** UI · **Isolation:** independent, read-only
- **Preconditions:** premium license; the catalog renders at least one still-addable app
- **Data created:** none

**Flow**

1. ☐ Open `/software/add/fleet-maintained?fleet_id=0`; read the unfiltered item count.
2. ☐ Flip the **Hide added apps** slider on.
   - ✅ *(UI)* Its `aria-checked` becomes `true` **and** the URL gains `status=available` — `setHideAddedApps()`; that query param is the signal Fleet issued the refetch.
   - ✅ *(UI)* The available-only count is ≤ the total. An exact difference is deliberately **not** asserted: `library.spec` and `install-software.spec` add and delete apps on this same scope in parallel, so a count read a second apart is a race, not a regression.
3. ☐ Look at the surviving rows.
   - ✅ *(UI)* At least one row is visible.
   - ✅ *(UI)* **Every** row contains an **Add** button — `rows.filter({ hasNot: Add }).toHaveCount(0)`. Checked as the presence of Add rather than the absence of the added-app icon, because one row can carry an already-added platform beside an available one: the filter drops *entries*, not rows.
4. ☐ Flip the slider back off.
   - ✅ *(UI)* `aria-checked` is `false` and the URL no longer carries `status=available`.
   - ✅ *(UI)* The count is ≥ the available-only count.

**Assessment**
- *Value:* pins the slider's contract at the level that matters to a user (everything still listed can still be added) without racing the parallel specs that mutate the same scope, and the entries-vs-rows distinction is a genuine product subtlety this encodes correctly.
- *Coverage gaps:* the interesting case — add an app, then confirm it *disappears* from the available-only view — is explicitly deferred to "the spec that adds one", and **no spec does it**. So nothing here proves the filter excludes anything: a filter that silently returned the whole catalog satisfies every assertion.
- *Redundancy:* none.
- *Efficiency / smells:*
  - `available ≤ total` and its mirror `total ≥ available` are near-tautologies — both hold when the slider does nothing.
  - The `hasNot` locator is assembled in the spec through `fleetMaintainedApps.page.getByRole(...)`, reaching back through the POM for the page handle; `rows` / `nameCells` are exposed raw so specs build their own filters.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-23 · Premium • Software • Fleet-maintained filters › searching by name narrows the catalog to matching apps

- **File:** [`playwright/tests/e2e/premium/software/fleet-maintained-filters.spec.ts`](../../tests/e2e/premium/software/fleet-maintained-filters.spec.ts)
- **Grep:** `npx playwright test -g "searching by name narrows the catalog to matching apps"`
- **Project:** premium · **Scope:** Unassigned (`FLEET_ID = 0`)
- **Mode:** UI · **Isolation:** independent, read-only
- **Preconditions:** the Fleet-maintained catalog still carries **Zoom** plus at least one sibling (`Zoom Rooms`, `Zoom Outlook Plugin`) — the term is chosen for having siblings, so a substring match is proven rather than a collapse to one exact hit
- **Data created:** none

**Flow**

1. ☐ Open `/software/add/fleet-maintained?fleet_id=0`; read the unfiltered item count.
2. ☐ Type `zoom` into the catalog search box.
   - ✅ *(UI)* Poll the rendered name cells until **more than one** is present *and* **every** one contains "zoom" case-insensitively. Polled rather than read once, because the search is debounced and server-side.
   - ✅ *(UI)* The item count is smaller than the unfiltered total.

**Assessment**
- *Value:* cheapest of the three filter tests, and the sibling-rich search term is a deliberate, well-reasoned choice.
- *Coverage gaps:* nothing asserts the search is *complete* — an app that should match but doesn't would pass; no empty-result state; no clearing the query back to the full catalog; no search by slug; and unlike SWL-21 the count is not cross-checked against the API (`countFleetMaintainedApps` has no `query` parameter to do it with).
- *Redundancy:* `FleetMaintainedAppsPage.searchFor()` does a narrower version of this (fill + assert the named row is visible) and is exercised by SWL-01; what's unique here is "*only* matching rows survive".
- *Efficiency / smells:* `expect.poll(...).toBe(true)` collapses two conditions into one boolean, so a failure reports `expected true, received false` — it can't say whether nothing matched or something non-matching leaked through.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-24 · Premium • Software • Add software validation › a `.<ext>` is refused before anything is uploaded

- **File:** [`playwright/tests/e2e/premium/software/add-software-validation.spec.ts`](../../tests/e2e/premium/software/add-software-validation.spec.ts)
- **Grep:** `npx playwright test -g "a .png is refused before anything is uploaded"` (also `.dmg`)
- **Project:** premium · **Scope:** Unassigned (`FLEET_ID = 0` — the form needs a fleet scope and this one needs no id resolved)
- **Mode:** UI · **Isolation:** independent, 1 declaration → **2 runtime tests**
- **Cases:** `pw-not-an-installer.png` (`image/png`, reason `unsupported file extension: png`) and `pw-not-an-installer.dmg` (`application/octet-stream`, reason `unsupported file extension: dmg` — a plausible-looking macOS installer that trips the *uninstall*-script branch of the same validation). Both are in-memory payloads (`Buffer.from('not a real installer')`) — **no fixture on disk**.
- **Preconditions:** premium license (the Custom package tab is paywalled on free)
- **Data created:** none — nothing is uploaded, which is exactly why these live here rather than inside `library.spec`'s add/delete lifecycle

**Flow**

1. ☐ Open `/software/add/package?fleet_id=0` via URL.
   - ✅ *(UI)* **Add software** heading and the **Custom package** tab are visible — `expectLoaded()`.
   - ✅ *(UI)* **Add software** is disabled (nothing staged yet).
2. ☐ Choose the file in the uploader. `setInputFiles` on the hidden `input#upload-file` bypasses the input's `accept` list exactly as a drag-and-drop or an "All files" picker would — which is the path this validation exists to catch.
3. ✅ *(UI)* An **error** toast reading **"Couldn't add."** appears, and its collapsed raw-response panel — reached by clicking **Expand error details**, a `role="region"` named "Error details" — contains the reason — `FileUploader.expectRejected()`. Asserting the toast alone would also pass for a *server-side* rejection that did upload, which is the distinction this test exists to draw: Fleet refuses in `PackageForm.onFileSelect`, where `getDefaultInstallScript` throws on an extension it has no recipe for.
4. ✅ *(UI)* The **Choose file** button is still showing — a rejected file is never staged.
5. ✅ *(UI)* **Add software** is still disabled.

**Assessment**
- *Value:* the only negative path in the entire add flow, and the three-part assertion (toast reason + uploader unchanged + button still disabled) is what proves "refused in the browser" rather than "uploaded then rejected". Cheap: no upload, no cleanup.
- *Coverage gaps:* no **server-side** rejection case (a valid extension with a corrupt payload); no oversized-file path; no duplicate-add rejection; the unused `.exe`, `.rpm` and `.tar.gz` fixtures in `test-data/` would each be a one-line case here; no negative path on the FMA / VPP / Android tabs (an invalid Android application ID is the obvious one). Also untested: that the form is still usable afterwards — a valid file staged *after* a rejection.
- *Redundancy:* none. The header explicitly hands the "Add software disabled under All fleets" half of the source flow to SWL-04.
- *Efficiency / smells:* the test title's extension is derived from the fixture name, so renaming a case silently renames the test and its grep.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-25 · Premium • Software • Custom icons › upload, replace and remove a custom icon

- **File:** [`playwright/tests/e2e/premium/software/custom-icons.spec.ts`](../../tests/e2e/premium/software/custom-icons.spec.ts)
- **Grep:** `npx playwright test -g "upload, replace and remove a custom icon"`
- **Project:** premium · **Scope:** Unassigned (`FLEET_ID = 0`)
- **Mode:** UI+API · **Isolation:** independent; `test.setTimeout(90_000)`; the seeded title is removed in a `finally`
- **Preconditions:**
  - premium license — the Edit-appearance modal is only reachable on a title an installer manages, and every Add-software path is paywalled on free;
  - the FMA slug **`anydesk/darwin`** is claimed by this test alone (`library.spec` claims `airtame`, `install-software.spec` claims eleven macOS slugs — adding one of those here would hand two specs the same title on the same fleet);
  - the generated icon fixtures in [`test-data/shared/images/`](../../test-data/shared/images/) (`make-icons.py`, standard library only, deterministic).
- **Data created:** the software title from `anydesk/darwin` on `fleet_id=0`, added **via API** (`addFmaToFleet`) as a precondition rather than through the UI; deleted in `finally` by `deleteSoftwareTitle`.

**Flow**

1. ☐ *(Setup, API)* Add the Fleet-maintained app **AnyDesk (macOS)** to Unassigned; read its title name back.
2. ☐ Open the dashboard → click **Software** in the navbar → select **Unassigned** → click the **Library** tab. (The Library tab is disabled under "All fleets", which is where premium lands, so the scope is picked first.)
3. ☐ Search the title name and click the row's first link.
   - ✅ *(UI)* The title's display heading is visible.
   - ✅ *(UI)* **No** custom-icon `<img>` (`.software-icon__software-img`, count 0). Fleet renders its *matched fallback* icon as a different element entirely, so this element's presence is the user-visible "a custom icon is in effect" signal.
   - ✅ *(API)* `GET /software/titles/:id?fleet_id=0` → `software_title.icon_url` is `null`.
4. ☐ Open **Actions → Edit appearance**. (An FMA title keeps the Actions dropdown; a premium *custom package* shows a pencil **Edit** button instead, and `openEditAppearance()` branches on which one is rendered.)
   - ✅ *(UI)* The `.edit-icon-modal` container and its **Display name** textbox are visible — `expectOpen()`.
5. ☐ Choose `fleet-test-icon-valid.png` (256×256, 567 B).
   - ✅ *(UI)* The staged file card reads `fleet-test-icon-valid.png`.
   - ✅ *(UI)* Its description reads **"Software icon • 256x256 px"**.
   - ✅ *(UI)* The admin preview pane renders the staged icon (`alt="Uploaded icon preview"`).
   - ☐ Switch the preview to the **Self service** tab.
   - ✅ *(UI)* That tab is `aria-selected` and the self-service icon preview (`alt="Uploaded self-service icon"`) is visible. Both panes render the staged icon **before anything is saved**.
6. ☐ Click **Save**.
   - ✅ *(UI)* Success toast **"Successfully edited `<title>`."**; the modal closes.
   - ✅ *(UI)* The custom-icon `<img>` is now visible on the detail page.
   - ✅ *(API)* `icon_url` now matches `/^\/api\//`.
7. ☐ Open `/software/library?fleet_id=0`, re-select **Unassigned**, search the title.
   - ✅ *(UI)* The list row renders the same `.software-icon__software-img` — which is what makes a custom icon useful: it identifies the title everywhere it's listed.
8. ☐ Reopen the title by URL and open **Edit appearance** again.
   - ✅ *(UI)* The stored icon is already staged (`hasStagedIcon()` — the file card is showing). This exercises `FileDetails`' pencil "Replace file" input rather than the empty uploader; the two inputs swap and exactly one exists at a time.
   - ☐ Choose `fleet-test-logo.png` (a second valid image, distinct in colour); ✅ *(UI)* the file card reads the new name; ☐ **Save**; ✅ *(UI)* the same success toast; ✅ *(UI)* a custom icon is still visible.
9. ☐ Open **Edit appearance** once more, click the trash control (`[data-testid="trash-icon"]` — the control is a bare `<label>` wrapped round an icon and computes no accessible name), then **Save**.
   - ✅ *(UI)* Success toast **"Successfully removed icon from `<title>`."**
   - ✅ *(UI)* The custom-icon `<img>` is gone (count 0) — back to Fleet's matched fallback.
   - ✅ *(API)* `icon_url` is `null` again.
10. ☐ *(Teardown, API)* Delete the title.

**Assessment**
- *Value:* a complete three-state lifecycle (none → custom → replaced → none) asserted at **both** layers on every transition — the rendered `<img>` and the stored `icon_url` — so a failure says which half broke. That pair is what replaced QA Wolf's seven per-step screenshots, and the list-row check in step 7 is what proves the icon travels beyond the detail page.
- *Coverage gaps:* the **replace** step never proves the bytes changed — both fixtures satisfy "a custom-icon img is visible", so Fleet keeping the old icon would pass (comparing `icon_url` before/after, or fetching the blob, would close it); the Self-service preview is checked as an element, never against the actual end-user Self-service page; no Cancel/discard path; no check that a neighbouring title's icon is unaffected; the icon is never asserted on the **Inventory** tab or on a host's software list.
- *Redundancy:* steps 2–3 (dashboard → navbar → scope → Library → search → row link) are copy-pasted verbatim into SWL-26 and SWL-27, and near-verbatim (plus a Type-cell filter) into SWL-28/29.
- *Efficiency / smells:*
  - `softwareLibrary.table.rowWith(titleName).getByRole('link').first().click()` is the `.first()`-chain [`tests/README.md`](../../tests/README.md) lists as an anti-pattern; `DataTable.firstRowPrimaryLink` exists and is used by **no** software spec.
  - The Library row's icon is asserted with a raw `.locator('.software-icon__software-img')` in the spec while `SoftwareTitleDetailPage.customIcon` already models that class.
  - `storedIconUrl()` is a local re-implementation of a `GET /software/titles/:id` read; `getSoftwareTitle()` is imported in the same file but returns only `{id, name, source}`, so it can't express `icon_url`.
  - Setup is API while the feature under test is UI — correct for a precondition, but it means a 90 s budget is spent on a real CDN fetch to reach a title-detail page.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-26 · Premium • Software • Custom icons › only square PNGs of the right size and dimensions are accepted

- **File:** [`playwright/tests/e2e/premium/software/custom-icons.spec.ts`](../../tests/e2e/premium/software/custom-icons.spec.ts)
- **Grep:** `npx playwright test -g "only square PNGs of the right size and dimensions are accepted"`
- **Project:** premium · **Scope:** Unassigned (`FLEET_ID = 0`)
- **Mode:** UI+API · **Isolation:** independent; `test.setTimeout(90_000)`; title removed in a `finally`
- **Preconditions:** premium license; the FMA slug **`archaeology/darwin`** claimed by this test alone (small, fast to add, used by no other spec); the five icon fixtures
- **Data created:** the title from `archaeology/darwin` on `fleet_id=0`. Note the test **ends with a valid icon saved on it** — harmless, because the title is deleted immediately afterwards.

**Flow**

1. ☐ *(Setup, API)* Add `archaeology/darwin` to Unassigned; read its title name.
2. ☐ Dashboard → **Software** → select **Unassigned** → **Library** tab → search the title → click the row's first link.
3. ☐ Open **Actions → Edit appearance**.
4. ☐ For each of four fixtures in turn, choose it and read the toast:

   | fixture | what it violates | expected toast |
   |---|---|---|
   | `fleet-test-icon-oversize.png` | 256×256 but ~192 KB (filled from an LCG so PNG can't deflate it under the cap) | `Couldn't edit. Icon must be 100KB or less.` |
   | `fleet-test-icon-not-square.png` | 200×256 | `Couldn't edit. Icon must be square, between 120x120px and 1024x1024px.` |
   | `fleet-test-icon-too-large.png` | 1025×1025 — one pixel past the maximum | same dimension error |
   | `fleet-test-icon-too-small.png` | 100×100 — under the 120 minimum | same dimension error |

   - ✅ *(UI)* An error toast carrying that exact message — `EditAppearanceModal.expectIconRejected()`.
   - ✅ *(UI)* The empty **Choose file** uploader is still showing.
   - ✅ *(UI)* `hasStagedIcon()` is `false` — a rejected file is never staged, so nothing could have been uploaded.
   - ☐ Dismiss every toast before the next attempt — error toasts never auto-dismiss, so a leftover card would satisfy the next assertion (`Toast.dismissAll()`).
5. ☐ Choose `fleet-test-icon-valid.png`.
   - ✅ *(UI)* The file card reads its name.
   - ✅ *(UI)* **No** error toast at all (`toast.error` count 0) — the negative control: a file inside every limit stages cleanly and leaves nothing behind.
6. ☐ Click **Save**.
   - ✅ *(UI)* Success toast **"Successfully edited `<title>`."**
   - ✅ *(API)* `icon_url` matches `/^\/api\//`.
7. ☐ *(Teardown, API)* Delete the title.

**Assessment**
- *Value:* four boundary cases against one client-side validator, each with its own asserted message, plus a negative control. The fixtures are **generated, not downloaded**, precisely so each one is a number on the wrong side of a Fleet constant (`MAX_FILE_SIZE`, `MIN_DIMENSION`, `MAX_DIMENSION` in `EditIconModal`) — see [`test-data/shared/images/README.md`](../../test-data/shared/images/README.md). Nothing leaves the browser on the four rejections, so the whole case set is fast.
- *Coverage gaps:* no **non-PNG** case (a JPEG or SVG at valid dimensions), although the modal is documented PNG-only and that is the likeliest thing a real user does; no exactly-at-boundary *pass* (120×120, 1024×1024, exactly 100 KB); the size and dimension rules are never violated together; no server-side rejection.
- *Redundancy:* shares its entire navigation prologue with SWL-25/27; step 6 duplicates SWL-25 step 6 minus the UI assertion.
- *Efficiency / smells:*
  - The success path is asserted **through the API only** — `customIcon` is never checked visible here, though SWL-25 does exactly that two lines of setup away.
  - Adding a whole Fleet-maintained app (a real CDN fetch under a 90 s budget) to exercise a *client-side* file validator is expensive: the validator never reaches the server, so any title with an Edit-appearance modal would serve.
  - `expectIconRejected()` asserts only the toast; the "uploader unchanged / nothing staged" pair lives in the spec, so a future caller of the POM method silently gets the weaker check.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-27 · Premium • Software • Custom display name › setting and clearing a display name changes how the title is listed

- **File:** [`playwright/tests/e2e/premium/software/display-name.spec.ts`](../../tests/e2e/premium/software/display-name.spec.ts)
- **Grep:** `npx playwright test -g "setting and clearing a display name changes how the title is listed"`
- **Project:** premium · **Scope:** Unassigned (`FLEET_ID = 0`)
- **Mode:** UI (the only API calls are the seed and the teardown) · **Isolation:** independent; `test.setTimeout(90_000)`; title removed in a `finally`
- **Preconditions:** premium license (the modal is only reachable on a title an installer manages); the FMA slug **`clockify/darwin`**, claimed by this spec alone
- **Data created:** the title from `clockify/darwin` on `fleet_id=0`, plus the display-name override it sets. The name is stamped `PW Display Name <Date.now()>` so a rerun can't find a stale row from a previous run and call it a pass.

**Flow**

1. ☐ *(Setup, API)* Add `clockify/darwin` to Unassigned; read its title name.
2. ☐ Dashboard → **Software** → select **Unassigned** → **Library** tab → search the title → open it.
3. ✅ *(UI)* The display heading is visible; **its text is captured as the baseline.** Fleet normalises a handful of well-known package names for display, so the *rendered* heading — not the API's `name` — is what must come back at the end.
4. ☐ Open **Actions → Edit appearance** and type the new display name.
   - ✅ *(UI)* The **Fleet** preview card contains the new name.
   - ☐ Switch the preview to the **Self service** tab.
   - ✅ *(UI)* The Self-service preview card contains it too. Both panes track the field **live**, before anything is saved.
5. ☐ Click **Save**.
   - ✅ *(UI)* Success toast **"Successfully renamed `<title>` to `<display name>`."**; the modal closes.
   - ✅ *(UI)* The detail page's heading now reads exactly the display name.
6. ☐ Open `/software/library?fleet_id=0`, re-select **Unassigned**, and search **by the display name**.
   - ✅ *(UI)* A row containing the display name is visible — the override has to reach the list, which is the point of setting it.
7. ☐ Reopen the title by URL → **Edit appearance**.
   - ✅ *(UI)* The **Display name** field is pre-filled with the saved value.
   - ☐ Clear the field and **Save**.
   - ✅ *(UI)* Success toast **"Successfully removed custom name for `<display name>`."** — clearing drops the override rather than saving an empty name.
   - ✅ *(UI)* The heading is back to the baseline captured in step 3.
8. ☐ *(Teardown, API)* Delete the title.

**Assessment**
- *Value:* a complete set → list → clear round-trip with the exact toast copy in **both** directions, and the baseline capture in step 3 is what makes "clear" verifiable rather than assumed. Searching the Library *by the override* (step 6) is the strongest assertion here: it proves the rename reached Fleet's search path, not just the rendered heading.
- *Coverage gaps:* the override is never read back at the API layer — SWL-25 and SWL-28 both cross-check a stored value, so this one is the outlier, and a heading rendered from client state would pass; no check that the **Inventory** tab, a host's software list or the activity feed picks the name up; no validation cases (over-long, duplicate of another title's name, leading/trailing whitespace, an override equal to the original); no Cancel path; the icon half of the same modal is untouched (SWL-25 owns it) even though the two share one Save.
- *Redundancy:* the navigation prologue is shared with SWL-25/26; the preview assertions mirror SWL-25's icon-preview ones.
- *Efficiency / smells:* the same `.first()` row-link chain as SWL-25; `modal` is captured before a `goto()` that re-navigates the page (safe, because the POM resolves its locators lazily against the same `page`, but it reads as if the reference could go stale).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-28 · Premium • Software • Version pinning › pinning to latest, an exact version and a major version each take effect

- **File:** [`playwright/tests/e2e/premium/software/version-pinning.spec.ts`](../../tests/e2e/premium/software/version-pinning.spec.ts)
- **Grep:** `npx playwright test -g "pinning to latest, an exact version and a major version each take effect"`
- **Project:** premium · **Scope: the QA fleet** (`qaFleetId` worker fixture) — **not** Unassigned or Workstations
- **Mode:** UI+API · **Isolation:** serial describe shared with SWL-29 (both mutate the same durable shelf and can land on the same title); `test.setTimeout(90_000)`
- **Preconditions:**
  - the durable **Fleet-maintained app shelf** on the QA fleet (10 apps × macOS/Windows, [`gitops/premium-fleetqa/fleets/qa.yml`](../../../gitops/premium-fleetqa/fleets/qa.yml)) — see the area intro;
  - **Postman (macOS)** specifically must be on it. `requireTitle()` fails with the "re-apply that gitops file" instruction if it isn't;
  - Fleet has at least one cached build for it (`versions.length > 0`);
  - it must arrive **unpinned** (`pinned_version === ''`). Arriving pinned is asserted as a failure whose message says an earlier run died before restoring it — and an exact pin makes Fleet's hourly `maintained_apps_auto_update` cron skip the title, which freezes version history **for the whole shelf**.
- **Data created:** none — the pin is mutated and restored to `''` in a `finally` via `setPinnedVersion()`.

**Flow**

1. ☐ *(Setup, API)* List the QA fleet's Fleet-maintained titles and pick **Postman / darwin** by name **and** platform — the shelf carries the same app twice, once per platform, under one name.
   - ✅ *(API)* The title exists and has ≥1 cached build.
2. ☐ *(Setup, API)* Read its stored package. ✅ `pinned_version` is `''`.
3. ☐ Open the dashboard → **Software** → select the **QA** fleet (`selectByLabel`, since QA is outside the typed `TeamScope` matrix) → click the **Library** tab → search "Postman".
4. ☐ Click the row whose **Type** cell reads **Application (macOS)** — the name alone is ambiguous across the two platform titles.
   - ✅ *(UI)* The display heading is visible; its text is captured for the save toasts.
5. ✅ *(UI)* The installer accordion row carries the **Latest** badge — an unpinned app tracks latest.
6. ☐ Open **Actions → Versions**.
   - ✅ *(UI)* The radio labels equal exactly `['Automatically update to latest', …one 'Pin to <v>' per cached version, newest first…, 'Pin to major version (<newest major>)']` — derived from the API's version list, never hard-coded, because Fleet re-publishes upstream releases and the cache grows.
   - ☐ **Cancel**.
7. ☐ For each of three targets in order — **exact (newest) → major → latest**:
   - ☐ Open **Actions → Versions**, click the target's radio *label* (the real `<input>` is `display:none`), then **Save**.
   - ✅ *(UI)* Success toast **"Successfully updated `<display name>` version."**; the modal closes.
   - ✅ *(UI)* Exactly one pin badge is present and it is the right one — `Latest` / `Pinned` / `Major version` counts are 1/0/0, 0/1/0, 0/0/1 as appropriate. Asserted as **counts**, not visibility, because the three shapes are mutually exclusive and a stale second badge is the bug a count catches.
   - ☐ Reopen **Versions**.
   - ✅ *(UI)* The saved radio is checked — what the next admin to open the modal sees.
   - ✅ *(UI)* **Save** is **disabled**, because nothing has changed.
   - ☐ **Cancel**.
   - ✅ *(API)* `software_package.pinned_version` equals `''` / `<version>` / `^<major>` — `pinTargetApiValue()`.
8. ☐ *(Teardown, API)* Clear the pin.

**Assessment**
- *Value:* the only coverage of Fleet's version-pin feature and the only spec that reads from the durable QA shelf. Three layers per case — the radio the modal reopens on, the accordion badge, the stored value — is exactly right, because they fail independently. The mutual-exclusion badge counts and the "Save is disabled when nothing changed" check are both assertions a screenshot-driven flow would have missed.
- *Coverage gaps:* nothing proves a pin changes **what would be installed** — that needs a host install, which this area has none of; the accordion's inert `--inactive` rollback rows are never inspected; the Windows shelf title is never touched; the Versions modal is only ever opened from **Actions**, never from the badge (which is itself a button that opens the same modal); there is no negative case pinning down that a *custom package* title has no Versions item at all.
- *Redundancy:* none.
- *Efficiency / smells:*
  - The unpinned precondition is a **test failure with an operational cause**: one aborted run leaves this test red until somebody clears the pin by hand. Deliberate and clearly messaged, but worth knowing before triaging it as a flake.
  - It mutates a **shared, durable, gitops-provisioned** resource that no cleanup project touches. The only guard is the `finally`, which doesn't run on a `SIGKILL`.
  - `openLibraryTitle()` ends in the same `.first()` link chain as SWL-25/27, with `filter({ hasText: TYPE_CELL[...] })` added; the Type text is matched anywhere in the row, so a title whose *name* contained "Application (macOS)" would also match.
  - `PIN_SHAPES_APP` hard-codes "Postman": a `qa.yml` change that drops it breaks this test (with a good message, but it still breaks).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-29 · Premium • Software • Version pinning › pinning to an older version stores that build, not the newest

- **File:** [`playwright/tests/e2e/premium/software/version-pinning.spec.ts`](../../tests/e2e/premium/software/version-pinning.spec.ts)
- **Grep:** `npx playwright test -g "pinning to an older version stores that build, not the newest"`
- **Project:** premium · **Scope:** the QA fleet · serial step 2 of 2 (no shared closure state, but both tests mutate the shelf)
- **Mode:** UI+API · **Isolation:** serial with SWL-28
- **Preconditions — and this one can skip:** the shelf exists, and **some app on it has cached ≥ 2 builds**. The test takes whichever shelf title has the most cached versions (ties break on the API's `order_key=name`, so the choice is stable within a run) and calls **`test.skip`** when even that one has fewer than two: every app arrives with exactly one cached build and gains a second only when upstream ships an update and Fleet's hourly cron pulls it — nothing a test can arrange, so it stays a **data-availability precondition** (inline reason only; per `CLAUDE.md` these are not tracked as debt). The chosen title must also arrive **unpinned**, asserted with the same "an earlier run died before restoring it" message as SWL-28.
- **Data created:** none — pin restored in a `finally`.

**Flow**

1. ☐ *(Setup, API)* List the QA fleet's Fleet-maintained titles.
   - ✅ *(API)* The list is non-empty.
   - ☐ Pick the title with the most cached versions. **Skip the test** if it has fewer than two.
2. ☐ *(Setup, API)* ✅ That title's `pinned_version` is `''`.
3. ☐ Dashboard → **Software** → **QA** → **Library** → search the title → click the row matching its **Type** cell for that title's platform.
   - ✅ *(UI)* Display heading visible; text captured for the save toast.
4. ☐ Open **Actions → Versions**, select **Pin to `<second-newest version>`**, **Save**.
   - ✅ *(UI)* Success toast; the modal closes.
5. ✅ *(UI)* Badges read `Pinned` ×1, `Latest` ×0, `Major version` ×0.
6. ☐ Reopen **Versions**.
   - ✅ *(UI)* The older version's radio is checked.
   - ✅ *(UI)* The **newest** version's radio is still offered and is **not** checked — pinning back a version doesn't drop the newer build from the cache, which is what makes the pin reversible.
   - ☐ **Cancel**.
7. ✅ *(API)* `pinned_version` is the older version **and** `software_package.version` is that same older build — the active installer follows the pin, so the library serves the older build from here on.
8. ☐ *(Teardown, API)* Clear the pin.

**Assessment**
- *Value:* the one pin shape SWL-28 structurally cannot reach (a freshly added app caches exactly one build — which is also why the whole QA shelf exists). Step 7's `version === older` is the sharpest assertion in the pair: it proves the pin swapped the **active installer**, not merely a stored preference.
- *Coverage gaps:* skippable by design, so on a shelf that hasn't rolled over yet it contributes nothing and says so only in the run report — nothing surfaces "this has been skipping for weeks"; the title it lands on differs run to run, so a failure names a different app each time; the detail page's own **Versions** table (as opposed to the modal) is never read.
- *Redundancy:* the badge / reopen / stored-value assertions duplicate SWL-28's loop body.
- *Efficiency / smells:* `test.skip()` fires **after** two API round-trips, so a skipped run still pays for them (unavoidable — those calls are what answer the skip condition). The `reduce` that picks "most versions" has no tiebreak of its own and leans on the API's name ordering.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-30 · Premium • Software • Script-only package › a `.sh` is added as a script-only package and removed again

- **File:** [`playwright/tests/e2e/premium/software/script-only-package.spec.ts`](../../tests/e2e/premium/software/script-only-package.spec.ts)
- **Grep:** `npx playwright test -g "a .sh is added as a script-only package and removed again"`
- **Project:** premium · **Scope:** Unassigned only (`FLEET_ID = 0`) — `library.spec` already covers add/delete across scopes and package kinds; what's unique here is the script-only *shape*
- **Mode:** UI+API · **Isolation:** independent; `test.setTimeout(90_000)`; an API `deleteSoftwareTitle` in `finally` as a safety net, zeroed once the UI delete succeeds
- **Preconditions:** premium license (every Add-software path is paywalled on free). Fixture [`test-data/shared/software/fleet-playwright-script-package.sh`](../../test-data/shared/software/fleet-playwright-script-package.sh) — 258 bytes, writes a marker under `/tmp` and exits 0 on macOS and Linux. Fleet titles a script package after its **filename minus the extension**, so the title is `fleet-playwright-script-package`: unique across the suite, which is what keeps a parallel worker from adding a second package to the same title and making the Library accordion ambiguous.
- **Data created:** the software title `fleet-playwright-script-package` on `fleet_id=0` — deleted **through the UI** inside the same test.

**Flow**

1. ☐ Open the dashboard → **Software** → select **Unassigned** → click **Add software** → open the **Custom package** tab.
2. ☐ Choose the `.sh` in the uploader.
   - ✅ *(UI)* The staged file card's name reads `fleet-playwright-script-package.sh`.
   - ✅ *(UI)* Its description reads **"macOS & Linux"** — the platforms Fleet says the file can target.
   - ✅ *(UI)* The shell-script graphic (`[data-testid="file-sh-graphic"]`) is showing. Fleet picks the graphic from the extension and stamps it with a testid; nothing in its role or text distinguishes it.
3. ☐ Click **Add software** (✅ *(UI)* enabled first).
   - ✅ *(UI)* Redirect to `/software/titles/:id` within 60 s; success toast matching `/successfully added/`.
   - ✅ *(UI)* The id parsed out of the URL is > 0.
4. ✅ *(UI)* On the title detail page, four things at once:
   - the display heading reads exactly `fleet-playwright-script-package`;
   - the summary card's **Type** line reads **"Script-only package (macOS & Linux)"**;
   - the header pills are exactly `['Custom package']`;
   - the installer accordion row contains the filename **and** the text **"Added less than a minute ago"**.
5. ✅ *(API)* `GET /software/titles/:id` → `software_package.install_script` equals the fixture file's contents **byte for byte** (read off disk in the test), and `uninstall_script` is the empty string. This is the defining property of a script-only package: the uploaded file *is* the install script, and Fleet generates no uninstall counterpart.
6. ✅ *(API)* An `added_software` activity with `details.software_title === 'fleet-playwright-script-package'`, actor = the suite admin — `assertActivity`.
7. ☐ Open `/software/library?fleet_id=0`, re-select **Unassigned**, search the title.
   - ✅ *(UI)* A row with that name is visible.
8. ☐ Reopen the title detail and delete from the accordion row (expand → **Delete this version** → confirm in the **Delete package** modal).
   - ✅ *(UI)* The delete modal is visible before confirming; the accordion row is hidden afterwards.
   - ✅ *(API)* A `deleted_software` activity for the same title.
9. ☐ Open the Library again and re-select **Unassigned**.
   - ✅ *(UI)* A row or the empty state is visible, and no row carries the title name (`toHaveCount(0)`). No search is applied first, deliberately — Library's search input is disabled when the table is empty, and Library lists only installer-managed titles, so a bare row-count on the name is unambiguous.

**Assessment**
- *Value:* the only coverage of Fleet's fourth custom-package shape, and the one shape whose **semantics** differ rather than just the file extension. The byte-for-byte `install_script === fixture` assertion is the sharpest thing in this area, and `uninstall_script === ''` pins the "no uninstall counterpart" rule. The uploader-preview assertions cover what the user sees *before* committing, which no other add path checks.
- *Coverage gaps:* running the package on a host is out of scope by design (see the area's standing fact); no **Edit software** round-trip on a script package, so nothing says whether its install script can be edited; no `.ps1` / Windows script-package equivalent; no Workstations variant, so the Type line is proved only on Unassigned; the activity feed's *rendered* copy is not checked (SWL-03 does that for the other kinds).
- *Redundancy:* the add, delete and library-listing halves duplicate SWL-01/02's `custom` case; only steps 2, 4 and 5 are unique.
- *Efficiency / smells:*
  - Three raw `page.locator('.file-details__*')` calls in the spec — the same classes [`EditAppearanceModal`](../../pages/components/EditAppearanceModal.ts#L63) already models. `FileUploader` models the input and the error panel but **not** the staged-file card, so every caller re-declares it.
  - `page.waitForURL(...)` inline in the spec where `softwareCustomPackage.uploadPackage()` would do the whole stage → submit → wait → toast → parse-id sequence. The spec re-implements it in order to slot the preview assertions in between, which the POM offers no hook for.
  - ⚠️ **"Added less than a minute ago" is a wall-clock assertion.** It holds today because it runs right after the upload, but the upload alone is allowed 60 s — on a slow instance the row's copy becomes "Added about a minute ago" and the test fails with no tolerance and no useful message.
  - `titleId = 0` doubles as the "already cleaned up" sentinel, so a parse failure (`NaN`) would skip the `finally` delete rather than run it — `expect(titleId).toBeGreaterThan(0)` catches that first, but the coupling is fragile.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-31 · Premium • Software • Package scripts › the installer downloads byte-identical and Advanced options shows its stored scripts

- **File:** [`playwright/tests/e2e/premium/software/package-scripts.spec.ts`](../../tests/e2e/premium/software/package-scripts.spec.ts)
- **Grep:** `npx playwright test -g "the installer downloads byte-identical and Advanced options shows its stored scripts"`
- **Project:** premium · **Scope:** Unassigned (`FLEET_ID = 0`)
- **Mode:** UI+API · **Isolation:** independent; `test.setTimeout(90_000)`; API delete in `finally`
- **Preconditions:** premium license. Fixture [`test-data/linux/software/fleet-playwright-pkg_1.0.0_amd64.deb`](../../test-data/linux/software/fleet-playwright-pkg_1.0.0_amd64.deb) — an inert **662-byte** generated Debian package (one marker file under `/usr/share/fleet-playwright-pkg/`, no maintainer scripts), rebuilt deterministically by `make-deb.py` to sha256 `bf7b4fba…0931a6d5`. It exists so the **title name `fleet-playwright-pkg` is unique across the suite** — every real `.deb` in `test-data/` shares a title with another spec's fixture ("step-cli", "Sublime Text"), and a premium title can hold several packages, so two specs uploading to the same title on the same fleet leave the accordion with two rows and every row-scoped locator ambiguous. A `.deb` in particular because Fleet generates **both** an install and an uninstall script for it, and both are short enough for Ace to render whole (Ace virtualises long documents, so a real installer's scripts would only be partly in the DOM).
- **Data created:** the title `fleet-playwright-pkg` on `fleet_id=0` — deleted through the UI inside the test.

**Flow**

1. ☐ Dashboard → **Software** → **Unassigned** → **Add software** → **Custom package** tab → upload the `.deb`.
   - ✅ *(UI)* Progress modal (if shown) clears ≤45 s; redirect to `/software/titles/:id` ≤30 s; success toast `/successfully added/` — `uploadPackage()` returns the parsed title id.
   - ✅ *(UI)* The display heading reads exactly `fleet-playwright-pkg`.
   - ✅ *(API)* The title has an installer package (`getSoftwarePackage` is not null).
2. ☐ Expand the installer accordion row and click **Download installer**. Fleet mints a one-shot token and triggers a synthetic `<a download>` click, so the browser's download event is the only signal the request happened — `SoftwareInstallerCard.download()`.
   - ✅ *(UI)* The suggested filename is `fleet-playwright-pkg_1.0.0_amd64.deb`.
   - ✅ The downloaded bytes' SHA-256 equals the fixture on disk's SHA-256 — the installer Fleet serves is the one that was uploaded.
   - ✅ *(API)* The same hash equals the `hash_sha256` Fleet recorded at upload. Hashing both ways is deliberate: a mismatch then says whether the wrong **file** was served or the wrong **hash** was stored.
3. ☐ Click **Edit software** in the expanded accordion row.
   - ✅ *(UI)* The **Edit package** modal (that title for a premium multi-package title; "Edit software" otherwise) is open with its Self-service switch visible — `expectOpen()`.
4. ☐ Expand **Advanced options** (idempotent — skipped if the editors already render).
   - ✅ *(UI)* The install- and uninstall-script Ace editors are visible.
5. ✅ *(UI vs API)* Each of the four editors' rendered code equals the corresponding stored script, field by field: **install**, **uninstall**, **pre-install query**, **post-install**. Both sides go through `normalizeScript()` (trailing whitespace stripped, blank lines dropped) because Ace renders one element per line and drops blank lines from its text layer, so `innerText` is never byte-identical to what Fleet stored. This is the assertion QA Wolf's screenshot of the uninstall editor was standing in for.
6. ✅ *(UI)* The install script contains `$INSTALLER_PATH` and the uninstall script contains `fleet-playwright-pkg` — a generated `.deb` install script drives apt against `$INSTALLER_PATH` and the uninstall purges the package by the name read off the control file. These pin step 5 against passing on two matching **empty** strings if Fleet ever stopped generating scripts.
7. ☐ Click **Cancel**. ✅ *(UI)* the modal is hidden.
8. ☐ Delete from the accordion row (expand → **Delete this version** → confirm).
   - ✅ *(UI)* The accordion row is hidden afterwards.

**Assessment**
- *Value:* two promises nothing else in the suite checks. The download round-trip is the **only** exercise of Fleet's installer-*serving* path anywhere (SWL-02's assessment flags Download as never clicked — this closes it), and hashing three ways localises the failure. The Advanced-options comparison is the only assertion that the scripts a user reads are the scripts Fleet will run, and the `$INSTALLER_PATH` / package-name guards stop it degenerating into `'' === ''`.
- *Coverage gaps:* entirely read-only on the scripts — nothing **edits** one and re-reads it, which remains the largest functional gap in the Edit modal (SWL-06 covers only the Self-service switch); the pre-install-query and post-install comparisons are vacuous for a generated `.deb` (both sides empty); no Download on an FMA / VPP / Android title; nothing tests that the one-shot download token actually expires; no unauthorized-download probe; the Self-service switch the modal opens on is not asserted to be off.
- *Redundancy:* the add and delete halves duplicate SWL-01/02's `custom` Linux case.
- *Efficiency / smells:*
  - Two of the four editor comparisons currently prove nothing; only install and uninstall carry a `toContain` guard.
  - The Edit modal is opened here via `installerCard.editSoftwareButton`, while SWL-06 opens the same modal via the **All hosts** label badge — two different affordances for one modal across two specs (SWL-06's "no Edit affordance is modelled" note predates `editSoftwareButton`).
  - `download.path` is Playwright's temp path; nothing asserts the file is non-empty before hashing, so a zero-byte download fails on a hash mismatch rather than on the obvious cause.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-32 · Premium • Software • All fleets scope across the navbar › All fleets sticks from Hosts to Policies, and Controls falls back to a fleet

- **File:** [`playwright/tests/e2e/premium/software/no-teams-views.spec.ts`](../../tests/e2e/premium/software/no-teams-views.spec.ts) (second describe)
- **Grep:** `npx playwright test -g "All fleets sticks from Hosts to Policies"`
- **Project:** premium · **Scope:** All fleets · **Isolation:** independent, read-only
- **Preconditions:** premium license; at least one real fleet exists for Controls to fall back to
- **Data created:** none
- **Cross-link:** the Unassigned counterpart, within one page's tabs, is **SWL-09**

**Flow**

1. ☐ Open the dashboard and select **All fleets** in the team dropdown.
2. ☐ Click **Hosts** in the navbar.
   - ✅ *(UI)* The Hosts page's team dropdown still reads **All fleets**.
3. ☐ Click **Software**. ✅ *(UI)* the dropdown reads **All fleets**.
4. ☐ Click **Reports**. ✅ *(UI)* the dropdown reads **All fleets**.
5. ☐ Click **Policies**. ✅ *(UI)* the dropdown reads **All fleets**.
   *(Each assertion carries a per-step message naming the page, so a failure says which hop dropped the scope.)*
6. ☐ Click **Controls**.
   - ✅ *(UI)* The URL carries a concrete `fleet_id=<n>` — Controls configures one fleet at a time, so it cannot honour the aggregate and lands on a real fleet instead of rendering an empty scope.
   - ✅ *(UI)* Its team dropdown does **not** read All fleets.
   - ☐ Open that dropdown. ✅ *(UI)* its entries do **not** include **All fleets** — the aggregate is dropped from the picker entirely, not merely left unselected.

**Assessment**
- *Value:* the counterpart to SWL-09 on the other axis — one scope across five *different* pages rather than one page's tabs — and it pins the single deliberate exception instead of papering over it. The "All fleets isn't even in Controls' picker" assertion is what separates an intended fallback from a bug.
- *Coverage gaps:* the walk never returns to another page after Controls, so nothing proves the fallback doesn't **poison** the remembered scope for the next navigation — which is precisely the localStorage hazard [`CLAUDE.md`](../../CLAUDE.md) warns about ("some preserve the last-used team via localStorage and render the wrong scope even though the URL is correct"). Settings, Queries and the dashboard itself are outside the sweep. The assertion is on the dropdown **label** only: no page content, and no `fleet_id` check in the URL on the four pages that do carry the scope.
- *Redundancy:* shares its premise with SWL-09 on a different axis; the navbar hops themselves are exercised by every other area's specs.
- *Efficiency / smells:* the test pulls six page-object fixtures (`dashboard`, `hostsList`, `softwareTitles`, `reportsList`, `policiesList`, `controls`) to make label-only assertions, and reaches `controls.page` through the POM for the URL check. It is a navbar / team-dropdown test living in a file named for "Software • no teams views" — the placement is the weakest thing about it.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-33 · Premium • Software • Patch policies › a macOS app: each patch option stores its own policy, and unticking Patch removes it

- **File:** [`playwright/tests/e2e/premium/software/patch-policy.spec.ts`](../../tests/e2e/premium/software/patch-policy.spec.ts)
- **Grep:** `npx playwright test --project=premium patch-policy -g "macOS"`
- **Project:** premium · **Scope:** Workstations (no hosts — nothing is ever patched) · **Mode:** UI+API
- **Source:** QA Wolf `policies/patch-policy-fleet-maintained-apps` (round 2, batch G)
- **Preconditions (API):** LocalSend (`localsend/darwin`, claimed by no other spec) added to Workstations.
- **Data created:** the title and its patch policy, deleted in the `finally` (policy first); the Workstations wipe removes what a dead run leaves.

**Flow**

1. ☐ Dashboard → **Software** → **Workstations** → **Library** → search → the title.
   - ✅ *(API)* no patch policy yet.
2. ☐ **Actions → Deploy** → tick **Patch**.
   - ✅ *(UI)* **Patch when app is closed** is chosen by default. **Save** → toast `Successfully updated deploy options.`
   - ✅ *(API)* a `patch` policy for the title, named `macOS - LocalSend up to date`, platform `darwin`, installing the title, `patch_when_closed` and continuous on, `notify_before_patching` off.
3. ☐ Deploy → **Force patch** → **End user experience** (it opens on *Patch immediately*) → **Notify before patching** → **Save**.
   - ✅ *(UI)* the modal reopened on Patch ticked and *Patch when app is closed*.
   - ✅ *(API)* installs, `notify_before_patching` and continuous on, `patch_when_closed` off.
4. ☐ Deploy → End user experience → **Patch immediately** → **Save**.
   - ✅ *(UI)* reopened on Force patch with *Notify before patching*.
   - ✅ *(API)* installs; all three flags off.
5. ☐ Deploy → **End user initiated (manual)** → **Save**.
   - ✅ *(UI)* reopened on Force patch; the End user experience dropdown goes once manual is chosen.
   - ✅ *(API)* the policy stays, with **no install automation** and every flag off.
6. ☐ Deploy → untick **Patch** → **Save**.
   - ✅ *(UI)* reopened on manual; the options go once Patch is unticked.
   - ✅ *(API)* no patch policy for the title.

**Assessment**
- *Value:* the only coverage of patch policies — a 4.9x feature whose options map onto three policy flags plus whether the policy installs at all, decided in the frontend (`getPatchPolicyFlags`, `DeployModal`) and stored server-side. Each step reopens the modal on what was saved, so a modal that writes one thing and shows another fails.
- *Coverage gaps:* the policy's query (it fails on any version older than the newest Fleet maintains) isn't run on a host; Force install, the other Deploy checkbox, isn't touched; patching from the Add-software page (the same selector) isn't.
- *Efficiency:* no host; well under a minute, most of it adding the app.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWL-34 · Premium • Software • Patch policies › a Windows app: Force patch offers no Notify, and the server refuses Notify and both flags at once

- **File:** [`playwright/tests/e2e/premium/software/patch-policy.spec.ts`](../../tests/e2e/premium/software/patch-policy.spec.ts)
- **Grep:** `npx playwright test --project=premium patch-policy -g "Windows"`
- **Project:** premium · **Scope:** Workstations · **Mode:** UI+API
- **Preconditions (API):** KeePassXC (`keepassxc/windows`, claimed by no other spec) added to Workstations — a different app from SWL-33's, so the two never share a title name in the Library.

**Flow**

1. ☐ Software → Workstations → Library → the title → **Actions → Deploy** → tick **Patch** → **Force patch**.
   - ✅ *(UI)* no End user experience dropdown — Notify is macOS-only. **Save** → toast.
   - ✅ *(API)* a `patch` policy named `Windows - KeePassXC up to date`, platform `windows`, installing the title, every flag off.
2. ☐ *(API)* `PATCH` the policy with `notify_before_patching: true`.
   - ✅ *(API)* 400 — *"notify_before_patching" is only available for macOS Fleet-maintained apps.*
3. ☐ *(API)* `PATCH` it with `patch_when_closed` and `notify_before_patching` both true.
   - ✅ *(API)* 400 — *Only one of "patch_when_closed" or "notify_before_patching" can be set to true*; the policy is as it was.

**Assessment**
- *Value:* the platform half of the contract, and the server enforcing what the UI only hides.
- *Coverage gaps:* the both-flags refusal is platform-independent and only checked here.
- *Efficiency:* no host; under a minute.

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
| Add custom package (`.pkg` / `.msi` / `.deb` / `.sh`) | SWL-01, SWL-05, SWL-30 (script-only `.sh`), SWL-31 (generated `.deb`) | Advanced options on add (pre-install query, install / post-install / uninstall scripts, self-service, categories, label scope); duplicate-add rejection; server-side rejection of a valid extension with a corrupt payload; `.exe`, `.rpm`, `.tar.gz` fixtures sit in `test-data/` unused |
| Add Fleet-maintained app | SWL-01 (Airtame macOS, 7-Zip Windows); seeded via API in SWL-25/26/27 | FMA script + query editing ([`C6-software.md` flows 20/21](../qawolf-migration/audit/C6-software.md), unwritten); catalog *sorting* and pagination (filters + search now covered by SWL-21–23) |
| Add Apple VPP app | SWL-01 (Bear, iOS) | macOS and iPadOS VPP platforms; the App Store *search* UI (`vppUiSearchNames` exists for it, unused); missing/expired VPP-token error path |
| Add Managed Google Play app | SWL-01 (ChatGPT) | Invalid application-ID error path; no post-add catalog re-check (FMA and VPP both have one) |
| Library tab list | SWL-01, SWL-02, SWL-19 (it is a strict subset of Inventory), SWL-25/27 (a row renders the custom icon / display name) | Library's own columns (Version / Type / Hosts / Status), sorting and pagination — SWL-16–18 cover the **Inventory** table only; the **Self-service only** filter switch (`SoftwareLibraryPage.selfServiceSwitch`, still used by zero specs) |
| Edit installer config | SWL-06 (self-service, write); SWL-31 (all four Advanced-options scripts, **read-only**) | *Editing* any script or the pre-install query and reading it back; categories; label scope; re-uploading a replacement installer; Cancel/discard on a dirty form |
| Delete installer | SWL-02, SWL-07 | Cancel path; per-version delete on a multi-package title; blocked-delete when referenced by Setup Experience (only covered incidentally in `install-software.spec.ts`) |
| Add-software gating | SWL-04 (All fleets tooltip), SWL-20 (button presence per role), SWL-24 (client-side file rejection) | An observer *navigating* to `/software/add/package` by URL; direct URL to `/software/add/*` without `fleet_id`; free-tier paywall on `/software/add/*` — [`paywalls.spec.ts`](../../tests/e2e/free/paywalls.spec.ts) lists no `software/add` URL despite `library.spec`'s header claiming all four paths are paywalled |
| Automations button gating | SWL-11–15 (now incl. `team-admin` and the no-picker `ws-maintainer`) | `ws-observer` (covered by SWL-20 but not here); `global-observer-plus` / `global-technician`; modal internals (covered in `vulnerability-automations.spec.ts`) |
| Unassigned ("no teams") software views | SWL-09, SWL-10 | Library tab omitted from the persistence sweep; item-count-vs-row-count integrity dropped from the original design |
| Scope persistence across the app | SWL-09 (Unassigned, across one page's tabs), SWL-32 (All fleets, across five pages + the Controls fallback) | No return hop after Controls, so nothing proves its per-fleet fallback doesn't poison the remembered scope; Settings / Queries outside the sweep |
| Inventory table shell (columns + sorting) | SWL-16–18 (both tiers) | Column *contents*; the Filter modal and the "show versions" switch; cross-page ordering; Library-tab equivalents |
| Inventory vs Library split | SWL-19 | Asserted only as "fewer items" — no row-level subset or source-type check |
| Fleet-maintained catalog filters | SWL-21 (platform, cross-checked against the API), SWL-22 (Hide added apps), SWL-23 (name search) | "Add an app → it leaves the available-only view" is deferred by SWL-22 to a spec that adds one, and no spec does it; page-2 leakage; catalog sort |
| Role access on the Software area | SWL-20 (5 roles × picker shape, columns, Add software) | `global-observer-plus`, `global-technician`; a negative `?fleet_id=` probe; role checks on Library / OS / Vulnerabilities / title detail |
| Custom icon (title appearance) | SWL-25 (upload → replace → remove, UI + `icon_url`), SWL-26 (four client-side rejections + a clean stage) | Non-PNG input; exactly-at-boundary passes; proof that a *replace* actually changed the bytes; the icon on Inventory or on a host's software list |
| Custom display name | SWL-27 (set → listed → cleared, both toasts) | No API cross-check; no validation cases; not asserted on Inventory, hosts or the activity feed |
| Version pinning (FMA) | SWL-28 (latest / exact / major, three layers each), SWL-29 (older exact — skippable) | What a pin actually installs; the Windows shelf titles; a negative case proving a custom package has no Versions item |
| Installer download | SWL-31 (hash vs fixture **and** vs Fleet's stored `hash_sha256`) | Download on an FMA / VPP / Android title; one-shot token expiry; unauthorized download |
| **Install / uninstall on a host** | **nothing** | The whole install lifecycle (queue → pending → installed/failed, uninstall, retry, host Software → Library "All available", self-service install by an end user, policy-triggered `install_software` automation) is untested — and still is after the additions: SWL-30 uploads a shell script Fleet never runs, SWL-31 downloads an installer instead of installing it, and SWL-28/29 pin a version nothing consumes. Root cause: the QA hosts are osquery-perf simulations that cannot execute an install; the real macOS VM (`liveMacosHost`) is used by host specs but by **no** software spec |
| Software install activity types | none | `installed_software`, `uninstalled_software`, `enabled/disabled_vpp` etc. never asserted — `activity-copy.ts` has no builders for them |

**Duplication**

1. **SWL-05/07/08 vs SWL-01/02/03 (`custom` Linux).** `edit-package.spec` re-implements the entire custom-package add → delete → activity-feed lifecycle to reach one edit assertion (SWL-06). Roughly three quarters of that spec, including a 16 MB upload per run, is duplicated work.
2. **The three `custom` cases in `library.spec`.** macOS `.pkg`, Windows `.msi`, Linux `.deb` drive an identical browser flow; only Fleet's server-side installer parsing differs. 6 of the 42 runtime lifecycle tests (×3 sub-tests = 18) come from this axis.
3. **Activity assertions at two layers.** SWL-01/02/05/07 assert `added_*` / `deleted_*` via `GET /activities`; SWL-03/08 assert the same events' rendered copy. Only the *copy* half is unique — the existence half is doubled 14×.
4. **SWL-04 vs SWL-12.** Same page, same pattern (disabled control + `hover({force:true})` + tooltip text), different button, different files. Natural merge into one "software page gating" spec.
5. **SWL-09/10 vs `os.spec.ts` + `vulnerabilities.spec.ts` + `host-software.spec.ts`.** The tab-renders-data and drill-into-a-title steps exist in all of them; only the dropdown-persistence and absent-button assertions are unique to `no-teams-views`.
6. **`library.spec` vs `install-software.spec.ts`.** Both add all four software kinds across both scopes (9 cases × 2 there, 7 × 2 here) — one via UI, one via API. Different features under test, but the same instance-side work is done twice per run, plus 11 extra FMA adds for the pagination test.
7. **One navigation prologue, five copies.** SWL-25, SWL-26, SWL-27 and (with a Type-cell filter) SWL-28/29 each repeat *dashboard → Software → scope → Library tab → search → `rowWith(…).getByRole('link').first().click()`*. Five specs, no extracted helper — and every copy uses the `.first()` chain [`tests/README.md`](../../tests/README.md) calls an anti-pattern, while `DataTable.firstRowPrimaryLink` exists for exactly this and is used by no software spec.
8. **Three seeded-then-deleted FMA titles.** SWL-25, SWL-26 and SWL-27 each add a distinct Fleet-maintained app (a real CDN fetch, 90 s budget) and delete it, purely to reach a title-detail page and test *title-level presentation* that has nothing to do with the installer kind.
9. **Two `COLUMNS` lists.** `shared/software/titles-table.spec.ts` (SWL-16) and `premium/software/role-access.spec.ts` (SWL-20, ×3 roles) each declare and assert the same five-column list. Two copies, one table.
10. **Two role lists on one page, already drifted.** `role-access.spec.ts` sweeps five roles; `manage-automations-access.spec.ts` sweeps four (no `ws-observer`). Same login mechanism, same page, same picker — different rosters.
11. **Add + delete re-proved three more times.** SWL-30 and SWL-31 each re-run the full custom-package add → library-listing → delete round-trip that SWL-01/02 already own, to reach one shape assertion apiece (as SWL-05/07/08 do for the edit).

**UI-vs-API balance**

- **SWL-06's API-only persistence check** (`getSoftwarePackage` → `self_service === true`) is the one place in this area where API stands in for a UI assertion. It is *documented* as necessary (the reopened Edit modal renders stale config) but that's an unfiled product defect being routed around — per `CLAUDE.md` it belongs in [`docs/blocked-by-product-bugs.md`](../blocked-by-product-bugs.md) with a Fleet issue, and the test should assert the visible self-service badge in the meantime.
- **`assertActivity` in SWL-01/02/05/07 is justified** — it is the activity-payload contract (type + `details.software_title` + `actor_email`) plus the mechanism that extracts `software_package` for the feed matchers. It is not a shortcut around a UI assertion, because SWL-03/08 assert the rendered feed separately.
- **SWL-21's API cross-check is the best pattern in the area.** The rendered "N items" count is compared against `GET /software/fleet_maintained_apps` *under the same filters*, so a catalog that grows with every Fleet release can't invalidate the test and no number is baked into the spec. Worth copying wherever a count is asserted.
- **The newer shape specs pair each UI assertion with the stored value** — SWL-25 (`icon_url`), SWL-28/29 (`pinned_version`, `version`), SWL-30 (`install_script` byte-for-byte, `uninstall_script === ''`), SWL-31 (`hash_sha256` and all four scripts). That is the shape the rest of the area should follow: the UI assertion says the user can see it, the API assertion says Fleet stored it, and a failure names which half broke.
- **SWL-27 is the outlier.** The display-name round-trip is asserted entirely through the UI, with the API used only to seed and delete — so a heading rendered from client state would pass. It is the one recent spec that does *not* cross-check its write.
- **API-as-setup is now normal.** SWL-25/26/27 add their Fleet-maintained app through `addFmaToFleet` and SWL-28/29 read the shelf through `listFleetMaintainedTitles`, which is the right call (the add path is SWL-01's job) but means five specs can pass while the UI add flow is broken.
- **Weak-assertion watch list** (technically UI, but close to no-ops): `expect(titleName.length).toBeGreaterThan(0)` (SWL-01, SWL-05); `rowOrEmpty()` used as a "renders data" proof in SWL-09 and for the `ws-*` roles in SWL-20; the partial tooltip string in SWL-12; `rowWith(name).toHaveCount(0)` in SWL-02 without a search or pagination guard; `available <= total` and `total >= available` in SWL-22 (both hold if the slider does nothing); `libraryCount < inventoryCount` in SWL-19; the pre-install-query and post-install comparisons in SWL-31 (empty === empty for a generated `.deb`).

**Quick wins**

1. Assert the expected app name on the title-detail heading for the FMA / VPP / Android cases (`c.appName` is right there) instead of `titleName.length > 0` — [library.spec.ts:143](../../tests/e2e/premium/software/library.spec.ts#L143), [edit-package.spec.ts:61](../../tests/e2e/premium/software/edit-package.spec.ts#L61).
2. **Delete `helpers/catalogs/` or start using it.** `fmaApps` (285 lines), `vppApps` (98 entries), `androidApps`, `vppUiSearchNames` are imported by **zero** specs — both `library.spec` and `install-software.spec` hardcode their own `CASES` arrays. Meanwhile [`helpers/README.md:20`](../../helpers/README.md#L20) and [`catalogs/README.md`](../../helpers/catalogs/README.md) document them as the way to pick an app, so the next author will wire up a 285-entry list and multiply the case matrix. Either point the two `CASES` arrays at the catalogs (no new tests) or drop the module.
3. Replace the raw `page.goto('/software/titles/...')` at [library.spec.ts:192](../../tests/e2e/premium/software/library.spec.ts#L192) with `softwareTitleDetail.goto({ titleId, fleetId })` + a `card` visibility anchor (as `edit-package.spec` already does), and drop the duplicated `rowOrEmpty()` at [:202](../../tests/e2e/premium/software/library.spec.ts#L202).
4. Swap `clickFirstSoftwareTitle()`'s `.first()` chain ([`SoftwareTitlesPage.ts:180`](../../pages/software/SoftwareTitlesPage.ts#L180)) for `DataTable.firstRowPrimaryLink`, and use `softwareTitles.addSoftwareButton` instead of the inline `getByRole` in [no-teams-views.spec.ts:36](../../tests/e2e/premium/software/no-teams-views.spec.ts#L36).
5. Pin SWL-12's tooltip to the full sentence and add the **Unassigned** scope to it (one extra dropdown selection), matching how SWL-04 pins `Select a fleet to add software.`.
6. ~~**Fix the latent `NaN` in SWL-18.**~~ **Done 2026-09-28.** `columnValues('Hosts').map(Number)` parses the rendered cell, and `Number('1,234')` is `NaN` — every ordering comparison against it is false. Dormant only because both QA instances hold ~300 hosts. `Number(v.replace(/,/g, ''))` closes it.
7. **Guard SWL-19 against an empty Library**, and move its `itemCount()` onto `SoftwareTitlesPage` beside `resultsCount` — the same regex already exists on [`FleetMaintainedAppsPage.ts:124`](../../pages/software/FleetMaintainedAppsPage.ts#L124) and again inline in [titles-table.spec.ts:34](../../tests/e2e/premium/software/titles-table.spec.ts#L34). Today an Unassigned Library that happens to be empty fails on a timed-out `innerText()` rather than a readable message.
8. **Add `ws-observer` to `manage-automations-access.spec.ts`'s `NON_ADMINS`** so the two role rosters on the same page (SWL-13 and SWL-20) stop disagreeing. One line.
9. **Extract the Library-title prologue.** A `SoftwareLibraryPage.openTitle(name, { type })` that uses `rowWith(name).getByRole('link', { name })` would replace five hand-rolled `.first()` chains (SWL-25/26/27/28/29) and remove the anti-pattern in one place.
10. **Model the staged-file card on `FileUploader`** (`.file-details__name`, `.file-details__description`, the extension graphic). SWL-30 declares all three raw in the spec, and `EditAppearanceModal` already models two of them — so the classes exist in two places and the uploader's own component in neither.
11. **Give SWL-26 a non-PNG case** (a JPEG at valid dimensions). Four of its five fixtures probe size and dimensions; the rule most likely to be hit by a real user — "PNG only" — is the one not covered.

**Bigger bets**

1. **Collapse `edit-package.spec` into `library.spec` as an eighth case.** Add an `edit` sub-test that runs only for `custom` cases (or only for one designated case), reusing the already-uploaded installer. Removes one 16 MB upload per run and ~3 duplicated sub-tests, and gets the edit round-trip covered on **Workstations** as well as Unassigned — which is where the `edited … on the <fleet> fleet` activity suffix currently has no coverage at all. Then invest the freed budget in the *unexercised* Edit-modal fields (pre-install query, install/uninstall scripts, categories), which is the single largest functional gap in the area.
2. **Own the "software is never installed anywhere" gap explicitly.** Either (a) build one host-backed install spec against `liveMacosHost` — upload a small `.pkg`, install from the host's Software tab, assert pending → installed and the `installed_software` activity, then uninstall — accepting that it is a single-host serial test; or (b) write it down as a permanent boundary in `TODO.md` so nobody assumes the library specs cover installation. Today the suite silently reads as if add-to-library were the whole feature. `install_software` policy automation ([`C6-software.md` flow 25](../qawolf-migration/audit/C6-software.md)) sits behind the same decision.
3. **A `disposableFmaTitle` fixture.** SWL-25, SWL-26 and SWL-27 each pay a real CDN fetch and a 90 s budget to reach a title-detail page, and each must hand-pick a slug no other spec has claimed — which is why this file now needs a claims table. A worker- or test-scoped fixture that seeds one FMA title, yields `{ titleId, titleName }` and deletes it in teardown would collapse three seeds into one mechanism, make the claim implicit, and give SWL-31/SWL-30 somewhere to put their `finally`-block bookkeeping. The same fixture would let SWL-26 (a purely *client-side* validator) stop adding an app at all if it were pointed at any existing title.
4. **Decide who owns SWL-32.** It is a navbar + team-dropdown test living in `premium/software/no-teams-views.spec.ts`, asserting nothing about software. Either move it to a shared navigation spec, or rename the file to what it now covers (scope behaviour) and move SWL-09/10's software-specific halves out.
5. **Rebalance the (scope × case) matrix instead of running the full cross-product.** The scope axis exercises Fleet's `fleet_id` plumbing and the case axis exercises four different add pipelines; running all 7 × 2 × 3 = 42 tests every night mostly re-verifies that a `.pkg` and a `.msi` take the same three clicks. A matrix of "every case once on Unassigned + one representative case (plus FMA, which has the scope-sensitive catalog state) on Workstations" keeps the distinct coverage at roughly half the runtime, freeing the budget for the Library-tab columns, filters, and pagination that nothing currently touches.
