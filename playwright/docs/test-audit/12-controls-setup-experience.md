# Controls — setup experience — test audit

**Specs covered:** 5 files · **Test declarations:** 9 · **Projects:** premium

`Controls › Setup experience` is the five-step wizard (`1. Users`, `2. Bootstrap package`,
`3. Install software`, `4. Run script`, `5. Setup Assistant`) that authors what happens on a
macOS host as it goes through Apple **ADE/DEP** enrolment. Every spec here is one file per
wizard step, each wrapped in `for (const scope of ['Unassigned', 'Workstations'])`, so each
entry below runs twice against two different `fleet_id`s — except SETUP-09, which runs once,
on a throwaway `pw-manual-agent-*` fleet of its own.

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
| SETUP-06 | `premium/controls/setup-experience/setup-assistant.spec.ts` | Setup Assistant › default profile → upload replaces it → delete restores it → Apple refuses an unnamed one | UI | ☐ |
| SETUP-07 | `premium/controls/setup-experience/users.spec.ts` | Users › renders + IdP, Lock end user info and hidden-admin settings round-trip | UI+API | ☐ |
| SETUP-08 | `premium/controls/setup-experience/users.spec.ts` | Users › Lock end user info renders only when Require IdP is enabled | UI | ☐ |
| SETUP-09 | `premium/controls/setup-experience/bootstrap-package.spec.ts` | Bootstrap package — install fleetd manually (throwaway fleet) › needs a package; while on, macOS setup software and the setup script are disabled and refused | UI+API | ☐ |

Related, audited elsewhere: `tests/e2e/free/paywalls.spec.ts` asserts all six
setup-experience URLs paywall on free; `tests/api/premium/max-request-file-sizes.spec.ts`
covers the `POST /setup_experience/eula` body-size limit (the **EULA** step has no e2e spec at
all); `tests/api/free/endpoints.spec.ts` probes `GET setup_experience/script` on free.

**Shared entry sequence.** Every entry but SETUP-09 (which opens its throwaway fleet by URL)
starts with the same four actions, written out once here and referenced as *"open the wizard"*:

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
- *Coverage gaps:* the `BootstrapPackageTable` status summary (Status / Hosts columns + **View all hosts** link filtering by `macos_bootstrap_package`) renders above the list item and is never asserted — the POM even declares `statusTable` ([`BootstrapPackagePage.ts:27`](../../pages/controls/BootstrapPackagePage.ts)) and nothing uses it. **Advanced options** → *Install Fleet's agent (fleetd) manually* is SETUP-09's, on a throwaway fleet (the no-package half of its enable rule; the "setup software or a script already exists" half is untested). No negative uploads: wrong extension, unsigned `.pkg`, non-distribution `.pkg` all have dedicated client-side copy in `BootstrapPackageUploader/helpers.tsx` and none is exercised. No activity-feed assertion although `added_bootstrap_package` / `deleted_bootstrap_package` exist. Downloaded bytes are never compared to the fixture, and the delete's `Successfully deleted.` toast is not asserted.
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
- *Coverage gaps:* **no API verification at all** — unlike SETUP-01 there is no `GET setup_experience/script` check of the stored name or contents, and `helpers/api/mdm.ts` has no getter to do it with (only `deleteSetupExperienceScript`). The card's **download** button is never clicked even though the POM declares `downloadIcon` — so the download path (API fetch + FileSaver) is untested. The `Script will run during setup:` copy is not asserted. The uploader's disabled state while *Install Fleet's agent (fleetd) manually* is on is SETUP-09's (the **Upload** button only; its tooltip is unread). Non-`.sh` rejection is untested. No activity assertion.
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

### SETUP-06 · MDM • Setup Experience — Setup Assistant (Unassigned · Workstations) › default profile → upload replaces it → delete restores it → Apple refuses an unnamed one

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
  - **Step 6 reaches Apple.** Fleet validates a new profile by sending it to Apple's
    DefineProfile API through one of its ABM tokens (any token, for a fleet no token names)
    before storing it, so Apple's API has to answer and the token has to be one Apple accepts.
- **Data created:** the fleet's automatic-enrollment profile (`automatic-enrollment.dep.json` — `profile_name` "Fleet's example automatic enrollment profile" plus a 16-item `skip_setup_items` list) — deleted in-test, backstopped by `deleteSetupAssistant` in cleanup. Step 6's profile, `pw-unnamed.dep.json` (the same fixture with `profile_name: ''`, built in memory), is refused and stored nowhere.

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
6. ☐ Choose `pw-unnamed.dep.json` in the uploader (`uploadExpectingRefusal` only sets the file; the uploader auto-submits).
   - ✅ *(UI)* Error toast `Couldn't add. CONFIG_NAME_REQUIRED.` — Apple's code, relayed by Fleet.
   - ✅ *(UI)* The toast's **Learn more** link has `href` `https://fleetdm.com/learn-more-about/dep-profile` and `target="_blank"` (Fleet's own guide, not Apple's page; the link isn't followed).
   - ✅ *(UI)* The default card is still visible and the profile name still reads `Default profile` — nothing was stored.

**Assessment**
- *Value:* good. Covers the non-obvious "there is no empty state, the default card *is* the empty state" contract and the singleton replace/restore lifecycle. Rendering the custom card does prove the server stored and re-served the profile. Step 6 adds the one server-side validation path in the area: Fleet asks Apple before storing, relays Apple's refusal code with a link to its guide, and keeps the default card.
- *Coverage gaps:* the custom card's name assertion is negative — Fleet renders `profile.name`, i.e. the uploaded file name, so `toHaveText('automatic-enrollment.dep.json')` is available and strictly better. The `uploaded X ago` timestamp is not asserted. **Advanced options → Release device manually** (`apple_enable_release_device_manually`, its own Save + `Successfully updated.` toast) is never opened — an untested setup-experience setting that materially changes DEP behaviour. The downloaded JSON is never parsed, so nothing checks that `skip_setup_items` survived the round-trip. No activity assertion despite `changed_macos_setup_assistant` / `deleted_macos_setup_assistant`. Of the rejections, only Apple's refusal of an unnamed profile is covered: a non-`.json` file, JSON that doesn't parse, and any check Fleet makes before calling Apple are not. Step 6's "nothing stored" is read from the card only, with no API read of the fleet's setup assistant. The `Preview end user experience` link is not checked.
- *Redundancy:* same upload/list/delete shape as SETUP-01 and SETUP-05.
- *Efficiency / smells:* three class-based locators for the card variants are unavoidable (Fleet's `Card` has no role) and are documented in the POM. `deleteIfCustomPresent()` swallows with `.catch(() => false)`; an API `deleteSetupAssistant(request, fleetId)` precondition would be deterministic and cheaper, matching SETUP-01. Step 4's `/\.json$/` assertion is close to tautological — the filename is derived from the name we uploaded. Step 6 is a live call to Apple per scope per run: an Apple outage, or a token Apple rejects, fails it with a different error toast that reads like a product regression.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SETUP-07 · MDM • Setup Experience — Users (Unassigned · Workstations) › renders + IdP, Lock end user info and hidden-admin settings round-trip

- **File:** [`playwright/tests/e2e/premium/controls/setup-experience/users.spec.ts`](../../tests/e2e/premium/controls/setup-experience/users.spec.ts)
- **Grep:** `npx playwright test tests/e2e/premium/controls/setup-experience/users.spec.ts -g "settings round-trip"`
- **Project:** premium · **Scopes:** Unassigned (writes global `/config`), Workstations (writes `/teams/:id`)
- **Mode:** UI+API · **Isolation:** **mutates shared scope config.** IdP is saved on and then off, whatever it started as (off is the resting state cleanup restores); the hidden admin is flipped and flipped back to its recorded state. A flag set just before the first save and cleared once the IdP-off save reads back keys an `afterEach` to this test: if it died with IdP on, `resetMacosSetupToggles` puts the scope back. The three saves share one test because turning IdP on queues Fleet's ABM profile job for the scope — split up, they'd race each other on the same fleet. Runs in a non-serial describe alongside SETUP-08, which never saves; under `fullyParallel` the two can run at the same time on different workers.
- **Preconditions:** the Users card is the one step that does **not** gate on MDM/ABM, but **Require IdP authentication** is `disabled` unless an end-user IdP is configured (`isIdPConfigured`: `entity_id` + `idp_name` + metadata). EUA is assumed pre-configured on the instance per `playwright/CLAUDE.md`; the spec never asserts it, and without it the first `setChecked` times out on a disabled checkbox.
- **Data created:** none, but it writes `enable_end_user_authentication`, `lock_end_user_info`, `enable_managed_local_account` and `end_user_local_account_type` on the scope. `resetMacosSetupToggles` (cleanup, and this test's `afterEach`) sets the first and third to `false`; Fleet sets Lock to match an IdP change that doesn't name it, and refuses Lock without IdP.

**Flow**

1. ☐ Open the wizard — the Setup experience tab lands on **1. Users** by default; the spec still clicks the subnav link.
   - ✅ *(UI)* `Users` `<h2>` visible.
   - ✅ *(UI)* Three local-account radios are **attached** (not visible — Fleet's custom radios hide the native input): **Admin**, **Standard**, **Skip (no account)**.
   - ✅ *(UI)* **Create hidden admin** and **Require IdP authentication** ARIA checkboxes are visible.
   - ✅ *(UI)* The `identity provider` link is visible.
   - ✅ *(UI)* **Preview end user experience** has `href` `https://fleetdm.com/learn-more-about/setup-experience/end-user-authentication` and `target="_blank"` — a link to Fleet's guide, not opened.
2. ☐ Note whether **Create hidden admin** is checked. Tick **Require IdP authentication** (`setChecked(true)`, a no-op if it is already on).
   - ✅ *(UI)* **Lock end user info** appears, checked — the form ticks it with IdP (`onEndUserAuthChange` in `UsersForm.tsx`).
3. ☐ Click **Save**.
   - ✅ *(UI)* `Successfully updated.` toast — `SetupExperienceUsersPage.save()`, which clears older toasts first.
   - ✅ *(API)* `getMacosSetupSettings` (`GET /config` on Unassigned, `GET /teams/:id` on Workstations): `macos_setup.enable_end_user_authentication` and `lock_end_user_info` are both `true`.
4. ☐ Reload the page; reselect the scope.
   - ✅ *(UI)* **Require IdP authentication** and **Lock end user info** are both checked.
5. ☐ Click **Create hidden admin**, click **Save**.
   - ✅ *(UI)* Toast; the checkbox is the inverse of its noted state.
   - ✅ *(API)* `enable_managed_local_account` is the inverse of the noted state.
6. ☐ Untick **Require IdP authentication**.
   - ✅ *(UI)* **Lock end user info** is hidden.
7. ☐ Click **Create hidden admin** back, click **Save**.
   - ✅ *(UI)* Toast.
   - ✅ *(API)* `enable_end_user_authentication` and `lock_end_user_info` are both `false` — IdP off saves Lock off with it, which is what lets end users edit their macOS Account Name and Full Name again — and `enable_managed_local_account` is back at its noted state.
8. ☐ Reload the page; reselect the scope.
   - ✅ *(UI)* **Require IdP authentication** is unchecked, **Lock end user info** is hidden, and **Create hidden admin** is at its noted state.

**Assessment**
- *Value:* the area's one real settings round trip. Every save is checked against what Fleet stored, and IdP + Lock are read back after a reload in both directions, including the pairing an end user actually feels: IdP off saves Lock off. That closes the finding this entry used to lead with (post-save assertions that re-read React state, so a server that dropped the field would pass). The Preview link's address pins where an admin is sent.
- *Coverage gaps:*
  - The three local-account radios are still **attached and never clicked** — choosing Admin/Standard/Skip, the actual macOS local-account policy, is untested, as is the coupled rule that Standard/Skip force `Create hidden admin` on and disable it (`effectiveEnableManagedLocalAccount` in `LocalAccountSection.tsx`) with the "There must be at least one admin account on the host." tooltip.
  - **Lock off with IdP on** — the legal combination an admin picks to require IdP but let end users edit their name — is never saved, and the server's refusal of Lock without IdP isn't probed.
  - The hidden admin's flipped value is read through the API but not after a reload; the reload in step 8 shows the restored value.
  - No activity assertion, although Fleet logs `enabled_macos_setup_end_user_auth` / `disabled_macos_setup_end_user_auth`.
  - No coverage of the disabled + tooltip states when IdP is not configured or Apple MDM is off.
- *Redundancy:* now contains SETUP-08's whole check — Lock appears with IdP on and is hidden with IdP off — plus the saves. SETUP-08's one distinct property is that it never saves.
- *Efficiency / smells:*
  - **Fragile precondition:** if `end_user_local_account_type` is anything other than `admin` on the scope, **Create hidden admin** is rendered disabled and force-checked, so step 5's click is a no-op and its API read fails. Cleanup's `resetMacosSetupToggles` never resets `end_user_local_account_type`, and every Save from this very form writes it (defaulting to `admin` when the API returns none) — so the spec's own writes are what keep it green. Worth pinning explicitly.
  - It doesn't restore IdP to where it started: it ends with IdP off, as cleanup does. The `afterEach` reset likewise sets the hidden admin to `false`, not to its noted value.
  - Each run queues Fleet's ABM profile job on both scopes (IdP on) — the instance-side cost of this coverage.

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
- **Preconditions:** an IdP must be configured, otherwise **Require IdP authentication** is disabled and the first click waits for it until the test times out
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
- *Value:* low now — a pure client-side conditional (`{endUserAuthEnabled && …}` in `EndUserAuthSection.tsx`) tested without touching server state, which SETUP-07 also asserts on its way through the saves.
- *Coverage gaps:* only visibility. Does not check that enabling IdP also **checks** Lock end user info by default (`onEndUserAuthChange` mirrors the value when Apple MDM is configured), does not check the help text or the disabled state when Apple MDM is off, and does not check that `lock_end_user_info: false` is what actually gets saved when IdP is off (`canLockEndUserInfo` in `UsersForm.tsx`). SETUP-07 checks the default tick and both saved values.
- *Redundancy:* contained in SETUP-07, which shows Lock with IdP on and hides it with IdP off, then saves each. Its only distinct property is that it never saves — a merge (or delete) candidate.
- *Efficiency / smells:* the leading `if (isChecked) click()` normalisation is a legitimate precondition rather than a silent-pass branch. SETUP-07 now always finishes with IdP off (its `afterEach` resets a run that died with it on), so the branch runs only when this test loads the form inside SETUP-07's IdP-on window — the two can run at once under `fullyParallel`.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SETUP-09 · MDM • Bootstrap package — install fleetd manually (throwaway fleet) › needs a package; while on, macOS setup software and the setup script are disabled and refused

- **File:** [`playwright/tests/e2e/premium/controls/setup-experience/bootstrap-package.spec.ts`](../../tests/e2e/premium/controls/setup-experience/bootstrap-package.spec.ts)
- **Grep:** `npx playwright test --project=premium bootstrap-package -g "install fleetd manually"`
- **Project:** premium (the main project, not `premium-exclusive`) · **Scope:** a throwaway fleet, `pw-manual-agent-<nonce>`, opened **by URL** (`bootstrapPackage.goto({ fleetId })`) rather than picked in the dropdown: its name is per-run (see `TeamDropdown.selectByLabel`). The subnav links keep the fleet.
- **Mode:** UI+API · **Isolation:** its own describe; `test.setTimeout(90_000)`. Not on Unassigned or Workstations: while the option is on, that fleet's Install software (macOS) and Run script cards are disabled, which would break SETUP-03…05 running beside it. The test's last step deletes the fleet, and an `afterEach` deletes it again by name (tolerating a 404); `deleteFleet` deletes the fleet's bootstrap package first, because a fleet delete leaves it behind (`mdm_apple_bootstrap_packages` isn't among the tables it clears). The cleanup sweep of `pw-*` fleets removes one a killed run left, and `resetSetupExperience` also turns the option off on Unassigned and Workstations, as a backstop.
- **Preconditions (API):** `createFleet`; mid-flow, `uploadBootstrapPackage` (`POST /bootstrap`, `dummy-bootstrap-package.pkg`) and `uploadSoftwarePackage` of `fleet-playwright-install-1.0.0.pkg` (2 KB, inert — any macOS package will do; it only has to give Install software a row). Apple MDM + ABM configured, as for SETUP-01.
- **Data created:** the fleet, its bootstrap package and the macOS package, all deleted with the fleet. The fleet holds no host, so nothing is ever delivered.

**Flow**

1. ☐ Open `/controls/setup-experience/bootstrap-package?fleet_id=<id>` via URL.
   - ✅ *(UI)* `Bootstrap package` `<h2>` visible (the `goto` anchor); the Controls fleet dropdown reads the fleet's name.
2. ☐ Click **Advanced options**.
   - ✅ *(UI)* **Install Fleet's agent (fleetd) manually** is visible and **disabled** — the fleet has no package.
   - ✅ *(API)* `PATCH /setup_experience` with `macos_manual_agent_install: true` → **422**, the body containing `first specify a macos_bootstrap_package`.
3. ☐ *(API)* Upload the bootstrap package to the fleet; reload the page.
   - ✅ *(UI)* The list item's name reads exactly `dummy-bootstrap-package.pkg`.
4. ☐ **Advanced options** → tick **Install Fleet's agent (fleetd) manually** → the form's own **Save**.
   - ✅ *(UI)* `Successfully updated.` toast (older toasts cleared first).
   - ✅ *(API)* `macos_setup.manual_agent_install` is `true` (`getMacosSetupSettings` → `GET /teams/:id`).
5. ☐ *(API)* Upload the macOS package. Click **3. Install software** → **macOS** tab.
   - ✅ *(UI)* URL `/install-software/macos`; the package's row is listed.
   - ✅ *(UI)* Its checkbox, **Cancel setup if software fails** and **Save** are all disabled.
   - ✅ *(API)* `PUT /setup_experience/software` selecting it for macOS → **422**, the body containing `first disable macos_manual_agent_install`.
6. ☐ Click **4. Run script**.
   - ✅ *(UI)* The empty-state **Upload** button is disabled.
7. ☐ Click **2. Bootstrap package** → **Advanced options** → untick the option → **Save**.
   - ✅ *(UI)* `Successfully updated.` toast.
   - ✅ *(API)* `manual_agent_install` is `false`.
8. ☐ Click **3. Install software** → **macOS** tab.
   - ✅ *(UI)* The package's checkbox and **Save** are enabled again.
9. ☐ *(API)* Delete the fleet (its bootstrap package first).

**Assessment**
- *Value:* high for its cost. The only coverage of the manual-agent option, and the only test in the area of one card's setting gating others: a checkbox on **Bootstrap package** disables controls on **Install software** and **Run script**. The server's two refusals — the option without a package, and macOS setup software while it's on — are each asserted beside the disabled control that should prevent them, so a UI that stops disabling and a server that stops refusing fail separately. The throwaway fleet is what keeps it in the main project.
- *Coverage gaps:* the other half of the option's enable rule — disabled while the fleet already has macOS setup software selected or a setup script — isn't exercised (the package is added after the option is on, and never selected). The setup script is refused only in the UI: no API upload is attempted while the option is on. Run script isn't re-checked after the option goes off. The disabled controls' explanations (tooltips) are unread. Deleting the bootstrap package while the option is on (which leaves it on, per `resetManualAgentInstall`) is untested. No activity assertion. What the option does to an ADE host — Fleet installing no fleetd — is manual-only (see below).
- *Redundancy:* the bootstrap upload is SETUP-01's, here through the API on purpose; the Install software row check overlaps SETUP-03's step 4.
- *Efficiency / smells:* seconds of real work — a fleet, a 19 KB and a 2 KB upload — inside a 90 s ceiling. The fleet shows in every fleet picker while it exists. `deleteFleet` deleting the bootstrap package first works around Fleet leaving an orphaned package behind a deleted fleet; not filed.

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
| **Install Fleet's agent (fleetd) manually**: Fleet installs no fleetd, and the bootstrap package's own agent enrolls the host | needs a real DEP enrolment with a package that carries fleetd |

A reasonable ask of this suite is therefore: **maximise assertion density on the authoring
side** (every field, every gating rule, every negative upload, every activity) and accept that
delivery is a manual checklist. Right now several authoring-side fields are still untested,
which is the real gap — not the DEP part.

### Coverage map

| Feature / user flow | Covered by | Gap |
|---|---|---|
| Wizard subnav (5 numbered steps) | SETUP-01..09 (each clicks its own link) | step ordering/labels never asserted as a set |
| Bootstrap package upload/list/download/delete | SETUP-01 | status table, negative uploads, activity feed, downloaded bytes |
| Bootstrap *Install Fleet's agent (fleetd) manually* | SETUP-09 (throwaway fleet: disabled and refused without a package; saved on and off; disables and refuses macOS setup software, disables the setup script's **Upload**) | its disable rule when setup software or a script already exists; the setup script's API refusal; the disabled controls' tooltips |
| Install software — platform tabs | SETUP-02, SETUP-03 | invalid-platform redirect to `macos` |
| Install software — select + persist | SETUP-03 (9 kinds × 2 scopes) | multi-select, selected-count, `GET setup_experience/software` cross-check |
| Install software — **Require all software** (macOS / Windows) | — (SETUP-09 sees macOS's *Cancel setup if software fails* disabled while manual agent install is on) | saving it, either platform, incl. Windows-MDM gate |
| Install software — pagination | SETUP-04 | selection persistence across pages (`persistSelectedRows`) |
| Run script upload/list/delete | SETUP-05 | download button, API verification; the manual-agent-install disabled state is SETUP-09's |
| Setup Assistant default ↔ custom lifecycle | SETUP-06 | exact profile name, JSON content round-trip, activity feed |
| Setup Assistant — a profile Apple refuses | SETUP-06 step 6 (empty `profile_name` → `CONFIG_NAME_REQUIRED`, Learn more link, default card kept) | non-`.json` and unparseable files; an API read that nothing was stored |
| Setup Assistant **Release device manually** | — | whole setting |
| Users — controls render | SETUP-07 (incl. the Preview link's address) | disabled/tooltip states |
| Users — IdP + Lock end user info + hidden-admin save | SETUP-07 (each save read back through the API; IdP and Lock after a reload, on and off) | Lock off with IdP on; the hidden admin's flipped value after a reload; activity feed |
| Users — local account type (Admin/Standard/Skip) | — | whole setting + the forced-hidden-admin coupling |
| Users — Lock end user info visibility | SETUP-08, SETUP-07 (ticked with IdP, saved on and off) | disabled state with Apple MDM off |
| EULA step | — (API size test only) | whole step |
| Free-tier paywall on all 6 URLs | `tests/e2e/free/paywalls.spec.ts` | — |
| ABM / MDM-not-configured empty states | — | the `Additional configuration required` + **Turn on** path on 4 of 5 cards |

### Duplication

1. **SETUP-02 ⊂ SETUP-03.** The nine cases already click all six tabs and assert each URL. SETUP-02 adds nothing and sits at the head of a serial chain.
2. **Upload → assert name → delete → assert empty** is written three times (SETUP-01, SETUP-05, SETUP-06) against three different singleton entities, with three different levels of rigour (SETUP-01 checks sha256, SETUP-05 checks nothing server-side, SETUP-06 checks a negative). Levelling them up to SETUP-01's standard is a bigger win than de-duplicating them.
3. **SETUP-08 ⊂ SETUP-07.** SETUP-07 asserts the same show/hide (Lock with IdP on, hidden with IdP off) on its way through the saves; SETUP-08 adds only that it never saves.
4. **Three VPP Canva cases** in SETUP-03 differ only by platform tab.
5. **Reset-before-assert** is implemented three different ways: API pre-delete (SETUP-01), UI `if visible → delete` (SETUP-05), POM `deleteIfCustomPresent()` (SETUP-06).

### UI-vs-API balance

Overall the balance is **good** — the browser is doing the validating almost everywhere, and
API calls are mostly *setup*, which is the right shape.

- SETUP-01's two `getBootstrapMetadata` assertions are justified: `sha256` is the one thing the
  UI cannot show, and 404-after-delete is a cheap, unambiguous "it's really gone".
- SETUP-03's heavy API use is all precondition (creating titles) plus the final delete; its
  persistence check is a UI reload. Correct.
- SETUP-07 reads every save back through `getMacosSetupSettings` and reloads after the IdP saves,
  so its round trip is checked at both layers.
- SETUP-09 pairs each disabled control with the server's own refusal (two 422s), and reads the
  option back through the API after each save. The API calls there are the point, not shortcuts:
  a disabled control can't show that the server would refuse what it prevents.
- No spec in the area asserts the activity feed, even though Fleet emits
  `added_bootstrap_package`, `deleted_bootstrap_package`, `changed_macos_setup_assistant`,
  `deleted_macos_setup_assistant`, `edited_setup_experience_software`,
  `enabled_macos_setup_end_user_auth` and `disabled_macos_setup_end_user_auth` — an unusual
  omission for this suite, whose CRUD specs normally end on `dashboard.expectActivities`.

### Quick wins

1. ~~Add `await page.reload()` before the post-save assertions in SETUP-07~~ (done 2026-10-05: each save is read back through the API, and the IdP saves after a reload).
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
2. **Cover the untested setup-experience settings, then trim SETUP-04.** *Release device
   manually*, *Require all software* (macOS + Windows) and the *local account type* radios are
   all real DEP-behaviour knobs with zero automated coverage (~~*Install Fleet's agent
   manually*~~ is SETUP-09's since 2026-10-05, cross-card gating included); SETUP-04 spends 22
   server-side installer downloads on a generic table widget. Reallocating that budget is a
   straight upgrade in regression value.
3. **Extract a shared singleton-entity lifecycle helper** for bootstrap package / setup script /
   setup assistant (API pre-delete → upload → assert exact name → assert server-side metadata →
   download and verify → delete → assert gone → assert activity). It would raise SETUP-05 and
   SETUP-06 to SETUP-01's rigour and give the area one consistent reset strategy instead of
   three.
