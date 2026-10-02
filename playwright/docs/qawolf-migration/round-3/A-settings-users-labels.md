# Batch A — Settings, users, labels, account

**19 gaps → about 9 specs, nearly all augments, after merges.** `Settings forms` · `Enroll secrets` · `Users` ·
`Labels` · `Theme and account` · `Activity feed`

**Status: reviewed 2026-10-02, building** (planned 2026-10-01). Decisions below; the table's last column is the review.

> ## ▶ Start here
>
> **Branch from `main` after [PR #78](https://github.com/AndreyKizimenko/qa-automation-poc/pull/78) has merged.**
> **Invoke the `playwright-test-author` skill first** (Skill tool) and follow it. Then read, in order:
> [README.md](README.md) §4–§5 (how a round-3 batch runs; rules new since round 2), round 2's
> [README §9](../round-2/README.md#9-working-a-batch-since-d), `playwright/CLAUDE.md` (the cleanup pipeline;
> **Do not create or delete teams from test bodies**), then this file.
>
> **What this batch is.** Forms with no hosts behind them, which round 1 opened and didn't finish: webhook
> fields never set, enroll secrets added but never copied or deleted, a theme switched once, one sortable column
> of three. It's the cheapest batch and a good first one. **Three of its rows touch state the whole instance
> stands on**: the server URL, the enroll secret the hosts enroll with, and fleet lifecycle. Those are
> decisions before they're builds (§2).
>
> Facts below were checked on 2026-10-01 against `main` (d55846a), the QA Wolf flows, and Fleet
> `rc-minor-fleet-v4.93.0`, the build both instances run.

## The gaps

| Gap | What's untested today | Proposed target | Kind | Source flow | Decision |
|---|---|---|---|---|---|
| round 1 C1 #3 | host status webhook: the host % and days fields are never set or read back | `shared/settings/host-status-webhook.spec.ts` | augment | `flows-Free/hosts-edit-host-status-webhook.flow.js` | **build**: set both dropdowns and read them back through the API |
| round 1 C1 #17 | as round 1 C1 #3, premium | `shared/settings/host-status-webhook.spec.ts` | augment | `flows-Premium/hosts-edit-host-status-webhook.flow.js` | **build**, with C1 #3 (one shared augment) |
| round 1 C1 #5 | enroll secret add / copy / delete on the global list (only CTA visibility is asserted) | `shared/settings/enroll-secrets.spec.ts` (global secrets, both tiers) | new | `flows-Free/hosts-global-admin-can-see-and-click-cta-buttons.flow.js` | **build**, `shared/` on both tiers (Andrey, 2026-10-02); afterEach restores any original that went missing, never a stale snapshot (§2.2) |
| round 1 C1 #19 | premium: enroll secret copy and delete (add only today) — the flow works on the global list; on premium that's covered by C1 #5's shared spec, so this row is Workstations copy + delete | `premium/settings/enroll-secrets.spec.ts` | augment | `flows-Premium/hosts-global-admin-can-see-and-click-cta-buttons.flow.js` | **build**: Workstations copy + delete under the existing restore |
| round 1 C1 #14 | a label whose name has special characters — created, listed, deleted (round 1 called it redundant; nothing tests it) | `shared/labels/labels.spec.ts`, after C1 #2's move | augment | `flows-Premium/hosts-create-and-delete-label-with-special-characters.flow.js` | **fold**: the Dynamic lifecycle renames its label to a special-characters name, so list, delete toast and activity feed all carry it; no new test |
| round 1 C9 #13 | Labels page: sort by Description (Name only today); sorting by Type proves nothing while every label is dynamic | `premium/labels/sort-view.spec.ts` | augment | `flows-Premium/new-labels-page-sort-labels-and-view-all-hosts-on-dedicated-labels-page.flow.js` | **cut** (Andrey, 2026-10-02): the same client-side table sort the Name test already proves |
| round 1 C1 #2 | label CRUD on free (premium-only today; FREE-COVERAGE-AUDIT S5) — `labels.spec.ts` is tier-agnostic | move `premium/labels/labels.spec.ts` to `shared/labels/` | augment | `flows-Free/hosts-create-edit-and-delete-custom-label.flow.js` | **build**: move to `shared/labels/`; the Manual label takes a simulation, not `firstHostDisplayName` |
| round 1 C5 #2 | theme: System default and Light, and the choice surviving a sign-out/sign-in (Dark + reload only today) | `shared/account/theme.spec.ts` | augment | `flows-Free/general-dashboard-widgets-hosts-active-ui-and-filters.flow.ts` (misnamed: it holds the free dark-mode flow) | **build, narrowed**: System follows the OS live, an explicit choice pins it (`initTheme`), via `emulateMedia`. **Sign-out half cut** (Andrey, 2026-10-02): logout clears only the session by design |
| round 1 C5 #11 | as round 1 C5 #2, premium | `shared/account/theme.spec.ts` | augment | `flows-Premium/general-dark-mode-dark-mode-ui-and-fleet-automatically-uses-user-preference-on-dark-mode.flow.ts` | **build**, with C5 #2 |
| round 1 C7 #1 | an admin sets another user's password (round 1: verify through an API login, not a UI landing) | `shared/settings/users/` (one password test for both tiers, with C7 #8) | augment | `flows-Free/settings-admin-able-to-edit-existing-users-password.flow.js` | **build**: `shared/settings/users/edit-password.spec.ts` (the edit specs are tier-split); new password logs in, old one and old token get 401 |
| round 1 C7 #8 | as round 1 C7 #1, premium | `shared/settings/users/`, with C7 #1 | augment | `flows-Premium/settings-admin-able-to-edit-existing-users-password.flow.js` | **build**, with C7 #1 |
| round 1 C7 #3 | Advanced options on free (premium-only spec; FREE-COVERAGE-AUDIT S9 says move it to shared/) | move `premium/settings/advanced-options.spec.ts` to `shared/settings/organization/` | augment | `flows-Free/settings-edit-advanced-options.flow.js` | **build**: move to `shared/settings/organization/` |
| round 1 C7 #13 | Advanced options: Verify SSL, STARTTLS and the other fields (only SMTP domain edited; host expiry avoided on purpose) | `shared/settings/organization/advanced-options.spec.ts`, after C7 #3's move | augment | `flows-Premium/settings-edit-advanced-options.flow.js` | **fold** into the moved test: Verify SSL certs + Enable STARTTLS beside the domain, each restored; host expiry still untouched |
| round 1 C7 #4 | Organization settings › Fleet web address — no page object, no test | review: a server_url change on a shared instance (decision) | review | `flows-Free/settings-edit-fleet-web-address.flow.js` | **cut** (Andrey, 2026-10-02): a save re-syncs DEP profiles with Apple; validation is client-side only and moving to submit-only; Advanced options already guards `server_url` |
| round 1 C7 #14 | as round 1 C7 #4, premium | review | review | `flows-Premium/settings-edit-fleet-web-address.flow.js` | **cut**, with C7 #4 |
| round 1 C7 #10 | fleet create / rename / delete — no lifecycle check (suite rule: no team create/delete in test bodies) | review: API-only throwaway fleet, or cut (decision) | review | `flows-Premium/settings-create-edit-and-delete-team-premium.flow.js` | **build** (Andrey, 2026-10-02): one `pw-fleet-*` created, renamed, deleted through the UI; `pw-*` fleet sweep in `cleanup.steps.ts` |
| round 1 C10 #10 | My account as a team admin: "2 fleets" and a role of "Various" (the `team-admin` static user isn't in MY_ACCOUNT_USERS) | `premium/account/my-account.spec.ts` | augment | `flows-Premium/role-access-premium-verify-team-admin-role-and-access-premium.flow.js` | **build**: `team-admin` joins MY_ACCOUNT_USERS; its Role check skipped behind fleetdm/fleet#54620 |
| round 1 C6 #28 | Unassigned stays selected across Hosts and Controls (only All fleets persistence is asserted) | `premium/software/no-teams-views.spec.ts` | augment | `flows-Premium/no-teams-no-teams-switching-tabs-doesnt-switch-to-all-teams.flow.js` | **build**: read-only sibling of the All-fleets walk |
| round 1 C5 #8 | activity feed: filter by actor / type / date, and sort by time | `shared/dashboard/activity-feed.spec.ts` (the filters aren't tier-gated) | new | `flows-Premium/activity-feed-filter-activity-feed-by-actor-full-name-email-type-and-date-sort-by-time.flow.js` | **build**: a disposable `qa-test-*` actor and its three activities |

## 1. Review first

Open each flow body (the Source column, under `qa-wolf/`) and its target spec, decide build / fold / cut /
long-term, and write it into the table. Already found:

- **Decisions:** C7 #4 / #14 (Fleet web address, §2.1), C1 #5 / #19 (enroll secrets, §2.2), C7 #10 (fleet
  lifecycle, §2.3).
- **Merges:**
  - C1 #3 + #17: one augment of the shared webhook spec.
  - C5 #2 + #11: one augment of the shared theme spec.
  - C7 #1 + #8: one password test, in `shared/settings/users/`, since it's the same on both tiers.
  - C7 #3 + #13: move the Advanced spec to `shared/settings/organization/` (FREE-COVERAGE-AUDIT S9's
    target), then augment it once.
  - C1 #2 + #14: move `premium/labels/labels.spec.ts` to `shared/labels/` (it's tier-agnostic), then add the
    special-characters label to it.
- **C1 #19 is mis-scoped.** Its flow works on the global list, which C1 #5's shared spec covers on premium too.
  What's left for premium is copy and delete on Workstations, under the existing spec's restore.
- **C9 #13: Description only.** All 25 gitops labels are dynamic, so a Type sort orders identical values and
  proves nothing; a manual label would need a host.
- **C10 #10 needs a suite fix first.** `expectedRoleDisplay` (`helpers/api/static-users.ts:333`) returns
  "Admin" for `team-admin`, but Fleet shows **"Various"**: `generateRole` has no all-admin branch
  (`AccountSidePanel` `helpers.tsx:461-481`). Fleets reads "2 fleets" with a tooltip, premium only
  (`AccountSidePanel.tsx:136`). It's a Fleet bug, filed as
  [fleetdm/fleet#54620](https://github.com/fleetdm/fleet/issues/54620) (2026-10-02): build the row asserting
  "Admin", and skip that one check with `TODO(fleetdm/fleet#54620)` and a row in `docs/blocked-by-product-bugs.md` until it's fixed.
- **C5 #8: don't port the flow.** It seeds a random actor and walks ten pages. Build it around a disposable
  actor (§3).
- **QA Wolf's copy has drifted**: "Create fleet" is now "Add fleet", and the "Manage enroll secret" button is
  gone (it's the gear's "Enroll secrets" now).

## 2. The three rows that touch global state

### 2.1 Fleet web address (C7 #4, C7 #14)

`server_url` is the instance's own address, and much of Fleet hangs off it:

- **On premium, any change calls Apple.** `appconfig.go:1857-1883` detects the change and runs
  `MDMAppleSyncDEPProfiles`, which pushes the automatic-enrollment profiles to Apple Business Manager.
- **The Apple MDM URL follows it** when `mdm.apple_server_url` is empty (`server/fleet/app.go:621-626`). So do
  Windows MDM discovery (`server/service/orbit.go:665`), the Android enterprise callback and push URL
  (`server/mdm/android/service/service.go:215,336`), the SSO ACS URL (`server/service/sessions.go:502-507`),
  and links in emails and webhooks. Android's enterprise check calls `EnterprisesList(serverURL)` (`:834`); whether a
  changed URL can make Fleet think the enterprise was deleted is unverified.
- **Validation is light.** `ValidateServerURL` (`server/service/validation_setup.go:30-48`) wants an
  `http://` / `https://` prefix and a host; https isn't required. Errors: "Fleet server URL must be present",
  "Couldn't update settings: …" (`appconfig.go:1038-1043`).
- **The same value is a no-op**: the diff sends nothing, Fleet still toasts. UI: "Fleet web address", "URL",
  "Include base path only (eg. no /latest)" (`WebAddress.tsx`); disabled in gitops mode. The nightly gitops apply
  restores `$FLEET_URL`.

A set-and-restore means two pushes to Apple and a window where enrollment and SSO point at the wrong host, on an
instance other runs share. **Recommend: cut, or validation only**: an invalid and an empty URL refused with
their errors, and the stored value unchanged (API).

### 2.2 Enroll secrets (C1 #5, C1 #19)

- **Every write replaces the whole list.** `POST /spec/enroll_secret` → `ApplyEnrollSecretSpec`
  (`appconfig.go:2999-3050`) → `applyEnrollSecretsDB` deletes every secret in the scope and inserts the list it
  was sent (`server/datastore/mysql/app_configs.go:176-250`). The UI sends its cached list plus or minus one
  (`ManageHostsPage.tsx:1353-1450`). Fleets: `PATCH fleets/{id}/secrets`, also the full list.
- **Enrolled hosts don't use it again** (they authenticate by node key, `server/service/osquery.go:~80`), **but
  the simulations re-enroll on every daemon restart** with the configured secret: the perf daemons run without
  `--node_key_file` (`tools/perf-hosts/…plist`). Delete that secret and the 300 simulations silently stop coming
  back. Whether the VMs' orbit would re-enroll is unverified. On free, `gitops/free-fleetqa/default.yml:21-22` pins
  the global `$FLEET_ENROLL_SECRET`; premium's gitops leaves secrets out.
- **`EnrollSecretModal`'s edit, delete and copy act on `.first()`**: as written, they'd hit the real secret.
  The page object needs row-scoped methods before anything deletes.
- UI: the gear "Hosts page settings" › "Enroll secrets" (`ManageHostsPage.tsx:2203-2211`), or
  `/hosts/manage?manage_enroll_secrets=1` (no `fleet_id` for global). Modal "Manage enroll secrets": "Add
  secret", "Done". Rows are `[data-testid="osquery-secret"]` with "Edit enroll secret" / "Delete enroll secret"
  (`EnrollSecretRow.tsx:47-72`) and "Copy to clipboard" → "Copied!". The editor's textbox "Secret" ("Must
  contain at least 32 characters.") takes a known value. Delete warns "Hosts can no longer enroll using this
  secret." Toasts: "Successfully added enroll secret." / "Successfully deleted enroll secret." Reading the
  clipboard needs the context's `permissions: ['clipboard-read', 'clipboard-write']`.
- **Today:** `premium/settings/enroll-secrets.spec.ts` "add an enroll secret to the Workstations fleet"
  snapshots in `beforeEach` and restores with `setTeamEnrollSecrets` in `afterEach`. `helpers/api/enroll-secrets.ts`
  has `getGlobalEnrollSecrets` but **no global setter**.

**The safe pattern:** fill a known 32+ character `pw-enroll-<stamp>` secret; find its row by that value
(`input[value=…]`); copy it; delete **only that row**. The `afterEach` removes the marker if it's still there by
reading the list, filtering the marker out, and posting the rest. **Never restore a stale global snapshot**: a
full replace from an old list drops anything added since. Workstations (C1 #19) can keep its existing restore,
since nothing enrolls there. Put the global half to Andrey before the first run (§ Decisions).

### 2.3 Fleet lifecycle (C7 #10)

The suite rule (`playwright/CLAUDE.md`) says no fleet create or delete in test bodies, but there's a precedent:
`premium/dashboard/historical-data-collection.spec.ts:136` creates `pw-historical-data-<ms>-<idx>` fleets and
deletes them with a retried delete. Helpers exist (`createFleet`, `deleteFleet({ ignoreMissing })`,
`recreateFleet`, `findFleetByName`, `helpers/api/fleets.ts:100-152`); **`cleanup.steps.ts` sweeps no fleets**.
A new fleet gets an enroll secret and copied agent options, logs activities, and shows in every fleet dropdown
until it's gone; gitops won't delete an undeclared fleet unless run with `--delete-other-fleets`.

UI: "Add fleet", "Fleet name", "Create"; toasts "Successfully created <n>.", "Successfully updated fleet name to
<n>.", "Successfully deleted <n>." (`ManageFleetsPage.tsx:158,202,237`). The flow's row-count assertions race
other specs; assert the named row instead.

**Options:** cut (every gitops apply exercises fleet lifecycle), or one `pw-*` fleet created, renamed and deleted
in one test, with a `pw-*` fleet sweep added to `cleanup.steps.ts`. That makes the precedent a rule, so it's
Andrey's call. [Batch B](B-policy-report-software-forms.md)'s C3 #15 would use the same throwaway fleet.

## 3. Facts for the build

- **Host status webhook (C1 #3, #17).** `GlobalHostStatusWebhook.tsx:181-226`: dropdowns "Percentage of hosts"
  (1 / 5 / 10 / 25%) and "Number of days" (1 / 3 / 7 / 14 days), rendered only while enabled. They're
  **react-select v1**, so `getByLabel` fails; use the `.form-field--dropdown` → `.Select-menu-outer` option
  pattern in `pages/components/TargetLabelSelector.ts:144`. API: `webhook_settings.host_status_webhook.
  {host_percentage, days_count}` (typed in `helpers/api/config.ts:45-51`); the server rejects ≤ 0. Pick values
  that differ from the defaults (1 / 1). The spec already snapshots and restores the subtree.
- **Labels (C1 #2, #14, C9 #13).** No frontend tier gate on dynamic or manual labels (`NewLabelPage.tsx:640-670`);
  the server gates only fleet-scoped labels (`server/service/labels.go:400,455,683`). On the move to `shared/`:
  replace `firstHostDisplayName` (it can pick a real VM) with `findSimulations`, and drop the membership wait.
  A name like `!@#$%^&*()_-+= <stamp>` is safe through the suite: `DataTable.rowWith` uses `hasText` with no
  regex, `activityCopy.label` escapes, `deleteLabelsMatching` uses `includes`, deletes go by id. Keep `pw-`
  inside the name so the sweep catches it. Toast on delete: `Successfully deleted <name>.`
  `LabelsPage.sortByColumn` exists; the list is client-paginated at 20, so keep `isSorted`, not array equality.
- **Theme (C5 #2, #11).** Radiogroup "Theme": "System" / "Light" / "Dark" (`AccountSidePanel.tsx:106-135`;
  `MyAccountPage.selectTheme`). `custom-logo.spec.ts:92-99` already covers Light. Stored in localStorage
  `fleet-theme`; *System* removes the key (`frontend/utilities/theme.ts`); logout clears only the session and
  token (`LogoutPage.tsx:15-22`). "Survives a sign-out" means the same browser context, not the user. **Signing
  out kills the shared admin session**: use a blank storage state and `loginAsAdmin`, as
  `shared/auth/logout.spec.ts` does. Prove System with `page.emulateMedia({ colorScheme: 'dark' })`.
- **An admin sets a password (C7 #1, #8).** Field "Password", placeholder `••••••••` (`UserForm.tsx:482-496`);
  sends `new_password` (`EditUserPage.tsx:132`); no old password needed; the change ends the user's sessions
  (`server/service/users.go:827-830,937`). Verify with a cookie-less API login with the new password, as
  `shared/settings/users/row-actions.spec.ts:84-95` does, and a 401 on the old token. **Locator trap:**
  `UserFormFields.password` is `getByPlaceholder('Password')`, which doesn't match here, and
  `getByLabel('Password')` collides with the auth-method radio. Use a `qa-test-*` user (swept by `cleanup-setup`).
- **Advanced options (C7 #3, #13).** Four sections (`Advanced.tsx:251-275`); only `HostLifecycleSection` takes
  `isPremiumTier`. "Verify SSL certs" / "Enable STARTTLS" (`ServerAuthenticationSection.tsx:98-133`, accessible
  names `verifySSLCerts` / `enableStartTLS`) → `smtp_settings.verify_ssl_certs` / `enable_start_tls`; inert while
  SMTP is off, which it is on both instances. **Keep avoiding host expiry**: the flow sets a 5-day window, and
  changing it can make Fleet delete hosts. `FeaturesSection` (Live reports, Script execution, Generative AI) and
  "Store report results" are switches other specs stand on; none belongs in a main-project test. Restore field by
  field: `/config` rejects whole snapshotted subtrees with read-only members (400).
- **My account (C10 #10)**: see §1.
- **Unassigned persistence (C6 #28).** Unassigned is offered on Hosts, Controls, Software and Policies, not on
  Reports or the Dashboard (`ManageQueriesPage.tsx:118`). Reuse `TeamDropdown.select` / `currentValue` and the
  navbar. Read-only. The flow's "Pigeons" fleet is stale.
- **Activity feed (C5 #8).** `GET /activities?query&activity_type&start_created_at&end_created_at&order_key=
  created_at&order_direction&per_page=8` (`frontend/services/entities/activities.ts:53-62`); `query` is a prefix
  match on name and email. Not tier-gated, so `shared/`; the feed shows only with no fleet selected. Copy:
  "Search activities by user's name or email", "All types", "All time" … "Last 12 months", "Sort by newest" /
  "Sort by oldest", empty state "No activities match the current criteria". **Deterministic recipe:** create a
  `qa-test-<ms>` user, sign it in through the API (logs `user_logged_in`), have it create and delete a report.
  Searching its name then yields exactly those three rows, and type, date and sort can be asserted over them.
  Whether the type options expose `role=option` is unverified.

## Reusable pieces

`IntegrationsPage` (host-status methods), `TeamSettingsPage`, `HostsListPage.openEnrollSecrets` /
`addEnrollSecret`, `EnrollSecretModal` (needs row-scoped methods), `LabelsPage` (`sortByColumn`, `rowFor`,
`runRowAction`), `MyAccountPage.selectTheme`, `OrganizationAdvancedPage`, `EditUserPage`; API: `createUser` /
`qaTestEmail`, `getAppConfig` / `patchAppConfig`, `getGlobalEnrollSecrets`, `getTeamEnrollSecrets` /
`setTeamEnrollSecrets`, `deleteLabelsMatching`, the fleet helpers.

## Decisions (answered by Andrey, 2026-10-02)

1. **Fleet web address: cut** (C7 #4, #14). A save re-syncs the DEP profiles with Apple (§2.1); the form's
   validation runs in the browser only, so a validation test proves a validator, and Fleet is moving validation
   to submit-only. `advanced-options.spec.ts` already asserts a neighbouring save leaves `server_url` alone.
2. **Global enroll secrets: build, in `shared/`, on both tiers.** The cleanup is a **union restore**, not
   marker-only: the `afterEach` reads the live list and posts it back minus the marker plus any secret from the
   test's opening snapshot that has gone missing. Marker-only can't recover a test that deleted the wrong row;
   the union can, and never drops a secret added since. Premium's gitops doesn't declare global secrets, so
   on premium nothing else would put one back.
3. **Fleet lifecycle: build**, one `pw-fleet-*` per run plus a `pw-*` fleet sweep in `cleanup.steps.ts`.
   `playwright/CLAUDE.md` now says when a test body may create a fleet. Batch B's C3 #15 uses the same pattern.
4. **Cuts beyond the plan:** C9 #13 (Description sort) and the sign-out half of C5 #2 / #11 (theme).

## Free coverage

Almost all of this batch exists on both tiers: the webhook, enroll secrets (global), theme, password, Advanced
options minus host lifecycle, labels and the activity feed go in `shared/`. Premium-only: Workstations secrets,
Unassigned persistence, My account's Fleets line, fleet lifecycle.

## Traps this batch will hit

- **Global config other runs share** (webhooks, Advanced options, enroll secrets). Snapshot and restore through
  the API, in an `afterEach` where a timed-out test would strand it; the enroll-secret list is the exception
  (marker-only cleanup, never a snapshot replace).
- **The nightly gitops apply resets webhooks** (and on free, the enroll secrets). Don't rely on a value set by
  an earlier run.
- **The activity feed and the labels list are written by every spec.** Filter to your own marker.
- **Signing out** the default context logs out the shared admin session for the rest of the worker.

## Done when

- Every row has a written review decision; the questions above have Andrey's answer.
- The moves (`labels.spec.ts`, `advanced-options.spec.ts` to `shared/`) and the augments built, on every tier
  each targets, each restoring what it changed.
- `npm run check` clean; each changed spec run with dependencies on both tiers, once headed; the enroll-secret
  and Advanced-options specs `--repeat-each=5`.
- `playwright-test-reviewer` run on the branch's diff, findings fixed or answered.
- Docs in the same commits: this file's *What landed*, a [DELIVERY-LOG](../DELIVERY-LOG.md) line, a
  [test-audit](../../test-audit/README.md) entry per `test()` (and the moved specs' entries updated),
  `helpers/README.md`, `pages/README.md`, and this round's [README](README.md) batch table and [INDEX](INDEX.md).
- PR open, Andrey told it's ready for its branch run.

## What landed

| gaps | spec | what |
|---|---|---|
| C1 #2, C1 #14 | `shared/labels/labels.spec.ts` (moved from `premium/labels/`) | Dynamic + Manual lifecycles now run on free too. Dynamic's edit renames to `<name> !@#$%^&*()_-+=`, which the list, delete toast and activity feed then carry. Manual takes `findSimulations` Linux slice 2 (`getHostDisplayName` replaces `firstHostDisplayName`), and asserts the picker chose that host. Both deletes check absence with the paging `locateRow` (test-audit FINDINGS #1) |
| C7 #3, C7 #13 | `shared/settings/organization/advanced-options.spec.ts` (moved from `premium/settings/`) | Runs on free too. Domain plus both SMTP checkboxes (flipped from their current state) in one save; read back after a reload and through the API; the rest of `smtp_settings` and the four neighbouring subtrees unchanged. Restore moved to an `afterEach`. Host expiry still never touched. `--repeat-each=5` green on both tiers |
| C1 #3, C1 #17 | `shared/settings/host-status-webhook.spec.ts` | 5% and 3 days (defaults are 1 / 1) picked from the dropdowns (`role=listbox` menus inside a `.form-field--dropdown` wrapper), shown again after a reload, and stored as `host_percentage: 5`, `days_count: 3`. Both tiers |
| C5 #2, C5 #11 | `shared/account/theme.spec.ts` | New test: System tracks the emulated OS scheme both ways without a reload; Light picked under a dark OS removes `dark-mode` and still wins after a reload. Light was already on screen in `custom-logo.spec.ts`; this is the first test where Light can fail. Sign-out persistence cut. Both tiers |
| C7 #1, C7 #8 | `shared/settings/users/edit-password.spec.ts` (new) | One test, both tiers: an admin sets a `qa-test-*` user's password from Edit user; new password logs in (200), old one is refused (401), a token from before the change turns 401. `EditUserPage.newPassword` targets the field by placeholder (its label collides with the Authentication radio) |
| C10 #10 | `premium/account/my-account.spec.ts` | `team-admin` added to `MY_ACCOUNT_USERS`; Role skipped for it with `TODO(fleetdm/fleet#54620)` and a `blocked-by-product-bugs.md` row. New test: the `2 fleets` tooltip names both fleets |
