#!/usr/bin/env python3
"""Replace only the "### Test plan" section of a Fleet story's body.

    splice_test_plan.py <issue> <plan.md> --out <dir>            # preview: backup + diff, no write
    splice_test_plan.py <issue> <plan.md> --out <dir> --apply    # write, after the user said yes

The section runs from the "### Test plan" heading to "#### Supplemental testing" (or the next
"### " heading). The heading and everything outside the section stay byte-for-byte. plan.md is
the section's content without the heading.

Preview saves <dir>/body-before.md and <dir>/body-after.md and prints a unified diff.
--apply re-fetches the body and refuses if it changed since the preview (someone ticked a box or
edited the story), then writes with `gh issue edit --body-file` and checks the result.
"""
import argparse
import difflib
import pathlib
import re
import subprocess
import sys


def fetch_body(repo, issue):
    r = subprocess.run(["gh", "issue", "view", str(issue), "-R", repo, "--json", "body", "-q", ".body"],
                       capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"couldn't read #{issue}: {r.stderr.strip()}")
    return r.stdout[:-1] if r.stdout.endswith("\n") else r.stdout


def splice(body, plan):
    crlf = "\r\n" in body
    lines = body.replace("\r\n", "\n").split("\n")
    start = next((i for i, l in enumerate(lines) if re.match(r"^###\s+Test plan\s*$", l)), None)
    if start is None:
        sys.exit('no "### Test plan" heading in the body; ask the user where the plan should go')
    end = len(lines)
    for j in range(start + 1, len(lines)):
        if re.match(r"^####\s+Supplemental testing", lines[j]) or re.match(r"^###\s", lines[j]):
            end = j
            break
    plan_lines = plan.replace("\r\n", "\n").strip("\n").split("\n")
    if plan_lines and re.match(r"^###\s+Test plan\s*$", plan_lines[0]):
        plan_lines = plan_lines[1:]
    new = lines[:start + 1] + plan_lines + [""] + lines[end:]
    text = "\n".join(new)
    return text.replace("\n", "\r\n") if crlf else text


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("issue", type=int)
    ap.add_argument("plan")
    ap.add_argument("--out", required=True)
    ap.add_argument("--repo", default="fleetdm/fleet")
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    plan = pathlib.Path(a.plan).read_text()
    body = fetch_body(a.repo, a.issue)
    before, after = out / "body-before.md", out / "body-after.md"

    if a.apply:
        if not before.exists():
            sys.exit("run the preview first (without --apply) so there's a backup and a diff the user saw")
        if body != before.read_text():
            sys.exit(f"#{a.issue} changed since the preview. Re-run the preview, re-check the plan against "
                     "the new body (ticked boxes, edits), and show the user the new diff.")
        new = splice(body, plan)
        if new != after.read_text():
            sys.exit("plan.md changed since the preview; re-run the preview and show the user the new diff")
        r = subprocess.run(["gh", "issue", "edit", str(a.issue), "-R", a.repo, "--body-file", str(after)],
                           capture_output=True, text=True)
        if r.returncode != 0:
            sys.exit(f"gh issue edit failed: {r.stderr.strip()}")
        if fetch_body(a.repo, a.issue).replace("\r\n", "\n") != new.replace("\r\n", "\n"):
            sys.exit("wrote the body but it reads back different; check the issue by hand")
        print(f"updated the Test plan section of #{a.issue}; backup of the old body: {before}")
        return

    new = splice(body, plan)
    before.write_text(body)
    after.write_text(new)
    diff = difflib.unified_diff(body.replace("\r\n", "\n").split("\n"), new.replace("\r\n", "\n").split("\n"),
                                f"#{a.issue} now", f"#{a.issue} with plan.md", lineterm="", n=1)
    sys.stdout.write("\n".join(diff) + "\n")
    print(f"\npreview only: {after} (backup {before}). Nothing written to GitHub.")


if __name__ == "__main__":
    main()
