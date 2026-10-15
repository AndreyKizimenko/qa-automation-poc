---
name: fleet-test-plan
description: Write or update the test plan for a Fleet user story (label `story`). Runs first from the finalized design (story, API/YAML docs PRs, Figma, linked docs, the code it will touch, past bugs in the area), then again once the engineer's PR is up, folding in what the diff shows. Produces the story's "Test plan" section sized for how Fleet QA actually runs it — thorough where Claude can execute it (API, fleetctl, GitOps, roles, simulated hosts), lean and batched where a person must (devices, license, MDM toggles) — plus open questions for product, and edits the issue only after the user says yes. Use whenever the user asks to write, draft, flesh out, finalize, review, refresh or update a test plan for a Fleet story or feature issue — "test plan for #55612", "design's done, plan the testing", "the PR is up, update the plan", "fill in the edge cases", a `~finalize-testplan` issue — even if they just paste a story link and say "test plan". Do NOT use to execute a plan or sign off a story (fleet-story-qa), for bug or security fixes (fleet-bug-qa), for quick wins (fleet-quickwin-qa), or to file a bug (fleet-bug-file).
---

# Fleet story test plan

A story's test plan gets run twice: by the engineer before the story moves to "Awaiting QA", then by QA
with **fleet-story-qa**. There, Claude drives everything that can be driven from outside a device (API,
fleetctl, GitOps, role matrices, simulated hosts, headless UI). The QA engineer handles devices,
license and MDM switches, and third-party consoles. A QA engineer covers 30–40 tickets a release, so
their hands-on share has to stay small. A plan that cuts real coverage doesn't save that time, though.
It just moves the bugs into the release.

So size each row by **who will run it**:

- **Rows Claude can run are cheap, so be thorough.** Cover every entry point that reaches the
  changed behavior (each endpoint and API prefix, fleetctl, the GitOps batch path, crons, workers),
  every role, validation cases, GitOps in both directions, activities, and docs vs the real response.
- **Rows a person runs are expensive, so make each one count.** Use a device for what only a device
  can show (the setting actually applies, the prompt appears, the work profile is gone), never for
  what an API call already proves. Order device rows so one enrollment or reset serves several
  checks. Group global switches (Free license, MDM off) so each happens once, and put destructive
  ones last.

**Collapse, don't cut, and don't pad.** When several cases go down the same code path, merge them
into one row that lists every input. fleet-story-qa still runs each input, and the plan stays
readable. Remove a row only when it's a true duplicate or stale, never because the case is "probably
fine". The plans that disappointed QA weren't too long. They had dropped entry points, roles and
lifecycle events that nobody else was going to check. Padding costs time too, though: rows for code
the story didn't change, a full role matrix when permissions didn't change, re-tests of what a
sibling story's plan already covers. Coverage follows the change.

## Which pass is this

Run `story_context.py` first (step 1). It prints a phase guess:

- **design-first / design-update:** no implementation PR yet. Sources are the story and its comments,
  the API/YAML docs PRs, Figma, linked docs and guides, the *current* code the story will change, and
  past bugs. Expected results come from the spec. Product may already have drafted the core flow.
  Keep their rows and build around them.
- **pr-first / pr-update:** the engineer's PR (or its cherry-pick) exists. Do everything above, plus
  read every code PR's diff, then update the existing plan rather than rewriting it (step 5).

The same story often comes through twice, once after design and once after implementation. That's
expected. The second pass builds on the first.

## Setup

Read `~/.claude/fleet-qa.local.md` for the Fleet checkout and QA workspace paths. This skill needs no
instances, so if the file is missing, just ask for the Fleet checkout path and work in
`./test-plan-<N>/`. Otherwise work in `<QA workspace>/test-plan-<N>/`.

Read Fleet code and docs **without touching the user's checkout**, since it may hold their work. Run
`git -C <fleet> fetch origin`, then `git show origin/main:<path>`, `git grep -n <pattern> origin/main
-- <dirs>`, `gh pr diff <PR> -R fleetdm/fleet`. Reference docs for an unreleased version live on the
`docs-v<version>` branch (`git show origin/docs-v4.95.0:"docs/REST API/rest-api.md"`).

Scripts are in `${CLAUDE_PLUGIN_ROOT}/skills/fleet-test-plan/scripts/` (Python 3, stdlib only, need
`gh`).

## Hard lines

- **Edit GitHub only after an explicit yes in this conversation**, and only the story's Test plan
  section, through `splice_test_plan.py` (preview, then yes, then `--apply`). The issue body is
  public and the whole team works from it. Never post comments, change labels or milestones, or tick
  checkboxes outside the plan. "First draft of test plan added" and "Test plan is finalized" belong
  to Product and Engineering.
- **Keep what other people wrote.** Ticked boxes stay ticked. Notes, links and rows from Product or
  the engineer stay unless they're clearly superseded, and the change list says why. Adding a
  surface prefix or concrete inputs to someone's row is fine. Changing what the row checks is a
  change, and it needs a reason.
- **The spec defines "correct".** Code shows where the risk sits and which rows share a path. It
  doesn't decide the expected result. When the code and the spec disagree, keep the spec in the row
  and raise the mismatch as a question.
- **A code reading is a hypothesis until you've traced it.** Before something you read in the code
  changes a row's expected result or becomes a question, trace the whole path from the route:
  request decoding, authorization (the `authz.Authorize` calls and `server/authz/policy.rego`), the
  order of the checks, and error mapping. Then look for confirmation in the engineer's tests or
  their QA comment on the PR. If you can't confirm it, keep the spec's expectation (or an
  observable outcome) in the row and put your reading in `notes.md`. A wrong but confident
  expectation costs more than a vague one: QA logs a false failure, or PM gets asked about a gap
  that doesn't exist.
- **Don't invent exact messages or status codes.** Quote them only when the story, the docs PR,
  Figma or a confirmed observation (the engineer's QA comment, their tests) gives them. Otherwise
  state the observable outcome ("rejected with a message naming `reason`, nothing saved, no 500")
  and ask if the exact text matters. Behavior attributed to an older release comes from that
  release's tag (`git show fleet-v4.93.0:<path>`), not from main.
- **The plan is public, and engineers run it too.** Write rows in terms of Fleet behavior and
  standard tools: UI, API, fleetctl, the database, server logs, a device. Don't name personal
  instances, local harnesses or mocks, and don't say whether Claude or a person runs a row (the
  surface prefix already shows it). QA-only methods go in `notes.md`, where fleet-story-qa picks
  them up.
- **Name a step's cost when it's high.** Turning Android MDM off deletes the enterprise and every
  Android app in every fleet. A factory reset is slow and can't be undone. Say so in the row and put
  it last.

## Workflow

### 1. Gather

```bash
S=${CLAUDE_PLUGIN_ROOT}/skills/fleet-test-plan/scripts
python3 $S/story_context.py <N> --out <ws>
```

This writes `story.md`, `comments.md`, `test-plan-current.md` and `context.json` (linked PRs sorted
into docs vs code and cherry-picks, linked issues and bugs, sub-issues, Figma links). Then read:

1. **The story and every comment.** Decisions and scope changes land in comments and can overrule the
   body. Also read the parent story, sub-issues and linked issues it names, at least their titles and
   whatever relates to this story. Note **sibling stories**, which are other stories in the same
   release that change the same code (the parent's other sub-issues, or stories the same PRs close).
   Behavior they share gets tested in one plan, and the other plan points to it.
2. **The spec PRs** (REST API and YAML docs, usually against `docs-v<version>`). Read the diff. It's
   the contract: params, defaults, errors, examples.
3. **Figma.** If a Figma tool is available (the Figma connector: `get_metadata`, `get_screenshot`,
   `get_design_context`), open each link. In `.../design/<fileKey>/...?node-id=2-130`, the node is
   `2:130`. List the frames, look at the ones for this story, and read every "Dev notes" text,
   because dev notes carry edge cases the designer already decided. If no Figma tool is available,
   say so in one line (the user can connect the Figma connector or paste screenshots) and continue
   from the story text. Mark the UI rows you couldn't check against Figma in `notes.md` and in the
   summary.
4. **Linked guides and docs**, plus the feature's existing docs, so you know today's behavior.
5. **The code the story touches**, even in the design pass. The story's implementation notes often
   name the files. Otherwise go from the route in `server/service/handler.go` to the service method,
   then find every other caller: fleetctl, the GitOps batch endpoint, workers, crons, MDM check-in or
   pub/sub handlers, the frontend. Each caller is an entry point and probably a row. In the PR pass,
   read every code PR's diff, including the engineer's new tests: they show which cases the engineer
   thought about, which is a hint, not coverage.
6. **The PR conversation** (PR pass). `story_context.py` saves each code PR's description, comments
   and review threads to `pr-<N>.md`, so read all of them, not just the diffs. Engineers post what they
   ran and saw (actual responses and status codes), known gaps ("not fixed yet"), and decisions
   made in review. An observed result is the best evidence for an expected result. A known unfixed
   problem becomes a row that names its issue, or a question if nobody has filed one.
7. **Past bugs in the area:**
   ```bash
   python3 $S/related_bugs.py -k "<feature words>" -k "<other phrasing>" \
       -s <FunctionTheStoryChanges> -s <AnotherOne> --fleet <fleet> --out <ws>/bugs.md
   ```
   Keyword hits find bugs by topic. `-s` (functions the story changes) finds bugs fixed in that exact
   code, which is often where the next one lands. Read the top relevant ones (what broke, and why) and
   turn each that still applies into a row or an edge case. Skip unrelated hits from big shared code.
8. **The live checklists.** Run `git show origin/main:.github/ISSUE_TEMPLATE/story.md` (including the
   commented-out "Suggested checks") and `git show
   origin/main:docs/Contributing/guides/ui/design-qa-considerations.md`. Both change over time, so
   read them, don't recall them.

### 2. Map risk (in `notes.md`, not the issue)

Go through `references/coverage-lenses.md`: the template's Changes items (including the "No changes"
claims to double-check), the Fleet events, the bug classes that keep escaping, and who can run what.
For each change, write down:

- **Entry points:** each route and prefix, CLI command, GitOps path, background job, UI surface.
- **States and events** that touch it: fleets (Unassigned, deleted, renamed), host lifecycle,
  platform and ownership, MDM on or off, tier, GitOps mode.
- **Gating:** tier (backend and frontend), each role (global and fleet), API-only endpoint catalog,
  which MDM must be on.
- **Data:** upgrade from the previous release, concurrency on first use, external calls failing or
  returning not-found, cleanup when the parent is deleted.
- **Past bugs** that apply.
- **Lenses that don't apply**, one line each on why. This is what lets the second pass, or a reviewer,
  see the gap was considered rather than missed.

### 3. Write the plan

Write `<ws>/plan.md`: the Test plan section's content, without the `### Test plan` heading. Start it
with the template's reminder line as-is:

```markdown
> Make sure to go through [the list](https://github.com/fleetdm/fleet/blob/main/docs/Contributing/guides/ui/design-qa-considerations.md) and consider all events that might be related to this story, so we catch edge cases earlier.
```

**Sections: the story template's, nothing else.** Engineers, PMs and QA all know these sections,
and a plan with its own sections ("Validation", "Clearing", "Docs") ends up checking the same thing
in two places. Use only the sections that apply, in this order:

| Section | What belongs here |
|---|---|
| Setup | Not rows: what's needed, named once (see below). It's the one block the template doesn't have. |
| Core flow | The story's happy path end to end, on the surfaces the story names, including what the device shows. Each step once. |
| Edge cases | Everything unusual: input the feature rejects or accepts at the boundary (the full value matrix), missing config, deleted or changed related objects, lifecycle (transfer, re-enroll, delete), concurrency, external failures, open bugs the path will hit. |
| UI | Only what the UI adds beyond the API: states (loading, empty, error), where an error shows, long names, widths, guide-vs-page checks. |
| API | The endpoints' contract: each new or changed endpoint and parameter, prefixes, malformed parameters (unknown ids, wrong types), response vs the REST docs, the API-only endpoint catalog. |
| GitOps (generate + run) | `fleetctl gitops` apply, dry-run and clearing, and the `generate-gitops` round trip. |
| Permissions | The role matrix, or the one row confirming an unchanged gate. |
| Premium gating | Free, backend and frontend. |
| Upgrade / data migration | Behavior on a server upgraded with existing data. |
| Feature in isolation | One platform's MDM only, other MDM off, GitOps mode, including destructive switches like turning Android MDM off. |

Global-switch sections (Premium gating, Upgrade, Feature in isolation) come last because they
disrupt the instance.

**Every check lives in exactly one row.** Before writing, list each check as behavior × entry point
× input and give it one home using the table. The overlaps that crept into earlier plans:

- **The full input matrix on every entry point.** Run the full matrix of values on one entry point
  (Edge cases). Add one more row that sends one representative bad input through every other entry
  point (API, add, batch, GitOps, the UI). Never repeat the cross product, and never repeat an
  input/entry-point pair.
- **The same outcome checked in Core flow, API and Edge cases.** "Hosts get the value", "the value
  doesn't leak" and "activities logged" each belong in one row that lists the surfaces it checks.
- **Product's rows plus a parallel copy.** When Product's row covers a check, make their row
  concrete (inputs, surface, observable result) instead of adding your own beside it.
- **A UI row repeating the API row.** The UI row checks only what the UI adds.

**Setup** names everything once, so rows can refer to it: tier, which MDM is on, the fleets ("Fleet
A", "Fleet B"), the test objects (apps, profiles, labels), which hosts can be simulated and which must
be real devices (OS version, BYOD vs company-owned), and the users and roles. Describe what's needed,
not a particular tool or instance. When some rows need something the RC can't produce (simulated
Android hosts need a server whose Google side you control, for example), say so in general terms and
name the rows that need it. If device rows involve resets, give the order that shares them.

**Rows:** `- [ ] <Surface>: <action with exact inputs> → <observable result>`.

- **Surface** is one of `UI`, `API`, `fleetctl`, `GitOps`, `Device`. Every row has one, so the split
  between Claude and the person is obvious at a glance.
- **One behavior per row**, short enough to read at a glance (a line or two). Several inputs to the
  same behavior can share a row as a list; separate behaviors get separate rows. Reasons, code
  references and how-to-check details go in `notes.md`, not in the row.
- **Inputs are concrete:** the endpoint, params and body; the YAML keys; the role names; the fleet.
- **Results are observable:** status code and message when the spec gives them, the UI text, the
  device setting path, the activity type, what `GET` returns afterward. Never "works" or "succeeds"
  on its own.
- **Matrices are one row:** "API: global maintainer, observer, observer+, technician; Fleet B admin →
  403" rather than five rows that each say 403, and rather than one "permissions work" row that
  hides which roles were checked.
- **One matrix plus one UI glance.** Every rejected-input case runs once, on one entry point. The
  UI gets one row showing where and how the error appears.
- **A row that depends on an open question** says so inline: "→ allowed through the API. Confirm
  with PM that this is intended."
- **A row that sets a deliberately bad or conflicting value** restores it in the same row ("…, then
  remove it"), or uses an object no later row touches. Otherwise every later step that pushes the
  same host's or fleet's settings fails for the wrong reason.
- **A row that will hit an open bug** names it ("→ cleared. Known: #55562.") so nobody files it
  again and the sign-off can link it.
- **Fleet terms:** "fleets", not teams, and "reports", not queries. API params keep their real names
  (`fleet_id`, `team_id`), whichever the endpoint uses.

**Size check before you finish.** Coverage follows the change. Count what the story changed: each
new or changed behavior, times each entry point that reaches it, plus the lenses that apply. A
one-field change usually lands around 12–25 rows. A feature spanning UI, API, GitOps and devices
usually lands around 30–45. Far fewer usually means dropped entry points or roles. Far more usually
means padding:

- rows for behavior the story didn't change. When permissions didn't change, one row confirming the
  existing gate still holds replaces a full role matrix.
- re-tests of code a sibling story owns. Point to that story's plan in a row or a Setup line
  ("Shared validation and entry points: covered in #51454's plan"), and test only what's specific to
  this story: its own input or value through one entry point, plus whatever only it changes. Being
  cheap to run doesn't make a shared path this story's to cover.
- rows for features that might ship later, or for configurations Fleet doesn't support. Mention
  them in `notes.md` instead.

On the person's side, aim for one sitting of about an hour or two, with each global switch happening
once. If it runs longer, say in the summary which person-run rows you'd drop first and why, and leave
the choice to the QA engineer.

An illustrative excerpt (made-up story: require a reason when locking a host):

```markdown
#### Setup
- Fleet Premium RC, Apple and Windows MDM on. Fleets A and B.
- Simulated macOS, Windows and iPhone hosts in Fleet A. One real Mac in Fleet A for the device rows.
- API-only users for each global role and for each role on Fleet A.

#### Core flow
- [ ] UI: Host details > Actions > Lock on the macOS host → the modal shows a required "Reason" field; Lock stays disabled until it has text.
- [ ] UI: enter "Lost at airport" → Lock → the host shows "Lock pending"; the `locked_host` activity includes the reason.
- [ ] Device: the real Mac locks and its lock screen shows "Lost at airport".

#### Edge cases
- [ ] API: reason missing, `""`, spaces only, 1,001 characters → rejected with a message naming `reason`; the host isn't locked.
- [ ] fleetctl: `fleetctl mdm lock` without `--reason`, and the UI with an empty field → the same rejection; nothing sent.

#### API
- [ ] API: `POST /api/v1/fleet/hosts/:id/lock` with `{"reason":"Lost"}` on the macOS, Windows and iPhone hosts, on `/api/v1` and `/api/latest` → 204, `GET /hosts/:id` shows the pending lock and the reason.
- [ ] fleetctl: `fleetctl mdm lock --host <host> --reason "Lost"` → locked with the reason.

#### Permissions
- [ ] API: global and Fleet A admin, maintainer, technician → allowed. Global and Fleet A observer, observer+; Fleet B admin → 403.
- [ ] API: API-only user with only "Lock host" granted → allowed; without it → 403.
```

### 4. Open questions

Collect what the plan can't settle: spec gaps, contradictions between the story, the docs PR and
Figma, "No changes" claims that look wrong, decisions the story leaves open, and (in the PR pass)
code that disagrees with the spec. Write `<ws>/questions.md` as a copiable comment, one numbered
question per line, each saying which rows depend on it. The user decides whether and where to post
it. Don't block the plan on answers. Write the dependent rows with the most likely spec-consistent
outcome and the inline "Confirm with…" note.

### 5. PR pass: update, don't rewrite

Start from `test-plan-current.md`. Keep every row that's still right, with its wording and checkbox.
"Still right" covers the row's inputs too. Check every literal value in an existing row (enum values,
endpoints, field and key names, role names) against the code or the vendored API types. A row with a
wrong input isn't right: fix the input and say so in `changes.md`. Then, using the diff:

- **Add** rows for entry points, side effects and risks the diff reveals that the plan doesn't
  cover: a shared validator reached by three routes, a new background job, a migration, a new
  activity.
- **Change** rows whose inputs or expected results the implementation made concrete, after tracing
  them (see Hard lines). Only change the spec's expected result when a decision in the story, its
  comments or the PR conversation did.
- **Collapse** rows that the code shows are one path, keeping all their inputs.
- **Flag, don't delete,** rows the diff doesn't seem to implement. Either the PR is incomplete or the
  row is stale, and the engineer is the one who can say which. These go in questions.
- **Remove** only true duplicates and rows the story itself has dropped.

Write `<ws>/changes.md` with one line per added, changed, collapsed, removed or flagged row and its
reason.

### 6. Deliver

In chat:

1. **Summary**, a few lines: which pass, sources read and any that were missing (for example "Figma
   not reachable, so UI rows are from the story text"), row counts by runner (Claude / person), what
   the person needs (devices, switches, consoles) and a rough time for their share.
2. **The plan.** In the design pass, print the whole thing. In the PR pass, print `changes.md`, then
   the full plan.
3. **Open questions**, as the copiable block from `questions.md`.
4. **Ask whether to update the issue.** On yes:
   ```bash
   python3 $S/splice_test_plan.py <N> <ws>/plan.md --out <ws>           # preview: backup + diff
   python3 $S/splice_test_plan.py <N> <ws>/plan.md --out <ws> --apply   # after the user's yes
   ```
   Show the preview diff before applying if the user hasn't seen the final text. If `--apply`
   refuses because the body changed (someone ticked a box or edited the story), re-read it, fold the
   change into the plan, and preview again.

Before you deliver, do a dedupe pass. Read the plan once, row by row, and for each row ask whether
another row already checks the same behavior through the same entry point with the same input. If
one does, merge the two, keep every distinct input, and note the merge in `changes.md`. Then reread
`notes.md` against `plan.md`. If `notes.md` says a row can't happen as
written, or will behave differently, change the row (or flag it with a question) instead of leaving
the finding in your notes only.

Leave `notes.md`, `bugs.md`, `changes.md` and `questions.md` in the workspace. The next pass, and
fleet-story-qa, start from them.
