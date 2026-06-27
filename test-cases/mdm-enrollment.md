# MDM Enrollment & Migration — test cases

> Feature area. Effective regression set curated from Fleet feature-story test
> plans (audited: deduped across former product groups; cosmetic/low-value checks
> pruned). Each case keeps its origin story #s in **Source**. See
> [`README.md`](README.md) for conventions; GitOps flows live in [`gitops.md`](gitops.md).

## fleetd packaging & installer enrollment

### ENROLL-001 — fleetd enrolls using the osquery instance identifier

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A local TUF repository built per the story instructions, with fleetd installers built to use the `instance` host identifier. macOS, Windows, and Linux test hosts available. Tested with MDM both enabled and disabled.
- **Source:** #14879

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Build and install a fleetd package configured to use the `instance` host identifier on each OS (MDM enabled and disabled). | Installation completes on macOS, Windows, and Linux. |
| 2 | Let each host enroll into Fleet. | Each host enrolls successfully and appears in the host list. |
| 3 | Inspect the enrolled host's identifier in Fleet/DB. | The osquery node key / host identifier is derived from the osquery `instance` identifier (not the default identifier). |
| 4 | Re-enroll or restart the agent. | The host re-uses the same instance-based identifier and does not create a duplicate host record. |
| 5 | Repeat the full flow with MDM disabled and with MDM enabled. | Behavior is consistent in both MDM states across all three OSs. |

### ENROLL-002 — Config-less fleetd-base packages install and enroll

- **Tier:** Both
- **Priority:** P1
- **Platforms:** macOS | Windows
- **Preconditions:** Access to the base fleetd packages (macOS `fleetd-base.pkg`, Windows `fleetd-base.msi`) and a Fleet instance to enroll into, following the config-less fleetd agent deployment guide.
- **Source:** #16347

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Download the base packages (`fleetd-base.pkg` for macOS, `fleetd-base.msi` for Windows) from the testing distribution location. | Packages download successfully. |
| 2 | Install each base package following the config-less deployment instructions (providing enrollment config at install time). | Installation completes on macOS and on Windows. |
| 3 | Wait for each host to enroll. | Both hosts enroll into Fleet and appear online. |
| 4 | Confirm the installed fleetd components are at the expected up-to-date versions. | The base packages carry current fleetd component versions and update normally. |

### ENROLL-003 — Windows .msi install honors END_USER_EMAIL and FLEET_DESKTOP arguments

- **Tier:** Both
- **Priority:** P2
- **Platforms:** Windows
- **Preconditions:** A Windows fleetd-base `.msi` built via the TUF testing flow with Fleet Desktop included; a Fleet instance and enroll secret available; a Windows host to install on.
- **Source:** #19219

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Install the MSI with `FLEET_DESKTOP=false` (e.g. `msiexec /i fleet-osquery.msi FLEET_URL=... FLEET_SECRET=... FLEET_DESKTOP=false`). | Host enrolls and Fleet Desktop is NOT running. |
| 2 | Install with `FLEET_DESKTOP=1` or omit the flag entirely. | Host enrolls and Fleet Desktop IS running (enabled by default when omitted). |
| 3 | Install with `END_USER_EMAIL="someone@example.com"`. | Host enrolls and the specified end user email is associated with the host in Fleet. |
| 4 | Install without `END_USER_EMAIL`. | Host enrolls with no custom end user email applied. |
| 5 | After a custom email is applied, change/clear the install argument and reinstall. | The previously applied custom email is not cleared automatically (documented behavior). |

### ENROLL-004 — Capture end user email at install time via the --end-user-email flag

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

### ENROLL-005 — Override the generated package filename with fleetctl package

- **Tier:** Both
- **Priority:** P2
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** `fleetctl` configured against a Fleet server; hosts available to install each package type (deb, rpm, msi, pkg).
- **Source:** #29581

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Generate one each of deb, rpm, msi, and pkg with `fleetctl package` using default (no outfile) naming, install them, and verify enrollment | Each package builds with the default filename and the host enrolls successfully |
| 2 | Generate one each of deb, rpm, msi, and pkg specifying a custom output filename, install them, and verify enrollment | Each package builds with the specified custom filename and the host enrolls successfully |

### ENROLL-006 — fleetd enrolls natively on Windows Arm with correct packaging copy

- **Tier:** Both
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** Windows Arm host/VM available. fleetd packages generated for the appropriate OS and architecture (native, no emulation).
- **Source:** #26694, #28714

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Install the generated package on a Windows Arm host of the matching architecture | The host enrolls to Fleet |
| 2 | After enrollment, run a live query against the Windows Arm host | The query returns results from the host |
| 3 | Review the Add hosts / package UI copy against the Figma spec | UI copy matches the approved Figma design |
| 4 | Run `fleetctl package -h` | The help output reflects the updated copy (including arm64 architecture support) |

### ENROLL-007 — Download signed fleetd installers from the UI without security warnings

- **Tier:** Both
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Fleet instance with the Add hosts / download fleetd flow available in the UI. Package inspection tools available (e.g. Suspicious Package for macOS).
- **Source:** #29719, #38137

| # | Step | Expected result |
|---|------|-----------------|
| 1 | From the UI, download the fleetd macOS `pkg` and inspect it with a package tool | The pkg is codesigned and notarized |
| 2 | Install the macOS pkg | Installation completes with no security warning |
| 3 | From the UI, download the Windows `msi` and inspect its signature | The msi is codesigned |
| 4 | Install the msi | Installation completes with no security warning |
| 5 | From the UI, download and install the Ubuntu `deb`, Fedora `rpm`, and Arch Linux `pkg.tar.zst` | Each Linux installer downloads and installs successfully on its platform |

## Apple mobile (iOS/iPadOS) enrollment

### ENROLL-008 — iOS/iPadOS enrollment flow remains functional

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** iOS/iPadOS
- **Preconditions:** Fleet (Premium) with Apple MDM (ABM/APNs) configured for mobile device enrollment, and an available iPhone/iPad.
- **Source:** #19447

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enroll an iPhone or iPad into Fleet MDM through the standard enrollment flow. | The device completes enrollment without errors. |
| 2 | Open the device's Host details page in Fleet. | The iOS/iPadOS host appears as enrolled with its details populated. |

### ENROLL-009 — Enroll a personally owned (BYOD) iOS/iPadOS device with a Managed Apple Account

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

### ENROLL-010 — Set Fleet as the default MDM server for BYOD iOS/iPadOS account-driven enrollment

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

### ENROLL-011 — Support iPod touch as an iOS host

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

## macOS Apple MDM enrollment & migration

### ENROLL-012 — Add end user authentication metadata fields to SSO and automatic enrollment

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

### ENROLL-013 — Run macOS MDM enrollment, migration, and management workflows on a current macOS release

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS
- **Preconditions:** Premium license; Apple MDM configured (APNs, ABM/ADE, SCEP); a EULA, bootstrap package, and end user authentication available for the automatic enrollment team; a DEP-eligible Mac and a manually-enrollable Mac.
- **Source:** #13189, #13669, #19625

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Manually turn on MDM for a Mac per the migration guide | Host reports MDM `On (manual)` in Fleet |
| 2 | Automatically (ADE) enroll a Mac on a team configured with end user auth, a EULA, and a bootstrap package | Enrollment presents IdP login and EULA, installs the bootstrap package, and the host enrolls into Fleet |
| 3 | Migrate a DEP Mac using the default workflow, then repeat with the end user workflow | Each migration moves the host into Fleet MDM successfully |
| 4 | Toggle disk encryption on then off and run the reset/rotate encryption key flow | Encryption enforces and disables; key escrow and rotation succeed |
| 5 | Add, edit, and remove a configuration profile; send a custom MDM command; enforce an OS update minimum version/deadline; run a custom script | Each operation applies on the device and reports the correct status in Fleet |
| 6 | During local account creation, confirm Full Name and Account Name are populated from the end user's IdP attributes, and require the user to wait for configuration profiles before using the Mac | Local account is pre-populated from IdP and the device is held until profiles are delivered |
| 7 | Turn off MDM for the host | Host reports MDM `Off` and management stops |

### ENROLL-014 — Surface and recover from a failed macOS DEP profile assignment

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

### ENROLL-015 — Validate the macOS Tahoe ABM MDM migration workflow

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

### ENROLL-016 — Use the /enroll page for macOS profile-based manual enrollment

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

## Windows MDM enrollment & migration

### ENROLL-017 — Automatically migrate a Windows workstation from a third-party MDM to Fleet

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

### ENROLL-018 — Windows Autopilot and Settings-app enrollment gated by Entra tenant IDs

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

### ENROLL-019 — Windows enrollment prompts end-user authentication only once

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** Fleet Premium with Windows MDM turned on; end user authentication enabled; a Windows test device available to enroll; setup experience software configured where noted.
- **Source:** #40787

| # | Step | Expected result |
|---|------|-----------------|
| 1 | With end user authentication enabled and setup experience software enabled, complete end user authentication during Windows enrollment. | Enrollment proceeds and Fleet opens the browser to show the setup experience software install. |
| 2 | Enroll a device via Autopilot (authenticating with Azure), with end user auth enabled. | After Azure authentication the user is enrolled and Fleet does not prompt again in the browser to authenticate. |
| 3 | Enroll a device via Settings > Access work or school (authenticating with Azure), with end user auth enabled. | After Azure authentication the user is enrolled and Fleet does not prompt again in the browser to authenticate. |
| 4 | With fleetd already installed but MDM not enabled (Windows MDM "manual" option) and the end user authenticated, enroll in MDM and sign in via Settings > Access work or school using a different email. | Fleet updates the host's username to the email used to log in at the Settings > Access work or school login form. |
| 5 | Install fleetd first without the end user authenticating (so it is already prompting for authentication), then go to Settings > Access work or school and authenticate. | Authentication may be requested in Settings and on the My device page; MDM enrollment completes and works as expected when authenticating in both places. |

## Android MDM enrollment

### ENROLL-020 — Turn Android MDM on and off via Android Enterprise and enroll a device with a work profile

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

### ENROLL-021 — Manually enroll a fully-managed company-owned Android device

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

### ENROLL-022 — Connect Android Enterprise through the fleetdm.com proxy

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** Premium Fleet instance with admin access; `DEV_ANDROID_ENABLED` feature flag NOT set.
- **Source:** #23231, #26519

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to `Settings > Integrations > MDM > Android`. | The Android page is visible without the `DEV_ANDROID_ENABLED` flag configured. |
| 2 | Click "Connect" and follow the Android Enterprise creation flow. | Fleet generates a server-unique identifier and sends it to the "Create Android Enterprise" fleetdm.com proxy endpoint to create the enterprise. |
| 3 | Complete the connect flow and inspect subsequent proxy requests. | Fleet stores the returned `fleet_server_secret` and includes it on every subsequent request to the fleetdm.com proxy Android endpoints. |

## IdP authentication before enrollment

### ENROLL-023 — Require IdP authentication before BYOD iOS, iPadOS, and Android enrollment

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

## MDM turn-on & host setup

### ENROLL-024 — Confirm new Fleet instances come pre-populated with queries, policies, and scripts

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

### ENROLL-025 — fleetd installs automatically when MDM is turned on without clearing host vitals

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

### ENROLL-026 — Surface Apple Business Manager assignment and pending hosts

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

### ENROLL-027 — Fleet stays enrolled and reports correct OS after upgrade to macOS/iOS/iPadOS 26

- **Tier:** Both
- **Priority:** P0
- **Platforms:** macOS | iOS/iPadOS
- **Preconditions:** A host enrolled in Fleet running a pre-26 OS, scheduled for upgrade to macOS 26, iOS 26, or iPadOS 26.
- **Source:** #30696

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Upgrade the enrolled host to OS version 26 (macOS/iOS/iPadOS) | Fleet remains installed/enrolled on the host after the upgrade |
| 2 | Check the Device page, Hosts list, and host info via API | The new OS version 26 is reflected in all three |

## Moved in (review placement)

### ENROLL-028 — Puppet-created team automatically inherits the "no team" custom setup assistant

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

## Apple automatic enrollment profile

### ENROLL-029 — Updated default Apple automatic enrollment profile applied on fresh instance

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

### ENROLL-030 — Default enrollment profile not auto-updated on upgraded instances; custom profile override

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

### ENROLL-031 — Error messaging surfaces for invalid or expired ABM token

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

## Windows Entra v2 token enrollment

### ENROLL-032 — Windows MDM enrollment accepts a configured Microsoft Entra v2 access token

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** Windows
- **Preconditions:** Fleet Premium with Windows MDM turned on (WSTEP certificate configured); a Microsoft Entra tenant with an on-prem MDM app forced to issue v2 tokens (`requestedAccessTokenVersion` = 2); the app's Application (client) ID copied; a licensed Entra test user; a freshly wiped Windows 10/11 device; Global Admin in Fleet.
- **Source:** #46388

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In Fleet, go to Settings > Integrations > MDM > Microsoft Entra > Windows enrollment; confirm the tenant ID is added, then under Entra application client IDs add the client ID from setup. | The tenant ID and client ID are saved. |
| 2 | On the test device, enroll via Settings > Access work or school > Connect, signing in with the Entra test user. | The device enrolls and appears in Fleet as a Windows host. |
| 3 | (Optional) Decode the enrollment token at jwt.ms. | The `aud` claim is the client ID GUID, not a URL. |

### ENROLL-033 — Windows MDM enrollment is rejected when the Entra v2 client ID is not configured

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** Same as the positive Entra v2 case, with the Entra app issuing v2 tokens; the device previously enrolled; ability to read the Fleet server debug log.
- **Source:** #46388

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In Fleet, remove the client ID under Settings > Integrations > MDM > Microsoft Entra > Windows enrollment while keeping the tenant ID. | The client ID is removed; the tenant ID remains. |
| 2 | Unenroll the device, then re-enroll it. | Enrollment fails; the device shows "Device management could not be enabled" (0x801900c8). |
| 3 | Check the Fleet server debug log. | The log shows "token audience is not authorized" with the unexpected `aud` and the configured client IDs. |

### ENROLL-034 — Windows MDM enrollment with a v1 Entra token still works (backward compatibility)

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** Fleet Premium with Windows MDM turned on (WSTEP configured); Entra tenant ID configured in Fleet; the Entra app set to issue v1 tokens (`requestedAccessTokenVersion` = 1); a Windows 10/11 test device.
- **Source:** #46388

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Set the Entra app's `requestedAccessTokenVersion` back to `1` and confirm the tenant ID is configured in Fleet (no client ID required). | The configuration is in place with v1 token issuance. |
| 2 | Re-enroll the Windows device via Settings > Access work or school. | The device enrolls and appears as a Windows host with no regression for v1 customers. |

### ENROLL-035 — Entra client ID UI validation, list states, activities, and GitOps lock

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Windows
- **Preconditions:** Fleet Premium with Windows MDM turned on; Global Admin; access to Settings > Integrations > MDM > Microsoft Entra > Windows enrollment.
- **Source:** #46388

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Under Entra application client IDs, add a client ID with a valid GUID (upper or lower case). | The GUID is accepted and added to the list. |
| 2 | Attempt to add a non-GUID value. | An inline validation error is shown and the value is not added. |
| 3 | Remove a client ID and view both the empty and populated list states. | Both list states render correctly. |
| 4 | After adding then removing a client ID, check the activity feed. | Activities `added_microsoft_entra_client_id` and `deleted_microsoft_entra_client_id` are recorded. |
| 5 | Enable GitOps mode and return to this screen. | The Add and Delete controls are disabled (read-only) with the GitOps tooltip, matching the behavior of tenant IDs. |

### ENROLL-036 — Only Global Admin and GitOps roles can edit Entra client IDs

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Windows
- **Preconditions:** Fleet Premium with Windows MDM turned on; user accounts with Global Admin, GitOps, Maintainer, Observer, and Observer+ roles.
- **Source:** #46388

| # | Step | Expected result |
|---|------|-----------------|
| 1 | As Global Admin, edit the Entra client IDs (add and remove). | Editing is permitted. |
| 2 | As a GitOps role, edit the Entra client IDs. | Editing is permitted. |
| 3 | As Maintainer, then Observer, then Observer+, attempt to edit the Entra client IDs. | Each of these roles is unable to edit the client IDs. |
