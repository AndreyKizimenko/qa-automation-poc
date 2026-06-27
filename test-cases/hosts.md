# Hosts — test cases

> Feature area. Effective regression set curated from Fleet feature-story test
> plans (audited: deduped across former product groups; cosmetic/low-value checks
> pruned). Each case keeps its origin story #s in **Source**. See
> [`README.md`](README.md) for conventions; GitOps flows live in [`gitops.md`](gitops.md).

## Host vitals & details

### HOSTS-001 — Hosts endpoint reports total available disk space in gigabytes

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

### HOSTS-002 — Host details page shows the fleetd version

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

### HOSTS-003 — Apple Rapid Security Response version surfaces in Host details and API

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

### HOSTS-004 — Host vitals expose MDM turned-on and MDM check-in timestamps

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | iOS/iPadOS | Android
- **Preconditions:** Fleet instance with MDM available; ability to enroll hosts manually and via Apple Business Manager (ADE); DB/API access to inspect host fields.
- **Source:** #17710

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enroll a host to Fleet without turning on MDM | `last_mdm_enrolled_at` is `null` |
| 2 | Turn on MDM for that macOS host manually | `last_mdm_enrolled_at` is set and is not equal to `last_enrolled_at` |
| 3 | Turn MDM off and back on for the macOS host | `last_mdm_enrolled_at` updates while `last_enrolled_at` stays distinct |
| 4 | Automatically enroll a macOS host via Apple Business Manager | `last_mdm_enrolled_at` is set |
| 5 | Wipe (erase all contents and settings) a macOS host with MDM on, then re-enroll automatically | `last_mdm_enrolled_at` is updated |
| 6 | Automatically and manually enroll an iOS, iPadOS, and Android host | `last_enrolled_at` and `last_mdm_enrolled_at` are the same timestamp |
| 7 | Let a host check in via the MDM protocol | `last_mdm_checked_in_at` updates on every MDM check-in |

### HOSTS-005 — Android host details show enrollment ID and updated personal-host count and tooltip

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** Android Enterprise configured in Fleet; access to the Google Admin console; an Android host available to enroll.
- **Source:** #26822, #27328

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enroll an Android host as a personal device | Enrollment ID is displayed in the host details UI |
| 2 | Check the personal-host count after enrolling | "(on) Personal" count increases to reflect the newly enrolled host |
| 3 | Hover the related tooltip | Tooltip copy matches the design |
| 4 | Delete the Android Enterprise binding in the Google Admin console | A banner appears on every page, the Android MDM card on `/settings/integrations/mdm` resets to default with the "Turn on" button visible, and banner precedence follows the design |

### HOSTS-006 — Show Users (IdP) section on Windows host details

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Windows
- **Preconditions:** Premium Fleet instance with a Windows host enrolled and IdP host vitals available.
- **Source:** #34365

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the host details page for a Windows host. | The Users section is visible. |

### HOSTS-007 — Location item hidden on Host details when GeoIP is not configured

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Fleet instance running without a `geoip.database_path` configured. macOS, Windows, Linux, and ChromeOS hosts enrolled.
- **Source:** #22801, #33509

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Host details for the macOS host and view the About section | No Location item is shown |
| 2 | Repeat for the Windows, Linux, and ChromeOS hosts | No Location item is shown for any of them |

### HOSTS-008 — Show location of a company-owned iOS/iPadOS host

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** iOS/iPadOS
- **Preconditions:** Fleet Premium with a valid GeoIP database configured. A company-owned (ABM-enrolled) iOS/iPadOS host enrolled.
- **Source:** #33509, #35824, #39835

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Host details for the company-owned iOS/iPadOS host and view the About section | "Show location" appears in the About section |
| 2 | Click "Show location" | The Location modal opens showing the host's location with a working timestamp, plus Lock instructions and a Lock button |

## Agent (fleetd / osquery)

### HOSTS-009 — fleetd ships and runs the upgraded osquery version

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

### HOSTS-010 — Fleet enrolls and inventories Omarchy (Arch Linux) hosts

- **Tier:** Both
- **Priority:** P1
- **Platforms:** Linux
- **Preconditions:** An Omarchy (Arch Linux) host available to enroll, with Fleet Desktop included in the fleetd package.
- **Source:** #32795, #32858

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enroll the Arch Linux host into Fleet | The host enrolls and appears in Fleet |
| 2 | Observe the system tray on the Arch Linux host | The Fleet Desktop icon is shown in the system tray |
| 3 | Click the Fleet Desktop icon and open Self-service | Self-service is accessible from the tray icon |
| 4 | View the host's software inventory in Fleet | Software inventory is indexed and listed for the Arch Linux host |

## Host expiry & status automations

### HOSTS-011 — Per-team host status webhook fires with correct payload when threshold is met

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

### HOSTS-012 — Per-team host expiry deletes only the intended hosts

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

## MDM solution detection

### HOSTS-013 — Mosyle surfaced as a well-known MDM in the solutions table

- **Tier:** Free
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Hosts reporting an MDM server URL that contains the `mosyle` string.
- **Source:** #35482, #35747

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the `/dashboard` page and view the MDM solutions table | Mosyle is listed as the MDM solution for hosts whose MDM server URL contains `mosyle` |

## Labels

### HOSTS-014 — Manage labels from the Labels page per user role

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

### HOSTS-015 — Build iOS/iPadOS labels from IdP-synced host vitals

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

## Host details layout (Vitals & Queries)

### HOSTS-016 — Host details Vitals and Queries sections replace Queries subnav

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

## Moved in (review placement)

### HOSTS-017 — SQL editor disabled state matches text editor disabled state

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** A label exists that can be edited. A design exists in Figma.
- **Source:** #34124

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On Hosts, select a label from the filter and choose to edit it to reach the "Edit label" page | The Edit label page opens with a disabled query text area |
| 2 | Hover over the query text area and click inside it | No hover state appears and no text cursor appears; only the "not allowed" cursor is shown, but text can still be highlighted |
| 3 | Click the "Copy" button | A "Copied!" message appears briefly then disappears |
| 4 | Navigate to Hosts, create a new label, and paste into the query area | The pasted text matches the query that was copied |

## Fleet Desktop / My device

### HOSTS-018 — Fleet Desktop "My device" opens transparency URL with no Secureframe branding by default

- **Tier:** Free
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Fleet Free server running without `FLEET_PARTNERSHIPS_ENABLE_SECUREFRAME` set (or set to `false`). A host enrolled with Fleet Desktop.
- **Source:** #27309

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the enrolled host, click Fleet Desktop > My device | Browser navigates to https://fleetdm.com/better with no Secureframe branding |
| 2 | Restart the server with `FLEET_PARTNERSHIPS_ENABLE_SECUREFRAME=false` and click Fleet Desktop > My device again | Still navigates to the transparency URL with no Secureframe branding |

### HOSTS-019 — Premium custom transparency URL overrides Secureframe partnership URL

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Fleet Premium server started with `FLEET_PARTNERSHIPS_ENABLE_SECUREFRAME=true`. A host enrolled with Fleet Desktop.
- **Source:** #27309

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to Settings > Organization settings > Fleet Desktop and set a custom transparency URL | Custom URL is saved |
| 2 | On the enrolled host, click Fleet Desktop > My device | Browser navigates to the configured custom URL (the custom URL wins over the Secureframe partnership URL) |
