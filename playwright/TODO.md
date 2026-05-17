# TODO

Tests / specs that are currently **skipped**, **gated behind env vars**, or
**deliberately deferred**, with the reason and the unblock condition.

> When you add a new skip, add a row here. A skip without a TODO entry is a bug.

---

## Skipped tests

| Test | Why | Unblock |
|---|---|---|
| `tests/e2e/shared/packs/packs.spec.ts` → `pack query executes on targeted host` | `POST /api/v1/fleet/packs/schedule` returns 405 — the schedule endpoint appears partially deprecated. | Find the replacement scheduling endpoint or drop the test. |

---

## Config workarounds

| Where | Why | Revert when |
|---|---|---|
| `playwright.config.ts` → top-level `timeout: 60000` | `/assets/bundle-*.js` is served without `Cache-Control`, so Cloudflare doesn't edge-cache it and every cold browser context refetches 4.7 MB from origin. Under origin load that can exceed the default 30 s and surface as `page.goto` timeouts with a blank screenshot. | [fleetdm/fleet#45682](https://github.com/fleetdm/fleet/issues/45682) ships — then drop back to Playwright's default 30 s. |

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

Every skip needs an entry above. Every env var gate needs a row in
`.env.example`.
