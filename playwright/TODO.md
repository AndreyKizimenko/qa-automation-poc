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
