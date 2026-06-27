# Audit log — feature reorg

Restructured **647 product-group cases** into **515 feature cases** across 17 files (effective-set pruning, deduped).

| Area | Kept |
|------|-----:|
| hosts.md | 19 |
| queries-and-reports.md | 18 |
| policies.md | 19 |
| software-inventory.md | 33 |
| software-deployment.md | 95 |
| configuration-profiles.md | 19 |
| disk-encryption.md | 15 |
| os-updates.md | 9 |
| mdm-enrollment.md | 36 |
| mdm-commands-and-actions.md | 18 |
| setup-experience.md | 32 |
| certificates.md | 27 |
| identity-and-access.md | 23 |
| scripts.md | 25 |
| settings-and-integrations.md | 37 |
| gitops.md | 77 |
| activity-and-audit.md | 13 |

**Dropped: 45** · **Merged: 87** · **Moved: 23**

## Dropped (low-value / cosmetic / redundant)
- `EO-VULN-010` — Show "Last updated" timestamp on the software title page — _Pure UI 'Last updated' timestamp display on software title page; cosmetic, no functional behavior worth a regression slot._
- `EO-QUERY-002` — Select query modal on Host details shows clearer instructions — _Pure instructional-copy clarity check on the Select query modal; no functional behavior verified._
- `EO-AGENT-012` — Fleet Desktop menu and UI copy read "About Fleet" instead of "Transparency" — _Trivial copy/wording change ("About Fleet" vs "Transparency") with no functional behavior._
- `FI-RENAME-012` — ABM config reflects the `fleets` rename — _Trivial terminology-rename verification (ABM config reflects 'fleets' rename) with no distinct functional behavior; cosmetic copy check._
- `GITOPS-SW-018` — GitOps-mode UI changes render when adding a custom package — _Pure Figma-design-match check for GitOps-mode add-package UI; cosmetic, no functional behavior._
- `GITOPS-ORCH-014` — Best-practice fleet-gitops scaffold runs once every 24 hours — _Inspecting the template repo cron schedule is a static repo-config check, not Fleet regression behavior._
- `MDM-OSUPDATES-008` — Warn that disk encryption keys are deleted when transferring or deleting hosts — _Pure modal-copy verification (singular/plural transfer/delete warning matches design); no functional behavior beyond wording._
- `MDM-PROFILES-018` — Skip Apple declaration validations behind a contributor server config — _Contributor server-config flag to skip Apple declaration validations - niche P2 dev-flag behavior, not a user-facing regression flow_
- `MDM-ENROLL-024` — swiftDialog upgraded to v2.2 functions during setup experience — _Version-stamp check (swiftDialog v2.2 renders/reports version); behavior covered by ENROLL-019 and software-during-setup specs._
- `MDM-ENROLL-028` — Enrollment links on Add host modal are mono-spaced — _Pure cosmetic: enrollment links on the Add host modal are rendered in a mono-spaced font._
- `MDM-ACTIVITY-014` — Updated copy and view buttons render and function app-wide — _Cosmetic/design-system polish: copy/view button styling matching design and the 'Copied' tooltip appearing to the left. No user-observable functional behavior beyond existing view/copy actions covered elsewhere._
- `ORCH-PLATFORM-002` — Side navigation uses updated styles and truncates long text — _Side-nav Figma styling, text truncation, and hover tooltip; pure cosmetic/design-system._
- `ORCH-PLATFORM-003` — Windows automatic enrollment page links to the external guide — _Cosmetic content check: Windows automatic-enrollment page links to external guide and removed in-UI copy; no distinct enrollment behavior._
- `ORCH-PLATFORM-007` — Consistent "Couldn't add" error copy for software upload failures — _Trivial copy/wording check (standardized 'Couldn't add' text, no layout issues); no functional behavior._
- `ORCH-PLATFORM-018` — Disk encryption keys render in a distinguishing monospace font — _Cosmetic font rendering check (key shown in Source Code Pro, O vs 0 distinguishable)._
- `ORCH-PLATFORM-022` — Dogfood FleetBot question answering in Slack — _Internal Slack FleetBot dogfooding check, not a shippable product regression._
- `ORCH-PLATFORM-045` — SMTP Save button explains a test email will be sent — _Predominantly Save-button tooltip wording and SES-backend message styling/border; cosmetic._
- `ORCH-PLATFORM-046` — Query interval label and copy replace "frequency" throughout the UI — _Copy/label rename only ('frequency' -> 'Interval' and revised tooltips); no functional change._
- `ORCH-PLATFORM-047` — Query automations modal shows updated description without purple callout — _Cosmetic/copy: automations modal description matches Figma and removal of purple callout box._
- `ORCH-POLICY-006` — Entra conditional access surfaces easy-to-understand error messages — _Single-step P2 that only verifies error-message copy matches Figma dev notes; copy/wording with no distinct functional behavior._
- `ORCH-POLICY-014` — Host details and My device policies tables have no arrows — _Pure cosmetic/visual polish: verifies no sort arrows appear in Host details / My device policies tables._
- `ORCH-POLICY-020` — Maintenance windows calendar modal and events use updated copy — _Pure Figma-copy/image verification on the calendar modal and event text; cosmetic with no functional behavior._
- `ORCH-AGENT-025` — FleetBot answers a hosts question when mentioned in Slack — _Slack FleetBot Q&A; not a host-feature regression check, low value._
- `PTP-CERTS-003` — macOS certificate column is labeled "Scope" instead of "Keychain" — _Pure column-label rename ('Keychain' -> 'Scope') with no functional behavior; the column itself is already covered by MDM-ACTIVITY-005 and PTP-CERTS-001._
- `SEC-IDP-012` — Verify IdP username modal copy and links — _P2 verifying modal copy/tooltips and link 404s only; cosmetic copy/link check with no distinct functional behavior._
- `SEC-CERTS-003` — Dynamic SCEP challenge CA copy is correct in add/edit/list views — _Copy/wording verification of CA add/edit/list field labels and helper text against approved copy; no functional behavior._
- `SEC-AGENT-007` — Surface Fleet Android agent connectivity errors on the debug page — _Narrow debug-page diagnostic check (403/401 error strings) in the Android agent app; low-value relative to the core Android enrollment cases kept._
- `SW-INV-001` — Policy names truncate with ellipsis and tooltip on Host details and My device — _Predominantly cosmetic: ellipsis truncation, tooltip, no-arrow polish on policy lists._
- `SW-INV-004` — Pagination controls hide when there is only one page of results — _Minor UI polish: pagination controls hidden on a single page; cosmetic._
- `SW-INV-005` — Host count is a styled link on Software version, vulnerability, and OS detail pages — _Cosmetic: host-count is bold blue link with tooltip; styling/visual polish, and the link-to-filtered-host-list navigation is covered by SW-INV-021/EO-VULN-004._
- `SW-INV-009` — Hand-pointer cursor on enabled checkboxes and radio buttons, default on disabled — _Pure cursor styling (hand-pointer vs default) on checkboxes/radios; cosmetic._
- `SW-INV-010` — Search fields, dropdowns, and form inputs use 14px font — _Pure font-size (14px) verification across inputs; cosmetic/design-system._
- `SW-INV-011` — Detail page cards use uniform 40px padding — _Pure card padding (40px) verification; cosmetic/design-system._
- `SW-FMA-016` — Install details modal distinguishes user-installed from Fleet-installed software — _P2 cosmetic: tooltip/modal copy differences distinguishing user- vs Fleet-installed software; Figma-copy checks with no functional behavior._
- `SW-VPP-006` — Self-service and Automatic install options appear for Fleet-maintained apps and custom packages — _Redundant: Self-service/Automatic options appearing for FMA/custom packages is already exercised by SW-VPP-001, SW-FMA-027, and SW-SS-010._
- `SW-VPP-021` — Improved VPP install-failure copy for verify timeout on large apps — _P2 copy check: timeout-specific vs generic VPP install-failure wording/sentence inclusion; failure surfacing already covered by SW-VPP-015/018._
- `SW-AND-013` — End user can remove a preinstalled setup-experience app from the work profile — _Edge behavior (end user can remove a PREINSTALLED app) with no Fleet-side observable regression; low value P2._
- `SW-AND-019` — Delete-software confirmation modal shows updated copy — _P2 cosmetic: delete-software confirmation modal matches updated Figma copy; no functional behavior._
- `SW-PKG-003` — Software title truncates and shows tooltip at narrow widths — _Cosmetic truncation/tooltip of the software title at narrow widths; visual polish._
- `SW-SS-007` — Search on Self-service shows spinner and preserves card grid widths — _P2 cosmetic: search spinner and card-grid column widths/responsive layout; visual polish, no functional behavior._
- `SW-SS-008` — Self-service pagination toggles on app count — _P2 low-value: pagination controls toggle on app count; trivial UI threshold check._
- `SW-SS-009` — Software list tooltips describe self-service and policy-triggered installs — _P1 but pure tooltip-copy enumeration for install-indicator icons; wording check with no functional behavior._
- `SW-SETUP-002` — Setup experience software modal shows scoping copy and columns — _Cosmetic: modal scoping copy text and column header names; no functional behavior._
- `SW-SETUP-004` — Custom target tooltip shows label scoping details — _Cosmetic: Custom target tooltip styling/label truncation (+x more); tooltip-detail only, no functional behavior._
- `SW-MISC-024` — Dashboard platform cards tile responsively across breakpoints — _Responsive layout/breakpoint tiling of dashboard platform cards per Figma; cosmetic._

## Merged (behavior covered by another case)
- `EO-VULN-009` → `SW-FMA-007` — _Edit-package vs edit-options install/uninstall count reset behavior is the same behavior covered by SW-FMA-007 (counts reset on package change, preserved otherwise)._
- `EO-AGENT-007` → `EO-AGENT-001` — _Same behavior pattern: a named osquery table (secure_boot) returns correct data via live query; covered by the general table-resolution case._
- `EO-MDM-005` → `ORCH-AGENT-001` — _Same LUKS escrow on Ubuntu/Kubuntu/Fedora plus unsupported-distro gating; ORCH-AGENT-001 covers it more thoroughly._
- `EO-SCRIPTS-001` → `MDM-SCRIPTS-002` — _Library upload/validation/download/delete is covered by MDM-SCRIPTS-002; running on a Windows host with activity is covered by MDM-SCRIPTS-004, so no distinct behavior remains._
- `EO-CAL-005` → `EO-CAL-004` — _Negative gating of the same AI-description feature when AI features disabled; folds into EO-CAL-004._
- `EO-CAL-009` → `EO-CAL-003` — _Same calendar load/scale concern (bulk description updates across many calendars); folds into the scaling case._
- `EO-CAL-011` → `EO-CAL-003` — _Calendar load test confirming unrelated changes don't disturb events; folds into the scaling case._
- `FI-RENAME-003` → `FI-RENAME-002` — _One-step conflict-handling sliver of the same rename feature; folds into full-functionality verification of reports._
- `FI-RENAME-004` → `FI-RENAME-001` — _fleetctl reports/legacy-queries support is part of the same backward-compat verification._
- `FI-RENAME-006` → `FI-RENAME-002` — _Generic one-step 'logging/webhooks/streaming behave for reports' check; subsumed by full-functionality verification._
- `FI-RENAME-007` → `FI-RENAME-002` — _Vague one-step 'frontend reflects rename' check; subsumed by full reports functionality verification._
- `GITOPS-SW-002` → `GITOPS-SW-001` — _Same add-FMA behavior differing only by No-team vs team scope; collapse into the team case._
- `GITOPS-SW-014` → `GITOPS-SW-013` — _Mixing inline/multi/old/list formats is the same backward-compat surface as SW-013; fold in._
- `MDM-PROFILES-003` → `MDM-PROFILES-017` — _Label targeting on profile rows; source #14715 already unioned into the P0 targeting superset_
- `MDM-PROFILES-005` → `MDM-PROFILES-017` — _Exclude-any label targeting; source #17315 explicitly unioned into the P0 cross-platform targeting case_
- `MDM-PROFILES-007` → `MDM-PROFILES-017` — _Include-any label targeting; source #22156 explicitly unioned into the P0 cross-platform targeting case_
- `MDM-ENROLL-002` → `MDM-ENROLL-003` — _Migration-failure server logging is a narrow negative path within the macOS migration workflow already exercised by the P0 hero MDM-ENROLL-003._
- `MDM-ENROLL-027` → `MDM-ENROLL-003` — _Re-opening the Remote Management pane is a single-step robustness check inside the macOS end-user migration flow covered by MDM-ENROLL-003._
- `MDM-ENROLL-034` → `MDM-ENROLL-017` — _Same migration-vs-bootstrap behavior; env-var override is the inverse of 017's default no-install-during-migration rule._
- `MDM-CERTS-005` → `MDM-CERTS-004` — _Custom SCEP renewal on macOS is structurally identical to NDES renewal (MDM-CERTS-004): same SCEP_RENEWAL_ID substitution, same threshold, same removal-on-team-move; only the CA variable names differ._
- `MDM-CERTS-014` → `MDM-CERTS-013` — _IdP full-name variable is the same IdP-attribute-variable behavior (populate, auto-resend on change, missing-value error) as MDM-CERTS-013_
- `MDM-CERTS-016` → `MDM-ENROLL-014` — _Same behavior: macOS local account creation + IdP password sync; ROPG variant of the same account-creation flow._
- `ORCH-PLATFORM-024` → `MDM-PROFILES-004` — _Windows $FLEET_VAR_HOST_UUID populate/verify/GitOps/Free-reject is the built-in host-variable substitution behavior; fold into the variables case_
- `ORCH-PLATFORM-029` → `MDM-PROFILES-004` — _Windows hardware-serial variable - same built-in host-variable populate/verify/Free-reject behavior as the variables case_
- `ORCH-PLATFORM-031` → `MDM-PROFILES-004` — _$FLEET_VAR_HOST_PLATFORM across platforms - same built-in host-variable populate/verify/Free-reject behavior as the variables case_
- `ORCH-PLATFORM-036` → `MDM-CERTS-015` — _Premium gating of Google Workspace IdP host vitals is a tier-gate variant of the same SCIM/IdP host-vitals behavior; fold into the foundational SCIM case._
- `ORCH-PLATFORM-038` → `ORCH-PLATFORM-037` — _Single-step team-dropdown visibility variant (global maintainer) of the same Save-as-new flow._
- `ORCH-PLATFORM-039` → `ORCH-PLATFORM-037` — _Single-team maintainer dropdown-visibility variant of the same Save-as-new flow._
- `ORCH-PLATFORM-040` → `ORCH-PLATFORM-037` — _Multi-team maintainer dropdown-visibility variant of the same Save-as-new flow._
- `ORCH-PLATFORM-041` → `ORCH-PLATFORM-037` — _Free-tier negative (no dropdown) variant of the same Save-as-new flow._
- `ORCH-PLATFORM-043` → `ORCH-PLATFORM-042` — _Free-tier negative of label Targets (section hidden) plus delete-label modal copy; same feature as label targeting._
- `ORCH-PLATFORM-049` → `ORCH-PLATFORM-048` — _Same Queries section (same #27322) — empty states and pagination are details of the same host-details layout case._
- `ORCH-PLATFORM-050` → `ORCH-PLATFORM-048` — _Same combined Vitals section (same #27322), just on the My Device page; covered by the host-details layout case._
- `ORCH-POLICY-001` → `SEC-CONDACCESS-001` — _Entra-only conditional access configuration is subsumed by the broader Okta+Entra configuration case which covers config, gating, and GitOps._
- `ORCH-POLICY-003` → `ORCH-POLICY-002` — _Disabling/re-enabling conditional access to restore/re-block a failing host is the enforcement-toggle side of the same block-on-fail flow._
- `ORCH-POLICY-015` → `SEC-CIS-002` — _Same behavior (Windows 11 CIS policies pass/fail correctly); superseded by the newer v5.0.1 Win11 case._
- `ORCH-POLICY-016` → `SEC-CIS-003` — _Same behavior (macOS CIS policies pass/fail); macOS 13/14/15 superseded by current macOS 14/15/26 case._
- `ORCH-AGENT-003` → `EO-AGENT-001` — _Windows evented tables (dns_lookup_events/yara_events) returning data via live query; same table-resolution-via-live-query pattern._
- `ORCH-AGENT-008` → `ORCH-AGENT-006` — _Experimental Windows arm64 msi smoke test overlaps the native Windows Arm enrollment+live-query check in ORCH-AGENT-006; the broader management smoke is incidental to enrollment._
- `ORCH-AGENT-013` → `EO-AGENT-001` — _dns_resolvers table returning correct live-query data on Windows; same table-via-live-query pattern._
- `ORCH-AGENT-015` → `EO-AGENT-001` — _crowdstrike_falcon table returning data via live query on macOS; same table-resolution pattern._
- `ORCH-AGENT-016` → `EO-AGENT-001` — _crowdstrike_falcon table on Linux; cross-platform duplicate of the same table-via-live-query check._
- `ORCH-AGENT-017` → `EO-AGENT-001` — _file_contents/yaml_to_json tables returning data via live query; same table-resolution pattern._
- `ORCH-AGENT-018` → `EO-AGENT-001` — _containerd_mounts table returning data via live query; same table-resolution pattern._
- `ORCH-AGENT-021` → `EO-AGENT-001` — _local_network_permissions/macadmins_wifi_network tables returning data via live query; same table-resolution pattern._
- `ORCH-AGENT-022` → `EO-AGENT-001` — _app_platform_sso table returning new columns via live query; same table-resolution pattern._
- `ORCH-AGENT-023` → `EO-AGENT-001` — _EFI Signature Database certificate table returning data via live query; same table-resolution pattern._
- `ORCH-GITOPS-002` → `ORCH-GITOPS-001` — _Free-tier ignore-labels_include_any is the Free counterpart of the query round-trip; fold in._
- `PTP-ANDROID-003` → `PTP-ANDROID-002` — _Same action-menu-hidden check under a different gating state (MDM disabled vs pending)_
- `SEC-IDP-002` → `SEC-IDP-001` — _Changing the API IdP username to another existing user is a variant of set-via-API that updates derived fields; covered by the foundational case._
- `SEC-IDP-004` → `SEC-IDP-001` — _Changing the API username on a host that already had SCIM data is the same update-derived-fields behavior as the foundational set-via-API case._
- `SEC-IDP-008` → `SEC-IDP-007` — _Editing an existing IdP username via the UI is the same modal flow as the add-via-UI case, pre-populated._
- `SEC-IDP-010` → `SEC-IDP-009` — _Deleting the IdP username via the API yields the same removed-from-host-detail outcome as the UI remove case._
- `SEC-CERTS-004` → `SEC-CERTS-001` — _Android certificate install into the work-profile keystore reaching verified is the install half of SEC-CERTS-001's deploy/delete flow; same platform and CA type._
- `SEC-AGENT-004` → `SEC-SOFTWARE-004` — _npm_packages osquery-table check is covered by the broader global-npm inventory/vulnerability end-to-end case._
- `SEC-ENCRYPTION-001` → `ORCH-PLATFORM-014` — _Require-BitLocker-PIN setting and end-user PIN setup instructions are already covered by ORCH-PLATFORM-014 steps 1-4; remainder is updated-copy verification._
- `SEC-ENCRYPTION-007` → `SEC-ENCRYPTION-004` — _Same feature-disabled gating of the Show Recovery Lock password action; redundant with SEC-ENCRYPTION-004._
- `SEC-ENCRYPTION-010` → `SEC-ENCRYPTION-003` — _Global activity-feed lifecycle events (turned on/off, viewed, escrowed, manual/auto rotation) are aggregated from behaviors already verified by SEC-ENCRYPTION-002/003/005/008._
- `SEC-CIS-001` → `SEC-CIS-002` — _Same Windows CIS pass/fail behavior; one Windows CIS representative suffices._
- `SW-INV-006` → `SEC-SOFTWARE-007` — _programs.upgrade_code osquery-table check is subsumed by the broader upgrade_code API-contract case._
- `SW-INV-013` → `SEC-SOFTWARE-001` — _jetbrains_plugins osquery-table collection is subsumed by the end-to-end JetBrains extension inventory case._
- `SW-INV-014` → `SEC-SOFTWARE-003` — _vscode_extensions table collection of Windsurf/Cursor/VSCodium is subsumed by the end-to-end editor-extension inventory/vulnerability case._
- `SW-FMA-005` → `SW-PKG-005` — _Auto-install policy installs on hosts missing the app — same behavior as SW-PKG-005 (auto-install triggers install on compatible host)._
- `SW-FMA-006` → `SW-SS-010` — _Enable/disable self-service for an installer via Actions modal is covered by SW-SS-010 (enable) plus SW-SS-011 (disable)._
- `SW-FMA-010` → `SW-MISC-007` — _Software title with no installer/FMA shows Add software and counts existing hosts — same as SW-MISC-007 (non-FMA add-from-details, includes host count)._
- `SW-FMA-021` → `MDM-SOFTWARE-013` — _Same macOS ADE setup-experience install flow; host-record-update/no-adverse-refetch is covered by the P0 first-boot install spec._
- `SW-FMA-026` → `SW-FMA-025` — _Windows FMA inventory-name-vs-package-name matching is the complementary case to SW-FMA-025; same inventory-name-matching behavior._
- `SW-VPP-002` → `SW-VPP-001` — _Block-delete-until-auto-install-policy-removed is the delete half of the same VPP auto-install lifecycle in SW-VPP-001._
- `SW-VPP-004` → `MDM-SOFTWARE-009` — _VPP custom-label targeting (disabled until label, empty state) is covered by the comprehensive label-scoping case MDM-SOFTWARE-009._
- `SW-VPP-011` → `SW-VPP-010` — _Cancel a pending VPP uninstall is a single-step adjunct to the VPP uninstall flow in SW-VPP-010._
- `SW-VPP-019` → `MDM-SOFTWARE-010` — _VPP-verified-before-marked-installed is the same withhold-until-verified behavior already covered by the iOS setup install spec._
- `SW-AND-006` → `SW-AND-002` — _Rejecting unsupported top-level config keys is a validation facet of the managedConfiguration API behavior in SW-AND-002._
- `SW-AND-007` → `SW-AND-002` — _Rejecting invalid JSON config is a validation facet of the same Android configuration API as SW-AND-002._
- `SW-AND-010` → `SW-AND-012` — _Adding Android software to setup experience and logging the edit activity is subsumed by the BYOD auto-install spec's setup; keep one Android setup case._
- `SW-AND-014` → `SW-AND-012` — _Pending-count-when-offline is a status variant of the same Android BYOD setup install behavior._
- `SW-AND-015` → `SW-AND-012` — _Unenroll/re-enroll reinstall is the same Android setup-experience install behavior re-triggered; covered by the auto-install spec._
- `SW-PKG-011` → `SW-PKG-010` — _Pure inverse of SW-PKG-010 (enabled state, no tooltip); the enabled baseline is already exercised by the run-script keeps._
- `SW-PKG-015` → `SW-PKG-014` — _Carve upload/download is the parallel GCS IAM auth path; folds into the installer GCS case._
- `SW-SS-003` → `SW-INV-015` — _Failed self-service install shows Failed status and opens the shared failure-detail modal — same modal/behavior as SW-INV-015._
- `SW-SS-014` → `SW-FMA-009` — _Deleting an installer disabling its custom-policy install automation is the same detach behavior as SW-FMA-009._
- `SW-SETUP-003` → `MDM-SOFTWARE-012` — _Select-all toggle is part of the software-list bulk-select UI already covered by the consolidated selection spec._
- `SW-SETUP-008` → `SW-SETUP-006` — _Upgrade-preserves-label-scoping then out-of-scope-host-not-installed is the same label-scoping enforcement behavior plus an upgrade precondition._
- `SW-MISC-004` → `SW-MISC-003` — _Same #27309 transparency-URL branding behavior, just the Secureframe-enabled variant; collapse into the default case._
- `SW-MISC-006` → `SW-FMA-002` — _Add software from a title detail page when an FMA is available is the same FMA-from-details add flow as SW-FMA-002._
- `SW-MISC-017` → `SW-MISC-016` — _Same GeoIP location feature (same #s), inverse condition; collapse into the GeoIP location case._
- `SW-MISC-019` → `SW-MISC-018` — _Same iOS location feature, inverse ownership (personal) case; collapse into the iOS location case._
- `SW-MISC-023` → `SW-MISC-022` — _Counterpart of the same Save-button gating (enabled on Free / with allow_disable_telemetry); folds in._

## Moved (re-homed to another feature area)
- `GITOPS-SW-005` GITOPS → SWDEP — _Copy-slug-from-details-modal is a UI software-deployment behavior, not a GitOps flow._
- `GITOPS-ORCH-009` GITOPS → ACTIVITY — _About activity-feed avatar/actor_api_only rendering for API-only users, not a GitOps behavior._
- `MDM-SCRIPTS-013` ENROLL → SCRIPT — _Primarily verifies running library scripts (windows-unenroll-mdm / windows-remove-fleetd) and their status/output, i.e. Scripts Library execution behavior._
- `MDM-ENROLL-023` SETUP → ENROLL — _Puppet preassign/match endpoints creating teams and inheriting setup assistant is a puppet enrollment integration, not core setup-experience UX._
- `MDM-ACTIVITY-003` MDMCMD → ACTIVITY — _Primarily per-host activity-feed mechanics (toggle, tabs, sort, badges, command details modal)_
- `ORCH-PLATFORM-004` HOSTS → SWINV — _Behavior under test is the software details modal contents (version, type, vulnerabilities) — software inventory, not a host-specific check._
- `ORCH-PLATFORM-005` SWINV → SWDEP — _Public list-software API for installable/self-service packages assigned to teams is software deployment, not inventory/vulnerabilities._
- `ORCH-PLATFORM-008` SETTINGS → SWDEP — _MSP bulk-ops dashboard all-teams software transfer behavior belongs in software deployment._
- `ORCH-PLATFORM-017` HOSTS → SETTINGS — _Generic teams-dropdown search/filter UI component, not a host feature behavior._
- `ORCH-SETUP-009` SETUP → GITOPS — _fleetctl preview seeding starter scripts/policies/queries is a fleetctl bootstrap/preview behavior, not the host setup experience feature._
- `ORCH-SETUP-010` SETUP → GITOPS — _fleetctl preview with Premium license seeding teams is a fleetctl preview behavior, not the host setup experience feature._
- `SEC-AGENT-001` SWINV → QUERY — _Santa allow/deny osquery-table behavior surfaced via live query; security agent telemetry, not software inventory._
- `SEC-AGENT-002` SWINV → QUERY — _santa_status osquery-table reconciliation via live query; agent telemetry, not software inventory._
- `SEC-AGENT-005` SWINV → QUERY — _mcp_listening_servers detection via live query is an osquery agent-table behavior, not software inventory/vulnerabilities._
- `SW-INV-022` QUERY → HOSTS — _Cosmetic disabled-state (cursor/hover/copy) of the Edit label query text area on the Hosts page; belongs to label editing, not Queries & Reports._
- `SW-FMA-023` SWDEP → GITOPS — _FMA version-freezing manifest behavior tested via repo checkout + maintained-apps ingest tooling, not Fleet UI/deploy; build/ingest concern._
- `SW-FMA-024` SWDEP → GITOPS — _Manual (un)install scripts for Homebrew FMAs validated via local ingest script/input-file fields, not Fleet deployment UI._
- `SW-VPP-024` SWINV → SWDEP — _Custom software icon override for a VPP-associated app is app-deployment/installer presentation, not inventory/vulnerability detection._
- `SW-PKG-001` SWINV → SWDEP — _Software detail page for an uploaded installer (versions, policies, install-status table) is software deployment, not inventory/vulnerabilities._
- `SW-PKG-002` SWINV → SWDEP — _Installer software-detail version-list pagination belongs to software deployment package detail view._
- `SW-PKG-008` SWINV → SWDEP — _Copy installer SHA256 hash from the package detail page is a software-deployment installer feature._
- `SW-PKG-009` SWINV → SWDEP — _Installer SHA256 copy role/GitOps access is a software-deployment package feature._
- `SW-MISC-013` PROFILE → OSUPDATE — _Verifies settings/policies/labels survive an OS 26 major upgrade - belongs in OS-updates area, not configuration-profiles core_
