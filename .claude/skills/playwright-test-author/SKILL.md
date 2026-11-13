---
name: playwright-test-author
description: Write, extend or fix tests in Fleet's Playwright QA suite (`playwright/` in qa-automation) — new specs, augments to existing ones, page objects, component objects, API helpers, fixtures and test data. Use it before adding or changing anything under `playwright/tests`, `pages`, `helpers`, `setup` or `test-data`, including "write a test for…", "add free coverage for…", "augment the policies spec", "create a page object", "fix this test-bug from the run review" — even when the request doesn't say "Playwright". It carries the suite's safety rules for the real VMs, how to verify without disrupting the shared instances, and which docs move with the code.
---

# Writing tests for Fleet's QA suite

The suite drives Fleet through its UI and API against two shared QA instances (free and premium). Each
has ~300 osquery-perf simulated hosts and three real VMs (macOS, Windows, Ubuntu). Writing a Playwright test
is the easy part. The mistakes that cost the most here are: locking a real VM, asserting against a simulated
host that can't answer, leaving state behind for the next run, and running far more than you changed. Most
of this skill is about not doing those.

`playwright/CLAUDE.md` is the suite contract: layout, projects, host populations, the cleanup pipeline,
imports, skips, and a **CI and the shared instances** table with the facts that change (the nightly, workers,
timeouts, runtimes). Read it before you start; this skill doesn't repeat it.

## Stop and ask before any of these

Each has happened, or nearly happened, and none can be undone from a test.

- **Delivering a configuration profile to a real host that could lock it.** No passcode payload
  (`com.apple.mobiledevice.passwordpolicy`, `forcePIN`, `minLength`, `maxInactivity`, `allowSimple`), no
  screen lock, inactivity timeout, FileVault or login-window restriction, nothing that disables SSH, remote
  management or MDM. There are three VMs per tier and no way to rebuild one from here. **Uploading a
  profile is delivering it:** on free, Unassigned is where the real VMs are, and Fleet's reconciler sends
  whatever it finds within 30 s. The suite's old "library-only" passcode and DeviceLock fixtures reached the
  free VMs 7 and 32 times before anyone noticed.
- **Any new payload type, even one you believe is inert.** Get Andrey's approval first. macOS 26.6 happily
  installed a "must be refused" payload everyone expected it to reject, so "inert" is a claim to check on
  the device, not a property of the XML. The approved fixtures are the inert profiles
  `test-data/{apple/macos,windows}/profiles/fleet-pw-inert*` (see their READMEs). `helpers/profiles.ts`
  builds more: `inertMobileconfig` / `inertWindowsProfile` / `inertDeclaration` on the same pattern, and
  `rejectedMobileconfig` (the approved Wi-Fi payload a Mac refuses). It also holds two OS-update enforcers,
  `updateEnforcementDeclaration` and `windowsUpdateProfile`, which make a real host update and restart: they
  take `noRealHostsOnFleet: true` and go only to a fleet you've checked holds no real host
  (`ddm-conflict.spec.ts` uses Workstations).
- **Settings that update, reboot or lock a real host:** an OS-update minimum version or deadline, a DDM
  software-update declaration, Recovery Lock password enforcement. Exercise them only on a fleet with no
  real hosts (Workstations), and restore them in the same test. On **free**, global settings reach the free
  VMs, because they're in Unassigned. The one approved exception is `recovery-lock.spec.ts`, which sets,
  rotates and clears Recovery Lock on the premium Mac (`playwright/CLAUDE.md` → Test hosts).
- **Changing what other specs stand on:** the durable VM software (`helpers/vm-fixtures.ts`, declared in
  `gitops/premium-fleetqa/fleets/vms.yml`), creating, renaming or deleting a standing fleet (Workstations,
  VMs, QA and Compliance from gitops; Mobile by hand), moving any host onto Compliance, gitops config, static
  users (their tokens can't be re-minted). A global gitops file a spec dry-runs or applies on premium must
  declare the IdP (`carryLiveEndUserAuth` in `helpers/fleetctl.ts`): Compliance depends on it, and fleetctl
  refuses a global file that would clear it.
- **Changing the Fleet web address or the global end-user authentication (IdP) settings.** Changing either
  re-syncs every fleet's DEP profile with Apple Business Manager, and `server_url` also feeds the Apple MDM URL
  (while `apple_server_url` is empty), Windows MDM discovery, the Android callback and the SSO ACS URL. No test
  changes either.
- **Anything Fleet can't undo.** An Android web app can be created and never deleted, so a gap that needs one
  is cut, not pinned as a durable fixture. Editing a durable Fleet-maintained app's install script sets
  `install_script_edited`, which auto-update carries forward, so the scripts of the QA shelf's and the VMs
  fleet's apps are never edited. The org-wide *Store report results* setting has no confirmation, and turning
  it off across the hourly cleanup deletes every stored result: it's never toggled. When the flow itself is
  one-way (Lock, Wipe), assert its permission surface instead and say so in the header
  (`mdm-actions-availability.spec.ts`).
- **Triggering Fleet's crons** (`POST /trigger`, `fleetctl trigger`: vulnerabilities, aggregation, the
  batch-activity checker). They're global, and every other run on the instance sees the effect: wait for the
  cron, or read the API.
- **Starting a full suite run.** Andrey dispatches `QA — Branch run`. Your runs are scoped (below), and
  never while something else is using the instances (`gh run list --limit 5`).

When in doubt, the answer is to ask. A blocked afternoon costs less than a VM rebuilt by hand.

## How the work goes

1. **Know what exists.** Open every spec you're augmenting before writing anything; titles lie. Check
   `pages/README.md` and `helpers/README.md` before writing a helper that already exists. A plan's or an
   issue's facts are claims: check them against the source before building on them.
2. **Ground it in the product, not in the screen.** Probe the live page: the Playwright MCP's
   `browser_snapshot` shows the accessibility tree `getByRole` will target. To drive a signed-in page, write a
   local script that loads `.auth/<tier>-admin.json` into Playwright, never `browser_run_code_unsafe`: the MCP
   echoes the code it runs, session cookie included. Read the React component in
   `~/repositories/fleet/frontend/` for roles, names and conditional rendering. Read `docs/REST API/rest-api.md`
   before writing an API helper; the UI says reports and fleets where the API still says queries and teams.
   For claims about behaviour (tier gating, retries, what a setting does), read the server code in
   `~/repositories/fleet/server/` and `ee/`. An hour of reading has repeatedly replaced a day of guessing.
3. **Decide the tiers: free coverage is a standing goal.** Coverage tends to start premium-only, so free
   coverage has to be looked for. Check the component (`isPremiumTier`) and the server (`premium:"true"`
   struct tags, license checks) for what free has. Use `tests/e2e/shared/` when the behaviour is identical,
   an explicit `free/` sibling when it differs, and never one spec with `if (isPremium)`. A premium-only
   surface often gives free a check anyway: the paywall (`tests/e2e/free/paywalls.spec.ts`), an absent
   control, or the API's 402. Within a tier, one spec per area carries the role (and the platform) as a
   dimension of its cases, not one file per role × platform.
4. **Decide the hosts.** What Fleet decides **server-side** (which hosts a profile, title, policy or report
   reaches; an IdP username; a transfer) a simulation answers as well as a VM. What the host **does**
   (installs, runs, verifies, reports inventory) only a real VM can answer: `findOnlineHost(request,
   platform, { kind: 'real' })`, `vmsFleetId`, `liveMacosHost`. To put simulations on a fleet beside a VM,
   borrow them with `findMdmSimulations` (profiles; a scarce pool) or `findSimulations` (everything else),
   claim your own slice in the registry in `helpers/api/hosts.ts`, and return them in the `finally`.
5. **Build the page objects first, then the spec.** Read `references/fleet-traps.md` before either.
   Page objects expose intent (`openControlsTab()`, `runRowAction(name, 'Delete')`) and locators;
   assertions live in the spec. Grow an existing page object before creating a new one, and turn a
   widget two pages share into a component object in `pages/components/`.
6. **Assert what can fail.** Set membership over hosts you control, never a count on a shared list
   (`toBeGreaterThanOrEqual(hostCount, 2)` passes whatever happens). Confirm through the API that a UI write
   happened. Scope every assertion to records you created. Assert text or a value, never `toHaveScreenshot`
   for behaviour; when a snapshot can't be avoided, the header says why.
7. **Give everything you create a home.** Remove it in the test's `finally`. Playwright skips the `finally`
   when a test times out, so anything that could survive on the VMs fleet also needs a home in
   `setup/cleanup.steps.ts`: the VMs sweep for things Fleet stores by name, the resting-state step for state
   on a host. Name per-run things `pw-*` (packages `fleet-pw-*`) so the sweep recognises them, and never
   give a durable thing those prefixes. Reports are the exception: on VMs and Workstations the sweep matches
   exact prefixes (gitops declares `pw-host-report-results` on VMs), so a spec that leaves a new kind of report
   there adds its prefix to `cleanup.steps.ts`. On free nothing sweeps `pw-*` labels, so a free spec deletes
   its own.
8. **Verify, scoped** (next section).
9. **Build in slices, and update the docs in the same commit** (the table below): one concern per commit,
   each green on the instance, so a failure points at one change.
10. **Review your own work** with `playwright-test-reviewer` on the branch's diff, fix what it finds or
    write down why not, then open the PR and tell Andrey it's ready for its branch run. Say if the PR changes
    a workflow file: its branch run needs `--ref <branch>`.

## Verifying without disrupting anyone

`npm run check` (tsc + eslint) is the floor, not proof. A green local run is easy to get for the wrong
reason, so:

- **Run only what you changed, on every tier it targets:** `npx playwright test --project=premium
  <spec-file-names>`, and `--project=free` for anything in `shared/` or `free/`. That runs the setup and
  cleanup projects, including the VM resting-state step, and then only your tests. **Never
  `npm run test:<tier> -- <spec>`:** npm appends your arguments after the script's final `exit`, so no
  `playwright test` sees them. You get the whole main project, the exclusive one and, on premium,
  gitops-mode, then exit 1. For an `exclusive/` spec: `--project=premium-exclusive <file-name>`, by
  file name (it runs only the login setup and `cleanup-teardown` around it). Never name a main project and
  its exclusive one in one invocation: they'd run side by side, and the config refuses to. A
  `gitops-mode/` spec runs alone: `npm run test:gitops-mode` (login, the specs, teardown). A gitops-verify
  change runs through its `npm run test:gitops-verify:<target>` script, which sets `SUITE` and
  `GITOPS_TARGET`.
- **Run once with dependencies** (no `--no-deps`). `cleanup-setup` drains global reports and policies
  before the first test, so a spec leaning on pre-existing data passes with `--no-deps` and fails every
  nightly.
- **Run once headed.** Headless on an idle machine hides render-order races that show up under load.
- **`--repeat-each=5`** for anything timing-sensitive; **`--workers=2`** on anything touching the real VMs,
  since each VM works one queue and more workers stack it into timeouts; **`--output=<scratchpad>/<run>`**
  so artifacts stay out of the repo. A test that can't run beside a copy of itself says so in its header and is
  repeated on **one** worker: `software-lifecycle-on-host` owns a durable VM fixture, so with two workers
  `--repeat-each` runs it beside itself, and one copy uninstalls the app the other just installed.
- **`gh run list --limit 5` right before any run that touches the instances.** Two runs on one VM corrupt
  each other, and the nightly starts hours after its cron time.
- **On free the real VMs sit in Unassigned.** Pick simulations there by id, never by a filter or *Select all*,
  and run what touches Unassigned knowing the VMs are there.
- **Another session may be using the same instances or checkout.** Each session works in its own
  `git worktree` and stages by file, never `git add -A`. Announce every run to the others ("about to run
  <specs> on <tier>, ~N min", then "done"). A run **with dependencies** waits for their explicit go: its
  `cleanup-setup` wipes global reports and policies and Unassigned's scripts, packages and profiles. A
  `gitops-mode` run needs the same go: while it runs, every control is read-only.

## Docs move with the code

A change isn't done until the docs describing it are current, in the same commit:

| you changed | update |
|---|---|
| a `test()` | its `docs/test-audit/` area entry (steps a person would perform, validations tagged *(UI)* / *(API)*, an honest assessment) and the audit README's index and counts |
| a helper, page object or component object | `helpers/README.md` / `pages/README.md` / `pages/components/README.md` |
| a fixture | its `test-data/` README: what it does, why it's safe on a real VM, how to rebuild it |
| gitops | the file's header and its config's README (`gitops/{premium,free}-fleetqa{,-min}/README.md`); a file both the full and `-min` configs declare changes in both; apply it, and say so in the PR |
| an ignored page error | its `DEFAULT_IGNORED_PAGE_ERRORS` entry (`helpers/console.ts`) carries `TODO(fleetdm/fleet#N)`, plus a row in `docs/blocked-by-product-bugs.md` |
| a rule every spec should follow | `playwright/CLAUDE.md`, and this skill or the reviewer's |
| a skip owed to a Fleet bug | a row in `docs/blocked-by-product-bugs.md` and `TODO(fleetdm/fleet#N)` on the skip. Search Fleet's issues for it first, and file only when Andrey agrees it's a bug; run the test un-skipped once to see it fail for the filed reason |
| an env-gated or deferred skip | a `TODO.md` row |

## Fleet traps the suite has already paid for

`${CLAUDE_SKILL_DIR}/references/fleet-traps.md` is the catalog: what Fleet's UI, the VMs and the shared
instances have already done to this suite, each with the helper or pattern that avoids it. It's a
required read, not background: **read the whole file before step 5**, before the first locator, wait
or helper. Its groups:

- **Locators and UI state**: locator order, names that change under state, the Hosts list rewriting
  its URL, menus, the report edit form, hidden radio inputs.
- **Waiting**: actions on a missing locator, toasts and closed modals that prove nothing, host
  refetches, live runs with no timeout, failing an install without stalling a VM, VM time budgets.
- **Data and state**: activity checks, seeding, global config and its restore, writers that race,
  gitops-mode exceptions, `exclusive/`, login throttling, deletes that take more with them.
- **API helpers**: `apiUrl()` and `authHeaders()`, throwing on non-OK, empty multipart fields.
- **The instances**: the nightly RC redeploy and silent failed deploys, `fleetctl` versions and contexts.

After a long session the catalog may no longer be in front of you. Re-read it rather than working
from memory.

## Code style

- Write comments for a reader who has never seen the previous version: say what the code *does* and why,
  never what changed or what it replaced.
- Spec headers carry the reasoning: why this host, this fleet, this locator, and what breaks if someone
  "simplifies" it. Most of the suite's hard-won knowledge lives in spec headers.
- Imports come from `@fixtures` in browser specs, and path aliases (`@helpers/*`, `@pages`) across modules.

## When you're done

Say what landed (specs, page objects, helpers, docs), what you ran and how it came out (tiers, headed,
with deps, repeats), and anything that needs Andrey: approvals, decisions, bugs to file. Keep it short. The
PR description is where the detail goes.
