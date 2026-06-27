# Configuration Profiles & OS Settings — test cases

> Feature area. Effective regression set curated from Fleet feature-story test
> plans (audited: deduped across former product groups; cosmetic/low-value checks
> pruned). Each case keeps its origin story #s in **Source**. See
> [`README.md`](README.md) for conventions; GitOps flows live in [`gitops.md`](gitops.md).

## Scale & performance

### PROFILE-001 — Deploy MDM configuration profiles to 2,500 macOS hosts without APNs rate limiting

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

## Upload & manage profiles

### PROFILE-002 — Upload, target, and manage Windows custom configuration profiles (.xml)

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

### PROFILE-003 — Deleting a Windows configuration profile resets enforced settings and shows pending state

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

## Profile variables

### PROFILE-004 — Use computer name, serial number, and UUID as variables in macOS configuration profiles

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** macOS MDM on; at least one macOS host enrolled.
- **Source:** #16958, #30879, #34364, #34716

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Create a `.mobileconfig` that references the supported variables for computer name, serial number, and host UUID | Profile uploads successfully with the variables present |
| 2 | Deploy the profile to a macOS host | Profile reaches Verifying/Verified on the host |
| 3 | Inspect the installed profile on the host (System Settings > Device Management) | Each variable is replaced with that host's actual computer name, serial number, and UUID |

### PROFILE-005 — Use end user IdP attributes (groups/username) as variables in macOS profiles

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Fleet Premium with Apple MDM. An IdP (SCIM) connected with users mapped to hosts. An enrolled macOS host whose end user has IdP groups and username assigned.
- **Source:** #23900, #30888

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add a macOS configuration profile containing a misspelled / non-existent `$FLEET_VAR_...` IdP variable. | Fleet rejects the upload (cannot upload a variable that doesn't exist). |
| 2 | Add a macOS profile using `$FLEET_VAR_HOST_END_USER_IDP_GROUPS` and `$FLEET_VAR_HOST_END_USER_IDP_USERNAME` and deploy it to a host whose end user has those IdP attributes. | Profile is delivered and the variables are populated with the end user's IdP groups/username. |
| 3 | Change the value of the IdP attribute in the IdP. | Fleet automatically resends the profile to the host with the updated value. |
| 4 | Deploy a profile using those variables to a host that has no IdP username or groups assigned. | The profile fails for that host and the Host details (and My device) page shows the expected error message. |
| 5 | Deploy a profile using the legacy `$FLEET_VAR_HOST_END_USER_EMAIL_IDP` variable. | The legacy variable still works (backward compatible). |

## Validation & errors

### PROFILE-006 — Show clear error when uploading a profile whose name already exists

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

### PROFILE-007 — Block Android system-update configuration profiles on Free with a clear error

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

## Batch API & GitOps

### PROFILE-008 — Batch-apply cross-platform configuration profiles via the public API

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

## OS settings status UI

### PROFILE-009 — Display "Current status" updated-at timestamp on Controls > OS settings

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

### PROFILE-010 — Simplify the OS settings modal status and resend columns

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows
- **Preconditions:** MDM on; a host (and Controls > OS settings) showing profiles in Failed and various Pending states, plus disk encryption configured.
- **Source:** #19646, #40702

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the Host details OS settings modal | The "Error" column is removed; "Resend" has its own unlabeled column; Failed status shows the former error text as a tooltip |
| 2 | Inspect any Pending-variant status on Host details and on Controls > OS settings | The "(pending)" suffix is removed from the status label |
| 3 | Hover a status tooltip | The tooltip stays open so the user can hover and highlight its text instead of disappearing immediately |
| 4 | Review Controls > OS settings > Disk encryption rows for enabled and disabled encryption, and after adding/removing a profile | Pending statuses also have "(pending)" removed and the simplified layout holds in all cases |

## Resend & failure recovery

### PROFILE-011 — Resend a configuration profile to all failed hosts from the status modal

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

### PROFILE-012 — End user resends configuration profiles from the My device page

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

## User-scoped profiles

### PROFILE-013 — Surface which local user account received user-scoped macOS profiles

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

### PROFILE-014 — Show clear error for user-scoped configuration profiles on iOS/iPadOS

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** iOS/iPadOS
- **Preconditions:** iOS or iPadOS host enrolled; a user-scoped configuration profile added.
- **Source:** #34171

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Host details > OS settings modal for the iOS/iPadOS host with the user-scoped profile | The error message specified in Figma is shown for that profile |
| 2 | Inspect the profile row | The user icon does not appear next to the profile name on iOS/iPadOS hosts |

## Profile verification

### PROFILE-015 — Verify Windows device-scoped profiles via MDM protocol response without osquery

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

### PROFILE-016 — Send Windows profiles non-atomically with per-LocURI status

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

## Label targeting

### PROFILE-017 — Target configuration profiles with Include any/all and Exclude any across all platforms

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** All
- **Preconditions:** MDM on for all platforms; Manual, Dynamic, and IdP labels created and assigned across Windows, Apple, Apple-declaration, and Android hosts.
- **Source:** #14715, #17315, #22156, #32073

| # | Step | Expected result |
|---|------|-----------------|
| 1 | For each of the 4 profile types, upload with each target mode: no labels, include-any, include-all, exclude-any, include-any+exclude-any, include-all+exclude-any | Each combination uploads and applies correctly per profile type |
| 2 | Verify delivery against Manual, Dynamic, and IdP labels | Hosts receive (or are excluded from) profiles according to their label membership and target mode |
| 3 | Create a Dynamic exclude-any label, then add a profile excluding it before the host re-runs queries | The profile is not gated by the new exclude label until the host's labels recalculate (after the next refetch), then exclusion applies |
| 4 | Configure the same targeting via GitOps and API | Targeting behaves identically to the UI |

### PROFILE-018 — Prompt to create a label when adding a profile with no labels available

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

## Activity feed

### PROFILE-019 — Host and global activity shows configuration profile name and install status

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
