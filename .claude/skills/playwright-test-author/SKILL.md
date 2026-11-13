---
name: playwright-test-author
description: "Write, extend or fix tests in Fleet's Playwright QA suite (`playwright/` in qa-automation): new specs, augments to existing ones, page objects, component objects, API helpers, fixtures and test data. Use it before adding or changing anything under `playwright/tests`, `pages`, `helpers`, `setup` or `test-data`, including 'write a test for…', 'add free coverage for…', 'augment the policies spec', 'create a page object', 'fix this test-bug from the run review', 'fix the suite for the new Fleet release', even when the request doesn't say Playwright. It carries the suite's safety rules for the real VMs, how to verify without disrupting the shared instances, and which docs move with the code. Not for reviewing test code (playwright-test-reviewer) or for deciding why a run failed (playwright-run-reviewer)."
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

<!-- shared:real-host-safety -->
- **A configuration profile that could lock a real host, delivered to one.** No passcode payload
  (`com.apple.mobiledevice.passwordpolicy`, `forcePIN`, `minLength`, `maxInactivity`, `allowSimple`), no
  screen lock, inactivity timeout, FileVault or login-window restriction, nothing that disables SSH, remote
  management or MDM. There are three VMs per tier and no way to rebuild one from here. **Uploading a
  profile is delivering it:** on free, Unassigned is where the real VMs are, and Fleet's reconciler sends
  whatever it finds within 30 s, so a spec that deletes the profile a step later still reaches them. The
  suite's old "library-only" passcode and DeviceLock fixtures reached the free VMs 7 and 32 times before
  anyone noticed. The only committed profiles are the inert
  `test-data/{apple/macos,windows}/profiles/fleet-pw-inert*` (see their READMEs).
- **Any new payload type, even one believed inert, without Andrey's approval.** macOS 26.6 happily
  installed a "must be refused" payload everyone expected it to reject, so "inert" is a claim to check on
  the device, not a property of the XML. `helpers/profiles.ts` builds the approved ones:
  `inertMobileconfig` / `inertWindowsProfile` / `inertDeclaration`, and `rejectedMobileconfig` (the Wi-Fi
  payload a Mac refuses). Its two OS-update enforcers, `updateEnforcementDeclaration` and
  `windowsUpdateProfile`, make a real host update and restart: they take `noRealHostsOnFleet: true` and go
  only to a fleet checked to hold no real host (`ddm-conflict.spec.ts` uses Workstations).
- **A setting that updates, reboots or locks a real host, set where one can receive it:** an OS-update
  minimum version or deadline, a DDM software-update declaration, Recovery Lock password enforcement. On
  premium that is the VMs fleet: exercise them on Workstations, and restore them in the same test. On free
  it is any global setting, because the free VMs sit in Unassigned. The one approved exception is
  `recovery-lock.spec.ts`, which turns Recovery Lock on for the VMs fleet, turns it off in an `afterEach`,
  and has the resting-state step turn it off after a dead run (`playwright/CLAUDE.md` → Test hosts).
- **What other specs stand on, changed:** the durable VM software (`helpers/vm-fixtures.ts`, declared in
  `gitops/premium-fleetqa/fleets/vms.yml`; resting state uninstalled), a standing fleet created, renamed or
  deleted (Workstations, VMs, QA and Compliance from gitops; Mobile by hand), a host moved onto Compliance,
  gitops config, static users (their tokens can't be re-minted). A global gitops file a spec dry-runs or
  applies on premium must declare the IdP (`carryLiveEndUserAuth` in `helpers/fleetctl.ts`): Compliance
  depends on it, and fleetctl refuses a global file that would clear it.
- **The Fleet web address or the global end-user authentication (IdP) settings, saved changed.** Either
  re-syncs every fleet's DEP profile with Apple Business Manager, and `server_url` also feeds the Apple MDM
  URL (while `apple_server_url` is empty), Windows MDM discovery, the Android callback and the SSO ACS URL.
  No test changes either.
- **Anything Fleet can't undo.** An Android web app can be created and never deleted, so a gap that needs
  one is cut, not pinned as a durable fixture. Editing a durable Fleet-maintained app's install script sets
  `install_script_edited`, which auto-update carries forward, so the scripts of the QA shelf's and the VMs
  fleet's apps are never edited. The org-wide *Store report results* setting has no confirmation, and
  turning it off across the hourly cleanup deletes every stored result: it's never toggled. `secrets: false`
  and the Enroll secrets exception are written only by the `gitops-mode` project. When the flow itself is
  one-way (Lock, Wipe), a spec asserts its permission surface instead and says so in its header
  (`mdm-actions-availability.spec.ts`).
- **Fleet's crons, triggered** (`POST /trigger`, `fleetctl trigger`: vulnerabilities, aggregation, the
  batch-activity checker). They're global, and every other run on the instance sees the effect: wait for
  the cron, or read the API.
<!-- /shared:real-host-safety -->
- **Starting a full suite run.** Andrey dispatches `QA — Branch run`. Your runs are scoped (below).

When in doubt, the answer is to ask. A blocked afternoon costs less than a VM rebuilt by hand.

## How the work goes

1. **Know what exists.** Open every spec you're augmenting before writing anything; titles lie. For "is
   there already a page object or helper for this", `pages/index.ts`, `fixtures.ts` and the exports of
   `helpers/api/<area>.ts` are complete; the READMEs describe the main ones. A plan's or an issue's facts
   are claims: check them against the source before building on them.
2. **Ground it in the product, not in the screen.** Probe the live page: the Playwright MCP's
   `browser_snapshot` shows the accessibility tree `getByRole` will target. To drive a signed-in page, write a
   local script that loads `.auth/<tier>-admin.json` into Playwright, never `browser_run_code_unsafe`: the MCP
   echoes the code it runs, session cookie included. In Fleet's checkout (`$FLEET_REPO`, else `../fleet`
   beside this repo), read the React component under `frontend/` for roles, names and conditional
   rendering, `docs/API/rest-api.md` before writing an API helper (the UI says reports and fleets where
   the API still says queries and teams), and the server code in `server/` and `ee/` for claims about
   behaviour. An hour of reading has repeatedly replaced a day of guessing.
3. **Decide the tiers: free coverage is a standing goal.** Coverage tends to start premium-only, so free
   coverage has to be looked for. Check the component (`isPremiumTier`) and the server (`premium:"true"`
   struct tags, license checks) for what free has. Use `tests/e2e/shared/` when the behaviour is identical,
   an explicit `free/` sibling when it differs, and never one spec with `if (isPremium)`: a tier switch
   lives in a helper or page object, keyed on `SUITE` (as `TeamDropdown.select` is). A premium-only surface
   often gives free a check anyway: the paywall (`tests/e2e/free/paywalls.spec.ts`), an absent control, or
   the API's 402. Within a tier, a role or a platform is a row of one spec's cases, not a file of its own.
4. **Decide the hosts.** What Fleet decides **server-side** (which hosts a profile, title, policy or report
   reaches; an IdP username; a transfer) a simulation answers as well as a VM. What the host **does**
   (installs, runs, verifies, reports inventory) only a real VM can answer: `requireRealHost(request,
   platform)`, `vmsFleetId`, `liveMacosHost`, each refusing a test without its VM's tag
   (`{ tag: '@vm-linux' }`). To put simulations on a fleet beside a VM, borrow them with
   the `borrowSims` fixture (`mdm: true` only for profiles: a scarce pool) on a slice you claim in the
   registry in `helpers/api/hosts.ts`; it returns them after the test.
5. **Build the page objects first, then the spec.** Read `references/fleet-traps.md` before either, and
   start the spec from the exemplar `references/spec-patterns.md` names for its shape. A page object
   exposes locators and intent (`openControlsTab()`, `runRowAction(name, 'Delete')`), waits until its own
   action has taken effect, and may offer a named `expectX()` for a check several specs repeat. The
   assertion that decides the test stays visible in the spec. Grow an existing page object before creating
   a new one, and turn a widget two pages share into a component object in `pages/components/`.
6. **Assert what can fail.** Set membership over hosts you control, never a count on a shared list
   (`toBeGreaterThanOrEqual(hostCount, 2)` passes whatever happens). Confirm through the API that a UI write
   happened. Scope every assertion to records you created. Assert text or a value, never `toHaveScreenshot`
   for behaviour; when a snapshot can't be avoided, the header says why.
7. **Give everything you create a home.** Name per-run things with `ownName(kind)` (packages
   `fleet-pw-*`), and never give a durable thing those prefixes. Register each one's undo with the
   `cleanup` fixture the moment it exists (`cleanup.add('delete label', (r) => deleteLabelById(r, id))`):
   it runs after the test even when it times out, which skips a `finally` (lint fails a `finally` that
   calls the API). `throwawayFleet`, `borrowSims` and `seed.*` register theirs. For a killed run, the sweep (`setup/cleanup.steps.ts`) empties Unassigned and Workstations,
   takes `pw-*` things and borrowed simulations off the VMs fleet and deletes `pw-*` fleets. It returns
   a simulation left on Workstations only between runs, so a spec that stages hosts there still returns
   them itself. It does not return a host moved to QA, restore a config key you changed (only
   the switches `CLAUDE.md` lists), or delete `pw-*` labels on free. What a killed run can leave on the VMs fleet
   needs a home there: the VMs sweep for things Fleet stores by name, the resting-state step for state on a
   host. Reports are swept by exact prefix on VMs and Workstations (gitops declares
   `pw-host-report-results`), so a new kind of per-run report adds its prefix.
8. **Verify, scoped** (next section).
9. **Build in slices, and update the docs in the same commit** (the table below): one concern per commit,
   each green on the instance, so a failure points at one change.
10. **Review your own work** with `playwright-test-reviewer` on the branch's diff, fix what it finds or
    write down why not, then open the PR **against `main`** (never on another open PR's branch) and tell
    Andrey it's ready for its branch run. `references/after-the-pr.md` has the PR description's shape and
    what follows: the branch run's result, fixes after it, lifting a skip, an upgrade's fixes.

## Verifying without disrupting anyone

`npm run check` (tsc + eslint) is the floor, not proof. Lint prints nothing or fails, the suite's own
`suite/*` rules included (`playwright/CLAUDE.md` → Pre-PR check). A green local run is easy to get for the
wrong reason, so:

<!-- shared:scoped-run -->
**A local run is scoped, and never `npm run test:<tier>`.** From `playwright/`:
`npx playwright test --project=<tier> <spec-file-names>`, with `premium` or `free` (both, for anything in
`shared/`), `<tier>-exclusive <file-name>` for an `exclusive/` spec (its own invocation, never beside the main
project), and `npm run test:gitops-mode` for a `gitops-mode/` one. Three things turn a scoped run into
something else:
- `npm run test:<tier> -- <spec>` runs the **whole** suite: npm appends the arguments after the script's
  final `exit`, so no `playwright test` sees them.
- A spec list passed through a shell variable matches nothing and still exits green: the Bash tool's zsh
  doesn't word-split `$VAR`. Type the file names out, and read the run's test count before believing a pass.
- Another run on the instance. `gh run list --limit 5` first: two runs on one VM corrupt each other, and the
  nightly starts hours after its cron. A run **with dependencies** wipes global reports and policies and
  Unassigned's scripts, packages and profiles, so when another session is on the instance, announce the run
  ("<specs> on <tier>, ~N min") and wait for its go.
<!-- /shared:scoped-run -->

- **See it fail once.** A new assertion that has never been red proves nothing: break the expectation, or
  point it at the old behaviour, and watch it fail for the reason you expect. For a fix, run the unfixed
  spec first and keep the failure for the PR.
- **Run once with dependencies** (no `--no-deps`). `cleanup-setup` drains global reports and policies
  before the first test, so a spec leaning on pre-existing data passes with `--no-deps` and fails every
  nightly. If another session can't spare the instance, run `--no-deps` and say in the PR that the branch
  run is the first run with dependencies.
- **Run once headed, and `--repeat-each=5`, for anything that touches UI timing** (a new wait, a menu, a
  modal, a table that reloads). Headless on an idle machine hides render-order races that show under load.
  A change to which API record is read needs neither; say which you skipped and why.
- **`--workers=2`** on anything touching the real VMs, since each VM works one queue and more workers stack
  it into timeouts; **`--output=<scratchpad>/<run>`** so artifacts stay out of the repo. A test that can't
  run beside a copy of itself says so in its header and is repeated on **one** worker
  (`software-lifecycle-on-host` owns a durable VM fixture).
- **On free the real VMs sit in Unassigned.** Pick simulations there by id, never by a filter or *Select all*.
- A gitops-verify change runs through its `npm run test:gitops-verify:<target>` script, which sets `SUITE`
  and `GITOPS_TARGET`.
- **Another session may share the checkout.** Work in your own `git worktree`, and stage by file, never
  `git add -A`. A `gitops-mode` run needs the others' go as well: while it runs, every control is read-only.

## When the product is wrong

<!-- shared:product-bug -->
**A Fleet bug is filed, skipped narrowly and tracked, never coded around in silence.** Search Fleet's issues
first. Tell Andrey what you found and, on his go, file it with the `fleet-qa:fleet-bug-file` skill. Then skip
the **narrowest** failing variant (`test.skip(osKey === 'deb', …)`), with `TODO(fleetdm/fleet#N)` at the site
and a row in `playwright/docs/blocked-by-product-bugs.md`. A flow *adjusted* around an open issue instead of
skipped (a reload before a search, a throwaway fleet) gets the same TODO and a row under "Worked around in
the suite". Lift either only after the flow passes on the fixed build, having seen it fail on the old one.
Two things that look like bugs and aren't: a race only the osquery-perf simulations' bursts can reach is a
data quirk (explain it, route around it, draft no bug unless asked), and a Save or Add button that is now
always enabled is Fleet's design direction (validation moves to submit), so the test is stale.
<!-- /shared:product-bug -->

## Docs move with the code

A change isn't done until the docs describing it are current, in the same commit:

| you changed | update |
|---|---|
| a `test()` | its spec header and `test.step` titles, which the test catalogue will be generated from. `docs/test-audit/` is frozen: no entry to add or update |
| a helper, page object or component object | `helpers/README.md` / `pages/README.md` / `pages/components/README.md` |
| a fixture | its `test-data/` README: what it does, why it's safe on a real VM, how to rebuild it |
| gitops | the file's header and its config's README (`gitops/{premium,free}-fleetqa{,-min}/README.md`); a file both the full and `-min` configs declare changes in both; apply it, and say so in the PR |
| an ignored page error | its `DEFAULT_IGNORED_PAGE_ERRORS` entry (`helpers/console.ts`) carries `TODO(fleetdm/fleet#N)`, plus a row in `docs/blocked-by-product-bugs.md` |
| a rule every spec should follow | `playwright/CLAUDE.md`, and this skill or the reviewer's |
| a skip or workaround owed to a Fleet bug, added or lifted | its row in `docs/blocked-by-product-bugs.md` (moved to **Resolved** when lifted) and the `TODO(fleetdm/fleet#N)` at the site |
| an env-gated or deferred skip | a `TODO.md` row |
| a skill | `bash .github/scripts/check-skills.sh` from the repo root |

## The reference files

Three files sit beside this skill. A long session can drop them from view: re-read them rather than
working from memory.

- `${CLAUDE_SKILL_DIR}/references/fleet-traps.md`: what Fleet's UI, the VMs and the shared instances have
  already done to this suite, each with the helper or pattern that avoids it. A required read, not
  background: **the whole file, before step 5**, before the first locator, wait or helper. It covers
  locators and UI state, waiting, data and state (activity checks, pickers over live data, retries of a
  serial lifecycle, global config and who else writes it), API helpers, and the instances.
- `${CLAUDE_SKILL_DIR}/references/spec-patterns.md`: the spec to copy for each shape of test, and what is
  load-bearing in it.
- `${CLAUDE_SKILL_DIR}/references/after-the-pr.md`: the PR description, the branch run and what follows.

## Code style

- Write comments for a reader who has never seen the previous version: say what the code *does* and why,
  never what changed or what it replaced.
- Spec headers carry the reasoning: why this host, this fleet, this locator, and what breaks if someone
  "simplifies" it. Most of the suite's hard-won knowledge lives in spec headers.

## When you're done

Say what landed (specs, page objects, helpers, docs), what you ran and how it came out (tiers, with deps,
headed, repeats, the failure you saw first), what you did not run and why, and anything that needs Andrey:
approvals, decisions, bugs to file. Keep it short. The PR description is where the detail goes.
