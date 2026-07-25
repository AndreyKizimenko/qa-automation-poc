# Batch 1 — Dedupe & Augment (execution checklist)

Goal: capture QA Wolf coverage with **no new specs** — drop the duplicates, graft the missing
assertions onto existing specs. Lowest risk, highest ROI. `npm run check` after each spec touched;
the user runs the actual e2e against the instances (no CI).

Legend: [ ] todo · [x] done · [~] blocked/needs-input

## Progress — BATCH 1 COMPLETE (18 augments verified green on live premium + free, 0 failures)
Shipped + passing (`npm run check` + live run):
- 1a: login signed-out→`/login` redirect; scripts `download matches source` (free+premium); reports
  invalid-SQL syntax error + Save-stays-enabled; vuln search-narrows-to-one-CVE.
- 1b: policies details-page CTA visibility (Show query / Run policy / Edit, free+premium); vuln
  exploited-vulnerabilities filter; forgot-password reset page renders its form (email + Get instructions);
  config-profile signed-`.mobileconfig` rejection ("Configuration profiles can't be signed");
  software "Add software" disabled + tooltip under All fleets; scripts library >500,000-char upload rejection;
  reports new-report default-state (default osquery_info query + Save enabled); account dark-mode theme
  (shared spec — applies `body.dark-mode`, persists across reload; green on both tiers); setup-experience
  "Lock end user info" gating (renders only when Require IdP is enabled).
Fixtures/infra: `test-data/apple/macos/profiles/fleet-test-signed.mobileconfig` (CMS-signed, generated via
openssl — see that dir's README) for the signed-rejection test.
Confirmed patterns (per human): an augment adding a new concern = a separate `describe` in the same spec;
script `download` compares trimmed content.
Instance facts: **SMTP is NOT configured on the QA instances** — forgot-password submit→confirmation can't
be tested (endpoint returns ErrPasswordResetNotConfigured / "Cannot send password reset…"); the augment
asserts the reset-page form renders instead. Also: **enabling "Require IdP authentication" in Setup
Experience doesn't persist on save here** (EUA not fully exercised) — the Lock-end-user augment asserts the
client-side show/hide gating only, without saving.
Dropped/redundant: free team-dropdown-absence (C5 #1) — low value + false-pass risk; non-`#!/bin/sh`
shebang upload (C7 #20) — already covered (existing marker scripts use `#!/bin/bash` and upload green).
Deferred (fragility/env risk — revisit): vuln column-sort (header→`order_key` is impl-detail); vuln
"View all hosts" pill (CVE-filter pill label unverified); setup-assistant bad-DEP (needs an ABM round-trip /
`CONFIG_NAME_INVALID`, or a fixture-specific parse error — not deterministic).

## Remaining 1c queue — DONE
- ✅ session-reset → API-token rotation — shipped (cookie-less API context avoids the admin-cookie mask).
- ✅ edit an API-only user (All → Specific endpoints) — shipped; added `EditUserPage` endpoint controls +
  `createApiUser` helper. (Follow-up nicety: extract a shared `ApiUserForm` component POM used by create+edit.)

Moved to Batch 2 (software-title Actions work, pairs with edit-package):
- non-FMA software title has no "Patch" action (`premium/software/library.spec.ts`) — needs an uploaded
  custom package + Actions-dropdown grounding.
- software custom-package Advanced Options round-trip + self-service → new `premium/software/edit-package.spec.ts`
  (new EditSoftwareModal POM + 4 ACE editors — biggest lift in the cluster).

### Deferred with grounding notes (revisit; fragility/env)
- admin edits another user's password (C7 #1/#8): the edit-form password field (`.user-form__edit-password`,
  placeholder `••••••••`) is NOT SMTP-gated, so it's settable — BUT an admin-set password may force a reset
  on the target, making a UI "lands on /dashboard" assertion unreliable. Robust path: set via UI, then verify
  the new password authenticates via `POST /api/latest/fleet/login` (200), not the UI. Needs an API-login helper.
- vuln column-sort; vuln "View all hosts" pill; setup-assistant bad-DEP — see the Deferred note above.

## Batch 0 groundwork (done alongside)
- [x] `ws-admin` + `api-ws-admin` static users added to `helpers/api/static-users.ts` (Workstations admin,
      premium-only) + `FLEET_STATIC_TOKEN_API_WS_ADMIN` in `.env.premium.example`.
      **ACTION FOR HUMAN:** provision them on the premium instance the same way as the other static users
      (`POST /users/admin` for ws-admin with `FLEET_STATIC_USER_PASSWORD`; `POST /users/api_only` for
      api-ws-admin, then paste its bearer token into `.env.premium` + GitHub secrets). NOTE: there is **no**
      `npm run provision:static-users` script in-repo — the `.env.example` comment references an external
      one. Until provisioned, do NOT reference `ws-admin` in any spec (login would fail).

## DUPs — drop (confirm coverage; nothing to author). ~20 flows.
- [x] auth: `authentication-sign-in-with-email`, `-reject-invalid-credentials`, `-reject-missing-credentials`,
      `general-log-in-and-out` (free+prem) → covered by `shared/auth/{login,login-validation,logout}.spec.ts`.
- [x] role-access my-account: `role-access-premium-verify-{global-admin,global-maintainer,team-maintainer,team-observer}`
      → covered by `premium/account/my-account.spec.ts`.
- [x] api-user create (all + specific endpoints) → `premium/settings/users/api-user-create.spec.ts` +
      `tests/api/role-access/premium/{global-roles,specific-endpoints}.spec.ts`.
- [x] policies custom-CRUD (free #1, prem #16) → `{free,premium}/policies/policies.spec.ts`.
- [x] reports CRUD (F1, P5) + `schedule-add-query-to-team` (P27) → `{free,premium}/reports/reports.spec.ts`.
- [x] user CRUD (settings #2 free, #11 prem) → `{free,premium}/settings/users/*`.
- [x] software `visit-nvd-page` (already in `cveDetail.assertOk`), `delete-scripts-on-software` (= library.spec Windows delete),
      settings `upload-and-delete-script-to-no-team` (= controls/scripts/library.spec).

## AUGMENTs — graft onto existing specs. ~33 flows. Grouped by risk.
> Note: the per-line `[ ]`/`[x]` boxes below were not maintained after the batch closed. The authoritative
> record is the **BATCH 1 COMPLETE** header above — 18 augments shipped + committed (`61ea344`); the items
> that were intentionally not ported are in the "Deferred with grounding notes" section. Don't infer status
> from the boxes.

### 1a — safe, POM already sufficient
- [x] `shared/auth/login.spec.ts` — signed-out visit to protected route → `/login` (C10 #4). **DONE.**
- [~] `shared/auth/forgot-password.spec.ts` — submit email → "An email was sent to …" confirmation (C10 #5).
      Grounded: submit btn "Get instructions", confirmation copy verified in source. **PREREQ: needs SMTP
      configured on the instance** (server returns `ErrPasswordResetNotConfigured` otherwise → confirmation
      never renders). Confirm SMTP before enabling. POM: add `submitButton`/`confirmation`/`requestReset()`.
- [ ] `free/paywalls.spec.ts` — free renders no team dropdown + no team_name column (C5 #1). Cheap absence assert.
- [ ] `{free,premium}/controls/scripts/library.spec.ts` — download script → contents match source (C8 #1/#2).
      `ScriptsLibraryPage.downloadScript()` already exists; spec never calls it.
- [ ] `premium/reports/reports.spec.ts` — invalid-SQL still saves (syntax-error label, Save enabled) (C4 P1).
- [ ] `premium/software/vulnerabilities.spec.ts` — search narrows to exactly one CVE row (C6 #4).

### 1b — small POM addition
- [ ] `premium/software/vulnerabilities.spec.ts` — exploited-vuln filter dropdown (C6 #1); column sort via
      `order_key`/`order_direction` URL params (C6 #8); "View all hosts" from software row + from vuln row →
      Hosts filtered pill (C6 #6/#7). POM: `VulnerabilitiesListPage` filter + sort methods; `HostsListPage`
      "filtered by X" pill assertion.
- [ ] `premium/reports/reports.spec.ts` — default-state assertions on a freshly-created report (C4 P28).
- [ ] `{free,premium}/account/my-account.spec.ts` — theme (System/Light/Dark) persists across logout/login;
      **drop the `toHaveScreenshot` halves** (C5 #2/#11). POM: `MyAccountPage` theme radios.
- [ ] `premium/controls/os-settings/configuration-profiles.spec.ts` — signed `.mobileconfig` rejected with
      "Configuration profiles can't be signed…" + Learn-more link (C9 #1). Needs signed fixture +
      `ConfigurationProfilesPage.expectUploadError()`.
- [ ] `premium/controls/setup-experience/setup-assistant.spec.ts` — bad DEP profile → "CONFIG_NAME_INVALID"
      error + Apple-docs link (C9 #2). Needs bad-json fixture + error assertion.
- [ ] `premium/policies/policies.spec.ts` — details-page CTA visibility (Show query / Run / Edit) (C3 #2/#13/#20);
      cross-team isolation of a team policy (C3 #18, needs a stable 2nd scope).

### 1c — bigger POM addition (borderline Batch-2; keep here since they only extend existing specs)
- [ ] `{free,premium}/settings/users/edit.spec.ts` — admin edits ANOTHER user's password → target logs in
      with it (C7 #1/#8). Verify via `withStaticUser`/`loginAsAdmin`, not the self-service change-password.
- [ ] `shared/settings/users/row-actions.spec.ts` — reset-sessions actually rotates the API token
      (capture → reset → recapture differ; use `deleteUserSessions` API) (C7 #6/#19).
- [ ] `premium/settings/users/edit.spec.ts` — edit an API-only user: All → Specific endpoints (C10 #14).
      POM: `EditUserPage` endpoint-selector methods (ideally extract a shared `ApiUserForm` component).
- [ ] `premium/software/library.spec.ts` — custom-pkg Advanced Options (pre-install query, post-install
      script) set on add + verified on edit (C6 #22); org-level "Add software" disabled + "Select a fleet to
      add software." tooltip (C6 #23); non-FMA title has no "Patch" action (C3 #25). POM: Advanced-options
      editors + disabled/tooltip assertions.
- [ ] `premium/controls/scripts/library.spec.ts` — non-`#!/bin/sh` shebang uploads OK (C7 #20); >500K-char
      script rejected (C7 #27); maintainer uploads to a team + scope isolation (C7 #26); admin upload-to-
      Unassigned cross-scope isolation (C7 #25 remainder). Needs shebang-variant + >500K .sh fixtures.
- [ ] `premium/controls/setup-experience/users.spec.ts` — "Lock end user info" managed-local-account toggle
      + its IdP dependency (C8 #6 / C9 #8). POM: `SetupExperienceUsersPage.lockEndUserInfoCheckbox`.
- [ ] `premium/software/library.spec.ts` — Android web-clip application-id case + "Application (Android)"
      type/icon (C9 #3). Needs Managed Google Play (already proven by existing android case).
- [~] `premium/account/my-account.spec.ts` — add `ws-admin` (team-admin) to the role matrix (C10 #10).
      **Blocked** until ws-admin is provisioned on the instance.

## Cross-cutting rules for every augment
- Drop `waitForTimeout`, `.toast-notification__*`/`:left-of`/`tbody tr:has-text`, `@qawolf.email` accounts,
  `toHaveScreenshot`. Ground selectors in `~/repositories/fleet/frontend` + existing POMs.
- No team create/delete in bodies — use Workstations/Unassigned + API preconditions.
- Global-appConfig-mutating augments (none in Batch 1 except possibly org-settings, which are Batch 2) get a
  save/restore guard.
