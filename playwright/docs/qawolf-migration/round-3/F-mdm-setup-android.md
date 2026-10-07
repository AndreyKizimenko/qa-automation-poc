# Batch F — MDM, setup experience and Android settings

**10 gaps → about 7 augments and 2 new specs.** `Setup experience` · `Disk encryption` · `OS updates` ·
`MDM settings` · `Automatic enrollment` · `Android`

**Status: merged 2026-10-07** (planned 2026-10-01; re-checked 2026-10-05 against batches C and D's learnings; reviewed and
built 2026-10-05: 8 built or folded, 2 cut, see *Review decisions* and *What landed*; [PR #89](https://github.com/AndreyKizimenko/qa-automation-poc/pull/89) with batch E).

> ## ▶ Start here
>
> **Branch from `main` at or after 61db6b0** (batches C and D in
> [PR #86](https://github.com/AndreyKizimenko/qa-automation-poc/pull/86); [PR #87](https://github.com/AndreyKizimenko/qa-automation-poc/pull/87)).
> **Invoke the `playwright-test-author` skill first** (Skill tool) and follow it. Then read, in order:
> [README.md](README.md) §4–§5, round 2's [README §5](../round-2/README.md) (never lock a VM) and
> [§9](../round-2/README.md#9-working-a-batch-since-d), `playwright/CLAUDE.md` (**Test hosts**, and the OS-update
> rule: never on the VMs fleet), then this file.
>
> **What this batch is.** MDM and setup settings round 1 only rendered: saved, reloaded and read back. It
> runs on **Workstations, the premium fleet with no real hosts**, so nothing is delivered to a device. Two of its
> settings are global (the macOS migration settings, end-user authentication), and one (manual agent install)
> breaks two main-project specs if it's left on.
>
> Facts below were checked on 2026-10-01 against `main` (d55846a) and Fleet `rc-minor-fleet-v4.93.0`, the build
> both instances run, again on 2026-10-03 against `main` (da2aceb), and on 2026-10-05 against `main` (61db6b0)
> and the RC head both instances now run (c87f85c; none of this batch's cited files changed).
>
> **Since batches A and B (2026-10-03, re-checked against `main` da2aceb).** Neither built anything in this
> batch's area. What applies here:
>
> - **[#54619](https://github.com/fleetdm/fleet/issues/54619) (a fleet's webhook saves wipe each other) doesn't
>   reach this batch's saves.** The OS-updates form, and the Users form's Windows toggle, PATCH `/teams/:id`
>   with `mdm` only, and Fleet rewrites a fleet's `webhook_settings` only when the payload carries it
>   (`ee/server/service/teams.go:216-228`); the rest of setup experience and disk encryption save through their
>   own endpoints. Never save Workstations' **Settings** tab: that's the path that turns its failing-policies
>   webhook off.
> - **Org settings › Advanced options saves several global keys as loaded**, among them `mdm.apple_server_url`,
>   `apple_require_hardware_attestation` and `only_allow_apple_business_enrollment`, and
>   `shared/settings/organization/advanced-options.spec.ts` asserts they come through unchanged. C9 #9's save
>   posts only `mdm.macos_migration`, so it doesn't race it; nothing in this batch may change those three (§2.3).
> - **Ace editors: `setAceValue`** (`pages/components/aceEditor.ts`) writes through Ace's API (C9 #4).
> - **A toast doesn't prove a second save**: poll the stored state through the API (`expect.poll`) after each
>   save in a round trip.
> - **A timed-out test skips its `finally`**: restore in an `afterEach`, as *Traps* already says.
> - **`--repeat-each` on a serial describe that writes global config needs `--workers=1`** (C9 #9).
> - **Building beside another batch:** announce each instance run, and wait for a "go" before a run with
>   dependencies: `cleanup-setup` resets Workstations' setup experience and clears its OS updates, which breaks
>   an F run in flight.
>
> **Since batches C and D (2026-10-05).** The full list is in
> [README §5](README.md#since-batches-c-and-d-2026-10-05). Neither built anything in this batch's area, and F needs
> no host, so their Hosts-list, slice and label rules don't apply, and neither does the Macs' 2026-10-05 outage.
> What does:
>
> - **Clear toasts between saves**: `toast.dismissAll()` before each second save (C8 #6 / C9 #8 save IdP on, then
>   off; C9 #6 saves encryption, then the PIN), so `expectSuccess` matches its own card.
> - **A throwaway `pw-*` fleet is an option now** (approved for C, `bulk-transfer.spec.ts`): C8 #4 and C9 #6 could
>   run there instead of Workstations (decision 4). Deleting a fleet doesn't delete its bootstrap package
>   (`mdm_apple_bootstrap_packages` isn't in `teamRefs`, `server/datastore/mysql/teams.go:194-205`), so delete the
>   package before the fleet, in the `afterEach`.
> - **Workstations must hold no script batch**: `batch-run.spec.ts` reads its Batch progress tabs as empty (CTL-40).
> - **The free tier has more of this batch than the plan said** (Free coverage, decision 5).

## The gaps

| Gap | What's untested today | Proposed target | Kind | Source flow |
|---|---|---|---|---|
| round 1 C7 #17 | a fleet's OS-update settings stay on that fleet (other scopes unaffected) | `premium/exclusive/os-updates/macos-updates.spec.ts` | augment | `flows-Premium/settings-macos-updates-settings-setup-options-only-apply-at-team-level.flow.js` |
| round 1 C7 #28 | automatic enrollment: the IdP fields' tooltips (saving changed IdP values is a cut: they're the global end-user-auth settings gitops declares, and a save re-syncs every fleet's DEP profile) | `premium/settings/integrations/automatic-enrollment.spec.ts` | augment | `flows-Premium/settings-view-and-edit-automatic-enrollment.flow.js` |
| round 1 C8 #4 | setup experience: "Install Fleet's agent (fleetd) manually" disables Install software and Run script (needs a bootstrap package; nothing resets it today) | `premium/exclusive/…` (new), plus `macos_manual_agent_install: false` in `resetSetupExperience` | new | `flows-Premium/controls-controls-macos-setup-experience-check-install-fleetd-manually.flow.js` |
| round 1 C8 #6 | macOS setup: Require IdP and Lock end user info saved, reloaded, read back through the API; "Preview end user experience" is an external link (assert href and target) | `premium/controls/setup-experience/users.spec.ts` | augment | `flows-Premium/controls-controls-macos-setup-ui-validation.flow.js` |
| round 1 C9 #6 | BitLocker PIN required: saved and read back on Workstations, with disk encryption on first (the gating only today, on Unassigned) | `premium/controls/os-settings/disk-encryption.spec.ts` | augment | `flows-Premium/bitlocker-require-bitlocker-pin-is-now-available-under-advanced-options-on-the-disk-encryption-tab-can-be-toggled-on-and-off.flow.js` |
| round 1 C9 #2 | setup assistant: a bad automatic-enrollment profile is refused with Apple's error (CONFIG_NAME_INVALID) and a Learn more link — Fleet validates it with Apple through any ABM token, which premium has (the valid upload passes) | `premium/controls/setup-experience/setup-assistant.spec.ts` | augment | `flows-Premium/configuration-profiles-uploading-bad-profile-shows-error-and-links-to-error-docs.flow.js` |
| round 1 C9 #8 | macOS accounts: let end users edit, saved and read back | `premium/controls/setup-experience/users.spec.ts` | augment | `flows-Premium/mac-os-accounts-allow-end-users-to-edit-their-macos-local-account-account-name-and-full-name.flow.js` |
| round 1 C9 #9 | MDM settings: the Apple card's fields, the mode radios, the example payload (webhook URL only today) | `premium/settings/integrations/mdm.spec.ts` | augment | `flows-Premium/mdm-mobile-device-management-mdm-ui-validation.flow.js` |
| round 1 C9 #3 | Android web apps: a web-clip application id and its icon — Fleet can create a web app but never delete one (`POST /software/web_apps` only) | review: one pinned web app, or the add form's Chrome banner only (decision) | review | `flows-Premium/android-android-deploy-web-apps-web-clips.flow.js` |
| round 1 C9 #4 | Android: a Play app's Edit configuration saved and read back (`managedConfiguration` / `workProfileWidgets`) | `premium/software/…` (new) on Workstations | new | `flows-Premium/android-android-software-and-configurations.flow.js` |

## 1. Review first

Read every flow body. Known so far:

- **C8 #4 goes in `premium-exclusive`, and needs a cleanup fix first** (§2.1).
- **C7 #28: build the tooltips, cut the save** (§2.4).
- **C9 #3: a decision.** Fleet can create an Android web app but never delete one (§2.5).
- **C8 #6's "Preview end user experience" is an external link**, not a modal: assert its `href` and `target`
  (§2.2). The bootstrap-docs half of the flow is a cut, as round 1 also said.
- **C9 #6's copy is stale** ("Turn on disk encryption", "Advanced options"); 4.93 has per-platform tabs.
- **C7 #17's flow also covers disk encryption and end-user authentication.** Those halves are C9 #6 and C9 #8;
  this row is the OS-update half.
- **C9 #9: save only with `enable=false`**, restore afterwards, and never click "Turn off MDM" or "Renew
  certificate" (§2.3).
- **C9 #2 came from triage** ([TRIAGE.md](TRIAGE.md#moved-back-in-after-triage)): a bad setup-assistant profile
  is refused with Apple's error, which premium can produce today.

### Review decisions (2026-10-05, Andrey's answers in *Decisions*)

Every flow body read, against `main` 9d677f2 and Fleet c87f85c (the build both instances run).

| Gap | Decision | Where | Why |
|---|---|---|---|
| C7 #17 | **fold** | `premium/exclusive/os-updates/macos-updates.spec.ts`, the save test | Snapshot Unassigned's and QA's macOS updates before the save, and compare them while Workstations still holds the setting (comparing after the clear would pass whatever Fleet did). The flow's disk-encryption and end-user-auth halves are C9 #6 and C8 #6. |
| C7 #28 | **cut** | — | The flow's behaviour was saving the global IdP settings, which is cut (§2.4). What's left is four tooltip strings: copy that fails only when the copy changes. |
| C8 #4 | **build** | `premium/controls/setup-experience/bootstrap-package.spec.ts`, its own describe, on a throwaway `pw-*` fleet | Cross-card gating (Install software's macOS rows and Save, Run script's uploader) and its 422s. On a `pw-*` fleet it stays in the main project. `resetSetupExperience` also turns it off, and the `pw-*` fleet sweep deletes a fleet's bootstrap package first. |
| C8 #6 | **fold** | `premium/controls/setup-experience/users.spec.ts`, the round-trip test | Lock end user info joins the IdP save; the round trip reads back through the API and after a reload; the Preview link's `href` and `target`. The bootstrap-docs half was cut in round 1. |
| C9 #8 | **fold** (with C8 #6) | same test | The flow is C8 #6's toggles again: IdP + Lock on, then IdP off. Its distinct behaviour is that turning IdP off saves Lock off too ("end users can edit"), read back through the API. |
| C9 #6 | **build** | `premium/controls/os-settings/disk-encryption.spec.ts`, its own describe, on a throwaway `pw-*` fleet | Enforcement + PIN saved and read back, then unticking enforcement clears the PIN, saved and read back. A `pw-*` fleet needs no restore and holds no host. |
| C9 #2 | **fold** | `premium/controls/setup-experience/setup-assistant.spec.ts`, the lifecycle | After the delete, a profile Apple refuses: the toast carries Apple's code and a Learn more link (now `fleetdm.com/learn-more-about/dep-profile`, not Apple's page), and the default card stays. |
| C9 #9 | **build, narrowed** | `shared/settings/apple-mdm.spec.ts` (new, both tiers) + `premium/settings/integrations/mdm.spec.ts` | The Apple Push Certificate page, read-only, against `GET /mdm/apple`. Migration mode and webhook URL saved with `enable` false, read back, restored. **Cut:** the Example payload modal and the mode descriptions (static copy). |
| C9 #3 | **cut** | — | Fleet can create an Android web app but never delete one, and the add/delete path is the Play-app path `library.spec.ts` already covers. |
| C9 #4 | **fold** | `premium/software/library.spec.ts`, the Android lifecycle | An *edit configuration* step between add and delete: saved, read back, an unsupported key refused. No second Play app. |
| free | **build** | the shared APNs spec above; a `PAYWALLED_PAGES` row for `/settings/integrations/sso/end-users` | Free has Apple MDM and the APNs page; the end-user SSO page shows the premium message on free but no row checks it. |

## 2. Facts for the build

### 2.1 Install fleetd manually (C8 #4)

- `SetupExperience/cards/BootstrapPackage/components/BootstrapAdvancedOptions/BootstrapAdvancedOptions.tsx`:
  an "Advanced options" reveal (`:57-64`), checkbox **"Install Fleet's agent (fleetd) manually"** (`:79`) with
  its own Save → `PATCH /api/v1/fleet/setup_experience {fleet_id, macos_manual_agent_install}`, toast
  "Successfully updated." (`:33-37`).
- **Needs** a bootstrap package uploaded, and no macOS setup software or setup script. The UI disables the box
  otherwise (`BootstrapPackage.tsx:186-190`); the server answers 422 ("…first specify a macos_bootstrap_package"
  / "…first disable setup experience software" / "…first remove your setup experience script",
  `ee/server/service/teams.go:2914-2938`).
- **It disables, macOS only:** Install software's row checkboxes, "Cancel setup if software fails" and Save
  (`InstallSoftwareForm.tsx:243-244,337-360`), and Run script's uploader (`SetupExperienceScriptUploader.tsx:50-68`).
  Shared tooltip: "Disabled because you manually install Fleet's agent (Bootstrap package > Advanced options).
  Use your bootstrap package to install software during the setup experience." Rows render only if the fleet
  has macOS software ("No software available to install" otherwise), so upload one **unselected** macOS package
  after enabling.
- **Why exclusive:** `install-software.spec.ts` and `run-script.spec.ts` run on Workstations in the main project,
  and this disables both. **Nothing resets it**: `resetMacosSetupToggles` sends only end-user auth and the managed
  local account (`helpers/api/mdm.ts:123-134`), and deleting the bootstrap package doesn't clear it on the server.
  Add the reset to `resetSetupExperience` (so `cleanup-setup` resets it) **before** the first run, as its own
  `PATCH /setup_experience {fleet_id, macos_manual_agent_install: false}`: added to `resetMacosSetupToggles'`
  `PATCH /teams/:id` body it would be ignored, since `ModifyTeam` never reads it (only the setup-experience update
  does, `ee/server/service/teams.go:2914`). Turning it off never hits the missing-bootstrap-package 422, and it's
  safe inside `resetSetupExperience`'s `Promise.all`. Unverified: this may explain round 2's "Install-software form disabled even with gitops off"
  (#54169, closed as not reproducible).
- Reuse `bootstrap-package.spec.ts`'s fixture (`test-data/apple/macos/bootstrap-package/dummy-bootstrap-package.pkg`).
  Nothing is delivered: a bootstrap package acts only at automatic enrollment.

### 2.2 macOS setup and end-user info (C8 #6, C9 #8)

- `users.spec.ts` "renders + IdP and hidden-admin toggles round-trip" saves without a reload or an API read-back;
  "Lock end user info renders only when Require IdP is enabled" is visibility only. Both run on Unassigned and
  Workstations.
- Read back from `GET /teams/:id`: `mdm.setup_experience.{enable_end_user_authentication, lock_end_user_info,
  enable_create_local_admin_account, end_user_local_account_type}` (`frontend/interfaces/team.ts:67-78`).
- "Lock end user info" ("Account Name and Full name will be locked to IdP values in Setup Assistant. macOS
  only."; `…/UsersForm/components/EndUserAuthSection/EndUserAuthSection.tsx:71-95`). Toggling IdP sets Lock to
  match (`UsersForm.tsx:90-101`). Lock without IdP is a 422 (`teams.go:2886-2895`).
- "Preview end user experience" is a `CustomLink newTab` to
  `https://fleetdm.com/learn-more-about/setup-experience/end-user-authentication` (`Users.tsx:177-185`). Assert
  `href` and `target`, as `macos-updates.spec.ts:102` does.
- **Turning end-user auth on queues an ABM profile job** (`ee/server/service/mdm.go:361-365`), and Workstations
  is the ABM default fleet for macOS, iOS and iPadOS (`gitops/premium-fleetqa/default.yml:21-25`). Fold C9 #8 into
  the existing round-trip test rather than racing it on the same fleet.

### 2.3 Disk encryption, OS updates, MDM settings (C9 #6, C7 #17, C9 #9)

- **BitLocker PIN (C9 #6).** The existing spec is serial and Unassigned-only, and checks the gating. The PIN
  checkbox is disabled until "Enable disk encryption" is ticked, and unticking clears it
  (`OSSettings/cards/DiskEncryption/DiskEncryption.tsx:195-202,420-446`); the server also refuses a PIN without
  encryption (`server/fleet/app.go:517-525`). Save: `POST /api/v1/fleet/disk_encryption {fleet_id,
  windows_settings: {enable_disk_encryption, require_bitlocker_pin}}`; read `team.mdm.windows_settings.
  require_bitlocker_pin`. **There's no fleet-scoped disk-encryption helper** (only `get/setGlobalDiskEncryption`),
  and cleanup doesn't reset Workstations' encryption, so restore in an `afterEach`. Guard that Workstations holds
  no real host (`listFleetHosts(...).filter(h => h.real)`, as `ddm-conflict.spec.ts:59-61` does).
- **OS updates stay on their fleet (C7 #17).** `premium/exclusive/os-updates/macos-updates.spec.ts` saves a minimum
  version and deadline on Workstations and clears them. Add: snapshot Unassigned (`getAppConfig().mdm.macos_updates`)
  and QA (`getFleetOsUpdates(request, qaFleetId)`) before, compare after. Reads only, never the VMs fleet. It
  stays in `exclusive/`.
- **MDM settings (C9 #9).** The Apple card ("Apple (macOS, iOS, iPadOS) MDM turned on.", Edit →
  `/settings/integrations/mdm/apple`): h1 "Apple Push Certificate Portal"; Common name (CN), Organization name, MDM
  server URL, Renew date (`ApplePushCertInfo.tsx:25-49`; CN and renew date are already covered via the CLI,
  `tests/cli/shared/get-read-only.spec.ts:43-48`). End-user migration (`EndUserMigrationSection.tsx`): slider
  Enabled / Disabled, radios `voluntary` / `forced` disabled unless enabled (`:189-211`), "Example payload"
  (`:239-245`; "An example request sent to your configured Webhook URL.", JSON across several lines, so parse it).
  Save `PATCH /config {mdm: {macos_migration: {enable, mode, webhook_url}}}`, nothing else
  (`EndUserMigrationSection.tsx:105-113`), toast "Successfully updated end user migration." Global, premium + ABM
  only, and no other spec reads it. Whether mode and URL persist with `enable=false` is unverified. The page's
  Apple Business card only displays `only_allow_apple_business_enrollment`; never change it, `apple_server_url`
  or `apple_require_hardware_attestation` from a main-project spec: the Advanced options save posts them as
  loaded, and `shared/settings/organization/advanced-options.spec.ts` asserts they're unchanged.

### 2.4 Automatic enrollment (C7 #28)

`automatic-enrollment.spec.ts` uploads and deletes a EULA and checks the IdP form flags a cleared required field;
its header says it stays client-side because saving would `PATCH` global config. That's right: **these are the
global end-user-auth settings**, declared in gitops (`gitops/premium-fleetqa/default.yml:16-20`), the suite's
*Require IdP* checkbox depends on them (disabled unless entity id, IdP name and metadata are all set,
`frontend/utilities/permissions/permissions.ts:28-33`), and a save re-syncs every fleet's DEP profile
(`server/service/appconfig.go:1855-1883`). **Cut the save.** Build the tooltips
(`IdentityProviders/components/EndUserAuthSection/EndUserAuthSection.tsx`: `:160` "A required human friendly name
for the identity provider that will provide single sign-on authentication.", `:171` Entity ID "…Okta calls this
Audience Restriction.", `:188` "Metadata URL provided by the identity provider.", `:200` "Metadata XML provided by
the identity provider.").

### 2.5 Android (C9 #3, C9 #4)

- Android MDM is on (`default.yml:56`).
- **Edit configuration (C9 #4).** Add a Play app to Workstations with `addAppStoreApp(request, workstationsFleetId,
  { appStoreId, platform: 'android' })`, **not** one another spec uses (`com.openai.chatgpt`,
  `com.alltrails.alltrails`). `SoftwareTitleDetailPage.runAction('Edit configuration')`; modal "Edit
  configuration", an Ace editor "Configuration", toast "<name> configuration updated." API `PATCH
  /software/titles/:id/app_store_app {fleet_id, configuration}`; only `managedConfiguration` and
  `workProfileWidgets` are allowed top-level keys (`server/fleet/android.go:329-366`). Reopening shows tab-indented
  JSON, so compare parsed values; Ace auto-pairs brackets, so set the content through the editor's API
  (`setAceValue`, `pages/components/aceEditor.ts`).
- **Web apps (C9 #3).** No UI creates one: `POST /api/v1/fleet/software/web_apps` (multipart `title`, `url`,
  optional square PNG icon of 512 px or more) returns an `app_store_id`, and the title is then added and removed
  like a Play app. **There is no delete** (`server/service/handler.go:959`), so every create is permanent in the
  Android Enterprise. Typing a web-app id into the Android form shows "This is an Android web app and it requires
  Google Chrome to work. Please make sure you add Google Chrome to this fleet." (`SoftwareAndroidForm.tsx:130-144`).
  **Options:** create one web app once and pin its id in the spec (durable, like the VM fixtures), or test only the
  client-side banner. The flow's id is probably QA Wolf's own (unverified).

### 2.6 A bad setup-assistant profile (C9 #2)

`SetOrUpdateMDMAppleSetupAssistant` validates a new profile with Apple's API through any ABM token
(`ee/server/service/mdm.go:692`, `server/mdm/apple/apple_mdm.go:365`), and `setup-assistant.spec.ts`'s valid upload
passes on premium every night, so a token works. Upload a malformed profile and assert Fleet's refusal
("Couldn't add. CONFIG_NAME_INVALID", per round 1) and its "Learn more" link. Nothing is saved: Fleet validates before
storing. Generate the fixture in the test, or commit a `test-data/apple/macos/setup-assistant/` file with a README.

## Reusable pieces

`SetupExperienceUsersPage`, `BootstrapPackagePage` (needs the Advanced options locators), `InstallSoftwarePage`,
`RunScriptPage`, `DiskEncryptionPage` (`goto({ fleetId, platform })`), `OsUpdatesPage`, `IntegrationsPage`
(`gotoMdm`, `gotoSsoEndUsers`), `SetupAssistantPage`, `SoftwareTitleDetailPage.runAction`, `setAceValue`; API
(`helpers/api/mdm.ts`): `resetSetupExperience`, `resetMacosSetupToggles`, `getBootstrapMetadata` /
`deleteBootstrapPackage`, `clearSetupExperienceSoftware`;
(`fleets.ts`) `getFleetOsUpdates`, `clearFleetOsUpdates`, `setFleetMacosUpdates`; `getAppConfig` / `patchAppConfig`,
`addAppStoreApp`, `deleteSoftwareTitle`, `listFleetHosts`.

## Decisions (answered by Andrey, 2026-10-05)

1. **C9 #3: cut entirely**, not even the Chrome banner. Fleet can create a web app but never delete one (§2.5).
2. **C8 #4:** runs on a throwaway `pw-*` fleet in the main project (decision 4), so `macos_manual_agent_install:
   false` in the cleanup reset is a backstop for Workstations and Unassigned, not a precondition.
3. **C7 #28: cut**, tooltips included: the IdP save is unsafe (§2.4), and the tooltips alone are copy.
4. **C8 #4 and C9 #6 on a throwaway `pw-*` fleet: yes.** Delete the bootstrap package before the fleet. C8 #6 /
   C9 #8 stay in `users.spec`, C7 #17 in `exclusive/`.
5. **Free coverage: yes.** A read-only Apple Push Certificate check on both tiers (`shared/`, never Renew or Turn
   off), and a free paywall row for `/settings/integrations/sso/end-users`.
6. **C9 #9 narrowed:** the APNs page plus a migration save with `enable` false; the Example payload modal and the
   mode descriptions are cut.

## Free coverage

Most rows are premium-only, but not all, and the paywall list misses one page:

- **C9 #9's Apple MDM card renders on free** (`MdmSettings.tsx:113-119`; only EULA and end-user migration are
  premium-gated, `:137-149`), and free has Apple MDM on (`tests/cli/shared/get-read-only.spec.ts:43-48` reads
  `mdm-apple` on both tiers). A read-only check of the card belongs in `shared/`.
- **`/settings/integrations/sso/end-users`** (C7 #28's page) shows the premium message on free
  (`EndUserAuthSection.tsx:128-129`), but it isn't in `PAYWALLED_PAGES` (`tests/e2e/free/paywalls.spec.ts:14-32`).
- The rest is covered by the paywalls spec's existing rows.

## Traps this batch will hit

- **The Workstations wipe doesn't reset** manual agent install, disk encryption, the BitLocker PIN,
  `end_user_local_account_type`, the global macOS migration settings or the global end-user authentication (IdP)
  settings (the fleet's own end-user auth toggle *is* reset, by `resetMacosSetupToggles`). Restore each in an
  `afterEach`, and add a cleanup reset for any that would break other specs if stranded.
- **The users, bootstrap-package, install-software and run-script specs all write Workstations' setup
  experience** in the main project at once. Augment the existing tests rather than adding parallel writers.
- **Every form here is gated in gitops mode**, so a run that overlaps the gitops-mode step sees them disabled.
- **Never on the VMs fleet**: no OS-update setting, no disk encryption, no setup experience change there.
- **Never run a library-script batch on Workstations**: `batch-run.spec.ts` asserts its Batch progress tabs are
  empty (CTL-40).

## Done when

- Every row has a written review decision; the questions above have Andrey's answer.
- The augments and new specs built on premium, each reading its save back through the API and restoring it;
  C8 #4 in `premium-exclusive` with its cleanup reset.
- `npm run check` clean; each changed spec run with dependencies, once headed; the exclusive one by file name
  (`--project=premium-exclusive <file>`).
- `playwright-test-reviewer` run on the branch's diff, findings fixed or answered.
- Docs in the same commits: this file's *What landed*, a [DELIVERY-LOG](../DELIVERY-LOG.md) line, a
  [test-audit](../../test-audit/README.md) entry per `test()`, `helpers/README.md` / `pages/README.md`, any new
  fixture's `test-data/` README, and this round's [README](README.md) batch table and [INDEX](INDEX.md).
- PR open, Andrey told it's ready for its branch run.

## What landed

Built 2026-10-05 on `playwright/qawolf-round3-batch-f`, shipped with batch E in [PR #89](https://github.com/AndreyKizimenko/qa-automation-poc/pull/89).

| Gap | Landed in | What it asserts |
|---|---|---|
| C7 #17 | `premium/exclusive/os-updates/macos-updates.spec.ts`, the save test | While Workstations holds a minimum version and deadline, Unassigned's (`GET /config`) and the QA fleet's macOS updates read back exactly as before the save; neither held the saved version, so a save that reached one would show. |
| C8 #4 | `premium/controls/setup-experience/bootstrap-package.spec.ts`, new describe on a throwaway `pw-manual-agent-*` fleet | Without a package, "Install Fleet's agent (fleetd) manually" is disabled and the API refuses it (422). With one, it saves and reads back. While on, Install software's macOS row, "Cancel setup if software fails" and Save are disabled and the API refuses the selection (422); Run script's Upload is disabled. Off again, it reads back off and the row can be selected. |
| C8 #6 + C9 #8 | `premium/controls/setup-experience/users.spec.ts`, the round trip (Unassigned, Workstations) | Require IdP on ticks Lock end user info with it; both saved, read back through the API and after a reload. IdP off hides Lock and saves it off (end users can edit their Account Name and Full Name), read back the same way. The Preview end user experience link's address and new tab. An `afterEach` keyed to the test resets the toggles. |
| C9 #6 | `premium/controls/os-settings/disk-encryption.spec.ts`, new describe on a throwaway `pw-bitlocker-*` fleet | Windows enforcement + Require BitLocker PIN saved, read back through the API and after a reload; unticking enforcement unticks and locks the PIN, and both save off. |
| C9 #2 | `premium/controls/setup-experience/setup-assistant.spec.ts`, the lifecycle | After the delete, the fixture with an empty `profile_name` is refused by Apple: "Couldn't add. CONFIG_NAME_REQUIRED." with a Learn more link to `fleetdm.com/learn-more-about/dep-profile` (new tab); the default card stays. |
| C9 #9 | new `shared/settings/apple-mdm.spec.ts` (both tiers); `premium/settings/integrations/mdm.spec.ts` | The Apple MDM card's Edit → the push certificate's common name, organization, MDM server URL and renew date, each against the API; Turn off MDM and Renew certificate present, never clicked. A migration mode and webhook URL saved with the workflow disabled, read back through the API and after a reload, then restored; the radios and URL are locked while it's off. |
| C9 #4 | `premium/software/library.spec.ts`, the Android lifecycle's *edit configuration* (Unassigned, Workstations) | A key Fleet doesn't support is refused ("Only "managedConfiguration" and "workProfileWidgets" are supported as top-level keys.") and nothing changes; `managedConfiguration` + `workProfileWidgets` saved, read back through the API, logged as `edited_app_store_app`, and reopened as saved. |
| free | `free/paywalls.spec.ts`; the shared Apple MDM spec above | Authentication (SSO) › End users shows the premium message. |
| C7 #28, C9 #3 | — | Cut at review. |

**Fleet bug filed:** [fleetdm/fleet#54845](https://github.com/fleetdm/fleet/issues/54845). Fleet doesn't serve Ace's
`worker-json.js` (nor `worker-xml.js`), so the app Edit configuration modal throws an uncaught `importScripts` error.
The editor still saves. `DEFAULT_IGNORED_PAGE_ERRORS` in `helpers/console.ts` ignores that one error, with a row in
`docs/blocked-by-product-bugs.md`.

**Also:** `deleteFleet` deletes the fleet's bootstrap package first, because a fleet delete leaves it behind.
`resetSetupExperience` turns manual agent install off. Free's `server_url` ends in `/`, so its Apple MDM page shows
`…//mdm/apple/mdm`: the page concatenates, Fleet accepts the slash, and the spec allows it. This is cosmetic, comes
from our config, and isn't filed.

**Verified** against `rc-minor-fleet-v4.93.0` (c87f85c). Every changed spec was run with dependencies: premium
(users, setup-assistant, bootstrap-package, disk-encryption, mdm, apple-mdm, library's Android cases; 39/39 with
setup and teardown), `premium-exclusive` macos-updates (11/11), and free apple-mdm + paywalls (29 passed, 8
premium-only cleanup steps skipped). The premium specs also ran once headed. `--repeat-each=3` passed on the two
throwaway-fleet tests (3 workers) and on users / mdm / setup-assistant (1 worker, since they write shared config).
The combined E + F branch run, [37395809242](https://github.com/AndreyKizimenko/qa-automation-poc/actions/runs/37395809242),
was green: premium 651 passed, 0 failed, 4 flaky (none an E or F test: an FMA download 504 and a slow Users list),
free 334 passed, 0 flaky.
