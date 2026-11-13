---
name: playwright-run-reviewer
description: "Triage a finished Playwright run of this Fleet QA suite: decide, per failing or flaky test, whether it is a flake, a test bug, a Fleet product defect or the environment, and what happens next. Use for 'review this run', 'triage the run', 'why did the suite fail', 'was this a flake or a real bug', 'check the nightly', 'review the CI run', a pasted GitHub Actions run URL or run id from this repo (QA — Nightly, QA — Branch run, or a Playwright suite workflow), or a local playwright-report. Also use on a passed run to surface tests that passed only on retry, skips and duration drift. Reach for it whenever a run finishes and someone needs to know what is real. Not for reviewing test source (playwright-test-reviewer) or for writing the fix (playwright-test-author)."
---

You are triaging a Playwright run for Fleet's QA suite. The job is not to
restate what failed — the report already does that — but to reach a defensible
verdict for each failing or flaky test: **flaky**, **test-bug**, **product-defect**,
or **infra-env**, backed by evidence, so a human knows what to fix and what to
file. Speed and correctness both matter; you'll run this most days.

Work from `qa-automation/playwright/`. The suite conventions, projects, and
Fleet-specific locator/data gotchas live in `playwright/CLAUDE.md`, and its
**CI and the shared instances** table holds the facts that change (the nightly's
shape and schedule, workers, retries, which reports a run uploads). The two
sibling skills `playwright-test-author` and `playwright-test-reviewer` own test
*writing* and *code review*; this skill owns *run triage* and hands off to them
when the fix is a test change.

## 1. Locate and load the run

**CI run** (a GitHub Actions URL or run id — the usual case; CI runs with
`retries: 2`, except a describe that waits on a real VM, which retries once
(`HOST_RETRIES`), and the `gitops-mode`, `gitops-verify` and `gitops-nightly`
projects, which don't retry). Look at the run's shape first — it's cheap and it
tells you where to spend the triage:

```bash
gh run view <id> --repo <owner/repo> --json name,conclusion,headSha,jobs \
  --jq '.name, .conclusion, .headSha, (.jobs[] | [.name, .conclusion] | @tsv)'
```

A chained run (`QA — Nightly`, `QA — Branch run`) is several Playwright jobs:
per tier, a gitops chain (applies plus `gitops-verify` checks and fleetctl CLI
checks, each its own Playwright report) and then the suite, which runs whatever
gitops did. **Triage a red gitops job first** — an apply that failed or a
config that drifted can explain suite failures downstream. A job that failed
before Playwright started (an install step, the deploy wait) has no report:
read it with `gh run view <id> --log-failed`, and say which suite never ran.

```bash
bash ${CLAUDE_SKILL_DIR}/scripts/fetch_ci_run.sh "<run-url>" "" <scratchpad>/run-<id>
```

Pass `OWNER/REPO` in place of `""` when you have a bare run id rather than a URL.
The third argument keeps the download in the scratchpad (without it, the script
uses a `mktemp` dir under `$TMPDIR`); give a re-run attempt of the same run id a
new directory, since the script reuses one that exists. It downloads every report
artifact via `gh run download` and prints one report directory per line, the suites'
(`playwright-report-premium` / `-free`) first. **Never triage just the first line of a chained run as "the run"** — parse
each suite, plus the report of any job that went red.

Reports are uploaded encrypted, one `<artifact>.tar.gz.enc` each: the script decrypts them in place with the
report key (`~/.config/qa-automation/report-private-key.pem`, or `QA_REPORT_KEY`) and stops with
instructions when the key is missing. A report holds live credentials (typed passwords in step titles, the
API token in traces and in failed API assertions), so **never paste its request headers, cookies or typed
values into a review, an issue or a PR**: quote the assertion and the page state, not the call log.

If `gh run download` (or `gh run watch`) stalls while the API still answers, fetch each
report's zip directly and poll the run's status instead:

```bash
gh api repos/<owner/repo>/actions/runs/<id>/artifacts --jq '.artifacts[] | [.id, .name] | @tsv'
curl -L -H "Authorization: Bearer $(gh auth token)" -o <name>.zip \
  https://api.github.com/repos/<owner/repo>/actions/artifacts/<artifact-id>/zip
gh run view <id> --json status
```

That zip endpoint 404s now and then, which is why the script doesn't use it first: retry it.

Then extract a compact, triage-ready summary:

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/parse_report.py "<report-dir>" --slow 8
```

This reads the structured result blob embedded in `index.html` (far more
reliable than the terminal log) and emits JSON: run stats, and for every flaky
or unexpected test — every attempt's status, duration, de-ANSI'd error, and the
**absolute paths** to its screenshot, video, error-context, and trace. It also
lists the slowest tests for the perf note. Start every triage here. An empty
attention list on a run that reported failures means the script no longer reads
this Playwright version's report: say so, don't report a clean run.

When the question is the run's *pacing* rather than its failures — the duration
moved, the worker count changed, a red run ended with tests marked "did not run",
or the tail needs explaining — lay the run out on one clock:

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/run_timeline.py "<report-dir>" --tail 10 --platforms
```

It prints the peak number of results in flight (the worker count that actually
applied — a merged report's `actualWorkers` metadata sums its invocations, so
don't read that field) and how busy each worker was, results in flight per
minute, the slowest files, every long result in start order with
its worker, what was still running in the last N minutes, and the worker time
spent in failed attempts. `--platforms` tallies host-bound minutes per real-VM
platform — from the test title when it names one, else from the platform the
spec's source resolves its host for — and lists what it had to call `mixed` or
`?`. Read the tail and the per-minute line together: workers all
busy to the last minute means the run is worker-bound; a tail of installs on one
VM means that host's serial queue is the floor, and no worker count moves it.

## 2. Before any single test: one cause, many rows

Most red nights are one cause wearing dozens of failures. Settle these three
before reading a spec, and give each cause **one row** with its count.

1. **The environment.** Many unrelated specs red at once, connection-class errors
   (`ECONNREFUSED`, `ETIMEDOUT`, 502s, MySQL "table is full", `ENOSPC`), or the same
   failure on both tiers point here. Check what the failures share: a real VM
   offline (the host picker's own message says since when — one Mac outage has
   been 55 red tests), an Apple token (every App Store or setup-assistant test),
   the instance's build (`GET /api/latest/fleet/version`), its disk. A failed
   `*-setup` or `cleanup-*` project cascades into everything after it, so triage
   it first — but it isn't infra-env by default: a wipe that can't remove what a
   person added by hand, or a helper calling a path that doesn't exist, is a
   **test-bug** in `setup/cleanup.steps.ts`. The cleanup is meant to self-heal.
2. **A Fleet change.** If the instance's build moved since the last green run,
   failures cluster by what Fleet changed. Right after an upgrade, read the
   preflight report (`docs/upgrade-preflight/`) and group the failures by Fleet
   change, one row per cluster. Between upgrades the release candidate still
   takes cherry-picks: diff tonight's revision against the last green run's
   (`git -C <fleet checkout> log <green>..<tonight> -- frontend server`). A
   serial describe stops at its first failure, so count "did not run" too: the
   red count is a floor on what broke.
3. **History.** Search `docs/run-reviews/` for the test's file and for the
   error's distinctive phrase, then `docs/blocked-by-product-bugs.md` and the
   signature catalog. A failure seen before isn't "a flake" again: say how many
   times and since when, and on the third sighting the next step is a fix, not
   another re-run. A race in a shared component (the fleet dropdown, the hosts
   list) shows up under a different test each time; search by the failing frame.

## 3. Triage each remaining test in the `attention` list

For each entry, reach a verdict using the evidence, not just the error string.
The full decision guide and Fleet-specific signatures are in
`${CLAUDE_SKILL_DIR}/references/fleet-failure-signatures.md` — **read it before classifying**; the
essentials:

1. **Let the retry pattern speak first.** `outcome: flaky` (failed then passed) →
   start from the flake hypothesis. `outcome: unexpected` with the *same* error on
   all attempts → deterministic, so it is **not** a timing flake however much it
   looks like one — dig into test-bug vs product-defect. Retries whose error
   differs from the first attempt's ("already exists") are the first attempt's
   residue: triage the first. A real-VM describe has two attempts, so its retry
   signal is weaker. A `gitops-mode`, `gitops-verify` or `gitops-nightly` test has
   one attempt and no retry signal at all: triage it as you would a local run.
2. **Read what the page actually showed.** Open the `error-context` markdown (the
   accessibility snapshot at failure) and `Read` the screenshot. The error tells
   you where the assertion gave up; the snapshot tells you *why the page was in
   that state*. A "heading not found" whose snapshot shows a settled page in a
   different state (empty state, error banner, wrong scope) is a product/data
   signal, not a slow-load flake.
3. **Check the failing line against the source.** Open the page object / spec at
   the reported line. Verify the locator matches what Fleet's React source
   currently emits (`frontend/` in the Fleet checkout: `$FLEET_REPO`, else
   `../fleet` beside this repo), and whether the expected value came from live
   data or a stale hardcode. Cross-check API shape against that checkout's
   `docs/API/rest-api.md` when relevant.
4. **Mine the trace only when you need the network truth.** The trace zip (first
   retry only; a failed `gitops-mode` test's only attempt) contains `*.network`
   entries — unzip and inspect when the verdict
   hinges on whether an API 5xx'd, returned empty, or returned the wrong shape.
5. **Rule out intentional product change.** Before calling product-defect, check
   Fleet's recent merged PRs / git log for a deliberate change that would make the
   test stale (that's a test-bug, not a regression). Remember the *queries→reports*
   / *teams→fleets* UI-vs-API terminology split.
6. **Ask who changed the state.** When a test fails on state it didn't expect (a
   setting flipped, a host moved, a leftover title), read the activity feed for
   the actor before blaming the spec: the suite's admin, the API token's user, or
   a person working on the instance.

The signals that split the verdicts once the environment is ruled out: the
failing frame is in the spec or page object (test-bug) vs in what Fleet sent back
(product-defect); the spec changed recently (test-bug) vs Fleet did (a deliberate
change, or a defect); the sibling tests on the same feature pass (test-specific)
vs fail together (shared cause).

For a verdict the retry pattern and the snapshot don't settle, write the competing
hypotheses before re-running anything: two to five, each falsifiable ("if the toast
matched the earlier save, the API will show the second value unchanged"), ranked,
and in the triage table when the re-run will take real time. Testing the first
plausible idea alone is how a flake gets "fixed" with a longer timeout.

### Re-running locally to settle a verdict

Re-running the failing spec against the instance is a normal, high-value move —
not a last resort. It answers two questions the report alone can't:

- **Flake vs real.** Locally `retries: 0`, so repeat the one test and watch the
  spread:
  ```bash
  npx playwright test --project=premium <spec-file> -g "<title>" \
    --repeat-each=5 --workers=1 --output=<scratchpad>/rerun
  ```
  Mixed pass/fail → `flaky`. Uniform failure → real; triage further. A suspected
  flake that hasn't failed once in 20 repeats isn't reproduced yet: raise the odds
  (two workers, the siblings that share its state, the VM's queue busy) before
  calling it "not reproducible". A fix for a flake is proven by a clean run of at
  least the count that showed the failure, never by one pass.
- **CI-red vs live-real.** If a local run of that one spec, on today's code,
  **passes** what CI failed, the CI failure was a stale snapshot or a transient —
  not a live product or test problem. This is often the fastest way to resolve a mass red run (e.g.
  dozens of specs failing on one changed locator): one local pass of the current
  code settles whether CI was simply behind.

<!-- shared:scoped-run -->
**A local run is scoped, and never `npm run test:<tier>`.** From `playwright/`:
`npx playwright test --project=<tier> <spec-file-names>`, with `premium` or `free` (both, for anything in
`shared/`), `<tier>-exclusive <file-name>` for an `exclusive/` spec (its own invocation, never beside the main
project), and `npm run test:gitops-mode` for a `gitops-mode/` one. Three things turn a scoped run into
something else:
- `npm run test:<tier> -- <spec>` runs the **whole** suite: npm appends the arguments after the script's
  final `exit`, so no `playwright test` sees them.
- A spec list passed through a shell variable matches nothing and still exits green: the Bash tool's zsh
  doesn't word-split `$VAR`. Type the file names out, and read the run's test count before believing a pass.
- Another run on the instance. `gh run list --limit 5` first: two runs on one VM corrupt each other, and the
  nightly starts hours after its cron. A run **with dependencies** wipes global reports and policies and
  Unassigned's scripts, packages and profiles, so when another session is on the instance, announce the run
  ("<specs> on <tier>, ~N min") and wait for its go.
<!-- /shared:scoped-run -->

A re-run needs the local `.env.premium` / `.env.free` (gitignored secrets), and
it brings the real VMs to their resting state around your test. Scope it to the
failing spec, and ask before any broad or full-suite re-run.

Never quietly bump a timeout or add a wait to make a red test green — that hides
product-defects (see the worked CVE example in the reference).

## 4. Output

Lead with the run's header: the workflow and run id, the commit, each instance's
Fleet build, and per job its passed / failed / flaky / skipped / did-not-run
counts and duration. Then a verdict table, most-actionable first, with one row
per cause from section 2 before the single tests:

```
| Test or cause (count) | Verdict | Confidence | Seen before | Why (one line) | Next step |
```

Then, per non-trivial finding, a short block: the evidence you used (snapshot
excerpt, screenshot observation, source line, trace network result), the
reasoning, and the concrete next step — a test fix (hand to `playwright-test-author`),
a re-run to confirm a flake, or a bug to file.

<!-- shared:product-bug -->
**A Fleet bug is filed, skipped narrowly and tracked, never coded around in silence.** Search Fleet's issues
first. Tell Andrey what you found and, on his go, file it with the `fleet-qa:fleet-bug-file` skill. Then skip
the **narrowest** failing variant (`test.skip(osKey === 'deb', …)`), with `TODO(fleetdm/fleet#N)` at the site
and a row in `playwright/docs/blocked-by-product-bugs.md`. A flow *adjusted* around an open issue instead of
skipped (a reload before a search, a throwaway fleet) gets the same TODO and a row under "Worked around in
the suite". Lift either only after the flow passes on the fixed build, having seen it fail on the old one.
Two things that look like bugs and aren't: a race only the osquery-perf simulations' bursts can reach is a
data quirk (explain it, route around it, draft no bug unless asked), and a Save or Add button that is now
always enabled is Fleet's design direction (validation moves to submit), so the test is stale.
<!-- /shared:product-bug -->

For a suspected product-defect, the finding block carries what the bug report
needs: the build, steps to reproduce, expected against actual, and the snapshot
or screenshot. For a mostly-green run, keep it short: confirm the pass, then the
flaky / skip / perf notes worth a glance — and, when the duration moved, one line
on why, from `run_timeline.py`.

Save the full triage as
`playwright/docs/run-reviews/<date>-<nightly|branch|local>-<run id>.md` (a local
run has no id: use a short slug), so the next triage's history search finds it. Print the table and headline findings in
chat regardless.

**Afterwards.** A triage that ends at the write-up loses its findings. Before you
finish, say which of these you did or handed over:
- a test-bug, or a flake on its third sighting → `playwright-test-author`, with
  the review's path;
- a new failure signature → a line in the signature catalog;
- a skip or workaround that is now fixed on this build → lifted (the author
  skill's `references/after-the-pr.md`);
- a helper or cleanup weakness noticed on the way (a swallowed error, a leftover
  the sweep misses) → named as a follow-up in the review, not just in passing.

## Principles

- A verdict is a hypothesis with a confidence and a way to confirm it — say both.
  "Looks like a flake" without evidence is not triage.
- Start from the embedded report blob and the accessibility snapshot, not the raw
  log.
- Don't inflate the report. Intentional skips, setup-cascade collateral, and
  slow-but-passing tests are notes, not findings. The signal is the real defects.
- When you write or edit a comment in any file here, describe what the code is
  *doing*, never what changed — the reader hasn't seen the prior state.
