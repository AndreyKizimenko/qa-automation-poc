# Recovering a crash-looping load test

## Recognize it
All or most Fleet tasks stopping and restarting, `running` far below desired, max memory at 90–100 %, healthz and the
admin API returning 502/504, `lt-stops.sh` full of exit 137 (OOM) and "failed ELB health checks". It does **not**
recover on its own while the load that caused it is still scheduled: 100k hosts keep reconnecting into every new task,
replaying buffered results. (One night's loop ran 5.5 h until someone intervened.)

## Get the go-ahead
Cutting device traffic changes the ALB listener — an infra change on a shared environment. Ask the user before doing it,
or get it up front for a planned risky test ("if it crashes, can I cut traffic, delete the reports and ramp back?").
Don't scale ECS services, restart osquery-perf, or redeploy as part of a recovery.

## Steps
1. **Capture evidence first** (it expires): `lt-stops.sh`, a Logs Insights per-minute errors query over the onset,
   `lt-db.sh` for the window, and the Container Insights per-task memory. Note the times.
2. **Cut device traffic:** `LT=<lt> scripts/ramp.sh 0`. The admin API keeps working. Expect all tasks healthy within
   ~4 min (ECS throttles launches after a crash loop, so 0 running / a few pending for a few minutes is normal).
   Wait for running = desired and healthz 200 before touching data.
3. **Remove the cause** through the admin API, in **small batches** with retries. First stop any of your own drivers
   or watchers still running (they may re-apply the load), and find out how the load was added — if it came from
   GitOps, the next apply puts it back unless the YAML changes too:
   - Reports: ≤ 10 IDs per `POST /api/latest/fleet/reports/delete`. Deleting a report deletes its per-host stats in a
     background, unbatched statement; under load it can fail with a lock timeout and leave the stats behind forever
     (#55016), and big batches 422 from deadlocks with stats ingestion. With traffic cut, deletes are clean.
   - Policies: one per `POST /api/latest/fleet/fleets/<id>/policies/delete`, paced on healthz. Deleting a policy
     cascades its `policy_membership` rows (~100k each) in one statement (#54215). While hosts are still writing
     results for those policies, a 5-policy delete took ~4 min and deadlocked with hosts' `host_issues` recompute;
     one at a time between waves took 3–5 s. If you can't cut traffic, wait out the wave, then delete.
   - Labels: one per `DELETE /api/latest/fleet/labels/id/<id>`, paced on healthz < 3 s. A label with ~100k members
     takes 30 s–3 min under traffic and stalls hosts' label writes while it runs (#55106); with traffic cut it's fast.
   - Settings you changed (webhooks, automations): turn them off first — it's cheaper than deleting.
4. **Ramp traffic back:** `LT=<lt> scripts/ramp-up.sh 10 25 50 100` (holds each level 8 min, steps back at 70 %
   memory or lost tasks, retries twice). ~35–45 min total. The reconnect wave (detail/software refresh, buffered-log
   replay) shows as memory 20–45 % and writer 150–200 AAS at 50–100 %; it settles ~30 min after 100 %.
5. **Confirm and record:** `lt-status.sh 5 60` calm, `lt-stops.sh` shows no new stops, the cause is gone (count the
   objects). Note the recovery timeline in the QA notes. `ramp.sh cleanup` removes the placeholder target group — only
   needed before teardown; it's harmless to keep and gets reused.

## Before a risky step, not after
- Write the revert command before applying (lt-step.sh takes it and runs it on a trip).
- Know the cut-traffic path works for this instance: `LT_STATE` must hold the saved forward action, or `ramp.sh 0` will
  save it on first use (only when the listener is a plain forward).
- Set the trip wire below the cliff (60 % memory, not 85 %): memory can jump 40 points between one-minute samples.
