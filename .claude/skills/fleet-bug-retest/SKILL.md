---
name: fleet-bug-retest
description: Go through the bugs in the user's filed-bugs tracker (filed-bugs/INDEX.md in their QA workspace — the bugs they filed with fleet-bug-file), find which ones now have a fix merged into a build running on their instances, and re-verify those — replaying the recorded checks on the pre-fix and fixed instances with light regression/halo coverage and screenshots, or flagging a broader fix for a full fleet-bug-qa pass — then update the tracker. Use whenever the user asks what happened to their bugs, which of their bugs are fixed, to retest/re-verify/"check on" bugs they reported, to sweep for fixes ready to verify after a new RC or branch switch, or to follow up on a specific bug they filed. Do NOT use to file a new bug (fleet-bug-file), to QA someone else's bug or a fix with no tracker context from scratch (fleet-bug-qa), or for QA TODO threads.
---

# Retest filed bugs

The reporter is the cheapest person to verify a fix: they already know the setup,
the data and what "wrong" looked like, and the tracker entry written at filing time
holds all of it. This skill turns that into a quick loop — find what's fixed, replay
the checks, confirm nothing nearby broke, and hand back evidence.

It leans on two sibling skills rather than repeating them:
- **`fleet-bug-file`** — the tracker format: `.claude/skills/fleet-bug-file/references/tracker.md`.
- **`fleet-bug-qa`** — the before/after method, scripts, ticket-comment format,
  decision list and cleanup rules: `.claude/skills/fleet-bug-qa/SKILL.md`. Read
  its steps 3–9 before retesting; everything there applies here, at a smaller scale.

## 1. Sync the tracker

`<QA workspace>/filed-bugs/INDEX.md` is the scope: only bugs listed there get
triaged and retested. The QA workspace, the Fleet checkout and the instances come
from `.claude/fleet-qa.local.md`. If it doesn't exist, create it first, per
`.claude/skills/fleet-bug-qa/references/local-setup.md`. Those are the ones filed with `fleet-bug-file`, so
they come with the setup and checks that make a quick retest possible — a bug
without a tracker entry has none of that, and sweeping in everything the user ever
authored buries the few bugs that matter under years of already-closed ones.

- Entries still marked pending (no issue number): find them with
  `gh issue list -R fleetdm/fleet --author @me --search "<exact title> in:title" --state all`
  and fill in the number.
- Entries in another repo (e.g. `security#<N>`): the script only reads `#N` rows, so
  check those by hand — `gh issue view <N> -R fleetdm/<repo> --json state,closedByPullRequestsReferences`
  — and include them in the triage table.
- Bugs outside the index only when the user asks for them ("all my bugs", "anything
  untracked"): then add `--mine` in step 2, and for any that are Ready, create a
  minimal tracker entry from the issue body first, marking its Setup as
  "reconstructed from the issue".

## 2. Triage

```bash
scripts/bug_status.py [--ctx previous --ctx default] [<issue> ...]
```

It finds the tracker at `$QA_WORKSPACE/filed-bugs/INDEX.md` and the Fleet checkout at
`$FLEET_REPO`, defaulting to `~/repositories/fleet/qa-stuff` and `~/repositories/fleet`.
Export them from the local file if yours differ.

One JSON line per bug: issue state, board status (e.g. `Awaiting QA`), fix PRs
with merge commits, and whether each instance contains each fix. Sort every bug
into one bucket:

| Bucket | Meaning | Action |
|---|---|---|
| **Ready** | Fix merged and present on one instance, absent on the other | Retest (step 3) |
| **Waiting for a build** | Fix merged, but no running instance has it | Say which branch/RC contains it (`git branch -r --contains <sha>`); suggest moving an instance there |
| **Not fixed** | No merged fix | Nothing to do; note board status if it moved |
| **No pre-fix baseline** | Fix present on both instances (a cherry-pick reached the older branch, or the bug only ever existed on the newer one) | Verify on the fixed instance; for the before state use the PR's tests or an older build (`fleet-bug-qa` 4b), and say so |
| **Closed without a fix** | Closed as not planned/duplicate, or closed with no linked PR | Flag for the user — it may deserve a comment |

An `in` value of `"cherry-pick <sha>"` means that build has a commit citing the fix
PR or carrying its exact title — usually a cherry-pick. Title matches can be
coincidental, so `git show <sha>` to confirm it's the same change before relying on it.

Any scope call made during triage is preliminary — step 3 makes the real one after
reading the diff, and the two should agree; if they don't, say which changed and why.

Show the triage table to the user. If only a few bugs are Ready, proceed with them.
If there are many (a first sweep over older bugs can surface a dozen), ask which to
retest — suggest starting with those whose board status is **Awaiting QA**, since
that's where a verification is actually blocking someone, then the most recently
fixed.

## 3. Scope each Ready fix

Read the fix PR(s) — description, diff, and the issue thread since filing. Decide:

- **Narrow** — the fix changes what was reported and little else, and nothing new
  came up in the thread. → Quick retest (step 4). Most bugs are this.
- **Broad** — the fix is larger than the bug (a refactor, a shared component,
  several PRs), the thread found related problems that got folded in, or the
  behavior changed in ways the tracker's checks don't describe. The recorded checks
  would miss most of what could break. → Tell the user and recommend a full
  `fleet-bug-qa` pass, seeded with the tracker entry; run it if they agree.

When unsure, lean broad and say why — a quick retest that passes on a broad fix is
false confidence.

## 4. Quick retest

1. **Setup** from the tracker entry, on both instances, recording every created
   object in `<QA workspace>/filed-bugs/<N>-<slug>/created.txt` (the `fleet-bug-qa`
   cleanup manifest format). If the entry's setup no longer applies (renamed
   endpoint, moved UI), adapt and note it in History.
2. **Checks on the pre-fix instance first** — they must still fail. If they don't,
   the checks drifted or something else changed; stop and figure out which before
   trusting a pass.
3. **Checks on the fixed instance** — they should pass.
4. **Regression and halo**, scaled to the fix: take the tracker's "Areas nearby"
   and anything else the diff touches. A one-line fix might need two regression
   rows; a fix in a shared path needs more. Same rules as `fleet-bug-qa` step 3.
5. **Screenshots** for UI bugs — prefix/fixed pairs via `fleet-bug-qa`'s
   `screenshot.mjs`, read before sending, sent with `SendUserFile`. They're for the
   user to trust what was done, and to post on the issue if useful.

## 5. Report

Per retested bug, the `fleet-bug-qa` step 8 ticket comment (verdict, X/Y, one-line
scope, matrix — four-backtick block) and, separately, its decision list for
anything new that turned up. Then:

- update the tracker: status (`verified <branch> (<sha>)`, `reopened`,
  `needs full QA`), last-checked date, and a History line;
- list the setup left behind and ask before cleaning up (`fleet-bug-qa` step 9);
- don't close issues, move board cards or post comments yourself — hand the user
  the comment and let them do it (or do it if they ask).

End with a short summary across all bugs: verified, failed, waiting for a build,
needs full QA.
