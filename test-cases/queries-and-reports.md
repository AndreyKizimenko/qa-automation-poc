# Queries & Reports — test cases

> Feature area. Effective regression set curated from Fleet feature-story test
> plans (audited: deduped across former product groups; cosmetic/low-value checks
> pruned). Each case keeps its origin story #s in **Source**. See
> [`README.md`](README.md) for conventions; GitOps flows live in [`gitops.md`](gitops.md).

## Packs migration (fleetctl)

### QUERY-001 — Migrate 2017 packs to combined schedule and query concept via fleetctl

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

## Query reports

### QUERY-002 — View latest per-host query results (query reports)

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

### QUERY-003 — Scheduled query report host names link to host-specific reports

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

### QUERY-004 — Host details Reports tab renders each report's first result correctly

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

## Live queries

### QUERY-005 — Run live queries through the new Run live query endpoint

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

### QUERY-006 — Target all "No team" hosts when running a live query

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

### QUERY-007 — Live report Performance impact tab reflects per-host impact

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

## osquery tables via live query

### QUERY-008 — Kolide-sourced osquery tables resolve on all supported platforms

- **Tier:** Free
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A host enrolled via fleetd (orbit) is online and reporting; the Fleet build includes the newly added Kolide-sourced osquery tables.
- **Source:** #12008, #15215, #24198, #29655, #31475, #33193, #35149, #35548, #38393, #40629, #40630, #43888

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the online host's details page and start a live query. | The query console opens against the selected host. |
| 2 | Run a `SELECT * FROM <new_table>;` query for each newly added table on a platform where that table is supported. | Each table returns results (or an empty result set without error) and the columns match the documented schema. |
| 3 | Run the same query against a platform where the table is not supported. | The table is reported as not available / returns no rows rather than erroring the agent. |
| 4 | Repeat using osquery directly with the Fleet extension loaded (outside orbit). | The same tables resolve and return equivalent results, confirming the tables ship in the extension as well as in fleetd. |

## Reports rename / backward compatibility

### QUERY-009 — Existing `queries` continue to work after the Reports rename

- **Tier:** Both
- **Priority:** P0
- **Platforms:** All
- **Preconditions:** A Fleet instance with one or more pre-existing `queries` defined before the Reports rename.
- **Source:** #39238

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Fleet and locate the previously created `queries`. | The existing `queries` are present and unchanged. |
| 2 | Exercise each existing `queries` (run/view) as before the rename. | Each `queries` behaves identically to its pre-rename behavior, confirming backward compatibility. |

### QUERY-010 — New `reports` provide full functionality

- **Tier:** Both
- **Priority:** P0
- **Platforms:** All
- **Preconditions:** A Fleet instance on the build containing the Reports rename.
- **Source:** #39238

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Create a new `reports` entity. | The `reports` entity is created successfully. |
| 2 | Use the full set of `reports` capabilities (create, view, run, edit, delete). | Every `reports` capability functions correctly end to end. |

## Save as new (team scoping)

### QUERY-011 — Premium admin sees team dropdown when saving a query as new

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

## Query targets (labels)

### QUERY-012 — Query collects data only from hosts matching custom label targets

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

## File carving

### QUERY-013 — File carving preserves original file metadata for triage

- **Tier:** Free
- **Priority:** P2
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** A host enrolled to Fleet with file carving configured. A target file with known created/modified/accessed timestamps.
- **Source:** #38852

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Carve the target file using Fleet's file carving | The carve completes and the carved file is retrievable |
| 2 | Inspect the carved file's metadata | The original created, modified, and accessed timestamps are preserved and available for incident response triage |

## Agent/osquery smoke test

### QUERY-014 — Smoke test fleetd bundling osquery 5.23.1 across platforms

- **Tier:** Both
- **Priority:** P0
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** fleetd bundling osquery 5.23.1 (`edge`) built and enrolled on macOS, Windows, Fedora, and Ubuntu hosts. Scheduled queries with a configured log destination. File carving configured.
- **Source:** #48183, #48184

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

## Moved in (review placement)

### QUERY-015 — Surface Santa allow/deny events via the santa_allowed and santa_denied osquery tables

- **Tier:** Free
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** macOS host enrolled in Fleet with fleetd built including the Santa tables. Santa agent installed from the northpolesec/santa repo and configured via the santa-rules.mobileconfig configuration profile deployed through Fleet.
- **Source:** #31010

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Install WhatsApp on the host (a binary denied by the Santa rules profile) and launch it. | Santa's blocking popup appears, preventing WhatsApp from running. |
| 2 | Run a live query `SELECT * FROM santa_denied` against the host. | The query returns a denied event for WhatsApp. |
| 3 | Run a live query `SELECT * FROM santa_allowed` against the host. | The query returns allowed/open events (e.g., for Santa itself). |

### QUERY-016 — Reconcile the santa_status table with santactl output

- **Tier:** Free
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** macOS host enrolled in Fleet with fleetd including the Santa tables, Santa agent installed and running.
- **Source:** #31010

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the host, run `santactl status --json` and note the output. | The command returns Santa's current status as JSON. |
| 2 | Run a live query `SELECT * FROM santa_status` against the host. | The query returns rows. |
| 3 | Compare the table output to the `santactl status --json` output. | The values reported by the `santa_status` table match the output of the command. |

### QUERY-017 — Detect listening MCP servers and their capabilities via the mcp_listening_servers table

- **Tier:** Free
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Host enrolled in Fleet with fleetd including the `mcp_listening_servers` table. A test MCP server able to listen via streamable HTTP (e.g., `npx @modelcontextprotocol/server-everything streamableHttp`).
- **Source:** #34330

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Start a single MCP server listening on a port, then run `SELECT * FROM mcp_listening_servers;` as a live query. | The server appears in the results with correct `pid`, `name`, `cmdline`, `port`, and `address`. |
| 2 | Configure the MCP server with tools, prompts, and resources, then re-query the table. | The `tools`, `prompts`, and `resources` columns contain valid JSON, and `has_logging` / `has_completions` flags are set correctly based on the server's capabilities. |
| 3 | Start multiple MCP servers on different ports and query the table. | All running MCP servers are detected and listed as separate rows. |
| 4 | Stop all MCP servers and query the table. | The query returns empty results and no error. |
| 5 | Start various non-MCP services (web server, SSH, etc.) alongside one MCP server, then query the table. | Only the MCP server appears in the results; non-MCP listening ports are excluded. |

## Query authoring & validation

### QUERY-018 — Save a query with invalid SQL while empty queries remain blocked

- **Tier:** Free
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** User logged in with permission to create queries.
- **Source:** #35058

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the Queries page, start a new query and enter SQL with an intentional syntax error. | The validation message reads "Syntax error. Please review before saving." and the "Save" button remains enabled. |
| 2 | Save the invalid query. | The query saves successfully and appears in the list of queries. |
| 3 | Clear the query so the SQL field is empty. | An error message is shown and the "Save" button is disabled. |
