# Playwright test suite

This folder contains the Playwright end-to-end suite for Fleet. The standards below apply whenever you work in `playwright/`.

## Skills

- **playwright-test-author** — auto-invoked when writing or scaffolding new tests, page objects, component objects, or fixtures. Checked in at `.claude/skills/`.
- **playwright-test-reviewer** — invoke explicitly with `/playwright-test-reviewer` to audit existing specs and POMs. Checked in at `.claude/skills/`.
- **playwright-run-reviewer** — triage a finished run (CI or local): per failing/flaky test, decide flake vs test-bug vs product-defect. Invoke with `/playwright-run-reviewer`, or by pasting a Playwright Actions run URL / pointing at `playwright-report/`. Checked in at `.claude/skills/`.
- **fleet-upgrade-preflight** — run *before* upgrading the instance: diffs the Fleet release it runs today against the target and predicts which specs break. Invoke with `/fleet-upgrade-preflight`. Checked in at `.claude/skills/`. Its natural partner is playwright-run-reviewer, which triages the run afterwards.

All four live in the repo-root `.claude/skills/`, which is checked in. They must stay at the root: a nested `.claude/skills/` (e.g. under `playwright/`) is treated as directory-scoped, which renames the commands to `playwright:<name>` and ties them to files under that directory.

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
- `tests/cli/` — `fleetctl` specs, in the same `shared/` / `premium/` / `free/` split as `tests/e2e/`, plus `cli/nightly/` which only the `gitops-nightly` project picks up.
- `tests/loadtest/` — page-load timing tests. Run locally only — they
  need a high-scale instance and a team provisioned via
  [`gitops/loadtest/`](../gitops/loadtest/README.md); credentials live
  in `.env.loadtest` (gitignored), so no CI workflow targets them.
- `pages/` — page objects, with `pages/components/` for reusable UI widgets.
- `helpers/` — non-UI utilities (API client, auth, console monitoring, perf timing, `team-scope.ts` for mapping a scope to its `fleet_id`, `activity-copy.ts` for expected activity-feed strings).
- `fixtures.ts` — page-object fixtures, worker fixtures (fleet ids, `liveMacosHost`), the auto `pageHealth` fixture, and `palette` (the command palette — the one component object exposed as a fixture, since `CoreLayout` mounts it on every page and it belongs to no page object). Single file.
- `setup/` — auth and project-scoped setup/teardown specs.
- `test-data/` — fixtures consumed by specs, organised as `<platform>/<category>/<file>` (e.g. `apple/macos/scripts/macos-create-marker.sh`).
- `docs/` — `blocked-by-product-bugs.md` (skips owed to confirmed Fleet defects), `qawolf-migration/` (the migration record + per-flow audit), `test-audit/` (per-test step/validation breakdown for the manual audit pass, plus `FINDINGS.md`), and `test-plans/` (per-feature E2E coverage plans: what E2E owns vs. what unit tests already cover, the case list, and the environment facts an author needs). `docs/run-reviews/` holds per-run triage write-ups and `docs/upgrade-preflight/` holds pre-upgrade impact reports; both are gitignored.
- `.auth/` — stored auth + setup state (gitignored).

## Test hosts

Two host populations share each instance and are good at opposite jobs. Resolve both at run time via
`findOnlineHost(request, platform, { kind })` — **never by stored name or id**, because the load-fleet daemons
regenerate both on every restart.

- **`kind: 'real'`** — a handful of genuine VMs per tier, on the **VMs** fleet on premium (`vmsFleetId` worker
  fixture; `liveMacosHost` for a macOS one). They run real osquery, install real packages and receive real
  profiles, so anything asserting software inventory, script output, profile delivery, certificates or agent
  versions must use them. `kind: 'real'` keys on `hardware_model` matching `/virtual|qemu/i`, not on MDM
  enrollment.
- **Software on the real VMs is durable.** The VMs fleet keeps one inert custom package per platform (plus
  7-Zip's `.exe` on Windows) and one Fleet-maintained app each for macOS and Windows, declared in
  `gitops/premium-fleetqa/fleets/vms.yml` and listed in `helpers/vm-fixtures.ts`. A spec that installs or
  uninstalls on a VM uses one of those and leaves it **uninstalled** — never deletes it. Only a spec that
  changes the title itself (a version swap, its own scripts, an install policy) uploads a per-run
  `fleet-pw-*` package, and deletes it in the same test.
- **`kind: 'simulated'`** — ~300 osquery-perf simulations per tier for volume work (bulk select, transfer,
  pagination). They ignore live-query SQL, return no rows ~20% of runs and never install anything, so a green
  assertion against one proves nothing about the feature. A deleted simulation never comes back on its own.

### Never deploy a passcode profile to a real host

**A passcode profile blocks access to the VM permanently.** There is no recovery path and no re-provisioning
automation — one deployed passcode payload ends every other real-host spec until somebody rebuilds the machine
by hand. This is absolute: no `com.apple.mobiledevice.passwordpolicy` payload, no `forcePIN`, `minLength`,
`maxInactivity` or `allowSimple`, on any real host, for any reason.

The same caution covers anything else gating entry to the machine — screen lock, inactivity timeout,
FileVault, login-window restrictions, or disabling SSH / remote management / the MDM channel.

**Uploading a profile is delivering it.** There is no "library-only" profile: on **free** there are no fleets,
so Unassigned is where the real VMs are, and Fleet's profile reconciler — every 30 s — sends them whatever it
finds. A lifecycle spec's upload → delete window is a race against that tick, not a guarantee. The suite once kept a passcode profile and a Windows DeviceLock profile for
"upload → download → delete only"; the free VMs received them 7 and 32 times before anyone noticed. The only
profiles in `test-data/` are the inert pair `fleet-pw-inert.{mobileconfig,xml}` (a preference domain nothing
reads; Game DVR off) — see their READMEs. Build any new one on the same pattern, remove it in the test that
delivered it, and never commit a lock profile, even for a spec that "only uploads" it.

If you are unsure whether a payload is safe to deploy, it is not. Ask first.

The same goes for fleet settings that act on the VMs: on the **VMs** fleet, never set an OS-update minimum
version or deadline, a DDM software-update enforcement declaration, or Recovery Lock password enforcement —
they make the real hosts download an OS update, reboot mid-suite, or take a recovery password. Exercise those
settings on Workstations and restore them in the same test.

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
- The `pageHealth` fixture is **auto-applied** to every test — it monitors uncaught page exceptions, console errors and 5xx server errors, and asserts at teardown. Uncaught exceptions come from `page.on('pageerror')`: Chromium doesn't surface them as console messages, so without that listener a render that throws passes silently. Tests that intentionally trigger console errors (negative-path auth, post-logout 401) opt out with `pageHealth.disable()`. 4xx is not flagged: it's normal app behaviour (auth probes, "no resource yet" 404s, premium-gated 402s) and assertions catch the meaningful ones. New specs need no setup to participate.
- For per-test state (a script, a custom package), upload as a precondition and clean up at the end of the same test.

## API access

- Build URLs through `apiUrl(path)` from `@helpers/api`. Never inline `/api/v1/...` or `/api/latest/...` in test code.
- API helpers are split per area under `helpers/api/` (`core`, `activities`, `app-store`, `cleanup`, `config`, `enroll-secrets`, `fleets`, `fma`, `hosts`, `labels`, `mdm`, `policies`, `reports`, `role-access`, `software`, `static-users`, `users`, `variables`). The barrel `@helpers/api` re-exports everything; specs can also reach for a specific module (`@helpers/api/software`) when they want narrower deps.
- Use `authHeaders()` for every API call. The `FLEET_API_TOKEN` env user has admin perms across `/software`, `/packs`, `/queries`, `/policies`, etc.
- Use the Playwright `request` fixture; do not use raw `fetch()` from inside specs.

## Projects (folder-based)

Seven browser/API projects target three Fleet environments. Each has its own env file
(`.env.<suite>`) and its own auth state (`.auth/<suite>-admin.json`).
Project scope is determined purely by folder — no tags. The `testIgnore`
matrix in `playwright.config.ts` is the source of truth:

| Project | Picks up | Skips | Auth state |
|---|---|---|---|
| `premium` | `tests/e2e/{shared,premium}/**`, `tests/api/**` outside `free/` and `gitops-verify/` | `**/free/**`, `**/loadtest/**`, `**/gitops-verify/**`, `**/gitops-mode/**`, `**/exclusive/**` | `.auth/premium-admin.json` |
| `free` | `tests/e2e/{shared,free}/**`, `tests/api/**` outside `premium/` and `gitops-verify/` | `**/premium/**`, `**/loadtest/**`, `**/gitops-verify/**`, `**/exclusive/**` | `.auth/free-admin.json` |
| `loadtest` | `tests/loadtest/**` only (`testDir`) | n/a | `.auth/loadtest-admin.json` |
| `gitops-verify` | `tests/api/gitops-verify/**` only (`testDir`) | n/a | bearer token |
| `gitops-mode` | `tests/e2e/premium/gitops-mode/**` only (`testDir`) | n/a | `.auth/premium-admin.json` |
| `premium-exclusive` | `tests/e2e/{shared,premium}/exclusive/**`, after `premium`, one worker | n/a | `.auth/premium-admin.json` |
| `free-exclusive` | `tests/e2e/{shared,free}/exclusive/**`, after `free`, one worker | n/a | `.auth/free-admin.json` |

Folder conventions:

- Premium-only flow → `tests/e2e/premium/<area>/` (or `tests/api/role-access/premium/`).
- Free-only flow (paywall checks, free-license assertions) → `tests/e2e/free/<area>/` (or `tests/api/free/`, `tests/api/role-access/free/`).
- Tier-agnostic flow (auth, packs, generic API contracts) → `tests/e2e/shared/<area>/` or root of `tests/api/`.
- Loadtest spec → `tests/loadtest/**`.
- Anything that turns gitops mode **on** → `tests/e2e/premium/gitops-mode/`. Enabling it is a global config
  write that makes every mutating control in the UI read-only, so it cannot share a window with any other
  project. Adding a `--project` name also means adding it to `PROJECT_TO_SUITE` in `playwright.config.ts`,
  which throws at config load for a name it doesn't know.
- A spec that flips a global setting which breaks specs running beside it — turning off script execution,
  say — goes under an `exclusive/` folder in its tier's tree (`tests/e2e/shared/exclusive/`, …). The
  `premium-exclusive` / `free-exclusive` projects run those on one worker once the main project has finished;
  `npm run test:premium` / `test:free` include them. Filter by file name, not path, when running one
  (`playwright test --project=free-exclusive script-execution-disabled`): the exclusive projects' `testDir` is
  `tests/e2e`, so a `tests/e2e/…` path filter never matches. A dependency always runs in full, so running an
  exclusive project with deps runs its whole main project first; `test:<tier>:exclusive` is the `--no-deps` form.

## Project pipeline (premium)

1. `premium-setup` — admin login, writes `.auth/premium-admin.json`.
2. `cleanup-setup` — pre-test dependency. Wipes unassigned state (queries, policies, packs, installable software, profiles, scripts on `fleet_id=0`) plus MDM setup-experience entities and the Workstations team's content. Self-heals the instance regardless of how state got there (Playwright leftovers, manual UI uploads, gitops-blind items).
3. `cleanup-teardown` — same wipe steps run again at end of project regardless of pass/fail, so a crashed worker still leaves a clean instance. Both projects point at the same `setup/cleanup.steps.ts`.

Admin SSO and end-user auth (EUA) are assumed to be pre-configured on the instance — the suite does not provision them.

The `free` project runs the **same cleanup chain as premium** — `dependencies: ['free-setup', 'cleanup-setup']` and `teardown: 'cleanup-teardown'`. Only the *Workstations* step inside `cleanup.steps.ts` skips on free (that fleet is premium-only); `wipe unassigned state` runs on both, and its `deleteAllQueries` is global. **Do not plan a free spec around "nothing wipes this on free"** — global reports, policies, packs, installable software, profiles and scripts are all wiped on free too.

The `gitops-mode` project runs **after** premium (`dependencies: ['premium']`), pinned to `workers: 1` with
`fullyParallel: false` and `retries: 0`, and its `gitops-mode-teardown` project turns the flag back off.
`cleanup-setup` calls `disableGitOpsMode` as well, because a teardown project doesn't run on a `SIGKILL` and a
stuck flag disables the *next* run's entire suite. Run it with `npm run test:gitops-mode` (full chain) or
`npm run test:gitops-mode:only` (`--no-deps`, for local iteration).

`cleanup-setup` also turns script execution back on, for the same reason: the exclusive projects turn it off,
and a run killed mid-spec would otherwise leave every script spec of the next run failing.

It also brings the real VMs to their resting state before the first test and after the last: it cancels the
suite's own queued installs and scripts, resets the script timeout to Fleet's default, and on premium
uninstalls any durable fixture a dead run left installed. A VM that's offline is only logged — its specs fail
on it with their own message.

The `loadtest` project depends only on `loadtest-setup`. Each project's setup chain is otherwise independent — no cross-project sharing.

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

While building, run only the specs you changed — `npx playwright test --project=<tier> <spec-file-names>` on every tier they target, with dependencies at least once, `--workers=2` for anything on the real VMs, and nothing else running against the instance (`gh run list`). The full suite (~43 min on premium) runs once, at the end, on CI: `gh workflow run "QA — Branch run" -f branch=<branch>` runs each tier's nightly gitops chain and then its suite. The `playwright-test-author` skill has the detail.
