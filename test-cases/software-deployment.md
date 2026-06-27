# Software Deployment — test cases

> Feature area. Effective regression set curated from Fleet feature-story test
> plans (audited: deduped across former product groups; cosmetic/low-value checks
> pruned). Each case keeps its origin story #s in **Source**. See
> [`README.md`](README.md) for conventions; GitOps flows live in [`gitops.md`](gitops.md).

## Self-service availability & visibility

### SWDEP-001 — Hide Self-service when no self-service software is available

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Two teams; Team1 has self-service software, Team2 has only non-self-service software; Fleet Desktop installed on test hosts for each platform.
- **Source:** #19651

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add self-install software to Team1 and non-self-install software to Team2 for each platform. | Software is configured per team. |
| 2 | On a Team1 host, open the Fleet Desktop dropdown and the My Device page. | Self-Service option appears in the dropdown and the Self-Service tab is shown. |
| 3 | Transfer the host from Team1 to Team2 and wait for the ~5-minute refresh. | Fleet Desktop dropdown updates to remove the Self-Service option for Team2. |
| 4 | Open the My Device page on a host with no self-service software available. | The Self-Service tab is hidden. |

## Moved in (review placement)

### SWDEP-002 — Copy the FMA slug from the software details modal

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

### SWDEP-003 — List all installable software across teams via the public list-software API

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

### SWDEP-004 — MSP dashboard transfers all-teams software to newly created teams

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

### SWDEP-005 — Custom software icon overrides the VPP app icon in versions and vulnerabilities views

- **Tier:** Free
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Software installed on a host with a version flagged vulnerable; a VPP app associated with that software; a custom icon image to upload.
- **Source:** #32459

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Associate a VPP app to the software, then upload a custom icon for that software | The custom icon is saved |
| 2 | View the software vulnerability for that software's team | The custom icon is shown |
| 3 | View the software versions list, then open an individual software version | The custom icon is shown in both the list and the version details |
| 4 | View software that has no custom icon uploaded | The default icon is still shown |
| 5 | Remove the custom icon from the software, then re-check vulnerability view, versions list, and version details | The software icon falls back to the App Store VPP app icon in all three views |

### SWDEP-006 — Software detail page surfaces versions, policies, and status

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A software title with an installer uploaded; at least one host reporting the software so the status table has data.
- **Source:** #26894

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to the software detail page for the title (Software > the title). | Page loads with the software name and metadata in the title area. |
| 2 | Locate the versions list beneath the software name. | All known versions are listed under the software name. |
| 3 | Confirm the package's associated policies. | Policies tied to the package are surfaced under the package section. |
| 4 | Review the host status table. | The redesigned status table is shown with install status counts. |
| 5 | Compare padding and icon sizes in the software title area and the package title area against the Figma design. | Padding and icon sizes match the design. Note: a Figma design exists for this layout. |

### SWDEP-007 — Software version list paginates beyond 10 versions

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** A software title that has more than 10 distinct versions reported.
- **Source:** #26894

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to the software detail page for a title with more than 10 versions. | Versions are listed under the software name. |
| 2 | Observe the bottom of the versions list. | Pagination controls appear because there are more than 10 versions. |
| 3 | Page through the versions. | Additional versions load on the next page. |

### SWDEP-008 — Copy installer SHA256 hash from the UI

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A software title with an installer uploaded, shown on the software detail page.
- **Source:** #28099

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to the software detail page and find the package metadata in the installer section. | A copy icon appears next to the truncated SHA256 hash. |
| 2 | Hover over the truncated SHA256 hash. | A tooltip displays the full hash. |
| 3 | Click the copy icon. | A success flash message is shown. |
| 4 | Paste the clipboard contents elsewhere. | The full SHA256 hash value is pasted. |

### SWDEP-009 — SHA256 copy available to all software-viewing roles and in GitOps mode

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** A software title with an installer uploaded. Access to accounts with each role that has "View all software" (any role except GitOps).
- **Source:** #28099

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Log in as each role with "View all software" access and open the installer's software detail page, then copy the SHA256 hash. | Every such role can view and copy the SHA256 hash. |
| 2 | Enable GitOps mode and, as any user, navigate to the installer's software detail page. | The page is reachable and the SHA256 hash is visible. |
| 3 | Click the copy icon while in GitOps mode. | The SHA256 hash is copied and a success flash message is shown. |

## FMA catalog & add flow

### SWDEP-010 — Browse and manage Fleet-maintained apps in the Software catalog

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

### SWDEP-011 — Add software flow drops auto-install/self-service/targets for all package types

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** A team selected with VPP configured (so VPP apps are available).
- **Source:** #28062

| # | Step | Expected result |
|---|------|-----------------|
| 1 | From /software/titles, click "Add software", choose a Fleet-maintained app, and click "Add" | Title, platform, and version are listed per Figma; "Show details" and "Advanced options" reveal relevant info; there are NO Target or Options sections |
| 2 | Click "Back to software", then open the "App Store (VPP)" tab | The "Add software" button is disabled until a VPP app is selected from the list; there are NO Target or Options sections |
| 3 | Click "Back to software", then open the "Custom package" tab | "Add software" and "Advanced options" are disabled until a package is uploaded, then enabled; there are NO Target or Options sections |
| 4 | Add an FMA, a VPP app, and a custom package | Each adds successfully; afterward, Target and other options are configurable via the Actions dropdown and the edit (pencil) icon |

### SWDEP-012 — Add software Fleet-maintained tab supports app/platform filters and pagination

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A team selected; the Fleet-maintained apps catalog contains more than 20 apps spanning multiple platforms.
- **Source:** #37804

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Software > Add software > Fleet-maintained | An app filter and a platform filter are present |
| 2 | Review the table | Up to 20 rows of apps display; with more than 20, page navigation is present |
| 3 | Filter by each value in the app filter and the platform filter | Filtering works correctly for every option |
| 4 | Combine search with the filters | Search continues to work alongside the new filters |

## FMA install & uninstall (host)

### SWDEP-013 — Install and uninstall a Fleet-maintained app on a macOS host

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

### SWDEP-014 — 1Password (universal macOS package) installs and uninstalls on both Apple Silicon and Intel

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** One enrolled Apple Silicon Mac and one enrolled Intel Mac; 1Password available as a Fleet-maintained app.
- **Source:** #27389

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add 1Password via Add Fleet-maintained apps | 1Password is added using the universal package (not the Arm-only build) |
| 2 | Install 1Password on the Apple Silicon Mac and launch it | App installs and works |
| 3 | Install 1Password on the Intel Mac and launch it | App installs and works |
| 4 | Uninstall 1Password on both Macs | Uninstall succeeds on Apple Silicon and Intel |

Note: This story replaced the prior Arm-only 1Password package with a universal package so Intel Macs are supported.

### SWDEP-015 — 1Password Windows FMA full install, auto-install, reinstall, and uninstall lifecycle

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** An enrolled Windows host with 1Password installed manually (signed in, app open); host vitals refetched; team selected.
- **Source:** #27795

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Confirm 1Password shows in the host's software list, then add 1Password as a Windows FMA with an automatic install policy | App is added to the FMA list and the automatic policy is created |
| 2 | Refetch host vitals | The host PASSES the policy; reported version appears on the same line as the "Available to install" FMA installer |
| 3 | From host > Software (filter "Available to install"), find 1Password and click Actions > Install | An "install software" command appears in upcoming activity; once it moves to Past, 1Password is reinstalled (note app open/signed-in state through reinstall) |
| 4 | Remove 1Password via "Add or remove programs" and refetch vitals | Software is no longer reported installed; the host FAILS the automatic install policy |
| 5 | Wait for the failed policy to act | An install command appears in upcoming activity; once Past, 1Password is installed and the host PASSES after a vitals refetch |
| 6 | From host details > Software, click Actions > Uninstall on 1Password | An upcoming uninstall activity is created and 1Password is successfully uninstalled |
| 7 | Restart the host after install | 1Password continues to work; verify behavior on both x86 and Arm hosts and via Self-service |

## VPP setup & add apps

### SWDEP-016 — Connect VPP and add Apple App Store apps to a team

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

### SWDEP-017 — Show VPP token expiring and expired renewal banners

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Premium license active; VPP token connected; database access to adjust the token's expiry date.
- **Source:** #18867, #19691

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Set the VPP token to expire within 30 days and reload Fleet | The "expiring" renewal banner is shown |
| 2 | Set the VPP token expiry to a past date and reload | The "expired" banner is shown |
| 3 | Click the link in the banner | The link resolves to the renew-VPP portal |
| 4 | Surface other banners alongside the VPP banner | Banner display order matches the documented order of preference |

## VPP install (host)

### SWDEP-018 — Install a VPP App Store app on a macOS host

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

### SWDEP-019 — Install a self-service VPP app and confirm license count updates

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Premium license active; macOS MDM on; VPP token connected; managed macOS host enrolled and assigned to a team.
- **Source:** #18867, #19620

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add a VPP app to the host's team with the Self-service box checked | App is saved as self-service for that team |
| 2 | Open Fleet Desktop / My device on the assigned host | The self-service app appears as available to the end user |
| 3 | Install the app from self-service | App installs on the host and behaves like other self-service installs |
| 4 | Check the VPP license counts after the install completes | License counts decrement to reflect the consumed seat |

## Large installer uploads

### SWDEP-020 — Upload large software installers with progress, size limit, and no timeout

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

### SWDEP-021 — Upload and install a package up to 10 GB

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** A team in Fleet and an enrolled macOS host. A valid installer package whose size is large (multiple GB, up to the 10 GB limit).
- **Source:** #37464

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In Software, add the large package (up to 10 GB) to the team. | The upload completes successfully without timing out; the package appears in the team's software. |
| 2 | Install the package on the enrolled macOS host via Fleet. | The install runs and the software reports as installed on the host. |

### SWDEP-022 — Oversized package upload over 10 GB shows clear error

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** A team in Fleet. An installer package larger than 10 GB.
- **Source:** #37464

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Attempt to add a package larger than 10 GB. | The upload is rejected with an easy-to-understand error message stating the file exceeds the size limit. |
| 2 | Observe upload timeout behavior during a long large-file upload. | Timeout mechanisms do not prematurely interrupt a valid in-progress upload flow. |

## Automatic-install policies

### SWDEP-023 — Auto-create a policy when adding a Fleet-maintained app with Automatic install

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

### SWDEP-024 — Enable auto-install policy on an existing installer

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** A software title at /software/titles/:id with an installer package already uploaded (non-.exe). Logged in as a user with software-write access.
- **Source:** #28060

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the software title page, click Actions > Auto-install. | The Auto-install modal appears per the Figma design with a toggle. |
| 2 | Observe the modal before toggling. | The Target selection is hidden until automatic install is enabled. |
| 3 | Switch the toggle to the enabled state. | Target radio buttons become visible. |
| 4 | Leave "All hosts" selected and click Save. | A flash message "Install policy successfully edited" appears and you return to the /software/titles/:id page. |
| 5 | Review the policies table in the software installer section. | A new policy appears with the Fleet icon next to it. |
| 6 | Click the new policy. | An informational modal opens showing the policy query. |
| 7 | Click "Done" in the modal. | The modal closes. |

### SWDEP-025 — Auto-install policy triggers install on a compatible host

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Auto-install enabled (All hosts) for a software title; an enrolled host compatible with the software that does not yet have it installed.
- **Source:** #25499, #28060

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the compatible host that lacks the software, refetch host vitals. | The auto-install policy reports as failing for that host. |
| 2 | Open the host detail page. | An upcoming activity item indicates the pending software install. |
| 3 | Wait for the software to install, then refetch host vitals. | The software shows as installed and the policy now passes. |
| 4 | Refetch host vitals again with the software still installed. | The software does not attempt to reinstall. |
| 5 | Uninstall/delete the software from the host, then refetch host vitals. | The software attempts to re-install via the auto-install policy. |

### SWDEP-026 — Disable auto-install policy and confirm removal

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** A software title that currently has an auto-install policy enabled.
- **Source:** #28060

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the /software/titles/:id page, click Actions > Auto-install. | The Auto-install modal opens with the toggle in the enabled state. |
| 2 | Toggle the auto-install setting to the disabled state and click Save. | A "Save changes" confirmation modal appears. |
| 3 | Click Save in the confirmation modal. | A flash message "Install policy successfully edited" appears. |
| 4 | Review the policies table in the software installer section. | The automatic install policy no longer appears. |
| 5 | Open the Global activity feed. | Activities for enabling and disabling the auto-install policy are recorded with the logged-in user as the actor. |

### SWDEP-027 — Auto-install disabled for .exe installers

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Windows
- **Preconditions:** A software title with an .exe installer attached.
- **Source:** #28060

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to the software title page for the .exe installer. | The page loads with the installer section. |
| 2 | Open the Actions menu and locate Auto-install. | The Auto-install action is disabled and shows a tooltip explaining why it is unavailable for .exe installers. |

## Label scoping (custom targets)

### SWDEP-028 — Scope Fleet-maintained apps, custom packages, and VPP apps by labels

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Premium license active; MDM on; at least two manual/dynamic labels created and assigned to hosts; a team selected.
- **Source:** #22813, #23744

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

### SWDEP-029 — Custom scope "Labels include all" for software install scoping

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** A team with FMA and custom package installers; multiple labels defined; hosts with varying label membership; Premium (adding software is Premium-only).
- **Source:** #39916

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Edit an existing software item and choose the "Include all" scope option (FMA and custom package) | "Include all" is available when editing; supported for FMA and custom package |
| 2 | Select one label, then multiple labels, and try to save with no label selected | One or multiple labels can be saved; saving with "Include all" and no label selected is blocked |
| 3 | Verify install scope against hosts | Software appears for hosts that have all selected labels; a host with none of the labels does not receive it; only in-scope software shows in that host's Self-service |
| 4 | Add the missing required label to an out-of-scope host, then remove a required label from an in-scope host | Newly-qualifying host becomes eligible; host that loses a required label is removed from install scope |
| 5 | Re-edit the item, then switch Include all → Include any and Include any → Include all | Previously selected labels are preserved on edit; switching to Include any updates behavior; switching to Include all requires all labels as expected |
| 6 | Delete a label that was part of an "Include all" selection (and delete all in-scope labels) | Scope updates correctly when the label(s) are removed |

Note: As of 4.83 the "Include all" option is no longer offered when adding a new software item — only when editing an existing one.

## BYOD iOS/iPadOS unenroll

### SWDEP-030 — Auto-uninstall managed apps when BYOD iOS/iPadOS hosts unenroll

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** iOS/iPadOS
- **Preconditions:** Premium license active; Apple MDM on; VPP token connected; a personally-owned (BYOD) profile-enrolled iPhone/iPad enrolled; ability to deliver `.ipa` apps.
- **Source:** #27015, #35941

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add a VPP app to the team and install it on the BYOD iOS/iPadOS host, then unenroll the host | The VPP app is uninstalled from the host on unenrollment |
| 2 | Add an `.ipa` app to the team, install it on the BYOD host, then unenroll the host | The `.ipa` app is uninstalled from the host on unenrollment |
| 3 | Send a custom `InstallApplication` MDM command with `ManagementFlags` set to 0 to install a VPP app, then re-send it with `ManagementFlags` set to 1; after acknowledgment, unenroll the host | The app installed with the managed flag is removed during unenrollment |
| 4 | Install a VPP app on a macOS host and remove its enrollment profile | The app is not removed from the macOS host (auto-uninstall is BYOD iOS/iPadOS only) |
| 5 | Confirm the documented copy changes are present in the relevant UI | Copy matches the specified updates |

## iOS/iPadOS app auto-update

### SWDEP-031 — Apple App Store apps auto-update on schedule for managed iOS/iPadOS devices

- **Tier:** Premium
- **Priority:** P1 (core regression)
- **Platforms:** iOS/iPadOS
- **Preconditions:** Fleet Premium with Apple MDM/VPP configured; a team with frequently-updated VPP App Store apps assigned via GitOps; enrolled iPhone and iPad devices, including at least one on iOS/iPadOS 26+ and one below iOS/iPadOS 26.0; device Settings > "App Updates" (automatic updates) turned off so Fleet drives updates; access to `~/fleet_logs.txt`.
- **Source:** #27015, #33391

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Assign a set of frequently-updated VPP App Store apps to the team and enroll an iPhone and an iPad (one device 26+, one below 26.0), with automatic App Updates disabled on each. | Apps install on the devices and are tracked by Fleet for updates. |
| 2 | Over multiple days, allow new App Store versions to be released for the installed apps and let the scheduled-update cron run. | Fleet schedules and applies the available app updates to the managed devices without the end user updating manually. |
| 3 | Inspect the logs with `grep "handle_scheduled_updates" ~/fleet_logs.txt` and check app versions on both devices. | Scheduled-update activity is logged and the apps update to the newer versions on both the 26+ and the below-26.0 device. |

## Install/uninstall status on Host details

### SWDEP-032 — Software install/uninstall status shows progress and failure modal on Host details

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS, Windows, Linux
- **Preconditions:** Premium instance. Software added to a team, and a host assigned to that team. The host can be brought online and offline. A design exists in Figma.
- **Source:** #26691, #28925

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the team host's Host details > Software tab, for available software select Actions > Install while the host is online | Status shows "Installing" with a spinner during installation |
| 2 | For an installed app, select Actions > Uninstall while the host is online | Status shows "Uninstalling" with a spinner during the uninstall |
| 3 | Trigger an install or uninstall that fails | Status shows "Failed" |
| 4 | Click the "Failed" status | A modal opens showing the same failure detail that appears when clicking the activity in the activity feed |

## Host details Software: Inventory vs Library

### SWDEP-033 — Host details Software tab splits into Inventory and Library with correct columns

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS, Windows, Linux, iOS/iPadOS
- **Preconditions:** Premium instance. A host assigned to a team that has software in its library, including self-service items and software with multiple file paths and multiple hashes. A design exists in Figma.
- **Source:** #29728

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to a host's Host details > Software tab | A tertiary nav shows "Inventory" and "Library"; Inventory is selected by default |
| 2 | Review the Inventory tab columns | Columns are Name, Installed version, Type, Last opened, Vulnerabilities, File path, Hash; no hidden columns; the old software filter dropdown is gone |
| 3 | Hover over a truncated file path, and hover over the "Last used"/"Last opened" header | Tooltip shows the full file path; the last-opened header has an underline with tooltip "Date and time of last open" |
| 4 | Click "# file paths" for software with multiple paths, then "# hashes" for software with multiple hashes | A modal opens listing the different file paths; a separate modal lists the different hashes |
| 5 | Switch to the Library tab and review its controls | The "Add filters" link is gone; an "All available" dropdown is present with options All available and Available for self-service |
| 6 | Select "Available for self-service" in the dropdown | Only self-service items are shown |
| 7 | Review the Library tab columns | Columns are Name, Status, Installed version, Installer version, Actions (Type column removed) |
| 8 | Review the icons next to library items | Icons indicate auto-install, self-service, and self-service-with-autoinstall |
| 9 | Click "Add software" on the Library tab for the team | Navigates to the team's Add software page (e.g. software/add/fleet-maintained?team_id=...); iOS/iPadOS routes to Add VPP, macOS/Windows to Add FMA, others (chrome, linux) to Add custom package |
| 10 | Install a library item, then observe its actions during install | Install/uninstall actions are disabled while installing |
| 11 | View actions for already-installed software | "Reinstall" replaces "Install" as an action |
| 12 | Trigger a failed install and click the "Failed" status | The standard failure-detail modal opens |
| 13 | Hover over a truncated version on the Library tab | A tooltip shows the full version |
| 14 | Use pagination and search on both the Inventory and Library tabs | Pagination works on both tabs; search returns correct results scoped to the active tab |

### SWDEP-034 — Library tab hidden in Fleet Free and unsupported platforms

- **Tier:** Free
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** A Fleet Free instance, plus an Android device enrolled.
- **Source:** #29728

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On Fleet Free, open a host's Host details > Software tab | The Library tab is hidden; only Inventory is shown |
| 2 | View the Software tab for an Android device | The Library tab is hidden and the "Software not supported" empty state is shown |

### SWDEP-035 — Software library status reflects whether software is on the host and offers correct actions

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** A host with several self-service installers available (test FMA, custom packages, and VPP) across Chrome, Safari, Edge, and Firefox.
- **Source:** #27983, #30240

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the host details Software > Library tab (or Self-service) | Default sort is Name ascending and is reversible; sorting by status orders per Figma and is reversible; rows use regular font weight |
| 2 | Locate software not in inventory | Status shows "---" with only "Install" available (no Uninstall) |
| 3 | Click "Install" on a "---" item | Status changes to "Installing", then to "Installed" on success or "Failed" on failure |
| 4 | Locate software present in inventory | Status shows "Installed" with "Reinstall" and "Uninstall" available |
| 5 | Click "Uninstall" on an installed item | Status changes to "Uninstalling", then to "---" on success or "Failed (uninstall)" on failure |
| 6 | Locate software meeting update criteria (per #27983) | Status shows "Update available" with "Update" and "Uninstall" available |
| 7 | Click "Update" | A details modal shows installed-software detail and possible actions; clicking Update closes the modal, status becomes "Updating", then "Installed" on success (or "Failed") |
| 8 | Click any status (any OS) | A details modal opens whose title matches the status; install/uninstall details dropdowns are collapsed by default and shown only for Fleet-completed installs/uninstalls |

Note: Tarball (`tgz_packages`) software is not inventoried — its Library status only reflects Fleet-triggered installs (Installed + Reinstall/Uninstall on success, Failed + Install on failure, no status when only available). Before the 4.72 VPP fix, Host details > Library status for VPP success/fail installs was non-clickable but offered a tooltip to the activity feed.

## Software page: Inventory vs Library

### SWDEP-036 — Software page separates Inventory and Library, Library disabled for All teams

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** All
- **Preconditions:** Premium instance with at least one team that has software in its library. A design exists in Figma.
- **Source:** #32128

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to the Software page | The page shows distinct "Inventory" and "Library" tabs |
| 2 | Confirm the team selector is on a specific team and open the Library tab | The Library tab is enabled and shows the team's software library |
| 3 | Verify the "Available for install" and "Self-service" filters are no longer on the Inventory tab | Those filters appear only on the Library tab |
| 4 | Switch the team selector to "All teams" | The Library tab is disabled (Library is Fleet/team-specific) |
| 5 | Switch between tabs and apply filters/search, then switch teams | Tab state, navigation, filtering, and displayed results stay correct for each tab and team selection |

## Software titles API

### SWDEP-037 — Software titles API returns platform for installer and VPP titles

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Apple MDM/VPP configured; a macOS host enrolled; a team set up with VPP apps (macOS/iOS/iPadOS) and installers (FMA or custom packages) for macOS, Windows, and Linux.
- **Source:** #25378

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Call `GET /api/latest/fleet/software/titles` | Each installer/VPP title returns a `platform` field set within `software_package` or `app_store_app` as appropriate |
| 2 | Call `GET /api/latest/fleet/software/titles/{id}` for an installer title and a VPP title | `platform` is present and correct within `software_package` (installer) or `app_store_app` (VPP) |
| 3 | Install an available software package or VPP app, then re-query the title | Installed software still returns the appropriate `platform` for its `software_package` / `app_store_app` |
| 4 | Call `GET /api/v1/fleet/hosts/:id/software` for a host on a team that has both a software package and a VPP app available | `platform` is set for every entry under `software_package` and `app_store_app` |
| 5 | Call `GET /api/v1/fleet/setup_experience/software?team_id=:team_id` for a team with both a package and VPP app | `platform` is set for every entry under `software_package` and `app_store_app` |

## Add from software details (already-installed)

### SWDEP-038 — Add Fleet-maintained app from the software details page (Patch modal) when host already has it installed

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS | Windows
- **Preconditions:** Team selected; an enrolled host on that team that already has an app installed manually (the app matches an available Fleet-maintained app that has NOT yet been added to Fleet); host vitals refetched so the software appears in inventory.
- **Source:** #25499, #27592, #28051, #28060

| # | Step | Expected result |
|---|------|-----------------|
| 1 | From the host's Software list, click the installed software title to open its software details page | Software details page opens with no installer package section |
| 2 | Click "Add software" | An Add modal appears showing the matching Fleet-maintained app, labeled "Fleet-maintained" |
| 3 | Click "Show details" | Patch modal closes and a Details modal opens; closing Details reopens the Add modal |
| 4 | Click "Add software" | Add button is disabled and a loading state shows while uploading |
| 5 | Wait for the upload to complete | User lands on the software details page with the package added; a success flash confirms the package is available; installer info shows below the title/host-info section |
| 6 | Open the Actions dropdown | Dropdown lists Patch, Auto-install, Enable self-service, View all hosts; installer action icons are download, edit (pencil), delete (trash) |

### SWDEP-039 — Add App Store (VPP) app from software details page when host already has it installed

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | iOS/iPadOS
- **Preconditions:** VPP configured; an enrolled host with an app installed manually that maps to an App Store (VPP) app available in Fleet but not yet added; host vitals refetched.
- **Source:** #27592

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the software details page for the installed title from the software list | Page shows no installer package associated with the app |
| 2 | Click "Add software" | A modal appears showing the VPP app with a label indicating it is a VPP app |
| 3 | Confirm the version offered | The latest App Store version known to Fleet is shown |
| 4 | When the title maps to both a VPP app and a Fleet-maintained app, click "Add software" | The modal shows the VPP app (VPP takes precedence over FMA) |

## Patch policies

### SWDEP-040 — Patch policy installs the app on hosts running an older version

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS | Windows
- **Preconditions:** A Fleet-maintained app installer is uploaded to a team; three enrolled hosts on the team: one with an older version installed, one with no version installed, one with the same-or-newer version installed.
- **Source:** #25499

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the software details page, click Actions > Patch | The Patch modal opens with no custom-targets option |
| 2 | Enable patching and click Save | Loading state shows, then user returns to the software details page with a flash confirming the patch policy was saved |
| 3 | Review the installer section | A "Patch <title>" policy appears with a Fleet icon; hovering the icon shows a "Fleet-created policy" tooltip |
| 4 | Click anywhere on the policy row | A read-only policy modal opens showing name/description/query (does not navigate to the policy editor) |
| 5 | Refetch vitals on all three hosts | Policy fails only on the host with the older version; passes/does not apply on the no-version and same-or-newer-version hosts |
| 6 | Wait after the failure on the older-version host | An install command is issued; the app installs, reports the new version, and the policy passes after the next vitals refetch |

## Edit installer & count resets

### SWDEP-041 — Edit installer package resets policy counts; editing advanced options preserves them

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** An installer uploaded to a team that has associated policies with Installed/Pending/Failed counts populated.
- **Source:** #20404, #22168, #22177, #25499, #28053

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the software details page, click the edit (pencil) icon | A modal opens allowing the package to be changed and showing advanced options (and scoping/self-service) |
| 2 | Upload a different installer package and click Save | A "Save changes?" confirmation modal opens |
| 3 | Confirm Save | Changes save with a success flash; Installed/Pending/Failed counts reset to "—" (0) |
| 4 | Open the edit modal again, change only advanced options, and Save through the confirmation | Changes save with a success flash; Installed/Pending/Failed counts are NOT reset |

### SWDEP-042 — Swap installer version via Save changes modal

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A software title with a custom (non Fleet-maintained) installer package uploaded, and a different version of the same installer available to upload. Admin is on /software/titles/:id. Note: Fleet-maintained apps do not offer the option to edit/swap the installer.
- **Source:** #28061

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Click the pencil icon to edit the software installer | The Edit software modal appears (no self-service options shown) |
| 2 | Swap the installer for a different version of the same software and click Save | A "Save changes?" confirmation modal appears |
| 3 | Click Save | A success flash appears, the user returns to /software/titles/:id, and the new installer version is reflected |

## Delete installer & policy cleanup

### SWDEP-043 — Delete Fleet-maintained installer removes its Fleet-created policies and pending installs

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** A Fleet-maintained app installer uploaded with Fleet-created patch and/or auto-install policies; at least one host with an upcoming "install software" command in its activity feed.
- **Source:** #25499, #28059

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the software details page, click the delete (trash) icon | A delete confirmation modal opens |
| 2 | Click Delete | A flash confirms the installer was deleted; user returns to the software details page with the installer section removed and no associated policies shown |
| 3 | Check the Policies page | The Fleet-created patch/auto-install policies for that installer are gone |
| 4 | Check the host's activity feed | Any upcoming "install software" commands for that software are canceled |

### SWDEP-044 — Delete installer with an attached custom policy detaches it without blocking

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** An installer uploaded with a user-created (custom) policy whose "Install software" automation targets it.
- **Source:** #25499, #28059, #28061

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the software details page, click the delete (trash) icon and confirm Delete | Deletion is not blocked; a flash confirms the installer was deleted and the user returns to the software details page |
| 2 | Review the page | Installer section is removed and no associated policies are shown |
| 3 | Open the previously attached custom policy's automations | The custom policy still exists but its "Install software" automation no longer references the deleted software |

## Software details page layout

### SWDEP-045 — Software details page shows installer section with status counts and policies

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** A software title with an uploaded installer (test across FMA, custom package, and VPP) that has install-on-policy-failure automations set up.
- **Source:** #25499, #28053

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open /software/titles/:id for the title | Versions appear in a section under the app name; installer information is in a separate section below the title/version section |
| 2 | Review the installer section label | "Fleet-maintained", "App Store (VPP)", or "Custom Package" is shown below the package name; custom packages otherwise carry no label |
| 3 | Locate the Installed/Pending/Failed counts | The counts table appears below the installer information; clicking a count opens a host list filtered by that status and title |
| 4 | Review the policies area | The list of associated policies appears below the counts table; clicking a policy navigates to /policies/:id?team_id=... |
| 5 | Verify pagination | Policies paginate, and versions paginate after 10 items |
| 6 | Resize the page down to 768px per breakpoints | Layout is responsive across the Figma breakpoints (design exists) |
| 7 | Inspect the `software_package` API response | `fleet_maintained_app_id` is an integer (usable with GET fleet_maintained_apps) when added via FMA, and null otherwise |

### SWDEP-046 — Software installer actions (download, edit, delete) on the software detail page

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Fleet Premium. A software title that already has an installer package added, viewed on its software detail page.
- **Source:** #28051

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Locate the software installer section | The old Actions dropdown is gone; Download, Edit, and Delete are shown as icons in the installer section |
| 2 | Click the download icon | The software installer file downloads |
| 3 | Click the pencil (edit) icon | A modal opens where you can edit Target, Self-service, and Advanced options for the installer |

## Architecture-aware auto-install

### SWDEP-047 — Apple Silicon-only FMA does not auto-install on Intel Macs

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** An Apple Silicon (Arm)-only Fleet-maintained app available; one enrolled Arm Mac and one enrolled Intel (x86) Mac, neither having the app installed.
- **Source:** #25499, #27392

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add the Arm-only FMA and enable auto-install | Auto-install policy is created |
| 2 | Refetch vitals on the x86 Mac | Policy passes on the x86 host (no install attempted) |
| 3 | Refetch vitals on the Arm Mac | Policy fails and an install is triggered on the Arm host |

## Post-install refetch

### SWDEP-048 — Host vitals refetch is queued only after a successful software install

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** An MDM-enabled macOS host plus Windows/Linux hosts; VPP, FMA, and custom package installers available; ability to force install failures.
- **Source:** #27983, #30035

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Queue a VPP install that fails on an MDM macOS host | The failed VPP install does NOT trigger a host vitals refetch |
| 2 | Queue a VPP install that succeeds | The successful VPP install triggers a host vitals refetch |
| 3 | Queue a failing FMA/custom package install on macOS/Linux/Windows | The failed install does NOT trigger a refetch |
| 4 | Queue a succeeding FMA/custom package install | The successful install triggers a refetch |
| 5 | Trigger a successful install while a refetch is already pending | No additional refetch is stacked on top of the pending one |
| 6 | Add team policies with software-install automations and refetch vitals | Each failed policy triggers its install; after each install succeeds, the policy flips to "passed" |

## Self-service install retry & activity

### SWDEP-049 — Self-service software installs retry and report every result to the activity feed

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Self-service software available across all platforms and types (FMA, custom packages, VPP); ability to create an installer that fails or randomly fails via modified install/post-install scripts.
- **Source:** #27983, #34068

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Install self-service software on each platform and each type | Installs succeed with no regressions to normal install behavior |
| 2 | Add a failing/randomly-failing installer to self-service and install it | Retries occur per the feature; every result (success or failure) appears in the activity feed |

## Inventory name matching

### SWDEP-050 — FMA apps with version numbers in inventory names install and uninstall (no name match expected)

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** An enrolled host; an FMA whose inventory name embeds a version number.
- **Source:** #27791, #27792

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add the FMA, install it on the host, then refetch vitals | The app installs and appears in inventory |
| 2 | Compare the inventory title (name-including-version) to the FMA package name | The names do NOT match (expected at this stage, since the package name falls out of date with the version-bearing inventory name) |
| 3 | Uninstall the app via Fleet and refetch vitals | The app uninstalls successfully and is removed from inventory |

## VPP add with options & auto-install

### SWDEP-051 — Add a VPP app with Self-service and Automatic install enabled

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS
- **Preconditions:** A VPP token is configured and connected; at least one macOS host is enrolled with MDM on; licenses are available for the chosen App Store app.
- **Source:** #23744

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to **Software > Add software > App store (VPP)** | The add form shows **Self-service** and **Automatic install** options; under **Target**, **All hosts** is selected by default |
| 2 | Select a macOS App Store app, enable both **Self-service** and **Automatic install**, and click **Add software** | A loading state appears, then a success message; you are navigated to the **Software** page with the **Available for install** filter applied |
| 3 | Open **Fleet Desktop > My device > Self-service** on the target host | The added app appears in the Self-service list |
| 4 | Return to the **Software** page and open the app's **Software title** page | A policy named "[Install software] `<App store app name>`" has been automatically created |
| 5 | On the **Software title** page, click the **Automatic install** pill | You navigate to the auto-created install policy |

### SWDEP-052 — Automatic install completes and status surfaces in Self-service and Host details

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** A VPP app was added with **Automatic install** enabled and targets an enrolled macOS host with MDM on.
- **Source:** #23744

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Wait for the automatic install to run on the target host | The app is installed on the host |
| 2 | Open **Fleet Desktop > My device > Self-service** | The install status (Verified/Pending/Failed) is shown for the app |
| 3 | Open **Host details > Software** for the host | The same install status is shown for the app |

## iOS/iPadOS VPP constraints

### SWDEP-053 — iOS/iPadOS apps cannot use Self-service or Automatic install

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** iOS/iPadOS
- **Preconditions:** A VPP token with iOS/iPadOS apps is connected.
- **Source:** #23744

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to **Software > Add software > App store (VPP)** and choose an iOS/iPadOS app | The **Self-service** and **Automatic install** options are disabled, with no tooltip on hover |
| 2 | Call the add-software API for an iOS/iPadOS app with `self_service` set to `true` | An easy-to-understand error message is returned and the app is not added |
| 3 | Call the add-software API for an iOS/iPadOS app with automatic install enabled | An easy-to-understand error message is returned and the app is not added |

## VPP API operations

### SWDEP-054 — Add, delete, and add FMA via the API

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** A VPP token is connected and a team exists.
- **Source:** #23744

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add a macOS App Store app via the API with `self_service` true, with automatic install, and with neither | Each variant is added successfully with the requested settings |
| 2 | Delete a macOS App Store app via the API, both with and without an associated policy automation | Deletion succeeds in both cases (policy automation handled as expected) |
| 3 | Add a Fleet-maintained app via the API with install automatically enabled | The FMA is added with automatic install enabled |

### SWDEP-055 — VPP app created_at timestamp tracks most recent add to a team

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** A VPP token is connected; API access to inspect timestamps.
- **Source:** #23744

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add a VPP app to a team and inspect its `created_at` | `created_at` reflects when the app was added to the team |
| 2 | Delete the VPP app from the team, then re-add it | The team `created_at` is updated and differs from the value in the `vpp_apps` table (it reflects the most recent add) |

## VPP metadata & versioning

### SWDEP-056 — App Store app version auto-updates to latest from the App Store

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** A VPP token is connected; a VPP app (e.g. Canva for macOS) has been added.
- **Source:** #23744, #32461

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the **Software title** page for an added VPP app | The version displayed matches the current latest version of the app on the App Store |
| 2 | Wait for the hourly Apple metadata refresh and re-check | The Fleet version matches what is installed on the host and what is available on the App Store (version fetched via the new Apple API every hour) |

### SWDEP-057 — VPP server connects directly to Apple metadata API when bearer token is set

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Ability to set Fleet server config via env var and CLI args.
- **Source:** #38622

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Set `FLEET_MDM_APPLE_VPP_APP_METADATA_API_BEARER_TOKEN` (via env var) and add/refresh a VPP app | Fleet talks to the Apple VPP metadata endpoint directly |
| 2 | Provide the same config via CLI args instead of the env var | Configuration works the same via CLI args |
| 3 | Start the server with no bearer token provided | Fleet operates through the proxy |
| 4 | Provide an incorrect bearer token | A straightforward error message is shown |

## VPP uninstall & license reclaim

### SWDEP-058 — Uninstall a VPP app from Host details and revoke its license

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS
- **Preconditions:** A VPP app is installed on an enrolled macOS host with MDM on; a valid (non-expired) VPP token; reclaimable license.
- **Source:** #25497

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the host's **Host details > Software** tab, find the installed App Store app and click **Actions > Uninstall** | A loading state appears, then a success message and a new "Uninstall (pending)" status; the uninstall MDM command is sent |
| 2 | Open **Activity > Upcoming** | An uninstall activity is created in **Upcoming** |
| 3 | After the uninstall completes, open **Activity > Past** and the global activity feed | An uninstall activity is created in **Past** and the global feed |
| 4 | Re-check the app's **Install status** in the **Software** table on **Host details** | Status is set to "Available for install" |
| 5 | Open the app's **Software title** page and check counts | The "Pending" count incremented at uninstall start; "Installed" was never incremented by the successful uninstall |

### SWDEP-059 — VPP uninstall blocked or fails with clear errors (no license, expired token, MDM off, unmanaged app)

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** An enrolled macOS host with a VPP App Store app present.
- **Source:** #25497

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Click **Actions > Uninstall** when Fleet cannot reclaim the license | An easy-to-understand error appears; install status reverts to its previous (non-pending) state; no uninstall MDM command is sent |
| 2 | Click **Actions > Uninstall** when the VPP token is expired | An easy-to-understand error appears; install status reverts to its previous state; no uninstall MDM command is sent |
| 3 | Turn off MDM for the host, then view **Actions > Uninstall** | **Uninstall** is disabled with an easy-to-understand tooltip; the uninstall API on this host returns an easy-to-understand error |
| 4 | Uninstall an app that was installed outside the App Store / is unmanaged, then check **Activity > Past** | The MDM response returns an error code indicating the app is unmanaged; that MDM response is presented in the Past and global activity feed; the "Failed" count increments while "Installed" never does |
| 5 | For the unmanaged app, choose **Actions > Install** to make it managed, then later **Actions > Uninstall** | Install makes the app managed; the subsequent uninstall succeeds |

### SWDEP-060 — Revoke VPP license when a pending install command is cancelled

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** An enrolled macOS host (MDM on, vitals refetched as MDM On); a VPP app on the team with a known available license count in ABM.
- **Source:** #27393

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Power off the host, then on **Host details > Software > Available for install** click **Install** for the VPP app | A pending install command appears in **Activity > Upcoming** |
| 2 | Check available licenses in Apple Business Manager | The available license count decreases by one while the install is pending (e.g. 100 to 99) |
| 3 | On **Activity > Upcoming**, cancel the pending install | The upcoming activity is cancelled and the MDM command is cancelled (does not go through) |
| 4 | Re-check available licenses in Apple Business Manager | The available license count is returned to its original value (e.g. back to 100) |

## VPP install failures

### SWDEP-061 — Surface VPP automatic-install failure when MDM is off

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** A macOS host with MDM turned off.
- **Source:** #25514

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add an App Store app with automatic install enabled, targeting the MDM-off host | The install policy applies to the host |
| 2 | Open the host's activity feed | The policy failed because MDM is off |
| 3 | Click **View details** on the failure | The correct failure modal appears |
| 4 | Click the **Learn more** redirect(s) in the modal | The appropriate help pages open |

### SWDEP-062 — Surface VPP install failure when no licenses are available

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** A VPP app whose ABM licenses are exhausted; an enrolled macOS host with MDM on.
- **Source:** #25514

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Trigger install of the App Store app when there are no available licenses | The install fails |
| 2 | Open **Host details** activity feed | A "failed to install" activity appears under **Past**; no install activity ever appears under **Upcoming** |
| 3 | Click **View details** and the **Learn more** redirects | The correct failure modal appears and the appropriate help pages open |
| 4 | Open the app's **Software title** page | The "Failed" count is incremented; the "Pending" count is never incremented |
| 5 | Call the install API for a host with MDM off, and again with no available licenses | Each call returns an easy-to-understand error message |

### SWDEP-063 — VPP install failure activity items only fire for VPP-associated install policies

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** A team with a mix of policies: VPP install-software automations, FMA/custom-package automations, and other automations (run script, calendar events).
- **Source:** #25514

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Cause a policy NOT associated with a VPP install automation to fail | No activity-feed item is created |
| 2 | Cause a policy associated with a VPP install automation to fail while MDM is enabled | No activity-feed item is created |
| 3 | Cause failures for other automations (run script, calendar events, other workflows) and for FMA/custom-package policies | None of these policy failures create activity items |

### SWDEP-064 — Self-service VPP install blocked when MDM off or out of licenses

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** A self-service VPP app exists; access to **My device > Self-service** on a host.
- **Source:** #25514

| # | Step | Expected result |
|---|------|-----------------|
| 1 | With MDM off on the host, open **My device > Self-service** | The VPP app is not available to install |
| 2 | With MDM on but the self-service app out of licenses, open **My device > Self-service** and click **Install** | An error message appears |
| 3 | Open the host's activity feed | A failure is recorded |
| 4 | Click **View details** and the **Learn more** redirects on the failure | The correct modal appears and the appropriate help pages open |

## VPP install status resolution

### SWDEP-065 — Verify VPP install status resolves correctly across delayed, failed, and successful installs

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS
- **Preconditions:** An App Store app added; an enrolled macOS host with MDM on.
- **Source:** #28738

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Initiate install, then interrupt connectivity between MDM command ACK and actual install; wait ~5 min, then restore connectivity | Once `InstalledApplicationList` reports the app installed, status changes to "Installed" (if it never reports installed, status becomes "Failed") |
| 2 | Initiate install successfully, then before verification delete the app so the next `InstalledApplicationList` shows it absent | Status changes to "Failed" with a link to the validation error message |
| 3 | Initiate install but prevent the app from installing; wait ~5 min | Status changes to "Failed" with a link to the error message |
| 4 | For a verification/install failure, check **Host details > Past activity**, **Host details > Software > Show details**, and **Self-service > Failed** | The failure error message is shown in all three places |
| 5 | Initiate install and let it complete normally | Status changes to "Installed" |

## Self-service uninstall

### SWDEP-066 — End user uninstalls non-App-Store software from Self-service

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Fleet Desktop is available on the host; an installed (non-App-Store) self-service app with a working uninstall script.
- **Source:** #28038

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Fleet Desktop self-service and look at the listed apps | App Store apps do NOT have an "Uninstall" option; other installed apps do |
| 2 | Click **Uninstall** next to an installed app | A confirmation modal appears |
| 3 | Select **Uninstall** in the modal | Status changes from "Installed" to "Uninstalling..."; both Install and Uninstall buttons are disabled while pending |
| 4 | Wait for completion | The software is removed from the host |
| 5 | Open the global activity feed | An "An end user ... uninstalled ..." activity appears with details |
| 6 | Repeat with an uninstall script that fails | A failed-uninstall status shows; the Failed (uninstall) modal opens with more information; the button text reads "Retry uninstall"; the global feed shows "An end user failed to uninstall ..." with details |

## Custom VPP token apps

### SWDEP-067 — Custom App Store (VPP) apps: add, edit, delete, and install

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | iOS/iPadOS
- **Preconditions:** A Fleet instance connected to a custom App Store VPP token (e.g. `customer-hawking`'s test token); enrolled macOS, iOS, and iPadOS hosts.
- **Source:** #32461

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In the UI, add the custom App, then edit it, then delete it | Each operation succeeds for the custom App via the UI |
| 2 | Install the custom App on a macOS host, an iOS host, and an iPadOS host via Fleet | The custom App installs on all three platforms |
| 3 | Add, edit, and delete the custom App via Fleet's API | Each operation succeeds via the API |
| 4 | Add, edit, and delete the custom App via GitOps | Each operation succeeds via GitOps |

## In-house .ipa apps

### SWDEP-068 — Install an in-house (.ipa) app on an iOS/iPadOS host without CloudFront signing configured

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** iOS/iPadOS
- **Preconditions:** S3 software installer storage is configured but the CloudFront signing settings (`s3_software_installers_cloudfront_url`, `s3_software_installers_cloudfront_url_signing_public_key_id`, `s3_software_installers_cloudfront_url_signing_private_key`) are NOT set. An enrolled iOS/iPadOS host is available, and an in-house `.ipa` app has been added to a team the host belongs to.
- **Source:** #33756

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Confirm in Fleet server config that the three CloudFront signing settings are unset/empty | Server starts and software delivery uses the unsigned S3 path |
| 2 | Navigate to the iOS/iPadOS host's details page and locate the in-house `.ipa` app under software | The app is listed with an Install action available |
| 3 | Trigger Install for the `.ipa` app | Install command is queued; status shows Pending |
| 4 | Wait for the host to check in and process the command | App download succeeds and install status updates to Installed (app appears on the device) |

### SWDEP-069 — Install an in-house (.ipa) app on an iOS/iPadOS host with CloudFront signing configured

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** iOS/iPadOS
- **Preconditions:** S3 software installer storage is configured AND all three CloudFront signing settings (`s3_software_installers_cloudfront_url`, `s3_software_installers_cloudfront_url_signing_public_key_id`, `s3_software_installers_cloudfront_url_signing_private_key`) are set with valid CloudFront distribution + key-pair values. An enrolled iOS/iPadOS host is available, and an in-house `.ipa` app has been added to a team the host belongs to.
- **Source:** #33756

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Confirm the three CloudFront signing settings are populated and the Fleet server has restarted with them applied | Server starts without errors related to the CloudFront/key configuration |
| 2 | Navigate to the iOS/iPadOS host's details page and locate the in-house `.ipa` app under software | The app is listed with an Install action available |
| 3 | Trigger Install for the `.ipa` app | Install command is queued; status shows Pending |
| 4 | Wait for the host to check in and process the command | Device fetches the `.ipa` via a signed CloudFront URL, download succeeds, and install status updates to Installed (app appears on the device) |

### SWDEP-070 — Signed CloudFront .ipa URL is device-scoped and rejects reuse from another device

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** iOS/iPadOS
- **Preconditions:** CloudFront signing is fully configured (all three settings set). An in-house `.ipa` install has been initiated for one enrolled iOS/iPadOS host so a signed download URL is generated. A means to capture the signed URL (e.g., MDM logs / network capture) and a second, different device are available.
- **Source:** #33756

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Initiate the in-house `.ipa` install on the target device and capture the signed CloudFront URL sent to it | A signed URL containing CloudFront signature/key-pair-id query parameters is issued |
| 2 | On the target device, allow the download to proceed using the signed URL | Device downloads the `.ipa` successfully and the app installs |
| 3 | Take the captured signed URL and attempt to download the `.ipa` from a different device/client | Request is denied by CloudFront (e.g., 403/access denied); the `.ipa` is not served to the other device |

## Android apps

### SWDEP-071 — Add an Android app and install it via self-service

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** Android
- **Preconditions:** Android (work profile / BYOD) host enrolled in Fleet; Google Workspace / managed Google Play connected to a team.
- **Source:** #30836

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the team, add an Android app from the managed Google Play Store (e.g. Zoom) to Fleet. | App is added to the team's software and marked available for self-service. |
| 2 | On the enrolled Android host, open the managed Google Play Store in the work profile. | The added app appears as available to install. |
| 3 | Install the app from the managed Google Play Store. | App installs successfully and appears in the host's software inventory. |

### SWDEP-072 — Transferring an Android host between teams does not carry over apps or configuration

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** Team A has an Android app with configuration installed on a host; Team B has a different Android app; both teams configured for Android.
- **Source:** #30836, #33761

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On Team A, install an Android app (with configuration) on the enrolled host. | App and its configuration are applied to the host. |
| 2 | Transfer the host from Team A to Team B (which has a different Android app). | Host moves to Team B. |
| 3 | Inspect the host's software. | Team B's app is not installed, and Team A's app configuration is not applied. |

### SWDEP-073 — Deleting an Android app removes it from managed Google Play and uninstalls it from hosts

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** Android
- **Preconditions:** Android app (e.g. GitHub) added to a team and configured as setup experience; Android host enrolled to that team with the app installed.
- **Source:** #36859

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Confirm the app is auto-installed on the enrolled host and available in the managed Google Play Store. | App is installed on the host and visible in the managed Google Play Store. |
| 2 | Delete the app from Fleet. | App is removed from the team's software. |
| 3 | Check the managed Google Play Store on the host. | The app is no longer available in the managed Google Play Store. |
| 4 | Inspect the host's software. | The app is uninstalled from the host. |

### SWDEP-074 — Re-enrolling after deletion does not reinstall the removed Android app

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** Android app previously deleted from a team (per the deletion case); Android host available to re-enroll to the same team.
- **Source:** #36859

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Unenroll the host from Fleet. | Host is unenrolled. |
| 2 | Re-enroll the host to the same team. | The deleted app is not automatically installed after enrollment. |
| 3 | Check the managed Google Play Store on the host. | The deleted app is not available in the managed Google Play Store after re-enrollment. |

### SWDEP-075 — Deploy an Android web app (web clip) immediately after creation

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** Team with managed Google Play connected; API access; BYOD and fully-managed Android hosts enrolled to the team. Design: Figma available.
- **Source:** #38310

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Create an Android web app (web clip) and add it to Fleet using the new web-app API endpoint immediately after creation. | The web app can be added to Fleet right after it is created (no propagation delay error). |
| 2 | Add the web app as setup experience software and enroll a host. | The web app installs automatically during enrollment. |
| 3 | Confirm installation on both a BYOD host and a fully-managed Android host (via self-service or setup experience). | The web app deploys successfully on both BYOD and fully-managed Android hosts. |
| 4 | Inspect each host's software inventory. | The web app shows up in the host's inventory after it is installed. |

## Android app configuration

### SWDEP-076 — Set Android app managedConfiguration via API and verify settings apply on install

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** Android app (e.g. Zoom) added to a team; Android host enrolled to that team; API access.
- **Source:** #30836

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Using Fleet's API, add a valid `"managedConfiguration"` block to the app's configuration JSON. | API accepts the configuration. |
| 2 | Open the global activity feed. | An `edited_app_store_app` activity is shown for the app. |
| 3 | Install the app via self-service in the managed Google Play Store (work profile). | App installs successfully. |
| 4 | On the host, inspect the app's settings. | The settings defined in `managedConfiguration` are applied (e.g. Zoom / GlobalProtect `portal` value is set as configured). |

### SWDEP-077 — Set Android workProfileWidgets via API and verify the widget appears

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Android
- **Preconditions:** App supporting work-profile widgets (e.g. Google Calendar) added to a team; Android host enrolled to that team; API access.
- **Source:** #30836

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Using Fleet's API, add a valid `"workProfileWidgets"` value for the app. | API accepts the configuration. |
| 2 | Install the app via self-service and add its widget in the work profile. | The app's work-profile widget (e.g. Google Calendar) is available and shows up in the work profile. |

### SWDEP-078 — Editing an installed Android app's configuration updates settings without reinstalling

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** Android app already installed via self-service on an enrolled host; API access.
- **Source:** #30836

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Edit the app's configuration via Fleet's API on a host where the app is already installed. | Configuration update is accepted. |
| 2 | View the Software title page and the Host details page. | Install status shows "Pending" while the configuration is being applied. |
| 3 | Wait for the configuration to apply, then inspect the app on the host. | The app's settings are updated and the app is not reinstalled (status returns to Installed). |

### SWDEP-079 — Failed Android configuration update shows Failed status

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Android
- **Preconditions:** Android app installed on an enrolled host; ability to push a policy/configuration that will be rejected.
- **Source:** #30836

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Apply a configuration update that causes the Android policy configuration to fail (e.g. an invalid policy value). | Configuration update is sent. |
| 2 | View the Software title page and the Host details page. | Install status shows "Failed" on both pages. |

## iOS/iPadOS self-service

### SWDEP-080 — iOS/iPadOS self-service works with Web Clip URL/UDID auth

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** iOS/iPadOS
- **Preconditions:** iOS or iPadOS host enrolled; self-service available on the team (per #32247). Note: this validates iOS self-service auth, adjacent to the Android self-service work.
- **Source:** #32247, #36542

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Set up the appropriate Web Clip profile and deploy it to an iOS or iPadOS host. | The Web Clip profile is delivered and the self-service web clip is available on the device. |
| 2 | Use the self-service web clip and exercise the self-service functionality from #32247 with no infrastructure modifications. | All self-service functionality works end to end via the Web Clip URL/UDID authentication, with no infrastructure changes required. |

## Self-service install UX

### SWDEP-081 — Install a self-service app shows progress and reaches Installed

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** A host enrolled with Fleet Desktop, on a team that has at least one self-service app whose target includes this host. End user is viewing Fleet Desktop > Self-service.
- **Source:** #26691, #30238

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to Fleet Desktop > Self-service | The self-service app list is displayed; each app shows an "Install" button as its main action |
| 2 | Click "Install" on an app | A spinner appears with the word "Installing"; the main action and the "More" dropdown are disabled while the install is in progress |
| 3 | Navigate off the Self-service tab/page and back to it while the install is still running | The spinner and "Installing" state persist; progress is not lost |
| 4 | Wait for the install to complete | Status changes to "Installed" and a "Reinstall" main action button is shown |

### SWDEP-082 — Self-service install initiated from Host details reflects on the Self-service page

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** A host enrolled with Fleet Desktop, on a team that has a self-service app targeting this host. Admin has access to the host's Host details page.
- **Source:** #26691

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the host's Host details > Software, trigger an install of the self-service app | Install is queued for the host |
| 2 | Quickly open Fleet Desktop > Self-service on that host | The same app shows the "Installing" spinner state, reflecting the in-progress install started from Host details |

### SWDEP-083 — Update action appears and runs when a newer version is detected

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** A self-service app already installed on an enrolled host, for which Fleet has detected a newer available version. End user is on Fleet Desktop > Self-service.
- **Source:** #27983, #30238

| # | Step | Expected result |
|---|------|-----------------|
| 1 | View the installed app on the Self-service page that has an available update | The main action button reads "Update" (instead of "Reinstall") |
| 2 | Click "Update" | The update begins; the main action and "More" dropdown are disabled while in progress |
| 3 | Wait for the update to complete | App returns to an installed state with the updated version; the main action button is "Reinstall" again (no further update offered) |

### SWDEP-084 — Self-service action layout: main action button with Uninstall and How to open under More

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Self-service apps available on an enrolled host, including at least one installed app. End user is on Fleet Desktop > Self-service.
- **Source:** #30238

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Inspect an app's controls on the Self-service page | The main action ("Install", "Update", or "Reinstall") is a button; "Uninstall" and "How to open" are grouped under a "More" dropdown |
| 2 | Start an install or uninstall on an app | The main action button and the "More" dropdown are both disabled while the operation is in progress |
| 3 | After the operation completes, open the "More" dropdown | The dropdown is re-enabled and lists "Uninstall" and (where applicable) "How to open" |

### SWDEP-085 — How to open modal appears only for installed apps/programs software

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | Windows
- **Preconditions:** On an enrolled host, at least one app installed (by Fleet or by the end user) from an `apps`/`programs` source, plus at least one not-installed self-service app. End user is on Fleet Desktop > Self-service.
- **Source:** #30238

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the "More" dropdown for a software item that is installed on the host with source `apps` (macOS) or `programs` (Windows) | A "How to open" action is present |
| 2 | Click "How to open" | A modal opens with the open-instructions description specified for that source type in the design |
| 3 | Check the "More" dropdown for an app that is not installed on the host | No "How to open" action is shown for not-installed software |

## Self-service enable/edit (admin)

### SWDEP-086 — Enable self-service for an installer via Actions > Self-service modal

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** All
- **Preconditions:** A software title with an installer package uploaded and self-service NOT enabled. Admin is on /software/titles/:id. Note: self-service management was moved out of the Edit software modal into its own Actions > Self-service modal; the Edit modal no longer exposes self-service options.
- **Source:** #25499, #28058, #28061

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Click Actions > Self-service | The Self-service modal appears with the toggle set to "Disabled" |
| 2 | Toggle the switch to the enabled position | Target and categories options appear; selecting "Custom" target reveals a scrollable labels list and the modal height adjusts to fit |
| 3 | Set Target to "All hosts" and click Save | A success flash message appears and the user is returned to /software/titles/:id; the Self-service pill is shown for the title |
| 4 | On a compatible host on the team, open Fleet Desktop > Self-service | The app is available to install in Self-service on all compatible hosts on the team |

### SWDEP-087 — Edit self-service targets and disable via the Self-service modal

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A software title with an installer package and self-service already enabled. Admin is on /software/titles/:id.
- **Source:** #28061

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Click Actions > Self-service | The Self-service modal appears with the toggle set to "Enabled" |
| 2 | Change the target or categories and click Save | A success flash message appears, the user returns to /software/titles/:id, and reopening the modal confirms the new settings are saved |
| 3 | Click Actions > Self-service again, set the toggle to "Disabled" | All sections below the toggle (target, categories, labels) disappear from the modal |
| 4 | Click Save | A success flash message appears, the user returns to /software/titles/:id, and self-service is disabled (Self-service pill no longer shown) |
| 5 | Click the pencil icon to open the Edit software modal | No self-service options appear in the Edit software modal |

### SWDEP-088 — Self-service custom label targeting controls host availability

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A self-service-enabled installer on a team with multiple compatible hosts, some carrying specific labels. Admin is on the title's Self-service modal.
- **Source:** #28058, #28061

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Set Target to "Custom", choose "Include any", select one or more labels, and Save | Only compatible team hosts that have the selected labels show the app in Self-service |
| 2 | Reopen the modal, set Target to "Custom", choose "Exclude any", select one or more labels, and Save | Only compatible team hosts that do NOT have the selected labels show the app in Self-service |

## Script-only packages

### SWDEP-089 — Add a script-only custom package (.sh / .ps1) via the UI

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Linux | Windows
- **Preconditions:** Admin on a team's software page with permission to add software. A `.sh` script file and a `.ps1` script file are available to upload.
- **Source:** #31719

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the Add custom package flow before selecting a file | Advanced options are hidden until a package file is selected |
| 2 | Select the `.sh` file, then separately the `.ps1` file | The package is accepted; advanced options remain hidden because script-only packages do not support them, while they appear for applicable (installer) package types |
| 3 | Add the `.sh` package and add the `.ps1` package | Both script packages are created successfully |
| 4 | Open the team's /software/titles list and apply the "Available for install" filter, then the "Self-service" filter | The script packages appear in the titles list and are returned by the relevant filters |

### SWDEP-090 — Edit a script-only package and change its file type

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Linux | Windows
- **Preconditions:** An existing `.sh` script-only package on a team. Admin is on the title's edit flow. A `.ps1` file (different script type) is available.
- **Source:** #31719

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Edit the `.sh` script package and enable Self-service, then Save | The package is saved as self-service |
| 2 | Edit the script package and swap the uploaded file to a different script type that is not `.sh`/`.ps1` | Advanced options appear for the non-script file type |
| 3 | Inspect the install script field after the type change | The `install_script` field is populated with the default script for the new file type, not the original script contents |

### SWDEP-091 — Add a script-only package via the API with unsupported-parameter and Free handling

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Linux | Windows
- **Preconditions:** API access to a Fleet instance. Both a Premium-licensed instance and a Fleet Free instance available for testing.
- **Source:** #31719

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add a `.sh`/`.ps1` script package via the API including parameters documented as unsupported for scripts | The package is created; the unsupported parameters are ignored and not saved |
| 2 | Attempt to add a script package via the API on a Fleet Free instance | The request is rejected with an error (script packages are a Premium feature) |
| 3 | Add a script package via YAML/GitOps including unsupported parameters | The package is applied; unsupported parameters are ignored and not saved |

### SWDEP-092 — Run and self-serve a script-only package on Windows and Linux

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Windows | Linux
- **Preconditions:** A Windows host and a Linux host enrolled, each on a team with a corresponding `.ps1`/`.sh` script-only package; one such package set to self-service. Fleet Desktop available on the hosts.
- **Source:** #31719

| # | Step | Expected result |
|---|------|-----------------|
| 1 | From the Linux host's Host details page, run the `.sh` script package | The script package runs on the Linux host |
| 2 | From the Windows host's Host details page, run the `.ps1` script package | The script package runs on the Windows host |
| 3 | From Fleet Desktop > My device > Self-service on the Linux host, install the self-service script package | The script package runs / installs via self-service on Linux |
| 4 | From Fleet Desktop > My device > Self-service on the Windows host, install the self-service script package | The script package runs / installs via self-service on Windows |

### SWDEP-093 — Script-only packages run with script execution disabled and are available to policy automations

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Windows | Linux
- **Preconditions:** A team with `.sh`/`.ps1` script-only packages and the "Disable script execution features" setting enabled. Windows and Linux hosts enrolled.
- **Source:** #31719

| # | Step | Expected result |
|---|------|-----------------|
| 1 | With "Disable script execution features" enabled, run a script package against a host | The script package still runs (it is not blocked by the script-execution disable setting) |
| 2 | Configure a policy automation and open the install-software selection for a Windows/Linux policy | The script packages are selectable as install-software targets for Windows/Linux |

## Add from software details (non-FMA)

### SWDEP-094 — Add software from a software title detail page (non-FMA title)

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Fleet Premium. A specific team selected. An enrolled host reporting a software title that is NOT available as an FMA, has no installer package, and is not "Available to install".
- **Source:** #25499, #28051

| # | Step | Expected result |
|---|------|-----------------|
| 1 | From the host's Software tab, click the non-FMA software title | Software title detail page opens with host count and per-version host counts; an "Add software" button is shown |
| 2 | Click "Add software" | You are taken to the /software/add page for the host's team |
| 3 | Complete the VPP or custom-package add flow (uploading a package, which may be for a different title than the one you started from) | On success you land on the software detail page for the title that was actually uploaded, with a flash message confirming it is now available |
| 4 | Review the resulting software detail page | Installer info appears below the details/host-info section; status table shows " - - " then Installed/Pending/Failed once scoping applies; any auto-install or Self-service options chosen appear as pills |

## Add-software gating (Free / All teams)

### SWDEP-095 — "Add software" button is disabled for Fleet Free and when "All teams" is selected

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A software title detail page (/software/titles/:id) with no associated installer package.
- **Source:** #28051

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On Fleet Free, open a software title page that has no associated installer package | The "Add software" button is greyed out; hovering shows a "Fleet Premium only" tooltip |
| 2 | On Fleet Premium, open the software title page and select "All teams" in the top dropdown | The "Add software" button is disabled; hovering shows the tooltip "Select a team to add software" |
