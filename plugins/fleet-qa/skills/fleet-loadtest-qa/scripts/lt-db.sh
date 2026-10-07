#!/bin/bash
# Database picture for a window, every Aurora instance in the cluster (writer + readers):
#   LT=<lt> lt-db.sh <start ISO Z> <end ISO Z> [top-n]
# Per instance: 1-s load (AAS) peak/avg, top SQL by load, top wait events; for the writer also deadlocks per minute
# (CloudWatch reports Deadlocks as a per-second average, so ×60 per minute — a single deadlock reads 0.017).
D=$(cd "$(dirname "$0")" && pwd); source "$D/lt-env.sh" || exit 1
S=${1:?start}; E=${2:?end}; N=${3:-6}
for inst in $(aws rds describe-db-clusters --region "$R" --db-cluster-identifier "$LT" --query 'DBClusters[0].DBClusterMembers[].DBInstanceIdentifier' --output text); do
  role=reader; [ "$inst" = "$WRITER_ID" ] && role=writer
  rid=$(aws rds describe-db-instances --region "$R" --db-instance-identifier "$inst" --query 'DBInstances[0].DbiResourceId' --output text)
  echo "===== $inst ($role)"
  aws pi get-resource-metrics --region "$R" --service-type RDS --identifier "$rid" --start-time "$S" --end-time "$E" --period-in-seconds 1 \
    --metric-queries '[{"Metric":"db.load.avg"}]' --output json | jq -r '[.MetricList[0].DataPoints[] | select(.Value != null) | .Value] | if length == 0 then "AAS: no data" else "AAS 1s peak \(max|round) avg \((add/length)*10|round/10)" end'
  aws pi describe-dimension-keys --region "$R" --service-type RDS --identifier "$rid" --start-time "$S" --end-time "$E" --period-in-seconds 1 --metric db.load.avg \
    --group-by "{\"Group\":\"db.sql_tokenized\",\"Limit\":$N}" --output json | jq -r '.Keys[] | "  \(.Total|.*10|round/10)\t\(.Dimensions["db.sql_tokenized.statement"] | gsub("\\s+";" ") | .[0:170])"'
  aws pi describe-dimension-keys --region "$R" --service-type RDS --identifier "$rid" --start-time "$S" --end-time "$E" --period-in-seconds 1 --metric db.load.avg \
    --group-by '{"Group":"db.wait_event","Limit":4}' --output json | jq -r '"  waits: " + ([.Keys[] | "\(.Dimensions["db.wait_event.name"]) \(.Total|.*10|round/10)"] | join(", "))'
  if [ "$role" = writer ]; then
    aws cloudwatch get-metric-statistics --region "$R" --namespace AWS/RDS --metric-name Deadlocks --dimensions Name=DBInstanceIdentifier,Value="$inst" \
      --start-time "$S" --end-time "$E" --period 60 --statistics Average --output json \
      | jq -r '"  deadlocks/min: " + ([.Datapoints | sort_by(.Timestamp)[] | select(.Average > 0) | "\(.Timestamp[11:16])Z=\(.Average*60|round)"] | if length == 0 then "none" else join(" ") end)'
  fi
  aws cloudwatch get-metric-statistics --region "$R" --namespace AWS/RDS --metric-name DatabaseConnections --dimensions Name=DBInstanceIdentifier,Value="$inst" \
    --start-time "$S" --end-time "$E" --period 300 --statistics Maximum --output json | jq -r '"  connections max: \([.Datapoints[].Maximum] | max // "-")"'
done
