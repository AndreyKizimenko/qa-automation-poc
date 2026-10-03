# Delivery log

What shipped, in order, and the decisions behind each batch. Consolidates the four per-batch trackers and the
original batch plan. Per-slice grounding now lives in the **spec headers** — that's deliberate, and it's where
to look first. Superseded originals (`BRIEF.md`, `MASTER.md`, `HANDOFF.md`, `BATCH-1..4.md`) remain in git
history if you need the raw trackers.

Batches were ordered by **dependency**, not by area: cheap coverage capture first, the big page-object
investment next, and everything gated on infrastructure last.

---

## Batch 1 — dedupe + augment · PR #35

~20 duplicate flows confirmed and dropped with no code written, plus **18 augments** grafted onto existing
specs as separate `describe` blocks.

Shipped: signed-out→`/login` redirect · forgot-password reset form · script download-matches-source (both
tiers) · >500k-char script rejection · invalid-SQL report still saves · new-report default state · vulnerability
search-narrows-to-one-CVE · exploited-vulnerabilities filter · policy details CTA visibility (both tiers) ·
signed `.mobileconfig` rejection · "Add software" All-fleets gating + tooltip · dark-mode theme · "Lock end
user info" gating · session-reset → API-token rotation · edit API-only user (All → Specific endpoints).

Infrastructure added: `ws-admin`/`api-ws-admin` catalog entries, `createApiUser()`, a generated signed
`.mobileconfig` fixture, and several POM accessors.

**Deferred with grounding notes:** admin-edits-password (verify via API login, not a UI landing), vulnerability
column-sort (assertion is an implementation detail), the CVE-filter pill, and setup-assistant bad-DEP (needs an
Apple ABM round-trip).

## Batch 2 — net-new, no host dependency · PR #35

~21 specs across software, policies, reports, labels, settings and controls. The prerequisite for the settings
work was an **appConfig snapshot/restore helper** (`helpers/api/config.ts`), which every global-config spec
since has used.

Shipped: software (manage-automations-access, os, vulnerability-automations, no-teams-views, edit-package) ·
policies (sql-validation, policy-automations) · reports (save-as-new, list-filters, automations) · labels
(CRUD, sort-view, role-access) · settings (org-info, fleet-desktop, enroll-secrets, mdm-migration-validation,
automatic-enrollment) · controls (custom-variables, disk-encryption).

Two items were **moved to Batch 4** rather than forced: `advanced-options` (the bundled save needed care) and
the labels team-admin variants (no team-admin user existed yet).

## Batch 3 — hosts area, host-independent · PR #35

The biggest page-object investment. The hosts area had **zero** e2e specs before this — only a loadtest spec —
so `HostsListPage` and `HostDetailsPage` grew from thin locator bags into real page objects, and a new
`AddHostsModal` component appeared.

Shipped (all `shared/` where behaviour was genuinely tier-identical): export-csv · edit-columns ·
add-hosts-download · host-status-webhook · host-software · cta-visibility (explicit `free/` + `premium/`,
because the role dimension differs).

Notable finding: Fleet **hides the "User email" column by default**, so `edit-columns` runs hidden→show→hide
and self-restores. `labels-crud` via the hosts label-filter was skipped as redundant with the Batch-2 labels
specs.

## Batch 4 — host-dependent, destructive, team-admin · PR #36

Everything gated on infrastructure. The gate opened in stages during the batch, which is why the plan changed
underneath it twice.

### Group A — host details reads and execution
`host-details-smoke` (refetch, local-user-accounts search, Agent tooltip) · `host-live-query` (Actions → Live
report → run → `Report finished` with the real result row) · `host-reports-tab` (count, toggle, search, Name
A-Z/Z-A sort) · `host-report-details` (C2 #24 — card → Show details → per-host results → View data for all
hosts).

All landed **`shared/`** rather than per-tier: the behaviours are identical on both, and the "premium-only"
Agent tooltip was an accident of QA Wolf's coverage.

### Group B — host↔team transfer
`bulk-transfer` (select-all bar, transfer modal, fleet typeahead, select-all-matching affordance) ·
`host-transfer-permissions` (admin and maintainer can; team admin correctly cannot).

Reworked from QA Wolf's create-two-teams-and-move-50-hosts to staging a handful of simulated hosts into a
low-traffic fleet, so "select all on this page" can only ever act on the test's own hosts.

### Group C — host deletion
`host-delete` — bulk from the list, single from host details, and as a team admin. Simulated hosts only,
asserted by host **id** rather than display name, budgeted to 4 deletions per run.

### Group D — provisioning-unblocked
`team-host-status-webhook` (fleet webhook + the host-expiry checkbox deriving from the global and fleet
settings) · `advanced-options` (the bundled save must not disturb its neighbours) · the labels team-admin
variant.

### Group E — reassigned
`dashboard/automations-activity` — filed under hosts in the audit, but it's the dashboard's automations modal.
Enable → edit → disable, each verb landing in the feed it configures.

### Group F — MDM action availability
`mdm-actions-availability` (premium + free) — asserts which of **Lock / Wipe / Turn off MDM** Fleet offers
across macOS, Windows and Ubuntu on both tiers. Six cases, and it never clicks a destructive item.

Added after the rest of the batch, once the real VMs made a per-platform matrix possible. It closes the gating
half of the Lock/Wipe gap: the commands still aren't fired, but a change that exposed one to the wrong platform,
tier or role would now fail a test. Two findings from grounding it in
`HostActionsDropdown/helpers.tsx` were counter-intuitive enough to be worth carrying forward:

- **Turn off MDM is Apple-only** — a Windows host never offers it, MDM-enrolled or not.
- **Lock and Wipe need no MDM on Linux** — both accept `isLinuxLike` outright, so the Ubuntu VM offers them
  with no enrollment at all.

It also exposed a real helper bug: `?platform=linux` returns **zero** hosts from Fleet's API (the `platform`
param matches label groups, and `linux` isn't one), so `findOnlineHost` now omits the param for Linux and
relies on the client-side platform filter.

### Deliberately not built
**Firing Lock or Wipe.** Rationale, the residual risk, and the full asserted matrix:
[`PARITY.md` §6](PARITY.md#6-lock-and-wipe-gated-not-ignored).

## Round 3 · Batch C — server-side decisions, over simulations

23 gaps in what Fleet decides on the server — which hosts a policy runs on or links to, what *Select all matching*
transfers, who a label holds, which reports a host's tab lists — reviewed on `playwright/qawolf-round3-batch-c`
(2026-10-03): 19 kept, 4 cut (C3 #29, C1 #11, C6 #26, and C3 #7's free twin). Detail and Andrey's decisions in
[round-3/C-simulations.md](round-3/C-simulations.md#review-decisions-2026-10-03).

**What the review changed.** Each tier also holds ~280–300 *offline* simulations, yesterday's set that host expiry
deletes within a day and nothing else touches, so the *Select all matching* transfer (C1 #12) stages them on a
throwaway fleet in the main project instead of going to `exclusive/` or being cut. The platform policy (C3 #3/#19)
is one shared test of a global policy rather than an augment plus a free twin, and it reads back the platform the
CRUD spec writes and never checks.

| slice | what |
|---|---|
| policies | new `shared/policies/policy-hosts.spec.ts`: a policy saved with only macOS ticked is stored as `darwin` and listed on a macOS simulation, not on a Linux or a Windows one (both tiers); a host's Policies tab → **View all hosts** for a passing and a failing policy lands on the hosts with that answer, the two refetched simulations listed under it and not under the other (both tiers). New `premium/policies/policy-host-counts.spec.ts`: the VMs-fleet policy's Pass and Fail links list exactly the API's hosts. `createPolicy({ platform })`, `getGlobalPolicy`, `getHostPolicyResponses`, `listPolicyHosts`; `PolicyEditPage.saveNew({ platforms })`, `HostDetailsPage.viewAllHostsForPolicy`, `HostsListPage.policyResponseValue` / `selectPolicyResponse` / `hostLink` / `hostNames`, `PoliciesListPage.openHostCount` |
| transfers | `bulk-transfer.spec.ts`: under the dashboard's Low disk space filter a full page selected offers no *Select all matching hosts* (the server would ignore that filter and move everything else matching). *Select all matching* clicked for the first time, on a throwaway `pw-transfer-*` fleet holding 51 staged offline simulations: "51 selected", transferred to Unassigned by filter behind a request guard that only lets a transfer scoped to that fleet through; every one moved. The QA-staged test reads each row's Fleet cell. `findOfflineSimulations`; `CLAUDE.md` › Test hosts gains the offline pool |

## Round 3 · Batch B — policy, report and software forms

24 gaps round 1 left in forms it opened and never finished. Each flow was reviewed against the spec beside it
before anything was built, on `playwright/qawolf-round3-batch-b`. Detail in
[round-3/B-policy-report-software-forms.md](round-3/B-policy-report-software-forms.md#what-landed).

**What the review changed.** Two cuts: C4 #P13 (a one-off check that a new osquery table shipped) and C6 #21
(types into the Ace editors and never saves). Ten gaps folded into tests that already existed. The org-wide
*Store report results* toggle has no confirmation and an hourly job deletes every stored result while it's off,
so Andrey reshaped C5 #15 into what it protects: a long-standing gitops report still collecting, and a new one
storing its first row. AI Autofill is tested live. A fleet's own webhook runs on a throwaway `pw-*` fleet,
because fleetdm/fleet#54619 makes Workstations unsafe beside `team-host-status-webhook`.

| slice | what |
|---|---|
| policies | both tiers' global webhook test becomes a lifecycle: enabled, ticked for one policy in that policy's own modal (`policy_ids`, the cell reading *Webhook*), turned off with the URL and the policy kept (the cell back to *Add automation*); the `afterEach` restores `policy_ids` too. Ticket with no integration → *Add integration* → Settings › Integrations (both tiers). A fleet's own webhook, enabled on a throwaway `pw-fleet-webhook-*` fleet, stored on the fleet and not in global config (premium). A policy with a syntax error saved and reopened with its SQL and the error (both tiers). A Workstations policy isn't listed under the VMs fleet (premium). New `shared/policies/policy-autofill.spec.ts`: Autofill fills Description and Resolution from Fleet's live call to fleetdm.com. `PoliciesListPage.selectTicketWorkflow`, `PolicyEditPage.autofillButton`; `IntegrationsPage.ticketingHeading` (4.93's heading; the old anchor waited on "Ticket destinations") |
| reports | the Reports CRUD (both tiers) creates with automations on (details: *Automations: On*, the log destination) and edits them off. A report with a syntax error saved and reopened (both tiers; with broken SQL the Save report modal ticks no platform). The Save report modal's defaults: four platforms, hourly, observers off, automations off (both tiers). The list's Automations cell *On*, then *Off* once unticked (both tiers). Save as new into Workstations from the modal's Fleet field (premium). New `shared/reports/edit-warnings.spec.ts`: no prompt for a description edit, the Query copy for an SQL edit, the generic copy for Store data off, none for Store data back on, each read back. New `premium/reports/stored-results.spec.ts`: gitops' `pw-host-report-results` holds a result from the macOS VM younger than two intervals, and a report created in the UI with Store data on collects the VM's row. `ReportEditPage` (automations, Store data, `saveExisting({ prompt })`, `saveAsNewFleetDropdown`), `ReportDetailsPage` (automations status, empty state, result rows), `ReportsListPage.automationsCell`; `TeamDropdown` takes a container; `getReport`; the VMs sweep takes `pw-stored-results-*` |
| software | the vulnerability automation turned off again keeps its URL (both tiers). `package-scripts.spec.ts` adds its package with a pre-install query and post-install script typed into the add form, stored as typed, and a second test rewrites all four Advanced options on a per-run `fleet-pw-*` package and reads each back. `setAceValue` (component helper), `EditSoftwareModal.setScript`, `SoftwareCustomPackagePage.uploadPackage({ preInstallQuery, postInstallScript })`. A repeat save's toast can be the previous save's, so the webhook tests poll the stored state |
| variables | `custom-variables.spec.ts` moves to `shared/controls/` (the page isn't tier-gated), so free gains its two tests; plus a script using `$FLEET_SECRET_<NAME>` refused until the variable exists and then uploaded from the same modal, and a variable a script uses refused deletion — asserted by names, the scope's wording held for [fleetdm/fleet#54621](https://github.com/fleetdm/fleet/issues/54621). `createVariable`; `ScriptsLibraryPage` uploads take an in-memory file |

## Round 3 · Batch A — settings, users, labels, account

19 gaps reviewed on `playwright/qawolf-round3-batch-a` (2026-10-02): 16 built, 3 cut (the Labels Description
sort, both Fleet web address flows). Detail and Andrey's decisions in
[round-3/A-settings-users-labels.md](round-3/A-settings-users-labels.md#what-landed).

| slice | what |
|---|---|
| labels on free | `premium/labels/labels.spec.ts` → `shared/labels/labels.spec.ts` (free had no label coverage); the Dynamic lifecycle renames to a special-characters name (C1 #14 folded); the Manual label takes a Linux simulation, not the first host; both deletes page the list |
| Advanced options on free | `premium/settings/advanced-options.spec.ts` → `shared/settings/organization/`; the save now also flips Verify SSL certs and Enable STARTTLS (C7 #13 folded), checks the rest of `smtp_settings` is untouched, and restores in an `afterEach` |
| host status webhook | `shared/settings/host-status-webhook.spec.ts` also sets Percentage of hosts (5%) and Number of days (3 days) and reads all four values back after a reload, then through the API; `IntegrationsPage` gains `selectHostStatusOption` for the two react-select v1 dropdowns |
| theme | `shared/account/theme.spec.ts` gains System following the OS live and Light pinning against a dark OS, via `page.emulateMedia`; the sign-out half of the flows was cut (the theme is per-browser localStorage by design) |
| an admin sets a password | new `shared/settings/users/edit-password.spec.ts`: Edit user → Password on a throwaway user; a cookie-less API login takes the new password, refuses the old one, and the old token turns 401; `EditUserPage.newPassword` (the edit form's field is placeholdered `••••••••`) |
| team admin on My account | `premium/account/my-account.spec.ts`: `team-admin` joins the role loop (email, name, `2 fleets`; its Role check skipped behind fleetdm/fleet#54620, which reads `Various`), and a new test hovers the Fleets value for the tooltip naming Workstations and VMs (`MyAccountPage.hoverFleets`) |
| Unassigned across the navbar | `premium/software/no-teams-views.spec.ts` gains its own describe: Unassigned picked on Hosts survives Controls, Software, Policies and Hosts again; Reports falls back to All fleets and doesn't offer Unassigned |
| enroll secrets | new `shared/settings/enroll-secrets.spec.ts` (global add / copy / delete from the Hosts gear menu, both tiers, union restore via `restoreGlobalEnrollSecrets`); `premium/settings/enroll-secrets.spec.ts` gains copy + delete on Workstations. `EnrollSecretModal` rebuilt around value-scoped actions (its `.first()` buttons removed) and adopted by `HostsListPage`; the gitops-mode specs read gated state through `rowControls` |
| fleet lifecycle | new `premium/settings/fleets-lifecycle.spec.ts` + `FleetsPage`: a throwaway `pw-fleet-<ms>` added, renamed and deleted through Settings › Fleets, each step checked by toast, row and API. `cleanup.steps.ts` gains **sweep throwaway pw-\* fleets** (`deleteFleetsWithPrefix`); `playwright/CLAUDE.md` now allows `pw-*` fleets in test bodies (Andrey, 2026-10-02) |
| activity feed filters | new `shared/dashboard/activity-feed.spec.ts`: a throwaway maintainer logs in, creates and deletes a global report through the API; searching its name yields exactly those 3 rows; type *Added report* → 1, *Yesterday* → empty state, *Today* → 3, *Sort by oldest* reverses them. `DashboardPage` gains the feed's search, type, date and sort controls |

## Round 2 · Batch G — policy automations and retries

The retries half of G: 9 source flows, re-reviewed against the specs beside them before anything was built,
then built on `playwright/qawolf-round2-batch-g`. Detail in
[round-2/G-out-of-band.md](round-2/G-out-of-band.md#what-landed-retries-half).

**What the review changed.** The OS-specific policy flow never sets a platform (it saves the default
`SELECT 1` under the name "Mac OS Query…"): cut as a duplicate of round 1's policy CRUD. The passing-script
flow only added "a success isn't retried": cut, and the Python flow moved onto the failing script. The failing
script and the continuous case became one test, since continuous needs the 3-attempt run first; the failing
install became `install-on-host`'s failure twin. `patch-policy` avoids 7-Zip, which `library.spec` adds and
deletes on Workstations alongside it.

| slice | what |
|---|---|
| policy automation runs | new `premium/exclusive/policies/policy-automation-runs.spec.ts` (in `premium-exclusive`: Fleet queues an automation's attempts below every user-requested activity, so beside the install specs they starved — see the batch file), one test on the Ubuntu VM: a policy's failing Python script tried 3 times; a refetch with continuous off queues nothing; with Continuous ticked in the row's modal, the next refetch runs 3 more. Cleanup in an `afterEach`, since a timed-out test would otherwise leave a continuous failing policy firing on every refetch. Closes round 1's unbuilt C9 #17 too |
| failing Deploy | new `premium/exclusive/software/deploy-install-retries.spec.ts` (first `install-on-host`'s second test): a Deploy whose install fails (an amd64 `.deb` on the aarch64 VM), 3 attempts by the install policy, then *Failed* — the policy-queued retry path, distinct from `inventory-reflects-install`'s direct one. In `premium-exclusive`: its installs queue below every user-requested one, and each failure backs orbit off (filed [fleetdm/fleet#54607](https://github.com/fleetdm/fleet/issues/54607)); `inventory-reflects-install` now fails with a pre-install query, which doesn't |
| patch policies | new `premium/software/patch-policy.spec.ts` on Workstations — LocalSend (macOS) walked through every patch option and back off from Actions → Deploy, each save read back through the API; KeePassXC (Windows) has no Notify, and the server refuses Notify and both patch flags at once. `SoftwareDeploySelector` (component), `SoftwareTitleDetailPage.openDeploy`; `findPatchPolicy`; `findFmaIdBySlug` pages through the catalog (it had read 500 of 1,424) |
| one policy's automations | `premium/policies/policy-automations.spec.ts` gains a row's *Manage automations* modal on Workstations: Install software, Run script and Continuous saved together, read back through the API, the row reading *2 automations*, the modal reopening on them; free's twin — the same modal offers only *Send webhook or create ticket*, and the automation filter is absent. `PolicyAutomationsFields` (component), `PoliciesListPage.openPolicyAutomations`; `createFleetPolicy` / `updateFleetPolicy` / `getFleetPolicy` |

## Round 2 · Batch F — provisioning-gated

Reviewed against the 13 source flows, the suite and Fleet's 4.93 RC source before anything was built, then
built on `playwright/qawolf-round2-batch-f`. Detail in
[round-2/F-provisioning.md](round-2/F-provisioning.md#what-landed).

**What the review changed.** The two "manual MDM enrollment" flows run a script on a macOS host and never touch
an enrollment profile: cut as duplicates of `shared/hosts/host-run-script.spec.ts`. The planned "permission
surface only" recovery-lock spec could not have failed (the action only renders once enforcement is on), so
Andrey chose full coverage on the premium Mac instead. The MFA flows (all mailbox-driven) and the Fedora `.rpm`
flow moved to a new [`docs/long-term-goals.md`](../long-term-goals.md) with the other host types the suite
lacks. The team-admin rename is asserted but never saved: renaming a gitops-declared fleet orphans it.

| slice | what |
|---|---|
| technician transfer | `host-transfer-permissions.spec.ts` gains a `global-technician` row |
| team admin | new `premium/settings/users/team-admin-scope.spec.ts`: create → edit (name, fleet role → Admin) → remove a member from the fleet's Users tab, each read back through the API; *Rename fleet* offered, *Delete fleet* not; an empty-name `PATCH /fleets/:id` as the team admin — 422 on Workstations, 403 on QA. `FleetUsersPage` |
| IdP username | new `premium/hosts/host-idp-username.spec.ts` (UI add/remove with activities, the `device_mapping` API, the observer negative) and `free/hosts/host-idp-username.spec.ts` (the modal's Premium message); `UpdateEndUserModal` |
| free refusals | `api/free/license.spec.ts`: an IdP username and `mfa_enabled` are refused with 402 |
| 2FA checkbox | premium: unchecked by default, enabled only when Fleet can send email, hidden under SSO; free: absent from the create and edit forms |
| paywalls | the OS-settings rows now require their own card's heading (the Passwords and Certificates rows could pass with the card gone); a *Host names* row |
| leftover API users | `deleteLeftoverApiTestUsers` in the unassigned wipe: the `QA API <label> <stamp>` API-only users a dead run leaves (their emails are Fleet-generated, so the `qa-test-*` sweep missed them — 28 on premium) |
| recovery lock | new `premium/hosts/recovery-lock.spec.ts` — enforce, verify, view, rotate, clear on the Mac, with all five activities; `PasswordsPage`, `RecoveryLockPasswordModal`; an `afterEach` and the resting-state step turn enforcement off. Green on the real Mac (the virtual Mac accepts `SetRecoveryLock`; ~1 min a run), with dependencies, headed and 5× |

**Filed:** [fleetdm/fleet#54381](https://github.com/fleetdm/fleet/issues/54381) — the SSO + MFA conflict error
reads *"Fleet MFA is is not applicable to SSO users"* (API-only; released).

## Round 2 · Batch E — label targeting

Profiles, declarations, software, policies and reports scoped to labels, asserted as set membership: the real
VM inside the label is delivered to, a simulation outside it isn't listed. Detail in
[round-2/E-label-targeting.md → What landed](round-2/E-label-targeting.md#what-landed).

**Inert profile fixtures — and the lock profiles the free VMs had been getting.** Batch E's blocker was a pair
of profiles safe to deliver to a real VM. Writing them turned up that the suite already *was* delivering
profiles to real VMs: free has no fleets, so the free lifecycle spec's uploads went to Unassigned, where the
free VMs are, and Fleet's 30-second profile reconciler sent them whenever it ticked before the delete step. The
Windows VM had received the DeviceLock fixture 32 times, the macOS VM the passcode fixture 7 — removed ~90 s
later each time, which is why neither locked. Skipped on `main` the same night (PR #64); then:

- `test-data/apple/macos/profiles/fleet-pw-inert.mobileconfig` — one key in a preference domain nothing reads;
  `test-data/windows/profiles/fleet-pw-inert.xml` — Game DVR off. Each with a README: why it's safe, how to
  prove it arrived (a *filtered* `managed_policies` read; the `PolicyManager` registry key), and what removal
  does. Both proven on the premium VMs: listed 21 s after upload, verified by Fleet about a minute later, read
  back on the device, deleted — the Mac's domain gone in 21 s, the Windows value back to its default in 8 s.
- Both library lifecycle specs moved onto them (both tiers green, with dependencies);
  `fleet-test-passcode.mobileconfig` and `fleet-test-screenlock.xml` deleted; the signed-upload rejection
  fixture re-signed from the inert profile.
- `CLAUDE.md`, the author and reviewer skills and the round-2 README now say **uploading a profile is
  delivering it**.

**Who a targeted profile reaches** — `premium/controls/os-settings/profile-label-targets.spec.ts` (new, +
`TargetLabelSelector`, `helpers/profiles.ts`, `helpers/api/profiles.ts`, `findMdmSimulations`, the Controls tab on
`HostDetailsPage`, the Edit modal on `ConfigurationProfilesPage`). Five macOS flows and the Windows trio in two
tests. The real VM sits inside the labels and two MDM-enrolled simulations borrowed onto the VMs fleet sit
outside them — the server-side decision a simulation answers as well as a VM, the delivery only the VM can — and
each profile must be listed on exactly the hosts its labels pick. macOS: include all, include any + exclude, and
exclude-only side by side, each verified on the VM and read back on the device, the excluded one absent;
Windows: include all + exclude, then an Edit that excludes the VM, which Fleet answers by removing it. QA Wolf's
`verifiedHostsCount >= 2` could not fail; each of these fails on the matching targeting bug.

**Declarations** — `premium/controls/os-settings/profile-declarations.spec.ts` (new, + `inertDeclaration`). The same
shape for DDM declarations, which keep their targeting in a table of their own and reach the Mac over declarative
management: no target, include all and exclude side by side, each listed on exactly its hosts, the VM reporting the
two that include it active. The declarations are Apple's no-op `management.test` type — QA Wolf's was, by its name, an
OS-update declaration.

**A profile's commands on one host** — `premium/controls/os-settings/profile-delivery-retry.spec.ts` (new, +
`listHostMdmCommands`, `activityCopy.mdmCommand.forProfile`, Resend on `HostDetailsPage`). Install, Resend from the
host's Controls tab and removal, each command tied to the profile by name: the Activity card names it, the API
counts it. Then a profile the Mac refuses — a Wi-Fi payload with no SSID, approved for the VMs (an unknown
`com.apple.` type, the first candidate, is accepted by macOS 26.6): four InstallProfile commands, all Error, the
first and Fleet's three retries, then **Failed** on the Controls tab — whose name gains the failed count,
"Controls 1".

**Software, policies and reports** — `premium/software/software-label-targets.spec.ts`,
`premium/policies/policy-label-targets.spec.ts`, `premium/reports/report-label-targets.spec.ts` (new, + the dropdown
variant of `TargetLabelSelector`, targets on `EditSoftwareModal` / `PolicyEditPage` / `ReportEditPage`,
`hostsOfferedTitle`, `listHostPolicyIds`, `listHostReportIds`, `findSimulations`). The same set-membership shape for
the three other things a label can scope: a per-run `.deb` through all three scopes (offered to exactly its hosts,
installed by the VM inside it); three policies including **Exclude all**, a mode only policies have; two reports,
with the VM storing the include-all one's row and the simulations outside storing none.

**OS updates** — `premium/exclusive/os-updates/macos-updates.spec.ts` and `ddm-conflict.spec.ts` (new, +
`OsUpdatesPage`, the fleet OS-update helpers, `appleListedMacosVersions`). Custom version and deadline save, read back
and clear; the form's refusals; "View all hosts" by membership rather than QA Wolf's drifting count; and both
directions of the OS-updates-vs-custom-profile refusal for macOS and Windows, which QA Wolf tested one way — on their
VMs fleet, with a deadline already past. Workstations only, in the exclusive project (they share its settings).

**The delivery augment and the free half** — `premium/controls/os-settings/configuration-profiles.spec.ts` gains an
untargeted profile delivered to and removed from the Mac; `free/controls/os-settings/profile-delivery.spec.ts` (new)
covers delivery, Resend, removal and a declaration on the free Mac.

**The refused label delete** — `premium/controls/os-settings/profile-broken-labels.spec.ts` (new). QA Wolf's three
"broken label" flows can't run since Fleet 4.87 refuses to delete a label a profile or declaration targets; the spec
guards that refusal for a `.mobileconfig`, a declaration and a Windows `.xml`, manual and dynamic labels, and the
release once the profile is gone. On Workstations, so nothing is delivered.

**The nightly as one chain** — `.github/workflows/qa-nightly.yml` (new). The nightly was three clock-spaced
schedules (Render 04:00 UTC, gitops 05:00, Playwright 05:30), and since 2026-08-27 GitHub has started this repo's
scheduled runs 4–6.5 h late, all together — the order held by luck. `QA — Nightly` runs Render's deploy hooks, a
30-min wait, both instances' `/healthz`, then per tier the gitops chain and, whatever it did, the suite; one
schedule, at 03:00 UTC — two hours ahead of the old 05:00, so a late start still finishes before morning — and
in order. Also bumps `upload-artifact` to v7 (Node 24).

**Version pins that never cleared** — `helpers/api/fma.ts` (fixed). `setPinnedVersion(…, '')` sent no `version`
field at all — Playwright drops an empty-string multipart field — so Fleet changed nothing and D's Claude walk,
`version-pinning` and the stranded-pin cleanup all left their pins in place. It failed the 09-29 nightly, the
first with two Claude builds cached. The body is now written by hand and the pin read back.

**The Labels page past page 1** — `LabelsPage` and `Pagination` (fixed). About 19 visible labels now sort ahead
of `pw-`, so a spec's second or third label lands on page 2. `Pagination` compared the first row's *link* to
detect the page change; Labels rows have none, and reading a missing link has no timeout — the lookup hung
until the test timed out. It now compares the whole row on a link-less table, and `runRowAction` reopens the
Actions menu until the option shows.

## Round 2 · Batch D — execution on hosts

Real round-trips to the real VMs: run a script and read what it did, send an MDM command and read the answer,
install and remove software. Every spec resolves its host with `findOnlineHost(..., { kind: 'real' })` — an
osquery-perf simulation never runs a script, never answers MDM and never installs anything.

**Scripts on one host** — `shared/hosts/host-run-script.spec.ts` (new, + `RunScriptModal`, `ScriptDetailsModal`,
`helpers/api/scripts.ts`). Nine source flows, both tiers, one spec:

- *Effect, not exit status.* The script writes a per-run nonce to `/tmp`; a seeded 60-second report run by the
  same VM reads the file's SHA-256 back, and the host's Reports-tab card has to show that exact hash. One flow
  covers the Run script modal, the host Activity card, the dashboard feed and host report results. A report's
  first stored row lands ~66 s after it is created.
- *Failure* (`exit 3`), *timeout* (agent `script_execution_timeout` lowered to 60 s for the case and restored),
  and one row per interpreter — zsh on macOS, bash and Python on Linux, PowerShell on Windows.
- The "finished script reverts to Pending when its details close" regression is an assertion inside the effect
  flow rather than its own spec.
- `--repeat-each=5`: 35/35 on both tiers.

**MDM commands** — `shared/hosts/mdm-commands.spec.ts` (new, + `MdmCommandDetailsModal`). The plan had a premium
and a free spec; free renders the same Activity card, "Show MDM commands" switch and details modal with the same
copy, so it is one `shared/` spec. A read-only `UserList` sent with `fleetctl mdm run-command`, then read back
through `fleetctl get mdm-command-results`, the activity, the command itself and the dashboard feed — each
tied to this run's command UUID. QA Wolf's three premium flows asserted a screenshot of a CLI table; the fourth
never sent a command at all.

**Script execution off** — `shared/exclusive/script-execution-disabled.spec.ts` (new). Settings → Advanced
options → "Script execution" off and back on, asserting the host Actions tooltip, the Scripts-library banner and
Fleet's own 403. The switch is global and Fleet refuses and holds *every* script while it is off, so the spec
runs in the new single-worker **`premium-exclusive` / `free-exclusive`** projects after the main one, and
`cleanup-setup` turns script execution back on at the start of every run. The premium source flow's cleanup
called `uncheck()` twice and left scripts disabled for whatever ran next.

**Wait-for-refetch helper** — `waitForHostRefetch(request, hostId, { since, field, refetch })` in
`helpers/api/hosts.ts`, comparing `detail_updated_at` or `software_updated_at` against a baseline taken
before the action. `shared/hosts/host-details-smoke.spec.ts` now uses it in place of its own poll.

**Batch runs** — `premium/controls/scripts/batch-run.spec.ts` (new, + `RunScriptBatchModal`,
`ScriptBatchDetailsPage`). One real VM per platform lands one host in each of Ran / Errored / Incompatible and
each tab lists exactly that host; ~100 simulations via "Select all matching hosts" are asserted as arithmetic
(targeted = matched, statuses sum to targeted, incompatible = exactly the orbit-less ones).

**Software on a host** — `premium/software/{install-on-host,uninstall-from-host,inventory-reflects-install,
update-on-host,large-upload}.spec.ts` (all new, + `HostSoftwareLibrary`, `InstallDetailsModal`,
`UninstallDetailsModal`, `helpers/deb.ts`). Every fixture is inert and ARM-safe: per-spec `.pkg`s and `.msi`s
built by `make-pkg.sh` / `make-msi.sh`, `.deb`s built at run time. The update spec is new (§3): the Update
contract on a per-run package pair and on Claude.

**The FMA fixture set** — `gitops/premium-fleetqa/fleets/vms.yml` brings the VMs fleet under gitops with Claude
kept installed by presence policies; `cleanup.steps.ts` clears stranded pins on QA and VMs and sweeps the specs'
own leftovers from VMs. The design and why each state is kept the way it is:
[D-host-execution.md](round-2/D-host-execution.md#the-fma-fixture-set).

**Verification** (2026-09-28): `npm run check` clean. Full `npm run test:free` — 275 passed, 9 skipped (all
pre-existing), `free-exclusive` after `free`. Full `WORKERS=2 npm run test:premium --headed`, the CI shape — 513
passed, 3 skipped, **39.6 min** (the nightly was ~15; the job limit is 60, so watch retries on the VM-bound specs).
`--repeat-each=5`: host-run-script 35/35 on each tier; the software + batch specs 90/95 with dependencies at 4
workers — the four failures were one Ubuntu VM carrying ~50 serialized installs, which led to the lighter
cleanup in `removeTitleFromHost` — then the two affected tests 10/10 at CI's 2 workers; large-upload 6/6.

Findings:

- **The timeout message never names the timeout.** `RunScriptDetailsModal` fills in "after N seconds" by
  regex-matching the script's *output*, not the configured limit — a script that prints nothing of the kind
  reads "Fleet stopped the script to protect host performance.", and one that prints "sleeping 180 seconds"
  would be reported as stopped after 180 s. Not filed yet; on the decision list.
- **Orbit appends its own line to a failed script's output** — `script execution error: exit status 3`, or
  `signal: killed` for a timeout — so the recorded output is never just what the script printed.
- **The macOS VMs have no Xcode Command Line Tools**, so `/usr/bin/python3` is Apple's install-prompt stub.
  Python scripts are exercised on the Linux VMs.
- **Every VM is ARM** — Apple M4 macOS, ARM Windows 11, aarch64 Ubuntu. That decides which installers can land.
- **Free rejects `fleet_id=0` on a script upload** ("The fleet does not exist"); Unassigned is the absence of the
  field.
- **`software_updated_at` means "inventory last changed", not "last collected".** Fleet skips the write when an
  ingest finds nothing new, so a wait on it hangs after a failed uninstall and after any change already
  ingested. "The inventory is current" is `detail_updated_at` advancing after the action, then the inventory
  agreeing — which is what `waitForSoftwareSettled` does.
- **A failed install is retried**: `MaxSoftwareInstallAttempts` = 3, reported `pending_install` between attempts,
  so "failed" only sticks several minutes in. The inventory spec asserts all three attempts.
- **An automatic-install policy's `created_policy` activity carries no fleet**, so the feed reads "created a
  policy [Install software] … (deb)." where a hand-made fleet policy reads "… on the VMs fleet." The same
  activity type, two shapes. On the decision list.
- **A new `.exe` title isn't linked to what Windows reports.** Fleet names it from the installer's ProductName
  ("7-Zip"); Windows lists the DisplayName ("7-Zip 26.01 (arm64)"), and the Library shows it no installed
  version. On the decision list. *Later the same day:* once the title was durable, Fleet's hourly
  `reconcile_windows_maintained_app_titles` cron merged the DisplayName title into it (renamed "7-zip", with
  7-Zip's upgrade code), because 7-Zip is a Fleet-maintained app — after which it is linked. Software outside
  the catalog would stay unlinked.
- **The installer size limit is per instance and checked in the browser.** Premium QA's is 10 GiB, not QA Wolf's
  1 GiB, and an over-limit file is refused on selection without a byte being sent.
- **`GET /labels/:id/hosts` leaves `orbit_version` null** for every host; `GET /hosts` fills it in.
- **A batch reads "finished" 2–4 minutes after its last host reports** — a cron marks it, not the last result.

**Post-review fixes** (2026-09-28, from the [test audit](../test-audit/21-software-on-hosts.md)): the scale batch's incompatible count is now the hosts that can't run a `.sh` (no orbit, scripts disabled, or not macOS / Linux), not just the orbit-less ones; the Claude update is its own test that skips on a level day; the `.exe` inventory reads poll; the cleanup sweep purges leftover `fleet-pw-*` packages from the Ubuntu VM; and the real-host lookup is one helper, `requireRealHost`.

**Follow-up (2026-09-28): durable VM fixtures** (`playwright/vms-durable-fixtures`). Install/uninstall now runs
on six titles `vms.yml` keeps on the VMs fleet (inert `.pkg` / `.msi` / `.deb`, 7-Zip's `.exe`, Itsycal, DB
Browser for SQLite; resting state uninstalled) in one new `software-lifecycle-on-host.spec.ts`, which also opens
the Inventory tab after each half; `install-on-host` keeps Deploy, `uninstall-from-host` the failing uninstall,
and adding software is `library.spec.ts`'s. A resting-state preflight in `cleanup.steps.ts` uninstalls any
fixture a dead run left installed; the nightly now applies `vms.yml` and `qa.yml`, and CI's fleetctl for an RC
is its release if published, else latest, instead of the pinned 4.85.0. Audit:
[21-software-on-hosts.md](../test-audit/21-software-on-hosts.md) SWH-14.

## Round 2 · Batch C — live host, read-only

Host-details cards, inventory filters, report-card results, OS drill-downs, affected-host counts. All reads,
all against the **real VMs** (`liveMacosHost` / `kind: 'real'`) — every assertion here depends on a genuine
device answering, and an osquery-perf simulation reports no certificates, no application paths and no
scheduled-query results.

Shipped: `shared/hosts/host-certificates.spec.ts` (new, + `CertificatesCard`) · `shared/hosts/host-software.spec.ts`
(Applications vs Full inventory) · `shared/hosts/host-reports-tab.spec.ts` (results-recency sorts) ·
`premium/hosts/host-report-details.spec.ts` (card first result ↔ report first row) · `premium/software/os.spec.ts`
+ new `free/software/os.spec.ts` (OS drill-in, Hosts sort) · `premium/software/vulnerabilities.spec.ts`
(affected-hosts hand-off, severity bands) + the free half in `free/software/vulnerabilities.spec.ts`.

**Three of the batch's eight rows pointed at the wrong file**, all caught by opening the existing spec first
([C-host-reads.md](round-2/C-host-reads.md#retargets-and-one-hand-off) has the detail):

- `host-certificates` was scheduled as premium-only, but `showCertificatesCard` gates on platform and data,
  not tier — both tiers' macOS VMs carry the same four system-keychain certificates, so it went `shared/`.
- Both `reports-filter-by-newer-results` flows are **host-details** flows, not `/reports/manage` ones. They
  landed in `shared/hosts/host-reports-tab.spec.ts`, where one shared test covers the premium and free rows
  at once and the reports-list specs were left untouched.
- The vitals-refetch row's read-only half was already covered; its actual subject — an install triggering the
  refetch — needs an install and was handed to batch D.

Free gained three specs it had no equivalent of: the certificates card, the OS drill-in, and the CVE
affected-hosts hand-off. The free OS spec asserts what free *doesn't* get, too —
`SoftwareVulnerabilitiesTableConfig` strips Severity, Probability of exploit and Published off-premium.

Two findings worth carrying:

- **Fleet keeps awaiting-results report cards last under both recency sorts**, not at whichever end a null
  key falls. `order_direction=asc` on `last_fetched` still returns the dated report first, so the sort
  assertion is a partition invariant rather than a plain ordering one.
- **A host's certificate rows can't be matched on "any cell".** Fleet issues every host both a `Fleet` CA
  certificate and a `Fleet Identity` certificate *issued by* `Fleet`, so a row filter on cell text resolves
  "Fleet" to two rows; `CertificatesCard.row()` is pinned to the Name column.

## Round 2 · Batch B — self-contained mutation

Everything here creates a record and removes it inside one test body: software-library CRUD on a title the
test seeds itself, and the organization logo.

Shipped: `premium/software/custom-icons.spec.ts` (new — lifecycle + validation, both A's and B's rows) ·
`premium/software/display-name.spec.ts` (new) · `premium/software/script-only-package.spec.ts` (new) ·
`premium/software/package-scripts.spec.ts` (new) · `premium/software/version-pinning.spec.ts` (new) ·
`shared/settings/organization/custom-logo.spec.ts` (new, **free gains it**) ·
`premium/software/library.spec.ts` (augmented with the app-store Type assertion) ·
`premium/dashboard/historical-data-collection.spec.ts` (new — moved in from batch A mid-flight, since its
subject is a fleet config write rather than a read-only surface).

New component objects: `EditAppearanceModal` (Fleet's `EditIconModal`) and `VersionsModal`. Grown:
`SoftwareTitleDetailPage` (summary card, both edit affordances, Versions entry), `SoftwareInstallerCard`
(pin badges, Edit / Download), `EditSoftwareModal` (Advanced options + `normalizeScript`),
`OrganizationInfoPage` (logo cards), `Navbar` (`logoImage`), `TeamSettingsPage` (the "Activity & data
retention" switches and their disable confirmation). New API helpers: `getOrgLogoUrls` / `deleteOrgLogo` /
`restoreOrgLogo`, `getFleetFeatures` / `setFleetFeatures` / `getFleetHistoricalData`, and
`getSoftwarePackage` extended with the stored scripts, hash and version pin.

**The org logo is a free feature and QA Wolf only ever tested it on premium**, so `custom-logo` went
`shared/` — the cards, the buttons and the nav swap are identical on both tiers and the spec is green on
both. That is the batch's free-coverage win.

`vpp/add-android-software-from-add-app-page` is a **DUP**: `library.spec` already runs
`{ kind: 'android', applicationId: 'com.openai.chatgpt' }` end to end. The one thing the source asserted that
we didn't was the summary card's Type line, so that became a three-line augment rather than a spec.

Findings worth carrying:

- **"Pin to an older version" is not reproducible, and doesn't need to be.** QA Wolf's three pinning flows
  relied on the instance having cached two AdGuard builds from earlier runs. A freshly-added app caches
  exactly one, and Fleet only caches a second when upstream ships an update — nothing a test can arrange. An
  exact pin sends the version string verbatim whichever build it names, so the spec resolves the options
  from the app's own `fleet_maintained_versions` and pins the newest. What it checks is that the pin sticks
  and that exactly one row is badged, not which number it is.
- **Every software spec has to claim its own title.** A premium title holds several packages, so two specs
  uploading a fixture with the same product name to the same fleet leave the Library accordion with two rows
  and every row-scoped locator ambiguous. Each of these specs seeds a distinct Fleet-maintained slug
  (`anydesk`, `archaeology`, `clockify`, `bruno` — none of them among the eleven `install-software.spec`
  claims), and the two custom-package fixtures are generated precisely so their titles are unique.
- **The Library tab is disabled under "All fleets"**, which is where premium lands. Select the scope first,
  then click the tab — clicking it first silently waits out the timeout on a greyed-out tab.
- **`getSoftwarePackage().name` is the installer filename**, not the title name. Searching a list with it
  finds nothing.
- **`SoftwareInstallerCard.header` was filtered on `expanded: false`**, so it resolved to nothing once the row
  opened and `count()` couldn't tell "already expanded" from "not rendered yet". Now matched by class and
  gated on `aria-expanded`, which also fixed the app-store delete path.
- **Turning historical reporting off deletes the data already collected.** The confirmation says so and it
  cannot be undone, so the dashboard spec runs against Workstations (no hosts, no history) and leaves the
  deployment-wide switches alone — flipping those would wipe the 30 days of VMs-fleet history that
  `fleet-scoped-cards.spec` plots. The two dashboard specs point at different fleets on purpose.
- **Fleet logs failed blob requests to the console as `{data: Blob, status: 404 …}`.** Removing a custom icon
  raises one while the title refetch is in flight. `DEFAULT_IGNORED_CONSOLE_ERRORS` already ignored the JSON
  shape (`data: Object, status:`); the blob shape is the same class of noise and now sits beside it.

## Round 2 · Batch A — no setup

Read-only surfaces, negative-path validation and API size contracts. Nothing in the batch creates, uploads or
configures anything that outlives its test, and nothing needs a host resolved.

Shipped: `shared/dashboard/platform-cards.spec.ts` (new, **both tiers**) ·
`premium/dashboard/fleet-scoped-cards.spec.ts` (new) · `shared/software/titles-table.spec.ts` (new, **both
tiers**) + `premium/software/titles-table.spec.ts` (the Library half) ·
`premium/software/role-access.spec.ts` (new) · `premium/software/fleet-maintained-filters.spec.ts` (new) ·
`premium/software/add-software-validation.spec.ts` (new) · `tests/api/host-software-payload.spec.ts` (new,
**both tiers**) · augments to `premium/software/manage-automations-access.spec.ts` (fleet-scoped and
single-fleet roles), `premium/software/no-teams-views.spec.ts` ("All fleets" across the navbar),
`premium/reports/reports.spec.ts` (live-report fleet targets), `premium/policies/policy-automations.spec.ts`
and its free sibling (the form locking itself mid-save), and
`tests/api/premium/max-request-file-sizes.spec.ts` (MDM-command and batch profile/script limits).

Page objects grown: `DashboardPage` (platform filter, "Hosts enrolled" rows, host-count cards, the whole
chart card and its Settings modal), `SoftwareTitlesPage` (column list, sort controls, column values, Library
tab, results count), `FleetMaintainedAppsPage` (platform filter, "Hide added apps", item count, platform
columns), `FileUploader` (`expectRejected` — the rejection reason lives in the toast's collapsed panel),
`ReportLivePage` (target chips + targeted-host summary), `TeamDropdown` (`options`), and
`countFleetMaintainedApps` in `helpers/api/fma.ts`. `fixtures.ts` was not touched.

**The dashboard has no platform cards any more.** Fleet replaced the macOS/Windows/Linux host-count cards
with the "Hosts enrolled" bar chart, whose y-axis ticks are `role="button"` named `"<platform> hosts"` and
link to that platform's built-in label with `status=enrolled`. The source flows' `:below()` CSS and
`[data-testid="card"]:has-text("Windows")` describe a page that no longer exists.

Free gained three specs it had no equivalent of: the platform cards, the inventory table's columns and
sorting, and the `exclude_software` API contract. The last one sits at the root of `tests/api/` rather than
under `premium/` as planned — the parameter is not premium-gated, and free had no coverage of it at all.

Findings worth carrying:

- **Built-in platform labels are unusable as an assertion on these instances.** The osquery-perf pool answers
  every built-in label query, so the "macOS" label holds 201 hosts of which most report Ubuntu. Clicking a
  platform row is asserted on the *link contract* (label route + `status=enrolled` + the filter's own name),
  never on the rows behind it.
- **The Fleet-maintained item count is not the row count.** The table groups an app's macOS and Windows
  entries into one row while the count stays per-platform: a three-row "zoom" search reads "5 items". Counts
  are cross-checked against `GET /software/fleet_maintained_apps` under the same filters instead.
- **"Hide added apps" hides added *entries*, not rows.** An app added on macOS but still available on Windows
  keeps its row and shows both states at once.
- **Two tests that snapshot the same global config key cannot run in parallel.** Adding a second case to
  `policy-automations` made one test's `afterEach` restore land between the other's save and its read-back;
  both tiers' describes are `mode: 'serial'` now. They were never `--repeat-each`-safe and still aren't —
  repeating a serial describe runs the copies concurrently.
- **`software-installer-selecting-no-team-prompts-user-to-choose-team` is a DUP** of the "Add software is
  disabled under All fleets, with a tooltip" case round 1 put in `library.spec.ts`, so
  `add-software-validation` carries the file-type rejections only.
- **`other-workflows-modal-saving-disables-form-inputs` never asserted its own title.** The source only
  checked the toast — which the existing spec already covered — so the augment is the assertion the title
  promises: Fleet passes `isUpdating` into the Modal as `isContentDisabled`, disabling submit and overlaying
  the form. Held open with a route rather than a sleep.

**Parked, with reasons:** `general/disable-hosts-online-and-vulnerabilities-chart-fleets-only` — its subject
is a global *and* per-fleet config write (turning historical reporting off, then back on), which is
self-contained mutation, not a read-only surface; batch A covers the chart's read-only half. And the
under-limit MDM command case is written to prove the payload cleared the size gate (Fleet answers
`404 No hosts targeted`) rather than to queue a real command, which would need an MDM-enrolled host and would
leave a command in its history with no way to withdraw it.

---

---

---

## Round 2 · Batch G — gitops mode (V1)

The one batch that cannot share an instance with anything else: enabling gitops mode is a global config write
that turns every mutating control in the UI read-only. It gets its own project — `gitops-mode`, `workers: 1`,
`fullyParallel: false`, `dependencies: ['premium']`, `retries: 0` — so it runs after the premium suite has
finished, and `'**/gitops-mode/**'` is added to premium's `testIgnore` so premium never picks it up itself.
`'gitops-mode'` and `'gitops-mode-teardown'` also go in `PROJECT_TO_SUITE`, because `resolveSuite()` throws at
config load for any `--project` it doesn't recognise.

Shipped: `premium/gitops-mode/01-indicator-and-links.spec.ts` · `02-gated-surfaces.spec.ts` ·
`03-exceptions.spec.ts` · `zz-everything-is-back.spec.ts` · `free/settings/gitops-mode.spec.ts` (the premium
gate: the Change-management paywall renders *instead of* the form, not above a working one).

Helpers and page objects: `helpers/api/gitops-mode.ts` (get/set/enable/disable/setException plus a
`withGitOpsMode` snapshot-and-restore) · `pages/components/gitopsMode.ts` (`expectGatedByGitOps`,
`expectNotGatedByGitOps`, `expectGitOpsTooltip`, `gitopsWrapperFor`, `gitopsWrappers`) ·
`pages/settings/ChangeManagementPage.ts` · `pages/components/EnrollSecretModal.ts` ·
`Navbar.gitopsIndicator`.

**Two teardown lifecycles, deliberately.** `setup/gitops-mode.teardown.ts` disables the mode promptly and
asserts it, and `setup/cleanup.steps.ts` — already the "self-heals regardless of how state got there" project,
and a dependency of both tiers — calls `disableGitOpsMode` too. Measured, not assumed: a `SIGINT` mid-run runs
the teardown project and the instance ends up off; a `SIGKILL` of the whole process group does not, the flag
stays on, and the next run's `cleanup-setup` clears it. `disableGitOpsMode` never touches `repository_url` or
the exceptions, because the URL is itself part of the gate for three surfaces.

Three things worth remembering:

1. **"Disabled" is four different DOM shapes, and the only invariant is the wrapper.** A native `disabled`, a
   `div[role=checkbox][aria-disabled=true]`, a react-select with no disabled accessible element at all, and a
   raw `disabled` with no wrapper and no tooltip. `.gitops-mode-tooltip-wrapper` is in the DOM *iff* gitops
   mode is effectively enabled for that control, exceptions included — every assertion is built on that.
2. **`filter({ has })` cannot find an ancestor.** It re-resolves its argument *underneath* each candidate, so
   "the wrapper around this button in that modal" silently matched nothing while "the wrapper around this
   react-select" matched all fifteen of them. `gitopsWrapperFor` walks up with an xpath ancestor axis instead.
3. **A concurrent app-config write turns the flag off mid-run.** A parallel agent saving Organization ›
   Advanced on the shared instance flipped `gitops_mode_enabled` back to `false` one second before a
   screenshot, failing a test that passes in isolation. This is the mechanical reason the project is last,
   single-worker and dependent on `premium`.

Deferred to V2, with reasons: the `software` exception (its two probes are the two bugs below, and its only
zero-seed surface — the Fleet-maintained app form — needs a "not yet added" catalog resolver); Controls ›
Variables' split gating (the best over-gating detector, but it needs a seeded variable); the Change-management
*UI* write flow and its activity copy; Policies, Reports, Software-title and OS-settings gated surfaces.

## Suite bugs found and fixed while porting

These were pre-existing defects the migration surfaced, not regressions it caused.

| fix | why it mattered |
|---|---|
| **`withStaticUser` now caches sessions to `.auth/`** | `POST /login` is throttled to 10/min in one bucket shared by every user and worker; a throttled login silently lands on `/login` looking like a bad password. Adding two role logins starved *pre-existing* specs (`labels/role-access`). Now one login per user per suite instead of per test — also measurably faster. |
| **`DataSet.value()` matches the whole term** | it matched substrings, so `"Fleet"` also resolved `"Added to Fleet"` on host vitals. Expressed as one selector, because a `filter({ has })` locator inherits the chain of whatever root built it — which silently matched nothing for container-scoped DataSets. |
| **`OrganizationAdvancedPage.goto()` anchor** | waited on an "Advanced options" heading the page no longer renders. Nothing had used the POM, so it had been quietly broken. |
| **`ReportLivePage` extended to the run screen** | previously only covered the targets picker, so no spec could assert a completed run. |
| **The vulnerable-software lookup no longer hides its own failures** | it read only page 0 of `/software/titles?vulnerable=true`, whose default ordering is all deb packages, and returned `null` on a non-OK response — which callers turn into a platform skip. So the macOS and Windows title→CVE variants had been skipping **every run** behind "No macOS software found", and a 500 was indistinguishable from missing test data. Now one paged sweep resolves every platform group, a failed request throws, and a match must carry a CVE in the requested scope. |

Fixing that last one exposed an instance limit worth knowing about: `vulnerable=true` builds a large MySQL
temp table, and firing one per platform per worker made the premium QA instance return
`Error 1114 (HY000): The table … is full`. Sequentially the same query is fine, so it is capacity rather than
a query bug — the single sweep removed it in practice, but `tmp_table_size` / `tmpdir` headroom on that box is
an open ops item and a plausible source of unexplained flakiness elsewhere.

## Fixture and helper inventory added

`liveMacosHost` (real macOS VM, worker-scoped) · `vmsFleetId` · `findOnlineHost(request, platform, { kind, withUsers, withOrbit })` · `findSimulatedHostIds` · `hostExists` · `getHostFleetId` · `getHostDetailUpdatedAt` · `getFleetWebhookSettings`/`setFleetWebhookSettings` · `getFleetHostExpirySettings` · `findReportByName`/`getHostReportLastFetched` · `activityCopy.activityAutomations` · `TransferHostModal` · `SelectReportModal` · `TeamSettingsPage` · `HostQueryReportPage` · `TeamDropdown.selectByLabel`.

## Plan corrections worth remembering

The plan was wrong in three places, each caught by checking the instance instead of the document:

1. **A named durable VM ("MacOS 26") no longer existed.** A parked fixture prototype resolved hosts *by name*;
   the load fleet regenerates names and ids on every restart. Resolution is by platform + status + MDM
   enrollment now, never by name.
2. **"Report cards need a cached result"** was wrong for the Reports *tab* — reports appear as soon as they
   apply to the host. It was right only for the per-host results drill (C2 #24).
3. **"The sim pool self-heals after a delete"** was wrong — osquery-perf enrolls once at startup with no
   node-invalid recovery, so a deleted simulation never returns on its own.
