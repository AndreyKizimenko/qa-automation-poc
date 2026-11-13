# The report: ticket comment and decision list

Used by fleet-bug-qa (step 8), fleet-bug-retest (step 5) and fleet-loadtest-qa (step 8). Read it once
the rows are in, before writing anything for the ticket. By then the run is long, and this is the
part people read.

Three documents, three readers:

- **The ticket comment** is for a manager asking "is it fixed, and how broadly was it checked?": a
  verdict line and the matrix, plus only the findings the engineer chose to include. Nothing else.
- **The decision list** (chat and RESULTS.md) is for the engineer: every finding, so they decide
  what's worth filing or mentioning. Its format and what happens after they answer are in
  `findings.md`, beside this file.
- **`RESULTS.md`** is the lab notebook: setup, mechanism, drivers, payloads, automated-test runs,
  everything needed to trust or rerun the work.

## Counting

`X/Y` means X passed out of Y rows actually exercised live on the fixed instance by this QA. Rows that
were blocked, didn't reproduce, or are backed only by the PR's automated tests are not in Y. They show
in the verdict instead, and the scope sentence must not claim them ("covered all three vectors" when
one was proven only by tests is an overclaim).

## Plan and matrix

Every row in `plan.md` ends up in the matrix, or in RESULTS.md with the reason it was dropped. Keep
the three types honest: a regression row doesn't quietly become halo. A row the engineer ran by hand
is a row like any other; add it.

## Verdict

- **Pass**: every core row has its before (reproduced on pre-fix, or the filing-time repro when the
  engineer waived a rerun) and passes on fixed; no blocking findings.
- **Pass with notes**: as above, with non-blocking findings the engineer chose to mention, or one core
  vector proven only by the 4b fallback rather than live.
- **Fail**: a core row fails on fixed, or an "Introduced by this fix" finding blocks.
- **Cannot reproduce**: the bug never reproduced on any baseline, including by hand in a real browser
  for UI bugs and by the engineer when asked. The fixed behavior looks fine, but the fix isn't
  verified.

The verdict is about the bug the ticket describes. A residual that takes something a customer is
unlikely to do (two admins acting in the same second, an input nobody would use) doesn't fail a fix.
It's a decision-list row with your recommendation, and the verdict stays Pass: say the residual in
one sentence and let the engineer overrule you. Twice a Fail over a residual like that became a Pass
once the engineer saw it.

## The comment

Save it to `qa-<N>/issue-comment.md` **including** the four-backtick fence, and print the same block
in chat:

````markdown
QA **<verdict>** — <X>/<Y> checks on `<fixed branch>` vs `<pre-fix branch>`. <One sentence of scope: what was covered at a high level, e.g. "Reset + automation_activities on all API prefixes, host-scoped resets across fleets, role matrix, activities and counts.">

| # | Type | Case | Pre-fix | Fixed |
|---|---|---|---|---|
| 1 | Core | <case, in user terms> | ❌ reproduced | ✅ <observed, few words> |
| 2 | Regression | <case> | ✅ | ✅ unchanged |
| 3 | Halo | <case> | ✅ | ✅ |
````

Keep it to that. Setup, mechanism, test data, automated-test tables and driver details live in
RESULTS.md, not the comment: the reader wants the outcome, and PR tests passing is assumed. Add a
sentence under the matrix only when a row's significance isn't obvious (e.g. "Row 10: pre-fix, Enter
silently saved the first script — the real user impact").

Cells in the Pre-fix column:

- `❌ reproduced`: a core row that showed the bug in this run.
- `❌ at filing (<build>)`: the engineer waived a rerun, so the before is the tracker entry's or the
  issue's own repro. When no pre-fix instance was used at all, the first line reads
  "checks on `<fixed branch>`; before: the filing-time repro on `<build>`".
- `✅`: the baseline for a regression or halo row.
- `➖ n/a`: the case can't exist pre-fix.
- `➖ proven by PR tests`: the 4b fallback, never a plain ✅.

One comment per ticket when the run covers several. An interim comment (a first iteration, a row
still blocked on the engineer) is fine when they ask for one: the same format, with the open rows
marked `⏳ <what it waits on>`.

## Then

Print the decision list, outside the comment's block (`findings.md`). Name the screenshots already
sent. When the engineer answers, fold in what they chose and print the whole comment again without
being asked; the same after any row is rerun or added.
