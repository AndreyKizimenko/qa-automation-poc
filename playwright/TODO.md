# TODO

Tests / specs that are currently **skipped**, **gated behind env vars**, or
**deliberately deferred**, with the reason and the unblock condition.

Skips are tracked in one of two places depending on who owns the fix:

| Kind of skip | Where it goes |
|---|---|
| The test or the suite owes work — env gate, deprecated endpoint, deferred coverage | **here** |
| A confirmed Fleet product defect makes the flow un-passable | [docs/blocked-by-product-bugs.md](docs/blocked-by-product-bugs.md), with a filed issue and a matching `TODO(fleetdm/fleet#NNNNN)` comment on the skip |
| A data-availability guard (`test.skip(!host, 'no macOS host')`, `gitopsConfig.scope !== 'no-team'`) | nowhere — the inline reason is enough. These are preconditions, not debt |

> A skip in the first two categories without a row in the matching file is a bug.

Coverage that has no test yet because the instances lack the infrastructure — host types beyond the three
VMs, a readable mailbox — is tracked in [docs/long-term-goals.md](docs/long-term-goals.md), not here.

---

## Skipped tests

| Test | Why | Unblock |
|---|---|---|
| `tests/e2e/shared/packs/packs.spec.ts` → `pack query executes on targeted host` | `POST /api/v1/fleet/packs/schedule` returns 405 — the schedule endpoint appears partially deprecated. | Find the replacement scheduling endpoint or drop the test. |

Product-defect skips live in
[docs/blocked-by-product-bugs.md](docs/blocked-by-product-bugs.md).

---

## Coverage backlog

Known gaps nobody has scheduled. Each row says where the test would go and what it needs.

**Free coverage.** Behaviour free has too, tested only on premium today. Checked against the source (no
`isPremiumTier`, no license gate) when each row was written.

| Gap | What to do |
|---|---|
| Signed-profile upload refused | Lift the `configuration profile upload validation` describe out of `premium/controls/os-settings/configuration-profiles.spec.ts` into `shared/`: free has MDM on, and the describe sits outside the scope loop |
| Script over 500,000 characters refused | Lift `premium/controls/scripts/library.spec.ts`' `upload validation` describe into `shared/`; `TeamDropdown.select` is already a no-op on free |
| Activity-feed automations | Move `premium/dashboard/automations-activity.spec.ts` to `shared/`: `canEditActivityFeedAutomations` has no tier check. Confirm once that free's dashboard resolves to All fleets |
| Reports list search and platform filter | Split `premium/reports/list-filters.spec.ts`: its search and platform cases to `shared/`; the "Inherited" case stays premium |
| Vulnerabilities: search narrows to one CVE | Add to `free/software/vulnerabilities.spec.ts`. Low value, and the `vulnerable=true` query is the suite's slowest |
| Request-size limits | Move `tests/api/premium/max-request-file-sizes.spec.ts` to `tests/api/`: no route carries a license check before the size middleware. Confirm the `commands/run` under-limit case on free once |
| `fleetctl generate-gitops` argument errors | Move `rejects --dir and --key together` and `requires one of --dir or --key` to `tests/cli/shared/`: resolved client-side |
| Dashboard chart filter | Add the platform-filter round-trip (narrowed request, *Filtered* flag) of `premium/dashboard/fleet-scoped-cards.spec.ts` to `free/dashboard/historical-data-collection.spec.ts`, which already asserts the plain "Hosts online" heading and the missing dataset dropdown |
| Host delete | A free sibling of `premium/hosts/host-delete.spec.ts` (bulk and from host details). Free has no fleet to stage hosts on, so select rows individually or narrow the list first |
| Policy SQL compatibility | Add `macadmins extension table` and `common-table-expression names` to `free/policies/sql-validation.spec.ts` |
| OS versions | Add the platform filter and the row's View all hosts to `free/software/os.spec.ts` |

**Free paywalls.** Premium-only surfaces with nothing asserting their free shape.

| Gap | What to do |
|---|---|
| Add software pages | Rows for `/software/add/package`, `/software/add/fleet-maintained` and `/software/add/app-store` in `free/paywalls.spec.ts`' `PAYWALLED_PAGES`: ten premium specs sit behind this gate |
| Software › Library tab | Assert the Software page's sub-nav has no Library tab on free (`SoftwarePage.tsx`) |
| Fleet Desktop settings | `/settings/organization/fleet-desktop` is a 403 page on free, and the nav has no Fleet Desktop item |
| Exploited vulnerabilities | The option is disabled with the premium tooltip on free (`free/software/vulnerabilities.spec.ts`) |
| Severity / CVSS filters | The software filters modal has no severity block on free (`free/software/vulnerabilities.spec.ts`) |

**Command palette.** Modes the palette plan ([docs/test-plans/command-palette.md](docs/test-plans/command-palette.md)) can't reach from the main projects.

| Gap | What to do |
|---|---|
| Primo Mode | Neither instance runs Primo (`partnerships.enable_primo`), which hides the fleet switcher and `Add fleet` and drops the fleet chips. Needs an instance in Primo Mode; nothing to build until one exists |
| GitOps mode hides `Add fleet` | One case in `tests/e2e/premium/gitops-mode/`: with the mode on, the palette offers no `Add fleet` (`groups/commands.ts` gates it on `isGitOpsMode`) |

**Suite chores**

| What | Note |
|---|---|
| `premium/hosts/host-delete.spec.ts` deletes four **online** simulations a run | A deleted simulation never comes back on its own. Draw them from `findOfflineSimulations` instead, as `bulk-transfer.spec.ts` does |
| `fleet-upgrade-preflight` watch list | Add `.gitops-mode-tooltip-wrapper`: every gitops-mode spec finds gated controls through that class, and a release that renames it breaks all of them |

---

## Config workarounds

| Where | Why | Revert when |
|---|---|---|
| `playwright.config.ts` → top-level `timeout: 60000` | Cloudflare doesn't edge-cache Fleet's `/assets/bundle-*.js` on either QA instance. Fleet's half shipped in 4.90 ([fleetdm/fleet#45682](https://github.com/fleetdm/fleet/issues/45682), fixed by fleetdm/fleet#48409: the bundle carries `Cache-Control: public, max-age=31536000, immutable`), but both instances still answer `cf-cache-status: DYNAMIC` on a repeat request (checked 2026-10-13), so every cold browser context still pulls 4.7 MB from origin. Under origin load that can exceed the default 30 s and surface as `page.goto` timeouts with a blank screenshot. | A repeat request for the bundle answers `cf-cache-status: HIT` — then drop back to Playwright's default 30 s. |
| `playwright.config.ts` → `expect: { timeout: 10_000 }` | Same root cause: the shared QA instance renders slowly under concurrent load, so transient render latency shouldn't surface as a flake. Twice Playwright's 5 s default. | Same as above — drop back to 5 s once a repeat request for the bundle answers `cf-cache-status: HIT`. |
| `playwright.config.ts` → `workers` (CI: premium 3, free 2; local 4) | The shared Fleet QA instances have limited concurrency headroom; higher worker counts in CI surface as flaky navigation timeouts even when the test logic is correct. Premium's third worker leans on its MySQL's 2 CPU / 4 GB, and the real VMs still work one queue each. | The instances / render infra get more headroom — the tests themselves are not the constraint. `WORKERS=N` (or `-f workers=N` on a branch run) overrides for a one-off. |

---

## Tooling gaps

| What | Note |
|---|---|
| No static-user provisioning script | Day-to-day this doesn't bite — the credentials are shared and come from 1Password. It only matters when an instance is rebuilt from scratch, which means creating the 12 API-only users by hand via `POST /users/api_only` and capturing each one-shot token, creating the 8 human users via `POST /users/admin`, and updating 1Password plus the GitHub secrets. The registry in `helpers/api/static-users.ts` already holds everything a script would need (email, name, role, tier). Low priority until the next rebuild. |

---

## Declared but unused

| What | Note |
|---|---|
| `FLEET_STATIC_TOKEN_API_WS_ADMIN` | Declared in `.env.premium.example` and registered as `api-ws-admin` in `helpers/api/static-users.ts`, but no spec consumes it yet, so `playwright-premium.yml` doesn't pass it. Either write the spec or drop both. |

---

## Conventions for marking skips

1. **Conditional skip with reason** inside a test or at the top of a describe —
   when what the test needs is missing on this instance (a data guard, which
   needs no entry):
   ```ts
   test.skip(!host, 'no online macOS VM');
   ```
   Tier is decided by folder, never by an env-var gate.
2. **`test.describe.skip(...)` block** — when an entire describe is inert.
3. **`test.skip('name', async () => { ... })`** — one specific test broken
   for a reason unrelated to the rest of the spec.

Every env-gated or deferred skip needs an entry above — or, for product defects, in
[docs/blocked-by-product-bugs.md](docs/blocked-by-product-bugs.md). Every env var
gate needs a row in `.env.<suite>.example`.
