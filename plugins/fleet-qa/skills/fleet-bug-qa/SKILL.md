---
name: fleet-bug-qa
description: "QA a Fleet bug fix or security-report fix against two live instances: reproduce the bug on the pre-fix instance, verify the fix on the fixed one with regression and halo checks, and hand back a short copiable ticket comment plus a decision list of everything else found. Use when asked to QA, verify, test or confirm the fix for a Fleet bug, issue or PR ('QA #51234', 'verify the fix for this bug', 'test this security report', 'confirm PR #53900 fixes it', 'check this bug on prev and RC'), including fleetdm/security reports. Not for a feature story (fleet-story-qa), a quick win or small change with nothing to reproduce (fleet-quickwin-qa), work on a load test (fleet-loadtest-qa), or a sweep of the user's own filed bugs (fleet-bug-retest)."
---

# Fleet bug / security-fix QA

The goal is a verdict you would stake your name on: the bug demonstrably existed, the fix demonstrably
removes it, nothing nearby broke, and anything odd you tripped over is written down with where it came
from.

The confidence comes from the **before/after**. A case that passes on the fixed instance proves nothing
unless the same case failed on the pre-fix instance: a test that can't fail isn't a test. So every core
case has a before. The evidence is live product behavior; the PR's unit and integration tests are the
engineers' concern, and come in only as a fallback when a live repro is impossible (4b).

**Right skill?** Look at the issue's labels first. A `story` is `fleet-story-qa`'s; a small change with
nothing to reproduce (`quick-win`, copy, a new field or flag) is `fleet-quickwin-qa`'s; behavior on a
load test is `fleet-loadtest-qa`'s. If it's another skill's, load that one now and say so in a line:
people type the command they're used to. A bug from the engineer's
`<QA workspace>/filed-bugs/INDEX.md` stays here and starts from its tracker entry, which already
holds the setup, the repro and the checks (step 4).

## Before you start

- **Read `~/.claude/fleet-qa.local.md`**: this machine's instances, Fleet checkout, QA workspace,
  databases, logs, role users and standing permissions. If it doesn't exist, create it first, per
  `${CLAUDE_SKILL_DIR}/references/local-setup.md`.
- **The two instances** are fleetctl contexts in `~/.fleet/config`, as the local file names them
  (usually `previous`, the pre-fix one, and `default`, the fixed one). The user may name others. The
  scripts read the tokens themselves and never print them.
- **Check that every context you'll use still answers**, role users included
  (`fleetapi.sh <ctx> GET /api/v1/fleet/me`). Expired tokens go in one ask now
  (`fleetctl login --context <name>`), not when a row needs them.
- **Work in `<QA workspace>/qa-<N>/`**: drivers, `plan.md`, `RESULTS.md` (the lab notebook, written as
  you go: setup, mechanism, payloads, every check with what you saw), `issue-comment.md`,
  `screenshots/` and `created.txt` (the cleanup manifest).

**Scripts** are in `${CLAUDE_SKILL_DIR}/scripts/`; each header has its usage.
`fleetapi.sh <ctx> <METHOD> <path> [json | -F k=v ...]` is the authenticated REST call (`-F` for
multipart uploads, `FLEET_TOKEN=` to act as another user). Beside it: `env_check.sh`, `screenshot.mjs`
(headless, signed in), `pw.mjs` (the same login, for multi-step Playwright drivers), `stack.py`
(several shots into one image), `cleanup.sh` (lists or undoes the manifest) and `encode_deviceinfo/`
(a deviceinfo blob for the Apple enroll endpoints).

**References** are in `${CLAUDE_SKILL_DIR}/references/` unless a path is given. Each is a required
read at the step that names it, not background:

- `planning.md`: now. Steps 1–3 in detail: the mechanism, the environments, the matrix, the ask.
- `fleet-gotchas.md`: before building any test data (osquery-perf, counts and crons, shared instances).
- `${CLAUDE_PLUGIN_ROOT}/skills/fleet-story-qa/references/instance-traps.md`: before the first UI step
  (signing the browser in, § Auth; Fleet UI that misleads a check).
- `${CLAUDE_PLUGIN_ROOT}/skills/fleet-explore/references/tours.md`: step 3 for edge values and probes
  (§ 1, 3, 5); step 7 for oracles (§ 7) and known non-findings.
- `revert-recipes.md`: step 4b only.
- `screenshots.md`: step 6, before the first evidence PNG.
- `findings.md`: step 7, when the first odd thing turns up.
- `report.md`: step 8, before writing anything for the ticket.

After a long run the detail of a step may no longer be in front of you. Re-read its file from this
list rather than working from memory.

## Hard lines

<!-- shared:hard-lines -->
Each of these cost an engineer something once. They hold for the whole run, and for every subagent you
brief: a subagent hasn't read this skill, so paste this section into its prompt.

- **Global state belongs to the engineer**: MDM on or off, the license, GitOps mode, org settings, Apple
  or Android enterprise setup, a server restart. Ask, and they do it (turning Android MDM off deletes
  the enterprise and every Android app in every fleet). Settings on a fleet this run created are
  yours, and so is whatever the local file lists under standing permissions.
- **Work on objects this run created**: your own fleet (`qa-<N>`, `qa-explore-<slug>`), osquery-perf
  hosts, labels, policies, scripts, packages and API-only users, each recorded in `created.txt` as it's
  made. Real hosts, the engineer's fleets and the role users are read-only, even for a moment: a
  device may be mid-test.
- **Address things by id, never by a name match.** A repro script that matched a fleet by part of its
  name once wrote to the engineer's real fleet.
- **Read the handler before calling an endpoint you don't know.** Some GETs write: the zero-touch
  configuration GET mints a Google token, and a first page load can do the same. When the first call is
  the thing under test, save it for the row that needs it.
- **Never type the engineer's password, or create or delete their accounts.** API-only users for API
  role checks; for UI-by-role, the local file's role users, the engineer signing in, or with their
  say-so a session-owned user on your fleet (`instance-traps.md` § Auth).
- **Never print a secret.** Tokens and enroll secrets stay in `~/.fleet/config` and env vars. Don't
  `cat`, `grep` or `sed` a file that holds keys (the dev `fleet.yml`, a `.env`), masked or not: a line
  mask prints the key block under the label. Have a script copy the one field into a 600-mode file in
  the run folder and print key names only. `ps` and `pgrep -fl` show other sessions' secrets too.
- **Nothing goes on GitHub unless the engineer asked for it in this conversation.** Comments are handed
  over as copiable blocks; filing is `fleet-bug-file`'s job, on their word.
- **Scratch code never stays in the Fleet checkout.** Throwaway tests go in, run and come out, with
  copies in the run folder. If a file of theirs breaks the build, move it aside for the one run and
  restore it byte for byte.
- **Undo only what this run recorded, and ask first.** List `created.txt` newest-first, get a yes,
  then run `cleanup.sh`. Other sessions share the machine and the instances, so never
  `pkill osquery-perf` or delete by name pattern.
- **Don't weigh in on release process.** Released or unreleased is a fact to establish, not a
  recommendation to make.
<!-- /shared:hard-lines -->

## Evidence: run the real code path, simulated or real, or ask

<!-- shared:evidence -->
A row counts only when Fleet's own code for it ran on the build under test, from the entry point a user
would hit. Three ways to get there, in this order:

1. **Simulate the whole path** whenever that covers the row. It costs nobody's time, so it comes first:
   osquery-perf hosts enrolling through the real endpoints (desktop, iPhone/iPad over MDM, Android),
   API-only users for API role checks, a real API call against a simulated host to put it in a state (a
   real wipe or lock command leaves it "pending"), `fleetctl trigger` instead of waiting for a cron. The
   test: would any production code on this row's path behave differently if the host, user or state
   were real? If not, the simulation is the real thing. Look for the most realistic route before
   settling for less: when osquery-perf has no template for a platform, the agent's real enroll request
   (`POST /api/v1/osquery/enroll`) still runs Fleet's enrollment, where a hand-inserted host row
   doesn't. Where the real thing already exists (a device in the right state, a setting already on, a
   real user of the role), use it read-only.
2. **Ask the engineer** for whatever a simulation can't reach and you mustn't do yourself: a license
   switch, an MDM toggle, an org setting, a real UI session as a role, a device action, a third-party
   console, a redeploy. It goes in the batched ask. Don't decide for them that it's too disruptive, too
   slow or already covered by the developer's tests: that's their call, and usually they just do it.
   When a cheaper path would prove the same change, offer both and say which you'd take.
3. **A workaround only with their go-ahead**: they say the real setup can't be done, or that a
   workaround is good enough for this row. Propose the specific one (a hand-inserted DB row, a mocked
   failure in a scratch test, an intercepted response for an error nobody can trigger) and what it
   skips. Once they agree, record it in RESULTS.md as what it is. It never shows as a bare ✅.

Faking what Fleet says isn't evidence. Rewriting responses in the browser (`page.route` to change the
license, the viewer's role, a setting or a host's state) shows how the frontend reacts to data Fleet may
never send. Reading the code instead of running it isn't evidence either: it's how the bugs QA exists
for slip through, like an Apple-MDM check hiding a Windows feature that stays invisible until someone
turns Apple MDM off. Code and unit tests tell you where to look; they don't pass a row. And don't close
with "worth confirming on a real device": if it would change the verdict, it belonged in the ask.
<!-- /shared:evidence -->

Here a row means both instances, so an ask covers both. The workaround for a core row is the PR's
tests without the fix (4b), and its row reads `➖ proven by PR tests`.

## Working with the engineer

<!-- shared:working-with -->
- **Ask once, batched, and make every item doable without a question back**: the exact step (the tap
  path on the device, the command with its values filled in, the link pasted in the message), which
  instance, how long it takes, and what they'll see when it worked. When you offer options, mark the
  one you recommend. Device steps go one at a time ("Your turn: …; reply done"), and never ask for
  screenshots from a phone: they tell you what it shows.
- **Keep working while they do their part**, and ask a thing once. A question they didn't answer about
  something minor is a no for now.
- **Say where things stand.** On a long stretch on your own, post one line as each stage ends and
  whenever you start waiting: what's done, what you're waiting on, until when. Ten silent minutes read
  as stuck.
- **Hand over the deliverable without being asked.** Whenever the outcome changes (a row rerun, a
  finding decided, a check they ran by hand), print the current deliverable again, complete and
  copiable: the ticket comment, the sign-off, the debrief. One per ticket when the run covers several.
<!-- /shared:working-with -->

## Workflow

Steps 1–3 are spelled out in `planning.md`. Read it before the first call to an instance.

### 1. Understand the bug down to its mechanism

Read the issue with its comments, the PR description and the **full diff**. Be able to state what the
user saw and **why it happened** in code (file:line), what the fix changes, and every entry point that
reaches the changed code: UI, REST API on all prefixes, fleetctl, GitOps and batch endpoints, crons,
agent and MDM check-ins. A fix applied in one entry point and not another is the most common way fixes
are incomplete. Take names from the code, not the ticket prose. For a security report, every vector
the ticket or its comments name is in scope as core.

### 2. Verify the environments

```bash
${CLAUDE_SKILL_DIR}/scripts/env_check.sh previous default <fix-sha> [<cherry-pick-sha>]
```

The pre-fix instance must *not* contain the fix and the fixed one must. If they don't bracket the
fix, tell the user and propose a baseline. The pre-fix instance is an **earlier branch**, not "fixed
minus this PR": it differs by every change in between, which matters in step 7.

### 3. Build the test plan, then ask once

Write `qa-<N>/plan.md`: **core** rows (the issue's repro as written, then variants attacking the same
mechanism on every entry point), **regression** rows (what the fix could have broken) and **halo**
rows (the adjacent workflows a user touches). Each row should be able to catch something the others
can't, the matrix is sized to how many customers the bug can reach, and coverage decisions are binary:
a case with value gets covered, one without is dropped unmentioned. Record an undo line in
`created.txt` for every object as you create it.

**Ask the user once, batched**, for anything you can't set up yourself or reach through a full-path
simulation, including whatever a core row needs. Share the plan outline in the same message. If
nothing is needed, share the outline and proceed without waiting.

### 4. Prove the problem is captured

**4a. Live repro on pre-fix.** Run every core case on the pre-fix instance first. If the bug does
**not** reproduce, find out why before moving on: setup differs from the reporter's, a precondition
was missed, or a *later, separate* hardening change masks it. In the masking case, ask the user
whether to toggle the mitigation, and use 4b as the before meanwhile. A core case that never
reproduced can't carry the verdict.

**The engineer can waive the rerun**, and often does for a bug they filed or already reproduced ("we
reproduced it when filing, just verify the fix"). Then don't rebuild the before or ask about it again:
the filing-time repro (the tracker entry `filed-bugs/<N>-*.md`, or the issue's own steps) is the
Pre-fix column, marked as such, and every row runs on the fixed instance. Go back to a pre-fix
instance only when a regression row fails and you need to know whether it always did. For a bug in
their tracker that comes with no such word, ask once, in the first message, whether the filing-time
repro stands. Without a waiver, and for anyone else's bug, the repro comes first.

For **rendering and interaction bugs** (positioning, focus, hover, animation, scroll), headless
Playwright is a weak witness and has already produced a false "not reproducible". Reproduce in a real
browser (Claude in Chrome, or the in-app browser) by hand, with real hovers. Before concluding
**Cannot reproduce** on any UI bug, ask the user to try the exact steps in their browser: a minute of
their time is cheaper than a wrong verdict.

**4b. Fallback: PR tests without the fix.** Only when the live before/after is impossible *and the
user has confirmed it*: they said the setup can't be done, or that PR tests are good enough for this
case. Then show that the PR's tests fail when the fix's *behavior* is removed and pass with it
restored (`revert-recipes.md`); the matrix says so for that row. Missing or weak unit tests aren't a
QA finding.

### 5. Execute — fan out

Split independent tracks across subagents (core, regression, halo, UI). Give each the contexts, the
scripts' path, the qa folder, the manifest path, the rows it owns, the Hard lines and Evidence
sections above pasted in, and the path of `fleet-gotchas.md`; ask for rows back as
`# | type | case | pre-fix | fixed | evidence` plus anything odd. Agents run tests; they don't decide
the verdict.

Serialize anything that touches state other sessions can see (global policies, labels, users with
global roles). Fleet-scoped changes in separate `qa-<N>-*` fleets can run in parallel. Run every row on
both instances with the same driver (unless the before was waived): regression and halo rows need the
pre-fix baseline too, to tell "broke" from "always behaved that way".

### 6. UI verification and screenshots

Explore and drive flows with the in-app browser (or Claude in Chrome if the user asks);
`instance-traps.md` § Auth says how to get it signed in. Evidence files are made per `screenshots.md`:
read it before the first one. In short: `screenshot.mjs` for the files, every PNG read before it's
sent, each before/after pair stacked into one image, sent with one caption line naming its matrix row.

### 7. Classify what you found

Every unexpected behavior gets exactly one origin:

| Origin | Meaning |
|---|---|
| **Introduced by this fix** | Only on the fixed instance, caused by the diff. Usually blocks. |
| **Exposed by this fix** | Old behavior that was unreachable or harmless before and the fix makes reachable or matter. |
| **Introduced in this release** | Only on the fixed instance, but from another change between the branches. Name the commit if found. |
| **Pre-existing** | Reproduces on both instances. |

Before calling anything fixed-only, rerun it on both sides: timing and leftover state produce
convincing one-offs. If it won't recur, drop it rather than invent an "unconfirmed" label. A UI finding
seen only in headless Playwright isn't a finding yet: confirm it by hand in a real browser, or list it
with that caveat and ask the user to try it.

Then take each one through `findings.md` before it goes on the list: vary one thing, name what it's
wrong against, say who would hit it, search the open issues and the engineer's own filed bugs, and
capture it ticket-grade now. For security reports, also list any of the report's own suggested fixes
that this fix didn't address. **Don't file anything.** When the fix's neighbourhood looks richer than
the halo rows covered (a shared component, sibling actions with the same scoping), offer a
`fleet-explore` session on it after the verdict, seeded with this run's `qa-<N>/`.

### 8. Report

Read `report.md` now, even if you remember it. The ticket comment is for a manager: one verdict line
(`QA **<verdict>** — X/Y checks on <fixed> vs <pre-fix>` plus a sentence of scope) and the matrix,
saved to `qa-<N>/issue-comment.md` and printed as a copiable four-backtick block. Everything else
stays in RESULTS.md. The decision list follows separately, in chat (`findings.md`): every finding
with who hits it and what you recommend. After the engineer answers, and after any later change,
print the whole comment again.

### 9. Cleanup

Show the manifest newest-first with `tail -r qa-<N>/created.txt` (a permission checker may block the
cleanup script even in list mode, so list with plain `tail`) and ask before undoing. If the next
ticket is in the same area, ask whether to keep the setup for it instead. On a yes, run
`cleanup.sh qa-<N>/created.txt --run` and report any non-2xx. A 409 on a script usually means a policy
still references it; it goes away with its fleet, so recheck at the end. Leave `qa-<N>/` itself: it's
the evidence trail.
