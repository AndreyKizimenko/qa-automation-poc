---
name: fleet-quickwin-qa
description: "QA a small Fleet change end to end on the RC instance, with Claude driving: a 'quick-win' issue, a copy or help-text change, a new API field or parameter, a small UI tweak, a fleetctl flag. Confirms the change is in the build (and whether part of it already shipped), runs a compact core, regression and halo matrix through the API, fleetctl, GitOps and UI with screenshots, and ends with a short copiable ticket comment and a decision list. No pre-fix instance is needed. Use when asked to QA, verify, check or sign off a quick win or small improvement ('QA #52106', 'is the new populate_end_users param working', 'check the help text change', 'verify this quick win'), even if nobody says 'quick win'. Not for bug fixes that need a before/after repro (fleet-bug-qa) or full stories with a test plan and device work (fleet-story-qa)."
---

# Fleet quick-win QA — drive mode

Quick wins are small by design: one PR, one surface, usually no device. Claude can take them end to
end: verify the change, check nothing next to it broke, capture evidence, and hand the QA engineer a
verdict to post. The value is speed with judgment: a quick win shouldn't take longer to QA than it
took to build, and it shouldn't grow a 20-row matrix.

There's no "before" to prove. The feature is either there and right on the RC or it isn't, so don't
build baseline binaries or worktrees. The one historical check that pays off is cheap: **has part of
this already shipped?** (A quick win that was half-released in the previous version changes what the
ticket and release notes should say.)

**Right skill?** A bug fix with something to reproduce is `fleet-bug-qa`'s; a `story` with a test plan
and device work is `fleet-story-qa`'s. If it's another skill's, load that one now and say so in a line.

## Before you start

- **Read `~/.claude/fleet-qa.local.md`**: it names the RC instance (usually context `default`), the
  fleetctl binary for the RC (check `fleetctl --version`), the QA workspace, the role users and the
  standing permissions. If it doesn't exist, create it first, per
  `${CLAUDE_PLUGIN_ROOT}/skills/fleet-bug-qa/references/local-setup.md`.
- **Check that every context you'll use still answers** (`fleetapi.sh <ctx> GET /api/v1/fleet/me`).
  Expired tokens go in one ask now (`fleetctl login --context <name>`).
- **Work in `<QA workspace>/qa-<N>/`** with `RESULTS.md`, `created.txt` (the cleanup manifest),
  `screenshots/` and `issue-comment.md`.

**Scripts** are fleet-bug-qa's, in `${CLAUDE_PLUGIN_ROOT}/skills/fleet-bug-qa/scripts/`; each header
has its usage. `fleetapi.sh <ctx> <METHOD> <path> [json | -F k=v]` is the authenticated REST call
(`FLEET_TOKEN=` for another user). Beside it: `screenshot.mjs <ctx> <path> <out.png> [--clip sel
--click text ...]`, `pw.mjs` (Playwright with the cookie login), `stack.py` (several shots into one
image) and `cleanup.sh`.

**References.** Each is a required read at the step that names it, not background:

- `${CLAUDE_PLUGIN_ROOT}/skills/fleet-bug-qa/references/fleet-gotchas.md`: before creating test data.
- `${CLAUDE_PLUGIN_ROOT}/skills/fleet-story-qa/references/instance-traps.md`: before the first UI step
  (signing the browser in, § Auth; the Fleet UI that misleads a check).
- `${CLAUDE_PLUGIN_ROOT}/skills/fleet-explore/references/tours.md`: step 2, for the one or two edge
  values a row needs (§ 1, 3, 8) and the oracles (§ 7). Not the tours.
- `${CLAUDE_PLUGIN_ROOT}/skills/fleet-bug-qa/references/screenshots.md`: before the first evidence PNG.
- `${CLAUDE_PLUGIN_ROOT}/skills/fleet-bug-qa/references/findings.md`: step 4, when something looks odd.

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

## Evidence: run the real code path, simulated or real, or ask

Driving alone is the default, not a rule against asking.

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

### 1. Understand the change (5 minutes, not 50)

- Issue body + comments, the linked PR(s) and their full diff
  (`gh pr list -R fleetdm/fleet --search <N> --state all`). Docs PRs count: a new API parameter
  should match its REST API reference entry.
- **Is it in the build?** `GET /api/v1/fleet/version` → revision;
  `git merge-base --is-ancestor <merge-sha> <revision>` (or `git branch -r --contains`
  for cherry-picks on the RC branch).
- **Did any of it already ship?** `git tag --contains <merge-sha> | grep fleet-v`. If a released tag
  contains it, note which part and which version.
- Entry points that reach the changed code: every route and prefix, fleetctl commands that wrap it,
  GitOps if it's a config field, UI surfaces that render it. Take names (params, fields, strings) from
  the code, not the ticket prose.

### 2. Plan a small matrix

Three row types, few rows each. Every row should be able to catch something the others can't:

- **Core** — the change as the issue describes it, on each entry point, plus the one or two edge
  inputs that matter for this kind of change (empty/absent, invalid value, false vs true, a host/fleet
  with no data, both platforms if the field is per-platform). Pick them by what the change touches: a
  new API field → omitted, `null` and an invalid value (`tours.md` § 3, payload shapes); a count, or
  copy with a number in it → 0, 1 and the page size ± 1 (§ 1, Numbers); a new name, column or text
  field → a long name and a one-character one, at 1440 and 768 (§ 1 catalog, § 8). For a new field,
  note its limit from the form and the validator; none anywhere is a Risk (step 4).
- **Regression** — what the change could plausibly break: default behavior when the new option isn't
  used, response size/shape for existing callers, the other screen that uses the same component or
  string.
- **Halo** — one or two adjacent workflows a user touches right after (the detail view vs the list
  view, fleetctl output, the doc example actually working).

For copy changes, core = the exact new strings in every place the issue lists (compare character for
character against the issue/PR, including punctuation and casing), regression = the other places the
old string or component still appears. Judge the new copy against the house style too (`tours.md` § 7,
product consistency: capitalisation, toast and empty-state wording, "fleets" and "reports" wherever
the UI was renamed); the API keeping its old names isn't a finding.

Share the matrix outline in one short message and proceed without waiting. If some rows need the
user (a device, a setting flip, a real UI login as a role), batch that ask with the outline and carry
on with the rows that don't.

### 3. Run it

Drive everything yourself: API calls on all prefixes, fleetctl, GitOps dry-run, the in-app browser for
UI, `screenshot.mjs`/`pw.mjs` for evidence PNGs. Create test data freely (fleets, hosts via
osquery-perf, API-only users, labels) and record every object in `created.txt` as you create it.

For performance-sensitive API changes (a list endpoint that now populates more data), compare
response time and size with and without the option on the largest realistic page (300 osquery-perf
hosts, or an Ubuntu simulation's 1,600+ packages: `tours.md` § 1, Numbers). That's the regression a
quick win most often ships.

If a surface only appears under a global setting that's off (report storage, a feature flag, the
other license tier) or in a state you can't reach through a simulation, ask the engineer to switch it
(see Evidence) and keep going with the rest of the matrix meanwhile.

### 4. Findings

Origin is *this change*, *released* (in the latest release tag), or *pre-existing*. Take everything
odd through `findings.md` before it goes on the **decision list**: vary one thing, say what it's wrong
against (the issue, the docs, a sibling page, house style), say who would hit it, search the open
issues and the engineer's own filed bugs, capture it ticket-grade before cleanup, and recommend file,
mention or drop. Cosmetic ones are on the list too; the user decides. Behaviour you can't call right
or wrong goes in **Questions for product**; what hasn't broken but is one realistic step away (an
unbounded field) goes in **Risks**. File what they choose with `fleet-bug-file`. When the neighbours
deserve more than the halo rows (the other screen that uses the same component, worst-case data in
the field the change added), offer a `fleet-explore` session rather than growing the matrix.

### 5. Comment

Save to `issue-comment.md` and print it in a four-backtick block, as soon as the rows are in:

````markdown
QA **<Pass | Pass with notes | Fail>** — <X>/<Y> checks on `<branch>`. <one sentence of scope>

| # | Type | Case | Result |
|---|---|---|---|
| 1 | Core | <case in user terms> | ✅ <observed, few words> |
| 2 | Regression | <case> | ✅ unchanged |
| 3 | Halo | <case> | ✅ |
````

`X/Y` counts rows actually run live, for real or through a full-path simulation; a row backed only by
a workaround stays in RESULTS.md. Add one line under the table only when a row's significance isn't
obvious ("Already shipped in 4.92.0; 4.93 only changes the copy"). No setup, mechanism or
test-coverage commentary: that's in RESULTS.md. When you say why the current behaviour is wrong, say
the consequence a user sees, in one sentence. A finding the engineer dropped doesn't change the
verdict.

Screenshots go out per `screenshots.md`, one caption each naming its row. Shots that are read
together (old vs new copy, with vs without the new parameter, two roles on the same page) go out as
one image, since the engineer attaches one image per row.

### 6. Cleanup

List `created.txt` newest-first and ask before `cleanup.sh --run`.
