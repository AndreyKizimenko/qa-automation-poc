---
name: fleet-story-qa
description: "QA a Fleet user story (label 'story') together with the QA engineer: read the story, its test plan and every PR, map what's risky, run everything that can be driven from outside a device (API, fleetctl, GitOps, role matrices, UI on the RC instance), hand the engineer one batched list of device, license and settings steps, and end with a sign-off comment that ticks the ticket's own test-plan checklist. Use when asked to QA, test, verify, 'go through the test plan of' or sign off a story or feature issue, even from just a pasted story link and 'let's QA this', or when asked which test-plan rows are left. Not for bug or security fixes that need a before/after repro (fleet-bug-qa), small quick wins (fleet-quickwin-qa), or writing or updating the test plan (fleet-test-plan)."
---

# Fleet story QA — partner mode

A story is bigger than a bug and there's no "before" to compare against: the feature didn't exist.
The QA engineer drives devices, licenses and global settings by hand; Claude's job is to make their
time count: find what's likely to break before anyone touches a device, take everything that can be
driven from outside (API, fleetctl, GitOps, DB state, logs, headless UI), and keep the test plan
honest without making it bigger.

The engineer is usually slammed, so batch what you need from them and make each item exact. Don't ask
for what a simulation already covers, but don't dodge an ask with a workaround either: two minutes of
their time on a real setting beats an afternoon of evidence that skipped half the code path.

**Right skill?** A bug or security fix with something to reproduce is `fleet-bug-qa`'s; a small
`quick-win` Claude can drive alone is `fleet-quickwin-qa`'s; writing or updating the plan is
`fleet-test-plan`'s. If it's another skill's, load that one now and say so in a line.

## Before you start

- **Read `~/.claude/fleet-qa.local.md`**: this machine's instances, Fleet checkout, QA workspace,
  databases, logs, role users and standing permissions. If it doesn't exist, create it first, per
  `${CLAUDE_PLUGIN_ROOT}/skills/fleet-bug-qa/references/local-setup.md`.
- **The instance** is the fixed/RC one the local file names (usually context `default`); contexts and
  tokens are in `~/.fleet/config`. There is no pre-fix instance to set up.
- **Check that every context you'll use still answers**, role users included
  (`fleetapi.sh <ctx> GET /api/v1/fleet/me`). Expired tokens go in one ask now
  (`fleetctl login --context <name>`), not when a row needs them.
- **Work in `<QA workspace>/qa-<N>/`**: `RESULTS.md` (the lab notebook), `created.txt` (the cleanup
  manifest, in `cleanup.sh`'s line format), drivers, `screenshots/`, `snapshots/`, `results.json` and
  `issue-comment.md` (step 5). Write RESULTS.md as you go, one timestamped row per check (where, what
  with which input, what you saw), and tag the rows that need action the way `fleet-explore`'s session
  log does (BUG, QUESTION, IDEA, RISK, NOTE): the decision list in step 4 is then a filter over the
  log, not a reconstruction at the end.

**Scripts** are fleet-bug-qa's, in `${CLAUDE_PLUGIN_ROOT}/skills/fleet-bug-qa/scripts/`; each header
has its usage. `fleetapi.sh <ctx> <METHOD> <path> [json | -F k=v]` is the authenticated REST call
(`FLEET_TOKEN=` to act as another user). Beside it: `screenshot.mjs`, `pw.mjs` (Playwright with the
cookie login), `stack.py` (several shots into one image) and `cleanup.sh`. This skill's own
`${CLAUDE_SKILL_DIR}/scripts/plan_comment.py` builds the sign-off.

**References.** Each is a required read at the step that names it, not background:

- `${CLAUDE_SKILL_DIR}/references/planning.md`: now. Steps 1–2 in detail: what to read, the risk
  map, checking the plan.
- `${CLAUDE_PLUGIN_ROOT}/skills/fleet-bug-qa/references/fleet-gotchas.md`: before building any test
  data (osquery-perf, counts and crons, shared instances).
- `${CLAUDE_SKILL_DIR}/references/instance-traps.md`: with it. Which server is which, Free needs a
  restart, API-only users expire, signing the browser in (§ Auth), the Fleet UI that misleads a check.
- `${CLAUDE_PLUGIN_ROOT}/skills/fleet-explore/references/tours.md`: step 1 (§ 2, 4, 9), step 3
  (§ 1, 4, 8) and step 4 (§ 7). Borrow what a check needs, not whole tours.
- `${CLAUDE_PLUGIN_ROOT}/skills/fleet-bug-qa/references/screenshots.md`: before the first evidence PNG.
- `${CLAUDE_PLUGIN_ROOT}/skills/fleet-bug-qa/references/findings.md`: step 4, when the first odd thing
  turns up.
- `${CLAUDE_SKILL_DIR}/references/signoff.md`: step 5, before writing the sign-off.

After a long run the detail of a step may no longer be in front of you. Re-read its file from this
list rather than working from memory.

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

For a story: ticking test-plan boxes on the ticket is fine once the engineer has said to keep them
updated, and only for rows actually exercised. Offer it in your first message, so they don't have to
ask each time.

## Evidence: run the real code path, simulated or real, or ask

<!-- shared:evidence -->
A row counts only when Fleet's own code for it ran on the build under test, from the entry point a user
would hit. Three ways to get there, in this order:

1. **Simulate the whole path** whenever that covers the row. It costs nobody's time, so it comes first:
   osquery-perf hosts enrolling through the real endpoints (desktop, iPhone/iPad over MDM, Android),
   API-only users for API role checks, a real API call against a simulated host to put it in a state (a
   real wipe or lock command leaves it "pending"), `fleetctl trigger` instead of waiting for a cron. The
   test: would any production code on this row's path behave differently if the host, user or state
   were real? If not, the simulation is the real thing. Look for the most realistic route before
   settling for less: when osquery-perf has no template for a platform, the agent's real enroll request
   (`POST /api/v1/osquery/enroll`) still runs Fleet's enrollment, where a hand-inserted host row
   doesn't. Where the real thing already exists (a device in the right state, a setting already on, a
   real user of the role), use it read-only.
2. **Ask the engineer** for whatever a simulation can't reach and you mustn't do yourself: a license
   switch, an MDM toggle, an org setting, a real UI session as a role, a device action, a third-party
   console, a redeploy. It goes in the batched ask. Don't decide for them that it's too disruptive, too
   slow or already covered by the developer's tests: that's their call, and usually they just do it.
   When a cheaper path would prove the same change, offer both and say which you'd take.
3. **A workaround only with their go-ahead**: they say the real setup can't be done, or that a
   workaround is good enough for this row. Propose the specific one (a hand-inserted DB row, a mocked
   failure in a scratch test, an intercepted response for an error nobody can trigger) and what it
   skips. Once they agree, record it in RESULTS.md as what it is. It never shows as a bare ✅.

Faking what Fleet says isn't evidence. Rewriting responses in the browser (`page.route` to change the
license, the viewer's role, a setting or a host's state) shows how the frontend reacts to data Fleet may
never send. Reading the code instead of running it isn't evidence either: it's how the bugs QA exists
for slip through, like an Apple-MDM check hiding a Windows feature that stays invisible until someone
turns Apple MDM off. Code and unit tests tell you where to look; they don't pass a row. And don't close
with "worth confirming on a real device": if it would change the verdict, it belonged in the ask.
<!-- /shared:evidence -->

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

Steps 1–2 are spelled out in `planning.md`. Read it before the first call to the instance.

### 1. Read everything, then map risk

Read the story body and comments, the test plan (in the issue body, or in a comment) and **every**
linked PR's diff, and check what the instance actually runs. Then write a short risk map in
RESULTS.md: for each changed code path, its entry points, its gating (tier, role, which MDM), its
state shape, its secrets, and docs vs code, each with a file:line. This is where most real findings
come from. A risk read from code is a hypothesis until a live check shows it.

### 2. Check the plan is current, and don't re-trim it

**fleet-test-plan** writes the plan and sizes it for this split, so run it as written. If it predates
the PR, say so and recommend a fleet-test-plan pass first. Flag stale or wrong rows with the
evidence, don't answer rows from code, and add a check only for a risk from step 1 that the plan
doesn't cover. Propose all of it **in chat only**, on one screen: which rows you'll take and how,
which are the human's and roughly how long their share takes, the stale rows, the additions. Ask the
two questions that find the most bugs in the same message: what does the engineer think might break,
and what did the developer say was tricky. Never edit the ticket body.

### 3. Split the work, then run your share

A plan from fleet-test-plan already marks the split. `Device:` rows and the global-switch sections
(Premium gating, Feature in isolation, Upgrade) are theirs, the rest are yours, and its Setup says
what each needs. Its `notes.md` in `<QA workspace>/test-plan-<N>/` holds the QA-only methods for your
rows (simulated hosts, mocks, DB checks), which the public plan leaves out.

**Yours** — anything driven from outside a device:
- API on all prefixes; role matrix with API-only users per global and fleet role (record each in
  `created.txt`); unauthenticated; Free vs Premium responses.
- fleetctl and GitOps round-trips (`generate-gitops` output, `gitops --dry-run`).
- DB state before/after (the database command in the local file), server logs (where they are is in
  the local file), activities, cron runs (`fleetctl trigger --name <cron>` to avoid waiting).
- Concurrency and failure paths: parallel `curl` bursts. For a failure you can't trigger live on your
  own objects, ask how the engineer would produce it (a revoked token, a stopped proxy, a throwaway
  integration) before falling back to a mocked scratch test.
- UI: the obvious states in the in-app browser (render, empty, error, premium, role-gated, narrow
  width: `tours.md` § 1 States says how to reach each, § 8 the breakpoints). A state the instance
  can't produce without a global change (Free, a setting that's off, another role's view) goes in the
  ask, not into an intercepted response. Evidence PNGs are made and sent per `screenshots.md`, as each
  area finishes: the engineer attaches them to the ticket and uses them to follow along.
- Exploratory, lightly: poke the neighbours of the change (list/detail pages, the same feature on the
  other platform, what happens on delete or disable of the parent: `tours.md` § 4) and log what you
  tried. A proper session with a charter and a debrief is `fleet-explore`'s job: offer it once the
  plan's rows are done, with this run's workspace as its input.

**Theirs** — one batched message: devices (enroll, wipe, factory reset, transfer), license, MDM and
org-setting toggles, portal/third-party consoles, a real UI login as a given role: every state from
the Evidence section that a simulation can't reach. For each item give the exact action, which
instance, any precondition that matters ("don't open the page before I've run the burst"), and what
you'll check right after. Then keep working on your share while they do it.

**Snapshot before their destructive steps.** Before a wipe, host delete, MDM toggle or transfer, save
the host JSON, relevant DB rows and activities to `snapshots/pre-<step>/`; afterwards, diff and report
in a before/after table. This is what turns "it re-enrolled" into evidence (same record? new id? what
survived?).

Poll with bounded loops for anything asynchronous (enrollment, profile delivery, cron) and report
timestamps. If a background watch dies (server restart), say so rather than reporting its last line.

### 4. Classify findings honestly

For every unexpected behavior, establish:
- **Origin** — *this story* (in its PRs), *released* (same code in the latest release tag:
  `git show fleet-v<latest>:<file> | grep ...`), or *pre-existing but exposed by this story*.
- **Device vs Fleet** — when behavior comes from Android/Google/Apple (zero-touch enforcement, a
  device refusing lost mode after a passcode reset), say so; it isn't a Fleet bug, but it may belong
  in the feature guide.
- **Could Fleet even know?** Before calling stale state a bug, ask what signal Fleet has. A device
  moved elsewhere looks exactly like one powered off.
- **Wrong against what?** There's no "before" for a story, so name the oracle (`tours.md` § 7): the
  story and its comments, the REST and YAML docs, Figma, the sibling that does the same thing, house
  style. When nothing settles it, it's a QUESTION.

Then take each BUG row through `findings.md` before it goes on the **decision list**: vary one thing,
say who would hit it, search the open issues and the engineer's own filed bugs, capture it
ticket-grade now, and recommend file, mention or drop. The other tags land beside the list: QUESTION
rows as **Questions for product**, RISK rows as **Risks**, IDEA rows as one line each offering them to
`playwright-test-author`. File what the engineer chooses with `fleet-bug-file`.

### 5. Sign off

Read `signoff.md` now, even if you remember it. The sign-off is the ticket's own test plan with its
boxes ticked, in the plan's order, built by `plan_comment.py` from the issue body and a `results.json`
you write; it is not a new matrix. Save it to `issue-comment.md` and print it as a copiable
four-backtick block as soon as the rows are in, without waiting to be asked, and again after every
change. Tick only rows that actually ran live.

### 6. Cleanup

List `created.txt` newest-first and ask before running `cleanup.sh --run`. Anything you restored for
the user (apps deleted by an MDM toggle, a test-plan box) goes in RESULTS.md.
