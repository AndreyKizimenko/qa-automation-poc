# Fleet Playwright Test Suite

Automated browser + API tests for Fleet. Four projects:

- **premium** — Fleet Premium instance (default browser suite).
- **free** — Fleet Free instance (browser suite).
- **loadtest** — high-scale instance for page-load timing.
- **gitops-verify** — pure-API checks that a gitops target matches the live instance. Driven by the nightly orchestrators.

---

## Setup

**1. Install dependencies**

```bash
cd playwright
npm install
npx playwright install --with-deps
```

**2. Create your local env files**

```bash
cp .env.premium.example .env.premium
cp .env.free.example .env.free
cp .env.loadtest.example .env.loadtest
```

Fill each one with the URL and credentials for that instance. These files
are gitignored and never committed. You only need the env files for the
projects you intend to run.

**Every var the suite reads is required** — specs fail rather than skip when one is
missing. Beyond the instance URL and admin credentials, the role-access specs
authenticate as pre-provisioned static users, so they need each user's bearer token
(`FLEET_STATIC_TOKEN_*`) and the shared static-user password.

**The static-user credentials are shared — get them from 1Password**, don't mint
your own. Those bearer tokens are shown once at user-creation time and can't be
rotated, so a locally-created user would diverge from what CI and everyone else is
using.

The example files also carry vars used only by a local `fleetctl gitops` apply —
`FLEET_ENROLL_SECRET`, `FLEET_SSO_METADATA_URL`, and premium's ABM / VPP / EUA vars.
They sit under their own comment header, and the suite never reads them.

**3. Know what the suite expects to already exist**

The suite does not provision its own instance. A handful of entities are standing
preconditions — each fails loud with recreation instructions, but they're invisible
if you're bringing up a fresh instance:

- **Static users** (`api-*@fleetdm.com`, `team-admin@fleetdm.com`) for the role-access
  and permission specs.
- **The `Workstations` team** on premium, provisioned by gitops and never deleted by
  the suite.
- **A scheduled report on the `VMs` fleet** for the host-report spec.
- **Online hosts** — a mix of real MDM-enrolled VMs and a simulated osquery-perf pool.
- **Admin SSO and end-user auth (EUA)**, configured on the instance beforehand.

See [docs/qawolf-migration/README.md](docs/qawolf-migration/README.md#standing-instance-preconditions)
for the full table and how to recreate each one.

**Loadtest only — provision the fleet first.** The `loadtest` project
measures real page-load times against a high-scale team that has to
exist before any spec runs. See
[../gitops/loadtest/README.md](../gitops/loadtest/README.md) for the
generate-bundle → `fleetctl gitops` → move-hosts → wait-for-crons flow.
The last step of that doc — setting `FLEET_LOADTEST_FLEET_ID` in
`.env.loadtest` — is required; the loadtest fixtures throw at setup if
it's missing.

---

## Running tests

From `playwright/`:

| Command | What it runs |
|---|---|
| `npm run test:premium` | Premium suite, headless |
| `npm run test:premium:headed` | Premium suite, browser visible |
| `npm run test:premium:ui` | Premium suite, Playwright UI |
| `npm run test:free` | Free suite, headless |
| `npm run test:free:headed` | Free suite, browser visible |
| `npm run test:free:ui` | Free suite, Playwright UI |
| `npm run test:loadtest` | Loadtest tests, headless |
| `npm run test:loadtest:headed` | Loadtest tests, browser visible |
| `npm run test:loadtest:ui` | Loadtest tests, Playwright UI |
| `npm run test:gitops-verify:free` | Verify free-fleetqa baseline matches the live free instance |
| `npm run test:gitops-verify:free-min` | Verify free-fleetqa-min variant matches the live free instance |
| `npm run test:gitops-verify:premium` | Verify premium-fleetqa baseline (no-team scope) |
| `npm run test:gitops-verify:premium-workstations` | Verify Workstations team in premium-fleetqa |
| `npm run test:gitops-verify:premium-min` | Verify premium-fleetqa-min (no-team scope) |
| `npm run test:gitops-verify:premium-min-workstations` | Verify Workstations team in premium-fleetqa-min |
| `npm run test:all` | Premium **and** free, sequentially |
| `npm run lint` | Lint specs + page objects + helpers |
| `npm run lint:fix` | Lint and auto-fix what can be fixed |
| `npm run typecheck` | Run `tsc --noEmit` on the whole project |
| `npm run check` | Typecheck **and** lint — run this before opening a PR |

---

## Before opening a PR

```bash
npm run check
```

Combines `tsc --noEmit` and `eslint .`. ESLint enforces Playwright best
practices via `eslint-plugin-playwright`: no `waitForTimeout`, no
`ElementHandle`, no focused tests, web-first assertions preferred.
Floating-promise detection is on via `@typescript-eslint`, so missing
`await`s on `expect()` or locator actions fail the lint check.

---

## Structure

```
playwright/
├── tests/                        # Specs — see tests/README.md
│   ├── e2e/                      # Browser specs
│   │   ├── shared/               # Tier-agnostic (both projects)
│   │   │   ├── account/          # change-password, theme
│   │   │   ├── auth/             # login, logout, SSO, forgot-password
│   │   │   ├── hosts/            # host details, live query, software, CSV export
│   │   │   ├── packs/            # packs CRUD (global, no team scope)
│   │   │   └── settings/         # host-status webhook, user list search/pagination/row-actions
│   │   ├── premium/              # Premium-only (Unassigned + Workstations variants)
│   │   │   ├── account/
│   │   │   ├── controls/         # custom-variables, os-settings, scripts, setup-experience
│   │   │   ├── dashboard/
│   │   │   ├── hosts/            # transfer, delete, CTA + MDM-action availability
│   │   │   ├── labels/
│   │   │   ├── policies/
│   │   │   ├── reports/
│   │   │   ├── settings/         # org, integrations, enroll-secrets, users
│   │   │   └── software/         # library, edit-package, os, vulnerabilities
│   │   └── free/                 # Free-only — paywalls + free-tier variants of the premium specs
│   ├── api/                      # Pure-API specs (no browser)
│   │   ├── config.spec.ts        # Agnostic config-shape checks (both projects)
│   │   ├── activity-copy.spec.ts # Activity-feed copy contract
│   │   ├── premium/              # Premium-only API contracts
│   │   ├── free/                 # Free-only API contracts (license, endpoints)
│   │   ├── role-access/          # Per-role endpoint allow/deny probes, split free/ + premium/
│   │   └── gitops-verify/        # GitOps drift checks
│   └── loadtest/                 # Page-load timing (loadtest project only)
├── pages/                        # Page Object Model — see pages/README.md
│   ├── components/               # Reused widgets (DataTable, Navbar, TeamDropdown, etc.)
│   ├── DashboardPage.ts          # Root — the one page with no feature folder
│   └── <area>/<PageName>.ts      # account, auth, controls, hosts, labels, packs,
│                                 #   policies, reports, settings, software
├── fixtures.ts                   # Page-object fixtures, worker fixtures, auto pageHealth (see below)
├── setup/
│   ├── premium.setup.ts          # Logs into premium instance
│   ├── free.setup.ts             # Logs into free instance
│   ├── loadtest.setup.ts         # Logs into loadtest instance
│   └── cleanup.steps.ts          # Wipes unassigned + Workstations state; runs pre-test (cleanup-setup) and post-test (cleanup-teardown)
├── helpers/                      # Non-UI utilities — see helpers/README.md
│   ├── api/                      # Per-area Fleet API helpers + cleanup helpers
│   ├── catalogs/                 # Typed FMA / VPP / Android app-store reference data
│   ├── activity-copy.ts          # Expected activity-feed strings, shared by specs and the copy contract
│   ├── auth.ts                   # loginAsAdmin (setup-time), withCleanContext, withStaticUser
│   ├── console.ts                # monitorConsoleErrors, monitorNetworkFailures — auto-wired via the pageHealth fixture
│   ├── gitops-yaml.ts            # Loads + flattens gitops YAML refs for gitops-verify specs
│   ├── perf.ts                   # measureNav, measureSearch
│   ├── perf-teardown.ts          # Summary table + historical comparison
│   ├── team-scope.ts             # fleetIdFor(scope, workstationsFleetId) → the fleet_id URL value
│   └── vuln.ts                   # Vulnerability column assertions
├── test-data/                    # Static fixtures (.pkg/.msi/.deb/.sh) by platform
├── docs/
│   ├── blocked-by-product-bugs.md  # Skips caused by confirmed Fleet defects, with unblock conditions
│   ├── qawolf-migration/         # The QA Wolf → Playwright migration record + per-flow audit
│   └── run-reviews/              # Per-run triage write-ups (gitignored — local only)
├── eslint.config.js              # Lint config
├── playwright.config.ts
├── tsconfig.json
├── TODO.md                       # Skips, env gates, config workarounds
├── CLAUDE.md                     # Suite conventions for AI-assisted work
├── .env.premium                  # premium credentials (gitignored)
├── .env.free                     # free credentials (gitignored)
├── .env.loadtest                 # loadtest credentials (gitignored)
├── .env.*.example                # Templates
├── .auth/                        # Stored login state per suite (gitignored)
└── .perf-history/                # Performance run history (gitignored)
```

### Fixtures

`fixtures.ts` provides three kinds of fixture, all reached by importing `test` from
`@fixtures`:

- **Page objects** — one per screen (`softwareTitles`, `hostDetails`, `policiesList`, …).
  Destructure what you need; TypeScript lists what's available.
- **Worker fixtures**, resolved once per worker via the Fleet API so specs don't
  re-look-up shared state: `workstationsFleetId`, `qaFleetId`, `vmsFleetId` (fleet ids),
  `liveMacosHost` (a real MDM-enrolled macOS host), plus `loadtestFleetId` / `firstHostId`
  for the loadtest project.
- **`pageHealth`** — auto-applied to every test. Monitors console errors and 5xx responses
  and asserts at teardown. Opt out with `pageHealth.disable()` in specs that intentionally
  trigger errors.

---

## How the projects differ

| | premium | free | loadtest | gitops-verify |
|---|---|---|---|---|
| Target | Premium Fleet instance | Free Fleet instance | High-scale instance | Premium **or** free, selected via `SUITE` |
| Picks up | `tests/e2e/{shared,premium}/**`, `tests/api/**` (minus `free/` + `gitops-verify/`) | `tests/e2e/{shared,free}/**`, `tests/api/**` (minus `premium/` + `gitops-verify/`) | `tests/loadtest/**` only | `tests/api/gitops-verify/**` only |
| Skips | `**/free/**`, `**/loadtest/**`, `**/gitops-verify/**` | `**/premium/**`, `**/loadtest/**`, `**/gitops-verify/**` | n/a — own `testDir` | n/a — own `testDir` |
| Retries on failure | 2 in CI, 0 locally | 2 in CI, 0 locally | No — a slow run is a slow run | No — drift should fail loudly |
| Timeouts | 60s test / 10s expect | 60s test / 10s expect | 60s test / 30s expect | 60s test / 10s expect (inherits top-level) |
| Auth state | `.auth/premium-admin.json` | `.auth/free-admin.json` | `.auth/loadtest-admin.json` | None (bearer token via `FLEET_API_TOKEN`) |
| Env file | `.env.premium` | `.env.free` | `.env.loadtest` | `.env.<SUITE>` |

The 60s test timeout and 10s expect timeout are both workarounds for a shared-QA-instance
render-latency issue, not intended defaults — see [TODO.md](TODO.md#config-workarounds) for the
revert condition.

Workers default to 2 in CI (the shared instance has limited concurrency headroom) and 4
locally. Override either with `WORKERS=N` or `--workers=N`.

Project scope is decided by folder — no tags. The `testIgnore` matrix in `playwright.config.ts` is the source of truth.

`SUITE` decides which `.env.<suite>` is loaded, and the config **refuses to start** rather
than guess: `--project=premium|free|loadtest` implies its suite, but the tier-ambiguous
projects (`cleanup-setup`, `cleanup-teardown`, `gitops-verify`) need `SUITE=` set
explicitly. The npm scripts already do this.

---

## Adding tests

**Tier-agnostic** (no team/scope concept — auth, packs, settings, labels): add a spec under `tests/e2e/shared/<area>/` (or root of `tests/api/`). Both projects pick it up via folder structure.

**Premium-only:** add a spec under `tests/e2e/premium/<area>/`. Loop over `['Unassigned', 'Workstations']` (or `['All fleets', 'Workstations']` for reports/policies), calling `<page>.teamDropdown.select(scope)` after navigation. Use the `workstationsFleetId` worker fixture if the page needs a direct `goto({ fleetId })` for the Workstations variant.

**Free-tier counterpart:** mirror the premium spec under `tests/e2e/free/<area>/`. Drop the dropdown selection (free has no dropdown).

**Free-only:** add the spec under `tests/e2e/free/` (or `tests/api/free/`). Use this for paywall presence assertions and free-tier API contracts that have no premium analogue.

**Performance:** add a spec under `tests/loadtest/`, using `measureNav` from `helpers/perf.ts`.

**GitOps verify:** add a spec under `tests/api/gitops-verify/`. Import `gitopsConfig` (and `resolveTeamId` if team-scoped) from `./_config` to read the loaded gitops target, then assert via the `request` fixture that the live instance matches.

**Role access:** add a spec under `tests/api/role-access/{free,premium}/`. These probe endpoints as a pre-provisioned static user rather than creating one — pull the user and its bearer headers from `@helpers/api/static-users`, and assert with `expectAllow` / `expectDeny` from `@helpers/api/role-access`.

**E2E flows** follow the click-through navigation rule in `CLAUDE.md`: enter through the dashboard and click through navbar / tabs / subnav rather than calling `goto()` directly on the feature page. Direct `goto()` is reserved for non-flow contexts (paywall checks, page-load assertions).

**Skipping something?** Every skip needs an inline reason. Where it gets recorded depends
on why: an env gate or a deliberately deferred test goes in [TODO.md](TODO.md); a flow
blocked by a confirmed Fleet defect goes in
[docs/blocked-by-product-bugs.md](docs/blocked-by-product-bugs.md) with a filed issue and
an unblock condition. Data-availability guards (`test.skip(!host, 'no macOS host')`) need
neither — they're preconditions, not debt.

---

## Performance summary

At the end of every loadtest run a timing table is printed comparing the
current run against up to 3 previous runs:

```
───────────────────────────────────────────────────────────────────────
 Performance Summary
───────────────────────────────────────────────────────────────────────
 Section    Page              Current       prev-1      prev-2      prev-3
───────────────────────────────────────────────────────────────────────
 Dashboard  Platform cards    1.539s        1.655s      1.602s      1.580s
            Software block    0.873s        0.881s      0.884s      0.880s
            Activity block    1.400s        0.367s      0.370s      0.365s
 Hosts      Hosts list        1.436s        1.420s      1.415s      1.430s
            ...
───────────────────────────────────────────────────────────────────────
 3 previous run(s) | green = current faster | yellow = current slower
```

- Previous times in **green** where the current run is faster
- Previous times in **yellow** where the current run is slower
- Previous times in **gray** when the difference is negligible (<200ms)
- Current times in **yellow** when over 5s, **red** when over 15s

Run history is stored in `.perf-history/` (max 10 runs, oldest pruned automatically).

---

## CI

Browser specs run via per-tier workflows
(`.github/workflows/playwright-free.yml`,
`.github/workflows/playwright-premium.yml`) — scheduled at 05:30 UTC, and
runnable on demand via `workflow_dispatch` (no inputs; each runs its whole
project).

`playwright-check.yml` is the per-PR gate: it runs `npm run check` (tsc + eslint)
on any PR touching `playwright/**`, and on push to `main` so the check registers
for branch protection. The tier suites themselves are nightly only — a PR never
runs live specs.

`gitops-verify` runs as part of the nightly gitops orchestrators
(`nightly-qa-gitops-{free,premium}.yml`), called between each gitops
apply step. See the repo-root [README.md](../README.md#ci) for the full
workflow map.

Loadtest is **local-only** — the high-scale instance has per-run
credentials, so there's no CI workflow for it.

Required secrets for the Playwright workflows:

| Secret | Used by |
|---|---|
| `FLEET_PREMIUM_URL`, `FLEET_PREMIUM_API_TOKEN` | playwright-premium |
| `FLEET_PREMIUM_ADMIN_EMAIL`, `FLEET_PREMIUM_ADMIN_PASSWORD` | playwright-premium |
| `FLEET_FREE_URL`, `FLEET_FREE_API_TOKEN` | playwright-free |
| `FLEET_FREE_ADMIN_EMAIL`, `FLEET_FREE_ADMIN_PASSWORD` | playwright-free |
| `FLEET_SSO_LOGIN_USERNAME`, `FLEET_SSO_LOGIN_PASSWORD` | admin-SSO login spec (both tiers) |
