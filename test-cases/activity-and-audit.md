# Activity & Audit — test cases

> Feature area. Effective regression set curated from Fleet feature-story test
> plans (audited: deduped across former product groups; cosmetic/low-value checks
> pruned). Each case keeps its origin story #s in **Source**. See
> [`README.md`](README.md) for conventions; GitOps flows live in [`gitops.md`](gitops.md).

## Activity automations

### ACTIVITY-001 — Enabling, editing, and disabling activity automations records activities with the webhook URL

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Logged in as a global admin on the Dashboard. Activity automations currently disabled.
- **Source:** #21709

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enable activity automations with a valid webhook URL and save | An "enabled" activity appears in the feed; its details show the configured URL |
| 2 | Edit the automation, change it to a different valid URL, and save | A new "edited" activity appears showing the new URL; the original "enabled" activity still shows the previous URL in its details |
| 3 | Edit the automation with an invalid URL and attempt to save | The save fails with a validation error and no activity is created |
| 4 | Disable the automation and save | A new "disabled" activity appears in the feed |
| 5 | Attempt to re-enable the automation with an invalid URL | The save errors and no activity is created |

## Moved in (review placement)

### ACTIVITY-002 — API-only user activities use the dedicated API-only avatar

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

### ACTIVITY-003 — Per-host MDM commands toggle reveals only Apple MDM command activities

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | iOS/iPadOS
- **Preconditions:** MDM turned on; a mix of MDM and non-MDM enrolled macOS and iOS/iPadOS hosts; at least one host with MDM commands and one with none.
- **Source:** #20712, #34704

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

## Activity feed: population & queue

### ACTIVITY-004 — MDM, DDM, and script activities appear in global Past and Upcoming feeds across platforms

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

### ACTIVITY-005 — Upcoming activities execute in a single ordered queue and are logged in order

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** All
- **Preconditions:** MDM turned on; VPP configured; an enrolled macOS, Windows, and Linux host; software titles (custom pkg, VPP, FMA) available.
- **Source:** #15920, #20712, #22866

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On an offline host, queue several actions in sequence: run a script, install a custom package, and install software | All items appear under the host's Upcoming tab in the order sent |
| 2 | Bring the host online | Queued items execute one at a time in the same order they were queued |
| 3 | Trigger a Fleet-initiated action via a failing policy automation (install software and run a script on failure) | Resulting activities are logged and show the "Fleet-initiated" copy |
| 4 | Run a self-service install from Fleet Desktop | Activity is logged with the "(self-service)" copy |
| 5 | Review the host Past tab and the global Activity feed after execution | Completed items appear in correct order with details modals matching the design |
| 6 | Repeat for macOS, Windows, and Linux | Ordering and logging are correct on every platform |

## Activity payload & actor attribution

### ACTIVITY-006 — Software activities include software_title_id across all package types

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** MDM turned on; VPP configured; ability to upload custom packages and FMA; API access to read activity details.
- **Source:** #22063, #24120

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Upload a software package via the Fleet UI | `added_software` activity includes `software_title_id` |
| 2 | Edit that package via the Fleet UI | `edited_software` activity includes `software_title_id` |
| 3 | Add a VPP (App Store) app | `added_app_store_app` activity includes `software_title_id` |
| 4 | Repeat upload/edit via the MSP Dashboard | `software_title_id` is present in the resulting activities |
| 5 | Repeat across Windows, macOS, and Linux packages and across FMA, custom packages, and VPP | `software_title_id` is present in the activity feed for every package type |

### ACTIVITY-007 — Enrolled-host activity and webhook include the host ID

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

### ACTIVITY-008 — Fleet-initiated activity shows the acting user, not "Fleet"

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Logged in as a non-Fleet user; ability to set `fleet_initiated=true` on an activity record in the database.
- **Source:** #28056

| # | Step | Expected result |
|---|------|-----------------|
| 1 | From /software/add, add an installer (FMA, VPP, or non-.exe custom package) set to install automatically | The associated Fleet-created policy is created |
| 2 | In the database, set `fleet_initiated = true` on the policy creation activity | (Setup step) |
| 3 | Open the global activity feed | The actor for the policy creation/edit/deletion activity is the currently logged-in user, not "Fleet" |

## Activity feed: filtering & sorting

### ACTIVITY-009 — Activity feed filtering by actor, type, and date with sorting

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet instance with a populated activity feed containing activities by multiple users across several types and dates.
- **Source:** #28178, #29727

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Type a user's full name, then their email, into the activity search bar | Activities are filtered to that actor for each input |
| 2 | Open the activity type dropdown | Types are ordered alphabetically (A–Z); the search bar is fixed while the list scrolls; searching narrows the list and shows an empty state when no type matches |
| 3 | Select a single activity type | Only that type's activities show and the selected type appears in the dropdown field |
| 4 | Pick a time option from the date dropdown | Activities are filtered to that date range |
| 5 | Use the sort dropdown to switch between newest and oldest | Activities reorder by time accordingly |
| 6 | Combine activity type, date range, and name/email filters at once | Only activities matching all selected filters are returned; applying any filter or sort resets pagination to page 0 |
| 7 | Filter by a name, email, type, or date range that has no matching activities | The appropriate empty state appears in each case |

## Activity types: specific events

### ACTIVITY-010 — Activity logged when macOS setup experience is canceled

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

### ACTIVITY-011 — Android Lock, Wipe, Unenroll, and Clear passcode are recorded in global and host activity feeds

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

## Audit activities: host & key events

### ACTIVITY-012 — Global activity logged when a recovery key is escrowed

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

### ACTIVITY-013 — Log a host_deleted audit activity per deleted host

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
