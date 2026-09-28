# Controls — setup experience — test audit

**Specs covered:** 5 files · **Test declarations:** 8 · **Projects:** premium

`Controls › Setup experience` is the five-step wizard (`1. Users`, `2. Bootstrap package`,
`3. Install software`, `4. Run script`, `5. Setup Assistant`) that authors what happens on a
macOS host as it goes through Apple **ADE/DEP** enrolment. Every spec here is one file per
wizard step, each wrapped in `for (const scope of ['Unassigned', 'Workstations'])`, so each
entry below runs twice against two different `fleet_id`s.

> **The whole area is configuration-authoring only.** Nothing in this folder — and nothing
> that *can* live in this folder — exercises the setup experience end to end. That requires a
> freshly-wiped, ABM-enrolled Mac walking through Setup Assistant, and the QA instances only
> have osquery-perf simulations plus one or two already-enrolled real macOS VMs
> (`liveMacosHost`), which cannot be re-DEP-enrolled on demand. See
> [Inherently unverifiable in automation](#inherently-unverifiable-in-automation) for the
> manual-only list.

## Contents

| ID | Spec | Test | Mode | Manual? |
|---|---|---|---|---|
| SETUP-01 | `premium/controls/setup-experience/bootstrap-package.spec.ts` | MDM • Bootstrap package › upload → list → download → delete | UI+API | ☐ |
| SETUP-02 | `premium/controls/setup-experience/install-software.spec.ts` | Install software › all 6 platform tabs are visible | UI | ☐ |
| SETUP-03 | `premium/controls/setup-experience/install-software.spec.ts` | Install software › `<case>` — appears in `<platform>` tab and saves selection (9 cases) | UI+API | ☐ |
| SETUP-04 | `premium/controls/setup-experience/install-software.spec.ts` | Install software › macOS tab — pagination enables once more than 10 titles are listed | UI+API | ☐ |
| SETUP-05 | `premium/controls/setup-experience/run-script.spec.ts` | Run script › upload → list → delete | UI | ☐ |
| SETUP-06 | `premium/controls/setup-experience/setup-assistant.spec.ts` | Setup Assistant › default profile → upload replaces it → delete restores it | UI | ☐ |
| SETUP-07 | `premium/controls/setup-experience/users.spec.ts` | Users › renders + IdP and hidden-admin toggles round-trip | UI | ☐ |
| SETUP-08 | `premium/controls/setup-experience/users.spec.ts` | Users › Lock end user info renders only when Require IdP is enabled | UI | ☐ |

Related, audited elsewhere: `tests/e2e/free/paywalls.spec.ts` asserts all six
setup-experience URLs paywall on free; `tests/api/premium/max-request-file-sizes.spec.ts`
covers the `POST /setup_experience/eula` body-size limit (the **EULA** step has no e2e spec at
all); `tests/api/free/endpoints.spec.ts` probes `GET setup_experience/script` on free.

**Shared entry sequence.** Every entry starts with the same four actions, written out once
here and referenced as *"open the wizard"*:

1. ☐ Open the dashboard (`/dashboard`) — `dashboard.goto()` waits for the first summary card.
2. ☐ Click **Controls** in the navbar — `navbar.goToControls()` asserts URL `/controls`.
3. ☐ Pick the scope in the Controls team dropdown (`.team-dropdown__control` →
   `.team-dropdown__option`) — idempotent, and asserts the trigger label becomes the scope.
4. ☐ Click the **Setup experience** tab (asserts URL `/controls/setup-experience`), then the
   numbered subnav link for the step (asserts URL `.../<step>`).

---

### SETUP-01 · MDM • Bootstrap package (Unassigned · Workstations) › upload → list → download → delete

- **File:** [`playwright/tests/e2e/premium/controls/setup-experience/bootstrap-package.spec.ts`](../../tests/e2e/premium/controls/setup-experience/bootstrap-package.spec.ts)
- **Grep:** `npx playwright test tests/e2e/premium/controls/setup-experience/bootstrap-package.spec.ts`
- **Project:** premium · **Scopes:** Unassigned (`fleet_id=0`), Workstations (worker fixture)
- **Mode:** UI+API · **Isolation:** standalone, fully self-cleaning; the two scope variants are independent describes and may run in parallel on different workers (different `fleet_id`s, no shared state)
- **Preconditions:**
  - `deleteBootstrapPackage(request, fleetId)` — `DELETE /api/v1/fleet/bootstrap/:fleetId`, treats 404/402 as success, so it is a safe pre-wipe.
  - **Instance-level:** `mdm.enabled_and_configured` **and** `mdm.apple_bm_enabled_and_configured` must both be true, otherwise the card renders an `Additional configuration required` empty state with a **Turn on** button and the heading/uploader assertions fail with a locator timeout (`BootstrapPackage.tsx` `mdmNotConfigured`). Never asserted by the spec.
- **Data created:** the fleet's bootstrap package (`dummy-bootstrap-package.pkg`, 19 KB) — deleted in-test at step 6, and again by `resetSetupExperience` in [`setup/cleanup.steps.ts`](../../setup/cleanup.steps.ts)

**Flow**

1. ☐ Open the wizard, click **2. Bootstrap package**.
   - ✅ *(UI)* `Bootstrap package` `<h2>` visible.
   - ✅ *(UI)* The empty drop-zone (`.bootstrap-package .file-uploader`) is visible — i.e. no package on this fleet.
2. ☐ Upload `test-data/apple/macos/bootstrap-package/dummy-bootstrap-package.pkg` by setting the hidden `input#upload-file` (Fleet auto-submits on file selection).
   - ✅ *(UI)* Success toast matching `/^Successfully/` — `FileUploader.expectToast`.
   - ✅ *(UI)* A `.bootstrap-package-list-item` appears — asserted inside `BootstrapPackagePage.upload()`.
   - ✅ *(UI)* The list item's name element has **exactly** `dummy-bootstrap-package.pkg`.
   - ✅ *(API)* `GET bootstrap/:fleetId/metadata` is non-null, `name === 'dummy-bootstrap-package.pkg'`, and `sha256` equals the base64 SHA-256 the spec computes from the local fixture at module load — a genuine byte-integrity check on what the server stored.
3. ☐ Click the **download** icon on the list item (a hidden-form `GET /api/v1/fleet/bootstrap` carrying the metadata token).
   - ✅ *(UI)* A browser download fires and its suggested filename ends in `.pkg`.
4. ☐ Click the **trash** icon → the *Delete bootstrap package* modal opens → click **Delete**.
   - ✅ *(UI)* Modal was visible before confirming; afterwards the list item is hidden and the empty drop-zone is back — all inside `BootstrapPackagePage.delete()`.
   - ✅ *(API)* `GET bootstrap/:fleetId/metadata` returns null (404).

**Assessment**
- *Value:* solid. Catches a broken bootstrap upload/store/serve/delete path per scope, including content corruption on the server (the sha256 check) and the singleton-per-fleet contract.
- *Coverage gaps:* the `BootstrapPackageTable` status summary (Status / Hosts columns + **View all hosts** link filtering by `macos_bootstrap_package`) renders above the list item and is never asserted — the POM even declares `statusTable` ([`BootstrapPackagePage.ts:27`](../../pages/controls/BootstrapPackagePage.ts)) and nothing uses it. No **Advanced options** → *Install Fleet's agent manually* coverage, including its enable rule (disabled when no package, or when setup-experience software/script exist). No negative uploads: wrong extension, unsigned `.pkg`, non-distribution `.pkg` all have dedicated client-side copy in `BootstrapPackageUploader/helpers.tsx` and none is exercised. No activity-feed assertion although `added_bootstrap_package` / `deleted_bootstrap_package` exist. Downloaded bytes are never compared to the fixture, and the delete's `Successfully deleted.` toast is not asserted.
- *Redundancy:* none within this area.
- *Efficiency / smells:* `downloadIcon` / `deleteIcon` are page-wide `getByTestId('download-icon')` / `('trash-icon')` ([`BootstrapPackagePage.ts:46-47`](../../pages/controls/BootstrapPackagePage.ts)) rather than scoped to `.bootstrap-package-list-item` — fine while one item exists, latent strict-mode breakage if the status table ever grows icons. Download assertion (`/\.pkg$/`) is the weakest possible form: it would pass on a zero-byte file, and asserting `=== PKG_FILE` costs nothing.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SETUP-02 · MDM • Setup Experience — Install software (Unassigned · Workstations) › all 6 platform tabs are visible

- **File:** [`playwright/tests/e2e/premium/controls/setup-experience/install-software.spec.ts`](../../tests/e2e/premium/controls/setup-experience/install-software.spec.ts)
- **Grep:** `npx playwright test tests/e2e/premium/controls/setup-experience/install-software.spec.ts -g "all 6 platform tabs"`
- **Project:** premium · **Scopes:** Unassigned, Workstations
- **Mode:** UI · **Isolation:** first test in a `mode: 'serial'` describe of 11 tests — if it fails, SETUP-03's nine cases and SETUP-04 are skipped for that scope
- **Preconditions:** none
- **Data created:** none

**Flow**

1. ☐ Open the wizard, click **3. Install software** (lands on the `macos` tab).
   - ✅ *(UI)* Six tabs are visible in the tablist with exact names **macOS**, **Windows**, **Linux**, **iOS**, **iPadOS**, **Android** — `InstallSoftwarePage.expectAllPlatformTabs()` loops the six labels.

**Assessment**
- *Value:* very low as a standalone test. The tab strip is rendered unconditionally by `InstallSoftware.tsx` and is not data-dependent; the only regression it can catch is a renamed or removed tab.
- *Coverage gaps:* does not assert the active tab, the tab→URL mapping, or that an invalid `:platform` URL segment redirects to `macos` (`router.replace` in `InstallSoftware.tsx`).
- *Redundancy:* **fully subsumed by SETUP-03**, whose nine cases click through all six tabs and assert the URL each time (`switchPlatform`). Merge candidate — delete this test, or repurpose it into the invalid-platform-redirect check nothing else covers.
- *Efficiency / smells:* pays the full dashboard → navbar → dropdown → tab → subnav walk for one visibility loop, and its position as step 1 of a serial chain means a flake here cascades into 10 skipped tests per scope.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SETUP-03 · MDM • Setup Experience — Install software (Unassigned · Workstations) › `<case>` — appears in `<platform>` tab and saves selection

- **File:** [`playwright/tests/e2e/premium/controls/setup-experience/install-software.spec.ts`](../../tests/e2e/premium/controls/setup-experience/install-software.spec.ts)
- **Grep:** `npx playwright test tests/e2e/premium/controls/setup-experience/install-software.spec.ts -g "saves selection"`
- **Project:** premium · **Scopes:** Unassigned, Workstations
- **Mode:** UI+API · **Isolation:** one `test()` call site parameterised over nine `CASES`; with two scopes this is **18 runtime tests**, all inside the `mode: 'serial'` describe. `test.setTimeout(90_000)` each. Each case creates and deletes its own software title.
- **Preconditions:** per case, one API-created software title (see table). All cases avoid the titles used by `tests/e2e/premium/software/library.spec.ts` (dummy custom packages, 1Password FMA is used *here*, Canva VPP, AllTrails Android) so parallel specs don't race the same entity — the file header documents this contract, so **any edit to either spec's fixture list must be checked against the other**.
- **Data created / cleaned:** the title is toggled off, saved, then deleted via `DELETE software/titles/:id/available_for_install` in the same test. Fleet returns 409 for a title still selected for setup experience, which is why the toggle-off + save must precede the delete. `cleanup.steps.ts` is the backstop (`clearSetupExperienceSoftware` then `deleteAllInstallSoftwareTitles`, in that order, for the same 409 reason).

| Case (title suffix) | Platform tab | Created by | Extra instance dependency |
|---|---|---|---|
| `Custom package — macos` | macOS | `POST software/package` multipart, `playwright-setup-exp.pkg` | Apple MDM + ABM |
| `Custom package — windows` | Windows | `POST software/package`, `playwright-setup-exp.msi` | none (Windows tab is not MDM-gated) |
| `Custom package — linux` | Linux | `POST software/package`, `playwright-setup-exp.deb` | none |
| `FMA — 1password/darwin` | macOS | `POST software/fleet_maintained_apps` after slug lookup | Apple MDM + ABM, FMA CDN reachable |
| `FMA — 1password/windows` | Windows | same | FMA CDN reachable |
| `VPP — Canva (macos)` | macOS | `POST software/app_store_apps` (`897446215`, `darwin`) | Apple MDM + ABM **and** a VPP token whose location owns Canva |
| `VPP — Canva (ios)` | iOS | same, `ios` | as above |
| `VPP — Canva (ipados)` | iPadOS | same, `ipados` | as above |
| `Android — com.alltrails.alltrails` | Android | `POST software/app_store_apps`, `platform: android`, `self_service: true` | `mdm.android_enabled_and_configured` — otherwise the tab shows a **Turn on Android MDM** empty state |

**Flow** (identical per case)

1. ☐ *(API precondition)* Create the title on the fleet by the case's method, then `GET software/titles/:id?fleet_id=` to read the display **name** the UI will render.
2. ☐ Open the wizard, click **3. Install software**.
3. ☐ Click the case's platform tab.
   - ✅ *(UI)* URL contains `/install-software/<platform>`; a data row **or** the empty state is visible — `switchPlatform()`.
4. ☐ Locate the row whose text contains the title name.
   - ✅ *(UI)* The row is visible — the title added by API surfaces in the setup-experience list for that platform.
   - ✅ *(UI)* The row's first checkbox is **not** checked (not yet selected for setup install).
5. ☐ Click the row's checkbox, then click **Save**.
   - ✅ *(UI)* Success toast `Successfully updated.` — `Toast.expectSuccess`.
6. ☐ Reload the page.
   - ✅ *(UI)* The row's checkbox is checked — a real server round-trip, not client state.
7. ☐ Click the checkbox again, click **Save** (toast asserted again), then delete the title via API.

**Assessment**
- *Value:* the strongest test in the area. It proves, per platform and per software *kind*, that a title in the library becomes selectable for setup-experience install and that the selection persists across a reload. The 409-avoiding toggle-off also implicitly documents Fleet's referential-integrity rule.
- *Coverage gaps:* the **Require all software** checkboxes (`require_all_software_macos`, `require_all_software_windows` — the latter additionally gated on Windows MDM) live on the same form and are untested. The empty-state **Add software** button (routes to the software library) is untested. Multi-select (checking two titles in one save) is untested, as is the selected-count display and `persistSelectedRows` across pages. No activity assertion despite `edited_setup_experience_software`. Nothing verifies the saved selection via API (`GET setup_experience/software`) — the reload check covers it through the UI, which is arguably better, but there is no cross-check that the *set* is exactly what was chosen rather than "at least this row".
- *Redundancy:* SETUP-02 is entirely contained in step 3 across the nine cases. Some overlap with the software-library specs on "does the API-created title appear in a list", but the list here is a different endpoint and a different form, so it is justified.
- *Efficiency / smells:* 18 serial tests × up to 90 s, each doing a full dashboard → navbar → dropdown → tab → subnav walk, is the most expensive block in the area; the three VPP Canva cases differ only by `platform` and could plausibly be one test that visits three tabs. The FMA/VPP/Android cases silently depend on live third-party integrations (FMA CDN, VPP token, Android Enterprise) and will read as test failures, not config failures, when those lapse. `row.getByRole('checkbox').first()` ([`InstallSoftwarePage.ts:97`](../../pages/controls/InstallSoftwarePage.ts)) is a tolerated `.first()`. Row matching is substring-based (`rowWith(name)`), so a short title name could match a longer neighbour.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SETUP-04 · MDM • Setup Experience — Install software (Unassigned · Workstations) › macOS tab — pagination enables once more than 10 titles are listed

- **File:** [`playwright/tests/e2e/premium/controls/setup-experience/install-software.spec.ts`](../../tests/e2e/premium/controls/setup-experience/install-software.spec.ts)
- **Grep:** `npx playwright test tests/e2e/premium/controls/setup-experience/install-software.spec.ts -g "pagination enables"`
- **Project:** premium · **Scopes:** Unassigned, Workstations
- **Mode:** UI+API · **Isolation:** last test of the serial describe; `test.setTimeout(300_000)`; cleanup in a `finally`
- **Preconditions:** eleven macOS FMA slugs added in parallel via `Promise.all` (`010-editor`, `apparency`, `appcleaner`, `bbedit`, `bitwarden`, `box-drive`, `brave-browser`, `coteditor`, `cyberduck`, `discord`, `drawio` — all `/darwin`), chosen not to collide with SETUP-03's `1password` or the library spec's `airtame`. Requires Apple MDM + ABM (macOS tab) and a reachable FMA CDN for 11 server-side installer fetches.
- **Data created:** 11 software titles, deleted in the `finally` with per-title `catch` + `console.warn` (failures are logged, not raised)

**Flow**

1. ☐ *(API precondition)* Add 11 macOS FMAs to the fleet.
2. ☐ Open the wizard, click **3. Install software**, click the **macOS** tab.
   - ✅ *(UI)* URL is `/install-software/macos` and a row or empty state renders.
   - ✅ *(UI)* **Next** is enabled — the table's page size is 10, so >10 titles must enable paging.
3. ☐ Read the first row's **Name** cell (resolved by column header, not index), click **Next**.
   - ✅ *(UI)* Polls until the first row's Name differs from page 1 — page 2 rendered different data.
4. ☐ Click **Previous**.
   - ✅ *(UI)* Polls until the first row's Name equals the captured page-1 value.

**Assessment**
- *Value:* low relative to cost. It verifies Fleet's generic client-side `TableContainer` paging on one more page, not anything setup-experience-specific — the only area-specific fact asserted is that the page size is 10.
- *Coverage gaps:* does not assert the row count on page 1 is 10, does not check the results/page counter text, and does not check `persistSelectedRows` (a *selected* row surviving a page change is the interesting setup-experience behaviour and is exactly what is skipped).
- *Redundancy:* substantially duplicates pagination coverage that already exists on other DataTable pages; the suite even has a dedicated [`Pagination`](../../pages/components/Pagination.ts) component object with `nextIfEnabled`/`previousIfEnabled` that this spec bypasses in favour of raw `nextButton`/`previousButton` clicks.
- *Efficiency / smells:* 11 concurrent FMA adds (each a server-side installer download) per scope = 22 installer fetches to test a Next/Previous button; this is the single heaviest setup cost in the area and a plausible source of QA-instance load. The 300 s timeout is a symptom. `finally` swallows delete failures, so a partial cleanup leaves up to 11 titles for `cleanup-teardown` and the run still passes green.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SETUP-05 · MDM • Setup Experience — Run script (Unassigned · Workstations) › upload → list → delete

- **File:** [`playwright/tests/e2e/premium/controls/setup-experience/run-script.spec.ts`](../../tests/e2e/premium/controls/setup-experience/run-script.spec.ts)
- **Grep:** `npx playwright test tests/e2e/premium/controls/setup-experience/run-script.spec.ts`
- **Project:** premium · **Scopes:** Unassigned, Workstations
- **Mode:** UI · **Isolation:** standalone, self-cleaning
- **Preconditions:** none via API — the spec self-heals **in the UI** with an `if (visible) delete()` branch. Requires MDM + ABM configured (`RunScript.tsx` renders the same `Additional configuration required` empty state otherwise).
- **Data created:** the fleet's setup-experience script (`fleet-test-script.sh`, a `touch` + `date >>` one-liner) — deleted in-test, backstopped by `deleteSetupExperienceScript` in cleanup

**Flow**

1. ☐ Open the wizard, click **4. Run script**.
   - ✅ *(UI)* `Run script` `<h2>` visible.
2. ☐ If a script card is already present, delete it (trash icon → *Delete* in the delete modal).
   - ✅ *(UI)* After the reset, the empty-state **Upload** button is visible.
3. ☐ Upload `test-data/apple/macos/scripts/fleet-test-script.sh` via the hidden `input#upload-file` (auto-submits).
   - ✅ *(UI)* Success toast matching `/^Successfully/`.
   - ✅ *(UI)* A `.setup-experience-script-card` appears (inside `RunScriptPage.upload()`).
   - ✅ *(UI)* The card's info block **contains** `fleet-test-script.sh`.
4. ☐ Click the **trash** icon → **Delete** in the *Delete setup experience script* modal.
   - ✅ *(UI)* Card hidden and the **Upload** button back.

**Assessment**
- *Value:* modest. Confirms the singleton `.sh` upload/list/delete path renders per scope.
- *Coverage gaps:* **no API verification at all** — unlike SETUP-01 there is no `GET setup_experience/script` check of the stored name or contents, and `helpers/api/mdm.ts` has no getter to do it with (only `deleteSetupExperienceScript`). The card's **download** button is never clicked even though the POM declares `downloadIcon` — so the download path (API fetch + FileSaver) is untested. The `Script will run during setup:` copy is not asserted. The uploader's `disabled` + tooltip state when *Install Fleet's agent manually* is on is untested. Non-`.sh` rejection is untested. No activity assertion.
- *Redundancy:* structurally identical to SETUP-01 (upload → assert name → delete → assert empty) but weaker; the pair is a good candidate for one shared helper.
- *Efficiency / smells:* the reset uses a UI `if (await runScript.listItem.isVisible().catch(() => false))` branch ([`run-script.spec.ts:37`](../../tests/e2e/premium/controls/setup-experience/run-script.spec.ts)) where the sibling spec uses a one-line API delete — swap it for `deleteSetupExperienceScript(request, fleetId)` and the branch (and its swallowed error) disappears. `emptyUploadButton = page.getByRole('button', { name: 'Upload' })` ([`RunScriptPage.ts:36`](../../pages/controls/RunScriptPage.ts)) is unscoped, as are the page-wide download/trash test-ids. `toContainText` rather than `toHaveText` on the name means a rename that appends junk would still pass.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SETUP-06 · MDM • Setup Experience — Setup Assistant (Unassigned · Workstations) › default profile → upload replaces it → delete restores it

- **File:** [`playwright/tests/e2e/premium/controls/setup-experience/setup-assistant.spec.ts`](../../tests/e2e/premium/controls/setup-experience/setup-assistant.spec.ts)
- **Grep:** `npx playwright test tests/e2e/premium/controls/setup-experience/setup-assistant.spec.ts`
- **Project:** premium · **Scopes:** Unassigned, Workstations
- **Mode:** UI · **Isolation:** standalone, self-cleaning
- **Preconditions:**
  - UI self-heal: `deleteIfCustomPresent()` removes a custom profile left by a crashed run.
  - **ABM dependency — yes, and it is load-bearing.** `SetupAssistant.tsx` gates on
    `mdm.enabled_and_configured && mdm.apple_bm_enabled_and_configured`; without a live Apple
    Business Manager / automatic-enrollment connection the card is replaced by an
    `Additional configuration required` empty state and this spec fails on the very first
    `defaultCard` assertion. The spec never checks or reports that condition, and ABM tokens
    expire annually — expect this to look like a mystery timeout when it does.
    (`FLEET_ABM_ORG_NAME` exists in `.env.premium.example` only for the `fleetctl gitops`
    apply; the suite itself never reads it.)
- **Data created:** the fleet's automatic-enrollment profile (`automatic-enrollment.dep.json` — `profile_name` "Fleet's example automatic enrollment profile" plus a 16-item `skip_setup_items` list) — deleted in-test, backstopped by `deleteSetupAssistant` in cleanup

**Flow**

1. ☐ Open the wizard, click **5. Setup Assistant**.
2. ☐ If a custom profile card is present, delete it (trash → **Delete** in the *Delete automatic enrollment profile* modal; asserts the `Successfully deleted.` toast, custom card hidden, default card visible).
   - ✅ *(UI)* The `--default-profile` card is visible.
   - ✅ *(UI)* The card's profile-name text is exactly `Default profile`.
3. ☐ Upload `test-data/apple/macos/setup-assistant/automatic-enrollment.dep.json` via the hidden `input#upload-file`.
   - ✅ *(UI)* Success toast `Successfully uploaded.`
   - ✅ *(UI)* A non-default profile card is visible and the default card is hidden — inside `SetupAssistantPage.upload()`.
   - ✅ *(UI)* The profile name is no longer `Default profile` (negative assertion only).
4. ☐ Click the card's **download** button.
   - ✅ *(UI)* A download fires whose suggested filename ends in `.json`. Note this is a **client-side FileSaver** blob built from the profile JSON already in the page, named `<YYYY-MM-DD>_<profile.name>` — no server request is made, so this validates FileSaver wiring, not stored bytes.
5. ☐ Click the **trash** icon → **Delete**.
   - ✅ *(UI)* `Successfully deleted.` toast, custom card hidden, default card visible.
   - ✅ *(UI)* The profile name is back to `Default profile`.

**Assessment**
- *Value:* good. Covers the non-obvious "there is no empty state, the default card *is* the empty state" contract and the singleton replace/restore lifecycle. Rendering the custom card does prove the server stored and re-served the profile.
- *Coverage gaps:* the custom card's name assertion is negative — Fleet renders `profile.name`, i.e. the uploaded file name, so `toHaveText('automatic-enrollment.dep.json')` is available and strictly better. The `uploaded X ago` timestamp is not asserted. **Advanced options → Release device manually** (`apple_enable_release_device_manually`, its own Save + `Successfully updated.` toast) is never opened — an untested setup-experience setting that materially changes DEP behaviour. The downloaded JSON is never parsed, so nothing checks that `skip_setup_items` survived the round-trip. No activity assertion despite `changed_macos_setup_assistant` / `deleted_macos_setup_assistant`. Non-`.json` and malformed-DEP-JSON rejection untested. The `Preview end user experience` link is not checked.
- *Redundancy:* same upload/list/delete shape as SETUP-01 and SETUP-05.
- *Efficiency / smells:* three class-based locators for the card variants are unavoidable (Fleet's `Card` has no role) and are documented in the POM. `deleteIfCustomPresent()` swallows with `.catch(() => false)`; an API `deleteSetupAssistant(request, fleetId)` precondition would be deterministic and cheaper, matching SETUP-01. Step 4's `/\.json$/` assertion is close to tautological — the filename is derived from the name we uploaded.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SETUP-07 · MDM • Setup Experience — Users (Unassigned · Workstations) › renders + IdP and hidden-admin toggles round-trip

- **File:** [`playwright/tests/e2e/premium/controls/setup-experience/users.spec.ts`](../../tests/e2e/premium/controls/setup-experience/users.spec.ts)
- **Grep:** `npx playwright test tests/e2e/premium/controls/setup-experience/users.spec.ts -g "toggles round-trip"`
- **Project:** premium · **Scopes:** Unassigned (writes global `/config`), Workstations (writes `/teams/:id`)
- **Mode:** UI · **Isolation:** standalone but **mutates shared scope config**; it captures the initial toggle states and restores them with a third save. Runs in a non-serial describe alongside SETUP-08, which reads (but never saves) the same form.
- **Preconditions:** the Users card is the one step that does **not** gate on MDM/ABM, but **Require IdP authentication** is `disabled` unless an end-user IdP is configured (`isIdPConfigured`: `entity_id` + `idp_name` + metadata). EUA is assumed pre-configured on the instance per `playwright/CLAUDE.md`; the spec never asserts it.
- **Data created:** none, but it writes `enable_end_user_authentication`, `lock_end_user_info`, `enable_managed_local_account` and `end_user_local_account_type` on the scope. `resetMacosSetupToggles` in cleanup resets only the first and third.

**Flow**

1. ☐ Open the wizard — the Setup experience tab lands on **1. Users** by default; the spec still clicks the subnav link.
   - ✅ *(UI)* `Users` `<h2>` visible.
   - ✅ *(UI)* Three local-account radios are **attached** (not visible — Fleet's custom radios hide the native input): **Admin**, **Standard**, **Skip (no account)**.
   - ✅ *(UI)* **Create hidden admin** and **Require IdP authentication** ARIA checkboxes are visible.
   - ✅ *(UI)* The `identity provider` link is visible.
2. ☐ Record the current checked state of both toggles, then click **Require IdP authentication** and click **Save**.
   - ✅ *(UI)* `Successfully updated.` toast — `SetupExperienceUsersPage.save()`.
   - ✅ *(UI)* The IdP checkbox is now the inverse of its recorded state.
3. ☐ Click **Create hidden admin**, click **Save**.
   - ✅ *(UI)* `Successfully updated.` toast.
   - ✅ *(UI)* The hidden-admin checkbox is now the inverse of its recorded state.
4. ☐ Click both toggles back, click **Save**.
   - ✅ *(UI)* Both checkboxes match their originally recorded states.

**Assessment**
- *Value:* moderate — it proves the form renders its controls and that Save reaches the server without erroring. It does **not** prove persistence.
- *Coverage gaps:*
  - **The "round-trip" in the title is not a round-trip.** There is no `page.reload()` and no API read; the post-save assertions re-read React state that the click already changed, so a server that dropped the field entirely would still pass as long as it returned 200. Contrast SETUP-03, which reloads. One `page.reload()` (or `assertActivity` on `enabled_macos_setup_end_user_auth` / `disabled_macos_setup_end_user_auth`) closes this.
  - The three local-account radios are asserted **attached and never clicked** — choosing Admin/Standard/Skip, the actual macOS local-account policy, is completely untested, as is the coupled rule that Standard/Skip force `Create hidden admin` on and disable it (`effectiveEnableManagedLocalAccount` in `LocalAccountSection.tsx`) with the "There must be at least one admin account on the host." tooltip.
  - No coverage of the disabled + tooltip states when IdP is not configured or Apple MDM is off.
- *Redundancy:* overlaps SETUP-08 on entry navigation and on the IdP checkbox itself; the two could be one test if SETUP-08's no-save property is preserved.
- *Efficiency / smells:*
  - **Fragile precondition:** if `end_user_local_account_type` is anything other than `admin` on the scope, **Create hidden admin** is rendered disabled and force-checked, so step 3's click is a no-op and the assertion fails. Cleanup's `resetMacosSetupToggles` never resets `end_user_local_account_type`, and every Save from this very form writes it (defaulting to `admin` when the API returns none) — so the spec's own writes are what keep it green. Worth pinning explicitly.
  - Silent extra writes: because `onEndUserAuthChange` mirrors EUA into `lockEndUserInfo`, each Save here also writes `lock_end_user_info`; the spec neither asserts nor documents that.
  - `pageHealth` is the only guard against a failed save that returns 4xx, and 4xx is deliberately not flagged — so an error toast would only be caught by the missing `Successfully updated.` assertion, which is present. Fine.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SETUP-08 · MDM • Setup Experience — Users (Unassigned · Workstations) › Lock end user info renders only when Require IdP is enabled

- **File:** [`playwright/tests/e2e/premium/controls/setup-experience/users.spec.ts`](../../tests/e2e/premium/controls/setup-experience/users.spec.ts)
- **Grep:** `npx playwright test tests/e2e/premium/controls/setup-experience/users.spec.ts -g "Lock end user info renders only"`
- **Project:** premium · **Scopes:** Unassigned, Workstations
- **Mode:** UI · **Isolation:** clean — deliberately never clicks **Save**, so it leaves the scope's server config untouched and is safe next to SETUP-07
- **Preconditions:** an IdP must be configured, otherwise **Require IdP authentication** is disabled and the clicks do nothing
- **Data created:** none

**Flow**

1. ☐ Open the wizard, click **1. Users**.
2. ☐ If **Require IdP authentication** is checked, click it off.
   - ✅ *(UI)* **Lock end user info** checkbox is hidden.
3. ☐ Click **Require IdP authentication** on.
   - ✅ *(UI)* **Lock end user info** becomes visible.
4. ☐ Click **Require IdP authentication** off again.
   - ✅ *(UI)* **Lock end user info** is hidden again.

**Assessment**
- *Value:* good value per second — a pure client-side conditional (`{endUserAuthEnabled && …}` in `EndUserAuthSection.tsx`) tested without touching server state. This is the pattern SETUP-07 should borrow for its show/hide concerns.
- *Coverage gaps:* only visibility. Does not check that enabling IdP also **checks** Lock end user info by default (`onEndUserAuthChange` mirrors the value when Apple MDM is configured), does not check the help text or the disabled state when Apple MDM is off, and does not check that `lock_end_user_info: false` is what actually gets saved when IdP is off (`canLockEndUserInfo` in `UsersForm.tsx`).
- *Redundancy:* duplicates SETUP-07's navigation and its IdP-checkbox interaction, minus the saves.
- *Efficiency / smells:* the leading `if (isChecked) click()` normalisation is a legitimate precondition rather than a silent-pass branch, but note that whether it runs depends on whatever SETUP-07 last saved — so the two tests are ordering-coupled through server state even though neither declares a dependency.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

## Area observations

### Inherently unverifiable in automation

Every spec here stops at **authoring the configuration**. The thing the feature exists for — a
Mac coming out of the box, hitting Apple's DEP endpoint, being assigned to Fleet, and running
through Setup Assistant — cannot be triggered from Playwright. It needs a physical or virtual
Mac that is (a) ABM-assigned to this Fleet server, (b) fully erased, and (c) re-enrolled on
demand. The QA instances have osquery-perf simulations (never MDM-enrolled) plus one or two
already-enrolled real macOS VMs that cannot be re-DEP-enrolled per run. Two of the spec
headers say this in prose (`bootstrap-package.spec.ts`, `run-script.spec.ts`); it is true of
all five.

**Manual DEP testing must still cover, per scope:**

| Manual-only behaviour | Why automation can't reach it |
|---|---|
| Bootstrap package actually installs during ADE, and the *Status / Hosts* table moves Pending → Installed → Failed | needs a real DEP enrolment; the aggregate endpoint only reports enrolled hosts |
| Setup-experience script actually executes on the host, and its output/exit code surfaces | same |
| Selected software actually installs during setup, in order, and **Require all software** blocks release until done | same |
| Setup Assistant customisation is honoured — the `skip_setup_items` panes really are skipped | rendered by macOS, not Fleet |
| **Release device manually** (Advanced options) holds the device until `DeviceConfigured` | same |
| Local-account outcome: Admin vs Standard vs **Skip (no account)**, and the `_fleetadmin` hidden admin appearing under *Host details → Show managed account* | needs a real host |
| **Require IdP authentication** end-user SSO screen during Setup Assistant, and **Lock end user info** actually locking Account Name / Full name | needs the real Setup Assistant + IdP |
| EULA display during automatic enrollment | no e2e spec exists at all (only an API body-size test) |
| `canceled_setup_experience` / failure and retry paths | needs a real enrolment to fail |

A reasonable ask of this suite is therefore: **maximise assertion density on the authoring
side** (every field, every gating rule, every negative upload, every activity) and accept that
delivery is a manual checklist. Right now several authoring-side fields are still untested,
which is the real gap — not the DEP part.

### Coverage map

| Feature / user flow | Covered by | Gap |
|---|---|---|
| Wizard subnav (5 numbered steps) | SETUP-01..08 (each clicks its own link) | step ordering/labels never asserted as a set |
| Bootstrap package upload/list/download/delete | SETUP-01 | status table, negative uploads, activity feed, downloaded bytes |
| Bootstrap *Install Fleet's agent manually* | — | whole setting, incl. its disable rule (no package / software / script present) |
| Install software — platform tabs | SETUP-02, SETUP-03 | invalid-platform redirect to `macos` |
| Install software — select + persist | SETUP-03 (9 kinds × 2 scopes) | multi-select, selected-count, `GET setup_experience/software` cross-check |
| Install software — **Require all software** (macOS / Windows) | — | whole setting, incl. Windows-MDM gate |
| Install software — pagination | SETUP-04 | selection persistence across pages (`persistSelectedRows`) |
| Run script upload/list/delete | SETUP-05 | download button, API verification, manual-agent-install disable state |
| Setup Assistant default ↔ custom lifecycle | SETUP-06 | exact profile name, JSON content round-trip, activity feed |
| Setup Assistant **Release device manually** | — | whole setting |
| Users — controls render | SETUP-07 | disabled/tooltip states |
| Users — IdP + hidden-admin save | SETUP-07 | actual persistence (no reload), local-account radios never clicked |
| Users — local account type (Admin/Standard/Skip) | — | whole setting + the forced-hidden-admin coupling |
| Users — Lock end user info visibility | SETUP-08 | default-on behaviour, saved value |
| EULA step | — (API size test only) | whole step |
| Free-tier paywall on all 6 URLs | `tests/e2e/free/paywalls.spec.ts` | — |
| ABM / MDM-not-configured empty states | — | the `Additional configuration required` + **Turn on** path on 4 of 5 cards |

### Duplication

1. **SETUP-02 ⊂ SETUP-03.** The nine cases already click all six tabs and assert each URL. SETUP-02 adds nothing and sits at the head of a serial chain.
2. **Upload → assert name → delete → assert empty** is written three times (SETUP-01, SETUP-05, SETUP-06) against three different singleton entities, with three different levels of rigour (SETUP-01 checks sha256, SETUP-05 checks nothing server-side, SETUP-06 checks a negative). Levelling them up to SETUP-01's standard is a bigger win than de-duplicating them.
3. **SETUP-07 / SETUP-08** share navigation and the IdP checkbox; SETUP-08 is effectively SETUP-07's show/hide half with the saves removed.
4. **Three VPP Canva cases** in SETUP-03 differ only by platform tab.
5. **Reset-before-assert** is implemented three different ways: API pre-delete (SETUP-01), UI `if visible → delete` (SETUP-05), POM `deleteIfCustomPresent()` (SETUP-06).

### UI-vs-API balance

Overall the balance is **good** — the browser is doing the validating almost everywhere, and
API calls are mostly *setup*, which is the right shape.

- SETUP-01's two `getBootstrapMetadata` assertions are the only API validations in the area and
  they are justified: `sha256` is the one thing the UI cannot show, and 404-after-delete is a
  cheap, unambiguous "it's really gone".
- SETUP-03's heavy API use is all precondition (creating titles) plus the final delete; its
  persistence check is a UI reload. Correct.
- The real imbalance runs the other way: **SETUP-07 has no API or reload check at all**, so its
  "round-trip" claim rests on a toast. That is the one place an API assertion (or a reload) is
  genuinely missing rather than optional.
- No spec in the area asserts the activity feed, even though Fleet emits
  `added_bootstrap_package`, `deleted_bootstrap_package`, `changed_macos_setup_assistant`,
  `deleted_macos_setup_assistant`, `edited_setup_experience_software`,
  `enabled_macos_setup_end_user_auth` and `disabled_macos_setup_end_user_auth` — an unusual
  omission for this suite, whose CRUD specs normally end on `dashboard.expectActivities`.

### Quick wins

1. Add `await page.reload()` before the post-save assertions in SETUP-07 ([`users.spec.ts:42,46,51`](../../tests/e2e/premium/controls/setup-experience/users.spec.ts)) — today they assert client state and prove nothing about persistence.
2. Delete SETUP-02 ([`install-software.spec.ts:87`](../../tests/e2e/premium/controls/setup-experience/install-software.spec.ts)); it is contained in SETUP-03 and heads a serial chain, so its flake cost is 10 skipped tests per scope.
3. Replace SETUP-05's UI self-heal branch ([`run-script.spec.ts:37`](../../tests/e2e/premium/controls/setup-experience/run-script.spec.ts)) with `deleteSetupExperienceScript(request, fleetId)`, matching SETUP-01 — removes an `if` and a swallowed `catch`.
4. Tighten two near-tautological download assertions: SETUP-01 `expect(dl.suggestedFilename()).toBe(PKG_FILE)` (and optionally sha256 the stream); SETUP-06 assert the custom card's profile name is exactly `automatic-enrollment.dep.json` instead of `not.toHaveText('Default profile')`.
5. Have SETUP-07 pin `end_user_local_account_type` to `admin` via API before it starts (or click the **Admin** radio first) — the hidden-admin toggle is disabled and force-checked for Standard/Skip, and `resetMacosSetupToggles` in [`cleanup.steps.ts`](../../setup/cleanup.steps.ts) never resets that field.

### Bigger bets

1. **Add an explicit ABM/MDM readiness precondition for the area.** Four of the five cards blank
   out into `Additional configuration required` when `apple_bm_enabled_and_configured` is false,
   and ABM tokens expire annually — today that presents as a pile of unexplained locator
   timeouts. A worker fixture that reads `GET /config` once and fails with
   "Apple ABM not connected on this instance" would turn a half-day triage into a one-line
   message, and would double as the assertion for the missing empty-state coverage.
2. **Cover the three untested setup-experience settings, then trim SETUP-04.** *Release device
   manually*, *Install Fleet's agent manually* (plus its cross-step disable rule), *Require all
   software* (macOS + Windows) and the *local account type* radios are all real DEP-behaviour
   knobs with zero automated coverage; SETUP-04 spends 22 server-side installer downloads on a
   generic table widget. Reallocating that budget is a straight upgrade in regression value.
3. **Extract a shared singleton-entity lifecycle helper** for bootstrap package / setup script /
   setup assistant (API pre-delete → upload → assert exact name → assert server-side metadata →
   download and verify → delete → assert gone → assert activity). It would raise SETUP-05 and
   SETUP-06 to SETUP-01's rigour and give the area one consistent reset strategy instead of
   three.
