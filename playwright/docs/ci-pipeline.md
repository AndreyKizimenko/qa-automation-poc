# How a run works, and why it is shaped this way

The reasoning behind the CI flow: what runs where, in what order, and what each choice protects. The numbers
that change — worker counts, runtimes, the cron, which reports a run uploads — live in one place,
[`CLAUDE.md` → *CI and the shared instances*](../CLAUDE.md#ci-and-the-shared-instances--current-facts), and this
document points there rather than repeating them. The workflow map (one row per file) is in the
[repo README](../../README.md#ci). Per-run triage history is in [`run-reviews/`](run-reviews/) (gitignored).

## The shape

```
QA — Nightly (one chain, both tiers)
  render deploy hooks ─► wait for the deploys + /healthz + "which build is this" notice
    ├─ premium: gitops chain ─► premium suite job
    └─ free:    gitops chain ─► free suite job          (the two tiers side by side)

a gitops chain            apply baseline → verify → apply min → verify → fleetctl checks
a suite job (premium)     main project (3 workers) → exclusive specs (1 worker) → gitops-mode (1 worker) → merge reports
a suite job (free)        main project (2 workers) → exclusive specs (1 worker) → merge reports

QA — Branch run           the same two tier chains without the redeploy, against a branch, on demand
Playwright — Check        tsc + eslint, on every PR; the only thing a PR runs
```

Inside a main project: `<tier>-setup` (login, writes the storage state) and `cleanup-setup` run first, the specs
run fully parallel across the workers, and `cleanup-teardown` runs last whatever happened.

## The constraints the shape comes from

Everything below follows from four facts about the environment.

1. **One Fleet instance per tier, shared by everyone.** Premium and free are separate Render deployments with
   their own databases. Anything that runs against an instance competes with everything else on it, and a
   gitops apply deletes whatever its config does not declare.
2. **One real VM per platform per tier.** A macOS, a Windows and an Ubuntu VM, each running one queue: scripts,
   installs and uninstalls execute one at a time per host. Profiles travel a separate channel (MDM commands),
   inventory a third (refetch). Roughly 300 osquery-perf simulations sit beside them for volume work and prove
   nothing about host-side behaviour.
3. **Some settings are global locks.** Turning script execution off stops every script run on the instance.
   Turning gitops mode on makes every mutating control read-only. A spec that flips one breaks whatever runs
   beside it.
4. **The instance is the bottleneck, not the runner.** More concurrent browser sessions surface as slow
   renders and navigation timeouts before they surface as anything else.

## Why each piece is the way it is

**Two tier chains, side by side.** The tiers are different instances, so nothing is gained by serialising them
and nothing is risked by not doing so. Each chain holds its instance's concurrency group
(`<tier>-fleetqa-instance`), shared by the gitops workflows and the suite workflow, so an apply and a test run,
or two test runs, queue instead of overlapping. The callers (`QA — Nightly`, `QA — Branch run`) take no group of
their own: a caller in the same group would wait on its own callees. The four apply workflows
(`gitops-{premium,free}{,-min}.yml`) take their own per-tier group when called, since the orchestrator already
holds the instance's, and the instance group itself when **dispatched by hand** (their `caller` input is unset
then): an apply deletes whatever its config doesn't declare, a running test's per-run items included, so a
manual apply waits for a running suite instead of overlapping it.

**gitops before the suite, and the suite runs whatever gitops did.** The suite assumes the instance is in the
declared state (the Workstations, QA and VMs fleets exist; the VMs fleet carries the durable software
fixtures). Applying first makes that true every night. After each apply, `gitops-verify` runs against every file
that apply carried — on premium the no-team config, Workstations, QA and VMs, with the QA and VMs files verified
after both the baseline and the min apply, since both carry them unchanged; the second pass proves the min
apply left them alone. In the nightly the suite runs even if a gitops step is
red, because a failed apply is its own signal and the night's test results are still wanted; in a branch run a
red gitops step stops that tier's suite, because the branch is what is being judged. The fleetctl checks
(`generate-gitops`, `gitops --dry-run`) sit inside the gitops chain on purpose: the suite's `cleanup-setup`
drains every global report and policy, after which neither comparison means anything.

**Cleanup is owned by the suite and runs twice.** gitops cannot remove what it never declared (a profile
uploaded through the UI, a leftover script), so the wipe lives in `setup/cleanup.steps.ts` and runs as a
dependency before the first test and as a teardown after the last. The pre-run pass makes a run self-healing
however the instance got into its state; the post-run pass leaves it clean for whoever is next. It also puts
back the global locks (gitops mode off, script execution on) and brings the real VMs to their resting state,
because a Playwright teardown does not run on a `SIGKILL` and a stuck lock would disable the *next* run's
entire suite. The wipe touches only Unassigned, Workstations and the suite's own `pw-*` / `fleet-pw-*` things on
the VMs fleet; the durable fixtures gitops declares are never deleted.

**Projects are routed by folder, not by tag.** `tests/e2e/shared/` runs on both tiers, `premium/` and `free/`
on one; the `testIgnore` matrix in `playwright.config.ts` is the source of truth. A tag has to be remembered on
every spec and can be wrong silently; a folder cannot.

**The specs that hold a global lock run alone, as their own invocation — not as a dependent project.** The
exclusive specs (script execution off; a policy automation that needs the Ubuntu VM's queue to itself — Fleet
runs its attempts below every user-requested activity) and gitops-mode live in their own projects on one worker, and CI runs
each as a separate `playwright test` step after the main project, pass or fail, merging the blob reports into
one HTML report. A Playwright *dependency* on the main project would have done the ordering but with the wrong
failure semantics: one unrelated red test skips every dependent, and a local run of the small project would
first re-run the whole suite. So they depend on login setup only, and the config refuses to name one of them
beside another browser project in a single invocation, because side by side is exactly what they exist to
avoid. The order between the two steps does not matter; both put their lock back in their teardown, and
`cleanup-setup` would anyway.

**The gitops-mode exceptions are restored before every premium apply, not by the suite.** Unlike the mode flag,
the exceptions act outside gitops mode: `fleetctl gitops` reads them on every apply, so a stuck `secrets: false`
makes it delete every enroll secret (premium's YAML declares none) and a stuck `labels` or `software: true` makes
it refuse the YAML. The gitops chain runs before the suite's `cleanup-setup`, so a restore there would come one
apply too late. The gitops-mode teardown puts them back at the end of every gitops-mode step, and
`.github/scripts/restore-gitops-exceptions.sh`, the first step of `gitops-premium.yml` and
`gitops-premium-min.yml`, puts them back if that teardown never ran. Nothing can declare them, so the baseline is
pinned in that script and in `GITOPS_EXCEPTIONS_BASELINE` (`helpers/api/gitops-mode.ts`).

**Worker counts are measured, not guessed.** The count is per tier because the instances differ, and it is a
CI-only number: locally the default is higher and the specs that touch a VM are run with `--workers=2`. The
measurements that set the current numbers are in [*What bounds a run*](#what-bounds-a-run). A trial at another
count is a branch run with `-f workers=N`, read with `run_timeline.py` (below), never a config commit first.

**Retries: two, except where an attempt is long.** CI retries so that a transient does not fail a night; a
pass on retry is reported as `flaky` and triaged as such. A describe that waits on a real VM takes one retry
(`HOST_RETRIES`): its attempts run 10–15 minutes and a wedged host fails every attempt the same way, so three
attempts of two such tests are 90 of a run's roughly 300 worker-minutes and can reach the run's own stop.
Locally there are no retries, so repeating one test shows its real spread.

**The run stops itself before the job does.** Playwright's `globalTimeout` ends the main project at 100
minutes with its report written; premium's exclusive step at 60 (13 min measured: two VM tests, each retried once in CI), the
gitops-mode step and free's exclusive step at 15; the job limit sits above the sum.
A job killed by its own limit uploads no report, and a run that grows too long should end with tests marked
"did not run", not with nothing.

**The nightly redeploys, and checks that it did.** Both instances redeploy the current release candidate each
night so the suite tracks Fleet. A deploy hook only queues a deploy, and Render keeps the previous instance
serving until the new one is live, so the instance answering says nothing about the deploy being done: the
wait polls Render's deploy API when its credentials are present (and fails on a failed deploy, the case the
instance itself never reports), else waits a fixed time; then `/healthz`; then a notice with each instance's
`version @ revision`, so a night's results are attributable to a build.

**The cron is off the top of the hour.** GitHub documents the start of every hour as its most-delayed slot for
scheduled workflows, and this repo's runs have been starting hours late. Nothing in the chain waits on a
clock, so the lag costs nothing but the start time.

**The runner image is pinned, not `ubuntu-latest`.** Every job names `ubuntu-26.04`, so the OS under the
nightly changes only in a commit that had its branch run, never when GitHub repoints the `-latest` label
(`ubuntu-latest` goes from 24.04 to 26.04 between 2026-10-19 and 11-19). The suite itself runs in the
`mcr.microsoft.com/playwright` container, so the host image matters to the gitops, verify and Render jobs: the
gitops action needs only bash, curl, jq, npm and the `fleetctl` npm package.

**A PR runs the static gate only.** The suites run against the shared instances, so a run per PR would have
PRs corrupting each other's state and the nightly's. A branch gets its full run once, at the end of a piece of
work, as `QA — Branch run`, dispatched by the person who owns the instances. `Playwright — Check` runs on every
PR with no path filter because it is a required status check, and a required check that never reports leaves a
PR unmergeable.

## What bounds a run

The work in a premium run splits into short browser tests and long host-bound waits: a test that installs
software on a VM holds its worker for minutes while polling, and the VM itself works one install at a time. So
two ceilings apply: total test-minutes divided by workers, and the longest per-platform host queue.

Measured on the same test set, 2026-09-29 to 09-30 (reconstructed from the reports with
`.claude/skills/playwright-run-reviewer/scripts/run_timeline.py`):

| workers | premium main step | test-minutes | Linux host-bound min | outcome | what bound it |
|---|---|---|---|---|---|
| 2 | 55.7 min | 110 | 32 | green | workers: both busy to the last minute |
| 3 | 41–43 min | 123–131 | 38–41 | green, twice | workers: all three busy to the last minute |
| 4 | 37.1 min | 148 | 51 | red: blank pages under load, a Mac live-query timeout, the longest Linux wait at 9.9 of its 10-min budget | the Linux queue and instance latency |

Reading it: each added worker converts some wall clock into queue contention (four Linux installs at once,
each waiting behind the others), which is why test-minutes rise with workers. Three is the last count at
which the run is still worker-bound and green. Four would need a single-worker lane per VM platform (so no two
tests share a host queue) and a remedy for the render latency under load before it is safe. A second VM per
platform, with a lease so two tests never pick the same host, is the only thing that shortens the host queue
itself. Front-loading the VM specs was considered and dropped: it would add contention, and the tail of a
three-worker run is short specs, not installs.

Free is small enough that none of this applies: two workers, worker-bound, about ten minutes.

## Changing it without breaking it

- **Adding a spec that waits on a real VM.** Give its describe a budget that covers the host's queue, not just
  its own work, and `retries: HOST_RETRIES`. Anything it can leave on the VMs fleet after a timed-out attempt
  needs a home in `setup/cleanup.steps.ts`; the per-run name prefixes (`pw-*`, `fleet-pw-*`) are what the sweep
  keys on.
- **Adding a project.** Name it in `PROJECT_TO_SUITE` (the config throws on an unknown `--project`), give it
  the tier's login setup as its dependency and `cleanup-teardown` as its teardown, and decide whether it can
  share an invocation with the main project. If it cannot, it is a new step in the suite workflow with its own
  blob directory, included in the merge, and a new pairing in the config's guard.
- **Adding a workflow that touches an instance.** Put it in that instance's concurrency group. Take a `ref`
  input on `workflow_call` so `QA — Branch run` can run it against a branch.
- **Changing a worker count.** One branch run with `-f workers=N`, then the timeline: if every worker is busy
  to the last minute the count still helps; if the tail is installs on one platform, or a VM describe sits
  near its budget, it does not. Record the result in the facts table with the date.
- **Judging a run.** `playwright-run-reviewer` owns that: `fetch_ci_run.sh` for the artifacts,
  `parse_report.py` for what failed and why, `run_timeline.py` for how it paced.
