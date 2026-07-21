# C10 — authentication + login + role-access(UI) + api — audit

Scope: 25 QA Wolf flows — 5 authentication, 2 general-log-in-and-out, 6 role-access(UI), 3 api-only-user, 9 api-max-request-file-sizes.

Key context read: `tests/e2e/shared/auth/{login,login-validation,logout,forgot-password}.spec.ts`; `tests/api/role-access/{premium,free}/*.spec.ts`; `helpers/api/{role-access,static-users}.ts`; `tests/api/free/endpoints.spec.ts`; `tests/e2e/{premium,free}/account/my-account.spec.ts`; `tests/e2e/premium/settings/users/{api-user-create,edit}.spec.ts`; `pages/auth/LoginPage.ts`, `pages/settings/users/EditUserPage.ts`; `helpers/api/mdm.ts`.

NOTE: 4 of the 5 `authentication-*` flows are **empty placeholders** (goal/arrange/act/assert comments only, no code) — judged on their header-comment intent. Only `sign-in-with-email` has a real body.

## Disposition table

| # | QA Wolf flow (basename) | Tier | Behavior (1 line) | Disposition | Target (existing or proposed path) | Notes |
|---|---|---|---|---|---|---|
| 1 | authentication-sign-in-with-email | Prem | Valid email+pw → dashboard, Hosts nav visible | DUP | `tests/e2e/shared/auth/login.spec.ts` ("admin can log in") | Extra "Hosts link visible" is trivial (dashboard load implies it). |
| 2 | authentication-reject-sign-in-with-invalid-credentials | Prem | Wrong creds → "Authentication failed", stays /login | DUP | `login.spec.ts` ("shows error for invalid email" + "wrong password") | Placeholder body; intent fully covered. |
| 3 | authentication-reject-sign-in-with-missing-credentials | Prem | Empty fields → validation error, stays /login | DUP | `login-validation.spec.ts` (empty both / email / password) | Placeholder; covered. |
| 4 | authentication-redirect-to-login-when-signed-out | Prem | Signed-out visit `/` → redirect /login, form visible | AUGMENT | `login.spec.ts` (add signed-out→/login test) | Placeholder. Only the INVERSE ("redirects to dashboard when already authenticated") exists; signed-out→/login is a real gap. One test, blank storageState → `goto('/')` → expect `/login`. |
| 5 | authentication-request-password-reset | Prem | Forgot-password → enter email → submit → confirmation | AUGMENT | `forgot-password.spec.ts` (add submit + confirmation) | Placeholder. Existing spec only asserts the link routes to `/login/forgot` + heading; never submits an email or asserts the confirmation state. |
| 6 | general-log-in-and-out-global-admin (Free) | Free | Unhappy login ("Authentication failed") + sign out → login form | DUP | `login.spec.ts` + `logout.spec.ts` | shared/auth covers both tiers. |
| 7 | general-log-in-and-out-global-admin (Prem) | Prem | Identical to #6 | DUP | `login.spec.ts` + `logout.spec.ts` | Byte-identical to free sibling except avatar selector; MERGE-dup of #6. |
| 8 | role-access-premium-verify-global-admin-role-and-access | Prem | My Account shows Fleets=Global, Role=Admin | DUP | `tests/e2e/premium/account/my-account.spec.ts` (`global-admin`) | Flow name says "and access" but body ONLY checks My-Account side-panel text. |
| 9 | role-access-premium-verify-global-maintainer-role-and-access | Prem | My Account Fleets=Global, Role=Maintainer | DUP | `my-account.spec.ts` (`global-maintainer`) | |
| 10 | role-access-premium-verify-team-admin-role-and-access | Prem | My Account Fleets="N fleets", Role=Various | AUGMENT | `my-account.spec.ts` (add `team-admin` to `MY_ACCOUNT_USERS`) | Only genuinely-missing role: **no team-admin static user exists** (human or API). Gated on provisioning one. |
| 11 | role-access-premium-verify-team-maintainer-role-and-access | Prem | My Account Fleets="2 fleets", Role=Maintainer | DUP | `my-account.spec.ts` (`ws-maintainer`) | Role+fleet-scope display covered; multi-fleet "N fleets" count is a marginal display nuance (no multi-fleet human static user). |
| 12 | role-access-premium-verify-team-observer-role-and-access | Prem | My Account Fleets="3 teams", Role=Observer | DUP | `my-account.spec.ts` (`ws-observer`) | Same as #11. |
| 13 | role-access-premium-verify-team-dropdown-is-enabled-on-host-page-all-roles | Prem | Team dropdown visible on Hosts page for admin/maintainer/observer | CUT | — | Trivial presence check (`.team-dropdown__control` visible). Dropdown is exercised functionally throughout `tests/e2e/premium/**` as admin via `teamDropdown.select`. Optional 1-test AUGMENT to a premium hosts spec if role-gated visibility is wanted. |
| 14 | api-api-only-user-edit-api-only-user | Prem | Edit API user: switch All→Specific endpoints (List fleets); key then allows /fleets, forbids /users | AUGMENT | `tests/e2e/premium/settings/users/edit.spec.ts` (add API-user edit sub-test) | Real gap: `edit.spec.ts` only edits a HUMAN's name+role. Functional allow/deny already covered by `specific-endpoints.spec.ts`, so graft a UI-level edit assertion, not the fetch round-trip. Needs POM work (see below). |
| 15 | api-create-...-all-api-endpoints | Prem | Create API admin (All endpoints); UI-minted key hits GET /fleets | DUP | `premium/settings/users/api-user-create.spec.ts` ("creates global API user … all endpoints") | Live round-trip is only extra; functionally covered by `role-access/premium/global-roles.spec.ts` (`api-global-admin` allow probes). |
| 16 | api-create-...-specific-api-endpoints | Prem | Create API admin (Specific: List fleets); key allows /fleets, forbids /users | DUP | `api-user-create.spec.ts` ("specific endpoints + 1 fleet" + toggle/search tests) | Functional allow/deny covered by `role-access/premium/specific-endpoints.spec.ts` (`api-specific-endpoints-global`). |
| 17 | api-max-request-file-sizes-batch-update-profiles-totaling-less-25-mb | Prem | POST /configuration_profiles/batch, 3 profiles → success | MERGE | (new) `tests/api/premium/max-request-file-sizes.spec.ts` | Group: **max-request-file-sizes**. NEW pure-API coverage; no existing size-limit spec anywhere. |
| 18 | api-max-request-file-sizes-endpoints-that-take-multiple-scripts-or-queries-less5mb | Prem | POST /scripts/batch, 5 scripts (<5MB) → success | MERGE | same spec | |
| 19 | api-max-request-file-sizes-upload-batch-scripts-totaling-less-25mb | Prem | POST /scripts/batch, 35 scripts (<25MB) → success | MERGE | same spec | UI pagination assertions are QA-Wolf noise; keep the API 200 + count check. |
| 20 | api-max-request-file-sizes-upload-eula-pdf-greater-than-2621-mb | Prem | POST /setup_experience/eula, >26.21MB → 413/error | MERGE | same spec | Error: `Request exceeds the max size limit of 26.21MB. Configure the limit: …#server-default-max-request-body-size`. **Big fixture (~26.5MB) — generate at runtime.** |
| 21 | api-max-request-file-sizes-upload-eula-pdf-less-than-25mb | Prem | POST /setup_experience/eula, <25MB → success | MERGE | same spec | Fixture is a multi-MB PDF — generate at runtime. |
| 22 | api-max-request-file-sizes-upload-single-profile-script-greater-than-15mb | Prem | POST /configuration_profiles, ~1.7MB → error | MERGE | same spec | Filename misnomer (actually ~1.7MB). Error: `Request exceeds the max size limit of 1.573MB. …`. |
| 23 | api-max-request-file-sizes-upload-single-profile-script-less-than-1mb | Prem | POST /configuration_profiles, 849KB profile → success | MERGE | same spec | |
| 24 | api-max-request-file-sizes-upload-single-script-1-5mb | Prem | POST /scripts, 1.5MB → Validation Failed | MERGE | same spec | Distinct limit: `errors[0].reason = "Script is too large. It's limited to 500,000 characters (approximately 10,000 lines)."`, `message = "Validation Failed"`. |
| 25 | api-max-request-file-sizes-upload-single-script-less-than-1-mb | Prem | POST /scripts, 199KB → success | MERGE | same spec | |

## Summary

- **Counts: DUP 9, AUGMENT 4, NEW 0, CUT 1, MERGE 9** (the 9 MERGE flows collapse into **one NEW** parameterized API spec — see below).

- **NEW specs recommended:**
  - `tests/api/premium/max-request-file-sizes.spec.ts` — ONE table-driven pure-API spec replacing all 9 `api-max-request-file-sizes-*` flows. Table rows = `{endpoint, payload-builder, sizeBytes, expect: pass | {status, message, reason}}`. Covers: single script (pass / >500k-char fail), single profile (pass / >1.573MB fail), batch scripts (<5MB, <25MB), batch profiles (<25MB), EULA (<25MB pass / >26.21MB fail). Premium subpath so the free project skips it (config-profiles/EULA are premium-gated → would 402 on free). Rationale: 9 UI-heavy flows → 1 clean contract spec; drop the entire UI dance (token minting, team dropdown, Controls nav, list-render/pagination assertions) and assert on the API response only.

- **AUGMENTs worth grafting (small, high-value):**
  - `login.spec.ts` — add signed-out → `/login` redirect (flow #4); currently only the inverse is tested.
  - `forgot-password.spec.ts` — add submit-email → confirmation step (flow #5); currently stops at the link/heading.
  - `edit.spec.ts` (premium users) — add "edit API-only user: All → Specific endpoints" sub-test (flow #14); UI-level only.
  - `my-account.spec.ts` (premium) — add `team-admin` role (flow #10); **blocked on a team-admin static user**.

- **Notable CUT:** flow #13 (team-dropdown-enabled-on-host-page-all-roles) — trivial presence check; the dropdown is already exercised functionally across premium specs.

- **POM / helper work required:**
  - **New API upload helpers** (`helpers/api/` — extend `mdm.ts` / `software.ts`): `POST /scripts`, `POST /scripts/batch`, `POST /configuration_profiles`, `POST /configuration_profiles/batch`, `POST /setup_experience/eula` with multipart/base64 bodies. Cleanup side already exists (`deleteAllConfigurationProfiles`, setup-experience deleters in `mdm.ts`); no script-upload/EULA-upload helper yet.
  - **Runtime large-payload generators** — do NOT commit multi-MB fixtures. Generate at test time: a `.sh` >500k chars, a ~1.7MB `.mobileconfig`, a <25MB and a ~26.5MB PDF, ~849KB profile, ~199KB/490KB scripts. (Sparse/padded buffers; the plist profiles need a valid `PayloadDisplayName`.)
  - **EditUserPage POM** — currently recognizes the API-user edit heading (`apiUserHeading`) but has NO endpoint-selector methods. To land flow #14, add specific-endpoints controls (mirror `CreateApiUserPage`'s `specificEndpointsLabel`/`endpointTable`/`addEndpoint`) — ideally extract a shared `ApiUserForm` component POM used by both create and edit.
  - Auth AUGMENTs (#4, #5) reuse existing `LoginPage`/`ForgotPasswordPage` POMs — no new POM needed.

- **Role-model / infra gaps:**
  - **No team-admin static user** (human or API) — blocks flow #10 My-Account AUGMENT. Brief flagged this.
  - No multi-fleet HUMAN static user (only `api-ws-maint-qa-obs` is API-only) — so the "N fleets" My-Account count rendering (#11/#12) can't be asserted for a human; marginal, deferred.
  - File-size spec must run against **Workstations** (`workstationsFleetId` fixture) or Unassigned (`team_id=0`) — QA Wolf flows relied on bespoke teams ("Fleet for API flows", "Batch Apply Scripts <~25MB"); do NOT port team creation.
  - Use `authHeaders()` (admin `FLEET_API_TOKEN`) + the `request` fixture; drop the UI "Get API token / My account" token-minting entirely.

- **Open questions for the human:**
  1. Provision a **team-admin static user** for My-Account (#10) and any future team-admin UI coverage?
  2. Confirm the file-size limits are still current (1.573MB profile, 26.21MB EULA, 500k-char script) — these strings are release-sensitive and will drift.
  3. Any appetite for the UI→key→live-call round-trip (#15/#16 "extra") as a smoke check, or is the static-user allow/deny probe coverage sufficient? (Recommend: sufficient — skip the round-trip; clipboard perms aren't granted on every context, per `api-user-create.spec.ts`'s own note.)
