# Filed-bugs tracker

Shared by `fleet-bug-file` (writes entries) and `fleet-bug-retest` (reads and
updates them). Lives in `<QA workspace>/filed-bugs/`; the QA workspace is named in
`.claude/fleet-qa.local.md`.

The point of the tracker is that whoever retests — usually the reporter, weeks
later — can verify the fix in minutes without re-deriving the setup. Write the
retest file for that person, assuming they remember nothing.

## `INDEX.md`

One row per bug, newest first:

```markdown
| Issue | Title | Group | Released? | Discovered | Status | Last checked |
|---|---|---|---|---|---|---|
| #54007 | Policy automation runs: "Reset policy" from a single run resets all hosts | #g-orchestration | released | rc-minor-fleet-v4.93.0 (e700854) | open | 2026-09-24 |
```

Status values: `open` → `fix merged (#PR)` → `verified <branch> (<sha>)` /
`reopened` / `needs full QA` / `closed without fix`.

## `<issue>-<slug>.md` (one per bug)

```markdown
# #<N> <title>

- **Issue:** https://github.com/fleetdm/fleet/issues/<N>
- **Filed:** <date> · **Group:** <label> · **Released?:** <released|unreleased> · **Milestone:** <e.g. 4.93.0, unreleased only; — for released>
- **Discovered:** <version> · **Reproduced:** <version or —>

## Setup
Exactly what must exist before the steps work, with how it was created here —
fleet names, host counts and osquery-perf flags, policies/scripts with their
content, CAs or integrations, users/roles. Point to driver scripts in the
QA workspace if any. No credentials or enroll secrets.

## Repro
The same steps as the issue, plus anything that made it reliable (timing,
ordering, data volume).

## Checks
The concrete observations that prove it's fixed — API calls with the expected
status/body, the UI state to look at, the counts that should change. These are
what `fleet-bug-retest` replays.

## Areas nearby
What a fix here could plausibly break — the candidates for regression/halo when
retesting.

## History
- <date>: filed from <context, e.g. QA of #51053>
```
