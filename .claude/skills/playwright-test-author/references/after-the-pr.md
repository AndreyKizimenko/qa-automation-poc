# The PR, and what follows it

For playwright-test-author. The work isn't finished when the specs pass locally: it's finished when the PR
says what was proven, the branch run is green or explained, and `main` holds the commits. This file covers
that half.

Contents: Before opening · The description · The branch run · Fixes after the run · Lifting a skip ·
A Fleet upgrade's fixes · After "merged"

## Before opening

- **Base it on `main`.** Never on another open PR's branch, even when that PR touches the same files: a
  stacked PR has twice merged into the feature branch instead of `main`, and the work looked merged when it
  wasn't. If a stack can't be avoided, say so first.
- A long-lived branch merges `main` in and re-runs what the merge touched before the PR opens.
- Scratch specs written for a negative control are deleted.
- Commit subjects say what the code now does (`edit-package.spec: a retry starts from a clean library`).

## The description

Andrey reads it to decide whether to dispatch a run and what to look at when it finishes. Use these
headings, in this order, and drop one only when it would be empty.

```
<what this changes and why, in two or three lines; the Fleet build (version and revision) it was verified on>

**Changes a workflow file: dispatch with `--ref <branch>`.**        ← only when true, and at the top

## Why
For a fix: the run (link), the test, its retry pattern, the verdict, and the Fleet PR or state behind it.

## What changed
Per concern. New coverage: a table of test → what it covers. An upgrade: Fleet change → what broke → fix.

## Fleet bugs
Filed #N, with the skip or workaround and its row in blocked-by-product-bugs.md. Skips lifted, and how each
was seen passing. Or "None".

## Docs
READMEs, CLAUDE.md, skills, spec headers. Or "None".

## Verified
`npm run check`. Per tier: with dependencies, or `--no-deps` and why; headed; repeats as N/N; workers.
The failure seen first (the negative control, or the unfixed spec's run). That the instance was left clean.
**Not run:** what, and why.

## Branch run
Whether it needs `--ref`. After the run: its id, per-tier counts, the verdict table, the fix commits.

## Left for later
```

"Not run" is the line that gets left out and matters most: an untested path stated plainly costs nothing,
and one discovered in the nightly costs a red night.

## The branch run

Andrey dispatches it. Tell him the PR is ready, and give him the command when it isn't the plain one:

```
gh workflow run "QA — Branch run" -f branch=<branch>                    # the usual form
gh workflow run "QA — Branch run" --ref <branch> -f branch=<branch>     # the PR changes a workflow file
```

Without `--ref`, a run uses `main`'s workflow files and only the tests come from the branch.

A branch run isn't always needed. For a change to one assertion that the scoped runs fully exercise, say so
and leave the call to him.

When the run finishes, triage it with `playwright-run-reviewer`, then put the result in the PR's
**Branch run** section: the run id, passed / failed / flaky / skipped per tier, the verdict table, and what
you did about each row. The PR page is the record; a result that lives only in the conversation is lost.

## Fixes after the run

- A failure the branch caused is fixed on the branch, in its own commit, and the section gains the commit.
  A second run follows when the fix touches what failed.
- A failure the branch didn't cause goes to its own PR. Name it in the section so the red row is explained.
- One session integrates a PR's branch. When two sessions' batches share a PR for a single run, the second
  pushes its commits to the first's branch and says so: there is no second PR.

## Lifting a skip, dropping a workaround

A fix merged upstream isn't a fix on the instance. Lift a skip, or remove a workaround, when:

1. the instance runs a build that contains the fix (`GET /api/latest/fleet/version`'s revision, compared
   with the fixing commit), whatever the issue's state says;
2. the flow passes un-skipped, repeated as many times as it takes to beat the old failure rate ("16/16 on
   each tier; it failed 8/16 on 4.94");
3. for a client-side fix, it was seen failing on the old client, so the test really tells the two apart.

Then delete the `TODO(fleetdm/fleet#N)` at the site, move the row in
`playwright/docs/blocked-by-product-bugs.md` to **Resolved**, and say so in the PR.

## A Fleet upgrade's fixes

An upgrade breaks tests in clusters: one renamed heading takes thirty tests with it. Work by cause, not by
test.

1. `fleet-upgrade-preflight` first. Its scan is a floor: add its hand-check, area by area.
2. Run the affected specs unmodified on the upgraded instance. That list of failures is the baseline the PR
   is judged against.
3. Group the failures by the Fleet change behind each (the Fleet PR or commit). A serial describe hides the
   steps after its first failure, so the count of red tests understates what broke.
4. Fix each cause where it lives: one page object or component, not each spec. If the same copy or selector
   needed editing in several specs, that's a finding for the PR's "Left for later".
5. Lift the skips and drop the workarounds this release fixed (previous section).
6. Update the build row in `playwright/CLAUDE.md`'s facts table.
7. The PR's "What changed" is the table: Fleet change → what broke → fix. Map the red nightly's failures onto
   it, so every one is accounted for.

## After "merged"

Check that the commits reached `main`, not that the PR says MERGED:

```
git fetch origin && git merge-base --is-ancestor <commit> origin/main && echo on main
```
