# Round 2 — flow index

Every one of the 127 source flows that survived [triage](TRIAGE.md), and where it went. Use this to answer
"what happened to *this* flow?"; the batch files are where the work is described.

| Source flow | Batch | Target spec | Kind |
|---|---|---|---|
| `activity-feed/host-activity-show-configuration-profile-name-and-status` | [E](E-label-targeting.md) | `tests/e2e/premium/controls/os-settings/profile-delivery-retry.spec.ts` | **new** |
| `activity-feed/individual-activity-items-for-all-attempts-for-failed-software-scripts` | [G](G-out-of-band.md) | `tests/e2e/premium/exclusive/policies/policy-automation-runs.spec.ts` | **new** — merged with the script-retries flow: 3 attempts |
| `api-max-request-file-sizes/run-mdm-commands-with-file-size-3mb` | [A](A-no-setup.md) | `tests/api/premium/max-request-file-sizes.spec.ts` | augment |
| `api-max-request-file-sizes/run-mdm-commands-with-files-less-than-2mb` | [A](A-no-setup.md) | `tests/api/premium/max-request-file-sizes.spec.ts` | augment |
| `api-max-request-file-sizes/upload-multiple-batch-profiles-totaling-greater-2621mb` | [A](A-no-setup.md) | `tests/api/premium/max-request-file-sizes.spec.ts` | augment |
| `api-max-request-file-sizes/upload-multiple-batch-scripts-greater-than-2621-mb` | [A](A-no-setup.md) | `tests/api/premium/max-request-file-sizes.spec.ts` | augment |
| `api/update-mac-host-idp-username-via-api` | [F](F-provisioning.md) | `tests/e2e/premium/hosts/host-idp-username.spec.ts` | **new** |
| `automatic-host-vitals-refetch/installs-and-uninstalls-automatically-triggers-host-vitals-refetch-fleet-maintained` | [D](D-host-execution.md) | `tests/e2e/premium/software/inventory-reflects-install.spec.ts` | **moved to D** — read-only half is a DUP of `host-details-smoke` |
| `certificates/host-details-and-my-device-page-greater-certificates-add-more-columns` | [C](C-host-reads.md) | `tests/e2e/shared/hosts/host-certificates.spec.ts` | **new** · **retargeted to shared** |
| `configuration-profiles/configuration-profile-declarations-including-excluding-labels-macos` | [E](E-label-targeting.md) | `tests/e2e/premium/controls/os-settings/profile-declarations.spec.ts` | **new** |
| `configuration-profiles/configuration-profiles-broken-deleted-label-profiles-are-not-applied-to-hosts-macos` | [E](E-label-targeting.md) | `tests/e2e/premium/controls/os-settings/profile-broken-labels.spec.ts` | **new** |
| `configuration-profiles/configuration-profiles-broken-deleted-label-profiles-are-not-applied-to-hosts-windows` | [E](E-label-targeting.md) | `tests/e2e/premium/controls/os-settings/profile-broken-labels.spec.ts` | **new** |
| `configuration-profiles/configuration-profiles-custom-targets-with-include-all-and-exclude` | [E](E-label-targeting.md) | `tests/e2e/premium/controls/os-settings/profile-label-targets.spec.ts` | **new** |
| `configuration-profiles/configuration-profiles-custom-targets-with-include-any-and-exclude` | [E](E-label-targeting.md) | `tests/e2e/premium/controls/os-settings/profile-label-targets.spec.ts` | **new** |
| `configuration-profiles/configuration-profiles-declarations-broken-state-declarations-are-not-applied-macos` | [E](E-label-targeting.md) | `tests/e2e/premium/controls/os-settings/profile-declarations.spec.ts` | **new** |
| `configuration-profiles/configuration-profiles-include-any-label-on-custom-targets-macos` | [E](E-label-targeting.md) | `tests/e2e/premium/controls/os-settings/profile-label-targets.spec.ts` | **new** |
| `configuration-profiles/configuration-profiles-include-exclude-labels-macos-hosts` | [E](E-label-targeting.md) | `tests/e2e/premium/controls/os-settings/profile-label-targets.spec.ts` | **new** |
| `configuration-profiles/configuration-profiles-include-exclude-labels-windows-hosts` | [E](E-label-targeting.md) | `tests/e2e/premium/controls/os-settings/profile-label-targets.spec.ts` | **new** |
| `configuration-profiles/macos-configurations-profiles-retry-3-times` | [E](E-label-targeting.md) | `tests/e2e/premium/controls/os-settings/profile-delivery-retry.spec.ts` | **new** |
| `configuration-profiles/resend-configuration-profile` | [E](E-label-targeting.md) | `tests/e2e/premium/controls/os-settings/profile-delivery-retry.spec.ts` | **new** |
| `controls/batch-script-execution-on-hosts` | [D](D-host-execution.md) | `tests/e2e/premium/controls/scripts/batch-run.spec.ts` | **new** |
| `controls/batch-script-on-hundreds-of-hosts` | [D](D-host-execution.md) | `tests/e2e/premium/controls/scripts/batch-run.spec.ts` | **new** |
| `controls/controls-macos-custom-settings-upload-and-remove-configuration-profile` | [E](E-label-targeting.md) | `tests/e2e/premium/controls/os-settings/configuration-profiles.spec.ts` | augment |
| `controls/controls-macos-custom-settings-verify-warning-symbol-upon-deleting-custom-label-from-hosts` | [E](E-label-targeting.md) | `tests/e2e/premium/controls/os-settings/profile-broken-labels.spec.ts` | **new** |
| `controls/controls-macos-updates-ui-validation` | [E](E-label-targeting.md) | `tests/e2e/premium/exclusive/os-updates/macos-updates.spec.ts` | **new** |
| `controls/disable-script-execution-free [FREE]` | [D](D-host-execution.md) | `tests/e2e/shared/exclusive/script-execution-disabled.spec.ts` | **new** (moved to the exclusive project) |
| `controls/disable-script-execution-premium` | [D](D-host-execution.md) | `tests/e2e/shared/exclusive/script-execution-disabled.spec.ts` | **new** (moved to the exclusive project) |
| `controls/error-script-fails-in-ui-free [FREE]` | [D](D-host-execution.md) | `tests/e2e/shared/hosts/host-run-script.spec.ts` | **new** |
| `controls/error-script-fails-in-ui-premium` | [D](D-host-execution.md) | `tests/e2e/shared/hosts/host-run-script.spec.ts` | **new** |
| `controls/script-timeout-free [FREE]` | [D](D-host-execution.md) | `tests/e2e/shared/hosts/host-run-script.spec.ts` | **new** |
| `controls/script-timeout-premium` | [D](D-host-execution.md) | `tests/e2e/shared/hosts/host-run-script.spec.ts` | **new** |
| `controls/scripts-execution-free [FREE]` | [D](D-host-execution.md) | `tests/e2e/shared/hosts/host-run-script.spec.ts` | **new** |
| `controls/scripts-execution-premium` | [D](D-host-execution.md) | `tests/e2e/shared/hosts/host-run-script.spec.ts` | **new** |
| `custom-icons/add-edit-and-delete-custom-icons` | [B](B-self-contained.md) | `tests/e2e/premium/software/custom-icons.spec.ts` | **new** |
| `custom-icons/only-valid-icons-can-be-uploaded-size-dimensions-are-respected` | [B](B-self-contained.md) | `tests/e2e/premium/software/custom-icons.spec.ts` | **new** |
| `custom-software-updates-ddm/cannot-deploy-custom-software-update-enforcement-declaration-ddm-when-manage-os-settings-are-set-macos` | [E](E-label-targeting.md) | `tests/e2e/premium/exclusive/os-updates/ddm-conflict.spec.ts` | **new** |
| `custom-software-updates-ddm/cannot-deploy-custom-software-update-enforcement-declaration-ddm-when-manage-os-settings-are-set-windows` | [E](E-label-targeting.md) | `tests/e2e/premium/exclusive/os-updates/ddm-conflict.spec.ts` | **new** |
| `dashboard/dashboard-widgets-hosts-active-ui-and-filters` | [A](A-no-setup.md) | `tests/e2e/premium/dashboard/fleet-scoped-cards.spec.ts` | **new** |
| `dashboard/dashboard-widgets-vulnerability-exposure` | [A](A-no-setup.md) | `tests/e2e/premium/dashboard/fleet-scoped-cards.spec.ts` | **new** |
| `dashboard/display-and-filter-platform-cards-global-admin` | [A](A-no-setup.md) | `tests/e2e/shared/dashboard/platform-cards.spec.ts` | **new** |
| `dashboard/display-and-filter-platform-cards-global-admin [FREE]` | [A](A-no-setup.md) | `tests/e2e/shared/dashboard/platform-cards.spec.ts` | **new** |
| `dashboard/display-and-filter-platform-cards-global-maintainer` | [A](A-no-setup.md) | `tests/e2e/shared/dashboard/platform-cards.spec.ts` | **new** |
| `dashboard/display-and-filter-platform-cards-global-observer` | [A](A-no-setup.md) | `tests/e2e/shared/dashboard/platform-cards.spec.ts` | **new** |
| `fleet-maintained-filters/Fleet maintained apps filter` | [A](A-no-setup.md) | `tests/e2e/premium/software/fleet-maintained-filters.spec.ts` | **new** |
| `fleet-maintained-filters/failing-policies/confirm-script-ran-in-ui-on-failing-host-policy` | [G](G-out-of-band.md) | — | **cut · DUP** of `tests/e2e/premium/exclusive/policies/policy-automation-runs.spec.ts` — the failing case shows the automation firing; only "a success isn't retried" is left (G decision 4) |
| `general/disable-hosts-online-and-vulnerabilities-chart-fleets-only` | [B](B-self-contained.md) | `tests/e2e/premium/dashboard/historical-data-collection.spec.ts` | **new** — moved from A; A's `fleet-scoped-cards.spec.ts` keeps the read-only half |
| `general/upload-edit-delete-custom-logo-from-fleet-organization-dark-mode` | [B](B-self-contained.md) | `tests/e2e/shared/settings/organization/custom-logo.spec.ts` | **new** |
| `general/upload-edit-delete-custom-logo-from-fleet-organization-light-mode` | [B](B-self-contained.md) | `tests/e2e/shared/settings/organization/custom-logo.spec.ts` | **new** |
| `gitops/gitops-gitops-mode-in-navbar-and-learn-more-url` | [G](G-out-of-band.md) | `tests/e2e/premium/gitops-mode/01-indicator-and-links.spec.ts` | **new** |
| `gitops/gitops-mode-gated-areas-of-the-ui-controls` | [G](G-out-of-band.md) | `tests/e2e/premium/gitops-mode/02-gated-surfaces.spec.ts` | **new** |
| `gitops/gitops-mode-gated-areas-of-the-ui-hosts` | [G](G-out-of-band.md) | `tests/e2e/premium/gitops-mode/02-gated-surfaces.spec.ts` | **new** |
| `gitops/gitops-mode-gated-areas-of-the-ui-settings` | [G](G-out-of-band.md) | `tests/e2e/premium/gitops-mode/02-gated-surfaces.spec.ts` | **new** |
| `gitops/gitops-mode-yaml-links-lead-to-repository-url` | [G](G-out-of-band.md) | `tests/e2e/premium/gitops-mode/01-indicator-and-links.spec.ts` | **new** |
| `hosts-details/host-details-software-filter-by-top-level-applications-installed-applications-appear-in-applications-filtered` | [C](C-host-reads.md) | `tests/e2e/shared/hosts/host-software.spec.ts` | augment |
| `hosts/labels-include-all-install-software-on-hosts-that-include-all-labels-and-hosts-that-do-not-include-all-labels-do-not-install-software` | [E](E-label-targeting.md) | `tests/e2e/premium/software/software-label-targets.spec.ts` | **new** |
| `hosts/labels-include-any-add-software-to-hosts-that-include-any-labels-and-hosts-that-do-not-include-any-labels-cannot-install-software` | [E](E-label-targeting.md) | `tests/e2e/premium/software/software-label-targets.spec.ts` | **new** |
| `idp/update-and-remove-host-idp-username-via-ui` | [F](F-provisioning.md) | `tests/e2e/premium/hosts/host-idp-username.spec.ts` | **new** — free sibling `tests/e2e/free/hosts/host-idp-username.spec.ts` |
| `mac-os-accounts/automatically-rotate-recovery-lock-password` | [F](F-provisioning.md) | `tests/e2e/premium/hosts/recovery-lock.spec.ts` | **new** — full flow on the Mac VM |
| `mac-os-accounts/set-plus-manually-rotate-macos-recovery-lock-passwords` | [F](F-provisioning.md) | `tests/e2e/premium/hosts/recovery-lock.spec.ts` | **new** — same flow as the one above |
| `mdm/manual-mdm-enrollment-mac-enrollment-profile` | [F](F-provisioning.md) | — | **cut · DUP** of `tests/e2e/shared/hosts/host-run-script.spec.ts` — the flow runs a script on a macOS host; no enrollment profile |
| `mdm/manual-mdm-enrollment-mac-enrollment-profile [FREE]` | [F](F-provisioning.md) | — | **cut · DUP** of `tests/e2e/shared/hosts/host-run-script.spec.ts` (runs on free too) |
| `mdm/mdm-command-details-show-on-global-and-host-activity` | [D](D-host-execution.md) | `tests/e2e/shared/hosts/mdm-commands.spec.ts` | **new** (shared — same surface on free) |
| `mdm/past-and-upcoming-host-activities-add-mdm-commands-macos-ios-ipados` | [D](D-host-execution.md) | `tests/e2e/shared/hosts/mdm-commands.spec.ts` | **new** (shared — same surface on free) |
| `mdm/run-mdm-command-macos-premium` | [D](D-host-execution.md) | `tests/e2e/shared/hosts/mdm-commands.spec.ts` | **new** (shared — same surface on free) |
| `packages/add-custom-package-that-only-contains-a-script` | [B](B-self-contained.md) | `tests/e2e/premium/software/script-only-package.spec.ts` | **new** |
| `policies/enabling-continuous-software-and-script-automations-on-a-policy-retries-every-hour` | [G](G-out-of-band.md) | `tests/e2e/premium/exclusive/policies/policy-automation-runs.spec.ts` | **new** — refetch-driven, one test with the 3-attempt case (G decisions 1, 3) |
| `policies/global-activity-item-is-shown-when-a-policy-is-automatically-created-during-software-installer-add` | [D](D-host-execution.md) | `tests/e2e/premium/software/install-on-host.spec.ts` | **new** |
| `policies/global-admin-able-to-create-and-delete-an-os-specific-policy-premium` | [G](G-out-of-band.md) | — | **cut · DUP** of `tests/e2e/premium/policies/policies.spec.ts` — never sets a platform; create → delete only (G decision 4) |
| `policies/manage-all-automations-for-a-given-policy-at-once` | [G](G-out-of-band.md) | `tests/e2e/premium/policies/policy-automations.spec.ts` | augment |
| `policies/patch-policy-fleet-maintained-apps` | [G](G-out-of-band.md) | `tests/e2e/premium/software/patch-policy.spec.ts` | **new** — on Workstations, with Fleet-maintained apps no other spec adds |
| `policies/policies-include-all` | [E](E-label-targeting.md) | `tests/e2e/premium/policies/policy-label-targets.spec.ts` | **new** |
| `policies/report-include-all` | [E](E-label-targeting.md) | `tests/e2e/premium/reports/report-label-targets.spec.ts` | **new** |
| `policies/script-run-retries-up-to-3-times-when-triggered-by-a-policy-automation` | [G](G-out-of-band.md) | `tests/e2e/premium/exclusive/policies/policy-automation-runs.spec.ts` | **new** — 3 attempts in total |
| `policies/software-installs-retry-up-to-3-times-when-triggered-by-a-policy-automation` | [G](G-out-of-band.md) | `tests/e2e/premium/exclusive/software/deploy-install-retries.spec.ts` | **new** — a Deploy whose per-run amd64 `.deb` the VM refuses (G decision 5; in `premium-exclusive`, fleetdm/fleet#54607) |
| `python/run-python-script-on-macos-host` | [D](D-host-execution.md) | `tests/e2e/shared/hosts/host-run-script.spec.ts` | **new** |
| `python/run-python-script-with-policy-automation-on-macos-host` | [G](G-out-of-band.md) | `tests/e2e/premium/exclusive/policies/policy-automation-runs.spec.ts` | **new** — the automation's script is Python, on the Ubuntu VM: the Macs have no `python3` (G decisions 2, 4) |
| `queries-global-users/global-admin-able-to-select-teams-target-for-query-premium` | [A](A-no-setup.md) | `tests/e2e/premium/reports/reports.spec.ts` | augment · check DUP |
| `reports/reports-filter-by-newer-results` | [C](C-host-reads.md) | `tests/e2e/shared/hosts/host-reports-tab.spec.ts` | augment · **retargeted** |
| `reports/reports-filter-by-newer-results [FREE]` | [C](C-host-reads.md) | `tests/e2e/shared/hosts/host-reports-tab.spec.ts` | augment · **retargeted** |
| `reports/reports-reports-show-first-result` | [C](C-host-reads.md) | `tests/e2e/premium/hosts/host-report-details.spec.ts` | augment |
| `scripts/Add a .sh script as a software package` | [B](B-self-contained.md) | `tests/e2e/premium/software/script-only-package.spec.ts` | **new** |
| `software-vulnerabilities/view-affected-hosts-on-vulnerability` | [C](C-host-reads.md) | `tests/e2e/premium/software/vulnerabilities.spec.ts` | augment |
| `software/Versions and Pinning/pin-fleet-maintained-app-software-versions-to-an-older-version` | [B](B-self-contained.md) | `tests/e2e/premium/software/version-pinning.spec.ts` | **new** |
| `software/Versions and Pinning/pin-fleet-maintained-app-software-versions-to-latest` | [B](B-self-contained.md) | `tests/e2e/premium/software/version-pinning.spec.ts` | **new** |
| `software/Versions and Pinning/pin-fleet-maintained-app-software-versions-to-major-version` | [B](B-self-contained.md) | `tests/e2e/premium/software/version-pinning.spec.ts` | **new** |
| `software/download-scripts-on-software` | [B](B-self-contained.md) | `tests/e2e/premium/software/package-scripts.spec.ts` | **new** |
| `software/exclude-software-when-using-get-hosts-identifier-identifier-api-endpoint` | [A](A-no-setup.md) | `tests/api/host-software-payload.spec.ts` | **new** · **retargeted to tier-agnostic** (not premium-gated) |
| `software/failing-uninstall-keeps-installed-files-and-statuses` | [D](D-host-execution.md) | `tests/e2e/premium/software/uninstall-from-host.spec.ts` | **new** |
| `software/filter-by-installable-software` | [A](A-no-setup.md) | `tests/e2e/premium/software/titles-table.spec.ts` | **new** (Library tab is premium-only) |
| `software/install-and-delete-rpm-files-on-rpm-based-linux-hosts-fedora` | [F](F-provisioning.md) | — | **long-term goals** — no RPM-based host ([`long-term-goals.md`](../../long-term-goals.md#host-types)) |
| `software/install-software-through-fleet-maintained-page` | [D](D-host-execution.md) | `tests/e2e/premium/software/software-lifecycle-on-host.spec.ts` | **new** (the install; the catalog add is `library.spec.ts`'s) |
| `software/pending-and-failed-software-should-not-show-in-inventory-tab` | [D](D-host-execution.md) | `tests/e2e/premium/software/inventory-reflects-install.spec.ts` | **new** |
| `software/progress-indicator-appears-without-timeout-during-upload-of-large-software` | [D](D-host-execution.md) | `tests/e2e/premium/software/large-upload.spec.ts` | **new** |
| `software/run-zsh-scripts` | [D](D-host-execution.md) | `tests/e2e/shared/hosts/host-run-script.spec.ts` | **new** |
| `software/set-custom-display-names-for-software` | [B](B-self-contained.md) | `tests/e2e/premium/software/display-name.spec.ts` | **new** |
| `software/software-installer-file-over-1gb` | [D](D-host-execution.md) | `tests/e2e/premium/software/large-upload.spec.ts` | **new** |
| `software/software-installer-selecting-no-team-prompts-user-to-choose-team` | [A](A-no-setup.md) | — | **DUP, skipped** — `library.spec.ts` already asserts Add-software disabled under All fleets |
| `software/software-installers-add-software-installers-linux` | [D](D-host-execution.md) | `tests/e2e/premium/software/software-lifecycle-on-host.spec.ts` | **new** (the install; the add is `library.spec.ts`'s) |
| `software/software-installers-add-software-installers-macos` | [D](D-host-execution.md) | `tests/e2e/premium/software/software-lifecycle-on-host.spec.ts` | **new** (the install; the add is `library.spec.ts`'s) |
| `software/software-installers-add-software-installers-windows` | [D](D-host-execution.md) | `tests/e2e/premium/software/software-lifecycle-on-host.spec.ts` | **new** (the install; the add is `library.spec.ts`'s) |
| `software/software-installers-non-allowed-file-types` | [A](A-no-setup.md) | `tests/e2e/premium/software/add-software-validation.spec.ts` | **new** |
| `software/software-newly-installed-software-is-available-on-the-inventory-tab` | [D](D-host-execution.md) | `tests/e2e/premium/software/inventory-reflects-install.spec.ts` | **new** |
| `software/sort-software-on-columns` | [A](A-no-setup.md) | `tests/e2e/shared/software/titles-table.spec.ts` | **new** · **split shared + premium** |
| `software/uninstall-software-packages-debs` | [D](D-host-execution.md) | `tests/e2e/premium/software/software-lifecycle-on-host.spec.ts` | **new** |
| `software/uninstall-software-packages-exe` | [D](D-host-execution.md) | `tests/e2e/premium/software/software-lifecycle-on-host.spec.ts` | **new** |
| `software/uninstall-software-packages-msi` | [D](D-host-execution.md) | `tests/e2e/premium/software/software-lifecycle-on-host.spec.ts` | **new** |
| `software/uninstall-software-packages-pkgs` | [D](D-host-execution.md) | `tests/e2e/premium/software/software-lifecycle-on-host.spec.ts` | **new** |
| `software/view-installed-script-advanced-options` | [B](B-self-contained.md) | `tests/e2e/premium/software/package-scripts.spec.ts` | **new** |
| `software/view-software-os-tab-premium` | [C](C-host-reads.md) | `tests/e2e/premium/software/os.spec.ts` | augment |
| `software/view-software-page-as-global-maintainer` | [A](A-no-setup.md) | `tests/e2e/premium/software/role-access.spec.ts` | **new** |
| `software/view-software-page-as-global-observer-premium` | [A](A-no-setup.md) | `tests/e2e/premium/software/role-access.spec.ts` | **new** |
| `software/view-software-page-as-team-admin-premium` | [A](A-no-setup.md) | `tests/e2e/premium/software/role-access.spec.ts` | **new** |
| `software/view-software-page-as-team-maintainer-premium` | [A](A-no-setup.md) | `tests/e2e/premium/software/role-access.spec.ts` | **new** |
| `technician-user/technician-role-can-transfer-hosts-between-fleets` | [F](F-provisioning.md) | `tests/e2e/premium/hosts/host-transfer-permissions.spec.ts` | augment |
| `uncategorized/all-teams-view-switching-tabs` | [A](A-no-setup.md) | `tests/e2e/premium/software/no-teams-views.spec.ts` | augment |
| `uncategorized/created-2fa-enabled-user-cannot-re-use-sign-in-magic-link` | [F](F-provisioning.md) | — | **long-term goals** — needs SMTP + a readable mailbox ([`long-term-goals.md`](../../long-term-goals.md#a-readable-mailbox)) — the 2FA checkbox half is in `premium/settings/users/regular-user-create.spec.ts` |
| `uncategorized/global-admin-is-able-to-edit-user-to-use-2fa` | [F](F-provisioning.md) | — | **long-term goals** — needs SMTP + a readable mailbox — the 2FA checkbox half is in `premium/settings/users/regular-user-create.spec.ts` |
| `uncategorized/invite-2fa-enabled-user-and-log-in-as-the-user` | [F](F-provisioning.md) | — | **long-term goals** — needs SMTP + a readable mailbox — the 2FA checkbox half is in `premium/settings/users/regular-user-create.spec.ts` |
| `uncategorized/other-workflows-modal-saving-disables-form-inputs` | [A](A-no-setup.md) | `tests/e2e/premium/policies/policy-automations.spec.ts` | augment |
| `uncategorized/run-mdm-command-macos-free [FREE]` | [D](D-host-execution.md) | `tests/e2e/shared/hosts/mdm-commands.spec.ts` | **new** (shared — same surface on free) |
| `uncategorized/succeeded-ran-script-on-host-does-not-show-pending-when-modal-is-closed` | [D](D-host-execution.md) | `tests/e2e/shared/hosts/host-run-script.spec.ts` | **new** |
| `uncategorized/vulnerability-severity-filter-lists-options-from-critical-down` | [A](A-no-setup.md) | `tests/e2e/premium/software/vulnerabilities.spec.ts` | augment |
| `user-profiles/team-admin-able-to-edit-a-team-member-premium` | [F](F-provisioning.md) | `tests/e2e/premium/settings/users/team-admin-scope.spec.ts` | **new** |
| `user-profiles/team-admin-able-to-edit-team-name-premium` | [F](F-provisioning.md) | `tests/e2e/premium/settings/users/team-admin-scope.spec.ts` | **new** — merged; the rename is asserted, never saved |
| `user-profiles/team-admin-unable-to-click-manage-automations-button-premium` | [A](A-no-setup.md) | `tests/e2e/premium/software/manage-automations-access.spec.ts` | augment |
| `user-profiles/team-maintainer-unable-to-click-manage-automations-button-premium` | [A](A-no-setup.md) | `tests/e2e/premium/software/manage-automations-access.spec.ts` | augment |
| `vpp/add-android-software-from-add-app-page` | [B](B-self-contained.md) | `tests/e2e/premium/software/library.spec.ts` | augment · check DUP |
