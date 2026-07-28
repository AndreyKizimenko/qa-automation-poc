# C9 — MDM + android + profiles + bitlocker + macOS-accounts + labels-page + python + failing-policies — audit

Scope: Apple/Android MDM UI validation, Android web-apps/software-config/certs, config-profile upload
error messages, BitLocker PIN toggle, macOS local-account editing, dedicated Labels page CRUD/sort/role,
python script on Linux host (+ policy automation), install-software on failing policy.

Existing suite anchors read: `tests/e2e/{premium,free}/controls/os-settings/configuration-profiles.spec.ts`,
`tests/e2e/premium/controls/setup-experience/{setup-assistant,users,run-script,install-software}.spec.ts`,
`tests/e2e/premium/policies/policies.spec.ts`, `tests/e2e/premium/software/library.spec.ts`;
POMs `ConfigurationProfilesPage`, `CertificatesPage`, `OsSettingsPage`, `SetupExperiencePage`,
`SetupExperienceUsersPage`, `SetupAssistantPage`, `SoftwareAppStoreAndroidPage`, `LabelsPage` (25-line stub),
`IntegrationsPage`, `HostDetailsPage`, `PoliciesListPage`, `LabelFilter`; helpers `api/mdm.ts`,
`catalogs/android.ts`, `api/static-users.ts`.

Confirmed GAPs (no existing e2e coverage): dedicated Labels page CRUD, label role-permissions,
disk-encryption/BitLocker, MDM settings/integrations UI validation, end-user migration, Apple-cert renewal,
certificates CRUD, android managed-configuration edit, run-script-on-host, policy automation
(install-software / run-script), managed-local-account ("Lock end user info") toggle.

## Disposition table

| # | QA Wolf flow (basename) | Tier | Behavior (1 line) | Disposition | Target (existing or proposed path) | Notes |
|---|---|---|---|---|---|---|
| 1 | configuration-profiles-better-error-messages-when-uploading-signed-... | Prem | Upload a **signed** .mobileconfig → error toast "Configuration profiles can't be signed…" + "Learn more" → custom-os-settings docs | AUGMENT | `tests/e2e/premium/controls/os-settings/configuration-profiles.spec.ts` | Add a signed-profile-rejection sub-test/case. Needs a signed `.mobileconfig` fixture under `test-data/apple/macos/profiles/` + `ConfigurationProfilesPage.expectUploadError(msg)` + learn-more-link (popup) assertion. Pure UI, feasible. |
| 2 | configuration-profiles-uploading-bad-profile-shows-error-and-links-to-error-docs | Prem | **Setup-assistant** (DEP) profile upload of bad JSON → "Couldn't add. CONFIG_NAME_INVALID. Learn more" → Apple developer docs | AUGMENT | `tests/e2e/premium/controls/setup-experience/setup-assistant.spec.ts` | Misnamed — it's Controls→Setup experience→Setup assistant, NOT os-settings profiles. Add bad-DEP-profile error sub-test. Needs `setup_badprofile.json` fixture + `SetupAssistantPage` error-toast/link assertion. Feasible. |
| 3 | android-android-deploy-web-apps-web-clips | Prem | Add Android **web app / web clip** via App store (application ID) → toast, type "Application (Android)", icon → delete | AUGMENT | `tests/e2e/premium/software/library.spec.ts` | Add/delete already covered by the android case (`com.openai.chatgpt`) via `SoftwareAppStoreAndroidPage`. Only extra = a web-clip application-id case + "Application (Android)" type + icon assertion. Add a CASES row. Needs Managed Google Play configured (already proven by existing android case). |
| 4 | android-android-software-and-configurations | Prem | Add android app → **Actions → Edit configuration** (managed-config JSON) → save/persist/reload → delete | NEW | `tests/e2e/premium/software/android-configuration.spec.ts` | Add/delete portion DUPs library.spec; the **Edit configuration** JSON round-trip is genuinely uncovered. POM work: extend `SoftwareTitleDetailPage` with Actions dropdown → "Edit configuration" modal + ACE-editor set/read helper. Needs Managed Google Play. |
| 5 | android-deploy-delete-certificates-on-android-hosts-via-ui-api | Prem | Controls→OS settings→Certificates: Add-cert modal field validation (name/CA/subject required, invalid-char) → pick android CA → add → delete | NEW | `tests/e2e/premium/controls/os-settings/certificates.spec.ts` | No certificates CRUD spec exists. **POM gap:** `CertificatesPage` is goto-only — needs Add modal, field-validation, list-item, delete. **Infra:** requires a certificate-authority integration named `android_test` provisioned on the instance (SCEP/NDES/DigiCert). Does NOT need android hosts (config-only). Flag CA provisioning. |
| 6 | bitlocker-require-bitlocker-pin-...-toggled-on-and-off | Prem | Controls→OS settings→Disk encryption→Advanced options: toggle "Turn on disk encryption" + "Require BitLocker PIN", save, persist across reload, toggle off | NEW | `tests/e2e/premium/controls/os-settings/disk-encryption.spec.ts` | No disk-encryption spec. **POM gap:** new `DiskEncryptionPage` (checkboxes + Advanced options expander + save toast "Successfully updated disk encryption"). Config-only — **no Windows host required**. Flow used team "Turkeys"→map to Workstations. Feasible, low-risk. |
| 7 | failing-policies-no-team-install-software-on-failing-policy | Prem | Upload chrome .deb → create always-fail policy → set policy automation **install_software** → refetch host → policy fails → software auto-installs on host | NEW | `tests/e2e/premium/policies/policy-automation-install-software.spec.ts` | **HIGH-RISK / host-dependent:** needs a live enrolled **online Linux host** with scripts enabled; 5-min install waits; refetch loops. **POM gap:** PolicyEdit automations modal (install_software checkbox + software select) + HostDetails software-install activity assertions. Creates/deletes a policy (OK via CRUD model). Heavy + flaky. |
| 8 | mac-os-accounts-allow-end-users-to-edit-their-macos-local-account-... | Prem | Setup experience→Users: enable "Require IdP authentication" → "Lock end user info" (managed local account) becomes available → check/save → disabling IdP hides it | AUGMENT | `tests/e2e/premium/controls/setup-experience/users.spec.ts` | users.spec covers Require-IdP + Create-hidden-admin round-trips but NOT the **managed-local-account "Lock end user info"** toggle nor its IdP dependency. Add `lockEndUserInfoCheckbox` to `SetupExperienceUsersPage` + a dependency sub-test. `resetMacosSetupToggles` already clears `enable_managed_local_account`. Feasible. |
| 9 | mdm-mobile-device-management-mdm-ui-validation | Prem | Settings→Integrations→MDM: Apple MDM card fields (APNs portal/CN/Org/URL/renew date) + End-User Migration enable/disable, mode (voluntary/forced), webhook-URL validation, example-payload preview | NEW | `tests/e2e/premium/settings/integrations/mdm.spec.ts` | No MDM-integrations UI-validation spec. Mostly UI-presence + the **webhook-URL validation** ("Must be a valid URL") + migration toggle are the real value. **POM gap:** new `MdmSettingsPage` (Apple card details + EndUserMigration section). **Infra:** requires Apple MDM (APNs) turned ON (already true — setup-assistant/profile specs run). Honor flow's "DO NOT TURN OFF" note. Consider splitting migration vs card-fields. |
| 10 | mdm-renewing-apple-mdm-certificate-with-...-banned-email-domain-results-in-error | Prem | Log in as banned-email-domain admin → MDM→Apple→Renew certificate→Download CSR → "is not permitted" error, download blocked | CUT | — | Narrow negative test. Requires provisioning a **dedicated banned-email-domain admin user** (no static user; can't reuse `@fleetdm.com`) and drives live APNs-cert-renewal UI. The behavior is a server-side email-domain check — far cheaper as an **API test** than a browser cert-renewal flow. Low value / high setup cost. See open questions. |
| 11 | mdm-add-and-update-manual-labels-to-host | Prem | Hosts filter "+" → Add **manual** label, select N hosts → filter pill + host count → edit (rename/add-remove hosts) → delete | MERGE | group: **Labels CRUD** → `tests/e2e/premium/labels/labels.spec.ts` | Same manual-label CRUD as #12 but entered via the **Hosts filter dropdown** (legacy entry) instead of the dedicated page. Contributes the manual-label **host-targeting** case (select hosts, filter-pill, host-count verification). Fold into the labels CRUD spec's Manual case rather than a separate spec. |
| 12 | new-labels-page-create-edit-and-delete-labels-on-dedicated-labels-page | Prem | Dedicated Labels page (avatar→Labels): create (Dynamic\|Manual), edit, delete; Actions dropdown; immutable-query help text; toasts | NEW | `tests/e2e/premium/labels/labels.spec.ts` | Anchor NEW spec. **POM gap (major):** expand `LabelsPage` (25-line stub) → Add-label form (name/desc/type radios, query editor, host search), row Actions dropdown (Edit/Delete/View all hosts), delete modal, sort headers. Serial CRUD + activity-feed convention. Merges #11 (manual host-targeting case). |
| 13 | new-labels-page-sort-labels-and-view-all-hosts-on-dedicated-labels-page | Prem | Sort labels by Name/Description/Type asc+desc; "View all hosts" action → Hosts filtered to that label's hosts | NEW | `tests/e2e/premium/labels/labels-sort-view.spec.ts` | Shares the expanded `LabelsPage` POM from #12 (sort-header locators + `viewAllHosts()` action). Sort + view-all-hosts are distinct enough to be a sibling spec. Could also live as sub-tests in #12's file. |
| 14 | new-labels-page-team-maintainer-can-create-edit-and-delete-own-labels | Prem | Team Maintainer: CRUD own labels; on labels authored by others sees only "View all hosts" (no Edit/Delete) | MERGE | group: **Labels role-permissions** → `tests/e2e/premium/labels/labels-role-access.spec.ts` | Role-permutation. Maps to `ws-maintainer` static user (exists). The "cannot edit others' labels" assertion is the value. Merge with #15 into one role-access spec. Flow's team-host-seeding (`addHostsToTeam`) should be replaced by gitops-provisioned Workstations hosts. |
| 15 | new-labels-page-team-observer-can-only-view-labels-and-filter-labels-on-hosts | Prem | Observer: view labels only + filter labels on hosts + View-all-hosts; no create/edit/delete | MERGE | group: **Labels role-permissions** → `tests/e2e/premium/labels/labels-role-access.spec.ts` | Maps to `global-observer` (exists) or `ws-observer`. Merge with #14 (maintainer + observer variants of one role-access spec). |
| 16 | python-run-python-script-on-linux-host | Prem | Controls→Scripts: upload `print-hello.py` → Host details→Actions→Run script→Run → activity "ran the …py script" → verify | NEW | `tests/e2e/premium/hosts/run-script.spec.ts` | No run-script-**on-host** coverage (existing run-script.spec is Setup-Experience only). Value = validates **python interpreter** support on Linux. **HIGH-RISK / host-dependent:** needs live online Fedora host `qawolf-premium-fedora` w/ scripts enabled. Flow uses `toHaveScreenshot` (brittle — drop it). **POM gap:** HostDetails Actions→Run script + run-script-details modal. |
| 17 | python-run-python-script-with-policy-automation-on-linux-host | Prem | Policy automation **run_script** attached to a failing policy → refetch Linux host → policy fails → "Fleet ran the …py script on this host" | NEW | `tests/e2e/premium/policies/policy-automation-run-script.spec.ts` | **HIGH-RISK / host-dependent:** relies on a pre-provisioned policy + pre-uploaded script + live Fedora host. Same policy-automation pattern as #7 (install_software vs run_script). Screenshot assertion (drop). Consider MERGING #7+#17 into one "policy automation triggers action on failing policy" spec (2 cases) if host infra supports it. |

## Summary

- **Counts: DUP 0, AUGMENT 4, NEW 9, CUT 1, MERGE 3** (17 flows)

### NEW specs recommended (proposed paths)
- `tests/e2e/premium/labels/labels.spec.ts` — dedicated Labels page CRUD (Dynamic + Manual), anchor spec; absorbs #11's manual host-targeting. **[#12, #11]**
- `tests/e2e/premium/labels/labels-sort-view.spec.ts` — sort by Name/Desc/Type + View-all-hosts. **[#13]**
- `tests/e2e/premium/labels/labels-role-access.spec.ts` — maintainer (own-only) + observer (view-only) role permissions. **[#14, #15]**
- `tests/e2e/premium/controls/os-settings/certificates.spec.ts` — certificate add-modal validation + CRUD (needs a CA integration). **[#5]**
- `tests/e2e/premium/controls/os-settings/disk-encryption.spec.ts` — BitLocker PIN + disk-encryption toggle round-trip (config-only). **[#6]**
- `tests/e2e/premium/software/android-configuration.spec.ts` — android managed-configuration (Edit configuration JSON) round-trip. **[#4]**
- `tests/e2e/premium/settings/integrations/mdm.spec.ts` — MDM settings UI validation + end-user-migration webhook validation. **[#9]**
- `tests/e2e/premium/policies/policy-automation-install-software.spec.ts` — install-software-on-failing-policy (host-dependent). **[#7]**
- `tests/e2e/premium/hosts/run-script.spec.ts` — run script (python) on a host (host-dependent). **[#16]**
- `tests/e2e/premium/policies/policy-automation-run-script.spec.ts` — run-script-on-failing-policy (host-dependent); candidate to merge with #7. **[#17]**

### AUGMENT targets (existing spec + specific addition)
- config-profiles premium spec ← signed-profile rejection error + learn-more link (#1).
- setup-assistant spec ← bad-DEP-profile CONFIG_NAME_INVALID error + Apple-docs link (#2).
- software/library spec ← android web-clip application-id case + "Application (Android)" type/icon (#3).
- setup-experience/users spec ← "Lock end user info" managed-local-account toggle + IdP dependency (#8).

### Notable CUTs
- **#10 mdm-cert-renewal-banned-email-domain** — narrow negative test; needs a dedicated banned-domain admin
  user (no static user, can't be `@fleetdm.com`) and drives live APNs cert-renewal UI. The underlying
  behavior is a server-side email-domain check that's far cheaper to assert via API. Recommend an API-level
  test if the check is worth guarding at all.

### POM / helper work required
- **`LabelsPage` (biggest lift):** grow the 25-line stub to a full page object — Add-label form (name,
  description, Dynamic/Manual radios, query editor, host search/select, remove-host), row Actions dropdown
  (Edit / Delete / View all hosts), delete-confirm modal, sortable column headers, and `viewAllHosts()`
  → asserts Hosts filter pill. Drives #11–#15.
- **`CertificatesPage`:** goto-only today — add Add-certificate modal (name / CA dropdown / subject fields
  + inline field-validation errors), list-item locator, delete-confirm modal. Drives #5.
- **New `DiskEncryptionPage`** (os-settings/disk-encryption): disk-encryption + BitLocker-PIN checkboxes,
  Advanced-options expander, save + "Successfully updated disk encryption" toast. Drives #6.
- **New `MdmSettingsPage`** (settings/integrations/mdm): Apple MDM card detail fields, End-User-Migration
  section (switch, mode radios, webhook input + URL validation, example-payload button). Drives #9.
- **`SoftwareTitleDetailPage`:** add Actions dropdown → "Edit configuration" modal + ACE-editor set/read
  helper (android managed config). Drives #4.
- **`SetupExperienceUsersPage`:** add `lockEndUserInfoCheckbox` (managed local account). Drives #8.
- **`HostDetailsPage`:** add Actions → Run script flow + run-script-details modal (drop screenshot asserts).
  Drives #16 (and #7/#17 host-side install/run assertions).
- **`PolicyEditPage` / policies automations:** policy-automation modal (install_software + run_script
  checkboxes, software/script selectors). `PoliciesListPage` already has `applyAutomationFilter`/`goto({automationType})`,
  but the automation-**setup** modal is uncovered. Drives #7, #17.
- **Fixtures:** signed `.mobileconfig` (#1), bad `setup_badprofile.json` DEP profile (#2), `.py` scripts (#16/#17).

### Role-model / infra gaps
- **Missing team-admin static user** (brief flag): #14/#15 need only `ws-maintainer` + `global-observer`
  (both exist), so they're unblocked — but any *team-admin* label-permission variant can't be authored
  until a team-admin static user is provisioned.
- **Host-dependent flows (#7, #16, #17):** require live, enrolled, **online** Linux (Fedora/Ubuntu) hosts
  with scripts enabled. Our suite otherwise treats hosts as the only persistent given (per host-tests memory);
  these need dedicated enrolled Linux VMs and tolerate multi-minute waits — feasibility gated on host infra,
  not test code. Recommend deferring until a stable enrolled-Linux fixture host exists.
- **CA integration (#5):** needs a certificate authority named `android_test` provisioned in Integrations.
- **Apple MDM / APNs (#9, #10):** must stay turned ON; #10 additionally needs a banned-domain user.
- **Team-create violations:** the labels role flows seed team hosts via `addHostsToTeam` and QA Wolf
  broadly creates/deletes teams — replace with gitops Workstations scope + the `workstationsFleetId` fixture.
- QA Wolf team "Virtual Machines" / "Turkeys" → map to `Workstations` (or `Unassigned`).

### Open questions for the human
1. **#10 (banned-email cert renewal):** keep at all? If yes, API-level negative test vs full browser flow?
   Either way it needs a provisioned banned-domain admin user — worth it for one negative case?
2. **Host-dependent trio (#7, #16, #17):** do we have (or want to provision) stable enrolled online Linux
   VMs for run-script / policy-automation e2e? If not, defer or cover at API level.
3. **#7 + #17 merge:** collapse install-software and run-script policy-automation into one spec with two
   cases, or keep separate?
4. **Labels page split:** one `labels.spec.ts` (CRUD + sort + view-hosts) or three files (CRUD / sort-view /
   role-access)? Recommendation above assumes three, sharing one expanded `LabelsPage` POM.
5. **#5 certificates:** is a CA integration (`android_test`-equivalent) available/provisionable on the QA
   instance, or should this wait?
