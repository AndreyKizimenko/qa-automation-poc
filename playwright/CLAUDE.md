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
  - `shared/<area>/` — tier-agnostic flows (`account/`, `auth/`, `command-palette/`, `controls/`, `dashboard/`, `hosts/`, `labels/`, `packs/`, `policies/`, `reports/`, `settings/`, `software/`, plus `exclusive/`); both premium and free pick these up via folder structure.
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
- `docs/` — `ci-pipeline.md` (why the CI flow is shaped as it is and what bounds a run), `blocked-by-product-bugs.md` (skips owed to confirmed Fleet defects), `qawolf-migration/` (the migration record + per-flow audit), `test-audit/` (per-test step/validation breakdown for the manual audit pass, plus `FINDINGS.md`), and `test-plans/` (per-feature E2E coverage plans: what E2E owns vs. what unit tests already cover, the case list, and the environment facts an author needs). `docs/run-reviews/` holds per-run triage write-ups and `docs/upgrade-preflight/` holds pre-upgrade impact reports; both are gitignored.
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
- **A failed install stalls the VM it ran on.** Orbit treats a failed install *script* as a failed config
  cycle and backs its whole loop off — 1, 2, 4, then 5 min — so every install and script queued on that VM
  waits (fleetdm/fleet#54607). Make an install fail with a pre-install query that returns no rows
  (`preInstallQuery` on `uploadSoftwarePackageBuffer`), which stops before the script and doesn't trigger it;
  a spec whose point is the script failure itself goes in `exclusive/` (`deploy-install-retries.spec.ts`).
- **`kind: 'simulated'`** — ~300 osquery-perf simulations per tier for volume work (bulk select, transfer,
  pagination). They answer every live query with the same canned row, whatever the SQL (the daemons run with
  `--live_query_no_results_prob 0`, so they always answer), and pass every policy except `SELECT 0;`. The ~half
  that simulate orbit report script runs and installs they never performed: random output and exit code, and
  an install that fails ~5% of the time. So a green assertion against one proves nothing about the feature. A
  deleted simulation never comes back on its own.
- **Built-in platform labels hold whatever osquery-perf answers**, not hosts of that platform: on both
  instances the built-in **macOS** label holds the *Ubuntu* simulations. Pick hosts by their `platform` field
  (`findOnlineHost` and the simulation finders already do), never by built-in-label membership, and never target
  a Platforms chip for a live run. `premium/controls/scripts/batch-run.spec.ts`' scale test batches every online
  macOS-label member on Unassigned, so a script or install run now on a Linux simulation there can queue behind
  it, and moving Linux simulations off Unassigned shrinks its pool (it needs 50+).
- **Each tier also holds ~300 offline simulations**: the set the perf daemons abandon at their daily refresh
  (16:00 UTC), which host expiry deletes a day later. Every picker takes online hosts, so nothing reads them;
  a spec that needs dozens of hosts to move (not to answer anything) draws them with `findOfflineSimulations`
  and stages them on a throwaway `pw-*` fleet (`premium/hosts/bulk-transfer.spec.ts`).
- **A simulation can answer what Fleet decides server-side** — which hosts a profile is listed for, which are
  offered a software title, which a policy or report targets — so a label-targeting spec moves two onto the VMs
  fleet as the "outside the label" hosts beside the real VM. Borrow with `findMdmSimulations` (only for
  profiles: MDM-enrolled simulations are scarce) or `findSimulations` (everything else — a disjoint pool), each
  spec on its own slice (the registry is in `helpers/api/hosts.ts`), move them back in the `finally`; the VMs
  sweep returns any a dead run left.
- **The simulations re-enroll with the global enroll secret** on every daemon restart. Never replace the global
  list from a snapshot or post it empty: `restoreGlobalEnrollSecrets` is the one write a spec makes there, and
  `EnrollSecretModal` acts on a secret by its value only (`shared/settings/enroll-secrets.spec.ts`).

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
version or deadline, or a DDM software-update enforcement declaration — they make the real hosts download an
OS update or reboot mid-suite. Exercise those settings on Workstations and restore them in the same test.

**Recovery Lock password enforcement is the one exception, and only for `recovery-lock.spec.ts`** (approved
2026-09-29). It guards only entry to macOS Recovery — not login, SSH or MDM — Fleet escrows the password, and
turning it off makes Fleet clear it from the Mac. That spec turns it on for the VMs fleet and off in an
`afterEach`, and the resting-state step turns it off after a dead run. Nothing else sets it on the VMs fleet,
and nothing sets it on free, where the global setting would reach the free Mac.

## Locators and waits (Fleet-specific gotchas)

General locator priority and wait rules — see the `playwright-test-author` skill. The Fleet-specific rules that always apply:

- We do **not** add `data-testid` to Fleet's React source. Class fallbacks require an inline comment explaining why no role/text alternative exists; legitimate fallbacks are catalogued in the `playwright-test-reviewer` skill.
- No `page.waitForLoadState('networkidle')` — unreliable for SPAs that poll.
- Each page object's `goto()` must anchor on a stable element so callers don't need their own readiness wait.
- **The Hosts list rewrites its own URL** from the filters its table last queried with, so a filter or search
  chosen just after the page loads can be silently undone, and *Select all matching* then takes every host on the
  fleet. Choose them through `HostsListPage.searchFor`, `HostsListPage.filterTo` or `LabelFilter.selectLabel`,
  which remake a choice until the settled table's URL still carries it.

## Imports + fixtures

- Browser specs (under `tests/e2e/`) import `test` and `expect` from `'@fixtures'`, never from `@playwright/test`. Setup specs (`setup/*.ts`), pure-API specs under `tests/api/` (including `tests/api/gitops-verify/`), and `helpers/auth.ts` are the exceptions — they don't use page-object fixtures or the auto `pageHealth` fixture, so importing from `@playwright/test` is fine there. Note: when a pure-API spec *does* want a page-object or the workstationsFleetId worker fixture, import from `@fixtures` to get them.
- Cross-module imports use the path aliases configured in `tsconfig.json`: `@fixtures`, `@helpers/*`, `@pages`, `@pages/*`. Sibling imports inside a module stay relative (`./Foo`) to keep intra-module coupling visible.
- Specs target one of three scopes: Unassigned (no team), Workstations (the gitops-provisioned premium team), or All fleets (the global aggregate, used for reports/policies). Selection happens via `<page>.teamDropdown.select(scope)`, which is idempotent and a no-op on free (free has no dropdown).
- Premium specs that need to call `<page>.goto({ fleetId })` for the Workstations variant pull the fleet id from the `workstationsFleetId` worker fixture (resolved once per worker via the Fleet API).
- Do not create, rename or delete the instance's standing fleets: Workstations, VMs and QA (declared in gitops) and Mobile (kept by hand, see `gitops/premium-fleetqa/README.md`). A spec that needs a fleet of its own creates a **throwaway `pw-*` fleet** (`createFleet`), deletes it in the test, and deletes it again in an `afterEach` (which survives a timeout); the `cleanup-setup` / `cleanup-teardown` sweep removes any `pw-*` fleet a killed run left (approved by Andrey 2026-10-02; `fleets-lifecycle.spec.ts`, `historical-data-collection.spec.ts`). Scope a per-run fleet by URL (`<page>.goto({ fleetId })`), not by picking its name in the dropdown, and delete it with `deleteFleet`, which deletes the fleet's bootstrap package first (a fleet delete leaves it behind). Never give a durable fleet a `pw-` name. Workstations is provisioned by gitops and never deleted; its content (all but its gitops reports) is wiped by the `cleanup-setup` project (pre-test) and the `cleanup-teardown` project (post-test) — both reference the same `setup/cleanup.steps.ts`.
- The `pageHealth` fixture is **auto-applied** to every test — it monitors uncaught page exceptions, console errors and 5xx server errors, and asserts at teardown. Uncaught exceptions come from `page.on('pageerror')`: Chromium doesn't surface them as console messages, so without that listener a render that throws passes silently. Tests that intentionally trigger console errors (negative-path auth, post-logout 401) opt out with `pageHealth.disable()`. An uncaught error owed to a filed, cosmetic Fleet defect is ignored by name instead, in `DEFAULT_IGNORED_PAGE_ERRORS` (`helpers/console.ts`), with its `TODO(fleetdm/fleet#N)` and a row in `docs/blocked-by-product-bugs.md`. 4xx is not flagged: it's normal app behaviour (auth probes, "no resource yet" 404s, premium-gated 402s) and assertions catch the meaningful ones. New specs need no setup to participate.
- For per-test state (a script, a custom package), upload as a precondition and clean up at the end of the same test.

## API access

- Build URLs through `apiUrl(path)` from `@helpers/api`. Never inline `/api/v1/...` or `/api/latest/...` in test code.
- API helpers are split per area under `helpers/api/` (`core`, `activities`, `app-store`, `cleanup`, `config`, `enroll-secrets`, `fleets`, `fma`, `hosts`, `labels`, `mdm`, `policies`, `reports`, `role-access`, `software`, `static-users`, `users`, `variables`). The barrel `@helpers/api` re-exports everything; specs can also reach for a specific module (`@helpers/api/software`) when they want narrower deps.
- Use `authHeaders()` for every API call. The `FLEET_API_TOKEN` env user has admin perms across `/software`, `/packs`, `/queries`, `/policies`, etc.
- Use the Playwright `request` fixture; do not use raw `fetch()` from inside specs.
- `POST /login` is throttled to 10 a minute in one bucket shared by every user and worker. Browser specs sign in through `withStaticUser`'s cached sessions; an API-only login uses `apiLogin` (`helpers/api/users.ts`), which waits out a 429. A throttled UI login lands back on `/login` looking like a wrong password.

## Projects (folder-based)

Eight browser/API projects target three Fleet environments. Each has its own env file
(`.env.<suite>`) and its own auth state (`.auth/<suite>-admin.json`).
Project scope is determined purely by folder — no tags. The `testIgnore`
matrix in `playwright.config.ts` is the source of truth:

| Project | Picks up | Skips | Auth state |
|---|---|---|---|
| `premium` | `tests/e2e/{shared,premium}/**`, `tests/api/**` outside `free/` and `gitops-verify/` | `**/free/**`, `**/loadtest/**`, `**/gitops-verify/**`, `**/gitops-mode/**`, `**/exclusive/**` | `.auth/premium-admin.json` |
| `free` | `tests/e2e/{shared,free}/**`, `tests/api/**` outside `premium/` and `gitops-verify/` | `**/premium/**`, `**/loadtest/**`, `**/gitops-verify/**`, `**/exclusive/**` | `.auth/free-admin.json` |
| `loadtest` | `tests/loadtest/**` only (`testDir`), one worker | `**/api/**` | `.auth/loadtest-admin.json` |
| `loadtest-api` | `tests/loadtest/api/**` only (`testDir`), one worker, no browser | n/a | bearer token |
| `gitops-verify` | `tests/api/gitops-verify/**` only (`testDir`) | n/a | bearer token |
| `gitops-mode` | `tests/e2e/premium/gitops-mode/**` only (`testDir`), one worker, its own invocation after `premium-exclusive` | n/a | `.auth/premium-admin.json` |
| `premium-exclusive` | `tests/e2e/{shared,premium}/exclusive/**`, one worker, its own invocation after `premium` | n/a | `.auth/premium-admin.json` |
| `free-exclusive` | `tests/e2e/{shared,free}/exclusive/**`, one worker, its own invocation after `free` | n/a | `.auth/free-admin.json` |

Folder conventions:

- Premium-only flow → `tests/e2e/premium/<area>/` (or `tests/api/role-access/premium/`).
- Free-only flow (paywall checks, free-license assertions) → `tests/e2e/free/<area>/` (or `tests/api/free/`, `tests/api/role-access/free/`).
- Tier-agnostic flow (auth, packs, generic API contracts) → `tests/e2e/shared/<area>/` or root of `tests/api/`.
- Loadtest spec → `tests/loadtest/**`.
- Anything that turns gitops mode **on** → `tests/e2e/premium/gitops-mode/`. Enabling it is a global config
  write that makes every mutating control in the UI read-only, so it cannot share a window with any other
  project: the `gitops-mode` project runs alone, as CI's third step and `npm run test:premium`'s third
  invocation, and the config refuses to run it beside another browser project. Adding a `--project` name also
  means adding it to `PROJECT_TO_SUITE` in `playwright.config.ts`, which throws at config load for a name it
  doesn't know.
- A spec that flips a global setting which breaks specs running beside it — turning off script execution,
  say — goes under an `exclusive/` folder in its tier's tree (`tests/e2e/shared/exclusive/`, …). So does one that
  needs a real VM's queue to itself: Fleet runs a policy automation's scripts and installs at priority 0, below
  every user-requested one, so beside the install specs its attempts wait out their budget
  (`premium/exclusive/policies/policy-automation-runs.spec.ts`). The
  `premium-exclusive` / `free-exclusive` projects run those on one worker, **in their own `playwright test`
  invocation after the main project has finished** — whether or not it passed. CI runs them as a second step
  (`if: !cancelled()`) and merges both into one report; `npm run test:premium` / `test:free` run the two in
  sequence. They depend only on the tier's login setup and share `cleanup-teardown`, so **never name a main
  project and its exclusive one in the same invocation**: they'd run side by side, and the config refuses to.
  Filter by file name, not path, when running one (`playwright test --project=free-exclusive
  script-execution-disabled`): the exclusive projects' `testDir` is `tests/e2e`, so a `tests/e2e/…` path filter
  never matches.

## Project pipeline (premium)

1. `premium-setup` — admin login, writes `.auth/premium-admin.json`.
2. `cleanup-setup` — pre-test dependency. Wipes unassigned state (queries, policies, packs, installable software, profiles, scripts on `fleet_id=0`, and the test users a dead run left: `qa-test-*` addresses and `QA API <label> <stamp>` API-only users) plus MDM setup-experience entities, and on Workstations its policies, installable software, profiles, scripts, setup experience and OS-update settings — but **not its reports**, which gitops declares, beyond the copies specs save there by exact prefix (`pw-role-`, `Copy of playwright-saveasnew-`): a spec that puts a report on Workstations deletes it itself, and adds its prefix to that sweep. On premium it also removes throwaway `pw-*` fleets, and on both tiers any test-added (`pw-enroll-`) global enroll secret and any `PW_VAR_*` custom variable (after the scripts, since Fleet refuses to delete a variable a script references). `pw-*` labels are swept on premium only, inside the VMs-fleet step, so a free spec deletes its own. Self-heals the instance regardless of how state got there (Playwright leftovers, manual UI uploads, gitops-blind items).
3. `cleanup-teardown` — same wipe steps run again at end of project regardless of pass/fail, so a crashed worker still leaves a clean instance. Both projects point at the same `setup/cleanup.steps.ts`.

Admin SSO and end-user auth (EUA) are assumed to be pre-configured on the instance — the suite does not provision them.

The `free` project runs the **same cleanup chain as premium** — `dependencies: ['free-setup', 'cleanup-setup']` and `teardown: 'cleanup-teardown'`. Only the *Workstations* step inside `cleanup.steps.ts` skips on free (that fleet is premium-only); `wipe unassigned state` runs on both, and its `deleteAllQueries` is global. **Do not plan a free spec around "nothing wipes this on free"** — global reports, policies, packs, installable software, profiles and scripts are all wiped on free too.

The `gitops-mode` project runs in **its own invocation after the exclusive specs** — CI's third step
(`if: !cancelled()`, merged into the same report) and `npm run test:premium`'s third invocation — pinned to
`workers: 1` with `fullyParallel: false` and `retries: 0`. Like the exclusive projects it depends only on
`premium-setup`: a dependency on `premium` would skip it whenever one unrelated main-project test is red, and
put the whole suite in front of a local run. Its `gitops-mode-teardown` project turns the flag back off.
`cleanup-setup` calls `disableGitOpsMode` as well, because a teardown project doesn't run on a `SIGKILL` and a
stuck flag disables the *next* run's entire suite. Run it with `npm run test:gitops-mode` (login, the specs,
teardown) or `npm run test:gitops-mode:only` (`--no-deps`, for local iteration).

`cleanup-setup` also turns script execution back on, for the same reason: the exclusive projects turn it off,
and a run killed mid-spec would otherwise leave every script spec of the next run failing.

On premium it sweeps the VMs fleet for what the host-execution specs leave there when a test dies: `fleet-pw-*` titles and `pw-*` policies, scripts, profiles and labels by prefix, but reports only by exact prefix (`pw-run-script-`, `pw-rl-`, `pw-stored-results-`), because gitops declares `pw-host-report-results` on that fleet. A spec that leaves a new kind of per-run report there adds its prefix to that sweep. Deleting a software title cancels its pending installs and script runs, so a per-run package deleted in an `afterEach` also clears that VM's queue.

It also brings the real VMs to their resting state before the first test and after the last: it cancels the
suite's own queued installs and scripts, resets the script timeout to Fleet's default, and on premium
uninstalls any durable fixture a dead run left installed. A VM that's offline is only logged — its specs fail
on it with their own message.

The `loadtest` project depends only on `loadtest-setup`; `loadtest-api` depends on nothing (it sends the bearer token from `FLEET_API_TOKEN`, logging in with the admin credentials when that token is stale). Each project's setup chain is otherwise independent — no cross-project sharing.

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

**API timing specs** (`tests/loadtest/api/`, the `loadtest-api` project) have no browser at all. `shapes.ts` is the request matrix — one entry per endpoint + sort/filter combination, with the fleetdm/fleet issue it guards — and `helpers/perf-api.ts` samples each shape several times with one request in flight, classifies it (`ok` / `slow` / `error` / `broken` / `unavailable` / `skipped`) and keeps run history under `.perf-history-api/`. Over the 5 s budget is `slow` and only flagged; a request that never succeeds is `broken` and fails its family. Add a shape by adding a line to `shapes.ts`; add an id it needs to `resolve.ts`; then run `python3 tools/loadtest-api-audit/audit-shapes.py` from the repo root — Fleet ignores unknown query parameters, so a misspelt one would silently time the wrong request. The plan and the rationale for every family live in `docs/test-plans/loadtest-api-timing.md`.

## Skips

Every `test.skip(...)` or `test.describe.skip(...)` needs an inline comment naming the reason and what unblocks it. If a skip is gated on an env var, document the var in `.env.example`. Where the skip gets recorded depends on why it exists:

- **Blocked by a confirmed Fleet defect** → a row in `docs/blocked-by-product-bugs.md` with the filed issue and the unblock condition, and a matching `TODO(fleetdm/fleet#NNNNN)` comment on the skip so the two can't drift. File the Fleet issue first — "make it green" is not the fix.
- **Env-gated, or deliberately deferred** → a row in `TODO.md`.
- **Data-availability guard** (`test.skip(!host, 'no macOS host')`, `gitopsConfig.scope !== 'no-team'`) → inline reason only. These are preconditions, not debt, and don't get tracked.

## CI and the shared instances — current facts

The one place for facts that change. Skills and docs point here rather than restating them, so when one
changes, change it here. The reasoning behind the flow — why the chain is ordered as it is, what bounds a run,
how to change it safely — is [`docs/ci-pipeline.md`](docs/ci-pipeline.md).

| | |
|---|---|
| **the nightly** | `QA — Nightly` (`.github/workflows/qa-nightly.yml`): both Render deploy hooks → wait for the deploys (polls Render's API when `RENDER_API_KEY` + the two service ids are set, else 30 min) → both instances' `/healthz` → a notice with each instance's build → per tier, the nightly gitops chain, then that tier's suite (whatever gitops did). Cron `17 3 * * *`, but GitHub has been starting this repo's scheduled runs 4–6.5 h late since 2026-08-27, so expect it around 07:00–09:30 UTC. About 1.25 h |
| **a branch's full run** | `QA — Branch run` (`qa-branch-run.yml`): each tier's gitops chain, then its suite, against the branch; a red gitops step stops that tier's suite. `-f workers=N` runs both suites at that count, for a trial without a config commit. **Andrey dispatches it**: at the end of a piece of work, open the PR and tell him it's ready |
| **is anything running?** | `gh run list --limit 5`, before any run that touches the instances. Two runs on one VM corrupt each other: one queue per VM, and each run's cleanup removes the other's state |
| **workers** | CI: free 2, premium 3 (`playwright.config.ts`); local default 4; `--workers=2` for anything on the real VMs |
| **retries and timeouts** | CI `retries: 2` (a report's `outcome: flaky` means it passed on a retry), local 0 — except the describes that wait on a real VM, which take `HOST_RETRIES` from `@fixtures` (1 in CI): a 15-min attempt three times is 45 min of one worker. Test timeout 60 s unless a spec sets its own (VM specs do, up to 15 min); `expect` 10 s. In CI Playwright stops the main run at 100 min (`globalTimeout`), premium's exclusive step at 60 (free's at 15) and the gitops-mode step at 15, reports included; the premium job's limit is 185, free's 120 |
| **runtime** | premium's main project ~47 min at 3 workers (job 63.5 min with the exclusive and gitops-mode steps), free's job ~15 at 2 (2026-10-06, branch run 37395809242, after round 3's batches E and F); ~46 and ~16 after C and D (37149323584), ~42 and ~10 on 2026-09-30 (run 36649240469). Both are worker-bound to the last minute: premium's 123 test-minutes / 3 on 2026-09-30. About 85 of those minutes wait on the real VMs, and three workers picking Linux installs at once cost ~13 of them to queue contention, so a 4th worker is worth ~31–34 min only while the Linux waits stay inside their budgets. `run_timeline.py` in the run-reviewer skill reconstructs this per worker |
| **a run's reports** | a `QA — Nightly` or `QA — Branch run` run uploads one HTML report per Playwright job: `playwright-report-{premium,free}` (the suites — the main project, its exclusive specs and, on premium, gitops-mode run as separate steps and merge into this one report), six `gitops-verify-report-*` and two `gitops-nightly-cli-report-*` |
| **a failure in the main project** | doesn't skip the exclusive or gitops-mode specs: each runs as its own step afterwards, pass or fail |
| **the instances' build** | both redeploy the 4.93 RC tag every night, and a failed deploy is silent: Render keeps the old instance serving. `GET /api/latest/fleet/version` gives the `revision`; `GET /debug/migrations` (admin token) gives `status_code`, where 2 means every migration is applied |

## Pre-PR check

```bash
npm run check          # tsc --noEmit + eslint
```

This is the pre-PR gate — it catches the common mistakes locally. The premium and free suites also run nightly in CI (`QA — Nightly`, above), but don't rely on that to catch what `npm run check` would.

While building, run only the specs you changed — `npx playwright test --project=<tier> <spec-file-names>` on every tier they target, with dependencies at least once, `--workers=2` for anything on the real VMs, and nothing else running against the instance (`gh run list`). The full suite runs once, at the end, as `QA — Branch run`, which Andrey dispatches (facts above). The `playwright-test-author` skill has the detail.
