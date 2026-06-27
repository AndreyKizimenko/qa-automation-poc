# MDM — test cases

> Area: `#g-mdm`. Derived from Fleet feature-story test plans
> (oldest→newest, superseded behavior collapsed). GitOps flows live in
> [`gitops.md`](gitops.md). See [`README.md`](README.md) for method/template.
> Not yet live-verified.

## Scripts Library & Execution

### MDM-SCRIPTS-001 — Restrict scripts library access to Premium licenses

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A Fleet instance is available; have both a free instance and a paid (Premium) instance to compare.
- **Source:** #9537

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Log in to a free Fleet instance and navigate to Controls. | The Scripts tab/upload capability is gated behind a paid license; the upgrade/paywall copy matches the designs. |
| 2 | Log in to a Premium (paid license) Fleet instance and navigate to Controls. | The Scripts feature is fully accessible. |

### MDM-SCRIPTS-002 — Upload, download, and delete scripts in the scripts library

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Premium instance with MDM turned on; logged in as Admin or Maintainer (global or team).
- **Source:** #9537, #15283

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to Controls > Scripts. | The Scripts tab is present with a Teams dropdown; each team (and "No team") shows its own assigned scripts. |
| 2 | With MDM turned off for the selected team, view the Scripts tab. | A prompt to turn on MDM appears with copy matching the designs. |
| 3 | With MDM turned on, click Upload and select a `.sh`, `.ps1`, or `.py` file. | The upload succeeds and a success message matching the designs is shown. |
| 4 | Attempt to select a file with any other extension. | The file cannot be selected/uploaded; a failure message matching the designs is shown. |
| 5 | Confirm the uploaded script appears in the library list. | The script is listed with an icon distinguishing shell (.sh), PowerShell (.ps1), and Python (.py) types. |
| 6 | Click the Download action on a script. | The original script file downloads. |
| 7 | Click the Delete action on a script and confirm in the modal. | A confirmation modal opens; completing it removes the script from the library. |

### MDM-SCRIPTS-003 — Restrict scripts library editing to Admins and Maintainers

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Premium instance with MDM on; user accounts for each role (Admin, Maintainer, Observer/Observer+, plus team-scoped variants).
- **Source:** #9537

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Log in as Admin or Maintainer (global or team) and open Controls > Scripts. | Upload, download, and delete controls are available. |
| 2 | Log in as Observer or Observer+ and open Controls > Scripts. | The upload/delete capability is not available; matching the role permissions used for macOS profiles. |
| 3 | As a Team Admin/Maintainer, switch the Teams dropdown. | Only scripts for teams the user manages can be modified. |

### MDM-SCRIPTS-004 — Run a saved script on a host via the Actions menu

- **Tier:** Both
- **Priority:** P0
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** A host enrolled with scripts enabled; one or more scripts saved to the host's team (or "No team").
- **Source:** #15529, #9537

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Host details for the host and open the Actions menu. | A "Run script" item is shown in the Actions menu (no separate Scripts tab). |
| 2 | Click "Run script". | A modal opens listing all scripts assigned to the host's team, each with a status column. |
| 3 | Review the status column for a script that has never run. | The status displays `---`. |
| 4 | Select a script and choose Run. | A loading state displays, the modal closes, and a success or failure message matching the designs is shown. |
| 5 | After execution, open the script's details. | The Script details modal displays the script contents and its output. |
| 6 | Reopen the Run script modal and review statuses. | The script shows a status of Ran, Pending, or Error; the status tooltip copy matches the designs. |

### MDM-SCRIPTS-005 — Run a script on an offline host (queued as upcoming activity)

- **Tier:** Both
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** A host enrolled with scripts enabled and currently offline; a script saved to its team.
- **Source:** #15529

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Host details for the offline host and open the Actions menu. | "Run script" is available even though the host is offline. |
| 2 | Run a saved script against the offline host. | The script is queued; its status shows Pending with the updated tooltip copy from the designs. |
| 3 | Open the Host details Activity feed and select the Upcoming tab. | The queued script appears under Upcoming, ordered by time the command was sent, with no timestamp, and the "Activities run as listed" tooltip is present. |
| 4 | Confirm the Upcoming tab shows a count badge. | A count badge is displayed because at least one script is queued. |
| 5 | Bring the host back online and wait for check-in. | The queued script runs; it moves from the Upcoming tab to the Past tab with a Ran/Error status. |

### MDM-SCRIPTS-006 — Show scripts activity in the host details Past and Upcoming feeds

- **Tier:** Both
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** A host enrolled with scripts enabled; ability to add/edit/delete and run scripts.
- **Source:** #15529, #9537

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Host details and view the Activity feed. | The feed defaults to the Past tab and displays 8 items per page; the Past tab shows a loading state. |
| 2 | Switch to the Upcoming tab when nothing is queued. | No count badge is shown and the tab has no loading state. |
| 3 | Add, edit (via fleetctl), delete, and run a script. | Corresponding "script added", "script edited", "script deleted", and "script ran" entries appear in the global and host activity feeds. |
| 4 | Open a "script ran" activity entry. | The entry exposes the script details and output. |
| 5 | Resize the page to different widths. | The Activity feed remains responsive and matches the designs at each width. |

### MDM-SCRIPTS-007 — Run scripts and upload script library on Fleet Free

- **Tier:** Free
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** A Fleet Free instance with an enrolled host and scripts enabled.
- **Source:** #15529, #38793

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On a Fleet Free instance, navigate to the scripts library and upload a script. | Script upload is supported on Fleet Free. |
| 2 | Open Host details for a macOS or Linux host and use the Actions menu to run a saved script. | The script runs successfully and returns output on Fleet Free. |
| 3 | Upload and run a Python (.py) script on a macOS and a Linux host on Fleet Free. | The Python script executes and returns output on both hosts. |

### MDM-SCRIPTS-008 — Manage scripts library and execution via CLI/GitOps

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Premium instance with MDM on; fleetctl/GitOps configured; logged in as Admin or Maintainer.
- **Source:** #9537, #38793

| # | Step | Expected result |
|---|------|-----------------|
| 1 | As an Admin or Maintainer (including team), apply a YAML config that adds a script targeting "No team". | The script is added to the "No team" library. |
| 2 | Apply a YAML config that adds scripts to specific teams, then edit and delete a script via YAML. | Scripts are added, edited, and deleted for the targeted teams as configured. |
| 3 | Add a Python script via GitOps to both "No team" and a team, then execute it on a host. | The Python script is created in both scopes and runs successfully on the host. |
| 4 | Verify the same role permissions as the UI apply to CLI/API. | Only Admins and Maintainers (including team-scoped) can manage scripts; observers cannot. |

### MDM-SCRIPTS-009 — Reject invalid scripts on upload

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Premium instance with MDM on; access to the scripts library via UI, API, and GitOps.
- **Source:** #9537, #38793

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add a shell script that does not begin with `#!/bin/sh`. | The upload is rejected with an error. |
| 2 | Add a script with a name that duplicates an existing script. | The upload is rejected with a duplicate-name error. |
| 3 | Reference a script file that does not exist (via CLI). | The apply fails reporting the missing file. |
| 4 | Add a script larger than 10,000 characters. | The upload is rejected with a size error. |
| 5 | Upload a `.py` script with an invalid shebang (e.g. python2) and a `.py` script with no shebang. | Both are rejected; the GitOps/API/UI error messages match what is outlined in the PR. |

### MDM-SCRIPTS-010 — Enforce the 5-minute script execution timeout

- **Tier:** Both
- **Priority:** P1
- **Platforms:** macOS | Linux
- **Preconditions:** A host enrolled with scripts enabled; a saved script that runs longer than the timeout.
- **Source:** #15196, #38793

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Review the scripts timeout copy in the UI and CLI. | The copy reflects the 5-minute timeout and matches the designs. |
| 2 | Run a script designed to run longer than 5 minutes from the UI on a macOS or Linux host. | The script is cancelled at the timeout and the output reflects the timeout behavior. |
| 3 | Run the same long-running script (including a Python script) from the CLI. | The script is cancelled at the 5-minute timeout; output reflects the timeout behavior. |
| 4 | Run scripts that complete within the limit. | No regression in normal scripts execution; scripts complete and report output as expected. |

### MDM-SCRIPTS-011 — Run a Python script via policy automation and batch execution

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Linux | Windows
- **Preconditions:** Premium instance; Python script saved to the library; macOS, Linux, and Windows hosts enrolled with scripts enabled; a policy configured for automation.
- **Source:** #38793

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Configure a Python script as a Policy Automation and trigger the policy on a macOS and a Linux host. | The Python script runs and reports output on both hosts when the policy triggers. |
| 2 | Use the batch scripts feature to run a Python script on two or more hosts at once. | The script runs successfully on all selected hosts. |
| 3 | Use batch scripts to run a Python script targeting a macOS, a Windows, and a Linux host together. | The script runs on the macOS and Linux hosts and is marked incompatible on the Windows host. |
| 4 | Add custom variables to Fleet and run a Python script referencing them. | The variables are correctly substituted in the executed Python script. |

### MDM-SCRIPTS-012 — Block Python scripts in setup experience and payload-free packages

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | Linux
- **Preconditions:** Premium instance with a Python script available and setup experience configurable.
- **Source:** #38793

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Attempt to add a Python script to the setup experience. | The action is blocked. |
| 2 | Attempt to define a Python script as a payload-free package. | The action is not allowed. |
| 3 | Run a Python script that uses a feature unsupported by the host's installed Python version. | The script attempts to run and returns the same error Python returns directly; it does not hang indefinitely or mask the failure reason. |

### MDM-SCRIPTS-013 — Turn off Windows MDM and remove fleetd via library scripts

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Windows
- **Preconditions:** Premium instance with Windows MDM on; a Windows host enrolled in Fleet with Fleet configured as the MDM provider; `windows-unenroll-mdm.ps1` and `windows-remove-fleetd.ps1` uploaded to the scripts library.
- **Source:** #15689

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the Windows host, open Settings > Accounts > Access work or school. | Fleet is listed as the configured MDM provider. |
| 2 | In Fleet, open the Windows host details and run `windows-unenroll-mdm.ps1`. | A pop-up appears on the host stating the MDM provider has removed the connection. |
| 3 | Reopen Settings > Accounts > Access work or school on the host (reopening the window if needed). | Fleet is no longer listed as the MDM provider. |
| 4 | In Fleet, view the script status and details. | The script shows "Ran" with successful script output. |
| 5 | In Fleet, run `windows-remove-fleetd.ps1` on the host. | The script is sent to the host. |
| 6 | On the Windows host, check the tray, processes, and services. | The Fleet desktop tray icon is gone; `osqueryd` and `orbit` are not in processes; "Fleet osquery" is not in services. |
| 7 | Back in Fleet, observe the `windows-remove-fleetd.ps1` script status. | The script remains stuck at "Pending" and never returns a result because fleetd has been uninstalled. |

## OS Updates & Disk Encryption

### MDM-OSUPDATES-001 — Enforce Windows OS updates with deadline and grace period via UI

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** Premium license; Windows MDM turned on; at least one Windows host enrolled and assigned to the target team (or "No team"); signed in as an admin/maintainer.
- **Source:** #11951

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to Controls > OS updates with no enforcement configured for the team. | Zero-state is shown matching the design (no minimum version/deadline set). |
| 2 | Enable OS update enforcement for the team and enter a valid deadline and grace period, then save. | Settings save successfully; the configured deadline and grace period are reflected in the UI. |
| 3 | Open the global Activity feed. | An activity entry records that the admin enforced/edited Windows OS updates for the team. |
| 4 | On an enrolled Windows host past the deadline, observe update behavior. | The OS update is enforced on the device per the configured deadline and grace period. |

### MDM-OSUPDATES-002 — Configure Windows OS update enforcement via CLI (YAML)

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Windows
- **Preconditions:** Premium license; Windows MDM turned on; fleetctl configured with admin or maintainer credentials.
- **Source:** #11951

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Apply a YAML config that sets the Windows OS update minimum/enforcement, deadline, and grace period for a team via fleetctl. | The config applies successfully and the values appear in Controls > OS updates for that team. |
| 2 | Open the global Activity feed. | An activity entry records the OS updates enforcement change. |

### MDM-OSUPDATES-003 — Reject invalid Windows OS update deadline and date values

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Windows
- **Preconditions:** Premium license; Windows MDM turned on; admin/maintainer signed in; Controls > OS updates open for a team.
- **Source:** #11951

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enter an invalid deadline value (e.g. out of allowed range) and attempt to save. | Save is blocked and a validation error is displayed; no enforcement change is recorded. |
| 2 | Enter an invalid/malformed date and attempt to save. | Save is blocked and a validation error is displayed. |
| 3 | On the enrolled Windows host, attempt to circumvent the enforced update as an end user. | The end user cannot bypass the enforced OS update. |

### MDM-OSUPDATES-004 — Enforce BitLocker disk encryption and escrow the recovery key on Windows hosts

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** Windows
- **Preconditions:** Premium license; Windows MDM turned on; at least one Windows host enrolled to a team; admin signed in.
- **Source:** #12577

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to Controls > OS settings > Disk encryption and verify the copy and "Learn more" link. | Disk encryption copy references FileVault (FV2) and BitLocker; the "Learn more" link points to the correct docs. |
| 2 | Enable disk encryption for the team. | The setting is enabled; an activity feed entry records that the admin enforced disk encryption. |
| 3 | Review the Controls disk-encryption table and host counts. | Table is no longer sortable, splits macOS and Windows hosts into separate columns, shows correct combined counts, and host-count tooltips are correct; the "See all hosts" link opens the filtered "OS settings" host view. |
| 4 | Wait for the Windows host to encrypt, then open Host details > OS settings for that host. | Windows host shows OS settings with the same statuses available for macOS (Pending/Verifying/Verified/Failed); clicking a status opens a modal that closes via Done; tooltip copy matches design. |
| 5 | Open the encryption key modal for the Windows host. | Modal shows Windows-specific copy, links to the correct docs, and the BitLocker recovery key can be viewed/copied; closes via Done. |
| 6 | View the encryption key and check the activity feed. | An activity feed entry records that the encryption key was viewed. |
| 7 | As the end user on the Windows host, attempt to turn off BitLocker; then have the Fleet admin turn encryption off. | End user cannot disable encryption while enforced; when the admin turns encryption off in Fleet, the host's encryption status updates correctly. |

### MDM-OSUPDATES-005 — Enforce disk encryption cross-platform via YAML key

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | Windows
- **Preconditions:** Premium license; MDM turned on for the relevant platform(s); fleetctl configured with admin credentials.
- **Source:** #12577

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Apply a YAML config using `mdm.enable_disk_encryption: true` for a team (and for "No team"). | Disk encryption is enforced for both macOS and Windows hosts on the target team/No team. |
| 2 | Apply a YAML config using the legacy `mdm.macos_settings.enable_disk_encryption: true` key. | The legacy key is still honored and enables disk encryption. |

### MDM-OSUPDATES-006 — Rotate and escrow FileVault key over a pre-existing third-party FileVault profile

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Premium license; macOS MDM turned on; a macOS host that already has a custom FileVault configuration profile deployed by a prior MDM (e.g. MicroMDM); disk encryption enforcement enabled in Fleet.
- **Source:** #13157

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enforce disk encryption in Fleet for the team without first removing the host's old third-party FileVault profile. | Fleet installs its managed FileVault profile over the existing one without requiring removal of the old profile. |
| 2 | Watch the host's disk encryption status in Host details > OS settings as it progresses. | The IT admin sees the disk-encryption statuses transition correctly (Pending, Verifying, Verified) and the key is escrowed to Fleet. |
| 3 | On the host, log the end user out and back in. | The expected end-user experience occurs (any prompt/pop-up behavior is as documented) and FileVault remains enforced with the key escrowed. |

### MDM-OSUPDATES-007 — Show error directing to Disk encryption page when a custom profile contains disk-encryption settings

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | Windows
- **Preconditions:** Premium license; MDM turned on; admin signed in; configuration profiles ready that contain FileVault (macOS) and BitLocker (Windows) disk-encryption settings, plus an unrelated valid profile and a CSP file.
- **Source:** #24862

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In Controls > OS settings > Custom settings, upload a configuration profile that includes FileVault disk-encryption settings. | Upload is rejected with an error message whose copy directs the user to the Disk encryption page. |
| 2 | Upload a configuration profile that includes BitLocker disk-encryption settings. | Upload is rejected with an error message directing the user to the Disk encryption page. |
| 3 | Upload an unrelated valid configuration profile and a CSP file. | Both upload successfully. |
| 4 | Repeat the disk-encryption profile upload via the API and via GitOps. | The API returns the same restriction error message; GitOps surfaces the same API error message. |

### MDM-OSUPDATES-008 — Warn that disk encryption keys are deleted when transferring or deleting hosts

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | Windows
- **Preconditions:** Premium license; one or more enrolled hosts with escrowed disk encryption keys; admin signed in.
- **Source:** #25656

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On Host details, open the "Transfer host" modal for a single host. | Modal copy includes the warning that the disk encryption key will be deleted, matching the design (singular). |
| 2 | On the Hosts list, select multiple hosts and open the "Transfer hosts" modal; then repeat with a single host selected. | Copy matches design for the plural (multiple hosts) and singular (one host) cases respectively. |
| 3 | On Host details, open the "Delete host" modal for a single host. | Modal copy includes the disk-encryption-key warning matching the design (singular). |
| 4 | On the Hosts list, select multiple hosts and open the "Delete host" modal; then repeat with a single host selected. | Copy matches design for the plural and singular cases respectively. |

### MDM-OSUPDATES-009 — End user cannot bypass FileVault enforcement on a manually-enrolled Mac

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Premium license; macOS MDM turned on with disk encryption enforced for the team; a macOS host that the end user turned on MDM for manually.
- **Source:** #29250

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the manually-enrolled Mac with FileVault enforced, have the end user log out or restart. | The end user is required to turn on disk encryption to log in; they cannot bypass FileVault enforcement to get back to work. |

### MDM-OSUPDATES-010 — Allow custom OS updates and disk encryption profiles via experimental server config

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | Windows
- **Preconditions:** Premium license; MDM turned on; ability to set Fleet server environment configuration and restart; configuration profiles prepared with the custom OS-updates / FileVault / BitLocker payloads normally restricted.
- **Source:** #33316

| # | Step | Expected result |
|---|------|-----------------|
| 1 | With `FLEET_MDM_ENABLE_CUSTOM_OS_UPDATES_AND_FILEVAULT` unset/false, attempt to add a configuration profile containing the restricted OS-updates/disk-encryption payloads via the UI, API, and GitOps. | Each method rejects the profile with an easy-to-understand error message. |
| 2 | Set `FLEET_MDM_ENABLE_CUSTOM_OS_UPDATES_AND_FILEVAULT=true` and restart the server, then re-add the same profiles via the UI, API, and GitOps. | The profiles are accepted via all three methods. |
| 3 | Deploy a custom FileVault-enforcement profile to a macOS host and a custom Windows OS-updates profile to a Windows host. | Profiles deploy successfully; FileVault is forced at Mac setup and the Windows OS-update settings are enforced as specified by the payloads. |
| 4 | On a Fleet Free instance, attempt to upload a FileVault profile or an OS-updates declaration. | The upload is not allowed on Fleet Free regardless of the server config flag. |

### MDM-OSUPDATES-011 — Apple OS update deadline enforced at 7 PM local time

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | iOS/iPadOS
- **Preconditions:** Premium license; Apple MDM turned on; macOS, iOS, and iPadOS hosts enrolled; admin signed in.
- **Source:** #38834

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Controls > OS updates and review the deadline tooltip on the macOS, iOS, and iPadOS tabs. | Tooltip copy states the update deadline is 7 PM local time. |
| 2 | On a Fleet instance previously configured (on an old version) with a 12 PM deadline, upgrade Fleet and inspect the deadline without changing anything. | The deadline remains 12 PM until the user changes the deadline or OS version, or runs GitOps. |
| 3 | Change the deadline or OS version (or run GitOps) on the upgraded instance. | The deadline updates to 7 PM local time. |
| 4 | On enrolled macOS, iOS, and iPadOS hosts past the deadline, observe enforcement at 7 PM local time. | The host receives a forced OS update at 7 PM local time (not merely delivery of the DDM profile). |

### MDM-OSUPDATES-012 — Only update new Apple hosts below the minimum OS version during enrollment

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | iOS/iPadOS
- **Preconditions:** Premium license; Apple MDM turned on; ability to enroll fresh macOS/iOS/iPadOS hosts at chosen OS versions; admin signed in to Controls > OS updates.
- **Source:** #39713

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Leave the minimum macOS version unset, check "update new hosts", then enroll a Mac running a version below the latest. | The Mac is updated to the latest version during enrollment. |
| 2 | Leave the minimum macOS version unset, check "update new hosts", then enroll a Mac already on the latest macOS. | The Mac is not prompted to update during enrollment. |
| 3 | Set a minimum macOS version and uncheck "update new hosts", then enroll a Mac below that minimum. | The Mac is not updated during enrollment but is prompted to update after enrollment. |
| 4 | Set a minimum macOS version below the latest, check "update new hosts", then enroll a Mac below the minimum. | The Mac is updated to the latest macOS version during enrollment. |
| 5 | Set a minimum macOS version below the latest, check "update new hosts", then enroll a Mac at or above the minimum. | The Mac is not updated during enrollment. |
| 6 | Set minimum iOS/iPadOS versions, uncheck "update new hosts" on the macOS tab, then enroll iOS/iPadOS devices below the minimum. | The iOS/iPadOS devices are updated as part of enrollment. |

### MDM-OSUPDATES-013 — Reject non-existent OS versions and bad dates in Apple OS update settings

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | iOS/iPadOS
- **Preconditions:** Premium license; Apple MDM turned on; admin signed in to Controls > OS updates; fleetctl/GitOps available.
- **Source:** #39713

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In the UI, set a macOS, iOS, or iPadOS minimum version that does not appear in Apple's available versions list (gdmf) and save. | Save is blocked with the specified error indicating the version is not available. |
| 2 | Set the same non-existent version via GitOps. | GitOps fails with the equivalent error message. |
| 3 | Enter an invalid/bad deadline date for macOS, iOS, or iPadOS and attempt to save. | Save is blocked with the specified date validation error. |

## Configuration Profiles & OS Settings

### MDM-PROFILES-001 — Deploy MDM configuration profiles to 2,500 macOS hosts without APNs rate limiting

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** macOS MDM turned on in the test environment; 2,500 macOS hosts enrolled (manual enrollment) and all assigned to the same team.
- **Source:** #11997

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Confirm all 2,500 hosts report MDM status `On (manual)` in Fleet | Every host shows `On (manual)`; none are missing or errored |
| 2 | In Controls > OS settings > Custom settings, upload a valid `.mobileconfig` to the team holding the test hosts | Profile is accepted and begins deploying to all 2,500 hosts |
| 3 | Monitor profile delivery in the Fleet UI and via live query across the fleet | Profiles reach Verifying/Verified on hosts; UI counts and live query agree |
| 4 | Inspect server logs and APNs responses during the rollout | No APNs rate limit is exceeded; any errors are identifiable as load-test artifacts, not delivery failures |

### MDM-PROFILES-002 — Upload, target, and manage Windows custom configuration profiles (.xml)

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** Windows MDM turned on; at least one Windows host enrolled; signed in as Admin or Maintainer.
- **Source:** #13281

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In Controls > OS settings > Custom settings (with a team or "No team" selected), upload a valid `.xml` profile | Upload succeeds; profile name is pulled from the XML file; success toast matches copy |
| 2 | Attempt to upload a BitLocker profile and a Windows OS-updates profile | Both are rejected with an error (these are managed elsewhere) |
| 3 | Verify host counts/statuses for the profile and follow the Controls page status link | Counts/statuses are accurate; link opens the correctly filtered Hosts view |
| 4 | Download and then delete the profile | Download returns the original file; delete shows confirmation copy and removes the profile |
| 5 | Transfer a host with the profile to another team | Profile stays on the device but no longer appears in that host's OS settings status |
| 6 | As a non-Admin/Maintainer role, attempt to upload | Upload controls are unavailable; permissions match macOS profile behavior |

### MDM-PROFILES-003 — Surface targeted-label count and manage label targeting on profile rows

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | Windows
- **Preconditions:** MDM on; at least one label exists; a configuration profile uploaded with one or more labels targeted.
- **Source:** #14715

| # | Step | Expected result |
|---|------|-----------------|
| 1 | View the profiles list for a profile that targets one or more labels | The row shows a count of applied labels |
| 2 | Hover over the profile row | Download, delete, and a filter (labels) icon appear on hover |
| 3 | Click the filter icon | A modal opens listing the targeted labels for that profile |
| 4 | Delete a label that is used to target the profile | The profile row surfaces a "broken"/error state and the profile is no longer deployed to newly matching hosts |

### MDM-PROFILES-004 — Use computer name, serial number, and UUID as variables in macOS configuration profiles

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** macOS MDM on; at least one macOS host enrolled.
- **Source:** #16958

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Create a `.mobileconfig` that references the supported variables for computer name, serial number, and host UUID | Profile uploads successfully with the variables present |
| 2 | Deploy the profile to a macOS host | Profile reaches Verifying/Verified on the host |
| 3 | Inspect the installed profile on the host (System Settings > Device Management) | Each variable is replaced with that host's actual computer name, serial number, and UUID |

### MDM-PROFILES-005 — Target configuration profiles by excluding hosts that have any label

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows
- **Preconditions:** MDM on; existing and newly created labels assigned to hosts.
- **Source:** #17315

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Upload a profile using "exclude any" with an existing label | Hosts that have the label do not receive the profile; all non-excluded hosts do |
| 2 | Create a new label, assign it to hosts, and upload a profile excluding that label | Newly excluded hosts do not receive the profile after labels recalculate |
| 3 | Verify previously existing profiles with other targeting options | No regression: include/all-hosts profiles still deploy as before |

### MDM-PROFILES-006 — Show clear error when uploading a profile whose name already exists

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | Windows
- **Preconditions:** MDM on; a profile named "NameA" already uploaded to the target team.
- **Source:** #17700

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In the UI, upload the same profile again without changing its name | Upload is blocked with the "name already exists" error matching Figma copy |
| 2 | Upload a profile with a different payload but the same name "NameA" | Upload is blocked with the same name-conflict error |
| 3 | Repeat for MDM (.mobileconfig), DDM (declaration), and Windows CSP profiles | Each profile type returns the name-conflict error |
| 4 | Repeat the duplicate-name upload via API and via GitOps | Both surface an error message matching the UI/Figma copy |

### MDM-PROFILES-007 — Target configuration profiles to hosts that include any selected label

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows
- **Preconditions:** MDM on; multiple Dynamic and Manual labels created and assigned to macOS and Windows hosts.
- **Source:** #22156

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Upload a Windows and a macOS profile and choose the "Include any" custom target with several labels | Upload succeeds with the Include-any target |
| 2 | Verify delivery to hosts | Each host that has any one of the selected labels receives the profile; hosts with none do not |
| 3 | Re-test existing "Include all" and "Exclude any" targets | No regression; those targeting modes still behave as before |
| 4 | Apply the same Include-any targeting via GitOps and API | Targeting is applied identically to the UI flow |

### MDM-PROFILES-008 — Batch-apply cross-platform configuration profiles via the public API

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** MDM on for the platforms under test; API token for a user with sufficient role.
- **Source:** #24706, #32786

| # | Step | Expected result |
|---|------|-----------------|
| 1 | POST to `/configuration_profiles/batch` with Apple `.mobileconfig`, Apple declaration `.json`, Windows, and Android `.json` profiles together | All profile types are accepted and applied to the targeted team |
| 2 | Include labels on the profiles in the batch | Labels are applied to the profiles as sent |
| 3 | Send the batch with no team (Free) and with team id / team name / both matching / conflicting id+name (Premium) | Free defaults to all teams; Premium resolves valid team references and rejects conflicting id+name |
| 4 | Re-send with profiles removed, added, updated, and duplicated; run a dry-run | Removals delete, adds/updates apply, duplicates are ignored, dry-run reports changes without applying |
| 5 | Call as an observer, and with MDM turned off for a platform | Permission error for observer; apply fails for the disabled platform with the documented error message |

### MDM-PROFILES-009 — Display "Current status" updated-at timestamp on Controls > OS settings

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | Windows
- **Preconditions:** MDM on; at least one configuration profile deployed to a team.
- **Source:** #24947

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Controls > OS settings for a team with deployed profiles | A "Current status" title and a timestamp (with tooltip) are shown |
| 2 | Call `GET /configuration_profiles/summary` | Response includes a `counts_updated_at` field |
| 3 | View Controls > OS updates with no current versions data | The Current versions table shows the new empty state |

### MDM-PROFILES-010 — Resend a configuration profile to all failed hosts from the status modal

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows
- **Preconditions:** MDM on; a configuration profile that is Failed on at least one host and Pending on at least two offline hosts.
- **Source:** #25549

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Hover a profile row on Controls > OS settings and click the checkmark/status icon | The status modal opens showing per-status host counts |
| 2 | Confirm "Resend" placement | "Resend" appears in the Failed row only when at least one host failed; it is hidden for a DDM profile's Failed row |
| 3 | Click a status host count | You are navigated to the Hosts page filtered by that profile status; counts match the filter dropdown options |
| 4 | Click "Resend" and confirm in the resend modal | Failed count resets to 0 (`---`), Pending increases, the profile is re-sent (visible on Host details), and a global activity item is logged |
| 5 | Delete a profile that is Pending on the two offline hosts | Delete copy reflects cancellation; rolled-up Pending count drops by 2 and the profile no longer appears in those hosts' OS settings |
| 6 | Call `POST /configuration_profiles/resend/batch` as an observer, and try resending a DDM profile | Observer gets a permissions error; DDM resend returns a not-supported error |

### MDM-PROFILES-011 — End user resends configuration profiles from the My device page

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** macOS host enrolled with both `.mobileconfig` and DDM profiles, plus a Wi-Fi/SCEP profile assigned; Fleet Desktop installed.
- **Source:** #26687

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the OS settings modal on the My device page | A Resend button appears only for macOS configuration profiles, not for DDM profiles |
| 2 | Resend a macOS configuration profile | Status moves to Pending and a global activity feed item is logged with the specified copy/styles |
| 3 | Resend the Wi-Fi profile that delivers a SCEP certificate | Resending delivers a new, valid certificate |
| 4 | Call the "Resend by device token" API and the existing Resend API for Windows or macOS DDM profiles | macOS configuration profiles resend; Windows/DDM resends return an easy-to-understand error |

### MDM-PROFILES-012 — Block Android system-update configuration profiles on Free with a clear error

- **Tier:** Both
- **Priority:** P2
- **Platforms:** Android
- **Preconditions:** Android MDM connected; an Android host enrolled.
- **Source:** #25896

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On Premium, add an Android configuration profile containing `{"systemUpdate":{"type":"AUTOMATIC"}}` | Profile uploads and an available Android system update installs as soon as it is available |
| 2 | On the OS updates page, click the "custom settings" link | You land on Controls > OS settings > Custom settings for the currently viewed team |
| 3 | On Fleet Free, add the same Android profile | Upload is blocked with the easy-to-understand error message specified in Figma |
| 4 | Repeat the add via API and GitOps | Same accept (Premium) / error (Free) behavior as the UI |

### MDM-PROFILES-013 — Surface which local user account received user-scoped macOS profiles

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** macOS host enrolled with at least one user-channel (user-scoped) configuration profile delivered.
- **Source:** #29792

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Host details > OS settings modal for the macOS host | A user icon appears next to user-scoped profiles; legacy device-channel profiles with `PayloadScope: User` do not show the icon |
| 2 | Hover the user icon | A tooltip shows the username of the local account that received the profile |
| 3 | Rename that local user account (e.g. user1 → user2) and refetch | The tooltip and local users table reflect the new username; the MDM user channel is not broken |
| 4 | Call `GET /api/latest/fleet/hosts/:id` | `host.mdm.profiles[n].scope` returns `device` or `user` accordingly |

### MDM-PROFILES-014 — Show clear error for user-scoped configuration profiles on iOS/iPadOS

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** iOS/iPadOS
- **Preconditions:** iOS or iPadOS host enrolled; a user-scoped configuration profile added.
- **Source:** #34171

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Host details > OS settings modal for the iOS/iPadOS host with the user-scoped profile | The error message specified in Figma is shown for that profile |
| 2 | Inspect the profile row | The user icon does not appear next to the profile name on iOS/iPadOS hosts |

### MDM-PROFILES-015 — Verify Windows device-scoped profiles via MDM protocol response without osquery

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** Windows MDM on; a Windows host enrolled; a profile that fails osquery-based verification (e.g. Advanced PowerShell logging).
- **Source:** #31921

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Deploy device- and user-scoped Windows profiles, including one that fails osquery verification, and have the host return MDM `200` | All such profiles move to Verified based on the `200` response |
| 2 | Take a host where the profile was stuck failing osquery verification on an older Fleet version and upgrade Fleet | After upgrade, the profile shows Verified since the MDM protocol returned `200` |
| 3 | Confirm user-scoped Windows profiles | User-scoped profiles verify as expected |

### MDM-PROFILES-016 — Send Windows profiles non-atomically with per-LocURI status

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** Windows MDM on; a Windows host enrolled.
- **Source:** #31922

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add a new Windows profile and inspect the SyncML sent | Profile is sent without an `<Atomic>` wrapper |
| 2 | Resend a profile created before this change | Fleet strips the previously added `<Atomic>` before sending |
| 3 | Add a profile where one LocURI fails (e.g. non-existent CSP) | Profile is marked Failed; Host > OS settings modal shows a per-LocURI status code for each failed and successful LocURI |
| 4 | Add a SCEP profile (user- and device-scoped) | Fleet automatically wraps SCEP profiles in `<Atomic>` so they still work |
| 5 | Upload a profile with `<Atomic>` not wrapping all LocURIs, or with a top-level `<Get>`/`<Delete>` element | Upload is rejected with the appropriate validation error |
| 6 | Submit one atomic and two non-atomic profiles (one failing) within the same SyncML message | All three send together; the failing non-atomic profile does not cause the other non-atomic or the atomic profile to fail |

### MDM-PROFILES-017 — Target configuration profiles with Include any/all and Exclude any across all platforms

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** All
- **Preconditions:** MDM on for all platforms; Manual, Dynamic, and IdP labels created and assigned across Windows, Apple, Apple-declaration, and Android hosts.
- **Source:** #32073, #14715, #17315, #22156

| # | Step | Expected result |
|---|------|-----------------|
| 1 | For each of the 4 profile types, upload with each target mode: no labels, include-any, include-all, exclude-any, include-any+exclude-any, include-all+exclude-any | Each combination uploads and applies correctly per profile type |
| 2 | Verify delivery against Manual, Dynamic, and IdP labels | Hosts receive (or are excluded from) profiles according to their label membership and target mode |
| 3 | Create a Dynamic exclude-any label, then add a profile excluding it before the host re-runs queries | The profile is not gated by the new exclude label until the host's labels recalculate (after the next refetch), then exclusion applies |
| 4 | Configure the same targeting via GitOps and API | Targeting behaves identically to the UI |

### MDM-PROFILES-018 — Skip Apple declaration validations behind a contributor server config

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** macOS MDM on; a macOS host enrolled; ability to set the contributor server config flag.
- **Source:** #38366

| # | Step | Expected result |
|---|------|-----------------|
| 1 | With the server config enabled, add assorted Apple declarations (e.g. SecurityCertificate + AssetCredentialCertificate, PasscodeSettings + ActivationSimple, ManagementProperties chains) | The declarations are accepted for upload |
| 2 | Confirm currently supported declarations still install and verify | Existing supported declarations install and reach Verified; other profiles and validations are unaffected |
| 3 | Disable the server config and attempt to add the same declarations | All of those declarations are blocked |

### MDM-PROFILES-019 — Simplify the OS settings modal status and resend columns

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows
- **Preconditions:** MDM on; a host (and Controls > OS settings) showing profiles in Failed and various Pending states, plus disk encryption configured.
- **Source:** #40702, #19646

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the Host details OS settings modal | The "Error" column is removed; "Resend" has its own unlabeled column; Failed status shows the former error text as a tooltip |
| 2 | Inspect any Pending-variant status on Host details and on Controls > OS settings | The "(pending)" suffix is removed from the status label |
| 3 | Hover a status tooltip | The tooltip stays open so the user can hover and highlight its text instead of disappearing immediately |
| 4 | Review Controls > OS settings > Disk encryption rows for enabled and disabled encryption, and after adding/removing a profile | Pending statuses also have "(pending)" removed and the simplified layout holds in all cases |

## Enrollment, Migration & Setup Experience

### MDM-ENROLL-001 — Add end user authentication metadata fields to SSO and automatic enrollment

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Premium license active; Apple MDM turned on; admin on the End user authentication / Automatic enrollment settings.
- **Source:** #12007

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the SSO / end user authentication settings page and the Automatic enrollment page | Metadata fields, hints, and tooltips render with copy matching the design |
| 2 | Leave a required metadata field blank and attempt to save | Save is blocked and an inline validation error is shown for the empty field |
| 3 | Enter an invalid value (e.g. malformed metadata URL) and attempt to save | Save is blocked and an inline validation error is shown for the invalid field |
| 4 | Enter valid metadata and save, then run the SSO and automatic enrollment workflows end to end | Settings save successfully and both the SSO and automatic enrollment workflows complete without error |

### MDM-ENROLL-002 — Log a server error when the MDM migration workflow fails

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** orbit and Fleet Desktop running against a Fleet server (local TUF build acceptable); migration workflow configured with a webhook.
- **Source:** #13189

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Begin the MDM migration flow from Fleet Desktop on the host | The migration flow starts |
| 2 | Force the flow to fail (disconnect the network or make the migration webhook return an error) | The migration does not complete |
| 3 | Inspect the Fleet server logs | A `500` error is recorded for the failed migration request |

### MDM-ENROLL-003 — Run macOS MDM enrollment, migration, and management workflows on a current macOS release

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS
- **Preconditions:** Premium license; Apple MDM configured (APNs, ABM/ADE, SCEP); a EULA, bootstrap package, and end user authentication available for the automatic enrollment team; a DEP-eligible Mac and a manually-enrollable Mac.
- **Source:** #13669

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Manually turn on MDM for a Mac per the migration guide | Host reports MDM `On (manual)` in Fleet |
| 2 | Automatically (ADE) enroll a Mac on a team configured with end user auth, a EULA, and a bootstrap package | Enrollment presents IdP login and EULA, installs the bootstrap package, and the host enrolls into Fleet |
| 3 | Migrate a DEP Mac using the default workflow, then repeat with the end user workflow | Each migration moves the host into Fleet MDM successfully |
| 4 | Toggle disk encryption on then off and run the reset/rotate encryption key flow | Encryption enforces and disables; key escrow and rotation succeed |
| 5 | Add, edit, and remove a configuration profile; send a custom MDM command; enforce an OS update minimum version/deadline; run a custom script | Each operation applies on the device and reports the correct status in Fleet |
| 6 | During local account creation, confirm Full Name and Account Name are populated from the end user's IdP attributes, and require the user to wait for configuration profiles before using the Mac | Local account is pre-populated from IdP and the device is held until profiles are delivered |
| 7 | Turn off MDM for the host | Host reports MDM `Off` and management stops |

### MDM-ENROLL-004 — Capture end user email at install time via the --end-user-email flag

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Premium license; ability to build fleetd packages with `fleetctl package`; macOS host enrollable via an enrollment profile carrying the `EndUserEmail` key.
- **Source:** #15057, #18130

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Build an MSI, pkg, deb, and rpm with the `--end-user-email` flag and install each on its host | Each package builds, the host enrolls into Fleet with MDM/fleetd installed, and the supplied email appears in the host's "Used by" field |
| 2 | Attempt to build a package type that does not support `--end-user-email` with the flag set | The build fails with an error |
| 3 | Edit a macOS enrollment profile to include the `EndUserEmail` key/value and install it on a Mac | Host enrolls with MDM `On (manual)` and fleetd installed; the email is captured |
| 4 | Open the host's details page and inspect the "Used by" field | "Used by" displays "Custom" for emails captured via this flag/key |
| 5 | Search the Hosts page by the captured email address | The host is returned in the search results |

### MDM-ENROLL-005 — Surface and recover from a failed macOS DEP profile assignment

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Premium license; Apple MDM and ABM/ADE configured; a Mac present in ABM that can be transferred between MDM servers.
- **Source:** #15461

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In ABM, transfer a host from another MDM to Fleet, then open Hosts page > MDM status for that host | The DEP profile assignment error is surfaced for the host with copy matching the design |
| 2 | Attempt to enroll the host while the error is present | Enrollment proceeds but no DEP profile is assigned |
| 3 | Wait ~1 hour and re-check, repeating until enrollment succeeds | The profile is eventually assigned and the host enrolls successfully |
| 4 | While the assignment error is present, unassign then reassign the host in ABM | The unassign/reassign workaround clears the error and allows successful enrollment |

### MDM-ENROLL-006 — Automatically migrate a Windows workstation from a third-party MDM to Fleet

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** Premium license; Fleet server with Windows MDM initially off; a Windows host enrolled in a third-party MDM and enrolled in Fleet (fleetd).
- **Source:** #22075

| # | Step | Expected result |
|---|------|-----------------|
| 1 | With Windows MDM off in Fleet, confirm the Windows host reports being MDM-enrolled in a third party | Host shows the third-party MDM solution |
| 2 | Turn on Windows MDM in Fleet and wait for the host to refetch | Host stays enrolled in its third-party MDM (last refetched timestamp is after Windows MDM was enabled) |
| 3 | Turn on Windows MDM migration in Fleet | Migration is enabled |
| 4 | Refresh the host's page repeatedly | Host unenrolls from the third-party MDM and subsequently enrolls into Fleet MDM |
| 5 | Attempt to enable Windows MDM migration without a Premium license via UI and via `fleetctl gitops` | The option is rejected/unavailable on Free |

### MDM-ENROLL-007 — Turn Android MDM on and off via Android Enterprise and enroll a device with a work profile

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** Android
- **Preconditions:** Premium license; Android MDM feature flag enabled; access to a Google account for Android Enterprise; an Android device for BYOD work-profile enrollment.
- **Source:** #23231

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On `/settings/integrations/mdm/android`, connect Android Enterprise and complete Google's binding wizard | Wizard displays "Fleet" when asking to allow binding; on completion the Android MDM card on `/settings/integrations/mdm` flips to on without a page reload |
| 2 | Check the global activity feed | An activity is logged for turning Android MDM on (crediting the acting user) |
| 3 | Open the Add hosts modal and select the new Android tab | An enrollment URL is shown (matching the iOS/iPadOS URL); empty state appears if MDM is off |
| 4 | On an Android device, open `/enroll?enroll_secret=<secret>` and tap Enroll | Correct instructions display; the device enrolls into the team matching the enroll secret and shows MDM `On (manual)` |
| 5 | Open `/enroll` with a missing/invalid enroll secret | The specified error message is displayed and enrollment does not proceed |
| 6 | Confirm the dashboard, host list `android` built-in label, and Host details reflect the Android host | Android card and platform filter appear on the dashboard; the `android` label filters correctly; Host details shows the supported Android vitals and MDM status |
| 7 | Turn off Android MDM on `/settings/integrations/mdm/android` | Android hosts are not deleted but their MDM status changes to `Off`; an activity is logged for turning MDM off |

### MDM-ENROLL-008 — Manually enroll a fully-managed company-owned Android device

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** Premium license; Android Enterprise connected; an Android device factory reset for company-owned (fully managed) enrollment.
- **Source:** #23231, #36337

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enroll a company-owned Android device as fully managed | Device enrolls into Fleet as fully managed |
| 2 | Add a configuration profile (including fully-managed-only settings such as `systemUpdate` or `bluetoothDisabled`) to the team | The profile applies on the fully-managed host |
| 3 | Upload a profile with fully-managed-only settings to a team containing BYOD Android hosts | Fleet returns a clear error message indicating the settings are unsupported for BYOD hosts |
| 4 | Add apps to setup experience and to self-service (managed Google Play) for the team, then enroll the device | Setup-experience apps install during enrollment; self-service apps are available; all installed apps appear in the software inventory |
| 5 | Unenroll the fully-managed device | Observe and confirm the documented unenroll behavior (e.g. whether the host is factory reset) |

### MDM-ENROLL-009 — Install fleetd with a custom configuration via the bootstrap package during ADE setup

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Premium license; Apple MDM and ABM/ADE configured; a DEP-eligible Mac; a distribution bootstrap package that bundles fleetd plus a post-install script.
- **Source:** #24475

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On Controls > Setup experience > Bootstrap package with no package uploaded, check the "Install Fleet's agent (fleetd) manually" advanced option | The option is greyed out / not selectable |
| 2 | Upload a bootstrap package, then select "Install Fleet's agent (fleetd) manually" | The option becomes selectable; setup-experience software and scripts are disabled with the specified tooltips |
| 3 | DEP-enroll a Mac with the manual option selected | fleetd is NOT installed by Fleet during ADE; the bootstrap package's bundled fleetd installs and is configured correctly |
| 4 | DEP-enroll a Mac with the manual option left unselected | fleetd IS installed by Fleet as part of the ADE flow |
| 5 | Remove the bootstrap package while the manual option is selected | The manual option is deselected and fleetd reverts to being installed during ADE; the delete confirmation modal shows the updated copy |
| 6 | Set the manual fleetd option via the API and via GitOps, then DEP-enroll | fleetd is not installed during ADE in both cases |

### MDM-ENROLL-010 — Reject non-distribution bootstrap packages

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Premium license; Apple MDM configured; a flat (non-distribution) pkg and a signed distribution pkg available.
- **Source:** #27700

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On Controls > Setup experience > Bootstrap package, upload a pkg that lacks a `Distribution.plist` (not a distribution package) | Fleet rejects it with an error that includes a "Learn more" link resolving to the documented URL |
| 2 | Attempt the same upload via the API and via GitOps | Both return the corresponding error |
| 3 | Upload a valid signed distribution pkg | Upload succeeds and the bootstrap package status updates on the page |

### MDM-ENROLL-011 — Enroll a personally owned (BYOD) iOS/iPadOS device with a Managed Apple Account

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** iOS/iPadOS
- **Preconditions:** Premium license; ABM token added in Fleet with the work-email domain connected and Fleet set as the iPhone/iPad MDM server in ABM; a personal iPhone/iPad with a work email.
- **Source:** #27390

| # | Step | Expected result |
|---|------|-----------------|
| 1 | From a personal iPhone/iPad, perform account-driven (BYOD) enrollment using the work email | The device enrolls and reports MDM status `On (personal)` in Fleet |
| 2 | Open Host details and the Hosts list for the BYOD device | "Enrollment ID" is shown instead of a serial number; the host is counted in the dashboard MDM card status and `enrolled_personal_hosts_count` is returned by `GET /hosts/summary/mdm` |
| 3 | Open the Software tab for the BYOD host | Only work (managed) apps are displayed |
| 4 | Open the Actions menu on the BYOD host | Only "Transfer" and "Delete" actions are available |
| 5 | Attempt account-based (Managed Apple Account) enrollment on a macOS host | An error is displayed indicating it is unsupported on macOS |
| 6 | Transfer the BYOD host to another team | Transfer succeeds and profiles are updated without breaking management |

### MDM-ENROLL-012 — Require IdP authentication before BYOD iOS, iPadOS, and Android enrollment

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** iOS/iPadOS | Android
- **Preconditions:** Premium license; end user authentication SAML configured under Settings > Integrations > Identity provider; end user auth enabled on at least one team; Apple/Android MDM on.
- **Source:** #29222

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Confirm the End user authentication SAML configuration appears under `settings/integrations/identity-provider` and the copy on `/controls/setup-experience/end-user-auth` matches the design | Configuration is in the IdP settings location; copy and End user experience section match the design |
| 2 | Visit `/enroll` for a team that has end user auth enabled, even with an invalid enroll secret | The IdP login page is displayed |
| 3 | Visit `/enroll` with the enroll secret of a team that does NOT have end user auth enabled | The user is allowed through without IdP authentication, as today |
| 4 | Authenticate with IdP, then refresh the `/enroll` page within 30 minutes | A session cookie persists for 30 minutes so no re-authentication is required |
| 5 | After authenticating, enroll the device | The user's email is stored as `host.end_users[n].username` (except Android, deferred); platform-specific instructions are shown based on the device |
| 6 | Open Host details for the enrolled iOS/iPadOS host | The IdP Users card and Username are shown (hidden for Android) |

### MDM-ENROLL-013 — Confirm new Fleet instances come pre-populated with queries, policies, and scripts

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Ability to provision a fresh Fleet Free and a fresh Fleet Premium instance.
- **Source:** #29217

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Spin up a new Fleet Free instance | The default queries, policies, and scripts are present |
| 2 | Spin up a new Fleet Premium instance | The default queries, policies, scripts, and teams are present |
| 3 | Enroll a host and wait a couple of minutes | The pre-populated query reports show data |

### MDM-ENROLL-014 — Create a macOS local account from IdP credentials via Platform SSO during setup

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Premium license; Apple MDM and ABM/ADE configured; Okta (or supported IdP) configured for Platform SSO per the guide; profiles and the Okta Verify app added to setup experience; a DEP-eligible Mac.
- **Source:** #30674

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Configure Platform SSO with Okta per the guide and DEP-enroll a Mac, completing setup | The local user account is created during setup and its password is synced with the IdP |
| 2 | With end user authentication enabled, run setup experience deploying the PSSO profiles and Okta Verify app | PSSO is configured and the account-creation/password-sync behavior works |
| 3 | Repeat with end user authentication disabled | PSSO is configured and the behavior still works correctly |
| 4 | Change the user's password in Okta, then lock/logout and log back in on the host with the new password | The password change is synced to the host |

### MDM-ENROLL-015 — Validate the macOS Tahoe ABM MDM migration workflow

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | iOS/iPadOS
- **Preconditions:** Premium license; Fleet MDM server (cloud and on-prem); hosts in ABM running macOS Tahoe / iOS / iPadOS 26 enrolled in a third-party or Fleet MDM; bootstrap/FileVault configured.
- **Source:** #30695

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Migrate a single host from a third-party MDM to a cloud-hosted Fleet server, then repeat to an on-prem Fleet server | The host migrates to Fleet MDM in each case |
| 2 | Migrate a single host from an on-prem Fleet server to a cloud-hosted Fleet server, and migrate multiple hosts from a third-party MDM at once | Single and bulk migrations complete successfully |
| 3 | Run the migration with a deadline set, allow the deadline to expire, then run without a deadline set | With a deadline, the device automatically begins enrollment when it expires; without a deadline the migration still works |
| 4 | Cancel the migration in ABM (including after the user defers) | The pending enrollment is removed from the host under Device Management |
| 5 | Migrate iPad and iPhone hosts and verify FileVault recovery key escrow after a macOS migration | iOS/iPadOS migrate successfully; the migrated Mac receives and escrows a new FileVault key |
| 6 | Trigger a conflict between Fleet's migration and ABM migration, and check a host with VPP apps already installed | Conflict is handled gracefully; previously installed VPP apps remain |

### MDM-ENROLL-016 — Set Fleet as the default MDM server for BYOD iOS/iPadOS account-driven enrollment

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** iOS/iPadOS
- **Preconditions:** Premium license; ABM token added; ability to set the default iOS/iPadOS MDM server in ABM to the Fleet server; a personal iPhone/iPad for account-driven user enrollment.
- **Source:** #30871

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In ABM, set the default iOS/iPadOS MDM server to your Fleet server | Fleet is the default server for account-driven user enrollment |
| 2 | On a personal iPhone/iPad, perform account-driven user (BYOD) enrollment | The device enrolls into Fleet by default without selecting a server |
| 3 | After testing, unset the default iOS/iPadOS MDM server in ABM | The default server is cleared so other devices are unaffected |

### MDM-ENROLL-017 — Install the bootstrap package only during first-time Mac setup, not migration

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | iOS/iPadOS
- **Preconditions:** Premium license; Apple MDM and ABM configured; a bootstrap package added to the host's team; a Mac in ABM enrolled in a non-Fleet MDM; a macOS Tahoe host for the Tahoe migration path.
- **Source:** #31292

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enroll an ABM Mac to Fleet without turning on MDM features, add a bootstrap package to its team, then trigger the default migration workflow | The host migrates but the bootstrap package is NOT installed |
| 2 | Repeat using the end user migration workflow | The bootstrap package is NOT installed during migration |
| 3 | On a macOS Tahoe host, trigger the new Tahoe migration workflow | The bootstrap package is NOT installed; setup-experience software and scripts do not run during migration |
| 4 | Run the Tahoe migration on iOS/iPadOS hosts | Migration works and VPP apps are still installed |
| 5 | DEP-enroll a brand-new Mac (not a migration) | The bootstrap package, setup-experience software, and scripts all run as part of first-time setup |

### MDM-ENROLL-018 — Use the /enroll page for macOS profile-based manual enrollment

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Premium license; a macOS host enrolled to Fleet via fleetd; Apple MDM turned on; optionally end user authentication configured for the host's team.
- **Source:** #33640

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the host, open Fleet Desktop > My device and select "Turn on MDM" | A tab opens to the new `/enroll` page with Mac-specific copy |
| 2 | Follow the on-screen instructions to turn on MDM | MDM turns on successfully and the host stays in the same team it was on before |
| 3 | Turn off MDM, enable end user authentication for the host's team, then select "Turn on MDM" again | A new tab opens showing the IdP login page |
| 4 | Enter IdP credentials and complete the on-screen instructions | MDM turns on; the IdP username is set for the host and is used to set the IdP groups and department |
| 5 | Navigate to `/enroll` and install the enrollment profile before fleetd is installed | The host turns on MDM and fleetd installs so the host enrolls to Fleet (undocumented path, confirm whether it works) |

### MDM-ENROLL-019 — Keep swiftDialog foremost and reliable during macOS setup experience

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Premium license; Apple MDM and ABM/ADE configured; setup experience configured with software/scripts so swiftDialog appears during enrollment.
- **Source:** #28434

| # | Step | Expected result |
|---|------|-----------------|
| 1 | DEP-enroll a Mac so the setup experience swiftDialog appears, and try to bring other apps/dialogs in front of it | No other dialog or app is allowed to cover swiftDialog |
| 2 | Click the desktop background behind swiftDialog | swiftDialog stays visible (clicking the background does not hide it) |
| 3 | Try common close shortcuts and then press `⌘+⌃+X` | Only `⌘+⌃+X` closes swiftDialog |
| 4 | Let all setup-experience items finish (success or error) | swiftDialog closes automatically when the list is complete |

### MDM-ENROLL-020 — Support iPod touch as an iOS host

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** iOS/iPadOS
- **Preconditions:** Premium license; Apple MDM, ABM/ADE, and VPP configured; an iPod touch (7th gen).
- **Source:** #28975

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enroll an iPod touch (via ADE) and open the Hosts list/details | The iPod touch shows up as iOS, lands in the default iOS team, and Host details shows iOS vitals and certificates like other iOS hosts |
| 2 | Filter the host list by iOS platform and by iOS OS version | The iPod touch is included in both filters |
| 3 | Install an iOS VPP app and deploy a WebClip profile with the self-service URL | The VPP app installs and the WebClip is delivered |
| 4 | Run the setup experience (end user authentication and software install) on the iPod touch | The setup experience flow completes successfully |
| 5 | From Host details, wipe, lock, and unenroll the iPod touch | Each action succeeds |
| 6 | Set the iOS minimum version to 26 (Tahoe) | The iPod touch remains enrolled and continues working normally |

### MDM-ENROLL-021 — Speed up profile delivery during macOS setup experience

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Premium license; Apple MDM and ABM/ADE configured; 40+ macOS configuration profiles added to the team; setup-experience software and scripts excluded; a DEP-eligible Mac.
- **Source:** #29473

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add 40+ macOS configuration profiles to Fleet with setup-experience software and scripts excluded | Profiles are saved to the team |
| 2 | Enroll an ABM Mac to trigger the new Mac setup flow and time the "Waiting for enrollment server" screen on Remote Management after profiles install | The wait is 1 minute or less |

### MDM-ENROLL-022 — Override the generated package filename with fleetctl package

- **Tier:** Both
- **Priority:** P2
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** `fleetctl` configured against a Fleet server; hosts available to install each package type (deb, rpm, msi, pkg).
- **Source:** #29581

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Generate one each of deb, rpm, msi, and pkg with `fleetctl package` using default (no outfile) naming, install them, and verify enrollment | Each package builds with the default filename and the host enrolls successfully |
| 2 | Generate one each of deb, rpm, msi, and pkg specifying a custom output filename, install them, and verify enrollment | Each package builds with the specified custom filename and the host enrolls successfully |

### MDM-ENROLL-023 — Puppet-created team automatically inherits the "no team" custom setup assistant

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Fleet server reachable; an enrolled macOS host with MDM features turned on; a custom setup assistant configured for "no team"; a valid `FLEET_TOKEN`, the host hardware UUID, a team name, and an MDM profile available for the puppet endpoints
- **Source:** #13363

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Confirm a custom setup assistant is set for "no team" | The "no team" setup assistant is configured |
| 2 | Pre-assign a configuration profile to the host by POSTing the base64-encoded profile, the host UUID, the external host identifier, and the target team name to `/api/latest/fleet/mdm/apple/profiles/preassign` | The pre-assign request succeeds |
| 3 | Match the pre-assignment by POSTing the external host identifier to `/api/latest/fleet/mdm/apple/profiles/match` | The match request succeeds and a new team is created via the puppet endpoints |
| 4 | Query the `mdm_apple_setup_assistants` table in the database for the host | A row exists for the newly created team for that host |

### MDM-ENROLL-024 — swiftDialog upgraded to v2.2 functions during setup experience

- **Tier:** Both
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Fleet build that bundles swiftDialog v2.2; a macOS host going through the setup experience that surfaces the swiftDialog UI
- **Source:** #13373

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Trigger a setup experience flow that displays the swiftDialog UI on the macOS host | The swiftDialog window renders without error |
| 2 | Verify the swiftDialog version in use | The dialog reports version 2.2 |

### MDM-ENROLL-025 — fleetd installs automatically when MDM is turned on without clearing host vitals

- **Tier:** Both
- **Priority:** P0
- **Platforms:** macOS
- **Preconditions:** A host that can have MDM features turned on; the Host details page is reachable and shows host vitals
- **Source:** #18764

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Note the current host vitals shown on the Host details page | Host vitals are recorded for comparison |
| 2 | Turn on MDM features for the host | fleetd is installed on the host as a result of MDM being turned on |
| 3 | Re-open the Host details page and review host vitals | All host vitals previously shown remain populated and are not cleared |

### MDM-ENROLL-026 — Setup experience option is hidden in Fleet Free and protected when software is in use

- **Tier:** Both
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** A Fleet Free instance and a Premium instance available; on Premium, a software item from the main catalog is assigned to the setup experience
- **Source:** #19372

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Log in to Fleet Free and look for the setup experience option | The setup experience option is not shown on Fleet Free |
| 2 | On Premium, attempt to delete a software item from the main catalog that is being used for setup experience | A restriction modal is shown preventing the deletion |

### MDM-ENROLL-027 — Re-opening Apple Remote Management pane during migration does not break

- **Tier:** Both
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** A macOS host in the end-user MDM migration workflow where Apple's Remote Management pane is already open
- **Source:** #19625

| # | Step | Expected result |
|---|------|-----------------|
| 1 | With the Remote Management pane already displayed, have Fleet run the command to open Apple's Remote Management pane again | Nothing breaks; the migration workflow continues without error |

### MDM-ENROLL-028 — Enrollment links on Add host modal are mono-spaced

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** User can open Hosts > Add host modal
- **Source:** #36754

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the Hosts > Add host modal | The modal opens |
| 2 | Inspect each enrollment link displayed in the modal | All enrollment links are rendered in a mono-spaced font |

### MDM-ENROLL-029 — Managed local account checkbox gating in Controls > Setup experience > Users

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Premium Fleet; access to Controls > Setup experience; ability to toggle IdP connection and Apple MDM
- **Source:** #37141

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to the old URL `/controls/setup-experience/end-user-auth` | Redirects to `/controls/setup-experience/users` |
| 2 | Review the Users section | The former "End user authentication" section is now "Users"; the "Turn on" option is now "End user authentication" with helper text; a new "Managed local account" option appears with tooltip and helper text |
| 3 | With no IdP connected, hover over the "End user authentication" checkbox | Checkbox is visible but disabled; tooltip reads "To enable, first connect Fleet to your identity provider (IdP)." with a working link to IdP settings |
| 4 | Connect an IdP | The "End user authentication" checkbox becomes enabled |
| 5 | With Apple MDM not turned on, hover over the "Managed local account" checkbox | Checkbox is visible but disabled; tooltip reads "To enable, first turn on Apple MDM." with a working link to Apple MDM settings |
| 6 | Turn on Apple MDM | The "Managed local account" checkbox becomes enabled |
| 7 | View the Managed local account option in GitOps mode | The option is disabled in GitOps mode |

### MDM-ENROLL-030 — Managed local account is created on ADE enrollment and persists across changes

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS
- **Preconditions:** Premium Fleet; "Managed local account" enabled in setup experience; an ADE-eligible macOS host
- **Source:** #37141

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add (DEP-enroll) a host with Managed local account enabled | A local admin account is created on the host |
| 2 | Inspect the macOS login window | The managed local account is hidden from the login window (it may appear on the first login window after restart, which is expected) |
| 3 | Disable the Managed local account option, then check hosts where the account was created | The managed account is retained on each host where it was already created |
| 4 | Move a host with a managed account to another team | The account persists |
| 5 | Check a host that was already enrolled before the feature was turned on | That host does not receive a local admin account unless re-enrolled/wiped through setup assistant |

### MDM-ENROLL-031 — /enroll copy updated and enrollment succeeds across device types

- **Tier:** Both
- **Priority:** P1
- **Platforms:** macOS | iOS/iPadOS | Android
- **Preconditions:** Access to the end-user `/enroll` page; a Mac, iPhone, iPad, and Android device available to enroll; Figma wireframes for reference
- **Source:** #37190

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open `/enroll` on a Mac, iPhone, iPad, and Android device and compare the copy to the Figma wireframes | The copy is updated to match the wireframes for each device type |
| 2 | Follow the enrollment steps on the Mac, iPhone, iPad, and Android device | Each device successfully enrolls to Fleet |

### MDM-ENROLL-032 — Lock end user info controls editing of account name and full name in Setup Assistant

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Premium Fleet; a macOS host going through Setup Assistant; ability to toggle "Lock end user info" and end user authentication
- **Source:** #38669

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enable "Lock end user info", then enroll a host through macOS Setup Assistant | The end user CANNOT edit Full Name and Account Name during Setup Assistant |
| 2 | Uncheck "Lock end user info", then enroll a host through macOS Setup Assistant | The end user CAN edit Full Name and Account Name during Setup Assistant |
| 3 | With end user authentication turned off, view the "Lock end user info" option | "Lock end user info" is disabled |
| 4 | Attempt to set `lock_end_user_info` while `enable_end_user_authentication` is disabled | "Lock end user info" cannot be enabled |
| 5 | Apply `lock_end_user_info` via GitOps for a team and for "no team" | The value is set as specified for both teams and no-team |

### MDM-ENROLL-033 — Windows Autopilot and Settings-app enrollment gated by Entra tenant IDs

- **Tier:** Both
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** A Fleet instance upgraded so no Entra tenant IDs are initially defined; ability to configure up to two Microsoft Entra instances; Windows hosts available for Autopilot and "Access work or school" (Settings app) enrollment
- **Source:** #39214

| # | Step | Expected result |
|---|------|-----------------|
| 1 | After upgrade, with no tenant IDs defined, attempt enrollment via Autopilot and via the Settings app | No enrollments are allowed via Autopilot or the Settings app |
| 2 | With Entra not configured, attempt a fleetd-based automatic enrollment | Fleetd-based automatic enrollment is still allowed |
| 3 | Configure a tenant, then perform Autopilot and Settings app enrollments | Both Autopilot and Settings app enrollments work as expected |
| 4 | Configure two Entra instances, remove one, then enroll using the remaining instance | Enrollment succeeds with the second instance |

### MDM-ENROLL-034 — Bootstrap package delivered during migration only when env var is set

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Premium Fleet; a team with a bootstrap package added; a macOS host undergoing ABM MDM migration; ability to set the server env var `FLEET_ALLOW_BOOTSTRAP_PACKAGE_DURING_MIGRATION`
- **Source:** #39634

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Without `FLEET_ALLOW_BOOTSTRAP_PACKAGE_DURING_MIGRATION` set, migrate a macOS host via ABM MDM migration | The host does NOT get an InstallEnterpriseApplication command for the bootstrap package; it gets just one for fleetd |
| 2 | Set `FLEET_ALLOW_BOOTSTRAP_PACKAGE_DURING_MIGRATION=1` in the server environment and migrate a host via ABM MDM migration | The host gets an InstallEnterpriseApplication command for the bootstrap package and another for fleetd |
| 3 | With and without the env var set, erase a macOS host (all content and settings) and enroll it anew from DEP | The bootstrap package is installed in both cases |

### MDM-ENROLL-035 — Updated default Apple automatic enrollment profile applied on fresh instance

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | iOS/iPadOS
- **Preconditions:** Premium Fleet; a brand-new Fleet instance with no existing `mdm_apple_enrollment_profiles` row; an ABM token available to upload; macOS, iPhone, and iPad devices for DEP enrollment
- **Source:** #40905

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Click the "Learn more" link on the enrollment profile UI | Navigates to `/learn-more-about/enrollment-profiles` |
| 2 | Upload an ABM token on the fresh instance, then view the default profile | The UI shows the updated default profile with the new skip items and removed keys |
| 3 | DEP-enroll a Mac and observe Setup Assistant | Accessibility pane is shown; Region/Language chooser is shown; Apple Intelligence, Software Update, Update Completed, OS Showcase, and Welcome panes are skipped; the device is supervised |
| 4 | DEP-enroll an iPhone and an iPad against the fresh instance | The setup flow matches expectations and the new skip items do not cause DefineProfile rejections from Apple |
| 5 | Run ADE enrollments on macOS 14, 15, and 26 plus latest iOS/iPadOS | Apple accepts the new skip keys across supported OS versions with no profile issues |

### MDM-ENROLL-036 — Default enrollment profile not auto-updated on upgraded instances; custom profile override

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Premium Fleet upgraded from a prior version where ABM was already set up and a default profile row already existed; ability to delete/re-add the ABM token and upload a custom enrollment profile
- **Source:** #40905

| # | Step | Expected result |
|---|------|-----------------|
| 1 | After upgrade, inspect the stored default profile JSON and the UI | The stored JSON is unchanged and the UI reflects the pre-existing defaults |
| 2 | Delete the ABM token and re-add it | The default profile row is NOT refreshed; downloading the profile still returns the old one |
| 3 | Upload a custom enrollment profile | The Fleet default is hidden; only the uploaded file name (not the full path) is shown; custom profile contents apply on enrollment |
| 4 | Delete the custom profile | The default re-appears with download available but delete not available |

### MDM-ENROLL-037 — Setup Assistant page empty states and permissions

- **Tier:** Both
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** A Fleet Free instance and a Premium instance; ability to enable/disable MDM and ABM; users available for each global and team role
- **Source:** #40905

| # | Step | Expected result |
|---|------|-----------------|
| 1 | View the Setup Assistant page with MDM disabled, and with Apple MDM enabled but ABM not configured | The proper existing empty state is shown and the page does not break |
| 2 | On Fleet Free, open Controls > Setup Experience | The proper empty state calling out the need for Fleet Premium is shown and does not break |
| 3 | Access the Setup Assistant section as global admin, maintainer, observer; team admin, maintainer, observer, observer+; and GitOps | Permissions match the existing Setup Assistant section for each role |

### MDM-ENROLL-038 — Error messaging surfaces for invalid or expired ABM token

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Premium Fleet with a configured ABM server; ability to generate a new ABM token and to back up/restore the server database
- **Source:** #43916

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Generate a new ABM token for the already-configured server without uploading it to Fleet, then wait until the next day | An error is shown for the invalid token |
| 2 | Take a DB backup, generate and upload a new ABM token, then revert the server to the backup | An error is shown for the invalid token |
| 3 | Place the server in an expired-token state (keeping an old token after expiry or restoring a backup with an expired token) | An error is shown for the expired token |

## MDM Commands & Device Actions

### MDM-COMMANDS-001 — Run Windows MDM protocol commands via CLI/API with correct tier and role gating

- **Tier:** Both
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** Windows MDM turned on; at least one enrolled Windows host; API tokens available for Admin, Maintainer, Observer/Observer+, and GitOps roles, plus a Team Maintainer/Admin scoped to a specific team.
- **Source:** #13069

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On a free tenant, enumerate available MDM commands for a Windows host via API/CLI | All Windows MDM commands are available except Wipe |
| 2 | On a free tenant, attempt to run the Wipe command against a Windows host | Wipe is rejected as unavailable on the free tier |
| 3 | On a paid tenant, run the Wipe command against a Windows host | Wipe command is accepted and queued |
| 4 | As a Maintainer (or higher) and as a GitOps user, run an MDM command | Command is accepted for each role |
| 5 | As an Observer and Observer+, attempt to run an MDM command | Command is rejected for both roles |
| 6 | As a Team Maintainer/Admin, run a command on a host in their team, then attempt one on a host outside their team | Command succeeds for the in-team host and is rejected for the out-of-team host |
| 7 | Confirm there is no UI surface for these commands | Commands are only invokable via CLI/API; no UI controls are added |
| 8 | Send a test command to an online host, then send one to an offline host and bring it back online | Online host runs the command on receipt; offline host runs it once it reconnects; results are returned in both cases |
| 9 | Run `fleetctl get hosts --mdm` against an environment with both macOS and Windows hosts | Results are returned for both macOS and Windows hosts, and existing macOS MDM functionality is unchanged |

### MDM-COMMANDS-002 — Remote lock/wipe a Linux workstation via fleetctl scripts

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Linux
- **Preconditions:** A Linux VM enrolled in Fleet with scripts enabled; the Linux lock/wipe scripts downloaded from the fleetdm/fleet repo (scripts/mdm/linux); fleetctl configured.
- **Source:** #14771

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Download the Linux lock/wipe scripts from the fleetdm/fleet repository | Scripts are obtained locally |
| 2 | Confirm the target Linux VM is enrolled in Fleet with scripts enabled | Host appears in Fleet and scripts execution is enabled for it |
| 3 | Execute the lock/wipe script against the Linux host using `fleetctl` as documented | fleetctl queues and runs the script on the host |
| 4 | Observe the script output in the terminal and the resulting state of the VM | Terminal shows the expected script output and the VM exhibits the expected lock/wipe behavior |

### MDM-COMMANDS-003 — Turn MDM off on an iPhone/iPad from Host details

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** iOS/iPadOS
- **Preconditions:** Apple MDM turned on; an enrolled iPhone/iPad host visible in Fleet; access to Admin, Maintainer, and Observer accounts; an API token.
- **Source:** #23239

| # | Step | Expected result |
|---|------|-----------------|
| 1 | As an Admin or Maintainer, open the iPhone/iPad Host details page and open the Actions dropdown | A "Turn off MDM" item appears in the Actions menu |
| 2 | As an Observer, view the Actions dropdown for the same host | "Turn off MDM" is not shown |
| 3 | View the Actions dropdown for a host that has a pending wipe, and for one that is already wiped | "Turn off MDM" is disabled in both states |
| 4 | Click "Turn off MDM" | A confirmation modal matching the design opens, with its embedded link resolving correctly |
| 5 | Confirm turning off MDM and let it succeed | A success banner is shown |
| 6 | Trigger a turn-off that fails | A failure banner is shown |
| 7 | Turn off MDM for an iPhone/iPad via the API | MDM is turned off for the host via the API |
| 8 | After MDM is turned off, inspect the device and the activity feed | Configuration profiles are removed from the device and a corresponding entry appears in the activity feed |

### MDM-COMMANDS-004 — Expose device_status and pending_action on the /hosts API only when requested

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Hosts present including at least one with a pending lock, a pending wipe, and one already locked; API token available.
- **Source:** #36094, #34923, #36009, #37657

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Call `GET /api/v1/fleet/hosts?include_device_status=true` | Each host object includes `device_status` and `pending_action` fields |
| 2 | Call `GET /api/v1/fleet/hosts` without the parameter | Host objects do not include `device_status` or `pending_action` |
| 3 | Call the endpoint with `include_device_status=true` and inspect a host with a pending lock, a host with a pending wipe, and a locked host | `device_status` and `pending_action` reflect accurate values for each of these states |

### MDM-COMMANDS-005 — Clear passcode on an iOS/iPadOS host from Host details

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** iOS/iPadOS
- **Preconditions:** Apple MDM turned on; a company-owned or manually enrolled iOS/iPadOS host; access to Admin, Maintainer, and Observer accounts; an API token. For negative cases also have a personally-enrolled iOS host and a non-iOS/iPadOS host available.
- **Source:** #39570

| # | Step | Expected result |
|---|------|-----------------|
| 1 | As Admin or Maintainer, open the Actions dropdown on a company-owned or manual iOS/iPadOS host | A "Clear passcode" menu item is present |
| 2 | View the Actions dropdown on a personally-enrolled iOS host and on a non-iOS/iPadOS host | "Clear passcode" is hidden for the personal host and not offered for non-iOS/iPadOS hosts |
| 3 | View "Clear passcode" for a host in Lost Mode or with a pending wipe | The menu item is disabled and shows an explanatory tooltip |
| 4 | As an Observer, check the Actions dropdown | "Clear passcode" is not shown |
| 5 | Click "Clear passcode" | A modal with Cancel and Clear "passcode" actions opens |
| 6 | Confirm the clear passcode action and let it succeed | A success flash message is shown, and the activity is logged in both the host-level and global activity feeds |
| 7 | Trigger a failing clear passcode | A failure flash message is shown |
| 8 | Via API, send Clear passcode to a host that is personally enrolled or missing an unlock token | Request is rejected with "Unlock token not available for this host. Unable to issue ClearPasscode command." |
| 9 | Via API, send Clear passcode to a non-iOS/iPadOS host | Request is rejected with "ClearPasscode command is only available for iOS and iPadOS. Unable to issue ClearPasscode command." |
| 10 | Turn off Apple MDM, then load the host page and attempt Clear passcode via API | Host page still works; the command is rejected with "Apple MDM must be turned on to use Clear passcode." |
| 11 | On a Fleet Free instance, check the UI and call the Clear passcode API | The option is not shown in the UI and the API rejects the command as a premium-only command (as with EraseDevice) |

### MDM-COMMANDS-006 — Show managed account action and modal on Host details

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Premium Fleet; a macOS host with a managed local account created
- **Source:** #37141

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the Actions dropdown on the Host details page | "Show managed account" appears in the dropdown |
| 2 | While the account is still being created, view the option | "Show managed account" is disabled with a tooltip |
| 3 | On a host enrolled before the feature was enabled, view the option | "Show managed account" is disabled with a tooltip |
| 4 | On a host with the account created, click "Show managed account" | The managed account modal opens showing the default username `_fleetadmin` and a password |
| 5 | Use the view (eye) and copy controls in the modal | The password is viewable and the copy function works |

### MDM-COMMANDS-007 — Managed local account password rotation modal behavior

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Premium Fleet; a macOS host enrolled from DEP with the managed local account feature enabled and the account UUID captured
- **Source:** #37142

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Host details > Show managed account | Modal shows username `_fleetadmin`, masked password, copy and eye buttons, a "Rotate password" secondary button, and a primary "Close" button |
| 2 | View the password for the first time | Status flips to `pending` and a banner appears: "Password rotates automatically after {time}" with `{time}` ~1h5m in the future |
| 3 | Re-open and re-view the password within the rotation window | The same rotation time is shown; the timer is not extended |
| 4 | Click "Rotate password" | Password rotates immediately, the banner clears, and the auto-rotate timer stops |
| 5 | Access the password via `GET /api/v1/fleet/hosts/:id/managed_local_account/password` | The next modal open shows the rotation banner, matching view-via-UI behavior |

### MDM-COMMANDS-008 — Managed local account rotation when UUID not yet captured (deferred)

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Premium Fleet; a freshly DEP-enrolled macOS host whose managed account UUID has not yet been captured
- **Source:** #37142

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Show managed account on the freshly-enrolled host | The password is still viewable (not blocked) |
| 2 | Set `account_uuid=null` in the `host_managed_local_account_passwords` row via DB query, then view the password | The password is still viewable |
| 3 | Click "Rotate password" while the UUID is missing | Returns success with no error toast; the modal closes/refreshes cleanly |
| 4 | Wait for the host's next osquery detail cycle to ingest `_fleetadmin` and the rotation cron to run (~5 minutes) | The pending deferred rotation is fulfilled and the modal then shows the new password |

### MDM-COMMANDS-009 — Managed local account password endpoint license and platform restrictions

- **Tier:** Both
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** A Fleet Free instance and a Premium instance; macOS, Windows, and Linux hosts available
- **Source:** #37142

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On Fleet Free (no premium license), call the rotate endpoint | The endpoint returns an `ErrMissingLicense` response |
| 2 | View a Windows or Linux host details page | "Show managed account" button is not shown |
| 3 | Call the managed account endpoint for a Windows or Linux host | The request is rejected |
| 4 | On both Free and Premium, open host pages for macOS, Windows, and Linux hosts with and without Apple MDM enabled | Each host page still works without error |

## Certificates & Identity (SCEP/NDES/DigiCert/IdP)

### MDM-CERTS-001 — Auto-renew host MDM SCEP ("Fleet Identity") certificate before expiration

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Fleet server running with `mdm.apple_scep_signer_validity_days` configured to a value less than 180 days (so issued certs expire in under 180 days). Apple MDM configured. A new macOS host available to enroll.
- **Source:** #19684, #15332

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Turn on MDM features for the new macOS host while the server has `apple_scep_signer_validity_days` < 180. | Host enrolls; in Keychain the "Fleet Identity" SCEP certificate expires within the configured (sub-180-day) window. |
| 2 | Restart the Fleet server without the validity-days override set, then trigger the `cleanups_then_aggregation` cron job. | The job enqueues a SCEP certificate renewal for the host (renewal fires because cert is within 180 days of expiration). |
| 3 | Search for the "Fleet Identity" certificate in the host's Keychain after renewal completes. | A newly issued "Fleet Identity" certificate is present, now valid for the default 1-year period. |
| 4 | (ADE + SSO variant) Enroll a host via ADE with MDM SSO enabled, force a renewal, then re-inspect the enrollment profile. | After renewal the enrollment profile still contains the `enrollment_reference` query parameter; SSO enrollment remains intact. |

### MDM-CERTS-002 — MDM SCEP certificate is issued with "Fleet" issuer string

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Apple MDM configured. A macOS host newly enrolling (or renewing its MDM SCEP cert).
- **Source:** #18427

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Turn on MDM for a new macOS host so a fresh SCEP certificate is issued. | The issued SCEP certificate uses "Fleet" (not the legacy "Fleetdm") as the issuer/organization string in its subject. |

### MDM-CERTS-003 — Connect DigiCert CA and deploy a certificate to the macOS host Keychain

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS
- **Preconditions:** Fleet Premium with Apple MDM configured. Valid DigiCert One credentials (API token, profile GUID) available. A macOS host enrolled with MDM on.
- **Source:** #26436, #22709

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to Settings > Integrations > Certificates and select Add CA > DigiCert. | DigiCert form appears with required fields; CA cannot be saved until all fields are populated. |
| 2 | Fill the form with valid DigiCert info, use name `DIGICERT_WIFI`, and select Add CA. | Fleet validates the API token, saves the CA, lists it on the Certificates page, and records an activity for adding the CA. |
| 3 | Create a PKCS12 configuration profile, replacing the password field with `$FLEET_VAR_DIGICERT_PASSWORD_DIGICERT_WIFI` and the data field with `$FLEET_VAR_DIGICERT_DATA_DIGICERT_WIFI`, and upload it to Fleet. | Profile uploads successfully (no unknown-`$FLEET_VAR_` error). |
| 4 | Open the host's details page and check OS settings status for the profile. | Profile reaches "Verified". |
| 5 | Open the macOS host's Keychain and search for the deployed certificate. | A real DigiCert-issued certificate is present in the Keychain. |
| 6 | Deploy the same profile to two or more hosts. | All targeted hosts receive their own certificate. |

### MDM-CERTS-004 — Renew NDES SCEP certificate on macOS before expiration

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Fleet Premium with Apple MDM. NDES CA connected. A macOS host enrolled with MDM on, with an NDES SCEP certificate profile deployed.
- **Source:** #24468

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add a macOS SCEP configuration profile referencing the NDES CA but omit one of `$FLEET_VAR_NDES_SCEP_CHALLENGE`, `$FLEET_VAR_NDES_SCEP_PROXY_URL`, or `$FLEET_VAR_SCEP_RENEWAL_ID`. | Fleet rejects the profile, requiring all three variables in their appropriate keys. |
| 2 | Add a valid NDES SCEP profile containing all three variables (including `$FLEET_VAR_SCEP_RENEWAL_ID`) and deploy to the host. | Profile deploys; `$FLEET_VAR_SCEP_RENEWAL_ID` is replaced with `fleet-` + the profile UUID before delivery; certificate is installed and shown in the host's Keychain and on the Host details > Certificates section. |
| 3 | Let the certificate reach 30 days from expiration (or, for a validity period under 30 days, half that period before expiration). | Fleet automatically resends the NDES SCEP profile and a renewed certificate is issued. |
| 4 | Move the host to another team, or remove the SCEP profile. | The certificate is removed from the host's Keychain. |

### MDM-CERTS-005 — Renew custom SCEP CA certificate on macOS before expiration

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Fleet Premium with Apple MDM. A custom SCEP CA (named e.g. `SCEP_WIFI`) connected. A macOS host enrolled with MDM on.
- **Source:** #27984

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add a macOS SCEP configuration profile for the custom CA but omit one of `$FLEET_VAR_CUSTOM_SCEP_CHALLENGE_<CA_NAME>`, `$FLEET_VAR_CUSTOM_SCEP_PROXY_URL_<CA_NAME>`, or `$FLEET_VAR_SCEP_RENEWAL_ID`. | Fleet rejects the profile, requiring all three variables in their appropriate keys. |
| 2 | Add a valid custom SCEP profile with all three variables and deploy it to the host. | Profile deploys; `$FLEET_VAR_SCEP_RENEWAL_ID` is replaced with `fleet-` + the profile UUID; certificate is installed and shown in the Keychain and on the Host details > Certificates section. |
| 3 | Let the certificate reach 30 days from expiration (or half the validity period if it is under 30 days). | Fleet automatically resends the custom SCEP profile and a renewed certificate is issued. |
| 4 | Move the host to another team, or remove the custom SCEP profile. | The certificate is removed from the host's Keychain. |

### MDM-CERTS-006 — Renew DigiCert certificate on macOS before expiration

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Fleet Premium with Apple MDM. DigiCert CA connected. A macOS host enrolled with MDM on, with a DigiCert certificate profile deployed.
- **Source:** #26553

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Deploy a DigiCert certificate profile to the host and confirm the certificate appears in the Keychain and on Host details. | Certificate is installed and shown on the Host details page. |
| 2 | Let the certificate reach 30 days from expiration (or, for a validity period under 30 days, half that period before expiration). | Fleet automatically resends the DigiCert profile and issues a renewed certificate. |
| 3 | Change the variable used in the CN without changing the seat ID, then attempt the renewal/resend. | Fleet throws an error (CN variable changed but seat ID unchanged is not allowed). |
| 4 | Move the host to another team, or remove the DigiCert configuration profile. | The certificate is removed from the host's Keychain. |

### MDM-CERTS-007 — Deploy certificates to the login (user) Keychain on macOS

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Fleet Premium with Apple MDM. At least one CA connected (custom SCEP, NDES, and/or DigiCert). One or more enrolled macOS hosts.
- **Source:** #26913

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add a custom SCEP CA named `SCEP_WIFI` via Settings > Integrations > Certificates. | CA is saved and listed. |
| 2 | In a profile editor, create a SCEP configuration profile with a top-level `PayloadScope` of `User`, replacing the challenge with `$FLEET_VAR_CUSTOM_SCEP_CHALLENGE_SCEP_WIFI` and the URL with `$FLEET_VAR_CUSTOM_SCEP_PROXY_URL_SCEP_WIFI`, and upload it. | Profile uploads without error. |
| 3 | Open Host details and check the profile status, then deploy the profile to two or more hosts. | Profile reaches "Verified" on each host; each host's Certificates section shows the installed certificate. |
| 4 | On a macOS host, open the Keychain app and inspect the "login" keychain. | The delivered certificate appears in the login (user) keychain, not the system keychain. |
| 5 | Repeat steps 2-4 for NDES and DigiCert user-scoped profiles. | NDES and DigiCert certificates are also delivered to the login (user) keychain. |

### MDM-CERTS-008 — Connect custom SCEP CA via one-time challenge code and deploy a certificate

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Fleet Premium with Apple MDM. A custom SCEP CA endpoint that issues one-time (single-use) challenge codes. An enrolled macOS host.
- **Source:** #29172

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to Settings > Integrations > Certificates, select Add CA > Custom Simple Certificate Enrollment Protocol (SCEP), and configure it for a CA that uses one-time challenge codes; save as `SCEP_WIFI`. | Fleet validates the SCEP URL and saves the CA. |
| 2 | Create a SCEP configuration profile replacing the challenge field with `$FLEET_VAR_CUSTOM_SCEP_CHALLENGE_SCEP_WIFI` and the URL field with `$FLEET_VAR_CUSTOM_SCEP_PROXY_URL_SCEP_WIFI`, and upload it. | Profile uploads without error. |
| 3 | Deploy the profile to the host and check Host details. | Profile reaches "Verified"; a valid SCEP certificate is issued even though the CA challenge code is single-use, and the certificate appears in the Keychain and on Host details. |
| 4 | Deploy the same profile to a second host. | The second host obtains its own valid certificate (a fresh one-time code is used per host). |

### MDM-CERTS-009 — Renew custom SCEP CA certificate on Windows before expiration

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** Fleet Premium with Windows MDM. A custom SCEP CA connected. An enrolled Windows host with a SCEP (Wi-Fi/VPN) configuration profile deployed (both user-scoped and device-scoped certs available to test).
- **Source:** #32746

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Deploy a Windows custom-SCEP profile that delivers a Wi-Fi or VPN certificate and confirm connectivity using that certificate. | Certificate is delivered; host has working Wi-Fi/VPN access. |
| 2 | Let the certificate reach 30 days from expiration (or half the validity period if it is under 30 days). | Fleet automatically resends the Windows SCEP profile and the certificate is renewed for both user-scoped and device-scoped SCEP certificates. |
| 3 | After renewal, confirm Wi-Fi/VPN connectivity. | The user does not lose access to Wi-Fi/VPN through the renewal. |
| 4 | On Host details > OS settings modal, select Resend for the Windows SCEP profile. | The user can manually resend the Windows profile from the modal. |
| 5 | Change the value of a built-in (`$FLEET_VAR_...`) variable referenced by any Windows profile. | Fleet automatically resends the affected profile(s), not just SCEP profiles. |

### MDM-CERTS-010 — Use `$FLEET_VAR_SCEP_RENEWAL_ID` in the Organizational Unit (OU) field

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | iOS/iPadOS
- **Preconditions:** Fleet Premium with Apple MDM. A SCEP CA connected (Smallstep, NDES, or custom SCEP). An enrolled host.
- **Source:** #33261

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add a Wi-Fi/VPN profile with a SCEP payload specifying `$FLEET_VAR_SCEP_RENEWAL_ID` in the OU field and deploy it. | Profile deploys; certificate appears on the Host details and My device pages. |
| 2 | Let the certificate approach expiration. | Fleet renews automatically starting at 30 days before expiration if validity is over 30 days, or at half the validity period if validity is under 30 days. |
| 3 | Add a SCEP Wi-Fi/VPN profile that specifies `$FLEET_VAR_SCEP_RENEWAL_ID` in neither the OU nor the CN field. | Fleet rejects it with an easy-to-understand error message. |
| 4 | Add a SCEP Wi-Fi/VPN profile that specifies `$FLEET_VAR_SCEP_RENEWAL_ID` in both the CN and the OU fields. | Fleet rejects it with an easy-to-understand error message. |
| 5 | Add a profile with `$FLEET_VAR_SCEP_RENEWAL_ID` as one of multiple OU entries alongside other OU values; on an iOS host, also put `$FLEET_VAR_HOST_END_USER_IDP_USERNAME` in the CN. | Profile deploys; the IdP username is populated in the CN; auto-renewal still occurs at the correct threshold. |

### MDM-CERTS-011 — Throttle certificate-bearing profile delivery to ease CA server load

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Fleet Premium with Apple MDM. An NDES (or custom SCEP / DigiCert / Smallstep) CA connected. Fleet server started with `FLEET_MDM_CERTIFICATE_PROFILES_LIMIT` set to an artificially low value (e.g. 1). A team with roughly 10 enrolled macOS hosts.
- **Source:** #38002

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Upload an Apple configuration profile containing variables that reference the connected CA and target the team of ~10 hosts. | Profile begins delivering; UI may show "Pending" for all hosts, but in `host_mdm_apple_profiles` only one host per 30-second reconciler tick gets a non-null "pending" status and command UUID (rate = the configured limit per 30s). |
| 2 | While throttled delivery is in progress, enroll a new host from ADE with no setup experience items. | The newly enrolling host receives its profile quickly and is not forced to wait behind the throttled queue. |
| 3 | Transfer some throttled hosts to another team. | The certificate profile is removed from those hosts quickly (removal is not throttled). |
| 4 | Transfer hosts into this team. | The profile is sent to the newly applicable hosts at the throttled rate. |
| 5 | Delete the profile. | The profile is removed from all hosts quickly, not in the metered manner used for sending. |

### MDM-CERTS-012 — Enforce ACME (hardware-attested) MDM enrollment certificates

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | iOS/iPadOS
- **Preconditions:** Fleet Premium with Apple MDM. Access to Apple Silicon and Intel Macs, iPhones, and iPads enrollable via ADE/DEP and via manual (profile) enrollment.
- **Source:** #31289

| # | Step | Expected result |
|---|------|-----------------|
| 1 | With "Require Hardware Attestation" disabled, enroll Apple Silicon and Intel Macs, iPhones, and iPads via DEP and via manual profile enrollment; check Device Management > Profiles. | All devices enroll; "Fleet Enrollment" shows a SCEP enrollment. |
| 2 | Enable "Require Hardware Attestation" and re-enroll the same device types via DEP and manual enrollment. | All devices enroll; Apple Silicon Macs show an ACME enrollment, while other devices (Intel Macs, iPhones, iPads) show a SCEP enrollment. |
| 3 | Force enrollment-profile (SCEP) renewal by setting `cert_not_valid_after` to a near-future date in `nano_cert_auth_associations` for the test hosts. | After renewal, devices that qualify (Apple Silicon Macs from DEP) show ACME enrollments; all others show SCEP enrollments. |
| 4 | Break Apple attestation on an Apple Silicon DEP Mac (point appattest.apple.com hosts to 0.0.0.0) with "Require Hardware Attestation" enabled and attempt enrollment. | Enrollment fails. |
| 5 | On Host details, check the attestation indicator for ACME-enrolled/renewed devices vs others. | ACME-enrolled (or ACME-renewed) devices show "MDM Attested: Yes"; non-ACME devices do not show this field. |
| 6 | Switch the instance to Fleet Free and check the setting in UI, GitOps, and API. | The "Require Hardware Attestation" checkbox does not exist in the UI and the setting cannot be set via GitOps or API on Fleet Free. |
| 7 | With GitOps mode enabled (Premium), view the setting in the UI. | The "Require Hardware Attestation" checkbox is disabled/non-interactive. |

### MDM-CERTS-013 — Use end user IdP attributes (groups/username) as variables in macOS profiles

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Fleet Premium with Apple MDM. An IdP (SCIM) connected with users mapped to hosts. An enrolled macOS host whose end user has IdP groups and username assigned.
- **Source:** #23900

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add a macOS configuration profile containing a misspelled / non-existent `$FLEET_VAR_...` IdP variable. | Fleet rejects the upload (cannot upload a variable that doesn't exist). |
| 2 | Add a macOS profile using `$FLEET_VAR_HOST_END_USER_IDP_GROUPS` and `$FLEET_VAR_HOST_END_USER_IDP_USERNAME` and deploy it to a host whose end user has those IdP attributes. | Profile is delivered and the variables are populated with the end user's IdP groups/username. |
| 3 | Change the value of the IdP attribute in the IdP. | Fleet automatically resends the profile to the host with the updated value. |
| 4 | Deploy a profile using those variables to a host that has no IdP username or groups assigned. | The profile fails for that host and the Host details (and My device) page shows the expected error message. |
| 5 | Deploy a profile using the legacy `$FLEET_VAR_HOST_END_USER_EMAIL_IDP` variable. | The legacy variable still works (backward compatible). |

### MDM-CERTS-014 — Use end user IdP full name as a variable in configuration profiles

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Fleet Premium with Apple MDM. An IdP (Okta, Entra ID, Google Workspace, or Authentik) connected via SCIM, with a user having `givenName` and `familyName` mapped. An enrolled macOS host mapped to that user.
- **Source:** #30888

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In the IdP, create a user with `givenName` and `familyName` so a full name is constructed, then confirm the Host details page shows the "Full name". | The end user's full name appears on Host details. |
| 2 | Add a configuration profile using `$FLEET_VAR_HOST_END_USER_IDP_FULL_NAME` and deploy it to the host; inspect the profile locally (System Settings > Device Management). | The full name is populated in the delivered profile. |
| 3 | Deploy the same profile to a host whose end user has no (or empty) full name. | The profile shows "Failed" for that host with an easy-to-understand error on the Host details and My device pages. |
| 4 | In the IdP, update the end user's full name. | The full name changes in Fleet (Host details and API), and Fleet automatically resends the profile containing `$FLEET_VAR_HOST_END_USER_IDP_FULL_NAME`. |
| 5 | In the IdP SCIM app, remove the first-name/last-name mapping and save. | Fleet shows an error message under Settings > Integrations > IdP. |

### MDM-CERTS-015 — Connect IdP via SCIM and surface end user IdP info in host vitals

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | iOS/iPadOS
- **Preconditions:** Fleet Premium. An IdP supporting SCIM provisioning (Entra ID, or authentik fronting Google Workspace) with users and groups configured. Hosts mapped to those IdP users.
- **Source:** #28196, #28197

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Create the SCIM integration app in the IdP (Entra ID / authentik) but leave something misconfigured, then run "test connection". | The integration card state on /settings/integrations/identity-provider does NOT change (still shows not-connected) until the first successful request. |
| 2 | Correct the configuration so the IdP sends a valid SCIM request to Fleet. | After the first successful request the card shows IdP connected and displays the latest request timestamp. |
| 3 | Cause a subsequent SCIM request to error. | The card shows an error message in a tooltip on hover over the card text; latest-request timestamp continues to reflect the most recent request. |
| 4 | View a mapped host's Host details > User (IdP) card. | The user information and Groups in the card match what is assigned to the user in the IdP. |
| 5 | In the IdP, update a user's lastName or userName, and change a user's group assignments. | The updated attributes and group membership changes are reflected on the host's Host details. |

### MDM-CERTS-016 — macOS local account creation and password sync via IdP OAuth ROPG

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Premium Fleet; macOS 26+ host; Okta configured as IdP with a ROPG app; a distinctive item (e.g. a certificate bearing your name) placed in the keychain before testing
- **Source:** #45524

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Confirm the distinctive certificate is present in the keychain before testing | The marker certificate is present in the keychain |
| 2 | Perform initial macOS local account creation and password sync using the IdP (Okta ROPG) credentials | The local account is created and its password syncs based on the IdP credentials |
| 3 | After completing the flow, re-inspect the keychain | The marker certificate is still present; the keychain was never reset |
| 4 | Watch for any prompt asking for the old password during the flow | If prompted for the old password, document it and report to Engineering |

## Activity Feed & Host Vitals

### MDM-ACTIVITY-001 — MDM, DDM, and script activities appear in global Past and Upcoming feeds across platforms

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** MDM turned on; an Admin user; at least one enrolled macOS, one Windows, and one Linux host with MDM/scripts available.
- **Source:** #15920

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Send an MDM command, a DDM (declarative) command, and run a script against an online host | Each action queues and then completes |
| 2 | Open the global Activity feed | Feed loads; while data is fetching a loading state is shown, and an error state appears only if the request fails |
| 3 | Inspect the Past feed | MDM, DDM, and script activities (created, deleted, ran, installed) are listed with correct copy |
| 4 | Queue actions against an offline host, then open the Upcoming feed | Queued items appear under Upcoming before they execute |
| 5 | Open the details modal for an MDM command and a script activity | Modal shows the action details matching the design |
| 6 | Repeat for macOS, Windows, and Linux hosts | Activities are recorded correctly for each platform |

### MDM-ACTIVITY-002 — Upcoming activities execute in a single ordered queue and are logged in order

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** All
- **Preconditions:** MDM turned on; VPP configured; an enrolled macOS, Windows, and Linux host; software titles (custom pkg, VPP, FMA) available.
- **Source:** #22866, #15920, #20712

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On an offline host, queue several actions in sequence: run a script, install a custom package, and install software | All items appear under the host's Upcoming tab in the order sent |
| 2 | Bring the host online | Queued items execute one at a time in the same order they were queued |
| 3 | Trigger a Fleet-initiated action via a failing policy automation (install software and run a script on failure) | Resulting activities are logged and show the "Fleet-initiated" copy |
| 4 | Run a self-service install from Fleet Desktop | Activity is logged with the "(self-service)" copy |
| 5 | Review the host Past tab and the global Activity feed after execution | Completed items appear in correct order with details modals matching the design |
| 6 | Repeat for macOS, Windows, and Linux | Ordering and logging are correct on every platform |

### MDM-ACTIVITY-003 — Per-host MDM commands toggle reveals only Apple MDM command activities

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | iOS/iPadOS
- **Preconditions:** MDM turned on; a mix of MDM and non-MDM enrolled macOS and iOS/iPadOS hosts; at least one host with MDM commands and one with none.
- **Source:** #34704, #20712

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Host details > Activity for an Apple host and for a non-Apple host | "Show MDM commands" toggle is present only on Apple hosts and is OFF by default |
| 2 | With the toggle OFF, review the Activity list | MDM commands do not appear; only non-MDM activity is shown |
| 3 | Turn the toggle ON | Only MDM commands appear; all non-MDM activity disappears; the upcoming-MDM-command count shows next to the toggle |
| 4 | Turn the toggle OFF again | Activity list returns to non-MDM items |
| 5 | On a host with no MDM commands, turn the toggle ON | Correct empty state matching the design is shown |
| 6 | Trigger a successful, a failed, and a `NotNow` MDM command | Successful shows "ran", failed shows "failed", and `NotNow` stays under Upcoming with `command_status` `pending` (via API) until it eventually resolves to ran/failed |
| 7 | With the toggle ON, open an MDM command's details modal | Modal shows status icon, command name, timestamp, full request payload, and full response payload; long XML payloads scroll vertically within the payload block; success is green and failure is red |
| 8 | Close the modal and switch between Past and Upcoming tabs with the toggle ON and OFF | Closing returns to the Activity tab without changing toggle state; items sort reverse-chronologically; "Activities run as listed" tooltip appears only on Upcoming; the green badge equals total upcoming MDM commands plus upcoming activities |

### MDM-ACTIVITY-004 — Host vitals expose MDM turned-on and MDM check-in timestamps

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | iOS/iPadOS | Android
- **Preconditions:** Fleet instance with MDM available; ability to enroll hosts manually and via Apple Business Manager (ADE); DB/API access to inspect host fields.
- **Source:** #17710

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enroll a host to Fleet without turning on MDM | `last_mdm_enrolled_at` is `null` |
| 2 | Turn on MDM for that macOS host manually | `last_mdm_enrolled_at` is set and is not equal to `last_enrolled_at` |
| 3 | Turn MDM off and back on for the macOS host | `last_mdm_enrolled_at` updates while `last_enrolled_at` stays distinct |
| 4 | Automatically enroll a macOS host via Apple Business Manager | `last_mdm_enrolled_at` is set |
| 5 | Wipe (erase all contents and settings) a macOS host with MDM on, then re-enroll automatically | `last_mdm_enrolled_at` is updated |
| 6 | Automatically and manually enroll an iOS, iPadOS, and Android host | `last_enrolled_at` and `last_mdm_enrolled_at` are the same timestamp |
| 7 | Let a host check in via the MDM protocol | `last_mdm_checked_in_at` updates on every MDM check-in |

### MDM-ACTIVITY-005 — Certificates section in host vitals with status, expiry, and details modal

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | iOS/iPadOS
- **Preconditions:** Enrolled macOS, iPhone, and iPad hosts with certificates installed; one unsupported-platform host (e.g. Windows/Linux) for negative checks.
- **Source:** #23235, #27567, #22802

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Host details for a macOS host and click Refetch | Certificates update on the host |
| 2 | Review the Certificates section | Certificates are listed alphabetically with accurate expiry dates and a status indicator color matching expired, expiring, or valid; macOS-only Keychain text and a resolving "Learn more" link are present |
| 3 | Confirm the column set against the design and shrink the viewport | All specified columns are present; the table scrolls horizontally when columns exceed the viewport, and content truncates with a tooltip on hover |
| 4 | Open the certificate details modal | Modal data matches the design and the certificate's actual details |
| 5 | Open Host details for an unsupported-platform host and check the API | Certificates section does not appear; `GET /api/v1/fleet/hosts/:id/certificates` returns null results |
| 6 | On the host's My Device page, review the Certificates section and click "View details" | Certificates section matches the design with the same details and added columns as Host details; "View details" opens the certificate details; `GET /api/v1/fleet/device/{token}/certificates` lists the device's certificates |
| 7 | Repeat on iPhone and iPad | Behavior is consistent across macOS, iOS, and iPadOS |

### MDM-ACTIVITY-006 — Software activities include software_title_id across all package types

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** MDM turned on; VPP configured; ability to upload custom packages and FMA; API access to read activity details.
- **Source:** #24120, #22063

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Upload a software package via the Fleet UI | `added_software` activity includes `software_title_id` |
| 2 | Edit that package via the Fleet UI | `edited_software` activity includes `software_title_id` |
| 3 | Add a VPP (App Store) app | `added_app_store_app` activity includes `software_title_id` |
| 4 | Repeat upload/edit via the MSP Dashboard | `software_title_id` is present in the resulting activities |
| 5 | Repeat across Windows, macOS, and Linux packages and across FMA, custom packages, and VPP | `software_title_id` is present in the activity feed for every package type |

### MDM-ACTIVITY-007 — Android host details show enrollment ID and updated personal-host count and tooltip

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** Android Enterprise configured in Fleet; access to the Google Admin console; an Android host available to enroll.
- **Source:** #26822, #27328

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enroll an Android host as a personal device | Enrollment ID is displayed in the host details UI |
| 2 | Check the personal-host count after enrolling | "(on) Personal" count increases to reflect the newly enrolled host |
| 3 | Hover the related tooltip | Tooltip copy matches the design |
| 4 | Delete the Android Enterprise binding in the Google Admin console | A banner appears on every page, the Android MDM card on `/settings/integrations/mdm` resets to default with the "Turn on" button visible, and banner precedence follows the design |

### MDM-ACTIVITY-008 — Activity feed filtering by actor, type, and date with sorting

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet instance with a populated activity feed containing activities by multiple users across several types and dates.
- **Source:** #29727, #28178

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Type a user's full name, then their email, into the activity search bar | Activities are filtered to that actor for each input |
| 2 | Open the activity type dropdown | Types are ordered alphabetically (A–Z); the search bar is fixed while the list scrolls; searching narrows the list and shows an empty state when no type matches |
| 3 | Select a single activity type | Only that type's activities show and the selected type appears in the dropdown field |
| 4 | Pick a time option from the date dropdown | Activities are filtered to that date range |
| 5 | Use the sort dropdown to switch between newest and oldest | Activities reorder by time accordingly |
| 6 | Combine activity type, date range, and name/email filters at once | Only activities matching all selected filters are returned; applying any filter or sort resets pagination to page 0 |
| 7 | Filter by a name, email, type, or date range that has no matching activities | The appropriate empty state appears in each case |

### MDM-ACTIVITY-009 — Activity logged when macOS setup experience is canceled

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** MDM turned on; macOS setup experience configured with software to install during setup; a macOS host going through ADE setup.
- **Source:** #34288

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Cause a software install to fail during the macOS setup experience | The setup-experience canceled activity is logged with the failed software name in both the global activity feed and the host's Past activity feed |
| 2 | Open the activity type filter on the global activity feed | A new "Canceled activity: macOS setup experience" type filter is present |
| 3 | Select that type filter | Only the matching canceled setup-experience activities are shown |

### MDM-ACTIVITY-010 — Mosyle surfaced as a well-known MDM in the solutions table

- **Tier:** Free
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Hosts reporting an MDM server URL that contains the `mosyle` string.
- **Source:** #35747, #35482

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the `/dashboard` page and view the MDM solutions table | Mosyle is listed as the MDM solution for hosts whose MDM server URL contains `mosyle` |

### MDM-ACTIVITY-011 — Surface Apple Business Manager assignment and pending hosts

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | iOS/iPadOS | Android
- **Preconditions:** MDM turned on; ABM connected; at least one host with an ABM/DEP issue, one pending Apple MDM host (known from ABM, not yet enrolled), plus enrolled Apple and non-Apple hosts.
- **Source:** #39063

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the Dashboard with ABM-issue hosts > 0, locate the new "ABM issue" section | Section is present with a tooltip; clicking it navigates to the filtered hosts list |
| 2 | On the Hosts page arriving from that link | An "ABM issue hosts" pill is shown; removing the pill shows all hosts; the Status tooltip lists currently supported devices |
| 3 | Open the host filter dropdown and select "Pending hosts" | Pending Apple MDM hosts (known from ABM, not yet enrolled) are listed and the filter can be stacked with others (Premium); Fleet Free shows no "Pending" hosts and no way to navigate to them |
| 4 | On host details for an Apple host, click the "MDM status" value | It is a link with no tooltip that opens the MDM status modal; if `dep_profile_error` is true an error icon is shown |
| 5 | Inspect the MDM status modal for ABM/non-ABM Mac, iPhone, and iPad | Modal shows MDM status with value tooltip and "View all hosts" link; "Profile assigned", "Profile pushed", and "Profile status" each have tooltips; when `dep_profile_error` is true a "Profile assignment error" row with error icon and tooltip links to the filtered host list with the same DEP error |
| 6 | View host details for a pending ABM host | Queries section is removed for pending ABM hosts |
| 7 | On Windows/Android host details, click "MDM status"; on Linux host details, look for "MDM status" | Windows/Android open the MDM status modal with no DEP details; Linux shows no "MDM status" value |

### MDM-ACTIVITY-012 — Host and global activity shows configuration profile name and install status

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows
- **Preconditions:** MDM available; enrolled macOS and Windows hosts; configuration profiles that can reach acknowledged, failed, pending, and deferred states; users at multiple permission levels.
- **Source:** #40177

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Deploy a configuration profile that installs successfully and view the global activity feed | InstallProfile and RemoveProfile activities include the profile display name |
| 2 | Trigger a profile activity where no display name is available | Activity shows without a name and includes the affected host with its status (acknowledged, failed, pending, or deferred) |
| 3 | Force a profile to return `NotNow`, then a `Pending` state | The activity reads "is deferred" for `NotNow` and "is pending" for `Pending` |
| 4 | Turn MDM off and on for Windows and macOS and recheck | Profile activities still show regardless of MDM on/off state |
| 5 | As each permission level, open an MDM command activity modal and use the request/response sections | All permission levels can view activities; request and response sections highlight; the "Copy" icon for both "Request payload" and "Response from..." copies the correct section's details |

### MDM-ACTIVITY-013 — Global and host activity for a failing SCEP renewal

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** MDM turned on; ability to force a SCEP/enrollment-profile renewal to fail; both a manually enrolled and a DEP-enrolled macOS host; silent migration workflow available.
- **Source:** #40623

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Force a SCEP renewal to fail | A failing-renewal event appears on both the global and host activity feeds |
| 2 | Repeat using the silent migration workflow | A failure activity is created |
| 3 | Repeat on a manually enrolled host and a DEP-enrolled host | Failure activity is created in both enrollment cases |
| 4 | Send a configuration profile with bad values that fails to install | The enrollment-profile (renewal) activity is not created for this unrelated failure |
| 5 | Inspect the host activity for the Fleet enrollment | It appears as an InstallProfile MDM command |
| 6 | Open the "Enrollment profile renewal details" modal | Modal displays the error (if available), the decoded request payload, and the response from the host |

### MDM-ACTIVITY-014 — Updated copy and view buttons render and function app-wide

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Fleet instance with access to the known UI locations using copy/view button components (per the design).
- **Source:** #41147

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Visit each known location where copy/view buttons were updated | Buttons render with the updated styles and no UI discrepancies versus the design |
| 2 | Click each updated view button | Functionality still works as before with the new styling |
| 3 | Use a "Copy" button | The "Copied" tooltip still appears to the left as expected |

### MDM-ACTIVITY-015 — Setup experience software install and script run produce activity feed entries

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Premium Fleet; a macOS host that completed a setup experience including software installs and a setup script run
- **Source:** #19372

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the global Activity feed after the setup experience completes | Setup experience software install and script run activities appear globally |
| 2 | Open the Host details page Activity tab for the same host | The same setup experience activities appear at the host level |

### MDM-ACTIVITY-016 — Managed local account creation and password view are logged in activity feeds

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Premium Fleet; a macOS host with the managed local account feature in use
- **Source:** #37141

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Create a managed local account on a host | A creation activity appears in both the global and host-level activity feeds |
| 2 | View the managed account password from the modal | A password-viewed activity appears in both the global and host-level activity feeds |

### MDM-ACTIVITY-017 — Managed local account rotation activities credit the correct actor

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Premium Fleet; a macOS host with the managed local account feature enabled; ability to trigger manual, auto, and deferred rotations
- **Source:** #37142

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Manually rotate the password, then open Host details > Activity and Global activity | A "Rotated managed local account password" activity appears in both feeds with the triggering user as actor |
| 2 | Wait past the rotation timer to trigger auto-rotation, then check both feeds | The activity appears with "Fleet" as the actor |
| 3 | Click Rotate before UUID capture so the cron fulfills it later, then check the activity | Exactly one activity appears, credited to the user who clicked Rotate (no duplicate Fleet activity) |
| 4 | Inspect any rotation activity copy | `host_display_name` and `host_id` render correctly |
| 5 | Open the Global activity type filter dropdown | "Rotated managed local account password" appears and filters correctly |
| 6 | Trigger a rotation that fails | The activity still shows |

### MDM-ACTIVITY-018 — Managed local account password decryption and rotation survive upgrade to v4.86

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Premium Fleet on v4.85; a macOS host DEP-enrolled with the managed local account feature enabled so a stored password exists
- **Source:** #37142

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Upgrade the server from v4.85 to v4.86 | Upgrade completes |
| 2 | View the managed account password for the pre-existing host | The password still decrypts correctly |
| 3 | After a refetch runs post-upgrade, perform a timer-based rotation and a manual rotation | A host enrolled prior to v4.86 rotates correctly via both methods |

## Software Install (FMA, VPP, Packages)

### MDM-SOFTWARE-001 — Browse and manage Fleet-maintained apps in the Software catalog

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Premium license active; macOS MDM turned on; a team selected on the Software page.
- **Source:** #18865

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the Software page and select the Fleet-maintained apps (FMA) tab | A dedicated FMA tab is present listing the maintained apps for the selected team |
| 2 | View the FMA tab with no apps added yet | Empty state is shown and its redirect/"learn more" link navigates correctly |
| 3 | Hover the app-count / last-updated indicator | App count is accurate and the last-updated tooltip reflects the catalog refresh time (default 24h) |
| 4 | Run `fleetctl trigger --name maintained_apps` and reload | Last-updated time refreshes to reflect the forced catalog update |
| 5 | Type an app name in the search box | The list filters to matching maintained apps |
| 6 | Add an FMA app, then open it and edit its configuration and save | Edits persist after saving |
| 7 | On the same team, view the FMA list when an app already exists as VPP or a custom package | That app is not listed as an available FMA (no duplicate source) |

### MDM-SOFTWARE-002 — Install and uninstall a Fleet-maintained app on a macOS host

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS
- **Preconditions:** Premium license active; macOS MDM on; at least one FMA app added to the host's team; a managed macOS host enrolled.
- **Source:** #18865

| # | Step | Expected result |
|---|------|-----------------|
| 1 | From the host's Software tab, trigger Install for an added FMA app | Install is queued and the app installs successfully on the host |
| 2 | Mark an FMA app as self-service and trigger its install from Fleet Desktop / My device on the host | App installs successfully via the self-service flow |
| 3 | Open the installed app on the host, then trigger Uninstall from Fleet | App uninstalls successfully even while it is open on the host |

### MDM-SOFTWARE-003 — Connect VPP and add Apple App Store apps to a team

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS
- **Preconditions:** Premium license active; valid VPP token available from Apple Business Manager.
- **Source:** #18867

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Settings > Integrations and locate the VPP tab | The VPP tab is present; for a new setup the "Turn on MDM" link works |
| 2 | With MDM on, click Enable and upload the VPP token | Enable works; uploading a wrong file type shows the validation error; a successful upload shows a green toast and updated copy |
| 3 | Click Edit on the VPP token | Disable and Renew controls are available and the full renewal workflow completes |
| 4 | Open Add software and select the VPP / App Store tab | A spinner appears while the VPP app list populates, then apps from ABM are listed |
| 5 | Add a VPP app that already exists as a title on the team | An error toast is shown indicating the title already exists |
| 6 | Add a valid VPP app and open its Software title details page | The App Store logo displays; the title is listed; the API exposes an `app_store` object for the title |

### MDM-SOFTWARE-004 — Install a VPP App Store app on a macOS host

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS
- **Preconditions:** Premium license active; macOS MDM on; VPP token connected with at least one VPP app added to the host's team; managed macOS host enrolled.
- **Source:** #18867

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the host's Software page, choose Actions > Install for a VPP app | A loading state shows while the install MDM command is sent; the app installs |
| 2 | Let an OS query run after install completes | The app name updates to the reported installed title |
| 3 | Trigger a VPP install that exceeds the available license count | Install fails with the documented out-of-licenses behavior |
| 4 | Review the global and host activity feeds | Install activity is recorded in both feeds |

### MDM-SOFTWARE-005 — Install a self-service VPP app and confirm license count updates

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Premium license active; macOS MDM on; VPP token connected; managed macOS host enrolled and assigned to a team.
- **Source:** #19620, #18867

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add a VPP app to the host's team with the Self-service box checked | App is saved as self-service for that team |
| 2 | Open Fleet Desktop / My device on the assigned host | The self-service app appears as available to the end user |
| 3 | Install the app from self-service | App installs on the host and behaves like other self-service installs |
| 4 | Check the VPP license counts after the install completes | License counts decrement to reflect the consumed seat |

### MDM-SOFTWARE-006 — Show VPP token expiring and expired renewal banners

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Premium license active; VPP token connected; database access to adjust the token's expiry date.
- **Source:** #19691, #18867

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Set the VPP token to expire within 30 days and reload Fleet | The "expiring" renewal banner is shown |
| 2 | Set the VPP token expiry to a past date and reload | The "expired" banner is shown |
| 3 | Click the link in the banner | The link resolves to the renew-VPP portal |
| 4 | Surface other banners alongside the VPP banner | Banner display order matches the documented order of preference |

### MDM-SOFTWARE-007 — Upload large software installers with progress, size limit, and no timeout

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Premium license active; ability to throttle the connection and access to installers up to ~3GB.
- **Source:** #20308

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Upload a large installer (over 1GB or with the connection throttled) | A progress bar is shown during the upload |
| 2 | While the upload is in progress, attempt to close the tab/window or navigate away | A native browser warning prompts for approval before leaving |
| 3 | Upload an installer larger than 500MB but under 3GB | Upload succeeds (old 500MB limit no longer applies) |
| 4 | Upload an installer larger than 3GB | Upload is rejected with an error message |
| 5 | Throttle the connection and upload a large file, watching the network inspector | Upload runs past the old 2-minute limit without being terminated |
| 6 | Upload an installer larger than 500MB via `fleetctl`, then attempt one larger than 3GB | The >500MB upload succeeds; the >3GB upload fails with the appropriate error |

### MDM-SOFTWARE-008 — Auto-create a policy when adding a Fleet-maintained app with Automatic install

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Premium license active; macOS MDM on; FMA catalog available; a team selected; managed macOS host enrolled in that team.
- **Source:** #22077

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Add software for an FMA app and review install options | Manual and Automatic install options are available, Self-service can be selected for either, and Advanced options are editable |
| 2 | Select Automatic install and click Add software | The Add software modal shows a spinner, then on success you are redirected to /software/titles with the "Available for install" filter and a success message; a policy is automatically created |
| 3 | Open the FMA app's /software/titles/:id page | An "Automatic install" badge is shown; hovering gives instructions and clicking the linked policy name opens the policy |
| 4 | Run the auto-created policy on a host where the app is absent | Policy fails, the software install is triggered, and the app installs on the host |
| 5 | Re-run the policy after the app is installed | Policy passes and the software is not re-installed |
| 6 | Delete the app on the host and re-run the policy | A new install is triggered and the app installs successfully again |
| 7 | Attempt to delete the software title while the auto-created policy still exists | Deletion is blocked until the policy is deleted first |

### MDM-SOFTWARE-009 — Scope Fleet-maintained apps, custom packages, and VPP apps by labels

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Premium license active; MDM on; at least two manual/dynamic labels created and assigned to hosts; a team selected.
- **Source:** #22813

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the FMA, custom package, or VPP add-software page, select the Custom target radio with no labels present | "Add label to target specific hosts" copy is shown and "Add label" links to /labels/new/ |
| 2 | Select Custom with a label dropdown offering "Include any" / "Exclude any" | Add software stays disabled until at least one label is selected, then enables |
| 3 | Toggle Manual vs Automatic install combined with Include any / Exclude any | The helper copy under the dropdown matches the selected combination (available-for-install vs installed; have vs don't-have any of these labels) |
| 4 | Add software with a custom-include-any label scope and confirm host membership | Software is delivered only to hosts that have a matching label |
| 5 | Edit the software to change target scope and save via the Save changes modal | Pending installs/uninstalls are canceled; completed installs are not uninstalled; the modal copy warns that running installs still complete but results won't appear |
| 6 | On a host not in the scope, view the Software tab and self-service | The title does not appear; if already installed, it shows with "---" status and only "Show details" in Actions |
| 7 | Attempt to install via API to a host outside the labels, and to add software with both `labels_include_any` and `labels_exclude_any` | API returns "Couldn't install. Host isn't member of the labels defined for this software title." and "Only one of \"labels_include_any\" or \"labels_exclude_any\" can be included." respectively |
| 8 | Attempt to delete a label used as a software custom target | Deletion is blocked with "Couldn't delete. Software uses this label as a custom target. Please delete the software and try again." |

### MDM-SOFTWARE-010 — Install setup-experience software on company-owned iOS/iPadOS hosts at enrollment

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** iOS/iPadOS
- **Preconditions:** Premium license active; macOS/Apple MDM on; VPP/App Store apps available for iOS/iPadOS in the team; an ABM company-owned iPhone/iPad ready to enroll.
- **Source:** #30890, #27015

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the Setup experience > Install software flow for an iOS/iPadOS team and open the Select software modal | Only software available for the target platform is listed; search filters the list |
| 2 | Select software, save, and view the page | The page UI state updates to reflect the saved selection and a global activity entry is logged for the edit |
| 3 | On the Software title details page, attempt to delete a title selected for setup experience | An easy-to-understand error message is shown and deletion is blocked |
| 4 | Add setup-experience software via API with platform "ios"/"ipados", then with a made-up platform | The valid platforms succeed; the made-up platform returns an error; deleting a selected title via API returns a clear error |
| 5 | Automatically enroll an ABM iPhone/iPad and proceed through Setup Assistant | Fleet withholds the `DeviceConfigured` release command until all setup-experience software is verified installed; install activities stay in the host's Upcoming tab until verified |
| 6 | Wipe the enrolled iPhone/iPad (with and without deleting the host record) and re-run Setup Assistant | Setup-experience software re-installs |
| 7 | Run setup experience under Team A, transfer the host to Team B (different software), wipe, and re-run setup | Team B's software is installed |

### MDM-SOFTWARE-011 — Auto-uninstall managed apps when BYOD iOS/iPadOS hosts unenroll

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** iOS/iPadOS
- **Preconditions:** Premium license active; Apple MDM on; VPP token connected; a personally-owned (BYOD) profile-enrolled iPhone/iPad enrolled; ability to deliver `.ipa` apps.
- **Source:** #35941, #27015

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add a VPP app to the team and install it on the BYOD iOS/iPadOS host, then unenroll the host | The VPP app is uninstalled from the host on unenrollment |
| 2 | Add an `.ipa` app to the team, install it on the BYOD host, then unenroll the host | The `.ipa` app is uninstalled from the host on unenrollment |
| 3 | Send a custom `InstallApplication` MDM command with `ManagementFlags` set to 0 to install a VPP app, then re-send it with `ManagementFlags` set to 1; after acknowledgment, unenroll the host | The app installed with the managed flag is removed during unenrollment |
| 4 | Install a VPP app on a macOS host and remove its enrollment profile | The app is not removed from the macOS host (auto-uninstall is BYOD iOS/iPadOS only) |
| 5 | Confirm the documented copy changes are present in the relevant UI | Copy matches the specified updates |

### MDM-SOFTWARE-012 — Setup experience software list supports search, bulk select, clear, and show-selected

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Premium Fleet; a team with available software (VPP, FMA, and custom apps) in the catalog; Controls > Setup experience software page open
- **Source:** #19372

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the setup experience software page for a team with no software added | The empty state is shown |
| 2 | Review the list of available software | Software is listed in ascending order |
| 3 | Use the search tool to find a specific app | The list filters to matching software |
| 4 | Bulk-select multiple apps, then use clear selection | Selection applies, then clears as expected |
| 5 | Select software and click "Show selected software" | Only the selected software is displayed |
| 6 | Add VPP, FMA, and custom apps to the setup experience | All three app types can be added |
| 7 | Attempt to upload a `.deb`, `.rpm`, `.exe`, and `.msi` file | Each unsupported file type is rejected and cannot be uploaded |

### MDM-SOFTWARE-013 — Software installs and setup script run on first boot during ADE setup experience

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS
- **Preconditions:** Premium Fleet; a team configured with VPP, FMA, and custom apps plus a setup script in the setup experience; a macOS host enrolling via ADE/DEP
- **Source:** #19372

| # | Step | Expected result |
|---|------|-----------------|
| 1 | DEP-enroll the macOS host and proceed through setup experience | The setup experience runs at boot |
| 2 | Wait for software installation to complete | VPP, FMA, and custom apps all install |
| 3 | Wait for the setup script to execute | The setup script runs |
| 4 | Observe the end-user host UI during the flow | swiftDialog shows custom logo, correct copy, a percentage bar, and pending/failed/installed statuses, with a Close button |
| 5 | Verify the flow works for both a configured team and "no team" | Setup experience completes for team and "no team" |
| 6 | Confirm forced disk encryption and forced OS updates workflows complete | Both forced workflows succeed during setup experience |
