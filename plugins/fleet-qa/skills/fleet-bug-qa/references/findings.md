# Findings: from something odd to the decision list

Shared by fleet-bug-qa, fleet-story-qa, fleet-quickwin-qa, fleet-explore, fleet-bug-retest and
fleet-loadtest-qa. Each skill says how it classifies a finding's origin; everything else about a
finding is here. Read it when the first odd thing turns up, and again before you write the list.

The engineer decides what's a bug and what's worth anyone's time. Your job is to make that decision
cost them one line per finding: what it is, who would hit it, and what you'd do about it.

## Before it goes on the list

1. **Reproduce it.** The same steps, three times; for anything timing-related, count ("3 of 10").
   Rerun it on the other instance when there is one: timing and leftover state make convincing
   one-offs. What won't come back is a note in RESULTS.md (what was tried), not a finding.
2. **Vary one thing at a time**: another role, All fleets instead of the fleet, the API instead of the
   UI, ordinary data instead of the edge value, the sibling control next to it. Each variation that
   still fails narrows the cause; each that passes names a condition of the repro. A finding whose
   condition you can't state isn't ready.
3. **Name what it's wrong against** (`tours.md` § 7 lists the oracles): the docs, the story, the
   page's own copy, a sibling that does it right, the pre-fix instance. "Looks odd" can't be filed.
   When nothing settles it, it's a question for product, not a finding.
4. **Say who hits it, and how.** The trigger path in a customer's hands: which role, doing what, with
   what data, how often. Say so plainly when it needs something unusual (two admins acting in the same
   second, a value nobody would enter, a thousand hosts enrolling at once), and when it exists only
   because of the simulation (osquery-perf's random answers, canned rows and burst timing: `tours.md`
   § Not findings). If a simulated host produced it, try it against real data before it goes on the
   list, or say that you couldn't. This is the first thing the engineer asks about every finding, so
   answer it before they do.
5. **Search before calling it new**: the open issues
   (`gh issue list -R fleetdm/fleet --state open --search "<terms>"`), the engineer's own filed bugs
   (`grep -i "<terms>" "<QA workspace>/filed-bugs/INDEX.md"`) and the ticket's thread. An existing
   issue goes on the list with its number and "add to #N" as the recommendation, never as a new
   finding.
6. **Capture it ticket-grade now**, the way `screenshots.md` (beside this file) says: cleanup removes
   the data, and nobody can re-shoot it when the engineer says "file it" tomorrow.

These aren't findings: behaviour that exists only on an older release and is fixed on the build under
test (nobody patches it); what a Premium instance leaves behind when it drops to Free (known, and
customers don't downgrade); the simulation's own quirks; the known behaviours in `tours.md` § Not
findings.

Something odd you pass on the way to something else still gets a line: an error repeating in the
logs, a cron that hasn't finished in hours, a count that doesn't add up. Twice the engineer has
picked one of those out of a report's aside and it became a filed bug. If you saw it, explain it or
list it.

## The decision list

It goes in chat and in RESULTS.md, never in the ticket comment. One table, what matters most to a
customer first:

```markdown
**Decisions needed**
| # | Finding | Origin · severity | Who hits it | Repro / location | Recommend |
|---|---|---|---|---|---|
| A | <what's wrong, one plain sentence a PM could read> | <origin> · <sev> | <role, action, how often; "simulation only" or "needs X" when that's the truth> | <minimal repro; file:line> | <file / mention / drop / add to #N>: <why, a few words> |
```

- **Recommend** is your call, with the reason in a few words ("file: silent data loss", "drop: needs
  two admins in the same second"). The engineer answers by letter, so a list they agree with costs
  them one word. Don't go timid: wrong data shown, an action that doesn't land or a gate that doesn't
  hold is "file", however small the surface. Don't go picky either: when the bug under QA is an edge
  case few customers reach, low and pre-existing side findings are "drop", and saying so is the help.
- Everything that survived the six checks is on the list, cosmetic ones included; pre-filtering is the
  engineer's call. What changes with importance is the space a finding takes: the ones you recommend
  dropping go last, one line each.
- State the consequence, not the mechanism. "A weekly report can show results up to six days old on
  some hosts" is a finding. The scheduler detail that explains it goes in RESULTS.md.
- The answers aren't only file, mention or drop. An existing issue can take the new evidence in its
  body or a comment; a typo or a docs gap can be a small PR; a finding can need another hour of
  digging before anyone can decide. Offer whichever fits.

Two short lists follow it when the run produced them:

- **Questions for product**: behaviour the issue, the docs and the sibling pages don't settle as right
  or wrong. One copiable line each.
- **Risks**: nothing broke, but it's one realistic step away (a field with no length limit anywhere).
  Each is mention, drop, or a row for the next test plan in the area.

If there are no findings, say so and skip the table.

## After the engineer answers

- **File**: `fleet-bug-file`, loaded once for the whole batch, with this run's folder as its
  evidence. It records the setup so the fix can be retested later.
- **Mention**: add it to the ticket comment as a short **Issues found** table
  (`# | Issue | Origin | Severity`), and link the ones that got filed.
- **Add to #N**: draft the comment or the body edit for that issue as a copiable block.
- **Drop**: it stays in RESULTS.md and nowhere else.

Then print the ticket comment again, complete, without being asked.
