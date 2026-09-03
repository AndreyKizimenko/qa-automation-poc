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

---

## Skipped tests

| Test | Why | Unblock |
|---|---|---|

_None._

Product-defect skips live in
[docs/blocked-by-product-bugs.md](docs/blocked-by-product-bugs.md) — currently
three, across `premium/software/vulnerabilities.spec.ts`.

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
