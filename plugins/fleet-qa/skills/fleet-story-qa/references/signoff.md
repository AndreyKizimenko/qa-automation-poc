# The sign-off comment

For fleet-story-qa step 5. Read it before writing the sign-off, even if you remember it.

The test plan is what the team agreed to check, so the sign-off reports against its rows: the same
checkboxes, ticked, in the same order. Don't summarize them into a new table. `plan_comment.py`
(in this skill's `scripts/`) builds the comment from the plan's own text:

```bash
gh issue view <N> -R fleetdm/fleet --json body --jq .body > body.md
python3 plan_comment.py --list body.md                       # numbered rows, Setup excluded
python3 plan_comment.py body.md results.json issue-comment.md
```

When the plan lives in a comment instead of the issue body (some teams split it there by person),
feed that comment's text to the script:
`gh api repos/fleetdm/fleet/issues/comments/<comment id> --jq .body > body.md`.

`results.json` has the verdict line, one `[status, note]` per row in `--list` order, and the issues
table (the script's docstring shows the shape). Statuses:

- `pass`: `[x]`. Add a note only when the reader needs it: the device showed other wording, the row
  ran on a stand-in fleet or role, `--dry-run` only, or the row's open question no longer applies.
- `fail`: `[ ]` with **❌ #issue**, including known bugs the row names.
- `wait`: `[ ]` with **⏳ <what>**, for a row blocked on something unmerged (a docs PR).
- `skip`: `[ ]` with **Not run:** and the reason, for a row the engineer dropped or one that can't
  work as written (the stale rows from step 2).

The script keeps every row's text and sub-bullets, so the comment reads like the plan the reader
already knows. It adds `QA **<Pass | Pass with notes | Fail>** on \`<branch>\` (<sha>), <devices or
one line of scope>` on top and **Issues found** (issue, origin, severity) at the bottom. For stories
QA'd together, write one comment per ticket, each from its own plan (`issue-comment-<N>.md`). Save
the comment to `issue-comment.md` inside a four-backtick fence, and print the same block in chat.

What a tick means:

- Tick human-run rows the same as yours (it's a team sign-off), but only rows someone actually ran. If
  the engineer ticked boxes you didn't see, ask before claiming them.
- A ✅ means the row ran live, for real or through a full-path simulation. There's no "simulated" or
  "verified in code" result.
- A row backed only by a workaround the engineer approved stays `[ ]` unless they want it ticked, and
  then the note says how it was checked.
- Notes are results, not method: no setup, mechanism, "not covered" list or test-coverage commentary.

The verdict is about the story. A finding the engineer dropped doesn't turn a Pass into Pass with
notes, and a residual that takes something a customer is unlikely to do doesn't fail a row: say it in
one line and let them overrule you.

Ticking the boxes in the ticket itself is separate from the comment. Do it only once the engineer
has said to keep them updated, and only for rows actually exercised. The smaller observations
(pre-existing quirks they didn't choose to file) go in RESULTS.md, with one line in chat.

Print the comment again, complete, after every change to the outcome: a row rerun, a finding
decided, a check the engineer ran by hand.
