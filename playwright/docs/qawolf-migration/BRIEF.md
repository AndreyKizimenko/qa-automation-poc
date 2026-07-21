# QA Wolf → Fleet Playwright migration — cataloguing brief

You are one of several agents auditing tests that were handed to us from **QA Wolf**. They live in
`/Users/andrey/repositories/qa-automation/flows-Free/` and `flows-Premium/` as `*.flow.js` / `*.flow.ts`.
Your job: for an assigned slice of these flows, decide how each maps onto our EXISTING Playwright suite
(under `/Users/andrey/repositories/qa-automation/playwright/`). You are NOT writing tests. You produce a
per-flow disposition table + a short area summary.

## What the QA Wolf flows are (read this — it changes how you judge them)

- They import `@qawolf/flows/web` and `../../utilities/node-20-helpers-premium.js` (`logInAsGlobalAdmin`,
  `typeNewPolicy`, `cleanupQueries`, etc.). **Those utilities do NOT exist in our repo.** The flows are
  therefore NOT runnable. Treat them as *coverage transcripts / specifications of test intent*, not code
  to port. We harvest WHAT they test, not HOW.
- Structure: `flow("Name", "Web - Chrome", async ({ test, ... }) => { await test("step", async () => {...}) })`.
  Each `test("...")` is a sub-step of one logical flow (like our serial sub-tests).
- They are full of things that VIOLATE our standards (do not port these; just note them):
  - `page.waitForTimeout(...)` arbitrary sleeps everywhere.
  - Brittle selectors: `.delete-loading`, `.save-loading`, `.page-description`, `:left-of(:text(...))`,
    `tbody tr:has-text(...)`, `.toast-notification__message`, `.actions-dropdown-select__placeholder`.
  - Hardcoded accounts like `fleet+GlobalAdmin8@qawolf.email` — will not exist on our instances.
  - **They create and DELETE teams inside the test body** (e.g. "Create fleet", "Delete Fleet"). Our suite
    forbids this — teams are gitops-provisioned (`Workstations`) or `Unassigned`; cleanup is done by
    dedicated projects. Any flow that creates/deletes teams needs rework to the gitops model.
- USEFUL intel to extract: real Fleet `data-testid`s they reference (e.g. `transfer-icon`,
  `checkbox-unchecked-icon`, `user-menu`, `trash-icon`, `download-icon`, `dropdown-option`), real toast copy,
  real nav paths, and the actual user-visible scenario/edge-cases they cover.

## Terminology renames (Fleet renamed things; QA Wolf flows straddle the rename)

- **queries → reports** in the nav/UI: "Add report", "Edit report", "Report updated", "Back to reports".
  So QA Wolf `queries-*` flows exercise what our suite calls the **reports** area
  (`pages/reports/*`, `tests/e2e/*/reports/`). "Scheduled queries" = the **schedule** feature.
- **teams → fleets** in the UI: "Create fleet", "Select a fleet", "Fleet removed". Scope names in our
  suite: `Unassigned` (no team), `Workstations` (the gitops premium team), `All fleets` (global aggregate).

## Our suite's standards (the bar every ported test must meet — read the real files, don't guess)

READ THESE before judging:
- `/Users/andrey/repositories/qa-automation/playwright/CLAUDE.md` — folder layout, projects, CRUD serial
  convention, scope dropdown, activity-feed assertions, no-team-create rule, API helpers.
- The `.claude/skills/playwright-test-author/SKILL.md` — locator priority (getByRole > getByLabel >
  getByPlaceholder > getByText > `.class` last-resort-with-comment), POM rules.
- `.claude/skills/playwright-test-reviewer/SKILL.md` — the catalogue of *legitimate* class fallbacks.

Key facts:
- **POM everywhere.** Page objects in `playwright/pages/`, components in `pages/components/`. Fixtures in
  `playwright/fixtures.ts` (import `test`/`expect` from `@fixtures`). Available POM fixtures include:
  dashboard, hostsList, hostDetails, labelsPage, policiesList/policyEdit/policyDetails,
  reportsList/reportEdit/reportLive/reportDetails, packsList/packEdit, the software/* POMs, controls/* POMs,
  settings/users POMs, organizationInfo/Advanced, integrationsPage, account POMs.
- **Static users** (`helpers/api/static-users.ts`): pre-provisioned users for every role
  (global-admin/maintainer/observer/observer-plus/technician; ws-maintainer/ws-observer for team-scoped;
  api-only variants). Role-permutation flows map onto these — NOTE if a role has no static user yet
  (e.g. there is currently no team-**admin** static user).
- **Tier separation is deliberate.** The team prefers explicit `free/` and `premium/` spec files over one
  parameterized spec. A behavior that exists in both tiers usually becomes TWO specs (or a `shared/` spec
  only if genuinely tier-agnostic like auth/packs).
- **Folder convention**: premium-only → `tests/e2e/premium/<area>/`; free-only (paywalls, free-license) →
  `tests/e2e/free/<area>/`; tier-agnostic → `tests/e2e/shared/<area>/`.
- **CRUD lifecycle** specs split create/edit/delete + a final dashboard activity-feed assertion into serial
  sub-tests. Reuse existing scope patterns.

## Disposition taxonomy (assign exactly one per flow)

- **DUP** — an existing spec already covers this behavior at equal-or-greater depth. Action: drop the QA Wolf
  flow. Cite the existing spec path.
- **AUGMENT** — an existing spec covers the flow, but the QA Wolf flow asserts something extra worth grafting
  (an edge case, an extra assertion, a role variant, a toast copy). Action: name the existing spec + the
  SPECIFIC addition.
- **NEW** — genuine coverage gap worth authoring. Action: propose a target path in our folder convention +
  note POM reuse vs POM gaps that must be built.
- **CUT** — low value. Action: give the reason (trivial UI-presence check, redundant with another QA Wolf
  flow, obsolete/removed feature, tests QA-Wolf infra, or pure duplicate of a sibling role flow).
- **MERGE** — this flow collapses with other QA Wolf flow(s) into a single spec (very common for
  role-permutation sets and free/premium pairs). Name the group.

When unsure between DUP and AUGMENT, open the existing spec and check the actual assertions.

## Output — do BOTH

1. **Write** a markdown file to the audit dir:
   `/private/tmp/claude-501/-Users-andrey-repositories-qa-automation/1a2d3412-23e5-41b1-832f-c76eb2afac1f/scratchpad/audit/<CLUSTER>.md`
   (your prompt gives the exact `<CLUSTER>` filename). Format:

   ```
   # <Cluster name> — audit

   ## Disposition table
   | # | QA Wolf flow (basename) | Tier | Behavior (1 line) | Disposition | Target (existing or proposed path) | Notes |
   |---|---|---|---|---|---|---|
   ... one row per flow ...

   ## Summary
   - Counts: DUP _, AUGMENT _, NEW _, CUT _, MERGE _
   - NEW specs recommended (bullet list, proposed paths)
   - Notable CUTs (+reason)
   - POM / helper work required (what page objects or methods must be built or extended)
   - Role-model / infra gaps (missing static users, team-create reliance, etc.)
   - Open questions for the human
   ```

2. **Return** (as your final message) a compact version: the counts line, the list of NEW-spec
   recommendations, the biggest CUTs, and the POM work needed. Keep it tight — the orchestrator reads this.

Be rigorous: every assigned flow gets a row. Read the existing specs in your area before deciding DUP.
