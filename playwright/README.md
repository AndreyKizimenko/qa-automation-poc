# Fleet Playwright Test Suite

Automated browser tests for Fleet. Three projects target three Fleet
environments:

- **premium** — Fleet Premium instance (default).
- **free** — Fleet Free instance.
- **loadtest** — high-scale instance for performance measurement.

---

## Setup

**1. Install dependencies**

```bash
cd tools/qa/playwright
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

---

## Running tests

From `tools/qa/playwright/`:

| Command | What it runs |
|---|---|
| `npm run test:premium` | Full premium suite, headless |
| `npm run test:premium:headed` | Full premium suite, browser visible |
| `npm run test:premium:ui` | Full premium suite, Playwright UI |
| `npm run test:premium:smoke` | Premium, only `tests/smoke/` |
| `npm run test:free` | Full free suite, headless |
| `npm run test:free:headed` | Full free suite, browser visible |
| `npm run test:free:ui` | Full free suite, Playwright UI |
| `npm run test:free:smoke` | Free, only `tests/smoke/` |
| `npm run test:loadtest` | Loadtest tests, headless |
| `npm run test:loadtest:headed` | Loadtest tests, browser visible |
| `npm run test:loadtest:ui` | Loadtest tests, Playwright UI |
| `npm run test:all` | Full premium **and** free, sequentially |
| `npm run test:smoke` | Smoke premium **and** free, sequentially |
| `npm run lint` | Lint specs + page objects + helpers |
| `npm run lint:fix` | Lint and auto-fix what can be fixed |
| `npm run typecheck` | Run `tsc --noEmit` on the whole project |
| `npm run check` | Typecheck **and** lint — run this before opening a PR |

---

## Before opening a PR

```bash
npm run check
```

Combines `tsc --noEmit` and `eslint .`. The suite has no CI yet, so this
is the local gate. ESLint enforces Playwright best practices via
`eslint-plugin-playwright`: no `waitForTimeout`, no `ElementHandle`, no
focused tests, web-first assertions preferred. Floating-promise detection
is on via `@typescript-eslint`, so missing `await`s on `expect()` or
locator actions fail the lint check.

---

## Structure

```
tools/qa/playwright/
├── tests/                        # Specs — see tests/README.md
│   ├── auth/                     # Login, logout, forgot-password
│   ├── hosts/                    # Hosts smoke tests
│   ├── smoke/                    # End-to-end smoke by area
│   │   ├── security-and-compliance/
│   │   ├── mdm/
│   │   ├── orchestration/
│   │   └── software/
│   └── performance/              # Page load timing (tagged @loadtest)
├── pages/                        # Page Object Model — see pages/README.md
│   ├── components/               # Reused widgets (DataTable, Navbar, etc.)
│   ├── settings/                 # Settings subpages grouped together
│   └── <PageName>.ts             # One file per Fleet screen
├── fixtures.ts                   # Test fixtures — injects page objects
├── setup/
│   ├── premium.setup.ts          # Logs into premium instance
│   ├── free.setup.ts             # Logs into free instance
│   ├── loadtest.setup.ts         # Logs into loadtest instance
│   ├── software-fleet.setup.ts   # Creates the software smoke fleet + transfers hosts (premium only)
│   ├── mdm-fleet.setup.ts        # Creates the MDM smoke fleet (premium only)
│   ├── fleet.teardown.ts         # Deletes both smoke fleets (premium only)
│   ├── fleet-state.ts            # Shared name + state-path constants
│   └── lifecycle.ts              # Parameterized create/teardown helpers
├── helpers/                      # Non-UI utilities — see helpers/README.md
│   ├── api/                      # Per-area Fleet API helpers (core, hosts, fleets, software, fma, app-store, mdm, activities) + barrel
│   ├── catalogs/                 # Typed FMA / VPP / Android app-store reference data
│   ├── auth.ts                   # loginAsAdmin (setup-time only)
│   ├── console.ts                # monitorConsoleErrors, monitorNetworkFailures — auto-wired via the pageHealth fixture
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

## How the three projects differ

| | premium | free | loadtest |
|---|---|---|---|
| Target | Premium Fleet instance | Free Fleet instance | High-scale instance |
| Tests | Untagged + `@all` | `@free` + `@all` | `@loadtest` |
| Excludes | `@free`, `@loadtest` | (grep-based) | (grep-based) |
| Retries on failure | Yes (in CI) | Yes (in CI) | No — a slow run is a slow run |
| Timeouts | 30s test / 5s expect | 30s test / 5s expect | 60s test / 30s expect |
| Auth state | `.auth/premium-admin.json` | `.auth/free-admin.json` | `.auth/loadtest-admin.json` |
| Env file | `.env.premium` | `.env.free` | `.env.loadtest` |

---

## Tags

| Tag | Where it runs | Use for |
|---|---|---|
| (none) | premium | Default. Most specs. |
| `@all` | premium + free | Tier-agnostic flows (login, basic page health). |
| `@free` | free | Free-tier-specific assertions (premium feature gating, free workflows). |
| `@loadtest` | loadtest | Page-load timing measurements. |

A test can carry multiple tags (e.g. `[@all, @loadtest]` to run on free + loadtest but not premium). The grep matrix in `playwright.config.ts` is the source of truth.

---

## Adding tests

**Premium-only (default):** add a spec to the right folder under `tests/`, no tag needed.

**Cross-tier (premium + free):**
```ts
test('my test', { tag: '@all' }, async ({ page }) => { ... });
```

**Free-only:**
```ts
test('my test', { tag: '@free' }, async ({ page }) => { ... });
```

**Performance:** add a spec under `tests/loadtest/` tagged `@loadtest`, using `measureNav` from `helpers/perf.ts`.

**Smoke flows** follow the click-through navigation rule in `CLAUDE.md`: enter through the dashboard and click through navbar / tabs / subnav rather than calling `goto()` directly on the feature page.

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

Tests run via GitHub Actions (`workflow_dispatch`) with a suite dropdown.
Required secrets per suite:

| Secret | Used by |
|---|---|
| `FLEET_PREMIUM_URL` | premium |
| `FLEET_PREMIUM_ADMIN_EMAIL` | premium |
| `FLEET_PREMIUM_ADMIN_PASSWORD` | premium |
| `FLEET_FREE_URL` | free |
| `FLEET_FREE_ADMIN_EMAIL` | free |
| `FLEET_FREE_ADMIN_PASSWORD` | free |
| `FLEET_LOADTEST_URL` | loadtest |
| `FLEET_LOADTEST_ADMIN_EMAIL` | loadtest |
| `FLEET_LOADTEST_ADMIN_PASSWORD` | loadtest |
