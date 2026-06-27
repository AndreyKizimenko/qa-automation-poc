# GitOps — test cases

> Cross-cutting area. GitOps behavior for **every** product area is collected here
> (software, MDM profiles, queries, policies, labels, teams, settings) rather than
> interleaved into each area file. Area files cross-reference the relevant cases.
>
> Source intent: `fleetctl generate-gitops`, the `gitops.sh` script, and the
> GitOps GitHub/GitLab workflows. See the `gitops/` dir in this repo for the live
> fleetqa configs.

## Software via GitOps

### GITOPS-SW-001 — Add a Fleet-maintained app to a team via GitOps

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** A Premium Fleet with a team (e.g. Workstations). A GitOps repo with the team's `team-name.yml`. No matching FMA currently added in the UI for that team.
- **Source:** #24469

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In `team-name.yml`, add the desired app under `software.fleet_maintained_apps` (following the FMA GitOps guide, not the generic package flow). | YAML references the FMA by its slug/identifier. |
| 2 | Run `fleetctl gitops -f team-name.yml`. | Command completes without error. |
| 3 | In the Fleet UI, open Software for that team and filter to Available for install. | The FMA is scoped to the correct team and appears in the software list as available to install. |

### GITOPS-SW-002 — Add a Fleet-maintained app to "No team" via GitOps

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** A Premium Fleet with a GitOps repo containing `no-team.yml`. No matching FMA currently added in the UI for No team.
- **Source:** #24469

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In `no-team.yml`, add the FMA under `software.fleet_maintained_apps`. | YAML references the FMA. |
| 2 | Run `fleetctl gitops -f no-team.yml`. | Command completes without error. |
| 3 | In the Fleet UI, open Software with No team selected and filter to Available for install. | The FMA is scoped to No team and appears in the software list. |

### GITOPS-SW-003 — GitOps removes a UI-added FMA that is absent from YAML

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** A Premium Fleet under GitOps control. An FMA has been added through the UI for a team (or No team) but is NOT present in that team's YAML.
- **Source:** #24469

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Confirm in the UI that the FMA appears as available to install for the team. | FMA is listed. |
| 2 | Run `fleetctl gitops -f team-name.yml` (YAML does not contain the FMA). | Command completes; GitOps reconciles the team to match YAML. |
| 3 | Reload the team's Software list in the UI. | The FMA is removed from the list of software available to install. |

### GITOPS-SW-004 — GitOps preserves an FMA's existing auto-install state

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** A Premium Fleet under GitOps control. An FMA was added in the UI with auto-install (policy) enabled, and the same FMA is present in the team YAML.
- **Source:** #24469

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Confirm the FMA shows auto-install enabled in the UI. | Auto-install/policy is active. |
| 2 | Ensure the same FMA is configured in the team YAML and run `fleetctl gitops -f team-name.yml`. | Command completes without error. |
| 3 | Reload the FMA in the UI. | The auto-install state is unchanged (GitOps does not toggle it). |

### GITOPS-SW-005 — Copy the FMA slug from the software details modal

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** A Premium Fleet. User can reach Software > Add software.
- **Source:** #24469

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to Software > Add software and select a Fleet-maintained app. | The FMA add panel opens. |
| 2 | Select "Show details." | The details view displays the FMA slug. |
| 3 | Click the copy icon next to the slug. | A "Copied" message appears and the slug is placed on the clipboard (verifiable by pasting). |

### GITOPS-SW-006 — Override FMA install/uninstall scripts and queries via GitOps

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** A Premium Fleet under GitOps control with an FMA configured in the team YAML.
- **Source:** #25636

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In the FMA's YAML entry, add all four override fields (install script, uninstall script, pre-install query, post-install script). Run `fleetctl gitops`. | The FMA's details in the UI reflect all four overridden fields. |
| 2 | Remove all override fields except `install_script`, revise the install script, and re-apply GitOps. | The UI blanks out pre-install query and post-install script, shows the revised install script, and reverts the uninstall script to the FMA manifest version. |
| 3 | Remove the `install_script` field entirely and re-apply GitOps. | The UI reverts the install script to the FMA manifest version. |

### GITOPS-SW-007 — Auto-install package uses `ensure` / `policies` keys via GitOps and API

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A Premium Fleet under GitOps control. A software package to be auto-installed.
- **Source:** #28064

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Configure a software installer with auto-install in the team YAML using `ensure: present` (the renamed key, not `automatic_install: true`). Run `fleetctl gitops`. | GitOps applies successfully and the package is added with its auto-install policy. |
| 2 | In the UI, open the software title page for the package. | The package shows correctly, including its auto-install policy. |
| 3 | Inspect the API response powering the software title page. | Associated policies are returned in the `policies` field (not the legacy `automatic_install_policies` field). |

### GITOPS-SW-008 — GitOps-mode custom package upload shows YAML modal instead of installing

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A Premium Fleet with GitOps mode turned ON and a repository configured in settings. Logged in as admin or maintainer.
- **Source:** #28110

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to Software > Add software > Custom package and choose a package file. | The upload page no longer shows install Options or target/label controls (removed in GitOps mode). |
| 2 | Complete the upload. | You are taken to the software title page and a modal showing the YAML appears; the "Software successfully added" flash does NOT appear. |
| 3 | In the YAML modal, click the repository link. | The link opens the repository defined in Fleet settings. |
| 4 | Download the scripts and queries offered in the modal. | Downloaded files have the appropriate titles and content; paths/downloads only appear for items that are populated or changed (empty/default items are omitted). |
| 5 | Click each "How to use YAML" link. | Links navigate to the correct documentation/instructions. |

### GITOPS-SW-009 — GitOps-mode custom package edit shows hash-only YAML modal

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** A Premium Fleet with GitOps mode ON. A custom package already added under GitOps. Logged in as admin or maintainer.
- **Source:** #28110

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Edit the package (e.g. change advanced options) and save. | A YAML modal appears after the successful edit; the success flash does NOT appear over the modal. |
| 2 | Inspect the YAML shown in the edit modal. | Only the hash and title are shown to copy; first-step copy instructs that only the hash needs to be copied; next-step copy instructs to download the files and replace the existing ones in their scripts directory. |
| 3 | Download the scripts and queries from the edit modal. | Files download with the appropriate titles and content, reflecting any advanced-option changes. |
| 4 | Later, on the software title page click "View YAML." | The YAML modal reopens with the correct content. |

### GITOPS-SW-010 — GitOps reconciles UI-uploaded packages against YAML (remove vs. hash-mismatch failure)

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** A Premium Fleet with GitOps mode ON. GitOps repo cloned locally.
- **Source:** #28110

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Upload a custom package in the UI but do NOT add it to the YAML, then run `fleetctl gitops`. | The uploaded package is removed from Fleet on the GitOps run. |
| 2 | Upload/edit a package in the UI, copy the scripts/YAML into the repo with the correct hash, and run `fleetctl gitops`. | The installer and advanced-option changes are applied successfully. |
| 3 | Edit a package in the UI but copy the YAML without updating the hash, then run `fleetctl gitops`. | GitOps fails with an error because the hash no longer matches. |

### GITOPS-SW-011 — Add multiple custom packages from a single package YAML referenced by a team

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A Premium Fleet under GitOps control. Migration from #31165 already applied for existing YAML.
- **Source:** #30849

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Create a package YAML file (list format) with two custom packages each specified by `url`. Reference this file from a team YAML and run `fleetctl gitops`. | Both packages are added to the correct team in Fleet. |
| 2 | In the team YAML, add `self_service`, `categories`, and labels for the two packages. Run `fleetctl gitops`. | Both options are applied to both packages. |
| 3 | Edit the package YAML so both packages are specified by `hash` (packages already uploaded). Run `fleetctl gitops`. | Both packages remain on the correct team and all team-YAML settings (self-service, categories, labels) are applied. |
| 4 | Edit the package YAML so one package uses `hash` and the other uses `url`. Run `fleetctl gitops`. | Both packages remain on the correct team with all team-YAML settings applied. |
| 5 | Remove one package from the package YAML and run `fleetctl gitops`. | The removed package is removed from Fleet; the other remains. |

### GITOPS-SW-012 — GitOps rejects multiple FMA/VPP apps in a list-format package YAML

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** A Premium Fleet under GitOps control.
- **Source:** #30849

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Create a list-format package YAML containing multiple FMA and/or VPP apps. Reference it from a team YAML and run `fleetctl gitops`. | GitOps fails with an easy-to-understand error that identifies the problem and points to the offending team and package. |

### GITOPS-SW-013 — GitOps remains backwards-compatible with inline and old single-package YAML

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A Premium Fleet under GitOps control with migration from #31165 applied.
- **Source:** #30849

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Specify package(s) inline in the team YAML (legacy form) and run `fleetctl gitops`. | The package(s) are added to the correct team. |
| 2 | Create a package YAML in the old single-package format (no array, without self_service/categories/labels) and reference it. Run `fleetctl gitops`. | The package is added to the correct team. Note: self-service, categories, and labels are no longer allowed in the package YAML and must live on the team YAML. |
| 3 | A large environment with no YAML changes (already migrated) re-runs `fleetctl gitops`. | The run completes without error (no false changes). |

### GITOPS-SW-014 — GitOps supports mixing inline, multi-package, old-format, and list-format YAML

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** A Premium Fleet under GitOps control; no packages duplicated across sources.
- **Source:** #30849

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In one team YAML, specify some packages inline, reference a multi-package (list-format) YAML, reference a single package in old-format YAML, and reference a single package in new list-format YAML — all distinct packages. | The team YAML references all four sources without duplication. |
| 2 | Run `fleetctl gitops`. | All packages from all four sources are added to the correct team in Fleet. |

### GITOPS-SW-015 — Add packages to Setup experience via GitOps (multiple referencing methods)

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** A Premium Fleet under GitOps control with macOS setup experience available for the team.
- **Source:** #30849

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Create a list-format package YAML, reference it on the team YAML, and set `setup_experience: true`. Run `fleetctl gitops`. | The package is added to Setup experience. |
| 2 | Reference a list-format package YAML inline under the team YAML's `macos_setup.software` key. Run `fleetctl gitops`. | The package is added to Setup experience. |
| 3 | Repeat steps 1 and 2 using an old-format single-package YAML. Run `fleetctl gitops`. | The package is added to Setup experience in both cases. |
| 4 | Create a list-format package YAML with multiple software items, reference it on the team YAML with `setup_experience: true`, and run `fleetctl gitops`. | All packages in the file are added to Setup experience. |

### GITOPS-SW-016 — Tie a software package to a policy via GitOps (hash and package_path)

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A Premium Fleet under GitOps control with a policy YAML and package YAML in the repo.
- **Source:** #30849

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Create an old-format package YAML with one package and a policy YAML referencing it by `hash_sha256`. Run `fleetctl gitops`. | The package is tied to the policy. |
| 2 | Create a package YAML (old format using `url` or `hash_sha256`, or list format) and a policy YAML referencing the `package_path`. Run `fleetctl gitops`. | The package is tied to the policy. |
| 3 | Create a list-format package YAML with multiple installers and a policy YAML referencing the `hash_sha256` of ONE of them. Run `fleetctl gitops`. | That specific package is tied to the policy. |
| 4 | Create a list-format package YAML with multiple installers and a policy YAML referencing the file by `package_path`. Run `fleetctl gitops`. | GitOps returns an easy-to-understand error (a multi-package file cannot be tied to a policy by path). |

### GITOPS-SW-017 — `fleetctl generate-gitops` reproduces all packages on re-apply

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** A Premium Fleet with several packages already added. `fleetctl` installed and configured.
- **Source:** #30849

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Run `fleetctl generate-gitops`. | YAML output is produced describing the existing software. |
| 2 | Use the generated YAML in a `fleetctl gitops` run. | The run completes and all packages remain present in Fleet (round-trip is lossless). |

### GITOPS-SW-018 — GitOps-mode UI changes render when adding a custom package

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** A Premium Fleet with GitOps mode turned ON. Design available in Figma (#30849).
- **Source:** #30849

| # | Step | Expected result |
|---|------|-----------------|
| 1 | With GitOps mode on, go to Software > Add software and add a custom package. | The GitOps-mode UI matches the Figma design for multi-package support. |

### GITOPS-SW-019 — Add a patch policy for a Fleet-maintained app

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** A Premium Fleet. An FMA added to a team (UI or GitOps).
- **Source:** #31914

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In the Fleet UI, add a patch policy for the FMA. | The patch policy is created; its query includes a version matching one in the software title. |
| 2 | Wait for the FMA manifest to publish a newer version. | The existing patch policy's query is NOT auto-updated to the new manifest version (it stays pinned to the version it was created with). |

### GITOPS-SW-020 — Patch policy respects a GitOps version pin (rollback) for an FMA

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** A Premium Fleet under GitOps control with an FMA added via GitOps and pinned to a specific version.
- **Source:** #31914, #38988

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In the team YAML, pin the FMA to a current version under `software.fleet_maintained_apps` and add a patch policy for it. Run `fleetctl gitops`. | The patch policy targets the pinned version. |
| 2 | Wait for a newer version to appear in Fleet's FMA manifest. | The patch policy's version stays the same as the pinned version (the new manifest version does not override the pin). |

### GITOPS-SW-021 — Combine patch policy with software-automation install scenarios

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** A Premium Fleet with an FMA added to a team and patch policy support available.
- **Source:** #31914

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enforce-and-keep-updated: add a patch policy with software automation plus a dynamic policy that only checks whether the software is installed. | Both policies coexist; out-of-date or missing software triggers (re)install per automation. |
| 2 | Self-service + patch-if-installed: add only the patch policy with software automation (software offered self-service). | Software is patched only when already installed; it is not force-installed. |
| 3 | Patch end-user-installed software without self-service: add a patch policy with software automation and add the software to the team without enabling self-service. | Installed copies are patched; the software is not offered in self-service. |

### GITOPS-SW-022 — Pin a Fleet-maintained app to a specific version via GitOps

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** A Premium Fleet under GitOps control with an FMA configured in the team YAML.
- **Source:** #31919

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In the FMA's YAML entry under `software.fleet_maintained_apps`, set `version` to a specific available version. Run `fleetctl gitops`. | GitOps applies; the FMA is pinned (rolled back) to that version. |
| 2 | In the UI, open Software details > Actions > Edit software. | The available versions are listed for the FMA. |
| 3 | Inspect the status counts table under the package name on the software title details. | Install/status counts are tied to the selected (pinned) version; when the package is changed, the counts reset to 0. |
| 4 | Confirm the scripts tied to the cached package. | The scripts are the ones that were active at download time (e.g. manifest scripts if no YAML override existed then). |

### GITOPS-SW-023 — GitOps errors on an unavailable FMA version

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** A Premium Fleet under GitOps control with an FMA in the team YAML.
- **Source:** #31919, #38988

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Set `version` for the FMA to a value that is neither cached in Fleet nor present in the manifest. Run `fleetctl gitops`. | GitOps fails with an easy-to-understand error stating the version is unavailable. |

### GITOPS-SW-024 — Pin a Fleet-maintained app to a major version via GitOps (caret constraint)

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** A Premium Fleet under GitOps control with an FMA configured in the team YAML.
- **Source:** #38988

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In the FMA's YAML entry, set `version` to a caret/major constraint (e.g. `^N`). Run `fleetctl gitops`. | GitOps applies; the FMA is pinned to the cached version satisfying that major. |
| 2 | In the UI, open Software details > Actions > Edit software. | Available versions are listed, reflecting the major-version pin. |
| 3 | Set the caret constraint to a major version not available in Fleet (e.g. `^999`) and run `fleetctl gitops`. | GitOps fails with the documented unavailable-major-version error. |

### GITOPS-SW-025 — Cached FMA versions in S3 are capped (oldest evicted)

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** A Premium Fleet under GitOps control with an FMA that has been pinned across several versions.
- **Source:** #38988, #31919

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Pin the FMA across successive versions via GitOps `version:` so more than the allowed number of packages would be cached. | Fleet retains at most 2 packages (versions) in S3; the oldest cached package is evicted as new versions are pinned. Note: an earlier iteration kept 3 (N-2); current behavior is a 2-package cap. |

### GITOPS-SW-026 — Manage Android Google Play apps via GitOps

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** A Premium Fleet with Android (Android Enterprise) connected and a team configured for GitOps.
- **Source:** #33061

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In the team YAML, add an Android app under the existing `software.app_store_apps` setting. Run `fleetctl gitops`. | The Android app is added to the correct team and shows as available in Fleet. |
| 2 | Run `fleetctl generate-gitops`. | The exported YAML includes the Android app store app entry in the proper structure described in the product changes. |
| 3 | Apply YAML containing an invalid Android app store configuration. | GitOps returns the defined Android app store error message(s). |

### GITOPS-SW-027 — Configure an Android app's managedConfiguration via GitOps

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** A Premium Fleet with Android Enterprise connected. An Android app added to a team. A configuration JSON file in the GitOps repo.
- **Source:** #35666

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Reference a configuration JSON (containing a valid `managedConfiguration`) for the Android app via the YAML `configuration.path` key. Run `fleetctl gitops`. | GitOps applies; an `edited_app_store_app` activity appears in the global feed for the app. |
| 2 | Install the app via self-service on an enrolled work-profile host. | The app installs and the settings from the configuration are applied. |
| 3 | Edit the configuration for an app already installed and re-apply GitOps. | Install status goes to Pending on the Software title and Host details pages, then settles; the app's settings update without reinstalling the app. |
| 4 | Run `fleetctl generate-gitops`. | `configuration.path` is included for Android apps that have a configuration and excluded for apps that don't. |

### GITOPS-SW-028 — GitOps rejects invalid Android configuration keys / JSON

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Android
- **Preconditions:** A Premium Fleet with Android Enterprise connected and an Android app in a team.
- **Source:** #35666

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In the configuration JSON, use a top-level key other than `managedConfiguration` or `workProfileWidgets`, and run `fleetctl gitops`. | GitOps fails with the invalid-key error. |
| 2 | Provide malformed JSON in the configuration file and run `fleetctl gitops`. | GitOps fails reporting invalid JSON. |

### GITOPS-SW-029 — Edit configuration UI action is disabled in GitOps mode

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Android
- **Preconditions:** A Premium Fleet with GitOps mode ON and an Android app added to a team.
- **Source:** #35666

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the Android app's Software title page and open the Actions dropdown. | The "Edit configuration" option is disabled (GitOps mode), and is hidden entirely for Android items that have no software available to install. |

### GITOPS-SW-030 — Install software on Android BYOD enrollment via GitOps setup experience

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** A Premium Fleet with Android Enterprise connected, a team with BYOD enrollment, and setup-experience software configured for Android.
- **Source:** #35669

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add an Android app to setup experience via the team YAML and run `fleetctl gitops`. | The app is configured as setup-experience software for the team. |
| 2 | Manually enroll an Android device using the /enroll URL from the "Add hosts" modal. | After enrollment the app installs; it shows Installed on Host > Software > Library and the Installed count increments on the Software title page. |
| 3 | Repeat enrollment but disable the host's internet immediately after enrolling. | The app shows "Install (pending)" on Host > Software > Library and the Pending count increments on the Software title page. |
| 4 | Remove the Android app from the YAML and run `fleetctl gitops`. | The app is removed from "Available to install" and from setup-experience software; it is NOT uninstalled from any hosts. |

### GITOPS-SW-031 — Android setup-experience software respects team transfers and re-enrollment

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Android
- **Preconditions:** A Premium Fleet with Android Enterprise connected, Team A and Team B each with different setup-experience software configured via GitOps.
- **Source:** #35669

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enroll a personally-owned Android host to Team A. | Team A's setup-experience software installs. |
| 2 | Transfer the host to Team B (different software). | Team B's software is NOT installed on the transferred host. |
| 3 | Unenroll the host (remove work profile) and re-enroll it. | The setup-experience software is installed again on re-enrollment. |

### GITOPS-SW-032 — Reject adding a duplicate `.ipa` package by bundle identifier (UI/API/GitOps)

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** iOS/iPadOS
- **Preconditions:** A Premium Fleet with an installer (package, FMA, or App Store app) already added to a software title in a team, sharing the same bundle identifier as the `.ipa` to be added.
- **Source:** #34338

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Attempt to add an `.ipa` with the same bundle identifier via the UI. | The UI shows an error and the `.ipa` is not added. |
| 2 | Attempt the same via the API. | The API returns the corresponding error and rejects the add. |
| 3 | Attempt the same via GitOps (reference the `.ipa` in YAML and run `fleetctl gitops`). | GitOps fails with the bundle-identifier conflict error. |

### GITOPS-SW-033 — Add "Security" and "Utilities" software categories via GitOps and API

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** A Premium Fleet with software titles available to edit.
- **Source:** #37251

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Software > Details > Edit package / Edit app modal. | "Security" and "Utilities" appear in the list of selectable categories. |
| 2 | Assign the "Security" and/or "Utilities" categories to a package via the team YAML `categories` key and run `fleetctl gitops` (and/or via the API). | The new categories are accepted and applied to the software title. |

### GITOPS-SW-034 — Add a script-only package referencing a .sh file via GitOps

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** A Premium Fleet under GitOps control with a `.sh` script file committed in the repo.
- **Source:** #38659

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In the package YAML, add a script-only package whose `path` references the `.sh` file. Run `fleetctl gitops`. | GitOps accepts the `.sh` path and the script-only package is added to the correct team. |

### GITOPS-SW-035 — GitOps version pin takes precedence over a UI/API pin for an FMA

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** A Premium Fleet under GitOps control with an FMA added on a team and a real macOS host enrolled. The FMA is currently pinned via UI/API.
- **Source:** #38504

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Set a version pin for the FMA via the UI (Actions > Versions) or API `PATCH .../package`. | The pin is applied and reflected on the software title page. |
| 2 | Run `fleetctl gitops` with a team YAML that OMITS the `version:` field for the same FMA. | GitOps reconciles and the resulting source-of-truth is the GitOps state (the UI/API pin does not survive a GitOps apply that omits the field). |

### GITOPS-SW-036 — GitOps retries software download/upload on failure for bulk packages

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** A Premium Fleet under GitOps control. GitOps repo populated with many software items.
- **Source:** #39247

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add 20 Fleet-maintained apps to the GitOps repo and run `fleetctl gitops`. | All 20 FMAs are downloaded/uploaded and applied successfully; transient download/upload failures are retried rather than aborting the run. |
| 2 | Add 20 custom packages to the GitOps repo and run `fleetctl gitops`. | All 20 custom packages are applied successfully with retry-on-failure for downloads/uploads. |

### GITOPS-SW-037 — GitOps runs stay performant with 100+ software items across many teams

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** A Premium Fleet and a GitOps repo with 50+ packages (including hashes) across 500+ teams. An older `fleetctl` and a current `fleetctl` available for comparison.
- **Source:** #30385

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Run `fleetctl gitops` with the large repo using an older `fleetctl` and record the runtime. | Baseline runtime captured. |
| 2 | Run the same GitOps apply with a current `fleetctl` and record the runtime. | The run completes successfully and is measurably faster than the older `fleetctl` baseline. |

## First impressions via GitOps

### GITOPS-FI-001 — Add a Fleet-maintained app as a policy install-on-failure via GitOps

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Fleet Premium with a GitOps-managed team. The team's software YAML declares the Fleet-maintained app (e.g. Zoom for macOS) under `software.fleet_maintained_apps`. At least one enrolled macOS host on the team that does not yet have the app installed.
- **Source:** #36751

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In the team's policies YAML, add a `darwin` policy whose query detects the app (e.g. `SELECT 1 FROM apps WHERE bundle_identifier = 'us.zoom.xos'`) and set `install_software.fleet_maintained_app_slug: zoom/darwin`. | YAML references the Fleet-maintained app by its slug; no validation error in the file. |
| 2 | Apply the configuration with `fleetctl gitops -f <team>.yml`. | GitOps applies successfully with no errors; the Fleet-maintained app slug is accepted on the policy. |
| 3 | In the UI, open the team's Software tab. | The Fleet-maintained app (Zoom) appears as added software for the team. |
| 4 | Open the team's Policies tab and view the policy from step 1. | The policy shows software install automation enabled, targeting the Fleet-maintained app (Zoom). |
| 5 | Ensure a targeted macOS host fails the policy (app not installed) and wait for the next policy run / install to trigger. | Fleet automatically queues and installs the Fleet-maintained app on the failing host; after install the host passes the policy and the app appears in the host's software inventory. |

## Endpoint ops via GitOps

### GITOPS-EO-001 — Apply Fleet configuration from a GitOps repo with env-var-driven YAML

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** All
- **Preconditions:** A Fleet instance reachable by `fleetctl`; a clone of `fleetdm/fleet-gitops` with `default.yml`, `teams/*.yml`, `lib/agent-options.yml`, `lib/*.policies.yml`, and `lib/*.queries.yml`; a user with the `gitops` role; required environment variables (e.g. `FLEET_URL`, API token, and any vars referenced in the YAML files) exported in the shell.
- **Source:** #13643

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Reference environment variables (e.g. `$VAR` syntax) inside `default.yml`, `teams/*.yml`, `lib/agent-options.yml`, `lib/*.policies.yml`, and `lib/*.queries.yml`, then export those variables in the shell. | The referenced variables are defined and resolvable at apply time. |
| 2 | As the `gitops` user, apply the repo's default configuration (run `./workflow.sh` or `fleetctl gitops -f default.yml`). | Command succeeds; env-var placeholders in every file are interpolated with their values rather than applied literally. |
| 3 | Open the Fleet UI and inspect org settings, teams, agent options, policies, and queries. | UI reflects the applied configuration exactly, with env-var values resolved (org settings, team config, agent options, policies, and queries all match the YAML). |
| 4 | Run GitOps against a team that does not yet exist, then run again against the now-existing team with modified values. | First run creates the team; the second run updates the existing team in place over the prior config. |
| 5 | Apply a configuration containing an illegal/invalid value (e.g. a malformed agent option or a policy referencing a non-existent query). | `fleetctl gitops` fails with a validation error and no partial/invalid state is committed to Fleet. |
| 6 | Re-run GitOps with the corrected, legal configuration. | Command succeeds and the UI shows the corrected state. |

### GITOPS-EO-002 — Create teams and apple_bm_default_team in one run, and delete unmanaged teams

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A clean Fleet instance; `fleetctl` with `gitops` access; a global config YAML and one or more team config YAML files (per `fleetdm/fleet-gitops` reference layout).
- **Source:** #16677

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On a new Fleet instance, set `org_settings.mdm.apple_bm_default_team` in the global config to a team name that is defined in the accompanying team config, then run `fleetctl gitops -f global.yml -f team.yml` (global file first). | Single command succeeds: the team is created and `apple_bm_default_team` is set to that newly created team. |
| 2 | Run GitOps passing the global file plus only a subset of the existing team files, adding the `--delete-other-teams` switch. | Teams present in Fleet but absent from the supplied team configs are deleted; teams still specified are retained/updated. |
| 3 | Set `apple_bm_default_team` in the global config to a team name that does not exist (and is not created in this run), then run GitOps. | Command fails with a validation error indicating the referenced default team does not exist. |
| 4 | Set `apple_bm_default_team` to a team that the same `--delete-other-teams` run is about to remove, then run GitOps. | Command fails with a validation error; the default-team reference cannot point at a team being deleted. |
| 5 | Pass team files first (or omit the global file as the first argument) when supplying multiple `-f` files. | Command errors because the first file must be the global configuration. |

### GITOPS-EO-003 — Rename a team via GitOps and reconcile UI-side renames

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A Fleet instance; `fleetctl` with `gitops` access; a team YAML file (e.g. `myteam.yml`) defining a single team.
- **Source:** #18471, #19817

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Run `fleetctl gitops -f myteam.yml --dry-run`, then run it without `--dry-run`. | Dry run reports the team would be created without changing state; the real run creates the team with the YAML-defined name. |
| 2 | Change the team's `name` value inside `myteam.yml`, then run GitOps with `--dry-run` followed by the real run. | Dry run reports the rename; the real run renames the existing team (same team, new name) rather than creating a second team. |
| 3 | Rename the YAML file on disk from `myteam.yml` to `something_else.yml` (leaving the `name` key unchanged) and run GitOps (`--dry-run` then real). | No change occurs; the team is identified by its YAML `name`, not the filename. |
| 4 | Rename the team in the Fleet UI, then re-run the same GitOps config (`--dry-run` then real run). | GitOps succeeds (no enroll-secret collision error) and the team name is reset to match the YAML; the UI-side rename is overwritten. |

## Orchestration via GitOps

### GITOPS-ORCH-001 — GitOps reports clear type errors for invalid YAML field values

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet instance reachable; `fleetctl` configured with a global admin API token; a GitOps YAML file (e.g. `default.yml`) under version control.
- **Source:** #21973

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Populate every GitOps-editable field with valid data of its expected type and run `fleetctl gitops -f default.yml`. | Apply succeeds with no type errors. |
| 2 | Set a field to a value of the wrong type (e.g. a string where an integer/boolean is expected) and run `fleetctl gitops -f default.yml`. | Run fails with `Error: Couldn't edit <parent_key>. "<field_name>" must be a <expected_type>.` naming the offending key and expected type. |
| 3 | Repeat step 2 but run with `fleetctl gitops --dry-run -f default.yml`. | Same type error message is shown; no changes are applied. |

### GITOPS-ORCH-002 — Define and delete custom labels via GitOps YAML

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet instance reachable; `fleetctl` configured with a global admin API token; a `default.yml` under version control.
- **Source:** #24473

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add a label inline under the top-level `labels` key in `default.yml` and run `fleetctl gitops -f default.yml`. | Label is created in Fleet. |
| 2 | Move label definitions into a separate YAML file with two labels and reference that file from `labels` in `default.yml`; run GitOps. | Both labels exist in Fleet. |
| 3 | Include the `labels` key in `default.yml` but define no labels; run GitOps. | All labels are deleted from Fleet. |
| 4 | Remove the `labels` key entirely from `default.yml`, create a label in the UI, then run GitOps. | UI-created label still exists after the run (labels are not wiped when `labels` key is absent). |

### GITOPS-ORCH-003 — GitOps blocks deletion of a label still referenced by another entity

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Fleet instance reachable; `fleetctl` configured with a global admin API token; `default.yml` under version control.
- **Source:** #24473

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add a label in `default.yml`, reference it in a configuration profile's custom targets, and run GitOps. | Label is created and applied to the profile target. |
| 2 | Remove that label from `default.yml` while it is still referenced by the profile, and run GitOps. | Run fails with an error stating the label cannot be removed because it is still referenced. |
| 3 | Repeat with the label referenced in software-installer targets, then in query targets, removing it each time. | Each run fails with the same referenced-by error; the label is not deleted. |

### GITOPS-ORCH-004 — GitOps manual label resolves a mix of host identifiers

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet instance reachable with several enrolled hosts; `fleetctl` configured with a global admin API token; `default.yml` under version control.
- **Source:** #32014

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Define a manual label (`label_membership_type: manual`) with a `hosts` array of integer Fleet host IDs and run GitOps. | Label is created and the hosts with those IDs are members. |
| 2 | Edit the label's `hosts` array, adding and removing host IDs, then run GitOps again. | Label membership updates to match the new list. |
| 3 | Provide `hosts` entries as strings, including a mix of `hardware_serial`, `uuid`, and `hostname` values (plus integer IDs); run GitOps. | Only hosts matching by `id`, `hardware_serial`, `uuid`, or `hostname` are added to the label. |
| 4 | Reference the same host twice in `hosts` via two different identifiers (e.g. its `id` and its `uuid`); run GitOps. | Label is created and that host appears once as a single member. |

### GITOPS-ORCH-005 — GitOps returns clear errors for invalid manual-label configuration

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Fleet instance reachable; `fleetctl` configured with a global admin API token; `default.yml` under version control.
- **Source:** #32014

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Define a label specifying more than one of `query`, `hosts`, or `criteria` and run GitOps. | Run fails with a consistent, easy-to-understand error for every combination of the conflicting keys. |
| 2 | Specify `platform` together with `label_membership_type: manual`, then with `criteria`; run GitOps. | Run fails with an easy-to-understand error that `platform` is not valid with that membership type. |
| 3 | Specify an invalid `platform` value and run GitOps. | Run fails with an easy-to-understand error naming the invalid platform. |

### GITOPS-ORCH-006 — `fleetctl generate-gitops` emits manual labels using host IDs

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Fleet instance reachable; `fleetctl` configured with a global admin API token; at least one manual label whose members were added by various identifiers.
- **Source:** #32014

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Run `fleetctl generate-gitops project --dir <path>` on an instance that has a manual label. | The generated label YAML lists members in `hosts` as integer Fleet host IDs (not serials/uuids/hostnames). |

### GITOPS-ORCH-007 — Team-scoped GitOps user can apply only their team's files

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet Premium instance with at least Team A and Team B; team YAML files under version control; ability to create API-only users.
- **Source:** #26171

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Run `fleetctl gitops --help`. | Help output reflects current flags only (no removed/stale text). |
| 2 | Create an API-only user with the GitOps role scoped to a single team, then run `fleetctl gitops -f <team-a.yml>` as that user. | Apply succeeds for that team. |
| 3 | Change the team name in the YAML and run GitOps again as the same team-scoped user. | Run fails with `403 forbidden`. |
| 4 | As the same team-scoped user, run `fleetctl gitops -f <default.yml> -f <team-a.yml>` where `default.yml` contains org settings. | Run fails with `403 forbidden`. |
| 5 | Create an API-only GitOps user scoped to Team A and Team B and run `fleetctl gitops -f <team-a.yml> -f <team-b.yml>`. | Apply succeeds for both teams. |

### GITOPS-ORCH-008 — GitOps applies files atomically per-file up to the first unauthorized team

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Fleet Premium instance with Team A and Team B; an API-only GitOps user initially scoped to both teams; team YAML files under version control.
- **Source:** #26171

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Remove the user's access to Team B. Make a change to Team A's YAML and run `fleetctl gitops -f <team-a.yml> -f <team-b.yml>`. | Run fails with `403 forbidden`, but the change to Team A has already been applied (files processed in order). |
| 2 | Make another change to Team A's YAML and run the files in the opposite order: `fleetctl gitops -f <team-b.yml> -f <team-a.yml>`. | Run fails with `403 forbidden` before reaching Team A; the Team A change is not applied. |

### GITOPS-ORCH-009 — API-only user activities use the dedicated API-only avatar

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Fleet instance reachable; an API-only user with no gravatar configured used to run GitOps; ability to switch between an older Fleet build and the build with this feature, and to run data migration.
- **Source:** #27457

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On an older build, run GitOps as the API-only user, then view the activity feed. | Activities show the generic default user avatar. |
| 2 | Switch to the build with this feature and migrate data; view the prior GitOps activities. | Those activities now show the API-only user avatar and carry `actor_api_only: true`. |
| 3 | Run GitOps again on the new build. | New activities use the API-only avatar and have `actor_api_only` set to `true`. |
| 4 | Configure a gravatar for the API-only user and run GitOps again. | New activities display the configured gravatar instead of the API-only avatar. |

### GITOPS-ORCH-010 — Export current Fleet configuration into best-practice GitOps YAML (Premium)

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet Premium instance configured via UI with modified global settings, at least one label, global and team policies/queries, a configuration profile, a script, and a software package; `fleetctl` configured with a global admin API token; an empty target directory.
- **Source:** #27476

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Run `fleetctl generate-gitops project --dir <path>`. | Global settings, the label, global policies and global queries appear in `default.yml`; each team has a file at `teams/<team name>.yml`. |
| 2 | Inspect the generated team file. | Team policies/queries are listed; the profile and script are listed under `controls` and point to files in `lib/<team name>/...` whose contents match the UI uploads; the software package is listed under `software` pointing to an S3 URL. |
| 3 | Run the exact same command again against the same `<path>`. | Command errors because the directory is not empty. |
| 4 | Run `fleetctl gitops` against the freshly generated project without enroll secrets. | Run errors reporting missing enroll secrets. |
| 5 | Add enroll secrets to each `default.yml`/`<team name>.yml` and run `fleetctl gitops`. | Apply succeeds and no existing configuration is modified (export was accurate). |

### GITOPS-ORCH-011 — Export GitOps YAML on Fleet Free has no teams directory content

- **Tier:** Free
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Fleet Free instance configured via UI with modified global settings, at least one label, and at least one global policy and query; global admin API token configured. Separately, a team-scoped user with an API token.
- **Source:** #27476

| # | Step | Expected result |
|---|------|-----------------|
| 1 | As a global admin, run `fleetctl generate-gitops project --dir <path>`. | Global settings, the label, and global policies/queries are written to `default.yml`. |
| 2 | Inspect the generated `lib/` directory. | Because Fleet Free has no teams, `lib/` contains only a README and no team files. |
| 3 | As a team-scoped (non-global-admin) user, run `fleetctl generate-gitops project --dir <path>`. | Command errors with Forbidden. |

### GITOPS-ORCH-012 — Add, replace, and remove software icons via GitOps

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet Premium instance reachable; `fleetctl` configured with a global admin API token; GitOps project with at least one `software.packages` entry and one `software.app_store_apps` entry, plus an icon image file in the repo.
- **Source:** #31897

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add an `icon` field referencing the image file under a software package (`lib/software-name.package.yml` > `icon`) and run GitOps. | The software package shows the custom icon in Fleet. |
| 2 | Add the `icon` field under an App Store app (`software.app_store_apps.icon`) and run GitOps. | The App Store app shows the custom icon in Fleet. |
| 3 | Remove the `icon` field from the software package and the App Store app and run GitOps. | The custom icons are removed and the software reverts to its default icon. |
| 4 | Reference the same icon file from software packages across multiple teams and run GitOps. | The icon is applied to each package on each team; the run does not slow significantly and does not leave excessive temporary files (e.g. in `/tmp`). |

### GITOPS-ORCH-013 — Generated GitOps YAML includes previously uploaded icons

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Fleet Premium instance with software that has custom icons uploaded via the UI, including the same icon reused across teams/packages; `fleetctl` configured with a global admin API token.
- **Source:** #31897

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Run `fleetctl generate-gitops project --dir <path>`. | Previously uploaded icons are downloaded and referenced via the `icon` field for each software package/App Store app, with shared icons handled correctly across teams/packages. |
| 2 | In the GitOps generation modal, review the icon-related fields. | The `icon` field and an icon download link are present in the modal. |
| 3 | Reapply the generated project with `fleetctl gitops`. | All icons are re-added to the corresponding software in Fleet, matching the original UI state. |

### GITOPS-ORCH-014 — Best-practice fleet-gitops scaffold runs once every 24 hours

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Access to the official `fleet-gitops` template repositories on both GitHub and GitLab.
- **Source:** #30397

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the `fleet-gitops` GitHub repo and inspect the scheduled workflow (cron) configuration. | The GitOps job is scheduled to run once per day (every 24 hours). |
| 2 | Open the `fleet-gitops` GitLab repo and inspect its scheduled pipeline configuration. | The GitOps job is scheduled to run once per day (every 24 hours). |

## MDM via GitOps

### GITOPS-MDM-001 — Deploy scripts and profiles containing Fleet secret variables via GitOps

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** macOS MDM and Windows MDM turned on; at least one macOS host (with Apple config + DDM profiles in scope) and one Windows host enrolled; GitOps repo configured with scripts and configuration profiles that reference Fleet secret variables (e.g. `$FLEET_SECRET_ONE`); the referenced secrets exported in the environment (e.g. `export FLEET_SECRET_ONE=foo`)
- **Source:** #23238

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Confirm the GitOps config references Fleet secret variables inside Apple config profiles, Apple DDM profiles, Windows profiles, and scripts (including scripts used in software install/uninstall flows). | Files contain `$FLEET_SECRET_*` placeholders rather than literal secret values. |
| 2 | Export the matching secret values in the environment and run `fleetctl gitops -f <file>`. | Apply succeeds with no errors; secret variables are resolved server-side. |
| 3 | Wait for devices to check in and refresh. | Profiles and scripts deploy to the targeted macOS and Windows hosts; OS settings for the affected profiles reach the Verified state. |

### GITOPS-MDM-002 — Mask Fleet secret values on profile and script download/view

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Scripts and configuration profiles containing Fleet secret variables have been deployed via GitOps (per the deploy case)
- **Source:** #23238

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In the Fleet UI (or via API), download the deployed configuration profiles. | Downloaded files show the `$FLEET_SECRET_*` variable references, not the resolved secret values. |
| 2 | View or download the deployed scripts (including those used in software install/uninstall flows). | Script contents show the `$FLEET_SECRET_*` references, never the actual secret values. |

### GITOPS-MDM-003 — Reject GitOps apply referencing an unknown Fleet secret

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** macOS/Windows MDM on; a GitOps config containing a profile or script that references a Fleet secret variable that does not exist in Fleet (e.g. the secret was deleted from the database or never created)
- **Source:** #23238

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Run `fleetctl gitops -f <file>` with the config that references the unknown secret. | Apply fails with a clear error message identifying the missing/unknown secret variable; no profiles or scripts are deployed from the invalid apply. |

### GITOPS-MDM-004 — Redeploy Apple profiles when only the secret value changes in GitOps

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Apple config profiles and DDM profiles containing Fleet secret variables already deployed and Verified on a macOS host via GitOps
- **Source:** #23238

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Change the exported secret value(s) (e.g. `export FLEET_SECRET_ONE=bar`) while leaving the profile files themselves unchanged. | New secret value is staged in the environment. |
| 2 | Re-run `fleetctl gitops -f <file>`. | Apply succeeds; the affected Apple config and DDM profiles are redeployed to the device with the new secret value (Windows profiles are not redeployed on secret-only change). |
| 3 | Wait for the macOS host to refresh. | Profiles return to Verified reflecting the updated secret value. |

### GITOPS-MDM-005 — Remove secret-bearing profiles and scripts from devices via GitOps

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Apple config/DDM profiles and scripts containing Fleet secret variables already deployed via GitOps to a macOS host
- **Source:** #23238

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Change the secret variable values and remove the corresponding profiles and scripts from the GitOps config. | Config no longer references the items. |
| 2 | Run `fleetctl gitops -f <file>`. | Apply succeeds. |
| 3 | Wait for the macOS host to refresh and inspect its OS settings. | The removed profiles and scripts are deleted from Fleet and removed from the device. |

### GITOPS-MDM-006 — Add an EULA via GitOps for automatic enrollment

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows
- **Preconditions:** macOS and Windows MDM turned on with automatic (ADE) enrollment configured; GitOps repo with a EULA PDF placed in the `lib` folder
- **Source:** #28143, #27607

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Reference the EULA PDF from the `lib` folder in `org_settings.mdm.end_user_license_agreement` and run `fleetctl gitops -f <file>`. | Apply succeeds; the EULA document is uploaded to Fleet. |
| 2 | Automatically enroll a macOS host via ADE. | The EULA is displayed during the macOS Setup Assistant / enrollment flow. |
| 3 | Automatically enroll a Windows host via automatic enrollment. | The EULA is displayed during the Windows enrollment flow. |

### GITOPS-MDM-007 — Block UI EULA upload while GitOps mode is enabled

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** GitOps mode enabled for the instance; admin logged in to the Fleet UI
- **Source:** #28143

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to the end user authentication / EULA upload setting in the Fleet UI. | The EULA upload button is disabled. |
| 2 | Hover over the disabled upload control. | A tooltip indicates the setting is managed via GitOps. |

### GITOPS-MDM-008 — Delete the EULA by removing it from GitOps org settings

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** A EULA previously added via GitOps and present in Fleet
- **Source:** #28143

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Remove `end_user_license_agreement` from `org_settings.mdm` in the GitOps config and run `fleetctl gitops -f <file>`. | Apply succeeds. |
| 2 | Check the EULA configuration in Fleet. | The EULA is deleted from Fleet and no longer presented during automatic enrollment. |

## generate-gitops
_TBD — populated when mining the orchestration/MDM/settings areas._

## Workflow execution (GitHub / GitLab)
_TBD._
