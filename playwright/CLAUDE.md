# Playwright test suite

This folder contains the Playwright end-to-end suite for Fleet. The standards below apply whenever you work in `tools/qa/playwright/`.

## Skills

- **playwright-test-author** — auto-invoked when writing or scaffolding new tests, page objects, component objects, or fixtures.
- **playwright-test-reviewer** — invoke explicitly with `/playwright-test-reviewer` to audit existing specs and POMs.

## Comment style (always-on)

When you write or rewrite a comment in any file under this folder, describe what the code is *doing*. Never describe what changed, what was added, fixed, or how it differs from a previous version. The reader has not seen the prior state and the comment will outlive the change.

Bad: `// Removed the brittle nth-child locator and switched to getByRole`
Good: `// Targets the row's edit button by accessible name so reordering doesn't break the test`

## Layout

- `tests/` — spec files (`auth/`, `hosts/`, `smoke/`, `performance/`)
- `pages/` — page objects, with `pages/components/` for reusable UI widgets
- `helpers/` — non-UI utilities (API client, auth, console monitoring, perf timing)
- `fixtures.ts` — page-object fixtures (single file)
- `setup/` — auth and project-scoped setup/teardown specs
- `test-data/` — fixtures consumed by specs, organised as `<platform>/<category>/<file>` (e.g. `apple/macos/scripts/macos-create-marker.sh`)
- `.auth/` — stored auth + setup state (gitignored)

## Locators and waits (Fleet-specific gotchas)

General locator priority and wait rules — see the `playwright-test-author` skill. The Fleet-specific rules that always apply:

- We do **not** add `data-testid` to Fleet's React source. Class fallbacks require an inline comment explaining why no role/text alternative exists; legitimate fallbacks are catalogued in the `playwright-test-reviewer` skill.
- No `page.waitForLoadState('networkidle')` — unreliable for SPAs that poll.
- Each page object's `goto()` must anchor on a stable element so callers don't need their own readiness wait.

## Imports + fixtures

- Specs import `test` and `expect` from `'@fixtures'`, never from `@playwright/test`. Setup specs and `helpers/auth.ts` are the only exceptions.
- Cross-module imports use the path aliases configured in `tsconfig.json`: `@fixtures`, `@helpers/*`, `@pages`, `@pages/*`. Sibling imports inside a module stay relative (`./Foo`) to keep intra-module coupling visible.
- Two worker fixtures expose the smoke-test fleets created by the setup projects: `softwareFleet` (used by `tests/smoke/software/`, `tests/smoke/orchestration/`) and `mdmFleet` (used by `tests/smoke/mdm/`). Picking the right one keeps the two product groups' state from colliding when specs run in parallel. Do not create or delete fleets in test bodies.
- The `pageHealth` fixture is **auto-applied** to every test — it monitors console errors and 4xx/5xx network failures and asserts at teardown. Tests that intentionally trigger errors (negative-path auth, post-logout 401) opt out with `pageHealth.disable()`. New specs need no setup to participate.
- For per-test state (a script, a custom package), upload as a precondition and clean up at the end of the same test.

## API access

- Build URLs through `apiUrl(path)` from `@helpers/api`. Never inline `/api/v1/...` or `/api/latest/...` in test code.
- API helpers are split per area under `helpers/api/` (`core`, `hosts`, `fleets`, `software`, `fma`, `app-store`, `mdm`, `activities`). The barrel `@helpers/api` re-exports everything; specs can also reach for a specific module (`@helpers/api/software`) when they want narrower deps.
- Use `authHeaders()` (the `FLEET_API_TOKEN` env user) by default. Use `sessionAuthHeaders()` (the storage-state user) for endpoints that 401/403 with the env token — currently software/package, packs, and admin queries/policies (tracked upstream as fleetdm/fleet#38044).
- Use the Playwright `request` fixture; do not use raw `fetch()` from inside specs.

## Projects and tags

Three projects target three Fleet environments. Each has its own env file
(`.env.<project>`) and its own auth state (`.auth/<project>-admin.json`).
The grep matrix is the source of truth in `playwright.config.ts`:

| Project | Includes | Excludes | Auth state |
|---|---|---|---|
| `premium` | untagged + `@all` | `@free`, `@loadtest` | `.auth/premium-admin.json` |
| `free` | `@free`, `@all` | (grep-based) | `.auth/free-admin.json` |
| `loadtest` | `@loadtest` | (grep-based) | `.auth/loadtest-admin.json` |

Tag conventions:

- **No tag** — premium-only (the default; most specs).
- **`@all`** — runs on premium **and** free (login flow, basic page health).
- **`@free`** — free-only (free-tier feature gating, premium-feature absence checks).
- **`@loadtest`** — loadtest-only (perf measurements; can combine with `@all` for tier-agnostic loadtest sanity checks).

## Project pipeline (premium)

1. `premium-setup` — admin login, writes `.auth/premium-admin.json`.
2. `software-fleet-setup` — creates "Playwright Software Smoke", writes `.auth/software-fleet.json`. Transfers every online host onto this fleet so future host-execution tests have a known set. Idempotent.
3. `mdm-fleet-setup` — creates "Playwright MDM Smoke", writes `.auth/mdm-fleet.json`. No host transfer (MDM smokes don't need real hosts). Idempotent.

Admin SSO and end-user auth (EUA) are assumed to be pre-configured on the instance — the suite does not provision them.

`fleet-teardown` runs at the end of the premium project regardless of pass/fail and deletes both smoke fleets (restoring hosts to no-team for the software fleet).

The `free` project depends only on `free-setup`. The `loadtest` project depends only on `loadtest-setup`. Each project's setup chain is independent — no cross-project sharing.

## Env vars

Every var in `.env.<project>.example` is required — specs fail rather than skip when one is missing. The only exception is:

- `FLEET_NATS_URL` (or Fleet's logging plugin auto-detection) gates the NATS log-delivery tests.

Do not introduce new env-var skip gates without a load-bearing reason.

## Smoke vs. performance specs

**Smoke specs** (`tests/smoke/`) verify user-visible behaviour. Enter through the dashboard and click through the navbar / tabs / subnav to reach the feature being tested — direct URL `goto()` for the feature page is reserved for non-smoke contexts. Each spec is a single end-to-end flow; cleanup runs at the end of the same test (no shared mutable state between tests).

**Performance specs** (`tests/loadtest/`) follow different rules. They are tagged `@loadtest`, run only against the loadtest project, and **navigate by direct URL** because measuring page-load time is the point. They use `measureNav` / `measureSearch` from `helpers/perf.ts`. The smoke conventions above (click-through nav, smoke fleet, etc.) do not apply.

## Skips

Every `test.skip(...)` or `test.describe.skip(...)` needs an inline comment naming the reason and what unblocks it. If a skip is gated on an env var, document the var in `.env.example`.

## Pre-PR check

```bash
npm run check          # tsc --noEmit + eslint
```

This is the local gate (no CI for the suite yet).
