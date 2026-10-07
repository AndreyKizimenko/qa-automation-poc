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

The suite does not provision its own instance. These entities are standing
preconditions: each spec that needs one fails loud with recreation instructions,
but they're invisible if you're bringing up a fresh instance.

| what | where | needed by | if missing |
|---|---|---|---|
| **Static users** (`api-*@fleetdm.com`, `team-admin@fleetdm.com`, the role users in `helpers/api/static-users.ts`) | both | the role-access and permission specs | recreate as that file's header says; a new human user comes back with `force_password_reset`, which `PATCH` can't clear |
| **The `Workstations`, `VMs` and `QA` fleets**, declared in gitops | premium | most premium specs | re-apply [`../gitops/premium-fleetqa/`](../gitops/premium-fleetqa/README.md) with `--context qa-premium`. The suite never creates, renames or deletes them |
| Report **`pw-host-report-results`** on the **VMs** fleet (interval 300, `SELECT 'bar' AS foo`) | premium | `premium/hosts/host-report-details.spec.ts` | re-apply `fleets/vms.yml`, then allow ~3.5 min for one scheduled run. It lives on a fleet because `cleanup-setup` wipes global reports |
| **Claude installed on the macOS and Windows VMs**, tracking latest, from the VMs fleet | premium | `premium/software/update-on-host.spec.ts` | re-apply `fleets/vms.yml`; its "Claude is installed" policies reinstall Claude at each VM's next policy run (a refetch triggers one). The pin walk stays skipped until Fleet has cached a second Claude build |
| **Install/uninstall fixtures on the VMs fleet**: inert `.pkg` / `.msi` / `.deb`, 7-Zip's `.exe`, Itsycal, DB Browser for SQLite; resting state **uninstalled** | premium | `premium/software/software-lifecycle-on-host.spec.ts` and the other install specs | re-apply `fleets/vms.yml` (the nightly does, before every premium run); one left installed is uninstalled by the next run's `cleanup-setup` |
| **Fleet-maintained app shelf on the QA fleet**: 10 apps × macOS + Windows, unpinned, never installed | premium | `premium/software/version-pinning.spec.ts` | re-apply `fleets/qa.yml`; the older-version case stays skipped until Fleet's hourly cron caches a second build |
| **Online hosts**: three real VMs per tier (macOS, Windows, Ubuntu; MDM-enrolled where the platform allows) and ~300 osquery-perf simulations | both | every host-dependent spec | the VMs are rebuilt by hand; the simulations are [`../tools/perf-hosts/`](../tools/perf-hosts/README.md)' daemons. See CLAUDE.md › *Test hosts* |
| **Admin SSO and end-user auth (EUA)**, configured on the instance | both | the SSO and setup-experience specs | configure on the instance; the suite doesn't provision them |

**Loadtest only — provision the fleet first.** The `loadtest` project
measures real page-load times against a high-scale team that has to
exist before any spec runs. See
[../gitops/loadtest/README.md](../gitops/loadtest/README.md) for the
generate-bundle → `fleetctl gitops` → move-hosts → wait-for-crons flow.
The last step of that doc — setting `FLEET_LOADTEST_FLEET_ID` in
`.env.loadtest` — is required; the loadtest fixtures throw at setup if
it's missing.

The same instance also serves `npm run test:loadtest:api`, which times the
API directly (`tests/loadtest/api/`): each request shape is sampled 2–10×
(`API_SAMPLES=N` to override, `API_PRIORITY=P0` for the known-bad subset),
medians go to `.perf-history-api/<timestamp>/summary.md`, and the console
table compares them with the previous runs. Shapes whose data is missing
(no policies in the fleet, no finished batch run) are reported as skipped
rather than timed against an empty response.

---

## Running tests

From `playwright/`:

| Command | What it runs |
|---|---|
| `npm run test:premium` | Premium suite, headless — three invocations in sequence: the main project, the exclusive specs, gitops-mode |
| `npm run test:premium:headed` | Premium suite, browser visible |
| `npm run test:premium:ui` | Premium suite, Playwright UI |
| `npm run test:free` | Free suite, headless |
| `npm run test:free:headed` | Free suite, browser visible |
| `npm run test:free:ui` | Free suite, Playwright UI |
| `npm run test:gitops-mode` | The gitops-mode specs alone: login, the specs on one worker, teardown |
| `npm run test:loadtest` | Loadtest tests, headless |
| `npm run test:loadtest:headed` | Loadtest tests, browser visible |
| `npm run test:loadtest:ui` | Loadtest tests, Playwright UI |
| `npm run test:loadtest:api` | API timing against the loadtest instance — no browser, one request in flight, every family; `-g <family>` for one |
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
│       └── api/                  # API timing (loadtest-api project only)
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

Worker counts are per tier in CI and higher locally; the current numbers and why they are what they are
live in [CLAUDE.md's facts table](CLAUDE.md#ci-and-the-shared-instances--current-facts) and
[docs/ci-pipeline.md](docs/ci-pipeline.md). Override either with `WORKERS=N` or `--workers=N`.

Three more projects run **alone, in their own invocation after the main project**: `premium-exclusive` and
`free-exclusive` (specs that turn a global switch off) and `gitops-mode` (specs that turn gitops mode on).
Each depends only on the tier's login setup, and the config refuses to name one beside another browser
project — [docs/ci-pipeline.md](docs/ci-pipeline.md) has the reasoning.

`loadtest-api` is the one project with no browser: it has its own `testDir` (`tests/loadtest/api/`, which the `loadtest` project ignores), one worker, no test timeout (the per-request cap is `API_REQUEST_TIMEOUT_MS`, 90 s), and authenticates with the bearer token from `.env.loadtest`.

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
`.github/workflows/playwright-premium.yml`) — run nightly by `QA — Nightly`
(`qa-nightly.yml`) after each tier's gitops chain, and runnable on demand via `workflow_dispatch`. Each
job runs the main project, then the exclusive specs and (premium) gitops-mode as separate steps, and merges
the reports. To run a branch the way the nightly does — its gitops chain first, then the suite, on both
tiers — use `qa-branch-run.yml`: `gh workflow run "QA — Branch run" -f branch=<branch>`, with
`-f workers=N` for a worker-count trial.

Why the flow is shaped this way — the constraints, what bounds a run, how to change it safely — is in
[docs/ci-pipeline.md](docs/ci-pipeline.md).

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
