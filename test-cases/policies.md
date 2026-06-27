# Policies — test cases

> Feature area. Effective regression set curated from Fleet feature-story test
> plans (audited: deduped across former product groups; cosmetic/low-value checks
> pruned). Each case keeps its origin story #s in **Source**. See
> [`README.md`](README.md) for conventions; GitOps flows live in [`gitops.md`](gitops.md).

## Policy display & sorting

### POLICY-001 — Failing policies sort to the top on My device and Host details pages

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A host enrolled in Fleet with several policies assigned: at least one failing, at least one that has not run yet, and at least one passing. Policy names span the alphabet so name-ordering is observable.
- **Source:** #10379

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the Host details page for the host and view the Policies section. | Policies are grouped in the order failing, then not-run, then passing. |
| 2 | Inspect the order of policies within each group. | Within each group, policies are sorted alphabetically by name. |
| 3 | Open the My device page on that host (Fleet Desktop) and view the policies list. | Policies appear in the same order: failing first, then not-run, then passing, alphabetical by name within each group. |

### POLICY-002 — Policy host-count tooltips show Updated at timestamps

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Global and team policies exist, including a mix of newly-created policies (not yet run) and older policies that have already run. `FLEET_OSQUERY_POLICY_UPDATE_INTERVAL` configurable for the instance.
- **Source:** #15323

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the Policies page and hover the yes/no host count for a policy that has already run. | The new tooltip displays the correct Updated at timestamp for the host counts. |
| 2 | Hover the host count for a policy that has not run yet. | The old tooltip is shown and reflects the next time host counts update (hourly), plus additional time when the osquery policy update interval requires it. |
| 3 | Set `FLEET_OSQUERY_POLICY_UPDATE_INTERVAL` to a small value (e.g. 10 minutes) and recheck the not-run policy tooltip. | The tooltip's projected update time reflects the small interval. |
| 4 | Set `FLEET_OSQUERY_POLICY_UPDATE_INTERVAL` to a large value (e.g. 2+ hours) and recheck the not-run policy tooltip. | The tooltip's projected update time reflects the large interval. |

## Add policy flow

### POLICY-003 — Filter suggested policies in the Add policy modal

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Signed in as a user with permission to add policies. At least one team exists if testing premium.
- **Source:** #12292

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to the Policies page. | The Policies page loads. |
| 2 | Click Add policy. | The Add policy modal opens showing a list of suggested policies. |
| 3 | Use the platform/filter dropdown in the modal and change its selection. | The list of suggested policies updates to reflect the selected filter. |

### POLICY-004 — Saving a default policy does not append the team name

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Signed in as a user able to add policies. The Policies page is reachable with a team selected in the teams dropdown.
- **Source:** #16603

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to the Policies tab and note the selected team in the teams dropdown. | The Policies page loads with the selected team shown. |
| 2 | Click Add a policy and select a default policy from the list. | The default policy opens for editing with its prefilled name. |
| 3 | Click Save. | The policy is saved without the team or all-teams name appended to the policy name. |

### POLICY-005 — Add a policy navigates to the New policy page

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

## Policy API

### POLICY-006 — Populate policy data in the GET /hosts API

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet instance with hosts assigned to teams, plus global and team policies applied. API access configured.
- **Source:** #16242

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Call `GET /hosts` without the populate parameter. | The response does not include policy data. |
| 2 | Call `GET /hosts?populate_policies=true`. | The response includes policies for each host, including both global and team policies for team hosts. |
| 3 | Call `GET /hosts?populate_policies=invalid`. | The endpoint returns an error for the invalid value. |

## Calendar maintenance windows

### POLICY-007 — Calendar integration creates a maintenance window event for a host failing a calendar policy

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** All
- **Preconditions:** A Google Calendar integration is configured in Fleet. A team exists with calendar integration enabled and at least one policy flagged for calendar events. At least one host is enrolled on that team and is currently failing the calendar policy. The host's end user has a mapped calendar.
- **Source:** #17230

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Confirm the host is reporting a failing result for the calendar-enabled policy. | Host details show the policy as failing. |
| 2 | Trigger the calendar cron job (or wait for it to run). | Fleet processes the failing host and provisions a maintenance window. |
| 3 | Open the end user's Google Calendar for the host. | A maintenance window calendar event has been created in an available slot. |
| 4 | Have the agent switch the host from failing to passing the policy, then trigger the calendar cron again. | The maintenance window event is no longer scheduled / is cleaned up because remediation is complete. |

## Policy automations modal

### POLICY-008 — Paginate and scope the policy automations modal per team selection

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

### POLICY-009 — Disable "Manage automations" when a team has no policies

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Policies page with "All teams" and "No team" each having exactly one policy that can be removed
- **Source:** #23243

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Remove the only policy from "All teams" and review the "Manage automations" control | "Manage automations" is disabled with a tooltip |
| 2 | Remove the only policy from "No team" and review the control | "Manage automations" is disabled with a tooltip |

### POLICY-010 — Configure webhook and ticket policy automations for "No team"

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

### POLICY-011 — Automatically retry failed policy-automation scripts and software installs

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Fleet Premium. A team policy configured with a policy automation that runs a script and/or installs software when a host fails the policy. An enrolled host that fails the policy, where the triggered script/install fails on its first attempt (e.g., transient/non-zero exit).
- **Source:** #31916

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Let the policy run on the failing host so the automation triggers the script run or software install, and have that first attempt fail. | The triggered script/install is recorded as failed for the host. |
| 2 | Wait for Fleet to retry the failed automation without any manual intervention. | Fleet automatically re-runs the script / re-attempts the software install on the same host. |
| 3 | Allow the retry to succeed. | The script/install eventually completes successfully and the host's automation result reflects success; no manual re-run by the admin was required. |
| 4 | Inspect the activity feed for the host. | Activities reflect the automated retry attempts (failed attempt followed by the retried run). |

## Policy label-target scope

### POLICY-012 — Target policies and reports with "Labels include all" custom scope

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

### POLICY-013 — Hide policy label-target scope on Fleet Free

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

## Policy edit & permissions

### POLICY-014 — Edit/details policy pages keep the SQL editor de-emphasized and role-gated

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

## Live policy run

### POLICY-015 — Live policy run shows responded/not-responded/error host breakdown

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

## CIS benchmark policies

### POLICY-016 — Windows 11 CIS benchmark policies pass and fail correctly after update to v5.0.1

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** Fleet Premium instance with a Windows 11 workstation enrolled. The CIS benchmark policy library has been updated to Windows 11 CIS Benchmark v5.0.1. The PR that updated the Windows 11 CIS policies is available for reference (list of changed policies).
- **Source:** #27396, #35118, #39096

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the PR that updated the Windows 11 CIS policies and identify every policy that changed in the v5.0.1 update. | A complete list of added/modified Windows 11 CIS benchmark policies is available. |
| 2 | Apply each changed policy to the enrolled Windows 11 workstation in a state expected to PASS the benchmark, then run/refetch the policy. | Each policy reports a passing result for the compliant host state. |
| 3 | Reconfigure the Windows 11 workstation into a state expected to FAIL each changed benchmark, then re-run/refetch the policy. | Each policy reports a failing result for the non-compliant host state. |
| 4 | Record every changed and tested benchmark with its pass/fail outcome in a tracking sheet (e.g., Google Sheet) and link it on the story. | All changed v5.0.1 Windows 11 benchmarks are documented with verified pass and fail results. |

### POLICY-017 — macOS CIS benchmark policies pass and fail correctly after benchmark update

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Fleet Premium instance with macOS workstation(s) enrolled across the supported benchmark versions (macOS 14, 15, and 26). The CIS benchmark policy library has been updated for the latest macOS benchmarks. The PR that updated the macOS CIS policies is available for reference (list of changed policies).
- **Source:** #31106, #35120, #45644

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the PR that updated the macOS CIS policies and identify every policy that changed across macOS 14, 15, and 26. | A complete list of added/modified macOS CIS benchmark policies is available. |
| 2 | Apply each changed policy to the matching enrolled macOS workstation in a state expected to PASS the benchmark, then run/refetch the policy. | Each policy reports a passing result for the compliant host state. |
| 3 | Reconfigure each macOS workstation into a state expected to FAIL each changed benchmark, then re-run/refetch the policy. | Each policy reports a failing result for the non-compliant host state. |
| 4 | Confirm that the newly added macOS 26 CIS benchmark policies are present in the library and that the deprecated macOS 13 benchmark policies are no longer offered. | macOS 26 benchmark policies are available; deprecated macOS 13 benchmark policies are removed. |
| 5 | Record every changed and tested benchmark with its pass/fail outcome in a tracking sheet (e.g., Google Sheet) and link it on the story. | All changed macOS benchmarks are documented with verified pass and fail results. |

## Fleet-maintained policy visibility

### POLICY-018 — Fleet-created install/patch policies are hidden across policy views

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** All
- **Preconditions:** An FMA, custom package, and App Store (VPP) app each added with "Automatic install" enabled, generating Fleet-created policies; an enrolled host with My device page access.
- **Source:** #25500, #28059

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the Policies page | The "[Install software] <name>" Fleet-created policies do not appear |
| 2 | Open the My device page on the enrolled host | The Fleet-created install/patch policies do not appear |
| 3 | Open Policies > Manage automations (Run script, Install software, Calendars, Other workflows) | The Fleet-created policies do not appear in any automation list |
| 4 | Repeat the checks for the custom package and VPP app | Their Fleet-created policies are hidden in the same way |

### POLICY-019 — Policy fleet_maintained flag controls visibility and API filtering

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A team with one policy that has an "Install software" automation for an installer; database access to set `fleet_maintained`.
- **Source:** #28059

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Create a policy with an "Install software" automation for a software title, then set `fleet_maintained = true` on it in the database | The policy disappears from the Policies list and other policy views |
| 2 | On the associated software title page, view the policy | It shows the Fleet icon/tooltip and clicking the row opens a read-only name/description/query modal |
| 3 | Create a second, normal policy with an "Install software" automation for the same installer | It still appears everywhere and navigates to the policy editor when clicked from software details |
| 4 | Navigate to policy details for the Fleet-maintained policy | It is non-editable with a note that it is Fleet-maintained, taking precedence over GitOps Mode |
| 5 | Call the team-filtered policies API endpoint | Both the Fleet-maintained and the normal policy are returned |
| 6 | Call the endpoint with `fleet_maintained=false` then `fleet_maintained=true` | The Fleet-maintained policy is hidden, then shown, respectively |
| 7 | Delete the installer | Deletion succeeds; the Fleet-maintained policy is deleted while the normal policy remains but loses its automation |
