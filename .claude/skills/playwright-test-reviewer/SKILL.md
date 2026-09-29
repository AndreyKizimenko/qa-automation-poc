---
name: playwright-test-reviewer
description: Review Playwright test code in Fleet's QA suite (`playwright/` in qa-automation) — a branch's changes before its PR, a spec or page object someone points at, or an audit of an area. Use it for "review my branch", "self-review before the PR", "review this spec/POM", "audit the policies specs", "check for brittle selectors", and whenever playwright-test-author says to review your own work. It reads source, not run results — for "why did this run fail / flake or real bug", use playwright-run-reviewer.
---

# Reviewing tests in Fleet's QA suite

Review like the senior engineer who'll be paged when the nightly goes red. The expensive defects in this
suite aren't style: a test that locks a real VM, a test that passes without testing anything, and a test
that leaves state behind for tomorrow's run. Find those first. `playwright/CLAUDE.md` is the contract you
review against, and `playwright-test-author` is what the author was told.

## Scope

- **Default: the current branch's changes.** `git diff main...HEAD --stat`, then read each changed spec,
  page object, helper, fixture and doc in full (not just the hunks), plus what the change calls into.
- **A named file or area:** review that, and follow its page objects and helpers far enough to judge them.
- **The whole suite:** only when asked; it's a different job (sample, then group findings by pattern).

Verify before you report. Open the React component or server code a finding depends on
(`~/repositories/fleet/frontend/`, `server/`, `ee/`, `docs/REST API/rest-api.md`), and probe the live page
with the Playwright MCP when a locator's correctness turns on what renders. A finding you haven't checked
is a question. Say so rather than asserting it.

## Blockers — report these first, whatever else you find

1. **A configuration profile that could lock a real host, delivered to one.** Passcode payloads
   (`com.apple.mobiledevice.passwordpolicy`, `forcePIN`, `minLength`, `maxInactivity`, `allowSimple`),
   screen lock, inactivity timeout, FileVault, login-window restrictions, anything disabling SSH, remote
   management or MDM. **Uploading is delivering:** on free, Unassigned holds the real VMs and the reconciler
   delivers within 30 s, so a lifecycle spec that deletes the profile a step later still reaches them. Flag
   any committed profile fixture that isn't inert (the suite's are `test-data/{apple/macos,windows}/profiles/fleet-pw-inert.*`),
   and any **new payload type** delivered to a VM without a note that Andrey approved it.
2. **A setting that updates, reboots or locks a real host, set where one can receive it:** an OS-update
   minimum version or deadline, a DDM software-update declaration, Recovery Lock password enforcement. On
   premium, that's the VMs fleet. On free, it's any global setting, because the free VMs sit in Unassigned.
   The one approved exception: `recovery-lock.spec.ts` turning Recovery Lock on for the VMs fleet, provided it
   turns it off in an `afterEach` and the resting-state step still turns it off after a dead run.
3. **Host-side behaviour asserted against a simulation.** Software inventory, script output, profile
   delivery or verification, certificates and agent versions need `kind: 'real'`. Simulations ignore
   live-query SQL, return no rows ~20% of runs and never install anything. (Server-side decisions, like which
   hosts a profile is listed for or which are offered a title, a simulation answers correctly. Don't flag
   those.)
4. **Durable fixtures changed or deleted:** the VMs fleet's software in `helpers/vm-fixtures.ts` /
   `vms.yml` (resting state: uninstalled), a gitops-declared fleet renamed, static users edited.

## What to check

**Does the test test anything?**
- Assertions that can't fail: counts on shared lists (`toBeGreaterThanOrEqual(n, 2)`), "at least one row",
  a `toPass` whose body can't throw. The fix is set membership over records the test controls.
- A UI write whose result isn't confirmed through the API.
- A spec that relies on data it didn't create. `cleanup-setup` drains global reports and policies before
  the first test, so it passes with `--no-deps` and fails every nightly.
- A discovery helper that turns a non-OK response into `null` and the caller into a skip: an infra 500
  becomes a silent pass.
- Plain `.sort()` on numbers (it sorts as strings), and comparisons that depend on list order the API
  doesn't promise.

**Will it hang, flake or leave state behind?**
- An action or read on a locator that may not exist (`click`, `fill`, `innerText`, `getAttribute` have no
  timeout): the test hangs to its timeout, and its `finally` then runs on a closed context, so its cleanup
  never happens.
- Exact-name locators on names that change under state: tabs that gain a count (*Controls 1*,
  *Policies 3*, *Upcoming 1*), a field label replaced by its error, hover-revealed row actions acted on
  without `clickHoverAction`.
- Acting on a list row without a search that narrows to it. Lists page at 20, and other specs crowd them.
- `waitForTimeout`, fixed sleeps, `networkidle`, or reading a table before `waitForSettled()`.
- Host waits: waiting on `software_updated_at` (moves only when inventory changes), requesting a refetch
  without `waitForNoPendingRefetch` first, or a VM wait whose budget outlasts the test's timeout.
- Cleanup: everything created is removed in a `finally`, *and* anything that could survive a timed-out
  test on the VMs fleet has a home in `setup/cleanup.steps.ts` (the VMs sweep for things stored by name, the
  resting-state step for host state). Per-run names start `pw-*` / `fleet-pw-*`; durable ones don't.
  Borrowed simulations go back.
- Shared mutable state between tests, except CRUD lifecycle specs (`describe.configure({ mode: 'serial' })`
  with closure-shared ids, per `CLAUDE.md`). Global config changed without a restore inside the same test,
  or flipped by a main-project spec when it belongs in `exclusive/`.
- A multipart helper that may send an empty-string field. Playwright drops it, and Fleet answers 200 and
  changes nothing.

**Tier coverage**
- A premium spec whose behaviour also exists on free, with no `shared/` placement or `free/` twin. Check the
  component's `isPremiumTier` and the server's `premium:"true"` / license checks before claiming it does.
- `if (isPremium)` branches inside one spec: the house rule is `shared/` or an explicit sibling.

**Locators and page objects**
- Locators grounded in the React source, not just the rendered DOM. Order: `getByRole` with a name, then
  `getByLabel`, `getByPlaceholder`, `getByText`; a class selector only with an inline comment saying why
  nothing else works.
- Brittle selectors: long CSS chains, `nth-child`, xpath, implementation details.
- Page objects: one responsibility, intent-level methods, locators centralised, assertions left to the spec;
  a widget two pages share belongs in `pages/components/`. Abstractions that make a test harder to read.
- Duplicated setup or login that should be a fixture or storage state.

**Docs that should have moved with the code** (findings, not blockers): a `test()` with no
`docs/test-audit/` entry or stale audit counts; a batch file whose *What landed* doesn't list the spec; a new
helper or page object missing from `helpers/README.md` / `pages/README.md`; a new fixture without a
`test-data/` README; a skip owed to a Fleet bug without its `docs/blocked-by-product-bugs.md` row and
`TODO(fleetdm/fleet#N)`.

### Class selectors that are legitimate

A class selector with an inline comment explaining why Fleet's component offers nothing better is fine.
Known examples:
- modal containers: Fleet's `Modal` has no `role="dialog"`;
- react-select triggers, v5 (`.team-dropdown__control`, `.label-filter-select__control`) and v1 (`.Select-*`
  in `PackEditPage` and `TargetLabelSelector`'s dropdown);
- `.actions-dropdown-select__*` row menus;
- section and card wrappers (`.host-activity-card`, `.software-installer-card`);
- `.empty-state` and `.loading-overlay`;
- `.data-table__tooltip-truncated-text`.

react-select v5 *options* should use `data-testid="dropdown-option"`, which Fleet does emit. Still flag a
class selector with no comment, and one where a role- or text-based locator would have worked.

## Reporting

Rank findings most severe first: **blocker**, then **high** (the test passes without testing, or will hang
or strand state), **medium** (flake risk, brittle locator, missing free coverage), **low** (readability,
structure), then **docs**. For each: the file and line, what's wrong, the concrete failure it causes (inputs
or state → wrong outcome), and the fix. Show code only when the fix isn't obvious from one sentence. Say
plainly what you checked and found fine when the author will want to know (for example, "the cleanup
sweep covers everything this spec creates").

**If the `ReportFindings` tool is available, report through it:** one call, verified findings only, most
severe first. Otherwise print the ranked list. Don't pad: no findings for things that are fine, no
restating the code back.

When asked to fix what you found, apply the fixes, re-run the scoped checks the author skill describes, and
report the outcome of each finding.

## Comments in code you write

Describe what the code *does*, never what changed or what it replaced. The reader hasn't seen the old
version.
