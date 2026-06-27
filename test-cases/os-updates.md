# OS Updates — test cases

> Feature area. Effective regression set curated from Fleet feature-story test
> plans (audited: deduped across former product groups; cosmetic/low-value checks
> pruned). Each case keeps its origin story #s in **Source**. See
> [`README.md`](README.md) for conventions; GitOps flows live in [`gitops.md`](gitops.md).

## Windows OS update enforcement

### OSUPDATE-001 — Enforce Windows OS updates with deadline and grace period via UI

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

### OSUPDATE-002 — Configure Windows OS update enforcement via CLI (YAML)

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Windows
- **Preconditions:** Premium license; Windows MDM turned on; fleetctl configured with admin or maintainer credentials.
- **Source:** #11951

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Apply a YAML config that sets the Windows OS update minimum/enforcement, deadline, and grace period for a team via fleetctl. | The config applies successfully and the values appear in Controls > OS updates for that team. |
| 2 | Open the global Activity feed. | An activity entry records the OS updates enforcement change. |

### OSUPDATE-003 — Reject invalid Windows OS update deadline and date values

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

### OSUPDATE-004 — Windows OS updates deadline and grace period validation and removal

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

## Custom OS update profiles

### OSUPDATE-005 — Allow custom OS updates and disk encryption profiles via experimental server config

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

## Apple OS update enforcement

### OSUPDATE-006 — Apple OS update deadline enforced at 7 PM local time

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

### OSUPDATE-007 — Only update new Apple hosts below the minimum OS version during enrollment

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

### OSUPDATE-008 — Reject non-existent OS versions and bad dates in Apple OS update settings

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

## Moved in (review placement)

### OSUPDATE-009 — Previously applied settings and labels remain correct after OS 26 upgrade

- **Tier:** Both
- **Priority:** P1
- **Platforms:** macOS | iOS/iPadOS
- **Preconditions:** An enrolled host (pre-26) with disk encryption enabled, a mix of passing/failing policies, software status, IdP information, and applicable labels, scheduled for upgrade to OS 26.
- **Source:** #30696

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Upgrade the host to OS 26 and open Host details | Disk encryption status, software status, and IdP information remain active and display correctly |
| 2 | Review policy results after the upgrade | Previously failing/passing policies still report correctly; policies expected to start passing after the upgrade now pass |
| 3 | Review labels on the host and in label filter results | Still-applicable labels remain; any label the host no longer qualifies for is removed from the host and from label-filter results |
