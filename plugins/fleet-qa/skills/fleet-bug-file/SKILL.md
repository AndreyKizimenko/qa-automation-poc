---
name: fleet-bug-file
description: File a Fleet bug on GitHub from a finding — verify it reproduces, pin the discovered/reproduced builds, decide released vs unreleased and the product group, write the issue from Fleet's bug-report template with QA's field rules, create it with gh, hand back the screenshots to attach, and record setup + retest checks in the local filed-bugs tracker. Use whenever the user wants to open, file, write up or "bug" an issue they found — "let's bug that", "file this", "open an issue for the reset dialog", "write up the caret thing as a bug", or picking "file it" from a QA decision list — even if they don't say "bug report". Do NOT use to QA an existing fix (fleet-bug-qa), to retest bugs already filed (fleet-bug-retest), for security vulnerabilities that belong in fleetdm/security (ask first), or for feature requests and stories.
---

# File a Fleet bug

Invoking this skill means the user has already decided the finding is worth an
issue — don't re-litigate that. Your job is to make the issue accurate, short and
useful to the developer who picks it up, create it, and leave a retest trail so
the reporter can verify the fix later without rediscovering anything.

The instances and the QA workspace (where the tracker lives) come from
`~/.claude/fleet-qa.local.md`. If it doesn't exist, create it first, per
`${CLAUDE_PLUGIN_ROOT}/skills/fleet-bug-qa/references/local-setup.md`.

## 1. Pin the facts

Work from what's already established in the conversation (a QA run's RESULTS.md,
the user's screenshots, a repro they just did). Before writing, make sure you know:

- **What's wrong, concretely** — the observed behavior and why it's wrong
  (contradicts its own UI copy, the docs, another path that does it right).
- **It reproduces** on at least one named build. If the only evidence is old or
  second-hand, reproduce it once now — an issue that doesn't reproduce wastes the
  developer's first hour. Use the `fleet-bug-qa` scripts for this
  (`${CLAUDE_PLUGIN_ROOT}/skills/fleet-bug-qa/scripts/`: `fleetapi.sh`, `screenshot.mjs`).
- **The mechanism, if you actually found it** — file:line of the code responsible.
  Only what you confirmed; see "More info" below.

**Security?** If the finding lets someone cross a trust boundary (read or change
data they shouldn't, bypass auth), it must not go in the public `fleetdm/fleet`
repo. Stop and ask the user whether it goes to `fleetdm/security`.

**Duplicate check.** Search before filing:
`gh issue list -R fleetdm/fleet --state all --search "<2-3 key terms> in:title,body" --limit 20`.
If an open issue already covers it, tell the user and offer a comment on that
issue instead. Mention open stories that touch the same surface too (e.g. a
copy rewrite of the same dialog) — the developer should know they overlap. If a *closed* one does, it may be a regression — say so and link it
in More info.

## 2. Versions

`scripts/fleet_version.sh <ctx>...` prints each instance's build in the right
format: `rc-minor-fleet-v4.93.0 (e700854)` for branch/RC builds (the short SHA pins
the exact build, since RC branches move daily), `fleet-v4.92.0` for released ones.

**Discovered** and **Reproduced** are both builds where the bug was seen; which is
which depends on the story:
- Found on an older build, then confirmed still present on the latest →
  Discovered is the older one, Reproduced the newer.
- Found on the latest RC, then checked on the earlier build to see whether it
  shipped → Discovered is the RC, Reproduced the older one.
- Certain it's new in unreleased work (e.g. part of the feature being tested) →
  Discovered only; delete the Reproduced line.

## 3. Released or unreleased

- **`~released bug`** — it's in a published release. Evidence: it reproduces on a
  released build, or the responsible code is in the latest release tag
  (`git merge-base --is-ancestor <introducing-commit> fleet-v<latest>`, or
  `git show fleet-v<latest>:<file> | grep <the code>`).
- **`~unreleased bug`** — only on the RC/main, introduced after the latest release.
  Name the introducing PR in More info if you found it; it tells the team which
  release to block. It also gets a **milestone**: the release that would ship it.
  If the responsible code is on an RC branch, that's the RC's version
  (`rc-minor-fleet-v4.93.0` → `4.93.0`, `rc-patch-fleet-v4.92.2` → `4.92.2`); if
  it's only on `main`, the next minor. Confirm the milestone exists:
  `gh api 'repos/fleetdm/fleet/milestones?state=open&per_page=100' --jq '.[].title'`.
  If it doesn't, ask rather than create it.

Check rather than assume — a bug found while testing new work is often older than
the work. Say in one line what the decision rests on.

## 4. Product group

Read `references/product-groups.md`. Pick by where the broken behavior lives, state
the choice with a one-line reason, and ask if two groups fit equally.

## 5. Write the issue

Title: `<Area>: <what's wrong>` in plain words, under ~100 characters — e.g.
`Policy automation runs: "Reset policy" from a single run resets all hosts`.

Body — Fleet's bug-report template (`.github/ISSUE_TEMPLATE/bug-report.md`), with
these rules per field:

- **Web browser and operating system** — the browser and OS actually used, for UI
  bugs. For API/server-only bugs write `N/A (API)`.
- **💥 Actual behavior** — what happens and what makes it wrong, in 1–3 sentences.
  Lead with the user-visible effect. Screenshots go here (the user pastes them).
- **🛠️ Expected behavior** — fill it only when it's obvious: the UI's own copy says
  otherwise, another entry point does it right, the docs specify it, or every
  comparable product behaves one way. If it's a product decision (what *should* the
  empty state say, should Escape close the modal), leave the template's `TODO` so
  product decides — a guessed expectation gets implemented as if it were a spec.
- **🧑‍💻 Steps to reproduce** — only steps that lead specifically to the bug,
  including non-obvious setup it depends on (a failing policy with a script
  automation on 2+ hosts; 50 hosts for a pagination bug; a specific CA). Leave out
  the obvious — spinning up Fleet, opening a browser, logging in. Tick the "confirmed
  in multiple Fleet instances" box only if it reproduced on two instances; otherwise
  the other one.
- **🕯️ More info** — yours. The root cause with file:line if you confirmed it; the
  introducing PR for unreleased bugs; a related/previous issue; a workaround. Keep
  it to a few lines. No speculation — if you don't know why it breaks, write `N/A`
  rather than a guess; a wrong theory sends the developer the wrong way.

Keep the whole body short. The developer needs to see the problem, reproduce it,
and know where to look — not read an investigation log.

## 6. Screenshots

For UI bugs, give the user the images that belong under Actual behavior: the wrong
state, and the contradicting evidence when there is one (e.g. the confirmation that
names one host + the other host's reset result). Use the user's own screenshots if
they shared them; otherwise capture with
`node ${CLAUDE_PLUGIN_ROOT}/skills/fleet-bug-qa/scripts/screenshot.mjs <ctx> <path> <out.png> --clip <sel>`.
Read each one before sending: it must show the problem, and — this repo is public —
no enroll secrets, tokens or real user data. Save them in the tracker entry's folder
(`<QA workspace>/filed-bugs/<N>-<slug>/`). When more than one image goes under the same
section, combine them into one in reading order —
`python3 ${CLAUDE_PLUGIN_ROOT}/skills/fleet-bug-qa/scripts/stack.py <N>-actual-behavior.png a.png b.png ...`
(`--side` for narrow clips) — so the section takes a single paste; crop each to the
region that shows the problem first (fleet name, filter, count) so the stack stays
legible and carries no unrelated data. Send with `SendUserFile` (display `attach`)
after the issue exists, and name where each goes and what order the panels are in.
`gh` can't upload images, so pasting them is the one manual step.

## 7. Create it

```bash
gh issue create -R fleetdm/fleet --title "<title>" --body-file <body.md> \
  --label bug --label "<#g-group>" --label "<~released bug|~unreleased bug>" \
  [--milestone "<release, unreleased bugs only>"]
```

No `:product` label — QA-filed bugs skip that intake stage. Unreleased bugs always
get the milestone from step 3, so they land on the release they'd ship in.
Released bugs get no milestone (product decides when to fix them), and nobody gets
an assignee, unless the user asks.

## 8. Record it for retesting

Add the bug to the tracker per `references/tracker.md`: a row at the top of
`<QA workspace>/filed-bugs/INDEX.md`, and `<QA workspace>/filed-bugs/<N>-<slug>.md` with the
setup, repro, the concrete checks that will prove the fix, and nearby areas a fix
could break. Write it for someone retesting in a month who remembers nothing — this
is what lets `fleet-bug-retest` verify the fix in minutes.

## 9. Report back

In chat:
- the issue link, title, labels and milestone (unreleased bugs), and the one-line
  reasons for the group and released/unreleased choice;
- the body as filed, in a four-backtick fenced block (so it can be edited and
  re-pasted if the user wants changes);
- the screenshots, each with where it goes.

If the user asks for changes after filing, edit the issue with
`gh issue edit <N> --body-file ...` / `--title` / `--add-label` / `--milestone` rather than filing
a new one, and update the tracker entry to match.
