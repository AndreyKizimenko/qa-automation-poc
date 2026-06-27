# Software — test cases

> Area: `#g-software`. Most software **deployment** features (FMA, VPP, custom
> packages, scripts, self-service, setup experience) are **Premium**; software
> **inventory** and vulnerability surfacing exist on Free. GitOps-driven software
> flows live in [`gitops.md`](gitops.md).

> Derived from Fleet `#g-software` feature-story test plans (oldest→newest, with
> superseded behavior collapsed) and verified against the live product. See
> [`README.md`](README.md) for method and the case template.

## Live verification status

Core navigation/structure spot-checked against a live premium instance on
**2026-06-27**. Canonical current paths (some cases were authored from older
stories that describe a modal — the structure below is authoritative):

- **Software page** (`/software/inventory`) has tabs **Inventory · OS ·
  Vulnerabilities · Library**. **Library** and **Automations** are **gated by
  team scope** — disabled under "All fleets", enabled once a specific team/No
  team is selected.
- **Add software** is a **full page** (not a modal), reached via **Software →
  (select team) → Library → Add software**, with three tabs:
  - **Fleet-maintained** — `/software/add/fleet-maintained`. Cross-platform
    catalog (**macOS + Windows** columns, per-platform "Add"; ~1,260 apps).
  - **App store** — `/software/add/app-store`. Platform selector "Apple (macOS,
    iOS, and iPadOS)"; apps are sourced from **Apple Business (AB)** (the UI term;
    older stories say "ABM"/VPP).
  - **Custom package** — `/software/add/package`. Accepts macOS (`.pkg`, `.sh`),
    iOS/iPadOS (`.ipa`), Windows (`.msi`, `.exe`, `.ps1`), Linux (`.deb`, `.rpm`,
    `.tar.gz`, `.sh`).

Host/token-gated cases (iOS/Android/Linux installs, VPP/ABM token, S3+CloudFront,
GitOps apply) were **not** walked live and are marked by their Preconditions.

## Software inventory & UI

### SW-INV-001 — Policy names truncate with ellipsis and tooltip on Host details and My device

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** A host enrolled with at least one policy whose name is long enough to truncate in a narrow window. Access to both the Host details page and the My device page.
- **Source:** #25131

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to a host's Host details page and open the Policies table | Policy names show with no arrow icons next to them |
| 2 | Narrow the browser window until policy names exceed the column width | Long policy names truncate with an ellipsis |
| 3 | Hover over a truncated policy name | A tooltip shows the full policy name |
| 4 | Click a policy name | A modal opens showing the policy details |
| 5 | Navigate to the My device page and open the Policies table, repeating steps 1-4 | Same behavior: no arrows, names truncate with ellipsis, tooltip shows full name on hover, click opens details modal |

### SW-INV-002 — Show SHA-256 hash for macOS app versions in Host vitals details

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

### SW-INV-003 — Host vitals tolerate software with no hash across platforms and older agents

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

### SW-INV-004 — Pagination controls hide when there is only one page of results

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Access to at least one table view whose results fit on a single page, and one table view with more than one page of results.
- **Source:** #26832

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to a table that returns only one page of results | No Previous or Next pagination links are shown (not even greyed out) |
| 2 | Navigate to a table that returns more than one page of results | Previous and Next pagination links are shown |

### SW-INV-005 — Host count is a styled link on Software version, vulnerability, and OS detail pages

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Software version, vulnerability, and OS detail pages each exist with at least one matching host. A design exists in Figma.
- **Source:** #27533

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open a Software version details page and locate the host count | The host count is rendered bold in vibrant blue as a link |
| 2 | Hover over the host count | A tooltip appears indicating it links to the host list |
| 3 | Click the host count | The host list page opens, filtered to hosts with that software version |
| 4 | Repeat steps 1-3 on a Software vulnerability details page | Host count is a bold blue link with tooltip and navigates to the filtered host list |
| 5 | Repeat steps 1-3 on a Software > OS details page | Host count is a bold blue link with tooltip and navigates to the filtered host list |
| 6 | View a detail page where the host count is zero | A "0" is shown that still links to the (empty) host list page |

### SW-INV-006 — Expose UpgradeCode for Windows apps via programs.upgrade_code

- **Tier:** Both
- **Priority:** P2
- **Platforms:** Windows
- **Preconditions:** A Windows host enrolled with software installed via WinGet MSI packages that include an UpgradeCode in their manifest. Ability to run a live query.
- **Source:** #27759

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Run a live query selecting `upgrade_code` from the `programs` table on the Windows host | The `upgrade_code` column exists and returns values |
| 2 | Inspect the `upgrade_code` value for a WinGet MSI-installed program | The value matches the expected UpgradeCode from the MSI manifest |

### SW-INV-007 — Navigate from vulnerability to software version and title pages

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

### SW-INV-008 — Patch action on CVE detail page links to the software title (Premium); disabled for Free

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A CVE detail page with at least one associated software title in its table. A design exists in Figma. Both a Premium and a Free instance/user available.
- **Source:** #28323, #27825

| # | Step | Expected result |
|---|------|-----------------|
| 1 | As a Premium user, navigate to a CVE detail page and hover over a row in the software table | A "Patch" action is revealed on the row |
| 2 | Click "Patch" | The Software title page for that row's title opens |
| 3 | As a Free user, hover over a row in the same software table | The "Patch" action is shown disabled |
| 4 | Hover over the disabled "Patch" action | A tooltip indicates it is a Fleet Premium feature |

### SW-INV-009 — Hand-pointer cursor on enabled checkboxes and radio buttons, default on disabled

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Access to pages with table checkboxes (e.g. /hosts/manage), form checkboxes (e.g. /settings/organization/advanced), disabled checkboxes (e.g. /software/add/package Add a .exe automatic-install checkbox), and enabled/disabled radio buttons (e.g. /settings/users Add user modal).
- **Source:** #27909

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Hover over a table checkbox (e.g. on /hosts/manage) | Cursor changes to the hand pointer |
| 2 | Hover over a non-table form checkbox and its label text | Cursor changes to the hand pointer over both checkbox and label |
| 3 | Hover over a disabled checkbox and its label text | Cursor does NOT change to the hand pointer |
| 4 | Hover over an enabled radio button and its label text | Cursor changes to the hand pointer over both button and label |
| 5 | Hover over a disabled radio button and its label text | Cursor does NOT change to the hand pointer |
| 6 | Hover over a checkbox label and a radio label that include a tooltip | Cursor behavior follows the enabled/disabled rules above and the tooltip still appears |

### SW-INV-010 — Search fields, dropdowns, and form inputs use 14px font

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Access to representative dropdowns, search bars, and form fields (dashboard platform filter, Manage hosts filters and search, Software/OS/Vulnerabilities filters and search, query filters/search, add-user role dropdown and inputs, Add host modal inputs). A design exists in Figma.
- **Source:** #27951

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Inspect the dashboard platform dropdown filter | Text renders at 14px |
| 2 | Inspect the Manage hosts page dropdown filters and search bar | Text renders at 14px |
| 3 | Inspect the Software, Software > OS, and Software > Vulnerabilities dropdown filters and search bars | Text renders at 14px |
| 4 | Inspect query page dropdown filter and search bar, and the Manage users > Add user modal role dropdown and input fields | Text renders at 14px |
| 5 | Inspect the Add host modal input fields across platform tabs | Text renders at 14px |

### SW-INV-011 — Detail page cards use uniform 40px padding

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Access to the software title page, host details page, operating systems detail page, and vulnerabilities detail page, each with content.
- **Source:** #28004

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to the software title page and inspect the card padding | Card padding is uniform at 40px |
| 2 | Navigate to the host details page and inspect the card padding | Card padding is uniform at 40px |
| 3 | Navigate to the operating systems detail page and inspect the card padding | Card padding is uniform at 40px |
| 4 | Navigate to the vulnerabilities detail page and inspect the card padding | Card padding is uniform at 40px |

### SW-INV-012 — Secondary CVSS score displayed when primary is missing

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

### SW-INV-013 — Collect IntelliJ/JetBrains plugins via jetbrains_plugins osquery table

- **Tier:** Both
- **Priority:** P2
- **Platforms:** macOS, Windows, Linux
- **Preconditions:** A build of osquery that includes the `jetbrains_plugins` table is installed on macOS, Windows, and Linux hosts. A JetBrains IDE (IntelliJ IDEA, GoLand, CLion, PyCharm, WebStorm, etc.) with at least one plugin installed on each host.
- **Source:** #27914

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On each host (macOS, Windows, Linux), confirm the `jetbrains_plugins` table is present in osquery | The `jetbrains_plugins` table exists |
| 2 | Install one or more plugins in a JetBrains IDE on each host, then run a live query against `jetbrains_plugins` | Results list the installed plugin name and version |
| 3 | Review the query results | No unexpected or spurious plugin entries are returned |

### SW-INV-014 — Collect Windsurf and Cursor extensions via vscode_extensions table

- **Tier:** Both
- **Priority:** P2
- **Platforms:** macOS, Windows, Linux
- **Preconditions:** Windsurf, Cursor, and VSCodium installed on a macOS host (then repeated on Windows and Linux), each with at least one extension installed.
- **Source:** #31476

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the macOS host, install Windsurf, Cursor, and VSCodium and install extensions in each | Each editor fork has extensions installed |
| 2 | Run a live query selecting name, version, extension_id, vendor, installed_path, and `vscode_edition` from `vscode_extensions` | Results match the installed extensions |
| 3 | Inspect the `vscode_edition` value per extension | It corresponds to the correct fork (Windsurf, Cursor, or VSCodium) |
| 4 | Repeat steps 1-3 on a Windows host and a Linux host | Results match the installed extensions with correct `vscode_edition` on each platform |

### SW-INV-015 — Software install/uninstall status shows progress and failure modal on Host details

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS, Windows, Linux
- **Preconditions:** Premium instance. Software added to a team, and a host assigned to that team. The host can be brought online and offline. A design exists in Figma.
- **Source:** #28925

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the team host's Host details > Software tab, for available software select Actions > Install while the host is online | Status shows "Installing" with a spinner during installation |
| 2 | For an installed app, select Actions > Uninstall while the host is online | Status shows "Uninstalling" with a spinner during the uninstall |
| 3 | Trigger an install or uninstall that fails | Status shows "Failed" |
| 4 | Click the "Failed" status | A modal opens showing the same failure detail that appears when clicking the activity in the activity feed |

### SW-INV-016 — Filter software by custom CVSS severity range on Software and Host Inventory pages

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Vulnerable software with a range of CVSS scores exists. Access to the Software page filter modal and the Host > Software > Inventory filter modal. A design exists in Figma. Note: this filter replaced the earlier simple severity dropdown (#29289); the dropdown options still order Any, Critical, High, Medium, Low.
- **Source:** #30248, #29289

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

### SW-INV-017 — Last opened column on Host inventory shows time, Never, or Not supported

- **Tier:** Both
- **Priority:** P1
- **Platforms:** macOS, Windows
- **Preconditions:** A host with: an app/program that has been opened (has last-opened data), two installed versions of an app that have never been opened, and a software item for which last-opened time is not supported. Note: the column was renamed from "Last used" to "Last opened" (#31268, superseding #28819).
- **Source:** #31268, #28819, #29728

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On Host details > Software > Inventory, locate the last-opened column header | The column is named "Last opened" with no tooltip |
| 2 | View a Windows program (programs table) and a macOS app that have been opened | The "Last opened" date/time is shown |
| 3 | For an app with two installed versions that were never opened (after refetch), inspect the column and the installed-paths modal | "Last opened" shows "Never" in black; the paths modal shows "Never" for both entries |
| 4 | For a software item whose last-opened time is not supported, inspect the column and versions modal | "Last opened" shows "Not supported" in grey; the versions modal omits the last-opened header |
| 5 | Confirm "Never" and "Not supported" render the same way for a single installed version on a host | Behavior matches the multi-version cases |
| 6 | Open the modal from clicking a software item name in My device > Software | "Never" / "Not supported" behavior matches the host inventory view |
| 7 | Call the API powering the Host details and My device software views for a Windows program | `last_opened_at` data is present in the response |

### SW-INV-018 — Host details Software tab splits into Inventory and Library with correct columns

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

### SW-INV-019 — Library tab hidden in Fleet Free and unsupported platforms

- **Tier:** Free
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** A Fleet Free instance, plus an Android device enrolled.
- **Source:** #29728

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On Fleet Free, open a host's Host details > Software tab | The Library tab is hidden; only Inventory is shown |
| 2 | View the Software tab for an Android device | The Library tab is hidden and the "Software not supported" empty state is shown |

### SW-INV-020 — Software page separates Inventory and Library, Library disabled for All teams

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

### SW-INV-021 — Software > OS surfaces Linux kernel vulnerabilities and kernels card

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

### SW-INV-022 — SQL editor disabled state matches text editor disabled state

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

### SW-INV-023 — Personal (manually enrolled) iOS/iPadOS devices report only Fleet-managed apps

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

### SW-INV-024 — Custom software name overrides normalized name in UI (Company Portal)

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS, Windows
- **Preconditions:** Premium instance with a software title (e.g. Company Portal) that has a custom name set, distinct from Fleet's normalized name.
- **Source:** #38792

| # | Step | Expected result |
|---|------|-----------------|
| 1 | View the software title (e.g. Company Portal) in the UI where a custom name has been set | The custom name is displayed, overriding the normalized name |

## Fleet-maintained apps (FMA)

### SW-FMA-001 — Software titles API returns platform for installer and VPP titles

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

### SW-FMA-002 — Add Fleet-maintained app from the software details page (Patch modal) when host already has it installed

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS | Windows
- **Preconditions:** Team selected; an enrolled host on that team that already has an app installed manually (the app matches an available Fleet-maintained app that has NOT yet been added to Fleet); host vitals refetched so the software appears in inventory.
- **Source:** #25499, #27592

| # | Step | Expected result |
|---|------|-----------------|
| 1 | From the host's Software list, click the installed software title to open its software details page | Software details page opens with no installer package section |
| 2 | Click "Add software" | An Add modal appears showing the matching Fleet-maintained app, labeled "Fleet-maintained" |
| 3 | Click "Show details" | Patch modal closes and a Details modal opens; closing Details reopens the Add modal |
| 4 | Click "Add software" | Add button is disabled and a loading state shows while uploading |
| 5 | Wait for the upload to complete | User lands on the software details page with the package added; a success flash confirms the package is available; installer info shows below the title/host-info section |
| 6 | Open the Actions dropdown | Dropdown lists Patch, Auto-install, Enable self-service, View all hosts; installer action icons are download, edit (pencil), delete (trash) |

### SW-FMA-003 — Add App Store (VPP) app from software details page when host already has it installed

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

### SW-FMA-004 — Patch policy installs the app on hosts running an older version

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

### SW-FMA-005 — Auto-install policy installs the app on hosts missing it

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** A non-.exe installer (FMA or custom package) uploaded to a team; one enrolled host without the software and one enrolled host with the software already installed.
- **Source:** #25499

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the software details page, click Actions > Auto-install | The Auto-install modal opens with target options |
| 2 | Enable auto-install and click Save | Loading state shows, then user returns to the details page with a flash confirming the install policy was edited |
| 3 | Review the installer section | An "Install <title>" policy appears with a Fleet icon and "Fleet-created policy" tooltip; clicking the row opens a read-only policy modal |
| 4 | Refetch vitals on both hosts | Policy fails on the host without the software and passes on the host that already has it |
| 5 | Wait after the failure | An install command is issued, the software installs, reports its version, and the policy passes for that host |

### SW-FMA-006 — Enable and disable self-service for an installer

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** An installer (FMA or custom package) uploaded to a team; an enrolled host on that team in self-service scope.
- **Source:** #25499

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the software details page, click Actions > Enable self-service | The Enable self-service modal opens with target options |
| 2 | Enable self-service and click Save | A flash confirms the software is available for self-service; a Self-service pill shows in the installer package section; Actions now offers "Disable self-service" |
| 3 | On the enrolled host, open self-service | The software is listed and available to install |
| 4 | Back on the details page, click Actions > Disable self-service and click Save | A flash confirms self-service is disabled for this installer |
| 5 | Recheck self-service on the host | The app is no longer available in self-service |

### SW-FMA-007 — Edit installer package resets policy counts; editing advanced options preserves them

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** An installer uploaded to a team that has associated policies with Installed/Pending/Failed counts populated.
- **Source:** #25499, #28053

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the software details page, click the edit (pencil) icon | A modal opens allowing the package to be changed and showing advanced options (and scoping/self-service) |
| 2 | Upload a different installer package and click Save | A "Save changes?" confirmation modal opens |
| 3 | Confirm Save | Changes save with a success flash; Installed/Pending/Failed counts reset to "—" (0) |
| 4 | Open the edit modal again, change only advanced options, and Save through the confirmation | Changes save with a success flash; Installed/Pending/Failed counts are NOT reset |

### SW-FMA-008 — Delete Fleet-maintained installer removes its Fleet-created policies and pending installs

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

### SW-FMA-009 — Delete installer with an attached custom policy detaches it without blocking

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** An installer uploaded with a user-created (custom) policy whose "Install software" automation targets it.
- **Source:** #25499, #28059

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the software details page, click the delete (trash) icon and confirm Delete | Deletion is not blocked; a flash confirms the installer was deleted and the user returns to the software details page |
| 2 | Review the page | Installer section is removed and no associated policies are shown |
| 3 | Open the previously attached custom policy's automations | The custom policy still exists but its "Install software" automation no longer references the deleted software |

### SW-FMA-010 — Software title with no installer or FMA shows Add software and counts existing hosts

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** An enrolled host with a software title in inventory that is not available as an FMA and has no installer package (not shown as "Available to install").
- **Source:** #25499

| # | Step | Expected result |
|---|------|-----------------|
| 1 | From the host details Software tab, click the software title | The software details page opens with an "Add software" button |
| 2 | Review the host count under the software name | Hosts that already have this software installed are included in the count |

### SW-FMA-011 — Fleet-created install/patch policies are hidden across policy views

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

### SW-FMA-012 — Policy fleet_maintained flag controls visibility and API filtering

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

### SW-FMA-013 — Fleet-initiated activity shows the acting user, not "Fleet"

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

### SW-FMA-014 — Software details page shows installer section with status counts and policies

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** A software title with an uploaded installer (test across FMA, custom package, and VPP) that has install-on-policy-failure automations set up.
- **Source:** #28053, #25499

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open /software/titles/:id for the title | Versions appear in a section under the app name; installer information is in a separate section below the title/version section |
| 2 | Review the installer section label | "Fleet-maintained", "App Store (VPP)", or "Custom Package" is shown below the package name; custom packages otherwise carry no label |
| 3 | Locate the Installed/Pending/Failed counts | The counts table appears below the installer information; clicking a count opens a host list filtered by that status and title |
| 4 | Review the policies area | The list of associated policies appears below the counts table; clicking a policy navigates to /policies/:id?team_id=... |
| 5 | Verify pagination | Policies paginate, and versions paginate after 10 items |
| 6 | Resize the page down to 768px per breakpoints | Layout is responsive across the Figma breakpoints (design exists) |
| 7 | Inspect the `software_package` API response | `fleet_maintained_app_id` is an integer (usable with GET fleet_maintained_apps) when added via FMA, and null otherwise |

### SW-FMA-015 — Software library status reflects whether software is on the host and offers correct actions

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** A host with several self-service installers available (test FMA, custom packages, and VPP) across Chrome, Safari, Edge, and Firefox.
- **Source:** #30240, #27983

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

### SW-FMA-016 — Install details modal distinguishes user-installed from Fleet-installed software

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** A host with one software title installed by the end user (not via Fleet) and one installed by Fleet; both available as self-service.
- **Source:** #30240

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Hover the "Installed" status for the user-installed software | The tooltip differs from the Fleet-installed tooltip, per Figma specs |
| 2 | Open the details modal for the user-installed software | The modal opens but contains no install/uninstall details dropdown |
| 3 | Open the details modal for software missing version info (no inventory) | The "Install details" copy matches the Figma copy for packages with no version information |

### SW-FMA-017 — 1Password (universal macOS package) installs and uninstalls on both Apple Silicon and Intel

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

### SW-FMA-018 — Apple Silicon-only FMA does not auto-install on Intel Macs

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** An Apple Silicon (Arm)-only Fleet-maintained app available; one enrolled Arm Mac and one enrolled Intel (x86) Mac, neither having the app installed.
- **Source:** #27392, #25499

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add the Arm-only FMA and enable auto-install | Auto-install policy is created |
| 2 | Refetch vitals on the x86 Mac | Policy passes on the x86 host (no install attempted) |
| 3 | Refetch vitals on the Arm Mac | Policy fails and an install is triggered on the Arm host |

### SW-FMA-019 — 1Password Windows FMA full install, auto-install, reinstall, and uninstall lifecycle

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

### SW-FMA-020 — Host vitals refetch is queued only after a successful software install

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** An MDM-enabled macOS host plus Windows/Linux hosts; VPP, FMA, and custom package installers available; ability to force install failures.
- **Source:** #30035, #27983

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Queue a VPP install that fails on an MDM macOS host | The failed VPP install does NOT trigger a host vitals refetch |
| 2 | Queue a VPP install that succeeds | The successful VPP install triggers a host vitals refetch |
| 3 | Queue a failing FMA/custom package install on macOS/Linux/Windows | The failed install does NOT trigger a refetch |
| 4 | Queue a succeeding FMA/custom package install | The successful install triggers a refetch |
| 5 | Trigger a successful install while a refetch is already pending | No additional refetch is stacked on top of the pending one |
| 6 | Add team policies with software-install automations and refetch vitals | Each failed policy triggers its install; after each install succeeds, the policy flips to "passed" |

### SW-FMA-021 — Setup Experience installs apps and updates the host record without adverse refetch effects

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS
- **Preconditions:** An ADE-capable Mac in the correct MDM token in Apple Business Manager; several VPP, FMA, and custom package items added to the team's Setup Experience software.
- **Source:** #30035

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Wipe the host and run through Setup Experience | Setup Experience completes successfully |
| 2 | Observe the host record during Setup Experience | The host record is updated with apps that installed successfully |
| 3 | Observe behavior across the multiple installs/refetches | No adverse effects are seen from the multiple host vitals refetches during the process |

### SW-FMA-022 — Self-service software installs retry and report every result to the activity feed

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Self-service software available across all platforms and types (FMA, custom packages, VPP); ability to create an installer that fails or randomly fails via modified install/post-install scripts.
- **Source:** #34068, #27983

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Install self-service software on each platform and each type | Installs succeed with no regressions to normal install behavior |
| 2 | Add a failing/randomly-failing installer to self-service and install it | Retries occur per the feature; every result (success or failure) appears in the activity feed |

### SW-FMA-023 — FMA version freezing prevents manifest updates for frozen apps

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | Windows
- **Preconditions:** A local checkout of the `fleet` repo at a commit old enough that some FMAs are out of date; Go toolchain available.
- **Source:** #29218

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add `frozen: true` to the input file of a macOS FMA and a Windows FMA that would normally update, then run `go run cmd/maintained-apps/main.go` | The frozen apps' output files are not modified while other apps' output files are updated |
| 2 | Delete the frozen apps' output files and re-run `go run cmd/maintained-apps/main.go` | The frozen apps' output files are recreated with current version data (matching Homebrew/WinGet) |

### SW-FMA-024 — Manual (un)install scripts can be specified for Homebrew-based FMAs

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** A local `fleet` checkout following `ee/maintained-apps/README.md`; an existing Homebrew-based FMA input file editable; ability to run the app ingest script and add the app via Fleet.
- **Source:** #30780

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Create manual install and uninstall scripts, reference them in the FMA input file, run the ingest script, and add the app via Fleet | The specified install and uninstall scripts are imported alongside the package |
| 2 | Set the new uninstall script field together with the existing pre- and post-uninstall script fields and run ingestion | Ingestion fails because the uninstall script field is mutually exclusive with the pre/post uninstall script fields |

### SW-FMA-025 — FMA apps with version numbers in inventory names install and uninstall (no name match expected)

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** An enrolled host; an FMA whose inventory name embeds a version number.
- **Source:** #27791

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add the FMA, install it on the host, then refetch vitals | The app installs and appears in inventory |
| 2 | Compare the inventory title (name-including-version) to the FMA package name | The names do NOT match (expected at this stage, since the package name falls out of date with the version-bearing inventory name) |
| 3 | Uninstall the app via Fleet and refetch vitals | The app uninstalls successfully and is removed from inventory |

### SW-FMA-026 — Windows FMA apps with type/architecture/locale in inventory names match package naming

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Windows
- **Preconditions:** An enrolled Windows host; a Windows FMA whose inventory name includes installer type/architecture/locale (e.g., Acrobat Reader, Figma, Firefox, Slack, Zoom).
- **Source:** #27792

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add the Windows FMA, install it, then refetch vitals | The app installs and appears in inventory |
| 2 | Compare the inventory name to the FMA package name | The names DO match between inventory and package naming at this stage |
| 3 | Uninstall the app via Fleet and refetch vitals | The app uninstalls successfully and is removed from inventory |

### SW-FMA-027 — Add software flow drops auto-install/self-service/targets for all package types

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

### SW-FMA-028 — Add software Fleet-maintained tab supports app/platform filters and pagination

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

### SW-FMA-029 — Better error message for unrecognized Fleet-maintained app slug via YAML

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** GitOps/YAML access to declare a Fleet-maintained app by slug.
- **Source:** #38102

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Apply a YAML config referencing an FMA with a non-existent or misspelled slug | The new, clearer "Unrecognized Fleet-maintained app" error message is returned |

### SW-FMA-030 — Custom scope "Labels include all" for software install scoping

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

## App Store apps (VPP)

### SW-VPP-001 — Add a VPP app with Self-service and Automatic install enabled

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

### SW-VPP-002 — Block deleting a VPP app until its automatic-install policy is removed

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** A VPP app was added with **Automatic install** enabled (its "[Install software]" policy exists).
- **Source:** #23744

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the app's **Software title** page and choose **Actions > Delete** | Deletion is blocked while the automatic-install policy still exists; you are directed to delete the policy first |
| 2 | Delete the "[Install software] `<App store app name>`" policy, then retry **Actions > Delete** on the software title | The software is deleted successfully |

### SW-VPP-003 — Automatic install completes and status surfaces in Self-service and Host details

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

### SW-VPP-004 — Target a VPP app to a custom label

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | iOS/iPadOS
- **Preconditions:** A VPP token is connected.
- **Source:** #23744

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to **Software > Add software > App store (VPP)**, select an app, and choose **Custom** under **Target** without selecting a label | **Add software** is disabled |
| 2 | With **Custom** selected on an instance that has no labels in Fleet | An easy-to-understand empty state is shown under **Target** |
| 3 | Select at least one label, then click **Add software** | The app is added scoped to the selected label(s) |

### SW-VPP-005 — iOS/iPadOS apps cannot use Self-service or Automatic install

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

### SW-VPP-006 — Self-service and Automatic install options appear for Fleet-maintained apps and custom packages

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** A team is selected on the Software page.
- **Source:** #23744

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to **Software > Add software > Fleet-maintained** and select an app | **Self-service** and **Automatic install** options appear |
| 2 | Choose **Custom** under **Target** without selecting a label | **Add software** is disabled |
| 3 | Go to **Software > Add software > Custom package** before uploading a package | **Add software** and **Advanced options** are disabled; **Self-service** and **Automatic install** options appear once a package is uploaded |

### SW-VPP-007 — Add, delete, and add FMA via the API

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

### SW-VPP-008 — VPP app created_at timestamp tracks most recent add to a team

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** A VPP token is connected; API access to inspect timestamps.
- **Source:** #23744

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add a VPP app to a team and inspect its `created_at` | `created_at` reflects when the app was added to the team |
| 2 | Delete the VPP app from the team, then re-add it | The team `created_at` is updated and differs from the value in the `vpp_apps` table (it reflects the most recent add) |

### SW-VPP-009 — App Store app version auto-updates to latest from the App Store

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** A VPP token is connected; a VPP app (e.g. Canva for macOS) has been added.
- **Source:** #23744, #32461

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the **Software title** page for an added VPP app | The version displayed matches the current latest version of the app on the App Store |
| 2 | Wait for the hourly Apple metadata refresh and re-check | The Fleet version matches what is installed on the host and what is available on the App Store (version fetched via the new Apple API every hour) |

### SW-VPP-010 — Uninstall a VPP app from Host details and revoke its license

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

### SW-VPP-011 — Cancel a pending VPP uninstall

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** A VPP uninstall is in the "Uninstall (pending)" state on a host.
- **Source:** #25497

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On **Host details > Activity > Upcoming**, cancel the pending uninstall action | The uninstall is cancelled and the pending action is removed |

### SW-VPP-012 — VPP uninstall blocked or fails with clear errors (no license, expired token, MDM off, unmanaged app)

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

### SW-VPP-013 — Revoke VPP license when a pending install command is cancelled

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

### SW-VPP-014 — Surface VPP automatic-install failure when MDM is off

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

### SW-VPP-015 — Surface VPP install failure when no licenses are available

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

### SW-VPP-016 — VPP install failure activity items only fire for VPP-associated install policies

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

### SW-VPP-017 — Self-service VPP install blocked when MDM off or out of licenses

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

### SW-VPP-018 — Verify VPP install status resolves correctly across delayed, failed, and successful installs

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

### SW-VPP-019 — VPP apps in setup experience are verified before being marked installed

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Several App Store (VPP) apps are added to the setup experience; a host going through setup.
- **Source:** #28738

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add several VPP apps to the setup experience and run a host through setup | Each VPP app is confirmed actually installed before it is marked as successfully installed |

### SW-VPP-020 — End user uninstalls non-App-Store software from Self-service

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

### SW-VPP-021 — Improved VPP install-failure copy for verify timeout on large apps

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** A large VPP app (e.g. Keynote) available in Self-service; ability to throttle the connection; `FLEET_SERVER_VPP_VERIFY_TIMEOUT` configured.
- **Source:** #39066

| # | Step | Expected result |
|---|------|-----------------|
| 1 | From **My device > Self-service**, start the VPP app install and throttle the connection (e.g. Network Link Conditioner) until the VPP verify timeout triggers | The install is marked **Failed** due to VPP verify timeout |
| 2 | Open **Install details** from the **Failed** status in **My device > Self-service** | Timeout-specific copy is shown; host display name is omitted; the timeout reflects `FLEET_SERVER_VPP_VERIFY_TIMEOUT`; the refetch follow-up sentence is shown; the stale-uninstall sentence is not shown |
| 3 | Open **Install details** for the same failed app under **Hosts > [host] > Software > Library** | Timeout-specific copy is shown including the host display name and the refetch follow-up sentence, without the stale-uninstall sentence |
| 4 | Reproduce a non-timeout VPP install failure and open **Install details** | Generic failure copy is shown (not the timeout-specific copy), and the stale-uninstall sentence is not shown |

### SW-VPP-022 — Custom App Store (VPP) apps: add, edit, delete, and install

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

### SW-VPP-023 — VPP server connects directly to Apple metadata API when bearer token is set

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

### SW-VPP-024 — Custom software icon overrides the VPP app icon in versions and vulnerabilities views

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

## In-house apps (.ipa / enterprise)

### SW-IPA-001 — Install an in-house (.ipa) app on an iOS/iPadOS host without CloudFront signing configured

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

### SW-IPA-002 — Install an in-house (.ipa) app on an iOS/iPadOS host with CloudFront signing configured

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

### SW-IPA-003 — Signed CloudFront .ipa URL is device-scoped and rejects reuse from another device

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

### SW-AND-001 — Add an Android app and install it via self-service

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

### SW-AND-002 — Set Android app managedConfiguration via API and verify settings apply on install

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

### SW-AND-003 — Set Android workProfileWidgets via API and verify the widget appears

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Android
- **Preconditions:** App supporting work-profile widgets (e.g. Google Calendar) added to a team; Android host enrolled to that team; API access.
- **Source:** #30836

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Using Fleet's API, add a valid `"workProfileWidgets"` value for the app. | API accepts the configuration. |
| 2 | Install the app via self-service and add its widget in the work profile. | The app's work-profile widget (e.g. Google Calendar) is available and shows up in the work profile. |

### SW-AND-004 — Editing an installed Android app's configuration updates settings without reinstalling

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

### SW-AND-005 — Failed Android configuration update shows Failed status

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Android
- **Preconditions:** Android app installed on an enrolled host; ability to push a policy/configuration that will be rejected.
- **Source:** #30836

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Apply a configuration update that causes the Android policy configuration to fail (e.g. an invalid policy value). | Configuration update is sent. |
| 2 | View the Software title page and the Host details page. | Install status shows "Failed" on both pages. |

### SW-AND-006 — Reject unsupported top-level keys in Android app configuration

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Android
- **Preconditions:** Android app added to a team; API access.
- **Source:** #30836

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Submit a configuration JSON containing a top-level key other than `"managedConfiguration"` or `"workProfileWidgets"`. | Update is rejected with error: `Couldn't update configuration. Only "managedConfiguration" and "workProfileWidgets" are supported as top-level keys.` |

### SW-AND-007 — Reject invalid JSON in Android app configuration

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Android
- **Preconditions:** Android app added to a team; API access.
- **Source:** #30836

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Submit malformed/invalid JSON as the app configuration. | Update is rejected with error: `Couldn't update configuration. Invalid JSON.` |

### SW-AND-008 — Transferring an Android host between teams does not carry over apps or configuration

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

### SW-AND-009 — GitOps leaves existing Android app configuration unchanged

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Android
- **Preconditions:** Android app with a non-empty configuration already added to a team via API; GitOps configured for that team.
- **Source:** #30836

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add an Android app with configuration to a team via the API. | App and configuration are saved. |
| 2 | Apply the same app via `fleetctl gitops` (configuration is not yet expressible in the GitOps YAML). | GitOps run succeeds. |
| 3 | Inspect the app's configuration after the GitOps run. | The previously set configuration is left as-is (not removed). |

### SW-AND-010 — Add Android software to setup experience and log the edit activity

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** Team with managed Google Play connected; Android app available to add.
- **Source:** #33761

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add an Android app to the team's setup experience software. | App is added to setup experience. |
| 2 | Open the global activity feed. | An activity is logged showing setup experience software was edited for Android. |

### SW-AND-011 — Add Android setup-experience software via API and platform validation

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Android
- **Preconditions:** Team with managed Google Play connected; API access.
- **Source:** #33761

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Via the API, add setup experience software with `platform` set to `"android"`. | Software is added as Android setup experience software. |
| 2 | Via the API, try to delete the software that is selected for setup experience. | Deletion behaves as designed (the API responds rather than leaving the host in a broken state). |
| 3 | Via the API, add setup experience software with `platform` set to an unsupported/made-up value. | Request is rejected with a clear, easy-to-understand error message. |

### SW-AND-012 — Android BYOD setup-experience app auto-installs on enrollment

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** Android
- **Preconditions:** Team with an Android app configured as setup experience software; enrollment (/enroll) URL available from the "Add hosts" modal.
- **Source:** #33761, #36859

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On a personally-owned (BYOD) Android device, manually enroll using the /enroll URL from the "Add hosts" modal. | Device enrolls and the work profile is created. |
| 2 | Wait for enrollment to complete. | The setup experience app is automatically installed in the work profile. |
| 3 | On the Software title page, check the Installed count; check the host's inventory. | App appears in the host's software inventory and the "Installed" count is incremented on the Software title page. Note: software library is not supported for Android, so status surfaces via inventory and the title page count. |

### SW-AND-013 — End user can remove a preinstalled setup-experience app from the work profile

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Android
- **Preconditions:** Android BYOD host enrolled with a setup-experience app installed (InstallType PREINSTALLED).
- **Source:** #33761

| # | Step | Expected result |
|---|------|-----------------|
| 1 | As the end user, remove the setup-experience app from the work profile. | The app can be removed by the end user (consistent with the `PREINSTALLED` install type). |

### SW-AND-014 — Android setup-experience app shows Pending when host is offline during enrollment

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Android
- **Preconditions:** Team with an Android app configured as setup experience software; /enroll URL available.
- **Source:** #33761

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Manually enroll a BYOD Android host via the /enroll URL, then immediately switch off the host's internet connection. | Host enrolls but the install cannot complete. |
| 2 | On the Software title page, check the Pending count. | The "Pending" count is incremented on the Software title page. Note: software library is not supported for Android, so status surfaces via the title page count. |

### SW-AND-015 — Unenroll and re-enroll reinstalls Android setup-experience software

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** Android host enrolled to a team with setup experience software; the app currently installed.
- **Source:** #33761

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Unenroll the Android host from Fleet by removing the work profile. | Host is unenrolled and the work profile (and its apps) is removed. |
| 2 | Re-enroll the same Android host to the same team. | The setup experience software is installed again on re-enrollment. |

### SW-AND-016 — GitOps ignores Android setup-experience software

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Android
- **Preconditions:** Team with Android setup experience software configured; fleetctl GitOps access.
- **Source:** #33761

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Run `fleetctl generate-gitops` for a team that has Android setup experience software. | Android setup experience software is not generated into the GitOps output. |
| 2 | Run `fleetctl gitops` with that configuration. | Android setup experience software is ignored (GitOps support is deferred to a future story). |

### SW-AND-017 — Deleting an Android app removes it from managed Google Play and uninstalls it from hosts

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

### SW-AND-018 — Re-enrolling after deletion does not reinstall the removed Android app

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

### SW-AND-019 — Delete-software confirmation modal shows updated copy

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Android
- **Preconditions:** A software title (Android app, or any other app/package) present on a team; access to the Software title page. Design: Figma available.
- **Source:** #36859

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the Software title page, choose to delete an Android app (or any other app/package). | The delete confirmation modal opens with the updated copy matching the Figma design. |

### SW-AND-020 — Deploy an Android web app (web clip) immediately after creation

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

### SW-AND-021 — iOS/iPadOS self-service works with Web Clip URL/UDID auth

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** iOS/iPadOS
- **Preconditions:** iOS or iPadOS host enrolled; self-service available on the team (per #32247). Note: this validates iOS self-service auth, adjacent to the Android self-service work.
- **Source:** #36542, #32247

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Set up the appropriate Web Clip profile and deploy it to an iOS or iPadOS host. | The Web Clip profile is delivered and the self-service web clip is available on the device. |
| 2 | Use the self-service web clip and exercise the self-service functionality from #32247 with no infrastructure modifications. | All self-service functionality works end to end via the Web Clip URL/UDID authentication, with no infrastructure changes required. |

## Custom packages & scripts

### SW-PKG-001 — Software detail page surfaces versions, policies, and status

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

### SW-PKG-002 — Software version list paginates beyond 10 versions

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

### SW-PKG-003 — Software title truncates and shows tooltip at narrow widths

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** A software title with a long name on the software detail page.
- **Source:** #26894

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the software detail page for a long-named title and shrink the browser to a narrow width. | The software title truncates to leave room for the timestamp and "View all hosts". |
| 2 | Hover over the truncated software name. | A tooltip displays the full software name. |

### SW-PKG-004 — Enable auto-install policy on an existing installer

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

### SW-PKG-005 — Auto-install policy triggers install on a compatible host

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Auto-install enabled (All hosts) for a software title; an enrolled host compatible with the software that does not yet have it installed.
- **Source:** #28060

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the compatible host that lacks the software, refetch host vitals. | The auto-install policy reports as failing for that host. |
| 2 | Open the host detail page. | An upcoming activity item indicates the pending software install. |
| 3 | Wait for the software to install, then refetch host vitals. | The software shows as installed and the policy now passes. |
| 4 | Refetch host vitals again with the software still installed. | The software does not attempt to reinstall. |
| 5 | Uninstall/delete the software from the host, then refetch host vitals. | The software attempts to re-install via the auto-install policy. |

### SW-PKG-006 — Disable auto-install policy and confirm removal

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

### SW-PKG-007 — Auto-install disabled for .exe installers

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Windows
- **Preconditions:** A software title with an .exe installer attached.
- **Source:** #28060

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to the software title page for the .exe installer. | The page loads with the installer section. |
| 2 | Open the Actions menu and locate Auto-install. | The Auto-install action is disabled and shows a tooltip explaining why it is unavailable for .exe installers. |

### SW-PKG-008 — Copy installer SHA256 hash from the UI

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

### SW-PKG-009 — SHA256 copy available to all software-viewing roles and in GitOps mode

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

### SW-PKG-010 — Run script disabled with tooltip when scripts_disabled is true

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

### SW-PKG-011 — Run script enabled with no tooltip when scripts_disabled is false

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Server configured with `scripts_disabled: false`. An enrolled host. Logged in as a user able to view host details.
- **Source:** #33903

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open a host's details page and open the Actions menu. | The "Run script" action is enabled. |
| 2 | Hover over the "Run script" action. | No disabled-feature tooltip is shown. |

### SW-PKG-012 — Upload and install a package up to 10 GB

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** A team in Fleet and an enrolled macOS host. A valid installer package whose size is large (multiple GB, up to the 10 GB limit).
- **Source:** #37464

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In Software, add the large package (up to 10 GB) to the team. | The upload completes successfully without timing out; the package appears in the team's software. |
| 2 | Install the package on the enrolled macOS host via Fleet. | The install runs and the software reports as installed on the host. |

### SW-PKG-013 — Oversized package upload over 10 GB shows clear error

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** A team in Fleet. An installer package larger than 10 GB.
- **Source:** #37464

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Attempt to add a package larger than 10 GB. | The upload is rejected with an easy-to-understand error message stating the file exceeds the size limit. |
| 2 | Observe upload timeout behavior during a long large-file upload. | Timeout mechanisms do not prematurely interrupt a valid in-progress upload flow. |

### SW-PKG-014 — Software installer upload/download works with GCS IAM authentication

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet server started with `s3_software_installers_gcs_iam_auth=true`, `s3_software_installers_endpoint_url=https://storage.googleapis.com`, a configured GCS bucket, valid ADC credentials in the runtime environment, and no HMAC keys set. (Server-config only; no UI changes. Reference baseline: PR #40374, env test-gcp-gcs.dogfood.fleetdm.com.)
- **Source:** #44861

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Boot the Fleet server with the GCS IAM auth configuration above. | The server starts successfully. |
| 2 | Upload a `.pkg` software installer to Fleet. | The upload completes and is stored in GCS. |
| 3 | Download the same installer back from Fleet. | The download succeeds end-to-end. |
| 4 | Run a long-running upload that crosses the ADC token TTL boundary. | Token refresh occurs and the upload still completes successfully. |
| 5 | Boot with `s3_software_installers_force_s3_path_style=true` together with `gcs_iam_auth=true`, then upload and download. | Path-style addressing works for software installers. |

### SW-PKG-015 — Carve upload/download works with GCS IAM authentication

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Fleet server started with `s3_carves_gcs_iam_auth=true`, `s3_carves_endpoint_url=https://storage.googleapis.com`, a configured GCS bucket, valid ADC credentials, and no HMAC keys set.
- **Source:** #44861

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Boot the Fleet server with the carves GCS IAM auth configuration. | The server starts successfully. |
| 2 | Perform a carve so its data uploads to GCS, then download it. | Carve upload and download succeed end-to-end. |
| 3 | Boot with `s3_carves_force_s3_path_style=true` together with `gcs_iam_auth=true`, then carve and download. | Path-style addressing works for carves. |

### SW-PKG-016 — Fleet refuses to start on invalid GCS IAM auth configuration

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Ability to boot the Fleet server with custom config flags for software installers and carves.
- **Source:** #44861

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Start the server with `s3_software_installers_gcs_iam_auth=true` combined with any of `s3_software_installers_access_key_id`, `s3_software_installers_secret_access_key`, or `s3_software_installers_sts_assume_role_arn`. | The server fails to start with a clear, actionable error. |
| 2 | Start with `s3_software_installers_gcs_iam_auth=true` but with `s3_software_installers_endpoint_url` empty or not pointing at storage.googleapis.com (e.g. https://s3.amazonaws.com). | The server fails to start with a clear, actionable error rejecting the non-GCS host. |
| 3 | Repeat the equivalent invalid combinations for `s3_carves_gcs_iam_auth` (HMAC/STS keys present, or endpoint empty/non-GCS). | The server fails to start with a clear, actionable error in each carves case. |
| 4 | Start with `gcs_iam_auth=true` but no ADC credentials present in the runtime environment. | A clean, actionable error is returned (no panic and no silent fallback to anonymous credentials). |

### SW-PKG-017 — Existing S3/HMAC and CloudFront paths still work with GCS IAM auth off

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet server configurable for AWS S3 with HMAC keys and CloudFront signing for software installers and carves.
- **Source:** #44861

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Boot with `s3_software_installers_gcs_iam_auth=false` (or unset) using HMAC keys and AWS S3, then upload and download an installer. | The existing HMAC + AWS S3 path for software installers still works. |
| 2 | With the CloudFront signing path configured alongside `s3_software_installers_gcs_iam_auth=false`, exercise a download. | CloudFront signing is unaffected and continues to work. |
| 3 | Boot with `s3_carves_gcs_iam_auth=false` (or unset) using HMAC keys and AWS S3, then upload and download a carve. | The existing HMAC + AWS S3 path for carves still works. |

### SW-PKG-018 — GCS IAM auth keys excluded from GitOps generate and apply

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Access to fleetctl `generate-gitops` and `gitops` commands.
- **Source:** #44861

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Run `generate-gitops` and inspect the output. | Neither `s3_software_installers_gcs_iam_auth` nor `s3_carves_gcs_iam_auth` is emitted (these are infra config, not app config). |
| 2 | Run `gitops` apply against config and verify these keys are not consumed. | The GitOps apply does not consume the GCS IAM auth keys. |

## Self-service

### SW-SS-001 — Install a self-service app shows progress and reaches Installed

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

### SW-SS-002 — Self-service install initiated from Host details reflects on the Self-service page

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** A host enrolled with Fleet Desktop, on a team that has a self-service app targeting this host. Admin has access to the host's Host details page.
- **Source:** #26691

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the host's Host details > Software, trigger an install of the self-service app | Install is queued for the host |
| 2 | Quickly open Fleet Desktop > Self-service on that host | The same app shows the "Installing" spinner state, reflecting the in-progress install started from Host details |

### SW-SS-003 — Failed self-service install shows Failed status and opens install details

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** A self-service app whose install script is intentionally broken so the install will fail, targeting an enrolled host. End user is on Fleet Desktop > Self-service.
- **Source:** #26691

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Click "Install" on the app with the failing install script and wait for it to finish | Status is shown as "Failed" |
| 2 | Click the "Failed" status | A modal opens showing the install details, matching the install-details modal shown on the activity feed |

### SW-SS-004 — Update action appears and runs when a newer version is detected

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

### SW-SS-005 — Self-service action layout: main action button with Uninstall and How to open under More

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

### SW-SS-006 — How to open modal appears only for installed apps/programs software

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

### SW-SS-007 — Search on Self-service shows spinner and preserves card grid widths

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** A self-service catalog with multiple apps available to the host. End user is on Fleet Desktop > Self-service.
- **Source:** #26691

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Type a query into the Self-service search field | A spinner is shown on the page while results load |
| 2 | Wait for results to render | Result cards keep the width they would have had in the grid: 3 columns above 990px, 2 columns from 768px to 990px |

### SW-SS-008 — Self-service pagination toggles on app count

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Ability to scope fewer than 30 and more than 30 self-service apps to a host. End user is on Fleet Desktop > Self-service.
- **Source:** #26691

| # | Step | Expected result |
|---|------|-----------------|
| 1 | View Self-service when fewer than 30 apps are available | Pagination controls are hidden |
| 2 | View Self-service when more than 30 apps are available | Pagination controls are displayed |

### SW-SS-009 — Software list tooltips describe self-service and policy-triggered installs

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** On a team's /software/titles page, installer-package titles configured in the following states exist: self-service only; automatic install with one policy; automatic install with multiple policies; automatic install with one policy plus self-service; automatic install with multiple policies plus self-service; available for install only.
- **Source:** #28054

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Hover the install-indicator icon for a self-service-only title | Tooltip reads "End users can install from Fleet Desktop > Self-service" |
| 2 | Hover the icon for an automatic-install title with one associated policy | Tooltip reads "A policy triggers install" |
| 3 | Hover the icon for an automatic-install title with more than one policy | Tooltip reads "X policies trigger install." where X is the number of associated policies |
| 4 | Hover the icon for an automatic-install title with one policy plus self-service | Tooltip reads "A policy triggers install. End users can reinstall from Fleet Desktop > Self-service" |
| 5 | Hover the icon for an automatic-install title with more than one policy plus self-service | Tooltip reads "X policies trigger install. End users can reinstall from Fleet Desktop > Self-service" where X is the number of associated policies |
| 6 | Hover the icon for an available-for-install-only title | Tooltip reads "Software can be installed on the Host details page" |

### SW-SS-010 — Enable self-service for an installer via Actions > Self-service modal

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** All
- **Preconditions:** A software title with an installer package uploaded and self-service NOT enabled. Admin is on /software/titles/:id. Note: self-service management was moved out of the Edit software modal into its own Actions > Self-service modal; the Edit modal no longer exposes self-service options.
- **Source:** #28061, #28058

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Click Actions > Self-service | The Self-service modal appears with the toggle set to "Disabled" |
| 2 | Toggle the switch to the enabled position | Target and categories options appear; selecting "Custom" target reveals a scrollable labels list and the modal height adjusts to fit |
| 3 | Set Target to "All hosts" and click Save | A success flash message appears and the user is returned to /software/titles/:id; the Self-service pill is shown for the title |
| 4 | On a compatible host on the team, open Fleet Desktop > Self-service | The app is available to install in Self-service on all compatible hosts on the team |

### SW-SS-011 — Edit self-service targets and disable via the Self-service modal

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

### SW-SS-012 — Self-service custom label targeting controls host availability

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A self-service-enabled installer on a team with multiple compatible hosts, some carrying specific labels. Admin is on the title's Self-service modal.
- **Source:** #28058, #28061

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Set Target to "Custom", choose "Include any", select one or more labels, and Save | Only compatible team hosts that have the selected labels show the app in Self-service |
| 2 | Reopen the modal, set Target to "Custom", choose "Exclude any", select one or more labels, and Save | Only compatible team hosts that do NOT have the selected labels show the app in Self-service |

### SW-SS-013 — Swap installer version via Save changes modal

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

### SW-SS-014 — Deleting an installer removes its install automations

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A software title with an installer package that has at least one custom policy configured with an "install software" automation pointing at this installer, plus any Fleet-maintained policies. Admin is on /software/titles/:id.
- **Source:** #28061

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Click the trash icon to delete the software installer | The Delete modal appears |
| 2 | Click Delete | A success flash appears and the user returns to /software/titles/:id |
| 3 | Review the team's policies table | Fleet-maintained policies associated with the installer are deleted; custom policies no longer appear with the install-software automation, and that automation is disabled (not merely unset) |

### SW-SS-015 — Add a script-only custom package (.sh / .ps1) via the UI

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

### SW-SS-016 — Edit a script-only package and change its file type

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

### SW-SS-017 — Add a script-only package via the API with unsupported-parameter and Free handling

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

### SW-SS-018 — Script-only packages are exported cleanly by fleetctl generate-gitops

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Linux | Windows
- **Preconditions:** A team with `.sh` and `.ps1` script-only packages configured. `fleetctl` available and authenticated.
- **Source:** #31719

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Run `fleetctl generate-gitops` for the team | The `.sh` and `.ps1` script packages are included in the generated YAML |
| 2 | Inspect the generated YAML for those packages | No `install_script` field is emitted for the script packages, even though `install_script` is used under the hood |

### SW-SS-019 — Run and self-serve a script-only package on Windows and Linux

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

### SW-SS-020 — Script-only packages run with script execution disabled and are available to policy automations

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Windows | Linux
- **Preconditions:** A team with `.sh`/`.ps1` script-only packages and the "Disable script execution features" setting enabled. Windows and Linux hosts enrolled.
- **Source:** #31719

| # | Step | Expected result |
|---|------|-----------------|
| 1 | With "Disable script execution features" enabled, run a script package against a host | The script package still runs (it is not blocked by the script-execution disable setting) |
| 2 | Configure a policy automation and open the install-software selection for a Windows/Linux policy | The script packages are selectable as install-software targets for Windows/Linux |

### SW-SS-021 — Linux .deb/.rpm software shows per-location Last opened time

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

## Setup experience

### SW-SETUP-001 — Setup experience entry point reflects whether software is selected

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Logged in as a maintainer/admin; on a team (or "No team") in Controls.
- **Source:** #24989

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to Controls > Setup experience for a team that has no setup-experience software selected. | An "Add software" button is shown. |
| 2 | Select software, save, then return to Controls > Setup experience. | The button now reads "Show selected software" instead of "Add software". |

### SW-SETUP-002 — Setup experience software modal shows scoping copy and columns

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Logged in as a maintainer/admin; on Controls > Setup experience for a team with software available to add.
- **Source:** #24989

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Click "Add software" (or "Show selected software"). | A modal opens with the copy "Software will be installed on targeted hosts. To manage targets, click on software to edit it." |
| 2 | Inspect the software table headers in the modal. | Columns are "Name", "Platform", and "Target". |
| 3 | Inspect the Target value for each software item. | Target shows either "All hosts" or "Custom". |

### SW-SETUP-003 — Select-all checkbox toggles all software and keeps headers

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Setup experience software modal is open with multiple software items listed.
- **Source:** #24989

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Click the select-all checkbox in the table header. | Every software item's checkbox becomes checked; the column headers remain visible. |
| 2 | Click the select-all checkbox again. | All checkboxes are cleared; the column headers remain visible. |

### SW-SETUP-004 — Custom target tooltip shows label scoping details

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Setup experience software modal is open and contains at least one software item whose Target is "Custom" (label-scoped). At least one item is scoped to more than 3 labels.
- **Source:** #24989

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Hover over the "Custom" Target value for a label-scoped software item. | A tooltip shows the scoping mode (Include any / Exclude any) and the first 3 labels. |
| 2 | Hover over the "Custom" Target for an item scoped to more than 3 labels. | The tooltip lists the first 3 labels followed by "+x more". |

### SW-SETUP-005 — Clicking a software row opens the software details page

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Setup experience software modal is open with at least one software item.
- **Source:** #24989

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Click a software name/row in the modal. | The user is taken to that software's details page, where targets can be edited. |

### SW-SETUP-006 — Setup experience installs label-scoped software only on in-scope hosts (manual label)

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS
- **Preconditions:** ABM connected with devices added but not yet enrolled. A manual label exists; a setup-experience software item is scoped to that manual label. One target host is in scope (has the label) and one is out of scope.
- **Source:** #24989

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Apply the manual label to the in-scope host. | The host is a member of the label. |
| 2 | Enroll both hosts and let them run through the setup experience. | The in-scope host installs the scoped software; the out-of-scope host does not install it. |

### SW-SETUP-007 — Setup experience installs label-scoped software only on in-scope hosts (dynamic label)

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS
- **Preconditions:** ABM connected with devices added but not yet enrolled. A dynamic label exists; a setup-experience software item is scoped to that dynamic label. One target host will match the dynamic query and one will not.
- **Source:** #24989

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enroll both hosts and let the dynamic label resolve, then run through the setup experience. | The host matching the dynamic label installs the scoped software; the non-matching host does not. |
| 2 | Confirm timing of the install relative to label resolution. | Software install begins only after the dynamic label has been evaluated, so scoping is applied consistently (no race where install precedes label processing). |

### SW-SETUP-008 — Upgrade preserves label scoping on existing setup-experience software

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** A pre-upgrade Fleet instance where setup experience already includes software that has label scoping applied. A host exists that is outside the scoped label.
- **Source:** #24989

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Upgrade Fleet to the version supporting label scoping. | Existing setup-experience software retains its label scoping. |
| 2 | Run the out-of-scope host through the setup experience. | The scoped software is not installed on the out-of-scope host. |

### SW-SETUP-009 — GitOps applies setup_experience software with label scoping

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** GitOps configured for the repo/team. A macOS software item is defined with setup_experience and label scoping in the team YAML.
- **Source:** #24989

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add the software to setup_experience in the team YAML with the desired labels and run GitOps apply. | GitOps succeeds and the software appears in Setup experience scoped to the entered labels. |
| 2 | Enroll in-scope and out-of-scope hosts and run the setup experience. | Software installs only on hosts within the configured label scope. |

### SW-SETUP-010 — GitOps rejects setup_experience=true on a Windows or Linux package

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Windows, Linux
- **Preconditions:** GitOps configured. A Windows or Linux package is defined in the team YAML.
- **Source:** #24989

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Set setup_experience to true for a Windows or Linux package in the YAML and run GitOps apply. | Apply fails with an error indicating setup_experience software is only supported on macOS (not Windows/Linux). |

### SW-SETUP-011 — GitOps rejects setup_experience software combined with macos_setup.software

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** GitOps configured for a team.
- **Source:** #24989

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In the team YAML, set setup_experience to true for one or more software items while also defining macos_setup.software, then run GitOps apply. | Apply fails with an error indicating the two cannot both be configured (setup_experience software conflicts with macos_setup.software). |

## Other / misc

### SW-MISC-001 — Rename a software title with a bundle ID as global admin

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Logged in as a global admin. At least one software title in inventory has a bundle ID (e.g. a macOS app) and at least one has no bundle ID.
- **Source:** #26933

| # | Step | Expected result |
|---|------|-----------------|
| 1 | As global admin, call the software title name edit endpoint to change a title that has a bundle ID to a new valid, non-empty name | Request succeeds (HTTP 2xx) |
| 2 | Open the Software list view (Software > Titles) | The title displays under its new name |

### SW-MISC-002 — Software title rename endpoint rejects invalid requests

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

### SW-MISC-003 — Fleet Desktop "My device" opens transparency URL with no Secureframe branding by default

- **Tier:** Free
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Fleet Free server running without `FLEET_PARTNERSHIPS_ENABLE_SECUREFRAME` set (or set to `false`). A host enrolled with Fleet Desktop.
- **Source:** #27309

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the enrolled host, click Fleet Desktop > My device | Browser navigates to https://fleetdm.com/better with no Secureframe branding |
| 2 | Restart the server with `FLEET_PARTNERSHIPS_ENABLE_SECUREFRAME=false` and click Fleet Desktop > My device again | Still navigates to the transparency URL with no Secureframe branding |

### SW-MISC-004 — Fleet Desktop transparency URL shows Secureframe branding when partnership flag enabled

- **Tier:** Free
- **Priority:** P2
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Fleet Free server started with `FLEET_PARTNERSHIPS_ENABLE_SECUREFRAME=true`. A host enrolled with Fleet Desktop.
- **Source:** #27309

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the enrolled host, click Fleet Desktop > My device | Browser navigates to https://fleetdm.com/better?utm_content=secureframe and Secureframe branding is shown |
| 2 | Restart the server with `FLEET_PARTNERSHIPS_ENABLE_SECUREFRAME` set to an invalid value (anything other than `true`/`false`) | Server reports a clear, understandable error and does not start in a broken state |

### SW-MISC-005 — Premium custom transparency URL overrides Secureframe partnership URL

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Fleet Premium server started with `FLEET_PARTNERSHIPS_ENABLE_SECUREFRAME=true`. A host enrolled with Fleet Desktop.
- **Source:** #27309

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to Settings > Organization settings > Fleet Desktop and set a custom transparency URL | Custom URL is saved |
| 2 | On the enrolled host, click Fleet Desktop > My device | Browser navigates to the configured custom URL (the custom URL wins over the Secureframe partnership URL) |

### SW-MISC-006 — Add software from a software title detail page (Fleet Maintained App available)

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS
- **Preconditions:** Fleet Premium. A specific team selected. An enrolled host reporting a software title that is available as a Fleet Maintained App, has no installer package associated, and is not marked "Available to install".
- **Source:** #28051, #28060

| # | Step | Expected result |
|---|------|-----------------|
| 1 | From the host's Software tab, click the FMA-eligible software title | Software title detail page opens; host count below the name includes hosts that already have it installed; versions table shows per-version host counts; an "Add software" button is shown |
| 2 | Click "Add software" | An Add modal opens displaying the FMA installer package with copy and padding per design |
| 3 | Click "Show details" in the modal | Modal closes and the software details modal opens; closing the details modal reopens the Add software modal |
| 4 | Click "Add software" to confirm | Loading state appears and the "Add software" button is disabled while the app uploads |
| 5 | Wait for the upload to complete | You land on the software detail page, the package is shown, and a flash message confirms the package is now available |
| 6 | Review the page after the add | Installer information appears below the details/host-info section; status table shows " - - " initially, then Installed/Pending/Failed counts once scoping is applied; the "Add software" button is gone |

### SW-MISC-007 — Add software from a software title detail page (non-FMA title)

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Fleet Premium. A specific team selected. An enrolled host reporting a software title that is NOT available as an FMA, has no installer package, and is not "Available to install".
- **Source:** #28051

| # | Step | Expected result |
|---|------|-----------------|
| 1 | From the host's Software tab, click the non-FMA software title | Software title detail page opens with host count and per-version host counts; an "Add software" button is shown |
| 2 | Click "Add software" | You are taken to the /software/add page for the host's team |
| 3 | Complete the VPP or custom-package add flow (uploading a package, which may be for a different title than the one you started from) | On success you land on the software detail page for the title that was actually uploaded, with a flash message confirming it is now available |
| 4 | Review the resulting software detail page | Installer info appears below the details/host-info section; status table shows " - - " then Installed/Pending/Failed once scoping applies; any auto-install or Self-service options chosen appear as pills |

### SW-MISC-008 — Software installer actions (download, edit, delete) on the software detail page

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

### SW-MISC-009 — "Add software" button is disabled for Fleet Free and when "All teams" is selected

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A software title detail page (/software/titles/:id) with no associated installer package.
- **Source:** #28051

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On Fleet Free, open a software title page that has no associated installer package | The "Add software" button is greyed out; hovering shows a "Fleet Premium only" tooltip |
| 2 | On Fleet Premium, open the software title page and select "All teams" in the top dropdown | The "Add software" button is disabled; hovering shows the tooltip "Select a team to add software" |

### SW-MISC-010 — Software version rows do not link to "View all hosts"

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

### SW-MISC-011 — Add software is gated by "Manage in YAML" in GitOps mode

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Fleet Premium with GitOps mode enabled. A software title detail page.
- **Source:** #28051

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open a software title page with no installer and click "Add software" | The Add modal opens (so the app slug can be retrieved via "Show details"), but the modal's add button is disabled and shows "Manage in YAML" on hover |
| 2 | Open a software title page that already has an installer added | The pencil (edit) and trash (delete) icons in the installer section are disabled |

### SW-MISC-012 — Fleet stays enrolled and reports correct OS after upgrade to macOS/iOS/iPadOS 26

- **Tier:** Both
- **Priority:** P0
- **Platforms:** macOS | iOS/iPadOS
- **Preconditions:** A host enrolled in Fleet running a pre-26 OS, scheduled for upgrade to macOS 26, iOS 26, or iPadOS 26.
- **Source:** #30696

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Upgrade the enrolled host to OS version 26 (macOS/iOS/iPadOS) | Fleet remains installed/enrolled on the host after the upgrade |
| 2 | Check the Device page, Hosts list, and host info via API | The new OS version 26 is reflected in all three |

### SW-MISC-013 — Previously applied settings and labels remain correct after OS 26 upgrade

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

### SW-MISC-014 — View MDM command results in vertical (line) format with fleetctl

- **Tier:** Both
- **Priority:** P1
- **Platforms:** macOS | iOS/iPadOS
- **Preconditions:** fleetctl configured against a Fleet instance with MDM-enrolled hosts. At least one recent MDM command exists.
- **Source:** #31500, #31473

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Run `fleetctl get mdm-commands` and note a recent command ID | Recent MDM commands are listed with their IDs |
| 2 | Run `fleetctl get mdm-command-results --id <command_id>` | Result is printed vertically (one field per line: ID, TIME, TYPE, STATUS, HOSTNAME, PAYLOAD, RESULTS) instead of garbled tabular output |
| 3 | Run `fleetctl mdm run-command` against multiple hosts, then fetch results with the vertical command | Results for all targeted hosts are returned, each in the vertical format |

### SW-MISC-015 — MDM command results show pending message when no result received

- **Tier:** Both
- **Priority:** P2
- **Platforms:** macOS | iOS/iPadOS
- **Preconditions:** fleetctl configured against a Fleet instance with at least one MDM-enrolled host that can be taken offline.
- **Source:** #31500, #31473

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Turn Wi-Fi off on an MDM-enrolled host and send an MDM command to it | Command is queued |
| 2 | Run `fleetctl get mdm-command-results --id <command_id>` for that command | Output reads "No results received. Please check again later." |

### SW-MISC-016 — Location item hidden on Host details when GeoIP is not configured

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Fleet instance running without a `geoip.database_path` configured. macOS, Windows, Linux, and ChromeOS hosts enrolled.
- **Source:** #33509, #22801

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Host details for the macOS host and view the About section | No Location item is shown |
| 2 | Repeat for the Windows, Linux, and ChromeOS hosts | No Location item is shown for any of them |

### SW-MISC-017 — Location item shown on Host details when GeoIP database is configured

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Fleet instance configured with a valid MaxMind GeoIP database (`geoip.database_path`). macOS, Windows, Linux, and ChromeOS hosts enrolled.
- **Source:** #33509, #22801

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Host details for the macOS host and view the About section | A "Location" item is shown |
| 2 | Repeat for the Windows, Linux, and ChromeOS hosts | The Location item is shown for each |

### SW-MISC-018 — Show location of a company-owned iOS/iPadOS host

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** iOS/iPadOS
- **Preconditions:** Fleet Premium with a valid GeoIP database configured. A company-owned (ABM-enrolled) iOS/iPadOS host enrolled.
- **Source:** #33509, #35824, #39835

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Host details for the company-owned iOS/iPadOS host and view the About section | "Show location" appears in the About section |
| 2 | Click "Show location" | The Location modal opens showing the host's location with a working timestamp, plus Lock instructions and a Lock button |

### SW-MISC-019 — Location is hidden for personally-owned iOS/iPadOS hosts

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** iOS/iPadOS
- **Preconditions:** Fleet Premium with a valid GeoIP database configured. A personally-owned iOS/iPadOS host enrolled (manual or BYOD/personal enrollment).
- **Source:** #33509

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Host details for the personally-owned iOS/iPadOS host and view the About section | The Location / "Show location" item is hidden |

### SW-MISC-020 — Lock a company-owned iOS/iPadOS host from the Location modal

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

### SW-MISC-021 — Refetch and unlock behavior for company-owned iOS/iPadOS host location

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

### SW-MISC-022 — Usage statistics Save button disabled for Fleet Premium

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Logged in as admin on a Fleet Premium instance without the `allow_disable_telemetry` config set.
- **Source:** #34126

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to Settings > Usage statistics | The "Learn more" link is rendered inline within the paragraph (not on its own line) |
| 2 | Inspect the Save button | The Save button is disabled |

### SW-MISC-023 — Usage statistics Save button enabled for Fleet Free or with allow_disable_telemetry

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Logged in as admin on Fleet Free, OR on Fleet Premium with the `allow_disable_telemetry` config enabled.
- **Source:** #34126

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to Settings > Usage statistics | The "Learn more" link is rendered inline within the paragraph |
| 2 | Inspect the Save button | The Save button is enabled |

### SW-MISC-024 — Dashboard platform cards tile responsively across breakpoints

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Logged in with hosts enrolled across multiple platforms so the Dashboard platform cards are populated. Design reference exists in Figma.
- **Source:** #26356, #27065, #28230

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to the Dashboard | OS/platform copy and the platform cards render per the current design |
| 2 | Resize the viewport to 1280, 1024, 768, and 480 px widths | Columns and card layout reflow correctly at each breakpoint, accommodating all seven platforms with no overflow or clipping |
