# Setup Experience — test cases

> Feature area. Effective regression set curated from Fleet feature-story test
> plans (audited: deduped across former product groups; cosmetic/low-value checks
> pruned). Each case keeps its origin story #s in **Source**. See
> [`README.md`](README.md) for conventions; GitOps flows live in [`gitops.md`](gitops.md).

## Bootstrap package

### SETUP-001 — Install fleetd with a custom configuration via the bootstrap package during ADE setup

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

### SETUP-002 — Reject non-distribution bootstrap packages

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

### SETUP-003 — Install the bootstrap package only during first-time Mac setup, not migration

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | iOS/iPadOS
- **Preconditions:** Premium license; Apple MDM and ABM configured; a bootstrap package added to the host's team; a Mac in ABM enrolled in a non-Fleet MDM; a macOS Tahoe host for the Tahoe migration path.
- **Source:** #31292, #39634

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enroll an ABM Mac to Fleet without turning on MDM features, add a bootstrap package to its team, then trigger the default migration workflow | The host migrates but the bootstrap package is NOT installed |
| 2 | Repeat using the end user migration workflow | The bootstrap package is NOT installed during migration |
| 3 | On a macOS Tahoe host, trigger the new Tahoe migration workflow | The bootstrap package is NOT installed; setup-experience software and scripts do not run during migration |
| 4 | Run the Tahoe migration on iOS/iPadOS hosts | Migration works and VPP apps are still installed |
| 5 | DEP-enroll a brand-new Mac (not a migration) | The bootstrap package, setup-experience software, and scripts all run as part of first-time setup |

## Platform SSO & IdP account creation

### SETUP-004 — Create a macOS local account from IdP credentials via Platform SSO during setup

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Premium license; Apple MDM and ABM/ADE configured; Okta (or supported IdP) configured for Platform SSO per the guide; profiles and the Okta Verify app added to setup experience; a DEP-eligible Mac.
- **Source:** #30674, #45524

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Configure Platform SSO with Okta per the guide and DEP-enroll a Mac, completing setup | The local user account is created during setup and its password is synced with the IdP |
| 2 | With end user authentication enabled, run setup experience deploying the PSSO profiles and Okta Verify app | PSSO is configured and the account-creation/password-sync behavior works |
| 3 | Repeat with end user authentication disabled | PSSO is configured and the behavior still works correctly |
| 4 | Change the user's password in Okta, then lock/logout and log back in on the host with the new password | The password change is synced to the host |

## swiftDialog

### SETUP-005 — Keep swiftDialog foremost and reliable during macOS setup experience

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

## Profile delivery performance

### SETUP-006 — Speed up profile delivery during macOS setup experience

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Premium license; Apple MDM and ABM/ADE configured; 40+ macOS configuration profiles added to the team; setup-experience software and scripts excluded; a DEP-eligible Mac.
- **Source:** #29473

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add 40+ macOS configuration profiles to Fleet with setup-experience software and scripts excluded | Profiles are saved to the team |
| 2 | Enroll an ABM Mac to trigger the new Mac setup flow and time the "Waiting for enrollment server" screen on Remote Management after profiles install | The wait is 1 minute or less |

## Tier gating & permissions

### SETUP-007 — Setup experience option is hidden in Fleet Free and protected when software is in use

- **Tier:** Both
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** A Fleet Free instance and a Premium instance available; on Premium, a software item from the main catalog is assigned to the setup experience
- **Source:** #19372

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Log in to Fleet Free and look for the setup experience option | The setup experience option is not shown on Fleet Free |
| 2 | On Premium, attempt to delete a software item from the main catalog that is being used for setup experience | A restriction modal is shown preventing the deletion |

### SETUP-008 — /enroll copy updated and enrollment succeeds across device types

- **Tier:** Both
- **Priority:** P1
- **Platforms:** macOS | iOS/iPadOS | Android
- **Preconditions:** Access to the end-user `/enroll` page; a Mac, iPhone, iPad, and Android device available to enroll; Figma wireframes for reference
- **Source:** #37190

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open `/enroll` on a Mac, iPhone, iPad, and Android device and compare the copy to the Figma wireframes | The copy is updated to match the wireframes for each device type |
| 2 | Follow the enrollment steps on the Mac, iPhone, iPad, and Android device | Each device successfully enrolls to Fleet |

## Managed local account

### SETUP-009 — Managed local account checkbox gating in Controls > Setup experience > Users

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

### SETUP-010 — Managed local account is created on ADE enrollment and persists across changes

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

### SETUP-011 — Managed local account password decryption and rotation survive upgrade to v4.86

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

## Setup Assistant configuration

### SETUP-012 — Lock end user info controls editing of account name and full name in Setup Assistant

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

### SETUP-013 — Setup Assistant page empty states and permissions

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

## Activity feed

### SETUP-014 — Setup experience software install and script run produce activity feed entries

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Premium Fleet; a macOS host that completed a setup experience including software installs and a setup script run
- **Source:** #19372

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the global Activity feed after the setup experience completes | Setup experience software install and script run activities appear globally |
| 2 | Open the Host details page Activity tab for the same host | The same setup experience activities appear at the host level |

### SETUP-015 — Managed local account creation and password view are logged in activity feeds

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Premium Fleet; a macOS host with the managed local account feature in use
- **Source:** #37141

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Create a managed local account on a host | A creation activity appears in both the global and host-level activity feeds |
| 2 | View the managed account password from the modal | A password-viewed activity appears in both the global and host-level activity feeds |

### SETUP-016 — Managed local account rotation activities credit the correct actor

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

## Software install during setup

### SETUP-017 — Install setup-experience software on company-owned iOS/iPadOS hosts at enrollment

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** iOS/iPadOS
- **Preconditions:** Premium license active; macOS/Apple MDM on; VPP/App Store apps available for iOS/iPadOS in the team; an ABM company-owned iPhone/iPad ready to enroll.
- **Source:** #27015, #28738, #30890

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the Setup experience > Install software flow for an iOS/iPadOS team and open the Select software modal | Only software available for the target platform is listed; search filters the list |
| 2 | Select software, save, and view the page | The page UI state updates to reflect the saved selection and a global activity entry is logged for the edit |
| 3 | On the Software title details page, attempt to delete a title selected for setup experience | An easy-to-understand error message is shown and deletion is blocked |
| 4 | Add setup-experience software via API with platform "ios"/"ipados", then with a made-up platform | The valid platforms succeed; the made-up platform returns an error; deleting a selected title via API returns a clear error |
| 5 | Automatically enroll an ABM iPhone/iPad and proceed through Setup Assistant | Fleet withholds the `DeviceConfigured` release command until all setup-experience software is verified installed; install activities stay in the host's Upcoming tab until verified |
| 6 | Wipe the enrolled iPhone/iPad (with and without deleting the host record) and re-run Setup Assistant | Setup-experience software re-installs |
| 7 | Run setup experience under Team A, transfer the host to Team B (different software), wipe, and re-run setup | Team B's software is installed |

### SETUP-018 — Software installs and setup script run on first boot during ADE setup experience

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS
- **Preconditions:** Premium Fleet; a team configured with VPP, FMA, and custom apps plus a setup script in the setup experience; a macOS host enrolling via ADE/DEP
- **Source:** #19372, #30035

| # | Step | Expected result |
|---|------|-----------------|
| 1 | DEP-enroll the macOS host and proceed through setup experience | The setup experience runs at boot |
| 2 | Wait for software installation to complete | VPP, FMA, and custom apps all install |
| 3 | Wait for the setup script to execute | The setup script runs |
| 4 | Observe the end-user host UI during the flow | swiftDialog shows custom logo, correct copy, a percentage bar, and pending/failed/installed statuses, with a Close button |
| 5 | Verify the flow works for both a configured team and "no team" | Setup experience completes for team and "no team" |
| 6 | Confirm forced disk encryption and forced OS updates workflows complete | Both forced workflows succeed during setup experience |

### SETUP-019 — macOS setup experience blocks the end user when critical software fails to install

- **Tier:** Premium
- **Priority:** P0 (smoke/release-critical)
- **Platforms:** macOS
- **Preconditions:** Fleet Premium with MDM (Apple ADE) configured; a team with the "Don't let end user through if critical software fails" setting enabled under Controls > Setup experience > Install software > macOS; setup-experience software added that is known to fail installation; a macOS host ready to run the ADE setup experience.
- **Source:** #30117

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to Controls > Setup experience > Install software > macOS, expand the accordion, and enable the new "block end user if critical software fails" setting. | Setting saves; preview video and accordion render correctly. |
| 2 | Add software that will fail to install on macOS, then run the macOS ADE setup experience on a fresh host. | Setup-experience software install UI renders inside the swiftDialog web view. |
| 3 | Let the failing software attempt installation. | An error message is displayed for the failed install; no subsequent software is installed after the failure. |
| 4 | Press CMD+SHIFT+X in the dialog (the "break glass" flow). | Dialog closes and setup completes. |
| 5 | On a second run with the same failing software, follow the on-screen instructions to restart the Mac after the error appears, then let the host reach the setup-experience page again. | Software that already installed successfully is not re-installed; Fleet resumes installing starting with the software that previously failed. |

### SETUP-020 — macOS setup experience continues past a failed install when the critical-software setting is off

- **Tier:** Premium
- **Priority:** P1 (core regression)
- **Platforms:** macOS
- **Preconditions:** Fleet Premium with Apple ADE configured; a team whose Controls > Setup experience > Install software > macOS "block end user if critical software fails" setting is unchecked/saved; setup-experience software added that will fail to install; a setup script added; a macOS host ready to run the ADE setup experience.
- **Source:** #30117

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Uncheck the "block end user if critical software fails" setting and save, keeping the failing software and adding a setup script. | Setting saves with the failing software and script still configured. |
| 2 | Run the macOS setup experience on a fresh host and let the failing software attempt installation. | The failing item shows as "Failed" in the window, but setup continues rather than blocking. |
| 3 | Observe the setup script in the progress list. | Script appears in the list and shows "Running"/"Ran" status (not "Installing"/"Installed"). |

### SETUP-021 — Setup experience automatically retries failed software installs and records every result

- **Tier:** Premium
- **Priority:** P1 (core regression)
- **Platforms:** All
- **Preconditions:** Fleet Premium with setup experience configured on a team; for macOS, a fleetd-base installer from `edge`; a software installer whose install and/or post-install scripts have been edited to fail or randomly fail; hosts on macOS, Linux, and Windows.
- **Source:** #31917

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Run the setup experience with a normal (non-failing) software install on macOS, Linux, and Windows. | Software installs succeed with no regressions to normal setup-experience or standalone installs. |
| 2 | Configure a software installer that fails or randomly fails (via edited install/post-install scripts) and run the setup experience. | Fleet retries the install rather than immediately giving up. |
| 3 | Let the install reach a terminal state (eventual success or final failure). | Every result, whether it ultimately fails or succeeds, appears in the activity feed. |

### SETUP-022 — Setup experience installs team software when personally-owned iOS/iPadOS hosts enroll

- **Tier:** Premium
- **Priority:** P1 (core regression)
- **Platforms:** iOS/iPadOS
- **Preconditions:** Fleet Premium with Apple MDM/VPP configured; Team A and Team B each with different setup-experience software assigned for iOS/iPadOS; an iPhone and an iPad available for profile-based BYOD (user) enrollment via the `/enroll` URL from the "Add hosts" modal.
- **Source:** #27015, #34042

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the iOS and iPadOS setup-experience tabs and review the copy. | Copy is updated with the word "automatically" removed. |
| 2 | Manually (profile-based user) enroll an iPhone and an iPad to Team A using the `/enroll` URL from the "Add hosts" modal. | Team A's setup-experience software installs on each personally-owned device. |
| 3 | Open the Host details page for each enrolled device and review the software install activities. | Software install activities show up on Host details and remain in the Upcoming tab until Fleet verifies the installation. |
| 4 | Transfer a profile-enrolled host from Team A to Team B (which has different software). | Team B's software is NOT installed on the transferred host. |

### SETUP-023 — Android BYOD setup-experience app auto-installs on enrollment

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** Android
- **Preconditions:** Team with an Android app configured as setup experience software; enrollment (/enroll) URL available from the "Add hosts" modal.
- **Source:** #33761, #36859

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On a personally-owned (BYOD) Android device, manually enroll using the /enroll URL from the "Add hosts" modal. | Device enrolls and the work profile is created. |
| 2 | Wait for enrollment to complete. | The setup experience app is automatically installed in the work profile. |
| 3 | On the Software title page, check the Installed count; check the host's inventory. | App appears in the host's software inventory and the "Installed" count is incremented on the Software title page. Note: software library is not supported for Android, so status surfaces via inventory and the title page count. |

## Setup-experience software selection UI

### SETUP-024 — Setup experience software list supports search, bulk select, clear, and show-selected

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Premium Fleet; a team with available software (VPP, FMA, and custom apps) in the catalog; Controls > Setup experience software page open
- **Source:** #19372, #24989

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the setup experience software page for a team with no software added | The empty state is shown |
| 2 | Review the list of available software | Software is listed in ascending order |
| 3 | Use the search tool to find a specific app | The list filters to matching software |
| 4 | Bulk-select multiple apps, then use clear selection | Selection applies, then clears as expected |
| 5 | Select software and click "Show selected software" | Only the selected software is displayed |
| 6 | Add VPP, FMA, and custom apps to the setup experience | All three app types can be added |
| 7 | Attempt to upload a `.deb`, `.rpm`, `.exe`, and `.msi` file | Each unsupported file type is rejected and cannot be uploaded |

### SETUP-025 — Add Android setup-experience software via API and platform validation

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Android
- **Preconditions:** Team with managed Google Play connected; API access.
- **Source:** #33761

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Via the API, add setup experience software with `platform` set to `"android"`. | Software is added as Android setup experience software. |
| 2 | Via the API, try to delete the software that is selected for setup experience. | Deletion behaves as designed (the API responds rather than leaving the host in a broken state). |
| 3 | Via the API, add setup experience software with `platform` set to an unsupported/made-up value. | Request is rejected with a clear, easy-to-understand error message. |

### SETUP-026 — Setup experience entry point reflects whether software is selected

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Logged in as a maintainer/admin; on a team (or "No team") in Controls.
- **Source:** #24989

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to Controls > Setup experience for a team that has no setup-experience software selected. | An "Add software" button is shown. |
| 2 | Select software, save, then return to Controls > Setup experience. | The button now reads "Show selected software" instead of "Add software". |

### SETUP-027 — Clicking a software row opens the software details page

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Setup experience software modal is open with at least one software item.
- **Source:** #24989

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Click a software name/row in the modal. | The user is taken to that software's details page, where targets can be edited. |

## Cross-platform setup experience (Linux/Windows)

### SETUP-028 — Linux end-user setup experience installs configured software and shows progress states

- **Tier:** Premium
- **Priority:** P1 (core regression)
- **Platforms:** Linux
- **Preconditions:** Fleet Premium; a team with Linux setup-experience software added under Controls > Setup experience > Install software > Linux; a Linux host running fleetd with Fleet Desktop, matching the package flavor of the configured software.
- **Source:** #30877

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Before adding any software, open Controls > Setup experience > Install software > Linux for a team with no Linux software available and for a team with software available but none added. | Each empty/available-but-unadded UI state renders correctly. |
| 2 | Add a compatible Linux software item via the add-software modal and save. | Modal UI is correct; the page updates to reflect the saved software. |
| 3 | Enroll the Linux host and start Fleet Desktop. | A browser window pops open automatically when Fleet Desktop starts running. |
| 4 | Watch the setup-experience page as installs run. | Proper loading and completed states appear as installs finish; the page reloads automatically once all setup is complete. |
| 5 | Add a package built for a different Linux flavor, then run setup on the original host. | The incompatible-flavor package does not appear in the end-user experience. |
| 6 | Add a Linux package that will error, then run the end-user experience. | The erroring item shows as "Failed". |
| 7 | Run the setup experience on a Linux host with no browser installed. | Software still installs despite the absence of a browser. |

### SETUP-029 — Windows end-user setup experience installs software across enrollment methods and logs edits

- **Tier:** Premium
- **Priority:** P1 (core regression)
- **Platforms:** Windows
- **Preconditions:** Fleet Premium with Windows MDM configured; a team with Windows setup-experience software added under Controls > Setup experience > Install software > Windows; Windows hosts available for Autopilot, manual, and automatic (non-Autopilot) enrollment.
- **Source:** #30878

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Controls > Setup experience > Install software > Windows for a team with no software available and for a team with software available but none added. | Each empty/available-but-unadded UI state renders correctly. |
| 2 | Add Windows setup-experience software via the modal and save. | Modal UI is correct, the page state updates, and a global `edited_setup_experience_software` activity is logged for Windows. |
| 3 | Enroll a Windows host via Autopilot and start Fleet Desktop. | A browser window pops open when Fleet Desktop starts; loading/completed states appear as installs finish; the page reloads when all setup completes. |
| 4 | Repeat the end-user setup flow with a manually enrolled host and again with an automatically enrolled (non-Autopilot) host. | Setup experience runs and completes correctly for both enrollment methods. |
| 5 | Add software that will error and run the end-user experience. | The erroring item shows as "Failed". |
| 6 | Uninstall then reinstall fleetd, then reinstall fleetd a second time. | Uninstalling and reinstalling fleetd triggers the setup experience again; a plain re-install (without uninstall) does not re-trigger it. |

### SETUP-030 — Windows and Linux setup experience requires end-user SSO before any actions run

- **Tier:** Premium
- **Priority:** P0 (smoke/release-critical)
- **Platforms:** Windows | Linux
- **Preconditions:** Fleet Premium with SSO/IdP configured and end-user authentication enabled on the target team (MDM is NOT required); team configured with setup-experience software, policies, scheduled scripts, and (Windows) configuration profiles; Windows and Linux hosts running fleetd 1.50+.
- **Source:** #31924

| # | Step | Expected result |
|---|------|-----------------|
| 1 | With end-user authentication enabled, enroll a Windows host and start setup. | An SSO/IdP window pops up before the setup experience starts; the host does not appear as enrolled in Fleet while the SSO window is open. |
| 2 | Fail authentication in the SSO window. | Setup experience does not continue. |
| 3 | Restart the computer. | The SSO window pops up again. |
| 4 | Complete SSO successfully. | Setup experience continues as normal. |
| 5 | Confirm gating during the unauthenticated window: check that setup-experience software is not installed, policies do not run, scheduled scripts do not run, Windows configuration profiles are not applied, and Fleet Desktop does not appear until after the end user authenticates. | None of these actions occur before authentication; all proceed only after successful SSO. |
| 6 | Repeat steps 1-5 on a Linux host. | Same SSO-before-actions behavior holds on Linux. |
| 7 | Close the default browser showing the IdP login screen, then restart the computer. | After closing the browser, the end user must restart to get the IdP screen to reappear; on restart the IdP screen shows again (behavior documented in the guide). |
| 8 | Enroll a host running fleetd older than 1.50 to a team with end-user authentication enabled. | The host enrolls without end-user authentication and no IdP auth screens are shown. |

## Label-scoped setup software

### SETUP-031 — Setup experience installs label-scoped software only on in-scope hosts (manual label)

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS
- **Preconditions:** ABM connected with devices added but not yet enrolled. A manual label exists; a setup-experience software item is scoped to that manual label. One target host is in scope (has the label) and one is out of scope.
- **Source:** #24989

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Apply the manual label to the in-scope host. | The host is a member of the label. |
| 2 | Enroll both hosts and let them run through the setup experience. | The in-scope host installs the scoped software; the out-of-scope host does not install it. |

### SETUP-032 — Setup experience installs label-scoped software only on in-scope hosts (dynamic label)

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS
- **Preconditions:** ABM connected with devices added but not yet enrolled. A dynamic label exists; a setup-experience software item is scoped to that dynamic label. One target host will match the dynamic query and one will not.
- **Source:** #24989

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enroll both hosts and let the dynamic label resolve, then run through the setup experience. | The host matching the dynamic label installs the scoped software; the non-matching host does not. |
| 2 | Confirm timing of the install relative to label resolution. | Software install begins only after the dynamic label has been evaluated, so scoping is applied consistently (no race where install precedes label processing). |
