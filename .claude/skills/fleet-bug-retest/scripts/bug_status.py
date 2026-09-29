#!/usr/bin/env python3
"""Status of filed bugs: issue state, board status, fix PRs, and which instance has the fix.

usage: bug_status.py [--ctx previous --ctx default] [--mine] [N ...]
  N ...    issue numbers in fleetdm/fleet (default: every issue in $QA_WORKSPACE/filed-bugs/INDEX.md;
           QA_WORKSPACE defaults to $FLEET_REPO/qa-stuff, FLEET_REPO to ~/repositories/fleet)
  --mine   also include every bug you authored (up to 100), tracked or not — only when explicitly asked
Prints one JSON object per issue.
"""
import json, os, re, subprocess, sys, urllib.request

REPO = "fleetdm/fleet"
FLEET = os.path.expanduser(os.environ.get("FLEET_REPO", "~/repositories/fleet"))
QA_WORKSPACE = os.path.expanduser(os.environ.get("QA_WORKSPACE", os.path.join(FLEET, "qa-stuff")))
INDEX = os.path.join(QA_WORKSPACE, "filed-bugs/INDEX.md")

def sh(*a):
    return subprocess.run(a, capture_output=True, text=True).stdout

def gql(q, **v):
    args = ["gh", "api", "graphql", "-f", f"query={q}"] + sum([["-F", f"{k}={x}"] for k, x in v.items()], [])
    return json.loads(sh(*args) or "{}")

def ctx_rev(ctx):
    cfg = open(os.path.expanduser("~/.fleet/config")).read().split("\n")
    addr = tok = None; on = False
    for l in cfg:
        if re.match(r"^  \S", l): on = l.strip() == ctx + ":"
        elif on:
            m = re.match(r"^\s+(address|token):\s*(\S+)", l)
            if m: addr, tok = (m[2], tok) if m[1] == "address" else (addr, m[2])
    req = urllib.request.Request(addr.rstrip("/") + "/api/v1/fleet/version", headers={"Authorization": "Bearer " + tok})
    d = json.load(urllib.request.urlopen(req, timeout=20))
    return d["revision"], f'{d["branch"]} ({d["revision"][:7]})'

def contains(rev, sha, pr, title=""):
    """True if the build has the fix: the merge commit itself, or a cherry-pick citing the PR
    (squash merges and cherry-pick PRs both put "#<pr>" in the subject)."""
    if not sha: return None
    r = subprocess.run(["git", "-C", FLEET, "merge-base", "--is-ancestor", sha, rev], capture_output=True)
    if r.returncode == 0: return True
    if r.returncode != 1: return None  # unknown (fetch needed)
    # --grep searches whole messages (bodies often list other PRs), so confirm on the subject
    num = re.compile(rf"#{pr}([^0-9]|$)")
    for line in sh("git", "-C", FLEET, "log", "--format=%h\t%s", "-E", f"--grep=#{pr}([^0-9]|$)", rev).splitlines():
        h, _, subj = line.partition("\t")
        if num.search(subj): return "cherry-pick " + h
    if title:  # some cherry-picks keep only the PR title as the subject
        for line in sh("git", "-C", FLEET, "log", "--format=%h\t%s", "-F", f"--grep={title}", rev).splitlines():
            h, _, subj = line.partition("\t")
            if subj.strip().startswith(title): return "cherry-pick " + h
    return False

ISSUE = """query($n:Int!){ repository(owner:"fleetdm",name:"fleet"){ issue(number:$n){
  number title state stateReason url labels(first:30){nodes{name}}
  projectItems(first:10){nodes{project{title} fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}}}
  closedByPullRequestsReferences(first:10,includeClosedPrs:true){nodes{number title state mergedAt baseRefName mergeCommit{oid}}}
  timelineItems(first:50,itemTypes:[CROSS_REFERENCED_EVENT]){nodes{... on CrossReferencedEvent{source{... on PullRequest{number title state mergedAt baseRefName mergeCommit{oid} repository{nameWithOwner}}}}}}
}}}"""

args = sys.argv[1:]
ctxs = [args[i + 1] for i, a in enumerate(args) if a == "--ctx"] or ["previous", "default"]
nums = [int(a) for a in args if a.isdigit()]
if not nums and os.path.exists(INDEX):
    nums = [int(m) for m in re.findall(r"^\|\s*#(\d+)", open(INDEX).read(), re.M)]
if "--mine" in args:
    mine = json.loads(sh("gh", "issue", "list", "-R", REPO, "--author", "@me", "--label", "bug", "--state", "all",
                         "--limit", "100", "--json", "number") or "[]")
    nums = sorted(set(nums) | {m["number"] for m in mine}, reverse=True)

subprocess.run(["git", "-C", FLEET, "fetch", "-q", "origin"], capture_output=True)
revs = {}
for c in ctxs:
    try: revs[c] = ctx_rev(c)
    except Exception as e: revs[c] = (None, f"unreachable: {e}")

for n in nums:
    i = (gql(ISSUE, n=n).get("data") or {}).get("repository", {}).get("issue")
    if not i:
        print(json.dumps({"issue": n, "error": "not found"}, ensure_ascii=False)); continue
    prs = {p["number"]: p for p in i["closedByPullRequestsReferences"]["nodes"]}
    for t in i["timelineItems"]["nodes"]:
        s = (t or {}).get("source") or {}
        if s.get("number") and (s.get("repository") or {}).get("nameWithOwner") == REPO:
            prs.setdefault(s["number"], s)
    fixes = []
    for p in prs.values():
        sha = (p.get("mergeCommit") or {}).get("oid")
        fixes.append({"pr": p["number"], "title": p["title"], "state": p["state"], "base": p["baseRefName"],
                      "merge": sha[:10] if sha else None,
                      "in": {c: contains(r, sha, p["number"], p["title"]) for c, (r, _) in revs.items() if r}})
    print(json.dumps({
        "issue": n, "title": i["title"], "state": i["state"], "reason": i["stateReason"],
        "labels": [l["name"] for l in i["labels"]["nodes"]],
        "board": [f'{x["project"]["title"]}={x["fieldValueByName"]["name"]}' for x in i["projectItems"]["nodes"] if x.get("fieldValueByName")],
        "prs": fixes, "instances": {c: b for c, (_, b) in revs.items()},
    }, ensure_ascii=False))
