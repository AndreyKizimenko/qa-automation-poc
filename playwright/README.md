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
| `npm run test:free` | Free suite (`@free`-tagged), headless |
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
│   │   ├── shared/               # Tier-agnostic (@free) — auth, packs, anything without team scope
│   │   ├── premium/              # Premium-only (Unassigned + Workstations variants)
│   │   │   ├── controls/         # os-settings, scripts, setup-experience
│   │   │   ├── policies/
│   │   │   ├── reports/
│   │   │   └── software/         # library + vulnerabilities
│   │   └── free/                 # Free-only — paywalls + free-tier variants of the premium specs
│   ├── api/                      # Pure-API specs (no browser)
│   │   ├── config.spec.ts        # Agnostic config-shape checks (@free)
│   │   ├── free/                 # Free-only API contracts (license, endpoints)
│   │   └── gitops-verify/        # GitOps drift checks
│   └── loadtest/                 # Page-load timing (tagged @loadtest)
├── pages/                        # Page Object Model — see pages/README.md
│   ├── components/               # Reused widgets (DataTable, Navbar, TeamDropdown, etc.)
│   ├── settings/                 # Settings subpages grouped together
│   └── <PageName>.ts             # One file per Fleet screen
├── fixtures.ts                   # Test fixtures — page objects + workstationsFleetId worker fixture
├── setup/
│   ├── premium.setup.ts          # Logs into premium instance
│   ├── free.setup.ts             # Logs into free instance
│   ├── loadtest.setup.ts         # Logs into loadtest instance
│   └── cleanup.steps.ts          # Wipes unassigned + Workstations state; runs pre-test (cleanup-setup) and post-test (cleanup-teardown)
├── helpers/                      # Non-UI utilities — see helpers/README.md
│   ├── api/                      # Per-area Fleet API helpers + cleanup helpers
│   ├── catalogs/                 # Typed FMA / VPP / Android app-store reference data
│   ├── auth.ts                   # loginAsAdmin (setup-time only)
│   ├── console.ts                # monitorConsoleErrors, monitorNetworkFailures — auto-wired via the pageHealth fixture
│   ├── gitops-yaml.ts            # Loads + flattens gitops YAML refs for gitops-verify specs
│   ├── perf.ts                   # measureNav, measureSearch
│   ├── perf-teardown.ts          # Summary table + historical comparison
│   └── vuln.ts                   # Vulnerability column assertions
├── test-data/                    # Static fixtures (.pkg/.msi/.deb/.sh) by platform
├── eslint.config.js              # Lint config
├── playwright.config.ts
├── tsconfig.json
├── .env.premium                  # premium credentials (gitignored)
├── .env.free                     # free credentials (gitignored)
├── .env.loadtest                 # loadtest credentials (gitignored)
├── .env.*.example                # Templates
└── .perf-history/                # Performance run history (gitignored)
```

---

## How the projects differ

| | premium | free | loadtest | gitops-verify |
|---|---|---|---|---|
| Target | Premium Fleet instance | Free Fleet instance | High-scale instance | Premium **or** free, selected via `SUITE` |
| Tests | Untagged + `@free` (excludes `tests/e2e/free/**`) | `@free` (excludes `tests/e2e/premium/**`) | `@loadtest` | `tests/api/gitops-verify/` only |
| Excludes | `@loadtest` + `tests/api/gitops-verify/**` + `tests/e2e/free/**` | `tests/api/gitops-verify/**` + `tests/e2e/premium/**` | `tests/api/gitops-verify/**` | n/a — own testDir |
| Retries on failure | Yes (in CI) | Yes (in CI) | No — a slow run is a slow run | No — drift should fail loudly |
| Timeouts | 30s test / 5s expect | 30s test / 5s expect | 60s test / 30s expect | Default |
| Auth state | `.auth/premium-admin.json` | `.auth/free-admin.json` | `.auth/loadtest-admin.json` | None (bearer token via `FLEET_API_TOKEN`) |
| Env file | `.env.premium` | `.env.free` | `.env.loadtest` | `.env.<SUITE>` |

---

## Tags

| Tag | Where it runs | Use for |
|---|---|---|
| (none) | premium | Default. Premium-only flows (Setup Experience, premium-gated features). |
| `@free` | premium + free | Tier-agnostic flows (login, page health, no-team CRUD) and free-only specs. |
| `@loadtest` | loadtest | Page-load timing measurements. |

The grep matrix in `playwright.config.ts` is the source of truth.

---

## Adding tests

**Tier-agnostic** (no team/scope concept — auth, packs, settings, labels): add a spec under `tests/e2e/shared/<area>/` and tag every test with `@free`. Same spec runs on both projects.

**Premium-only:** add a spec under `tests/e2e/premium/<area>/`. Loop over `['Unassigned', 'Workstations']` (or `['All fleets', 'Workstations']` for reports/policies), calling `<page>.teamDropdown.select(scope)` after navigation. Use the `workstationsFleetId` worker fixture if the page needs a direct `goto({ fleetId })` for the Workstations variant.

**Free-tier counterpart:** mirror the premium spec under `tests/e2e/free/<area>/`. Drop the dropdown selection (free has no dropdown). Tag every test with `@free` so the free project's grep picks it up.

```ts
test.describe('My feature', { tag: '@free' }, () => {
  test('does the thing', async ({ page }) => { ... });
});
```

**Free-only:** add the spec under `tests/e2e/free/` and tag it `@free`. Use this for paywall presence assertions and free-tier API contracts that have no premium analogue.

**Performance:** add a spec under `tests/loadtest/` tagged `@loadtest`, using `measureNav` from `helpers/perf.ts`.

**GitOps verify:** add a spec under `tests/api/gitops-verify/`. Import `gitopsConfig` (and `resolveTeamId` if team-scoped) from `./_config` to read the loaded gitops target, then assert via the `request` fixture that the live instance matches.

**E2E flows** follow the click-through navigation rule in `CLAUDE.md`: enter through the dashboard and click through navbar / tabs / subnav rather than calling `goto()` directly on the feature page. Direct `goto()` is reserved for non-flow contexts (paywall checks, page-load assertions).

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
`.github/workflows/playwright-premium.yml`) — scheduled at 05:30 UTC and
also runnable on demand with a scope dropdown (currently `smoke`).

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
