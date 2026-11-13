# fleet-qa evals

Checks that the plugin's skills still do what they're for after someone edits them. `claude plugin
eval` runs each case in a throwaway session that has this plugin and nothing else: no user settings,
no other plugins, no MCP servers, and no Bash. A case can load skills (and, for the `behavior` ones,
read the plugin's own files), so a skill that fires can't touch an instance.

```bash
cd plugins/fleet-qa
claude plugin eval . --ablation none --no-publish --runs 1            # the whole suite, about $3
claude plugin eval . --ablation none --no-publish --tag routing       # one group
claude plugin eval . --ablation none --no-publish --case 'handoff-*'  # by name
```

`--ablation none` matters: the default also runs every case without the plugin, and a "the skill
loaded" check can never pass there. `--no-publish` keeps the report on disk
(`evals/results/<timestamp>/report.html`, gitignored). Runs default to three per case; one is enough
for a quick pass, and a case that fails once in three is worth a look, not a rewrite.

## What's here

| Tag | Cases | What a case checks | Graders |
|---|---|---|---|
| `routing` | `routes-*` (20) | A request worded the way engineers word them loads the right skill, and not its near miss (a quick win is not `fleet-bug-qa`'s; "which of my bugs are fixed" is `fleet-bug-retest`'s). Two cases ask for something that is nobody's and must load nothing. | `tool_used` on the Skill call: deterministic |
| `handoff` | `handoff-*` (2) | The engineer types `/fleet-qa:fleet-bug-qa` for a quick win or a story. The skill says so in a line and loads the right one instead of carrying on or stopping to ask. | `tool_used` |
| `behavior` | `behavior-*` (3) | The parts that sit in reference files and used to fall off the end of a long session: the ticket comment's shape and the decision list beside it, cleanup that lists and asks first, and a waived repro that isn't asked for again. | `regex` where the output has a fixed shape, an LLM judge where it doesn't |

The routing cases stop after the first turn (`max_turns: 1`), so the skill is chosen but its body is
never paid for: about six cents a run. The CLI reports "Reached maximum number of turns" for those
runs; that's expected, and the graders still score them.

## When to run it

- After changing a `description:`. That line is all Claude sees when it chooses a skill.
- After moving text between a SKILL.md and a reference file, or changing a shared block.
- Before bumping the plugin's version.

## Adding a case

A folder with `prompt.md` (a small settings block, then the request exactly as someone would type it)
and one file per check in `graders/`. Copy a neighbour. Write the prompt from a real ask, with a real
issue number shape and the detail a person would include; keep instance hostnames, tokens and
anything from a private report out of it, because this repo is public. Prefer a `tool_used` or
`regex` grader to an LLM judge: the judge reads only part of the trace and has failed runs that were
plainly right.
