# Security & Compliance — test cases

> Area: `#g-security-compliance`. Derived from Fleet feature-story test plans
> (oldest→newest, superseded behavior collapsed). GitOps flows live in
> [`gitops.md`](gitops.md). See [`README.md`](README.md) for method/template.
> **Live-verified 2026-06-27 (structure):** confirmed Software→Vulnerabilities tab, Controls→OS settings→Disk encryption, Settings→Integrations (Certificate authorities, Conditional access incl. end-user bypass toggle, Identity provider), Controls→Variables, and a real CIS policy in Policies. Host/integration-gated cases (cert issuance to hosts, NDES/SCEP, Okta/Entra round-trip, LUKS & recovery-lock on real hosts) were not walked — see each case's Preconditions.

## Software inventory & vulnerabilities

### SEC-SOFTWARE-001 — JetBrains IDE extensions appear in software inventory across platforms

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A macOS, Windows, and Linux host enrolled in Fleet, each with a supported JetBrains IDE (e.g. IntelliJ IDEA) installed and at least one IDE extension/plugin installed per the JetBrains plugin-management instructions.
- **Source:** #22463

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On an enrolled host with IntelliJ installed, install one or more IntelliJ extensions. | Extensions are installed in the IDE. |
| 2 | Refetch host vitals for the host (and confirm the data is also retrievable via a raw osquery live query). | Vitals refetch completes and the extension data is collected. |
| 3 | Navigate to the Software page. | The installed IntelliJ extensions appear as software titles. |
| 4 | Select "Show versions". | The IntelliJ extensions appear with their versions. |
| 5 | Click "View all hosts" on the right side of the Software table for an extension. | The enrolled host appears in the hosts list. |
| 6 | Click the host to open Host details, then open the Software tab. | The IntelliJ extensions are listed in the host's software inventory. |
| 7 | Repeat for each other JetBrains IDE that Fleet supports. | Extensions for each supported JetBrains IDE appear consistently across all three platforms. |

### SEC-SOFTWARE-002 — Vulnerable JetBrains IDE plugins surface CVEs across platforms

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A macOS, Windows, and Linux host enrolled in Fleet, each with a supported JetBrains IDE (e.g. IntelliJ IDEA) installed and a known-vulnerable extension installed; vulnerability processing available.
- **Source:** #32266, #22463

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On an enrolled host with IntelliJ IDEA installed, install a known-vulnerable extension. | The vulnerable extension is installed. |
| 2 | Refetch host vitals for the host (and confirm the data is retrievable via a raw osquery live query). | Vitals refetch completes and extension data is collected. |
| 3 | Navigate to the Software page. | The IntelliJ IDEA extension appears and its vulnerabilities (CVEs) are shown. |
| 4 | Select "Show versions". | The extension and its CVEs are shown per version. |
| 5 | Click "View all hosts" on the right side of the Software table, then click the host to open Host details > Software tab. | The host appears in the list, and the extension plus its CVEs appear in the host's software inventory. |
| 6 | Repeat for each other supported JetBrains IDE. | The vulnerable extension and its CVEs surface consistently across all supported JetBrains IDEs and all three platforms. |

### SEC-SOFTWARE-003 — Code-editor (Cursor/Windsurf/VS Code/VSCodium/Trae) extensions are inventoried and vulnerability-tagged

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** macOS, Windows, and Linux hosts enrolled with osquery >= 5.19; Cursor, Windsurf, VSCodium, VS Code, and Trae installed on each host, with a different-but-overlapping set of extensions per editor and at least one vulnerable extension per editor fork. Vulnerability processing available.
- **Source:** #31397

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Install Cursor, Windsurf, VSCodium, VS Code, and Trae on each of the Windows, macOS, and Linux hosts, with an overlapping extension set per editor (at least one vulnerable extension per fork). | Editors and extensions are installed on all three hosts. |
| 2 | Enroll the hosts and let inventory collect, then open the Software page. | Each extension shows as a separate software title per editor; the same extension on the same editor resolves to the same software title across all three OSes. |
| 3 | Open Host details > Software > Inventory for a host, and the My device > Software view. | Each extension is visible and tagged with its associated editor fork. |
| 4 | Run vulnerability processing, then re-check the vulnerable extensions. | A vulnerable extension is marked as vulnerable consistently across all editor forks it is installed in. |

### SEC-SOFTWARE-004 — Global npm packages are inventoried and vulnerability-flagged on macOS and Linux

- **Tier:** Both
- **Priority:** P1
- **Platforms:** macOS | Linux
- **Preconditions:** A macOS host (Node installed via Homebrew) and Linux hosts (Ubuntu 24.04 and Fedora 42, Node installed via package manager) enrolled in Fleet. `nvm` is NOT installed. Vulnerability cron configured with the branch's cpe_translations. Test on a build that includes the branch changes. Use only non-scoped npm packages.
- **Source:** #31970

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On an enrolled host with Node installed, install some npm packages globally (non-scoped only), then refetch host vitals. | Vitals refetch completes and the global npm packages are collected. |
| 2 | Navigate to the Software page and select "Show versions". | The global npm packages appear as software titles with their versions. |
| 3 | Click "View all hosts" for an npm package, then click the host to open Host details > Software tab. | The host appears in the list and the npm packages are listed in the host's software inventory. |
| 4 | Install a known-vulnerable npm package version (e.g. `npm install vite@4.5.5` for CVE-2025-24010, or `npm install vega@5.24.0` for CVE-2025-25303), refetch vitals, and run the vulnerability cron. | The CVE is surfaced on the Software page, software title details page, software version details page, Host details page, and My device page. |
| 5 | Inspect the source label for npm packages on the Software page, title details, version details, Host details, and My device pages. | The source is displayed as lowercase "Package (npm)", not "Package (NPM)". |

### SEC-SOFTWARE-005 — Software API returns empty string for unopened software that supports last_opened_at

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

### SEC-SOFTWARE-006 — Software executable SHA-256 hash is served in macOS API responses

- **Tier:** Both
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** A macOS host enrolled in Fleet with software whose API responses include `signature_information`. API access with a valid token.
- **Source:** #33522

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Call each software-related API endpoint that returns `signature_information` for the macOS host. | Each endpoint returns the software data successfully. |
| 2 | Inspect the response for macOS software entries. | `executable_sha256` is included and populated for macOS software. |

### SEC-SOFTWARE-007 — Windows software upgrade_code is served only for the programs source

- **Tier:** Both
- **Priority:** P2
- **Platforms:** Windows
- **Preconditions:** A Windows host enrolled in Fleet with software from the `programs` source (including at least one app missing an upgrade code) and software from other sources. API access with a valid token.
- **Source:** #33907

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Call the "Get software" endpoint. | `upgrade_code` is included for `programs`-source software; software from other sources does not include `upgrade_code` (not even set to `null`); `programs` apps missing an upgrade code show an empty string. |
| 2 | Call the "Get software version" endpoint. | Same behavior: `upgrade_code` present for `programs` source, absent for other sources, empty string when missing. |
| 3 | Call the "Get host's software" endpoint. | Same behavior: `upgrade_code` present for `programs` source, absent for other sources, empty string when missing. |
| 4 | Call the "Get host" endpoint without the `exclude_software=true` query param. | Same behavior: `upgrade_code` present for `programs` source, absent for other sources, empty string when missing. |
| 5 | Call the "Get host by device token" endpoint without the `exclude_software=true` query param. | Same behavior: `upgrade_code` present for `programs` source, absent for other sources, empty string when missing. |

### SEC-SOFTWARE-008 — Host details Software tab filters to top-level applications on macOS

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

### SEC-SOFTWARE-009 — RHEL 8/9 vulnerabilities detected via OSV match OVAL results

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

### SEC-SOFTWARE-010 — Ubuntu OSV feed resolves emacs-common false positive while keeping real CVE

- **Tier:** Both
- **Priority:** P1
- **Platforms:** Linux
- **Preconditions:** Ability to download and parse OSV data for Ubuntu 20.04, 22.04, and 24.04; an Ubuntu 24.04 host (or equivalent test data) with `emacs-common` installed; ability to run OVAL and OSV scans and the osquery-perf comparison.
- **Source:** #40201, #39370

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Download and parse the OSV vulnerability data for Ubuntu 20.04, 22.04, and 24.04. | OSV data is downloaded and parsed successfully for all three releases. |
| 2 | Run an OSV-based scan against `emacs-common` on Ubuntu 24.04 and inspect CVE-2024-30205. | CVE-2024-30205 is NOT flagged for `emacs-common` (the known false positive is resolved). |
| 3 | Inspect CVE-2024-39331 for `emacs-common` on Ubuntu 24.04 in the same scan. | CVE-2024-39331 IS still flagged (legitimate vulnerability retained). |
| 4 | Run the osquery-perf comparison between OVAL and OSV results. | The comparison completes and the differences between OVAL and OSV results are documented. |
| 5 | Run a scan for a release where OSV data is missing. | Fleet falls back to OVAL for that release. |

## Host IdP identity

### SEC-IDP-001 — Set an IdP username via API on a host with no IdP data

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** All
- **Preconditions:** Premium-licensed Fleet instance with SCIM configured. An enrolled host that did not authenticate during setup and therefore has no IdP data. The IdP username being set matches an existing IdP user.
- **Source:** #28070

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Call the API to set an IdP username on the host. | API returns success. |
| 2 | Open the host detail page. | The IdP username is displayed on the host detail page. |
| 3 | Inspect the IdP-derived fields on the host detail page. | Other data from IdP (e.g. full name, groups) is populated for the host. |

### SEC-IDP-002 — Change an IdP username via API on a host that did not authenticate during setup

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Premium-licensed Fleet instance with SCIM configured. An enrolled host that did not authenticate during setup but already has an IdP username set via the API.
- **Source:** #28070

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Call the API to change the IdP username to a different existing IdP user. | API returns success. |
| 2 | Open the host detail page. | The IdP username changes to the new value on the host detail page. |
| 3 | Inspect the IdP-derived fields on the host detail page. | Other data from IdP is updated to match the new IdP user. |

### SEC-IDP-003 — Change an IdP username via API to a user that does not exist clears other IdP data

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Premium-licensed Fleet instance with SCIM configured. An enrolled host that has an IdP username and populated IdP data.
- **Source:** #28070

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Call the API to change the IdP username to a value that does not correspond to any existing IdP user. | API returns success. |
| 2 | Open the host detail page. | The IdP username changes to the new value on the host detail page. |
| 3 | Inspect the IdP-derived fields on the host detail page. | Other data from IdP is cleared out because the IdP user does not exist. |

### SEC-IDP-004 — Change an IdP username via API on a host that authenticated during setup

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Premium-licensed Fleet instance with SCIM configured. An enrolled host that already has IdP data from SCIM because it authenticated during setup.
- **Source:** #28070

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Call the API to change the IdP username to a different existing IdP user. | API returns success. |
| 2 | Open the host detail page. | The IdP username changes to the new value on the host detail page. |
| 3 | Inspect the IdP-derived fields on the host detail page. | Other data from IdP is updated to match the new IdP user (or cleared out if the IdP user does not exist). |

### SEC-IDP-005 — Add an IdP username via API without SCIM configured saves only the username

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Premium-licensed Fleet instance with SCIM not configured. An enrolled host with no IdP data.
- **Source:** #28070

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Call the API to set an IdP username on the host. | API returns success and the username is saved. |
| 2 | Open the host detail page and inspect the IdP fields. | The IdP username is displayed, but no other IdP data is populated. |

### SEC-IDP-006 — Updating a host's IdP username via the API is blocked on Fleet Free

- **Tier:** Free
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet Free (no Premium license). An enrolled host.
- **Source:** #28070

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Call the API to set or change the host's IdP username. | The request is rejected; changing the IdP username only works with a Premium license. |

### SEC-IDP-007 — Add a host's IdP username for the first time via the UI

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** All
- **Preconditions:** Premium-licensed Fleet instance with SCIM configured. An enrolled host with no IdP username set.
- **Source:** #33909

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the host detail page and open the action to add an IdP username. | The add/edit IdP username modal opens. |
| 2 | Enter an existing IdP username and confirm. | The modal closes and the IdP username is displayed on the host detail page. |

### SEC-IDP-008 — Edit an existing host's IdP username via the UI

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Premium-licensed Fleet instance with SCIM configured. An enrolled host that already has an IdP username set.
- **Source:** #33909

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the host detail page and open the action to edit the IdP username. | The edit IdP username modal opens pre-populated with the current username. |
| 2 | Change the value to a different existing IdP username and confirm. | The modal closes and the updated IdP username is displayed on the host detail page. |

### SEC-IDP-009 — Remove a host's IdP username via the UI

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Premium-licensed Fleet instance with SCIM configured. An enrolled host that has an IdP username set.
- **Source:** #33909

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the host detail page and use the UI option to remove the IdP username. | The IdP username is removed and is no longer displayed on the host detail page. |

### SEC-IDP-010 — Delete a host's IdP username via the API

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Premium-licensed Fleet instance with SCIM configured. An enrolled host that has an IdP username set.
- **Source:** #33909

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Call the API to delete the host's IdP username. | API returns success. |
| 2 | Open the host detail page. | The IdP username is no longer displayed on the host detail page. |

### SEC-IDP-011 — IdP username changes are recorded in the activity feed

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Premium-licensed Fleet instance with SCIM configured. An enrolled host.
- **Source:** #33909

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add, edit, and then remove the host's IdP username. | Each action completes successfully. |
| 2 | Open the activity feed. | The activity feed records the add, edit, and removal of the host's IdP username. |

### SEC-IDP-012 — Verify IdP username modal copy and links

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Premium-licensed Fleet instance. An enrolled host.
- **Source:** #28070

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the add/edit IdP username modal on the host detail page. | Modal copy and tooltips are correct. |
| 2 | Click each link in the modal. | No link in the modal returns a 404. |

### SEC-IDP-013 — IdP username management via the UI is hidden on Fleet Free

- **Tier:** Free
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet Free (no Premium license). An enrolled host.
- **Source:** #33909

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the host detail page and look for the option to add, edit, or remove the IdP username. | The IdP username management feature does not appear anywhere in Fleet Free. |

## Certificate management (SCEP/NDES/ACME)

### SEC-CERTS-001 — Deploy and delete certificates on Android hosts via UI and API

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** Fleet Premium license; Android enterprise (work profile) enrolled host; a certificate authority (e.g. SCEP) configured; a configuration profile that deploys a certificate assigned to the team.
- **Source:** #30876

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Assign a certificate-bearing configuration profile to the team containing the enrolled Android host (via UI or API). | Certificate is delivered to the Android work profile; OS settings show the certificate progressing to verified. |
| 2 | Open Host details for the Android host and view OS settings. | Deployed certificate is listed with its status. |
| 3 | Remove the certificate profile from the host (delete via UI or API). | Certificate is removed from the Android work profile and no longer listed in OS settings. |
| 4 | Verify the global activity feed. | Activities are recorded for the certificate being installed and removed. |

### SEC-CERTS-002 — Deploy a certificate from an NDES CA to a Windows host

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** Fleet Premium license; Windows host enrolled via MDM; an NDES (Network Device Enrollment Service) server configured and accessible; the NDES/SCEP CA added in Fleet Settings.
- **Source:** #33421

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Deploy the root CA certificate to the Windows host per the setup guide. | Root CA certificate is installed on the Windows host. |
| 2 | Assign a configuration profile that requests a certificate from the NDES CA to the Windows host. | Fleet requests the certificate from NDES and delivers it to the host. |
| 3 | View OS settings on the Windows Host details page. | NDES-issued certificate progresses to verified. |
| 4 | Inspect the certificate on the Windows host. | Certificate is present and chains to the deployed root CA. |

### SEC-CERTS-003 — Dynamic SCEP challenge CA copy is correct in add/edit/list views

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Fleet Premium license; admin access to Settings > Integrations > Certificates (certificate authorities).
- **Source:** #34521

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the "Add CA" modal and select the SCEP/Okta dynamic challenge option. | All field labels, helper text, and headings match the approved copy (dynamic SCEP challenge wording present). |
| 2 | Review the configured CA list. | CA list labels and descriptive text match the approved copy. |
| 3 | Open the "Edit CA" modal for an existing SCEP CA. | Edit modal field labels and helper text match the approved copy (same fields as the Add modal). |

### SEC-CERTS-004 — Install certificates on Android work profile via the agent

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** Fleet Premium license; Android enterprise host enrolled with a managed work profile and the Fleet Android agent installed; a SCEP CA configured; a certificate configuration profile assigned to the host's team.
- **Source:** #34856, #35198

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Assign the certificate configuration profile to the team containing the Android host. | Fleet agent receives the certificate payload for the work profile. |
| 2 | Wait for the agent to apply the certificate. | Certificate is installed into the Android work profile keystore. |
| 3 | View OS settings on the Android Host details page. | Certificate is listed and reaches verified status. |

### SEC-CERTS-005 — Android certificates auto-renew based on validity period

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** Fleet Premium license; Android work-profile host enrolled; a SCEP CA configured; certificate configuration profiles assigned with controllable validity periods.
- **Source:** #37181, #39840

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Deploy an Android certificate with a validity period over 30 days and advance/observe to within 30 days of expiration. | Certificate auto-renews 30 days before expiration and the updated profile is pushed. |
| 2 | Deploy an Android certificate with a 10-day validity period and observe to within 5 days of expiration. | Certificate auto-renews 5 days before expiration. |
| 3 | Deploy an Android certificate with a 1-day validity period and let it approach expiration. | Certificate does not auto-renew. |
| 4 | Verify certificate renewal on Apple platforms (iOS, iPadOS, macOS). | Apple certificate renewal behavior is unchanged (no regressions). |

### SEC-CERTS-006 — Android certificate install retries 3 times then terminally fails

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** Fleet Premium license; Android work-profile host enrolled; a SCEP CA configured (with the ability to deliberately misconfigure it); a certificate configuration profile assigned.
- **Source:** #37546, #42608, #42734

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Deploy a certificate successfully to an Android host and check the host activity feed. | `installed_certificate` activity appears with `status: "installed"` and no details modal. |
| 2 | Misconfigure the SCEP server to force an install failure and deploy a certificate. | An `installed_certificate` activity with `status: "failed_install"` appears after each failed attempt; certificate status resets to `pending` in OS settings between attempts. |
| 3 | Allow the retries to exhaust (3 retries / 4 total attempts). | After the final attempt the certificate status becomes terminally `failed`. |
| 4 | Click a failed certificate activity in the feed. | Details modal shows an error icon, a failure message with the certificate name and host name in bold, a collapsible "Details" section with the error text, and a "Done" button. |
| 5 | On the Android host details page, hover the "Upcoming" tab. | Tab is grayed out with tooltip "Currently, upcoming activity is only supported for macOS, Windows, Linux, iOS, and iPadOS hosts." |
| 6 | Confirm behavior on a non-Android host (macOS/Windows/Linux/iOS). | Activity card, Upcoming tab, and existing certificate activities work normally with no regressions. |

### SEC-CERTS-007 — Resend an Android certificate to a specific host

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** Fleet Premium license; Android work-profile host enrolled with certificates in verified, pending, and failed states; a SCEP CA configured.
- **Source:** #37556, #42608

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open OS settings for the Android host and inspect certificate rows. | "Resend" action is available for verified and failed certificates; no "Resend" action is offered for pending certificates. |
| 2 | Click "Resend" on a verified certificate. | Certificate enters "pending" state, then resolves to verified (or failed). |
| 3 | Click "Resend" on a terminally failed certificate. | Certificate resets to "pending"; if delivery fails again it becomes immediately terminal with no auto-retry. |
| 4 | After a successful resend, check the global activity feed. | A `resent_certificate` activity is recorded for the host. |
| 5 | Call the resend API for a pending certificate. | API returns an error and no resend occurs. |

### SEC-CERTS-008 — View and manage SCEP certificates in Controls OS settings

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Fleet Premium license; admin access to Controls > OS settings > Certificates; ability to configure a custom SCEP CA.
- **Source:** #39346

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Controls > OS settings > Certificates with no custom SCEP CA configured. | New empty state is displayed prompting configuration of a CA. |
| 2 | Configure a custom SCEP CA but add no certificates, then revisit the Certificates view. | "Add certificate" empty state is shown with heading text reduced to 16px/1rem. |
| 3 | Open the "Add certificate" form. | CA selection field appears at the top of the form. |
| 4 | Add a certificate and review the resulting list. | Updated copy and an actions dropdown are present on the certificate row. |
| 5 | Open the actions dropdown and choose Delete. | A delete confirmation modal opens. |
| 6 | Open the actions dropdown and choose View. | Certificate details modal opens matching the approved designs. |

### SEC-CERTS-009 — Auto re-push profiles for certificates not proxied through Fleet (SCEP/ACME renewal)

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | iOS/iPadOS
- **Preconditions:** Fleet Premium license; enrolled host(s); CAs configured for Okta conditional access (SCEP), Okta Verify (SCEP with static challenge), and Hydrant (ACME); certificate configuration profiles assigned with short validity periods.
- **Source:** #40639

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add CAs and assign certificate profiles for Okta conditional access (SCEP), Okta Verify (SCEP static challenge), and Hydrant (ACME), each issuing certificates with a short validity period. | Certificates are issued and installed on the host(s) and reach verified status. |
| 2 | Let the certificates approach the end of their short validity period. | Fleet detects the impending expiration for certificates not proxied through Fleet (including the Hydrant ACME certificate). |
| 3 | Observe renewal handling. | Fleet renews the certificates and automatically re-pushes the updated configuration profiles to the host(s). |
| 4 | Verify OS settings and certificate state after renewal. | Renewed certificates are installed and reach verified status with no manual intervention. |

## Fleetd agent & osquery tables

### SEC-AGENT-001 — Surface Santa allow/deny events via the santa_allowed and santa_denied osquery tables

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

### SEC-AGENT-002 — Reconcile the santa_status table with santactl output

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

### SEC-AGENT-003 — Automatically retry failed policy-automation scripts and software installs

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

### SEC-AGENT-004 — List globally installed npm packages via the npm_packages osquery table (npm and nvm)

- **Tier:** Free
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Host enrolled in Fleet with Node.js installed. Live query capability available.
- **Source:** #32268

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the host, install one or more npm packages globally with `npm install -g <package>`. | The packages install successfully into the global npm location. |
| 2 | Run `SELECT * FROM npm_packages` as a live query against the host. | The query returns rows listing exactly the packages installed globally via npm. |
| 3 | Install [nvm](https://github.com/nvm-sh/nvm), then install one or more npm packages using a Node version managed by nvm. | The packages install successfully under the nvm-managed Node install. |
| 4 | Re-run `SELECT * FROM npm_packages` as a live query. | The query also returns the npm packages installed via the nvm-managed Node. |

### SEC-AGENT-005 — Detect listening MCP servers and their capabilities via the mcp_listening_servers table

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

### SEC-AGENT-006 — Save a query with invalid SQL while empty queries remain blocked

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

### SEC-AGENT-007 — Surface Fleet Android agent connectivity errors on the debug page

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Android
- **Preconditions:** Android host enrolled in Fleet via the Fleet Android agent app. Access to the app's debug page.
- **Source:** #38034

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Put the agent into a state that produces a 403 infrastructure error when communicating with Fleet, then open the debug page in the Fleet Android agent app. | The 403 infra error is displayed on the debug page. |
| 2 | Put the agent into a state that produces a 401 invalid `node_key` error, then open the debug page. | The 401 invalid node_key error is displayed on the debug page. |

## Conditional access (Okta/Entra)

### SEC-CONDACCESS-001 — Configure Okta and Entra conditional access integrations as an IT admin

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet Premium instance (managed cloud or self-hosted) with an admin user; Okta and Entra tenants available for conditional access setup.
- **Source:** #31909

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to Settings > Integrations > Conditional access. | Conditional access section is shown for both managed-cloud and self-hosted deployments. |
| 2 | Open the Okta conditional access modal and follow the in-modal link to the setup guide. | Guide link opens the correct Okta conditional access documentation (no 404). |
| 3 | In the Okta modal, upload an invalid certificate. | Fleet rejects the upload with a validation error rather than saving it. |
| 4 | Upload a valid certificate and complete the Okta configuration. | Okta integration is saved and shown as configured. |
| 5 | Open the Entra conditional access modal and follow the in-modal link to the setup guide. | Guide link opens the correct Entra conditional access documentation (no 404). |
| 6 | Configure the Entra integration so both Okta and Entra are configured at the same time. | Both Okta and Entra integrations are saved and shown as configured concurrently. |
| 7 | Remove the Okta integration. | Okta integration is removed and no longer shown as configured; Entra remains unaffected. |
| 8 | Reload the page with GitOps mode enabled and open the conditional access forms. | Forms can still be filled out and submitted with GitOps mode enabled. |
| 9 | Open Settings > Integrations > Conditional access on a Fleet Free instance. | Conditional access configuration is not available on Fleet Free. |

### SEC-CONDACCESS-002 — End user passing conditional access policies is allowed through across browsers

- **Tier:** Premium
- **Platforms:** macOS
- **Priority:** P1
- **Preconditions:** Premium instance with Okta conditional access configured; a Mac enrolled and passing its conditional access policies; the Okta-issued client certificate deployed to the host.
- **Source:** #31909

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the host, sign in to the Okta-protected app using Chrome. | End user is allowed through with no popups to select a certificate or allow keychain access. |
| 2 | Repeat the sign-in using Safari. | End user is allowed through; at most one certificate/keychain popup may appear. |
| 3 | Repeat the sign-in using Firefox. | End user is allowed through; one or more certificate popups may appear. |
| 4 | Using the same Okta account, sign in from a device without a certificate (e.g. an iPhone) while the Mac is failing policies. | The certificate-less device is allowed through and is not blocked because of the Mac's failing policies. |

### SEC-CONDACCESS-003 — Disable-bypass setting controls the end user "Action required" remediation flow

- **Tier:** Premium
- **Platforms:** macOS
- **Priority:** P0
- **Preconditions:** Premium instance upgraded from an older Fleet version with Okta conditional access enabled; a Mac enrolled with conditional access policies; an end user able to trigger the Okta sign-in flow.
- **Source:** #34440

| # | Step | Expected result |
|---|------|-----------------|
| 1 | After upgrading, go to Settings > Integrations > Conditional access. | "Disable bypass" option is visible and is disabled (off) by default. |
| 2 | Delete the Okta conditional access configuration. | "Disable bypass" option is hidden and the setting is disabled. |
| 3 | Re-add the Okta configuration and enable "Disable bypass". | Setting is saved as enabled. |
| 4 | As an end user with a host failing policies, complete the Okta sign-in flow. | User is redirected directly to the "My device" page; the failing-policies banner directs the user toward "Action required" policies. |
| 5 | On a "My device" page with no "Action required" policies, view the failing-policies banner. | Banner renders correctly with no regressions when there are no "Action required" policies. |
| 6 | Click an "Action required" policy on the "My device" page. | No bypass option is offered for the policy. |
| 7 | Remediate the failing policy and refetch host vitals. | Once the policy passes, the end user is able to complete sign-in. |

### SEC-CONDACCESS-004 — Critical conditional access policies block end user bypass; non-critical policies allow snooze

- **Tier:** Premium
- **Platforms:** macOS
- **Priority:** P0
- **Preconditions:** Premium instance with Okta conditional access configured and global bypass enabled; multiple policies have conditional access enabled; a Mac enrolled and able to fail those policies; an end user able to run the Okta sign-in flow.
- **Source:** #40521, #36105

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Check copy in Settings > Integrations > Conditional access, the Add policy and Edit policy "critical" tooltips, and Policies > Manage automations > Conditional access. | Copy and tooltips reflect the `critical`-based bypass model (no per-policy bypass checkbox). |
| 2 | In the Manage automations > Conditional access modal, enable conditional access on additional policies. | No additional per-policy bypass checkbox appears next to the policies. |
| 3 | As an end user, fail multiple conditional access policies where at least one failing policy is marked `critical`. | The "My device" page offers no option to bypass conditional access. |
| 4 | Call the bypass endpoint while the host is still failing multiple policies and one failing policy is `critical`. | The API returns an error and does not grant bypass. |
| 5 | Re-test as an end user failing multiple conditional access policies where no failing policy is `critical`; on "My device", click an "Action required" policy. | A snooze option is available for the policy. |
| 6 | Snooze the policy, then complete sign-in. | Banner text updates to reflect the snooze, and the user is able to log in. |
| 7 | Refresh the "My device" page. | The "snoozed" banner text goes away. |
| 8 | Log out and attempt to log in a second time. | The user is blocked again (snooze is single-use, not persistent). |
| 9 | Keep a host snoozed for 24+ hours and re-check. | Snooze behavior remains correct after 24+ hours. |

### SEC-CONDACCESS-005 — Migrate experimental per-policy bypass setting to `critical` and exclude it from GitOps

- **Tier:** Premium
- **Platforms:** macOS
- **Priority:** P1
- **Preconditions:** Premium instance being upgraded from a version that had Okta configured, global bypass enabled, and some conditional access policies with the experimental `conditional_access_bypass_enabled` flag set.
- **Source:** #40521, #36105

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Upgrade the instance and inspect the conditional access policies. | Each policy's `critical` setting is modified only when it meets the conditions in the upgrade migration rules (per the story's upgrading diagram); other policies are left unchanged. |
| 2 | Run `fleetctl generate-gitops`. | The deprecated `conditional_access_bypass_enabled` field is no longer included in the generated policy YAML. |
| 3 | Toggle the global "disable bypass" setting off (bypass disabled). | No option to configure per-policy bypass is shown, and the end user is offered no bypass option. |
| 4 | Verify migration from a version with no bypass feature and from a version with the first iteration of the bypass feature. | Both upgrade paths complete without error and produce the correct `critical`/bypass state. |
| 5 | Open the conditional access settings on a Fleet Free instance. | The conditional access / bypass feature does not appear on Fleet Free. |

## Disk encryption & recovery passwords

### SEC-ENCRYPTION-001 — Require BitLocker PIN and surface updated PIN setup instructions to the end user

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** Fleet Premium license. A Windows host enrolled via MDM with disk encryption (BitLocker) enforced but no PIN currently set on the device.
- **Source:** #33726

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In Fleet settings, enable the option to require a BitLocker PIN for disk encryption. | Setting saves successfully and is reflected as enabled. |
| 2 | On the Windows device with no PIN set, open the Fleet end-user flow that presents the BitLocker PIN setup instructions. | Instructions to set a BitLocker PIN are displayed. |
| 3 | Review the copy in the displayed PIN setup instructions. | Copy is the updated wording for setting a BitLocker PIN; text is accurate with no stale or placeholder content. |

### SEC-ENCRYPTION-002 — Enable Recovery Lock password in Controls and surface it in OS settings and vitals

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Fleet Premium license, signed in as an admin or maintainer. At least one macOS host enrolled. `enable_recovery_lock_password` is initially off.
- **Source:** #37497

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to Controls > OS settings as a maintainer or admin. | A "Passwords" section is present with an option for "Recovery Lock password". |
| 2 | Hover the "Recovery Lock password" tooltip. | Tooltip displays explanatory copy describing the Recovery Lock password setting. |
| 3 | Enable the Recovery Lock password option (set `enable_recovery_lock_password` to true). | Setting saves; Recovery Lock password host count is included in vitals. |
| 4 | Open a macOS Host details page and click the "OS settings" vital. | The OS settings table includes a Recovery Lock password item showing its status (verified, pending, or failed). |

### SEC-ENCRYPTION-003 — View an escrowed macOS Recovery Lock password from Host details

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Fleet Premium license. `enable_recovery_lock_password` is enabled. A macOS host with a Recovery Lock password escrowed in Fleet. Signed in as a role permitted to view recovery passwords (admin, maintainer, observer, or observer+ — any role except GitOps).
- **Source:** #37497, #37498

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the macOS Host details page and open the Actions dropdown. | The "Show Recovery Lock password" action is present and enabled. |
| 2 | Click "Show Recovery Lock password". | The Recovery Lock password modal opens and displays the escrowed password. |
| 3 | Open the host's activity feed. | A "viewed Recovery Lock password" activity is recorded for the host. |

### SEC-ENCRYPTION-004 — Hide the Recovery Lock password action when the feature is disabled

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Fleet Premium license. `enable_recovery_lock_password` is disabled. A macOS host enrolled.
- **Source:** #37497

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the macOS Host details page and open the Actions dropdown. | The "Show Recovery Lock password" action is not shown in the dropdown. |

### SEC-ENCRYPTION-005 — Rotate a macOS Recovery Lock password from the modal

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Fleet Premium license. `enable_recovery_lock_password` is enabled. A macOS host with a Recovery Lock password escrowed. Signed in as an admin or maintainer.
- **Source:** #37498, #41003

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the macOS Host details page, open the Actions dropdown, and click "Show Recovery Lock password". | The Recovery Lock password modal opens, shows the password, includes a warning note, and exposes a "Rotate password" control (admin/maintainer only). |
| 2 | Click "Rotate password". | A rotation is triggered; the host's activity feed records a manual rotation activity reading "<User> triggered a password rotation". |
| 3 | While a rotation is already pending, click "Rotate password" again in the modal. | The password is rotated right away and the scheduled automatic rotation does not also occur. |

### SEC-ENCRYPTION-006 — Block rotation for non-maintainer roles while still allowing view

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Fleet Premium license. `enable_recovery_lock_password` is enabled. A macOS host with a Recovery Lock password escrowed. Signed in as an observer or observer+ (a role that can view but not rotate).
- **Source:** #37498

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the macOS Host details page, open the Actions dropdown, and click "Show Recovery Lock password". | The modal opens and the password is viewable. |
| 2 | Inspect the modal for rotation controls. | No "Rotate password" control is available to this role; viewing is permitted for all roles except GitOps. |

### SEC-ENCRYPTION-007 — Recovery Lock password rotation modal disabled when feature is off

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Fleet Premium license. `enable_recovery_lock_password` is disabled. A macOS host enrolled.
- **Source:** #37498

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the macOS Host details page and open the Actions dropdown. | "Show Recovery Lock password" is present but disabled. |
| 2 | Hover the disabled "Show Recovery Lock password" action. | A tooltip explains why the action is unavailable. |

### SEC-ENCRYPTION-008 — Automatically rotate the Recovery Lock password and log a Fleet-initiated activity

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Fleet Premium license. `enable_recovery_lock_password` is enabled. A macOS host with a Recovery Lock password escrowed, with a rotation pending and no manual rotation triggered.
- **Source:** #41003

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Leave a Recovery Lock password pending rotation and wait for the automatic rotation interval (60 minutes) to elapse without any manual action. | After 60 minutes the password is automatically rotated. |
| 2 | Open the host's activity feed. | A Fleet-initiated rotation activity is recorded (no user attributed). |

### SEC-ENCRYPTION-009 — Recovery Lock password feature is hidden on Fleet Free

- **Tier:** Free
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** A Fleet Free instance with a macOS host enrolled. Signed in as an admin.
- **Source:** #37497

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to Controls > OS settings. | No "Passwords" section or Recovery Lock password option is present. |
| 2 | Open a macOS Host details page and open the Actions dropdown. | No "Show Recovery Lock password" action is present. |

### SEC-ENCRYPTION-010 — Track Recovery Lock password lifecycle events in the global activity feed

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Fleet Premium license. A macOS host enrolled. Signed in as an admin.
- **Source:** #37497, #37498, #41003

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enable the Recovery Lock password setting, then disable it again. | Dashboard > global activity feed records "turned on" and "turned off" Recovery Lock password activities. |
| 2 | With the setting enabled and a password escrowed, view the Recovery Lock password from a host. | Global activity feed records a "viewed Recovery Lock password" activity and an "escrowed" activity when the password is escrowed. |
| 3 | Trigger a manual rotation from the modal, then allow an automatic rotation to occur. | Global activity feed records the manual rotation as "<User> triggered a password rotation" and the automatic rotation as a Fleet-initiated activity. |

## CIS benchmark policies

### SEC-CIS-001 — Windows 10 CIS benchmark policies pass and fail correctly after update to v4.0.0

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** Fleet Premium instance with a Windows 10 workstation enrolled. The CIS benchmark policy library has been updated to Windows 10 CIS Benchmark v4.0.0. The PR that updated the Windows 10 CIS policies is available for reference (list of changed policies).
- **Source:** #35118

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the PR that updated the Windows 10 CIS policies and identify every policy that changed in the v4.0.0 update. | A complete list of added/modified Windows 10 CIS benchmark policies is available. |
| 2 | Apply each changed policy to the enrolled Windows 10 workstation in a state expected to PASS the benchmark, then run/refetch the policy. | Each policy reports a passing result for the compliant host state. |
| 3 | Reconfigure the Windows 10 workstation into a state expected to FAIL each changed benchmark, then re-run/refetch the policy. | Each policy reports a failing result for the non-compliant host state. |
| 4 | Record every changed and tested benchmark with its pass/fail outcome in a tracking sheet (e.g., Google Sheet) and link it on the story. | All changed v4.0.0 Windows 10 benchmarks are documented with verified pass and fail results. |

### SEC-CIS-002 — Windows 11 CIS benchmark policies pass and fail correctly after update to v5.0.1

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** Fleet Premium instance with a Windows 11 workstation enrolled. The CIS benchmark policy library has been updated to Windows 11 CIS Benchmark v5.0.1. The PR that updated the Windows 11 CIS policies is available for reference (list of changed policies).
- **Source:** #39096

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the PR that updated the Windows 11 CIS policies and identify every policy that changed in the v5.0.1 update. | A complete list of added/modified Windows 11 CIS benchmark policies is available. |
| 2 | Apply each changed policy to the enrolled Windows 11 workstation in a state expected to PASS the benchmark, then run/refetch the policy. | Each policy reports a passing result for the compliant host state. |
| 3 | Reconfigure the Windows 11 workstation into a state expected to FAIL each changed benchmark, then re-run/refetch the policy. | Each policy reports a failing result for the non-compliant host state. |
| 4 | Record every changed and tested benchmark with its pass/fail outcome in a tracking sheet (e.g., Google Sheet) and link it on the story. | All changed v5.0.1 Windows 11 benchmarks are documented with verified pass and fail results. |

### SEC-CIS-003 — macOS CIS benchmark policies pass and fail correctly after benchmark update

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Fleet Premium instance with macOS workstation(s) enrolled across the supported benchmark versions (macOS 14, 15, and 26). The CIS benchmark policy library has been updated for the latest macOS benchmarks. The PR that updated the macOS CIS policies is available for reference (list of changed policies).
- **Source:** #45644, #35120

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the PR that updated the macOS CIS policies and identify every policy that changed across macOS 14, 15, and 26. | A complete list of added/modified macOS CIS benchmark policies is available. |
| 2 | Apply each changed policy to the matching enrolled macOS workstation in a state expected to PASS the benchmark, then run/refetch the policy. | Each policy reports a passing result for the compliant host state. |
| 3 | Reconfigure each macOS workstation into a state expected to FAIL each changed benchmark, then re-run/refetch the policy. | Each policy reports a failing result for the non-compliant host state. |
| 4 | Confirm that the newly added macOS 26 CIS benchmark policies are present in the library and that the deprecated macOS 13 benchmark policies are no longer offered. | macOS 26 benchmark policies are available; deprecated macOS 13 benchmark policies are removed. |
| 5 | Record every changed and tested benchmark with its pass/fail outcome in a tracking sheet (e.g., Google Sheet) and link it on the story. | All changed macOS benchmarks are documented with verified pass and fail results. |
