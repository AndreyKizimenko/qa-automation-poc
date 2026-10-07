#!/bin/bash
# Watches a "Deploy Loadtest - Infrastructure" run and the migration task it starts:  LT=<lt> lt-watch-deploy.sh <run-id>
# Prints one line per change (Terraform steps, the migration task's status/start/stop/exit), exits when the run ends.
# The migrations add-on scales Fleet to 0, runs `fleet prepare db` as a one-off task, and waits for it with
# `aws ecs wait tasks-stopped`, which gives up after 10 minutes and fails the deploy — so time the migration.
D=$(cd "$(dirname "$0")" && pwd); source "$D/lt-env.sh" || exit 1
RUN=${1:?run id}
prev=""; prevm=""
while true; do
  s=$(gh run view "$RUN" -R fleetdm/fleet --json status,conclusion,jobs 2>/dev/null \
    | jq -r '"run \(.status)/\(.conclusion // "-")", (.jobs[] | .steps[]? | select(.status != "pending" and .status != "queued") | "step \(.name): \(.status)/\(.conclusion // "-")")' 2>/dev/null)
  if [ -n "$s" ]; then
    comm -13 <(echo "$prev" | sort) <(echo "$s" | sort) | grep -E 'run |Terraform (Plan|Apply)|: completed/(failure|cancelled)' | sed "s/^/$(date -u +%H:%M:%SZ) /"
    prev=$s
  fi
  arns=$( { aws ecs list-tasks --region "$R" --cluster "$C" --desired-status STOPPED --query 'taskArns' --output text 2>/dev/null; \
            aws ecs list-tasks --region "$R" --cluster "$C" --desired-status RUNNING --query 'taskArns' --output text 2>/dev/null; } | tr '\t' '\n' | grep -v '^None$' | grep . )
  m=$(echo "$arns" | xargs -n 90 sh -c 'aws ecs describe-tasks --region "$0" --cluster "$1" --tasks "$@" --output json' "$R" "$C" 2>/dev/null \
    | jq -r '.tasks[] | select((.overrides.containerOverrides[0].command // []) | join(" ") | test("prepare")) | "migration task \(.taskArn | split("/")[-1][0:8]): \(.lastStatus) started=\(.startedAt // "-") stopped=\(.stoppedAt // "-") exit=\(.containers[0].exitCode // "-")"' 2>/dev/null | sort -u)
  if [ -n "$m" ] && [ "$m" != "$prevm" ]; then echo "$(date -u +%H:%M:%SZ) $m"; prevm=$m; fi
  echo "$s" | grep -q '^run completed' && exit 0
  sleep 20
done
