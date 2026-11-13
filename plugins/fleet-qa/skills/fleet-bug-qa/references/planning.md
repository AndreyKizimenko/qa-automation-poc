# Understand, verify, plan (steps 1–3)

For fleet-bug-qa; fleet-bug-retest scales the matrix down. Read it at the start of the run, before
the first call to an instance. `tours.md` is fleet-explore's and `instance-traps.md` is
fleet-story-qa's; the SKILL.md that sent you here gives their paths.

## 1. The bug, down to its mechanism

Read the issue (body + comments), the PR description and the **full diff**.

**Finding the fix PRs** when none is linked: `gh issue view <N> -R fleetdm/<fleet|security> --json
closedByPullRequestsReferences`; the PRs that mention it (`gh api --paginate
repos/fleetdm/<fleet|security>/issues/<N>/timeline --jq '.[] | select(.event=="cross-referenced" and
.source.issue.pull_request) | "\(.source.issue.html_url) \(.source.issue.title)"'`);
`gh pr list -R fleetdm/fleet --search "<N>" --state all`; and `git log --all --grep '<N>'`. Always pass
`-R`: without it `gh` uses whatever repo the shell is in. Security reports live in
`fleetdm/security`; their fix PRs land in `fleetdm/fleet`.

Be able to state:

- what the user saw, and **why it happened** in code (file:line);
- what the fix changes, and every entry point that reaches the changed code: UI, REST API (all version
  prefixes), fleetctl, GitOps/batch endpoints, crons, osquery/orbit/MDM check-ins. Grep for callers of
  changed functions; a fix applied in one entry point and not another is the most common way fixes are
  incomplete.

Take names from the code, not the ticket prose: cookie names, headers, params and endpoint paths in
reports are often stale or paraphrased, and replaying a wrong name fails silently. Likewise verify any
commit hashes quoted in comments exist (`git cat-file -e`); triage comments sometimes cite hashes that
don't.

For security reports also state the trust boundary crossed (which role / team / unauthenticated caller
got what). **Every vector the ticket or its comments name is in scope as core**, including ones added
later in the thread.

**No fix PR?** Find what changed instead: `git log --oneline <pre-rev>..<fix-rev> -- <files that render
or handle the affected surface>`. That list is also mandatory when a PR exists but the bug lives in
shared code (a component, a middleware): another change in the range may matter more than the PR. If
nothing in range touches the surface, the instances may not bracket the fix.

## 2. The environments

`env_check.sh <pre-fix-ctx> <fixed-ctx> <fix-sha> [<cherry-pick-sha>]` prints each instance's version,
branch, revision, license and MDM, and whether it contains each commit.

The pre-fix instance must *not* contain the fix and the fixed one must. If the fix predates the pre-fix
instance (or there is no identifiable fix), the two instances can't show a before/after. Tell the
engineer, and propose a baseline: a local container from an older image already on the machine
(`docker images | grep fleet`; `fleet-gotchas.md` § Local baselines), or asking them to redeploy
`previous` at an older version.

Note the license tier and which MDM platforms are configured. The pre-fix instance is an **earlier
branch**, not "fixed minus this PR": it differs by every change in between, which matters when
classifying findings.

## 3. The matrix: core, regression, halo

Write it to `qa-<N>/plan.md`. Three kinds of rows. Aim for coverage, not count: each row should be
able to catch something the others can't. Size the matrix to the bug. An edge case few customers can
reach gets its core rows and the regressions the diff makes plausible; a fix in a shared path earns
more. An over-built matrix on an edge-case fix once produced four side findings, and the engineer
dropped all four.

- **Core** — the issue's repro as written, then variants attacking the same mechanism: each entry
  point from step 1, edge inputs (empty, malformed, the limit and the limit + 1, unicode, duplicates:
  plausible values from the catalog in `tours.md` § 1, including the API pushing past what the form
  allows), alternate payload shapes (the optional field omitted, `null` vs missing, `fleet_id=0` vs no
  param: `tours.md` § 3), each relevant platform, global vs fleet vs "no fleet", each role. For a bug
  in a form or modal, the interruption probes too (`tours.md` § 5): Save twice fast, Enter inside a
  multi-field form, Back or reopen right after saving. For security fixes: the report's exploit
  verbatim, then bypass attempts (other endpoints reaching the same data, other roles, team-scoped
  users against other teams, ID guessing, encoding). When the fix introduces a token or session, probe
  its lifecycle: unknown, expired, reused after it should be consumed, replayed from another client.
- **Regression** — what the fix could have broken. The mirror image of the fix: a tightened check →
  legitimate callers still pass; a changed query → its other consumers; a changed shared component →
  its other screens.
- **Halo** — adjacent workflows a user touches around this feature: list/detail pages, activities,
  GitOps round-trip, the same feature on another platform.

Borrow from `tours.md` the values and probes a row needs, not whole tours.

**Hosts.** Prefer osquery-perf whenever the behavior is server-side: fast, repeatable, identical on
both instances (flags and templates in `fleet-gotchas.md`). Real devices are needed when device-side
behavior is the point (profile actually installed, agent UI, APNs/AMAPI round-trip).

**Coverage decisions are binary.** If a case has value, it gets covered: create the data, or ask the
engineer for what you can't create. If it has no value, drop it and don't mention it. A "not covered"
list only confuses the reader, so there is none in the comment.

**Test data** can be created freely (users, fleets, secrets, scripts, realistic sensitive-looking
values) because it all gets cleaned up. Append an undo line to `created.txt` for **every** object as
you create it (the line format is in `cleanup.sh`'s header), including hosts, background PIDs,
worktrees and containers. For role testing create **API-only users**
(`POST /api/v1/fleet/users/api_only`): they return a token directly, so no password is typed. They
can't log into the UI; UI-by-role is in `instance-traps.md` § Auth. Never rewrite `/me` in the
browser to fake a role.

Keep secrets out of files where possible (pass enroll secrets and tokens via env vars). If a driver
needs them on disk, keep that file inside `qa-<N>/`, never in `/tmp`, and don't paste them into
RESULTS.md.

Write drivers as re-runnable scripts parameterized by context: the same driver runs against both
instances, and a rerun after a fix-of-the-fix is free.

**The ask.** Ask the engineer once, batched, for anything you can't set up yourself or reach through
a full-path simulation: a real device in a specific fleet, a CA, an IdP login, a third-party
integration, a license or global-setting change on a shared instance, a redeploy. Anything a **core**
row needs goes in this ask (one real IdP sign-in to mint a session whose expiry and reuse you then
test) rather than settling for "covered by the PR's tests". List each item, which instance, and why
the alternative won't do. Share the plan outline in the same message. If nothing is needed, share the
outline and proceed without waiting.
