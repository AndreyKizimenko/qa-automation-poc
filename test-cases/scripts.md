# Scripts — test cases

> Feature area. Effective regression set curated from Fleet feature-story test
> plans (audited: deduped across former product groups; cosmetic/low-value checks
> pruned). Each case keeps its origin story #s in **Source**. See
> [`README.md`](README.md) for conventions; GitOps flows live in [`gitops.md`](gitops.md).

## Disabling scripts

### SCRIPT-001 — Disabling scripts via scripts_disabled blocks all script execution paths

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Premium license active; admin user signed in; an online host with scripts enabled; a saved script available; `fleetctl` and API access configured.
- **Source:** #14500

| # | Step | Expected result |
|---|------|-----------------|
| 1 | With scripts enabled, run a script on the host from Host details > Scripts. | Script executes and the results/output are visible in the Fleet UI. |
| 2 | Enable the `scripts_disabled` flag (agent options) via the UI. | Setting saves successfully. |
| 3 | Reload the host's Scripts area. | A disabled banner is shown and the run-script dropdown is greyed out, per Figma. |
| 4 | Attempt to view results or run a script from the UI. | Running the script no longer shows results in the Fleet UI. |
| 5 | Attempt to run a script from the CLI (`fleetctl run-script`). | The CLI returns the disabled error matching the Figma error copy. |
| 6 | Call the API endpoints `POST /scripts/run` and `POST /scripts/run/sync`. | Both return HTTP 403 with the error message matching the Figma (same copy as the CLI error). |

### SCRIPT-002 — Host details surfaces whether scripts are enabled or disabled per platform

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Premium license active; admin user signed in; online hosts on Linux, macOS, and Windows enrolled with varying orbit versions (a previous orbit with scripts enabled, a new orbit with scripts disabled, and a new orbit with scripts enabled).
- **Source:** #17148

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Host details for a host running new orbit with scripts enabled. | The page indicates scripts are enabled and the run-script action is available. |
| 2 | Open Host details for a host running new orbit with scripts disabled. | The page indicates scripts are disabled. |
| 3 | Open Host details for a host running a previous orbit version (scripts enabled). | The enabled/disabled state is reflected correctly for the older agent. |
| 4 | Repeat the above across Linux, macOS, and Windows hosts. | The scripts enabled/disabled indicator is correct on all three platforms. |
| 5 | Run a script via the API against an enabled host on each platform. | Script runs successfully on Linux, macOS, and Windows. |
| 6 | Run the lock/unlock `fleetctl` command on Linux and Windows, and the wipe command on Linux. | Commands succeed on the indicated platforms. |

### SCRIPT-003 — Run script disabled with tooltip when scripts_disabled is true

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Server configured with `scripts_disabled: true`. An enrolled host. Logged in as a user able to view host details.
- **Source:** #33903

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open a host's details page and open the Actions menu. | The "Run script" action is disabled. |
| 2 | Hover over the disabled "Run script" action. | The updated tooltip explaining the disabled scripts feature is shown (matching Figma copy). |
| 3 | Go to Settings > Organization settings > Advanced options and review the scripts copy. | The copy matches the updated Figma wording for the disabled scripts feature. |

## Execution timeout

### SCRIPT-004 — Extend script execution timeout beyond five minutes via agent options

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Premium license active; admin user; an online host with scripts enabled; `fleetctl` build that polls `/scripts/results/` for completion; a long-running script (e.g. a loop of `sleep 1`) that exceeds five minutes.
- **Preconditions:** —
- **Source:** #16645, #20650

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Set `script_execution_timeout` in global agent options to a value above 300s (avoid 0 or 1). | Setting saves; global value applies to no-team hosts. |
| 2 | Set `script_execution_timeout` in a team's agent options to a different value above 300s. | Team-level value saves and applies to that team's hosts. |
| 3 | Run a long-running looping script (e.g. repeated `sleep 1`) that runs longer than 5 minutes but under the configured timeout. | Script completes without hitting the old 5-minute limit; result is returned. |
| 4 | Run a looping script that exceeds the configured timeout. | Script is terminated at the configured timeout and the timeout error code matches the Figma. |
| 5 | Run a 5+ minute script via `fleetctl run-script`. | The command does not time out (it polls `/scripts/results/` rather than waiting on a single request) and returns the final result. |

### SCRIPT-005 — Enforce the 5-minute script execution timeout

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

## Licensing & permissions

### SCRIPT-006 — Only admins and maintainers can run scripts; observers are denied

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Premium license active; a saved script and an online host available; users provisioned for global observer, global observer+, team observer, and team observer+, plus a global/team admin and maintainer; `fleetctl` and API access configured.
- **Source:** #19055

| # | Step | Expected result |
|---|------|-----------------|
| 1 | As a global observer, attempt to run a saved or ad-hoc script via the API. | Request is rejected with HTTP 403 (unauthorized). |
| 2 | Repeat the API run attempt as global observer+, team observer, and team observer+. | Each returns HTTP 403 (unauthorized). |
| 3 | Repeat the run attempts for all four observer roles via `fleetctl`. | Each is rejected as unauthorized. |
| 4 | Run a script as a global or team admin via API and `fleetctl`. | Script runs successfully. |
| 5 | Run a script as a global or team maintainer via API and `fleetctl`. | Script runs successfully. |

### SCRIPT-007 — Restrict scripts library access to Premium licenses

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A Fleet instance is available; have both a free instance and a paid (Premium) instance to compare.
- **Source:** #9537

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Log in to a free Fleet instance and navigate to Controls. | The Scripts tab/upload capability is gated behind a paid license; the upgrade/paywall copy matches the designs. |
| 2 | Log in to a Premium (paid license) Fleet instance and navigate to Controls. | The Scripts feature is fully accessible. |

### SCRIPT-008 — Restrict scripts library editing to Admins and Maintainers

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

## Scripts library management

### SCRIPT-009 — Upload, download, and delete scripts in the scripts library

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Premium instance with MDM turned on; logged in as Admin or Maintainer (global or team).
- **Source:** #9537, #14068, #15283

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to Controls > Scripts. | The Scripts tab is present with a Teams dropdown; each team (and "No team") shows its own assigned scripts. |
| 2 | With MDM turned off for the selected team, view the Scripts tab. | A prompt to turn on MDM appears with copy matching the designs. |
| 3 | With MDM turned on, click Upload and select a `.sh`, `.ps1`, or `.py` file. | The upload succeeds and a success message matching the designs is shown. |
| 4 | Attempt to select a file with any other extension. | The file cannot be selected/uploaded; a failure message matching the designs is shown. |
| 5 | Confirm the uploaded script appears in the library list. | The script is listed with an icon distinguishing shell (.sh), PowerShell (.ps1), and Python (.py) types. |
| 6 | Click the Download action on a script. | The original script file downloads. |
| 7 | Click the Delete action on a script and confirm in the modal. | A confirmation modal opens; completing it removes the script from the library. |

### SCRIPT-010 — Reject invalid scripts on upload

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

### SCRIPT-011 — Edit an existing script's contents in the Fleet UI

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

### SCRIPT-012 — Add a script through the updated upload modal and empty state

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

## Run script on a host

### SCRIPT-013 — Run a saved script on a host via the Actions menu

- **Tier:** Both
- **Priority:** P0
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** A host enrolled with scripts enabled; one or more scripts saved to the host's team (or "No team").
- **Source:** #9537, #15529

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Host details for the host and open the Actions menu. | A "Run script" item is shown in the Actions menu (no separate Scripts tab). |
| 2 | Click "Run script". | A modal opens listing all scripts assigned to the host's team, each with a status column. |
| 3 | Review the status column for a script that has never run. | The status displays `---`. |
| 4 | Select a script and choose Run. | A loading state displays, the modal closes, and a success or failure message matching the designs is shown. |
| 5 | After execution, open the script's details. | The Script details modal displays the script contents and its output. |
| 6 | Reopen the Run script modal and review statuses. | The script shows a status of Ran, Pending, or Error; the status tooltip copy matches the designs. |

### SCRIPT-014 — Run a script on an offline host (queued as upcoming activity)

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

### SCRIPT-015 — Show scripts activity in the host details Past and Upcoming feeds

- **Tier:** Both
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** A host enrolled with scripts enabled; ability to add/edit/delete and run scripts.
- **Source:** #9537, #15529

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Host details and view the Activity feed. | The feed defaults to the Past tab and displays 8 items per page; the Past tab shows a loading state. |
| 2 | Switch to the Upcoming tab when nothing is queued. | No count badge is shown and the tab has no loading state. |
| 3 | Add, edit (via fleetctl), delete, and run a script. | Corresponding "script added", "script edited", "script deleted", and "script ran" entries appear in the global and host activity feeds. |
| 4 | Open a "script ran" activity entry. | The entry exposes the script details and output. |
| 5 | Resize the page to different widths. | The Activity feed remains responsive and matches the designs at each width. |

### SCRIPT-016 — Run scripts and upload script library on Fleet Free

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

## Interpreters & shebang

### SCRIPT-017 — Run a Python script via policy automation and batch execution

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

### SCRIPT-018 — Block Python scripts in setup experience and payload-free packages

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

### SCRIPT-019 — Run a bash script via shebang on macOS and Linux hosts

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

## Moved in (review placement)

### SCRIPT-020 — Turn off Windows MDM and remove fleetd via library scripts

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

## Batch script execution

### SCRIPT-021 — Run a script as a batch action from the Manage hosts page

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

### SCRIPT-022 — Batch-run scripts across all matching hosts with the 5,000-host limit and filters

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

### SCRIPT-023 — Schedule a batch script to run at a specific future time

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

### SCRIPT-024 — Reject incomplete or invalid batch-script-execution host filters in the API

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

## Secret variables

### SCRIPT-025 — Add, use, and delete secret variables for scripts and profiles in the UI

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
