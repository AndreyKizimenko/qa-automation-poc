# C7 — Settings cluster — audit

Scope: user CRUD + password + API-token, team CRUD, enroll secrets, org info / advanced / fleet web address,
Fleet Desktop, script upload as roles, automatic enrollment, macOS-updates team-scoping, CTA-visibility-by-role,
manage-automations button visibility, team-section-in-create-user-modal.

## Disposition table

| # | QA Wolf flow (basename) | Tier | Behavior (1 line) | Disposition | Target (existing or proposed path) | Notes |
|---|---|---|---|---|---|---|
| 1 | settings-admin-able-to-edit-existing-users-password | Free | Admin sets another user's password via row Actions→Edit; user logs in with it | AUGMENT | tests/e2e/free/settings/users/edit.spec.ts | edit.spec covers name/role edit only, not the password field. Graft "admin edits password → target logs in with new pw". MERGE-pair with #8. Verify login via `withStaticUser`/`loginAsAdmin`, not the flow's self-service change-password (that is already covered by shared/account/change-password.spec.ts). |
| 2 | settings-create-edit-and-delete-user | Free | Full create/edit/delete user lifecycle | DUP | tests/e2e/free/settings/users/{regular-user-create,edit,delete}.spec.ts | Fully covered at greater depth (activity-feed asserts, role cells). Flow's login-as-new-user + "sees/doesn't see Settings" is role-access noise; our role-access API specs cover perms. |
| 3 | settings-edit-advanced-options | Free | Edit domain/Verify-SSL/STARTTLS/host-expiry; persists on reload | NEW | tests/e2e/free/settings/organization/advanced-options.spec.ts | No spec exists. `OrganizationAdvancedPage` POM is a bare goto() — needs field + save/toast methods. MERGE-pair with #13. Mutates global appConfig → needs save/restore (see POM/helper work). |
| 4 | settings-edit-fleet-web-address | Free | Edit Fleet app URL; persists on reload | NEW | tests/e2e/free/settings/organization/fleet-web-address.spec.ts | No spec; no POM (subpage under org settings). MERGE-pair with #14. RISK: rewriting the live server URL can break the instance/auth — likely assert form round-trip in a save/restore guard or reduce to presence. Open question. |
| 5 | settings-edit-organization-information | Free | Edit org name + support URL; persists on reload | NEW | tests/e2e/free/settings/organization/organization-info.spec.ts | No spec. `OrganizationInfoPage` POM is bare goto() — needs orgName/supportURL fields + save. MERGE-pair with #15. Global appConfig mutation → save/restore. |
| 6 | settings-resetting-a-users-session-generates-a-new-api-token | Free | Reset sessions rotates the user's API token | AUGMENT | tests/e2e/shared/settings/users/row-actions.spec.ts | row-actions.spec already asserts the Reset-sessions toast; it does NOT assert the token actually changed. Graft a token-rotation check (capture token → reset → recapture, differ). Easiest via API (`deleteUserSessions` helper exists) rather than the flow's clipboard dance. MERGE with #19. |
| 7 | settings-add-enroll-secret-to-team-premium | Prem | Add an enroll secret to a team; new secret differs; appears in list | NEW | tests/e2e/premium/settings/enroll-secrets.spec.ts | No enroll-secret spec, POM, or helper anywhere. Flow creates/DELETES a team (forbidden) — rework to Workstations scope. POM GAP: Manage-enroll-secrets modal (reveal/add/delete secret). CUT the flow's "DO NOT DELETE magic secret" guard — QA-Wolf-instance infra; our cleanup model handles teardown. Overlaps enroll-secret add in #21/#23. |
| 8 | settings-admin-able-to-edit-existing-users-password | Prem | Admin sets another user's password (premium) | AUGMENT | tests/e2e/premium/settings/users/edit.spec.ts | Premium counterpart of #1. MERGE-pair with #1. |
| 9 | settings-admin-fleet-desktop-settings-should-be-visible-premium | Prem | Fleet Desktop tab + "Custom transparency URL" visible (premium) | NEW | tests/e2e/premium/settings/organization/fleet-desktop.spec.ts | Premium-only presence check; no spec, no POM. Small. Could fold into a broader premium org-settings spec. Free has no Fleet Desktop tab → premium-only. |
| 10 | settings-create-edit-and-delete-team-premium | Prem | Create → rename → delete a team | NEW | tests/api/gitops-verify/ (team lifecycle) — REWORK | CANNOT be an e2e CRUD spec: CLAUDE.md forbids team create/delete from test bodies (Workstations is gitops-provisioned). `createFleet`/`deleteFleet`/`recreateFleet` helpers exist for setup only. Recommend an API-level drift/lifecycle check or drop. Flag for human. |
| 11 | settings-create-edit-and-delete-user | Prem | Full user CRUD (premium) | DUP | tests/e2e/premium/settings/users/{regular-user-create,edit,delete}.spec.ts | Covered at greater depth (fleet assignment, Various/2-fleets cells, activity feed). |
| 12 | settings-displays-team-section-in-the-create-user-modal-for-global-admin-premium | Prem | "Fleets/Team" section present in create-user modal | CUT | (covered) tests/e2e/premium/settings/users/regular-user-create.spec.ts + form-validation.spec.ts | Trivial presence check. Premium create-user already toggles fleets (`toggleFleet`) and form-validation asserts `assignToFleetsRadio` checked — the section's existence is implicitly required. At most a one-line AUGMENT; not worth a spec. |
| 13 | settings-edit-advanced-options | Prem | Advanced options edit/persist (premium) | NEW | tests/e2e/premium/settings/organization/advanced-options.spec.ts | MERGE-pair with #3. |
| 14 | settings-edit-fleet-web-address | Prem | Fleet web address edit/persist (premium) | NEW | tests/e2e/premium/settings/organization/fleet-web-address.spec.ts | MERGE-pair with #4; same server-URL risk. |
| 15 | settings-edit-organization-information | Prem | Org info edit/persist (premium) | NEW | tests/e2e/premium/settings/organization/organization-info.spec.ts | MERGE-pair with #5. |
| 16 | settings-global-observer-cant-click-or-see-cta-buttons-on-hosts-details-page-premium | Prem | Global observer: no Transfer / custom-report / Delete / OS-policy CTAs on host details | MERGE | tests/e2e/premium/hosts/cta-visibility-by-role.spec.ts (proposed) | No hosts e2e area exists yet. Role-permutation set with #21/#23/#24. `hostsList`/`hostDetails` POM fixtures exist but no specs use them. Uses live host — needs a stable host given. Cross-cluster (hosts). |
| 17 | settings-macos-updates-settings-setup-options-only-apply-at-team-level | Prem | Disk encryption / OS-updates min-version+deadline / setup EUA are per-team, not global | NEW | tests/e2e/premium/controls/os-updates/team-scoping.spec.ts (proposed) | No os-updates/os-settings/setup-experience *scoping* spec. `OsSettingsPage`/`OsUpdatesPage`/`SetupExperiencePage` POMs exist. Rework: flow uses ad-hoc teams ("Team for macOS updates tests"/"Ducks") — use Workstations vs Unassigned. Cross-ref controls cluster. |
| 18 | settings-manage-automations-button-hidden-when-team-is-selected-admin-premium | Prem | Software "Manage automations" button disabled once a team is selected | NEW | tests/e2e/premium/software/automations-button-visibility.spec.ts (proposed) | Small. `SoftwareTitlesPage.manageAutomationsButton` locator exists; no spec asserts the disabled-on-team-select behavior. Cross-ref software cluster; could AUGMENT an existing software spec. |
| 19 | settings-resetting-a-users-session-generates-a-new-api-token | Prem | Reset sessions rotates API token (premium) | AUGMENT | tests/e2e/shared/settings/users/row-actions.spec.ts | MERGE with #6 (behavior is tier-agnostic; shared spec). |
| 20 | settings-successful-upload-of-sh-script-that-begins-with-anything-other-than-bin-sh-premium | Prem | .sh whose shebang ≠ #!/bin/sh uploads successfully (compat added 4.64) | AUGMENT | tests/e2e/premium/controls/scripts/library.spec.ts | Content edge case not covered by the marker-script cases. Add a shebang-variant fixture + upload assertion. Cross-ref controls/scripts cluster (owns it). |
| 21 | settings-team-admin-can-see-and-click-cta-buttons-premium | Prem | Team admin: can Add hosts, Manage enroll secret, Add label | MERGE | tests/e2e/premium/hosts/cta-visibility-by-role.spec.ts (proposed) | Role-permutation set with #16/#23/#24. ROLE GAP: no team-admin static user exists (static-users has ws-maintainer/ws-observer only). Enroll-secret add/delete here overlaps #7. Flow's `addHostsToTeam`-if-empty is QA-Wolf scaffolding. |
| 22 | settings-team-admin-can-update-managed-automations-premium | Prem | Team admin toggles report (query) automations on/off | NEW | tests/e2e/premium/reports/automations.spec.ts (proposed) | No reports-automations spec exists. Cross-ref reports cluster. ROLE GAP: no team-admin static user. Distinct page from #18 (reports vs software) — keep separate. |
| 23 | settings-team-maintainer-can-see-and-click-cta-buttons-premium | Prem | Team maintainer: can Add hosts, Manage enroll secret, Add label | MERGE | tests/e2e/premium/hosts/cta-visibility-by-role.spec.ts (proposed) | Role-permutation set with #16/#21/#24. `ws-maintainer` static user exists. Enroll-secret overlaps #7. |
| 24 | settings-team-observer-cant-see-and-click-cta-buttons-premium | Prem | Team observer: no Add hosts / Manage enroll secret / Add label | MERGE | tests/e2e/premium/hosts/cta-visibility-by-role.spec.ts (proposed) | Role-permutation set with #16/#21/#23. `ws-observer` static user exists. |
| 25 | settings-upload-and-delete-script-as-admin-to-no-team-premium | Prem | Admin uploads+deletes a script to No team (Unassigned) | DUP | tests/e2e/premium/controls/scripts/library.spec.ts | library.spec covers admin upload/edit/delete under Unassigned + Workstations with activity-feed asserts. AUGMENT-worthy extra only: cross-scope isolation (uploaded-to-Unassigned not visible under another team). Cross-ref controls/scripts. |
| 26 | settings-upload-script-as-maintainer-to-a-team-premium | Prem | Global maintainer uploads a script to a team; scope-isolated | AUGMENT | tests/e2e/premium/controls/scripts/library.spec.ts | library.spec runs as admin only — this adds a maintainer role variant + scope isolation. `ws-maintainer` static user covers it. Cross-ref controls/scripts cluster. |
| 27 | settings-uploader-should-fail-if-script-is-greater-500k-characters-premium | Prem | Script >500K chars rejected with size-limit toast | AUGMENT | tests/e2e/premium/controls/scripts/library.spec.ts | Negative-path validation not covered. Add a >500K fixture + toast assertion. Cross-ref controls/scripts cluster. |
| 28 | settings-view-and-edit-automatic-enrollment | Prem | MDM EULA PDF upload + SSO/IdP (name/entityId/metadataURL) settings + field tooltips | NEW | tests/e2e/premium/settings/integrations/automatic-enrollment.spec.ts (proposed) | No spec. `IntegrationsPage` POM only knows Ticket destinations + SCIM. Big POM GAP: Integrations→MDM (EULA upload/delete) and Integrations→SSO (idp form + tooltip copy). Overlaps mdm cluster — confirm ownership. |

## Summary

- Counts: DUP 3, AUGMENT 7, NEW 13, CUT 1, MERGE 4  (total 28)

### NEW specs recommended (proposed paths)
- `tests/e2e/{free,premium}/settings/organization/organization-info.spec.ts` (#5/#15 — tier pair)
- `tests/e2e/{free,premium}/settings/organization/advanced-options.spec.ts` (#3/#13 — tier pair)
- `tests/e2e/{free,premium}/settings/organization/fleet-web-address.spec.ts` (#4/#14 — tier pair; server-URL risk, see open questions)
- `tests/e2e/premium/settings/organization/fleet-desktop.spec.ts` (#9 — premium-only presence)
- `tests/e2e/premium/settings/enroll-secrets.spec.ts` (#7 — Workstations scope; new POM)
- `tests/e2e/premium/controls/os-updates/team-scoping.spec.ts` (#17 — reworked to Workstations/Unassigned; cross-ref controls)
- `tests/e2e/premium/software/automations-button-visibility.spec.ts` (#18 — small; cross-ref software)
- `tests/e2e/premium/reports/automations.spec.ts` (#22 — cross-ref reports; team-admin role)
- `tests/e2e/premium/hosts/cta-visibility-by-role.spec.ts` (#16/#21/#23/#24 MERGED — one role-permutation spec)
- `tests/e2e/premium/settings/integrations/automatic-enrollment.spec.ts` (#28 — cross-ref mdm; big POM gap)
- Team lifecycle (#10): NOT an e2e spec — recommend `tests/api/gitops-verify/` API drift check or drop.

### Notable CUTs
- #12 team-section-in-create-user-modal — trivial presence; implicitly covered by premium regular-user-create.spec.ts (toggleFleet) + form-validation.spec.ts (assignToFleetsRadio).
- #2 / #11 user CRUD — DUP; our users specs are deeper (activity-feed, fleet-role cells).
- #25 script-to-no-team — DUP of controls/scripts/library.spec.ts.
- Across all flows, drop: `page.waitForTimeout`, `.toast-notification__*`/`:right-of`/`.actions-dropdown__*` selectors, hardcoded `fleet+GlobalAdminN@qawolf.email` accounts, `/home/wolf/...` fixture paths, and the "DO NOT DELETE magic secret" guard (QA-Wolf infra).

### POM / helper work required
- `OrganizationInfoPage`, `OrganizationAdvancedPage` — currently bare `goto()`; add field locators (orgName, support URL, domain, Verify-SSL/STARTTLS checkboxes, host-expiry) + save + toast.
- Fleet-web-address subpage — no POM at all.
- `IntegrationsPage` — extend for MDM/EULA (upload/delete) and SSO/IdP form + tooltip copy (#28).
- Enroll-secrets modal — no POM/component/helper exists; build reveal/add/delete + a `enroll-secrets` API helper (#7, #21, #23).
- Scripts library (#20/#26/#27) — POM already supports upload/delete; needs new test-data fixtures (shebang-variant .sh, >500K .sh) and possibly a role-scoped upload path. No new POM.
- Hosts CTA (#16/#21/#23/#24) — `hostsList`/`hostDetails` POMs exist; add CTA-visibility assertions; needs a stable host given.
- Reports/software automations (#18/#22) — `manageAutomationsButton` locator exists on SoftwareTitlesPage; reports automations modal needs POM methods.
- appConfig save/restore helper — org info / advanced / web-address specs mutate GLOBAL settings with no cleanup project; need a guard that snapshots and restores appConfig (or an API-based restore) around each spec.

### Role-model / infra gaps
- No **team-admin** static user (static-users has ws-maintainer/ws-observer only). Blocks #21 and #22 as-is. Needs a Workstations-admin static user provisioned, or restructure.
- Team create/delete forbidden in test bodies (#10) — Workstations is the only persistent premium team; cleanup wipes its content, not the team itself.
- macOS-updates flow (#17) relies on ad-hoc teams (Ducks / "Team for macOS updates tests"); must be reworked to Workstations vs Unassigned.
- CTA flows use `addHostsToTeam` to self-seed hosts — our model expects hosts as a given (host cluster's live VMs); rework or precondition.

### Open questions for the human
- Fleet web address (#4/#14): is it safe to rewrite the live instance's server URL and restore it, or should we reduce to a presence/round-trip check under a save/restore guard? Risk of breaking auth/instance.
- Team lifecycle (#10): worth an API/gitops-verify drift check, or drop entirely?
- Automatic enrollment (#28) and enroll secrets (#7): confirm these belong to the settings cluster vs the mdm cluster (ownership overlap).
- Should org-settings mutations get a shared appConfig save/restore fixture before authoring #3/#4/#5/#13/#14/#15?
