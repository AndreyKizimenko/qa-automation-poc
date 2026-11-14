# tests/api/ — API specs

This file loads when work happens under `tests/api/`; everything in `playwright/CLAUDE.md` still applies.

- **This suite covers the UI.** API coverage is to be a suite of its own: never move a browser test here. What
  lives here are the API contracts the UI suite stands on (`*.spec.ts` at the root for both tiers,
  `premium/` and `free/` for one), the role probes, and the gitops drift checks.
- A spec here imports `apiTest`: `import { apiTest as test, expect } from '@fixtures'`, for the worker
  fixtures and `cleanup` without a browser. Lint refuses the browser `test`, whose `pageHealth` would give
  every test a page it never uses.
- **Role probes** (`role-access/{free,premium}/`): `staticUserBearerHeaders(key)`, then `expectAllow` /
  `expectDeny` with a probe from `helpers/api/role-access.ts`. A new endpoint is a new probe there; a new
  role is a new test here. No user is ever created for a probe.
- **`gitops-verify/`** checks the instance against a gitops target (no browser, `retries: 0`): its tests are
  generated from the target's files. Run one through `npm run test:gitops-verify:<target>`, which sets
  `SUITE` and `GITOPS_TARGET`.
