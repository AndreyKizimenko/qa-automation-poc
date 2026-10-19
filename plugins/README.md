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
  frontmatter, orphaned `references/` and `scripts/` files, that the manifests agree, and that no
  instance hostnames or tokens appear: this repo is public.
- **Try it** with `--plugin-dir` (above) before opening the PR.
- **After it merges**, everyone gets it with the update command.

A new plugin goes in `plugins/<name>/` with its own `.claude-plugin/plugin.json`, plus an entry in
the marketplace's `plugins` list with `"source": "./plugins/<name>"` and the same `name`.
