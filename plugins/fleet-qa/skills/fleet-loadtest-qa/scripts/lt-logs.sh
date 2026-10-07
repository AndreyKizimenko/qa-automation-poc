#!/bin/bash
# Run a CloudWatch Logs Insights query on the Fleet log group ($LT) and print rows as "v1 | v2 | …".
#   LT=<lt> lt-logs.sh <start ISO Z|-15m|-2h> <end ISO Z|now> '<insights query>'
# Fleet logs JSON in the loadtest, so fields are queryable directly: level, msg, err, uri, took, host_id, cron, jobID.
# Examples:
#   lt-logs.sh -30m now 'filter level = "error" | stats count(*) as n by coalesce(uri, msg) as where, err | sort n desc | limit 15'
#   lt-logs.sh -30m now 'filter ispresent(uri) | fields if(level="error",1,0) as e | stats count(*) as reqs, sum(e) as errors by bin(1m)'
D=$(cd "$(dirname "$0")" && pwd); source "$D/lt-env.sh" || exit 1
t() { case "$1" in now) date +%s ;; -*m) echo $(( $(date +%s) - ${1//[^0-9]/} * 60 )) ;; -*h) echo $(( $(date +%s) - ${1//[^0-9]/} * 3600 )) ;; *) lt_epoch "$1" ;; esac; }
s=$(t "${1:?start}"); e=$(t "${2:?end}"); q=${3:?query}
id=$(aws logs start-query --region "$R" --log-group-name "${LT_LOG_GROUP:-$LT}" --start-time "$s" --end-time "$e" --query-string "$q" --query queryId --output text) || exit 1
for i in $(seq 1 120); do
  st=$(aws logs get-query-results --region "$R" --query-id "$id" --query status --output text)
  case "$st" in Complete) break ;; Failed|Cancelled|Timeout) echo "query $st" >&2; exit 1 ;; esac; sleep 2
done
aws logs get-query-results --region "$R" --query-id "$id" --output json | jq -r '.results[] | map(select(.field != "@ptr") | .value) | join(" | ")'
