# Orchestration — test cases

> Area: `#g-orchestration`. Derived from Fleet feature-story test plans
> (oldest→newest, superseded behavior collapsed). GitOps flows live in
> [`gitops.md`](gitops.md). See [`README.md`](README.md) for method/template.
> Not yet live-verified.

## Server, Settings & Identity

### ORCH-PLATFORM-001 — Authenticate to RDS MySQL and ElastiCache Redis via AWS IAM

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Fleet deployed in AWS with reachable RDS (MySQL) and ElastiCache (Redis) instances; IAM roles configured so the Fleet host can request IAM auth tokens.
- **Source:** #1817

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Set `mysql_address` to the RDS endpoint and `mysql_region`, leaving `mysql_password` and `mysql_password_path` unset; start Fleet. | Fleet connects to MySQL using IAM authentication. |
| 2 | Additionally set `mysql_sts_assume_role_arn` (first without, then with `mysql_sts_external_id`); save some queries each time. | Queries save successfully in both assume-role scenarios. |
| 3 | Set `redis_address` to the ElastiCache endpoint with `redis_cache_name` and `redis_region`, leaving `redis_password` unset; start Fleet. | Fleet connects to Redis using IAM authentication. |
| 4 | Additionally set `redis_sts_assume_role_arn` (first without, then with `redis_sts_external_id`); run live queries each time. | Live queries run successfully in both assume-role scenarios. |
| 5 | For both MySQL and Redis, set username and password alongside the AWS config. | Basic auth is used regardless of the other AWS-specific config. |

### ORCH-PLATFORM-002 — Side navigation uses updated styles and truncates long text

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Fleet instance reachable; an enrolled device with a `/device/:token` token available for the self-service check.
- **Source:** #16846

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Visit `/settings/organization`, `/settings/integrations`, `/controls/os-settings`, `/controls/setup-experience`, and `/device/:token/self-service`. | Side-nav styling matches the updated Figma design on every page. |
| 2 | Increase the browser font size to very large and return to a settings page. | Side-nav text does not wrap; long names are truncated with an ellipsis. |
| 3 | Hover over a truncated side-nav item. | A tooltip shows the full item name. |

### ORCH-PLATFORM-003 — Windows automatic enrollment page links to the external guide

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Windows
- **Preconditions:** Premium Fleet instance with Windows MDM available; admin access.
- **Source:** #17972

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to `/settings/integrations/automatic-enrollment/windows`. | The description link points to the external guide (not in-UI instructions). |
| 2 | Review the URL fields referenced by the guide on the page. | The required URL fields are present and copyable. |
| 3 | Review the rest of the page for the old setup instructions. | All other in-UI configuration instructions have been removed. |

### ORCH-PLATFORM-004 — View software details from the My device page

- **Tier:** Both
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Host enrolled with Fleet Desktop and software inventory populated; access to the host's My device page.
- **Source:** #23315

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the My device page, hover over a software row. | A "Show details" link appears. |
| 2 | Click the "Show details" link. | The software details modal opens. |
| 3 | Tab to focus a software row and press Enter. | The software details modal opens via keyboard. |
| 4 | Review the details modal for a software item. | Version, Type, Last used, File path, and Vulnerabilities are shown. |

### ORCH-PLATFORM-005 — List all installable software across teams via the public list-software API

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Premium Fleet instance with self-service software (at least one macOS, one Windows, and one Linux package) assigned to two different teams; a valid user API token.
- **Source:** #23824

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Send `GET /api/v1/list-software` with no Authorization header. | Returns `401 Unauthorized`. |
| 2 | Send `GET /api/v1/list-software` with `Authorization: Bearer ${apiToken}`. | Returns the list of software on the instance. |
| 3 | Send `GET /api/v1/list-software?platform=darwin`. | Returns macOS software, each item's nested `teams` array listing the name and ID of every assigned team. |
| 4 | Send the request with `platform=windows`, then `platform=linux`. | Each returns the respective platform's software with correct `teams` arrays. |
| 5 | Send `GET /api/v1/list-software?platform=chrome`. | Returns `400 Bad Request`. |

### ORCH-PLATFORM-006 — Prompt to create a label when adding a profile with no labels available

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Premium Fleet instance; a team with no labels defined for the no-labels case and a team with labels for the redirect-absent case.
- **Source:** #23830

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On `/controls/os-settings/custom-settings?team_id=<#>` with existing labels, click "Add profile". | No redirect to label creation is shown. |
| 2 | On the same page for a team with no labels, click "Add profile". | A redirect prompt to the New label page is shown. |
| 3 | Follow the redirect. | Navigates to `/labels/new/dynamic`. |
| 4 | Create a label, then re-open the "Add profile" modal. | The new label is present and the redirect prompt is gone. |
| 5 | Repeat steps 1-4 on `/software/add/app-store`, `/software/add/package`, `/software/add/fleet-maintained`, and `/queries/new`. | Each page shows the same no-labels redirect behavior. |

### ORCH-PLATFORM-007 — Consistent "Couldn't add" error copy for software upload failures

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Premium Fleet instance with software upload available.
- **Source:** #24586

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Trigger software add/upload error flows in the UI. | Error messages use the standardized "Couldn't add" wording with no leftover "Couldn't upload" copy. |
| 2 | Review the affected UI areas for layout issues with the new copy. | No UI/layout issues result from the new text. |

### ORCH-PLATFORM-008 — MSP dashboard transfers all-teams software to newly created teams

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** MSP (bulk-operations) dashboard connected to a Premium Fleet instance with 2 teams; one software installer on a single team and one on both teams; ability to run the `detect-new-teams-and-transfer-software` script.
- **Source:** #24684

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the MSP dashboard software page, check assignment of the software deployed to both teams. | It is not shown as assigned to "All teams". |
| 2 | Open the edit modal on the single-team software, select "Deploy to all current and future teams", and save. | The software now shows as assigned to "All teams". |
| 3 | On the Fleet instance, create a new team, then run `detect-new-teams-and-transfer-software`. | Software assigned to "All teams" is transferred to the new team; the two-team software is not transferred. |
| 4 | Remove the all-teams software from one team on the Fleet instance, then run the script again. | The all-teams software is copied back to the team it was removed from. |

### ORCH-PLATFORM-009 — MSP dashboard signs in via Entra ID SSO

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** MSP dashboard running locally with Entra SSO config (`entraClientId`, `entraTenantId`, `entraClientSecret`) set and redirect URI registered; a test user in Entra.
- **Source:** #24688

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Start the MSP dashboard with Entra SSO config set. | Terminal logs "Entra SSO enabled. The built-in authorization mechanism will be disabled." |
| 2 | Navigate to the app. | Redirected to the Microsoft Entra login screen. |
| 3 | Enter the test user's credentials (completing any required 2FA). | Login succeeds and redirects back to the profiles page. |
| 4 | Open the account page and click "Edit profile". | The user's email address field cannot be edited. |

### ORCH-PLATFORM-010 — Connect Android Enterprise through the fleetdm.com proxy

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** Premium Fleet instance with admin access; `DEV_ANDROID_ENABLED` feature flag NOT set.
- **Source:** #26519, #23231

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to `Settings > Integrations > MDM > Android`. | The Android page is visible without the `DEV_ANDROID_ENABLED` flag configured. |
| 2 | Click "Connect" and follow the Android Enterprise creation flow. | Fleet generates a server-unique identifier and sends it to the "Create Android Enterprise" fleetdm.com proxy endpoint to create the enterprise. |
| 3 | Complete the connect flow and inspect subsequent proxy requests. | Fleet stores the returned `fleet_server_secret` and includes it on every subsequent request to the fleetdm.com proxy Android endpoints. |

### ORCH-PLATFORM-011 — Re-verify Linux disk encryption after a key change

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Linux
- **Preconditions:** Premium Fleet instance with a Linux host (LUKS-capable) ready to enroll into a team where disk encryption can be enforced.
- **Source:** #26693

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In Controls > OS settings, enforce disk encryption for a team and add the Linux host to that team. | Disk encryption is enforced for the team. |
| 2 | On the host's My device page, follow the prompts to escrow a key. | The disk encryption prompt disappears and the host shows as verified in Fleet. |
| 3 | On the Linux device, edit the disk encryption key. | Fleet shows the host as pending; a banner appears on both the host details page and My device. |
| 4 | On My device, follow the escrow instructions again. | The prompt disappears and the host returns to verified. |
| 5 | Use the newly escrowed key to unlock the Linux device. | The device unlocks with the new key. |

### ORCH-PLATFORM-012 — Enrolled-host activity and webhook include the host ID

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet instance with activity-feed automations (audit log + webhook) configured; a host ready to enroll.
- **Source:** #26695

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Configure activity feed automations, then enroll a new host. | An enrollment audit activity is generated. |
| 2 | Inspect the audit activity payload. | It includes the enrolled host's `id` as `details.host_id`. |
| 3 | Inspect the webhook payload for the enrollment. | It includes the enrolled host's `id` as `details.host_id`. |

### ORCH-PLATFORM-013 — Fleet server URL validation allows HTTP and HTTPS

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Fleet instance with admin access to organization settings where the Fleet server URL is configured.
- **Source:** #27454

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Configure an HTTP Fleet server URL and save. | The HTTP URL is accepted (validation allows it). |
| 2 | Configure an HTTPS Fleet server URL and save. | The HTTPS URL is still accepted; no regression in this UI area. |

### ORCH-PLATFORM-014 — Require a BitLocker PIN for Windows disk encryption

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** Premium Fleet instance with Windows MDM enabled; an encrypted Windows host enrolled into a team; admin and end-user access.
- **Source:** #28133

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In OS settings > Disk encryption, turn on disk encryption and expand Advanced options. | A "Require BitLocker PIN" toggle is visible with a tooltip explaining end users must set a PIN. |
| 2 | Enable "Require BitLocker PIN" and save. | Encrypted Windows hosts without a PIN move to "Action required (pending)"; unencrypted hosts stay "Enforcing (pending)"; macOS/Linux unaffected. |
| 3 | On the Windows host's My device page, click the "Create PIN" link in the yellow disk-encryption banner. | A modal opens with step-by-step instructions to set a PIN via "Manage BitLocker". |
| 4 | Set a PIN in Windows, close the modal, and click Refetch. | The banner disappears and the host moves to "Verified" in admin OS settings. |
| 5 | Enable disk encryption + PIN, save, then uncheck only "Turn on disk encryption" leaving PIN required, and save. | An easy-to-understand error explains disk encryption must be enabled to require a BitLocker PIN. |
| 6 | Via GitOps/API, set `windows_require_bitlocker_pin` true with `enable_disk_encryption` false. | An easy-to-understand error is returned; setting both true mirrors the UI behavior. |

### ORCH-PLATFORM-015 — Disable usage statistics via server config

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Ability to start a Fleet server with custom config; admin access to Settings.
- **Source:** #28220

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Start Fleet with `FLEET_LICENSE_ENABLE_ANALYTICS=false`. | Server starts with usage statistics disabled by config. |
| 2 | Go to Settings > Usage statistics. | The "Enable usage statistics" checkbox is unchecked and disabled. |
| 3 | Observe outgoing telemetry. | No usage statistics are sent. |

### ORCH-PLATFORM-016 — Turn off teams in Fleet Premium via Primo config

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Premium Fleet instance with no teams set up; ability to toggle the `FLEET_PARTNERSHIPS_ENABLE_PRIMO` server config; admin access.
- **Source:** #28221

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enable `FLEET_PARTNERSHIPS_ENABLE_PRIMO` and visit each top-level page. | Static headings appear instead of the teams dropdown. |
| 2 | Go to Settings > Teams. | Empty state is shown; the add-team button is disabled with a tooltip. |
| 3 | In Settings > Users, click "Add user" and edit a user. | Team-assignment radio buttons are disabled with a tooltip in both flows. |
| 4 | Disable Primo, add a team in Settings > Teams, and revisit top-level pages. | Team adds successfully and the teams dropdown reappears. |
| 5 | Re-check Settings > Users: add a user and assign an existing user to the team. | Team assignment is available again and the user saves to the team. |
| 6 | Re-enable Primo, then open the team-assigned user. | The radio pre-selects global; saving converts the user back to global. |

### ORCH-PLATFORM-017 — Search and filter the team dropdown by typing

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Premium Fleet instance with several teams; admin access on a page that shows the teams dropdown.
- **Source:** #28822

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Click into the teams dropdown. | The current team name stays visible and focus styling matches Figma. |
| 2 | Type a known team name. | Typed text replaces the selection, options filter to matches, and the dropdown arrow hugs the text. |
| 3 | Type a long string of random characters. | The "no matches" empty state shows and text scrolls horizontally without overflowing the container. |
| 4 | Click outside the dropdown. | The selection reverts to the original team. |
| 5 | Type a known team name again and select a team from the filtered list. | The team is selected with no regressions. |

### ORCH-PLATFORM-018 — Disk encryption keys render in a distinguishing monospace font

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Premium Fleet instance with at least one escrowed disk encryption key containing both the letter "O" and the digit "0".
- **Source:** #28865

| # | Step | Expected result |
|---|------|-----------------|
| 1 | View the disk encryption key and click the eye button to reveal it. | The key renders in Source Code Pro; "O" and "0" are clearly distinguishable (the zero shows a center dot). |

### ORCH-PLATFORM-019 — Enforce 4-character minimum for end-user auth Entity ID

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Premium Fleet instance with end-user authentication (SSO) configuration available; admin access and GitOps capability.
- **Source:** #29512

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enter `1234` as the Entity ID in the UI and save. | The 4-character Entity ID is accepted. |
| 2 | Apply `4321` as the Entity ID via GitOps. | The Entity ID is accepted via GitOps. |
| 3 | Clear the Entity ID field in the UI and attempt to save. | A validation error is shown. |

### ORCH-PLATFORM-020 — Populate IdP department host vital and profile variable via SCIM

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | iOS/iPadOS
- **Preconditions:** Premium Fleet instance with SCIM configured against a supported IdP (Okta, Entra ID, Google Workspace, or Authentik); a configuration profile using `$FLEET_VAR_HOST_END_USER_IDP_DEPARTMENT`.
- **Source:** #29609

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Configure a department for an IdP user and sync via SCIM. | Fleet fetches the user's department for each supported IdP. |
| 2 | Deploy a configuration profile containing `$FLEET_VAR_HOST_END_USER_IDP_DEPARTMENT` to a host whose user has a department set. | The profile deploys with the department value populated. |
| 3 | Deploy the same profile to a host whose user has no/empty department. | The profile deployment fails. |

### ORCH-PLATFORM-021 — Manage labels from the Labels page per user role

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet instance with several custom (non-built-in) labels and users at global and team levels (admin, maintainer, observer/+).
- **Source:** #29721

| # | Step | Expected result |
|---|------|-----------------|
| 1 | As a global user, open the user dropdown and click "Labels". | Navigates to `/labels`. |
| 2 | As a team-level user, open the user dropdown, then navigate to `/labels`. | The "Labels" option is still shown and the labels page loads (no 403). |
| 3 | On `/labels`, review the list and sort each column. | Labels are sorted alphabetically by name; no built-in labels appear. |
| 4 | As an observer/+, open the "Actions" dropdown and choose "View all hosts". | Only "View all hosts" is offered; it navigates to the hosts page filtered by that label. |
| 5 | As a global admin/maintainer, use Actions > Edit and Actions > Delete (confirming the modal). | Edit opens the edit-label page; delete confirms and removes the label. |
| 6 | As a team admin/maintainer, open Actions on a label they did not author vs. one they did. | "View all hosts" always present; Edit/Delete appear only when the user is the label author. |

### ORCH-PLATFORM-022 — Dogfood FleetBot question answering in Slack

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** FleetBot deployed and connected to the `#help-dogfooding` Slack channel with access to Fleet host data.
- **Source:** #28413, #29749

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In `#help-dogfooding`, @mention FleetBot and ask a question about Fleet's hosts. | FleetBot responds with a relevant answer about the hosts. |

### ORCH-PLATFORM-023 — Global activity logged when a recovery key is escrowed

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Premium Fleet instance with disk encryption enforced on a team; macOS, Windows, and Linux hosts ready to enroll into that team.
- **Source:** #30384

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add a macOS host to the team and follow the end-user disk encryption instructions. | A recovery-key-escrowed activity appears in the global activity feed. |
| 2 | Add a Windows host to the team with disk encryption enforced. | A recovery-key-escrowed activity appears in the feed. |
| 3 | Add a Linux host to the team and follow the end-user disk encryption instructions. | A recovery-key-escrowed activity appears in the feed. |

### ORCH-PLATFORM-024 — Populate host UUID in Windows configuration profiles

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** Premium Fleet instance with Windows MDM enabled and an enrolled Windows host.
- **Source:** #30879

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Create a Windows configuration profile using `$FLEET_VAR_HOST_UUID` and add it to Fleet. | The profile is accepted. |
| 2 | Inspect the profile locally on the host. | The `$FLEET_VAR_HOST_UUID` variable is populated with the host's UUID. |
| 3 | Trigger an osquery refetch. | The profile moves to "Verified". |
| 4 | Upload a profile with `$FLEET_VAR_HOST_UUID` via GitOps, then change and re-upload it. | The variable is honored on each GitOps apply. |
| 5 | On a Fleet Free instance, attempt to add a profile with `$FLEET_VAR_HOST_UUID`. | Fleet Free rejects the profile. |

### ORCH-PLATFORM-025 — Migrate Fleet database from MySQL to MariaDB 11.4

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Fleet instance on Oracle MySQL Community 8.0.32 with ~900 Linux hosts enrolled and data replicating a representative production instance; ability to migrate the DB and repoint Fleet config.
- **Source:** #31288

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Migrate the MySQL 8.0.32 database to a MariaDB 11.4 database. | Data migrates without loss. |
| 2 | Update the Fleet server config to point to MariaDB, then upgrade Fleet to the MariaDB-supporting version. | The upgrade completes successfully against MariaDB. |
| 3 | Run the full smoke-test suite against the MariaDB-backed instance. | All Fleet features work as expected. |

### ORCH-PLATFORM-026 — Read Fleet server private key from AWS Secrets Manager

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Fleet instance in AWS; the server private key stored in AWS Secrets Manager; IAM access for the `server_private_key_arn` options.
- **Source:** #31321

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Configure `server_private_key_arn` (with optional `server_private_key_sts_assume_role_arn` / `server_private_key_sts_external_id`) and start Fleet. | Fleet uses the private key fetched from Secrets Manager. |
| 2 | Confirm Fleet operates using the Secrets Manager key. | Fleet functions correctly with the externally-stored key. |
| 3 | Set both `server_private_key` and `server_private_key_arn` at the same time. | An informative error is shown stating only one can be set at a time. |

### ORCH-PLATFORM-027 — Build iOS/iPadOS labels from IdP-synced host vitals

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** iOS/iPadOS
- **Preconditions:** Premium Fleet instance with an IdP connected under Settings > Integrations; an iOS or iPadOS host enrolled via ADE or BYOD with end-user authentication enabled.
- **Source:** #32072

| # | Step | Expected result |
|---|------|-----------------|
| 1 | After the host enrolls, open its host details "User" card. | "Username" is populated with the email used during ADE/BYOD authentication. |
| 2 | Review IdP-synced fields on the host. | Group and department are synced from the IdP. |
| 3 | Go to Hosts > filter > Add label and create a label based on the host's IdP group or department. | The label is created and includes the host's group/department. |
| 4 | Filter hosts by the new label. | The enrolled iOS/iPadOS host is a member of the label. |

### ORCH-PLATFORM-028 — Log a host_deleted audit activity per deleted host

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet instance with audit-log activities enabled; multiple enrolled hosts; ability to configure a short host-expiry window and call the delete-host APIs.
- **Source:** #33513

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Manually delete a single host via the UI. | A host-deletion activity matching Figma appears in the UI. |
| 2 | Select and delete multiple hosts via the Hosts tab. | One deletion activity per host appears, matching Figma. |
| 3 | Configure a short host-expiry window and let several hosts expire. | One expiry-deletion activity per host appears, matching Figma. |
| 4 | Delete hosts via the Delete host API and the batch-delete-hosts API. | Deletion activities are generated for API-driven deletions with all specified data fields. |
| 5 | Delete the user who deleted a host and re-check the activity. | The existing deletion activity data is unchanged. |

### ORCH-PLATFORM-029 — Populate hardware serial in Windows configuration profiles

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** Premium Fleet instance with Windows MDM enabled and an enrolled Windows host.
- **Source:** #34364

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Create a Windows configuration profile using `$FLEET_VAR_HOST_HARDWARE_SERIAL` and add it to Fleet. | The profile is accepted. |
| 2 | Inspect the profile locally on the host. | The serial number is populated. |
| 3 | Trigger an osquery refetch. | The profile moves to "Verified". |
| 4 | Upload a profile with `$FLEET_VAR_HOST_HARDWARE_SERIAL` via GitOps. | The variable is populated via the GitOps-applied profile. |
| 5 | On a Fleet Free instance, attempt to add a profile with `$FLEET_VAR_HOST_HARDWARE_SERIAL`. | Fleet Free rejects the profile. |

### ORCH-PLATFORM-030 — Show Users (IdP) section on Windows host details

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Windows
- **Preconditions:** Premium Fleet instance with a Windows host enrolled and IdP host vitals available.
- **Source:** #34365

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the host details page for a Windows host. | The Users section is visible. |

### ORCH-PLATFORM-031 — Populate host platform in configuration profiles across platforms

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | iOS/iPadOS
- **Preconditions:** Premium Fleet instance with Windows and Apple MDM enabled; enrolled Windows, macOS, iOS, and iPadOS hosts.
- **Source:** #34716

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Create a Windows configuration profile using `$FLEET_VAR_HOST_PLATFORM` and add it; inspect it locally. | The platform is populated as "windows"; after refetch the profile is "Verified". |
| 2 | Create macOS, iOS, and iPadOS profiles using `$FLEET_VAR_HOST_PLATFORM` and inspect each locally. | The platform is populated as "macos", "ios", and "ipados" respectively; each goes "Verified" after refetch. |
| 3 | Upload the Windows and Apple profiles with `$FLEET_VAR_HOST_PLATFORM` via GitOps. | The variable is populated correctly on GitOps-applied profiles. |
| 4 | On a Fleet Free instance, attempt to add a profile with `$FLEET_VAR_HOST_PLATFORM`. | Fleet Free rejects the profile. |

### ORCH-PLATFORM-032 — Automatically remove Fleet users when removed from the IdP

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Premium Fleet instance with SCIM-connected IdP (Okta, Entra ID, Google Workspace, Authentik, etc.); multiple users including more than one admin and an API-access account.
- **Source:** #36785

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On Settings > Integrations > Identity Providers (IdP), review the description and, with an IdP connected, the "received" copy. | Updated description and "received" copy are displayed. |
| 2 | Connect an IdP via SCIM, then remove a non-admin user from the IdP. | The user is also deleted from Fleet. |
| 3 | Reduce to a single remaining admin account and open the Actions dropdown for it. | "Delete" is disabled with the new tooltip (last admin cannot be removed). |
| 4 | Confirm an API-access account in the IdP-managed set. | API access accounts are not deleted by this feature. |

### ORCH-PLATFORM-033 — Use Username (IdP) email for maintenance-window calendar scheduling

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Premium Fleet instance with calendar integration configured and end-user authentication enabled using Google Workspace as IdP; hosts in teams and in "No team", including some hosts with no associated email.
- **Source:** #37249

| # | Step | Expected result |
|---|------|-----------------|
| 1 | With calendar integration and Google Workspace end-user auth enabled, trigger maintenance-window scheduling for a host that has an IdP email. | The calendar event is scheduled using the host's Username (IdP) email. |
| 2 | Repeat for macOS (with and without MDM), Linux, and Windows hosts in teams and in "No team". | Scheduling uses the IdP email across all platforms and team contexts. |
| 3 | Trigger scheduling for hosts with no associated email. | These hosts are filtered out correctly with no errors. |

### ORCH-PLATFORM-034 — Gzip-compress large API responses without breaking agent communication

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet instance with the gzip-compression flag toggleable; an enrolled host running osqueryd >= 5.21.0 / Orbit >= 1.52.0 with the agent flag on; browser devtools access.
- **Source:** #37944

| # | Step | Expected result |
|---|------|-----------------|
| 1 | With the flag enabled, inspect an API request over 1KB (e.g. the hosts API) in browser devtools, then disable the flag and repeat. | The response is gzipped when the flag is enabled and not gzipped when disabled. |
| 2 | With the flag enabled, run a live query against the host. | osqueryd communication still works. |
| 3 | With the flag enabled, run a script on the host. | Orbit communication still works. |

### ORCH-PLATFORM-035 — Surface Fleet-maintained apps in usage statistics

- **Tier:** Both
- **Priority:** P2
- **Platforms:** macOS | Windows
- **Preconditions:** Fleet instance with the ability to add and remove Fleet-maintained apps on teams and to inspect usage statistics.
- **Source:** #39372

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add macOS and Windows Fleet-maintained apps to teams. | The added apps are listed in usage statistics. |
| 2 | Remove all macOS and Windows Fleet-maintained apps. | The usage-statistics lists update to reflect the removals. |

### ORCH-PLATFORM-036 — Gate IdP host vitals from Google Workspace behind Premium

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Hosted Fleet environment with Google Workspace configured as the IdP; both a Premium and a Free instance available to compare gating.
- **Source:** #42915

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On a Premium instance with Google Workspace IdP, view IdP-sourced host vitals. | Host vitals from Google Workspace are populated. |
| 2 | On a Free instance (or via the backend API directly), attempt to access the Google Workspace IdP host vitals feature. | Both frontend and backend gate the feature to Premium (unavailable on Free). |

### ORCH-PLATFORM-037 — Premium admin sees team dropdown when saving a query as new

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Logged in as a global admin on a Fleet Premium instance with at least one team configured; viewing an existing saved query at `/queries/:id/edit`.
- **Source:** #14801

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Click **Save as new**. | A teams dropdown appears listing "All teams" plus every team in the org. |
| 2 | Remove the "Copy of" prefix so the **Name** field matches the original query name, then click **Save**. | An error flash message indicates the name is not unique; the modal stays open and form fields are retained. |
| 3 | Clear the **Name** field entirely. | The **Save** button becomes disabled and pressing ENTER does not submit the form. |
| 4 | Enter a unique name and select a team, then click **Save**. | The **Save** button is enabled; the query saves to the selected team and the page redirects to the duplicated query. |
| 5 | Click **Back to queries**. | The `/queries/manage` page loads in the context of the team the query was duplicated to. |

### ORCH-PLATFORM-038 — Global maintainer sees team dropdown on Save as new

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Logged in as a global maintainer on a Fleet Premium instance with at least one team configured; viewing a saved query at `/queries/:id/edit`.
- **Source:** #14801

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Click **Save as new**. | A teams dropdown appears listing "All teams" plus every team in the org. |

### ORCH-PLATFORM-039 — Single-team maintainer sees no team dropdown on Save as new

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Logged in as a team maintainer on a Fleet Premium instance with access to exactly one team; viewing a saved query at `/queries/:id/edit`.
- **Source:** #14801

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Click **Save as new**. | No teams dropdown is shown in the modal. |

### ORCH-PLATFORM-040 — Multi-team maintainer sees only assigned teams on Save as new

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Logged in as a team maintainer on a Fleet Premium instance with access to more than one team; viewing a saved query at `/queries/:id/edit`.
- **Source:** #14801

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Click **Save as new**. | A teams dropdown appears listing only the teams assigned to this user. |

### ORCH-PLATFORM-041 — Free admin and maintainer see no team dropdown on Save as new

- **Tier:** Free
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Logged in to a Fleet Free instance as an admin (repeat as maintainer); viewing a saved query at `/queries/:id/edit`.
- **Source:** #14801

| # | Step | Expected result |
|---|------|-----------------|
| 1 | As the Fleet Free admin, click **Save as new**. | No teams dropdown is shown in the modal. |
| 2 | Sign in as a Fleet Free maintainer and click **Save as new** on the same edit page. | No teams dropdown is shown in the modal. |

### ORCH-PLATFORM-042 — Query collects data only from hosts matching custom label targets

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Logged in as a global admin on a Fleet Premium instance with at least one label that applies to a known subset of enrolled hosts.
- **Source:** #16413

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Create a new query in the UI and, in the **Targets** section, select one or more labels. | The query saves with the chosen label targets. |
| 2 | Let the query run on schedule and open its report. | Results are collected only from hosts that have any of the selected labels. |
| 3 | Edit the query to target a single manual label that applies to a different set of hosts and save. | The existing query report is deleted. |
| 4 | Let the updated query run and open its report. | New results come from the different set of hosts matching the new label. |

### ORCH-PLATFORM-043 — Free hides query Targets section and trims Delete label modal text

- **Tier:** Free
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Logged in as an admin on a Fleet Free instance; at least one manual label exists and is applied as a host filter.
- **Source:** #16413

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the **Save query** modal for a new query. | No **Targets** form section is visible. |
| 2 | Open the **Edit query** page for an existing query. | No **Targets** form section is visible. |
| 3 | Go to `/hosts`, select the manual label filter, and click the delete button to open the **Delete label** modal. | The confirmation reads simply "Are you sure you wish to delete this label?" with no bullet-point text. |

### ORCH-PLATFORM-044 — Save and Edit nav move SSO and host status webhook to Integrations

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Logged in as a global admin; on the Settings area.
- **Source:** #25798

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to **Settings > Organization settings**. | The nav does not list **Single sign-on options** or **Host status webhook**. |
| 2 | Navigate to **Settings > Integrations**. | The nav lists both **Single sign-on options** and **Host status webhook**. |
| 3 | In the URL bar go directly to `/settings/organization/sso`. | The page redirects to `/settings/integrations/sso`. |
| 4 | In the URL bar go directly to `/settings/organization/host-status-webhook`. | The page redirects to `/settings/integrations/host-status-webhook`. |
| 5 | Open **Settings > Integrations > Single sign-on options**, edit a field, and save. | The SSO settings save successfully. |
| 6 | Open **Settings > Integrations > Host status webhook**, edit a field, and save. | The host status webhook settings save successfully. |

### ORCH-PLATFORM-045 — SMTP Save button explains a test email will be sent

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Logged in as a global admin; SMTP is configured with the default email backend.
- **Source:** #25547

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to `/settings/organization/smtp` and hover over the **Save** button. | A tooltip explains that saving will send a test email. |
| 2 | Enable GitOps mode, return to `/settings/organization/smtp`, and hover over the now-disabled **Save** button. | The GitOps mode tooltip is shown instead of the test email tooltip. |
| 3 | Restart Fleet with `FLEET_EMAIL_BACKEND=ses` and open `/settings/organization/smtp`. | A message is shown in place of the form, and it now has a border around it; resizing to the smallest supported screen size shows no style issues. |

### ORCH-PLATFORM-046 — Query interval label and copy replace "frequency" throughout the UI

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Logged in as a global admin; on the Queries area.
- **Source:** #28821

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Create a new query and select **Never** for its schedule field. | The field label reads "Interval". |
| 2 | Open the new query's details page. | The text under "Nothing to report" is updated and the "Automations" tooltip shows the revised copy. |
| 3 | Click **Edit query**. | The schedule field label reads "Interval". |
| 4 | Go to the **Manage queries** page. | The column header reads "Interval"; the new query shows automations "Paused" with the revised tooltip and an empty `---` interval with the revised tooltip. |
| 5 | Click **Manage automations**. | The modal description shows the updated copy. |

### ORCH-PLATFORM-047 — Query automations modal shows updated description without purple callout

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Logged in as a global admin; on the Queries area.
- **Source:** #28884

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to **Queries > Manage automations**. | The description text matches the updated Figma copy and no purple callout box appears in the modal. |

### ORCH-PLATFORM-048 — Host details Vitals and Queries sections replace Queries subnav

- **Tier:** Both
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Logged in as a global admin; viewing the Host Details page for an enrolled host that supports queries.
- **Source:** #27322

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the Host Details page and inspect the subnav. | "Queries" is no longer present in the subnav. |
| 2 | Inspect the first (unheaded) section. | It contains Status, Team, OS settings, and Issues. |
| 3 | Inspect the "Vitals" section. | It combines the former "About" stats plus Disk space, Disk encryption, Memory, Processor type, Operating system, and Agent. |
| 4 | In a "Queries" section populated with queries, sort by "Name" and then by "Last updated", and hover the "Last updated" header. | Sorting works for both columns and the "Last updated" tooltip appears. |
| 5 | Click **Add query**. | The page redirects to `/queries/new` with subtext under "New Query" reflecting the team (or global) context (also confirmed on the "New Policy" page). |
| 6 | Create the new query, return to Host Details, then click **View data** for it. | The new query appears in the Queries table, and View data opens the Query results page showing "Performance Impact" with the correct value and an aligned tooltip. |
| 7 | Click the top-right link in the Queries section. | The link reads "View data for all hosts" and opens the full host list for that query. |

### ORCH-PLATFORM-049 — Host details Queries section empty states and pagination

- **Tier:** Both
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Logged in as a global admin; able to view Host Details pages for hosts with and without queries and with and without query support.
- **Source:** #27322

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Host Details for a query-supporting host that has no queries. | The Queries section shows the "no queries / device supports queries" empty state. |
| 2 | Open Host Details for a host that does not support queries. | The Queries section shows the "device does not support queries" empty state. |
| 3 | Open Host Details for a host with more than 4 queries. | Pagination navigation appears at the bottom of the Queries section. |

### ORCH-PLATFORM-050 — My Device details page shows combined Vitals section

- **Tier:** Both
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** A host with Fleet Desktop enrolled; viewing the My Device > Details page on that host.
- **Source:** #27322

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the My Device > Details page and inspect the first (unheaded) section. | It contains Status, Team, OS settings, and Issues. |
| 2 | Inspect the "Vitals" section. | It combines the former "About" stats plus Disk space, Disk encryption, Memory, Processor type, Operating system, and Agent. |

### ORCH-PLATFORM-051 — Scheduled query report host names link to host-specific reports

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Logged in as a global admin; a saved scheduled query has a report with results from multiple hosts.
- **Source:** #33249

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the saved scheduled query report and inspect a host display name. | The host display name is styled as a link. |
| 2 | Click a host display name. | The page navigates to that host's host-specific query report. |
| 3 | Delete a host that appears in the report, then reopen the report. | No lingering host links remain that would 404. |
| 4 | Run a live query that returns results and click a host display name in the results. | The page navigates to that host's details page. |

### ORCH-PLATFORM-052 — Host details Reports tab renders each report's first result correctly

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Logged in as a global admin; an enrolled host with saved scheduled query reports covering varied result, logging, and clipping states.
- **Source:** #40187

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the Host details page and inspect its layout. | There is no "Reports" card; the activities and labels columns render correctly with many and with few/no entries. |
| 2 | Open the new `/reports` tab and inspect cards for reports returning exactly 1 row, more than 1 row, and clipped before and after retrieving results. | Each card displays the correct UI for its result/clip state. |
| 3 | Inspect cards for reports returning no result, erroring on the host, having `discard_data` enabled, `differential` logging, `differential_ignore_removals` logging, and one just added that has not run yet. | Each card displays the correct UI for its state (the error case matches the no-result case). |
| 4 | Exercise every filter and sort control on the `/reports` tab, plus the no-reports empty state and the no-search-match empty state. | Filters and sorts behave correctly and both empty states render. |
| 5 | Disable saved reports in org settings and reopen the `/reports` tab. | The tab hides the toggle and shows an unfiltered list of all queries running. |

### ORCH-PLATFORM-053 — Live report Performance impact tab reflects per-host impact

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Logged in as a global admin; multiple live, online hosts available, including two with the same hostname.
- **Source:** #43062

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Run a live report across multiple hosts using a query whose cost varies per host (e.g. a file-traversal query) and open the **Performance impact** tab. | The performance impact column shows differing, sensible values per host. |
| 2 | Run a live report against a single host. | The Performance impact tab shows that host's impact. |
| 3 | Run a live query containing a typo. | The error column shows the error for the affected host(s). |
| 4 | Run a live query that returns no rows, then one that returns multiple rows. | The tab handles zero-row and multi-row result sets correctly. |
| 5 | Run a live report against two hosts sharing the same hostname. | The Performance impact column distinguishes and reports impact for each host. |

## Policies & Compliance

### ORCH-POLICY-001 — Configure Microsoft Entra conditional access integration

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Managed cloud Fleet Premium instance; a host enrolled in a team; valid Microsoft (Intune) tenant ID and admin consent credentials available
- **Source:** #19235, #26760, #28622

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to the policies page with "All teams" selected and open the "Manage automations" dropdown | "Conditional access" is disabled |
| 2 | Switch to your host's team, open "Manage automations" > "Conditional access" | Links do not 404; a message about configuring conditional access is shown |
| 3 | Go to Settings > Integrations > Conditional access with the tenant ID field empty | Links do not 404; the Save button is disabled |
| 4 | Enter an invalid tenant ID and save | An error flash message is shown |
| 5 | Enter a valid tenant ID and save | A new tab opens to Microsoft's admin consent form; the original Fleet tab shows a "refresh the page" message |
| 6 | Refresh the Fleet page without consenting on the Microsoft side | The form reappears with the tenant ID pre-filled |
| 7 | Submit again, complete Microsoft consent, then refresh the Fleet page | A success message is shown on the page |
| 8 | Go to the team's policies page, open "Manage automations" > "Conditional access", and turn it on | Conditional access is enabled for that team |

### ORCH-POLICY-002 — Block end users who fail policies via Entra conditional access

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS
- **Preconditions:** Conditional access configured and enabled for the host's team (see configuration case); host is MDM-enrolled; Entra/Office 365 login available
- **Source:** #19235, #26835

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open "Manage automations" > "Conditional access", select a policy that is failing on the host, and save | The host is flagged for conditional access on that policy |
| 2 | Attempt to log in via Entra (e.g. Office 365) on the failing host | The user is directed to a page with instructions to resolve policies and is blocked from access |
| 3 | Resolve the failing policy so it passes | Access is restored after the policy passes |
| 4 | Add a new policy to the team and log in via Entra before the host is marked passing | Access is not blocked by the not-yet-evaluated policy |
| 5 | Remove the device from MDM | The device is shown as out of compliance in Entra |

### ORCH-POLICY-003 — Disabling conditional access restores end-user access despite failing policies

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Conditional access enabled for the host's team with a host currently failing a selected policy and blocked in Entra
- **Source:** #26835

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to "Manage automations" > "Conditional access" for the team and disable conditional access | Policy checkboxes become disabled |
| 2 | Save the change | Access is restored after saving, even though the policy is still failing |
| 3 | Re-enable conditional access and save | Access is blocked again for the still-failing host |
| 4 | Resolve the failing policy | Access is restored after the policy is resolved |

### ORCH-POLICY-004 — Disconnect Entra conditional access integration

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Managed cloud Fleet Premium instance with conditional access configured (Entra connected)
- **Source:** #19235

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the conditional access configuration page, click "Delete" | A confirmation modal appears with copy matching Figma |
| 2 | Confirm disconnecting Entra | The configuration form reappears with no tenant ID pre-filled (tenant ID deleted) |
| 3 | Go to a team's policies page and open "Manage automations" | "Conditional access" is disabled with a tooltip |
| 4 | On a host that is failing a policy, attempt to log in via Entra | Login succeeds; access is restored despite failing policies (host marked compliant in Entra) |

### ORCH-POLICY-005 — Conditional access availability gating on self-hosted and Free instances

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Access to a self-hosted Fleet Premium instance and a Fleet Free instance; a team with at least one policy on each
- **Source:** #19235

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the self-hosted Premium instance, navigate directly to Settings > Integrations > Conditional access | The user is redirected to the team settings page; "Conditional access" does not appear in the nav |
| 2 | On the self-hosted instance, open "Manage automations" on the "All teams" and on a team policies page | "Conditional access" is not listed in the dropdown |
| 3 | Make a request to the fleetdm.com proxy directly using the self-hosted license key | The request returns a 403 error |
| 4 | On the Fleet Free instance, go to Settings > Integrations > Conditional access | An "Available in Fleet Premium" message is shown |
| 5 | On the Fleet Free instance, open "Manage automations" on the policies page | "Conditional access" is listed but disabled with a tooltip noting it is available in Premium |

### ORCH-POLICY-006 — Entra conditional access surfaces easy-to-understand error messages

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Managed cloud Fleet Premium instance; ability to trigger the conditional access error scenarios described in the Figma dev notes
- **Source:** #32420

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Trigger each conditional access error scenario outlined in the Figma dev notes (e.g. invalid/expired tenant configuration, consent/connection failures) | The new, easy-to-understand error message specified for each scenario is displayed |

### ORCH-POLICY-007 — Migrate hosts to Entra conditional access without end-user interaction

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Managed cloud Fleet Premium instance with conditional access configured; existing enrolled hosts to migrate per the guide's "Migration" section
- **Source:** #33319

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Follow each step in the guide's "Migration" section to migrate existing hosts onto Entra conditional access | Hosts are migrated and reflect correct compliance state in Entra without requiring any end-user interaction |

### ORCH-POLICY-008 — Paginate and scope the policy automations modal per team selection

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Instance with a team ("Jets") having 50+ policies, "No team" with 1 policy, and "All teams" with 1 global policy
- **Source:** #23243

| # | Step | Expected result |
|---|------|-----------------|
| 1 | With "All teams" selected, open "Manage automations" > "Other workflows", enable it, set a webhook URL | Only global policies appear in the list |
| 2 | Select an unselected global policy and save, then deselect a selected one and save | Both the selection and deselection persist after save |
| 3 | Switch to "No team", open "Other workflows", and review the policy list | Only "No team" policies are listed |
| 4 | With "Jets" selected, open "Manage automations" > "Install software", check an unselected policy | A "Select software" dropdown appears; Save is disabled with a tooltip until software is selected, then re-enables |
| 5 | Use the "next"/"previous" buttons to page through the 50 policies, toggling selections on different pages | Selections persist when paging back and forth, and save correctly |
| 6 | With "Jets" selected, open "Manage automations" > "Calendar events", enable it, hover a policy row, and click "preview" | A "preview" link appears on hover and the preview popup shows the correct info |

### ORCH-POLICY-009 — Disable "Manage automations" when a team has no policies

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Policies page with "All teams" and "No team" each having exactly one policy that can be removed
- **Source:** #23243

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Remove the only policy from "All teams" and review the "Manage automations" control | "Manage automations" is disabled with a tooltip |
| 2 | Remove the only policy from "No team" and review the control | "Manage automations" is disabled with a tooltip |

### ORCH-POLICY-010 — Target policies and reports with "Labels include all" custom scope

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet Premium instance with manual and dynamic labels created; at least one host that is a member of a manual label
- **Source:** #24097, #39915

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add a policy with custom label scope ("Labels include any", "Labels exclude any", or "Labels include all") in the UI | The scope is saved and data is collected only from hosts matching the selected scope |
| 2 | Add a host to a manual label, then create a report scoped to that manual label plus others the host matches | The report runs on the host |
| 3 | Remove the host from the manual label | The report (and a label-scoped policy set up the same way) no longer targets the host |
| 4 | Via the create/edit report API, attempt to set `labels_include_all` together with `labels_include_any` | The API returns an error |
| 5 | Via the create/edit policy API, attempt to set `labels_include_all` together with `labels_include_any` or `labels_exclude_all` | The API returns an error |
| 6 | Change a policy's target to "Exclude any" | Different hosts are targeted and the Yes/No count resets to `---` |

### ORCH-POLICY-011 — Hide policy label-target scope on Fleet Free

- **Tier:** Free
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Fleet Free instance with at least one policy and one label
- **Source:** #24097

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the "Save policy" modal | The label targets section is not visible |
| 2 | Open the "Edit policy" page | The label targets section is not visible |
| 3 | Open the "Delete label" modal | Bullet-point text is hidden; confirmation reads simply "Are you sure you wish to delete this label?" |

### ORCH-POLICY-012 — Manage policy label targets via GitOps

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Fleet Premium instance configured for GitOps; a team YAML file with a policy
- **Source:** #24097

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add `labels_include_any` to a policy in the team YAML and run `fleetctl gitops` | `labels_include_any` is saved to the policy |
| 2 | Add `labels_exclude_any` alongside `labels_include_any` and run `fleetctl gitops` | An error is returned; both keys cannot be used together |
| 3 | Remove `labels_include_any`, keep `labels_exclude_any`, and run `fleetctl gitops` | The policy's `labels_exclude_any` change applies |
| 4 | Enable GitOps mode in the UI, then view the "Targets" section on the policies and queries pages | The "Targets" section is disabled in both places |
| 5 | On a Fleet Free instance, add `labels_include_any` or `labels_exclude_any` to a policy YAML | The field is ignored with no error; it is not saved to the policy |

### ORCH-POLICY-013 — Add a policy navigates to the New policy page

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** User on the Manage policies page (`/policies`)
- **Source:** #26052

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Click "Add policy" on the Manage policies page | The app navigates to `/policies/new` without opening a modal |
| 2 | On `/policies/new`, click the "Examples" link | The link does not 404 (redirects to the policy library on fleetdm.com) |
| 3 | Click the "Schema" button to toggle the schema sidebar | The button reads "Schema" with the icon on its right side; the "Examples" button does not move when the sidebar shows |
| 4 | Open the "Schema" sidebar toggle on `/policies/:id` (Edit policy), `/queries/new`, `/queries/:id/edit`, and `/labels/new/dynamic` | Each page shows the updated "Schema" button (text "Schema", icon on right side) |

### ORCH-POLICY-014 — Host details and My device policies tables have no arrows

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** A host enrolled in Fleet with at least one policy applied
- **Source:** #25412

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Host details > Policies table | No arrows appear in the table |
| 2 | Open My device > Policies table | No arrows appear in the table |

### ORCH-POLICY-015 — Verify updated CIS Benchmark policies for Windows 11 v4.0.0

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Windows
- **Preconditions:** A Windows 11 workstation enrolled in Fleet; the PR updating the Windows 11 CIS policies to v4.0.0 available for reference
- **Source:** #27396

| # | Step | Expected result |
|---|------|-----------------|
| 1 | For every CIS policy that changed in the v4.0.0 update, run it against a Windows 11 workstation configured to satisfy the benchmark | Each policy passes when the benchmark is satisfied |
| 2 | Re-run each changed policy against a workstation configured to violate the benchmark | Each policy fails when the benchmark is not satisfied |

### ORCH-POLICY-016 — Verify updated CIS Benchmark policies for macOS 13, 14, and 15

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** macOS 13, 14, and 15 workstations enrolled in Fleet; the PR updating the macOS CIS policies available for reference
- **Source:** #31106

| # | Step | Expected result |
|---|------|-----------------|
| 1 | For every CIS policy that changed for macOS 13/14/15, run it against a workstation configured to satisfy the benchmark | Each policy passes when the benchmark is satisfied |
| 2 | Re-run each changed policy against a workstation configured to violate the benchmark | Each policy fails when the benchmark is not satisfied |

### ORCH-POLICY-017 — Configure webhook and ticket policy automations for "No team"

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Instance with at least one policy in "No team"; Jira and Zendesk integrations available for ticket configuration
- **Source:** #31267

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the policies page, select "No team" and open "Manage automations" | The "Other workflows" option is shown |
| 2 | Open "Other workflows" and configure a webhook for "No team", then save | The webhook automation is saved for "No team" |
| 3 | Open "Other workflows" and configure Jira ticket automations for "No team", then save | The Jira automation is saved for "No team" |
| 4 | Open "Other workflows" and configure Zendesk ticket automations for "No team", then save | The Zendesk automation is saved for "No team" |
| 5 | Via the API, configure Webhook, Jira, and Zendesk automations for "No team" policies | Each automation is configured successfully for "No team" |
| 6 | In GitOps, configure a webhook in `no-team.yml` and run `fleetctl gitops` | The webhook automation applies to "No team" |

### ORCH-POLICY-018 — Edit/details policy pages keep the SQL editor de-emphasized and role-gated

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet Premium and Fleet Free instances each with a saved policy; users available with admin/maintainer and technician-or-below roles
- **Source:** #41753

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the policy details page (Premium and Free), click "Show query" | A modal opens showing the query |
| 2 | As an admin or maintainer, click "Edit" on the policy details page | The "Edit" option is available and navigates to `/policies/:id/edit` |
| 3 | As a technician or below, view the policy details page | No "Edit" option is available |
| 4 | As a technician or below, navigate directly to the edit policy page (Premium and Free) | Access to the edit policy page is denied |
| 5 | Open the edit query page (Premium and Free) as an authorized user | The page loads with the updated, less-prominent SQL editor and calls the same APIs as before (no API changes) |

### ORCH-POLICY-019 — Live policy run shows responded/not-responded/error host breakdown

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Logged in as a global admin; at least one saved policy targets multiple live, online hosts.
- **Source:** #24950

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Run a saved policy live and observe the in-progress status text. | The status reads "Running policy" (not "Running query"). |
| 2 | Hover the response tooltip while the live policy is still running. | The tooltip shows a breakdown of hosts that responded, did not respond, and errored. |
| 3 | Let the policy run fully complete and observe the completion status text. | The status reads "Policy finished" (not "Query finished") and the tooltip still shows the host-count breakdown. |
| 4 | Re-run the policy live and cancel it before completion, then hover the tooltip. | The tooltip shows the responded / not-responded / error breakdown for the cancelled run. |

### ORCH-POLICY-020 — Maintenance windows calendar modal and events use updated copy

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Logged in as a global admin on a Fleet Premium instance; able to configure calendar events and to make hosts fail policies.
- **Source:** #27458

| # | Step | Expected result |
|---|------|-----------------|
| 1 | With calendar events not configured, go to `/policies/manage` and select **Manage automations > Calendar**. | The modal shows the updated image. |
| 2 | Configure calendar events for the organization, then on `/policies/manage` select **Manage automations > Calendar**, check exactly one policy, and preview the calendar event. | The modal text matches the updated Figma copy. |
| 3 | In the modal, select more than one policy and preview the calendar event again. | The generic description text matches the updated Figma copy. |
| 4 | Save changes and get a host to fail exactly one configured policy. | The resulting calendar event text matches the updated Figma copy. |
| 5 | Get a host to fail more than one configured policy. | The calendar event shows the generic description matching the updated Figma copy. |

## Agent (fleetd) & osquery

### ORCH-AGENT-001 — LUKS disk encryption and key escrow work on Kubuntu

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Linux
- **Preconditions:** Fleet Premium instance with disk encryption enforced for a team. Fresh Kubuntu host available to enroll into that team. Disk encryption (LUKS) feature is gated to supported Linux OSes.
- **Source:** #23697

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enroll a fresh Kubuntu host (no zenity installed) into the team with disk encryption enforced, then open the My device page and follow the escrow prompt | A kdialog-based prompt is shown; after completing it, the disk encryption key is escrowed and the host shows as verified in Fleet |
| 2 | On a Kubuntu host, install zenity (`sudo apt install zenity`), trigger escrow again, and follow the prompt | The zenity dialog is used (preferred over kdialog when both are present) and the key escrows successfully |
| 3 | Repeat enrollment and key escrow on Fedora and Ubuntu hosts | Disk encryption and key escrow still work on the previously supported OSes (no regression) |
| 4 | Enroll a Linux host running a distro not in the supported list and enforce disk encryption | The LUKS disk encryption escrow prompt does not appear on the unsupported OS |

### ORCH-AGENT-002 — Release binaries and images carry valid GitHub attestation

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A completed Fleet/fleetd release whose build workflows produce binaries and container images with GitHub attestation enabled. `gh` CLI authenticated.
- **Source:** #23825

| # | Step | Expected result |
|---|------|-----------------|
| 1 | For each binary produced by the release workflows, run `gh attestation verify <artifact> --repo fleetdm/fleet` | Each binary passes verification with a valid attestation |
| 2 | For each container image produced by the release workflows, run `gh attestation verify oci://<image> --repo fleetdm/fleet` | Each image passes verification with a valid attestation |
| 3 | Review the workflow output to confirm every generated artifact and image is covered | No release binary or image is missing attestation |

### ORCH-AGENT-003 — Windows evented tables surface DNS, file, and YARA events via live query

- **Tier:** Free
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** A Windows host enrolled to Fleet with fleetd that includes the new evented tables (`dns_lookup_events`, `recent_files`, `yara_events`). Evented tables enabled via agent options. YARA rules configured with a known match pattern.
- **Source:** #24198

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enable evented tables in agent options, then on the Windows host generate DNS requests (e.g. `ping`) and run a live query `SELECT * FROM dns_lookup_events` | The generated DNS lookups appear in the query results |
| 2 | Create a file matching the configured YARA rule pattern, then run `SELECT * FROM yara_events` | The matching file appears in the results |
| 3 | Create a file that does not match any configured YARA rule, then query `yara_events` again | The non-matching file does not appear in the results |
| 4 | Generate sustained activity (many DNS requests; many file create/modify operations in monitored directories) and monitor osqueryd | osqueryd remains healthy with acceptable agent performance under load |

### ORCH-AGENT-004 — Agent options accept the `vmodule` command line flag

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Fleet instance with at least one host enrolled. `fleetctl` and a GitOps YAML setup available. API access for the config endpoint.
- **Source:** #25838

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to Settings > Organization settings > Agent options, add `vmodule` under `command_line_flags`, and click Save | Agent options save successfully without a validation error |
| 2 | Add `vmodule` under `command_line_flags` in `agent-options.yml` and run `fleetctl apply -f agent-options.yml` | Agent options update successfully |
| 3 | Add `vmodule` under `agent_options` > `command_line_flags` in the GitOps YAML and run `fleetctl gitops` | The flag applies successfully |
| 4 | Send `PATCH /api/latest/fleet/config` adding `vmodule` under `command_line_flags` | The request succeeds and the flag is persisted |
| 5 | Set `vmodule=init=1` on a host, then inspect the fleetd/osquery logs | Additional osquery log output appears, confirming the flag took effect |

### ORCH-AGENT-005 — Fleet Desktop opens correctly under Wayland on Linux

- **Tier:** Both
- **Priority:** P1
- **Platforms:** Linux
- **Preconditions:** A Linux host running a Wayland default display server, enrolled to Fleet with Fleet Desktop. fleetd built from source via the local TUF test instructions.
- **Source:** #26179

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the Wayland Linux host, confirm the Fleet Desktop tray icon appears | The Fleet Desktop icon is visible in the system tray |
| 2 | Click the Fleet icon and select My device | The My device page opens in the browser |
| 3 | From the Fleet icon, select Self-service and About Fleet | Each option opens its corresponding page successfully under Wayland |

### ORCH-AGENT-006 — fleetd enrolls natively on Windows Arm with correct packaging copy

- **Tier:** Both
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** Windows Arm host/VM available. fleetd packages generated for the appropriate OS and architecture (native, no emulation).
- **Source:** #26694

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Install the generated package on a Windows Arm host of the matching architecture | The host enrolls to Fleet |
| 2 | After enrollment, run a live query against the Windows Arm host | The query returns results from the host |
| 3 | Review the Add hosts / package UI copy against the Figma spec | UI copy matches the approved Figma design |
| 4 | Run `fleetctl package -h` | The help output reflects the updated copy (including arm64 architecture support) |

### ORCH-AGENT-007 — Fleet Desktop auto-opens the default browser on Linux

- **Tier:** Both
- **Priority:** P2
- **Platforms:** Linux
- **Preconditions:** A Linux workstation (Ubuntu, Kubuntu, or Fedora) enrolled to Fleet with Fleet Desktop installed. Microsoft Edge installed and set as the default browser, with Edge initially closed.
- **Source:** #26943

| # | Step | Expected result |
|---|------|-----------------|
| 1 | With Edge closed, click the Fleet icon and select My device | Microsoft Edge automatically opens to the My device page |
| 2 | Close Edge, then select Self-service from the Fleet icon | Edge automatically opens to the Self-service page |
| 3 | Close Edge, then select About Fleet from the Fleet icon | Edge automatically opens to the About Fleet page |
| 4 | Set Google Chrome (then Firefox) as the default browser, close it, and repeat the My device / Self-service / About Fleet actions | The configured default browser (Chrome, then Firefox) opens automatically for each action, on Ubuntu, Kubuntu, and Fedora |

### ORCH-AGENT-008 — Experimental Windows arm64 fleetd msi passes full smoke test

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Windows
- **Preconditions:** Windows 10/11 ARM64 machine/VM. fleetd msi built via `fleetctl package --type=msi --arch=arm64 [...]`. Fleet Premium instance for MDM/scripts/profiles features.
- **Source:** #28714

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Build the arm64 msi with `fleetctl package --type=msi --arch=arm64 [...]` and install it on the Windows 10/11 ARM64 host | The package installs and the host enrolls to Fleet |
| 2 | Run live queries against every Windows osquery table | No table causes a crash or unexpected behavior (empty/unexpected column values are acceptable) |
| 3 | Smoke test policies, labels, and scheduled queries | Each works as expected on the arm64 host |
| 4 | Smoke test disk encryption, software ingestion, software installation, Windows configuration profiles, and scripts | Each fleetd management feature works on the arm64 host |

### ORCH-AGENT-009 — Linux hosts authenticate to Fleet with TPM-backed identity certificates

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Linux
- **Preconditions:** Fleet server running with `FLEET_AUTH_REQUIRE_HTTP_MESSAGE_SIGNATURE=true`. fleetd built from TUF with `FLEET_MANAGED_HOST_IDENTITY_CERTIFICATE=1` for both amd64 and arm64. Linux hosts with and without a TPM available.
- **Source:** #28818, #30458, #30900

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Generate fleetd combining `--fleet-managed-host-identity-certificate` with `--fleet-tls-client-certificate` (and separately with `--fleet-tls-client-key`) | Generation fails with a clear, easy-to-understand error message |
| 2 | Generate fleetd for Windows or macOS with `--fleet-managed-host-identity-certificate` | Generation fails with a clear error message (feature is Linux-only) |
| 3 | Install managed-cert fleetd on a Linux host without a TPM | Connection is denied; the Fleet Desktop dropdown shows the "Can't connect" message, fleetd logs show clear errors, and the host does not appear in Fleet |
| 4 | Install managed-cert fleetd with the wrong enrollment secret | Connection is denied with a clear message in the Fleet Desktop dropdown |
| 5 | Install managed-cert fleetd on a TPM-equipped Linux host (test both amd64 on x64 and arm64 on arm64) | The host obtains a certificate and shows as online; queries and scripts run normally |
| 6 | Inspect API traffic from a working managed-cert host | Requests include HTTP message Signature headers |
| 7 | Delete the `host_identity*` cert files on the host and restart fleetd | fleetd obtains a new cert and reconnects to Fleet |
| 8 | Delete the host's certificate from the Fleet DB | All subsequent traffic from that host is denied |
| 9 | Uninstall and reinstall fleetd, then reinstall on top of an existing install | Both flows succeed and the host re-enrolls |
| 10 | Delete the host from Fleet; separately restart fleetd (`systemctl restart orbit`) and reboot the host OS | After deletion fleetd restarts and re-enrolls; restarts and reboot cause no change |
| 11 | Enroll a non-managed-cert fleetd against a server with `FLEET_AUTH_REQUIRE_HTTP_MESSAGE_SIGNATURE=true` | Enrollment is rejected |

### ORCH-AGENT-010 — TPM-backed Linux host identity certificates renew automatically

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Linux
- **Preconditions:** A Linux host enrolled using TPM-backed host identity certs (per #28818). Fleet server started with `FLEET_DEV_HOST_IDENTITY_CERT_VALIDITY_DAYS=1` to force short-lived certs.
- **Source:** #30476, #28818

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Leave the host online and observe certificate handling as expiry approaches | The certificate is renewed at the appropriate time before expiry |
| 2 | Take the host offline, wait until the certificate expires, change the enrollment secret, then bring the host back online | The host cannot access Fleet or renew its certificate |

### ORCH-AGENT-011 — Download signed fleetd installers from the UI without security warnings

- **Tier:** Both
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Fleet instance with the Add hosts / download fleetd flow available in the UI. Package inspection tools available (e.g. Suspicious Package for macOS).
- **Source:** #38137, #29719

| # | Step | Expected result |
|---|------|-----------------|
| 1 | From the UI, download the fleetd macOS `pkg` and inspect it with a package tool | The pkg is codesigned and notarized |
| 2 | Install the macOS pkg | Installation completes with no security warning |
| 3 | From the UI, download the Windows `msi` and inspect its signature | The msi is codesigned |
| 4 | Install the msi | Installation completes with no security warning |
| 5 | From the UI, download and install the Ubuntu `deb`, Fedora `rpm`, and Arch Linux `pkg.tar.zst` | Each Linux installer downloads and installs successfully on its platform |

### ORCH-AGENT-012 — Fleet Desktop opens Snap/Flatpak Firefox and Chrome on Linux

- **Tier:** Both
- **Priority:** P2
- **Platforms:** Linux
- **Preconditions:** A Linux host enrolled to Fleet with Fleet Desktop installed. Firefox and/or Chrome installed via Snap and via Flatpak, set as the default browser.
- **Source:** #31087

| # | Step | Expected result |
|---|------|-----------------|
| 1 | With a Snap-installed Firefox set as default and closed, click the Fleet icon and select My device | The Snap Firefox opens to the My device page |
| 2 | With a Flatpak-installed Firefox set as default and closed, repeat the My device action | The Flatpak Firefox opens to the My device page |
| 3 | Repeat steps 1-2 with Chrome installed via Snap and via Flatpak | The Snap/Flatpak Chrome opens correctly for each Fleet Desktop action |

### ORCH-AGENT-013 — `dns_resolvers` table returns live DNS configuration on Windows

- **Tier:** Free
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** A Windows host enrolled to Fleet with fleetd that includes Windows support for the `dns_resolvers` table.
- **Source:** #31475, #29655

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Run a live query `SELECT * FROM dns_resolvers` against the Windows host | Results match the system's currently configured DNS resolvers |
| 2 | Change the configured DNS resolvers on the Windows host | The OS reflects the new resolver configuration |
| 3 | Run `SELECT * FROM dns_resolvers` again | The results update to match the new DNS resolver configuration |

### ORCH-AGENT-014 — Fleet enrolls and inventories Omarchy (Arch Linux) hosts

- **Tier:** Both
- **Priority:** P1
- **Platforms:** Linux
- **Preconditions:** An Omarchy (Arch Linux) host available to enroll, with Fleet Desktop included in the fleetd package.
- **Source:** #32858, #32795

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enroll the Arch Linux host into Fleet | The host enrolls and appears in Fleet |
| 2 | Observe the system tray on the Arch Linux host | The Fleet Desktop icon is shown in the system tray |
| 3 | Click the Fleet Desktop icon and open Self-service | Self-service is accessible from the tray icon |
| 4 | View the host's software inventory in Fleet | Software inventory is indexed and listed for the Arch Linux host |

### ORCH-AGENT-015 — `crowdstrike_falcon` table reports Falcon agent info on macOS

- **Tier:** Free
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** A macOS host enrolled to Fleet with fleetd 1.50+ and the CrowdStrike Falcon agent installed.
- **Source:** #33193

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Run `SELECT * FROM crowdstrike_falcon` as a live query against the macOS host | Results show correct values for `agent_id`, `cid`, `reduced_functionality_mode`, and `sensor_loaded` |
| 2 | On a host with the macadmins osquery extension installed, upgrade fleetd to 1.50 | fleetd does not crash-loop after the upgrade |
| 3 | After the upgrade, query the host and open Fleet Desktop > My device | The host remains queryable and the My device page is accessible |

### ORCH-AGENT-016 — `crowdstrike_falcon` table reports Falcon agent info on Linux

- **Tier:** Free
- **Priority:** P2
- **Platforms:** Linux
- **Preconditions:** A Linux host enrolled to Fleet with fleetd that includes the `crowdstrike_falcon` table and the CrowdStrike Falcon agent installed.
- **Source:** #35149, #33193

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Install the CrowdStrike Falcon agent on the Linux host | The Falcon agent is installed and running |
| 2 | Run `SELECT * FROM crowdstrike_falcon` as a live query against the Linux host | Results show correct values for `agent_id`, `cid`, `reduced_functionality_mode`, and `sensor_loaded` |

### ORCH-AGENT-017 — `file_contents` and `yaml_to_json` tables support Kubernetes config queries

- **Tier:** Free
- **Priority:** P2
- **Platforms:** Linux
- **Preconditions:** A host enrolled to Fleet with fleetd that includes the `file_contents` and `yaml_to_json` tables. A known YAML file present on the host (e.g. `codecov.yml`).
- **Source:** #35548

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Run `SELECT * FROM file_contents WHERE path = 'codecov.yml'` | The file's contents are returned |
| 2 | Run `SELECT json FROM yaml_to_json WHERE yaml = 'foo: bar'` | The YAML is converted to its JSON representation |
| 3 | Run the combined query `SELECT json FROM yaml_to_json WHERE yaml = (SELECT contents FROM file_contents WHERE path = 'codecov.yml')` | The file is read and converted to JSON in a single query |

### ORCH-AGENT-018 — `containerd_mounts` table lists mounted container volumes

- **Tier:** Free
- **Priority:** P2
- **Platforms:** Linux
- **Preconditions:** A Linux host enrolled to Fleet with fleetd that includes the `containerd_mounts` table and a containerd runtime (e.g. nerdctl) available.
- **Source:** #38393

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Start a containerd container with at least one mount (e.g. `sudo nerdctl run -it -v .:/app/data bash`) | The container runs with the specified mount |
| 2 | Run a live query against the `containerd_mounts` table | The mount associated with the running container appears in the results |

### ORCH-AGENT-019 — File carving preserves original file metadata for triage

- **Tier:** Free
- **Priority:** P2
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** A host enrolled to Fleet with file carving configured. A target file with known created/modified/accessed timestamps.
- **Source:** #38852

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Carve the target file using Fleet's file carving | The carve completes and the carved file is retrievable |
| 2 | Inspect the carved file's metadata | The original created, modified, and accessed timestamps are preserved and available for incident response triage |

### ORCH-AGENT-020 — `go_binaries` table populates Go software inventory and versions

- **Tier:** Free
- **Priority:** P2
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Hosts on Windows, macOS, and Linux enrolled to Fleet with fleetd 1.54.0+ that includes the `go_binaries` table. Go installed on each host. At least one host still running an older fleetd (< 1.54.0).
- **Source:** #40138

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Install Go binaries via `go install` on the Windows, macOS, and Linux hosts, then query the `go_binaries` table | The installed binaries appear matching the schema docs on all three platforms |
| 2 | Refetch a host and view its software inventory | Software with `Type = Binary (Go)` is listed in the host's software inventory |
| 3 | Open the main Software tab | Software with `Type = Binary (Go)` appears in software versions and titles |
| 4 | Run `fleetctl trigger --name vulnerabilities` | The vulnerabilities cron completes without error against the Go binary software |
| 5 | Query a host running fleetd < 1.54.0 (no `go_binaries` table) | The host operates normally with no errors despite lacking the table |

### ORCH-AGENT-021 — `local_network_permissions` and `macadmins_wifi_network` tables return data on macOS

- **Tier:** Free
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** macOS hosts enrolled to Fleet with fleetd that includes the new tables, covering Intel and Apple Silicon hardware across macOS 14.x, 15.x, and 26.x.
- **Source:** #40629

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Run a live query against `local_network_permissions` on each macOS host | The table returns expected results on Intel and Apple Silicon across macOS 14.x, 15.x, and 26.x |
| 2 | Run a live query against `macadmins_wifi_network` on each macOS host | The table returns expected results on Intel and Apple Silicon across macOS 14.x, 15.x, and 26.x |

### ORCH-AGENT-022 — `app_platform_sso` table returns the new columns on macOS

- **Tier:** Free
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** A macOS host enrolled to Fleet with fleetd that includes the expanded `app_platform_sso` table and Platform SSO configured.
- **Source:** #40630

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Run `SELECT * FROM app_platform_sso` as a live query against the macOS host | The query returns results including the newly added columns |
| 2 | Compare the returned column values against the host's Platform SSO configuration | The new columns report correct, expected values |

### ORCH-AGENT-023 — osquery table lists certificates in the EFI Signature Database

- **Tier:** Free
- **Priority:** P2
- **Platforms:** Linux
- **Preconditions:** A Linux VM (and hardware if available) enrolled to Fleet with fleetd that includes the EFI Signature Database certificate table.
- **Source:** #43888

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Run a live query against the EFI Signature Database certificate table on a Linux VM | The table returns the EFI Signature Database certificates |
| 2 | If available, run the same query against Linux hardware | The table returns results on physical hardware as well |

### ORCH-AGENT-024 — Smoke test fleetd bundling osquery 5.23.1 across platforms

- **Tier:** Both
- **Priority:** P0
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** fleetd bundling osquery 5.23.1 (`edge`) built and enrolled on macOS, Windows, Fedora, and Ubuntu hosts. Scheduled queries with a configured log destination. File carving configured.
- **Source:** #48184, #48183

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Host details for the macOS, Windows, and Linux hosts | Each reports `osqueryd` version 5.23.1 |
| 2 | Run `SELECT * FROM osquery_info;` as a live query on all platforms, then run a query with a syntax error | Results return from all platforms; the syntax error surfaces an error message |
| 3 | Run platform-relevant tables (e.g. `system_info`, `os_version`, `users`, `processes`) | Each returns data on its platform |
| 4 | Run the `processes` and `authenticode` tables on Windows | Both return results without crashing (heap overflow fix verified) |
| 5 | With evented tables enabled, run `process_file_events` on Linux | Returns results without crashing (use-after-free fix verified) |
| 6 | Perform a file carve | The carve completes successfully and the carve directory permissions are correct |
| 7 | Let scheduled queries run and check the configured log destination | Scheduled queries run and result/status logs reach the destination |
| 8 | Monitor osqueryd across all platforms over the test window | osqueryd stays healthy with no crashes or regressions |

### ORCH-AGENT-025 — FleetBot answers a hosts question when mentioned in Slack

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** FleetBot is deployed and connected to the dogfooding Slack workspace; you are a member of the #help-dogfooding channel.
- **Source:** #29766

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In #help-dogfooding, @ mention FleetBot and ask a question about Fleet's hosts. | FleetBot replies in the channel with an answer about Fleet's hosts. |

## Scripts

### ORCH-SCRIPTS-001 — Edit an existing script's contents in the Fleet UI

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet Premium instance with a team that has at least one script uploaded to its scripts library; logged in as an admin or maintainer.
- **Source:** #24195

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to **Controls > Scripts** for the team and open the actions menu for an existing script. | A "Modify script" / edit action is available. |
| 2 | Open the edit view, change the script contents, and save. | Changes are saved via the edit script endpoint; success is confirmed and the updated contents persist when the script is reopened. |
| 3 | Reopen the same script. | The edited contents are shown (not the original). |

### ORCH-SCRIPTS-002 — Run a bash script via shebang on macOS and Linux hosts

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS, Linux
- **Preconditions:** Fleet Premium instance with one online macOS host and one online Linux host, both with scripts enabled.
- **Source:** #24470, #25449

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Upload a script whose first line is `#!/bin/bash` and that uses bash-specific features (e.g. arrays). | Script is saved to the library. |
| 2 | Run the script on the macOS host. | Script executes successfully using bash; bash-specific features work and output is correct. |
| 3 | Run the same script on the Linux host. | Script executes successfully using bash; output is correct. |
| 4 | Upload the same script with the `#!/bin/bash` first line removed and run it again. | Script runs under `#!/bin/sh` and fails because the bash-specific features are unsupported. |

### ORCH-SCRIPTS-003 — Run a script as a batch action from the Manage hosts page

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** All
- **Preconditions:** Fleet Premium instance with scripts enabled globally; at least one macOS host (scripts enabled), one Windows host, and one host whose fleetd does not have scripts enabled, all enrolled.
- **Source:** #26715

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On **Hosts**, select a single macOS host and click **Run script**. | Run-script modal opens; copy reflects the singular count ("1 host"). |
| 2 | Select a `.sh` script and run it. | Request goes through the bulk/batch run-script endpoint for the 1 selected host. |
| 3 | Close the modal, then select 1 macOS host, 1 Windows host, and 1 host without scripts enabled, and run a macOS script. | Batch run is submitted for the 3 hosts. |
| 4 | Open the global **Activity** feed. | A run-script batch activity item is shown. |
| 5 | Click the activity item. | Details show links to all 3 targeted hosts; the Windows host and the scripts-disabled host each show a warning icon with a tooltip describing the error. |
| 6 | In **Settings**, disable scripts, return to **Hosts**, and select hosts. | The **Run script** button is disabled with an explanatory tooltip. |

### ORCH-SCRIPTS-004 — Batch-run scripts across all matching hosts with the 5,000-host limit and filters

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet Premium instance with scripts enabled; a team containing more than 5,000 hosts available for selection; ability to apply search, status, label, team, and OS-settings filters.
- **Source:** #28389

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On **Hosts**, select a team with more than 5,000 hosts and use **Select all matching** (across all pages), then check **Run script**. | **Run script** is disabled with a message indicating too many hosts are selected. |
| 2 | Select only a few hosts on the current page. | **Run script** is enabled. |
| 3 | Apply a filter so 5,000 or fewer hosts match, select all matching, and run a script. | Script is queued for the matching hosts. |
| 4 | Repeat select-all-and-run with a search-query filter, a status filter, a label filter, and a team filter. | Each run targets only the hosts matching that filter. |
| 5 | Filter **Hosts** by **OS settings**, then attempt to select all matching and run a script. | Select-all-across-pages is unavailable; the script runs only for hosts on the current page. |
| 6 | Edit a script in the UI that has pending batch runs and confirm saving the changes in the confirmation modal. | A confirmation modal appears; after confirming, pending script runs are cancelled and no longer appear in the hosts' upcoming activity. |
| 7 | Run a script via the API using multiple host filters simultaneously. | The API accepts the combined filters and targets the correct hosts. |

### ORCH-SCRIPTS-005 — Schedule a batch script to run at a specific future time

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet Premium instance with scripts enabled and at least one enrolled host with scripts enabled.
- **Source:** #28390

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the batch progress page when no scripts are scheduled. | Empty-state content is shown for past and upcoming scripts. |
| 2 | Start a batch script run using the **Run immediately** option. | Script runs immediately with no regressions versus prior behavior. |
| 3 | Start a batch run using the **Schedule** option and pick a future time. | The run is scheduled and appears under upcoming activity. |
| 4 | Attempt to schedule with an invalid time and with a time in the past. | Scheduling is rejected / validation prevents submitting invalid or past times. |
| 5 | Review the activities page and each batch-progress tab (past and upcoming). | Scheduled and completed runs appear in the correct tabs and their detail modals open correctly. |
| 6 | Cancel an upcoming scheduled script from the UI. | The scheduled run is cancelled and removed from upcoming activity. |
| 7 | Schedule and then cancel a script via the API. | The API schedules the run and the cancel request removes it. |
| 8 | On a host detail page, filter activity by **Incompatible** and by **Cancelled**. | Each filter shows the correct host script entries. |

### ORCH-SCRIPTS-006 — Reject incomplete or invalid batch-script-execution host filters in the API

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Fleet Premium instance with API access and at least one batch script execution.
- **Source:** #29198

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Send a list-hosts request with `script_batch_execution_status` but no `script_batch_execution_id`. | API returns an error. |
| 2 | Send a request with `script_batch_execution_id` but no `script_batch_execution_status`. | API returns an error. |
| 3 | Send a request with a valid `script_batch_execution_id` and an invalid `script_batch_execution_status`. | API returns an error. |
| 4 | Send a request with a valid `script_batch_execution_id` and a valid `script_batch_execution_status`. | API returns hosts filtered by that batch execution status. |

### ORCH-SCRIPTS-007 — Add, use, and delete secret variables for scripts and profiles in the UI

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet Premium instance with at least one secret already added via GitOps; logged in as an admin; GitOps mode off initially.
- **Source:** #29235

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add a secret via GitOps (existing flow) and confirm scripts/profiles using it still work. | No regression; the GitOps-added secret is available and usable. |
| 2 | Go to **Controls > Variables** and add a new secret in the UI. | The secret is created and listed. |
| 3 | Reference the newly added secret in a script and in a configuration profile. | The secret variable is accepted and used by both the script and the profile. |
| 4 | Delete the newly added secret from the UI. | Deletion is allowed even though it is in use by a script/profile. |
| 5 | Delete a secret that was added via GitOps (not the UI-added one). | Deletion succeeds. |
| 6 | Enable GitOps mode and return to **Controls > Variables**. | Adding and deleting secrets is disabled. |
| 7 | Click every link on the **Controls > Variables** page. | No link returns a 404. |

### ORCH-SCRIPTS-008 — Add a script through the updated upload modal and empty state

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet Premium instance; a team with no scripts in its library and a team with no profiles uploaded; logged in as admin; GitOps mode off initially.
- **Source:** #32632

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to `controls/scripts/library` for the team with no scripts and click **Upload** in the empty state. | The add-script modal opens. |
| 2 | In the modal, select a `.ps1` script. | No additional macOS/Linux text is shown. |
| 3 | Close the modal without uploading, then re-open it. | The file field is cleared and the upload button is visible again. |
| 4 | Select a `.sh` script. | Additional text about macOS and Linux is displayed. |
| 5 | Add the script. | The script saves and the modal closes. |
| 6 | View the scripts library after the upload. | The empty state is gone and an **Add script** button appears at the top of the list. |
| 7 | Go to `/controls/os-settings/custom-settings` for the team with no profiles and open the add-profile modal. | The empty-state text styles and the upload-text styles match those of the script upload empty state and modal. |
| 8 | Enable GitOps mode and go to `controls/scripts/library` for a team with scripts. | The **Add script** button is disabled with the standard GitOps-mode tooltip. |

## GitOps & fleetctl Configuration

### ORCH-GITOPS-001 — Custom query label targets round-trip through GitOps

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A Fleet Premium instance configured for GitOps; access to a team YAML file and the `fleetctl` CLI.
- **Source:** #16413

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In a team YAML file, add `labels_include_any` to a query and run `fleetctl gitops`. | `labels_include_any` is saved to the query. |
| 2 | Modify the `labels_include_any` values and run `fleetctl gitops` again. | The query's `labels_include_any` updates to the new values. |

### ORCH-GITOPS-002 — Free instance ignores labels_include_any in GitOps YAML

- **Tier:** Free
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** A Fleet Free instance configured for GitOps; access to a YAML file and the `fleetctl` CLI.
- **Source:** #16413

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In the YAML file, add `labels_include_any` to a query and run `fleetctl gitops`. | `labels_include_any` is not saved to the query; the field is silently ignored with no error. |

### ORCH-GITOPS-003 — GitOps mode enables from Integrations and disables editable UI items

- **Tier:** Both
- **Priority:** P0
- **Platforms:** All
- **Preconditions:** Logged in as a global admin; on a Fleet instance with GitOps mode currently off.
- **Source:** #25478

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to **Settings > Integrations**, open GitOps mode, and attempt to save without entering a repo URL. | A validation error is shown and the setting does not save. |
| 2 | Enter a repository URL and save. | GitOps mode is enabled. |
| 3 | For each item editable via GitOps (per the Configuration > YAML files docs), find its corresponding UI location. | Each such UI control is disabled while GitOps mode is on. |
| 4 | For each disabled control, view its GitOps tooltip in tables, modals, and other contexts. | The tooltip is fully readable (not cut off), stays visible long enough to hover its link, and the link is easy to hover. |
| 5 | Click the tooltip's repository link. | The browser navigates to the saved repository URL (a relative value like `a.b.cc` resolves against the current domain; a full URL like `https://a.b.cc` navigates directly). |

## Setup Experience & Enrollment

### ORCH-SETUP-001 — macOS setup experience blocks the end user when critical software fails to install

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

### ORCH-SETUP-002 — macOS setup experience continues past a failed install when the critical-software setting is off

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

### ORCH-SETUP-003 — Linux end-user setup experience installs configured software and shows progress states

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

### ORCH-SETUP-004 — Windows end-user setup experience installs software across enrollment methods and logs edits

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

### ORCH-SETUP-005 — Setup experience automatically retries failed software installs and records every result

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

### ORCH-SETUP-006 — Windows and Linux setup experience requires end-user SSO before any actions run

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

### ORCH-SETUP-007 — Apple App Store apps auto-update on schedule for managed iOS/iPadOS devices

- **Tier:** Premium
- **Priority:** P1 (core regression)
- **Platforms:** iOS/iPadOS
- **Preconditions:** Fleet Premium with Apple MDM/VPP configured; a team with frequently-updated VPP App Store apps assigned via GitOps; enrolled iPhone and iPad devices, including at least one on iOS/iPadOS 26+ and one below iOS/iPadOS 26.0; device Settings > "App Updates" (automatic updates) turned off so Fleet drives updates; access to `~/fleet_logs.txt`.
- **Source:** #33391, #27015

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Assign a set of frequently-updated VPP App Store apps to the team and enroll an iPhone and an iPad (one device 26+, one below 26.0), with automatic App Updates disabled on each. | Apps install on the devices and are tracked by Fleet for updates. |
| 2 | Over multiple days, allow new App Store versions to be released for the installed apps and let the scheduled-update cron run. | Fleet schedules and applies the available app updates to the managed devices without the end user updating manually. |
| 3 | Inspect the logs with `grep "handle_scheduled_updates" ~/fleet_logs.txt` and check app versions on both devices. | Scheduled-update activity is logged and the apps update to the newer versions on both the 26+ and the below-26.0 device. |

### ORCH-SETUP-008 — Setup experience installs team software when personally-owned iOS/iPadOS hosts enroll

- **Tier:** Premium
- **Priority:** P1 (core regression)
- **Platforms:** iOS/iPadOS
- **Preconditions:** Fleet Premium with Apple MDM/VPP configured; Team A and Team B each with different setup-experience software assigned for iOS/iPadOS; an iPhone and an iPad available for profile-based BYOD (user) enrollment via the `/enroll` URL from the "Add hosts" modal.
- **Source:** #34042, #27015

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the iOS and iPadOS setup-experience tabs and review the copy. | Copy is updated with the word "automatically" removed. |
| 2 | Manually (profile-based user) enroll an iPhone and an iPad to Team A using the `/enroll` URL from the "Add hosts" modal. | Team A's setup-experience software installs on each personally-owned device. |
| 3 | Open the Host details page for each enrolled device and review the software install activities. | Software install activities show up on Host details and remain in the Upcoming tab until Fleet verifies the installation. |
| 4 | Transfer a profile-enrolled host from Team A to Team B (which has different software). | Team B's software is NOT installed on the transferred host. |

### ORCH-SETUP-009 — fleetctl preview seeds starter scripts, policies, and queries

- **Tier:** Free
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A clean environment with `fleetctl` installed and no existing preview instance.
- **Source:** #29741

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Spin up a new `fleetctl preview` instance without a license key. | The instance is seeded with starter queries, policies, and scripts. |
| 2 | After a couple of minutes, open one of the seeded scheduled query reports. | The query reports show some collected data. |

### ORCH-SETUP-010 — fleetctl preview with Premium license also seeds teams

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A clean environment with `fleetctl` installed, a Fleet Premium license key, and no existing preview instance.
- **Source:** #29741

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Spin up a new `fleetctl preview` instance using the Fleet Premium license key. | The instance is seeded with starter queries, policies, scripts, and teams. |
| 2 | After a couple of minutes, open one of the seeded scheduled query reports. | The query reports show some collected data. |
