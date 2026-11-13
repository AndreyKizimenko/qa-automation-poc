# tests/loadtest/ — page-load and API timing

This file loads when work happens under `tests/loadtest/`; everything in `playwright/CLAUDE.md` still
applies, except the E2E navigation rule. These specs run locally only: they need a high-scale instance and a
team provisioned via [`gitops/loadtest/`](../../../gitops/loadtest/README.md), with credentials in
`.env.loadtest` (gitignored), so no CI workflow targets them.

**Performance specs** (`tests/loadtest/`) follow different rules. They live in the `tests/loadtest/` tree (which the loadtest project's `testDir` targets exclusively, and which premium/free skip via `testIgnore`), and **navigate by direct URL** because measuring page-load time is the point. They use `measureNav` / `measureSearch` from `helpers/perf.ts`. The e2e conventions above (click-through nav, etc.) do not apply.

**API timing specs** (`tests/loadtest/api/`, the `loadtest-api` project) have no browser at all. `shapes.ts` is the request matrix — one entry per endpoint + sort/filter combination, with the fleetdm/fleet issue it guards — and `helpers/perf-api.ts` samples each shape several times with one request in flight, classifies it (`ok` / `slow` / `error` / `broken` / `unavailable` / `skipped`) and keeps run history under `.perf-history-api/`. Over the 5 s budget is `slow` and only flagged; a shape with any failed sample — `error` (some) or `broken` (all) — fails its family, while `unavailable` is an optional shape that 4xxs on every sample. Add a shape by adding a line to `shapes.ts`; add an id it needs to `resolve.ts`; then run `python3 tools/loadtest-api-audit/audit-shapes.py` from the repo root — Fleet ignores unknown query parameters, so a misspelt one would silently time the wrong request. The plan and the rationale for every family live in `docs/test-plans/loadtest-api-timing.md`.

The `loadtest` project depends only on `loadtest-setup`; `loadtest-api` depends on nothing (it sends the bearer token from `FLEET_API_TOKEN`, logging in with the admin credentials when that token is stale). Each project's setup chain is otherwise independent — no cross-project sharing.
