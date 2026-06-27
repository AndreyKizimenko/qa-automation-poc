# Endpoint ops — test cases

> Area: `#g-endpoint-ops`. Derived from Fleet feature-story test plans
> (oldest→newest, superseded behavior collapsed). GitOps flows live in
> [`gitops.md`](gitops.md). See [`README.md`](README.md) for method/template.
> **Live-verified 2026-06-27 (structure):** confirmed Controls→Scripts, Settings→Integrations→Calendars (maintenance windows), Policies (+automations), and Reports. Host-level cases (fleetd version, scripts enabled/disabled, per-host query results, live-query execution) need enrolled hosts and were not walked.

## Vulnerabilities & Software Inventory

### EO-VULN-001 — Surface macOS and Windows operating system vulnerabilities

- **Tier:** Free
- **Priority:** P1
- **Platforms:** macOS | Windows
- **Preconditions:** Hosts enrolled running known-vulnerable OS versions (Windows 10+, Windows Server 2012+, macOS 13+); vulnerability processing cron has run.
- **Source:** #4345

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enroll a Windows 10+/Server 2012+ host and a macOS 13+ host that are on OS versions with published CVEs. | Hosts enroll and report their OS version. |
| 2 | Trigger the vulnerabilities cron and open Software > OS (or the OS version details). | Vulnerable OS versions are listed with associated CVEs for both macOS and Windows. |
| 3 | Open an affected host's details page and review the OS section. | The host's OS vulnerabilities are surfaced and match the OS-version CVEs. |
| 4 | Spot check software vulnerabilities on the same hosts for regressions. | Software CVEs continue to surface correctly with no regression. |

### EO-VULN-002 — Populate host software inventory via GET /hosts with populate_software

- **Tier:** Free
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Multiple hosts enrolled with software installed, including some software with known vulnerabilities; vulnerability processing has run.
- **Source:** #12889

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Confirm enrolled hosts report installed software and that some titles have CVEs. | Host software is ingested and vulnerabilities are associated. |
| 2 | Call `GET /hosts` without `populate_software`. | Response returns hosts with no `software` field populated. |
| 3 | Call `GET /hosts?populate_software=true`. | Each host comes back with the `software` field populated, including vulnerable software entries. |
| 4 | Run the populated request against a large fleet. | Request completes within acceptable load-test bounds without server errors. |

### EO-VULN-003 — View patch progress broken down by version on the vulnerability dashboard

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Multiple teams configured; hosts across teams running a mix of compliant and non-compliant software versions; vulnerability data populated.
- **Source:** #14678

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the patch progress page on the vulnerability dashboard and expand the line items. | Each software type expands to show per-version host counts. |
| 2 | Compare the displayed host counts per patch-progress item against the source data. | Host counts match the reference data for each version. |
| 3 | Click to create a CSV export of unpatched hosts for a patch-progress item. | CSV downloads listing only the unpatched (non-compliant) hosts for that item. |
| 4 | Switch the team filter to a different team. | Per-version host counts update for that team; compliant versions present on no team host show `---` as the host count. |
| 5 | Create CSV exports of unpatched hosts for the selected team for each patch-progress item. | Each export contains only non-compliant installs of that software type for hosts on the selected team. |

### EO-VULN-004 — Browse and triage vulnerabilities on the Software > Vulnerabilities page

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** All
- **Preconditions:** Hosts enrolled with vulnerable software; `cleanups_then_aggregation` and `vulnerabilities` crons triggered. Test with both a global user and a team user.
- **Preconditions:** Multiple teams configured.
- **Source:** #15919

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Software > Vulnerabilities as a global user. | The Vulnerabilities tab lists CVEs with metadata (severity, scores) and host counts. |
| 2 | Spot check a vulnerability's metadata and affected hosts. | Severity/scores are accurate and the CVE maps to the correct hosts. |
| 3 | Exercise sort, filter, and pagination controls. | Results reorder, filter, and paginate correctly. |
| 4 | Open a Vulnerability, Software, and OS details page, then switch the team context. | Host counts update to the selected team; an item missing globally returns an error, and an item missing within a team shows host counts of 0. |
| 5 | Repeat the page and details checks as a team user. | Team user sees vulnerabilities scoped per existing software/host permissions. |

### EO-VULN-005 — Detect CVEs from the VulnCheck CPE feed during vulnerability scans

- **Tier:** Free
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Vulnerability scanning configured with the VulnCheck feed enabled; a host available to install test software.
- **Source:** #17538

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Install software whose CVE exists only in the VulnCheck feed on a host, then run a vulnerability scan. | The VulnCheck-only CVE is detected and surfaced for the host. |
| 2 | Install software whose CVE has CPE data in the NVD feed, then run a scan (regression). | The NVD-based CVE continues to be detected with no regression. |

### EO-VULN-006 — Exclude software from the GET /hosts/identifier/:identifier response

- **Tier:** Free
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** A host enrolled and reporting installed software, reachable by its identifier.
- **Source:** #19540

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Call `GET /api/v1/fleet/hosts/identifier/:identifier` with no options. | Response includes the host's `software` field by default. |
| 2 | Call the endpoint with `exclude_software=true`. | Response omits the `software` field. |
| 3 | Call the endpoint with `exclude_software=false`. | Response includes the `software` field. |
| 4 | Call the endpoint with `exclude_software=bozo`. | Invalid value defaults to false; response includes the `software` field. |

### EO-VULN-007 — Hide Self-service when no self-service software is available

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

### EO-VULN-008 — Filter the Software > OS table by platform

- **Tier:** Free
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Hosts enrolled across multiple platforms, including at least two Linux hosts on different distros.
- **Source:** #20385

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to Software > OS. | The OS table lists operating systems across all enrolled platforms. |
| 2 | Filter by operating system type, including selecting "Linux". | Table shows only the selected platform; "Linux" returns OS rows for all Linux distros. |
| 3 | Combine the platform filter with other filters and paginate. | Other filters and pagination continue to work alongside the platform filter. |

### EO-VULN-009 — Edit an existing software package and verify install/uninstall count behavior

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Software package already added to a team (and to "No team"); hosts with a mix of pending, failed, and successful install/uninstall statuses for that package.
- **Source:** #20404, #22168, #22177

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the software title and click edit. | Edit form opens; install/uninstall scripts are NOT pre-populated (only populated when adding, not editing). |
| 2 | Edit the software file, self-service toggle, and advanced options (blank to populated, populated to different, populated to blank) and save. | Changes save successfully and the user stays on the same page. |
| 3 | Edit everything except the package and save. | Pending install/uninstall counts reset; failed and successful install/uninstall counts do NOT reset. |
| 4 | Update the package file itself and save. | Failed and successful install/uninstall counts reset; pending counts reset. |
| 5 | Save changes that cancel pending actions. | A "Save changes?" confirmation modal appears and pending install/uninstall are cancelled on confirm. |
| 6 | Change only the self-service toggle and save. | No counts reset and no pending actions are cancelled. |
| 7 | Upload a package for different software, then a package of a different file type. | Backend returns "The selected package is for different software." and "The selected package is for different file type." respectively. |
| 8 | After a successful edit, review the global activity feed. | An edit-software activity is recorded including the `software_package` details. |

### EO-VULN-010 — Show "Last updated" timestamp on the software title page

- **Tier:** Free
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** A host enrolled with software installed and synced.
- **Source:** #22269, #19551, #22222

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Sync up a host that has software installed. | Host reports its software inventory. |
| 2 | Open the software title details page and review versions and host counts. | An "updated at" / "Last updated" timestamp is shown for the versions and host counts, matching the design. |

## Queries & Policies

### EO-QUERY-001 — Failing policies sort to the top on My device and Host details pages

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

### EO-QUERY-002 — Select query modal on Host details shows clearer instructions

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** A host is enrolled and currently online. The signed-in user has permission to run queries on the host.
- **Source:** #12290

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the online host's Host details page. | Host details page loads and shows the host as online. |
| 2 | Click the Query button. | The Select query modal opens. |
| 3 | Read the modal's instructional copy. | The modal displays clear instructions guiding the user to select a query to run against the host. |

### EO-QUERY-003 — Filter suggested policies in the Add policy modal

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

### EO-QUERY-004 — Migrate 2017 packs to combined schedule and query concept via fleetctl

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet instance with one or more 2017-style packs that target a combination of teams, labels, and/or hosts (some with queries, some without). fleetctl is configured against the instance.
- **Source:** #12656

| # | Step | Expected result |
|---|------|-----------------|
| 1 | As an admin user, run `fleetctl upgrade-packs`. | The command completes and produces an output YAML file. |
| 2 | Inspect the resulting YAML file for a pack that targets teams. | One query spec is generated per team targeted by the pack. |
| 3 | Inspect the YAML for a pack that targets labels or hosts. | One non-team query with scheduling disabled and interval set to 0 is generated for that pack. |
| 4 | Apply the resulting YAML file back to Fleet. | All queries from the YAML are created successfully. |
| 5 | Run `fleetctl upgrade-packs` as a non-admin user. | The command is rejected; the non-admin user is not permitted to run it. |
| 6 | Run `fleetctl upgrade-packs` on an instance with no packs to migrate. | The command handles the no-packs case gracefully without error. |

### EO-QUERY-005 — View latest per-host query results (query reports)

- **Tier:** Both
- **Priority:** P0
- **Platforms:** All
- **Preconditions:** A query exists and has run on hosts on a scheduled interval, with query reports globally enabled. A log destination (internal or external) is configured.
- **Source:** #14415

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the query's report page and view results. | The latest query results are shown per host with a Report updated column and a view report action. |
| 2 | Verify the configured log destination. | Query report logs are delivered to the configured internal or external log destination. |
| 3 | Export the query results from `/hosts/$id/queries/$query_id`. | The export contains accurate result information for the host. |
| 4 | Globally disable query reports, then reload the query page. | The Report updated column and the view report action are no longer visible. |
| 5 | View the query results for an unsupported OS host (e.g. Chrome) and for a query with no data. | The correct empty states for no data and for unsupported OS are displayed. |
| 6 | Reduce the viewport to 768px width and review the page layout. | The page layout remains accurate and usable at 768px. |

### EO-QUERY-006 — Run live queries through the new Run live query endpoint

- **Tier:** Both
- **Priority:** P0
- **Platforms:** All
- **Preconditions:** Fleet instance with at least one saved query and multiple enrolled hosts, some online and some offline. API access configured for both a global user and a team-scoped user.
- **Source:** #14800

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Call the new Run live query endpoint with 1 query targeting 1 host. | Results are returned for the single host. |
| 2 | Call the endpoint with 1 query targeting multiple hosts, all online. | Results are returned for all targeted hosts. |
| 3 | Call the endpoint with 1 query targeting multiple hosts where some are offline. | Results return for online hosts; offline hosts are reported as not responding. |
| 4 | Call the endpoint with 1 query targeting multiple hosts that are all offline. | No results are returned and the offline hosts are reflected in the response. |
| 5 | Call the endpoint with 1 query and no hosts targeted, and again with a non-existent host. | The endpoint returns the appropriate empty/no-target and not-found handling. |
| 6 | Call the endpoint with a non-existent query, and as a team user against a query belonging to another team. | A non-existent query errors; the cross-team run is rejected as unauthorized. |
| 7 | Re-run the prior scenarios against the old (refactored) live query API, including 2 queries across 2 hosts. | The old endpoint behaves consistently with no regression. |

### EO-QUERY-007 — Policy host-count tooltips show Updated at timestamps

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

### EO-QUERY-008 — Populate policy data in the GET /hosts API

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

### EO-QUERY-009 — Target all "No team" hosts when running a live query

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Premium Fleet instance with hosts assigned to "No team" and at least one additional team. A saved query exists. API access configured.
- **Source:** #16350

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Call `GET fleet/targets/count` with `team_id=0`. | The response returns the count of hosts on "No team". |
| 2 | Call `POST fleet/queries/run` (async live query) with `team_id=0`. | The live query is dispatched to the "No team" hosts. |
| 3 | In the UI, start a live query and select the "No team" target. | The query runs against all hosts on "No team". |
| 4 | Repeat the targets-count and queries-run calls with another team_id value. | Existing per-team targeting still works correctly with no regression. |

### EO-QUERY-010 — Saving a default policy does not append the team name

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

## Agent (fleetd / osquery)

### EO-AGENT-001 — Kolide-sourced osquery tables resolve on all supported platforms

- **Tier:** Free
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A host enrolled via fleetd (orbit) is online and reporting; the Fleet build includes the newly added Kolide-sourced osquery tables.
- **Source:** #12008

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the online host's details page and start a live query. | The query console opens against the selected host. |
| 2 | Run a `SELECT * FROM <new_table>;` query for each newly added table on a platform where that table is supported. | Each table returns results (or an empty result set without error) and the columns match the documented schema. |
| 3 | Run the same query against a platform where the table is not supported. | The table is reported as not available / returns no rows rather than erroring the agent. |
| 4 | Repeat using osquery directly with the Fleet extension loaded (outside orbit). | The same tables resolve and return equivalent results, confirming the tables ship in the extension as well as in fleetd. |

### EO-AGENT-002 — Custom extension deploys only to hosts matching all configured labels

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Premium license active. At least two enrolled hosts; one host has all of a chosen set of labels, another is missing at least one. An agent-options configuration that targets a custom extension to that set of labels is prepared.
- **Source:** #13287

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Apply an agent-options configuration that includes an `extensions` block targeting a label-scoped extension to the set of labels. | Configuration is accepted and saved. |
| 2 | Refetch / wait for the host that has ALL listed labels. | The extension is deployed to that host and its tables/queries become available. |
| 3 | Check the host that is missing at least one of the labels. | The extension is NOT deployed to that host. |
| 4 | Apply a configuration whose extension targets a non-existent label. | Application fails with a clear error and the configuration is rejected. |
| 5 | Apply a configuration where label names differ only in case from existing labels. | The extension still deploys successfully (label matching is case-insensitive). |
| 6 | Remove the active license key (downgrade to Free) and re-check. | Label-targeted extension deployment no longer applies (feature gated to Premium). |

### EO-AGENT-003 — fleetd update channels are remotely configured via agent options

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Enrolled fleetd hosts on macOS, Windows, and Linux pointed at a TUF update server that has multiple channels available. Fleet Desktop both disabled and enabled across the host set (prioritize a host without Fleet Desktop).
- **Source:** #13825

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In agent options, set the `update_channels` for the fleetd components (e.g. orbit, osqueryd, desktop) to specific channels and save. | Configuration is accepted. |
| 2 | Refetch / let each host (macOS, Windows, Linux) pick up the new agent options. | Each host switches to the version published on its configured channel for each component. |
| 3 | Verify on a host running WITHOUT Fleet Desktop. | orbit and osqueryd update to the configured channels and the host stays enrolled and reporting. |
| 4 | Verify on a host running WITH Fleet Desktop. | The desktop component also moves to its configured channel without breaking enrollment. |
| 5 | Change a channel value and re-apply. | Hosts move to the newly specified channel on the next update cycle. |

### EO-AGENT-004 — Chrome extension and settings follow organizational unit (OU) overrides

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Google Admin console access with root-level Chrome device settings configured; a Chromebook available to enroll; a separate OU created with settings/extensions that differ from root.
- **Source:** #13886

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Configure root-level Chrome device settings and the Fleet Chrome extension at the root OU. | Root-level configuration saved in the Google Admin console. |
| 2 | Enroll a Chromebook at the root level. | The Chromebook appears in Fleet and the root-level settings/extension apply correctly. |
| 3 | Create a new OU with settings and extensions different from the root level. | OU-level configuration saved. |
| 4 | Move/enroll the Chromebook into the new OU. | The Chromebook picks up the OU-level configuration. |
| 5 | Compare applied settings/extension against root vs OU values. | The OU-level settings and extensions override the root-level values for that device. |

### EO-AGENT-005 — fleetd enrolls using the osquery instance identifier

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

### EO-AGENT-006 — Hosts endpoint reports total available disk space in gigabytes

- **Tier:** Free
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Enrolled and online Linux, macOS, and Windows hosts; API token available.
- **Source:** #15058

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Refetch host details for a Linux, a macOS, and a Windows host. | Each host completes a fresh detail refetch. |
| 2 | Call the host API endpoints (`GET /hosts`, `GET /hosts/:id`, `GET /hosts/identifier/:identifier`) for each host. | Responses include the `gigs_disk_space_available` field. |
| 3 | Compare `gigs_disk_space_available` to the host's actual free disk space. | The value is present and matches the host's actual available disk space in GB for each platform. |

### EO-AGENT-007 — secureboot osquery table returns correct results on Apple silicon

- **Tier:** Free
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** An Apple silicon Mac enrolled in Fleet and online, with access to its System Information app.
- **Source:** #15215

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Run a live query `SELECT * FROM secure_boot;` against the Apple silicon Mac. | The table returns results (no longer empty/unsupported on Apple silicon). |
| 2 | Compare the returned values against the "Controller" section of the macOS System Information app. | The query results match the values reported by System Information. |
| 3 | Change the secure boot / startup security setting on the Mac and re-query. | The `secure_boot` table results still match the System Information values after the change. |

### EO-AGENT-008 — Config-less fleetd-base packages install and enroll

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

### EO-AGENT-009 — Host details page shows the fleetd version

- **Tier:** Free
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Enrolled Linux, macOS, and Windows hosts. Hosts running a new orbit that reports fleetd version, plus at least one host on a previous orbit version for comparison.
- **Source:** #17361

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the Host details page for a host running new orbit (Fleet Desktop enabled). | The page shows the host's fleetd (orbit) version. |
| 2 | Open the Host details page for a host running new orbit with Fleet Desktop disabled. | The fleetd version is still shown. |
| 3 | Open the Host details page for a host on a previous orbit version that does not report its version. | The fleetd version field is gracefully empty/unavailable rather than erroring. |
| 4 | Repeat across Linux, macOS, and Windows hosts. | The fleetd version displays consistently on all three platforms. |

### EO-AGENT-010 — fleetd ships and runs the upgraded osquery version

- **Tier:** Free
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A fleetd release candidate built with the upgraded osquery version; enrolled macOS, Windows, and Linux hosts available for release QA.
- **Source:** #17375

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Install/update fleetd to the candidate build on each OS and complete standard fleetd release QA (enrollment, refetch, live query, scheduled queries). | All standard release checks pass on macOS, Windows, and Linux. |
| 2 | Run `SELECT version FROM osquery_info;` (or check host vitals) on each host. | The reported osquery version matches the new upgraded version. |
| 3 | Spot-check core osquery tables and existing scheduled/policy queries. | Tables return expected results with no regressions introduced by the osquery upgrade. |

### EO-AGENT-011 — Windows .msi install honors END_USER_EMAIL and FLEET_DESKTOP arguments

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

### EO-AGENT-012 — Fleet Desktop menu and UI copy read "About Fleet" instead of "Transparency"

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** A host running the patched Fleet Desktop; admin access to the Fleet UI organization settings.
- **Source:** #23314

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Install the patched Fleet Desktop on a host and open the Fleet Desktop tray menu. | The menu item reads "About Fleet". |
| 2 | Confirm the previous "Transparency" wording is no longer present in the menu. | No menu item labeled "Transparency" appears. |
| 3 | In the Fleet UI, open the Transparency/Custom transparency URL setting. | The setting copy references "About Fleet" as the menu item rather than "Transparency". |

## MDM, Certificates & OS Security

### EO-MDM-001 — Apple Rapid Security Response version surfaces in Host details and API

- **Tier:** Both
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** A macOS host enrolled in Fleet that has an Apple Rapid Security Response (RSR) version applied (e.g. macOS version shown with an `(a)` suffix).
- **Source:** #12888

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enroll a macOS host that has an Apple Rapid Security Response version installed and refetch its details. | Host is enrolled and details refresh completes. |
| 2 | Open the host's Host details page and inspect the operating system / version fields across the UI locations that display OS version. | The reported macOS version includes the Rapid Security Response designation in each UI location. |
| 3 | Query the host-detail and host-list API endpoints that return OS version information for this host. | Each endpoint returns the RSR version correctly in its response payload. |

### EO-MDM-002 — `fleetctl get mdm-commands` returns recent commands without timing out

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

### EO-MDM-003 — iOS/iPadOS enrollment flow remains functional

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** iOS/iPadOS
- **Preconditions:** Fleet (Premium) with Apple MDM (ABM/APNs) configured for mobile device enrollment, and an available iPhone/iPad.
- **Source:** #19447

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enroll an iPhone or iPad into Fleet MDM through the standard enrollment flow. | The device completes enrollment without errors. |
| 2 | Open the device's Host details page in Fleet. | The iOS/iPadOS host appears as enrolled with its details populated. |

### EO-MDM-004 — Deploy SCEP certificates from a Windows NDES SCEP server

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Fleet (Premium) with Apple MDM enabled; a reachable NDES SCEP server (Enterprise CA on Windows Server) configured and able to issue certs; an enrolled macOS host that has an IdP end-user email associated (`mdm_idp_accounts` source present in `host_emails`).
- **Source:** #21955, #13420

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In Fleet, configure the NDES SCEP connection (admin URL, username, password) and save. | Configuration saves successfully and a corresponding entry appears in the global activity feed. |
| 2 | Upload a configuration profile (via UI or GitOps) that uses the `$FLEET_VAR_NDES_SCEP_CHALLENGE`, `$FLEET_VAR_HOST_END_USER_EMAIL_IDP`, and `$FLEET_VAR_NDES_SCEP_PROXY_URL` variables, targeted at the enrolled macOS host with an IdP email. | The profile is delivered, Fleet fetches a one-time challenge from NDES, and the host receives a SCEP certificate issued by the NDES CA. |
| 3 | Upload a profile containing an unsupported variable such as `$FLEET_VAR_BOZO`, or a SCEP profile targeting a host that has no IdP email. | Fleet rejects/fails the profile delivery rather than issuing a certificate. |
| 4 | Attempt to use the NDES SCEP Fleet variables inside a Windows profile or an Apple DDM profile. | The variables are not honored for those profile types; the profile does not deploy a SCEP cert via NDES. |
| 5 | Deploy the SCEP profile to an offline macOS host, leave it offline for more than 60 minutes, then bring it online. | When the host comes back online, Fleet re-sends the profile with a freshly fetched one-time password (the prior NDES password having expired) and the cert is issued. |
| 6 | Edit and then delete the NDES SCEP configuration in Fleet. | A global activity feed entry is recorded for each of the edit and delete actions. |

### EO-MDM-005 — LUKS disk encryption and key escrow on Ubuntu and Fedora

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Linux
- **Preconditions:** Fleet (Premium) with disk encryption enforcement available; enrolled Linux hosts running Ubuntu, Kubuntu, and Fedora, plus at least one other supported Linux distro that is not LUKS-eligible.
- **Source:** #22074, #19594

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enforce disk encryption for a team containing the Ubuntu, Kubuntu, and Fedora hosts. | The disk encryption (LUKS) feature is offered for those hosts and the end user is prompted to set up / escrow their key. |
| 2 | Complete the LUKS key escrow flow on each of the Ubuntu, Kubuntu, and Fedora hosts and refetch host details. | Each host reports disk encryption as enforced/verified and its escrowed key is retrievable in Fleet. |
| 3 | Inspect a Fleet-supported Linux host running a distro other than Ubuntu/Kubuntu/Fedora under the same enforcement. | The LUKS disk encryption feature does not appear for that host. |

### EO-MDM-006 — Restrict Apple MDM traffic to a custom `apple_server_url`

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS, iOS/iPadOS
- **Preconditions:** Fleet (Premium) with Apple MDM configured; ability to set `mdm.apple_server_url`; two ngrok tunnels pointing distinct public URLs at the same local Fleet instance; an Apple host available to enroll.
- **Source:** #22267, #22039

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Set the `mdm.apple_server_url` config to one of the two tunnel URLs via GitOps, `fleetctl apply`, or the environment variable. | The custom Apple MDM server URL is accepted and applied. |
| 2 | Enroll an Apple (macOS/iOS/iPadOS) host into Fleet MDM. | The host enrolls successfully using the configured URL. |
| 3 | Exercise various MDM functionality on the enrolled host while monitoring traffic across both tunnel URLs. | All `/mdm/*` traffic is sent only to the configured `apple_server_url`; the second tunnel URL receives no MDM traffic. |

## Scripts

### EO-SCRIPTS-001 — Run scripts on Windows hosts from Host details with full lifecycle support

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** Windows
- **Preconditions:** Premium license active; an admin (or maintainer) user signed in; an online Windows host enrolled with scripts enabled; a `.ps1` script saved in the scripts library.
- **Source:** #14068

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Settings and upload a script via the scripts UI, attempting both a `.ps1` and a `.sh` file. | Both file types upload successfully; uploading any other extension is rejected by validation. |
| 2 | Confirm the script library zero state and saved-script list. | Zero state and saved-script icons match the Figma; no UI inconsistencies. |
| 3 | Open a Windows host's Host details page. | A Scripts tab is shown, matching the macOS implementation. |
| 4 | From Host details > Scripts, run the saved `.ps1` script against the Windows host. | Script runs; the script status updates correctly (pending, then ran/error). |
| 5 | Open the Activity feed after the run completes. | A script-run activity is recorded, including the script details and output. |
| 6 | As an admin/maintainer, download and delete a script from the UI. | Download returns the script contents; delete removes it from the library. |
| 7 | Open a Linux host's Host details page. | No Scripts tab / no scripts support is shown for Linux. |

### EO-SCRIPTS-002 — Disabling scripts via scripts_disabled blocks all script execution paths

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

### EO-SCRIPTS-003 — Extend script execution timeout beyond five minutes via agent options

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

### EO-SCRIPTS-004 — Host details surfaces whether scripts are enabled or disabled per platform

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

### EO-SCRIPTS-005 — Only admins and maintainers can run scripts; observers are denied

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

## Hosts, Teams & Settings

### EO-HOST-001 — Per-team host status webhook fires with correct payload when threshold is met

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A team exists with hosts enrolled. A webhook receiver (e.g. a request inspector endpoint) is reachable. Global host status webhook is either disabled or set to different conditions than the team's.
- **Source:** #14916

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the team's host status webhook settings, configure the destination URL, the offline-hosts percentage, and the days-count threshold via the UI | Settings save and persist on reload |
| 2 | Apply the same team host status webhook configuration via `fleetctl apply` and then via `fleetctl gitops` | Each method produces the same persisted configuration; no errors |
| 3 | Drive the team's hosts so the configured offline percentage over the configured days is met, then trigger the `automations` cron | The webhook fires to the configured team URL; the request body contains the correct team-scoped host status payload |
| 4 | Adjust the team so the threshold is NOT met (fewer offline hosts than configured) and trigger `automations` again | The webhook does not fire |
| 5 | Scale the team to a large offline-host set (~10,000 hosts offline) and trigger `automations` | The webhook fires correctly without timing out or dropping hosts from the payload |

### EO-HOST-002 — Global SSO toggle does not block existing or new users from logging in

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** An identity provider is configured (e.g. mocksaml.com). Logged in as a global admin. At least one test user exists.
- **Source:** #15236

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Confirm the global SSO enable/disable control and its surrounding copy/layout match the current design | UI matches design; the toggle and its description render correctly |
| 2 | With global SSO enabled, create a user with SSO enabled, then log in as that user via SSO | User is created and can log in successfully via SSO |
| 3 | As admin, remove SSO from that user, then have the user log in | User can still log in (via password) |
| 4 | Disable global SSO as admin, create another user without SSO, and have that user log in | User is created and can log in successfully |
| 5 | Re-enable global SSO as admin, add SSO to a user, and have that user log in via SSO | Toggling global SSO off and back on does not break SSO; the user logs in successfully via SSO |

### EO-HOST-003 — Per-team host expiry deletes only the intended hosts

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A team with hosts and at least one "No team" host exist. Able to adjust `seen_time` in `host_seen_times` to age hosts and to trigger the `cleanups_then_aggregation` cron.
- **Source:** #15609

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Configure team host expiry via the UI, then create a new team and update an existing team's expiry via `fleetctl apply` | Expiry settings save and persist for each team via each method |
| 2 | Enable global host expiry, age all hosts past it, and trigger `cleanups_then_aggregation` | Both team hosts and "No team" hosts past the global expiry are deleted |
| 3 | Set a team expiry shorter than the global expiry, age the team's hosts past the team expiry (but not the global), and trigger cleanup | The team's hosts are deleted at the shorter team threshold |
| 4 | Set a team expiry longer than the global expiry, age the team's hosts past the global expiry (but not the team expiry), and trigger cleanup | The team's hosts are NOT deleted; only the longer team threshold applies to them |
| 5 | Disable global host expiry, enable team expiry, age the team's hosts past the team expiry, and trigger cleanup | The team's hosts are deleted based on the team expiry alone |

### EO-HOST-004 — Enabling, editing, and disabling activity automations records activities with the webhook URL

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

## Maintenance Windows & Calendar

### EO-CAL-001 — Calendar integration creates a maintenance window event for a host failing a calendar policy

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

### EO-CAL-002 — Calendar event is rescheduled when an already-scheduled slot is moved

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Calendar integration is enabled and a host failing a calendar policy already has a maintenance window event on the end user's calendar.
- **Source:** #17230

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Move the existing maintenance window event to a different time on the end user's calendar. | The event reflects the moved time. |
| 2 | Trigger the calendar cron job. | Fleet detects the moved slot and the maintenance window is addressed/honored at the new time rather than duplicated. |

### EO-CAL-003 — Calendar events scale to many hosts firing on the same window

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Load-test environment with calendar integration enabled, a Google Calendar environment with many users, and up to 20,000 hosts failing the same calendar policy scheduled to fire at the same time with a webhook configured.
- **Preconditions:** A failing-policy webhook is configured.
- **Source:** #17230

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Drive 20,000 hosts to report the failing calendar policy and schedule calendar events at the same time. | Maintenance window events are created across the calendar users without errors. |
| 2 | Let the webhook fire for all 20,000 hosts at the scheduled window. | The webhook fires for every host with the correct payload. |
| 3 | Monitor other Fleet cron jobs and database access during the run. | No harm is done to other jobs or DB access; the feature works correctly at scale. |

### EO-CAL-004 — Generate an AI policy-remediation description for a calendar event

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Calendar integration is enabled. AI features are enabled (`ai_features_disabled` is false). A calendar-enabled policy exists. Signed in as a global admin (repeat as a team maintainer).
- **Source:** #18187

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open a calendar-enabled policy in the Fleet UI as a global admin and invoke the AI-generated description for policy remediation. | An AI-generated remediation description is produced for the policy. |
| 2 | Repeat step 1 as a team maintainer on a team policy. | The AI generation is available and works for the team maintainer role. |
| 3 | Drive a host to fail the policy and let a calendar event be created. | The created event's body uses the generated description/resolution content. |

### EO-CAL-005 — AI description generation is unavailable when AI features are disabled

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Calendar integration is enabled and a calendar-enabled policy exists. The `ai_features_disabled` setting is set to true.
- **Source:** #18187

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open a calendar-enabled policy as an admin while `ai_features_disabled` is true. | The AI-generated description option is not offered / cannot be invoked. |

### EO-CAL-006 — Calendar event body adapts to per-policy description and resolution content

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Calendar integration is enabled with calendar-enabled policies. A host is failing the relevant policies.
- **Source:** #18187

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Drive a host to fail two calendar policies, then create the calendar event. | The event body covers both failing policies. |
| 2 | Configure one failing policy with a filled-in description and resolution, create the event. | The event body shows the provided description and resolution. |
| 3 | Configure one failing policy with an empty description (resolution filled), create the event. | The event renders correctly with the missing description handled (no broken/blank body). |
| 4 | Configure one failing policy with an empty resolution (description filled), create the event. | The event renders correctly with the missing resolution handled. |
| 5 | Configure one failing policy with both description and resolution empty, create the event. | The event still renders correctly with sensible fallback content. |

### EO-CAL-007 — Maintenance window events are scheduled on the next Tuesday

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Calendar integration is enabled on a team and a calendar-enabled policy exists. A host on that team is failing the policy.
- **Source:** #19031

| # | Step | Expected result |
|---|------|-----------------|
| 1 | With a host failing the calendar policy, trigger the calendar cron job to create maintenance window events. | A calendar event is created for the host. |
| 2 | Inspect the date of the created event on the end user's calendar. | The event is scheduled on the next Tuesday. |

### EO-CAL-008 — Existing maintenance window event updates when policy description/resolution changes

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Calendar integration is enabled and a host failing a calendar policy already has a maintenance window event whose body reflects the current policy description/resolution.
- **Source:** #19280

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Change the policy description/resolution from populated to blank, then let the calendar cron job run. | The existing event's body updates to reflect the now-blank description/resolution. |
| 2 | Change the policy description/resolution from blank back to populated, then run the cron job. | The existing event's body updates to show the populated content. |
| 3 | Change the policy description/resolution to different non-empty text, then run the cron job. | The existing event's body updates to the new text. |
| 4 | Make the host go from failing 1 calendar policy to failing 2 (and back), then run the cron job. | The event body updates to reflect the change in the number of failing policies in both directions. |

### EO-CAL-009 — Maintenance window events scale when updating descriptions across many calendars

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Load-test environment with calendar integration enabled and ~20,000 maintenance window events spread across multiple calendars (roughly 1K events or fewer per calendar to limit callback load).
- **Source:** #19280

| # | Step | Expected result |
|---|------|-----------------|
| 1 | With ~20,000 events distributed across many calendars, update the policy description/resolution. | All affected events update via the calendar cron job without errors. |
| 2 | Monitor server, DB, and callback load during the bulk update. | The update completes correctly without overloading the server or DB. |

### EO-CAL-010 — Deleted or past-dated maintenance window events are recreated

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Calendar integration is enabled (with `FLEET_GOOGLE_CALENDAR_PLUS_ADDRESSING`) and hosts failing calendar policies already have maintenance window events scheduled.
- **Source:** #19352

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Move all calendar events to a past time (e.g. using `move-events.go`). | On the next processing cycle, the stale past events are recreated at a valid future slot. |
| 2 | Delete all calendar events (e.g. using `delete-events.go`). | The deleted events are recreated for the still-failing hosts. |
| 3 | Repeat the move/delete actions and simultaneously trigger the calendar cron job (setting event `updated_at` >30 minutes but <1 day earlier to force a refetch). | Events are reconciled and recreated correctly without duplication or loss despite the concurrent cron run. |
| 4 | Move all calendar events to the current time. | Webhooks fire for the affected hosts within roughly the next 5 minutes. |

### EO-CAL-011 — Unrelated calendar changes do not disturb maintenance window events under load

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Load-test calendar environment with `FLEET_GOOGLE_CALENDAR_PLUS_ADDRESSING`, with ~100 (up to ~1000) maintenance window events per calendar already created.
- **Source:** #19352

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Make an unrelated simultaneous change on the calendars (e.g. create or delete a random unrelated event) while events are being processed. | The maintenance window events all remain unchanged. |
| 2 | Monitor the database and Redis throughout the unrelated change. | No spikes are observed in DB or Redis; all events stay the same. |

### EO-CAL-012 — Maintenance window creation/recreation frequency is controlled by environment variables

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** A Fleet server where the maintenance window calendar refresh frequency environment variables can be set, with calendar integration enabled.
- **Source:** #19491

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Start Fleet without setting the maintenance window frequency environment variables. | The default creation/recreation (calendar refresh) frequency values are in effect. |
| 2 | Confirm the calendar refresh timing against the documented defaults. | The observed refresh cadence matches the default values. |
| 3 | Set the frequency environment variables to custom values and restart Fleet. | Fleet starts and accepts the configured values. |
| 4 | Confirm the calendar refresh timing after setting the variables. | The calendar refresh cadence reflects the new environment variable values. |
