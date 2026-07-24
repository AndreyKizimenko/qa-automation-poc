# QA Wolf → Fleet Playwright migration — HANDOFF

> **UPDATE (Batch 2 in progress):** The full HANDOFF order (7 items) + 10 extras are DONE — ~57 tests,
> premium+free, all `npm run check`-clean + live-green, committed to `main` (unpushed, no PR). See
> **`BATCH-2.md`** for the live tracker + per-item grounding. Shipped: software (manage-automations-access,
> os, vulnerability-automations, no-teams-views), policies (sql-validation, policy-automations), reports
> (save-as-new, list-filters, automations), labels (CRUD, sort-view, role-access), settings (org-info,
> fleet-desktop, enroll-secrets, mdm-migration-validation), controls (custom-variables, disk-encryption),
> plus the **appConfig save/restore helper** + API helpers (reports/labels/policies/variables/enroll-secrets/config).
> **Still open in Batch 2:** `automatic-enrollment` + EULA-26MB size case; `advanced-options` SKIPPED
> (risky bundled save — flag to lead); labels team-admin variants blocked (no team-admin static user).
> **software `edit-package` DONE** (premium; self-service round-trip via the "Edit package" modal — see
> BATCH-2.md for two live-proven grounding corrections). Then Batch 3 (hosts) + Batch 4 (online-host-dependent).
> Working tree: clean except pre-existing unrelated `CLAUDE.md` + `docs/run-reviews/` (NOT ours — leave alone).

> **UPDATE 2026-07-21:** Batch 1 is **COMMITTED to `main` in 3 chunks** (not pushed, no PR) after the full
> premium (257 passed) + free (141 passed) suites re-ran green, 0 failures. `ws-admin`/`api-ws-admin` naming
> verified against convention (still need instance provisioning).
>
> **Host reality for Batch 2 (investigated live):** all **62 premium hosts are OFFLINE and Unassigned**
> (~21 macOS / ~22 Windows / ~17 Ubuntu / 1 Android). Offline hosts keep last-checkin records, so Batch 2 =
> host-independent UI specs + host-data *reads* scoped to **Unassigned**. Anything needing an ONLINE host
> (live-query run, refetch, run-script, executing automations, batch-script lifecycle) is deferred to the
> **final batch**, to run after the planned **daily host-autoenroll action** lands (user's stated goal:
> integrate everything doable with zero manual steps first; autoenroll + host-dependent specs come last).
> Suggested Batch 2 order (tractable → heavier): software manage-automations-access (role perms; existing
> static users + `manageAutomationsButton`) → policies sql-validation (compat badge / no-platform /
> bad-SQL-saves) → software os (Unassigned OS data) → reports save-as-new + list-filters → labels CRUD (big
> `LabelsPage` build) → org-settings (needs an appConfig save/restore helper first) → vuln/report/policy
> automations (global config → save/restore).

Read this first to resume. Companion docs in this dir: `MASTER.md` (audit + batch plan),
`C1`–`C10*.md` (per-area per-flow disposition tables), `BATCH-1.md` (Batch 1 tracker).

## What this is
Integrating ~269 QA Wolf flows (`flows-Free/` 52, `flows-Premium/` 217 at repo root, gitignored) into the
Playwright suite. The flows are **coverage transcripts, not runnable code** (they import absent
`@qawolf/flows` + `node20HelpersPremium`, hardcode `@qawolf.email` accounts, use `waitForTimeout` + brittle
selectors, create/delete teams inline). We **harvest intent and re-author** in our POM style, grounding every
selector in the Fleet frontend source (`~/repositories/fleet/frontend`). Nothing ports 1:1.

## Status
**Batch 1 (dedupe + augment) is COMPLETE.** ~20 duplicate flows confirmed-and-dropped (no code); **18
augments authored + verified green on the live premium/free instances, 0 failures.** All still **uncommitted
on `main`** (user chose "PR later").

### 18 shipped augments (all `npm run check`-clean + live-run-green)
auth: signed-out→/login redirect; forgot-password reset-page form · scripts: download-matches-source
(free+premium); >500k-char upload rejection · reports: invalid-SQL-saves; new-report default-state · vuln:
search-narrows-to-one-CVE; exploited-vulnerabilities filter · policies: details CTA visibility (free+premium)
· config-profiles: signed-.mobileconfig rejection · software: "Add software" All-fleets gating+tooltip ·
account: dark-mode theme (shared) · setup-experience: "Lock end user info" gating · users: session-reset →
API-token rotation; edit API-only user (All→Specific endpoints).

### New infra added this batch
- Static users `ws-admin` + `api-ws-admin` (`helpers/api/static-users.ts`) + `FLEET_STATIC_TOKEN_API_WS_ADMIN`
  in `.env.premium.example`. **Not yet provisioned on the instance** — provision like other static users
  (`POST /users/admin` / `POST /users/api_only`); no `npm run provision:*` script exists in-repo.
- `helpers/api/users.ts`: `createApiUser()` (POST `/users/api_only`).
- Signed fixture `test-data/apple/macos/profiles/fleet-test-signed.mobileconfig` (+ README, openssl-generated).
- POM additions: `PolicyDetailsPage.runButton`, `VulnerabilitiesListPage.selectExploitedFilter`,
  `ReportEditPage.sqlSyntaxError`, `MyAccountPage.selectTheme`, `SetupExperienceUsersPage.lockEndUserInfoCheckbox`,
  `ConfigurationProfilesPage.submitProfileUpload`, `ScriptsLibraryPage.submitScriptUpload`,
  `EditUserPage` endpoint-selector controls + `addEndpoint`.

### Deferred (with grounding notes in BATCH-1.md — revisit, don't re-derive)
- **admin-edits-password**: field is settable but an admin-set password may force a reset → assert via
  `POST /login` (API), not a UI dashboard landing.
- **vuln column-sort** (assertion is impl-detail), **vuln "View all hosts" pill** (CVE-filter pill label
  unverified), **setup-assistant bad-DEP** (needs Apple ABM round-trip / non-deterministic error).
- **Dropped as redundant**: non-`#!/bin/sh` shebang (existing marker scripts already use `#!/bin/bash`).
- **Moved to Batch 2**: non-FMA no-"Patch"; software custom-pkg Advanced-Options + self-service (→ new
  `premium/software/edit-package.spec.ts`, EditSoftwareModal POM + 4 ACE editors).

## Instance facts learned (these gate several tests — don't fight them)
- **SMTP is NOT configured** on QA → forgot-password submit shows "Cannot send password reset…"; we assert
  the reset-page form renders, not a confirmation.
- **Enabling "Require IdP authentication" doesn't persist on save** (EUA not fully exercised) → the
  Lock-end-user test asserts client-side gating only, no save.
- **No `team-admin` static user provisioned yet** (catalog entries exist; instance provisioning pending).

## Conventions confirmed with the user
- Selectors: **re-authored + grounded** in `~/repositories/fleet/frontend`; their selectors are hints only.
  Priority getByRole > getByLabel > getByPlaceholder > getByText > documented `.class` w/ comment.
- An augment adding a *new concern* to an existing spec = a **separate `describe` in the same spec** (not a
  new file, not folded into an unrelated test).
- Script/profile download comparisons use **trimmed** content.
- Tier separation is explicit (`free/` + `premium/`); `shared/` only for genuinely tier-agnostic (auth,
  packs, dark-mode).
- No team create/delete in bodies; no `waitForTimeout`; no `toHaveScreenshot`; drop QA-Wolf accounts.

## How to run / validate
- Gate: `npm run check` (tsc + eslint) from `playwright/`. (12 pre-existing `no-explicit-any` warnings in
  `gitops-yaml.ts` are unrelated.)
- Live run a spec: `npm run test:premium -- --reporter=list --output=<scratch> <path>` (or `test:free`).
  Filter a single test with `--grep "<title>"` (setup/cleanup projects still run — verified).
- Path-filtered runs DO run the `premium-setup`/`cleanup-setup` dependency projects (auth intact).
- **Cookie-less API context** (needed when a Bearer-token check must not be masked by the admin cookie):
  `await playwright.request.newContext({ baseURL: process.env.FLEET_URL, ignoreHTTPSErrors: true })`.
- I cannot run e2e without the instances; every augment above was run live and is green.

## Batches 2–4 — not started (the bulk: ~70 NEW specs)
Priority order (see MASTER.md §6 + the C-tables for per-flow detail):
1. **Batch 2 — net-new reusing existing POMs, no live host**: software (os, manage-automations-access,
   vulnerability-automations, no-teams-views, **edit-package**), policies (sql-validation, role-permissions,
   automation-type-filter, policy-automations config), reports (save-as-new, list-filters, automations,
   stored-results-setting), settings (org-info/advanced/fleet-web-address, fleet-desktop, enroll-secrets),
   controls (batch-progress nav/empty, run-script-modal, custom-variables, script-secret-dependency,
   bootstrap-fleetd-manual), labels (CRUD/sort/role), mdm (disk-encryption, mdm-settings, certificates[CA],
   android-config[MGP]), automatic-enrollment. Needs POM build-outs; an **appConfig save/restore helper** is
   a prereq for org-settings/automations/vuln-automations specs.
3. **Batch 3 — hosts area** (biggest gap, zero e2e today): big `HostsListPage`/`HostDetailsPage` build-out,
   then add-hosts-download, export-csv, edit-columns, cta-visibility, bulk-transfer, team-scope; host-software,
   host-reports-tab, host-details-smoke, host-live-query; host-status-webhook; dashboard automations-activity.
4. **Batch 4 — host-dependent / execution / destructive** (gated on the MacOS-26 VM fleet): reports live-run,
   policy/software automation-on-failing-policy, run-script, batch-progress lifecycle. **CUT**:
   delete/lock/wipe/bulk-delete hosts (no re-enrollable pool).

Decisions still open (from MASTER.md §7): provision `team-admin` on the instance; how far to push
host-dependent Batch 4.

## To open the PR (when the user asks)
Branch off `main`, commit in logical chunks (static-users+env; audit docs; per-area augment groups + their
POM changes; the signed fixture + README + createApiUser). All changes are additive; no existing spec's
behavior was removed — augments were grafted as new sub-tests/describes.
