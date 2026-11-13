---
name: playwright-test-reviewer
description: "Review Playwright test code in Fleet's QA suite (`playwright/` in qa-automation): a branch's test changes before its PR, a spec or page object someone points at, or an audit of an area. Use it for 'review my branch' when the branch changes the suite, 'self-review before the PR', 'review this spec', 'review this page object', 'audit the policies specs', 'check for brittle selectors', and whenever playwright-test-author says to review your own work. It reads source, not run results: for 'why did this run fail' or 'flake or real bug', use playwright-run-reviewer. Not for writing the tests (playwright-test-author)."
---

# Reviewing tests in Fleet's QA suite

Review like the senior engineer who'll be paged when the nightly goes red. The expensive defects in this
suite aren't style: a test that locks a real VM, a test that passes without testing anything, and a test
that leaves state behind for tomorrow's run. Find those first. Then ask what the change costs when the suite
is five times its size, because every pattern merged today is copied by the next author.

Read two files before you open the diff. `playwright/CLAUDE.md` is the contract you review against.
`${CLAUDE_SKILL_DIR}/../playwright-test-author/references/fleet-traps.md` is the catalog of traps the
author was told to avoid (`playwright-test-author` itself is the rest of what they were told). **Every
trap in it is a review check**, and this skill repeats only a few: an action on a locator that may not
exist, a guard that answers before the page settles, an absence check on a menu that never opened, a
"signed-out" context that is still the admin, a toast that matches the first save, a closed modal taken
as proof the save landed, an activity check that isn't keyed to this test, a host wait on the wrong
field, an empty multipart field.

## Scope

- **Default: the current branch's changes.** `git diff main...HEAD --stat`, then read each changed spec,
  page object, helper, fixture and doc in full (not just the hunks), plus what the change calls into.
  If the diff touches `playwright/eslint-suppressions.json`, the record may only shrink: a count that
  grew, or a new entry that isn't a moved file's, is a finding, and so is an `eslint-disable` with no reason.
- **A named file or area:** review that, and follow its page objects and helpers far enough to judge them.
- **The whole suite:** only when asked; it's a different job (sample, then group findings by pattern,
  and count the mechanical ones so the audit has numbers: fixed sleeps, `force: true`, class selectors
  without a comment, skips without a `TODO(fleetdm/fleet#N)`, tests with no assertion on data they
  created).

Verify before you report. Open the React component or server code a finding depends on (the Fleet
checkout: `$FLEET_REPO`, else `../fleet` beside this repo; `frontend/`, `server/`, `ee/`,
`docs/API/rest-api.md`), and probe the live page with the Playwright MCP when a locator's correctness
turns on what renders. A finding you haven't checked is a question. Say so rather than asserting it.

## Blockers — report these first, whatever else you find

A change that does any of these is a blocker, whatever its tests show. None can be undone from a test.

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

One more blocker, of a different kind: **host-side behaviour asserted against a simulation.** Software
inventory, script output, profile delivery or verification, certificates and agent versions need a real VM.
Simulations answer every live query with the same canned row, pass every policy, and fake their script and
install results. (Server-side decisions, like which hosts a profile is listed for or which are offered a
title, a simulation answers correctly. Don't flag those.)

## What to check

**Does the test test anything?**
- Assertions that can't fail: counts on shared lists (`toBeGreaterThanOrEqual(n, 2)`), "at least one row",
  a `toPass` whose body can't throw, every assertion inside an `if`. The fix is set membership over records
  the test controls.
- A UI write whose result isn't confirmed through the API.
- An activity assertion that another test can satisfy: `assertActivity` on a name both scopes of a loop use,
  with no `latestActivityId` baseline and no fleet in the match.
- `toHaveScreenshot` standing in for a behaviour check: assert the text or value instead. A snapshot that
  can't be avoided needs its reason in the header.
- A spec that relies on data it didn't create. `cleanup-setup` drains global reports and policies before
  the first test, so it passes with `--no-deps` and fails every nightly.
- A discovery helper that turns a non-OK response into `null` or `[]` and the caller into a skip or a
  no-op: an infra 500 becomes a silent pass. A helper throws on a non-OK response.
- Plain `.sort()` on numbers (it sorts as strings), and comparisons that depend on list order the API
  doesn't promise.
- A new assertion the PR doesn't say was ever seen failing.

**Reads that don't retry.** Web-first assertions retry until they pass or time out; these don't, so a
test built on them passes or fails on timing:
- `locator.all()` and `allTextContents()` snapshot the DOM at one instant. Assert the count with
  `toHaveCount` first, then iterate; compare text with `toHaveText`.
- `isVisible()` / `isEnabled()` / `count()` answer for one instant. Never the assertion, and as a guard
  for an optional element only after waiting for one of the two states: a guard that runs early takes the
  "absent" branch and the helper silently does nothing.
- `page.evaluate()` bypasses auto-waiting and locators; it isn't for assertions.
- `waitForSelector` returns an `ElementHandle` that goes stale on re-render; use a locator.
- try/catch as flow control waits out the full timeout and hides the real error.
- `force: true` skips actionability: acceptable only for a visually hidden control, with the reason in a
  comment. `nth()` only inside a small, stable container.
- `getByText('Delete')` also matches *Delete all* and *Undelete*: `exact: true`, or a role with a name.
- Conditional logic in a test body (`if` on API data, a loop that may run zero times) gives the test more
  than one shape, and each shape is a case it may silently skip.

**Will it leave state behind, or collide?**
- Cleanup that a timeout skips. A timed-out test runs its hooks and its fixtures' teardown, not its
  `finally`, so new code registers each undo with the `cleanup` fixture right after the thing exists (lint
  fails a `finally` that calls the API; an `afterEach` is the older way and still sound). A recorded
  `finally` is enough only for what the sweep (`setup/cleanup.steps.ts`) would catch: things on Unassigned
  and Workstations, `pw-*` / `fleet-pw-*` things and borrowed simulations on the VMs fleet, `pw-*` fleets.
  Anything else needs one of the two: a host moved to Workstations or QA, a config key, a `pw-*` label on
  free, a report on VMs or Workstations whose prefix the sweep doesn't list. An undo registered before the
  thing exists, or one that fails on "already gone".
- Per-run names not from `ownName(kind)` (lint fails a `pw-` name built by hand), a kind that isn't unique
  per scope in a loop, or a durable thing that carries the `pw-` prefix.
- Global config changed without an `afterEach` restore keyed to the test that changed it, restoring only
  the keys it wrote; a key or a fleet's whole subtree that another spec also writes (`git grep` the key
  before accepting a new writer); a switch flipped in the main project that belongs in `exclusive/`.
- A count or an "exactly these hosts" assertion on a standing fleet other specs move hosts into.
- Shared mutable state between tests, except a serial lifecycle's closure-shared ids.

**Does it scale?** Each of these is cheap to fix in review and expensive once copied.
- A helper, page-object method or locator that duplicates one that exists (`pages/index.ts`,
  `helpers/api/<area>.ts`), or a shared widget's selector (modal container, react-select, row-action menu,
  Ace) typed into a page instead of the component that owns it.
- A new spec file that is one more row of an existing table: a role, a platform, a paywalled page, a
  validation case.
- A real-VM test of something a simulation answers: VM minutes are what bounds the nightly. (Don't
  suggest moving a browser test to the API, though: this suite covers the UI, and API coverage is to be a
  suite of its own.)
- `mode: 'serial'` on tests that share no id: one failure skips the rest. Tests that only must not overlap
  use `mode: 'default'` in one file. And a serial lifecycle whose first step can't run again over its own
  failed attempt's leftovers.
- A simulation slice with no claim in the registry comment on its picker, or overlapping one.
- UI copy (a toast, a heading, an activity sentence) typed as a literal in a spec when a page object or
  `activityCopy` holds it: one more file to edit the day Fleet rewords it.
- A time budget copied as a bare number with another spec's comment, and a file that parallel workers
  write in place.

**Tier coverage**
- A premium spec whose behaviour also exists on free, with no `shared/` placement or `free/` sibling. Check
  the component's `isPremiumTier` and the server's `premium:"true"` / license checks before claiming it does.
- A `free/` spec whose body is its premium sibling's, with no scope or behaviour difference: it belongs in
  `shared/`.
- `if (isPremium)` in a spec. A tier switch lives in a helper or page object, keyed on `SUITE`.
- Don't recommend folding a free and a premium spec into one parameterised file: explicit siblings are the
  house choice, and their duplication is accepted. Flag it only where one Fleet rename would force the same
  edit in both, and then the fix is to move that piece (copy, a selector) into a helper or page object.

**Locators and page objects**
- Locators grounded in the React source, not just the rendered DOM. Order: `getByRole` with a name, then
  `getByLabel`, `getByPlaceholder`, `getByText`, then a test id Fleet already ships; a class selector last.
- Brittle selectors: long CSS chains, `nth-child`, xpath, implementation details.
- Page objects: intent-level methods, locators centralised, each action waiting until it has taken effect.
  A named `expectX()` for a check several specs repeat is fine; the assertion that decides the test is
  visible in the spec. A widget two pages share belongs in `pages/components/`. Abstractions that make a
  test harder to read are a finding too.
- Duplicated setup or login that should be a fixture or storage state.

**Class selectors.** One is legitimate when Fleet's component offers no role, label, text or test id, and
a comment says so (beside it, or once for the component). The recurring cases: modal containers (Fleet's
`Modal` has no `role="dialog"`), react-select controls and values (the accessible combobox is hidden),
Ace editor internals, and role-less wrappers (cards, `.empty-state`, `.loading-overlay`, a live run's
result blocks). Flag these:
- a class with no explanation anywhere in the file, or where a role or text would work;
- a dropdown *option* matched by class: Fleet's `DropdownWrapper` and `ActionsDropdown` put
  `data-testid="dropdown-option"` on theirs (the fleet dropdown's and the label filter's options carry
  none, so those are fine);
- any class selector in a spec.

**Docs that should have moved with the code** (findings, not blockers): a spec header or a `test.step`
title that no longer says what the test does (`docs/test-audit/` is frozen, and needs no entry); a new helper, page object or component object missing from
`helpers/README.md` / `pages/README.md` / `pages/components/README.md`; a new fixture without a `test-data/`
README; a gitops change without its file header and config README
(`gitops/{premium,free}-fleetqa{,-min}/README.md`), or made to only one of the full and `-min` copies of a
file both declare; a skip, a workaround or a `DEFAULT_IGNORED_PAGE_ERRORS` entry owed to a Fleet bug without
its `docs/blocked-by-product-bugs.md` row and `TODO(fleetdm/fleet#N)`; a PR description that doesn't say
what was not run.

## Reporting

Lead with what is wrong. No praise section, and no finding softened into a suggestion: where you disagree
with how the author did something, say so and say why.

Rank findings most severe first: **blocker**, then **high** (the test passes without testing, or will hang
or strand state), **medium** (flake risk, brittle locator, missing free coverage, a pattern that won't
scale), **low** (readability, structure), then **docs**. For each: the file and line, what's wrong, the
concrete failure it causes (inputs or state → wrong outcome), and the fix. Show code only when the fix isn't
obvious from one sentence. Say plainly what you checked and found fine when the author will want to know
(for example, "the cleanup sweep covers everything this spec creates").

**If the `ReportFindings` tool is available, report through it:** one call, verified findings only, most
severe first. Otherwise print the ranked list. Don't pad: no findings for things that are fine, no
restating the code back.

When asked to fix what you found, apply the fixes, re-run the scoped checks the author skill describes, and
report the outcome of each finding.

## Comments in code you write

Describe what the code *does*, never what changed or what it replaced. The reader hasn't seen the old
version.
