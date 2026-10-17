# The session file

One file per session, `explore-<yyyy-mm-dd>-<slug>.md`, in `<QA workspace>/qa-<N>/explore/` when
the session follows a ticket's run and in `<QA workspace>/explore/` otherwise. The charter goes at
the top, the log fills in as the session runs, and the debrief closes it. The engineer reads the
debrief; the log is there when they want the detail, and `fleet-bug-file` reads both when a
finding gets filed.

## Tags

One tag per row that needs action, none on rows that are just the record.

| Tag | Means | Reaches the debrief as |
|---|---|---|
| **BUG** | Wrong, and reproduced three times with the same steps | Decisions needed |
| **QUESTION** | Can't tell whether it's intended; the spec, docs and sibling pages don't settle it | Questions for product |
| **IDEA** | A case the Playwright suite should own: stable, unambiguous, worth running nightly | Candidates for the suite |
| **RISK** | Nothing broke, but it's one realistic step away: an unbounded field, no fallback, no limit anywhere | Risks (mention / drop, or a test-plan row) |
| **NOTE** | Interesting and not actionable, including anything that wouldn't reproduce and known issues met again | Stays in the log; one line in chat if it matters |

Rules the log follows:

- Timestamps are real (`date +%H:%M`), so the debrief can say how long a tour took and the engineer
  can line rows up with server logs.
- Inputs are exact: the string, the count, the role, the endpoint. "A long name" can't be replayed;
  "the 200-character name from the catalog, via `PATCH /api/v1/fleet/fleets/31`" can.
- Observations say what the page or response showed, never "works" or "fine". "Settled in ~1 s,
  three rows, console quiet" is an observation.
- A BUG row has reproduced three times and names its screenshot; a NOTE row for something that
  wouldn't reproduce says what was tried.
- Screenshots are numbered in order (`01-run-title-768.png`) and named in the row that produced
  them.
- Say which tour each block of rows belongs to, and mark leaving and returning to the charter.

## Template

```markdown
# Explore: policy-automation-run-detail

- **Charter:** Explore the policy automation run detail page with a fleet of 21 simulated hosts, a
  200-character policy name and a script that fails on half of them, to discover what the page
  shows while a run is partial and what long names do at the page's widths.
- **Budget:** 60 actions / 45 min · **Started:** 2026-10-17 14:05 · **Ended:** 14:52 (58 actions)
- **Instance:** `default`, rc-minor-fleet-v4.95.0 (a1b2c3d), Premium, Apple + Windows MDM on
- **Follows:** qa-55612 (story QA) · **Setup:** fleet `qa-explore-runs` (id 31), 21 ubuntu sims,
  policy "Compliance – …" (id 412), script `qa-explore-fail-half.sh`
- **Tours planned:** worst-case data, tables, second door, interruption
- **Questions:** might break → "the hosts table while the run is partial"; tricky → "the URL params"
  (or: unasked, autonomous run)
- **Manifest:** `explore/created.txt` · **Data folder:** `run-detail-data/` (names, diffs, evidence)

### Charters proposed
1. ★ (this session) The run detail page with partial results and worst-case names.
2. The same page as the fleet observer and technician, to discover what each can trigger.
3. Policy automations' list page with 20 and 21 runs, to discover what paging and the counts do.

## Surface

| Value | Source | Limit |
|---|---|---|
| policy name | form field; `PATCH …/policies/:id` | 255, from the form's `maxLength`; the API accepts more |
| policy description | form field; API | unbounded (RISK) |
| host count, pass/fail counts | computed per run | n/a |
| run started / finished | server timestamps, relative in the UI | n/a |
| per-host status badge | enum: pending, passed, failed, error | every value at once |

## Log

| Time | Where | Action / input | Observation | Tag | Follow-up |
|---|---|---|---|---|---|
| 14:07 | Policies › run 14 | orient: open a finished 3-host run | settles ~1 s, 3 rows, console quiet | | baseline |
| 14:09 | *worst-case data* | | | | |
| 14:11 | run 14 | policy renamed to the 200-char catalog name via API; reload | title wraps to 3 lines, Actions menu pushed below it; at 768 the menu is off-screen | BUG | 01-run-title-1280.png, 02-run-title-768.png; repro ×3 |
| 14:15 | run 14 | name `O'Brien & Sons "West" <Lab>` | rendered as text everywhere, incl. the activity | | held up |
| 14:19 | *tables* | | | | |
| 14:20 | run 15 (21 hosts) | page 2 | page 1 says "Showing 21 of 21"; page 2 is empty | BUG | 03-page2-empty.png; repro ×3; `GET …/runs/15/hosts?page=1` returns `[]` |
| 14:24 | same, `previous` | the two probes above | same on rc-patch-fleet-v4.94.1 | NOTE | both released, not this story |
| 14:28 | *second door* | | | | |
| 14:29 | API | `POST …/runs/15/reset` twice, 0.2 s apart | 200 both; one new run; one activity | QUESTION | intended, or should the second be 409? |
| 14:33 | left charter: policies list | the label chip shows "1 labels" | | NOTE | back 14:35; pluralisation, cosmetic |
| 14:40 | *interruption* | | | | |
| 14:41 | run 15 › Cancel | click Cancel, then browser Back during the request | run shows "Cancelled" and the hosts table still "Running" until reload | BUG | 04-cancel-back.png; repro ×3; `GET …/runs/15` says cancelled |

## Debrief

### Coverage
| Area / tour | Status | Why |
|---|---|---|
| Run detail with worst-case names | covered | |
| Tables: 20/21 boundary, sort, search | partial | sort and search not tried: budget |
| Second door: UI vs API reset | partial | fleetctl path not tried: budget |
| Interruption | covered | |
| Free tier | unexplored | needs the instance restarted without the license |

Deviations: the policies-list label chip (2 actions, NOTE).

### Decisions needed
| # | Finding | Origin | Severity | Repro / location |
|---|---|---|---|---|
| A | Long policy name pushes the Actions menu off-screen at 768 | released | Broken at 768, Ugly at 1280 | log 14:11; 01, 02 |
| B | Run with exactly 21 hosts shows an empty page 2 | released | Broken | log 14:20; 03; `…/hosts?page=1` → `[]` |
| C | Cancel + Back leaves the hosts table stale | this change | Ugly | log 14:41; 04 |

For each: file it, mention it, or drop it?

### Risks
- Policy description has no length limit in the form or the API (log 14:25): mention, or a row for the next test plan that touches policies.

### Questions for product
1. A second reset while one is pending creates a second run (log 14:29). Intended, or should it be refused?

### Candidates for the suite
- Run detail pagination at 20 and 21 hosts (after B has a number).
- Cancel while the hosts table is loading, then Back: the table matches the run state (after C has a number).

### What held up
- Names with quotes, ampersands and angle brackets render as text on the page, in the tooltip and in the activity.
- A policy with 0 hosts shows the empty state, not a spinner.
- CJK and emoji-first names sort and search correctly.

Next charter: the same page on Free, plus fleetctl's reset path (the two partial rows).

## Cleanup (14:58)

`cleanup.sh explore/created.txt --run`: 21 hosts, 2 osquery-perf processes, fleet 31, policy 412,
the script; 0 errors. Instance back to its starting counts. Screenshots and the data folder kept.
```

The example is made up. Keep the shape, not the content.
