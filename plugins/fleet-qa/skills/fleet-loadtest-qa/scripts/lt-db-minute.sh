#!/bin/bash
# Writer load per minute, split by the top statements (or wait events), to see which one climbed first:
#   LT=<lt> lt-db-minute.sh <start ISO Z> <end ISO Z> [top-n] [db.sql_tokenized|db.wait_event]
# Prints the keys, then one row per minute: total | k1 k2 ... in average active sessions. Times are UTC.
D=$(cd "$(dirname "$0")" && pwd); source "$D/lt-env.sh" || exit 1
S=${1:?start}; E=${2:?end}; N=${3:-6}; G=${4:-db.sql_tokenized}
rid=$(aws rds describe-db-instances --region "$R" --db-instance-identifier "$WRITER_ID" --query 'DBInstances[0].DbiResourceId' --output text)
TZ=UTC aws pi get-resource-metrics --region "$R" --service-type RDS --identifier "$rid" --start-time "$S" --end-time "$E" --period-in-seconds 60 \
  --metric-queries "[{\"Metric\":\"db.load.avg\"},{\"Metric\":\"db.load.avg\",\"GroupBy\":{\"Group\":\"$G\",\"Limit\":$N}}]" --output json \
  | jq -r '.MetricList as $m | [$m[1:][] | select((.Key.Dimensions // {}) | length > 0)] as $g | ($m[0].DataPoints | map(.Timestamp | sub("\\.[0-9]+";"") | sub("(Z|[+-][0-9:]+)$";"Z") | fromdateiso8601 | strftime("%H:%MZ"))) as $ts
    | "keys:", ($g | to_entries[] | "  k\(.key+1) " + (.value.Key.Dimensions | (.["db.sql_tokenized.statement"] // .["db.wait_event.name"] // "?") | gsub("\\s+";" ") | .[0:110])), "",
      (range(0; $ts|length) as $i | "\($ts[$i]) \($m[0].DataPoints[$i].Value // 0 | round) | " + ([$g[] | (.DataPoints[$i].Value // 0 | round | tostring)] | join(" ")))'
