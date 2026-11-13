---
name: fleet-explore
description: "Run a chartered exploratory-testing session on a live Fleet instance: explore one feature, page or area with worst-case data, every entry point and scope, lifecycle and interruption tours, keep a timestamped tagged log, and end with a debrief and a private findings page (findings with evidence and screenshots, questions for product, suite candidates, what held up). Use when asked to explore, poke at, stress, break, 'kick the tires on' or find edge cases in a Fleet feature, page or area ('explore around the policy automations page', 'throw worst-case names at the software library', 'what else could be broken near this fix', 'exploratory pass on Hosts before the release'), or to poke the neighbours after a story, quick-win or bug QA. Not for running a story's test plan (fleet-story-qa), verifying a fix (fleet-bug-qa), a quick win (fleet-quickwin-qa), writing a test plan (fleet-test-plan), filing (fleet-bug-file) or writing Playwright tests."
---

# Fleet exploratory session

A test plan checks what the story says should happen. An exploratory session looks for what nobody
wrote down: the fleet name that pushes the row actions off the screen, the second entry point that
skips the validation, the label deleted while a profile still points at it, the save that lands
twice. Those are the bug classes that keep escaping (fleet-test-plan's coverage lenses list them), and
no plan row will ever name all of them, because they're found by looking, not by reading.

The session is chartered so it can be debriefed: one line says what's being explored, with what, to
learn what; a budget says when it ends; a tagged log records what was tried; and the debrief says what
was covered, what wasn't, and what turned up. Without those, exploration is an afternoon of clicking
that nobody can act on.

The split: Claude explores, logs and classifies. The QA engineer picks the charter and decides what's
a bug. Claude never files, never promotes a quirk to a defect on its own, and never decides a finding
isn't worth the engineer's eyes.

## Before you start

- **Read `~/.claude/fleet-qa.local.md`** (instances, Fleet checkout, QA workspace, role users,
  standing permissions); if it doesn't exist, create it per
  `${CLAUDE_PLUGIN_ROOT}/skills/fleet-bug-qa/references/local-setup.md`. The session runs on the
  instances that file names, like every skill here, never on the Playwright suite's shared CI
  instances; those have their own rules in `playwright/CLAUDE.md`.
- **Check that every context you'll use still answers**, each role user included
  (`fleetapi.sh <ctx> GET /api/v1/fleet/me`). Expired tokens go in one ask now
  (`fleetctl login --context <name>`), not when the roles tour starts.
- **Workspace**: next to the ticket's run when there is one, `<QA workspace>/qa-<N>/explore/`,
  otherwise `<QA workspace>/explore/`. One file per session, `explore-<date>-<slug>.md` (charter, log,
  debrief), `screenshots/` beside it, the findings page's `findings.json` and rendered `page/`, and its
  own `created.txt` in the same cleanup-manifest format as every other run. When the session borrows a
  run's `qa-<N>` fleet, it doesn't record the fleet again, and its cleanup runs before the run's:
  deleting the fleet strands the session's hosts in No fleet.

**Scripts** are fleet-bug-qa's, in `${CLAUDE_PLUGIN_ROOT}/skills/fleet-bug-qa/scripts/`:
`fleetapi.sh <ctx> <METHOD> <path> [json | -F k=v]` (`FLEET_TOKEN=` to act as another user),
`screenshot.mjs`, `pw.mjs`, `stack.py`, `cleanup.sh`. A sequence you'll repeat on every variation (the
setup before each probe) becomes a `pw.mjs` driver.

**The browser**: the Playwright MCP tools when they're available (`browser_navigate`,
`browser_snapshot`, `browser_click`, `browser_wait_for`, `browser_find`, `browser_resize`,
`browser_tabs`, `browser_console_messages`, `browser_network_requests` and the rest), or Claude in
Chrome when the user prefers their own logged-in browser. The pane usually opens on `/login`; the
ways in, in order, are in `instance-traps.md` § Auth: the engineer signs in once (ask in one line and
carry on with API probes meanwhile); or, with their say-so, session-owned users on the session's
fleet; never the engineer's token or password through the browser tool or a file it loads.

**References.** This skill's are in `${CLAUDE_SKILL_DIR}/references/`; the shared ones, marked
*(bug-qa)*, are in `${CLAUDE_PLUGIN_ROOT}/skills/fleet-bug-qa/references/`. Each is a required read at
the step that names it, not background:

- `framing.md`: now. Steps 1–2 in detail: what to read first, how to write a charter, the budget,
  orienting.
- `session.md`: step 1. The session file's template, the tags, and illustrative charters.
- `fleet-gotchas.md` *(bug-qa)* and
  `${CLAUDE_PLUGIN_ROOT}/skills/fleet-story-qa/references/instance-traps.md`: before creating data and
  before the first UI step.
- `tours.md`: step 3. The tours, the worst-case catalog, the oracles and the known non-findings.
- `findings.md` *(bug-qa)*: step 3, when the first thing looks wrong, and again before the decision
  list.
- `screenshots.md` *(bug-qa)*: before the first evidence PNG.
- `findings-page.md`: step 5.
- fleet-test-plan's `related_bugs.py` and `coverage-lenses.md`, under
  `${CLAUDE_PLUGIN_ROOT}/skills/fleet-test-plan/` (`scripts/` and `references/`): step 1, for an
  area's open bugs and the bug classes that keep escaping.

After a long session the detail of a step may no longer be in front of you. Re-read its file from
this list rather than working from memory.

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

And three that are specific to exploring:

- **Don't fake state.** `page.route` rewriting the license, the viewer's role, a setting or a host's
  state shows how the frontend reacts to data Fleet may never send; a finding from faked data isn't a
  finding. Reach states the real way (a real command against a simulated host, a role user, the
  `previous` instance, when the local file names one, for "how did it behave before"), or ask. A tour
  that needs Free or GitOps mode goes in a one-line ask; keep exploring elsewhere meanwhile.
- **Stuck means note and move on.** An element that isn't where you expected, a page that won't
  settle, a dialog you can't dismiss: log it (it may be the finding), take a screenshot, and go to the
  next probe. Never loop retrying the same action. The budget is for coverage.
- **A finding you can't reproduce is a NOTE, not a BUG.** Three tries, same steps. If it won't come
  back, record what was tried and let the engineer decide whether to chase it.

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

Steps 1–2 are spelled out in `framing.md`. Read it before proposing anything.

### 1. Frame the session

Read what already exists: the run's `RESULTS.md` and the plan's `notes.md` after a QA; the merged PRs
and the open bugs for an area; Fleet's event list and the escaping bug classes always. Then, in one
message, ask the two questions that find the most bugs ("what do you think might break?", "what did
the developer say was tricky?") and propose **three to five charters**, numbered, your pick marked,
each worded so a one-word "yes" accepts it. A charter reads
`Explore <target> with <resources> to discover <information>` and has a **budget**: 60 actions or 45
minutes, whichever comes first; when the two disagree, the clock wins, and setup counts on it. If the
user told you to work on your own, pick the starred charter, record the questions as unasked and go.
Otherwise wait for the pick. Write the charter, the budget and the start time at the top of the
session file (template in `session.md`).

### 2. Orient (the first five actions)

Walk the happy path once with ordinary data and note the console's baseline, so a later error can be
told from it. Then map the surface: every value the page renders, where it comes from, and its limit
from the code, or "unbounded" (a RISK row before you've typed anything). The table goes under
`## Surface` in the session file, and the worst-case tour feeds on it.

### 3. Explore, one tour at a time

`tours.md` holds the tours and the worst-case catalog, with Fleet-specific probes. Pick the ones the
charter calls for, in this order unless the charter says otherwise: worst-case data (at each width),
scope and gating, second door, lifecycle, interruption, tables and forms, width and keyboard,
concurrency and timing. The oracles there (§ 7) aren't a tour: they're how every row decides what
"wrong" means, so name the one each BUG row rests on. Say which tour you're on in the log; it's how
the debrief can state coverage.

**Drive snapshot-first.** `browser_navigate`, `browser_snapshot`, act on an element by its ref,
`browser_wait_for` the text that should appear or disappear (never a fixed sleep), snapshot again,
read what changed. The accessibility tree is the record of what the page offered; a screenshot is
evidence for a person. On a page listing hundreds of hosts the snapshot is enormous and slow to
reason over, so narrow first (your `qa-explore-*` fleet, a search that matches one row) or use
`browser_find` for a single element. A button with no accessible name in the snapshot is itself a
finding: keyboard and screen-reader users can't reach it either. `browser_evaluate` answers a
question about the DOM (a computed style, a hidden input, an element's box);
`browser_run_code_unsafe` is for a multi-step sequence Playwright's API makes short (collect every
page's rows, load a URL three times), only ever with session-owned credentials.

**Log as you go, not at the end.** One row per action that taught you something: time, where, what
you did with which input, what you saw, a tag, a follow-up. The tags (`session.md` has the full table
and where each lands in the debrief): **BUG** wrong and reproduced; **QUESTION** can't tell if it's
intended; **IDEA** a case the Playwright suite should own; **RISK** nothing broke yet, but it's one
realistic step away; **NOTE** interesting, not actionable, including what wouldn't reproduce. A
session of forty rows with a dozen tags is normal. A wall of prose at the end isn't a log.

**When something looks wrong**, stop and look before writing the tag: read the snapshot, the console
and the network messages for that action, not just the symptom. Then take it through `findings.md`:
reproduce it three times, vary one thing at a time (the `previous` instance when the local file names
one, another role user, All fleets instead of the fleet, the API instead of the UI, ordinary data
instead of worst-case), say who would hit it, search the open issues, and capture it ticket-grade now
with the request and response from `browser_network_requests` and the console line. Classify the
origin the way the other QA skills do: *this change* (when the session follows a story or fix),
*released* (`git show fleet-v<latest>:<file>`, or the `previous` instance reproduces it), or
*pre-existing but exposed*; in a standalone session, *released* or *unreleased* (on the RC only),
decided the way fleet-bug-file does. An existing issue becomes a NOTE with its number. Then decide:
dig now, or log and continue. Dig when the next probe would change the classification; otherwise keep
the budget for coverage and mark the follow-up.

Rendering, hover, focus and scroll findings need a headed browser before they count: the in-app
browser pane, Claude in Chrome, or a `pw.mjs` driver opened with `{ headed: true }`. `screenshot.mjs`
is headless and doesn't. For a hover or drag finding, ask the user to try the steps by hand too.

**Follow leads.** A probe that surfaces something outside the charter is still worth the next three
actions. Log the deviation ("left charter: following the label count") so the debrief can report it,
and come back.

**Watch the budget.** Note the count every ten actions. When it runs out, stop even mid-tour: a
debrief with honest "unexplored" rows is worth more than five more probes nobody will know about. The
user can open the next session.

### 4. Debrief

Write the debrief at the bottom of the session file (template in `session.md`) and print it in chat.
Five parts, in this order; the first is the one people skip:

1. **Coverage.** Each area the charter named and each tour you ran, as **covered**, **partial** or
   **unexplored**, with a phrase of why for anything short of covered ("budget", "needs Free", "needs
   a real device"). Deviations from the charter, and what they found.
2. **Decisions needed**: the decision list from `findings.md` for every BUG row, cosmetic ones
   included. For a UI finding the severity is **Broken** (content unreadable, an action unreachable,
   wrong data shown) or **Ugly** (readable but visibly wrong); for a behaviour finding, say in a few
   words what's lost (a count that's wrong, a write that doesn't land, a gate that doesn't hold), and
   the engineer maps it to Fleet's severity when filing. The RISK rows follow in their own **Risks**
   list: there's nothing to file yet.
3. **Questions for product**: the QUESTION rows, one line each, as a copiable block the user can post
   or forward.
4. **Candidates for the suite**: the IDEA rows that pass the test for automation: the behaviour is
   stable and well defined, pass or fail is unambiguous, and it's worth running nightly. Expect that
   to be few. A reproduced bug becomes a candidate once it has an issue number. Hand candidates to
   `playwright-test-author`, which will want to see the new test fail against the buggy build before
   trusting it. Everything else stays exploratory.
5. **What held up.** The worst cases and probes the feature handled correctly. It shows the session
   was real, tells the user what not to worry about, and is often the longest list.

When a charter ran over several sessions, the last debrief carries one consolidated decision list,
not one per session. The log is the engineer's to read when they want detail; the debrief has to
stand on its own. Don't pad it with mechanics (which tools, how many snapshots), and don't soften a
Broken into a NOTE because it "might be intended": that's what QUESTION is for. End with the page's
link (step 5) and one line offering the next charter, built from the unexplored rows.

### 5. The findings page

Every session ends with one, short sessions included: it's what the engineer opens, filters and
forwards. Read `findings-page.md`, write `findings.json` from the debrief you just wrote, render it
with `${CLAUDE_SKILL_DIR}/scripts/findings_page.py <session dir>/findings.json --out <session dir>/page`,
and publish it as a private Artifact when the Artifact tool is available (otherwise give the path of
`page/index.html`). Build it before cleanup, while the evidence still matches the instance. The
ticket-grade screenshots also go out in chat, per `screenshots.md`.

### 6. Cleanup

List the session's `created.txt` newest-first and ask before
`cleanup.sh <session dir>/created.txt --run`. Leave the session file, screenshots, `findings.json` and
`page/`; they're the evidence trail, and `fleet-bug-file` reads them.

## Where this sits

After **fleet-story-qa**, **fleet-quickwin-qa** or **fleet-bug-qa**, as the longer session they offer;
before a release, one charter per area with a lot of change; or standalone, whenever someone has a
hunch. It doesn't replace the test plan, and a session's "covered" rows don't tick plan boxes. The
plan proves the spec; the session hunts for what the spec missed.
