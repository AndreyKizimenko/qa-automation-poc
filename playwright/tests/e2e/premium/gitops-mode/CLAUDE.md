# tests/e2e/premium/gitops-mode/ — specs that turn gitops mode on

This file loads when work happens in this folder; everything in `playwright/CLAUDE.md` still applies.
Enabling gitops mode is a global config write that makes every mutating control in the UI read-only, so these
specs run alone.

The `gitops-mode` project runs in **its own invocation after the exclusive specs** — CI's third step
(`if: !cancelled()`, merged into the same report) and `npm run test:premium`'s third invocation — pinned to
`workers: 1` with `fullyParallel: false` and `retries: 0`. Like the exclusive projects it depends only on
`premium-setup`: a dependency on `premium` would skip it whenever one unrelated main-project test is red, and
put the whole suite in front of a local run. Its `gitops-mode-teardown` project turns the flag back off and
puts the exceptions back at `GITOPS_EXCEPTIONS_BASELINE` (`labels: false, software: false, secrets: true`).
`cleanup-setup` calls `disableGitOpsMode` as well, because a teardown project doesn't run on a `SIGKILL` and a
stuck flag disables the *next* run's entire suite. The exceptions matter even with the mode off, because
`fleetctl gitops` reads them: a stuck `secrets: false` makes the next apply delete every enroll secret. Every
premium gitops apply therefore restores them first (`.github/scripts/restore-gitops-exceptions.sh`), since the
gitops chain runs before `cleanup-setup`. A spec never writes `secrets: false` outside the gitops-mode project. Run it with `npm run test:gitops-mode` (login, the specs,
teardown) or `npm run test:gitops-mode:only` (`--no-deps`, for local iteration).

A local run of this project needs the go of anyone else on the instance: while it runs, every control is
read-only for them too.
