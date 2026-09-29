---
name: fleet-story-qa
description: Partner with the QA engineer on a Fleet user story (label `story`) — read the story, its test plan and every PR, map the diff to what's risky, propose a tighter test plan, then split the work — Claude takes API, fleetctl, GitOps, role matrices, obvious UI and exploratory checks on the live RC instance, and hands the human one batched list of device, license and settings actions to run; findings go to a decision list, and the end is a short manager-level sign-off comment. Use whenever the user wants to QA, test, verify, "go through the test plan of", or sign off a Fleet story or feature issue — even if they just paste a story link and say "let's QA this", ask which test-plan rows are left, or want help with a story's API/permissions/GitOps checks. Do NOT use for bug fixes or security fixes that need a before/after repro (fleet-bug-qa), for small ~quick-win issues Claude can drive alone (fleet-quickwin-qa), to file a bug (fleet-bug-file), or to write a test plan from scratch.
---

# Fleet story QA — partner mode

A story is bigger than a bug and there's no "before" to compare against: the
feature didn't exist. The QA engineer drives devices, licenses and global
settings by hand; Claude's job is to make their time count — find what's likely
to break before anyone touches a device, take everything that can be driven from
outside (API, fleetctl, GitOps, DB state, logs, headless UI), and keep the test
plan honest without making it bigger.

The engineer is usually slammed, so batch what you need from them and make each
item exact: the step, the instance, and what you'll check right after. Don't ask
for what a simulation already covers — but don't dodge an ask with a workaround
either. Two minutes of their time on a real setting beats an afternoon of evidence
that skipped half the code path (see **Evidence** below).

## Tooling

Reuse the bug-QA scripts rather than copies — `.claude/skills/fleet-bug-qa/scripts/`:
`fleetapi.sh <ctx> <METHOD> <path> [json | -F k=v]` (`FLEET_TOKEN=` to act as
another user), `screenshot.mjs`, `pw.mjs` (Playwright with cookie login),
`stack.py` (combine shots into one image), `cleanup.sh`. Instance
contexts and tokens are in `~/.fleet/config`; the fixed/RC instance is the one
`.claude/fleet-qa.local.md` names (usually `default`). There is no pre-fix
instance to set up.

Read `.claude/fleet-qa.local.md` first: this machine's instances, Fleet checkout,
QA workspace, databases, logs and role users. If it doesn't exist, create it
before anything else, per `.claude/skills/fleet-bug-qa/references/local-setup.md`.
Before building test data, skim `.claude/skills/fleet-bug-qa/references/fleet-gotchas.md`
and `references/instance-traps.md` (this skill). The second covers the instance
traps that cost earlier story runs time (which server is which, Free needs a
restart, API-only users expire).

Work in `<QA workspace>/qa-<N>/`: `RESULTS.md` (the lab notebook:
everything run, with evidence), `created.txt` (cleanup manifest, same line format
as `cleanup.sh`), drivers, `screenshots/`, `snapshots/`, `issue-comment.md`.

## Hard lines

These come from real corrections — each one cost a user something once.

- **Never flip global state the human owns**: MDM on/off for any platform, the
  license (`--dev_license`), GitOps mode, Apple/Android enterprise setup, org
  settings. Turning Android MDM off deletes the enterprise and every Android app in
  every fleet. Ask; the human does it.
- **Never type a password** or create/delete human accounts. For API role checks
  use API-only users (they return a token). They can't open the UI, so for UI-by-role
  use the real role users with fleetctl contexts listed in
  `.claude/fleet-qa.local.md`, or ask the human to sign in as that role.
- **Never post, edit or delete on GitHub unless asked in this conversation.** Give
  comments as copiable blocks. Ticking test-plan boxes on the ticket is fine only
  once the user has asked you to keep them updated — and only tick what was
  actually exercised.
- **Don't weigh in on release process.** An unreleased bug ships in the release
  that introduced it; released vs unreleased is a fact to establish, not a
  recommendation to make.
- **Scratch code never stays in the repo.** Throwaway tests go in, run, and come
  out (keep copies under `qa-<N>/`). If an unrelated file of the user's breaks the
  build, move it aside for the one run and restore it byte-for-byte.
- **Put test data on objects you created.** Real hosts, users and fleets belong to
  the engineer's ongoing work (a device mid-test, a VM they use daily). Enroll
  osquery-perf hosts or create a `qa-<N>` fleet instead of editing a real host's
  IdP mapping, labels or fleet — even temporarily.
- **Some GETs write.** Before calling an endpoint during "read-only" work, read its
  handler: the zero-touch configuration GET mints a Google token when none exists,
  and a first page load can do the same. When the first call *is* the thing under
  test, save it for the moment the plan needs it.

## Evidence: run the real code path — simulated or real — or ask

A row passes only when Fleet's own code for that behavior ran on the build under
test, starting from the entry point a user would hit. Three ways to get there, in
this order:

1. **Simulate the whole path** whenever that covers the row — it costs nobody's
   time, so it comes first. osquery-perf hosts (desktop, iPhone/iPad over MDM,
   Android) enrolling through the real endpoints; API-only users for API role
   checks; a real API call against a simulated host to reach a state (a real wipe
   command gives you "wipe pending"); `fleetctl trigger` instead of waiting for a
   cron. The test: would any production code on this row's path behave differently
   if the host, user or state were real? If not, the simulation is as good as the
   real thing. Look for the most realistic route before settling for less — when
   osquery-perf has no template for a platform, the agent's real enroll request
   (`POST /api/v1/osquery/enroll` with that platform) still runs Fleet's own
   enrollment, where a hand-inserted host row doesn't. Where the real thing
   already exists — a device in the right state, a setting that's already on, a
   real user of the role — use it, read-only.
2. **Ask the QA engineer** for whatever a simulation can't reach and you mustn't do
   yourself: a license switch, an MDM toggle, an org setting (Fleet Desktop SSO,
   GitOps mode), a real UI session as some role, a device action, a third-party
   console. It goes in the batched ask with the exact step and what you'll check
   after. Don't decide for them that it's too disruptive, too slow or already
   covered ("the developer tested it on a device", "switching to Free would disturb
   another session") — that's their call, and usually they just do it.
3. **A workaround only with their go-ahead** — they say the real setup can't be
   done, or that a workaround is good enough for this row. That's a hand-inserted
   DB row, a mocked failure in a scratch test, an intercepted response for an error
   nobody can trigger. Propose the specific workaround and what it would skip, then
   use it once they agree. Record it in RESULTS.md as what it is; it goes in the
   comment only if they want it there, labeled with how it was checked — never as
   a bare ✅.

Faking what Fleet says is not coverage, however convincing the screenshot:
rewriting responses in the browser (`page.route` to change the license, the
viewer's role, a setting or a host's state) only shows how the frontend reacts to
data Fleet may never send. Reading the code instead of running it isn't coverage
either — it's how the bugs QA exists for slip through: an Apple-MDM check hiding a
Windows feature stays invisible until someone actually turns Apple MDM off. Code
and unit tests tell you where to look; they don't pass a row.

Don't close with "worth confirming on a real device". If a device, a setting or a
role would change your confidence, it belonged in the ask while the run was going.

## Workflow

### 1. Read everything, then map risk

Read the story body and comments, the test plan, and **every** linked PR's diff
(backend, frontend, docs, cherry-picks: `gh pr list --search <N> --state all`,
`git log --oneline --grep <N>`). Check what the instance actually runs
(`GET /api/v1/fleet/version` revision, `git merge-base --is-ancestor <sha> <rev>`).

Then write a short risk map in RESULTS.md — this is where most real findings come
from. For each changed code path, ask:

- **Entry points**: which routes, fleetctl commands, GitOps/batch paths, crons,
  pub/sub or check-in handlers reach it? Which API prefixes? Is it in the
  API-only-user endpoint catalog (`server/api_endpoints/api_endpoints.yml`)?
- **Gating**: tier (Premium/Free, backend *and* frontend), role (global vs fleet,
  each role), which MDM platforms must be on — and whether something non-Apple is
  accidentally gated on Apple MDM (`VerifyAppleMDM` middleware,
  `mdm.enabled_and_configured` in the UI). Frontend route guards for new pages.
- **State shape**: read-then-write without locking (concurrent first calls),
  unique keys, what's written before an external call vs after (orphans on
  failure), primary vs replica reads right after a write, cascade/cleanup when the
  parent (fleet, host, enterprise) is deleted, what's left behind on disable.
- **Secrets**: anything stored or returned that shouldn't leak (logs,
  `generate-gitops`, `fleetctl debug archive`, non-admin endpoints).
- **Docs vs code**: the REST API reference (docs branch for the release) vs the
  actual response shape; field names taken from code, never from ticket prose.

Name the file:line for each risk. Risks become targeted checks in step 3 — this is
the one place it's worth adding a test-plan row. A risk read from code is a
hypothesis: say what you expect ("second call likely fails on the unique key")
without asserting the exact status or message until a live check shows it —
error mapping layers often turn a raw DB error into something else.

### 2. Propose a tighter test plan — don't grow it

The plan in the ticket is a starting point, and it may be long, stale, or written
by someone who hadn't seen the code. Propose changes **in chat only**; never edit
the ticket body (a separate skill will own test planning).

- **Collapse** rows that exercise the same code path: five UI variations of the
  same endpoint call are one API check plus one UI glance.
- **Flag stale rows**: behavior the implementation changed (a check that now
  refuses before the external call, a field renamed, a flow moved).
- **Don't answer rows from code.** Code shows which rows are really one path
  (collapse them) and where the risk sits; it doesn't pass a row. When a row's
  live check needs something only the engineer can do — Apple MDM off to prove a
  Windows feature has no Apple gate, Free to see the tier gating — it goes in the
  ask. They may decide the row isn't worth it and drop it; that's their decision
  to make, not yours.
- **Add** only a row that covers a risk from step 1 nothing else covers. If you
  can't name the file:line risk, don't add it.

Keep the proposal to one screen: which rows you'll take and how (what you'll
simulate, with what), which are the human's, which collapse, any additions with
their risk.

### 3. Split the work, then run your share

**Yours** — anything driven from outside a device:
- API on all prefixes; role matrix with API-only users per global and fleet role
  (record each in `created.txt`); unauthenticated; Free vs Premium responses.
- fleetctl and GitOps round-trips (`generate-gitops` output, `gitops --dry-run`).
- DB state before/after (the database command in the local file),
  server logs (where they are is in the local file),
  activities, cron runs (`fleetctl trigger --name <cron>` to avoid waiting).
- Concurrency and failure paths: parallel `curl` bursts. For a failure you can't
  trigger live on your own objects, ask how the engineer would produce it (a
  revoked token, a stopped proxy, a throwaway integration) before falling back to a
  mocked scratch test.
- UI: the obvious states in the in-app browser (render, empty, error, premium,
  role-gated, narrow width); evidence PNGs via `screenshot.mjs`/`pw.mjs`. A state
  the instance can't produce without a global change (Free, a setting that's off,
  another role's view) goes in the ask, not into an intercepted response.
  A PNG sitting in `screenshots/` is evidence only you have: read each one (it must
  show the thing, not a spinner or login page, and no tokens or enroll secrets —
  tickets are public), then send it with `SendUserFile` (display `attach`) as each
  area finishes, one caption line per image naming the case. The engineer attaches
  these to the ticket and uses them to follow along. Shots read together — a click
  and where it lands, a fleet vs "All fleets", two platforms of the same view — go
  out as one image (`stack.py out.png a.png b.png`, `--side` for narrow clips; crop
  each to the part that matters first); shots for different cases stay separate.
- Exploratory: poke the neighbours of the change — list/detail pages, the same
  feature on the other platform, what happens on delete/disable of the parent.

**Theirs** — one batched message: devices (enroll, wipe, factory reset, transfer),
license, MDM and org-setting toggles, portal/third-party consoles, a real UI login
as a given role — every state from the Evidence section that a simulation can't
reach. For each item give the exact action, which instance, any precondition that
matters ("don't open the page before I've run the burst"), and what you'll check
right after. Then keep working on your share while they do it.

**Snapshot before their destructive steps.** Before a wipe, host delete, MDM
toggle or transfer, save the host JSON, relevant DB rows and activities to
`snapshots/pre-<step>/`; afterwards, diff and report in a before/after table. This
is what turns "it re-enrolled" into evidence (same record? new id? what survived?).

Poll with bounded loops for anything asynchronous (enrollment, profile delivery,
cron) and report timestamps. If a background watch dies (server restart), say so
rather than reporting its last line.

### 4. Classify findings honestly

For every unexpected behavior, establish:
- **Origin** — *this story* (in its PRs), *released* (same code in the latest
  release tag: `git show fleet-v<latest>:<file> | grep ...`), or *pre-existing but
  exposed by this story*. Search open issues first; an existing issue gets a
  comment offer, not a duplicate.
- **Device vs Fleet** — when behavior comes from Android/Google/Apple (zero-touch
  enforcement, a device refusing lost mode after a passcode reset), say so; it
  isn't a Fleet bug, but it may belong in the feature guide.
- **Could Fleet even know?** Before calling stale state a bug, ask what signal
  Fleet has. A device moved elsewhere looks exactly like one powered off.

Put everything in a **decision list** in chat (`# | finding | origin | severity |
repro / file:line`) and let the user choose file / mention / drop. File chosen
ones with the `fleet-bug-file` skill.

### 5. Sign off

When the user asks, give a copiable comment (saved to `issue-comment.md`,
four-backtick fence) — the reader is a manager asking "is it done, and how broadly
was it checked?":

````markdown
QA **<Pass | Pass with notes | Fail>** on `<branch>`. <one sentence of scope>

| # | Area | Case | Result |
|---|---|---|---|
| 1 | Core | <grouped cases, user terms> | ✅ |
| 2 | API | <case> | ❌ #<issue> |

**Issues found**
| Issue | Origin | Severity |
|---|---|---|
````

Group the matrix by area, one row per area-case, not one per test-plan line.
Mark human-run rows the same as yours (it's a team sign-off) but only include
rows someone actually ran — if the user ticked boxes you didn't see, ask before
claiming them. A ✅ means the row ran live, for real or through a full-path
simulation; there's no "simulated" or "verified in code" result. A row backed only
by a workaround the engineer approved stays in RESULTS.md unless they want it in
the comment, labeled with how it was checked. No setup, mechanism,
"not covered" list or test-coverage commentary.
Put the smaller observations (pre-existing quirks the user didn't choose to file)
in RESULTS.md, and mention them in one line in chat.

### 6. Cleanup

List `created.txt` newest-first and ask before running `cleanup.sh --run`. Only
touch what this run recorded. Anything you restored for the user (apps deleted by
an MDM toggle, a test-plan box) goes in RESULTS.md.
