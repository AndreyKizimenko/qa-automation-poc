---
name: fleet-quickwin-qa
description: QA a small Fleet change end to end on the current RC instance, with Claude driving — typically a `quick-win` / `~context` issue, a copy or help-text change, a new API field or parameter, a small UI tweak, a fleetctl flag. Reads the issue and PR, confirms the change is in the build (and whether it already shipped in an earlier release), runs a compact core + regression + halo matrix through the API, fleetctl, GitOps and headless UI with screenshots, and ends with a short copiable ticket comment plus a decision list. No pre-fix instance or baseline build is needed. Use whenever the user asks to QA, verify, check or sign off a quick win or small improvement — "QA #52106", "is the new populate_end_users param working", "check the help text change", "can you verify this quick win" — even if they don't say "quick win". Do NOT use for bug fixes that need a before/after repro (fleet-bug-qa), for full user stories with a big test plan and device work (fleet-story-qa), or to file a bug (fleet-bug-file).
---

# Fleet quick-win QA — drive mode

Quick wins are small by design: one PR, one surface, usually no device. Claude
can take them end to end — verify the change, check nothing next to it broke,
capture evidence, and hand the QA engineer a verdict to post. The value is speed
with judgment: a quick win shouldn't take longer to QA than it took to build, and
it shouldn't grow a 20-row matrix.

There's no "before" to prove. The feature is either there and right on the RC or
it isn't, so don't build baseline binaries or worktrees. The one historical check
that pays off is cheap: **has part of this already shipped?** (A quick win that
was half-released in the previous version changes what the ticket and release
notes should say.)

## Tooling

Reuse `${CLAUDE_PLUGIN_ROOT}/skills/fleet-bug-qa/scripts/`: `fleetapi.sh <ctx> <METHOD> <path>
[json | -F k=v]` (`FLEET_TOKEN=` for another user), `screenshot.mjs <ctx> <path>
<out.png> [--clip sel --click text ...]`, `pw.mjs` (Playwright with cookie login),
`stack.py <out.png> <a.png> <b.png> ...` (combine shots into one image), `cleanup.sh`.
Read `~/.claude/fleet-qa.local.md` first: it names the RC instance (usually context
`default`), the fleetctl binary for the RC (check `fleetctl --version`), the QA
workspace and the role users. If it doesn't exist, create it before anything else,
per `${CLAUDE_PLUGIN_ROOT}/skills/fleet-bug-qa/references/local-setup.md`. Skim
`${CLAUDE_PLUGIN_ROOT}/skills/fleet-bug-qa/references/fleet-gotchas.md` and
`${CLAUDE_PLUGIN_ROOT}/skills/fleet-story-qa/references/instance-traps.md` before creating test
data.

Work in `<QA workspace>/qa-<N>/` with `RESULTS.md`, `created.txt`
(cleanup manifest), `screenshots/`, `issue-comment.md`.

Hard lines, same as every QA skill here: don't flip global settings (MDM, license,
GitOps mode, org settings) — ask; don't type passwords or create/delete human
accounts (API-only users are fine); don't post on GitHub unless asked; scratch code
never stays in the repo. Put test data on objects you create (osquery-perf hosts, a
`qa-<N>` fleet) — never edit a real host's mapping, labels or fleet, even
temporarily; those are the engineer's devices. Some GET endpoints create state
(e.g. token-minting config endpoints) — read the handler before calling one you
don't know.

## Evidence: run the real code path — simulated or real — or ask

Driving alone is the default, not a rule against asking. A row passes only when
Fleet's own code for it ran on the RC from the entry point a user would hit:

1. **Simulate the whole path** when that covers the row — it's the fastest route,
   so it comes first: osquery-perf hosts enrolling through the real endpoints
   (desktop, iPhone/iPad over MDM, Android), API-only users for API role checks, a
   real API call against a simulated host to put it in a state (a real Recovery
   Lock or wipe command leaves it "pending"). The test: would any production code on
   this row's path behave differently if the host, user or state were real? If not,
   the simulation is the real thing. Look for the most realistic route before
   settling for less (no osquery-perf template for a platform? the agent's real
   enroll request, `POST /api/v1/osquery/enroll`, still runs Fleet's enrollment; a
   hand-inserted host row doesn't). Where the real thing already exists (a device in
   the right state, a setting already on, a real user of the role), use it
   read-only.
2. **Ask** the QA engineer for what a simulation can't reach and you mustn't do:
   license, MDM or org-setting changes, a real UI session as a role, a device
   action, a third-party console. Batch it with the matrix outline, with the exact
   step and what you'll check after. Don't decide for them that it's too much
   trouble — that's their call.
3. **A workaround only with their go-ahead** — they say the real setup can't be
   done, or that a workaround is good enough for this row. Propose the specific one
   (an intercepted response, a hand-inserted DB row) and what it skips; once they
   agree, record it in RESULTS.md as what it is. It goes in the comment only if
   they want it there, labeled with how it was checked — never as a bare ✅.

Rewriting Fleet's responses in the browser (`page.route` to fake the license, a
role, a setting or a host state) and answering a row from the code are not
coverage — they show what the frontend or the source *would* do, not what Fleet
does. And don't end with "worth confirming on a real device": if it would change
your confidence, ask for it during the run.

## Workflow

### 1. Understand the change (5 minutes, not 50)

- Issue body + comments, the linked PR(s) and their full diff
  (`gh pr list --search <N> --state all`). Docs PRs count — a new API parameter
  should match its REST API reference entry.
- **Is it in the build?** `GET /api/v1/fleet/version` → revision;
  `git merge-base --is-ancestor <merge-sha> <revision>` (or `git branch -r --contains`
  for cherry-picks on the RC branch).
- **Did any of it already ship?** `git tag --contains <merge-sha> | grep fleet-v` —
  if a released tag contains it, note which part and which version.
- Entry points that reach the changed code: every route and prefix, fleetctl
  commands that wrap it, GitOps if it's a config field, UI surfaces that render it.
  Take names (params, fields, strings) from the code, not the ticket prose.

### 2. Plan a small matrix

Three row types, few rows each — every row should be able to catch something the
others can't:

- **Core** — the change as the issue describes it, on each entry point, plus the
  one or two edge inputs that matter for this kind of change (empty/absent,
  invalid value, false vs true, a host/fleet with no data, both platforms if the
  field is per-platform).
- **Regression** — what the change could plausibly break: default behavior when
  the new option isn't used, response size/shape for existing callers, the other
  screen that uses the same component or string.
- **Halo** — one or two adjacent workflows a user touches right after (the detail
  view vs the list view, fleetctl output, the doc example actually working).

For copy changes, core = the exact new strings in every place the issue lists
(compare character for character against the issue/PR, including punctuation and
casing), regression = the other places the old string or component still appears.

Share the matrix outline in one short message and proceed without waiting. If
some rows need the user (a device, a setting flip, a real UI login as a role),
batch that ask with the outline and carry on with the rows that don't.

### 3. Run it

Drive everything yourself: API calls on all prefixes, fleetctl, GitOps dry-run,
the in-app browser for UI, `screenshot.mjs`/`pw.mjs` for evidence PNGs. Create
test data freely (fleets, hosts via osquery-perf, API-only users, labels) and
record every object in `created.txt` as you create it.

For performance-sensitive API changes (a list endpoint that now populates more
data), compare response time and size with and without the option on the largest
realistic page — that's the regression a quick win most often ships.

If a surface only appears under a global setting that's off (report storage, a
feature flag, the other license tier) or in a state you can't reach through a
simulation, ask the engineer to switch it (see **Evidence**) and keep going with
the rest of the matrix meanwhile.

Read every PNG before sending — it must show the thing, not a spinner or login
page, and nothing secret (tokens, enroll secrets) since tickets are public.

### 4. Findings

List everything odd in a **decision list** in chat
(`# | finding | origin | severity | repro / file:line`), including cosmetic ones —
the user decides file / mention / drop. Origin is *this change*, *released* (in
the latest release tag), or *pre-existing*. Search open issues before suggesting a
new one. File chosen findings with `fleet-bug-file`.

### 5. Comment

Save to `issue-comment.md` and print it in a four-backtick block:

````markdown
QA **<Pass | Pass with notes | Fail>** — <X>/<Y> checks on `<branch>`. <one sentence of scope>

| # | Type | Case | Result |
|---|---|---|---|
| 1 | Core | <case in user terms> | ✅ <observed, few words> |
| 2 | Regression | <case> | ✅ unchanged |
| 3 | Halo | <case> | ✅ |
````

`X/Y` counts rows actually run live — for real or through a full-path simulation;
a row backed only by a workaround stays in RESULTS.md. Add one line under the table only when a row's
significance isn't obvious (e.g. "Already shipped in 4.92.0; 4.93 only changes the
copy"). No setup, mechanism or test-coverage commentary — that's in RESULTS.md.
Send screenshots with `SendUserFile` (display `attach`), one caption each naming
its row. Shots that are read together — old vs new copy, with vs without the new
parameter, two roles seeing the same page — go out as one image
(`stack.py out.png a.png b.png`, `--side` for narrow clips; crop each to the part
that matters first), since the engineer attaches one image per row.

### 6. Cleanup

List `created.txt` newest-first and ask before `cleanup.sh --run`.
