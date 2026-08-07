# Playwright test suite

This folder contains the Playwright end-to-end suite for Fleet. The standards below apply whenever you work in `playwright/`.

## Skills

- **playwright-test-author** — auto-invoked when writing or scaffolding new tests, page objects, component objects, or fixtures. Checked in at `.claude/skills/`.
- **playwright-test-reviewer** — invoke explicitly with `/playwright-test-reviewer` to audit existing specs and POMs. Checked in at `.claude/skills/`.
- **playwright-run-reviewer** — triage a finished run (CI or local): per failing/flaky test, decide flake vs test-bug vs product-defect. Invoke with `/playwright-run-reviewer`, or by pasting a Playwright Actions run URL / pointing at `playwright-report/`. Lives in the repo-root `.claude/`, which is gitignored, so it is **local-only** — it isn't available to a fresh clone.

## Comment style (always-on)

When you write or rewrite a comment in any file under this folder, describe what the code is *doing*. Never describe what changed, what was added, fixed, or how it differs from a previous version. The reader has not seen the prior state and the comment will outlive the change.

Bad: `// Removed the brittle nth-child locator and switched to getByRole`
Good: `// Targets the row's edit button by accessible name so reordering doesn't break the test`

## Layout

- `tests/e2e/` — browser specs in three sibling folders:
  - `shared/<area>/` — tier-agnostic flows (`account/`, `auth/`, `hosts/`, `packs/`, `settings/`); both premium and free pick these up via folder structure.
  - `premium/<area>/` — premium-only flows; each spec has Unassigned + Workstations variants selected via the team dropdown.
  - `free/<area>/` — free-tier counterparts (no dropdown) + paywall-presence specs.
- `tests/api/gitops-verify/` — pure-API drift checks against a gitops target (no browser). Sits alongside `tests/api/*.spec.ts` (agnostic API contracts), `tests/api/premium/` and `tests/api/free/` (tier-only contracts), and `tests/api/role-access/{free,premium}/` (per-role endpoint allow/deny probes).
- `tests/loadtest/` — page-load timing tests. Run locally only — they
  need a high-scale instance and a team provisioned via
  [`gitops/loadtest/`](../gitops/loadtest/README.md); credentials live
  in `.env.loadtest` (gitignored), so no CI workflow targets them.
- `pages/` — page objects, with `pages/components/` for reusable UI widgets.
- `helpers/` — non-UI utilities (API client, auth, console monitoring, perf timing, `team-scope.ts` for mapping a scope to its `fleet_id`, `activity-copy.ts` for expected activity-feed strings).
- `fixtures.ts` — page-object fixtures, worker fixtures (fleet ids, `liveMacosHost`), the auto `pageHealth` fixture, and `palette` (the command palette — the one component object exposed as a fixture, since `CoreLayout` mounts it on every page and it belongs to no page object). Single file.
- `setup/` — auth and project-scoped setup/teardown specs.
- `test-data/` — fixtures consumed by specs, organised as `<platform>/<category>/<file>` (e.g. `apple/macos/scripts/macos-create-marker.sh`).
- `docs/` — `blocked-by-product-bugs.md` (skips owed to confirmed Fleet defects), `qawolf-migration/` (the migration record + per-flow audit), `test-audit/` (per-test step/validation breakdown for the manual audit pass, plus `FINDINGS.md`), and `test-plans/` (per-feature E2E coverage plans: what E2E owns vs. what unit tests already cover, the case list, and the environment facts an author needs). `docs/run-reviews/` holds per-run triage write-ups and is gitignored.
- `.auth/` — stored auth + setup state (gitignored).

## Locators and waits (Fleet-specific gotchas)

General locator priority and wait rules — see the `playwright-test-author` skill. The Fleet-specific rules that always apply:

- We do **not** add `data-testid` to Fleet's React source. Class fallbacks require an inline comment explaining why no role/text alternative exists; legitimate fallbacks are catalogued in the `playwright-test-reviewer` skill.
- No `page.waitForLoadState('networkidle')` — unreliable for SPAs that poll.
- Each page object's `goto()` must anchor on a stable element so callers don't need their own readiness wait.

## Imports + fixtures

- Browser specs (under `tests/e2e/`) import `test` and `expect` from `'@fixtures'`, never from `@playwright/test`. Setup specs (`setup/*.ts`), pure-API specs under `tests/api/` (including `tests/api/gitops-verify/`), and `helpers/auth.ts` are the exceptions — they don't use page-object fixtures or the auto `pageHealth` fixture, so importing from `@playwright/test` is fine there. Note: when a pure-API spec *does* want a page-object or the workstationsFleetId worker fixture, import from `@fixtures` to get them.
- Cross-module imports use the path aliases configured in `tsconfig.json`: `@fixtures`, `@helpers/*`, `@pages`, `@pages/*`. Sibling imports inside a module stay relative (`./Foo`) to keep intra-module coupling visible.
- Specs target one of three scopes: Unassigned (no team), Workstations (the gitops-provisioned premium team), or All fleets (the global aggregate, used for reports/policies). Selection happens via `<page>.teamDropdown.select(scope)`, which is idempotent and a no-op on free (free has no dropdown).
- Premium specs that need to call `<page>.goto({ fleetId })` for the Workstations variant pull the fleet id from the `workstationsFleetId` worker fixture (resolved once per worker via the Fleet API).
- Do not create or delete teams from test bodies. Workstations is provisioned by gitops and never deleted; its content is wiped by the `cleanup-setup` project (pre-test) and the `cleanup-teardown` project (post-test) — both reference the same `setup/cleanup.steps.ts`.
- The `pageHealth` fixture is **auto-applied** to every test — it monitors console errors and 5xx server errors and asserts at teardown. Tests that intentionally trigger console errors (negative-path auth, post-logout 401) opt out with `pageHealth.disable()`. 4xx is not flagged: it's normal app behaviour (auth probes, "no resource yet" 404s, premium-gated 402s) and assertions catch the meaningful ones. New specs need no setup to participate.
- For per-test state (a script, a custom package), upload as a precondition and clean up at the end of the same test.

## API access

- Build URLs through `apiUrl(path)` from `@helpers/api`. Never inline `/api/v1/...` or `/api/latest/...` in test code.
- API helpers are split per area under `helpers/api/` (`core`, `activities`, `app-store`, `cleanup`, `config`, `enroll-secrets`, `fleets`, `fma`, `hosts`, `labels`, `mdm`, `policies`, `reports`, `role-access`, `software`, `static-users`, `users`, `variables`). The barrel `@helpers/api` re-exports everything; specs can also reach for a specific module (`@helpers/api/software`) when they want narrower deps.
- Use `authHeaders()` for every API call. The `FLEET_API_TOKEN` env user has admin perms across `/software`, `/packs`, `/queries`, `/policies`, etc.
- Use the Playwright `request` fixture; do not use raw `fetch()` from inside specs.

## Projects (folder-based)

Four browser/API projects target three Fleet environments. Each has its own env file
(`.env.<suite>`) and its own auth state (`.auth/<suite>-admin.json`).
Project scope is determined purely by folder — no tags. The `testIgnore`
matrix in `playwright.config.ts` is the source of truth:

| Project | Picks up | Skips | Auth state |
|---|---|---|---|
| `premium` | `tests/e2e/{shared,premium}/**`, `tests/api/**` outside `free/` and `gitops-verify/` | `**/free/**`, `**/loadtest/**`, `**/gitops-verify/**` | `.auth/premium-admin.json` |
| `free` | `tests/e2e/{shared,free}/**`, `tests/api/**` outside `premium/` and `gitops-verify/` | `**/premium/**`, `**/loadtest/**`, `**/gitops-verify/**` | `.auth/free-admin.json` |
| `loadtest` | `tests/loadtest/**` only (`testDir`) | n/a | `.auth/loadtest-admin.json` |
| `gitops-verify` | `tests/api/gitops-verify/**` only (`testDir`) | n/a | bearer token |

Folder conventions:

- Premium-only flow → `tests/e2e/premium/<area>/` (or `tests/api/role-access/premium/`).
- Free-only flow (paywall checks, free-license assertions) → `tests/e2e/free/<area>/` (or `tests/api/free/`, `tests/api/role-access/free/`).
- Tier-agnostic flow (auth, packs, generic API contracts) → `tests/e2e/shared/<area>/` or root of `tests/api/`.
- Loadtest spec → `tests/loadtest/**`.

## Project pipeline (premium)

1. `premium-setup` — admin login, writes `.auth/premium-admin.json`.
2. `cleanup-setup` — pre-test dependency. Wipes unassigned state (queries, policies, packs, installable software, profiles, scripts on `fleet_id=0`) plus MDM setup-experience entities and the Workstations team's content. Self-heals the instance regardless of how state got there (Playwright leftovers, manual UI uploads, gitops-blind items).
3. `cleanup-teardown` — same wipe steps run again at end of project regardless of pass/fail, so a crashed worker still leaves a clean instance. Both projects point at the same `setup/cleanup.steps.ts`.

Admin SSO and end-user auth (EUA) are assumed to be pre-configured on the instance — the suite does not provision them.

The `free` project depends only on `free-setup`. The `loadtest` project depends only on `loadtest-setup`. Each project's setup chain is independent — no cross-project sharing.

## Env vars

Every var in `.env.<project>.example` that the suite reads is required — specs fail rather than skip when one is missing. The example files also carry vars consumed only by a local `fleetctl gitops` apply (`FLEET_ENROLL_SECRET`, `FLEET_SSO_METADATA_URL`, and on premium the ABM / VPP / EUA vars); those are grouped under their own comment header and the suite never reads them.

The static-user credentials (`FLEET_STATIC_USER_PASSWORD`, `FLEET_STATIC_TOKEN_*`) are shared and live in 1Password — never mint a replacement locally. The bearer tokens are shown once at user-creation time and cannot be rotated, so a locally-created user diverges from what CI uses.

Do not introduce new env-var skip gates without a load-bearing reason.

## E2E vs. performance specs

**E2E specs** (`tests/e2e/`) verify user-visible behaviour. Enter through the dashboard and click through the navbar / tabs / subnav to reach the feature being tested — direct URL `goto()` for the feature page is reserved for non-flow contexts (e.g. paywall checks in `tests/e2e/free/paywalls.spec.ts`).

Default: a spec is a single end-to-end flow; cleanup runs at the end of the same test (no shared mutable state between tests).

**Exception — CRUD lifecycle specs** (policies, reports, packs, scripts, profiles, software). These split each lifecycle step (create / edit / delete + a final dashboard activity-feed assertion) into its own sub-test inside a `test.describe.configure({ mode: 'serial' })` block, sharing identifiers via closure (`let policyId`, `let titleName`, etc.). The win is granular failure attribution while flake-fixing. Conventions:
- Only the first sub-test does the dashboard → navbar → list dropdown dance. Subsequent sub-tests go straight to the master list with `<page>.goto({ fleetId })`, resolving `fleetId` via `fleetIdFor(scope, workstationsFleetId)` from `@helpers/team-scope` (`'Workstations'` → the worker fixture, `'Unassigned'` → `0`, `'All fleets'` → `undefined`).
- **Always call `<page>.teamDropdown.select(scope)` immediately after every scope-aware `goto({ fleetId })` in a scope loop.** Fleet's pages don't all behave the same when navigated with/without `fleet_id` — some preserve the last-used team via localStorage and render the wrong scope even though the URL is correct. The `select()` call is idempotent (no-op if already correct), so applying it everywhere is the safe default.
- The final sub-test asserts the dashboard activity feed via `dashboard.expectActivities(matcher, count)`. Matchers use explicit verbs and the rendered scope suffix — they differ per resource and per tier, so scout the live feed when authoring a new one.
- Cleanup still runs inside the same describe block (the `delete` sub-test), so an aborted create still leaves the cleanup-teardown project to wipe state.

**Performance specs** (`tests/loadtest/`) follow different rules. They live in the `tests/loadtest/` tree (which the loadtest project's `testDir` targets exclusively, and which premium/free skip via `testIgnore`), and **navigate by direct URL** because measuring page-load time is the point. They use `measureNav` / `measureSearch` from `helpers/perf.ts`. The e2e conventions above (click-through nav, etc.) do not apply.

## Skips

Every `test.skip(...)` or `test.describe.skip(...)` needs an inline comment naming the reason and what unblocks it. If a skip is gated on an env var, document the var in `.env.example`. Where the skip gets recorded depends on why it exists:

- **Blocked by a confirmed Fleet defect** → a row in `docs/blocked-by-product-bugs.md` with the filed issue and the unblock condition, and a matching `TODO(fleetdm/fleet#NNNNN)` comment on the skip so the two can't drift. File the Fleet issue first — "make it green" is not the fix.
- **Env-gated, or deliberately deferred** → a row in `TODO.md`.
- **Data-availability guard** (`test.skip(!host, 'no macOS host')`, `gitopsConfig.scope !== 'no-team'`) → inline reason only. These are preconditions, not debt, and don't get tracked.

## Pre-PR check

```bash
npm run check          # tsc --noEmit + eslint
```

This is the pre-PR gate — it catches the common mistakes locally. The premium and free suites also run nightly in CI (`.github/workflows/playwright-{premium,free}.yml`), but don't rely on that to catch what `npm run check` would.
