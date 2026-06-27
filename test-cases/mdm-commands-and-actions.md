# MDM Commands & Device Actions — test cases

> Feature area. Effective regression set curated from Fleet feature-story test
> plans (audited: deduped across former product groups; cosmetic/low-value checks
> pruned). Each case keeps its origin story #s in **Source**. See
> [`README.md`](README.md) for conventions; GitOps flows live in [`gitops.md`](gitops.md).

## fleetctl command output & results

### MDMCMD-001 — `fleetctl get mdm-commands` returns recent commands without timing out

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** A Fleet instance (Premium) with MDM enabled and a large volume of MDM command activity (e.g. dogfood or a tenant with many enrolled hosts).
- **Source:** #19143

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Run `fleetctl get mdm-commands` against the tenant with lots of MDM activity. | The command returns promptly and does not time out. |
| 2 | Inspect the returned list of commands. | Output is limited to the 20 most recent commands. |
| 3 | Re-run the command using the supported filter flags. | Results are narrowed according to the applied filter. |

### MDMCMD-002 — View MDM command results in vertical (line) format with fleetctl

- **Tier:** Both
- **Priority:** P1
- **Platforms:** macOS | iOS/iPadOS
- **Preconditions:** fleetctl configured against a Fleet instance with MDM-enrolled hosts. At least one recent MDM command exists.
- **Source:** #31473, #31500

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Run `fleetctl get mdm-commands` and note a recent command ID | Recent MDM commands are listed with their IDs |
| 2 | Run `fleetctl get mdm-command-results --id <command_id>` | Result is printed vertically (one field per line: ID, TIME, TYPE, STATUS, HOSTNAME, PAYLOAD, RESULTS) instead of garbled tabular output |
| 3 | Run `fleetctl mdm run-command` against multiple hosts, then fetch results with the vertical command | Results for all targeted hosts are returned, each in the vertical format |

### MDMCMD-003 — MDM command results show pending message when no result received

- **Tier:** Both
- **Priority:** P2
- **Platforms:** macOS | iOS/iPadOS
- **Preconditions:** fleetctl configured against a Fleet instance with at least one MDM-enrolled host that can be taken offline.
- **Source:** #31473, #31500

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Turn Wi-Fi off on an MDM-enrolled host and send an MDM command to it | Command is queued |
| 2 | Run `fleetctl get mdm-command-results --id <command_id>` for that command | Output reads "No results received. Please check again later." |

## Windows & Linux commands

### MDMCMD-004 — Run Windows MDM protocol commands via CLI/API with correct tier and role gating

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

### MDMCMD-005 — Remote lock/wipe a Linux workstation via fleetctl scripts

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

## Apple device actions

### MDMCMD-006 — Turn MDM off on an iPhone/iPad from Host details

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

### MDMCMD-007 — Clear passcode on an iOS/iPadOS host from Host details

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

### MDMCMD-008 — Lock a company-owned iOS/iPadOS host from the Location modal

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** iOS/iPadOS
- **Preconditions:** Fleet Premium with GeoIP configured. An unlocked company-owned iOS/iPadOS host. The Location modal is open (location currently not viewable until locked into Lost Mode).
- **Source:** #33509, #35824, #39835

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In the Location modal, click Lock | The Lock modal opens; its header reads only "Lock" (the word "host"/"hosts" is removed from this and the other Actions-dropdown modal headers) and the copy matches design |
| 2 | Close the Lock modal | The Location modal re-opens |
| 3 | Re-open Lock and confirm the lock | The modal closes on successful lock and does NOT re-open the Location modal even though you came from there |
| 4 | While the lock MDM command is pending, view the host | "LOCK PENDING" is shown with the updated tooltip copy |
| 5 | While the lock is pending, click "Show location" in the About section | An explanation that location is pending is shown |

### MDMCMD-009 — Refetch and unlock behavior for company-owned iOS/iPadOS host location

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** iOS/iPadOS
- **Preconditions:** Fleet Premium with GeoIP configured. A locked (Lost Mode) company-owned iOS/iPadOS host with a previously fetched location.
- **Source:** #33509, #35824, #39835

| # | Step | Expected result |
|---|------|-----------------|
| 1 | With location pending, click Refetch | The last known location (from the previous DeviceLocation command) remains shown until the refetch completes and a new location is reported |
| 2 | Select Actions > Unlock, then while the unlock is pending click "Show location" | The location is still shown during the pending unlock |
| 3 | After the host is fully unlocked, open the Location modal | Location is no longer viewable; the modal states the host must be locked (Lost Mode) first to view location |

## Command API surface

### MDMCMD-010 — Expose device_status and pending_action on the /hosts API only when requested

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Hosts present including at least one with a pending lock, a pending wipe, and one already locked; API token available.
- **Source:** #34923, #36009, #36094, #37657

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Call `GET /api/v1/fleet/hosts?include_device_status=true` | Each host object includes `device_status` and `pending_action` fields |
| 2 | Call `GET /api/v1/fleet/hosts` without the parameter | Host objects do not include `device_status` or `pending_action` |
| 3 | Call the endpoint with `include_device_status=true` and inspect a host with a pending lock, a host with a pending wipe, and a locked host | `device_status` and `pending_action` reflect accurate values for each of these states |

## Managed local account (macOS)

### MDMCMD-011 — Show managed account action and modal on Host details

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

### MDMCMD-012 — Managed local account password rotation modal behavior

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

### MDMCMD-013 — Managed local account rotation when UUID not yet captured (deferred)

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

### MDMCMD-014 — Managed local account password endpoint license and platform restrictions

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

## Android device actions

### MDMCMD-015 — Android MDM commands appear in CLI and API when profiles or self-service software are added

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

### MDMCMD-016 — Android action menu hides Lock, Unenroll, Wipe, and Clear passcode while a command is pending

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Android
- **Preconditions:** Fleet Premium with Android MDM connected; an enrolled Android host (BYO or company-owned/fully managed) with MDM enabled; user has permission to run host actions.
- **Source:** #41683

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the Host details page, trigger one of Lock, Unenroll, Wipe, or Clear passcode and confirm it so the command is pending. | The command enters a pending state. |
| 2 | Reopen the Actions menu on the same host. | Lock, Unenroll, Wipe, and Clear passcode options are hidden from the menu while any of those commands is pending. |

### MDMCMD-017 — Clear passcode and Lock manage a BYO Android work profile

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

### MDMCMD-018 — Clear passcode, Lock, and Wipe manage a company-owned Android host

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
