# Batch B — Policy, report and software forms

**24 gaps → about 11 specs, nearly all augments, after merges.** `Policy automations` · `Policy and report saves`
· `Report settings` · `Software Advanced options` · `Secrets in scripts`

**Status: ready for review** (planned 2026-10-01).

> ## ▶ Start here
>
> **Branch from `main` after [PR #78](https://github.com/AndreyKizimenko/qa-automation-poc/pull/78) has merged.**
> It rewrites `policy-automations.spec.ts` on both tiers and adds `PolicyAutomationsFields` and
> `createFleetPolicy`, which this batch builds on. **Invoke the `playwright-test-author` skill first** (Skill
> tool) and follow it. Then read, in order: [README.md](README.md) §4–§5, round 2's
> [README §9](../round-2/README.md#9-working-a-batch-since-d), `playwright/CLAUDE.md` (the cleanup pipeline,
> the exclusive projects), then this file.
>
> **What this batch is.** Forms round 1 opened and never finished: a policy or report with bad SQL that's
> never saved, automations switched on and never back off, a fleet scope skipped, Advanced options read but
> never edited. No hosts. **Two rows are decisions, not builds:** *Store report results* wipes every report's
> stored results instance-wide, and AI Autofill calls an external LLM (§2).
>
> Facts below were checked on 2026-10-01 against `main` (d55846a), PR #78's branch, the QA Wolf flows, and
> Fleet `rc-minor-fleet-v4.93.0`, the build both instances run.

## The gaps

| Gap | What's untested today | Proposed target | Kind | Source flow |
|---|---|---|---|---|
| round 1 C3 #4 | free: a policy's own webhook ticked in its row's automations modal and saved, the cell reading "Webhook" (PR #78 asserts the checkbox is offered) | `free/policies/policy-automations.spec.ts`, or shared/ (not license-gated) | augment | `flows-Free/policies-global-admin-create-failing-policy-webhook.flow.js` |
| round 1 C3 #10 | turning the failing-policies automation off again (enable only today) | {free,premium}/policies/policy-automations.spec.ts | augment | `flows-Premium/policies-disable-failing-policies-automation.flow.js` |
| round 1 C3 #15 | a fleet's own failing-policies webhook (fleet scope; global only today) | `premium/policies/policy-automations.spec.ts` | augment | `flows-Premium/policies-global-admin-automates-team-policy-webhook-premium.flow.js` |
| round 1 C3 #12 | empty automation state prompts to add an integration (tickets with no integration) | `premium/policies/policy-automations.spec.ts` | augment | `flows-Premium/policies-empty-automation-state-prompts-to-create-an-integration.flow.js` |
| round 1 C3 #11 | a policy with bad SQL actually saved, then reopened (error surfaced, Save enabled — never saved) | `premium/policies/sql-validation.spec.ts` | augment | `flows-Premium/policies-ability-to-save-policies-with-bad-sql-statements-to-allow-for-false-postiives.flow.ts` |
| round 1 C3 #18 | a Workstations policy isn't listed under another fleet (CRUD covered, isolation not) | `premium/policies/policies.spec.ts` | augment | `flows-Premium/policies-global-admin-creates-edits-and-deletes-team-policy-premium.flow.js` |
| round 1 C3 #27 | AI Autofill fills a policy's description and resolution | review: needs Fleet's AI service on the instance | review | `flows-Premium/policies-populate-policy-description-and-resolution-using-ai-macos.flow.js` |
| round 1 C4 #P1 | a report with invalid SQL actually saved (error surfaced, never saved) | `premium/reports/reports.spec.ts` | augment | `flows-Premium/queries-global-users-ability-to-save-invalid-queries.flow.js` |
| round 1 C4 #P2 | a report's automations: historical results to the log destination, on create and edit | `premium/reports/automations.spec.ts` | augment | `flows-Premium/queries-global-users-ability-to-set-created-queries-to-send-historical-results-to-log-destination-on-query-creation-and-query-editing.flow.js` |
| round 1 C4 #P3 | editing a report's SQL warns that saving deletes its previous results | `premium/reports/reports.spec.ts` | augment | `flows-Premium/queries-global-users-edit-and-save-query-verify-query-report-removed-reset.flow.js` |
| round 1 C4 #P4 | a report's Store data setting (QA Wolf's "Discard data") turned off and on | `premium/reports/reports.spec.ts` | augment | `flows-Premium/queries-global-users-enable-and-disable-discard-data-query-option.flow.js` |
| round 1 C4 #P7 | a report's automations turned off again, and the list's On/Off cell | `premium/reports/automations.spec.ts` | augment | `flows-Premium/queries-global-users-global-admin-can-update-managed-automations-premium.flow.js` |
| round 1 C4 #P13 | the editor's schema sidebar shows an osquery table's columns (`adobe_plugins`, in the bundled schema); the flow's live run passes vacuously on simulations | `premium/reports/reports.spec.ts` | augment | `flows-Premium/queries-global-users-osquery-table-for-adobe-plugins-detection.flow.ts` |
| round 1 C4 #P15 | Save as new: the in-modal fleet dropdown, and a copy into another fleet | `premium/reports/save-as-new.spec.ts` | augment | `flows-Premium/queries-global-users-save-an-existing-query-as-new-query-admin-user.flow.js` |
| round 1 C4 #P28 | a new report's defaults: all four platforms, observers can run, Live / Save as new available | `premium/reports/reports.spec.ts` | augment | `flows-Premium/schedule-global-admin-can-create-edit-and-remove-teams-scheduled-query-premium.flow.js` |
| round 1 C5 #15 | the org-wide "Store report results" setting off and on (`query_reports_disabled`, not premium-gated) — off, an hourly job deletes every report's stored results | review: `shared/exclusive/`, a UI-only check, or cut (decision) | review | `flows-Premium/reports-reports-disable-stored-reports-setting.flow.ts` |
| round 1 C6 #16 | free: turning the vulnerability automation off again | `free/software/vulnerability-automations.spec.ts` | augment | `flows-Free/software-disable-software-vulnerability-automation.flow.js` |
| round 1 C6 #17 | as round 1 C6 #16, premium | `premium/software/vulnerability-automations.spec.ts` | augment | `flows-Premium/software-disable-software-vulnerability-automation.flow.js` |
| round 1 C6 #20 | a Fleet-maintained app's Advanced options (install / uninstall / pre-install query / post-install) edited, saved, read back | `premium/software/package-scripts.spec.ts` | augment | `flows-Premium/software-add-software-edit-and-save-all-scripts-and-queries-for-fleet-maintained-software.flow.js` |
| round 1 C6 #21 | as round 1 C6 #20, one field at a time — the flow types into each editor and never saves (it tests the Ace editor, and leaks the app it adds) | review: likely cut, or fold into C6 #20 as "edit one field, the other three unchanged" | review | `flows-Premium/software-add-software-edit-scripts-and-queries-for-fleet-maintained-software-in-isolation.flow.js` |
| round 1 C6 #22 | Advanced options set while adding a package (pre-install query, post-install script), read back from Edit | `premium/software/package-scripts.spec.ts` | augment | `flows-Premium/software-add-software-on-team-level.flow.js` |
| round 1 C8 #23 | a package's advanced attributes edited and saved (read-back only today) — the same modal and PATCH as C6 #20, so one test | `premium/software/package-scripts.spec.ts`, merged with C6 #20 | augment | `flows-Premium/packages-edit-packages-edit-advanced-attributes.flow.js` |
| round 1 C8 #20 | a script that uses `$FLEET_SECRET_X` is refused until the variable exists | `shared/controls/custom-variables.spec.ts` (not license-gated; free has no variables spec) | augment | `flows-Premium/secrets-scripts-with-a-secret-variable-can-only-be-uploaded-when-such-variable-exists.flow.js` |
| round 1 C8 #22 | a variable that a script references can't be deleted | `shared/controls/custom-variables.spec.ts` | augment | `flows-Premium/secrets-variable-that-is-referenced-by-a-script-can-not-be-deleted.flow.js` |

## 1. Review first

Open each flow body (the Source column, under `qa-wolf/`) and its target spec, decide build / fold / cut /
long-term, and write it into the table. Already found:

- **Decisions:** C5 #15 (*Store report results*, §2.1), C3 #27 (AI Autofill, §2.2), C3 #15 (which fleet, §3.1).
- **Cuts:**
  - **C6 #21.** The flow types into each editor, never saves, and leaks the Fleet-maintained app it adds. It
    tests the Ace editor. At most, fold "edit one field, the other three come back unchanged" into C6 #20.
  - **C4 #P13, the live-run half.** The flow is mostly a live run, which passes vacuously on simulations. Keep
    the sidebar.
- **Merges:**
  - C6 #20 + C8 #23: same modal, same `PATCH`, one test in `package-scripts.spec.ts`.
  - C6 #16 + #17: the free and premium vulnerability specs each get "turn it off".
  - C3 #10 on both tiers in one change.
- **Misdescribed:**
  - **C4 #P4.** The checkbox is now **"Store data"** (`DiscardDataOption.tsx`, checked = `!discard_data`).
  - **C4 #P7.** The Automations cell reads "On" / "Off" / "**Paused**" (interval 0).
  - **C4 #P28.** QA Wolf's checks are vacuous: `.platform:has-text` always passes.
  - **C5 #13** moved to [batch G](G-real-vms.md). It's a host's Library tab, not a fleet's.
- **Placement:**
  - `shared/`: C3 #4 and #12 (no tier gate), C8 #20 and #22 (not license-gated; the Variables tab isn't
    tier-filtered, `ManageControlsPage.tsx:130-142`, and free has no variables spec).
  - Free siblings: C3 #11, C4 #P1, #P2, #P28.
  - C6 #22 goes in `package-scripts.spec.ts` (not `library.spec.ts`), with its own `inertDeb('fleet-pw-…')`:
    under `fullyParallel`, tests can't share a package.
- **C3 #4 is half there after PR #78.** Its free test asserts the modal offers the webhook; ticking it and
  saving is what's left.
- **Overlaps with [batch E](E-role-visibility.md)**: C3 #15 vs E's C3 #30 (a fleet's webhook, as team admin);
  C4 #P7 vs E's C7 #22 (report automations, as team admin); C4 #P15 vs E's P16 (Save as new, single-fleet user).
  This batch owns the write as admin; E owns "this role gets the control". Agree it with whoever runs E.

## 2. The two decisions

### 2.1 *Store report results* (C5 #15)

Org settings › Advanced options, checkbox **"Store report results"** (accessible name `disableQueryReports`,
`ActivityDataRetentionSection.tsx:118-150`); help text "Disabling this setting will delete all existing report
results in Fleet." The UI sends `discard_reports_data`, an alias of `query_reports_disabled`
(`server/fleet/app.go:1806`). It isn't premium-gated.

While it's off:

1. **No results are stored** (`server/service/osquery.go:4188-4199`).
2. **Every stored result is deleted at the next hourly cleanup**: the `cleanups_then_aggregation` job's
   `query_results_cleanup` (`cmd/fleet/cron.go:1382,1555-1569`) runs `DELETE FROM query_results` across every
   report and fleet (`server/datastore/mysql/queries.go:1175`). Turning it back on **before** that tick keeps the
   rows; after it, nothing comes back until hosts report again.
3. **Host schedules change.** Snapshot reports without automations drop out of every host's config
   (`queries.go:1098-1128`, via `osquery.go:584`), and that reaches the VMs and the simulations.

Specs that stand on stored results: `shared/hosts/host-reports-tab`, `host-run-script`,
`premium/reports/report-label-targets`, and `premium/hosts/host-report-details`, which reads the durable
`pw-host-report-results` (one scheduled interval, ~3.5 min, to come back).

**Options for Andrey:** (a) cut; (b) **UI only (recommended)**: untick it, assert the help text and the
confirmation (`ConfirmDataCollectionDisableModal`), **cancel**, assert nothing changed (API); (c) the full
toggle in `shared/exclusive/`, restored inside the test, accepting that a run straddling the hourly tick wipes
every report's results. With (c), `cleanup-setup` also needs a step that turns it back on, like script execution.

### 2.2 AI Autofill (C3 #27)

The "Autofill" buttons exist only in `SaveNewPolicyModal` (`:258-300`; "Thinking..." while waiting; tooltip "AI
features are disabled in organization settings"). They call `POST /api/_version_/fleet/autofill/policy {sql}`
(`server/service/handler.go:631`, a core route with **no license check**). `AutofillPolicySql`
(`server/service/global_policies.go:596-700`) refuses when `server_settings.ai_features_disabled` is set and on
empty SQL, then **proxies the SQL to `https://fleetdm.com/api/v1/get-human-interpretation-from-osquery-sql`**
(30 s timeout; 422 on an upstream failure). The setting is Advanced › Features › "Generative AI".

The answer is an LLM's (not deterministic) and depends on fleetdm.com answering from CI. **Options:** (a) cut;
(b) stub the route with `page.route` and assert the description and resolution fill from the stub (wiring
only); (c) call it for real and assert only that both fields became non-empty.

## 3. Facts for the build

### 3.1 Policies

- **C3 #4, a policy's own webhook.** The row's cell button reads "Add automation" / "Edit automation: Webhook"
  (`PoliciesTableConfig.tsx:130-184`); the modal reads "Manage automations for the **X** policy on **All
  fleets**." The checkbox's accessible name is `ticket_webhook` (label "Send webhook"); it's disabled with "Not
  enabled for All fleets" until the global webhook is on. Saves `PATCH /config`
  `failing_policies_webhook.policy_ids`; toast "Successfully updated policy automations." **POM trap:** the
  page's `automationsModal` (`hasText: 'Automations'`) also matches this modal: key the new locator on "Manage
  automations for the". Use passing SQL so the webhook never fires.
- **C3 #10, turning it off.** `role=switch` "Enabled" / "Disabled" (`OtherWorkflowsModal.tsx:330-339`); off keeps
  the URL and `policy_ids`. Seed the enabled state with `patchAppConfig`; it fits the existing serial describe and
  its `afterEach` restore.
- **C3 #15, a fleet's webhook.** At fleet scope the modal adds "Webhooks or tickets" and saves through
  `teamsAPI.update` to `team.webhook_settings.failing_policies_webhook`; premium only. **Not on Workstations:**
  `team-host-status-webhook.spec.ts` writes the same `webhook_settings` subtree there in parallel, and
  `ModifyTeam` replaces `WebhookSettings` wholesale, keeping only host activities
  (`ee/server/service/teams.go:216-228`). So a fleet-scope automations save **nulls that fleet's host status
  webhook**, and a save of the fleet's Settings tab turns its failing-policies webhook off: filed as
  [fleetdm/fleet#54619](https://github.com/fleetdm/fleet/issues/54619) (2026-10-02). Until it's fixed, a spec that
  writes one of a fleet's webhooks restores both in its `afterEach`. The clean target is a throwaway
  `pw-*` fleet, which is [batch A](A-settings-users-labels.md)'s fleet-lifecycle decision.
- **C3 #12, no integration.** "You have no integrations." and a button "Add integration" →
  `/settings/integrations` (`OtherWorkflowsModal.tsx:239-241,304-312`); disabled while the slider is off. The
  state is guaranteed: gitops omits `integrations`, so an apply clears jira and zendesk, and no spec configures
  them. Assert it as a precondition anyway, failing loud. **`IntegrationsPage.goto()` waits on "Ticket
  destinations"; 4.93's heading is "Ticketing"** (`TicketDestinations.tsx:311-316`). Fix it before using it.
- **C3 #11, bad SQL saved.** The server accepts any non-empty SQL (`server/fleet/policies.go:285-290`); then
  `saveNew()` → `gotoEdit` → `sqlText()`. A saved bad **global** policy reaches ~300 hosts. Harmless (it fails to
  run) but delete it in an `afterEach`. The existing spec's header says it creates nothing, so this is a new
  describe. Whether the error re-renders on reopen is unverified.
- **C3 #18, isolation.** A fleet's view lists `GET fleets/{id}/policies?merge_inherited=true`; assert
  `rowWith(name)` has count 0 under the other fleet. An explicit test, not an `if (scope)`.
- **C6 #16 / #17, vulnerability automation off.** Slider "Vulnerability automations enabled/disabled"
  (`ManageSoftwareAutomationsModal.tsx:561`), toast "Successfully updated vulnerability automations.", global
  admin only, All fleets. A second test in the spec needs `mode: 'serial'`; seed the enabled state through the API.

### 3.2 Reports

- **C4 #P1, invalid SQL saved.** The server rejects only empty SQL (`server/fleet/queries.go:346`). Invalid SQL
  likely resets the target platforms to none, so the Save modal stays disabled until a platform is ticked, and
  `saveNew()` doesn't tick one.
- **C4 #P2, automations and the log destination.** Slider "Automations on/off" with "Historical results will [not]
  be sent to your log destination: …" (`EditQueryForm.tsx:686-733`); details show "Automations: On" and "Log
  destination" (`QueryDetailsPage.tsx:405-432`); field `automations_enabled`. Read the plugin name from
  `logging.result.plugin` rather than hard-coding it.
- **C4 #P3, the reset-results warning.** "Save changes?" appears when the report stores results and its SQL,
  logging, Store data, platforms or minimum osquery version changed (`EditQueryForm.tsx:588-627`): "Changing this
  report's **Query** will delete its previous results…". The server discards rows for the same fields
  (`server/service/queries.go:472-536`). Assert the warning; proving deletion needs hosts.
- **C4 #P4, Store data.** Unticking it deletes the report's rows immediately (`queries.go:513-516`); re-ticking
  shows no confirmation, but `saveExisting()` waits for one. Adjust it.
- **C4 #P7, automations off.** "Manage automations" (`AutomationsButton.tsx:29`); the column shows On / Off /
  Paused (`QueriesTableConfig.tsx:248`). "On" needs an interval > 0, **which schedules the report on every host
  in scope**. Benign SQL only. Never QA Wolf's "uncheck all": the gitops reports on Workstations carry automations.
- **C4 #P13, the schema sidebar.** h2 "Tables", a "Select a table" dropdown, then "Columns" and "Example".
  `adobe_plugins` is in `schema/osquery_fleet_schema.json:157` (darwin, windows).
- **C4 #P15, Save as new into a fleet.** "Fleet" with `FleetsDropdown`, premium and only with more than one
  choice: All fleets plus the user's admin / maintainer fleets, never Unassigned (`SaveAsNewQueryModal.tsx:76-88,176`).
  Copy into Workstations, and **delete the copy yourself**: `deleteReportsMatching` lists global reports only,
  and `cleanup-setup` doesn't touch fleet reports (`queries.go:864`).
- **C4 #P28, new-report defaults.** All four platforms ticked, "Observers can run" unticked, "Every hour".
  Reuse `checkedPlatforms()` / `intervalLabel()`.
- **Every report created in the UI defaults to "Every hour" on all platforms**, so the hosts in scope run it.
  Keep the SQL benign (`SELECT 1;`), and delete what you create.

### 3.3 Software Advanced options (C6 #20, #22, C8 #23)

- Fields (`AdvancedOptionsFields.tsx:80-140`), all Ace editors: "Pre-install query" `#preInstallQuery`, "Install
  script" `#install-script`, "Post-install script" `#post-install-script-editor`, "Uninstall script"
  `#uninstall-script-editor`. Read-only in gitops mode, when a patch policy locks the pre-install query, and for
  the install script of `.sh` / `.ps1` packages.
- Save sends `PATCH /api/latest/fleet/software/titles/:id/package` (multipart; the UI base64-encodes scripts).
  "Save changes?" warns that pending installs and uninstalls are cancelled, and the server does cancel them
  (`ee/server/service/software_installers.go:824-832,937-941`). Toast: "Successfully edited <name>."
- **Set editors through Ace's API**, as `PolicyEditPage.setSql` does (`env.editor.setValue`); `pressSequentially`
  lets Ace auto-indent and close brackets. `EditSoftwareModal` has the locators and `openAdvancedOptions`, no
  setters. Add them. **Read back through the API** (`getSoftwarePackage`): a reopened modal can show stale config.
- **Edit only a per-run title.** Editing a Fleet-maintained app's script sets a sticky `install_script_edited`
  flag (`software_installers.go:890`) that auto-update carries forward, so never touch a durable FMA (the QA
  shelf; the VMs fleet's Claude, Itsycal, DB Browser). Prefer an `inertDeb` custom package; if you need an FMA,
  `addFmaToFleet` with an unclaimed slug (taken: airtame, 7-zip, clockify, anydesk, archaeology, 1password). The
  instance has 2 GB of RAM, so keep downloads small.
- **C6 #22, on the add form:** the Advanced options toggle stays disabled until a file is chosen ("Choose a file
  to modify advanced options.", `PackageAdvancedOptions.tsx:278-297`); `SoftwareCustomPackagePage.uploadPackage`
  has no Advanced options support yet.

### 3.4 Secrets in scripts (C8 #20, #22)

- **Upload:** `ValidateEmbeddedSecrets` (`server/datastore/mysql/secret_variables.go:482-516`) → a 422 the UI
  shows as `Couldn't add. Variable "$FLEET_SECRET_X" doesn't exist.` (`ScriptUploadModal/helpers.ts:16`). The
  same check covers installer and setup-experience scripts and profiles, not pre-install queries.
- **Delete:** `DELETE /api/_version_/fleet/custom_variables/{id}` → 409 `Couldn't delete. <VAR> is used by the
  "<script>" script in the "<fleet>" team. Please edit or delete the script and try again.`
  (`secret_variables.go:213-219`). The scan covers library scripts, profiles and host-name templates, not
  installer or setup-experience scripts. **On Unassigned the fleet reads "No team"** (`COALESCE(t.name,'No
  team')`, `:235`): it renders live, filed as [fleetdm/fleet#54621](https://github.com/fleetdm/fleet/issues/54621). Match the
  variable and script names, and skip that one check with `TODO(fleetdm/fleet#54621)` and a row in `docs/blocked-by-product-bugs.md` until it's fixed for the fleet wording.
- `custom-variables.spec.ts` names variables `PW_VAR_<Date.now()>` and cleans up with `deleteVariablesMatching`
  in an `afterEach`. **Delete the script before the variable**: `deleteVariablesMatching` ignores the response,
  so a 409 leaks the variable silently. There's no create-variable API helper (body `{name, value}`), and
  `uploadScript` takes a file path only. Variables are global; gitops never deletes them.
- The flow also flips the global "disable scripts" setting. It doesn't need to; leave it alone.

## Reusable pieces

`PoliciesListPage` (`openAutomations`, `setPolicyAutomations`, `selectWebhookWorkflow`, `saveAutomations`),
`PolicyEditPage` (`setSql`, `saveNew`, `gotoEdit`, `sqlSyntaxError`, `sqlText`), `SoftwareTitlesPage` (vulnerability
automations), `ReportEditPage` (`saveNew`, `saveExisting`, `openSaveAsNew`, `checkedPlatforms`),
`ReportsListPage.openManageAutomations`, `EditSoftwareModal`, `SoftwareTitleDetailPage.runAction`,
`ScriptsLibraryPage`, `VariablesPage`; API: `getAppConfig` / `patchAppConfig`, `createPolicy`,
`createFleetPolicy` (PR #78), `get/setFleetWebhookSettings`, `createReport`, `getSoftwarePackage`,
`uploadSoftwarePackageBuffer`, `inertDeb`, `addFmaToFleet`, `deleteSoftwareTitle`, `uploadScript` / `deleteScript`.

## Decisions to put to Andrey

1. ***Store report results*:** cut, UI only with cancel (recommended), or the full toggle in `shared/exclusive/`
   plus a `cleanup-setup` reset (§2.1).
2. **AI Autofill:** cut, a stubbed wiring check, or a live non-empty check (§2.2).
3. **C3 #15:** a throwaway `pw-*` fleet (batch A's decision), or Workstations serialised with
   `team-host-status-webhook` (§3.1).

## Free coverage

Policy automations, the SQL saves, the vulnerability automation, variables and secrets exist on free: `shared/`
where the page is the same, explicit `free/` siblings where premium's fleet dropdown changes it. Reports'
automations and fleets are premium-only; their free check is the paywall, if `free/paywalls.spec.ts` doesn't
already have it.

## Traps this batch will hit

- **Global config, restored inside the test**: the failing-policies and vulnerability webhooks, Advanced
  options. Keep those tests serial; restore in an `afterEach`.
- **The nightly gitops apply resets webhooks and integrations**, and the gitops-mode step disables these
  controls. Don't rely on state from an earlier run.
- **Workstations reports survive `cleanup-setup`.** Delete every report you put there. Gitops owns the five that
  live there; never save or delete those.
- **Editing an installer cancels its pending installs.** Never on the VMs fleet, never a durable title.
- **Variables are global, and deleting one can be refused** (409). Delete the script first.

## Done when

- Every row has a written review decision; the questions above have Andrey's answer.
- The augments built on every tier each targets, each confirming its save through the API and restoring what
  it changed.
- `npm run check` clean; each changed spec run with dependencies on its tiers, once headed; anything that edits
  an installer `--repeat-each=5`.
- `playwright-test-reviewer` run on the branch's diff, findings fixed or answered.
- Docs in the same commits: this file's *What landed*, a [DELIVERY-LOG](../DELIVERY-LOG.md) line, a
  [test-audit](../../test-audit/README.md) entry per `test()`, `helpers/README.md` / `pages/README.md`, and this
  round's [README](README.md) batch table and [INDEX](INDEX.md).
- PR open, Andrey told it's ready for its branch run.

## What landed

*Nothing yet.*
