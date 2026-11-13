#!/usr/bin/env python3
"""Remember what every test did in every reviewed run, and say how a test has
fared before.

A report answers "what failed tonight". It can't answer "has this failed
before, and the same way?", which is the difference between a first sighting
and the fifth occurrence of a race nobody fixed. This keeps one line per test
per run in a local history file and reads it back.

Usage:
    run_history.py add  <report-dir> [--run ID] [--tier premium|free] [--build REV]
    run_history.py show <report-dir> [--run ID] [--tier premium|free] [--last 14]

  add    append the report's tests to the history. A run already recorded for
         that tier is left alone, so adding twice is harmless.
  show   for each test that failed or was flaky in the report: how it fared in
         the runs recorded before this one, and whether the error is the same.

  --run      the GitHub run id. Read from a `run-<id>` folder in the path when
             omitted (what fetch_ci_run.sh's callers name their download dir).
  --tier     read from a `playwright-report-<tier>` folder name when omitted.
  --build    the Fleet revision the instance ran, when known.
  --history  the history file (default: playwright/docs/run-reviews/history.jsonl,
             which is gitignored: it lives on the machine that does the reviews).

The report's data comes from `results.json`, which CI writes beside the HTML
when it merges a run's reports. A report without one (a run from before CI
wrote it, or a local run) is read from the data the HTML report embeds.

The history holds no secret, by construction: a test's file and title, its
outcome, retry count and duration, and a hash of its first error. Never the
error's text, which can quote a response or a typed value.
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_report import load_embedded_zip, strip_ansi  # noqa: E402

NON_PASS = ("unexpected", "flaky")
WORST_FIRST = ["unexpected", "flaky", "expected", "skipped", ""]


def repo_root():
    here = os.path.dirname(os.path.abspath(__file__))
    return subprocess.check_output(["git", "-C", here, "rev-parse", "--show-toplevel"], text=True).strip()


def default_history():
    return os.path.join(repo_root(), "playwright", "docs", "run-reviews", "history.jsonl")


def error_hash(message):
    """A short id for an error's cause: its first two lines with the parts that
    change from run to run (numbers, ids, quoted values) taken out, so the same
    failure on another night hashes the same."""
    lines = [ln.strip() for ln in strip_ansi(message or "").splitlines() if ln.strip()]
    head = " | ".join(lines[:2])
    head = re.sub(r"\"[^\"]*\"|'[^']*'|`[^`]*`", "S", head)
    head = re.sub(r"[0-9a-f]{8,}|\d+", "N", head)
    return hashlib.sha1(head.encode()).hexdigest()[:10] if head else ""


def from_results_json(path):
    """(start time, tests) from the JSON reporter's output."""
    data = json.load(open(path, encoding="utf-8"))
    tests = []

    def walk(suite, describes, file):
        for spec in suite.get("specs", []):
            for t in spec.get("tests", []):
                results = t.get("results", [])
                first_error = next(
                    (e.get("message", "") for r in results for e in r.get("errors", []) if e.get("message")), ""
                )
                tests.append(
                    {
                        "project": t.get("projectName", ""),
                        "file": spec.get("file") or file,
                        "title": " › ".join(describes + [spec.get("title", "")]),
                        "outcome": t.get("status", ""),
                        "retries": max(len(results) - 1, 0),
                        "duration_ms": int(sum(r.get("duration", 0) for r in results)),
                        "error": error_hash(first_error),
                    }
                )
        for child in suite.get("suites", []):
            walk(child, describes + [child.get("title", "")], child.get("file") or file)

    # A top-level suite is a file; the suites inside it are its describes.
    for suite in data.get("suites", []):
        walk(suite, [], suite.get("file", ""))
    return data.get("stats", {}).get("startTime", ""), tests


def from_html_report(index_html):
    """(start time, tests) from the data the HTML report embeds."""
    zf = load_embedded_zip(index_html)
    main = json.loads(zf.read("report.json"))
    tests = []
    for f in main.get("files", []):
        detail = json.loads(zf.read(f["fileId"] + ".json"))
        for t in detail.get("tests", []):
            results = t.get("results", [])
            first_error = next(
                (e.get("message", "") for r in results for e in r.get("errors", []) if e.get("message")), ""
            )
            # `path` is the describe chain; older reports put the file first in it.
            describes = [p for p in t.get("path", []) if p and p != detail.get("fileName")]
            tests.append(
                {
                    "project": t.get("projectName", ""),
                    "file": detail.get("fileName", ""),
                    "title": " › ".join(describes + [t.get("title", "")]),
                    "outcome": t.get("outcome", ""),
                    "retries": max(len(results) - 1, 0),
                    "duration_ms": int(sum(r.get("duration", 0) for r in results)),
                    "error": error_hash(first_error),
                }
            )
    start = main.get("startTime")
    if isinstance(start, (int, float)):
        import datetime

        start = datetime.datetime.fromtimestamp(start / 1000, datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    return start or "", tests


def read_report(report_dir):
    results = os.path.join(report_dir, "results.json")
    if os.path.isfile(results):
        return from_results_json(results)
    index_html = os.path.join(report_dir, "index.html")
    if os.path.isfile(index_html):
        return from_html_report(index_html)
    sys.exit(f"Neither results.json nor index.html in {report_dir}")


def infer(args):
    path = os.path.abspath(args.report_dir)
    run = args.run or (re.search(r"run-(\d{6,})", path) or [None, None])[1]
    tier = args.tier or (re.search(r"playwright-report-(premium|free)", path) or [None, None])[1]
    if not run:
        sys.exit("Which run is this? Pass --run <id> (the path has no run-<id> folder to read it from).")
    if not tier:
        sys.exit("Which tier is this? Pass --tier premium|free (the path has no playwright-report-<tier> folder).")
    return str(run), tier


def load_history(path):
    if not os.path.isfile(path):
        return []
    with open(path, encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


def key(entry):
    return (entry["tier"], entry["project"], entry["file"], entry["title"])


def cmd_add(args):
    run, tier = infer(args)
    history = load_history(args.history)
    if any(e["run"] == run and e["tier"] == tier for e in history):
        print(f"Run {run} ({tier}) is already in {args.history}: nothing added.")
        return
    start, tests = read_report(args.report_dir)
    os.makedirs(os.path.dirname(args.history), exist_ok=True)
    with open(args.history, "a", encoding="utf-8") as fh:
        for t in tests:
            line = {"date": start, "run": run, "tier": tier, "build": args.build or "", **t}
            fh.write(json.dumps(line, ensure_ascii=False) + "\n")
    counts = Counter(t["outcome"] for t in tests)
    print(f"Added run {run} ({tier}, {start[:10]}): {len(tests)} tests, " + ", ".join(f"{n} {o}" for o, n in sorted(counts.items())))


def cmd_show(args):
    run, tier = infer(args)
    _, tests = read_report(args.report_dir)
    history = [e for e in load_history(args.history) if not (e["run"] == run and e["tier"] == tier)]
    runs_recorded = sorted({(e["date"], e["run"]) for e in history if e["tier"] == tier})
    by_test = {}
    for e in history:
        by_test.setdefault(key(e), []).append(e)

    attention = [t for t in tests if t["outcome"] in NON_PASS]
    print(f"Run {run} ({tier}): {len(attention)} of {len(tests)} tests failed or were flaky. "
          f"History holds {len(runs_recorded)} earlier {tier} run(s).")
    for t in attention:
        # One entry per earlier run. A setup or teardown step runs once per
        # invocation, so a merged report lists it several times: keep its worst.
        per_run = {}
        for e in by_test.get((tier, t["project"], t["file"], t["title"]), []):
            kept = per_run.get(e["run"])
            if kept is None or WORST_FIRST.index(e["outcome"]) < WORST_FIRST.index(kept["outcome"]):
                per_run[e["run"]] = e
        before = sorted(per_run.values(), key=lambda e: e["date"])[-args.last:]
        print(f"\n{t['project']} › {t['file']} › {t['title']}")
        print(f"  this run:  {t['outcome']}, {t['retries']} retr{'y' if t['retries'] == 1 else 'ies'}, error {t['error'] or '-'}")
        if not before:
            print("  before:    never recorded. A first sighting, as far as this history goes.")
            continue
        counts = Counter(e["outcome"] for e in before)
        bad = [e for e in before if e["outcome"] in NON_PASS]
        same = [e for e in bad if t["error"] and e["error"] == t["error"]]
        summary = ", ".join(f"{counts[o]} {o}" for o in ("expected", "flaky", "unexpected", "skipped") if counts[o])
        print(f"  before:    last {len(before)} run(s) it ran in: {summary}")
        if bad:
            last = bad[-1]
            print(f"  failed or flaky in {len(bad)} of them, {len(same)} with this same error; "
                  f"most recently {last['date'][:10]} (run {last['run']}, {last['outcome']})")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="command", required=True)
    for name, fn in (("add", cmd_add), ("show", cmd_show)):
        p = sub.add_parser(name)
        p.add_argument("report_dir", help="a report directory, as fetch_ci_run.sh prints them")
        p.add_argument("--run")
        p.add_argument("--tier", choices=("premium", "free"))
        p.add_argument("--history", default=None)
        if name == "add":
            p.add_argument("--build", help="the Fleet revision the instance ran")
        else:
            p.add_argument("--last", type=int, default=14, help="how many earlier runs to look back over (default 14)")
        p.set_defaults(fn=fn)
    args = ap.parse_args()
    args.history = args.history or default_history()
    args.fn(args)


if __name__ == "__main__":
    main()
