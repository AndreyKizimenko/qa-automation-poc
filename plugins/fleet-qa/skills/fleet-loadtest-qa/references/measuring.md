# Measuring a load test

The question is always "where does the time / memory / lock go, and how does it scale with hosts?". Record the same
set for every step so before/after and step-to-step comparisons are like for like.

## Per step, record
| What | How | Why it matters |
|---|---|---|
| Fleet memory **max** (and avg) | `lt-status.sh` (ECS MemoryUtilization; Maximum = hottest task) | Tasks OOM one at a time; the average hides the task that dies first. |
| Per-task memory in MiB | Container Insights: `lt-logs`-style query on `/aws/ecs/containerinsights/$LT/performance`: `filter Type = "Task" and ServiceName = "fleet" \| stats max(MemoryUtilized), count_distinct(TaskId) by bin(1m)` | Shows the climb toward the 4,096 MiB limit and task churn (more distinct tasks per minute = replacements). |
| Tasks running / pending, and **why they stop** | `lt-status.sh`; `lt-stops.sh` within the hour | Exit 137 = OOM; "failed ELB health checks" = pool/healthz cascade. ECS keeps stopped tasks ~1 h and service events rotate after 100, so grab them early. |
| Writer and reader load | `lt-db.sh <start> <end>`: 1-s AAS peak/avg, top SQL, waits, deadlocks/min, connections | Writer-bound vs reader-bound vs neither (then it's Fleet itself). Connections ≈ tasks × pool when pools are full. |
| healthz and one admin call | `lt-status.sh`; time a representative admin request | User-visible symptom; healthz is the first thing to go when the pool is exhausted. |
| Request rate, latency, errors per minute | `lt-logs.sh` (below) | Shows onset, cohorts (synchronized bursts) and which endpoints fail first. |
| Cron jobs | `lt-cron.sh <schedule> -3h now` | Per-job durations; a long schedule run is usually one job. |
| Heap / goroutines | `lt-step.sh` grabs them at 20/40 % memory; or `fleetctl debug heap|goroutine --context <ctx>` | What the memory is and what requests are waiting on. Each capture is from one task behind the LB — take several. |

## Proving a task was killed by its health check, not by memory
Right after the event (ECS keeps stopped tasks ~1 h): `lt-stops.sh` gives each stop's reason, then Container Insights
gives each stopped task's memory — `lt-logs.sh` with `LT_LOG_GROUP=/aws/ecs/containerinsights/$LT/performance` and
`filter Type = "Task" and TaskId in [<ids>] | stats max(MemoryUtilized) as max_mib by TaskId`. "Task failed ELB health
checks" with peak memory well under the 4,096 MiB limit means the health check — not memory — took the task down
(goroutine dumps then show `HealthCheck` queued in `database/sql.(*DB).conn`). OOM kills (exit 137) that follow are
usually replacement tasks starting into an already overloaded fleet.

## Logs Insights recipes (`lt-logs.sh <start> <end> '<query>'`)
Fleet logs JSON on the load test; useful fields: `level`, `msg`, `err`, `uri`, `took` (string like `1.4ms` / `30.0s`),
`host_id`, `cron`/`schedule`, `jobID`.
- Errors by where: `filter level = "error" | stats count(*) as n by coalesce(uri, msg) as where, err | sort n desc | limit 15`
- Per-minute traffic and errors: `filter ispresent(uri) | fields if(level="error",1,0) as e, if(err like /context canceled/,1,0) as cc | stats count(*) as reqs, sum(e) as errors, sum(cc) as canceled by bin(1m) | sort @timestamp asc`
- Slow requests on one endpoint (≥ 10 s): `filter uri = "/api/osquery/config" | fields if(took like /^\d\d+\.\d+s$/,1,0) as slow | stats count(*) as n, sum(slow) as ge10s by bin(1m)`
- Server-side duration of an admin call: `filter @message like /spec\/policies/ | display @timestamp, took, err`
- First occurrence: `filter msg like /deleting query stats/ | stats count(*), min(@timestamp), max(@timestamp) by err`
- Fields with dashes can't be named directly; parse them: `filter err like /error in query ingestion/ | parse @message /"ingestion-err":"(?<ie>[^"]*)"/ | stats count(*), min(@timestamp) by ie` (live queries: `campaignID=N waiting for listener` / `stopped`).
Ignore osquery-perf noise: `extra query executed with errors` (`fleet_detail_query_software_windows_program_files_scan`).
Bin labels come back in UTC; `lt-stops.sh` and ECS events show the AWS account's local offset — say which you quote.

## Reading profiles
```bash
go tool pprof -top -sample_index=inuse_space profiles/<x>-heap.pb.gz | head -25
go tool pprof -traces profiles/<x>-goroutine.pb.gz | awk '/^-----/{getline; print}' | sort | uniq -c | sort -rn | head
```
`fleetctl debug goroutine` hits one random task and can take a minute or two under load, so it rarely catches one
slow admin request in flight — reproduce that locally instead. Group goroutines by the top Fleet frame: thousands parked in `database/sql.(*DB).conn` = pool exhaustion; thousands of
idle `bufio` readers = ALB keep-alive connections piling up (each costs memory). A dump shows who is **queued** for a
connection, which is mostly whatever traffic is heaviest (host detail ingestion) — not who **holds** the connections.
For that, look at the writer the minute the load climbed: `lt-db-minute.sh <start> <end>` — the statement that jumps
first, and its wait event (`… db.wait_event`), is the cause; everything else is queueing behind it. Profiles contain only symbols and a
build ID — safe to attach to public issues (zip them with a README of what each is).

## Things that skew numbers
- **Replica lag** (~25 s under load): API counts right after a write come from a reader. Wait ~30 s.
- Some counts short-circuit: a report with `discard_data` reports 0 results via the API regardless of rows.
- Policy counts on the policies page come from the hourly aggregation cron; use `hosts/count?policy_id=…&policy_response=…`
  for live numbers (it ignores `label_id` — don't combine them).
- CloudWatch `Deadlocks` is per-second average; multiply by 60 for per-minute (one deadlock reads 0.017).
- The memory metric lags 1–2 min. A step can go 36 % → 85 % between samples; set trip wires with margin.
- Two load-changing tests at once confound each other's timing — serialize them.
