---
name: fleet-bug-qa
description: QA a Fleet bug fix or security-report fix end to end against two live instances — a pre-fix one and a fixed one — by first reproducing the problem on the pre-fix instance, then verifying the fix plus regression and halo coverage, with API drivers, osquery-perf hosts, parallel agents and UI screenshots. Produces a short, copiable ticket comment (verdict + test matrix) and a separate decision list of everything else it found, classified by origin, for the QA engineer to triage. Use whenever the user asks to QA, verify, test, or confirm the fix for a specific Fleet issue or PR — "QA #51234", "verify the fix for this bug", "test this security report", "confirm PR #53900 fixes it", "check this bug on prev and RC" — including security reports in fleetdm/security. Do NOT use for release-wide migration runs, a bug-escape audit, code review of a PR without live testing, QAing a new feature story with no bug to reproduce (fleet-story-qa), or a small quick-win / copy / new-parameter change with nothing to reproduce (fleet-quickwin-qa).
---

# Fleet bug / security-fix QA

The goal is a verdict you would stake your name on: the bug demonstrably existed,
the fix demonstrably removes it, nothing nearby broke, and anything odd you tripped
over is written down with where it came from.

The confidence comes from the **before/after**. A case that passes on the fixed
instance proves nothing unless the same case failed on the pre-fix instance — a
test that can't fail isn't a test. So every core case runs on the pre-fix instance
first. This is QA of product behavior: the evidence is live, and the PR's unit and
integration tests are the engineers' concern — they come in only as a fallback when
a live repro is impossible (4b).

There are two audiences, and they get different documents:
- **`RESULTS.md`** (local) is the lab notebook — setup, mechanism, drivers,
  payloads, automated-test runs, everything needed to trust or rerun the work.
- **The ticket comment** is for a manager asking "is it fixed, and how broadly
  was it checked?" — a verdict line and the matrix, plus only the findings the QA
  engineer chose to include. Nothing else. (Step 8.)
- **The decision list** (chat only) is for the QA engineer: every finding, so they
  decide what's worth filing or mentioning.

## Inputs

- The issue (bugs: `fleetdm/fleet`; security reports: `fleetdm/security` — the
  fix PRs land in `fleetdm/fleet`).
- The fix PR(s). If none are linked: `gh issue view <N> --json
  closedByPullRequestsReferences,timelineItems`, `gh pr list --search "<N>" --state
  all`, and `git log --all --grep '<N>'`. If there is still nothing, see step 1.
- Two instances, as fleetctl contexts in `~/.fleet/config`: the pre-fix one and the
  fixed one, as `.claude/fleet-qa.local.md` names them (usually **`previous`** and
  **`default`**). The user may name others. Tokens for every context are in
  `~/.fleet/config`; the scripts read them directly and never print them.

## Local setup

Read `.claude/fleet-qa.local.md` first: this machine's instances, Fleet checkout, QA
workspace, databases, logs and role users. If it doesn't exist, create it before
anything else, per `references/local-setup.md`. It's gitignored, and it holds no
tokens.

## Tooling (in this skill's `scripts/`)

| Script | Use |
|---|---|
| `fleetapi.sh <ctx> <METHOD> <path> [json \| -F k=v ...]` | Authenticated REST call; `-F` for multipart uploads (software, profiles); `FLEET_TOKEN=` to act as another user |
| `env_check.sh <pre-ctx> <fix-ctx> <sha>...` | Version/branch/revision/license/MDM of both instances, and whether each contains the given commit(s) |
| `screenshot.mjs <ctx> <path> <out.png> [...]` | Headless logged-in PNG. `--clip sel`, `--click text`, `--focus sel`, `--type text`, `--cookie K=V`, `--token`, `--anon`, `--caret`. Run with no args for help |
| `pw.mjs` | `import { open } from '<skill>/scripts/pw.mjs'` — the same cookie login for multi-step Playwright drivers |
| `stack.py <out.png> <a.png> <b.png> ... [--side] [--gap N]` | Combine screenshots into one PNG in reading order (top to bottom; `--side` for narrow clips) |
| `cleanup.sh <manifest> [--run]` | Lists (default) or undoes, newest first: `api`, `pid`, `worktree`, `docker`, `file` lines |
| `encode_deviceinfo/main.go` | Self-signed Apple deviceinfo blob for driving Apple enroll endpoints (usage in its header) |

Read `references/fleet-gotchas.md` once before building test data — it covers
osquery-perf behavior, count aggregation, shared instances and other traps that
cost earlier runs time.

Work in `<QA workspace>/qa-<N>/` (the local file names the workspace): drivers, `RESULTS.md`,
`issue-comment.md`, `screenshots/`, and `created.txt` (the cleanup manifest).
Write drivers as re-runnable scripts parameterized by context — the same driver
runs against both instances, and a rerun after a fix-of-the-fix is free.

## Evidence: run the real code path — simulated or real — or ask

A case counts only when Fleet's own code for it ran, on both instances, from the
entry point a user would hit. Three ways to get there, in this order:

1. **Simulate the whole path** whenever that covers the case — it costs nobody's
   time, so it comes first: osquery-perf hosts enrolling through the real endpoints
   (desktop, iPhone/iPad over MDM, Android), API-only users for API role checks, a
   real API call against a simulated host to put it in a state (a real wipe or lock
   command leaves it "pending"), `fleetctl trigger` for crons. The test: would any
   production code on this case's path behave differently if the host, user or
   state were real? If not, the simulation is the real thing. Look for the most
   realistic route before settling for less (no osquery-perf template for a
   platform? the agent's real enroll request, `POST /api/v1/osquery/enroll`, still
   runs Fleet's enrollment; a hand-inserted host row doesn't). Where the real thing
   already exists (a device in the right state, a setting already on), use it
   read-only.
2. **Ask the user** for whatever a simulation can't reach and you mustn't do
   yourself — on both instances when the before/after needs it: a license switch,
   an MDM toggle, an org setting, a real UI session as a role, a device action, a
   third-party console, a redeploy. It goes in the batched ask (step 3). Don't
   decide for them that it's too disruptive or already covered by the PR's tests;
   that's their call.
3. **A fallback only with their go-ahead** — they say the real setup can't be done,
   or that a fallback is good enough for this case. Propose the specific one — PR
   tests without the fix (4b), a hand-inserted DB row, an intercepted response for
   an error nobody can trigger — and what it skips; once they agree, mark the row
   as such (`➖ proven by PR tests`), never as a plain ✅.

Faking what Fleet says isn't evidence of a bug or of a fix: rewriting responses in
the browser (`page.route` to change the license, the viewer's role, a setting or a
host's state) only shows how the frontend reacts to data Fleet may never send, and
reading the code shows what should happen, not what does. Don't close with "worth
confirming on a real device" either — if it would change the verdict, it belonged
in the ask.

## Workflow

### 1. Understand the bug down to its mechanism

Read the issue (body + comments), the PR description and the **full diff**. Be
able to state:
- what the user saw, and **why it happened** in code (file:line);
- what the fix changes, and every entry point that reaches the changed code — UI,
  REST API (all version prefixes), fleetctl, GitOps/batch endpoints, crons,
  osquery/orbit/MDM check-ins. Grep for callers of changed functions; a fix applied
  in one entry point and not another is the most common way fixes are incomplete.

Take names from the code, not the ticket prose — cookie names, headers, params and
endpoint paths in reports are often stale or paraphrased, and replaying a wrong
name fails silently. Likewise verify any commit hashes quoted in comments exist
(`git cat-file -e`); triage comments sometimes cite hashes that don't.

For security reports also state the trust boundary crossed (which role / team /
unauthenticated caller got what). **Every vector the ticket or its comments name
is in scope as core**, including ones added later in the thread.

**No fix PR?** Find what changed instead: `git log --oneline <pre-rev>..<fix-rev> --
<files that render or handle the affected surface>`. That list is also mandatory
when a PR exists but the bug lives in shared code (a component, a middleware) —
another change in the range may matter more than the PR. If nothing in range
touches the surface, the instances may not bracket the fix (step 2).

### 2. Verify the environments

```bash
scripts/env_check.sh previous default <fix-sha> [<cherry-pick-sha>]
```

The pre-fix instance must *not* contain the fix and the fixed one must. If the
fix predates the pre-fix instance (or there is no identifiable fix), the two
instances can't show a before/after — tell the user, and propose a baseline: a
local container from an older image already on the machine (`docker images | grep
fleet`), or asking the user to redeploy `previous` at an older version.

Note license tier and which MDM platforms are configured. The pre-fix instance is
an **earlier branch**, not "fixed minus this PR" — it differs by every change in
between, which matters for classifying findings (step 7).

### 3. Build the test plan

Three kinds of rows. Aim for coverage, not count — each row should be able to catch
something the others can't.

- **Core** — the issue's repro as written, then variants attacking the same
  mechanism: each entry point from step 1, edge inputs (empty, malformed, max
  length, unicode, duplicates), each relevant platform, global vs fleet vs "no
  fleet", each role. For security fixes: the report's exploit verbatim, then
  bypass attempts (other endpoints reaching the same data, other roles, team-scoped
  users against other teams, ID guessing, encoding). When the fix introduces a
  token or session, probe its lifecycle: unknown, expired, reused after it should
  be consumed, replayed from another client.
- **Regression** — what the fix could have broken. The mirror image of the fix: a
  tightened check → legitimate callers still pass; a changed query → its other
  consumers; a changed shared component → its other screens.
- **Halo** — adjacent workflows a user touches around this feature: list/detail
  pages, activities, GitOps round-trip, the same feature on another platform.

**Hosts.** Prefer osquery-perf whenever the behavior is server-side — fast,
repeatable, identical on both instances (flags and templates in
`references/fleet-gotchas.md`). Real devices are needed when device-side behavior
is the point (profile actually installed, agent UI, APNs/AMAPI round-trip).

**Coverage decisions are binary.** If a case has value, it gets covered — create
the data, or ask the user for what you can't create. If it has no value, drop it
and don't mention it. A "not covered" list only confuses the reader, so there is
none in the comment.

**Ask the user once, batched**, for anything you can't set up yourself or reach
through a full-path simulation (see **Evidence**) — a real device in a specific
fleet, a CA, an IdP login, a third-party integration, a license or global-setting
change on a shared instance, a redeploy. Anything a **core** row
needs goes in this ask — e.g. one real IdP sign-in to mint a session whose expiry
and reuse you then test — rather than settling for "covered by the PR's tests".
List each item, which instance, and why the alternative won't do. Share the plan outline in the same
message. If nothing is needed, share the outline and proceed without waiting.

Keep secrets out of files where possible (pass enroll secrets and tokens via
env vars). If a driver needs them on disk, keep that file inside `qa-<N>/`, never
in `/tmp`, and don't paste them into RESULTS.md.

Test data can be created freely — users, fleets, secrets, scripts, realistic
sensitive-looking values — because it all gets cleaned up. Append an undo line to
`created.txt` for **every** object as you create it (see `cleanup.sh` header for
the line format), including hosts, background PIDs, worktrees and containers. For
role testing create **API-only users** (`POST /api/v1/fleet/users/api_only`) — they
return a token directly, so no password is typed. (They can't log into the UI; for
UI-by-role use the real role users with fleetctl contexts listed in
`.claude/fleet-qa.local.md`, or ask the user to sign in as that role. Never rewrite `/me` in the browser to fake a role.)

### 4. Prove the problem is captured

**4a. Live repro on pre-fix.** Run every core case on the pre-fix instance first.
If the bug does **not** reproduce, find out why before moving on: setup differs
from the reporter's, a precondition was missed, or a *later, separate* hardening
change masks it (e.g. a later validation step rejecting the crafted input before
the buggy code runs). In the masking case, ask the user whether to toggle the
mitigation for a live repro, and use 4b as the before/after evidence meanwhile. A core case that never reproduced
can't carry the verdict.

For **rendering and interaction bugs** (positioning, focus, hover, animation,
scroll), headless Playwright is a weak witness — it has no real pointer, fonts,
display scaling or extensions, and a clean headless run has already produced a
false "not reproducible" once. Reproduce in a real browser: Claude in Chrome (the
user's own Chrome, logged in) or the in-app browser, following the reporter's
steps by hand with real hovers. Before concluding **Cannot reproduce** on any UI
bug, ask the user to try the exact steps in their browser — a minute of their
time is cheaper than a wrong verdict.

**4b. Fallback: PR tests without the fix.** Only when the live before/after is
impossible *and the user has confirmed it* — you asked for the setup it needs and
they said it can't be done (the bug is masked by a later mitigation they won't
toggle, needs hardware nobody has, or the path can't be driven from outside), or
that PR tests are good enough for this case. Then show that the PR's tests fail when the
fix's *behavior* is removed and pass with it restored; that stands in for the live
repro of that row, and the matrix says so (`➖ proven by PR tests`). Recipes,
including the behavioral revert for PRs that change signatures, are in
`references/revert-recipes.md`. Don't report on test coverage itself — missing or
weak unit tests aren't a QA finding.

### 5. Execute — fan out

Split independent tracks across subagents (core, regression, halo, UI). Give each the contexts, script paths, qa folder, manifest path, the
rows it owns, and a pointer to `references/fleet-gotchas.md`; ask for rows back as
`# | type | case | pre-fix | fixed | evidence` plus anything odd. Agents run
tests; they don't decide the verdict.

Serialize anything that mutates global state (org settings, global agent options,
global MDM config, global policies). Fleet-scoped changes in separate `qa-<N>-*`
fleets can run in parallel. Run every row on both instances with the same driver —
regression and halo rows need the pre-fix baseline too, to tell "broke" from
"always behaved that way".

### 6. UI verification and screenshots

Explore and drive flows with the in-app browser (or Claude in Chrome if the user
asks). For evidence files, use `screenshot.mjs` — the browser tools can't save
PNGs. Prefer `--clip` on the relevant element over `--full`; use `--caret` for
caret/focus bugs; write a `pw.mjs` driver for longer click flows.

Pair them (same number, `prefix`/`fixed`, e.g. `01-prefix-transfer-modal.png`).
Read every PNG before sending: it must show the thing (not a spinner, a login page
or the wrong tab), and for **public** `fleetdm/fleet` tickets it must not show
secrets — enroll secrets in URLs, tokens, real user data. Crop or retake.

Then combine each pair into one image — `scripts/stack.py 01-transfer-modal.png
01-prefix-*.png 01-fixed-*.png` (`--side` when the clips are narrow) — because a
before/after is read as one thing and the engineer pastes one attachment per row,
not two. Crop both to the same region first so the stacked image stays legible.
Shots for different matrix rows stay separate. Send with `SendUserFile` (display
`attach`), one caption line per image naming the matrix row (and the order, e.g.
"top: pre-fix, bottom: fixed"). If `SendUserFile` isn't available, list the paths.

### 7. Classify what you found

Every unexpected behavior gets exactly one origin:

| Origin | Meaning |
|---|---|
| **Introduced by this fix** | Only on the fixed instance, caused by the diff. Usually blocks. |
| **Exposed by this fix** | Old behavior that was unreachable or harmless before and the fix makes reachable or matter (e.g. a shared component's quirk in a picker that just became searchable). |
| **Introduced in this release** | Only on the fixed instance, but from another change between the branches. Name the commit if found. |
| **Pre-existing** | Reproduces on both instances. |

Before calling anything fixed-only, rerun it on both sides — timing and leftover
state produce convincing one-offs. If it won't recur, drop it rather than invent
an "unconfirmed" label. A UI finding seen only in headless Playwright isn't a
finding yet: confirm it by hand in a real browser first (a headless-only focus-loss
"bug" once turned out not to reproduce for a person), or list it with that caveat
and ask the user to try it.

List everything that survives — including low-severity quirks. Don't pre-filter by
whether it seems worth filing; that's the QA engineer's call. For security reports,
also list any of the report's own suggested fixes that this fix didn't address, so
the owner can decide whether that's acceptable. **Don't file anything.**

### 8. Report

**Counting.** `X/Y` means X passed out of Y rows actually exercised live on the
fixed instance by this QA. Rows that were blocked, didn't reproduce, or are backed
only by the PR's automated tests are not in Y — they show in the verdict instead,
and the scope sentence must not claim them ("covered all three vectors" when one
was proven only by tests is an overclaim).

**Plan ↔ matrix.** Every row in `plan.md` ends up in the matrix, or in RESULTS.md
with the reason it was dropped. Keep the three types honest — a regression row
doesn't quietly become halo.

**Verdict** is one of:
- **Pass** — every core row reproduced on pre-fix and passes on fixed; no
  blocking findings.
- **Pass with notes** — as above, with non-blocking findings, or one core vector
  proven only by the 4b fallback rather than live.
- **Fail** — a core row fails on fixed, or an "Introduced by this fix" finding
  blocks.
- **Cannot reproduce** — the bug never reproduced on any baseline, including by
  hand in a real browser for UI bugs and by the user when asked; the fixed behavior
  looks fine but the fix isn't verified.

Save the comment to `qa-<N>/issue-comment.md` **including** the four-backtick
fence, and print the same block in chat:

````markdown
QA **<verdict>** — <X>/<Y> checks on `<fixed branch>` vs `<pre-fix branch>`. <One sentence of scope: what was covered at a high level, e.g. "Reset + automation_activities on all API prefixes, host-scoped resets across fleets, role matrix, activities and counts.">

| # | Type | Case | Pre-fix | Fixed |
|---|---|---|---|---|
| 1 | Core | <case, in user terms> | ❌ reproduced | ✅ <observed, few words> |
| 2 | Regression | <case> | ✅ | ✅ unchanged |
| 3 | Halo | <case> | ✅ | ✅ |
````

Keep it to that. Setup, mechanism, test data, automated-test tables and driver
details live in `RESULTS.md`, not the comment — the reader wants the outcome, and
PR tests passing is assumed. Add a sentence under the matrix only when a row's
significance isn't obvious (e.g. "Row 10: pre-fix, Enter silently saved the first
script — the real user impact"). Cell conventions: `❌ reproduced` for core rows
showing the bug, `✅` baseline, `➖ n/a` when the case can't exist pre-fix.

**Then, separately, the decision list** — outside the block, in chat and in
`RESULTS.md`:

```markdown
**Decisions needed**
| # | Finding | Origin | Severity | Repro / location |
|---|---|---|---|---|
| A | <one line> | <origin> | <sev> | <minimal repro; file:line> |

For each: file it, mention it in the comment, or drop it?
```

For any the user says to file, use the `fleet-bug-file` skill — it writes the issue,
and records the setup from this QA run so the fix can be retested later.

Name the screenshots already sent. If there are no findings, say so and skip the
table. When the user answers, append the ones they chose to mention to the comment
as a short **Issues found** table (`# | Issue | Origin | Severity`), link any they
filed, and reprint the final block. Dropped findings stay in RESULTS.md only.

### 9. Cleanup

Show the manifest newest-first with `tail -r qa-<N>/created.txt` (a permission
checker may block the cleanup script even in list mode, so list with plain `tail`)
and ask before undoing. On a yes, run `scripts/cleanup.sh qa-<N>/created.txt --run`
and report any non-2xx. A 409 on a script usually means a policy still references
it — it goes away with its fleet; recheck at the end. Only touch what this run
recorded — other QA sessions may share the machine and instances, so never
`pkill osquery-perf` or delete by name pattern. Leave `qa-<N>/` itself; it's the
evidence trail.
