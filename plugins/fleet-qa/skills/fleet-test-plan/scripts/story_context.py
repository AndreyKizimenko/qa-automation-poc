#!/usr/bin/env python3
"""Collect everything a test plan starts from for one Fleet story.

    story_context.py <issue> --out <dir> [--repo fleetdm/fleet]

Writes to <dir>:
  story.md               title, labels, milestone, people, then the body as-is
  comments.md            every comment, oldest first
  test-plan-current.md   the body's "### Test plan" section (empty if none)
  context.json           linked PRs (classified), linked issues, Figma links, plan stats
  pr-<N>.md              each code PR's description, comments, reviews and inline review threads
and prints a short summary, including which pass this looks like.

Needs an authenticated `gh`. Read-only: it never writes to GitHub.
"""
import argparse
import json
import pathlib
import re
import subprocess
import sys

DOC_PREFIXES = ("docs/", "articles/", "handbook/", "website/", "schema/")


def gh(*args):
    r = subprocess.run(["gh", *args], capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"gh {' '.join(args[:3])}… failed: {r.stderr.strip()}")
    return r.stdout


def gh_json(*args):
    return json.loads(gh(*args) or "null")


def test_plan_section(body):
    lines = body.replace("\r\n", "\n").split("\n")
    start = next((i for i, l in enumerate(lines) if re.match(r"^###\s+Test plan\s*$", l)), None)
    if start is None:
        return ""
    end = len(lines)
    for j in range(start + 1, len(lines)):
        if re.match(r"^####\s+Supplemental testing", lines[j]) or re.match(r"^###\s", lines[j]):
            end = j
            break
    return "\n".join(lines[start + 1:end]).strip("\n")


def strip_html_comments(text):
    return re.sub(r"<!--.*?-->", "", text, flags=re.S)


def lookup_numbers(repo, numbers):
    """Resolve #N references to issue/PR type, title, state and labels in batched GraphQL calls."""
    owner, name = repo.split("/")
    out = {}
    nums = sorted(numbers)
    for k in range(0, len(nums), 40):
        chunk = nums[k:k + 40]
        fields = " ".join(
            f'n{n}: issueOrPullRequest(number:{n}) {{ __typename '
            f'... on Issue {{ number title state labels(first:20){{nodes{{name}}}} }} '
            f'... on PullRequest {{ number title state mergedAt baseRefName labels(first:20){{nodes{{name}}}} }} }}'
            for n in chunk)
        q = f'query {{ repository(owner:"{owner}", name:"{name}") {{ {fields} }} }}'
        r = subprocess.run(["gh", "api", "graphql", "-f", f"query={q}"], capture_output=True, text=True)
        data = json.loads(r.stdout or "{}").get("data", {}) or {}
        for v in (data.get("repository") or {}).values():
            if v:
                v["labels"] = [x["name"] for x in v.get("labels", {}).get("nodes", [])]
                out[v["number"]] = v
    return out


def classify_pr(repo, number):
    pr = gh_json("pr", "view", str(number), "-R", repo, "--json",
                 "number,title,state,mergedAt,baseRefName,author,url,files,additions,deletions")
    files = [f["path"] for f in pr.get("files", [])]
    code = [f for f in files if not f.startswith(DOC_PREFIXES) and not f.startswith("changes/")]
    kind = "docs" if files and not code else ("code" if code else "empty")
    areas = sorted({f.split("/")[0] + ("/" + f.split("/")[1] if f.count("/") > 1 else "") for f in code})
    return {
        "number": pr["number"], "title": pr["title"], "state": pr["state"],
        "merged": bool(pr.get("mergedAt")), "base": pr.get("baseRefName"),
        "author": (pr.get("author") or {}).get("login"), "url": pr["url"],
        "kind": kind, "files": len(files), "code_areas": areas,
        "cherry_pick": (pr.get("baseRefName") or "").startswith("rc-"),
        "size": f"+{pr.get('additions', 0)}/-{pr.get('deletions', 0)}",
    }


def write_pr_conversation(repo, number, path):
    """The engineer's own notes live here: what they ran and saw, known gaps, review decisions."""
    pr = gh_json("pr", "view", str(number), "-R", repo, "--json", "title,body,author,comments,reviews")
    inline = [json.loads(l) for l in gh(
        "api", f"repos/{repo}/pulls/{number}/comments?per_page=100", "--paginate", "--jq",
        ".[] | {user: .user.login, path, line: (.line // .original_line), body, created_at}").splitlines()
        if l.strip()]
    parts = [f"# PR #{number} {pr['title']} (by {(pr.get('author') or {}).get('login')})\n\n"
             f"{pr.get('body') or '(no description)'}\n"]
    for c in pr.get("comments", []):
        parts.append(f"\n## comment: {c['author']['login']} — {c['createdAt']}\n\n{c['body']}\n")
    for r in pr.get("reviews", []):
        if r.get("body"):
            parts.append(f"\n## review ({r['state'].lower()}): {r['author']['login']} — "
                         f"{r.get('submittedAt', '')}\n\n{r['body']}\n")
    for c in inline:
        parts.append(f"\n## inline: {c['user']} on {c['path']}:{c['line']} — {c['created_at']}\n\n{c['body']}\n")
    path.write_text("".join(parts))
    return len(pr.get("comments", [])) + len([r for r in pr.get("reviews", []) if r.get("body")]) + len(inline)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("issue", type=int)
    ap.add_argument("--out", required=True)
    ap.add_argument("--repo", default="fleetdm/fleet")
    a = ap.parse_args()
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)

    iss = gh_json("issue", "view", str(a.issue), "-R", a.repo, "--json",
                  "number,title,body,labels,milestone,state,author,assignees,comments,url")
    body = (iss.get("body") or "").replace("\r\n", "\n")
    labels = [l["name"] for l in iss.get("labels", [])]
    (out / "story.md").write_text(
        f"# #{iss['number']} {iss['title']}\n\n"
        f"- url: {iss['url']}\n- state: {iss['state']}\n- labels: {', '.join(labels)}\n"
        f"- milestone: {(iss.get('milestone') or {}).get('title', '-')}\n"
        f"- author: {(iss.get('author') or {}).get('login')}\n"
        f"- assignees: {', '.join(x['login'] for x in iss.get('assignees', [])) or '-'}\n\n---\n\n{body}\n")
    comments = iss.get("comments", [])
    (out / "comments.md").write_text("".join(
        f"## {c['author']['login']} — {c['createdAt']}\n\n{c['body']}\n\n" for c in comments) or "(no comments)\n")

    plan = test_plan_section(body)
    (out / "test-plan-current.md").write_text(plan + ("\n" if plan else ""))
    visible = strip_html_comments(plan)
    rows = re.findall(r"^\s*- \[( |x|X)\] ", visible, flags=re.M)
    ticked = sum(1 for r in rows if r.lower() == "x")
    todo_only = bool(re.search(r"^\s*-\s*TODO\s*$", visible, flags=re.M)) and not rows

    # Linked PRs: timeline cross-references plus anything the body/comments link to.
    timeline = [json.loads(l) for l in gh(
        "api", f"repos/{a.repo}/issues/{a.issue}/timeline?per_page=100", "--paginate", "--jq",
        '.[] | select(.event=="cross-referenced") | .source.issue | '
        '{number, pr: (.pull_request != null), repo: (.repository_url | sub(".*/repos/"; ""))}'
    ).splitlines() if l.strip()]
    # References from other repos (fleetdm/confidential, …) can't be looked up here; list them by name only.
    elsewhere = sorted({f"{t['repo']}#{t['number']}" for t in timeline if t["repo"] != a.repo})
    timeline = [t for t in timeline if t["repo"] == a.repo]
    text = body + "\n" + "\n".join(c["body"] for c in comments)
    refs = {int(n) for n in re.findall(r"github\.com/fleetdm/fleet/(?:pull|issues)/(\d+)", text)}
    refs |= {int(n) for n in re.findall(r"(?<![\w/&])#(\d{4,6})\b", text)}
    refs.discard(a.issue)
    meta = lookup_numbers(a.repo, refs | {t["number"] for t in timeline})
    pr_numbers = sorted({t["number"] for t in timeline if t["pr"]} |
                        {n for n, m in meta.items() if m.get("__typename") == "PullRequest"})
    prs = [classify_pr(a.repo, n) for n in pr_numbers]
    for p in prs:
        if p["kind"] == "code":
            p["conversation_items"] = write_pr_conversation(a.repo, p["number"], out / f"pr-{p['number']}.md")
    issues = sorted(
        ({"number": n, "title": m["title"], "state": m["state"], "labels": m["labels"],
          "is_bug": "bug" in m["labels"], "linked_from": "timeline" if n not in refs else "text"}
         for n, m in meta.items() if m.get("__typename") == "Issue"), key=lambda x: x["number"])
    figma = sorted(set(re.findall(r"https://(?:www\.)?figma\.com/[^\s)\]>\"']+", text)))
    subs = [json.loads(l) for l in gh(
        "api", f"repos/{a.repo}/issues/{a.issue}/sub_issues?per_page=100", "--paginate", "--jq",
        ".[] | {number, title, state}").splitlines() if l.strip()]

    impl = [p for p in prs if p["kind"] == "code" and (p["merged"] or p["state"] == "OPEN")]
    if impl:
        phase = "pr-update" if rows else "pr-first"
    else:
        phase = "design-update" if rows else "design-first"

    ctx = {"issue": a.issue, "title": iss["title"], "labels": labels,
           "milestone": (iss.get("milestone") or {}).get("title"), "phase_guess": phase,
           "plan_rows": len(rows), "plan_rows_ticked": ticked, "plan_is_template_only": todo_only or not rows,
           "prs": prs, "issues": issues, "sub_issues": subs, "figma": figma,
           "referenced_elsewhere": elsewhere}
    (out / "context.json").write_text(json.dumps(ctx, indent=2) + "\n")

    print(f"#{a.issue} {iss['title']}  [{', '.join(labels)}]  milestone={ctx['milestone']}")
    print(f"phase guess: {phase}   existing plan rows: {len(rows)} ({ticked} ticked)   comments: {len(comments)}")
    print(f"figma links: {len(figma)}")
    for p in prs:
        flag = " cherry-pick" if p["cherry_pick"] else ""
        talk = f" talk={p['conversation_items']}" if "conversation_items" in p else ""
        print(f"  PR #{p['number']} [{p['kind']}{flag}] {p['state'].lower()} "
              f"base={p['base']} {p['size']}{talk} {p['title']}  {', '.join(p['code_areas'][:6])}")
    for i in subs:
        print(f"  sub-issue #{i['number']} {i['state']} {i['title']}")
    for i in issues:
        print(f"  issue #{i['number']} {i['state'].lower()}{' BUG' if i['is_bug'] else ''} {i['title']}")
    if elsewhere:
        print(f"  referenced from other repos: {', '.join(elsewhere)}")
    print(f"wrote {out}/story.md comments.md test-plan-current.md context.json"
          f"{' pr-<N>.md' if any('conversation_items' in p for p in prs) else ''}")


if __name__ == "__main__":
    main()
