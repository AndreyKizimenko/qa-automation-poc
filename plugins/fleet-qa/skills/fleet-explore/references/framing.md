# Frame and orient (steps 1–2)

For fleet-explore. Read it at the start of the session, before proposing charters. `session.md`
and `tours.md` are beside this file; `related_bugs.py` and `coverage-lenses.md` are
fleet-test-plan's, and the SKILL.md gives their paths.

## 1. Frame the session

Start from what the user points at (a story just QA'd, a page, an area, a bug's neighbourhood, "Hosts
before the release") and read what already exists before proposing anything:

- **After a story, quick win or bug QA:** that run's `RESULTS.md` and the test plan's `notes.md` in
  `<QA workspace>/test-plan-<N>/`. They say what was covered, so the charter aims at what wasn't: the
  neighbouring pages, the other platform, the other entry points, the data shapes the plan's rows
  never used.
- **An area:** the PRs merged into it since the last release
  (`gh pr list -R fleetdm/fleet --state merged --search "<area words> merged:>=<last release date>" --limit 30`)
  and the open bugs in it
  (`python3 <fleet-test-plan's scripts>/related_bugs.py -k "<area words>" --fleet <fleet checkout> --out <session dir>/bugs.md`).
  A change is where the risk is; an open bug is something not to find again.
- **Always:** Fleet's own event list, read live
  (`git -C <fleet checkout> show origin/main:docs/Contributing/guides/ui/design-qa-considerations.md`),
  and the "bug classes that keep escaping" in
  fleet-test-plan's `coverage-lenses.md`. Both are tours in waiting.

Then, in one message, ask the two questions that find the most bugs, "what do you think might break?"
(a hunch is a valid charter) and "what did the developer say was tricky?", and propose **three to
five charters**, numbered, your recommended first pick marked and each worded so a one-word "yes"
accepts it. An answer to the questions may replace a charter; that's the point of asking. A charter
has three lines:

```
Explore <target: one page, flow or object type>
  with <resources: the data, roles, tiers, hosts and tours you'll use>
  to discover <information: what you want to learn, not what you want to prove>
```

A good charter names a target narrow enough to finish (the policy automation run detail page, not
"policies"), resources concrete enough to set up (a fleet with 21 hosts, a 255-character policy name,
the fleet-observer role user), and an information goal that's a question ("what the page shows while
a run is partial"), not a claim ("that it works"). `session.md` has three illustrative ones. Give each
a **budget**: 60 actions or 45 minutes, whichever comes first, unless the user sets another. An action
is one probe (a navigate, click or type, with its snapshot and wait); an API call counts one; the
repeats that reproduce a finding count too. When the two disagree, the clock wins. Several sessions
per charter are fine; each gets its own log and debrief.

Write the chosen charter and budget at the top of the session file, note the start time (`date`), and
begin. Two rules for getting from the charter to the first probe:

- **If the user told you to work on your own**, pick the starred charter, record the two questions as
  unasked in the session file, and go. Otherwise wait for the pick.
- **Setup counts on the clock.** Build what the API can name first (fleets, labels, policies, reports,
  scripts, packages, users and their emails); reach for a patched osquery-perf only when the charter
  is about host names, and then keep the diff and the names files in the session's data folder, so the
  next session rebuilds in a minute instead of an hour.

## 2. Orient (the first five actions)

Walk the happy path once, with ordinary data, to know what "normal" looks like here: the page
settled, the controls present, the console quiet. Read `browser_console_messages` and note any error
now, so a later one can be told from the baseline. Known noise is listed in `helpers/console.ts` in
the `playwright/` folder the local file names: `DEFAULT_IGNORED_CONSOLE_ERRORS` for console errors
(favicon, `net::ERR_*`, ResizeObserver) and `DEFAULT_IGNORED_PAGE_ERRORS` for whatever uncaught
exceptions the suite tolerates on the current release (an empty list means none); don't re-report
what's listed there.

Then map the surface, the way Emil Kowalski's break-ui skill does (credited in `tours.md`): every
value the charter's page renders and where it comes from (names, counts, timestamps, status badges,
labels from data, tooltips, button labels, the list itself) with its limit from the code (a grep for
`maxLength` in the component under `frontend/`, one in the server-side validator, the REST docs) or
"unbounded". Ten minutes at most; what two greps don't find is "unbounded". A value with no limit
anywhere is a RISK row before you've typed anything. The table goes under `## Surface` in the session
file, and the worst-case tour feeds on it.
