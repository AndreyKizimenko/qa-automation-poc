# Step 4b (fallback) — proving the fix with the PR's tests

Use only when a row can't be reproduced live (see SKILL.md 4b).

The question 4b answers: *if the fix's behavior were missing, would these tests
notice?* A test that fails to compile hasn't answered it, and neither has a test
that only covers code the PR added.

## Worktree and environment

```bash
git -C <fleet checkout> worktree add /tmp/qa-<N>-wt <fix-sha>
echo "worktree /tmp/qa-<N>-wt" >> <QA workspace>/qa-<N>/created.txt
cd /tmp/qa-<N>-wt
```

Go tests that need MySQL/Redis look for the docker-compose project by name, and a
worktree's directory name differs from the main checkout's, so point them back at
the running containers:

```bash
export COMPOSE_PROJECT_NAME=fleet COMPOSE_FILE=<fleet checkout>/docker-compose.yml
export FLEET_MYSQL_TEST_PORT=3307          # mysql_test service
docker compose ps mysql_test redis          # start with `docker compose up -d mysql_test redis` if down
```

Use the env vars from the repo CLAUDE.md bundle table (`MYSQL_TEST=1 REDIS_TEST=1`
for service/integration tests).

**Frontend (Jest)** in a worktree needs dependencies and generated files that git
ignores. Symlink rather than reinstall:

```bash
ln -s <fleet checkout>/node_modules node_modules
# generated, gitignored files the tests import (e.g. the osquery SQL parser) — copy them over:
git -C <fleet checkout> status --ignored --short frontend | grep '^!!' | grep -v node_modules
npx jest --config ./frontend/test/jest.config.js <path/to/Component.tests.tsx>
```

jsdom does no layout, so position/caret/size bugs can't be caught by Jest at all —
4b can't stand in for a live repro there — use a real browser instead.

## Simple revert (try first)

```bash
FIX=<fix-sha>
git diff --name-status $FIX^ $FIX | grep -vE '_test\.go|\.tests?\.tsx?|testdata/|/mock/|^.\s+changes/' > /tmp/qa-<N>-files
awk '$1=="A"{print $2}' /tmp/qa-<N>-files | xargs -r git rm -q          # files the PR added
awk '$1!="A"{print $NF}' /tmp/qa-<N>-files | xargs -r git checkout $FIX^ --
```

`git checkout <parent> -- <added-file>` errors and leaves the file in place, which
silently keeps the fix — that's why added files are `git rm`'d. Generated mocks
(`server/mock/`) are excluded because the tests are written against the new ones.

If it compiles: run the PR's tests → expect FAIL; `git checkout $FIX -- . && git
clean -fd` → expect PASS. Done.

## Behavioral revert (when the simple one won't compile)

Common when the PR changed a signature, added a Service/Datastore method, or added
a helper the tests call. Keep everything the tests need to compile and undo only
the *behavior*, one piece at a time:

1. From the diff, list the distinct behaviors the fix introduces (e.g. "auth runs
   before the OS-version lookup", "`host_id` is honored", "counts refresh
   immediately", "route registered under /api/v1").
2. For each: edit the changed function back to its old logic (keeping the new
   signature — ignore the new param, return early, drop the added check), run the
   PR's tests, record which fail, then `git checkout $FIX -- <file>`.
3. Report per behavior in RESULTS.md:

| Reverted behavior | Tests that fail | Tests that still pass |
|---|---|---|
| auth before OS-version check | `TestX`, `TestY/auth_first` | — |
| platform filter in datastore | `TestZ` | `TestY` |

Tests that only exercise newly added code (e.g. a unit test of a new helper) can't
fail without the fix by construction, so they don't count as evidence. If no test
fails for a behavior, 4b can't prove that row — say so in RESULTS.md; it isn't a
finding for the report.
