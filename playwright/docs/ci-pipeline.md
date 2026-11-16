# How a run works, and why it is shaped this way

The reasoning behind the CI flow: what runs where, in what order, and what each choice protects. The numbers
that change — worker counts, runtimes, the cron, which reports a run uploads — live in one place,
[`CLAUDE.md` → *CI and the shared instances*](../CLAUDE.md#ci-and-the-shared-instances--current-facts), and this
document points there rather than repeating them. The workflow map (one row per workflow; tier twins share one) is in the
[repo README](../../README.md#ci). Per-run triage history is in [`run-reviews/`](run-reviews/) (gitignored).

## The shape

```
QA — Nightly (one chain, both tiers)
  render deploy hooks ─► wait for the deploys + /healthz + "which build is this" notice
    ├─ premium: gitops chain ─► premium suite job
    └─ free:    gitops chain ─► free suite job          (the two tiers side by side)

a gitops chain            apply baseline → verify → apply min → verify → fleetctl checks
a suite job (premium)     main project (4 workers) → exclusive specs (1 worker) → gitops-mode (1 worker) → merge reports
the per-OS smokes job     after premium's suite job: the premium-matrix project (6 workers), with a report of its own
the disk-encryption job   after the smokes: the premium-encryption project (6 workers), with a report of its own
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
2. **A small pool of real VMs per platform, one queue each.** The device lab's pool: on premium four Ubuntu,
   two Windows and two macOS VMs, on free one of each (`lab-hosts.json`). Each runs one queue: scripts,
   installs and uninstalls execute one at a time per host. Profiles travel a separate channel (MDM commands),
   inventory a third (refetch). Each worker is handed its own VM of a platform (`pool[parallelIndex %
   pool.length]`), so two tests share a host's queue only where a platform has fewer VMs than the run has
   workers. Roughly 300 osquery-perf simulations sit beside them for volume work and prove nothing about
   host-side behaviour.
3. **Some settings are global locks.** Turning script execution off stops every script run on the instance.
   Turning gitops mode on makes every mutating control read-only. A spec that flips one breaks whatever runs
   beside it.
4. **The instance is the bottleneck, not the runner.** More concurrent browser sessions surface as slow
   renders and navigation timeouts before they surface as anything else.

## Why each piece is the way it is

**Two tier chains, side by side.** The tiers are different instances, so nothing is gained by serialising them
and nothing is risked by not doing so. Each chain holds its instance's concurrency group
(`<tier>-fleetqa-instance`), shared by the gitops workflows and the suite workflow, so an apply and a test run,
or two test runs, queue instead of overlapping. The callers (`QA — Nightly`, `QA — Branch run`) take no instance
group: a caller in the same group would wait on its own callees. `QA — Nightly` holds only `qa-nightly-chain`, so
a second nightly (a manual one beside the scheduled one) queues instead of redeploying the instances under a
running suite; `QA — Branch run` holds none. The four apply workflows
(`gitops-{premium,free}{,-min}.yml`) take their own per-tier group when called, since the orchestrator already
holds the instance's, and the instance group itself when **dispatched by hand** (their `caller` input is unset
then): an apply deletes whatever its config doesn't declare, a running test's per-run items included, so a
manual apply waits for a running suite instead of overlapping it.

**gitops before the suite, and the suite runs whatever gitops did.** The suite assumes the instance is in the
declared state (the Workstations, QA, VMs, OS matrix and Compliance fleets exist; the VMs fleet carries the
durable software fixtures; OS matrix carries nothing). Applying first makes that true every night. After each
apply, `gitops-verify` runs against every file that apply carried — on premium the no-team config, Workstations,
Compliance, QA, VMs and OS matrix, with the QA, VMs and OS matrix files verified after both the baseline and
the min apply, since both carry them unchanged; the second pass proves the min apply left them alone. Compliance is the fleet with no hosts that carries every host-affecting
control, so its verify is the only place those are checked. The suite runs even if a gitops step is red, in the
nightly and in a branch run alike: a failed apply or check is its own signal and already fails the run, and the
suite's results are still wanted. A branch run that stopped there would leave the branch's tests unjudged until a
second dispatch, even when the gitops failure has nothing to do with them. The fleetctl checks
(`generate-gitops`, `gitops --dry-run`) sit inside the gitops chain on purpose: the suite's `cleanup-setup`
drains every global report and policy, after which neither comparison means anything.

**Cleanup is owned by the suite and runs twice.** gitops cannot remove what it never declared (a profile
uploaded through the UI, a leftover script), so the wipe lives in `setup/cleanup.steps.ts` and runs as a
dependency before the first test and as a teardown after the last. The pre-run pass makes a run self-healing
however the instance got into its state; the post-run pass leaves it clean for whoever is next. It also puts
back the global locks (gitops mode off, script execution on) and brings the real VMs to their resting state,
because a Playwright teardown does not run on a `SIGKILL` and a stuck lock would disable the *next* run's
entire suite. The wipe touches the global scope and Unassigned (reports, policies, packs, scripts, profiles,
installable titles; the suite's own users, enroll-secret markers and `PW_VAR_*` variables), Workstations, any
throwaway `pw-*` fleet, version pins on QA and VMs, and the suite's own `pw-*` / `fleet-pw-*` things on the VMs
fleet; the durable fixtures gitops declares are never deleted.

**Projects are routed by folder, not by tag.** `tests/e2e/shared/` runs on both tiers, `premium/` and `free/`
on one; the `testIgnore` matrix in `playwright.config.ts` is the source of truth. A tag has to be remembered on
every spec and can be wrong silently; a folder cannot.

**The specs that hold a global lock run alone, as their own invocation — not as a dependent project.** The
exclusive specs (script execution off; a script timeout lowered for every VM on the fleet; a policy automation
that needs an Ubuntu VM's queue to itself — Fleet runs its attempts below every user-requested activity) and
gitops-mode live in their own projects on one worker, and CI runs
each as a separate `playwright test` step after the main project, pass or fail, merging the blob reports into
one HTML report. A Playwright *dependency* on the main project would have done the ordering but with the wrong
failure semantics: one unrelated red test skips every dependent, and a local run of the small project would
first re-run the whole suite. So they depend on login setup only, and the config refuses to name one of them
beside another browser project in a single invocation, because side by side is exactly what they exist to
avoid. The order between the two steps does not matter; both put their lock back in their teardown, and
`cleanup-setup` would anyway.

**The per-OS smokes are a workflow of their own, chained after premium's suite.** `premium-matrix` runs one
spec: the same few checks on the matrix host of each OS flavour and on a pool VM of each OS version the pool
holds (`tests/e2e/premium/matrix/os-smokes.spec.ts`). `Playwright — OS smokes` (`playwright-os-smokes.yml`) is
built like the two suites' workflows: its own login, cleanup teardown and encrypted report
(`playwright-report-os-smokes`), and premium's concurrency group, because it works the pool's VMs and puts
per-test things on the OS matrix fleet, which a suite queues on and a gitops apply deletes. A group gives no
overlap, so in a chain it costs a few minutes over a step of premium's job (a checkout, `npm ci`, a login, a
second cleanup). What it buys is that the smokes can be run and re-run alone, after a lab change or one
flavour's red night, and that a run's page shows them as their own line. Each host works its own queue, so
one worker walks one host through its smokes (`mode: 'default'` per OS) while the others walk theirs; only
the three Windows matrix hosts take turns, because they share one `.msi` title on the fleet. That is why the
job runs at 6 workers where premium's suite runs at 4: no pool is shared, most of a smoke is a wait on its
host: 57 test-minutes in CI are 12 minutes at 6 workers, nothing retried (branch run 43690094173). The
Windows turn, declared first so it starts with the run, is the floor: more workers than that buy nothing. The nightly
runs it after premium's suite, whatever that did; a branch run leaves it out unless dispatched with `-f
os-smokes=true`, which a branch that touches the smokes, the lab manifest or what they stand on should be.

**The disk-encryption tests are a workflow of their own too, chained after the smokes.** `premium-encryption`
(`tests/e2e/premium/encryption/`) moves one of the lab's encrypted hosts at a time off OS matrix onto a
throwaway `pw-*` fleet with one disk-encryption setting on, drives the flow in the browser, and moves it back,
which clears what Fleet recorded. Five of its hosts are matrix hosts the smokes run on, which is why it runs
after them and never beside them (the config refuses `premium-encryption` beside `premium`,
`premium-exclusive` or `premium-matrix`), and why it holds premium's concurrency group. `Playwright — Disk
encryption` (`playwright-encryption.yml`) is built like the smokes' workflow: its own login, cleanup teardown
and encrypted report (`playwright-report-encryption`). A real disk key reaches the page in these tests, so
the project keeps no trace, screenshot or video. It runs at 6 workers for the smokes' reason, one host each:
about 37 test-minutes are 11 or 12 minutes, the BitLocker test and the Server's ten minutes each the floor.
A branch run leaves it out unless dispatched with `-f encryption=true`.

**The gitops-mode exceptions are restored before every premium apply, not by the suite.** Unlike the mode flag,
the exceptions act outside gitops mode: `fleetctl gitops` reads them on every apply, so a stuck `secrets: false`
makes it delete every enroll secret (premium's YAML declares none) and a stuck `labels` or `software: true` makes
it refuse the YAML. The gitops chain runs before the suite's `cleanup-setup`, so a restore there would come one
apply too late. The gitops-mode teardown puts them back at the end of every gitops-mode step, and
`.github/scripts/restore-gitops-exceptions.sh`, the first step of `gitops-premium.yml` and
`gitops-premium-min.yml`, puts them back if that teardown never ran. Nothing can declare them, so the baseline is
pinned in that script and in `GITOPS_EXCEPTIONS_BASELINE` (`helpers/api/gitops-mode.ts`).

**Worker counts are measured, not guessed.** The count is per tier because the instances differ, and it is a
CI-only number: locally the default is 4 and the specs that touch a VM are run with `--workers=2`. The
measurements that set the current numbers are in [*What bounds a run*](#what-bounds-a-run). A trial at another
count is a branch run with `-f workers=N`, read with `run_timeline.py` (below), never a config commit first.
The input sets premium's count only: free has one VM per platform and a smaller instance, and always runs at
its own.

**Retries: two, except where an attempt is long.** CI retries so that a transient does not fail a night; a
pass on retry is reported as `flaky` and triaged as such. Every describe that waits on a real VM takes one retry
(`HOST_RETRIES`): its attempts run 10–25 minutes (`recovery-lock`'s is 25) and a wedged host fails every attempt
the same way, so three attempts of two 15-minute tests are 90 of a run's roughly 300 worker-minutes and can reach
the run's own stop. The `gitops-mode`, `gitops-verify` and `gitops-nightly` projects take no retries: a gitops
failure or a drift is something to read, not to retry away. Locally there are no retries, so repeating one test
shows its real spread.

**The run stops itself before the job does.** Playwright's `globalTimeout` ends the main project at 100
minutes with its report written; premium's exclusive step at 60 (13 min measured: two VM tests, each retried once in CI), the
gitops-mode step and free's exclusive step at 15; the job limit sits above the sum. The per-OS smokes stop at 45, in a job limited to 60, and so do the disk-encryption tests.
A job killed by its own limit uploads no report, and a run that grows too long should end with tests marked
"did not run", not with nothing.

**The nightly redeploys, and checks that it did.** Both instances redeploy the current release candidate each
night so the suite tracks Fleet. A deploy hook only queues a deploy, and Render keeps the previous instance
serving until the new one is live, so the instance answering says nothing about the deploy being done: the
wait polls Render's deploy API when its credentials are present (and fails on a failed deploy, the case the
instance itself never reports), else waits a fixed time; then `/healthz`; then a notice with each instance's
`version @ revision`, so a night's results are attributable to a build. If that wait fails — a failed deploy, one
not live within 30 minutes, or an instance still unhealthy 15 minutes later — neither tier's gitops chain or suite
runs that night. A failed deploy hook alone doesn't stop it: that instance keeps its previous build and the night
runs against it.

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

**A report never leaves CI in the clear.** A Playwright report holds live credentials. The HTML report writes
every typed value into its step titles, so the admin, static-user and SSO passwords are in every report, green
or not. A trace records the `Authorization` header of every API call, and a failed `expect(res).toBeOK()`
prints its request headers into the error text (the suite checks responses with `expectOk`, which prints
none, and lint refuses `toBeOK`). This repository is public, and anyone signed in to GitHub can download a
public repository's artifacts. So every workflow uploads through one action, `.github/upload-report`, which
packs the report and encrypts it to the public key committed at `.github/report-public-key.pem`; the artifact
is a single `<name>.tar.gz.enc`, and the jobs that run the tests hold no key that opens it. The step fails closed: a report that can't
be encrypted isn't uploaded. Two checks keep it that way. `.github/scripts/check-artifacts.sh`, a step of the
required `Playwright — Check`, fails a PR that uploads or publishes anything from a run by another route, or
that edits the action to stop encrypting. `Report upload — Check` runs the action once in the suites' own
container whenever the action, the script, the key or a suite workflow changes.

**A suite's report also carries the run as data, and is kept 90 days.** The merge step writes `results.json`
(Playwright's JSON reporter) beside the HTML report and copies it into the report folder, so it leaves CI
inside the same encrypted file. A test's history is built from it: `run_history.py`, in the run-reviewer
skill, records each reviewed run's tests in a local file and says how a failing test fared in the runs before.
The two suite reports are kept 90 days so that history can be rebuilt from the reports alone.

**A run's artifacts are the two suite reports, and the report of any gitops job that failed.** Each gitops
chain is a row of small Playwright jobs (premium twelve `gitops-verify` and one `fleetctl` job, free two and
one). A green one uploads nothing: its report would be a list of passed API checks that nobody opens, its log
already lists each check (the `list` reporter), and sixteen such artifacts beside the suites' two bury what
there is to read. A failed one uploads its report, named for the job, and keeps it 7 days. So a run's artifact
list reads as what there is to look at: Premium, Free, and whatever in gitops went red.

**The run page's annotations work the same way.** The suites run with the `github` reporter, which adds one
"Run Summary" annotation per invocation (free two, premium three: its main project, exclusive specs and
gitops-mode; the per-OS smokes and the disk-encryption tests one more each) with the counts and the flaky tests, and an annotation for each failure. The gitops jobs run with
`list` instead (the config's CI reporter), so a green one adds none, and `reportSlowTests` is off, since the
slow files are slow by design. A green nightly's page carries those seven summaries and nothing else.

**One job reads reports in CI, and prints only what is safe to print.** `run-history`, the last job of the
nightly and of a branch run, writes into the run's summary how each failed or flaky test fared in the 14
nightlies before, and whether the error is the same one, so a first sighting and a fifth don't look alike. It
is given the report private key as the secret `QA_REPORT_PRIVATE_KEY`, downloads those nights' suite reports,
decrypts them in the runner's temp directory and builds the history there with `run_history.py`. Giving CI
the key costs nothing it didn't already hold: every credential a report contains is an Actions secret already.
What matters is what the job says in public, and `.github/scripts/run-history-summary.sh` holds that rule:
test files and titles, outcomes, retry counts, error hashes, run ids and dates, never an error's text.
`check-artifacts.sh` fails a PR that names the secret anywhere but this workflow and the two that call it.
The job is a summary, not a gate: without the secret, or without a report to read, it says so and passes.
The alternative, a branch of non-secret history lines that CI pushes to, was set aside (2026-11-13): it needs
a CI job with write access and makes a permanent public record, for a longer memory than triage uses.

The private key lives with the people who read reports: `~/.config/qa-automation/report-private-key.pem`, or
wherever `QA_REPORT_KEY` points, with a copy in 1Password, and in the repository's `QA_REPORT_PRIVATE_KEY`
secret for the `run-history` job. `fetch_ci_run.sh` decrypts with it. Losing it loses only the reports still
in retention: `node .github/scripts/report-crypt.mjs keygen` makes a new pair, the new public key is
committed, and the secret is set again
(`gh secret set QA_REPORT_PRIVATE_KEY < ~/.config/qa-automation/report-private-key.pem`). Encrypting a report doesn't make it safe to quote. Before a piece of one goes
into an issue, a PR or a review, check it for request headers and typed values;
`.github/scripts/scan-report-secrets.py` lists which of the suite's secrets a report holds, and where.

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
each waiting behind the others), which is why test-minutes rise with workers. Three was the last count at
which the run was still worker-bound and green. Those runs had one VM per platform. Front-loading the VM specs
was considered and dropped: it would add contention, and the tail of a three-worker run is short specs, not
installs.

**Since 2026-11-15 each worker has its own VM** of a platform, out of the device lab's pool (constraint 2), so
the Linux queue no longer couples the workers: at four workers each has an Ubuntu VM to itself, and Windows
and macOS are shared two ways. That removes two of the three reasons the four-worker run was red (four Linux
installs on one VM; three specs on one Mac). The third, blank pages under load, is the instance's, and it
didn't show in the run that tried it: branch run 43753582054 (2026-11-15, `-f workers=4`) was green with
nothing retried.

| workers | premium main step | test-minutes | outcome | what bound it |
|---|---|---|---|---|
| 3 | 32.6 and 35.6 min | 97 and 106 | green, twice (43690094173, 43696536354) | workers: all three busy to the last minute |
| 4 | 27.3 min | 108 | green (43753582054) | workers: four results in flight in every minute |

Read with `run_timeline.py --platforms`, whose per-VM lines show which workers each VM served and whether any
held two results at once: each Ubuntu VM and each Windows VM held one result at a time, each Mac two at some
moment. **Premium runs at four since.** It is one run's evidence, so the nightlies' run history is what
watches the count. [`device-lab-plan.md`](device-lab-plan.md) › *Steps B + C* has the trial.

At three workers the pool took premium's main project from 41.4 to 32.6 minutes (nightly 43413291769 against
branch run 43667531465): 26 fewer test-minutes, nearly all of it VM tests that had queued behind each other
on one Ubuntu VM, over three workers still busy to the last minute. So the main project stays worker-bound,
and what the pool frees is waiting, not work: an install and the refetch after it take minutes on any VM.
The exclusive step's fourteen minutes are outside both, on one worker after the main project.

Free is small enough that none of this applies: two workers, worker-bound; its runtime is in the facts table.

## Changing it without breaking it

- **Adding a spec that waits on a real VM.** Give its describe a budget that covers the host's queue, not just
  its own work, and `retries: HOST_RETRIES`. Anything it can leave on the VMs fleet after a timed-out attempt
  needs a home in `setup/cleanup.steps.ts`; the per-run name prefixes (`pw-*`, `fleet-pw-*`) are what the sweep
  keys on.
- **Adding a project.** Name it in `PROJECT_TO_SUITE` (without it the config can't resolve its tier when
  `SUITE` is unset, and the guards that refuse a bad pairing don't see it), give it
  the tier's login setup as its dependency and `cleanup-teardown` as its teardown, and decide whether it can
  share an invocation with the main project. If it cannot, it is a new step in the suite workflow with its own
  blob directory, included in the merge, and a new pairing in the config's guard.
- **Adding a workflow that touches an instance.** Put it in that instance's concurrency group. Take a `ref`
  input on `workflow_call` so `QA — Branch run` can run it against a branch.
- **Changing a worker count.** One branch run with `-f workers=N` (premium's count), then the timeline: if every worker is busy
  to the last minute the count still helps; if the tail is installs on one platform, or a VM describe sits
  near its budget, it does not. Record the result in the facts table with the date.
- **Uploading anything from a run.** Through `./.github/upload-report`, never `actions/upload-artifact`
  directly, and never to Pages, a release or a gist: the PR check refuses those. Something that provably holds
  no report, trace, screenshot, log or environment says so on its line, `# unencrypted-ok: <reason>`.
- **Judging a run.** `playwright-run-reviewer` owns that: `fetch_ci_run.sh` for the artifacts (it decrypts them),
  `parse_report.py` for what failed and why, `run_timeline.py` for how it paced.
