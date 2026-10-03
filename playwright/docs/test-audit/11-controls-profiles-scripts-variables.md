# Controls — profiles, disk encryption, scripts, variables — test audit

**Specs covered:** 11 files · **Test declarations:** 36 · **Projects:** premium / free, plus **premium-exclusive / free-exclusive** (CTL-26, CTL-28…32)

Covers **Controls → OS settings** (custom configuration profiles, global disk-encryption
enforcement), **Controls → Scripts → Library**, **batch script runs** (hosts list → Run script →
Controls → Scripts → Batch progress), the organization-wide **Script execution** switch, and
**Controls → Variables → Global variables**. Every lifecycle spec follows the suite's serial-CRUD convention: one
`test.describe.configure({ mode: 'serial' })` per (scope × OS) case, one sub-test per
lifecycle step, and a final sub-test that re-asserts the same lifecycle through the
dashboard activity feed. Premium specs wrap the describe in a `for (const scope of
['Unassigned','Workstations'])` loop; the free files are hand-copied mirrors with the
loop and the team dropdown removed.

**Entry ↔ execution count.** Each entry below collapses the `scope` **and** OS-case loops,
so one entry can be several actual test runs: premium profiles ×4 (2 scopes × macOS/Windows),
premium scripts ×6 (2 scopes × macOS/Linux/Windows), free profiles ×2, free scripts ×3, and the
shared custom-variables tests ×2 (once per tier). The 23 lifecycle-era entries (CTL-01…23) expand to
**76 test executions** per full premium+free run; CTL-24/25 add 2 (premium only), CTL-26 adds 2 (once
per exclusive project), CTL-27…34 add 8 (one run each) and CTL-35/36 add 4 (both tiers) — **92** in all.

CTL-24…26 are **not** serial-CRUD specs: each is a single standalone flow against real hosts (CTL-24,
CTL-26) or the simulation pool (CTL-25). Neither is `shared/controls/custom-variables.spec.ts`
(CTL-13/14, CTL-35/36): four independent tests that both tiers run, each cleaning up in an `afterEach`.

## Contents

| ID | Spec | Test | Mode | Manual? |
|---|---|---|---|---|
| CTL-01 | `premium/controls/os-settings/configuration-profiles.spec.ts` | configuration profiles (scope) — OS › upload | UI+API | ☐ |
| CTL-02 | `premium/controls/os-settings/configuration-profiles.spec.ts` | configuration profiles (scope) — OS › download matches source | UI | ☐ |
| CTL-03 | `premium/controls/os-settings/configuration-profiles.spec.ts` | configuration profiles (scope) — OS › delete | UI+API | ☐ |
| CTL-04 | `premium/controls/os-settings/configuration-profiles.spec.ts` | configuration profiles (scope) — OS › activity feed shows upload → delete | UI | ☐ |
| CTL-05 | `premium/controls/os-settings/configuration-profiles.spec.ts` | upload validation › rejects a signed .mobileconfig | UI | ☐ |
| CTL-06 | `premium/controls/os-settings/disk-encryption.spec.ts` | toggling disk-encryption enforcement persists | UI+API | ☐ |
| CTL-07 | `premium/controls/scripts/library.spec.ts` | Scripts library lifecycle (scope) — OS › upload | UI+API | ☐ |
| CTL-08 | `premium/controls/scripts/library.spec.ts` | Scripts library lifecycle (scope) — OS › download matches source | UI | ☐ |
| CTL-09 | `premium/controls/scripts/library.spec.ts` | Scripts library lifecycle (scope) — OS › edit | UI+API | ☐ |
| CTL-10 | `premium/controls/scripts/library.spec.ts` | Scripts library lifecycle (scope) — OS › delete | UI+API | ☐ |
| CTL-11 | `premium/controls/scripts/library.spec.ts` | Scripts library lifecycle (scope) — OS › activity feed shows upload → edit → delete | UI | ☐ |
| CTL-12 | `premium/controls/scripts/library.spec.ts` | upload validation › rejects a script larger than 500,000 characters | UI | ☐ |
| CTL-13 | `shared/controls/custom-variables.spec.ts` | add a custom variable and delete it *(premium + free)* | UI | ☐ |
| CTL-14 | `shared/controls/custom-variables.spec.ts` | the add form auto-uppercases and validates the name *(premium + free)* | UI | ☐ |
| CTL-15 | `free/controls/os-settings/configuration-profiles.spec.ts` | configuration profiles — OS › upload | UI+API | ☐ |
| CTL-16 | `free/controls/os-settings/configuration-profiles.spec.ts` | configuration profiles — OS › download matches source | UI | ☐ |
| CTL-17 | `free/controls/os-settings/configuration-profiles.spec.ts` | configuration profiles — OS › delete | UI+API | ☐ |
| CTL-18 | `free/controls/os-settings/configuration-profiles.spec.ts` | configuration profiles — OS › activity feed shows upload → delete | UI | ☐ |
| CTL-19 | `free/controls/scripts/library.spec.ts` | Scripts library lifecycle — OS › upload | UI+API | ☐ |
| CTL-20 | `free/controls/scripts/library.spec.ts` | Scripts library lifecycle — OS › download matches source | UI | ☐ |
| CTL-21 | `free/controls/scripts/library.spec.ts` | Scripts library lifecycle — OS › edit | UI+API | ☐ |
| CTL-22 | `free/controls/scripts/library.spec.ts` | Scripts library lifecycle — OS › delete | UI+API | ☐ |
| CTL-23 | `free/controls/scripts/library.spec.ts` | Scripts library lifecycle — OS › activity feed shows upload → edit → delete | UI | ☐ |
| CTL-24 | `premium/controls/scripts/batch-run.spec.ts` | Batch script run › a batch on one VM of each platform puts each host in the status its platform earns | UI+API | ☐ |
| CTL-25 | `premium/controls/scripts/batch-run.spec.ts` | Batch script run › a batch on every matching simulation targets exactly them, and accounts for each | UI+API | ☐ |
| CTL-26 | `shared/exclusive/script-execution-disabled.spec.ts` | turning script execution off disables running scripts everywhere Fleet offers it *(premium-exclusive + free-exclusive)* | UI+API | ☐ |
| CTL-27 | `premium/controls/os-settings/configuration-profiles.spec.ts` | a profile for all hosts, delivered and removed (VMs fleet) › the macOS VM installs and verifies it, and loses it when it is deleted | UI+API | ☐ |
| CTL-28 | `premium/exclusive/os-updates/macos-updates.spec.ts` | macOS › a custom minimum version and deadline save, persist, and clear again *(premium-exclusive)* | UI+API | ☐ |
| CTL-29 | `premium/exclusive/os-updates/macos-updates.spec.ts` | macOS › a missing or malformed minimum version or deadline is refused, and nothing saves *(premium-exclusive)* | UI+API | ☐ |
| CTL-30 | `premium/exclusive/os-updates/macos-updates.spec.ts` | macOS › "View all hosts" on a current version lists exactly the hosts running it *(premium-exclusive)* | UI+API | ☐ |
| CTL-31 | `premium/exclusive/os-updates/ddm-conflict.spec.ts` | macOS: a software-update declaration and a minimum version refuse each other *(premium-exclusive)* | UI+API | ☐ |
| CTL-32 | `premium/exclusive/os-updates/ddm-conflict.spec.ts` | Windows: an Update CSP profile and a Windows update deadline refuse each other *(premium-exclusive)* | UI+API | ☐ |
| CTL-33 | `free/controls/os-settings/profile-delivery.spec.ts` | a profile is installed, resent and removed, and the host names it in each command *(free)* | UI+API | ☐ |
| CTL-34 | `free/controls/os-settings/profile-delivery.spec.ts` | a declaration is verified by the Mac and removed again *(free)* | UI+API | ☐ |
| CTL-35 | `shared/controls/custom-variables.spec.ts` | a script that uses a variable is refused until the variable exists *(premium + free)* | UI | ☐ |
| CTL-36 | `shared/controls/custom-variables.spec.ts` | a variable a script uses can't be deleted *(premium + free)* | UI+API | ☐ |

`Mode` is one of: **UI** (all validation through the browser), **UI+API** (browser flow,
some assertions via API), **API** (no meaningful UI validation), **PERF** (timing).
`Manual?` is always an empty `☐` — Andrey ticks it as he works through the suite.

**Standing fact for this area:** the lifecycle specs (CTL-01…23) never *apply* a profile to a host
or *run* a script on one — they exercise the library only. Script **execution** is now covered, but
elsewhere and in CTL-24/25: single-host runs are [HOST-19…22](02-hosts-shared-and-free.md) (Host
details → Actions → Run script, on both tiers), batch runs are CTL-24 (the three real VMs) and CTL-25
(the simulation pool). There are **three real VMs per tier — macOS, Windows and Ubuntu, all ARM** — on
the **VMs** fleet (id 103) on premium and in Unassigned on free, resolved with
`findOnlineHost(…, { kind: 'real' })`, which keys on hardware model (`VirtualMac` / `QEMU`), **not** MDM
enrollment (~30% of the osquery-perf simulations are MDM-enrolled too). Simulations never run a script;
osquery-perf answers a *batch* with a random exit code, which CTL-25 turns into arithmetic rather than
per-host assertions. **Profile delivery to a host is still untested — and must never be tested with
the passcode / screen-lock fixtures:** a passcode profile deployed to a real VM locks it permanently
(`playwright/CLAUDE.md` → Test hosts). The `*-create-marker.sh` / `.ps1` fixtures remain unused: the
host-execution specs build their script content at run time with a per-run nonce instead.

---

### CTL-01 · MDM • OS settings — configuration profiles (Unassigned · Workstations) — macOS · Windows › upload

- **File:** [`playwright/tests/e2e/premium/controls/os-settings/configuration-profiles.spec.ts`](../../tests/e2e/premium/controls/os-settings/configuration-profiles.spec.ts)
- **Grep:** `npx playwright test --project=premium premium/controls/os-settings/configuration-profiles.spec.ts -g "upload$"`
- **Project:** premium · **Scopes:** Unassigned, Workstations · **OS cases:** macOS, Windows
- **Mode:** UI+API · **Isolation:** serial describe, step 1 of 4 (later sub-tests depend on the profile this one uploads)
- **Preconditions:** `cleanup-setup` has run `deleteAllConfigurationProfiles` on `fleet_id=0` and on Workstations ([`setup/cleanup.steps.ts:51,77`](../../setup/cleanup.steps.ts)); the spec additionally self-heals with `deleteIfExists`
- **Data created:** one configuration profile per case, deleted by CTL-03. Files: the inert pair — [`test-data/apple/macos/profiles/fleet-pw-inert.mobileconfig`](../../test-data/apple/macos/profiles/fleet-pw-inert.mobileconfig) (renders as **Fleet Playwright Inert**, from its `PayloadDisplayName`) and [`test-data/windows/profiles/fleet-pw-inert.xml`](../../test-data/windows/profiles/fleet-pw-inert.xml) (renders as **fleet-pw-inert**, the filename stem). Neither premium scope holds a real VM, but the fixtures are inert anyway: the free copy of this spec delivers every upload to the VMs

**Flow**

1. ☐ Open the dashboard, click **Controls** in the navbar.
   - ✅ *(UI)* URL matches `/controls` — `Navbar.goToControls`.
2. ☐ Click the **OS settings** tab, then **Configuration profiles** in the sidebar.
   - ✅ *(UI)* URL matches `/controls/os-settings`, then `/controls/os-settings/configuration-profiles` — `ControlsPage.goToOsSettings` / `OsSettingsPage.goToConfigurationProfiles`.
3. ☐ Select the scope in the team dropdown (idempotent; skipped if already showing it).
   - ✅ *(UI)* Dropdown value equals the scope label — `TeamDropdown.selectByLabel`.
4. ☐ If a `.profile-list-item` whose title text exactly equals the display name is already visible, delete it first (hover row → trash → **Delete** in the "Delete configuration profile" modal → *Successfully deleted.* toast).
5. ☐ Click **Add profile** → the "Add profile" modal opens → choose the fixture file on `input#upload-profile` → click **Add profile** inside the modal.
   - ✅ *(UI)* Success toast *"Successfully uploaded."* — `ConfigurationProfilesPage.uploadProfile`.
   - ✅ *(UI)* The upload modal is hidden afterwards.
   - ✅ *(UI)* A profile row whose title text exactly equals the display name is visible.
   - ✅ *(API)* `GET /activities` (paged, ≤5×100 desc) contains `created_macos_profile` / `created_windows_profile` with `details.profile_name === <displayName>`, and `actor_email === FLEET_ADMIN_EMAIL` — `assertActivity`.

**Assessment**
- *Value:* Catches a broken profile-upload path (modal wiring, file input id, parser accepting a valid mobileconfig/SyncML, and the profile appearing in the right fleet's list).
- *Coverage gaps:* Nothing asserts the row's **platform tag**, checksum/date column, or the profile's payload identifier. No label-scoped profile (include/exclude by label), no duplicate-identifier conflict, no `.json` (Apple DDM / Android) profile case, no per-profile **delivery status** to a host (Verified/Verifying/Pending/Failed) — the `OsSettingsPage.statusLinks` counters are only ever touched by the loadtest spec. No `$FLEET_SECRET_*` / `$FLEET_VAR_*` variable interpolation inside a profile.
- *Redundancy:* Near-identical to **CTL-15** (free mirror; only difference is the missing dropdown step and the tier-specific activity suffix). The API activity check here is re-verified through the UI in **CTL-04**.
- *Efficiency / smells:*
  - `assertActivity` matches on `profile_name` only, with no fleet/team discriminator ([`configuration-profiles.spec.ts:72`](../../tests/e2e/premium/controls/os-settings/configuration-profiles.spec.ts)). The Unassigned and Workstations describes are separate describes, so they can run **concurrently in different workers** with the same display name — each can satisfy the other's activity assertion. Add `d.team_id`/`team_name` to the predicate.
  - `deleteIfExists` is an `if` branch that silently passes when the row isn't there — fine as written (it's genuinely defensive) but it means step 4 is untested.
  - `addProfileButton` uses a tolerated `.first()` because the empty-state and list-header buttons share the label ([`ConfigurationProfilesPage.ts:51`](../../pages/controls/ConfigurationProfilesPage.ts)).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-02 · MDM • OS settings — configuration profiles (Unassigned · Workstations) — macOS · Windows › download matches source

- **File:** [`playwright/tests/e2e/premium/controls/os-settings/configuration-profiles.spec.ts`](../../tests/e2e/premium/controls/os-settings/configuration-profiles.spec.ts)
- **Grep:** `npx playwright test --project=premium premium/controls/os-settings/configuration-profiles.spec.ts -g "download matches source"`
- **Project:** premium · **Scopes:** Unassigned, Workstations · **OS cases:** macOS, Windows
- **Mode:** UI · **Isolation:** serial describe, step 2 of 4 (needs CTL-01's profile)
- **Preconditions:** CTL-01 passed
- **Data created:** none (a browser download into Playwright's temp dir)

**Flow**

1. ☐ Go straight to `/controls/os-settings/configuration-profiles?fleet_id=<id>` **via URL** (`fleetIdFor(scope, workstationsFleetId)` → `0` for Unassigned).
   - ✅ *(UI)* The **Configuration profiles** heading is visible — `goto()` anchor.
2. ☐ Re-select the scope in the team dropdown (guards against localStorage-restored scope).
   - ✅ *(UI)* Dropdown value equals the scope label.
3. ☐ Hover the profile's row and click its **download** icon (`data-testid=download-icon`), retrying the hover up to 3× and force-clicking on the last attempt — `clickHoverAction`.
   - ✅ *(UI)* A `download` event fires (implicit — `waitForEvent('download')` would time out otherwise).
   - ✅ *(UI)* The downloaded file's bytes are **byte-identical** to the source fixture (`toBe`, no trimming).

**Assessment**
- *Value:* Strong round-trip assertion — proves Fleet stores and returns the profile unmodified (catches re-serialisation, encoding, or BOM regressions). The strongest single assertion in the profile lifecycle.
- *Coverage gaps:* The downloaded **filename** is never checked (`Content-Disposition`). No download of a Fleet-signed/variable-interpolated variant.
- *Redundancy:* Duplicated by **CTL-16** (free mirror).
- *Efficiency / smells:* `download.path()` is used without a null guard — a failed download surfaces as a confusing `readFileSync(undefined)` rather than a clear message.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-03 · MDM • OS settings — configuration profiles (Unassigned · Workstations) — macOS · Windows › delete

- **File:** [`playwright/tests/e2e/premium/controls/os-settings/configuration-profiles.spec.ts`](../../tests/e2e/premium/controls/os-settings/configuration-profiles.spec.ts)
- **Grep:** `npx playwright test --project=premium premium/controls/os-settings/configuration-profiles.spec.ts -g "› delete$"`
- **Project:** premium · **Scopes:** Unassigned, Workstations · **OS cases:** macOS, Windows
- **Mode:** UI+API · **Isolation:** serial describe, step 3 of 4 — **this is the cleanup step** for CTL-01
- **Preconditions:** CTL-01 passed
- **Data created:** none — removes CTL-01's profile

**Flow**

1. ☐ Go to `/controls/os-settings/configuration-profiles?fleet_id=<id>` **via URL**; re-select the scope.
   - ✅ *(UI)* **Configuration profiles** heading visible; dropdown shows the scope.
2. ☐ Hover the profile's row → click the **trash** icon (`data-testid=trash-icon`, via `clickHoverAction`).
   - ✅ *(UI)* The **Delete configuration profile** modal is visible.
3. ☐ Click **Delete** in the modal.
   - ✅ *(UI)* Success toast *"Successfully deleted."* — inside `deleteProfile`.
   - ✅ *(UI)* The row is hidden (asserted twice — once in `deleteProfile`, once in the spec body).
   - ✅ *(API)* `deleted_macos_profile` / `deleted_windows_profile` activity with matching `profile_name` and admin actor.

**Assessment**
- *Value:* Confirms delete removes the profile from the list and emits the delete activity; also the lifecycle's cleanup.
- *Coverage gaps:* No confirmation-modal **cancel** path (does Cancel leave the profile?). No check that deletion triggers a remove-profile MDM command / clears host delivery status.
- *Redundancy:* Row-hidden is asserted twice (POM + spec, [`ConfigurationProfilesPage.ts:117`](../../pages/controls/ConfigurationProfilesPage.ts) and [`configuration-profiles.spec.ts:89`](../../tests/e2e/premium/controls/os-settings/configuration-profiles.spec.ts)). Duplicated wholesale by **CTL-17**. The API activity is re-checked in **CTL-04**.
- *Efficiency / smells:* Same missing team discriminator on `assertActivity` as CTL-01 — a concurrent sibling scope's delete can satisfy it.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-04 · MDM • OS settings — configuration profiles (Unassigned · Workstations) — macOS · Windows › activity feed shows upload → delete

- **File:** [`playwright/tests/e2e/premium/controls/os-settings/configuration-profiles.spec.ts`](../../tests/e2e/premium/controls/os-settings/configuration-profiles.spec.ts)
- **Grep:** `npx playwright test --project=premium premium/controls/os-settings/configuration-profiles.spec.ts -g "activity feed shows upload → delete"`
- **Project:** premium · **Scopes:** Unassigned, Workstations · **OS cases:** macOS, Windows
- **Mode:** UI · **Isolation:** serial describe, step 4 of 4
- **Preconditions:** CTL-01 and CTL-03 passed
- **Data created:** none

**Flow**

1. ☐ Open the dashboard (`/dashboard`, no `fleet_id` → the global feed).
   - ✅ *(UI)* The first dashboard card is visible — `DashboardPage.goto` anchor.
2. ☐ Read the **Activity** feed, paging **Next** up to 15 pages and reloading up to 10× until both entries are found — `dashboard.expectActivities`.
   - ✅ *(UI)* Feed row matching `added configuration profile <name> to <suffix>.`
   - ✅ *(UI)* Feed row matching `deleted configuration profile <name> from <suffix>.`
   - Suffix is tier- and scope-aware (`profileSuffix`, [`helpers/activity-copy.ts:92`](../../helpers/activity-copy.ts)): premium Unassigned → `unassigned macOS, iOS, and iPadOS hosts` / `unassigned Windows hosts`; premium Workstations → `<hostsPhrase> assigned to the Workstations fleet`.

**Assessment**
- *Value:* The only assertion in the area that pins the **rendered** activity copy *including the scope suffix* — i.e. the only one that can tell an Unassigned action from a Workstations action. Guards the frontend `getProfileMessageSuffix` branch that free/premium diverge on.
- *Coverage gaps:* Doesn't assert the actor name/avatar or the relative timestamp; doesn't assert ordering (upload before delete).
- *Redundancy:* Restates, through the UI, what CTL-01/CTL-03 already asserted via `assertActivity`. Keeping both is defensible (per-step attribution vs. rendered copy), but this is the more valuable of the two. Duplicated by **CTL-18** with the free suffix (`all <hostsPhrase>`), which is genuine tier coverage, not waste.
- *Efficiency / smells:* Up to 10 reloads × 15 feed pages makes this the slowest sub-test in the lifecycle and a prime flake candidate under load.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-05 · MDM • OS settings — configuration profile upload validation › rejects a signed .mobileconfig with a "can't be signed" error

- **File:** [`playwright/tests/e2e/premium/controls/os-settings/configuration-profiles.spec.ts`](../../tests/e2e/premium/controls/os-settings/configuration-profiles.spec.ts)
- **Grep:** `npx playwright test --project=premium premium/controls/os-settings/configuration-profiles.spec.ts -g "rejects a signed"`
- **Project:** premium · **Scopes:** Unassigned only
- **Mode:** UI · **Isolation:** standalone describe (negative path, outside the serial lifecycle)
- **Preconditions:** none. `pageHealth.disable()` — the deliberate 4xx may be logged to console
- **Data created:** none (upload is rejected). File: [`test-data/apple/macos/profiles/fleet-pw-inert-signed.mobileconfig`](../../test-data/apple/macos/profiles/fleet-pw-inert-signed.mobileconfig) — the inert profile wrapped in a DER CMS/PKCS7 signature (regeneration recipe in the fixture [README](../../test-data/apple/macos/profiles/README.md))

**Flow**

1. ☐ Dashboard → **Controls** → **OS settings** tab → **Configuration profiles** sidebar link → select **Unassigned**.
2. ☐ Click **Add profile**, choose the signed fixture, click **Add profile** in the modal (no success assertion — `submitProfileUpload`).
   - ✅ *(UI)* An **error** toast (`.toast-notification__card--error`) matching `/Configuration profiles can't be signed/`.

**Assessment**
- *Value:* Guards a real Fleet rule (Fleet signs profiles itself) that a parser refactor could silently drop.
- *Coverage gaps:* The modal's post-error state isn't asserted (does it stay open? is the file cleared? is the list still empty?). No sibling negative cases: malformed XML, wrong extension, oversized profile, duplicate PayloadIdentifier, or a Windows `.xml` with invalid SyncML.
- *Redundancy:* none.
- *Efficiency / smells:* `pageHealth.disable()` is broad — it switches off console *and* 5xx monitoring for the whole test, so a 500 from this endpoint would go unnoticed. Also the only negative-path test in the profiles file, and it runs Unassigned-only with no free mirror.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-06 · Premium • Controls • disk encryption › toggling disk-encryption enforcement persists

- **File:** [`playwright/tests/e2e/premium/controls/os-settings/disk-encryption.spec.ts`](../../tests/e2e/premium/controls/os-settings/disk-encryption.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "toggling disk-encryption enforcement persists"`
- **Project:** premium · **Scopes:** global config only (no team dropdown involved)
- **Mode:** UI+API · **Isolation:** standalone; `beforeEach` snapshots and `afterEach` restores the original value via the API, so it runs even on failure
- **Preconditions:** none — config-only, no host required
- **Data created:** none. Mutates `config.mdm.enable_disk_encryption` globally for the duration of the test

**Flow**

1. ☐ *(API precondition)* `GET /config` → remember `mdm.enable_disk_encryption` (`getAppConfig`).
2. ☐ Open `/controls/os-settings/disk-encryption` **via URL** (no navbar click-through).
   - ✅ *(UI)* The **Turn on disk encryption** checkbox is visible.
3. ☐ Flip the checkbox to the opposite of the current value (`check()` or `uncheck()` depending on state), then click **Save**.
   - ✅ *(UI)* A `role=alert` containing *"Successfully updated disk encryption enforcement."*
4. ☐ Reload `/controls/os-settings/disk-encryption`.
   - ✅ *(UI)* The checkbox is checked/unchecked to match the flipped value (`toBeChecked({ checked: !original })`).
5. ☐ *(API teardown)* `PATCH /config` restores the original value (`setGlobalDiskEncryption`).

**Assessment**
- *Value:* Catches a broken save/persist path on the disk-encryption card — the toggle silently not persisting is a plausible regression.
- *Coverage gaps:* Large. No **team-scoped** disk-encryption toggle (premium's main use of the feature). No activity-feed assertion (`enabled_disk_encryption` / `disabled_disk_encryption`). No assertion of the aggregate status table (Verified / Action required / Enforcing / Removing / Failed) or of the escrowed-key flow (`View key` on a host). No host-level effect — impossible on simulated hosts, but a `liveMacosHost`-based check is theoretically available and unused. Free tier is paywall-only (`free/paywalls.spec.ts` asserts the Premium banner on `/controls/os-settings`, `/disk-encryption`).
- *Redundancy:* none.
- *Efficiency / smells:*
  - The only spec in this area with **no page object** — raw `page.getByRole(...)` locators inline ([`disk-encryption.spec.ts:26,34,36`](../../tests/e2e/premium/controls/os-settings/disk-encryption.spec.ts)). Should get a `DiskEncryptionPage` (or move onto `OsSettingsPage`).
  - Uses a raw `getByRole('alert')` filter instead of the shared `Toast` component, so it doesn't distinguish success from error styling.
  - Direct-URL entry contradicts the e2e convention (`OsSettingsPage.diskEncryptionLink` exists and is unused by any spec).
  - The `if (original) uncheck else check` branch means the test exercises a different direction depending on instance state — on/off are not both covered in a single run.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-07 · Scripts library lifecycle (Unassigned · Workstations) — macOS · Linux · Windows › upload

- **File:** [`playwright/tests/e2e/premium/controls/scripts/library.spec.ts`](../../tests/e2e/premium/controls/scripts/library.spec.ts)
- **Grep:** `npx playwright test --project=premium premium/controls/scripts/library.spec.ts -g "upload$"`
- **Project:** premium · **Scopes:** Unassigned, Workstations · **OS cases:** macOS, Linux, Windows
- **Mode:** UI+API · **Isolation:** serial describe, step 1 of 5 (CTL-08…CTL-11 depend on it)
- **Preconditions:** `cleanup-setup` ran `deleteAllScripts` on `fleet_id=0` + Workstations; plus in-test `deleteIfExists`
- **Data created:** one library script per case, deleted by CTL-10. Files: [`test-data/apple/macos/scripts/macos-create-marker.sh`](../../test-data/apple/macos/scripts/macos-create-marker.sh), [`test-data/linux/scripts/linux-create-marker.sh`](../../test-data/linux/scripts/linux-create-marker.sh), [`test-data/windows/scripts/windows-create-marker.ps1`](../../test-data/windows/scripts/windows-create-marker.ps1) — each writes `/tmp/fleet-playwright-marker.txt` (or `%TEMP%\…`) so an osquery `file`-table check *could* confirm execution. **No spec ever runs them.**

**Flow**

1. ☐ Dashboard → click **Controls** in the navbar → click the **Scripts** tab.
   - ✅ *(UI)* URL matches `/controls` then `/controls/scripts`.
2. ☐ Select the scope in the team dropdown.
   - ✅ *(UI)* Dropdown value equals the scope label.
3. ☐ If a `.script-list-item` whose title button is exactly the filename exists, delete it (hover → **Delete `<name>`** → confirm **Delete**).
4. ☐ Click **+ Add script** (or **Upload** in the empty state) → the `.script-upload-modal` opens → choose the fixture on `input#upload-file` (`FileUploader.setFile`) → click **Add script** inside the modal.
   - ✅ *(UI)* Success toast *"Successfully uploaded."*
   - ✅ *(UI)* The upload modal is hidden.
   - ✅ *(UI)* A script row titled exactly the filename is visible.
   - ✅ *(API)* `added_script` activity with `details.script_name === <fileName>`, admin actor.
5. ☐ Click the script's name to open the edit/preview modal.
   - ✅ *(UI)* The `.edit-script-modal` is visible and its Ace `.ace_content` is non-empty (`openScript`).
   - ✅ *(UI)* The editor's trimmed innerText **exactly equals** the trimmed source file — the stored body round-trips.
6. ☐ Click **Cancel**.
   - ✅ *(UI)* The edit modal is hidden.

**Assessment**
- *Value:* The broadest test in the area — upload wiring, per-platform acceptance (.sh and .ps1), the list row, the activity, and a content round-trip through the editor.
- *Coverage gaps:* Platform tag on the row is never asserted (a .ps1 mis-tagged as macOS would pass). No shebang-less file, no `.zsh`/`.py`, no duplicate-filename conflict, no empty-file case, no `$FLEET_SECRET_*` reference in a script body. Crucially: **the script is never executed** — no host run, no output/exit-code verification, no Batch progress. `ScriptsBatchProgressPage` is exported from [`pages/index.ts:56`](../../pages/index.ts) but referenced by **zero** specs.
- *Redundancy:* Step 5's editor round-trip and **CTL-08**'s download round-trip assert the same stored-content property by two routes. Whole entry duplicated by **CTL-19** (free mirror).
- *Efficiency / smells:*
  - `assertActivity` again lacks a team discriminator ([`library.spec.ts:70`](../../tests/e2e/premium/controls/scripts/library.spec.ts)) — with 2 scopes × 3 OS describes able to run concurrently, a sibling scope's `added_script` for the same filename can satisfy it.
  - Reading Ace's rendered `.ace_content` innerText only works because the fixtures are ~6 lines; Ace virtualises long files, so this assertion silently doesn't scale.
  - `addScriptButton` is a regex OR (`/(Add script|Upload)$/`) with **no** `.first()` ([`ScriptsLibraryPage.ts:64`](../../pages/controls/ScriptsLibraryPage.ts)) — relies on the empty-state and populated-state buttons being mutually exclusive; a second "Upload"-suffixed button anywhere on the page trips strict mode.
  - Three of the five sub-tests in this describe re-read the same fixture from disk.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-08 · Scripts library lifecycle (Unassigned · Workstations) — macOS · Linux · Windows › download matches source

- **File:** [`playwright/tests/e2e/premium/controls/scripts/library.spec.ts`](../../tests/e2e/premium/controls/scripts/library.spec.ts)
- **Grep:** `npx playwright test --project=premium premium/controls/scripts/library.spec.ts -g "download matches source"`
- **Project:** premium · **Scopes:** Unassigned, Workstations · **OS cases:** macOS, Linux, Windows
- **Mode:** UI · **Isolation:** serial describe, step 2 of 5 (needs CTL-07's script)
- **Preconditions:** CTL-07 passed
- **Data created:** none

**Flow**

1. ☐ Go to `/controls/scripts/library?fleet_id=<id>` **via URL**; re-select the scope.
   - ✅ *(UI)* The **Library** heading (h2) is visible.
2. ☐ Hover the script row and click **Download `<name>`** (`clickHoverAction`, up to 3 hover retries then a force-click).
   - ✅ *(UI)* A download fires and its **trimmed** content equals the trimmed source file.

**Assessment**
- *Value:* Round-trip proof that Fleet stores the script body verbatim.
- *Coverage gaps:* Trimmed comparison, so trailing-newline/CRLF regressions (real risk for the `.ps1`) are invisible — contrast CTL-02, which compares profiles byte-for-byte. Downloaded filename not asserted.
- *Redundancy:* Same property as CTL-07 step 5 (editor preview). One of the two could go — the download is the more end-to-end of the pair. Duplicated by **CTL-20**.
- *Efficiency / smells:* `await download.path()` unguarded for null.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-09 · Scripts library lifecycle (Unassigned · Workstations) — macOS · Linux · Windows › edit

- **File:** [`playwright/tests/e2e/premium/controls/scripts/library.spec.ts`](../../tests/e2e/premium/controls/scripts/library.spec.ts)
- **Grep:** `npx playwright test --project=premium premium/controls/scripts/library.spec.ts -g "› edit$"`
- **Project:** premium · **Scopes:** Unassigned, Workstations · **OS cases:** macOS, Linux, Windows
- **Mode:** UI+API · **Isolation:** serial describe, step 3 of 5
- **Preconditions:** CTL-07 passed
- **Data created:** none new — mutates CTL-07's script body (appends `# edited by playwright`)

**Flow**

1. ☐ Go to `/controls/scripts/library?fleet_id=<id>` **via URL**; re-select the scope.
   - ✅ *(UI)* **Library** heading visible.
2. ☐ Click the script's name → the edit modal opens with the body loaded.
   - ✅ *(UI)* `.edit-script-modal` visible, `.ace_content` non-empty.
3. ☐ Replace the editor's text with the source plus `# edited by playwright`, through Ace's own API (`replaceEditorContent` → `setAceValue`; typing would let Ace auto-indent and close quotes).
   - ✅ *(UI)* The editor shows exactly the new text (polled, through `normalizeScript`).
4. ☐ Click **Save** → the **"Save changes?"** warning sub-modal appears → click **Save** again.
   - ✅ *(UI)* The warning sub-modal was visible (asserted before the second click).
   - ✅ *(UI)* Success toast *"Successfully saved script."*
   - ✅ *(UI)* The edit modal is hidden.
   - ✅ *(API)* `updated_script` activity with matching `script_name`, admin actor.
5. ☐ Re-open the script and read the editor.
   - ✅ *(UI)* The persisted body **equals** the whole edited script (source plus `# edited by playwright`).
6. ☐ Click **Cancel** → modal hidden.

**Assessment**
- *Value:* The only in-place content-edit flow in the area, and the only place the "Save changes?" confirmation sub-modal is exercised.
- *Coverage gaps:* Cancel-without-saving (does the body stay unchanged?) is untested. No validation of oversize-on-edit, and no check that editing does **not** change the filename/platform tag.
- *Redundancy:* Duplicated by **CTL-21**.
- *Efficiency / smells:*
  - The edit is written through Ace's API, so the test proves what Fleet stores and shows, not that a user can type a multi-line script into the editor.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-10 · Scripts library lifecycle (Unassigned · Workstations) — macOS · Linux · Windows › delete

- **File:** [`playwright/tests/e2e/premium/controls/scripts/library.spec.ts`](../../tests/e2e/premium/controls/scripts/library.spec.ts)
- **Grep:** `npx playwright test --project=premium premium/controls/scripts/library.spec.ts -g "› delete$"`
- **Project:** premium · **Scopes:** Unassigned, Workstations · **OS cases:** macOS, Linux, Windows
- **Mode:** UI+API · **Isolation:** serial describe, step 4 of 5 — **cleanup step** for CTL-07
- **Preconditions:** CTL-07 passed
- **Data created:** none — removes CTL-07's script

**Flow**

1. ☐ Go to `/controls/scripts/library?fleet_id=<id>` **via URL**; re-select the scope.
2. ☐ Hover the row → click **Delete `<name>`** → the `.delete-script-modal` appears → click **Delete**.
   - ✅ *(UI)* The delete modal was visible before confirming.
   - ✅ *(UI)* The row is hidden (asserted in the POM and again in the spec).
   - ✅ *(API)* `deleted_script` activity with matching `script_name`, admin actor.

**Assessment**
- *Value:* Confirms delete + activity, and cleans up the lifecycle's state.
- *Coverage gaps:* **No success-toast assertion** — `deleteScript` omits the toast check that `deleteProfile` has ([`ScriptsLibraryPage.ts:184`](../../pages/controls/ScriptsLibraryPage.ts) vs [`ConfigurationProfilesPage.ts:111`](../../pages/controls/ConfigurationProfilesPage.ts)). Cancel path untested. No check that deleting a script referenced by a policy or by Setup experience is blocked/warned.
- *Redundancy:* Row-hidden asserted twice (POM + spec body). Duplicated by **CTL-22**.
- *Efficiency / smells:* Missing team discriminator on `assertActivity`, as in CTL-07.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-11 · Scripts library lifecycle (Unassigned · Workstations) — macOS · Linux · Windows › activity feed shows upload → edit → delete

- **File:** [`playwright/tests/e2e/premium/controls/scripts/library.spec.ts`](../../tests/e2e/premium/controls/scripts/library.spec.ts)
- **Grep:** `npx playwright test --project=premium premium/controls/scripts/library.spec.ts -g "activity feed shows upload → edit → delete"`
- **Project:** premium · **Scopes:** Unassigned, Workstations · **OS cases:** macOS, Linux, Windows
- **Mode:** UI · **Isolation:** serial describe, step 5 of 5
- **Preconditions:** CTL-07, CTL-09, CTL-10 passed
- **Data created:** none

**Flow**

1. ☐ Open the dashboard (global feed).
   - ✅ *(UI)* First dashboard card visible.
2. ☐ Read the **Activity** feed (≤15 pages, ≤10 reloads).
   - ✅ *(UI)* `added script <name> to <scope>.`
   - ✅ *(UI)* `edited script <name> for <scope>.`
   - ✅ *(UI)* `deleted script <name> from <scope>.`
   - Scope phrase from `scriptScope` ([`helpers/activity-copy.ts:57`](../../helpers/activity-copy.ts)): Unassigned → `unassigned`; Workstations → `the Workstations fleet`. Note the three different prepositions (to / for / from) — that asymmetry is real Fleet copy and is what this test pins.
- ⚠️ unclear: with the same filename uploaded under both scopes in the same run, this assertion is satisfied by *any* matching row; it pins the copy but can't prove the row belongs to this describe's own action.

**Assessment**
- *Value:* Pins three distinct rendered activity strings including the scope suffix and the to/for/from preposition asymmetry — the highest-value copy contract in the scripts lifecycle.
- *Coverage gaps:* Ordering isn't asserted; actor and timestamp aren't asserted.
- *Redundancy:* Re-verifies through the UI what CTL-07/CTL-09/CTL-10 already asserted via `assertActivity`. Duplicated by **CTL-23** (free), where the scope is hard-coded `'Unassigned'` → `unassigned`.
- *Efficiency / smells:* Runs 6× on premium (2 scopes × 3 OS) for what is effectively one copy contract per scope; the OS dimension adds nothing here beyond the filename. Prime candidate for collapsing to one activity-feed sub-test per scope.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-12 · Scripts library — upload validation › rejects a script larger than 500,000 characters

- **File:** [`playwright/tests/e2e/premium/controls/scripts/library.spec.ts`](../../tests/e2e/premium/controls/scripts/library.spec.ts)
- **Grep:** `npx playwright test --project=premium premium/controls/scripts/library.spec.ts -g "rejects a script larger"`
- **Project:** premium · **Scopes:** Unassigned only
- **Mode:** UI · **Isolation:** standalone describe (negative path)
- **Preconditions:** none. `pageHealth.disable()` (intentional 4xx)
- **Data created:** a ~500 KB `playwright-oversized-script.sh` written to `os.tmpdir()` at runtime and **never deleted**; nothing is created server-side

**Flow**

1. ☐ *(setup)* Generate a 500,001-character script on disk.
2. ☐ Dashboard → **Controls** → **Scripts** tab → select **Unassigned**.
3. ☐ Click **+ Add script**, choose the oversized file, click **Add script** in the modal (`submitScriptUpload`, no success assertion).
   - ✅ *(UI)* Error toast matching `/Script is too large\. It's limited to 500,000 characters/`.

**Assessment**
- *Value:* Guards a documented server-side limit and its user-facing message.
- *Coverage gaps:* Boundary not covered — a 500,000-char script (exactly at the limit) should be *accepted* and isn't tested. Modal post-error state and "list unchanged" aren't asserted.
- *Redundancy:* none (no free mirror).
- *Efficiency / smells:* Writes to `os.tmpdir()` rather than a per-run temp dir and leaves the file behind ([`library.spec.ts:135`](../../tests/e2e/premium/controls/scripts/library.spec.ts)); `FileUploader.setFile` accepts an in-memory `{name, mimeType, buffer}` payload, so no file needs to touch disk at all. `pageHealth.disable()` also switches off 5xx monitoring.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-13 · Shared • Controls • custom variables › add a custom variable and delete it

- **File:** [`playwright/tests/e2e/shared/controls/custom-variables.spec.ts`](../../tests/e2e/shared/controls/custom-variables.spec.ts) (L52)
- **Grep:** `npx playwright test --project=premium -g "add a custom variable and delete it"` (or `--project=free`)
- **Project:** premium, free (shared) · **Scopes:** global variables only
- **Mode:** UI · **Isolation:** self-contained (create + delete in one test); the `afterEach` purges the exact name it created via `DELETE /custom_variables/:id` (`deleteVariablesMatching`), after deleting the test's script when there is one (none here)
- **Preconditions:** none
- **Data created:** custom variable `PW_VAR_<Date.now()>` with value `pw-secret-value`, deleted in-test. `cleanup-setup`/`cleanup-teardown` delete any `PW_VAR_*` variable a crashed run leaves (after the Unassigned scripts, since Fleet refuses to delete a variable a script references)

**Flow**

1. ☐ Open `/controls/variables/global-variables` **via URL** (no click-through; `ControlsPage.goToVariables` exists and is unused).
   - ✅ *(UI)* The **Global variables** heading is visible.
2. ☐ Click **Add variable** → the **Add custom variable** modal opens.
   - ✅ *(UI)* Modal visible.
3. ☐ Fill **Name** = `PW_VAR_<ts>` and **Value** = `pw-secret-value`, click **Save**.
   - ✅ *(UI)* The modal closes.
   - ✅ *(UI)* Success toast *"Variable created."*
4. ☐ Look at the variables table.
   - ✅ *(UI)* A row containing the name is visible (`DataTable.rowWith` — substring match on row text).
   - ✅ *(UI)* The row renders the reference form `$FLEET_SECRET_<NAME>`.
5. ☐ Click **Delete `<name>`** on the row → the **Delete custom variable** modal → click **Delete**.
   - ✅ *(UI)* The delete modal closes.
   - ✅ *(UI)* Success toast *"Variable successfully deleted."*
   - ✅ *(UI)* No row with that name remains (`toHaveCount(0)`).

**Assessment**
- *Value:* Covers the add/delete round-trip and the `$FLEET_SECRET_` reference rendering, on both tiers — which also shows the Variables page isn't premium-gated (only its description differs on free).
- *Coverage gaps:* a variable in use is CTL-35/36's, for scripts only — nothing references one from a configuration profile, and nothing proves a host receives the substituted value. Also untested: editing a variable's value, the value being write-only/masked after creation, duplicate-name rejection, the built-in `$FLEET_VAR_*` list on the same page, and per-fleet (non-global) variables.
- *Redundancy:* none.
- *Efficiency / smells:* Direct-URL entry contradicts the e2e click-through convention. `variableRow` is a substring row match — safe only because of the `Date.now()` suffix. No API-side confirmation that the secret value was stored. The name scheme (`PW_VAR_<Date.now()>`) differs from CTL-35/36's (`PW_VAR_<runNonce>`) in the same file.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-14 · Shared • Controls • custom variables › the add form auto-uppercases and validates the name

- **File:** [`playwright/tests/e2e/shared/controls/custom-variables.spec.ts`](../../tests/e2e/shared/controls/custom-variables.spec.ts) (L70)
- **Grep:** `npx playwright test --project=premium -g "auto-uppercases and validates"` (or `--project=free`)
- **Project:** premium, free (shared) · **Scopes:** n/a
- **Mode:** UI · **Isolation:** self-contained; nothing is saved, so the `afterEach` no-ops
- **Preconditions:** none
- **Data created:** none (form-only)

**Flow**

1. ☐ Open `/controls/variables/global-variables` **via URL**; click **Add variable**.
   - ✅ *(UI)* **Global variables** heading; **Add custom variable** modal visible.
2. ☐ Type `pw_lowercase_only` into **Name**.
   - ✅ *(UI)* The field's value becomes `PW_LOWERCASE_ONLY` (auto-uppercase).
3. ☐ Replace it with `bad name!`.
   - ✅ *(UI)* The error *"Name may only include uppercase letters, numbers, and underscores"* is visible inside the modal.
   - ✅ *(UI)* **Save** is disabled.
4. ☐ Replace it with `PW_VALID_NAME`.
   - ✅ *(UI)* The format error is gone (`toHaveCount(0)`).
   - ✅ *(UI)* **Save** is enabled.

**Assessment**
- *Value:* Cheap, fast, fully deterministic client-side validation check; catches a regression in the name normaliser or the Save gate, on both tiers.
- *Coverage gaps:* **Value** is left empty yet Save is asserted *enabled* at step 4 — the spec's own header claims the form "requires a value", so either the doc comment or the product is wrong. ⚠️ unclear: whether Save should be disabled with an empty Value; this test asserts it is enabled. Also untested: leading-digit or leading-underscore names, max length, reserved `FLEET_`-prefixed names, and Cancel discarding input.
- *Redundancy:* none.
- *Efficiency / smells:* Same direct-URL entry as CTL-13; the two variables tests each re-navigate and re-open the modal, so they could share a helper. Leaves the modal open at teardown (harmless). Running it on free buys little — a client-side validator in a component the tiers share — but costs a second or two.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-15 · MDM • OS settings — configuration profiles — macOS · Windows › upload  *(free)*

- **File:** [`playwright/tests/e2e/free/controls/os-settings/configuration-profiles.spec.ts`](../../tests/e2e/free/controls/os-settings/configuration-profiles.spec.ts)
- **Grep:** `npx playwright test --project=free free/controls/os-settings/configuration-profiles.spec.ts -g "upload$"`
- **Project:** free · **Scopes:** none (no team dropdown on free) · **OS cases:** macOS, Windows
- **Mode:** UI+API · **Isolation:** serial describe, step 1 of 4
- **Preconditions:** `cleanup-setup` ran `deleteAllConfigurationProfiles` on `fleet_id=0`; plus in-test `deleteIfExists`
- **Data created:** same two fixtures as CTL-01, deleted by CTL-17. **Both can be delivered to the free VMs**: free has no fleets, so Unassigned holds the MDM-enrolled macOS and Windows VMs, and whenever Fleet's 30-second profile reconciler ticks between this upload and CTL-17's delete, it sends them the profile. That is why only the inert pair may ever be used here (fixture READMEs). Until 2026-09-29 this entry used a passcode profile and a DeviceLock profile, and the free VMs received them 7 and 32 times

**Flow**

1. ☐ Dashboard → **Controls** → **OS settings** tab → **Configuration profiles** sidebar link. (On free the OS-settings root renders the Premium paywall for Disk encryption; the sidebar still offers Configuration profiles.)
   - ✅ *(UI)* URL `/controls` → `/controls/os-settings` → `/controls/os-settings/configuration-profiles`.
2. ☐ Delete a leftover profile with the same display name if present.
3. ☐ Click **Add profile** → modal → choose the fixture → **Add profile**.
   - ✅ *(UI)* *"Successfully uploaded."* toast; modal hidden.
   - ✅ *(UI)* Row with the exact display name is visible.
   - ✅ *(API)* `created_macos_profile` / `created_windows_profile` with matching `profile_name`, admin actor.

**Assessment**
- *Value:* Confirms custom profiles work on the free tier (they are not paywalled) — the free/premium gate is the real thing under test.
- *Coverage gaps:* Same list as CTL-01, plus: no negative-path (signed-profile) mirror on free.
- *Redundancy:* Line-for-line duplicate of **CTL-01** minus the scope loop and dropdown call. Intentional under the suite's tier-separation convention; the only behavioural difference worth keeping is the activity copy asserted in CTL-18.
- *Efficiency / smells:* `assertActivity` needs no team discriminator here (free has no teams), but the predicate is copy-pasted from premium. `.first()` on `addProfileButton` as in CTL-01.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-16 · MDM • OS settings — configuration profiles — macOS · Windows › download matches source  *(free)*

- **File:** [`playwright/tests/e2e/free/controls/os-settings/configuration-profiles.spec.ts`](../../tests/e2e/free/controls/os-settings/configuration-profiles.spec.ts)
- **Grep:** `npx playwright test --project=free free/controls/os-settings/configuration-profiles.spec.ts -g "download matches source"`
- **Project:** free · **OS cases:** macOS, Windows
- **Mode:** UI · **Isolation:** serial describe, step 2 of 4
- **Preconditions:** CTL-15 passed
- **Data created:** none

**Flow**

1. ☐ Go to `/controls/os-settings/configuration-profiles` **via URL** (no `fleet_id` on free).
   - ✅ *(UI)* **Configuration profiles** heading visible.
2. ☐ Hover the row → click the **download** icon.
   - ✅ *(UI)* Downloaded bytes are identical to the source fixture.

**Assessment**
- *Value:* Same round-trip guarantee as CTL-02, on the free code path (which shares the same handler).
- *Coverage gaps:* Filename not asserted.
- *Redundancy:* Exact duplicate of **CTL-02** with no tier-specific difference — the download endpoint is not tier-gated. **Strongest deletion candidate in this area.**
- *Efficiency / smells:* Unguarded `download.path()`.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-17 · MDM • OS settings — configuration profiles — macOS · Windows › delete  *(free)*

- **File:** [`playwright/tests/e2e/free/controls/os-settings/configuration-profiles.spec.ts`](../../tests/e2e/free/controls/os-settings/configuration-profiles.spec.ts)
- **Grep:** `npx playwright test --project=free free/controls/os-settings/configuration-profiles.spec.ts -g "› delete$"`
- **Project:** free · **OS cases:** macOS, Windows
- **Mode:** UI+API · **Isolation:** serial describe, step 3 of 4 — **cleanup step** for CTL-15
- **Preconditions:** CTL-15 passed
- **Data created:** none — removes CTL-15's profile

**Flow**

1. ☐ Go to `/controls/os-settings/configuration-profiles` **via URL**.
2. ☐ Hover the row → **trash** → **Delete** in the confirm modal.
   - ✅ *(UI)* *"Successfully deleted."* toast.
   - ✅ *(UI)* Row hidden (asserted in POM and in the spec).
   - ✅ *(API)* `deleted_macos_profile` / `deleted_windows_profile` activity, matching name, admin actor.

**Assessment**
- *Value:* Delete works on free; also the lifecycle's cleanup.
- *Coverage gaps:* Cancel path untested.
- *Redundancy:* Duplicate of **CTL-03** apart from the missing dropdown; no tier-specific behaviour.
- *Efficiency / smells:* Doubled row-hidden assertion.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-18 · MDM • OS settings — configuration profiles — macOS · Windows › activity feed shows upload → delete  *(free)*

- **File:** [`playwright/tests/e2e/free/controls/os-settings/configuration-profiles.spec.ts`](../../tests/e2e/free/controls/os-settings/configuration-profiles.spec.ts)
- **Grep:** `npx playwright test --project=free free/controls/os-settings/configuration-profiles.spec.ts -g "activity feed shows upload → delete"`
- **Project:** free · **OS cases:** macOS, Windows
- **Mode:** UI · **Isolation:** serial describe, step 4 of 4
- **Preconditions:** CTL-15 and CTL-17 passed
- **Data created:** none

**Flow**

1. ☐ Open the dashboard.
   - ✅ *(UI)* First card visible.
2. ☐ Read the **Activity** feed (≤15 pages, ≤10 reloads).
   - ✅ *(UI)* `added configuration profile <name> to all <hostsPhrase>.`
   - ✅ *(UI)* `deleted configuration profile <name> from all <hostsPhrase>.`
   - The `all <hostsPhrase>` suffix is the **free-only** branch of `profileSuffix` (no `scope` argument is passed, and the helper checks `process.env.SUITE`).

**Assessment**
- *Value:* The one place the free-tier `getProfileMessageSuffix` branch is asserted — genuine, non-duplicated tier coverage.
- *Coverage gaps:* Ordering, actor and timestamp not asserted.
- *Redundancy:* Structurally parallel to **CTL-04**, but the asserted string differs by tier, so both are needed.
- *Efficiency / smells:* Same reload/paging cost as CTL-04; runs twice on free (once per OS) for what is one copy contract per hostsPhrase — though here the hostsPhrase *is* the OS dimension, so both runs earn their keep.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-19 · Scripts library lifecycle — macOS · Linux · Windows › upload  *(free)*

- **File:** [`playwright/tests/e2e/free/controls/scripts/library.spec.ts`](../../tests/e2e/free/controls/scripts/library.spec.ts)
- **Grep:** `npx playwright test --project=free free/controls/scripts/library.spec.ts -g "upload$"`
- **Project:** free · **OS cases:** macOS, Linux, Windows
- **Mode:** UI+API · **Isolation:** serial describe, step 1 of 5
- **Preconditions:** `cleanup-setup` ran `deleteAllScripts` on `fleet_id=0`; plus in-test `deleteIfExists`
- **Data created:** the same three marker-script fixtures as CTL-07, deleted by CTL-22. **Never executed on a host** (free instance hosts are simulations too, and no free spec uses `liveMacosHost`)

**Flow**

1. ☐ Dashboard → **Controls** → **Scripts** tab.
   - ✅ *(UI)* URL `/controls` → `/controls/scripts`.
2. ☐ Delete a leftover script with the same filename if present.
3. ☐ Click **+ Add script** / **Upload** → modal → choose the fixture → **Add script**.
   - ✅ *(UI)* *"Successfully uploaded."* toast; modal hidden.
   - ✅ *(UI)* Row titled exactly the filename is visible.
   - ✅ *(API)* `added_script` activity with matching `script_name`, admin actor.
4. ☐ Click the script name → editor modal.
   - ✅ *(UI)* Modal visible, `.ace_content` non-empty; trimmed editor text **equals** the trimmed source.
5. ☐ Click **Cancel** → modal hidden.

**Assessment**
- *Value:* Confirms the scripts library is available and functional on free (not paywalled).
- *Coverage gaps:* Same as CTL-07 (no platform-tag assertion, no execution, no Batch progress), plus no oversize negative mirror on free.
- *Redundancy:* Duplicate of **CTL-07** minus the scope loop; the underlying handler is not tier-gated.
- *Efficiency / smells:* Ace `innerText` comparison scales badly (see CTL-07); the free file duplicates the premium `ScriptCase` table almost verbatim (it names the field `fileName` where premium names it `baseName` — a gratuitous divergence).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-20 · Scripts library lifecycle — macOS · Linux · Windows › download matches source  *(free)*

- **File:** [`playwright/tests/e2e/free/controls/scripts/library.spec.ts`](../../tests/e2e/free/controls/scripts/library.spec.ts)
- **Grep:** `npx playwright test --project=free free/controls/scripts/library.spec.ts -g "download matches source"`
- **Project:** free · **OS cases:** macOS, Linux, Windows
- **Mode:** UI · **Isolation:** serial describe, step 2 of 5
- **Preconditions:** CTL-19 passed
- **Data created:** none

**Flow**

1. ☐ Go to `/controls/scripts/library` **via URL**.
   - ✅ *(UI)* **Library** heading visible.
2. ☐ Hover the row → click **Download `<name>`**.
   - ✅ *(UI)* Trimmed downloaded content equals the trimmed source.

**Assessment**
- *Value:* Round-trip on the free path.
- *Coverage gaps:* Trimmed comparison hides trailing-newline/CRLF regressions; filename unchecked.
- *Redundancy:* Exact duplicate of **CTL-08**, and of CTL-19's editor round-trip. Deletion candidate.
- *Efficiency / smells:* Unguarded `download.path()`.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-21 · Scripts library lifecycle — macOS · Linux · Windows › edit  *(free)*

- **File:** [`playwright/tests/e2e/free/controls/scripts/library.spec.ts`](../../tests/e2e/free/controls/scripts/library.spec.ts)
- **Grep:** `npx playwright test --project=free free/controls/scripts/library.spec.ts -g "› edit$"`
- **Project:** free · **OS cases:** macOS, Linux, Windows
- **Mode:** UI+API · **Isolation:** serial describe, step 3 of 5
- **Preconditions:** CTL-19 passed
- **Data created:** none new — appends `# edited by playwright` to CTL-19's script

**Flow**

1. ☐ Go to `/controls/scripts/library` **via URL**.
2. ☐ Click the script name → editor opens with content loaded.
3. ☐ Replace the editor's text with the source plus `# edited by playwright` through Ace's own API (`replaceEditorContent`).
4. ☐ Click **Save** → **"Save changes?"** sub-modal → **Save**.
   - ✅ *(UI)* Sub-modal was visible; *"Successfully saved script."* toast; edit modal hidden.
   - ✅ *(API)* `updated_script` activity with matching `script_name`, admin actor.
5. ☐ Re-open the script.
   - ✅ *(UI)* Persisted body **equals** the whole edited script.
6. ☐ Click **Cancel** → modal hidden.

**Assessment**
- *Value:* Edit + save-confirmation flow on free.
- *Coverage gaps:* Cancel-without-save untested.
- *Redundancy:* Duplicate of **CTL-09**.
- *Efficiency / smells:* Retypes the whole file; slowest free sub-test in the area.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-22 · Scripts library lifecycle — macOS · Linux · Windows › delete  *(free)*

- **File:** [`playwright/tests/e2e/free/controls/scripts/library.spec.ts`](../../tests/e2e/free/controls/scripts/library.spec.ts)
- **Grep:** `npx playwright test --project=free free/controls/scripts/library.spec.ts -g "› delete$"`
- **Project:** free · **OS cases:** macOS, Linux, Windows
- **Mode:** UI+API · **Isolation:** serial describe, step 4 of 5 — **cleanup step** for CTL-19
- **Preconditions:** CTL-19 passed
- **Data created:** none — removes CTL-19's script

**Flow**

1. ☐ Go to `/controls/scripts/library` **via URL**.
2. ☐ Hover the row → **Delete `<name>`** → confirm **Delete**.
   - ✅ *(UI)* Delete modal was visible; the row is hidden (POM + spec).
   - ✅ *(API)* `deleted_script` activity with matching `script_name`, admin actor.

**Assessment**
- *Value:* Delete on free; lifecycle cleanup.
- *Coverage gaps:* No success-toast assertion (POM omission, see CTL-10); Cancel path untested.
- *Redundancy:* Duplicate of **CTL-10**.
- *Efficiency / smells:* Doubled row-hidden assertion.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-23 · Scripts library lifecycle — macOS · Linux · Windows › activity feed shows upload → edit → delete  *(free)*

- **File:** [`playwright/tests/e2e/free/controls/scripts/library.spec.ts`](../../tests/e2e/free/controls/scripts/library.spec.ts)
- **Grep:** `npx playwright test --project=free free/controls/scripts/library.spec.ts -g "activity feed shows upload → edit → delete"`
- **Project:** free · **OS cases:** macOS, Linux, Windows
- **Mode:** UI · **Isolation:** serial describe, step 5 of 5
- **Preconditions:** CTL-19, CTL-21, CTL-22 passed
- **Data created:** none

**Flow**

1. ☐ Open the dashboard.
   - ✅ *(UI)* First card visible.
2. ☐ Read the **Activity** feed (≤15 pages, ≤10 reloads).
   - ✅ *(UI)* `added script <name> to unassigned.`
   - ✅ *(UI)* `edited script <name> for unassigned.`
   - ✅ *(UI)* `deleted script <name> from unassigned.`
   - The spec hard-codes `scope: 'Unassigned'` because `activityCopy.script.*` requires a `TeamScope`; free has none.

**Assessment**
- *Value:* Pins the rendered script activity copy on free.
- *Coverage gaps:* Ordering, actor, timestamp not asserted.
- *Redundancy:* Same three strings as the Unassigned half of **CTL-11** — `scriptScope` is not tier-aware, so free and premium-Unassigned assert **identical** regexes. Pure duplication across tiers.
- *Efficiency / smells:* Hard-coded `'Unassigned'` on a tier with no teams is a small conceptual leak; runs 3× (once per OS) for one copy contract.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-24 · Premium • Controls • Batch script run › a batch on one VM of each platform puts each host in the status its platform earns

- **File:** [`playwright/tests/e2e/premium/controls/scripts/batch-run.spec.ts`](../../tests/e2e/premium/controls/scripts/batch-run.spec.ts)
- **Grep:** `npx playwright test --project=premium premium/controls/scripts/batch-run.spec.ts -g "a batch on one VM of each platform"`
- **Project:** premium only — batch runs are scoped to one fleet, and free has none · **Scopes:** the **VMs** fleet (`vmsFleetId` worker fixture)
- **Mode:** UI+API · **Isolation:** standalone; first of two independent tests in the describe. Budget **720s** (describe-level).
- **Preconditions:** **all three real VMs online** — macOS, Ubuntu and Windows, resolved in parallel with `requireRealHost(request, platform)` ([`helpers/api/hosts.ts`](../../helpers/api/hosts.ts); `findOnlineHost(…, { kind: 'real' })` underneath — hardware model, not MDM), all on the VMs fleet (id 103). ✅ *(API)* one of each exists, else it throws *"no online real <platform> VM … Check the <platform> VM is powered on and enrolled."* Each VM runs scripts one at a time and shares its queue with the host-execution specs ([HOST-19…22](02-hosts-shared-and-free.md)). Script execution on.
- **Data created:** library script `pw-batch-run-<id>.sh` on the VMs fleet — `if [ "$(uname)" = Linux ]; then echo "fails on Linux"; exit 1; fi; echo "ran on $(uname)"` — deleted in `finally` (and by `cleanup-setup`'s `pw-` sweep of the VMs fleet if the test dies). The **batch record** (Batch progress → Finished) and the batch activity are permanent — nothing deletes a batch.

**Flow**

1. ☐ *(API setup)* upload the script to the VMs fleet.
2. ☐ Dashboard → navbar **Hosts** → fleet dropdown **VMs**.
3. ☐ Tick the row checkbox of the macOS, Ubuntu and Windows VM (rows matched by the exact display-name link).
4. ☐ In the selection bar, click **Run script**.
   - ✅ *(UI)* the batch modal reads **"Run a script on 3 hosts…"**.
5. ☐ Hover the script's list item, click its **Run script** button.
   - ✅ *(UI)* the modal reads **"`<script>` will run on compatible hosts (macOS and Linux)."**
   - ✅ *(UI)* the **Run now** radio is checked (the default).
6. ☐ Click **Run**.
   - ✅ *(UI)* success toast matching `/^Successfully ran script\./`; the modal closes.
7. ☐ Click the success toast's **Show script activity** link (`RunScriptBatchModal.showScriptActivity()`; `runNow` cleared earlier toasts before running, so it's this run's).
   - ✅ *(UI)* exactly one **Show script activity** link is on screen.
   - ✅ *(UI)* Controls → Scripts → **Batch progress**, with the **Started** tab `aria-selected`.
   - ✅ *(UI)* the batch's list item contains **`/ 3 hosts`** — the denominator; the numerator is still moving.
8. ☐ *(wait — no user action)* ✅ *(API)* `GET /scripts/batch?fleet_id=<VMs>` finds this script's newest batch; `GET /scripts/batch/:id` polls `status` to **`finished`** (10s interval, **480s** budget). Fleet marks a batch finished from a **cron**, which lands **2–4 minutes after the last host reports** — the page doesn't live-update, so the spec waits on the API rather than watching it.
   - ✅ *(API)* summary **`{ targeted: 3, ran: 1, errored: 1, incompatible: 1, pending: 0, canceled: 0 }`**.
9. ☐ Reload the page, click the **Finished** tab.
   - ✅ *(UI)* the batch's item contains **Completed**.
10. ☐ Click the batch.
    - ✅ *(UI)* the details page's `h2` equals the script name.
    - ✅ *(UI)* summary reads exactly **`3 hosts targeted (67% responded)`** — incompatible hosts never respond, so two of three is the whole answer.
11. ☐ For each of **Ran** (macOS), **Errored** (Ubuntu), **Incompatible** (Windows — a `.sh` can't run there):
    - ✅ *(UI)* the tab's accessible name is **`<Status> 1`**.
    - ☐ Click the tab → ✅ *(UI)* it is `aria-selected`.
    - ✅ *(UI)* the tab lists **exactly** `[<that VM's display name>]`.
    - ✅ *(UI)* Ran's row contains **`ran on Darwin`**; Errored's row contains **`fails on Linux`** (Incompatible has no output).
12. ☐ Click **Pending**, then **Canceled** → ✅ *(UI)* each shows **"No hosts with this status"**.
13. ☐ Open the **Dashboard** → ✅ *(UI)* feed has **"… ran the `<script>` script on 3 hosts."** (`activityCopy.script.ranBatch`).

**Assessment**
- *Value:* high. One batch, three platforms, three different outcomes, each asserted as *the right host in the right tab with its own output* — that is the behaviour of a batch run, not just "a batch exists". The script's `uname` branch is a neat way to get a deterministic Errored row without a second script. Closes the "Batch script execution — untested" gap and retires the orphaned `ScriptsBatchProgressPage` noted in the original audit.
- *Coverage gaps:* **Schedule for later** and the **Scheduled** tab are untested; **cancel** a batch untested (the Canceled tab is only asserted empty); the Started-tab numerator never observed moving; the Errored row's Orbit-appended `script execution error: exit status 1` unasserted (HOST-20 does pin that line for a single run); no host-side view of the batch run (each host's Activity card should list it); the batch details page's host links are not followed.
- *Redundancy:* the per-status counts are asserted twice — once from the API summary, once from the UI tab names — which is fine: the API assertion is the wait's by-product, the UI one is the rendering.
- *Efficiency / smells:*
  - Most of the budget is Fleet's cron, not the test. At 2–4 min per batch plus a possibly busy VM queue, this is one of the slowest tests in the suite; the 720s budget is honest.
  - Resolves the three VMs *before* checking they're on the VMs fleet — if one were ever moved, `hostCheckbox` would fail on a missing row rather than with a clear precondition message.
  - ~~**`page.getByRole('link', { name: 'Show script activity' })` is raw in the spec rather than on a page object.**~~ **Fixed 2026-09-28:** it is `RunScriptBatchModal.showScriptActivity()`, scoped to the success toast. Original finding: the raw page-wide link locator sat in the spec.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-25 · Premium • Controls • Batch script run › a batch on every matching simulation targets exactly them, and accounts for each

- **File:** [`playwright/tests/e2e/premium/controls/scripts/batch-run.spec.ts`](../../tests/e2e/premium/controls/scripts/batch-run.spec.ts)
- **Grep:** `npx playwright test --project=premium premium/controls/scripts/batch-run.spec.ts -g "a batch on every matching simulation"`
- **Project:** premium only · **Scopes:** **Unassigned** (fleet 0), where the osquery-perf pool lives
- **Mode:** UI+API · **Isolation:** standalone; independent of CTL-24. Budget 720s.
- **Preconditions:** **> 50 online hosts in the built-in `macOS` label in Unassigned** — "Select all matching hosts" is only offered once the matches run past one page. A thin pool means the load fleet is due its daily refresh (`tools/perf-hosts/`). Real VMs are on the VMs fleet, so none can be caught by this batch. Note the README's standing warning: **built-in platform labels are not assertable on these instances** — osquery-perf answers every built-in label query, so the "macOS" label holds mostly-*Ubuntu* simulations. The spec is honest about that in its arithmetic (it reads the label's own member list) even though its header says "every online macOS simulation".
- **Data created:** library script `pw-batch-scale-<id>.sh` (`echo scale`) in Unassigned, deleted in `finally` (and by `cleanup-setup`'s Unassigned wipe). A permanent batch record and activity, and **~100 script-execution results** on the simulations.

**Flow**

1. ☐ *(API precondition)* `getLabelId(request, 'macOS')` ([`helpers/api/labels.ts`](../../helpers/api/labels.ts); `GET /labels`) → the built-in **macOS** label id. ✅ *(API)* it exists (the helper throws `no label named "macOS"` otherwise).
2. ☐ *(API precondition)* the matching set, from two lists because neither holds all the facts:
   - `listLabelHostIds(request, labelId, { fleetId: 0, status: 'online' })` (`GET /labels/:id/hosts?fleet_id=0&status=online&per_page=1000`) → **which** hosts the filter matches (but that endpoint returns **`orbit_version: null`** for every host);
   - `listFleetHosts(request, 0, { status: 'online' })` ([`helpers/api/hosts.ts`](../../helpers/api/hosts.ts); `GET /hosts?fleet_id=0&status=online&per_page=1000`) → each host's `platform`, real `orbit_version` and `scripts_enabled`, filtered to the label's ids.
   - ✅ *(API)* the two lists agree on the count; ✅ *(API)* more than 50 match.
3. ☐ *(API setup)* upload the script to Unassigned.
4. ☐ Dashboard → navbar **Hosts** → fleet dropdown **Unassigned** → label filter **macOS** (the Platforms group's entry) → status filter **Online**.
5. ☐ Tick the header checkbox (select all on page) → ✅ *(UI)* the selection bar appears → click **Select all matching hosts** → click **Run script**.
   - ✅ *(UI)* the modal reads **"Run a script on `<N>` hosts"**, `N` = the API's matching count, `toLocaleString()`-formatted.
6. ☐ Hover the script → its **Run script** → ✅ *(UI)* "will run on compatible hosts (macOS and Linux)." → **Run now** checked → **Run** → ✅ *(UI)* toast `/^Successfully ran script\./`.
7. ☐ *(wait)* ✅ *(API)* newest batch for the script on fleet 0 found; polls to **`finished`** (480s; the cron again) — `findBatchId` / `waitForBatchFinished` in [`helpers/api/scripts.ts`](../../helpers/api/scripts.ts).
   - ✅ *(API)* `targeted` = the matching count — the batch hit exactly what the filter selected.
   - ✅ *(API)* `ran + errored + pending + incompatible + canceled` = `targeted` — every host lands in exactly one status.
   - ✅ *(API)* `incompatible` = the matching hosts that can't run a `.sh` — `incompatibleWithShell(h)`: **no `orbit_version`**, **`scripts_enabled === false`**, or a **non-Unix platform** (`windows`, `chrome`, `ios`, `ipados`, `android`). This mirrors the checks Fleet makes before queueing each host of a batch: `BatchExecuteIncompatibleFleetd` (no orbit, or scripts disabled) and `BatchExecuteIncompatiblePlatform` (`ValidateScriptPlatform`: a `.sh` runs only on darwin and Linux) — `server/datastore/mysql/scripts.go`.
   - ✅ *(API)* `ran > 0` and `errored > 0` — osquery-perf answers a script with a **random exit code**, so which host lands where is noise; that both buckets are non-empty is what holds.
8. ☐ Open `/controls/scripts/progress/<batchId>` **by URL**.
   - ✅ *(UI)* `h2` = the script name; summary contains **`<targeted> hosts targeted`**.
   - ✅ *(UI)* tab names read **`Ran <ran>`**, **`Errored <errored>`**, **`Incompatible <incompatible>`** — the API's numbers.

**Assessment**
- *Value:* genuinely different from CTL-24: it exercises **Select all matching hosts** (a filter-based, not id-based, batch target) at a scale no hand-picked selection reaches, and the invariants chosen — targeted = matched, partition sums, incompatible = can't run a `.sh` — are the right ones for a noisy population. The two-list precondition dance around `orbit_version` is a real API quirk handled correctly.
- *Coverage gaps:* the UI half only **mirrors** the API summary — the details page renders the same counts from the same endpoint, so steps 8's tab counts can't disagree with step 7 unless rendering breaks; no tab is opened and no host row read; no pagination through a large tab; the modal's filter-summary copy (it should name the filters, not just the count) unasserted; the "Select all matching" batch's server-side filter (label + status + fleet) is only checked through the count.
- *Redundancy:* modal + run steps repeat CTL-24's.
- *Efficiency / smells:*
  - ~~⚠️ **`incompatible == withoutOrbit` assumes no Windows simulation sits in the macOS label.**~~ **Fixed 2026-09-28:** `incompatible` is derived per host by `incompatibleWithShell` — no orbit, scripts disabled in fleetd, or a platform a `.sh` can't run on — the same three reasons Fleet's batch records (`BatchExecuteIncompatibleFleetd` / `BatchExecuteIncompatiblePlatform`). One difference remains: the spec lists the non-Unix platforms it knows, where Fleet's `IsUnixLike` allows darwin and its Linux list, so a host on some other platform would be counted differently — none is in the pool today. Original finding: a Windows sim with orbit would be incompatible with a `.sh` yet counted as orbit-capable, and the test would fail on correct product behaviour, given the label's known mix.
  - `ran > 0 && errored > 0` is probabilistic; at ~100 hosts it is effectively certain, below ~10 it would flake.
  - Step 8 navigates by URL where CTL-24 clicks through — inconsistent within one file.
  - Each run adds ~100 execution rows to premium's 2 GB MySQL that nothing ever deletes.
  - ~~**Uses raw `apiUrl`/`authHeaders` calls in the spec body for labels/hosts rather than helpers.**~~ **Fixed 2026-09-28:** the lookups are `getLabelId` / `listLabelHostIds` (`helpers/api/labels.ts`) and `listFleetHosts` (`helpers/api/hosts.ts`), and the batch reads `getBatchSummary` / `findBatchId` / `waitForBatchFinished` moved from the spec to `helpers/api/scripts.ts`.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-26 · Shared • Controls • turning script execution off disables running scripts everywhere Fleet offers it  *(exclusive project)*

- **File:** [`playwright/tests/e2e/shared/exclusive/script-execution-disabled.spec.ts`](../../tests/e2e/shared/exclusive/script-execution-disabled.spec.ts)
- **Grep:** `npm run test:premium:exclusive -- -g "turning script execution off disables running scripts everywhere Fleet offers it"` (free: `npm run test:free:exclusive -- -g "…"`). Filter by **title or file name, never by `tests/e2e/…` path** — the exclusive projects' `testDir` is `tests/e2e`, so a path filter never matches. The `:exclusive` scripts are the `--no-deps` form; with deps the whole main project runs first.
- **Project:** **`premium-exclusive` + `free-exclusive`** (shared) — **not** `premium`/`free`, which `testIgnore` every `**/exclusive/**` path · **Scopes:** n/a (global setting); the Scripts library is opened on the host's own fleet — VMs on premium, Unassigned on free
- **Mode:** UI+API · **Isolation:** **single worker, after the main project has finished** (`workers: 1`, `fullyParallel: false`, `dependencies: ['premium' | 'free']` in [`playwright.config.ts`](../../playwright.config.ts)). Why: `server_settings.scripts_disabled` is **global** — while it is on, Fleet rejects every new script run and stops handing queued ones to hosts, so running beside HOST-19…22 or CTL-24/25 would fail them. A dependency that fails skips this project, so on a red night it is reported as not run.
- **Preconditions:** the real macOS VM (`requireRealHost(request, 'darwin')`, which also returns the fleet it is on) — used for its Actions menu and as the ad-hoc run target. ✅ *(API)* script execution **arrives on** (`isScriptExecutionEnabled`) — `cleanup-setup` turns it back on at the start of every run (`enableScriptExecution`), so arriving off means an earlier step of *this* run left it off.
- **Data created:** none persistent. The setting is flipped off and back on in the UI, and `enableScriptExecution` (`PATCH /config { server_settings: { scripts_disabled: false } }`) runs again in `finally`. A run killed while it is off is healed by the next run's `cleanup-setup`.

**Flow**

1. ☐ Open **Settings → Organization settings → Advanced options** (`/settings/organization/advanced`, anchored on the **Host lifecycle** heading).
   - ✅ *(UI)* the **Script execution** checkbox (Features section; accessible name is Fleet's `name` prop, `disableScripts`, not the label) is **checked**.
2. ☐ Untick **Script execution**, click **Save**.
   - ✅ *(UI)* toast **"Successfully updated settings."**
   - ✅ *(API)* `GET /config` → `server_settings.scripts_disabled` is now `true`.
3. ☐ Open the VM at `/hosts/:id` → click **Actions**.
   - ✅ *(UI)* **Run script** is still listed but `aria-disabled="true"` — Fleet keeps the option so it can say why.
4. ☐ Hover **Run script**.
   - ✅ *(UI)* tooltip reads exactly **"Running scripts is disabled in organization settings."**
5. ☐ Open **Controls → Scripts → Library** for the host's fleet (`/controls/scripts/library?fleet_id=<VMs>` on premium, no param on free).
   - ✅ *(UI)* banner **"Running scripts is disabled in organization settings. You can still manage your library…"** is visible.
   - ✅ *(UI)* **Add script** is still **enabled** — the library stays usable.
6. ☐ *(API — enforcement)* `POST /scripts/run { host_id, script_contents: 'echo unreachable' }` (`postAdHocScript`).
   - ✅ *(API)* status **403**; body contains the same disabled copy — Fleet refuses, not just the UI.
7. ☐ Back to **Advanced options** → ✅ *(UI)* checkbox **unchecked** (persisted) → tick it → **Save** → ✅ *(UI)* toast "Successfully updated settings." → ✅ *(API)* `scripts_disabled` is `false`.
8. ☐ Open the VM's **Actions** menu again.
   - ✅ *(UI)* **Run script** is **not** `aria-disabled="true"`.
9. ☐ *(API teardown)* `enableScriptExecution` regardless of outcome.

**Assessment**
- *Value:* good — one flow checks every surface the switch touches (host Actions menu + its reason, library banner, server enforcement) and both directions of the toggle, with persistence read back after reload. The 403 check is exactly the right API assertion: the UI can only *show* a disabled state, not prove the server enforces it.
- *Coverage gaps:* the other run paths are not checked while disabled — the hosts-list **selection bar → Run script** (batch, CTL-24's entry point), policy **script automations**, and setup-experience scripts; the "stops handing *queued* scripts to hosts" half of the behaviour (the reason the spec is exclusive) is never observed — queue a run, disable, assert it stays pending, re-enable, assert it runs; the re-enabled state is proven only by the *absence* of `aria-disabled`, never by running a script; no activity-feed assertion for the settings change; no non-admin role.
- *Redundancy:* none — the only spec that touches `scripts_disabled`.
- *Efficiency / smells:*
  - Navigates every surface by direct URL (`goto()`), not dashboard → navbar click-through as `playwright/CLAUDE.md` asks of e2e specs.
  - The real VM is not actually needed for steps 3–4 (any fleetd host shows the Actions → Run script option) or step 6 (the 403 is decided before any host is contacted); it costs nothing here since no script reaches the device, but it couples the test to VM uptime.
  - Being in an exclusive project means it runs **last and only if the main project passed its dependency gate** — on a red night this coverage silently disappears from the report as "not run".

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

---

### CTL-27 · MDM • OS settings — a profile for all hosts, delivered and removed (VMs fleet) › the macOS VM installs and verifies it, and loses it when it is deleted

- **File:** [`playwright/tests/e2e/premium/controls/os-settings/configuration-profiles.spec.ts`](../../tests/e2e/premium/controls/os-settings/configuration-profiles.spec.ts)
- **Grep:** `npx playwright test --project=premium configuration-profiles -g "delivered and removed"`
- **Project:** premium · **Scope:** the **VMs** fleet · **Host:** the real macOS VM (`requireRealHost`)
- **Mode:** UI+API · **Isolation:** standalone describe; timeout 600 s; `finally` deletes the profile
- **Data created:** generated inert profile `pw-cp-<nonce>` (one key in its own preference domain), uploaded with the default target — **All hosts** — so it also reaches any MDM simulation another spec has borrowed onto the fleet; deleted in-test, and by the VMs sweep if the test dies

**Flow**

1. ☐ Dashboard → **Controls** → **OS settings** → **Configuration profiles** → fleet **VMs** → **Add profile** → choose the file → **Add profile** (no target chosen).
   - ✅ *(UI)* *"Successfully uploaded."*; the row reads **macOS, iOS, iPadOS** and has no label count.
2. ☐ (No user action) Wait for the VM: *verifying*, then a refetch (after any outstanding one), then **verified**.
   - ✅ *(API)* A filtered `managed_policies` read of the profile's domain shows its marker.
   - ✅ *(UI)* The VM's **Controls** tab row reads **Verified**.
3. ☐ Back to the profiles → hover the row → **Delete** → confirm.
   - ✅ *(API)* The VM stops listing it; the domain reads empty on the device (≤ 2 min).

**Assessment**
- *Value:* High. QA Wolf's "upload and remove configuration profile": the one path — no target — the label-targeting specs don't take, proven on the device both ways.
- *Coverage gaps:* the transient Pending/Verifying status on the host isn't asserted in the UI (the VM moves through it in seconds).
- *Redundancy:* the removal half overlaps LT-01's last step; kept because it's the untargeted profile.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-28 · Premium • Controls • OS updates — macOS › a custom minimum version and deadline save, persist, and clear again  *(premium-exclusive)*

- **File:** [`playwright/tests/e2e/premium/exclusive/os-updates/macos-updates.spec.ts`](../../tests/e2e/premium/exclusive/os-updates/macos-updates.spec.ts)
- **Grep:** `npx playwright test --project=premium-exclusive macos-updates --no-deps`
- **Project:** premium-exclusive (one worker, after the main project — it shares Workstations' OS update settings with CTL-31/32) · **Scope:** **Workstations**, which holds no hosts
- **Mode:** UI+API · **Isolation:** `finally` clears Workstations' OS updates; so does the Workstations wipe in `setup/cleanup.steps.ts`
- **Preconditions:** Workstations enforces nothing (asserted); Apple's software lookup feed is reachable (`appleListedMacosVersions` — the version is the oldest it lists, which Fleet accepts)

**Flow**

1. ☐ Dashboard → **Controls** → **OS updates** → **Workstations** → **macOS** tab.
   - ✅ *(UI)* Target reads **No updates enforced**; no Minimum version field.
2. ☐ Target → **Custom version** → Minimum version (an Apple-listed version) → Deadline (60 days out, `YYYY-MM-DD`) → **Save**.
   - ✅ *(UI)* *"Successfully updated."*; the tab reads **macOS** with a check.
   - ✅ *(API)* `mdm.macos_updates` holds that version and deadline.
3. ☐ Reload.
   - ✅ *(UI)* **Custom version**, and both values, read back.
   - ✅ *(UI)* End user experience: the heading, a **Learn more** link to `https://fleetdm.com/learn-more-about/os-updates` opening in a new tab, and the preview image.
4. ☐ Target → **No updates enforced** → **Save**.
   - ✅ *(UI)* *"Successfully updated."*; the check leaves the tab. *(API)* nothing enforced.

**Assessment**
- *Value:* Medium-high. QA Wolf's flow never chose "Custom version" (it passed on its own leftover); this sets and clears it, and replaces their preview screenshot with the link and image.
- *Coverage gaps:* "Latest version" / Days after release, and iOS / iPadOS.
- *Efficiency / smells:* seconds. Reads an external feed (Apple's) for a version Fleet will accept.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-29 · Premium • Controls • OS updates — macOS › a missing or malformed minimum version or deadline is refused, and nothing saves  *(premium-exclusive)*

- **File / project / scope:** as CTL-28

**Flow**

1. ☐ Workstations → **macOS** → **Custom version** → **Save** with both fields empty.
   - ✅ *(UI)* In place of the labels: *"The minimum version is required."* and *"The deadline is required."*
2. ☐ Minimum version `not-a-version`, Deadline `2026/01/01` → **Save**.
   - ✅ *(UI)* *"Minimum version must meet criteria below."* and *"Deadline must meet criteria below."*
   - ✅ *(API)* Nothing was saved.

**Assessment**
- *Value:* Medium — the form's own validation, asserted where Fleet shows it (the label).
- *Coverage gaps:* server-side refusals ("isn't supported by Apple", an invalid date).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-30 · Premium • Controls • OS updates — macOS › "View all hosts" on a current version lists exactly the hosts running it  *(premium-exclusive)*

- **File / project:** as CTL-28 (read-only; it lives in the file, so in the exclusive project) · **Scope:** Unassigned, where the simulations report OS versions

**Flow**

1. ☐ **Controls** → **OS updates** → **Unassigned** → **Current versions** → hover the first **macOS** row → **View all hosts**.
   - ✅ *(UI)* The hosts list opens with `os_name` and `os_version` in the URL, and lists hosts.
   - ✅ *(API)* Every host that filter returns reports exactly that OS (`os_version` = `<name> <version>`), and there's at least one.

**Assessment**
- *Value:* Medium. QA Wolf compared the table's count with the list's — a count on a shared list that drifts hourly; this checks the filter's membership instead.
- *Redundancy:* the Software → OS versions drill-down in `premium/software/os.spec.ts` is the same idea on another page.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-31 · Premium • Controls • OS updates — custom update profiles vs OS update settings › macOS: a software-update declaration and a minimum version refuse each other  *(premium-exclusive)*

- **File:** [`playwright/tests/e2e/premium/exclusive/os-updates/ddm-conflict.spec.ts`](../../tests/e2e/premium/exclusive/os-updates/ddm-conflict.spec.ts)
- **Grep:** `npx playwright test --project=premium-exclusive ddm-conflict --no-deps`
- **Project:** premium-exclusive · **Scope:** **Workstations** — `beforeEach` asserts it holds no real host, because the payload here is a real OS update enforcement
- **Mode:** UI+API · **Isolation:** `finally` deletes the declaration and clears the OS updates
- **Data created:** a generated `softwareupdate.enforcement.specific` declaration `pw-ddm-<nonce>` (`updateEnforcementDeclaration`, which demands `noRealHostsOnFleet: true`)

**Flow**

1. ☐ (No user action) Set a macOS minimum version and deadline on Workstations (API).
2. ☐ **Configuration profiles** → **Workstations** → **Add profile** → the declaration `.json` → **Add profile**.
   - ✅ *(UI)* *"Couldn't add profile. OS updates are already configured. Remove the OS updates settings first."*
   - ✅ *(API)* It wasn't added.
3. ☐ (No user action) Clear the OS updates; add the declaration (API).
4. ☐ **OS updates** → **macOS** → **Custom version** + values → **Save**.
   - ✅ *(UI)* *"Couldn't update OS updates settings. A custom OS updates declaration profile already exists. Remove the custom profile first."*
   - ✅ *(API)* No minimum version was saved.

**Assessment**
- *Value:* High. QA Wolf tested one direction on their VMs fleet, with a deadline already in the past — on a fleet with real hosts that's an immediate forced update. Both directions here, on a fleet with none.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-32 · Premium • Controls • OS updates — custom update profiles vs OS update settings › Windows: an Update CSP profile and a Windows update deadline refuse each other  *(premium-exclusive)*

- **File / project / scope:** as CTL-31 · **Data created:** a generated Windows profile under `./Device/Vendor/MSFT/Policy/Config/Update` (`windowsUpdateProfile`)

**Flow**

1. ☐ (No user action) Set a Windows deadline and grace period (3 / 3) on Workstations (API).
2. ☐ **Configuration profiles** → **Workstations** → **Add profile** → the `.xml` → **Add profile**.
   - ✅ *(UI)* *"Couldn't add profile. OS updates are already configured. Remove the OS updates settings first."* — and it wasn't added *(API)*.
3. ☐ (No user action) Clear; add the profile (API).
4. ☐ **OS updates** → **Windows** → Days after release **3**, Grace period **3** → **Save**.
   - ✅ *(UI)* *"Couldn't update OS updates settings. A custom OS updates profile already exists. Remove the custom profile first."* — and nothing was saved *(API)*.

**Assessment**
- *Value:* High, as CTL-31, for Windows.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-33 · Free • Controls • Configuration profiles — delivery to the real Mac › a profile is installed, resent and removed, and the host names it in each command  *(free)*

- **File:** [`playwright/tests/e2e/free/controls/os-settings/profile-delivery.spec.ts`](../../tests/e2e/free/controls/os-settings/profile-delivery.spec.ts)
- **Grep:** `npx playwright test --project=free profile-delivery`
- **Project:** free · **Host:** the free macOS VM — on free every upload reaches it (Unassigned holds the VMs) and every MDM simulation
- **Data created:** generated inert profile `pw-fd-<nonce>`, deleted in-test (the Unassigned wipe catches a leftover)

**Flow**

1. ☐ **Controls** → **OS settings** → **Configuration profiles** → **Add profile** → the file → **Add profile**.
2. ☐ (No user action) *verifying* → refetch → **verified**.
   - ✅ *(API)* The profile's domain on the device holds its marker.
3. ☐ The VM's host page → Activity → **Past** → **Show MDM commands**.
   - ✅ *(UI)* *"The InstallProfile command for pw-fd-<nonce> was acknowledged."*; *(API)* one InstallProfile, Acknowledged.
4. ☐ **Controls** tab → the row reads **Verified** → hover → **Resend**.
   - ✅ *(API)* Two InstallProfile commands, both Acknowledged.
5. ☐ Profiles → hover → **Delete** → confirm.
   - ✅ *(API)* The domain leaves the device; *(UI)* *"The RemoveProfile command for pw-fd-<nonce> was acknowledged."*

**Assessment**
- *Value:* High — the free half of LT-05 and CTL-27: free has no targets, but delivery, Resend and removal are free features.
- *Coverage gaps:* no Windows case on free — the lifecycle spec (CTL-15) puts the one approved inert Windows profile on Unassigned, and two would undo each other.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-34 · Free • Controls • Configuration profiles — delivery to the real Mac › a declaration is verified by the Mac and removed again  *(free)*

- **File / project / host:** as CTL-33 · **Data created:** a generated `management.test` declaration `pw-fd-<nonce>-d`

**Flow**

1. ☐ Configuration profiles → **Add profile** → the `.json` → **Add profile**.
   - ✅ *(UI)* The row reads **macOS, iOS, iPadOS (declaration)**.
2. ☐ (No user action) The VM reports it — **verified**; *(UI)* its Controls row reads **Verified**.
3. ☐ Delete it → *(API)* the VM stops listing it.

**Assessment**
- *Value:* Medium-high — the free half of LT-04's "no target" case.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-35 · Shared • Controls • custom variables › a script that uses a variable is refused until the variable exists

- **File:** [`playwright/tests/e2e/shared/controls/custom-variables.spec.ts`](../../tests/e2e/shared/controls/custom-variables.spec.ts) (L91)
- **Grep:** `npx playwright test --project=premium -g "a script that uses a variable is refused until the variable exists"` (or `--project=free`)
- **Project:** premium, free (shared) · **Scope:** the variable is global; the script goes to **Unassigned** (`FLEET_ID = 0`), which on free is where the real VMs are — uploading a script doesn't run it
- **Mode:** UI · **Isolation:** self-contained, per-run names; the `afterEach` deletes the test's script (exact name, `deleteAllScripts` with a filter) and **then** the variable — Fleet refuses to delete a variable a script still uses, and `deleteVariablesMatching` ignores the refusal
- **Source:** QA Wolf round 1 C8 #20 (`secrets-scripts-with-a-secret-variable-can-only-be-uploaded-when-such-variable-exists`)
- **Preconditions:** none. The refusal is a 422, which `pageHealth` doesn't flag.
- **Data created:** the script `pw-secret-<nonce>.sh`, built in memory (`#!/bin/sh` / `echo "token: $FLEET_SECRET_PW_VAR_<NONCE>"`), on Unassigned, and the variable `PW_VAR_<NONCE>` (value `pw-secret-value`) — both removed by the `afterEach`. The Unassigned wipe catches a leftover script; nothing catches a leftover variable.

**Flow**

1. ☐ Open **Controls → Scripts → Library** on Unassigned (`/controls/scripts/library?fleet_id=0`, via URL).
   - ✅ *(UI)* The **Library** heading is visible.
2. ☐ Click **Add script**, choose `pw-secret-<nonce>.sh`, click **Add script** in the modal — `submitScriptUpload()`, which asserts nothing about the outcome.
   - ✅ *(UI)* Error toast containing `Couldn't add. Variable "$FLEET_SECRET_PW_VAR_<NONCE>" doesn't exist.` — Fleet's server-side check that every `$FLEET_SECRET_*` a script references exists.
   - ✅ *(UI)* The upload modal stays open, with the file still chosen.
3. ☐ *(API)* Create the variable `PW_VAR_<NONCE>` — `createVariable()`.
4. ☐ Click **Add script** in the still-open modal again — the same file, unchanged.
   - ✅ *(UI)* Success toast *"Successfully uploaded."*
   - ✅ *(UI)* The modal closes.
   - ✅ *(UI)* The library lists `pw-secret-<nonce>.sh` (`itemByName` — an exact match on the row's title button).

**Assessment**
- *Value:* High. The first test in the suite that uses a variable rather than just listing one: Fleet's server-side validation of a script's `$FLEET_SECRET_*` reference, the message the user gets, and — by resending the same upload once the variable exists — proof that the refusal was about the missing variable and nothing else in the file. On both tiers.
- *Coverage gaps:* scripts only — the same validation covers configuration profiles and installer and setup-experience scripts, none of which is tested; the secret is never substituted, since no script runs on a host, so nothing proves a host receives the value rather than the placeholder; editing an existing script to add an unknown reference (the edit path) is untested; the script's stored content isn't read back.
- *Redundancy:* the upload-modal mechanics overlap CTL-07/CTL-19's upload step; incidental.
- *Efficiency / smells:*
  - Direct-URL entry, as in CTL-13/14.
  - Creating the variable through the API is right — adding one through the UI is CTL-13's job — and the script never touches disk (`FileUploader.setFile` with a buffer), unlike CTL-12's oversize fixture.
  - Step 4 relies on Fleet keeping the chosen file after a refusal (documented on `submitScriptUpload`). If Fleet ever clears it, the test fails on a disabled or no-op **Add script** click rather than on a message that says why.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### CTL-36 · Shared • Controls • custom variables › a variable a script uses can't be deleted

- **File:** [`playwright/tests/e2e/shared/controls/custom-variables.spec.ts`](../../tests/e2e/shared/controls/custom-variables.spec.ts) (L120)
- **Grep:** `npx playwright test --project=premium -g "a variable a script uses can't be deleted"` (or `--project=free`)
- **Project:** premium, free (shared) · **Scope:** the variable is global; the script is on **Unassigned**
- **Mode:** UI+API · **Isolation:** as CTL-35 — the `afterEach` deletes the script, then the variable
- **Source:** QA Wolf round 1 C8 #22 (`secrets-variable-that-is-referenced-by-a-script-can-not-be-deleted`)
- **Preconditions (API):** the variable `PW_VAR_<NONCE>` (`createVariable`) and the script `pw-secret-<nonce>.sh` on Unassigned, which references `$FLEET_SECRET_PW_VAR_<NONCE>` (`uploadScript`)
- **Data created:** those two, removed by the `afterEach`
- **Worked around:** the scope part of the refusal is left open for [fleetdm/fleet#54621](https://github.com/fleetdm/fleet/issues/54621) — on Unassigned Fleet calls the scope `the "No team" team` (and a fleet a "team"). A `TODO(fleetdm/fleet#54621)` in the spec and a row in [`docs/blocked-by-product-bugs.md`](../blocked-by-product-bugs.md) → *Worked around in the suite*.

**Flow**

1. ☐ Open **Controls → Variables → Global variables** (`/controls/variables/global-variables`, via URL).
   - ✅ *(UI)* The **Global variables** heading is visible.
2. ☐ Click **Delete `PW_VAR_<NONCE>`** on the row → the **Delete custom variable** modal → **Delete**.
   - ✅ *(UI)* The delete modal closes.
   - ✅ *(UI)* Error toast matching `Couldn't delete. PW_VAR_<NONCE> is used by the "pw-secret-<nonce>.sh" script in the <…>. Please edit or delete the script and try again.` — a regex built from the two names, with the scope wildcarded (#54621).
   - ✅ *(UI)* The variable's row is still listed.
   - ✅ *(API)* `GET /custom_variables` still returns it.

**Assessment**
- *Value:* High — Fleet's referential guard (a 409) and the message that tells the user which script to fix. With CTL-35 it covers both directions of the script ↔ variable dependency, on both tiers.
- *Coverage gaps:* the scope wording is unasserted until #54621 is fixed; a library script only — Fleet's delete scan also covers configuration profiles and host-name templates, neither tested; a script on a fleet (Workstations), where the message names a fleet, isn't covered; deleting the script and then the variable successfully isn't asserted — the `afterEach` does it and ignores the response.
- *Redundancy:* none.
- *Efficiency / smells:*
  - Both preconditions are seeded through the API, so the browser is spent only on the delete — the right split.
  - Direct-URL entry, as in CTL-13/14.
  - The regex is built from the names unescaped except for the script name's dots; safe because a variable name is `[A-Z0-9_]` and the nonce is alphanumeric.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

## Area observations

**Coverage map**

| Feature / user flow | Covered by | Gap |
|---|---|---|
| Custom configuration profile — upload / list / download / delete (.mobileconfig, .xml) | CTL-01…04, CTL-15…18 | No `.json` (Apple DDM / Android) profile; no label-scoped (include/exclude) profiles; platform tag & metadata columns unasserted; duplicate PayloadIdentifier conflict |
| Profile upload rejection (signed) | CTL-05 | Malformed XML, wrong extension, oversize, invalid SyncML — all untested; no free mirror |
| Profile **delivery status to hosts** (Verified / Verifying / Pending / Failed), host-details OS-settings section, resend/retry | — | **Entirely untested.** `OsSettingsPage.statusLinks` is only used by `tests/loadtest/controls.spec.ts`. Simulated hosts aren't MDM-enrolled, so this needs `liveMacosHost` |
| Disk encryption — global toggle + persistence | CTL-06 | Team-scoped toggle, status aggregate table, key escrow / **View key**, activity feed, host-level enforcement |
| Scripts library — upload / list / preview / download / edit / delete | CTL-07…11, CTL-19…23 | Platform tag unasserted; no duplicate-name, empty-file, or unusual-extension cases |
| Script upload rejection (>500,000 chars) | CTL-12 | Exact-limit boundary (should pass) untested; no free mirror |
| **Running a script on a host** + output / exit code | [HOST-19…22](02-hosts-shared-and-free.md) (area 02 — effect read back by a report, non-zero exit, timeout, four interpreters) | re-run untested; Pending/Upcoming never observed; the `*-create-marker` / `*-delete-marker` fixtures are still unreferenced (the specs build content at run time) |
| Batch script execution (Started / Scheduled / Finished tabs, details page) | CTL-24 (3 real VMs → Ran / Errored / Incompatible), CTL-25 (~100 simulations via Select all matching) | **Schedule for later** + Scheduled tab, **cancel**, host-side view of a batch run, and every tab's row list at scale |
| Organization-wide **Script execution** switch | CTL-26 (exclusive project) | queued scripts held while disabled (the reason it's exclusive) never observed; batch / policy-automation / setup-experience run paths not checked while disabled |
| Custom variables — add / list / delete + name validation | CTL-13, CTL-14 (both tiers) | No value edit, no masking check, no duplicate-name rejection, no built-in `$FLEET_VAR_*` list, no per-fleet variables |
| Custom variables in scripts — an unknown `$FLEET_SECRET_*` refused on upload, a referenced variable refused deletion | CTL-35, CTL-36 (both tiers; library scripts on Unassigned) | **Profiles** referencing a variable (both checks cover them); installer and setup-experience scripts; a script on a fleet, whose message names it; the scope wording in the delete refusal ([fleetdm/fleet#54621](https://github.com/fleetdm/fleet/issues/54621)); the substituted value reaching a host |
| OS updates (minimum version enforcement) | — | No functional e2e at all — `OsUpdatesPage` is used only by the loadtest spec and the free paywall list |
| Certificates / Passwords (OS settings sub-pages) | — | No functional e2e — `CertificatesPage` only in the loadtest spec |

**Duplication**

1. **Free ↔ premium mirrors (largest cluster).** CTL-15…17 ≙ CTL-01…03 and CTL-19…22 ≙ CTL-07…10, line-for-line, for handlers that are not tier-gated. The only mirror that buys real coverage is the activity copy: CTL-18 asserts the free-only `all <hostsPhrase>` profile suffix, whereas CTL-23 asserts *exactly the same* regexes as premium-Unassigned CTL-11 (`scriptScope` is not tier-aware). Per the suite's tier-separation convention this duplication is deliberate — but CTL-16/CTL-20 (download round-trips) carry no tier-specific signal at all.
2. **Two routes to one property.** "Stored content equals source" is asserted twice per script lifecycle: through the Ace editor preview (CTL-07/CTL-19 step 4) and through the download (CTL-08/CTL-20).
3. **Activity asserted twice per lifecycle.** Every CRUD sub-test calls `assertActivity` (API) and the final sub-test re-asserts the same events through the dashboard feed (CTL-04/11/18/23). Defensible (per-step attribution vs. rendered copy), but it's ~2× the activity work.
4. **Doubled row-hidden asserts.** `deleteProfile`/`deleteScript` already assert the row is hidden; every delete spec asserts it again.
5. **OS dimension on the activity-feed sub-tests.** CTL-11 runs 6× and CTL-23 3× to assert one copy contract per scope; the OS only varies the filename.

**UI-vs-API balance**

Balance is healthy — no test in this area validates purely through the API. The API is used in three legitimate roles: (a) activity-feed contract checks via `assertActivity`, which the dashboard tests then re-verify in rendered form; (b) config snapshot/restore in CTL-06 (`getAppConfig`/`setGlobalDiskEncryption` in `beforeEach`/`afterEach`) — exactly the right use, keeping the instance clean even on failure; (c) seeding and cleanup in the custom-variables tests — CTL-35/36 create their variable and script through the API (`createVariable`, `uploadScript`) so the browser is spent on the refusal under test, and the `afterEach` deletes the test's script before its variable (`deleteVariablesMatching` ignores Fleet's 409 for a variable still in use). The one substantive problem is precision, not placement: every `assertActivity` predicate in the profile and script specs matches on **name only** with no fleet/team discriminator, so the concurrently-running Unassigned and Workstations describes (separate describes → separate workers) can satisfy each other's assertion. Also note nothing verifies server state directly after a UI mutation (no `GET /configuration_profiles` or `GET /scripts` confirmation) — the UI list is the only source of truth, which is the correct default here.

**Quick wins**

1. Add a team discriminator to every `assertActivity` predicate in the two lifecycle specs (`d.team_id`/`team_name` alongside `profile_name`/`script_name`) — [`premium/.../configuration-profiles.spec.ts:72,90`](../../tests/e2e/premium/controls/os-settings/configuration-profiles.spec.ts), [`premium/controls/scripts/library.spec.ts:70,95,108`](../../tests/e2e/premium/controls/scripts/library.spec.ts).
2. Add the missing success-toast assertion to `ScriptsLibraryPage.deleteScript` so it matches `ConfigurationProfilesPage.deleteProfile` — [`ScriptsLibraryPage.ts:184`](../../pages/controls/ScriptsLibraryPage.ts).
3. ~~Make the edit assertion equality rather than `toContain`, and stop retyping the whole file~~ (done 2026-10-03: the edit is written through `setAceValue`, and the read-back compares the whole script).
4. Build the oversize script in memory via `FileUploader.setFile({name,mimeType,buffer})` instead of writing ~500 KB to `os.tmpdir()` and leaving it — [`library.spec.ts:135`](../../tests/e2e/premium/controls/scripts/library.spec.ts).
5. Give disk encryption a page object and click-through entry (`OsSettingsPage.diskEncryptionLink` already exists and is unused), and use the shared `Toast` component instead of a raw `getByRole('alert')` — [`disk-encryption.spec.ts`](../../tests/e2e/premium/controls/os-settings/disk-encryption.spec.ts).

**Bigger bets**

1. ~~**Make one script actually run.**~~ **Done** — HOST-19 (area 02) runs a script on the real macOS VM and reads its effect back through a scheduled report's `hash` row, rather than the marker fixtures; CTL-24/25 cover the **Batch progress** tabs and retire the orphaned `ScriptsBatchProgressPage`. What remains is the batch *schedule* and *cancel* paths.
2. ~~**Assert profile delivery, not just library presence**~~ **Done** (batch E, 2026-09-29) — CTL-27 and CTL-33/34 here, and area 22 for label-targeted delivery; all on generated inert profiles, read back on the device. The original note: ⚠️ **with an inert fixture, never the passcode or screen-lock profile**: either one deployed to a real VM locks it permanently (`playwright/CLAUDE.md` → *Never deploy a passcode profile to a real host*). Using `liveMacosHost`, upload a harmless preference-domain profile to the VMs fleet and assert the OS-settings status counters move (Pending → Verifying → Verified) and that the host-details OS settings section lists the profile — then delete and assert removal. Today "the profile exists in a list" is the whole contract.
3. **Close the variables loop and trim the tier mirrors.** The script half is done — CTL-35 (an unknown `$FLEET_SECRET_*` refused, then accepted once the variable exists) and CTL-36 (a referenced variable refused deletion), on both tiers. Still open: the same two checks for a **profile** that references a variable. (`cleanup.steps.ts` sweeps `PW_VAR_*` variables after the Unassigned scripts.) In the same pass, drop the two free download mirrors (CTL-16, CTL-20) and collapse the per-OS activity-feed sub-tests to one per scope — roughly 12 of the 74 executions for no loss of signal.
