"""loglab-guard reaper: deletes loglab's AWS resources so a forgotten test can't keep billing.

Runs inside AWS as the Lambda function loglab-guard-reaper (installed by `loglab aws guard up`):
  - every 15 minutes (EventBridge Scheduler): deletes resources whose expires-at tag has passed
  - when the loglab-guard budget passes its limit (SNS): deletes every loglab resource, expired or not
  - by hand: `loglab aws guard run [--all] [--dry-run]`

It only ever touches resources that carry created-by=loglab AND whose name has loglab's prefix (its IAM policy
is scoped to the same prefixes, so a bug here still can't reach anything else in the account). A loglab resource
with no expires-at tag counts as expired. One guard serves everyone in the account: it reaps every owner's
resources (owner tag, or none for ones made before owners were tagged) by their own expiry.
Each run prints one "reaper: {json}" line to CloudWatch.
"""
import datetime
import json
import os

import boto3
from botocore.exceptions import ClientError

TAG_KEY, TAG_VALUE = "created-by", "loglab"
EXPIRES = "expires-at"
OWNER = "owner"
PREFIX = os.environ.get("NAME_PREFIX", "fleetqa-")
BUCKET_PREFIX = os.environ.get("BUCKET_PREFIX", "fleetqa-loglab-")
ROLE_PATH = os.environ.get("ROLE_PATH", "/loglab/")
GONE = {"ResourceNotFoundException", "NoSuchEntity", "NoSuchBucket", "NotFound"}
# dependents first: functions/delivery streams before the streams, buckets and roles they use
ORDER = ["lambda", "firehose", "kinesis", "logs", "s3", "iam"]


def parse_arn(arn):
    """-> (service, name) for the resource types loglab creates, or (service, None)."""
    p = arn.split(":", 5)
    svc, rest = p[2], p[5]
    if svc == "kinesis" and rest.startswith("stream/"):
        return svc, rest[len("stream/"):]
    if svc == "firehose" and rest.startswith("deliverystream/"):
        return svc, rest[len("deliverystream/"):]
    if svc == "lambda" and rest.startswith("function:"):
        return svc, rest[len("function:"):].split(":")[0]
    if svc == "logs" and rest.startswith("log-group:"):
        return svc, rest[len("log-group:"):].removesuffix(":*")
    if svc == "s3":
        return svc, rest
    if svc == "iam" and rest.startswith("role" + ROLE_PATH):
        return svc, rest.rsplit("/", 1)[-1]
    return svc, None


def in_scope(svc, name):
    if not name:
        return False
    if svc in ("kinesis", "firehose", "lambda"):
        return name.startswith(PREFIX)
    if svc == "logs":
        return name.startswith("/aws/lambda/" + PREFIX)
    if svc == "s3":
        return name.startswith(BUCKET_PREFIX)
    return svc == "iam"   # parse_arn already required the /loglab/ path


def expiry(tags):
    try:
        return datetime.datetime.fromisoformat(tags[EXPIRES].replace("Z", "+00:00"))
    except (KeyError, ValueError):
        return None


def loglab_resources():
    """(arn, tags) for every resource with loglab's name prefix that is tagged created-by=loglab. Lists each service
    directly rather than via the tagging API, which lags behind deletes and misses some resource types."""
    found = []
    kinesis = boto3.client("kinesis")
    for page in kinesis.get_paginator("list_streams").paginate():
        for name in page.get("StreamNames", []):
            if name.startswith(PREFIX):
                tags = {t["Key"]: t["Value"] for t in kinesis.list_tags_for_stream(StreamName=name)["Tags"]}
                arn = kinesis.describe_stream_summary(StreamName=name)["StreamDescriptionSummary"]["StreamARN"]
                found.append((arn, tags))
    firehose = boto3.client("firehose")
    start = None
    while True:
        page = firehose.list_delivery_streams(Limit=100, **({"ExclusiveStartDeliveryStreamName": start} if start else {}))
        for name in page["DeliveryStreamNames"]:
            if name.startswith(PREFIX):
                tags = {t["Key"]: t["Value"] for t in firehose.list_tags_for_delivery_stream(DeliveryStreamName=name)["Tags"]}
                arn = firehose.describe_delivery_stream(DeliveryStreamName=name)["DeliveryStreamDescription"]["DeliveryStreamARN"]
                found.append((arn, tags))
        if not page.get("HasMoreDeliveryStreams") or not page["DeliveryStreamNames"]:
            break
        start = page["DeliveryStreamNames"][-1]
    lam = boto3.client("lambda")
    for page in lam.get_paginator("list_functions").paginate():
        for f in page["Functions"]:
            if f["FunctionName"].startswith(PREFIX):
                found.append((f["FunctionArn"], lam.list_tags(Resource=f["FunctionArn"]).get("Tags", {})))
    logs = boto3.client("logs")
    for page in logs.get_paginator("describe_log_groups").paginate(logGroupNamePrefix="/aws/lambda/" + PREFIX):
        for g in page["logGroups"]:
            found.append((g["arn"], logs.list_tags_log_group(logGroupName=g["logGroupName"]).get("tags", {})))
    s3 = boto3.client("s3")
    for b in s3.list_buckets().get("Buckets", []):
        if b["Name"].startswith(BUCKET_PREFIX):
            try:
                tags = {t["Key"]: t["Value"] for t in s3.get_bucket_tagging(Bucket=b["Name"])["TagSet"]}
            except ClientError:
                tags = {}
            found.append((f"arn:aws:s3:::{b['Name']}", tags))
    iam = boto3.client("iam")
    for page in iam.get_paginator("list_roles").paginate(PathPrefix=ROLE_PATH):
        for role in page["Roles"]:
            found.append((role["Arn"], {t["Key"]: t["Value"] for t in iam.list_role_tags(RoleName=role["RoleName"])["Tags"]}))
    return [(arn, tags) for arn, tags in found if tags.get(TAG_KEY) == TAG_VALUE]


def delete(svc, name):
    if svc == "lambda":
        boto3.client("lambda").delete_function(FunctionName=name)
    elif svc == "firehose":
        boto3.client("firehose").delete_delivery_stream(DeliveryStreamName=name)
    elif svc == "kinesis":
        boto3.client("kinesis").delete_stream(StreamName=name, EnforceConsumerDeletion=True)
    elif svc == "logs":
        boto3.client("logs").delete_log_group(logGroupName=name)
    elif svc == "s3":
        bucket = boto3.resource("s3").Bucket(name)
        bucket.object_versions.delete()
        bucket.objects.all().delete()
        bucket.delete()
    elif svc == "iam":
        iam = boto3.client("iam")
        for p in iam.list_attached_role_policies(RoleName=name)["AttachedPolicies"]:
            iam.detach_role_policy(RoleName=name, PolicyArn=p["PolicyArn"])
        for p in iam.list_role_policies(RoleName=name)["PolicyNames"]:
            iam.delete_role_policy(RoleName=name, PolicyName=p)
        iam.delete_role(RoleName=name)


def handler(event, context=None):
    event = event or {}
    from_budget = "Records" in event   # only the budget's over-limit alert publishes to the guard topic
    everything = from_budget or event.get("mode") == "all"
    dry = bool(event.get("dry_run"))
    now = datetime.datetime.now(datetime.timezone.utc)
    report = {"at": now.isoformat(timespec="seconds"), "trigger": "budget" if from_budget else event.get("trigger", "schedule"),
              "mode": "all" if everything else "expired", "dry_run": dry, "deleted": [], "gone": [], "kept": [], "skipped": [], "errors": []}
    seen = set()
    items = sorted(loglab_resources(), key=lambda it: ORDER.index(parse_arn(it[0])[0]) if parse_arn(it[0])[0] in ORDER else 99)
    for arn, tags in items:
        svc, name = parse_arn(arn)
        if (svc, name) in seen:
            continue
        seen.add((svc, name))
        exp = expiry(tags)
        who = tags.get(OWNER) or "unowned"
        if not everything and exp and exp > now:
            report["kept"].append(f"{arn} (owner {who}, expires {tags[EXPIRES]})")
            continue
        if not in_scope(svc, name):
            report["skipped"].append(f"{arn} (tagged loglab but outside loglab's name prefixes; not touched)")
            continue
        if dry:
            report["deleted"].append(f"{arn} (owner {who}, dry run)")
            continue
        try:
            delete(svc, name)
            report["deleted"].append(f"{arn} (owner {who})")
        except ClientError as e:
            code = e.response.get("Error", {}).get("Code", "")
            if code in GONE:
                report["gone"].append(arn)   # deleted between listing and now (e.g. by `loglab aws down`)
                continue
            report["errors"].append(f"{arn}: {code} {e}")
        except Exception as e:
            report["errors"].append(f"{arn}: {type(e).__name__} {e}")
    print("reaper: " + json.dumps(report))
    return report
