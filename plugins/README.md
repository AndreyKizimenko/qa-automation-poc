# Claude Code plugins

This repo is a Claude Code plugin marketplace named `qa-automation`
([`.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json)). It has one plugin,
[`fleet-qa`](fleet-qa/), Fleet QA's skills. The root [README](../README.md#claude-code-skills) lists
what each skill does and what the plugin needs on your machine (an authenticated `gh`, a Fleet
checkout, `npm ci` in `playwright/`, Pillow).

Pick one of three ways to get it:

| You want | Do |
|---|---|
| The skills as merged to `main` | [Install from GitHub](#install-from-github) |
| To edit the skills, or to install from the clone you already have | [Install from your clone](#install-from-your-clone) |
| To try a branch's skills before they merge | [Load a branch for one session](#load-a-branch-for-one-session) |

## Install from GitHub

```bash
claude plugin marketplace add AndreyKizimenko/qa-automation-poc
claude plugin install fleet-qa@qa-automation --scope user
```

Restart Claude Code. To update:

```bash
claude plugin marketplace update qa-automation && claude plugin update fleet-qa@qa-automation
```

Restart again to load the new version. Or turn on auto-update for the marketplace under `/plugin` →
Marketplaces.

## Install from your clone

Point the marketplace at the repo root (where `.claude-plugin/` is), not at `plugins/`:

```bash
claude plugin marketplace add ~/repositories/qa-automation    # your clone's path
claude plugin install fleet-qa@qa-automation --scope user
```

Restart Claude Code. The marketplace has the same name, `qa-automation`, from either source, so
you can only have one of the two. To switch, run `claude plugin marketplace remove qa-automation`,
add the other source and install again.

**Installing copies the plugin; it doesn't link to it.** Claude Code runs a copy of the commit
that was checked out at install or update time, kept under
`~/.claude/plugins/cache/qa-automation/fleet-qa/<version>/`. Editing a skill in your clone changes
nothing until you update, and two things follow:

- **Update from `main`.** If a feature branch is checked out when you update, its unmerged skills
  become the ones you use every day:

  ```bash
  git -C ~/repositories/qa-automation switch main && git -C ~/repositories/qa-automation pull
  claude plugin marketplace update qa-automation && claude plugin update fleet-qa@qa-automation
  ```

  Then restart.
- **Copies are kept per `version`.** A change that doesn't bump `version` in
  [`fleet-qa/.claude-plugin/plugin.json`](fleet-qa/.claude-plugin/plugin.json) doesn't reach
  anyone's install, so every PR that touches the plugin bumps it (see
  [Changing a plugin](#changing-a-plugin)).

`claude plugin list` shows the version you're running.

## Load a branch for one session

Use this to try a branch, a PR or a worktree without installing it:

```bash
claude --plugin-dir ~/repositories/qa-automation/plugins/fleet-qa
```

Here the path is the plugin folder itself. The session loads the plugin from disk as
`fleet-qa@inline`, and `claude plugin list` run with the same flag shows it under "Session-only
plugins". Start a new session to pick up edits.

Your installed copy loads too, so you'd have every skill twice. Disable the installed copy while
you test, and enable it again afterwards:

```bash
claude plugin disable fleet-qa@qa-automation
claude --plugin-dir ~/repositories/qa-automation/plugins/fleet-qa
# ...when you're done:
claude plugin enable fleet-qa@qa-automation
```

## Changing a plugin

- **Bump `version`** in the plugin's `.claude-plugin/plugin.json` in the same PR: a patch for
  skill-text fixes (1.3.1 → 1.3.2), a minor for a new skill or capability (1.2.1 → 1.3.0). Say it in
  the commit title, e.g. `fleet-qa 1.3.2: …`.
- **Lint and validate** from the repo root before you push:

  ```bash
  bash .github/scripts/check-skills.sh
  claude plugin validate plugins/fleet-qa
  claude plugin validate .
  ```

  CI runs the first on every PR that touches the skills (`skills-check.yml`). It checks the
  frontmatter, that each description survives YAML and stays short, that every `${CLAUDE_…}` path
  exists, orphaned `references/` and `scripts/` files, that the manifests agree, and that no
  instance hostnames or tokens appear: this repo is public. It warns when a SKILL.md outgrows what
  Claude Code keeps after compaction (below).
- **Run the evals** when you changed a `description:`, moved text between a SKILL.md and a
  reference, or touched a shared block: `cd plugins/fleet-qa && claude plugin eval . --ablation none
  --no-publish --runs 1` (about $3; [`fleet-qa/evals/README.md`](fleet-qa/evals/README.md)).
- **Try it** with `--plugin-dir` (above) before opening the PR.
- **After it merges**, everyone gets it with the update command.

A new plugin goes in `plugins/<name>/` with its own `.claude-plugin/plugin.json`, plus an entry in
the marketplace's `plugins` list with `"source": "./plugins/<name>"` and the same `name`.

## How the skills are laid out, and why

Three things about how Claude Code loads a skill shape every SKILL.md here. Each was measured in
real sessions, and the lint enforces the first two.

- **Only the first ~19,800 characters of a skill survive a long session.** When a conversation is
  compacted, Claude Code re-attaches each loaded skill cut to about that size. Of 19 real QA
  sessions measured, 7 compacted after the skill had loaded, and Claude re-read the skill file in
  one of them. So a SKILL.md stays under 19,000 characters as rendered, with the rules that hold for
  the whole run (Hard lines, Evidence, Working with the engineer) in its first half.
- **A required read at a step gets read; "also skim this" mostly doesn't.** The local file, the
  tracker format and the load-test references were read in every session that needed them; a
  reference offered as background was read in as few as one session in eight. So detail lives in
  `references/` and each SKILL.md names the step at which a file must be read: the first steps'
  detail (`planning.md`, `framing.md`) at the start, and the formats (`report.md`, `signoff.md`,
  `findings.md`, `screenshots.md`, `plan-format.md`) at the step that produces the output, where
  they're fresh.
- **`${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_SKILL_DIR}` work only in SKILL.md.** They're substituted
  when the skill loads, not in a file Claude reads later, and they aren't in the shell's environment.
  A reference names a file and says whose it is; the SKILL.md gives the path.

**Shared blocks.** A few rules have to be in front of Claude for the whole run in several skills, so
they're inline in each instead of in a reference: the text between `<!-- shared:NAME -->` and
`<!-- /shared:NAME -->` (`hard-lines`, `evidence`, `working-with`). The copies must be identical, and
the lint fails when they aren't. To change one, edit it in `fleet-bug-qa/SKILL.md` and paste it over
the others.

**Descriptions** go in double quotes. Unquoted, YAML cuts the value at the first ` #`, so a trigger
example like `'QA #51234'` silently drops everything after it.
