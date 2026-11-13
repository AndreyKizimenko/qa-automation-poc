---
name: fleet-loadtest-qa
description: "QA and investigate Fleet at scale on a load test (the 100k-host osquery-perf 'loadtest' environments in AWS): reproduce a scale or performance bug, verify its fix before and after an upgrade, find what breaks when reports, policies, scripts and automations are stacked, recover a load test that is crash-looping or out of memory, time migrations on big tables, and file what you find with measurements a developer can act on. Use for anything that runs on or is about a load test ('QA #54601 on the loadtest', 'the loadtest is crash-looping', 'what breaks at 500 reports', 'why did Fleet OOM at 100k hosts', 'measure the migration on 20M rows', 'plan the next load-test runs'), even if the user only says 'loadtest', '100k hosts' or names the instance. Borrows fleet-bug-qa's verdict and comment and fleet-bug-file's filing. Not for QA on the local default/previous instances (fleet-bug-qa), the release DB-upgrade test jobs (release-migration-test), or API timing runs from the Playwright suite."
---

# Fleet load-test QA

A load test is a production-sized Fleet (25 tasks, Aurora, Redis) with ~100k simulated hosts. Bugs here are about
**how per-host work multiplies**: a query, write, clone or lock that is free for one host becomes a saturated writer,
an exhausted connection pool or an out-of-memory crash at 100k hosts — often in synchronized bursts. The work is
slower and riskier than local QA: one instance is shared, every change is load, a crash takes the instance down for
everyone, and the environment differs from production in ways that can both create and hide bugs.

This skill adds the load-test layer. For the verdict, the test matrix, origin classes and the ticket comment, follow
**fleet-bug-qa** (or fleet-story-qa); to file, use **fleet-bug-file**. References, in
`${CLAUDE_SKILL_DIR}/references/`, each read at the point that names it: `environment.md` before planning (how the
load test differs from production — read it every time) with `lessons.md`; `measuring.md` while running; `recovery.md`
the moment tasks start dying. From fleet-bug-qa, in `${CLAUDE_PLUGIN_ROOT}/skills/fleet-bug-qa/references/`:
`findings.md` when the first odd thing turns up, and `report.md` before writing a ticket comment.

## Tooling (`${CLAUDE_SKILL_DIR}/scripts/`, all take `LT=<instance>` from the environment)
| Script | Use |
|---|---|
| `lt-env.sh` | Sourced by the others: region, cluster, writer, `lt_api` (admin API with the fleetctl context's token, never printed), time helpers |
| `lt-status.sh [n] [s]` | One line: memory max/avg, running/pending/desired, writer 1-s peak, healthz |
| `lt-db.sh <start> <end>` | Every DB instance: AAS, top SQL, waits, deadlocks/min, connections |
| `lt-db-minute.sh <start> <end> [n] [db.wait_event]` | Writer load per minute split by top SQL (or waits): which statement climbed first |
| `lt-logs.sh <start> <end> '<query>'` | CloudWatch Logs Insights on the Fleet log group (`-30m now` works) |
| `lt-cron.sh <schedule> <start> <end>` | A cron's runs and per-job durations |
| `lt-stops.sh` | Why Fleet tasks stopped (OOM vs health check), per minute — ECS keeps ~1 h |
| `lt-step.sh <label> <min> [apply] [revert]` | One load step with trip wires, auto-profiles and auto-revert |
| `ramp.sh 0\|1-99\|100\|cleanup`, `ramp-up.sh 10 25 50 100` | Cut / restore device traffic at the ALB (infra change — ask first) |
| `lt-watch-deploy.sh <run-id>` | Follow a deploy and time the migration task |

`LT` is `fleet-<terraform_workspace>` (environment.md). The scripts need the AWS CLI v2 signed in through SSO (export
`AWS_PROFILE` when the local file names a profile), `jq`, and GNU `timeout` (`lt-step.sh`'s profile capture; on macOS
from Homebrew coreutils). The fleet-bug-qa scripts (`${CLAUDE_PLUGIN_ROOT}/skills/fleet-bug-qa/scripts/`: `fleetapi.sh`,
`cleanup.sh`, `screenshot.mjs`) work too, with the load test's fleetctl context.

## Workflow

### 1. Orient
- Read `~/.claude/fleet-qa.local.md` for the load-test section (instance `LT`, fleetctl context, QA workspace). If it's
  missing, add it (names only, no tokens) per the fleet-bug-qa local-setup reference.
- `LT=<lt> lt-status.sh`, and `export LT=<lt>; source lt-env.sh; lt_api GET /api/latest/fleet/version` (both by their
  full path): is it up, which build, how loaded. If AWS calls fail, ask the user to run `aws sso login` (with
  `--profile <profile>` for a named profile). Database access (which VPN, which helper, who types the password) is in
  the local file too; if it isn't, ask once and add it there.
- Record the instance's shape before touching anything: build, pool size and sizing (from the last deploy's log),
  hosts and platforms, what's already scheduled (reports, policies, automations, scripts, packages), cron health
  (`lt-cron.sh cleanups_then_aggregation -3h now`). Leftovers from earlier work change the load you measure.
- Check whether the running build already contains the fix: `git merge-base --is-ancestor <fix commit> <running
  revision>`. If it does, there is no pre-fix instance — ask before planning around one. RC images follow the branch,
  so any redeploy (even an unrelated input change) pulls a newer build; finish the baseline before anyone redeploys.
- Find out what else is running on the instance: other people's campaigns, your own background drivers or watchers,
  automations left on. Two load-changing activities at once ruin both measurements.
- Work in `<QA workspace>/qa-<N>/` (or a campaign folder): drivers, `plan.md`, `RESULTS.md`, `created.txt`.

### 2. Understand the scale mechanism
Read the issue, PR and full diff as in fleet-bug-qa, then answer the load-test questions:
- **What multiplies?** Per host, per report, per policy, per request — and how often (osquery-perf refreshes config
  every 60 s; policies and reports run on intervals; detail queries hourly). 100k hosts/hour ≈ 1,700 requests/min
  when spread out; first runs and outages synchronize them.
- **Which resource saturates?** Writer (commit-bound, lock waits), readers, connection pool, Redis, Fleet memory
  (clones per request, idle ALB connections), or the request timeout. Pick the metrics from measuring.md that would
  show it.
- **Which entry points** reach the changed code (GitOps/spec endpoints, host check-ins, crons, admin API) — each is a
  row.
- **Could the environment create or hide it?** Pool size, DB parameters, MDM off, async off, /dev/null log destination
  (environment.md). If it can't show on the load test, plan a local before/after (lessons.md, last section) and keep the
  load test for the at-scale regression and halo rows.

### 3. Plan, then ask once
Write `plan.md`: core rows (the repro at the issue's scale, then variants: quiet, under host load such as a refetch
burst, overlapping the relevant cron, two at once), regression rows (the case where the work *must* still happen —
e.g. a real change still cleans up), halo rows, the drivers, the numbers you'll record, and trip wires. Every core row
runs pre-fix first with the same driver. Budget the instance: keep the pre-fix phase to what proves the bug (a step
you expect to crash it needs a reason), estimate each step's lasting side effects (rows, script output, activities)
and gate anything the API can't clean up, and give a total time — a shared load test can't be held for days.
Plan against what customers run: the reference architecture's sizing and Fleet's defaults (vulnerability processing
on, the options a customer has enabled by default), unless the test is about a deviation. Name every deviation in the
plan with its reason; "it makes the comparison cleaner" usually isn't one.
Batch the asks: the upgrade (the user runs the deploy workflow), any input change (pool size, sizing), cutting traffic
for recovery (get it pre-approved for risky steps), anything needing MDM. Share the plan outline in the same message.

### 4. Pre-fix baseline
On a single load test the current build *is* the pre-fix instance until the upgrade, so finish every baseline row
first. Prove the bug with numbers (server `took`, client code, AAS, memory, errors). If it doesn't reproduce, find out
why before moving on — a masking config, missing preconditions (data volume, host load, the right automation), or a
mechanism that needs a race you can't force. Then decide with the user: change the setup, reproduce locally, or rest
the verdict on the symptom that did reproduce and say so.

### 5. Upgrade and settle
The user runs the deploy. Follow it with `lt-watch-deploy.sh <run-id>`; time any migration against the add-on's
10-minute wait. Confirm the revision via `/version`, then wait out the reconnect wave (`lt-status.sh` calm for several
samples: memory back near baseline, writer quiet, healthz < 1 s) before measuring. Re-check data you rely on survived.

### 6. Fixed runs
Same drivers, same data, same order. Serialize anything that changes load. Run long steps in the background
(`lt-step.sh`, or your driver) and act on the completion notification. Say what you're waiting on and until when, and
end every step with the instance's state in one line (calm and safe to use, or still settling until about when): the
instance is shared, and someone is usually waiting to use it. Grab expiring evidence (ECS stops, profiles)
when something trips. Keep regression rows honest: the fix that skips work must still do the work when it's needed —
measure that case at scale too (it may be slow in its own right; that's a finding).

### 7. Investigating "what breaks" (no fix yet)
Stack one variable at a time from a quiet baseline: add the thing, hold at least one interval of it, record the full
metric set, and stop at the first step that trips (memory ≥ 60 %, tasks lost, healthz failing). At the trip, profile
and pull logs *before* reverting. Then attribute: which resource, which code path, what started it and when (onset
times vs your changes), and whether the environment explains it (rerun at the reference pool). A collapse often moves
rather than disappears when a bottleneck is fixed — keep going until you know what holds at the target.

### 8. Report
- **Ticket comment:** fleet-bug-qa's format (`report.md`: verdict, X/Y, scope sentence, matrix, manager-level). Put the
  decisive numbers in the cells: "❌ 2m26s server, 502" → "✅ 200 in 5–7 s". Add one sentence when the mechanism itself
  didn't reproduce but the symptom did, or when rows ran locally. A campaign covers several tickets: one comment per
  ticket, printed as each is done and again after any change, without being asked.
- **Decision list** (`findings.md`): every finding with its origin (introduced / exposed / introduced in this release /
  pre-existing), who would hit it and your recommendation — including load-test-only ones, marked as such. For each,
  say plainly whether a real fleet would see it or only osquery-perf does, and whether it reproduces locally: that's
  the first question asked. An anomaly you watched go by (an error repeating every hour, a cron running far longer
  than it used to) is on the list or explained, never just an aside.
- **Filing** (fleet-bug-file, once for the batch; ask whether the issues should carry `:loadtest`): steps at the
  reference sizing when it reproduces there; the measured numbers; a short
  server-log section (onset timeline, top error signatures, task memory, stop reasons); the profiles (zip + README,
  attached by the user — gh can't upload, so use the user's attachment link); config that matters (pool, sizes).
  Verify any extrapolated claim with one more run before filing it.
- Keep `RESULTS.md` as the lab notebook: timelines, drivers, queries, what was dropped and why.

### 9. Clean up
From `created.txt`, newest first, after looking at each object (it may already be gone). Small batches with pauses —
policy deletes cascade, report deletes leave stats behind under load (recovery.md). Restore settings you changed
(`server_settings.report_cap`, webhooks, automations), stop local stacks (containers, worktrees, binaries). Leave anything you're
unsure about and list it for the user. Note the end state of the instance (build, pool, data left) for whoever's next.

## Safety
- Infra actions (ALB traffic cuts, redeploys, input changes, scaling) are the user's call; ask, or get them
  pre-approved for a specific risky test. Never restart or rescale osquery-perf.
- Never print tokens or enroll secrets (`ps`/`pgrep -fl` show them); `lt-env.sh` reads the token without echoing it.
- Public issues: no customer names or confidential links, even when the work was prompted by a customer incident.
