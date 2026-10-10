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
[docs/blocked-by-product-bugs.md](docs/blocked-by-product-bugs.md) — currently
three, across `premium/software/vulnerabilities.spec.ts`.

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
| Dashboard chart card | A free sibling of `premium/dashboard/fleet-scoped-cards.spec.ts`: the plain "Hosts online" heading, the filter round-trip, and no dataset dropdown |
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

**Suite chores**

| What | Note |
|---|---|
| `premium/hosts/host-delete.spec.ts` deletes four **online** simulations a run | A deleted simulation never comes back on its own. Draw them from `findOfflineSimulations` instead, as `bulk-transfer.spec.ts` does |
| `fleet-upgrade-preflight` watch list | Add `.gitops-mode-tooltip-wrapper`: every gitops-mode spec finds gated controls through that class, and a release that renames it breaks all of them |

---

## Config workarounds

| Where | Why | Revert when |
|---|---|---|
| `playwright.config.ts` → top-level `timeout: 60000` | `/assets/bundle-*.js` is served without `Cache-Control`, so Cloudflare doesn't edge-cache it and every cold browser context refetches 4.7 MB from origin. Under origin load that can exceed the default 30 s and surface as `page.goto` timeouts with a blank screenshot. | [fleetdm/fleet#45682](https://github.com/fleetdm/fleet/issues/45682) ships — then drop back to Playwright's default 30 s. |
| `playwright.config.ts` → `expect: { timeout: 10_000 }` | Same root cause: the shared QA instance renders slowly under concurrent load, so transient render latency shouldn't surface as a flake. Twice Playwright's 5 s default. | Same as above — drop back to 5 s once the bundle is edge-cached. |
| `playwright.config.ts` → `workers: CI ? 2 : 4` | The shared Fleet QA instance has limited concurrency headroom; higher worker counts in CI surface as flaky navigation timeouts even when the test logic is correct. | The premium instance / render infra gets more headroom — the tests themselves are not the constraint. `WORKERS=N` overrides for a one-off. |

---

## Tooling gaps

| What | Note |
|---|---|
| No static-user provisioning script | Day-to-day this doesn't bite — the credentials are shared and come from 1Password. It only matters when an instance is rebuilt from scratch, which means creating ~13 API-only users by hand via `POST /users/admin`, capturing each one-shot token, and updating 1Password plus the GitHub secrets. The registry in `helpers/api/static-users.ts` already holds everything a script would need (email, name, role, tier). Low priority until the next rebuild. |

---

## Declared but unused

| What | Note |
|---|---|
| `FLEET_STATIC_TOKEN_API_WS_ADMIN` | Declared in `.env.premium.example` and registered as `api-ws-admin` in `helpers/api/static-users.ts`, but no spec consumes it yet, so `playwright-premium.yml` doesn't pass it. Either write the spec or drop both. |

---

## Conventions for marking skips

1. **Static skip with reason** at the top of a describe — when the feature is
   unavailable on this instance:
   ```ts
   test.skip(
     process.env.FLEET_LICENSE !== 'free',
     'Set FLEET_LICENSE=free to run Fleet Free tests',
   );
   ```
2. **`test.describe.skip(...)` block** — when an entire describe is inert.
3. **`test.skip('name', async () => { ... })`** — one specific test broken
   for a reason unrelated to the rest of the spec.

Every skip needs an entry above — or, for product defects, in
[docs/blocked-by-product-bugs.md](docs/blocked-by-product-bugs.md). Every env var
gate needs a row in `.env.<suite>.example`.
