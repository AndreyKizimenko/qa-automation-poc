#!/bin/bash
# Why Fleet tasks stopped:  LT=<lt> lt-stops.sh
# ECS keeps stopped tasks for only about an hour, so run this soon after a crash. Groups stops by exit code and reason:
#   exit 137 + "Essential container in task exited" = OOM kill;  "Task failed ELB health checks" = health-check kill.
# Then stops per minute (UTC), which shows when the cascade started.
D=$(cd "$(dirname "$0")" && pwd); source "$D/lt-env.sh" || exit 1
arns=$(aws ecs list-tasks --region "$R" --cluster "$C" --service-name fleet --desired-status STOPPED --query 'taskArns' --output text | tr '\t' '\n' | grep -v '^None$' | grep .)
[ -n "$arns" ] || { echo "no stopped tasks retained"; exit 0; }
tmp=$(mktemp)
echo "$arns" | xargs -n 90 sh -c 'r=$0; c=$1; shift; aws ecs describe-tasks --region "$r" --cluster "$c" --tasks "$@" --output json' "$R" "$C" \
  | jq -r '.tasks[] | select(.stoppedAt != null) | "\(.stoppedAt)\t\(.containers[0].exitCode // "-")\t\(.stoppedReason // "-" | .[0:60])"' > "$tmp"
echo "stopped tasks retained: $(wc -l < "$tmp" | tr -d ' ')"
cut -f2,3 "$tmp" | sort | uniq -c | sort -rn
echo "per minute (stoppedAt as ECS reports it, with its UTC offset):"
cut -f1 "$tmp" | cut -c1-16 | sort | uniq -c | awk '{printf "%s=%s ", substr($2,12,5), $1} END {print ""}'
rm -f "$tmp"
