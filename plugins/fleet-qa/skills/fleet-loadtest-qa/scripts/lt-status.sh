#!/bin/bash
# One status line per sample:  LT=<lt> lt-status.sh [samples] [interval-seconds]
#   HH:MM:SSZ mem max/avg M/A% | running/pending R/P (desired D) | writer W | healthz CODE/SECONDS
# Memory is the ECS service's MemoryUtilization (latest minute, Maximum = the hottest task, which is what OOMs);
# writer is the Aurora writer's highest 1-second load (AAS) over the last 30 s.
D=$(cd "$(dirname "$0")" && pwd); source "$D/lt-env.sh" || exit 1
RID=$(aws rds describe-db-instances --region "$R" --db-instance-identifier "$WRITER_ID" --query 'DBInstances[0].DbiResourceId' --output text 2>/dev/null)
n=${1:-1}; every=${2:-30}
for i in $(seq 1 "$n"); do
  m=$(aws cloudwatch get-metric-statistics --region "$R" --namespace AWS/ECS --metric-name MemoryUtilization \
      --dimensions Name=ClusterName,Value="$C" Name=ServiceName,Value=fleet --start-time "$(lt_iso_ago 120)" --end-time "$(lt_now)" \
      --period 60 --statistics Maximum Average --output json 2>/dev/null | jq -r '.Datapoints | sort_by(.Timestamp) | last // {} | "\(.Maximum // -1 | round)/\(.Average // -1 | round)"')
  s=$(aws ecs describe-services --region "$R" --cluster "$C" --services fleet --query 'services[0].[runningCount,pendingCount,desiredCount]' --output text 2>/dev/null)
  set -- $s
  w=$(aws pi get-resource-metrics --region "$R" --service-type RDS --identifier "$RID" --start-time "$(lt_iso_ago 30)" --end-time "$(lt_now)" \
      --period-in-seconds 1 --metric-queries '[{"Metric":"db.load.avg"}]' --output json 2>/dev/null \
      | jq -r '[.MetricList[0].DataPoints[] | select(.Value != null) | .Value] | if length == 0 then "-" else (max|round|tostring) end')
  hz=$(curl -sk -m 15 -o /dev/null -w '%{http_code}/%{time_total}' "$LT_URL/healthz")
  echo "$(date -u +%H:%M:%SZ) mem max/avg ${m:--1/-1}% | running/pending ${1:-?}/${2:-?} (desired ${3:-?}) | writer ${w:--} | healthz $hz"
  [ "$i" -lt "$n" ] && sleep "$every"
done
exit 0
