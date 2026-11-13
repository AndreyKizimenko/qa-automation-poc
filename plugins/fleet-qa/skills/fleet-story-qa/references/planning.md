# Read, map risk, check the plan (steps 1–2)

For fleet-story-qa. Read it at the start of the run, before the first call to the instance.
`tours.md` is fleet-explore's; the SKILL.md that sent you here gives its path.

## 1. Read everything, then map risk

Read the story body and comments, the test plan, and **every** linked PR's diff (backend, frontend,
docs, cherry-picks: `gh pr list -R fleetdm/fleet --search <N> --state all`,
`git log --oneline --grep <N>`). The plan may live in the issue body or in a comment, sometimes split
by person; work from wherever it is. Check what the instance actually runs
(`GET /api/v1/fleet/version` revision, `git merge-base --is-ancestor <sha> <rev>`).

Then write a short risk map in RESULTS.md. This is where most real findings come from. For each
changed code path, ask:

- **Entry points**: which routes, fleetctl commands, GitOps/batch paths, crons, pub/sub or check-in
  handlers reach it? Which API prefixes? Is it in the API-only-user endpoint catalog
  (`server/api_endpoints/api_endpoints.yml`)?
- **Gating**: tier (Premium/Free, backend *and* frontend), role (global vs fleet, each role), which MDM
  platforms must be on, and whether something non-Apple is accidentally gated on Apple MDM
  (`VerifyAppleMDM` middleware, `mdm.enabled_and_configured` in the UI). Frontend route guards for
  new pages.
- **State shape**: read-then-write without locking (concurrent first calls), unique keys, what's
  written before an external call vs after (orphans on failure), primary vs replica reads right after
  a write, cascade/cleanup when the parent (fleet, host, enterprise) is deleted, what's left behind on
  disable.
- **Secrets**: anything stored or returned that shouldn't leak (logs, `generate-gitops`,
  `fleetctl debug archive`, non-admin endpoints).
- **Docs vs code**: the REST API reference (docs branch for the release) vs the actual response shape;
  field names taken from code, never from ticket prose.

`tours.md` § 2 (scope and gating), § 4 (lifecycle) and § 9 (concurrency and timing) turn these
questions into Fleet setups: which scopes and roles to try, what to delete or rename underneath the
feature, how to fire two writes at once.

Name the file:line for each risk. A risk the plan doesn't cover becomes a targeted check in step 3 and
an addition in the step-2 proposal. A risk read from code is a hypothesis: say what you expect
("second call likely fails on the unique key") without asserting the exact status or message until a
live check shows it. Error mapping layers often turn a raw DB error into something else.

## 2. Check the plan is current, and don't re-trim it

**fleet-test-plan** writes and updates the ticket's plan, once from the design and again once the PR
is up. It sizes the plan for this split on purpose: rows you can run are thorough, and rows the
engineer runs are lean and batched. Trimming it again here is how earlier plans lost the entry points
and roles nobody else was going to check. Propose changes **in chat only**, and never edit the ticket
body.

- **Is it current?** It's current when it reflects the merged PRs: the PR pass ran (look for
  `<QA workspace>/test-plan-<N>/changes.md` newer than the last merged PR), or its rows clearly cover
  what the diff added. If the plan predates the PR, is still template TODOs, or was never through a PR
  pass, say so and recommend running fleet-test-plan first. It takes about 15 minutes and saves
  rework. Don't rewrite the plan yourself.
- **Run it as written.** Collapsing is already done. If two rows turn out to be one path, run it once
  and mark both. Don't drop rows from the run.
- **Flag stale or wrong rows** with the evidence: behavior the implementation changed (a check that
  now refuses before the external call, a renamed field, a moved flow), or an input that can't work
  (an enum value the API doesn't accept). Don't silently skip a row or change what it checks.
- **Don't answer rows from code.** Code shows which rows are really one path and where the risk sits;
  it doesn't pass a row. When a row's live check needs something only the engineer can do (Apple MDM
  off to prove a Windows feature has no Apple gate, Free to see the tier gating), it goes in the ask.
  They may decide the row isn't worth it and drop it. That's their decision to make, not yours.
- **Add** a check only for a risk from step 1 that the plan doesn't cover, with its file:line. It runs
  in this pass. Whether it joins the ticket's plan is the user's call, through the next
  fleet-test-plan pass.

Keep the proposal to one screen: which rows you'll take and how (what you'll simulate, with what),
which are the human's and roughly how long their share takes, stale or wrong rows with their
evidence, and additions with their risk. In the same message, ask the two questions that find the
most bugs: what does the engineer think might break, and what did the developer say was tricky (read
the PR conversations first and ask only what they don't answer). An answer can move a risk to the top
of your share.
