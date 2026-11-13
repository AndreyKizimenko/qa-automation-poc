# Architecture audit: can this suite grow from 1,000 to 5,000 tests?

Audited 2026-11-12 at `a3d5b83`. Static audit: nothing was run against the instances. Six parallel reviews
(premium specs, the tier model with API and CLI specs, page objects, state and cleanup, CI with the run-review
history, the skills) fed this document; every claim marked **verified** was re-checked against the code by
hand, and the rest are marked **reported** or **estimate**.

Out of scope, by agreement: the number of real VMs and the instance's concurrency. Both are being solved
outside the suite. This document is about what the tests and their structure must be ready for when they are.

## Verdict

The layering holds and should not be reworked: folder-routed tiers, page objects with component objects, API
helpers, a self-healing cleanup, the gitops resting state, and specs that read like user flows. Code quality is
high (`tsc` clean, ESLint 0 errors, no `waitForTimeout`, no `networkidle`, 90 of 95 premium specs open with a
header that explains their choices).

What does not survive 5x is a set of **six assumptions the suite makes without saying so**. Each is true at
3 workers, one run at a time and one VM per platform, and each fails when any of those changes. None needs a
rewrite: every fix below is additive and can be adopted one spec at a time.

| # | Assumption baked in today | What breaks it |
|---|---|---|
| 1 | One run owns the instance | shards, a branch run beside a local run, a second contributor |
| 2 | Shared resources are handed out by comments | more specs × more workers; nothing checks a claim |
| 3 | What a test needs (a VM, a global switch) is implicit | per-VM lanes, more VMs, one dead VM failing 55 tests |
| 4 | VM minutes can grow as fast as the suite | VM-bound minutes do not fit at 5x at any worker count |
| 5 | Repair cost follows the number of files, not the number of Fleet changes | every Fleet release |
| 6 | Nobody remembers the last run | flakes recur unrecognised; triage does not scale past one person |

## Working list

This document is the plan of record for the next steps. Items are ticked here as they land; the sections
below hold the reasoning.

**Credentials in public CI artifacts** (found during this audit; see `docs/ci-pipeline.md`)
- [x] PR #131, merged 2026-11-13: every report is encrypted before upload, and the required PR check
      refuses any other upload path.
- [x] The first nightly after the merge (run 43413291769, 2026-11-13, green) uploaded all 16 reports as
      `.tar.gz.enc`, and `fetch_ci_run.sh` decrypted every one.
- [x] No PR or branch run was in flight at the merge. The rule stands for an older branch that is picked up
      again: it merges `main` before its next branch run, because a branch without `.github/upload-report`
      fails at the upload step.
- [x] A copy of the report private key (`~/.config/qa-automation/report-private-key.pem`) is in 1Password.
- [x] The 29 plain suite reports still in retention (30 Oct to 12 Nov) were deleted on 2026-11-13. The 87
      plain gitops-verify and fleetctl reports left to expire were scanned first: none holds a secret.
- [x] Credentials: the instances are being rebuilt on a new server, and the new ones get new credentials.
      None are carried over.
- [ ] Fewer secrets inside reports in the first place: sign in through the API in `loginAsAdmin` instead
      of typing the password (`helpers/auth.ts:32-33`), and check API responses without printing request
      headers (a failed `expect(res).toBeOK()` prints the bearer token). The second overlaps with "helpers
      throw on a non-OK response" in the defects table.

**Small fixes agreed**
- [x] The `fleet-qa` plugin's `fleet-test-plan` skill pointed at `docs/REST API/rest-api.md`; Fleet's docs
      branches have `docs/API/rest-api.md`. Fixed in plugin 1.5.1 (2026-11-13): run the plugin update after
      the merge.
- [x] `playwright/CLAUDE.md`, the plainly stale or missing parts (2026-11-13): which scopes a premium spec
      works in (most work in one; the lifecycles loop over two); `teamDropdown.select` after every scoped `goto`,
      not only in a scope loop; the five stop rules that existed only in the skills (new payload types, the
      web address and IdP, Android web apps, *Store report results*, cron triggers); the runtime row, from
      the 2026-11-13 nightly. The click-through rule is untouched: it waits on D5.
- [x] `fleet-upgrade-preflight`'s blind spots, before the 4.96 upgrade (2026-11-13): Fleet's tests and mocks
      are out of the corpus, a class counts by its bare name too, expected values and constants are in the
      vocabulary, a class built on `baseClass` is checked through its component, and the cache is keyed by
      the corpus rules. Backtested against the suite as it was before each upgrade's fix PR: section 1 went
      from 0, 5 and 2 tokens to 0, 12 and 3, every one real, with the 4.95 false positive gone. That is 0, 7
      and 2 of the 4, 12 and 10 clusters that broke; the rest changed flow, markup or behaviour with their
      text still in the source, so the hand-check stays the larger half of the job.

**Waiting**
- [x] The skills rewrite merged with this document (PR #132, 2026-11-13).
- [x] D2, D3 and D5: yes to each (2026-11-13). D5 and the first half of D3 are applied: `CLAUDE.md` carries
      the rewritten navigation rule, and a test no longer adds a `docs/test-audit/` entry (the folder is
      frozen). D2's tags and D3's generated catalogue are roadmap items 5 and 11.
- [ ] D1's role-matrix and scope-loop pairs, and D4's minute budget per VM platform.

**The order, agreed 2026-11-13.** Sorted by whether a change needs a live run to prove it, and by how many
specs share the code it touches. The 4.96 upgrade is not close, so nothing here waits on it.
1. No run needed. Done: the close-outs, the lint rules, the preflight.
2. Small code changes, each proven by a scoped run:
   - [ ] the fleet dropdown re-opens a menu that closed under it, as its own PR with its own branch run;
   - [ ] helpers throw on a non-OK response without printing request headers, with a short retry in the
         cleanup calls so a transient 5xx doesn't fail setup, and cleanup no longer stops at 200 leftover
         users;
   - [ ] the two spec defects: the fixed-file-name activity match, and `host-delete`'s simulations left on
         Workstations;
   - [ ] an API-level `test` (roadmap 4);
   - [ ] `results.json` and the history file, through the encrypted upload (roadmap 6).
3. Foundations, built now and adopted as specs are touched: roadmap 3, the VM tags of 5, then 10, 8, 7,
   11 and 12.
4. Last: the lanes and the environment gate of 5, then 14, 13, 15 and 16.

**Roadmap items, as they land**
- [x] 2, lint the contract (2026-11-13). Six `suite/*` rules in `eslint-rules/`, each with tests
      (`npm run lint:rules`, part of `npm run check`); `CLAUDE.md` → *Pre-PR check* says what each fails on
      and what to write instead. Lint prints nothing or fails: every rule is an error, `--max-warnings 0`
      covers the rest, and the places that predate a rule are recorded per file in
      `eslint-suppressions.json`, so only a new one fails and the record only shrinks
      (`npm run lint:prune`). A seventh rule, for toast copy, is written and off until item 9 gives that
      copy a home. What the record held on the day (`npm run lint:contract`), which is the number to
      bring down:

      | Rule | Places | Files |
      |---|---|---|
      | class selector in a spec | 30 | 13 |
      | `page.getBy*()` in a browser spec | 52 | 32 |
      | `Date.now()` in a per-run name | 65 | 50 |
      | `assertActivity` without a baseline | 29 | 11 |
      | a helper that drops a non-OK response | 22 | 9 |
      | a skip with no tracking comment, or no reason | 0 | 0 |
      | `any`, `force: true`, hook order, `toHaveLength` (the rules that were warnings) | 40 | 8 |
      | toast copy typed in a spec (rule off, not recorded) | 97 | 49 |

## Baseline

| | |
|---|---|
| Test definitions → nightly executions | about 700 → 1,083 (premium 702 including exclusive and gitops-mode, free 381) |
| Spec files / lines | 225 / 26,885 |
| Page-object and component files / lines | 103 / 12,867 |
| Helper files / lines | 41 / 9,932 |
| Where the definitions sit (reported) | browser 71%, API 46 tests, CLI 44, gitops-verify 35, loadtest 76 |
| Spec files that touch a real VM | 43 |
| Premium runtime | about 125 test-minutes, about 85 of them waiting on real VMs (`CLAUDE.md` facts table) |
| Last 12 scheduled nightlies | 9 green; red on 11-01 (disk full), 11-04 (4.95 upgrade), 11-08 (fleetctl install step) |
| Flake rate (estimate from the run reviews) | about 0.1% of executions, about one flaky test a night |

## 1. One run owns the instance

**What the code assumes.** `setup/cleanup.steps.ts` deletes every global report, policy and pack and every
script, profile and installable title on Unassigned and Workstations, with no prefix filter (verified,
lines 65–166). It runs as a dependency and as a teardown of each main project, so it runs inside every
`playwright test` invocation.

**What breaks.**
- **Shards.** Playwright runs project dependencies and teardowns in every shard. Shard 2's setup, or shard 1's
  teardown, deletes the data of tests still running in the other shards, returns their borrowed simulations
  and uninstalls a VM fixture another shard is asserting on.
- **Overlapping runs.** A local run with dependencies does the same to a branch run. Today a GitHub
  concurrency group and a prose rule (`gh run list` first) prevent it; nothing in the suite does.
- **Snapshot-and-restore of global config** is correct only alone: an overlapping run snapshots the other's
  temporary value and restores it as the original.
- **Names carry no owner.** There are nine naming schemes (`runNonce()`, describe-level `Date.now()` stamps,
  inline stamps, local random helpers, fixed fixture names) and none encodes a run or a worker (reported;
  73 `Date.now()` in specs verified). A sweep cannot tell its own leftovers from another run's live data.
- **Sessions are per machine.** Static-user sessions are cached on disk beside the config, and `POST /login`
  allows 10 a minute for everyone, so N shards each logging in up to 9 users will throttle each other.

**The change.**
1. **One naming helper**, `ownName(kind)`, that returns `pw-<run><worker>-<kind>-<nonce>`, used by every spec.
   A lint rule bans `Date.now()` in names. Small to build, about 130 call sites to migrate mechanically.
2. **A `cleanup` fixture**: a last-in-first-out stack of undo actions that runs in fixture teardown with its
   own API context. Fixture teardown runs after a timeout; a test's `finally` does not, which is why the
   central sweep keeps growing. `create*` and `upload*` helpers register their own undo. This replaces about
   150 hand-written cleanup blocks (82 `finally`, 54 `afterEach`, 19 `afterAll`; reported) and gives a retry a
   clean start.
3. **Move the wipe out of the project graph** when sharding is near: one job runs cleanup before the shards and
   one after; the shards run with login state handed to them. An environment switch in the config is enough.
   Sweeps then delete their own run's names plus any `pw-*` older than a few hours; the wipe-everything pass
   stays in the nightly only.

The central sweep knows 17 name prefixes and 9 special resets today (reported). With items 1 and 2 that list
stops growing with the suite.

## 2. Shared resources are handed out by comments

**What the code does.**
- **Simulations.** A spec borrows hosts by integer offset: `findSimulations(request, 'linux', 2, 0)`. Who owns
  which offsets is a doc comment in `helpers/api/hosts.ts` (verified, lines 271–273, 338–339, 356–376: about
  20 claims). There are 38 call sites in 22 files (reported). The offsets index a live, ordered list that
  `host-delete.spec.ts` shrinks mid-run, so two slices can overlap after a delete (reported, derived from
  code, not observed).
- **Real VMs.** `findOnlineHost` returns the first match by display name (verified, lines 224–255). With three
  VMs per platform every test still lands on the first one while the others idle.
- **Catalog apps and fixed names.** 18 Fleet-maintained-app slugs are "claimed" in spec headers (reported).
- **Global settings.** "One writer per key" is a paragraph in the author skill. Two cross-file collisions
  already exist at 3 workers (reported, not observed as failures): `organization-info` and `custom-logo`
  both save the org name, and `bulk-transfer` asserts the QA fleet holds exactly its 3 hosts while
  `host-transfer-permissions` moves hosts into QA.

**The change.**
1. **A typed registry of claims** in code: one map from a claim key to platform, pool and size; pickers take
   the key, not a number; a check in `npm run check` fails on an overlap or an exhausted pool. Small.
2. **A VM fixture that leases.** `vm('linux')` hands a worker one VM of the platform, partitioned by worker
   index, so the suite uses every VM the day they arrive. Build it before they do. Small.
3. **A config-lock helper**, `withConfigLock(key, fn)`: registers its restore with the cleanup fixture and
   fails fast when two specs declare the same key outside one serial file. Medium.

## 3. What a test needs is implicit

**What the code does.** Nothing machine-readable says "this test needs the macOS VM". There are no tags
(verified), 12 specs name the platform statically and 5 more resolve it at run time (reported). Three costs
follow:

- **One dead VM is dozens of red rows.** 42% of every red or flaky result in the run reviews is a real-VM
  problem, and 158 of those 167 come from three Mac outages (15, 32, 55 and 55 tests in single runs;
  reported). At 5x the same outage is 150 to 275 red rows.
- **No lanes.** `docs/ci-pipeline.md` already concludes that a fourth worker needs "a single-worker lane per
  VM platform", but a lane needs to know which tests are its own.
- **No selection.** "Everything that touches the Mac", or a ten-minute smoke, is a hand-picked file list.

**The change.**
1. **Capability tags, enforced by the fixture.** A VM test is tagged `@vm-macos`, `@vm-windows` or `@vm-linux`,
   and the VM fixture throws when the test asking for a VM does not carry the tag. Folder routing was chosen
   over tags because a tag can be forgotten silently; a tag the fixture checks cannot. Tier stays
   folder-routed.
2. **Per-platform lane projects** that select by tag, each with as many workers as the platform has VMs,
   running beside the main project in the same invocation. The main project excludes the tags.
3. **An environment gate per lane.** A small setup project checks the VM is online, the Apple tokens answer,
   the disk has room and the build is the expected one. Its dependents skip behind it, so one cause is one
   red row with its reason.

## 4. VM minutes can grow as fast as the suite

**Decided 2026-11-12:** this stays a UI suite. API coverage will be a separate suite that can run on its
own, so nothing here moves a browser test to the API. What is left of this section is the VM budget and two
facts about the API specs the repo already has.

**The arithmetic (estimate, from the `CLAUDE.md` measurements).** About 600 browser-only and API tests take
about 40 test-minutes: 4 seconds each. The other 85 minutes come from 43 files that wait on real VMs. So at a
uniform 5x:

- browser-only: about 210 test-minutes, 40 to 55 minutes on 4 to 6 workers. Not a problem.
- VM-bound: about 425 test-minutes, about 200 of them in the single Linux queue. That does not fit in a
  nightly at any worker count; it needs about three leased VMs per platform, or a smaller VM share.
- the exclusive lane: about 70 minutes serial, from 14 today.

**What the code does.**
- Nothing limits how many tests wait on a VM. A browser test that only needs Fleet's server-side decision
  (which hosts a profile or a title reaches) can use a simulation, and many already do; the rest queue.
- **The API specs this repo has open a browser.** Ten API spec files import `test` from `@fixtures`, whose
  automatic `pageHealth` fixture depends on `page`, so each API test launches a page it never uses (verified
  from the fixture code; the time cost is not measured).
- Their role-access "matrix" is 60 hand-written `expectAllow` / `expectDeny` lines; adding a probe means
  editing every role test (reported).
- `serial` is used as a mutex. In premium, 9 of 17 serial blocks have no step that depends on another
  (reported): about 67 executions where one failure skips unrelated siblings, a retry reruns the group, and
  nothing is protected against other files anyway.

**The change.**
1. **A minute budget per VM platform.** A new VM-bound test has to fit inside it, and says in its header why
   a simulation can't answer the question.
2. **An API-level `test`** with worker fixtures, naming and cleanup but no page; the browser `test` extends
   it. Small. It stops the existing API specs launching a browser, and it is the seam along which the
   separate API suite can later be lifted out. Role access as a table belongs to that suite.
3. **`serial` only for closure-shared ids.** A test that needs to be alone goes to `exclusive/` or to a file in
   default mode on one worker, as `software/vulnerabilities.spec.ts` already does.

## 5. Repair cost follows the number of files

Fleet ships every three weeks and each upgrade breaks tests. The cost per broken cause is flat where the
changed thing lives in one place: the Toast component fixed 49 of 61 failures in 4.90 with one edit
(reported). It grows where it does not: spec files edited per upgrade went 3, 4, 6, 8, 21, 17 from 4.90 to
4.95 (reported). Five leaks:

- **Free twins.** 31 free specs have a premium twin and 75% of the free lines exist in the twin (reported).
  55 of the 67 commits that touched a free twin had to change the premium one too (reported). Nine pairs are
  the same file: `settings/users/delete.spec.ts` differs by two comment lines (verified).
- **Shared widgets re-typed per page.** There is no modal component: the modal container selector appears 37
  times in 22 page files (verified). The same holds for react-select (4 components plus about 14 inline
  copies, three different matching rules), the row-action menu (9 sites) and the SQL editor (written twice).
  A regex-escape one-liner is copied 13 times (verified).
- **UI copy as literals.** Toast messages are literal strings 86 times in 45 spec files and 34 times in 23 page
  files (verified). Only activity-feed copy has a single home (`helpers/activity-copy.ts`).
- **Conventions as prose.** ESLint carries only the generic Playwright rules (verified). The suite's own rules
  live in `CLAUDE.md`, five READMEs and three skills, and the copies have started to disagree (three
  different locator-priority lists; three answers to "who files a Fleet bug").
- **Hand-written documentation of every test.** `docs/test-audit/` is 26,125 lines, the size of the spec code
  itself, and each upgrade PR edits 10 to 13 of its files (reported). One of its 2,790 review boxes is ticked
  (verified). It has no entries for the command palette's 13 spec files (reported).

**The change.**
1. **Lint the contract.** Rules with today's violation counts (reported): class locators in specs (31),
   `page.getBy*` in specs (58), toast literals in specs (86), `Date.now()` in names (73), `assertActivity`
   without a baseline (29), helpers that swallow a non-OK response (8). Start as warnings and ratchet. This
   is the cheapest single step, and it is what makes AI-written specs converge.
2. **Shared widget components**: `Modal`, `ReactSelect`, `ActionsMenu`, `SqlEditor`, plus `setSlider()` and
   `pickRadio()`. Small each, internal to page objects, no spec edits. Migrate a widget when an upgrade
   touches it.
3. **A UI-copy module** for toasts on the `activity-copy.ts` pattern, or let each page-object action own its
   toast.
4. **Consolidate the twins where the house rule already says to**: the nine identical pairs go to `shared/`.
   The rest is decision D1.
5. **Generate the test catalogue** from `playwright test --list`, the spec headers and `test.step` titles;
   keep hand-written assessments only where someone reviews them. See decision D3.

Also worth doing here: most components take `page` only (33 of 38; reported), so a screen with two tables
hand-rolls the second. Adding an optional `root` argument, as `TeamDropdown` has, is additive.

## 6. Nobody remembers the last run

**What exists.** CI keeps an HTML report for 14 days. Run reviews are markdown files that are gitignored and
live on one laptop. There is no per-test history, no flake ledger and no quarantine.

**What it costs.** `TeamDropdown.selectByLabel` clicks its trigger once and then clicks an option, with no
retry when the menu closes on a re-render (verified). The run reviews record that race five times between
July and November, twice as a "first occurrence" (reported). It is the most-used component in the suite. At
the current flake rate 5,000 tests means about eight flaky results a night, and without history each one is
triaged from zero.

**The change.**
1. **Emit `results.json`** from the report merge and keep it 90 days. A small script appends one line per
   execution (date, run, build, test, outcome, retries, duration, error hash) to a history file. Small.
2. **Print the history in the job summary**: "failed 4 of the last 14 nights". Then a quarantine list that
   routes named tests to a non-blocking project.
3. **Point the triage scripts at `results.json`.** `parse_report.py` and `run_timeline.py` each decode the
   HTML reporter's private data blob, which has broken once already; a renamed field would produce an empty
   result without an error (reported).

## Defects found on the way

Independent of scale; each is a small fix.

| What | Where | Status |
|---|---|---|
| The fleet dropdown does not re-open a menu that closed under it; five recorded flakes | `pages/components/TeamDropdown.ts` | verified |
| A lifecycle's activity check matches a fixed file name, so the other scope's parallel run satisfies it | `premium/controls/scripts/library.spec.ts`, `os-settings/configuration-profiles.spec.ts` | verified |
| Simulations staged on Workstations stay there when the test fails before its delete; the sweep returns hosts only from the VMs fleet | `premium/hosts/host-delete.spec.ts` | verified |
| Cleanup sweeps return silently on a failed list request, so a 5xx becomes "nothing to clean" | `helpers/api/cleanup.ts`, `software.ts:226`, `mdm.ts` | verified (first two) |
| `findFleetByName` returns `null` on a failed request: reported as "gitops apply likely missing", and an `afterEach` fleet delete is skipped | `helpers/api/fleets.ts:108` | verified |
| Two commits never reached `main`: the deletion of `helpers/catalogs/` (nothing imports it) and the removal of the loadtest hostname from two docs | `origin/docs/full-docs-audit`: `856a21d`, `5f77120` | fixed 2026-11-13: both cherry-picked |
| Two documents give the simulation refresh as 16:00 UTC; the job runs at 09:00 VM-local | `helpers/api/hosts.ts:390`, `docs/test-audit/03-hosts-premium.md:796` | fixed 2026-11-13 |
| A comment says the row-action menu's options carry no test id; Fleet emits `dropdown-option` on them | `pages/labels/LabelsPage.ts:14` | fixed 2026-11-13: the comment says why the class is used |
| Cleanup stops the whole run when more than 200 leftover test users exist | `helpers/api/users.ts:96` | verified |

## Where the written contract and the practice differ

A new author, human or AI, copies the majority. Decide which side is right for each of these and make the
document say it.

| The contract says | The practice is |
|---|---|
| "Each premium spec has Unassigned + Workstations variants" (`CLAUDE.md`) | 11 of 95 premium specs loop over scopes (verified). Settled 2026-11-13: `CLAUDE.md` now describes the practice |
| "Enter through the dashboard and click through" (`CLAUDE.md`) | 34 of 95 premium specs do; 48 never load the dashboard (reported). Settled 2026-11-13 (D5): one click-through test per area, the rest go straight to the page |
| "Assertions live in the spec" (author skill) | page objects hold 585 `expect` calls and 40 `expectX` methods; 86% are state-settling waits (reported) |
| "Cover everything visible, even if no test uses it" (`pages/README.md`) | about 10% of public page-object members are referenced by nothing (estimate) |
| "Every class selector carries an inline comment" (`pages/components/README.md`) | about a third do; another 40% are explained elsewhere in the file (sample of 59) |
| "Throw on a non-OK response" (trap catalogue) | 8 helpers return `null` or an empty list (reported) |

## What to keep exactly as it is

- Tier routing by folder, with no tier branch in any spec body (zero found in `shared/`).
- The config guards that refuse a wrong project pairing or an ambiguous tier.
- Cleanup owned by the suite and self-healing; the VM resting state; the min gitops resting state.
- Exclusive and gitops-mode as separate invocations.
- `goto()` anchored on a ready element in all 60 URL-entry page objects; role-first locators (689 `getByRole`
  against 294 class sites).
- `pageHealth` on every browser test.
- Set-membership assertions over hosts the test controls, and API read-back after a UI write.
- Throwaway `pw-*` fleets for fleet-level writes.
- `HOST_RETRIES`, measured worker counts, the facts table as the one home for numbers that change.
- Spec headers that state the host choice, the cleanup and what breaks if someone simplifies it.
- The blocked-by-product-bugs discipline and evidence-first triage.

## Roadmap

Sizes assume AI-assisted work: **S** up to a day, **M** two to five days, **L** more than a week. Every item
is additive; existing specs keep working and migrate when they are next touched.

**Now, before adding tests**

| # | Item | Size | Unlocks |
|---|---|---|---|
| 1 | Fix the defects table above | S | fewer flakes today |
| 2 | Lint the contract, warnings first | S | convergence of everything written after it |
| 3 | `ownName()` and the `cleanup` fixture, with data fixtures built on them (`throwawayFleet`, `borrowedSims`, `seed.policy/report/script/label`) | M | timeout-safe cleanup, shard-safe names |
| 4 | API-level `test` for the API specs the repo already has | S | no browser per API test; the seam for the separate API suite |
| 5 | VM fixtures with enforced tags, per-platform lanes, the environment gate | M | one red row per outage, lanes, readiness for more VMs |
| 6 | `results.json`, the history file, the summary line | S | flake memory |

**While growing**

| # | Item | Size |
|---|---|---|
| 7 | Shared widget components, migrated as upgrades touch them | S each |
| 8 | Twin consolidation (identical pairs first) | S per pair |
| 9 | UI-copy module for toasts | M |
| 10 | Typed claims registry for simulations and catalog apps | S–M |
| 11 | Generated test catalogue replacing hand-written audit entries | M |
| 12 | `CLAUDE.md` split into a lean core plus nested files per subtree (`setup/`, `gitops-mode/`, `loadtest/`, `cli/`, `api/`) | M |

**When the infrastructure arrives**

| # | Item | Size |
|---|---|---|
| 13 | VM leases across workers and shards | S on top of 5 |
| 14 | Cleanup as pre- and post-jobs; shards; sessions minted once | M |
| 15 | Quarantine project fed by the history | S on top of 6 |
| 16 | Per-worker throwaway fleets for fleet-scoped CRUD, if collisions on Workstations show up | M |

## Decisions that are yours

- **D1. The free twins.** You chose explicit tier siblings over parameterised specs, and accepted their
  duplication, with one exception: duplication where a Fleet rename forces the same edit in both tiers. By
  that test the twins now cost more than they did when you chose: 55 of 67 commits to a free twin had to edit
  the premium one too. Three groups, three answers:
  - *Identical pairs* (nine, such as `settings/users/delete.spec.ts`): move to `shared/`. This is your
    existing rule, not a change to it.
  - *Role-matrix pairs* (eight): free carries the global-role rows of premium's table. Split them the way the
    command palette already is: global roles in `shared/`, fleet-scoped roles in `premium/`.
  - *Scope-loop pairs* (nine): the free spec is the premium lifecycle with the scope fixed. The cost of
    merging them is real: a `shared/` spec that loops over "the scopes this tier has" hides the tier behind a
    helper lookup, and a later free-only difference means splitting it again. I would still merge a
    lifecycle the next time an upgrade forces an edit to both copies, and leave the rest alone. Keeping all
    nine as they are is a defensible answer; it roughly doubles the per-release edits in those files.
- **D2. Tags for capabilities.** **Decided 2026-11-13: yes.** Enforced by the VM fixture as described in section 3. The
  alternative is a file-name suffix per platform, which forces splitting the files that loop over platforms.
- **D3. The test-audit documents.** **Decided 2026-11-13: yes.** Generate the catalogue and stop requiring
  a hand-written entry per test. The requirement is gone as of that day and `docs/test-audit/` is frozen;
  the generator is roadmap item 11.
- **D4. The shape of the 5,000.** Decided 2026-11-12: the 5,000 are UI tests; API coverage is a separate
  suite. Still open: whether each VM platform gets a minute budget that new tests must fit inside.
- **D5. Click-through navigation.** **Decided 2026-11-13: rewrite.** The rule is "one click-through test
  per area; the rest go straight to the page", which is what most specs do. `CLAUDE.md` says so now.

## Limits of this audit

- Nothing was executed. Races and collisions are derived from code unless a run review recorded them.
- Counts marked reported come from a single reviewer's `git grep` and were not all re-run.
- Runtime projections scale the 2026-09-30 and 2026-10-06 measurements linearly.
- Pool sizes on the live instances, and how shards behave against them, were not checked.
