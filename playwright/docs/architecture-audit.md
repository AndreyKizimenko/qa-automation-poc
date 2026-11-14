# Architecture audit: can this suite grow from 1,000 to 5,000 tests?

Audited 2026-11-12 at `a3d5b83`. Static audit: nothing was run against the instances. Six parallel reviews
(premium specs, the tier model with API and CLI specs, page objects, state and cleanup, CI with the run-review
history, the skills) fed this document; every claim marked **verified** was re-checked against the code by
hand, and the rest are marked **reported** or **estimate**.

Out of scope, by agreement: the number of real VMs and the instance's concurrency. Both are being solved
outside the suite. This document is about what the tests and their structure must be ready for when they are.

**Where it stands, 2026-11-13.** Tiers 1 and 2 of the agreed order are on `main`: PRs #133, #134 and #135,
then #139, proven by branch run 43483630012 (697 premium and 368 free tests passed; none failed, was flaky
or was retried). **Tier 3 is built, in PR #141**, which waits on its one branch run: roadmap 3 (`ownName()`,
the `cleanup` fixture and the data fixtures on it), the VM tags of 5, and 7, 8, 9, 10, 11 and 12; the working
list has what each measured. [*Tier 3: the brief*](#tier-3-the-brief) is written for someone who was not
here for the first two. How to read the rest:

- **Working list**: what has landed and what is open. It is the plan of record, and it is kept current.
- **Tier 3: the brief**: what to build next, what is already there, and how work is delivered here.
- **Sections 1 to 6**: the audit as written on 2026-11-12, kept for the reasoning. Each opens with a
  **Since then** line saying what no longer holds. Their counts are the audit day's unless a line says
  otherwise.
- **Roadmap**: every item with its size and its status.

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
- [x] Fewer secrets inside reports, the second half (2026-11-13): every response is checked with `expectOk`,
      which prints no request header, and lint refuses `toBeOK` (a failed one prints the bearer token).
- [ ] Fewer secrets inside reports, the first half: sign in through the API in `loginAsAdmin` instead of
      typing the password (`helpers/auth.ts:32-33`).

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
      frozen). D2's tags and D3's generated catalogue are roadmap items 5 and 11, both built in PR #141.
- [ ] D1's role-matrix and scope-loop pairs, and D4's minute budget per VM platform.
- [ ] Three rows of *Where the written contract and the practice differ* have no answer yet: assertions in
      page objects, page-object members nothing references, and class selectors without a comment.
- [ ] Three changes the sections propose have no roadmap row: the config lock (section 2), `serial` only
      for shared ids (section 4), and an optional `root` on components (section 5). Each needs a place in
      the order or a "no".

**After tier 2, from the review of its branch run (2026-11-13)**
- [x] A run's artifact list is what there is to read: the two suite reports, plus the report of a gitops
      job only when that job failed. It was 16 artifacts a run, 14 of them green gitops reports.
- [x] A free report's skipped count is tests only. The four fleet cleanup steps are declared on premium
      alone; skipped on free, three times a job, they were 12 of free's 13 "skipped".
- [x] Every skip in the two suite reports was checked against its reason. Three wait on open Fleet issues
      (#54622, #54623, #50059, each with its row in `blocked-by-product-bugs.md`). One is a data guard that
      lifts by itself: the Windows "updates when it is behind" test runs on the nights Fleet's catalog is
      ahead of the VM, and its sibling asserts the Update / Reinstall state every night. One stood on a
      wrong reason:
- [ ] `shared/packs/packs.spec.ts` → "pack query executes on targeted host", skipped since May on a 405
      that was the test's own wrong path, and unsound with the path fixed (it reads a simulation's random
      stats). Rewrite it on a real VM or delete it; `TODO.md` has both. Andrey's call.

**The order, agreed 2026-11-13.** Sorted by whether a change needs a live run to prove it, and by how many
specs share the code it touches. The 4.96 upgrade is not close, so nothing here waits on it.
1. No run needed. **Done** (PRs #133, #134, #135): the close-outs, the lint rules, the preflight.
2. Small code changes, each proven by a scoped run. One PR for the tier, one commit per concern, so one
   branch run covers them. **Done** (PR #139, branch run 43483630012) but for its last line:
   - [x] the fleet dropdown re-opens a menu that closed under it;
   - [x] helpers check a response with `expectOk`, which prints no header, and throw where they used to
         return nothing; cleanup no longer stops at 200 leftover users. No retry was added: the cleanup
         projects inherit CI's two retries, so a transient 5xx is already retried a step at a time;
   - [x] the two spec defects: the fixed-file-name activity match, and `host-delete`'s simulations left on
         Workstations;
   - [x] an API-level `test`, `apiTest` (roadmap 4);
   - [x] `results.json` in each suite report, kept 90 days, and the history file the run reviews keep from
         it (`run_history.py`); the first half of roadmap 6.
   - [x] The rest of roadmap 6: the history in CI's job summary. Decided 2026-11-13: the report key goes
         in as an Actions secret, for one job, instead of a public history branch. `run-history` is the last
         job of the nightly and of a branch run; `docs/ci-pipeline.md` says what it may print.
   - [ ] `parse_report.py` and `run_timeline.py` still read the HTML report's embedded data; pointing them
         at `results.json` is its own change.
3. **Built, in PR #141.** Foundations, built now and adopted as specs are touched: roadmap 3, the VM tags
   of 5, then 10, 8, 7, 9, 11 and 12. [*Tier 3: the brief*](#tier-3-the-brief) has each one. One PR for
   the tier, one commit per concern, and one branch run once the last item was in (Andrey, 2026-11-13).
4. Last: the lanes and the environment gate of 5, then 14, 13, 15 and 16.

Roadmap 9, a home for toast copy, was left out of this order when it was agreed; it joined tier 3, beside
item 7, on 2026-11-13.

**Roadmap items, as they land**
- [x] 1, the defects table (2026-11-13): every row is fixed. Three rows in tier 1, six in tier 2.
- [x] 2, lint the contract (2026-11-13). Six `suite/*` rules in `eslint-rules/`, each with tests
      (`npm run lint:rules`, part of `npm run check`); `CLAUDE.md` → *Pre-PR check* says what each fails on
      and what to write instead. Lint prints nothing or fails: every rule is an error, `--max-warnings 0`
      covers the rest, and the places that predate a rule are recorded per file in
      `eslint-suppressions.json`, so only a new one fails and the record only shrinks
      (`npm run lint:prune`). A seventh rule, for toast copy, is written and off until item 9 gives that
      copy a home. What the record held on the day it was made, and what it holds after tier 2
      (`npm run lint:contract` prints today's). The last column is the number to bring down:

      | Rule | Places on the day | Files | Places after tier 2 |
      |---|---|---|---|
      | class selector in a spec | 30 | 13 | 30 |
      | `page.getBy*()` in a browser spec | 52 | 32 | 52 |
      | `Date.now()` in a per-run name | 65 | 50 | 65 |
      | `assertActivity` without a baseline | 29 | 11 | 24, in 9 files |
      | a helper that drops a non-OK response | 22 | 9 | 0: 21 throw, one says why on its directive |
      | a skip with no tracking comment, or no reason | 0 | 0 | 0 |
      | `any`, `force: true`, hook order, `toHaveLength` (the rules that were warnings) | 40 | 8 | 40 |
      | toast copy typed in a spec (rule off, not recorded) | 97 | 49 | 97 |

- [x] 3, `ownName()` and the `cleanup` fixture (2026-11-13, PR #141). `ownName(kind)` names a thing
      `pw-<kind>-<run>-w<worker>-<nonce>`; the run is `PW_RUN_ID`, which the config sets once per
      invocation (the workflow run in CI), so a leftover says which run and worker made it, and the
      sweeps' prefixes still match. `cleanup` on `apiTest` runs a test's undo actions after it, newest
      first, a timed-out test included: on free, a test that created a user and then timed out left the
      user when it deleted it in a `finally`, and didn't when it registered the delete with `cleanup`.
      `throwawayFleet`, `borrowSims` and `seed.label` / `policy` / `report` / `script` name what they make
      and register their own undo. Five specs use them (`historical-data-collection`,
      `policy-label-targets`, `deep-links`, `custom-variables`, `api/free/license`), and two rules send new
      code there: `suite/use-own-name` (115 places recorded, 104 after the five) and
      `suite/no-api-cleanup-in-finally` (73 recorded, then 69); `Date.now()` names went from 65 to 61.
      The bulk sweeps that logged a failed delete and went on now send every delete and then throw naming
      what stayed (`deleteEach`), so an undo built on one fails when it should.
- [x] 4, an API-level `test` (2026-11-13): `apiTest` in `fixtures.ts` carries the worker fixtures and no
      page, and the browser `test` extends it. The ten API specs that imported `test` launch no browser
      now, and lint refuses the browser `test` under `tests/api`, `tests/cli` and `tests/loadtest/api`.
- [x] 5, the VM tags (2026-11-13, PR #141). A test that needs a real VM carries `@vm-macos`,
      `@vm-windows` or `@vm-linux`, and `requireRealHost` and `liveMacosHost` refuse one without its VM's
      tag. All 52 test declarations that reach a picker are tagged: 59 tests in `premium`, 3 in
      `premium-exclusive`, 24 in `free`, 1 in `free-exclusive`, so `--grep @vm-macos` selects what one Mac
      outage takes down. Lint allows no other tag. The lanes and the environment gate are tier 4.
- [x] 6 (2026-11-13): each suite report carries `results.json` and is kept 90 days; `run_history.py` keeps
      a line per test per reviewed run and says how a failing test fared before; and the `run-history` job
      writes the same into every nightly's and branch run's summary, from the 14 nightlies before it.
      Still open: the quarantine that would act on it (item 15).
- [x] 7, shared widgets (2026-11-13, PR #141): `fleetModal(page, title)` (VariablesPage, LabelsPage,
      PacksListPage), `ReactSelect` (the dashboard's platform and chart-dataset dropdowns), `ActionsMenu`
      (FleetsPage, FleetUsersPage), `SqlEditor` (report and policy editing), `setSlider` and `pickRadio`
      (PoliciesListPage, FleetMaintainedAppsPage, IntegrationsPage, TargetLabelSelector). No spec changed.
      Lint keeps each widget's selector in its component: modal 25 places in 15 page objects recorded,
      react-select 15 in 10, the row menu 11 in 5, the SQL editor none left.
- [x] 8, the twins that are one flow (2026-11-13, PR #141): re-derived, the same four (reports/automations,
      settings/organization/organization-info, settings/users/delete, software/vulnerability-automations)
      moved to `shared/`; their tests have new ids. The other 27 pairs wait on D1.
- [x] 9, toast copy (2026-11-13, PR #141): `toastCopy` in `helpers/toast-copy.ts`, each entry citing where
      Fleet renders it; three specs use it, and `suite/no-toast-copy-in-spec` is on with 86 places in 43
      files recorded.
- [x] 10, the claims registry (2026-11-13, PR #141): 38 simulation claims from 22 specs in five pools and
      20 catalog apps; pool sizes measured on both tiers; `npm run lint:claims` in `npm run check`. It found
      one claim past its pool (batch-schedule-cancel's macOS window on premium), now recorded as the 5 hosts
      it needs.
- [x] 11, the catalogue (2026-11-13, PR #141): `npm run catalogue` writes `docs/test-catalogue/` (gitignored)
      from `playwright test --list`, the spec headers and the `test.step` titles: 843 tests in 196 spec files.
- [x] 12, the `CLAUDE.md` split (2026-11-13, PR #141): nested files for `setup/`, `tests/api/`,
      `tests/cli/`, `tests/loadtest/` and `tests/e2e/premium/gitops-mode/`; the core keeps every section the
      skills cite and is 47.0 kB, from 52.1.

## Tier 3: the brief

Written 2026-11-13 for whoever takes tier 3 without having seen tiers 1 and 2. Read these first, in this
order: `playwright/CLAUDE.md`, whole (the suite's contract; its *Pre-PR check* is how lint works here);
sections 1, 2, 3 and 5 below (why each thing is built); `docs/ci-pipeline.md` before touching a workflow.
Invoke the `playwright-test-author` skill before writing code, and read the files it requires.

**What tier 3 is.** Foundations: helpers, fixtures and structure that new specs use from the day they land,
and that old specs move to when someone next edits them. None of it needs the new server, more VMs or
shards; what does is tier 4. A foundation is done when:

- it is built, and a test of its own or a deliberate break has shown it failing for the reason it exists;
- a few specs chosen to exercise it use it, and the PR names them. The suite is not migrated in one PR.
  The exception is anything a fixture enforces (the VM tags): that covers every test it applies to on the
  day it is switched on;
- new code can only go the new way: a lint rule or the fixture says so, with what to write instead, and
  `CLAUDE.md` carries the rule;
- the docs that teach the old way are changed in the same commit (`CLAUDE.md`, the READMEs under
  `helpers/` and `pages/`, the author skill's `fleet-traps.md` and `spec-patterns.md`);
- its line in the working list is ticked, with the numbers measured.

**The items, in order.** "There today" was counted on 2026-11-13 at `c9af972`. Every item is built in PR
#141 (the working list has what each measured), and the rows stay as the brief was written.

| Roadmap | Build | There today | Watch for |
|---|---|---|---|
| **3** `ownName()`, the `cleanup` fixture, data fixtures on top (M) | One naming helper that carries run and worker. A fixture that holds a stack of undo actions and runs them in its own teardown, with an API context of its own, so a timed-out test still cleans up. Then `throwawayFleet`, `borrowSims` and `seed.*` built on both. Its proof is a test that creates something and then times out: nothing is left, where the `finally` it replaces leaves it. Section 1 | `runNonce()` in `helpers/profiles.ts`, which lint sends new names to; 65 recorded `Date.now()` names in 50 files; in specs, 82 `finally`, 55 `afterEach` and 19 `afterAll` | The sweep in `setup/cleanup.steps.ts` finds leftovers by prefix (`pw-*`, `fleet-pw-*`, `PW_VAR_*`, `pw-enroll-`, `qa-test-*`), and reports only by exact prefix, because gitops declares reports beside them: `pw-run-script-`, `pw-rl-` and `pw-stored-results-` on VMs, which also holds gitops's `pw-host-report-results`, and `pw-role-` on Workstations. A new name shape and the sweep change in one commit. A job is up to three `playwright test` invocations and the config is evaluated again in every worker, so the run part comes from the environment (`GITHUB_RUN_ID`, or a value the config sets once with `??=`), never from a value minted per process. The fixture goes on `apiTest`, so API and CLI specs get it. When `ownName()` exists, `suite/no-date-now-in-name` and its row in `CLAUDE.md` point at it |
| **5, tags only** (part of M) | `@vm-macos`, `@vm-windows`, `@vm-linux` on every test that waits on a real VM, and the picker refusing a test that asks for a platform it isn't tagged for. Section 3, D2 | No tag anywhere. 43 spec files use a VM picker: `requireRealHost` 27, `liveMacosHost` 9, `vmsFleetId` 28, `kind: 'real'` 2 | Enforcement needs every VM test tagged in the same commit. `vmsFleetId` alone is not a VM wait: a spec can use the VMs fleet for what Fleet decides server-side. A test generated by a loop over platforms takes its tag from the loop. `liveMacosHost` is a worker fixture, with no test to read tags from. **Not in tier 3:** lane projects and the environment gate. `playwright.config.ts`' projects and the workflows stay as they are |
| **10** claims registry (S–M) | A typed map from a claim to its platform, pool, offset and size; pickers take the claim, not a number; a check in `npm run check` that fails on an overlap or an exhausted pool. Catalog-app slugs claimed in spec headers go in as well. Section 2 | The registry is a doc comment in `helpers/api/hosts.ts`; 26 call sites of the three simulation finders in 16 spec files | The offsets index a live, ordered list that `host-delete.spec.ts` shrinks during a run |
| **8** twins, identical pairs first (S a pair) | Move to `shared/` the pairs that are one flow. Section 5, D1 | Of 31 free specs with a premium twin at the same path, **one** is identical once comments are stripped (`settings/users/delete`), and **three** differ only by the tier word in the describe title and a `teamDropdown.select('All fleets')` that does nothing on free (`software/vulnerability-automations`, `settings/organization/organization-info`, `reports/automations`). The "nine" in section 5 was one reviewer's count | Re-derive the list before moving anything. A moved file takes its `eslint-suppressions.json` entry along: rename the key. Its tests get new ids, so the run history sees them as new: say so in the PR. The other 27 pairs wait on D1 |
| **7** shared widgets (S each) | `Modal` first, then `ReactSelect`, `ActionsMenu`, `SqlEditor`, `setSlider()`, `pickRadio()`, each internal to page objects. Section 5 | `.modal__` selectors on 38 lines of 23 files under `pages/`; 39 files in `pages/components/`, none of them a modal base | No spec edits. Move two or three page objects to each widget as proof and leave the rest for the upgrade that next touches them |
| **11** generated catalogue (M) | A script that writes the test catalogue from `playwright test --list`, the spec headers and `test.step` titles. Section 5, D3 | `docs/test-audit/`, frozen on 2026-11-13: nothing updates it | Ask first whether the output is committed or built on demand: a committed one changes in every PR that touches a test |
| **12** `CLAUDE.md` split (M) | A lean core and a nested file per subtree (`setup/`, `gitops-mode/`, `loadtest/`, `cli/`, `api/`) | One file of about 340 lines | Last, because every other item edits it. A nested file loads only when work happens under its folder, so the real-host stop rules and the facts table stay in the core. The skills and docs cite its sections by title: search for `CLAUDE.md` before renaming one |

**How work is delivered here.** Each line cost a round trip to learn.

- **One PR for a batch, one commit per concern**, based on `main`, never on another open PR. Proposed
  batches: (A) item 3; (B) the tags and item 10; (C) items 8 and 7; (D) items 11 and 12, which change no
  suite code. Item 3 is a batch of its own either way; confirm the rest with Andrey before opening the
  second. A PR opens as a draft and fills up.
- **Andrey dispatches the full run.** A PR that changes the suite gets one `QA — Branch run` (about 65
  minutes). Open the PR, say it is ready, and say `--ref <branch>` when it changes a workflow file.
  Merging is his word too.
- **Local runs are scoped**: the specs that changed, on each tier they run on, after `gh run list` shows
  the instances idle. Once with dependencies; `--workers=2` on anything that waits on a VM.
- **See it fail first.** A new check that has never been red proves nothing. For a change to `fixtures.ts`,
  which every spec imports: the same test ids before and after (`npx playwright test --project=<p> --list`
  for each project), then one browser spec, one API spec and one VM spec on each tier.
- **Lint prints nothing or it fails.** No rule is a warning. `eslint-suppressions.json` records the places
  that predate a rule and only shrinks (`npm run lint:prune` after fixing one). A new rule's first record
  is made once, in the commit that adds the rule and for that rule only
  (`npx eslint . --suppress-rule suite/<rule>`); a rule that can't say what to write instead isn't
  switched on (`suite/no-toast-copy-in-spec` is written and off for that reason).
- **This stays a UI suite.** Never move a browser test to an API spec, and never branch on the tier inside
  a spec: tiers are folders, and free coverage is a goal of its own.
- **The repository is public.** No instance hostname, token or credential in a commit. A report holds live
  credentials: reports leave CI encrypted, and nothing from one's request headers or typed values goes
  into a PR, an issue or a review. `bash .github/scripts/check-artifacts.sh` before a workflow change.
- **The stop rules in `CLAUDE.md` come before any plan here**: what may reach a real VM, the standing
  fleets, the global settings nobody saves. When a step looks like one of them, ask.
- **This document is the plan of record.** Tick the working list as things land, and write what was
  measured, not what was intended.

**Settled with Andrey on 2026-11-13:** all of tier 3 in one PR with one branch run at the end; roadmap 9 in
tier 3; the catalogue built on demand, not committed. **Still to settle:** D4's minute budget, which the
tags make measurable (`--grep @vm-linux` with `run_timeline.py`); D1 for the other 27 twin pairs; and the
three changes that have no roadmap row (the working list names them).

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

**Since then (2026-11-13).** Changes 1 and 2 below are built (roadmap 3, PR #141): `ownName()` and the
`cleanup` fixture, which five specs use and lint sends new code to (`suite/use-own-name`,
`suite/no-api-cleanup-in-finally`). The older names and `finally` blocks move when their specs are next
edited: 104 and 69 places. Change 3, the wipe out of the project graph, is roadmap 14 (tier 4).

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

**Since then (2026-11-13).** The registry is built (roadmap 10, PR #141): `helpers/claims.ts` holds every
simulation and catalog-app claim, the pickers take a claim's key, and `npm run lint:claims` fails on an
overlap or a claim past its pool. The lease is 13 (tier 4). The config lock has no roadmap row; the
`cleanup` fixture it needs exists now.
`host-delete.spec.ts` returns the simulations it stages when it fails before its delete, but it still
deletes hosts, so the offsets still index a list that shrinks.

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

**Since then (2026-11-13).** The tags are built (D2, PR #141): every test that needs a real VM carries
`@vm-macos`, `@vm-windows` or `@vm-linux`, and `requireRealHost` and `liveMacosHost` refuse one that doesn't.
The lanes and the environment gate are tier 4.

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

**Since then (2026-11-13).** The API specs launch no browser: `apiTest` is in `fixtures.ts` (roadmap 4), and
on the branch run free's 35 API tests took 3.1 s where they had taken 8.9. The minute budget is still D4,
and the `serial` blocks used as a mutex are untouched and have no roadmap row.

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

**Since then (2026-11-13).** *Conventions as prose* is answered: the contract is linted (roadmap 2), as
errors over a recorded baseline rather than as warnings, and the working list has the counts.
`docs/test-audit/` is frozen (D3), so an upgrade PR no longer edits it. The twins were counted again: one
pair is identical once comments are stripped, three more differ only by the tier word in a describe title
and a dropdown call that does nothing on free, and "nine" was one reviewer's count; those four are in
`shared/` now. The widgets (`fleetModal`, `ReactSelect`, `ActionsMenu`, `SqlEditor`, `setSlider`,
`pickRadio`), the toast-copy home with its rule on, and the generated catalogue are built (PR #141).

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

**Since then (2026-11-13).** *What exists* no longer holds. Each suite report carries `results.json` and
is kept 90 days. `run_history.py` keeps a line per test per run, and the `run-history` job writes how each
failed or flaky test fared in the 14 nightlies before into the run's summary (roadmap 6). The dropdown
re-opens a menu that closed under it. Open: the quarantine (15, tier 4), and the two triage scripts, which
still read the HTML report's embedded data.

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
| The fleet dropdown does not re-open a menu that closed under it; five recorded flakes | `pages/components/TeamDropdown.ts` | fixed 2026-11-13: each attempt opens the menu if it is closed, clicks the option and reads the label back, and one that didn't take is made again |
| A lifecycle's activity check matches a fixed file name, so the other scope's parallel run satisfies it | `premium/controls/scripts/library.spec.ts`, `os-settings/configuration-profiles.spec.ts` | fixed 2026-11-13: each step is keyed to an id taken before it and to its fleet |
| Simulations staged on Workstations stay there when the test fails before its delete; the sweep returns hosts only from the VMs fleet | `premium/hosts/host-delete.spec.ts` | fixed 2026-11-13: the spec's hook and the Workstations sweep both return them |
| Cleanup sweeps return silently on a failed list request, so a 5xx becomes "nothing to clean" | `helpers/api/cleanup.ts`, `software.ts:226`, `mdm.ts` | fixed 2026-11-13: they throw, with 21 other places that dropped a non-OK answer |
| `findFleetByName` returns `null` on a failed request: reported as "gitops apply likely missing", and an `afterEach` fleet delete is skipped | `helpers/api/fleets.ts:108` | fixed 2026-11-13: `null` means not found, and a failed request throws |
| Two commits never reached `main`: the deletion of `helpers/catalogs/` (nothing imports it) and the removal of the loadtest hostname from two docs | `origin/docs/full-docs-audit`: `856a21d`, `5f77120` | fixed 2026-11-13: both cherry-picked |
| Two documents give the simulation refresh as 16:00 UTC; the job runs at 09:00 VM-local | `helpers/api/hosts.ts:390`, `docs/test-audit/03-hosts-premium.md:796` | fixed 2026-11-13 |
| A comment says the row-action menu's options carry no test id; Fleet emits `dropdown-option` on them | `pages/labels/LabelsPage.ts:14` | fixed 2026-11-13: the comment says why the class is used |
| Cleanup stops the whole run when more than 200 leftover test users exist | `helpers/api/users.ts:96` | fixed 2026-11-13: it deletes however many match |

## Where the written contract and the practice differ

A new author, human or AI, copies the majority. Decide which side is right for each of these and make the
document say it.

| The contract says | The practice is |
|---|---|
| "Each premium spec has Unassigned + Workstations variants" (`CLAUDE.md`) | 11 of 95 premium specs loop over scopes (verified). Settled 2026-11-13: `CLAUDE.md` now describes the practice |
| "Enter through the dashboard and click through" (`CLAUDE.md`) | 34 of 95 premium specs do; 48 never load the dashboard (reported). Settled 2026-11-13 (D5): one click-through test per area, the rest go straight to the page |
| "Assertions live in the spec" (author skill) | page objects hold 585 `expect` calls and 40 `expectX` methods; 86% are state-settling waits (reported). **Unsettled** |
| "Cover everything visible, even if no test uses it" (`pages/README.md`) | about 10% of public page-object members are referenced by nothing (estimate). **Unsettled** |
| "Every class selector carries an inline comment" (`pages/components/README.md`) | about a third do; another 40% are explained elsewhere in the file (sample of 59). **Unsettled** |
| "Throw on a non-OK response" (trap catalogue) | 8 helpers return `null` or an empty list (reported). Settled 2026-11-13: 22 places were found, 21 throw, and one best-effort clean-up says why on its lint directive |

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

| # | Item | Size | Unlocks | Status, 2026-11-13 |
|---|---|---|---|---|
| 1 | Fix the defects table above | S | fewer flakes today | done |
| 2 | Lint the contract, warnings first | S | convergence of everything written after it | done, as errors over a recorded baseline |
| 3 | `ownName()` and the `cleanup` fixture, with data fixtures built on them (`throwawayFleet`, `borrowSims`, `seed.policy/report/script/label`) | M | timeout-safe cleanup, shard-safe names | done (PR #141); specs move to it as they are touched |
| 4 | API-level `test` for the API specs the repo already has | S | no browser per API test; the seam for the separate API suite | done |
| 5 | VM fixtures with enforced tags, per-platform lanes, the environment gate | M | one red row per outage, lanes, readiness for more VMs | tags built (PR #141); lanes and gate tier 4 |
| 6 | `results.json`, the history file, the summary line | S | flake memory | done |

**While growing**

| # | Item | Size | Status, 2026-11-13 |
|---|---|---|---|
| 7 | Shared widget components, migrated as upgrades touch them | S each | built (PR #141): six, two or three page objects each |
| 8 | Twin consolidation (identical pairs first) | S per pair | the four that are one flow moved (PR #141); the rest on D1 |
| 9 | UI-copy module for toasts | M | built (PR #141): `toastCopy`, and its rule on |
| 10 | Typed claims registry for simulations and catalog apps | S–M | built (PR #141) |
| 11 | Generated test catalogue replacing hand-written audit entries | M | built (PR #141): `npm run catalogue` |
| 12 | `CLAUDE.md` split into a lean core plus nested files per subtree (`setup/`, `gitops-mode/`, `loadtest/`, `cli/`, `api/`) | M | done (PR #141) |

**When the infrastructure arrives**

| # | Item | Size | Status, 2026-11-13 |
|---|---|---|---|
| 13 | VM leases across workers and shards | S on top of 5 | tier 4 |
| 14 | Cleanup as pre- and post-jobs; shards; sessions minted once | M | tier 4 |
| 15 | Quarantine project fed by the history | S on top of 6 | tier 4; the history it reads exists |
| 16 | Per-worker throwaway fleets for fleet-scoped CRUD, if collisions on Workstations show up | M | tier 4 |

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
  the generator is roadmap item 11, built in PR #141 as `npm run catalogue` (on demand, not committed).
- **D4. The shape of the 5,000.** Decided 2026-11-12: the 5,000 are UI tests; API coverage is a separate
  suite. Still open: whether each VM platform gets a minute budget that new tests must fit inside.
- **D5. Click-through navigation.** **Decided 2026-11-13: rewrite.** The rule is "one click-through test
  per area; the rest go straight to the page", which is what most specs do. `CLAUDE.md` says so now.

## Limits of this audit

- Nothing was executed for the audit itself. Races and collisions are derived from code unless a run review
  recorded them. What the working list ticks was run: each tick names its PR, run or measurement.
- Counts marked reported come from a single reviewer's `git grep` and were not all re-run.
- Runtime projections scale the 2026-09-30 and 2026-10-06 measurements linearly.
- Pool sizes on the live instances, and how shards behave against them, were not checked.
