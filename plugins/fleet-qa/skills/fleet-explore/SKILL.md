---
name: fleet-explore
description: Run a chartered exploratory-testing session on a live Fleet instance — Claude explores one feature, page or area with worst-case data, every entry point and scope, lifecycle and interruption tours, keeps a timestamped tagged log, and ends with a debrief: what was covered and what wasn't, a decision list of findings for the QA engineer, questions for product, candidates for the Playwright suite, and what held up. Use whenever the user wants to explore, poke at, stress, break, "kick the tires on" or find edge cases in a Fleet feature, page or area — "explore around the policy automations page", "throw worst-case names at the software library", "what else could be broken near this fix", "kick the tires on the new Android enrollment flow", "do an exploratory pass on Hosts before the release", "what would a real customer's data do to this screen" — and when fleet-story-qa, fleet-quickwin-qa or fleet-bug-qa end and the user wants the neighbours poked. Do NOT use to run a story's test plan (fleet-story-qa), to verify a specific bug fix before/after (fleet-bug-qa), to QA a quick win (fleet-quickwin-qa), to write a test plan (fleet-test-plan), to file a finding (fleet-bug-file), or to write Playwright tests (playwright-test-author).
---

# Fleet exploratory session

A test plan checks what the story says should happen. An exploratory session looks for what
nobody wrote down: the fleet name that pushes the row actions off the screen, the second entry
point that skips the validation, the label deleted while a profile still points at it, the save
that lands twice. Those are the bug classes that keep escaping (fleet-test-plan's coverage lenses
list them), and no plan row will ever name all of them, because they're found by looking, not by
reading.

The session is chartered so it can be debriefed: one line says what's being explored, with what,
to learn what; a budget says when it ends; a tagged log records what was tried; and the debrief
says what was covered, what wasn't, and what turned up. Without those, exploration is an afternoon
of clicking that nobody can act on.

The split: Claude explores, logs and classifies. The QA engineer picks the charter and decides
what's a bug. Claude never files, never promotes a quirk to a defect on its own, and never decides
a finding isn't worth the engineer's eyes.

## Tooling

Same as the other QA skills. Read `~/.claude/fleet-qa.local.md` first (instances, Fleet checkout,
QA workspace, role users); if it doesn't exist, create it per
`${CLAUDE_PLUGIN_ROOT}/skills/fleet-bug-qa/references/local-setup.md`. Scripts are in
`${CLAUDE_PLUGIN_ROOT}/skills/fleet-bug-qa/scripts/`: `fleetapi.sh <ctx> <METHOD> <path> [json | -F k=v]`
(`FLEET_TOKEN=` to act as another user), `screenshot.mjs`, `pw.mjs`, `stack.py`, `cleanup.sh`. Skim
`${CLAUDE_PLUGIN_ROOT}/skills/fleet-bug-qa/references/fleet-gotchas.md` and
`${CLAUDE_PLUGIN_ROOT}/skills/fleet-story-qa/references/instance-traps.md` before creating data.

The browser: the Playwright MCP tools when they're available (`browser_navigate`, `browser_snapshot`,
`browser_click`, `browser_type`, `browser_wait_for`, `browser_find`, `browser_resize`, `browser_tabs`,
`browser_console_messages`, `browser_network_requests`), or Claude in Chrome when the user prefers
their own logged-in browser. The browser pane can't save PNGs, so evidence files come from
`screenshot.mjs` or a `pw.mjs` driver against the same state. A sequence you'll repeat on every
variation (the setup before each probe) becomes a `pw.mjs` driver.

Workspace: next to the ticket's run when there is one, `<QA workspace>/qa-<N>/explore/`, otherwise
`<QA workspace>/explore/`. One file per session, `explore-<date>-<slug>.md` (charter, log, debrief;
template in `references/session.md`), `screenshots/` beside it, and `created.txt` in the same
cleanup-manifest format as every other run.

## Hard lines

The same ones as every QA skill here, because the instances are shared and a session's curiosity
is exactly what breaks them:

- **Never flip global state the human owns**: MDM on or off, the license, GitOps mode, org
  settings, Apple or Android enterprise setup. A tour that needs Free or GitOps mode goes in a
  one-line ask; keep exploring elsewhere meanwhile.
- **Never type a password, never create or delete human accounts.** API-only users for API checks;
  the role users in the local file for UI-by-role.
- **Never post, edit or delete on GitHub.** Findings go to the decision list; filing is
  `fleet-bug-file`, when the user says so.
- **Explore on objects you created.** A `qa-explore-<slug>` fleet (or the run's `qa-<N>` fleet
  when the session follows one), your own osquery-perf hosts, labels, policies, reports, scripts,
  packages and API-only users, each recorded in `created.txt` as it's created. Real hosts, the
  engineer's fleets and the static role users are read-only. Some GETs write (token-minting
  config endpoints): read the handler before calling an endpoint you don't know.
- **Scratch code never stays in the repo.**

And three that are specific to exploring:

- **Don't fake state.** `page.route` rewriting the license, the viewer's role, a setting or a
  host's state shows how the frontend reacts to data Fleet may never send; a finding from faked
  data isn't a finding. Reach states the real way (a real command against a simulated host, a
  role user, the `previous` instance for "how did it behave before"), or ask.
- **Stuck means note and move on.** An element that isn't where you expected, a page that won't
  settle, a dialog you can't dismiss: log it (it may be the finding), take a screenshot, and go to
  the next probe. Never loop retrying the same action. The budget is for coverage.
- **A finding you can't reproduce is a NOTE, not a BUG.** Three tries, same steps. If it won't
  come back, record what was tried and let the engineer decide whether to chase it.

## Workflow

### 1. Frame the session

Start from what the user points at (a story just QA'd, a page, an area, a bug's neighbourhood,
"Hosts before the release") and read what already exists before proposing anything:

- **After a story, quick win or bug QA:** that run's `RESULTS.md` and the test plan's `notes.md`
  in `<QA workspace>/test-plan-<N>/`. They say what was covered, so the charter aims at what
  wasn't: the neighbouring pages, the other platform, the other entry points, the data shapes the
  plan's rows never used.
- **An area:** the PRs merged into it since the last release
  (`gh pr list -R fleetdm/fleet --search "<area words>" --state merged --limit 30`, then by date)
  and the open bugs in it
  (`python3 ${CLAUDE_PLUGIN_ROOT}/skills/fleet-test-plan/scripts/related_bugs.py -k "<area words>" --fleet <fleet checkout> --out <session dir>/bugs.md`).
  A change is where the risk is; an open bug is something not to find again.
- **Always:** Fleet's own event list, read live
  (`git -C <fleet checkout> show origin/main:docs/Contributing/guides/ui/design-qa-considerations.md`),
  and the "bug classes that keep escaping" in
  `${CLAUDE_PLUGIN_ROOT}/skills/fleet-test-plan/references/coverage-lenses.md`. Both are tours in
  waiting.

Then ask the two questions that find the most bugs, "what do you think might break?" (a hunch is a
valid charter) and "what did the developer say was tricky?", and propose **three to five charters
in one numbered message**, your recommended first pick marked and each worded so a one-word "yes"
accepts it. A charter has three lines:

```
Explore <target: one page, flow or object type>
  with <resources: the data, roles, tiers, hosts and tours you'll use>
  to discover <information: what you want to learn, not what you want to prove>
```

A good charter names a target narrow enough to finish (the policy automation run detail page, not
"policies"), resources concrete enough to set up (a fleet with 21 hosts, a 255-character policy
name, the fleet-observer role user), and an information goal that's a question ("what the page
shows while a run is partial"), not a claim ("that it works"). Give each a **budget**: 60 browser
actions or 45 minutes, whichever comes first, unless the user sets another. Several sessions per
charter are fine; each gets its own log and debrief.

Illustrative charters (made up):

- *New feature, after story QA:* Explore the policy automation run detail page with a fleet of 21
  simulated hosts, a 200-character policy name and a script that fails on half of them, to discover
  what the page shows while a run is partial and what long names do at the page's widths.
- *An area, before a release:* Explore Software › Library on the premium instance with titles whose
  names are long, one character, CJK and emoji-first, and a host carrying 1,600+ packages, to
  discover where the accordion, search and filters break at the edges.
- *A bug's neighbourhood:* Explore every action near the fixed Reset-policy dialog that confirms
  "on N hosts", from the single-run and all-runs entry points, to discover whether sibling actions
  share the same scoping mistake.

Write the chosen charter and budget at the top of the session file, note the start time (`date`),
and begin.

### 2. Orient (the first five actions)

Walk the happy path once, with ordinary data, to know what "normal" looks like here: the page
settled, the controls present, the console quiet. Read `browser_console_messages` and note any
error now, so a later one can be told from the baseline. Known noise (the Ace editor worker 404,
fleetdm/fleet#54845) is listed in `playwright/helpers/console.ts` under `DEFAULT_IGNORED_PAGE_ERRORS`
in the qa-automation checkout; don't re-report those.

Then map the surface, the way break-ui does: every value the page renders and where it comes from
(names, counts, timestamps, status badges, labels from data, tooltips, button labels, the list
itself) with its limit from the code (`frontend/` `maxLength`, the server-side validator, the REST
docs) or "unbounded". A value with no limit anywhere is a RISK row before you've typed anything.
This table is what the worst-case tour feeds.

### 3. Explore, one tour at a time

`references/tours.md` holds the tours and the worst-case catalog, with Fleet-specific probes. Pick
the ones the charter calls for, in this order unless the charter says otherwise: worst-case data,
scope and gating, second door, lifecycle, interruption, tables and forms, oracles, width and
keyboard, concurrency and timing. Say which tour you're on in the log; it's how the debrief can
state coverage.

**Drive snapshot-first.** `browser_navigate`, `browser_snapshot`, act on an element by its ref,
`browser_wait_for` the text that should appear or disappear (never a fixed sleep), snapshot again,
read what changed. The accessibility tree is the record of what the page offered; a screenshot is
evidence for a person. On a page listing hundreds of hosts the snapshot is enormous and slow to
reason over, so narrow first (your `qa-explore-*` fleet, a search that matches one row) or use
`browser_find` for a single element. A button with no accessible name in the snapshot is itself a
finding: keyboard and screen-reader users can't reach it either.

**Log as you go, not at the end.** One row per action that taught you something: time, where, what
you did with which input, what you saw, a tag, a follow-up. The tags (defined in
`references/session.md`): **BUG** wrong and reproduced; **QUESTION** can't tell if it's intended;
**IDEA** a case the Playwright suite should own; **RISK** nothing broke yet, but it's one realistic
step away; **NOTE** interesting, not actionable, including what wouldn't reproduce. A session of
forty rows with a dozen tags is normal. A wall of prose at the end isn't a log.

**When something looks wrong**, run this loop before writing the tag:

1. Stop and look. Read the snapshot, the console and the network messages for that action, not
   just the symptom.
2. Reproduce it: the same steps, three times. Once is an observation.
3. Vary one thing at a time: the `previous` instance, another role user, All fleets instead of
   the fleet, the API instead of the UI, ordinary data instead of worst-case. Each variation that
   still fails narrows the cause; each that passes names a condition.
4. Capture: `screenshot.mjs` clipped to the element (`--caret` for focus bugs), the request and
   response from `browser_network_requests`, the console line. Read the PNG before relying on it:
   it must show the thing, with no tokens or enroll secrets.
5. Classify the origin the way the other QA skills do: *this change* (when the session follows a
   story or fix), *released* (`git show fleet-v<latest>:<file>`, or the `previous` instance
   reproduces it), or *pre-existing but exposed*. Search open issues
   (`gh issue list -R fleetdm/fleet --state open --search "<terms>"`) before calling anything new;
   an existing issue becomes a NOTE with its number.
6. Decide: dig now, or log and continue. Dig when the next probe would change the classification;
   otherwise keep the budget for coverage and mark the follow-up.

Rendering, hover, focus and scroll findings need a real browser before they count. Headless
Playwright has produced both a false "not reproducible" and a false "reproduces" in earlier runs,
so ask the user to try the steps in their browser, or use Claude in Chrome.

**Follow leads.** A probe that surfaces something outside the charter is still worth the next
three actions. Log the deviation ("left charter: following the label count") so the debrief can
report it, and come back.

**Watch the budget.** Note the count every ten actions. When it runs out, stop even mid-tour: a
debrief with honest "unexplored" rows is worth more than five more probes nobody will know about.
The user can open the next session.

### 4. Debrief

Write the debrief at the bottom of the session file (template in `references/session.md`) and
print it in chat. Five parts, in this order; the first is the one people skip:

1. **Coverage.** Each area the charter named and each tour you ran, as **covered**, **partial** or
   **unexplored**, with a phrase of why for anything short of covered ("budget", "needs Free",
   "needs a real device"). Deviations from the charter, and what they found.
2. **Decisions needed**: the same decision list every QA skill here hands over,
   `# | finding | origin | severity | repro / file:line`, for every BUG and RISK row, cosmetic ones
   included. UI findings carry a severity the engineer can act on at a glance: **Broken** (content
   unreadable, an action unreachable, wrong data shown), **Ugly** (readable but visibly wrong),
   **Fragile** (fine today, one realistic step from breaking). Behaviour findings use the usual
   terms. For each the user chooses file / mention / drop; filing goes through `fleet-bug-file`,
   which gets the session file and screenshots as its evidence.
3. **Questions for product**: the QUESTION rows, one line each, as a copiable block the user can
   post or forward.
4. **Candidates for the suite**: the IDEA rows, each passing the test for automation: the
   behaviour is stable and well defined, pass or fail is unambiguous, and it's worth running
   nightly. A reproduced bug becomes a candidate once it has an issue number. Hand candidates to
   `playwright-test-author`, which will want to see the new test fail against the buggy build
   before trusting it. Everything else stays exploratory.
5. **What held up.** The worst cases and probes the feature handled correctly. It shows the
   session was real, tells the user what not to worry about, and is often the longest list.

Then the screenshots: `SendUserFile` (display `attach`), one caption line per image naming its
log row. Shots that are read together (the input and where it ended up, the same view in two
scopes) go out as one image via `stack.py`, cropped to the part that matters first. End with one
line offering the next charter, built from the unexplored rows.

The log is the engineer's to read when they want detail; the debrief has to stand on its own.
Don't pad it with mechanics (which tools, how many snapshots), and don't soften a Broken into a
NOTE because it "might be intended": that's what QUESTION is for.

### 5. Cleanup

List `created.txt` newest-first and ask before `cleanup.sh --run`. Only what this session
recorded. Leave the session file and screenshots; they're the evidence trail, and `fleet-bug-file`
reads them.

## Where this sits

- After **fleet-story-qa**, **fleet-quickwin-qa** or **fleet-bug-qa**: their "poke the neighbours"
  step is this skill, with the run's workspace as input. It's offered, not automatic; the engineer
  decides whether the change deserves a session.
- Before a release, for an area with a lot of change: one charter per area, from the merged-PR
  list.
- Standalone, whenever someone has a hunch.

It doesn't replace the test plan, and a session's "covered" rows don't tick plan boxes. The plan
proves the spec; the session hunts for what the spec missed.
