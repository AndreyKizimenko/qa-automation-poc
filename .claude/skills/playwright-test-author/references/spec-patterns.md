# Spec patterns: the spec to copy for each shape of test

For playwright-test-author. Start a new spec from the exemplar for its shape instead of from a blank file,
and keep what the "load-bearing" column names: each item is there because leaving it out has failed a run.
Paths are under `playwright/tests/`. Open the exemplar and read its header before copying.

Contents: Choosing the shape · The shapes · What every new spec carries · Shapes to avoid

## Choosing the shape

| the test is about | shape |
|---|---|
| one thing a person does, on data you seed | one flow on seeded data (the default) |
| create → edit → delete of one resource through the UI | serial lifecycle |
| the same flow in each scope of a tier | scope loop around either of the above |
| what each role is shown or refused in the UI | role rows in the browser |
| an API test of which role may call an endpoint | role probes at the API |
| an API test of a rule the server enforces (validation, limits, a 402) | API contract |
| what a host does (install, run, verify, report) | real-VM describe |
| which hosts Fleet picks for a profile, title, policy or report | label targeting with borrowed simulations |
| a setting stored on a fleet | throwaway `pw-*` fleet |
| a setting stored on the instance | global setting, restored |
| gitops mode on | `gitops-mode/` |
| a premium surface as free sees it | paywall or absence check |
| `fleetctl` | CLI |

The table finds the shape for the test you were asked to write. It never moves a test from the browser to
the API: this suite covers what a person does in the UI, including rules the server enforces, and API
coverage is to be a suite of its own.

## The shapes

**One flow on seeded data.** `e2e/premium/policies/policies.spec.ts` › *Policies — fleet isolation*.
- Seed through an API helper (`createFleetPolicy`), with a `pw-…-${runNonce()}` name.
- Go straight to the page with `goto({ fleetId })`, unless this is the area's one click-through test
  (`playwright/CLAUDE.md`), and call `teamDropdown.select(scope)` after every scoped `goto`.
- Search until the list holds exactly your row before acting on it.
- An absence assertion sits beside something that proves the page finished loading (here, the empty state).
- Remove the seed in an `afterEach`, or in a `finally` when the sweep would catch a miss.

**Serial lifecycle.** `e2e/premium/policies/policies.spec.ts` › *Policies CRUD*.
- `test.describe.configure({ mode: 'serial' })` only because the steps share an id or a name through the
  closure. Steps that don't depend on each other are separate, parallel tests.
- Only the first step clicks through from the dashboard; later steps `goto({ fleetId })` and
  `teamDropdown.select(scope)`.
- Each step confirms its write through the API right after the action. When the other scope's copy of the
  lifecycle logs the same activity with the same name (a fixed file name, say), take `latestActivityId`
  first and use `assertActivityAfter` matching the fleet.
- **The first step cleans up after its own failed attempt.** A retry starts the describe over with `delete`
  skipped, so a resource Fleet refuses twice ("already exists", "already added") fails the retry before the
  step that failed. `e2e/premium/software/edit-package.spec.ts` shows it: under `testInfo.retry > 0`, delete
  by your own name and record a `retry-cleanup` annotation. The first attempt removes nothing, so residue
  it meets is a finding.
- The last step reads the dashboard feed with `dashboard.expectActivities` and `activityCopy`.

**Scope loop.** The same file: `for (const scope of SCOPES)` around the describe.
- The scope is in the describe title and in every name the loop creates (`slug`), since both iterations run
  in parallel.
- `fleetIdFor(scope, workstationsFleetId)` maps the scope to its `fleet_id`.
- Loop only when the scopes differ in what Fleet does. A flow that behaves the same everywhere is one test.

**Role rows in the browser.** `e2e/premium/policies/role-access.spec.ts`; the free sibling carries the
global-role rows only. `e2e/{shared,free,premium}/command-palette/role-access.spec.ts` shows the three-way
split.
- One table of roles (the static user's key and what that role is shown), one test body.
- `withStaticUser(browser, role.key, async (page) => { … })` gives a signed-in page; page objects are
  constructed on that page (`new PoliciesListPage(page)`), since fixtures belong to the admin's page.
- Seed the row the role looks at with the admin API, and wait for it to render before judging what's absent.
- A write that needs a role on a throwaway fleet uses a disposable `qa-test-*` user: static users never
  belong to one.

**Role probes at the API.** `api/role-access/premium/global-roles.spec.ts`.
- `staticUserBearerHeaders(key)`, then `expectAllow` / `expectDeny` with a probe from
  `helpers/api/role-access.ts`. A new endpoint is a new probe there; a new role is a new test here.
- No user is ever created for a probe.

**API contract.** `api/premium/max-request-file-sizes.spec.ts`, `api/config.spec.ts`.
- `request` with `apiUrl()` and `authHeaders()`; assert the status and the body's shape, not just OK.
- Root of `api/` when both tiers answer the same; `api/premium/` or `api/free/` when they don't.

**Real-VM describe.** `e2e/premium/software/script-only-package.spec.ts` (one platform),
`e2e/premium/software/software-lifecycle-on-host.spec.ts` (each platform).
- `test.describe.configure({ timeout: 600_000, retries: HOST_RETRIES })`: the budget covers the VM's queue,
  not just this test's work, and every wait stays inside it.
- `requireRealHost(request, platform)` for the host; it fails with the reason when the VM is missing.
- A describe-level tracker (`let created`) that an `afterEach` deletes: the test's `finally` is skipped on
  a timeout, and deleting a title also cancels its queued installs.
- A durable fixture from `helpers/vm-fixtures.ts`, left uninstalled, unless the test changes the title
  itself; then a per-run `fleet-pw-*` package deleted in the same test.
- The header says which VM and why it must be real. A test that can't run beside a copy of itself (it
  owns a durable fixture, or writes the one global setting of its kind) says that too, as `e2e/premium/dashboard/automations-activity.spec.ts` does.

**Label targeting with borrowed simulations.**
`e2e/premium/controls/os-settings/profile-label-targets.spec.ts`.
- A named slice constant (`SIM_OFFSET`), claimed in the registry comment on the picker in
  `helpers/api/hosts.ts`.
- `findMdmSimulations` for profiles, `findSimulations` for everything else.
- Assert set equality over the hosts you placed, never a count.
- Return the simulations to Unassigned and delete the labels last (Fleet refuses to delete a label that is
  still targeted).

**Throwaway `pw-*` fleet.** `e2e/premium/dashboard/historical-data-collection.spec.ts`.
- `createFleet` with a `pw-` name; scope the page by URL (`goto({ fleetId })`). The exemplar's
  `selectByLabel(fleet.name)` after each `goto` confirms the scope took; it is not how the fleet is reached.
- `deleteFleet` in the test and again in an `afterEach`; the sweep removes one a killed run left.
- A fleet created through the UI, because the fleet's own lifecycle is the test:
  `e2e/premium/settings/fleets-lifecycle.spec.ts`.

**Global setting, restored.** `e2e/shared/settings/host-status-webhook.spec.ts`.
- Snapshot the one key in `beforeEach`, restore that key in `afterEach`.
- One spec file per key. A second test that writes the key joins this file's describe, which then runs
  its tests one at a time (`test.describe.configure({ mode: 'default' })`): the suite is fully parallel, so
  two tests in one file otherwise run side by side and undo each other's restore.
- A setting that breaks whatever runs beside it goes to `exclusive/` instead
  (`e2e/shared/exclusive/script-execution-disabled.spec.ts`).

**gitops mode.** `e2e/premium/gitops-mode/02-gated-surfaces.spec.ts`: `withGitOpsMode` turns the mode on and
returns the function that puts it back; `expectGatedByGitOps(control, repoUrl)` is the assertion.

**Paywall or absence.** `e2e/free/paywalls.spec.ts`: a row in `PAYWALLED_PAGES` per page, reached by URL.

**CLI.** `cli/shared/gitops-dry-run.spec.ts`: `fleetctl([...])` from `@helpers/fleetctl`, which never throws
on a non-zero exit, so assert the exit code and the output.

## What every new spec carries

Some exemplars predate the last two items (the policies lifecycle names its policy `playwright-policy-…`
and titles its describe `Policies CRUD`). Follow the rule, not the exemplar.

- A header: what it covers, which host or fleet and why, what it leaves behind and who removes it, and the
  Fleet source it was grounded in.
- `test` and `expect` from `@fixtures` in a browser spec.
- Names from `runNonce()` with a `pw-` prefix that says which spec made them.
- A describe title in the house form: `Premium • Area • what`, `Free • …`, `Shared • …`.

## Shapes to avoid

- **`serial` as a lock.** It also skips every later test when one fails, and retries the whole group. Tests
  that only need to stay out of each other's way run one at a time with `mode: 'default'`; neither mode
  protects them from other files, so a test that must be alone on the instance belongs in `exclusive/`.
- **A file per role or per platform.** The role and the platform are rows.
- **A free copy of a premium spec whose behaviour is identical.** That spec belongs in `shared/`.
- **`if` on live data inside a test.** Each branch is a case the test may silently skip; resolve the data in a
  helper that throws when it can't.
