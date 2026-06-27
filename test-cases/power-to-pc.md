# Power to the PC — test cases

> Area: `#g-power-to-pc`. Derived from Fleet feature-story test plans
> (oldest→newest, superseded behavior collapsed). GitOps flows live in
> [`gitops.md`](gitops.md). See [`README.md`](README.md) for method/template.
> **Live-verified 2026-06-27 (partial):** MDM/enrollment and certificate settings surfaces present. Most cases here (Windows host-details certificates table, Android MDM commands and Lock/Wipe/Clear-passcode action menus) are host-gated — they need enrolled Windows/Android hosts and were not walked.

## Certificate delivery and host display

### PTP-CERTS-001 — Certificates table displays on Windows host details

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** Fleet Premium with Windows MDM enabled; a Windows host enrolled and reporting at least one certificate via osquery.
- **Source:** #31294

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the enrolled Windows host's Host details page. | The page loads and a Certificates section is shown. |
| 2 | Locate the Certificates table. | The certificates table renders for the Windows host, listing its reported certificates. |
| 3 | Read the help text shown below the certificates table on this Windows host. | The help text below the table is present and reflects the updated wording (matching the equivalent updated text on macOS). |
| 4 | Open a certificate's details modal and compare its fields against the host's osquery certificate data. | Table columns and details-modal fields are correctly populated and mapped from the underlying osquery certificate table. |
| 5 | Inspect a certificate whose scope is reported as "User". | The certificate's scope is shown as User, and that certificate is scoped to that user only (not available to every user on the device). |

### PTP-CERTS-002 — Certificate section is hidden on hosts reporting no certificates

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Windows | macOS
- **Preconditions:** Fleet Premium; an enrolled Windows or macOS host that reports no certificates via osquery.
- **Source:** #31294

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the Host details page for a host that reports zero certificates. | No certificate section/table or help text is rendered; the entire certificate section is hidden. |

### PTP-CERTS-003 — macOS certificate column is labeled "Scope" instead of "Keychain"

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Fleet Premium; an enrolled macOS host reporting at least one certificate.
- **Source:** #31294

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the macOS host's Host details page and view the certificates table. | The certificates table is shown. |
| 2 | Inspect the column that previously read "Keychain". | The column is now labeled "Scope". |

### PTP-CERTS-004 — Fleet delivers certificates with subject alternative name (SAN) attributes

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** Fleet Premium with a custom SCEP certificate authority that supports SAN attributes such as UPN (for example EJBCA) configured; an enrolled Android host targeted by the certificate template.
- **Source:** #41472

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add a certificate template that includes a `subject_alternative_name` (for example `DNS=example.com, UPN=$FLEET_VAR_HOST_END_USER_IDP_USERNAME`) via the API or YAML, issuing from the SAN-capable SCEP CA. | The template is saved with both `subject_name` and `subject_alternative_name` persisted; `GET` of the certificate template returns the configured SAN. |
| 2 | Let Fleet deliver the certificate to the targeted Android host. | The certificate is delivered to the Android host successfully. |
| 3 | Inspect the delivered certificate on the host (or via the SCEP CA) and check its SAN field. | The certificate carries the expected SAN, with `$FLEET_VAR_*` variables resolved to the host's values (for example the UPN populated with the host end user's IdP username), matching the reference SAN certificates. |

## Android MDM commands

### PTP-ANDROID-001 — Android MDM commands appear in CLI and API when profiles or self-service software are added

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** Fleet Premium with Android MDM (Android Enterprise) connected; at least one enrolled Android host on a team; global admin access with `fleetctl` configured against the server.
- **Source:** #33158

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add one or more new configuration profile(s) to the team that the enrolled Android host belongs to. | Profile is saved and an Android MDM command is generated to deliver it to the host. |
| 2 | Add self-service software to the same team. | Software is added and a corresponding Android MDM command is generated. |
| 3 | Run `fleetctl get mdm-commands`. | The Android commands for the profile and self-service software changes are listed, with fields matching the documented specs (command UUID, status, request type, hostname/UUID, and timestamp). |
| 4 | Take a command UUID from the list and run `fleetctl get mdm-command-results --id <uuid>`. | Per-host results for that command are returned, with the result fields matching the documented specs. |

### PTP-ANDROID-002 — Android action menu hides Lock, Unenroll, Wipe, and Clear passcode while a command is pending

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Android
- **Preconditions:** Fleet Premium with Android MDM connected; an enrolled Android host (BYO or company-owned/fully managed) with MDM enabled; user has permission to run host actions.
- **Source:** #41683

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the Host details page, trigger one of Lock, Unenroll, Wipe, or Clear passcode and confirm it so the command is pending. | The command enters a pending state. |
| 2 | Reopen the Actions menu on the same host. | Lock, Unenroll, Wipe, and Clear passcode options are hidden from the menu while any of those commands is pending. |

### PTP-ANDROID-003 — Android action menu hides Lock, Unenroll, Wipe, and Clear passcode when MDM is disabled

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Android
- **Preconditions:** Fleet Premium; an Android host (BYO or company-owned/fully managed) that is enrolled but has MDM disabled.
- **Source:** #41683

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the Host details page for the Android host with MDM disabled. | Host details load. |
| 2 | Open the Actions menu. | Lock, Unenroll, Wipe, and Clear passcode options are not present in the menu. |

### PTP-ANDROID-004 — Clear passcode and Lock manage a BYO Android work profile

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** Fleet Premium with Android MDM connected; a BYO (personal/work-profile) Android host enrolled with MDM enabled and a passcode set on the work profile; user can run host actions.
- **Source:** #41683

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the Actions menu on the BYO Android Host details page. | Clear passcode and Lock options are shown; Wipe is not offered for BYO. |
| 2 | Choose Clear passcode. | A confirmation modal opens with the Clear passcode button disabled. |
| 3 | Check the confirmation checkbox in the modal. | The Clear passcode button becomes enabled. |
| 4 | Confirm Clear passcode and observe the device. | The current passcode is removed from the work profile. |
| 5 | Choose Lock from the Actions menu, check the checkbox to enable the Lock button, and confirm. | The host screen locks, and the user's passcode can unlock the host. |

### PTP-ANDROID-005 — Clear passcode, Lock, and Wipe manage a company-owned Android host

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** Fleet Premium with Android MDM connected; a company-owned / fully managed Android host enrolled with MDM enabled and a passcode set; user can run host actions.
- **Source:** #41683

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the Actions menu on the company-owned Android Host details page. | Clear passcode, Wipe, and Lock options are all shown. |
| 2 | Choose Clear passcode; verify the modal button is disabled until the checkbox is clicked, then confirm. | After checking the checkbox the button enables; confirming removes the current passcode from the host. |
| 3 | Choose Lock; verify the button is disabled until the checkbox is clicked, then confirm. | The host screen locks and the user's passcode can unlock the host. |
| 4 | Choose Wipe; verify the button is disabled until the checkbox is clicked, then confirm. | The host is wiped, removing everything (typically a factory reset). |

### PTP-ANDROID-006 — Android Lock, Wipe, Unenroll, and Clear passcode are recorded in global and host activity feeds

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** Fleet Premium with Android MDM connected; both a BYO and a company-owned/fully managed Android host available; ability to run Lock, Wipe (company-owned), Unenroll (BYOD), and Clear passcode.
- **Source:** #41683

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Run Clear passcode on an Android host, then check the global activity feed. | A new `Clear passcode` activity type is recorded for the host. |
| 2 | Lock an Android host, then check both the global and host activity feeds. | A locked activity is recorded in both feeds. |
| 3 | Wipe a company-owned/fully managed Android host, then check both feeds. | A wiped activity is recorded in both feeds. |
| 4 | Unenroll a BYOD Android host, then check both feeds. | An unenrolled activity is recorded in both feeds. |

## Windows MDM enrollment and configuration profiles

### PTP-WIN-001 — Deleting a Windows configuration profile resets enforced settings and shows pending state

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** Fleet Premium with Windows MDM turned on; an enrolled Windows host; one or more configuration profiles (test with a large set from docs/solutions/windows/configuration-profiles) currently applied via Controls > OS settings.
- **Source:** #33418

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to Controls > OS settings and confirm the configuration profiles are applied to the Windows host. | Profiles show as verified/applied; their settings are enforced on the device. |
| 2 | Delete one of the configuration profiles from Controls > OS settings. | The delete command is issued; the host is not left in a bad state. |
| 3 | Observe the OS settings status for the deleted profile on the host. | Status shows a pending state with an explanatory tooltip; it never enters a failed state. |
| 4 | Wait for the delete command to be processed on the device. | Windows resets the affected settings to defaults (parity with macOS); the previously enforced settings are no longer applied. |
| 5 | Repeat with a profile whose settings Windows cannot reset via the delete command. | Fleet still treats the profile as deleted (it is removed from OS settings) even though the device-side reset may not take effect. |

### PTP-WIN-002 — Deleting a Windows certificate profile removes the certificate

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Windows
- **Preconditions:** Fleet Premium with Windows MDM turned on; an enrolled Windows host with a certificate delivered via a configuration profile.
- **Source:** #33418

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In Controls > OS settings, confirm the certificate profile is applied to the Windows host. | The certificate appears as delivered on the host. |
| 2 | Delete the certificate profile. | The delete command is issued and the host is not left in a bad state. |
| 3 | Wait for the command to process and re-check the host. | The certificate is removed from the device and the profile no longer appears in OS settings. |

### PTP-WIN-003 — Windows OS updates deadline and grace period validation and removal

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Windows
- **Preconditions:** Fleet Premium with Windows MDM turned on; an enrolled Windows host; access to Controls > OS updates > Windows.
- **Source:** #33418

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In Controls > OS updates > Windows, set a deadline and a grace period, then save. | Settings save successfully and are enforced on the host. |
| 2 | Clear the deadline (leave it empty) and also clear the grace period, then save. | Settings save successfully; an empty deadline is allowed. |
| 3 | Clear only the deadline, leave a non-empty grace period, then save. | Save is blocked with an error on the grace period field stating it must also be empty to save settings. |
| 4 | Remove both the deadline and grace period and save. | The settings are no longer enforced on the host. |

### PTP-WIN-004 — Windows enrollment prompts end-user authentication only once

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

### PTP-WIN-005 — Windows MDM enrollment accepts a configured Microsoft Entra v2 access token

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

### PTP-WIN-006 — Windows MDM enrollment is rejected when the Entra v2 client ID is not configured

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

### PTP-WIN-007 — Windows MDM enrollment with a v1 Entra token still works (backward compatibility)

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** Fleet Premium with Windows MDM turned on (WSTEP configured); Entra tenant ID configured in Fleet; the Entra app set to issue v1 tokens (`requestedAccessTokenVersion` = 1); a Windows 10/11 test device.
- **Source:** #46388

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Set the Entra app's `requestedAccessTokenVersion` back to `1` and confirm the tenant ID is configured in Fleet (no client ID required). | The configuration is in place with v1 token issuance. |
| 2 | Re-enroll the Windows device via Settings > Access work or school. | The device enrolls and appears as a Windows host with no regression for v1 customers. |

### PTP-WIN-008 — Entra client ID UI validation, list states, activities, and GitOps lock

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

### PTP-WIN-009 — Entra client IDs round-trip through GitOps and the config API

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Windows
- **Preconditions:** Fleet Premium with Windows MDM turned on; Global Admin or GitOps role; `fleetctl` configured; one or more Entra client IDs configured.
- **Source:** #46388

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Run `fleetctl generate-gitops`. | The output emits `controls.windows_entra_client_ids` containing the configured GUIDs. |
| 2 | Edit the YAML to add or remove a client ID and run `fleetctl gitops`. | Fleet reflects the change. |
| 3 | Send `PATCH /api/latest/fleet/config` with `mdm.windows_entra_client_ids` set to a list of GUIDs, then `GET` the config. | PATCH returns 200 and persists; GET returns the configured GUIDs. |
| 4 | Send `PATCH /api/latest/fleet/config` with `mdm.windows_entra_client_ids` containing a non-GUID entry. | The request returns 422 naming the field. |

### PTP-WIN-010 — Only Global Admin and GitOps roles can edit Entra client IDs

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
