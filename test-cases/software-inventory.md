# Software Inventory & Vulnerabilities — test cases

> Feature area. Effective regression set curated from Fleet feature-story test
> plans (audited: deduped across former product groups; cosmetic/low-value checks
> pruned). Each case keeps its origin story #s in **Source**. See
> [`README.md`](README.md) for conventions; GitOps flows live in [`gitops.md`](gitops.md).

## OS vulnerabilities

### SWINV-001 — Surface macOS and Windows operating system vulnerabilities

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

### SWINV-002 — Detect CVEs from the VulnCheck CPE feed during vulnerability scans

- **Tier:** Free
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Vulnerability scanning configured with the VulnCheck feed enabled; a host available to install test software.
- **Source:** #17538

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Install software whose CVE exists only in the VulnCheck feed on a host, then run a vulnerability scan. | The VulnCheck-only CVE is detected and surfaced for the host. |
| 2 | Install software whose CVE has CPE data in the NVD feed, then run a scan (regression). | The NVD-based CVE continues to be detected with no regression. |

### SWINV-003 — Software > OS surfaces Linux kernel vulnerabilities and kernels card

- **Tier:** Both
- **Priority:** P1
- **Platforms:** Linux, Windows, macOS
- **Preconditions:** Linux hosts in VMs with two installed kernels (at least one vulnerable) across supported distros (Ubuntu, Debian, RHEL, Fedora, SUSE, Arch), plus a containerized Linux host with zero kernels and one with a unique OS version. A Windows host and a macOS host also enrolled, all with software inventoried. Vulnerabilities and cleanup/aggregation jobs have run. A design exists in Figma.
- **Source:** #30738

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to the Software > OS tab | The Name column shows OS name (plus major version for Windows); all enrolled hosts are represented with matching host counts |
| 2 | Click an OS host count | The host list opens filtered by that OS |
| 3 | Review the CVE column for Linux OSes | Each Linux OS shows one or more CVEs matching expected kernel vulns, except the container-only OS version which shows "---" |
| 4 | Inspect the API response for a Linux OS version | The `vulnerabilities` key is populated |
| 5 | Open an individual Linux OS version | A "Kernels" card is shown instead of a Vulnerabilities card; kernel host counts match hosts with that kernel on that OS version |
| 6 | Click a host count in the Kernels card | The host list opens filtered by both software ID and OS version ID; container hosts are excluded; a host with multiple kernels is counted once per kernel in the card but once overall for the OS version |
| 7 | Inspect the API response for the individual OS version | It includes `vulnerabilities` and `kernels` entries, with `kernels` matching the `software_title.versions[]` format |
| 8 | Click a kernel in the Kernels card | A normal software version details page opens including vulnerability information; host counts may differ as the kernel spans multiple OS versions |
| 9 | Repeat the relevant checks on a Fleet Free instance | Behavior works in Free, with extra vulnerability details (scores, etc.) omitted |

## Software inventory API

### SWINV-004 — Populate host software inventory via GET /hosts with populate_software

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

### SWINV-005 — Exclude software from the GET /hosts/identifier/:identifier response

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

### SWINV-006 — Software API returns empty string for unopened software that supports last_opened_at

- **Tier:** Both
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** A host enrolled in Fleet with both software that supports `last_opened_at` (and has not been opened) and software that does not support `last_opened_at`. API access with a valid token.
- **Source:** #33512

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Call the "Get host's software" API endpoint for the host. | For software supporting `last_opened_at` but never opened, the field is an empty string; for software that does not support it, the field is omitted from the response. |
| 2 | Call the "Get host" API endpoint for the host. | Same behavior: empty string for unopened supporting software; field omitted for non-supporting software. |
| 3 | Call the "Get host by device token" API endpoint. | Same behavior: empty string for unopened supporting software; field omitted for non-supporting software. |
| 4 | Open the Host details and My device pages and view the "Last used" column. | "Never" is shown for supporting software that hasn't been opened; "Not supported" is shown for software that does not support `last_opened_at`. |

### SWINV-007 — Software executable SHA-256 hash is served in macOS API responses

- **Tier:** Both
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** A macOS host enrolled in Fleet with software whose API responses include `signature_information`. API access with a valid token.
- **Source:** #33522

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Call each software-related API endpoint that returns `signature_information` for the macOS host. | Each endpoint returns the software data successfully. |
| 2 | Inspect the response for macOS software entries. | `executable_sha256` is included and populated for macOS software. |

### SWINV-008 — Windows software upgrade_code is served only for the programs source

- **Tier:** Both
- **Priority:** P2
- **Platforms:** Windows
- **Preconditions:** A Windows host enrolled in Fleet with software from the `programs` source (including at least one app missing an upgrade code) and software from other sources. API access with a valid token.
- **Source:** #27759, #33907

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Call the "Get software" endpoint. | `upgrade_code` is included for `programs`-source software; software from other sources does not include `upgrade_code` (not even set to `null`); `programs` apps missing an upgrade code show an empty string. |
| 2 | Call the "Get software version" endpoint. | Same behavior: `upgrade_code` present for `programs` source, absent for other sources, empty string when missing. |
| 3 | Call the "Get host's software" endpoint. | Same behavior: `upgrade_code` present for `programs` source, absent for other sources, empty string when missing. |
| 4 | Call the "Get host" endpoint without the `exclude_software=true` query param. | Same behavior: `upgrade_code` present for `programs` source, absent for other sources, empty string when missing. |
| 5 | Call the "Get host by device token" endpoint without the `exclude_software=true` query param. | Same behavior: `upgrade_code` present for `programs` source, absent for other sources, empty string when missing. |

## Vulnerabilities & patch dashboard

### SWINV-009 — View patch progress broken down by version on the vulnerability dashboard

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

### SWINV-010 — Browse and triage vulnerabilities on the Software > Vulnerabilities page

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

### SWINV-011 — Navigate from vulnerability to software version and title pages

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** At least one CVE listed on /software/vulnerabilities with one or more vulnerable software entries. A design exists in Figma.
- **Source:** #27825

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On /software/vulnerabilities, click a listed vulnerability | The vulnerability details page opens with a "Vulnerable software" section |
| 2 | In the "Vulnerable software" section, click one of the listed versions | The /software/versions/ page for that software title version opens |
| 3 | On the version page, click the software title (active link) | The /software/titles/ page for that software opens |
| 4 | Return to /software/vulnerabilities, click the vulnerability, then click the software name in the "Vulnerable software" section | The /software/titles/ page for that software opens |

### SWINV-012 — Patch action on CVE detail page links to the software title (Premium); disabled for Free

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A CVE detail page with at least one associated software title in its table. A design exists in Figma. Both a Premium and a Free instance/user available.
- **Source:** #27825, #28323

| # | Step | Expected result |
|---|------|-----------------|
| 1 | As a Premium user, navigate to a CVE detail page and hover over a row in the software table | A "Patch" action is revealed on the row |
| 2 | Click "Patch" | The Software title page for that row's title opens |
| 3 | As a Free user, hover over a row in the same software table | The "Patch" action is shown disabled |
| 4 | Hover over the disabled "Patch" action | A tooltip indicates it is a Fleet Premium feature |

### SWINV-013 — Secondary CVSS score displayed when primary is missing

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** A CVE that has no primary CVSS score but does have a secondary score is present in the data (e.g. CVE-2024-54559, CVE-2024-0450, or CVE-2025-3196).
- **Source:** #28261

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to Software > Vulnerabilities | The vulnerabilities list loads with a Severity column |
| 2 | Search for a CVE that has only a secondary CVSS score (e.g. CVE-2024-54559) | The CVE appears in the results |
| 3 | Inspect the Severity column for that CVE | The secondary CVSS score is displayed |

## Software inventory & UI

### SWINV-014 — Filter the Software > OS table by platform

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

### SWINV-015 — Host details Software tab filters to top-level applications on macOS

- **Tier:** Both
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** A macOS host enrolled in Fleet whose software inventory includes both top-level applications and non-top-level applications; at least one non-macOS host available for comparison.
- **Source:** #39017

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the Software tab on the macOS Host details page with no filter set. | The top-level-applications filter is applied by default and only top-level applications are displayed. |
| 2 | Refresh the page. | The filter remains applied (only top-level applications shown). |
| 3 | Remove the filter. | Other (non-top-level) applications are now displayed. |
| 4 | Add the top-level-applications filter to the URL for a non-macOS host's Software tab. | The filter has no effect; the non-macOS host's full software list is shown. |

### SWINV-016 — Show SHA-256 hash for macOS app versions in Host vitals details

- **Tier:** Both
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** A macOS host enrolled with the fleetd tables extension (so app hashes are collected) and at least one macOS application (source "apps") installed.
- **Source:** #25545

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to the macOS host's Host details page, open the Software tab, and select Actions > Show details for a macOS app | A details modal opens listing each installed version of the app |
| 2 | Inspect each installed version in the modal | A SHA-256 hash is shown for each version, associated with its install path |
| 3 | Compare the displayed hash for an install path against the output of `codesign` for the same binary | The displayed hash matches the codesign result |
| 4 | Call `GET /hosts/:id/software` for the same host | Each macOS app (source "apps") includes `hash_sha256` under `installed_versions.signature_information` |

### SWINV-017 — Host vitals tolerate software with no hash across platforms and older agents

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Hosts available representing: vanilla osquery macOS (no tables extension), non-cask Homebrew packages, Linux, Windows, and a macOS host on older fleetd (v1.42.0).
- **Source:** #25545

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Host details > Software for a vanilla osquery macOS host (no fleetd tables extension) | Software vitals render correctly; macOS apps show no hash, no errors |
| 2 | View details for a non-cask Homebrew package | Vitals render correctly with no hash shown |
| 3 | Open Host details > Software for a Linux host and a Windows host | Vitals render correctly with no hash shown |
| 4 | Open Host details > Software for a macOS host running older fleetd (v1.42.0) | Vitals render correctly with no hash shown |

### SWINV-018 — Filter software by custom CVSS severity range on Software and Host Inventory pages

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Vulnerable software with a range of CVSS scores exists. Access to the Software page filter modal and the Host > Software > Inventory filter modal. A design exists in Figma. Note: this filter replaced the earlier simple severity dropdown (#29289); the dropdown options still order Any, Critical, High, Medium, Low.
- **Source:** #29289, #30248

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the filter modal on the Software page | Severity defaults to "Any severity"; min/max fields and help text are present but disabled |
| 2 | Enable the "Vulnerable software" toggle | The min/max severity fields become enabled |
| 3 | Open the severity dropdown and review the options | Options are ordered Any, Critical, High, Medium, Low (plus Custom severity) |
| 4 | Select a named severity such as "Critical severity" | Min and max are auto-populated for that tier |
| 5 | Select "Any severity" | Min and max are cleared |
| 6 | Type a custom min or max value | The dropdown switches to "Custom severity" |
| 7 | Clear both custom min and max | The dropdown switches to "Any severity", then returns to "Custom severity" when typing resumes |
| 8 | Type an invalid value (e.g. 4.11 or -3) | An inline error states the value must be a number between 0 and 10 in increments of 0.1; the field rejects non-numeric input |
| 9 | Enter a min greater than the max | The Apply button is disabled with a tooltip stating the min cannot be greater than the max |
| 10 | Enter only a min (e.g. 4.0) and click Apply | Results are filtered to vulnerable software with severity >= 4.0 |
| 11 | Enter only a max (e.g. 8.0) and click Apply | Results are filtered to vulnerable software with severity <= 8.0 |
| 12 | Enter both a min and max in range and click Apply | Results show only vulnerable software with severity within the selected range |
| 13 | Click Apply with no severity entered, then clear the filter | Applying with nothing entered applies any severity; clearing the filter shows all software |
| 14 | Repeat the modal checks on the Host > Software > Inventory page | Filter behaves identically |

### SWINV-019 — Last opened column on Host inventory shows time, Never, or Not supported

- **Tier:** Both
- **Priority:** P1
- **Platforms:** macOS, Windows
- **Preconditions:** A host with: an app/program that has been opened (has last-opened data), two installed versions of an app that have never been opened, and a software item for which last-opened time is not supported. Note: the column was renamed from "Last used" to "Last opened" (#31268, superseding #28819).
- **Source:** #28819, #29728, #31268

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On Host details > Software > Inventory, locate the last-opened column header | The column is named "Last opened" with no tooltip |
| 2 | View a Windows program (programs table) and a macOS app that have been opened | The "Last opened" date/time is shown |
| 3 | For an app with two installed versions that were never opened (after refetch), inspect the column and the installed-paths modal | "Last opened" shows "Never" in black; the paths modal shows "Never" for both entries |
| 4 | For a software item whose last-opened time is not supported, inspect the column and versions modal | "Last opened" shows "Not supported" in grey; the versions modal omits the last-opened header |
| 5 | Confirm "Never" and "Not supported" render the same way for a single installed version on a host | Behavior matches the multi-version cases |
| 6 | Open the modal from clicking a software item name in My device > Software | "Never" / "Not supported" behavior matches the host inventory view |
| 7 | Call the API powering the Host details and My device software views for a Windows program | `last_opened_at` data is present in the response |

### SWINV-020 — Personal (manually enrolled) iOS/iPadOS devices report only Fleet-managed apps

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** iOS/iPadOS
- **Preconditions:** Premium instance. An iOS/iPadOS host with MDM status "On (manual)" that has both Fleet-managed (installed by Fleet) and non-managed apps, plus the ability to trigger a refetch.
- **Source:** #36738

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Host > Software > Inventory for a manually enrolled (On (manual)) iOS/iPadOS host | Only apps managed/installed by Fleet are listed |
| 2 | Review the copy on the inventory page | The page copy reflects the managed-only behavior as specified in the UI changes |
| 3 | Call the software API for the same host | Only managed apps are returned |
| 4 | Trigger the first refetch after the feature release | All previously reported non-managed apps are removed from the host's inventory |

### SWINV-021 — Custom software name overrides normalized name in UI (Company Portal)

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS, Windows
- **Preconditions:** Premium instance with a software title (e.g. Company Portal) that has a custom name set, distinct from Fleet's normalized name.
- **Source:** #38792

| # | Step | Expected result |
|---|------|-----------------|
| 1 | View the software title (e.g. Company Portal) in the UI where a custom name has been set | The custom name is displayed, overriding the normalized name |

### SWINV-022 — Linux .deb/.rpm software shows per-location Last opened time

- **Tier:** Free
- **Priority:** P2
- **Platforms:** Linux
- **Preconditions:** A Linux host enrolled. A `.deb` package (and separately a `.rpm` package) installable in multiple locations/versions, including one copy that is never opened.
- **Source:** #32171

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Install and open a `.deb` package on the host, then view Host details > Software, My device > Software, and My device > Self-service | "Last opened" is shown and updated to reflect the open time across all three views |
| 2 | Install the `.deb` package in two different locations/versions and open each | Each location (path) or version shows its own unique "Last opened" time |
| 3 | Install a `.deb` package and never open it | "Last opened" shows "Never" |
| 4 | Repeat the open, multi-location, and never-opened checks for an `.rpm` package | The same "Last opened" behavior holds for `.rpm` packages |

### SWINV-023 — Software version rows do not link to "View all hosts"

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** An enrolled host with a software title that reports multiple versions.
- **Source:** #28051

| # | Step | Expected result |
|---|------|-----------------|
| 1 | From a host detail page Software tab, click a software title to open /software/titles/:id | The versions list is shown |
| 2 | Hover over a line in the versions list | No "View all hosts" link appears |
| 3 | Click a line in the versions list | You are taken to the specific version page for that software title |

## Moved in (review placement)

### SWINV-024 — View software details from the My device page

- **Tier:** Both
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Host enrolled with Fleet Desktop and software inventory populated; access to the host's My device page.
- **Source:** #23315

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the My device page, hover over a software row. | A "Show details" link appears. |
| 2 | Click the "Show details" link. | The software details modal opens. |
| 3 | Tab to focus a software row and press Enter. | The software details modal opens via keyboard. |
| 4 | Review the details modal for a software item. | Version, Type, Last used, File path, and Vulnerabilities are shown. |

## Software inventory tables (osquery)

### SWINV-025 — `go_binaries` table populates Go software inventory and versions

- **Tier:** Free
- **Priority:** P2
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Hosts on Windows, macOS, and Linux enrolled to Fleet with fleetd 1.54.0+ that includes the `go_binaries` table. Go installed on each host. At least one host still running an older fleetd (< 1.54.0).
- **Source:** #40138

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Install Go binaries via `go install` on the Windows, macOS, and Linux hosts, then query the `go_binaries` table | The installed binaries appear matching the schema docs on all three platforms |
| 2 | Refetch a host and view its software inventory | Software with `Type = Binary (Go)` is listed in the host's software inventory |
| 3 | Open the main Software tab | Software with `Type = Binary (Go)` appears in software versions and titles |
| 4 | Run `fleetctl trigger --name vulnerabilities` | The vulnerabilities cron completes without error against the Go binary software |
| 5 | Query a host running fleetd < 1.54.0 (no `go_binaries` table) | The host operates normally with no errors despite lacking the table |

## Editor/IDE extension inventory

### SWINV-026 — JetBrains IDE extensions appear in software inventory across platforms

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A macOS, Windows, and Linux host enrolled in Fleet, each with a supported JetBrains IDE (e.g. IntelliJ IDEA) installed and at least one IDE extension/plugin installed per the JetBrains plugin-management instructions.
- **Source:** #22463, #27914

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On an enrolled host with IntelliJ installed, install one or more IntelliJ extensions. | Extensions are installed in the IDE. |
| 2 | Refetch host vitals for the host (and confirm the data is also retrievable via a raw osquery live query). | Vitals refetch completes and the extension data is collected. |
| 3 | Navigate to the Software page. | The installed IntelliJ extensions appear as software titles. |
| 4 | Select "Show versions". | The IntelliJ extensions appear with their versions. |
| 5 | Click "View all hosts" on the right side of the Software table for an extension. | The enrolled host appears in the hosts list. |
| 6 | Click the host to open Host details, then open the Software tab. | The IntelliJ extensions are listed in the host's software inventory. |
| 7 | Repeat for each other JetBrains IDE that Fleet supports. | Extensions for each supported JetBrains IDE appear consistently across all three platforms. |

### SWINV-027 — Vulnerable JetBrains IDE plugins surface CVEs across platforms

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A macOS, Windows, and Linux host enrolled in Fleet, each with a supported JetBrains IDE (e.g. IntelliJ IDEA) installed and a known-vulnerable extension installed; vulnerability processing available.
- **Source:** #22463, #32266

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On an enrolled host with IntelliJ IDEA installed, install a known-vulnerable extension. | The vulnerable extension is installed. |
| 2 | Refetch host vitals for the host (and confirm the data is retrievable via a raw osquery live query). | Vitals refetch completes and extension data is collected. |
| 3 | Navigate to the Software page. | The IntelliJ IDEA extension appears and its vulnerabilities (CVEs) are shown. |
| 4 | Select "Show versions". | The extension and its CVEs are shown per version. |
| 5 | Click "View all hosts" on the right side of the Software table, then click the host to open Host details > Software tab. | The host appears in the list, and the extension plus its CVEs appear in the host's software inventory. |
| 6 | Repeat for each other supported JetBrains IDE. | The vulnerable extension and its CVEs surface consistently across all supported JetBrains IDEs and all three platforms. |

### SWINV-028 — Code-editor (Cursor/Windsurf/VS Code/VSCodium/Trae) extensions are inventoried and vulnerability-tagged

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** macOS, Windows, and Linux hosts enrolled with osquery >= 5.19; Cursor, Windsurf, VSCodium, VS Code, and Trae installed on each host, with a different-but-overlapping set of extensions per editor and at least one vulnerable extension per editor fork. Vulnerability processing available.
- **Source:** #31397, #31476

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Install Cursor, Windsurf, VSCodium, VS Code, and Trae on each of the Windows, macOS, and Linux hosts, with an overlapping extension set per editor (at least one vulnerable extension per fork). | Editors and extensions are installed on all three hosts. |
| 2 | Enroll the hosts and let inventory collect, then open the Software page. | Each extension shows as a separate software title per editor; the same extension on the same editor resolves to the same software title across all three OSes. |
| 3 | Open Host details > Software > Inventory for a host, and the My device > Software view. | Each extension is visible and tagged with its associated editor fork. |
| 4 | Run vulnerability processing, then re-check the vulnerable extensions. | A vulnerable extension is marked as vulnerable consistently across all editor forks it is installed in. |

### SWINV-029 — Global npm packages are inventoried and vulnerability-flagged on macOS and Linux

- **Tier:** Both
- **Priority:** P1
- **Platforms:** macOS | Linux
- **Preconditions:** A macOS host (Node installed via Homebrew) and Linux hosts (Ubuntu 24.04 and Fedora 42, Node installed via package manager) enrolled in Fleet. `nvm` is NOT installed. Vulnerability cron configured with the branch's cpe_translations. Test on a build that includes the branch changes. Use only non-scoped npm packages.
- **Source:** #31970, #32268

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On an enrolled host with Node installed, install some npm packages globally (non-scoped only), then refetch host vitals. | Vitals refetch completes and the global npm packages are collected. |
| 2 | Navigate to the Software page and select "Show versions". | The global npm packages appear as software titles with their versions. |
| 3 | Click "View all hosts" for an npm package, then click the host to open Host details > Software tab. | The host appears in the list and the npm packages are listed in the host's software inventory. |
| 4 | Install a known-vulnerable npm package version (e.g. `npm install vite@4.5.5` for CVE-2025-24010, or `npm install vega@5.24.0` for CVE-2025-25303), refetch vitals, and run the vulnerability cron. | The CVE is surfaced on the Software page, software title details page, software version details page, Host details page, and My device page. |
| 5 | Inspect the source label for npm packages on the Software page, title details, version details, Host details, and My device pages. | The source is displayed as lowercase "Package (npm)", not "Package (NPM)". |

## Linux vulnerability feeds (OSV/OVAL)

### SWINV-030 — RHEL 8/9 vulnerabilities detected via OSV match OVAL results

- **Tier:** Both
- **Priority:** P1
- **Platforms:** Linux
- **Preconditions:** RHEL 8 and RHEL 9 hosts enrolled in Fleet with software inventory collected; ability to run vulnerability scanning with both OVAL and OSV feeds.
- **Source:** #40056

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Run an OSV-based vulnerability scan against the RHEL 8 and RHEL 9 hosts and capture the detected CVEs. | OSV scan completes and produces vulnerability results for both hosts. |
| 2 | Compare the OSV scan results against the current OVAL scan results for the same RHEL 8 and 9 hosts. | OSV results align with OVAL results (no unexpected loss of legitimate detections); any differences are documented. |
| 3 | Verify kernel vulnerability detection for RHEL (currently sourced from goval-dictionary). | Kernel vulnerabilities are still detected for RHEL after the transition to OSV. |

### SWINV-031 — Ubuntu OSV feed resolves emacs-common false positive while keeping real CVE

- **Tier:** Both
- **Priority:** P1
- **Platforms:** Linux
- **Preconditions:** Ability to download and parse OSV data for Ubuntu 20.04, 22.04, and 24.04; an Ubuntu 24.04 host (or equivalent test data) with `emacs-common` installed; ability to run OVAL and OSV scans and the osquery-perf comparison.
- **Source:** #39370, #40201

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Download and parse the OSV vulnerability data for Ubuntu 20.04, 22.04, and 24.04. | OSV data is downloaded and parsed successfully for all three releases. |
| 2 | Run an OSV-based scan against `emacs-common` on Ubuntu 24.04 and inspect CVE-2024-30205. | CVE-2024-30205 is NOT flagged for `emacs-common` (the known false positive is resolved). |
| 3 | Inspect CVE-2024-39331 for `emacs-common` on Ubuntu 24.04 in the same scan. | CVE-2024-39331 IS still flagged (legitimate vulnerability retained). |
| 4 | Run the osquery-perf comparison between OVAL and OSV results. | The comparison completes and the differences between OVAL and OSV results are documented. |
| 5 | Run a scan for a release where OSV data is missing. | Fleet falls back to OVAL for that release. |

## Software title rename

### SWINV-032 — Rename a software title with a bundle ID as global admin

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Logged in as a global admin. At least one software title in inventory has a bundle ID (e.g. a macOS app) and at least one has no bundle ID.
- **Source:** #26933

| # | Step | Expected result |
|---|------|-----------------|
| 1 | As global admin, call the software title name edit endpoint to change a title that has a bundle ID to a new valid, non-empty name | Request succeeds (HTTP 2xx) |
| 2 | Open the Software list view (Software > Titles) | The title displays under its new name |

### SWINV-033 — Software title rename endpoint rejects invalid requests

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** A non-global-admin user account exists. At least one software title has a bundle ID and at least one has no bundle ID.
- **Source:** #26933

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Call the software title name edit endpoint as a non-global-admin user | Request is rejected with a forbidden/authorization error |
| 2 | As global admin, call the endpoint for a software title ID that does not exist | Request fails with a not-found error |
| 3 | As global admin, attempt to rename a title that has no bundle ID | Request fails with a validation error |
| 4 | As global admin, attempt to change a title's name to a zero-length (empty) string | Request fails with a validation error |
