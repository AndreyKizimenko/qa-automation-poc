#!/usr/bin/env python3
"""Find past Fleet bugs in the area a story touches.

    related_bugs.py [-k "zero-touch" -k "android enrollment token" ...]
                    [-f server/mdm/android/service/service.go ...]
                    [--fleet ~/repositories/fleet] [--since 2025-01-01] [--limit 25] [--out bugs.md]

Two sources, merged and ranked by how many of them hit each bug:
  -k  GitHub search over fleetdm/fleet issues labeled `bug` (open and closed).
  -f  Git history of those files on origin/main: each commit's PR, then the issues that PR closes.
      Fix PRs land in the same files as the next regression, so this finds bugs keyword search misses.

Prints a markdown table (number, state, released/unreleased, group, title, found by). Read-only.
"""
import argparse
import json
import pathlib
import re
import subprocess
import sys
import time

REPO = "fleetdm/fleet"


def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        print(f"warning: {' '.join(cmd[:4])}… failed: {r.stderr.strip()[:200]}", file=sys.stderr)
        return ""
    return r.stdout


def search_keyword(kw, limit):
    cmd = ["gh", "search", "issues", kw, "-R", REPO, "--label", "bug", "--limit", str(limit),
           "--json", "number,title,state,labels,closedAt,createdAt"]
    for attempt in range(4):
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode == 0:
            return json.loads(r.stdout or "[]")
        if "rate limit" not in r.stderr.lower():
            break
        time.sleep(20 * (attempt + 1))  # search API allows ~30 requests a minute
    print(f"warning: search for {kw!r} failed: {r.stderr.strip()[:200]}", file=sys.stderr)
    return []


def prs_from_log(fleet, since, extra):
    out = run(["git", "-C", fleet, "log", "origin/main", f"--since={since}", "--format=%s", *extra])
    return sorted({int(n) for n in re.findall(r"\(#(\d+)\)", out)})


def issues_closed_by(prs):
    found = {}
    for k in range(0, len(prs), 40):
        chunk = prs[k:k + 40]
        fields = " ".join(
            f"p{n}: issueOrPullRequest(number:{n}) {{ ... on PullRequest {{ number title "
            f"closingIssuesReferences(first:5) {{ nodes {{ number title state closedAt createdAt "
            f"labels(first:20){{nodes{{name}}}} }} }} }} }}" for n in chunk)
        q = f'query {{ repository(owner:"fleetdm", name:"fleet") {{ {fields} }} }}'
        data = json.loads(run(["gh", "api", "graphql", "-f", f"query={q}"]) or "{}")
        for pr in ((data.get("data") or {}).get("repository") or {}).values():
            if not pr or "closingIssuesReferences" not in pr:
                continue
            for iss in pr["closingIssuesReferences"]["nodes"]:
                iss["labels"] = [{"name": l["name"]} for l in iss["labels"]["nodes"]]
                iss["via_pr"] = pr["number"]
                found.setdefault(iss["number"], iss)
    return found


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-k", "--keyword", action="append", default=[])
    ap.add_argument("-f", "--file", action="append", default=[])
    ap.add_argument("-s", "--symbol", action="append", default=[])
    ap.add_argument("--fleet", default=str(pathlib.Path.home() / "repositories/fleet"))
    ap.add_argument("--since", default="2025-01-01")
    ap.add_argument("--limit", type=int, default=25, help="results per keyword")
    ap.add_argument("--out")
    a = ap.parse_args()
    if not (a.keyword or a.file or a.symbol):
        sys.exit("give at least one -k keyword, -f file or -s symbol")

    bugs = {}

    def date(issue):
        d = issue.get("closedAt") or ""
        if not d or d.startswith("0001"):
            d = issue.get("createdAt") or ""
        return d[:10]

    def add(issue, how):
        labels = [l["name"] for l in issue.get("labels", [])]
        if "bug" not in labels:
            return
        b = bugs.setdefault(issue["number"], {
            "number": issue["number"], "title": issue["title"], "state": issue["state"].lower(),
            "labels": labels, "date": date(issue), "hits": []})
        if how not in b["hits"]:
            b["hits"].append(how)

    for kw in a.keyword:
        for iss in search_keyword(kw, a.limit):
            add(iss, f'"{kw}"')
    if a.file:
        for iss in issues_closed_by(prs_from_log(a.fleet, a.since, ["--", *a.file])).values():
            add(iss, f"files (PR #{iss['via_pr']})")
    for sym in a.symbol:
        for iss in issues_closed_by(prs_from_log(a.fleet, a.since, [f"-S{sym}"])).values():
            add(iss, f"{sym} (PR #{iss['via_pr']})")

    def kind(labels):
        for l, short in (("~unreleased bug", "unreleased"), ("~released bug", "released"),
                         ("~critical bug", "critical")):
            if l in labels:
                return short
        return "-"

    rows = sorted(bugs.values(), key=lambda b: (len(b["hits"]), b["date"]), reverse=True)
    lines = ["| # | state | kind | group | date | title | found by |", "|---|---|---|---|---|---|---|"]
    for b in rows:
        group = ",".join(l for l in b["labels"] if l.startswith("#g-")) or "-"
        title = b["title"].replace("|", "\\|")
        lines.append(f"| #{b['number']} | {b['state']} | {kind(b['labels'])} | {group} | {b['date']} | "
                     f"{title} | {'; '.join(b['hits'])} |")
    text = "\n".join(lines) + f"\n\n{len(rows)} bugs.\n"
    if a.out:
        pathlib.Path(a.out).write_text(text)
    print(text)


if __name__ == "__main__":
    main()
