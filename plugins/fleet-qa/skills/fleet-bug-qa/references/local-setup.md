# Local setup — `~/.claude/fleet-qa.local.md`

The Fleet QA skills (the `fleet-qa` plugin: `fleet-bug-qa`, `fleet-story-qa`, `fleet-quickwin-qa`,
`fleet-bug-retest`, `fleet-bug-file` and `fleet-loadtest-qa`) are shared, and they run in whatever repo you're in. What differs
per engineer goes in one file in your home folder: **`~/.claude/fleet-qa.local.md`**. That covers which
instances are which, where the Fleet checkout and the QA workspace live, how the servers run, and where
Playwright is. It belongs to you, not to any repo, so there's nothing to gitignore.

**Names, paths and URLs only.** Tokens stay in `~/.fleet/config`, where the scripts read them. Never
write a token, password or enroll secret into this file. The dev-default database credentials that
Fleet's own `docker-compose.yml` uses are the one exception.

## On first use

At the start of any of these skills, read the file. If it doesn't exist, build it before anything else:

1. **Find what you can.** Don't ask for what the machine can tell you.
   - The fleetctl contexts and their addresses: context names and `address:` lines from
     `~/.fleet/config`. **Don't print or copy the tokens.** For each context, run
     `${CLAUDE_PLUGIN_ROOT}/skills/fleet-bug-qa/scripts/fleetapi.sh <ctx> GET /api/v1/fleet/version`
     to see what it runs.
   - The Fleet checkout: `git -C ~/repositories/fleet rev-parse --show-toplevel`. Otherwise ask.
   - How the servers run and where they log: `ps -eo pid,command | grep 'fleet serve'`.
   - The database containers: `docker ps --format '{{.Names}} {{.Ports}}' | grep -i mysql`.
   - Playwright for the screenshot scripts: a checkout of the QA suite with its dependencies
     installed, e.g. `~/repositories/qa-automation/playwright/node_modules/playwright`. If there
     isn't one, say so. Screenshots need it (`npm ci` in that `playwright/` folder).
2. **Propose the file** (template below), filled in with what you found. Ask for the rest in one
   message: which instance is the fixed one and which the pre-fix one, the QA workspace folder, role
   users kept for UI-by-role checks, and anything instance-specific.
3. **Write it once they confirm**, and say where it is.

## When it's wrong

The setup changes. An instance gets redeployed at another version, a context is renamed, a container
restarts under another name. When something in the file doesn't match what you see, update the file,
say what changed, and carry on. Treat it as a starting point, not ground truth: the skills still check
versions live (`scripts/env_check.sh`) before relying on them.

## Template

```markdown
# Fleet QA — local setup

<!-- Per engineer, in your home folder (not in any repo). Names, paths and URLs only: tokens stay in ~/.fleet/config. -->

## Instances (fleetctl contexts in ~/.fleet/config)
- **Fixed / RC:** context `default`. <address>, <what it usually runs, e.g. the current RC branch>
- **Pre-fix:** context `previous`. <address>, <usually the previous release>
- **How they run:** <e.g. two `fleet serve` processes started by <tool>, or docker compose>
- **Switching an instance to Free:** <e.g. restart without `--dev_license` (the engineer does it)>

## Paths
- **Fleet checkout:** <path> (export `FLEET_REPO=<path>` for the scripts if it isn't `~/repositories/fleet`)
- **QA workspace:** <path, e.g. <fleet checkout>/qa-stuff>. `qa-<N>/` per run, and `filed-bugs/` for the tracker
- **fleetctl for the RC:** <e.g. `<fleet checkout>/build/fleetctl`; check `fleetctl --version`>
- **Server logs:** <path and line format, per instance>
- **Playwright (screenshots):** <path to a `playwright/` folder with `npm ci` done, e.g. ~/repositories/qa-automation/playwright>
  (export `PW_DIR=<path>` if it isn't that one)

## Databases
- `<context>`: `docker exec <container> mysql -u<user> -p<password> fleet -e "..."` (dev defaults only)

## Role users for UI-by-role
<!-- Real (non-API-only) users with fleetctl contexts. Never delete them, and never log out in the UI
     as them: that deletes the token. -->
- `<context>`: <role> on fleet <name> (id <n>), on <instance>

## Load test (fleet-loadtest-qa)
- **Instance:** `LT=<workspace name, e.g. fleet-493loadtest-3>`, fleetctl context `<loadtest>`, region us-east-2, AWS SSO profile <name>
- **Current shape:** <build/tag, pool size, hosts and platforms, notable data left on it> (update after each redeploy)
- **State folder:** `~/.fleet-loadtest/<LT>/` (saved ALB action for ramp.sh, maintenance/ramp logs)

## Extras
<!-- Anything instance-specific the skills should know: a gateway, a CA name, a device kept for tests. -->
```
