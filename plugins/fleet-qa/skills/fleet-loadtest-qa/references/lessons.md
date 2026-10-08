# Lessons from earlier load-test campaigns

Each of these cost hours once. Skim before planning; reread the relevant part when something looks odd.

## Judging what you see
- **Check the configuration before the code.** A collapse at pool 10 may be the pool (#49733 was dismissed as a
  load-test artifact). The 500-report OOM (#54969) only became credible once it reproduced at the reference pool of 20,
  and the rerun also showed which half was an artifact (500 stored reports survived at 20, the automations case didn't).
  Likewise the 8 MiB `sort_buffer_size` hid #54957 completely.
- **Server time vs client time.** A 502 at 100–150 s with the server's `took` showing success means the write timeout
  cut the response; the work happened. Report both numbers.
- **A fix can expose the next bottleneck.** #54897 stopped the writer saturating, and the 500-report case then failed
  on config generation and stats ingestion instead. Classify that as *exposed by the fix*, file it separately, and don't
  fail the fix for it.
- **"Unchanged" doesn't mean "no work".** Unchanged GitOps applies ran a cleanup for every policy (#54832) and
  not-in-list cleanups for every package (#54838). When an idempotent apply is slow, look for work that runs regardless
  of a diff.
- **Attribute before you blame.** A 30-min `cleanups_then_aggregation` run looked like the new policies' cleanup; the
  per-job timing (`lt-cron.sh`) showed the policy job took 16 s and `query_aggregated_stats` took 29 min, and the slow
  runs had started hours before the policies existed (the real cause became #55016). Check onset times against what
  you changed.
- **Verify extrapolations before filing.** "Two platform changes will pass the 100 s timeout" (2 × 60 s) was wrong —
  two took 94 s; three took 151 s and 502'd. Run the case; file the measured number.
- **If the mechanism didn't reproduce, say so.** The #54832 deadlock never fired pre-fix in 9 applies; the GitOps
  failure (slow apply → 502) did every time. The verdict rested on the symptom, and the comment said that plainly.
- **Know what fires an automation before you plan around it.** Policy automations (scripts, installs, App Store apps,
  webhook) fire when a host first fails or goes from passing to failing. Setting or changing a policy's script,
  installer, App Store app or profile-resend clears all its results (and editing its query does too), so every failing
  host fires again on its next report — a mass trigger. Clearing the automation doesn't. Check the code
  (`server/service/team_policies.go`, `ApplyPolicySpecs`) rather than assuming.
- **Control for osquery-perf churn before filing.** 500 random pass/fail policies collapsed the writer and got tasks
  replaced; the same 500 as `SELECT 1` (stable results) cost a 5-minute writer spike and nothing else. Random-flip
  policies make every host rewrite every result on every run, which real fleets don't do. Rerun a policy-driven finding
  with stable queries before calling it a Fleet problem.
- **Synchronized cohorts.** At 100k hosts, anything that aligns host timers (a GitOps re-apply, a mass refetch, an
  outage) turns an hourly 1,700 requests/min into bursts several times that. Look at per-minute rates, not averages. After a traffic cut and ramp-up every host reconnects together, so their
  hourly policy runs stay aligned afterwards: expect a synchronized wave each hour until they drift apart.
- **Run a no-load control before blaming the environment.** A collapse right at the hourly wave after a recovery looked
  like the wave itself; the same recovery with no test data absorbed its wave, and the writer's per-minute breakdown
  showed script-automation enqueues waiting on one row lock (#54925). A control step costs an hour and settles it.
- **Compare the same request locally before blaming load.** A live query took 34–82 s to start on the load test and
  0.4 s on a local server seeded with 100k hosts — through the API. Through fleetctl it was 46 s locally too: the
  client was sending an empty host identifier (#55116). Use the user's client in the local comparison.
- **Policy automation timing.** A new policy's automation fires on each host's next policy run, so on a ramped-up
  fleet it lands in the hourly wave, all at once — a calm first 30 minutes says nothing.

## Running things
- Long runs go in the background with a completion notification; never block on them in the foreground. Poll a log
  file with a bounded loop, not `pgrep -f <pattern>` — the waiter's own command line matches the pattern and it waits
  forever (that lost 15 minutes once).
- `ps`/`pgrep -fl` show full command lines: curl's `Authorization: Bearer …`, enroll secrets. Use `ps -o pid,etime,comm`
  and never echo tokens into chat, notes or issues.
- **Check where every helper points before using it.** Instances are rebuilt under new names (…-2, …-3) and env files
  don't follow: a set of older drivers sourced a Playwright `.env.loadtest` that still targeted the previous load test.
  Read the URL a script will hit (or make it take `LT` explicitly) before any step that writes.
- The AWS SSO session lasts about 8 hours. When it lapses, ECS/CloudWatch/PI go dark while the Fleet API keeps
  working — the memory and task trip wires go blind and `ramp.sh` (recovery) stops working. Check
  `aws sts get-caller-identity` before every risky step, start long unattended runs right after a fresh login, and
  don't push the instance toward a crash you couldn't recover from (lt-step.sh reverts when its readings go blank).
- macOS shell traps: zsh treats `$var:x` as a modifier (write `${var}:x`); bash 3.2 has no associative arrays; huge
  JSON bodies overflow argv (`jq --rawfile` + `curl --data-binary @file`); inline `bash -c` blobs trip safety checks —
  write a script file.
- Deletes are load: policy deletes cascade membership, report deletes leave stats behind under load, bulk report
  deletes deadlock with stats ingestion (422; retry), and a 100k-member label delete takes 30 s–3 min under traffic
  while hosts' label writes fail (#55106) — 100 labels took ~2 h, paced. Batch small, pause between, check the
  instance is calm, and budget cleanup time (with the AWS session) before creating data you'll have to delete.
- Keep every step's output: write drivers' per-run files to a step-named folder. A 10-campaign run once overwrote the
  5-campaign run's error logs before they were read.
- fleetctl live queries in drivers: `fleetctl report --labels X` without `--hosts` also targets every host with an empty
  serial (#55116), so starts take minutes here. Use the API (`POST /api/latest/fleet/reports/run_by_identifiers` with
  only `selected.labels`) unless that bug is what you're testing. fleetctl's results socket is always `wss` — a local
  server needs TLS (the repo's `tools/osquery/fleet.crt`/`fleet.key`).

## Local before/after when the load test can't show it
When the load test can't reproduce a bug (masked by config, needs MDM, needs async, or the timing is impossible):
- Worktrees at both SHAs (`git worktree add --detach <dir> <sha>`), API-only builds
  `CGO_ENABLED=1 go build -tags fts5,netgo -o fleet-<x> ./cmd/fleet` (no frontend needed).
- Stock dependencies in Docker on spare ports: `mysql:8.0.44` (same flags as Fleet's docker-compose:
  `--enforce-gtid-consistency=ON --log-bin=bin.log --server-id=1 --max_allowed_packet=536870912`) and `redis:6.2`.
- `fleet prepare db --no-prompt` + `fleet serve --server_tls=false --dev_license` (the dev license works without
  `--dev`); options like `--osquery_enable_async_host_processing policy_membership=true` and short intervals
  (`--osquery_policy_update_interval 10s`) make paths reachable in seconds.
- Simulated hosts through the real endpoints: `POST /api/osquery/enroll`, `/api/osquery/config`,
  `/api/osquery/distributed/read` + `/distributed/write` (policy results), `/api/osquery/log` (report results).
- Same DB for both builds when no migrations differ; otherwise drop/recreate between runs. Tear down containers,
  worktrees and binaries afterwards and say so.

**Lock chains** need no Fleet server: load the build's schema into a throwaway MySQL
(`(echo 'SET FOREIGN_KEY_CHECKS=0;'; git show <sha>:server/datastore/mysql/schema.sql) | mysql …`), then run Fleet's
own statements from the code in two or three sessions (one holds its transaction open with `SELECT SLEEP(n)`), timing
each and printing `performance_schema.data_lock_waits` joined to `data_locks` while they wait. Include a control case
without the suspected session. It turns "row_lock_wait on INSERT X" into a named chain a developer can check.
