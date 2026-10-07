# The Fleet load test as an environment

What a Fleet load test is, and every way it differs from a customer's production. Read it before planning: half of the
load-test "bugs" that don't survive review are environment artifacts, and some real bugs hide behind them.

## How it's built
- Deployed by the **"Deploy Loadtest - Infrastructure"** workflow (`.github/workflows/loadtest-infra.yml`), run from
  `main` (only `main` has the newest inputs). Inputs: `terraform_workspace`, `tag` (Fleet image, usually the RC
  branch), task count / CPU / memory, Aurora size / count, Redis size / count / engine, **`fleet_mysql_max_open_conns`**
  (since #54680; default `10`), MDM mock count, `terraform_action`. To copy a previous run's inputs, read its log:
  `gh run view <id> -R fleetdm/fleet --log | grep -E 'TF_VAR_[a-z_]+:' | sort -u`.
- Everything is named after the workspace (`LT`): ECS cluster and service `fleet` (also `osquery_perf`,
  `fleet-vuln-processing`), Aurora cluster, Redis group, CloudWatch log group, the device ALB `$LT-int`, public URL
  `https://$LT.loadtest.fleetdm.com`. Region us-east-2. Access is AWS SSO, which expires after several hours — when
  `aws` calls start failing, ask the user to run `aws sso login`; overnight runs lose AWS visibility when it lapses.
- A redeploy (any input change, including the image tag) rolls all Fleet tasks; with migrations, the **migrations
  add-on** scales Fleet to 0, runs `fleet prepare db` as a one-off task, and waits with `aws ecs wait tasks-stopped`,
  which gives up after **10 minutes** and fails the deploy. Time any migration that touches big tables (the
  `query_results` id widening took 9m32s on 20M rows, ~30 s per 1M rows — 4 s inside the cap).
- Upgrading is the user's action (a workflow run). There is usually one load test, so "pre-fix" and "fixed" are the
  same instance before and after an upgrade — capture the whole baseline before asking for the upgrade.

## Sizing vs the reference architecture
`docs/Deploy/Reference-Architectures.md` (on `main`) is what customers are told to run. For 100k hosts: 25 Fargate
tasks, 1024 CPU, 4 GB, **`FLEET_MYSQL_MAX_OPEN_CONNS=20`**, Aurora db.r6g.2xlarge ×3, Redis cache.r6g.large ×3.
The load test usually runs larger CPU (2048) and DB (4xlarge) but historically a **smaller pool (10)**. A 10-connection
pool makes the load test fall over sooner and differently from production: requests queue on the pool, `/healthz`
(which uses the shared writer pool) times out, ECS kills tasks for failed health checks, survivors OOM. #49733 was
closed "not seen in prod" for exactly that reason. The load-test ALB checks `/healthz` every 15 s with a
10 s timeout and marks a task unhealthy after 5 failures (~75 s); `/healthz` runs `SELECT @@read_only` on the shared
writer pool with no timeout, so when requests queue for connections the health check queues with them. Run scale investigations at the reference pool (20), and note the
pool in every run's notes; switch to 10 only for a strict comparison with older baselines. Fleet's binary default is 50.

## Other differences from production
- **DB parameter group:** `sort_buffer_size` is 8 MiB (RDS default 256 KiB). It hid an "Out of sort memory" bug
  (#54957) that only shows with rows bigger than the sort buffer. Check `aws rds describe-db-parameters` for the
  cluster/instance groups when a bug might depend on a server variable, and reproduce locally on stock MySQL if so.
- **MDM off** (`enable_apple_mdm` false unless the APNs mock is deployed): no Apple/Windows MDM, so VPP / App Store app
  automations, profiles, commands and setup experience can't be exercised there.
- **Async host processing off** (`FLEET_OSQUERY_ENABLE_ASYNC_HOST_PROCESSING=false`, not a workflow input) — async
  paths need a local run or a custom deploy.
- **Result and status logs go to `/dev/null`** (filesystem plugin): automations "send" results nowhere; a real
  destination (Firehose, etc.) is untested.
- **Server write timeout = live-query rest period + 10 s = 100 s** by default (`cmd/fleet/serve.go`). A request whose
  handler runs longer can't send its response: the client gets a **502 while the server finishes the work**. Always
  read the server-side `took` in the Fleet log before calling something failed. `fleetctl` has no client timeout of its
  own any more (the old 45 s response-header timeout is gone).

## osquery-perf, the simulated fleet
- ~100k hosts in one fleet (e.g. 60k macOS / 20k Windows / 20k Linux). **Never restart or rescale osquery-perf**: it
  has no `--seed`, so a restart enrolls another 100k hosts and the old ones linger as offline duplicates.
- Policies: a query of exactly `SELECT 1` passes and `SELECT 0` fails on every host (`runPolicy` in
  `cmd/osquery-perf/agent.go`); any other query re-rolls pass/fail with `policy_pass_prob` (0.5) on every report, so
  every run rewrites `policy_membership` for every host — far more churn than a real fleet. Use `SELECT 1`/`SELECT 0`
  when you need stable results (a known failing population for automations), random queries for worst-case churn.
- Reports: a newly added report runs on **every host at the same moment** (no splay on first run), then on its interval.
  Real fleets spread out; treat the first-run burst as a worst case, not the steady state.
- fleetd refreshes the osquery config every 60 s (`--config_refresh=60`), and osquery-perf does too: config generation
  runs ~100k times a minute and scales with the number of scheduled reports.
- Hosts buffer results that failed to submit (up to ~1M per host) and replay them, and after an outage every host is
  due a full detail and software refresh. Bringing traffic back after a long outage is its own load spike (the
  **reconnect wave**): ramp it, and give it ~30 min to settle before measuring anything.
- Scripts run by osquery-perf succeed or fail at random; software installs "succeed". Simulated hosts don't run real
  osquery SQL — results are canned.
- API throughput from one laptop is limited: refetching 25k hosts ran 14–40 hosts/s depending on the network, while
  each refetch took < 1 s on the server. Check server-side timing before blaming Fleet for a slow driver.

## Instance hygiene
- The fleetctl context (usually `loadtest`) is repointed at whichever load test is current. Old cleanup manifests from
  an earlier instance must **not** be replayed against it — the same IDs belong to different objects now.
- Data you add stays for the next person (reports, policies, scripts). Keep a `created.txt` manifest in the QA folder
  and clean up in small batches (see recovery.md for why big deletes are dangerous here).
