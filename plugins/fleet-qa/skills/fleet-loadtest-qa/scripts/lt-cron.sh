#!/bin/bash
# Per-job timing of one Fleet cron schedule in a window, from the schedule's own log lines:
#   LT=<lt> lt-cron.sh <schedule> <start ISO Z|-6h> <end ISO Z|now>      e.g. lt-cron.sh cleanups_then_aggregation -3h now
# Prints each run (pending/trigger → "run finished"), then every job start in order with the gap to the next start.
# Jobs in a schedule run one after another, so that gap is the job's duration (the last job of a run ends at
# "run finished"). Use this before blaming a long cron run on any one job.
D=$(cd "$(dirname "$0")" && pwd)
sched=${1:?schedule}; s=${2:?start}; e=${3:?end}
f="(cron = \"$sched\" or schedule = \"$sched\")"
echo "== runs"
LT=$LT bash "$D/lt-logs.sh" "$s" "$e" "filter $f and (msg = \"pending\" or msg = \"run finished\" or msg like /trigger/) | display @timestamp, msg | sort @timestamp asc | limit 300" \
  | awk -F' [|] ' '{print substr($1,1,19), $2}' | uniq
echo "== job starts (gap to the next start = this job's duration)"
LT=$LT bash "$D/lt-logs.sh" "$s" "$e" "filter $f and msg = \"starting\" and ispresent(jobID) | display @timestamp, jobID | sort @timestamp asc | limit 1000" \
  | awk -F' [|] ' '{ split(substr($1,12,8), a, ":"); t = a[1]*3600 + a[2]*60 + a[3]
                     if (NR > 1) printf "%s  %-45s %6ds\n", pts, pj, t - pt
                     pts = substr($1,1,19); pj = $2; pt = t }
                   END { if (NR) printf "%s  %-45s (last of the run: ends at run finished)\n", pts, pj }'
