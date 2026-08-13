---
name: playwright-run-reviewer
description: Use to triage a Playwright test run for this Fleet QA suite — decide, per failing or flaky test, whether it's flakiness, a buggy test, or a real Fleet product defect. Triggers on "review this run", "triage the run", "why did the suite fail", "was this a flake or a real bug", "check the nightly", "review the CI run", pasting a GitHub Actions run URL for the Playwright workflow, or pointing at a local playwright-report. Also use on a PASSED run to surface hidden flakiness (passed-on-retry), skips, and perf drift. This is a daily driver — reach for it whenever a run finishes and someone needs to know what's real.
---

You are triaging a Playwright run for Fleet's QA suite. The job is not to
restate what failed — the report already does that — but to reach a defensible
verdict for each failing or flaky test: **flaky**, **test-bug**, **product-defect**,
or **infra-env**, backed by evidence, so a human knows what to fix and what to
file. Speed and correctness both matter; you'll run this most days.

Work from `qa-automation/playwright/`. The suite conventions, projects, and
Fleet-specific locator/data gotchas live in `playwright/CLAUDE.md` — the two
sibling skills `playwright-test-author` and `playwright-test-reviewer` own test
*writing* and *code review*; this skill owns *run triage* and hands off to them
when the fix is a test change.

## 1. Locate and load the run

**CI run** (a GitHub Actions URL or run id — the usual case, since the nightly
`Playwright — Premium/Free` workflows run with `retries: 2`):

```bash
DIR=$(bash <skill>/scripts/fetch_ci_run.sh "<run-url-or-id>")
```

The script downloads the report artifact via `gh run download` and prints the
directory holding `index.html`. For extra context on the job (trigger, timing,
which step failed) `gh run view <id> --repo <owner/repo>` is cheap.

**Local run**: point straight at `playwright/playwright-report/` (the default
output dir). Locally `retries: 0`, so there's no automatic flake signal — see
the re-run guidance below.

Then extract a compact, triage-ready summary:

```bash
python3 <skill>/scripts/parse_report.py "$DIR" --slow 8
```

This reads the structured result blob embedded in `index.html` (far more
reliable than the terminal log) and emits JSON: run stats, and for every flaky
or unexpected test — every attempt's status, duration, de-ANSI'd error, and the
**absolute paths** to its screenshot, video, error-context, and trace. It also
lists the slowest tests for the perf note. Start every triage here.

## 2. Triage each test in the `attention` list

For each entry, reach a verdict using the evidence, not just the error string.
The full decision guide and Fleet-specific signatures are in
`references/fleet-failure-signatures.md` — **read it before classifying**; the
essentials:

1. **Let the retry pattern speak first.** `outcome: flaky` (failed then passed) →
   start from the flake hypothesis. `outcome: unexpected` with the *same* error on
   all attempts → deterministic, so it is **not** a timing flake however much it
   looks like one — dig into test-bug vs product-defect.
2. **Read what the page actually showed.** Open the `error-context` markdown (the
   accessibility snapshot at failure) and `Read` the screenshot. The error tells
   you where the assertion gave up; the snapshot tells you *why the page was in
   that state*. A "heading not found" whose snapshot shows a settled page in a
   different state (empty state, error banner, wrong scope) is a product/data
   signal, not a slow-load flake.
3. **Check the failing line against the source.** Open the page object / spec at
   the reported line. Verify the locator matches what Fleet's React source at
   `~/repositories/fleet/frontend/` currently emits, and whether the expected
   value came from live data or a stale hardcode. Cross-check API shape against
   `~/repositories/fleet/docs/REST API/rest-api.md` when relevant.
4. **Mine the trace only when you need the network truth.** The trace zip (first
   retry only) contains `*.network` entries — unzip and inspect when the verdict
   hinges on whether an API 5xx'd, returned empty, or returned the wrong shape.
5. **Rule out intentional product change.** Before calling product-defect, check
   Fleet's recent merged PRs / git log for a deliberate change that would make the
   test stale (that's a test-bug, not a regression). Remember the *queries→reports*
   / *teams→fleets* UI-vs-API terminology split.

Setup-project failures (`*-setup`, `cleanup-*`) are infra-env and usually cascade
— triage those first; downstream failures are often just collateral.

### Re-running locally to settle a verdict

Re-running the failing spec against the instance is a normal, high-value move —
not a last resort. It answers two questions the report alone can't (see the
README's run table for the exact scripts):

- **Flake vs real.** Locally `retries: 0`, so repeat the one test and watch the
  spread:
  ```bash
  cd playwright && npm run test:premium -- <spec> -g "<title>" --repeat-each=5 --workers=1
  ```
  Mixed pass/fail → `flaky`. Uniform failure → real; triage further.
- **CI-red vs live-real.** If the *current* local suite **passes** a spec that CI
  failed, the CI failure was a stale snapshot or a transient — not a live product
  or test problem. This is often the fastest way to resolve a mass red run (e.g.
  dozens of specs failing on one changed locator): one local pass of the current
  code settles whether CI was simply behind.

Know what a local run costs before you fire it:
- It targets the **same shared QA instance** as CI (`FLEET_URL` in `.env.<suite>`),
  and the premium/free projects run `cleanup-setup` + `cleanup-teardown` around
  every run — so even a `-g`-scoped run **wipes and repopulates** the unassigned +
  Workstations state. Scope to the one failing spec; don't loop the whole suite to
  chase a single test.
- It needs the local `.env.premium` / `.env.free` present (gitignored secrets).
- A scoped single-spec/single-test re-run is fair game to just run. A broad or
  full-suite re-run is disruptive to anyone else on the instance — say so first.

Never quietly bump a timeout or add a wait to make a red test green — that hides
product-defects (see the worked CVE example in the reference).

## 3. Output

Lead with a one-line run header (project, pass/fail counts, flaky count, duration)
and a verdict table, most-actionable first:

```
| Test | Verdict | Confidence | Why (one line) | Next step |
```

Then, per non-trivial finding, a short block: the evidence you used (snapshot
excerpt, screenshot observation, source line, trace network result), the
reasoning, and the concrete next step — a test fix (hand to `playwright-test-author`),
a re-run to confirm a flake, or a bug to file.

For a **suspected product-defect**, draft a ready-to-file Fleet bug — title,
environment, steps to reproduce, expected vs actual, and the snapshot/screenshot
as evidence — but **do not file it**; present it for the human to review and
submit. For a mostly-green run, keep it short: confirm the pass, then the flaky/
skip/perf notes worth a glance.

Save the full triage as a dated markdown report under
`playwright/docs/run-reviews/<date>-<project>.md` (create the dir if missing) so
daily runs build a history you can diff for recurring flakes. Print the table and
headline findings in chat regardless.

## Principles

- A verdict is a hypothesis with a confidence and a way to confirm it — say both.
  "Looks like a flake" without evidence is not triage.
- Start from the embedded report blob and the accessibility snapshot, not the raw
  log. Re-running locally is a normal next step to confirm flake-vs-real or
  CI-vs-live — scope it to the failing spec, and remember it wipes shared-instance
  state (flag a broad re-run before running it).
- Don't inflate the report. Intentional skips, setup-cascade collateral, and
  slow-but-passing tests are notes, not findings. The signal is the real defects.
- When you write or edit a comment in any file here, describe what the code is
  *doing*, never what changed — the reader hasn't seen the prior state.
