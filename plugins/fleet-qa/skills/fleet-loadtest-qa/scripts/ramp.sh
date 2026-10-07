#!/bin/bash
# Controls how much osquery-perf (device) traffic reaches Fleet, via the internal ALB ($LT-int, :80):
#   LT=<lt> ramp.sh 0        pause: the ALB answers every device request with 503 (admin API untouched)
#   LT=<lt> ramp.sh 10       ~10% of device requests reach Fleet, the rest get 503 (any 1-99)
#   LT=<lt> ramp.sh 100      restore the exact saved forward action
#   LT=<lt> ramp.sh cleanup  delete the empty placeholder target group (only after 100, before teardown)
# The first cut saves the listener's forward action to $LT_STATE/internal-listener-80.default-actions.json so `100`
# puts back exactly what was there. 1-99 is a weighted forward between the real target group and an empty one
# ($LT-int-ramp, no targets), which the ALB answers with 503: it splits requests, not hosts. This is an infra change:
# get the user's go-ahead first (it can be given up front for a recovery).
set -euo pipefail
D=$(cd "$(dirname "$0")" && pwd); source "$D/lt-env.sh"
SAVED="$LT_STATE/internal-listener-80.default-actions.json"
RAMP_NAME=$LT-int-ramp
LB_ARN=$(aws elbv2 describe-load-balancers --region "$R" --names "$LT-int" --query 'LoadBalancers[0].LoadBalancerArn' --output text)
VPC=$(aws elbv2 describe-load-balancers --region "$R" --names "$LT-int" --query 'LoadBalancers[0].VpcId' --output text)
LS=$(aws elbv2 describe-listeners --region "$R" --load-balancer-arn "$LB_ARN" --query 'Listeners[?Port==`80`].ListenerArn | [0]' --output text)
[ -n "$LS" ] && [ "$LS" != None ] || { echo "no :80 listener on $LT-int"; exit 1; }

save_forward() {
  [ -s "$SAVED" ] && return 0
  aws elbv2 describe-listeners --region "$R" --listener-arns "$LS" --query 'Listeners[0].DefaultActions' --output json > "$SAVED"
  if ! jq -e 'length == 1 and .[0].Type == "forward" and (.[0].ForwardConfig.TargetGroups | length) == 1' "$SAVED" >/dev/null; then
    rm -f "$SAVED"; echo "the :80 listener isn't a plain forward right now, so there's nothing safe to save; restore it first"; exit 1
  fi
}
check_saved() { # a redeploy can recreate the target group; never restore a stale ARN
  local tg; tg=$(jq -r '.[0].ForwardConfig.TargetGroups[0].TargetGroupArn' "$SAVED")
  aws elbv2 describe-target-groups --region "$R" --target-group-arns "$tg" >/dev/null 2>&1 \
    || { echo "saved target group $tg no longer exists (redeployed?); point $SAVED at the current one before restoring"; exit 1; }
}
ramp_arn() {
  aws elbv2 describe-target-groups --region "$R" --names "$RAMP_NAME" --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null \
  || aws elbv2 create-target-group --region "$R" --name "$RAMP_NAME" --protocol HTTP --port 80 --vpc-id "$VPC" \
       --target-type ip --health-check-path /healthz --query 'TargetGroups[0].TargetGroupArn' --output text
}

arg=${1:?usage: ramp.sh <0-100|cleanup>}
case "$arg" in
  0)
    save_forward
    aws elbv2 modify-listener --region "$R" --listener-arn "$LS" \
      --default-actions 'Type=fixed-response,FixedResponseConfig={StatusCode=503,ContentType=text/plain,MessageBody=maintenance}' \
      --query 'Listeners[0].DefaultActions[0].Type' --output text ;;
  100)
    [ -s "$SAVED" ] || { echo "no saved forward action in $SAVED; nothing to restore"; exit 1; }
    check_saved
    aws elbv2 modify-listener --region "$R" --listener-arn "$LS" --default-actions "file://$SAVED" --query 'Listeners[0].DefaultActions[0].Type' --output text ;;
  cleanup)
    aws elbv2 delete-target-group --region "$R" --target-group-arn "$(aws elbv2 describe-target-groups --region "$R" --names "$RAMP_NAME" --query 'TargetGroups[0].TargetGroupArn' --output text)"
    echo "deleted $RAMP_NAME" ;;
  *)
    [[ "$arg" =~ ^[0-9]+$ ]] && (( arg >= 1 && arg <= 99 )) || { echo "percent must be 0-100 or cleanup"; exit 1; }
    save_forward; check_saved
    REAL=$(jq -r '.[0].ForwardConfig.TargetGroups[0].TargetGroupArn' "$SAVED"); RAMP=$(ramp_arn)
    aws elbv2 modify-listener --region "$R" --listener-arn "$LS" \
      --default-actions "[{\"Type\":\"forward\",\"ForwardConfig\":{\"TargetGroups\":[{\"TargetGroupArn\":\"$REAL\",\"Weight\":$arg},{\"TargetGroupArn\":\"$RAMP\",\"Weight\":$((100 - arg))}]}}]" \
      --query 'Listeners[0].DefaultActions[0].ForwardConfig.TargetGroups[].Weight' --output text ;;
esac
echo "$(date -u +%H:%M:%SZ) $LT ramp.sh $arg" >> "$LT_STATE/maintenance.log"
